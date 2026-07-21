/* docs/js/scenes/s08.js
 * S8 · Act II · "Which market you watch" (zoom)
 * storyboard.md §3 S8 · CONTRACT.md §4.2 row s08 (dual-path, scrub, zoom=gerpar)
 *
 * Vehicle: Germany-Paraguay, level after 90 (R4; settlement rule R4 honored
 * throughout). Two synchronized particle paths on one match clock: the
 * KXWCGAME GER leg (regulation) rides its 22-minute forced expiry glide to
 * the tie-locked settlement price; KXWCADVANCE holds level and trades dense
 * through the shootout for another hour. One path dies at the whistle; the
 * other lives on. Tick grain throughout ("one dot, one trade, both
 * contracts").
 *
 * Color is CONTRACT STATUS, not taker side (design-system.md audit FIX #1 /
 * §9 S8): the regulation leg fades state-expiring -> state-dead as its
 * price decays toward the tie-locked settlement value; the advancement leg
 * holds side-yes cyan throughout. The scene-local micro-legend chip reads
 * "color: contract status", never "color: taker side" -- reusing side-no
 * vermillion here would visually reinforce the naive "market abandoned
 * Germany" read the beat copy debunks.
 *
 * DATA (Gate-5 item 9, full re-derivation, fulfilled in
 * docs/data/scenes/s08.json): window.whistle_ts is the tape's own
 * terminal-pin start on the GER regulation leg (a s01-style settlement-pin
 * heuristic mirrored for a leg that settles NO), not a last-trade-minus-
 * 22min approximation -- it lands at the real final whistle, not naive
 * minute-90, so period_bands has an honest boundary to draw against.
 * window.kickoff_ts is Pinnacle's own fixture kickoff for this match
 * (_entity_map_played.parquet), shipped so the match-clock axis no longer
 * has to assume a fixed 90-minute gap back from the whistle. Shipped shape:
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "window": { "kickoff_ts": ISO, "whistle_ts": ISO, "settlement_halt_ts": ISO },
 *     "price_at_whistle_c": 1,
 *     "glide": { "start_ts": ISO, "start_price_c": 48, "end_ts": ISO, "end_price_c": 1, "duration_minutes": 22 },
 *     "glide_minutes": 22,
 *     "period_bands": [ { "key", "label", "start": ISO, "end": ISO, "method" }, ... ],
 *         // 2nd half / stoppage / break / extra_time_1 / et_break / extra_time_2 / shootout;
 *         // "method" says which boundaries are tape-verified vs rule-derived (IFAB Laws of the Game)
 *     "shootout_kicks": [ { "n", "side": "GER"|"PAR", "outcome": "make"|"miss", "ts": ISO,
 *                            "price_before_c", "price_after_c", "player"?, "decisive"? }, ... ],
 *         // 12 kicks, step-detected off shootout_ticks_JUN29GERPAR.parquet, cross-verified
 *         // against the match report's final score (Paraguay 4-3 Germany)
 *     "et_spike": { "onset_ts", "peak_ts", "peak_price_c", "resolved_ts", "baseline_price_c",
 *                    "identity", "source" }
 *         // the KXWCADVANCE-GER spike partway through extra time: Jonathan Tah's VAR-overturned goal
 *   }
 *
 * This module consumes period_bands/shootout_kicks/et_spike directly: the
 * white whistle line now sits at the real whistle instant and reads a
 * descriptive label instead of a naive "90'"; shaded, labeled period bands
 * give the reader a map of the wall-clock axis (which counts minutes
 * through breaks and extra time, not just football minutes); shootout
 * kicks are per-kick markers read live off shootout_kicks, ending in a
 * named callout on the deciding kick; the extra-time price spike is
 * annotated with its own identity. See "Gate-5 item 9" comments below at
 * each consuming call site.
 *
 * Provenance fixes carried in this pass (research/design-review/
 * provenance-ledger.md, Scene s08, items #1-#3, all previously NOT FIXED):
 *   #1 the regulation-leg color-interpolation divisor was a bare literal
 *      (50); it now reads the tile's own first tick on the regulation leg
 *      (regStartPriceC below), so a leg opening at a different price still
 *      gets a correct color ramp.
 *   #2 the match-clock axis's kickoff instant was derived as
 *      `whistleTs - 90*60000`, silently assuming zero stoppage time; it now
 *      reads window.kickoff_ts directly (Pinnacle's fixture kickoff, a
 *      class-A field independent of the whistle), falling back to the old
 *      approximation only if that field is ever missing.
 *   #3 the decay-caption figures ("7 cents a minute" / "19 to 25 cents in
 *      30 seconds") were hand-typed twice with no shared source. They are
 *      single-sourced now (R4_* constants below): the SVG caption reads
 *      them live, and pipeline/export/check_figure_sync.py's
 *      s08-decay-rate-sync / s08-goal-move-*-sync slots cross-check the
 *      beat prose's own copy against those same constants on every run.
 *
 * Blind design-review fixes (this round, scored 6.5) carried in this pass:
 *   MAJOR-1 the scrub reveal honors the shared cutoff for BOTH legs now:
 *      each keyframe carries its own alpha mask (a size-0 point sprite
 *      still rasterizes as a ~1px fragment, and the frag shader discards
 *      on alpha, so full-alpha cyan future ticks sat pre-revealed while
 *      the dimmer slate leg vanished -- asymmetric preview).
 *   MAJOR-2 every annotation gates on the scrub cutoff reaching its own
 *      STORE timestamp, never one shared whistle switch.
 *   MAJOR-3 computeCuts paces the post-whistle tape off period_bands so
 *      the shootout is fully traced by t = 0.85; the rest is dwell.
 *   MAJOR-4 the decay card moved into the regulation lane it describes,
 *      translucent, clear of the whistle line and the KEY exclusion.
 *   MINORs: the shootout band label parks below the axis when the KEY
 *      would paint over it; kick outcome is tick height (a make stands
 *      full height, a miss stops short); the regulation leg's terminal
 *      pin is labeled off price_at_whistle_c.
 *
 * Layout-audit fixes (2026-07 DOM-geometry round, s08 rows at 1280x800
 * and 1512x945): (1) the x-axis title's baseline now derives from the
 * measured bottom of the tallest tick label instead of a width-tuned
 * y=28, clearing the 120'/135'/150' tick grazes at any stage width;
 * (2) band labels are measured box-against-box with the full KEY
 * exclusion rect (the old guard checked only their left edge) and
 * either wrap to two lines in place or park below the axis on the
 * measured title row -- "extra time, second half" no longer runs under
 * the KEY panel at narrow desktop widths.
 *
 * Blind mobile-review fixes (2026-07 round, scored 5.5; main.js's
 * scrub-deep KEY retreat past 60% is assumed chrome): (HIGH) on mobile
 * the x-axis moves inside the region -- both lanes shrink to reserve a
 * 34px axis band above region bottom (== the prose sheet's top), so the
 * match clock keeps a readable scale on phones; desktop rows unchanged.
 * (MEDIUM) the amber decay plate drops to its headline line at phone
 * width (the goal-move figures stay in the guarded beat prose) and is
 * measured so its bottom clears the settlement-pin label and the ADVANCE
 * descriptor. (LOW) the Tah label row clamps on short mobile lanes so it
 * cannot reach the kick strip. The mobile grain template shortens so the
 * two-line plate keeps the match identity, tokens still live.
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
function lerpRgba(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

// R4 (ig-07)-cited cross-tournament in-game microstructure figures: the
// regulation leg's own price never decays faster than this rate; a real
// goal, by contrast, moves a price this fast. Single-sourced here so the
// pinned SVG caption (which reads these constants live) and the beat
// prose (a plain-text copy a reader scrolls past, checked by
// check_figure_sync.py's s08-decay-rate-sync / s08-goal-move-*-sync slots)
// cannot drift apart by hand again (provenance ledger, s08 #3).
const R4_DECAY_MAX_C_PER_MIN = 7;
const R4_GOAL_MOVE_LO_C = 19;
const R4_GOAL_MOVE_HI_C = 25;
const R4_GOAL_MOVE_WINDOW_S = 30;

// Shared scrub-reveal timeline (used by both layout()'s keyframes and
// overlay()'s progressive line draw, so the D3 lines and the particle
// reveal always agree on "how much of the tape has played").
// Design-review MAJOR-3: the post-whistle stretch used to be one giant
// segment (whistle+150s -> winEnd across scroll 0.55 -> 1.0), which left
// the shootout's climax untraced at 90% scroll and let a whole hour of
// future tape arrive as a single block. Extra cuts at the period
// boundaries the store itself ships (data.scene.period_bands: end of
// ET1, end of ET2 -- the tape-verified shootout start -- and the end of
// the shootout) pace the climax so the shootout is fully traced by
// t = 0.85, reserving the last stretch of track for dwell on the settled
// frame. Every cutoff is a STORE value off docs/data/scenes/s08.json;
// only the scroll pacing fractions are layout literals.
function computeCuts(whistleTs, winStartMs, winEndMs, periodBands) {
  if (!whistleTs) {
    return [
      { at: 0.0, cutoff: winStartMs },
      { at: 1.0, cutoff: winEndMs },
    ];
  }
  const bandEnd = (key) => {
    const b = (periodBands || []).find((p) => p.key === key);
    return (b && b.end) ? new Date(b.end).getTime() : null;
  };
  const cuts = [
    { at: 0.0, cutoff: winStartMs },
    { at: 0.35, cutoff: whistleTs - 30000 },
    { at: 0.55, cutoff: whistleTs + 150000 }, // the gold-coin dwell: paths visibly split
  ];
  [
    { at: 0.68, cutoff: bandEnd('extra_time_1') }, // Tah spike traced by here
    { at: 0.76, cutoff: bandEnd('extra_time_2') }, // == tape-verified shootout start
    { at: 0.85, cutoff: bandEnd('shootout') },     // climax fully traced at 0.85
  ].forEach((c) => {
    // Defensive monotonicity: a band missing from the store degrades to
    // the coarser timeline instead of a non-monotonic scrub.
    if (c.cutoff !== null && c.cutoff > cuts[cuts.length - 1].cutoff
      && c.cutoff < winEndMs) {
      cuts.push(c);
    }
  });
  cuts.push({ at: 1.0, cutoff: winEndMs });
  return cuts;
}
function cutoffAt(cuts, t) {
  if (t <= cuts[0].at) return cuts[0].cutoff;
  for (let i = 1; i < cuts.length; i++) {
    if (t <= cuts[i].at) {
      const prev = cuts[i - 1];
      const span = cuts[i].at - prev.at;
      const frac = span > 0 ? (t - prev.at) / span : 1;
      return prev.cutoff + (cuts[i].cutoff - prev.cutoff) * frac;
    }
  }
  return cuts[cuts.length - 1].cutoff;
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

function findLegIndex(legs, re) {
  if (!legs) return -1;
  return legs.findIndex((l) => re.test(l.label || '') || re.test(l.ticker || ''));
}

export default {
  id: 's08',
  act: 2,
  title: 'Which market you watch',
  kicker: 'Skill 3, continued: check which ticket is talking',
  layoutName: 'dual-path',

  needs: { scene: true, series: [], zoom: 'gerpar' },

  zoom: {
    key: 'gerpar',
    tagBit: 'ZOOM_GERPAR',
    // Blind mobile-review fix (2026-07 round): the mobile grain plate
    // clamps to two lines, and the desktop template ellipsized away
    // "Germany-Paraguay, June 29" -- the one clause naming the match.
    // A getter keyed on main.js's own mobile predicate (W < 900, read
    // live at each beat activation) serves a shorter template that keeps
    // the match identity and the live {n}/{count} tokens; interpolation
    // still runs through zoomGrainText(), so no count is ever hardcoded.
    // The window guard keeps the module parseable/importable in Node.
    get grainText() {
      const mobile = typeof window !== 'undefined' && window.innerWidth < 900;
      return mobile
        ? '1 dot = 1 trade · every {n}th of {count} · Germany-Paraguay'
        : '1 dot = 1 trade · showing every {n}th of {count} trades · Germany-Paraguay, June 29';
    },
  },

  scales(data, view) {
    const spec = data.manifest.zoom.gerpar;
    const winStart = spec ? new Date(spec.window[0]).getTime() : Date.now() - 3600000;
    const winEnd = spec ? new Date(spec.window[1]).getTime() : Date.now();
    const x = d3.scaleUtc().domain([winStart, winEnd])
      .range([view.region.x, view.region.x + view.region.w]);
    // Blind mobile-review fix (2026-07 round, HIGH): the x-axis used to
    // hang below region bottom (+8), which on the phone stage is exactly
    // where the prose sheet starts (region bottom == sheet top, 62vh) --
    // the piece's organizing match clock had no readable scale at all.
    // On mobile the axis is budgeted INSIDE the region: both lanes give
    // up half of a 34px axis band (ticks + title, compacted in overlay())
    // that sits above region bottom. Desktop: axisBandH = 0, geometry
    // byte-identical to the pre-fix layout.
    const axisBandH = view.mobile ? 34 : 0;
    const plotH = view.region.h - axisBandH;
    const laneH = plotH / 2;
    const pad = laneH * 0.1;
    const yReg = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + laneH - pad, view.region.y + pad]);
    const yAdv = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + 2 * laneH - pad, view.region.y + laneH + pad]);
    registry.register('s08.x', x);
    registry.register('s08.yReg', yReg);
    registry.register('s08.yAdv', yAdv);
    return {
      x, yReg, yAdv, laneH, plotH,
      laneTop: { reg: view.region.y, adv: view.region.y + laneH },
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

    const x = registry.get('s08.x');
    const yReg = registry.get('s08.yReg');
    const yAdv = registry.get('s08.yAdv');

    const expiring = particleState(view.tokens, 'expiring');
    const dead = particleState(view.tokens, 'dead');
    const advColor = colorOf(view.tokens, 'side-yes');

    const bit = data.flagBit('ZOOM_GERPAR');
    const tagged = indicesWithFlag(pop.flags, bit);
    const D = tagged.length;
    const tile = data.zoom.gerpar;
    const spec = manifest.zoom.gerpar;
    const T = tile ? tile.count : 0;

    let regIdx = -1; let advIdx = -1;
    if (spec && spec.legs) {
      advIdx = findLegIndex(spec.legs, /advance/i);
      regIdx = spec.legs.findIndex((l, i) => i !== advIdx);
    }

    // Partition tile rows by leg, proportional D allocation, each leg
    // sampled at its own runtime stride (CONTRACT §4.3 formula, per leg).
    const regRows = []; const advRows = [];
    if (tile) {
      for (let r = 0; r < T; r++) {
        if (tile.leg[r] === regIdx) regRows.push(r);
        else if (tile.leg[r] === advIdx) advRows.push(r);
      }
    }
    const Dreg = T ? Math.round(D * (regRows.length / T)) : 0;
    const Dadv = D - Dreg;

    // Provenance fix (ledger s08 #1): the color ramp used to divide by a
    // bare literal (50) that merely happened to sit near this leg's real
    // opening level. It now reads the tile's own first tick on the
    // regulation leg -- the rows are time-ordered (build_tiles.py sorts
    // the whole tile by ts_ms before slicing), so regRows[0] is that
    // leg's earliest print inside this zoom window. A leg that opened at
    // a materially different price gets a correct ramp instead of a
    // silently wrong one.
    const regStartPriceC = (tile && regRows.length) ? tile.price_c[regRows[0]] : 100;

    const tickTs = new Float64Array(D);
    const tickLeg = new Uint8Array(D); // 0 = regulation, 1 = advancement

    function place(rows, count, offset, legFlag, yScale) {
      if (!count || !rows.length) return;
      const stride = Math.max(1, Math.ceil(rows.length / count));
      for (let i = 0; i < count; i++) {
        const row = rows[Math.min(i * stride, rows.length - 1)];
        const di = tagged[offset + i];
        const ts = tile.t0 + tile.ts_ms[row];
        tickTs[offset + i] = ts;
        tickLeg[offset + i] = legFlag;
        state.x[di] = x(ts);
        state.y[di] = yScale(tile.price_c[row]);
        if (legFlag === 0) {
          const t = Math.max(0, Math.min(1, 1 - tile.price_c[row] / Math.max(1, regStartPriceC)));
          setColor(state.color, di, lerpRgba(expiring, dead, t));
        } else {
          setColor(state.color, di, advColor);
        }
        state.size[di] = 0; // hidden until reveal keyframe
      }
    }
    place(regRows, Dreg, 0, 0, yReg);
    place(advRows, Dadv, Dreg, 1, yAdv);

    const whistleTs = (data.scene && data.scene.window && data.scene.window.whistle_ts)
      ? new Date(data.scene.window.whistle_ts).getTime() : null;
    const winStartMs = spec ? new Date(spec.window[0]).getTime() : null;
    const winEndMs = spec ? new Date(spec.window[1]).getTime() : null;

    const cuts = computeCuts(whistleTs, winStartMs, winEndMs,
      data.scene && data.scene.period_bands);

    // Design-review MAJOR-1: size-0 was the only thing hiding unrevealed
    // ticks, but GL rasterizes a size-0 point sprite as a ~1px fragment
    // and the frag shader discards on ALPHA, not size -- so the advance
    // leg's full-alpha cyan future (Tah spike, final collapse) sat
    // pre-revealed as faint dots while the dimmer slate leg showed
    // nothing (asymmetric preview). Chosen fix: honor the shared cutoff
    // for BOTH legs -- each keyframe carries its own color buffer with
    // alpha 0 on every tick past that keyframe's cutoff, so at any
    // interpolated t only the segment currently arriving fades in and
    // nothing beyond it draws at all, in either lane.
    let lastTickMs = 0;
    for (let i = 0; i < D; i++) if (tickTs[i] > lastTickMs) lastTickMs = tickTs[i];
    const states = {};
    const keyframes = [];
    cuts.forEach((c, ci) => {
      const key = `k${ci}`;
      const fullyRevealed = c.cutoff >= lastTickMs;
      const s = {
        x: state.x,
        y: state.y,
        // A fully-revealed frame masks nothing; share the base buffer
        // instead of copying another N*4 floats.
        color: fullyRevealed ? state.color : new Float32Array(state.color),
        size: new Float32Array(N),
      };
      s.size.set(state.size);
      for (let i = 0; i < D; i++) {
        if (!tickTs[i]) continue; // tile missing: keep the rest-field look
        if (tickTs[i] <= c.cutoff) s.size[tagged[i]] = baseSize;
        else s.color[tagged[i] * 4 + 3] = 0; // invisible past the cutoff
      }
      states[key] = s;
      keyframes.push({ at: c.at, state: key });
    });

    return { states, keyframes };
  },

  overlay(container, data, view, scales) {
    const { x, yReg, yAdv, laneTop, laneH, plotH } = scales;
    // plotBottom is where the lanes end. Desktop: == region bottom (the
    // axis still hangs +8 below, unchanged). Mobile: the 34px axis band
    // (scales() budget) sits between plotBottom and region bottom, so
    // full-height furniture (period bands, boundary dashes, the whistle
    // line) must stop at plotBottom, not region bottom.
    const plotBottom = view.region.y + plotH;
    const g = container.svg;

    // Whistle instant + kickoff instant, hoisted above the axis block so
    // the x-axis can label itself as wall-clock minutes since kickoff
    // (G3). Provenance fix (ledger s08 #2): kickoff_ts now reads straight
    // off data.scene.window.kickoff_ts (Pinnacle's own fixture kickoff, a
    // class-A field independent of the whistle) instead of assuming a
    // flat 90 minutes back from the whistle -- a match with real stoppage
    // time, like this one, would throw every match-minute label off by
    // exactly the missing minutes. The old approximation survives only as
    // a defensive fallback.
    const whistleTs = data.scene && data.scene.window && data.scene.window.whistle_ts
      ? new Date(data.scene.window.whistle_ts).getTime() : null;
    const kickoffTs = data.scene && data.scene.window && data.scene.window.kickoff_ts
      ? new Date(data.scene.window.kickoff_ts).getTime()
      : (whistleTs !== null ? whistleTs - 90 * 60000 : null);
    function matchMinuteLabel(d) {
      if (kickoffTs === null) return '';
      return `${Math.round((d.getTime() - kickoffTs) / 60000)}’`;
    }

    // Shaded, labeled period bands (Gate-5 item 9 VISUAL disposition):
    // drawn first, so every later mark paints on top, and always visible
    // -- the same way the axis itself is always visible, not gated to
    // scroll position. Source is data.scene.period_bands: kickoff_ts and
    // the whistle boundary are tape-verified, interior extra-time
    // boundaries are rule-derived off IFAB's standard durations (each
    // band's own "method" field in docs/data/scenes/s08.json says which).
    // Before this, the chart's only structural marker was the single
    // white line -- a reader had no way to see that past the whistle, the
    // wall-clock axis keeps counting through a break, two halves of extra
    // time, and a shootout.
    const bandsG = g.append('g').attr('class', 's08-period-bands');
    const periodBands = (data.scene && data.scene.period_bands) || [];
    // The persistent color KEY panel (top-right, desktop) paints above the
    // SVG overlay (tokens.css --z-chip-and-grain-plate over --z-d3-overlay)
    // and reserves layout.key-exclusion-{w,h}-px there (the exact budget
    // s16.js's keyGutterRect() already codifies) -- a label drawn under it
    // is not clipped, it is simply invisible, painted over.
    const keyMargin = view.tokens.spacing_px[4] || 24;
    const keyX0 = view.mobile ? Infinity
      : view.W - keyMargin - (view.tokens.layout['key-exclusion-w-px'] || 280);
    // Layout-audit fix (2026-07 round, 1280x800 rows): the old guard tested
    // only a label's LEFT edge against the exclusion (bx0 + 4 < keyX0), so
    // a label that STARTED clear could still run under the KEY -- "extra
    // time, second half" crossed the exclusion edge by 14px at the 1280
    // stage width and was painted over. Every band label is now measured
    // after render and tested box-against-box with the full reserved key
    // rect (the same budget keyGutterRect() codifies), with an 8px
    // standoff:
    //   1. a single line on the shared label row is kept when it clears;
    //   2. else the label wraps to two lines stacked UP off that same row
    //      (the bottom line stays aligned with its neighbors; the top
    //      line grows into open canvas above the region), kept when the
    //      whole wrapped box clears;
    //   3. else it parks below the axis on the title row (the shootout
    //      band's existing MINOR (a) treatment), placed further down once
    //      the measured axis-title baseline exists.
    const keyRect = view.mobile ? null : {
      x0: keyX0,
      x1: view.W - keyMargin,
      y0: keyMargin,
      y1: keyMargin + (view.tokens.layout['key-exclusion-h-px'] || 132),
    };
    // bb is a getBBox() box {x,y,width,height}; zone is {x0,x1,y0,y1}.
    const hitsZone = (bb, zone, pad) => bb.x < zone.x1 + pad
      && bb.x + bb.width > zone.x0 - pad
      && bb.y < zone.y1 + pad
      && bb.y + bb.height > zone.y0 - pad;
    const parkedLabels = []; // { xEnd, label } -- placed after the axis title
    const mobileBandLabels = []; // { sel, bx1, label } -- resolved in the mobile pass below
    periodBands.forEach((band, bi) => {
      if (!band.start || !band.end) return;
      const b0 = new Date(band.start).getTime();
      const b1 = new Date(band.end).getTime();
      const bx0 = Math.max(view.region.x, x(b0));
      const bx1 = Math.min(view.region.x + view.region.w, x(b1));
      const bw = bx1 - bx0;
      if (bw <= 0) return;
      bandsG.append('rect')
        .attr('x', bx0).attr('width', bw)
        .attr('y', view.region.y).attr('height', plotH)
        .attr('fill', 'var(--field-rest)')
        .attr('fill-opacity', bi % 2 === 0 ? 0.035 : 0.07);
      if (bi > 0) {
        bandsG.append('line')
          .attr('x1', bx0).attr('x2', bx0)
          .attr('y1', view.region.y).attr('y2', plotBottom)
          .attr('stroke', 'var(--ink-low)').attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,3').attr('stroke-opacity', 0.5);
      }
      if (bw < 44) return;
      const labelSel = bandsG.append('text')
        .attr('x', bx0 + 4).attr('y', view.region.y - 20)
        .attr('font-family', 'var(--font-apparatus)')
        .attr('font-size', 'var(--type-micro-size)')
        .attr('fill', 'var(--ink-low)')
        .text(band.label);
      let bb = null;
      try { bb = labelSel.node().getBBox(); } catch (e) { bb = null; }
      if (bb === null) {
        // Unmeasurable (detached render): fall back to the legacy
        // left-edge guard so behavior degrades to the pre-audit shape.
        if (bx0 + 4 < keyX0) return;
        labelSel.remove();
        if (Number.isFinite(keyX0)) {
          parkedLabels.push({
            xEnd: Math.min(bx1, view.region.x + view.region.w),
            label: band.label,
          });
        }
        return;
      }
      if (view.mobile) {
        // Mobile (2026-07 390x844 DOM-geometry audit): no KEY exclusion
        // exists at this width, so the ladder below never ran and every
        // band label kept the shared row -- where the narrow stage ran
        // three of them together. Collect for the measured right-to-left
        // pass after this loop instead.
        mobileBandLabels.push({ sel: labelSel, bx1, label: band.label });
        return;
      }
      if (!keyRect || !hitsZone(bb, keyRect, 8)) return; // clears the KEY
      // Step 2: two-line wrap, stacked upward off the shared label row.
      const words = String(band.label).split(/\s+/);
      if (words.length > 1) {
        const lineH = Math.max(12, Math.round(bb.height * 1.15));
        for (let k = words.length - 1; k >= 1; k--) {
          labelSel.text(null);
          labelSel.append('tspan')
            .attr('x', bx0 + 4).attr('y', view.region.y - 20 - lineH)
            .text(words.slice(0, k).join(' '));
          labelSel.append('tspan')
            .attr('x', bx0 + 4).attr('y', view.region.y - 20)
            .text(words.slice(k).join(' '));
          let wbb = null;
          try { wbb = labelSel.node().getBBox(); } catch (e) { wbb = null; }
          if (wbb && !hitsZone(wbb, keyRect, 8)) return; // wrapped fit
        }
      }
      // Step 3: no in-plot placement clears the KEY; park below the axis.
      labelSel.remove();
      parkedLabels.push({
        xEnd: Math.min(bx1, view.region.x + view.region.w),
        label: band.label,
      });
    });

    // Mobile band-label pass (2026-07 390x844 DOM-geometry audit): at this
    // width the shared row ran "extra time, first half" 56px into "extra
    // time, second half", which ran 46px into "penalty shootout", itself
    // 4px past the viewport's right edge. Resolution is measured
    // right-to-left so the shootout -- the climax the beat copy sends the
    // reader to -- always wins the row (the same precedence the
    // parkedLabels loop below already encodes for desktop):
    //   1. a label overrunning the region clamps text-anchor:end to its
    //      band's own right edge (the parked-label clamp, applied
    //      in-plot);
    //   2. a label colliding with one already kept retries as the store
    //      label's own leading clause (the text before its first comma:
    //      "extra time, first half" -> "extra time") -- a data-derived
    //      cut, no invented copy;
    //   3. still colliding, it drops -- the band's shading and dashed
    //      boundary stay, the same degradation the bw < 44 guard already
    //      applies to bands too narrow to label.
    if (view.mobile && mobileBandLabels.length) {
      const regionRight = view.region.x + view.region.w;
      const keptBoxes = [];
      const measureSel = (sel) => {
        try { return sel.node().getBBox(); } catch (e) { return null; }
      };
      const collides = (bb) => keptBoxes.some((k) => hitsZone(bb, {
        x0: k.x, x1: k.x + k.width, y0: k.y, y1: k.y + k.height,
      }, 8));
      mobileBandLabels.slice().reverse().forEach((m) => {
        let bb = measureSel(m.sel);
        if (!bb) return; // detached render: leave the label untouched
        if (bb.x + bb.width > regionRight) {
          m.sel.attr('text-anchor', 'end')
            .attr('x', Math.min(m.bx1, regionRight));
          bb = measureSel(m.sel) || bb;
        }
        if (collides(bb)) {
          const clause = String(m.label).split(',')[0].trim();
          if (clause && clause !== String(m.label)) {
            m.sel.text(clause);
            bb = measureSel(m.sel) || bb;
          }
          if (collides(bb)) { m.sel.remove(); return; }
        }
        keptBoxes.push(bb);
      });
    }

    // Blind mobile-review fix (2026-07 round, HIGH): on mobile the axis
    // row moves INSIDE the region, onto the 34px band scales() reserved
    // below the shrunk lanes (translate at plotBottom, no +8 drop), with
    // compacted tick metrics (tickSize 4, padding 2) and a tighter title
    // gap so ticks + title fit the band above the prose sheet's top edge
    // (== region bottom on the phone stage). Desktop keeps the original
    // below-region row and d3 default metrics, unchanged.
    const axisG = g.append('g')
      .attr('transform', `translate(0,${view.mobile ? plotBottom : view.region.y + view.region.h + 8})`)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .call(view.mobile
        ? d3.axisBottom(x).ticks(6).tickSize(4).tickPadding(2).tickFormat(matchMinuteLabel)
        : d3.axisBottom(x).ticks(6).tickFormat(matchMinuteLabel));
    // Layout-audit fix (2026-07 round, 1280x800 + 1512x945 rows): the
    // title's y=28 was a constant tuned at one width, and whenever a tick
    // label (120', 135', 150') landed inside the centered title's span the
    // two em boxes grazed by ~4px. The baseline now derives from the
    // measured bottom edge of the tallest tick label plus one spacing_px
    // step of clearance plus the title's own measured ascent, so the
    // standoff holds at every stage width without a width-tuned constant.
    // Mobile fallback matches the compacted metrics (tickSize 4 + padding
    // 2 + micro line) so an unmeasurable render still fits the 34px band.
    let tickBottom = view.mobile ? 16 : 21; // ~ tickSize + padding + micro line
    axisG.selectAll('.tick text').each(function measureTick() {
      try {
        const b = this.getBBox();
        if (b.y + b.height > tickBottom) tickBottom = b.y + b.height;
      } catch (e) { /* keep fallback */ }
    });
    // Mobile: 2px, not a spacing step -- the measured chain (tickBottom +
    // gap + title ascent + descent) must total under the 34px band.
    const titleGap = view.mobile ? 2 : (view.tokens.spacing_px[1] || 8);
    const axisTitle = axisG.append('text')
      .attr('x', view.region.x + view.region.w / 2).attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)')
      .text('match clock (minutes, wall time since kickoff)');
    let axisTitleY = tickBottom + titleGap + 11; // fallback ascent
    let titleBB = null;
    try {
      titleBB = axisTitle.node().getBBox(); // measured at y=0: bbox.y = -ascent
      axisTitleY = tickBottom + titleGap - titleBB.y;
    } catch (e) { /* keep fallback */ }
    axisTitle.attr('y', axisTitleY);
    // Parked band labels (step 3 of the band-label ladder above): text-end
    // under the band's own right edge, sharing the measured title baseline
    // (the shootout band's pre-existing below-axis treatment, now on the
    // title's real row instead of a second hand-tuned y). Placed
    // right-to-left so the latest band -- the shootout, the climax under
    // the KEY -- wins the row; each earlier label keeps only if it clears
    // both the centered title and every label already kept, measured at
    // this exact width. A label with no honest berth is dropped rather
    // than painted over (the same degradation the bw >= 44 guard already
    // applies to narrow bands).
    let parkedLeftEdge = Infinity;
    parkedLabels.slice().reverse().forEach((p) => {
      const sel = axisG.append('text')
        // Clamp to the region's right edge: on the 390px mobile audit the
        // shootout band's parked label ended 3px off-screen.
        .attr('x', Math.min(p.xEnd, view.region.x + view.region.w))
        .attr('y', axisTitleY)
        .attr('text-anchor', 'end')
        .attr('font-family', 'var(--font-apparatus)')
        .attr('font-size', 'var(--type-micro-size)')
        .attr('fill', 'var(--ink-low)')
        .text(p.label);
      let keep = true;
      try {
        const b = sel.node().getBBox();
        const tb = titleBB || axisTitle.node().getBBox();
        if (b.x < tb.x + tb.width + 8 && b.x + b.width > tb.x - 8) keep = false;
        if (b.x + b.width > parkedLeftEdge - 8) keep = false;
        if (keep) parkedLeftEdge = Math.min(parkedLeftEdge, b.x);
      } catch (e) { /* unmeasurable: keep, mirroring the legacy path */ }
      if (!keep) sel.remove();
    });

    // Dual price axes: one per lane, each with its own horizontal title
    // (G3: y titles are never rotated).
    g.append('g').attr('transform', `translate(${view.region.x - 8},0)`)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisLeft(yReg).ticks(4));
    // Titles sit 22px (not 10px) below each lane's top so they clear the
    // "REGULATION ·" / "ADVANCE ·" descriptor line 6px above the lane,
    // which the tighter spacing let them run into (perception-brief P4).
    const regTitle = g.append('text').attr('x', view.region.x - 8).attr('y', laneTop.reg + 22)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)').text('regulation-market price (cents)');
    g.append('g').attr('transform', `translate(${view.region.x - 8},0)`)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisLeft(yAdv).ticks(4));
    g.append('text').attr('x', view.region.x - 8).attr('y', laneTop.adv + 22)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)').text('advance-market price (cents)');

    g.append('text').attr('x', view.region.x).attr('y', laneTop.reg - 6)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .attr('fill', 'var(--ink-low)').text('REGULATION · Germany wins in 90, expiring by rule');
    g.append('text').attr('x', view.region.x).attr('y', laneTop.adv - 6)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .attr('fill', 'var(--ink-low)').text('ADVANCE · Germany goes through, still trading');

    // Chart-first fix (design-review C2): the regulation leg is only ~650
    // dots' worth of tagged population, split further into ~50 for this
    // lane -- at rest opacity, scattered across a 22-minute pre-whistle
    // window, those dots never composited above the field's own noise
    // floor and the split never read as a change. Two connected D3 price
    // paths, built straight from the zoom tile (not the population), carry
    // the message the particles alone could not: a labeled line, not a
    // sole-carrier scatter (RESHAPE doctrine). The dots stay as texture
    // underneath.
    const legSpec = data.manifest.zoom.gerpar;
    let regLegIdx = -1; let advLegIdx = -1;
    if (legSpec && legSpec.legs) {
      advLegIdx = findLegIndex(legSpec.legs, /advance/i);
      regLegIdx = legSpec.legs.findIndex((l, i) => i !== advLegIdx);
    }
    const gpTile = data.zoom.gerpar;
    function buildLegPoints(legIdx, maxPts) {
      if (!gpTile || legIdx < 0) return [];
      const rows = [];
      for (let r = 0; r < gpTile.count; r++) if (gpTile.leg[r] === legIdx) rows.push(r);
      if (!rows.length) return [];
      const stride = Math.max(1, Math.ceil(rows.length / maxPts));
      const pts = [];
      for (let i = 0; i < rows.length; i += stride) {
        const r = rows[i];
        pts.push({ ts: gpTile.t0 + gpTile.ts_ms[r], price: gpTile.price_c[r] });
      }
      const rLast = rows[rows.length - 1];
      const lastTs = gpTile.t0 + gpTile.ts_ms[rLast];
      if (!pts.length || pts[pts.length - 1].ts !== lastTs) {
        pts.push({ ts: lastTs, price: gpTile.price_c[rLast] });
      }
      return pts;
    }
    const regPts = buildLegPoints(regLegIdx, 400);
    const advPts = buildLegPoints(advLegIdx, 700);
    const regLineGen = d3.line().x((d) => x(d.ts)).y((d) => yReg(d.price));
    const advLineGen = d3.line().x((d) => x(d.ts)).y((d) => yAdv(d.price));
    const regPathEl = g.append('path')
      .attr('fill', 'none').attr('stroke', 'var(--state-expiring)')
      .attr('stroke-width', 2).attr('stroke-linecap', 'round');
    const advPathEl = g.append('path')
      .attr('fill', 'none').attr('stroke', 'var(--side-yes)')
      .attr('stroke-width', 2).attr('stroke-linecap', 'round');

    // Gate-5 item 9 VISUAL disposition: the white line now sits at the
    // real, tape-pinned whistle instant (data.scene.window.whistle_ts,
    // not a naive minute-90 mark), labeled for what it actually is --
    // regulation's end, inclusive of stoppage time.
    const whistleG = g.append('g').style('display', 'none');
    if (whistleTs !== null) {
      const wx = x(whistleTs);
      whistleG.append('line')
        .attr('x1', wx).attr('x2', wx)
        .attr('y1', view.region.y).attr('y2', plotBottom)
        .attr('stroke', 'var(--ink-hero)').attr('stroke-width', 1.5);
      const wLabelMain = whistleG.append('text').attr('x', wx + 6).attr('y', view.region.y + 12)
        .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-annotation-size)')
        .attr('fill', 'var(--ink-hero)').text('final whistle of regulation');
      const wLabelSub = whistleG.append('text').attr('x', wx + 6).attr('y', view.region.y + 27)
        .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-caption-size)')
        .attr('fill', 'var(--ink-mid)').text('(with stoppage)');
      // Mobile lift (2026-07 390x844 DOM-geometry audit): the narrow
      // stage puts the whistle line only ~29% into the region, so this
      // label pair rendered straight through the regulation lane's
      // y-title (88px of x-overlap on both lines). Measured
      // box-against-box with the same hitsZone the band ladder uses:
      // when either label intersects the title's box, the pair drops as
      // a unit to just below the title's measured bottom edge (keeping
      // its own row spacing), landing in the dead stretch of the
      // regulation lane right of the whistle -- the leg is settled
      // there, and the decay card sits lower still at laneH * 0.4. No
      // width-tuned mobile y; a stage where the title and the whistle
      // labels never meet keeps the desktop rows untouched. whistleG is
      // display:none until the scrub reveals it, and a hidden SVG node
      // has no box to measure, so the guard unhides for the measurement
      // and re-hides after (synchronous, so nothing paints in between).
      if (view.mobile) {
        whistleG.style('display', null);
        try {
          const tb = regTitle.node().getBBox();
          const tz = { x0: tb.x, x1: tb.x + tb.width, y0: tb.y, y1: tb.y + tb.height };
          const mainBB = wLabelMain.node().getBBox();
          const subBB = wLabelSub.node().getBBox();
          if (hitsZone(mainBB, tz, 4) || hitsZone(subBB, tz, 4)) {
            const dy = (tb.y + tb.height + titleGap) - Math.min(mainBB.y, subBB.y);
            if (dy > 0) {
              wLabelMain.attr('y', +wLabelMain.attr('y') + dy);
              wLabelSub.attr('y', +wLabelSub.attr('y') + dy);
            }
          }
        } catch (e) { /* unmeasurable: keep the desktop rows */ }
        whistleG.style('display', 'none');
      }
      // Design-review MINOR (c): the regulation leg's terminal pin reads
      // as a detached dash at the bottom of the lane; name it so the
      // fragment is claimed. The figure is the STORE's own settlement
      // price (data.scene.price_at_whistle_c), never a hand-typed 1.
      const settleC = data.scene && data.scene.price_at_whistle_c;
      if (settleC != null) {
        whistleG.append('text').attr('x', wx + 6).attr('y', yReg(settleC) - 6)
          .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
          .attr('fill', 'var(--ink-mid)').text(`settles ${settleC}¢`);
      }
    }

    // Named ET spike (Gate-5 item 9): the advance-market surge partway
    // through extra time is not a random tape wobble. It reads live off
    // data.scene.et_spike (a class-A boundary detection on the
    // KXWCADVANCE-GER tape, identity cross-checked against the web-
    // verified match report), so the price it names can never drift from
    // the tape that produced it.
    const spikeG = g.append('g').style('display', 'none');
    const spike = data.scene && data.scene.et_spike;
    if (spike && spike.peak_ts && spike.peak_price_c != null) {
      const sx = x(new Date(spike.peak_ts).getTime());
      const sy = yAdv(spike.peak_price_c);
      spikeG.append('circle')
        .attr('cx', sx).attr('cy', sy).attr('r', 3.5)
        .attr('fill', 'none').attr('stroke', 'var(--ink-mid)').attr('stroke-width', 1.25);
      // Text-collision guard: the pinned decay caption occupies the top of
      // this same lane (laneTop.adv + 32, ~46ch wide), and the spike's own
      // price point can land right at that box's edge. The label sits on
      // its own fixed row well below both the caption and the marker,
      // connected by a short leader line, so it never crowds the caption
      // regardless of where the spike itself falls on the x-axis. It also
      // sits directly over the advance-market price line as that line
      // keeps drawing, so it gets the same getBBox()-measured scrim other
      // scenes use for a label that cannot be guaranteed a clear patch of
      // canvas (see s10.js's scrimmedLabel()).
      // Mobile re-verify (2026-07 blind round, LOW): with scrub-deep now
      // sliding the KEY away past 60% and the lanes shrunk for the axis
      // band, this label's reveal moment (cutoff >= peak_ts, ~t 0.66+)
      // lands in open advance-lane air at 390x844 (row ~419, kick-strip
      // top ~471, sheet top ~523). The min() clamp only engages on lanes
      // short enough (laneH < 164) that a fixed 120 would run the label
      // into the kick strip and the deciding-kick callout row at
      // laneH - 30; desktop (laneH >= 164 at every stage size) keeps the
      // original 120 row untouched.
      const labelY = laneTop.adv
        + (view.mobile ? Math.min(120, Math.round(laneH - 44)) : 120);
      spikeG.append('line')
        .attr('x1', sx).attr('x2', sx)
        .attr('y1', sy + 5).attr('y2', labelY - 16)
        .attr('stroke', 'var(--ink-low)').attr('stroke-width', 1);
      const spikeLeft = sx > view.region.x + view.region.w - 170;
      const labelX = spikeLeft ? sx - 6 : sx + 6;
      const anchor = spikeLeft ? 'end' : 'start';
      const spikeLabel = spikeG.append('text')
        .attr('text-anchor', anchor)
        .attr('font-family', 'var(--font-apparatus)')
        .attr('font-size', 'var(--type-micro-size)')
        .attr('fill', 'var(--ink-mid)');
      spikeLabel.append('tspan').attr('x', labelX).attr('y', labelY - 13)
        .text("Jonathan Tah's goal, then VAR:");
      spikeLabel.append('tspan').attr('x', labelX).attr('y', labelY)
        .text(`${spike.peak_price_c}¢ and back`);
      const spikeBB = spikeLabel.node().getBBox();
      spikeG.insert('rect', () => spikeLabel.node())
        .attr('x', spikeBB.x - 5).attr('y', spikeBB.y - 3)
        .attr('width', spikeBB.width + 10).attr('height', spikeBB.height + 6)
        .attr('rx', 2)
        .attr('fill', 'var(--bg-card)').attr('fill-opacity', 0.85);
    }

    // Shootout kicks (Gate-5 item 9): per-kick markers read live off
    // data.scene.shootout_kicks (12 kicks, step-detected off the tape and
    // cross-verified against the match report's final score), replacing
    // the earlier tile-flag-based detector. Twelve kicks land inside a
    // ~16-minute window at this chart's own scale (well under 15px apart)
    // -- a per-kick number at that spacing overlapped its neighbors into
    // an unreadable smear, so each kick is a plain tick. Design-review
    // MINOR (b): the old solid-vs-dashed make/miss coding was
    // indecipherable at this size, so outcome is tick HEIGHT now -- a
    // make stands full height, a miss stops short. The deciding kick
    // alone gets a named callout. Design-review MAJOR-2: each tick (and
    // the callout) reveals only once the scrub cutoff reaches its own
    // kick timestamp; scrub() drives that off the kickMarks list here.
    const kicksG = g.append('g').style('display', 'none');
    const kicks = (data.scene && data.scene.shootout_kicks) || [];
    const kickMarks = []; // { ms, sel } -- per-kick reveal, driven by scrub()
    let calloutG = null;
    let decisiveMs = null;
    if (kicks.length) {
      const stripBottom = laneTop.adv + laneH - 4;
      const stripTop = stripBottom - 14;
      kicks.forEach((k) => {
        const ms = new Date(k.ts).getTime();
        const kx = x(ms);
        const made = k.outcome === 'make';
        const sel = kicksG.append('line')
          .attr('x1', kx).attr('x2', kx)
          .attr('y1', made ? stripTop : stripTop + (stripBottom - stripTop) / 2)
          .attr('y2', stripBottom)
          .attr('stroke', 'var(--ink-mid)')
          .attr('stroke-width', 1.5);
        kickMarks.push({ ms, sel });
      });
      const decisive = kicks.find((k) => k.decisive) || kicks[kicks.length - 1];
      if (decisive) {
        decisiveMs = new Date(decisive.ts).getTime();
        const dx = x(decisiveMs);
        const labelY = stripTop - 12;
        calloutG = kicksG.append('g');
        calloutG.append('line')
          .attr('x1', dx).attr('x2', dx)
          .attr('y1', labelY + 5).attr('y2', stripTop - 3)
          .attr('stroke', 'var(--ink-low)').attr('stroke-width', 1);
        calloutG.append('text')
          .attr('x', Math.min(dx, view.region.x + view.region.w))
          .attr('y', labelY)
          .attr('text-anchor', 'end')
          .attr('font-family', 'var(--font-apparatus)')
          .attr('font-size', 'var(--type-annotation-size)')
          .attr('fill', 'var(--ink-hi)')
          .text('Paraguay converts, the ticket dies');
      }
    }

    // Merged two-line annotation (CR-8): line 1 amber (the scene's one
    // amber unit), line 2 ink-mid. One leader, one block, never two
    // separate captions competing for the same story point.
    // Design-review MAJOR-4: this card describes the REGULATION glide,
    // yet it sat inside the ADVANCE lane next to the Tah spike -- the
    // wrong lane for its own subject -- where its opaque plate also
    // occluded the whistle line and skimmed the 80c cyan stretch. It now
    // lives in the regulation lane, in the dead zone just right of the
    // whistle: pinned to the slate glide's own terminus, the settlement
    // it explains. The left edge clears the whistle line by 16px; the
    // right edge is capped short of the KEY exclusion (keyX0 is Infinity
    // on mobile, so the cap falls back to the region edge); the mid-lane
    // top clears the whistle labels above and the settlement-pin label
    // below. The plate renders at 0.85 opacity so the band furniture
    // behind it stays legible.
    // Provenance fix (ledger s08 #3): these two figures read the R4_*
    // module constants declared above instead of two independent
    // hand-typed copies -- see the header comment and this scene's
    // check_figure_sync.py slots.
    const capLeft = whistleTs !== null ? x(whistleTs) + 16 : view.region.x;
    const capRightEdge = Math.min(
      Number.isFinite(keyX0) ? keyX0 : Infinity,
      view.region.x + view.region.w,
    ) - 12;
    const capMaxWPx = Math.max(120, Math.round(capRightEdge - capLeft));
    // Blind mobile-review fix (2026-07 round, MEDIUM): at phone width the
    // full two-line plate wrapped tall enough to overrun its shortened
    // lane -- it occluded the "settles 1c" pin label and clipped the
    // "ADVANCE ·" lane descriptor. Mobile keeps the amber headline line
    // only (the second line's goal-move figures stay in the beat prose a
    // reader has just scrolled past, and check_figure_sync.py's
    // s08-goal-move-*-sync slots guard that prose copy against the same
    // R4_* constants this template reads). Both lines still read the R4_*
    // constants live -- nothing here is hand-typed.
    const capTopY = laneTop.reg + laneH * 0.4;
    const decayCaption = pinnedCaption(
      container,
      '',
      's08-decay-caption',
    ).style('left', `${capLeft}px`).style('top', `${capTopY}px`)
      .style('max-width', `min(46ch, ${capMaxWPx}px)`)
      .style('background', 'color-mix(in srgb, var(--bg-card) 85%, transparent)')
      .html(
        `<div style="color:var(--accent-annotation)">settling out: never faster than ${R4_DECAY_MAX_C_PER_MIN} cents a minute</div>`
        + (view.mobile ? ''
          : `<div style="color:var(--ink-mid); margin-top:4px">a real goal moves ${R4_GOAL_MOVE_LO_C} to ${R4_GOAL_MOVE_HI_C} cents in ${R4_GOAL_MOVE_WINDOW_S} seconds</div>`),
      );
    // Measured mobile placement guard (same MEDIUM item): even the
    // one-line plate can wrap on the narrowest stages (capMaxWPx tracks
    // the whistle position), so the rendered plate is measured -- unhidden
    // invisibly, synchronously, the whistleG trick above -- and shifted up
    // if its bottom would cross the settlement-pin label's top
    // (yReg(price_at_whistle_c) - 16 ~= baseline minus micro ascent) or
    // the ADVANCE descriptor's top (laneTop.adv - 15), with 4px standoff.
    // The floor keeps it below the regulation y-title row. Desktop never
    // enters this branch.
    if (view.mobile) {
      const capNode = decayCaption.node();
      capNode.style.visibility = 'hidden';
      capNode.style.display = 'block';
      const plateH = capNode.offsetHeight || 0;
      capNode.style.display = 'none';
      capNode.style.visibility = '';
      const settlePinC = data.scene && data.scene.price_at_whistle_c;
      const clearBottom = Math.min(
        settlePinC != null ? yReg(settlePinC) - 16 : Infinity,
        laneTop.adv - 15,
      ) - 4;
      if (plateH && capTopY + plateH > clearBottom) {
        decayCaption.style('top',
          `${Math.max(laneTop.reg + 30, clearBottom - plateH)}px`);
      }
    }

    // One continuous scrub track (storyboard's single Beat/Scroll spec),
    // annotations gated per-moment (design-review MAJOR-2): the old
    // single `t >= whistleAt` switch lit the whistle marker, the decay
    // caption, the Tah-spike callout, and the whole shootout strip in
    // one frame -- up to an hour of tape ahead of the reveal. Each mark
    // now waits for the scrub cutoff (the same tape clock the lines and
    // particles draw by) to reach its own STORE timestamp: the whistle
    // marks and decay card at window.whistle_ts, the spike callout at
    // et_spike.peak_ts, the kick strip at the shootout band's
    // tape-verified start, each kick tick at its own kick ts, and the
    // deciding-kick callout at that kick's ts.
    const spikePeakMs = (spike && spike.peak_ts) ? new Date(spike.peak_ts).getTime() : null;
    const shootoutBand = ((data.scene && data.scene.period_bands) || [])
      .find((b) => b.key === 'shootout');
    const shootoutStartMs = (shootoutBand && shootoutBand.start)
      ? new Date(shootoutBand.start).getTime() : null;

    const lineCuts = computeCuts(
      whistleTs,
      data.manifest.zoom.gerpar ? new Date(data.manifest.zoom.gerpar.window[0]).getTime() : null,
      data.manifest.zoom.gerpar ? new Date(data.manifest.zoom.gerpar.window[1]).getTime() : null,
      data.scene && data.scene.period_bands,
    );

    function step() {} // no discrete steps in this scrub scene

    function scrub(t) {
      const cutoff = cutoffAt(lineCuts, t);
      const regDrawn = regPts.filter((d) => d.ts <= cutoff);
      const advDrawn = advPts.filter((d) => d.ts <= cutoff);
      regPathEl.attr('d', regDrawn.length > 1 ? regLineGen(regDrawn) : null);
      advPathEl.attr('d', advDrawn.length > 1 ? advLineGen(advDrawn) : null);

      // Whistle-less fallback mirrors the old scroll-fraction gate so a
      // store without window.whistle_ts still degrades gracefully.
      const pastWhistle = whistleTs !== null ? cutoff >= whistleTs : t >= 0.35;
      whistleG.style('display', pastWhistle ? null : 'none');
      decayCaption.style('display', pastWhistle ? null : 'none');
      spikeG.style('display',
        spikePeakMs !== null && cutoff >= spikePeakMs ? null : 'none');
      const inShootout = shootoutStartMs !== null
        ? cutoff >= shootoutStartMs : pastWhistle;
      kicksG.style('display', inShootout ? null : 'none');
      if (inShootout) {
        kickMarks.forEach((m) => m.sel.style('display', cutoff >= m.ms ? null : 'none'));
        if (calloutG) {
          calloutG.style('display',
            decisiveMs !== null && cutoff >= decisiveMs ? null : 'none');
        }
      }
    }

    return {
      step,
      scrub,
      exit() {
        g.selectAll('*').remove();
        decayCaption.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>Which market you watch matters more than what the players
        do. Germany and Paraguay finished level after ninety minutes, plus
        whatever stoppage time the referee added.</p>
        <p>One ticket paid off only if Germany won inside that window. By
        Kalshi's own contract rules, that ticket had to die at the final
        whistle: a draw counts as no.<sup><a href="#fn-13">13</a></sup> Its
        price slid from 48 cents to 1 cent over twenty-two minutes, like
        sand falling through an hourglass, never faster than 7 cents a
        minute. Compare that to a real goal: a real goal moves a price 19
        to 25 cents in 30 seconds, more than three times as fast.</p>
        <p>The slide is the ticket's own clock running out: the score is
        level, the minutes are draining, and a draw pays no. Every passing
        minute takes a few cents with it, by rule.</p>
        <p>A second ticket paid off if Germany went through to the next
        round, however that happened. It barely moved at the whistle and
        kept trading through every penalty kick, for another
        hour.<sup><a href="#fn-13">13</a></sup></p>
        <p>Same match. Two tickets. Two different stories. Someone who had
        not read the ticket's rules might watch only the first price and
        think the market gave up on Germany. It didn't. At the whistle
        line, watch the two paths split. One dies. One keeps trading.</p>
        <p>Tonight's tie-in: if the final is level late, the
        win-in-ninety-minutes ticket will slide by rule, not by belief. The
        real belief will be sitting in the champion tickets. Check which
        ticket is talking before you react.</p>`,
      // Scrub from minute 85 through the shootout's end; the dwell at the
      // whistle (where layout().keyframes slows real time per scroll inch)
      // is the scene's gold coin, per storyboard §Scroll.
      trigger: { type: 'scrub', span: 6 },
      state: 'k0',
      kind: 'resort',
      chip: [
        { token: 'side-yes', glyph: 'dot', label: 'cyan = the advance market, still trading' },
        { token: 'state-expiring', glyph: 'dot', label: 'slate = the regulation market, expiring by rule' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      overlayStep: 'b1',
    },
  ],

  // No reducedMotion.states override: the scrub track already snaps to the
  // nearest keyframe under reduced motion (§3.5); the final keyframe is the
  // fully-settled, fully-revealed static frame.
};
