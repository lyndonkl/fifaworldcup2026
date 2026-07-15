"""
Match 3-way (KXWCGAME) cross-source calibration panel: 28 finalized KO
matches x 3 legs (team1/team2/tie) x 3 sources (Kalshi, Polymarket,
Pinnacle-devigged) x 3 horizons (T-24h, T-1h, T-5min before settlement).
"""
import duckdb
import pandas as pd
import numpy as np
import json

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
OUT = f"{ROOT}/pipeline/data/analysis/calibration"

con = duckdb.connect()

markets = pd.read_parquet(f"{OUT}/_catalog_families.parquet")
emap = pd.read_parquet(f"{OUT}/_entity_map_played.parquet")

game_markets = markets[markets['series_ticker'] == 'KXWCGAME'][
    ['ticker', 'event_ticker', 'status', 'result', 'resolution_dt']
].rename(columns={'ticker': 'kalshi_ticker'})

# ---------------------------------------------------------------------------
# Build long panel: one row per (match_id, leg, source-agnostic identity)
# ---------------------------------------------------------------------------
legs = []
for _, r in emap.iterrows():
    for leg_col, outcome_label, team_code in [
        ('kalshi_leg_team1', 'team1', r['team1_code']),
        ('kalshi_leg_team2', 'team2', r['team2_code']),
        ('kalshi_leg_tie', 'tie', 'TIE'),
    ]:
        legs.append({
            'match_id': r['match_id'],
            'round': r['round'],
            'leg': outcome_label,
            'team_code': team_code,
            'kalshi_ticker': r[leg_col],
            'polymarket_market_id': (r['polymarket_team1_market_id'] if outcome_label == 'team1'
                                      else r['polymarket_team2_market_id'] if outcome_label == 'team2'
                                      else r['polymarket_draw_market_id']),
            'polymarket_yes_token': (r['polymarket_team1_yes_token'] if outcome_label == 'team1'
                                      else r['polymarket_team2_yes_token'] if outcome_label == 'team2'
                                      else r['polymarket_draw_yes_token']),
            'pinnacle_fixture_id': r['pinnacle_fixture_id'],
            'pinnacle_outcome_id': ('101' if outcome_label == 'team1'
                                     else '102' if outcome_label == 'tie'
                                     else '103'),
        })
legs = pd.DataFrame(legs)
legs = legs.merge(game_markets, on='kalshi_ticker', how='left')
assert legs['resolution_dt'].isna().sum() == 0, "missing resolution_dt for some legs"
legs['outcome'] = (legs['result'] == 'yes').astype(int)
# sanity: exactly one yes per match
assert (legs.groupby('match_id')['outcome'].sum() == 1).all()

horizons = {'T-24h': pd.Timedelta(hours=24), 'T-1h': pd.Timedelta(hours=1), 'T-5min': pd.Timedelta(minutes=5)}
targets = []
for h_label, delta in horizons.items():
    tmp = legs.copy()
    tmp['horizon'] = h_label
    tmp['target_dt'] = tmp['resolution_dt'] - delta
    targets.append(tmp)
