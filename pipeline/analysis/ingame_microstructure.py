"""
ARM: In-game microstructure -- what does a goal do to money?

Builds, over the 28 played knockout matches (entity_map.parquet, match_status=='finalized'):
  1. Goal/event detection on the Kalshi tape (1-min TV peaks) + cross-source corroboration.
  2. Per-source reaction latency (time-to-first-reprice, time-to-90%) -- Kalshi & Pinnacle
     tick-level, Polymarket at its native 1-min fidelity.
  3. Kalshi-vs-Polymarket lead/lag via cross-correlation of 1-min returns.
  4. Overreaction & fade: peak vs 30-min-settled level, half-life of the excess.
  5. Shootout anatomy for the 4 penalty shootouts (on KXWCADVANCE, not KXWCGAME -- see notes).
  6. Settlement-tail anatomy across 3 contract families (KXWCGAME, KXWCADVANCE, KXWCTOTAL).
  7. Trade-size / inter-trade-time regime shift, pre-match vs in-game, same market.

Defect rules applied: R1 (Pinnacle ms-precision dedup, inherited from the store), R2 (Pinnacle
price_decimal<1.01 filter + overround_at_ts=0 treated as NaN with raw-prob fallback), R3 (new
single-print reversion-glitch screen, validated against the known RSACAN example), R4 (GAME=
regulation, ADVANCE=progression -- the shootout analysis deliberately uses ADVANCE), R6 (trade-
tape sums, never catalog volume), R7 (1-min resampling + 0.15pp-equivalent floor for cross-source
work; here goal-detection floor is 0.08pp on Kalshi's own tape, see methods note for why).

Run: pipeline/.venv/bin/python pipeline/analysis/ingame_microstructure.py
Outputs: pipeline/data/analysis/ingame-microstructure/*.parquet
Methods note: research/analysis/ingame-microstructure-methods.md
"""
import json
import duckdb
import numpy as np
import pandas as pd
from datetime import timedelta

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
PIPE = f"{ROOT}/pipeline/data"
OUT = f"{PIPE}/analysis/ingame-microstructure"

con = duckdb.connect()

# ===========================================================================
# 0. Load entity map (28 finalized KO matches) and bulk-pull tick data
# ===========================================================================
em = con.execute(f"select * from '{PIPE}/audit/entity_map.parquet' where match_status='finalized'").df()
assert len(em) == 28
em["kickoff_utc"] = pd.to_datetime(em["pinnacle_kickoff_utc"], utc=True)
em["win_start"] = em["kickoff_utc"] - timedelta(minutes=30)
em["win_end"] = em["kickoff_utc"] + timedelta(hours=3, minutes=45)
em_idx = em.set_index("match_id")

print("=" * 70)
print("STEP 0: bulk pull")
print("=" * 70)

legs = list(em["kalshi_leg_team1"]) + list(em["kalshi_leg_team2"]) + list(em["kalshi_leg_tie"])
leg_list_sql = ",".join(f"'{l}'" for l in legs)
kt = con.execute(f"""
    select ticker, created_time, yes_price_usd, count_contracts, taker_side, taker_outcome_side, trade_id
    from '{PIPE}/kalshi/trades/series_ticker=KXWCGAME/*.parquet'
    where ticker in ({leg_list_sql})
    order by created_time
""").df()
kt["created_time"] = pd.to_datetime(kt["created_time"], format="ISO8601", utc=True)
print(f"Kalshi KXWCGAME trades (28 matches x 3 legs): {len(kt):,}")

toks = [t for t in list(em["polymarket_team1_yes_token"]) + list(em["polymarket_team2_yes_token"]) + list(em["polymarket_draw_yes_token"]) if t]
tok_sql = ",".join(f"'{t}'" for t in toks)
poly = con.execute(f"""
    select token_id, ts_utc, implied_prob
    from '{PIPE}/benchmarks/polymarket/prices/priority_tier=1/fidelity=1/*.parquet'
    where token_id in ({tok_sql})
    order by ts_utc
""").df()
poly["ts_dt"] = pd.to_datetime(poly["ts_utc"], unit="s", utc=True)
print(f"Polymarket rows: {len(poly):,}")

fids = list(em["pinnacle_fixture_id"])
fid_sql = ",".join(f"'{f}'" for f in fids)
pin_raw = con.execute(f"""
    select fixture_id, market_id, outcome_id, created_at, price_decimal, overround_at_ts, implied_prob_devigged, implied_prob_raw
    from '{PIPE}/benchmarks/odds/pinnacle.parquet'
    where fixture_id in ({fid_sql}) and market_name='Full Time Result' and bookmaker='pinnacle'
    order by created_at
""").df()
print(f"Pinnacle FTR rows (pre-filter): {len(pin_raw):,}")

