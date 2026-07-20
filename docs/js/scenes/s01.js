/* s01.js — "Ninety minutes in Arlington" (storyboard Act 0, S1)
 *
 * Contract: docs/CONTRACT.md §4 (scene shape), §4.2 (registry row: scrub,
 * <=6 viewport-heights total INCLUDING the static pre-title header),
 * §4.3 (zoom/tick semantics), §7 (grain plate / chip).
 * Design: research/design-system.md §9 "S1" (Grain Plate pre-title,
 * non-cuttable; side-binary cyan/orange debut; chip debut; amber at
 * the repricing event; the France pour is the piece's first sight of
 * state.dead grey).
 * Findings: research/findings-dossier.md R3/R20 (goal mechanism, no
 * exploitable fade) ground the "spike is the price" framing carried
 * forward by S7/S16-L3; this scene itself only narrates the settlement,
 * per storyboard R23-adjacent discipline (no cross-venue claims here).
 *
 * GATE-4 ROUND-2 REVISION (structure-spec §5 S1 / design-revision-spec §2
 * S1): kicker "Skill 1 of 5 — what a price means"; prose rewritten to
 * eighth-grade level teaching ticket-as-chance and settle before use;
 * boot/pre-title now paints EVERY dot at field.rest (CR-18) with tonight's
 * amber tag arriving as one announced, engine-onset-pulsed tween a hair
 * into the scrub rather than baked into the very first pixel; the whistle
 * annotation drops its amber halo/white core (declutter checklist) for
 * plain ink-mid text so "the goal" stays the scene's one amber unit; the
 * color key debuts here via the row-array `setChip` API, updated
 * imperatively as the scrub crosses pre-title -> zoom -> settle.
 *
 * STORYBOARD CONTRACT NOTE — pre-title frame: the storyboard's "Beat,
 * pre-title" text ("A still field of dots... every dot on this screen is
 * $75,000...") is already authored as static HTML in docs/index.html's
 * <header id="title-screen"> (CONTRACT §8.2) with data-slot spans for the
 * deploy-frozen census figures. It is NOT reproduced as a scene beat here
 * (buildRail() only renders scene.beats[] into #rail, which begins AFTER
 * the title header). This module's single beat is the storyboard's main
 * "Beat." paragraph (the FRA-ESP zoom), which is everything the reader
 * sees once they scroll past the title.
 *
 * FALLBACK VEHICLE (storyboard S1, drafted, not implemented here): if the
 * G1 tape re-drive fails to land 'fraesp', the storyboard's verbatim
 * fallback is a Norway-Brazil open (vehicle 'norbra', already reused by
 * S9's mirror). The scene-module contract only exposes ONE static
 * `zoom.key`; swapping vehicles is a data/tiling-stage decision (repoint
 * manifest + re-author this file's beat html), not a runtime branch this
 * module can express. See data_requests in the build handoff.
 */

import { registry, makeState, setColor, indicesWithFlag, durationMs } from '../shared.js';

/* ------------------------------------------------------------------ */
/* Deterministic per-dot hash (no Math.random: replays must be stable). */
function hash01(i) {
  let x = (i + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 100000) / 100000;
}

const BUCKET_PX = 4; // one time-bucket per ~4 CSS px column of the stage

/* The resting-field ("timeline-ribbon") position formula, shared in spirit
 * with s02.js (duplicated per CONTRACT §2 import rule: scenes may only
 * import ../shared.js, plus siblings for S16's anchor reuse). Identical
 * formula + identical view.region + identical dot identity (index) means
 * S1's pre-title field and S2's re-merged field are pixel-identical: the
 * "returns to its place" promise (storyboard §0 identity rule) is met
 * structurally, not by chance.
 *
 * xOf(i) returns the raw (unbucketed) pixel position along the TIME axis
 * for dot i. On mobile the ribbon rotates (storyboard S2 mobile note:
 * "Timeline rotates to vertical, scroll = time"); S1 inherits the same
 * rotation since it is the same field. */
function restingFieldPositions(N, region, mobile, xOf) {
  const timeExtent = mobile ? region.h : region.w;
  const timeOrigin = mobile ? region.y : region.x;
  const stackExtent = mobile ? region.w : region.h;
  const stackOrigin = mobile ? region.x : region.y;
  const nBuckets = Math.max(40, Math.round(timeExtent / BUCKET_PX));

  const bucketOf = new Int32Array(N);
  const counts = new Int32Array(nBuckets);
  for (let i = 0; i < N; i++) {
    const px = xOf(i);
    let b = Math.floor(((px - timeOrigin) / timeExtent) * nBuckets);
    if (b < 0) b = 0; else if (b >= nBuckets) b = nBuckets - 1;
    bucketOf[i] = b;
    counts[b]++;
  }
  const rankInBucket = new Int32Array(N);
  const seen = new Int32Array(nBuckets);
  for (let i = 0; i < N; i++) {
    const b = bucketOf[i];
    rankInBucket[i] = seen[b]++;
  }

  const x = new Float32Array(N);
  const y = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const b = bucketOf[i];
    const count = counts[b];
    const rank = rankInBucket[i];
    const tPos = timeOrigin + (b + 0.5) * (timeExtent / nBuckets);
    const norm = count > 1 ? rank / (count - 1) - 0.5 : 0;
    // Center-out "violin" stacking: column half-height grows with sqrt(count),
    // capped so no bucket (e.g. a match-day wall) can overflow the stage.
    // Absolute density beyond what spread alone can show is carried by the
    // engine's additive density tone-mapping (CONTRACT §3.4 / tokens
    // density_tone_mapping), not by this layout.
    const halfSpread = Math.min(stackExtent / 2 - 4, 5 * Math.sqrt(count));
    const jitter = (hash01(i) - 0.5) * 3;
    const sPos = stackOrigin + stackExtent / 2 + norm * 2 * halfSpread + jitter;
    if (mobile) { x[i] = sPos; y[i] = tPos; } else { x[i] = tPos; y[i] = sPos; }
  }
  return { x, y };
}

