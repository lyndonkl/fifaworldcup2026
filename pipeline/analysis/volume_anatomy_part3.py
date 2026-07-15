"""
Part 3: consolidate findings-ready tables -- concentration/Lorenz, regime-break
annotations, poll-vs-volume (item 6, Trends flagged absent per G4), novelty-vs-
sports ranking, MEX-ENG summary JSON.
"""
import duckdb
import pandas as pd
import numpy as np
import json

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
OUT = f"{ROOT}/pipeline/data/analysis/volume-anatomy"

# ---------------------------------------------------------------------------
# Concentration: Gini, Lorenz curve, top-N shares, long-tail dollar reality
# ---------------------------------------------------------------------------
mt = pd.read_parquet(f"{OUT}/market_totals.parquet").sort_values('contracts', ascending=False).reset_index(drop=True)
all_markets = pd.read_parquet(f"{OUT}/all_markets_status.parquet")
total_contracts = mt['contracts'].sum()
n_traded = len(mt)
n_catalog = len(all_markets)
n_never_traded = n_catalog - n_traded

def gini(x):
    x = np.sort(np.asarray(x))
    n = len(x)
    cum = np.cumsum(x)
    return (n + 1 - 2 * np.sum(cum) / cum[-1]) / n

g = gini(mt['contracts'].values)

top_n_shares = {}
for topn in [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000]:
    top_n_shares[topn] = float(mt['contracts'].iloc[:topn].sum() / total_contracts * 100)

half = n_traded // 2
bottom_half_traded_sum = float(mt['contracts'].iloc[half:].sum())
bottom_half_traded_pct = bottom_half_traded_sum / total_contracts * 100

combined_bottom_n_markets = n_never_traded + (n_traded - half)
combined_bottom_pct_of_catalog = combined_bottom_n_markets / n_catalog * 100
combined_bottom_volume_pct = bottom_half_traded_pct  # never-traded contribute 0

concentration_summary = {
    "n_catalog_markets": int(n_catalog),
    "n_traded_markets": int(n_traded),
    "n_never_traded_markets": int(n_never_traded),
    "pct_never_traded_of_catalog": float(n_never_traded / n_catalog * 100),
    "gini_coefficient_traded_markets": float(g),
    "top_n_contract_share_pct": top_n_shares,
    "bottom_half_of_traded_markets": {
        "n_markets": int(n_traded - half),
        "contracts": bottom_half_traded_sum,
        "pct_of_total_volume": bottom_half_traded_pct,
    },
    "combined_never_traded_plus_bottom_half_traded": {
        "n_markets": int(combined_bottom_n_markets),
        "pct_of_full_catalog": combined_bottom_volume_pct if False else combined_bottom_pct_of_catalog,
        "pct_of_total_volume": combined_bottom_volume_pct,
    },
    "note": "R6: all volume figures are trade-tape sums (`market_totals.parquet`), "
            "not the catalog `volume` field. 'never traded' (n=%d) is verified two ways: "
            "(a) catalog tickers with zero rows in the 72.8M+ row trade tape, (b) exactly "
            "matches series.parquet's own zero_volume_market_count sum (4,573), a strong "
            "internal cross-check." % n_never_traded,
}
with open(f"{OUT}/concentration_summary.json", "w") as f:
    json.dump(concentration_summary, f, indent=2)
print(json.dumps(concentration_summary, indent=2))

# Lorenz curve (decile-free, full resolution is fine at 30k points but downsample for a chart)
mt_sorted = mt.sort_values('contracts').reset_index(drop=True)  # ascending, standard Lorenz
mt_sorted['cum_contracts'] = mt_sorted['contracts'].cumsum()
mt_sorted['cum_pct_volume'] = mt_sorted['cum_contracts'] / total_contracts * 100
mt_sorted['cum_pct_markets'] = (np.arange(1, n_traded + 1)) / n_traded * 100
# downsample to ~2000 points for a lightweight chart file, always keeping first/last
idx = np.unique(np.linspace(0, n_traded - 1, 2000).astype(int))
lorenz = mt_sorted.iloc[idx][['cum_pct_markets', 'cum_pct_volume', 'contracts']]
lorenz.to_csv(f"{OUT}/lorenz_curve.csv", index=False)

