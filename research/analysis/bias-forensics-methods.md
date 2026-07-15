# Bias Forensics — methods note (Act 4 input)

Scope: settled/played data only — the 28 finalized knockout matches, all
finalized Kalshi markets, and Pinnacle/Opta/Ipsos/Pew snapshots through
2026-07-13. The France-Spain semifinal (2026-07-14) is in progress as this
analysis runs and is explicitly excluded from every realized-outcome test;
one late-arriving data point (a 2026-07-14 pre-kickoff repricing on the
Golden Boot book) was observed and is called out but not used as evidence.
R1-R9 (`research/data-audit.md`) are obeyed throughout; each script below
notes which rules bind.

All scripts: `pipeline/analysis/bias_forensics_*.py`, run with
`pipeline/.venv/bin/python`. All derived tables:
`pipeline/data/analysis/bias-forensics/*.parquet`.

## 1. Favorite-longshot bias (FLB)

**Universe:** every Kalshi market with `status='finalized'`, `result IN
('yes','no')`, `in_narrative_scope=TRUE`, `volume_contracts>0` (i.e. it has
real trade-tape history) — 28,711 markets, spanning every WC26 contract
family (winner futures, match legs, player props, novelty markets).

**T-1h definition:** for each market, T = `settlement_ts` (the moment the
real-world question resolved — the only anchor that generalizes across
market types, since not all of them have a "kickoff"). Price-at-T-1h = the
last executed trade's `yes_price_usd` at or before `settlement_ts - 3600s`,
found via a single grouped join against the full 71.78M-row trade tape
(`pipeline/data/kalshi/trades/series_ticker=*/*.parquet`), never inferring
order from file/row position (R8) — always filtered/sorted on `created_ts`.
879 markets whose entire trading life falls inside the final hour are
dropped (no pre-cutoff observation); 27,832 remain.

**Buckets:** 5-cent bins, `[1,5),[5,10),...,[95,99]`, matching the brief's
"1-5c,...,90-99c" pattern. Two views: market-count basis (one Bernoulli
observation per market — the standard FLB unit) and volume-weighted basis.

**Script:** `pipeline/analysis/bias_forensics_01_flb.py`. **Output:**
`flb_kalshi_buckets.parquet`, `flb_kalshi_buckets_volweighted.parquet`,
`flb_kalshi_market_level.parquet` (27,832 rows, full re-derivation base).

**Matched Kalshi-vs-Pinnacle cut:** the 28 finalized KO matches via
`audit/entity_map.parquet`, 3 legs each (team1/draw/team2) = 84
observations per source, same T-1h-before-settlement anchor applied
per-match (so both sources are read at the identical real-world instant).
Pinnacle side: `bookmaker='pinnacle'`, `market_name='Full Time Result'`
(the correct FTR/90-min comparator per R4), `price_decimal>=1.01` and
`overround_at_ts NOT IN (NULL,0)` (R2), de-duplicated on ms-precision
`created_at` via `arg_max` (R1). `outcome_id` mapping (101=team1,
102=draw, 103=team2) verified empirically against France-Sweden (outcome
101 priced ~1.11 decimal, France the eventual 3-0 favorite). **Caveat:**
n=84 is small and at least one leg (Belgium-Senegal, R32) shows a large
instantaneous divergence traceable to Pinnacle being ~25-40s stale into a
live scoring swing while Kalshi's tape shows near-zero staleness (~0.8s) —
a genuine cross-source reaction-lag artifact, not a data defect, but a
reason to read the matched-comparison MAE numbers as directional, not
precise. **Script:** `bias_forensics_01b_flb_matched.py`. **Output:**
`flb_matched_kalshi_vs_pinnacle.parquet`.

**Dollar-volume approximation:** "aggregate excess $" = sum over markets in
a price band of `(price_t_minus_1h - realized_yes) * volume_contracts`.
This assumes the T-1h price is representative of each market's
volume-weighted average trade price — a reasonable proxy for thin/flat
markets, an understatement or overstatement for markets that moved a lot
before T-1h. Flagged as approximate wherever cited.

## 2. US/Mexico/Canada home-nation bias

**(A) Futures attention premium:** Kalshi lifetime `volume_contracts` for
each `KXMENWORLDCUP-26-<code>` leg joined to Opta's pre-tournament
`win_pct` (stage_id=1, `pipeline/data/benchmarks/opinion/opta.parquet`),
name-mapped (`USA`->`United States`). Peer band = Opta win_pct in [0.9%,
2.0%]. **Script:** `bias_forensics_02_us_home_bias.py` part A. **Output:**
`us_home_bias_futures_peer.parquet`.

**(B/C) Match-level time series:** the three R16 host-elimination matches
(USA-BEL, MEX-ENG, CAN-MAR). Both sources resampled to 1-minute bins
(R7: forward-filled last value per minute, no sub-minute point comparisons)
over `[kickoff-120min, kickoff+100min]` (kickoff = Pinnacle
`fixture_start_time`; window end covers the KXWCGAME 90-min regulation
settlement per R4). Pinnacle side same filters as above (R1/R2). Dollar
volume per minute = `sum(yes_price_usd * count_contracts)` from the trade
tape. **Script:** `bias_forensics_02_us_home_bias.py` part B/C. **Output:**
`us_home_bias_matchlevel.parquet` (summary), `us_home_bias_matchlevel_series.parquet`
(1,320-row full time series, pre/post-kickoff split computed by filtering
`minute_from_kickoff_minus120 < 0` vs `>= 0`).

