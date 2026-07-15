# Prose Revision Plan — Reader Inference Burden + De-politicize S5

**Scope.** "Regulation Time," all 18 built scene modules (`docs/js/scenes/s01.js` .. `s18.js`).
**Reader model.** A smart generalist who has never traded a contract. Every trading term
and every load-bearing claim must be grounded from first principles, on screen, tied to
the animation in front of the reader, **before** the sentence that leans on it.
**Voice.** Strategist-voice throughout the inserted glosses: third person, no em dashes,
no "not X, not Y, not Z" negation cascades, topic-forward, numbers keep their existing
footnotes. Glosses are definitional and short. They earn their place by removing a silent
inference, not by adding an aside.

The author's Gate-4 diagnosis is correct and matches the project's own design authority:
`research/design-system.md` §1 already commits the piece to "teach-on-first-contact
labeling with no standing legends." The prose has been asserting conclusions over
vocabulary the reader does not yet own. This plan closes each gap at the earliest
animation moment that can carry it visually.

**Two deliverables:**
1. A per-scene rewriter checklist (25 glosses across 12 scenes).
2. The S5 de-politicize swap (prose + scene JSON + overlay code + footnote + caption).

---

## Part 0 — Method

1. Extracted every prose beat in reading order from the `beats[].html` of all 18 modules,
   plus the static pre-title header in `docs/index.html`.
2. Built the concept-dependency map below: each domain term and load-bearing claim, the
   beat where it FIRST appears in reading order, and the prior concept it presupposes.
3. Naive-reader pass: read strictly in order as the target reader and flagged every point
   a term or claim is used before it is grounded. Each flag gets a one-sentence
   first-principles gloss and a placement (scene, beat, animation moment).
4. De-politicize: located the Trump usage (S5 prose b3 + the `trump_market` overlay
   singleton in `s05.js`) and verified swap candidates against the trade store.

---

## Part 1 — Concept-dependency map (first appearance, in reading order)

Status legend: **UNGROUNDED** (used before any teaching) · **SELF** (adequately glossed
in place) · **LATE** (taught, but after an earlier load-bearing use) · **INFER** (a smart
generalist can infer it; no gloss required).

