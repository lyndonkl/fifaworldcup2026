# Perception brief — why amber is unreadable and movers don't pop

*Prepared for: "The Market Watched the World Cup" (fifaworldcup2026), design-system revision.*
*Scope: the cognitive-science and vision-science literature governing color and motion
legibility in a dark-background WebGL unit visualization, applied to two reported bugs:
(a) `accent.annotation` amber is hard to read against the dark field and inside text; (b)
the ACTIVE/moving dot subset does not visually contrast with the resting field, so motion
is hard to perceive and the mover's meaning doesn't land.*
*Method note: every literature claim below is sourced. The applied-diagnosis numbers in
§9 are computed directly from the live `docs/design/tokens.css` values using the WCAG 2.x
relative-luminance formula, the same formula `validate_tokens.py` already uses — this
brief does not introduce a new metric, it applies the existing one to a comparison the
current validator doesn't check.*

---

## 1. Preattentive processing and pop-out (Treisman)

Anne Treisman and Garry Gelade's **Feature Integration Theory** (1980) established that
early vision processes a small set of basic features — color, orientation, size, motion,
line curvature — in parallel and pre-consciously, across the whole visual field, before
attention is deployed anywhere.[^1] A target that differs from its distractors by one such
feature "pops out": it is found in roughly constant time regardless of how many
distractors surround it. A target that differs only by a *conjunction* of features (e.g.
a specific color-and-shape pairing) does not pop out — the viewer must serially scan.[^2]
Motion itself is one of Treisman's basic preattentive features, on the same list as color
and orientation, not a derivative of them.[^1] Colin Ware's *Information Visualization:
Perception for Design* — the standard synthesis of this literature for visualization
practitioners — groups the reliable preattentive channels into four families: form, color,
**position, and motion**, and treats motion onset as one of the strongest attention-capture
signals available to a designer, on par with luminance.[^3] Stephen Few's practitioner
synthesis adds a sharper distinction that matters here: **hue** is a categorical
(nominal) channel — good for "which one" — while **intensity/luminance** is an ordered
channel — good for "how much" or, critically, for "is this different from that." The two
cannot substitute for each other.[^4]

**Implication for this piece.** The design system's own emphasis stack already ranks
"motion onset" above "luminance singleton" above "amber annotation type" above "hue"
above "position" (`design-system.md` §6). That ranking is correct by this literature — but
only if the *lower* channels are not being asked to do the *upper* channel's job. Right
now the ACTIVE-vs-REST distinction is being carried by hue (`identity.*` vs `field.rest`)
when the literature says hue is the *weakest* of the piece's own five channels for a
figure/ground pop-out task. The fix is not a new hue; it's promoting the distinction to
luminance and motion, the channels that actually pop out reliably.

---

## 2. Luminance contrast vs chromatic contrast — and why motion is a luminance-channel phenomenon

The human visual system splits early on into pathways with different jobs. The
**magnocellular pathway** is color-blind (or nearly so), fast, high-contrast-gain, and
carries most of the motion and flicker signal; the **parvocellular pathway** is
color-selective, slower, and carries fine spatial/chromatic detail.[^5] Motion
psychophysics converts this anatomy into a design-relevant fact: motion detected purely
from a color boundary — a boundary with no luminance difference across it, an
**isoluminant** boundary — is processed far more weakly than motion carried by a
luminance boundary. Cavanagh and colleagues showed that at isoluminance, apparent motion
becomes slow, jerky, and can vanish entirely, surviving only under a narrow range of high
chromatic contrast and low speed.[^6][^7] Livingstone and Hubel's classic 1987 study —
still the standard citation for this effect — demonstrated the same thing from the other
direction: stimuli defined only by equiluminant color differences appear to "stand still"
even when they are physically moving, because the fast, motion-carrying pathway simply
isn't being driven.[^8] Later work (Cropper, Derrington & Badcock 1994; Chichilnisky &
Wandell area) qualifies this rather than reversing it: color *can* support motion
detection through a slower, feature-tracking mechanism, but only at high chromatic
contrast and low temporal frequency — it never approaches the speed or reliability of a
luminance signal, and object-tracking/scrub interactions in a live scrolly piece are
exactly the fast, low-time-budget case where this mechanism is weakest.[^9][^10]

