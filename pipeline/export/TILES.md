# TILES.md — how `build_tiles.py` builds `docs/data/`

Owner: data-tiling builder. Reads `docs/CONTRACT.md` §5 (binary contract),
`research/storyboard.md` (scene requirements), `research/data-audit.md`
(defect rules R1–R9), `research/findings-dossier.md` (corrected claims).
Run with `pipeline/.venv/bin/python pipeline/export/build_tiles.py`; verify
with `pipeline/.venv/bin/python pipeline/export/verify_tiles.py`. Both are
plain scripts, no arguments, safe to re-run at any time — every number in
`docs/data/` is a pure function of the current contents of `pipeline/data/`.

Last run: 159,809 desktop dots / 47,785 mobile dots / 16.7MB total (§7 has
the full size table). Re-running after new ticks land (a G1 re-drive, the
v2 epilogue's incremental pull) reproduces the algorithm on the grown tape
with no code change — only the numbers move.

---

## 1. The population tile: grain assembly

**Unit convention.** Kalshi's event contracts carry `notional_value_dollars
= 1.0000` on every binary market, so one traded contract is one dollar of
matched notional. This is also the convention the Phase-2 volume-anatomy
arm uses for the tape's headline "$12.3B" figure (dossier R1: the tape's
`total_lifetime_contracts` in `regime_breaks.json` is reported directly as
a dollar figure). `build_tiles.py` therefore treats a trade's dollar
contribution as exactly its `count_contracts` value — no price-weighting,
no premium calculation. This keeps the population tile's numbers speaking
the same unit as the storyboard's prose without a second, conflicting
definition of "dollars traded."

**Per-market, not globally interleaved.** A population dot is assembled
from a single market's own trade tape, walked in that market's own
chronological order — never by merging all 30,133 markets into one global
time-ordered stream. This is deliberate: several scenes need to select "all
the dots belonging to market X" as a clean, unambiguous set (S9's winner-leg
paths, S13's host-team columns, S15's France/Spain strip), which is only
possible if a dot never straddles two different markets. The tradeoff is
that population dots line up on their *own* market's calendar, not a single
shared calendar — which is fine, since every scene that draws dots on a
shared time axis (S2, S9) is walking dots that are already grouped by
family or team first.

**The algorithm**, run once per market (ticker) with lifetime dollars ≥ the
tile's grain (`$75,000` desktop, `$250,000` mobile):

1. Sort the market's own trades by `(created_ts, trade_id)` ascending.
   `trade_id` is an opaque UUID, used only as a deterministic tie-break for
   trades sharing a `created_ts` second (there are many — Kalshi's tick
   timestamps are second-resolution, not millisecond).
2. Walk the cumulative sum of `count_contracts`. Every time the running
   total *first* crosses a multiple of the grain, the trade that crossed it
   closes one dot. The dot's `dollars` is the sum of `count_contracts` of
   every trade since the previous dot closed (usually ≈ the grain; a single
   oversized trade can push the bucket over by more, and money is never
   split across two dots to force an exact match — see "money is
   conserved" below).
3. The dot's `birth_ts` is the `created_ts` of the trade that closed it.
4. The dot's `price_band` is the dollar-weighted VWAP of the bucket's
   trades, rounded to whole cents 0–100. Its `side` is the dollar-weighted
   majority `taker_side` of the bucket (ties resolve to `taker_yes`).
5. A market's *very last* bucket is whatever is left over after the last
   full-grain bucket closes — usually smaller than one grain. It still
   becomes its own dot. This is the "dollars … varies at the tail" the
   contract's own column comment documents (CONTRACT.md §5.2).

Implemented as one DuckDB window-function query over the full trade
parquet glob (`SUM(count_contracts) OVER (PARTITION BY ticker ORDER BY
created_ts, trade_id ROWS UNBOUNDED PRECEDING)`), not a Python loop — the
73.16M-row tape buckets in about 80 seconds per grain on this store.

**Markets below one grain own zero dots.** A market whose lifetime total
never reaches the grain contributes no dots at all; its ticker and dollars
roll into `census.below_grain` and a `markets.json` "strata" row (grouped
by family, to stay compact — 21,725 below-grain markets collapse to 7
strata rows in the last build). This is the S5 "below one dot" band: the
storyboard is explicit that listed-but-thin must never look identical to
never-listed, so the below-grain aggregate is always reported, never
silently dropped.

**Money is conserved, never split, never deleted.** Every dollar in the
trade tape ends up in exactly one dot's `dollars` value, or in
`census.below_grain.usd`. Summing every dot's `dollars` plus
`census.below_grain.usd` reproduces `census.total_usd` exactly (verified:
`12,064,554,280.95 + 286,944,710.85 = 12,351,498,991.80`, matching the
tape's own `SUM(count_contracts)` to the cent). A single huge trade can
make one dot represent more than one grain's worth of money (the
alternative — splitting a trade across two dots — would imply a trade
partially happened, which is a fiction the piece's "a dot is a real trade"
discipline forbids); this is why the desktop tile's dot count (159,809) is
a little below the naive `$12.06B / $75,000 ≈ 160,860` division.

**Mobile reuses the desktop market index.** Because `250,000 > 75,000`,
every market that clears the mobile grain also clears the desktop grain, so
the mobile-qualifying ticker set is always a subset of the desktop set.
`build_tiles.py` computes the desktop qualifying set first and builds
`markets.json`'s market index from it; the mobile bucketing pass is
restricted to that same ticker list, so a `market` index in either tile
resolves against the same `markets.json` row. (The mobile tile can, and
does, own *fewer* markets than are listed in `markets.json` — a market with
$100k lifetime volume gets 1 desktop dot but 0 mobile dots — the mobile
pass just never emits a bucket for it, which is fine, since nothing reads
market indices the mobile tile never wrote.)

## 2. Per-dot attributes: family / team / fate / flags

**Family** collapses `series.parquet`'s own free-text `family` column (7
values) into the manifest's 9-slot enum. Six of the seven text buckets map
1:1; the one multi-valued bucket, `"Per-match markets (3-way moneyline +
match derivatives)"`, is split by `series_ticker`: `KXWCGAME` →
`match_3way` (it *is* the moneyline), `KXWCADVANCE` → `advancement`,
everything else in that bucket (spreads, totals, scores, BTTS, corners,
halves, …) → `spread_total_score`. See `classify_family()`.

