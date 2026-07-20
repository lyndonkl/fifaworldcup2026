/* engine.js — Regulation Time: the WebGL population engine.
 *
 * Contract: docs/CONTRACT.md §3 (API), §3.4 (density tone-mapping),
 * §3.5 (reduced motion), §3.6 (resilience). Evolves the proven precedent
 * (understandingsoccer/docs/js/engine.js): a fixed population of N point
 * sprites, structural object constancy (dots are never created or destroyed
 * after boot), every visual change a GPU-interpolated tween between
 * per-identity A->B attribute buffers, interrupts retargeting from the
 * CURRENT interpolated values (baked once on the CPU), never from the stale
 * start state. Premultiplied-alpha color math throughout.
 *
 * What is new beyond the precedent:
 *
 *  1. RENDER PATH — point sprites, measured and chosen over instancing.
 *     At N≈164k both paths are vertex-trivial (164k vs 656k vertices); the
 *     pipeline is fill-bound in the accumulation pass, where both paths
 *     rasterize identical fragments. Point sprites avoid the WebGL1
 *     ANGLE_instanced_arrays dependency and 4x attribute duplication. The
 *     one instancing advantage — escaping ALIASED_POINT_SIZE_RANGE — is
 *     checked at boot and logged (every realistic target reports >= 64
 *     device px; the piece's largest dot is 9px radius * 2 * dpr = 36).
 *     Measurement instrument: engine.frameCost() + docs/dev/engine-test.html.
 *
 *  2. DENSITY TONE-MAPPING (contract §3.4, tokens.density_tone_mapping) —
 *     a two-pass pipeline, not optional: all N points accumulate additively
 *     into an offscreen float target (WebGL2 + EXT_color_buffer_float, or
 *     WebGL1 + OES_texture_half_float; fixed high-headroom RGBA8 pre-scale
 *     fallback otherwise); a tone-map chain then applies power-law
 *     compression (uDensityGamma), the luminance cap (uLumCap), FIXED-radius
 *     bloom (uBloomRadiusPx, from tokens by dpr, never density), and
 *     composites over bg-canvas.
 *
 *  3. CAPABILITY SCALING — the engine does not pick N; the tile picks N
 *     (contract §3.1). createEngine allocates for exactly opts.count and
 *     THROWS on allocation/compile failure so main.js can fall back to the
 *     mobile tile (a true sample by construction: the $250k/dot tile is the
 *     same money at coarser grain — the engine never truncates a tile,
 *     truncation would silently delete money). frameCost() is the probe for
 *     the optional pre-first-scene quality demotion.
 *
 *  4. REDUCED MOTION (contract §3.5) — positional interpolation never
 *     plays: targets apply instantly and the engine crossfades the previous
 *     composited frame (captured to a texture) into the new one at the
 *     canvas level. Scrub pairs snap to the nearest end state with the same
 *     crossfade. Runtime-switchable without re-boot.
 *
 *  5. ZOOM SUB-POPULATION CHANNEL (contract §3.2/§4.3) — tween() and
 *     scrubBetween() accept opts.emitOrder, a caller-supplied Float32Array(N)
 *     of per-identity phases in [0,1] that replaces the deterministic
 *     stagger hash for that transition. Zoom scenes use it to stream the
 *     tagged tick dots in trade-time order (emission) while the untagged
 *     population rests (A === B for those dots, so they hold still).
 *     Deterministic by construction: the scene supplies the same array on
 *     every replay, so reverse scrubs mirror forward ones.
 *
 *  6. WEBGL1 FALLBACK — one GLSL ES 1.00 dialect for both contexts;
 *     engine.mode reports 'webgl2' | 'webgl1'. createEngine returns null
 *     only when no WebGL context exists at all.
 *
 *  7. EMPHASIS: RESTING-FIELD-DIM / ACTIVE-SUBSET-BOOST + ONSET PULSE
 *     (post-Gate-3 revision, research/revision/perception-brief.md §2,
 *     §4, §7, §9b, §10) — the ACTIVE/REST distinction rides luminance
 *     and motion-onset, not hue (every identity/side token is
 *     functionally isoluminant with field.rest at swatch level; the
 *     magnocellular pathway that answers "did that just change" is
 *     blind to hue, brief §1-§2):
 *       (a) REST/ACTIVE classification (VERT_POINTS) — each dot's OWN
 *           current alpha (the vertex stage's A/B mix, no new attribute)
 *           sorts it into rest-tier (alpha <= uRestClassifyMax, energy
 *           scaled by uRestDim), active-tier (alpha >= uActiveClassifyMin,
 *           scaled by uActiveBoost), or the 0.42-0.90 receding band
 *           (state.dead / state.expiring, FIX #1 for S8, left at 1.0x —
 *           that settled hue semantics is untouched).
 *       (b) ONSET PULSE (VERT_POINTS + tone-map) — colorDelta =
 *           length(aColB - aColA) is exactly "is this dot's color
 *           changing in THIS transition" (recomputed fresh on every
 *           tween() including interrupts, because bakeCurrentIntoA
 *           freezes the true current value into aColA), and it drives a
 *           brief size + luminance transient across the first
 *           uPulseWindow fraction of each dot's own post-stagger
 *           progress. Progress-driven, so it is scrub-safe and
 *           automatically absent under reduced motion (A===B there).
 *           ON BY DEFAULT for every tween()/scrubBetween(); callers opt
 *           a transition out with { pulse: false }. Two mechanisms make
 *           the transient PERCEIVABLE (the Gate-4 audit found recolors
 *           rendering silently because the old luminance-gain pulse was
 *           eaten by the 0.92 cap on any subset already at the cap):
 *           the accumulation target's previously-unused alpha channel
 *           accumulates a pulse-presence map, and the compress/composite
 *           passes LIFT the luminance cap toward ink-hero (1.0) where
 *           that map is hot — an at-cap subset still flashes; and a
 *           pulsing GROUND dot contributes its transient energy sliver
 *           to the ACTIVE pass, so an onset is never trapped under the
 *           rest-tier ceiling (note #8). Object constancy is untouched:
 *           neither (a) nor (b) ever changes aPosA/aPosB, only energy
 *           and the size already being tweened.
 *
 *  8. TIERED TONE-MAP — THE FIGURE-GROUND REPAIR (Gate-4 review,
 *     research/design-review/visual-story-review.md P1 / Tier 0.1) —
 *     one shared accumulation pass let SUMMED rest-dot energy climb the
 *     same gamma-0.35 curve as story marks to the same 0.92 cap: any
 *     dense resting mass rendered near-white and out-shone every story
 *     mark ("walls of pale static" in 15 of 18 scenes). No flat per-dot
 *     alpha can fix that (holding a 100-overlap region under the cap at
 *     gamma 0.35 needs per-dot energy so low a lone dot vanishes). The
 *     tiers therefore accumulate and tone-map SEPARATELY:
 *       - GROUND pass — every dot below uActiveClassifyMin (rest tier
 *         plus the dead/expiring band) accumulates into a HALF-RES
 *         float target (ground needs no edge acuity; quarter fill
 *         cost). Its tone-map (FRAG_COMPRESS_REST) applies the same
 *         gamma, then a Reinhard soft-knee to uRestLumCap
 *         (`density-rest-luminance-cap`, 0.30): composited ground
 *         luminance can NEVER exceed the ceiling, while density
 *         ordering inside the ground stays monotone — the §3.4
 *         "density reads as luminance" physics survives inside the
 *         tier, where a hard min() would flatten it to a plateau.
 *       - ACTIVE pass — dots at/above uActiveClassifyMin accumulate at
 *         full res under the existing gamma + uLumCap (0.92) chain,
 *         plus the note-#7 pulse-map cap lift.
 *       - BLOOM feeds on the active tier only (story-mark glow; a
 *         blooming ground was half of the wall).
 *       - COMPOSITE draws ground UNDER active: ground light is occluded
 *         in proportion to the active layer's share of the luminance
 *         budget, so a bright mark keeps its own hue instead of gaining
 *         the field tint, and story marks hold >= 3:1 luminance over
 *         the fully-summed ground by construction (0.92 / 0.30).
 *     Object constancy, interrupt-retargeting, the zoom order channel,
 *     reduced motion, and the WebGL1 / RGBA8-prescale fallback are all
 *     unchanged: the split is a per-vertex routing decision inside one
 *     frame, not a population or API change.
 *     All numeric knobs are tokens.json `emphasis.*`,
 *     `dot.opacity-*-classify-*`, and `density_tone_mapping.*` (tokens
 *     are law, same as everywhere else in this file); see tokens.css
 *     for the human-readable version.
 *
 * Tokens are law: every color, duration, easing curve, gamma, cap and
 * bloom radius is read from opts.tokens (parsed docs/design/tokens.json).
 * The few remaining numeric constants below are engineering constants with
 * no token counterpart (shader anti-aliasing profile, accumulation
 * headroom, Gaussian kernel shape, LUT resolution); they are gathered here
 * and documented so the Gate 4 literal-grep has one place to look.
 */

