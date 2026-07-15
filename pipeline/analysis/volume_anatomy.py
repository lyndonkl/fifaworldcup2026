"""
ARM: VOLUME ANATOMY -- where did the traded volume go?

Reads the full Kalshi trade tape (71.8M+ rows, partitioned by series) via DuckDB,
joins to the catalog for family/event metadata, and writes derived tables to
pipeline/data/analysis/volume-anatomy/. Obeys data-audit.md rules R1-R9,
especially R6 (trade-tape sums, not the catalog `volume` field) and R9
(gate on `status`, not `close_time`).

Run: pipeline/.venv/bin/python pipeline/analysis/volume_anatomy.py
"""
import duckdb
import pandas as pd
import numpy as np
import os

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
TRADES_GLOB = f"{ROOT}/pipeline/data/kalshi/trades/series_ticker=*/*.parquet"
MARKETS_PARQUET = f"{ROOT}/pipeline/data/catalog/markets.parquet"
SERIES_PARQUET = f"{ROOT}/pipeline/data/catalog/series.parquet"
OUT = f"{ROOT}/pipeline/data/analysis/volume-anatomy"
os.makedirs(OUT, exist_ok=True)

con = duckdb.connect()
con.execute("SET TimeZone='UTC'")
con.execute("PRAGMA threads=8")
con.execute("PRAGMA disable_progress_bar")

# NOTE: the trade tape is a LIVE store -- a background ingestion pipeline is
# actively appending rows during this session (France-Spain semifinal is being
# played as this script runs; row count observed climbing ~72.58M -> 72.64M
# within a single minute of interactive probing before this script ran).
# To keep every derived table in this run internally consistent (and to make
# the run reproducible against a stated snapshot rather than a moving target),
# we materialize ONE frozen snapshot table up front and every subsequent query
# reads only from that snapshot. The snapshot timestamp + row count are
# recorded to snapshot_manifest.json for the methods note.
print("=== materializing frozen trade-tape snapshot ===")
import time, json as _json
snapshot_pulled_at = pd.Timestamp.utcnow().isoformat()
con.execute(f"""
CREATE OR REPLACE TABLE trades AS
SELECT
    trade_id, ticker, series_ticker,
    to_timestamp(created_ts) AS ts,
    count_contracts,
    yes_price_usd, no_price_usd,
    taker_side, taker_outcome_side, taker_book_side,
    is_block_trade, source_segment
FROM parquet_scan('{TRADES_GLOB}')
""")
_snap_n, _snap_max_ts = con.execute("SELECT COUNT(*), MAX(ts) FROM trades").fetchone()
with open(f"{OUT}/snapshot_manifest.json", "w") as f:
    _json.dump({
        "snapshot_materialized_at_utc": snapshot_pulled_at,
        "n_trades_in_snapshot": int(_snap_n),
        "max_trade_ts_in_snapshot": str(_snap_max_ts),
        "note": "Trade tape is a live store; background ingestion was actively "
                "appending rows during this analysis run (France-Spain SF1 in "
                "progress). All tables in this directory are derived from this "
                "single frozen snapshot for internal consistency.",
    }, f, indent=2)
print(f"snapshot frozen: {_snap_n:,} trades, max ts {_snap_max_ts}")

con.execute(f"""
CREATE OR REPLACE VIEW markets AS
SELECT * FROM parquet_scan('{MARKETS_PARQUET}')
""")

con.execute(f"""
CREATE OR REPLACE VIEW series AS
SELECT * FROM parquet_scan('{SERIES_PARQUET}')
""")

n_trades, total_contracts = con.execute("SELECT COUNT(*), SUM(count_contracts) FROM trades").fetchone()
print(f"n_trades={n_trades:,}  total_contracts={total_contracts:,.0f}")

# ---------------------------------------------------------------------------
# Reference table: ticker -> series_ticker, family, event_ticker, event_title,
# occurrence_datetime, status, result. Gate lifetimes on `status` per R9.
# ---------------------------------------------------------------------------
print("=== building market_ref ===")
market_ref = con.execute("""
SELECT
    m.ticker, m.series_ticker, m.event_ticker, m.event_title,
    m.title, m.occurrence_datetime, m.status, m.result,
    s.family
FROM markets m
LEFT JOIN series s ON m.series_ticker = s.ticker
""").df()
market_ref.to_parquet(f"{OUT}/market_ref.parquet", index=False)
print(market_ref['family'].value_counts(dropna=False))

