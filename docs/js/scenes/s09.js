/* docs/js/scenes/s09.js
 * S9 · Act II · "Three shocks, three arithmetics"
 * storyboard.md §3 S9 · CONTRACT.md §4.2 row s09 (shock-align, 3 steps, no zoom)
 *
 * Grain shift back OUT, narrated: the match-world tick dots (S8's GERPAR
 * window) repack into population grain ("back to $75,000 a dot"). This
 * scene needs no zoom tile: it re-sorts the PERSISTENT population's actual
 * winner-futures dots for Paraguay, Norway, and Belgium along one
 * event-time axis (population columns `team`/`family`/`birth_ts`/
 * `price_band`, CONTRACT §5.2 -- no markets.json lookup required). At the
 * mirror step, Argentina's winner-futures dots re-enter, aligned to
 * Norway's own shock instant so the coincidence reads as literal common
 * fate (R9).
 *
 * DATA_REQUEST: docs/data/scenes/s09.json, built from
 * pipeline/data/analysis/bias-forensics/post_upset_drift.parquet +
 * post_upset_drift_series.parquet (R9). The population tile carries no
 * event timestamps (a goal/elimination is not itself a trade), so the
 * shock anchors and the bracket-news annotation instants must ship here:
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "shocks": [
 *       { "team": "PAR", "shock_ts": ISO, "pop_multiple": 5.0 },
 *       { "team": "NOR", "shock_ts": ISO, "pop_multiple": 3.6 },
 *       { "team": "BEL", "shock_ts": ISO, "pop_multiple": 2.0 }
 *     ],
 *     "annotations": [
 *       { "team": "PAR", "t_hours": <float>, "label": "France confirmed next" },
 *       { "team": "BEL", "t_hours": <float>, "label": "Spain quarterfinal known" }
 *     ],
 *     "mirror": { "norway_hours": 43, "norway_price_c": 10.8, "argentina_team": "ARG" }
 *   }
 * Team codes assume manifest.teams uses FIFA 3-letter codes (PAR/NOR/BEL/ARG);
 * flag to the tile builder if a different code scheme is used.
 */

import { registry, colorOf, particleState, makeState, setColor } from '../shared.js';

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
// Chart-first fix (design-review S9: "linear cents axis crushes the story
// into the bottom 3%"): each team's own pre-shock price becomes the axis's
// x1 reference, computed from the population's own trade history (median
// price_band among that team's dots born before the anchor instant) --
// data-derived, never a fabricated constant.
function computeBaseline(idxs, pop, epochMs, anchorTs) {
  const prices = [];
  for (const i of idxs) {
    if (pop.price_band[i] === 255) continue;
    const hrs = (epochMs + pop.birth_ts[i] * 1000 - anchorTs) / 3600000;
    if (hrs < 0) prices.push(pop.price_band[i]);
  }
  if (!prices.length) return null;
  prices.sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  // BUG FIX: `median || null` previously discarded a genuine median of 0
  // (JS falsy-zero) and silently dropped Paraguay's whole line -- its
  // pre-shock price floors to 0 whole cents, a real value, not a missing
  // one. A whole-cent price of 0 is itself a flooring artifact (Kalshi's
  // minimum tradable tick is 1 cent), so the divisor floors at 1 -- "times
  // its pre-shock price" stays defined instead of dividing by zero.
  return Math.max(1, median);
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
    .style('display', 'none')
    .text(text);
}

const TEAMS = [
  { code: 'PAR', color: 'identity-teal', label: 'Paraguay' },
  { code: 'NOR', color: 'identity-blue', label: 'Norway' },
  { code: 'BEL', color: 'identity-pink', label: 'Belgium' },
];
const ARG = { code: 'ARG', color: 'identity-lavender', label: 'Argentina' };

