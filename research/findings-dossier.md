# Findings Dossier: Gate 2

**The Market Watched the World Cup** · Phase 2 artifact · frozen 2026-07-14, pre-semifinal snapshot (France-Spain in play at freeze; England-Argentina July 15; final July 19).

Twenty-nine findings survived adversarial verification; twenty-eight of them survived only after their first interpretation died. Every claim in this dossier is the corrected claim that outlived both refuters (a method check re-derived from the raw store, an interpretation check attacking the meaning). The original phrasings are dead. The storyboard must not reach back to them, and the eleven killed findings listed in section 5 stay killed.

## 1. The verdict

The market proved to be a mechanism, not a mood: every folk sin attributed to it (dumb retail, goal-spike overreaction, home-team patriotism, zombie money) dissolved under verification into structure, meaning cross-venue arbitrage, settlement semantics, bookmaker suspension policy, and exchange listing mechanics. What it demonstrably did is hold one price across two retail venues to within three quarters of a point for an entire knockout stage,[^1] match the professional book's accuracy at every horizon where both were live,[^2] and reprice conditional tournament paths (brackets, scorer races, expiring contracts) within seconds of news. Its genuine residuals are three, and they power the ending: a stubborn thirteen-month conviction that France was better than the model said,[^3] a modest lottery premium on cheap yes-legs in thin prop ladders where almost no money lived,[^13] and an attention economy (hosts, prime time, the tournament itself) that moved volume by multiples while barely moving price.

## 2. Findings, ranked by narrative power times robustness

The ranking is this analyst's call. Badge format: verdict, then what the method refuter reproduced, then what the interpretation refuter corrected. Acts follow CLAUDE.md: 1 calibration, 2 microstructure, 3 volume, 4 bias.

### Tier 1: tentpole scenes

- **R1 · vol-01 · Act 3 · PLAUSIBLE** (method: reproduced to the dollar; interp: the press figure reframed from error to accurate, week-stale floor). Claim: the reconciled tape totals $10.94B through July 8 and $12.3B at the July 14 snapshot; the ">$7.4B" press number equals the tape's own cumulative as of roughly June 30, and 98.6% of lifetime volume traded in-tournament largely because three quarters of notional sits in per-match families that did not exist before kickoff.[^8] Effect: +48% over the press floor at matched dates, +66% at snapshot. Scene: the Act 3 opener; a running dollar counter ticks past a marker labeled "press floor, ~one week stale" and keeps climbing to the tape's dated number.

- **R2 · cal-04 · Act 1 · PLAUSIBLE** (method: exact, zero episodes invariant down to a 2pp threshold; interp: the Pinnacle contrast reframed as feed termination). Claim: across 84 knockout 3-way legs, Kalshi and Polymarket never sustained a 5pp gap for 30 minutes; mean one-minute gap 0.74pp, with 41.6pp goal-second spikes lasting exactly one minute.[^1] The 16 Kalshi-Pinnacle "divergence episodes" are off-limits as disagreement: all 16 begin within about two minutes of Pinnacle's final quote and contain zero fresh ticks. Scene: two retail lines braided as one; Pinnacle's line goes dashed and grey at its last tick, captioned "no longer quoting."

- **R3 · ig-01 + ig-10 · Act 2 · PLAUSIBLE** (method: every median exact to 0.0s; interp: the speed ladder killed, the mechanism story survives). Claim: the venues differ in post-goal mechanism, not demonstrated reaction speed. Kalshi's book trades continuously through the goal minute; Pinnacle suspends a median ~32 seconds after the anchor (as fast as Kalshi's first repricing trades), goes dark ~80 seconds, then reopens with a single quote already at the new fair level; Polymarket's stored data cannot resolve anything under 60 seconds.[^4] Effect: the 29s/60s/119s "ladder" is three different measurement artifacts. Scene: the Act 2 set piece, dots on one post-goal clock with Pinnacle's suspension window drawn as literal darkness; caption "continuous tradability versus suspend-and-repost."

