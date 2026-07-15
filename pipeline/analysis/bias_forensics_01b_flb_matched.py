"""
Bias Forensics — Analysis 1b: Kalshi vs Pinnacle FLB on matched knockout
matches (the 28 finalized KO fixtures with a clean entity_map join).

Same T-1h-before-settlement anchor as 01_flb.py, applied per-match (the
Kalshi KXWCGAME team1-win leg's settlement_ts - 3600s), so both sources are
read at the identical real-world instant. Three legs per match (team1 win,
draw, team2 win) = 84 observations per source.

Pinnacle: bookmaker='pinnacle', market_name='Full Time Result' (FTR = 90-min
result, the correct comparator per R4). R1 (ms-precision de-dup via arg_max on
created_at), R2 (price_decimal >= 1.01, overround_at_ts != 0) applied.
outcome_id 101=team1, 102=draw, 103=team2 (verified empirically against
France-Sweden: outcome 101 priced ~1.11 decimal, France the 3-0 favorite).

Output: pipeline/data/analysis/bias-forensics/flb_matched_kalshi_vs_pinnacle.parquet
"""
import duckdb
import pandas as pd

OUT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data/analysis/bias-forensics"
DATA = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data"

con = duckdb.connect()

em = con.execute(f"""
SELECT match_id, team1_code, team2_code, kalshi_leg_team1, kalshi_leg_team2,
       kalshi_leg_tie, regulation_result, pinnacle_fixture_id
FROM '{DATA}/audit/entity_map.parquet'
WHERE match_status = 'finalized'
""").df()
print(f"Finalized KO matches in entity_map: {len(em)}")

rows = []
for _, r in em.iterrows():
    for leg_ticker, side_code in [
        (r.kalshi_leg_team1, r.team1_code),
        (r.kalshi_leg_team2, r.team2_code),
        (r.kalshi_leg_tie, "TIE"),
    ]:
        rows.append({"match_id": r.match_id, "ticker": leg_ticker, "side": side_code,
                     "pinnacle_fixture_id": r.pinnacle_fixture_id,
                     "regulation_result": r.regulation_result})
legs = pd.DataFrame(rows)
con.register("legs", legs)

con.execute(f"""
CREATE OR REPLACE TEMP TABLE kalshi_leg AS
SELECT l.match_id, l.side, l.ticker, l.pinnacle_fixture_id, l.regulation_result,
       CASE WHEN l.side = l.regulation_result THEN 1 ELSE 0 END AS realized_yes,
       m.settlement_ts, epoch(CAST(m.settlement_ts AS TIMESTAMP)) - 3600 AS cutoff_epoch,
       m.volume_contracts
FROM legs l
JOIN '{DATA}/catalog/markets.parquet' m ON m.ticker = l.ticker
""")

con.execute(f"""
CREATE OR REPLACE TEMP TABLE kalshi_priced AS
SELECT k.match_id, k.side, k.ticker, k.realized_yes, k.volume_contracts, k.cutoff_epoch,
       arg_max(t.yes_price_usd, t.created_ts) AS kalshi_price
FROM kalshi_leg k
JOIN read_parquet('{DATA}/kalshi/trades/series_ticker=KXWCGAME/*.parquet') t
  ON t.ticker = k.ticker AND t.created_ts <= k.cutoff_epoch
GROUP BY k.match_id, k.side, k.ticker, k.realized_yes, k.volume_contracts, k.cutoff_epoch
""")
n_kalshi = con.execute("SELECT COUNT(*) FROM kalshi_priced").fetchone()[0]
print(f"Kalshi legs priced before T-1h: {n_kalshi} / {len(legs)}")