**Implication for this piece.** A dot that changes from `field.rest` (a blue-grey) to
`identity.blue` (also a blue) while staying at roughly the same brightness is, to the
magnocellular motion system, close to invisible as a *change event* — even though the
hue swap is chromatically real and would show up fine in a static side-by-side swatch
comparison. If a reader is meant to *see* a dot activate or move mid-scroll, that dot's
luminance must change, not just its hue. This is precisely the mechanism behind bug (b).

---

## 3. Color opponency (Hering) and which hue pairs separate best on a dark ground

Ewald Hering's opponent-process theory posits three paired channels — red↔green,
blue↔yellow, and black↔white (light↔dark) — confirmed physiologically in retinal and LGN
opponent cells.[^11][^12] Two practical consequences follow. First, colors from opposite
ends of the *same* opponent axis (e.g. a saturated blue and a saturated orange, which sit
on the blue-yellow axis) are maximally separated in the color-opponent code the visual
system actually computes, which is why blue/orange is the most-recommended
maximum-discriminability categorical pair in modern data-visualization guidance — it
survives most forms of color-vision deficiency because CVD overwhelmingly affects the
red-green axis, not blue-yellow.[^13] Second, and less often stated: opponency describes
*hue* separation, not *luminance* separation — two colors can sit at opposite ends of an
opponent axis and still have nearly identical luminance (§2's isoluminance problem can
happen to *any* opponent pair, including blue/orange, if their lightness is matched).

**Implication for this piece.** The existing `side.yes` (cyan `#59D2FE`) / `side.no`
(vermillion `#FF7A45`) pair is a defensible opponent-axis choice and is explicitly
documented as CVD-safe (`design-system.md` §2). It should stay the model for any new
figure/ground pair. But it must not be reused as the ACTIVE/REST solution by itself —
per §2 above, the pair also needs a luminance gap, which the current cyan/grey-blue
combination (`side.yes` vs `field.rest`, computed contrast ~1.2:1 — see §9) does not have.

---

## 4. Figure-ground segregation — how to make a subset read as "figure"

Gestalt figure-ground theory holds that the visual system spontaneously partitions a
scene into a salient "figure" and a receding, shapeless "ground," and that this
partitioning is driven by *relative* cues — similarity, contrast, closure, and above all
**luminance/contrast accentuation at the boundary** — not by any single color in
isolation.[^14][^15] The practical playbook for forcing a subset to read as figure,
consistent across the visualization-perception literature (Ware; Few), is: (1) **dim the
ground** — lower the luminance/contrast/saturation of everything not-figure; (2)
**increase figure size or stroke weight** relative to ground elements; (3) **raise figure
luminance** above the ground's summed/local luminance, not just above any single ground
element's luminance. All three are luminance-and-scale operations; hue is not load-bearing
for figure-ground segregation on its own.[^3][^14]

**Implication for this piece.** The design system already has the *right instinct* here —
`state.dimmed-field` (rest tint at 25–40% opacity) and the "luminance singleton" emphasis
tier both dim-the-ground correctly. The gap (quantified in §9) is that the ground-dimming
budget was set relative to a *single* dot's luminance, not to the *summed* luminance of an
overlapping cluster of rest dots — which is what a reader actually sees once population
density exceeds a handful of dots per screen pixel, which is most of this piece.

---

## 5. Perceptually uniform, colorblind-safe colormaps — and why perceptual uniformity matters

