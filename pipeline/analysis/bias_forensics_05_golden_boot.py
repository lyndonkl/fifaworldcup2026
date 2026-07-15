"""
Bias Forensics — Analysis 5: prop-market irrationality, Golden Boot.

Daily close price (last trade of the UTC-normalized trading day) for the four
marquee Golden Boot legs (Mbappe, Messi, Haaland, Kane) across the full
market life, plus a cross-sectional snapshot table joining Kalshi price to
the realized goal counts asserted in research/fact-base.json (Mbappe 8,
Messi 8, Haaland 7 [eliminated], Kane 6 [alive]) as of 2026-07-13 (pre the
Jul 14 France-Spain semifinal, which is excluded per task scope: settled/
played matches only).

Output: pipeline/data/analysis/bias-forensics/golden_boot_daily.parquet
        pipeline/data/analysis/bias-forensics/golden_boot_snapshot.parquet
"""
import duckdb
import pandas as pd

OUT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data/analysis/bias-forensics"
DATA = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data"
con = duckdb.connect()

tickers = {
    "KXWCGOALLEADER-26-KMBA": "Mbappe", "KXWCGOALLEADER-26-LMES": "Messi",
    "KXWCGOALLEADER-26-EHAA": "Haaland", "KXWCGOALLEADER-26-HKAN": "Kane",
    "KXWCGOALLEADER-26-ODEM": "Dembele", "KXWCGOALLEADER-26-CRON": "Ronaldo",
}
rows = []
for tkr, name in tickers.items():
    df = con.execute(f"""
        SELECT date_trunc('day', to_timestamp(created_ts)) AS day,
               arg_max(yes_price_usd, created_ts) AS close_price,
               sum(count_contracts) AS volume
        FROM read_parquet('{DATA}/kalshi/trades/series_ticker=KXWCGOALLEADER/*.parquet')
        WHERE ticker='{tkr}'
        GROUP BY 1 ORDER BY 1
    """).df()
    df["player"] = name
    df["ticker"] = tkr
    rows.append(df)
daily = pd.concat(rows, ignore_index=True)
# cut at 2026-07-13 end of day per task scope (semifinal not yet played/settled)
daily = daily[daily["day"] <= pd.Timestamp("2026-07-13 23:59:59", tz=daily["day"].dt.tz)]
daily.to_parquet(f"{OUT}/golden_boot_daily.parquet", index=False)

# Kane price collapse around his own team's QF win (Jul 11)
kane = daily[daily.player == "Kane"].sort_values("day")
print("=== Kane daily price (last 10 days to Jul13) ===")
print(kane.tail(10).to_string())

# snapshot table: last known 2026-07-13 close + fact-base goal counts (hardcoded, cited)
goals = {"Mbappe": 8, "Messi": 8, "Haaland": 7, "Kane": 6, "Dembele": None, "Ronaldo": None}
alive = {"Mbappe": True, "Messi": True, "Haaland": False, "Kane": True, "Dembele": True, "Ronaldo": False}
snap = daily.sort_values("day").groupby("player").last().reset_index()
snap["goals_as_of_2026-07-13"] = snap["player"].map(goals)
snap["team_alive"] = snap["player"].map(alive)
snap["cents_per_goal"] = snap["close_price"] * 100 / snap["goals_as_of_2026-07-13"]
snap.to_parquet(f"{OUT}/golden_boot_snapshot.parquet", index=False)
print("\n=== Snapshot (close price as of last trading day <= 2026-07-13) ===")
print(snap[["player","day","close_price","goals_as_of_2026-07-13","team_alive","cents_per_goal"]].to_string())

# Mbappe vs Messi: identical goal tally, price ratio
mb = snap[snap.player=="Mbappe"]["close_price"].iloc[0]
me = snap[snap.player=="Messi"]["close_price"].iloc[0]
print(f"\nMbappe {mb*100:.0f}c vs Messi {me*100:.0f}c on identical 8-goal tallies: ratio {mb/me:.2f}x")
kn = snap[snap.player=="Kane"]["close_price"].iloc[0]
print(f"Kane {kn*100:.0f}c on 6 goals (2 fewer than Messi/Mbappe, all three teams alive going into SF): "
      f"Messi/Mbappe price is {me*100/(kn*100):.1f}x-{mb*100/(kn*100):.1f}x Kane's for a 25-33% smaller goal gap")
