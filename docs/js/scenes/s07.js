/* docs/js/scenes/s07.js
 * S7 · Act II · "The goal, three ways" (zoom)
 * storyboard.md §3 S7 · CONTRACT.md §4.2 row s07 (goal-clock-lanes, 4 steps, zoom=norbra)
 *
 * Vehicle, committed (no "or another" slot): Norway-Brazil, Haaland's
 * second, from the finalized tape (R3 + R20). STANDING PROHIBITION R23: no
 * cross-venue speed ranking anywhere in this scene; lead/lag language is
 * bounded to +-60s by construction and is therefore never printed. Every
 * lane draws at its OWN native grain and glyph so the eye cannot run the
 * race the prose refuses to state (Gate 2 critique C3, resolved):
 *   Kalshi     -> tick dots (population dots, ZOOM_NORBRA tag; filled)
 *   Pinnacle   -> requote dashes + a literal darkness block (outline/stroke)
 *   Polymarket -> 60s-wide native-minute blocks (outline rect, never a point)
 * Identical glyphs across lanes are BANNED (design-system.md, C3).
 *
 * DATA_REQUEST: docs/data/scenes/s07.json, built from
 * pipeline/data/analysis/ingame-microstructure/reaction_latency.parquet +
 * events_matched.parquet (R3) plus the Pinnacle/Polymarket benchmark pulls
 * (neither venue has a Kalshi-shaped tile in the manifest; their marks are
 * D3 overlay marks, never population dots, per CONTRACT §1.3 "dots mean
 * money and only money"):
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "event": { "goal_ts": ISO, "label": "Haaland's second, Norway-Brazil" },
 *     "friction_band_c": 2,
 *     "pinnacle": {
 *       "quotes": [ { "t_s": <seconds since goal_ts>, "price_c": 0-100 }, ... ],
 *       "suspend_start_s": 32, "suspend_end_s": 112
 *     },
 *     "polymarket": {
 *       "blocks": [ { "t_s_start": <s>, "t_s_end": <s>, "price_c": 0-100 }, ... ]
 *     }
 *   }
 * Until this lands, the Pinnacle/Polymarket lanes render their axis and
 * lane label only -- never a fabricated dash or block.
 */

import {
  registry, colorOf, particleState, indicesWithFlag, makeState, setColor,
} from '../shared.js';

