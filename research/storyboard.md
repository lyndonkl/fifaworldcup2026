# Storyboard — Gate 2 artifact (final, critique-resolved)

**The Market Watched the World Cup** (working title; candidates below) · v1 drafted 2026-07-14, hours after France-Spain (Spain 1-0, regulation); this revision resolves the four Gate 2 critiques (pacing, cognition, voice, mechanics) the same day. Written from the post-France-elimination vantage. The final is Spain against England or Argentina, July 19, MetLife. v1 publishes July 17-18, before the final.

Ground rules this storyboard obeys: every scene is powered by data that exists in the store per `research/data-audit.md`; every factual claim is the corrected claim from `research/findings-dossier.md`, verbatim where numbers appear; the eleven killed findings (cal-01, cal-02, cal-03, cal-07, cal-08, ig-03, ig-04, ig-09, bias-04, bias-05, bias-08) stay dead; R23 stands as a prohibition on any Kalshi-versus-Polymarket speed scene; settlement rule R4 (regulation versus advancement) is honored wherever a level-after-90 match appears. The population is never cut and redrawn. Every scene transition is a re-sorting of the same dots, or a narrated rest.

Disposition of every blocking and major critique issue: appendix A. Nothing was resolved silently.

---

## 0. The unit, stated once

- **Population grain (proposal, Gate 3 finalizes):** 1 dot = $75,000 of matched notional. At the July 14 tape ($12.3B) that is ~164,000 dots; recomputed and re-narrated at deploy. Mobile: 1 dot = $250,000 (~49,000 dots), narrated on screen as the device's grain.
- **Zoom grain:** 1 dot = 1 trade, always. Every grain change is narrated in the scene copy, never silent. Where a zoom window exceeds the particle budget (Mexico-England's ~1M trades), the scene narrates a stated sample ("every nth trade") rather than shifting silently; build phase confirms per-window counts.
- **Dots mean money, and only money.** A dot never stands for a score, a statistic, or a probability. When a scene speaks in derived quantities (Brier scores in S11, per-minute matched prices in S10), those are drawn as D3 marks above the population, which rests dimmed on screen; the rest is narrated. The population is never removed.
- **Dot size is never a magnitude channel.** Magnitude is always dot count or position. Per-trade size stories are carried by D3 overlays (S6's sparkline), never by scaling glyphs. This rule holds piece-wide, including S14's weight toggle.
- **Nothing below the grain disappears silently.** Any market whose lifetime tape sums to less than one dot renders inside an aggregate "below one dot" stratum with an on-screen count (S5), so listed-but-thin is visually distinct from never-listed.
- **A fixed micro-legend chip** sits in one corner of the canvas and states in one line what color currently means ("color: taker side," "color: contract family"). It updates whenever color's meaning changes and never disappears.
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
| 0 | Tonight, in Arlington | S1 cold open (population glimpse, then tick zoom), S2 rewind to birth | R17; fact base | Hook: the favorite is dead. Question planted: what is this thing that watched? |
| I | The flood | S3 arrival + counter, S4 the tournament's clock, S5 where dollars sat | R1, R18, R11, R15, R14 | "Zombie casino" dissolves into listing mechanics and the tournament's own clock |
| II | Match speed | S6 anatomy of the biggest market (zoom), S7 the goal three ways (Norway-Brazil), S8 which market you watch (zoom), S9 three shocks | R8, R16, R3, R20, R4, R9 | "Goal-spike panic" dissolves into mechanism: continuous books, suspension policy, settlement semantics, bracket arithmetic |
| III | The scoreboard | S10 one price two venues, S11 the verdict and the trap | R2, R5, R19, cross-arm suspension story | "Dumb retail" dissolves: parity at every live horizon; the analysis shows its own three wrong turns |
| IV | The sins that survived | S12 the anti-gotcha (Golden Boot), S13 the flags and the price, S14 the one real sin | R13, R10, R12, R21, R7 (+R15 spine) | Discipline about crying bias; then the three genuine residuals emerge |
| V | How to read the number | S15 thirteen months above the line, S16 the lens sequence, S17 the number | R6 + lenses (§4 below) | The reinterpretation: five habits applied to the final's frozen odds |
| — | Coda | S18 the rail releases | full store | Explorable replay; bounded |
| — | Epilogue (v2) | SE1 placeholder | post-final incremental pull | Scores the reinterpretation after settlement |

18 scenes in v1 (17 if the S12 fold trigger fires; see S12). Reader model: a smart generalist who has never traded a contract; every market-mechanics concept is taught on first contact inside a scene, never in an aside.

---

## 3. Scenes

### ACT 0 — Tonight, in Arlington

---

**S1 · Act 0 · "Ninety minutes in Arlington"**

**Beat, pre-title.** A still field of dots under one line of type: every dot on this screen is $75,000 that actually changed hands on the 2026 World Cup. About 164,000 dots, twelve billion dollars, thirteen months. One held breath, no motion. Then a few thousand dots near the timeline's right edge light up: tonight's. The title renders over the resting field.

**Beat.** France arrived in Arlington priced near forty cents to win the World Cup, the market's favorite for thirteen months.[^2] Ninety minutes later the contract was worth nothing. The lit dots fly forward and unpack, narrated: down here, one dot is one trade. Every dot on this screen is one real trade from that night, money changing hands as a belief died in regulation time.[^1] Before asking whether the market saw it coming, it is worth asking what this market actually is. The answer starts fourteen months earlier.

**Data.** KXWCGAME-26JUL14FRAESP legs and KXMENWORLDCUP-26-FR trade tape from the scheduled G1 `--since` re-drive (data-audit G1; runs post-semifinals, before build); goal/repricing event located by the detector pipeline (events list extension of `pipeline/data/analysis/ingame-microstructure/events_matched.parquet`). July 13 reference prices from `research/fact-base.json`. Population census for the pre-title frame from the same LOD tiles as S2. **Do not name the scorer or minute in prose; the tape supplies the repricing moment, the fact base gets updated with the verified result before Phase 4.**

**Units.** Layout: `resting-field` → `tick-stream`. The piece opens at population grain (the conceit is taught before it is bent: the reader sees the whole population once, with its grain stated, before any zoom). Then the first narrated grain shift: the dots carrying tonight's FRA-ESP tags fly forward and unpack into tick-grain trades. Trades enter left-to-right along a match-clock x-axis, y = price of the France winner leg; the 3-way legs run as fainter companion streams. Color: side (yes/no taker); the micro-legend chip makes its first appearance here. At the goal, the stream visibly reprices; at the whistle, the France dots pour to the zero line. A→B: pre-title field → zoom is the scene's own transition; outbound handled by S2 (the tick dots merge back into the field).

**Overlays.** D3: one pre-title caption line, match-clock axis (0'-90'+), price axis in cents, one annotation at the detected repricing event ("the goal"), one at the whistle, settlement line at zero. No team crests; typography only.

**Scroll.** Scroll-locked scrub with a **hard budget: the whole of S1, pre-title included, occupies at most six viewport heights.** The ninety minutes map to scroll non-uniformly, by information rather than clock: roughly 40% of the scrub's length dwells on the minutes around the detected repricing event, roughly 25% on the final minutes, the whistle, and the settlement pour, and the rest of the match compresses into what remains, with the match-clock axis visibly accelerating so the compression is honest and narrated, matching the compression discipline of S6 and S8. Static end state: the full night's stream with the two annotations.

**Mobile.** Same scene; stream density capped with narrated sampling if the re-driven tape exceeds budget; annotations collapse to numbered markers with a footer legend.

**Fallback (drafted now, not at build time under deadline).** If the G1 re-drive fails to land, the cold open becomes Norway-Brazil from the existing finalized store (R9/R22 tape) and the France death is told at population grain in S15. Opening beat text, ready to ship: *"Brazil arrived at MetLife with five stars on the shirt and a century of pedigree in the price. In the 79th minute, Erling Haaland scored; five minutes later he scored again, and every price that depended on Brazil moved within seconds. Norway's own tournament-winner leg would multiply about 3.6-fold.[^14] Every dot on this screen is one real trade from that night. Before asking how a market reprices a five-time champion in seconds, it is worth asking what this market actually is. The answer starts fourteen months earlier."* Same pre-title frame, same six-viewport budget, same two-anchor annotation scheme (the first goal, the whistle).

---

**S2 · Act 0 · "Thirteen months, asleep"**

**Beat.** The winner book opened in May 2025 and then did almost nothing for a year. The December draw, the moment the tournament became concrete, registers as a twitch: 190,000 contracts on the day, and the cleaner fingerprint is participation, 176 mostly small trades in the reveal hour.[^3] Peak match day would eventually run about 3,400 times larger in contracts and roughly 21,000 times larger in premium dollars.[^3] A market is not a poll that runs continuously; it is a crowd that shows up when something is at stake.

**Data.** `pipeline/data/analysis/volume-anatomy/daily_arrival_annotated.csv` (R17); Kalshi trade-tape LOD tiles (population attributes derived from the series-partitioned tape, per data-audit §1); listing dates from `pipeline/data/catalog/markets.parquet`.

**Units.** Layout: `timeline-ribbon`. **Grain shift, narrated:** the S1 tick dots shrink and merge back into their place in the resting field the reader saw before the title ("one dot again stands for $75,000 of traded volume; the population on this screen is the entire tournament, and it never leaves"). The population spreads along a May 2025 → July 2026 time axis, dot x = trade time, stacked density as y. Thirteen months of near-emptiness, one visible flicker at draw week, then the wall of June 11 looming at the right edge. Color: contract family (futures vs everything else), muted; micro-legend chip updates.

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

**Units.** Layout: `clock-grid`. The population re-sorts into an hour-of-day (x) by tournament-day (y) grid, each dot flying to its cell. **Color channels are sequenced, never simultaneous:** at assembly, cell brightness is dot density and nothing else; at the final step the grid recolors to the in-window versus out-of-window split at constant brightness, and the micro-legend chip updates. The kickoff histogram draws in its own bounded strip above the grid with its own labeled axis (a thin bar row, never painted over the cells), so the confound is the caption without two chart grammars sharing one space.

**Overlays.** D3: grid axes (ET hours, dates), the bounded kickoff-histogram strip, rest-day row annotations, a subtle "US waking hours" band with the ~2x residual note.

**Scroll.** Step-triggered: (1) the grid assembles, brightness only, (2) the kickoff strip draws above it ("the market's pulse is the schedule"), (3) the recolor to in-window versus out-of-window at constant brightness, with rest-day rows and the futures-versus-all contrast highlighted.

**Mobile.** Grid rotates portrait (dates run down the screen, hours across); the kickoff strip becomes per-row tick marks.

---

**S5 · Act I · "Where the dollars sat" (R15 + R14)**

**Beat.** Kalshi lists the outcome space; dollars find the plausible outcomes. Three core series, 414 contract legs, absorb 63.5% of all dollars, while 19,640 markets, more than half the catalog, carry 0.36% of volume; the pooled concentration reads as extreme, a Gini of 0.930, and the within-family reality is ordinary, 0.44.[^7] The catalog's most famous novelty, the biggest Trump-mention market, drew a real 1.40 million contracts and still could not crack the top 1,000; the honest punchline runs the other way, since the maximum of a 3,005-market family trading at catalog base rate should land near rank ten.[^8] America's biggest off-pitch market was roughly sixty times smaller than the moneyline on its own broadcast.[^8]

**Data.** `pipeline/data/analysis/volume-anatomy/concentration_summary.json`, `lorenz_curve.csv`, `market_totals.parquet` (R15); `novelty_vs_sports.json` (R14). Below-threshold census (markets under $75k lifetime, count and combined dollars) computed at build from `market_totals.parquet`.

**Units.** Layout: `lorenz-sweep`. The population re-sorts by market size into a sorted sweep that traces the Lorenz curve as an arrangement of the dots themselves; the long thin tail is visibly almost empty of dots. **Below-threshold stratum, always on:** markets whose lifetime tape sums to less than one dot render as a single thin band beneath the sweep with a count chip ("N markets traded less than one dot's worth, $75,000, over their whole lives, M dollars combined; they are drawn as this band, not as dots" — N and M computed at build). Listed-but-thin reads as traded-almost-nothing, never as nonexistent. The Trump market's dots light up as a single highlighted cluster deep in the tail. **Constancy note:** these tail dots carry a persistent tag; they return, unmoved in identity, as the sagging dots of S14.

**Overlays.** D3: Lorenz axes, equality diagonal, tail bracket labeled "19,640 markets, 0.36% of the money," the below-threshold band and count chip, Trump-dot callout ("rank ~1,083 of 30,133").

**Scroll.** Step-triggered: (1) sort and sweep with the band in place, (2) tail bracket, (3) Trump highlight with the inverted punchline.

**Mobile.** Sweep compresses; the tail bracket and band chip become the dominant annotations.

---

### ACT II — Match speed

---

**S6 · Act II · "Anatomy of the biggest market" (R8 + R16; dossier Act 3 zoom, placed here as the gateway to match world)**

**Beat.** The single biggest market of the tournament was not the winner book. It was Mexico to advance past England, 158.7 million contracts across roughly a million trades, host-nation money concentrated on one elimination night.[^9] Zoomed to individual trades, it looks like ordinary Kalshi retail flow at extraordinary scale: typical trade sizes, the exchange-wide taker-yes skew, a heavier pre-match profile than the median knockout market.[^9] The tape records that money moved; it cannot say whether the mover was hedging heartbreak or chasing it. The arrival rate tells its own story: the pre-kick hour already runs about one print per second, and the opening whistle steps it up about 5.4-fold.[^10]

**Data.** `pipeline/data/analysis/volume-anatomy/mexeng_summary.json`, `mexeng_advance_tape.parquet` (R8); `pipeline/data/analysis/ingame-microstructure/size_regime.parquet` (R16). The FRA-ESP pre-kick pile-in probe from data-audit §5 is **quarantined to footnote [^24], marked unverified**: it has not passed the Phase 2 refuters, must not appear in on-screen copy, and may be used only as a build-time cross-check until it clears verification on the re-driven tape and earns a dossier R-number.

**Units.** Layout: `match-zoom`. **Grain shift, narrated:** the population dims to a background field; the dots carrying the MEXENG tag fly to center and unpack into tick-grain trades ("for this scene, one dot is one trade; there are about a million, so the screen shows every nth, and n is printed here"). Emission-rate animation: trades arrive as a stream whose rate the reader feels ramp through the pre-match hour and step at the whistle. Color: taker side. **Size: uniform.** Per-trade size never scales the glyphs; the ~15% in-play size growth is carried by the D3 sparkline, so dot count remains the piece's only magnitude cue.

**Overlays.** D3: arrival-rate axis (trades/second), kickoff line with the ~5.4x step annotation, per-trade-size sparkline (the +15% in-play size growth lives here), caption block "what the tape can and cannot say about who was trading."

**Scroll.** Scrub through the market's final 24 hours compressed, with a dwell on the last pre-kick hour.

**Mobile.** Sampled stream at narrated n; rate axis becomes a haptic-adjacent pulse (visual metronome), since fine stream texture is illegible at phone size.

---

**S7 · Act II · "The goal, three ways" (R3 + R20; R23 prohibition enforced in the chart, not only the copy)**

**Beat.** A goal reaches three venues as three different mechanisms, and the differences are policy rather than intelligence. The vehicle is the goal the reader will meet again: Haaland's second against Brazil, from the finalized tape. Kalshi's book trades continuously through the goal minute; Pinnacle suspends about thirty-two seconds after the move begins, goes dark for roughly eighty, and reopens with a single quote already at the new fair level; Polymarket's stored history cannot resolve anything under sixty seconds.[^11] The often-repeated reaction ladder, 29 seconds versus 60 versus 119, is three measurement artifacts wearing a ranking.[^11] And the spike is the price: across clean goal reactions the post-jump level held within the roughly two-cent friction band at a thirty-minute horizon, so there was no overreaction to fade.[^12]

**Data.** `pipeline/data/analysis/ingame-microstructure/reaction_latency.parquet`, `events_matched.parquet` (R3); `overreaction_fade.parquet` (R20). **Vehicle committed: Norway-Brazil, Haaland's second (finalized tape, cross-source verified per data-audit §2).** No "or another" slot remains; the same match the reader watches repriced in three venues here becomes the shock beneficiary in S9's Norway-Argentina mirror, so the zoom grain is spent on material with stakes the ending pays off. Pinnacle store under R1-R3 defect rules; Polymarket at native 1-min. **Standing prohibition (R23): no cross-venue speed ranking anywhere in this scene; any lead/lag language is bounded to ±60 seconds by construction and therefore omitted.**

**Units.** Layout: `goal-clock-lanes`. Still inside match world: three horizontal lanes on one shared post-goal clock, and **each lane's marks are drawn at their native grain so the eye cannot run the race the prose refuses to state:** Kalshi trades render as tick dots; Pinnacle quotes render as requote dashes, a visibly different glyph, with the suspension window drawn as a literal darkness block; Polymarket renders as blocks each spanning its full 60-second native minute, so any within-minute position is visibly unresolvable, the same device as Pinnacle's darkness. Identical glyphs across lanes are banned. The shared clock is retained deliberately: the suspend-and-repost story requires one time base, and the anti-race guarantees live in the glyph grammar plus the first-step caption. AET/decay-zone events are excluded per R22 flag.

**Overlays.** D3: shared post-goal clock axis; **first-step caption, pinned: "these three lanes update at different native speeds; position on this shared clock is not a race";** suspension window drawn as a shaded darkness block captioned "no longer quoting"; friction band (±2c) around the post-jump level; caption "continuous tradability versus suspend-and-repost."

**Scroll.** Step-triggered: (1) the goal lands on all three lanes, with the native-speeds caption, (2) Pinnacle darkness, (3) the reopen dash, (4) the 30-minute friction band ("nothing to fade").

**Mobile.** Lanes stack vertically; the darkness block and the minute-blocks are the anchor visuals.

---

**S8 · Act II · "Which market you watch" (R4; the credibility explainer + shootout zoom)**

**Beat.** Which market you watch matters more than what the players do. Germany and Paraguay finished level, and the regulation-time contract did exactly what its rules require: the Germany leg ground from 48 cents to one over twenty-two minutes on accelerating settlement volume, a decay never exceeding seven cents a minute, while real goals jump nineteen to twenty-five cents inside thirty seconds.[^13] The advancement contract barely moved at the whistle and kept trading through the shootout for another hour.[^13] A reader watching only the regulation leg would see the market abandon Germany without news. The tape shows a contract obeying its own settlement clock, while belief kept trading in the advancement leg through every kick.

**Data.** `pipeline/data/analysis/ingame-microstructure/shootout_ticks_JUN29GERPAR.parquet` (R4). Settlement semantics per data-audit rule R4.

**Units.** Layout: `dual-path`. Two synchronized particle paths on one match clock: KXWCGAME-26JUN29GERPAR-GER dots riding the regulation leg down its 22-minute expiry glide, KXWCADVANCE dots holding level and then trading dense through the shootout. One path dies at the whistle; the other lives another hour. Tick grain, narrated ("one dot, one trade, both contracts").

**Overlays.** D3: match clock with 90' whistle line, dual price axes, decay-slope annotation ("≤7c/min: expiry, not news") against a goal-jump reference ("19-25c in 30s"), shootout region with per-kick markers where the tape shows tick clusters.

**Scroll.** Scrub from minute 85 through the shootout's end; a dwell at the whistle where the paths split is the scene's gold coin.

**Mobile.** Paths stack with a shared clock; per-kick markers become a compact strip.

---

**S9 · Act II · "Three shocks, three arithmetics" (R9)**

**Beat.** Three shocks, three different arithmetics. Paraguay's winner leg popped fivefold when Germany went out, Norway's about 3.6x over Brazil, Belgium's roughly twofold, and the 72-hour paths then diverged with bracket news rather than fading from excess: Paraguay drifted as France was confirmed next, Belgium converged on a known Spain quarterfinal.[^14] The tell is Norway, the same match the reader just watched at tick grain: its spike to 10.8 cents at hour 43 mirrors, minute for minute, Argentina's winner-leg crash while Egypt led.[^14] Whatever the highlight reels were celebrating, the tape was doing bracket arithmetic on the paths that remained.

**Data.** `pipeline/data/analysis/bias-forensics/post_upset_drift.parquet`, `post_upset_drift_series.parquet` (R9).

**Units.** Layout: `shock-align`. **Grain shift back out, narrated:** the match-world tick dots repack into population grain ("back to $75,000 a dot"). Three winner-leg dot-paths overlay on one event-time axis, shock at t=0. At the callout step, Norway's path and Argentina's path render together and move in mirrored lockstep. Color: beneficiary team per path; micro-legend chip updates.

**Overlays.** D3: event-time axis (hours since shock), normalized price axis, bracket-news annotations on each path (France confirmed next; Spain quarterfinal known), the Norway-Argentina mirror callout with both series drawn.

**Scroll.** Step-triggered: (1) three pops at t=0, (2) 72-hour divergence with bracket annotations, (3) the mirror.

**Mobile.** Paths render as small multiples, then the mirror pair alone gets a full-width panel.

---

### ACT III — The scoreboard

---

**S10 · Act III · "One price, two venues" (R2)**

**Beat.** For the entire knockout stage the two retail venues were effectively one market. Across 84 three-way legs, Kalshi and Polymarket never sustained a five-point gap for thirty minutes; the mean one-minute gap is 0.74 points, and the 41.6-point goal-second spikes last exactly one minute.[^15] The sixteen apparent divergences from the professional book tell a different story: all sixteen begin within about two minutes of Pinnacle's final quote and contain zero fresh ticks.[^15] Sixteen episodes, one cause: the professional book had stopped quoting.

**Data.** `pipeline/data/analysis/calibration/kalshi_vs_polymarket_episodes.csv`, `kalshi_vs_polymarket_max_gaps.csv`, `match3way_panel.parquet` (R2).

**Units.** Layout: `braid`. **Grain statement, on screen: "for this scene and the next, the dots rest; one mark here is one minute of matched price."** The population dims to a resting field (it is not removed; constancy holds through stillness). Above it, two per-minute matched-price traces draw as D3 marks (Kalshi, Polymarket) across the knockout stage; they braid so tightly they read as a single line, with the one-minute goal-second separations flashing and closing. The traces are per-minute samples by construction (the underlying panel is a per-minute metric), which is exactly why they are drawn as D3 marks rather than population dots: a dot is money, and these marks are prices. Pinnacle renders as a D3 line for the same reason; at each of the sixteen episode timestamps the line goes dashed and grey at its last tick, captioned "no longer quoting."

**Overlays.** D3: time axis over the knockout window, **price axis (points)** (raw exchange quotes, so the label says price, not probability), the Pinnacle overlay line with dashed-grey terminations, a gap-meter showing the running 1-min mean (0.74 points), and a count-up chip for the terminations.

**Scroll.** Step-triggered: (1) the braid assembles, (2) goal-second flashes, (3) the sixteen grey terminations land in sequence, then **a scripted held pause: the count-up chip runs to "16 for 16: every episode starts at a final quote"** before the gap-meter resolves. Act III's standalone visual beat lives here by design, not by luck.

**Mobile.** The braid is the hero; the terminations keep the count-up chip rather than sixteen separate marks.

---

**S11 · Act III · "The verdict, and the trap" (R5 + R19 + cross-arm suspension story)**

**Beat.** At every horizon where both were alive, the amateurs and the professionals scored the same. At a day out and an hour out, Kalshi, Polymarket, and the de-vigged professional book post near-identical Brier scores, 0.158 to 0.169, on the same 84 legs; matched leg for leg at T-24h the gap is 0.162 versus 0.164, a sample that can rule out a large skill gap and establish nothing stronger.[^16] The lone blowout, at five minutes to settlement, scores live repricing against a product that had ceased to exist, since in-play books close at the whistle by design; roughly 74% of the professional book's error comes from five matches with stoppage-time goals landing after its book closed.[^16] This analysis walked into that trap three separate times, in three separate arms, before the tape corrected it.[^22] The receipt stays on screen, small.

**Data.** `pipeline/data/analysis/calibration/scores_match3way_by_source_horizon.csv`, `match3way_panel.parquet` (R5); `pipeline/data/analysis/bias-forensics/flb_matched_kalshi_vs_pinnacle.parquet` (R19). The three-traps beat sourced to the dossier's cross-arm section and `research/data-audit.md` rules.[^22]

**Units.** Layout: `brier-columns`. **No population re-sort: the dots stay at rest** (a Brier contribution is a score, not money, and dots never stand for anything but money; the rest was narrated at S10). D3 column groups render above the resting field: three sources by three horizons. The T-5min panel assembles last, looks like a blowout for one beat, then is struck through on screen while its columns desaturate to grey. **The three-traps receipt is a compact side panel, not a scroll step:** it appears alongside the crossout, listing the three places the same artifact surfaced (episodes, ladder, blowout), each collapsing to the same grey. Open question 5 from v1 is resolved here: the receipt earns its place as a footnote-weight callout, not a fifth reveal, cutting Act III's step count at the piece's most attention-fragile stretch.

**Overlays.** D3: column chart frames, horizon labels, the strike-through annotation with the narrated reason, the three-traps side panel, small-n caveat printed as a caption rather than hidden ("84 coupled legs, effective n of 28").

**Scroll.** Step-triggered, three steps (down from five): (1) T-24h and T-1h parity assemble together, (2) the T-5min blowout appears, (3) the crossout lands, with the side-panel receipt riding the same step.

**Mobile.** Horizon panels become sequential full-width cards; the crossout card carries the receipt as its footer.

---

### ACT IV — The sins that survived

---

**S12 · Act IV · "The market was not fooled by the scoreline" (R13; the anti-gotcha)**

**Beat.** The naive read says the market ignored the scoreboard; the resolution says it priced the future. Mbappe traded at 61 cents against Messi's 31 to 32 on identical eight-goal tallies, and the gap resolves first through expected remaining goals, the two having traded level on July 7 and 8 with Mbappe still a goal behind, and second through the contract's own assist tiebreak.[^19] Kane's four cents on six goals is fair under a plain Poisson read of realized rates, and his price halved on the day England won because he burned 120 scoreless minutes.[^19] France's elimination re-runs the same lesson live: the ladder reprices paths, and the final decides the race. Every figure on this screen refreezes on deploy morning.

**Data.** `pipeline/data/analysis/bias-forensics/golden_boot_daily.parquet`, `golden_boot_snapshot.parquet` (R13). Post-July-14 moves (dossier limits note: Kane back to 8c, Mbappe halved to 30c, Messi to 59c on partial data) recomputed at deploy; boot state (Mbappe 8 eliminated, Messi 8 alive, Kane 6 alive) confirmed against the re-driven tape and fact base.

**Liveness trigger, decided now (resolves v1 open question 6).** The boot race resolves July 15-19, inside the build window, so the keep-or-fold call is a checkable rule rather than a crunch-time judgment: **at the July 16 morning check, after England-Argentina settles, if fewer than two players with matches still to play remain within two goals of the outright lead, S12 folds to a two-step beat inside S13** (naive frame and resolution compressed to one paired panel each; the Kane and July 7-8 annotations survive as captions; scene count drops to 17 and the act map is updated). Otherwise S12 ships as specced with the deploy-morning refreeze.

**Units.** Layout: `boot-ladder`. Dots re-sort into per-player daily price columns (Mbappe, Messi, Kane, Haaland as the eliminated reference); dot count is money, so each day's column thickness is that day's traded notional and the path's y-position is the price. The scene performs the anti-gotcha in two moves, and **the naive state is visually marked as provisional:** it renders desaturated, under a pinned label set in the piece's caveat style ("the naive read"), with the naive caption typeset as a question ("same goals, double the price?") and a persistent keep-scrolling affordance. Only the resolved state gets full color, and **the share/OG image and the no-JS static fallback for this scene are the resolved frame, never the naive one.**

**Overlays.** D3: player lanes, tally badges, the July 7-8 "traded level, one goal behind" annotation, the Kane-halving annotation ("120 scoreless minutes"), assist-tiebreak footnote chip.

**Scroll.** Two-step reveal: naive read (desaturated, labeled), then resolution (full color, caption rewrites itself). The rewrite-on-screen is the scene's signature.

**Mobile.** Lanes stack; the two-step reveal is preserved exactly (it is the point).

---

**S13 · Act IV · "The flags and the price" (R10 + R12; R21 as a footnote line)**

**Beat.** The fans never got a vote on the price. 87% of Argentine respondents said Argentina would repeat while the winner leg traded at 11 cents; 7% of Americans named the USA while the US-listed exchange held the contract at a cent and a half, and agreement shares are not probabilities in the first place, a units caption the scene keeps on screen.[^17] Host attention was real money: Mexico and the USA drew two to two and a half times the pre-tournament contracts of model-equivalent peers, and the attention bought price as well as volume, Mexico at roughly 1.8 times and the USA at roughly 1.5 times their model odds on tournament eve.[^18] Loud in volume, faint in price. When the losers died, the money left within the settlement sweep: all 28 knockout losers' winner legs wound down in 302 trades worth about $2,340, everything at or below a cent.[^18]

**Data.** `pipeline/data/analysis/calibration/poll_vs_market_gaps.csv` (R10); `pipeline/data/analysis/bias-forensics/us_home_bias_futures_peer.parquet` (R12); `zombie_money.parquet`, `zombie_money_trades.parquet` (R21, one caption only; with bias-08 dead it stays small per the dossier). European market-above-poll gaps carry the normalization-artifact caveat (41% "not sure") wherever shown.

**Units.** Layout: `flag-pairs`. Dots form paired comparisons per country: a poll bar (drawn by D3, since respondents are not trades) beside a dot-built price column. Then the host-peer beat: four team columns (USA, Mexico, Ecuador, Croatia) built of dots at honest pre-tournament scale, with the price-versus-model dot overlay above each.

**Overlays.** D3: poll bars, units caption ("agreement shares are not probabilities"), model reference line for the peer band, zombie-money footnote chip at the bottom ("302 trades, ~$2,340, all ≤1c").

**Scroll.** Step-triggered: (1) Argentina pair, (2) USA pair, (3) host-peer columns, (4) footnote chip.

**Mobile.** Pairs become sequential cards; the units caption pins to the top of each.

---

**S14 · Act IV · "The one real sin" (R7; shares its visual spine with S5 per the dossier's cross-arm note)**

**Beat.** One sin survived verification, and it lives where the money was not. Cheap yes-legs underperformed their price, an implied 3.04% paying 1.19% at an hour out, but 72% of those observations sit in prop ladders with ten or more legs and 55% sit at the one-to-two-cent tick floor; weight the same curve by dollars actually traded and the sag flattens to about half a point.[^20] The worst-calibrated bucket of all is the 90-to-95-cent favorite, so the textbook one-sided story fails in both directions.[^20] The dots sagging here are the same dots that sat in the Lorenz tail three acts ago. Mispricing and emptiness are one map at two exposures.

**Data.** `pipeline/data/analysis/bias-forensics/flb_kalshi_buckets.parquet`, `flb_kalshi_buckets_volweighted.parquet`, `flb_kalshi_market_level.parquet` (R7); Lorenz-tail identity tags from S5 (`market_totals.parquet`).

**Units.** Layout: `calibration-curve`. Dots assemble into implied-versus-realized buckets along the diagonal (dot count per bucket is money in that bucket; position is the bucket's rates); the cheap-end sag is visible as dot mass below the line, and the sagging dots visibly re-light with their S5 tail tag (the constancy payoff, called out in one caption). **The markets-versus-dollars toggle re-positions each bucket's realized-rate marker and re-lights which dots carry emphasis; dot size never changes** (size is not a magnitude channel anywhere in the piece, per §0). The sag flattens on screen. The 90-95c bucket gets its own callout so the one-sided story cannot survive the scene.

**Overlays.** D3: diagonal, bucket axes, per-bucket realized-rate markers (the marks the toggle moves), the toggle control (also keyboard-accessible; reduced-motion gets a crossfade between the two weightings), tick-floor bracket at 1-2c, the 90-95c callout.

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

Five lens beats as five scroll steps inside one pinned scene. **Each lens re-sorts the population into exactly one anchor mark from one prior scene** (braid, curve, mirror, pair, strip), so the reader re-parses a single remembered grammar per step even as the stride shortens; the ordinal framing lives in the D3 title lockups, and each beat's prose opens on a different syntactic foot.

**Beat, L1 (lockup: "Habit one: the number is the number").** The number, once the vig is stripped, is the number. At a day out the amateurs and the professionals scored the same all tournament,[^16] and the two retail venues never sustained even a five-point disagreement for half an hour.[^15] No one sharper is waiting behind this price. Anchor mark: the braid alone.

**Beat, L2 (lockup: "Habit two: where the money is").** Trust the pools, not the ladders. The final's three-way and the winner legs are the deepest markets of this exchange's life, and weighted by dollars actually traded the big markets were nearly calibrated all tournament.[^20] The first-scorer and exact-score ladders carry the one real mispricing the tape ever confirmed, a lottery tax bounded by the one-cent tick.[^20] Anchor mark: the calibration curve in its dollar-weighted end state, tail tags lit.

**Beat, L3 (lockup: "Habit three: the spike is the price").** If a shock lands, the spike is the price. Clean goal reactions held their post-jump level within friction at a thirty-minute horizon, and every shock of this tournament repriced to bracket arithmetic rather than fading from panic.[^12] The same arithmetic that halved Kane's price on 120 scoreless minutes prices a shock: remaining paths, not headlines.[^19] One clause of fine print for a level final, carried from Act II: near minute ninety the regulation contract grinds to its tie-locked price by construction, and belief speaks through the winner legs.[^13] Anchor mark: the Norway-Argentina mirror alone; the fine print is caption text, never a second chart.

**Beat, L4 (lockup: "Habit four: attention is not belief").** Final day, the flags will be at their loudest, and the price will not care. Fans at 87% agreement met an 11-cent market, and a home crowd's team traded at a cent and a half on its own country's exchange.[^17] Attention moved volume by multiples all tournament and never bought more than a point or two of price.[^18] Anchor mark: the Argentina poll-price pair alone.

**Beat, L5 (lockup: "Habit five: this market holds opinions").** One habit is still an open bet. The market kept France above the model for thirteen months and Spain below it, and Spain is the team still standing.[^21] Whether that discount was information or attachment is the one question the tape could not settle. The piece stakes it here: the epilogue will return to this number and say which it was. Anchor mark: the stage strip, France grey, Spain lit.

**Data.** Recap layouts reuse single anchor tiles: S10's braid (L1), S14's curve with S5's tags (L2), S9's mirror (L3), S13's Argentina pair (L4), S15's strip (L5); no new analysis tables. Opponent name (England or Argentina) is a template slot resolved after July 15; if Argentina, L4 gains a one-line callback to the 87% figure, drafted both ways at Phase 4.

**Units.** Layout: `lens-carousel`. Per step, the population re-sorts into a scaled-down echo of one source scene's single anchor mark, holds one beat, then flows to the next. Color desaturates progressively so that by L5 only the Spain and opponent dots hold full saturation.

**Overlays.** D3: lens title lockups (the ordinals live here, not in the prose), one mini-axis set per anchor mark, nothing else. The stride shortens deliberately; captions get shorter with each lens, and the one-grammar-per-lens rule is what makes the shortening safe.

**Scroll.** Step-triggered, one lens per step; reduced-motion gets crossfades between held end states.

**Mobile.** Each lens is a full-viewport card; the anchor marks are already singular by design (braid, curve, mirror, pair, strip).

---

**S17 · Act V · "The number"**

**Beat.** This is where the piece stops narrating and starts holding still. The number below is the market's price for the final, frozen and timestamped on the morning of July 19; it will not update, and that is the point.[^23] It is a raw traded price, and the piece says so where it matters most: the winner book's legs sum above one hundred percent before the vig is removed, so the devigged implied probability prints directly beneath it, same freeze, same timestamp.[^23] The reader now knows what this number is made of: two venues enforced into one price, a spike that holds once it lands, depth where it can be trusted, a lottery tax where it cannot, attention that never bought a point of loyalty, and one year-long conviction that just lost its favorite. Read it with those habits. The epilogue will read it with the result.

**Data.** G3 morning-of-final refresh (scheduled, per CLAUDE.md hard constraint): KXMENWORLDCUP-26-ES and the opponent's winner leg, plus the final's KXWCGAME 3-way legs, pulled by the pipeline re-run, frozen and timestamped at deploy; **the refresh computes the devigged implied probabilities alongside the raw prices in the same pass.**[^23] Hero number proposal: the winner-futures pair (the contracts alive since May 2025, closing the loop with S2); the 3-way trio renders beneath at smaller scale. Author decision at Gate 2 (open question 3).

**Units.** Layout: `settle`. The full population converges and dims to a quiet field; only the dots belonging to the final's contracts stay lit, and they arrange into the price figure's underline. The timestamp renders in type, not particles. End state is fully static and screenshot-ready; this is the frame most readers will share, which is exactly why it carries the devig line: the piece's most-shared frame keeps the same units discipline as its least-shared one.

**Overlays.** D3: the frozen prices in large type; **directly beneath, in smaller type, the devigged implied probability ("stripped of the vig: XX.X%")**; the timestamp; one line of provenance ("raw traded price, frozen at pipeline run <ISO timestamp>; multi-way legs sum above 100% before the vig is removed; this number does not update").

**Scroll.** The rail releases at the bottom of this scene, into S18's scripted fade-up rather than a hard cut.

**Mobile.** Identical; this scene is designed mobile-first since it is the shareable frame.

---

### CODA

---

**S18 · Coda · "The rail releases"**

**Beat.** The story is told; every dot above is still yours to open. Pick a contract and scrub its price life from listing to settlement; open a zoom match and step through it tick by tick. Nothing here is a simulation. Every dot is money that moved.

**Data.** Full LOD tile store (population grain) plus the committed zoom tiles (MEXENG window, GER-PAR shootout, FRA-ESP night, the Norway-Brazil goal window). Bounded scope per DECISIONS #16: a market picker and a match scrubber, not a second app.

**Units.** Free camera over the resting population in the S2 timeline layout; selecting a market lifts its dots into a replay lane. Grain rules and narrated sampling identical to the narrative scenes.

**Overlays.** D3: picker UI, replay transport, per-market metadata chip (series, volume by tape sum per rule R6, settlement). **Entry is scripted as an epilogue-gift, not a mode switch:** the picker and transport fade up slowly over the resting field, after the transitional line above, so the reader leaves S17's stillness by invitation rather than by snap.

**Scroll.** Native scroll returns; the coda is a bounded interactive block, then the methods note and bibliography.

**Mobile.** Picker becomes a searchable list; scrub gestures native.

---

## 4. The ending: lens selection and order

The dossier drafted six lenses. The storyboard runs five, in this order: **consensus → where-the-money-is → fair-jump → attention-is-not-belief → conviction**, then the number itself (S17). Three editorial calls:

1. **The mechanism lens is folded into the fair-jump lens** as its one clause of fine print (L3). Act II teaches the mechanism twice at full length (S7, S8); restating it as a standalone lens would slow the ending's stride exactly where the pacing must accelerate. Nothing is dropped silently; the instrument-switch warning survives as the fine print a reader needs for a level final, and S17's closing enumeration carries all five habits, fair-jump included.
2. **The conviction lens closes, rewritten for tonight.** The dossier drafted it conditional on France reaching the final. France did not. The corrected lens is stronger: the market's most stubborn opinion lost its object in ninety minutes, and the team it discounted for a year is the one left playing. The honest framing is preserved from the dossier's own logic: a single match cannot falsify a probability, so the lens ends on the stake rather than a verdict, and hands the question to the epilogue.
3. **One anchor grammar per lens.** Each lens recaps exactly one chart form the reader has already lived through (braid, curve, mirror, pair, strip), so re-parse load falls as the stride shortens instead of fighting it. L3 additionally closes the dossier's strongest cross-arm loop in one clause: the path-pricing habit that priced Kane's scoreless minutes is the habit that prices a shock.

The scroll pacing argument for the order: L1 establishes calm authority (read it as the number, vig stripped), L2 makes it practical (which numbers to trust), L3 arms the reader for match day (live reading), L4 clears the final-day noise (the flags), L5 lands the wound and the open question, and S17 goes silent on the number. Stride and caption length shorten monotonically across the five steps; the last thing that moves on screen is the population settling under the frozen price.

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

- **G1 re-drive (scheduled):** S1, S12's boot state, S15's settlement beat all touch the post-July-14 tape. One `--since 2026-07-14T05:00:00Z` re-drive after England-Argentina settles; run twice if the FRA-ESP tape is wanted sooner. S1's fallback beat is fully drafted in-scene, so a re-drive failure costs a swap, not a rewrite.
- **G2 kickoff-time discrepancy:** resolve fact-base 19:00Z versus catalog 22:00Z before building S1's event window (data-audit G2).
- **G3 morning-of refresh:** S17's frozen number, raw and devigged computed in the same pass; scheduled, mechanically verified.
- **G4 Trends (optional human step):** a ~5-minute manual export would upgrade S4's attention framing from participation proxy to an independent series; otherwise the methods note carries the $0-budget coverage-gap line, per the dossier's honest-limits section.
- **S12 trigger check (new, dated):** July 16 morning, after England-Argentina settles: apply the liveness rule in S12; if it fires, execute the fold-into-S13 contingency and update the act map to 17 scenes.
- **[^24] verification queue:** the FRA-ESP pre-kick surge probe (16.4x) enters the Phase 2 refuter queue once the re-driven tape lands; it stays off-screen unless it earns a dossier R-number.
- **Recompute at deploy:** every dated figure (counter totals, boot prices, winner legs, dot-grain census, S5's below-threshold census) refreezes at the deploy-morning re-run per CLAUDE.md; the dossier's 98.6%/98.7% in-tournament share (R1 vs R11) is reconciled to a single recomputed figure at that pass so the piece never prints both.
- **Fact base update:** tonight's result (Spain 1-0, regulation) enters `research/fact-base.json` with a verified source before any prose ships; S1/S15 prose currently rests on author-supplied state.[^1]

---

## 7. Open questions for the author (Gate 2)

1. **Title.** Seven candidates in §1; candidates 2 ("A Mechanism, Not a Mood") and 3 ("Regulation Time") carry the thesis hardest. Pick one, or direct a second round.
2. **Cold open confirmation.** S1 now teaches the population conceit in a pre-title frame before zooming, and its fallback beat is drafted verbatim; the in-medias-res open on tonight's France death remains this storyboard's recommendation. Confirm, or prefer the chronological open (S2 first) with tonight held for S15.
3. **The hero number.** S17 proposes the winner-futures pair as the frozen number (closing the loop with the May 2025 birth), with the final's 3-way beneath; the devigged line renders in either case. Alternative: lead with the 3-way. Which instrument is the piece's last word?
4. **Tone of the conviction ending.** How hard may L5/S15 lean on "the conviction failed"? Current draft holds the line at "one match settles nothing, but the discounted team is the one still standing." Confirm this register or direct something more rueful.
5. **Trump/novelty register (S5).** The inverted punchline is wry. Confirm the analyst register holds it, or soften to a caption without the "top 1,000" line.
6. **Opponent-conditional copy.** S16 L4 and all ending prose carry an England/Argentina template slot; if Argentina reaches the final the 87% Ipsos line gains a live callback. Approve drafting both variants at Phase 4.
7. **Population grain unit.** Dollars ($75k/dot) versus contracts (~80k contracts/dot) for the persistent population; dollars is this storyboard's proposal because the piece's counter and Lorenz scenes speak in dollars. Confirm before Gate 3 locks the design system.
8. **Trends export (G4).** Authorize the 5-minute manual export, or accept the methods-note line? Affects only S4's caption depth; no scene depends on it.

(v1's open questions 5 and 6 are resolved in-scene: the three-traps receipt is demoted to a side panel in S11, and S12 carries a dated, checkable fold trigger.)

---

## Appendix A. Critique disposition (Gate 2 review, four lenses)

Every blocking and major issue, with its resolution. Minors taken are listed at the end. Nothing was ignored silently.

**Pacing**

| # | Scene | Severity | Issue | Resolution |
|---|---|---|---|---|
| P1 | S1 | blocking | 90-minute scroll-locked scrub had no length cap and only two anchors; longest, least-anchored scene at the piece's most costly position | Hard budget: at most six viewport heights, pre-title included. Non-uniform scroll-to-time mapping specified (dwell on the goal and the whistle, dead minutes compressed, clock axis visibly accelerating). Norway-Brazil fallback beat text drafted verbatim in-scene, not at build time. |
| P2 | S11 | major | Five stacked step-triggers at the ~55-60% attention trough; open question 5 unresolved | Steps cut from five to three: the two parity horizons assemble together, and the three-traps receipt is demoted from a scroll step to a compact side panel riding the crossout step. Open question 5 resolved now. |
| P3 | S12 | major | Golden Boot liveness is a dated production risk; fold contingency left to build-time judgment | Explicit checkable trigger set now: July 16 morning check; if fewer than two players with matches still to play remain within two goals of the outright lead, S12 folds to a two-step beat inside S13. Open question 6 resolved now. |
| P4 | S7 | major | Signature zoom device spent on a placeholder vehicle ("Norway-Brazil or another") | Committed to Norway-Brazil, Haaland's second, from the finalized tape. The commitment buys the through-line the critique identified: the goal repriced three ways in S7 is the shock beneficiary in S9's mirror, and the S1 fallback uses the same night. |

**Cognition**

| # | Scene | Severity | Issue | Resolution |
|---|---|---|---|---|
| C1 | S1 | blocking | The population conceit was not learnable from S1; the piece opened at zoom grain with nothing to zoom from | Pre-title resting-field frame added: the full population appears once, grain stated in one caption, before the narrated zoom into tonight's trades. S1 is now a stated zoom from a seen population; S2's re-merge closes the loop. The chronological-open alternative remains available to the author (open question 2). |
| C2 | S17 | blocking | Hero frame dropped the devig discipline the piece's own calibration findings required; L1 claimed "the number is the number" over a raw multi-way price | The devigged implied probability prints directly beneath the raw hero price, computed in the same G3 refresh; the provenance line states that multi-way legs sum above 100% before the vig is removed. L1's copy is now "the number, once the vig is stripped, is the number." |
| C3 | S7 | blocking | Identical dot glyphs on one shared post-goal clock would let the eye run the exact lead/lag race R23 prohibits | Native grain is encoded in the glyphs: Kalshi tick dots, Pinnacle requote dashes plus the darkness block, Polymarket blocks each spanning their full 60-second native minute. Identical glyphs across lanes are banned, and a pinned first-step caption states the lanes are not a race. The shared clock is retained deliberately (the suspend-and-repost story requires one time base); the anti-race guarantee lives in the glyph grammar and the caption rather than in de-aligned origins, which would break the suspension narrative. |
| C4 | S5 | major | Markets under $75k render as zero dots, visually identical to markets never listed | Always-on below-threshold stratum: a thin band beneath the sweep with a build-time count chip ("N markets traded less than one dot's worth"). The convention is promoted to §0 so no scene can silently equate thin with absent. |
| C5 | S11 | major | Per-leg Brier contributions are not money; reusing population dots would break the unit, a new dot convention would be unnarrated | Redesigned: the scores render as D3 columns above the resting, dimmed population, and §0 now states the rule generally: dots mean money and only money; derived quantities are always D3 marks; rests are narrated. |
| C6 | S10 | major | The braid's grain was ambiguous (population dots cannot form a continuous line through quiet minutes) | The braid is drawn from per-minute matched-price D3 marks, with the grain narrated on screen ("one mark here is one minute of matched price") in the same sentence that narrates the population's rest. |
| C7 | S6 | major | Dot size as a second magnitude channel alongside the piece's count-based grammar (and again in S14's toggle) | Size channel deleted piece-wide (§0 rule). S6 dots are uniform; per-trade size lives in the D3 sparkline. S14's toggle re-positions bucket markers and re-lights emphasis; size never changes. |
| C8 | S16 | major | L2 and L3 packed two to three chart grammars each into steps whose dwell time is designed to shrink | One anchor grammar per lens: braid (L1), curve (L2), mirror (L3), pair (L4), strip (L5). L3's instrument-switch fine print is caption text, never a second chart. Re-parse load now falls with the stride instead of fighting it. |
| C9 | S12 | major | The naive step-1 frame was a complete, screenshot-ready, misleading claim | Naive state renders desaturated under a pinned "the naive read" label with the caption typeset as a question and a persistent keep-scrolling affordance; only the resolved state gets full color; share/OG image and no-JS fallback default to the resolved frame. |

**Voice**

| # | Scene | Severity | Issue | Resolution |
|---|---|---|---|---|
| V1 | S13 | blocking | "a price premium of roughly 1.5x to 1.8x model odds rather than instead of one" does not parse (dossier shorthand carried verbatim) | Rewritten: "the attention bought price as well as volume, Mexico at roughly 1.8 times and the USA at roughly 1.5 times their model odds on tournament eve." Numbers unchanged, single contrast, one citation. |
| V2 | S9/S10 (also S8) | major | The "X is not A; it is B" antithesis mold appeared five times, twice back to back | Capped at two instances piece-wide (S2's thesis-setting use and S12's naive/resolution frame). S8 now closes on what a reader would see versus what the tape shows; S9 closes on "the tape was doing bracket arithmetic on the paths that remained"; S10 closes on "Sixteen episodes, one cause: the professional book had stopped quoting." |
| V3 | S17 | major | The closing enumeration silently dropped the fair-jump habit, one of the five it claims to hand the reader | "a spike that holds once it lands" added between the venue clause and the depth clause; all five lens habits are now represented, verified against the L1-L5 list. |

**Mechanics**

| # | Scene | Severity | Issue | Resolution |
|---|---|---|---|---|
| M1 | S6 | major | The unverified FRA-ESP 16.4x probe shared footnote [^10] with adversarially verified R16 material | Split into its own footnote [^24], explicitly marked unverified, data-audit live probe only, banned from on-screen copy until it clears the Phase 2 refuter queue on the re-driven tape and earns a dossier R-number. §6 tracks it as a queue item. |

**Minors taken** (all four critiques): S16 L3 gains the path-pricing bridge clause (Kane's scoreless minutes and shock pricing are one habit); S10 gains the scripted "16 for 16" held count-up as Act III's standalone visual beat, and its axis is relabeled "price axis (points)"; S18 gains the fade-up entry and the transitional line "the story is told; every dot above is still yours to open"; S4's brightness and hue channels are sequenced and the kickoff histogram gets its own bounded, labeled strip; §0 adds the persistent micro-legend chip for color-meaning changes; S16's lens beats vary their syntactic openings with ordinals moved to the lockups; S11 restores the dossier-verbatim "five matches with stoppage-time goals"; S12 restores Messi's "31 to 32 cents" range.

---

## Bibliography

**Project ground truth**
[^1]: Tournament state and July 14 result (Spain 1-0, regulation) — author-supplied, 2026-07-14; to be verified against the G1 re-driven tape and written into research/fact-base.json before Phase 4.
[^2]: Kalshi winner-leg and 3-way reference prices, July 13 snapshot — research/fact-base.json (kalshi section); pre-kick prices recomputed from the re-driven tape.
[^23]: Freeze-and-timestamp mechanics, morning-of-final refresh, and devig computation at refresh — CLAUDE.md hard constraints; research/data-audit.md G3.

**Volume arm**
[^3]: Draw-week fingerprint — pipeline/data/analysis/volume-anatomy/daily_arrival_annotated.csv (dossier R17).
[^4]: Family crossover — pipeline/data/analysis/volume-anatomy/family_cumulative.parquet, family_crossover.json (R18).
[^5]: Reconciled tape totals and press floor — pipeline/data/analysis/volume-anatomy/daily_arrival_annotated.csv, regime_breaks.json (R1).
[^6]: Tournament clock — pipeline/data/analysis/volume-anatomy/hourly_pulse_et.csv, match_window_split.csv, match_windows.parquet (R11).
[^7]: Concentration and Lorenz — pipeline/data/analysis/volume-anatomy/concentration_summary.json, lorenz_curve.csv, market_totals.parquet (R15).
[^8]: Novelty versus sports ranks — pipeline/data/analysis/volume-anatomy/novelty_vs_sports.json (R14).
[^9]: Mexico-England zoom — pipeline/data/analysis/volume-anatomy/mexeng_summary.json, mexeng_advance_tape.parquet (R8).
[^10]: Size and frequency regimes — pipeline/data/analysis/ingame-microstructure/size_regime.parquet (R16).

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

**Build-time cross-checks (unverified; not for on-screen copy)**
[^24]: FRA-ESP pre-kick pile-in live probe (16.4x morning volume, 93 minutes pre-kick) — research/data-audit.md §5. Unverified: never passed the Phase 2 method/interpretation refuters; quarantined from prose and overlays until re-derived from the G1 re-driven tape and issued a dossier R-number.
