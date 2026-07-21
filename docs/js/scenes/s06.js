/* docs/js/scenes/s06.js
 * S6 · Act II · "Anatomy of the biggest market" (zoom)
 * storyboard.md §3 S6 · CONTRACT.md §4.2 row s06 (match-zoom, scrub, zoom=mexeng)
 *
 * Vehicle: Mexico to advance past England (KXWCADVANCE MEX leg), the single
 * biggest market of the tournament (R8 + R16). Grain shift, narrated: the
 * population dims to a background field; the dots carrying the MEXENG tag
 * fly to center and unpack into tick-grain trades. Emission-rate animation:
 * trades arrive as a stream whose rate the reader feels ramp through the
 * pre-match hour and step at the whistle. Color: taker side. Size: uniform
 * -- per-trade size never scales the glyphs (design-system.md FIX C7 / §0
 * "dot size is never a magnitude channel"). REVISION (design review, bounded
 * fix pass): the size_sparkline strip that used to carry the ~15% in-play
 * size claim was dropped -- it rendered clipped by the viewport and its
 * "+15% in play" chip read as contradicting "trade sizes were typical"
 * (major finding). size_growth_pct/size_sparkline stay in the DATA_REQUEST
 * shape below for provenance but are no longer read by this file.
 *
 * DATA_REQUEST (flagged to the tile builder; not in CONTRACT §5's generic
 * shape): docs/data/scenes/s06.json, built from
 * pipeline/data/analysis/volume-anatomy/mexeng_summary.json and
 * pipeline/data/analysis/ingame-microstructure/size_regime.parquet (R8/R16).
 * Gate-5 item 5 fix: kickoff_step_multiplier / pre_kick_rate_per_s /
 * peak_minute_rate_per_s are a class-A recompute off THIS leg's own tape --
 * this market's real numbers, not the tournament-generic R16 constants (the
 * old placeholder 5.4x / 1/s values below were wrong for MEXENG and have
 * been replaced piece-wide by this scene's honest, data-derived reads):
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "window": { "kickoff_ts": ISO },   // manifest.zoom.mexeng.window gives
 *                                         // start/end but not the kickoff
 *                                         // instant itself -- needed for the
 *                                         // dwell keyframe and the kickoff step
 *     "rate_curve": [ { "t_s": <seconds from window start>, "rate_per_s": f }, ... ],
 *     "size_sparkline": [ { "t_s": <seconds>, "avg_notional_usd": f }, ... ],
 *     "kickoff_step_multiplier": 2.11,
 *     "pre_kick_rate_per_s": 26.42,
 *     "peak_minute_rate_per_s": 182.4,
 *     "size_growth_pct": 15.0
 *   }
 * Until this lands, the scene degrades gracefully: reveal collapses to a
 * plain start->full sweep (no kickoff dwell subdivision) and the rate strip
 * renders empty with its axes only -- it never fabricates a number.
 */

import {
  registry, colorOf, indicesWithFlag, makeState, setColor,
} from '../shared.js';

/* ---- local helpers (duplicated per scene file by design: shared.js is
   contract-frozen and scenes may not add to it without a contract change) */

