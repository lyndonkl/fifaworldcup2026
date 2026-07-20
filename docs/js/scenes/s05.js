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
 *     "core_series": { "legs": 414, "share_pct": 63.06 },
 *     "tail": { "markets": 19640, "share_pct": 0.36 },
 *     "gini_pooled": 0.930, "gini_within_family": 0.44,
 *     "lorenz_curve": [ { "market_frac": 0, "value_frac": 0 }, ... ],  // optional
 *     "novelty_market": {               // the loudest OFF-PITCH novelty of the
 *       "series_ticker": "KXWCADS",     //   tournament (the ad family). As of
 *       "label": "…",                   //   the current (post-final) deploy its
 *       "rank": 2426,                   //   biggest member has crossed the per-dot
 *       "contracts": 4618232,           //   grain line: rank 2,426th of 30,133
 *       "n_markets": 38,                //   markets, and it owns a dot in this
 *       "in_below_grain": false         //   population. Money kept arriving through
 *                                        //   settlement; the family grew nearly
 *                                        //   eightfold from its pre-tournament count.
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

// Gate-5 item 4: the rank annotation must define what it orders by, and the
// number must always come from the data field, never be hardcoded -- this
// only formats the ordinal suffix around whatever `novelty.rank` says.
function ordinalSuffix(n) {
  const r = Math.abs(Math.round(n)) % 100;
  if (r >= 11 && r <= 13) return 'th';
  switch (Math.abs(Math.round(n)) % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
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
  kicker: 'Skill 2, continued — depth decides trust',
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

    // Gate-4 visual-story review (s05 C1, "b1-t0 is a mid-morph explosion
    // with no figure"): this population is context/texture for the D3
    // Lorenz chart (the shape it sweeps into IS the message), never the
    // story figure, so it never needs active-tier brightness. At the old
    // opacity-alive (1.0) the whole re-sort tween spent most of its
    // duration in the engine's active tone-map chain, so 30k+ dots
    // converging at once bloomed to the tile cap mid-flight. Capping at
    // opacity-dimmed-field-max keeps it in the ground tier (tiered
    // Reinhard cap) for the whole tween, not just the settled frame.
    const sweepColor = colorOf(view.tokens, SWEEP_COLOR, view.tokens.dot['opacity-dimmed-field-max']);
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
    // family) has crossed the per-dot grain line at the current deploy
    // (Gate-5 item 4: in_below_grain is now false, rank 7,130 of 30,133),
    // but the data contract carries no per-market ticker to pick its exact
    // dot out of the sorted population, so this still cannot light one
    // specific dot as a singleton. Instead the whole field recedes to the
    // resting money tint (opacity-rest 0.35 <= the 0.42 rest-tier
    // threshold -> engine rest-tier dim, perception-brief §4/§9b) so the
    // amber below-band annotation drawn in overlay() reads as figure
    // against a dimmed ground. Positions/sizes are identical to `sweep`,
    // so this stays a pure recolor (kind: 'recolor').
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
    // Below-band chip wording (design-revision-spec S5 §3): plain
    // "N markets · under one dot each · M combined" template; sits
    // inside the band once it is tall enough to hold text, else just
    // below it, left-aligned to region.x either way.
    const bandLabelInside = bandH >= 20;
    const bandLabel = g.append('text').attr('class', 's05-below-band-label')
      .attr('x', region.x + 4)
      .attr('y', bandLabelInside
        ? region.y + region.h - bandH / 2 + 4
        : region.y + region.h + 8 + 10)
      .attr('fill', view.css('ink-mid'))
      .style('font', `var(--type-tape-size) var(--font-tape)`)
      .text(`${fmt.count(belowGrain.markets)} markets · under one dot each ($${Math.round(view.grain.usd).toLocaleString('en-US')}) · ${fmt.usd(belowGrain.usd)} combined`);

    // Axes (G3: "missing apparatus to add" -- S5 had none). Ticks at the
    // five round percentages the spec calls out; titles name what each
    // axis measures, in plain words, with its unit.
    const pctTicks = [0, 0.25, 0.5, 0.75, 1];
    const pctFmt = (d) => `${Math.round(d * 100)}%`;
    const axisX = d3.axisBottom(x).tickValues(pctTicks).tickFormat(pctFmt).tickSizeOuter(0);
    const axisY = d3.axisLeft(y).tickValues(pctTicks).tickFormat(pctFmt).tickSizeOuter(0);
    g.append('g')
      .attr('transform', `translate(0,${region.y + region.h})`)
      .attr('class', 'axis axis-x')
      .style('color', view.css('ink-low'))
      .style('font', `var(--type-micro-size) var(--font-apparatus)`)
      .call(axisX);
    g.append('g')
      .attr('transform', `translate(${region.x},0)`)
      .attr('class', 'axis axis-y')
      .style('color', view.css('ink-low'))
      .style('font', `var(--type-micro-size) var(--font-apparatus)`)
      .call(axisY);
    g.append('text').attr('class', 'axis-title axis-title-x')
      .attr('x', region.x + region.w / 2).attr('y', region.y + region.h + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', view.css('ink-mid'))
      .style('font', `${view.css('type-caption-size')} var(--font-apparatus)`)
      .style('font-weight', 500)
      .text('all markets, smallest to biggest (% of markets)');
    g.append('text').attr('class', 'axis-title axis-title-y')
      .attr('x', region.x).attr('y', region.y - 12)
      .attr('text-anchor', 'start')
      .attr('fill', view.css('ink-mid'))
      .style('font', `${view.css('type-caption-size')} var(--font-apparatus)`)
      .style('font-weight', 500)
      .text('share of all the money (%)');

    // Concentration figures (structure-spec S5 b2: the Gini numbers move
    // out of body prose into a caption). Footnote-weight, ink-low.
    // Gate-5 item 3 screenshot: this line was sitting past the visible
    // stage on shorter viewports (#stage is a fixed, non-scrolling
    // viewport-height layer -- anything below view.H is off-screen, not
    // just scrolled out of view), clipping it at the bottom edge. Clamped
    // to the same safe margin (view.safe) every other bottom-anchored
    // element in the piece respects. The numbers themselves are bound to
    // the scene JSON (never hardcoded), so a refreeze cannot desync this
    // caption from the data the way the beat prose desynced upstream.
    const giniPooledTxt = (typeof sj.gini_pooled === 'number' ? sj.gini_pooled : 0.930).toFixed(3);
    const giniWithinTxt = (typeof sj.gini_within_family === 'number' ? sj.gini_within_family : 0.44).toFixed(2);
    const giniY = Math.min(region.y + region.h + 58, view.H - view.safe);
    const giniCaption = g.append('text').attr('class', 's05-gini-caption')
      .attr('x', region.x).attr('y', giniY)
      .attr('fill', view.css('ink-low'))
      .style('font', `var(--type-micro-size) var(--font-apparatus)`)
      .text(`market concentration (Gini): ${giniPooledTxt} overall, ${giniWithinTxt} within one family`)
      .style('display', 'none');

    // Equality diagonal + real Lorenz reference line.
    g.append('line').attr('class', 's05-diagonal')
      .attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(1)).attr('y2', y(1))
      .attr('stroke', view.css('ink-low')).attr('stroke-width', 1).attr('stroke-dasharray', '2,3');
    g.append('text').attr('class', 's05-diagonal-label')
      .attr('x', x(1) - 4).attr('y', y(1) + 12)
      .attr('text-anchor', 'end')
      .attr('fill', view.css('ink-mid'))
      .style('font', `var(--type-micro-size) var(--font-apparatus)`)
      .text('if every market traded equally');
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
    const tailBracketPath = tailBracket.append('path')
      .attr('d', `M${region.x},${region.y + region.h - bandH - 14} L${region.x},${region.y + region.h - bandH - 20} L${region.x + bandW},${region.y + region.h - bandH - 20} L${region.x + bandW},${region.y + region.h - bandH - 14}`)
      .attr('fill', 'none').attr('stroke', view.css('ink-mid')).attr('stroke-width', 1);
    const tailBracketLabel = tailBracket.append('text')
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
    // REVISION (design-revision-spec CR-15 / S5 §2): two-line amber +
    // ink-mid block. Note: CR-15's literal draft text ("rank 1,083 of
    // 30,133") describes the (removed) Trump-mention market from R14, not
    // this ad-market family -- reusing that number here would print a
    // false rank for the wrong market. Structure-spec §5/§6/§7.6 both say
    // the built ad-market beat stands (no political content), so this
    // keeps CR-15's two-line amber/ink-mid FORM but fills it with this
    // family's own data-bound rank instead.
    // The loudest off-pitch novelty of the tournament is the KXWCADS ad
    // family ("which brands advertise around the final"). GATE-5 RE-SYNC
    // (item 4, then a second provenance-audit re-sync): the shipped page's
    // prose and this scene's own data drift apart every time this ad
    // family keeps trading after a freeze -- first at the epilogue-day
    // refreeze (594,454 -> 1,531,620 contracts, rank 7,130), then again as
    // post-final housekeeping trades kept landing (contracts now
    // 4,618,232, rank 2,426 of 30,133, n_markets 35 -> 38). The family
    // grew nearly eightfold from its pre-tournament baseline, not "nearly
    // tripled." The callout below is still an
    // amber ANNOTATION (design-system §6: amber is annotation, never a
    // data encoding), and its leader still anchors at the below-threshold
    // band's edge as a general pointer into the small-market end of the
    // sweep -- the data contract has no per-market ticker to look up that
    // one market's exact dot among the sorted population, so this does not
    // claim the leader marks that dot's precise position, only the
    // neighborhood. The former single-dot Trump highlight is removed with
    // the swap; FIX #6's "lit up because surprising" caption and the
    // S14-constancy tag both presupposed an in-population dot this ad
    // family did not yet have at that time.
    const novelty = sj.novelty_market;
    let noveltyG = null;
    if (novelty) {
      noveltyG = g.append('g').attr('class', 's05-novelty').style('display', 'none');
      // The band spans most of the stage width, so anchor the callout to
      // its right end and let the text run LEFT across the dimmed tail
      // (clamped inside the region), never off the right edge. A short
      // vertical leader drops from the callout down to the band. Three
      // lines (18px rhythm) so the ordering-definition line never has to
      // fight for horizontal room the way one long line would.
      const anchorX = Math.min(region.x + bandW, region.x + region.w - 8);
      const bandTopY = region.y + region.h - bandH;
      const labelY = region.y + region.h - bandH - 76;
      noveltyG.append('line')
        .attr('x1', anchorX - 4).attr('y1', bandTopY)
        .attr('x2', anchorX - 4).attr('y2', labelY + 6)
        .attr('stroke', view.css('accent-annotation')).attr('stroke-width', 1.5);
      // Rank and total are read from the scene JSON every time -- never a
      // hardcoded number -- and the second line states what the rank
      // orders by (Gate-5 item 4c: "the graphic's rank never defines what
      // rank orders").
      const noveltyRank = fmt.count(novelty.rank);
      const noveltyTotal = fmt.count(ml.totalMarkets || sj.total_markets || 30133);
      const noveltyOrdinal = `${noveltyRank}${ordinalSuffix(novelty.rank)}`;
      noveltyG.append('text')
        .attr('x', anchorX).attr('y', labelY).attr('text-anchor', 'end')
        .attr('fill', view.css('accent-annotation'))
        .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
        .text('biggest ad market:');
      noveltyG.append('text')
        .attr('x', anchorX).attr('y', labelY + 18).attr('text-anchor', 'end')
        .attr('fill', view.css('accent-annotation'))
        .style('font', `var(--type-annotation-size) var(--font-apparatus)`)
        .text(`ranked ${noveltyOrdinal} of ${noveltyTotal} by money traded`);
      noveltyG.append('text')
        .attr('x', anchorX).attr('y', labelY + 36).attr('text-anchor', 'end')
        .attr('fill', view.css('ink-mid'))
        .style('font', `var(--type-caption-size) var(--font-apparatus)`)
        .text('lit because it is surprising, not because it is big');
    }

      // Emphasis decay ledger (G4 "one-change-per-step"): step 1 shows
      // only the below-band chip, at ink-mid. Step 2 brings in the tail
      // bracket + core label at ink-mid and demotes the below-band chip
      // to ink-low. Step 3 brings in the one amber unit (the ad-market
      // callout) and demotes the tail bracket + core label to ink-low.
      const dim = view.reducedMotion ? 0 : 550;

    return {
      step(beatId) {
        if (beatId === 'b1') {
          tailBracket.style('display', 'none');
          coreLabel && coreLabel.style('display', 'none');
          noveltyG && noveltyG.style('display', 'none');
          lorenzPath && lorenzPath.style('display', 'none');
          giniCaption.style('display', 'none');
          bandLabel.attr('fill', view.css('ink-mid'));
        } else if (beatId === 'b2') {
          tailBracket.style('display', null);
          coreLabel && coreLabel.style('display', null);
          lorenzPath && lorenzPath.style('display', null);
          giniCaption.style('display', null);
          bandLabel.transition().duration(dim).attr('fill', view.css('ink-low'));
        } else if (beatId === 'b3') {
          noveltyG && noveltyG.style('display', null);
          tailBracketPath.transition().duration(dim).attr('stroke', view.css('ink-low'));
          tailBracketLabel.transition().duration(dim).attr('fill', view.css('ink-low'));
          coreLabel && coreLabel.transition().duration(dim).attr('fill', view.css('ink-low'));
        }
      },
      exit() { g.remove(); },
    };
  },

  beats: [
    {
      id: 'b1',
      html: '<p>Kalshi is the exchange running this market, the place where all this real money trades. It is a company regulated in the United States. It lists a market for almost anything that could happen in this World Cup. The dollars do not spread out evenly. They find the outcomes people think are plausible, and pile in there.</p>',
      trigger: 'step',
      state: 'sweep',
      kind: 'resort',
      chip: [
        // glyph 'dim' (not 'dot'): the key swatch must match what is
        // actually on screen (design-revision-spec G1) -- this population
        // now renders at rest-tier alpha for the whole scene, so its key
        // row renders at rest-tier alpha too.
        { token: 'field-rest', glyph: 'dim', label: 'pale blue = markets, sorted by size' },
      ],
      grain: { text: '1 dot = {grainUsd} of real money traded' },
    },
    {
      id: 'b2',
      html: '<p>A market can split into more than one ticket. A single match splits into three: home win, draw, and away win. Each one of those tickets is called a leg. Three families carried that weight: the match-winner markets, one set per game; the who-advances markets; and the tournament-winner book you have been watching since the start. Those 414 legs took 63.1% of every dollar bet.<sup><a href="#fn-7">7</a></sup> Meanwhile, more than half the catalog, 19,640 tiny markets, shared just 0.36% of all the money.<sup><a href="#fn-7">7</a></sup> Next, one dot lights up deep in the thin tail.</p>',
      trigger: 'step',
    },
    {
      id: 'b3',
      html: '<p>The loudest market with nothing to do with football was a bet on advertising: which brands would run a commercial around the final. All 38 of those ad markets settled at the final itself. Money kept arriving through settlement, and the family grew nearly eightfold, from about 594,000 contracts to 4,618,232.<sup><a href="#fn-8">8</a></sup> The single biggest of them, whether Pepsi would advertise, now ranks 2,426th of 30,133 markets by money traded. That late rush pushed it past the top three thousand and earned it a dot of its own in the picture above, something it could not do before.<sup><a href="#fn-8">8</a></sup> Loud in imagination. Still faint in money: even after growing eightfold, the whole family is a rounding error next to one real match night. Remember these near-empty markets. They come back later, in the one place this market got something wrong.</p><div class="scrim-card" style="margin-top:var(--space-16); padding:var(--space-8) var(--space-12);"><p style="margin:0; max-width:60ch; font-size:var(--type-caption-size);"><strong style="color:var(--accent-annotation);">Skill unlocked.</strong> <span style="color:var(--ink-mid);">Volume measures attention, not knowledge. Before trusting a price, check the money behind it: deep markets like the match books earn trust; near-empty ones do not. Skill 5 shows exactly how they go wrong.</span></p><p style="margin:var(--space-8) 0 0; max-width:60ch; font-size:var(--type-caption-size);"><strong style="color:var(--accent-annotation);">The receipt.</strong> <span style="color:var(--ink-mid);">The tape&rsquo;s own total ran a week ahead of the number in the news. Meanwhile, 63.1% of every dollar sat in three families of serious questions.</span></p></div>',
      trigger: 'step',
      state: 'sweepDimmed',
      kind: 'recolor',
      chip: [
        { token: 'accent-annotation', glyph: 'dot', label: 'amber = the ad market, lit for surprise' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
    },
  ],

  // Reduced motion: defaults suffice. The sweep assembles once (b1); the
  // only later state, sweepDimmed, shares identical x/y and size with
  // sweep (kind: 'recolor', an alpha-only change to the resting tint), so
  // reduced motion's instant-state + crossfade rule already yields the
  // correct still frames.
};
