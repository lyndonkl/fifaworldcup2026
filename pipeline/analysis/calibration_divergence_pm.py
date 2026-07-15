"""
Secondary check: Kalshi vs Polymarket divergence episodes, same method as
calibration_divergence.py, to establish whether the two retail-adjacent
markets diverge from each other as often as either diverges from Pinnacle.
"""
import duckdb
import pandas as pd
import numpy as np

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
OUT = f"{ROOT}/pipeline/data/analysis/calibration"

con = duckdb.connect()
emap = pd.read_parquet(f"{OUT}/_entity_map_played.parquet")
markets = pd.read_parquet(f"{OUT}/_catalog_families.parquet")
game_markets = markets[markets['series_ticker'] == 'KXWCGAME'][
    ['ticker', 'result', 'resolution_dt']
].rename(columns={'ticker': 'kalshi_ticker'})

WINDOW_BEFORE_MIN = 150
FLOOR = 0.0015
GAP_THRESH = 0.05
SUSTAIN_MIN = 30

episodes = []
max_gaps = []

for _, r in emap.iterrows():
    match_id = r['match_id']
    for leg_name, kalshi_ticker, pm_token in [
        ('team1', r['kalshi_leg_team1'], r['polymarket_team1_yes_token']),
        ('team2', r['kalshi_leg_team2'], r['polymarket_team2_yes_token']),
        ('tie', r['kalshi_leg_tie'], r['polymarket_draw_yes_token']),
    ]:
        gm = game_markets[game_markets['kalshi_ticker'] == kalshi_ticker]
        if len(gm) == 0 or pm_token is None:
            continue
        resolution_dt = gm.iloc[0]['resolution_dt']
        outcome = 1 if gm.iloc[0]['result'] == 'yes' else 0
        win_start = resolution_dt - pd.Timedelta(minutes=WINDOW_BEFORE_MIN)
        win_end = resolution_dt
        start_epoch = int((win_start - pd.Timestamp('1970-01-01', tz='UTC')) / pd.Timedelta(seconds=1))
        end_epoch = int((win_end - pd.Timestamp('1970-01-01', tz='UTC')) / pd.Timedelta(seconds=1))
        start_epoch = (start_epoch // 60) * 60
        end_epoch = (end_epoch // 60) * 60
        grid = pd.DataFrame({'minute_ts': range(start_epoch, end_epoch + 60, 60)})

        kal = con.execute(f"""
            SELECT end_period_ts AS minute_ts, price_close_usd AS kalshi_price
            FROM 'pipeline/data/kalshi/candles/series_ticker=KXWCGAME/*.parquet'
            WHERE ticker = '{kalshi_ticker}' AND end_period_ts BETWEEN {start_epoch} AND {end_epoch}
              AND price_close_usd IS NOT NULL
        """).df()
        pm = con.execute(f"""
            SELECT CAST(ts_utc / 60 AS BIGINT) * 60 AS minute_ts, implied_prob AS pm_price
            FROM 'pipeline/data/benchmarks/polymarket/prices/priority_tier=1/fidelity=1/*.parquet'
            WHERE token_id = '{pm_token}' AND ts_utc BETWEEN {start_epoch} AND {end_epoch}
            QUALIFY ROW_NUMBER() OVER (PARTITION BY minute_ts ORDER BY ts_utc DESC) = 1
        """).df()
        m = grid.merge(kal, on='minute_ts', how='left').merge(pm, on='minute_ts', how='left')
        m['kalshi_price'] = m['kalshi_price'].ffill()
        m['pm_price'] = m['pm_price'].ffill()
        m = m.dropna(subset=['kalshi_price', 'pm_price'])
        if len(m) == 0:
            continue
        m['gap'] = m['kalshi_price'] - m['pm_price']
        m['gap'] = m['gap'].where(m['gap'].abs() >= FLOOR, 0.0)
        max_gaps.append({'match_id': match_id, 'leg': leg_name, 'max_abs_gap_pp': m['gap'].abs().max() * 100,
                          'mean_abs_gap_pp': m['gap'].abs().mean() * 100, 'n_min': len(m)})

        flag = (m['gap'].abs() >= GAP_THRESH).astype(int).values
        i = 0
        n = len(flag)
        while i < n:
            if flag[i] == 1:
                j = i
                while j < n and flag[j] == 1:
                    j += 1
                run_len = j - i
                if run_len >= SUSTAIN_MIN:
                    seg = m.iloc[i:j]
                    episodes.append({
                        'match_id': match_id, 'leg': leg_name,
                        'start_ts': pd.Timestamp(seg['minute_ts'].iloc[0], unit='s', tz='UTC'),
                        'duration_min': run_len,
                        'max_gap_pp': seg['gap'].abs().max() * 100,
                    })
                i = j
            else:
                i += 1

maxg = pd.DataFrame(max_gaps)
maxg.to_csv(f"{OUT}/kalshi_vs_polymarket_max_gaps.csv", index=False)
eps = pd.DataFrame(episodes)
eps.to_csv(f"{OUT}/kalshi_vs_polymarket_episodes.csv", index=False)
print(f"Kalshi-vs-Polymarket: {len(eps)} sustained >=5pp/>=30min episodes across {len(maxg)} legs")
print("Max |gap| per leg, distribution:")
print(maxg['max_abs_gap_pp'].describe())
print("Mean |gap| per leg, distribution:")
print(maxg['mean_abs_gap_pp'].describe())
print("\nTop 10 legs by max gap:")
print(maxg.sort_values('max_abs_gap_pp', ascending=False).head(10).to_string(index=False))