function hash01(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

/* Deterministic "resting field" scatter for the background population --
 * a stable function of dot index alone, so any scene can reuse the same
 * shape without coordinating with whichever scene last positioned a dot. */
function restFieldXY(i, view) {
  return [
    view.region.x + hash01(i * 2) * view.region.w,
    view.region.y + hash01(i * 2 + 1) * view.region.h,
  ];
}

/* `label` may be a string (one line) or an array of lines. Multi-line
 * labels render as stacked tspans vertically centered on the dot, with
 * em-based line height (the s01 pretitle-caption wrap pattern) -- added
 * for the 390x844 mobile audit, where the kickoff callout's single line
 * was wider than the whole phone stage. */
function drawSingleton(g, x, y, tokens, label, mirror) {
  const core = tokens.dot['radius-annotated-core-px'];
  const halo = tokens.dot['radius-annotated-halo-px'];
  const stroke = tokens.dot['halo-stroke-px'];
  const sel = g.append('g').attr('class', 'singleton').attr('transform', `translate(${x},${y})`);
  sel.append('circle').attr('r', halo).attr('fill', 'none')
    .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', stroke);
  sel.append('circle').attr('r', core).attr('fill', 'var(--ink-hero)');
  if (label) {
    const lines = Array.isArray(label) ? label : [label];
    const tx = mirror ? -(halo + 6) : halo + 6;
    const text = sel.append('text')
      .attr('x', tx).attr('y', 4)
      .attr('text-anchor', mirror ? 'end' : 'start')
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-annotation-size)')
      .attr('fill', 'var(--accent-annotation)');
    if (lines.length === 1) {
      text.text(lines[0]);
    } else {
      lines.forEach((ln, li) => {
        text.append('tspan')
          .attr('x', tx)
          .attr('dy', li === 0 ? `${-0.6 * (lines.length - 1)}em` : '1.2em')
          .text(ln);
      });
    }
  }
  return sel;
}

function pinnedCaption(container, text, cls) {
  return container.html.append('div')
    .attr('class', `pinned-caption ${cls || ''}`)
    .style('position', 'absolute')
    .style('font-family', 'var(--font-apparatus)')
    .style('font-size', 'var(--type-annotation-size)')
    .style('color', 'var(--ink-hi)')
    .style('background', 'var(--bg-card)')
    .style('border', '1px solid rgba(124,135,148,0.25)')
    .style('border-radius', 'var(--space-4)')
    .style('padding', 'var(--space-8) var(--space-12)')
    .style('max-width', '46ch')
    .style('pointer-events', 'none')
    .text(text);
}

const SIDE_YES = 1;

function sideColor(tokens, sideIdx) {
  return colorOf(tokens, sideIdx === SIDE_YES ? 'side-yes' : 'side-no');
}

/* ---------------------------------------------------------------- */

