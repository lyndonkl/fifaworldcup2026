"""
Bias Forensics — Analysis 2: US/Mexico/Canada home-nation pricing bias.

Three cuts:
  (A) Attention premium on the winner-futures book: Kalshi lifetime dollar
      volume per Opta pre-tournament win_pct point, USA/MEX vs peer teams in
      the same 0.9-2.0% Opta win-probability band.
  (B) Time-series overpricing on the R16 elimination-match win leg, resampled
      to 1-minute bins (R7), Kalshi vs Pinnacle de-vigged, over
      [kickoff-120min, kickoff+100min] for USA-BEL, MEX-ENG, CAN-MAR.
  (C) Dollar volume affected: notional traded on the host win-leg while
      Kalshi price sat above the matched Pinnacle de-vigged price.

Output: pipeline/data/analysis/bias-forensics/us_home_bias_matchlevel.parquet
        pipeline/data/analysis/bias-forensics/us_home_bias_futures_peer.parquet
"""
import duckdb
import pandas as pd
import numpy as np

OUT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data/analysis/bias-forensics"
DATA = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data"
con = duckdb.connect()

# ---------- (A) futures attention premium ----------
name_map = {"USA": "United States"}
opta1 = con.execute(f"SELECT team, value_pct AS opta_win_pct FROM '{DATA}/benchmarks/opinion/opta.parquet' WHERE stage_id=1 AND metric='win_pct'").df()
mkt = con.execute(f"SELECT ticker, yes_sub_title AS team, volume_contracts FROM '{DATA}/catalog/markets.parquet' WHERE series_ticker='KXMENWORLDCUP'").df()
mkt["team_norm"] = mkt["team"].replace(name_map)
merged = mkt.merge(opta1, left_on="team_norm", right_on="team", how="inner", suffixes=("", "_opta"))
merged["contracts_per_opta_pt"] = merged["volume_contracts"] / merged["opta_win_pct"]
merged.to_parquet(f"{OUT}/us_home_bias_futures_peer.parquet", index=False)
peer_band = merged[(merged.opta_win_pct >= 0.9) & (merged.opta_win_pct <= 2.0)].sort_values("opta_win_pct")
print("=== Peer band (Opta pre-tournament win_pct 0.9-2.0%) ===")
print(peer_band[["team", "opta_win_pct", "volume_contracts", "contracts_per_opta_pt"]].to_string())
median_ratio = merged[merged.opta_win_pct >= 1.0]["contracts_per_opta_pt"].median()
print(f"\nMedian contracts-per-Opta-point (all teams >=1.0%): {median_ratio:,.0f}")

# ---------- (B) + (C) match-level time series ----------
games = [
    ("JUL06USABEL", "USA", "id1000001653452515", "KXWCGAME-26JUL06USABEL-USA"),
    ("JUL05MEXENG", "MEX", "id1000001653452519", "KXWCGAME-26JUL05MEXENG-MEX"),
    ("JUL04CANMAR", "CAN", "id1000001653452511", "KXWCGAME-26JUL04CANMAR-CAN"),
]

em = con.execute(f"SELECT match_id, team1_code, team2_code FROM '{DATA}/audit/entity_map.parquet'").df()

