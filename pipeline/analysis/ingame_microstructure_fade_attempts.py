"""
ARM: In-game microstructure, addendum -- Gate-5 item 8 ("the fading beat").

The main ingame_microstructure.py arm measured whether fading a post-goal
price would have PAID (overreaction_fade.parquet: it would not have --
post-goal levels held within a couple of cents, under trading fees). It
never asked whether anyone TRIED. This script closes that gap: for each of
the 82 matched repricing events in reaction_latency.parquet, it looks at
the taker side of every trade in the ten minutes after the event and asks
what share of that money bet against the direction the price had just
moved.

Method (Gate-5 item 8, task spec verbatim):
  1. Anchor on reaction_latency.parquet's own t0 and kalshi_pre/kalshi_post
     (the same 82 events, same pre/post levels already adversarially
     verified by the main arm -- not re-derived by a second code path).
  2. Jump direction = sign(kalshi_post - kalshi_pre). One event (JUL02ESPAUT,
     team1, t0 2026-07-02 19:28 UTC) has kalshi_post == kalshi_pre exactly
     (0.70 both) -- the leg that triggered detection round-tripped back to
     its pre-level by the post window, so it has no net direction to fade
     against. Excluded, reason recorded.
  3. Pull every KXWCGAME trade on that event's own leg ticker (via
     entity_map.parquet's kalshi_leg_{team1,team2,tie} columns) in
     [t0+60s, t0+10min]. This is a fresh window, not reaction_latency's
     [t0+3min, t0+8min] settled-level window: it captures the full ten
     minutes of post-goal trading, not just the interval used to locate
     the settled price.
  4. CONTRARIAN volume = contracts (count_contracts, per R6: trade-tape
     sums, never the catalog volume field) whose taker_side sits against
     the jump direction. taker_side and taker_outcome_side are identical
     on every row of this store (verified below) -- buying yes contracts
     is a bet the leg's outcome happens; buying no is a bet it does not.
     After an up-move (the leg got more likely), a taker who buys no is
     betting the price gives some of that back: contrarian. After a
     down-move, a taker who buys yes is betting it recovers: contrarian.
       direction == up   -> contrarian iff taker_side == "no"
       direction == down -> contrarian iff taker_side == "yes"
  5. Per-event contrarian share = contrarian contracts / total contracts
     in the window. Events with zero trades in the window are excluded,
     reason recorded (none expected on KXWCGAME's most liquid legs, but
     checked, not assumed).
  6. Summary = median and interquartile range (25th/75th percentile) of
     the per-event contrarian share across all events with a defined
     share.

Defect rules applied: R6 (count_contracts, not catalog volume). No R1-R3
filtering needed -- this arm only touches Kalshi's own tape, which the
main arm's dedup/glitch rules (R1-R3) were written for Pinnacle, not
Kalshi (Kalshi ticks carry no known duplicate/glitch defect in this store).

Run: pipeline/.venv/bin/python pipeline/analysis/ingame_microstructure_fade_attempts.py
Output: pipeline/data/analysis/ingame-microstructure/fade_attempts.json
Methods note: research/analysis/ingame-microstructure-methods.md sec 2 (source
of t0 / pre / post convention this script anchors on).
"""
import json
import os

import duckdb
import numpy as np
import pandas as pd

ROOT = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026"
PIPE = f"{ROOT}/pipeline/data"
OUT = f"{PIPE}/analysis/ingame-microstructure"

con = duckdb.connect()

print("=" * 70)
print("Gate-5 item 8: fade-attempts (contrarian post-goal flow share)")
print("=" * 70)

lat = pd.read_parquet(f"{OUT}/reaction_latency.parquet")
assert len(lat) == 82, f"expected 82 matched events, got {len(lat)}"

em = con.execute(f"select * from '{PIPE}/audit/entity_map.parquet' where match_status='finalized'").df()
em_idx = em.set_index("match_id")
LEG_COL = {"team1": "kalshi_leg_team1", "team2": "kalshi_leg_team2", "tie": "kalshi_leg_tie"}

# Sanity check on the field mapping this script relies on: taker_side and
# taker_outcome_side must agree on every KXWCGAME row, or the "contrarian"
# label below would be wrong. Checked directly, not assumed.
sample = con.execute(f"""
    select taker_side, taker_outcome_side
    from '{PIPE}/kalshi/trades/series_ticker=KXWCGAME/*.parquet'
    where taker_side != taker_outcome_side
""").df()
assert len(sample) == 0, f"taker_side/taker_outcome_side disagree on {len(sample)} rows -- mapping assumption broken"
print("taker_side == taker_outcome_side on every KXWCGAME row: confirmed. "
      "Using taker_side as the field ('yes' = taker bought yes contracts, "
      "'no' = taker bought no contracts).")

rows = []
n_flat = 0
n_no_trades = 0

