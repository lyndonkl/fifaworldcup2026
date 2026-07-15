"""
Part 2: match-window classification, family crossover, concentration extras,
MEX-ENG anomaly dissection, poll-date cross-reference.
Depends on the frozen snapshot re-derived here (same query, DuckDB will hit OS
cache) to stay consistent with part 1's snapshot_manifest.json.
"""
import duckdb
import pandas as pd
import numpy as np
import json

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
TRADES_GLOB = f"{ROOT}/pipeline/data/kalshi/trades/series_ticker=*/*.parquet"
MARKETS_PARQUET = f"{ROOT}/pipeline/data/catalog/markets.parquet"
OUT = f"{ROOT}/pipeline/data/analysis/volume-anatomy"

con = duckdb.connect()
con.execute("SET TimeZone='UTC'")
con.execute("PRAGMA threads=8")
con.execute("PRAGMA disable_progress_bar")

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
n_snap = con.execute("SELECT COUNT(*) FROM trades").fetchone()[0]
print(f"snapshot n={n_snap:,} (compare to part1 manifest)")

# ---------------------------------------------------------------------------
# Match windows from KXWCGAME event occurrence_datetime (kickoff = regulation
# start per R4; markets settle on 90 minutes for KXWCGAME).
# ---------------------------------------------------------------------------
print("=== building match windows ===")
windows = con.execute("""
SELECT DISTINCT event_ticker,
       CAST(occurrence_datetime AS TIMESTAMP) AS kickoff
FROM parquet_scan(?)
WHERE series_ticker = 'KXWCGAME' AND occurrence_datetime IS NOT NULL
ORDER BY kickoff
""", [MARKETS_PARQUET]).df()
windows['kickoff'] = pd.to_datetime(windows['kickoff'], utc=True)
windows['win_start'] = windows['kickoff'] - pd.Timedelta(minutes=60)
windows['win_end'] = windows['kickoff'] + pd.Timedelta(minutes=150)
windows = windows.sort_values('win_start').reset_index(drop=True)
print(f"n windows with known kickoff: {len(windows)} (out of 102 KXWCGAME events)")
windows.to_parquet(f"{OUT}/match_windows.parquet", index=False)

# ---------------------------------------------------------------------------
# Pull (ts, count_contracts) for every trade and classify match-window vs not
# via merge_asof against the 93 non-overlapping-ish windows.
# ---------------------------------------------------------------------------
print("=== pulling ts/contracts for window classification (full tape) ===")
tc = con.execute("SELECT ts, count_contracts FROM trades ORDER BY ts").df()
tc['ts'] = pd.to_datetime(tc['ts'], utc=True)
print(tc.shape)

w = windows[['win_start', 'win_end', 'event_ticker']].sort_values('win_start').reset_index(drop=True)

matched = pd.merge_asof(tc, w, left_on='ts', right_on='win_start', direction='backward')
in_window = matched['ts'] <= matched['win_end']
matched['in_match_window'] = in_window.fillna(False)

mw_summary = matched.groupby('in_match_window')['count_contracts'].agg(['sum', 'count'])
print(mw_summary)
mw_summary.to_csv(f"{OUT}/match_window_split.csv")

# per-match volume (sum of contracts falling in each window, across ALL series
# not just KXWCGAME -- i.e. "how much of everything traded while match X was live")
per_match = matched[matched['in_match_window']].groupby('event_ticker')['count_contracts'].agg(['sum', 'count'])
per_match = per_match.sort_values('sum', ascending=False)
per_match.to_csv(f"{OUT}/per_match_window_volume.csv")
print(per_match.head(10))

del tc, matched  # free memory

# ---------------------------------------------------------------------------
# MEX-ENG anomaly: full tape dissection
# ---------------------------------------------------------------------------
print("=== MEX-ENG anomaly ===")
mexeng = con.execute("""
SELECT ts, count_contracts, yes_price_usd, no_price_usd,
       taker_side, taker_outcome_side, taker_book_side, is_block_trade
FROM trades
WHERE ticker = 'KXWCADVANCE-26JUL05MEXENG-MEX'
ORDER BY ts
""").df()
mexeng.to_parquet(f"{OUT}/mexeng_advance_tape.parquet", index=False)
print(mexeng.shape, mexeng['ts'].min(), mexeng['ts'].max())

# comparison legs: KXWCADVANCE-ENG (same event), and the KXWCGAME 3-way for the same match
comparison = con.execute("""
SELECT ticker, ts, count_contracts, yes_price_usd, taker_side
FROM trades
WHERE ticker IN (
  'KXWCADVANCE-26JUL05MEXENG-ENG',
  'KXWCGAME-26JUL05MEXENG-MEX',
  'KXWCGAME-26JUL05MEXENG-ENG',
  'KXWCGAME-26JUL05MEXENG-TIE'
)
ORDER BY ticker, ts
""").df()
comparison.to_parquet(f"{OUT}/mexeng_comparison_legs.parquet", index=False)
print(comparison.groupby('ticker')['count_contracts'].agg(['sum','count']))

# ---------------------------------------------------------------------------
# Family daily crossover (recompute cumulative, save tidy table)
# ---------------------------------------------------------------------------
print("=== family crossover check ===")
fam = pd.read_parquet(f"{OUT}/family_daily.parquet")
pivot = fam.pivot_table(index='day', columns='family', values='contracts', fill_value=0).sort_index()
cum = pivot.cumsum()
cum.to_parquet(f"{OUT}/family_cumulative.parquet")
fut = 'Tournament winner futures'
match_fam = 'Per-match markets (3-way moneyline + match derivatives)'
crossover_day = cum[cum[match_fam] > cum[fut]].index.min()
print("cumulative crossover day (match family overtakes futures family):", crossover_day)

with open(f"{OUT}/family_crossover.json", "w") as f:
    json.dump({"cumulative_crossover_day": str(crossover_day)}, f, indent=2, default=str)

print("=== part2 done ===")
