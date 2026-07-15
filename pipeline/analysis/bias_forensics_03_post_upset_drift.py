"""
Bias Forensics — Analysis 3: post-upset recency ("did the surviving longshot
get overbought after a shock, and did it fade?").

Operationalization: for each of the three cited shocks, the "surviving
longshot" is the team that WON the shock match (the direct beneficiary of the
upset headline): Paraguay (beat Germany, Jun 29-30 R32 on pens), Norway (beat
Brazil, Jul 5 R16), Belgium (beat USA, Jul 6-7 R16, the last of the three
co-hosts to fall). Shock instant = the KXWCADVANCE settlement_ts (the moment
elimination was confirmed, correct for AET/pens per R4/R9).

For each, pull the winner-futures (KXMENWORLDCUP) leg price at shock time and
at +24h/+48h/+72h, quantify the pop and the subsequent fade (or lack of it)
against the team's own eventual elimination date, as the realized check on
whether the pop was justified.

Output: pipeline/data/analysis/bias-forensics/post_upset_drift.parquet
"""
import duckdb
import pandas as pd

OUT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data/analysis/bias-forensics"
DATA = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data"
con = duckdb.connect()

shocks = [
    {"shock_name": "Germany out (pens) -> Paraguay survives", "shock_settlement": "2026-06-29T23:38:11.520664Z",
     "beneficiary_ticker": "KXMENWORLDCUP-26-PY", "beneficiary": "Paraguay",
     "eventual_exit_settlement": None},  # filled below
    {"shock_name": "Brazil out -> Norway survives", "shock_settlement": "2026-07-05T22:06:23.930515Z",
     "beneficiary_ticker": "KXMENWORLDCUP-26-NO", "beneficiary": "Norway",
     "eventual_exit_settlement": None},
    {"shock_name": "Last host (USA) out -> Belgium survives", "shock_settlement": "2026-07-07T02:01:52.988067Z",
     "beneficiary_ticker": "KXMENWORLDCUP-26-BE", "beneficiary": "Belgium",
     "eventual_exit_settlement": None},
]

# eventual elimination settlement of the beneficiary's own winner leg
for s in shocks:
    r = con.execute(f"""
        SELECT settlement_ts FROM '{DATA}/catalog/markets.parquet'
        WHERE ticker = '{s['beneficiary_ticker']}' AND status='finalized'
    """).fetchone()
    s["eventual_exit_settlement"] = r[0] if r else None

rows = []
series_rows = []
for s in shocks:
    t0 = con.execute(f"SELECT epoch(CAST('{s['shock_settlement']}' AS TIMESTAMP))").fetchone()[0]
    exit_ts = s["eventual_exit_settlement"]
    t_exit = con.execute(f"SELECT epoch(CAST('{exit_ts}' AS TIMESTAMP))").fetchone()[0] if exit_ts else None

    def price_at(offset_sec):
        row = con.execute(f"""
            SELECT yes_price_usd, created_ts FROM read_parquet('{DATA}/kalshi/trades/series_ticker=KXMENWORLDCUP/*.parquet')
            WHERE ticker='{s['beneficiary_ticker']}' AND created_ts <= {t0 + offset_sec}
            ORDER BY created_ts DESC LIMIT 1
        """).fetchone()
        return row[0] if row else None

    p_shock = price_at(0)
    p_24 = price_at(24*3600)
    p_48 = price_at(48*3600)
    p_72 = price_at(72*3600)

    # full trajectory for narrative/plotting: -24h to +96h around shock, hourly
    traj = con.execute(f"""
        WITH hours AS (SELECT unnest(range(-24, 97)) AS h)
        SELECT h, (SELECT yes_price_usd FROM read_parquet('{DATA}/kalshi/trades/series_ticker=KXMENWORLDCUP/*.parquet')
                    WHERE ticker='{s['beneficiary_ticker']}' AND created_ts <= {t0} + h*3600
                    ORDER BY created_ts DESC LIMIT 1) AS price
        FROM hours ORDER BY h
    """).df()
    traj["price"] = traj["price"].ffill()
    traj["beneficiary"] = s["beneficiary"]
    traj["shock_name"] = s["shock_name"]
    series_rows.append(traj)

    rows.append({
        "shock_name": s["shock_name"], "beneficiary": s["beneficiary"],
        "shock_ts": s["shock_settlement"], "price_at_shock_c": p_shock*100 if p_shock else None,
        "price_at_24h_c": p_24*100 if p_24 else None, "price_at_48h_c": p_48*100 if p_48 else None,
        "price_at_72h_c": p_72*100 if p_72 else None,
        "pop_0_to_24h_pp": (p_24-p_shock)*100 if p_24 and p_shock else None,
        "eventual_exit_ts": exit_ts,
        "hours_shock_to_exit": (t_exit - t0)/3600 if t_exit else None,
    })
    print(f"{s['beneficiary']}: shock={p_shock*100 if p_shock else None:.2f}c -> +24h={p_24*100 if p_24 else None:.2f}c "
          f"-> +48h={p_48*100 if p_48 else None:.2f}c -> +72h={p_72*100 if p_72 else None:.2f}c "
          f"(own elimination {((t_exit-t0)/3600):.1f}h after shock)" if t_exit else "")

summary = pd.DataFrame(rows)
summary.to_parquet(f"{OUT}/post_upset_drift.parquet", index=False)
series = pd.concat(series_rows, ignore_index=True)
series.to_parquet(f"{OUT}/post_upset_drift_series.parquet", index=False)
print("\n=== Summary ===")
print(summary.to_string())