**Narrative contrast (no derived table, cited from source):** Ipsos Global
Advisor "Predictions 2026" (fielded Oct 24-Nov 7 2025, n=23,642): 87% of
Argentinian respondents picked Argentina to win outright, vs Kalshi's
Argentina winner-leg trading at 9c on 2025-11-07 (last trade at or before
23:59 that day). Pew Research (fielded 2026-03-23 to 03-29): 7% of
interested US respondents named the USA, vs Kalshi's USA leg at 1.5c on
2026-06-01 and Opta's model at 1.2% the same date. Sources:
`pipeline/data/benchmarks/opinion/polls.parquet`,
`pipeline/data/benchmarks/opinion/opta.parquet`, `research/fact-base.json`.

## 3. Post-upset recency

**Operationalization:** the "surviving longshot" for each cited shock is the
team that won the shock match (the direct beneficiary): Paraguay (beat
Germany, R32 pens), Norway (beat Brazil, R16), Belgium (beat USA, R16, the
last of the three co-hosts to fall). Shock instant = the winner's
`KXWCADVANCE` settlement_ts (elimination-confirmed instant, correct for
AET/pens per R4/R9). Tracked the beneficiary's own `KXMENWORLDCUP` winner-leg
price at shock-24h, shock-6h, shock-3h, shock-1h, shock (last trade at/before
each offset), then +24h/+48h/+72h, plus an hourly trajectory from -24h to
+96h (forward-filled). **Script:** `bias_forensics_03_post_upset_drift.py`.
**Output:** `post_upset_drift.parquet` (summary), `post_upset_drift_series.parquet`
(hourly trajectory, 3 teams x 121 hours).

## 4. Elimination lag ("zombie money")

**(A) Futures-settlement-lag cut:** for each of the 28 KO losers (loser =
team1/team2 whichever != `advance_result` in entity_map), elimination
instant = that team's `KXWCADVANCE` leg settlement_ts; then every trade on
that team's own `KXMENWORLDCUP` winner leg with `created_ts` between
elimination and that leg's *own* settlement_ts is "zombie" trading (money
moving on a market whose real-world answer is already locked but not yet
formally paid out). **Script:** `bias_forensics_04_zombie_money.py`.
**Output:** `zombie_money.parquet`, `zombie_money_trades.parquet`.

**(B) Broad team-prop sweep:** every market whose `event_ticker` embeds the
eliminated team's 3-letter code within a fixed list of team-scoped prop
series (`KXWCPLAYERGOALS`, `KXWCTEAMTOTALGOALS`, `KXWCSTAGEOFELIM`,
`KXWCTEAMLEADGOAL`, `KXWCSQUAD`, `KXWCTEAMGOALS` — verified by inspecting
`event_ticker` format per series, all follow `SERIES-26<CODE>`). All trades
on those tickers with `created_ts` after the team's elimination instant,
split into all-zombie-trades vs trades at `yes_price_usd >= 0.01` (the
brief's "above 1c" bar). **Script:** `bias_forensics_04b_zombie_broad.py`.
**Output:** `zombie_money_broad.parquet`, `zombie_money_broad_trades_above1c.parquet`.

## 5. Prop-market irrationality — Golden Boot

Daily (UTC-day, last trade) close price for six Golden Boot legs
(`KXWCGOALLEADER-26-*`) across full market life, truncated at 2026-07-13
end-of-day (excludes the in-progress Jul 14 semifinal). Realized goal
counts (Mbappe 8, Messi 8, Haaland 7, Kane 6) are cited directly from
`research/fact-base.json`'s storylines (sourced ESPN/Goal.com/Yahoo, cross-
checked against the tournament's own knockout-round narrative) — Kalshi has
no settled per-player goal-count ladder (`KXWCPLAYERGOALS` is binary
"scored at all," not a count), so this one comparator is external by
necessity, exactly as the brief itself frames the comparison ("Kane at 6
goals vs Mbappe/Messi at 8"). **Script:** `bias_forensics_05_golden_boot.py`.
**Output:** `golden_boot_daily.parquet`, `golden_boot_snapshot.parquet`.

## Rule compliance summary

- R1 (Pinnacle ms-dedup): applied in 01b and 02 via `arg_max(...,created_at)`.
- R2 (`price_decimal>=1.01`, `overround_at_ts` NaN-treatment): applied in 01b and 02.
- R3 (single-print glitches): the Belgium-Senegal divergence in 01b was checked
  tick-by-tick and found to be a genuine reaction-lag event, not a glitch —
  documented rather than silently filtered.
- R4 (regulation-vs-advance settlement): KXWCGAME legs and their `result`
  field used as-is (validated correct upstream); KXWCADVANCE used
  specifically for elimination-instant timing in analyses 3 and 4.
- R5 (Polymarket elimination zeroing): not applicable — this arm does not
  use the Polymarket winner-futures book.
- R6 (trade-tape sums, not catalog `volume`): every volume/dollar figure in
  this arm is computed from `read_parquet('.../trades/...')`, never from
  `markets.parquet`'s `volume_contracts`/`volume_fp` fields, except for the
  Opta-peer attention-premium table (analysis 2A) where lifetime
  `volume_contracts` from the catalog is used deliberately as a summary
  cross-check — acceptable there since R6's <=5.2% overstatement is far
  smaller than the 4-7x effect being measured.
- R7 (1-min resampling, 0.15 floor): applied in analysis 2B/C's match-level
  time series; NOT applied in 01b's point-in-time matched comparison,
  which is why 01b's per-match numbers are flagged noisy rather than
  headline-grade.
- R8 (no row-order inference from parallel glob): every timestamp filter
  uses explicit `created_ts`/`settlement_ts` columns; glob scans are used
  only for unordered aggregation.
- R9 (status-gated lifetimes, KXWC3RDPLACE placeholder): all universes
  filtered on `status='finalized'`, not `close_time`; KXWC3RDPLACE not used.
