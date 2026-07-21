/* docs/js/scenes/s09.js
 * S9 · Act II · "Three shocks, one rule: path math"
 * storyboard.md §3 S9 · CONTRACT.md §4.2 row s09 (shock-align, 3 steps, no zoom)
 *
 * Grain shift back OUT, narrated: the match-world tick dots (S8's GERPAR
 * window) repack into population grain ("back to $75,000 a dot"). This
 * scene needs no zoom tile: it re-sorts the PERSISTENT population's actual
 * winner-futures dots for Paraguay, Norway, and Belgium (population columns
 * `team`/`family`/`birth_ts`/`price_band`, CONTRACT §5.2 -- no markets.json
 * lookup required).
 *
 * Gate-5 item 10 rebuild (author feedback): the old build overlaid all
 * three teams' shocks on one shared "hours since t=0" clock and called
 * "bracket math" without ever defining it. Three strangers sharing a fake
 * timeline is not one chart; it is three different days pretending to be
 * the same day. This version instead draws:
 *   1. A tiny ROAD diagram (data.scene.road) above the first panel --
 *      Paraguay's own bracket, Germany crossed out, France revealed next --
 *      so "the road got easier" is something the reader can SEE, not just
 *      read.
 *   2. THREE SMALL MULTIPLES, one panel per shock, each on its own real
 *      calendar axis (data.scene.shock_series[].points, real t_iso
 *      timestamps) with its own annotation (data.scene.annotations,
 *      matched by team) -- no shared clock, no normalization to hide.
 *   3. A MIRROR INSET at true minute grain (data.scene.mirror) magnifying
 *      the one match where Norway's ticket and Argentina's moved in
 *      opposite directions at the same time; the wide comparison chart
 *      that leads into it keeps a dashed marker showing where the inset
 *      zooms in from.
 * "Bracket" is US sports jargon the piece never taught; every reader-
 * facing use is now "path math" or plain "the road ahead," matching the
 * road metaphor S9 already teaches. DATA CONTRACT read-set: shocks[],
 * shock_series[], annotations[], mirror.{nor[],arg[],egypt_leading[],
 * kickoff_ts}, road.{team,slots[]} (docs/data/scenes/s09.json).
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
// data-derived, never a fabricated constant. Still used as a fallback for
// Norway (if shock_series is ever missing) and directly for Argentina,
// which carries no shock of its own.
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
  // minimum tradable tick is 1 cent), so the divisor floors at 1.
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
const STAGE_LABEL = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarterfinal', SF: 'Semifinal', F: 'Final' };

// Pure function of view geometry (no data dependency): the road strip and
// three stacked lane rects, computed once and re-derived identically by
// scales()/layout()/overlay() rather than threaded through the registry
// (which CONTRACT §6.1 reserves for d3 scale objects).
function panelLayout(view) {
  const region = view.region;
  // Mobile DOM audit (390x844): the old 50px mobile road left each slot box
  // only 20px tall (boxH = roadH - 30 floor, see buildRoadDiagram), stacking
  // the stage label ("Round of 32") and the opponent name ("Germany") with
  // 4px between baselines -- a real collision, not a scrim. Every width now
  // gets desktop's 62px road, so the two rows keep the same 14px baseline
  // separation that already reads clean at desktop sizes; the ~4px of lane
  // height this costs each of the three panels is invisible at 390x844.
  const roadH = 62;
  const topGap = 10;
  const laneGapY = view.mobile ? 8 : 14;
  const laneCount = TEAMS.length;
  const availH = region.h - roadH - topGap;
  const laneH = (availH - laneGapY * (laneCount - 1)) / laneCount;
  // The road row sits at the very top of the region, the one place this
  // scene's own KEY panel also lives (top-right corner, design-system
  // key-exclusion convention already used by s03/s05/s10/s12) -- narrow
  // just this row so its last box never draws underneath it, same fix
  // shape as s03's mini race-curve chart.
  const keyMarginPx = view.mobile ? 0
    : (view.tokens.layout['key-exclusion-w-px'] || 280) + view.tokens.spacing_px[3];
  const roadRight = view.mobile
    ? region.x + region.w
    : Math.min(region.x + region.w, view.W - keyMarginPx - view.safe);
  const roadRect = { x: region.x, y: region.y, w: roadRight - region.x, h: roadH };
  const lanes = TEAMS.map((cfg, idx) => ({
    team: cfg.code,
    color: cfg.color,
    label: cfg.label,
    rect: {
      x: region.x,
      y: region.y + roadH + topGap + idx * (laneH + laneGapY),
      w: region.w,
      h: laneH,
    },
  }));
  return { roadRect, lanes };
}
// Plot area inside one lane rect: left margin for the "×N" y-ticks, right
// margin for the line's own direct end-label, top for the team name, bottom
// for the real-date x-ticks.
function lanePlotRect(rect, view) {
  const marginLeft = view.mobile ? 24 : 30;
  const marginRight = view.mobile ? 30 : 40;
  const marginTop = 14;
  const marginBottom = 16;
  return {
    x: rect.x + marginLeft,
    y: rect.y + marginTop,
    w: Math.max(10, rect.w - marginLeft - marginRight),
    h: Math.max(10, rect.h - marginTop - marginBottom),
  };
}

// The tiny ROAD diagram: Paraguay's own bracket, read straight off
// data.scene.road.slots (fact-base bracket structure + entity-map kickoff
// times, Gate-5 item 10c). Nothing here is a JS literal -- every opponent
// name and every "beaten"/"confirmed"/"tbd" status is read live, so a
// future refreeze (a different team's road, a different outcome) redraws
// correctly with no code change.
function buildRoadDiagram(g, view, roadRect, road) {
  const rg = g.append('g').attr('class', 's09-road').style('display', 'none');
  if (!road || !Array.isArray(road.slots) || !road.slots.length) return rg;
  const teamCfg = TEAMS.find((t) => t.code === road.team);
  const teamLabel = teamCfg ? teamCfg.label : road.team;
  rg.append('text')
    .attr('x', roadRect.x).attr('y', roadRect.y + 9)
    .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-micro-size'))
    .attr('fill', view.css('ink-mid'))
    .text(`${teamLabel}'s own road, one result at a time`);
  const slots = road.slots;
  const n = slots.length;
  const gap = view.mobile ? 4 : 8;
  const boxW = (roadRect.w - gap * (n - 1)) / n;
  const boxY = roadRect.y + 16;
  // One boxH at every width (paired with panelLayout's single 62px roadH):
  // the mobile-only 26px cap re-created the stage-label/opponent collision
  // the taller road exists to prevent -- 30px keeps the stage row (boxY+10)
  // and the opponent row (boxY+boxH-6) a full text-box apart on mobile too.
  const boxH = Math.min(roadRect.h - 30, 30);
  slots.forEach((slot, i) => {
    const bx = roadRect.x + i * (boxW + gap);
    const status = (slot.post && slot.post.status) || 'tbd';
    const beaten = /beaten|out|lost/i.test(status);
    const confirmed = status === 'confirmed';
    const tbd = status === 'tbd';
    const cell = rg.append('g');
    cell.append('rect')
      .attr('x', bx).attr('y', boxY).attr('width', boxW).attr('height', boxH)
      .attr('rx', 3)
      .attr('fill', view.css('bg-card')).attr('fill-opacity', 0.55)
      .attr('stroke', confirmed ? view.css(teamCfg ? teamCfg.color : 'identity-teal') : view.css('ink-low'))
      .attr('stroke-dasharray', tbd ? '2,3' : null)
      .attr('stroke-opacity', tbd ? 0.5 : 0.85);
    cell.append('text')
      .attr('x', bx + 5).attr('y', boxY + 10)
      .attr('font-family', view.css('font-apparatus')).attr('font-size', '9px')
      .attr('fill', view.css('ink-low'))
      .text(STAGE_LABEL[slot.stage] || slot.stage);
    const oppText = (slot.post && slot.post.opponent) || (slot.pre && slot.pre.opponent) || 'TBD';
    const oppEl = cell.append('text')
      .attr('x', bx + 5).attr('y', boxY + boxH - 6)
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.mobile ? '9px' : '10px')
      .attr('fill', confirmed ? view.css(teamCfg ? teamCfg.color : 'identity-teal') : view.css('ink-mid'))
      .text(oppText);
    if (beaten) {
      oppEl.attr('text-decoration', 'line-through').attr('fill', view.css('ink-low')).attr('fill-opacity', 0.75);
      cell.append('text')
        .attr('x', bx + 5).attr('y', boxY + boxH + 11)
        .attr('font-family', view.css('font-apparatus')).attr('font-size', '8px')
        .attr('fill', view.css('ink-low'))
        .text(status);
    }
    if (i < n - 1) {
      rg.append('line')
        .attr('x1', bx + boxW).attr('x2', bx + boxW + gap)
        .attr('y1', boxY + boxH / 2).attr('y2', boxY + boxH / 2)
        .attr('stroke', view.css('ink-low')).attr('stroke-width', 1).attr('stroke-opacity', 0.5);
    }
  });
  return rg;
}

export default {
  id: 's09',
  act: 2,
  title: 'Three upsets, one rule',
  kicker: 'Skill 3, continued: prices watch the road ahead',
  layoutName: 'shock-align',

  needs: { scene: true, series: [], zoom: null },

  scales(data, view) {
    const region = view.region;
    const { roadRect, lanes } = panelLayout(view);
    const shockSeries = (data.scene && data.scene.shock_series) || [];
    const shocks = (data.scene && data.scene.shocks) || [];

    const laneScales = {};
    lanes.forEach((lane) => {
      const plot = lanePlotRect(lane.rect, view);
      const series = shockSeries.find((s) => s.team === lane.team);
      let x;
      let y;
      if (series && Array.isArray(series.points) && series.points.length) {
        const times = series.points.map((p) => new Date(p.t_iso).getTime());
        const maxMult = d3.max(series.points, (p) => p.mult) || 1;
        x = d3.scaleUtc().domain(d3.extent(times)).range([plot.x, plot.x + plot.w]);
        y = d3.scaleLinear().domain([0, Math.max(1.1, maxMult * 1.15)]).range([plot.y + plot.h, plot.y]);
      } else {
        x = d3.scaleUtc().domain([Date.now() - 86400000, Date.now()]).range([plot.x, plot.x + plot.w]);
        y = d3.scaleLinear().domain([0, 1]).range([plot.y + plot.h, plot.y]);
      }
      registry.register(`s09.x.${lane.team}`, x);
      registry.register(`s09.y.${lane.team}`, y);
      laneScales[lane.team] = {
        x, y, plot, rect: lane.rect, color: lane.color, label: lane.label,
      };
    });

    // Wide mirror chart (b3): hours since Norway's own shock instant, y =
    // multiples of Norway's own pre-shock price. Gate-5 provenance-ledger
    // NOT_FIXED item (s09 finding #1): the old domain was a bare [0, 6]
    // `.clamp(true)` literal that never read the data it was drawing. The
    // ceiling now comes from the one number this chart exists to prove --
    // Norway's own verified shock multiple -- with headroom, not a magic
    // constant.
    // Same KEY-panel collision this scene's road row already guards
    // against (top-right corner, design-system key-exclusion convention):
    // the wide chart also starts at region.y, and its direct end-labels
    // ("Norway"/"Argentina") sit at its own right edge -- narrow it the
    // same way so neither line's label draws underneath the KEY.
    const keyMarginPxTop = view.mobile ? 0
      : (view.tokens.layout['key-exclusion-w-px'] || 280) + view.tokens.spacing_px[3];
    const mirrorRight = view.mobile
      ? region.x + region.w
      : Math.min(region.x + region.w, view.W - keyMarginPxTop - view.safe);
    const mirrorMainRect = {
      x: region.x, y: region.y, w: mirrorRight - region.x, h: region.h * (view.mobile ? 0.46 : 0.52),
    };
    const norShock = shocks.find((s) => s.team === 'NOR');
    const mirrorCeiling = Math.max(1.1, (norShock ? norShock.pop_multiple : 1) * 1.15);
    const xFull = d3.scaleLinear().domain([-2, 74]).range([mirrorMainRect.x, mirrorMainRect.x + mirrorMainRect.w]);
    const yMirror = d3.scaleLinear().domain([0, mirrorCeiling]).clamp(true)
      .range([mirrorMainRect.y + mirrorMainRect.h, mirrorMainRect.y]);
    registry.register('s09.xFull', xFull);
    registry.register('s09.yMirror', yMirror);

    // Mirror inset: true minute grain, its own real-time x and its own
    // cents y -- built to make the amplitude the wide chart's multiples
    // axis cannot show (design-review S9: "amplitude-crushed... invisible")
    // visible on purpose. gapY reserves the wide chart's whole bottom-axis
    // stack: the +8 axis offset every other bottom axis uses, d3's own
    // default 6px tick line + 3px tick padding, one micro-size tick-label
    // line box, a full micro ascent of standoff, then the axis title's own
    // line box -- all derived from the same micro type token the axis text
    // is drawn with (s03 reads the token the same way), never a fixed
    // pixel budget. The layout audit measured the old fixed "+24" title
    // baseline grazing the 20h-60h tick-label boxes by 22x9px at 1280,
    // 1440, and 1512 alike; the graze is font-driven, so the cure is
    // font-derived and holds at every width.
    const microPx = parseFloat(
      (view.tokens.typography.scale.find((t) => t.name === 'micro') || {}).size,
    ) || 12;
    const tickBoxPx = 6 + 3 + microPx * 1.2;
    const axisTitleY = mirrorMainRect.y + mirrorMainRect.h + 8 + tickBoxPx + microPx;
    const gapY = Math.ceil(8 + tickBoxPx + microPx * 1.4 + (view.mobile ? 8 : 12));
    const mirrorInsetRect = {
      x: region.x,
      y: mirrorMainRect.y + mirrorMainRect.h + gapY,
      w: region.w,
      h: Math.max(90, region.h - mirrorMainRect.h - gapY),
    };
    const mirrorData = (data.scene && data.scene.mirror) || null;
    let xInset = null;
    let yInset = null;
    if (mirrorData && Array.isArray(mirrorData.nor) && mirrorData.nor.length) {
      const allPts = mirrorData.nor.concat(Array.isArray(mirrorData.arg) ? mirrorData.arg : []);
      const times = allPts.map((p) => new Date(p.t_iso).getTime());
      const maxPrice = d3.max(allPts, (p) => p.price_c) || 20;
      xInset = d3.scaleUtc().domain(d3.extent(times))
        .range([mirrorInsetRect.x + 32, mirrorInsetRect.x + mirrorInsetRect.w - 12]);
      yInset = d3.scaleLinear().domain([0, maxPrice * 1.12])
        .range([mirrorInsetRect.y + mirrorInsetRect.h - 20, mirrorInsetRect.y + 24]);
      registry.register('s09.xInset', xInset);
      registry.register('s09.yInset', yInset);
    }

    return {
      roadRect,
      lanes: laneScales,
      xFull,
      yMirror,
      mirrorMainRect,
      axisTitleY,
      xInset,
      yInset,
      mirrorInsetRect,
    };
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
    const shockSeries = (data.scene && data.scene.shock_series) || [];
    const shockTsFor = (code) => {
      const s = shocks.find((s2) => s2.team === code);
      return s ? new Date(s.shock_ts).getTime() : null;
    };
    const norwayShockTs = shockTsFor('NOR');

    function cloneOf(s) {
      return { x: s.x.slice(), y: s.y.slice(), color: s.color.slice(), size: s.size.slice() };
    }

    const triptychState = cloneOf(base);
    const mirrorState = cloneOf(base);
    const dimRgba = particleState(view.tokens, 'dimmed-field-max');

    // design-review S9 critical #1/#2 fix, carried forward: population
    // price_band is whole cents only, and Paraguay/Norway trade in
    // fractions of a cent near their shocks, so per-dot marks stay real
    // trades at real times but recolor to the ambient rest tone -- they
    // are texture, not the signal. The signal is the verified line drawn
    // in overlay() straight from shock_series, the tape's own hourly
    // recompute. Each team now places into its OWN lane's own real-date x
    // and own multiples-of-its-own-baseline y (registered in scales()),
    // never a shared clock.
    for (const cfg of TEAMS) {
      const series = shockSeries.find((s) => s.team === cfg.code);
      const x = registry.get(`s09.x.${cfg.code}`);
      const y = registry.get(`s09.y.${cfg.code}`);
      if (!series || !x || !y) continue;
      const baselineC = Math.max(1, series.baseline_c || 1);
      const [d0, d1] = x.domain();
      const t0 = d0.getTime ? d0.getTime() : d0;
      const t1 = d1.getTime ? d1.getTime() : d1;
      for (const i of dotsByTeam[cfg.code]) {
        if (pop.price_band[i] === 255) continue;
        const tMs = epochMs + pop.birth_ts[i] * 1000;
        if (tMs < t0 || tMs > t1) continue;
        triptychState.x[i] = x(tMs);
        triptychState.y[i] = y(pop.price_band[i] / baselineC);
        setColor(triptychState.color, i, dimRgba);
        triptychState.size[i] = baseSize;
      }
    }

    // Mirror texture (b3): Norway and Argentina only -- the beat's own two
    // figures. Paraguay and Belgium already had their moment in the panels
    // above; leaving them out of this chart avoids stitching three
    // different teams' own shock-relative hours back onto one shared axis,
    // exactly the failure this rebuild removes. Argentina's dots are
    // deliberately anchored to Norway's own shock instant (not their own
    // team's, which has none here) -- that alignment is the point of the
    // mirror, not a repeat of the old shared-clock defect.
    const xFull = registry.get('s09.xFull');
    const yMirror = registry.get('s09.yMirror');
    if (xFull && yMirror && norwayShockTs !== null) {
      const norSeries = shockSeries.find((s) => s.team === 'NOR');
      const norBaseline = norSeries && norSeries.baseline_c
        ? norSeries.baseline_c
        : computeBaseline(dotsByTeam.NOR, pop, epochMs, norwayShockTs);
      if (norBaseline) {
        for (const i of dotsByTeam.NOR) {
          if (pop.price_band[i] === 255) continue;
          const hrs = (epochMs + pop.birth_ts[i] * 1000 - norwayShockTs) / 3600000;
          if (hrs < -2 || hrs > 74) continue;
          mirrorState.x[i] = xFull(hrs);
          mirrorState.y[i] = yMirror(pop.price_band[i] / norBaseline);
          setColor(mirrorState.color, i, dimRgba);
          mirrorState.size[i] = baseSize;
        }
      }
      const argBaseline = computeBaseline(dotsByTeam.ARG, pop, epochMs, norwayShockTs);
      if (argBaseline) {
        for (const i of dotsByTeam.ARG) {
          if (pop.price_band[i] === 255) continue;
          const hrs = (epochMs + pop.birth_ts[i] * 1000 - norwayShockTs) / 3600000;
          if (hrs < -2 || hrs > 74) continue;
          mirrorState.x[i] = xFull(hrs);
          mirrorState.y[i] = yMirror(pop.price_band[i] / argBaseline);
          setColor(mirrorState.color, i, dimRgba);
          mirrorState.size[i] = baseSize;
        }
      }
    }

    return { states: { triptych: triptychState, mirror: mirrorState } };
  },

  overlay(container, data, view, scales) {
    const g = container.svg;
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
    const shockSeriesL = (data.scene && data.scene.shock_series) || [];
    const annotationsL = (data.scene && Array.isArray(data.scene.annotations)) ? data.scene.annotations : [];
    const roadL = (data.scene && data.scene.road) || null;
    const mirrorDataL = (data.scene && data.scene.mirror) || null;
    const shocksMapL = {};
    shocksL.forEach((s) => { shocksMapL[s.team] = s; });
    const norShockL = shocksMapL.NOR;
    const norShockTsL = norShockL ? new Date(norShockL.shock_ts).getTime() : null;

    // Binned-median series (Argentina only now -- see layout()'s note on
    // why Paraguay/Belgium do not re-appear in this wide chart): at this
    // population's grain, consecutive trades by timestamp are noisy, so a
    // literal point-to-point line oscillates in a way no reader can parse.
    // Each time bucket takes the median of the dots that actually traded
    // inside it -- the standard way to turn a tick series into a readable
    // price path, still entirely data-derived.
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

    // ------------------------------------------------------------------
    // The tiny road diagram, above the first panel.
    const roadG = buildRoadDiagram(g, view, scales.roadRect, roadL);

    // ------------------------------------------------------------------
    // Three small multiples: one panel per shock, each its own real day.
    const laneGs = {};
    const laneAnnoGs = {};
    TEAMS.forEach((cfg) => {
      const lane = scales.lanes[cfg.code];
      const series = shockSeriesL.find((s) => s.team === cfg.code);
      const shock = shocksMapL[cfg.code];
      const laneG = g.append('g').attr('class', `s09-lane s09-lane-${cfg.code}`).style('display', 'none');
      laneGs[cfg.code] = laneG;
      if (!lane || !series) return;
      const { x, y, plot } = lane;

      laneG.append('text')
        .attr('x', plot.x).attr('y', lane.rect.y + 10)
        .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-micro-size'))
        .attr('fill', view.css(cfg.color))
        .text(cfg.label);

      // Reference line at "x1" -- each team's own pre-shock price.
      laneG.append('line')
        .attr('x1', plot.x).attr('x2', plot.x + plot.w)
        .attr('y1', y(1)).attr('y2', y(1))
        .attr('stroke', view.css('ink-low')).attr('stroke-width', 1).attr('stroke-dasharray', '2,4');

      // The shock instant itself.
      const shockMs = new Date(series.shock_ts).getTime();
      const shockPx = x(shockMs);
      laneG.append('line')
        .attr('x1', shockPx).attr('x2', shockPx)
        .attr('y1', plot.y).attr('y2', plot.y + plot.h)
        .attr('stroke', view.css('ink-mid')).attr('stroke-width', 1).attr('stroke-dasharray', '1,3');
      if (cfg.code === TEAMS[0].code) {
        laneG.append('text')
          .attr('x', shockPx + 4).attr('y', plot.y + 9)
          .attr('font-family', view.css('font-apparatus')).attr('font-size', '9px')
          .attr('fill', view.css('ink-mid')).text('shock');
      }

      laneG.append('g')
        .attr('transform', `translate(${plot.x - 6},0)`)
        .call(d3.axisLeft(y).ticks(3).tickFormat((d) => `×${d}`))
        .call((s) => {
          s.selectAll('text').attr('fill', view.css('ink-low'))
            .style('font-family', view.css('font-apparatus')).style('font-size', '9px');
          s.selectAll('path,line').attr('stroke', view.css('ink-low')).attr('stroke-opacity', 0.4);
        });
      laneG.append('g')
        .attr('transform', `translate(0,${plot.y + plot.h + 4})`)
        .call(d3.axisBottom(x).ticks(view.mobile ? 2 : 3).tickFormat(d3.utcFormat('%b %d')))
        .call((s) => {
          s.selectAll('text').attr('fill', view.css('ink-low'))
            .style('font-family', view.css('font-apparatus')).style('font-size', '9px');
          s.selectAll('path,line').attr('stroke', view.css('ink-low')).attr('stroke-opacity', 0.4);
        });

      // The price line, straight off the tape's own hourly recompute
      // (shock_series[].points) -- flat before the shock, a jump, then
      // whatever it actually did next. Never a fabricated step shape.
      const lineGen = d3.line().x((d) => x(new Date(d.t_iso))).y((d) => y(d.mult));
      if (cfg.code === 'NOR') {
        // NOR vs field.rest sits near isoluminant (perception-brief §9b);
        // a wider near-white halo first clears a real luminance floor.
        laneG.append('path').datum(series.points).attr('fill', 'none')
          .attr('stroke', 'var(--ink-hero)').attr('stroke-width', 4.5)
          .attr('stroke-opacity', 0.4).attr('stroke-linecap', 'round')
          .attr('d', lineGen);
      }
      laneG.append('path').datum(series.points).attr('fill', 'none')
        .attr('stroke', view.css(cfg.color)).attr('stroke-width', cfg.code === 'NOR' ? 2 : 1.5)
        .attr('stroke-opacity', 0.92).attr('d', lineGen);

      // Direct end-label: the same verified multiple the beat's prose
      // quotes (data.scene.shocks[].pop_multiple, R9/fn-14), so the chart
      // and the sentence never disagree.
      if (shock && series.points.length) {
        const last = series.points[series.points.length - 1];
        laneG.append('text')
          .attr('x', plot.x + plot.w + 4).attr('y', y(last.mult))
          .attr('font-family', view.css('font-apparatus')).attr('font-size', '10px')
          .attr('fill', view.css(cfg.color))
          .text(`×${shock.pop_multiple}`);
      }

      // This lane's own annotation (revealed at b2, not before).
      const anno = annotationsL.find((a) => a.team === cfg.code);
      const annoG = laneG.append('g').attr('class', 's09-lane-anno').style('display', 'none');
      if (anno && anno.t_iso) {
        const ax = x(new Date(anno.t_iso));
        annoG.append('line')
          .attr('x1', ax).attr('x2', ax).attr('y1', plot.y).attr('y2', plot.y + plot.h)
          .attr('stroke', view.css('ink-low')).attr('stroke-width', 1).attr('stroke-dasharray', '2,3');
        annoG.append('text')
          .attr('x', Math.min(ax + 3, plot.x + plot.w - 4)).attr('y', plot.y + plot.h - 4)
          .attr('font-family', view.css('font-apparatus')).attr('font-size', '9px')
          .attr('fill', view.css('ink-mid')).text(anno.label);
      }
      laneAnnoGs[cfg.code] = annoG;
    });

    // ------------------------------------------------------------------
    // b3: the wide mirror chart, then the marker, then the magnified inset.
    const { xFull, yMirror, mirrorMainRect, axisTitleY } = scales;
    const mirrorMainG = g.append('g').attr('class', 's09-mirror-main').style('display', 'none');
    mirrorMainG.append('g')
      .attr('transform', `translate(0,${mirrorMainRect.y + mirrorMainRect.h + 8})`)
      .call(d3.axisBottom(xFull).ticks(6).tickFormat((d) => `${d}h`))
      .call((s) => {
        s.selectAll('text').attr('fill', view.css('ink-low'))
          .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
        s.selectAll('path,line').attr('stroke', view.css('ink-low'));
      });
    // Title baseline computed in scales() from the micro type token: one
    // full ascent below the bottom of the tick-label boxes, so the title
    // clears the 20h-60h ticks at every viewport width. The prior fixed
    // "+24" (borrowed from other scenes' bottom axes) measured a 22x9px
    // graze against the tick labels at 1280/1440/1512 in the layout audit.
    mirrorMainG.append('text')
      .attr('x', mirrorMainRect.x + mirrorMainRect.w / 2).attr('y', axisTitleY)
      .attr('text-anchor', 'middle')
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-micro-size'))
      .attr('fill', view.css('ink-mid')).text('hours after Norway’s own shock, three days wide');
    mirrorMainG.append('g')
      .attr('transform', `translate(${mirrorMainRect.x - 8},0)`)
      .call(d3.axisLeft(yMirror).ticks(4).tickFormat((d) => `×${d}`))
      .call((s) => {
        s.selectAll('text').attr('fill', view.css('ink-low'))
          .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
        s.selectAll('path,line').attr('stroke', view.css('ink-low'));
      });
    mirrorMainG.append('line')
      .attr('x1', mirrorMainRect.x).attr('x2', mirrorMainRect.x + mirrorMainRect.w)
      .attr('y1', yMirror(1)).attr('y2', yMirror(1))
      .attr('stroke', view.css('ink-low')).attr('stroke-width', 1).attr('stroke-dasharray', '2,4');
    const shockPxMain = xFull(0);
    mirrorMainG.append('line')
      .attr('x1', shockPxMain).attr('x2', shockPxMain)
      .attr('y1', mirrorMainRect.y).attr('y2', mirrorMainRect.y + mirrorMainRect.h)
      .attr('stroke', view.css('ink-mid')).attr('stroke-width', 1).attr('stroke-dasharray', '1,3');
    mirrorMainG.append('text')
      .attr('x', shockPxMain + 6).attr('y', mirrorMainRect.y + 14)
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-annotation-size'))
      .attr('fill', view.css('ink-mid')).text('Norway’s shock, t=0');

    const norSeriesL = shockSeriesL.find((s) => s.team === 'NOR');
    if (norSeriesL && norShockTsL !== null) {
      const norPts = norSeriesL.points.map((p) => ({
        hrs: (new Date(p.t_iso).getTime() - norShockTsL) / 3600000,
        mult: p.mult,
      }));
      const norLineGen = d3.line().x((d) => xFull(d.hrs)).y((d) => yMirror(d.mult));
      mirrorMainG.append('path').datum(norPts).attr('fill', 'none')
        .attr('stroke', 'var(--ink-hero)').attr('stroke-width', 5)
        .attr('stroke-opacity', 0.4).attr('stroke-linecap', 'round').attr('d', norLineGen);
      mirrorMainG.append('path').datum(norPts).attr('fill', 'none')
        .attr('stroke', view.css('identity-blue')).attr('stroke-width', 2)
        .attr('stroke-opacity', 0.95).attr('d', norLineGen);
    }
    // Argentina, population-derived, anchored to Norway's own shock instant
    // on purpose -- that alignment is the mirror this chart exists to show.
    const argPts = teamSeries('ARG', norShockTsL, -2, 74, 40);
    if (argPts.length > 1) {
      const argLineGen = d3.line().x((d) => xFull(d.hrs)).y((d) => yMirror(d.mult));
      mirrorMainG.append('path').datum(argPts).attr('fill', 'none')
        .attr('stroke', view.css('identity-lavender')).attr('stroke-width', 2)
        .attr('stroke-opacity', 0.95).attr('d', argLineGen);
    }
    mirrorMainG.append('text')
      .attr('x', mirrorMainRect.x + mirrorMainRect.w - 4).attr('y', mirrorMainRect.y + 14)
      .attr('text-anchor', 'end')
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-annotation-size'))
      .attr('fill', view.css('identity-blue')).text('Norway');
    mirrorMainG.append('text')
      .attr('x', mirrorMainRect.x + mirrorMainRect.w - 4).attr('y', mirrorMainRect.y + 28)
      .attr('text-anchor', 'end')
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-annotation-size'))
      .attr('fill', view.css('identity-lavender')).text('Argentina');

    // The marker: a dashed band on the wide chart showing exactly where
    // the inset below zooms in from, plus the inset itself.
    const markerG = g.append('g').attr('class', 's09-marker').style('display', 'none');
    const insetG = g.append('g').attr('class', 's09-inset').style('display', 'none');
    if (mirrorDataL && Array.isArray(mirrorDataL.nor) && mirrorDataL.nor.length
      && scales.xInset && scales.yInset) {
      const norIn = mirrorDataL.nor;
      const argIn = Array.isArray(mirrorDataL.arg) ? mirrorDataL.arg : [];
      const winStartMs = new Date(norIn[0].t_iso).getTime();
      const winEndMs = new Date(norIn[norIn.length - 1].t_iso).getTime();
      const { xInset, yInset, mirrorInsetRect } = scales;

      if (norShockTsL !== null) {
        const hrsStart = (winStartMs - norShockTsL) / 3600000;
        const hrsEnd = (winEndMs - norShockTsL) / 3600000;
        const bx0 = xFull(hrsStart);
        const bx1 = xFull(hrsEnd);
        markerG.append('rect')
          .attr('x', bx0).attr('y', mirrorMainRect.y)
          .attr('width', Math.max(2, bx1 - bx0)).attr('height', mirrorMainRect.h)
          .attr('fill', view.css('ink-hero')).attr('fill-opacity', 0.06)
          .attr('stroke', view.css('ink-low')).attr('stroke-dasharray', '2,3').attr('stroke-opacity', 0.6);
        // The connector line alone says "zoomed below" -- the inset carries
        // its own title, so a second text label here only collided with the
        // wide chart's own axis title in the narrow band between them
        // (walkthrough capture caught the overlap).
        markerG.append('line')
          .attr('x1', (bx0 + bx1) / 2).attr('x2', mirrorInsetRect.x + mirrorInsetRect.w / 2)
          .attr('y1', Math.min(axisTitleY + 8, mirrorInsetRect.y - 2)).attr('y2', mirrorInsetRect.y)
          .attr('stroke', view.css('ink-low')).attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,3').attr('stroke-opacity', 0.5);
      }

      insetG.append('rect')
        .attr('x', mirrorInsetRect.x).attr('y', mirrorInsetRect.y)
        .attr('width', mirrorInsetRect.w).attr('height', mirrorInsetRect.h)
        .attr('fill', view.css('bg-card')).attr('fill-opacity', 0.5)
        .attr('stroke', view.css('ink-low')).attr('stroke-opacity', 0.4);
      insetG.append('text')
        .attr('x', mirrorInsetRect.x + 8).attr('y', mirrorInsetRect.y + 14)
        .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-micro-size'))
        .attr('fill', view.css('ink-mid')).text('magnified: minute by minute, the Argentina-Egypt match');

      // Egypt-leading window, shaded -- tape-derived goal-jump detections
      // (Gate-5 item 10b), not a guess.
      if (Array.isArray(mirrorDataL.egypt_leading) && mirrorDataL.egypt_leading.length === 2) {
        const eg0 = xInset(new Date(mirrorDataL.egypt_leading[0]));
        const eg1 = xInset(new Date(mirrorDataL.egypt_leading[1]));
        insetG.append('rect')
          .attr('x', Math.min(eg0, eg1)).attr('y', mirrorInsetRect.y + 20)
          .attr('width', Math.max(1, Math.abs(eg1 - eg0))).attr('height', mirrorInsetRect.h - 42)
          .attr('fill', view.css('ink-mid')).attr('fill-opacity', 0.12);
        insetG.append('text')
          .attr('x', Math.min(eg0, eg1) + 4).attr('y', mirrorInsetRect.y + 32)
          .attr('font-family', view.css('font-apparatus')).attr('font-size', '9px')
          .attr('fill', view.css('ink-mid')).text('Egypt leads');
      }
      if (mirrorDataL.kickoff_ts) {
        const kx = xInset(new Date(mirrorDataL.kickoff_ts));
        insetG.append('line')
          .attr('x1', kx).attr('x2', kx)
          .attr('y1', mirrorInsetRect.y + 20).attr('y2', mirrorInsetRect.y + mirrorInsetRect.h - 22)
          .attr('stroke', view.css('ink-low')).attr('stroke-width', 1).attr('stroke-dasharray', '1,3');
        insetG.append('text')
          .attr('x', kx + 3).attr('y', mirrorInsetRect.y + mirrorInsetRect.h - 24)
          .attr('font-family', view.css('font-apparatus')).attr('font-size', '9px')
          .attr('fill', view.css('ink-low')).text('kickoff');
      }

      insetG.append('g')
        .attr('transform', `translate(0,${mirrorInsetRect.y + mirrorInsetRect.h - 20})`)
        .call(d3.axisBottom(xInset).ticks(view.mobile ? 3 : 5).tickFormat(d3.utcFormat('%H:%M')))
        .call((s) => {
          s.selectAll('text').attr('fill', view.css('ink-low'))
            .style('font-family', view.css('font-apparatus')).style('font-size', '9px');
          s.selectAll('path,line').attr('stroke', view.css('ink-low'));
        });
      insetG.append('g')
        .attr('transform', `translate(${mirrorInsetRect.x + 28},0)`)
        .call(d3.axisLeft(yInset).ticks(4).tickFormat((d) => `${d}c`))
        .call((s) => {
          s.selectAll('text').attr('fill', view.css('ink-low'))
            .style('font-family', view.css('font-apparatus')).style('font-size', '9px');
          s.selectAll('path,line').attr('stroke', view.css('ink-low'));
        });

      const insetLineGen = d3.line().x((d) => xInset(new Date(d.t_iso))).y((d) => yInset(d.price_c));
      insetG.append('path').datum(norIn).attr('fill', 'none')
        .attr('stroke', 'var(--ink-hero)').attr('stroke-width', 4).attr('stroke-opacity', 0.35)
        .attr('stroke-linecap', 'round').attr('d', insetLineGen);
      insetG.append('path').datum(norIn).attr('fill', 'none')
        .attr('stroke', view.css('identity-blue')).attr('stroke-width', 2).attr('d', insetLineGen);
      const norLast = norIn[norIn.length - 1];
      insetG.append('text')
        .attr('x', xInset(new Date(norLast.t_iso)) - 4).attr('y', yInset(norLast.price_c) - 6)
        .attr('text-anchor', 'end')
        .attr('font-family', view.css('font-apparatus')).attr('font-size', '10px')
        .attr('fill', view.css('identity-blue')).text('Norway');

      if (argIn.length) {
        insetG.append('path').datum(argIn).attr('fill', 'none')
          .attr('stroke', view.css('identity-lavender')).attr('stroke-width', 2).attr('d', insetLineGen);
        const argLast = argIn[argIn.length - 1];
        insetG.append('text')
          .attr('x', xInset(new Date(argLast.t_iso)) - 4).attr('y', yInset(argLast.price_c) - 6)
          .attr('text-anchor', 'end')
          .attr('font-family', view.css('font-apparatus')).attr('font-size', '10px')
          .attr('fill', view.css('identity-lavender')).text('Argentina');
      }
    }

    // Zone K's one occupant for this scene (CR-9 wording, updated for the
    // corrected shape: Norway climbs while Egypt leads, then both drift
    // back -- not a one-way "Norway rising" that the full minute record
    // does not actually hold at the window's end).
    const mirrorCaption = pinnedCaption(
      container,
      'Norway climbs while Argentina falls. Same road, opposite ends.',
      's09-mirror-caption',
    ).style('left', `${scales.mirrorMainRect.x}px`).style('top', `${scales.mirrorMainRect.y - 32}px`)
      .style('display', 'none');

    function step(beatId) {
      const showTriptych = beatId === 'b1' || beatId === 'b2';
      roadG.style('display', showTriptych ? null : 'none');
      TEAMS.forEach((cfg) => laneGs[cfg.code].style('display', showTriptych ? null : 'none'));
      if (showTriptych) {
        const showAnno = beatId === 'b2';
        TEAMS.forEach((cfg) => laneAnnoGs[cfg.code].style('display', showAnno ? null : 'none'));
      }
      const showMirror = beatId === 'b3';
      mirrorMainG.style('display', showMirror ? null : 'none');
      markerG.style('display', showMirror ? null : 'none');
      insetG.style('display', showMirror ? null : 'none');
      mirrorCaption.style('display', showMirror ? null : 'none');
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
        team would play next, every price on that new road moves, even if
        the team itself did nothing that day. Call this path math: a ticket
        prices the whole road ahead, not just today's game.</p>
        <p>Look at Paraguay's own road above. Germany stood in its way,
        then lost, and the road updated on its own. Watch the same rule
        fire three times below, each on its own real day. When Germany went
        out, Paraguay's champion ticket jumped five times higher. Paraguay
        had not gotten better. Its road had gotten easier. Norway's ticket
        jumped about 3.6 times when Brazil went out. Belgium's jumped about
        two times.<sup><a href="#fn-14">14</a></sup></p>`,
      trigger: 'step',
      state: 'triptych',
      kind: 'resort',
      chip: [
        { token: 'identity-teal', glyph: 'dot', label: 'teal = Paraguay’s winner ticket' },
        { token: 'identity-blue', glyph: 'dot', label: 'blue = Norway’s' },
        { token: 'identity-pink', glyph: 'dot', label: 'pink = Belgium’s' },
      ],
      grain: { text: '1 dot = {grainUsd} traded again · this is the whole tournament · it never leaves', variant: 'return' },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>What happened next in each price tracked real news about
        the road ahead, not fading hype. Paraguay's price drifted once
        France was confirmed as its next opponent. Belgium's price steadied
        once a Spain quarterfinal was locked in. Norway's price kept
        climbing once England was confirmed as its own next
        game.<sup><a href="#fn-14">14</a></sup></p>
        <p>Next, zoom into one pair. Norway's price and Argentina's moved
        together in the same match.</p>`,
      trigger: 'step',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>The clearest proof is Norway. That is the team from the
        goal scene: the Norway-Brazil match, the one with Haaland's second
        goal, watched tick by tick. Norway's champion ticket spiked while
        Argentina trailed Egypt, then settled back once Argentina fought
        from behind to win. Norway's price was not reacting to Norway. It
        was watching Argentina's match, minute by minute, on the chart
        below.<sup><a href="#fn-14">14</a></sup> Neither market was copying
        the other. Both were doing the same path math: trouble for one
        contender is a little good news for everyone else.</p>
        <p>A price is a bet on the road still ahead, not a grade on the
        game just played. Argentina, tonight's team, is priced the same way
        right now: by the one match left on its road.</p>
        <div class="act-close scrim-card">
          <p><strong>Skill unlocked:</strong> when a price moves, ask what
          changed on the road still ahead, not just what happened in
          today's game. A jump means the news landed all at once. A slow
          drift can be that same news, working itself out one trade at a
          time.</p>
          <p><strong>The receipt:</strong> every clean spike of this
          tournament held. Every famous "panic" turned out to be the wrong
          ticket talking, or path math.</p>
        </div>`,
      trigger: 'step',
      state: 'mirror',
      kind: 'resort',
      chip: [
        { token: 'identity-blue', glyph: 'dot', label: 'blue = Norway, spikes while Egypt leads' },
        { token: 'identity-lavender', glyph: 'dot', label: 'lavender = Argentina, nearly out for ninety minutes' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      overlayStep: 'b3',
    },
  ],

  reducedMotion: {
    // Step-triggered: each end state (triptych/mirror) is already
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
      // Gate-5 provenance audit (WRONG_SCOPE): a fixed [0,100] domain
      // crushes Norway's whole climb (0.1-10.8c lifetime) into the bottom
      // ~11% of the panel -- the same "amplitude-crushed" defect class the
      // main S9 scene's own multiples-of-baseline axis was built to fix,
      // reproduced here in the one place (this recap) that still plots
      // raw price_band cents. One pass over the two teams' own plotted
      // dots finds the tight ceiling this specific mirror actually needs.
      let mirrorMaxPriceBand = 0;
      for (let i = 0; i < N; i++) {
        const isNorOrArg = (pop.team[i] === norIdx || pop.team[i] === argIdx) && pop.family[i] === famIdx;
        if (isNorOrArg && pop.price_band[i] !== 255 && pop.price_band[i] > mirrorMaxPriceBand) {
          mirrorMaxPriceBand = pop.price_band[i];
        }
      }
      const y = d3.scaleLinear().domain([0, Math.max(mirrorMaxPriceBand * 1.15, 1)])
        .range([rect.y + rect.h - 8, rect.y + 8]);
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
