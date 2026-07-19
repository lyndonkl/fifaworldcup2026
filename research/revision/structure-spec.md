# Structure spec — the revision's single source of truth

*Structure council synthesis · 2026-07-19 (deploy day) · consumed by the prose-rewrite pass.*
*Grounding: `research/findings-dossier.md` (corrected claims ONLY), `research/storyboard.md`,
`research/design-system.md` (§9 per-scene notes, FIX #3), `research/revision/perception-brief.md`,
built prose in `docs/js/scenes/s01.js`–`s18.js`, registry in `docs/js/main.js`,
title screen in `docs/index.html`.*

---

## 0. The verdict

Three candidate structures were judged against four tests: (a) can an eighth-grade
reader follow it start to end; (b) does every kept scene visibly serve the central
question; (c) does the reader finish able to read tonight's number themselves;
(d) implementable today (reorder / reframe / rewrite only).

| Candidate | Follow | Serve | Capability | Implement | Call |
|---|---|---|---|---|---|
| 1 · Five Tools ("what it knew that nothing else could") | 8 | 9 | 8 | 10 (zero reorder) | Runner-up. Theme-faithful; "tools" phrased as properties, not actions |
| 2 · Five Skills, One Exam ("learn to judge it yourself") | 9 | 9 | 10 | 8 (one reorder) | **Winner.** Capability is the organizing principle; plainest prose model |
| 3 · The Trial ("dumb, jumpy, playing favorites?") | 7 | 8 | 8 | 10 (zero reorder) | Vivid, but presumes a reader who arrives holding accusations; ours has never heard of Kalshi |

**Winner: Candidate 2 — the course. Five skills, one exam, one lab.** With three grafts:

1. **Zero reorder (from Candidates 1/3).** Candidate 2's one physical move (s13
   between s11 and s12) is rejected for today: registry surgery plus transition
   re-QA on deploy morning buys a marginal thematic gain that a grouping change
   achieves for free. Instead, s12 and s13 fold into the final skill act as its
   two "fake flaws" before s14's real one — Candidate 3's Act IV logic, which the
   built order already runs. The s13 move is logged as a v2 option only.
2. **"The call that panned out" receipts (from Candidate 1).** The author's named
   theme — the unique things the market tells you, and how those calls panned
   out — lives as a one-line receipt at each act close, paired with the
   skill-unlocked line. Prose only, no machinery.
3. **Plain-teaching lines and scrim discipline (from Candidate 3).** Its
   ticket/price glosses, the s08 hourglass image, and the rule that any amber
   act-close card sits on a scrim, never inline with off-white prose
   (perception brief §9a: amber vs `ink.hi` is 1.29:1).

---

## 1. Central question

**Tonight the market says Spain 59, Argentina 42. Can you learn, from thirteen
months of real trades, to read that number for yourself — what it knows that no
pundit, poll, or expert can tell you, where it goes wrong, and whether to trust
it tonight?**

Everything in the piece is a lesson toward that reading. Any sentence that does
not teach a skill, prove a skill worked, or apply a skill to tonight's number is
cut in the prose pass.

---

## 2. The through-line, stated for the reader

One course, five skills, one exam, one lab. Every act teaches exactly one skill
for reading a prediction market, taught on the tournament's real drama. Every
act closes with two one-line cards (prose only, on a scrim if amber is used):

