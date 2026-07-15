"""
Brier + log scores per source x horizon (match 3-way family, 28 KO matches,
84 binary legs, matched via entity_map so every source is scored on the
SAME 84 events). Also winner-futures Kalshi-vs-Polymarket scores and BTTS
props (Kalshi-only) scores/calibration curves.
"""
import duckdb
import pandas as pd
import numpy as np

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
OUT = f"{ROOT}/pipeline/data/analysis/calibration"

EPS = 1e-4


def brier(p, o):
    p = np.clip(p, 0, 1)
    return np.mean((p - o) ** 2)


def logscore(p, o):
    p = np.clip(p, EPS, 1 - EPS)
    return np.mean(-(o * np.log(p) + (1 - o) * np.log(1 - p)))


def score_table(df, price_cols, group_cols=('horizon',)):
    rows = []
    for keys, g in df.groupby(list(group_cols)):
        if not isinstance(keys, tuple):
            keys = (keys,)
        for src, col in price_cols.items():
            sub = g.dropna(subset=[col, 'outcome'])
            if len(sub) == 0:
                continue
            rows.append({
                **dict(zip(group_cols, keys)),
                'source': src,
                'n': len(sub),
                'brier': brier(sub[col].values, sub['outcome'].values),
                'logscore': logscore(sub[col].values, sub['outcome'].values),
                'mean_price': sub[col].mean(),
                'mean_outcome': sub['outcome'].mean(),
            })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 1. Match 3-way cross-source Brier/log scores (the headline comparison)
# ---------------------------------------------------------------------------
panel = pd.read_parquet(f"{OUT}/match3way_panel.parquet")
m3w_scores = score_table(panel, {'kalshi': 'kalshi_price', 'polymarket': 'pm_price', 'pinnacle_devig': 'pinn_price'})
m3w_scores['family'] = 'match_3way'
m3w_scores = m3w_scores.sort_values(['horizon', 'source'])
m3w_scores.to_csv(f"{OUT}/scores_match3way_by_source_horizon.csv", index=False)
print("=== match 3-way scores ===")
print(m3w_scores.to_string(index=False))

# ---------------------------------------------------------------------------
# 2. Winner-futures: Kalshi vs Polymarket, T-24h/T-1h/T-5min before each
#    team's own elimination-settlement moment (44 settled teams)
# ---------------------------------------------------------------------------
con = duckdb.connect()
wf = pd.read_parquet(f"{OUT}/_crosswalk_winner_futures.parquet")
wf_settled = wf[wf['status'] == 'finalized'].copy()
wf_settled['outcome'] = (wf_settled['result'] == 'yes').astype(int)
assert wf_settled['outcome'].sum() == 0, "no team should have won yet (final not played)"

horizons = {'T-24h': pd.Timedelta(hours=24), 'T-1h': pd.Timedelta(hours=1), 'T-5min': pd.Timedelta(minutes=5)}
_epoch0 = pd.Timestamp('1970-01-01', tz='UTC')
tgt_rows = []
for h, delta in horizons.items():
    tmp = wf_settled[['ticker', 'team_name_pm', 'yes_token', 'outcome', 'resolution_dt']].copy()
    tmp['horizon'] = h
    tmp['target_dt'] = tmp['resolution_dt'] - delta
    tgt_rows.append(tmp)