con.register("market_ref", market_ref)

# ---------------------------------------------------------------------------
# 1. Arrival timeline -- daily traded volume across all WC markets
# ---------------------------------------------------------------------------
print("=== 1. daily arrival timeline ===")
daily = con.execute("""
SELECT date_trunc('day', ts) AS day,
       SUM(count_contracts) AS contracts,
       COUNT(*) AS n_trades
FROM trades
GROUP BY 1
ORDER BY 1
""").df()
daily.to_parquet(f"{OUT}/daily_arrival.parquet", index=False)
print(daily.shape, daily['day'].min(), daily['day'].max())

# ---------------------------------------------------------------------------
# 2. Hourly pulse -- UTC and US/Eastern, weekday x hour
# ---------------------------------------------------------------------------
print("=== 2. hourly heatmap ===")
hourly = con.execute("""
SELECT
    dayofweek(ts) AS dow_utc,
    hour(ts) AS hour_utc,
    dayofweek(timezone('America/New_York', ts)) AS dow_et,
    hour(timezone('America/New_York', ts)) AS hour_et,
    SUM(count_contracts) AS contracts,
    COUNT(*) AS n_trades
FROM trades
GROUP BY 1,2,3,4
""").df()
hourly.to_parquet(f"{OUT}/hourly_heatmap.parquet", index=False)
print(hourly.shape)

# ---------------------------------------------------------------------------
# 3. Family anatomy over time
# ---------------------------------------------------------------------------
print("=== 3. family anatomy over time ===")
family_daily = con.execute("""
SELECT date_trunc('day', t.ts) AS day, r.family,
       SUM(t.count_contracts) AS contracts,
       COUNT(*) AS n_trades
FROM trades t
JOIN market_ref r ON t.ticker = r.ticker
GROUP BY 1,2
ORDER BY 1,2
""").df()
family_daily.to_parquet(f"{OUT}/family_daily.parquet", index=False)
print(family_daily.groupby('family')['contracts'].sum().sort_values(ascending=False))

# per-series family anatomy (finer than the 7 broad families -- catches KXWCMENTION,
# KXTRUMPWORLDCUP, KXWC1H etc individually within "novelty"/"per-match")
print("=== 3b. per-series totals ===")
series_totals = con.execute("""
SELECT t.series_ticker, r.family,
       SUM(t.count_contracts) AS contracts,
       COUNT(*) AS n_trades,
       COUNT(DISTINCT t.ticker) AS n_markets_traded,
       MIN(t.ts) AS first_trade, MAX(t.ts) AS last_trade
FROM trades t
JOIN market_ref r ON t.ticker = r.ticker
GROUP BY 1,2
ORDER BY contracts DESC
""").df()
series_totals.to_parquet(f"{OUT}/series_totals.parquet", index=False)
print(series_totals.head(20).to_string())

# ---------------------------------------------------------------------------
# 5. Concentration -- per-market totals (Gini / top-N share / long tail)
# ---------------------------------------------------------------------------
print("=== 5. per-market concentration ===")
market_totals = con.execute("""
SELECT t.ticker, r.series_ticker, r.family, r.event_ticker, r.status,
       SUM(t.count_contracts) AS contracts,
       COUNT(*) AS n_trades
FROM trades t
JOIN market_ref r ON t.ticker = r.ticker
GROUP BY 1,2,3,4,5
ORDER BY contracts DESC
""").df()
market_totals.to_parquet(f"{OUT}/market_totals.parquet", index=False)
print(market_totals.head(10).to_string())
print("n markets that traded at all:", len(market_totals))

# also grab the FULL catalog market list (traded + never-traded) for the 14.5%-never-traded check
all_markets = con.execute("SELECT ticker, series_ticker, status FROM markets").df()
all_markets.to_parquet(f"{OUT}/all_markets_status.parquet", index=False)
print("catalog markets total:", len(all_markets))

print("=== done with base extraction ===")
