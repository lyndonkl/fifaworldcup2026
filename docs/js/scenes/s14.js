/* docs/js/scenes/s14.js — S14 · Act IV · "The one real sin" (storyboard §3,
 * R7; shares its visual spine with S5 per the dossier's cross-arm note).
 * Layout: `calibration-curve`.
 *
 * Contract: docs/CONTRACT.md §4 (scene module shape), §4.2 (registry row:
 * act 4, 4 steps + a live toggle, no zoom tile). Tokens are law.
 *
 * MOBILE (storyboard S14 Mobile note): "Toggle becomes a large segmented
 * control; bucket count unchanged." The toggle below is already a large
 * segmented control per the design system (§9 S14 note: "amber-active
 * segmented control, 12.6:1, keyboard accessible"); view.mobile only
 * widens its hit targets and stacks it above the curve instead of beside
 * it, and bucket geometry (all 20 buckets) is identical on every surface.
 *
 * DATA REQUESTS:
 *   1. `buckets[]` is close to a direct join of the two real pipeline
 *      tables this build inspected —
 *      pipeline/data/analysis/bias-forensics/flb_kalshi_buckets.parquet
 *      (columns: bucket, n_markets, n_yes, mean_price_c, win_rate,
 *      total_volume, win_rate_pct, calibration_gap_pp) and
 *      flb_kalshi_buckets_volweighted.parquet (bucket, n_markets,
 *      total_volume, vol_weighted_price_c, vol_weighted_win_rate_pct,
 *      calibration_gap_pp). Confirmed by recomputation during this build:
 *      the market-weighted 1-5c + 5-10c buckets combine to exactly the
 *      dossier's "implied 3.04% paying 1.19%" cheap-band figure. Both
 *      tables use 5-cent bucket labels ("1-5c" ... "95-100c", 20 rows) —
 *      this module needs each bucket's numeric `lo_c`/`hi_c` shipped
 *      explicitly (it falls back to parsing the label string if absent,
 *      but the tile builder should ship the parsed ints so the browser
 *      never depends on a label format).
 *   2. `ladder_attribution` (72% of cheap-band observations in ladders of
 *      ten-plus legs, 55% at the 1-2c tick floor) is NOT present in either
 *      bucket table; it is derivable from
 *      pipeline/data/analysis/bias-forensics/flb_kalshi_market_level.parquet
 *      (27,832 rows; has `series_ticker`, which groups legs into their
 *      prop family) joined against a per-series leg count and the 1-10c
 *      cheap band. Flagging the derivation rather than recomputing it here
 *      — the exact ladder-size threshold and tick-floor definition should
 *      match whatever the dossier's R7 pipeline arm already used.
 *   3. This scene's toggle is the piece's one mid-narrative interactive
 *      that must reach the ENGINE (re-light which dots carry emphasis
 *      under dollar weighting) from inside overlay(), but CONTRACT §4
 *      only lets `main.js` call INTO an overlay handle ({step, scrub,
 *      exit}) — there is no documented reverse channel for a scene's
 *      html-overlay control to request `engine.tween(...)`. This module
 *      calls an optional `container.activate(stateKey, opts)` if main.js
 *      provides one, and no-ops otherwise (so it degrades to "the D3
 *      marker moves, the dot cloud does not re-light" rather than
 *      throwing). Requesting CONTRACT §4/§6.3 be amended to pass an
 *      `activate` callback into the container object handed to overlay(),
 *      or an equivalent documented convention, so S14's toggle (and any
 *      future mid-scene interactive) can drive the engine outside the
 *      scroll-triggered beat flow.
 */

/* global d3 */
import { registry, makeState, setColor } from '../shared.js';

/* ---------------------------------------------------------------- */

function hash01(i, salt) {
  let x = (i * 2654435761 + salt) >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return (x >>> 0) / 4294967296;
}

function fieldPosition(i, view) {
  const fx = view.region.x + hash01(i, 0x27d4eb2f) * view.region.w;
  const fy = view.region.y + hash01(i, 0x165667b1) * view.region.h;
  return [fx, fy];
}

/* Parse "NN-MMc" / "NN-100c" bucket labels as a fallback if the tile
 * builder has not yet shipped explicit lo_c/hi_c (see data request #1). */
function parseBucketBounds(bucket) {
  if (typeof bucket.lo_c === 'number' && typeof bucket.hi_c === 'number') {
    return [bucket.lo_c, bucket.hi_c];
  }
  const m = /^(\d+)-(\d+)c$/.exec(bucket.label || bucket.bucket || '');
  if (!m) return [0, 0];
  return [+m[1], +m[2]];
}

/* ---------------------------------------------------------------- */

function scales(data, view) {
  const x = d3.scaleLinear().domain([0, 100]).range([view.region.x, view.region.x + view.region.w]);
  const yTop = view.region.y;
  const yBottom = view.region.y + view.region.h;
  const y = d3.scaleLinear().domain([0, 100]).range([yBottom, yTop]);
  registry.register('s14.x', x);
  registry.register('s14.y', y);
  return { x, y };
}

/* ---------------------------------------------------------------- */

