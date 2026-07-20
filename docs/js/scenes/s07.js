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
 *       "suspend_start_s": 11.6, "suspend_end_s": 109.1
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
  kicker: 'Skill 3 of 5: reading a live match',
  layoutName: 'goal-clock-lanes',

  needs: { scene: true, series: [], zoom: 'norbra' },

  zoom: {
    key: 'norbra',
    tagBit: 'ZOOM_NORBRA',
    grainText: '1 dot = 1 trade · showing every {n}th of {count} trades · Norway-Brazil, July 5',
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
    const axisG = g.append('g')
      .attr('transform', `translate(0,${view.region.y + view.region.h + 8})`)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisBottom(x).ticks(8).tickFormat((d) => `${d >= 0 ? '+' : ''}${d}s`));
    axisG.append('text')
      .attr('x', view.region.x + view.region.w / 2)
      .attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)')
      .text('seconds after the goal');

    // Left-gutter lane labels (CR-7), top-anchored per lane (NOT vertically
    // centered -- centering put this text at the exact same y as the
    // Pinnacle darkness block's "no longer quoting" label, which sits
    // mid-lane, garbling both; perception-brief P4), mono apparatus,
    // ink-low/ink-mid only -- venue hue is licensed for the marks
    // themselves, not decorative for the labels (S7 note: every label here
    // is ink-mid or ink-low, zero decorative amber).
    const laneLabel = (text, top) => g.append('text')
      .attr('x', view.region.x).attr('y', top + 14)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .attr('fill', 'var(--ink-low)')
      .text(text);
    laneLabel('KALSHI · every trade', laneTop.K);
    laneLabel('PINNACLE · dealer quotes', laneTop.P);
    laneLabel('POLYMARKET · one block = one minute', laneTop.M);

    g.append('line').attr('x1', x(0)).attr('x2', x(0))
      .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
      .attr('stroke', 'var(--ink-mid)').attr('stroke-width', 1).attr('stroke-dasharray', '1,3');

    const goalLabel = (data.scene && data.scene.event && data.scene.event.label) || 'the goal';
    const goalMark = g.append('g').style('display', 'none');
    // b1's amber unit: halo + ink-hero core. At b2 the halo recolors to
    // ink-mid (the core stays as the at-mark anchor) so amber stays a true
    // singleton once the darkness block claims the beat's amber unit.
    // Nudged 42px below laneTop.K (not flush with it) so the halo and its
    // label clear both the Zone K race caption above the stage AND the
    // "KALSHI · every trade" lane label, which sits at laneTop.K+14
    // (perception-brief P4: all three were overlapping at the stage's top
    // edge).
    const goalMarkSel = drawSingleton(goalMark, x(0), laneTop.K + 42, tokens, goalLabel);

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
        // "no longer quoting" renders INSIDE the darkness block, centered,
        // ink-mid -- not a floating pinned caption (design-revision-spec
        // S7 b2: the label must sit where the reader's eye already is).
        pinG.append('text')
          .attr('x', (x(s0) + x(s1)) / 2).attr('y', laneTop.P + laneH / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-family', 'var(--font-apparatus)')
          .attr('font-size', 'var(--type-annotation-size)')
          .attr('fill', 'var(--ink-mid)')
          .text('no longer quoting');
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

    // Zone K, one slot: race caption (b1, current) recedes to ink-low at
    // b2 (CR-9-style decay) and stays pinned per R23 -- it is never
    // removed, only demoted, so the prohibition is never off screen once
    // taught. The fade caption (b4) is the slot's second and final
    // arrival, stacked below it (spacing floor >= --space-24) so both
    // remain legible at once (CR-4: at most two visible per frame).
    const raceCaption = pinnedCaption(
      container,
      'Three lanes, three native speeds. This is not a race.',
      's07-race-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y - 40}px`)
      .style('display', 'none');

    const mechanismCaption = pinnedCaption(
      container,
      'Kalshi keeps trading. The sportsbook stops, then reposts.',
      's07-mechanism-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y + view.region.h + 44}px`)
      .style('display', 'none');

    // Friction band: +-2c around the post-jump level, held to the 30-min
    // horizon, drawn from the Kalshi tile itself (the first tick shortly
    // after the goal), never fabricated. Stroke-only (no amber fill wash
    // across three lanes, perception-brief-driven fix).
    const bandG = g.append('g').attr('class', 's07-friction').style('display', 'none');
    const fadeCaption = pinnedCaption(container, 'The spike is the price. Nothing to fade.', 's07-fade-caption')
      .style('left', `${view.region.x}px`).style('top', `${view.region.y - 14}px`)
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
        raceCaption.style('color', 'var(--ink-hi)').style('display', null);
      }
      if (beatId === 'b2') {
        pinG.style('display', null);
        // Amber stays a singleton: the goal mark's halo recolors to
        // ink-mid the moment the darkness block claims the beat's amber
        // unit; the core stays as the at-mark anchor.
        goalMarkSel.select('circle').attr('stroke', 'var(--ink-mid)');
        // Race caption recedes (stays pinned per R23, just quieter).
        raceCaption.style('color', 'var(--ink-mid)');
      }
      if (beatId === 'b3') {
        polyG.style('display', null);
        mechanismCaption.style('color', 'var(--ink-mid)').style('display', null);
      }
      if (beatId === 'b4') {
        const level = postJumpLevel();
        const band = (data.scene && data.scene.friction_band_c) || 2;
        if (level !== null) {
          bandG.selectAll('*').remove();
          const bx0 = x(0); const bx1 = x(1800);
          bandG.append('rect')
            .attr('x', bx0).attr('width', bx1 - bx0)
            .attr('y', yK(Math.min(100, level + band)))
            .attr('height', Math.max(1, yK(Math.max(0, level - band)) - yK(Math.min(100, level + band))))
            .attr('fill', 'none')
            .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', 1);
          bandG.append('text')
            .attr('x', bx1 - 6).attr('y', yK(level) - 6)
            .attr('text-anchor', 'end')
            .attr('font-family', 'var(--font-apparatus)')
            .attr('font-size', 'var(--type-annotation-size)')
            .attr('fill', 'var(--accent-annotation)')
            .text('plus or minus 2 cents: friction');
        }
        bandG.style('display', null);
        mechanismCaption.style('color', 'var(--ink-low)');
        fadeCaption.style('display', null);
      }
    }

    return {
      step,
      exit() {
        g.selectAll('*').remove();
        raceCaption.remove();
        mechanismCaption.remove();
        fadeCaption.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>A goal reaches three price sources at once, and each behaves
        differently. That difference comes from policy, not from who is
        smarter. Here is a goal you will meet again: Haaland's second against
        Brazil. Haaland plays for Norway, so this is the Norway-Brazil match,
        seen through its prices.</p>
        <p>Three venues watched it. Kalshi is the American exchange whose
        trades fill this whole page. Polymarket is an offshore market where a
        crowd trades. Pinnacle is a sportsbook, the house the professionals
        bet through.</p>
        <p>Kalshi's book trades straight through the goal, tick by tick, with
        no pause. Watch the grey lane next. It goes dark.</p>`,
      trigger: 'step',
      state: 'assembled',
      kind: 'resort',
      chip: [
        { token: 'venue-kalshi', glyph: 'dot', label: 'one Kalshi trade' },
        { token: 'venue-pinnacle', glyph: 'dash', label: 'one Pinnacle quote' },
        { token: 'venue-polymarket', glyph: 'block', label: 'one Polymarket minute' },
      ],
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>A sportsbook suspends trading the instant a play turns
        dangerous. It pulls its price off the board, waits, then posts one
        new number once it decides what the goal is worth.</p>
        <p>Pinnacle does exactly that here. It stops quoting about
        twelve seconds after the move begins, stays dark for roughly
        ninety-eight seconds, then reopens with one new quote already at
        its new price.<sup><a href="#fn-11">11</a></sup></p>
        <p>That one grey dash is the whole story. Pinnacle did not trade the
        move. It waited it out, then restated its price once, already caught
        up.</p>`,
      trigger: 'step',
      kind: 'recolor',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>Polymarket only saves one price per minute. A block on its
        lane covers a whole sixty seconds, so nothing inside that minute can
        be pinned down.</p>
        <p>A famous ranking says Kalshi reacted in 29 seconds, Polymarket in
        60, and Pinnacle in 119. That is not a speed contest. It is three
        different measuring sticks: one that saves data once a minute, one
        that suspends and reposts. Ranking their speeds only ranks how each
        venue happens to record itself.<sup><a href="#fn-11">11</a></sup></p>
        <p>Kalshi kept trading. The sportsbook stopped, then
        reposted.</p>`,
      trigger: 'step',
      kind: 'recolor',
      overlayStep: 'b3',
    },
    {
      id: 'b4',
      html: `<p>Here is what matters on a night like tonight. After a goal,
        the new price held. It was not a panic that snapped back. It was the
        market's honest answer.</p>
        <p>To fade a move means betting it will snap back. Take every clean
        goal of this tournament, every goal that arrived with no other news
        in the same minute. After each one, the price stayed within a couple
        of cents of where the jump landed. Wiggle that small is useless:
        trading it would cost more in fees than it could ever earn. There
        was nothing to fade.<sup><a
        href="#fn-20">20</a></sup></p>
        <p>The spike is the price. Remember that the next time a goal moves a
        number in front of you.</p>`,
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