| # | Term / claim | First beat | Presupposes | Status |
|---|---|---|---|---|
| 1 | price in **cents** = probability (contract pays $1) | S1 b1 ("near forty cents") | nothing | **UNGROUNDED** (keystone) |
| 2 | **contract** as an instrument | S1 b1 | #1 | UNGROUNDED (resolved by #1) |
| 3 | **taker side** / YES vs NO | S1 chip | #2 | UNGROUNDED |
| 4 | **settlement** ("worth nothing," the pour) | S1 b1 + overlay "settlement line" | #1 | **UNGROUNDED** (keystone) |
| 5 | **regulation time** (double meaning) | S1 b1 + title | settlement rules | LATE (taught in S8; accept) |
| 6 | the **winner book** / **book** | S2 b1 | #2 | **UNGROUNDED** |
| 7 | **contracts** as a volume unit vs **premium dollars** | S2 b1 | #2 | **UNGROUNDED** |
| 8 | a market is a crowd that shows up | S2 b1 | — | SELF |
| 9 | **futures book** | S3 b2 | #6 | INFER (from #6) |
| 10 | the **tape** | S3 b3 | #2 | **UNGROUNDED** (keystone; recurs ~20x) |
| 11 | **notional** | S3 b3 | #7 | UNGROUNDED (resolved by #7) |
| 12 | **$7.4B is a stale floor** (lower bound) | S3 b3 | #10 | UNGROUNDED (claim) |
| 13 | **in-tournament** | S3 b3 | — | INFER |
| 14 | hour-of-day **heatmap**, kickoff calendar, residual | S4 b2 | — | INFER |
| 15 | **leg** | S5 b2 ("414 contract legs") | #2 | **UNGROUNDED** (recurs everywhere) |
| 16 | **series** / core series | S5 b2 | catalog | **UNGROUNDED** |
| 17 | **Gini** | S5 b2 | — | UNGROUNDED (scale needs anchor) |
| 18 | **moneyline** | S5 b3 | #15 | UNGROUNDED (in Trump beat; see Part 3) |
| 19 | order-statistic **base rate / near rank ten** | S5 b3 | stats | UNGROUNDED (in Trump beat; dropped in swap) |
| 20 | **retail** flow | S6 b1 | #2 | **UNGROUNDED** |
| 21 | **taker-yes skew** | S6 b1 | #3 | UNGROUNDED (resolved by #3) |
| 22 | **print** (one executed trade) | S6 b1 | #2 | UNGROUNDED |
| 23 | hedging vs chasing | S6 b1 | — | SELF ("the tape cannot say") |
| 24 | the three **venues** (Kalshi / Polymarket / Pinnacle) | S7 b1 | — | **UNGROUNDED** (cast never introduced) |
| 25 | **suspend-and-repost** / goes dark / **fair level** | S7 b1-b2 | #24 | partly SELF; anchor needed |
| 26 | reaction **ladder** artifact | S7 b3 | — | SELF |
| 27 | **friction band** / **fade** | S7 b4 | #1 | **UNGROUNDED** |
| 28 | **regulation** vs **advancement** contract | S8 b1 | #4 | SELF (S8 teaches it well) |
| 29 | expiry **decay** / settlement clock | S8 b1 | #4 | SELF (leans on #4) |
| 30 | **bracket arithmetic** / **paths** | S9 b1 | brackets | **UNGROUNDED** (ending keystone) |
| 31 | **three-way** / points vs cents | S10 b1 | #15, #1 | **UNGROUNDED** |
| 32 | **the professional book** = Pinnacle | S10 b1 | #24 | UNGROUNDED (resolved by #24) |
| 33 | **vig** / **de-vig** | S11 b1 | #1 | **UNGROUNDED** (only explained in S17, too late) |
| 34 | **Brier score** | S11 b1 | #1 | **UNGROUNDED** |
| 35 | **horizon** / T-24h / a day out | S11 b1 | #4 | SELF ("a day out and an hour out") |
| 36 | rule out a large **skill gap**, small-n | S11 b1 | stats | INFER |
| 37 | three separate **arms** | S11 b3 | analysis internals | **UNGROUNDED** (jargon leak; rewrite) |
| 38 | **Poisson** read | S12 b2 | — | UNGROUNDED (light anchor) |
| 39 | the **ladder** reprices paths (Golden Boot) | S12 b2 | #30 | UNGROUNDED |
| 40 | **the model** / **Opta** | S13 b3 ("model odds") | — | **UNGROUNDED** (Opta named only in S15) |
| 41 | agreement shares are not probabilities | S13 b1 | — | SELF (kept as on-screen caption) |
| 42 | **prop** / **prop ladder** | S14 b2 | #15 | **UNGROUNDED** |
| 43 | **tick** / one-cent tick floor | S14 b2 | #1 | **UNGROUNDED** |
| 44 | **calibration** / implied vs realized | S14 b1 | #1 | LATE (visual teaches it; word needs anchor) |
| 45 | favorite-longshot "textbook one-sided story" | S14 b4 | — | INFER (described, not named) |
| 46 | **listing** (price life from listing) | S18 b1 | #4 | INFER |

---

## Part 2 — Per-scene rewriter checklist (25 glosses)

Each item: the gloss (drafted, strategist-voice), and WHERE it goes. Insert as a clause or
short sentence at the named beat, positioned before the load-bearing sentence, tied to the
stated animation moment. Keep footnotes on existing numbers; glosses carry none.

### S1 · "Ninety minutes in Arlington" — 3 glosses

- [ ] **G1 · cents = probability (keystone).** The reader meets "priced near forty cents"
  as the first fact of the piece with no idea a contract pays a dollar. Insert as the
  SECOND sentence of b1, right after "the market's favorite for thirteen months," while
  the France winner leg is the y-axis on screen:
  > *"A contract here pays one dollar if its outcome happens and nothing if it does not, so a price of forty cents is simply the market's odds written as money: a roughly forty percent chance."*
  Everything downstream (implied probability, Brier, calibration, the frozen number) rests
  on this one sentence.

