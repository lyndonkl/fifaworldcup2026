"""
Cross-source alignment audit: Kalshi vs Polymarket vs Pinnacle, all knockout matches.

Gate 1 follow-on audit. Builds:
  - pipeline/data/audit/entity_map.parquet          (canonical join keys, Phase 2 uses this)
  - pipeline/data/audit/alignment/match_alignment.parquet  (per-match tick counts + skew)
  - pipeline/data/audit/alignment/price_breaks.parquet     (the located "biggest break" tick on each source, per match)
  - pipeline/data/audit/alignment/defect_validation.json   (defect-rule validation results)
  - pipeline/data/audit/alignment/norway_brazil_calibration.json (Act-3 sanity check)

Run: pipeline/.venv/bin/python pipeline/analysis/audit_cross_source_alignment.py
"""
import json
import duckdb
import pandas as pd
from datetime import datetime, timezone

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
PIPE = f"{ROOT}/pipeline/data"
OUT_ALIGN = f"{PIPE}/audit/alignment"
OUT_ENTITY = f"{PIPE}/audit/entity_map.parquet"

con = duckdb.connect()

# ---------------------------------------------------------------------------
# 1. Team code / name canonicalization
# ---------------------------------------------------------------------------
# Kalshi 3-letter code -> (canonical name, polymarket name, pinnacle name)
TEAMS = {
    "RSA": ("South Africa", "South Africa", "South Africa"),
    "CAN": ("Canada", "Canada", "Canada"),
    "BRA": ("Brazil", "Brazil", "Brazil"),
    "JPN": ("Japan", "Japan", "Japan"),
    "GER": ("Germany", "Germany", "Germany"),
    "PAR": ("Paraguay", "Paraguay", "Paraguay"),
    "NED": ("Netherlands", "Netherlands", "Netherlands"),
    "MAR": ("Morocco", "Morocco", "Morocco"),
    "CIV": ("Ivory Coast", "Côte d'Ivoire", "Ivory Coast"),
    "NOR": ("Norway", "Norway", "Norway"),
    "FRA": ("France", "France", "France"),
    "SWE": ("Sweden", "Sweden", "Sweden"),
    "MEX": ("Mexico", "Mexico", "Mexico"),
    "ECU": ("Ecuador", "Ecuador", "Ecuador"),
    "BEL": ("Belgium", "Belgium", "Belgium"),
    "SEN": ("Senegal", "Senegal", "Senegal"),
    "ENG": ("England", "England", "England"),
    "COD": ("DR Congo", "DR Congo", "Congo DR"),
    "USA": ("United States", "United States", "USA"),
    "BIH": ("Bosnia and Herzegovina", "Bosnia and Herzegovina", "Bosnia and Herzegovina"),
    "ESP": ("Spain", "Spain", "Spain"),
    "AUT": ("Austria", "Austria", "Austria"),
    "POR": ("Portugal", "Portugal", "Portugal"),
    "CRO": ("Croatia", "Croatia", "Croatia"),
    "SUI": ("Switzerland", "Switzerland", "Switzerland"),
    "DZA": ("Algeria", "Algeria", "Algeria"),
    "ARG": ("Argentina", "Argentina", "Argentina"),
    "CPV": ("Cape Verde", "Cabo Verde", "Cape Verde"),
    "AUS": ("Australia", "Australia", "Australia"),
    "EGY": ("Egypt", "Egypt", "Egypt"),
    "COL": ("Colombia", "Colombia", "Colombia"),
    "GHA": ("Ghana", "Ghana", "Ghana"),
}