The canonical failure mode is the "rainbow"/jet colormap: it is not perceptually uniform,
meaning equal steps in the underlying data produce visually unequal steps in the
rendered color, creating false gradient boundaries ("banding") and hiding real ones.
Borkin et al. (2011) showed this is not a hypothetical concern — physicians reading
medical images with a poorly-designed rainbow colormap took measurably longer and made
significantly more diagnostic errors than with a perceptually uniform alternative.[^16]
**Viridis** was built specifically to fix this: it was generated in a perceptually uniform
color-appearance space (CAM02-UCS) so that lightness increases monotonically and evenly
across the whole scale, and it became the default colormap for Matplotlib and much of the
scientific-visualization ecosystem as a result.[^17] **Cividis** (Nuñez, Anderton &
Renslow, 2018) goes one step further: it is mathematically optimized so that
color-vision-deficient and color-typical viewers perceive an *effectively identical*
map, not merely a "safe-enough" one.[^18] **ColorBrewer** (Cynthia Brewer et al.) applies
the same discipline to categorical/qualitative palettes rather than continuous ones,
publishing pre-tested sets (e.g. `Set2`, `Dark2`) explicitly labeled colorblind-safe and
validated for legibility across print, projector, and screen conditions.[^19][^20]

**Implication for this piece.** This piece does not use a continuous colormap for the
population (money is encoded by dot *count*, per the "dots mean money" grammar), so
viridis/cividis are not directly load-bearing for the particle field. They *are* directly
relevant to the `identity.*` ramp: a 4–6-hue categorical ramp should be checked the way
ColorBrewer checks its qualitative sets — for CVD-safety *and* for pairwise perceptual
distance, not just for individual contrast against the canvas. §9 shows the current ramp
passes the canvas check but fails a pairwise/CVD check for exactly the reason
ColorBrewer's methodology exists to catch.

---

## 6. Contrast standards — WCAG ratios and CIE ΔE, and where they stop being useful

**WCAG 2.x** defines two relevant success criteria: **1.4.3** requires 4.5:1 for normal
text and 3:1 for large text against its background;[^21] **1.4.11 (Non-text Contrast)**
requires 3:1 for UI components and "meaningful graphical objects" against *adjacent*
colors.[^22] Both are foreground-vs-background (or component-vs-adjacent-color) checks —
neither one is defined for, or answers, "does moving object A contrast with stationary
population B when both are visible on screen at once," which is a figure-vs-figure
question, not a figure-vs-background question. Separately, **CIE ΔE** (in CIELAB space)
measures perceptual color *distance* rather than luminance contrast: ΔE ≈ 1 is the
just-noticeable difference under lab conditions, ΔE 2–3.5 is a difference visible to an
attentive but untrained viewer, and values below that are effectively the same color to a
casual glance.[^23][^24] Finally, the accessibility community's own newer work (the APCA
algorithm slated for WCAG 3) flags a specific failure of WCAG 2.x that is directly
relevant to a near-black canvas: **WCAG 2.x systematically overstates the effective
contrast of light text on near-black backgrounds**, and separately requires *higher*
apparent contrast as text gets smaller or thinner (exactly the profile of the 15px Inter
500 annotation label) — a correction WCAG 2.x's simple ratio does not apply.[^25]

**Implication for this piece.** `validate_tokens.py`'s "27/27 pairs pass" is true and not
the problem — it is checking the wrong 27 pairs for bug (b). It validates every
color *token* against `bg.canvas`, which is necessary but not sufficient: it never checks
`identity.blue` against `field.rest`, because that pair is figure-vs-figure, a
relationship WCAG doesn't define and the validator was never asked to compute. It should
be extended with a second check class. For bug (a), the 12.6:1 headline number is real but
measured against flat canvas; the amber annotation's actual failure mode — turning up
*inside or beside body text*, and against bloomed/dense particle clusters rather than flat
canvas — is a different comparison the current audit doesn't run either (quantified in §9).

---

## 7. Change blindness — and how brief highlighting/pulsing defeats it

Rensink, O'Regan and Clark's flicker paradigm is the classic demonstration of **change
blindness**: when a brief blank or mask is interposed between an original and a changed
scene, viewers routinely fail to notice even large changes — sometimes for close to a
minute of continuous alternation — because detecting change requires focused attention on
the specific location, not just an open eye.[^26][^27] The same research program found
the failure is *not* absolute: change detection is reliably attenuated (i.e., the change
*is* seen quickly) when the changed item is a late-onset item or a **color/luminance
singleton** — something that involuntarily captures attention through a stimulus-driven,
exogenous mechanism rather than requiring the viewer to already be looking there.[^28]
Separately, the attention literature on visual transients establishes that an **abrupt
onset** (something appearing/brightening where nothing was before) triggers fast,
involuntary, luminance-transient-driven attention capture, distinct from and faster than
memory-based voluntary search.[^29]

