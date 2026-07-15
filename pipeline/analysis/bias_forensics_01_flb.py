"""
Bias Forensics arm — Analysis 1: Favorite-longshot bias (FLB).

Universe: every finalized, in-narrative-scope, binary (result in yes/no) Kalshi
market that ever traded (volume_contracts > 0, i.e. it exists in the trade
tape — the same population as the 71.78M-row tape per data-audit R6).

T-1h definition: for each market, T = settlement_ts (the moment the real-world
question resolved). Price-at-T-1h = the last executed trade's yes_price_usd at
or before (settlement_ts - 3600s). This generalizes across all market types
(winner futures, player-goal novelty markets, match legs) since not all of
them have a natural "kickoff", but all of them have a settlement.

Markets whose entire trading life falls inside the final hour before
settlement are dropped (no price observation available before the cutoff);
count reported for transparency.

Output:
  pipeline/data/analysis/bias-forensics/flb_kalshi_buckets.parquet   (bucketed, market-count basis)
  pipeline/data/analysis/bias-forensics/flb_kalshi_buckets_volweighted.parquet
  pipeline/data/analysis/bias-forensics/flb_kalshi_market_level.parquet (one row per market, for re-derivation)
"""
import duckdb
import pandas as pd

OUT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data/analysis/bias-forensics"
DATA = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data"

con = duckdb.connect()

con.execute(f"""
CREATE OR REPLACE TEMP TABLE mkt AS
SELECT
    ticker,
    series_ticker,
    event_ticker,
    result,
    CASE WHEN result = 'yes' THEN 1 ELSE 0 END AS realized_yes,
    epoch(CAST(settlement_ts AS TIMESTAMP)) AS settle_epoch,
    epoch(CAST(settlement_ts AS TIMESTAMP)) - 3600 AS cutoff_epoch,
    volume_contracts
FROM '{DATA}/catalog/markets.parquet'
WHERE status = 'finalized'
  AND result IN ('yes','no')
  AND in_narrative_scope
  AND volume_contracts > 0
  AND settlement_ts IS NOT NULL
""")
n_universe = con.execute("SELECT COUNT(*) FROM mkt").fetchone()[0]
print(f"FLB universe (finalized binary, in-scope, traded): {n_universe}")

# Last trade price at or before cutoff, per ticker, scanning the full tape once.
con.execute(f"""
CREATE OR REPLACE TEMP TABLE priced AS
SELECT
    t.ticker,
    arg_max(t.yes_price_usd, t.created_ts) AS price_t_minus_1h,
    max(t.created_ts) AS last_trade_ts_used,
    count(*) AS n_trades_before_cutoff
FROM read_parquet('{DATA}/kalshi/trades/series_ticker=*/*.parquet') t
JOIN mkt m ON m.ticker = t.ticker
WHERE t.created_ts <= m.cutoff_epoch
GROUP BY t.ticker
""")
n_priced = con.execute("SELECT COUNT(*) FROM priced").fetchone()[0]
print(f"Markets with a trade before T-1h cutoff: {n_priced} (dropped {n_universe - n_priced})")

con.execute(f"""
CREATE OR REPLACE TEMP TABLE market_level AS
SELECT
    m.ticker, m.series_ticker, m.event_ticker, m.result, m.realized_yes,
    m.volume_contracts, p.price_t_minus_1h, p.n_trades_before_cutoff,
    m.settle_epoch, p.last_trade_ts_used,
    (m.settle_epoch - p.last_trade_ts_used) AS seconds_stale_at_cutoff
FROM mkt m JOIN priced p USING(ticker)
""")

df = con.execute("SELECT * FROM market_level").df()
df.to_parquet(f"{OUT}/flb_kalshi_market_level.parquet", index=False)
print(f"market_level rows: {len(df)}")

# Bucket by price in 5-cent bins: [1,5),[5,10),...,[95,99]  (per brief's "1-5c,...,90-99c" pattern)
edges = [1,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100]
df["price_c"] = df["price_t_minus_1h"] * 100.0
df = df[(df["price_c"] >= 1) & (df["price_c"] <= 99)]
labels = [f"{edges[i]}-{edges[i+1]}c" for i in range(len(edges)-1)]
df["bucket"] = pd.cut(df["price_c"], bins=edges, right=False, labels=labels)

# Market-count basis
agg = df.groupby("bucket", observed=True).agg(
    n_markets=("realized_yes", "size"),
    n_yes=("realized_yes", "sum"),
    mean_price_c=("price_c", "mean"),
    win_rate=("realized_yes", "mean"),
    total_volume=("volume_contracts", "sum"),
).reset_index()
agg["win_rate_pct"] = agg["win_rate"] * 100
agg["calibration_gap_pp"] = agg["win_rate_pct"] - agg["mean_price_c"]  # >0: underpriced (win more than price implied); <0: overpriced (longshot bias)
agg.to_parquet(f"{OUT}/flb_kalshi_buckets.parquet", index=False)
print(agg.to_string())

# Volume-weighted basis: weight each market's realized_yes by its traded volume
def wavg(g, val, w):
    return (g[val] * g[w]).sum() / g[w].sum()

rows = []
for b, g in df.groupby("bucket", observed=True):
    rows.append({
        "bucket": b,
        "n_markets": len(g),
        "total_volume": g["volume_contracts"].sum(),
        "vol_weighted_price_c": wavg(g, "price_c", "volume_contracts"),
        "vol_weighted_win_rate_pct": wavg(g, "realized_yes", "volume_contracts") * 100,
    })
vw = pd.DataFrame(rows)
vw["calibration_gap_pp"] = vw["vol_weighted_win_rate_pct"] - vw["vol_weighted_price_c"]
vw.to_parquet(f"{OUT}/flb_kalshi_buckets_volweighted.parquet", index=False)
print(vw.to_string())

# Summary stats: longshot bucket vs favorite bucket
low = df[df["price_c"] < 10]
high = df[df["price_c"] >= 90]
mid = df[(df["price_c"]>=40)&(df["price_c"]<60)]
print("\n--- Summary ---")
print(f"Low (1-10c) n={len(low)}, mean_price={low['price_c'].mean():.2f}c, win_rate={low['realized_yes'].mean()*100:.2f}%")
print(f"Mid (40-60c) n={len(mid)}, mean_price={mid['price_c'].mean():.2f}c, win_rate={mid['realized_yes'].mean()*100:.2f}%")
print(f"High (90-99c) n={len(high)}, mean_price={high['price_c'].mean():.2f}c, win_rate={high['realized_yes'].mean()*100:.2f}%")