# ---------------------------------------------------------------------------
# 2. The 28 finalized KO matches (16 R32 + 8 R16 + 4 QF).
#    event_ticker suffix parses evenly into two 3-letter codes.
#    Verified against fact-base.json completed_summary results.
# ---------------------------------------------------------------------------
KO_EVENTS = {
    "R32": [
        "KXWCGAME-26JUN28RSACAN", "KXWCGAME-26JUN29BRAJPN", "KXWCGAME-26JUN29GERPAR",
        "KXWCGAME-26JUN29NEDMAR", "KXWCGAME-26JUN30CIVNOR", "KXWCGAME-26JUN30FRASWE",
        "KXWCGAME-26JUN30MEXECU", "KXWCGAME-26JUL01BELSEN", "KXWCGAME-26JUL01ENGCOD",
        "KXWCGAME-26JUL01USABIH", "KXWCGAME-26JUL02ESPAUT", "KXWCGAME-26JUL02PORCRO",
        "KXWCGAME-26JUL02SUIDZA", "KXWCGAME-26JUL03ARGCPV", "KXWCGAME-26JUL03AUSEGY",
        "KXWCGAME-26JUL03COLGHA",
    ],
    "R16": [
        "KXWCGAME-26JUL04CANMAR", "KXWCGAME-26JUL04PARFRA", "KXWCGAME-26JUL05BRANOR",
        "KXWCGAME-26JUL05MEXENG", "KXWCGAME-26JUL06PORESP", "KXWCGAME-26JUL06USABEL",
        "KXWCGAME-26JUL07ARGEGY", "KXWCGAME-26JUL07SUICOL",
    ],
    "QF": [
        "KXWCGAME-26JUL09FRAMAR", "KXWCGAME-26JUL10ESPBEL", "KXWCGAME-26JUL11ARGSUI",
        "KXWCGAME-26JUL11NORENG",
    ],
}
# SF (KXWCGAME-26JUL14FRAESP, KXWCGAME-26JUL15ENGARG): both markets are
# status=active as of the data snapshot (max Kalshi trade/candle ts =
# 2026-07-14T06:34 UTC; max Pinnacle quote ts = 2026-07-14T04:xx UTC for both
# fixtures). SF1 kickoff is 2026-07-14T19:00 UTC (fact-base remaining_schedule)
# -- strictly after the snapshot boundary. Zero SFs are in-window for the
# alignment/price-break analysis below, but both are still entity-mapped
# (Phase 2 will need the join keys once they're played).
SF_EVENTS = ["KXWCGAME-26JUL14FRAESP", "KXWCGAME-26JUL15ENGARG"]

ALL_EVENTS = [(rnd, ev) for rnd, evs in KO_EVENTS.items() for ev in evs]
assert len(ALL_EVENTS) == 28
ALL_EVENTS_WITH_SF = ALL_EVENTS + [("SF", ev) for ev in SF_EVENTS]
assert len(ALL_EVENTS_WITH_SF) == 30

def parse_event(ev):
    # KXWCGAME-26<DATE><C1><C2>, DATE = MON(3) + DD(2), then two 3-letter codes
    tail = ev.split("-26", 1)[1]
    date_part, codes = tail[:5], tail[5:]
    assert len(codes) == 6, f"unexpected code length for {ev}: {codes}"
    return date_part, codes[:3], codes[3:]

rows = []
for rnd, ev in ALL_EVENTS_WITH_SF:
    date_part, c1, c2 = parse_event(ev)
    rows.append({"round": rnd, "kalshi_event_ticker": ev, "date_part": date_part,
                 "team1_code": c1, "team2_code": c2})
match_df = pd.DataFrame(rows)
match_df["team1_name"] = match_df["team1_code"].map(lambda c: TEAMS[c][0])
match_df["team2_name"] = match_df["team2_code"].map(lambda c: TEAMS[c][0])
match_df["team1_poly"] = match_df["team1_code"].map(lambda c: TEAMS[c][1])
match_df["team2_poly"] = match_df["team2_code"].map(lambda c: TEAMS[c][1])
match_df["team1_pinnacle"] = match_df["team1_code"].map(lambda c: TEAMS[c][2])
match_df["team2_pinnacle"] = match_df["team2_code"].map(lambda c: TEAMS[c][2])
match_df["match_id"] = match_df["kalshi_event_ticker"].str.replace("KXWCGAME-26", "", regex=False)

print(match_df[["round", "kalshi_event_ticker", "team1_name", "team2_name"]].to_string())
print(f"\n{len(match_df)} KO matches parsed.")

# ---------------------------------------------------------------------------
# 3. Kalshi leg tickers + regulation result + KXWCADVANCE result
# ---------------------------------------------------------------------------
cat = con.execute(f"""
    select event_ticker, ticker, result, status
    from '{PIPE}/catalog/markets.parquet'
    where series_ticker in ('KXWCGAME','KXWCADVANCE')
""").df()

game = cat[cat["ticker"].str.contains("KXWCGAME")]
adv = cat[cat["ticker"].str.contains("KXWCADVANCE")]

def leg_ticker(event_ticker, suffix):
    return f"{event_ticker}-{suffix}"

