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
 * -- per-trade size never scales the glyphs; the ~15% in-play size growth
 * lives only in the D3 sparkline (design-system.md FIX C7 / §0 "dot size is
 * never a magnitude channel").
 *
 * DATA_REQUEST (flagged to the tile builder; not in CONTRACT §5's generic
 * shape): docs/data/scenes/s06.json, built from
 * pipeline/data/analysis/volume-anatomy/mexeng_summary.json and
 * pipeline/data/analysis/ingame-microstructure/size_regime.parquet (R8/R16):
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "window": { "kickoff_ts": ISO },   // manifest.zoom.mexeng.window gives
 *                                         // start/end but not the kickoff
 *                                         // instant itself -- needed for the
 *                                         // dwell keyframe and the ~5.4x step
 *     "rate_curve": [ { "t_s": <seconds from window start>, "rate_per_s": f }, ... ],
 *     "size_sparkline": [ { "t_s": <seconds>, "avg_notional_usd": f }, ... ],
 *     "kickoff_step_multiplier": 5.4,
 *     "pre_kick_rate_per_s": 1.0,
 *     "size_growth_pct": 15.0
 *   }
 * Until this lands, the scene degrades gracefully: reveal collapses to a
 * plain start->full sweep (no kickoff dwell subdivision) and the rate/size
 * strips render empty with their axes only -- it never fabricates a number.
 */

