/* docs/js/scenes/s10.js — Act III · "One price, two venues"
 *
 * Storyboard: research/storyboard.md §3 S10 (layoutName 'braid'). Contract:
 * docs/CONTRACT.md §4.2 (act 3, 3 steps, no zoom tile). Finding: dossier R2.
 *
 * GATE-4 ROUND 2 (research/revision/design-revision-spec.md §2 S10):
 * retitled "Two crowds, one price"; the course spine runs on screen via
 * `kicker`. Prose in eighth-grade register. The floating venue-legend panel
 * retired in favor of the persistent global color key.
 *
 * GATE-4 ROUND 3, RESHAPE (research/design-review/visual-story-review.md
 * §5 S10 doctrine): the blind screenshot audit read the old two-line
 * overlay (Kalshi's absolute price plotted next to Polymarket's absolute
 * price) as "two markets spiked like crazy in violent DISAGREEMENT" — the
 * exact opposite of the beat's claim ("the two never sat five points
 * apart"). Two absolute price traces can only ever show where they
 * diverge; they cannot show HOW CLOSE they stayed, because "close" is a
 * property of the difference between them, not of either line on its own.
 * The fix is the one this scene's whole prose argument is already about:
 * plot the gap, not the two prices.
 *
 * Deriving that gap client-side surfaced a second, more basic problem with
 * the old chart, worth recording: `braid.t` is not one row per minute. It
 * is 4,080 distinct minutes times the three legs the beat's own first
 * paragraph names (home win / draw / away win), each row carrying that
 * leg's own `kalshi_pts`/`polymarket_pts` at the SAME timestamp — verified
 * at build time (every timestamp in the loaded file appears exactly 3
 * times). A single line connecting these rows in array order — which is
 * exactly what the old two-line overlay did, and what this file's first
 * reshape pass also did before this fix — draws a false "spike" through
 * every single minute, because it is really drawing a straight segment
 * between three different tickets' prices (typically nowhere near each
 * other: a heavy favorite's leg and its draw leg do not trade at similar
 * prices) as if they were consecutive points in time. No axis change fixes
 * that; it is a join, not a scale, problem. The fix: group the loaded rows
 * by their shared timestamp and take ONE value per minute — the mean
 * absolute gap across whichever legs traded that minute — before a single
 * point ever reaches the line generator. That is also the more honest
 * chart for what the beat's prose claims ("the average gap stayed under
 * one cent"): an unsigned distance, resting on a zero floor, is what
 * "how far apart" means when three different tickets are being averaged
 * together; a signed Kalshi-minus-Polymarket value would cancel across
 * legs trading at unrelated price levels and mean nothing summed.
 *
 * The result: one line, the average distance between the two prices each
 * live minute, resting near a shaded five-point reference band it rarely
 * leaves, with the rare exceptions (goal-second reactions) reaching well
 * above it. Both series still come from this scene's own loaded braid
 * arrays (nothing invented); the gap is computed client-side from
 * `braid.kalshi_pts` and `braid.polymarket_pts`. The sixteen Pinnacle
 * suspensions (dossier's "professionals left the room" story) no longer
 * share an axis with a now-retired continuous Pinnacle line; they land as
 * sixteen sequenced vertical marks — the "Pinnacle lane" — crossing the
 * gap chart at the moment each one happens, exactly the visible, sequenced
 * event the review's doctrine section names.
 *
 * GATE-4 ROUND 4, BOUNDED FIX (research/design-review/visual-story-review.md
 * S10 critical/major findings; blind re-score 4/10 on the RESHAPE above).
 * The RESHAPE swapped in a real gap line, but the line's own rare
 * excursions (~30 places it leaves the band) drew at the same full ink-hi
 * weight as the near-zero baseline that IS the scene's message, so ~30
 * spikes tied for the frame's luminance peak while "the gap almost never
 * opens" sat in the dimmest ink on screen — figure-ground exactly
 * backwards. Four changes, all inside this file:
 *   (1) the gap line now draws TWICE from the same honest data — a dim,
 *       thin "ground" pass carrying the full shape (nothing hidden) and a
 *       bright, thick "figure" pass of the IDENTICAL path clipped to the
 *       within-band zone, so the near-zero baseline is the one bright
 *       shape on screen, not the spikes; the "within 5 cents" band and
 *       "same price" label are raised to match;
 *   (2) b2 now draws the sixteen grey Pinnacle-suspension lines its own
 *       pre-cue caption always promised. Previously that caption announced
 *       grey dashed lines while b2 actually flashed an un-keyed amber dot
 *       swarm from a DIFFERENT dataset (`goal_spikes`) and held the real
 *       lines back for b3 — an announce/deliver mismatch;
 *   (3) the amber budget is spent exactly once now, on b3's verdict text.
 *       That text no longer claims a Kalshi-vs-Pinnacle relationship this
 *       chart never plots (it plots Kalshi-vs-Polymarket and Pinnacle
 *       quote-termination timestamps, nothing else); it says only what
 *       those two plotted things say — Pinnacle stopped quoting, sixteen
 *       times — and a simultaneous highlight of the sixteen lines (plus a
 *       brief brighten of the ground pass) stands in for a leader line
 *       pointing at one mark among sixteen;
 *   (4) b1 gets a real onset (band and line fade in together) instead of
 *       three byte-identical frames, and the mean-gap readout stays hidden
 *       instead of sitting on screen as a dead "—" for two beats, then
 *       resolves once, in b3, at a size that matches its message.
 * `goal_spikes` stays in the data contract (other consumers read it — see
 * pipeline/export/check_scene_field_parity.py) but this scene no longer
 * renders it as its own mark set; those moments are already honest in the
 * gap line's own dim ground pass.
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
 * and "the dots stay at rest" going into S11 holds without a tween. This
 * scene's RESHAPE only touches the D3 overlay (the chart); the population
 * layout is untouched by design, so that hand-off still holds. */
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

