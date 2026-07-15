"""
Item 2: calibration curves (predicted probability vs realized frequency,
deciles) per source and per Kalshi contract family. Pools every 1-min price
observation across each market's life (standard prediction-market calibration
practice), tagged with the settled outcome, for:
  - Kalshi: winner_futures / match_3way / props_btts
  - Polymarket: winner_futures / match_3way (tier-1 KO moneylines)
  - Pinnacle de-vigged: match_3way (28 KO matches, Full Time Result)
"""
import duckdb
import pandas as pd
import numpy as np

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
OUT = f"{ROOT}/pipeline/data/analysis/calibration"

con = duckdb.connect()

markets_path = f"{ROOT}/pipeline/data/catalog/markets.parquet"


def decile_table(df, price_col, n_bins=10):
    d = df.dropna(subset=[price_col, 'outcome']).copy()
    d = d[(d[price_col] > 0) & (d[price_col] < 1)]
    if len(d) < n_bins:
        return pd.DataFrame()
    d['decile'] = pd.qcut(d[price_col], n_bins, labels=False, duplicates='drop')
    g = d.groupby('decile').agg(
        n=(price_col, 'size'),
        mean_predicted=(price_col, 'mean'),
        realized_freq=('outcome', 'mean'),
        min_p=(price_col, 'min'), max_p=(price_col, 'max'),
    ).reset_index()
    g['gap_pp'] = (g['mean_predicted'] - g['realized_freq']) * 100
    return g


results = []

# --- Kalshi: winner futures (44 settled teams, full price history) ---
kw = con.execute(f"""
    SELECT c.ticker, c.price_close_usd AS p, CASE WHEN m.result='yes' THEN 1 ELSE 0 END AS outcome
    FROM 'pipeline/data/kalshi/candles/series_ticker=KXMENWORLDCUP/*.parquet' c
    JOIN '{markets_path}' m ON c.ticker = m.ticker
    WHERE m.status='finalized' AND c.price_close_usd IS NOT NULL
""").df()
t = decile_table(kw, 'p'); t['source'] = 'kalshi'; t['family'] = 'winner_futures'; results.append(t)

# --- Kalshi: match 3-way (all 100 finalized events, 300 legs) ---
kg = con.execute(f"""
    SELECT c.ticker, c.price_close_usd AS p, CASE WHEN m.result='yes' THEN 1 ELSE 0 END AS outcome
    FROM 'pipeline/data/kalshi/candles/series_ticker=KXWCGAME/*.parquet' c
    JOIN '{markets_path}' m ON c.ticker = m.ticker
    WHERE m.status='finalized' AND c.price_close_usd IS NOT NULL
""").df()
t = decile_table(kg, 'p'); t['source'] = 'kalshi'; t['family'] = 'match_3way'; results.append(t)

# --- Kalshi: BTTS props (100 finalized) ---
kb = con.execute(f"""
    SELECT c.ticker, c.price_close_usd AS p, CASE WHEN m.result='yes' THEN 1 ELSE 0 END AS outcome
    FROM 'pipeline/data/kalshi/candles/series_ticker=KXWCBTTS/*.parquet' c
    JOIN '{markets_path}' m ON c.ticker = m.ticker
    WHERE m.status='finalized' AND c.price_close_usd IS NOT NULL
""").df()
t = decile_table(kb, 'p'); t['source'] = 'kalshi'; t['family'] = 'props_btts'; results.append(t)

# --- Polymarket: winner futures (44 settled teams via crosswalk) ---
wf = pd.read_parquet(f"{OUT}/_crosswalk_winner_futures.parquet")
wf_settled = wf[wf['status'] == 'finalized'][['yes_token', 'result']].dropna(subset=['yes_token'])
con.register('wf_tok', wf_settled)
pw = con.execute(f"""
    SELECT p.token_id, p.implied_prob AS pr, CASE WHEN w.result='yes' THEN 1 ELSE 0 END AS outcome
    FROM 'pipeline/data/benchmarks/polymarket/prices/priority_tier=0/fidelity=60/*.parquet' p
    JOIN wf_tok w ON p.token_id = w.yes_token
""").df()
t = decile_table(pw, 'pr'); t['source'] = 'polymarket'; t['family'] = 'winner_futures'; results.append(t)