- [ ] **G4 · settlement (keystone).** The France pour to the zero line IS settlement, and
  it is the perfect carrier, but the prose never names the mechanism. Insert at the end of
  b1, tied to the pour animation ("the France dots pour to the zero line"):
  > *"When the whistle settles the outcome, the exchange pays a dollar to every winning contract and zero to every losing one, and the contract stops trading for good. That is the pour to the floor on screen."*

- [ ] **G3 · side / taker.** The chip debuts "color: taker side" with no anchor for what a
  side is. Add one clause to b1 (or the grain plate copy) tied to the cyan/vermillion
  debut:
  > *"Every trade has two sides, a buyer of yes and a buyer of no; color marks which side took the offered price."*
  This grounds both the chip and the S6 "taker-yes skew" downstream.

### S2 · "Thirteen months, asleep" — 2 glosses

- [ ] **G6 · book.** "The winner book opened in May 2025" is the first "book" and it never
  gets defined. Insert as the opening clause of b1, tied to the timeline-ribbon lighting up
  at May 2025:
  > *"A book is one market's running ledger of live orders; the winner book is the single market for who lifts the trophy."*
  Pays forward to "futures book" (S3), "the professional book" (S10, S11), and "the winner
  book's legs" (S17).

- [ ] **G7 · contracts vs premium (why the two multipliers differ).** b1 reports peak day
  "3,400 times larger in contracts and roughly 21,000 times larger in premium dollars"
  and the reader cannot see why the two numbers diverge. Insert before that sentence:
  > *"A market can be sized two ways: by contracts, each a one-dollar bet, and by premium, the dollars actually paid at the prices those bets traded. The two move apart when prices themselves climb."*
  Also grounds "notional" in S3 (same idea, face value of the bets).

### S3 · "The flood" — 2 glosses

- [ ] **G10 · the tape (keystone).** "The reconciled tape totals" in b3 is the first "tape"
  and the word is the spine of the whole piece. Insert as the first clause of b3, tied to
  the running dollar counter:
  > *"The tape is the exchange's own trade-by-trade receipt, every transaction it ever cleared; every dot on this screen is one line of it."*

- [ ] **G12 · the press floor is a lower bound.** b3 says the "$7.4 billion" figure "matches
  the tape's own cumulative as of roughly June 30, a floor about a week stale." The reader
  needs why a real reported number is a floor. Insert a short clause, tied to the counter
  ticking past the "$7.4B press floor" marker and continuing:
  > *"The tape only ever adds trades, so any dated total is a floor that a later reading can only raise; the widely cited figure was a true count that stopped a week early."*

### S4 · "The tournament's clock" — clean

No new gloss required. "Heatmap," "kickoff calendar," and "residual" are within a
generalist's reach, and "futures" is already grounded by S2's book gloss. Confirm no
regressions after upstream edits.

### S5 · "Where the dollars sat" — 3 glosses (plus the Trump swap, Part 3)

- [ ] **G15 · leg.** "414 contract legs" in b2 is the first "leg" and legs appear in almost
  every later scene. Insert before the count, tied to the Lorenz sort resolving into
  markets:
  > *"A leg is one outcome-contract inside a larger market: the France-wins bet is one leg of the winner market, and a single match splits into three legs, home win, draw, away win."*
  This one gloss also pre-grounds "three-way legs" (S10), "winner legs" (S9, S13),
  "yes-legs" (S14), and "the winner book's legs" (S17).

- [ ] **G16 · series.** "Three core series" in b2. Insert alongside the leg gloss:
  > *"A series is Kalshi's name for a whole family of related markets, such as every three-way in the tournament."*

- [ ] **G17 · Gini scale.** b2 cites "a Gini of 0.930 ... and the within-family reality is
  ordinary, 0.44" and the numbers are inert without the scale. Insert a half-sentence:
  > *"On the Gini scale, zero means every market holds an equal share and one means a single market holds it all, so 0.930 is near-total concentration and 0.44 is unremarkable."*

### S6 · "Anatomy of the biggest market" — 2 glosses