- **Skill unlocked:** what the reader can now do.
- **The receipt:** the call this skill let the market make that nothing else
  could, and how it panned out. (The author's theme candidate, made visible.)

The spine is carried on screen by scene kickers — "Skill 1 of 5", "Skill 2 of
5", etc. — so the reader always knows where they are. S17 is the exam: it spends
all five skills by name on the frozen number. S18 is the lab: check anything,
including your own read, against the raw tape.

## 3. Act map

| Act | Name | Scenes | Skill taught | Receipt (the call that panned out) |
|---|---|---|---|---|
| Skill 1 | A price is a chance written as money | S1, S2 | Read any price as a chance out of 100; a price only counts when a crowd of real money is behind it | The market put a live price on France for 13 months and settled it to zero the second the belief died |
| Skill 2 | Volume is attention, not knowledge | S3, S4, S5, S6 | Tell attention from knowledge; depth decides which prices to trust | The tape knew its own size ($12.3B) a week before the press did; the money skipped the joke markets |
| Skill 3 | How to watch a match through its prices | S7, S8, S9 | Jumps are news, slides can be rules, every price watches the road ahead | Every clean goal spike held (nothing to fade); every famous "panic" was fine print or bracket math |
| Skill 4 | No one sharper is behind the number | S10, S11 | Take the number at face value once the fee is stripped; a gap between venues means one stopped quoting | Two rival crowds held one price all knockout stage; the pros graded dead even wherever both were alive |
| Skill 5 | Its fake flaws, and its real ones | S12, S13, S14, S15 | Check the rules and the road before crying bias; know the two real weak spots (penny ladders, held opinions) | The scoreline gotcha and the flag gotcha both dissolved; one small sin survived, plus one open opinion — about Spain, tonight |
| The exam | How to read the number | S16, S17 | All five skills, applied to the frozen Spain 58.8 / Argentina 42.0 | The reader's own read, staked; the epilogue grades it |
| The lab | Check it yourself | S18 | Verify any claim, or your own read, against the raw tape | — |

Numbering note: the acts teach in scene order (Skills 1–5 above). S16's five
built anchor cards run in their own built order (braid, curve, mirror, pair,
strip). Do not renumber either to force a match. In S16 the cards are named,
not numbered, and one narrated line resolves it: "here are your five skills
again, in the order you will need them tonight." (S16 lockup text lives in the
`LOCKUPS` array in `s16.js`; retitle only.)

---

## 4. The new opening

Lands in `docs/index.html` `#title-screen` (pre-title + deck), replacing the
current census-only pre-title framing. Three sentences, target register:

1. Tonight in New Jersey, Spain plays Argentina for the World Cup, and a market
   where people trade real money says Spain's chance is about 59 in 100.
2. By the end of this page you will be able to judge that number for yourself,
   even if you have never placed a bet in your life.
3. Every dot below is $75,000 that actually changed hands on this World Cup,
   twelve billion dollars across thirteen months, and it is going to teach you
   how, one skill at a time.

The grain sentence (3) keeps the census figures in their existing `data-slot`
spans so the deploy-morning refreeze still lands. **Author decision flag:** the
opening names "about 59 in 100" so the through-line is legible from sentence
one; the exact frozen 58.8 / 42.0 with devig line still lands only at S17. If
the author prefers full withholding, swap the clause to "has already put a
price on it — a price you will learn to read." The structure survives either way.

Suggested subtitle under the title: *Learn to read the market before tonight's
final.* Title itself remains the author's call (storyboard §1 candidates).

---

## 5. Scene-by-scene disposition

All 18 scenes keep. All changes are titles, kickers, beat html, chips, caption
and annotation text, and the S16 lockup strings. No layout, tile, engine, or
registry change anywhere. "Beat guidance" below is argument order for the prose
pass — sentence-by-sentence intent, NOT final prose. Standing register rules
for every beat are in §7.

---

### S1 · keep title "Ninety minutes in Arlington" · kicker "Skill 1 of 5 — what a price means"

**Job.** Teach Skill 1's first half — a price is a chance written as money — on
the night Spain earned tonight's final, and make the reader care by watching a
belief die in real trades.

**Beat 1 guidance (rewrite of the built beat; visuals unchanged).**
1. For more than a year, a France ticket in this market cost about 40 cents.
2. The deal: the ticket pays $1 if France wins the World Cup, nothing if not.
3. So 40 cents means the crowd put France's chance at about 40 in 100. (Teach
   "ticket" first; then name it: "the official word is contract.")
4. On July 14, Spain beat France in ninety minutes, and the ticket fell to zero.
5. Down here, one dot is one real trade from that night. One color is people
   buying yes, France wins; the other is people buying no.
6. At the whistle the exchange pays every winning ticket $1 and every losing
   ticket nothing, and the market closes for good — that is the pour to the
   floor on screen. ("Settles" may be named here in apposition.)
7. Close on the promise + handoff: this was the night Spain booked tonight's
   final; before you judge tonight's price, you should meet the thing that set
   it. The two amber annotations get plain labels ("the goal", "the payout").

**Chip.** Plain rewrite: "blue: buying yes · orange: buying no" (keep color
words matching the tokens actually used; current chip says cyan/vermillion —
prefer everyday color names).

---

