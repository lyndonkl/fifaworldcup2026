/* docs/js/scenes/s04.js — "The tournament's clock"
 * Storyboard: research/storyboard.md ACT I, S4 (R11)
 * Contract: docs/CONTRACT.md §4.2 (registry row s04, layoutName
 * `clock-grid`, 3 steps, no zoom), §4.5 (overlay obligations), design
 * system §9 S4 note: "channel-sequencing template: brightness only,
 * then recolor to in-window/out-of-window at constant luminance — one
 * new channel per step."
 *
 * Layout grammar: the population re-sorts into an hour-of-day (x) by
 * tournament-day (y) grid, EACH DOT FLYING TO ITS OWN CELL DERIVED FROM
 * ITS OWN `birth_ts` (never an aggregate stand-in for the dot). Step 1
 * assembles the grid in a single neutral hue so only additive density
 * (engine §3.4 tone-mapping) reads as brightness — no hue-encoded
 * meaning exists yet, which is itself a chip-worthy statement per §0.
 * Step 2 adds the kickoff-histogram strip above the grid (overlay-only;
 * the population does not move or recolor). Step 3 recolors in place
 * (kind: 'recolor', position identical) to in-window vs out-of-window,
 * the scene's one hue-encoded meaning.
 *
 * Dots whose birth_ts falls outside the grid's covered day range (most
 * of the futures book's pre-tournament year, per R11/R17) rest, dimmed,
 * in a thin margin band above the grid — population constancy through a
 * narrated rest (storyboard §0), not a truncation.
 *
 * DATA CONTRACT ASSUMPTION (flagged in data_requests): this scene reads
 * `data/scenes/s04.json`:
 *   {
 *     "_provenance": { "sources": [...], "generated": "<iso>" },
 *     "grid": { "day0": "<iso, ET-midnight boundary in UTC>", "days": <int> },
 *     "in_window": [ [0/1 * 24], ... ],   // days x 24 booleans: does this
 *                                          // (tournament day, ET hour) cell
 *                                          // sit inside a kickoff-bracketing
 *                                          // window? Schedule fact, computed
 *                                          // at build from match_windows.parquet
 *                                          // — NOT a per-dot property, so it
 *                                          // is intentionally cell-indexed,
 *                                          // not a population flags bit.
 *     "kickoff_hist": { "hours": [24 ints] },  // scheduled kickoffs per ET hour
 *     "rest_days": ["<iso date>", ...],
 *     "waking_band": { "start_hour": 8, "end_hour": 23 }
 *   }
 * If `in_window` is absent, the step-3 recolor falls back to classifying
 * by `kickoff_hist[hour] > 0` alone (ignores per-day rest-day gaps) and
 * logs a console warning — a coarser but still data-grounded substitute,
 * never an invented split.
 */

import { registry, particleState, colorOf, makeState } from '../shared.js';

