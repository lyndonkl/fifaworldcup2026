/* docs/js/scenes/s11.js — Act III · "The verdict, and the trap"
 *
 * Storyboard: research/storyboard.md §3 S11 (layoutName 'brier-columns').
 * Contract: docs/CONTRACT.md §4.2 (act 3, 3 steps, no zoom tile). Findings:
 * dossier R5 + R19 + the cross-arm suspension story (dossier §4, footnote
 * [^22]). Design: research/design-system.md §9 S11 ("D3 columns in venue
 * hues, zero-baselined. T-5min blowout desaturates to state.dead under a
 * white strike. Receipts at footnote-weight mono ink.low. Dots never
 * move.").
 *
 * GATE-4 ROUND 2 (research/revision/structure-spec.md §5 S11;
 * research/revision/design-revision-spec.md §2 S11): title unchanged; the
 * course spine now runs on screen via `kicker` ("Skill 4, continued").
 * Prose rewritten to eighth-grade register — vig/devig and forecast-grading
 * are taught in plain words before any score is shown, "Brier" itself is
 * banned from body prose (named once, in the footnote, per the jargon
 * rule) and survives only inside the y-axis title, an apparatus label, not
 * a sentence. Both amber usages in this scene are deleted (this scene's own
 * "no amber" rule): the matched-leg figure and the crossout caption both
 * recolor to ink-mid. The white strike stays the scene's one ink-hero
 * element. Ends with the act's two close cards (Skill unlocked / The
 * receipt), prose only. No data binding, layout, or engine change; every
 * edit below is text, color, or position only.
 *
 * GATE-4 ROUND 3, SIMPLIFY (research/design-review/visual-story-review.md
 * §5 S11 doctrine: "solid-fill bars, rest band out of the chart frame,
 * scrim under the verdict annotation, strike-through as a labeled visible
 * event"). Three changes, all inside this file's own SVG overlay:
 * (1) the three-source columns were outline-only rects on a resting field
 * the blind audit read as "a grey outline on white speckle" — they are now
 * solid venue-hue fills, so the comparison reads as columns, not a hunt for
 * thin strokes. (2) this scene's population is pinned pixel-identical to
 * s10's resting field for object constancy (b1 is `kind: 'instant'`,
 * nothing may visibly move) — dots cannot be relocated, so "the rest band
 * out of the chart frame" is achieved the way the engine's own density cap
 * is achieved: a dedicated backdrop panel (`bg-card-composite-cap`, the
 * token design-system.md already documents as "hard cap on worst-case
 * translucent composite over lit particles") behind the whole plot
 * rectangle, giving the columns and axes a quiet reading surface distinct
 * from the ambient population outside it. (3) the verdict annotation (the
 * "closed book" line) gets that same treatment locally, via the
 * getBBox()-measured scrim pattern s04.js already established for exactly
 * this failure mode.
 *
 * GATE-4 ROUND 4, BLIND-REVIEW FIX-PASS (research/design-review/
 * visual-story-review.md, s11 critical/major findings; blind match 5/10 ->
 * repair). Six changes, all inside this file: (1) the T-5min professional
 * bar now renders with a hatch fill (venue-pinnacle-terminated diagonal
 * lines over bg-card-composite-cap, the same "no longer quoting" token
 * s10.js already uses for Pinnacle's dashed requote lines) plus an
 * always-on adjacent label, "graded after the book closed (90:00)" --
 * visible from the moment the bar first draws at b2, not only once b3's
 * prose explains it, so an images-only reader is never shown the blowout
 * as an unqualified result. (2) `matchedLeg`, `smallN`, and the b3 verdict
 * annotation move out of the cramped footer (which had at most ~30px free
 * before the viewport edge, once the x-axis title is accounted for) and
 * into the open top-left margin under the y-axis title, stacked one line
 * apart, left-aligned -- this also pulls the verdict annotation clear of
 * the fixed KEY panel's footprint, which was swallowing its middle third.
 * (3) the verdict annotation is promoted to ink-hi (the scene's one
 * luminance peak) and the strike-through demoted to ink-mid, so chrome no
 * longer outranks the payoff. (4) the receipt panel gets the shared
 * `.scrim-card` treatment and ink-mid instead of bare ink-low over the
 * particle field, and moves to a bottom-right anchor clear of the new
 * artifact label. (5) bar grow-in delay keys on horizon (group), not row
 * index, so every bar in a trio starts and grows in lockstep -- the tie
 * can no longer read as a 7x gap mid-tween. (6) the backdrop scrim widens
 * toward the viewport edge and darkens (0.45 -> 0.68 opacity) so the rest
 * field recedes hard enough that a bar reads as a bar, not camouflage
 * against the population. No data, layout, or engine change.
 *
 * ---------------------------------------------------------------------
 * DATA CONTRACT ASSUMPTIONS (flagged in this build's data_requests; per
 * CONTRACT §5.5 the exact per-scene JSON shape is a scene-builder proposal
 * grounded in the storyboard's named Data block). Verified at build time
 * against pipeline/data/analysis/calibration/scores_match3way_by_source_horizon.csv,
 * whose columns (horizon, source, n, brier, ...) map directly onto `scores`
 * below:
 *
 *   needs.scene -> data/scenes/s11.json:
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "scores": [
 *       { "horizon": "T-24h",  "source": "kalshi",         "brier": 0.1624, "n": 84 },
 *       { "horizon": "T-24h",  "source": "polymarket",     "brier": 0.1628, "n": 84 },
 *       { "horizon": "T-24h",  "source": "pinnacle_devig", "brier": 0.1640, "n": 84 },
 *       { "horizon": "T-1h",   "source": "kalshi",         "brier": 0.1595, "n": 84 },
 *       { "horizon": "T-1h",   "source": "polymarket",     "brier": 0.1589, "n": 84 },
 *       { "horizon": "T-1h",   "source": "pinnacle_devig", "brier": 0.1688, "n": 84 },
 *       { "horizon": "T-5min", "source": "kalshi",         "brier": 0.0026, "n": 84 },
 *       { "horizon": "T-5min", "source": "polymarket",     "brier": 0.0045, "n": 84 },
 *       { "horizon": "T-5min", "source": "pinnacle_devig", "brier": 0.0974, "n": 84 }
 *     ],
 *     "blowout_share_pct": 74,   // "roughly 74% of the professional book's
 *     "blowout_matches_n": 5,    // error comes from five matches with
 *                                // stoppage-time goals" (dossier R5) — not
 *                                // located as an existing pipeline column
 *                                // at build time; flagged in data_requests
 *     "n_legs": 84,
 *     "effective_n": 28
 *   }
 * ---------------------------------------------------------------------
 */

