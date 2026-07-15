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
 *     "novelty_market": {               // the loudest OFF-PITCH novelty of the
 *       "series_ticker": "KXWCADS",     //   tournament (the ad family). It is
 *       "label": "…",                   //   sub-grain: 35 markets, none large
 *       "rank": 10500,                  //   enough to earn a single $75k dot, so
 *       "contracts": 594454,            //   it owns NO dot in this population and
 *       "n_markets": 35,                //   lives entirely in the below-threshold
 *       "in_below_grain": true          //   band, never as a lit singleton dot.
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
    const restRgba = particleState(view.tokens, 'rest');

    const sweep = makeState(N);
    const localRank = new Map(); // marketIdx -> running counter

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

    // b3 punchline state. The loudest off-pitch novelty (the KXWCADS ad
    // family) is sub-grain: it owns no dot in this population, so there is
    // nothing in the sweep to light as a singleton. Instead the whole
    // field recedes to the resting money tint (opacity-rest 0.35 <= the
    // 0.42 rest-tier threshold -> engine rest-tier dim, perception-brief
    // §4/§9b) so the amber below-band annotation drawn in overlay() reads
    // as figure against a dimmed ground. Positions/sizes are identical to
    // `sweep`, so this stays a pure recolor (kind: 'recolor').
    const sweepDimmed = makeState(N);
    sweepDimmed.x.set(sweep.x);
    sweepDimmed.y.set(sweep.y);
    sweepDimmed.size.set(sweep.size);
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      sweepDimmed.color[o] = restRgba[0];
      sweepDimmed.color[o + 1] = restRgba[1];
      sweepDimmed.color[o + 2] = restRgba[2];
      sweepDimmed.color[o + 3] = restRgba[3];
    }

    return { states: { sweep, sweepDimmed } };
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

    // Novelty-market callout (de-politicize swap; see prose-plan Part 3).
    // The loudest off-pitch novelty of the tournament is the KXWCADS ad
    // family ("which brands advertise around the final"). It is sub-grain:
    // 35 markets, none large enough to earn a single $75k dot, so it owns
    // NO dot in this population and lives entirely in the below-threshold
    // band drawn above. The callout is therefore an amber ANNOTATION
    // (design-system §6: amber is annotation, never a data encoding)
    // pointing at that band, not a lit singleton. The former single-dot
    // Trump highlight is removed with the swap; FIX #6's "lit up because
    // surprising" caption and the S14-constancy tag both presupposed an
    // in-population dot the ad family does not have.
    const novelty = sj.novelty_market;
    let noveltyG = null;
    if (novelty) {
      noveltyG = g.append('g').attr('class', 's05-novelty').style('display', 'none');
      // The band spans most of the stage width, so anchor the callout to
      // its right end and let the text run LEFT across the dimmed tail
      // (clamped inside the region), never off the right edge. A short
      // vertical leader drops from the callout down to the band.
      const anchorX = Math.min(region.x + bandW, region.x + region.w - 8);
      const bandTopY = region.y + region.h - bandH;
      const labelY = region.y + region.h - bandH - 58;
      noveltyG.append('line')
        .attr('x1', anchorX - 4).attr('y1', bandTopY)
        .attr('x2', anchorX - 4).attr('y2', labelY + 6)
        .attr('stroke', view.css('accent-annotation')).attr('stroke-width', 1.5);
      noveltyG.append('text')
        .attr('x', anchorX).attr('y', labelY).attr('text-anchor', 'end')
        .attr('fill', view.css('accent-annotation'))
        .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
        .text(`the loudest off-pitch novelty: ${fmt.count(novelty.n_markets || 0)} ad markets`);
      noveltyG.append('text')
        .attr('x', anchorX).attr('y', labelY + 18).attr('text-anchor', 'end')
        .attr('fill', view.css('ink-mid'))
        .style('font', `var(--type-caption-size) var(--font-apparatus)`)
        .text(`~${fmt.count(novelty.contracts || 0)} contracts, too small to earn a single $75k dot`);
    }

    return {
      step(beatId) {
        if (beatId === 'b1') {
          tailBracket.style('display', 'none');
          coreLabel && coreLabel.style('display', 'none');
          noveltyG && noveltyG.style('display', 'none');
          lorenzPath && lorenzPath.style('display', 'none');
        } else if (beatId === 'b2') {
          tailBracket.style('display', null);
          coreLabel && coreLabel.style('display', null);
          lorenzPath && lorenzPath.style('display', null);
        } else if (beatId === 'b3') {
          noveltyG && noveltyG.style('display', null);
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
      chip: 'color: neutral; position is market size',
    },
    {
      id: 'b2',
      html: '<p>A series is Kalshi&rsquo;s name for a family of related markets, such as every three-way in the tournament. A leg is one outcome-contract inside a market: the France-wins bet is one leg of the winner market, and a single match splits into three legs, home win, draw, away win. Three core series, 414 of those legs, absorb 63.5% of all dollars, while 19,640 markets, more than half the catalog, carry 0.36% of volume; on the Gini scale, where zero is an equal share for every market and one is a single market holding all of it, the pooled concentration reads as extreme at 0.930, and the within-family reality is ordinary at 0.44.<sup><a href="#fn-7">7</a></sup></p>',
      trigger: 'step',
    },
    {
      id: 'b3',
      html: '<p>The loudest market that had nothing to do with football was a bet on advertising: which brands would run a spot around the final. Every one of those 35 ad markets put together drew about 594,000 contracts, five thousandths of one percent of the tape, and the most-traded of them, whether Pepsi would advertise, could not crack the top ten thousand markets.<sup><a href="#fn-8">8</a></sup> The whole family was more than two hundred times smaller than a single knockout-night match market.<sup><a href="#fn-8">8</a></sup> Loud in imagination, faint in money.</p>',
      trigger: 'step',
      state: 'sweepDimmed',
      kind: 'recolor',
      chip: 'field at rest; amber marks the ad family',
    },
  ],

  // Reduced motion: defaults suffice. The sweep assembles once (b1); the
  // only later state, sweepDimmed, shares identical x/y and size with
  // sweep (kind: 'recolor', an alpha-only change to the resting tint), so
  // reduced motion's instant-state + crossfade rule already yields the
  // correct still frames.
};