- [ ] **G20 · retail.** "ordinary Kalshi retail flow" in b1 is the first "retail," and the
  Act III payoff ("dumb retail dissolves") depends on the reader holding it. Insert before
  the phrase, tied to the zoom unpacking into individual trades:
  > *"Retail flow is the order stream of ordinary individual traders rather than institutions, the small bettors who make up almost all of this exchange."*

- [ ] **G22 · print.** "about one print per second" in b1. Insert a two-word anchor at first
  use, tied to the arrival-rate ramp:
  > *"one print, meaning one executed trade, per second"*

### S7 · "The goal, three ways" — 3 glosses

- [ ] **G24 · the venue cast.** Polymarket and Pinnacle appear for the first time in b1 with
  no introduction, and the chip flips to "color: venue." Introduce all three once, tied to
  the three lanes drawing in:
  > *"Three price sources watch the same goal: Kalshi, the United States prediction exchange whose tape this is; Polymarket, an offshore crowd market; and Pinnacle, a professional sportsbook, the house the pros call the book."*
  Grounds "the professional book" in S10 and S11.

- [ ] **G25 · suspend-and-repost + fair level.** b2 says Pinnacle "suspends," "goes dark,"
  and "reopens with a single quote already at the new fair level." Add one clause tied to
  the darkness block:
  > *"A sportsbook suspends by pulling its price the instant play turns dangerous, then reposts once, at the level it now believes is fair, rather than trading every step of the move the way an exchange does."*

- [ ] **G27 · friction band + fade.** b4 lands "the spike is the price ... within the
  roughly two-cent friction band ... no overreaction to fade" and both "friction band" and
  "fade" are untaught. Insert before the payoff, tied to the ±2c band overlay:
  > *"To fade a move is to bet it will snap back. The friction band is the couple of cents of fees and minimum price step inside which no such bet can clear a profit, so a spike that settles inside it was already the right price."*

### S8 · "Which market you watch" — clean (depends on G4)

No new gloss. S8 teaches regulation-versus-advancement in place, and "its own settlement
clock" resolves once G4 lands in S1. Confirm the S1 settlement gloss is in before signing
off S8.

### S9 · "Three shocks, three arithmetics" — 1 gloss

- [ ] **G30 · bracket arithmetic / paths (ending keystone).** b1 introduces "the 72-hour
  paths then diverged with bracket news" and b3 closes on "the tape was doing bracket
  arithmetic on the paths that remained," the exact habit S12 and S16 L3 lean on. Ground it
  before the pops resolve, tied to the three shock paths with their bracket-news
  annotations:
  > *"A team's price is really a price on the route still in front of it: beat this side, then probably that one. When a result changes who a team would meet next, every price along that path moves even though the team itself did nothing. That repricing is the bracket arithmetic."*

### S10 · "One price, two venues" — 1 gloss

- [ ] **G31 · three-way + points reconciliation.** b1 opens on "84 three-way legs" and
  reports gaps "in points" while the reader has only ever seen "cents." One clause, tied to
  the braid assembling and the axis labeled "price (points)":
  > *"A three-way is the match's win, draw, or lose market, its three legs the only three ways ninety minutes can end. A point here is one cent of price, so a five-point gap is five cents, about five percentage points of implied chance."*

### S11 · "The verdict, and the trap" — 3 glosses

- [ ] **G33 · vig / de-vig (keystone; currently explained only in S17, far too late).** b1's
  first words invoke "the de-vigged professional book" and the term recurs in S15, S16 L1,
  S16 L5, and S17. Move the definition to its first use, tied to the three Brier columns
  assembling:
  > *"A sportsbook prices every outcome a little rich, so its odds add up to more than one hundred percent; the surplus is the vig, its margin. De-vigging strips that surplus back out so the book's numbers can be read as clean probabilities and set beside the exchange."*
  S17 keeps its own provenance line, which now reads as a reminder rather than a first
  teaching.

- [ ] **G34 · Brier score.** b1 reports "near-identical Brier scores, 0.158 to 0.169" with no
  scale. Insert before the numbers, tied to the Brier columns:
  > *"A Brier score grades a long run of probability forecasts against what actually happened; zero is a perfect record and lower is always better, so scores this close mean the forecasts were about equally good."*

