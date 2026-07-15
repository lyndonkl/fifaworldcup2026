"""
Item 4: the four semifinalists' Kalshi winner-leg price path vs Opta's
stage-by-stage snapshots and Elo-implied relative strength.
"""
import duckdb
import pandas as pd
import numpy as np

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
OUT = f"{ROOT}/pipeline/data/analysis/calibration"

con = duckdb.connect()

TEAM_KALSHI = {'France': 'FR', 'Spain': 'ES', 'England': 'GB', 'Argentina': 'AR'}
TEAM_ELO = {'France': 'FR', 'Spain': 'ES', 'England': 'EN', 'Argentina': 'AR'}

opta = con.execute(f"""
    SELECT stage_id, stage_label, as_of_date, team, metric, value_prob, published_epoch_utc
    FROM 'pipeline/data/benchmarks/opinion/opta.parquet'
    WHERE team IN ('France','Spain','England','Argentina') AND metric='win_pct'
    ORDER BY stage_id, team
""").df()

rows = []
for _, r in opta.iterrows():
    kalshi_code = TEAM_KALSHI[r['team']]
    elo_code = TEAM_ELO[r['team']]
    ticker = f"KXMENWORLDCUP-26-{kalshi_code}"
    ts = int(r['published_epoch_utc'])

    kp = con.execute(f"""
        SELECT price_close_usd FROM 'pipeline/data/kalshi/candles/series_ticker=KXMENWORLDCUP/*.parquet'
        WHERE ticker='{ticker}' AND end_period_ts <= {ts} AND price_close_usd IS NOT NULL
        ORDER BY end_period_ts DESC LIMIT 1
    """).fetchone()
    kalshi_price = kp[0] if kp else None

    er = con.execute(f"""
        SELECT rating_after, match_date FROM 'pipeline/data/benchmarks/opinion/elo.parquet'
        WHERE team_code='{elo_code}' AND match_epoch_utc <= {ts}
        ORDER BY match_epoch_utc DESC LIMIT 1
    """).fetchone()
    elo_rating, elo_asof = (er[0], er[1]) if er else (None, None)

    rows.append({
        'stage_id': r['stage_id'], 'stage_label': r['stage_label'], 'as_of_date': r['as_of_date'],
        'team': r['team'], 'opta_win_pct': r['value_prob'], 'kalshi_price': kalshi_price,
        'elo_rating': elo_rating, 'elo_asof_match': elo_asof,
        'gap_kalshi_minus_opta_pp': None if kalshi_price is None else (kalshi_price - r['value_prob']) * 100,
    })

panel = pd.DataFrame(rows)

# Elo-implied relative strength SHARE among just the 4 eventual semifinalists
# (softmax on rating/400, log-odds base 10 -- standard Elo win-prob kernel),
# NOT a full-bracket win probability. Computed per stage, using the Elo
# rating each team held as of that Opta snapshot date.
panel['elo_strength'] = 10 ** (panel['elo_rating'] / 400)
stage_sum = panel.groupby('stage_id')['elo_strength'].transform('sum')
panel['elo_share_of_4'] = panel['elo_strength'] / stage_sum

# Kalshi price similarly renormalized to a share of the 4 (their combined
# price does not sum to 1 because 44 other longshots/eliminated teams also
# carry residual price)
kalshi_sum = panel.groupby('stage_id')['kalshi_price'].transform('sum')
panel['kalshi_share_of_4'] = panel['kalshi_price'] / kalshi_sum

opta_sum = panel.groupby('stage_id')['opta_win_pct'].transform('sum')
panel['opta_share_of_4'] = panel['opta_win_pct'] / opta_sum

panel['gap_kalshi_minus_elo_share_pp'] = (panel['kalshi_share_of_4'] - panel['elo_share_of_4']) * 100
panel['gap_kalshi_minus_opta_share_pp'] = (panel['kalshi_share_of_4'] - panel['opta_share_of_4']) * 100

panel = panel.sort_values(['stage_id', 'team'])
panel.to_csv(f"{OUT}/semifinalists_price_vs_opta_elo.csv", index=False)
print(panel.to_string(index=False))