reg_results, adv_results, match_status = [], [], []
for _, r in match_df.iterrows():
    ev = r["kalshi_event_ticker"]
    sub = game[game["event_ticker"] == ev]
    res_map = dict(zip(sub["ticker"].str.rsplit("-", n=1).str[-1], sub["result"]))
    if res_map.get("TIE") == "yes":
        reg_winner = "TIE"
    elif res_map.get(r["team1_code"]) == "yes":
        reg_winner = r["team1_code"]
    elif res_map.get(r["team2_code"]) == "yes":
        reg_winner = r["team2_code"]
    else:
        reg_winner = None   # unresolved (active market, e.g. SF not yet played)
    reg_results.append(reg_winner)
    match_status.append("finalized" if reg_winner is not None else "scheduled")

    adv_ev = ev.replace("KXWCGAME", "KXWCADVANCE")
    sub_a = adv[adv["event_ticker"] == adv_ev]
    res_map_a = dict(zip(sub_a["ticker"].str.rsplit("-", n=1).str[-1], sub_a["result"]))
    adv_winner = r["team1_code"] if res_map_a.get(r["team1_code"]) == "yes" else (
        r["team2_code"] if res_map_a.get(r["team2_code"]) == "yes" else None)
    adv_results.append(adv_winner)

match_df["regulation_result"] = reg_results     # team code, "TIE", or None (unresolved)
match_df["advance_result"] = adv_results        # team code that advances, or None (unresolved)
match_df["match_status"] = match_status         # "finalized" | "scheduled"
match_df["went_to_et_or_pens"] = match_df["regulation_result"] == "TIE"

match_df["kalshi_leg_team1"] = match_df.apply(lambda r: leg_ticker(r["kalshi_event_ticker"], r["team1_code"]), axis=1)
match_df["kalshi_leg_team2"] = match_df.apply(lambda r: leg_ticker(r["kalshi_event_ticker"], r["team2_code"]), axis=1)
match_df["kalshi_leg_tie"] = match_df.apply(lambda r: leg_ticker(r["kalshi_event_ticker"], "TIE"), axis=1)
match_df["kalshi_advance_event_ticker"] = match_df["kalshi_event_ticker"].str.replace("KXWCGAME", "KXWCADVANCE", regex=False)

print("\nRegulation-vs-advance cross-check (mismatches only, expect 0 rows beyond outright wins):")
finalized = match_df[match_df["match_status"] == "finalized"]
mismatch = finalized[(finalized["regulation_result"] != "TIE") & (finalized["regulation_result"] != finalized["advance_result"])]
print(mismatch[["kalshi_event_ticker", "regulation_result", "advance_result"]].to_string())
print(f"Finalized matches checked: {len(finalized)}, scheduled/unresolved (SF): {len(match_df) - len(finalized)}")

match_df.to_parquet(f"{OUT_ALIGN}/_match_scaffold.parquet")
print("\nWrote scaffold.")

# ---------------------------------------------------------------------------
# 4. Polymarket join: is_knockout match_moneyline markets, by (match_date, team pair)
# ---------------------------------------------------------------------------
poly = con.execute(f"""
    select event_id, event_title, match_date, group_item_title, market_id, clob_token_ids_json
    from '{PIPE}/benchmarks/polymarket/markets.parquet'
    where is_knockout = true and family = 'match_moneyline'
""").df()
poly["match_date"] = pd.to_datetime(poly["match_date"]).dt.strftime("%Y-%m-%d")

import ast
def yes_token(clob_json):
    toks = json.loads(clob_json)
    return toks[0]  # index 0 = "Yes" side, verified against outcomes_json ["Yes","No"]
def no_token(clob_json):
    toks = json.loads(clob_json)
    return toks[1]

poly["yes_token"] = poly["clob_token_ids_json"].map(yes_token)
poly["no_token"] = poly["clob_token_ids_json"].map(no_token)

poly_events = poly.groupby("event_id").agg(event_title=("event_title","first"), match_date=("match_date","first")).reset_index()

def find_poly_event(team1, team2, date_part_to_iso):
    cand = poly_events[poly_events["event_title"].isin([f"{team1} vs. {team2}", f"{team2} vs. {team1}"])]
    return cand

poly_rows = []
for _, r in match_df.iterrows():
    t1, t2 = r["team1_poly"], r["team2_poly"]
    cand = poly_events[poly_events["event_title"] == f"{t1} vs. {t2}"]
    if cand.empty:
        cand = poly_events[poly_events["event_title"] == f"{t2} vs. {t1}"]
    if cand.empty:
        poly_rows.append({"match_id": r["match_id"], "polymarket_event_id": None,
                           "polymarket_team1_yes_token": None, "polymarket_team2_yes_token": None,
                           "polymarket_draw_yes_token": None, "polymarket_match_found": False})
        continue
    eid = cand.iloc[0]["event_id"]
    sub = poly[poly["event_id"] == eid]
    t1_row = sub[sub["group_item_title"] == t1]
    t2_row = sub[sub["group_item_title"] == t2]
    draw_row = sub[sub["group_item_title"].str.startswith("Draw")]
    poly_rows.append({
        "match_id": r["match_id"],
        "polymarket_event_id": eid,
        "polymarket_team1_yes_token": t1_row["yes_token"].iloc[0] if not t1_row.empty else None,
        "polymarket_team1_market_id": t1_row["market_id"].iloc[0] if not t1_row.empty else None,
        "polymarket_team2_yes_token": t2_row["yes_token"].iloc[0] if not t2_row.empty else None,
        "polymarket_team2_market_id": t2_row["market_id"].iloc[0] if not t2_row.empty else None,
        "polymarket_draw_yes_token": draw_row["yes_token"].iloc[0] if not draw_row.empty else None,
        "polymarket_draw_market_id": draw_row["market_id"].iloc[0] if not draw_row.empty else None,
        "polymarket_match_found": True,
    })
