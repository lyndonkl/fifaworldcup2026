/* docs/js/scenes/s10.js — Act III · "One price, two venues"
 *
 * Storyboard: research/storyboard.md §3 S10 (layoutName 'braid'). Contract:
 * docs/CONTRACT.md §4.2 (act 3, 3 steps, no zoom tile). Finding: dossier R2.
 * Design: research/design-system.md §9 S10 ("population rests at 25%;
 * braid = cyan + lavender lines; fusion quantified live by the mono
 * gap-meter (0.74 pts); Pinnacle grey line dies into dashed #6B7480
 * terminations").
 *
 * UNIT DISCIPLINE (storyboard §0 + CONTRACT §1.3): dots mean money and only
 * money. A per-minute matched price is not money — it is a derived
 * quantity — so it is drawn as a D3 mark, never as a repositioned dot. The
 * population itself is not removed; it rests, dimmed, behind the marks.
 * This is also true of s11.js, which inherits this same resting field
 * without re-sorting it (see that file's header).
 *
 * ---------------------------------------------------------------------
 * DATA CONTRACT ASSUMPTIONS (flagged in this build's data_requests — the
 * exact internal shape of a per-scene JSON file is left to the tile
 * builder by CONTRACT §5.5, "small, axis-ready aggregates ... named in the
 * storyboard's per-scene Data blocks"; this is this scene's proposal for
 * that shape, grounded in the pipeline files actually inspected at build
 * time):
 *
 *   needs.scene -> data/scenes/s10.json:
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "knockout_window": { "start": ISO, "end": ISO },
 *     "gap_summary": {
 *       "mean_1min_gap_pts": 0.74,     // dossier R2; ~ mean of
 *                                      // calibration/kalshi_vs_polymarket_max_gaps.csv's
 *                                      // mean_abs_gap_pp column across all 84 legs
 *       "goal_second_spike_pts": 41.6,
 *       "goal_second_spike_duration_s": 60,
 *       "n_legs": 84
 *     },
 *     // Chronologically sorted, LIVE-WINDOW-ONLY points (sparse, not a
 *     // dense calendar grid — the two retail venues are quiet almost all
 *     // of the knockout stage; see note below on why this isn't series.bin).
 *     "braid": {
 *       "t": [ epoch_seconds, ... ],          // ascending
 *       "kalshi_pts": [ 0-100, ... ],         // price in POINTS (cents*1),
 *       "polymarket_pts": [ 0-100, ... ],     // i.e. raw fraction * 100 —
 *       "pinnacle_pts": [ 0-100 | null, ... ] // matches this scene's axis
 *     },
 *     "goal_spikes": [
 *       { "match_id": "...", "leg": "...", "t": ISO, "gap_pts": 41.6 }, ...
 *     ],
 *     // The 16 rows: calibration/divergence_episodes_kalshi_vs_pinnacle.csv
 *     // (start_ts -> t; pinnacle_mean * 100 -> last_quote_pts). Verified at
 *     // build time: this file has exactly 16 rows, matching "sixteen
 *     // apparent divergences" in the beat prose.
 *     "pinnacle_terminations": [
 *       { "match_id": "...", "leg": "...", "t": ISO, "last_quote_pts": 0.0 }, ...
 *     ]
 *   }
 *
 *   Why no needs.series: the braid is fundamentally IRREGULAR (only the
 *   minutes when a knockout leg was actually live carry a price; the
 *   knockout stage's ~17 calendar days are otherwise silent), so per
 *   CONTRACT §5.5 ("irregular timestamps ... ship in the scene JSON
 *   instead") this belongs in s10.json, not series.bin's regular
 *   t0/step_s sections. A dense per-minute calendar grid would also cost
 *   far more bytes for almost no signal.
 * ---------------------------------------------------------------------
 */

import { registry, particleState, makeState, setColor } from '../shared.js';

const FN = (n) => `<sup>${n}</sup>`;

/* Deterministic per-index hash (no Math.random: replays and reverse
 * scrubs must be identical, per CONTRACT §3.2). */