**Implication for this piece.** This is the literature-level justification the design
system already leans on ("the fixed micro-legend chip states it and pulses 1.2s on every
change" — `design-system.md` §1, §6) — pulsing is the correct change-blindness
countermeasure *for the chip*. The gap is that the same countermeasure is not applied to
the population itself: an ACTIVE dot's state change is a silent hue swap with no onset
transient, so it is exactly the kind of change the flicker-paradigm literature predicts
readers will miss even while looking directly at the field, unless it is also given a
brief luminance/size transient at the moment of change — not sustained motion, a **pulse**
at onset, which is cheap (one extra keyframe) and is what the cited literature says
actually captures attention.

---

## 8. Limits on simultaneous distinct colors in working memory

Luck and Vogel's foundational 1997 study established that visual working memory holds
about **four integrated objects** at a time regardless of how many features each object
carries — you can hold four colors, four orientations, or four color-orientation
conjunctions, but not sixteen independent features.[^30] Later work refines rather than
overturns this: for *continuous*, precisely-remembered colors the reliable capacity is
closer to three or four; but *categorical* color labels (i.e., colors that map cleanly
onto named categories like "red," "blue," "teal") can be held in somewhat larger sets
because the visual system compresses them to a category rather than storing a continuous
value — with practical design guidance converging on roughly **five to six** as the point
past which per-category discriminability starts to degrade regardless of how the
capacity limit itself is modeled.[^31]

**Implication for this piece.** The design system's "4±1 working-memory budget" for the
identity ramp (`design-system.md` §1) is exactly right per this literature and should not
be relaxed. The corollary that follows from combining this with §5 and §9, though: because
the ramp is already at its cognitive ceiling, *none* of those four-to-six slots can be
spent solving the ACTIVE/REST problem — that problem needs to be solved on a channel
outside the identity ramp (luminance, size, motion-onset), not by adding a seventh hue or
by asking existing identity hues to pull double duty as the activity signal.

---

## 9. Applied diagnosis: the two bugs, computed from the live tokens

The numbers below use the same WCAG 2.x relative-luminance contrast formula
`validate_tokens.py` uses, applied to comparisons the validator does not currently run.
Source: `docs/design/tokens.css` as of this brief.

### 9a. Why amber is hard to read "inside text"

| Pair | Contrast | Note |
|---|---|---|
| `accent.annotation` (`#FFC94D`) vs `bg.canvas` | 12.6:1 | The number in the design doc — true, and irrelevant to the bug |
| `accent.annotation` vs `bg.card-composite-cap` | 11.2:1 | Still fine on a flat card |
| `accent.annotation` vs `ink.hi` (`#E8ECF1`, primary prose color) | **1.29:1** | Amber next to or run into off-white prose is close to invisible — both sit at similar relative lightness (L=0.64 vs L=0.84 is a bigger raw gap than it looks, but WCAG's non-linear curve plus real anti-aliasing at 15px collapses it) |
| `accent.annotation` vs a bloom-saturated dense cluster (piece's own `--density-tile-luminance-cap: 0.92`) | **1.41:1** | The tone-mapping policy that makes dense areas of the field glow near-white is the same policy that can wash out an amber annotation sitting near or over that field |
| `accent.annotation` vs `side.no` (`#FF7A45`) | 1.69:1 | Amber and the NO-vermillion are close enough in hue and lightness to be confusable in a fast glance, e.g. S14's amber-active toggle sitting near vermillion-tagged dots |

**Diagnosis:** amber's 12.6:1 headline is a foreground-vs-flat-black number. The actual
failure surface is foreground-vs-*other-foreground*: amber set against the piece's own
off-white prose color, or against its own particle field once that field is bright (which
by design, via the density tone-map, it deliberately gets, up to L=0.92). Per §6, WCAG
doesn't check this pairing and per the APCA finding in §6, WCAG 2.x's ratio is known to
overstate real legibility for exactly this kind of light-on-near-black, small/medium-weight
text pairing. This is a self-inflicted collision between two correct-in-isolation design
decisions (amber is AAA vs canvas; the density tone-map is supposed to glow), not a
one-line color swap.

### 9b. Why the active/moving subset doesn't contrast with the resting field

Pairwise contrast, every `identity.*`/`side.*` token against `field.rest` — the
comparison a mover is actually judged against, which `validate_tokens.py` never computes
because both sides are non-text, non-background tokens:

| Pair | Contrast | Luminance gap |
|---|---|---|
| `identity.lavender` vs `field.rest` | **1.01:1** | L 0.458 vs 0.452 — functionally isoluminant |
| `identity.blue` vs `field.rest` | **1.15:1** | L 0.386 vs 0.452 |
| `identity.teal` vs `field.rest` | **1.03:1** | L 0.465 vs 0.452 |
| `identity.pink` vs `field.rest` | **1.08:1** | L 0.493 vs 0.452 |
| `identity.crimson` vs `field.rest` | **1.18:1** | L 0.376 vs 0.452 |
| `side.yes` (cyan) vs `field.rest` | **1.20:1** | L 0.554 vs 0.452 |
| `side.no` (vermillion) vs `field.rest` | **1.24:1** | L 0.356 vs 0.452 |

Every one of these is below the WCAG non-text floor of 3:1 — and several are within
noise of 1:1, the literal definition of isoluminance (§2, §3). This is not a coincidence
of one bad token; the entire identity ramp was tuned for "bright enough against black,"
which by construction clusters every hue into the same 0.38–0.49 mid-high luminance band,
because that's the band that reads AAA against `#0B0E13`. The ramp is internally
isoluminant *by the same design logic that makes it individually legible.*

Density compounds this. `dot-opacity-rest` is 0.35, `dot-opacity-alive` is 1.0 — a real
gap for a *single* dot. But population density is the entire premise of the piece
(~164k desktop dots), and rest dots overlap:

| Overlapping rest dots (naive alpha stack, 35% each) | Apparent luminance | Contrast vs one active `identity.blue` dot |
|---|---|---|
| 1 | 0.064 | 3.82:1 |
| 2 | 0.154 | 2.14:1 |
| 3 | 0.238 | 1.52:1 |
| 5 | 0.352 | **1.09:1** |

A single isolated rest dot against one active dot clears the non-text floor (3.82:1).
By five overlapping rest dots — a routine local density almost anywhere the population
isn't already sparse — the ground has visually caught up to the figure, and the
`state.rest` alpha budget (documented as capped "so summed field luminance stays below
**annotation** luminance," `design-system.md` §2) was never checked against **active
particle** luminance, which is the comparison that actually matters for bug (b).

**Diagnosis:** the design system solved the wrong luminance inequality. It protected
amber's visibility against the summed field; it did not protect an active dot's
visibility against the summed field, and it did not give the identity ramp any luminance
separation from `field.rest` at all — only hue separation, which §2's motion-perception
literature says is close to inert for a "did that just change" judgment.

---

## 10. Concrete recommendations (mapped to the theory sections above)

1. **Give ACTIVE a luminance floor, not just a hue, over REST** (§2, §4, §9b). Target
   ≥3:1 contrast between any `identity.*`/`side.*` token and the *locally-summed* rest-field
   luminance, not just the single-dot value — e.g. push active-dot luminance materially
   above 0.6 (near `ink.hero`/white-core territory) or push `field.rest`'s alpha cap down
   at high local density (a density-aware opacity curve, not a flat 0.35).
2. **Add an onset pulse (luminance/size transient) at the moment a dot goes ACTIVE**, not
   only a sustained hue difference (§7). One extra keyframe: brief overshoot in radius
   and/or luminance at state-change, then settle — this is what the change-blindness
   literature says actually gets seen, independent of fixing the steady-state contrast.
3. **Keep the identity ramp's hue choices, decouple them from the luminance channel**
   (§3, §5, §8). Don't add a seventh hue to solve ACTIVE/REST — the 4±1 budget is already
   correctly spent. Instead let each identity hue carry a slightly different lightness
   value the way a ColorBrewer qualitative set is checked pairwise, not just individually
   against canvas.
4. **Extend `validate_tokens.py` with a figure-vs-figure check class**, not just
   token-vs-canvas (§6, §9). Add every `identity.*`/`side.*` × `field.rest` pair to the
   automated audit at a 3:1 non-text floor, the same way 1.4.11 already gates
   component-vs-adjacent-color elsewhere in the file. This is the gap that let bug (b)
   ship past a "27/27 passing" audit.
5. **Test `accent.annotation` against `ink.hi` and against a bloomed dense-cluster
   luminance (~0.9), not only against flat `bg.canvas`** (§6, §9a). If inline-with-prose
   amber is a real use case, either lighten/desaturate amber slightly for that context or
   never set it directly adjacent to `ink.hi` glyphs — pair it with a dimming scrim behind
   the annotation type the way `bg.card-composite-cap` already dims behind cards.
6. **Consider an APCA pass, not only WCAG 2.x, on the amber annotation label specifically**
   (§6) — it is small (15px) and medium-weight (500) on a near-black ground, precisely the
   profile WCAG 2.x is documented to overstate.

---

## Sources

[^1]: Treisman, A. & Gelade, G. (1980). *A feature-integration theory of attention.*
Summarized in: "Feature integration theory," Wikipedia,
https://en.wikipedia.org/wiki/Feature_integration_theory ; see also
https://pressbooks.cuny.edu/sensationandperception/chapter/feature-integration-theory/
[^2]: "Major issues in the study of visual search: Part 2 of '40 Years of Feature
Integration.'" *Attention, Perception, & Psychophysics.* PMC,
https://pmc.ncbi.nlm.nih.gov/articles/PMC7250731/
[^3]: Ware, C. *Information Visualization: Perception for Design.* Overview and
attribute taxonomy: https://scholars.unh.edu/ccom/127/ ;
https://shop.elsevier.com/books/information-visualization/ware/978-0-12-812875-6
[^4]: Few, S. "The Visual Perception of Variation" and related Perceptual Edge
articles on hue vs. intensity encoding, https://www.perceptualedge.com/articles/visual_business_intelligence/the_visual_perception_of_variation.pdf ;
summary: https://uxdesign.cc/preattentive-attributes-of-visual-perception-and-their-application-to-data-visualizations-7b0fb50e1375
[^5]: "Using perceptual tasks to selectively measure magnocellular and parvocellular
performance." PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC8367893/ ; "Two carriers
for motion perception: Color and luminance," *Vision Research*,
https://www.sciencedirect.com/science/article/abs/pii/0042698991901836
[^6]: "Absence of smooth motion perception in color vision." *Vision Research*,
https://www.sciencedirect.com/science/article/abs/pii/004269899290240J
[^7]: "The mechanism of isoluminant chromatic motion perception." *PNAS*,
https://www.pnas.org/doi/10.1073/pnas.96.14.8289 ; see also
https://pubmed.ncbi.nlm.nih.gov/10393987/
[^8]: Livingstone, M.S. & Hubel, D.H. (1987). "Psychophysical evidence for separate
channels for the perception of form, color, movement, and depth." *Journal of
Neuroscience* 7(11):3416-3468. https://www.jneurosci.org/content/7/11/3416 ;
PMC copy: https://pmc.ncbi.nlm.nih.gov/articles/PMC6569044/
[^9]: "Motion of chromatic stimuli: First-order or second-order?" *Vision Research*,
https://www.sciencedirect.com/science/article/abs/pii/0042698994902569
[^10]: "Colour and luminance interactions in the visual perception of motion." PMC,
https://pmc.ncbi.nlm.nih.gov/articles/PMC1690987/
[^11]: "Opponent-process theory." Wikipedia,
https://en.wikipedia.org/wiki/Opponent-process_theory ; "Color opponency: tutorial."
PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC6022826/
[^12]: "Opponent Processing Theory of Color Vision." York University,
https://www.yorku.ca/eye/opponent.htm
[^13]: "Crafting an effective data visualization color palette." Observable,
https://observablehq.com/blog/crafting-data-colors
[^14]: "Figure–ground (perception)." Wikipedia,
https://en.wikipedia.org/wiki/Figure%E2%80%93ground_(perception) ; "A new principle
of figure-ground segregation: The accentuation..." *Vision Research*,
https://www.sciencedirect.com/science/article/pii/S0042698917302390
[^15]: "Figure and Ground in the Visual Cortex: V2 Combines Stereoscopic Cues with
Gestalt Rules." PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC1564069/
[^16]: Borkin, M. et al., cited via "Domestic-engineering: Why you should use Viridis
and not Jet (rainbow) as a colormap," https://www.domestic-engineering.com/drafts/viridis/viridis.html
[^17]: "Introduction to the viridis color maps." CRAN,
https://cran.r-project.org/web/packages/viridis/vignettes/intro-to-viridis.html
[^18]: Nuñez, J.R., Anderton, C.R. & Renslow, R.S. (2018). "Optimizing colormaps with
consideration for color vision deficiency..." *PLOS ONE*,
https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0199239 ; arXiv
preprint: https://arxiv.org/pdf/1712.01662
[^19]: "ColorBrewer." Wikipedia, https://en.wikipedia.org/wiki/ColorBrewer ; tool:
https://colorbrewer2.org/
[^20]: "Colorblind-safe palettes in SAS." The DO Loop,
https://blogs.sas.com/content/iml/?p=42475
[^21]: "Understanding Success Criterion 1.4.3: Contrast (Minimum)." W3C WAI,
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
[^22]: "Understanding Success Criterion 1.4.11: Non-text Contrast." W3C WAI,
https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html
[^23]: "Color difference." Wikipedia, https://en.wikipedia.org/wiki/Color_difference ;
"Delta E 101," https://zschuessler.github.io/DeltaE/learn/
[^24]: "Color difference Delta E - A survey," https://wisotop.de/assets/2017/DeltaE-%20Survey-2.pdf
[^25]: "APCA in a Nutshell." APCA documentation,
https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html ; "WCAG 3.0
Typography Standards: 2026 Guide to APCA & UX,"
https://inkbotdesign.com/wcag-3-0-typography-standards/
[^26]: Rensink, R.A., O'Regan, J.K. & Clark, J.J. (1997). "The Need for Attention to
Perceive Changes in Scenes." *Psychological Science*.
https://www2.psych.ubc.ca/~rensink/publications/download/PsychSci97-RR.pdf ; overview:
https://www2.psych.ubc.ca/~rensink/flicker/
[^27]: Rensink, R.A. "Change Blindness." University of British Columbia,
https://www.cs.ubc.ca/~rensink/publications/download/NeuroBiol-RR.pdf
[^28]: Scholl, B.J. "Attenuated Change Blindness for Exogenously Attended Items in a
Flicker Paradigm." *Visual Cognition*, https://perception.yale.edu/papers/00-Scholl-VisCog.pdf
[^29]: "Dual Processes of Oculomotor Capture by Abrupt Onset." PMC,
https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3833982/
[^30]: Luck, S.J. & Vogel, E.K. (1997). "The capacity of visual working memory for
features and conjunctions." *Nature*, https://www.nature.com/articles/36846 ; PDF:
https://awhvogellab.com/files/pdfs/luck_1997_capacity-features-conjuctions.pdf
[^31]: "Is Categorization in Visual Working Memory a Way to Reduce Mental Effort? A
Pupillometry Study." PMC, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9539610/ ;
"Redundant is Not Redundant: Automating Efficient Categorical Palette Design...
CatPAW," https://arxiv.org/pdf/2602.06792