poly_join = pd.DataFrame(poly_rows)
match_df = match_df.merge(poly_join, on="match_id", how="left")
print(f"\nPolymarket matched: {match_df['polymarket_match_found'].sum()}/{len(match_df)}")

# ---------------------------------------------------------------------------
# 5. Pinnacle join: by (participant pair). fixture_start_time used as ground-truth kickoff.
# ---------------------------------------------------------------------------
pin = con.execute(f"""
    select fixture_id, participant1, participant2, any_value(fixture_start_time) fst
    from '{PIPE}/benchmarks/odds/pinnacle.parquet'
    group by 1,2,3
""").df()

pin_rows = []
for _, r in match_df.iterrows():
    t1, t2 = r["team1_pinnacle"], r["team2_pinnacle"]
    cand = pin[(pin["participant1"] == t1) & (pin["participant2"] == t2)]
    if cand.empty:
        cand = pin[(pin["participant1"] == t2) & (pin["participant2"] == t1)]
    if cand.empty:
        pin_rows.append({"match_id": r["match_id"], "pinnacle_fixture_id": None,
                          "pinnacle_kickoff_utc": None, "pinnacle_match_found": False})
        continue
    pin_rows.append({"match_id": r["match_id"], "pinnacle_fixture_id": cand.iloc[0]["fixture_id"],
                      "pinnacle_kickoff_utc": cand.iloc[0]["fst"], "pinnacle_match_found": True})
pin_join = pd.DataFrame(pin_rows)
match_df = match_df.merge(pin_join, on="match_id", how="left")
print(f"Pinnacle matched: {match_df['pinnacle_match_found'].sum()}/{len(match_df)}")

match_df.to_parquet(f"{OUT_ALIGN}/_match_scaffold.parquet")
print("Wrote scaffold with joins.")
print(match_df[["match_id","polymarket_event_id","pinnacle_fixture_id","pinnacle_kickoff_utc"]].to_string())

# ---------------------------------------------------------------------------
# 6. Per-match tick counts + biggest-price-break localization, per source
# ---------------------------------------------------------------------------
from datetime import timedelta

def parse_iso(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))

results = []
break_rows = []
defect_counters = {
    "pinnacle_price_decimal_lt_1_01_rows": 0,
    "pinnacle_total_odds_rows_checked": 0,
    "pinnacle_epoch_second_collisions": 0,
    "polymarket_bogus_terminal_ticks": 0,
    "polymarket_terminal_ticks_checked": 0,
}

# Minimum sustained regime-shift magnitude (probability points) to count as "the
# biggest break" rather than single-tick noise (thin-book Kalshi fills, Pinnacle
# sub-second odds-feed glitches -- see notes). Series are resampled to 1-minute
# bins (last observed value per bin) before diffing, which is what actually makes
# the three sources comparable: Polymarket's native fidelity is already 1-minute,
# Pinnacle and Kalshi are tick-level and would otherwise dominate spuriously.
BREAK_THRESHOLD = 0.15

def biggest_break_1min(df, time_col, group_col, value_col, win_start, win_end):
    """Resample each group to 1-min bins (last value), return the single largest
    bin-to-bin jump across all groups as (bin_end_ts, group, magnitude)."""
    best_ts, best_group, best_mag = None, None, 0.0
    sub = df[(df[time_col] >= win_start) & (df[time_col] <= win_end)]
    for g, gdf in sub.groupby(group_col):
        s = gdf.set_index(time_col)[value_col].sort_index()
        if len(s) < 2:
            continue
        binned = s.resample("1min").last().ffill()
        diffs = binned.diff().abs()
        if diffs.dropna().empty:
            continue
        idx = diffs.idxmax()
        mag = diffs.loc[idx]
        if pd.notna(mag) and mag > best_mag:
            best_mag, best_ts, best_group = mag, idx, g
    return best_ts, best_group, best_mag

