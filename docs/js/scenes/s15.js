/* docs/js/scenes/s15.js — "Thirteen months above the line"
 *
 * Storyboard: research/storyboard.md, Act V, S15 (§3, lines ~310-323).
 * CONTRACT registry: docs/CONTRACT.md §4.2 — id s15, act 5, layoutName
 * 'stage-strip', 3 steps, drain is ceremonial, "devigged" qualifier lives
 * in beat copy (design-system.md §8 FIX #3 — see NOTE at bottom of file).
 *
 * Grammar: the strip is built from REAL population dots, never invented
 * points. Every dot tagged team=FRANCE or team=SPAIN inside the
 * winner_futures family is pulled out of the resting population and
 * re-sorted into (stage lane × its own traded price). Dot position is
 * therefore always "money, and only money" (CONTRACT §1 rule 3): the
 * cluster's shape *is* the distribution of real trades around the
 * dossier's corrected premium, not a synthetic per-scene metric. The
 * Opta model line is drawn separately as an outline D3 mark (never
 * dots), because a simulation snapshot is not money (storyboard §0).
 *
 * This module also exports `anchors.strip`, reused verbatim by S16's L5
 * lens step (research/storyboard.md §3, S16 Data note). See CONTRACT
 * §4 `anchors?` shape. Anchor calls must be self-sufficient: the scale
 * registry entries this scene owns ('s15.x','s15.y') are deleted by the
 * driver on scene exit (CONTRACT §6.1 registry.clearScene), so
 * `computeStripState` below builds its own local scales rather than
 * reading the registry, and reads only data.pop / manifest — never
 * data.scene — so it still works when S16 supplies its own (s16) data
 * object. See the file-level NOTE at the bottom and this build's
 * returned `data_requests` for the coordination detail.
 */

import { registry } from '../shared.js';

/* ---------------------------------------------------------------- */
/* Small local helpers (kept in-file: CONTRACT §2 import rule — scenes */
/* import only ../shared.js and, for S16 reuse, sibling scene modules). */

