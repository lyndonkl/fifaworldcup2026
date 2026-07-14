# Kalshi 2026 World Cup Market Catalog Summary

**Date:** 2026-07-13 (v1), remediated 2026-07-13 (v2, same day — see "v2 remediation" below)
**Source:** `pipeline/data/catalog/markets.parquet` (34,706 rows, v2)

## Headline Counts (v2, current)

| Metric | Value |
|--------|-------|
| Series | 138 (133 in narrative scope + 5 flagged `in_narrative_scope=False`, kept for audit trail) |
| Events | 3,278 |
| Markets | 34,706 (34,692 in-scope) |
| Total Contract Volume | 12.02B |

*(v1 numbers, superseded below: 110 series / 3,119 events / 31,187 markets / 11.89B contracts — the rest of this document is the original v1 write-up, left intact as the audit trail. Read "v2 remediation" first for what changed and why.)*

---

## v2 Remediation (2026-07-13)

An adversarial audit (`research/catalog-gaps.json`) ran a few hours after v1 shipped and independently re-enumerated the live Kalshi catalog. It found v1's crawler (`pipeline/ingest/catalog.py`) had two filter bugs that caused it to miss 23 gap-list entries (25 individual series tickers, ~500 markets, ~2.9M contracts of volume) that were genuinely part of the 2026 FIFA World Cup universe on Kalshi.

### What was missed

25 series across 5 categories, all now confirmed present:

- **Player props:** KXWCMESSIMBAPPE, KXWCMESSIRONALDO, KXWCGBOOTGOALS, KXWCMBAPPEGOALLEADER, KXWCGOALSTREAK, KXWCGOLDENBOOTCLEAT
- **Group-stage:** KXWCGROUPBOTTOM (biggest single miss, ~872K contracts), KXWCGROUPGOALS
- **Novelty/off-pitch (Financials):** KXWCADS ("World Cup Advertisements"), KXWCPRICE ("World Cup Ticket Prices")
- **Novelty/off-pitch (Entertainment):** KXWCFINALSONGS, KXWCATTEND, KXWCOCUSA/KXWCOCMEX/KXWCOCCAN (opening-ceremony setlists), KXWCVIEWERSHIP, KXWCATTENDSWIFT, KXWCSONG, KXWCUPSONG (0 markets — song not yet picked)
- **Novelty/off-pitch (Politics):** KXTRUMPWORLDCUP, KXFIFATRAVEL, KXFIFAPEACE (0 markets — event live, not yet opened), KXRONALDOTRUMPHANDSHAKE (0 markets — event live, not yet opened)
- **Player-goal combo:** KXWCGOALCOMBO (177 markets, the largest single miss by market count)
- **Borderline, flagged out of narrative scope:** KXWCHOST ("World Soccer Cup Host Country" — the 2038 host-selection market; WC-branded, not the 2026 tournament)
- **Bonus finds beyond the gap list**, caught by the same fix and included via the same explicit-include mechanism: KXPERSONATTENDTRUMP (0 markets), KXMESSIWCDEAL (0 markets), plus a series the audit didn't name at all — KXWCMENTION (Mentions category, 103 events / 3,005 markets, ~129M contracts) — discovered simply by crawling every category instead of a curated list.

*(KXWCFIRSTSONG was already present in v1 — Kalshi cross-lists it under both Sports and Entertainment category queries, so it slipped into the Sports-only v1 pull despite its true category being Entertainment.)*

### Why: the two filter bugs

**Bug 1 — Sports-only crawl.** `discover_series()` called `client.get_series_list(category="Sports")` exclusively. Kalshi's live catalog has 11,384 unique series across 18 categories; every WC-related series that Kalshi tags Financials, Entertainment, Politics, or Mentions (ads, ticket prices, opening-ceremony setlists, attendance, Trump/Messi/Ronaldo novelty props, broadcast mentions) was structurally unreachable no matter how good the title/prefix filter was.