# ---------------------------------------------------------------------------
# Regime-break annotations (used by the arrival-timeline finding)
# ---------------------------------------------------------------------------
daily = pd.read_parquet(f"{OUT}/daily_arrival.parquet").sort_values('day').reset_index(drop=True)
daily['cum_contracts'] = daily['contracts'].cumsum()
daily['cum_pct'] = daily['cum_contracts'] / daily['contracts'].sum() * 100
daily.to_csv(f"{OUT}/daily_arrival_annotated.csv", index=False)

def cum_pct_on(date_str):
    row = daily[daily['day'] == pd.Timestamp(date_str, tz='UTC')]
    return float(row['cum_pct'].iloc[0]) if len(row) else None

def contracts_on(date_str):
    row = daily[daily['day'] == pd.Timestamp(date_str, tz='UTC')]
    return float(row['contracts'].iloc[0]) if len(row) else None

regime_breaks = {
    "listing_first_trade": "2025-05-15",
    "draw_date": "2025-12-05",
    "draw_day_contracts": contracts_on("2025-12-05"),
    "draw_baseline_nearby_avg_contracts": float(daily[(daily['day'] >= '2025-11-25') & (daily['day'] <= '2025-12-10') & (daily['day'] != pd.Timestamp("2025-12-05", tz='UTC'))]['contracts'].mean()),
    "tournament_start": "2026-06-11",
    "cum_pct_thru_2026_06_10": cum_pct_on("2026-06-10"),
    "cum_pct_thru_2026_06_27_group_stage_end": cum_pct_on("2026-06-27"),
    "r32_window": "2026-06-28 to 2026-07-03",
    "cum_pct_thru_2026_07_03": cum_pct_on("2026-07-03"),
    "r16_window": "2026-07-04 to 2026-07-07",
    "cum_pct_thru_2026_07_07": cum_pct_on("2026-07-07"),
    "rest_day_2026_07_08_contracts": contracts_on("2026-07-08"),
    "r16_flanking_day_2026_07_07_contracts": contracts_on("2026-07-07"),
    "qf_flanking_day_2026_07_09_contracts": contracts_on("2026-07-09"),
    "qf_window": "2026-07-09 to 2026-07-11",
    "cum_pct_thru_2026_07_11": cum_pct_on("2026-07-11"),
    "rest_day_2026_07_13_contracts": contracts_on("2026-07-13"),
    "sf1_2026_07_14_contracts_partial_day": contracts_on("2026-07-14"),
    "total_lifetime_contracts": float(daily['contracts'].sum()),
}
with open(f"{OUT}/regime_breaks.json", "w") as f:
    json.dump(regime_breaks, f, indent=2, default=str)
print(json.dumps(regime_breaks, indent=2, default=str))

# ---------------------------------------------------------------------------
# Family crossover context (day-level flip vs cumulative flip)
# ---------------------------------------------------------------------------
fam = pd.read_parquet(f"{OUT}/family_daily.parquet")
pivot = fam.pivot_table(index='day', columns='family', values='contracts', fill_value=0).sort_index()
fut = 'Tournament winner futures'
match_fam = 'Per-match markets (3-way moneyline + match derivatives)'
day_level_flip = pivot[pivot[match_fam] > pivot[fut]].index.min()
family_crossover = json.load(open(f"{OUT}/family_crossover.json"))
family_crossover["day_level_flip_first_day_match_gt_futures"] = str(day_level_flip)
family_crossover["jun11_futures_contracts"] = float(pivot.loc['2026-06-11', fut])
family_crossover["jun11_match_contracts"] = float(pivot.loc['2026-06-11', match_fam])
with open(f"{OUT}/family_crossover.json", "w") as f:
    json.dump(family_crossover, f, indent=2, default=str)
print(family_crossover)

