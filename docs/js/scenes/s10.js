/* docs/js/scenes/s10.js — Act III · "One price, two venues"
 *
 * Storyboard: research/storyboard.md §3 S10 (layoutName 'braid'). Contract:
 * docs/CONTRACT.md §4.2 (act 3, 3 steps, no zoom tile). Finding: dossier R2.
 * Design: research/design-system.md §9 S10 ("population rests at 25%;
 * braid = cyan + lavender lines; fusion quantified live by the mono
 * gap-meter (0.74 pts); Pinnacle grey line dies into dashed #6B7480
 * terminations").
 *
 * GATE-4 ROUND 2 (research/revision/structure-spec.md §5 S10;
 * research/revision/design-revision-spec.md §2 S10): retitled "Two crowds,
 * one price"; the course spine now runs on screen via `kicker` ("Skill 4 of
 * 5"). Prose rewritten to eighth-grade register — the three-way, "a point
 * is a cent," and the arbitrage-closes-gaps mechanism are taught in plain
 * words in beat 1. The standalone floating venue-legend panel is retired
 * (its job now belongs to the persistent global color key, `beat.chip`
 * rows) and replaced by two direct at-line labels drawn once. The gap meter
 * and count chip move into the placement-zone map (Zone F / Zone S
 * top-right) and are reworded in plain words. No data binding, layout, or
 * engine change; every edit below is text, color, or position only.
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

const FN = (n) => `<sup class="fn"><a href="#fn-${n}">${n}</a></sup>`;

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

/* Placement-zone helpers (design-revision-spec.md G5). Desktop anchors to
 * the stage region; mobile drops into the fixed Zone K / Zone F bands
 * above the bottom card sheet, since `region.y` is too small on mobile for
 * a region-relative offset to stay on screen (a naive `region.y - 40`
 * would print off the top of a 0.06H-tall margin). Duplicated in s11.js
 * rather than imported, matching this file's existing hash01/restField
 * duplication convention (CONTRACT §2 reserves cross-scene imports for
 * S16's anchors only). */
function zoneK(sel, view) {
  const L = view.tokens.layout;
  const sp = view.tokens.spacing_px;
  if (view.mobile) {
    return sel.style('left', `${sp[3]}px`).style('top', `${sp[3] + 44 + sp[2]}px`);
  }
  return sel.style('left', `${view.region.x}px`)
    .style('top', `${view.region.y - L['caption-slot-top-offset-px']}px`);
}
function zoneF(sel, view) {
  const L = view.tokens.layout;
  const sp = view.tokens.spacing_px;
  if (view.mobile) {
    return sel.style('left', `${sp[3]}px`)
      .style('bottom', `calc(${L['card-max-height-mobile-vh']}vh + ${sp[1]}px)`)
      .style('max-width', '50vw');
  }
  return sel.style('left', `${view.region.x}px`)
    .style('top', `${view.region.y + view.region.h + L['footer-slot-offset-px']}px`);
}
function zoneTopRight(sel, view) {
  const L = view.tokens.layout;
  const sp = view.tokens.spacing_px;
  if (view.mobile) {
    return sel.style('right', `${sp[3]}px`).style('top', `${view.region.y + sp[1]}px`);
  }
  return sel.style('right', `${view.W - view.region.x - view.region.w + sp[4]}px`)
    .style('top', `${sp[4] + (L['key-exclusion-h-px'] || 132) + sp[3]}px`);
}

