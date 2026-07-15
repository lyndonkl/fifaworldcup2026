/* docs/js/scenes/s05.js — "Where the dollars sat"
 * Storyboard: research/storyboard.md ACT I, S5 (R15 + R14)
 * Contract: docs/CONTRACT.md §4.2 (registry row s05, layoutName
 * `lorenz-sweep`, 3 steps, no zoom).
 *
 * Layout grammar — a dot-built Lorenz curve, not a bar chart standing
 * next to one: markets are sorted ascending by their own dot count
 * (= their own lifetime dollars, since every dot is a fixed $75k grain);
 * given that order, market k's dots are stacked to occupy exactly the
 * vertical span [cumulative dots before k, cumulative dots through k]
 * of the full population, at a horizontal column reserved for market k.
 * The upper envelope of that assembly, by construction, traces
 * (cumulative fraction of markets) vs (cumulative fraction of dollars)
 * — the Lorenz curve — using nothing but real per-dot positions. Markets
 * below one dot's worth of lifetime volume own zero dots (per the
 * population tile's own construction, CONTRACT §5.2) and are represented
 * only by the flat below-threshold band reserved at the left of the
 * x-axis, never invented as phantom dots.
 *
 * Identity note: a market's dots keep this arrangement's implied order
 * (ascending by market size) as their *identity*, not as a transient
 * sort key — the LORENZ_TAIL flag baked into the population tile
 * (CONTRACT §5.3, bit 0) marks the same dots that sag back into view in
 * S14; this scene does not compute that flag, only renders the sweep it
 * was drawn from.
 *
 * DATA CONTRACT ASSUMPTION (flagged in data_requests): this scene reads
 * `data/scenes/s05.json`:
 *   {
 *     "_provenance": { "sources": [...], "generated": "<iso>" },
 *     "total_markets": 30133,
 *     "core_series": { "legs": 414, "share_pct": 63.5 },
 *     "tail": { "markets": 19640, "share_pct": 0.36 },
 *     "gini_pooled": 0.930, "gini_within_family": 0.44,
 *     "lorenz_curve": [ { "market_frac": 0, "value_frac": 0 }, ... ],  // optional
 *     "trump_market": {
 *       "market_index": <u16, matches pop.market>, "ticker": "…",
 *       "rank": 1083, "contracts": 1400000,
 *       "family_size": 3005, "expected_rank_at_base_rate": 10
 *     }
 *   }
 * `manifest.census.below_grain.{markets,usd}` (already part of the
 * manifest contract, §5.1) supplies the below-threshold band's count and
 * combined dollars — not duplicated in s05.json.
 */

import { registry, colorOf, particleState, makeState, fmt } from '../shared.js';

