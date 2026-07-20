# Gate 5 — Author feedback session (2026-07-20)

Protocol: the author provides feedback items one at a time on the shipped v2
piece. Each item is cross-questioned (grilling discipline: one question at a
time, recommended answers offered) until shared understanding is reached and
recorded here. NO changes are applied until every item is discussed and the
author approves the full list.

Piece under review: https://lyndonkl.github.io/fifaworldcup2026/ @ 8d8d003.

---

## Items

### Item 1 — S3 "tape / press number" beat: missing context (SETTLED)

Author's observation: "tape" reads as introduced-for-the-first-time here and
unclear; the $7.4B "press number" is unexplained (origin? monetary volume or
contract count?); general theme: the beat lacks the context to understand its
own terms.

Facts established: (a) "tape" is actually FIRST used untaught in S1 — S3
defines it two scenes late; (b) every Kalshi binary contract carries a fixed
$1 notional (yes side posts the price, no side the remainder), so the totals
are simultaneously contract counts AND dollars — exactly, not approximately;
(c) the $7.4B press figure originated as Kalshi's own announcement (~tape
cumulative as of Jun 30), re-reported ~Jul 8 — the press was not measuring.

Agreed dispositions (apply later, all four):
1. **Teach "tape" at S1 first contact** — one clause with the ticker-tape
   etymology ("the exchange's trade-by-trade record, named for the paper
   ticker tape that once printed every trade"); S3's definition becomes a
   light reminder. Word stays piece-wide.
2. **Teach the $1-box in S3** — "Each contract is a one-dollar box: the yes
   side puts in its price, the no side puts in the rest. Count the filled
   boxes and you have counted the dollars: $12.3 billion means 12.3 billion
   boxes." Press number restated in the same measure.
3. **Reframe the press number honestly** — attribute origin (the exchange's
   own announcement, ~a week old when printed); replace the "market knew its
   own size before the press did" flourish with the floor-not-ceiling logic.
4. FK<=9 discipline and footnote stability maintained on all touched prose.

### Item 2 — S4 clock-grid scene: visual decoding + beat-2 logic (SETTLED)

Author's observations: (a) unclear what the graph shows — read "green =
American waking hours" (actually teal = match windows; the amber bracket
annexed the teal columns visually); the top bar chart (scheduled kickoffs)
is absent from the key; (b) "not that anyone knows the result early" is an
unprompted strawman; (c) "price will be wide awake" metaphor undecodable;
(d) challenge: isn't the US-hours tilt expected on a US-only app?; (e) probe:
what does "what the schedule predicts" mean — regression?

