"""
Bias Forensics — Analysis 4: elimination lag ("zombie money").

For each of the 28 finalized KO matches, the loser is mathematically dead the
instant its KXWCADVANCE leg settles 'no' (R4/R9-correct elimination instant,
handles AET/pens properly). That team's own tournament-winner future
(KXMENWORLDCUP-26-<code>) typically does not settle until later (Kalshi's own
settlement lag). Every trade on that winner leg between real-world
elimination and Kalshi's formal settlement is a trade on a dead team --
"zombie money."

Output: pipeline/data/analysis/bias-forensics/zombie_money.parquet (one row
per eliminated team) and zombie_money_trades.parquet (trade-level detail for
the worst offenders, for a unit-viz replay).
"""
import duckdb
import pandas as pd

OUT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data/analysis/bias-forensics"
DATA = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data"
con = duckdb.connect()

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

# elimination instant = KXWCADVANCE settlement for the loser's leg
con.execute(f"""
CREATE OR REPLACE TEMP TABLE elim AS
SELECT l.match_id, l.loser_code,
       m.ticker AS advance_ticker,
       epoch(CAST(m.settlement_ts AS TIMESTAMP)) AS elim_epoch
FROM losers l
JOIN '{DATA}/catalog/markets.parquet' m
  ON m.event_ticker = l.advance_event_ticker
 AND m.ticker = l.advance_event_ticker || '-' || l.loser_code
""")
n = con.execute("SELECT COUNT(*) FROM elim").fetchone()[0]
print(f"Elimination instants resolved: {n} / {len(losers)}")
missing = con.execute("SELECT loser_code, match_id FROM elim WHERE elim_epoch IS NULL").df()
print(missing)

# futures winner-leg ticker + its own settlement
con.execute(f"""
CREATE OR REPLACE TEMP TABLE zombie AS
SELECT e.match_id, e.loser_code, e.elim_epoch,
       f.ticker AS futures_ticker, f.settlement_ts AS futures_settlement_ts,
       epoch(CAST(f.settlement_ts AS TIMESTAMP)) AS futures_settle_epoch
FROM elim e
JOIN '{DATA}/catalog/markets.parquet' f
  ON f.series_ticker = 'KXMENWORLDCUP' AND f.ticker LIKE 'KXMENWORLDCUP-26-%'
 AND (f.yes_sub_title = (SELECT team1_name FROM '{DATA}/audit/entity_map.parquet' em2 WHERE em2.match_id=e.match_id AND em2.team1_code=e.loser_code)
      OR f.yes_sub_title = (SELECT team2_name FROM '{DATA}/audit/entity_map.parquet' em2 WHERE em2.match_id=e.match_id AND em2.team2_code=e.loser_code))
""")
zdf = con.execute("SELECT * FROM zombie").df()
print(f"\nfutures leg matched: {len(zdf)} / {len(losers)}")
print(zdf[["match_id","loser_code","futures_ticker"]].to_string())

rows = []
trade_details = []
for _, r in zdf.iterrows():
    tkr = r.futures_ticker
    elim_ep = r.elim_epoch
    settle_ep = r.futures_settle_epoch
    if pd.isna(elim_ep) or pd.isna(settle_ep):
        continue
    t = con.execute(f"""
        SELECT created_ts, yes_price_usd, count_contracts
        FROM read_parquet('{DATA}/kalshi/trades/series_ticker=KXMENWORLDCUP/*.parquet')
        WHERE ticker='{tkr}' AND created_ts > {elim_ep} AND created_ts <= {settle_ep}
        ORDER BY created_ts
    """).df()
    lag_hours = (settle_ep - elim_ep) / 3600
    n_trades = len(t)
    vol_contracts = t["count_contracts"].sum() if n_trades else 0.0
    dollar_vol = (t["yes_price_usd"] * t["count_contracts"]).sum() if n_trades else 0.0
    n_above_1c = (t["yes_price_usd"] >= 0.01).sum() if n_trades else 0
    max_price_zombie = t["yes_price_usd"].max() if n_trades else None
    last_trade_lag_hours = (t["created_ts"].max() - elim_ep) / 3600 if n_trades else None

    rows.append({
        "match_id": r.match_id, "team": r.loser_code, "futures_ticker": tkr,
        "elimination_epoch": elim_ep, "futures_settlement_epoch": settle_ep,
        "settlement_lag_hours": lag_hours, "n_zombie_trades": n_trades,
        "zombie_volume_contracts": vol_contracts, "zombie_dollar_volume": dollar_vol,
        "n_trades_above_1c": n_above_1c, "max_price_after_elim_c": max_price_zombie*100 if max_price_zombie else None,
        "last_zombie_trade_hours_after_elim": last_trade_lag_hours,
    })
    if n_trades > 0:
        t["team"] = r.loser_code
        t["hours_after_elimination"] = (t["created_ts"] - elim_ep) / 3600
        trade_details.append(t)

summary = pd.DataFrame(rows).sort_values("zombie_dollar_volume", ascending=False)
summary.to_parquet(f"{OUT}/zombie_money.parquet", index=False)
print("\n=== Zombie money summary (sorted by $ volume) ===")
print(summary.to_string())

if trade_details:
    detail = pd.concat(trade_details, ignore_index=True)
    detail.to_parquet(f"{OUT}/zombie_money_trades.parquet", index=False)
    print(f"\nTotal zombie trade-level rows saved: {len(detail)}")

print(f"\nTOTALS: {summary['n_zombie_trades'].sum():.0f} trades, "
      f"{summary['zombie_volume_contracts'].sum():,.0f} contracts, "
      f"${summary['zombie_dollar_volume'].sum():,.2f} notional traded on already-eliminated teams "
      f"before their futures leg formally settled.")
print(f"Median settlement lag: {summary['settlement_lag_hours'].median():.2f}h, "
      f"max: {summary['settlement_lag_hours'].max():.2f}h")