ko_matches_only = match_df[match_df["match_status"] == "finalized"]
sf_matches = match_df[match_df["match_status"] == "scheduled"]
print(f"\nRunning tick/break analysis on {len(ko_matches_only)} finalized matches; "
      f"skipping {len(sf_matches)} scheduled/unplayed (SF, not yet in-window): "
      f"{sf_matches['match_id'].tolist()}")

for _, r in ko_matches_only.iterrows():
    match_id = r["match_id"]
    kickoff = parse_iso(r["pinnacle_kickoff_utc"])
    win_start = kickoff - timedelta(minutes=30)
    win_end = kickoff + timedelta(hours=3, minutes=45)

    # ---- Kalshi: trades across 3 legs ----
    legs = [r["kalshi_leg_team1"], r["kalshi_leg_team2"], r["kalshi_leg_tie"]]
    kt = con.execute(f"""
        select ticker, created_time, yes_price_usd
        from '{PIPE}/kalshi/trades/series_ticker=KXWCGAME/*.parquet'
        where ticker in ({",".join(f"'{l}'" for l in legs)})
        order by created_time
    """).df()
    kt["created_time"] = pd.to_datetime(kt["created_time"], format="ISO8601", utc=True)
    kalshi_n_ticks = len(kt)
    kt_win = kt[(kt["created_time"] >= win_start) & (kt["created_time"] <= win_end)]
    kalshi_n_inmatch = len(kt_win)

    kalshi_break_ts, kalshi_break_leg, kalshi_break_mag = biggest_break_1min(
        kt_win, "created_time", "ticker", "yes_price_usd", win_start, win_end)

    # ---- Polymarket: 3 "yes" tokens, fidelity=1 ----
    toks = [t for t in [r["polymarket_team1_yes_token"], r["polymarket_team2_yes_token"], r["polymarket_draw_yes_token"]] if t]
    poly_n_ticks, poly_n_inmatch = 0, 0
    poly_break_ts, poly_break_tok, poly_break_mag = None, None, 0.0
    poly_last_ticks = {}
    if toks:
        pt = con.execute(f"""
            select token_id, ts_utc, implied_prob
            from '{PIPE}/benchmarks/polymarket/prices/priority_tier=1/fidelity=1/*.parquet'
            where token_id in ({",".join(f"'{t}'" for t in toks)})
            order by ts_utc
        """).df()
        pt["ts_dt"] = pd.to_datetime(pt["ts_utc"], unit="s", utc=True)
        poly_n_ticks = len(pt)
        pt_win = pt[(pt["ts_dt"] >= win_start) & (pt["ts_dt"] <= win_end)]
        poly_n_inmatch = len(pt_win)
        poly_break_ts, poly_break_tok, poly_break_mag = biggest_break_1min(
            pt_win, "ts_dt", "token_id", "implied_prob", win_start, win_end)
        for tok in toks:
            all_sub = pt[pt["token_id"] == tok].sort_values("ts_dt")
            if len(all_sub):
                poly_last_ticks[tok] = (all_sub.iloc[-1]["ts_dt"], all_sub.iloc[-1]["implied_prob"])

    # bogus-terminal-tick check: after settlement, the LAST tick for the LOSING outcome's
    # yes-token should be near 0, and the winning outcome's near 1. Flag if not.
    if r["polymarket_match_found"]:
        winner_code = r["advance_result"] if r["went_to_et_or_pens"] else r["regulation_result"]
        # winner_code is a Kalshi team code; map to which polymarket token is the "winner" side (moneyline is regulation-only, so use regulation_result for reg-time market semantics)
        reg_winner_code = r["regulation_result"]  # "TIE" or team code
        for tok, label in [(r["polymarket_team1_yes_token"], r["team1_code"]),
                            (r["polymarket_team2_yes_token"], r["team2_code"]),
                            (r["polymarket_draw_yes_token"], "TIE")]:
            if tok not in poly_last_ticks:
                continue
            defect_counters["polymarket_terminal_ticks_checked"] += 1
            last_ts, last_p = poly_last_ticks[tok]
            expect_high = (label == reg_winner_code)
            bogus = (expect_high and last_p < 0.9) or ((not expect_high) and last_p > 0.1)
            if bogus:
                defect_counters["polymarket_bogus_terminal_ticks"] += 1
                break_rows.append({"match_id": match_id, "source": "polymarket_terminal_check",
                                    "note": f"token={tok[:16]}... label={label} last_ts={last_ts} last_p={last_p} expect_high={expect_high}"})

    # ---- Pinnacle: pinnacle bookmaker, Full Time Result, 3 outcomes ----
    fid = r["pinnacle_fixture_id"]
    pin_raw = con.execute(f"""
        select outcome_id, created_at, price_decimal
        from '{PIPE}/benchmarks/odds/pinnacle.parquet'
        where fixture_id = '{fid}' and bookmaker='pinnacle' and market_name='Full Time Result'
        order by created_at
    """).df()
    pin_total_raw = len(pin_raw)
    defect_counters["pinnacle_total_odds_rows_checked"] += pin_total_raw
    lt_bad = (pin_raw["price_decimal"] < 1.01).sum()
    defect_counters["pinnacle_price_decimal_lt_1_01_rows"] += int(lt_bad)
    pin_clean = pin_raw[pin_raw["price_decimal"] >= 1.01].copy()
    pin_clean["created_dt"] = pd.to_datetime(pin_clean["created_at"], format="ISO8601", utc=True)
    pin_clean["implied_prob"] = 1.0 / pin_clean["price_decimal"]
    # ms-precision dedup check: how many rows collide at 1-second resolution but differ at ms
    pin_clean["epoch_sec"] = pin_clean["created_dt"].astype("int64") // 10**9
    collisions = pin_clean.groupby(["outcome_id", "epoch_sec"]).size()
    defect_counters["pinnacle_epoch_second_collisions"] += int((collisions > 1).sum())

    pin_n_ticks = len(pin_clean)
    pin_win = pin_clean[(pin_clean["created_dt"] >= win_start) & (pin_clean["created_dt"] <= win_end)]
    pin_n_inmatch = len(pin_win)

    pin_break_ts, pin_break_outcome, pin_break_mag = biggest_break_1min(
        pin_win, "created_dt", "outcome_id", "implied_prob", win_start, win_end)

    # ---- cross-source skew at the biggest break ----
    # Only count a source's break as a real inflection if it clears BREAK_THRESHOLD;
    # sub-threshold "biggest jump" (e.g. a slow 1-0 win with no single dominant
    # repricing moment) is noise, not a located event -- exclude from skew.
    below_threshold = []
    if kalshi_break_mag < BREAK_THRESHOLD:
        below_threshold.append("kalshi"); kalshi_break_ts = None
    if poly_break_mag < BREAK_THRESHOLD:
        below_threshold.append("polymarket"); poly_break_ts = None
    if pin_break_mag < BREAK_THRESHOLD:
        below_threshold.append("pinnacle"); pin_break_ts = None

    ts_list = [("kalshi", kalshi_break_ts), ("polymarket", poly_break_ts), ("pinnacle", pin_break_ts)]
    ts_valid = [(s, t) for s, t in ts_list if t is not None]
    max_skew_s = None
    skew_pairs = {}
    if len(ts_valid) >= 2:
        for i in range(len(ts_valid)):
            for j in range(i + 1, len(ts_valid)):
                s1, t1 = ts_valid[i]
                s2, t2 = ts_valid[j]
                t1n = pd.Timestamp(t1)
                if t1n.tzinfo is None:
                    t1n = t1n.tz_localize("UTC")
                t2n = pd.Timestamp(t2)
                if t2n.tzinfo is None:
                    t2n = t2n.tz_localize("UTC")
                diff_s = abs((t1n - t2n).total_seconds())
                skew_pairs[f"{s1}_vs_{s2}_seconds"] = diff_s
        max_skew_s = max(skew_pairs.values())

    results.append({
        "match_id": match_id, "round": r["round"], "kickoff_utc": kickoff.isoformat(),
        "team1": r["team1_name"], "team2": r["team2_name"],
        "regulation_result": r["regulation_result"], "advance_result": r["advance_result"],
        "went_to_et_or_pens": r["went_to_et_or_pens"],
        "kalshi_n_ticks": kalshi_n_ticks, "kalshi_n_ticks_inmatch": kalshi_n_inmatch,
        "polymarket_n_ticks": poly_n_ticks, "polymarket_n_ticks_inmatch": poly_n_inmatch,
        "pinnacle_n_ticks": pin_n_ticks, "pinnacle_n_ticks_inmatch": pin_n_inmatch,
        "pinnacle_n_ticks_raw_before_filter": pin_total_raw,
        "kalshi_break_ts": str(kalshi_break_ts) if kalshi_break_ts is not None else None,
        "kalshi_break_mag": round(float(kalshi_break_mag), 4),
        "polymarket_break_ts": str(poly_break_ts) if poly_break_ts is not None else None,
        "polymarket_break_mag": round(float(poly_break_mag), 4),
        "pinnacle_break_ts": str(pin_break_ts) if pin_break_ts is not None else None,
        "pinnacle_break_mag": round(float(pin_break_mag), 4),
        "max_skew_seconds": max_skew_s,
        "sources_below_break_threshold": ",".join(below_threshold) if below_threshold else None,
        "n_sources_with_located_break": len(ts_valid),
        **skew_pairs,
    })
    skew_disp = f"{max_skew_s:8.1f}s" if max_skew_s is not None else "    n/a "
    print(f"{match_id:14s} K={kalshi_n_ticks:6d} P={poly_n_ticks:6d} PN={pin_n_ticks:6d}  "
          f"breaks={3-len(below_threshold)}/3  skew={skew_disp}  below={below_threshold}")