import { registry, particleState, makeState, setColor } from '../shared.js';

const FN = (n) => `<sup class="fn"><a href="#fn-${n}">${n}</a></sup>`;

/* Mirrors s10.js's restField() exactly — see that file's header for why
 * this is duplicated rather than imported (CONTRACT §2 module import
 * rules reserve sibling-scene imports for S16's anchors only). Any change
 * here must be mirrored there or "dots never move" breaks between scenes. */
function hash01(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}
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

/* Placement-zone helpers (design-revision-spec.md G5), duplicated from
 * s10.js rather than imported — see that file's header note. */
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

const HORIZONS = ['T-24h', 'T-1h', 'T-5min'];
const HORIZON_LABELS = { 'T-24h': 'a day out', 'T-1h': 'an hour out', 'T-5min': '5 min out' };
const SOURCES = ['kalshi', 'polymarket', 'pinnacle_devig'];
const SOURCE_TOKEN = {
  kalshi: 'venue-kalshi',
  polymarket: 'venue-polymarket',
  pinnacle_devig: 'venue-pinnacle',
};

// Plain-word rewrite of the three places this analysis fell into the same
// trap (design-revision-spec §2 S11: no "Brier" in body text or this
// receipt; register rule G4 jargon deletions). Read aloud alongside beat
// b3's own prose, which now names all three inline so the point survives
// on a screen too narrow for the floating panel (see crossOutT5min()).
const THREE_TRAPS = [
  'the sixteen "gaps" with the professionals, seen earlier',
  'the goal-reaction speed ladder, seen earlier',
  'this five-minutes-left score, seen just now',
];