/* ------------------------------------------------------------------ */
/* Engineering constants (no token counterpart — see header note)      */

const DOT_EDGE_IN = 0.82;    // point-sprite AA profile (precedent value):
const DOT_EDGE_OUT = 1.0;    //   coverage = 1 - smoothstep(in, out, dist)
const ALPHA_DISCARD = 0.004; // discard threshold for invisible fragments
const PRESCALE_HEADROOM = 32;// RGBA8 fallback: energy pre-scaled by 1/32 in
                             // the point pass, re-scaled x32 in the
                             // tone-map, buying 32x additive headroom
const BLOOM_GAIN = 0.5;      // bloom STRENGTH is an implementation constant
                             // (only the RADIUS is tokenized); the composite
                             // re-applies the luminance cap after the add so
                             // the §3.4 invariant survives regardless
const BLUR_TAPS = 5;         // symmetric 9-tap Gaussian (0..4 each side),
const BLUR_SIGMA_TAPS = 2.0; //   sigma = 2 taps; tap spacing = radius/4 px,
                             //   so the kernel spans ±radius device px
const REST_TIER_RES = 0.5;   // ground tier accumulates at half resolution
                             // (reuses the bloom chain's halfW/halfH targets'
                             // dimensions; ground needs no edge acuity and the
                             // quarter fill cost pays for the second pass)
const EASE_LUT_N = 1024;     // CPU easing LUT resolution (interrupt baking)
const NEWTON_ITERS_JS = 8;   // CPU cubic-bezier solve (LUT build only)
const FRAME_STAMPS = 4;      // ring buffer for frameCost() (3 intervals)

/* ------------------------------------------------------------------ */
/* Cubic-bezier easing: tokens carry CSS cubic-bezier() strings; the    */
/* engine implements the same curves in GLSL (Newton solve, deviation   */
/* from the CSS curve << 0.01) and mirrors them on the CPU via a LUT    */
/* for the interrupt-retarget bake. 'linear' is the identity bezier     */
/* used for scrub pairs (the driver owns scrub time-mapping).           */

function parseBezier(str) {
  const m = /cubic-bezier\(\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*\)/.exec(str);
  if (!m) throw new Error(`[rt-engine] unparseable easing token: ${str}`);
  return [+m[1], +m[2], +m[3], +m[4]];
}

function bezierSolver(x1, y1, x2, y2) {
  return function (x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < NEWTON_ITERS_JS; i++) {
      const mt = 1 - t;
      const xt = 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t - x;
      const dx = 3 * mt * mt * x1 + 6 * mt * t * (x2 - x1) + 3 * t * t * (1 - x2);
      if (Math.abs(dx) < 1e-6) break;
      t = Math.min(Math.max(t - xt / dx, 0), 1);
    }
    const mt = 1 - t;
    return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
  };
}

/* ------------------------------------------------------------------ */
/* Shaders — one GLSL ES 1.00 dialect for WebGL1 and WebGL2.            */

const VERT_POINTS = `
precision highp float;
attribute vec2 aPosA;
attribute vec2 aPosB;
attribute vec4 aColA;
attribute vec4 aColB;
attribute float aSizeA;
attribute float aSizeB;
attribute float aOrder;   // per-identity phase: stagger hash or emitOrder
uniform float uT;         // master transition progress 0..1
uniform float uStagger;   // fraction of the timeline used for per-dot offsets
uniform vec2 uE1;         // active easing cubic-bezier control point 1
uniform vec2 uE2;         // control point 2
uniform vec2 uRes;        // canvas CSS pixel size
uniform float uDpr;
/* Onset pulse (engine.js header note #7 / tokens.json emphasis.*): a
 * brief size/luminance overshoot on dots whose color is actually
 * changing in THIS transition, confined to the first uPulseWindow
 * fraction of each dot's own post-stagger progress u. */
uniform float uPulseWindow;
uniform float uPulseSizeGain;
uniform float uPulseColorEps;
uniform float uPulseEnable;   // 1 unless the caller passed { pulse: false }
uniform float uPulseLumGain;
/* Tiered tone-map routing (header note #8): which tier THIS draw call
 * accumulates. 0 = ground (rest + dead/expiring band, half-res target),
 * 1 = active (story tier + any ground dot's live onset transient). */
uniform float uTierPass;
uniform float uSizeScale;     // 1.0 full-res target; REST_TIER_RES on ground
uniform float uRestClassifyMax;
uniform float uActiveClassifyMin;
uniform float uRestDim;
uniform float uActiveBoost;
varying vec4 vColor;
varying float vPulse;     // 0..1 envelope; also the pulse-map contribution
varying float vEnergy;    // per-dot premultiplied energy scale for THIS pass

/* Solve the CSS cubic-bezier timing function y(x) by Newton iteration.
 * 5 iterations from t=x keeps deviation from the CSS curve far below the
 * contract's 0.01 tolerance for all three token curves (their x-derivative
 * never degenerates). */
float bezierY(float x, vec2 p1, vec2 p2) {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;
  float t = x;
  for (int i = 0; i < 5; i++) {
    float mt = 1.0 - t;
    float xt = 3.0 * mt * mt * t * p1.x + 3.0 * mt * t * t * p2.x + t * t * t - x;
    float dx = 3.0 * mt * mt * p1.x + 6.0 * mt * t * (p2.x - p1.x) + 3.0 * t * t * (1.0 - p2.x);
    t = clamp(t - xt / max(dx, 1e-4), 0.0, 1.0);
  }
  float mt = 1.0 - t;
  return 3.0 * mt * mt * t * p1.y + 3.0 * mt * t * t * p2.y + t * t * t;
}

void main() {
  float span = max(1.0 - uStagger, 1e-4);
  float u = clamp((uT - aOrder * uStagger) / span, 0.0, 1.0);
  float e = bezierY(u, uE1, uE2);
  vec2 p = mix(aPosA, aPosB, e);
  vec4 c = mix(aColA, aColB, e);
  float s = mix(aSizeA, aSizeB, e);

  /* colorDelta > uPulseColorEps means this dot's target actually differs
   * from where it started THIS transition (bakeCurrentIntoA already
   * froze the true current value into aColA, including on interrupts, so
   * this is always "changing in the current transition," never stale).
   * changeMag saturates to 1 quickly rather than scaling linearly with
   * delta size, so even a modest recolor gets the full change-blindness
   * countermeasure, not a partial one. */
  float colorDelta = length(aColB - aColA);
  float changeMag = clamp(colorDelta / max(uPulseColorEps, 1e-4), 0.0, 1.0) * uPulseEnable;
  float pulseT = clamp(u / max(uPulseWindow, 1e-4), 0.0, 1.0);
  float envelope = sin(3.14159265 * pulseT); // 0 -> 1 -> 0 across [0, uPulseWindow], 0 after
  vPulse = changeMag * envelope;

  /* Tier routing (header note #8). The ground pass takes every dot below
   * the active threshold at its base energy. The active pass takes the
   * story tier, PLUS any ground dot with a live onset pulse — but only
   * its transient energy sliver, so the onset flashes above the ground
   * ceiling and fades back into the ground continuously (no tier pop). */
  float isActive = step(uActiveClassifyMin, c.a);
  float pulsing = step(0.001, vPulse);
  float inPass = uTierPass > 0.5 ? max(isActive, pulsing) : 1.0 - isActive;
  if (inPass < 0.5) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);  // outside the clip volume: culled
    gl_PointSize = 0.0;
    vColor = vec4(0.0);
    vPulse = 0.0;
    vEnergy = 0.0;
    return;
  }
  if (uTierPass > 0.5) {
    vEnergy = isActive > 0.5
      ? uActiveBoost * (1.0 + vPulse * uPulseLumGain)
      : vPulse * uPulseLumGain;   // ground dot: onset transient sliver only
    /* Onset flash tilts toward ink-hero white (same token as the energy
     * gain): a saturated hue at the cap is channel-clamped, so an energy
     * gain alone cannot brighten it — whitening is the only luminance
     * headroom left, and a brief white-core flash is already the
     * annotated-singleton grammar. Ground-pass base color never tilts. */
    c.rgb = mix(c.rgb, vec3(1.0), vPulse * uPulseLumGain);
  } else {
    /* rest-tier dim below the classify ceiling; the dead/expiring band
     * (uRestClassifyMax..uActiveClassifyMin) stays at 1.0x — FIX #1 (S8)
     * audited that pair and this revision must not disturb it. */
    vEnergy = c.a <= uRestClassifyMax ? uRestDim : 1.0;
  }

  vec2 clip = (p / uRes) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = max(s * (1.0 + vPulse * uPulseSizeGain), 0.0) * uDpr * uSizeScale;
  vColor = c;
}`;