function hash01(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = (x * 2246822519) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const SWEEP_COLOR = 'neutral-data';

/* Shared market-ranking geometry, computed once from the loaded
 * population tile and stashed in the scale registry so scales() and
 * layout() (which the contract calls separately, §4) agree exactly. */
function computeMarketLayout(data, view) {
  const { pop, manifest, scene } = data;
  const sj = scene || {};
  const N = pop.count;
  const counts = new Map();
  for (let i = 0; i < N; i++) {
    const m = pop.market[i];
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  const entries = [...counts.entries()].map(([marketIdx, count]) => ({ marketIdx, count }));
  entries.sort((a, b) => a.count - b.count || a.marketIdx - b.marketIdx);
  const M = entries.length;

  const totalMarkets = sj.total_markets || 0;
  const belowGrain = (manifest.census && manifest.census.below_grain) || { markets: 0, usd: 0 };
  const tailFrac = totalMarkets > 0 ? Math.min(0.9, belowGrain.markets / totalMarkets) : 0;
  if (!totalMarkets) {
    // eslint-disable-next-line no-console
    console.warn('[rt/s05] data/scenes/s05.json missing `total_markets`; '
      + 'below-threshold band collapses to zero x-width.');
  }

  const region = view.region;
  const usableW = region.w * (1 - tailFrac);
  const colW = M > 0 ? usableW / M : 0;
  const rectByMarket = new Map();
  let cum = 0;
  entries.forEach((e, k) => {
    const x0 = region.x + region.w * tailFrac + k * colW;
    const yBotFrac = cum / N;
    cum += e.count;
    const yTopFrac = cum / N;
    rectByMarket.set(e.marketIdx, {
      x0, x1: x0 + colW, yBotFrac, yTopFrac, rankFromTop: M - k,
    });
  });

  return { entries, rectByMarket, tailFrac, totalMarkets, belowGrain, N, colW, M };
}

export default {
  id: 's05',
  act: 1,
  title: 'Where the dollars sat',
  layoutName: 'lorenz-sweep',

  needs: { scene: true, series: [], zoom: null },

  scales(data, view) {
    const ml = computeMarketLayout(data, view);
    registry.register('s05.marketLayout', ml);
    const region = view.region;
    const x = registry.register('s05.x', d3.scaleLinear().domain([0, 1]).range([region.x, region.x + region.w]));
    const y = registry.register('s05.y', d3.scaleLinear().domain([0, 1]).range([region.y + region.h, region.y]));
    return { x, y, marketLayout: ml };
  },

  layout(data, view) {
    const { pop } = data;
    const ml = registry.get('s05.marketLayout');
    const N = pop.count;
    const region = view.region;

    const sweepColor = colorOf(view.tokens, SWEEP_COLOR, view.tokens.dot['opacity-alive']);
    const baseSize = view.tokens.dot['radius-base-px'] * 2;
    const haloSize = view.tokens.dot['radius-annotated-core-px'] * 2;
    const amber = colorOf(view.tokens, 'accent-annotation', 1.0);

    const sweep = makeState(N);
    const localRank = new Map(); // marketIdx -> running counter

    const trumpIdx = data.scene && data.scene.trump_market
      ? data.scene.trump_market.market_index : null;

    for (let i = 0; i < N; i++) {
      const m = pop.market[i];
      const rect = ml.rectByMarket.get(m);
      const o = i * 4;
      if (!rect) {
        // Defensive: should not happen (every dot's market owns >=1 dot
        // by tile construction), but never leave a dot unpositioned.
        sweep.x[i] = region.x; sweep.y[i] = region.y + region.h;
        sweep.color.set(sweepColor, o); sweep.size[i] = baseSize;
        continue;
      }
      const r = localRank.get(m) || 0;
      localRank.set(m, r + 1);
      const count = Math.max(1, Math.round((rect.yTopFrac - rect.yBotFrac) * N));
      const yFrac = rect.yBotFrac + ((r + 0.5) / count) * (rect.yTopFrac - rect.yBotFrac);
      const yScaleRange = [region.y + region.h, region.y];
      sweep.y[i] = yScaleRange[0] + yFrac * (yScaleRange[1] - yScaleRange[0]);
      sweep.x[i] = rect.x0 + hash01(i) * Math.max(1, rect.x1 - rect.x0);
      sweep.color.set(sweepColor, o);
      sweep.size[i] = baseSize;
    }

    const sweepHighlighted = makeState(N);
    sweepHighlighted.x.set(sweep.x);
    sweepHighlighted.y.set(sweep.y);
    sweepHighlighted.color.set(sweep.color);
    sweepHighlighted.size.set(sweep.size);
    if (trumpIdx != null) {
      for (let i = 0; i < N; i++) {
        if (pop.market[i] === trumpIdx) {
          const o = i * 4;
          sweepHighlighted.color.set(amber, o);
          sweepHighlighted.size[i] = haloSize;
        }
      }
    }

    return { states: { sweep, sweepHighlighted } };
  },

  overlay(container, data, view, scales) {
    const { svg } = container;
    const sj = data.scene || {};
    const ml = scales.marketLayout;
    const { x, y } = scales;
    const region = view.region;
    const g = svg.append('g').attr('class', 's05-overlay');

    // Below-threshold hatched band (D3 mark, never dots — CONTRACT §1.3).
    const bandW = region.w * ml.tailFrac;
    const patternId = 's05-hatch';
    const defs = g.append('defs');
    defs.append('pattern').attr('id', patternId)
      .attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)')
      .attr('patternUnits', 'userSpaceOnUse')
      .append('rect').attr('width', 2).attr('height', 6).attr('fill', view.css('ink-low')).attr('opacity', 0.25);
    const bandH = region.h * 0.03;
    g.append('rect').attr('class', 's05-below-band')
      .attr('x', region.x).attr('y', region.y + region.h - bandH)
      .attr('width', bandW).attr('height', bandH)
      .attr('fill', view.css('bg-card')).style('fill', `url(#${patternId})`)
      .attr('stroke', view.css('ink-low')).attr('stroke-width', 0.5);

    const belowGrain = (data.manifest.census && data.manifest.census.below_grain) || { markets: 0, usd: 0 };
    const bandLabel = g.append('text')
      .attr('x', region.x + 4).attr('y', region.y + region.h - bandH - 6)
      .attr('fill', view.css('ink-mid'))
      .style('font', `var(--type-tape-size) var(--font-tape)`)
      .text(`${fmt.count(belowGrain.markets)} markets traded less than one dot's worth ($75,000) over their whole lives, ${fmt.usd(belowGrain.usd)} combined`);

    // Equality diagonal + real Lorenz reference line (optional).
    g.append('line').attr('class', 's05-diagonal')
      .attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(1)).attr('y2', y(1))
      .attr('stroke', view.css('ink-low')).attr('stroke-width', 1).attr('stroke-dasharray', '2,3')
      .style('display', 'none');
    let lorenzPath = null;
    if (sj.lorenz_curve && sj.lorenz_curve.length) {
      const line = d3.line().x((d) => x(d.market_frac)).y((d) => y(d.value_frac));
      lorenzPath = g.append('path').datum(sj.lorenz_curve)
        .attr('fill', 'none').attr('stroke', view.css('ink-mid')).attr('stroke-width', 1.5)
        .attr('d', line).style('display', 'none');
    }

    // Tail bracket: "19,640 markets, 0.36% of the money."
    const tail = sj.tail || { markets: belowGrain.markets, share_pct: null };
    const tailBracket = g.append('g').attr('class', 's05-tail-bracket').style('display', 'none');
    tailBracket.append('path')
      .attr('d', `M${region.x},${region.y + region.h - bandH - 14} L${region.x},${region.y + region.h - bandH - 20} L${region.x + bandW},${region.y + region.h - bandH - 20} L${region.x + bandW},${region.y + region.h - bandH - 14}`)
      .attr('fill', 'none').attr('stroke', view.css('ink-mid')).attr('stroke-width', 1);
    tailBracket.append('text')
      .attr('x', region.x + bandW / 2).attr('y', region.y + region.h - bandH - 26)
      .attr('text-anchor', 'middle').attr('fill', view.css('ink-mid'))
      .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
      .text(`${fmt.count(tail.markets)} markets, ${tail.share_pct != null ? tail.share_pct : '—'}% of the money`);

    // Core-series concentration callout (co-located with the tail bracket step).
    const core = sj.core_series;
    let coreLabel = null;
    if (core) {
      coreLabel = g.append('text').attr('class', 's05-core-label')
        .attr('x', region.x + region.w * (1 - (ml.tailFrac ? (1 - ml.tailFrac) * 0.06 : 0.06)))
        .attr('y', region.y + 16).attr('text-anchor', 'end')
        .attr('fill', view.css('ink-mid'))
        .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
        .text(`${core.legs} legs across 3 core series absorb ${core.share_pct}% of all dollars`)
        .style('display', 'none');
    }

    // Trump-market singleton: amber core, deflating co-located copy
    // (design-system.md §8 FIX #6 — verbatim), constancy note verbatim
    // from the storyboard's Units section.
    const trump = sj.trump_market;
    let trumpG = null;
    if (trump) {
      const rect = ml.rectByMarket.get(trump.market_index);
      trumpG = g.append('g').attr('class', 's05-trump').style('display', 'none');
      if (rect) {
        const cx = (rect.x0 + rect.x1) / 2;
        const cy = y((rect.yBotFrac + rect.yTopFrac) / 2);
        trumpG.append('line')
          .attr('x1', cx).attr('y1', cy)
          .attr('x2', cx + 90).attr('y2', cy - 60)
          .attr('stroke', view.css('accent-annotation')).attr('stroke-width', 1.5);
        trumpG.append('text')
          .attr('x', cx + 94).attr('y', cy - 64)
          .attr('fill', view.css('accent-annotation'))
          .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
          .text(`rank ~${fmt.count(trump.rank)} of ${fmt.count(sj.total_markets || 0)}`);
        trumpG.append('text')
          .attr('x', cx + 94).attr('y', cy - 46)
          .attr('fill', view.css('ink-mid'))
          .style('font', `var(--type-caption-size) var(--font-apparatus)`)
          .text("small — lit up because it's surprising, not because it's big.");
        trumpG.append('text')
          .attr('x', region.x + bandW + 8).attr('y', region.y + region.h - bandH - 40)
          .attr('fill', view.css('ink-low'))
          .style('font', `var(--type-caption-size) var(--font-apparatus)`)
          .text('these tail dots carry a persistent tag; they return, unmoved in identity, as the sagging dots of S14.');
      }
    }

    return {
      step(beatId) {
        if (beatId === 'b1') {
          tailBracket.style('display', 'none');
          coreLabel && coreLabel.style('display', 'none');
          trumpG && trumpG.style('display', 'none');
          lorenzPath && lorenzPath.style('display', 'none');
        } else if (beatId === 'b2') {
          tailBracket.style('display', null);
          coreLabel && coreLabel.style('display', null);
          lorenzPath && lorenzPath.style('display', null);
        } else if (beatId === 'b3') {
          trumpG && trumpG.style('display', null);
        }
      },
      exit() { g.remove(); },
    };
  },

  beats: [
    {
      id: 'b1',
      html: '<p>Kalshi lists the outcome space; dollars find the plausible outcomes.</p>',
      trigger: 'step',
      state: 'sweep',
      kind: 'resort',
      chip: 'color: neutral — position is market size',
    },
    {
      id: 'b2',
      html: '<p>Three core series, 414 contract legs, absorb 63.5% of all dollars, while 19,640 markets, more than half the catalog, carry 0.36% of volume; the pooled concentration reads as extreme, a Gini of 0.930, and the within-family reality is ordinary, 0.44.<sup><a href="#fn-7">7</a></sup></p>',
      trigger: 'step',
    },
    {
      id: 'b3',
      html: "<p>The catalog's most famous novelty, the biggest Trump-mention market, drew a real 1.40 million contracts and still could not crack the top 1,000; the honest punchline runs the other way, since the maximum of a 3,005-market family trading at catalog base rate should land near rank ten.<sup><a href=\"#fn-8\">8</a></sup> America's biggest off-pitch market was roughly sixty times smaller than the moneyline on its own broadcast.<sup><a href=\"#fn-8\">8</a></sup></p>",
      trigger: 'step',
      state: 'sweepHighlighted',
      kind: 'recolor',
    },
  ],

  // Reduced motion: defaults suffice — the sweep assembles once (b1) and
  // the only later positional state, sweepHighlighted, shares identical
  // x/y with sweep (kind: 'recolor'), so reduced motion's instant-state
  // + crossfade rule already yields the correct still frames.
};