wf_targets = pd.concat(tgt_rows, ignore_index=True)
wf_targets['target_ts_epoch'] = ((wf_targets['target_dt'] - _epoch0) // pd.Timedelta(seconds=1)).astype('int64')
con.register('wf_targets', wf_targets)

wf_kalshi = con.execute(f"""
    SELECT t.ticker, t.horizon, c.price_close_usd AS kalshi_price
    FROM wf_targets t
    ASOF JOIN (
        SELECT ticker, end_period_ts, price_close_usd
        FROM 'pipeline/data/kalshi/candles/series_ticker=KXMENWORLDCUP/*.parquet'
        WHERE price_close_usd IS NOT NULL
    ) c ON t.ticker = c.ticker AND t.target_ts_epoch >= c.end_period_ts
""").df()
wf_pm = con.execute(f"""
    SELECT t.ticker, t.horizon, p.implied_prob AS pm_price
    FROM wf_targets t
    ASOF JOIN 'pipeline/data/benchmarks/polymarket/prices/priority_tier=0/fidelity=60/*.parquet' p
      ON t.yes_token = p.token_id AND t.target_ts_epoch >= p.ts_utc
""").df()
wf_panel = wf_targets[['ticker', 'team_name_pm', 'horizon', 'outcome', 'target_dt']].copy()
wf_panel = wf_panel.merge(wf_kalshi.drop_duplicates(['ticker', 'horizon']), on=['ticker', 'horizon'], how='left')
wf_panel = wf_panel.merge(wf_pm.drop_duplicates(['ticker', 'horizon']), on=['ticker', 'horizon'], how='left')
wf_panel.to_parquet(f"{OUT}/winner_futures_panel.parquet", index=False)
print("\nwinner-futures null check:", wf_panel[['kalshi_price', 'pm_price']].isna().sum().to_dict(), "of", len(wf_panel))

wf_scores = score_table(wf_panel, {'kalshi': 'kalshi_price', 'polymarket': 'pm_price'})
wf_scores['family'] = 'winner_futures'
wf_scores.to_csv(f"{OUT}/scores_winner_futures_by_source_horizon.csv", index=False)
print("=== winner futures scores (44 settled 'No' teams) ===")
print(wf_scores.to_string(index=False))

# ---------------------------------------------------------------------------
# 3. Props (KXWCBTTS, Kalshi-only, all 100 finalized matches incl. group stage)
# ---------------------------------------------------------------------------
markets = pd.read_parquet(f"{OUT}/_catalog_families.parquet")
btts = markets[(markets['series_ticker'] == 'KXWCBTTS') & (markets['status'] == 'finalized')].copy()
btts['outcome'] = (btts['result'] == 'yes').astype(int)
tgt_rows = []
for h, delta in horizons.items():
    tmp = btts[['ticker', 'outcome', 'resolution_dt']].copy()
    tmp['horizon'] = h
    tmp['target_dt'] = tmp['resolution_dt'] - delta
    tgt_rows.append(tmp)
btts_targets = pd.concat(tgt_rows, ignore_index=True)
btts_targets['target_ts_epoch'] = ((btts_targets['target_dt'] - _epoch0) // pd.Timedelta(seconds=1)).astype('int64')
con.register('btts_targets', btts_targets)
btts_kalshi = con.execute(f"""
    SELECT t.ticker, t.horizon, c.price_close_usd AS kalshi_price
    FROM btts_targets t
    ASOF JOIN (
        SELECT ticker, end_period_ts, price_close_usd
        FROM 'pipeline/data/kalshi/candles/series_ticker=KXWCBTTS/*.parquet'
        WHERE price_close_usd IS NOT NULL
    ) c ON t.ticker = c.ticker AND t.target_ts_epoch >= c.end_period_ts
""").df()
btts_panel = btts_targets.merge(btts_kalshi.drop_duplicates(['ticker', 'horizon']), on=['ticker', 'horizon'], how='left')
btts_panel.to_parquet(f"{OUT}/btts_props_panel.parquet", index=False)
btts_scores = score_table(btts_panel, {'kalshi': 'kalshi_price'})
btts_scores['family'] = 'props_btts'
btts_scores.to_csv(f"{OUT}/scores_props_btts_by_horizon.csv", index=False)
print("\n=== BTTS props scores (Kalshi-only, 100 finalized matches) ===")
print(btts_scores.to_string(index=False))

# combined table
all_scores = pd.concat([m3w_scores, wf_scores, btts_scores], ignore_index=True)
all_scores.to_csv(f"{OUT}/scores_all_families.csv", index=False)
print("\nWrote scores_all_families.csv,", len(all_scores), "rows")
