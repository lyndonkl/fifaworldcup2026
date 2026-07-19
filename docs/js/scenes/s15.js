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

  // ENCODING (perception-brief §9b/§10.1): the ACTIVE subset must pop against a
  // dimmed resting field, and that pop is carried by LUMINANCE, not hue — the
  // engine classifies each dot every frame by its OWN alpha and boosts
  // active-tier (alpha >= dot.opacity-active-classify-min 0.9) while dimming
  // rest-tier (alpha <= dot.opacity-rest-classify-max 0.42). So the resting
  // field is pinned to dimmed-field-min (alpha 0.25 -> rest-tier, dimmed) while
  // France/Spain wear their identity hue at full alpha 1.0 (-> active-tier,
  // boosted). No hardcoded alphas: the two tiers ride the token opacities.
  const restRgba = view.state('dimmed-field-min'); // rest-tier: dimmed by the engine; rest is narrated, never removed (§0)
  const blue = view.color('identity-blue');   // France's money — active-tier (alpha 1.0)
  const crimson = view.color('identity-crimson'); // Spain's money — active-tier (alpha 1.0)
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
  kicker: 'Skill 5, continued: the open question, and it is about Spain',
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

    // Axis titles (design-revision-spec G3 / S15 "Axes" directive). The
    // plotted quantity is each dot's own traded price (0-100, cents), with
    // the model line drawn on the same scale for comparison — the title
    // below describes what is actually bound to y (raw price), matching
    // the S1 axis-title convention, rather than a differenced "premium"
    // series this scene's data layer does not compute (CLAUDE.md: keep
    // every data binding intact; a label rewrite must stay truthful to it).
    const xRange = scales.x.range ? scales.x.range() : [view.region.x, view.region.x + view.region.w];
    axisG.append('text').attr('class', 's15-x-title')
      .attr('x', (xRange[0] + xRange[1]) / 2).attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('fill', view.css('ink-mid'))
      .attr('font-family', view.css('font-apparatus')).attr('font-weight', 500)
      .attr('font-size', view.css('type-caption-size'))
      .text('five checkpoints in the tournament (stage)');
    g.append('text').attr('class', 's15-y-title')
      .attr('x', view.region.x + view.region.w).attr('y', view.region.y - 12)
      .attr('text-anchor', 'end')
      .attr('fill', view.css('ink-mid'))
      .attr('font-family', view.css('font-apparatus')).attr('font-weight', 500)
      .attr('font-size', view.css('type-caption-size'))
      .text('ticket price (cents; 100 = certain)');

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

    // Direct label at the model line's right end (design-revision-spec
    // S15 item 4): names the grey line so its meaning never depends on
    // recall alone.
    const modelLineLabel = g.append('text').attr('class', 's15-model-label')
      .attr('fill', view.css('neutral-data'))
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-caption-size'))
      .attr('text-anchor', 'end')
      .attr('opacity', 0)
      .text('the model’s odds (devigged)');
    if (stages.length) {
      const lastStage = stages[stages.length - 1];
      modelLineLabel.attr('x', scales.x(lastStage.id)).attr('y', scales.y(lastStage.opta_pct) - 8);
    }

    const labelFrance = g.append('text').attr('class', 's15-label-france')
      .text('France’s money').attr('fill', view.css('identity-blue'))
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-annotation-size'))
      .attr('opacity', 0);
    const labelSpain = g.append('text').attr('class', 's15-label-spain')
      .text('Spain’s money').attr('fill', view.css('identity-crimson'))
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
    // Devig annotation (design-revision-spec S15 item 4): must appear
    // BEFORE the drain, never during it, and sit near France's mid-stage
    // cluster rather than the corner. "devigged" carries its plain-words
    // gloss inline (CR-19), and the number stays storyboard-verbatim.
    const devigNote = g.append('text').attr('class', 's15-devig')
      .attr('text-anchor', 'middle')
      .attr('fill', view.css('ink-mid'))
      .attr('font-family', view.css('font-apparatus')).attr('font-size', view.css('type-caption-size'))
      .attr('opacity', 0)
      .text('+3 to +5 points above the model, devigged (bookmaker’s cut removed)');
    if (stages.length) {
      const midStage = stages[Math.floor(stages.length / 2)];
      devigNote.attr('x', scales.x(midStage.id)).attr('y', scales.y(midStage.opta_pct) - 40);
    }

    const fade = (sel, on) => sel.transition().duration(400).attr('opacity', on ? 1 : 0);
    const ceremonialMs = view.tokens.motion.durations_ms['ceremonial-max'];

    return {
      step(beatId) {
        if (beatId === 'b1') {
          fade(modelPath, true); fade(modelLineLabel, true);
          fade(labelFrance, true); fade(labelSpain, true);
          fade(devigNote, true);
          fade(pinnedCaption, false); fade(settleMark, false);
          // Reversible: snapping back to the assemble step (a reverse
          // scrub) restores France's label color, undoing the b3 recolor.
          labelFrance.interrupt().attr('fill', view.css('identity-blue'));
        } else if (beatId === 'b2') {
          fade(pinnedCaption, true);
        } else if (beatId === 'b3') {
          fade(pinnedCaption, false);
          fade(devigNote, false);
          fade(settleMark, true);
          // Common fate (design-revision-spec S15 item 2): the France
          // label recolors to ink-low in the same beat its dots drain to
          // state.dead grey, so label and dots read as one dying event.
          labelFrance.transition().duration(ceremonialMs).attr('fill', view.css('ink-low'));
        }
      },
      exit() { g.remove(); },
    };
  },

  beats: [
    {
      id: 'b1',
      html: '<p>For thirteen months, this market held one steady opinion. Bookmakers add a small fee to every price. Strip that fee out, a step this piece calls <strong>devigged</strong>, the bookmaker&rsquo;s cut removed, and the market&rsquo;s real belief shows. At five points during the tournament, the devigged price put France a few cents above a computer model&rsquo;s guess. It put Spain a few cents below that same guess, almost every time.<sup class="fn"><a href="#fn-21">21</a></sup></p>',
      trigger: 'step',
      state: 'assemble',
      kind: 'resort',
      chip: [
        { token: 'identity-blue', glyph: 'dot', label: 'blue = France’s money' },
        { token: 'identity-crimson', glyph: 'dot', label: 'red = Spain’s money' },
        { token: 'neutral-data', glyph: 'line', label: 'grey line = the computer model’s guess' },
        { token: 'field-rest', glyph: 'dim', label: 'grey dots = money at rest, the whole tournament' },
      ],
      grain: { text: '1 dot = $75,000 of real money traded' },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: '<p>That is one opinion, checked five times. Five snapshots of one held opinion do not add up to five independent opinions.</p>',
      trigger: 'step',
      // no state: dots hold; this step is the pinned-caption beat only
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: '<p>On July 14 in Arlington, Spain beat France in ninety minutes. The conviction this market held for over a year <strong>settled to zero</strong> the moment the game ended.<sup class="fn"><a href="#fn-1">1</a></sup> One match cannot prove a forty-percent price wrong. But tonight&rsquo;s final belongs to the very team this market spent a year doubting. Was that doubt real information, or just a blind spot? No skill in this course can answer that for you. It is the one open question inside tonight&rsquo;s number.</p><div class="act-close scrim-card" style="margin-top:var(--space-16)"><p><strong>Skill unlocked:</strong> you now know the market&rsquo;s two real flaws. It taxes cheap tickets where almost no one is trading. And it can hold one stubborn opinion for a year.</p><p><strong>The receipt:</strong> the one confirmed flaw lived in the aisles almost nobody shopped. The one open opinion is playing tonight.</p></div>',
      trigger: 'step',
      state: 'drain',
      kind: 'ceremonial',
      chip: [
        { token: 'state-dead', glyph: 'dead', label: 'grey = settled to zero, dead money' },
        { token: 'identity-crimson', glyph: 'dot', label: 'red = Spain’s money' },
        { token: 'neutral-data', glyph: 'line', label: 'grey line = the computer model’s guess' },
        { token: 'field-rest', glyph: 'dim', label: 'grey dots = money at rest, the whole tournament' },
      ],
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

/* NOTE (resolved in the prose-polish pass): design-system.md §8 FIX #3
 * requires the word "devigged" in S15's beat copy, not only in the overlay
 * annotation. Beat b1 now carries it ("the devigged price put France three
 * to five points above Opta"), so the two authorities agree; the footnote
 * marker also moved onto b1, where the statistic actually lives, and b1/b2
 * are now each a complete sentence. The numbers stay storyboard-verbatim
 * ("three to five points"); only the framing gained the required qualifier.
 * The overlay's `s15-devig` annotation (step b3) still carries the same
 * qualifier, which is now a reinforcement rather than the sole disclosure. */
