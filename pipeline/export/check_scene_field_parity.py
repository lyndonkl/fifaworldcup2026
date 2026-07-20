#!/usr/bin/env python3
"""
pipeline/export/check_scene_field_parity.py -- tiny field-parity checker.

For each scene in SCENE_READ_SETS below, the path list was derived by
manually reading that scene's docs/js/scenes/sNN.js module (every
`data.scene.xxx` / `sceneJson.xxx` / `sj.xxx` dereference in scales()/
layout()/overlay()), not guessed. This script loads the corresponding
docs/data/scenes/sNN.json and asserts every path in the read-set resolves
to a present (non-missing) key. It does not check value *shapes* beyond
"array where an array is iterated" -- it is a presence/parity smoke test,
not a type checker.

Run: pipeline/.venv/bin/python pipeline/export/check_scene_field_parity.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_DIR = os.path.join(ROOT, "docs", "data", "scenes")

MISSING = object()


def get_path(obj, path):
    """path like 'a.b.c' or 'a.b[]' (trailing [] asserts obj at a.b is a list)."""
    is_list = path.endswith("[]")
    if is_list:
        path = path[:-2]
    cur = obj
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return MISSING
        cur = cur[part]
    if is_list and not isinstance(cur, list):
        return f"NOT_A_LIST(type={type(cur).__name__})"
    return cur


# Read-sets below are the exact field paths each scene module dereferences
# from its scene JSON, per a manual read of docs/js/scenes/sNN.js at the
# time of this build pass. (Fields present in JSON but not read by the
# module -- e.g. s05's gini_pooled/gini_within_family, kept for provenance
# -- are intentionally NOT asserted here; this checks the module's needs,
# not the payload's completeness.)
SCENE_READ_SETS = {
    "s03": ["day1_end", "crossover_end", "press_floor.usd", "press_floor.label"],
    "s04": ["grid.day0", "grid.days", "in_window[]", "kickoff_hist.hours[]",
            "rest_days[]", "waking_band.start_hour", "waking_band.end_hour"],
    "s05": ["total_markets", "core_series.legs", "core_series.share_pct",
            "tail.markets", "tail.share_pct", "novelty_market.n_markets",
            "novelty_market.contracts"],
    "s06": ["window.kickoff_ts", "rate_curve[]", "size_sparkline[]",
            "kickoff_step_multiplier", "size_growth_pct"],
    "s07": ["event.goal_ts", "event.label", "friction_band_c",
            "pinnacle.quotes[]", "pinnacle.suspend_start_s", "pinnacle.suspend_end_s",
            "polymarket.blocks[]"],
    "s08": ["window.whistle_ts"],
    "s09": ["shocks[]", "annotations[]"],
    "s10": ["knockout_window.start", "knockout_window.end",
            "gap_summary.mean_1min_gap_pts",
            "braid.t[]", "braid.kalshi_pts[]", "braid.polymarket_pts[]", "braid.pinnacle_pts[]",
            "goal_spikes[]", "pinnacle_terminations[]"],
    "s12": ["date_range.start_s", "date_range.end_s", "players[]",
            "annotations.july7_8_level.day_s_start",
            "annotations.kane_halving.after_day_s",
            "annotations.assist_tiebreak.text"],
    "s13": ["pairs[]", "host_peers.teams[]", "host_peers.pretournament_cutoff_s",
            "zombie_money.n_trades", "zombie_money.total_usd", "zombie_money.max_price_c"],
    "s14": ["buckets[]", "ladder_attribution.pct_in_ten_plus_leg_ladders",
            "ladder_attribution.pct_at_tick_floor", "tick_floor.lo_c", "tick_floor.hi_c",
            "worst_bucket_label"],
    "s15": ["stages[]"],
    "s19": ["exam_restated.legs[]",
            "settlement.champion_futures_last_trade.price_c",
            "settlement.runner_up_futures_last_trade.price_c",
            "tie_climb.points[]",
            "tie_climb.headline_half_hour.window_utc[]",
            "tie_climb.headline_half_hour.n_trades",
            "tie_climb.headline_half_hour.mean_price_c",
            "tie_climb.kickoff_utc",
            "spain_vs_model.stages[]",
            "next_belief.markets[]",
            "next_belief.n_markets",
            "next_belief.gap_from_champion_futures_settlement_s"],
}

# Per-item required sub-fields for scenes whose read-set includes player/
# bucket/row ROWS with their own required keys (s12.players[], s14.buckets[],
# s19's four row-arrays). Each scene maps to a LIST of (path, sub_fields)
# pairs -- s19 needs four independent row-arrays checked, not just one.
ROW_SUBFIELDS = {
    "s12": [("players", ["key", "label", "reference", "market_indices"])],
    "s14": [("buckets", ["label", "lo_c", "hi_c", "mean_price_c", "win_rate_pct"])],
    "s15": [("stages", ["id", "label", "window", "opta_pct"])],
    "s19": [
        ("exam_restated.legs", ["label", "price_c", "devig_pct"]),
        ("tie_climb.points", ["minute", "tie_price_c"]),
        ("spain_vs_model.stages", ["id", "label", "france", "spain"]),
        ("next_belief.markets", ["team", "dollars"]),
    ],
}


def main():
    total_checks = 0
    failures = []
    for sid, paths in SCENE_READ_SETS.items():
        path = os.path.join(SCENES_DIR, f"{sid}.json")
        if not os.path.exists(path):
            failures.append(f"{sid}: file missing at {path}")
            continue
        with open(path) as f:
            try:
                doc = json.load(f)
            except Exception as e:
                failures.append(f"{sid}: JSON parse failure: {e}")
                continue
        for p in paths:
            total_checks += 1
            v = get_path(doc, p)
            if v is MISSING:
                failures.append(f"{sid}: MISSING field '{p}'")
            elif isinstance(v, str) and v.startswith("NOT_A_LIST"):
                failures.append(f"{sid}: field '{p}' {v}")

        if sid in ROW_SUBFIELDS:
            for arr_key, sub_fields in ROW_SUBFIELDS[sid]:
                rows = get_path(doc, arr_key)
                total_checks += 1
                if rows is MISSING or not isinstance(rows, list) or not rows:
                    failures.append(f"{sid}: '{arr_key}' is empty or missing, cannot verify row sub-fields")
                else:
                    for sf in sub_fields:
                        total_checks += 1
                        if sf not in rows[0]:
                            failures.append(f"{sid}: row in '{arr_key}[0]' missing sub-field '{sf}'")

    print(f"=== {total_checks} field-presence checks across {len(SCENE_READ_SETS)} scenes ===")
    if failures:
        for f in failures:
            print(f"  FAIL: {f}")
        print(f"\n{len(failures)} FAILURES")
        sys.exit(1)
    print("ALL SCENE FIELD-PARITY CHECKS PASSED")


if __name__ == "__main__":
    main()
