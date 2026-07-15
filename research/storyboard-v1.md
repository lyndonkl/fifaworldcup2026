# Storyboard v1 — Gate 2 artifact

**The Market Watched the World Cup** (working title; candidates below) · drafted 2026-07-14, hours after France-Spain (Spain 1-0, regulation). Written from the post-France-elimination vantage. The final is Spain against England or Argentina, July 19, MetLife. v1 publishes July 17-18, before the final.

Ground rules this storyboard obeys: every scene is powered by data that exists in the store per `research/data-audit.md`; every factual claim is the corrected claim from `research/findings-dossier.md`, verbatim where numbers appear; the eleven killed findings (cal-01, cal-02, cal-03, cal-07, cal-08, ig-03, ig-04, ig-09, bias-04, bias-05, bias-08) stay dead; R23 stands as a prohibition on any Kalshi-versus-Polymarket speed scene; settlement rule R4 (regulation versus advancement) is honored wherever a level-after-90 match appears. The population is never cut and redrawn. Every scene transition is a re-sorting of the same dots.

---

## 0. The unit, stated once

- **Population grain (proposal, Gate 3 finalizes):** 1 dot = $75,000 of matched notional. At the July 14 tape ($12.3B) that is ~164,000 dots; recomputed and re-narrated at deploy. Mobile: 1 dot = $250,000 (~49,000 dots), narrated on screen as the device's grain.
- **Zoom grain:** 1 dot = 1 trade, always. Every grain change is narrated in the scene copy, never silent. Where a zoom window exceeds the particle budget (Mexico-England's ~1M trades), the scene narrates a stated sample ("every nth trade") rather than shifting silently; build phase confirms per-window counts.
- **Identity:** each population dot owns a stable identity (series, market, timestamp bucket, side, price) so that Lorenz-tail dots in Act I are literally the sagging dots of Act IV. That constancy is the piece's craft argument.

---

## 1. Title candidates

1. **The Belief Machine** — Thirteen months, 71.8 million trades, and what a twelve billion dollar market actually believed about the World Cup.
2. **A Mechanism, Not a Mood** — Every panic story told about prediction markets, tested against the full trade tape of the 2026 World Cup.
3. **Regulation Time** — How the market priced the goals, the upsets, and the favorite that died in ninety minutes.
4. **What the Market Knew** — The 2026 World Cup, retold through the prices that watched it.
5. **Every Dot Is Money That Moved** — One particle per trade: the World Cup as twelve billion dollars of moving belief.
6. **The Tape Doesn't Panic** — Goals, penalties, three dead hosts in 24 hours, and the market that repriced it all in seconds.
7. **The Market Watched the World Cup** — A tick-level retelling of the tournament, ending on the one number the final will judge.

Editorial note: candidates 2 and 3 carry the thesis hardest; candidate 3 gains a second meaning from the way France died (in regulation, on a contract that settles on regulation).

---

## 2. Act structure — one-screen map

| Act | Working name | Scenes | Dossier ammunition | What dissolves / what remains |
|---|---|---|---|---|
| 0 | Tonight, in Arlington | S1 cold open (tick zoom), S2 rewind to birth | R17; fact base | Hook: the favorite is dead. Question planted: what is this thing that watched? |
| I | The flood | S3 arrival + counter, S4 the tournament's clock, S5 where dollars sat | R1, R18, R11, R15, R14 | "Zombie casino" dissolves into listing mechanics and the tournament's own clock |
| II | Match speed | S6 anatomy of the biggest market (zoom), S7 the goal three ways, S8 which market you watch (zoom), S9 three shocks | R8, R16, R3, R20, R4, R9 | "Goal-spike panic" dissolves into mechanism: continuous books, suspension policy, settlement semantics, bracket arithmetic |
| III | The scoreboard | S10 one price two venues, S11 the verdict and the trap | R2, R5, R19, cross-arm suspension story | "Dumb retail" dissolves: parity at every live horizon; the analysis shows its own three wrong turns |
| IV | The sins that survived | S12 the anti-gotcha (Golden Boot), S13 the flags and the price, S14 the one real sin | R13, R10, R12, R21, R7 (+R15 spine) | Discipline about crying bias; then the three genuine residuals emerge |
| V | How to read the number | S15 thirteen months above the line, S16 the lens sequence, S17 the number | R6 + lenses (§4 below) | The reinterpretation: five habits applied to the final's frozen odds |
| — | Coda | S18 the rail releases | full store | Explorable replay; bounded |
| — | Epilogue (v2) | SE1 placeholder | post-final incremental pull | Scores the reinterpretation after settlement |

18 scenes in v1. Reader model: a smart generalist who has never traded a contract; every market-mechanics concept is taught on first contact inside a scene, never in an aside.

---

## 3. Scenes

### ACT 0 — Tonight, in Arlington

---

**S1 · Act 0 · "Ninety minutes in Arlington"**

**Beat.** France arrived in Arlington priced near forty cents to win the World Cup, the market's favorite for thirteen months.[^2] Ninety minutes later the contract was worth nothing. Every dot on this screen is one real trade from that night, money changing hands as a belief died in regulation time.[^1] Before asking whether the market saw it coming, it is worth asking what this market actually is. The answer starts fourteen months earlier.

**Data.** KXWCGAME-26JUL14FRAESP legs and KXMENWORLDCUP-26-FR trade tape from the scheduled G1 `--since` re-drive (data-audit G1; runs post-semifinals, before build); goal/repricing event located by the detector pipeline (events list extension of `pipeline/data/analysis/ingame-microstructure/events_matched.parquet`). July 13 reference prices from `research/fact-base.json`. **Do not name the scorer or minute in prose; the tape supplies the repricing moment, the fact base gets updated with the verified result before Phase 4.**

**Units.** Layout: `tick-stream`. The piece opens at zoom grain, narrated in the first caption ("every dot here is one trade"). Trades enter left-to-right along a match-clock x-axis, y = price of the France winner leg; the 3-way legs run as fainter companion streams. Color: side (yes/no taker). At the goal, the stream visibly repcies; at the whistle, the France dots pour to the zero line. A→B: none inbound (first scene); outbound handled by S2.

**Overlays.** D3: match-clock axis (0'-90'+), price axis in cents, one annotation at the detected repricing event ("the goal"), one at the whistle, settlement line at zero. No team crests; typography only.

**Scroll.** Scroll-locked scrub through the ninety minutes; the reader's scroll is the match clock. Static end state: the full night's stream with the two annotations.

**Mobile.** Same scene; stream density capped with narrated sampling if the re-driven tape exceeds budget; annotations collapse to numbered markers with a footer legend.

**Fallback.** If the G1 re-drive fails to land in time, the cold open becomes Norway-Brazil from the existing store (R9 tape) with the France death told at population grain in S2. Decision needed only if the re-drive breaks; it is scheduled and mechanically verified.

---

**S2 · Act 0 · "Thirteen months, asleep"**

**Beat.** The winner book opened in May 2025 and then did almost nothing for a year. The December draw, the moment the tournament became concrete, registers as a twitch: 190,000 contracts on the day, and the cleaner fingerprint is participation, 176 mostly small trades in the reveal hour.[^3] Peak match day would eventually run about 3,400 times larger in contracts and roughly 21,000 times larger in premium dollars.[^3] A market is not a poll that runs continuously; it is a crowd that shows up when something is at stake.

**Data.** `pipeline/data/analysis/volume-anatomy/daily_arrival_annotated.csv` (R17); Kalshi trade-tape LOD tiles (population attributes derived from the series-partitioned tape, per data-audit §1); listing dates from `pipeline/data/catalog/markets.parquet`.

**Units.** Layout: `timeline-ribbon`. **Grain shift, narrated:** the S1 tick dots shrink and merge into their place in the full population ("from here, one dot stands for $75,000 of traded volume; the population on this screen is the entire tournament, and it never leaves"). The population spreads along a May 2025 → July 2026 time axis, dot x = trade time, stacked density as y. Thirteen months of near-emptiness, one visible flicker at draw week, then the wall of June 11 looming at the right edge. Color: contract family (futures vs everything else), muted.

**Overlays.** D3: time axis with month ticks, draw-week annotation ("December 5: the twitch"), a "you are here" marker at July 14, and a dimmed marker at July 19 labeled "the final."

**Scroll.** Continuous scrub across the timeline; the June 11 wall is deliberately withheld until the final scroll increment (gold-coin placement).

**Mobile.** Timeline rotates to vertical (scroll = time), density scaled to the narrated mobile grain.

---

### ACT I — The flood

---

**S3 · Act I · "The flood" (dossier Act 3 opener, R1 + R18)**

**Beat.** The tournament began and the money arrived all at once. Match markets out-traded the entire futures book on day one, 49.4 million contracts to 31.6 million, and passed its thirteen-month cumulative stock on day two; the futures book set its own record the same day, at roughly ninety times its pre-tournament pace.[^4] The reconciled tape totals $10.94 billion through July 8 and $12.3 billion at the July 14 snapshot; the widely reported "$7.4 billion" matches the tape's own cumulative as of roughly June 30, a floor about a week stale.[^5] 98.6% of everything ever traded here traded in-tournament, largely because three quarters of the notional sits in per-match products that did not exist before kickoff.[^5]

**Data.** `pipeline/data/analysis/volume-anatomy/family_cumulative.parquet`, `family_crossover.json` (R18); `daily_arrival_annotated.csv`, `regime_breaks.json` (R1). All headline dollars recomputed at the deploy-morning re-run and frozen with timestamp.

**Units.** Layout: `family-race`. The population re-sorts from the timeline into two cumulative columns, futures versus match families, dots streaming into each as the days advance; the crossover happens on screen inside the first 48 hours of a fourteen-month time axis. Color: family. Sort: arrival time.

**Overlays.** D3: running dollar counter (the scene's protagonist number), a horizontal marker labeled "press floor, ~one week stale" at $7.4B that the counter ticks past and keeps climbing, cumulative race curves, crossover annotation.

**Scroll.** Step-triggered: (1) day one, (2) the day-two crossover, (3) the counter runs to the July 14 snapshot and pauses on the press-floor gap.

**Mobile.** Columns become stacked horizontal bars; the counter stays the hero element.

---

**S4 · Act I · "The tournament's clock" (R11)**

**Beat.** The market's clock is the tournament's clock. Windows bracketing kickoffs cover about a third of tournament time and capture 54.7% of tournament volume, a tilt of roughly 1.6x; the hour-of-day heatmap is, to a first approximation, a map of when a North America-hosted World Cup schedules football.[^6] A genuine but mild residual survives the schedule: US waking hours run about twice the volume the kickoff calendar alone would predict.[^6] On rest days activity falls five to fifteen fold, but the always-open futures dim only about threefold, the cleaner measure of attention at rest.[^6]

**Data.** `pipeline/data/analysis/volume-anatomy/hourly_pulse_et.csv`, `match_window_split.csv`, `match_windows.parquet` (R11).

**Units.** Layout: `clock-grid`. The population re-sorts into an hour-of-day (x) by tournament-day (y) grid, each dot flying to its cell; cell brightness is dot density. Then the kickoff histogram draws over the grid so the confound is the caption, per the dossier's scene note. Color: in-window versus out-of-window trades.

**Overlays.** D3: grid axes (ET hours, dates), kickoff-time histogram overlay, rest-day row annotations, a subtle "US waking hours" band with the ~2x residual note.

**Scroll.** Step-triggered: (1) the grid assembles, (2) the kickoff histogram lands ("the market's pulse is the schedule"), (3) rest-day rows highlight with the futures-vs-all contrast.

**Mobile.** Grid rotates portrait (dates run down the screen, hours across); the kickoff overlay becomes per-row tick marks.

---

**S5 · Act I · "Where the dollars sat" (R15 + R14)**

**Beat.** Kalshi lists the outcome space; dollars find the plausible outcomes. Three core series, 414 contract legs, absorb 63.5% of all dollars, while 19,640 markets, more than half the catalog, carry 0.36% of volume; the pooled concentration reads as extreme, a Gini of 0.930, and the within-family reality is ordinary, 0.44.[^7] The catalog's most famous novelty, the biggest Trump-mention market, drew a real 1.40 million contracts and still could not crack the top 1,000; the honest punchline runs the other way, since the maximum of a 3,005-market family trading at catalog base rate should land near rank ten.[^8] America's biggest off-pitch market was roughly sixty times smaller than the moneyline on its own broadcast.[^8]

**Data.** `pipeline/data/analysis/volume-anatomy/concentration_summary.json`, `lorenz_curve.csv`, `market_totals.parquet` (R15); `novelty_vs_sports.json` (R14).

**Units.** Layout: `lorenz-sweep`. The population re-sorts by market size into a sorted sweep that traces the Lorenz curve as an arrangement of the dots themselves; the long thin tail is visibly almost empty of dots. The Trump market's dots light up as a single highlighted cluster deep in the tail. **Constancy note:** these tail dots carry a persistent tag; they return, unmoved in identity, as the sagging dots of S14.

**Overlays.** D3: Lorenz axes, equality diagonal, tail bracket labeled "19,640 markets, 0.36% of the money," Trump-dot callout ("rank ~1,083 of 30,133").

**Scroll.** Step-triggered: (1) sort and sweep, (2) tail bracket, (3) Trump highlight with the inverted punchline.

**Mobile.** Sweep compresses; the tail bracket becomes the dominant annotation.

---

### ACT II — Match speed

---

**S6 · Act II · "Anatomy of the biggest market" (R8 + R16; dossier Act 3 zoom, placed here as the gateway to match world)**

**Beat.** The single biggest market of the tournament was not the winner book. It was Mexico to advance past England, 158.7 million contracts across roughly a million trades, host-nation money concentrated on one elimination night.[^9] Zoomed to individual trades, it looks like ordinary Kalshi retail flow at extraordinary scale: typical trade sizes, the exchange-wide taker-yes skew, a heavier pre-match profile than the median knockout market.[^9] The tape records that money moved; it cannot say whether the mover was hedging heartbreak or chasing it. The arrival rate tells its own story: the pre-kick hour already runs about one print per second, and the opening whistle steps it up roughly fivefold.[^10]

**Data.** `pipeline/data/analysis/volume-anatomy/mexeng_summary.json`, `mexeng_advance_tape.parquet` (R8); `pipeline/data/analysis/ingame-microstructure/size_regime.parquet` (R16). Pre-kick pile-in corroboration (FRA-ESP at 16.4x morning volume 93 minutes pre-kick) from data-audit §5.[^10]

**Units.** Layout: `match-zoom`. **Grain shift, narrated:** the population dims to a background field; the dots carrying the MEXENG tag fly to center and unpack into tick-grain trades ("for this scene, one dot is one trade; there are about a million, so the screen shows every nth, and n is printed here"). Emission-rate animation: trades arrive as a stream whose rate the reader feels ramp through the pre-match hour and step at the whistle. Color: taker side. Size: per-trade contracts.

**Overlays.** D3: arrival-rate axis (trades/second), kickoff line with the ~5x step annotation, per-trade-size sparkline, caption block "what the tape can and cannot say about who was trading."

**Scroll.** Scrub through the market's final 24 hours compressed, with a dwell on the last pre-kick hour.

**Mobile.** Sampled stream at narrated n; rate axis becomes a haptic-adjacent pulse (visual metronome), since fine stream texture is illegible at phone size.

---

**S7 · Act II · "The goal, three ways" (R3 + R20; R23 prohibition enforced)**

**Beat.** A goal reaches three venues as three different mechanisms, and the differences are policy rather than intelligence. Kalshi's book trades continuously through the goal minute; Pinnacle suspends about thirty-two seconds after the move begins, goes dark for roughly eighty, and reopens with a single quote already at the new fair level; Polymarket's stored history cannot resolve anything under sixty seconds.[^11] The often-repeated reaction ladder, 29 seconds versus 60 versus 119, is three measurement artifacts wearing a ranking.[^11] And the spike is the price: across clean goal reactions the post-jump level held within the roughly two-cent friction band at a thirty-minute horizon, so there was no overreaction to fade.[^12]

**Data.** `pipeline/data/analysis/ingame-microstructure/reaction_latency.parquet`, `events_matched.parquet` (R3); `overreaction_fade.parquet` (R20). Vehicle goal: Norway-Brazil (Haaland's second, from the existing finalized tape) or another clean detector event; chosen at build for visual clarity. Pinnacle store under R1-R3 defect rules; Polymarket at native 1-min. **Standing prohibition (R23): no cross-venue speed ranking anywhere in this scene; any lead/lag language is bounded to ±60 seconds by construction and therefore omitted.**

**Units.** Layout: `goal-clock-lanes`. Still inside match world: the zoom population re-sorts into three horizontal lanes on one shared post-goal clock (Kalshi ticks as dots, Pinnacle quotes as dots, Polymarket minutes as dots). Pinnacle's lane goes literally dark for its ~80-second suspension window; the reopening quote lands as a single bright dot already at the new level. AET/decay-zone events are excluded per R22 flag.

**Overlays.** D3: shared post-goal clock axis, suspension window drawn as a shaded darkness block captioned "no longer quoting," friction band (±2c) around the post-jump level, caption "continuous tradability versus suspend-and-repost."

**Scroll.** Step-triggered: (1) the goal lands on all three lanes, (2) Pinnacle darkness, (3) the reopen dot, (4) the 30-minute friction band ("nothing to fade").

**Mobile.** Lanes stack vertically; the darkness block is the anchor visual.

---

**S8 · Act II · "Which market you watch" (R4; the credibility explainer + shootout zoom)**

**Beat.** Which market you watch matters more than what the players do. Germany and Paraguay finished level, and the regulation-time contract did exactly what its rules require: the Germany leg ground from 48 cents to one over twenty-two minutes on accelerating settlement volume, a decay never exceeding seven cents a minute, while real goals jump nineteen to twenty-five cents inside thirty seconds.[^13] The advancement contract barely moved at the whistle and kept trading through the shootout for another hour.[^13] Read the wrong instrument and the market appears to abandon Germany without news; read the right one and it is obeying its own settlement clock.

**Data.** `pipeline/data/analysis/ingame-microstructure/shootout_ticks_JUN29GERPAR.parquet` (R4). Settlement semantics per data-audit rule R4.

**Units.** Layout: `dual-path`. Two synchronized particle paths on one match clock: KXWCGAME-26JUN29GERPAR-GER dots riding the regulation leg down its 22-minute expiry glide, KXWCADVANCE dots holding level and then trading dense through the shootout. One path dies at the whistle; the other lives another hour. Tick grain, narrated ("one dot, one trade, both contracts").

**Overlays.** D3: match clock with 90' whistle line, dual price axes, decay-slope annotation ("≤7c/min: expiry, not news") against a goal-jump reference ("19-25c in 30s"), shootout region with per-kick markers where the tape shows tick clusters.

**Scroll.** Scrub from minute 85 through the shootout's end; a dwell at the whistle where the paths split is the scene's gold coin.

**Mobile.** Paths stack with a shared clock; per-kick markers become a compact strip.

---

**S9 · Act II · "Three shocks, three arithmetics" (R9)**

**Beat.** Three shocks, three different arithmetics. Paraguay's winner leg popped fivefold when Germany went out, Norway's about 3.6x over Brazil, Belgium's roughly twofold, and the 72-hour paths then diverged with bracket news rather than fading from excess: Paraguay drifted as France was confirmed next, Belgium converged on a known Spain quarterfinal.[^14] The tell is Norway: its spike to 10.8 cents at hour 43 mirrors, minute for minute, Argentina's winner-leg crash while Egypt led.[^14] The market was not celebrating an upset; it was repricing the paths that remained.

**Data.** `pipeline/data/analysis/bias-forensics/post_upset_drift.parquet`, `post_upset_drift_series.parquet` (R9).

**Units.** Layout: `shock-align`. **Grain shift back out, narrated:** the match-world tick dots repack into population grain ("back to $75,000 a dot"). Three winner-leg dot-paths overlay on one event-time axis, shock at t=0. At the callout step, Norway's path and Argentina's path render together and move in mirrored lockstep. Color: beneficiary team per path.

**Overlays.** D3: event-time axis (hours since shock), normalized price axis, bracket-news annotations on each path (France confirmed next; Spain quarterfinal known), the Norway-Argentina mirror callout with both series drawn.

**Scroll.** Step-triggered: (1) three pops at t=0, (2) 72-hour divergence with bracket annotations, (3) the mirror.

**Mobile.** Paths render as small multiples, then the mirror pair alone gets a full-width panel.

---

### ACT III — The scoreboard

---

**S10 · Act III · "One price, two venues" (R2)**

**Beat.** For the entire knockout stage the two retail venues were effectively one market. Across 84 three-way legs, Kalshi and Polymarket never sustained a five-point gap for thirty minutes; the mean one-minute gap is 0.74 points, and the 41.6-point goal-second spikes last exactly one minute.[^15] The sixteen apparent divergences from the professional book tell a different story: all sixteen begin within about two minutes of Pinnacle's final quote and contain zero fresh ticks.[^15] That is not disagreement; that is one party leaving the conversation.

**Data.** `pipeline/data/analysis/calibration/kalshi_vs_polymarket_episodes.csv`, `kalshi_vs_polymarket_max_gaps.csv`, `match3way_panel.parquet` (R2).

**Units.** Layout: `braid`. The population re-sorts into two price lines built of dots (Kalshi, Polymarket) across the knockout stage; at rest they braid so tightly they read as a single line, with the one-minute goal-second separations flashing and closing. Pinnacle is deliberately rendered as a D3 line, not particles (its quotes are not trades); at each of the sixteen episode timestamps the line goes dashed and grey at its last tick, captioned "no longer quoting."

**Overlays.** D3: time axis over the knockout window, probability axis, the Pinnacle overlay line with dashed-grey terminations, a gap-meter showing the running 1-min mean (0.74pp).

**Scroll.** Step-triggered: (1) the braid assembles, (2) goal-second flashes, (3) the sixteen grey terminations light up in sequence.

**Mobile.** The braid is the hero; the sixteen terminations become a count-up annotation rather than sixteen separate marks.

---

**S11 · Act III · "The verdict, and the trap" (R5 + R19 + cross-arm suspension story)**

**Beat.** At every horizon where both were alive, the amateurs and the professionals scored the same. At a day out and an hour out, Kalshi, Polymarket, and the de-vigged professional book post near-identical Brier scores, 0.158 to 0.169, on the same 84 legs; matched leg for leg at T-24h the gap is 0.162 versus 0.164, a sample that can rule out a large skill gap and establish nothing stronger.[^16] The lone blowout, at five minutes to settlement, scores live repricing against a product that had ceased to exist, since in-play books close at the whistle by design; roughly 74% of the professional book's error comes from five stoppage-time goals landing after its book closed.[^16] This analysis walked into that trap three separate times, in three separate arms, before the tape corrected it.[^22] The scene keeps the crossed-out column on screen as a receipt.

**Data.** `pipeline/data/analysis/calibration/scores_match3way_by_source_horizon.csv`, `match3way_panel.parquet` (R5); `pipeline/data/analysis/bias-forensics/flb_matched_kalshi_vs_pinnacle.parquet` (R19). The three-traps beat sourced to the dossier's cross-arm section and `research/data-audit.md` rules.[^22]

**Units.** Layout: `brier-columns`. Dots assemble into per-leg Brier contributions grouped by source and horizon (three sources, three horizon panels). The T-5min panel assembles last, looks like a blowout for one beat, then is struck through on screen while its dots desaturate to grey; a small side panel lists the three places the same artifact appeared (episodes, ladder, blowout), each collapsing to the same grey.

**Overlays.** D3: column chart frames, horizon labels, the strike-through annotation with the narrated reason, small-n caveat printed as a caption rather than hidden ("84 coupled legs, effective n of 28").

**Scroll.** Step-triggered: (1) T-24h parity, (2) T-1h parity, (3) the T-5min blowout appears, (4) the crossout, (5) the three-traps receipt.

**Mobile.** Horizon panels become sequential full-width cards; the crossout step is preserved as its own card.

---

### ACT IV — The sins that survived

---

**S12 · Act IV · "The market was not fooled by the scoreline" (R13; the anti-gotcha)**

**Beat.** The naive read says the market ignored the scoreboard; the resolution says it priced the future. Mbappe traded at 61 cents against Messi's 31 on identical eight-goal tallies, and the gap resolves first through expected remaining goals, the two having traded level on July 7 and 8 with Mbappe still a goal behind, and second through the contract's own assist tiebreak.[^19] Kane's four cents on six goals is fair under a plain Poisson read of realized rates, and his price halved on the day England won because he burned 120 scoreless minutes.[^19] France's elimination re-runs the same lesson live: the ladder reprices paths, and the final decides the race. Every figure on this screen refreezes on deploy morning.

**Data.** `pipeline/data/analysis/bias-forensics/golden_boot_daily.parquet`, `golden_boot_snapshot.parquet` (R13). Post-July-14 moves (dossier limits note: Kane back to 8c, Mbappe halved to 30c, Messi to 59c on partial data) recomputed at deploy; boot state (Mbappe 8 eliminated, Messi 8 alive, Kane 6 alive) confirmed against the re-driven tape and fact base.

**Units.** Layout: `boot-ladder`. Dots re-sort into per-player daily price columns (Mbappe, Messi, Kane, Haaland as the eliminated reference), forming small-multiple price paths with goal-tally badges. The scene performs the anti-gotcha in two moves: first the naive framing renders ("same goals, double the price?"), then the resolution annotations land and the framing caption rewrites itself.

**Overlays.** D3: player lanes, tally badges, the July 7-8 "traded level, one goal behind" annotation, the Kane-halving annotation ("120 scoreless minutes"), assist-tiebreak footnote chip.

**Scroll.** Two-step reveal: naive read, then resolution. The rewrite-on-screen is the scene's signature.

**Mobile.** Lanes stack; the two-step reveal is preserved exactly (it is the point).

---

**S13 · Act IV · "The flags and the price" (R10 + R12; R21 as a footnote line)**

**Beat.** The fans never got a vote on the price. 87% of Argentine respondents said Argentina would repeat while the winner leg traded at 11 cents; 7% of Americans named the USA while the US-listed exchange held the contract at a cent and a half, and agreement shares are not probabilities in the first place, a units caption the scene keeps on screen.[^17] Host attention was real money: Mexico and the USA drew two to two and a half times the pre-tournament contracts of model-equivalent peers, and the attention arrived with a price premium of roughly 1.5x to 1.8x model odds rather than instead of one.[^18] Loud in volume, faint in price. When the losers died, the money left within the settlement sweep: all 28 knockout losers' winner legs wound down in 302 trades worth about $2,340, everything at or below a cent.[^18]

**Data.** `pipeline/data/analysis/calibration/poll_vs_market_gaps.csv` (R10); `pipeline/data/analysis/bias-forensics/us_home_bias_futures_peer.parquet` (R12); `zombie_money.parquet`, `zombie_money_trades.parquet` (R21, one caption only; with bias-08 dead it stays small per the dossier). European market-above-poll gaps carry the normalization-artifact caveat (41% "not sure") wherever shown.

**Units.** Layout: `flag-pairs`. Dots form paired comparisons per country: a poll bar (drawn by D3, since respondents are not trades) beside a dot-built price column. Then the host-peer beat: four team columns (USA, Mexico, Ecuador, Croatia) built of dots at honest pre-tournament scale, with the price-versus-model dot overlay above each.

**Overlays.** D3: poll bars, units caption ("agreement shares are not probabilities"), model reference line for the peer band, zombie-money footnote chip at the bottom ("302 trades, ~$2,340, all ≤1c").

**Scroll.** Step-triggered: (1) Argentina pair, (2) USA pair, (3) host-peer columns, (4) footnote chip.

**Mobile.** Pairs become sequential cards; the units caption pins to the top of each.

---

**S14 · Act IV · "The one real sin" (R7; shares its visual spine with S5 per the dossier's cross-arm note)**

**Beat.** One sin survived verification, and it lives where the money was not. Cheap yes-legs underperformed their price, an implied 3.04% paying 1.19% at an hour out, but 72% of those observations sit in prop ladders with ten or more legs and 55% sit at the one-to-two-cent tick floor; weight the same curve by dollars actually traded and the sag flattens to about half a point.[^20] The worst-calibrated bucket of all is the 90-to-95-cent favorite, so the textbook one-sided story fails in both directions.[^20] The dots sagging here are the same dots that sat in the Lorenz tail three acts ago. Mispricing and emptiness are one map at two exposures.

**Data.** `pipeline/data/analysis/bias-forensics/flb_kalshi_buckets.parquet`, `flb_kalshi_buckets_volweighted.parquet`, `flb_kalshi_market_level.parquet` (R7); Lorenz-tail identity tags from S5 (`market_totals.parquet`).

**Units.** Layout: `calibration-curve`. Dots assemble into implied-versus-realized buckets along the diagonal; the cheap-end sag is visible as dot mass below the line, and the sagging dots visibly re-light with their S5 tail tag (the constancy payoff, called out in one caption). The markets-versus-dollars toggle re-weights dot size and position from per-market to per-dollar; the sag flattens on screen. The 90-95c bucket gets its own callout so the one-sided story cannot survive the scene.

**Overlays.** D3: diagonal, bucket axes, the toggle control (also keyboard-accessible; reduced-motion gets a crossfade between the two weightings), tick-floor bracket at 1-2c, the 90-95c callout.

**Scroll.** Step-triggered into the toggle: (1) curve assembles, sag visible, (2) ladder attribution (72% / 55% captions), (3) the toggle flips to dollars and the sag flattens, (4) the 90-95c callout. The toggle remains live after its step (the piece's one mid-narrative interactive).

**Mobile.** Toggle becomes a large segmented control; bucket count unchanged.

---

### ACT V — How to read the number

---

**S15 · Act V · "Thirteen months above the line" (R6, rewritten for tonight)**

**Beat.** For thirteen months the market held one opinion the model never talked it out of. At all five published simulation snapshots it priced France three to five points above Opta and Spain at or below the line, near-symmetric, robust across venues, one persistent level disagreement read five times rather than five confirmations.[^21] On July 14 in Arlington, Spain won in ninety minutes and the conviction settled to zero.[^1] A single match cannot falsify a forty-percent price. It can, however, hand the trophy game to the team the market spent a year discounting, and that is the situation the final's number now has to price.

**Data.** `pipeline/data/analysis/calibration/semifinalists_price_vs_opta_elo.csv` (R6); France settlement from the G1 re-drive; result per author-supplied tournament state, 2026-07-14, to be verified against the re-driven tape and written into `research/fact-base.json` before Phase 4.[^1]

**Units.** Layout: `stage-strip`. Dots form the strip chart: five stage columns, France's dot-cluster above the model line at every stage, Spain's at or below. Then the settlement beat: France's dots drain downward to grey at the July 14 mark; Spain's dots brighten and drift toward the right edge of the screen, where S16 will receive them. This is the piece's single most emotional transition and it is done entirely with the same dots.

**Overlays.** D3: stage axis (five Opta snapshots), model reference line, devigged premium annotations (+3 to +5pp France, ~-3pp Spain), July 14 settlement marker.

**Scroll.** Step-triggered: (1) the five reads assemble, (2) "one opinion, read five times," (3) the drain.

**Mobile.** Strip renders at full width; the drain is preserved at full fidelity (it is cheap: color and y-position only).

---

**S16 · Act V · "How to read the number" (the lens sequence; see §4 for selection rationale)**

Five lens beats as five scroll steps inside one pinned scene. Each lens re-sorts the population into a miniature of the scene that taught it; the reader watches their own memory of the piece reassemble. Each miniature carries one caption and one habit.

**Beat, step L1 (the consensus lens).** First habit: the number is the number. At a day out the amateurs and the professionals scored the same all tournament.[^16] The two retail venues never sustained even a five-point disagreement for half an hour.[^15] No one sharper is waiting behind this price.

**Beat, step L2 (the where-the-money-is lens).** Second habit: trust the pools, not the ladders. The final's three-way and the winner legs are the deepest markets of this exchange's life, and weighted by dollars actually traded the big markets were nearly calibrated all tournament.[^20] The first-scorer and exact-score ladders carry the one real mispricing the tape ever confirmed, a lottery tax bounded by the one-cent tick.[^20]

**Beat, step L3 (the fair-jump lens, carrying the mechanism lens's live-reading clause).** Third habit: if a shock lands, the spike is the price. Clean goal reactions held their post-jump level within friction at a thirty-minute horizon, and every shock of this tournament repriced to bracket arithmetic rather than fading from panic.[^12] One clause of fine print for a level final: near minute ninety the regulation contract will grind to its tie-locked price by construction, and belief will be speaking through the winner legs.[^13]

**Beat, step L4 (the attention-is-not-belief lens).** Fourth habit: on final day the noise will be at maximum and the price will not care. Fans at 87% agreement met an 11-cent market, and a home crowd's team traded at a cent and a half on its own country's exchange.[^17] Attention moved volume by multiples all tournament and never bought more than a point or two of price.[^18]

**Beat, step L5 (the conviction lens, the open one).** Fifth habit: this market holds opinions. It kept France above the model for thirteen months and Spain below it, and Spain is the team still standing.[^21] Whether that discount was information or attachment is the one question the tape could not settle. The piece stakes it here: the epilogue will return to this number and say which it was.

**Data.** Recap layouts reuse the tiles of S10/S11 (L1), S14/S5 (L2), S7/S8/S9 (L3), S13/S4 (L4), S15 (L5); no new analysis tables. Opponent name (England or Argentina) is a template slot resolved after July 15; if Argentina, L4 gains a one-line callback to the 87% figure, drafted both ways at Phase 4.

**Units.** Layout: `lens-carousel`. Per step, the population re-sorts into a scaled-down echo of the source scene, holds one beat, then flows to the next. Color desaturates progressively so that by L5 only the Spain and opponent dots hold full saturation.

**Overlays.** D3: lens title lockups ("Habit one: the number is the number"), one mini-axis set per miniature, nothing else. The stride shortens deliberately; captions get shorter with each lens.

**Scroll.** Step-triggered, one lens per step; reduced-motion gets crossfades between held end states.

**Mobile.** Each lens is a full-viewport card; the miniatures simplify to their single anchor mark (braid, curve, lanes, pair, strip).

---

**S17 · Act V · "The number"**

**Beat.** This is where the piece stops narrating and starts holding still. The number below is the market's price for the final, frozen and timestamped on the morning of July 19; it will not update, and that is the point.[^23] The reader now knows what this number is made of: two venues enforced into one price, depth where it can be trusted, a lottery tax where it cannot, attention that never bought a point of loyalty, and one year-long conviction that just lost its favorite. Read it with those habits. The epilogue will read it with the result.

**Data.** G3 morning-of-final refresh (scheduled, per CLAUDE.md hard constraint): KXMENWORLDCUP-26-ES and the opponent's winner leg, plus the final's KXWCGAME 3-way legs, pulled by the pipeline re-run, frozen and timestamped at deploy.[^23] Hero number proposal: the winner-futures pair (the contracts alive since May 2025, closing the loop with S2); the 3-way trio renders beneath at smaller scale. Author decision at Gate 2 (open question 3).

**Units.** Layout: `settle`. The full population converges and dims to a quiet field; only the dots belonging to the final's contracts stay lit, and they arrange into the price figure's underline. The timestamp renders in type, not particles. End state is fully static and screenshot-ready; this is the frame most readers will share.

**Overlays.** D3: the frozen prices in large type, the timestamp, one line of provenance ("frozen at pipeline run <ISO timestamp>; this number does not update").

**Scroll.** The rail releases at the bottom of this scene.

**Mobile.** Identical; this scene is designed mobile-first since it is the shareable frame.

---

### CODA

---

**S18 · Coda · "The rail releases"**

**Beat.** Every market in this piece can be replayed. Pick a contract and scrub its price life from listing to settlement; open a zoom match and step through it tick by tick. Nothing here is a simulation. Every dot is money that moved.

**Data.** Full LOD tile store (population grain) plus the committed zoom tiles (MEXENG window, GER-PAR shootout, FRA-ESP night, chosen goal events). Bounded scope per DECISIONS #16: a market picker and a match scrubber, not a second app.

**Units.** Free camera over the resting population in the S2 timeline layout; selecting a market lifts its dots into a replay lane. Grain rules and narrated sampling identical to the narrative scenes.

**Overlays.** D3: picker UI, replay transport, per-market metadata chip (series, volume by tape sum per rule R6, settlement).

**Scroll.** Native scroll returns; the coda is a bounded interactive block, then the methods note and bibliography.

**Mobile.** Picker becomes a searchable list; scrub gestures native.

---

## 4. The ending: lens selection and order

The dossier drafted six lenses. The storyboard runs five, in this order: **consensus → where-the-money-is → fair-jump → attention-is-not-belief → conviction**, then the number itself (S17). Two editorial calls:

1. **The mechanism lens is folded into the fair-jump lens** as its one clause of fine print (L3). Act II teaches the mechanism twice at full length (S7, S8); restating it as a standalone lens would slow the ending's stride exactly where the pacing must accelerate. Nothing is dropped silently; the instrument-switch warning survives as the fine print a reader needs for a level final.
2. **The conviction lens closes, rewritten for tonight.** The dossier drafted it conditional on France reaching the final. France did not. The corrected lens is stronger: the market's most stubborn opinion lost its object in ninety minutes, and the team it discounted for a year is the one left playing. The honest framing is preserved from the dossier's own logic: a single match cannot falsify a probability, so the lens ends on the stake rather than a verdict, and hands the question to the epilogue.

The scroll pacing argument for the order: L1 establishes calm authority (read it as the number), L2 makes it practical (which numbers to trust), L3 arms the reader for match day (live reading), L4 clears the final-day noise (the flags), L5 lands the wound and the open question, and S17 goes silent on the number. Stride and caption length shorten monotonically across the five steps; the last thing that moves on screen is the population settling under the frozen price.

---

## 5. Epilogue placeholder (v2, scored after the final)

**SE1 · Epilogue · "The morning after" (shape only; built in Phase 6 from one incremental `--since` pull).**

Scene shape, four beats under one pinned canvas:

1. **The settle.** The final's contracts resolve on screen: the population's last live dots pour to zero and one. The frozen S17 number re-renders beside the settled outcome, both timestamped.
2. **The lens audit.** The five lenses return as a checklist rendered in the S16 lockup style: what each habit told a reader on final morning, and what the match did to it. Fair-jump and mechanism get scored against the final's actual in-game tape (goals, any level-at-90 grind, any suspension gap).
3. **The conviction verdict.** L5 answered honestly: what Spain's frozen price implied, what happened, and a plain statement that one result adjudicates the bet the piece staked without proving the thirteen-month disagreement right or wrong. The v2 language must resist both gloats.
4. **The last number.** The tape's final lifetime total, recomputed and dated, closes the counter that S3 opened. The population comes fully to rest.

Data: post-final incremental pull (pipeline is resumable by design); updated `daily_arrival_annotated.csv`, `family_cumulative.parquet`, final-match event tape; no new analysis arms.

---

## 6. Dependencies and recompute ledger

- **G1 re-drive (scheduled):** S1, S6's pre-kick corroboration, S12's boot state, S15's settlement beat all touch the post-July-14 tape. One `--since 2026-07-14T05:00:00Z` re-drive after England-Argentina settles; run twice if the FRA-ESP tape is wanted sooner. Fallback for S1 documented in-scene.
- **G2 kickoff-time discrepancy:** resolve fact-base 19:00Z versus catalog 22:00Z before building S1's event window (data-audit G2).
- **G3 morning-of refresh:** S17's frozen number; scheduled, mechanically verified.
- **G4 Trends (optional human step):** a ~5-minute manual export would upgrade S4's attention framing from participation proxy to an independent series; otherwise the methods note carries the $0-budget coverage-gap line, per the dossier's honest-limits section.
- **Recompute at deploy:** every dated figure (counter totals, boot prices, winner legs, dot-grain census) refreezes at the deploy-morning re-run per CLAUDE.md; the dossier's 98.6%/98.7% in-tournament share (R1 vs R11) is reconciled to a single recomputed figure at that pass so the piece never prints both.
- **Fact base update:** tonight's result (Spain 1-0, regulation) enters `research/fact-base.json` with a verified source before any prose ships; S1/S15 prose currently rests on author-supplied state.[^1]

---

## 7. Open questions for the author (Gate 2)

1. **Title.** Seven candidates in §1; candidates 2 ("A Mechanism, Not a Mood") and 3 ("Regulation Time") carry the thesis hardest. Pick one, or direct a second round.
2. **Cold open risk.** S1 opens on tonight's France death and depends on the scheduled G1 re-drive. Comfortable, or prefer the chronological open (S2 first) with tonight held for S15? The in-medias-res open is this storyboard's recommendation.
3. **The hero number.** S17 proposes the winner-futures pair as the frozen number (closing the loop with the May 2025 birth), with the final's 3-way beneath. Alternative: lead with the 3-way. Which instrument is the piece's last word?
4. **Tone of the conviction ending.** How hard may L5/S15 lean on "the conviction failed"? Current draft holds the line at "one match settles nothing, but the discounted team is the one still standing." Confirm this register or direct something more rueful.
5. **The three-traps receipt (S11).** Keeping the analysis's own three wrong turns on screen is a methods-honesty beat with real narrative charge, but it costs one scroll step in the calibration act. Keep on screen, or demote to the methods note?
6. **Golden Boot scene timing.** The boot race resolves July 15-19 while v1 is being built. Keep S12 as drafted (anti-gotcha with deploy-morning refreeze), or trim it to a beat inside S13 if the race collapses early?
7. **Trump/novelty register (S5).** The inverted punchline is wry. Confirm the analyst register holds it, or soften to a caption without the "top 1,000" line.
8. **Opponent-conditional copy.** S16 L4 and all ending prose carry an England/Argentina template slot; if Argentina reaches the final the 87% Ipsos line gains a live callback. Approve drafting both variants at Phase 4.
9. **Population grain unit.** Dollars ($75k/dot) versus contracts (~80k contracts/dot) for the persistent population; dollars is this storyboard's proposal because the piece's counter and Lorenz scenes speak in dollars. Confirm before Gate 3 locks the design system.
10. **Trends export (G4).** Authorize the 5-minute manual export, or accept the methods-note line? Affects only S4's caption depth; no scene depends on it.

---

## Bibliography

**Project ground truth**
[^1]: Tournament state and July 14 result (Spain 1-0, regulation) — author-supplied, 2026-07-14; to be verified against the G1 re-driven tape and written into research/fact-base.json before Phase 4.
[^2]: Kalshi winner-leg and 3-way reference prices, July 13 snapshot — research/fact-base.json (kalshi section); pre-kick prices recomputed from the re-driven tape.
[^23]: Freeze-and-timestamp mechanics and morning-of-final refresh — CLAUDE.md hard constraints; research/data-audit.md G3.

**Volume arm**
[^3]: Draw-week fingerprint — pipeline/data/analysis/volume-anatomy/daily_arrival_annotated.csv (dossier R17).
[^4]: Family crossover — pipeline/data/analysis/volume-anatomy/family_cumulative.parquet, family_crossover.json (R18).
[^5]: Reconciled tape totals and press floor — pipeline/data/analysis/volume-anatomy/daily_arrival_annotated.csv, regime_breaks.json (R1).
[^6]: Tournament clock — pipeline/data/analysis/volume-anatomy/hourly_pulse_et.csv, match_window_split.csv, match_windows.parquet (R11).
[^7]: Concentration and Lorenz — pipeline/data/analysis/volume-anatomy/concentration_summary.json, lorenz_curve.csv, market_totals.parquet (R15).
[^8]: Novelty versus sports ranks — pipeline/data/analysis/volume-anatomy/novelty_vs_sports.json (R14).
[^9]: Mexico-England zoom — pipeline/data/analysis/volume-anatomy/mexeng_summary.json, mexeng_advance_tape.parquet (R8).
[^10]: Size and frequency regimes — pipeline/data/analysis/ingame-microstructure/size_regime.parquet (R16); FRA-ESP pre-kick surge probe — research/data-audit.md §5.

**Microstructure arm**
[^11]: Post-goal mechanism — pipeline/data/analysis/ingame-microstructure/reaction_latency.parquet, events_matched.parquet (R3).
[^12]: Overreaction and fade — pipeline/data/analysis/ingame-microstructure/overreaction_fade.parquet (R20).
[^13]: Germany-Paraguay instrument switch — pipeline/data/analysis/ingame-microstructure/shootout_ticks_JUN29GERPAR.parquet (R4).
[^22]: Cross-arm suspension artifact and lead-lag prohibition — findings-dossier.md §4; pipeline/data/analysis/ingame-microstructure/leadlag.parquet, research/analysis/ingame-microstructure-methods.md (R23).

**Calibration arm**
[^15]: Kalshi-Polymarket braid and Pinnacle terminations — pipeline/data/analysis/calibration/kalshi_vs_polymarket_episodes.csv, kalshi_vs_polymarket_max_gaps.csv, match3way_panel.parquet (R2).
[^16]: Scores by source and horizon; matched legs — pipeline/data/analysis/calibration/scores_match3way_by_source_horizon.csv (R5); pipeline/data/analysis/bias-forensics/flb_matched_kalshi_vs_pinnacle.parquet (R19).
[^17]: Poll-market gaps — pipeline/data/analysis/calibration/poll_vs_market_gaps.csv (R10).
[^21]: Semifinalists versus Opta/Elo — pipeline/data/analysis/calibration/semifinalists_price_vs_opta_elo.csv (R6).

**Bias arm**
[^14]: Post-upset drift — pipeline/data/analysis/bias-forensics/post_upset_drift.parquet, post_upset_drift_series.parquet (R9).
[^18]: Host peer band; zombie-money footnote — pipeline/data/analysis/bias-forensics/us_home_bias_futures_peer.parquet (R12); zombie_money.parquet, zombie_money_trades.parquet (R21).
[^19]: Golden Boot book — pipeline/data/analysis/bias-forensics/golden_boot_daily.parquet, golden_boot_snapshot.parquet (R13).
[^20]: Favorite-longshot buckets and weight toggle — pipeline/data/analysis/bias-forensics/flb_kalshi_buckets.parquet, flb_kalshi_buckets_volweighted.parquet, flb_kalshi_market_level.parquet (R7).
