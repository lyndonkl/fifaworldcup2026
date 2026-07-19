# Visual-story design review — synthesis

**Date:** 2026-07-19 (morning of the final) · **Phase 5, Gate 4 input**
**Inputs:** 18 per-scene cognitive reviews over `research/design-review/screens/` (109 frames), grounded in `research/revision/perception-brief.md`.
**The goal (author's directive, verbatim):** "Have clear visuals that a human looking at it can infer what is being said through the visuals. Screenshots of the visuals as they are animated through time should be taken and the series of screenshots should clearly tell what the narrative is trying to say."
**The author's standing verdict (outranks any average score):** "The current animated visuals are extremely difficult to understand. Everything looks very cluttered."

---

## 1. Per-scene verdicts

Method: each scene was read blind from its screenshot series first (pixels only), then compared against the intended story. `match` = how much of the intended story a viewer of the images alone recovered (0-10). Clutter counts are for the worst frame: simultaneous meanings vs the ~4-slot working-memory budget, and competing bright elements vs a ~3 ceiling.

| Scene | Intended story (one line) | Blind story (what the pixels said) | Match | Worst clutter (meanings / bright) | Best frame | Verdict |
|---|---|---|---:|---|---|---|
| s01 | A price is a chance: France's flat forty cents, the goal jump, the fall to zero, the settlement pour | A bet sat flat, then a giant unexplained white explosion near "a goal and a whistle" | 2 | 8 / 6 (b1-scrub50) | b1-scrub90 | **SIMPLIFY** |
| s02 | The champion market's 14-month life: dormant year, Dec 5 twitch, tournament eruption | One market sat silent for a year, twitched Dec 5, then exploded | **6** | 6 / 6 (b1-scrub90) | b1-scrub50 | **KEEP** |
| s03 | Kickoff floods the tape; match markets dwarf the winner market; the total passes the $7.4B press number | Money flooded in; a tower of match bets ended far taller; total ~$12.8B | 4 | 8 / 5 (b1-t0) | b3-settled | **SIMPLIFY** |
| s04 | Money trades on the schedule's clock: kickoff windows take 54.7%; US waking hours run ~2x | Dots sort into a calendar; bars mark kickoffs; money shows up when games are on | 3 | 8 / 6 (b3-t0) | b2-t0 | **SIMPLIFY** |
| s05 | Concentration: 414 legs took 63.5% of every dollar; the ad market sits deep in the thin tail | Nearly all money piles into the few biggest markets; a tiny amber "ad market" in the empty tail | **6** | 7 / 6 (b1-t0) | b1-settled | **KEEP** |
| s06 | Mexico-England: an enormous night; YES outweighed NO; pace stepped up 5.4x at kickoff | A colossal unbroken blizzard of trades; "there was a lot of trading" | 2 | 8 / 5 (b1-scrub90) | b1-scrub90 | **RESHAPE** |
| s07 | One goal, three venues, three native speeds; Kalshi trades through it; the new price holds | A wall of shimmering static; captions claim three lanes; nothing visibly changes | 2 | 8 / 6 (b4-t0) | b1-t0 | **RESHAPE** |
| s08 | Germany-Paraguay pens: the regulation ticket dies at 90'; the advance ticket keeps trading | A gigantic blizzard around the 90th minute; no price visibly does anything | 1 | 9 / 5 (b1-scrub25) | b1-scrub90 | **RESHAPE** |
| s09 | Upset shocks: Paraguay 5x, Norway 3.6x, Belgium 2x; Norway rises as Argentina falls | An unchanging crowd of pale dots; labels claim jumps; nothing moves | 2 | 7 / 4 (b2-t0) | b3-t0 | **RESHAPE** |
| s10 | Kalshi and Polymarket never sat five points apart (mean gap under a cent); Pinnacle stopped 16 times | Two markets spiked like crazy in violent DISAGREEMENT; the grey line kept cutting out | 2 | 9 / 15 (b3-t0) | b3-settled | **RESHAPE** |
| s11 | Brier verdict: all three venues score the same; the one blowout was an unfair test | Three sources scored about equal; something enormous and unexplained at "5 min out" | 5 | 9 / 5 (b3-settled) | b1-settled | **SIMPLIFY** |
| s12 | Golden Boot: Mbappe 61c vs Messi 31c on identical goals; the tiebreak explains it | A flood buried the charts until the screen turned to solid white static | 1 | 9 / whiteout (b2-t0) | b1-t0 | **RESHAPE** |
| s13 | 87% of fans vs an 11-cent price; hosts' money vs the model; loyal money winds down to nothing | A giant square of TV static while tiny labels argue about numbers | 2 | 7 / 5 (b1-mid) | b1-mid | **RESHAPE** |
| s14 | Calibration hugs the diagonal; penny longshots overpriced; the 90-95c favorites were worst | Static snaps into a diagonal band, then a wiggly line near "perfectly priced"; no amber ever appears | 3 | 7 / 5 (b1-t0) | b1-settled | **RESHAPE** |
| s15 | The market priced France above the model and Spain below it for 13 months; tonight belongs to Spain | Money hovered above a dotted line at five checkpoints, then crashed into a bright wall and died | 3 | 9 / 5 (b1-settled) | b2-mid | **SIMPLIFY** |
| s16 | The recap: five skills, five charts revisited | A glowing pile keeps changing shape; beyond "money showed up at the end," nothing decodable | 1.5 | 7 / 5 (l3-settled) | l2-settled | **RESHAPE** |
| s17 | The frozen final prices, devigged and timestamped; the piece holds still | Frozen prices switch on: Spain 58.8, Argentina 42, gold underline, timestamp; plus one glowing unexplained pillar | **6** | 8 / 6 (b1-mid) | b1-settled | **KEEP** |
| s18 | The coda: every dot is yours to open and replay | A yellow streak crumbles into dust while a glowing white wall sits untouched | 3 | 6 / 4 (b1-mid) | b1-settled | **SIMPLIFY** |

**Mean match: 3.0 / 10** (54.5 across 18 scenes). Three scenes at or above 6; eight scenes at 2 or below.

Against the author's goal, the honest reading of this table: **the screenshot series does not tell the story in 15 of 18 scenes.** Where the story does land (s02, s05, s17, and the first beats of s11 and s14), it lands because a single bright shape or a printed number carries it. Everywhere else the prose column and annotation cards carry the narrative; the pixels are mute or actively misleading (s10's agreement story reads as disagreement; s16-l2's calibration reads inverted).

---

## 2. Cross-scene perception patterns — what systematically overloads the viewer

The author's "everything looks very cluttered" is confirmed in every scene, but it is not eighteen different failures. It is **one primary mechanism with six secondary ones**, all predicted by the project's own perception brief.

### P1 — Figure-ground inversion: the resting field blooms to near-white and becomes the figure (the root cause)
Scenes: s06, s07, s08, s09, s11, s12, s13, s14, s15, s16, s17, s18 (criticals), plus s01/s03/s05/s10 (the same mass as a mid-scene wall).
The engine accumulates dot energy additively, compresses with gamma 0.35, and caps luminance at 0.92. Any dense mass therefore renders at the cap: near-white, hue washed out, brighter than every story mark. The existing `emphasis.rest-dim` (0.6x) is roughly an order of magnitude too weak against 50-500x overlap; the brief's §9b table (field catches an active dot by ~5 overlaps) is realized at maximum scale in s12 (full-canvas whiteout) and s08 ("the ground IS the figure"). Consequences cascade: identity hues are isoluminant with the field (nothing pops), amber annotations sit at ~1.4:1 on the bloom (§9a), keys describe "grey/dim" masses that render white, and the brightest object in nearly every frame is a non-story element. **No flat per-dot alpha can fix this** (with gamma 0.35, keeping a 100-overlap region below the cap needs per-dot energy so low that a lone dot vanishes). The fix is a density-aware or per-tier luminance cap in the tone-map chain: engine work, deferred to the author (Tier 0 below).

### P2 — Dead time axis: narrated change never renders
Scenes: s04-b2, s05-b2/b3, s06, s07-b2/3/4, s08, s09-b1/b2, s10-b1/b2, s12-b2, s13-b4, s14-b4, s15-b2, s16 (byte-identical or near-identical t0/mid/settled triples; s10-b1 and b2 literally the same file three times).
A screenshot series cannot narrate when frames do not differ. The narrated events (recolor, suspension, jump, drain, twist) either happen silently between beats (change blindness by construction) or only in prose. This is the single most direct violation of the author's directive.

### P3 — Key-to-mark decode failure: phantom, stale, and silently-reworded keys
Scenes: s01 (grey/orange invisible), s02 (grey ground absent), s05 (figure dropped from key), s06 (all three colors unfindable), s07 (95% of marks un-keyed), s08 (slate=grey), s09 (key churn + residual marks), s12/s13/s14/s15/s16 (promised hues never visible), s16 (new key over old geometry at every t0), s17/s18 ("dim/grey" label on the brightest object). A key row with no findable referent costs a working-memory slot and pays nothing; a silently reworded key redefines a color mid-scene.

### P4 — Text collisions, occlusions, and clipping (~25 instances)
Every scene has at least one: axis titles printed through tick labels (s01, s02, s04, s09, s12), captions overprinting each other (s01, s07, s15), the KEY panel occluding annotations/axis labels/data (s02, s03, s05, s06, s10, s11, s15, s16 all beats), annotations clipped at the viewport edge (s03, s07, s12, s14), the grain chip over prose (s02, s03, s04, s10, s11, s12, s14, s15, s17, s18), the Skip-to-methods pill over prose (s02, s05, s10, s11, s15, s18), dark text buried under dots (s07, s09, s11, s12, s13). Layout has no reserved lanes and no collision avoidance.

### P5 — Salience misallocation: the brightest thing is never the story
First fixation lands on an un-keyed luminance mass in s01, s03, s05-t0, s10 (white band), s11 (rest band reads as a mega-bar at "5 min out"), s12 (volume band), s14 (noisy top-right oscillation), s15/s17/s18 (the pillar), s16 (bloom slab). Amber, the reserved "story points here" hue, is triple-booked in s04 and near-illegible on bloom everywhere (§9a).

### P6 — Working-memory overload
Worst frames run 6-9 simultaneous meanings against the 4-slot budget in every scene; s10-b3-t0 pairs ~9 meanings with ~15 competing bright elements. Overload is concentrated at beat boundaries (stale geometry + new key + new captions at once: s03-b1, s16 every t0).

### P7 — Unshaped transition states
Mid-morph captures are full-brightness noise with no figure (s04-b1-mid, s05-b1-t0, s13's texture flips, s15-b1-mid, s16 all mids). In-flight dots fly at full luminance; a paused reader (or the reduced-motion crossfade) can land on a frame that communicates nothing.

**Harness observations (for the next audit run):** byte-identical t0/mid/settled triples should auto-flag as "no perceivable change"; the guard's dominant-color check cannot catch an overplot whiteout (add a luminance-histogram or plot-coverage check) or a phantom key (add a key-swatch pixel-presence check); scrub scenes never capture the 100% end state, so s01's settlement pour is structurally invisible to the audit; two index.json entries carried stale keys (s07-b1, s09-b1).

---

## 3. Full prioritized issue list

Severity: **C** critical, **M** major, **m** minor. Order within tiers = repair priority.

### Tier 0 — systemic (one engine fix resolves the plurality of criticals)

1. **[C-systemic] Density-aware / per-tier luminance cap in the tone-map** so summed rest-tier energy can never reach story-mark luminance (target: story marks ≥3:1 over the locally-summed field; rest mass capped well below the 0.92 tile cap). Root cause of the P1 criticals in s06-s09, s11-s18. One candidate implementation: write active-tier energy into the accumulation target's unused alpha channel and apply a lower cap where active share is low. Engine change — author decision, not attempted in this pass.
2. **[C-systemic] One perceivable change per beat** (P2): every narrated event gets an onset transient (brief §7) inside its own beat; no byte-identical frame triples.
3. **[M-systemic] Layout lanes + collision avoidance** (P4): reserved exclusion zones for KEY, grain chip, counters, axis titles, methods pill; scrims behind all on-field text; no annotation may clip the viewport or sit under the key.
4. **[M-systemic] Key hygiene** (P3): a key row exists iff its mark is findable on screen; key changes pulse (the existing chip protocol) and never silently reword; swatch must match rendered appearance.
5. **[M-systemic] In-flight dots at rest opacity** (P7): brighten on arrival, not in transit.

### Tier 1 — per-scene criticals (52)

- **s01** ✅C1 un-keyed near-white wall dominates every frame → in-zoom field dimmed to 0.10 alpha (FIXED this pass; recapture confirms the rest ribbon now reads as keyed dim grey. A residual bright column remains at the tick stream's leading edge — that mass is the ACTIVE trade cluster blooming past the cap, which only the Tier 0.1 engine fix can hold to recognizable cyan). C2 climax column fully rendered at scrub25, pixel-identical to scrub90; narrated fall/pour never perceivable → gate the pour on scrub progress with an onset (DEFERRED: keyframe re-timing; also add a scrub100 capture). ✅C3 two captions overprinted top-center → one caption lane, sequenced (FIXED; recapture confirms one legible caption per frame).
- **s03** C1 prior scene's pour is the most salient object at b1-t0 and matches no key → settle residue to rest before entry (DEFERRED). C2 "watch two towers grow" never happens within beats → per-beat accumulation (DEFERRED). ✅C3 $7.4B crossing mute → line now labeled "$7.40B: the press number, about one week stale," anchored clear of the KEY (label half FIXED; staging the crossing on the counter DEFERRED).
- **s04** ✅C1 headline "US waking hours ~2x" amber-on-bloom at ~1.4:1 → bg-canvas scrim behind the label (FIXED). C2 b2's announced teal recolor happens outside b2 (three identical frames) → fire recolor inside the beat with a pulse (DEFERRED). C3 b1 opens on an undecodable bloom monolith → start from dimmed rest tint (DEFERRED, depends on Tier 0.1/0.5).
- **s05** C1 b1-t0 is a mid-morph explosion with no figure → in-flight dots at rest opacity (DEFERRED, Tier 0.5).
- **s06** C1 figure-ground inversion (2M-trade field is the figure) → Tier 0.1 + density-aware field. C2 "kickoff line, 5.4x" unfulfillable: no kickoff rule, spike clipped and under the KEY → draw a labeled full-height kickoff rule; free the pace lane. C3 key colors unfindable; YES>NO story mute → luminance-separated YES/NO bands or margin histograms. (ALL DEFERRED — RESHAPE.)
- **s07** C1 undimmed rest wall in a 1:1 zoom scene it does not belong to → remove/dim the field. C2 the goal spike is an isoluminant change inside noise → connected high-luminance Kalshi path + onset pulse at the goal. C3 grey-lane suspension never happens on screen (b2 frames are the same file) → stage blank + reopening dash inside the beat. C4 key/grain plate contradict the picture (~244 declared, tens of thousands drawn) → key the field or drop it. (ALL DEFERRED — RESHAPE.)
- **s08** C1 total figure-ground collapse; both panels read as one static texture → Tier 0.1 + luminance-separated traces. C2 scrub imperceptible; the 90' split never renders → progressive price-path draw + whistle pulse. C3 key unmappable (slate≈grey; cyan absent) → merge non-story tiers, two figures only. (ALL DEFERRED — RESHAPE.)
- **s09** C1 rest field is the brightest object in all nine frames → Tier 0.1. C2 the three jumps are invisible; blue/pink unfindable → jump traces as luminance singletons. C3 pixel-near-identical consecutive frames at both pivots → onset pulses + spatial pre-cues. C4 the one visible event (b3 bloom) is unannounced, half-clipped, and vanishes by settled → persistent end states. (ALL DEFERRED — RESHAPE.)
- **s10** C1 the agreement story is told with an encoding that can only show disagreement → plot the Kalshi-minus-Polymarket gap itself inside a 5-point band. C2 b1/b2 frames byte-identical; the sixteen stops never light → sequential onset pulses. C3 ~9 meanings / ~15 bright competitors → dim all non-story ink. C4 brightest object (white Jul 11-12 band) is un-keyed non-story → cap or key it. (ALL DEFERRED — RESHAPE.)
- **s11** C1 rest band is the brightest, largest object in every frame → dim/relocate outside the chart frame (engine cap + scene placement; DEFERRED). C2 the blowout bar (the beat's message) is a grey outline on white speckle → solid fills + local field dim (DEFERRED). C3 the band groups with the "5 min out" axis label and reads as a mega-column → move the field out of the reading frame (DEFERRED).
- **s12** C1 full-field overplot whiteout swallows plot, title, labels → Tier 0.1 + confine field to a backdrop band. C2 blue/teal/pink never discernible → luminance-first story dots. C3 the 61c-vs-31c comparison is never drawn → per-row price paths with direct labels. C4 b2's resolution beat has zero perceivable change → animate divergence + Kane's halving. (ALL DEFERRED — RESHAPE.)
- **s13** C1 figure-ground inversion across all 12 frames → Tier 0.1. C2 b3: no pink/blue columns exist; the host claim has zero visible encoding → render four labeled columns with model-price ticks. C3 b4: three identical frames; the wind-down never depicted → visible drain with pulse. C4 the poll half of the central comparison is nearly invisible → solid poll bar + bright money column, two figures only. (ALL DEFERRED — RESHAPE.)
- **s14** C1 b1-t0 full-bleed white noise reads as a rendering bug → dim ground during morph (Tier 0.5). C2 the protagonist (amber penny tickets) never visibly exists → luminance/size singleton + pulse. C3 the beat-2 message is a 2-3px gap in the far corner while its annotations sit at the top → inset magnifier of the 0-10c region + adjacent annotation. (ALL DEFERRED — RESHAPE.)
- **s15** C1 France-blue/Spain-red never render as hues (bloom washout) → saturate cohorts + luminance gap + bloom exemption (DEFERRED, needs Tier 0.1). C2 un-keyed white mega-bar wins first fixation in 7 of 9 frames → dim parked mass to rest tint (DEFERRED). C3 b1-mid is a full white-out of in-flight particles → in-flight at rest alpha (DEFERRED, Tier 0.5).
- **s16** C1 l1: the two-venue comparison is invisible (all bloom-white) → two luminance-separated traces. C2 l2: the calibration line reads anti-calibrated (descending vs ascending reference) → verify/fix the mapping. C3 l3: settled state is a noise square on a stale axis → highlighted jump-then-hold path. C4 l5: no red, no grey line, no axes; the payoff absent → render the checkpoint chart. C5 l4: key vocabulary matches nothing rendered → true outline bar "87%" vs filled bar "11c." (ALL DEFERRED — RESHAPE; also fix the t0 header/geometry desync.)
- **s17** C1 the "dim" rest pillar is the brightest object at t0 → Tier 0.1 (engine); scene-level dim also possible (DEFERRED).
- **s18** C1 the invitation ("open a market") has no visual carrier → pulse 2-3 candidate dots with one anchored label (DEFERRED). C2 figure-ground inversion by the same pillar → Tier 0.1 (DEFERRED).

### Tier 2 — majors (repair with the doctrine, scene by scene)

- s01: mislabeled x-axis (0'-5000' as "match clock") + title/tick overlap; two of three key meanings invisible; goal callout swallowed by bloom at ~1.41:1; key silently rewords grey mid-scene.
- s02: "thicker = more money" legend buried under bloom at climax; unlabeled dotted event line with clipped label; axis caption printed through month ticks; spike grows into the KEY card; chip occludes the topic sentence.
- s03: lavender/teal wash to white/pink (key unmatchable); jumbo counter repeatedly washed out/occluded/clipped; amber annotation clipped at viewport edge; b1 shows one intermixed heap instead of two categories; counter jumps $406.9M→$3.38B between beats with no event.
- s04: "dim = off-peak" cells render bright white (near-isoluminant vs teal); un-keyed olive scrim; permanent axis-title/tick collisions; leftover dot band overlapping the kickoff bars; b1-mid full-viewport dot blizzard.
- s05: amber ad-market dot never pulses (mute climax); key drops the curve's own entry in b3; b2 fully static with the 63.5% claim unencoded (add the bracket over the steep section).
- s06: scrub perceptually static (add bright sweep head); every tick label reads "8pm"; sparkline unlabeled, clipped, occluded by KEY; the one moving trace (YES price) has no key/scale/label.
- s07: b2/b3/b4 all-identical frames (hard cuts between beats); overlapping annotation cards at top-left; amber "held" rule ~1.41:1 and its decoding sentence clipped; no price axis anywhere.
- s08: amber annotation occludes the second lane's title; unlabeled 0-100 y-axes and the 48→1 slide mostly off-domain; no pre-cue at the whistle line.
- s09: annotation rendered underneath the particle field; linear cents axis crushes the story into the bottom 3% (use multiples of pre-shock price); residual un-keyed marks + silent key churn between beats.
- s10: the payoff annotation ("16 of 16 start at…") physically occluded by the KEY; the largest ink mass (grey columns) is un-keyed; the only within-beat change is a small readout ticking with no cue; chip/pill over prose.
- s11: payoff annotation dissolves into speckle + second annotation clipped behind KEY; "grey" used for two meanings; both story pivots change without transients; strike-through (the verdict) unexplained and tiny.
- s12: Kane/tiebreak annotations clipped and colliding with axis text; multiple text collisions in the one legible frame; salience on the volume band instead of the price gap.
- s13: "7.000000000000001% poll" rendered verbatim (✅ FIXED this pass); story elements fade out at settled (reverse of correct); every on-field label sits on bloom without a scrim; meaningless whole-field moiré flips are the most perceptible change.
- s14: eye lands on noisy small-sample oscillation (visual weight ∝ evidence: thin/dash sparse buckets); b3 morph shows un-keyed marker populations and no before/after ghost; b4 "worst bucket" label clipped mid-word and its beat is three identical frames; two key entries indistinguishable on screen.
- s15: two grey annotations garble each other; y-axis label occluded by KEY + snake_case ticks ("post_group_pre_r32"); "dead money" is the brightest object (luminance semantics inverted); the payoff (Spain survives) has no figure and an orphaned callout.
- s16: axis subtitles clipped behind the KEY in all 15 frames; every t0 pairs the new header/key with the old geometry; morph mids are unshaped noise; amber longshot marks are 1-2px specks.
- s17: devig annotation clipped behind the prose card; amber stream flies through the devig text and timestamp; ✅ six-line PROVISIONAL debug caption (FIXED this pass: reader-facing one-liner); the promised underline payoff is the least salient bright element; displayed devig percentages do not reconcile for a checking reader (92.4% sum) — add the denominator note.
- s18: amber population on screen but absent from the key (stale key); the release is an unannounced offset while the pillar captures attention; legend says "grey" but the mass renders pale cyan-white.

### Tier 3 — minors (sweep once Tiers 0-2 land)

s01 invisible "fainter streams" caption; 40-cent anchor unmarked; three bright chrome cards splitting the first scan. s02 "December 5" label ~400px from its referent; pill over the last prose line; near-empty scrub25 with an imperceptible "thicker" cue. s03 chip/pill over prose; bloom bleeding through the KEY panel; towers unlabeled and the payoff lands one beat late. s04 third un-keyed cyan hue; "brighter = more" saturated at the cap; rest-day callout unanchored; amber triple-booked. s05 silent dots-to-line grain change; unlabeled equal-share diagonal; three text layers stacked within ~40px + Gini jargon. s06 postage-stamp "per-trade size" strip over budget. s07 salience spent on a right-edge artifact; dark in-chart labels with no halo; capture-index key desync. s08 "90'" label collision; "243th" ordinal (✅ FIXED piece-wide in the grain formatter). s09 KEY box is the only luminance singleton at beat start; axis title over tick labels. s11 footnote lines overprint each other; glowing key border during the main change; b1-t0 mid-draw bars encode a false ranking. s12 key border glow appears/disappears with no meaning; kicker half-buried. s13 stray teal cluster from the prior beat; three framing meanings in one header. s14 rotated low-contrast "perfectly priced" label behind the noisiest region; annotations captured at 20% opacity mid-fade; chip/pill occlusions. s15 b2 visually static; chip/pill occlusions. s16 invisible header at l1-t0; stale annotation into l5; orphan bright dash. s17 chip occludes the prior card mid-sentence. s18 chip over the card headline + pill over THE LAB card; unnarrated grain handoff.

---

## 4. Honest overall verdict

Measured against the author's directive, **the piece currently fails.** Mean blind-read match is 3.0/10; in 15 of 18 scenes a person looking only at the animated frames cannot infer what is being said, and in at least two (s10, s16-l2) the pixels argue the *opposite* of the narrative. The author's clutter diagnosis is confirmed at full severity, and it now has a precise shape: this is not annotation overload or too many hues. It is **one rendering-pipeline behavior (additive density + gamma 0.35 + a single global luminance cap) that turns every dense dot mass into a near-white bloom that out-competes every story mark**, compounded by beats whose narrated change never renders as pixel change, keys that describe invisible populations, and a text layer with no reserved lanes.

The equally honest other half: **the narrative spine and several visual bones are genuinely strong.** s02's trickle-to-eruption is real preattentive storytelling; s05's chaos-to-Lorenz-curve resolve and s14's static-to-diagonal morph communicate wordlessly; s11-b1's three equal bars land the calibration verdict; s17's frozen numerals nearly carry the ending alone. The piece does not need eighteen redesigns. It needs one engine-level figure-ground repair, one discipline (one message, one figure, one change per beat), and chart-first geometry in the nine scenes where the particle field alone was asked to carry a claim it physically cannot show.

---

## 5. THE DECLUTTER DOCTRINE

Derived from the evidence above. One rule, applied scene by scene:

> **Each scene carries ONE message, presented the way a well-labeled chart would present it.** One figure owns the luminance peak; everything else is dimmed to ground. Every axis is titled with units; every key row maps to a findable mark; every annotation sits legibly on its own ground. Wherever the particle field alone failed the blind read, the message is carried by chart-first geometry — a labeled line, a labeled bar, an annotated number — and the particles become supporting texture behind it, never the sole carrier. Each beat makes exactly one perceivable change, with an onset, at the narrated moment; the settled frame is the fully-annotated, static-readable proof of the beat's claim.

Operating budgets (from the perception brief): ≤4 simultaneous meanings, ≤3 competing bright elements, exactly 1 amber meaning per screen, story marks ≥3:1 luminance over the locally-summed field, no silent key or grain changes.

### Scene directives

**KEEP** (blind read matched; polish only):
- **s02 — KEEP.** Message: "asleep for a year, then the eruption." The shape already tells it. Fix the five text collisions, give the grey ground a faint visible presence, label the dotted event line, and pin the thickness legend outside the spike's path.
- **s05 — KEEP.** Message: "all the money goes to the head of the curve." Keep the chaos-to-curve resolve but tame b1-t0 (in-flight dots at rest opacity). Pulse the amber ad-market dot with a leader line, bracket the 414-legs/63.5% span, label the diagonal.
- **s17 — KEEP.** Message: "here is the frozen number; read it yourself." The numerals, devig lines, and timestamp already work. Dim the pillar (Tier 0.1), unclip the left devig line, thicken the underline payoff, keep the one-line provenance (fixed), add the three-way denominator note.

**SIMPLIFY** (right structure; dim/delete/sequence):
- **s01 — SIMPLIFY.** One message: "a price is a chance, and the goal repriced it." Draw the France price path as a bright labeled line over the ticks; field stays at 0.10 ground (done); one caption at a time (done); relabel the clock axis honestly; gate the settlement pour as the scrub's final onset.
- **s03 — SIMPLIFY.** One message per beat: day-one flood; two labeled towers (grow them within their own beats, values printed beneath); the counter ticking past a labeled "$7.40B press number" line (done) with a pulse at the crossing. Settle s01's residue before entry.
- **s04 — SIMPLIFY.** One message: "money trades when games are on." Kickoff bars + grid + teal windows, recolored inside b2 with a pulse; actually dim off-peak cells; the US-hours claim on its scrim (done) with the band in the key; reserve axis lanes.
- **s11 — SIMPLIFY.** One message: "three venues, one accuracy score; the one gap was a closed book." Solid-fill bars, rest band out of the chart frame, scrim under the verdict annotation, strike-through as a labeled visible event ("book was closed — unfair test").
- **s15 — SIMPLIFY.** One message: "thirteen months of the same opinion: France high, Spain low." Saturated France/Spain cohorts with a real luminance gap, model line labeled in reader words, parked mass dimmed to rest, deaths rendered as dimming, and a final pulse on Spain's surviving red.
- **s18 — SIMPLIFY.** One message: "it's yours now." Dim ground; keep the amber key row until the release completes; narrate the grain handoff; pulse two or three dots under a single "open a market" label.

**RESHAPE** (chart-first redesign; the particle field failed the blind read as sole carrier — build the labeled chart, keep particles as texture):
- **s06 — RESHAPE.** One message: "kickoff multiplied the pace 5.4x." A titled trades-per-second lane with a labeled kickoff rule and the 5.4x step annotated; YES/NO as two luminance-separated margin bands; unique hour ticks; the blizzard dimmed to backdrop.
- **s07 — RESHAPE.** One message: "three venues answered one goal at three speeds." Three labeled lanes as connected price paths on a shared, labeled price axis; no tournament rest field; one lane event per beat (goal pulse → grey gap bracket → purple minute chain → amber held-band on a scrim).
- **s08 — RESHAPE.** One message: "one ticket died at the whistle; its sibling kept trading." Two labeled price lines drawn progressively with the scrub, splitting at a pre-cued 90' rule; domain includes the 48→1 slide; field to ground.
- **s09 — RESHAPE.** One message: "upsets repriced the board in minutes." Y-axis in multiples of pre-shock price; three labeled jump traces as luminance singletons with onset pulses; persistent risen/fallen end states; no key churn.
- **s10 — RESHAPE.** One message: "two crowds, one price." Plot the gap line hugging zero inside a shaded 5-point band it never leaves; sixteen suspension pulses in sequence on the Pinnacle lane; retire the absolute-price spaghetti and the un-keyed columns.
- **s12 — RESHAPE.** One message: "same goals, different prices — the tiebreak." Four small-multiple price lines with direct 61c/31c labels at the compared moment; animate the July 7-8 crossover and Kane's halving; rest field confined to a dim backdrop band.
- **s13 — RESHAPE.** One message per beat, two figures max: solid outline poll bar vs bright money column, both directly labeled (87% / 11c); b3 as four labeled columns with model-price ticks; b4 as a visible drain to a darker settled state; scrims under every on-field number.
- **s14 — RESHAPE.** One message: "well priced in the middle, wrong at both ends." Keep the b1 morph; add an inset magnifier for the 0-10c corner where the story lives; ghost the count-weighted line under the dollar-weighted one; ring and pulse the 93c bucket with its label unclipped; visual weight proportional to sample size.
- **s16 — RESHAPE.** One message: "five skills, five charts you have already read." Each recap panel is a static miniature of its parent scene's FIXED chart (trace pair, calibration line, jump-and-hold path, 87%-vs-11c bars, France/Spain checkpoint chart), with header/key/geometry swapped in sync and staged morphs (ground first, story subset second). Fix the l2 slope inversion before anything else.

Sequencing recommendation: **(1)** Tier 0.1 engine cap (it alone re-scores s06-s18's worst failures), **(2)** the six SIMPLIFY scenes, **(3)** the nine RESHAPE scenes in story-importance order (s10, s08, s07, s14, s13, s06, s09, s12, s16), **(4)** the Tier 2/3 sweep, then a full re-run of this same two-pass blind audit as the acceptance test: the piece passes when a blind reader's one-sentence story matches the intended one in ≥15 of 18 scenes.

---

## 6. Fixes applied in this pass (scene-file scope only)

Per the pass constraints (label/wording/alpha/dimming under `docs/js/scenes/` and `docs/js/main.js`; no reshape-level changes), all syntax-checked:

| # | Scene | Issue (severity) | Change | File |
|---|---|---|---|---|
| 1 | s01 | Caption collision at top-center (C) | Both narration captions share one lane 34px above the stage, clear of the axis title, and are sequenced so at most one is visible | `docs/js/scenes/s01.js` |
| 2 | s01 | Un-keyed near-white column dominating every frame (C) | In-zoom resting field dropped from 0.40 to 0.10 alpha so the resting ribbon renders as dim grey ground and the key's "grey = money at rest" is true. Partial: the tick stream's own leading-edge cluster still blooms white (active-tier mass) and waits on the Tier 0.1 engine cap | `docs/js/scenes/s01.js` |
| 3 | s03 | $7.4B crossing visually mute (C, label half) | Press-floor line now labeled "$7.40B: the press number, about one week stale," anchored at the line's left end, clear of the KEY panel | `docs/js/scenes/s03.js` |
| 4 | s04 | Headline amber annotation invisible on bloom (C) | bg-canvas scrim (getBBox-sized) behind the "US waking hours" label; band group switched to visibility toggling | `docs/js/scenes/s04.js` |
| 5 | s13 | "7.000000000000001% poll" rendered verbatim (M, wording) | Poll labels round to one decimal | `docs/js/scenes/s13.js` |
| 6 | s08 + all zoom scenes | "every 243th" ordinal (m, wording) | Grain formatter substitutes the whole `{n}th` unit with the correct ordinal (243rd, 132nd, 101st) | `docs/js/main.js` |
| 7 | s17 | Six-line PROVISIONAL pipeline caption at ceremony center (M, wording) | Provenance always renders the short reader-facing sentence; full pipeline string stays in the manifest/methods | `docs/js/scenes/s17.js` |
| 8 | — | Harness: no scene filter | `--scenes s01,s03,...` flag added for targeted re-captures | `pipeline/review/capture_walkthrough.py` |

Items 5-7 are severity-major/minor wording defects fixed opportunistically because they were unambiguous, zero-risk, and named in the reviews; every other major and minor waits for the doctrine pass. All other criticals are deferred (§3 Tier 0 and Tier 1) — the plurality of them collapse into the one engine-level tone-map decision that belongs to the author.

**Re-capture verification (this pass):** scenes s01, s03, s04, s08, s13, s17 were re-captured with the new `--scenes` filter (39/39 shots passed the guard; `research/design-review/screens/index.json` merged back to the full 18-scene record). Confirmed by reading the new frames: s01 shows one caption per frame and a dim grey rest ribbon (residual white column = active tick mass, Tier 0.1); s03-b3 shows "$7.40B: the press number, about one week stale" legible at the line's left end; s04-b3 shows the US-waking-hours label legible on its scrim; s08's grain chip reads "every 243rd of 156,819 trades"; s13-b2 reads "7% poll"; s17's caption is the short reader-facing line with legible devig percentages.