function hash01(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = (x * 2246822519) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const IN_WINDOW_COLOR = 'identity-teal';
const OUT_WINDOW_COLOR = 'identity-ref';
const DENSITY_COLOR = 'neutral-data';

function cellIndexFor(birthMs, day0Ms, days) {
  const off = birthMs - day0Ms;
  if (off < 0 || off >= days * 86400000) return null;
  const dayIdx = Math.floor(off / 86400000);
  const hourIdx = Math.floor((off % 86400000) / 3600000);
  return { dayIdx, hourIdx };
}

export default {
  id: 's04',
  act: 1,
  // Structure-spec §5 S4: retitled so the scene's own job (the volume
  // trap a reader must dodge tonight) is legible from the title alone.
  title: 'Busy is not smart',
  kicker: 'Skill 2, continued — the volume trap',
  layoutName: 'clock-grid',

  needs: { scene: true, series: [], zoom: null },

  scales(data, view) {
    const sj = data.scene || {};
    const grid = sj.grid || { day0: data.manifest.epoch, days: 1 };
    const region = view.region;
    const stripH = region.h * 0.10;
    const gridTop = region.y + stripH + region.h * 0.04;
    const gridH = region.h - stripH - region.h * 0.04;

    const hour = registry.register('s04.hour',
      d3.scaleBand().domain(d3.range(24)).range([region.x, region.x + region.w]).paddingInner(0));
    const day = registry.register('s04.day',
      d3.scaleLinear().domain([0, Math.max(1, grid.days - 1)]).range([gridTop, gridTop + gridH]));
    const stripY = registry.register('s04.stripY',
      d3.scaleLinear().domain([0, 1]).range([region.y + stripH, region.y]));

    return {
      hour, day, stripY,
      gridRect: { x: region.x, y: gridTop, w: region.w, h: gridH },
      stripRect: { x: region.x, y: region.y, w: region.w, h: stripH },
    };
  },

  layout(data, view) {
    const { pop, manifest, scene } = data;
    const sj = scene || {};
    const grid = sj.grid || { day0: manifest.epoch, days: 1 };
    const day0Ms = Date.parse(grid.day0) || Date.parse(manifest.epoch);
    const days = Math.max(1, grid.days || 1);
    const epochMs = Date.parse(manifest.epoch);

    const hourScale = registry.get('s04.hour');
    const dayScale = registry.get('s04.day');
    const region = view.region;
    const cellW = hourScale.bandwidth();
    const cellH = (dayScale.range()[1] - dayScale.range()[0]) / Math.max(1, days - 1 || 1);

    const restRgba = particleState(view.tokens, 'rest');
    const densityColor = colorOf(view.tokens, DENSITY_COLOR, view.tokens.dot['opacity-alive'] * 0.6);
    const inColor = colorOf(view.tokens, IN_WINDOW_COLOR, view.tokens.dot['opacity-alive']);
    // REVISION (perception-brief §2/§4/§9b): the step-3 recolor was
    // "in-window vs out-of-window at constant luminance" (design-system §9
    // S4), which the motion/figure-ground literature says is close to
    // inert -- an isoluminant hue swap does not pop. The active subset
    // (money inside kickoff windows) now keeps opacity-alive (1.0 ->
    // engine active-tier boost) while the resting field (off-peak clock)
    // drops to opacity-dimmed-field-max (0.4 <= the 0.42 rest-tier
    // threshold -> engine rest-tier dim), so in-window reads as figure by
    // luminance, not hue alone. This deliberately supersedes the
    // constant-luminance note for this beat.
    const outColor = colorOf(view.tokens, OUT_WINDOW_COLOR, view.tokens.dot['opacity-dimmed-field-max']);
    const baseSize = view.tokens.dot['radius-base-px'] * 2;
    const restY = region.y + region.h * 0.02;

    const N = pop.count;
    let inWindowFallback = false;
    const inWindowGrid = sj.in_window;
    if (!inWindowGrid) inWindowFallback = true;
    const kickoffHours = (sj.kickoff_hist && sj.kickoff_hist.hours) || null;

    const assemble = makeState(N);
    const recolored = makeState(N);

    for (let i = 0; i < N; i++) {
      const birthMs = epochMs + pop.birth_ts[i] * 1000;
      const cell = cellIndexFor(birthMs, day0Ms, days);
      const o = i * 4;
      if (!cell) {
        const jx = region.x + hash01(i) * region.w;
        const jy = restY + (hash01(i * 7 + 3) - 0.5) * (region.h * 0.025);
        assemble.x[i] = jx; assemble.y[i] = jy;
        recolored.x[i] = jx; recolored.y[i] = jy;
        assemble.color[o] = restRgba[0]; assemble.color[o + 1] = restRgba[1];
        assemble.color[o + 2] = restRgba[2]; assemble.color[o + 3] = restRgba[3];
        recolored.color.set(restRgba, o);
        assemble.size[i] = baseSize; recolored.size[i] = baseSize;
        continue;
      }
      const cx = hourScale(cell.hourIdx) + cellW / 2 + (hash01(i) - 0.5) * cellW * 0.8;
      const cy = dayScale(cell.dayIdx) + (hash01(i * 3 + 1) - 0.5) * cellH * 0.8;
      assemble.x[i] = cx; assemble.y[i] = cy;
      recolored.x[i] = cx; recolored.y[i] = cy;
      assemble.color[o] = densityColor[0]; assemble.color[o + 1] = densityColor[1];
      assemble.color[o + 2] = densityColor[2]; assemble.color[o + 3] = densityColor[3];

      let inWindow;
      if (inWindowGrid && inWindowGrid[cell.dayIdx]) {
        inWindow = !!inWindowGrid[cell.dayIdx][cell.hourIdx];
      } else if (kickoffHours) {
        inWindow = kickoffHours[cell.hourIdx] > 0;
      } else {
        inWindow = false;
      }
      const c = inWindow ? inColor : outColor;
      recolored.color.set(c, o);
      assemble.size[i] = baseSize; recolored.size[i] = baseSize;
    }

    if (inWindowFallback) {
      // eslint-disable-next-line no-console
      console.warn('[rt/s04] data/scenes/s04.json missing `in_window` grid; '
        + 'falling back to kickoff_hist-only in-window classification (coarser).');
    }

    return { states: { assemble, recolored } };
  },

  overlay(container, data, view, scales) {
    const { svg } = container;
    const sj = data.scene || {};
    const { hour, day, stripY, gridRect, stripRect } = scales;
    const g = svg.append('g').attr('class', 's04-overlay');

    // Grid frame axes: hour ticks along the top, sparse day ticks on the left.
    const axisHour = d3.axisTop(hour).tickFormat((h) => (h % 6 === 0 ? `${h}:00` : ''));
    g.append('g')
      .attr('transform', `translate(0,${gridRect.y})`)
      .style('color', view.css('ink-low'))
      .style('font', `var(--type-micro-size) var(--font-apparatus)`)
      .call(axisHour);
    // Axis titles (G3): the top hour axis and the left day axis both name
    // what they measure, in plain words, with their unit.
    g.append('text').attr('class', 'axis-title axis-title-hour')
      .attr('x', gridRect.x + gridRect.w / 2).attr('y', gridRect.y - 28)
      .attr('text-anchor', 'middle')
      .attr('fill', view.css('ink-mid'))
      .style('font', `${view.css('type-caption-size')} var(--font-apparatus)`)
      .style('font-weight', 500)
      .text('hour of day (Eastern Time)');

    const grid = sj.grid || { days: 1, day0: data.manifest.epoch };
    const day0Ms = Date.parse(grid.day0) || Date.parse(data.manifest.epoch);
    const dayTickVals = d3.range(0, grid.days, Math.max(1, Math.round(grid.days / 8)));
    const axisDay = d3.axisLeft(day)
      .tickValues(dayTickVals)
      .tickFormat((d) => d3.utcFormat('%b %d')(new Date(day0Ms + d * 86400000)));
    g.append('g')
      .attr('transform', `translate(${gridRect.x},0)`)
      .style('color', view.css('ink-low'))
      .style('font', `var(--type-micro-size) var(--font-apparatus)`)
      .call(axisDay);
    g.append('text').attr('class', 'axis-title axis-title-day')
      .attr('x', gridRect.x).attr('y', gridRect.y - 8)
      .attr('text-anchor', 'start')
      .attr('fill', view.css('ink-mid'))
      .style('font', `${view.css('type-caption-size')} var(--font-apparatus)`)
      .style('font-weight', 500)
      .text('tournament day (date)');

    // Kickoff-histogram bounded strip (own axis, never painted over the cells).
    const kh = (sj.kickoff_hist && sj.kickoff_hist.hours) || new Array(24).fill(0);
    const maxK = Math.max(1, ...kh);
    const stripScale = stripY.copy().domain([0, maxK]);
    const stripG = g.append('g').attr('class', 's04-strip').style('display', 'none');
    stripG.selectAll('rect').data(kh).join('rect')
      .attr('x', (_, i) => hour(i) + hour.bandwidth() * 0.1)
      .attr('width', hour.bandwidth() * 0.8)
      .attr('y', (v) => stripScale(v))
      .attr('height', (v) => stripScale(0) - stripScale(v))
      .attr('fill', view.css('neutral-data'));
    stripG.append('text')
      .attr('x', stripRect.x).attr('y', stripRect.y - 4)
      .attr('fill', view.css('ink-mid'))
      .style('font', `var(--type-caption-size) var(--font-apparatus)`)
      .text('scheduled kickoffs, by hour (Eastern Time)');

    // "US waking hours" band -- the scene's one amber unit (design-
    // revision-spec S4 §1): fill at 0.10, stroke none, label rewritten
    // to plain words, right-aligned inside the band per §2 placement.
    const wb = sj.waking_band;
    let bandG = null;
    if (wb) {
      bandG = g.append('g').attr('class', 's04-waking-band').style('display', 'none');
      const bandX = hour(wb.start_hour);
      const bandW = hour(wb.end_hour) - hour(wb.start_hour) + hour.bandwidth();
      bandG.append('rect')
        .attr('x', bandX).attr('width', bandW)
        .attr('y', gridRect.y).attr('height', gridRect.h)
        .attr('fill', view.css('accent-annotation')).attr('stroke', 'none').attr('opacity', 0.10);
      bandG.append('text')
        .attr('x', bandX + bandW - 12).attr('y', gridRect.y + 14)
        .attr('text-anchor', 'end')
        .attr('fill', view.css('accent-annotation'))
        .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
        .text('US waking hours: about twice the schedule alone');
    }

    // Rest-day row markers + caption (structure-spec S4 §2: the 5-15x /
    // 3x-futures ratios demote out of prose into this caption).
    const restDays = sj.rest_days || [];
    const restG = g.append('g').attr('class', 's04-rest-days').style('display', 'none');
    restG.selectAll('line').data(restDays).join('line')
      .attr('x1', gridRect.x - 6).attr('x2', gridRect.x)
      .attr('y1', (d) => day(Math.floor((Date.parse(d) - day0Ms) / 86400000)))
      .attr('y2', (d) => day(Math.floor((Date.parse(d) - day0Ms) / 86400000)))
      .attr('stroke', view.css('ink-mid')).attr('stroke-width', 2);
    restG.append('text')
      .attr('x', gridRect.x - 6).attr('y', gridRect.y + gridRect.h + 24)
      .attr('text-anchor', 'start')
      .attr('fill', view.css('ink-mid'))
      .style('font', `var(--type-caption-size) var(--font-apparatus)`)
      .text('rest days: trading drops 5-15x; the always-open winner market, only about 3x');

    return {
      step(beatId) {
        if (beatId === 'b1') {
          stripG.style('display', 'none');
          bandG && bandG.style('display', 'none');
          restG.style('display', 'none');
        } else if (beatId === 'b2') {
          stripG.style('display', null);
        } else if (beatId === 'b3') {
          bandG && bandG.style('display', null);
          restG.style('display', null);
        }
      },
      exit() { g.remove(); },
    };
  },

  beats: [
    {
      id: 'b1',
      html: "<p>The market's clock is the tournament's clock. Next, a strip of kickoff bars draws above the grid.</p>",
      trigger: 'step',
      state: 'assemble',
      kind: 'resort',
      chip: [
        { token: 'field-rest', glyph: 'ramp', label: 'brighter = more money that hour' },
      ],
      grain: { text: '1 dot = $75,000 of real money traded' },
    },
    {
      id: 'b2',
      html: '<p>The market gets loud when games kick off, and goes quiet when they do not. Kickoff windows cover about a third of the tournament&rsquo;s hours. But they capture 54.7% of all the money traded, about 1.6 times their fair share.<sup><a href="#fn-6">6</a></sup> The grid on this screen is really just a picture of the match schedule. Next, watch the grid change color. Teal marks kickoff windows.</p>',
      trigger: 'step',
    },
    {
      id: 'b3',
      html: '<p>One thing survives even after you subtract out the schedule. During American waking hours, trading runs about twice as heavy as the schedule alone would predict.<sup><a href="#fn-6">6</a></sup> Tonight&rsquo;s final kicks off in United States primetime. Heavy trading tonight will mean people are watching, not that anyone knows the result early. It also means the price will be wide awake the moment the whistle blows.</p>',
      trigger: 'step',
      state: 'recolored',
      kind: 'recolor',
      chip: [
        { token: 'identity-teal', glyph: 'dot', label: 'teal = money inside match windows' },
        { token: 'identity-ref', glyph: 'dim', label: 'dim = the off-peak clock' },
      ],
    },
  ],

  // Reduced motion: the engine's instant-state + 400ms crossfade already
  // satisfies "no dot ever moves"; the recolor beat is a pure color
  // change (kind: 'recolor') so it degrades to a crossfade with zero
  // extra scene work. No state substitution needed.
};
