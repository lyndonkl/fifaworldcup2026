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
function computeEnvelope(zoomTile) {
  const matchEndMinutes = zoomTile && zoomTile.count
    ? zoomTile.ts_ms[zoomTile.count - 1] / 60000
    : 100;
  let eventMinute = null;
  let eventPriceC = 50;
  if (zoomTile) {
    for (let i = 0; i < zoomTile.count; i++) {
      if (zoomTile.flags[i] & 1) {
        eventMinute = zoomTile.ts_ms[i] / 60000;
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
  // accelerating." Breakpoints below realize that envelope:
  //   0.00-0.06 intro/kickoff (6%)
  //   0.06-0.20 compressed early match (14%)
  //   0.20-0.60 dwell around the repricing event (40%)
  //   0.60-0.68 compressed post-event walk to the final stretch (8%)
  //   0.68-0.93 final minutes + whistle dwell (25%)
  //   0.93-1.00 settlement pour (7%)
  const breakpoints = [
    { at: 0.00, clock: 0 },
    { at: 0.06, clock: 0 },
    { at: 0.20, clock: Math.max(0, eventMinute - pad) },
    { at: 0.60, clock: Math.min(whistleMinute, eventMinute + pad) },
    { at: 0.68, clock: Math.max(eventMinute + pad, whistleMinute - 10) },
    { at: 0.93, clock: whistleMinute },
    { at: 1.00, clock: matchEndMinutes },
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
  return { eventMinute, eventPriceC, whistleMinute, matchEndMinutes, breakpoints, cutoffAt };
}

/* Heuristic leg classification from manifest.zoom.fraesp.legs entries
 * (ticker/label strings). Storyboard: "y = price of the France winner
 * leg; the 3-way legs run as fainter companion streams." The hero leg is
 * the tournament futures contract (KXMENWORLDCUP...); the match's 3-way
 * legs (KXWCGAME...) are companions. Both France-labeled legs (hero
 * futures AND the match's "France win" 3-way leg) settle to the zero line
 * at the pour; see settledState(). */
function isHeroLeg(leg) {
  return !!(leg && /WORLDCUP/i.test(leg.ticker || ''));
}
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
    const dimColor = view.state('dimmed-field-max');   // 0.40 -> rest-tier (dimmed)
    const yesColor = view.color('side-yes', ACTIVE_A); // real ticks: active-tier
    const noColor = view.color('side-no', ACTIVE_A);
    const waitColor = view.color('field-rest', 0.10);  // staged/not-yet-arrived: below rest band
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
        setColor(s.color, i, dimColor);
        s.size[i] = BASE_PX;
      }
      for (let d = 0; d < D; d++) {
        const i = taggedIdx[d];
        const t = sampleIdx[d];
        const minute = T ? zoomTile.ts_ms[t] / 60000 : 0;
        if (T && minute <= cutoffMinutes) {
          const legSpec = (zoomTile.legs || [])[zoomTile.leg[t]];
          const faint = !isHeroLeg(legSpec); // 3-way legs: fainter companions
          const base = zoomTile.side[t] === YES_IDX ? yesColor : noColor;
          s.x[i] = clockX(minute);
          s.y[i] = priceY(zoomTile.price_c[t]);
          // Hero France-winner leg stays active-tier (base alpha 1.0, boosted);
          // the 3-way companion legs drop to 0.40 (perception-brief §9b: a
          // dimmed-field-tier alpha, not the old 0.5 which sat in the
          // shader's unclassified 0.42-0.90 gap and half-competed with the
          // boosted hero stream). A deliberate two-tier read: hero pops,
          // companions recede into the same tier as the resting field.
          setColor(s.color, i, faint ? [base[0], base[1], base[2], base[3] * 0.40] : base);
        } else {
          s.x[i] = stageX; s.y[i] = stageY;
          setColor(s.color, i, waitColor);
        }
        s.size[i] = BASE_PX;
      }
      return s;
    }

    // ---- settlement: "the France dots pour to the zero line" (both the
    // WORLDCUP futures leg and the match's own "France win" 3-way leg),
    // hue drained to state.dead, position at price 0. Non-France legs keep
    // whatever their last real traded price shows (real data already
    // encodes the settlement move for the winning side). ----
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

    // The match-clock axis's domain visibly grows/accelerates through the
    // scrub (storyboard: "the match-clock axis visibly accelerating so the
    // compression is honest and narrated").
    function drawClockAxis(maxMinutes) {
      const scale = d3.scaleLinear().domain([0, Math.max(5, maxMinutes)]).range(clockX.range());
      const axisFn = view.mobile
        ? d3.axisTop(scale).ticks(6).tickFormat((d) => `${Math.round(d)}'`)
        : d3.axisBottom(scale).ticks(6).tickFormat((d) => `${Math.round(d)}'`);
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

    // Settlement reference line at price = 0.
    const settleLine = g.append('line').attr('class', 'settle-line')
      .attr('x1', view.region.x).attr('x2', view.region.x + view.region.w)
      .attr('y1', priceY(0)).attr('y2', priceY(0))
      .attr('stroke', view.css('ink-low')).attr('stroke-dasharray', '2,4')
      .style('opacity', 0);

    // One pre-title caption line (storyboard overlay spec), lifted
    // verbatim from the beat's own narration. Retimed (CR-18) to be
    // visible from kf0 rather than gated behind a t>0.005 threshold.
    const caption = g.append('text').attr('class', 'pretitle-caption')
      .attr('x', view.region.x).attr('y', view.region.y - 16)
      .attr('fill', view.css('ink-mid'))
      .style('font-family', view.css('font-tape'))
      .style('font-size', view.css('type-tape-size'))
      // Names what the lit/active movers ARE (tonight's match) so the pop has a
      // referent, and keeps the unit statement at first contact.
      .text('the lit dots: tonight, France–Spain · one dot is one trade')
      .style('opacity', 0);

    // Transient caption for the 3-way companion streams (design-revision-
    // spec §2 S1 item 3): names the fainter streams once they first
    // appear, then clears before the goal so it never competes with the
    // scene's one amber unit.
    const companionCaption = g.append('text').attr('class', 'companion-caption')
      .attr('x', view.region.x).attr('y', view.region.y - 40)
      .attr('fill', view.css('ink-mid'))
      .style('font-family', view.css('font-tape'))
      .style('font-size', view.css('type-tape-size'))
      .text('fainter streams: the match’s own win / draw / lose legs')
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

    let lastCutoff = -1;
    function updateForScrub(t) {
      const cutoff = env.cutoffAt(t);
      if (Math.abs(cutoff - lastCutoff) > 0.05) {
        drawClockAxis(cutoff);
        lastCutoff = cutoff;
      }
      updateChip(cutoff, t);
      // Pretitle caption: visible from kf0 (CR-18), not gated on t>0.005.
      if (t < 0.5) fadeIn(caption); else fadeOut(caption);
      // Companion-stream caption: transient, appears once trades start
      // flowing and clears before the goal so it never shares a frame
      // with the scene's one amber unit.
      if (cutoff > 0 && cutoff < env.eventMinute) fadeIn(companionCaption); else fadeOut(companionCaption);
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
        if (footerLegend) fadeIn(footerLegend);
      }
    }

    drawPriceAxis();
    drawClockAxis(5);
    updateChip(0, 0);

    return {
      step() {
        drawClockAxis(5);
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