**Team** is parsed only for a fixed list of team-keyed series
(`TEAM_KEYED_SERIES`, ~23 series tickers covering `KXWCGAME`,
`KXWCADVANCE`, `KXMENWORLDCUP`, the group-stage and stage-of-elimination
families, and a handful of host/team-performance props). Everything else
(prop ladders, novelty markets, player markets) carries `team = 0`
(none/multi) — not every market is about one team, and forcing an answer
would be worse than an honest "not applicable." Two different code schemes
are in play across the catalog: `KXMENWORLDCUP` uses near-ISO 2–3 letter
codes (`FR`, `GB`, `SA`, `SC`, …) while `KXWCGAME`/`KXWCADVANCE` and most
other series use FIFA-style 3-letter codes (`FRA`, `ENG`, `KSA`, `SCO`, …).
`KMWC_TO_FIFA3` is a hand-built 48-entry translation table (cross-checked
against both series' full suffix lists) so the manifest's `teams` array is
one canonical 48-team list regardless of which series a dot came from.

**Fate** reads the catalog's `status`/`result` columns directly:
`finalized`+`yes`/`no` → `settled_yes`/`settled_no`; `finalized` with any
other result (`scalar`, empty) → `voided`; `closed`/`inactive` → `voided`;
anything else (`active`) → `alive_at_freeze`.

**Flags.**

- `LORENZ_TAIL` — bottom half, by lifetime dollars, of the **dot-owning**
  (desktop-qualifying) markets specifically, not the bottom half of all
  30,133 traded markets. This matters: the bottom half of *all* traded
  markets (15,067 of them) is almost entirely already-below-grain and owns
  zero dots, so tagging against that set would light up nothing. Tagging
  against the bottom half of the 8,408 dot-owning markets (4,204 of them)
  gives S5's Lorenz-sweep tail and S14's cheap-leg sag a real, non-empty,
  shared set of dot identities to re-light.
- `ZOOM_FRAESP` / `ZOOM_MEXENG` / `ZOOM_GERPAR` / `ZOOM_NORBRA` — set on
  every population dot belonging to the tickers a zoom scene spends its 1:1
  window on (the three FRA-ESP 3-way legs, the MEXENG advancement leg, the
  two GER-PAR legs, the three BRA-NOR 3-way legs). This is what lets a zoom
  scene's "the dots carrying this tag fly forward" beat find its dots in
  the resting population.
- `FINAL_CONTRACT` — the winner-futures legs of the final's two
  participants. Spain is resolved from the FRA-ESP tape (see §3). England
  and Argentina's semifinal was still unresolved at build time (see §6), so
  both legs are flagged provisionally; re-running this script after
  ENG-ARG settles narrows the flag to the actual finalist automatically,
  with no code change.
- `BELOW_GRAIN_STRATUM` — reserved, unused by the population tile (it
  describes the below-grain *band*, which is drawn from `markets.json`
  strata rows, never from population dots, since below-grain markets own
  zero dots by construction).

## 3. Zoom (1:1 tick) extracts

Every zoom tile is built directly from the raw Kalshi trade parquet (never
from a pre-aggregated analysis table), so data-audit.md's defect rules are
applied exactly once, here, at export — the browser never sees a raw tick.

- **R6** (trade-tape sums, never the catalog `volume` field) — every zoom
  window sums `count_contracts` off the trade parquet directly.
- **R8** (never trust parallel-glob row order) — each zoom window is read
  from its own single ticker's parquet file with an explicit `ORDER BY
  (created_ts, trade_id)`, never relying on on-disk or glob-scan order.
- **R9** (gate lifetimes on `status`, not `close_time`) — the fraesp/gerpar
  windows are anchored to *observed* trade-tape events (see below), not to
  catalog close-time fields, which the audit already flags as unreliable
  placeholders on several series.
- **R1/R2/R3** (Pinnacle-specific: ms-precision dedup, filter
  `price_decimal < 1.01` and `overround_at_ts = 0`, screen isolated
  single-print reversion spikes) — applied in `read_pinnacle_ftr()` /
  `screen_pinnacle_spikes()`, used by the norbra tile's Pinnacle lane.

**S1 · `zoom/fraesp.bin`.** All three FRA-ESP 3-way legs (`FRA`/`ESP`/
`TIE`), full available tape (74,439 rows spanning 2026-07-10T21:31 through
2026-07-14T21:00, i.e. pre-match build-up through the settlement pour — the
data-audit's G1 gap note about a frozen pre-kickoff snapshot has since
closed: background ingestion caught the match's in-game and settlement tape
before this build ran). The repricing-event flag (`flags` bit 0) uses the
cross-source `events_matched.parquet` row for this match if one exists,
else a simplified single-source detector (`detect_single_source_event()`):
resample the FRA leg to 1-minute last-price and flag the single largest
1-minute move. No sampling needed (74,439 rows ≪ the 375,000-row cap for a
6MB budget).

**S6 · `zoom/mexeng.bin`.** The `KXWCADVANCE-…-MEX` leg only (the single
market the storyboard zooms), full lifetime (999,889 trades — "about a
million," matching R8's dossier language). This exceeds the 10MB cap
(625,000 trades at 16B/row), so it is LOD-thinned with `build_stride=2`
(every 2nd trade in chronological order) to 499,945 rows / 8.0MB. The
narrated stride is carried in `manifest.zoom.mexeng.build_stride`, per the
storyboard's "showing every nth trade, and n is printed" rule.

**S8 · `zoom/gerpar.bin`.** The regulation leg (`KXWCGAME-…-GER`) and the
advancement leg (`KXWCADVANCE-…-GER`) only — not the PAR legs or the TIE
leg, matching the storyboard's two-path "dual-path" scene exactly. Window:
**empirically anchored**, not read from the catalog's
`occurrence_datetime` field. `data-audit.md` gap G2 already flags
`occurrence_datetime` as unreliable for the semifinals; it turned out to be
wrong for this match too (23:30:00Z, an hour *after* the regulation leg's
own last trade). Instead: `window_lo` = 30 minutes before the regulation
leg's own last trade (its settlement-decay tail), `window_hi` = 5 minutes
after the advancement leg's own last trade (the shootout's conclusion).
This is a pure function of the tape's own contents, immune to a
mis-recorded schedule field, and generalizes safely to a re-drive. 156,819
rows, 2.5MB.

**S7 · `zoom/norbra.bin`.** Nine "legs" packed into the same generic
7-column zoom schema: 3 outcomes (Brazil win / Norway win / Draw) × 3
venues (Kalshi / Pinnacle / Polymarket). The event anchor is
`events_matched.parquet`'s `JUL05BRANOR` row (tv_magnitude 0.475, "team2
up" — Norway's leg jumping, i.e. Haaland's second goal, the storyboard's
committed vehicle), cross-checked against the same-minute Polymarket/
Pinnacle corroboration already recorded in that row. Window: event − 5min
to event + 35min (bracketing R20's 30-minute friction-band check).
  - Kalshi legs are real trades: `contracts`/`notional_usd` populated,
    `price_c` from `yes_price_usd`.
  - Pinnacle legs are quote updates, not trades: `contracts = notional_usd
    = 0` (no money changes hands in a quote), `price_c` from
    `implied_prob_devigged` after R1–R3 filtering. Outcome IDs 101/102/103
    are assumed to follow the standard oddspapi/Pinnacle 1X2 convention
    (home win / draw / away win); this is not labeled anywhere in the raw
    feed, so it is inferred and cross-checked against which outcome's
    average implied probability is highest (101, matching Brazil as the
    much stronger favorite) — documented here as an assumption, not a
    verified fact, and applied consistently across every match the braid
    (§4) touches.
  - Polymarket legs are 1-minute native price snapshots: `contracts =
    notional_usd = 0`, `price_c` from `implied_prob`.
  - The zoom binary format has no venue column; `leg` is the only
    discriminator, and `manifest.zoom.norbra.legs[i].venue`/`.kind` carries
    what each leg index means. This is a documented, minimal extension of
    the generic schema — the alternative (spending two more flag bits to
    encode venue) was rejected because `leg` already disambiguates fully
    and the contract reserves flag bits 1–7 without assigning them.

32,295 rows, 0.52MB.

**Sort order.** Every zoom tile is globally re-sorted by `ts_ms` ascending
after all legs are stacked (`stack_zoom_rows()`), satisfying the contract's
"trades sorted by ts_ms ascending" rule even where a tile mixes multiple
legs/venues with different native update cadences.

## 4. Aggregate series — class A vs class B

Every number the storyboard's overlay specs need falls into one of two
classes, and `build_tiles.py` is explicit about which is which (this
answers "how do these numbers refresh at the G3 deploy re-run and at the
v2 epilogue" directly):

- **Class A — recomputed live**, every time this script runs, straight from
  the raw trade tape / catalog / benchmark parquet. No interpretive
  methodology beyond "sum," "sort," "resample to a minute grid." Re-running
  `build_tiles.py` after new ticks land picks these up with zero code
  changes.
- **Class B — repacked verbatim** from a Phase-2 analysis script's output
  under `pipeline/data/analysis/`. These numbers carry adversarially
  verified interpretive methodology (a Brier score, a favorite-longshot
  bucket, a devig, a poll-gap normalization) that must match the
  findings-dossier's corrected claims exactly, not be silently re-derived
  by a second code path at tile-build time. **To refresh a class-B number,
  re-run its Phase-2 analysis script, then re-run `build_tiles.py`** —
  this file only repackages whatever that script last wrote.

| Series / scene payload | Class | Source |
|---|---|---|
| `series.family_cumulative_futures/_match` (S2/S3 counter) | A | `build_family_cumulative()`, full trade tape × `market_meta.family_enum` |
| `series.lorenz` fields in `s05.json` (Gini, sweep, top-N shares) | A | `build_lorenz()`, `market_totals` |
| `s04.json` clock grid (dow×hour ET density, in/out-window split) | A | `build_clock_grid()`, full trade tape |
| `manifest.hero` (S17 winner-futures pair + devig) | A, provisional | `build_hero()` — last-traded price per finalist leg; **pre-G3**, see §6 |
| `series.braid_kalshi/_polymarket/_pinnacle` (S10) | A | `build_braid()`, §5 below |
| `s02.json`, `s08.json` regulation-decay stat | A | trivial recomputes / the gerpar zoom's own regulation window |
| `s06.json` (MEXENG buckets) | B | `mexeng_summary.json` (R8) |
| `s07.json` (goal event + reaction latency) | B | `events_matched.parquet`, `reaction_latency.parquet` (R3/R22) |
| `s09.json` (post-upset drift, Norway-Argentina mirror) | B | `post_upset_drift*.parquet` (R9) |
| `s10.json` `max_gaps` / episode count | B | `kalshi_vs_polymarket_max_gaps.csv`, `divergence_episodes_kalshi_vs_pinnacle.csv` (R2) |
| `s11.json` (Brier scores by source/horizon) | B | `scores_match3way_by_source_horizon.csv` (R5) |
| `s12.json`/`s13.json` (Golden Boot, poll gaps, host-peer band, zombie money) | B | `golden_boot_*.parquet` (R13), `poll_vs_market_gaps.csv` (R10), `us_home_bias_futures_peer.parquet` (R12), `zombie_money.parquet` (R21) |
| `s14.json` (FLB calibration buckets, both weightings) | B | `flb_kalshi_buckets*.parquet` (R7) |
| `s15.json` (semifinalists vs Opta/Elo) | B | `semifinalists_price_vs_opta_elo.csv` (R6) |
| `s16.json` | — | no new data; lens lockup labels only, recaps s09/s10/s13/s14/s15 anchors |

## 5. The S10 braid, in detail

`build_braid()` reconstructs a per-minute Kalshi/Polymarket/Pinnacle price
trace for all 84 legs (28 knockout matches × 3-way) from
`_entity_map_played.parquet` (the Phase-2 crosswalk of Kalshi tickers,
Polymarket token IDs, and Pinnacle fixture IDs — already adversarially
verified, reused here rather than re-derived). For each leg:

1. Window = kickoff − 30min to kickoff + 150min (`pinnacle_kickoff_utc`).
2. Kalshi: read the leg's own trades in-window, take the last trade price
   *per second*, then `reindex(minutes, method="ffill")` onto the minute
   grid — critical detail: trade timestamps almost never land exactly on a
   minute boundary, so a plain `reindex(minutes).ffill()` (fill gaps in the
   *already*-reindexed series) leaves the whole trace `NaN`; `method=
   "ffill"` on the reindex call itself correctly propagates the last known
   trade price forward onto arbitrary target timestamps.
3. Polymarket: same reindex-with-ffill pattern against the leg's own
   1-minute-fidelity price file.
4. Pinnacle: same pattern, but any minute at or after the leg's last real
   quote is left at the `-1` sentinel ("terminated") rather than
   forward-filled forever — this is what lets the client draw the
   dashed-grey "no longer quoting" line the storyboard specifies.

`-1.0` is the sentinel for "no quote here" across all three arrays
(`series.sections[…].note` documents this in the manifest). This is a
**class A** number and will not match R2's dossier-verbatim 0.74-point mean
gap exactly (last build: 1.21pp) — the dossier figure is a class-B, more
carefully constructed metric (1-minute resampling with a probability-point
floor per R7, restricted to the knockout window rather than a fixed
kickoff±window band that includes quiet pre-match hours). Both numbers are
exposed in `s10.json` (`braid.mean_abs_gap_pp` next to `max_gaps`, the
dossier-verbatim per-leg table) precisely so a scene builder can choose the
dossier's verified number for on-screen prose while still having a live
trace to draw.

## 6. Known simplifications / provisional numbers

- **`manifest.hero` is pre-G3.** The final's opponent (England or
  Argentina) was not yet resolved at build time — the fact base records the
  semifinal as upcoming. `determine_final_contract_tickers()` resolves
  Spain from the settled FRA-ESP tape and, finding ENG-ARG still
  `alive_at_freeze`, flags *both* legs provisionally. `manifest.hero.legs`
  therefore lists all three (Spain/England/Argentina) with their
  currently-alive winner-futures prices and a `provenance` string that says
  so explicitly. This is intentional and matches CLAUDE.md's hard
  constraint that the frozen, timestamped number is a G3 morning-of-final
  responsibility, not a Phase-4 tiling responsibility — re-running this
  script after ENG-ARG settles (and again on the morning of the final)
  narrows and freshens `hero` automatically.
- **Coda replay shards are not generated.** `data/replay/index.json` (the
  bounded market picker list, ranked by lifetime dollars, capped to 500
  rows) is written; the per-market `RTSER1` price-life shards
  (`data/replay/*.bin`, fetched lazily on selection) are a documented
  follow-up, not built in this pass — S18 is the last, lowest-priority
  scene and the population/zoom/manifest core was the priority under the
  time available.
- **Pinnacle 101/102/103 outcome-ID convention** (home/draw/away) is an
  inferred, not a labeled, mapping — see §3.
- **`price_band`'s documented `255 = mixed` sentinel is unused** — every
  dot's VWAP is always computed and clamped to 0–100; no bucket is flagged
  as too wide-ranging to summarize. A future pass could add a variance
  threshold if a scene needs to distinguish "one clean price" dots from
  "spans a big move" dots.

## 7. Budget (last run)

| file | bytes | MB | cap | status |
|---|---:|---:|---:|---|
| `manifest.json` | 7,240 | 0.007 | — | — |
| `markets.json` | 609,661 | 0.610 | 1.5 (shared) | OK |
| `pop-75k.bin` | 2,556,980 | 2.557 | 4.0 | OK |
| `pop-250k.bin` | 764,596 | 0.765 | 1.5 | OK |
| `zoom/fraesp.bin` | 1,191,044 | 1.191 | 6.0 | OK |
| `zoom/mexeng.bin` | 7,999,148 | 7.999 | 10.0 | OK |
| `zoom/gerpar.bin` | 2,509,124 | 2.509 | 3.0 | OK |
| `zoom/norbra.bin` | 516,740 | 0.517 | 3.0 | OK |
| `series.bin` | 184,864 | 0.185 | 4.0 | OK |
| `data/scenes/*.json` (16 files) | 345,904 | 0.330 | 2.0 | OK |
| `data/replay/index.json` | 62,558 | 0.060 | — (lazy) | OK |
| **TOTAL** | **17,547,859** | **16.73** | **40.0** | **OK, 58% headroom** |

Population: 159,809 desktop dots (grain $75,000), 47,785 mobile dots (grain
$250,000). Verified with `pipeline/export/verify_tiles.py` — 108 structural
checks, 0 failures (magic bytes, header counts vs. manifest, every column's
offset+length within the file, `ts_ms` sorted ascending in every zoom tile,
total payload within budget).