# outcome_id mapping: 101=team1(participant1), 102=draw, 103=team2(participant2)
con.execute(f"""
CREATE OR REPLACE TEMP TABLE pin AS
SELECT p.fixture_id, p.outcome_id, p.created_at,
       epoch(CAST(p.created_at AS TIMESTAMP)) AS created_epoch,
       p.price_decimal, p.implied_prob_devigged
FROM '{DATA}/benchmarks/odds/pinnacle.parquet' p
WHERE p.bookmaker = 'pinnacle' AND p.market_name = 'Full Time Result'
  AND p.price_decimal >= 1.01
  AND p.overround_at_ts IS NOT NULL AND p.overround_at_ts != 0
""")

con.execute(f"""
CREATE OR REPLACE TEMP TABLE pin_dedup AS
SELECT fixture_id, outcome_id, created_epoch,
       arg_max(implied_prob_devigged, created_at) AS implied_prob_devigged
FROM pin
GROUP BY fixture_id, outcome_id, created_epoch
""")

results = []
for _, r in kalshi_priced.df().iterrows() if False else []:
    pass

kp = con.execute("SELECT * FROM kalshi_priced").df()
merged_rows = []
for _, r in kp.iterrows():
    match = legs[legs.ticker == r.ticker].iloc[0]
    fid = match.pinnacle_fixture_id
    side = r.side
    outcome_id = {"team1": "101"}.get(None)  # placeholder, resolved below
    # Determine outcome_id: side == team1_code -> 101, TIE -> 102, team2_code -> 103
    em_row = em[em.match_id == r.match_id].iloc[0]
    if side == em_row.team1_code:
        oid = "101"
    elif side == "TIE":
        oid = "102"
    elif side == em_row.team2_code:
        oid = "103"
    else:
        oid = None
    cutoff = r.cutoff_epoch
    pq = con.execute(f"""
        SELECT implied_prob_devigged FROM pin_dedup
        WHERE fixture_id = '{fid}' AND outcome_id = '{oid}' AND created_epoch <= {cutoff}
        ORDER BY created_epoch DESC LIMIT 1
    """).fetchone()
    pin_prob = pq[0] if pq else None
    merged_rows.append({
        "match_id": r.match_id, "side": side, "ticker": r.ticker,
        "realized_yes": r.realized_yes, "kalshi_price_c": r.kalshi_price * 100,
        "pinnacle_price_c": pin_prob * 100 if pin_prob is not None else None,
        "volume_contracts": r.volume_contracts,
    })

out = pd.DataFrame(merged_rows)
out.to_parquet(f"{OUT}/flb_matched_kalshi_vs_pinnacle.parquet", index=False)
print(out.to_string())

# Coarse buckets given small n
def bucket_stats(df, pricecol):
    d = df.dropna(subset=[pricecol]).copy()
    edges = [0, 25, 45, 55, 75, 100]
    labels = ["0-25c","25-45c","45-55c","55-75c","75-100c"]
    d["bucket"] = pd.cut(d[pricecol], bins=edges, labels=labels, include_lowest=True)
    agg = d.groupby("bucket", observed=True).agg(
        n=("realized_yes","size"), mean_price=(pricecol,"mean"), win_rate=("realized_yes","mean")
    ).reset_index()
    agg["gap_pp"] = agg["win_rate"]*100 - agg["mean_price"]
    return agg

print("\n=== Kalshi (matched 28 KO matches) ===")
print(bucket_stats(out, "kalshi_price_c").to_string())
print("\n=== Pinnacle (matched 28 KO matches) ===")
print(bucket_stats(out, "pinnacle_price_c").to_string())

# Overall calibration (Brier-like) comparison
d = out.dropna(subset=["pinnacle_price_c"])
kalshi_mae = (d["kalshi_price_c"]/100 - d["realized_yes"]).abs().mean()
pinnacle_mae = (d["pinnacle_price_c"]/100 - d["realized_yes"]).abs().mean()
print(f"\nKalshi mean abs calibration error: {kalshi_mae:.4f}")
print(f"Pinnacle mean abs calibration error: {pinnacle_mae:.4f}")
print(f"n matched with both sources: {len(d)}")