# R2: filter price_decimal<1.01; treat overround_at_ts=0 as NaN on the devigged field, fall
# back to raw 1/price implied prob for those rows (documented fallback, not silent drop).
pin = pin_raw[pin_raw["price_decimal"] >= 1.01].copy()
pin["implied_prob_use"] = pin["implied_prob_devigged"]
bad_overround = pin["overround_at_ts"] == 0
pin.loc[bad_overround, "implied_prob_use"] = pin.loc[bad_overround, "implied_prob_raw"]
pin["created_dt"] = pd.to_datetime(pin["created_at"], format="ISO8601", utc=True)
pin["outcome_offset"] = pin["outcome_id"].astype(int) - pin["market_id"].astype(int)  # 0=team1,1=tie,2=team2 (verified 28/28)
print("R2 applied:", (pin_raw["price_decimal"] < 1.01).sum(), "price<1.01 rows dropped;",
      int(bad_overround.sum()), "overround_at_ts=0 rows fell back to raw implied prob")

# R3: screen isolated single-print reversion glitches (new rule, this audit's follow-on).
def flag_reversion_glitches(g):
    g = g.sort_values("created_dt").reset_index(drop=True)
    p = g["implied_prob_use"].values
    t = g["created_dt"].values.astype("datetime64[ns]")
    n = len(p)
    flag = np.zeros(n, dtype=bool)
    if n < 3:
        return flag
    d1 = p[1:-1] - p[:-2]
    d2 = p[2:] - p[1:-1]
    spike_span_s = (t[2:] - t[1:-1]) / np.timedelta64(1, "s")  # glitch-tick -> revert-tick duration
    opposite_sign = (np.sign(d1) != np.sign(d2)) & (np.sign(d1) != 0) & (np.sign(d2) != 0)
    big1 = np.abs(d1) > 0.10
    reverts = np.abs(d2) > 0.6 * np.abs(d1)
    quick = spike_span_s < 10
    flag[1:-1] = opposite_sign & big1 & reverts & quick
    return flag

groups = []
n_flagged = 0
for (fid, oid), g in pin.groupby(["fixture_id", "outcome_id"]):
    flag = flag_reversion_glitches(g)
    n_flagged += flag.sum()
    gg = g.sort_values("created_dt").reset_index(drop=True)
    gg["r3_glitch"] = flag
    groups.append(gg)
pin = pd.concat(groups, ignore_index=True)
print(f"R3 glitches flagged and dropped: {n_flagged} / {len(pin)}")
pin = pin[~pin["r3_glitch"]].copy()

# ===========================================================================
# 1. Goal/event detection on Kalshi (1-min TV peaks) + cross-source corroboration
# ===========================================================================
print("\n" + "=" * 70)
print("STEP 1: event detection")
print("=" * 70)

leg_map = {}
for _, r in em.iterrows():
    leg_map[r["kalshi_leg_team1"]] = (r["match_id"], "team1")
    leg_map[r["kalshi_leg_team2"]] = (r["match_id"], "team2")
    leg_map[r["kalshi_leg_tie"]] = (r["match_id"], "tie")
kt["match_id"] = kt["ticker"].map(lambda t: leg_map.get(t, (None, None))[0])
kt["leg"] = kt["ticker"].map(lambda t: leg_map.get(t, (None, None))[1])
kt = kt.dropna(subset=["match_id"])

def resample_1min(s, win_start, win_end):
    if len(s) == 0:
        return None
    full_idx = pd.date_range(win_start.floor("min"), win_end.ceil("min"), freq="1min", tz="UTC")
    binned = s.resample("1min").last()
    return binned.reindex(full_idx).ffill().bfill()

def find_events(tv_series, floor_abs=0.08, mad_mult=4.0, min_sep_min=4):
    vals = tv_series.dropna()
    if len(vals) == 0:
        return [], floor_abs
    med = np.median(vals.values)
    mad = np.median(np.abs(vals.values - med)) * 1.4826
    thresh = max(floor_abs, med + mad_mult * mad)
    cand = vals[vals >= thresh].sort_values(ascending=False)
    accepted = []
    for ts, mag in cand.items():
        if all(abs((ts - a_ts).total_seconds()) >= min_sep_min * 60 for a_ts, _ in accepted):
            accepted.append((ts, mag))
    accepted.sort(key=lambda x: x[0])
    return accepted, thresh

