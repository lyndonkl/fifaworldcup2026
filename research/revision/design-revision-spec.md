# Design revision spec — merged, single source of truth

*"Regulation Time" (fifaworldcup2026) · merges the four revision lenses (A: salience/brightness budget; B: color key + labeling; C: spacing/placement zones; D: motion/animation) into one coherent spec.*
*Inputs: CLAUDE.md, research/storyboard.md, research/findings-dossier.md (corrected claims only), research/design-system.md, research/revision/perception-brief.md, docs/design/tokens.css, docs/index.html, docs/js/main.js, docs/js/scenes/s01.js–s18.js.*
*Date: 2026-07-19 (pre-publish revision pass).*

**Hard constraints honored throughout.** The visual machinery (layouts, tiles, engine) is built and is NOT rebuilt: every directive below is a recolor to an existing token, a deletion of an overlay mark, a re-timing of visibility per step, a CSS placement value, a label/caption/prose rewrite, or a sequencing parameter inside existing scene modules. The market-as-protagonist spine, scene order, and the S17 ending (tonight's frozen Spain 58.8c / Argentina 42.0c read through the piece's learned lenses) are untouched. No political content. Register: strategist voice, accessible — plain words, short sentences, Flesch-Kincaid grade <= 9 per beat, no em dashes anywhere (including inside labels; spaced hyphens acting as dashes are rewritten with colons or commas).

**How to apply.** Section 1 is global (index.html, main.js, tokens). Section 2 is per-scene, applied verbatim by the scene rewriter. Section 3 is the token diff. Section 0 records every cross-lens conflict and its resolution; where a per-scene directive below differs from a lens's original text, Section 0 is why.

---

## 0. Conflict resolutions (each stated once, binding)

