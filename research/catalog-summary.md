# Kalshi 2026 World Cup Market Catalog Summary

**Date:** 2026-07-13  
**Source:** `pipeline/data/catalog/markets.parquet` (31,187 rows)

## Headline Counts

| Metric | Value |
|--------|-------|
| Series | 110 |
| Events | 3,119 |
| Markets | 31,187 |
| Total Contract Volume | 11.89B |

---

## Market Inventory by Family

| Family | Series | Markets | Volume (Contracts) |
|--------|--------|---------|-------------------|
| Per-match markets (3-way + derivatives) | 38 | 17,224 | 10.05B |
| Tournament winner futures | 7 | 119 | 1.18B |
| Tournament-wide totals & novelty | 25 | 4,419 | 485.3M |
| Player props (Golden Boot, goals, awards) | 10 | 7,680 | 91.1M |
| Team-performance props (stage of elimination) | 15 | 978 | 56.3M |
| Group-stage markets | 11 | 767 | 28.8M |
| Qualifying/playoff (pre-tournament, 0 markets) | 4 | 0 | 0 |

---

## Tick-Pull Sizing Estimate

**Method:**  
Sampled 10 anchor markets (including KXMENWORLDCUP-26-FR and KXWCGAME-26JUL11ARGSUI) spanning every family and volume tier. For each market, pulled up to 3 pages of GetTrades within its active lifetime (open_time → close_time for finalized; open_time → pull-time for still-active). Computed avg contracts-per-trade per sample, stratified into 6 volume tiers, then applied tier ratios to catalog volumes to estimate total trade count.

**Estimates (5 req/s wall-clock rate):**
- Estimated total trades: 52.1M
- GetTrades requests: ~72,300
- Candlestick requests: ~99,900 (gated to 26,673 non-zero-volume markets; 5,000-candle/wall-clock-window limit enforced)
- **Pull time: ~9.6 hours at 5 req/s**

**Uncertainty:**
- Single-window sampling cannot separate in-game vs pre-match trade-size regimes; 3 of 10 samples hit pagination cap
- 1-999-contract tier (6,808 markets) uses global fallback ratio; individually tiny but potential few-percent undercount
- This is a one-shot baseline, not incremental-pull cost; resumable design would reduce real wall-clock on re-runs

---

## Audit Verdict: Gaps Found

**Spot-check results (9/10 pass):**
- ✓ KXMENWORLDCUP-26-FR (winner futures anchor)
- ✓ KXWCGAME-26JUL14FRAESP-FRA, KXWCGAME-26JUL11ARGSUI (match markets)
- ✓ KXWCGOALLEADER-26-KMBA, KXWCGROUPWIN-26A, KXWCSTAGEOFELIM-26USA, KXWCHOSTWIN-26 (team/stage props)
- ✓ KXWCTOTALGOAL-26FT-290 (tournament total)
- ✗ KXWCFINALMATCHUP (series exists, 0 events/markets; live API routes finals under KXWCMATCHUP-26FIN instead)

**Missing series (~22 total, ~500 markets):**  
Highest-volume misses:
- KXWCGROUPBOTTOM (~872K contracts) — **named in fact-base**
- KXWCGOALCOMBO (177 markets, largest by count)
- KXWCMESSIMBAPPE (~795K) — **named in fact-base**
- KXWCADS (Financials, ~582K)
- KXTRUMPWORLDCUP (Politics, ~482K)
- KXWCPRICE (Financials, ~459K)
- KXWCMESSIRONALDO (~450K) — **named in fact-base**
- KXWCGBOOTGOALS, KXWCMBAPPEGOALLEADER, KXWCGOLDENBOOTCLEAT — **named in fact-base**
- Cross-category novelty: KXWCFINALSONGS, KXWCATTEND, KXWCOCUSA/MEX/CAN, KXWCVIEWERSHIP, KXWCATTENDSWIFT, KXWCSONG (Entertainment)
- KXFIFATRAVEL, KXWCGOALSTREAK, KXWCGROUPGOALS, others (smaller volume)

**Extra discoveries (audit bonus):**
- KXTRUMPWORLDCUP, KXFIFATRAVEL (Politics)
- KXWCADS, KXWCPRICE (Financials novelty)
- KXWCATTEND, KXWCFINALSONGS, KXWCOCUSA/MEX/CAN, KXWCVIEWERSHIP, KXWCATTENDSWIFT, KXWCSONG (Entertainment)
- All 9 misses in fact-base are real; discovery and scope definition was incomplete

---

## Data-Quality Flags for Gate 1 Audit

1. **Ambiguous scope:** KXFIFAADVANCE/GAME/TOTAL/SPREAD (4 series, 163 events, 0 markets) are 2026 Qualifiers/playoffs, not the tournament proper. Excluded from narrative but kept in catalog as audit trail.

2. **Zero-volume markets:** 4,514 of 31,187 (14.5%) never traded. Concentrated in per-match derivatives (2,786) and player props (1,213). Recommend skipping these from tick/candle pulls (~172k requests saved).

3. **close_time is placeholder for active markets:** Still-`active` markets carry far-future close_time (e.g., 2028-07-18 for KXMENWORLDCUP legs, +1 month for in-progress derivatives). Tick-pull must gate on status or overshoot lifetime windows. *(Sizing probe already corrects.)*

4. **Highest-volume market:** KXWCADVANCE-26JUL05MEXENG-MEX (Mexico vs England R16 elimination) at ~159M contracts — exceeds any individual winner leg, likely heavy host-nation hedging.

5. **Rate limits tighter than baseline:** 7 HTTP 429s during ~330-request catalog pull at client's 5 req/s (well under documented Basic-tier equivalent). Retry/backoff load-bearing for larger tick-pull stage.

6. **Field format consistency:** All volume/open-interest arrive as *_fp fixed-point strings only (e.g., '245.90' contracts). No market carries legacy integer field. Both raw *_fp and parsed float columns (volume_contracts, open_interest_contracts, liquidity_usd, last_price_usd) stored in parquet.

7. **series.parquet audit columns:** `matched_by` ('prefix' | 'title_text') and `family` columns present for downstream re-scoping without re-derivation.

8. **Fact-base claim revision:** ~80 KXWC*-prefixed Sports series claimed; live API shows 111 (109 after esports/basketball exclusions). Inventory covers 99. KXWC2HSCORE does not exist; KXWC1HSCORE does — real asymmetry on Kalshi.

---

**Parquet location:** `/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/pipeline/data/catalog/markets.parquet`  
**Audit scratch data:** `/private/tmp/claude-501/-Users-kushaldsouza-Documents-Thinking-fifaworldcup2026/cb9c7a0e-6d7e-4b6f-b854-d62b6af6bc3e/scratchpad/all_series.json`