- [ ] **G37 · "arms" plain-language rewrite (not a gloss, a fix).** b3 says the analysis
  "walked into that trap three separate times, in three separate arms." "Arms" is internal
  workstream jargon the reader has never met. Rewrite:
  > *"This analysis walked into that same trap three separate times, in three different parts of the study, before the tape corrected it."*

### S12 · "The market was not fooled by the scoreline" — 2 glosses

- [ ] **G38 · Poisson.** b2 says Kane's price "is fair under a plain Poisson read of realized
  rates." Anchor it in one clause rather than assume the model:
  > *"Read as a Poisson process, meaning goals arrive at a roughly steady rate, his remaining chances scale with the minutes he has left, and four cents is about right."*

- [ ] **G39 · ladder.** b2's "the ladder reprices paths" is the first "ladder." Anchor it,
  tied to the boot-ladder columns:
  > *"The Golden Boot book is a ladder, one ranked rung of contracts per contender, and it reprices the same way a bracket does, on goals still to come rather than goals already scored."*
  Pre-grounds "prop ladders" (S14) and "trust the pools, not the ladders" (S16 L2).

### S13 · "The flags and the price" — 1 gloss

- [ ] **G40 · the model / Opta.** b3 uses "model-equivalent peers" and "model odds" and b1's
  neighbor concept, while Opta is named only later in S15. Introduce it at first use, tied
  to the model reference line above the peer columns:
  > *"The model here is Opta's supercomputer, which plays the tournament out thousands of times to give each team a simulated chance; two teams are model-equivalent when it rates them about the same."*
  S15's "above Opta" then reads as a callback, not a first meeting.

### S14 · "The one real sin" — 2 glosses

- [ ] **G42 · prop / prop ladder + G43 · tick (combined).** b2's "prop ladders with ten or
  more legs" and "the one-to-two-cent tick floor" both debut here and both feed S16 L2's
  "lottery tax bounded by the one-cent tick." Insert before the attribution, tied to the
  cheap-end sag and the tick-floor bracket:
  > *"A prop is a side bet on something other than the result, such as the first scorer or the exact score, and a prop ladder stacks many of them together. The tick is the smallest legal price step, one cent, and it is the floor these longshots pile up against."*

- [ ] **G44 · calibration (word anchor).** The scene teaches implied-versus-realized visually
  but never hands the reader the word the ending reuses ("nearly calibrated," S16 L2).
  Anchor it once in b1, tied to the curve assembling along the diagonal:
  > *"A price is well calibrated when things it prices at thirty cents happen about thirty percent of the time; that diagonal is the calibrated line, and dots below it were overpriced."*

### S15, S16, S17, S18 · covered by upstream

No new local gloss required once the upstream keystones land:
- [ ] **S15** — "devigged price" (G33), "Opta" (G40), "forty-percent price" (G1) all now
  grounded upstream. Confirm only.
- [ ] **S16** — every lens recaps a grounded concept: "once the vig is stripped" (G33),
  "lottery tax bounded by the one-cent tick" (G42/G43), "bracket arithmetic" (G30),
  "tie-locked price" (S8 + G4), "nearly calibrated" (G44). Confirm only.
- [ ] **S17** — keeps its vig/devig provenance line; now a reinforcement of G33, not a first
  teaching. No change.
- [ ] **S18** — "price life from listing to settlement" resolves on G4 (settlement) plus the
  natural antonym listing. Optional half-clause if desired: *"from listing, when the market
  opens, to settlement."* Low priority.

---

## Part 3 — De-politicize S5 (the Trump swap)

### What is there now

- **Prose, `s05.js` b3 (line ~310):** "The catalog's most famous novelty, **the biggest
  Trump-mention market, drew a real 1.40 million contracts** and still could not crack the
  top 1,000; the honest punchline runs the other way, since the maximum of a **3,005-market
  family** trading at catalog base rate should land **near rank ten**. America's biggest
  off-pitch market was roughly **sixty times smaller than the moneyline on its own
  broadcast**."
- **Overlay, `s05.js` (lines 242-273) + scene JSON `s05.json`:** a `trump_market` object
  (`market_index`, `rank: 1083`, `contracts: 1400000`, `family_size: 3005`,
  `expected_rank_at_base_rate: 10`) drives an amber singleton, a "rank ~1,083 of 30,133"
  callout, and the FIX #6 caption "small, lit up because it's surprising, not because it's
  big."