### S2 · keep title "Thirteen months, asleep" · kicker "Skill 1, continued — a price needs a crowd"

**Job.** Finish Skill 1: a price only means something when real money stands
behind it, and this market is a crowd that shows up when something is at stake.

**Beat 1 guidance.**
1. This who-wins-it-all market opened in May 2025 and mostly slept for a year.
   (Drop the "book is a running ledger of live orders" teach-in — "book" is not
   needed this early; say "market" and teach "the book" later only if used.)
2. Even the draw, the day teams learned their groups, was only a small stir:
   176 mostly small trades in the reveal hour. (One number per sentence; the
   190,000-contract figure may demote to a caption.)
3. Compress contracts-vs-premium to one sentence: you can count a market two
   ways, how many $1 tickets traded, or how many dollars actually changed hands.
4. Peak match day would run thousands of times bigger. (The exact 3,400x /
   21,000x pair demotes to the existing on-screen number route per design §7;
   keep at most one of them in prose.)
5. Thesis line, kept nearly verbatim from the build: a market is not a poll that
   runs all day; it is a crowd that shows up when something is at stake.
6. Act close cards: **Skill unlocked** — "You can now read any price on this
   page as a chance out of 100, and check whether a crowd is behind it."
   **Receipt** — "This one held a live price on France for thirteen months and
   settled it the second the belief died. No poll can do that."

---

### S3 · keep title "The flood" · kicker "Skill 2 of 5 — what volume means"

**Job.** Open Skill 2: show what "a lot of money" looks like, teach the tape as
the market's receipt, and land the panned-out call — the tape beat the press by
a week.

**Beat guidance (3 beats as built).**
1. Beat 1 stays one line: the tournament began and the money arrived all at once.
2. Beat 2: match markets, which could not exist before kickoff, out-traded the
   year-old winner market on day one and passed its whole lifetime total on day
   two. (49.4M vs 31.6M may stay; split any sentence carrying two numbers.)
3. Beat 3: teach "the tape" plainly — the exchange's complete receipt, every
   trade it ever cleared; this counter is its running total. Watch it pass the
   number the newspapers reported, $7.4 billion, and keep climbing: a receipt
   only ever grows, so any dated total is a floor. The market knew its own size
   before the news did. (The 98.6% in-tournament share demotes to a caption;
   label on the press marker goes plain: "the press number, one week stale.")

---

### S4 · retitle "Busy is not smart" · kicker "Skill 2, continued — the volume trap"

**Job.** Teach the volume trap the reader must dodge tonight: trading follows
the schedule, not secret knowledge — so heavy trading tonight means people are
watching, not that they know something. Secondary: freshness — the price is
sharpest when the crowd is awake, and tonight's final sits in US prime time.

**Beat guidance (2 beats as built).**
1. Beat 1: the market gets loud when games kick off and quiet when they don't;
   about half of all money traded within a few hours of a kickoff. The grid on
   screen is basically a picture of the match schedule.
2. Beat 2: one honest leftover in one sentence — American waking hours trade
   about twice what the schedule alone predicts. Rest-day ratios (5–15x, 3x
   futures) demote from body prose to a caption; they are caption-sized facts.
3. Tonight line: heavy trading during tonight's final will mean attention, not
   inside knowledge — but it also means the price will be wide awake at kickoff.