export default {
  id: 's10',
  act: 3,
  title: 'Two crowds, one price',
  kicker: 'Skill 4 of 5: who is behind the number',
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
    // Figure/ground per research/revision/perception-brief.md §4, §9b: this
    // scene has NO active PARTICLE subset — by unit discipline the movers are
    // D3 marks (the braid), not dots. So the whole population is the dimmed
    // GROUND, assigned 'dimmed-field-min' (alpha 0.25 <= opacity-rest-classify-max
    // 0.42), which the engine's emphasis-rest-dim recedes further every frame.
    // The FIGURE that pops is the D3 braid in bright venue hues (venue-kalshi /
    // venue-polymarket / venue-pinnacle, all AAA vs canvas), direct-labeled
    // once at the line's end plus named in the persistent color key.
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
    const directLabelLayer = g.append('g').attr('class', 's10-direct-labels');

    const captionDiv = zoneK(
      html.append('div').attr('class', 's10-caption')
        .style('position', 'absolute')
        .style('font', '13px var(--font-tape)')
        .style('color', view.css('ink-mid'))
        .style('pointer-events', 'none'),
      view,
    );
    const gapMeter = zoneF(
      html.append('div').attr('class', 's10-gap-meter')
        .style('position', 'absolute')
        .style('font', '13px var(--font-tape)')
        .style('color', view.css('ink-mid'))
        .style('pointer-events', 'none'),
      view,
    );
    const countChip = zoneTopRight(
      html.append('div').attr('class', 's10-count-chip')
        .style('position', 'absolute')
        .style('font', '13px var(--font-tape)')
        .style('color', view.css('accent-annotation'))
        .style('pointer-events', 'none'),
      view,
    );

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

    function lastDefined(arr) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const v = arr[i].v;
        if (v !== null && v !== undefined && !Number.isNaN(v)) return arr[i];
      }
      return null;
    }

    const lineGen = d3.line()
      .defined((d) => d.v !== null && d.v !== undefined && !Number.isNaN(d.v))
      .x((d) => scales.time(d.t))
      .y((d) => scales.price(d.v));

    // Axes: time across the knockout window, price in points. Domain is
    // already 0-100 (a true zero baseline), so no break marker is needed.
    // Mobile flip (design-revision-spec G3): a bottom axis on mobile
    // renders as axisTop translated to the same line, so tick labels sit
    // above it, inside the stage, instead of spilling into the card sheet.
    const timeAxisGen = view.mobile
      ? d3.axisTop(scales.time).ticks(6)
      : d3.axisBottom(scales.time).ticks(6);
    styleAxis(
      axisLayer.append('g')
        .attr('transform', `translate(0,${view.region.y + view.region.h})`)
        .call(timeAxisGen),
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
      .text('contract price (points; 1 point = 1 cent)');
    axisLayer.append('text')
      .attr('x', view.region.x + view.region.w / 2)
      .attr('y', view.mobile
        ? view.region.y + view.region.h - spacing[6]
        : view.region.y + view.region.h + spacing[4] + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', view.css('ink-mid'))
      .style('font', '12px var(--font-apparatus)')
      .text('the knockout stage (date)');

    // Direct-labeled venues, drawn once at the line's end (design-revision-
    // spec G1/CR-2): the standalone floating legend panel is retired — the
    // persistent global key already names every color meaning — but a
    // reader looking straight at the braid still deserves an at-mark
    // answer to "which line is which," so Kalshi and Polymarket keep one
    // small label each, planted at the last point either line actually
    // reaches. Pinnacle needs no line label of its own: its color and its
    // "stopped quoting" meaning are taught by the key and by the
    // termination caption when its dashes land.
    function drawDirectLabels() {
      directLabelLayer.selectAll('*').remove();
      const kLast = lastDefined(kalshiPts);
      const pLast = lastDefined(polyPts);
      if (kLast) {
        directLabelLayer.append('text')
          .attr('x', scales.time(kLast.t) + spacing[1])
          .attr('y', scales.price(kLast.v) - spacing[1])
          .attr('fill', view.css('venue-kalshi'))
          .style('font', '12px var(--font-apparatus)')
          .text('Kalshi');
      }
      if (pLast) {
        directLabelLayer.append('text')
          .attr('x', scales.time(pLast.t) + spacing[1])
          .attr('y', scales.price(pLast.v) + spacing[1] + 10)
          .attr('fill', view.css('venue-polymarket'))
          .style('font', '12px var(--font-apparatus)')
          .text('Polymarket');
      }
    }

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
      // Pre-cue (design-revision-spec CR-10/G6): this IS the caption for
      // this step, and it primes the termination event two steps ahead.
      captionDiv.text('Next, watch the grey line. It stops quoting sixteen times.');
    }

    function resolveGapMeter() {
      if (!alive || meanGap === null || meanGap === undefined) return;
      if (view.reducedMotion) {
        gapMeter.text(`mean gap: ${meanGap.toFixed(2)} points`);
        return;
      }
      const t0 = performance.now();
      const tick = (now) => {
        if (!alive) return;
        const p = Math.min(1, (now - t0) / countUpMax);
        gapMeter.text(`mean gap: ${(meanGap * p).toFixed(2)} points`);
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
        countChip.text(`${n} of ${n} start at Pinnacle's last quote.`);
        resolveGapMeter();
        return;
      }
      const stepDelay = Math.max(16, Math.floor(countUpMax / Math.max(n, 1)));
      let i = 0;
      const step = () => {
        if (!alive) return;
        i += 1;
        countChip.text(`${i} of ${n}`);
        if (i >= n) {
          countChip.text(`${n} of ${n} start at Pinnacle's last quote.`);
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
          drawDirectLabels();
          captionDiv.text('The dots rest here. One mark is one minute of matched price.');
          gapMeter.text('mean gap: —');
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
      html: `<p>Every match in the knockout stage has three tickets: one pays out on a home win, one on a draw, one on an away win. Traders call this the three-way. A point on this chart is one cent of price, so a five-point gap is five cents, about five chances out of a hundred.</p><p>Two rival markets priced every one of those tickets, all month: Kalshi, built in the United States, and Polymarket, built offshore. The two never sat five points apart for even thirty minutes. Minute by minute, the average gap stayed under one cent.${FN(15)}</p><p>Here is why the gap almost never opens. When one market prices a ticket a little rich and the other prices it a little cheap, traders buy the cheap ticket and sell the rich one until the two prices meet. That trade is close to free money, so the gap closes fast.</p>`,
      trigger: 'step',
      state: 'rest',
      kind: 'resort',
      chip: [
        { token: 'venue-kalshi', glyph: 'line', label: 'cyan = Kalshi price' },
        { token: 'venue-polymarket', glyph: 'line', label: 'lavender = Polymarket price' },
        { token: 'venue-pinnacle', glyph: 'dash', label: "grey = the pros' price, dashed when they stop quoting" },
        { token: 'field-rest', glyph: 'dim', label: 'grey dots = money at rest, the whole tournament' },
      ],
      grain: {
        text: 'for this scene and the next, the dots rest; one mark here is one minute of matched price',
        variant: 'debut',
      },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      // Pure-visual step: the fact this beat performs (goal-second gaps
      // close within a minute) is already stated by the braid holding
      // together in b1's prose; this step shows it, not narrates it again.
      // The caption it drives is the pre-cue for b3 (see flashSpikes()).
      html: '<!-- visual-only step: goal-second flashes -->',
      trigger: 'step',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>Sixteen times, Kalshi seemed to split from the professional book. That book is Pinnacle, the professional sportsbook from the goal scene. Every split began within about two minutes of Pinnacle's last posted price. Not one held a single fresh Pinnacle quote after that.${FN(15)}</p><p>Sixteen episodes, one cause: the professionals had left the room.</p>`,
      trigger: 'step',
      overlayStep: 'b3',
    },
  ],

  anchors: {
    /* L1 recap for S16's lens carousel (CONTRACT §4 `anchors?`): S10's braid
     * frame with the population at rest. S10 never re-sorts its own dots.
     * The braid is a pair of D3 per-minute price traces above a resting
     * field (storyboard S10 Units), and those traces live in this scene's
     * JSON, which S16 does not load. The honest recap is therefore the
     * resting population under the braid's time frame plus the two-venue
     * caption, never a fabricated price line. Self-sufficient: reads only
     * data.pop and data.manifest, builds a fresh local time scale (the
     * registry key this scene owned is cleared on exit, CONTRACT §6.1). S16
     * applies no dot spotlight to L1, matching "the braid is D3-only, the
     * population rests." */
    braid(data, view, rect) {
      const { pop, manifest } = data;
      const N = pop.count;
      const state = makeState(N);
      const rest = particleState(view.tokens, 'dimmed-field-min');
      const baseSize = view.tokens.dot['radius-base-px'];
      const epochMs = new Date(manifest.epoch).getTime();
      const endMs = new Date(manifest.frozen_at || manifest.generated).getTime();
      const time = d3.scaleUtc().domain([epochMs, endMs]).range([rect.x + 8, rect.x + rect.w - 8]);
      const birth = pop.birth_ts;
      for (let i = 0; i < N; i++) {
        // Tight central band: the two venues braided into one line. No price
        // axis is drawn for L1, so the band's vertical position carries no
        // price claim; it reads as the single braided line at rest.
        state.x[i] = time(epochMs + birth[i] * 1000);
        state.y[i] = rect.y + rect.h * (0.42 + 0.16 * hash01(i));
        setColor(state.color, i, rest);
        state.size[i] = baseSize;
      }
      return {
        state,
        drawAxes(g) {
          const ax = g.append('g').attr('class', 's10-anchor-axes');
          ax.append('g')
            .attr('transform', `translate(0,${rect.y + rect.h})`)
            .call(d3.axisBottom(time).ticks(4))
            .call((s) => {
              s.selectAll('text').attr('fill', view.css('ink-low'))
                .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
              s.selectAll('path,line').attr('stroke', view.css('ink-low'));
            });
          ax.append('text').attr('x', rect.x).attr('y', rect.y - 6)
            .attr('fill', view.css('venue-kalshi'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-annotation-size'))
            .text('Kalshi');
          ax.append('text').attr('x', rect.x + 64).attr('y', rect.y - 6)
            .attr('fill', view.css('venue-polymarket'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-annotation-size'))
            .text('Polymarket');
          ax.append('text').attr('x', rect.x + 168).attr('y', rect.y - 6)
            .attr('fill', view.css('ink-mid'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-caption-size'))
            .text('two crowds, one price');
        },
      };
    },
  },

  // Defaults suffice: the engine-level reduced-motion mode already turns
  // the single 'rest' state's entry into an instant crossfade (CONTRACT
  // §3.5), and every custom overlay animation above (spikes, terminations,
  // count-up, gap-meter) checks view.reducedMotion itself and renders its
  // static end state immediately.
};