const FRAG_POINTS = `
precision mediump float;
uniform float uPreScale;  // 1.0 on the float path; 1/32 on the RGBA8 path
varying vec4 vColor;
varying float vPulse;
varying float vEnergy;    // tier/emphasis energy scale, decided per-vertex (note #7/#8)
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float dist = length(d) * 2.0;
  float alpha = (1.0 - smoothstep(${DOT_EDGE_IN.toFixed(4)}, ${DOT_EDGE_OUT.toFixed(4)}, dist)) * vColor.a;
  if (alpha < ${ALPHA_DISCARD.toFixed(4)}) discard;
  /* premultiplied energy, summed additively (blend ONE, ONE).
   * rgb = tier-scaled light; a = pulse-presence map (meaningful in the
   * ACTIVE pass, where FRAG_COMPRESS reads it to lift the luminance cap
   * under an onset flash; the ground pass never reads its alpha). */
  gl_FragColor = vec4(vColor.rgb * vEnergy, vPulse) * alpha * uPreScale;
}`;

const VERT_QUAD = `
precision highp float;
attribute vec2 aXY;
varying vec2 vUv;
void main() {
  vUv = aXY * 0.5 + 0.5;
  gl_Position = vec4(aXY, 0.0, 1.0);
}`;

/* Tone-map stage 1, ACTIVE tier (contract §3.4): power-law compression of
 * accumulated luminance, then the luminance cap. Compression runs in the
 * luminance domain so chromaticity survives; the cap guarantees no cluster
 * outshines the annotated singleton (uLumCap is a fraction of ink-hero
 * luminance) — EXCEPT under a live onset pulse (header note #7b): the
 * accumulated pulse map lifts the cap toward 1.0 so a subset already
 * sitting at the cap still flashes perceivably when it recolors. The map
 * rides through to FRAG_COMPOSITE in the output alpha so the post-bloom
 * re-cap honors the same lift. */
const FRAG_COMPRESS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uGamma;       // tokens.density_tone_mapping.gamma
uniform float uLumCap;      // tokens.density_tone_mapping["tile-luminance-cap"]
uniform float uAccumScale;  // 1.0 float path; 32.0 RGBA8 pre-scale path
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
void main() {
  vec4 t = texture2D(uTex, vUv);
  vec3 c = t.rgb * uAccumScale;
  float pulse = clamp(t.a * uAccumScale, 0.0, 1.0);
  float y = dot(c, LUMA);
  if (y <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, pulse); return; }
  float cap = mix(uLumCap, 1.0, pulse);
  float yc = min(pow(y, uGamma), cap);
  gl_FragColor = vec4(c * (yc / y), pulse);
}`;

/* Tone-map stage 1, GROUND tier (header note #8): same gamma, then a
 * Reinhard soft-knee to the rest ceiling instead of a hard min(). The
 * asymptote guarantees composited ground luminance NEVER exceeds
 * uRestLumCap (well below every story mark), while density ordering
 * inside the ground stays monotone — a hard cap would flatten any mass
 * past ~1 overlap into one plateau and kill the §3.4 density read. */
const FRAG_COMPRESS_REST = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uGamma;        // tokens.density_tone_mapping.gamma (shared)
uniform float uRestLumCap;   // tokens.density_tone_mapping["rest-luminance-cap"]
uniform float uRestKnee;     // tokens.density_tone_mapping["rest-knee"]
uniform float uAccumScale;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
void main() {
  vec3 c = texture2D(uTex, vUv).rgb * uAccumScale;
  float y = dot(c, LUMA);
  if (y <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float yc = pow(y, uGamma);
  float yr = uRestLumCap * yc / (yc + uRestKnee);
  gl_FragColor = vec4(c * (yr / y), 1.0);
}`;

/* Separable Gaussian blur at half resolution. uStep is one tap spacing in
 * UV; the kernel spans +-uBloomRadiusPx device pixels by construction. */
const FRAG_BLUR = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;
uniform float uW[${BLUR_TAPS}];
void main() {
  vec3 acc = texture2D(uTex, vUv).rgb * uW[0];
  for (int i = 1; i < ${BLUR_TAPS}; i++) {
    vec2 o = uStep * float(i);
    acc += (texture2D(uTex, vUv + o).rgb + texture2D(uTex, vUv - o).rgb) * uW[i];
  }
  gl_FragColor = vec4(acc, 1.0);
}`;

/* Tone-map stage 2: fixed-radius bloom add (active tier only), cap
 * re-applied (with the pulse lift preserved), then the GROUND layer
 * composited UNDER the active layer, all over bg-canvas (the canvas is
 * opaque; the shader IS the compositor). Ground-under-active: the ground's
 * light is occluded in proportion to the active layer's share of the
 * luminance budget, so a bright story mark keeps its own hue instead of
 * gaining the field tint, and total luminance never exceeds the (lifted)
 * cap: y_total <= cap*s + restCap*(1-s) <= cap. */
const FRAG_COMPOSITE = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uScene;   // active tier: rgb light + pulse map in alpha
uniform sampler2D uBloom;   // blurred active tier
uniform sampler2D uRest;    // ground tier (half-res, already rest-capped)
uniform vec3 uBg;           // tokens.colors["bg-canvas"].rgba
uniform float uLumCap;
uniform float uBloomGain;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
void main() {
  vec4 act = texture2D(uScene, vUv);
  vec3 light = act.rgb + texture2D(uBloom, vUv).rgb * uBloomGain;
  float cap = mix(uLumCap, 1.0, act.a);   // preserve the onset flash (note #7b)
  float y = dot(light, LUMA);
  if (y > cap) { light *= cap / y; y = cap; }
  float occlusion = 1.0 - clamp(y / uLumCap, 0.0, 1.0);
  light += texture2D(uRest, vUv).rgb * occlusion;
  gl_FragColor = vec4(uBg + light, 1.0);
}`;

