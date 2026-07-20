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
 *     "waking_band": { "start_hour": 8, "end_hour": 23 },
 *     "hourly_money": [24 floats],   // dollars traded, summed by ET hour of
 *                                     // day across the whole grid window
 *     "hourly_credit": [24 floats],  // the NULL MODEL's own count: every
 *                                     // scheduled match gets a ~3.5h window
 *                                     // around its kickoff (built from
 *                                     // 95/104 fixtures with known kickoff
 *                                     // times -- Gate-5 provenance audit:
 *                                     // was 93/102 until the final and the
 *                                     // third-place playoff gained a listed
 *                                     // occurrence_datetime); each hour is
 *                                     // credited the total dollar pool in
 *                                     // proportion to its share of
 *                                     // window-minutes, so sum(hourly_credit)
 *                                     // == sum(hourly_money). A counting
 *                                     // exercise, not a regression.
 *     "waking_residual": <float>     // sum(hourly_money[wake]) /
 *                                     // sum(hourly_credit[wake]) over the
 *                                     // waking_band hours -- ships pre-
 *                                     // computed but re-derivable from the
 *                                     // two arrays above (Gate-5 item 2).
 *     "window_share": {              // Gate-5 provenance audit (b2's
 *       "pct": <float>,              //   "54.7%/1.6x" was a hand-typed
 *       "clock_coverage_pct": <f>,   //   dossier citation that went stale
 *       "tilt_x": <float>            //   as match_windows.parquet grew;
 *     },                             //   now a class-A live recompute:
 *                                     //   pct = money inside ANY of the 95
 *                                     //   windows / total tape money;
 *                                     //   clock_coverage_pct = union of
 *                                     //   window-seconds / grid.days*24h;
 *                                     //   tilt_x = pct / clock_coverage_pct.
 *     "rest_day_ratios": {           // the caption's "drops Nx" figures,
 *       "all_tape_min_x": <float>,   //   recomputed across the 4 GENUINE
 *       "all_tape_max_x": <float>,   //   rest days only (match_days now
 *       "futures_min_x": <float>,    //   correctly excludes the final and
 *       "futures_max_x": <float>     //   third-place playoff, which the
 *     }                              //   stale 93-window build had wrongly
 *                                     //   tagged as rest days). Each ratio
 *                                     //   is that rest day's nearest-
 *                                     //   match-day-neighbor average over
 *                                     //   its own value, all-tape and
 *                                     //   futures-only (KXMENWORLDCUP).
 *   }
 * If `in_window` is absent, the step-3 recolor falls back to classifying
 * by `kickoff_hist[hour] > 0` alone (ignores per-day rest-day gaps) and
 * logs a console warning — a coarser but still data-grounded substitute,
 * never an invented split.
 *
 * REVISION (Gate-5 author feedback, item 2, all five dispositions): b3
 * ("beat 2" in the author's own count -- the scene's first beat with a
 * real reading to take away) now draws the comparison instead of only
 * asserting it. A small two-line chart (`hourly_money` vs `hourly_credit`,
 * both by ET hour) lives in its own reserved lane between the kickoff
 * strip and the grid; the amber "US waking hours" bracket anchors to that
 * chart's shaded gap, not to the grid's teal cells (the prior placement
 * read as annexing the teal columns, per the author's screenshot). The
 * old "about twice" figure was a pre-recompute estimate; the shipped
 * `waking_residual` (1.2161) says the real number is about 1.2x, and the
 * beat now quotes that instead. The unprompted strawman ("not that anyone
 * knows the result early") and the undecoded "wide awake" metaphor are
 * both replaced with plain sentences per the author's own wording.
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
    const stripH = region.h * 0.08;
    const stripTop = region.y + restBandH;
    // REVISION (Gate-5 item 2, disposition 1): the prior 0.06 gap held only
    // the amber bracket, anchored to the grid's own top edge -- which is
    // exactly what the author's screenshot flagged as visually annexing
    // the teal columns below it. That gap is now a full reserved lane (the
    // "comparison lane") for the two-curve money-vs-credit chart, with the
    // amber bracket anchored to ITS drawn gap instead. compGapTop/Bottom
    // keep clear air between the strip above and the grid below so the
    // new lane never touches either.
    const compGapTop = region.h * 0.02;
    const compH = region.h * 0.17;
    const compTop = stripTop + stripH + compGapTop;
    // Kept at the pre-revision 0.06 (not shrunk to make room for the new
    // lane): this gap is where BOTH grid axis titles now live (see
    // overlay()'s `compRect.curveBottom + 16` placement) as well as the
    // hour axis's own tick row immediately above the grid -- a tighter
    // gap here reproduced the exact "title collides with tick text"
    // defect disposition 1 exists to fix, just one lane lower.
    const compGapBottom = region.h * 0.06;
    const gridTop = compTop + compH + compGapBottom;
    const gridH = region.y + region.h - gridTop;

    const hour = registry.register('s04.hour',
      d3.scaleBand().domain(d3.range(24)).range([region.x, region.x + region.w]).paddingInner(0));
    const day = registry.register('s04.day',
      d3.scaleLinear().domain([0, Math.max(1, grid.days - 1)]).range([gridTop, gridTop + gridH]));
    const stripY = registry.register('s04.stripY',
      d3.scaleLinear().domain([0, 1]).range([stripTop + stripH, stripTop]));
    const restBand = registry.register('s04.restBand', { y: region.y, h: restBandH });

    // Comparison-lane y scale (Gate-5 item 2): "money per hour" and "what
    // the schedule's credit predicts" share one domain so the two curves
    // are directly comparable. The domain's 1.25x headroom over the true
    // max reserves clean space for each curve's own direct label -- never
    // fabricated padding data, just chart margin.
    const hm0 = (sj.hourly_money && sj.hourly_money.length === 24) ? sj.hourly_money : new Array(24).fill(0);
    const hc0 = (sj.hourly_credit && sj.hourly_credit.length === 24) ? sj.hourly_credit : new Array(24).fill(0);
    const compMax = Math.max(1, ...hm0, ...hc0) * 1.25;
    const bracketZoneH = compH * 0.32;
    const curveTop = compTop + bracketZoneH;
    const curveBottom = compTop + compH;
    const compY = registry.register('s04.compY',
      d3.scaleLinear().domain([0, compMax]).range([curveBottom, curveTop]));

    return {
      hour, day, stripY, compY,
      gridRect: { x: region.x, y: gridTop, w: region.w, h: gridH },
      stripRect: { x: region.x, y: stripTop, w: region.w, h: stripH },
      compRect: {
        x: region.x, y: compTop, w: region.w, h: compH,
        bracketZoneH, curveTop, curveBottom,
      },
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
    const { hour, day, stripY, compY, gridRect, stripRect, compRect } = scales;
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
    // REVISION (Gate-5 item 2, disposition 1, "fix the colliding axis
    // titles"): `gridRect.y - 28` was tuned for the pre-revision layout,
    // where the only thing above the grid was open air. Now the
    // comparison lane's own curves and their direct labels occupy that
    // same space right up to `compRect.curveBottom` -- at the old offset,
    // both titles rendered ON TOP of the curves and the hour-tick row
    // (confirmed in a re-capture: research/design-review/screens/
    // s04-b3-settled.png). Anchoring to `compRect.curveBottom + 16`
    // instead keeps both titles in the reserved gap below the chart and
    // above the tick row, regardless of exactly how tall the comparison
    // lane ends up.
    const titleY = compRect.curveBottom + 16;
    g.append('text').attr('class', 'axis-title axis-title-hour')
      .attr('x', gridRect.x + gridRect.w / 2).attr('y', titleY)
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
    // Shares `titleY` with the hour title above (both anchored to
    // `compRect.curveBottom`, see that comment). The two titles do not
    // collide with EACH OTHER because they occupy different x-ranges:
    // this one starts at gridRect.x, the hour title is centered on the
    // grid's full width, ~150px+ apart at any stage width this piece ships.
    g.append('text').attr('class', 'axis-title axis-title-day')
      .attr('x', gridRect.x).attr('y', titleY)
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

    // Comparison lane (Gate-5 item 2, disposition 1: "draw the
    // comparison"). Two small labeled curves -- money per hour vs. what
    // the schedule's credit predicts -- share the strip's hour x-axis in
    // their own reserved lane. The amber "US waking hours" bracket
    // (the scene's one amber unit, design-revision-spec S4 §1) anchors to
    // THIS lane's shaded gap, never to the grid's teal cells below -- the
    // prior placement (bracket sitting right at the grid's own top edge)
    // read as annexing the teal columns, per the author's screenshot.
    const hm = (sj.hourly_money && sj.hourly_money.length === 24) ? sj.hourly_money : new Array(24).fill(0);
    const hc = (sj.hourly_credit && sj.hourly_credit.length === 24) ? sj.hourly_credit : new Array(24).fill(0);
    const wb = sj.waking_band || { start_hour: 8, end_hour: 23 };
    // visibility (not display) so getBBox() below can measure the bracket
    // label while the group is still hidden -- same reason the prior band
    // group used visibility (Gate-4 blind re-review).
    const compG = g.append('g').attr('class', 's04-comparison').style('visibility', 'hidden');
    const lineX = (h) => hour(h) + hour.bandwidth() / 2;
    const moneyPts = hm.map((v, h) => ({ h, v }));
    const creditPts = hc.map((v, h) => ({ h, v }));

    // Shaded gap, waking-band hours only (8am-11pm ET, disposition 1):
    // the null-model disclosure's visual half. d3.area fills whatever the
    // two counted series actually do -- money ahead of credit in the
    // midday hours, credit ahead of money by primetime -- never a
    // one-sided dramatization of the gap.
    const gapPts = [];
    for (let h = wb.start_hour; h <= wb.end_hour; h++) gapPts.push({ h, m: hm[h] || 0, c: hc[h] || 0 });
    const gapArea = d3.area().x((d) => lineX(d.h)).y0((d) => compY(d.m)).y1((d) => compY(d.c));
    compG.append('path').attr('class', 's04-gap-area')
      .attr('d', gapArea(gapPts))
      .attr('fill', view.css('accent-annotation')).attr('fill-opacity', 0.16).attr('stroke', 'none');

    // The two curves. Money in identity-teal -- the same "this is real
    // money" hue the grid's in-window cells use, so the color grammar
    // stays one meaning piece-wide. The schedule's credit in ink-mid
    // dashes: a counted, never-traded quantity, so it takes the key's
    // own "dashed reads as derived" grammar instead of a second solid hue.
    const moneyLine = d3.line().x((d) => lineX(d.h)).y((d) => compY(d.v));
    const creditLine = d3.line().x((d) => lineX(d.h)).y((d) => compY(d.v));
    compG.append('path').attr('fill', 'none')
      .attr('stroke', view.css('identity-teal')).attr('stroke-width', 1.75)
      .attr('d', moneyLine(moneyPts));
    compG.append('path').attr('fill', 'none')
      .attr('stroke', view.css('ink-mid')).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '2,3')
      .attr('d', creditLine(creditPts));

    // Direct labels (each curve names itself, per the beat's own "two
    // small labeled curves"), placed where that series most clearly
    // leads the other -- data-derived positions, not a fixed corner that
    // could land mid-line on a re-pulled tape.
    function biggestLead(pts, other) {
      let best = 0;
      for (let h = 0; h < pts.length; h++) {
        const lead = pts[h].v - other[h].v;
        if (lead > pts[best].v - other[best].v) best = h;
      }
      return pts[best];
    }
    const moneyLabelAt = biggestLead(moneyPts, creditPts);
    const creditLabelAt = biggestLead(creditPts, moneyPts);
    compG.append('text')
      .attr('x', lineX(moneyLabelAt.h)).attr('y', compY(moneyLabelAt.v) - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', view.css('identity-teal'))
      .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
      .text('money per hour');
    compG.append('text')
      .attr('x', lineX(creditLabelAt.h)).attr('y', compY(creditLabelAt.v) - 8)
      .attr('text-anchor', creditLabelAt.h < 4 ? 'start' : 'middle')
      .attr('fill', view.css('ink-mid'))
      .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
      .text("what the schedule's credit predicts");

    // The amber bracket itself: same slim tick-and-label shape the prior
    // grid-top version used, now anchored to the comparison lane's own
    // reserved bracket zone, directly above the shaded gap it describes.
    const bandX = hour(wb.start_hour);
    const bandW = hour(wb.end_hour) - hour(wb.start_hour) + hour.bandwidth();
    const bracketY = compRect.y + compRect.bracketZoneH - 10;
    compG.append('rect')
      .attr('x', bandX).attr('width', bandW)
      .attr('y', bracketY - 3).attr('height', 3)
      .attr('fill', view.css('accent-annotation'));
    compG.append('line').attr('x1', bandX).attr('x2', bandX)
      .attr('y1', bracketY - 3).attr('y2', bracketY + 10)
      .attr('stroke', view.css('accent-annotation')).attr('stroke-width', 1.5);
    compG.append('line').attr('x1', bandX + bandW).attr('x2', bandX + bandW)
      .attr('y1', bracketY - 3).attr('y2', bracketY + 10)
      .attr('stroke', view.css('accent-annotation')).attr('stroke-width', 1.5);
    // REVISION (Gate-5 item 2): "about twice the schedule alone" was a
    // pre-recompute estimate. The shipped `waking_residual` (1.2161) is
    // the real, class-A-recomputed figure -- the label now quotes that
    // instead, matching the beat's own prose exactly.
    const residual = typeof sj.waking_residual === 'number' ? sj.waking_residual : null;
    const residualText = residual ? `${residual.toFixed(1)}x` : 'more';
    const bandLabel = compG.append('text')
      .attr('x', bandX + bandW - 12).attr('y', bracketY - 10)
      .attr('text-anchor', 'end')
      .attr('fill', view.css('accent-annotation'))
      .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
      .text(`US waking hours: about ${residualText} the schedule's credit`);
    // Gate-4 visual-story review: this amber label previously sat
    // directly on the bright teal/white cell field at ~1.4:1 contrast
    // (perception-brief §9a). It now sits inside its own reserved lane,
    // clear of every cell, and keeps the bg-canvas scrim behind the
    // glyphs as a second line of defense.
    const bandBB = bandLabel.node().getBBox();
    compG.insert('rect', 'text')
      .attr('x', bandBB.x - 8).attr('y', bandBB.y - 4)
      .attr('width', bandBB.width + 16).attr('height', bandBB.height + 8)
      .attr('rx', 3)
      .attr('fill', view.css('bg-canvas')).attr('opacity', 0.85);

    // Rest-day row markers + caption (structure-spec S4 §2: the drop-ratio
    // ratios demote out of prose into this caption). Gate-5 provenance
    // audit: this used to be a hand-typed "5-15x / ~3x" literal; two of
    // the six days it was computed over (Jul 18/19) turned out to be the
    // third-place playoff and the final, not rest days at all, once
    // match_windows.parquet gained their listed kickoffs. Recomputed live
    // (sj.rest_day_ratios, same pattern as the waking-hours label above)
    // over the correct 4-day set instead of re-typing a fresh literal.
    const restDays = sj.rest_days || [];
    const rdr = sj.rest_day_ratios || {};
    const restG = g.append('g').attr('class', 's04-rest-days').style('display', 'none');
    restG.selectAll('line').data(restDays).join('line')
      .attr('x1', gridRect.x - 6).attr('x2', gridRect.x)
      .attr('y1', (d) => day(Math.floor((Date.parse(d) - day0Ms) / 86400000)))
      .attr('y2', (d) => day(Math.floor((Date.parse(d) - day0Ms) / 86400000)))
      .attr('stroke', view.css('ink-mid')).attr('stroke-width', 2);
    const hasRatios = [rdr.all_tape_min_x, rdr.all_tape_max_x, rdr.futures_min_x, rdr.futures_max_x]
      .every((v) => typeof v === 'number');
    const restCaptionText = hasRatios
      ? `rest days: trading drops ${rdr.all_tape_min_x}-${rdr.all_tape_max_x}x; the always-open winner market, only about ${rdr.futures_min_x}-${rdr.futures_max_x}x`
      : 'rest days: trading drops sharply; the always-open winner market falls much less';
    restG.append('text')
      .attr('x', gridRect.x - 6).attr('y', gridRect.y + gridRect.h + 24)
      .attr('text-anchor', 'start')
      .attr('fill', view.css('ink-mid'))
      .style('font', `var(--type-caption-size) var(--font-apparatus)`)
      .text(restCaptionText);

    return {
      step(beatId) {
        if (beatId === 'b1') {
          stripG.style('display', 'none');
          compG.style('visibility', 'hidden');
          restG.style('display', 'none');
        } else if (beatId === 'b2') {
          stripG.style('display', null);
        } else if (beatId === 'b3') {
          compG.style('visibility', 'visible');
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
      grain: { text: '1 dot = {grainUsd} of real money traded' },
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
      html: '<p>The market gets loud when games kick off, and goes quiet when they do not. Kickoff windows cover about a third of the tournament&rsquo;s hours. But they capture 50.7% of all the money traded, about 1.7 times their fair share.<sup><a href="#fn-6">6</a></sup> The grid on this screen is really just a picture of the match schedule. Watch the grid change color now. Teal marks kickoff windows.</p>',
      trigger: 'step',
      state: 'recolored',
      kind: 'recolor',
      // REVISION (Gate-5 item 2, disposition 1): the kickoff-histogram
      // strip has been on screen since this beat started but had no key
      // row of its own (the author's own observation: "the top bar chart
      // is absent from the key"). Added here, once, so it stays on
      // screen unchanged through b3 (see the b3 comment below) instead of
      // re-triggering the key's pulse when the amber annotation lands.
      chip: [
        { token: 'identity-teal', glyph: 'dot', label: 'teal = money inside match windows' },
        { token: 'identity-ref', glyph: 'dim', label: 'dim = the off-peak clock' },
        { token: 'neutral-data', glyph: 'block', label: 'grey bars = scheduled kickoffs per hour' },
      ],
    },
    {
      // REVISION (Gate-5 item 2, all five dispositions -- this is the
      // beat the author's own feedback calls "beat 2," the scene's first
      // beat with a real reading to take away): b3 still does not
      // redefine the chip (the key from b2 stays on screen unchanged), so
      // entering b3 does not re-fire the key's amber pulse alongside the
      // amber annotation -- amber stays a true singleton (perception-
      // brief §9a). b3's own state (recoloredDim) recedes the in-window
      // teal to ground-tier brightness ("the day-grid dims beneath") so
      // it no longer competes with the comparison lane's amber gap for
      // the luminance peak. Prose order: concede-then-quantify open with
      // the corrected, class-A-recomputed figure (waking_residual 1.2161,
      // not the pre-recompute "twice"); the null-model disclosed in one
      // plain counting sentence; the strawman and the "wide awake"
      // metaphor both replaced with the author's own plain wording; the
      // beat closes teaching the clock-reading skill the whole scene has
      // been building toward.
      id: 'b3',
      html: '<p>An American exchange trades on American time. No surprise there. Even after the schedule&rsquo;s own credit, the waking hours still run about 20 percent heavier: from 8 a.m. to 11 p.m. Eastern, trading runs about 1.2 times what the schedule&rsquo;s credit predicts.<sup><a href="#fn-6">6</a></sup> Modest, but real. No model here, just counting: give every hour credit for the match minutes scheduled inside it, then compare the money to the credit. The lines above the grid show it, hour by hour. Tonight&rsquo;s final kicks off in United States primetime. Heavy trading tonight means a big crowd holding real money is present. Volume tells you how many are watching. The price tells you what they believe. When tonight&rsquo;s final ends, the crowd will already be here: the price will move within seconds of the whistle, not overnight. A move at 3 a.m. has a thin crowd behind it. A move in primetime has the deepest crowd of the day.</p>',
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
