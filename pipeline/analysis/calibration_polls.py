"""
Item 5: poll-vs-market gaps at matched dates (Pew publish 2026-06-02;
Ipsos publish 2025-12-01, the pre-tournament wave).
"""
import duckdb
import pandas as pd

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
OUT = f"{ROOT}/pipeline/data/analysis/calibration"

con = duckdb.connect()

PEW_KALSHI = {
    'Spain': 'ES', 'Brazil': 'BR', 'Argentina': 'AR', 'United States': 'US',
    'France': 'FR', 'Germany': 'DE', 'Portugal': 'PT', 'Mexico': 'MX', 'England': 'GB',
}

pew = con.execute(f"""
    SELECT entity, value_prob, publish_epoch_utc
    FROM 'pipeline/data/benchmarks/opinion/polls.parquet'
    WHERE category='winner_expectation' AND source='Pew Research Center' AND entity != 'Not sure'
""").df()

rows = []
for _, r in pew.iterrows():
    code = PEW_KALSHI[r['entity']]
    ticker = f"KXMENWORLDCUP-26-{code}"
    ts = int(r['publish_epoch_utc'])
    kp = con.execute(f"""
        SELECT price_close_usd FROM 'pipeline/data/kalshi/candles/series_ticker=KXMENWORLDCUP/*.parquet'
        WHERE ticker='{ticker}' AND end_period_ts <= {ts} AND price_close_usd IS NOT NULL
        ORDER BY end_period_ts DESC LIMIT 1
    """).fetchone()
    kalshi_price = kp[0] if kp else None
    rows.append({'poll': 'Pew (pub 2026-06-02, field Mar23-29)', 'entity': r['entity'],
                 'poll_pct': r['value_prob'] * 100, 'kalshi_price_pct': None if kalshi_price is None else kalshi_price * 100,
                 'gap_kalshi_minus_poll_pp': None if kalshi_price is None else (kalshi_price * 100 - r['value_prob'] * 100)})

# Ipsos: Argentina-specific "agree Argentina repeats" item, at Dec 1 2025 publish
ts_ipsos = int(con.execute("""
    SELECT publish_epoch_utc FROM 'pipeline/data/benchmarks/opinion/polls.parquet'
    WHERE category='agree_argentina_repeats' LIMIT 1
""").fetchone()[0])
arg_ipsos = con.execute("""
    SELECT entity, value_prob FROM 'pipeline/data/benchmarks/opinion/polls.parquet'
    WHERE category='agree_argentina_repeats' AND entity IN ('Argentina', '30-country average')
""").df()
for _, r in arg_ipsos.iterrows():
    kp = con.execute(f"""
        SELECT price_close_usd FROM 'pipeline/data/kalshi/candles/series_ticker=KXMENWORLDCUP/*.parquet'
        WHERE ticker='KXMENWORLDCUP-26-AR' AND end_period_ts <= {ts_ipsos} AND price_close_usd IS NOT NULL
        ORDER BY end_period_ts DESC LIMIT 1
    """).fetchone()
    kalshi_price = kp[0] if kp else None
    rows.append({'poll': f"Ipsos ({r['entity']}, pub 2025-12-01, field Oct24-Nov7'25)", 'entity': 'Argentina',
                 'poll_pct': r['value_prob'] * 100, 'kalshi_price_pct': None if kalshi_price is None else kalshi_price * 100,
                 'gap_kalshi_minus_poll_pp': None if kalshi_price is None else (kalshi_price * 100 - r['value_prob'] * 100)})

panel = pd.DataFrame(rows)
panel.to_csv(f"{OUT}/poll_vs_market_gaps.csv", index=False)
print(panel.to_string(index=False))