export default {
  id: 's11',
  act: 3,
  title: 'The verdict, and the trap',
  kicker: 'Skill 4, continued: the pros tied, and the trap',
  layoutName: 'brier-columns',

  needs: {
    scene: true,
    series: [],
    zoom: null,
  },

  scales(data, view) {
    const scores = (data.scene && data.scene.scores) || [];
    const maxBrier = d3.max(scores, (d) => d.brier) || 0.2;
    const x = d3.scaleBand().domain(HORIZONS)
      .range([view.region.x, view.region.x + view.region.w]).padding(0.32);
    const xSub = d3.scaleBand().domain(SOURCES).range([0, x.bandwidth()]).padding(0.18);
    // Zero-baselined always (storyboard §Overlays; CONTRACT §4.5).
    const y = d3.scaleLinear().domain([0, maxBrier]).nice()
      .range([view.region.y + view.region.h, view.region.y]);
    registry.register('s11.x', x);
    registry.register('s11.xSub', xSub);
    registry.register('s11.y', y);
    return { x, xSub, y };
  },

  layout(data, view) {
    // Figure/ground per research/revision/perception-brief.md §4, §9b: like S10,
    // this scene has NO active PARTICLE subset — a score is not money, so the
    // movers are solid-fill D3 columns, not dots. The whole population is the
    // dimmed GROUND at 'dimmed-field-min' (alpha 0.25, inside the engine's
    // rest-tier so emphasis-rest-dim recedes it further each frame), further
    // receded behind this scene's own backdrop panel (see overlay() below).
    // The FIGURE that pops is the D3 columns in bright venue hues, named by
    // the persistent color key so the reader knows which source each color is.
    return { states: { rest: restField(data, view) } };
  },

  overlay(container, data, view, scales) {
    const { svg, html } = container;
    // No `alive` guard needed here (unlike s10.js): every animation below
    // is a plain D3 transition with no recursive setTimeout/rAF chain that
    // could touch a removed selection after exit().

    const T = view.tokens.motion.durations_ms;
    const M = view.tokens.motion.misc;
    const drawIn = T['overlay-draw-in'];
    const recolorMs = T['recolor-min'];
    const stagger = T['overlay-stagger'];
    const maxSeq = M['overlay-max-sequenced-elements'];
    const leaderWeight = view.tokens.layout['annotation-leader-weight-px'];
    const leaderStandoff = view.tokens.layout['annotation-leader-standoff-px'];
    const spacing = view.tokens.spacing_px; // [4,8,12,16,24,32,48,64,96,128]

    const g = svg.append('g').attr('class', 's11-columns');
    // Backdrop panel (visual-story-review §5 S11: "rest band out of the
    // chart frame"). Object constancy with s10 pins this scene's resting
    // dots pixel-identical to s10's — they cannot be relocated without an
    // unannounced silent re-sort, so the field itself stays put and this
    // panel instead gives the chart its own quiet reading surface, the way
    // `bg.card-composite-cap` is already documented to do for exactly this
    // case ("hard cap on worst-case translucent composite over lit
    // particles", research/design-system.md). Drawn first (bottom of this
    // scene's stack) so every bar, axis, and label composites cleanly on
    // top of it; the population still shows through at reduced strength,
    // texture rather than figure, per the task's chart-first rule.
    const scrimLayer = g.append('g').attr('class', 's11-scrim');
    // FIX-PASS (visual-story-review §3 s11 major, "grey camouflage"): the
    // panel now reaches toward the viewport's right edge, not just the
    // plot rectangle, so the population's own right-edge bloom column
    // (visible past "5 min out" in every captured frame, easily misread as
    // a fourth data column) recedes along with the rest of the field, and
    // opacity is raised so a bar reads as figure against ground rather
    // than camouflage against it. Particles still show through as faint
    // texture -- this is a stronger recede, not a hard cut.
    const scrimRight = Math.min(view.W - spacing[1], view.region.x + view.region.w + spacing[7]);
    scrimLayer.append('rect')
      .attr('x', view.region.x - spacing[3])
      .attr('y', view.region.y - spacing[5])
      .attr('width', scrimRight - (view.region.x - spacing[3]))
      .attr('height', view.region.h + spacing[5] + spacing[6])
      .attr('rx', 4)
      .attr('fill', view.css('bg-card-composite-cap'))
      .attr('fill-opacity', 0.68)
      .attr('stroke', 'none');
    const axisLayer = g.append('g').attr('class', 's11-axes');
    const barLayer = g.append('g').attr('class', 's11-bars');
    const annoLayer = g.append('g').attr('class', 's11-anno');
    const strikeLayer = g.append('g').attr('class', 's11-strike');

    const smallN = zoneF(
      html.append('div').attr('class', 's11-small-n')
        .style('position', 'absolute')
        .style('font', '13.5px var(--font-apparatus)')
        .style('color', view.css('ink-low'))
        .style('pointer-events', 'none'),
      view,
    );
    // FIX-PASS (visual-story-review §3 s11 critical, text collision): the
    // footer slot below the x-axis has room for exactly one line -- the
    // axis title "when the price was read" -- before the viewport edge;
    // `smallN` and `matchedLeg` used to share that same cramped band and
    // overprint each other and the axis title in every captured frame.
    // Both move to the open top-left margin instead, stacked one line
    // under the y-axis title, where there is genuine clear space down to
    // the tallest bar (~130px) that nothing else on desktop competes for.
    if (!view.mobile) {
      smallN.style('top', `${view.region.y - leaderStandoff + 44}px`);
    }
    const matchedLeg = html.append('div').attr('class', 's11-matched-leg')
      .style('position', 'absolute')
      .style('left', `${view.region.x}px`)
      .style('top', `${view.region.y - leaderStandoff + 22}px`)
      .style('font', '13px var(--font-apparatus)')
      .style('color', view.css('ink-mid'))
      .style('white-space', 'nowrap')
      .style('pointer-events', 'none');
    const receipt = html.append('div').attr('class', 's11-receipt scrim-card')
      .style('position', 'absolute')
      .style('font', '13px var(--font-tape)')
      .style('color', view.css('ink-mid'))
      .style('max-width', '30ch')
      .style('text-align', 'right')
      .style('pointer-events', 'none')
      .style('display', 'none');

    const scene = data.scene || {};
    const scores = scene.scores || [];
    const byKey = new Map(scores.map((d) => [`${d.horizon}|${d.source}`, d]));
    const nLegs = scene.n_legs ?? 84;         // dossier-verified fallback:
    const effN = scene.effective_n ?? 28;     // "84 coupled legs, effective n of 28"
    const y0 = view.region.y + view.region.h;

    styleAxis(
      axisLayer.append('g')
        .attr('transform', `translate(0,${y0})`)
        .call(d3.axisBottom(scales.x).tickFormat((d) => HORIZON_LABELS[d] || d)),
      view.css('ink-mid'),
    );
    styleAxis(
      axisLayer.append('g')
        .attr('transform', `translate(${view.region.x},0)`)
        .call(d3.axisLeft(scales.y).ticks(5)),
      view.css('ink-mid'),
    );
    axisLayer.append('text')
      .attr('x', view.region.x).attr('y', view.region.y - leaderStandoff)
      .attr('fill', view.css('ink-mid'))
      .style('font', '12px var(--font-apparatus)')
      .text('error score (Brier: 0 is perfect, lower is better)');
    axisLayer.append('text')
      .attr('x', view.region.x + view.region.w / 2)
      .attr('y', y0 + spacing[4] + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', view.css('ink-mid'))
      .style('font', '12px var(--font-apparatus)')
      .text('when the price was read');

    // Solid-fill columns (visual-story-review §5 S11: "solid-fill bars" —
    // the blind audit read the old outline-only rects as "a grey outline
    // on white speckle," invisible against the resting field). A column is
    // now a filled block in its venue hue; the key still explains the
    // color, but the eye no longer has to hunt a 1.5px stroke to find it.
    //
    // FIX-PASS (visual-story-review §3 s11 critical): the T-5min pros bar
    // is not a genuine result — Pinnacle's book shuts at 90:00, so this
    // score grades a stale quote against a whistle it never saw. It gets a
    // hatch fill instead of a solid one so the mark survives on the chart
    // itself, before the reader ever reaches beat 3's prose. The hatch
    // reuses `venue-pinnacle-terminated`, the same "no longer quoting"
    // token s10.js already uses for Pinnacle's dashed requote lines, so
    // the vocabulary carries forward rather than inventing a new one.
    const ARTIFACT_HORIZON = 'T-5min';
    const ARTIFACT_SOURCE = 'pinnacle_devig';
    function isArtifact(d) {
      return d.horizon === ARTIFACT_HORIZON && d.source === ARTIFACT_SOURCE;
    }
    const hatchId = 's11-artifact-hatch';
    const hatchDefs = g.append('defs');
    const hatchPattern = hatchDefs.append('pattern')
      .attr('id', hatchId)
      .attr('width', 7).attr('height', 7)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('patternTransform', 'rotate(45)');
    hatchPattern.append('rect')
      .attr('width', 7).attr('height', 7)
      .attr('fill', view.css('bg-card-composite-cap'));
    hatchPattern.append('line')
      .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 7)
      .attr('stroke', view.css('venue-pinnacle-terminated'))
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0.95);

    function barRect(sel) {
      sel.attr('x', (d) => scales.x(d.horizon) + scales.xSub(d.source))
        .attr('width', scales.xSub.bandwidth())
        .attr('stroke', (d) => (isArtifact(d) ? view.css('venue-pinnacle-terminated') : 'none'))
        .attr('stroke-width', (d) => (isArtifact(d) ? 1.5 : 0));
    }

    // Always-on label for the artifact bar (visual-story-review §3 s11
    // critical: "no on-chart marker distinguishes artifact from result").
    // Fires the moment the T-5min group draws (beat 2), well before beat
    // 3's crossout — an images-only reader at b2 must not be able to read
    // the tall bar as an unqualified finding.
    function artifactLabel() {
      const d = byKey.get(`${ARTIFACT_HORIZON}|${ARTIFACT_SOURCE}`);
      if (!d) return;
      const cx = scales.x(ARTIFACT_HORIZON) + scales.xSub(ARTIFACT_SOURCE) + scales.xSub.bandwidth() / 2;
      const ly = scales.y(d.brier) - leaderStandoff;
      annoLayer.selectAll('text.artifact-cap, rect.artifact-cap-scrim').remove();
      const label = annoLayer.append('text').attr('class', 'artifact-cap')
        .attr('x', cx).attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('fill', view.css('ink-hi'))
        .style('font', '11.5px var(--font-apparatus)')
        .attr('opacity', view.reducedMotion ? 1 : 0)
        .text('graded after the book closed (90:00)');
      const bb = label.node().getBBox();
      const scrim = annoLayer.insert('rect', 'text.artifact-cap')
        .attr('class', 'artifact-cap-scrim')
        .attr('x', bb.x - spacing[1]).attr('y', bb.y - spacing[0])
        .attr('width', bb.width + spacing[1] * 2).attr('height', bb.height + spacing[0] * 2)
        .attr('rx', 3)
        .attr('fill', view.css('bg-card-composite-cap'))
        .attr('opacity', view.reducedMotion ? 0.85 : 0);
      if (!view.reducedMotion) {
        const onset = Math.min(HORIZONS.indexOf(ARTIFACT_HORIZON), maxSeq - 1) * stagger + drawIn;
        label.transition().delay(onset).duration(recolorMs).attr('opacity', 1);
        scrim.transition().delay(onset).duration(recolorMs).attr('opacity', 0.85);
      }
    }

    function drawGroup(horizons, animate) {
      const rows = scores.filter((d) => horizons.includes(d.horizon));
      const sel = barLayer.selectAll('rect.bar')
        .data(rows, (d) => `${d.horizon}|${d.source}`);
      const enter = sel.enter().append('rect').attr('class', 'bar')
        .call(barRect)
        .attr('fill', (d) => (isArtifact(d) ? `url(#${hatchId})` : view.css(SOURCE_TOKEN[d.source])))
        .attr('fill-opacity', (d) => (isArtifact(d) ? 1 : 0.88))
        .attr('y', y0).attr('height', 0)
        .attr('opacity', 1);
      const merged = enter.merge(sel);
      if (animate && !view.reducedMotion) {
        merged.transition()
          // Synced within a horizon group (visual-story-review §3 s11
          // major: a per-row index delay let one bar in a trio start
          // growing before its group-mates, momentarily asserting a false
          // relative ranking mid-tween — e.g. cyan reading ~7x lavender at
          // "an hour out" while both were headed to a statistical tie).
          // Delay now keys on the horizon only, so every bar in a trio
          // starts and grows together and the tie holds at every step.
          .delay((d) => Math.min(HORIZONS.indexOf(d.horizon), maxSeq - 1) * stagger)
          .duration(drawIn)
          .attr('y', (d) => scales.y(d.brier))
          .attr('height', (d) => y0 - scales.y(d.brier));
      } else {
        merged
          .attr('y', (d) => scales.y(d.brier))
          .attr('height', (d) => y0 - scales.y(d.brier));
      }
      if (horizons.includes(ARTIFACT_HORIZON)) artifactLabel();
    }

    function matchedLegAnnotation() {
      const k = byKey.get('T-24h|kalshi');
      const p = byKey.get('T-24h|pinnacle_devig');
      if (!k || !p) return;
      matchedLeg.text(`matched leg for leg: ${k.brier.toFixed(3)} vs ${p.brier.toFixed(3)}`);
    }

    function crossOutT5min() {
      const rows = scores.filter((d) => d.horizon === 'T-5min');

      // One common-fate event (design-revision-spec §2 S11 item 2): the two
      // parity groups recede to context while the T-5min columns desaturate
      // to state.dead, in the same recolor beat as the strike itself.
      // FIX-PASS (visual-story-review §3 s11 major, working-memory budget):
      // dimmed further than the original 0.7 — at b3 these two groups are
      // pure context for a payoff that lives entirely in the T-5min column
      // and the verdict annotation, so they recede to a silhouette rather
      // than staying a third bright competitor.
      barLayer.selectAll('rect.bar')
        .filter((d) => d.horizon !== 'T-5min')
        .transition().duration(recolorMs)
        .attr('opacity', 0.35);
      // Re-assert y/height (not just fill) in this same transition: a
      // reader who reaches b3 quickly can still have b2's grow-in
      // transition running on these same rects, and D3's default-named
      // `.transition()` interrupts any transition already in flight on an
      // element, regardless of which attributes it targets. Without this,
      // an interrupted grow-in freezes the T-5min bars at whatever
      // fractional height they had reached — invisible often enough to be
      // the actual cause behind "the blowout bar reads as a grey outline
      // on white speckle" once bars became solid fills and had nothing
      // left to hide a near-zero height. Re-declaring the same target
      // values here makes the fill transition also finish the grow-in if
      // it was still running, and is a no-op if it had already finished.
      barLayer.selectAll('rect.bar')
        .filter((d) => d.horizon === 'T-5min')
        .transition().duration(recolorMs)
        .attr('y', (d) => scales.y(d.brier))
        .attr('height', (d) => y0 - scales.y(d.brier))
        .attr('fill', view.css('state-dead'))
        .attr('fill-opacity', 1);

      strikeLayer.selectAll('line.strike').remove();
      const strikeSel = strikeLayer.selectAll('line.strike').data(rows, (d) => d.source);
      const enter = strikeSel.enter().append('line').attr('class', 'strike')
        .attr('x1', (d) => scales.x(d.horizon) + scales.xSub(d.source))
        .attr('x2', (d) => scales.x(d.horizon) + scales.xSub(d.source) + scales.xSub.bandwidth())
        .attr('y1', (d) => scales.y(d.brier))
        .attr('y2', y0)
        // FIX-PASS (visual-story-review §3 s11 major, salience-matches-
        // priority): was ink-hi (the piece's near-white primary-prose
        // tone) — that made the leader line brighter than the verdict
        // text it was supposed to be supporting. Demoted to ink-mid so the
        // crossout annotation below is the one thing on screen holding
        // the luminance peak. NOT ink-hero either way: design-system.md
        // §2 reserves that pure white strictly for "S17 hero numerals +
        // annotated-dot halo ring only".
        .attr('stroke', view.css('ink-mid'))
        .attr('stroke-width', leaderWeight)
        .attr('opacity', view.reducedMotion ? 1 : 0);
      if (!view.reducedMotion) {
        enter.transition().delay((d, i) => i * stagger).duration(drawIn).attr('opacity', 1);
      }

      // The verdict annotation gets its own local scrim (visual-story-
      // review §5 S11: "scrim under the verdict annotation"), the same
      // getBBox()-measured pattern s04.js uses for its headline label —
      // this is the scene's one sentence of payoff text, and it must read
      // cleanly even where the backdrop panel above is thinnest (its top
      // edge, right where this line sits).
      // FIX-PASS (visual-story-review §3 s11 critical + major): the old
      // x-anchor (`scales.x('T-5min')`, ~1130px) put this text directly
      // behind the fixed KEY panel — only "sco…" and "…t, n" survived on
      // either side of it in every b3 frame — and made it the dimmest
      // (ink-mid) thing on screen despite being the scene's one payoff
      // line. It now joins the top-left caption stack (clear of the KEY's
      // footprint) as ink-hi, the scene's single luminance peak.
      // Text-collision sweep (Gate-5 item 3 disposition 2): the top-left
      // stack's own +22px-per-line rhythm (title/matchedLeg/smallN) left
      // this line only +22px below smallN, but this line sets a larger
      // 15px bold face than the 12-13.5px lines above it -- its ascent
      // ran into smallN's descenders ("coupled", 84 legs) and the two
      // rendered as one garbled line. +78 (not +66) gives it the clearance
      // its own larger type actually needs; the annotation card still
      // lands well short of the tallest bars below it.
      annoLayer.selectAll('text.crossout-cap, rect.crossout-cap-scrim').remove();
      const crossoutText = annoLayer.append('text').attr('class', 'crossout-cap')
        .attr('x', view.region.x).attr('y', view.region.y - leaderStandoff + 78)
        .attr('fill', view.css('ink-hi'))
        .style('font', '15px var(--font-apparatus)')
        .text('scores a closed book against a live market, not a fair fight');
      const coBB = crossoutText.node().getBBox();
      annoLayer.insert('rect', 'text.crossout-cap')
        .attr('class', 'crossout-cap-scrim')
        .attr('x', coBB.x - spacing[1]).attr('y', coBB.y - spacing[0])
        .attr('width', coBB.width + spacing[1] * 2).attr('height', coBB.height + spacing[0] * 2)
        .attr('rx', 3)
        .attr('fill', view.css('bg-card-composite-cap')).attr('opacity', 0.85);

      // Mobile carries this content in the beat's own prose instead (b3's
      // closing sentence names all three traps inline), so the floating
      // panel below is a desktop-only echo, never a second copy crowding a
      // narrow screen (design-revision-spec §2 S11 item 2, mobile clause).
      // FIX-PASS (visual-story-review §3 s11 major): re-anchored from
      // vertical-center (which sat on top of the artifact label added at
      // b2) to a bottom-right anchor clear of it, and given the shared
      // `.scrim-card` treatment (added at creation) plus ink-mid instead
      // of bare ink-low directly over the particle field — it was the
      // dimmest text on screen with no ground of its own.
      if (view.mobile) {
        receipt.style('display', 'none');
      } else {
        receipt
          .style('display', null)
          .style('right', `${view.W - view.region.x - view.region.w + spacing[4]}px`)
          .style('top', `${y0 - spacing[6]}px`)
          .style('transform', 'translateY(-100%)')
          .html(
            '<div>the same mistake, three times:</div>'
            + THREE_TRAPS.map((t) => `<div>&middot; ${t}</div>`).join(''),
          );
      }
    }

    return {
      step(beatId) {
        if (beatId === 'b1') {
          smallN.text(`${nLegs} coupled legs · effective sample: ${effN} matches`);
          drawGroup(['T-24h', 'T-1h'], true);
          matchedLegAnnotation();
        } else if (beatId === 'b2') {
          drawGroup(['T-5min'], true);
        } else if (beatId === 'b3') {
          crossOutT5min();
        }
      },
      exit() {
        g.remove();
        smallN.remove();
        matchedLeg.remove();
        receipt.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>A bookmaker builds a small profit into every price it posts. Add up the odds on all three outcomes of a match and they come to a little more than one hundred percent. That extra is called the vig, the bookmaker's own fee. Strip it back out, and its price can be compared fairly with anyone else's, cent for cent, a step called devigging (bookmaker's cut removed).</p><p>Grade a price the way you would grade a weather forecast: the closer the percent was to what actually happened, the better the score, and a lower score always wins.${FN(16)} At a day out and an hour out, this exchange's crowd and the professional book, once its fee was stripped out, scored the same. Matched one ticket to one ticket, a day out, the two scores were 0.162 and 0.164. The gap is tiny. With this few matches, a gap that small cannot even be confirmed as real.</p>`,
      trigger: 'step',
      // Sync to S10's exact rest positions; duration 0 so nothing visibly
      // moves (storyboard §Units: "No population re-sort").
      state: 'rest',
      kind: 'instant',
      // Re-narrate the venue colour meaning at the mark. S11 inherits S10's
      // chip when scrolled in sequence, but a direct deep-link into s11
      // (CONTRACT §10.9 acceptance check 9) needs the legend set here too.
      // Glyph 'block' (solid), not 'box' (outline): visual-story-review §5
      // S11 moved the columns themselves to solid fills (the old outline
      // rects read as "a grey outline on white speckle"), so the key's
      // swatch must reproduce that — a swatch that still drew an empty
      // outline here would silently misdescribe the mark on screen.
      chip: [
        { token: 'venue-kalshi', glyph: 'block', label: 'cyan = Kalshi' },
        { token: 'venue-polymarket', glyph: 'block', label: 'lavender = Polymarket' },
        { token: 'venue-pinnacle', glyph: 'block', label: "grey = the pros, devigged (bookmaker's cut removed)" },
        { token: 'field-rest', glyph: 'dim', label: 'grey dots = money at rest, the whole tournament' },
      ],
      grain: {
        text: 'the dots rest · each column is an accuracy score, not money',
        variant: 'debut',
      },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>There is one real blowout on this chart, five minutes before the final whistle. But the professional book had already closed by then. Here is how both can be true: a soccer match runs past the 90-minute mark into added time. The book shuts at 90:00 by design, and the final whistle comes a few minutes later. Grading someone after they have left the room is not a fair test. About 74% of the professional book's error here comes from just five matches. Each was decided by a goal in those added minutes, after the book had shut.${FN(16)}</p>`,
      trigger: 'step',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>This piece fell into that same trap three separate times, in three different places, before its own raw trade tape corrected it.${FN(22)} The proof sits next to this chart: the sixteen "gaps" with the professionals, the goal-reaction speed ladder, and this five-minutes-left score.</p><p><strong>Skill unlocked:</strong> take the number at face value once its fee is stripped out. No one sharper is hiding behind it. A sudden gap between two markets just means one of them stopped quoting.</p><p><strong>The receipt:</strong> all sixteen "wins over the professionals" started the moment the professionals stopped posting prices. This piece fell for it three times too, and its own trade tape caught the mistake.</p>`,
      trigger: 'step',
      overlayStep: 'b3',
    },
  ],

  // No reducedMotion.states override: the single 'rest' state never tweens
  // here even in full motion (kind: 'instant'), and every custom column /
  // strike / caption animation above already branches on view.reducedMotion
  // to render its static end state directly.
};