**Bug 2 — filter logic collapsed two OR-branches into one AND-gated pass.** v1's code ran the prefix strategy first, then only evaluated the secondary title-text strategy against series the prefix strategy had *already rejected*, using a curated `TEXT_MATCH_INCLUSIONS` allow-list that had to name every non-KXWC-prefixed series by hand to survive. Series that were both non-KXWC-prefixed AND not manually pre-listed (e.g. KXTRUMPWORLDCUP, KXFIFAPEACE, KXWCADS's Financials sibling KXWCPRICE) had no path into the catalog even though their titles plainly said "World Cup" or "FIFA." Two series (KXRONALDOTRUMPHANDSHAKE, KXMESSIWCDEAL) don't contain "world cup" or "fifa" in their titles at all and needed a third path — an explicit include list — that v1 didn't have.

### What changed

`pipeline/ingest/catalog.py` was rewritten (see the module docstring and `discover_series()`/`run()` for the full mechanics):

1. **All categories, one call.** `client.get_series_list(category=None)` returns the entire live catalog (11,384 unique series, no cursor) in one page — a strict superset of even the auditor's own 12-category loop (which itself missed the Elections/Mentions/Exotics/Education categories, undercounting at 9,370).
2. **Three independent OR-branches**, unioned before any exclusion is applied:
   - (a) ticker prefix ∈ {`KXWC`, `KXMENWORLDCUP`}
   - (b) title contains "world cup" or "fifa" (case-insensitive)
   - (c) ticker ∈ an explicit include list, regex-sourced directly from `research/catalog-gaps.json`'s `missing` + `extra_discoveries` arrays (traceable to the audit, not re-transcribed by hand)
3. **A curated exclusion denylist** is applied to the union *after* step 2, so over-inclusive sourcing in (c) is safe: `KXWCCODWARZONE` + `KXEWC*` (2025 Esports World Cup), `KXWCCREG` (West Coast Conference), `KXCLUBWC*` (FIFA Club World Cup, a different tournament), `KX*T20WORLDCUP` (cricket), `KXFIFAWGAME` (women's internationals), `KXMWORLDCUP` (dead duplicate ticker), plus two extras the all-categories crawl surfaced and the task brief didn't name but the auditor flagged for "filter hygiene": `KXWCPI-RU`/`KXWCPI-TR` (Russian/Turkish inflation gauges that happen to share the `KXWC` prefix).
4. **Two series stay cataloged but flagged `in_narrative_scope=False`** with a `scope_note` explaining why, rather than being silently dropped: `KXWCHOST` (2038 host selection) and the four qualifying/playoff shells `KXFIFAADVANCE`/`KXFIFAGAME`/`KXFIFATOTAL`/`KXFIFASPREAD` (pre-tournament, still 0 markets, carried over unchanged from v1). Both `series.parquet` and `markets.parquet` now carry `in_narrative_scope` (bool) and `scope_note` (string) columns — retrofitted onto every pre-existing v1 row, not just the new ones.
5. **Additive merge, nothing deleted.** `run()` loads the existing parquet files, only enumerates events/markets for the 28 series not already present, and concatenates — the full v1 audit trail (all 110 series, all 31,187 market rows) is intact inside the v2 files.

### Self-verification (2026-07-13)

- **All 23 `catalog-gaps.json` `missing` entries present** (25 individual tickers once the one bundled entry is expanded) — 0 still missing. 22 of 25 carry nonzero markets; 3 genuinely have 0 markets as the gap list itself predicted (`KXFIFAPEACE`, `KXRONALDOTRUMPHANDSHAKE`, `KXWCUPSONG` — events exist, markets not yet opened by Kalshi) and are recorded as such rather than treated as failures.
- **All 32 curated exclusion tickers checked absent** from both `series.parquet` and `markets.parquet` (0 leaked rows) — the 20-member `KXEWC*` esports family, `KXWCCODWARZONE`, `KXWCCREG`, `KXCLUBWC`/`KXCLUBWCHOST`, `KXT20WORLDCUP`/`KXWT20WORLDCUP`, `KXFIFAWGAME`, `KXMWORLDCUP`, `KXAUSTINMAJOR`/`KXTORONTOULTRACHAMPIONSHIP` (esports mislabeled without an `KXEWC` prefix), `KXWCPI-RU`/`KXWCPI-TR`.
- **No duplicate tickers** in either parquet file (series or market level).
- **Final counts:** 138 series (5 flagged out of narrative scope), 3,278 events, 34,706 market rows (3,519 new), 12.02B total contract volume. Category breakdown of the 138 series: Sports 119, Entertainment 11, Politics 4, Financials 3, Mentions 1.

---

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