# --- Polymarket: match 3-way (tier-1 KO moneylines, all legs w/ known token) ---
emap = pd.read_parquet(f"{OUT}/_entity_map_played.parquet")
game_markets = pd.read_parquet(f"{OUT}/_catalog_families.parquet")
gm = game_markets[game_markets['series_ticker'] == 'KXWCGAME'][['ticker', 'result']]
tok_rows = []
for _, r in emap.iterrows():
    for tcol, kcol in [('polymarket_team1_yes_token', 'kalshi_leg_team1'),
                        ('polymarket_team2_yes_token', 'kalshi_leg_team2'),
                        ('polymarket_draw_yes_token', 'kalshi_leg_tie')]:
        tok_rows.append({'token_id': r[tcol], 'kalshi_ticker': r[kcol]})
tok_df = pd.DataFrame(tok_rows).merge(gm, left_on='kalshi_ticker', right_on='ticker', how='left').dropna(subset=['token_id', 'result'])
con.register('pm_m3w_tok', tok_df[['token_id', 'result']])
pm3 = con.execute(f"""
    SELECT p.token_id, p.implied_prob AS pr, CASE WHEN t.result='yes' THEN 1 ELSE 0 END AS outcome
    FROM 'pipeline/data/benchmarks/polymarket/prices/priority_tier=1/fidelity=1/*.parquet' p
    JOIN pm_m3w_tok t ON p.token_id = t.token_id
""").df()
t = decile_table(pm3, 'pr'); t['source'] = 'polymarket'; t['family'] = 'match_3way'; results.append(t)

# --- Pinnacle de-vigged: match 3-way (28 KO matches, Full Time Result) ---
pin_rows = []
for _, r in emap.iterrows():
    for oc, kcol in [('101', 'kalshi_leg_team1'), ('102', 'kalshi_leg_tie'), ('103', 'kalshi_leg_team2')]:
        pin_rows.append({'fixture_id': r['pinnacle_fixture_id'], 'outcome_id': oc, 'kalshi_ticker': r[kcol]})
pin_df = pd.DataFrame(pin_rows).merge(gm, left_on='kalshi_ticker', right_on='ticker', how='left').dropna(subset=['result'])
con.register('pin_m3w_tok', pin_df[['fixture_id', 'outcome_id', 'result']])
pinn = con.execute(f"""
    SELECT pr.implied_prob_devigged AS pr, CASE WHEN t.result='yes' THEN 1 ELSE 0 END AS outcome
    FROM 'pipeline/data/benchmarks/odds/pinnacle.parquet' pr
    JOIN pin_m3w_tok t ON pr.fixture_id = t.fixture_id AND pr.outcome_id = t.outcome_id
    WHERE pr.bookmaker='pinnacle' AND pr.market_name='Full Time Result'
      AND pr.price_decimal >= 1.01 AND pr.overround_at_ts IS NOT NULL AND pr.overround_at_ts != 0
""").df()
t = decile_table(pinn, 'pr'); t['source'] = 'pinnacle_devig'; t['family'] = 'match_3way'; results.append(t)

all_curves = pd.concat(results, ignore_index=True)
all_curves = all_curves[['family', 'source', 'decile', 'n', 'mean_predicted', 'realized_freq', 'gap_pp', 'min_p', 'max_p']]
all_curves.to_csv(f"{OUT}/calibration_curves_deciles.csv", index=False)
pd.set_option('display.width', 200)
for (fam, src), g in all_curves.groupby(['family', 'source']):
    print(f"\n=== {fam} / {src} (n_total={g['n'].sum()}) ===")
    print(g[['decile', 'n', 'mean_predicted', 'realized_freq', 'gap_pp']].to_string(index=False))

# summary: mean |gap| and worst decile per family/source
summary = all_curves.groupby(['family', 'source']).apply(
    lambda g: pd.Series({
        'mean_abs_gap_pp': g['gap_pp'].abs().mean(),
        'worst_decile_gap_pp': g.loc[g['gap_pp'].abs().idxmax(), 'gap_pp'],
        'worst_decile_range': f"{g.loc[g['gap_pp'].abs().idxmax(), 'min_p']:.2f}-{g.loc[g['gap_pp'].abs().idxmax(), 'max_p']:.2f}",
        'n_total': g['n'].sum(),
    })
).reset_index()
summary.to_csv(f"{OUT}/calibration_curves_summary.csv", index=False)
print("\n=== SUMMARY ===")
print(summary.to_string(index=False))
