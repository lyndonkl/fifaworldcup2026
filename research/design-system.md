# Design system — Gate 3

*"The Market Watched the World Cup" · fifaworldcup2026 · design authority: cognitive-design-architect*
*Build artifacts: `docs/design/tokens.css`, `docs/design/tokens.json`, `docs/design/validate_tokens.py`. Status: audit fixes applied, contrast re-validated, CSS↔JSON cross-checked (27/27 pairs pass). Date: 2026-07-15.*

## 1. Rationale

Dark regime is forced by physics and cognition together: additive point-sprite density reads as accumulated luminance, and luminance is the piece's master preattentive channel — for density, for the annotated-dot singleton, for figure/ground dimming — so the ground stays near-black (`#0B0E13`), with dark-mode reading costs paid down by off-white ink, AAA contrast on sustained prose, 400-minimum weights, short measures. Color is rationed to one narrated meaning at a time (micro-legend chip + 1.2s pulse as the change-blindness guard); amber (`accent.annotation`) is the single reserved "story points here" hue; the cyan/vermillion side pair plus a 6-hue direct-labeled identity ramp keep every scene inside the 4±1 working-memory budget. Three type families map one-to-one onto the piece's three voices (serif narrator / sans apparatus / mono tape) so text function is classified by Gestalt similarity before it's read; tabular lining numerals everywhere stop counters and prices from generating spurious motion. Layout gives the reader one stable prose home base (left rail desktop, bottom sheet mobile); motion is a reserved semantic channel with exactly three meanings (re-sort, emission, pour), capped so sorts read as legible common-fate streaming and `prefers-reduced-motion` is a native mode, not a degradation. Hierarchy is enforced by per-scene encoding budgets, the standardized grain plate as a pre-cued signal, and teach-on-first-contact labeling with no standing legends.

## 2. Palette

All hex + contrast values below are machine-verified against `docs/design/tokens.css` by `docs/design/validate_tokens.py` (§10) — not hand-copied.

| Token | Hex | vs. canvas | Usage |
|---|---|---|---|
| `bg.canvas` | `#0B0E13` | — | The ground; all particle blending targets this |
| `bg.card` | `#10151D` | — | Prose cards, chips, grain plates (translucent variant + 8px blur) |
| `bg.card-composite-cap` | `#171C24` | — | Hard cap on worst-case translucent composite over lit particles |
| `bg.end-matter` | `#0E1218` | — | Methods note, bibliography, opaque |
| `ink.hi` | `#E8ECF1` | 16.3:1 AAA | Primary prose, hero labels |
| `ink.mid` | `#A9B4C0` | 9.2:1 AAA | Captions, axis labels, secondary prose |
| `ink.low` | `#7C8794` | 5.3:1 AA | Footnote markers, provenance, receipts — footnote-weight by design, AA floor not AAA |
| `ink.hero` | `#FFFFFF` | 19.3:1 AAA | Reserved: S17 hero numerals + annotated-dot halo ring only |
| `accent.annotation` | `#FFC94D` | 12.6:1 AAA | THE single "story points here" channel. Never a data encoding |
| `side.yes` | `#59D2FE` | 11.1:1 AAA | Taker YES, taught at first contact in S1 |
| `side.no` | `#FF7A45` | 7.5:1 | Taker NO. CVD-safe opponent pair with cyan |
| `venue.kalshi` | `#59D2FE` (= side.yes) | 11.1:1 | Chip re-narrates: color = venue in S7/S10/S11 |
| `venue.polymarket` | `#C9A3FF` | 9.4:1 AAA | — |
| `venue.pinnacle` | `#9AA7B8` | 7.9:1 AAA | — |
| `venue.pinnacle` (terminated) | `#6B7480` | 4.1:1 | Dashed "no longer quoting" mark, non-text 3:1 floor |
| `neutral.data` | `#9AA7B8` | 7.9:1 AAA | Model lines, sparklines, reference marks |
| `field.rest` | `#9FB6CC` @ low alpha | — | Resting population's money tint; hue carries nothing |
| `identity.blue` (France) | `#6FA8FF` | 8.0:1 | — |
| `identity.crimson` (Spain) | `#F68388` | 7.8:1 canvas / 7.4:1 card | **FIX #5/#7 applied** — see §8 |
| `identity.teal` | `#58C9A4` | 9.5:1 | — |
| `identity.lavender` | `#C9A3FF` (= venue.polymarket) | 9.4:1 | Meanings never co-occur; chip re-narrates |
| `identity.pink` | `#FF9FB2` | 10.0:1 | — |
| `identity.ref` | `#9AA7B8` | 7.9:1 | Eliminated/reference lanes |
| `state.dead` | `#4A5462` | 2.5:1 (non-text) | Dead money recedes; documented WCAG exception — see §8 |
| `state.expiring` | `#7C8AA0` | 5.5:1 (non-text) | **NEW token, FIX #1 (S8)** — see §8 |

