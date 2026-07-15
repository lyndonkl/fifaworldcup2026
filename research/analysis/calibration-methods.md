# Arm: Calibration Verdict — Methods Note

**Scope:** 28 finalized (settled) knockout matches + all other settled Kalshi
WC26 markets as of 2026-07-13/14. The two semifinals (FRA-ESP, ENG-ARG) are
excluded from every cross-source panel because `entity_map.match_status` for
both is `scheduled` (G1/G2 in the data audit — no in-game tape exists yet).
All scripts live in `pipeline/analysis/calibration_*.py` and are run with
`pipeline/.venv/bin/python`, in this order:
`calibration_extract.py` → `calibration_match3way.py` → `calibration_scores.py`
→ `calibration_divergence.py` → `calibration_divergence_pm.py` →
`calibration_semifinalists.py` → `calibration_polls.py` → `calibration_curves.py`.
Outputs: `pipeline/data/analysis/calibration/*.{parquet,csv}`.

## Data joins and rule compliance (R1–R9)

- **Entity matching**: exclusively via `pipeline/data/audit/entity_map.parquet`
  (Kalshi legs ↔ Polymarket tokens ↔ Pinnacle `fixture_id`), never re-derived
  by name-matching. Pinnacle `outcome_id` convention confirmed empirically:
  101 = `team1` (win), 102 = draw, 103 = `team2` (win), where `team1`/`team2`
  order matches `entity_map.team1_code`/`team2_code` (verified against
  `participant1`/`participant2` for JUL11ARGSUI).
- **R4 (regulation vs advancement)**: all scoring uses `KXWCGAME` (regulation,
  90-min) markets, never `KXWCADVANCE`. `result`/`settlement_ts` pulled
  straight from `pipeline/data/catalog/markets.parquet`.
- **R1/R2/R3 (Pinnacle hygiene)**: every Pinnacle query filters
  `bookmaker='pinnacle'`, `market_name='Full Time Result'`,
  `price_decimal >= 1.01`, `overround_at_ts IS NOT NULL AND != 0`; dedup on
  ms-precision `created_at`. R3 single-print reversion screen: a tick is
  dropped if both neighbours are <=5s away, both jump >15pp from it, and the
  two neighbours agree with each other within 5pp (`calibration_match3way.py`
  dropped 1 such row of 161,852 in the raw 28-match FTR subset).
- **R5 (Polymarket stale eliminated legs)**: not applicable to this arm's
  horizon-based extraction, since all Polymarket price pulls are ASOF-joined
  to timestamps at or before each team's own settlement moment, i.e. before
  the post-elimination staleness window R5 describes.
- **R6**: not applicable (this arm never uses the catalog `volume` field).
- **R7 (1-min resampling, 0.15pp floor, full swing inventory)**: the
  divergence detector (`calibration_divergence.py`) grids both sources to a
  common 1-minute clock (values held via forward-fill through gaps), applies
  a 0.15-probability-point (0.0015) floor below which a gap is treated as
  zero, and walks the *entire* 150-minute pre-settlement window of *every*
  leg of *every* one of the 28 matches (not just the single biggest swing).
- **R8**: no ordering is inferred from parallel glob scans; every "last value
  before target" lookup uses either an explicit `ASOF JOIN` (DuckDB 1.5.4,
  which sorts internally) or an `ORDER BY ... LIMIT 1` correlated query.
- **R9**: `status`, not `close_time`, gates every market as "finalized" before
  it enters a scoring panel.

## A bug caught and fixed during this arm (documented for transparency)

An early version of the epoch-conversion (`pandas.Timestamp.astype('int64')
// 10**9`) silently truncated all target timestamps to *microsecond* epoch
divided by a *nanosecond* divisor (parquet round-trips through DuckDB come
back as `datetime64[us]`, not `[ns]`), producing timestamps 1000x too small
and 100% NULL joins. Fixed by dividing via an explicit `pd.Timedelta(seconds=1)`
in every script. A second bug (1-min grid not aligned to :00-second
boundaries) caused the divergence detector to silently return zero episodes
on every match; fixed by flooring window bounds to 60-second multiples before
building the grid. Both are called out here because they would have produced
confidently-wrong "no divergence" and "all-NaN" findings if unnoticed — the
divergence and cross-source-Brier numbers below were re-run and manually
spot-checked (BELSEN tie leg, ARGSUI leg) after both fixes.

## A selection artifact caught and *excluded* from the findings

The winner-futures family (`KXMENWORLDCUP`) has only 44 settled markets as of
this pull, and **all 44 settled "No"** (the champion is not yet known — the
final hasn't been played). A calibration-curve decile analysis computed on
only-losers is guaranteed by construction to show `realized_freq = 0.0` in
every non-zero probability bin, which would misleadingly look like "100%
overconfidence at every price level." This is a censoring artifact, not a
market-quality signal, and is excluded from the reported findings (the
decile table is still written to `calibration_curves_deciles.csv` /
`family=winner_futures` for transparency, clearly labeled). The fixed-horizon
Brier/log-score comparison for winner futures (Kalshi vs Polymarket, same 44
teams) remains valid as a **relative**, head-to-head comparison — both
sources face the identical, easy base rate — but is not treated as an
absolute skill claim.

## Definitions

- **Resolution moment** = `settlement_ts` (fallback `close_time`) from the
  catalog. Horizons T-24h/T-1h/T-5min are computed backward from this
  timestamp, not from kickoff. For match 3-ways (which settle at the final
  whistle, ~90min+stoppage after kickoff), T-1h before resolution falls
  roughly around half-time; T-5min falls in second-half stoppage time.
- **Price** = last non-null 1-minute candle close (`price_close_usd`) for
  Kalshi; `implied_prob` (mid-derived) for Polymarket; `implied_prob_devigged`
  (proportional de-vig across the 3-way book) for Pinnacle.
- **Brier score** = mean((p − outcome)²); **log score** = mean of the
  negative log-likelihood, clipped to [1e-4, 1−1e-4].
- **Elo-implied strength share (semifinalist scope only)**: softmax on
  `10^(rating/400)` restricted to the four eventual semifinalists at each
  Opta snapshot date — a standard Bradley-Terry-style generalization of the
  pairwise Elo win-probability kernel, **not** a full 48-team bracket win
  probability (that would require simulating the whole draw, out of scope).
  Labeled accordingly everywhere it's used.

## Known limitations

- Calibration-curve deciles pool every 1-minute tick across a market's life
  (standard prediction-market-calibration practice, e.g. Wolfers &
  Zitzewitz), which means raw tick counts overstate independent trials —
  ticks within one match are highly autocorrelated. Each decile's "n
  distinct matches" was spot-checked (e.g. match-3way deciles 8/9 draw from
  122 and 150 distinct match-legs respectively, not one outlier game) but a
  per-match (not per-tick) robustness check was not run for every decile
  given the time budget.
- Poll-vs-market gaps compare a *publish-date* market price against a survey
  whose *field* window can be much earlier (Pew: published 2026-06-02, fielded
  2026-03-23–29, ~10 weeks earlier) — the gap conflates "market is sharper"
  with "market had 10 more weeks of information," and is flagged as such at
  point of use.
- Ipsos's item is an agree/disagree statement ("Argentina will win the World
  Cup again"), not an open probability elicitation; framing effects
  (acquiescence bias) plausibly inflate agreement versus a neutral forecast
  question, noted at point of use.