all_events, match_tv_series = [], {}
for match_id, r in em_idx.iterrows():
    sub = kt[kt["match_id"] == match_id]
    win_start, win_end = r["win_start"], r["win_end"]
    legs_ = {leg: resample_1min(sub[sub["leg"] == leg].set_index("created_time")["yes_price_usd"], win_start, win_end)
              for leg in ["team1", "team2", "tie"]}
    if any(v is None for v in legs_.values()):
        continue
    diffs = pd.DataFrame({leg: legs_[leg].diff().abs() for leg in legs_})
    tv = diffs.sum(axis=1) / 2.0
    match_tv_series[match_id] = (legs_, tv)
    events, thresh = find_events(tv)
    for ts, mag in events:
        leg_diffs = {leg: legs_[leg].diff().loc[ts] for leg in legs_}
        primary_leg = max(leg_diffs, key=lambda l: abs(leg_diffs[l]))
        direction = "up" if leg_diffs[primary_leg] > 0 else "down"
        all_events.append({"match_id": match_id, "event_ts": ts, "tv_magnitude": mag,
                             "primary_leg": primary_leg, "direction": direction,
                             "team1": r["team1_name"], "team2": r["team2_name"]})

ev_df = pd.DataFrame(all_events)
print(f"Candidate events across 27/28 matches (JUL07SUICOL correctly locates 0, penalties-only): {len(ev_df)}")
print(ev_df.groupby("match_id").size().describe())

# Build 1-min series for Poly & Pinnacle, per match/leg (for corroboration + item 2/3 support)
poly_series, pin_series = {}, {}
for match_id, r in em_idx.iterrows():
    win_start, win_end = r["win_start"], r["win_end"]
    tok_map = {"team1": r["polymarket_team1_yes_token"], "team2": r["polymarket_team2_yes_token"], "tie": r["polymarket_draw_yes_token"]}
    legs_ = {}
    ok = True
    for leg, tok in tok_map.items():
        if not tok:
            ok = False
            continue
        s = poly[poly["token_id"] == tok].set_index("ts_dt")["implied_prob"].sort_index()
        legs_[leg] = resample_1min(s, win_start, win_end)
    poly_series[match_id] = legs_ if (ok and all(v is not None for v in legs_.values())) else None

    fid = r["pinnacle_fixture_id"]
    sub = pin[pin["fixture_id"] == fid]
    offset_map = {"team1": 0, "tie": 1, "team2": 2}
    plegs = {leg: resample_1min(sub[sub["outcome_offset"] == off].set_index("created_dt")["implied_prob_use"].sort_index(), win_start, win_end)
             for leg, off in offset_map.items()}
    pin_series[match_id] = plegs if all(v is not None for v in plegs.values()) else None

def nearest_jump(series_dict, primary_leg, event_ts, direction, window_min, mag_floor):
    """Time-nearest (not magnitude-largest) qualifying jump in window -- see methods note for
    why magnitude-largest was tried and rejected (steals a neighboring goal's jump in
    multi-goal matches)."""
    s = series_dict.get(primary_leg) if series_dict else None
    if s is None:
        return None, None
    lo, hi = event_ts - pd.Timedelta(minutes=window_min), event_ts + pd.Timedelta(minutes=window_min)
    win = s[(s.index >= lo) & (s.index <= hi)]
    d = win.diff()
    cand = d[d > 0] if direction == "up" else d[d < 0]
    cand = cand[cand.abs() >= mag_floor]
    if cand.empty:
        return None, None
    time_dist = (cand.index - event_ts).map(lambda x: abs(x.total_seconds()))
    idx = cand.index[np.argmin(time_dist)]
    return idx, float(d.loc[idx])

rows = []
for _, e in ev_df.iterrows():
    match_id, ts, primary_leg, direction = e["match_id"], e["event_ts"], e["primary_leg"], e["direction"]
    p_ts, p_mag = nearest_jump(poly_series.get(match_id), primary_leg, ts, direction, 15, 0.04)
    n_ts, n_mag = nearest_jump(pin_series.get(match_id), primary_leg, ts, direction, 90, 0.03)
    rows.append({**e.to_dict(), "poly_match_ts": p_ts, "poly_match_mag": p_mag,
                 "pin_match_ts": n_ts, "pin_match_mag": n_mag,
                 "n_sources_confirming": 1 + (p_ts is not None) + (n_ts is not None)})
matched = pd.DataFrame(rows)
matched.to_parquet(f"{OUT}/events_matched.parquet")
print(f"Events with >=2-source confirmation: {(matched['n_sources_confirming']>=2).sum()} / {len(matched)}")

# ===========================================================================
# 2. Reaction latency: Kalshi & Pinnacle tick-level, Polymarket 1-min native
# ===========================================================================
print("\n" + "=" * 70)
print("STEP 2: reaction latency")
print("=" * 70)

leg_ticker_map = {}
for match_id, r in em_idx.iterrows():
    leg_ticker_map[(match_id, "team1")] = r["kalshi_leg_team1"]
    leg_ticker_map[(match_id, "team2")] = r["kalshi_leg_team2"]
    leg_ticker_map[(match_id, "tie")] = r["kalshi_leg_tie"]
