# Gate 1: Data Audit — The Market Watched the World Cup

**Date:** 2026-07-14. **Scope:** full ingestion fleet output (Kalshi tick store, catalog v2, four benchmark arms) plus two adversarial audits (completeness, cross-source alignment). Derived audit tables: `pipeline/data/audit/` (completeness/, alignment/, entity_map.parquet). This document is the artifact the author reviews to open Gate 1.

## 1. What the project now possesses

| Asset | Size | Detail |
|---|---|---|
| Kalshi catalog (v2) | 34,706 markets | 138 series / 3,278 events; 12.02B contracts lifetime volume; `pipeline/data/catalog/markets.parquet` |
| Kalshi trade tape | 71,776,411 trades (4.1 GB) | Tick-level, all 30,133 markets that ever traded (zero-volume/out-of-scope skipped); partitioned by series |
| Kalshi candles | 44,743,886 rows (1.4 GB) | 1-min, all 30,133 pulled markets have >= 1 row |
| Polymarket | 17.07M price rows (872 MB) | Manifest-complete; incl. tier-1 KO moneylines: 180 token files / 1,043,393 rows (30 matches x 3 outcomes x 2 sides) |
| Pinnacle (OddsPapi) | 9.5M rows (1.1 GB) | All 102 fixtures quoted to date, pre-match + in-play FTR |
| Covers fallback | 996 rows | BetMGM futures snapshots; 9 dated checkpoints usable |
| Opinion arm | polls 97, Opta 86, Elo 13,145 rows | Pew/YouGov/Ipsos waves; Opta 5 stage snapshots; Elo full history, 15 teams. Trends: 0 rows (blocked) |
| **Total on disk** | **~7.5 GB parquet** | Kalshi 5.5 GB + benchmarks ~2.0 GB |

Integrity headline: 99.42% of terminal markets (28,791 / 28,960) reconcile trade-tape volume to catalog volume within 0.1%; 0 duplicate trade IDs across 71.78M rows; 0 timestamp-order defects; ledger, trades, and candles agree 30,133 = 30,133 = 30,133 with zero symmetric difference. All 169 reconcile outliers are under 1.0 and sum to 1.63M contracts, 0.0139% of terminal volume; the 7 worst were re-probed live against the Kalshi API and every one returned a trade tape bit-identical to the parquet. The shortfall is Kalshi's own catalog `volume` field overstating thin/eliminated legs, not a pull gap.

## 2. Completeness matrix (source x act)

| Source | Act 1 Calibration | Act 2 Microstructure | Act 3 Volume anatomy | Act 4 Bias forensics | Ending reinterpretation |
|---|---|---|---|---|---|
| Kalshi trades/candles | **Full** (settlement verified) | **Full** for all 28 finalized KO + group stage; **degraded** for both semis (zero in-game tape, see gap G1) | **Full** (71.78M trades; use tape sums, not catalog volume field) | **Full** | **Degraded** until morning-of refresh (winner legs frozen 05:05-05:20Z Jul 14) |
| Polymarket | **Full** | **Full** at native 1-min granularity (sets the cross-source resolution floor) | n/a (Kalshi-only act) | **Full** (apply stale-tick zeroing, rule R5) | **Full** with same refresh caveat |
| Pinnacle | **Full** (28/28 KO matches aligned) | **Full** (in-play repricing verified vs both retail sources) | n/a | **Full** (professional baseline) | **Degraded** until morning-of refresh of final quotes |
| Covers (BetMGM) | **Degraded**: single book, 249/996 rows undated; use 9 dated checkpoints only | n/a | n/a | Supporting only | n/a |
| Polls (Pew/YouGov/Ipsos) | **Full** | n/a | n/a | **Full** (fan-country bias input) | **Full** |
| Opta supercomputer | **Full** (5 stages, elimination-bracketing verified) | n/a | n/a | **Full** | **Full** |
| Elo | **Full** | n/a | n/a | **Full** | **Full** |
| Google Trends | n/a | n/a | **Blocked** (volume-vs-attention beat only) | n/a | n/a |