Identity/side/venue direct-at-mark labels are governed by the **AA 4.5:1 "any text" floor**, not the AAA caption tier (documentation clarification, FIX #5) — those labels are transient, at-mark, and read in context of the mark itself, unlike sustained prose. `identity.crimson` clears AAA anyway after its lightness nudge.

**Particle states:** `state.alive` = current narrated channel at full alpha · `state.rest` = `field.rest` tint, alpha capped so summed field luminance stays below annotation luminance · `state.dimmed-field` = rest tint at 25–40% · `state.dead` = desaturated grey, sub-3:1 by design, always paired with an `ink.mid` label · `state.settling` = hue drains to `state.dead` while position pours to zero (common fate = one event).

## 3. Typography

Three families, each a voice: **prose** = Source Serif 4 (narrator, 400/600, self-hosted OFL) · **apparatus** = Inter (axis labels, annotations, UI, counters, hero numbers, 400/500/600) · **tape** = IBM Plex Mono (grain plates, timestamps, receipts, 400/500). All self-hosted WOFF2, `font-display: swap`, ~220KB budget, zero CDN.

| Style | Size | Family / weight | Note |
|---|---|---|---|
| micro / chip / axis tick | 12px | Inter 500, +0.02em | — |
| caption / footnote | 13.5–14px | Inter 400, `ink.mid`/`ink.low` | — |
| annotation label | 15px | Inter 500 | — |
| grain plate / tape | 13px | Plex Mono 500, +0.04em | — |
| body prose | clamp(17,+0.2vw,19px) | Source Serif 4 400, lh 1.65 | 45–60ch measure |
| lede / lens caption | 22px | Source Serif 4 400 | — |
| scene kicker | 24–28px | Inter 600 | — |
| act title | clamp(32,5vw,44px) | Source Serif 4 600 | — |
| hero number (S17) | clamp(64,12vw,128px) | Inter 600, tabular lining | devig line beneath, 24px amber |

Minimum weight on dark ground is 400 (thinner strokes halate). `font-variant-numeric: tabular-nums lining-nums` on every price/counter/axis/timestamp — proportional digits would create spurious horizontal motion, and motion is reserved (§5).

## 4. Layout

4px spacing base: 4/8/12/16/24/32/48/64/96/128. Desktop: full-viewport fixed WebGL canvas + coincident SVG/HTML overlay sharing one scale registry; prose lives in a **left rail** (480px card, 48px inset) so the text↔canvas saccade loop has a stable home base; stage occupies the right ~64% with 8% margins. Ceremonial exceptions (S1, S17) center type over a full-bleed field. Mobile: fixed canvas behind, stage top ~62vh, prose as bottom-sheet cards (max-height 38vh, scrim gradient enforcing the composite cap). Z-stack: 0 canvas → 1 field-dim scrim → 2 D3 overlay → 3 prose cards → 4 chip/grain plate → 5 controls. Population scaling: desktop $75k/dot (~164k dots), mobile $250k/dot (~49k), both stated on-screen by the grain plate.

## 5. Motion

Population re-sorts: 1100ms per-dot flight, ≤600ms stagger window, ≤1700ms target / 1800ms hard cap (legible common-fate streaming, not a cut, not outlasting scroll patience). Ceremonial exception (S15 drain, S17 settle): ≤2600ms. Recolor 500–600ms, no positional change. Settlement pour: `ease.fall` to zero, hue draining to `state.dead` in the same tween, no bounce (a bounce would print a false price). Easing tokens: `ease.move` (re-sorts), `ease.arrive` (entrances), `ease.fall` (settlement) — no elastic/overshoot on any data position, ever. Scrub (scroll-locked) only where scroll = time (S1, S2, S6, S8); step-triggered (55% viewport, 10% hysteresis) everywhere else, so every step's end state is the static-readable frame. `prefers-reduced-motion` is a first-class mode: re-sorts → 400ms crossfade, scrubs → stepped keyframe crossfades, counters → immediate value + fade — every scene already owes a static end state, so this is "end states plus crossfades," not a degradation.

## 6. Hierarchy & encoding rules

One color meaning active at a time; the fixed micro-legend chip states it and pulses 1.2s on every change. Team/player identity (WHO) vs. semantic state (MECHANISM) never share a frame; transitions always pass through the rest tint. Emphasis stack, strongest first: motion onset → luminance singleton (white core + amber halo) → amber annotation type → hue → position — **max two deployed simultaneously**. No standing legends; every encoding is direct-labeled at the mark on debut. Dots mean money and only money; derived quantities (Brier columns, poll bars, sparklines) are D3 marks, never dots, and non-money marks render **outline-only** so filled-vs-outline is the piece's "dots are money" unit grammar. Zero-baselined columns always; any non-zero-anchored price axis prints its range and draws a break marker. **Integrity addition (FIX #3):** any market-vs-baseline comparison that depends on removing vig must carry an explicit **"devigged"** qualifier in the beat copy itself, not only in overlay annotation text — matches S17's provenance-line discipline; applies to S15 and S16 L5 (see §8, §9).

## 7. Density tone-mapping *(new section — closes systemic FIX #4)*

The palette's physics claim — density reads as accumulated luminance — was previously undocumented as a *quantitative* policy, and several scenes ask it to span multiple orders of magnitude (S2: draw-week vs. match-day is ~3,400x contracts / ~21,000x dollars). Fixed-alpha additive blending clips long before spanning four orders of magnitude on an 8-bit display, and bloom radius around a small dense cluster can visually inflate its footprint relative to a sparser, larger one. Policy, now tokenized (`tokens.css`/`tokens.json` → `density.*`):

- **`density.gamma = 0.35`** — power-law compression applied to per-tile accumulated luminance before blending, so density stays ordinally legible across magnitudes instead of saturating past the first 1–2 orders.
- **`density.tileLuminanceCap = 0.92`** — hard clamp (fraction of `ink.hero` luminance); no LOD tile may out-shine the annotated-dot singleton.
- **`density.bloomRadiusPx = 3` (1x) / `4.5` (2x)** — **fixed** regardless of local dot count, decoupling apparent footprint from density.
- **`density.textRouteThresholdX = 75`** — any documented ratio beyond ~75–100x ships as an on-screen number (already true for S2's 3,400x/21,000x, S6's emission-rate) rather than relying on the visual channel alone.

## 8. Audit disposition

All 8 findings from the Gate 3 audit are folded in below.

| # | Severity | Issue | Disposition |
|---|---|---|---|
| 1 | Major | S8 regulation-leg decay used `side.no` vermillion under a "color: taker side" chip, visually reinforcing the naive "market abandoned Germany" read the scene's prose debunks | **Applied.** New token `state.expiring` (`#7C8AA0`, cool slate-blue → fades to `state.dead`), never routed through `side.no`. S8 gets its own micro-legend chip text: **"color: contract status,"** not "color: taker side." See §2, §9 (S8). |
| 2 | Major | S1's overlay spec never named the standardized Grain Plate, though S6/S9 quote it as an already-learned signal — real risk of it being cut from the piece's tightest, most attention-scarce scene | **Applied.** Grain Plate banner added to S1's overlay list, pre-title, locked **non-cuttable** within the 6-viewport budget; mobile carries the same banner, not narrated text alone. See §9 (S1). |
| 3 | Major | S15/S16 L5 narrate "France priced 3–5pts above Opta" — valid only post-devig — without the "devigged" qualifier in beat copy (only in overlay annotation text), unlike S17's disciplined provenance line | **Applied.** New integrity rule in §6; S15 and S16 L5 scene notes (§9) now specify the qualifier lives in the beat copy itself. |
| 4 | Major | No documented tone-mapping/bloom-cap policy for additive point-sprite density spanning 3–4 orders of magnitude (S2) — risk of saturation collapse and bloom-inflated small clusters | **Applied.** New §7 with explicit gamma/cap/fixed-bloom-radius/text-routing policy, tokenized in `tokens.css`/`tokens.json` as `density.*`. |
| 5 | Minor | `identity.crimson` (Spain) was the only identity/accent color missing the piece's own blanket AAA 7:1 target (5.70:1 canvas / 5.40:1 card), despite being the Act V load-bearing color | **Applied (color nudge).** Lightness raised (`#F2545B` → `#F68388`, hue held at 357.4°) to clear AAA: **7.84:1 canvas / 7.43:1 card**. Documentation clarification also added: direct-at-mark identity labels are governed by the AA 4.5:1 floor, not AAA (§2), resolving the ambiguity either way. |
| 6 | Minor | S5's Trump-market singleton gets the full white-core/amber-halo "look here, this is big" treatment, but the caption's point is an inversion (it *didn't* crack the top 1,000) — halo conventionally reads as "significant," fighting the punchline | **Applied.** Co-located copy required at the highlight itself: *"small — lit up because it's surprising, not because it's big."* See §9 (S5). Protocol left intact (no bespoke visual exception) to avoid multiplying singleton variants. |
| 7 | Minor | `side.no` (`#FF7A45`, hue 17°) and `identity.crimson` (hue 357°, now 357° still) sit only ~20° apart on the hue wheel — no documented cross-temporal priming risk (S1 teaches "warm red-orange = NO," Spain later wears a near-neighbor as the winning team) | **Documented, not repainted.** Hue was deliberately *not* pushed further toward vermillion's neighbor-on-the-other-side risk: `identity.pink` already sits at 348°, only 9° from crimson — shifting crimson toward pink to escape vermillion would trade one collision for a worse one. Residual-priming note added here and to §9 (S15/S16); `team_vs_semantic` framing (§6) already bars the two from co-occurring in one frame. |
| 8 | Minor | `state.dead` is documented at 2.5:1, below the WCAG 3:1 non-text floor, with an informal "paired label" rationale but no cited conformance clause | **Applied.** Cited explicitly: **WCAG 2.1 SC 1.4.11 Non-text Contrast — Inactive User Interface Components exception**, alongside the existing mandatory-paired `ink.mid` label. See §2, `tokens.css` comment block. |

## 9. Per-scene notes (all 18 scenes)

- **S1 · Ninety minutes in Arlington.** Ceremony exception, centered title. **Grain Plate banner now explicit and non-cuttable (FIX #2)**, fires pre-title before the tick-level zoom, mobile carries the same banner. Side-binary cyan/vermillion debuts with direct labels; chip debuts; amber annotations at the repricing and the whistle; the France pour is the reader's first sight of `state.dead` grey.
- **S2 · Thirteen months, asleep.** Grain Plate "return" variant. Family color muted/low-sat (payload is emptiness; density-luminance carries it — governed by §7's compression policy for the ~3,400x/21,000x span). Mobile timeline rotates vertical.
- **S3 · The flood.** Dollar counter hero in Inter tnum; press-floor marker a dashed `ink.mid` line the counter visibly ticks past. Step-triggered.
- **S4 · The tournament's clock.** Channel-sequencing template: brightness only, then recolor to in-window/out-of-window at constant luminance — one new channel per step.
- **S5 · Where the dollars sat.** Neutral tint sweep; below-threshold stratum is a hatched `bg.card` band with a mono count chip. Trump cluster: first full singleton protocol run, **now with co-located deflating copy (FIX #6):** *"small — lit up because it's surprising, not because it's big."*
- **S6 · Anatomy of the biggest market.** Side-binary color, uniform dot size; sampling n printed in the grain plate; per-trade-size story lives only in the neutral-grey sparkline; mobile metronome pulses one dot, never the field.
- **S7 · The goal, three ways.** Exception: three venue hues live simultaneously, redundant with lane region (Gestalt region grouping carries identity; hue confirms). Anti-race guarantee lives in glyph form, not color.
- **S8 · Which market you watch.** Regulation leg fades via **`state.expiring`** (cool slate-blue → `state.dead`), never `side.no` **(FIX #1)**; advancement leg holds `side.yes` cyan — hue difference is the settlement-semantics lesson. **Scene-local micro-legend chip reads "color: contract status," not "color: taker side."** White whistle line; scrub because scroll = match clock.
- **S9 · Three shocks, three arithmetics.** Grain Plate "return"; three identity hues max + grey reference. Mirror step dims everything but Norway/Argentina (field-dim protocol). **The "why" — shared bracket arithmetic, not one market driving the other — now ships as caption text at the same step as the mirror callout**, not only in lede prose above the fold.
- **S10 · One price, two venues.** Population rests at 25%. Braid = cyan + lavender lines; fusion quantified live by the mono gap-meter (0.74 pts). Pinnacle grey line dies into dashed `#6B7480` terminations.
- **S11 · The verdict, and the trap.** D3 columns in venue hues, zero-baselined. T-5min blowout desaturates to `state.dead` under a white strike. Receipts at footnote-weight mono `ink.low`. Dots never move.
- **S12 · The anti-gotcha (Golden Boot).** Naive frame at 40% desaturation under a pinned caveat label; only the resolution gets full identity color. OG image and no-JS fallback hard-locked to the resolved frame.
- **S13 · The flags and the price.** Poll bars outline-only D3 beside filled dot columns — fill/outline contrast is the units argument. "Agreement shares are not probabilities" caption stays pinned.
- **S14 · The one real sin.** White diagonal; sagging dots re-light their S5 tags in amber. Toggle is a large amber-active segmented control (12.6:1), keyboard accessible; moves markers and re-lights emphasis only — size stays frozen.
- **S15 · Thirteen months above the line.** France `identity.blue`, Spain `identity.crimson` (post-fix, AAA-clean) against a neutral model line. **Beat copy now says "devigged premium" explicitly (FIX #3)**, not only the overlay annotation. Drain takes the 2600ms ceremonial exception. *(Residual note, FIX #7: readers meet crimson here having learned warm red-orange as "NO" in S1 — a documented, accepted risk, not repainted; see §8.)*
- **S16 · How to read the number.** Zero new encodings. Lockup: mono amber ordinal kicker over Inter 600 title. **L5's caption carries the explicit "devigged" qualifier (FIX #3)**, matching S15 and S17. Global desaturation ramps until only Spain and the opponent hold color.
- **S17 · The number.** Ceremony exception, fully centered. Population dims to 25% (reconciled value, Gate-5 provenance audit: this spec previously said 15% while every shipped build has used the shared `--dot-opacity-dimmed-field-min` token, 0.25 -- the token is the sanctioned figure now that the two are reconciled, so S17 stays visually consistent with every other scene's dimmed-field floor instead of needing its own one-off token); final's dots form the underline at 60% amber. Hero price in white Inter 600 tabular; devig line beneath in 24px amber, same freeze/timestamp. Nothing moves last except the population settling.
- **S18 · The rail releases.** UI chrome debuts in the apparatus voice (Inter on `bg.card`, amber active states, cyan focus rings ≥3:1). 800ms fade-up entry. Replay lanes inherit each market's scene grammar and grain plates verbatim.

## 10. Validation

`docs/design/validate_tokens.py` (run via `pipeline/.venv/bin/python3`) recomputes WCAG 2.x relative-luminance contrast directly from `docs/design/tokens.css`, checks every declared text/background pair against its target tier (AAA 7:1 sustained text, AA 4.5:1 any text, AA 3:1 non-text, plus the one documented sub-floor exception), and cross-checks `tokens.css` against `tokens.json` (hex string equality + rgba-float round-trip). Latest run: **27/27 contrast pairs pass, 1/1 documented exception matches its stated ratio, 25/25 color tokens agree between CSS and JSON, 25/25 rgba round-trips verified.** Zero failures. Re-run before Gate 4 if any token changes.