offset_map = {"team1": 0, "tie": 1, "team2": 2}

def seconds_since(t_cross, t0):
    if t_cross is None:
        return np.nan
    ts = pd.Timestamp(t_cross)
    if ts.tzinfo is None:
        ts = ts.tz_localize("UTC")
    return (ts - t0).total_seconds()

def first_crossing(times, prices, t0, direction, pre_level, jump_total, frac):
    if jump_total == 0 or len(times) == 0:
        return None
    t0_naive = np.datetime64(pd.Timestamp(t0).tz_localize(None) if pd.Timestamp(t0).tzinfo else pd.Timestamp(t0))
    target_delta = frac * jump_total
    for tt, pp in zip(times, prices):
        if tt < t0_naive:
            continue
        delta = pp - pre_level
        if direction == "up" and delta >= target_delta:
            return tt
        if direction == "down" and delta <= target_delta:
            return tt
    return None

records = []
for _, e in matched.iterrows():
    match_id, leg, direction = e["match_id"], e["primary_leg"], e["direction"]
    # t0 = Kalshi's own 1-min detection bin. See docstring / methods note: a cross-source
    # min() was tried and rejected -- at a +-90min Pinnacle window it can let a later Kalshi
    # event "steal" an earlier Pinnacle jump belonging to a *different* goal (verified on
    # JUL01USABIH, JUN30FRASWE). Kalshi is tick-level and the most liquid source here, so its
    # own bin is the most reliable single anchor, accurate to within the 1-min bin width.
    t0 = pd.Timestamp(e["event_ts"])
    win_hi = t0 + pd.Timedelta(minutes=10)
    rec = {"match_id": match_id, "event_ts_kalshi_bin": e["event_ts"], "t0": t0,
           "leg": leg, "direction": direction, "tv_magnitude": e["tv_magnitude"]}

    ticker = leg_ticker_map[(match_id, leg)]
    ksub = kt[(kt["ticker"] == ticker) & (kt["created_time"] >= t0 - pd.Timedelta(minutes=6)) & (kt["created_time"] <= win_hi)].sort_values("created_time")
    kpre = ksub.loc[(ksub["created_time"] >= t0 - pd.Timedelta(minutes=5)) & (ksub["created_time"] < t0 - pd.Timedelta(minutes=1)), "yes_price_usd"].median()
    kpost = ksub.loc[(ksub["created_time"] >= t0 + pd.Timedelta(minutes=3)) & (ksub["created_time"] <= t0 + pd.Timedelta(minutes=8)), "yes_price_usd"].median()
    if pd.isna(kpre) or pd.isna(kpost):
        rec.update({"kalshi_pre": kpre, "kalshi_post": kpost, "kalshi_jump_total": np.nan, "kalshi_t_first_s": np.nan, "kalshi_t_90pct_s": np.nan})
    else:
        kjump = kpost - kpre
        wsub = ksub[ksub["created_time"] >= t0]
        rec.update({"kalshi_pre": kpre, "kalshi_post": kpost, "kalshi_jump_total": kjump,
                     "kalshi_t_first_s": seconds_since(first_crossing(wsub["created_time"].values, wsub["yes_price_usd"].values, t0, direction, kpre, kjump, 0.20), t0),
                     "kalshi_t_90pct_s": seconds_since(first_crossing(wsub["created_time"].values, wsub["yes_price_usd"].values, t0, direction, kpre, kjump, 0.90), t0)})

    fid = em_idx.loc[match_id, "pinnacle_fixture_id"]
    off = offset_map[leg]
    psub = pin[(pin["fixture_id"] == fid) & (pin["outcome_offset"] == off) & (pin["created_dt"] >= t0 - pd.Timedelta(minutes=6)) & (pin["created_dt"] <= win_hi)].sort_values("created_dt")
    ppre = psub.loc[(psub["created_dt"] >= t0 - pd.Timedelta(minutes=5)) & (psub["created_dt"] < t0 - pd.Timedelta(minutes=1)), "implied_prob_use"].median()
    ppost = psub.loc[(psub["created_dt"] >= t0 + pd.Timedelta(minutes=3)) & (psub["created_dt"] <= t0 + pd.Timedelta(minutes=8)), "implied_prob_use"].median()
    if pd.isna(ppre) or pd.isna(ppost):
        rec.update({"pinnacle_pre": ppre, "pinnacle_post": ppost, "pinnacle_jump_total": np.nan, "pinnacle_t_first_s": np.nan, "pinnacle_t_90pct_s": np.nan})
    else:
        pjump = ppost - ppre
        wsub = psub[psub["created_dt"] >= t0]
        rec.update({"pinnacle_pre": ppre, "pinnacle_post": ppost, "pinnacle_jump_total": pjump,
                     "pinnacle_t_first_s": seconds_since(first_crossing(wsub["created_dt"].values, wsub["implied_prob_use"].values, t0, direction, ppre, pjump, 0.20), t0),
                     "pinnacle_t_90pct_s": seconds_since(first_crossing(wsub["created_dt"].values, wsub["implied_prob_use"].values, t0, direction, ppre, pjump, 0.90), t0)})

    plegs = poly_series.get(match_id)
    if plegs is not None:
        s = plegs[leg]
        mpre = s[(s.index >= t0 - pd.Timedelta(minutes=5)) & (s.index < t0 - pd.Timedelta(minutes=1))].median()
        mpost = s[(s.index >= t0 + pd.Timedelta(minutes=3)) & (s.index <= t0 + pd.Timedelta(minutes=8))].median()
        if pd.isna(mpre) or pd.isna(mpost):
            rec.update({"poly_pre": mpre, "poly_post": mpost, "poly_jump_total": np.nan, "poly_t_first_s": np.nan, "poly_t_90pct_s": np.nan})
        else:
            mjump = mpost - mpre
            wsub = s[s.index >= t0]
            rec.update({"poly_pre": mpre, "poly_post": mpost, "poly_jump_total": mjump,
                         "poly_t_first_s": seconds_since(first_crossing(wsub.index.values, wsub.values, t0, direction, mpre, mjump, 0.20), t0),
                         "poly_t_90pct_s": seconds_since(first_crossing(wsub.index.values, wsub.values, t0, direction, mpre, mjump, 0.90), t0)})
    records.append(rec)

