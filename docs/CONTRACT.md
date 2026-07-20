# Regulation Time — Phase 4 build contract

Version 1.0 · 2026-07-15 · owner: technical architect.

Every parallel builder (engine, scenes, data-tiling, prose integration) codes
against this file. Where a builder's file and this contract disagree, the
contract wins until the contract itself is amended in one reviewed change.
This contract encodes, and never overrides, three upstream authorities:

- **WHAT to build:** `research/storyboard.md` (the 18 scenes, §0 unit rules,
  Appendix A dispositions). The storyboard is the single source of truth for
  scene content, grain narration, and prose.
- **HOW it looks:** `research/design-system.md` plus `docs/design/tokens.css`
  and `docs/design/tokens.json`. **Tokens are law.** No hardcoded color,
  duration, easing, size, spacing, or z-index anywhere. CSS/DOM reads
  `tokens.css` custom properties; JS/WebGL reads parsed `tokens.json`.
- **WHAT is true:** `research/findings-dossier.md` (corrected claims only).
  The eleven killed findings stay dead. R23 stands: no cross-venue speed
  ranking anywhere, ever. Settlement rule R4 (regulation vs advancement) is
  honored wherever a level-after-90 match appears.

Precedent: `understandingsoccer/docs/js/engine.js` — fixed population of
point sprites, every visual change a GPU-interpolated A→B tween, interrupts
retarget from current interpolated values. The engine below evolves that
pattern; it does not replace it.

---

## 1. Ground rules (bind every file)

1. **Zero-build, fully static.** Served from `docs/` on GitHub Pages. No
   bundler, no transpile, no server. ES modules + one classic-script vendor
   file. Everything committed runs as committed.
2. **NO EXTERNAL RESOURCES.** No CDN, no external fonts, no analytics, no
   client-side calls to any non-relative URL. D3 is vendored at
   `docs/js/vendor/d3.v7.min.js`. Fonts are self-hosted WOFF2 in
   `docs/fonts/`. All fetches are same-origin relative paths. The page must
   still work, offline-archived, in five years. `index.html` ships a CSP
   meta tag that enforces this; do not weaken it.
3. **Dots mean money, and only money.** One dot = one grain of matched
   notional (population) or one trade (zoom). Derived quantities (Brier
   columns, poll bars, sparklines, price traces) are D3 marks, never dots,
   and non-money marks render outline-only. Dot size is never a magnitude
   channel.
4. **Population constancy.** The engine never creates or destroys dots after
   boot. Every scene transition is a re-sort of the same dots or a narrated
   rest. Never cut and redraw. A tile is loaded whole: the engine never
   truncates a population tile (truncation would silently delete money).
5. **Numbers refreeze at deploy.** No dated figure (dollar totals, dot
   census, prices, counts) is hardcoded in JS or HTML. Everything comes from
   `docs/data/manifest.json` and per-scene JSON, which the pipeline rewrites
   at the deploy-morning re-run (G3). Static HTML fallbacks carry
   `data-slot` attributes (§8.6) so the boot pass overwrites them.
6. **No scroll hijacking.** The driver observes scroll; it never blocks or
   retimes it. "Held" beats buy dwell with rail height, not input capture.
7. **Grain changes are always narrated.** Any grain shift updates the grain
   plate (§7). Any color-meaning change updates the micro-legend chip and
   pulses it (`--dur-chip-pulse`).
8. **Reduced motion is a first-class mode**, not a degradation: end states
   plus crossfades (§9).
9. **Prose register:** beat HTML is strategist-voice, storyboard-verbatim
   where numbers appear, numbered footnotes into the methods section. No em
   dashes, no negation cascades.

---

## 2. File layout

```
docs/
  index.html                  page skeleton (this contract §8)
  CONTRACT.md                 this file
  design/
    tokens.css                law (CSS layer)
    tokens.json               law (JS/GL layer)
    validate_tokens.py        Gate 3 validator
  fonts/                      self-hosted WOFF2 (Source Serif 4, Inter, IBM Plex Mono)
  css/
    main.css                  app stylesheet (may start inline in index.html; extract here when it grows)
  js/
    main.js                   boot, data loader, view/geometry, scroll driver, scene orchestration
    shared.js                 scale registry, token helpers, binary column views, formatters (written, stable)
    engine.js                 WebGL engine (engine builder deliverable, API in §3)
    vendor/d3.v7.min.js       vendored D3 v7 (classic script, global `d3`)
    scenes/
      s01.js … s18.js         scene modules (scene builder deliverables, contract in §4)
  data/
    manifest.json             the data manifest (§5)
    pop-75k.bin               desktop population tile ($75k/dot)
    pop-250k.bin              mobile population tile ($250k/dot)
    zoom/
      fraesp.bin  mexeng.bin  gerpar.bin  norbra.bin
    series.bin                packed cross-scene series
    scenes/
      s02.json … s17.json     per-scene aggregate payloads (small, axis-ready)
    replay/                   coda (S18) per-market replay shards, lazy
  og.png                      share image (S12 rule: resolved frame, never the naive one)
```

