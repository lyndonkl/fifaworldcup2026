"""
Divergence-episode detector: Kalshi vs Pinnacle-devigged (primary) and Kalshi
vs Polymarket (secondary), on the SAME outcome (per-leg), resampled to 1-min
bins with a 0.15-probability-point floor per R7. Flags episodes where the two
sources disagree by >=5pp for >=30 sustained minutes, across the full in-game
window of each of the 28 finalized KO matches. Scores who was right at
settlement.
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

WINDOW_BEFORE_MIN = 150  # minutes before settlement to start the window (covers full match + pre-match)
FLOOR = 0.0015  # 0.15 probability points, per R7 (values are 0-1 fractions here so 0.15pp = 0.0015)
GAP_THRESH = 0.05
SUSTAIN_MIN = 30

episodes = []
minute_series_all = []

for _, r in emap.iterrows():
    match_id = r['match_id']
    for leg_name, kalshi_ticker, pinn_outcome, pm_market_id, pm_token in [
        ('team1', r['kalshi_leg_team1'], '101', r['polymarket_team1_market_id'], r['polymarket_team1_yes_token']),
        ('team2', r['kalshi_leg_team2'], '103', r['polymarket_team2_market_id'], r['polymarket_team2_yes_token']),
        ('tie', r['kalshi_leg_tie'], '102', r['polymarket_draw_market_id'], r['polymarket_draw_yes_token']),
    ]:
        gm = game_markets[game_markets['kalshi_ticker'] == kalshi_ticker]
        if len(gm) == 0:
            continue
        resolution_dt = gm.iloc[0]['resolution_dt']
        outcome = 1 if gm.iloc[0]['result'] == 'yes' else 0
        win_start = resolution_dt - pd.Timedelta(minutes=WINDOW_BEFORE_MIN)
        win_end = resolution_dt
        start_epoch = int((win_start - pd.Timestamp('1970-01-01', tz='UTC')) / pd.Timedelta(seconds=1))
        end_epoch = int((win_end - pd.Timestamp('1970-01-01', tz='UTC')) / pd.Timedelta(seconds=1))
        # align to minute boundaries (kal/pinn minute_ts are both floor-to-60s) or the
        # grid never intersects them and every merge silently comes back empty
        start_epoch = (start_epoch // 60) * 60
        end_epoch = (end_epoch // 60) * 60

        # 1-min minute grid
        grid = pd.DataFrame({'minute_ts': range(start_epoch, end_epoch + 60, 60)})

        # Kalshi: 1-min candles, forward-filled
        kal = con.execute(f"""
            SELECT end_period_ts AS minute_ts, price_close_usd AS kalshi_price
            FROM 'pipeline/data/kalshi/candles/series_ticker=KXWCGAME/*.parquet'
            WHERE ticker = '{kalshi_ticker}' AND end_period_ts BETWEEN {start_epoch} AND {end_epoch}
              AND price_close_usd IS NOT NULL
        """).df()

        # Pinnacle: raw ticks -> 1-min bin last value (R1/R2 filters applied), forward-filled
        pinn = con.execute(f"""
            SELECT CAST(epoch(strptime(created_at, '%Y-%m-%dT%H:%M:%S.%gZ')) / 60 AS BIGINT) * 60 AS minute_ts,
                   implied_prob_devigged
            FROM 'pipeline/data/benchmarks/odds/pinnacle.parquet'
            WHERE fixture_id = '{r['pinnacle_fixture_id']}' AND outcome_id = '{pinn_outcome}'
              AND bookmaker = 'pinnacle' AND market_name = 'Full Time Result'
              AND price_decimal >= 1.01 AND overround_at_ts IS NOT NULL AND overround_at_ts != 0
              AND epoch(strptime(created_at, '%Y-%m-%dT%H:%M:%S.%gZ')) BETWEEN {start_epoch} AND {end_epoch}
            QUALIFY ROW_NUMBER() OVER (PARTITION BY minute_ts ORDER BY created_at DESC) = 1
        """).df()

        m = grid.merge(kal, on='minute_ts', how='left').merge(pinn, on='minute_ts', how='left')
        m['kalshi_price'] = m['kalshi_price'].ffill()
        m['implied_prob_devigged'] = m['implied_prob_devigged'].ffill()
        m = m.dropna(subset=['kalshi_price', 'implied_prob_devigged'])
        if len(m) == 0:
            continue
        m['gap'] = m['kalshi_price'] - m['implied_prob_devigged']
        m['gap'] = m['gap'].where(m['gap'].abs() >= FLOOR, 0.0)
        m['match_id'] = match_id
        m['leg'] = leg_name
        m['outcome'] = outcome
        minute_series_all.append(m)

        # find sustained episodes: |gap| >= GAP_THRESH for >= SUSTAIN_MIN consecutive minutes
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
                    kalshi_avg = seg['kalshi_price'].mean()
                    pinn_avg = seg['implied_prob_devigged'].mean()
                    kalshi_mse = ((seg['kalshi_price'] - outcome) ** 2).mean()
                    pinn_mse = ((seg['implied_prob_devigged'] - outcome) ** 2).mean()
                    who_right = 'kalshi' if kalshi_mse < pinn_mse else 'pinnacle'
                    episodes.append({
                        'match_id': match_id, 'leg': leg_name,
                        'start_ts': pd.Timestamp(seg['minute_ts'].iloc[0], unit='s', tz='UTC'),
                        'end_ts': pd.Timestamp(seg['minute_ts'].iloc[-1], unit='s', tz='UTC'),
                        'duration_min': run_len,
                        'mean_gap_pp': seg['gap'].mean() * 100,
                        'max_gap_pp': seg['gap'].abs().max() * 100,
                        'kalshi_mean': kalshi_avg, 'pinnacle_mean': pinn_avg,
                        'kalshi_episode_brier': kalshi_mse, 'pinnacle_episode_brier': pinn_mse,
                        'settled_outcome': outcome, 'closer_to_truth': who_right,
                    })
                i = j
            else:
                i += 1

episodes_df = pd.DataFrame(episodes).sort_values('max_gap_pp', ascending=False)
episodes_df.to_csv(f"{OUT}/divergence_episodes_kalshi_vs_pinnacle.csv", index=False)
minute_series = pd.concat(minute_series_all, ignore_index=True)
minute_series.to_parquet(f"{OUT}/minute_series_kalshi_vs_pinnacle.parquet", index=False)

print(f"Total episodes >= {GAP_THRESH*100:.0f}pp sustained >= {SUSTAIN_MIN}min: {len(episodes_df)}")
print(episodes_df.to_string(index=False))
print("\nWho was more often right in a sustained divergence episode:")
print(episodes_df['closer_to_truth'].value_counts())