lat = pd.DataFrame(records)
lat.to_parquet(f"{OUT}/reaction_latency.parquet")
for src in ["kalshi", "poly", "pinnacle"]:
    sub = lat[lat[f"{src}_jump_total"].abs() >= 0.05]
    print(f"{src}: n_located={sub[f'{src}_t_first_s'].notna().sum()}/{len(sub)} "
          f"median_t_first_s={sub[f'{src}_t_first_s'].median():.1f} median_t_90pct_s={sub[f'{src}_t_90pct_s'].median():.1f}")

# ===========================================================================
# 3. Kalshi vs Polymarket lead/lag: cross-correlation of 1-min returns
# ===========================================================================
print("\n" + "=" * 70)
print("STEP 3: lead/lag cross-correlation")
print("=" * 70)

MAXLAG = 10
def ccf(x, y, maxlag):
    out = {}
    n = len(x)
    for lag in range(-maxlag, maxlag + 1):
        xa, yb = (x[: n - lag] if lag > 0 else x, y[lag:]) if lag >= 0 else (x[-lag:], y[: n + lag])
        if len(xa) < 10 or np.std(xa) < 1e-9 or np.std(yb) < 1e-9:
            out[lag] = np.nan
            continue
        out[lag] = np.corrcoef(xa, yb)[0, 1]
    return out

ll_rows = []
for match_id, r in em_idx.iterrows():
    legs_ = match_tv_series[match_id][0]
    plegs = poly_series.get(match_id)
    if plegs is None:
        continue
    kickoff = r["kickoff_utc"]
    lo, hi = kickoff - pd.Timedelta(minutes=5), kickoff + pd.Timedelta(hours=3)
    k = legs_["team1"]; k = k[(k.index >= lo) & (k.index <= hi)]
    p = plegs["team1"]; p = p[(p.index >= lo) & (p.index <= hi)]
    idx = k.index.intersection(p.index)
    if len(idx) < 30:
        continue
    kr = k.reindex(idx).diff().dropna()
    pr = p.reindex(idx).diff().dropna()
    idx2 = kr.index.intersection(pr.index)
    kr, pr = kr.reindex(idx2).values, pr.reindex(idx2).values
    if len(kr) < 20:
        continue
    c = ccf(kr, pr, MAXLAG)
    best_lag = max(c, key=lambda l: (c[l] if not np.isnan(c[l]) else -np.inf))
    ll_rows.append({"match_id": match_id, "n_bins": len(kr), "best_lag_min": best_lag,
                      "best_corr": c[best_lag], "contemp_corr": c[0],
                      "who_leads": "kalshi" if best_lag > 0 else ("polymarket" if best_lag < 0 else "simultaneous"),
                      "lead_minutes": abs(best_lag)})
ll = pd.DataFrame(ll_rows)
ll.to_parquet(f"{OUT}/leadlag.parquet")
print(ll["who_leads"].value_counts().to_dict(), "median best_corr:", ll["best_corr"].median(), "median contemp_corr:", ll["contemp_corr"].median())

