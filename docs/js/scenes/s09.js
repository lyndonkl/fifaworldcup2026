/* docs/js/scenes/s09.js
 * S9 · Act II · "Three shocks, three arithmetics"
 * storyboard.md §3 S9 · CONTRACT.md §4.2 row s09 (shock-align, 3 steps, no zoom)
 *
 * Grain shift back OUT, narrated: the match-world tick dots (S8's GERPAR
 * window) repack into population grain ("back to $75,000 a dot"). This
 * scene needs no zoom tile: it re-sorts the PERSISTENT population's actual
 * winner-futures dots for Paraguay, Norway, and Belgium along one
 * event-time axis (population columns `team`/`family`/`birth_ts`/
 * `price_band`, CONTRACT §5.2 -- no markets.json lookup required). At the
 * mirror step, Argentina's winner-futures dots re-enter, aligned to
 * Norway's own shock instant so the coincidence reads as literal common
 * fate (R9).
 *
 * DATA_REQUEST: docs/data/scenes/s09.json, built from
 * pipeline/data/analysis/bias-forensics/post_upset_drift.parquet +
 * post_upset_drift_series.parquet (R9). The population tile carries no
 * event timestamps (a goal/elimination is not itself a trade), so the
 * shock anchors and the bracket-news annotation instants must ship here:
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "shocks": [
 *       { "team": "PAR", "shock_ts": ISO, "pop_multiple": 5.0 },
 *       { "team": "NOR", "shock_ts": ISO, "pop_multiple": 3.6 },
 *       { "team": "BEL", "shock_ts": ISO, "pop_multiple": 2.0 }
 *     ],
 *     "annotations": [
 *       { "team": "PAR", "t_hours": <float>, "label": "France confirmed next" },
 *       { "team": "BEL", "t_hours": <float>, "label": "Spain quarterfinal known" }
 *     ],
 *     "mirror": { "norway_hours": 43, "norway_price_c": 10.8, "argentina_team": "ARG" }
 *   }
 * Team codes assume manifest.teams uses FIFA 3-letter codes (PAR/NOR/BEL/ARG);
 * flag to the tile builder if a different code scheme is used.
 */

import { registry, colorOf, particleState, makeState, setColor } from '../shared.js';

