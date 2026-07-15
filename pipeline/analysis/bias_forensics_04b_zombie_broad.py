"""
Bias Forensics — Analysis 4b: zombie money, broad sweep across every
team-scoped prop family, not just the winner future.

Once a team is mathematically eliminated (KXWCADVANCE settlement, R4/R9-
correct), every other market whose event_ticker encodes that team
(SERIES-26<CODE>: player goals, team total goals, stage of elimination,
team goal-leader, squad props, team goals ladder) is also decided in
substance -- the team can no longer add to any of those stats. This sweep
measures how much trading (count, $ volume, price level) happens on those
markets strictly after the real-world elimination instant, and specifically
how much trades above 1c (a real, non-trivial implied probability on a dead
team).

Output: pipeline/data/analysis/bias-forensics/zombie_money_broad.parquet
        pipeline/data/analysis/bias-forensics/zombie_money_broad_trades_above1c.parquet
"""
import duckdb
import pandas as pd

OUT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data/analysis/bias-forensics"
DATA = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data"
con = duckdb.connect()

TEAM_SERIES = ["KXWCPLAYERGOALS", "KXWCTEAMTOTALGOALS", "KXWCSTAGEOFELIM",
               "KXWCTEAMLEADGOAL", "KXWCSQUAD", "KXWCTEAMGOALS"]

em = con.execute(f"""
SELECT match_id, team1_code, team2_code, advance_result, kalshi_advance_event_ticker
FROM '{DATA}/audit/entity_map.parquet'
WHERE match_status = 'finalized'
""").df()
losers = []
for _, r in em.iterrows():
    loser = r.team1_code if r.advance_result == r.team2_code else r.team2_code
    losers.append({"match_id": r.match_id, "loser_code": loser,
                    "advance_event_ticker": r.kalshi_advance_event_ticker})
losers = pd.DataFrame(losers)
con.register("losers", losers)

con.execute(f"""
CREATE OR REPLACE TEMP TABLE elim AS
SELECT l.match_id, l.loser_code,
       epoch(CAST(m.settlement_ts AS TIMESTAMP)) AS elim_epoch
FROM losers l
JOIN '{DATA}/catalog/markets.parquet' m
  ON m.event_ticker = l.advance_event_ticker
 AND m.ticker = l.advance_event_ticker || '-' || l.loser_code
""")
elim = con.execute("SELECT * FROM elim").df()

series_list_sql = "(" + ",".join(f"'{s}'" for s in TEAM_SERIES) + ")"

rows = []
above1c_all = []
for _, r in elim.iterrows():
    team = r.loser_code
    elim_ep = r.elim_epoch
    tickers = con.execute(f"""
        SELECT ticker, series_ticker, status, settlement_ts, volume_contracts
        FROM '{DATA}/catalog/markets.parquet'
        WHERE series_ticker IN {series_list_sql}
          AND event_ticker IN (SELECT s || '-26' || '{team}' FROM (SELECT unnest({TEAM_SERIES}) AS s))
    """).df()
    if tickers.empty:
        continue
    tkr_list_sql = "(" + ",".join(f"'{t}'" for t in tickers.ticker.tolist()) + ")"
    trades = con.execute(f"""
        SELECT ticker, created_ts, yes_price_usd, count_contracts
        FROM read_parquet('{DATA}/kalshi/trades/series_ticker=*/*.parquet')
        WHERE ticker IN {tkr_list_sql} AND created_ts > {elim_ep}
    """).df()
    n_trades = len(trades)
    n_markets_touched = trades["ticker"].nunique() if n_trades else 0
    dollar_vol = (trades["yes_price_usd"] * trades["count_contracts"]).sum() if n_trades else 0.0
    contracts = trades["count_contracts"].sum() if n_trades else 0.0
    above1c = trades[trades["yes_price_usd"] >= 0.01] if n_trades else trades
    n_above1c = len(above1c)
    dollar_above1c = (above1c["yes_price_usd"] * above1c["count_contracts"]).sum() if n_above1c else 0.0
    max_hours_after = ((trades["created_ts"].max() - elim_ep) / 3600) if n_trades else None
    rows.append({
        "team": team, "match_id": r.match_id, "n_prop_markets": len(tickers),
        "n_zombie_trades": n_trades, "n_markets_with_zombie_trades": n_markets_touched,
        "zombie_contracts": contracts, "zombie_dollar_volume": dollar_vol,
        "n_trades_above_1c": n_above1c, "dollar_volume_above_1c": dollar_above1c,
        "max_hours_after_elim_traded": max_hours_after,
    })
    if n_above1c:
        above1c["team"] = team
        above1c["hours_after_elim"] = (above1c["created_ts"] - elim_ep) / 3600
        above1c_all.append(above1c)

summary = pd.DataFrame(rows).sort_values("dollar_volume_above_1c", ascending=False)
summary.to_parquet(f"{OUT}/zombie_money_broad.parquet", index=False)
print(summary.to_string())

if above1c_all:
    ab = pd.concat(above1c_all, ignore_index=True)
    ab.to_parquet(f"{OUT}/zombie_money_broad_trades_above1c.parquet", index=False)
    print(f"\nTotal trades above 1c on eliminated-team props: {len(ab)}")
    print(f"Max hours-after-elimination for an above-1c trade: {ab['hours_after_elim'].max():.1f}h")
    print(f"Total $ volume above 1c: ${(ab['yes_price_usd']*ab['count_contracts']).sum():,.2f}")

print(f"\nTOTALS across all {len(summary)} eliminated teams:")
print(f"  zombie trades: {summary['n_zombie_trades'].sum():.0f}")
print(f"  zombie contracts: {summary['zombie_contracts'].sum():,.0f}")
print(f"  zombie dollar volume: ${summary['zombie_dollar_volume'].sum():,.2f}")
print(f"  of which above 1c: ${summary['dollar_volume_above_1c'].sum():,.2f} across {summary['n_trades_above_1c'].sum():.0f} trades")