/* Present pass: blit the composited frame to the canvas, mixing from the
 * captured previous frame during a reduced-motion crossfade (uFade=1 when
 * no fade is active). */
const FRAG_PRESENT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uFrame;
uniform sampler2D uPrev;
uniform float uFade;
void main() {
  vec3 c = mix(texture2D(uPrev, vUv).rgb, texture2D(uFrame, vUv).rgb, uFade);
  gl_FragColor = vec4(c, 1.0);
}`;

/* ------------------------------------------------------------------ */

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`[rt-engine] shader compile: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

function link(gl, vertSrc, fragSrc, attribNames) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  // Deterministic attribute locations (0..k) so enable/disable bookkeeping
  // across the point pass and the quad passes stays trivial.
  attribNames.forEach((name, i) => gl.bindAttribLocation(p, i, name));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`[rt-engine] program link: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

function uniforms(gl, prog, names) {
  const u = {};
  for (const n of names) u[n] = gl.getUniformLocation(prog, n);
  return u;
}

/* ------------------------------------------------------------------ */
/* createEngine (contract §3): returns null iff no WebGL context can be */
/* created; THROWS on shader/allocation failure so main.js can fall     */
/* back to the mobile tile (§3.1).                                      */

export function createEngine(canvas, opts = {}) {
  const N = opts.count | 0;
  const tokens = opts.tokens;
  if (!N || N <= 0) throw new Error('[rt-engine] opts.count (tile dot count) is required');
  if (!tokens) throw new Error('[rt-engine] opts.tokens (parsed tokens.json) is required');
  const dprCap = opts.dprCap !== undefined ? opts.dprCap : 2;
  let reduced = !!opts.reducedMotion;

  /* ---- tokens are law: pull every styling number once, loudly ---- */
  const durations = tokens.motion && tokens.motion.durations_ms;
  const easingTokens = tokens.motion && tokens.motion.easing;
  const density = tokens.density_tone_mapping;
  const bgToken = tokens.colors && tokens.colors['bg-canvas'];
  const dotTokens = tokens.dot;
  const emphasis = tokens.emphasis;
  if (!durations || !easingTokens || !density || !bgToken || !dotTokens || !emphasis) {
    throw new Error('[rt-engine] tokens.json missing motion/density/bg/dot/emphasis sections');
  }
  // Resting-field-dim / active-subset-boost + onset pulse (header note #7).
  const REST_CLASSIFY_MAX = dotTokens['opacity-rest-classify-max'];
  const ACTIVE_CLASSIFY_MIN = dotTokens['opacity-active-classify-min'];
  const REST_DIM = emphasis['rest-dim'];
  const ACTIVE_BOOST = emphasis['active-boost'];
  const PULSE_WINDOW = emphasis['pulse-window'];
  const PULSE_SIZE_GAIN = emphasis['pulse-size-gain'];
  const PULSE_LUM_GAIN = emphasis['pulse-luminance-gain'];
  const PULSE_COLOR_EPS = emphasis['pulse-color-epsilon'];
  // Tiered tone-map (header note #8): the ground tier's composite ceiling.
  const REST_LUM_CAP = density['rest-luminance-cap'];
  const REST_KNEE = density['rest-knee'];
  for (const [name, v] of [
    ['dot.opacity-rest-classify-max', REST_CLASSIFY_MAX],
    ['dot.opacity-active-classify-min', ACTIVE_CLASSIFY_MIN],
    ['emphasis.rest-dim', REST_DIM],
    ['emphasis.active-boost', ACTIVE_BOOST],
    ['emphasis.pulse-window', PULSE_WINDOW],
    ['emphasis.pulse-size-gain', PULSE_SIZE_GAIN],
    ['emphasis.pulse-luminance-gain', PULSE_LUM_GAIN],
    ['emphasis.pulse-color-epsilon', PULSE_COLOR_EPS],
    ['density_tone_mapping.rest-luminance-cap', REST_LUM_CAP],
    ['density_tone_mapping.rest-knee', REST_KNEE],
  ]) {
    if (typeof v !== 'number' || !isFinite(v)) {
      throw new Error(`[rt-engine] tokens.json missing/invalid numeric token: ${name}`);
    }
  }
  const DUR_DEFAULT = durations['resort-total-target'];       // 1700
  const DUR_HARD_CAP = durations['resort-hard-cap'];          // 1800
  const DUR_CEREMONIAL = durations['ceremonial-max'];         // 2600
  // Default stagger fraction is defined by the tokens themselves:
  // resort-stagger-max / resort-total-target (contract §3.3 "≈0.35").
  const STAGGER_DEFAULT = durations['resort-stagger-max'] / DUR_DEFAULT;
  // Reduced-motion crossfade (contract §3.5: 400ms, --dur-reduced-crossfade).
  // tokens.css declares it only inside its @media block and tokens.json does
  // not carry the key yet; 'overlay-draw-in' is the documented same-value
  // alias until the token table gains 'reduced-crossfade'. Flagged in the
  // build notes; NOT a hardcoded literal.
  const DUR_REDUCED_FADE = durations['reduced-crossfade'] !== undefined
    ? durations['reduced-crossfade']
    : durations['overlay-draw-in'];
  const GAMMA = density.gamma;
  const LUM_CAP = density['tile-luminance-cap'];
  const BLOOM_1X = density['bloom-radius-px-1x'];
  const BLOOM_2X = density['bloom-radius-px-2x'];
  const BG = bgToken.rgba;

  const EASE = {
    'ease.move': parseBezier(easingTokens['ease-move']),
    'ease.arrive': parseBezier(easingTokens['ease-arrive']),
    'ease.fall': parseBezier(easingTokens['ease-fall']),
    // identity bezier — scrub pairs interpolate linearly in the driver's t
    'linear': [1 / 3, 1 / 3, 2 / 3, 2 / 3],
  };
  const lutCache = new Map();
  function lutFor(name) {
    let lut = lutCache.get(name);
    if (!lut) {
      const [x1, y1, x2, y2] = EASE[name];
      const f = bezierSolver(x1, y1, x2, y2);
      lut = new Float32Array(EASE_LUT_N + 1);
      for (let k = 0; k <= EASE_LUT_N; k++) lut[k] = f(k / EASE_LUT_N);
      lutCache.set(name, lut);
    }
    return lut;
  }
  function sampleLut(lut, u) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    const x = u * EASE_LUT_N;
    const i = x | 0;
    return lut[i] + (lut[i + 1] - lut[i]) * (x - i);
  }

  /* ---- context: WebGL2, then WebGL1; null iff neither exists ---- */
  const ctxAttrs = {
    alpha: false,             // opaque canvas: the composite pass draws bg-canvas
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true, // engine color math is premultiplied throughout
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  };
  let gl = null;
  let mode = null;
  if (opts._forceMode !== 'webgl1') {
    gl = canvas.getContext('webgl2', ctxAttrs);
    if (gl) mode = 'webgl2';
  }
  if (!gl) {
    gl = canvas.getContext('webgl', ctxAttrs)
      || canvas.getContext('experimental-webgl', ctxAttrs);
    if (gl) mode = 'webgl1';
  }
  if (!gl) return null;

  /* ---- CPU mirrors: exactly the precedent's A/B pair ---- */
  const A = { pos: new Float32Array(N * 2), color: new Float32Array(N * 4), size: new Float32Array(N) };
  const B = { pos: new Float32Array(N * 2), color: new Float32Array(N * 4), size: new Float32Array(N) };

  /* Per-identity stagger hash: deterministic in dot index (= identity,
   * contract §5.2), so replays and reverse scrubs are identical. */
  const staggerHash = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let h = (i * 2654435761) % 4294967296;
    h = (h ^ (h >> 16)) >>> 0;
    staggerHash[i] = (h % 1000) / 999;
  }

  /* ---- Gaussian kernel (shape fixed; radius token sets the spacing) ---- */
  const blurW = new Float32Array(BLUR_TAPS);
  {
    let sum = 0;
    for (let i = 0; i < BLUR_TAPS; i++) {
      blurW[i] = Math.exp(-(i * i) / (2 * BLUR_SIGMA_TAPS * BLUR_SIGMA_TAPS));
      sum += i === 0 ? blurW[i] : 2 * blurW[i];
    }
    for (let i = 0; i < BLUR_TAPS; i++) blurW[i] /= sum;
  }

  /* ---- transition state ---- */
  let t = 1;                        // interpolation position
  let stag = STAGGER_DEFAULT;       // active stagger fraction
  let easeName = 'ease.move';       // active easing (GPU + CPU mirror)
  let easeLut = lutFor(easeName);
  let activeOrder = staggerHash;    // CPU view of the bound order channel
  let customOrderRef = null;        // caller's emitOrder array, if bound
  let anim = null;                  // { start, duration, onDone }
  let pulseEnabled = true;          // onset pulse: ON by default per transition
                                    // (header note #7b); { pulse: false } opts out
  let fade = null;                  // reduced-motion crossfade { start, dur, onDone }
  let scrubPair = null;             // { a, b } caller state refs (reduced snap)
  let reducedSnap = -1;             // which end of scrubPair is applied (0|1)
  let lastTarget = null;            // dedupe: skip no-op re-applications
  let dirty = true;
  let raf = null;
  let paused = false;
  let pausedAt = 0;
  let destroyed = false;
  let contextLost = false;
  let cssW = 0, cssH = 0;
  let dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, dprCap);
  let devW = 0, devH = 0, halfW = 0, halfH = 0;
  let frameCount = 0;
  const frameStamps = [];           // render-start timestamps (frameCost)
  let lastCpuMs = 0;

  /* ---- GL objects (built by initGL; rebuilt on context restore) ---- */
  let progPoint, progCompress, progCompressRest, progBlur, progComposite, progPresent;
  let buf = null;                   // posA/posB/colA/colB/sizeA/sizeB/orderHash/orderCustom/quad
  let tex = null;                   // accum/accumRest/scene/sceneRest/halfA/halfB/frame/capture[2]
  let fbo = null;
  let capIdx = 0;
  let accumFormat = null;           // 'rgba16f' | 'half-float' | 'rgba8-prescale'
  let preScale = 1;                 // 1 or 1/PRESCALE_HEADROOM
  let accumScale = 1;               // 1 or PRESCALE_HEADROOM

  const POINT_ATTRS = ['aPosA', 'aPosB', 'aColA', 'aColB', 'aSizeA', 'aSizeB', 'aOrder'];

  function makeBuffer(data, usage) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    return b;
  }

  function makeTexture(filter) {
    const tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tx;
  }

  function specAccum(tx, w, h) {
    gl.bindTexture(gl.TEXTURE_2D, tx);
    if (accumFormat === 'rgba16f') {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else if (accumFormat === 'half-float') {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, tex.halfFloatType, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
  }

  function specRgba8(tx, w, h) {
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  function makeFbo(tx) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
    return f;
  }

  function fboComplete() {
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  }

  /* Pick the accumulation format: float16 render target where available,
   * RGBA8 pre-scale as the documented high-headroom fallback (§3.4).
   * Both accumulation targets (active full-res, ground half-res — header
   * note #8) share one format; completeness is checked on both. */
  function accumPairComplete() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.accum);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.accum, 0);
    if (!fboComplete()) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.accumRest);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.accumRest, 0);
    return fboComplete();
  }
  function chooseAccumFormat() {
    tex.halfFloatType = null;
    if (mode === 'webgl2' && gl.getExtension('EXT_color_buffer_float')) {
      accumFormat = 'rgba16f';
      for (const tx of [tex.accum, tex.accumRest]) {
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null);
      }
      if (accumPairComplete()) { preScale = 1; accumScale = 1; return; }
    }
    if (mode === 'webgl1') {
      const ext = gl.getExtension('OES_texture_half_float');
      gl.getExtension('EXT_color_buffer_half_float'); // advertised on some UAs; completeness check decides
      if (ext) {
        accumFormat = 'half-float';
        tex.halfFloatType = ext.HALF_FLOAT_OES;
        for (const tx of [tex.accum, tex.accumRest]) {
          gl.bindTexture(gl.TEXTURE_2D, tx);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, ext.HALF_FLOAT_OES, null);
        }
        if (accumPairComplete()) { preScale = 1; accumScale = 1; return; }
      }
    }
    accumFormat = 'rgba8-prescale';
    preScale = 1 / PRESCALE_HEADROOM;
    accumScale = PRESCALE_HEADROOM;
    specRgba8(tex.accum, 4, 4);
    specRgba8(tex.accumRest, 4, 4);
    if (!accumPairComplete()) throw new Error('[rt-engine] no renderable accumulation format');
  }

  function initGL() {
    progPoint = {
      p: link(gl, VERT_POINTS, FRAG_POINTS, POINT_ATTRS),
    };
    progPoint.u = uniforms(gl, progPoint.p,
      ['uT', 'uStagger', 'uE1', 'uE2', 'uRes', 'uDpr', 'uPreScale',
       'uPulseWindow', 'uPulseSizeGain', 'uPulseColorEps', 'uPulseEnable',
       'uTierPass', 'uSizeScale',
       'uRestDim', 'uActiveBoost', 'uRestClassifyMax', 'uActiveClassifyMin', 'uPulseLumGain']);
    progCompress = { p: link(gl, VERT_QUAD, FRAG_COMPRESS, ['aXY']) };
    progCompress.u = uniforms(gl, progCompress.p, ['uTex', 'uGamma', 'uLumCap', 'uAccumScale']);
    progCompressRest = { p: link(gl, VERT_QUAD, FRAG_COMPRESS_REST, ['aXY']) };
    progCompressRest.u = uniforms(gl, progCompressRest.p,
      ['uTex', 'uGamma', 'uRestLumCap', 'uRestKnee', 'uAccumScale']);
    progBlur = { p: link(gl, VERT_QUAD, FRAG_BLUR, ['aXY']) };
    progBlur.u = uniforms(gl, progBlur.p, ['uTex', 'uStep', 'uW[0]']);
    progComposite = { p: link(gl, VERT_QUAD, FRAG_COMPOSITE, ['aXY']) };
    progComposite.u = uniforms(gl, progComposite.p,
      ['uScene', 'uBloom', 'uRest', 'uBg', 'uLumCap', 'uBloomGain']);
    progPresent = { p: link(gl, VERT_QUAD, FRAG_PRESENT, ['aXY']) };
    progPresent.u = uniforms(gl, progPresent.p, ['uFrame', 'uPrev', 'uFade']);

    buf = {
      posA: makeBuffer(A.pos, gl.DYNAMIC_DRAW),
      posB: makeBuffer(B.pos, gl.DYNAMIC_DRAW),
      colA: makeBuffer(A.color, gl.DYNAMIC_DRAW),
      colB: makeBuffer(B.color, gl.DYNAMIC_DRAW),
      sizeA: makeBuffer(A.size, gl.DYNAMIC_DRAW),
      sizeB: makeBuffer(B.size, gl.DYNAMIC_DRAW),
      orderHash: makeBuffer(staggerHash, gl.STATIC_DRAW),
      orderCustom: makeBuffer(new Float32Array(N), gl.DYNAMIC_DRAW),
      quad: makeBuffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW),
    };

    tex = {
      accum: makeTexture(gl.NEAREST),
      accumRest: makeTexture(gl.NEAREST),  // ground tier, half-res (note #8)
      scene: makeTexture(gl.LINEAR),
      sceneRest: makeTexture(gl.LINEAR),   // rest-capped ground, half-res
      halfA: makeTexture(gl.LINEAR),
      halfB: makeTexture(gl.LINEAR),
      frame: makeTexture(gl.LINEAR),
      capture: [makeTexture(gl.LINEAR), makeTexture(gl.LINEAR)],
      halfFloatType: null,
    };
    fbo = {
      accum: makeFbo(tex.accum),
      accumRest: makeFbo(tex.accumRest),
      scene: makeFbo(tex.scene),
      sceneRest: makeFbo(tex.sceneRest),
      halfA: makeFbo(tex.halfA),
      halfB: makeFbo(tex.halfB),
      frame: makeFbo(tex.frame),
      capture: [makeFbo(tex.capture[0]), makeFbo(tex.capture[1])],
    };
    chooseAccumFormat();

    // Loud allocation check (contract §3.1: throw so main.js falls back).
    const err = gl.getError();
    if (err === gl.OUT_OF_MEMORY) {
      throw new Error(`[rt-engine] GPU allocation failed at N=${N}`);
    }

    const ptRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    if (ptRange && ptRange[1] < 64) {
      // Instancing would be the escape hatch; no shipping target hits this.
      console.warn(`[rt-engine] max point size ${ptRange[1]} < 64 device px; `
        + 'largest protocol dot may clip on this device');
    }
    frameCount = 0;
  }

  /* ---- attribute plumbing ---- */
  let enabledAttribs = 0;
  function setEnabled(n) {
    for (let i = 0; i < Math.max(n, enabledAttribs); i++) {
      if (i < n) gl.enableVertexAttribArray(i);
      else gl.disableVertexAttribArray(i);
    }
    enabledAttribs = n;
  }
  function bindPointAttribs() {
    setEnabled(7);
    const bind = (b, locIdx, comps) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.vertexAttribPointer(locIdx, comps, gl.FLOAT, false, 0, 0);
    };
    bind(buf.posA, 0, 2);
    bind(buf.posB, 1, 2);
    bind(buf.colA, 2, 4);
    bind(buf.colB, 3, 4);
    bind(buf.sizeA, 4, 1);
    bind(buf.sizeB, 5, 1);
    bind(customOrderRef ? buf.orderCustom : buf.orderHash, 6, 1);
  }
  function bindQuadAttribs() {
    setEnabled(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.quad);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  /* ---- upload helpers ---- */
  function upload(which) {
    const s = which === 'A' ? A : B;
    gl.bindBuffer(gl.ARRAY_BUFFER, which === 'A' ? buf.posA : buf.posB);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, which === 'A' ? buf.colA : buf.colB);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.color);
    gl.bindBuffer(gl.ARRAY_BUFFER, which === 'A' ? buf.sizeA : buf.sizeB);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.size);
  }

  function validateState(state) {
    if (!state || !state.x || !state.y || !state.color || !state.size
      || state.x.length !== N || state.y.length !== N
      || state.color.length !== N * 4 || state.size.length !== N) {
      throw new Error(`[rt-engine] DotState shape mismatch (engine N=${N}): `
        + 'population constancy is structural, states must cover every dot');
    }
  }

  function writeState(dst, state) {
    for (let i = 0; i < N; i++) {
      dst.pos[i * 2] = state.x[i];
      dst.pos[i * 2 + 1] = state.y[i];
      dst.size[i] = state.size[i];
    }
    dst.color.set(state.color);
  }

  /* Bind (or unbind) the per-transition order channel. emitOrder is the
   * zoom sub-population channel: caller-supplied per-identity phases. */
  function setOrder(emitOrder) {
    if (emitOrder) {
      if (emitOrder.length !== N) {
        throw new Error(`[rt-engine] emitOrder length ${emitOrder.length} != N=${N}`);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.orderCustom);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, emitOrder);
      customOrderRef = emitOrder;
      activeOrder = emitOrder;
    } else {
      customOrderRef = null;
      activeOrder = staggerHash;
    }
  }

  /* THE interrupt-retarget step (precedent semantics): freeze the current
   * interpolated values into A using the OLD easing/stagger/order, so the
   * next tween departs from exactly what is on screen. */
  function bakeCurrentIntoA() {
    if (t >= 1) { A.pos.set(B.pos); A.color.set(B.color); A.size.set(B.size); return; }
    if (t <= 0) return;
    const span = Math.max(1 - stag, 1e-4);
    const lut = easeLut;
    const ord = activeOrder;
    for (let i = 0; i < N; i++) {
      let u = (t - ord[i] * stag) / span;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const e = sampleLut(lut, u);
      const i2 = i * 2, i4 = i * 4;
      A.pos[i2] += (B.pos[i2] - A.pos[i2]) * e;
      A.pos[i2 + 1] += (B.pos[i2 + 1] - A.pos[i2 + 1]) * e;
      A.color[i4] += (B.color[i4] - A.color[i4]) * e;
      A.color[i4 + 1] += (B.color[i4 + 1] - A.color[i4 + 1]) * e;
      A.color[i4 + 2] += (B.color[i4 + 2] - A.color[i4 + 2]) * e;
      A.color[i4 + 3] += (B.color[i4 + 3] - A.color[i4 + 3]) * e;
      A.size[i] += (B.size[i] - A.size[i]) * e;
    }
  }

  /* ---- render loop ---- */
  function schedule() {
    if (!raf && !paused && !destroyed && !contextLost) {
      raf = requestAnimationFrame(render);
    }
  }

  function render(now) {
    raf = null;
    if (destroyed || contextLost) return;
    if (anim) {
      const p = Math.min((now - anim.start) / anim.duration, 1);
      t = p;
      dirty = true;
      if (p >= 1) {
        const done = anim.onDone;
        anim = null;
        if (done) done();
      }
    }
    let fadeT = 1;
    if (fade) {
      fadeT = Math.min((now - fade.start) / fade.dur, 1);
      dirty = true;
      if (fadeT >= 1) {
        const done = fade.onDone;
        fade = null;
        fadeT = 1;
        if (done) done();
      }
    }
    if (dirty && cssW > 0 && cssH > 0) {
      drawFrame(fadeT);
      dirty = false;
    }
    if (anim || fade) schedule();
  }

  function runQuad(prog, target, w, h, bindUniforms) {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, w, h);
    bindUniforms();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function bindTex(unit, tx) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tx);
  }

  function drawFrame(fadeT) {
    const start = performance.now();

    /* Passes 1a/1b — tiered accumulation (header note #8): every dot is
     * routed per-vertex into exactly one tier per pass; energy still sums
     * additively (blend ONE, ONE) inside each tier. */
    gl.useProgram(progPoint.p);
    bindPointAttribs();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const ez = EASE[easeName];
    gl.uniform1f(progPoint.u.uT, t);
    gl.uniform1f(progPoint.u.uStagger, stag);
    gl.uniform2f(progPoint.u.uE1, ez[0], ez[1]);
    gl.uniform2f(progPoint.u.uE2, ez[2], ez[3]);
    gl.uniform2f(progPoint.u.uRes, cssW, cssH);
    gl.uniform1f(progPoint.u.uDpr, dpr);
    gl.uniform1f(progPoint.u.uPreScale, preScale);
    // Resting-field-dim / active-subset-boost + onset pulse (header note #7).
    gl.uniform1f(progPoint.u.uPulseWindow, PULSE_WINDOW);
    gl.uniform1f(progPoint.u.uPulseSizeGain, PULSE_SIZE_GAIN);
    gl.uniform1f(progPoint.u.uPulseColorEps, PULSE_COLOR_EPS);
    gl.uniform1f(progPoint.u.uPulseEnable, pulseEnabled ? 1 : 0);
    gl.uniform1f(progPoint.u.uRestDim, REST_DIM);
    gl.uniform1f(progPoint.u.uActiveBoost, ACTIVE_BOOST);
    gl.uniform1f(progPoint.u.uRestClassifyMax, REST_CLASSIFY_MAX);
    gl.uniform1f(progPoint.u.uActiveClassifyMin, ACTIVE_CLASSIFY_MIN);
    gl.uniform1f(progPoint.u.uPulseLumGain, PULSE_LUM_GAIN);

    /* 1a — GROUND tier into the half-res target. */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.accumRest);
    gl.viewport(0, 0, halfW, halfH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(progPoint.u.uTierPass, 0);
    gl.uniform1f(progPoint.u.uSizeScale, REST_TIER_RES);
    gl.drawArrays(gl.POINTS, 0, N);

    /* 1b — ACTIVE tier (story dots + live onset transients) at full res. */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.accum);
    gl.viewport(0, 0, devW, devH);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(progPoint.u.uTierPass, 1);
    gl.uniform1f(progPoint.u.uSizeScale, 1);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.disable(gl.BLEND);

    bindQuadAttribs();
    const bloomR = dpr <= 1.5 ? BLOOM_1X : BLOOM_2X;   // device px, FIXED
    const tap = bloomR / (BLUR_TAPS - 1);              // tap spacing, device px

    /* Pass 2a — GROUND tone-map: gamma + Reinhard soft-knee to the rest
     * ceiling; the composited ground can never exceed rest-luminance-cap. */
    runQuad(progCompressRest, fbo.sceneRest, halfW, halfH, () => {
      bindTex(0, tex.accumRest);
      gl.uniform1i(progCompressRest.u.uTex, 0);
      gl.uniform1f(progCompressRest.u.uGamma, GAMMA);
      gl.uniform1f(progCompressRest.u.uRestLumCap, REST_LUM_CAP);
      gl.uniform1f(progCompressRest.u.uRestKnee, REST_KNEE);
      gl.uniform1f(progCompressRest.u.uAccumScale, accumScale);
    });

    /* Pass 2b — ACTIVE tone-map: gamma + luminance cap (pulse map lifts). */
    runQuad(progCompress, fbo.scene, devW, devH, () => {
      bindTex(0, tex.accum);
      gl.uniform1i(progCompress.u.uTex, 0);
      gl.uniform1f(progCompress.u.uGamma, GAMMA);
      gl.uniform1f(progCompress.u.uLumCap, LUM_CAP);
      gl.uniform1f(progCompress.u.uAccumScale, accumScale);
    });

    /* Passes 3+4 — fixed-radius separable bloom at half resolution,
     * fed by the ACTIVE tier only (story-mark glow; ground never blooms). */
    runQuad(progBlur, fbo.halfA, halfW, halfH, () => {
      bindTex(0, tex.scene);
      gl.uniform1i(progBlur.u.uTex, 0);
      gl.uniform2f(progBlur.u.uStep, tap / devW, 0);
      gl.uniform1fv(progBlur.u['uW[0]'], blurW);
    });
    runQuad(progBlur, fbo.halfB, halfW, halfH, () => {
      bindTex(0, tex.halfA);
      gl.uniform1i(progBlur.u.uTex, 0);
      gl.uniform2f(progBlur.u.uStep, 0, tap / devH);
      gl.uniform1fv(progBlur.u['uW[0]'], blurW);
    });

    /* Pass 5 — composite over bg-canvas: active (cap re-applied post-
     * bloom, pulse lift preserved), then ground UNDER active. */
    runQuad(progComposite, fbo.frame, devW, devH, () => {
      bindTex(0, tex.scene);
      bindTex(1, tex.halfB);
      bindTex(2, tex.sceneRest);
      gl.uniform1i(progComposite.u.uScene, 0);
      gl.uniform1i(progComposite.u.uBloom, 1);
      gl.uniform1i(progComposite.u.uRest, 2);
      gl.uniform3f(progComposite.u.uBg, BG[0], BG[1], BG[2]);
      gl.uniform1f(progComposite.u.uLumCap, LUM_CAP);
      gl.uniform1f(progComposite.u.uBloomGain, BLOOM_GAIN);
    });

    /* Pass 6 — present (reduced-motion crossfade mixes here). */
    runQuad(progPresent, null, devW, devH, () => {
      bindTex(0, tex.frame);
      bindTex(1, tex.capture[capIdx]);
      gl.uniform1i(progPresent.u.uFrame, 0);
      gl.uniform1i(progPresent.u.uPrev, 1);
      gl.uniform1f(progPresent.u.uFade, fade ? fadeT : 1);
    });

    frameCount++;
    lastCpuMs = performance.now() - start;
    frameStamps.push(start);
    if (frameStamps.length > FRAME_STAMPS) frameStamps.shift();
  }

  /* Capture what is on screen into the spare capture texture (used as the
   * "previous frame" of a reduced-motion crossfade). Mixing through the
   * present program means a fade interrupted mid-flight captures the
   * blended image, not a stale endpoint. */
  function captureCurrent() {
    if (frameCount === 0 || devW === 0) return false;
    const now = performance.now();
    const fadeT = fade ? Math.min((now - fade.start) / fade.dur, 1) : 1;
    const dst = 1 - capIdx;
    bindQuadAttribs();
    runQuad(progPresent, fbo.capture[dst], devW, devH, () => {
      bindTex(0, tex.frame);
      bindTex(1, tex.capture[capIdx]);
      gl.uniform1i(progPresent.u.uFrame, 0);
      gl.uniform1i(progPresent.u.uPrev, 1);
      gl.uniform1f(progPresent.u.uFade, fadeT);
    });
    capIdx = dst;
    return true;
  }

  /* Reduced-motion application: target applies instantly (no dot ever
   * moves across the screen), previous frame crossfades out (§3.5). */
  function applyReduced(state, onDone) {
    const captured = captureCurrent();
    writeState(A, state);
    writeState(B, state);
    upload('A');
    upload('B');
    anim = null;
    t = 1;
    dirty = true;
    if (captured && DUR_REDUCED_FADE > 0) {
      fade = { start: performance.now(), dur: DUR_REDUCED_FADE, onDone };
    } else {
      fade = null;
      if (onDone) onDone();
    }
    schedule();
  }

  function applyInstant(state, onDone) {
    writeState(A, state);
    writeState(B, state);
    upload('A');
    upload('B');
    anim = null;
    t = 1;
    dirty = true;
    schedule();
    if (onDone) onDone();
  }

  /* ---- resilience (contract §3.6) ---- */
  function onLost(e) {
    e.preventDefault();
    contextLost = true;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }
  function onRestored() {
    contextLost = false;
    initGL();
    upload('A');
    upload('B');
    if (customOrderRef) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.orderCustom);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, customOrderRef);
    }
    if (cssW > 0) sizeTargets();
    dirty = true;
    schedule();
  }
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  function sizeTargets() {
    devW = Math.max(Math.round(cssW * dpr), 1);
    devH = Math.max(Math.round(cssH * dpr), 1);
    halfW = Math.max(Math.round(devW / 2), 1);
    halfH = Math.max(Math.round(devH / 2), 1);
    canvas.width = devW;
    canvas.height = devH;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    specAccum(tex.accum, devW, devH);
    specAccum(tex.accumRest, halfW, halfH);   // ground tier at half res (note #8)
    specRgba8(tex.scene, devW, devH);
    specRgba8(tex.sceneRest, halfW, halfH);
    specRgba8(tex.frame, devW, devH);
    specRgba8(tex.capture[0], devW, devH);
    specRgba8(tex.capture[1], devW, devH);
    specRgba8(tex.halfA, halfW, halfH);
    specRgba8(tex.halfB, halfW, halfH);
    frameCount = 0;   // stale frame texture: don't crossfade from garbage
  }

  /* ---- build the GL side; throw on failure (main.js falls back) ---- */
  initGL();

  /* ------------------------------------------------------------------ */
  /* Public API (contract §3.3)                                          */

  const engine = {
    N,
    get mode() { return mode; },

    /** Hard set: A = B = state, no motion, one draw. */
    setState(state) {
      if (destroyed) return;
      validateState(state);
      setOrder(null);
      fade = null;
      lastTarget = state;
      applyInstant(state);
    },

    /** Animated A->B; INTERRUPT RETARGETS from current interpolated values.
     * Onset pulse (header note #7b) is ON by default: any dot whose color
     * actually changes in this transition fires a brief size+luminance
     * transient, so color-only tweens (recolor beats) are perceivable by
     * construction. Pass { pulse: false } to opt a transition out. */
    tween(state, o = {}) {
      if (destroyed) return;
      validateState(state);
      // Dedupe: re-applying the already-applied target is a no-op. This
      // holds even mid-crossfade — the driver re-snaps the same keyframe
      // state on every scroll frame in reduced-motion mode, and restarting
      // the fade each time would stall it forever.
      if (state === lastTarget && !anim && t >= 1) {
        if (o.onDone) o.onDone();
        return;
      }
      lastTarget = state;
      scrubPair = null;
      if (reduced) {
        setOrder(null);
        applyReduced(state, o.onDone);
        return;
      }
      const cap = o.ceremonial ? DUR_CEREMONIAL : DUR_HARD_CAP;
      const duration = Math.min(
        o.duration !== undefined ? o.duration : DUR_DEFAULT, cap);
      bakeCurrentIntoA();               // uses the OLD easing/stagger/order
      writeState(B, state);
      upload('A');
      upload('B');
      setOrder(o.emitOrder || null);
      pulseEnabled = o.pulse !== false; // onset pulse on by default (note #7b)
      stag = o.stagger !== undefined ? o.stagger : STAGGER_DEFAULT;
      easeName = o.easing && EASE[o.easing] ? o.easing : 'ease.move';
      easeLut = lutFor(easeName);
      if (duration <= 0) {
        anim = null;
        t = 1;
        dirty = true;
        schedule();
        if (o.onDone) o.onDone();
        return;
      }
      anim = { start: performance.now(), duration, onDone: o.onDone };
      t = 0;
      dirty = true;
      schedule();
    },

    /** Load a scrub pair; drive with setScrub(t). t := 0. */
    scrubBetween(stateA, stateB, o = {}) {
      if (destroyed) return;
      validateState(stateA);
      validateState(stateB);
      scrubPair = { a: stateA, b: stateB };
      reducedSnap = -1;
      if (reduced) {
        // Snap to the near end now; setScrub picks ends with crossfades.
        reducedSnap = 0;
        lastTarget = stateA;
        setOrder(null);
        applyReduced(stateA);
        return;
      }
      writeState(A, stateA);
      writeState(B, stateB);
      upload('A');
      upload('B');
      setOrder(o.emitOrder || null);
      pulseEnabled = o.pulse !== false; // onset pulse on by default (note #7b)
      stag = o.stagger !== undefined ? o.stagger : 0;
      easeName = o.easing && EASE[o.easing] ? o.easing : 'linear';
      easeLut = lutFor(easeName);
      anim = null;
      fade = null;
      lastTarget = null;
      t = 0;
      dirty = true;
      schedule();
    },

    /** Drive the loaded pair. Raw, no smoothing (the driver smooths). */
    setScrub(v) {
      if (destroyed) return;
      if (reduced) {
        // §3.5: snap to the nearest end state with the standard crossfade.
        if (!scrubPair) return;
        const snap = v < 0.5 ? 0 : 1;
        if (snap === reducedSnap) return;
        reducedSnap = snap;
        const state = snap === 0 ? scrubPair.a : scrubPair.b;
        lastTarget = state;
        applyReduced(state);
        return;
      }
      t = Math.min(Math.max(v, 0), 1);
      anim = null;
      dirty = true;
      schedule();
    },

    /** Stop the rAF loop; freeze in-flight tween/fade timing. */
    pause() {
      if (destroyed || paused) return;
      paused = true;
      pausedAt = performance.now();
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    },

    /** Restart; in-flight tween resumes where it froze. */
    resume() {
      if (destroyed || !paused) return;
      paused = false;
      const delta = performance.now() - pausedAt;
      if (anim) anim.start += delta;
      if (fade) fade.start += delta;
      dirty = true;
      schedule();
    },

    /** CSS px; re-clamps dpr, resizes the backing store + FBO chain. */
    resize(w, h) {
      if (destroyed) return;
      cssW = Math.max(w, 0);
      cssH = Math.max(h, 0);
      dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, dprCap);
      if (cssW === 0 || cssH === 0 || contextLost) return;
      sizeTargets();
      dirty = true;
      schedule();
    },

    /** Mark dirty, schedule one frame. */
    redraw() {
      if (destroyed) return;
      dirty = true;
      schedule();
    },

    /** Runtime reduced-motion switch (no re-boot). */
    setReducedMotion(v) {
      if (destroyed) return;
      const next = !!v;
      if (next === reduced) return;
      reduced = next;
      if (reduced && anim) {
        // A tween is mid-flight: complete it instantly (no motion plays).
        anim = null;
        t = 1;
        dirty = true;
        schedule();
      }
    },

    /** Probe only: mean ms of the last 3 frames (§3.1 quality demotion). */
    frameCost() {
      if (frameStamps.length >= 2) {
        let sum = 0, n = 0;
        for (let i = 1; i < frameStamps.length; i++) {
          const d = frameStamps[i] - frameStamps[i - 1];
          if (d < 250) { sum += d; n++; }
        }
        if (n > 0) return sum / n;
      }
      return lastCpuMs;
    },

    /** Release GL resources, remove context-loss listeners. */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
      if (!contextLost) {
        for (const k of Object.keys(buf)) gl.deleteBuffer(buf[k]);
        for (const k of ['accum', 'accumRest', 'scene', 'sceneRest', 'halfA', 'halfB', 'frame']) gl.deleteTexture(tex[k]);
        gl.deleteTexture(tex.capture[0]);
        gl.deleteTexture(tex.capture[1]);
        for (const k of ['accum', 'accumRest', 'scene', 'sceneRest', 'halfA', 'halfB', 'frame']) gl.deleteFramebuffer(fbo[k]);
        gl.deleteFramebuffer(fbo.capture[0]);
        gl.deleteFramebuffer(fbo.capture[1]);
        for (const p of [progPoint, progCompress, progCompressRest, progBlur, progComposite, progPresent]) {
          gl.deleteProgram(p.p);
        }
      }
      buf = tex = fbo = null;
    },

    /* ---- test-only introspection (docs/dev/engine-test.html). Not part
     * of the contract API; nothing in docs/js/ outside dev may use it. */
    __debug: {
      get mode() { return mode; },
      get accumFormat() { return accumFormat; },
      get t() { return t; },
      get animating() { return !!anim; },
      get animDuration() { return anim ? anim.duration : 0; },
      get fading() { return !!fade; },
      get reduced() { return reduced; },
      get frameCount() { return frameCount; },
      /** Current interpolated CSS position of dot i (CPU mirror of the shader). */
      posOf(i) {
        const span = Math.max(1 - stag, 1e-4);
        let u = (t - activeOrder[i] * stag) / span;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const e = sampleLut(easeLut, u);
        return [
          A.pos[i * 2] + (B.pos[i * 2] - A.pos[i * 2]) * e,
          A.pos[i * 2 + 1] + (B.pos[i * 2 + 1] - A.pos[i * 2 + 1]) * e,
        ];
      },
      /** Read one composited pixel (from the persistent frame FBO), CSS coords. */
      readPixel(x, y) {
        if (!fbo || contextLost || devW === 0) return null;
        const px = Math.min(Math.max(Math.round(x * dpr), 0), devW - 1);
        const py = Math.min(Math.max(devH - 1 - Math.round(y * dpr), 0), devH - 1);
        const out = new Uint8Array(4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.frame);
        gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return [out[0], out[1], out[2], out[3]];
      },
    },
  };

  return engine;
}