# ===========================================================================
# 4. Overreaction & fade
# ===========================================================================
print("\n" + "=" * 70)
print("STEP 4: overreaction & fade")
print("=" * 70)

lat_sorted = lat.sort_values(["match_id", "t0"]).reset_index(drop=True)
lat_sorted["next_t0"] = lat_sorted.groupby("match_id")["t0"].shift(-1)

over_rows = []
for _, e in lat_sorted.iterrows():
    match_id, leg, direction, t0 = e["match_id"], e["leg"], e["direction"], e["t0"]
    if pd.isna(e["kalshi_jump_total"]) or abs(e["kalshi_jump_total"]) < 0.05:
        continue
    ticker = leg_ticker_map[(match_id, leg)]
    win_end_match = em_idx.loc[match_id, "win_end"]
    settle_lo = t0 + pd.Timedelta(minutes=25)
    settle_hi = min(t0 + pd.Timedelta(minutes=35), win_end_match)
    contaminated = pd.notna(e["next_t0"]) and (pd.Timestamp(e["next_t0"]) < settle_hi)

    ksub = kt[(kt["ticker"] == ticker) & (kt["created_time"] >= t0) & (kt["created_time"] <= t0 + pd.Timedelta(minutes=12))].sort_values("created_time")
    if ksub.empty:
        continue
    peak_idx = ksub["yes_price_usd"].idxmax() if direction == "up" else ksub["yes_price_usd"].idxmin()
    peak_price, peak_time = ksub.loc[peak_idx, "yes_price_usd"], ksub.loc[peak_idx, "created_time"]

    settle_sub = kt[(kt["ticker"] == ticker) & (kt["created_time"] >= settle_lo) & (kt["created_time"] <= settle_hi)]
    settled_price = settle_sub["yes_price_usd"].median() if len(settle_sub) else np.nan

    overshoot, half_life_s = None, None
    if pd.notna(settled_price) and not contaminated:
        overshoot = float(peak_price - settled_price) if direction == "up" else float(settled_price - peak_price)
        half_target = settled_price + 0.5 * (peak_price - settled_price)
        after_peak = kt[(kt["ticker"] == ticker) & (kt["created_time"] > peak_time) & (kt["created_time"] <= settle_hi)].sort_values("created_time")
        for _, row in after_peak.iterrows():
            if (direction == "up" and row["yes_price_usd"] <= half_target) or (direction == "down" and row["yes_price_usd"] >= half_target):
                half_life_s = (row["created_time"] - peak_time).total_seconds()
                break
    over_rows.append({"match_id": match_id, "leg": leg, "direction": direction, "t0": t0,
                        "peak_price": peak_price, "peak_lag_from_t0_s": (peak_time - t0).total_seconds(),
                        "settled_price_30min": settled_price, "contaminated_by_next_event": contaminated,
                        "overshoot": overshoot, "half_life_s": half_life_s, "jump_total": e["kalshi_jump_total"]})

over_df = pd.DataFrame(over_rows)
over_df.to_parquet(f"{OUT}/overreaction_fade.parquet")
clean = over_df[~over_df["contaminated_by_next_event"] & over_df["overshoot"].notna()]
print(f"Clean events: {len(clean)}/{len(over_df)}. Overshoot mean={clean['overshoot'].mean():.4f} median={clean['overshoot'].median():.4f}")
print(f"Fraction overshoot>0.02: {(clean['overshoot']>0.02).mean():.3f}; median half-life where so: {clean.loc[clean['overshoot']>0.02,'half_life_s'].median():.2f}s")

# ===========================================================================
# 5. Shootout anatomy (KXWCADVANCE, not KXWCGAME -- see methods note)
# ===========================================================================
print("\n" + "=" * 70)
print("STEP 5: shootout anatomy")
print("=" * 70)

SHOOTOUTS = ["JUN29GERPAR", "JUN29NEDMAR", "JUL03AUSEGY", "JUL07SUICOL"]

def get_advance_trades(match_id, team_code):
    ticker = f"KXWCADVANCE-26{match_id}-{team_code}"
    df = con.execute(f"""
        select created_time, yes_price_usd, count_contracts
        from '{PIPE}/kalshi/trades/series_ticker=KXWCADVANCE/*.parquet'
        where ticker = '{ticker}' order by created_time
    """).df()
    df["created_time"] = pd.to_datetime(df["created_time"], format="ISO8601", utc=True)
    return df