function hash01(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

/* The population's "home" arrangement whenever a scene rests it rather
 * than sorting it into a story shape: x = birth time on the full-
 * tournament global.time scale (registered by main.js), y = a
 * deterministic per-dot jitter across the stage band, at the
 * dimmed-field-min tint design-system §9 calls "rests at 25%".
 *
 * s11.js reconstructs this exact formula (duplicated, not imported — the
 * module import rules in CONTRACT §2 reserve sibling-scene imports for
 * S16's anchors only) so the two scenes' resting dots are pixel-identical
 * and "the dots stay at rest" going into S11 holds without a tween. */
function restField(data, view) {
  const n = data.pop.count;
  const timeScale = registry.get('global.time');
  const rgba = particleState(view.tokens, 'dimmed-field-min');
  const size = view.tokens.dot['radius-base-px'];
  const st = makeState(n);
  const birth = data.pop.birth_ts;
  const epoch = new Date(data.manifest.epoch).getTime();
  for (let i = 0; i < n; i++) {
    const t = epoch + birth[i] * 1000;
    st.x[i] = timeScale(t);
    st.y[i] = view.region.y + hash01(i) * view.region.h;
    setColor(st.color, i, rgba);
    st.size[i] = size;
  }
  return st;
}

function styleAxis(sel, color) {
  sel.selectAll('.domain, .tick line').attr('stroke', color);
  sel.selectAll('.tick text').attr('fill', color)
    .style('font', '12px var(--font-apparatus)');
  return sel;
}

export default {
  id: 's10',
  act: 3,
  title: 'One price, two venues',
  layoutName: 'braid',

  needs: {
    scene: true,
    series: [],
    zoom: null,
  },

  scales(data, view) {
    const win = (data.scene && data.scene.knockout_window)
      ? [new Date(data.scene.knockout_window.start), new Date(data.scene.knockout_window.end)]
      : [new Date(data.manifest.epoch), new Date(data.manifest.frozen_at || data.manifest.generated)];
    const time = d3.scaleUtc().domain(win).range([view.region.x, view.region.x + view.region.w]);
    // Raw exchange quotes: points, not probability (R23-adjacent minor fix;
    // CONTRACT §10.5 acceptance check greps for this exact label text).
    const price = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + view.region.h, view.region.y]);
    registry.register('s10.time', time);
    registry.register('s10.price', price);
    return { time, price };
  },

  layout(data, view) {
    return { states: { rest: restField(data, view) } };
  },

  overlay(container, data, view, scales) {
    const { svg, html } = container;
    let alive = true;

    const T = view.tokens.motion.durations_ms;
    const M = view.tokens.motion.misc;
    const drawIn = T['overlay-draw-in'];
    const stagger = T['overlay-stagger'];
    const maxSeq = M['overlay-max-sequenced-elements'];
    const countUpMax = T['counter-count-up-max'];
    const leaderWeight = view.tokens.layout['annotation-leader-weight-px'];
    const leaderStandoff = view.tokens.layout['annotation-leader-standoff-px'];
    const spacing = view.tokens.spacing_px; // [4,8,12,16,24,32,48,64,96,128]

    const g = svg.append('g').attr('class', 's10-braid');
    const axisLayer = g.append('g').attr('class', 's10-axes');
    const lineLayer = g.append('g').attr('class', 's10-lines');
    const spikeLayer = g.append('g').attr('class', 's10-spikes');
    const termLayer = g.append('g').attr('class', 's10-terms');

    const captionDiv = html.append('div').attr('class', 's10-caption')
      .style('font', '13px var(--font-tape)').style('color', view.css('ink-mid'));
    const gapMeter = html.append('div').attr('class', 's10-gap-meter')
      .style('font', '13px var(--font-tape)').style('color', view.css('ink-hi'));
    const countChip = html.append('div').attr('class', 's10-count-chip')
      .style('font', '13px var(--font-tape)').style('color', view.css('accent-annotation'));

    const scene = data.scene || {};
    const braid = scene.braid || { t: [], kalshi_pts: [], polymarket_pts: [], pinnacle_pts: [] };
    const spikes = scene.goal_spikes || [];
    const terms = scene.pinnacle_terminations || [];
    const meanGap = scene.gap_summary ? scene.gap_summary.mean_1min_gap_pts : null;

    function toPoints(tArr, vArr) {
      // Defensive against a braid object present but shaped differently
      // than expected (§scene.braid's `|| {...}` fallback above only
      // catches a wholly-absent braid, not one missing these sub-arrays):
      // an uncaught TypeError here would throw out of enterScene() mid-
      // mount, leaving the scene half-initialized for every reader who
      // scrolls this far, so this degrades to an empty line same as the
      // rest of this file's own "until this lands, axis only" pattern.
      const out = [];
      const n = tArr ? tArr.length : 0;
      for (let i = 0; i < n; i++) out.push({ t: tArr[i] * 1000, v: vArr ? vArr[i] : undefined });
      return out;
    }
    const kalshiPts = toPoints(braid.t, braid.kalshi_pts);
    const polyPts = toPoints(braid.t, braid.polymarket_pts);
    const pinnPts = toPoints(braid.t, braid.pinnacle_pts);

    const lineGen = d3.line()
      .defined((d) => d.v !== null && d.v !== undefined && !Number.isNaN(d.v))
      .x((d) => scales.time(d.t))
      .y((d) => scales.price(d.v));

    // Axes: time across the knockout window, price in points. Domain is
    // already 0-100 (a true zero baseline), so no break marker is needed.
    styleAxis(
      axisLayer.append('g')
        .attr('transform', `translate(0,${view.region.y + view.region.h})`)
        .call(d3.axisBottom(scales.time).ticks(6)),
      view.css('ink-mid'),
    );
    styleAxis(
      axisLayer.append('g')
        .attr('transform', `translate(${view.region.x},0)`)
        .call(d3.axisLeft(scales.price).ticks(5)),
      view.css('ink-mid'),
    );
    axisLayer.append('text')
      .attr('x', view.region.x).attr('y', view.region.y - leaderStandoff)
      .attr('fill', view.css('ink-mid'))
      .style('font', '12px var(--font-apparatus)')
      .text('price (points)');

    function drawLines() {
      lineLayer.selectAll('path.venue-line').remove();
      lineLayer.append('path').datum(kalshiPts).attr('class', 'venue-line kalshi')
        .attr('fill', 'none').attr('stroke', view.css('venue-kalshi'))
        .attr('stroke-width', leaderWeight).attr('d', lineGen);
      lineLayer.append('path').datum(polyPts).attr('class', 'venue-line polymarket')
        .attr('fill', 'none').attr('stroke', view.css('venue-polymarket'))
        .attr('stroke-width', leaderWeight).attr('d', lineGen);
    }

    function drawPinnacleLive() {
      lineLayer.selectAll('path.pinnacle-live').remove();
      lineLayer.append('path').datum(pinnPts).attr('class', 'pinnacle-live')
        .attr('fill', 'none').attr('stroke', view.css('venue-pinnacle'))
        .attr('stroke-width', leaderWeight).attr('d', lineGen);
    }

    function flashSpikes() {
      const sel = spikeLayer.selectAll('circle.spike')
        .data(spikes, (d, i) => (d.match_id || '') + (d.leg || '') + i);
      const enter = sel.enter().append('circle').attr('class', 'spike')
        .attr('r', 3)
        .attr('cx', (d) => scales.time(new Date(d.t)))
        .attr('cy', (d) => scales.price(Math.min(100, d.gap_pts)))
        .attr('fill', view.css('accent-annotation'))
        .attr('opacity', 0);
      const merged = enter.merge(sel);
      if (!view.reducedMotion) {
        merged.transition()
          .delay((d, i) => Math.min(i, maxSeq - 1) * stagger)
          .duration(drawIn).attr('opacity', 0.9)
          .transition().duration(drawIn).attr('opacity', 0.25);
      } else {
        merged.attr('opacity', 0.35);
      }
      captionDiv.text('the 41.6-point goal-second spikes close within a minute');
    }

    function resolveGapMeter() {
      if (!alive || meanGap === null || meanGap === undefined) return;
      if (view.reducedMotion) {
        gapMeter.text(`running 1-min mean: ${meanGap.toFixed(2)} points`);
        return;
      }
      const t0 = performance.now();
      const tick = (now) => {
        if (!alive) return;
        const p = Math.min(1, (now - t0) / countUpMax);
        gapMeter.text(`running 1-min mean: ${(meanGap * p).toFixed(2)} points`);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    function landTerminations() {
      const sel = termLayer.selectAll('g.term')
        .data(terms, (d, i) => (d.match_id || '') + (d.leg || '') + i);
      const enter = sel.enter().append('g').attr('class', 'term')
        .attr('transform', (d) => `translate(${scales.time(new Date(d.t))},${scales.price(d.last_quote_pts)})`)
        .style('opacity', 0);
      enter.append('circle').attr('r', 3).attr('fill', view.css('venue-pinnacle-terminated'));
      enter.append('line')
        .attr('x1', 0).attr('x2', spacing[4]).attr('y1', 0).attr('y2', 0)
        .attr('stroke', view.css('venue-pinnacle-terminated'))
        .attr('stroke-width', leaderWeight)
        .attr('stroke-dasharray', '2,2');
      const merged = enter.merge(sel);
      const n = terms.length || 16;

      if (!view.reducedMotion) {
        merged.transition()
          .delay((d, i) => Math.min(i, maxSeq - 1) * stagger)
          .duration(drawIn).style('opacity', 1)
          .end().catch(() => {})
          .then(() => { if (alive) runCountUp(n); });
      } else {
        merged.style('opacity', 1);
        runCountUp(n);
      }
      captionDiv.text('no longer quoting');
    }

    function runCountUp(n) {
      if (!alive) return;
      if (view.reducedMotion) {
        countChip.text(`${n} for ${n}: every episode starts at a final quote`);
        resolveGapMeter();
        return;
      }
      const stepDelay = Math.max(16, Math.floor(countUpMax / Math.max(n, 1)));
      let i = 0;
      const step = () => {
        if (!alive) return;
        i += 1;
        countChip.text(`${i} for ${n}`);
        if (i >= n) {
          countChip.text(`${n} for ${n}: every episode starts at a final quote`);
          setTimeout(() => { if (alive) resolveGapMeter(); }, drawIn);
          return;
        }
        setTimeout(step, stepDelay);
      };
      setTimeout(step, drawIn);
    }

    return {
      step(beatId) {
        if (beatId === 'b1') {
          drawLines();
          drawPinnacleLive();
          captionDiv.text('for this scene and the next, the dots rest; one mark here is one minute of matched price');
          gapMeter.text('running 1-min mean: —');
          countChip.text('');
        } else if (beatId === 'b2') {
          flashSpikes();
        } else if (beatId === 'b3') {
          landTerminations();
        }
      },
      exit() {
        alive = false;
        g.remove();
        captionDiv.remove();
        gapMeter.remove();
        countChip.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>For the entire knockout stage the two retail venues were effectively one market. Across 84 three-way legs, Kalshi and Polymarket never sustained a five-point gap for thirty minutes; the mean one-minute gap is 0.74 points, and the 41.6-point goal-second spikes last exactly one minute.${FN(15)}</p>`,
      trigger: 'step',
      state: 'rest',
      kind: 'resort',
      chip: 'color: venue',
      grain: {
        text: 'for this scene and the next, the dots rest; one mark here is one minute of matched price',
        variant: 'debut',
      },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      // Pure-visual step: the "41.6-point goal-second spikes last exactly
      // one minute" claim is already stated verbatim in b1; this step
      // performs it (the flash-and-close), not narrates it again.
      html: '<!-- visual-only step: goal-second flashes -->',
      trigger: 'step',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>The sixteen apparent divergences from the professional book tell a different story: all sixteen begin within about two minutes of Pinnacle's final quote and contain zero fresh ticks.${FN(15)} Sixteen episodes, one cause: the professional book had stopped quoting.</p>`,
      trigger: 'step',
      overlayStep: 'b3',
    },
  ],

  // Defaults suffice: the engine-level reduced-motion mode already turns
  // the single 'rest' state's entry into an instant crossfade (CONTRACT
  // §3.5), and every custom overlay animation above (spikes, terminations,
  // count-up, gap-meter) checks view.reducedMotion itself and renders its
  // static end state immediately.
};
