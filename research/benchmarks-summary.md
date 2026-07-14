# Gate 1 Benchmark Data Audit Summary

## Coverage by Arm

| Arm | Dataset | Rows | Window | Granularity | Status |
|-----|---------|------|--------|-------------|--------|
| **Polymarket** | markets | 40,239 | 2025-07 to 2026-08 | Event catalog (100% enumerated) | ✓ Complete |
| | prices tier 0 | 476,731 | 2025-07-02 to 2026-07-14 | 60-min + 1-min (tournament window) | ⚠ Partial |
| | prices tier 1 | ~2.5M target | In-flight | 60-min + 1-min | ⚠ Incomplete |
| | prices tier 2 | 0 | — | — | ✗ Not started |
| **Pinnacle** | oddspapi raw | 104 fixtures | 2026-03 to 2026-07-13 | Pre/in-play quotes | ✓ JSON pulled |
| | pinnacle.parquet | 166,663 | Group stage only | FTR (3 books) | ⚠ Stale (2 fixtures) |
| **Covers** | wc26_futures | 996 | Pre-tournament + 12 stage checkpoints | Snapshot (BetMGM only) | ⚠ Single book, 249 undated |
| **Opinion** | polls | 97 | May–Jun 2026 | 3 sources (Pew, YouGov, Ipsos) | ✓ Complete |
| | opta | 86 | 5 stages (pre-SF through post-QF Jul 12) | Win-probability per team | ✓ Complete |
| | elo | 13,145 | 1872–2026-07-11 | Full team rating history (15 teams) | ✓ Complete |
| | trends | 0 | — | — | ✗ Blocked (IP ban) |

## Blocked / Partial: Human Actions Required

### 1. **Polymarket Tier 1 Knockout Moneylines** (BLOCKER)
- **Gap:** 0/30 match-winner price series (all 30 KO matches missing)
- **Fix:** From `pipeline/`: `./.venv/bin/python ingest/polymarket.py prices --tier 0,1 --max-requests 8000`
- **Impact:** Currently only winner-token proxies available; direct match dynamics unavailable for microstructure analysis

### 2. **Pinnacle Consolidation Stale** (HIGH PRIORITY)
- **Status:** Raw JSON from `oddspapi.py --tournament-id 16` (PID 56380) running, covers all 104 fixtures
- **Gap:** pinnacle.parquet only consolidates 2 group fixtures (166,663 rows); 0/34 KO-window matches
- **Fix:** After oddspapi run completes, re-consolidate: `./.venv/bin/python ingest/polymarket.py consolidate`
- **Note:** Do NOT analyze pinnacle.parquet for odds comparisons until re-consolidated

### 3. **Google Trends** (DOCUMENTED)
- **Blocker:** HTTP 429 (IP reputation block, not rate-limit fixable)
- **Workaround:** Manual export from trends.google.com (5 min). Recipe in `pipeline/data/benchmarks/opinion/trends_status.json`

### 4. **Covers Timeline Gap**
- **Issue:** 249/996 rows (Game 2, Game 3, Result checkpoints) lack epoch timestamps
- **Mitigation:** Use 9 dated checkpoints only for timeline alignment

## Audit Verdict

| Check | Result | Notes |
|-------|--------|-------|
| Event alignment (known match results) | ✓ PASS | Brazil-Norway, England-Norway, Spain-Belgium verified across sources |
| Probability sanity | ⚠ PASS + DEFECTS | Polymarket clean (0 violations); Pinnacle: 16 inf values (bet365 Over/Under price=0), 5,352 suspended-quote sentinels, 5,685 devig drift up to 0.029 from sub-second collisions |
| Coverage matrix (source × KO match × winner) | ✗ FAIL | **Polymarket tier-1 = 0 rows** (blocker); Pinnacle.parquet stale; Covers/Opinion arms complete |
| Schema consistency (epochs, probs, dedup) | ✓ PASS | UTC epochs verified; [0,1] interval enforced; 0 full duplicates (1-second collisions are genuine ms updates) |

### Critical Flags

- **Microstructure Act blocker:** Tier-1 KO moneyline price series absent; winner-token proxies only until backfill
- **Data defect:** Pinnacle 16 rows with implied_prob=inf; 5,352 sentinel overround=0; 5,685 devig ≠ raw/overround
- **Precision loss:** Sub-second updates collide at 1-second epoch key; use ms-precision created_at for dedup
- **Market semantics:** Polymarket 3-way moneylines resolve on REGULATION (Norway-England = draw, despite England advancing AET)
- **Stale-tick trap:** Latest Polymarket book sum = 1.023 because eliminated Norway tick (0.0365, Jul 12) stale next to Jul 14 live ticks; zero eliminated teams from their timestamp

## Implications for Analytical Angles

1. **Consensus & Calibration** (opinion vs moneyline): Opta, Elo, Polymarket winner series all complete for pre-SF window; Pinnacle awaits re-consolidation
2. **Market Structure** (favorites, spreads, injuries): Winner ordering (France 38.9%, England 21.6%, Spain 20.8%, Argentina 17.5%) confirmed; per-match dynamics blocked until tier-1 backfill
3. **Microstructure** (goal timing, player heat maps): **Blocked** on tier-1 KO moneyline prices and Pinnacle KO consolidation
4. **Validation & Audit Trail** (was the 'right' probability priced?): Opinion arm complete; odds arms have defects; scheduled reconciliation after Pinnacle re-consolidation

## Next Steps

1. **Immediate (< 1 hour):** Re-run Polymarket tier-0,1 backfill once oddspapi run exits
2. **High priority (1–2 hours):** Re-consolidate Pinnacle parquet after raw JSON run completes
3. **Optional (5 min, manual):** Export Google Trends data for opinion ensemble if timeline completeness needed
4. **Data cleaning:** Filter Pinnacle price_decimal < 1.01 (16 inf rows) and prefer NaN over overround_at_ts=0 sentinels