/* The zoom tile's flags column bit 0 is the ONLY structurally-flagged
 * event (CONTRACT §5.4: "bit 0 = detector-anchored repricing event").
 * There is no equivalent flag for the whistle/settlement boundary, so it
 * is approximated from tape geometry here — see data_requests in the
 * build handoff for a request to add an explicit boundary marker. */

// GATE-4 VISUAL-STORY REVIEW, s01 CRITICAL (x-axis contradicts the grain
// plate): `ts_ms` is milliseconds since the TILE's own t0 (this ticker's
// first-ever trade — pipeline/export/build_tiles.py build_fraesp_zoom():
// `t0 = int(d["created_ts"].min())`), NOT since kickoff. The France-Spain
// 3-way market opened ~4 days before the July 14 semifinal (manifest
// window: 2026-07-10T21:31Z -> 2026-07-14T21:00Z), so plotting raw
// ts_ms/60000 as "match clock (minutes played)" put four days of
// pre-kickoff trading on a 0'-5000'+ axis while the axis title and grain
// plate both promised a single 90-minute night — an undecodable, actively
// misleading position encoding. Kickoff is a known fact (research/
// fact-base.json remaining_schedule: "France vs Spain - Tuesday, July 14,
// 2026, 3:00 PM ET / 19:00 GMT"), inlined here since S1 carries no
// per-scene JSON (needs.scene: false) to hold it as data — mirrors S8's
// self-contained kickoff derivation (s08.js: kickoffTs = whistleTs -
// 90*60000). Every "minute" downstream of this function is now truly
// kickoff-relative: 0' is kickoff, ~90'-120' is the whistle/settlement
// tail, matching what the axis title and grain plate already claim.
const FRAESP_KICKOFF_UTC_MS = Date.parse('2026-07-14T19:00:00Z');

function computeEnvelope(zoomTile) {
  // zoomTile.t0 is populated by main.js's loadZoomTile() as an absolute
  // epoch-ms Date, so no extra manifest plumbing is needed here.
  const kickoffOffsetMin = (zoomTile && Number.isFinite(zoomTile.t0))
    ? (FRAESP_KICKOFF_UTC_MS - zoomTile.t0) / 60000
    : 0;
  function minuteOf(rawTsMs) {
    return rawTsMs / 60000 - kickoffOffsetMin;
  }
  const matchEndMinutes = zoomTile && zoomTile.count
    ? Math.max(60, minuteOf(zoomTile.ts_ms[zoomTile.count - 1]))
    : 120;
  let eventMinute = null;
  let eventPriceC = 50;
  if (zoomTile) {
    for (let i = 0; i < zoomTile.count; i++) {
      if (zoomTile.flags[i] & 1) {
        eventMinute = Math.max(0, minuteOf(zoomTile.ts_ms[i]));
        eventPriceC = zoomTile.price_c[i];
        break;
      }
    }
  }
  if (eventMinute == null) eventMinute = matchEndMinutes * 0.55; // undetected fallback
  const whistleMinute = Math.min(
    matchEndMinutes,
    Math.max(eventMinute + 5, matchEndMinutes * 0.93),
  );
  const pad = Math.min(8, eventMinute / 2);

  // Scroll-fraction -> match-clock cutoff. Storyboard S1 Scroll spec:
  // "~40% of the scrub's length dwells on the minutes around the detected
  // repricing event, ~25% on the final minutes/whistle/settlement, the
  // rest of the match compresses into what remains, clock visibly
  // accelerating." Breakpoints below realize that envelope, RETIMED (Gate-4
  // visual-story review, s01 C2: "the settlement pour must be a perceivable
  // staged onset" -- a pour confined to 0.93-1.00 tweened entirely inside
  // the last 7% of the track, a span this piece's own review harness never
  // samples (its fixed scrub stops are 25/50/90%) and a real reader could
  // easily overshoot in one scroll gesture, so the fall was invisible both
  // to the audit and to a fast scroller. The pour now starts earlier and
  // finishes BEFORE the 90% mark, so scrub90 always lands on the fully
  // drained, unambiguous end state (a flat grey line at zero) instead of a
  // half-blended frame, and the last 14% of the track holds that settled
  // frame still rather than continuing to tween:
  //   0.00-0.06 intro/kickoff (6%)
  //   0.06-0.20 compressed early match (14%)
  //   0.20-0.60 dwell around the repricing event (40%)
  //   0.60-0.68 compressed post-event walk to the final stretch (8%)
  //   0.68-0.74 final minutes + whistle dwell (6%)
  //   0.74-0.86 settlement pour: France's scattered dots slide to the zero
  //     line and drain to dead grey, one continuous tween (12%)
  //   0.86-1.00 held still on the drained, settled frame (14%)
  const breakpoints = [
    { at: 0.00, clock: 0 },
    { at: 0.06, clock: 0 },
    { at: 0.20, clock: Math.max(0, eventMinute - pad) },
    { at: 0.60, clock: Math.min(whistleMinute, eventMinute + pad) },
    { at: 0.68, clock: Math.max(eventMinute + pad, whistleMinute - 10) },
    { at: 0.74, clock: whistleMinute },
    { at: 0.86, clock: matchEndMinutes },
  ];
  function cutoffAt(t) {
    if (t <= breakpoints[0].at) return breakpoints[0].clock;
    for (let k = 0; k < breakpoints.length - 1; k++) {
      const a = breakpoints[k], b = breakpoints[k + 1];
      if (t <= b.at) {
        const f = (t - a.at) / Math.max(1e-6, b.at - a.at);
        return a.clock + (b.clock - a.clock) * f;
      }
    }
    return matchEndMinutes;
  }
  return {
    eventMinute, eventPriceC, whistleMinute, matchEndMinutes, breakpoints, cutoffAt,
    kickoffOffsetMin,
  };
}