shoot_rows = []
for match_id in SHOOTOUTS:
    r = em_idx.loc[match_id]
    winner_code = r["advance_result"]
    df = get_advance_trades(match_id, winner_code)
    if df.empty:
        continue
    t_settle = df["created_time"].max()
    s = df.set_index("created_time")["yes_price_usd"]
    kickoff = r["kickoff_utc"]
    search_lo = kickoff + pd.Timedelta(minutes=85)
    binned = s[s.index >= search_lo].resample("30s").agg(["min", "max", "count"])
    binned.columns = ["lo", "hi", "n"]
    binned["range"] = binned["hi"] - binned["lo"]
    is_hot = binned["range"] >= 0.06
    idxs = list(binned.index)
    end_i = len(idxs) - 1
    while end_i >= 0 and binned["n"].iloc[end_i] == 0:
        end_i -= 1
    start_i = end_i
    gap = 0
    while start_i > 0:
        if is_hot.iloc[start_i - 1]:
            gap = 0
            start_i -= 1
        else:
            gap += 1
            if gap > 8:  # >4min quiet ends the run; bridges the brief post-decisive-kick lock-in tail
                break
            start_i -= 1
    shootout_start, shootout_end = idxs[start_i], t_settle
    win_dur_min = (shootout_end - shootout_start).total_seconds() / 60.0

    win_ticks = df[(df["created_time"] >= shootout_start) & (df["created_time"] <= shootout_end)].sort_values("created_time")
    p = win_ticks["yes_price_usd"].rolling(5, min_periods=1, center=True).median().values
    turns, last_dir, last_extreme = 0, 0, (p[0] if len(p) else None)
    for i in range(1, len(p)):
        d = p[i] - p[i - 1]
        if d == 0:
            continue
        cur_dir = 1 if d > 0 else -1
        if last_dir != 0 and cur_dir != last_dir and abs(p[i] - last_extreme) > 0.05:
            turns += 1
            last_extreme = p[i]
        if last_dir == 0:
            last_extreme = p[i]
        last_dir = cur_dir

    match_all = df[(df["created_time"] >= kickoff - pd.Timedelta(minutes=30)) & (df["created_time"] <= r["win_end"])]
    match_minutes = (r["win_end"] - (kickoff - pd.Timedelta(minutes=30))).total_seconds() / 60.0
    match_avg_tpm = len(match_all) / match_minutes
    shootout_tpm = len(win_ticks) / max(win_dur_min, 0.5)

    shoot_rows.append({"match_id": match_id, "winner_code": winner_code,
                         "shootout_start": shootout_start, "shootout_end": shootout_end,
                         "shootout_duration_min": round(win_dur_min, 2), "n_ticks_in_shootout": len(win_ticks),
                         "total_contracts_in_shootout": win_ticks["count_contracts"].sum(),
                         "approx_turning_points": turns, "shootout_trades_per_min": round(shootout_tpm, 1),
                         "match_avg_trades_per_min": round(match_avg_tpm, 1), "intensity_ratio": round(shootout_tpm / match_avg_tpm, 2)})
    win_ticks.to_parquet(f"{OUT}/shootout_ticks_{match_id}.parquet")

shoot_df = pd.DataFrame(shoot_rows)
shoot_df.to_parquet(f"{OUT}/shootout_summary.parquet")
print(shoot_df.to_string())

# ===========================================================================
# 6. Settlement-tail anatomy across 3 families
# ===========================================================================
print("\n" + "=" * 70)
print("STEP 6: settlement tail")
print("=" * 70)

match_ids = em["match_id"].tolist()
cat = con.execute(f"""
    select series_ticker, event_ticker, ticker, result, status
    from '{PIPE}/catalog/markets.parquet'
    where series_ticker in ('KXWCGAME','KXWCADVANCE','KXWCTOTAL') and status='finalized'
""").df()
cat["match_id_guess"] = cat["event_ticker"].str.replace(r"^KX\w+-26", "", regex=True)
cat = cat[cat["match_id_guess"].isin(match_ids) & cat["result"].isin(["yes", "no"])].copy()

def bulk_pull(series, tickers):
    tk_sql = ",".join(f"'{t}'" for t in tickers)
    df = con.execute(f"""
        select ticker, created_time, yes_price_usd, count_contracts, taker_side
        from '{PIPE}/kalshi/trades/series_ticker={series}/*.parquet'
        where ticker in ({tk_sql}) order by created_time
    """).df()
    df["created_time"] = pd.to_datetime(df["created_time"], format="ISO8601", utc=True)
    return df

kt_adv = bulk_pull("KXWCADVANCE", cat.loc[cat.series_ticker == "KXWCADVANCE", "ticker"].tolist())
kt_tot = bulk_pull("KXWCTOTAL", cat.loc[cat.series_ticker == "KXWCTOTAL", "ticker"].tolist())
trade_tables = {"KXWCGAME": kt, "KXWCADVANCE": kt_adv, "KXWCTOTAL": kt_tot}

