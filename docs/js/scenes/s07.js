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
 * FIX-PASS (Gate-5 blind-review re-audit, scored 5.5/10): seven defects
 * closed here, all data-derived, none touching docs/data/scenes/s07.json:
 *   1. The friction band (b4) now anchors on the median Kalshi NOR-leg
 *      price in [t0+120s, t0+300s] -- the post-jump SETTLED level -- not
 *      the first tick >=+5s (mid-jump).
 *   2. The band no longer silently crosses the unmarked second repricing
 *      (~t0+620s, verified against the raw NOR-leg tape: a 78c->97c move
 *      inside one 10s bucket, matched independently in events_matched.parquet
 *      as a tie-leg event at t0+600s). The band now ends at the first
 *      bucket-to-bucket jump too large to be tick noise, and that cliff
 *      gets a plain, cause-agnostic label -- "what moved is certain, why it
 *      moved is not" stays true here too.
 *   3. The Kalshi lane only draws NOR-leg (Norway-win) ticks now -- this
 *      tile also carries the BRA-win and draw legs under the same
 *      ZOOM_NORBRA tag, which were rendering in the same cyan with no way
 *      to tell them apart. All three lanes get a labeled 0-100c price axis.
 *   4. fadeCaption no longer overlaps raceCaption (Zone K's 40px headroom
 *      cannot hold two stacked caption chips). Exclusion-rect measurement
 *      also ruled out simply stacking it in Zone F below mechanismCaption:
 *      at this piece's own 1440x900 review viewport that chip's own single
 *      line already lands a few px from the frame's bottom edge, so a
 *      second stacked chip rendered entirely off-screen -- invisible, not
 *      merely tight. fadeCaption's message moved into the K lane's own open
 *      canvas space instead (b4-only, the same "text where the reader's eye
 *      already is" treatment b2's darkness-block label already uses), which
 *      also required a real, readable price trace in that lane -- see 8.
 *   5. b3's stale "119 seconds" (an older cut of this same number) now
 *      reads 109, agreeing with b2's own twelve-plus-ninety-eight-second
 *      arithmetic and the shipped suspend_end_s.
 *   6. The Pinnacle darkness block was a pale 0.35-alpha wash of a
 *      mid-luminance grey over a near-black canvas -- it read brighter than
 *      the background it was supposed to be "going dark" against. It is now
 *      a bg-canvas-based diagonal hatch (the s05/s11 "no longer quoting"
 *      convention), and the goal singleton (b1's cue point) now sits at the
 *      real traded price at the detector-anchored goal tick instead of a
 *      fixed pixel offset with no data behind it.
 *   7. Every beat-triggered reveal (the goal mark, both Pinnacle layers, the
 *      Polymarket blocks, the friction band, every caption) now fades or
 *      recolors on the standard overlay-draw-in / recolor-min tween instead
 *      of an instant display:none/null toggle, with a reduced-motion
 *      snap-to-final-state fallback, matching the rest of the piece.
 *   8. Added along the way (chart-first doctrine, s01.js/s08.js precedent
 *      for the identical failure mode): a thin D3 line traces the Kalshi
 *      NOR leg's own price, built straight from the zoom tile. At only
 *      ~100 promoted population dots spread across a 2000-second-wide
 *      lane, the raw dots alone never composited above the resting field's
 *      noise floor -- there was no way to confirm fixes #1, #2, or #6 sat
 *      on a real price at all. The dots stay underneath as texture; the
 *      line carries the signal.
 *
 * RE-BLIND FIX (item 9, this pass): a second blind read caught the cyan
 * NOR-leg line poking through the amber band's own top edge for the back
 * half of the drawn window -- the chart visibly contradicted b4's "held
 * within about two cents" line even after fix #2 above. Diagnosis, checked
 * directly against the raw NOR-leg tape (leg=1 in zoom/norbra.bin): fix #2's
 * band-end rule (first single-bucket jump >=8c) is the wrong test for what
 * the band promises. It correctly catches the ~t0+620s cliff (the matched
 * tie-leg event at t0+600s, events_matched.parquet -- unchanged, still
 * marked by its own dashed line and "a second jump follows" label), but it
 * is blind to a slower, un-jumpy climb that starts at t0+290s: 10s-bucket
 * medians drift from 63c to 78c between +290s and +610s, never snapping
 * back, so the line clears the level's +-2c corridor for ~330s before the
 * cliff ever fires and the old code kept drawing the band across all of it.
 * The level itself (median in [+120s,+300s] = 62c) was never the problem.
 * Fix: the band's own right edge is now defined by the one test that cannot
 * contradict it -- scan every 10s bucket forward from +120s and take the
 * LAST one still inside [level-2, level+2]; the band ends the very next
 * bucket (+290s here, not +620s). The +620s cliff marker is untouched and
 * independent -- the band can honestly end 330 seconds before it, and does.
 * b4's prose was not the overclaim (it never named a duration on-screen;
 * footnote 12's own thirty-minute horizon is a separate, dataset-wide
 * measure, not a claim about this one vehicle's full window) -- the drawn
 * shape was. See computeFrictionWindow() below.
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
    .style('opacity', 0) // FIX #7: opacity-driven onset, never a display toggle
    .text(text);
}
function findLegIndex(legs, venue, team) {
  if (!legs) return -1;
  return legs.findIndex((l) => l.venue === venue && l.team === team);
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

    const x = registry.get('s07.x');
    const yK = registry.get('s07.yK');
    const kalshiRgba = colorOf(view.tokens, 'venue-kalshi');

    const bit = data.flagBit('ZOOM_NORBRA');
    const tagged = indicesWithFlag(pop.flags, bit);
    const D = tagged.length;
    const tile = data.zoom.norbra;
    const spec = manifest.zoom.norbra;

    // FIX #3 (Gate-5 blind-review, critical): ZOOM_NORBRA tags every Kalshi
    // trade on this fixture -- Brazil-win, Norway-win, AND the draw leg --
    // because that is every Kalshi trade the tape recorded here. This scene
    // commits to one vehicle, Norway's leg (the one Haaland's goal moves),
    // exactly the leg build_s07_scene() already restricts the Pinnacle and
    // Polymarket lanes to. Drawing all three legs into one undifferentiated
    // cyan lane mixed a ~65-cent NOR tick with a same-instant BRA/TIE tick
    // with no way to tell them apart and no price scale to check against.
    // Only NOR-leg rows get promoted into the Kalshi story lane below; the
    // BRA/TIE-tagged particles stay exactly where the loop above already
    // put them (the dimmed resting field) -- still on screen, still counted
    // in the grain plate, just not part of this beat's story.
    const norLegIdx = spec && spec.legs ? findLegIndex(spec.legs, 'kalshi', 'NOR') : -1;
    const kalshiLegIdxs = new Set();
    if (spec && spec.legs) spec.legs.forEach((l, i) => { if (l.venue === 'kalshi') kalshiLegIdxs.add(i); });

    const norRows = [];
    let kalshiTotalRows = 0;
    if (tile) {
      for (let r = 0; r < tile.count; r++) {
        if (!kalshiLegIdxs.has(tile.leg[r])) continue;
        kalshiTotalRows++;
        if (tile.leg[r] === norLegIdx) norRows.push(r);
      }
    }
    const Dnor = (D && kalshiTotalRows && norRows.length)
      ? Math.min(D, Math.max(1, Math.round(D * (norRows.length / kalshiTotalRows))))
      : 0;
    const runtimeStride = Dnor ? Math.max(1, Math.ceil(norRows.length / Dnor)) : 1;

    const goalTs = (data.scene && data.scene.event && data.scene.event.goal_ts)
      ? new Date(data.scene.event.goal_ts).getTime()
      : (tile ? tile.t0 : 0);

    for (let i = 0; i < Dnor; i++) {
      const row = norRows[Math.min(i * runtimeStride, norRows.length - 1)];
      const di = tagged[i];
      const ts = tile.t0 + tile.ts_ms[row];
      const tS = (ts - goalTs) / 1000;
      state.x[di] = x(Math.max(CLOCK_DOMAIN_S[0], Math.min(CLOCK_DOMAIN_S[1], tS)));
      state.y[di] = yK(tile.price_c[row]);
      setColor(state.color, di, kalshiRgba); // color: venue (this scene's exception; see design-system §9 S7)
      state.size[di] = baseSize; // all lanes assemble together on step 1; no reveal-by-size here
    }

    return { states: { assembled: state } };
  },

  overlay(container, data, view, scales) {
    const { x, yK, yP, yM, laneTop, laneH } = scales;
    const tokens = view.tokens;
    const g = container.svg;

    const T = tokens.motion.durations_ms;
    const drawIn = T['overlay-draw-in'];
    const recolorMs = T['recolor-min'];
    // FIX #7: onset/transition helpers, replacing every instant
    // display:none/null toggle in this scene. Reduced motion snaps straight
    // to the final value (engine's own §3.5 crossfade contract); full
    // motion tweens on the shared overlay-draw-in / recolor-min tokens.
    function fadeIn(sel, ms) {
      if (view.reducedMotion) sel.style('opacity', 1);
      else sel.transition().duration(ms || drawIn).style('opacity', 1);
    }
    function tweenStyle(sel, prop, value, ms) {
      if (view.reducedMotion) sel.style(prop, value);
      else sel.transition().duration(ms || recolorMs).style(prop, value);
    }
    function tweenAttr(sel, attr, value, ms) {
      if (view.reducedMotion) sel.attr(attr, value);
      else sel.transition().duration(ms || recolorMs).attr(attr, value);
    }

    const goalTs = (data.scene && data.scene.event && data.scene.event.goal_ts)
      ? new Date(data.scene.event.goal_ts).getTime()
      : (data.zoom.norbra ? data.zoom.norbra.t0 : 0);
    const norLegIdx = (data.manifest && data.manifest.zoom.norbra && data.manifest.zoom.norbra.legs)
      ? findLegIndex(data.manifest.zoom.norbra.legs, 'kalshi', 'NOR') : -1;

    // Shared clock axis (the anti-race guarantee lives in the glyphs and
    // the pinned caption below, NOT in de-aligning the lanes -- the
    // suspend-and-repost story needs one time base).
    //
    // Layout-audit fix (1280x800 + 1512x945, every s07 stop): the old
    // fixed `y = 28` BASELINE put this axis title's rendered box 4px into
    // the "+800s"/"+1000s" tick labels' boxes. Same defect class s01.js's
    // placeClockTitle() already closed, so this reuses its idiom -- the
    // title's TOP edge derives from the axis group's own rendered bbox
    // plus the standard annotation standoff token, so the two boxes
    // cannot intersect at any viewport width and no width-specific
    // constant is needed. One extra constraint s01 does not have:
    // mechanismCaption's Zone F slot top sits at region bottom + 44
    // (below) and shares this title's x-range at narrow desktop widths,
    // so the title cannot simply drop into the freed space. Instead the
    // axis group moves up (+8 -> +4) and the tick glyphs shrink
    // (tickSize 4 / tickPadding 2) so the full standoff fits INSIDE the
    // caption slot's own 44px budget, clear on both sides.
    const axisOriginY = view.region.y + view.region.h + 4;
    const axisG = g.append('g')
      .attr('transform', `translate(0,${axisOriginY})`)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisBottom(x).ticks(8).tickSize(4).tickPadding(2)
        .tickFormat((d) => `${d >= 0 ? '+' : ''}${d}s`));
    const titleStandoff = tokens.layout['annotation-leader-standoff-px'];
    // Fallback = the depth this axis draws by construction (tick line 4 +
    // padding 2 + d3's 0.71em shift of 12px micro text), used only if the
    // svg were detached and getBBox could not measure -- not a live path:
    // the overlay svg is always rendered when overlay() runs (same note
    // as s01.js's placeClockTitle()).
    let axisDepth = 15;
    try {
      const abb = axisG.node().getBBox();
      if (abb && abb.height > 0) axisDepth = abb.y + abb.height;
    } catch (e) { /* keep fallback */ }
    const axisTitle = g.append('text').attr('class', 'axis-title')
      .attr('x', view.region.x + view.region.w / 2)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)')
      .text('seconds after the goal');
    // Placed by the title's own measured box, keeping the alphabetic
    // baseline (no dominant-baseline:hanging, whose per-font offset
    // varies enough to reopen the same graze): with y=0 the bbox top is
    // -ascent, so baseline = top-target + ascent puts the measured TOP
    // edge exactly axisDepth + standoff below the axis origin.
    let titleAscent = 11; // caption-size ink ascent, fallback only
    try {
      const tbb = axisTitle.node().getBBox();
      if (tbb && tbb.height > 0) titleAscent = -tbb.y;
    } catch (e) { /* keep fallback */ }
    axisTitle.attr('y', axisOriginY + axisDepth + titleStandoff + titleAscent);

    // FIX #3: a labeled 0-100c price axis per lane (same d3.axisLeft-in-the-
    // left-margin idiom s08.js already ships), so "plus or minus 2 cents"
    // (b4) has a visual referent instead of a bare number. Tick format
    // carries its own unit (cents), so no separate axis title competes with
    // the venue lane label sitting just inside the same left edge.
    [laneTop.K, laneTop.P, laneTop.M].forEach((top) => {
      const yScale = top === laneTop.K ? yK : (top === laneTop.P ? yP : yM);
      g.append('g').attr('transform', `translate(${view.region.x - 8},0)`)
        .attr('font-family', 'var(--font-apparatus)')
        .attr('font-size', 'var(--type-micro-size)')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}¢`));
    });

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
    // FIX #3: names the single leg this lane now draws (was "every trade",
    // silently mixing three legs' prices in one hue with no way to tell
    // them apart).
    laneLabel('KALSHI · every trade, the Norway ticket', laneTop.K);
    laneLabel('PINNACLE · dealer quotes', laneTop.P);
    laneLabel('POLYMARKET · one block = one minute', laneTop.M);

    g.append('line').attr('x1', x(0)).attr('x2', x(0))
      .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
      .attr('stroke', 'var(--ink-mid)').attr('stroke-width', 1).attr('stroke-dasharray', '1,3');

    // Chart-first line for the Kalshi lane (same doctrine s01.js/s08.js
    // already use for exactly this failure mode, design-review C2): this
    // match's NOR leg gets only ~100 promoted population dots spread across
    // a 2000-second-wide lane -- at rest opacity that sparse a set never
    // composites above the field's own noise floor, so nothing here would
    // otherwise show a reader whether the friction band (b4) or the goal
    // singleton (b1) sit on a real price at all. Built straight from the
    // zoom tile's own NOR-leg rows, never fabricated; the population dots
    // stay underneath as texture.
    function buildNorLinePoints(maxPts) {
      const tile = data.zoom.norbra;
      if (!tile || norLegIdx < 0) return [];
      const rows = [];
      for (let r = 0; r < tile.count; r++) if (tile.leg[r] === norLegIdx) rows.push(r);
      if (!rows.length) return [];
      const stride = Math.max(1, Math.ceil(rows.length / maxPts));
      const pts = [];
      for (let i = 0; i < rows.length; i += stride) {
        const r = rows[i];
        pts.push({ tS: (tile.t0 + tile.ts_ms[r] - goalTs) / 1000, price: tile.price_c[r] });
      }
      const rLast = rows[rows.length - 1];
      const lastTs = (tile.t0 + tile.ts_ms[rLast] - goalTs) / 1000;
      if (!pts.length || pts[pts.length - 1].tS !== lastTs) pts.push({ tS: lastTs, price: tile.price_c[rLast] });
      return pts;
    }
    const norLinePts = buildNorLinePoints(600);
    const kalshiLineGen = d3.line()
      .x((d) => x(Math.max(CLOCK_DOMAIN_S[0], Math.min(CLOCK_DOMAIN_S[1], d.tS))))
      .y((d) => yK(d.price));
    const kalshiLine = g.append('path')
      .attr('fill', 'none').attr('stroke', 'var(--venue-kalshi)')
      .attr('stroke-width', 1.5).attr('stroke-linecap', 'round')
      .attr('d', norLinePts.length > 1 ? kalshiLineGen(norLinePts) : null)
      .style('opacity', 0);

    // FIX #6: the goal singleton (b1's cue point) now anchors at the real
    // Kalshi NOR-leg tick the build pipeline already flags as the
    // detector-anchored goal event (tile.flags bit 0, the same convention
    // s08.js uses for its shootout kicks), not a fixed pixel offset with no
    // data behind it. Falls back to the axis's t=0 / a nominal lane
    // position only if the tile isn't loaded yet.
    function findGoalTick() {
      const tile = data.zoom.norbra;
      if (!tile || norLegIdx < 0) return null;
      for (let r = 0; r < tile.count; r++) {
        if (tile.leg[r] === norLegIdx && (tile.flags[r] & 1)) {
          return { tS: (tile.t0 + tile.ts_ms[r] - goalTs) / 1000, price: tile.price_c[r] };
        }
      }
      return null;
    }
    const goalTick = findGoalTick();
    const goalMarkX = goalTick ? x(Math.max(CLOCK_DOMAIN_S[0], Math.min(CLOCK_DOMAIN_S[1], goalTick.tS))) : x(0);
    const goalMarkY = goalTick ? yK(goalTick.price) : laneTop.K + 42;

    const goalLabel = (data.scene && data.scene.event && data.scene.event.label) || 'the goal';
    const goalMark = g.append('g').style('opacity', 0);
    // b1's amber unit: halo + ink-hero core. At b2 the halo recolors to
    // ink-mid (the core stays as the at-mark anchor) so amber stays a true
    // singleton once the darkness block claims the beat's amber unit.
    const goalMarkSel = drawSingleton(goalMark, goalMarkX, goalMarkY, tokens, goalLabel);

    // Pinnacle: requote dashes (a visibly different glyph from Kalshi's
    // circles) + the darkness block.
    const pinG = g.append('g').attr('class', 's07-pinnacle').style('opacity', 0);
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
        // FIX #6 (Gate-5 blind-review, major): a 0.35-alpha wash of
        // venue-pinnacle-terminated (a mid-luminance grey, #6B7480) over
        // the near-black canvas (#0B0E13) composites LIGHTER than the
        // background it sits on -- "it goes dark" rendered as a pale
        // column. Restyled as the s05.js / s11.js diagonal-hatch "no
        // longer quoting" convention: a bg-canvas base (matches the true
        // background, not a wash over it) with sparse venue-hued hatch
        // lines, so the block reads as a void, not a highlight.
        const hatchId = 's07-suspend-void';
        const hatchDefs = pinG.append('defs');
        hatchDefs.append('pattern').attr('id', hatchId)
          .attr('width', 7).attr('height', 7)
          .attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)')
          .call((p) => {
            p.append('rect').attr('width', 7).attr('height', 7).attr('fill', 'var(--bg-canvas)');
            p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 7)
              .attr('stroke', 'var(--venue-pinnacle-terminated)').attr('stroke-width', 2)
              .attr('stroke-opacity', 0.9);
          });
        darknessRect = pinG.append('rect')
          .attr('x', x(s0)).attr('width', Math.max(0, x(s1) - x(s0)))
          .attr('y', laneTop.P).attr('height', laneH)
          .attr('fill', `url(#${hatchId})`)
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
    const polyG = g.append('g').attr('class', 's07-polymarket').style('opacity', 0);
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

    // Zone K, one slot: race caption (b1, current) recedes to ink-mid at
    // b2 and stays pinned per R23 -- it is never removed, only demoted, so
    // the prohibition is never off screen once taught.
    const raceCaption = pinnedCaption(
      container,
      'Three lanes, three native speeds. This is not a race.',
      's07-race-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y - 40}px`)
      .style('color', 'var(--ink-hi)');

    const mechanismCaption = pinnedCaption(
      container,
      'Kalshi keeps trading. The sportsbook stops, then reposts.',
      's07-mechanism-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y + view.region.h + 44}px`);

    // FIX #4 (Gate-5 blind-review, major): fadeCaption used to sit at
    // region.y-14, INSIDE raceCaption's own box (region.y-40, ~36px tall) --
    // a hard overlap, not a stack. Zone K's headroom above the stage is only
    // 40px (not enough to stack two ~36px chips with any gap), and Zone F
    // below the stage measured out to almost no headroom either at the
    // review's own 1440x900 capture viewport (mechanismCaption's own single
    // line already lands within a few px of the frame's bottom edge; a
    // second stacked chip there rendered entirely below y=900, invisible,
    // not merely tight -- exclusion-rect measurement caught this before it
    // shipped). fadeCaption's message moves into the K lane's own open
    // canvas space instead (built inside bandG below, b4-only, same
    // treatment the darkness-block's "no longer quoting" label already
    // gets: text where the reader's eye already is, not a third pinned
    // caption competing for two fixed slots).

    // Friction band: +-2c around the post-jump SETTLED level, drawn from
    // the Kalshi NOR-leg tile itself, never fabricated. Stroke-only (no
    // amber fill wash across three lanes, perception-brief-driven fix).
    const bandG = g.append('g').attr('class', 's07-friction').style('opacity', 0);

    // FIX #1 (Gate-5 blind-review, CRITICAL): the old anchor was the first
    // tick >=+5s after the goal -- mid-jump, not settled -- so the drawn
    // band contradicted the prose's own "held within 2 cents" claim. The
    // level below is the median NOR-leg price in [t0+120s, t0+300s], the
    // settled-level convention this fix was asked to use. Unchanged by the
    // re-blind fix that follows -- the level was never the defect.
    //
    // FIX #2, corrected on re-blind (item 9, this pass): the band's own
    // right edge must be defined by the same test the band visually makes
    // ("is the line still inside this corridor?"), not by an unrelated
    // large-jump heuristic. A single-bucket jump test (kept below as
    // CLIFF_JUMP_C, now only for the separate cliff marker) correctly
    // catches the abrupt +-620s repricing but is blind to a slower climb:
    // the raw tape drifts from 63c to 78c between +290s and +610s, one
    // bucket at a time, never snapping back inside the corridor again --
    // exactly the escape a second blind read caught, since the old code
    // kept the band drawn (and claiming "held") straight through that
    // drift. Fix: scan every 10s bucket forward from the settle window and
    // find the LAST one still inside [level-band, level+band]; the band
    // ends the very next bucket. That definition cannot itself be
    // contradicted by the line drawn over it, by construction.
    //
    // The +620s cliff itself is untouched: still the first bucket-to-bucket
    // jump too large to be tick noise, still matches the second matched
    // event in events_matched.parquet at t0+600s on the draw leg (same
    // episode, different angle), still gets its own dashed line and plain,
    // cause-agnostic "a second jump follows" label -- consistent with this
    // scene's own "what moved is certain, why it moved is not" rule (b3's
    // insurance line). It is simply no longer what decides where the band
    // stops; the band can honestly end ~330s before the cliff, and does.
    function computeFrictionWindow(bandC) {
      const tile = data.zoom.norbra;
      if (!tile || norLegIdx < 0) return null;
      const rows = [];
      for (let r = 0; r < tile.count; r++) {
        if (tile.leg[r] !== norLegIdx) continue;
        rows.push({ tS: (tile.t0 + tile.ts_ms[r] - goalTs) / 1000, price: tile.price_c[r] });
      }
      const bandStartS = 120;
      const settleWindow = rows.filter((d) => d.tS >= bandStartS && d.tS <= 300)
        .map((d) => d.price).sort((a, b) => a - b);
      if (!settleWindow.length) return null;
      const level = settleWindow[Math.floor(settleWindow.length / 2)];

      const buckets = new Map();
      rows.forEach((d) => {
        if (d.tS < bandStartS) return;
        const b = Math.floor(d.tS / 10);
        if (!buckets.has(b)) buckets.set(b, []);
        buckets.get(b).push(d.price);
      });
      const bucketKeys = [...buckets.keys()].sort((a, b) => a - b);
      const medianOf = (b) => {
        const arr = buckets.get(b).slice().sort((p, q) => p - q);
        return arr[Math.floor(arr.length / 2)];
      };

      // Band end: the bucket after the LAST one still inside the corridor,
      // scanned across the whole tail (not just up to the first excursion)
      // so a brief blip that later returns inside (there is one, ~+140-165s)
      // cannot end the band early, and a real, permanent departure (from
      // +290s on, never inside again before the cliff) cannot be missed.
      let lastInsideB = null;
      bucketKeys.forEach((b) => {
        const med = medianOf(b);
        if (med >= level - bandC && med <= level + bandC) lastInsideB = b;
      });
      const bandEndS = lastInsideB !== null ? (lastInsideB + 1) * 10 : bandStartS;

      // Cliff marker only (FIX #2, original): first single-bucket jump
      // several times the settling window's own end-to-end spread, checked
      // only after the settle window closes.
      const CLIFF_JUMP_C = 8;
      let cliffS = null;
      let prevMedian = null;
      for (const b of bucketKeys) {
        const med = medianOf(b);
        if (b * 10 > 300 && prevMedian !== null && Math.abs(med - prevMedian) >= CLIFF_JUMP_C) {
          cliffS = b * 10;
          break;
        }
        prevMedian = med;
      }
      return { level, bandStartS, bandEndS, breakoutS: cliffS };
    }

    function step(beatId) {
      if (beatId === 'b1') {
        fadeIn(kalshiLine);
        fadeIn(goalMark);
        fadeIn(raceCaption);
      }
      if (beatId === 'b2') {
        fadeIn(pinG);
        // Amber stays a singleton: the goal mark's halo recolors to
        // ink-mid the moment the darkness block claims the beat's amber
        // unit; the core stays as the at-mark anchor.
        tweenAttr(goalMarkSel.select('circle'), 'stroke', 'var(--ink-mid)');
        // Race caption recedes (stays pinned per R23, just quieter).
        tweenStyle(raceCaption, 'color', 'var(--ink-mid)');
      }
      if (beatId === 'b3') {
        fadeIn(polyG);
        mechanismCaption.style('color', 'var(--ink-mid)');
        fadeIn(mechanismCaption);
      }
      if (beatId === 'b4') {
        const band = (data.scene && data.scene.friction_band_c) || 2;
        const win = computeFrictionWindow(band);
        bandG.selectAll('*').remove();
        if (win) {
          const bx0 = x(win.bandStartS);
          const bx1 = x(win.bandEndS);
          bandG.append('rect')
            .attr('x', bx0).attr('width', Math.max(0, bx1 - bx0))
            .attr('y', yK(Math.min(100, win.level + band)))
            .attr('height', Math.max(1, yK(Math.max(0, win.level - band)) - yK(Math.min(100, win.level + band))))
            .attr('fill', 'none')
            .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', 1);
          // MOBILE-AUDIT FIX (390x844 DOM-geometry round): end-anchored at
          // bx1 - 6, this label's ~200px box ran 96px past the viewport's
          // LEFT edge -- the band's right edge sits at x~113 on a 390px
          // stage, and left of it is the screen edge, not canvas. Nor can
          // the label sit to the band's right at band height: the NOR
          // line's 63c->78c drift (the very escape the band-end rule
          // marks) crosses exactly that corridor, so any same-row
          // placement strikes text through the price line. On mobile the
          // label takes the one slot this audit itself proved clean at
          // this width: the right-anchored row (region right - 12,
          // laneH * 0.55) held by the "spike" message below, whose
          // strictly WIDER box measured collision-free (no pair, no edge)
          // in the same capture -- that message is mobile-dropped in its
          // own fix just after, so the row is free. Amber still binds
          // label to band: nothing else in the lane carries
          // accent-annotation once b2 demotes the goal halo to ink-mid.
          // Desktop placement is untouched.
          const frictionLabel = bandG.append('text')
            .attr('text-anchor', 'end')
            .attr('font-family', 'var(--font-apparatus)')
            .attr('font-size', 'var(--type-annotation-size)')
            .attr('fill', 'var(--accent-annotation)')
            .text('plus or minus 2 cents: friction');
          if (view.mobile) {
            frictionLabel
              .attr('x', view.region.x + view.region.w - 12)
              .attr('y', laneTop.K + laneH * 0.55);
          } else {
            frictionLabel
              .attr('x', bx1 - 6)
              .attr('y', yK(win.level) - 6);
          }
          if (win.breakoutS !== null) {
            const cliffX = x(win.breakoutS);
            bandG.append('line')
              .attr('x1', cliffX).attr('x2', cliffX)
              .attr('y1', laneTop.K).attr('y2', laneTop.K + laneH)
              .attr('stroke', 'var(--ink-low)').attr('stroke-width', 1).attr('stroke-dasharray', '2,3');
            bandG.append('text')
              .attr('x', cliffX + 6).attr('y', laneTop.K + laneH - 8)
              .attr('font-family', 'var(--font-apparatus)')
              .attr('font-size', 'var(--type-micro-size)')
              .attr('fill', 'var(--ink-low)')
              .text('a second jump follows');
          }
        }
        // FIX #4 continued: the fade message renders in the K lane's own
        // open canvas (far right, clear of the line/band/cliff marker)
        // instead of a third pinned caption -- see the note above bandG.
        //
        // MOBILE-AUDIT FIX, continued: desktop-only. At 390px the lane
        // cannot hold two right-anchored sentences without stacking their
        // boxes ~8px apart, and this is the one canvas text b4's own
        // prose already states verbatim ("The spike is the price.
        // Remember that..."), so the work order's judgment rule applies:
        // the duplicated commentary yields its measured-clean slot to the
        // friction label above (the band's referent, which prose cites --
        // "held within about two cents" -- but does not restate).
        // Desktop keeps both texts exactly as blind-reviewed.
        if (!view.mobile) {
          bandG.append('text')
            .attr('x', view.region.x + view.region.w - 12)
            .attr('y', laneTop.K + laneH * 0.55)
            .attr('text-anchor', 'end')
            .attr('font-family', 'var(--font-apparatus)')
            .attr('font-size', 'var(--type-annotation-size)')
            .attr('fill', 'var(--ink-hi)')
            .text('The spike is the price. Nothing to fade.');
        }
        fadeIn(bandG);
        tweenStyle(mechanismCaption, 'color', 'var(--ink-low)');
      }
    }

    return {
      step,
      exit() {
        g.selectAll('*').remove();
        raceCaption.remove();
        mechanismCaption.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>Three different places kept a live price on this match. Each
        one reacted differently the moment the ball hit the net. That is not
        because one crowd is smarter than another. It comes down to each
        place's own house rules: how often it lets a price move, and when it
        is willing to quote one at all. Here is a goal you will meet again:
        Haaland's second against Brazil. Haaland plays for Norway, so this is
        the Norway-Brazil match, seen through its prices.</p>
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
        dangerous. Dangerous to the bookmaker, not to anyone on the pitch.
        The moment the ball crosses the line, a quick customer could snap up
        the book's old price before it reacts, so the house pulls its number
        off the board instead of getting picked off. That is why a
        bookmaker's price vanishes at exactly the moment you would most want
        to read it.</p>
        <p>Pinnacle does exactly that here. It stops quoting about
        twelve seconds after the move begins, stays dark for roughly
        ninety-eight seconds, then reopens with one new quote already at
        its new price.<sup><a href="#fn-11">11</a></sup> Behind that pause
        sits a model built from years of matches like this one. It is
        estimating what the goal is worth: how much it moves the chance you
        learned to read as a price back in Skill 1. A goal in minute two
        barely moves that chance. The same goal in minute ninety can flip
        it.</p>
        <p>That one grey dash is the whole story. Pinnacle did not trade the
        move. It waited it out, then restated its price once, already caught
        up.</p>`,
      trigger: 'step',
      kind: 'recolor',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>A price never moves on its own. It moves when someone
        trades, and no one can trade on a goal they have not seen yet. Every
        screen shows the goal late, so the first new deals landed about
        twenty-nine seconds after the move began on Kalshi's own record. The
        machinery was never the slow part. The screens and the humans
        were.</p>
        <p>This page measured all three venues on that same clock. Kalshi's
        tape crossed one-fifth of the move by that twenty-nine-second mark.
        Polymarket's own blocks show the new price by 60 seconds, the
        soonest its one-save-per-minute design can register a change.
        Pinnacle's reopened quote lands at 109 seconds, its own
        suspend-and-repost clock finally catching up. These are three
        different measuring sticks: one that saves a price once a minute,
        one that suspends and reposts, and one that trades straight through.
        Ranking their speeds only ranks how each venue happens to record
        itself.<sup><a href="#fn-11">11</a></sup></p>
        <p>The bookmaker finds a goal's worth with a model built from
        history. The exchange finds it by auction: traders quote and trade
        until the price stops moving, and that settled level is the answer.
        Kalshi kept trading. The sportsbook stopped, then reposted. The
        exchange is the only number here that never stops talking.</p>`,
      trigger: 'step',
      kind: 'recolor',
      overlayStep: 'b3',
    },
    {
      id: 'b4',
      html: `<p>Can you trust a number that just jumped? Traders have an old
        instinct that says no: bet against sharp moves and profit when they
        snap back. Traders call it fading the move, and desks have followed
        it for as long as there have been screens to react to. This
        tournament's tape says otherwise.</p>
        <p>People did try to fade goals. Take every clean goal this
        tournament, the ones that arrived with no other news in the same
        minute: 81 of them. In the ten minutes after each one, a median of
        47 percent of the money traded on that goal's own Kalshi leg bet
        against the direction the price had just moved. The middle half of
        goals saw that share run from 27 percent to 60 percent. Traders
        showed up and bet the other way, again and again.<sup><a
        href="#fn-12">12</a></sup></p>
        <p>After each goal, the price held within about two cents of where
        the jump landed, too small a gap to clear the fees on a trade.<sup><a
        href="#fn-12">12</a></sup> The instinct was real. It just never
        paid.</p>
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
    // engine's own §3.5 instant-apply + crossfade). Overlay-side transitions
    // (FIX #7) branch on view.reducedMotion directly in overlay()'s own
    // fadeIn/tweenStyle/tweenAttr helpers.
  },
};