import {
  registry, colorOf, particleState, indicesWithFlag, makeState, setColor,
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

function drawSingleton(g, x, y, tokens, label) {
  const core = tokens.dot['radius-annotated-core-px'];
  const halo = tokens.dot['radius-annotated-halo-px'];
  const stroke = tokens.dot['halo-stroke-px'];
  const sel = g.append('g').attr('class', 'singleton').attr('transform', `translate(${x},${y})`);
  sel.append('circle').attr('r', halo).attr('fill', 'none')
    .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', stroke);
  sel.append('circle').attr('r', core).attr('fill', 'var(--ink-hero)');
  if (label) {
    sel.append('text').attr('x', halo + 6).attr('y', 4)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-annotation-size)')
      .attr('fill', 'var(--accent-annotation)')
      .text(label);
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
  title: 'Anatomy of the biggest market',
  layoutName: 'match-zoom',

  needs: { scene: true, series: [], zoom: 'mexeng' },

  zoom: {
    key: 'mexeng',
    tagBit: 'ZOOM_MEXENG',
    grainText: '1 dot = 1 trade · showing every {n}th of {count} trades',
  },

  scales(data, view) {
    const spec = data.manifest.zoom.mexeng;
    const winStart = spec ? new Date(spec.window[0]).getTime() : Date.now() - 86400000;
    const winEnd = spec ? new Date(spec.window[1]).getTime() : Date.now();
    const x = d3.scaleUtc().domain([winStart, winEnd])
      .range([view.region.x, view.region.x + view.region.w]);
    const y = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + view.region.h, view.region.y]);
    // Arrival-rate strip: its own bounded band above the main stage (never
    // painted over the price field -- design-system §"channel sequencing").
    const rateBandH = view.region.h * 0.14;
    const rate = d3.scaleLinear().domain([0, 6]) // trades/second, headroom above the ~5.4x step
      .range([view.region.y - 12, view.region.y - 12 - rateBandH]);
    registry.register('s06.x', x);
    registry.register('s06.y', y);
    registry.register('s06.rate', rate);
    return { x, y, rate };
  },

  layout(data, view) {
    const { pop, manifest } = data;
    const N = pop.count;
    const state = makeState(N);
    const restRgba = particleState(view.tokens, 'dimmed-field-min');
    const baseSize = view.tokens.dot['radius-base-px'];

    for (let i = 0; i < N; i++) {
      const [rx, ry] = restFieldXY(i, view);
      state.x[i] = rx; state.y[i] = ry;
      setColor(state.color, i, restRgba);
      state.size[i] = baseSize;
    }

    const x = registry.get('s06.x');
    const y = registry.get('s06.y');

    const bit = data.flagBit('ZOOM_MEXENG');
    const tagged = indicesWithFlag(pop.flags, bit);
    const D = tagged.length;
    const tile = data.zoom.mexeng;
    const T = tile ? tile.count : 0;
    const runtimeStride = (T && D) ? Math.max(1, Math.ceil(T / D)) : 1;

    // Fixed per-dot tick assignment (identity: tagged[i] <- tile row i*stride).
    const tickTs = new Float64Array(D);
    if (tile && D) {
      for (let i = 0; i < D; i++) {
        const row = Math.min(i * runtimeStride, T - 1);
        const di = tagged[i];
        const ts = tile.t0 + tile.ts_ms[row];
        tickTs[i] = ts;
        state.x[di] = x(ts);
        state.y[di] = y(tile.price_c[row]);
        setColor(state.color, di, sideColor(view.tokens, tile.side[row]));
        state.size[di] = 0; // hidden until its reveal keyframe (protocol use of size)
      }
    }

    // Keyframe cut times: compressed 24h with a dwell on the last pre-kick
    // hour, per storyboard S6 §Scroll. Degrades to a 2-point sweep if the
    // kickoff instant isn't in the scene JSON yet (DATA_REQUEST above).
    const kickoffTs = data.scene && data.scene.window && data.scene.window.kickoff_ts
      ? new Date(data.scene.window.kickoff_ts).getTime()
      : null;
    const winStartMs = manifest.zoom.mexeng ? new Date(manifest.zoom.mexeng.window[0]).getTime() : null;
    const winEndMs = manifest.zoom.mexeng ? new Date(manifest.zoom.mexeng.window[1]).getTime() : null;

    const cuts = kickoffTs
      ? [
        { at: 0.0, cutoff: winStartMs },
        { at: 0.55, cutoff: kickoffTs - 3600000 },   // T-1h: dwell begins
        { at: 0.80, cutoff: kickoffTs },              // whistle: the ~5.4x step
        { at: 1.0, cutoff: winEndMs },
      ]
      : [
        { at: 0.0, cutoff: winStartMs },
        { at: 1.0, cutoff: winEndMs },
      ];

    const states = {};
    const keyframes = [];
    cuts.forEach((c, ci) => {
      const key = `k${ci}`;
      const s = { x: state.x, y: state.y, color: state.color, size: new Float32Array(N) };
      s.size.set(state.size);
      for (let i = 0; i < D; i++) {
        if (tickTs[i] <= c.cutoff) s.size[tagged[i]] = baseSize;
      }
      states[key] = s;
      keyframes.push({ at: c.at, state: key });
    });

    return { states, keyframes };
  },

  overlay(container, data, view, scales) {
    const { x, rate } = scales;
    const g = container.svg;

    const axisG = g.append('g').attr('class', 's06-axis');
    axisG.append('g')
      .attr('transform', `translate(0,${view.region.y + view.region.h + 8})`)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .attr('color', 'var(--ink-mid)')
      .call(d3.axisBottom(x).ticks(6));

    const rateG = g.append('g').attr('class', 's06-rate-strip');
    if (data.scene && Array.isArray(data.scene.rate_curve) && data.scene.rate_curve.length) {
      const spec = data.manifest.zoom.mexeng;
      const t0 = new Date(spec.window[0]).getTime();
      const line = d3.line()
        .x((d) => x(t0 + d.t_s * 1000))
        .y((d) => rate(d.rate_per_s));
      rateG.append('path')
        .datum(data.scene.rate_curve)
        .attr('fill', 'none')
        .attr('stroke', 'var(--neutral-data)')
        .attr('stroke-width', 1.5)
        .attr('d', line);
      rateG.append('g')
        .attr('transform', `translate(${view.region.x - 8},0)`)
        .attr('font-family', 'var(--font-apparatus)')
        .attr('font-size', 'var(--type-micro-size)')
        .call(d3.axisLeft(rate).ticks(3))
        .append('text')
        .attr('fill', 'var(--ink-mid)')
        .attr('x', 0).attr('y', -8)
        .text('trades/s');
    }

    let kickoffX = null;
    if (data.scene && data.scene.window && data.scene.window.kickoff_ts) {
      kickoffX = x(new Date(data.scene.window.kickoff_ts).getTime());
    }

    const kickoffG = g.append('g').attr('class', 's06-kickoff').style('display', 'none');
    if (kickoffX !== null) {
      kickoffG.append('line')
        .attr('x1', kickoffX).attr('x2', kickoffX)
        .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
        .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '2,3');
      const label = data.scene.kickoff_step_multiplier
        ? `kickoff · ×${data.scene.kickoff_step_multiplier} step`
        : 'kickoff';
      drawSingleton(kickoffG, kickoffX, view.region.y - 4, view.tokens, label);
    }

    const sparkG = g.append('g').attr('class', 's06-sparkline').style('display', 'none');
    let sparkCaption = null;
    if (data.scene && Array.isArray(data.scene.size_sparkline) && data.scene.size_sparkline.length) {
      const spec = data.manifest.zoom.mexeng;
      const t0 = new Date(spec.window[0]).getTime();
      const vals = data.scene.size_sparkline.map((d) => d.avg_notional_usd);
      const sy = d3.scaleLinear().domain([Math.min(...vals), Math.max(...vals)])
        .range([view.region.y + view.region.h + 40, view.region.y + view.region.h + 16]);
      const line = d3.line().x((d) => x(t0 + d.t_s * 1000)).y((d) => sy(d.avg_notional_usd));
      sparkG.append('path')
        .datum(data.scene.size_sparkline)
        .attr('fill', 'none')
        .attr('stroke', 'var(--neutral-data)')
        .attr('stroke-width', 1.5)
        .attr('d', line);
      const pct = data.scene.size_growth_pct;
      if (pct !== undefined) {
        sparkCaption = pinnedCaption(container, `per-trade size, in-play: +${pct}%`, 's06-spark-caption')
          .style('left', `${view.region.x}px`)
          .style('top', `${view.region.y + view.region.h + 46}px`);
      }
    }

    const captionEl = pinnedCaption(
      container,
      'Mexico-to-advance money · what the tape can and cannot say about who traded',
      's06-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y - 40}px`);

    // Mobile: fine stream texture is illegible at phone size -- the rate
    // axis becomes a haptic-adjacent visual metronome (a single pulsing dot)
    // instead of the line strip (design-system.md S6 note).
    let metronome = null;
    if (view.mobile) {
      rateG.style('display', 'none');
      metronome = container.html.append('div')
        .attr('class', 's06-metronome')
        .style('position', 'absolute')
        .style('width', '10px').style('height', '10px')
        .style('border-radius', '50%')
        .style('background', 'var(--accent-annotation)')
        .style('left', `${view.region.x}px`)
        .style('top', `${view.region.y - 20}px`)
        .style('opacity', 0.4);
    }

    function step(beatId) {
      if (beatId === 'b1') {
        kickoffG.style('display', null);
        sparkG.style('display', null);
      }
    }

    function scrub(t) {
      if (kickoffX === null) return;
      const cx = view.region.x + t * view.region.w;
      const active = Math.abs(cx - kickoffX) < view.region.w * 0.02;
      kickoffG.select('line').attr('stroke-opacity', active ? 1 : 0.5);
      if (metronome && data.scene && data.scene.rate_curve && data.scene.rate_curve.length) {
        const curve = data.scene.rate_curve;
        const spec = data.manifest.zoom.mexeng;
        const winMs = new Date(spec.window[1]).getTime() - new Date(spec.window[0]).getTime();
        const tS = t * (winMs / 1000);
        let nearest = curve[0];
        for (const d of curve) if (Math.abs(d.t_s - tS) < Math.abs(nearest.t_s - tS)) nearest = d;
        const alpha = Math.min(1, 0.25 + nearest.rate_per_s / 6);
        metronome.style('opacity', alpha);
      }
    }

    return {
      step,
      scrub,
      exit() {
        g.selectAll('*').remove();
        captionEl.remove();
        if (sparkCaption) sparkCaption.remove();
        if (metronome) metronome.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>The single biggest market of the tournament was not the winner book.
        It was Mexico to advance past England, 158.7 million contracts across
        roughly a million trades, host-nation money concentrated on one
        elimination night.<sup><a href="#fn-9">9</a></sup> Retail flow is the
        order stream of ordinary individual traders rather than institutions,
        the small bettors who make up almost all of this exchange. Zoomed to
        individual trades, it looks like ordinary Kalshi retail flow at
        extraordinary scale: typical trade sizes, the exchange-wide taker-yes
        skew, a heavier pre-match profile than the median knockout
        market.<sup><a href="#fn-9">9</a></sup> The tape records that money
        moved; it cannot say whether the mover was hedging heartbreak or
        chasing it. The arrival rate tells its own story: the pre-kick hour
        already runs about one print, meaning one executed trade, per second,
        and the opening whistle steps it up about 5.4-fold.<sup><a
        href="#fn-10">10</a></sup></p>`,
      // Non-uniform scroll-to-time mapping lives in layout().keyframes;
      // span is a pacing choice for this gateway zoom scene (not itself a
      // dated figure), matching S1/S8's scrub-track convention.
      trigger: { type: 'scrub', span: 4.5 },
      state: 'k0',
      kind: 'resort',
      chip: 'color: taker side · cyan bought yes, vermillion bought no',
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
