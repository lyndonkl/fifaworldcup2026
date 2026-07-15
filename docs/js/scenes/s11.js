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
 * UNIT DISCIPLINE (storyboard §0 + CONTRACT §1.3): a Brier contribution is
 * a score, not money. §0: "No population re-sort: the dots stay at rest
 * (... the rest was narrated at S10)." This scene therefore reconstructs
 * S10's exact rest-field formula (see below) and syncs to it with a
 * zero-duration ('instant') tween on entry rather than an animated resort
 * — pixel-identical positions mean nothing visibly moves, while a direct
 * deep-link into s11 (CONTRACT §10.9 acceptance check 9) still renders
 * correctly instead of showing whatever a prior, unrelated scene left
 * behind.
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

const HORIZONS = ['T-24h', 'T-1h', 'T-5min'];
const SOURCES = ['kalshi', 'polymarket', 'pinnacle_devig'];
const SOURCE_TOKEN = {
  kalshi: 'venue-kalshi',
  polymarket: 'venue-polymarket',
  pinnacle_devig: 'venue-pinnacle',
};

const THREE_TRAPS = [
  'the 16 "divergence episodes" (S10)',
  'the 29s / 60s / 119s reaction ladder (S7)',
  'this T-5min Brier "blowout"',
];

export default {
  id: 's11',
  act: 3,
  title: 'The verdict, and the trap',
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
    const stagger = T['overlay-stagger'];
    const maxSeq = M['overlay-max-sequenced-elements'];
    const leaderWeight = view.tokens.layout['annotation-leader-weight-px'];
    const leaderStandoff = view.tokens.layout['annotation-leader-standoff-px'];

    const g = svg.append('g').attr('class', 's11-columns');
    const axisLayer = g.append('g').attr('class', 's11-axes');
    const barLayer = g.append('g').attr('class', 's11-bars');
    const annoLayer = g.append('g').attr('class', 's11-anno');
    const strikeLayer = g.append('g').attr('class', 's11-strike');

    const smallN = html.append('div').attr('class', 's11-small-n')
      .style('font', '13.5px var(--font-apparatus)').style('color', view.css('ink-low'));
    const matchedLeg = html.append('div').attr('class', 's11-matched-leg')
      .style('font', '13px var(--font-apparatus)').style('color', view.css('accent-annotation'));
    const receipt = html.append('div').attr('class', 's11-receipt')
      .style('font', '13px var(--font-tape)').style('color', view.css('ink-low'));

    const scene = data.scene || {};
    const scores = scene.scores || [];
    const byKey = new Map(scores.map((d) => [`${d.horizon}|${d.source}`, d]));
    const nLegs = scene.n_legs ?? 84;         // dossier-verified fallback:
    const effN = scene.effective_n ?? 28;     // "84 coupled legs, effective n of 28"
    const y0 = view.region.y + view.region.h;

    styleAxis(
      axisLayer.append('g')
        .attr('transform', `translate(0,${y0})`)
        .call(d3.axisBottom(scales.x)),
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
      .text('Brier score (lower is better)');

    function barRect(sel) {
      sel.attr('x', (d) => scales.x(d.horizon) + scales.xSub(d.source))
        .attr('width', scales.xSub.bandwidth())
        .attr('fill', 'none')
        .attr('stroke-width', leaderWeight);
    }

    function drawGroup(horizons, animate) {
      const rows = scores.filter((d) => horizons.includes(d.horizon));
      const sel = barLayer.selectAll('rect.bar')
        .data(rows, (d) => `${d.horizon}|${d.source}`);
      const enter = sel.enter().append('rect').attr('class', 'bar')
        .call(barRect)
        .attr('stroke', (d) => view.css(SOURCE_TOKEN[d.source]))
        .attr('y', y0).attr('height', 0);
      const merged = enter.merge(sel);
      if (animate && !view.reducedMotion) {
        merged.transition()
          .delay((d, i) => Math.min(i, maxSeq - 1) * stagger)
          .duration(drawIn)
          .attr('y', (d) => scales.y(d.brier))
          .attr('height', (d) => y0 - scales.y(d.brier));
      } else {
        merged
          .attr('y', (d) => scales.y(d.brier))
          .attr('height', (d) => y0 - scales.y(d.brier));
      }
    }

    function matchedLegAnnotation() {
      const k = byKey.get('T-24h|kalshi');
      const p = byKey.get('T-24h|pinnacle_devig');
      if (!k || !p) return;
      matchedLeg.text(`matched leg-for-leg at T-24h: ${k.brier.toFixed(3)} (Kalshi) vs ${p.brier.toFixed(3)} (de-vigged Pinnacle)`);
    }

    function crossOutT5min() {
      const rows = scores.filter((d) => d.horizon === 'T-5min');
      barLayer.selectAll('rect.bar')
        .filter((d) => d.horizon === 'T-5min')
        .transition().duration(drawIn)
        .attr('stroke', view.css('state-dead'));

      strikeLayer.selectAll('line.strike').remove();
      const strikeSel = strikeLayer.selectAll('line.strike').data(rows, (d) => d.source);
      const enter = strikeSel.enter().append('line').attr('class', 'strike')
        .attr('x1', (d) => scales.x(d.horizon) + scales.xSub(d.source))
        .attr('x2', (d) => scales.x(d.horizon) + scales.xSub(d.source) + scales.xSub.bandwidth())
        .attr('y1', (d) => scales.y(d.brier))
        .attr('y2', y0)
        // NOT ink-hero: design-system.md §2 reserves that pure white
        // strictly for "S17 hero numerals + annotated-dot halo ring
        // only". The "white strike" the design note describes uses
        // ink-hi, the piece's near-white primary-prose tone, instead.
        .attr('stroke', view.css('ink-hi'))
        .attr('stroke-width', leaderWeight)
        .attr('opacity', view.reducedMotion ? 1 : 0);
      if (!view.reducedMotion) {
        enter.transition().delay((d, i) => i * stagger).duration(drawIn).attr('opacity', 1);
      }

      annoLayer.selectAll('text.crossout-cap').remove();
      annoLayer.append('text').attr('class', 'crossout-cap')
        .attr('x', scales.x('T-5min')).attr('y', view.region.y - leaderStandoff)
        .attr('fill', view.css('accent-annotation'))
        .style('font', '15px var(--font-apparatus)')
        .text('scores a closed book against a live market, not a fair fight');

      receipt.html(
        `<div>three arms, one artifact:</div>`
        + THREE_TRAPS.map((t) => `<div>&middot; ${t}</div>`).join(''),
      );
    }

    return {
      step(beatId) {
        if (beatId === 'b1') {
          smallN.text(`${nLegs} coupled legs, effective n of ${effN}`);
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
      html: `<p>At every horizon where both were alive, the amateurs and the professionals scored the same. At a day out and an hour out, Kalshi, Polymarket, and the de-vigged professional book post near-identical Brier scores, 0.158 to 0.169, on the same 84 legs; matched leg for leg at T-24h the gap is 0.162 versus 0.164, a sample that can rule out a large skill gap and establish nothing stronger.${FN(16)}</p>`,
      trigger: 'step',
      // Sync to S10's exact rest positions; duration 0 so nothing visibly
      // moves (storyboard §Units: "No population re-sort").
      state: 'rest',
      kind: 'instant',
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>The lone blowout, at five minutes to settlement, scores live repricing against a product that had ceased to exist, since in-play books close at the whistle by design; roughly 74% of the professional book's error comes from five matches with stoppage-time goals landing after its book closed.${FN(16)}</p>`,
      trigger: 'step',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>This analysis walked into that trap three separate times, in three separate arms, before the tape corrected it.${FN(22)} The receipt stays on screen, small.</p>`,
      trigger: 'step',
      overlayStep: 'b3',
    },
  ],

  // No reducedMotion.states override: the single 'rest' state never tweens
  // here even in full motion (kind: 'instant'), and every custom column /
  // strike / caption animation above already branches on view.reducedMotion
  // to render its static end state directly.
};