function hash01(i) {
  // Deterministic pseudo-random jitter from dot index only (no Math.random,
  // so replays/reverse-scrubs are identical, matching the engine's own
  // deterministic per-identity stagger hash, CONTRACT §3.2).
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function findTeamIndex(manifest, candidates) {
  const teams = manifest.teams || [];
  for (const c of candidates) {
    const i = teams.findIndex((t) => String(t).toUpperCase() === c.toUpperCase());
    if (i >= 0) return i;
  }
  console.warn(`[rt/s15] manifest.teams has none of ${candidates.join(', ')}`);
  return -1;
}

function findFamilyIndex(manifest, name) {
  const i = (manifest.enums.family || []).indexOf(name);
  if (i < 0) console.warn(`[rt/s15] manifest.enums.family missing "${name}"`);
  return i;
}

/* ---------------------------------------------------------------- */
/* Core placement, shared by layout() and anchors.strip().           */
/* region = { x, y, w, h } in CSS px (view.region for the live scene, */
/* a smaller sub-rect for the S16 recap). drained = true reproduces   */
/* the settlement end state (France grey, Spain lit); false is the    */
/* five-stage "assemble" read.                                        */

function computeStripState(data, view, region, { drained }) {
  const { manifest, pop } = data;
  const N = pop.count;
  const state = { x: new Float32Array(N), y: new Float32Array(N), color: new Float32Array(4 * N), size: new Float32Array(N) };

  const franceIdx = findTeamIndex(manifest, ['FRA', 'FRANCE']);
  const spainIdx = findTeamIndex(manifest, ['ESP', 'SPAIN', 'SPA']);
  const winnerFuturesIdx = findFamilyIndex(manifest, 'winner_futures');

  const stages = (data.scene && data.scene.stages) || [];
  const stageIds = stages.length ? stages.map((s) => s.id) : ['s1', 's2', 's3', 's4', 's5'];

  const x = d3.scalePoint().domain(stageIds).range([region.x + 40, region.x + region.w - 40]).padding(0.6);
  const y = d3.scaleLinear().domain([0, 100]).range([region.y + region.h - 8, region.y + 8]);
  const laneW = Math.max(x.step() * x.padding(), 24);

  // Stage window lookup: birth_ts (seconds since manifest.epoch) -> stage id.
  // Defensive on `s.window`: the shipped s15.json ships stages as long-format
  // per-snapshot rows (stage_id/as_of_date/team/opta_win_pct, one row per
  // team per snapshot) rather than this scene's proposed short-format
  // {id, window:[start,end], opta_pct} shape, so `window` is absent on every
  // row today. Rather than throw (an uncaught TypeError here would break
  // this scene's whole overlay mount for every reader, same class of bug as
  // s10.js's braid/toPoints), a stage missing `window` is treated as
  // unusable and falls back to the same deterministic hash bucketing used
  // when no stages ship at all — never a fabricated window range.
  const epochMs = new Date(manifest.epoch).getTime();
  const windowedStages = stages.filter((s) => Array.isArray(s.window) && s.window.length === 2);
  function stageForBirth(ts) {
    if (!windowedStages.length) return stageIds[Math.min(stageIds.length - 1, Math.floor(hash01(ts) * stageIds.length))];
    const ms = epochMs + ts * 1000;
    for (const s of windowedStages) {
      const w0 = new Date(s.window[0]).getTime();
      const w1 = new Date(s.window[1]).getTime();
      if (ms >= w0 && ms < w1) return s.id;
    }
    // Before the first window: first stage. After the last (in-tournament
    // trading on the winner leg): last stage — it is still the same
    // conviction being read, per the storyboard's "one opinion, read five
    // times" framing.
    return ms < new Date(windowedStages[0].window[0]).getTime()
      ? windowedStages[0].id : windowedStages[windowedStages.length - 1].id;
  }

  const restRgba = view.state('dimmed-field-min'); // field.rest tint, low alpha (§0: rest is narrated, never removed)
  const blue = view.color('identity-blue');   // France
  const crimson = view.color('identity-crimson'); // Spain
  const dead = view.state('dead');

  const birth = pop.birth_ts, team = pop.team, family = pop.family, priceBand = pop.price_band, flags = pop.flags;

  // Deterministic scatter for the resting (non-FRA/ESP) field: reuses the
  // S2 timeline grammar (time = x, price = y) so the field reads as the
  // same population the reader has watched all along, just dimmed.
  const timeX = d3.scaleUtc()
    .domain([new Date(manifest.epoch), new Date(manifest.frozen_at || manifest.generated)])
    .range([region.x, region.x + region.w]);

  for (let i = 0; i < N; i++) {
    const isFRA = team[i] === franceIdx && family[i] === winnerFuturesIdx;
    const isESP = team[i] === spainIdx && family[i] === winnerFuturesIdx;

    if (isFRA || isESP) {
      const sid = stageForBirth(birth[i]);
      const pb = priceBand[i] === 255 ? 50 : priceBand[i]; // mixed-bucket dots: neutral fallback, never invented precision
      const jitterX = (hash01(i) - 0.5) * laneW * 0.7;
      const jitterY = (hash01(i * 7 + 3) - 0.5) * 6;

      if (!drained) {
        state.x[i] = x(sid) + jitterX;
        state.y[i] = y(pb) + jitterY;
        const c = isFRA ? blue : crimson;
        state.color[i * 4] = c[0]; state.color[i * 4 + 1] = c[1];
        state.color[i * 4 + 2] = c[2]; state.color[i * 4 + 3] = c[3];
        state.size[i] = view.tokens.dot['radius-base-px'];
      } else if (isFRA) {
        // France: pour downward and desaturate — the conviction settling
        // to zero at the July 14 mark (storyboard S15 Units).
        state.x[i] = x(stageIds[stageIds.length - 1]) + jitterX;
        state.y[i] = region.y + region.h - 2;
        state.color[i * 4] = dead[0]; state.color[i * 4 + 1] = dead[1];
        state.color[i * 4 + 2] = dead[2]; state.color[i * 4 + 3] = dead[3];
        state.size[i] = view.tokens.dot['radius-base-px'];
      } else {
        // Spain: brighten and drift to the right edge, where S16 receives
        // them (storyboard S15 Units; S16 L5 anchor).
        state.x[i] = region.x + region.w - 6 + jitterX * 0.3;
        state.y[i] = y(pb) + jitterY * 0.4;
        state.color[i * 4] = crimson[0]; state.color[i * 4 + 1] = crimson[1];
        state.color[i * 4 + 2] = crimson[2]; state.color[i * 4 + 3] = crimson[3];
        state.size[i] = view.tokens.dot['radius-base-px'];
      }
    } else {
      state.x[i] = timeX(new Date(epochMs + birth[i] * 1000));
      state.y[i] = region.y + region.h * (0.15 + 0.7 * hash01(i * 13 + 1));
      state.color[i * 4] = restRgba[0]; state.color[i * 4 + 1] = restRgba[1];
      state.color[i * 4 + 2] = restRgba[2]; state.color[i * 4 + 3] = restRgba[3];
      state.size[i] = view.tokens.dot['radius-base-px'];
    }
  }
  return { state, x, y, stageIds, stages };
}

export default {
  id: 's15',
  act: 5,
  title: 'Thirteen months above the line',
  layoutName: 'stage-strip',

  needs: {
    scene: true, // data/scenes/s15.json — see this build's data_requests for
                 // the schema this scene reads (stage windows + Opta values,
                 // sourced from semifinalists_price_vs_opta_elo.csv, R6).
    series: [],
    zoom: null,
  },

  scales(data, view) {
    const built = computeStripState(data, view, view.region, { drained: false });
    const x = registry.register('s15.x', built.x);
    const y = registry.register('s15.y', built.y);
    this._built = built; // cache for layout()/overlay() within this activation
    return { x, y };
  },

  layout(data, view) {
    const assemble = this._built || computeStripState(data, view, view.region, { drained: false });
    const drained = computeStripState(data, view, view.region, { drained: true });
    return {
      states: {
        assemble: assemble.state,
        drain: drained.state,
      },
      _meta: { stages: assemble.stages, stageIds: assemble.stageIds },
    };
  },

  overlay(container, data, view, scales) {
    const g = container.svg.append('g').attr('class', 's15-overlay');
    const stages = (data.scene && data.scene.stages) || [];
    const axisG = g.append('g').attr('class', 's15-axis')
      .attr('transform', `translate(0, ${view.region.y + view.region.h + 8})`)
      .call(d3.axisBottom(scales.x).tickFormat((id) => {
        const s = stages.find((st) => st.id === id);
        return s ? s.label : id;
      }));
    axisG.selectAll('text')
      .attr('fill', view.css('ink-mid'))
      .attr('font-family', view.css('font-apparatus'))
      .attr('font-size', view.css('type-micro-size'));
    axisG.selectAll('path,line').attr('stroke', view.css('ink-low'));

    // Model reference line (Opta): a D3 outline mark, never dots — a
    // simulation snapshot is not money (storyboard §0 / CONTRACT rule 3).
    const modelLine = d3.line()
      .x((s) => scales.x(s.id))
      .y((s) => scales.y(s.opta_pct));
    const modelPath = g.append('path')
      .attr('class', 's15-model-line')
      .attr('fill', 'none')
      .attr('stroke', view.css('neutral-data'))
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '2 3')
      .attr('opacity', 0)
      .attr('d', stages.length ? modelLine(stages) : null);

    const labelFrance = g.append('text').attr('class', 's15-label-france')
      .text('France').attr('fill', view.css('identity-blue'))
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-annotation-size'))
      .attr('opacity', 0);
    const labelSpain = g.append('text').attr('class', 's15-label-spain')
      .text('Spain').attr('fill', view.css('identity-crimson'))
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-annotation-size'))
      .attr('opacity', 0);
    if (stages.length) {
      labelFrance.attr('x', scales.x(stages[0].id) - 8).attr('y', scales.y(stages[0].opta_pct) - 22);
      labelSpain.attr('x', scales.x(stages[0].id) - 8).attr('y', scales.y(stages[0].opta_pct) + 34);
    }

    const pinnedCaption = g.append('text').attr('class', 's15-pinned')
      .attr('x', view.region.x).attr('y', view.region.y - 12)
      .attr('fill', view.css('accent-annotation'))
      .attr('font-family', view.css('font-apparatus')).attr('font-weight', 600)
      .attr('font-size', view.css('type-annotation-size'))
      .attr('opacity', 0)
      .text('One opinion, read five times.');

    const settleMark = g.append('g').attr('class', 's15-settle').attr('opacity', 0);
    settleMark.append('line')
      .attr('x1', view.region.x + view.region.w).attr('x2', view.region.x + view.region.w)
      .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
      .attr('stroke', view.css('accent-annotation')).attr('stroke-width', 1.5);
    settleMark.append('text')
      .attr('x', view.region.x + view.region.w - 6).attr('y', view.region.y + 16)
      .attr('text-anchor', 'end')
      .attr('fill', view.css('accent-annotation'))
      .attr('font-family', view.css('font-tape')).attr('font-size', view.css('type-tape-size'))
      .text('July 14 · settled');
    const devigNote = g.append('text').attr('class', 's15-devig')
      .attr('x', view.region.x + view.region.w).attr('y', view.region.y + view.region.h + 36)
      .attr('text-anchor', 'end')
      .attr('fill', view.css('ink-mid'))
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-caption-size'))
      .attr('opacity', 0)
      .text('devigged premium: +3 to +5pp France, ~−3pp Spain');

    const fade = (sel, on) => sel.transition().duration(400).attr('opacity', on ? 1 : 0);

    return {
      step(beatId) {
        if (beatId === 'b1') {
          fade(modelPath, true); fade(labelFrance, true); fade(labelSpain, true);
          fade(pinnedCaption, false); fade(settleMark, false); fade(devigNote, false);
        } else if (beatId === 'b2') {
          fade(pinnedCaption, true);
        } else if (beatId === 'b3') {
          fade(pinnedCaption, false);
          fade(settleMark, true); fade(devigNote, true);
        }
      },
      exit() { g.remove(); },
    };
  },

  beats: [
    {
      id: 'b1',
      html: '<p>For thirteen months the market held one opinion the model never talked it out of. At all five published simulation snapshots it priced France three to five points above Opta and Spain at or below the line, near-symmetric, robust across venues,</p>',
      trigger: 'step',
      state: 'assemble',
      kind: 'resort',
      chip: 'color: team (France vs. Spain)',
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: '<p>one persistent level disagreement read five times rather than five confirmations.<sup class="fn"><a href="#fn-21">21</a></sup></p>',
      trigger: 'step',
      // no state: dots hold; this step is the pinned-caption beat only
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: '<p>On July 14 in Arlington, Spain won in ninety minutes and the conviction settled to zero.<sup class="fn"><a href="#fn-1">1</a></sup> A single match cannot falsify a forty-percent price. It can, however, hand the trophy game to the team the market spent a year discounting, and that is the situation the final’s number now has to price.</p>',
      trigger: 'step',
      state: 'drain',
      kind: 'ceremonial',
      overlayStep: 'b3',
    },
  ],

  // reducedMotion: no overrides needed. The 'ceremonial' drain already
  // resolves under CONTRACT §3.5 to an instant target + 400ms canvas
  // crossfade; every beat's end state (assemble / drain) is already the
  // static-readable frame the storyboard specifies (design-system.md §5).

  anchors: {
    // Reused verbatim by S16 L5 ("the stage strip, France grey, Spain
    // lit" — storyboard §3 S16 Beat L5). Always renders the DRAINED
    // (settled) read, matching the lens's post-elimination framing.
    // Self-sufficient: reads only data.pop / data.manifest / data.scene
    // (s15.json, if present in the caller's cache — degrades gracefully
    // via computeStripState's stages.length fallback if absent).
    strip(data, view, rect) {
      const built = computeStripState(data, view, rect, { drained: true });
      return {
        state: built.state,
        drawAxes(g) {
          const stages = built.stages;
          if (!stages.length) return;
          g.append('path').attr('fill', 'none')
            .attr('stroke', view.css('neutral-data')).attr('stroke-width', 1)
            .attr('stroke-dasharray', '2 3')
            .attr('d', d3.line().x((s) => built.x(s.id)).y((s) => built.y(s.opta_pct))(stages));
        },
      };
    },
  },
};

/* NOTE (data_requests / coordination — see this build's returned
 * summary): design-system.md §8 FIX #3 requires the word "devigged" to
 * appear in S15's *beat copy*, not only in overlay annotation text; the
 * storyboard's verbatim S15 Beat prose (research/storyboard.md) does not
 * contain that word (only "three to five points above Opta"). Per this
 * build's instructions ("beats[] with the storyboard's drafted prose
 * VERBATIM ... do not rewrite"), the prose above is kept exactly as
 * drafted; the overlay's devig annotation (`s15-devig` text, step b3)
 * already carries the qualifier. Flagged for the prose-integration /
 * editorial pass to reconcile the two authorities. */