- **Footnote [^8]** (`docs/index.html`): "Novelty versus sports order statistics:
  mention-market ranks placed against the sports markets (R14)."

The market behind "1.40 million contracts / rank 1,083" is **KXWCMENTION-26JUL06USABEL-TRUM**
("What will the announcers say during USA vs Belgium," the Trump-mention prop), verified in
`pipeline/data/analysis/volume-anatomy/novelty_vs_sports.json`. The task also references
`KXTRUMPWORLDCUP` ("matches Trump attends," a separate 490,971-contract series); both are
politically framed and both must leave the piece.

### Which non-political novelty carries the point — store verification

| Candidate | Series contracts | Markets traded | Biggest single market (rank of 30,133) | Verdict |
|---|---|---|---|---|
| **KXWCADS** (brand advertising) | **594,454** | 35 | Pepsi, 43,330 (rank ~10,500) | **Viable carrier** |
| KXWCFINALSONGS (final/anthem songs) | 534 | 5 | 316 (rank ~25,820) | **Reject: effectively untraded** |

Source: `market_totals.parquet` / `series_totals.parquet`, this snapshot. KXWCFINALSONGS
cannot carry any volume point; at 534 lifetime contracts it sits near the bottom of the
catalog. **KXWCADS is the swap target.** It is the biggest genuinely off-pitch,
non-political novelty family, at 594,454 contracts across 35 ad markets, which is
0.0048% of the $12.3B tape.

**Honest caveat the rewriter must respect.** The current beat's rhetorical scaffold (one
market at 1.40M, a 3,005-market family, order-statistics "near rank ten," "sixty times
smaller than the moneyline on its own broadcast") is specific to the KXWCMENTION family and
does not transfer to KXWCADS. The swap therefore restructures the point from a single
surprisingly-large market to a surprisingly-large family, and **drops the order-statistics
inverted-punchline sentence.** The storyboard already anticipates this: open question 5
flags that "top 1,000" line as soften-able. The narrative point that survives is intact and
is the real one: the loudest off-pitch novelty of the tournament is still a rounding error
next to the football.

### Exact swap — prose (`s05.js` b3)

Replace the beat html with (numbers refreeze at deploy per the recompute ledger):

> *"The loudest market that had nothing to do with football was a bet on advertising: which
> brands would run a spot around the final. Every one of those 35 ad markets put together
> drew about 594,000 contracts, five thousandths of one percent of the tape, and the
> most-traded of them, whether Pepsi would advertise, could not crack the top ten thousand
> markets.[^8] The whole family was more than two hundred times smaller than a single
> knockout-night moneyline.[^8] Loud in imagination, faint in money."*