function hash01(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
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

// Shared clock viewport: a layout/pacing choice (like an axis range), not a
// data value -- covers the suspension window and the 30-minute friction
// check with margin either side.
const CLOCK_DOMAIN_S = [-120, 1900];

export default {
  id: 's07',
  act: 2,
  title: 'The goal, three ways',
  layoutName: 'goal-clock-lanes',

  needs: { scene: true, series: [], zoom: 'norbra' },

  zoom: {
    key: 'norbra',
    tagBit: 'ZOOM_NORBRA',
    grainText: '1 dot = 1 trade · showing every {n}th of {count} trades',
  },

  scales(data, view) {
    const x = d3.scaleLinear().domain(CLOCK_DOMAIN_S)
      .range([view.region.x, view.region.x + view.region.w]);
    const laneH = view.region.h / 3;
    const pad = laneH * 0.12;
    const yK = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + laneH - pad, view.region.y + pad]);
    const yP = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + 2 * laneH - pad, view.region.y + laneH + pad]);
    const yM = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + 3 * laneH - pad, view.region.y + 2 * laneH + pad]);
    registry.register('s07.x', x);
    registry.register('s07.yK', yK);
    registry.register('s07.yP', yP);
    registry.register('s07.yM', yM);
    return {
      x, yK, yP, yM, laneH,
      laneTop: { K: view.region.y, P: view.region.y + laneH, M: view.region.y + 2 * laneH },
    };
  },

  layout(data, view) {
    const { pop } = data;
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

    const x = registry.get('s07.x');
    const yK = registry.get('s07.yK');
    const kalshiRgba = colorOf(view.tokens, 'venue-kalshi');

    const bit = data.flagBit('ZOOM_NORBRA');
    const tagged = indicesWithFlag(pop.flags, bit);
    const D = tagged.length;
    const tile = data.zoom.norbra;
    const T = tile ? tile.count : 0;
    const runtimeStride = (T && D) ? Math.max(1, Math.ceil(T / D)) : 1;

    const goalTs = (data.scene && data.scene.event && data.scene.event.goal_ts)
      ? new Date(data.scene.event.goal_ts).getTime()
      : (tile ? tile.t0 : 0);

    if (tile && D) {
      for (let i = 0; i < D; i++) {
        const row = Math.min(i * runtimeStride, T - 1);
        const di = tagged[i];
        const ts = tile.t0 + tile.ts_ms[row];
        const tS = (ts - goalTs) / 1000;
        state.x[di] = x(Math.max(CLOCK_DOMAIN_S[0], Math.min(CLOCK_DOMAIN_S[1], tS)));
        state.y[di] = yK(tile.price_c[row]);
        setColor(state.color, di, kalshiRgba); // color: venue (this scene's exception; see design-system §9 S7)
        state.size[di] = baseSize; // all lanes assemble together on step 1; no reveal-by-size here
      }
    }

    return { states: { assembled: state } };
  },

  overlay(container, data, view, scales) {
    const { x, yK, yP, yM, laneTop, laneH } = scales;
    const tokens = view.tokens;
    const g = container.svg;

    // Shared clock axis (the anti-race guarantee lives in the glyphs and
    // the pinned caption below, NOT in de-aligning the lanes -- the
    // suspend-and-repost story needs one time base).
    g.append('g')
      .attr('transform', `translate(0,${view.region.y + view.region.h + 8})`)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisBottom(x).ticks(8).tickFormat((d) => `${d >= 0 ? '+' : ''}${d}s`));

    const laneLabel = (text, top) => g.append('text')
      .attr('x', view.region.x).attr('y', top + 14)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .attr('fill', 'var(--ink-low)')
      .text(text);
    laneLabel('KALSHI · cyan tick dots', laneTop.K);
    laneLabel('PINNACLE · grey requote dashes', laneTop.P);
    laneLabel('POLYMARKET · lavender 60s blocks', laneTop.M);

    g.append('line').attr('x1', x(0)).attr('x2', x(0))
      .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
      .attr('stroke', 'var(--ink-mid)').attr('stroke-width', 1).attr('stroke-dasharray', '1,3');

    const goalLabel = (data.scene && data.scene.event && data.scene.event.label) || 'the goal';
    const goalMark = g.append('g').style('display', 'none');
    drawSingleton(goalMark, x(0), laneTop.K, tokens, goalLabel);

    // Pinnacle: requote dashes (a visibly different glyph from Kalshi's
    // circles) + the darkness block.
    const pinG = g.append('g').attr('class', 's07-pinnacle').style('display', 'none');
    const pinRgba = colorOf(tokens, 'venue-pinnacle');
    let darknessRect = null;
    if (data.scene && data.scene.pinnacle) {
      const { quotes, suspend_start_s: s0, suspend_end_s: s1 } = data.scene.pinnacle;
      (quotes || []).forEach((q) => {
        pinG.append('line')
          .attr('x1', x(q.t_s) - 6).attr('x2', x(q.t_s) + 6)
          .attr('y1', yP(q.price_c)).attr('y2', yP(q.price_c))
          .attr('stroke', 'var(--venue-pinnacle)').attr('stroke-width', 2);
      });
      if (s0 !== undefined && s1 !== undefined) {
        darknessRect = pinG.append('rect')
          .attr('x', x(s0)).attr('width', Math.max(0, x(s1) - x(s0)))
          .attr('y', laneTop.P).attr('height', laneH)
          .attr('fill', 'var(--venue-pinnacle-terminated)').attr('fill-opacity', 0.35)
          .attr('stroke', 'var(--venue-pinnacle-terminated)').attr('stroke-width', 1);
      }
    }

    // Polymarket: 60s-native blocks, outline-only (non-money mark; the
    // outline-vs-filled contrast IS the "dots are money" unit grammar).
    const polyG = g.append('g').attr('class', 's07-polymarket').style('display', 'none');
    if (data.scene && data.scene.polymarket && Array.isArray(data.scene.polymarket.blocks)) {
      data.scene.polymarket.blocks.forEach((b) => {
        const bx0 = x(b.t_s_start); const bx1 = x(b.t_s_end);
        polyG.append('rect')
          .attr('x', Math.min(bx0, bx1)).attr('width', Math.max(1, Math.abs(bx1 - bx0)))
          .attr('y', yM(b.price_c) - 5).attr('height', 10)
          .attr('fill', 'none')
          .attr('stroke', 'var(--venue-polymarket)').attr('stroke-width', 1.5);
      });
    }

    const raceCaption = pinnedCaption(
      container,
      'these three lanes update at different native speeds; position on this shared clock is not a race',
      's07-race-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y - 40}px`)
      .style('display', 'none');

    const darknessCaption = pinnedCaption(container, 'no longer quoting', 's07-darkness-caption')
      .style('display', 'none');

    const mechanismCaption = pinnedCaption(
      container,
      'continuous tradability versus suspend-and-repost',
      's07-mechanism-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y + view.region.h + 44}px`)
      .style('display', 'none');

    // Friction band: +-2c around the post-jump level, held to the 30-min
    // horizon, drawn from the Kalshi tile itself (the first tick shortly
    // after the goal), never fabricated.
    const bandG = g.append('g').attr('class', 's07-friction').style('display', 'none');
    const fadeCaption = pinnedCaption(container, 'the spike is the price: nothing to fade', 's07-fade-caption')
      .style('display', 'none');

    function postJumpLevel() {
      const tile = data.zoom.norbra;
      if (!tile) return null;
      const goalTs = (data.scene && data.scene.event && data.scene.event.goal_ts)
        ? new Date(data.scene.event.goal_ts).getTime() : tile.t0;
      for (let r = 0; r < tile.count; r++) {
        const tS = (tile.t0 + tile.ts_ms[r] - goalTs) / 1000;
        if (tS >= 5) return tile.price_c[r];
      }
      return null;
    }

    function step(beatId) {
      if (beatId === 'b1') {
        goalMark.style('display', null);
        raceCaption.style('display', null);
      }
      if (beatId === 'b2') {
        pinG.style('display', null);
        if (darknessRect) darknessCaption
          .style('left', `${x(data.scene.pinnacle.suspend_start_s)}px`)
          .style('top', `${laneTop.P - 30}px`)
          .style('display', null);
      }
      if (beatId === 'b3') {
        polyG.style('display', null);
        mechanismCaption.style('display', null);
      }
      if (beatId === 'b4') {
        const level = postJumpLevel();
        const band = (data.scene && data.scene.friction_band_c) || 2;
        if (level !== null) {
          bandG.selectAll('*').remove();
          bandG.append('rect')
            .attr('x', x(0)).attr('width', x(1800) - x(0))
            .attr('y', yK(Math.min(100, level + band)))
            .attr('height', Math.max(1, yK(Math.max(0, level - band)) - yK(Math.min(100, level + band))))
            .attr('fill', 'var(--accent-annotation)').attr('fill-opacity', 0.12)
            .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', 1);
        }
        bandG.style('display', null);
        fadeCaption.style('left', `${view.region.x}px`).style('top', `${view.region.y - 40}px`)
          .style('display', null);
      }
    }

    return {
      step,
      exit() {
        g.selectAll('*').remove();
        raceCaption.remove();
        darknessCaption.remove();
        mechanismCaption.remove();
        fadeCaption.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>A goal reaches three venues as three different mechanisms, and
        the differences are policy rather than intelligence. Three price
        sources watch the same goal: Kalshi, the United States prediction
        exchange whose tape this is; Polymarket, an offshore crowd market;
        and Pinnacle, a professional sportsbook, the house the pros call the
        book. The vehicle is the goal the reader will meet again: Haaland's
        second against Brazil, from the finalized tape. Kalshi's book trades
        continuously through the goal minute.</p>`,
      trigger: 'step',
      state: 'assembled',
      kind: 'resort',
      chip: 'color: venue · Kalshi cyan, Polymarket lavender, Pinnacle grey',
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>A sportsbook suspends by pulling its price the instant play
        turns dangerous, then reposts once, at the level it now believes is
        fair, rather than trading every step of the move the way an exchange
        does. Pinnacle does exactly that here: it suspends about thirty-two
        seconds after the move begins, goes dark for roughly eighty, and
        reopens with a single quote already at the new fair
        level.<sup><a href="#fn-11">11</a></sup></p>`,
      trigger: 'step',
      kind: 'recolor',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>Polymarket's stored history cannot resolve anything under
        sixty seconds. The often-repeated reaction ladder, 29 seconds versus
        60 versus 119, is three measurement artifacts wearing a
        ranking.<sup><a href="#fn-11">11</a></sup></p>`,
      trigger: 'step',
      kind: 'recolor',
      overlayStep: 'b3',
    },
    {
      id: 'b4',
      html: `<p>To fade a move is to bet it will snap back. The friction band
        is the couple of cents of fees and minimum price step inside which no
        such bet can clear a profit, so a spike that settles inside it was
        already the right price. Across clean goal reactions the post-jump
        level held within the roughly two-cent friction band at a
        thirty-minute horizon, so the spike was the price itself and there
        was no overreaction to fade.<sup><a href="#fn-20">20</a></sup></p>`,
      trigger: 'step',
      kind: 'recolor',
      overlayStep: 'b4',
    },
  ],

  reducedMotion: {
    // Step-triggered scene: end states are already static-readable; no
    // positional substitution needed (only b1 moves dots at all, and it is
    // a single resort with no in-between motion to suppress beyond the
    // engine's own §3.5 instant-apply + crossfade).
  },
};