/* Heuristic leg classification from manifest.zoom.fraesp.legs entries
 * (ticker/label strings). Storyboard: "y = price of the France winner
 * leg; the 3-way legs run as fainter companion streams."
 *
 * GATE-4 ROUND-2 FIX (s01 hero/companion split): the original heuristic
 * looked for a separate season-long WORLDCUP futures leg to treat as
 * "hero." The live fraesp.bin tile (manifest.zoom.fraesp.legs) carries
 * only the match's own three regulation legs (KXWCGAME-...-FRA/-ESP/-TIE)
 * — no WORLDCUP leg is ever present in this tile — so that check matched
 * nothing and EVERY sampled trade, including France's own, fell into the
 * "faint companion" branch: the whole tick stream rendered at 0.40 alpha,
 * below the engine's active-tier floor, and the scene's one bright figure
 * (the France price path this scene's own axis and prose promise) never
 * popped. The axis is titled "price of the France contract" and the
 * settlement pour is defined on the France leg alone (see makeSettled()
 * below), so "hero" is redefined here to mean exactly that leg: France's
 * own regulation contract is the active/bright stream; Spain's and the
 * draw's regulation legs (present in the same tile, at their own,
 * different prices) stay the faint companions the caption names. */
function isFranceLeg(leg) {
  if (!leg) return false;
  const s = `${leg.ticker || ''} ${leg.label || ''}`;
  return /france/i.test(s) || /-FRA?(\b|$)/i.test(leg.ticker || '');
}