function hash01(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
function restFieldXY(i, view) {
  return [
    view.region.x + hash01(i * 2) * view.region.w,
    view.region.y + hash01(i * 2 + 1) * view.region.h,
  ];
}
function pinnedCaption(container, text, cls) {
  return container.html.append('div')
    .attr('class', `pinned-caption ${cls || ''}`)
    .style('position', 'absolute')
    .style('font-family', 'var(--font-apparatus)')
    .style('font-size', 'var(--type-annotation-size)')
    .style('color', 'var(--ink-hi)')
    .style('background', 'var(--bg-card)')
    .style('border', '1px solid rgba(124,135,148,0.25)')
    .style('border-radius', 'var(--space-4)')
    .style('padding', 'var(--space-8) var(--space-12)')
    .style('max-width', '46ch')
    .style('pointer-events', 'none')
    .style('display', 'none')
    .text(text);
}

const TEAMS = [
  { code: 'PAR', color: 'identity-teal', label: 'Paraguay' },
  { code: 'NOR', color: 'identity-blue', label: 'Norway' },
  { code: 'BEL', color: 'identity-pink', label: 'Belgium' },
];
const ARG = { code: 'ARG', color: 'identity-lavender', label: 'Argentina' };

export default {
  id: 's09',
  act: 2,
  title: 'Three shocks, three arithmetics',
  layoutName: 'shock-align',

  needs: { scene: true, series: [], zoom: null },

  scales(data, view) {
    const xPop = d3.scaleLinear().domain([-0.5, 4])
      .range([view.region.x, view.region.x + view.region.w]);
    const xFull = d3.scaleLinear().domain([-2, 74])
      .range([view.region.x, view.region.x + view.region.w]);
    const y = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + view.region.h, view.region.y]);
    registry.register('s09.xPop', xPop);
    registry.register('s09.xFull', xFull);
    registry.register('s09.y', y);
    return { xPop, xFull, y };
  },

  layout(data, view) {
    const { pop, manifest } = data;
    const N = pop.count;
    const base = makeState(N);
    const restRgba = particleState(view.tokens, 'dimmed-field-min');
    const baseSize = view.tokens.dot['radius-base-px'];
    for (let i = 0; i < N; i++) {
      const [rx, ry] = restFieldXY(i, view);
      base.x[i] = rx; base.y[i] = ry;
      setColor(base.color, i, restRgba);
      base.size[i] = baseSize;
    }

    const xPop = registry.get('s09.xPop');
    const xFull = registry.get('s09.xFull');
    const y = registry.get('s09.y');
    const epochMs = new Date(manifest.epoch).getTime();
    const famIdx = manifest.enums.family.indexOf('winner_futures');

    const dotsByTeam = {};
    for (const cfg of TEAMS.concat([ARG])) dotsByTeam[cfg.code] = [];
    for (let i = 0; i < N; i++) {
      if (pop.family[i] !== famIdx) continue;
      const code = manifest.teams[pop.team[i]];
      if (dotsByTeam[code]) dotsByTeam[code].push(i);
    }

    const shocks = (data.scene && data.scene.shocks) || [];
    const shockTsFor = (code) => {
      const s = shocks.find((s2) => s2.team === code);
      return s ? new Date(s.shock_ts).getTime() : null;
    };
    const norwayShockTs = shockTsFor('NOR');

    function dotHoursSince(i, anchorTs) {
      return (epochMs + pop.birth_ts[i] * 1000 - anchorTs) / 3600000;
    }

    function cloneOf(s) {
      return { x: s.x.slice(), y: s.y.slice(), color: s.color.slice(), size: s.size.slice() };
    }

    const popState = cloneOf(base);
    const divState = cloneOf(base);
    const mirrorState = cloneOf(base);

    for (const cfg of TEAMS) {
      const shockTs = shockTsFor(cfg.code);
      if (shockTs === null || pop.price_band === undefined) continue;
      const rgba = colorOf(view.tokens, cfg.color);
      const dimRgba = particleState(view.tokens, 'dimmed-field-max');
      for (const i of dotsByTeam[cfg.code]) {
        if (pop.price_band[i] === 255) continue; // mixed-price bucket: no single y position
        const hrs = dotHoursSince(i, shockTs);
        popState.x[i] = xPop(Math.max(-0.5, Math.min(4, hrs)));
        popState.y[i] = y(pop.price_band[i]);
        setColor(popState.color, i, rgba);
        popState.size[i] = baseSize;

        divState.x[i] = xFull(Math.max(-2, Math.min(74, hrs)));
        divState.y[i] = y(pop.price_band[i]);
        setColor(divState.color, i, rgba);
        divState.size[i] = baseSize;

        mirrorState.x[i] = divState.x[i];
        mirrorState.y[i] = divState.y[i];
        // Norway stays emphasized; Paraguay/Belgium dim (field-dim protocol).
        setColor(mirrorState.color, i, cfg.code === 'NOR' ? rgba : dimRgba);
        mirrorState.size[i] = baseSize;
      }
    }

    // Argentina: background in 'pop'/'divergence'; enters aligned to
    // Norway's own shock instant only at the mirror step.
    if (norwayShockTs !== null) {
      const argRgba = colorOf(view.tokens, ARG.color);
      for (const i of dotsByTeam.ARG) {
        if (pop.price_band[i] === 255) continue;
        const hrs = dotHoursSince(i, norwayShockTs);
        mirrorState.x[i] = xFull(Math.max(-2, Math.min(74, hrs)));
        mirrorState.y[i] = y(pop.price_band[i]);
        setColor(mirrorState.color, i, argRgba);
        mirrorState.size[i] = baseSize;
      }
    }

    return { states: { pop: popState, divergence: divState, mirror: mirrorState } };
  },

  overlay(container, data, view, scales) {
    const { xPop, xFull, y } = scales;
    const g = container.svg;

    const shockLine = g.append('g').style('display', 'none');
    shockLine.append('line')
      .attr('x1', xPop(0)).attr('x2', xPop(0))
      .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
      .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', 1.5);
    shockLine.append('text').attr('x', xPop(0) + 6).attr('y', view.region.y + 14)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-annotation-size)')
      .attr('fill', 'var(--accent-annotation)').text('shock, t=0');

    const divAxis = g.append('g').style('display', 'none');
    divAxis.append('g')
      .attr('transform', `translate(0,${view.region.y + view.region.h + 8})`)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisBottom(xFull).ticks(6).tickFormat((d) => `${d}h`));

    const annoG = g.append('g').style('display', 'none');
    if (data.scene && Array.isArray(data.scene.annotations)) {
      data.scene.annotations.forEach((a) => {
        const ax = xFull(a.t_hours);
        annoG.append('line').attr('x1', ax).attr('x2', ax)
          .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
          .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,3');
        annoG.append('text').attr('x', ax + 4).attr('y', view.region.y + 24)
          .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-annotation-size)')
          .attr('fill', 'var(--accent-annotation)').text(a.label);
      });
    }

    const mirrorCaption = pinnedCaption(
      container,
      'the tell: Norway’s blue leg spikes as Argentina’s lavender leg crashes, sharing one bracket’s arithmetic rather than one market driving the other',
      's09-mirror-caption',
    ).style('left', `${view.region.x}px`).style('top', `${view.region.y - 40}px`);

    function step(beatId) {
      if (beatId === 'b1') shockLine.style('display', null);
      if (beatId === 'b2') { divAxis.style('display', null); annoG.style('display', null); }
      if (beatId === 'b3') mirrorCaption.style('display', null);
    }

    return {
      step,
      exit() {
        g.selectAll('*').remove();
        mirrorCaption.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>Three shocks, three different arithmetics. A team's price is
        really a price on the route still in front of it: beat this side,
        then probably that one. When a result changes who a team would meet
        next, every price along that path moves even though the team itself
        did nothing. That repricing is the bracket arithmetic. Paraguay's
        winner leg popped fivefold when Germany went out, Norway's about 3.6x
        over Brazil, Belgium's roughly twofold, and the 72-hour paths then
        diverged with bracket news rather than fading from
        excess.<sup><a href="#fn-14">14</a></sup></p>`,
      trigger: 'step',
      state: 'pop',
      kind: 'resort',
      chip: 'color: beneficiary team · Paraguay teal, Norway blue, Belgium pink',
      grain: { text: '1 dot = $75,000 of matched volume', variant: 'return' },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>Paraguay drifted as France was confirmed next, Belgium
        converged on a known Spain quarterfinal.<sup><a
        href="#fn-14">14</a></sup></p>`,
      trigger: 'step',
      state: 'divergence',
      kind: 'resort',
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>The tell is Norway, the same match the reader just watched at
        tick grain: its spike to 10.8 cents at hour 43 mirrors, minute for
        minute, Argentina's winner-leg crash while Egypt led.<sup><a
        href="#fn-14">14</a></sup> Whatever the highlight reels were
        celebrating, the tape was doing bracket arithmetic on the paths
        that remained.</p>`,
      trigger: 'step',
      state: 'mirror',
      kind: 'resort',
      chip: 'color: winner leg · Norway blue rising, Argentina lavender falling',
      overlayStep: 'b3',
    },
  ],

  reducedMotion: {
    // Step-triggered: each end state (pop/divergence/mirror) is already
    // static-readable; the engine's own §3.5 instant-apply + 400ms
    // crossfade covers reduced motion without a per-beat substitution.
  },

  anchors: {
    /* L3 recap for S16's lens carousel (CONTRACT §4 `anchors?`): the
     * Norway-Argentina winner-leg mirror, rebuilt from the population's own
     * winner_futures dots (birth time on x, traded price on y). Norway's leg
     * climbs while Argentina's falls; that coincidence is the mirror. This
     * function is self-sufficient by design: it reads only data.pop and
     * data.manifest, builds fresh local scales rather than the registry
     * (this scene's own keys are cleared on exit, CONTRACT §6.1), and never
     * touches data.scene (S16 loads no scenes table, so the live scene's
     * shock timestamps are unavailable here; raw birth time still tells the
     * mirror). S16 dims everything but the NOR/ARG dots via its own
     * spotlight, so this only has to place them truthfully. */
    mirror(data, view, rect) {
      const { pop, manifest } = data;
      const N = pop.count;
      const state = makeState(N);
      const epochMs = new Date(manifest.epoch).getTime();
      const endMs = new Date(manifest.frozen_at || manifest.generated).getTime();
      const famIdx = manifest.enums.family.indexOf('winner_futures');
      const norIdx = manifest.teams.indexOf('NOR');
      const argIdx = manifest.teams.indexOf('ARG');
      const x = d3.scaleUtc().domain([epochMs, endMs]).range([rect.x + 8, rect.x + rect.w - 8]);
      const y = d3.scaleLinear().domain([0, 100]).range([rect.y + rect.h - 8, rect.y + 8]);
      const rest = particleState(view.tokens, 'dimmed-field-min');
      const norRgba = colorOf(view.tokens, 'identity-blue');
      const argRgba = colorOf(view.tokens, 'identity-lavender');
      const baseSize = view.tokens.dot['radius-base-px'];
      for (let i = 0; i < N; i++) {
        const isNor = pop.team[i] === norIdx && pop.family[i] === famIdx;
        const isArg = pop.team[i] === argIdx && pop.family[i] === famIdx;
        if ((isNor || isArg) && pop.price_band[i] !== 255) {
          state.x[i] = x(epochMs + pop.birth_ts[i] * 1000);
          state.y[i] = y(pop.price_band[i]);
          setColor(state.color, i, isNor ? norRgba : argRgba);
        } else {
          state.x[i] = rect.x + rect.w * (0.08 + 0.84 * hash01(i * 3 + 1));
          state.y[i] = rect.y + rect.h * (0.08 + 0.84 * hash01(i * 7 + 2));
          setColor(state.color, i, rest);
        }
        state.size[i] = baseSize;
      }
      return {
        state,
        drawAxes(g) {
          const ax = g.append('g').attr('class', 's09-anchor-axes');
          ax.append('g')
            .attr('transform', `translate(0,${rect.y + rect.h})`)
            .call(d3.axisBottom(x).ticks(4))
            .call((s) => {
              s.selectAll('text').attr('fill', view.css('ink-low'))
                .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
              s.selectAll('path,line').attr('stroke', view.css('ink-low'));
            });
          ax.append('text').attr('x', rect.x).attr('y', rect.y - 6)
            .attr('fill', view.css('identity-blue'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-annotation-size'))
            .text('Norway');
          ax.append('text').attr('x', rect.x + 76).attr('y', rect.y - 6)
            .attr('fill', view.css('identity-lavender'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-annotation-size'))
            .text('Argentina');
        },
      };
    },
  },
};
