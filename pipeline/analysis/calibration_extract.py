"""
CALIBRATION VERDICT arm - core extraction.
Builds matched-price panels (Kalshi / Polymarket / Pinnacle-devigged) at fixed
pre-resolution horizons for every settled binary market in three Kalshi
contract families (winner futures, match 3-ways, props), computes Brier/log
scores, calibration-curve bins, and Kalshi-Pinnacle/Polymarket divergence
episodes. Obeys data-audit.md rules R1-R9.

Writes derived tables to pipeline/data/analysis/calibration/.
"""
import duckdb
import pandas as pd
import numpy as np
import json
import os

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
OUT = f"{ROOT}/pipeline/data/analysis/calibration"
os.makedirs(OUT, exist_ok=True)

con = duckdb.connect()

# ---------------------------------------------------------------------------
# 0. Team name crosswalk: Kalshi yes_sub_title <-> Polymarket group_item_title
# ---------------------------------------------------------------------------
NAME_OVERRIDES = {
    "Bosnia and Herzegovina": "Bosnia-Herzegovina",
    "Turkey": "Turkiye",
    "Curacao": "Curaçao",
}

# ---------------------------------------------------------------------------
# 1. Load catalog markets for the three families
# ---------------------------------------------------------------------------
markets = con.execute(f"""
    SELECT ticker, event_ticker, series_ticker, status, result,
           yes_sub_title, title,
           occurrence_datetime, close_time, settlement_ts, open_time,
           volume_contracts
    FROM '{ROOT}/pipeline/data/catalog/markets.parquet'
    WHERE series_ticker IN ('KXWCGAME','KXWCBTTS','KXMENWORLDCUP','KXWCADVANCE')
""").df()

def to_ts(s):
    return pd.to_datetime(s, utc=True, errors='coerce')

markets['settlement_dt'] = to_ts(markets['settlement_ts'])
markets['close_dt'] = to_ts(markets['close_time'])
# resolution moment = settlement_ts, fallback close_time
markets['resolution_dt'] = markets['settlement_dt'].fillna(markets['close_dt'])
markets['open_dt'] = to_ts(markets['open_time'])

markets.to_parquet(f"{OUT}/_catalog_families.parquet", index=False)
print("catalog families:", markets.groupby(['series_ticker','status']).size())

# ---------------------------------------------------------------------------
# 2. Entity map (28 finalized KO matches; 2 scheduled semis excluded downstream)
# ---------------------------------------------------------------------------
emap = con.execute(f"SELECT * FROM '{ROOT}/pipeline/data/audit/entity_map.parquet'").df()
emap_played = emap[emap['match_status'] == 'finalized'].copy()
assert len(emap_played) == 28, f"expected 28 finalized KO matches, got {len(emap_played)}"
emap_played.to_parquet(f"{OUT}/_entity_map_played.parquet", index=False)
print("finalized KO matches:", len(emap_played))

# ---------------------------------------------------------------------------
# 3. Winner-futures crosswalk Kalshi <-> Polymarket
# ---------------------------------------------------------------------------
wf = markets[markets['series_ticker'] == 'KXMENWORLDCUP'].copy()
wf['team_name_pm'] = wf['yes_sub_title'].replace(NAME_OVERRIDES)

pm_winner = con.execute(f"""
    SELECT market_id, group_item_title AS team_name_pm, clob_token_ids_json, volume
    FROM '{ROOT}/pipeline/data/benchmarks/polymarket/markets.parquet'
    WHERE family='winner' AND volume > 0
""").df()
pm_winner['yes_token'] = pm_winner['clob_token_ids_json'].apply(lambda j: json.loads(j)[0])

wf_x = wf.merge(pm_winner[['team_name_pm', 'market_id', 'yes_token']], on='team_name_pm', how='left')
unmatched = wf_x[wf_x['yes_token'].isna()]
print(f"winner-futures crosswalk: {wf_x['yes_token'].notna().sum()}/{len(wf_x)} matched; "
      f"unmatched: {unmatched['yes_sub_title'].tolist()}")
wf_x.to_parquet(f"{OUT}/_crosswalk_winner_futures.parquet", index=False)

print("DONE extract stage 0-3")