export default {
  id: 's01',
  act: 0,
  title: 'Ninety minutes in Arlington',
  // Piece-wide spine (structure-spec §2/§3): the scene kicker names which
  // of the five skills this scene teaches. main.js's buildRail() already
  // prefers `scene.kicker` over `scene.title` for the rail card header.
  kicker: 'Skill 1 of 5 — what a price means',
  layoutName: 'resting-field → tick-stream',

  // No per-scene JSON: everything s01 needs is already in the contract's
  // existing manifest surface (population tile + its ZOOM_FRAESP flag +
  // the fraesp zoom tile itself, loaded as part of boot per CONTRACT §6.3
  // "S1's tile is part of the boot load set").
  needs: { scene: false, series: [], zoom: 'fraesp' },

  scales(data, view) {
    const { manifest } = data;
    const region = view.region;
    const epochMs = new Date(manifest.epoch).getTime();
    const frozenMs = new Date(manifest.frozen_at || manifest.generated).getTime();
    const timeRange = view.mobile
      ? [region.y, region.y + region.h]
      : [region.x, region.x + region.w];
    const timeX = d3.scaleUtc().domain([epochMs, frozenMs]).range(timeRange);

    const zoomTile = data.zoom.fraesp;
    const env = computeEnvelope(zoomTile);
    const clockX = d3.scaleLinear()
      .domain([0, env.matchEndMinutes])
      .range([region.x, region.x + region.w]);
    const priceY = d3.scaleLinear()
      .domain([0, 100])
      .range([region.y + region.h, region.y]);

    registry.register('s01.time', timeX);
    registry.register('s01.clock', clockX);
    registry.register('s01.price', priceY);
    return { timeX, clockX, priceY, env };
  },

  layout(data, view) {
    const { manifest, pop } = data;
    const N = pop.count;
    const region = view.region;
    const epochMs = new Date(manifest.epoch).getTime();
    const zoomTile = data.zoom.fraesp;
    const env = computeEnvelope(zoomTile);
    const timeX = registry.get('s01.time');
    const clockX = registry.get('s01.clock');
    const priceY = registry.get('s01.price');
    const YES_IDX = manifest.enums.side.indexOf('taker_yes');

    const heroBit = data.flagBit('ZOOM_FRAESP');
    const taggedIdx = indicesWithFlag(pop.flags, heroBit);
    const D = taggedIdx.length;
    const T = zoomTile ? zoomTile.count : 0;
    // CONTRACT §4.3 stride formula: runtime stride = ceil(T / D); narrated
    // n = build_stride * runtime stride (interpolated into zoom.grainText
    // at the driver layer once wired — see data_requests).
    const stride = Math.max(1, Math.ceil(T / Math.max(D, 1)));
    const sampleIdx = new Int32Array(D);
    for (let d = 0; d < D; d++) sampleIdx[d] = Math.min(Math.max(T - 1, 0), d * stride);

    const restPos = restingFieldPositions(
      N, region, view.mobile,
      (i) => timeX(epochMs + pop.birth_ts[i] * 1000),
    );

    const BASE_PX = view.tokens.dot['radius-base-px'] * 2; // radius -> diameter
    // ACTIVE/REST luminance encoding (perception-brief §9b, §10.1-2):
    // the pop between "tonight's trades" and the resting field is bought here
    // purely by which ALPHA BAND each dot lands in, not by hue. The engine
    // (FRAG_POINTS/VERT_POINTS) dims any dot whose own alpha is <=
    // opacity-rest-classify-max (0.42) and boosts + onset-pulses any dot whose
    // alpha is >= opacity-active-classify-min (0.90); the brief showed every
    // identity/side hue reads ~isoluminant against field.rest (<=1.24:1), so a
    // hue swap alone is close to inert for a "did that just change" judgment.
    // Dot SIZE is never touched (unit grammar: one trade = one dot), so the
    // whole encoding rides on alpha here and luminance in the shader.
    const ACTIVE_A = view.tokens.dot['opacity-alive']; // 1.0 -> active-tier (boosted)
    const restColor = view.state('rest');              // 0.35 -> rest-tier (dimmed)
    // Tonight's FRA-ESP subset, lifted into the active band so it pops against
    // the dimmed resting field (was 0.85, which fell in the unclassified
    // 0.42-0.90 gap and did not pop). Amber = the reserved "story points here"
    // hue naming tonight's match.
    const amber = view.color('accent-annotation', ACTIVE_A);
    const yesColor = view.color('side-yes', ACTIVE_A); // real ticks: active-tier
    const noColor = view.color('side-no', ACTIVE_A);
    const waitColor = view.color('field-rest', 0.10);  // staged/not-yet-arrived: below rest band
    // Gate-4 visual-story review (s01 critical, "un-keyed near-white
    // column"): during the zoom the resting field is CONTEXT, not story,
    // but its end-of-tournament density wall at the right edge was
    // accumulating past the tone-map cap and rendering as a full-height
    // near-white mass that out-shone the tick stream in every frame and
    // matched no key entry. Drop the in-zoom field to the same 0.10
    // alpha the staging tier uses (precedent: waitColor above) so the
    // summed wall stays a dim grey ground and the key's "grey = money at
    // rest" is true of what is rendered (perception-brief §4, §9b).
    const zoomFieldColor = view.color('field-rest', 0.10);
    const deadColor = view.state('dead');              // 0.55 -> unclassified receding state, engine leaves it

    const stageX = clockX(0) - 14; // "not yet arrived" staging point
    const stageY = priceY(50);

    // ---- state: 'bootRest' — the TRUE first pixel painted, before any
    // reader interaction (CR-18, perception-brief §7 on change blindness /
    // onset capture): every dot, including tonight's FRA-ESP subset, sits
    // at plain field.rest. No amber pre-light. This is the state
    // boot()/activateBeat() snap to for the silent first paint. ----
    function makeAllRest() {
      const s = makeState(N);
      for (let i = 0; i < N; i++) {
        s.x[i] = restPos.x[i]; s.y[i] = restPos.y[i];
        setColor(s.color, i, restColor);
        s.size[i] = BASE_PX;
      }
      return s;
    }

    // ---- state: 'resting' — the amber-tagged frame the reader reaches a
    // hair into the scrub (kf at 0.02, see `keyframes` below): tonight's
    // FRA-ESP dots light up amber against the resting field as ONE
    // announced color tween out of 'bootRest', crossing the engine's
    // active alpha band so its onset pulse fires (CR-18). ----
    function makeResting() {
      const s = makeAllRest();
      for (const i of taggedIdx) setColor(s.color, i, amber);
      return s;
    }

    // ---- tick-grain cumulative-reveal state: every tagged dot whose
    // sampled trade falls at or before `cutoffMinutes` sits at its real
    // (match-clock, price) position; everything else stages just before
    // kickoff, invisible-adjacent. The whole non-tonight population dims
    // (dimmed-field-max) behind it. Because driveScrub() interpolates
    // linearly between adjacent keyframe pairs with zero stagger (engine.js
    // scrubBetween default), consecutive cumulative-reveal snapshots
    // produce a genuine "trades enter left to right" streaming look even
    // though the engine's true per-identity emitOrder channel (built for
    // exactly this, engine.js header item 5) is not wired through the
    // scrub path today — see data_requests. ----
    function tickState(cutoffMinutes) {
      const s = makeState(N);
      for (let i = 0; i < N; i++) {
        s.x[i] = restPos.x[i]; s.y[i] = restPos.y[i];
        setColor(s.color, i, zoomFieldColor);
        s.size[i] = BASE_PX;
      }
      for (let d = 0; d < D; d++) {
        const i = taggedIdx[d];
        const t = sampleIdx[d];
        // Gate-4 s01 critical fix: minute is kickoff-relative (see
        // computeEnvelope), so the ~4 days of pre-kickoff trading on this
        // ticker (41% of its rows — this market opened days before the
        // fixture) no longer stretches the axis to 5000'+. A hard clamp of
        // every pre-kickoff row to the same x=0 pixel would just relocate
        // the old mid-chart pileup to a new single-column one, so instead
        // it is spread deterministically across the axis's own pre-narrated
        // "intro/kickoff" sliver (the breakpoints' first 6% of match
        // length, below) — an honest compression the scene already
        // narrates as accelerated time, not a fresh density spike. That
        // pre-kickoff activity is also outside "the match" this scene
        // narrates, so it drops into the same faint tier as the Spain/draw
        // companion legs (Gate-4 s01 major fix: stops it from out-shining
        // the in-match story marks — perception-brief §4, "the brightest
        // thing is never the story").
        const rawMinute = T ? (zoomTile.ts_ms[t] / 60000 - env.kickoffOffsetMin) : 0;
        const preKickoff = rawMinute < 0;
        const minute = preKickoff ? hash01(t) * (env.matchEndMinutes * 0.06) : rawMinute;
        if (T && minute <= cutoffMinutes) {
          const legSpec = (zoomTile.legs || [])[zoomTile.leg[t]];
          const faint = preKickoff || !isFranceLeg(legSpec); // Spain/draw legs + pre-kickoff: fainter companions
          const base = zoomTile.side[t] === YES_IDX ? yesColor : noColor;
          s.x[i] = clockX(minute);
          s.y[i] = priceY(zoomTile.price_c[t]);
          // Hero (France's own regulation leg) stays active-tier (base alpha
          // 1.0, boosted); the Spain/draw companion legs drop to 0.40
          // (perception-brief §9b: a dimmed-field-tier alpha, not the old 0.5
          // which sat in the shader's unclassified 0.42-0.90 gap and
          // half-competed with the boosted hero stream). A deliberate
          // two-tier read: France's price path pops as the scene's one
          // bright figure; the other two legs recede into the same tier as
          // the resting field.
          setColor(s.color, i, faint ? [base[0], base[1], base[2], base[3] * 0.40] : base);
        } else {
          s.x[i] = stageX; s.y[i] = stageY;
          setColor(s.color, i, waitColor);
        }
        s.size[i] = BASE_PX;
      }
      return s;
    }

    // ---- settlement: "the France dots pour to the zero line" — France's
    // own regulation leg (this scene's hero, see isFranceLeg above), hue
    // drained to state.dead, position at price 0. Spain's and the draw's
    // legs keep whatever their last real traded price shows (real data
    // already encodes the settlement move for the winning side; both stay
    // in the faint companion tier, so the pour reads as one bright figure
    // falling, not three). ----
    function makeSettled() {
      const s = tickState(Infinity);
      for (let d = 0; d < D; d++) {
        const i = taggedIdx[d];
        const t = sampleIdx[d];
        const legSpec = T ? (zoomTile.legs || [])[zoomTile.leg[t]] : null;
        if (isFranceLeg(legSpec)) {
          s.y[i] = priceY(0);
          setColor(s.color, i, deadColor);
        }
      }
      return s;
    }

    const bp = env.breakpoints;
    const states = {
      bootRest: makeAllRest(),
      resting: makeResting(),
      kickoff: tickState(bp[1].clock),
      preEvent: tickState(bp[2].clock),
      postEvent: tickState(bp[3].clock),
      approachFinal: tickState(bp[4].clock),
      whistle: tickState(bp[5].clock),
      settled: makeSettled(),
    };
    // CR-18: an extra kf0 (bootRest, at=0.00) precedes the amber-tagged
    // 'resting' frame (moved to at=0.02, a hair into the scrub) so the
    // amber ignition is a witnessed tween, not a fact the reader arrives
    // to. `bp` (env.breakpoints, used separately by the overlay's
    // cutoffAt/axis logic) is untouched; only this engine-facing keyframe
    // list gains the one extra entry.
    const keyframes = [
      { at: 0.00, state: 'bootRest' },
      { at: 0.02, state: 'resting' },
      { at: bp[1].at, state: 'kickoff' },
      { at: bp[2].at, state: 'preEvent' },
      { at: bp[3].at, state: 'postEvent' },
      { at: bp[4].at, state: 'approachFinal' },
      { at: bp[5].at, state: 'whistle' },
      { at: bp[6].at, state: 'settled' },
    ];
    return { states, keyframes };
  },

  overlay(container, data, view, scales) {
    const { svg, html } = container;
    const { clockX, priceY, env } = scales;
    const zoomTile = data.zoom.fraesp;
    const tokens = view.tokens;
    const drawIn = durationMs(tokens, 'overlay-draw-in');
    const stagger = durationMs(tokens, 'overlay-stagger');
    const standoff = tokens.layout['annotation-leader-standoff-px'];

    const g = svg.append('g').attr('class', 's01-overlay');

    const clockAxisG = g.append('g').attr('class', 'axis axis-clock')
      // G3 mobile fix: the bottom x-axis abuts the mobile prose sheet, so
      // its tick labels render ABOVE the axis line (d3.axisTop) on mobile
      // instead of below it, staying inside the visible stage.
      .attr('transform', `translate(0, ${view.region.y + view.region.h + (view.mobile ? 0 : 8)})`);
    const priceAxisG = g.append('g').attr('class', 'axis axis-price')
      .attr('transform', `translate(${view.region.x - 8}, 0)`);

    function styleAxis(sel) {
      sel.selectAll('text')
        .attr('fill', view.css('ink-mid'))
        .style('font-family', view.css('font-tape'))
        .style('font-size', view.css('type-tape-size'));
      sel.selectAll('path,line').attr('stroke', view.css('ink-low'));
    }

    // Gate-4 s01 critical fix (axis/position integrity): this used to
    // rebuild its OWN scale with a domain that shrank/grew toward the
    // current scrub cutoff ("the match-clock axis visibly accelerating"),
    // while every dot's x-position kept using the scene's real, fixed
    // clockX domain (0 to matchEndMinutes) — two different scales sharing
    // one pixel range. A tick under a dot could read e.g. "2'" for a dot
    // whose real trade was at minute 13, only converging once cutoff
    // reached matchEndMinutes. That is the same "undecodable position
    // encoding" failure the 5000'+ domain bug was, just smaller and easier
    // to miss. The axis now always reads off the SAME clockX used to place
    // every dot, so whatever tick sits under a mark is that mark's real
    // minute, at every scrub position.
    function drawClockAxis() {
      const axisFn = view.mobile
        ? d3.axisTop(clockX).ticks(6).tickFormat((d) => `${Math.round(d)}'`)
        : d3.axisBottom(clockX).ticks(6).tickFormat((d) => `${Math.round(d)}'`);
      clockAxisG.call(axisFn);
      styleAxis(clockAxisG);
    }
    function drawPriceAxis() {
      priceAxisG.call(d3.axisLeft(priceY).ticks(5).tickFormat((d) => `${d}¢`));
      styleAxis(priceAxisG);
    }

    // G3 axis-label standard: every D3 axis carries a titled unit. X title
    // centered below the tick labels; Y title horizontal, left-aligned
    // above the topmost tick.
    function titleStyle(sel) {
      sel.attr('fill', view.css('ink-mid'))
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-caption-size'))
        .style('font-weight', 500);
    }
    if (view.mobile) {
      const cx = view.region.x - 8 - 20;
      const cy = view.region.y + view.region.h / 2;
      titleStyle(g.append('text').attr('class', 'axis-title axis-title-clock')
        .attr('x', cx).attr('y', cy).attr('text-anchor', 'middle')
        .attr('transform', `rotate(-90, ${cx}, ${cy})`)
        .text('match clock (minutes played)'));
    } else {
      titleStyle(g.append('text').attr('class', 'axis-title axis-title-clock')
        .attr('x', view.region.x + view.region.w / 2)
        .attr('y', view.region.y + view.region.h + 8 + 24)
        .attr('text-anchor', 'middle')
        .text('match clock (minutes played)'));
    }
    titleStyle(g.append('text').attr('class', 'axis-title axis-title-price')
      .attr('x', view.region.x - 8)
      .attr('y', view.region.y - 12)
      .attr('text-anchor', 'start')
      .text('price of the France contract (cents; 100 = certain)'));

    // Gate-4 s01 major fix (settlement pour has no visual floor): the old
    // faint dotted gridline at price=0 read as axis furniture, not "money
    // died here" (perception-brief §9b: near-isoluminant marks vanish
    // against the field). Bumped to ink-mid + a bolder dash so it reads as
    // a labeled boundary rather than a tick line, and paired with a low,
    // wide floor band (below) that gives the settled sediment a visible
    // carrier independent of any single dot's own luminance.
    const settleLine = g.append('line').attr('class', 'settle-line')
      .attr('x1', view.region.x).attr('x2', view.region.x + view.region.w)
      .attr('y1', priceY(0)).attr('y2', priceY(0))
      .attr('stroke', view.css('ink-mid')).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .style('opacity', 0);
    const floorBand = g.append('rect').attr('class', 'settle-floor-band')
      .attr('x', view.region.x).attr('width', view.region.w)
      .attr('y', priceY(0) - 3).attr('height', 6)
      .attr('fill', view.css('state-dead'))
      .attr('fill-opacity', 0)
      .style('pointer-events', 'none');

    // One pre-title caption line (storyboard overlay spec), lifted
    // verbatim from the beat's own narration. Retimed (CR-18) to be
    // visible from kf0 rather than gated behind a t>0.005 threshold.
    // Gate-4 visual-story review (s01 critical, caption collision): the
    // two narration captions each get the SAME lane, 34px above the
    // stage, clear of the price-axis title at region.y - 12 — and they
    // are sequenced below so at most one is visible at a time (one
    // change on screen at a time; Mayer coherence).
    const caption = g.append('text').attr('class', 'pretitle-caption')
      .attr('x', view.region.x).attr('y', view.region.y - 34)
      .attr('fill', view.css('ink-mid'))
      .style('font-family', view.css('font-tape'))
      .style('font-size', view.css('type-tape-size'))
      // Names what the lit/active movers ARE (tonight's match) so the pop has a
      // referent, and keeps the unit statement at first contact.
      .text('the lit dots: tonight, France–Spain · one dot is one trade')
      .style('opacity', 0);

    // Gate-4 s01 major fix (grey/meaning-budget cleanup): the transient
    // "fainter streams" caption named a fourth population that read to a
    // blind viewer as a third meaning of "grey," and it was one of the
    // scrub25 frame's ~6 simultaneous meanings against the ≤4 budget. Cut
    // per the SIMPLIFY doctrine ("cut anything that does not serve the
    // reader") — the Spain/draw legs stay on screen as dim, unlabeled
    // texture (tickState's faint tier); they no longer spend a captioned
    // working-memory slot.

    // Gate-4 s01 critical fix ("the collapse must survive as a picture"):
    // France's own price path, drawn as a literal, persistent SVG line —
    // not inferred from particle positions the fixed-percentage capture
    // grid can miss between frames. Progressively revealed with the scrub
    // and, crucially, its FINAL segment is the fall to the 0c floor at the
    // whistle, so the settled frame keeps the collapse on screen as a
    // static, readable shape instead of an absence.
    function buildFranceTracePoints(maxPts) {
      if (!zoomTile || !zoomTile.count) return [];
      // Kickoff-relative, and trimmed to minute >= 0: the trace reads the
      // match itself, not the ~4 days of pre-kickoff order-book warmup on
      // this ticker (which tickState above compresses into a dim intro
      // sliver instead) — a line built from same-x pre-kickoff rows would
      // just tangle at x=0.
      const rows = [];
      for (let r = 0; r < zoomTile.count; r++) {
        const legSpec = (zoomTile.legs || [])[zoomTile.leg[r]];
        if (isFranceLeg(legSpec) && zoomTile.ts_ms[r] / 60000 - env.kickoffOffsetMin >= 0) rows.push(r);
      }
      if (!rows.length) return [];
      const stride = Math.max(1, Math.ceil(rows.length / maxPts));
      const pts = [];
      for (let k = 0; k < rows.length; k += stride) {
        const r = rows[k];
        const minute = zoomTile.ts_ms[r] / 60000 - env.kickoffOffsetMin;
        pts.push({ minute, price: zoomTile.price_c[r] });
      }
      const rLast = rows[rows.length - 1];
      const lastMinute = zoomTile.ts_ms[rLast] / 60000 - env.kickoffOffsetMin;
      if (!pts.length || pts[pts.length - 1].minute !== lastMinute) {
        pts.push({ minute: lastMinute, price: zoomTile.price_c[rLast] });
      }
      // The pour itself: France's contract drains to zero at settlement.
      // Appending this point makes the fall a real segment of the drawn
      // line, not an inference from vanished dots.
      pts.push({ minute: env.whistleMinute, price: 0 });
      return pts;
    }
    const franceTracePts = buildFranceTracePoints(400);
    const traceLineGen = d3.line()
      .x((d) => clockX(d.minute)).y((d) => priceY(d.price))
      .curve(d3.curveMonotoneX);
    // ink-hero while the price is live (a neutral "read this" line, not a
    // new categorical hue competing with cyan/orange), switching to
    // state-dead the instant it reaches the floor — a visible, staged
    // announcement of the same grey redefinition the key makes at
    // settlement (Gate-4 s01 major fix: no more silent key reword).
    const tracePathEl = g.append('path').attr('class', 'france-trace')
      .attr('fill', 'none')
      .attr('stroke', view.css('ink-hero'))
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', 0.85)
      .style('opacity', 0);
    let tracePourFired = false;
    function updateTrace(cutoff) {
      const pts = franceTracePts.filter((p) => p.minute <= cutoff);
      if (pts.length < 2) {
        tracePathEl.attr('d', null);
        fadeOut(tracePathEl);
        return;
      }
      tracePathEl.attr('d', traceLineGen(pts));
      fadeIn(tracePathEl);
      const reachedFloor = cutoff >= env.whistleMinute - 0.5;
      tracePathEl.attr('stroke', reachedFloor ? view.css('state-dead') : view.css('ink-hero'));
      if (reachedFloor && !tracePourFired) {
        tracePourFired = true;
        // Onset pulse (perception-brief §7): per-dot size is never touched
        // (unit grammar — one trade, one dot), so this line is the
        // collapse's one luminance/size transient at the moment of the
        // drop, then settles to a still-legible, floor-separated weight.
        tracePathEl.transition().duration(160).attr('stroke-width', 4)
          .transition().duration(500).attr('stroke-width', 2);
        floorBand.transition().duration(160).attr('fill-opacity', 0.55)
          .transition().duration(600).attr('fill-opacity', 0.28);
      }
    }

    // Gate-4 s01 major fix (scrub25 budget: zero amber singletons): a dim,
    // persistent amber guide at the goal's clock position, visible from the
    // moment trades start flowing until the goal resolves it into the full
    // annotation below. Exactly one amber unit on screen at any time —
    // pre-announcing "watch here" instead of appearing cold at the reveal.
    const goalPreview = g.append('line').attr('class', 'goal-preview')
      .attr('x1', clockX(env.eventMinute)).attr('x2', clockX(env.eventMinute))
      .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
      .attr('stroke', view.css('accent-annotation'))
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,3')
      .attr('stroke-opacity', 0.4)
      .style('opacity', 0);

    // Amber singleton protocol (design-system §6 emphasis stack: luminance
    // singleton, white core + amber halo) for "the goal" — the scene's
    // ONE amber unit (design-revision-spec §2 S1: the whistle is demoted
    // below, so it no longer competes for the same budget).
    function makeAnnotation() {
      const grp = g.append('g').attr('class', 'annotation').style('opacity', 0);
      grp.append('circle').attr('class', 'halo')
        .attr('r', tokens.dot['radius-annotated-halo-px'])
        .attr('fill', 'none')
        .attr('stroke', view.css('accent-annotation'))
        .attr('stroke-width', tokens.dot['halo-stroke-px']);
      grp.append('circle').attr('class', 'core')
        .attr('r', tokens.dot['radius-annotated-core-px'])
        .attr('fill', view.css('ink-hero'));
      grp.append('line').attr('class', 'leader')
        .attr('stroke', view.css('accent-annotation'))
        .attr('stroke-width', tokens.layout['annotation-leader-weight-px']);
      grp.append('text').attr('class', 'label')
        .attr('fill', view.css('accent-annotation'))
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-annotation-size'));
      return grp;
    }
    function placeAnnotation(grp, cx, cy, dx, dy, text) {
      grp.select('.halo').attr('cx', cx).attr('cy', cy);
      grp.select('.core').attr('cx', cx).attr('cy', cy);
      grp.select('.leader')
        .attr('x1', cx).attr('y1', cy)
        .attr('x2', cx + dx).attr('y2', cy + dy - standoff);
      grp.select('.label').attr('x', cx + dx).attr('y', cy + dy).text(text);
    }

    const goalAnn = makeAnnotation();

    // Declutter checklist (design-revision-spec §4): the whistle drops its
    // amber halo, white core, and amber leader — a plain ink-mid text mark
    // (mirrored, since the whistle lands near the stage's right edge) at
    // the same coordinates, >= space-24 clear of "the goal" vertically.
    const whistleGrp = g.append('g').attr('class', 'annotation-plain').style('opacity', 0);
    whistleGrp.append('line').attr('class', 'leader')
      .attr('stroke', view.css('ink-low'))
      .attr('stroke-width', tokens.layout['annotation-leader-weight-px']);
    whistleGrp.append('text').attr('class', 'label')
      .attr('fill', view.css('ink-mid'))
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-annotation-size'));
    function placeWhistle(cx, cy, dx, dy, text) {
      whistleGrp.select('.leader')
        .attr('x1', cx).attr('y1', cy)
        .attr('x2', cx + dx).attr('y2', cy + dy - standoff);
      whistleGrp.select('.label')
        .attr('x', cx + dx).attr('y', cy + dy)
        .attr('text-anchor', 'end')
        .text(text);
    }

    // Mobile (storyboard S1 mobile note): "annotations collapse to
    // numbered markers with a footer legend."
    let footerLegend = null;
    if (view.mobile) {
      footerLegend = html.append('div').attr('class', 'interactive s01-footer-legend')
        .style('position', 'absolute').style('left', '0').style('right', '0')
        // G5 mobile Zone F: clear of the mobile prose sheet (was bottom:0,
        // sitting inside the sheet band).
        .style('bottom', 'calc(var(--layout-card-max-height-mobile-vh) + var(--space-8))')
        .style('font-family', 'var(--font-apparatus)')
        .style('font-size', 'var(--type-caption-size)')
        .style('color', 'var(--ink-mid)')
        .style('padding', 'var(--space-8) var(--space-16)')
        .style('opacity', 0)
        .html('<span>① the goal</span>&nbsp;&nbsp;<span>② the whistle</span>');
    }

    function fadeIn(sel, delayMs) {
      sel.transition().duration(drawIn).delay(delayMs || 0).style('opacity', 1);
    }
    function fadeOut(sel) {
      sel.transition().duration(drawIn).style('opacity', 0);
    }

    // Color key (G1): imperative updates as the scrub crosses pre-title ->
    // zoom -> settle, since this single-beat scrub scene changes color
    // meaning mid-beat (the declarative `beat.chip` below only covers the
    // first activation snap). Capped at 3 meaning rows + 1 standing row.
    let chipPhase = null;
    function updateChip(cutoff, t) {
      let phase;
      if (t < 0.02) phase = 'pretitle';
      else if (cutoff >= env.whistleMinute - 0.5) phase = 'settled';
      else phase = 'zoom';
      if (phase === chipPhase) return;
      chipPhase = phase;
      if (phase === 'pretitle') {
        view.setChip([
          { token: 'accent-annotation', glyph: 'dot', label: "amber = tonight's match, France v Spain" },
          { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
        ]);
      } else if (phase === 'zoom') {
        view.setChip([
          { token: 'side-yes', glyph: 'dot', label: 'cyan = money that bet YES' },
          { token: 'side-no', glyph: 'dot', label: 'orange = money that bet NO' },
          { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
        ]);
      } else {
        view.setChip([
          { token: 'side-yes', glyph: 'dot', label: 'cyan = money that bet YES' },
          { token: 'side-no', glyph: 'dot', label: 'orange = money that bet NO' },
          { token: 'state-dead', glyph: 'dead', label: 'grey = settled to zero, dead money' },
        ]);
      }
    }

    function updateForScrub(t) {
      const cutoff = env.cutoffAt(t);
      updateChip(cutoff, t);
      updateTrace(cutoff);
      // Pretitle caption: visible from kf0 (CR-18); it now clears the
      // moment trades start flowing (cutoff > 0) so it never shares its
      // lane with anything else (one caption at a time).
      if (cutoff <= 0) fadeIn(caption); else fadeOut(caption);
      // Gate-4 s01 major fix (scrub25: zero amber singletons): the dim
      // goal-preview guide owns the scene's one amber unit until the goal
      // itself resolves it into the full annotation, never both at once.
      if (cutoff > 0 && cutoff < env.eventMinute) fadeIn(goalPreview); else fadeOut(goalPreview);
      if (cutoff >= env.eventMinute) {
        placeAnnotation(
          goalAnn, clockX(env.eventMinute), priceY(env.eventPriceC), 24, -28,
          view.mobile ? '①' : 'the goal',
        );
        fadeIn(goalAnn);
      }
      if (cutoff >= env.whistleMinute - 0.5) {
        if (view.mobile) {
          placeAnnotation(goalAnn, clockX(env.eventMinute), priceY(env.eventPriceC), 24, -28, '①');
          placeWhistle(clockX(env.whistleMinute), priceY(0) - 40, 24, -12, '②');
        } else {
          placeWhistle(clockX(env.whistleMinute), priceY(0) - 40, -24, -12, 'the whistle');
        }
        fadeIn(whistleGrp);
        fadeIn(settleLine, stagger);
        // floorBand's own reveal (fill-opacity) is driven by updateTrace()'s
        // onset pulse above, fired the instant the trace reaches the floor.
        if (footerLegend) fadeIn(footerLegend);
      }
    }

    drawPriceAxis();
    drawClockAxis();
    updateChip(0, 0);

    return {
      step() {
        drawClockAxis();
        fadeIn(caption);
        updateChip(0, 0);
      },
      scrub(t) { updateForScrub(t); },
      exit() {
        g.remove();
        if (footerLegend) footerLegend.remove();
      },
    };
  },

  // Reduced motion: main.js's driveScrub() already snaps scrub tracks to
  // the nearest keyframe end-state with the standard canvas crossfade when
  // view.reducedMotion is true (CONTRACT §3.5 / §6.3). Every keyframe
  // above (bootRest / resting / kickoff / preEvent / postEvent /
  // approachFinal / whistle / settled) is independently a complete,
  // static-readable frame by construction, so the generic driver behavior
  // already satisfies "end states plus crossfades" (CONTRACT §9) for this
  // scene; no per-beat override is declared.

  beats: [
    {
      id: 'b1',
      html: `<p>For more than a year, a ticket that pays off if France wins the World Cup cost about forty cents.<sup><a href="#fn-2">2</a></sup> Here is the deal on every ticket like it: it pays one dollar if its team wins, and nothing if it does not. So a price of forty cents means the crowd thought France's chance was about forty out of a hundred. The market's own word for a ticket like this is a contract. Watch for the one vertical jump on the chart ahead: that is the goal. On July 14, Spain beat France in ninety minutes, and the ticket fell to zero.<sup><a href="#fn-1">1</a></sup> Down here, one dot is one real trade from that night. Cyan dots are money that bet yes, France wins. Orange dots are money that bet no. At the final whistle, the exchange pays a dollar to every ticket that won and nothing to every ticket that lost, a moment traders call settling, and the market closes for good. That is the pour you see hit the floor on screen. This was the night Spain booked tonight's final. Before you judge tonight's price, you should meet the thing that set it. The story starts fourteen months earlier.</p>`,
      // Hard budget (storyboard): the whole of S1, pre-title included,
      // occupies at most 6 viewport-heights. The static title header
      // (CONTRACT §8.2) already spends 1; this scrub spends the remaining 5.
      trigger: { type: 'scrub', span: 5 },
      // CR-18: the beat's own state key now points at the true no-amber
      // boot frame; the announced amber ignition is the scrub's kf1 (see
      // layout().keyframes), not this snap.
      state: 'bootRest',
      // 'instant': this is only the ONE-TIME snap into kf0 on first
      // activation, which already matches the boot-time setState frame
      // (engine.js dedupes same-reference/t>=1 tweens to a true no-op).
      // The fine-grained scrub motion itself is driven by
      // scrubBetween/setScrub over layout().keyframes, not by `kind`.
      kind: 'instant',
      // Declarative color-key snap for first activation (G1): plain color
      // words, matching the imperative phases the overlay drives as the
      // scrub proceeds (updateChip above).
      chip: [
        { token: 'accent-annotation', glyph: 'dot', label: "amber = tonight's match, France v Spain" },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      grain: {
        // Storyboard-verbatim template (CONTRACT §4.2/§4.3 zoom.grainText
        // format); {n}/{count} are filled by the driver's narrated-sampling
        // substitution. NOTE: main.js's zoomGrainText() helper is defined
        // but not yet called from activateBeat() for zoom scenes — see
        // data_requests in the build handoff.
        text: '1 dot = 1 trade · showing every {n}th of {count} trades · France–Spain, July 14',
        variant: 'debut',
      },
      overlayStep: 'b1',
    },
  ],

  zoom: {
    key: 'fraesp',
    tagBit: 'ZOOM_FRAESP',
    grainText: '1 dot = 1 trade · showing every {n}th of {count} trades · France–Spain, July 14',
  },
};