for _, e in lat.iterrows():
    match_id, leg, t0 = e["match_id"], e["leg"], e["t0"]
    kpre, kpost = e["kalshi_pre"], e["kalshi_post"]
    ticker = em_idx.loc[match_id, LEG_COL[leg]]

    rec = {
        "match_id": match_id, "leg": leg, "ticker": ticker,
        "t0": pd.Timestamp(t0).isoformat(), "kalshi_pre": float(kpre), "kalshi_post": float(kpost),
    }

    if kpost == kpre:
        rec.update({"direction": None, "excluded_reason": "zero_net_repricing_pre_eq_post",
                    "window_trades": None, "window_contracts": None,
                    "contrarian_contracts": None, "contrarian_share": None})
        rows.append(rec)
        n_flat += 1
        continue

    direction = "up" if kpost > kpre else "down"
    win_lo = pd.Timestamp(t0) + pd.Timedelta(seconds=60)
    win_hi = pd.Timestamp(t0) + pd.Timedelta(minutes=10)

    tw = con.execute(f"""
        select taker_side, count_contracts
        from '{PIPE}/kalshi/trades/series_ticker=KXWCGAME/{ticker}.parquet'
        where created_ts >= {int(win_lo.timestamp())} and created_ts <= {int(win_hi.timestamp())}
    """).df()

    total_contracts = float(tw["count_contracts"].sum())
    if len(tw) == 0 or total_contracts <= 0:
        rec.update({"direction": direction, "excluded_reason": "no_trades_in_window",
                    "window_trades": int(len(tw)), "window_contracts": total_contracts,
                    "contrarian_contracts": None, "contrarian_share": None})
        rows.append(rec)
        n_no_trades += 1
        continue

    contrarian_side = "no" if direction == "up" else "yes"
    contrarian_contracts = float(tw.loc[tw["taker_side"] == contrarian_side, "count_contracts"].sum())
    contrarian_share = contrarian_contracts / total_contracts

    rec.update({
        "direction": direction, "excluded_reason": None,
        "window_trades": int(len(tw)), "window_contracts": total_contracts,
        "contrarian_contracts": contrarian_contracts, "contrarian_share": round(contrarian_share, 6),
    })
    rows.append(rec)

df = pd.DataFrame(rows)
valid = df[df["excluded_reason"].isna()]
print(f"\n{len(df)} events total; {len(valid)} with a defined contrarian share "
      f"({n_flat} excluded: flat leg (pre==post); {n_no_trades} excluded: no trades in window)")

shares = valid["contrarian_share"].values.astype(float)
summary = {
    "n_events_total": int(len(df)),
    "n_events_used": int(len(valid)),
    "n_excluded_flat_leg": int(n_flat),
    "n_excluded_no_trades": int(n_no_trades),
    "median_contrarian_share": round(float(np.median(shares)), 4),
    "p25_contrarian_share": round(float(np.percentile(shares, 25)), 4),
    "p75_contrarian_share": round(float(np.percentile(shares, 75)), 4),
    "mean_contrarian_share": round(float(np.mean(shares)), 4),
    "window": "t0+60s to t0+10min, Kalshi KXWCGAME trades on the event's own leg",
}
print("\nSummary:")
for k, v in summary.items():
    print(f"  {k}: {v}")

out_rows = df.to_dict(orient="records")
payload = {
    "method": {
        "description": (
            "Per matched repricing event (reaction_latency.parquet, 82 events), the share of "
            "money traded on that event's own Kalshi leg in the ten minutes after the goal "
            "(t0+60s to t0+10min) that bet AGAINST the direction the price had just moved "
            "(a 'fade' attempt), versus with it."
        ),
        "direction_rule": "sign(kalshi_post - kalshi_pre) from reaction_latency.parquet's own pre/post levels",
        "contrarian_rule": "taker_side == 'no' when direction == 'up'; taker_side == 'yes' when direction == 'down'",
        "window": "[t0+60s, t0+10min], inclusive, Kalshi KXWCGAME trades on the event's own leg ticker",
        "volume_measure": "count_contracts (R6: trade-tape sums, not catalog volume)",
        "exclusions": {
            "zero_net_repricing_pre_eq_post": "kalshi_post == kalshi_pre; no direction to fade against",
            "no_trades_in_window": "zero KXWCGAME trades on this leg in [t0+60s, t0+10min]",
        },
        "source": "pipeline/data/analysis/ingame-microstructure/reaction_latency.parquet (t0, kalshi_pre, kalshi_post); "
                   "pipeline/data/audit/entity_map.parquet (leg ticker); "
                   "pipeline/data/kalshi/trades/series_ticker=KXWCGAME/*.parquet (taker_side, count_contracts)",
    },
    "summary": summary,
    "events": out_rows,
}

out_path = f"{OUT}/fade_attempts.json"
with open(out_path, "w") as f:
    json.dump(payload, f, indent=2, default=str)
print(f"\nWrote {out_path}")