/* One value per live minute from this scene's own loaded braid arrays — no
 * new data, just an honest read of what is actually there. `braid.t` packs
 * three rows per minute (one per three-way leg: home win, draw, away win —
 * see the header note), so this groups by timestamp first and takes the
 * MEAN ABSOLUTE gap across whichever legs traded that minute, producing
 * one {t, v} pair per unique minute rather than three same-instant rows a
 * naive line would zigzag through. Unsigned (a "how far apart" distance,
 * matching "the two never sat five points apart"), not signed
 * Kalshi-minus-Polymarket — a signed average across three tickets trading
 * at unrelated price levels would cancel and mean nothing. Skips any row
 * missing either venue's price (irregular data, per the header note). */
function toGapSeries(braid) {
  const tArr = braid.t || [];
  const k = braid.kalshi_pts || [];
  const p = braid.polymarket_pts || [];
  const byMinute = new Map(); // epoch seconds -> { sum, n }
  for (let i = 0; i < tArr.length; i++) {
    const kv = k[i];
    const pv = p[i];
    if (kv === null || kv === undefined || Number.isNaN(kv)) continue;
    if (pv === null || pv === undefined || Number.isNaN(pv)) continue;
    const gap = Math.abs(kv - pv);
    const t = tArr[i];
    const cur = byMinute.get(t);
    if (cur) { cur.sum += gap; cur.n += 1; } else { byMinute.set(t, { sum: gap, n: 1 }); }
  }
  const out = [];
  for (const [t, { sum, n }] of byMinute) out.push({ t: t * 1000, v: sum / n });
  out.sort((a, b) => a.t - b.t);
  return out;
}

