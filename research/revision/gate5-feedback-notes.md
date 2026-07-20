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

### Item 9 — S8 Germany-Paraguay: whistle line, wall-clock axis, rules verification (SETTLED)

Author's questions: why does the regulation price slide AFTER the 90' line;
why does the advance price keep moving well past 120'; why would anyone
think the market gave up on Germany; verify the settlement rules are real.

Facts established: (a) the white line marks NAIVE minute-90, not the actual
regulation whistle — with stoppage on a wall-clock axis the true whistle
lands ~axis-111' exactly where the slate path dies; the slide is pre-whistle
time-decay (level score + draining clock -> win-in-90 chance mechanically
-> 0), ending at true settlement; (b) the axis counts wall minutes incl.
halftime, breaks, ET, and the ~15-min shootout — the decline past "120'"
IS extra time wearing on + the shootout kick by kick (Paraguay's winner at
23:29:42Z kills the ticket); the 93c ET spike (22:44Z) is real and unnamed;
(c) RULES VERIFIED against Kalshi's official contract text via API:
"...after 90 minutes plus stoppage time (does not include extra time or
penalties)"; a tie resolves the Tie leg yes. Settlements agree (GER Winner
no, GER Advance no; the final repeated the pattern). Cite rules text in the
footnote.

Agreed dispositions (batch 3):
1. PROSE: keep the confused observer but ground them ("someone who had not
   read the ticket's rules"); ADD the decay teach ("The slide is the
   ticket's own clock running out: the score is level, the minutes are
   draining, and a draw pays no. Every passing minute takes a few cents
   with it, by rule.").
2. VISUAL: move the white line to the ACTUAL regulation end from the tape,
   labeled "final whistle of regulation (with stoppage)"; shaded labeled
   period bands (2nd half / stoppage / break / extra time / shootout);
   annotate the shootout kicks from shootout_ticks parquet ending "Paraguay
   converts, the ticket dies"; investigate and name the 93c ET spike.
3. Footnote: quote the official rules text so readers can verify.

### Item 10 — S9 bracket-math: double normalization + invisible mirror (SETTLED)

Author's questions: what is bracket math; why does pink merge with blue;
the Norway-Argentina "exact minutes" claim is not visible in the chart.

Facts established: the chart overlays THREE different days on one
normalized clock (each line's t=0 = its own shock; each y = multiples of
its own pre-shock price) without teaching either normalization — the
"merge" is three strangers sharing a fake timeline; annotations from
different days float unanchored. The minute-scale Norway/Argentina mirror
(Norway to 10.8c while Egypt led, ~hour 43) is real in the tape but
amplitude-crushed on a x5-scaled axis — the claim's evidence is invisible.
"Bracket" is US jargon.

Agreed dispositions (batch 3):
1. SMALL MULTIPLES: three mini panels, one per shock, each on its own real
   date with its own annotations; above the first, a tiny ROAD diagram
   (Paraguay's remaining path with Germany crossed out) so "the road got
   easier" is shown; "bracket math" glossed/renamed in plain words ("path
   math: a ticket prices the whole road ahead").
2. MIRROR INSET: magnified panel over ~hours 40-46 with its own y-scale
   (Norway's leg ticking up while Argentina's crashes; "Egypt leads
   Argentina" window shaded; both lines labeled); main chart keeps a marker
   showing where the inset lives.

### Item 11 — S10 gap chart: spike clipping + difference-vs-price (SETTLED)

Author's observations: bold and thin white lines, thin ones "artificially
cut off"; text unclear whether the chart plots the price difference or the
price itself.

Facts established: bold line = minute-mean absolute gap (<1 point — the
story); thin verticals = 59 goal-minute spikes (mean 39, max 83.5 points)
which are RECORDING ECHOES (the venues' once-a-minute records straddle a
goal jump differently — a paper gap closed in seconds, not a tradable
disagreement); the y-axis is clamped at 20 so spike tops are silently
clipped — the same hardcoded-axis defect class as S6's flatline. Prose
never states the line is a difference; "one cent of price" invites the
misreading.

Agreed dispositions (batch 3):
1. Spikes styled as artifacts (dimmer/dashed) + one annotation naming the
   echo mechanic and disclosing "spikes continue to 84 points"; the y-cap
   disclosed on the axis; beat gains two sentences teaching the echo.
2. Difference-not-price sentence up front ("The line on this chart is not a
   price. It is the distance between the two markets' prices for the same
   ticket."); "one cent of price" -> "one cent of distance."

### Item 12 — Pinnacle terminations beat: metaphor + missing payoff (SETTLED)

Author's questions: what does this imply and why should a reader care; why
"the professionals had left the room"?

Facts: the 16 grey lines = Pinnacle's in-play book closing near the end of
regulation BY POLICY (house rules; feed ends, no fresh quote follows). The
implication the beat never stated: those moments are exactly where naive
analysis sees "crowd vs pros in disagreement" — a live price vs a frozen
one; our own first sweep made this mistake (the killed 14-2 finding).

Agreed dispositions (batch 3):
1. Replace the metaphor with plain mechanics + policy tie: "All sixteen
   have one cause: Pinnacle stopped posting prices. Its in-game book closes
   as the ninety minutes run out, by its own house rules, the same rules
   from the goal scene. The feed ends; no fresh quote ever follows."
2. Add payoff + self-confession: "Why this matters: a gap against a book
   that stopped quoting is not a disagreement. It is an empty chair. Our
   own first analysis fell for it: it counted sixteen wins for the crowd
   over the pros before we checked whether the pros were still in the
   game." (Wording to pass strategist-voice + FK<=9 checks at application.)

### Item 13 — S11 scoring beats: unbuilt Brier + left-the-room metaphor (SETTLED)

Author's questions: what is 0.162, where does it come from, which
contracts; what does "grading someone after they have left the room" mean?

Facts: 0.162/0.164 are Brier scores over the 84 matched knockout three-way
tickets (28 matches x 3), Kalshi vs devigged Pinnacle, prices graded a day
out and an hour out; the beat never builds the score or gives its anchors
(0 = perfect, 0.25 = always fifty-fifty). The fairness argument: Pinnacle's
book freezes at 90:00; five matches were decided by added-time goals after
that freeze; scoring the frozen price against the final result marks the
book wrong on minutes it never priced; those five matches = 74% of its
error. Same mechanism as item 12's empty chair; the piece never connects
them.

Agreed dispositions (batch 3):
1. Brier taught: recipe in plain sentences (price as claimed chances; truth
   1 or 0; miss squared, averaged) + anchors (0 perfect, 0.25 shrugging
   fifty-fifty) + the material named (84 tickets, 28 matches, day-out and
   hour-out grading moments).
2. Fairness in plain mechanics + one named example match + explicit
   empty-chair cross-reference ("check that a price was still alive before
   you grade it"); metaphor dropped.

### Item 14 — S13 host-bias beat: implicit experiment (SETTLED)

Author's question: is this saying home-country enthusiasm nudged people to
buy home-team contracts vs model-equal teams? (Answer: yes, exactly — the
beat failed to say it.)

Agreed disposition (batch 3): experiment-shaped rewrite — name the control
teams (Ecuador, Croatia at the same model odds); result 1: hosts' tickets
drew 2-2.5x the peers' money pre-tournament; result 2: kickoff-eve prices
at 2x (Mexico) / 1.4x (USA) of tiny model chances = a cent or two, not ten;
implication stated plainly (enthusiasm moved money, barely moved price; the
market absorbed the fan money — feeds the money-vs-polls verdict); who-
bought humility (the tape sees trades, not passports — host attention is an
inference, stated as one).

### Item 15 — zombie-money beat: dramatized non-event (SETTLED)

Author's challenge: "when a team lost, the contract settles to 0 — what
does 'loyal money did not linger' mean?" and, on the proposed fix, "why
would anyone buy a ticket on a team that lost?" — both correct. Facts: the
elimination-to-settlement window exists, but the trades in it are
BOOKKEEPING (NO-side holders buying the dead YES at a penny to close and
free collateral early; stale orders swept), not sentiment; the finding is
near-obvious once mechanics are clear, so the revelation framing is
unearned.

Agreed disposition (batch 3): SHRINK TO A RECEIPTS LINE folded into the
host-bias beat's close: "And when teams actually died, their tickets died
clean: across all 28 knocked-out teams, the wind-down was 277 housekeeping
trades worth about $2,190, closed-out positions and leftover orders,
nothing more. Tonight the flags will be Argentina's and loud. The price
will not care. It never did." Standalone beat framing removed; scene beat
structure adjusts accordingly (registry/beat count in s13).

### Item 16 — S14 penny-ticket beat: missing mechanism + why-weight-by-dollars (SETTLED)

Author's questions: is it saying the uncalibrated low bets are all prop
ladders acting as a single market? (close but no — the claim is WHERE the
sin lives and WHY); why weight by dollars, and does the flattening mean the
uncalibrated bets carry little money? (yes, exactly).

Agreed dispositions (batch 3):
1. MECHANISM-CHAIN rewrite: every outcome listed -> most rungs barely trade
   -> the one-cent floor forces trades above true worth (a 1-in-500 ticket
   cannot trade at its honest fifth of a cent) -> correcting it costs more
   in fees than it earns -> lottery money buys anyway -> the sin
   concentrates in thin ladder rungs at the floor (72% in 10+ rung ladders,
   55% at the 1-2c floor). Explicit callback: "this is what Skill 2
   promised you would see."
2. TWO-COUNTINGS close: count every market equally vs weigh by dollars
   traded (sag -> ~half a point); "same chart, two questions: how wrong was
   the average market, and how wrong was the average dollar; the dollar
   answer governs a deep price like tonight's." Thin-tail callback stays.
3. TOY EXAMPLE included (author-confirmed after mechanics question): the 3c
   bucket walked both ways — 1,000 thin ladder rungs ($10 each, ~1% true)
   vs 10 deep tickets ($10,000 each, ~3% true, fairly priced); per-ticket
   average sags to ~1%, per-dollar average lands ~2.8% vs 3c claimed. Land
   the resolving sentence: "weighting changes whose results dominate the
   average, not what any ticket did." Also note: the countings only
   disagree at the cheap end (no penniless crowd exists at 30c — mid-price
   buckets agree under both countings).
4. GROUND "PROP" AND "LADDER RUNG" CONCRETELY (author request): before the
   mechanism chain, one worked real example — the exact-score ladder: "Take
   one match. Spain 1-0 is a ticket. Spain 2-0 is another. Spain 2-1,
   another. Line up every possible final score and you have a ladder; each
   ticket is one rung. The exact-score family alone listed roughly 2,700
   tickets across the tournament." (Verify the count against the catalog at
   application; KXWCSCORE ~2,691 legs.) 'Prop' defined as any side bet
   beyond who wins, with this ladder as its concrete instance.

### Item 17 — S14 favorites twist: mirror explanation fails data check (SETTLED)

Author asked what the beat means. Data verified: the 90-95c bucket is real
and the worst (242 markets, 92.4c claimed, 69.4% realized, -23pp). BUT the
beat's mirror-seller mechanism is contradicted by the data: penny-ticket
complements live in the 95-100c bucket, which is nearly perfectly
calibrated (-0.09pp). Likelier: the tournament's upsets (Germany, Brazil,
France) landed on the priciest shelf; n=242 cannot separate structural bias
from one upset-heavy summer.

Agreed disposition (batch 3): VERIFY THEN WRITE HONESTLY — inspect the 242
markets at market level; if upset-concentrated, reframe ("the worst-priced
shelf was the 90-95 cent favorites, and the tournament's upsets landed
exactly there; whether lasting bias or one summer, 242 markets cannot
say"); drop the unsupported mirror unless market-level evidence supports
it, in which case show the evidence. Also: item 16 rewrite carries the
two-part tick-floor answer (floor makes honest price unquotable; collateral
lockup + fees make even the legal correction pointless).

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
