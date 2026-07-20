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
 * assembles the grid in a single neutral hue, with per-dot alpha stretched
 * by that cell's own trade count (not a flat value — see layout()'s
 * per-cell alpha pass) so additive density (engine §3.4 tone-mapping)
 * reads as a real brightness gradient — no hue-encoded meaning exists
 * yet, which is itself a chip-worthy statement per §0.
 * REVISED (Gate-4 blind re-review, s04 critical "two messages land in
 * one beat"): Step 2 both reveals the kickoff-histogram strip AND
 * recolors the grid in place (kind: 'recolor', position identical) to
 * in-window vs out-of-window — the beat's own prose promises this color
 * change, so it now happens inside step 2 rather than one beat late.
 * Step 3 recedes the in-window teal to ground-tier brightness (a second,
 * smaller recolor) and raises the amber "US waking hours" bracket as the
 * beat's sole singleton, so the two payoffs never compete for the same
 * luminance peak.
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
    // REVISION (Gate-4 blind re-review, s04 major, "a stray strip of dots
    // floats above the plot frame behind the key and kickoff bars"): the
    // pre-tournament "rest" population previously landed inside the SAME
    // vertical span as the kickoff-histogram strip (region.y +/- ~2-4%),
    // so its jittered dots rendered behind the strip's bars and title.
    // restBand is now its own reserved lane above the strip; layout()
    // reads these exact numbers back via the registry so the rest
    // population and the strip can never drift back into overlap.
    const restBandH = region.h * 0.05;
    const stripH = region.h * 0.09;
    const stripTop = region.y + restBandH;
    // Gap widened from the prior 0.04 to 0.06 (Gate-4 blind re-review, s04
    // major "amber budget"/bracket redesign): the US-waking-hours bracket
    // and its label now live in this gap, above the grid, instead of
    // washing over the cells -- they need the extra room to clear both
    // the strip above and the grid below without new collisions.
    const gridTop = stripTop + stripH + region.h * 0.06;
    const gridH = region.y + region.h - gridTop;

    const hour = registry.register('s04.hour',
      d3.scaleBand().domain(d3.range(24)).range([region.x, region.x + region.w]).paddingInner(0));
    const day = registry.register('s04.day',
      d3.scaleLinear().domain([0, Math.max(1, grid.days - 1)]).range([gridTop, gridTop + gridH]));
    const stripY = registry.register('s04.stripY',
      d3.scaleLinear().domain([0, 1]).range([stripTop + stripH, stripTop]));
    const restBand = registry.register('s04.restBand', { y: region.y, h: restBandH });

    return {
      hour, day, stripY,
      gridRect: { x: region.x, y: gridTop, w: region.w, h: gridH },
      stripRect: { x: region.x, y: stripTop, w: region.w, h: stripH },
      restBand,
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
    const restBand = registry.get('s04.restBand');
    const region = view.region;
    const cellW = hourScale.bandwidth();
    const cellH = (dayScale.range()[1] - dayScale.range()[0]) / Math.max(1, days - 1 || 1);

    const restRgba = particleState(view.tokens, 'rest');
    // Gate-4 visual-story review (s04 C3, "b1 opens on an undecodable
    // bloom monolith"): at 0.6 alpha the whole 164k-dot grid sat in the
    // engine's unclassified 0.42-0.90 band (reserved for dead/expiring),
    // so it got the ACTIVE tone-map chain (gamma + 0.92 cap) instead of
    // the ground tier's tiered cap -- a dense population sharing one hue
    // blooms straight to the ceiling. Every alpha assigned below stays
    // at or under opacity-dimmed-field-max (<= opacity-rest-classify-max)
    // so b1's density read is always in the ground tier: relative
    // brightness still orders by density (the Reinhard knee is monotone),
    // but it can never out-shine the b2/b3 story hues.
    const densityRgb = colorOf(view.tokens, DENSITY_COLOR, 1);
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
    // REVISION (Gate-4 blind re-review, s04 critical: "two messages land
    // in one beat" -- b3 fired the b2-promised teal recolor AND its own
    // amber payoff at once, and the saturated teal mass always won the
    // luminance competition). b3 now RECEDES the in-window teal to the
    // same ground-tier ceiling the rest of the field uses, so it reads as
    // settled context, not a competing figure, leaving amber the scene's
    // only bright singleton when b3's annotation lands (brief §4/§7).
    const inColorDim = colorOf(view.tokens, IN_WINDOW_COLOR, view.tokens.dot['opacity-dimmed-field-max']);
    const baseSize = view.tokens.dot['radius-base-px'] * 2;
    // Pre-tournament "rest" population now lives in its own reserved
    // lane (restBand, from scales()) instead of the strip's vertical span.
    const restCenterY = restBand.y + restBand.h * 0.4;
    const restJitterH = restBand.h * 0.32;

    const N = pop.count;
    let inWindowFallback = false;
    const inWindowGrid = sj.in_window;
    if (!inWindowGrid) inWindowFallback = true;
    const kickoffHours = (sj.kickoff_hist && sj.kickoff_hist.hours) || null;

    // REVISION (Gate-4 blind re-review, s04 major: "brighter = more money
    // that hour" was nearly isoluminant with the background -- the whole
    // data field sat below the luminance of the prose card and key, so
    // there was no perceivable peak). A flat per-dot alpha only produces
    // a per-cell brightness gradient via however much dots-per-cell
    // happen to overlap; that gradient compressed to near-invisible here.
    // This pre-pass tallies real per-cell trade counts and stretches
    // per-dot alpha across the ground-tier-safe range so the busiest
    // hours clear a real gap over the median (brief §4/§6/§9b: story
    // marks need a figure-vs-figure luminance gap, not just a token that
    // passes contrast against flat canvas). p95 (not the raw max) anchors
    // the scale's top so one outlier hour cannot crush every other cell
    // toward the floor.
    const cellCounts = Array.from({ length: days }, () => new Array(24).fill(0));
    for (let i = 0; i < N; i++) {
      const birthMs = epochMs + pop.birth_ts[i] * 1000;
      const cell = cellIndexFor(birthMs, day0Ms, days);
      if (cell) cellCounts[cell.dayIdx][cell.hourIdx] += 1;
    }
    const sortedCounts = cellCounts.flat().filter((c) => c > 0).sort((a, b) => a - b);
    const p95 = sortedCounts.length
      ? sortedCounts[Math.min(sortedCounts.length - 1, Math.floor(sortedCounts.length * 0.95))]
      : 1;
    const ALPHA_CEIL = view.tokens.dot['opacity-dimmed-field-max'];       // 0.4, ground-tier safe
    const ALPHA_FLOOR = view.tokens.dot['opacity-dimmed-field-min'] * 0.3; // ~0.075, near-empty hours
    const cellAlpha = d3.scaleLinear().domain([0, Math.max(1, p95)])
      .range([ALPHA_FLOOR, ALPHA_CEIL]).clamp(true);

    const assemble = makeState(N);
    const recolored = makeState(N);
    const recoloredDim = makeState(N);

    for (let i = 0; i < N; i++) {
      const birthMs = epochMs + pop.birth_ts[i] * 1000;
      const cell = cellIndexFor(birthMs, day0Ms, days);
      const o = i * 4;
      if (!cell) {
        const jx = region.x + hash01(i) * region.w;
        const jy = restCenterY + (hash01(i * 7 + 3) - 0.5) * restJitterH;
        assemble.x[i] = jx; assemble.y[i] = jy;
        recolored.x[i] = jx; recolored.y[i] = jy;
        recoloredDim.x[i] = jx; recoloredDim.y[i] = jy;
        assemble.color[o] = restRgba[0]; assemble.color[o + 1] = restRgba[1];
        assemble.color[o + 2] = restRgba[2]; assemble.color[o + 3] = restRgba[3];
        recolored.color.set(restRgba, o);
        recoloredDim.color.set(restRgba, o);
        assemble.size[i] = baseSize; recolored.size[i] = baseSize; recoloredDim.size[i] = baseSize;
        continue;
      }
      const cx = hourScale(cell.hourIdx) + cellW / 2 + (hash01(i) - 0.5) * cellW * 0.8;
      const cy = dayScale(cell.dayIdx) + (hash01(i * 3 + 1) - 0.5) * cellH * 0.8;
      assemble.x[i] = cx; assemble.y[i] = cy;
      recolored.x[i] = cx; recolored.y[i] = cy;
      recoloredDim.x[i] = cx; recoloredDim.y[i] = cy;
      const a = cellAlpha(cellCounts[cell.dayIdx][cell.hourIdx]);
      assemble.color[o] = densityRgb[0]; assemble.color[o + 1] = densityRgb[1];
      assemble.color[o + 2] = densityRgb[2]; assemble.color[o + 3] = a;

      let inWindow;
      if (inWindowGrid && inWindowGrid[cell.dayIdx]) {
        inWindow = !!inWindowGrid[cell.dayIdx][cell.hourIdx];
      } else if (kickoffHours) {
        inWindow = kickoffHours[cell.hourIdx] > 0;
      } else {
        inWindow = false;
      }
      recolored.color.set(inWindow ? inColor : outColor, o);
      recoloredDim.color.set(inWindow ? inColorDim : outColor, o);
      assemble.size[i] = baseSize; recolored.size[i] = baseSize; recoloredDim.size[i] = baseSize;
    }

    if (inWindowFallback) {
      // eslint-disable-next-line no-console
      console.warn('[rt/s04] data/scenes/s04.json missing `in_window` grid; '
        + 'falling back to kickoff_hist-only in-window classification (coarser).');
    }

    // Gate-4 visual-story review (s04 C3, "start from dimmed rest tint"):
    // an entry-snap to an all-rest state was tried here (as s03 does) and
    // reverted -- s03's version works because most of its population never
    // moves on a given beat (object constancy holds the vast majority in
    // place, so only a small arriving fraction is ever mid-flight). s04's
    // b1 resort relocates its WHOLE 164k-dot population every time the
    // scene is entered, so ANY shared pre-snap position (a thin line, or
    // even the full stage spread uniformly) puts the entire population
    // mid-transition at once; overlapping BOTH the snap arrangement and
    // the forming grid simultaneously reads as a brighter, less decodable
    // opening than simply letting the resort run from wherever the reader
    // arrived. The per-cell alpha stretch above is what fixes b1's own
    // "bloom monolith" (near-isoluminant plateau): it is what the reader
    // reads against once the ~1.7s resort settles.
    // RESIDUAL, OUT OF THIS PASS'S SCOPE: at the instant b1 is first
    // triggered (t=0), the engine's interrupt-retarget bakes whatever s03
    // last rendered (its own bright identity hues, blooming toward the
    // tone-map's 0.92 cap) into the tween's start point, so a reader who
    // lands exactly on the trigger can still see one frame of s03's
    // residue before the resort's motion carries it toward this beat's
    // (now correctly dim) target colors. Removing that residue for good
    // needs either a density-aware/per-tier luminance cap in the engine's
    // tone-map (visual-story-review.md Tier 0.1, "author decision, not
    // attempted in this pass") or a change to how s03 exits -- both
    // outside this scene file's scope.
    return { states: { assemble, recolored, recoloredDim } };
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
    // revision-spec S4 §1), label rewritten to plain words, right-aligned
    // inside the band per §2 placement.
    // REVISION (Gate-4 blind re-review, s04 major, "amber budget
    // violated"): the previous full-height, 0.10-opacity fill was a large
    // second amber SHAPE competing with the annotation text, and once b3
    // sits on top of a bright teal cell field it alpha-blends into a
    // murky olive band (perception-brief §9a's own field-luminance
    // collision, self-inflicted by fill + bloom). A slim bracket at the
    // grid's top edge -- not a wash over the cells -- carries the same
    // "which hours" information as one fused unit with its label, without
    // ever overlapping (and recoloring) the data it is annotating.
    const wb = sj.waking_band;
    let bandG = null;
    if (wb) {
      // visibility (not display) so getBBox() below can measure the
      // label while the group is still hidden.
      bandG = g.append('g').attr('class', 's04-waking-band').style('visibility', 'hidden');
      const bandX = hour(wb.start_hour);
      const bandW = hour(wb.end_hour) - hour(wb.start_hour) + hour.bandwidth();
      const bracketY = gridRect.y - 6;
      bandG.append('rect')
        .attr('x', bandX).attr('width', bandW)
        .attr('y', bracketY - 3).attr('height', 3)
        .attr('fill', view.css('accent-annotation'));
      bandG.append('line').attr('x1', bandX).attr('x2', bandX)
        .attr('y1', bracketY - 3).attr('y2', bracketY + 8)
        .attr('stroke', view.css('accent-annotation')).attr('stroke-width', 1.5);
      bandG.append('line').attr('x1', bandX + bandW).attr('x2', bandX + bandW)
        .attr('y1', bracketY - 3).attr('y2', bracketY + 8)
        .attr('stroke', view.css('accent-annotation')).attr('stroke-width', 1.5);
      const bandLabel = bandG.append('text')
        .attr('x', bandX + bandW - 12).attr('y', bracketY - 10)
        .attr('text-anchor', 'end')
        .attr('fill', view.css('accent-annotation'))
        .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
        .text('US waking hours: about twice the schedule alone');
      // Gate-4 visual-story review: this amber label previously sat
      // directly on the bright teal/white cell field at ~1.4:1 contrast
      // (perception-brief §9a). It now sits above the grid, next to the
      // bracket rather than over any cell, and keeps the bg-canvas scrim
      // behind the glyphs as a second line of defense.
      const bandBB = bandLabel.node().getBBox();
      bandG.insert('rect', 'text')
        .attr('x', bandBB.x - 8).attr('y', bandBB.y - 4)
        .attr('width', bandBB.width + 16).attr('height', bandBB.height + 8)
        .attr('rx', 3)
        .attr('fill', view.css('bg-canvas')).attr('opacity', 0.85);
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
          bandG && bandG.style('visibility', 'hidden');
          restG.style('display', 'none');
        } else if (beatId === 'b2') {
          stripG.style('display', null);
        } else if (beatId === 'b3') {
          bandG && bandG.style('visibility', 'visible');
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
      // REVISION (Gate-4 blind re-review, s04 critical + major: "two
      // messages land in one beat" / "b2 is byte-identical across its own
      // three frames"). The teal recolor this beat's own prose promises
      // ("watch the grid change color") now actually fires inside this
      // beat, instead of silently waiting for b3 to do it alongside b3's
      // own amber payoff. This is the beat's one change; the key row
      // moves here with it so the chip's pulse lands on the same event
      // it describes.
      id: 'b2',
      html: '<p>The market gets loud when games kick off, and goes quiet when they do not. Kickoff windows cover about a third of the tournament&rsquo;s hours. But they capture 54.7% of all the money traded, about 1.6 times their fair share.<sup><a href="#fn-6">6</a></sup> The grid on this screen is really just a picture of the match schedule. Watch the grid change color now. Teal marks kickoff windows.</p>',
      trigger: 'step',
      state: 'recolored',
      kind: 'recolor',
      chip: [
        { token: 'identity-teal', glyph: 'dot', label: 'teal = money inside match windows' },
        { token: 'identity-ref', glyph: 'dim', label: 'dim = the off-peak clock' },
      ],
    },
    {
      // REVISION: b3 no longer redefines the chip (the teal/dim key from
      // b2 stays on screen unchanged), so entering b3 does not re-fire
      // the key's amber pulse alongside the amber annotation -- amber
      // stays a true singleton instead of a third simultaneous amber
      // element (perception-brief §9a). b3's own state (recoloredDim)
      // recedes the in-window teal to ground-tier brightness so it no
      // longer competes with the amber band for the luminance peak.
      id: 'b3',
      html: '<p>One thing survives even after you subtract out the schedule. During American waking hours, trading runs about twice as heavy as the schedule alone would predict.<sup><a href="#fn-6">6</a></sup> Tonight&rsquo;s final kicks off in United States primetime. Heavy trading tonight will mean people are watching, not that anyone knows the result early. It also means the price will be wide awake the moment the whistle blows.</p>',
      trigger: 'step',
      state: 'recoloredDim',
      kind: 'recolor',
    },
  ],

  // Reduced motion: the engine's instant-state + 400ms crossfade already
  // satisfies "no dot ever moves"; both b2 and b3 are pure color changes
  // (kind: 'recolor') so each degrades to a crossfade with zero extra
  // scene work. No state substitution needed.
};
