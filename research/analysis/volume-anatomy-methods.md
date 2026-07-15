# Volume Anatomy — Methods Note

**Arm:** Volume anatomy (Act 3 support). **Author:** Claude (Sonnet 5), Phase 2 analysis sweep.
**Scope obeyed:** `research/data-audit.md` rules R1-R9, especially **R6** (trade-tape sums, never
the catalog `volume` field) and **R9** (gate on `status`, not `close_time`).

## 0. The tape is live — snapshot discipline

The Kalshi trade store is being actively appended to during this analysis session (France-Spain
SF1 kicked off mid-run; row counts climbed from 71.78M -> 72.58M -> 72.64M -> 72.82M -> 72.82M-73.05M
across successive interactive probes in a matter of minutes). To keep every derived table
internally consistent, one frozen snapshot was materialized (`CREATE TABLE trades AS SELECT ...`)
at the start of each script run and every downstream query reads only that materialized table —
never the live glob directly. The exact snapshot used for the headline numbers below is recorded
in `pipeline/data/analysis/volume-anatomy/snapshot_manifest.json`:

- Materialized: `2026-07-14T21:47:13Z`
- Rows: **72,819,299 trades**, max trade timestamp `2026-07-14 21:47:01Z`
- **12,308,775,212 contracts** total lifetime volume (trade-tape sum, R6-compliant)

A second script run (`_part2.py`, `_part3.py`) re-materialized the same query ~1-2 minutes later
and picked up ~230K more rows (72,819,299 -> 73,052,567) purely from live SF1 trading. The two
snapshots agree to 4 significant figures on every percentage-based finding below; only the
absolute-count MEX-ENG/concentration figures use the part-1 snapshot consistently (all of part 2/3
re-read from their own single re-materialized snapshot, internally consistent within each script).
None of the reported findings depend on the live SF1 game itself — SF1 is explicitly excluded from
match-specific analysis (item 4) since it is unsettled (per task instructions, G1/G2).

**On the "$7.4B" framing number in `CLAUDE.md`:** the tape's own cumulative total through July 8,
2026 (the date the $7.4B press figure — Deadspin/Kalshi, `research/fact-base.json` — was reported
for) is **$10.94B notional** (10,939,860,000 contracts at Kalshi's $1-per-contract settlement
convention: yes_price + no_price = $1.00 identically on every trade, so total contracts traded ≡
total notional dollars in play). That is **48% above** the press figure for the same cutoff date,
and by the snapshot above (mid-tournament, SF1 in progress) the tape totals **$12.31B**, 66% above
$7.4B. This gap is not reconciled here — the press figure's exact methodology (single-sided
notional? narrower market universe? a different cutoff time zone?) is not published — but the
$12.31B/$10.94B numbers are the only ones independently reproducible against the full 72.8M-row
trade tape and are what this arm uses throughout. **This should be treated as a live discrepancy
the narrative team needs to resolve before publishing "$7.4B" as the piece's headline number** —
see finding vol-01.

## 1. Reference tables

- `market_ref.parquet` — every catalog ticker joined to its series' `family` (7 buckets, from
  `catalog/series.parquet`) and event metadata. Gated on `status`/`occurrence_datetime` per R9,
  not `close_time`.
- `market_totals.parquet` — trade-tape-summed contracts + trade count per ticker, 30,133 rows
  (every market that ever traded). This is the R6-compliant replacement for the catalog `volume`
  field everywhere in this arm.
- `all_markets_status.parquet` — full 34,706-row catalog ticker list (traded + never-traded), used
  to compute the never-traded share.

## 2. Method per required analysis

**(1) Arrival timeline.** `SELECT date_trunc('day', ts), SUM(count_contracts) FROM trades GROUP BY
1` over the full tape (`daily_arrival.parquet` / `daily_arrival_annotated.csv`, cumulative % added).
Regime-break dates are empirically detected from the series itself, not assumed: the Dec 5, 2025
spike (2025-12-05: 190,498 contracts vs a ±10-day baseline mean of 30,646 = 6.2x) lines up with the
real-world Dec 5, 2025 World Cup group draw date; June 11, 2026 is the group-stage kickoff per
`fact-base.json`; July 8 and July 13, 2026 are independently confirmed rest days by cross-checking
against `match_windows.parquet` (zero KXWCGAME kickoffs land on either date).

**(2) Time-of-day pulse.** `EXTRACT(hour/dayofweek FROM ts)` computed both in UTC and via DuckDB's
native ICU `timezone('America/New_York', ts)` (no external tz library needed), summed to a
7x24 contracts matrix (`hourly_heatmap.parquet`, tidied to `hourly_pulse_{et,utc}.csv`).
Match-window vs non-match split: built 93 windows (`[kickoff-60min, kickoff+150min]`, a documented,
reproducible 3.5-hour bracket) from the 93/102 KXWCGAME events with a non-null
`occurrence_datetime` (9 events lack one and are conservatively left out — their volume falls into
the "non-match" bucket by default, a disclosed downward bias on the match-window share).
Classification used `pandas.merge_asof(trades_sorted_by_ts, windows_sorted_by_start,
direction='backward')` then `ts <= win_end` — O(n log n), exact for non-overlapping windows
(`match_window_split.csv`, `per_match_window_volume.csv`).