rows_summary = []
all_series = []
for match_id, host_code, fid, kalshi_ticker in games:
    er = em[em.match_id == match_id].iloc[0]
    outcome_id = "101" if host_code == er.team1_code else "103"
    # kickoff = earliest pinnacle FTR tick as proxy anchor; use fixture_start_time field instead
    kickoff = con.execute(f"""
        SELECT epoch(CAST(fixture_start_time AS TIMESTAMP)) FROM '{DATA}/benchmarks/odds/pinnacle.parquet'
        WHERE fixture_id='{fid}' LIMIT 1
    """).fetchone()[0]
    win_start, win_end = kickoff - 7200, kickoff + 6000  # -120min to +100min

    kt = con.execute(f"""
        SELECT created_ts, yes_price_usd, count_contracts
        FROM read_parquet('{DATA}/kalshi/trades/series_ticker=KXWCGAME/*.parquet')
        WHERE ticker='{kalshi_ticker}' AND created_ts BETWEEN {win_start} AND {win_end}
        ORDER BY created_ts
    """).df()
    pt = con.execute(f"""
        SELECT epoch(CAST(created_at AS TIMESTAMP)) AS ts, implied_prob_devigged
        FROM '{DATA}/benchmarks/odds/pinnacle.parquet'
        WHERE fixture_id='{fid}' AND bookmaker='pinnacle' AND market_name='Full Time Result'
          AND outcome_id='{outcome_id}' AND price_decimal >= 1.01
          AND overround_at_ts IS NOT NULL AND overround_at_ts != 0
          AND epoch(CAST(created_at AS TIMESTAMP)) BETWEEN {win_start} AND {win_end}
        ORDER BY ts
    """).df()

    kt["minute"] = ((kt["created_ts"] - win_start) // 60).astype(int)
    pt["minute"] = ((pt["ts"] - win_start) // 60).astype(int)
    n_minutes = int((win_end - win_start) // 60) + 1
    minutes = pd.DataFrame({"minute": range(n_minutes)})

    k_min = kt.groupby("minute")["yes_price_usd"].last().reindex(range(n_minutes)).ffill()
    p_min = pt.groupby("minute")["implied_prob_devigged"].last().reindex(range(n_minutes)).ffill()
    vol_min = kt.groupby("minute")["count_contracts"].sum().reindex(range(n_minutes)).fillna(0)
    dollar_min = (kt.assign(dollars=kt.yes_price_usd * kt.count_contracts)
                    .groupby("minute")["dollars"].sum().reindex(range(n_minutes)).fillna(0))

    df = pd.DataFrame({
        "match_id": match_id, "host": host_code, "minute_from_kickoff_minus120": minutes["minute"] - 120,
        "kalshi_price": k_min.values, "pinnacle_devig_price": p_min.values,
        "volume_contracts": vol_min.values, "dollar_volume": dollar_min.values,
    })
    df["gap_pp"] = (df["kalshi_price"] - df["pinnacle_devig_price"]) * 100
    all_series.append(df)

    valid = df.dropna(subset=["kalshi_price", "pinnacle_devig_price"])
    mean_gap = valid["gap_pp"].mean()
    vwap_gap = np.average(valid["gap_pp"], weights=valid["dollar_volume"].clip(lower=1e-9)) if valid["dollar_volume"].sum() > 0 else np.nan
    overpriced_dollars = valid.loc[valid["gap_pp"] > 0, "dollar_volume"].sum()
    total_dollars = valid["dollar_volume"].sum()
    rows_summary.append({
        "match_id": match_id, "host": host_code,
        "mean_gap_pp": mean_gap, "dollar_weighted_gap_pp": vwap_gap,
        "total_dollar_volume": total_dollars,
        "dollar_volume_while_overpriced": overpriced_dollars,
        "pct_dollars_while_overpriced": 100 * overpriced_dollars / total_dollars if total_dollars else np.nan,
        "n_minutes_covered": len(valid),
    })
    print(f"\n{match_id} ({host_code}): mean gap {mean_gap:+.2f}pp, $-weighted gap {vwap_gap:+.2f}pp, "
          f"${overpriced_dollars:,.0f} of ${total_dollars:,.0f} ({100*overpriced_dollars/total_dollars:.1f}%) traded while Kalshi > Pinnacle")

summary = pd.DataFrame(rows_summary)
series_all = pd.concat(all_series, ignore_index=True)
series_all.to_parquet(f"{OUT}/us_home_bias_matchlevel_series.parquet", index=False)
summary.to_parquet(f"{OUT}/us_home_bias_matchlevel.parquet", index=False)
print("\n=== Summary ===")
print(summary.to_string())