export default {
  id: 's09',
  act: 2,
  title: 'Three upsets, one rule',
  kicker: 'Skill 3, continued: prices watch the road ahead',
  layoutName: 'shock-align',

  needs: { scene: true, series: [], zoom: null },

  scales(data, view) {
    const xPop = d3.scaleLinear().domain([-0.5, 4])
      .range([view.region.x, view.region.x + view.region.w]);
    const xFull = d3.scaleLinear().domain([-2, 74])
      .range([view.region.x, view.region.x + view.region.w]);
    // Chart-first fix: these tickets trade in low cents both before and
    // after their shock, so a raw 0-100c axis wastes nearly the whole
    // chart height (design-review S9: "crushes the story into the bottom
    // 3%"). The axis is multiples of each team's own pre-shock price
    // instead -- a 5x jump now uses most of the chart.
    const y = d3.scaleLinear().domain([0, 6]).clamp(true)
      .range([view.region.y + view.region.h, view.region.y]);
    registry.register('s09.xPop', xPop);
    registry.register('s09.xFull', xFull);
    registry.register('s09.y', y);
    return { xPop, xFull, y };
  },

  layout(data, view) {
    const { pop, manifest } = data;
    const N = pop.count;
    const base = makeState(N);
    const restRgba = particleState(view.tokens, 'dimmed-field-min');
    const baseSize = view.tokens.dot['radius-base-px'];
    for (let i = 0; i < N; i++) {
      const [rx, ry] = restFieldXY(i, view);
      base.x[i] = rx; base.y[i] = ry;
      setColor(base.color, i, restRgba);
      base.size[i] = baseSize;
    }

    const xPop = registry.get('s09.xPop');
    const xFull = registry.get('s09.xFull');
    const y = registry.get('s09.y');
    const epochMs = new Date(manifest.epoch).getTime();
    const famIdx = manifest.enums.family.indexOf('winner_futures');

    const dotsByTeam = {};
    for (const cfg of TEAMS.concat([ARG])) dotsByTeam[cfg.code] = [];
    for (let i = 0; i < N; i++) {
      if (pop.family[i] !== famIdx) continue;
      const code = manifest.teams[pop.team[i]];
      if (dotsByTeam[code]) dotsByTeam[code].push(i);
    }

    const shocks = (data.scene && data.scene.shocks) || [];
    const shockTsFor = (code) => {
      const s = shocks.find((s2) => s2.team === code);
      return s ? new Date(s.shock_ts).getTime() : null;
    };
    const norwayShockTs = shockTsFor('NOR');

    const baselineFor = {};
    for (const cfg of TEAMS) {
      const shockTs = shockTsFor(cfg.code);
      baselineFor[cfg.code] = shockTs !== null
        ? computeBaseline(dotsByTeam[cfg.code], pop, epochMs, shockTs) : null;
    }
    baselineFor.ARG = norwayShockTs !== null
      ? computeBaseline(dotsByTeam.ARG, pop, epochMs, norwayShockTs) : null;

    function dotHoursSince(i, anchorTs) {
      return (epochMs + pop.birth_ts[i] * 1000 - anchorTs) / 3600000;
    }

    function cloneOf(s) {
      return { x: s.x.slice(), y: s.y.slice(), color: s.color.slice(), size: s.size.slice() };
    }

    const popState = cloneOf(base);
    const divState = cloneOf(base);
    const mirrorState = cloneOf(base);

    // design-review S9 critical #1/#2 fix: the population tile's price_band
    // is whole cents only. Paraguay and Norway are extreme longshots whose
    // real price sits in fractions of a cent near their shocks (a 0.2c ->
    // 1c move is a real 5x, but floors to "0 vs 1" here), and Norway's
    // winner_futures family has just two sampled dots in the entire
    // population tile. Coloring these real-but-under-resolved dots at full
    // team saturation made Paraguay's dots read as "collapsed to zero" --
    // the inverse of the headline fact -- and left Norway invisible. These
    // per-dot marks stay (real trades, real timing: "every dot is money
    // that actually moved"), but recolor to the same dim texture tone as
    // the ambient rest field so they read as supporting texture, not the
    // scene's price signal. The signal moves to the verified step-lines
    // built below in overlay(), from data.scene.shocks[].pop_multiple.
    const dimRgba = particleState(view.tokens, 'dimmed-field-max');
    for (const cfg of TEAMS) {
      const shockTs = shockTsFor(cfg.code);
      const baseline = baselineFor[cfg.code];
      if (shockTs === null || !baseline || pop.price_band === undefined) continue;
      for (const i of dotsByTeam[cfg.code]) {
        if (pop.price_band[i] === 255) continue; // mixed-price bucket: no single y position
        const hrs = dotHoursSince(i, shockTs);
        const mult = pop.price_band[i] / baseline;
        // Chart-first fix: a team's own winner-futures dots span its whole
        // market life (months), not just the hours around this one shock.
        // Clamping far-away dots into the domain's edges piled unrelated
        // trading (different price regime, same fixed baseline) into
        // spurious horizontal bands that buried the actual jump
        // (design-review: b2/b3 read as near-empty). Dots outside each
        // panel's own window are left out of that state entirely -- they
        // stay part of the ambient resting field instead.
        if (hrs >= -0.5 && hrs <= 4) {
          popState.x[i] = xPop(hrs);
          popState.y[i] = y(mult);
          setColor(popState.color, i, dimRgba);
          popState.size[i] = baseSize;
        }
        if (hrs >= -2 && hrs <= 74) {
          divState.x[i] = xFull(hrs);
          divState.y[i] = y(mult);
          setColor(divState.color, i, dimRgba);
          divState.size[i] = baseSize;

          mirrorState.x[i] = divState.x[i];
          mirrorState.y[i] = divState.y[i];
          setColor(mirrorState.color, i, dimRgba);
          mirrorState.size[i] = baseSize;
        }
      }
    }

    // Argentina: background in 'pop'/'divergence'; enters aligned to
    // Norway's own shock instant only at the mirror step. Same texture
    // treatment: the mirror's two figures (Norway rising, Argentina
    // falling) are carried by the labeled lines in overlay(), not by raw
    // scatter competing with them for the beat's luminance budget.
    if (norwayShockTs !== null && baselineFor.ARG) {
      const argBaseline = baselineFor.ARG;
      for (const i of dotsByTeam.ARG) {
        if (pop.price_band[i] === 255) continue;
        const hrs = dotHoursSince(i, norwayShockTs);
        if (hrs < -2 || hrs > 74) continue; // outside the panel's window: stays ambient
        mirrorState.x[i] = xFull(hrs);
        mirrorState.y[i] = y(pop.price_band[i] / argBaseline);
        setColor(mirrorState.color, i, dimRgba);
        mirrorState.size[i] = baseSize;
      }
    }

    return { states: { pop: popState, divergence: divState, mirror: mirrorState } };
  },

  overlay(container, data, view, scales) {
    const { xPop, xFull, y } = scales;
    const g = container.svg;

    // Chart-first fix (RESHAPE brief: "three labeled team lines"): a
    // scatter of tick-grain dots at this population's grain doesn't read
    // as a trajectory once the window widens past a few hours (b2/b3's
    // dots devolved into faint horizontal speckle). Each team's own price
    // path is drawn as a connected line straight from the population's own
    // winner-futures dots (sorted by trade time, restricted to the panel's
    // window) -- never a fabricated curve, only what actually traded.
    const { pop, manifest } = data;
    const epochMsL = new Date(manifest.epoch).getTime();
    const famIdxL = manifest.enums.family.indexOf('winner_futures');
    const dotsByTeamL = {};
    for (const cfg of TEAMS.concat([ARG])) dotsByTeamL[cfg.code] = [];
    for (let i = 0; i < pop.count; i++) {
      if (pop.family[i] !== famIdxL) continue;
      const code = manifest.teams[pop.team[i]];
      if (dotsByTeamL[code]) dotsByTeamL[code].push(i);
    }
    const shocksL = (data.scene && data.scene.shocks) || [];
    const shockTsForL = (code) => {
      const s = shocksL.find((s2) => s2.team === code);
      return s ? new Date(s.shock_ts).getTime() : null;
    };
    const norwayShockTsL = shockTsForL('NOR');
    const shocksMapL = {};
    shocksL.forEach((s) => { shocksMapL[s.team] = s; });

    // design-review S9 critical #1 fix: each team's price LINE is a
    // verified step -- flat at its own pre-shock level (x1) through t=0, a
    // vertical jump at the shock instant, flat at its true post-shock
    // multiple -- built only from data.scene.shocks[].pop_multiple, the
    // same sourced R9 class-B shock/beneficiary number the prose already
    // quotes (Paraguay 5x, Norway 3.6x, Belgium 2x). This replaces a
    // population-tile-derived line that could not carry the claim: whole
    // -cent price resolution floors Paraguay/Norway's real sub-cent moves
    // to "0 vs 1", and Norway's winner_futures family has only two sampled
    // dots tile-wide. Never a fabricated curve -- the two numbers plotted
    // (1x baseline, verified multiple) are both real, sourced values.
    function verifiedStepPoints(anchorTs, minHrs, maxHrs, multiple) {
      if (anchorTs === null || multiple == null) return [];
      return [
        { hrs: minHrs, mult: 1 },
        { hrs: 0, mult: 1 },
        { hrs: 0, mult: multiple },
        { hrs: maxHrs, mult: multiple },
      ];
    }

    // Binned-median series, not a raw connect-the-dots line: at this
    // population's grain, consecutive trades by timestamp are noisy (and
    // this family can carry more than one related instrument per team), so
    // a literal point-to-point line oscillated between price levels in a
    // way no reader could parse. Each time bucket takes the median of the
    // dots that actually traded inside it -- the standard way to turn a
    // tick series into a readable price path, still entirely data-derived.
    function teamSeries(code, anchorTs, minHrs, maxHrs, bucketCount) {
      if (anchorTs === null) return [];
      const idxs = dotsByTeamL[code] || [];
      const baseline = computeBaseline(idxs, pop, epochMsL, anchorTs);
      if (!baseline) return [];
      const span = maxHrs - minHrs;
      const buckets = Array.from({ length: bucketCount }, () => []);
      for (const i of idxs) {
        if (pop.price_band[i] === 255) continue;
        const hrs = (epochMsL + pop.birth_ts[i] * 1000 - anchorTs) / 3600000;
        if (hrs < minHrs || hrs > maxHrs) continue;
        const bi = Math.min(bucketCount - 1, Math.max(0, Math.floor(((hrs - minHrs) / span) * bucketCount)));
        buckets[bi].push(pop.price_band[i] / baseline);
      }
      const pts = [];
      buckets.forEach((vals, bi) => {
        if (!vals.length) return;
        vals.sort((a, b) => a - b);
        pts.push({
          hrs: minHrs + (bi + 0.5) * (span / bucketCount),
          mult: vals[Math.floor(vals.length / 2)],
        });
      });
      return pts;
    }

    // design-review S9 critical #3 fix: identity.blue vs field.rest is
    // ~1.15:1 contrast (perception-brief §9b) -- close to isoluminant, so a
    // plain hue-only stroke is exactly the kind of change the motion system
    // barely registers (brief §2). `halo` draws a wider near-white stroke
    // first so the line clears a real luminance floor over the locally
    // -summed rest field, not just a hue difference (brief §10.1).
    function makeLine(xs, pts, colorToken, opts) {
      opts = opts || {};
      const gen = d3.line().x((d) => xs(d.hrs)).y((d) => y(d.mult));
      const d = pts.length > 1 ? gen(pts) : null;
      const wrap = g.append('g').style('display', 'none');
      if (opts.halo) {
        wrap.append('path')
          .attr('fill', 'none').attr('stroke', 'var(--ink-hero)')
          .attr('stroke-width', (opts.strokeWidth || 1.5) + 3)
          .attr('stroke-opacity', 0.5).attr('stroke-linecap', 'round')
          .attr('d', d);
      }
      const path = wrap.append('path')
        .attr('fill', 'none')
        .attr('stroke', `var(--${colorToken})`)
        .attr('stroke-width', opts.strokeWidth || 1.5)
        .attr('stroke-opacity', 0.85)
        .attr('d', d);
      if (opts.label) {
        wrap.append('text')
          .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
          .attr('fill', `var(--${colorToken})`).attr('text-anchor', 'end')
          .attr('x', opts.labelX).attr('y', opts.labelY)
          .text(opts.label);
      }
      return {
        style(...a) { wrap.style(...a); return this; },
        attr(...a) { path.attr(...a); return this; },
      };
    }

    // Direct end-labels (design-review S9 critical #1 suggested fix): each
    // line states its own verified multiple where it lands, so the
    // three-way comparison this scene exists to make is legible without
    // requiring a reader to cross-reference the KEY against the y-axis.
    const popLinePAR = makeLine(xPop, verifiedStepPoints(shockTsForL('PAR'), -0.5, 4, shocksMapL.PAR && shocksMapL.PAR.pop_multiple), 'identity-teal', {
      label: shocksMapL.PAR ? `×${shocksMapL.PAR.pop_multiple}` : null,
      labelX: xPop(4) - 4, labelY: y(shocksMapL.PAR ? shocksMapL.PAR.pop_multiple : 1) - 8,
    });
    const popLineNOR = makeLine(xPop, verifiedStepPoints(shockTsForL('NOR'), -0.5, 4, shocksMapL.NOR && shocksMapL.NOR.pop_multiple), 'identity-blue', {
      halo: true, strokeWidth: 2,
      label: shocksMapL.NOR ? `×${shocksMapL.NOR.pop_multiple}` : null,
      labelX: xPop(4) - 4, labelY: y(shocksMapL.NOR ? shocksMapL.NOR.pop_multiple : 1) - 8,
    });
    const popLineBEL = makeLine(xPop, verifiedStepPoints(shockTsForL('BEL'), -0.5, 4, shocksMapL.BEL && shocksMapL.BEL.pop_multiple), 'identity-pink', {
      label: shocksMapL.BEL ? `×${shocksMapL.BEL.pop_multiple}` : null,
      labelX: xPop(4) - 4, labelY: y(shocksMapL.BEL ? shocksMapL.BEL.pop_multiple : 1) - 8,
    });
    const fullLinePAR = makeLine(xFull, verifiedStepPoints(shockTsForL('PAR'), -2, 74, shocksMapL.PAR && shocksMapL.PAR.pop_multiple), 'identity-teal');
    const fullLineNOR = makeLine(xFull, verifiedStepPoints(shockTsForL('NOR'), -2, 74, shocksMapL.NOR && shocksMapL.NOR.pop_multiple), 'identity-blue', { halo: true, strokeWidth: 2 });
    const fullLineBEL = makeLine(xFull, verifiedStepPoints(shockTsForL('BEL'), -2, 74, shocksMapL.BEL && shocksMapL.BEL.pop_multiple), 'identity-pink');
    const fullLineARG = makeLine(xFull, teamSeries('ARG', norwayShockTsL, -2, 74, 20), 'identity-lavender', { halo: true, strokeWidth: 2 });

    // No amber anywhere in this scene (design-revision-spec S9: all four
    // prior amber usages deleted). The shock line and the bracket-news
    // markers are structural apparatus, the same ink-mid/ink-low dashed
    // grammar S7's kickoff line already teaches -- not story points of
    // their own.
    const shockLine = g.append('g').style('display', 'none');
    const shockLineEl = shockLine.append('line')
      .attr('x1', xPop(0)).attr('x2', xPop(0))
      .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
      .attr('stroke', 'var(--ink-mid)').attr('stroke-width', 1)
      .attr('stroke-dasharray', '1,3');
    const shockLabelEl = shockLine.append('text').attr('x', xPop(0) + 6).attr('y', view.region.y + 22)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-annotation-size)')
      .attr('fill', 'var(--ink-mid)').text('shock, t=0');
    // Reference line at "x1" (each dot's own pre-shock level) -- the zero
    // line a multiples axis needs to read at a glance.
    const baseLine = g.append('g').style('display', 'none');
    baseLine.append('line')
      .attr('x1', view.region.x).attr('x2', view.region.x + view.region.w)
      .attr('y1', y(1)).attr('y2', y(1))
      .attr('stroke', 'var(--ink-low)').attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,4');
    baseLine.append('text').attr('x', view.region.x + view.region.w).attr('y', y(1) - 6)
      .attr('text-anchor', 'end')
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .attr('fill', 'var(--ink-low)').text('x1: each team’s own pre-shock price');

    const divAxis = g.append('g').style('display', 'none');
    divAxis.append('g')
      .attr('transform', `translate(0,${view.region.y + view.region.h + 8})`)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisBottom(xFull).ticks(6).tickFormat((d) => `${d}h`));
    divAxis.append('text')
      .attr('x', view.region.x + view.region.w / 2).attr('y', view.region.y + view.region.h + 8 + 24)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-caption-size)')
      // design-review S9 major fix: b1's window was -0.5..4h; this axis
      // widens it to -2..74h with no other cue that the domain changed
      // ("grain changes are always narrated"). The title says so directly.
      .attr('fill', 'var(--ink-mid)').text('hours after the shock — widened to the next three days');
    // Y axis: multiples of each team's own pre-shock price (computed in
    // layout() from the population's own trade history), not raw cents --
    // a fixed 0-100c domain left this scene's story crushed into the
    // bottom few percent of the chart (design-review S9 fix).
    const yTickG = g.append('g').style('display', 'none');
    yTickG.append('g')
      .attr('transform', `translate(${view.region.x - 8},0)`)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisLeft(y).tickValues([1, 2, 3, 5]).tickFormat((d) => `x${d}`));
    yTickG.append('text')
      .attr('x', view.region.x).attr('y', view.region.y - 6)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)').text('winner-ticket price (times its pre-shock price)');

    const annoG = g.append('g').style('display', 'none');
    if (data.scene && Array.isArray(data.scene.annotations)) {
      // design-review S9 major fix: Belgium's annotation lands at t_hours=0,
      // the same instant as "shock, t=0" -- same x, same prior y, garbling
      // both into illegible overprinted text. Each label gets its own row
      // (shock label owns row 0), so every dotted vertical binds to exactly
      // one readable label regardless of how close two events land in time.
      data.scene.annotations.forEach((a, idx) => {
        const ax = xFull(a.t_hours);
        const rowY = view.region.y + 22 + (idx + 1) * 20;
        annoG.append('line').attr('x1', ax).attr('x2', ax)
          .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
          .attr('stroke', 'var(--ink-low)').attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,3');
        annoG.append('text').attr('x', ax + 4).attr('y', rowY)
          .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-annotation-size)')
          .attr('fill', 'var(--ink-mid)').text(a.label);
      });
    }

    // Zone K's one occupant for this scene (CR-9 wording exactly).
    const mirrorCaption = pinnedCaption(
      container,
      'Norway rises as Argentina falls. One bracket, one sum.',
      's09-mirror-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y - 40}px`)
      .style('display', 'none');

    function step(beatId) {
      if (beatId === 'b1') {
        shockLine.style('display', null); baseLine.style('display', null); yTickG.style('display', null);
        popLinePAR.style('display', null);
        popLineNOR.style('display', null);
        popLineBEL.style('display', null);
      }
      if (beatId === 'b2') {
        fullLinePAR.style('display', null).attr('stroke-opacity', 0.85);
        fullLineNOR.style('display', null).attr('stroke-opacity', 0.85);
        fullLineBEL.style('display', null).attr('stroke-opacity', 0.85);
      }
      if (beatId === 'b3') {
        // Norway is this beat's figure ("the clearest proof"); Paraguay and
        // Belgium drop to near-rest luminance so they read as ghosted
        // context, not a third competing bright element (design-review S9
        // critical #3: "ONE figure owns the luminance peak").
        fullLinePAR.style('display', null).attr('stroke-opacity', 0.12);
        fullLineBEL.style('display', null).attr('stroke-opacity', 0.12);
        fullLineNOR.style('display', null).attr('stroke-opacity', 0.95).attr('stroke-width', 2);
        fullLineARG.style('display', null).attr('stroke-opacity', 0.95).attr('stroke-width', 2);
      }
      if (beatId === 'b2' || beatId === 'b3') {
        // The shock line was built against xPop(0) for b1's narrower
        // window; b2/b3 switch to xFull, where t=0 sits at a different
        // pixel. Re-anchor it so "shock, t=0" stays truthfully at t=0
        // instead of drifting to wherever xPop(0) used to be
        // (perception-brief P4/chart-geometry fix).
        const zx = xFull(0);
        shockLineEl.attr('x1', zx).attr('x2', zx);
        shockLabelEl.attr('x', zx + 6);
      }
      if (beatId === 'b2') { divAxis.style('display', null); annoG.style('display', null); yTickG.style('display', null); }
      if (beatId === 'b3') {
        // Both bracket annotations clear before the mirror callout lands
        // (CR-9): the mirror gets an uncluttered pair of lines.
        annoG.style('display', 'none');
        mirrorCaption.style('display', null);
      }
    }

    return {
      step,
      exit() {
        g.selectAll('*').remove();
        mirrorCaption.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>Three upsets. Three different teams' prices, and all three
        moved by the same rule.</p>
        <p>A team's price is really a price on the road still ahead of it:
        beat this team, then probably that one. When a result changes who a
        team would play next, every price on that new road moves. That
        happens even if the team itself did nothing that day. Call this
        bracket math.</p>
        <p>Watch it happen three times. When Germany went out, Paraguay's
        champion ticket jumped five times higher. Paraguay had not gotten
        better. Its road had gotten easier. Norway's ticket jumped about 3.6
        times when Brazil went out. Belgium's jumped about two
        times.<sup><a href="#fn-14">14</a></sup></p>`,
      trigger: 'step',
      state: 'pop',
      kind: 'resort',
      chip: [
        { token: 'identity-teal', glyph: 'dot', label: 'teal = Paraguay’s winner ticket' },
        { token: 'identity-blue', glyph: 'dot', label: 'blue = Norway’s' },
        { token: 'identity-pink', glyph: 'dot', label: 'pink = Belgium’s' },
      ],
      grain: { text: '1 dot = $75,000 traded again · this is the whole tournament · it never leaves', variant: 'return' },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>What happened next in each price followed bracket news, not
        fading hype. Paraguay's price drifted once France was confirmed as
        its next opponent. Belgium's price steadied once a Spain quarterfinal
        was locked in.<sup><a href="#fn-14">14</a></sup> Next, watch two
        lines move together: one up, one down.</p>`,
      trigger: 'step',
      state: 'divergence',
      kind: 'resort',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>The clearest proof is Norway. That is the team from the goal
        scene: the Norway-Brazil match, the one with Haaland's second goal,
        watched tick by tick. Norway's champion ticket spiked in the exact
        minutes Argentina was losing to Egypt. Norway's price was not
        reacting to Norway. It was watching Argentina's
        match.<sup><a href="#fn-14">14</a></sup> Neither market was copying
        the other. Both were doing the same bracket math.</p>
        <p>A price is a bet on the road still ahead, not a grade on the game
        just played. Argentina, tonight's team, is priced the same way right
        now: by the one match left on its road.</p>
        <div class="act-close scrim-card">
          <p><strong>Skill unlocked:</strong> when a price moves, ask what
          changed on the road still ahead, not just what happened in
          today's game. A jump means the news landed all at once. A slow
          drift can be that same news, working itself out one trade at a
          time.</p>
          <p><strong>The receipt:</strong> every clean spike of this
          tournament held. Every famous "panic" turned out to be the wrong
          ticket talking, or bracket math.</p>
        </div>`,
      trigger: 'step',
      state: 'mirror',
      kind: 'resort',
      chip: [
        { token: 'identity-blue', glyph: 'dot', label: 'blue = Norway, rising' },
        // design-review S9 major fix: the mark is a V -- Argentina's ticket
        // crashes near zero, then fully recovers -- so a chip reading
        // "falling" contradicted the line's own end state (it lands higher
        // than it starts). Relabeled to match what the eye actually verifies.
        { token: 'identity-lavender', glyph: 'dot', label: 'lavender = Argentina, nearly dead for an hour' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      overlayStep: 'b3',
    },
  ],

  reducedMotion: {
    // Step-triggered: each end state (pop/divergence/mirror) is already
    // static-readable; the engine's own §3.5 instant-apply + 400ms
    // crossfade covers reduced motion without a per-beat substitution.
  },

  anchors: {
    /* L3 recap for S16's lens carousel (CONTRACT §4 `anchors?`): the
     * Norway-Argentina winner-leg mirror, rebuilt from the population's own
     * winner_futures dots (birth time on x, traded price on y). Norway's leg
     * climbs while Argentina's falls; that coincidence is the mirror. This
     * function is self-sufficient by design: it reads only data.pop and
     * data.manifest, builds fresh local scales rather than the registry
     * (this scene's own keys are cleared on exit, CONTRACT §6.1), and never
     * touches data.scene (S16 loads no scenes table, so the live scene's
     * shock timestamps are unavailable here; raw birth time still tells the
     * mirror). S16 dims everything but the NOR/ARG dots via its own
     * spotlight, so this only has to place them truthfully. */
    mirror(data, view, rect) {
      const { pop, manifest } = data;
      const N = pop.count;
      const state = makeState(N);
      const epochMs = new Date(manifest.epoch).getTime();
      const endMs = new Date(manifest.frozen_at || manifest.generated).getTime();
      const famIdx = manifest.enums.family.indexOf('winner_futures');
      const norIdx = manifest.teams.indexOf('NOR');
      const argIdx = manifest.teams.indexOf('ARG');
      const x = d3.scaleUtc().domain([epochMs, endMs]).range([rect.x + 8, rect.x + rect.w - 8]);
      const y = d3.scaleLinear().domain([0, 100]).range([rect.y + rect.h - 8, rect.y + 8]);
      const rest = particleState(view.tokens, 'dimmed-field-min');
      const norRgba = colorOf(view.tokens, 'identity-blue');
      const argRgba = colorOf(view.tokens, 'identity-lavender');
      const baseSize = view.tokens.dot['radius-base-px'];
      for (let i = 0; i < N; i++) {
        const isNor = pop.team[i] === norIdx && pop.family[i] === famIdx;
        const isArg = pop.team[i] === argIdx && pop.family[i] === famIdx;
        if ((isNor || isArg) && pop.price_band[i] !== 255) {
          state.x[i] = x(epochMs + pop.birth_ts[i] * 1000);
          state.y[i] = y(pop.price_band[i]);
          setColor(state.color, i, isNor ? norRgba : argRgba);
        } else {
          state.x[i] = rect.x + rect.w * (0.08 + 0.84 * hash01(i * 3 + 1));
          state.y[i] = rect.y + rect.h * (0.08 + 0.84 * hash01(i * 7 + 2));
          setColor(state.color, i, rest);
        }
        state.size[i] = baseSize;
      }
      return {
        state,
        drawAxes(g) {
          const ax = g.append('g').attr('class', 's09-anchor-axes');
          ax.append('g')
            .attr('transform', `translate(0,${rect.y + rect.h})`)
            .call(d3.axisBottom(x).ticks(4))
            .call((s) => {
              s.selectAll('text').attr('fill', view.css('ink-low'))
                .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
              s.selectAll('path,line').attr('stroke', view.css('ink-low'));
            });
          ax.append('text').attr('x', rect.x).attr('y', rect.y - 6)
            .attr('fill', view.css('identity-blue'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-annotation-size'))
            .text('Norway');
          ax.append('text').attr('x', rect.x + 76).attr('y', rect.y - 6)
            .attr('fill', view.css('identity-lavender'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-annotation-size'))
            .text('Argentina');
        },
      };
    },
  },
};