align_df = pd.DataFrame(results)
align_df.to_parquet(f"{OUT_ALIGN}/match_alignment.parquet")
align_df.to_csv(f"{OUT_ALIGN}/match_alignment.csv", index=False)
print(f"\nWrote {OUT_ALIGN}/match_alignment.parquet ({len(align_df)} rows)")
print("\nDefect counters:", json.dumps(defect_counters, indent=2))

with open(f"{OUT_ALIGN}/defect_validation.json", "w") as f:
    json.dump({
        "defect_counters": defect_counters,
        "regulation_vs_advance_mismatches": len(mismatch),
        "regulation_vs_advance_matches_checked": len(finalized),
        "polymarket_terminal_check_flags": break_rows,
    }, f, indent=2, default=str)
print(f"Wrote {OUT_ALIGN}/defect_validation.json")

# ---------------------------------------------------------------------------
# 7. Canonical entity-mapping table (all 30 KO matches incl. 2 unplayed SF)
# ---------------------------------------------------------------------------
entity_cols = [
    "match_id", "round", "match_status", "team1_code", "team2_code", "team1_name", "team2_name",
    "kalshi_event_ticker", "kalshi_leg_team1", "kalshi_leg_team2", "kalshi_leg_tie",
    "kalshi_advance_event_ticker",
    "regulation_result", "advance_result", "went_to_et_or_pens",
    "polymarket_event_id", "polymarket_match_found",
    "polymarket_team1_market_id", "polymarket_team1_yes_token",
    "polymarket_team2_market_id", "polymarket_team2_yes_token",
    "polymarket_draw_market_id", "polymarket_draw_yes_token",
    "pinnacle_fixture_id", "pinnacle_kickoff_utc", "pinnacle_match_found",
]
entity_map = match_df[entity_cols].copy()
entity_map["unmappable"] = ~(entity_map["polymarket_match_found"].fillna(False) & entity_map["pinnacle_match_found"].fillna(False))
entity_map.to_parquet(OUT_ENTITY)
print(f"\nWrote {OUT_ENTITY} ({len(entity_map)} rows, {entity_map['unmappable'].sum()} unmappable)")