Number changes, itemized:
- **1.40 million contracts → about 594,000 contracts across 35 markets** (KXWCADS series
  total; task's "~582K" is the prior snapshot, current is 594,454).
- **"could not crack the top 1,000" (rank 1,083) → "could not crack the top ten thousand"**
  (biggest single ad market, Pepsi, rank ~10,500 of 30,133).
- **Add "five thousandths of one percent of the tape"** (594,454 / 12,308,775,212 = 0.0048%).
- **DROP the "3,005-market family ... near rank ten" order-statistics sentence** entirely
  (family-size specific; does not apply to a 35-market family).
- **"sixty times smaller than the moneyline on its own broadcast" → "more than two hundred
  times smaller than a single knockout-night moneyline"** (594,454 vs the tournament's
  biggest market, KXWCADVANCE-26JUL05MEXENG-MEX at 158.7M, a 267x ratio; use "more than two
  hundred times" so the deploy refreeze cannot falsify the copy). The final's own 3-way is
  not in the store yet, so any "moneyline on the final it advertised" phrasing must wait for
  the G3 deploy refresh; the knockout-night comparison is available now and is safer.
- **"moneyline" is glossed by G31 in S10 but S5 precedes S10.** Either keep the S5 phrasing
  as "knockout-night three-way" (already grounded by nothing yet, so gloss inline) or use
  plain "match market." Recommended inline anchor in this same beat: *"a single
  knockout-night match market."* Avoids importing an ungrounded "moneyline" into Act I.

### Exact swap — overlay code + scene JSON

- [ ] **`s05.json`:** rename `trump_market` → `novelty_market`; repoint `market_index` to the
  KXWCADS cluster. Because the point is now family-level, prefer highlighting all 35 KXWCADS
  markets' tail dots rather than one market. Two implementation options:
  - **Preferred:** add `series_ticker: "KXWCADS"` and have the layout highlight
    `pop.series[i] === adsIdx` (a small change to the `trumpIdx` match at `s05.js`
    lines 131-165, which currently matches a single `pop.market[i]`).
    Set `contracts: 594454`, `n_markets: 35`, and drop `family_size` /
    `expected_rank_at_base_rate` (unused after the punchline is cut).
  - **Minimal:** keep the single-market highlight, point `market_index` at
    KXWCADS-26JUL19-PEPS, `rank: 10500`. The lit cluster is then one market; the family
    number lives only in prose.
- [ ] **`s05.js` lines 242-273:** rename the `s05-trump` group and `trump` variable to a
  neutral `novelty`; update the rank callout text (line 261) to read against the new rank;
  the FIX #6 caption at line 266 ("small, lit up because it's surprising, not because it's
  big.") **stays verbatim**, it fits the ads family exactly; the S14-constancy line at 271
  stays (the ads dots still carry the Lorenz-tail tag).
- [ ] **`s05.js` comment block lines 36-40** and **line 242 comment:** update the schema
  example and the "Trump-market singleton" comment to "novelty-market singleton."

### Exact swap — footnote [^8] (`docs/index.html` line 416)

Replace with:
> *"Off-pitch novelty versus the football, by contracts traded: the brand-advertising
> family set against the tournament's match markets (R14, recomputed for KXWCADS at the
> deploy-morning run)."*

- [ ] **Recompute cell:** `novelty_vs_sports.json` is currently Trump-specific. Add a
  build-time recompute that emits the KXWCADS family total, its share of the tape, its
  biggest single market and rank, and the ratio to the biggest match market, so the beat's
  numbers refreeze mechanically at deploy alongside every other dated figure.

### Flagged alternative (author's call, not required)

If the author would rather keep the wry inverted-punchline structure intact, the same
KXWCMENTION family holds large **non-political** "what will the announcers say" props that
preserve the entire verified scaffold (3,005-market family, own-broadcast moneyline,
order-statistics near rank ten) with only the exemplar changed:
- KXWCMENTION-26JUN19TURPAR-**LEVI**, 822,171 contracts (rank ~1,647), Turkiye-Paraguay.
- KXWCMENTION-26JUL05MEXENG-**PENA** (a "penalty" mention), 669,030 contracts (rank ~1,969),
  Mexico-England.

Swapping the exemplar to a "penalty" mention keeps R14 almost verbatim and needs only the
one market and its broadcast changed. This is the minimal-disturbance path. The plan
recommends KXWCADS anyway, because a clean non-political novelty *series* reads as more
plainly de-politicized than another broadcast-mention prop, and because it removes the
dense order-statistics sentence the storyboard already wanted softened.

---

## Part 4 — Summary

- **Scenes with gaps (need a local insertion): 12** — S1, S2, S3, S5, S6, S7, S9, S10, S11,
  S12, S13, S14. (S4 clean; S8, S15, S16, S17, S18 resolved by upstream keystones.)
- **Total glosses: 25**, weighted toward six keystones that unlock everything downstream:
  G1 (cents = probability), G4 (settlement), G10 (the tape), G33 (vig / de-vig, moved from
  S17 to S11), G34 (Brier), G30 (bracket arithmetic).
- **Trump swap:** remove KXWCMENTION-26JUL06USABEL-TRUM (and any KXTRUMPWORLDCUP framing)
  from S5 prose and the `s05.js` overlay; swap to **KXWCADS** (594,454 contracts, 35 ad
  markets); drop the order-statistics sentence; recompute the ratio line against the
  knockout-night match market; refreeze all figures at deploy.
