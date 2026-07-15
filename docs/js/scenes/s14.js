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
  const restRgba = view.state('rest');
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

  // Calibration diagonal: implied == realized.
  g.append('line')
    .attr('x1', x(0)).attr('y1', y(0))
    .attr('x2', x(100)).attr('y2', y(100))
    .style('stroke', view.css('ink-hero'))
    .style('stroke-width', 1.5)
    .style('opacity', 0.6);

  // Realized-rate marker path, connecting each bucket's active-weighting
  // point — the exact mark the toggle re-positions (storyboard: "the
  // toggle... re-positions each bucket's realized-rate marker").
  const markerPath = g.append('path')
    .attr('class', 's14-marker-path')
    .style('fill', 'none')
    .style('stroke', view.css('side-no'))
    .style('stroke-width', 2);
  const markerDots = g.append('g').attr('class', 's14-marker-dots');

  const line = d3.line().x((d) => x(d.px)).y((d) => y(d.py)).curve(d3.curveMonotoneX);

  function markerData(weighting) {
    return buckets.map((b) => ({
      px: weighting === 'dollars' && b.vol_weighted_price_c !== undefined ? b.vol_weighted_price_c : b.mean_price_c,
      py: weighting === 'dollars' && b.vol_weighted_win_rate_pct !== undefined ? b.vol_weighted_win_rate_pct : b.win_rate_pct,
      label: b.label || b.bucket,
    }));
  }

  function drawMarkers(weighting, animate) {
    const d = markerData(weighting);
    const sel = markerPath.datum(d);
    if (animate) sel.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).attr('d', line);
    else sel.attr('d', line);

    const dots = markerDots.selectAll('circle').data(d);
    dots.enter().append('circle').attr('r', 3).style('fill', view.css('side-no'))
      .merge(dots)
      .transition().duration(animate ? view.tokens.motion.durations_ms['overlay-draw-in'] : 0)
      .attr('cx', (dd) => x(dd.px)).attr('cy', (dd) => y(dd.py));
    dots.exit().remove();
  }

  // Ladder-attribution caption (72% / 55%).
  const ladderCaption = g.append('text')
    .attr('x', view.region.x)
    .attr('y', view.region.y - 8)
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-caption-size'))
    .style('fill', view.css('ink-mid'))
    .style('opacity', 0);

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
    .text(`${tickFloor.lo_c}-${tickFloor.hi_c}c: the one-cent tick floor`);

  // 90-95c callout: the amber singleton protocol (halo core ring), an
  // overlay-only highlight independent of the current toggle weighting.
  const callout = g.append('g').attr('class', 's14-callout').style('opacity', 0);
  function drawCallout(weighting) {
    callout.selectAll('*').remove();
    const label = sceneJson.worst_bucket_label || '90-95c';
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
    callout.append('text')
      .attr('x', x(px) + 14).attr('y', y(py))
      .attr('dy', '0.35em')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-annotation-size'))
      .style('fill', view.css('accent-annotation'))
      .text(`${label}: worst-calibrated bucket of all`);
    callout.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
  }

  /* ---- The toggle (CONTRACT §4.5: interactive, lives in #html-overlay,
   * pointer-events auto, full keyboard access). ---- */
  let currentWeighting = 'markets';
  const toggleWrap = container.html.append('div')
    .attr('class', 'interactive s14-toggle')
    .attr('role', 'radiogroup')
    .attr('aria-label', 'weight the calibration curve by');

  const options = [
    { key: 'markets', label: 'By markets' },
    { key: 'dollars', label: 'By dollars traded' },
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
    currentWeighting = weighting;
    buttons.attr('aria-checked', (d) => d.key === weighting);
    drawMarkers(weighting, animate);
    drawCallout(weighting);
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
    } else if (beatId === 'b2') {
      const attr = sceneJson.ladder_attribution || {};
      ladderCaption
        .text(`${attr.pct_in_ten_plus_leg_ladders ?? '—'}% of cheap-band observations sit in prop ladders of ten or more legs; ${attr.pct_at_tick_floor ?? '—'}% sit at the one-to-two-cent tick floor.`)
        .transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
      tickBracket.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
    } else if (beatId === 'b3') {
      setWeighting('dollars', true);
    } else if (beatId === 'b4') {
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
  layoutName: 'calibration-curve',

  needs: { scene: true, series: [], zoom: null },

  scales,
  layout,
  overlay,

  beats: [
    {
      id: 'b1',
      html: `<p>One sin survived verification, and it lives where the
        money was not. Cheap yes-legs underperformed their price, an
        implied 3.04% paying 1.19% at an hour
        out.<sup><a href="#fn-20">20</a></sup></p>`,
      trigger: 'step',
      state: 'assemble-markets',
      kind: 'resort',
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>72% of those observations sit in prop ladders with ten or
        more legs and 55% sit at the one-to-two-cent tick
        floor.<sup><a href="#fn-20">20</a></sup></p>`,
      trigger: 'step',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>Weight the same curve by dollars actually traded and the
        sag flattens to about half a
        point.<sup><a href="#fn-20">20</a></sup> The dots sagging here are
        the same dots that sat in the Lorenz tail three acts ago.</p>`,
      trigger: 'step',
      state: 'assemble-dollars',
      kind: 'recolor',
      overlayStep: 'b3',
    },
    {
      id: 'b4',
      html: `<p>The worst-calibrated bucket of all is the 90-to-95-cent
        favorite, so the textbook one-sided story fails in both
        directions.<sup><a href="#fn-20">20</a></sup> Mispricing and
        emptiness are one map at two exposures.</p>`,
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
};

export default s14;