**Marginal-scene flag (author's call, prose-level only).** If the author wants
a tighter middle, this scene's two jobs compress to ~60% length; the scene
itself stays (cutting it would orphan the clock-grid tiles and the act's pacing).
No registry impact either way.

---

### S5 · keep title "Where the dollars sat" · kicker "Skill 2, continued — depth decides trust"

**Job.** Deliver Skill 2's usable rule: the exchange lists a market for almost
everything; the money picks a few favorites, and the more money behind a price,
the harder it is to dismiss. Plant the payoff: the empty aisles return in S14.

**Beat guidance (3 beats as built).**
1. Beat 1 stays near-verbatim: Kalshi lists the outcome space; dollars find the
   plausible outcomes. (Consider the plainer echo right after: "the exchange
   lists a market for almost everything; the money picks a few favorites.")
2. Beat 2: teach "leg" in one plain sentence (a match splits into three tickets
   — home win, draw, away win; each is called a leg). Three big families took
   about two thirds of every dollar; more than half the catalog, nearly 20,000
   tiny markets, shared a third of one percent. **Gini figures (0.930 / 0.44)
   move out of body prose into the axis caption** — pure jargon at this level.
3. Beat 3 (ad-markets, no political content — the built Pepsi framing stands):
   the loudest market with nothing to do with football was a bet on which brands
   would advertise; all 35 of those markets together were tiny next to one real
   match night. Keep the built closer: loud in imagination, faint in money.
4. Plant line: remember these near-empty markets; they come back in the one
   place this market got something wrong. (Tags carry to S14 — built machinery.)
5. Below-one-dot band chip goes plain: "these markets never traded even one
   dot's worth."
6. Act close cards: **Skill unlocked** — "You can now tell attention from
   knowledge: depth decides which prices to trust." **Receipt** — "The tape
   counted $12.3 billion a week before the press did, and the money skipped the
   silly bets." (Cards may sit at S6's close instead if pacing prefers; S6 ends
   the act.)

---

### S6 · retitle "One market, up close" · kicker "Skill 2, continued — the tape's limit"

**Job.** Cap Skill 2 with its honest limit — the tape shows THAT money moved,
never WHY — and hand off to match speed.

**Beat 1 guidance.**
1. The biggest single market of the whole tournament was: will Mexico knock out
   England? Host-country money piled onto one night, about a million separate
   trades.
2. Replace "retail flow" and "taker-yes skew" with plain words: up close it
   looks like ordinary people making ordinary-sized bets — more buyers of yes
   than no, which is true everywhere on this exchange.
3. Keep the honesty line, plainer: the tape cannot say whether a Mexico fan was
   betting with their heart or protecting it.
4. Arrival rate: trades were landing about one per second before kickoff, and
   the whistle stepped that up about 5.4-fold. ("Print" gloss stays: a print is
   one executed trade — or drop the word entirely.)
5. Handoff sentence: volume tells you where the crowd is, not what it knows;
   for what the crowd knows, you have to watch prices move during a match. Next.

---

### S7 · keep title "The goal, three ways" · kicker "Skill 3 of 5 — reading a live match"

**Job.** Open Skill 3 with its core proof: when a goal lands, the jump IS the
new honest price — and speed comparisons between sources are measurement
quirks (R23 stays airtight, in plainer words).

**Beat guidance (4 beats as built).**
1. Beat 1: three price sources watched the same goal (Haaland's second against
   Brazil). Name and teach each in one clause: Kalshi, the American exchange
   whose tape this is; Polymarket, an offshore crowd market; Pinnacle, a
   sportsbook — the professionals' betting house. Kalshi kept trading through
   the whole move.
2. Beat 2: teach "suspend" plainly — a sportsbook pulls its price the instant
   play turns dangerous, then posts one new number later at the level it now
   believes. Pinnacle did exactly that: dark for about eighty seconds, then one
   new price.
3. Beat 3: Polymarket's saved records only tick once a minute, so they cannot
   answer fast questions. The famous 29-vs-60-vs-119-second ladder is three
   different measuring sticks — anyone ranking their speeds is ranking
   measurement quirks. (Keeps R23's prohibition as prose the reader can use.)
4. Beat 4, without leading on "fade": here is what matters tonight — after a
   goal, the new price held. It was not a panic that snapped back; it was the
   answer. ("To fade" may be taught in apposition if kept: to fade a move is to
   bet it snaps back; here there was nothing to fade.) Friction gloss in one
   clause: within the couple of cents that fees eat anyway.

---

### S8 · keep title "Which market you watch" · kicker "Skill 3, continued — check which ticket is talking"

**Job.** The most concrete safety check the reader may need tonight: rules can
move a price without news; know which contract you are reading before you react.

**Beat 1 guidance.**
1. Germany and Paraguay were level after ninety minutes.
2. One ticket — Germany wins in normal time — has to die at the whistle by its
   own rules, because a draw counts as no. Its price slid from 48 cents to one
   like sand through an hourglass, never faster than seven cents a minute.
3. Contrast in one sentence: real goals move prices three times that fast in
   thirty seconds.
4. The other ticket — Germany goes through — barely moved and kept trading
   through every penalty kick.
5. Same match, two tickets, two different stories; someone watching only the
   first would swear the market dumped Germany for no reason. It didn't.
6. Tonight tie-in, stated on screen: if the final is level late, the
   win-in-ninety price will slide by rule; the real belief will be in the
   champion tickets. Check which ticket you are reading before you react.

---

### S9 · retitle "Three upsets, one rule" · kicker "Skill 3, continued — prices watch the road ahead"

**Job.** Close Skill 3: a team's price is a price on the road still in front of
it, so one upset reprices everyone — and tonight's Argentina is priced by the
same math.

**Beat guidance (3 beats as built).**
1. Beat 1: teach bracket math in plain words — when a result changes who a team
   would play next, that team's price moves even though it did nothing. When
   Germany went out, Paraguay's champion ticket jumped five-fold; not because
   Paraguay got better, but because its road got easier. Norway 3.6x, Belgium
   about 2x.
2. Beat 2: what happened next followed bracket news — who each survivor would
   have to beat — not hype fading.
3. Beat 3: the proof is Norway. Its ticket spiked in the exact minutes Argentina
   was losing to Egypt; Norway's price was watching Argentina's match. A price
   is a bet on the remaining road.
4. Callback flag: Argentina, tonight's team, is priced by its remaining road —
   one match — right now.
5. Act close cards: **Skill unlocked** — "Jumps are news, slides can be rules,
   and every price watches the road ahead." **Receipt** — "Every clean spike of
   this tournament held; every famous 'panic' was fine print or bracket math."

---

### S10 · retitle "Two crowds, one price" · kicker "Skill 4 of 5 — who is behind the number"

**Job.** Open Skill 4: rival venues are forced into one price, so no better
number is hiding anywhere else.

**Beat guidance (3 beats as built; beat 2 is a visual-only step).**
1. Beat 1: teach the three-way in one clause — each match has three tickets:
   home win, draw, away win. Teach "a point is one cent, about one percentage
   point of chance" in one clause. Two rival venues, one American, one offshore,
   priced every knockout match for a month and never disagreed by even five
   cents for half an hour; the average gap was under one cent.
2. Add the mechanism sentence (from Candidate 2's graft): if two prices split,
   traders buy the cheap one and sell the rich one until they meet — free money
   closes gaps.
3. Beat 3: the sixteen apparent splits with the professionals all began within
   about two minutes of the pros' last posted price and contain zero fresh
   quotes. Sixteen episodes, one cause: the professionals had left the room.
   (The count-up chip does the arithmetic on screen.)

---

### S11 · keep title "The verdict, and the trap" · kicker "Skill 4, continued — the pros tied, and the trap"

**Job.** Remove the last excuse to distrust the number — graded like forecasts,
the amateurs tied the professionals wherever both were alive — and teach the
dead-price trap this study fell into three times.

**Beat guidance (3 beats as built).**
1. Beat 1: teach vig/devig plainly first — a bookmaker pads every price so the
   odds add past 100 percent; the padding is its fee; strip it out to compare
   fairly. Grade a prediction like a weather forecast: the closer your percent
   was to what happened, the better your score — lower is better. ("Brier
   score" is named once in the footnote only, per the jargon rule.) On that
   grading, a day out and an hour out, the amateur crowd and the professional
   book were a statistical tie. Print the small-n caveat as the built caption.
2. Beat 2: the one blowout came five minutes before the end, after the
   professionals' in-game book had already closed, by design. Scoring someone
   after they left the room is not a win.
3. Beat 3 stays in plain words and stays small on screen: this study fell into
   that same trap three times before the tape corrected it. The note stays up.
4. Act close cards: **Skill unlocked** — "Take the number at face value once the
   fee is stripped: no one sharper is hiding behind it. A sudden gap between
   venues means one of them stopped quoting." **Receipt** — "All sixteen
   'wins over the pros' started the moment the pros stopped posting. We fell
   for it three times ourselves; the tape caught us."

---

### S12 · retitle "The false alarm" · kicker "Skill 5 of 5 — its fake flaws, and its real ones"

**Job.** Open Skill 5 with discipline: most "the market is wrong" alarms are
false. Before crying bias, ask two questions — what do the rules pay for, and
what does the road ahead look like?

**Beat guidance (2 beats as built; the naive-then-resolved reveal is the scene's
point and stays exactly as built).**
1. Beat 1 (the naive frame, desaturated): here is a trap you can now dodge. In
   the top-scorer market, Mbappe's ticket cost double Messi's on identical
   eight-goal tallies. Same goals, double the price — looks broken.
2. Resolution: it wasn't. The market was pricing goals still to come (Mbappe was
   scoring faster; they had traded level on July 7 and 8 with Mbappe still a
   goal behind), plus the contract's own tie-breaker rule.
3. Beat 2: drop "Poisson process" from body prose; footnote it. Plain version:
   goals arrive at a fairly steady rate, so more minutes left means more
   chances. Kane's cheap ticket halved on a day England WON, because he played
   120 minutes without scoring and his remaining chances shrank.
4. Closer: before you call any price crazy tonight, ask what the rules actually
   pay for, and what the road ahead looks like. (Ladder gloss stays one clause:
   the top-scorer book is a ladder, one rung per contender.)

---

### S13 · keep title "The flags and the price" · kicker "Skill 5, continued — the patriotism alarm is false too"

**Job.** The second fake flaw: fan love never got a vote in the price — exactly
what the reader needs on Argentina-flag night.

**Beat guidance (4 beats as built).**
1. Beat 1: 87 percent of Argentine fans polled said Argentina would repeat as
   champion; Argentina's ticket traded at 11 cents. Keep the pinned units
   caption in plain words: a poll measures how many people agree, not how likely
   a thing is.
2. Beat 2: 7 percent of Americans picked the USA; America's own exchange priced
   that ticket at a cent and a half.
3. Beat 3: teach the model in one clause (Opta's computer plays the tournament
   out thousands of times). Host teams did pull in about double the money of
   equally-rated teams — attention is real money — but it bought a point or two
   of price, not ten. Keep: loud in volume, faint in price.
4. Beat 4 stays footnote-weight with the BUILT reconciled figures: when teams
   died, no loyal money lingered — all 28 losers' tickets wound down in 277
   trades worth about $2,190, all at a penny or less. (Build figures override
   the storyboard's 302 / $2,340; they were reconciled against the re-driven
   tape at W8b.)
5. Tonight tie-in closing line: tonight the flags at MetLife are Argentina's,
   and loud — and you now know the price will not care, because it never did.

---

### S14 · keep title "The one real sin" · kicker "Skill 5, continued — the flaw that is real"

**Job.** Hand the reader the one proven flaw and its exact address — penny
longshots in thin side-bet ladders — so they know which prices on tonight's
board to smile at.

**Beat guidance (4 beats as built).**
1. Beat 1: teach calibration plainly — things priced at 30 cents should happen
   about 30 percent of the time; the diagonal is that promise kept. One flaw is
   real: penny tickets, the 1-to-10-cent longshots, paid out about a third as
   often as their price promised. (Keep the exact 3.04% → 1.19% pair; split
   sentences so each carries one number.)
2. Beat 2: teach prop/ladder/tick plainly — a prop is a side bet on something
   other than the result, like first scorer or exact score; a ladder stacks many
   of them; the tick is the one-cent minimum step where longshots pile up.
   Nearly three quarters of the flawed prices live in those thin ladders, and
   over half sit pinned at the one-to-two-cent floor.
3. Beat 3: weigh the same chart by dollars actually traded and the flaw nearly
   vanishes. Constancy payoff in one plain sentence: the sagging dots here are
   the same dots that sat in the empty tail three acts ago. Weak prices live
   where money does not.
4. Beat 4: and the worst-priced tickets of all were 90-to-95-cent favorites —
   so the folk story that crowds only overbet longshots is not even one-sided.

---

### S15 · keep title "Thirteen months above the line" · kicker "Skill 5, continued — the open question, and it is about Spain"

**Job.** Set the exam's live question: this market holds opinions for months,
and its longest-held opinion is about tonight's teams. Spain is the team it
doubted. The France drain — the piece's emotional peak — is untouched.

**Beat guidance (3 beats as built).**
1. Beat 1: for thirteen months — with the bookmaker's fee stripped out,
   **devigged** — the market kept France a few points above the experts' model
   and Spain a few points below it. (The "devigged" qualifier stays in beat
   copy per design FIX #3, taught in place with the plain-words-first pattern.)
2. Beat 2 stays one line: that is one opinion held five times, not five separate
   findings.
3. Beat 3: then Spain beat France in ninety minutes. One match cannot prove a
   40-percent price wrong. But tonight the trophy game belongs to the very team
   this market spent a year doubting. Was that doubt information, or a blind
   spot? No skill in this piece can answer that for you. It is the live part of
   tonight's number.
4. Act close cards: **Skill unlocked** — "You know the market's real flaws: a
   penny tax where money is thin, and opinions it can hold for a year."
   **Receipt** — "The one confirmed sin lived in the aisles where almost nobody
   shopped; the one open opinion plays tonight."

---

### S16 · keep title "How to read the number" · kicker "The exam, part one — your five skills"

**Job.** Compress the course into five cheat-sheet cards, each an instruction
the reader will use within hours, over five pictures they already know.

**Lockup retitles (the `LOCKUPS` array in s16.js; cards named, not numbered —
see §3 numbering note; ordinals become the card names' small-caps kickers).**
Built visual order (braid, curve, mirror, pair, strip) is unchanged:

1. Braid → **"No one sharper"** — Take the number at face value; strip the fee,
   then trust it. Two crowds and the pros all agreed.
2. Curve → **"Trust the pools, smile at the ladders"** — Deep markets earn
   trust; penny side-bet ladders carry the lottery tax.
3. Mirror → **"The spike is the price"** — If someone scores tonight, the jump
   is the new truth. Fine-print clause from S8: near minute ninety of a tie,
   the win-in-ninety ticket slides by rule; belief lives in the champion
   tickets. Caption text, never a second chart.
4. Pair → **"The flags don't move it"** — 87 percent of fans met an 11-cent
   price. **Activate the built Argentina callback** (`argCallout` in s16.js;
   opponent IS Argentina): tonight's crowd is that same crowd.
5. Strip → **"It holds opinions"** — This market doubted Spain for a year, with
   the fee stripped out, **devigged** (FIX #3: qualifier in beat copy). Spain is
   still standing. The open bet.

One narrated line opens the scene: "Here are your five skills again, in the
order you will need them tonight." Each card ends with one use-it-tonight line.
Captions shorten card by card, per the built stride.

---

### S17 · keep title "The number" · kicker "The exam, part two — your read"

**Job.** Reframe from "the piece stops narrating" to "your turn." Hand over the
frozen number and ask for the reader's own read, spending all five skills by
name. Hero numerals, devig line, timestamp, provenance line: unchanged
machinery, manifest-driven.

**Beat 1 guidance.**
1. Here is the number, frozen this morning and never updated: Spain 58.8 cents,
   Argentina 42.0.
2. The two prices add to a little over a dollar; the extra is the market's
   built-in fee, the vig. Stripped out, Spain's true implied chance prints
   below, same freeze, same timestamp. (Plain gloss replaces "legs sum above
   one hundred percent"; the devig discipline and provenance line stay.)
3. Now read it yourself, one skill at a time: no one sharper stands behind it;
   it is the deepest market of this exchange's life; if someone scores tonight,
   the jump will be the new truth — and near minute ninety of a tie, check
   which ticket is talking; the flags will not move it; and it carries one
   year-old opinion about Spain that just lost its favorite. (Enumeration must
   match S16's five card names word for word.)
4. Close: agree with 58.8 or don't — but now you would be disagreeing for a
   reason. The morning after, the epilogue will grade the market, and you.

---

### S18 · retitle "Check it yourself" · kicker "The lab"

**Job.** The lab: prove the piece trusts the reader. Replay any market's whole
price life; step through a match trade by trade. This is what turns the lesson
into a capability.

**Beat 1 guidance (light word-level polish only).**
1. Keep: the story is told; every dot above is still yours to open.
2. "Scrub" becomes "step through"; keep the listing/settlement gloss.
3. Keep verbatim: nothing here is a simulation; every dot is money that moved.
4. One added line closing the loop: if you doubted anything above, or want to
   test your own read before kickoff, open any market and check it here.

---

## 6. Scene order and cuts

- **Scene order: UNCHANGED.** s01 → s18 exactly as registered in
  `docs/js/main.js` (`SCENES` array, lines 54–55). No registry edit, no
  transition re-QA, no anchor or footnote renumbering. Candidate 2's proposed
  s13 move (between s11 and s12) is REJECTED for v1 — deploy-day risk for a
  thematic gain the Skill-5 grouping already delivers — and logged as a v2
  consideration only.
- **Cuts: NONE.** Every scene carries a named skill job above. The one marginal
  scene (S4) is handled by prose compression, not removal (see its row); no
  `main.js` impact. Cutting any scene would orphan built dependencies (S5 tags
  → S14; S7's Norway–Brazil goal → S9's mirror; S16's five anchors import
  s09/s10/s13/s14/s15; S1/S2 share the resting-field formula).

## 7. Standing register rules for the prose pass (every beat)

1. **FK grade ≤ 9 per beat.** Achieved by splitting, not by dropping facts:
   current worst offenders (S2, S11, S12) run 25–35 words per sentence; target
   under 20. Split at semicolons. One number per sentence where possible.
2. **Strategist voice, accessible:** third person, sparing first person (the
   three-traps receipt and S17's "your read" are the sanctioned exceptions),
   no em dashes, no negation cascades, numbered footnotes, topic-forward.
3. **Teach every term in the sentence it first appears, plain words first,
   term in apposition.** The ladder: ticket/price-as-chance + settle (S1),
   crowd-behind-the-price (S2), the tape (S3), leg (S5), print — or drop it
   (S6), sportsbook/suspend + fade-if-kept + friction (S7), settlement clock
   (S8), bracket math (S9), three-way/point + arbitrage-as-free-money (S10),
   vig/devig + forecast-grading (S11), forward pricing + ladder (S12),
   poll-vs-price units (S13), calibration + prop + tick floor (S14), model
   odds + devigged (S15).
4. **Jargon deletions:** "retail flow" and "taker-yes skew" (S6) → plain words;
   "Gini" (S5) → caption; "Brier" (S11) → footnote, prose says "graded like a
   weather forecast, lower is better"; "Poisson" (S12) → footnote; "notional"
   (everywhere) → "dollars traded"; "book" survives only where taught.
5. **Numbers are load-bearing and verbatim from the corrected dossier** (0.74
   points, 84 legs, 5.4x, 87% / 11c, 48c→1, 7c/min vs 19–25c/30s, 3.04% →
   1.19%, 72% / 55%, 58.8 / 42.0...), refrozen at the deploy-morning re-run.
   Where the build reconciled a figure against the re-driven tape (S13's 277
   trades / ~$2,190), the build figure wins over the storyboard.
6. **Standing prohibitions:** R23 (no venue speed race — S7's "measurement
   quirks" line carries it); the eleven killed findings stay dead; no political
   content (S5's built ad-market beat stands); dots mean money and only money.
7. **Design-system discipline:** the "devigged" qualifier stays in beat copy at
   S15, S16 card 5, and S17 (FIX #3), always plain-words-first ("with the
   bookmaker's fee stripped out, devigged"). Any amber act-close card sits on a
   scrim, never inline with `ink.hi` prose (perception brief §9a, 1.29:1).
   OG/no-JS fallback for S12 stays locked to the resolved frame.

## 8. What the reader can do at the end (acceptance test for the rewrite)

1. Read any prediction-market price as a chance out of 100, and strip the fee
   when a market's tickets add past a dollar.
2. Judge whether a price deserves trust before using it: deep pool versus penny
   ladder, crowd awake versus asleep.
3. Watch tonight's final through its prices: a goal-spike is the new honest
   price; a slow slide near the whistle of a tied game is contract rules; a
   sudden venue gap means someone stopped quoting.
4. Discount the noise: fan percentages, TV attention, and heavy volume are not
   probabilities.
5. Form their own read on Spain 58.8 / Argentina 42.0: accept the consensus, or
   knowingly take the other side of the market's year-long Spain doubt.
6. Check any of it — and their own read — against the raw tape in the lab, and
   carry the same five questions to any prediction market anywhere.

## 9. Files the rewrite touches

- `docs/index.html` — `#title-screen` pre-title + deck (the new opening, §4).
- `docs/js/scenes/s01.js`–`s18.js` — `title:` fields (retitles: s04, s06, s09,
  s10, s12, s18), beat `html:`, `chip:` strings, act-close cards, kicker text.
- `docs/js/scenes/s16.js` — `LOCKUPS` array strings; confirm `argCallout`
  renders (opponent = Argentina).
- `docs/js/scenes/s17.js` — beat html only; hero/devig/timestamp are
  manifest-driven and refreeze at the G3 morning run.
- NO changes to: `docs/js/main.js` registry, engine, layouts, tiles, manifests.