**(3) Family anatomy.** Daily contracts by `series.family` (`family_daily.parquet` /
`family_cumulative.parquet`); crossover date = first day cumulative "Per-match markets" volume
exceeds cumulative "Tournament winner futures" volume (`family_crossover.json`). Novelty-vs-sports
ranking: `market_totals.parquet` sorted descending, rank of `KXWCMENTION-26JUL06USABEL-TRUM`
compared against every market in the four "real sports" families (`novelty_vs_sports.json`).

**(4) MEX-ENG anomaly.** Full trade-level tape pulled for `KXWCADVANCE-26JUL05MEXENG-MEX`
(`mexeng_advance_tape.parquet`, 999,889 rows) plus its three comparison legs in the same event
(`mexeng_comparison_legs.parquet`). Kickoff (`2026-07-06T01:00:00Z`) taken from
`audit/entity_map.parquet`'s Pinnacle-sourced `pinnacle_kickoff_utc` (R4-consistent: KXWCADVANCE
settles on advancement, KXWCGAME on 90 minutes, both used correctly here). Time buckets, taker-side
skew, block-trade share and trade-size distribution computed directly on the pulled tape
(`mexeng_summary.json`).

**(5) Concentration.** Gini computed on the 30,133-row `market_totals.parquet` via the standard
`(n+1-2*sum(cumsum(sorted_x))/sum(x))/n` formula; top-N shares and the bottom-half sum computed on
the same sorted array; Lorenz curve downsampled to 2,000 points for charting
(`concentration_summary.json`, `lorenz_curve.csv`). Never-traded count (4,573 of 34,706, 13.18%)
is cross-validated two independent ways: catalog tickers absent from the 72.8M-row trade tape, and
an exact match to `series.parquet`'s own `zero_volume_market_count` column sum — this differs from
the "14.5%" figure mentioned in the task brief for this arm, which appears to reference a different
snapshot or definition; **13.18% is the number this note stands behind**, reconciled two ways
against the live tape.

**(6) Volume-vs-attention.** **Google Trends is BLOCKED (G4)** — HTTP 429 IP-reputation block,
confirmed via `pipeline/data/benchmarks/opinion/trends_status.json`. Per the data-audit
disposition, **no substitute metric was used**; this beat is degraded to the poll arm only
(`poll_dates_vs_volume.csv`, `volume_vs_attention.json`). The poll arm has only 6 distinct publish
dates across 14 months (`polls.parquet`), too sparse to correlate against daily volume in any
statistically meaningful way — this is stated as a limitation, not papered over. The one usable
comparison: YouGov's single "interest_level" wave (fielded 2026-05-21 to 05-24, pre-tournament)
found 54% of U.S. adults "not at all interested" in the World Cup; Kalshi's own daily volume
during that exact field window averaged 1.77M contracts/day, vs. 373.5M contracts/day averaged
across the June 11-July 11 tournament window — a 211x gap between a stated-disinterest snapshot and
the market's revealed activity once games started. This is offered as context, not a headline
finding, given the n=1 poll-wave sample.

## 3. Known limitations

- The 9 KXWCGAME events with null `occurrence_datetime` are excluded from match-window
  construction (item 2); their trades default to "non-match," a small conservative bias.
- `mean_trade_size` / block-trade counts use `is_block_trade` as pulled — confirmed `False` for
  100% of the 999,889 MEX-ENG-MEX rows, i.e. a genuine, verified absence of block trades in that
  market, not a data gap.
- All dollar figures use Kalshi's $1-per-contract settlement convention (`yes_price + no_price ≡
  $1.00` on every trade, verified: `notional_yes_side + notional_no_side = total_contracts` to 6
  significant figures across the full tape). "Contracts" and "notional dollars" are used
  interchangeably throughout.
- Semifinal 1 (France-Spain) is in progress at snapshot time and is excluded from any
  settlement-dependent analysis (item 4 does not touch it); it is included in the aggregate
  arrival-timeline/concentration totals only as an ordinary partial trading day, clearly labeled.

## 4. Output inventory (`pipeline/data/analysis/volume-anatomy/`)

`snapshot_manifest.json`, `market_ref.parquet`, `market_totals.parquet`, `all_markets_status.parquet`,
`daily_arrival.parquet` (+`_annotated.csv`), `hourly_heatmap.parquet` (+`hourly_pulse_{et,utc}.csv`),
`match_windows.parquet`, `match_window_split.csv`, `per_match_window_volume.csv`,
`family_daily.parquet`, `family_cumulative.parquet`, `family_crossover.json`, `series_totals.parquet`,
`concentration_summary.json`, `lorenz_curve.csv`, `regime_breaks.json`, `novelty_vs_sports.json`,
`mexeng_advance_tape.parquet`, `mexeng_comparison_legs.parquet`, `mexeng_summary.json`,
`poll_dates_vs_volume.csv`, `volume_vs_attention.json`.

Scripts: `pipeline/analysis/volume_anatomy.py`, `volume_anatomy_part2.py`, `volume_anatomy_part3.py`
(run in that order; each re-materializes its own trade-tape snapshot from the live parquet glob).