- **CR-1 · Amber hex.** The lenses cite `#FFC94D`; the live token is `#CCA13E` (already darkened per perception-brief §9a/§10.5, see tokens.css header). Resolution: every directive references `accent.annotation` by token name; no color value changes in this spec.
- **CR-2 · Key placement.** Lens B moves the color key to the viewport top band; Lens C kept `#chip` bottom-right and built its exclusion rect there. Resolution: **Lens B wins on desktop** (top-right, forming one apparatus band with the grain plate at top-left; legend consulted inside the eye's top-band scan path). The exclusion rect moves with it (KEY RECT, top-right). **Mobile stays bottom-right above the prose sheet** (both lenses agree there). In-stage top-right items (S3 counter, S10 count chip) must clear the KEY RECT by >= `--space-16`; S10's separate venue-key panel is absorbed into the global key (its on-chart direct labels stay, per Lens A).
- **CR-3 · Chip API vs chip templates.** Lens B's structured `setChip(rows)` wins over Lens C's one-line string template. Lens C's grammar becomes the per-row label format; Lens A's 9-word cap applies per row label.
- **CR-4 · Caption caps.** Token `--layout-max-pinned-captions-per-step: 1` (Lens C's Zone K, one occupant per step) and Lens A's "two visible" reconcile as: at most ONE new pinned caption per step; at most TWO visible per frame counting a decayed predecessor (the older at ink-low / reduced opacity); a third arrival removes the oldest.
- **CR-5 · Do key swatches spend the amber/bright budget?** No. Key rows, the grain plate, and axis apparatus sit on scrimmed micro-scale plates and are exempt from the bright-unit and amber-singleton counts. The budgets govern Zone S/K/F elements only.
- **CR-6 · S7 race caption wording.** Lens A's 9-word version wins (label diet): "Three lanes, three native speeds. This is not a race." Placement per Lens C (Zone K).
- **CR-7 · S7 lane labels.** Lens C's left-gutter position + Lens B's descriptors, minus Lens B's "(dark = not quoting)" parenthetical — that meaning is taught by the in-block label and the key.
- **CR-8 · S8 decay/goal-jump annotation.** Both lenses agree it is ONE two-line block. Wording from Lens A (line 1 amber, line 2 ink-mid); placement and leader from Lens C.
- **CR-9 · S9 mirror caption.** Lens A deletes all four S9 ambers, so Lens C's "two amber items" ceiling is moot; Lens C's sequencing stays (bracket annotations clear before the mirror). Caption wording is Lens A's: "Norway rises as Argentina falls. One bracket, one sum." — which keeps the Gate-3 requirement (design-system §9 S9: the "why" ships as caption text at the mirror step) in compressed form; the expanded "neither market was copying the other" clause moves into b3 beat prose.
- **CR-10 · S10 count-chip wording.** Lens C's 8-word "16 of 16 start at Pinnacle's last quote." wins over Lens D's 10-word version. Timing from Lens D (bound to the 16 x 90ms cascade, then a >= 1200ms held stillness); visibility from Lens A (renders only during b3).
- **CR-11 · S12 caption pair.** Lens C's in-place rewrite wins over Lens A's "THE RESOLUTION": label "the naive read" becomes "the resolved read"; question "Same goals, double the price?" becomes "Different futures, different price." Colors from Lens A (naive label ink-low; resolved label ink-mid; question line ink-hi). Timing from Lens D (recolor completes first, then a <= 400ms text crossfade).
- **CR-12 · S13 units caption.** Lens C's wording wins: "Poll bars are agreement, not probability. The dot columns are money." It is the scene's single standing Zone K occupant (so Lens A's "exempt from the cap" and Lens C's "one occupant" coincide); Lens B's extra gloss line is dropped.
- **CR-13 · S14 toggle labels.** Lens B's self-explaining pair wins ("count every market equally" / "weight by dollars traded") because the control persists after its step; placement from Lens C (top-center over the stage).
- **CR-14 · S14 90-95c callout.** Trimmed to the 8-word annotation cap: "worst bucket: a favorite, not a longshot".
- **CR-15 · S5 deflating copy.** Merged two-line block (Lens C's one-block rule): amber line 1 "biggest ad market: rank 1,083 of 30,133"; ink-mid line 2 "lit because it is surprising, not because it is big". Em dash in the Gate-3 phrasing removed per register.
- **CR-16 · S17 amber count.** The devig line and the particle underline are one composed amber unit (same referent: the final's own price); underline alpha drops to 0.45 so white > amber stays monotonic.
- **CR-17 · Overlay order.** Global rule: overlays wait for dots. S16 is the single licensed inversion (lockup first, as the pre-cue), per Lens D.
- **CR-18 · S1 opening amber.** Lens A keeps the pre-title amber dots as the frame's singleton; Lens D forbids pre-lighting them at boot. Resolution: first paint is all-rest; the amber light-up fires as ONE announced tween after the header cue line. The whistle annotation is demoted to plain ink-mid text (Lens A), placed with the mirrored leader (Lens C).
- **CR-19 · Jargon ban vs "devigged".** "taker", "notional", "matched volume", "vermillion", "de-vigged"-style spellings are banned from all reader-facing labels. "devigged" is the ONE licensed apparatus term (integrity FIX #3) and must carry the gloss "(bookmaker's cut removed)" at its first on-screen use in each scene where it appears (s11, s15, s16-L5, s17). Reader-facing color word for `side.no` is "orange", never "vermillion".
- **CR-20 · Grain templates.** Lens B's population template and Lens C's return-variant template are both kept: default population plate "1 dot = $75,000 of real money traded"; return variant "1 dot = $75,000 traded again · this is the whole tournament · it never leaves".

---

## 1. GLOBAL changes (docs/index.html, docs/js/main.js, docs/design/tokens.css)

### G1. The persistent color key (rebuild of `#chip`)

**What it is.** The micro-legend chip becomes a persistent COLOR KEY: a stacked list, one row per active color meaning, each row a rendered swatch + plain color word + meaning. This is the fix for the author's "no color coding I can look at" complaint. Recognition over recall: a swatch is matched preattentively; a color word alone forces a verbal-to-visual translation.

**Placement (CR-2).**
- Desktop: `position: fixed; right: var(--space-24); top: var(--space-24);` — one apparatus band with the grain plate at top-left.
- Mobile: `right: var(--space-16); bottom: calc(var(--layout-card-max-height-mobile-vh) + var(--space-8));` (above the prose sheet), rows wrapping to one line when more than two.
- Container keeps the existing chip treatment: `rgba(16,21,29,0.82)` bg, 8px backdrop blur, 1px `rgba(124,135,148,0.25)` border, radius `var(--space-4)`, padding `var(--space-8) var(--space-12)`.

**Markup.** Header row "KEY" at `var(--type-micro-size)` 12px, `var(--type-micro-tracking)`, `var(--ink-low)`. Each meaning row: swatch (see glyph vocabulary) + label at `var(--font-apparatus)`, `var(--type-caption-size)`, weight 500, `var(--ink-hi)`.

**Update API (docs/js/main.js `setChip`, lines 224–232).** `setChip(rows)` accepts an array of `{token, glyph, label}`:
- `token`: a tokens.css color name (`side-yes`, `identity-blue`, `state-dead`, `field-rest`, `accent-annotation`, …) rendered at alpha 1.0 with a 1px `rgba(124,135,148,0.4)` ring (rest/dim/dead swatches render at their state alpha).
- `glyph` (glyph-true swatches; the key must reproduce the mark, never default to a dot): `dot` 10px filled circle = money dots · `line` 12px horizontal segment = D3 price/model lines · `dash` 8px dash = Pinnacle requotes · `block` 12x8px solid rectangle = Polymarket minutes · `box` 12x8px outline-only rectangle = non-money D3 marks (Brier columns, poll bars) · `ramp` 3-step luminance ramp = brightness-means-density (S4 b1) · `dim` dot at rest alpha = the resting field · `dead` dot in `state-dead` = settled money. The filled-means-money / outline-means-derived grammar is thereby visible in the key itself.
- `label`: <= 9 words, plain words, format "[color word] = [plain meaning]".
- Cap: at most 3 meaning rows + 1 standing row per beat (working-memory 4+/-1).
- Every `beat.chip` in every scene module is rewritten from a bare string to this array shape (per-scene rows in Section 2).

**Standing rows (always last).** Wherever the resting or dimmed population is on screen (s01–s16): `{token:'field-rest', glyph:'dim', label:'grey = money at rest, the whole tournament'}`. Wherever `state.dead` dots are on screen (s01 settle, s11 strike, s15 drain): replace with `{token:'state-dead', glyph:'dead', label:'grey = settled to zero, dead money'}`. (Visibility of system status: the largest ink mass on screen is never unexplained; `state.dead`'s sub-3:1 contrast is WCAG-conformant only with a paired label.)

**Timing.** The key's text swap and its 1.2s pulse (`--dur-chip-pulse`) fire at t=0 of the color-meaning tween, never at tween end; outgoing/incoming rows crossfade over 500ms (`--dur-recolor-min`). Never swap key text without the pulse. The key debuts on S1's pre-title frame (remove the current visibility gate), and never disappears after.

**Budget status (CR-5).** Key swatches do not count against the bright-unit or amber budgets.

### G2. Grain plate rules

- **No-inheritance rule.** Every scene's first beat MUST set `grain` explicitly; `activateBeat()` (main.js ~line 434) warns in dev when a beat activates with a plate inherited from another scene. Add grain entries to s03, s04, s05, s11, s12, s13, s14, s15, s16, s17, s18 (all currently missing — including S12's live falsehood, which today displays S10's "one mark here is one minute of matched price" over the boot ladder: the one CRITICAL integrity defect in this spec).
- **Templates.** Population scenes (s03, s04, s05, s09, s12, s13, s14, s15, s16): "1 dot = $75,000 of real money traded" (mobile slot $250,000; return variant per CR-20). D3-mark scenes: s10 keeps its built text (the model for this class); s11 = "the dots rest · each column is an accuracy score, not money"; s17 = "dots at rest · the lit dots underline tonight's price"; s18 = filled at pick time with the selected market's own grammar.
- **Zoom plates name their match and date, always.** s01: "1 dot = 1 trade · showing every {n}th of {count} trades · France-Spain, July 14". s06: "… · Mexico-England, [date slot from manifest]". s07: "… · Norway-Brazil, [date slot]". s08: "… · Germany-Paraguay, June 29". Wire `zoomGrainText()` into `activateBeat()` for zoom scenes so `{n}`/`{count}` always resolve (flagged TODO in s01.js).
- **Jargon fix.** docs/index.html line 331: the default plate "of matched volume" becomes "of real money traded". Same fix in s09 b1's grain entry.
- **Geometry.** Clamp `#grain-plate` desktop `max-width` to `min(72ch, calc(36vw - var(--space-48)))` so the plate never crosses `region.x` into the caption slot. Mobile plate caps at two lines.

### G3. Axis-label standard (every D3 axis, every scene)

- **X title:** centered beneath the tick labels, offset `var(--space-24)` below the axis line. **Y title: HORIZONTAL, never rotated**, left-aligned over its axis, `var(--space-12)` above the topmost tick (generalizing s11's existing "Brier score" placement). One licensed rotated label piece-wide: S14's "perfectly priced" along the diagonal, because it names the line itself.
- **Style:** `var(--font-apparatus)`, `var(--type-caption-size)`, weight 500, fill `var(--ink-mid)`.
- **Wording template:** "[what it measures] ([unit])", <= 7 words before the parenthesis; tick rows keep their unit symbol too (cents sign, %, h, minutes mark, x, $).
- **Mobile:** same tokens; titles wrap at 40ch, never dropped. **Every bottom x-axis on mobile renders as `d3.axisTop` translated to `y = region.y + region.h`** so tick labels sit above the line, inside the stage — the mobile stage bottom (0.62H) abuts the 38vh prose sheet, and labels drawn below the stage are occluded (applies to s01, s02, s03, s06, s07, s08, s09, s10, s12, s13, s15).
- **Missing apparatus to add:** s05 has no axes at all (Lorenz axes were a storyboard commitment); s09 has no y-axis; s12 has no y-axis; s16 owes one "unit ribbon" per lens (Section 2). If a tick label would enter a no-fly rect (G5), drop that label and keep the tick.

### G4. Brightness budget and the amber singleton

- **Bright-element budget: THREE units per frame.** A bright unit is any of: (a) one particle subset at active tier (alpha >= 0.90, engine-boosted); (b) one amber overlay unit (halo + leader + label, or band + label, counts as one); (c) one ink-hero `#FFFFFF` element; (d) one saturated D3 line/column group at full opacity. Everything else sits at dimmed-field tier (alpha <= `--dot-opacity-dimmed-field-max` 0.40) or is typeset in `ink-mid` / `ink-low`. Licensed exceptions, 4 units: S7 (three venue lanes) and S12-b2 (three player hues) — hue is redundant with lane region there. The rewriter counts units per beat before and after every change.
- **Amber is a true singleton: at most ONE amber unit per beat, always marking the current beat's story point.** All other amber usages are demoted to ink-mid or deleted. When a new amber unit lands, the previous one in the same frame transitions to ink-mid in the same 500–600ms recolor. Amber is never used for: persistent lane labels, caption category labels, running meters, or anything that persists across more than one step.
- **One-change-per-step with emphasis decay.** Each scroll step may ADD exactly one bright unit; when it appears, every overlay element introduced by earlier steps of the same scene drops one tier (amber -> ink-mid, ink-mid -> ink-low, full-alpha line -> 0.6 opacity). Implement as a per-scene `demote()` pass in each overlay `step()` handler; the demotion rides the same tween batch as the new unit's entrance (one motion event, per G6). Pinned captions per CR-4.
- **Dim the ground, never brighten the figure.** Every scene's non-story population must land in the engine's rest-classify band (alpha <= 0.42) so the shader dims it — the dimCeil pattern s01/s16 already use. Audit s02–s15 layouts for any non-story subset left in the unclassified 0.42–0.90 band and clamp it to 0.40. Specific fix: S1's 3-way companion streams (s01.js ~line 322, alpha 0.5) drop to 0.40.
- **Label diet.** Annotation labels <= 8 words; pinned captions <= 14 words; key rows and chips <= 9 words. Templates, applied verbatim: annotation = "[event]: [number] [plain unit]"; demoted reference label = "[name] (for reference)"; a decayed prior-step caption keeps its text, only color/opacity change. Banned in labels (CR-19): "taker", "notional", "matched volume", "de-vigged" spellings, "vermillion". No em dashes.
- **Luminance hierarchy is monotonic:** white (`ink.hero`) > amber > ink-hi > ink-mid > ink-low, in every frame that contains more than one of them.

### G5. Placement zones and spacing floors

- **Four-zone map, identical in every scene.** ZONE K (caption slot): one strip above the stage, block top at `region.y - 40px` (token: `--layout-caption-slot-top-offset-px`), baseline `region.y - var(--space-16)`, left-aligned to `region.x`; holds at most one pinned caption per step (plus S16's lockup pair). ZONE S (stage = `view.region`): data marks, at-mark annotations, direct labels only; no floating explanatory text unless leader-attached to a mark. ZONE F (footer strip): one row at `region.y + region.h + var(--space-32)` desktop (token: `--layout-footer-slot-offset-px`), left-aligned to `region.x`; receipts, footnote chips, meters, small-n caveats; max two items per step, >= `var(--space-48)` apart. ZONE R: the left 36vw reading rail, prose cards only. Fixed furniture: `#grain-plate` viewport top-left; the KEY top-right (desktop) per G1.
- **Alignment.** Left-align every Zone K caption, S16 lockup, and Zone F item to `region.x`; the page has two scan anchors (rail-card left edge, stage left edge), and reading order per step is rail card -> Zone K -> marks -> Zone F. Right-aligned slots are terminal items only: the key, S3's counter, S10's count chip, S14's toggle right label.
- **Spacing floors.** Text block to text block >= `--space-16` desktop / `--space-12` mobile; any text block to nearest data mark >= `--space-24` (exception: at-mark labels with the 8px leader standoff); tick labels to any caption >= `--space-12`; two annotation labels >= `--space-24` apart, max `--layout-max-annotations-per-step` 2 per step; within-group gap <= one third of between-group gap.
- **No-fly rects.** PLATE RECT: viewport top-left, plate rendered width + `--space-24` wide, height + `--space-24` tall. KEY RECT (CR-2): viewport top-right, `--layout-key-exclusion-w-px` 280 x `--layout-key-exclusion-h-px` 132 desktop; 280 x `--layout-key-exclusion-h-mobile-px` 56 anchored above the mobile sheet. No scene-placed element may intersect either; in-stage top-right items start at KEY RECT bottom + `--space-16`.
- **Card clamp.** `.card { width: min(var(--layout-card-width-desktop-px), calc(36vw - var(--layout-card-inset-desktop-px) - var(--space-32))); }` — guarantees a >= 32px gutter between card edge and stage edge at every width (today it is 2px at 1280px).
- **Mobile Zone K/F.** No scene text above `region.y` on mobile. Caption slot: `left: var(--space-16)`, `top: calc(var(--space-16) + 44px + var(--space-12))` (below a two-line-capped plate), `max-width: calc(100vw - 2*var(--space-16) - 72px)`. Zone F: `bottom: calc(var(--layout-card-max-height-mobile-vh)*1vh + var(--space-8))`, `left: var(--space-16)`, max-width 50vw; the key owns the same band on the right.
- **At-mark labels.** Default `dx = +24, dy = -28`; mirror (`dx = -24`, `text-anchor: end`) if the label's right edge would cross `region.x + region.w - 120px`; if two labels in one step would come within `--space-24`, move the later one to the opposite vertical side of its mark.
- **Amber type never sits inline with, or within `--space-16` of, ink-hi text.** Any amber label over a dense particle region carries the chip scrim (bg-card at 0.82, 8px blur, padding `--space-4 --space-8`) — placement and local ground, not hue, are the fix (perception brief §9a).

### G6. Motion budget

- **Stillness is the default.** Outside an actively tweening beat: zero animation. No idle loops, ambient drift, repeating pulses, or ticking counters. Any rAF work that changes visible pixels while scroll velocity is zero and no tween is active is a bug. Every beat's end state is a frozen frame; the only persistent motion is direct response to the reader's own scrub.
- **One motion event per beat.** A motion event = one tween batch, one easing token, one stagger window; dots + D3 marks bound to the same data change count as one. Beats with two meanings moving (S15 b3, S9 b3) split into sequenced events separated by >= `--dur-stillness-gap` (400ms) stillness, each with its own pre-cue. Never fire a re-sort and a recolor in the same step, anywhere.
- **Pre-announce every dot motion.** The pre-cue lives in the CLOSING sentence of the previous beat (scene-first beats: a standing sub-line under the kicker). Template, <= 10 words, present tense, plain words: "Next, watch the [color] [dots|line|column] [location clause]." The color word must match the key row verbatim. The triggering beat's first sentence names the result. Location-only variant (withheld reveals): "Keep your eye on [location]."
- **No silent subset changes.** Any subset whose meaning changes in place must cross the engine's alpha bands (rest <= 0.42, active >= 0.90) or exceed `--emphasis-pulse-color-epsilon` (0.05) so the shader onset pulse fires. Exemption: full-field recolors (S4 b3) — covered by pre-cue + key pulse instead.
- **Overlays wait for dots.** On `kind:'resort'` beats, overlay entries delay until the dot tween completes (>= 1700ms; ceremonial 2600ms), then enter one at a time (`--dur-overlay-draw-in`, `--dur-overlay-stagger`, 8px fade-rise, max 10 sequenced). Sole exception: S16 (CR-17).
- **Closed motion vocabulary, five verbs:** re-sort (`--ease-move`, 1700/1800ms), emission (scrub-bound only), pour/settle (`--ease-fall`, hue drains to `state.dead` in the same tween, no bounce), recolor (500–600ms, zero position change), ceremonial (<= 2600ms, S15 b3 and S17 b1 only). Anything else is cut. No overshoot easing on data positions.
- **Numbers do not animate,** except S3's dollar counter, which ticks only while its dots stream and freezes the instant they rest (one common-fate event). S17's hero price and devig line never count up (a counting number prints false prices).
- **Reduced-motion truth condition.** Every pre-cue and motion caption is a state statement that stays true across a 400ms crossfade ("France's blue column drains to grey next"), never motion narration. Pre-cues ship identically in both modes; every event resolves to a static end state carrying the full meaning.
- **Scene-type budgets.** Scrub scenes (s01, s02, s06, s08): dot motion is a pure function of scroll position; prose order inside each scrub beat is isomorphic to scroll-event order (color taught before the first colored tick, the goal clause before the goal dwell, the pour clause before the settlement region). Step re-sort scenes (s03, s04, s05, s09, s13, s15-b1): exactly one re-sort per step, never re-sort + recolor together, one amber annotation per step, chained pre-cues. Rest-field scenes (s10, s11): the population never tweens (narrated once at S10 b1); one D3 overlay event per step. Coda (s18): user-driven only.

### G7. Build-time lint (extend `docs/design/validate_tokens.py` or a sibling pre-deploy script)

Fail the build if: (a) any scene overlay creates an axis group without a sibling title text node; (b) any scene's first beat lacks an explicit `grain` entry; (c) any `beat.chip` is a bare string instead of the `{token, glyph, label}` array; (d) any reader-facing label contains "taker side", "matched volume", "matched notional", or "vermillion". Motion audit flags (report, not fail): any beat firing two tween batches; any overlay transition starting before its beat's dot tween completes; any subset color delta below `--emphasis-pulse-color-epsilon`; any beat lacking a pre-cue sentence in its predecessor.

---

## 2. Per-scene directives (s01–s18), applied verbatim

Format per scene: type · the ONE thing the eye lands on first · bright-unit ledger at each step's end state · concrete edits.

### S1 · "Ninety minutes in Arlington" — zoom tick-stream (scrub)

**The ONE thing:** the hero France-winner stream repricing at the goal. **Bright units:** hero cyan/orange stream (1) + amber goal annotation (2) + at the end the settlement pour (3, drawn in `state.dead` against a dimmed field — the terminal focal event needs no amber escort).

1. **Boot/pre-title (CR-18).** First paint renders EVERY dot at `field.rest` — remove the amber pre-light in `makeResting()`. After the census line, the header gains one cue line: "Watch the right edge. The amber dots are tonight's match, France against Spain." The amber light-up then fires as one announced color tween crossing the active band (alpha >= 0.90, onset pulse fires). Retime the caption "the lit dots: tonight, France-Spain · one dot is one trade" to be visible at t=0 with kf0, not fading in at t > 0.005.
2. **Key debut.** Pre-title rows: `[{token:'accent-annotation', glyph:'dot', label:"amber = tonight's match, France v Spain"}, rest-row]`. At the zoom: `[{token:'side-yes', glyph:'dot', label:'cyan = money that bet YES'}, {token:'side-no', glyph:'dot', label:'orange = money that bet NO'}, rest-row]`. At the settle step the rest row swaps to the dead row. Retire "vermillion" from the current chip text.
3. **Companion streams.** The 3-way companion streams drop from alpha 0.5 to 0.40 (s01.js ~line 322) so they land in the shader's rest band. One transient caption at their first appearance, `type-caption-size` ink-mid: "fainter streams: the match's own win / draw / lose legs".
4. **Whistle annotation.** DELETE the amber halo, white core, and amber leader on `whistleAnn` (s01.js makeAnnotation usage, ~lines 459/497–505); replace with plain text "the whistle" in ink-mid at the same coordinates, mirrored leader (`dx = -24`, anchor end — it lands near the right edge), >= `--space-24` vertically from "the goal". The settle line stays ink-low dashed. The goal annotation is the scrub's single amber unit.
5. **Pre-cues in beat prose (scrub isomorphism).** Insert before the settlement explanation: "Watch for the one vertical jump: the goal."
6. **Axes.** x = "match clock (minutes played)"; y = "price of the France contract (cents; 100 = certain)".
7. **Title header (ceremony).** One centered column, max-width 60ch; order: grain-plate banner, census caption, title, deck; gaps `--space-24` banner-to-caption, `--space-48` caption-to-title, `--space-16` title-to-deck. The banner uses the exact `#grain-plate` style so the plate's later fixed appearance reads as the same object returning.
8. **Mobile.** `.s01-footer-legend` moves from `bottom: 0` (inside the sheet band) to mobile Zone F (`bottom: calc(var(--layout-card-max-height-mobile-vh)*1vh + var(--space-8))`, `left: var(--space-16)`, max-width 50vw).

### S2 · "Thirteen months, asleep" — population re-sort field (scrub)

**The ONE thing:** the empty year — the shape of the ribbon itself. **Bright units:** the ribbon's density (1) + one amber unit (2).

1. **Amber assignment (derived from the population-scene standing rule: one amber on the single shape feature the beat names, LAST to appear).** The June 11 wall label is the scene's amber unit, appearing only at the withheld reveal. "December 5: the twitch", "you are here" (July 14) in ink-mid; "the final" (July 19) ink-low.
2. **Withholding + cue (Lens D).** The last visible caption before the final scroll increment ends: "Keep your eye on the far right." Do not name the wall before it appears. The re-merge of S1's tick dots stays one narrated re-sort; grain plate updates to the return variant (CR-20) at tween start.
3. **Placement.** All timeline annotations sit above the ribbon with the 8px leader standoff, never on it. "you are here" and "the final" >= `--space-48` apart; where they crowd, split above/below the ribbon. The June 11 wall label sits LEFT of the wall (`text-anchor: end`).
4. **Axis + direct label.** Time axis title: "from listing to the final (May 2025 to July 2026)". One stack-direction label at the ribbon's thickest point, ink-mid: "thicker = more money that day".
5. **Key rows:** `[cyan dot 'cyan = the tournament-winner book', dim dot 'grey = every other market', rest-row]`.

### S3 · "The flood" — population re-sort field (steps)

**The ONE thing:** the crossover. **Bright units:** teal + lavender family columns (the two licensed data hues, both active tier) + one amber unit on step 2 only.

1. **Counter.** Numerals in ink-hi `#E8ECF1` (Inter tabular), NOT amber (motion already owns attention; do not double it with the reserved hue). Move it off the x-axis labels (s03.js ~340–342) to the stage's top-right: right-aligned at `region.x + region.w - var(--space-24)`, top = max(`region.y + var(--space-24)`, KEY RECT bottom + `--space-16`). It ticks only while dots stream and freezes when they rest (one common-fate event per step).
2. **Amber.** The crossover annotation (s03.js ~329–334) is the scene's one amber unit, on step 2 only; on step 3 it decays to ink-mid so the counter's tick past the dashed ink-mid press-floor marker is the sole change.
3. **Press-floor line.** Label "press floor, about one week stale", right-aligned to the line's right end, `--space-8` above it, >= `--space-16` below the counter block.
4. **Pre-cues.** b2 closes: "Next, watch the counter pass the grey dashed line." b3 opens: "The counter just passed the press number and kept climbing."
5. **Axes.** x = "tournament days (date)"; y = "total traded so far (dollars)".
6. **Key rows:** `[teal dot 'teal = bets on the tournament winner', lavender dot 'lavender = bets on single matches', rest-row]`. **Grain (new entry, b1):** population template.

### S4 · "The tournament's clock" — population re-sort field (steps)

**The ONE thing:** the recolor (the grid changing meaning). Channel sequencing stays exactly as built (brightness assemble, kickoff strip, constant-luminance teal recolor). **Bright units at final step:** teal in-window dots (1) + amber band unit (2).

1. **Amber.** The waking-hours band + label (s04.js ~229–239) is the scene's one amber unit: band fill amber at 0.10 opacity, stroke none, label amber, rewritten: "US waking hours: about twice the schedule alone". Kickoff strip and rest-day annotations stay neutral-data / ink-mid.
2. **Placement.** The kickoff strip is a bounded band above the grid: `--space-16` clear between strip bottom and grid top; strip axis label `--space-8` above the strip. The band label renders inside the band, right-aligned, `--space-12` inset. Rest-day annotations live in a right gutter at `region.x + region.w + var(--space-12)`, one per row, 12px ink-mid, never over cells. Mobile: strip becomes per-row ticks; row annotations become the caption-slot text at their step.
3. **Pre-cues.** b1 closes: "Next, a strip of kickoff bars draws above the grid." b2 closes: "Next, watch the grid change color. Teal marks kickoff windows." b3 is a full-field recolor (500–600ms, zero movement, key pulse at t=0; exempt from the onset-pulse rule).
4. **Axes.** Top hour axis: "hour of day (Eastern Time)"; left axis: "tournament day (date)".
5. **Key rows.** b1: `[{token:'field-rest', glyph:'ramp', label:'brighter = more money that hour'}]` (color means nothing yet — the chip text says so today; the ramp swatch now shows it). b3: `[teal dot 'teal = money inside match windows', dim 'dim = money outside them']`. **Grain (new entry, b1):** population template.

### S5 · "Where the dollars sat" — population re-sort field (steps)

**The ONE thing:** the empty tail. **Bright units at step 3:** amber novelty unit (1) against a neutral sweep; nothing else above ink-mid.

1. **Label sequencing with decay.** Step 1: below-band chip only (ink-mid). Step 2: tail bracket + core label enter in ink-mid; below-band chip drops to ink-low. Step 3: the Trump cluster is the scene's ONLY amber unit (s05.js ~271–281); bracket and core label drop to ink-low.
2. **Deflating copy (CR-15).** One block, two lines, above-left of the singleton with a mirrored leader (the tail hugs the right edge), >= `--space-24` from the bracket label: amber line "biggest ad market: rank 1,083 of 30,133"; ink-mid line "lit because it is surprising, not because it is big". The white core + amber halo + onset pulse + this label enter in the SAME frame as one annotation event — the label may never lag the halo (temporal contiguity: an unlabelled halo reads "this is big", the opposite of the point).
3. **Below-band chip wording:** "N markets · under one dot each ($75,000) · M dollars combined" (inside the band when band height >= 20px, else `--space-8` below, left-aligned to `region.x`). The band never animates; it is present from the sweep's first frame.
4. **Axes (new — none exist).** x = "all markets, smallest to biggest (% of markets)", ticks 0/25/50/75/100%; y = "share of all the money (%)", same ticks. Equality diagonal labeled along its upper end, ink-mid: "if every market traded equally". Tail bracket label "19,640 markets, 0.36% of the money" sits `--space-8` above the bracket.
5. **Pre-cue.** b2 closes: "Next, one dot lights up deep in the thin tail."
6. **Key rows:** `[field-rest dot 'pale blue = markets, sorted by size'`, b3 adds `accent-annotation dot 'amber = the ad market, lit for surprise'`, rest-row]. **Grain (new entry, b1):** population template.

### S6 · "Anatomy of the biggest market" — zoom tick-stream (scrub)

**The ONE thing:** the arrival-rate step at kickoff. **Bright units:** cyan/orange stream (1) + amber kickoff unit (2).

1. **Merge the competing focal marks.** Keep ONE amber annotation at the kickoff line (s06.js ~257), label rewritten: "kickoff: 1 trade a second becomes 5". DELETE the separate white-core/amber-halo `drawSingleton` call, or fold it in as the kickoff annotation's plain anchor dot. Sparkline stays `neutral.data`; rate-strip labels ink-mid.
2. **Captions.** "what the tape can and cannot say about who was trading" appears only on the final step, ink-mid, as the Zone K occupant. Mobile: the metronome moves to top-right (`right: var(--space-16)`, same y as the mobile caption slot) with caption width capped so >= `--space-32` separates them (today they collide at region.y - 40 / region.y - 20). Rate strip and sparkline are separate bands (sparkline top >= `--space-16` below the strip); sparkline label "per-trade size, +15% in play" at its left end, `--space-8` above. The narrated n lives only in the grain plate, never duplicated as a caption.
3. **Pre-cue (in beat prose, before the scrub reaches it):** "At the kickoff line, watch the stream step up." The step and its annotation are the only autonomous accents; the sparkline draws scrub-bound in neutral grey.
4. **Axes.** x = "the market's last 24 hours (Eastern Time)", hh:00 tick format (currently raw numbers); rate axis title: "trades arriving (per second)".
5. **Key rows (jargon ban — current chip says "taker side"):** `[cyan dot 'cyan = money that bet YES on Mexico advancing', orange dot 'orange = money that bet NO', rest-row]`. **Grain:** zoom template naming Mexico-England + date (G2).

### S7 · "The goal, three ways" — D3 marks over resting field (steps; licensed 4-unit scene)

**The ONE thing:** the Pinnacle darkness block (the mechanism mark). Venue hues are licensed (hue redundant with lane region) and get ZERO decorative amber; every meter, key, receipt, cap is ink-mid or ink-low mono.

1. **Amber sequencing.** b1: the goal singleton (amber halo + ink-hero core) is the amber unit. b2: the darkness block appears; the singleton's core stays but its halo recolors to ink-mid. b3: Polymarket blocks + mechanism caption. b4: the friction band becomes the amber unit, stroke-only — DELETE the amber 0.12 fill (s07.js ~line 300) so the band does not wash three lanes.
2. **Caption ladder (max two above ink-low at any point).** b1: race caption, rewritten (CR-6): "Three lanes, three native speeds. This is not a race." — the Zone K occupant, visible before any lane mark appears. b2: "no longer quoting" renders INSIDE the darkness block, centered, ink-mid (it currently floats 30px above the lane); race caption drops to ink-low (stays pinned per R23, just recedes). b3: mechanism caption in Zone F, rewritten: "Kalshi keeps trading. The sportsbook stops, then reposts."; darkness caption drops to ink-low. b4: fade caption rewritten: "The spike is the price. Nothing to fade."; friction-band label inside the band at its right end: "plus or minus 2 cents: friction"; mechanism caption drops to ink-low.
3. **Lane labels (CR-7).** In a 96px left gutter inside the stage, vertically centered per lane, `--type-annotation-size` Inter 500 in each venue hue: "KALSHI · every trade", "PINNACLE · dealer quotes", "POLYMARKET · one block = one minute". No legend panel. Inter-lane gap >= `--space-24`. Mobile: lanes stack with `--space-16` gaps, labels above each lane, left-aligned.
4. **Motion (R23 in the motion channel).** b1: the post-goal marks of all three lanes appear as ONE simultaneous fade — never lane-by-lane, never swept left-to-right (onset order reads as a speed ranking, restating the prohibited race). Then one lane event per step. Pre-cues: b1 closes "Next, watch the grey lane. It goes dark."; b2 closes "Next, one grey dash returns, already at the new price."; b4's band fades in still (`--dur-overlay-draw-in`, no pulse).
5. **Axis.** x = "seconds after the goal" (+s ticks). **Key rows (glyph-true):** `[cyan dot 'one Kalshi trade', grey dash 'one Pinnacle quote', lavender block 'one Polymarket minute']`. **Grain:** zoom template naming Norway-Brazil + date.

### S8 · "Which market you watch" — zoom tick-stream (scrub); the model scene, change least

**The ONE thing:** the two paths splitting at the white whistle line. **Bright units:** cyan advancement path (1) + white whistle unit (2) + amber decay annotation (3).

1. **Whistle.** The single ink-hero whistle line + label stays the only white unit. The regulation leg keeps `state.expiring` slate — do not brighten it, and never route it through `side.no`.
2. **Merged annotation (CR-8).** ONE two-line block in the open area above the regulation leg's glide, leader to the glide midpoint, >= `--space-24` from both paths (spends one of the two annotation slots; the whistle takes the other): line 1 (amber) "settling out: never faster than 7 cents a minute"; line 2 (ink-mid) "a real goal moves 19-25 cents in 30 seconds". Lane labels stay ink-low.
3. **Motion.** Pre-cue in beat prose: "At the whistle line, watch the two paths split. One dies. One keeps trading." The 22-minute glide runs scrub-bound; per-kick shootout markers enter with the scrub, never as a self-playing cascade; markers form a strip `--space-8` below the advancement path, labels two characters max.
4. **Axes (all three currently raw numbers).** x = "match clock (minutes)"; left y = "regulation-market price (cents)"; right y = "advance-market price (cents)".
5. **Key rows:** `[cyan dot 'cyan = the advance market, still trading', state-expiring dot 'slate = the regulation market, expiring by rule', rest-row]`. **Grain:** zoom template naming Germany-Paraguay, June 29.

### S9 · "Three shocks, three arithmetics" — population re-sort field (steps)

**The ONE thing:** the mirrored paths. **Bright units at b3:** Norway blue (1) + Argentina lavender (2). **This scene has NO amber at all.**

1. **Delete all four amber usages (s09.js ~189–216).** The shock line + "shock, t=0" label become ink-mid, dasharray 1,3 (structural apparatus, same grammar as S7's kickoff line). The bracket-news verticals become ink-low dashed with ink-mid labels, rewritten: "France confirmed next" and "Spain quarterfinal set", staggered >= `--space-24` vertically, one per path.
2. **Sequencing (CR-9).** Both bracket annotations are removed BEFORE the mirror callout appears. b3 runs as two sequenced events: (1) 400ms recolor dims everything except Norway and Argentina into the dimmed-field band (Paraguay/Belgium clamped to 0.40, already built); >= 300ms stillness; (2) both series draw with bit-identical duration, delay, and easing — the lockstep timing IS the claim.
3. **Mirror caption (CR-9),** the Zone K occupant, replacing the current 24-word caption: "Norway rises as Argentina falls. One bracket, one sum." The clause "both prices moved on the same bracket math; neither market was copying the other" moves into b3 beat prose.
4. **Pre-cue.** b2 closes: "Next, watch two lines move together. One up, one down." The b1 grain-shift back to population grain updates the plate at tween start (return variant; fix "matched volume" in the existing entry).
5. **Axes (y is new).** y = "winner-market price (times its pre-shock price)", ticks x1 / x2 / x5; x = "hours after the shock".
6. **Key rows.** b1: `[teal dot "teal = Paraguay's winner market", blue dot "blue = Norway's", pink dot "pink = Belgium's"]`. b3: `[blue dot 'blue = Norway, rising', lavender dot 'lavender = Argentina, falling', rest-row]`.

### S10 · "One price, two venues" — D3 marks over resting field (steps)

**The ONE thing:** the braid reading as one line. **Bright units at b3:** the braid (1) + amber count chip (2).

1. **Demotions.** Gap meter (s10.js ~176) from ink-hi to ink-mid mono, placed in Zone F left, wording "mean gap: 0.74 points"; it resolves only after the held pause. Pinnacle live line stays `venue.pinnacle` grey; terminations stay dashed `#6B7480`. Spike flashes stay in the two venue hues; no new color.
2. **Count chip (CR-10).** The scene's amber unit, visible ONLY during b3's held pause; top-right of the stage, right-aligned at `region.x + region.w - var(--space-24)`, top = KEY RECT bottom + `--space-16`. Wording: "16 of 16 start at Pinnacle's last quote."
3. **b3 motion.** The sixteen terminations and the count are one bound event: each dashed-grey termination lands with its counter increment at ~90ms rhythm (16 x 90ms = 1440ms), then a scripted stillness hold >= 1200ms with the chip showing, before the gap meter resolves. Pre-cue closes b2: "Next, watch the grey line. It stops quoting sixteen times."
4. **Rest narration.** b1 caption (Zone K): "The dots rest here. One mark is one minute of matched price." — also announces the rest for S11. The population never tweens in S10/S11.
5. **Key (CR-2).** The global key absorbs the venue-key panel, glyph-true with line swatches: `[cyan line "Kalshi's price", lavender line "Polymarket's price", grey line "Pinnacle's price; dashed = stopped quoting", rest-row]`. The on-chart direct labels ("Kalshi" cyan, "Polymarket" lavender) at the braid stay, drawn once at annotation size.
6. **Axes.** x = "the knockout stage (date)"; y = "contract price (points; 1 point = 1 cent)". Grain plate text stays as built (the model for D3-mark scenes).

### S11 · "The verdict, and the trap" — D3 marks over resting field (steps)

**The ONE thing:** the white strike. **Bright units at b3:** white strike (1) over greyed columns; venue-hue parity columns at 0.7 opacity are context, not competition. **No amber in this scene.**

1. **Delete both amber usages.** The matched-leg line (s11.js ~168) recolors to ink-mid and becomes a direct label centered under the T-24h column group, `--space-12` below its axis labels: "matched leg for leg: 0.162 vs 0.164". The crossout cap (s11.js ~261) recolors to ink-mid: "scores a closed book against a live market, not a fair fight".
2. **The strike.** The scene's only ink-hero element, b3. When it lands, the two parity groups drop to 0.7 opacity and the T-5min columns desaturate to `state.dead` as built — one common-fate event (500ms). The three-traps receipt then fades in at footnote weight (`--dur-overlay-draw-in`, no rise, no pulse), entirely ink-low mono, right-aligned at `region.x + region.w - var(--space-24)`, vertically centered on the struck group, max-width 30ch, >= `--space-24` clear of the nearest column, same step as the crossout. Mobile: the receipt is the crossout card's footer only; do not also render the panel.
3. **Zone F.** Small-n caveat, ink-low: "84 coupled legs · effective sample: 28 matches".
4. **Axes.** x = "when the price was read", tick labels "a day out", "an hour out", "5 min out" (replacing raw category ticks); y = "error score (Brier: 0 is perfect, lower is better)", in the standard horizontal slot.
5. **Key rows (outline glyphs; first "devigged" use in scene carries the gloss):** `[cyan box 'Kalshi', lavender box 'Polymarket', grey box "Pinnacle, devigged (bookmaker's cut removed)"]`; dead row appears at the strike step. **Grain (new entry):** "the dots rest · each column is an accuracy score, not money".

### S12 · "The market was not fooled by the scoreline" — paired-comparison (steps; licensed 4-unit at b2)

**The ONE thing:** the gap between the two prices. **Bright units at b2:** three player lanes (licensed) + ONE amber unit (July 7-8 annotation).

1. **Fix the stale grain plate (CRITICAL).** New b1 grain entry: "1 dot = $75,000 of real money traded" — today the scene inherits S10's "one mark here is one minute of matched price", a false unit on screen.
2. **Caption pair (CR-11).** One Zone K block, `--space-4` between lines, rewritten IN PLACE at the resolution step (same position, new words — positional constancy is the scene's argument): b1 label "the naive read" in **ink-low** (amber on the naive frame marks the wrong claim as the story point and invites screenshotting the misleading frame; also flags to the fallacy-guard pass, see §4), question "Same goals, double the price?" in ink-hi. b2 label "the resolved read" in ink-mid, question "Different futures, different price." in ink-hi. Timing: b2's recolor completes first (500–600ms, positions frozen, onset pulse as saturation crosses the active band), then the caption swaps as a <= 400ms crossfade; never text and color changing simultaneously. b1 closes with the affordance as pre-cue: "The full-color answer is next."
3. **Annotations.** Keep amber ONLY on the July 7-8 annotation ("traded level, one goal behind" — the headline resolver). The Kane annotation loses its amber halo circle (delete s12.js ~288–293); label recolors to ink-mid, rewritten: "Kane: 120 scoreless minutes, price halved". The two annotations obey the vertical stagger rule. Assist-tiebreak chip to Zone F left. The keep-scrolling affordance sits bottom-center of the stage, `--space-16` above its edge — the scene's only centered item, so it reads as a control.
4. **Hues.** Player hues cap at three (Mbappe, Messi, Kane) + `identity.ref` grey for Haaland. Lane names in a 96px left gutter, at-lane.
5. **Axes (y is new).** x = "date (July 2026)", %b %d tick format (currently raw); y = "price of winning the Golden Boot (cents)", 4 cents-formatted ticks.
6. **Key rows:** one per contender, template "[color word] = [player]'s Golden Boot money", plus `[identity-ref dot 'grey = Haaland, eliminated (for reference)']`. If the July 16 fold trigger fires and S12 collapses into S13, the paired panel keeps the same two-event order (desaturated question, then announced full-color answer).

### S13 · "The flags and the price" — paired-comparison (steps)

**The ONE thing:** the gap between poll bar and price column. **Bright units per step:** current pair's dot column (1) + amber price label (2).

1. **Amber, one per step, on the current pair's price figure only.** b1: Argentina's "11 cents" label amber, poll-bar outline neutral. b2: USA's price label amber; the Argentina pair's amber decays to ink-mid. b3: NO amber — the ratio labels ("1.8x model odds", "1.5x model odds", s13.js ~317–324) recolor to ink-hi and the model reference line stays neutral-data, so the dot-above-line gap is the focus; model-line label "model odds" at its right end, `--space-8` above. b4: zombie chip stays ink-low.
2. **Standing caption (CR-12).** The Zone K occupant for the whole scene, ink-mid, no other pinned caption: "Poll bars are agreement, not probability. The dot columns are money."
3. **Pairing geometry.** Within-pair gap (poll bar to price column) = `--space-12`; between-country gap >= `--space-48` (3:1 proximity ratio); each country label directly above its pair, centered. Host beat: four columns with `--space-24` gaps.
4. **Zone F.** Zombie chip: "302 trades · about $2,340 · all at 1 cent or less."
5. **Scale titles at first pair.** Above the outline bar: "% of fans who said their team would win (poll)"; above the dot column: "market price (cents)"; host-panel y-axis: "price (cents)".
6. **Key rows:** `[{glyph:'box'} 'outline = what fans said (poll %)', {glyph:'dot'} 'filled = what the money said (cents)', rest-row]`. **Grain (new entry, b1):** population template. Mobile: sequential cards, the units caption pinned at each card's top.

### S14 · "The one real sin" — paired-comparison with toggle (steps); heaviest declutter in the piece

**The ONE thing:** the gap between the markers and the diagonal. **Bright units per step, never exceeding:** white diagonal (1) + one amber unit (2) + ink-hi markers (3).

1. **Recolor the realized-rate markers (integrity + clutter).** `s14-marker-path` / `s14-marker-dots` (s14.js ~212–216, currently `side.no` orange) become ink-hi outline-only: `side.no` means "no buyer" everywhere else, so the current color actively misreads as "NO money" while adding a third bright hue.
2. **Amber sequencing, one unit per step.** b1: the re-lit S5 tail dots (the constancy payoff) — riding INSIDE the assemble re-sort, not as a separate pulse event. b2: no new amber; attribution caption (72% / 55%) as one two-line Zone K block, ink-mid. b3: the toggle's active segment only, while the tail-dot amber fades with the flattening. b4: the 90-95c callout; toggle active state drops to ink-mid until interaction.
3. **Toggle (CR-13).** Centered over the stage (`left: region.x + region.w/2`, `translateX(-50%)`), `top: region.y + var(--space-16)` — the only slot clear of the callout; >= `--space-24` from any annotation. Labels: "count every market equally" / "weight by dollars traded". b3's scripted flip is ONE event: markers glide (`--ease-move`, 600ms) while the dot-emphasis re-light rides the same tween; dot size frozen. After its step the live toggle replays the identical single event per input; nothing else may move while it is live; reduced-motion gets the crossfade.
4. **Callout + bracket.** 90-95c callout at-mark where the diagonal ends top-right, mirrored leader, label LEFT of the bucket (CR-14): "worst bucket: a favorite, not a longshot". Tick-floor bracket at-mark bottom-left, ink-low: "1-2 cents: the tick floor".
5. **Pre-cue.** b2 closes: "Next, watch the sagging dots. Weighted by dollars, the sag flattens."
6. **Axes.** x = "what the price implied (cents = % chance)"; y = "how often it actually happened (%)"; diagonal labeled along the line (the one licensed rotated label): "perfectly priced". White diagonal is the scene's only ink-hero element.
7. **Key rows:** `[field-rest dot 'pale = money at each price level', accent-annotation dot 'amber = the cheap longshots that underpaid', rest-row]`. **Grain (new entry, b1):** population template.

### S15 · "Thirteen months above the line" — population re-sort field (steps); the emotional pivot, protect it

**The ONE thing:** the drain. **Bright units during the drain:** Spain crimson cluster (1) + amber settle marker (2).

1. **Amber handoff.** b2's pinned line "One opinion, read five times." is the amber unit for that step. On b3 it decays to ink-mid and amber moves to the single "July 14 · settled" marker, whose label sits below the stage axis at its x position.
2. **Common fate.** The France label (`s15-label-france`) recolors to ink-low in the SAME tween its dots drain to `state.dead` — label and dots die as one event. The Spain label stays `identity.crimson` and travels with Spain's cluster toward the right edge into S16. Direct labels "France" and "Spain" at each path's right end, `--space-8` right of the last stage cluster, in identity hues. The fall corridor stays empty during the drain.
3. **Motion (two ceremonial events).** b2 is a stillness beat (dots hold; only the pinned caption fades in), closing with the pre-cue: "Now watch France's blue column." b3: (1) France's blue dots drain to grey (`--ease-fall`, <= 2600ms, hue draining in the same tween); hold >= 600ms stillness (the emotional beat, not dead air); then (2) Spain's crimson dots brighten across the active band and drift right (`--ease-move`, 1100ms), named in the closing clause: "Spain's red dots brighten and move toward the final." Never simultaneous.
4. **Devig discipline.** The devig premium note is the single at-mark annotation, on France's mid-stage cluster, ink-mid, appearing BEFORE the drain, never during it: "+3 to +5 points above the model, devigged (bookmaker's cut removed)" (first in-scene use carries the gloss; beat copy also says "devigged premium" per FIX #3). Model-line label "the model's odds (devigged)" at the line's right end, `--space-8` above.
5. **Axes.** x = "the model's five checkpoints (stage of tournament)"; y = "market price minus model odds (percentage points, devigged)".
6. **Key rows:** `[blue dot "blue = France's money", identity-crimson dot "red = Spain's money", grey line "grey = the model's line (Opta)"]`; at the drain the France row swaps to the dead row. **Grain (new entry, b1):** population template.

### S16 · "How to read the number" — recap carousel (steps); already disciplined, protect it

**The ONE thing per lens:** the single remembered anchor mark. **Amber:** the ordinal kicker (`s16-ord`) is the only amber per lens.

1. **Anchor hygiene.** Verify each lens's non-spotlight dots stay clamped at dimCeil 0.40 (built, s16.js ~216, ~245–250); if any imported anchor's `drawAxes` emits amber marks, recolor them ink-mid in the anchor-reuse path. Chips stay as written (the "lit:" format is the piece-wide color pre-cue and fires at tween start), converted to key-row arrays mirroring each anchor's source-scene key, one to two rows only.
2. **Ordering (CR-17, the licensed inversion).** Each lens's title lockup fades in FIRST (`--dur-overlay-draw-in`) as the pre-cue, naming the habit and the remembered shape; after >= 300ms the population re-sorts into the anchor (<= 1700ms, shrinking stagger as the stride shortens); the caption renders statically at tween end. The progressive desaturation ramp rides INSIDE each re-sort tween, never as a separate recolor event.
3. **Unit ribbons (new; the storyboard's promised mini-axes).** One line under each anchor mark, `--type-micro-size` 12px, `--font-tape`, ink-mid, `--type-tape-tracking`. Verbatim: L1 "x: knockout dates / y: price (points, 1 pt = 1 cent)" · L2 "x: what the price implied (cents) / y: how often it happened (%)" · L3 "x: hours since the shock / y: price (times pre-shock)" · L4 "left: fans who said win (%) / right: market price (cents)" · L5 "x: five checkpoints / y: price minus model (pp, devigged)". L5's caption carries the devig gloss at first use (FIX #3).
4. **Placement.** Lockup pair in Zone K (ordinal baseline `region.y - 28`, title baseline `region.y - 6`, both left at `region.x`); mobile renders ordinal + title on one line in the in-stage caption slot. Each anchor renders at <= 70% of stage width and height, centered (>= 15% empty margin all sides). Caption line caps: L1-L2 two lines; L3 two lines + the one fine-print line; L4-L5 one line. `argCallout` moves from the stage's bottom edge to Zone F, one line, ink-mid.
5. **Grain (new entry, l1):** population template.

### S17 · "The number" — ceremony (single beat)

**The ONE thing:** the white hero number. **Amber (CR-16):** the devig line + particle underline are one composed unit; underline alpha drops from 0.60 to 0.45 so white > amber is unambiguous in the shareable frame.

1. **Serial order, then permanent stillness.** (1) Key fires at settle start: `[accent-annotation dot "amber = the final's own contracts", dim 'dim = the rest, at rest']`. (2) The population converges and dims to 15% while the final's dots form the underline — one ceremonial event, <= 2600ms, `--ease-move`. (3) Only after the settle completes do the hero price, devig line, timestamp, and provenance fade in (600ms), at full value, no count-up. (4) After the type lands, nothing in S17 ever animates again; the rail releases into S18 with no further motion here. Type never moves while dots move.
2. **Column layout.** One centered column, max-width 60vw: hero price pair · `--space-8` · devig line "stripped of the vig: XX.X% (bookmaker's cut removed)" · `--space-24` · the 3-way trio · `--space-32` · timestamp · `--space-4` · provenance line. The 8px gap binds devig to the hero as one unit; the 24px break separates number-unit from context-unit. Last baseline ends >= `--space-96` above the viewport bottom. Provenance and timestamp ink-mid/ink-low. Mobile identical.
3. **The frozen number itself (untouched by this spec):** tonight's Spain 58.8c / Argentina 42.0c pair, frozen + timestamped at the morning-of-final re-run, read through the five learned lenses. **Grain (new entry):** "dots at rest · the lit dots underline tonight's price". No axes; the most-shared frame carries the strictest labeling and must self-explain in a screenshot (the key's two rows are part of that frame by design).

### S18 · "The rail releases" — coda UI

**The ONE thing:** the picker. Amber for active/selected states only — exclusive selection gives at most one active amber element by construction. Cyan reserved for focus rings and the replay price line; list text ink-mid/ink-hi as built.

1. **Motion.** The scripted 800ms fade-up is the coda's only autonomous motion. After it, motion is solely direct response to input: a pick lifts that market's dots into the replay lane as one re-sort; transport scrubbing is scrub-bound; a paused replay is a frozen frame. No autoplay, no attract loop, no pulsing hints.
2. **Common region.** The coda shell is one bg-card bordered block (intro line, picker, transport) with `--space-16` internal padding; the metadata chip renders `--space-8` right of the selected row, not in a far corner.
3. **Inheritance.** Replay lanes draw titled axes from the standard templates: x = "market lifetime (date)", y = "price (cents)"; zoom scrubs reuse their source scene's titles verbatim. On pick, the key repopulates with that market's grammar (`[cyan dot 'cyan = money that bet YES', orange dot 'orange = money that bet NO']`) and the grain plate fills "1 dot = 1 trade · [market name]" or the population template per mode. Metadata chip keeps series/volume/settlement.

---

## 3. Token diffs (docs/design/tokens.css + tokens.json, regenerated via the token table; re-run validate_tokens.py after)

Seven additions, no modifications, no color changes:

| # | Token | Value | Purpose |
|---|---|---|---|
| 1 | `--layout-caption-slot-top-offset-px` | `40` | Zone K block top above `region.y` (G5) |
| 2 | `--layout-footer-slot-offset-px` | `32` | Zone F row below `region.y + region.h` (G5) |
| 3 | `--layout-key-exclusion-w-px` | `280` | KEY RECT width (G1/G5, CR-2) |
| 4 | `--layout-key-exclusion-h-px` | `132` | KEY RECT height, desktop (header + up to 4 rows + padding) |
| 5 | `--layout-key-exclusion-h-mobile-px` | `56` | KEY RECT height, mobile band |
| 6 | `--layout-max-visible-captions` | `2` | Frame-level pinned-caption ceiling (CR-4; per-step cap stays 1) |
| 7 | `--dur-stillness-gap` | `400ms` | Minimum stillness between sequenced motion events (G6) |

Non-token CSS values that live in the index.html style block (not tokenized, per Lens C): the `.card` width clamp, the `#grain-plate` max-width clamp, the key's desktop top-right / mobile bottom-right positions.

---

## 4. Gate 4 verification notes

- **Fallacy-guard flag:** S12's naive-frame amber demotion (CR-11) is an integrity fix (emphasis-anchoring on a debunked claim) and must be checked in the Gate 4 fallacy audit alongside the existing OG-image rule (share frame = resolved frame only).
- **Deletion checklist (outright removals to verify in the diff):** S1 whistle amber halo/white core/leader · S6 duplicate white-core singleton · S7 friction-band amber fill · S9 all four amber usages · S11 both amber usages · S12 Kane amber halo + amber naive-read label · S14 orange (side.no) marker recolor · S10 standalone venue-key panel (absorbed into the global key).
- **Counting rules for review screenshots:** bright units <= 3 per frame (4 only in S7 and S12-b2); amber units = exactly 1 per beat (0 in S9/S11; composed single unit in S17); pinned captions <= 2 visible, 1 new per step; annotation labels <= 8 words; captions <= 14 words; key rows <= 9 words, <= 3 meaning rows + 1 standing row.
- **Run the G7 lint and the motion audit before staging; re-run `validate_tokens.py` after the Section 3 additions.**