function layout(data, view) {
  const N = data.pop.count;
  const pop = data.pop;
  const sceneJson = data.scene || {};
  const buckets = (sceneJson.buckets || []).map((b) => {
    const [lo, hi] = parseBucketBounds(b);
    return { ...b, lo_c: lo, hi_c: hi };
  });

  const x = registry.get('s14.x');
  const y = registry.get('s14.y');
  const baseSize = view.tokens.dot['radius-base-px'];
  // Resting field (the mixed-price dots that never join the curve) uses the
  // dimmed-field tint (dimmed-field-min, 0.25 alpha), not the standard rest
  // tint, so the field recedes and the curve reads as figure. That low alpha
  // lands in the engine's rest-classify tier, so the shader dims it while
  // boosting the amber tail (alpha 0.9 = active-classify-min)
  // (research/revision/perception-brief.md §9b, §10.1); matches this scene's
  // own S16 curve anchor, which already dims to dimmed-field-min.
  // Fresh blind review (s14 critical #1, perception-brief §4/§9b): b1-t0
  // read as an undifferentiated bright snow field. An earlier version of
  // this fix tried an extra instant pre-tween (a second engine.tween()
  // call fired synchronously ahead of the beat's own resort) to snap the
  // field dim before the condensation starts; re-capture testing showed
  // that back-to-back tween() pair intermittently left the population
  // stuck at the pre-tween state (a new, previously-unexercised call
  // pattern -- no other scene fires engine.tween() from inside overlay()'s
  // synchronous top-level body). Reverted as too risky for a bounded pass.
  // What stays: the resting field's alpha, pushed below dimmed-field-min
  // (0.25) to 0.15, the same escalation s01 used for the identical P1
  // failure mode ("un-keyed near-white column... drop the in-zoom field to
  // 0.10 alpha," docs/js/scenes/s01.js) -- a same-call-path, zero-risk
  // change that measurably dims the settled/mid reading. It does not fully
  // solve the t0 residue from whatever the previous scene left on screen
  // (that needs the piece-wide Tier 0.1 engine cap, already deferred to
  // the author per research/design-review/visual-story-review.md).
  const restRgba = view.color('field-rest', 0.15);
  const neutral = view.color('neutral-data', 0.6);
  const tail = view.color('accent-annotation', 0.9);
  const tailBit = data.flagBit('LORENZ_TAIL');

  const marketsState = makeState(N);
  const dollarsState = makeState(N);

  for (let i = 0; i < N; i++) {
    const [fx, fy] = fieldPosition(i, view);
    marketsState.x[i] = fx; marketsState.y[i] = fy;
    dollarsState.x[i] = fx; dollarsState.y[i] = fy;
    setColor(marketsState.color, i, restRgba);
    setColor(dollarsState.color, i, restRgba);
    marketsState.size[i] = baseSize;
    dollarsState.size[i] = baseSize;
  }

  // Reference dollar value for the emphasis heuristic below: a dot near
  // the population's own grain reads as "typical," larger dots read as
  // heavier. This modulates ALPHA only — dot size never changes (§0).
  const grainUsd = (view.grain && view.grain.usd) || 75000;

  for (let i = 0; i < N; i++) {
    const priceC = pop.price_band[i];
    if (priceC === 255) continue; // mixed bucket: stays in the dim field
    const bucket = buckets.find((b) => priceC >= b.lo_c && priceC < b.hi_c)
      || (priceC === 100 ? buckets.find((b) => b.hi_c === 100) : undefined);
    if (!bucket) continue;

    const isTail = (pop.flags[i] & tailBit) !== 0;
    const jx = (hash01(i, 0x9e3779b9) - 0.5) * 10;
    const jy = (hash01(i, 0x85ebca6b) - 0.5) * 8;

    // Markets-weighted position + emphasis: uniform alpha, the "sag" is
    // whatever the bucket's own market-weighted realized rate shows.
    marketsState.x[i] = x(bucket.mean_price_c) + jx;
    marketsState.y[i] = y(bucket.win_rate_pct) + jy;
    setColor(marketsState.color, i, isTail ? tail : neutral);

    // Dollars-weighted position + emphasis: same bucket membership (a
    // dot's own price_band does not change), repositioned to the bucket's
    // dollar-weighted realized rate, with per-dot alpha lit by how much
    // money this specific dot actually carries (data.pop.dollars — real,
    // never invented) so "which dots carry emphasis" is legible.
    const dollars = pop.dollars[i];
    const litAlpha = Math.max(0.3, Math.min(1, 0.3 + 0.7 * (dollars / (grainUsd * 3))));
    const dw = bucket.vol_weighted_win_rate_pct !== undefined ? bucket.vol_weighted_win_rate_pct : bucket.win_rate_pct;
    const dwx = bucket.vol_weighted_price_c !== undefined ? bucket.vol_weighted_price_c : bucket.mean_price_c;
    dollarsState.x[i] = x(dwx) + jx;
    dollarsState.y[i] = y(dw) + jy;
    const base = isTail ? tail : neutral;
    setColor(dollarsState.color, i, [base[0], base[1], base[2], base[3] * litAlpha]);
  }

  return { states: { 'assemble-markets': marketsState, 'assemble-dollars': dollarsState } };
}

/* ---------------------------------------------------------------- */