export default {
  id: 's06',
  act: 2,
  title: 'One market, up close',
  kicker: 'Skill 2, continued: the tape’s limit',
  layoutName: 'match-zoom',

  needs: { scene: true, series: [], zoom: 'mexeng' },

  zoom: {
    key: 'mexeng',
    tagBit: 'ZOOM_MEXENG',
    grainText: '1 dot = 1 trade · showing every {n}th of {count} trades · Mexico-England, July 5',
  },

  scales(data, view) {
    const spec = data.manifest.zoom.mexeng;
    const winStart = spec ? new Date(spec.window[0]).getTime() : Date.now() - 86400000;
    const winEnd = spec ? new Date(spec.window[1]).getTime() : Date.now();
    // Chart-first fix (design-review P1/P2): the market's full life spans
    // about 4.3 days, but the scene's own prose and axis title only ever
    // discuss "the last 24 hours." Plotting the full window crushed the
    // kickoff step into the rightmost ~2% of the x-axis and left the pace
    // lane and every trade dot piled into a near-invisible sliver. Domain
    // narrows to the window's own trailing 24 hours -- data-derived
    // (winEnd minus 24h, not invented) -- so the caption is literally true
    // and the pre-kickoff build-up finally has room on screen.
    const domainStart = Math.max(winStart, winEnd - 24 * 3600 * 1000);
    // KEY RECT (design-revision-spec G5, precedent: s12.js): the fixed
    // top-right color key sits over this scene's own top-right corner,
    // exactly where the pace lane's kickoff climax lands (design review
    // M5 -- "KEY panel occludes the arrivals line where the kickoff
    // climax should appear"). Cap the drawable range short of the key's
    // exclusion box on desktop instead of asking the key to move.
    const keyMarginPx = view.mobile ? 0
      : (view.tokens.layout['key-exclusion-w-px'] || 280) + view.tokens.spacing_px[3];
    const xRangeMax = Math.min(view.region.x + view.region.w, view.W - keyMarginPx - view.safe);
    const x = d3.scaleUtc().domain([domainStart, winEnd])
      .range([view.region.x, xRangeMax]);
    // Two bands share the stage, top to bottom: the arrival-rate pace lane
    // (this scene's chart-first figure) on top, the tick-price stream
    // below it -- both inside view.region, never clipped off-canvas above
    // it (the prior bug: the rate lane's own range went negative).
    const paceH = view.region.h * 0.22;
    const paceTop = view.region.y;
    const paceBottom = view.region.y + paceH;
    const stageTop = paceBottom + 28;
    const stageBottom = view.region.y + view.region.h;
    const y = d3.scaleLinear().domain([0, 100])
      .range([stageBottom, stageTop]);
    // Honest axis (Gate-5 item 5): domain fits THIS market's own real
    // range, not a generic cross-tournament clamp. The 15-minute rate
    // curve peaks near 119 trades/s late in the match; take the curve's
    // actual max with a little headroom so the true shape -- including
    // the kickoff step -- draws in full, at its real height, never
    // clipped flat. The old fixed [0,6] domain is the fake-flatline bug
    // this replaces. Falls back to a small placeholder domain only if
    // the curve hasn't loaded yet (graceful degrade, DATA_REQUEST above).
    // Gate-5 provenance audit (WRONG_SCOPE): the 15-minute-binned curve's
    // own max structurally cannot reach the 1-minute-binned peak the b1
    // prose cites ("182 trades a second") -- coarser bins smooth spikes
    // down. domainTop now takes whichever of the two is larger, so the
    // drawn axis can never fall short of a number the reader is told,
    // even though the smooth curve itself will still visibly stop short
    // of that ceiling (real, not a bug -- see the peak-minute marker
    // drawn separately in overlay() below).
    const rateCurveForDomain = (data.scene && Array.isArray(data.scene.rate_curve))
      ? data.scene.rate_curve : null;
    const curveMax = (rateCurveForDomain && rateCurveForDomain.length)
      ? d3.max(rateCurveForDomain, (d) => d.rate_per_s)
      : 6;
    const peakMinuteRate = (data.scene && typeof data.scene.peak_minute_rate_per_s === 'number')
      ? data.scene.peak_minute_rate_per_s : 0;
    const rateMax = Math.max(curveMax, peakMinuteRate);
    const rate = d3.scaleLinear().domain([0, rateMax * 1.05]) // trades/second, true range + 5% headroom
      .range([paceBottom, paceTop]);
    registry.register('s06.x', x);
    registry.register('s06.y', y);
    registry.register('s06.rate', rate);
    return {
      x, y, rate, paceTop, paceBottom, stageTop, stageBottom,
    };
  },

  layout(data, view) {
    const { pop } = data;
    const N = pop.count;
    const state = makeState(N);
    // Figure-ground fix (design review C2): the tournament-wide rest field
    // covers this entire stage (restFieldXY scatters across the full
    // region), directly behind the one match's own tape. dimmed-field-min
    // (alpha 0.25) still reads as a dominant static texture at this
    // density -- drop further, matching the precedent already set in
    // s01.js (0.40 -> 0.10 for the same reason), so the resting tournament
    // money recedes and the active tape is the only thing that pops.
    const restRgba = view.color('field-rest', 0.08);
    const baseSize = view.tokens.dot['radius-base-px'];
    // Active trade dots get a size bump on top of the color/alpha contrast
    // already available (side.yes/side.no ship at full alpha, i.e.
    // engine.js's active tier) -- a uniform bump, not a magnitude channel
    // (every active dot gets the same radius regardless of trade size).
    const activeSize = baseSize * 1.5;

    for (let i = 0; i < N; i++) {
      const [rx, ry] = restFieldXY(i, view);
      state.x[i] = rx; state.y[i] = ry;
      setColor(state.color, i, restRgba);
      state.size[i] = baseSize;
    }

    const x = registry.get('s06.x');
    const y = registry.get('s06.y');
    const [domainStartMs, domainEndMs] = x.domain().map((d) => d.getTime());

    const bit = data.flagBit('ZOOM_MEXENG');
    const tagged = indicesWithFlag(pop.flags, bit);
    const D = tagged.length;
    const tile = data.zoom.mexeng;
    const T = tile ? tile.count : 0;
    const runtimeStride = (T && D) ? Math.max(1, Math.ceil(T / D)) : 1;

    // Fixed per-dot tick assignment (identity: tagged[i] <- tile row i*stride).
    // Ticks earlier than the chart's own trailing-24h domain (most of a
    // 4+ day market's early life) are left unassigned: they stay part of
    // the ambient resting field instead of being placed off-canvas.
    const tickTs = new Float64Array(D);
    if (tile && D) {
      for (let i = 0; i < D; i++) {
        const row = Math.min(i * runtimeStride, T - 1);
        const di = tagged[i];
        const ts = tile.t0 + tile.ts_ms[row];
        if (ts < domainStartMs || ts > domainEndMs) continue;
        tickTs[i] = ts;
        state.x[di] = x(ts);
        state.y[di] = y(tile.price_c[row]);
        setColor(state.color, di, sideColor(view.tokens, tile.side[row]));
        state.size[di] = 0; // hidden until its reveal keyframe (protocol use of size)
      }
    }

    // Keyframe cut times: the chart's own trailing-24h domain, with a dwell
    // on the last pre-kick hour, per storyboard S6 §Scroll. Degrades to a
    // 2-point sweep if the kickoff instant isn't in the scene JSON yet
    // (DATA_REQUEST above).
    const kickoffTs = data.scene && data.scene.window && data.scene.window.kickoff_ts
      ? new Date(data.scene.window.kickoff_ts).getTime()
      : null;

    const cuts = kickoffTs
      ? [
        { at: 0.0, cutoff: domainStartMs },
        { at: 0.55, cutoff: kickoffTs - 3600000 },   // T-1h: dwell begins
        { at: 0.80, cutoff: kickoffTs },              // whistle: the kickoff step
        { at: 1.0, cutoff: domainEndMs },
      ]
      : [
        { at: 0.0, cutoff: domainStartMs },
        { at: 1.0, cutoff: domainEndMs },
      ];

    const states = {};
    const keyframes = [];
    cuts.forEach((c, ci) => {
      const key = `k${ci}`;
      const s = { x: state.x, y: state.y, color: state.color, size: new Float32Array(N) };
      s.size.set(state.size);
      for (let i = 0; i < D; i++) {
        if (tickTs[i] && tickTs[i] <= c.cutoff) s.size[tagged[i]] = activeSize;
      }
      states[key] = s;
      keyframes.push({ at: c.at, state: key });
    });

    return { states, keyframes };
  },

  overlay(container, data, view, scales) {
    const {
      x, y, rate, paceTop, paceBottom, stageTop,
    } = scales;
    const g = container.svg;
    const [rangeMin, rangeMax] = x.range();
    const rateDomainMax = rate.domain()[1] || 6;

    // ET tick format: the tape is stored in UTC; the reader is told
    // "Eastern Time" (G3), so ticks apply a fixed UTC-4 (EDT, July) shift
    // rather than the browser's own local zone.
    function etHourLabel(d) {
      const et = new Date(d.getTime() - 4 * 3600 * 1000);
      let h = et.getUTCHours() % 12;
      if (h === 0) h = 12;
      return `${h}${et.getUTCHours() >= 12 ? 'pm' : 'am'}`;
    }

    const axisG = g.append('g').attr('class', 's06-axis');
    axisG.append('g')
      .attr('transform', `translate(0,${view.region.y + view.region.h + 8})`)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .attr('color', 'var(--ink-mid)')
      .call(d3.axisBottom(x).ticks(6).tickFormat(etHourLabel));
    // Title dropped further below the tick row (design review m6: it
    // printed straight through the 8am/11am/2pm labels at +24). D3's own
    // tick text sits ~9-12px under the axis line at this font size, so the
    // title needs a clearer gap than a bare +24 to actually clear it.
    axisG.append('text')
      .attr('x', view.region.x + view.region.w / 2)
      .attr('y', view.region.y + view.region.h + 8 + 34)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)')
      .text('the market’s last 24 hours (Eastern Time)');

    // Price lane axis (design review M4: the tape rendered as an unlabeled
    // step-line with no stated vertical meaning). y is the same registered
    // scale the tape's own dots are plotted against, so the axis is an
    // honest read of what the dots already encode.
    g.append('g').attr('class', 's06-price-axis')
      .attr('transform', `translate(${view.region.x},0)`)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .attr('color', 'var(--ink-mid)')
      .call(d3.axisLeft(y).ticks(4).tickFormat((v) => `${v}¢`));
    g.append('text')
      .attr('x', view.region.x)
      .attr('y', stageTop - 10)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)')
      .text('price the tape traded at (¢) — each dot, one trade');

    // Headline-message anchor (design review M3: "biggest single market of
    // the tournament" had no visual carrier and the composition argued the
    // opposite). A direct label pinned beside the tape itself, not just in
    // the prose column, so the claim has a findable on-screen referent.
    // Mobile (390x844 layout audit): the single line ran 10px past the
    // viewport's right edge, so it wraps into two tspans stacked downward
    // into the stage (upward would graze the price-lane title at
    // stageTop - 10); desktop keeps the one-line lane.
    const anchorText = g.append('text')
      .attr('x', view.region.x)
      .attr('y', stageTop + 16)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-hi)');
    if (view.mobile) {
      anchorText.append('tspan')
        .attr('x', view.region.x)
        .text('every dot below: the tournament’s');
      anchorText.append('tspan')
        .attr('x', view.region.x).attr('dy', '1.2em')
        .text('single biggest market');
    } else {
      anchorText.text('every dot below: the tournament’s single biggest market');
    }

    const zoomSpec = data.manifest.zoom.mexeng;
    const rateT0 = zoomSpec ? new Date(zoomSpec.window[0]).getTime() : null;
    const rateCurve = (data.scene && Array.isArray(data.scene.rate_curve)) ? data.scene.rate_curve : null;
    // One nearest-sample lookup shared by the desktop playhead marker and
    // the mobile metronome (previously duplicated inline in scrub()).
    function rateNear(tsMs) {
      if (!rateCurve || !rateCurve.length || rateT0 === null) return null;
      const tS = (tsMs - rateT0) / 1000;
      let nearest = rateCurve[0];
      for (const d of rateCurve) if (Math.abs(d.t_s - tS) < Math.abs(nearest.t_s - tS)) nearest = d;
      return nearest.rate_per_s;
    }

    const rateG = g.append('g').attr('class', 's06-rate-strip');
    let rateClipRect = null;
    let ratePlayhead = null;
    if (rateCurve && rateCurve.length && rateT0 !== null) {
      // Honest axis (Gate-5 item 5): the pace scale's own domain now
      // stretches to this market's real peak (scales(), d3.max over
      // rate_curve), so every value plots at its true height -- no clamp,
      // no manufactured flatline.
      const line = d3.line()
        .x((d) => x(rateT0 + d.t_s * 1000))
        .y((d) => rate(d.rate_per_s));
      // Progressive reveal (design review C1): the line was previously
      // fully drawn the instant the beat activated, so scrub25/50/90
      // captured the identical fully-drawn curve. A clip-rect whose width
      // tracks scrub progress turns "trades arriving" into an event the
      // reader watches happen, not a fact pre-printed on entry.
      // Clip the CURVE PATH ONLY -- the axis and title below are appended
      // outside this clip so they render immediately (they are static
      // chrome, not the narrated event) instead of being clipped away
      // themselves (they sit left of rangeMin, at region.x - 8).
      const clipId = 's06-reveal-clip';
      rateClipRect = g.append('defs').append('clipPath').attr('id', clipId)
        .append('rect')
        .attr('x', rangeMin).attr('y', paceTop - 4)
        .attr('width', 0).attr('height', paceBottom - paceTop + 8);
      rateG.append('path')
        .datum(rateCurve)
        .attr('fill', 'none')
        .attr('stroke', 'var(--neutral-data)')
        .attr('stroke-width', 1.5)
        .attr('clip-path', `url(#${clipId})`)
        .attr('d', line);
      rateG.append('g')
        .attr('transform', `translate(${view.region.x - 8},0)`)
        .attr('font-family', 'var(--font-apparatus)')
        .attr('font-size', 'var(--type-micro-size)')
        .call(d3.axisLeft(rate).ticks(3));
      // Title sits INSIDE the pace band (not above the topmost tick, G3's
      // usual placement) so it never collides with the Zone K caption slot
      // just above view.region.y once the scrub reaches its final caption.
      rateG.append('text')
        .attr('fill', 'var(--ink-mid)')
        .attr('font-family', 'var(--font-apparatus)')
        .attr('font-size', 'var(--type-caption-size)')
        .attr('x', view.region.x)
        .attr('y', paceTop + 12)
        .text('trades arriving (per second)');
      // Playhead: a small luminance marker riding the curve's current
      // value, outside the clip so it stays visible at the reveal's
      // leading edge -- the "abrupt onset / moving mark" the change-
      // blindness literature says a static screenshot series can actually
      // register (perception-brief §7).
      ratePlayhead = g.append('circle').attr('class', 's06-playhead')
        .attr('r', 3.5).attr('fill', 'var(--ink-hero)')
        .attr('cx', rangeMin).attr('cy', rate(rateCurve[0].rate_per_s));
    }

    // Peak-minute marker (Gate-5 provenance audit): a distinct, labeled
    // reference line at this leg's own 1-minute-binned peak_minute_rate_per_s
    // -- a DIFFERENT, finer-grained measurement than the smooth 15-minute
    // rate_curve above it, so it is drawn as its own dashed ceiling rather
    // than implied to be a point the curve should touch.
    if (data.scene && typeof data.scene.peak_minute_rate_per_s === 'number') {
      const peakY = rate(data.scene.peak_minute_rate_per_s);
      const peakG = g.append('g').attr('class', 's06-peak-minute');
      peakG.append('line')
        .attr('x1', rangeMin).attr('x2', rangeMax)
        .attr('y1', peakY).attr('y2', peakY)
        .attr('stroke', 'var(--ink-mid)').attr('stroke-width', 1)
        .attr('stroke-dasharray', '1,3').attr('stroke-opacity', 0.6);
      peakG.append('text')
        .attr('x', rangeMax).attr('y', peakY - 4)
        .attr('text-anchor', 'end')
        .attr('fill', 'var(--ink-mid)')
        .attr('font-family', 'var(--font-apparatus)')
        .attr('font-size', 'var(--type-micro-size)')
        .text(`busiest single minute: ${Math.round(data.scene.peak_minute_rate_per_s)}/s`);
    }

    let kickoffX = null;
    let kickoffTs = null;
    if (data.scene && data.scene.window && data.scene.window.kickoff_ts) {
      kickoffTs = new Date(data.scene.window.kickoff_ts).getTime();
      kickoffX = x(kickoffTs);
    }

    const kickoffG = g.append('g').attr('class', 's06-kickoff').style('display', 'none');
    let kickoffCallout = null;
    if (kickoffX !== null) {
      kickoffG.append('line')
        .attr('x1', kickoffX).attr('x2', kickoffX)
        .attr('y1', paceTop).attr('y2', view.region.y + view.region.h)
        .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '2,3')
        .attr('stroke-opacity', 0.15);
      const mult = data.scene.kickoff_step_multiplier;
      // Mobile (390x844 layout audit): the one-line "doubles" label,
      // mirrored end-anchored off a kickoffX near the stage's right edge,
      // ran 35px past the viewport's LEFT edge. It wraps into two lines on
      // the phone (drawSingleton's array form, the s01 tspan pattern) --
      // the wording itself stays intact because the b1 prose points the
      // reader at it ("the whistle doubled that pace"). Desktop keeps the
      // one-line lane, which fits there.
      const label = mult
        ? (view.mobile
          ? ['kickoff: the whistle doubles', 'an already-flooding tape']
          : 'kickoff: the whistle doubles an already-flooding tape')
        : 'kickoff: the pace steps up';
      // Anchored to the rate curve's own value at kickoff (design review
      // M5: the marker previously sat fixed near the pace lane's zero
      // baseline, detached from the step it claimed to describe). Falls
      // back to the old bottom-edge anchor only if the curve is missing.
      // No clamp (Gate-5 item 5): the pace scale's domain already covers
      // this market's true range (scales()), so the marker's real height
      // is always on-canvas.
      const kickoffRate = rateNear(kickoffTs);
      const calloutY = kickoffRate !== null
        ? rate(kickoffRate) - 14 : paceBottom - 10;
      // Kickoff lands late in the trailing-24h window (near the capped
      // right edge, short of the KEY exclusion zone per scales()), so the
      // label mirrors left once past 70% of the *drawable* width -- not
      // the old view.region.w, which over-ran into the key margin.
      const mirrorLabel = kickoffX > rangeMin + (rangeMax - rangeMin) * 0.7;
      kickoffCallout = drawSingleton(kickoffG, kickoffX, calloutY, view.tokens, label, mirrorLabel)
        .style('opacity', 0)
        .style('transition', 'opacity 240ms ease');
    }

    // Scroll-t -> timestamp mapping for the playhead/reveal, matching
    // layout()'s own keyframe cuts EXACTLY (not a naive linear t -> pixel
    // map). Kickoff sits ~90%+ across the raw time domain, so a linear
    // reveal would cram the whistle and everything after it into the
    // final few percent of scroll -- the same "climax squeezed to the
    // right edge" failure the domain-narrowing fix (scales()) already
    // solved once for the particle population. Reusing the identical
    // dwell breakpoints (T-1h at 55%, whistle at 80%) means the reveal
    // reaches kickoff at the same scroll position the dot population
    // does, comfortably inside the 25/50/90 capture range instead of
    // hiding past it.
    const [domainStartMs, domainEndMs] = x.domain().map((d) => d.getTime());
    const revealCuts = kickoffTs
      ? [
        { at: 0.0, ts: domainStartMs },
        { at: 0.55, ts: kickoffTs - 3600000 },
        { at: 0.80, ts: kickoffTs },
        { at: 1.0, ts: domainEndMs },
      ]
      : [{ at: 0.0, ts: domainStartMs }, { at: 1.0, ts: domainEndMs }];
    function tToTs(t) {
      let i = 0;
      while (i < revealCuts.length - 2 && t > revealCuts[i + 1].at) i++;
      const a = revealCuts[i]; const b = revealCuts[i + 1];
      const span = Math.max(b.at - a.at, 1e-6);
      const frac = Math.min(Math.max((t - a.at) / span, 0), 1);
      return a.ts + frac * (b.ts - a.ts);
    }

    // Zone K occupant: the scene's one honest-limit line. It is withheld
    // until the scrub nears its end (G6 "final step"), not shown from the
    // moment the beat activates, so it reads as the scene's conclusion.
    const captionEl = pinnedCaption(
      container,
      'What moved is certain. Why it moved is not.',
      's06-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y - 40}px`)
      .style('display', 'none');

    // Mobile: fine stream texture is illegible at phone size -- the rate
    // axis becomes a haptic-adjacent visual metronome (a single pulsing dot)
    // instead of the line strip (design-system.md S6 note). Moved to the
    // top-right (mobile KEY band) so it never collides with the Zone K
    // caption slot on the left (design-revision-spec S6, mobile note).
    let metronome = null;
    if (view.mobile) {
      rateG.style('display', 'none');
      metronome = container.html.append('div')
        .attr('class', 's06-metronome')
        .style('position', 'absolute')
        .style('width', '10px').style('height', '10px')
        .style('border-radius', '50%')
        .style('background', 'var(--accent-annotation)')
        .style('right', 'var(--space-16)')
        .style('top', `${view.region.y - 40}px`)
        .style('opacity', 0.4);
    }

    function step(beatId) {
      if (beatId === 'b1') {
        kickoffG.style('display', null);
      }
    }

    function scrub(t) {
      captionEl.style('display', t >= 0.92 ? null : 'none');
      const cxTs = tToTs(t);
      const cx = x(cxTs);
      if (rateClipRect) {
        rateClipRect.attr('width', Math.max(0, cx - rangeMin));
      }
      const curRate = rateNear(cxTs);
      if (ratePlayhead && curRate !== null) {
        // No clamp (Gate-5 item 5): the pace scale's domain already spans
        // this market's true range, so the playhead rides its real value
        // the whole way, kickoff spike included.
        ratePlayhead.attr('cx', cx).attr('cy', rate(curRate));
      }
      if (kickoffX !== null) {
        const reached = cx >= kickoffX;
        kickoffG.select('line').attr('stroke-opacity', reached ? 0.9 : 0.15);
        if (kickoffCallout) kickoffCallout.style('opacity', reached ? 1 : 0);
      }
      if (metronome && curRate !== null) {
        // Normalized against this market's own real peak (the pace
        // scale's domain, Gate-5 item 5), not a hardcoded 6.
        const alpha = Math.min(1, 0.25 + curRate / rateDomainMax);
        metronome.style('opacity', alpha);
      }
    }

    return {
      step,
      scrub,
      exit() {
        g.selectAll('*').remove();
        captionEl.remove();
        if (metronome) metronome.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>The biggest single market of the whole tournament was not the
        market on who wins it all. It was one question: would Mexico knock out
        England? Mexico was a host country of this World Cup, playing at home.
        The money that piled up that night was bets on that one match. The tape
        recorded 158.7 million tickets bought and sold, in about a million
        separate trades.<sup><a href="#fn-9">9</a></sup></p>
        <p>Zoomed in, trade by trade, it looks almost ordinary. Trade sizes
        were typical. More people bought yes than no, the same pattern found
        everywhere on this exchange. Trading ran heavier before kickoff than
        in a typical knockout match.<sup><a href="#fn-9">9</a></sup></p>
        <p>The tape can say that money moved. It cannot say why. One buyer
        may be backing the team they love. Another may be buying the other
        side as insurance: if their team loses, the payout softens the
        blow. The tape prints both trades the same way. What moved is
        certain. Why it moved is not.</p>
        <p>The pace tells its own story. Before kickoff, the tape was
        already flooding: about twenty-six trades landed every second.
        Watch for the kickoff line: the whistle doubled that pace. The
        busiest single minute of the match printed 182 trades a
        second.<sup><a href="#fn-10">10</a></sup></p>
        <p>Volume tells you where the crowd is watching. It does not tell you
        what the crowd knows. For that, you have to watch prices move during
        a match itself. That is next.</p>`,
      // Non-uniform scroll-to-time mapping lives in layout().keyframes;
      // span is a pacing choice for this gateway zoom scene (not itself a
      // dated figure), matching S1/S8's scrub-track convention.
      trigger: { type: 'scrub', span: 4.5 },
      state: 'k0',
      kind: 'resort',
      chip: [
        { token: 'side-yes', glyph: 'dot', label: 'cyan = money that bet YES on Mexico advancing' },
        { token: 'side-no', glyph: 'dot', label: 'orange = money that bet NO' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      overlayStep: 'b1',
    },
  ],

  // No reducedMotion.states override: this is a scrub scene, and §3.5's
  // driver-level keyframe-snap (scrubBetween/setScrub snap to nearest
  // keyframe + 400ms crossfade) already governs reduced-motion behavior
  // directly from layout().keyframes -- a static per-beat override here
  // would only affect the instant of activation and immediately be
  // superseded by the first scrub sample.
};