targets = pd.concat(targets, ignore_index=True)
# NOTE: pandas timestamps read back from parquet are datetime64[us], not [ns];
# .astype('int64')//10**9 silently truncates to the wrong epoch. Use an
# explicit Timedelta division, which is resolution-agnostic.
_epoch0 = pd.Timestamp('1970-01-01', tz='UTC')
targets['target_ts_epoch'] = ((targets['target_dt'] - _epoch0) // pd.Timedelta(seconds=1)).astype('int64')
con.register('targets', targets)

# ---------------------------------------------------------------------------
# Kalshi price via 1-min candles ASOF join
# ---------------------------------------------------------------------------
kalshi_px = con.execute(f"""
    SELECT t.match_id, t.leg, t.horizon, t.kalshi_ticker, t.target_ts_epoch,
           c.end_period_ts AS kalshi_candle_ts, c.price_close_usd AS kalshi_price
    FROM targets t
    ASOF JOIN (
        SELECT ticker, end_period_ts, price_close_usd
        FROM 'pipeline/data/kalshi/candles/series_ticker=KXWCGAME/*.parquet'
        WHERE price_close_usd IS NOT NULL
    ) c
      ON t.kalshi_ticker = c.ticker AND t.target_ts_epoch >= c.end_period_ts
""").df()

# ---------------------------------------------------------------------------
# Polymarket price via 1-min fidelity prices ASOF join (tier-1 KO moneylines)
# ---------------------------------------------------------------------------
pm_px = con.execute(f"""
    SELECT t.match_id, t.leg, t.horizon, t.target_ts_epoch,
           p.ts_utc AS pm_ts, p.implied_prob AS pm_price
    FROM targets t
    ASOF JOIN 'pipeline/data/benchmarks/polymarket/prices/priority_tier=1/fidelity=1/*.parquet' p
      ON t.polymarket_yes_token = p.token_id AND t.target_ts_epoch >= p.ts_utc
""").df()

# ---------------------------------------------------------------------------
# Pinnacle de-vigged price (R1: dedup on ms-precision created_at; R2: filter
# price_decimal<1.01 and overround_at_ts=0; R3: reversion-glitch screen via
# 1-min resample-equivalent -- we take last quote <= target from RAW ticks but
# already restricted to sane rows, then cross-check against the 1-min-median
# neighbourhood to drop single-print glitches)
# ---------------------------------------------------------------------------
pinn_raw = con.execute(f"""
    SELECT fixture_id, outcome_id, created_at, price_decimal, overround_at_ts,
           implied_prob_devigged,
           epoch(strptime(created_at, '%Y-%m-%dT%H:%M:%S.%gZ')) AS created_epoch
    FROM 'pipeline/data/benchmarks/odds/pinnacle.parquet'
    WHERE bookmaker = 'pinnacle' AND market_name = 'Full Time Result'
      AND price_decimal >= 1.01
      AND overround_at_ts IS NOT NULL AND overround_at_ts != 0
""").df()
# R1 dedup: ms-precision created_at already distinguishes; drop exact dupes
pinn_raw = pinn_raw.drop_duplicates(subset=['fixture_id', 'outcome_id', 'created_at'])
# R3: screen single-print reversion glitches -- flag ticks whose devigged prob
# jumps >0.15 from BOTH neighbours (prev and next) and reverts within 5s, then drop
pinn_raw = pinn_raw.sort_values(['fixture_id', 'outcome_id', 'created_epoch']).reset_index(drop=True)
g = pinn_raw.groupby(['fixture_id', 'outcome_id'])
pinn_raw['prev_val'] = g['implied_prob_devigged'].shift(1)
pinn_raw['next_val'] = g['implied_prob_devigged'].shift(-1)
pinn_raw['prev_dt'] = g['created_epoch'].diff()
pinn_raw['next_dt'] = g['created_epoch'].diff(-1).abs()
glitch = (
    (pinn_raw['prev_dt'] <= 5) & (pinn_raw['next_dt'] <= 5) &
    ((pinn_raw['implied_prob_devigged'] - pinn_raw['prev_val']).abs() > 0.15) &
    ((pinn_raw['implied_prob_devigged'] - pinn_raw['next_val']).abs() > 0.15) &
    ((pinn_raw['prev_val'] - pinn_raw['next_val']).abs() < 0.05)
)
n_glitch = glitch.sum()
pinn_clean = pinn_raw[~glitch].copy()
print(f"Pinnacle R3 glitch screen: dropped {n_glitch} single-print reversion rows of {len(pinn_raw)}")
con.register('pinn_clean', pinn_clean[['fixture_id', 'outcome_id', 'created_epoch', 'implied_prob_devigged']])

pinn_px = con.execute(f"""
    SELECT t.match_id, t.leg, t.horizon, t.target_ts_epoch,
           p.created_epoch AS pinn_ts, p.implied_prob_devigged AS pinn_price
    FROM targets t
    ASOF JOIN pinn_clean p
      ON t.pinnacle_fixture_id = p.fixture_id AND t.pinnacle_outcome_id = p.outcome_id
         AND t.target_ts_epoch >= p.created_epoch
""").df()

panel = targets[['match_id', 'round', 'leg', 'team_code', 'kalshi_ticker', 'horizon',
                  'target_dt', 'resolution_dt', 'outcome']].copy()
panel = panel.merge(kalshi_px[['match_id', 'leg', 'horizon', 'kalshi_price', 'kalshi_candle_ts']],
                     on=['match_id', 'leg', 'horizon'], how='left')
panel = panel.merge(pm_px[['match_id', 'leg', 'horizon', 'pm_price', 'pm_ts']],
                     on=['match_id', 'leg', 'horizon'], how='left')
panel = panel.merge(pinn_px[['match_id', 'leg', 'horizon', 'pinn_price', 'pinn_ts']],
                     on=['match_id', 'leg', 'horizon'], how='left')

panel['target_ts_epoch'] = ((panel['target_dt'] - _epoch0) // pd.Timedelta(seconds=1)).astype('int64')
panel['staleness_kalshi_min'] = (panel['target_ts_epoch'] - panel['kalshi_candle_ts']) / 60
panel['staleness_pm_min'] = (panel['target_ts_epoch'] - panel['pm_ts']) / 60
panel['staleness_pinn_min'] = (panel['target_ts_epoch'] - panel['pinn_ts']) / 60

panel.to_parquet(f"{OUT}/match3way_panel.parquet", index=False)
print(panel.shape)
print(panel[['horizon']].value_counts())
print("nulls:", panel[['kalshi_price', 'pm_price', 'pinn_price']].isna().sum())
print(panel.head(10).to_string())