export default {
  id: 's10',
  act: 3,
  title: 'Two crowds, one price',
  kicker: 'Skill 4 of 5: who is behind the number',
  layoutName: 'gap-line',

  needs: {
    scene: true,
    series: [],
    zoom: null,
  },

  scales(data, view) {
    const scene = data.scene || {};
    const win = scene.knockout_window
      ? [new Date(scene.knockout_window.start), new Date(scene.knockout_window.end)]
      : [new Date(data.manifest.epoch), new Date(data.manifest.frozen_at || data.manifest.generated)];
    const time = d3.scaleUtc().domain(win).range([view.region.x, view.region.x + view.region.w]);

    // The story is the GAP, not two overlaid absolute prices (visual-story-
    // review §5 S10 RESHAPE): derive one point per live minute from the
    // same braid arrays the old two-line overlay read (toGapSeries() above
    // — mean absolute gap across that minute's three-way legs). The values
    // are real; the WINDOW is a deliberate, fixed 0-20-point axis — the
    // same kind of fixed-domain choice the old absolute-price axis
    // ([0,100]) already made — so the labeled 0-5 band this beat's prose is
    // about (97.4% of live minutes never leave it) stays a full quarter of
    // the visible height instead of shrinking to a sliver next to the rare
    // goal-second spike that reaches the 50s. `.clamp(true)` pins any such
    // spike to the plot's top edge rather than letting the path escape the
    // chart box; a spike flattening against the ceiling still reads as
    // "this one blew past normal," the honest shape of a same-magnitude
    // but off-the-chart event.
    const braid = scene.braid || {};
    const gapPts = toGapSeries(braid);
    const domainMax = 20;
    const gap = d3.scaleLinear().domain([0, domainMax]).clamp(true)
      .range([view.region.y + view.region.h, view.region.y]);

    registry.register('s10.time', time);
    registry.register('s10.gap', gap);
    return { time, gap, gapPts };
  },

  layout(data, view) {
    // Figure/ground per research/revision/perception-brief.md §4, §9b: this
    // scene has NO active PARTICLE subset — by unit discipline the mover is
    // a D3 mark (the gap line), not dots. So the whole population is the
    // dimmed GROUND, assigned 'dimmed-field-min' (alpha 0.25 <= opacity-
    // rest-classify-max 0.42), which the engine's density-aware rest-tier
    // cap (tokens.density_tone_mapping.rest-luminance-cap) recedes further
    // still, so the field can never bloom past the chart's own ink. The
    // FIGURE that pops is the single gap line in ink-hi, direct-labeled by
    // its own axis title plus named in the persistent color key.
    return { states: { rest: restField(data, view) } };
  },

  overlay(container, data, view, scales) {
    const { svg, html } = container;
    let alive = true;

    const T = view.tokens.motion.durations_ms;
    const M = view.tokens.motion.misc;
    const drawIn = T['overlay-draw-in'];
    const recolorMs = T['recolor-min'];
    const stagger = T['overlay-stagger'];
    const maxSeq = M['overlay-max-sequenced-elements'];
    const countUpMax = T['counter-count-up-max'];
    const leaderWeight = view.tokens.layout['annotation-leader-weight-px'];
    const leaderStandoff = view.tokens.layout['annotation-leader-standoff-px'];
    const spacing = view.tokens.spacing_px; // [4,8,12,16,24,32,48,64,96,128]

    const g = svg.append('g').attr('class', 's10-gap');
    const bandLayer = g.append('g').attr('class', 's10-band');
    const axisLayer = g.append('g').attr('class', 's10-axes');
    const lineLayer = g.append('g').attr('class', 's10-line');
    const termLayer = g.append('g').attr('class', 's10-terms');

    const captionDiv = zoneK(
      html.append('div').attr('class', 's10-caption')
        .style('position', 'absolute')
        .style('font', '13px var(--font-tape)')
        .style('color', view.css('ink-mid'))
        .style('pointer-events', 'none'),
      view,
    );
    // The scene's single most message-bearing number ("under one cent")
    // now gets a readout worth reading (visual-story-review M4): larger,
    // ink-hi, on the shared scrim card so it survives sitting near the
    // chart. Stays empty (no dead "—") until b3 resolves it.
    const gapMeter = zoneF(
      html.append('div').attr('class', 's10-gap-meter scrim-card')
        .style('position', 'absolute')
        .style('font', '600 16px var(--font-tape)')
        .style('color', view.css('ink-hi'))
        .style('pointer-events', 'none'),
      view,
    );
    // Right-anchored (zoneTopRight) with a narrow max-width: the horizontal
    // gap between the chart's right edge and the KEY panel's left edge is
    // only ~180px, too narrow for the full verdict sentence on one line
    // (visual-story-review M1: the un-widthed div overflowed left, running
    // its tail UNDER the KEY panel). Wrapping downward instead keeps it on
    // clear canvas, on its own scrim.
    const countChip = zoneTopRight(
      html.append('div').attr('class', 's10-count-chip scrim-card')
        .style('position', 'absolute')
        .style('max-width', '168px')
        .style('text-align', 'right')
        .style('font', '13px var(--font-tape)')
        .style('color', view.css('accent-annotation'))
        .style('pointer-events', 'none'),
      view,
    );
    if (!view.mobile) {
      // Extra clearance below the shared key-exclusion budget (design
      // tokens' key-exclusion-h-px assumes the KEY's typical height; this
      // scene's three-row key with a two-line first entry runs slightly
      // taller, and the amber verdict must never sit under it).
      countChip.style('top', `${parseFloat(countChip.style('top')) + spacing[4]}px`);
    }

    const scene = data.scene || {};
    const terms = scene.pinnacle_terminations || [];
    const meanGap = scene.gap_summary ? scene.gap_summary.mean_1min_gap_pts : null;
    const gapPts = scales.gapPts || [];
    const domainMax = scales.gap.domain()[1];
    const BAND = Math.min(5, domainMax);
    const yTop = scales.gap(BAND);
    const y0 = scales.gap(0);

    const lineGen = d3.line()
      .x((d) => scales.time(d.t))
      .y((d) => scales.gap(d.v));

    // Axes: time across the knockout window, gap in points from a zero
    // floor. Mobile flip (design-revision-spec G3): a bottom axis on
    // mobile renders as axisTop translated to the same line, so tick
    // labels sit above it, inside the stage, instead of spilling into the
    // card sheet.
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
        .call(d3.axisLeft(scales.gap).ticks(5)),
      view.css('ink-mid'),
    );
    axisLayer.append('text')
      .attr('x', view.region.x).attr('y', view.region.y - leaderStandoff)
      .attr('fill', view.css('ink-mid'))
      .style('font', '12px var(--font-apparatus)')
      .text('gap between Kalshi and Polymarket (points)');
    axisLayer.append('text')
      .attr('x', view.region.x + view.region.w / 2)
      .attr('y', view.mobile
        ? view.region.y + view.region.h - spacing[6]
        : view.region.y + view.region.h + spacing[4] + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', view.css('ink-mid'))
      .style('font', '12px var(--font-apparatus)')
      .text('the knockout stage (date)');

    // Clip path for the "within band" zone (y between the zero floor and
    // the BAND line). Anything the gap line draws inside this rect is the
    // scene's one bright figure; anything outside it (a spike) only ever
    // reaches the dim ground pass below (visual-story-review C1: ~30
    // bright spikes were tying for the frame's luminance peak against a
    // near-invisible near-zero baseline — this inverts that).
    const clipId = 's10-band-clip';
    g.append('defs').append('clipPath').attr('id', clipId).append('rect')
      .attr('x', view.region.x).attr('width', view.region.w)
      .attr('y', yTop).attr('height', Math.max(0, y0 - yTop));

    // The shaded 0-5-point reference band and the zero-floor label —
    // drawn once, persistent through every beat, and now b1's one
    // announced onset (visual-story-review M3: b1 previously had no
    // perceivable change across its three frames). Band and labels fade
    // in together; "same price" is promoted to ink-hi — the scene's
    // headline claim, no longer its faintest ink. Reduced motion renders
    // the settled state immediately.
    function drawBandAndZero() {
      bandLayer.selectAll('*').remove();
      const bandRect = bandLayer.append('rect')
        .attr('x', view.region.x).attr('width', view.region.w)
        .attr('y', yTop).attr('height', Math.max(0, y0 - yTop))
        .attr('fill', view.css('ink-low')).attr('stroke', 'none')
        .attr('fill-opacity', 0);
      // Both labels get a small scrim (the s04.js getBBox() pattern): the
      // gap line's own spikes can land anywhere along the timeline, this
      // scene's whole point, so no fixed x position for these two context
      // labels is guaranteed clear of one. A scrim makes the guarantee
      // instead of a guess at placement.
      function scrimmedLabel(x, y, anchor, color, text) {
        const t = bandLayer.append('text')
          .attr('x', x).attr('y', y).attr('text-anchor', anchor)
          .attr('fill', color).attr('opacity', 0)
          .style('font', '12px var(--font-apparatus)')
          .text(text);
        const bb = t.node().getBBox();
        const scrim = bandLayer.insert('rect', () => t.node())
          .attr('x', bb.x - spacing[0]).attr('y', bb.y - spacing[0] / 2)
          .attr('width', bb.width + spacing[0] * 2).attr('height', bb.height + spacing[0])
          .attr('rx', 2)
          .attr('fill', view.css('bg-card-composite-cap')).attr('opacity', 0);
        return [t, scrim];
      }
      const [zeroLabel, zeroScrim] = scrimmedLabel(
        view.region.x + view.region.w - spacing[1], y0 - spacing[0], 'end',
        view.css('ink-hi'), 'same price',
      );
      const [bandLabel, bandScrim] = scrimmedLabel(
        view.region.x + spacing[1], yTop - spacing[0], 'start',
        view.css('ink-mid'), `within ${BAND} cents`,
      );
      if (!view.reducedMotion) {
        bandRect.transition().duration(drawIn).attr('fill-opacity', 0.22);
        zeroScrim.transition().duration(drawIn).attr('opacity', 0.8);
        zeroLabel.transition().duration(drawIn).attr('opacity', 1);
        bandScrim.transition().delay(stagger).duration(drawIn).attr('opacity', 0.8);
        bandLabel.transition().delay(stagger).duration(drawIn).attr('opacity', 1);
      } else {
        bandRect.attr('fill-opacity', 0.22);
        zeroScrim.attr('opacity', 0.8);
        zeroLabel.attr('opacity', 1);
        bandScrim.attr('opacity', 0.8);
        bandLabel.attr('opacity', 1);
      }
    }

    // The one figure: how close Kalshi and Polymarket traded, minute by
    // minute — rendered as TWO passes of the same honest data (nothing
    // invented, nothing hidden). A dim, thin "ground" pass carries the
    // full shape, spikes included, so a reader can still see they happen.
    // A bright, thick "figure" pass draws the IDENTICAL line but clipped
    // to the within-band zone, so the near-zero baseline — where the line
    // sits ~97% of the time — is the one bright shape on screen, not the
    // rare excursions above it (visual-story-review C1). ink-hi, not
    // ink-hero (design-system.md §2 reserves pure white for S17 alone).
    function drawGapLine() {
      lineLayer.selectAll('*').remove();
      const groundWidth = Math.max(1, leaderWeight - 0.5);
      const figureWidth = leaderWeight + 1.5;
      const ground = lineLayer.append('path').datum(gapPts).attr('class', 'gap-line-ground')
        .attr('fill', 'none').attr('stroke', view.css('field-rest'))
        .attr('stroke-width', groundWidth).attr('stroke-opacity', 0).attr('d', lineGen);
      const figure = lineLayer.append('path').datum(gapPts).attr('class', 'gap-line-figure')
        .attr('fill', 'none').attr('stroke', view.css('ink-hi'))
        .attr('stroke-width', figureWidth).attr('clip-path', `url(#${clipId})`)
        .attr('stroke-opacity', 0).attr('d', lineGen);
      if (!view.reducedMotion) {
        ground.transition().duration(drawIn).attr('stroke-opacity', 0.35);
        figure.transition().delay(drawIn * 0.2).duration(drawIn).attr('stroke-opacity', 1);
      } else {
        ground.attr('stroke-opacity', 0.35);
        figure.attr('stroke-opacity', 1);
      }
    }

    function resolveGapMeter() {
      if (!alive || meanGap === null || meanGap === undefined) return;
      const label = (v) => `mean gap: ${v.toFixed(2)} points${v < 1 ? ' — under one cent' : ''}`;
      if (view.reducedMotion) {
        gapMeter.text(label(meanGap));
        return;
      }
      const t0 = performance.now();
      const tick = (now) => {
        if (!alive) return;
        const p = Math.min(1, (now - t0) / countUpMax);
        gapMeter.text(label(meanGap * p));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // The "Pinnacle lane": sixteen sequenced vertical marks, one per
    // suspension, landing with an onset (change-blindness countermeasure,
    // perception brief §7). This is b2's entire job and its ONLY job — it
    // is exactly what the beat's own caption announces, drawn the moment
    // it announces it (visual-story-review C3: the prior build promised
    // these lines in b2 but delivered an un-keyed amber dot swarm instead,
    // from a different dataset, and held the real lines back for b3).
    // Idempotent — safe to call again from b3 if a reader scrubs straight
    // there without passing through b2 first.
    function landTerminations() {
      const sel = termLayer.selectAll('line.term')
        .data(terms, (d, i) => (d.match_id || '') + (d.leg || '') + i);
      const enter = sel.enter().append('line').attr('class', 'term')
        .attr('x1', (d) => scales.time(new Date(d.t)))
        .attr('x2', (d) => scales.time(new Date(d.t)))
        .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
        .attr('stroke', view.css('venue-pinnacle-terminated'))
        .attr('stroke-width', leaderWeight)
        .attr('stroke-dasharray', '2,3')
        .style('opacity', 0);
      const merged = enter.merge(sel);
      if (!view.reducedMotion) {
        merged.transition()
          .delay((d, i) => Math.min(i, maxSeq - 1) * stagger)
          .duration(drawIn).style('opacity', 0.9);
      } else {
        merged.style('opacity', 0.9);
      }
      captionDiv.text('Grey lines: Pinnacle stops quoting, one at a time.');
    }

    // b3's payoff: count the sixteen lines already on screen, then land
    // the scene's one amber statement (visual-story-review C4: the amber
    // budget is spent exactly once, here — no key-border spotlight, no
    // dot swarm, just this). `highlightEvidence` brightens the sixteen
    // lines together, plus the dim spike-ground they sit on, the instant
    // the verdict lands — a simultaneous highlight standing in for a
    // leader line that would otherwise have to pick one mark of sixteen
    // (visual-story-review M1).
    function revealVerdict() {
      if (termLayer.selectAll('line.term').empty()) landTerminations();
      captionDiv.text('Counting every stoppage.');
      runCountUp(terms.length || 16);
    }

    function highlightEvidence() {
      if (view.reducedMotion) {
        termLayer.selectAll('line.term').style('opacity', 1).attr('stroke-width', leaderWeight + 0.5);
        lineLayer.select('path.gap-line-ground').attr('stroke-opacity', 0.6);
        return;
      }
      termLayer.selectAll('line.term').transition().duration(recolorMs)
        .style('opacity', 1).attr('stroke-width', leaderWeight + 0.5);
      lineLayer.select('path.gap-line-ground').transition().duration(recolorMs)
        .attr('stroke-opacity', 0.6);
    }

    function runCountUp(n) {
      if (!alive) return;
      if (view.reducedMotion) {
        countChip.text(`${n} of ${n} times, Pinnacle simply stopped quoting.`);
        highlightEvidence();
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
          countChip.text(`${n} of ${n} times, Pinnacle simply stopped quoting.`);
          highlightEvidence();
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
          drawBandAndZero();
          drawGapLine();
          captionDiv.text('The dots rest here. One mark is one minute of matched price.');
          gapMeter.text('');
          countChip.text('');
        } else if (beatId === 'b2') {
          landTerminations();
        } else if (beatId === 'b3') {
          revealVerdict();
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
      html: `<p>Every match in the knockout stage has three tickets: one pays out on a home win, one on a draw, one on an away win. Traders call this the three-way. A point on this chart is one cent of price, so a five-point gap is five cents, about five chances out of a hundred.</p><p>Two rival markets priced every one of those tickets, all month: Kalshi, built in the United States, and Polymarket, built offshore. The chart below tracks how far apart the two ran, minute by minute, averaged across all three tickets. The two never sat five points apart for even thirty minutes. Minute by minute, the average gap stayed under one cent.${FN(15)}</p><p>Here is why the gap almost never opens. When one market prices a ticket a little rich and the other prices it a little cheap, traders buy the cheap ticket and sell the rich one until the two prices meet. That trade is close to free money, so the gap closes fast.</p>`,
      trigger: 'step',
      state: 'rest',
      kind: 'resort',
      chip: [
        { token: 'ink-hi', glyph: 'line', label: 'bright = how close Kalshi and Polymarket traded' },
        { token: 'venue-pinnacle-terminated', glyph: 'dash', label: 'grey = Pinnacle stops quoting' },
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
      // Pure-visual step: this is where the beat's own chip key ("grey
      // dashed = Pinnacle stops quoting") actually lands. The sixteen
      // suspension lines draw here, sequenced, with an onset (visual-
      // story-review C3: the prior build promised this line-landing in
      // b2's caption but delivered an un-keyed amber dot swarm from a
      // different dataset instead, holding the real lines back for b3 —
      // a broken announce/deliver contract).
      html: '<!-- visual-only step: the sixteen Pinnacle-suspension lines land -->',
      trigger: 'step',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>Sixteen times during the knockout stage, Pinnacle — the professional sportsbook from the goal scene — simply stopped quoting a live three-way. Each grey line marks the moment: not one shows a fresh Pinnacle quote arriving afterward.${FN(15)}</p><p>Sixteen episodes, one cause: the professionals had left the room.</p>`,
      trigger: 'step',
      overlayStep: 'b3',
    },
  ],

  anchors: {
    /* L1 recap for S16's lens carousel (CONTRACT §4 `anchors?`): the
     * population at rest under the scene's own time frame. S10 never
     * re-sorts its own dots, and the recap does not fabricate a price (or
     * gap) line — this scene's D3 data lives in s10.json, which S16 does
     * not load. Self-sufficient: reads only data.pop and data.manifest,
     * builds a fresh local time scale (the registry key this scene owned
     * is cleared on exit, CONTRACT §6.1). S16 applies no dot spotlight to
     * L1, matching "the chart is D3-only, the population rests." */
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
        // Tight central band: the two venues braided into one line. No axis
        // is drawn for L1 beyond the time ticks, so the band's vertical
        // position carries no price/gap claim; it reads as the resting
        // population under the scene's own timeline.
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
            .attr('fill', view.css('ink-hi'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-annotation-size'))
            .text('Kalshi vs Polymarket, gap');
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