Module import rules: scenes import only `../shared.js` and (for S16 anchor
reuse) sibling scene modules. Scenes never import `engine.js` or `main.js`.
`main.js` imports `shared.js`, `engine.js` (dynamic, §8.4), and the scene
registry. `d3` is a global from the vendor classic script.

---

## 3. ENGINE API — `docs/js/engine.js`

One exported factory. The engine owns the GL context exclusively; nothing
else may touch it (scenes return typed arrays, main.js calls the API).

```js
export function createEngine(canvas, opts) -> engine | null   // null: no WebGL
```

`opts`:

| key | type | meaning |
|---|---|---|
| `count` | int | exact dot count = the loaded population tile's `dots`. Required. The engine allocates for exactly this N. |
| `tokens` | object | parsed `docs/design/tokens.json`. Source of density uniforms, dot geometry, easing curves, duration caps. Required. |
| `reducedMotion` | bool | boot value; runtime changes via `setReducedMotion()`. |
| `dprCap` | number | default 2. Engine clamps `devicePixelRatio`. |

### 3.1 Population size negotiation

The engine does not pick N; **the tile picks N**. `main.js` chooses a tile
by capability tier (§8.3): desktop → `pop-75k.bin` (~164k dots, recomputed
at deploy; read the count from the manifest, never hardcode 164,000),
mobile/low-capability → `pop-250k.bin` (~49k dots). `createEngine` receives
that tile's exact count. If allocation or shader compile fails at desktop N,
`createEngine` throws; `main.js` catches, falls back to the mobile tile
(narrated by the grain plate, which always prints the loaded tile's grain),
then to static mode. Optional quality demotion: before the first scene
activates (and only then), `main.js` may probe `engine.frameCost()` (mean ms
of 3 warmup frames) and re-boot with the mobile tile if it exceeds 40ms.

### 3.2 Dot state (per-dot attribute layout)

A "state" is the full per-identity target set, CSS-pixel coordinates,
origin top-left (the engine y-flips in the vertex shader):

```js
DotState = {
  x:     Float32Array(N),     // CSS px
  y:     Float32Array(N),     // CSS px
  color: Float32Array(4 * N), // straight (non-premultiplied) rgba, 0..1, from tokens.json rgba values
  size:  Float32Array(N),     // diameter in CSS px; engine multiplies by dpr
}
```

Rules: `color` values come from `tokens.json` (`colors.*.rgba`,
`particle_states.*.rgba`) via `shared.js` helpers, never invented. `size` is
a **protocol** channel only: `--dot-radius-base-px` for the field, the
annotated-singleton core per tokens, zoom pack/unpack transitions. Never
magnitude. The engine keeps A/B CPU mirrors and GPU buffers exactly as the
precedent does (posA/posB, colA/colB, sizeA/sizeB, plus a deterministic
per-identity stagger hash so replays and reverse scrubs are identical).

### 3.3 Motion API

```js
engine.N                       // int, the negotiated population
engine.mode                    // 'webgl2' | 'webgl1'
engine.setState(state)         // hard set: A = B = state, no motion, one draw
engine.tween(state, opts?)     // animated A->B; INTERRUPT RETARGETS from current
                               // interpolated values (bake step), never from the
                               // stale start state
engine.scrubBetween(stateA, stateB, opts?)  // load a scrub pair, t := 0
engine.setScrub(t)             // drive the pair, t in [0,1]; raw, no smoothing
engine.pause()                 // stop the rAF loop, freeze in-flight tween timing
engine.resume()                // restart; in-flight tween resumes where it froze
engine.resize(w, h)            // CSS px; engine re-clamps dpr, resizes backing store
engine.redraw()                // mark dirty, schedule one frame
engine.setReducedMotion(bool)  // switch modes at runtime (media query listener)
engine.frameCost()             // mean ms/frame of the last 3 frames (probe only)
engine.destroy()               // release GL resources, remove context-loss listeners
```

`tween(state, opts)` options:

| key | default | rule |
|---|---|---|
| `duration` | `resort-total-target` (1700) | total ms. Clamped to `resort-hard-cap` (1800) unless `ceremonial: true`, then clamped to `ceremonial-max` (2600). |
| `stagger` | 0.35 | fraction of the timeline used for per-dot offsets (≈ `resort-stagger-max` / target). 0 for recolors. |
| `easing` | `'ease.move'` | one of `'ease.move' | 'ease.arrive' | 'ease.fall'`. The engine implements the three token cubic-bezier curves in GLSL; max deviation from the CSS curve < 0.01. No other easing exists. **No overshoot/elastic on any data position, ever.** |
| `ceremonial` | false | unlocks the 2600ms cap (S15 drain, S17 settle only). |
| `onDone` | — | callback at t=1 (not called if interrupted). |

Callers resolve durations from beat `kind` (§4.4); the engine only clamps.

### 3.4 Density tone-mapping (uniforms from tokens.json)

The design system's physics claim (density reads as accumulated luminance
across 3 to 4 orders of magnitude) is implemented in the engine as a
two-pass pipeline and is **not optional**:

1. **Accumulation pass:** all N points render additively into an offscreen
   framebuffer (float/half-float where available: WebGL2 +
   `EXT_color_buffer_float`, or WebGL1 + `OES_texture_half_float`; fixed
   high-headroom RGBA8 pre-scale fallback otherwise).