# ---------------------------------------------------------------------------
# 8. Act-3 sanity check: July 5 Norway-Brazil, four calibration inputs on one
#    shared moment (tournament-WINNER-market collapse for Brazil, not the
#    match-moneyline -- distinct from the per-match alignment above).
# ---------------------------------------------------------------------------
def resample_break(ts_series, val_series, freq="1min"):
    s = pd.Series(val_series.values, index=pd.DatetimeIndex(ts_series)).sort_index()
    binned = s.resample(freq).last().ffill()
    diffs = binned.diff().abs()
    if diffs.dropna().empty:
        return None, 0.0
    idx = diffs.idxmax()
    return idx, float(diffs.loc[idx])

cal_window_start = pd.Timestamp("2026-07-05T19:00:00Z")
cal_window_end = pd.Timestamp("2026-07-05T23:00:00Z")

# (a) Kalshi tournament-winner Brazil leg (KXMENWORLDCUP-26-BR)
kmw = con.execute(f"""
    select created_time, yes_price_usd from '{PIPE}/kalshi/trades/series_ticker=KXMENWORLDCUP/*.parquet'
    where ticker = 'KXMENWORLDCUP-26-BR'
      and created_time >= '2026-07-05T18:30:00' and created_time <= '2026-07-05T23:30:00'
    order by created_time
""").df()
kmw["created_time"] = pd.to_datetime(kmw["created_time"], format="ISO8601", utc=True)
kmw_pre = kmw[kmw["created_time"] <= cal_window_start]["yes_price_usd"]
kmw_post = kmw[kmw["created_time"] >= pd.Timestamp("2026-07-05T22:00:00Z")]["yes_price_usd"]  # last trades ~22:17Z, no activity by 23:00
kalshi_winner_break_ts, kalshi_winner_break_mag = resample_break(kmw["created_time"], kmw["yes_price_usd"])

