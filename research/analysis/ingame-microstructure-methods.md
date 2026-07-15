# In-game microstructure — methods note

**Arm:** what does a goal do to money? **Scope:** the 28 played knockout matches
(`pipeline/data/audit/entity_map.parquet`, `match_status=='finalized'`). Both
semifinals are correctly out of window (G1/G2 in `research/data-audit.md`).
**Pipeline:** `pipeline/analysis/ingame_microstructure.py` (single reproducible
script, re-run with `pipeline/.venv/bin/python pipeline/analysis/ingame_microstructure.py`).
**Outputs:** `pipeline/data/analysis/ingame-microstructure/*.parquet`.

## 1. Goal/event detection — how "goal minutes" were inferred

`research/fact-base.json` has no structured goal-minute data (only prose
storylines), and the task brief explicitly calls for inferring event timestamps
from the tape's own break structure. Method:

1. For each match, resample Kalshi's `team1`/`team2`/`tie` leg trades
   (`KXWCGAME` series) to 1-minute bins (last value per bin, matching the
   existing audit's R7 convention in `pipeline/analysis/audit_cross_source_alignment.py`).
2. Compute **total variation** per bin: `TV_t = (|Δp_team1| + |Δp_team2| + |Δp_tie|) / 2`
   — this catches any reallocation of probability mass among the three mutually
   exclusive outcomes, regardless of which leg moves (a tie-breaking goal shows
   up as clearly as an outright-win goal).
3. Peak-detect: adaptive threshold = `max(0.08, median(TV) + 4·MAD(TV))` per
   match, greedy-select peaks with ≥4-minute separation. `JUL07SUICOL` (0-0,
   decided on penalties) correctly locates **zero** events — the same null-result
   sanity check the original audit used, now reproduced independently.
4. **Result: 82 candidate events across 27/28 matches** (mean 3.0/match, range
   1–7). Each event is corroborated against Polymarket (±15 min window) and
   Pinnacle (±90 min window) using a **time-nearest** (not magnitude-largest)
   qualifying same-direction jump — magnitude-largest was tried first and
   rejected: at a wide window it lets a later Kalshi event "steal" an earlier,
   bigger jump belonging to a *different* goal in multi-goal matches (caught on
   `JUL01USABIH`, `JUN30FRASWE`). **82/82 events get ≥2-source corroboration**
   at floors of 0.04pp (Polymarket) / 0.03pp (Pinnacle), which is itself a
   quality check on the detector — an uncorroborated Kalshi "event" would be a
   red flag for noise, and none occurred.

**Honest limitation:** this detects *material repricing events*, which are
mostly goals but can include disallowed-goal VAR reversals, red cards, or (for
the 8 matches that went to AET/pens) the `KXWCGAME` leg's mechanical convergence
toward `TIE=yes` as regulation time expires without a goal — a smooth, non-goal
"decay to certainty" pattern found on `JUN29GERPAR` (see §5). This does not
contaminate the 20 matches settled in regulation, and for the 8 AET/pens
matches it can add at most one non-goal tail event near minute 90-100.

## 2. Reaction latency (Item 1)

For each event, `t0` = the Kalshi 1-minute detection bin (see §5 for why this
anchor, not a cross-source minimum, was used). Pre-level = median price in
`[t0-5min, t0-1min)`; post-level = median price in `[t0+3min, t0+8min]`.
Time-to-first-reprice = first tick (Kalshi, Pinnacle) or first 1-min bar
(Polymarket) crossing 20% of the pre→post move; time-to-90% = the 90% crossing.
Kalshi and Pinnacle are tick-level (R1/R2/R3 defect rules applied to Pinnacle,
see §4); Polymarket is analyzed at its native 1-minute fidelity per R7.

Events with `|jump| < 0.05` probability points are excluded as noise.
`reaction_latency.parquet`, 82 rows (75/70/44 located for Kalshi/Poly/Pinnacle
respectively — Polymarket and Pinnacle sometimes show `jump≈0` because they
already priced the move before `t0`, i.e. correctly excluded rather than
mis-measured).

## 3. Lead/lag cross-correlation (Item 2)

`team1`-leg 1-minute return series (both sources resampled per R7), Pearson
cross-correlation at lags -10..+10 minutes, per match, full in-match window
(kickoff to kickoff+3h). **Caveat, load-bearing:** Polymarket's pulled snapshots
are not aligned to the minute — raw `ts_utc` for a given match lands at a
roughly fixed few-seconds-past-the-minute phase (e.g. `:03`–`:17`), not `:00`.
Combined with `resample('1min').last()`'s right-closed/right-labeled binning,
this produces a **systematic ~1-bin measurement lag for Polymarket that is at
least partly a polling-cadence artifact of this data store**, not necessarily
evidence that Polymarket's live order book itself is slower. The per-match
cross-correlation profiles are extremely sharp (single isolated peak at lag+1,
0.93–0.99, vs. <0.15 at every other lag in every match) — a real behavioral
lead/lag would be expected to vary in magnitude and sometimes sign across
matches; this uniformity is itself evidence for a construction artifact.
Reported as a **data-latency characterization**, not a pure behavioral finding;
Item 1's tick-level results are the trustworthy speed comparison.

## 4. Overreaction & fade (Item 3)

Peak = most extreme tick price within 10 minutes of `t0` in the move's
direction. Settled level = median price in `[t0+25min, t0+35min]`, clipped to
the match window and **discarded if a later detected event falls inside that
window** (`contaminated_by_next_event`) to avoid attributing one goal's fade to
another goal's arrival. 28/75 events are clean. Overshoot = `peak − settled`
(signed to the move's direction). Half-life = time from peak to the first tick
crossing halfway back to settled.

## 5. Why the shootout analysis uses `KXWCADVANCE`, not `KXWCGAME`

Discovered by direct inspection, not assumed: `KXWCGAME` is a **regulation-only**
3-way market (R4). For the 8 matches level after 90 minutes, once regulation
ends the `KXWCGAME` legs' fair value is already fully determined (`TIE=yes` is
locked in) regardless of what happens in extra time or on penalties — so the
market **grinds smoothly toward 0/1 as regulation's final minutes tick away**,
a "time-decay-to-certainty" pattern with no relationship to shootout drama. This
was caught by inspecting `JUN29GERPAR`'s `KXWCGAME-GER` leg tick-by-tick: a
smooth 22-minute monotonic decay from 0.48 to 0.01 (22:05–22:27Z) that looks
exactly like a goal reaction but is not one. `KXWCADVANCE` (progression market,
settles on who advances) stays live and informative through extra time and the
shootout itself — confirmed by its much later last-trade timestamp
(23:29:42Z vs. `KXWCGAME`'s ~22:30Z flatline) — and is the correct instrument.
All shootout figures use `KXWCADVANCE-{match}-{advancing team}`.

**Shootout window detection:** walk backward in 30-second bins from the final
trade; a bin is "hot" if its intra-bin price range ≥ 0.06; the window starts at
the earliest bin of a contiguous hot run, tolerating gaps up to 4 minutes (to
bridge the brief post-decisive-kick lock-in tail before the market's literal
last print, which is flat and would otherwise truncate the window — caught on
`JUL03AUSEGY`, whose true window is 14.3 min but a naive walk finds 2.3 min).
"Turning points" = local direction reversals ≥0.05 in a 5-tick rolling-median-
smoothed price path — an approximation of discrete kick outcomes, **not a
verified 1:1 kick-by-kick log** (Kalshi trade data carries no kick-number
annotation).

## 6. Settlement-tail anatomy (Item 5)

Three contract families tied to the 28 matches: `KXWCGAME` (84 legs),
`KXWCADVANCE` (56 legs), `KXWCTOTAL` (180 legs, over/under goal-total markets).
Per leg: "resolution time" = the earliest tick after which **every** subsequent
tick stays within a terminal band (≥0.97 for `result=yes` legs, ≤0.03 for
`result=no` legs); "tail" = all trades from resolution time to the market's
actual last trade. 318/320 legs locate a tail (2 start already in-band with no
pre-period to compare against, excluded).

## 7. Trade-size / inter-trade-time regime shift (Item 6)

Per `KXWCGAME` leg (84 legs with ≥20 trades in both windows): pre-match =
all trades before kickoff (full lifetime back to listing); in-game = trades in
`[kickoff, kickoff+3h45min]`. Compares median trade size (`count_contracts`)
and median inter-trade gap (seconds) between the two windows on the *same*
market — a within-market before/after, not a cross-market comparison.

## Defect rules applied (data-audit.md R1–R9)

- **R2**: Pinnacle `price_decimal<1.01` filtered (0 rows in this 28-match FTR
  subset); `overround_at_ts=0` (1,069/49,952 rows, 2.1%) treated as NaN on the
  devigged probability, with fallback to raw `1/price_decimal` implied
  probability (a fallback, not a silent drop — documented here since the audit
  only specified "treat as NaN" without a fallback rule).
- **R3** (new rule, validated): single-print reversion-glitch screen — flags a
  tick as a glitch iff it reverses direction against its neighbors, both moves
  exceed 0.10pp, the reversion recovers ≥60% of the spike, and the spike-to-
  revert gap is <10 seconds. Run against the full 28-match FTR set: **flags
  exactly 1 row**, and it is the exact example documented in
  `pipeline/data/audit/alignment/README.md`
  (`id1000001653452545`, RSACAN, outcome 102, `18:44:06.453Z`→`18:44:08.767Z`,
  price_decimal 1.416→3.400) — confirms the filter is both necessary and
  conservative (no other collateral flags).
- **R4**: regulation (`KXWCGAME`) vs. advancement (`KXWCADVANCE`) semantics —
  discovered a *consequence* of this rule not previously documented: the
  regulation market's mechanical decay-to-certainty near full time on AET/pens
  matches (§5), and the correct choice of instrument for shootout analysis.
- **R6**: all volume/trade-size figures use trade-tape sums (`count_contracts`),
  never the catalog `volume` field.
- **R7**: 1-minute resampling with a magnitude floor used throughout for
  cross-source work (goal detection corroboration, lead/lag). Within-source
  Kalshi/Pinnacle latency work is tick-level per the task brief.

## Reproducing

```
pipeline/.venv/bin/python pipeline/analysis/ingame_microstructure.py
```
Deterministic given the frozen store; ~2 minutes wall time. All headline
numbers in the findings dossier were read directly off this run's console
output and the parquet tables it writes.
