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
 * GATE-5 ITEMS 11 + 12 (research/revision/gate5-feedback-notes.md; closes
 * provenance-ledger.md's s10 #1, NOT_FIXED). Item 11: the ROUND-4 ground
 * pass was honest data but unreadable as a category — a reader saw "bold
 * and thin white lines" and could not tell a baseline from an artifact,
 * and the [0,20] axis clipped spike tops with no on-screen sign a cap even
 * existed. Four fixes, all in this file: (1) the ground pass now draws
 * dashed and a shade dimmer, reading as "not a primary series" on sight;
 * (2) a new maxSingleGapPts() helper recomputes the true peak straight off
 * this scene's own loaded braid (same discipline as meanGap above, not a
 * read of the separately-sourced gap_summary.goal_second_spike_pts field)
 * and a new echo note (drawGapLine's sibling drawEchoNote(), painted in a
 * new noteLayer above lineLayer) names the mechanic and discloses that
 * peak; (3) the y-axis's top tick now reads "20+" and the axis title
 * states the cap in words; (4) b1's prose gains an up-front "this line is
 * a distance, not a price" sentence (the beat's own "one cent of price"
 * had invited the opposite reading) and two sentences teaching the echo
 * mechanic (both venues stamp trades once a minute, so a goal at that
 * instant can straddle the two records differently, closing again within
 * seconds). Item 12: b3's "the professionals had left the room" was a
 * metaphor with no stated mechanism and no stated stakes. Replaced with
 * the plain policy tie (Pinnacle's in-game book closes at the ninety-
 * minute mark by its own house rules, the same rules named in the goal
 * scene) and the payoff the metaphor skipped — a gap against a book that
 * stopped quoting is not a disagreement, it is an empty chair, the same
 * mistake this project's own first analysis pass made before checking
 * whether Pinnacle was still quoting (the killed 14-2 "Kalshi beats the
 * pros" finding named in findings-dossier.md's killed-findings list).
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
 *       "mean_1min_gap_pts": 1.3,      // Gate-5 provenance audit: no longer
 *                                      // read by this module (meanGap is
 *                                      // now d3.mean(gapPts) -- the exact
 *                                      // same array the line draws, see
 *                                      // overlay() below); kept for
 *                                      // provenance, class-A recompute off
 *                                      // this scene's own shipped braid,
 *                                      // not the differently-windowed
 *                                      // kalshi_vs_polymarket_max_gaps.csv
 *                                      // this field used to repack verbatim
 *       "goal_second_spike_pts": 83.5, // same braid, still unread by this
 *                                      // module (kept for provenance only)
 *       "goal_second_spike_duration_s": null,  // was a fabricated "60s"
 *                                      // guess never actually measured;
 *                                      // also unread here
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

/* Gate-5 item 11: the single largest goal-minute recording echo, read
 * straight off this scene's own loaded braid arrays -- the largest
 * |kalshi_pts - polymarket_pts| across every row, BEFORE toGapSeries's
 * per-minute, three-leg averaging smooths it down. This is the number the
 * chart's spike-disclosure annotation reports: how far one ticket's paper
 * gap reached at its worst, which the axis-capped, averaged line can never
 * show at full height (provenance-ledger.md s10 #1, NOT_FIXED -- the axis
 * clipped silently with no on-screen disclosure of what it clipped).
 * Deliberately recomputed here rather than read from
 * scene.gap_summary.goal_second_spike_pts, matching why meanGap moved off
 * gap_summary.mean_1min_gap_pts above: one array, one source of truth, no
 * separately-windowed field free to drift against it. (The two happen to
 * agree today -- both 83.5 -- because the JSON field was itself corrected
 * to recompute off this same braid; this function makes that agreement
 * structural instead of coincidental.) */
function maxSingleGapPts(braid) {
  const k = braid.kalshi_pts || [];
  const p = braid.polymarket_pts || [];
  let max = 0;
  for (let i = 0; i < k.length; i++) {
    const kv = k[i];
    const pv = p[i];
    if (kv === null || kv === undefined || Number.isNaN(kv)) continue;
    if (pv === null || pv === undefined || Number.isNaN(pv)) continue;
    const gap = Math.abs(kv - pv);
    if (gap > max) max = gap;
  }
  return max;
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
    // but off-the-chart event. Gate-5 item 11 / provenance-ledger.md s10 #1
    // (NOT_FIXED): the flattened shape alone never told a reader HOW FAR
    // past normal, so the top axis tick now reads "20+" and one on-chart
    // annotation states the true peak in points (spikeMaxPts below, from
    // maxSingleGapPts() -- see overlay()'s echo note).
    const braid = scene.braid || {};
    const gapPts = toGapSeries(braid);
    const spikeMaxPts = maxSingleGapPts(braid);
    const domainMax = 20;
    const gap = d3.scaleLinear().domain([0, domainMax]).clamp(true)
      .range([view.region.y + view.region.h, view.region.y]);

    registry.register('s10.time', time);
    registry.register('s10.gap', gap);
    return {
      time, gap, gapPts, spikeMaxPts,
    };
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
    // Gate-5 item 11: the spike-disclosure note lives ABOVE lineLayer in
    // paint order (not in bandLayer, where the band/zero labels live) so
    // it stays legible even on the rare minute its own fixed position
    // falls under a flattened, clipped-to-ceiling spike.
    const noteLayer = g.append('g').attr('class', 's10-note');
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
    const gapPts = scales.gapPts || [];
    // Gate-5 provenance audit (WRONG_SCOPE): scene.gap_summary.mean_1min_gap_pts
    // is scoped to a fixed 150-minute pre-resolution window (a narrower,
    // differently-anchored population than what this chart actually
    // draws); computed here instead as the mean of gapPts, the EXACT SAME
    // array the line below plots, so the readout and the chart can never
    // describe two different populations again.
    const meanGap = gapPts.length ? d3.mean(gapPts, (d) => d.v) : null;
    const domainMax = scales.gap.domain()[1];
    const BAND = Math.min(5, domainMax);
    const yTop = scales.gap(BAND);
    const y0 = scales.gap(0);
    // Gate-5 item 11 / provenance-ledger.md s10 #1: the true peak of a
    // goal-minute recording echo, from maxSingleGapPts() above -- what the
    // axis's "20+" top tick and the echo note both disclose.
    const spikeMaxPts = scales.spikeMaxPts || 0;

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
    // Gate-5 item 11 / provenance-ledger.md s10 #1 (NOT_FIXED): the domain
    // silently clipped spike tops with no on-screen sign that a cap even
    // existed. The top tick now reads "20+" -- d3's own nice-number ticks
    // for a [0,20] domain land exactly on 20, so this never misses -- and
    // the axis title states the cap in words too.
    styleAxis(
      axisLayer.append('g')
        .attr('transform', `translate(${view.region.x},0)`)
        .call(d3.axisLeft(scales.gap).ticks(5)
          .tickFormat((d) => (d === domainMax ? `${d}+` : d))),
      view.css('ink-mid'),
    );
    axisLayer.append('text')
      .attr('x', view.region.x).attr('y', view.region.y - leaderStandoff)
      .attr('fill', view.css('ink-mid'))
      .style('font', '12px var(--font-apparatus)')
      .text('gap between Kalshi and Polymarket (points, capped at 20)');
    // Text-collision sweep (Gate-5 item 3 disposition 2): centered under
    // the axis, this title's row sat right on top of Zone F's gap-meter
    // card (region.y + region.h + footer-slot-offset-px, spec'd in
    // design-revision-spec.md G5 and shared by every scene, so its own
    // offset isn't the thing to move) -- the card's left ~380px, this
    // title's centered ~160px, both starting near region.x, left no way
    // to stack them with the little vertical room this footer has.
    // Right-aligning to the region's edge moves it clear of the card
    // horizontally instead, same row, same convention everywhere else
    // reads it (bottom of its own axis).
    axisLayer.append('text')
      .attr('x', view.mobile ? view.region.x + view.region.w / 2 : view.region.x + view.region.w)
      .attr('y', view.mobile
        ? view.region.y + view.region.h - spacing[6]
        : view.region.y + view.region.h + spacing[4] + 14)
      .attr('text-anchor', view.mobile ? 'middle' : 'end')
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

    // Shared by every scrimmed on-chart label below (the s04.js getBBox()
    // pattern): the gap line's own spikes can land anywhere along the
    // timeline, this scene's whole point, so no fixed label position is
    // guaranteed clear of one. A scrim makes the guarantee instead of a
    // guess at placement. Takes the target layer as a parameter (Gate-5
    // item 11: the echo note below needs to paint in noteLayer, ABOVE
    // lineLayer, not in bandLayer underneath it, so it stays legible even
    // if a clipped spike's flat top passes behind it).
    function scrimmedLabel(layer, x, y, anchor, color, text) {
      const t = layer.append('text')
        .attr('x', x).attr('y', y).attr('text-anchor', anchor)
        .attr('fill', color).attr('opacity', 0)
        .style('font', '12px var(--font-apparatus)')
        .text(text);
      const bb = t.node().getBBox();
      const scrim = layer.insert('rect', () => t.node())
        .attr('x', bb.x - spacing[0]).attr('y', bb.y - spacing[0] / 2)
        .attr('width', bb.width + spacing[0] * 2).attr('height', bb.height + spacing[0])
        .attr('rx', 2)
        .attr('fill', view.css('bg-card-composite-cap')).attr('opacity', 0);
      return [t, scrim];
    }

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
      const [zeroLabel, zeroScrim] = scrimmedLabel(
        bandLayer, view.region.x + view.region.w - spacing[1], y0 - spacing[0], 'end',
        view.css('ink-hi'), 'same price',
      );
      const [bandLabel, bandScrim] = scrimmedLabel(
        bandLayer, view.region.x + spacing[1], yTop - spacing[0], 'start',
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

    // Gate-5 item 11 / provenance-ledger.md s10 #1 (NOT_FIXED): names the
    // spikes as a mechanic (a "recording echo," not a second price series)
    // and discloses the true peak the axis cap hides. Drawn once, alongside
    // the band and zero labels, in noteLayer so it always paints above the
    // line itself.
    function drawEchoNote() {
      noteLayer.selectAll('*').remove();
      const [noteLabel, noteScrim] = scrimmedLabel(
        noteLayer, view.region.x + spacing[1], view.region.y + spacing[2], 'start',
        view.css('ink-mid'),
        `dashed spikes are recording echoes, reaching up to ${Math.round(spikeMaxPts)} points past this chart's cap`,
      );
      if (!view.reducedMotion) {
        noteScrim.transition().delay(stagger * 2).duration(drawIn).attr('opacity', 0.8);
        noteLabel.transition().delay(stagger * 2).duration(drawIn).attr('opacity', 1);
      } else {
        noteScrim.attr('opacity', 0.8);
        noteLabel.attr('opacity', 1);
      }
    }

    // The one figure: how close Kalshi and Polymarket traded, minute by
    // minute — rendered as TWO passes of the same honest data (nothing
    // invented, nothing hidden). A dim, thin, DASHED "ground" pass carries
    // the full shape, spikes included, so a reader can still see they
    // happen — the dashing marks that shape as an artifact (Gate-5 item 11:
    // the author read two solid white lines as two competing price series,
    // not one line's baseline plus its own recording-echo spikes; a dashed
    // stroke reads as "not a primary series" on sight, without a legend
    // lookup). A bright, thick, SOLID "figure" pass draws the IDENTICAL
    // line but clipped to the within-band zone, so the near-zero baseline
    // — where the line sits ~97% of the time — is the one bright shape on
    // screen, not the rare excursions above it (visual-story-review C1).
    // ink-hi, not ink-hero (design-system.md §2 reserves pure white for
    // S17 alone).
    function drawGapLine() {
      lineLayer.selectAll('*').remove();
      const groundWidth = Math.max(1, leaderWeight - 0.5);
      const figureWidth = leaderWeight + 1.5;
      const ground = lineLayer.append('path').datum(gapPts).attr('class', 'gap-line-ground')
        .attr('fill', 'none').attr('stroke', view.css('field-rest'))
        .attr('stroke-width', groundWidth).attr('stroke-dasharray', '3,3')
        .attr('stroke-opacity', 0).attr('d', lineGen);
      const figure = lineLayer.append('path').datum(gapPts).attr('class', 'gap-line-figure')
        .attr('fill', 'none').attr('stroke', view.css('ink-hi'))
        .attr('stroke-width', figureWidth).attr('clip-path', `url(#${clipId})`)
        .attr('stroke-opacity', 0).attr('d', lineGen);
      if (!view.reducedMotion) {
        ground.transition().duration(drawIn).attr('stroke-opacity', 0.28);
        figure.transition().delay(drawIn * 0.2).duration(drawIn).attr('stroke-opacity', 1);
      } else {
        ground.attr('stroke-opacity', 0.28);
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
          drawEchoNote();
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
      html: `<p>Every match in the knockout stage has three tickets: one pays out on a home win, one on a draw, one on an away win. Traders call this the three-way. The line on this chart is not a price. It is the distance between the two markets' prices for the same ticket. One point equals one cent of that distance. A five-point gap means the two prices sat five cents apart, about five chances out of a hundred.</p><p>Two rival markets priced every one of those tickets, all month: Kalshi, built in the United States, and Polymarket, built offshore. The chart below tracks how far apart the two ran, minute by minute, averaged across all three tickets. The two never sat five points apart for even thirty minutes. Minute by minute, the average gap stayed close to a penny.${FN(15)} Watch for the faint, dashed spikes at goal minutes: each venue stamps its trades once a minute, so a goal at that instant can land in one venue's record before the other's. The paper gap jumps, then closes within seconds once both catch up, a recording echo rather than a real disagreement.</p><p>Here is why the gap almost never opens. When one market prices a ticket a little rich and the other prices it a little cheap, traders buy the cheap ticket and sell the rich one until the two prices meet. That trade is close to free money, so the gap closes fast.</p>`,
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
      html: `<p>Sixteen times in the knockout stage, Pinnacle stopped quoting a live three-way price. Pinnacle is the professional sportsbook from the goal scene. Each grey line marks that moment. No line shows a fresh quote arriving after it.${FN(15)}</p><p>All sixteen have one cause: Pinnacle stopped posting prices. Its in-game book closes as the ninety minutes run out, by its own house rules, the same rules from the goal scene. The feed ends, and no fresh quote ever follows.</p><p>Why this matters: a gap against a book that stopped quoting is not a disagreement. It is an empty chair. Our own first analysis fell for it: it counted sixteen wins for the crowd over the pros before we checked whether the pros were still in the game.</p>`,
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