2. **Tone-map pass:** full-screen quad applies, in order: power-law
   compression, luminance cap, fixed-radius bloom, composite over
   `bg-canvas`.

Uniforms, sourced from `tokens.json.density_tone_mapping` (never literals):

| uniform | token | value |
|---|---|---|
| `uDensityGamma` | `gamma` | 0.35 |
| `uLumCap` | `tile-luminance-cap` | 0.92 (fraction of `ink-hero` luminance; no cluster may out-shine the annotated singleton) |
| `uRestLumCap` | `rest-luminance-cap` | 0.30 (ground-tier composite ceiling; see amendment below) |
| `uRestKnee` | `rest-knee` | 1.0 (Reinhard soft-knee constant for the ground tier) |
| `uBloomRadiusPx` | `bloom-radius-px-1x` / `-2x` | 3.0 at dpr ≤ 1.5, 4.5 above. **Fixed** regardless of local dot count. |

Any documented on-screen ratio beyond `text-route-threshold-x` (75x) is
carried by overlay text, not the visual channel alone; that is a scene
obligation, noted here because the engine must not be asked to span it.

**Amendment (2026-07-19, Gate-4 visual-story review P1 / Tier 0.1): the
tone-map is tiered.** The single shared cap let summed rest-dot energy
climb the same gamma curve as story marks to the same 0.92 ceiling, so
every dense resting mass rendered near-white and out-shone the story
marks. The engine now accumulates the ground tier (every dot below
`dot.opacity-active-classify-min`) into its own half-resolution target,
tone-maps it with the shared gamma plus a Reinhard soft-knee whose
asymptote is `rest-luminance-cap` (composited ground luminance can never
exceed it, while density ordering inside the ground stays monotone), and
composites ground UNDER the active tier. Bloom feeds on the active tier
only. Story marks at the tile cap therefore hold ≥ 3:1 luminance over
the fully-summed ground by construction (0.92 / 0.30). The active tier
keeps the original gamma + `tile-luminance-cap` chain, with one
addition: the accumulation target's alpha channel carries an onset-pulse
map that briefly lifts the cap toward `ink-hero` where a subset's color
is actually changing, so recolors are perceivable even for subsets
already at the cap (engine.js header notes #7–#8).

### 3.5 Reduced-motion mode

When reduced motion is active, positional interpolation **never plays**:

- `tween()` applies the target instantly and performs a canvas-level
  crossfade of `--dur-reduced-crossfade` (400ms) between the previous frame
  (captured to a texture) and the new one. Implementation is engine-internal;
  the observable behavior is: no dot ever moves across the screen.
- `scrubBetween`/`setScrub` snap to the nearest keyframe end state with the
  same crossfade (the driver feeds keyframe indices, §6.3).
- `setReducedMotion(bool)` switches at runtime without re-boot.

### 3.6 Resilience

The engine listens for `webglcontextlost`/`webglcontextrestored`, prevents
default on loss, and re-creates program + buffers and re-uploads current A/B
state on restore. `main.js` pauses the engine on
`document.visibilitychange: hidden` and resumes on visible.

---

## 4. SCENE MODULE CONTRACT — `docs/js/scenes/sNN.js`

One default export per file. **Scenes never touch the GL context, the
canvas, the scroll position, or global DOM outside their assigned overlay
containers.** Scenes are pure describers: per-dot target arrays + D3
overlays + prose beats.

```js
export default {
  id: 's03',                 // 's01'..'s18', matches file name
  act: 1,                    // 0..5, 6 = coda
  title: 'The flood',        // storyboard scene name (rail kicker)
  layoutName: 'family-race', // storyboard §Units layout name, for audit

  // Data this scene needs before it can activate (driver preloads one scene ahead)
  needs: {
    scene: true,                    // docs/data/scenes/s03.json
    series: ['family_cumulative'],  // sections of series.bin
    zoom: null,                     // or manifest.zoom key, e.g. 'mexeng'
  },

  // Scales shared by dots and overlay. Called on activation and on resize.
  // MUST register every scale used by both layers (shared.js registry, §6.1).
  scales(data, view) -> { name: d3Scale, ... },

  // Per-dot target attribute arrays. Called after scales(), on activation
  // and on resize. Pure function of (data, view): no DOM, no globals.
  layout(data, view) -> {
    states: { [stateKey]: DotState },     // one entry per distinct dot arrangement
    keyframes?: [ { at: 0.0, state: 'k0' }, ... ]  // scrub scenes only; `at`
                                          // ascending in [0,1]; driver scrubs
                                          // adjacent pairs (non-uniform time
                                          // mapping lives HERE, e.g. S1's
                                          // 40%-on-the-goal compression)
  },

  // D3/HTML annotation layer. container = { svg: d3 selection of this scene's
  // <g> in #overlay, html: d3 selection of this scene's <div> in #html-overlay }.
  // Returns a handle; exit() MUST remove every node, timer, and listener.
  overlay(container, data, view, scales) -> {
    step(beatId),   // beat activated (also called in reduced-motion mode)
    scrub(t)?,      // scrub scenes: driver-smoothed t in [0,1]
    exit(),
  },

  // The prose rail + trigger script. Order = scroll order.
  beats: [ Beat, ... ],

  // 1:1 tick scenes only (S1, S6, S7, S8; S18 replay lanes)
  zoom?: {
    key: 'mexeng',            // manifest.zoom key
    tagBit: 'ZOOM_MEXENG',    // population flags bit (§5.3) owning this window's dots
    grainText: '1 dot = 1 trade · showing every {n}th of {count} trades',
  },

  // Optional reduced-motion overrides (§9); defaults usually suffice
  reducedMotion?: {
    states?: { [beatId]: stateKey },  // substitute end states
  },

  // Optional: single-anchor-mark re-renders for S16's lens carousel.
  // rect is the target sub-region; returns a partial state + mini-axis drawer.
  anchors?: {
    braid(data, view, rect) -> { state: DotState, drawAxes(g) },
  },
}
```

### 4.1 Beat shape

```js
Beat = {
  id: 'b1',                       // unique within the scene
  html: '<p>…</p>',               // strategist-voice prose card content
                                  // (storyboard-verbatim where numbers appear);
                                  // deploy-frozen numbers via data-slot (§8.6)
  trigger: 'step',                // default: step-trigger at 55% viewport,
                                  // 10% hysteresis (tokens)
  // or:  trigger: { type: 'scrub', span: 2.0 }  // viewport-heights of pinned
  //      track this beat contributes; scene total for S1 ≤ 6 (hard budget)
  state: 'assemble',              // key into layout().states (omit to keep dots)
  kind: 'resort',                 // 'resort' | 'recolor' | 'pour' | 'ceremonial'
                                  //  | 'instant' — resolves motion opts (§4.4)
  chip: 'color: taker side',      // micro-legend text; ONLY when meaning changes
  grain: {                        // grain plate update; ONLY on grain shifts
    text: '1 dot = $75,000 of matched volume',
    variant: 'debut' | 'return',
  },
  overlayStep: 'b1',              // key passed to overlay.step (defaults to id)
}
```

### 4.2 The 18 scenes (registry order, storyboard-locked)

| id | act | layoutName | mode | zoom tile | notes |
|---|---|---|---|---|---|
| s01 | 0 | resting-field → tick-stream | scrub, **≤ 6 viewports total incl. pre-title** | fraesp | Grain Plate banner pre-title, non-cuttable. Fallback vehicle: norbra (drafted in storyboard). |
| s02 | 0 | timeline-ribbon | scrub | — | re-merge narrated; density spans governed by §3.4 |
| s03 | 1 | family-race | 3 steps | — | dollar counter hero; count-up ≤ `--dur-counter-count-up-max` |
| s04 | 1 | clock-grid | 3 steps | — | channel sequencing: brightness, then recolor at constant luminance |
| s05 | 1 | lorenz-sweep | 3 steps | — | below-threshold band always on; tail dots carry `LORENZ_TAIL` flag |
| s06 | 2 | match-zoom | scrub | mexeng | uniform dot size; emission rate; sampling n printed in grain plate |
| s07 | 2 | goal-clock-lanes | 4 steps | norbra | per-lane native-grain glyphs; identical glyphs across lanes are BANNED (R23) |
| s08 | 2 | dual-path | scrub | gerpar | `state-expiring` color, chip reads "color: contract status" |
| s09 | 2 | shock-align | 3 steps | — | grain shift back out, narrated |
| s10 | 3 | braid | 3 steps | — | dots rest at 25%; braid is D3 marks; 16-for-16 count-up chip |
| s11 | 3 | brier-columns | 3 steps | — | dots never move; columns are outline D3 marks |
| s12 | 4 | boot-ladder | 2 steps | — | fold trigger (Jul 16 check) may fold into s13: registry drops the import, s13 gains beats |
| s13 | 4 | flag-pairs | 4 steps | — | poll bars outline-only |
| s14 | 4 | calibration-curve | 4 steps + live toggle | — | toggle in #html-overlay, keyboard accessible; re-lights `LORENZ_TAIL` dots |
| s15 | 5 | stage-strip | 3 steps | — | drain is `ceremonial`; "devigged" qualifier in beat copy |
| s16 | 5 | lens-carousel | 5 steps | — | one anchor grammar per lens via sibling `anchors` exports |
| s17 | 5 | settle | 1 step | — | ceremonial; hero number + devig line from `manifest.hero` |
| s18 | 6 | free (rail releases) | interactive coda | all | bounded picker + scrubber; lazy `data/replay/` shards |

### 4.3 Zoom (1:1 tick) semantics

Zoom scenes draw tick trades using **only the dots carrying the zoom tag
bit** (population flags, §5.3); the rest of the population rests dimmed
behind (`dimmed-field` state). Constancy is literal: the dots that fly
forward ARE the market's money. Sampling: with `T` = tile trade count
(after any build-time stride `build_stride`, §5.4) and `D` = tagged dot
count, the runtime stride is `ceil(T / D)` and the **narrated n =
build_stride × runtime stride**, interpolated into `zoom.grainText` and
printed in the grain plate. Nothing samples silently.

### 4.4 Beat `kind` → motion opts (resolved by the driver, clamped by the engine)

| kind | duration | stagger | easing |
|---|---|---|---|
| `resort` | `resort-total-target` 1700 | 0.35 | `ease.move` |
| `recolor` | 550 (`recolor-min..max`) | 0 | `ease.move` (positions identical) |
| `pour` | ≥ `settlement-pour-min` 900 | 0.2 | `ease.fall`, hue drains to `state-dead` in the SAME tween, no bounce |
| `ceremonial` | ≤ `ceremonial-max` 2600 | 0.35 | `ease.arrive` |
| `instant` | 0 | — | — |

### 4.5 Overlay obligations

Overlays draw in at `--dur-overlay-draw-in` (400ms) with
`--dur-overlay-stagger` (40ms), at most `--motion-overlay-max-sequenced-elements`
(10) sequenced elements per step, ≤ 2 annotations and ≤ 1 pinned caption per
step (tokens). Non-money marks are outline-only. Zero-baselined columns
always; any non-zero-anchored price axis prints its range and a break
marker. Amber (`accent-annotation`) is annotation-only, never a data
encoding. Interactive overlay elements (S14 toggle, S18 picker) live in the
scene's `#html-overlay` div with `pointer-events: auto` and full keyboard
access; everything else is `pointer-events: none`.

---

## 5. DATA MANIFEST CONTRACT — `docs/data/`

All binaries are **little-endian**, columnar (not interleaved), with every
column's absolute byte offset declared in the manifest. Loaders assert
platform little-endianness once at boot, check each file's magic, and build
zero-copy typed-array views (`shared.js`). Multi-byte columns are 4-byte
aligned; the build inserts padding between sections as needed.

**Budget: ≤ 40MB worst-case single-client transfer** (uncompressed bytes,
desktop path, all scenes visited, before coda replay interaction). Code +
fonts + CSS ≤ 1.5MB on top. Per-tile caps below; the tiling build FAILS
loudly if any cap is exceeded (sampling to fit is allowed only where the
storyboard narrates it).

| file | cap | expected |
|---|---|---|
| `manifest.json` + `markets.json` | 1.5MB | ~1MB |
| `pop-75k.bin` | 4MB | ~2.7MB (164k × 16B) |
| `pop-250k.bin` | 1.5MB | ~0.8MB |
| `zoom/fraesp.bin` | 6MB | build-sampled if over |
| `zoom/mexeng.bin` | 10MB | ~1M trades → stride 2 ≈ 8MB |
| `zoom/gerpar.bin` | 3MB | small window |
| `zoom/norbra.bin` | 3MB | goal window |
| `series.bin` | 4MB | braid panel dominates |
| `data/scenes/*.json` combined | 2MB | small |
| `data/replay/*` (lazy, per selection) | 6MB combined | coda only |

### 5.1 `manifest.json` shape

```jsonc
{
  "version": 1,
  "generated": "2026-07-17T09:00:00Z",     // pipeline run
  "frozen_at": "2026-07-19T13:05:00Z",     // G3 morning-of-final refreeze (deploy)
  "epoch": "2025-05-01T00:00:00Z",         // t0 for all u32 second timestamps
  "population": {
    "desktop": { "url": "data/pop-75k.bin",  "bytes": 2823456, "dots": 164213,
                 "grain_usd": 75000,  "grain_text": "1 dot = $75,000 of matched volume",
                 "columns": [ { "name": "birth_ts", "dtype": "u32", "offset": 16 }, … ] },
    "mobile":  { "url": "data/pop-250k.bin", "bytes": 851200,  "dots": 49264,
                 "grain_usd": 250000, "grain_text": "1 dot = $250,000 of matched volume",
                 "columns": [ … ] }
  },
  "enums": {
    "family": ["winner_futures","match_3way","advancement","spread_total_score",
               "group","stage_elimination","golden_boot","host_novelty_prop","other"],
    "side":   ["taker_no","taker_yes"],
    "fate":   ["settled_no","settled_yes","voided","alive_at_freeze"],
    "flags":  ["LORENZ_TAIL","ZOOM_FRAESP","ZOOM_MEXENG","ZOOM_GERPAR",
               "ZOOM_NORBRA","FINAL_CONTRACT","BELOW_GRAIN_STRATUM","RESERVED7"]
  },
  "teams": ["—","ARG","BEL", …],           // index 0 = none/multi; per-dot u8 index
  "markets": { "url": "data/markets.json" },  // only dot-owning markets + strata rows
  "zoom": {
    "mexeng": { "url": "data/zoom/mexeng.bin", "bytes": 8123456, "trades": 501234,
                "build_stride": 2, "t0": "2026-06-29T22:00:00Z",
                "window": ["2026-06-29T22:00:00Z","2026-06-30T06:30:00Z"],
                "legs": [ { "ticker": "KXWCADVANCE-…-MEX", "label": "Mexico to advance" }, … ] },
    "fraesp": { …same shape… }, "gerpar": { … }, "norbra": { … }
  },
  "series": {
    "url": "data/series.bin",
    "sections": [
      { "name": "family_cumulative", "dtype": "f32", "length": 428,
        "offset": 16, "t0": "2025-05-01T00:00:00Z", "step_s": 86400 }, …
    ]
  },
  "scenes": { "s02": "data/scenes/s02.json", …, "s17": "data/scenes/s17.json" },
  "hero": {                                  // S17; written by the G3 refresh pass
    "instrument": "winner_futures_pair",     // author decision, Gate 2 Q3
    "legs": [
      { "ticker": "KXMENWORLDCUP-26-ES", "label": "Spain", "price_c": 0, "devig_pct": 0.0 },
      { "ticker": "KXMENWORLDCUP-26-??", "label": "OPPONENT", "price_c": 0, "devig_pct": 0.0 }
    ],
    "threeway": [ { "ticker": "…", "label": "…", "price_c": 0, "devig_pct": 0.0 } ],
    "provenance": "raw traded price, frozen at pipeline run {frozen_at}; multi-way legs sum above 100% before the vig is removed; this number does not update"
  },
  "census": {                                // S1 pre-title + S5 band, refrozen at deploy
    "total_usd": 0, "total_trades": 0, "months": 13,
    "below_grain": { "markets": 0, "usd": 0 }
  },
  "coda": { "markets_url": "data/replay/index.json" }
}
```

Rules: every dated figure a scene prints comes from `manifest` or its scene
JSON. `dots`, `grain_usd`, `grain_text`, `census.*`, `hero.*` are rewritten
by the deploy re-run; builders read, never write, never hardcode.

### 5.2 Population tile binary — `pop-75k.bin` / `pop-250k.bin`

Header (16 bytes): ASCII magic `RTPOP1\0\0` (8B) · `u32 count` · `u32
reserved`. Then columns, in this fixed order, each at the manifest-declared
offset (u32/f32/u16 sections 4-byte aligned; the build pads):

| # | column | dtype | bytes | meaning |
|---|---|---|---|---|
| 1 | `birth_ts` | u32 | 4N | seconds since `manifest.epoch` of the dot's volume bucket (dots sorted ascending by this column; **dot index = identity**) |
| 2 | `dollars` | f32 | 4N | exact matched notional this dot carries (~grain, varies at tail) |
| 3 | `market` | u16 | 2N (+pad) | index into `markets.json` rows |
| 4 | `family` | u8 | N | `enums.family` index |
| 5 | `team` | u8 | N | `manifest.teams` index; 0 = none/multi |
| 6 | `side` | u8 | N | `enums.side` (taker side) |
| 7 | `price_band` | u8 | N | VWAP of the dot's bucket in whole cents 0–100; 255 = mixed |
| 8 | `fate` | u8 | N | `enums.fate` at freeze |
| 9 | `flags` | u8 | N (+pad to 4) | bitfield, bit i = `enums.flags[i]` |

16 bytes/dot + header. Identity is structural: the S5 Lorenz-tail dots that
sag in S14 are the same indices (`LORENZ_TAIL` bit); the S1/S17 final
contract dots are `FINAL_CONTRACT`; zoom scenes select by their `ZOOM_*`
bit. Markets whose lifetime tape is below one grain own zero dots and live
in `markets.json` strata rows plus `census.below_grain` (S5 band).

### 5.3 Flags bitfield

bit 0 `LORENZ_TAIL` (S5 tail → S14 re-light) · bit 1 `ZOOM_FRAESP` · bit 2
`ZOOM_MEXENG` · bit 3 `ZOOM_GERPAR` · bit 4 `ZOOM_NORBRA` · bit 5
`FINAL_CONTRACT` (S17 underline, S18 settle) · bit 6 `BELOW_GRAIN_STRATUM`
(reserved; strata render as a band, not dots) · bit 7 reserved.

### 5.4 Zoom tick tile binary — `data/zoom/*.bin`

1 row = 1 trade (after optional narrated `build_stride`). Header (16 bytes):
magic `RTZM1\0\0\0` · `u32 count` · `u32 reserved`. Columns in fixed order,
offsets in `manifest.zoom[key].columns` (same format as population columns):

| column | dtype | meaning |
|---|---|---|
| `ts_ms` | u32 | milliseconds since `manifest.zoom[key].t0` |
| `contracts` | u32 | contracts in the print |
| `notional_usd` | f32 | dollars matched |
| `price_c` | u8 | price in cents (1–99) |
| `side` | u8 | taker side, `enums.side` |
| `leg` | u8 | index into `manifest.zoom[key].legs` |
| `flags` | u8 | bit 0 = detector-anchored repricing event; others reserved |

16 bytes/trade + header. Trades sorted by `ts_ms` ascending.

### 5.5 `series.bin` and per-scene JSON

`series.bin`: header magic `RTSER1\0\0` + `u32 sectionCount` + `u32
reserved`; sections are flat typed arrays described only by the manifest
(`dtype`, `length`, `offset`, optional `t0`/`step_s` for regular time
series, optional `scale` divisor for quantized ints). Anything an axis needs
beyond that (irregular timestamps, labels) ships in the scene JSON instead.

`data/scenes/sNN.json`: small (< 100KB each), axis-ready aggregates copied
from the pipeline exports named in the storyboard's per-scene Data blocks
(e.g. s03 ← `family_crossover.json` + counter totals; s11 ←
`scores_match3way_by_source_horizon.csv` rows; s14 ← FLB buckets both
weightings). Each carries `"_provenance": { "sources": [pipeline paths],
"generated": ISO }`. Numbers appear exactly as the dossier's corrected
claims; the deploy re-run rewrites these files.

### 5.6 Coda replay shards — `data/replay/`

`index.json`: picker rows `{ ticker, title, family, team, dollars,
settlement, shard }` for the bounded market list (dot-owning markets,
ranked by lifetime dollars; the build caps the list to hold the 6MB shard
budget). Shards are `RTSER1`-format binaries of per-market price/volume
series at the coarsest LOD that preserves the price life (daily for
futures, minute inside match windows). Fetched on selection only.

---

## 6. Shared scale registry, scroll driver, geometry

### 6.1 Scale registry (`docs/js/shared.js`, written)

```js
import { registry } from '../shared.js';
registry.register('s10.x', scale);   // owner: the scene, inside scales()
registry.get('s10.x');               // consumers (overlay, S16 lenses)
registry.clearScene('s10');          // driver calls on scene exit
// global keys, owned by main.js: 'global.time' (May 2025 → Jul 2026),
// 'global.price' (0..100 cents) — recomputed on resize before scene scales()
```

One coordinate system: D3 scales in CSS pixels feed both the dot layouts
and the SVG overlay; the engine renders in the same CSS-pixel space
(dpr handled internally). Anything positioned by two layers must go through
one registered scale.

### 6.2 View object (built by `main.js`, passed to scales/layout/overlay)

```js
view = {
  W, H, dpr, mobile,          // CSS px viewport, capability tier
  reducedMotion,              // live boolean
  region: { x, y, w, h },     // the stage rect: desktop = right ~64% with 8%
                              // margins (rail owns the left 480px + 48px inset);
                              // mobile = top ~62vh
  safe: px,                   // token safe-area
  tokens,                     // parsed tokens.json
  color(name, alpha?),        // -> [r,g,b,a] floats from tokens (shared.js)
  css(name),                  // -> 'var(--name)' passthrough for overlay use
  grain: { usd, text, dots }, // the LOADED tile's grain (never assume 75k)
}
```

### 6.3 Scroll driver semantics (hand-rolled, in `main.js`; no scrolly lib)

- **Mechanism:** passive `scroll` listener + rAF coalescing. Not
  IntersectionObserver: IO notifications ride main-thread rendering steps
  and can arrive seconds late while the compositor scrolls (precedent
  rationale, kept).
- **Rail:** `main.js` builds the rail DOM from the scene registry: one
  `<section class="scene" data-scene>` per scene; each step beat renders a
  `.beat` block (min-height 100vh) containing its `.card`; each scrub beat
  renders a `.scrub-track` of `span × 100vh` with a sticky card. Cards are
  real HTML text (screen-reader readable).
- **Step activation:** the active beat is the LAST beat whose sentinel top
  has crossed `--motion-step-trigger-viewport-pct` (55%) of the viewport,
  with `--motion-step-trigger-hysteresis-pct` (10%): moving forward a beat
  activates at 55%; moving backward the earlier beat re-activates only when
  the sentinel falls back below 65%. Direction-symmetric, idempotent;
  re-entering a beat from either direction lands the identical end state
  (interrupt-retargeting makes mid-flight reversals safe).
- **On activation, in order:** scene enter (if new: `scales()` →
  `layout()` → `overlay()` mount; exit previous scene's overlay), grain
  plate update (if `beat.grain`), chip update + pulse (if `beat.chip`),
  `engine.tween(states[beat.state], optsFromKind)`, `overlay.step(id)`,
  rail card highlight.
- **Scrub:** while a scrub track is pinned, raw progress = scrolled
  fraction of the track; the driver applies a 120ms critically-damped lerp
  (`--dur-scrub-lerp-smoothing`), maps t piecewise across the scene's
  `keyframes` (this is where S1's non-uniform time compression lives),
  drives `engine.scrubBetween`/`setScrub` on the active keyframe pair, and
  calls `overlay.scrub(t)`.
- **Resize:** debounced (160ms). Recompute view + global scales, re-run
  active scene `scales()` + `layout()`, `engine.setState` current end state
  (hard set, no tween), redraw overlay.
- **Preload:** activating scene k triggers fetches for scene k+1's `needs`
  (zoom tiles especially). S1's tile is part of the boot load set.
- **Coda:** at S18 the rail releases: native scroll continues into the
  bounded interactive block; driver stops beat-tracking past its last
  sentinel and hands the engine to the replay UI (fade-up per tokens).

### 6.4 Memory discipline

Only the active scene's `layout()` result is retained (plus the next
scene's prefetched data). A full DotState is ~2.6MB at desktop N; scenes
with many states should build them lazily per beat where practical. Scene
JSON and series sections stay resident (small); zoom tiles may be released
(`data.zoom[key] = null`) two scenes after last use.

---

## 7. Micro-legend chip and grain plate (driver-owned DOM)

`#chip` (micro-legend): one line, apparatus micro type, fixed corner,
**never disappears** after debut. Text = current color meaning, set only by
beats that change meaning; every change pulses `--dur-chip-pulse` (1200ms).
S8 sets the scene-local text "color: contract status".

`#grain-plate`: tape-voice (Plex Mono) banner stating the current grain.
Debuts pre-title in S1 (non-cuttable, FIX #2), `return` variant on re-merge
(S2, S9). Zoom scenes interpolate `{n}`/`{count}` per §4.3. Text templates
come from `manifest.population[tier].grain_text` and scene `zoom.grainText`;
the plate always describes the tile actually loaded.

---

## 8. Page skeleton, boot, environment

### 8.1 Layers (z-stack from tokens)

`#stage` is fixed, full-viewport: `#gl-canvas` (z 0) → `#dim-scrim` (z 1) →
`#overlay` SVG (z 2) → rail cards (z 3) → `#chip` + `#grain-plate` (z 4) →
skip/controls + `#html-overlay` interactives (z 5).

### 8.2 Title screen

The HTML header IS the S1 pre-title frame's text layer: grain-plate banner,
one caption line (census from manifest via `data-slot`), then the title
lockup **Regulation Time** with the deck "How the market priced the goals,
the upsets, and the favorite that died in ninety minutes." Title renders
over the resting field per storyboard S1.

### 8.3 Capability detection (`main.js`)

Tier `mobile` if: coarse pointer + min(screen dims) < 768px, or
`hardwareConcurrency ≤ 4` and `deviceMemory ≤ 4`. Else `desktop`. WebGL
absence (or `createEngine` returning null / throwing at both tiers) →
static mode: canvas hidden, prose + static end-state figures remain
readable, methods note explains. Optional post-boot demotion per §3.1.

### 8.4 Boot order

1. Detect reduced motion (`prefers-reduced-motion`, live listener) + tier.
2. `fetch design/tokens.json` (law) and `data/manifest.json`.
3. Fill `data-slot` spans from manifest (§8.6).
4. Fetch the tier's population tile + boot series + S1 zoom tile, with
   progress on the title screen.
5. `const { createEngine } = await import('./engine.js')` (dynamic, so the
   skeleton page functions before the engine lands); `createEngine(canvas,
   { count, tokens, reducedMotion })`; fallback chain per §3.1.
6. Build rail from the scene registry; first paint is `setState` (never
   animate the initial render); start the scroll driver.
7. `window.__rt = { activate, scenes, engine, data }` debug hook (kept from
   precedent; used by the Gate 4 checks).

### 8.5 Failure modes

Missing engine.js / missing data / no WebGL → the page stays a readable
document (title, prose rail once scenes exist, methods). Every scene
already owes a static end state; static mode is that plus no canvas.

### 8.6 `data-slot` convention

Any HTML element carrying `data-slot="path.into.manifest"` (e.g.
`data-slot="census.total_usd"`, `data-slot="hero.frozen_at"`) gets its text
content replaced at boot with the formatted manifest value (`data-format`:
`usd`, `count`, `cents`, `pct`, `iso`). Static text in the HTML is the
last-known value and must be marked with `<!-- refrozen at deploy -->`.

---

## 9. Reduced motion (piece-wide behavior)

- Engine: §3.5 (instant states + 400ms canvas crossfade; scrubs snap to
  keyframes).
- Driver: scrub tracks become stepped keyframe crossfades at the same
  scroll positions; counters render final value + fade; overlay draw-ins
  become fades (no rise).
- Scenes: may override end states per beat (`reducedMotion.states`); the
  S14 toggle crossfades between weightings (already specced); every beat's
  end state is static-readable by design, so no scene may *require* motion
  to make its claim.
- The mode is live: flipping the OS setting mid-read switches behavior
  without reload.

---

## 10. Acceptance checklist (Gate 4 gates on these)

1. `python3 docs/design/validate_tokens.py` passes; no hex/duration/size
   literal in any scene or engine file that exists in tokens.
2. Zero non-relative URLs anywhere in `docs/` (grep for `https?://` outside
   comments/methods citations); page loads with network blocked after
   first fetch (service-worker-free offline archive test).
3. Population tile loads; dot count on the grain plate equals
   `manifest.population[tier].dots`; no hardcoded 164k/49k anywhere.
4. Interrupt test: reversing scroll mid-tween never snaps; dots retarget
   from current interpolated positions (precedent semantics).
5. R23 audit: no cross-venue speed language or shared-glyph lanes in s07;
   s10 axis labeled "price (points)".
6. Grain plate present pre-title in s01; every grain shift and color
   meaning change updates plate/chip; chip never disappears after debut.
7. Reduced-motion pass: no positional interpolation plays; every scene
   readable as stills.
8. Worst-case transfer ≤ 40MB; per-tile caps (§5) enforced by the tiling
   build.
9. `window.__rt.activate('s14')` style deep-links work headlessly for
   review screenshots.
10. OG image is the S12 resolved frame; no-JS fallback shows resolved
    frames only.