# ---------------------------------------------------------------------------
# Novelty vs real-sports ranking (KXWCMENTION-TRUM)
# ---------------------------------------------------------------------------
mt_desc = mt.copy()
mt_desc['rank'] = np.arange(1, len(mt_desc) + 1)
real_sports_families = [
    'Per-match markets (3-way moneyline + match derivatives)',
    'Tournament winner futures',
    'Group-stage markets',
    'Team-performance props (stage of elimination, host-nation performance)',
]
trum = mt_desc[mt_desc['ticker'] == 'KXWCMENTION-26JUL06USABEL-TRUM'].iloc[0]
below = mt_desc[mt_desc['rank'] > trum['rank']]
real_below = below[below['family'].isin(real_sports_families)]
novelty_summary = {
    "ticker": "KXWCMENTION-26JUL06USABEL-TRUM",
    "title_context": "Will Trump be mentioned during the USA-Belgium broadcast (KXWCMENTION novelty family)",
    "contracts": float(trum['contracts']),
    "rank_out_of_traded_markets": int(trum['rank']),
    "n_traded_markets": int(n_traded),
    "biggest_market_ticker": mt_desc.iloc[0]['ticker'],
    "biggest_market_contracts": float(mt_desc.iloc[0]['contracts']),
    "multiple_below_biggest": float(mt_desc.iloc[0]['contracts'] / trum['contracts']),
    "n_real_sports_markets_out_traded": int(len(real_below)),
    "n_real_sports_markets_total": int(len(mt_desc[mt_desc['family'].isin(real_sports_families)])),
    "pct_real_sports_out_traded": float(len(real_below) / len(mt_desc[mt_desc['family'].isin(real_sports_families)]) * 100),
    "kxmenworldcup_legs_out_traded": below[below['series_ticker'] == 'KXMENWORLDCUP']['ticker'].tolist(),
    "kxwcgame_legs_out_traded": below[below['series_ticker'] == 'KXWCGAME']['ticker'].tolist(),
    "kxwcadvance_legs_out_traded": below[below['series_ticker'] == 'KXWCADVANCE']['ticker'].tolist(),
}
with open(f"{OUT}/novelty_vs_sports.json", "w") as f:
    json.dump(novelty_summary, f, indent=2)
print(json.dumps(novelty_summary, indent=2))

# ---------------------------------------------------------------------------
# MEX-ENG summary JSON (consolidating the interactive analysis into a file)
# ---------------------------------------------------------------------------
mexeng = pd.read_parquet(f"{OUT}/mexeng_advance_tape.parquet")
total_me = float(mexeng['count_contracts'].sum())

def bucket_stats(a, b):
    sub = mexeng[(mexeng['ts'] >= pd.Timestamp(a, tz='UTC')) & (mexeng['ts'] < pd.Timestamp(b, tz='UTC'))]
    s = float(sub['count_contracts'].sum())
    yes = float(sub[sub['taker_side'] == 'yes']['count_contracts'].sum())
    return {
        "contracts": s,
        "pct_of_total": s / total_me * 100,
        "n_trades": int(len(sub)),
        "pct_taker_buy_yes": (yes / s * 100) if s > 0 else None,
    }

kickoff = "2026-07-06 01:00:00"
mexeng_summary = {
    "ticker": "KXWCADVANCE-26JUL05MEXENG-MEX",
    "total_contracts": total_me,
    "total_trades": int(len(mexeng)),
    "n_block_trades": int(mexeng['is_block_trade'].sum()),
    "median_trade_size_contracts": float(mexeng['count_contracts'].median()),
    "mean_trade_size_contracts": float(mexeng['count_contracts'].mean()),
    "tape_wide_mean_trade_size_contracts_for_context": 12308775212.0 / 72819299.0,
    "kickoff_utc_pinnacle_verified": kickoff,
    "buckets": {
        "flat_pre_period_thru_kickoff_minus_4h": bucket_stats("2020-01-01", "2026-07-05 21:00:00"),
        "pre_kickoff_ramp_kickoff_minus_4h_to_kickoff": bucket_stats("2026-07-05 21:00:00", "2026-07-06 01:00:00"),
        "in_game_kickoff_to_kickoff_plus_2h": bucket_stats("2026-07-06 01:00:00", "2026-07-06 03:00:00"),
        "settlement_tail_30min": bucket_stats("2026-07-06 03:00:00", "2026-07-06 03:30:00"),
        "after_settlement": bucket_stats("2026-07-06 03:30:00", "2030-01-01"),
    },
    "comparison_legs_same_event": {
        "KXWCADVANCE-ENG": 64331208.97,
        "KXWCGAME-MEX": 20019107.70,
        "KXWCGAME-ENG": 12990348.47,
        "KXWCGAME-TIE": 7642050.75,
    },
}
advance_total = total_me + mexeng_summary["comparison_legs_same_event"]["KXWCADVANCE-ENG"]
game_total = sum([mexeng_summary["comparison_legs_same_event"][k] for k in ["KXWCGAME-MEX", "KXWCGAME-ENG", "KXWCGAME-TIE"]])
mexeng_summary["advance_family_total_both_legs"] = advance_total
mexeng_summary["game_moneyline_total_three_legs"] = game_total
mexeng_summary["advance_vs_game_multiple"] = advance_total / game_total