def analyze_tail(df, ticker, result):
    sub = df[df["ticker"] == ticker].sort_values("created_time")
    if len(sub) < 5:
        return None
    settles_high = (result == "yes")
    band_lo, band_hi = (0.97, 1.01) if settles_high else (-0.01, 0.03)
    in_band = ((sub["yes_price_usd"] >= band_lo) & (sub["yes_price_usd"] <= band_hi)).values
    res_i = None
    for i in range(len(sub)):
        if in_band[i:].all():
            res_i = i
            break
    if res_i is None or res_i == 0:
        return None
    pre, tail = sub.iloc[:res_i], sub.iloc[res_i:]
    extreme_lo, extreme_hi = (0.985, 1.0) if settles_high else (0.0, 0.015)
    at_extreme = (tail["yes_price_usd"] >= extreme_lo) & (tail["yes_price_usd"] <= extreme_hi)
    return {"ticker": ticker, "result": result, "n_pre": len(pre), "n_tail": len(tail),
            "resolution_time": sub.iloc[res_i]["created_time"], "last_trade_time": sub.iloc[-1]["created_time"],
            "tail_duration_s": (sub.iloc[-1]["created_time"] - sub.iloc[res_i]["created_time"]).total_seconds(),
            "tail_volume_contracts": tail["count_contracts"].sum(),
            "pre_avg_trade_size": pre["count_contracts"].mean(), "tail_avg_trade_size": tail["count_contracts"].mean(),
            "tail_pct_at_extreme_price": at_extreme.mean(),
            "tail_taker_buy_yes_frac": (tail["taker_side"] == "yes").mean() if "taker_side" in tail else np.nan}

tail_rows = []
for _, row in cat.iterrows():
    res = analyze_tail(trade_tables[row["series_ticker"]], row["ticker"], row["result"])
    if res is not None:
        res["family"] = row["series_ticker"]
        res["match_id"] = row["match_id_guess"]
        tail_rows.append(res)
tail_df = pd.DataFrame(tail_rows)
tail_df.to_parquet(f"{OUT}/settlement_tail.parquet")
print(f"Legs with located tail: {len(tail_df)}/{len(cat)}")
print(tail_df.groupby("family").agg(n=("ticker", "size"), median_tail_dur_s=("tail_duration_s", "median"),
                                      tail_vol_sum=("tail_volume_contracts", "sum"),
                                      median_pre_size=("pre_avg_trade_size", "median"),
                                      median_tail_size=("tail_avg_trade_size", "median"),
                                      median_pct_extreme=("tail_pct_at_extreme_price", "median"),
                                      median_taker_buy_yes=("tail_taker_buy_yes_frac", "median")))

# ===========================================================================
# 7. Trade-size / inter-trade-time regime shift, pre-match vs in-game
# ===========================================================================
print("\n" + "=" * 70)
print("STEP 7: trade-size regime shift")
print("=" * 70)

reg_rows = []
for ticker, sub in kt.sort_values(["ticker", "created_time"]).groupby("ticker"):
    match_id, leg = leg_map[ticker]
    kickoff, win_end = em_idx.loc[match_id, "kickoff_utc"], em_idx.loc[match_id, "win_end"]
    pre = sub[sub["created_time"] < kickoff]
    ingame = sub[(sub["created_time"] >= kickoff) & (sub["created_time"] <= win_end)]
    if len(pre) < 20 or len(ingame) < 20:
        continue
    pre_gaps = pre["created_time"].diff().dt.total_seconds().dropna()
    in_gaps = ingame["created_time"].diff().dt.total_seconds().dropna()
    reg_rows.append({"match_id": match_id, "leg": leg, "ticker": ticker, "n_pre": len(pre), "n_ingame": len(ingame),
                       "pre_median_size": pre["count_contracts"].median(), "ingame_median_size": ingame["count_contracts"].median(),
                       "pre_median_intertrade_s": pre_gaps.median(), "ingame_median_intertrade_s": in_gaps.median()})
reg_df = pd.DataFrame(reg_rows)
reg_df["size_ratio_ingame_over_pre"] = reg_df["ingame_median_size"] / reg_df["pre_median_size"]
reg_df["intertrade_ratio_ingame_over_pre"] = reg_df["ingame_median_intertrade_s"] / reg_df["pre_median_intertrade_s"]
reg_df.to_parquet(f"{OUT}/size_regime.parquet")
print(f"N legs: {len(reg_df)}. Median size ratio: {reg_df['size_ratio_ingame_over_pre'].median():.3f}; "
      f"median inter-trade-time ratio: {reg_df['intertrade_ratio_ingame_over_pre'].median():.4f}")
print(f"Pooled trade counts: pre={reg_df['n_pre'].sum():,} ingame={reg_df['n_ingame'].sum():,}")

print("\nDone. All tables written to", OUT)