function overlay(container, data, view, scalesObj) {
  const sceneJson = data.scene || {};
  const buckets = (sceneJson.buckets || []).map((b) => {
    const [lo, hi] = parseBucketBounds(b);
    return { ...b, lo_c: lo, hi_c: hi };
  });
  const x = scalesObj.x;
  const y = scalesObj.y;

  const g = container.svg.append('g').attr('class', 's14-overlay');

  // Axes.
  g.append('g')
    .attr('transform', `translate(0, ${view.region.y + view.region.h})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `${d}c`))
    .call((sel) => sel.selectAll('text, line, path').style('stroke', view.css('ink-low')).style('fill', view.css('ink-low')));
  g.append('g')
    .attr('transform', `translate(${view.region.x}, 0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`))
    .call((sel) => sel.selectAll('text, line, path').style('stroke', view.css('ink-low')).style('fill', view.css('ink-low')));

  // Axis titles (design-revision-spec G3): x centered below the tick
  // labels; y horizontal (never rotated), left-aligned above its axis.
  g.append('text')
    .attr('class', 's14-axis-x-title')
    .attr('x', view.region.x + view.region.w / 2)
    .attr('y', view.region.y + view.region.h + 38)
    .attr('text-anchor', 'middle')
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-caption-size'))
    .style('font-weight', 500)
    .style('fill', view.css('ink-mid'))
    .text('what the price implied (cents = % chance)');
  g.append('text')
    .attr('class', 's14-axis-y-title')
    .attr('x', view.region.x)
    .attr('y', view.region.y - 46)
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-caption-size'))
    .style('font-weight', 500)
    .style('fill', view.css('ink-mid'))
    .text('how often it actually happened (%)');

  // Calibration diagonal: implied == realized.
  g.append('line')
    .attr('x1', x(0)).attr('y1', y(0))
    .attr('x2', x(100)).attr('y2', y(100))
    .style('stroke', view.css('ink-hero'))
    .style('stroke-width', 1.5)
    .style('opacity', 0.6);

  // "Perfectly priced" (G3: the one licensed rotated label piece-wide,
  // because it names the diagonal line itself, not a data point).
  {
    const diagDeg = Math.atan2(y(100) - y(0), x(100) - x(0)) * (180 / Math.PI);
    const midX = x(64);
    const midY = y(64) - 10;
    g.append('text')
      .attr('class', 's14-diagonal-label')
      .attr('x', midX).attr('y', midY)
      .attr('transform', `rotate(${diagDeg}, ${midX}, ${midY})`)
      .attr('text-anchor', 'middle')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-caption-size'))
      .style('fill', view.css('ink-hi'))
      .style('opacity', 0.65)
      .text('perfectly priced');
  }

  // Realized-rate marker path, connecting each bucket's active-weighting
  // point — the exact mark the toggle re-positions (storyboard: "the
  // toggle... re-positions each bucket's realized-rate marker"). Ink-hi,
  // outline-only (design-revision-spec per-scene S14 #1): `side.no` means
  // "no buyer" everywhere else in the piece, so painting these markers
  // orange actively misreads as "NO money" here.
  // Ghost of the count-weighted curve on the MAIN chart (major #3: the
  // dollar reweighting needs a visible before/after here, not only in the
  // corner inset). Appended before markerPath so it always paints
  // underneath the live line; hidden until the toggle actually leaves
  // 'markets'.
  const mainGhost = g.append('path')
    .attr('class', 's14-marker-ghost')
    .style('fill', 'none')
    .style('stroke', view.css('ink-low'))
    .style('stroke-width', 1.5)
    .style('stroke-dasharray', '4,3')
    .style('opacity', 0);

  const markerPath = g.append('path')
    .attr('class', 's14-marker-path')
    .style('fill', 'none')
    .style('stroke', view.css('ink-hi'))
    .style('stroke-width', 2);
  const markerDots = g.append('g').attr('class', 's14-marker-dots');

  // Mode label (major #3: the reweighting previously read as an
  // unexplained re-draw -- nothing on screen said the chart had changed
  // what it was counting). Sits in the chart's own clear top-left corner
  // and re-fires its onset transition on every real change, per the
  // change-blindness countermeasure in perception-brief §7.
  // Text-collision sweep (Gate-5 item 3 disposition 2): region.y - 8 was
  // set when ladderCaption below was still one line. ladderCaption grew a
  // second tspan (dy 1.2em) once the tick-floor stat shipped, and nobody
  // moved this label to match -- its baseline (region.y - 8) landed just
  // 6px under ladderLine2's (region.y - 13.8), so "55% sit at the
  // one-to-two-cent tick floor." and "weighted by: ..." rendered on top
  // of each other on every beat past b1. region.y + 6 clears ladderLine2
  // by the same ~16px gap every other line in this stack already uses,
  // just inside the plot's empty top-left corner instead of above it.
  const modeLabel = g.append('text')
    .attr('class', 's14-mode-label')
    .attr('x', view.region.x + 4)
    .attr('y', view.region.y + 6)
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-caption-size'))
    .style('font-weight', 600)
    .style('fill', view.css('ink-hi'))
    .text('weighted by: count of markets, equally');

  const line = d3.line().x((d) => x(d.px)).y((d) => y(d.py)).curve(d3.curveMonotoneX);

  // Visual weight proportional to sample size (Gate-4 visual-story review,
  // s14: "eye lands on noisy small-sample oscillation"): a bucket built
  // from a handful of markets should not read with the same weight as one
  // built from thousands. Radius only -- never position or color -- so this
  // never invents a number, it just sizes the mark by one already-loaded
  // real field (bucket.n_markets). A second scale, keyed to the bucket's
  // own dollar volume, does the same job for the dollars-weighted reading
  // (major #3: the loud high-price wiggle must visibly belong to
  // near-zero dollar weight, or it reads as "the market got worse"
  // instead of "that bucket barely traded").
  const markerRadiusScale = d3.scaleSqrt()
    .domain([0, d3.max(buckets, (b) => b.n_markets || 0) || 1])
    .range([2, 6]).clamp(true);
  const dollarRadiusScale = d3.scaleSqrt()
    .domain([0, d3.max(buckets, (b) => b.total_volume || 0) || 1])
    .range([1.5, 7]).clamp(true);

  function markerData(weighting) {
    return buckets.map((b) => ({
      px: weighting === 'dollars' && b.vol_weighted_price_c !== undefined ? b.vol_weighted_price_c : b.mean_price_c,
      py: weighting === 'dollars' && b.vol_weighted_win_rate_pct !== undefined ? b.vol_weighted_win_rate_pct : b.win_rate_pct,
      label: b.label || b.bucket,
      n: b.n_markets || 0,
      vol: b.total_volume || 0,
      cheap: b.hi_c <= 10,
    }));
  }

  function radiusFor(weighting, dd) {
    return weighting === 'dollars' ? dollarRadiusScale(dd.vol) : markerRadiusScale(dd.n);
  }

  // Amber singleton protocol (major #5): the penny-ticket buckets (1-10c,
  // the chip's own "amber = the overpriced penny tickets" row) are the
  // ONLY filled-amber markers; every other bucket is a solid pale fill
  // matching the chip's "pale = money at each price level" row. Filled,
  // not hollow, so the particle cloud underneath can no longer bleed
  // through an empty circle and read as a curve-wide diluted yellow cast.
  function fillFor(dd) {
    return dd.cheap ? view.css('accent-annotation') : view.css('neutral-data');
  }

  function drawMarkers(weighting, animate) {
    const d = markerData(weighting);
    const sel = markerPath.datum(d);
    if (animate) sel.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).attr('d', line);
    else sel.attr('d', line);

    const dots = markerDots.selectAll('circle').data(d);
    dots.enter().append('circle').attr('r', (dd) => radiusFor(weighting, dd))
      .style('fill', fillFor)
      .style('stroke', view.css('bg-canvas'))
      .style('stroke-width', 1)
      .merge(dots)
      .style('fill', fillFor)
      .transition().duration(animate ? view.tokens.motion.durations_ms['overlay-draw-in'] : 0)
      .attr('r', (dd) => radiusFor(weighting, dd))
      .attr('cx', (dd) => x(dd.px)).attr('cy', (dd) => y(dd.py));
    dots.exit().remove();
  }

  function drawMainGhost(weighting) {
    const dur = view.tokens.motion.durations_ms['overlay-draw-in'];
    if (weighting === 'dollars') {
      mainGhost.datum(markerData('markets')).attr('d', line)
        .transition().duration(dur).style('opacity', 0.6);
    } else {
      mainGhost.transition().duration(dur).style('opacity', 0);
    }
  }

  // RESHAPE: inset 0-10c magnifier (design-revision-spec ask: "an inset
  // 0-10c magnifier panel for the penny-ticket story"). The main axes span
  // the whole 0-100c domain, so the penny-ticket gap -- implied ~2-7c,
  // realized a fraction of a percent -- is a 2-3px sliver against the
  // origin. This re-plots the SAME two bucket rows (1-5c, 5-10c; no new
  // numbers) at a zoomed scale in the chart's one empty corner (high-price
  // buckets sit near the top-right at 70-99% realized; the bottom-right,
  // high-price/low-realized corner is empty in this data, per the loaded
  // buckets, so the inset covers no real mark).
  const cheapBuckets = buckets.filter((b) => b.hi_c <= 10).sort((a, b) => a.lo_c - b.lo_c);
  // Defensive default (this file's established pattern, e.g. s10's "degrades
  // to an empty line"): if the cheap buckets are absent, the toggle/beat
  // calls below still have something to call.
  let drawInset = () => {};
  if (cheapBuckets.length) {
    const insetW = 190;
    const insetH = 130;
    const insetPad = 30;
    const insetX0 = view.region.x + view.region.w - insetW - 8;
    const insetY0 = view.region.y + view.region.h - insetH - 8;
    const insetMax = 10;

    const insetG = g.append('g').attr('class', 's14-inset');
    insetG.append('rect')
      .attr('x', insetX0).attr('y', insetY0)
      .attr('width', insetW).attr('height', insetH)
      .style('fill', view.css('bg-card'))
      .style('fill-opacity', 0.88)
      .style('stroke', view.css('ink-low'))
      .style('stroke-dasharray', '2,3')
      .style('stroke-opacity', 0.6)
      .style('stroke-width', 1);
    insetG.append('text')
      .attr('x', insetX0 + 10).attr('y', insetY0 + 16)
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-micro-size'))
      .style('fill', view.css('ink-mid'))
      .text('0 to 10 cents, magnified');

    const ix = d3.scaleLinear().domain([0, insetMax]).range([insetX0 + insetPad, insetX0 + insetW - 14]);
    const iy = d3.scaleLinear().domain([0, insetMax]).range([insetY0 + insetH - 18, insetY0 + 30]);

    insetG.append('g')
      .attr('transform', `translate(0, ${insetY0 + insetH - 18})`)
      .call(d3.axisBottom(ix).ticks(2).tickFormat((d) => `${d}c`))
      .call((sel) => sel.selectAll('text').style('font-size', '9px').style('fill', view.css('ink-low')).style('font-family', view.css('font-apparatus')))
      .call((sel) => sel.selectAll('line, path').style('stroke', view.css('ink-low')));
    insetG.append('g')
      .attr('transform', `translate(${insetX0 + insetPad}, 0)`)
      .call(d3.axisLeft(iy).ticks(2).tickFormat((d) => `${d}%`))
      .call((sel) => sel.selectAll('text').style('font-size', '9px').style('fill', view.css('ink-low')).style('font-family', view.css('font-apparatus')))
      .call((sel) => sel.selectAll('line, path').style('stroke', view.css('ink-low')));

    // The same "perfectly priced" promise, at this zoom.
    insetG.append('line')
      .attr('x1', ix(0)).attr('y1', iy(0)).attr('x2', ix(insetMax)).attr('y2', iy(insetMax))
      .style('stroke', view.css('ink-hero')).style('stroke-width', 1).style('opacity', 0.5);

    // A matching dashed bracket on the MAIN chart marks exactly the region
    // this inset zooms into -- same corner, same dash style -- so the two
    // panels read as one shape at two scales without a leader line crossing
    // the whole chart.
    g.append('rect')
      .attr('x', x(0)).attr('y', y(insetMax))
      .attr('width', x(insetMax) - x(0)).attr('height', y(0) - y(insetMax))
      .style('fill', 'none').style('stroke', view.css('ink-low'))
      .style('stroke-dasharray', '2,3').style('stroke-width', 1).style('opacity', 0.5);

    const insetLineGen = d3.line().x((d) => ix(d.px)).y((d) => iy(d.py)).curve(d3.curveMonotoneX);

    // Ghost: the market-weighted (count-every-market-equally) reading
    // always shows underneath, dashed and dim, so the inset carries the
    // "same tickets, different weighting" comparison on its own, without
    // asking the reader to remember the earlier frame.
    const insetGhost = insetG.append('path').attr('class', 's14-inset-ghost')
      .style('fill', 'none').style('stroke', view.css('ink-low'))
      .style('stroke-width', 1.5).style('stroke-dasharray', '3,2').style('opacity', 0.85);
    const insetLive = insetG.append('path').attr('class', 's14-inset-live')
      .style('fill', 'none').style('stroke', view.css('ink-hi')).style('stroke-width', 2);
    const insetLiveDots = insetG.append('g').attr('class', 's14-inset-live-dots');
    const insetPointLabel = insetG.append('text')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', '10px')
      .style('fill', view.css('ink-hi'));

    drawInset = function drawInset(weighting) {
      const insetPointsFor = (w) => cheapBuckets.map((b) => ({
        px: w === 'dollars' && b.vol_weighted_price_c !== undefined ? b.vol_weighted_price_c : b.mean_price_c,
        py: w === 'dollars' && b.vol_weighted_win_rate_pct !== undefined ? b.vol_weighted_win_rate_pct : b.win_rate_pct,
      }));
      insetGhost.attr('d', insetLineGen(insetPointsFor('markets')));
      const live = insetPointsFor(weighting);
      insetLive.attr('d', insetLineGen(live));
      const dots = insetLiveDots.selectAll('circle').data(live);
      dots.enter().append('circle').attr('r', 2.5).style('fill', view.css('ink-hi'))
        .merge(dots).attr('cx', (d) => ix(d.px)).attr('cy', (d) => iy(d.py));
      dots.exit().remove();
      const worst = live[0]; // 1-5c: the deepest part of the sag
      if (worst) {
        insetPointLabel
          .attr('x', ix(worst.px) + 7).attr('y', iy(worst.py) - 6)
          .text(`paid ${worst.py.toFixed(1)}%`);
      }
    };
  }

  // Ladder-attribution caption (72% / 55%), one two-line ink-mid block
  // (design-revision-spec per-scene S14 #2), sitting above the y-axis
  // title so the two never collide.
  const ladderCaption = g.append('text')
    .attr('x', view.region.x)
    .attr('y', view.region.y - 30)
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-caption-size'))
    .style('fill', view.css('ink-mid'))
    .style('opacity', 0);
  const ladderLine1 = ladderCaption.append('tspan').attr('x', view.region.x).attr('dy', '0em');
  const ladderLine2 = ladderCaption.append('tspan').attr('x', view.region.x).attr('dy', '1.2em');

  // Tick-floor bracket at 1-2c.
  const tickFloor = sceneJson.tick_floor || { lo_c: 1, hi_c: 2 };
  const tickBracket = g.append('g').attr('class', 's14-tick-bracket').style('opacity', 0);
  tickBracket.append('line')
    .attr('x1', x(tickFloor.lo_c)).attr('x2', x(tickFloor.hi_c))
    .attr('y1', view.region.y + view.region.h + 34).attr('y2', view.region.y + view.region.h + 34)
    .style('stroke', view.css('ink-low')).style('stroke-width', 1.5);
  tickBracket.append('text')
    .attr('x', x(tickFloor.lo_c)).attr('y', view.region.y + view.region.h + 48)
    .style('font-family', view.css('font-tape'))
    .style('font-size', view.css('type-tape-size'))
    .style('fill', view.css('ink-low'))
    .text(`${tickFloor.lo_c}-${tickFloor.hi_c} cents: the tick floor`);

  // 90-95c callout: the amber singleton protocol (halo core ring), an
  // overlay-only highlight independent of the current toggle weighting.
  // Major #4: this used to fire from inside setWeighting(), so it appeared
  // one beat early (during b3's reweighting, competing with that beat's
  // own change) and left b4 with nothing new to show. `calloutUnlocked`
  // gates the first real appearance to b4-t0; once unlocked, later toggle
  // clicks still reposition it correctly (the gate only affects the
  // beat-boundary timing, not the toggle's own behavior).
  let calloutUnlocked = false;
  const callout = g.append('g').attr('class', 's14-callout').style('opacity', 0);
  function drawCallout(weighting) {
    callout.selectAll('*').remove();
    if (!calloutUnlocked) return;
    // Gate-5 provenance audit (WRONG_SCOPE): the SAME hardcoded "90-95c"
    // used to render under both toggle states, but 90-95c is only the
    // worst bucket on the market-count basis -- under dollar weighting,
    // 65-70c misprices by a wider margin. Each basis now has its own
    // data-bound worst-bucket label, selected by the active toggle.
    const label = (weighting === 'dollars'
      ? sceneJson.worst_bucket_label_dollars
      : sceneJson.worst_bucket_label_markets) || sceneJson.worst_bucket_label || '90-95c';
    const b = buckets.find((bb) => (bb.label || bb.bucket) === label);
    if (!b) return;
    const px = weighting === 'dollars' && b.vol_weighted_price_c !== undefined ? b.vol_weighted_price_c : b.mean_price_c;
    const py = weighting === 'dollars' && b.vol_weighted_win_rate_pct !== undefined ? b.vol_weighted_win_rate_pct : b.win_rate_pct;
    callout.append('circle')
      .attr('cx', x(px)).attr('cy', y(py))
      .attr('r', view.tokens.dot['radius-annotated-halo-px'])
      .style('fill', 'none')
      .style('stroke', view.css('accent-annotation'))
      .style('stroke-width', view.css('dot-halo-stroke-px'));
    callout.append('circle')
      .attr('cx', x(px)).attr('cy', y(py))
      .attr('r', view.tokens.dot['radius-annotated-core-px'])
      .style('fill', view.css('accent-annotation'));
    // Trimmed to the 8-word annotation cap (design-revision-spec CR-14).
    // The 90-95c bucket sits near the domain's right edge, where a
    // right-reading label would run past the chart -- mirror left (G5)
    // when that's the case, same as this scene's other at-mark labels.
    const calloutMirror = x(px) + 14 + 260 > view.region.x + view.region.w;
    callout.append('text')
      .attr('x', calloutMirror ? x(px) - 14 : x(px) + 14).attr('y', y(py))
      .attr('dy', '0.35em')
      .attr('text-anchor', calloutMirror ? 'end' : 'start')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-annotation-size'))
      .style('fill', view.css('accent-annotation'))
      .text('worst bucket: a favorite, not a longshot');
    callout.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
  }

  /* ---- The toggle (CONTRACT §4.5: interactive, lives in #html-overlay,
   * pointer-events auto, full keyboard access). ---- */
  let currentWeighting = 'markets';
  const toggleWrap = container.html.append('div')
    .attr('class', 'interactive s14-toggle')
    .attr('role', 'radiogroup')
    .attr('aria-label', 'weight the calibration curve by');
  // Text-collision sweep (Gate-5 item 3 disposition 2): design-revision-
  // spec.md CR-13 places this control "centered over the stage (left:
  // region.x + region.w/2, translateX(-50%)), top: region.y + space-16"
  // -- but no position/left/top was ever set on this div, desktop or
  // mobile. #html-overlay (its parent) is `position: absolute; inset: 0`,
  // so an unpositioned block child renders at that container's own
  // (0, 0) -- the viewport's literal top-left corner, on top of both the
  // rail's prose and #grain-plate ("count every market equally" /
  // "weight by dollars traded" printing over the S14 rail card in every
  // captured frame, b1 through b4). Wiring in the spec's own numbers.
  if (!view.mobile) {
    toggleWrap
      .style('position', 'absolute')
      .style('left', `${view.region.x + view.region.w / 2}px`)
      .style('top', `${view.region.y + 16}px`)
      .style('transform', 'translateX(-50%)');
  }

  // Self-explaining pair (design-revision-spec CR-13): the control persists
  // on screen after its step, so the label must stand alone without the
  // beat prose next to it.
  const options = [
    { key: 'markets', label: 'count every market equally' },
    { key: 'dollars', label: 'weight by dollars traded' },
  ];
  const buttons = toggleWrap.selectAll('button').data(options).enter()
    .append('button')
    .attr('type', 'button')
    .attr('role', 'radio')
    .attr('aria-checked', (d) => d.key === currentWeighting)
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-annotation-size'))
    .text((d) => d.label)
    .on('click', (event, d) => setWeighting(d.key, true));

  function setWeighting(weighting, animate) {
    const changed = weighting !== currentWeighting;
    currentWeighting = weighting;
    buttons.attr('aria-checked', (d) => d.key === weighting);
    drawMarkers(weighting, animate);
    drawInset(weighting);
    drawMainGhost(weighting);
    drawCallout(weighting);
    // Mode label onset (major #3): fade out/in on a genuine change so the
    // reweighting reads as a state change, not a silent re-draw
    // (perception-brief §7). Left alone on the implicit first call (b1's
    // default 'markets' reading has nothing yet to contrast against).
    if (changed) {
      const dur = view.tokens.motion.durations_ms['overlay-draw-in'];
      modeLabel
        .text(weighting === 'dollars' ? 'now weighted by: dollars traded' : 'weighted by: count of markets, equally')
        .style('opacity', 0)
        .transition().duration(dur).style('opacity', 1);
    }
    // Re-light which dots carry emphasis (data request #3): overlay()
    // cannot reach the engine directly per CONTRACT §4; this calls an
    // optional driver-supplied hook and degrades gracefully if absent.
    if (typeof container.activate === 'function') {
      container.activate(weighting === 'dollars' ? 'assemble-dollars' : 'assemble-markets', { kind: 'recolor' });
    }
  }

  function step(beatId) {
    if (beatId === 'b1') {
      drawMarkers('markets', true);
      drawInset('markets');
    } else if (beatId === 'b2') {
      const attr = sceneJson.ladder_attribution || {};
      // Critical #2: this annotation previously read "underpriced," which
      // contradicts both the on-screen key ("amber = the overpriced penny
      // tickets") and the prose -- a dot below the promise line means
      // buyers paid MORE than the outcome was worth, i.e. overpriced.
      // Rounded to match the prose's "72%"/"55%" (same numbers, one fewer
      // decimal place, so chart and prose never look like they disagree).
      const pctLadder = attr.pct_in_ten_plus_leg_ladders;
      const pctFloor = attr.pct_at_tick_floor;
      ladderLine1.text(`${pctLadder != null ? Math.round(pctLadder) : '—'}% of the overpriced tickets sit in prop ladders of ten bets or more.`);
      ladderLine2.text(`${pctFloor != null ? Math.round(pctFloor) : '—'}% sit at the one-to-two-cent tick floor.`);
      ladderCaption.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
      tickBracket.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
    } else if (beatId === 'b3') {
      setWeighting('dollars', true);
    } else if (beatId === 'b4') {
      // Major #4: the amber "worst bucket" singleton is this beat's own
      // punchline -- it must be the one perceivable change here, not a
      // repeat of something that already fired during b3's reweighting.
      calloutUnlocked = true;
      drawCallout(currentWeighting);
    }
  }

  function exit() {
    g.selectAll('*').interrupt();
    g.remove();
    toggleWrap.remove();
  }

  return { step, scrub: undefined, exit };
}

/* ---------------------------------------------------------------- */

const s14 = {
  id: 's14',
  act: 4,
  title: 'The one real sin',
  // Gate-4 round 2 (structure-spec §3): the last beat of Skill 5 hands the
  // reader the one confirmed flaw, and its exact address.
  kicker: 'Skill 5, continued — the flaw that is real',
  layoutName: 'calibration-curve',

  needs: { scene: true, series: [], zoom: null },

  scales,
  layout,
  overlay,

  beats: [
    {
      id: 'b1',
      html: `<p>The chart below holds the one flaw that survived every
        check. It lives where the money almost never went. A price is well
        calibrated when it comes true about as often as it says: a price of
        30 cents should happen about 30 percent of the time. The white line
        on screen is that promise, kept. A dot below the line marks an
        overpriced ticket: buyers paid more than the outcome was worth.
        Cheap yes-tickets, priced from 1 to 10 cents, broke that promise.
        Buyers paid about 3 cents for what was really a 1-in-100 shot.
        Those tickets implied a 3.04% chance. They paid off only 1.19% of
        the time, an hour before the market
        closed.<sup><a href="#fn-20">20</a></sup></p>`,
      trigger: 'step',
      state: 'assemble-markets',
      kind: 'resort',
      chip: [
        { token: 'neutral-data', glyph: 'dot', label: 'pale = money at each price level' },
        { token: 'accent-annotation', glyph: 'dot', label: 'amber = the overpriced penny tickets' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      grain: { text: '1 dot = {grainUsd} of real money traded', variant: 'return' },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>A prop is a side bet on something other than who wins,
        like who scores first or the exact final score. A prop ladder
        stacks many of these side bets together, rung by rung. The tick is
        the smallest price step allowed, one cent, and it is the floor
        these cheap tickets pile up against. 72% of the overpriced penny tickets
        sit inside prop ladders of ten bets or more. 55% sit right at that
        one-to-two-cent floor.<sup><a href="#fn-20">20</a></sup> Next,
        watch the sagging dots. Weighted by dollars, the sag flattens.</p>`,
      trigger: 'step',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>Weigh the same chart by dollars actually traded, and the
        sag nearly disappears, down to about half a
        point.<sup><a href="#fn-20">20</a></sup> These sagging dots are the
        same dots that sat almost empty in the long thin tail three acts
        ago. Weak prices live where money does not.</p>`,
      trigger: 'step',
      state: 'assemble-dollars',
      kind: 'recolor',
      overlayStep: 'b3',
    },
    {
      id: 'b4',
      html: `<p>The worst-priced tickets of all were not longshots. They
        were the 90-to-95-cent favorites.<sup><a href="#fn-20">20</a></sup>
        That is the same sin seen from its other side. Every overpriced
        penny ticket has a seller, and that seller holds the favorite side
        of the very same bet. One lottery premium, showing up at both ends
        of the price scale. So the old story, that crowds only overpay for
        longshots, is not even half right.</p>`,
      trigger: 'step',
      overlayStep: 'b4',
    },
  ],

  /* Reduced motion: the toggle's engine-side recolor (via the optional
   * container.activate hook) already runs through engine.tween(), which
   * collapses to instant-set + 400ms crossfade under reduced motion
   * (CONTRACT §3.5) — "a crossfade between the two weightings" per the
   * storyboard, with no scene-level state substitution needed. */
  reducedMotion: { states: {} },

  anchors: {
    /* L2 recap for S16's lens carousel (CONTRACT §4 `anchors?`): the
     * dollar-weighted calibration curve, recomputed live from the population
     * itself. Each dot sits at its own implied price (pop.price_band) on x
     * and its price bucket's realized settlement rate (pop.fate) on y.
     * Because one dot is one equal grain of money, a dot-level curve IS the
     * dollar-weighted reading the lens wants, and S5's Lorenz-tail dots
     * re-light amber via the tile's own LORENZ_TAIL flag. Self-sufficient:
     * reads only data.pop, data.manifest, and data.flagBit, builds fresh
     * local scales, and needs no scene JSON (the live scene's bucket tables
     * are not loaded under S16). S16 spotlights the tail dots; this only has
     * to place the curve. */
    curve(data, view, rect) {
      const { pop, manifest } = data;
      const N = pop.count;
      const state = makeState(N);
      const yesIdx = manifest.enums.fate.indexOf('settled_yes');
      const noIdx = manifest.enums.fate.indexOf('settled_no');
      const tailBit = data.flagBit('LORENZ_TAIL');
      const NB = 20;
      const bucketOf = (c) => Math.max(0, Math.min(NB - 1, Math.floor(c / (100 / NB))));

      const yesCt = new Float64Array(NB);
      const totCt = new Float64Array(NB);
      for (let i = 0; i < N; i++) {
        const c = pop.price_band[i];
        if (c === 255) continue;
        if (pop.fate[i] === yesIdx) { const b = bucketOf(c); yesCt[b] += 1; totCt[b] += 1; }
        else if (pop.fate[i] === noIdx) { totCt[bucketOf(c)] += 1; }
      }
      const realized = new Float64Array(NB);
      for (let b = 0; b < NB; b++) realized[b] = totCt[b] > 0 ? (100 * yesCt[b] / totCt[b]) : -1;

      const x = d3.scaleLinear().domain([0, 100]).range([rect.x + 8, rect.x + rect.w - 8]);
      const y = d3.scaleLinear().domain([0, 100]).range([rect.y + rect.h - 8, rect.y + 8]);
      const rest = view.state('dimmed-field-min');
      const neutral = view.color('neutral-data', 0.85);
      const tail = view.color('accent-annotation', 0.95);
      const baseSize = view.tokens.dot['radius-base-px'];

      for (let i = 0; i < N; i++) {
        const c = pop.price_band[i];
        const isTail = (pop.flags[i] & tailBit) !== 0;
        const settled = pop.fate[i] === yesIdx || pop.fate[i] === noIdx;
        if (c !== 255 && settled && realized[bucketOf(c)] >= 0) {
          state.x[i] = x(c) + (hash01(i, 0x11) - 0.5) * 6;
          state.y[i] = y(realized[bucketOf(c)]) + (hash01(i, 0x22) - 0.5) * 6;
          setColor(state.color, i, isTail ? tail : neutral);
        } else {
          state.x[i] = rect.x + rect.w * (0.06 + 0.88 * hash01(i, 0x33));
          state.y[i] = rect.y + rect.h * (0.06 + 0.88 * hash01(i, 0x44));
          setColor(state.color, i, isTail ? tail : rest);
        }
        state.size[i] = baseSize;
      }

      return {
        state,
        drawAxes(g) {
          const ax = g.append('g').attr('class', 's14-anchor-axes');
          ax.append('line')
            .attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(100)).attr('y2', y(100))
            .attr('stroke', view.css('ink-hi')).attr('stroke-width', 1).attr('opacity', 0.5);
          ax.append('g')
            .attr('transform', `translate(0,${rect.y + rect.h})`)
            .call(d3.axisBottom(x).ticks(4).tickFormat((d) => `${d}c`))
            .call((s) => {
              s.selectAll('text').attr('fill', view.css('ink-low'))
                .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
              s.selectAll('path,line').attr('stroke', view.css('ink-low'));
            });
          ax.append('g')
            .attr('transform', `translate(${rect.x},0)`)
            .call(d3.axisLeft(y).ticks(4).tickFormat((d) => `${d}%`))
            .call((s) => {
              s.selectAll('text').attr('fill', view.css('ink-low'))
                .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
              s.selectAll('path,line').attr('stroke', view.css('ink-low'));
            });
          ax.append('text').attr('x', rect.x).attr('y', rect.y - 6)
            .attr('fill', view.css('ink-mid'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-caption-size'))
            .text('implied vs realized, weighted by dollars');
        },
      };
    },
  },
};

export default s14;