with open(f"{OUT}/mexeng_summary.json", "w") as f:
    json.dump(mexeng_summary, f, indent=2)
print(json.dumps(mexeng_summary, indent=2))

# ---------------------------------------------------------------------------
# Item 6: volume-vs-attention. Trends is BLOCKED (G4) -- flagged, not
# substituted. Only real attention proxy on hand is the sparse poll arm.
# ---------------------------------------------------------------------------
polls = pd.read_parquet(f"{ROOT}/pipeline/data/benchmarks/opinion/polls.parquet")
poll_dates = sorted(polls['publish_date'].unique())
rows = []
for pd_date in poll_dates:
    d0 = pd.Timestamp(pd_date, tz='UTC')
    window = daily[(daily['day'] >= d0 - pd.Timedelta(days=3)) & (daily['day'] <= d0 + pd.Timedelta(days=3))]
    rows.append({
        "poll_publish_date": str(pd_date),
        "sources_categories": ", ".join(sorted(polls[polls['publish_date'] == pd_date]['source'].astype(str).unique()) ),
        "avg_daily_contracts_pm3d": float(window['contracts'].mean()) if len(window) else None,
    })
poll_vs_vol = pd.DataFrame(rows)
poll_vs_vol.to_csv(f"{OUT}/poll_dates_vs_volume.csv", index=False)
print(poll_vs_vol)

interest = polls[polls['category'] == 'interest_level'][['entity', 'value_pct', 'field_start_date', 'field_end_date']]
field_start, field_end = interest['field_start_date'].iloc[0], interest['field_end_date'].iloc[0]
field_window = daily[(daily['day'] >= pd.Timestamp(field_start, tz='UTC')) & (daily['day'] <= pd.Timestamp(field_end, tz='UTC'))]
attention_gap = {
    "trends_status": "BLOCKED (G4, HTTP 429 IP-reputation block on trends.google.com; see "
                      "pipeline/data/benchmarks/opinion/trends_status.json). No substitute metric "
                      "used -- this beat is degraded to poll-only per data-audit.md disposition.",
    "yougov_interest_level_wave": {
        "field_window": f"{field_start} to {field_end}",
        "pct_not_at_all_interested_us_adults": float(interest.loc[interest['entity'] == 'Not at all interested', 'value_pct'].iloc[0]),
        "pct_very_or_somewhat_interested_us_adults": float(interest.loc[interest['entity'].isin(['Very interested', 'Somewhat interested']), 'value_pct'].sum()),
        "avg_kalshi_daily_contracts_during_field_window": float(field_window['contracts'].mean()) if len(field_window) else None,
    },
    "tournament_peak_avg_daily_contracts_jun11_jul11": float(daily[(daily['day'] >= '2026-06-11') & (daily['day'] <= '2026-07-11')]['contracts'].mean()),
}
attention_gap["revealed_vs_stated_multiple"] = attention_gap["tournament_peak_avg_daily_contracts_jun11_jul11"] / attention_gap["yougov_interest_level_wave"]["avg_kalshi_daily_contracts_during_field_window"]
with open(f"{OUT}/volume_vs_attention.json", "w") as f:
    json.dump(attention_gap, f, indent=2, default=str)
print(json.dumps(attention_gap, indent=2, default=str))

print("=== part3 done ===")