Cross-source alignment: 28/28 finalized knockout matches align across Kalshi, Polymarket, and Pinnacle with identical team ordering; entity map covers 30/30 KO matches end-to-end (`pipeline/data/audit/entity_map.parquet`, 0 unmappable entities). Biggest in-match break located on >= 2 sources for 27/28 matches, median cross-source skew 120s; the one 0/3 null (SUICOL, 0-0, pens) is the expected result and validates the detector. Norway-Brazil four-way check (Kalshi winner leg, Polymarket token, Pinnacle in-play, Opta snapshots) collapses within a 60-90s window on the same real-world event.

## 3. Gap register with dispositions

- **G1 — France-Spain in-game tape (open, scheduled).** Store's FRA-ESP legs frozen at 06:24-06:35Z Jul 14; the entire pull finished 20:16:57Z, before kickoff. Zero in-game data and the pre-match surge is missing too: a live probe ~93 min pre-kick found the FRA leg at 16.4x the snapshot's volume, with 2,000+ new trades in a 7-minute window. **Disposition:** one `--since 2026-07-14T05:00:00Z` re-drive after ENG-ARG settles backfills surge + in-game + settlement tail for all 1,173 active markets (mechanism verified by code inspection of `tick_pull.py effective_window()`/`consolidate()`); run twice (post-FRA-ESP, post-ENG-ARG) if FRA-ESP tape is wanted sooner.
- **G2 — Semifinal kickoff-time discrepancy (open, resolve before Act 2).** `fact-base.json` lists SF1 at 19:00Z; catalog `occurrence_datetime` says 22:00Z. Both audits agree the store holds zero in-game semi data either way, but the event-study window for the semis must not be built until this is reconciled.
- **G3 — Final-fixture odds and ending number (scheduled).** Kalshi winner legs, KXWCMATCHUP-26FIN, and Pinnacle final quotes refresh via the planned morning-of-final pipeline re-run + redeploy (CLAUDE.md hard constraint). Nothing due yet; KXWCMATCHUP touched ~132h pre-final.
- **G4 — Google Trends (blocked).** HTTP 429 IP-reputation block, not rate-limit fixable. **Disposition:** ~5-min manual export from trends.google.com; recipe in `pipeline/data/benchmarks/opinion/trends_status.json`. If skipped, the Act 3 volume-vs-attention beat becomes a methods-note line, per the $0-budget rule.
- **G5 — 169 terminal reconcile outliers (closed, accepted).** Source-side Kalshi volume-field quirk, adversarially verified complete against the live API; immaterial in aggregate (0.0139%). Handled by rule R6. Full list: `audit/completeness/terminal_outliers.csv`.
- **G6 — Covers timeline (accepted).** 249/996 rows undated; use the 9 dated checkpoints only. Single-book arm stays supporting-cast.
- **G7 — benchmarks-summary.md is stale (fix now).** It still lists Polymarket tier-1 KO moneylines as a 0/30 blocker; the store now has full tier-1 fidelity=1 coverage. Update the doc so downstream readers do not treat resolved gaps as live.
- **G8 — ENG-ARG staleness (expected, not a defect).** Frozen ~39h pre-kick; covered by G1's re-drive.

## 4. Defect-handling rules Phase 2 MUST obey

- **R1 — Dedup Pinnacle on ms-precision `created_at`, never epoch seconds:** 3,268 sub-second collision groups exist in the 28-match FTR subset alone; second-precision keys silently merge genuine updates.
- **R2 — Filter Pinnacle `price_decimal < 1.01` and treat `overround_at_ts = 0` as NaN:** 16 rows imply infinite probability and 5,352 rows are suspended-quote sentinels, both poison any devig or average.
- **R3 — Screen raw Pinnacle ticks for single-print reversion glitches (new, undocumented defect):** isolated ~2-second impossible prints (e.g. draw at 1.416 decimal) pass both R2 filters because every field looks well-formed; 1-min resampling absorbs them, raw-tick work does not.
- **R4 — Respect regulation-vs-advancement settlement semantics:** KXWCGAME and Polymarket 3-way moneylines settle on 90 minutes while KXWCADVANCE settles on progression; validated with 0 mismatches across all 8 matches level after 90, and conflating them corrupts every calibration score on AET/pens games.
- **R5 — Zero eliminated teams from their elimination timestamp in the Polymarket winner-futures book:** stale last ticks (e.g. Norway at 0.0365 post-elimination) inflate the book sum to 1.023; confirmed structural to the still-open multi-team book and absent from closed per-match moneylines (0/84 flagged).
- **R6 — Use trade-tape sums, not the catalog `volume` field, for per-market volume claims:** the catalog field overstates thin and eliminated legs by up to 5.2% (KXMENWORLDCUP-26-CIV) against an API-verified-complete tape.
- **R7 — Cross-source break detection must resample all sources to 1-min bins with a 0.15 probability-point floor, and inventory all swings in multi-goal matches:** naive tick-diffs are not comparable across mixed granularities, and a single max() picks different goals per source in 3+ goal games.
- **R8 — Never infer row order from a DuckDB parallel glob scan:** it does not preserve on-disk order and produced a false positive of 9,501 "unsorted" files during this audit; use sequential per-file reads for order checks.
- **R9 — Gate market lifetimes on `status`, not `close_time`, and treat KXWC3RDPLACE `occurrence_datetime` (2026-07-19T00:00Z) as a placeholder:** active markets carry far-future placeholder close times, and the 3rd-place pairing cannot have a real fixture time until both semis resolve.