# (b) Polymarket tournament-winner Brazil token
poly_winner = con.execute(f"""
    select market_id, group_item_title, clob_token_ids_json from '{PIPE}/benchmarks/polymarket/markets.parquet'
    where family='winner' and group_item_title = 'Brazil'
""").df()
poly_winner_tok = json.loads(poly_winner.iloc[0]["clob_token_ids_json"])[0]
pmw = con.execute(f"""
    select ts_utc, implied_prob from '{PIPE}/benchmarks/polymarket/prices/priority_tier=0/fidelity=1/*.parquet'
    where token_id = '{poly_winner_tok}'
    order by ts_utc
""").df()
pmw["ts"] = pd.to_datetime(pmw["ts_utc"], unit="s", utc=True)
pmw_win = pmw[(pmw["ts"] >= "2026-07-05T18:30:00Z") & (pmw["ts"] <= "2026-07-05T23:30:00Z")]
pmw_pre = pmw[pmw["ts"] <= cal_window_start]["implied_prob"]
pmw_post = pmw[pmw["ts"] >= cal_window_end]["implied_prob"]
poly_winner_break_ts, poly_winner_break_mag = resample_break(pmw_win["ts"], pmw_win["implied_prob"])

# (c) Pinnacle in-match repricing for the BRANOR fixture itself (from match_alignment)
branor_row = align_df[align_df["match_id"] == "JUL05BRANOR"].iloc[0]

# (d) Opta pre/post-R16 snapshots bracketing July 5
opta_brazil = con.execute(f"""
    select stage_id, stage_label, as_of_date, metric, value_pct
    from '{PIPE}/benchmarks/opinion/opta.parquet'
    where team = 'Brazil' order by stage_id
""").df()
opta_norway = con.execute(f"""
    select distinct stage_id, stage_label, as_of_date from '{PIPE}/benchmarks/opinion/opta.parquet'
    where team = 'Norway' and stage_id in (3,4) order by stage_id
""").df()

calibration_check = {
    "shared_event": "Norway 2-1 Brazil, R16, kickoff 2026-07-05T20:00:00Z, Norway wins in regulation",
    "a_kalshi_tournament_winner_leg": {
        "ticker": "KXMENWORLDCUP-26-BR",
        "pre_match_price": float(kmw_pre.iloc[-1]) if len(kmw_pre) else None,
        "post_match_price": float(kmw_post.iloc[0]) if len(kmw_post) else None,
        "biggest_1min_break_ts": str(kalshi_winner_break_ts),
        "biggest_1min_break_mag": round(kalshi_winner_break_mag, 4),
    },
    "b_polymarket_winner_token": {
        "market_id": str(poly_winner.iloc[0]["market_id"]),
        "token": poly_winner_tok,
        "pre_match_prob": float(pmw_pre.iloc[-1]) if len(pmw_pre) else None,
        "post_match_prob": float(pmw_post.iloc[0]) if len(pmw_post) else None,
        "biggest_1min_break_ts": str(poly_winner_break_ts),
        "biggest_1min_break_mag": round(poly_winner_break_mag, 4),
    },
    "c_pinnacle_inmatch_repricing_branor_fixture": {
        "fixture_id": str(branor_row["match_id"]),
        "biggest_1min_break_ts": branor_row["pinnacle_break_ts"],
        "biggest_1min_break_mag": float(branor_row["pinnacle_break_mag"]),
    },
    "d_opta_pre_post_r16_snapshot": {
        "brazil_trajectory": opta_brazil.to_dict(orient="records"),
        "norway_trajectory": opta_norway.to_dict(orient="records"),
        "interpretation": "Brazil win_pct=9.1% at stage 3 (post_r32_pre_r16, as_of 2026-07-04, pre-match); "
                           "Brazil absent from stage 4 (post_r16_pre_qf, as_of 2026-07-08) roster -- elimination "
                           "correctly bracketed. Norway present in stage 4 (survived to QF).",
    },
    "cross_source_break_skew_seconds": {
        "kalshi_winner_vs_poly_winner": abs((pd.Timestamp(kalshi_winner_break_ts) - pd.Timestamp(poly_winner_break_ts)).total_seconds())
            if kalshi_winner_break_ts is not None and poly_winner_break_ts is not None else None,
        "kalshi_winner_vs_pinnacle_match": abs((pd.Timestamp(kalshi_winner_break_ts) - pd.Timestamp(branor_row["pinnacle_break_ts"])).total_seconds())
            if kalshi_winner_break_ts is not None and branor_row["pinnacle_break_ts"] is not None else None,
    },
}
with open(f"{OUT_ALIGN}/norway_brazil_calibration.json", "w") as f:
    json.dump(calibration_check, f, indent=2, default=str)
print(f"\nWrote {OUT_ALIGN}/norway_brazil_calibration.json")
print(json.dumps(calibration_check, indent=2, default=str))