- **R4 · ig-07 · Act 2 · PLAUSIBLE** (method: exact tick-for-tick, kickoff independently verified; interp: "fakes a goal reaction" corrected to readily distinguishable expiry decay). Claim: on matches level after 90 minutes the regulation market converges deterministically to its tie-locked price (Germany-Paraguay's GER leg: 0.48 to 0.01 over 22 minutes on accelerating settlement volume) while the advancement market barely moves and trades through the shootout for another hour; goals jump 0.19-0.25 inside 30 seconds, the decay never exceeds 0.07 per minute.[^5] Scene: the credibility explainer before the shootout zoom, two synchronized paths, one dying at the whistle; caption "which market you watch matters."

- **R5 · cal-05 · Act 1 · PLAUSIBLE** (method: all scores to 3-4 significant figures; interp: staleness story replaced by market-lifetime artifact). Claim: at T-24h and T-1h all three sources post near-identical Brier scores (0.158-0.169) on the same 84 legs; the T-5min blowout (Kalshi 0.0026 vs Pinnacle 0.0974) scores live post-event repricing against a product that has ceased to exist, since bookmaker in-play books end at the whistle by design and ~74% of Pinnacle's error comes from five matches with stoppage-time goals landing after its book closed.[^2] Scene: the three-line verdict chart with the T-5min column crossed out on screen as the narration explains why.

- **R6 · cal-06 · Act 1, feeds the ending · PLAUSIBLE** (method: all ten stage gaps exact to 0.1pp; interp: raw +5.6pp trimmed for the un-devigged book, Elo corroboration dropped as double counting). Claim: at all five Opta stage snapshots the market priced France above the model and Spain at or below it; devigged the France premium runs +3 to +5pp and the pattern is near-symmetric (~+3 France, ~-3 Spain), robust across venues (Polymarket mean +4.9pp). It is one persistent level disagreement read five times, not five confirmations.[^3] Scene: the strip chart, France's dot above the model line at every stage; the bridge into the final's reinterpretation.

- **R7 · bias-01 · Act 4 · PLAUSIBLE** (method: every bucket exact; interp: one-sided classic bias replaced by a thin-ladder lottery premium). Claim: cheap yes-legs underperform (1-10c implied 3.04%, paid 1.19% at T-1h; still roughly -47% relative on fresh prints), but the premium is specific to thin correlated prop ladders (72% of longshot observations sit in events with ten or more legs; 55% of the band sits at the 1-2c tick floor), and volume-weighted the gaps shrink to about half a point: the dollars actually traded were nearly calibrated.[^13] The 90-95c favorite bucket is separately the worst-calibrated of all, so the textbook one-sided story fails. Scene: the tentpole calibration curve with a markets-versus-dollars weight toggle that visibly flattens the sag.

- **R8 · vol-07 · Act 3 · PLAUSIBLE** (method: exact to the contract; interp: every claimed "speculation signature" shown to be an exchange-wide base rate). Claim: the catalog's biggest market (Mexico-England advancement, 158.7M contracts, ~1M trades) is ordinary Kalshi retail flow at extraordinary scale: typical trade sizes, the universal taker-yes skew, a more pre-match-heavy profile than the median knockout market; advancement out-trading the 3-way (5.5x) is structural to all 28 knockout matches.[^9] Nothing in the tape separates hedging from speculation at retail scale. Scene: the Act 3 tick-level zoom, captioned by what the tape can and cannot say about who was trading.

### Tier 2: supporting beats

- **R9 · bias-06 · Acts 2 and 4 · PLAUSIBLE** (method: every price to the 0.1c tick; interp: overreaction-and-fade replaced by conditional bracket repricing). Claim: all three shock beneficiaries popped live (Paraguay 5x, Norway ~3.6x, Belgium ~2x) and the 72-hour paths diverged with bracket news: Paraguay faded as France was confirmed next, Belgium converged on a known Spain quarterfinal, and Norway's +43h spike to 10.8c mirrored, minute for minute, Argentina's winner-leg crash while Egypt led.[^14] Scene: three overlaid paths, shock at zero; the Norway-Argentina mirror is the callout.

- **R10 · cal-09 + cal-10 · Acts 1 and 4 · PLAUSIBLE** (method: exact and timestamp-robust; interp: "-76pp calibration error" downgraded to a unit-honest contrast). Claim: fan belief and tradable prices are different instruments and the gap is enormous anyway: 87% of Argentine respondents agreed Argentina would repeat while the leg traded at 11c; 7% of Americans named USA while the US-listed exchange priced 1.5c, with co-host Mexico the only other negative gap and the European "market above poll" pattern largely a normalization artifact of 41% answering "not sure."[^6] Scene: two-bar-plus-dot comparisons with a visible units caption: agreement shares are not probabilities.

- **R11 · vol-04 + vol-05 + vol-06 · Act 3 · PLAUSIBLE ×3** (methods: exact; interps: schedule-versus-demographics attribution corrected throughout). Claim: the market's clock is the tournament's clock. 98.7% of lifetime volume traded in-tournament; kickoff-bracketing windows covering a third of tournament clock capture 54.7% of tournament volume (a ~1.6x tilt); the hour-of-day heatmap traces the kickoff histogram of a North America-hosted tournament, with a genuine but mild ~2x US-waking-hours residual; rest days fall 5-14.5x, mostly compositionally, while the always-open futures dim only ~3x, the cleaner attention measure.[^10] Scene: heatmap and heartbeat with the kickoff histogram overlaid so the confound is the caption.

- **R12 · bias-03 · Act 4 · PLAUSIBLE** (method: exact; interp: lifetime-volume-versus-prior-odds join rejected as run-length endogeneity). Claim: the host attention premium is real but roughly 2-2.5x in the clean pre-tournament window (USA 7.5M and Mexico 9.0M contracts versus Ecuador 3.6M and Croatia 3.4M at similar model odds), and it arrived with a price premium rather than instead of one: Mexico ~1.8x and USA ~1.5x their Opta odds on tournament eve.[^11] Scene: the bar pair, restricted honestly to the window where the teams were peers.

- **R13 · bias-09 + bias-10 · Act 4, feeds the ending · PLAUSIBLE ×2** (methods: exact to the cent; interps: tiebreak demoted to secondary resolver, "market knows more than the scoreline" inverted). Claim: the Golden Boot book prices scoring paths. Mbappe at 61c versus Messi's 31-32c on identical 8-goal tallies resolves first through expected future goals (they traded level on July 7-8 with Mbappe still a goal behind) and second through the contract's own assist tiebreak; Kane's 4c on six goals is fair under a plain Poisson read of realized rates, and his price halved on the day England won because he burned 120 scoreless minutes.[^15] Scene: the anti-gotcha pair: show the naive read, then the resolution; it models the piece's discipline about not crying bias.

- **R14 · vol-10 · Act 3 · PLAUSIBLE** (method: exact, drift explained by the re-drive; interp: order statistics flip the punchline). Claim: the biggest Trump-mention market drew a real, artifact-free 1.40M contracts (rank ~1,083 of 30,133), yet the correct reading inverts the joke: the maximum of a 3,005-market family trading at catalog base rate should land near rank 10, so the novelty family is ~100x thinner than base rate, and the Trump market was ~60x smaller than the moneyline on its own broadcast.[^12] Scene: one highlighted dot, captioned "America's biggest off-pitch market could not crack the top 1,000."

- **R15 · vol-08 + vol-09 · Act 3 · PLAUSIBLE ×2** (methods: exact; interps: corrected to listing mechanics). Claim: the pooled Gini of 0.930 (top 100 markets = 34.7% of volume) is mostly catalog composition: three core series' 414 legs absorb 63.5% of all dollars with a within-group Gini of 0.44, while 19,640 markets (56.6% of the catalog) carry 0.36% of volume, the standard options-chain shape produced by exhaustive listing plus a one-cent tick floor.[^16] Scene: the Lorenz curve as sorted particles; caption "Kalshi lists the outcome space, dollars find the plausible outcomes."

- **R16 · ig-05 · Act 2 · PLAUSIBLE** (method: exact to four decimals; interp: 18x re-anchored to its lifetime baseline). Claim: in-play adjustment is a frequency phenomenon: per-trade size grows ~15% while arrivals accelerate ~18x against the leg's lifetime baseline and ~5.4x at the kickoff step itself, since the pre-kick hour already runs about one print per second; part of the contrast is sweep fragmentation on thinner in-game books.[^17] Scene: the particle emission-rate animation, ramping pre-match, ~5x step at the whistle.

- **R17 · vol-02 · Act 1 prologue · PLAUSIBLE** (method: exact; interp: the draw fingerprint moved from volume to participation). Claim: draw week is a real but tiny stir, peaking at 190k contracts on December 5; the clean fingerprint is participation (176 mostly small trades in the reveal hour, day trade counts 3-8x neighbors) while the contract total is dominated by whale prints placed hours before the ceremony; peak match day is ~3,400x larger in contracts and ~21,000x in premium dollars.[^8] Scene: the heartbeat motif, a dormant year with one twitch.

- **R18 · vol-03 · Act 3 · PLAUSIBLE** (method: exact to the contract; interp: "dethroning" corrected to co-surge). Claim: match markets out-traded the futures book from the opening whistle (49.4M vs 31.6M contracts on day one) and passed its entire thirteen-month cumulative stock on day two, because the pre-tournament base was nearly empty and fast-settling match products structurally out-turn a futures book; the futures book set its own record the same day, at ~90x its pre-tournament pace.[^18] Scene: the cumulative race chart, crossover inside the first 48 hours of a fourteen-month timeline.

- **R19 · bias-02 · Act 4 · PLAUSIBLE** (method: MAEs to four decimals; interp: re-anchored to the pre-match horizon with an explicit power caveat). Claim: on the 28 knockout matches Kalshi's 3-way prices score about the same as de-vigged Pinnacle at T-24h (Brier 0.162 vs 0.164); the sample can rule out a large retail-versus-sharp gap and can establish nothing stronger, and the in-play comparison is contaminated by suspension staleness.[^19] Scene: the myth-buster beat, two dots nearly touching, narrated as small-n.

### Tier 3: methods and credibility material

- **R20 · ig-02 · Act 2 · PLAUSIBLE** (method: exact; interp: "already fair value" weakened to "no tradeable fade"). Claim: there is no exploitable post-goal fade at a 30-minute horizon; the median gap between jump and later level sits inside the ~2-cent tick-and-fee friction band, and every apparent overshoot traces to single-print order-book sweeps or expiry decay.[^20] Scene: one caption under the goal set piece: the spike is the price, within friction.

- **R21 · bias-07 · Act 4 · PLAUSIBLE** (method: exact, with a name-join fix restoring USA and DR Congo; interp: cleanliness attributed to settlement ops). Claim: dead teams' winner futures settle a median 20 minutes after elimination because both legs ride the same operational sweep, leaving no room for zombie money: 302 trades, ~$2,340, everything at or below one cent across all 28 knockout losers.[^21] Scene: a settlement-ops footnote; with bias-08 killed it no longer has a contrast payoff and should stay small.

- **R22 · ig-08 · Act 2 methods appendix · PLAUSIBLE** (method: exact; interp: a placebo test guts the "100% corroboration" figure). Claim: the tape-only detector finds 82 material repricing events (27 of 28 matches, zero on the goalless shootout match); it is a repricing-event list rather than a goal log, and the persuasive validation is the tightness of the cross-source matches (median offset one to two minutes at 5-8x the qualifying floors).[^4] Scene: one methods-appendix line; AET decay-zone events must be flagged wherever the list is used.

- **R23 · ig-06 · Act 2 design constraint · CONFIRMED** (the sweep's only confirmed finding; both refuters found the debunking understated). Claim: the uniform one-minute "Kalshi lead" over Polymarket is guaranteed by binning construction, since Polymarket's stored prices are native 60-second snapshots; the analysis bounds any real lead or lag to within ±60 seconds, and nothing finer is resolvable on this store by any method.[^22] Scene: none. This is a standing prohibition on any Kalshi-versus-Polymarket speed scene.

## 3. The ending's ammunition: lenses for the final's number

Six habits the reader will have learned by Act 4, each a way to read the frozen, timestamped odds on July 19.

**The consensus lens (R2, R5, R19).** How to read the number: as the number. At a day out, Kalshi, Polymarket, and the de-vigged professional book scored near-identically all tournament, and the two retail venues never sustained even a five-point disagreement for half an hour. The figure on screen the morning of the final is arbitrage-enforced and venue-independent; no book demonstrably knows more at that horizon. The piece should refuse the reflex that a "retail" price awaits correction by someone sharper. The sharp book agreed whenever it was quoting.

**The France-conviction lens (R6, conditional on France reaching the final).** How to read the number: as the last test of the market's most stubborn opinion. For thirteen months the market priced France three to five points above Opta's simulation at every published stage, with Spain the mirror image, one persistent level disagreement rather than five independent reads. If France's number looks rich against the model on final morning, that is not final-week froth; it is the same conviction the market held before a ball was kicked. The ending can stake the v2 epilogue on whether that conviction was information or attachment.

**The mechanism lens for live reading (R3, R4).** How to read the number during the match: know which instrument is speaking. When a goal lands, Kalshi trades through the whole move while the professional book suspends and reposts minutes later; a widening gap mid-match means one venue stopped quoting, and it means nothing else. And if the final is level near minute 90, the regulation market will grind toward its tie-locked price by construction while belief lives in the advancement and futures legs. The scene must switch instruments on screen exactly where the analysis had to.

**The fair-jump lens (R9, R20).** How to read the number after a shock: the spike is the price. Across 28 clean goal reactions the post-jump level held to within the friction band at a 30-minute horizon, and all three tournament shocks repriced to bracket arithmetic rather than fading from excess. If the underdog scores first in the final, the new number is not panic to be narrated; it is the market's honest conditional estimate, and the drift that follows will be news, not correction.

**The where-the-money-is lens (R7, R15).** How to read the number: trust the deep markets, discount the ladder. The one genuine mispricing found all tournament is a lottery premium on cheap yes-legs in thin correlated prop ladders, bounded below by the one-cent tick; volume-weighted, the big markets were nearly calibrated. The final's 3-way and winner legs are the deepest pools of the market's life and deserve the reader's trust; its first-scorer, exact-score, and mention props carry the lottery tax and deserve the reader's smile.

**The attention-is-not-belief lens (R8, R10, R12).** How to read the number against the noise of final day: whatever the flags say, the price was never patriotic. Argentine fans at 87% agreement met an 11-cent market; American respondents over-named a USA team the US-listed exchange held at a cent and a half; host attention multiplied volume while nudging price by a point or two at most. On July 19 the crowd's noise will be at maximum, and the reader will know that this market's prices absorbed attention without inheriting its loyalties.

## 4. Cross-arm connections

**One suspension mechanic, found three times.** The single largest discovery of the sweep belongs to no arm: Pinnacle's suspend-and-terminate policy generated the calibration arm's false "divergence episodes" and T-5min blowout, the microstructure arm's false "reaction ladder," and three of the five killed calibration findings. Three arms independently manufactured "Kalshi beats the professionals" from the same off-the-board artifact. The more interesting question is whether this becomes a scene itself: the wrong conclusion the data invited three separate times, caught three separate times.[^23]

**Bias lives exactly where volume is absent.** The Act 4 lottery premium (R7) concentrates in the thin prop-ladder tail that Act 3 (R15) shows carries 0.36% of all dollars; weight by money and the premium nearly vanishes. Calibration error and volume concentration are the same map at two exposures, and the two scenes should share a visual spine.

**One settlement rule, a family of ghosts.** The regulation-versus-advancement distinction (audit rule R4) explains ig-07's expiry decay, the negative tail in ig-02, the overcounts in ig-08, and the deaths of ig-09 and bias-08. A single catalog fact produced every "the market moved with no news" illusion in the sweep.

**Path pricing is one habit across arms.** Norway's winner leg spiking in lockstep with Argentina's crash (R9), Kane halving on a scoreless win (R13), and Mbappe trading level with Messi while a goal behind (R13) are the same behavior: the market prices remaining paths rather than headlines. This is the habit the ending leans on hardest.

**Host attention: loud in volume, faint in price, absent in error.** vol-07's biggest-market zoom, bias-03's 2-2.5x pre-tournament attention premium, and cal-10's co-hosts-only negative poll gaps triangulate one conclusion: the flags moved money in, and the prices barely noticed.

**Every clock is the tournament's clock.** vol-04/05/06's schedule confounds and cal-05's settlement-anchored horizons repeat one lesson: any time-based claim about this market must be corrected for the event calendar before it means anything. The methods appendix should say so once, plainly.

## 5. Honest limits

**PLAUSIBLE means corrected.** Twenty-eight of twenty-nine findings carry refuted first interpretations; the corrected claims in section 2 are the only publishable versions. The corrections that most change scenes: the reaction ladder is mechanism rather than speed (R3); the 16 divergence episodes are feed termination rather than disagreement (R2); the 18x kickoff figure is a lifetime-baseline number and the honest step is ~5x (R16); the favorite-longshot story is a thin-ladder lottery premium with a badly calibrated 90-95c bucket, so no clean "sags only at the cheap end" chart exists (R7); the 98.7%-after-kickoff stat is mostly listing mechanics (R1); the Trump-market punchline inverts on order statistics (R14).

**The semifinal and final re-drives move every snapshot number.** The tape already grew from $12.31B to $12.35B between the arm runs and verification; five France-Spain markets crossed the Trump market's rank between runs; the England-Argentina legs are frozen roughly 39 hours pre-kick, before the documented 16.4x day-of surge; Golden Boot prices moved sharply on partial July 14 data (Kane back to 8c, Mbappe halved to 30c, Messi to 59c). Every figure destined for a scene must be recomputed at the deploy-morning re-run and frozen with its timestamp, per the standing constraint in CLAUDE.md.

**Trends never arrived.** Act 3's planned volume-versus-attention beat has no search-interest series, so attention is proxied by participation counts, which are endogenous to the market itself. This is what the sweep could not separate cleanly: the ~2x US-waking-hours residual in R11 and the attention framing in R12 and R14 lack an independent attention benchmark, and the methods note should present the gap as a $0-budget coverage gap rather than an oversight.

**Small samples and missing clocks.** The knockout panel is 28 matches yielding 84 mechanically coupled legs (effective n of 28); it can rule out large venue-skill gaps and can establish parity nowhere. No external goal clock exists in the store, so all latency figures are anchored to Kalshi's own bins; sub-minute Kalshi-Polymarket ordering is unresolvable in principle (R23). Kalshi's settlement timestamps trail the whistle by up to an hour on extra-time matches, so "T-minus" horizons are exchange-ops time; the largest staleness number in the sweep was Kalshi's own lag.

**Killed and staying dead:** cal-01, cal-02, cal-03, cal-07, cal-08, ig-03, ig-04, ig-09, bias-04, bias-05, bias-08. Several were the sweep's most quotable lines (Kalshi wins 14-2; the shootout compression; the $163K dead prop leg). They are quotable because they are artifacts. Do not resurrect.

## Bibliography

**Calibration arm**
[^1]: Kalshi-Polymarket divergence detector · pipeline/data/analysis/calibration/kalshi_vs_polymarket_episodes.csv, kalshi_vs_polymarket_max_gaps.csv
[^2]: Scores by source and horizon · pipeline/data/analysis/calibration/scores_match3way_by_source_horizon.csv, match3way_panel.parquet
[^3]: Semifinalists vs Opta/Elo · pipeline/data/analysis/calibration/semifinalists_price_vs_opta_elo.csv
[^6]: Poll-market gaps (Ipsos, Pew) · pipeline/data/analysis/calibration/poll_vs_market_gaps.csv

**Microstructure arm**
[^4]: Reaction latency and event list · pipeline/data/analysis/ingame-microstructure/reaction_latency.parquet, events_matched.parquet
[^5]: Germany-Paraguay instrument-switch ticks · pipeline/data/analysis/ingame-microstructure/shootout_ticks_JUN29GERPAR.parquet
[^17]: Size and frequency regimes · pipeline/data/analysis/ingame-microstructure/size_regime.parquet
[^20]: Overreaction and fade · pipeline/data/analysis/ingame-microstructure/overreaction_fade.parquet
[^22]: Lead-lag construction artifact · pipeline/data/analysis/ingame-microstructure/leadlag.parquet, research/analysis/ingame-microstructure-methods.md

**Volume arm**
[^8]: Daily arrival and regime breaks · pipeline/data/analysis/volume-anatomy/daily_arrival_annotated.csv, regime_breaks.json
[^9]: Mexico-England zoom · pipeline/data/analysis/volume-anatomy/mexeng_summary.json, mexeng_advance_tape.parquet
[^10]: Clock and match windows · pipeline/data/analysis/volume-anatomy/hourly_pulse_et.csv, match_window_split.csv, match_windows.parquet
[^12]: Novelty vs sports ranks · pipeline/data/analysis/volume-anatomy/novelty_vs_sports.json
[^16]: Concentration and Lorenz · pipeline/data/analysis/volume-anatomy/concentration_summary.json, lorenz_curve.csv, market_totals.parquet
[^18]: Family crossover · pipeline/data/analysis/volume-anatomy/family_cumulative.parquet, family_crossover.json

**Bias arm**
[^11]: Host-nation peer band · pipeline/data/analysis/bias-forensics/us_home_bias_futures_peer.parquet
[^13]: Favorite-longshot buckets · pipeline/data/analysis/bias-forensics/flb_kalshi_buckets.parquet, flb_kalshi_buckets_volweighted.parquet, flb_kalshi_market_level.parquet
[^14]: Post-upset drift · pipeline/data/analysis/bias-forensics/post_upset_drift.parquet, post_upset_drift_series.parquet
[^15]: Golden Boot book · pipeline/data/analysis/bias-forensics/golden_boot_daily.parquet, golden_boot_snapshot.parquet
[^19]: Matched Kalshi-Pinnacle legs · pipeline/data/analysis/bias-forensics/flb_matched_kalshi_vs_pinnacle.parquet
[^21]: Zombie-money window · pipeline/data/analysis/bias-forensics/zombie_money.parquet, zombie_money_trades.parquet

**Project ground truth**
[^23]: Data audit (rules R1-R9, gaps G1-G8) · research/data-audit.md; tournament facts · research/fact-base.json