## 5. Surprises worth narrative attention

1. **KXWCADVANCE-26JUL05MEXENG-MEX at ~159M contracts** is the single largest market in the catalog, bigger than any tournament-winner leg; likely host-nation hedging on Mexico's elimination match. It reconciles 1.000000 exactly, so the number is real money, not an accounting artifact.
2. **The last-90-minutes pile-in:** the FRA-ESP moneyline grew to 16.4x its morning volume by 93 minutes before kickoff, with 2,000+ trades in one 7-minute sample window. Retail arrives late and all at once; a natural Act 3 beat.
3. **Pinnacle moves first and sometimes barely moves:** the professional book locates the same in-match break minutes to 69 minutes (ESPBEL) earlier than both retail markets, and on two 1-0 wins never swings 0.15 at all. Reaction-speed and reaction-magnitude asymmetry feeds Acts 2 and 4 directly.
4. **KXWCMENTION:** a 103-event / 3,005-market / ~129M-contract family of broadcast-mention markets that only surfaced by crawling every Kalshi category; off-pitch attention as a tradable asset.
5. **The sizing estimate missed by 37.8%** (52.1M estimated vs 71.78M actual trades) because one anchor market (ARGSUI, 340.8 contracts/trade vs a 195.0 tier truth) skewed the mega-tier ratio, and two tiers silently ran on a global fallback the write-up only disclosed for one. Trades were smaller and more numerous than sampled; a methods-note-worthy honesty story.
6. **The catalog-volume quirk concentrates in eliminated longshots** (CIV winner leg short 1.24M contracts vs its own verified tape), a small but consistent Kalshi source-side accounting oddity nobody documents.

## 6. Verdict

| Act | Readiness |
|---|---|
| 1. Calibration | **Ready.** Settlement-verified Kalshi tape, 28/28 aligned benchmarks, complete model/fan arms. |
| 2. Microstructure | **Ready for all played matches.** Semis excluded until G1 re-drive lands and G2 is resolved; adopt R7 normalization. |
| 3. Volume anatomy | **Ready on Kalshi tape.** Volume-vs-attention sub-beat degraded until G4 manual export, else cut to methods note. |
| 4. Bias forensics | **Ready.** Polls, Elo, Opta, winner futures, and per-match books complete; R5/R6 mandatory. |
| Ending reinterpretation | **Structurally ready.** Depends on G1 re-drive and G3 morning-of refresh, both scheduled and mechanically verified. |

**Recommendation: open Gate 1.** No blocking defects. Both required pilot anchors reconcile as claimed (KXWCADVANCE-26JUL05MEXENG-MEX = 1.000000; KXMENWORLDCUP-26-FR = 1.00261, legitimately > 1 while active). Phase 2 may begin immediately on all finalized-match analysis under rules R1-R9, with three scheduled follow-ups (G1 post-semifinal `--since` re-drive, G3 morning-of-final refresh, G7 doc correction) and one optional manual step (G4 Trends export). Nothing in this report is inferred solely from stored data where a claim mattered: worst outliers and freshness were re-verified against the live Kalshi API during the audit.