Facts established: the "schedule prediction" is a NULL MODEL BY COUNTING, not
a regression — each scheduled match gets a reproducible ~3.5h window (from
93/102 fixtures' kickoff times); each clock-hour gets credit proportional to
window-time inside it; observed volume tracks that credit except the US
waking band (8am-11pm ET) carries ~2x its credit. Honest-limits caveat: no
independent attention benchmark (Trends blocked), so the residual is a clean
arithmetic fact with a plausible attention reading, not proven cause. The
dossier's corrected R11 already concedes directional expectedness.

Agreed dispositions (apply later, all five):
1. **Draw the comparison**: beat 2 gets two small labeled curves (money/hour
   vs schedule-credit/hour), gap shaded across the waking band, amber bracket
   anchored to the drawn evidence; grid dims beneath; key gains a "grey bars
   = scheduled kickoffs per hour" row; fix colliding axis titles.
2. **Null-model disclosure**: one plain counting sentence in the beat; the
   drawn credit line labeled as such; footnote 6 expanded with the exact
   method + the no-independent-attention-benchmark caveat.
3. **Strawman removed, positive restatement**: "...volume tells you how many
   are watching; the price tells you what they believe."
4. **Metaphor to plain words**: "the crowd will already be here — the price
   will move within seconds of the whistle, not overnight."
5. **Concede-then-quantify framing**: open with "an American exchange trades
   on American time — no surprise"; the payoff is the measured ~2x and the
   clock-reading skill (3 AM move = thin crowd; primetime move = deepest).

### Item 3 — S5 Lorenz beat: unnamed families + key-panel clip (SETTLED)

Author's observations: (a) "three big families of markets, 414 legs" never
says WHICH three; (b) screenshot: the amber annotation "414 legs across 3
core series abs—" runs under the KEY panel and is clipped mid-word.

Facts established: the three core series by dollars are KXWCGAME (match-
winner three-ways, 312 legs, ~33%), KXWCADVANCE (who-advances, 62 legs,
~18%), KXMENWORLDCUP (the tournament-winner book, 48 legs, ~11%). The
shipped 414/63.5% is the stamped deploy-morning freeze (current tape reads
422/62.1% after the final's late-listed legs); figures stay as frozen per
the piece's stated discipline. The clip is a survivor of the known P4
text-collision class (same as the epilogue's fixed keySafeX defect).

Agreed dispositions (apply later):
1. **Name the three families in the beat, plain words**: "the match-winner
   markets, one set per game; the who-advances markets; and the tournament-
   winner book you have been watching since the start." Numbers unchanged.
2. **Piece-wide text-collision sweep** at application time: check every
   scene's captured frames for text intersecting the KEY panel, grain plate,
   viewport edges, or other text; apply the exclusion-rect treatment to every
   hit; re-capture as proof. (S5's clipped annotation is instance one; the
   half-cut Gini caption at S5's bottom edge should be checked in the same
   sweep.)

### Item 4 — Skill-2 close card + rank annotation (SETTLED)

Author's observations: (a) "Skill unlocked... depth decides which prices to
trust" — unclear what it's saying; (b) "the money skipped the silly bets" —
is the piece saying not to trust ad/tiny markets? (answer: yes, exactly, and
Skill 5 proves it — the card failed to say so plainly); (c) the graphic's
"rank 7,130 of 30,133" never defines what rank orders.

Facts established: rank = position among all markets by total money traded
(1 = biggest). CRITICAL DISCOVERY the question exposed: the epilogue-day
refreeze desynced S5's data from its prose — deployed s05.json reads 1.53M
ad-family contracts / rank 7,130 / in_below_grain false (the ad markets
SETTLED at the final and nearly tripled), while the hardcoded beat prose
still says 594,000 / "could not crack the top ten thousand" / too-small-for-
a-dot. The live screen contradicts itself. Known sibling: s17's hardcoded
"58.8" (build-time flag).

Agreed dispositions (apply later):
1. **Rewrite the Skill-2 close card operationally** ("Volume measures
   attention, not knowledge. Before trusting a price, check the money behind
   it: deep markets earn trust; near-empty ones do not — Skill 5 shows how
   they go wrong."); receipt line drops the press flourish per item 1's
   reframe. **Audit all five act-close cards** for the same compression.
2. **Re-sync S5 prose to deployed reality** (1.53M contracts; the settled-at-
   the-final surge told as a story-consistent detail; below-grain claims
   corrected) and define rank on screen: "ranked 7,130th of 30,133 markets
   by money traded."
3. **Piece-wide refreeze-consistency audit**: every hardcoded figure in every
   beat checked against its deployed scene-JSON/manifest value; a checker
   script added so future refreezes catch drift automatically.

### Item 5 — S6 Mexico-England zoom: clipped rate curve + wrong numbers + motive line (SETTLED)

Author's observations: (a) the prose says "once a second before kickoff,
5.4x at the whistle" but the drawn curve peaks and flatlines WAY before the
kickoff line; (b) a constant 6 trades/second flatline looks impossible;
(c) the "Mexico fan betting with hope vs protecting against heartbreak"
sentence: how would the tape know they're Mexican fans, and how is buying
insurance possible "if most contracts said yes"?

Facts established: the author is right on all three. (a/b) The y-axis is
hardcoded [0,6] "headroom above the ~5.4x step" — but THIS market's true
rates are 26.4/s in the pre-kick hour, 55.7/s in the first in-game hour
(step = 2.1x), peak minute 182/s; everything above 6 clamps to the ceiling,
manufacturing the fake flatline and hiding the kickoff step entirely. The
1/s -> 5.4x constants are the tournament-generic R16 figures wrongly applied
to the tournament's biggest market. (c) The sentence's intent was motive-
unknowability, but it names a nationality the tape cannot know and relies on
an untaught insurance mechanic (buying NO on your own team).

Agreed dispositions (apply later):
1. **This market's own story, honest axis**: redraw the rate curve on a
   scale fitting the data (26 -> 56 -> 182/s visible; labeled); kickoff step
   annotated where it happens ("the whistle doubles an already-flooding
   tape"); beat rewritten with MEXENG's own numbers; generic 1/s -> 5.4x
   figures returned to the cross-tournament microstructure scene; fix
   s06.json constants to this market's values.
2. **Motive line: teach insurance, drop the nationality**: "One buyer may be
   backing the team they love. Another may be buying the other side as
   insurance: if their team loses, the payout softens the blow. The tape
   prints both trades the same way. What moved is certain. Why it moved is
   not."

### Item 6 — Data-provenance audit of every visual (SETTLED)

Author's question: why was 5.4x a static hardcoded visual? Answer given: two
distinct sins — (1) a hardcoded axis domain [0,6] in scene JS overriding
real data (the curve itself was genuine); (2) "class B" analysis-cited
constants (tournament-wide 1/s and 5.4x) passed through as static values
where a "class A" live per-market recompute was required. Both conventions
exist by name in the build system, so every class-B usage is a candidate
for the same scope error and every hardcoded axis/threshold for the clamp
error.

Agreed disposition (runs AFTER W14 completes, on the final state):
**Full data-provenance audit, visuals + constants + recompute scope**: for
all 19 scenes, enumerate every quantitative input to the visual (axis
domains, thresholds, drawn geometry inputs, annotation values, scene-JSON
constants); classify store-computed / analysis-cited / hardcoded-in-JS;
convert hardcoded visual parameters to data-derived; RECOMPUTE every
analysis-cited constant from the raw parquet store to verify value AND
scope; fix mismatches; report a provenance ledger per scene. Prose literals
are covered by the figure-sync checker (item 4).

### Item 7 — S7 "goal three ways": house rules, danger, the ranking, worth, the stopwatch (SETTLED)

Author's confusions: (a) "three price sources / difference comes from
policy" opaque; (b) "suspends when a play turns dangerous" — dangerous to
whom, why care; (c) "a famous ranking" — what ranking, why care, what is it
even claiming; (d) how does anyone know what a goal is "worth"; (e) where
does Kalshi's 29 seconds come from if the market is live every second?

Facts established: "policy" = each venue's house rules (continuous exchange
vs suspend-and-repost book vs once-a-minute feed). "Dangerous" = bookmaker
jargon: danger to the BOOK'S posted price (stale-odds pick-off), which is
why its number vanishes exactly when things happen. The "famous ranking" is
not famous — it is OUR OWN measured trio (29/60/119s) rhetorically dressed
as an external claim. "Worth" = how much the chance of the final result
changed (Skill 1), computed by the book via history-fed in-play models,
found by the exchange via the crowd's auction (and b4 shows the auction's
answer held). The 29s stopwatch: starts on the TAPE'S OWN clock at the
detection minute, measures first-tick-crossing-20%-of-the-move; distance
from the stadium moment is unknowable (broadcast delay differs per viewer),
which is the deepest reason cross-venue speed ranking is banned (R23).

Agreed dispositions (batch 2):
1. b1 opener: house-rules plain rewrite ("Three different places kept a live
   price on this match... The difference is each place's own house rules...
   not which crowd is smarter.").
2. b2: teach whose danger + why-care ("Dangerous to the bookmaker, not to
   anyone on the pitch... quick customers would snap up the old price...
   why the bookmaker's price disappears at exactly the moments you would
   most want to read it.").
3. b2/b3: teach goal-worth briefly in-beat (Skill-1 tie: worth = change in
   chance, late goal > early goal; book computes with models; exchange
   auctions until the price stops moving and that level IS the answer).
4. b3: own the numbers (drop "famous"), keep the three-measuring-sticks
   lesson, end on the reading skill (the exchange is the only number that
   never stops talking). The 29s passage uses this author-approved final
   wording (teaching the foundational mechanic FIRST): "A price never moves
   on its own. It moves when someone trades, and no one can trade on a goal
   they have not seen yet. Every screen shows the goal late, so the first
   new deals landed about twenty-nine seconds after the move began on
   Kalshi's own record. The machinery was never the slow part. The screens
   and the humans were."

### Item 8 — the fading beat (SETTLED)

Author's questions: do people fade moves in football? Is there evidence
anyone TRIED here? Why is the beat useful? Facts: "fade the move" is real,
common trading folklore (mean-reversion instinct), attributable as such; we
measured OUTCOMES (fading would not have paid: post-goal levels held within
~2c, under fees) but never ATTEMPTS; the tape can measure attempts via
taker sides (share of post-goal volume betting against the jump). The beat
as written debunks a belief the reader was never given (the "famous
ranking" disease again).

Agreed disposition (batch 2): reframe from debunk to the reader's own
question ("Can you trust a number that just jumped? Traders have an old
instinct that says no..."), attribute the folklore honestly, AND compute
the new attempts analysis (post-goal contrarian flow share) so the beat can
say whether people actually tried, not just that trying would not have
paid. Ending's fair-jump lens stays consistent with the reframe.

## FIGURE POLICY (author-confirmed after batch 1)

Prose follows DEPLOYED (post-final) data everywhere, except S17's
ceremonially frozen exam number (58.8/42.0 + devig), which stays frozen by
on-screen promise. check_figure_sync.py must pass at every commit. The
waking-hours beat rewords to the honest ~1.2x with its framing weakened
accordingly (modest but real; the clock-reading skill stands).

## STANDING CONSTRAINT FOR ALL BATCH-2 WORDING (author directive, re-affirmed)

Every rewritten or new sentence MUST: (1) pass through the strategist-voice
skill — read the skill file at /Users/kushaldsouza/.claude/skills/strategist-voice/
(and the project copy under /Users/kushaldsouza/Documents/Projects/claude/skills/
if present) BEFORE drafting; no em dashes, no negation cascades, topic-forward,
footnoted specifics; (2) target an eighth-grade reader and PROVE it by running
pipeline/export/check_readability.py after edits — every touched beat at or
under FK grade 9, no exceptions; (3) run the slop-detector signatures.
