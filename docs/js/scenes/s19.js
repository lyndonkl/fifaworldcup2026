/* docs/js/scenes/s19.js — v2 Epilogue · "The morning after"
 *
 * Storyboard: research/storyboard.md §5, SE1 ("The morning after," shape
 * only, four beats under one pinned canvas — settle / lens audit /
 * conviction verdict / last number). This build's task brief supersedes
 * SE1's exact four-beat wording with a more specific one (settled facts
 * verified from the store and live API, 2026-07-19); the SHAPE — one
 * pinned scene, chart-first, four short beats, hands off to S18 — is kept
 * exactly as SE1 specifies. Placement: between s17 and s18 (SE1's own
 * placement, "built in Phase 6," and this build's explicit instruction —
 * s18 stays the final scene).
 *
 * DOCTRINE THIS FILE FOLLOWS (research/design-review/visual-story-review.md,
 * "THE DECLUTTER DOCTRINE," §5): one message per beat, chart-first — a
 * labeled line or column, not the particle field alone, carries each
 * beat's claim; particles are dimmed texture behind it. Budgets: <=4
 * simultaneous meanings, <=3 competing bright elements, exactly 1 amber
 * meaning per beat, no silent key or grain changes. This file follows the
 * s10.js/s11.js pattern precedent named in this build's brief: population
 * rests once (a single 'rest' state, never re-sorted again — CONTRACT
 * §4.5's "rest-field scenes" budget: population never tweens after entry,
 * one D3 overlay event per step), and every beat's story is told by solid-
 * fill D3 marks over a backdrop scrim panel (s11.js's fix for figure-ground
 * bloom against a dimmed field), with direct labels and titled axes
 * (design-revision-spec.md G3/G5).
 *
 * WHY CHART-FIRST IS STRUCTURAL HERE, NOT ONLY STYLE: the population tile
 * (data/pop-75k.bin) is frozen at manifest.frozen_at (the G3 morning-of-
 * final pass, before kickoff — docs/data/manifest.json). Every fact this
 * scene tells — the settlement, the TIE leg's climb, the 2030 book's first
 * trades — postdates that freeze and lives only in data/scenes/s19.json,
 * this build's own incremental "class A live recompute" pass (Phase 6:
 * "one incremental pull," CLAUDE.md). No population dot carries any of
 * these events, so the population cannot be the storyteller; it is
 * dimmed-field texture throughout, exactly as s10.js/s11.js already do for
 * scores and gaps (neither is money either). Every number below reads from
 * data.scene (data/scenes/s19.json) or the frozen data.manifest.hero pair
 * S17 already displayed — nothing here is invented or recomputed locally.
 *
 * CONTRACT registry: docs/CONTRACT.md §4 (scene module contract). Not one
 * of the storyboard's original 18 scenes (§4.2's table stops at s18), so
 * this file proposes its own act/layoutName for the audit trail: act 5
 * (extends "How to read the number" — the exam is now graded), layoutName
 * 'epilogue-ledger'.
 */

import { registry, particleState, makeState, setColor, fmt } from '../shared.js';

const FN = (n) => `<sup class="fn"><a href="#fn-${n}">${n}</a></sup>`;

/* Deterministic per-index hash (no Math.random — CONTRACT §3.2: replays and
 * reverse scrubs must be identical). Mirrors s10.js/s11.js exactly. */
function hash01(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

/* The population's single resting arrangement for this whole scene (s10.js/
 * s11.js precedent: "the dots rest here," never re-sorted again once
 * entered). x = birth time on the shared 'global.time' scale (so the field
 * reads as the same population the reader has watched all along); y = a
 * deterministic jitter across the stage band. dimmed-field-min (alpha 0.25)
 * keeps it inside the engine's rest-tier classification (CONTRACT §3.4),
 * which the density-aware tone-map recedes further so it can never
 * out-shine the D3 marks that actually carry this scene's four claims. */
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
 * s10.js/s11.js rather than imported — CONTRACT §2's module import rule
 * reserves sibling-scene imports for S16's anchor carousel only. */
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

// Plain-words stage labels — identical vocabulary to s15.js's STAGE_LABELS
// (s19.json's spain_vs_model.stages ship the same ids/labels s15.json
// does, both sourced from the same R6 snapshots). Duplicated, not
// imported (CONTRACT §2).
const STAGE_LABELS = {
  pre_tournament: 'before the tournament',
  post_group_pre_r32: 'after the groups',
  post_r32_pre_r16: 'after the round of 32',
  post_r16_pre_qf: 'after the round of 16',
  post_qf_pre_sf: 'after the quarterfinals',
};
function humanizeStageLabel(label) {
  if (!label) return '';
  return STAGE_LABELS[label] || String(label).replace(/_/g, ' ');
}

export default {
  id: 's19',
  act: 5,
  title: 'The morning after',
  kicker: 'The epilogue — the market, graded',
  layoutName: 'epilogue-ledger',

  needs: {
    scene: true, // data/scenes/s19.json — every fact this scene needs lives
                 // here or in manifest.hero (already loaded for S17).
    series: [],
    zoom: null,  // no dot-level zoom tile: no ZOOM_ESPARG flag exists in
                 // this build's population tile (manifest.enums.flags —
                 // only FRAESP/MEXENG/GERPAR/NORBRA were tagged), and the
                 // TIE leg's climb is already a build-time minute aggregate
                 // in s19.json (tie_climb.points), the same "small,
                 // axis-ready aggregate" shape CONTRACT §5.5 asks for. The
                 // raw tick tape (data/zoom/esparg.bin) exists in this
                 // build's data/ tree but is out of this scene's file scope
                 // to wire (no population flag to select its dots by) — a
                 // natural S18 "check it yourself" candidate for a future
                 // pass, not a gap this scene silently papers over.
  },

  scales(data, view) {
    const t0 = new Date(data.manifest.epoch).getTime();
    const t1 = new Date(data.manifest.frozen_at || data.manifest.generated).getTime();
    const time = registry.register('s19.time',
      d3.scaleUtc().domain([t0, t1]).range([view.region.x, view.region.x + view.region.w]));
    return { time };
  },

  layout(data, view) {
    // Figure/ground per perception-brief.md §4/§9b, same call as s10.js/
    // s11.js: none of this scene's four claims is money (a settlement
    // price, a minute-by-minute price path, a model gap, a next-book's
    // early dollars are all either prices or, for the last one, dollars
    // that belong to a market outside this tile's own census). The whole
    // population is therefore the dimmed GROUND for the whole scene; the
    // FIGURE that pops each beat is a solid-fill D3 mark, named by the
    // persistent color key.
    return { states: { rest: restField(data, view) } };
  },

  overlay(container, data, view, scales) {
    const { svg, html } = container;

    const T = view.tokens.motion.durations_ms;
    const drawIn = T['overlay-draw-in'];
    const stagger = T['overlay-stagger'];
    const leaderStandoff = view.tokens.layout['annotation-leader-standoff-px'];
    const spacing = view.tokens.spacing_px; // [4,8,12,16,24,32,48,64,96,128]
    const y0 = view.region.y + view.region.h;

    // KEY RECT (design-revision-spec.md G5/CR-2): the persistent color key
    // is fixed at the viewport's top-right corner (desktop), floating in
    // z-order ABOVE this scene's SVG overlay (CONTRACT §8.1's layer stack:
    // #overlay is z-2, #chip is z-4). Any text this scene places inside
    // that rect is not merely occluded, it's invisible — hidden entirely
    // under the key's opaque card. keyBottomY/keySafeX below give every
    // draw function a cheap two-number test to keep annotation TEXT (never
    // the data marks themselves — a line or bar may run near/under the key,
    // same as s10.js's braid) out of that corner. Mobile's key sits
    // bottom-right instead, so this only applies on desktop.
    const keyBottomY = view.mobile ? -Infinity
      : spacing[4] + (view.tokens.layout['key-exclusion-h-px'] || 132) + spacing[3];
    const keySafeX = view.mobile ? Infinity
      : view.W - spacing[4] - (view.tokens.layout['key-exclusion-w-px'] || 280) - spacing[3];

    const g = svg.append('g').attr('class', 's19-epilogue');

    // Backdrop scrim panel (s11.js's fix for the same figure-ground bloom
    // risk: the population cannot be relocated out of this scene's own
    // rect without an unannounced silent re-sort, so the chart gets its
    // own quiet reading surface instead — bg-card-composite-cap, the token
    // design-system.md documents as the hard cap for exactly this case).
    // One panel, reused across all four beats (the region does not move).
    const scrimRight = Math.min(view.W - spacing[1], view.region.x + view.region.w + spacing[7]);
    g.append('rect').attr('class', 's19-scrim')
      .attr('x', view.region.x - spacing[3])
      .attr('y', view.region.y - spacing[5])
      .attr('width', scrimRight - (view.region.x - spacing[3]))
      .attr('height', view.region.h + spacing[5] + spacing[6])
      .attr('rx', 4)
      .attr('fill', view.css('bg-card-composite-cap'))
      .attr('fill-opacity', 0.62)
      .attr('stroke', 'none');

    const chartLayer = g.append('g').attr('class', 's19-chart');

    const captionDiv = zoneK(
      html.append('div').attr('class', 's19-caption')
        .style('position', 'absolute')
        .style('font', '13px var(--font-tape)')
        .style('color', view.css('ink-mid'))
        .style('pointer-events', 'none'),
      view,
    );
    const footDiv = zoneF(
      html.append('div').attr('class', 's19-foot')
        .style('position', 'absolute')
        .style('max-width', '34ch')
        .style('font', '13px var(--font-apparatus)')
        .style('color', view.css('ink-low'))
        .style('pointer-events', 'none'),
      view,
    );

    /* One getBBox()-measured scrim behind any floating text that sits over
     * the field rather than the chart's own scrim panel (s04.js/s09.js/
     * s11.js's established pattern for exactly this failure mode). Used
     * for every amber annotation below — the piece's one-amber-per-beat
     * rule means this always marks the current beat's single story point. */
    function scrimText(layer, x, yy, anchor, color, text, weight) {
      const t = layer.append('text')
        .attr('x', x).attr('y', yy).attr('text-anchor', anchor)
        .attr('fill', color)
        .style('font', `${weight || 500} 13px var(--font-apparatus)`)
        .text(text);
      const bb = t.node().getBBox();
      layer.insert('rect', () => t.node())
        .attr('x', bb.x - spacing[0]).attr('y', bb.y - spacing[0])
        .attr('width', bb.width + spacing[0] * 2).attr('height', bb.height + spacing[0] * 2)
        .attr('rx', 3)
        .attr('fill', view.css('bg-card-composite-cap')).attr('opacity', 0.85);
      return t;
    }

    function xAxisTitle(text) {
      chartLayer.append('text').attr('class', 's19-x-title')
        .attr('x', view.region.x + view.region.w / 2)
        .attr('y', y0 + spacing[4] + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', view.css('ink-mid'))
        .style('font', '12px var(--font-apparatus)')
        .text(text);
    }
    function yAxisTitle(text) {
      chartLayer.append('text').attr('class', 's19-y-title')
        .attr('x', view.region.x).attr('y', view.region.y - leaderStandoff)
        .attr('fill', view.css('ink-mid'))
        .style('font', '12px var(--font-apparatus)')
        .text(text);
    }
    function fadeIn(sel) {
      if (view.reducedMotion) { sel.attr('opacity', 1); return sel; }
      return sel.attr('opacity', 0).transition().duration(drawIn).attr('opacity', 1);
    }

    /* ---------------------------------------------------------------- */
    /* Beat 1 — the headline grade. Frozen exam numbers vs the settled    */
    /* prices, one paired-column chart, restated verbatim from            */
    /* manifest.hero via s19.json's exam_restated block.                  */

    function drawHeadlineGrade() {
      chartLayer.selectAll('*').remove();
      const exam = (data.scene && data.scene.exam_restated) || {};
      const settle = (data.scene && data.scene.settlement) || {};
      const legs = exam.legs || [];
      const espLeg = legs.find((l) => l.label === 'ESP') || {};
      const argLeg = legs.find((l) => l.label === 'ARG') || {};
      const rows = [
        {
          team: 'Spain', tone: 'identity-crimson',
          frozen: espLeg.price_c, devig: espLeg.devig_pct,
          settled: settle.champion_futures_last_trade ? settle.champion_futures_last_trade.price_c : null,
        },
        {
          team: 'Argentina', tone: 'ink-low',
          frozen: argLeg.price_c, devig: argLeg.devig_pct,
          settled: settle.runner_up_futures_last_trade ? settle.runner_up_futures_last_trade.price_c : null,
        },
      ];

      const x0 = d3.scaleBand().domain(rows.map((r) => r.team))
        .range([view.region.x + 30, view.region.x + view.region.w - 30]).padding(0.45);
      const x1 = d3.scaleBand().domain(['frozen', 'settled']).range([0, x0.bandwidth()]).padding(0.22);
      const y = d3.scaleLinear().domain([0, 100]).range([y0, view.region.y]);

      styleAxis(
        chartLayer.append('g').attr('class', 's19-axis-x')
          .attr('transform', `translate(0,${y0})`)
          .call(view.mobile ? d3.axisTop(x0) : d3.axisBottom(x0)),
        view.css('ink-mid'),
      );
      styleAxis(
        chartLayer.append('g').attr('class', 's19-axis-y')
          .attr('transform', `translate(${view.region.x},0)`)
          .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}¢`)),
        view.css('ink-mid'),
      );
      yAxisTitle('contract price (cents; 100 = certain)');

      const bars = chartLayer.append('g').attr('class', 's19-bars');
      rows.forEach((r) => {
        const gx = x0(r.team);
        [['frozen', r.frozen, 'this morning'], ['settled', r.settled, 'the whistle']].forEach(([key, v, qualifier]) => {
          if (v === null || v === undefined) return;
          const bx = gx + x1(key);
          const bw = x1.bandwidth();
          const solid = key === 'settled';
          const rect = bars.append('rect')
            .attr('x', bx).attr('width', bw)
            .attr('y', y0).attr('height', 0)
            .attr('rx', 2)
            .attr('fill', solid ? view.css(r.tone) : 'none')
            .attr('fill-opacity', solid ? 0.88 : 0)
            .attr('stroke', solid ? 'none' : view.css('ink-mid'))
            .attr('stroke-dasharray', solid ? null : '3,3')
            .attr('stroke-width', solid ? 0 : 1.5);
          const target = { y: y(v), height: y0 - y(v) };
          if (view.reducedMotion) rect.attr('y', target.y).attr('height', target.height);
          else rect.transition().delay(stagger).duration(drawIn).attr('y', target.y).attr('height', target.height);

          const label = bars.append('text')
            .attr('x', bx + bw / 2).attr('y', y(v) - 20)
            .attr('text-anchor', 'middle')
            .attr('fill', solid ? view.css('ink-hi') : view.css('ink-mid'))
            .style('font', '13px var(--font-apparatus)')
            .text(fmt.cents(v));
          bars.append('text')
            .attr('x', bx + bw / 2).attr('y', y(v) - 6)
            .attr('text-anchor', 'middle')
            .attr('fill', view.css('ink-low'))
            .style('font', '10.5px var(--font-apparatus)')
            .text(qualifier);
          fadeIn(label);
        });
      });

      // The scene's one amber unit for this beat: the winner ticket paid.
      // BLIND-REVIEW FIX (b1): the pill used to float at y(99.9c) - 40 —
      // which, for a bar that tops out a hair under region.y, is exactly
      // the Zone K caption line (region.y - 40), so it printed over the
      // chart headline AND crowded the bar's own "99.9¢ / the whistle"
      // stack. The same keyBottomY floor every other draw function uses
      // now pushes it down into the settled bar's upper body (the bar is
      // near-full-height, so keyBottomY + a step is always inside it),
      // clear of the caption above, clear of the value/qualifier labels
      // at the bar's top, and — centered on Spain's bar, far left of
      // keySafeX — nowhere near the KEY rect. scrimText()'s backing rect
      // keeps the amber legible over the crimson fill.
      const spainSettled = rows[0].settled;
      if (spainSettled !== null && spainSettled !== undefined) {
        const ax = x0('Spain') + x1('settled') + x1.bandwidth() / 2;
        const ay = Math.max(y(spainSettled) - 40, keyBottomY + spacing[2]);
        fadeIn(scrimText(bars, ax, ay, 'middle', view.css('accent-annotation'), 'the winner ticket paid', 600));
      }

      footDiv.html(`devigged, the fee stripped out: Spain&rsquo;s true chance was ${fmt.pct(rows[0].devig || 0)}; Argentina&rsquo;s was ${fmt.pct(rows[1].devig || 0)}`);
      // BLIND-REVIEW FIX (b1): .text() sets a DOM text node — it never
      // parses HTML entities, so the old '&rsquo;' rendered literally on
      // screen. Plain characters only in any .text() path ('.html()' rows
      // like footDiv above may keep entities).
      captionDiv.text("This morning's price, graded against the whistle.");
    }

    /* ---------------------------------------------------------------- */
    /* Beat 2 — the instrument lesson paid off. The regulation TIE leg's  */
    /* minute-by-minute climb: 33c pre-match to 99c at settlement, one    */
    /* amber band at the half hour it hardened.                          */

    function drawTieClimb() {
      chartLayer.selectAll('*').remove();
      const tc = (data.scene && data.scene.tie_climb) || {};
      const pts = tc.points || [];
      const hh = tc.headline_half_hour || {};
      const lastMin = pts.length ? pts[pts.length - 1].minute : 138;

      // BLIND-REVIEW FIX (b2, CRITICAL): the series itself runs all the way
      // to settlement (last points: 99c), and the y-domain is a full
      // [0,100] — but with the x-range running to the stage's right edge,
      // the whole final climb (minutes ~129-138, prices 87->99c) rendered
      // INSIDE the fixed KEY panel's rect at the viewport top-right, under
      // its near-opaque card. On screen the line visibly topped out around
      // 85c and the payoff never appeared. keySafeX/keyBottomY only
      // protected annotation text; the data marks were exempt — which is
      // fine for a line RUNNING NEAR the key (s10's braid) but not for a
      // line whose climax ENDS inside it. Clamp the x-range so the entire
      // path, settlement plateau included, ends left of the key rect; the
      // 99c endpoint then gets its own dot + label (below).
      const xRight = Math.min(view.region.x + view.region.w - 20, keySafeX - spacing[3]);
      const x = d3.scaleLinear().domain([0, lastMin]).range([view.region.x + 20, xRight]);
      const y = d3.scaleLinear().domain([0, 100]).range([y0, view.region.y]);

      styleAxis(
        chartLayer.append('g').attr('class', 's19-axis-x')
          .attr('transform', `translate(0,${y0})`)
          .call((view.mobile ? d3.axisTop(x) : d3.axisBottom(x)).ticks(6)),
        view.css('ink-mid'),
      );
      styleAxis(
        chartLayer.append('g').attr('class', 's19-axis-y')
          .attr('transform', `translate(${view.region.x},0)`)
          .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}¢`)),
        view.css('ink-mid'),
      );
      xAxisTitle('minutes since kickoff, into extra time (minutes)');
      yAxisTitle('price of a level match after ninety minutes (cents)');

      // The amber band + label (one composed amber unit, G4's own
      // definition): the half hour the tape itself names, minute 120
      // (21:00Z, 120 minutes after 19:00Z kickoff) through the tape's own
      // last point (match end, 21:18:51Z).
      if (hh.window_utc && tc.kickoff_utc) {
        const kickoffMs = new Date(tc.kickoff_utc).getTime();
        const bandStartMin = Math.max(0, (new Date(hh.window_utc[0]).getTime() - kickoffMs) / 60000);
        const bandLayer = chartLayer.append('g').attr('class', 's19-band');
        const bx0 = x(Math.min(bandStartMin, lastMin));
        bandLayer.append('rect')
          .attr('x', bx0).attr('width', Math.max(0, x(lastMin) - bx0))
          .attr('y', view.region.y).attr('height', view.region.h)
          .attr('fill', view.css('accent-annotation')).attr('fill-opacity', 0)
          .call((sel) => (view.reducedMotion ? sel.attr('fill-opacity', 0.14)
            : sel.transition().duration(drawIn).attr('fill-opacity', 0.14)));
        // Label sits at the band's FOOT, not its top: the band spans minute
        // 120-138, exactly the chart's top-right corner where the price
        // line is also climbing toward 99c — both the KEY panel (see
        // keyBottomY/keySafeX above) and the line itself crowd that corner.
        // The band's own lower reach, over the same minutes, is empty (the
        // price is high there, so 0-30c is clear canvas), so the label
        // reads next to the shaded region without any collision. Stacked a
        // full line above the end-of-line price label below it, and
        // right-anchored at the band's own right edge (rather than left-
        // anchored at its left edge) so the text runs INTO the chart, not
        // past the viewport's own right border — the band's last minute
        // sits within ~20px of the stage edge, too little room to grow a
        // ~20-character label rightward.
        fadeIn(scrimText(bandLayer, Math.min(x(lastMin), view.region.x + view.region.w) - spacing[1],
          y0 - spacing[6], 'end',
          view.css('accent-annotation'), `${fmt.count(hh.n_trades || 0)} trades: the draw hardens`, 600));
      }

      if (pts.length > 1) {
        const line = d3.line().x((d) => x(d.minute)).y((d) => y(d.tie_price_c));
        const path = chartLayer.append('path').datum(pts).attr('class', 's19-tie-line')
          .attr('fill', 'none').attr('stroke', view.css('ink-hi')).attr('stroke-width', 2.5)
          .attr('d', line).attr('stroke-opacity', 0);
        if (view.reducedMotion) path.attr('stroke-opacity', 1);
        else path.transition().duration(drawIn).attr('stroke-opacity', 1);

        const first = pts[0], last = pts[pts.length - 1];
        fadeIn(chartLayer.append('text')
          .attr('x', x(first.minute) + 6).attr('y', y(first.tie_price_c) - 10)
          .attr('fill', view.css('ink-mid')).style('font', '12px var(--font-apparatus)')
          .text(`${fmt.cents(first.tie_price_c)} before kickoff`));
        // BLIND-REVIEW FIX (b2, CRITICAL, second half): with the x-range
        // clamped clear of the KEY rect (see the x scale above), the
        // settlement endpoint is now visible canvas, so the payoff is
        // labeled AT the endpoint itself — a dot on the last tick plus
        // "settled at 99¢" — instead of the old stand-in label parked at
        // the axis foot (which read as the line stopping short). The label
        // anchors 'end' so its text runs leftward into the chart, staying
        // left of keySafeX and above the plateau.
        fadeIn(chartLayer.append('circle')
          .attr('cx', x(last.minute)).attr('cy', y(last.tie_price_c))
          .attr('r', 3.5).attr('fill', view.css('ink-hi')));
        fadeIn(chartLayer.append('text')
          .attr('x', x(last.minute) - spacing[1]).attr('y', y(last.tie_price_c) - spacing[2])
          .attr('text-anchor', 'end')
          .attr('fill', view.css('ink-hi')).style('font', '13px var(--font-apparatus)')
          .text(`settled at ${fmt.cents(last.tie_price_c)}`));
      }

      // Gate-5 provenance audit (WRONG_SCOPE): "before the whistle" implied
      // the 30 minutes immediately preceding the actual last trade
      // (21:18:51Z) -- window_utc is really a fixed nominal-clock half
      // hour keyed to the 120-minute mark (see the amber-band comment
      // above), a different, earlier-starting window with materially
      // different figures (recomputed: ~20,438 trades / ~80.5c against the
      // literal "30 minutes before the whistle" reading, vs the 16,961/
      // 85.4c this fixed-clock window actually measures). Reworded to
      // describe the window this caption's own numbers are scoped to.
      footDiv.html(`${fmt.count(hh.n_trades || 0)} trades in the half hour after the 120-minute mark, averaging ${fmt.cents(hh.mean_price_c || 0)}`);
      captionDiv.text('Regulation Time, decided beyond regulation time.');
    }

    /* ---------------------------------------------------------------- */
    /* Beat 3 — the deep lens graded. The thirteen-month Spain discount   */
    /* against the model, recapped from s19.json's own spain_vs_model.    */

    function drawDeepLens() {
      chartLayer.selectAll('*').remove();
      const svm = (data.scene && data.scene.spain_vs_model) || {};
      const stages = svm.stages || [];
      if (!stages.length) return;
      const ids = stages.map((s) => s.id);
      const x = d3.scalePoint().domain(ids)
        .range([view.region.x + 40, view.region.x + view.region.w - 40]).padding(0.6);
      const gaps = [];
      stages.forEach((s) => { gaps.push(s.france.gap_pp, s.spain.gap_pp, 0); });
      const ext = d3.extent(gaps);
      const y = d3.scaleLinear().domain(ext).nice().range([y0, view.region.y]);

      styleAxis(
        chartLayer.append('g').attr('class', 's19-axis-x')
          .attr('transform', `translate(0,${y0})`)
          .call((view.mobile ? d3.axisTop(x) : d3.axisBottom(x)).tickFormat((id) => {
            const s = stages.find((st) => st.id === id);
            return humanizeStageLabel(s ? s.label : id);
          })),
        view.css('ink-mid'),
      );
      styleAxis(
        chartLayer.append('g').attr('class', 's19-axis-y')
          .attr('transform', `translate(${view.region.x},0)`)
          .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}pp`)),
        view.css('ink-mid'),
      );
      xAxisTitle('five checkpoints in the tournament (stage)');
      yAxisTitle('market price minus model odds (percentage points, devigged)');

      chartLayer.append('line')
        .attr('x1', view.region.x).attr('x2', view.region.x + view.region.w)
        .attr('y1', y(0)).attr('y2', y(0))
        .attr('stroke', view.css('neutral-data')).attr('stroke-dasharray', '2,3').attr('stroke-width', 1);
      chartLayer.append('text')
        .attr('x', view.region.x + view.region.w).attr('y', y(0) - 6)
        .attr('text-anchor', 'end')
        .attr('fill', view.css('neutral-data')).style('font', '11px var(--font-apparatus)')
        .text('at the model’s guess');

      const franceLine = d3.line().x((s) => x(s.id)).y((s) => y(s.france.gap_pp));
      const spainLine = d3.line().x((s) => x(s.id)).y((s) => y(s.spain.gap_pp));
      const fPath = chartLayer.append('path').datum(stages).attr('fill', 'none')
        .attr('stroke', view.css('ink-low')).attr('stroke-width', 1.5).attr('stroke-dasharray', '3,3')
        .attr('d', franceLine).attr('opacity', 0);
      const sPath = chartLayer.append('path').datum(stages).attr('fill', 'none')
        .attr('stroke', view.css('identity-crimson')).attr('stroke-width', 2.5)
        .attr('d', spainLine).attr('opacity', 0);
      fadeIn(fPath); fadeIn(sPath);

      fadeIn(chartLayer.append('text')
        .attr('x', x(stages[0].id) - 8).attr('y', y(stages[0].france.gap_pp) - 10)
        .attr('fill', view.css('ink-low')).style('font', '11px var(--font-apparatus)')
        .text('France (for reference)'));
      fadeIn(chartLayer.append('text')
        .attr('x', x(stages[0].id) - 8).attr('y', y(stages[0].spain.gap_pp) + 16)
        .attr('fill', view.css('identity-crimson')).style('font', '12px var(--font-apparatus)')
        .text('Spain’s money'));

      // The one amber unit: the verdict, at the stage closest to tonight.
      const lastStage = stages[stages.length - 1];
      fadeIn(scrimText(chartLayer, x(lastStage.id), y(lastStage.spain.gap_pp) - 22, 'middle',
        view.css('accent-annotation'), 'the discounted team won', 600));

      footDiv.text('one tournament is one result, not a verdict on thirteen months of pricing');
      captionDiv.text('Thirteen months of one opinion, graded once.');
    }

    /* ---------------------------------------------------------------- */
    /* Beat 4 — the close. The 2030 winner book, listed within minutes    */
    /* of settlement. Short: a small bar of its first dollars, then the   */
    /* handoff to S18.                                                    */

    function drawNextBelief() {
      chartLayer.selectAll('*').remove();
      const nb = (data.scene && data.scene.next_belief) || {};
      const markets = (nb.markets || [])
        .filter((m) => m.dollars)
        .sort((a, b) => b.dollars - a.dollars)
        .slice(0, 6);
      if (!markets.length) return;

      // Spain (the top row, sorted first by dollars) is also the LONGEST
      // bar, so its value label and amber annotation land at the far end
      // of the widest bar — exactly the chart's top-right corner, the KEY
      // panel's reserved rect (see keyBottomY/keySafeX above). Starting the
      // whole band below keyBottomY, rather than at region.y, keeps every
      // row's labels clear of the key regardless of x (design-revision-spec
      // G5: no annotation may sit under the key).
      const chartTop = Math.max(view.region.y, keyBottomY);
      const yBand = d3.scaleBand().domain(markets.map((m) => m.team))
        .range([chartTop, chartTop + Math.min(view.region.h - (chartTop - view.region.y), markets.length * 34 + 20)])
        .padding(0.32);
      // Right range trimmed well short of keySafeX so the value label AND
      // the amber annotation both have clear room after even the longest
      // (Spain's) bar, on the same side as the KEY but below it.
      const x = d3.scaleLinear().domain([0, d3.max(markets, (m) => m.dollars)]).nice()
        .range([view.region.x + 90, Math.min(view.region.x + view.region.w - 70, keySafeX - 130)]);

      styleAxis(
        chartLayer.append('g').attr('class', 's19-axis-y')
          .attr('transform', `translate(${view.region.x + 90},0)`)
          .call(d3.axisLeft(yBand)),
        view.css('ink-mid'),
      );
      chartLayer.selectAll('.s19-axis-y .tick text')
        .attr('fill', view.css('ink-hi')).style('font-weight', 500);
      xAxisTitle('dollars already traded, 2030 winner book ($)');

      const bars = chartLayer.append('g').attr('class', 's19-belief-bars');
      markets.forEach((m, i) => {
        const isSpain = m.team === 'Spain';
        const by = yBand(m.team);
        const bw = yBand.bandwidth();
        const rect = bars.append('rect')
          .attr('x', view.region.x + 90).attr('y', by).attr('height', bw)
          .attr('width', 0).attr('rx', 2)
          .attr('fill', isSpain ? view.css('identity-crimson') : view.css('ink-mid'))
          .attr('fill-opacity', isSpain ? 0.9 : 0.6);
        const w = Math.max(0, x(m.dollars) - (view.region.x + 90));
        if (view.reducedMotion) rect.attr('width', w);
        else rect.transition().delay(i * Math.min(stagger, 30)).duration(drawIn).attr('width', w);
        fadeIn(bars.append('text')
          .attr('x', view.region.x + 90 + w + 8).attr('y', by + bw / 2 + 4)
          .attr('fill', view.css('ink-mid')).style('font', '12px var(--font-apparatus)')
          .text(fmt.usd(m.dollars)));
      });

      const spain = markets.find((m) => m.team === 'Spain');
      if (spain) {
        const by = yBand('Spain');
        const w = Math.max(0, x(spain.dollars) - (view.region.x + 90));
        fadeIn(scrimText(bars, view.region.x + 90 + w + 8, by - 8, 'start',
          view.css('accent-annotation'), `already the loudest of ${nb.n_markets || markets.length}`, 600));
      }

      const gapMin = nb.gap_from_champion_futures_settlement_s
        ? Math.round(nb.gap_from_champion_futures_settlement_s / 60) : null;
      footDiv.text(gapMin
        ? `the book opened about ${gapMin} minutes after Spain’s coronation settled`
        : 'the book opened within minutes of settlement');
      captionDiv.text('The next belief, already trading.');
    }

    const DRAW = {
      b1: drawHeadlineGrade,
      b2: drawTieClimb,
      b3: drawDeepLens,
      b4: drawNextBelief,
    };

    /* Fast-scroll data-race self-heal (observed in this build's own capture
     * harness): a jump straight into this scene can activate a beat before
     * data/scenes/s19.json has ever been fetched — main.js's enterScene()
     * kicks off the load and re-enters on resolve, but its re-activation
     * path early-returns on an unchanged activeBeatKey, so the empty first
     * draw would otherwise be the FINAL frame (b1 rendered bare axes and a
     * "0.0%" footer in exactly this state). Scenes are asked to "degrade
     * gracefully on missing data" (main.js enterScene note); this module
     * goes one step further and repairs itself: one fetch of the same URL
     * main.js uses (data.manifest.scenes.s19 — no external calls, same
     * relative tile path), stash into data.scene, redraw the current beat.
     * The draw functions all clear chartLayer first, so a redraw is
     * idempotent; the isConnected guard drops the redraw if the reader has
     * already scrolled the scene away. */
    let lastBeatId = null;
    let healKicked = false;
    function healSceneData() {
      if (data.scene || healKicked) return;
      healKicked = true;
      const url = data.manifest && data.manifest.scenes && data.manifest.scenes.s19;
      if (!url || typeof fetch !== 'function') return;
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!json || data.scene) return;
          data.scene = json;
          if (lastBeatId && DRAW[lastBeatId] && g.node() && g.node().isConnected) {
            DRAW[lastBeatId]();
          }
        })
        .catch(() => {});
    }

    return {
      step(beatId) {
        lastBeatId = beatId;
        if (!data.scene) healSceneData();
        if (DRAW[beatId]) DRAW[beatId]();
      },
      exit() {
        g.remove();
        captionDiv.remove();
        footDiv.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>This morning, before kickoff, this market froze its price for tonight&rsquo;s final. Spain&rsquo;s ticket to lift the trophy cost 58.8 cents. Argentina&rsquo;s cost 42.0.${FN(23)} Strip out the fee, devigged, and Spain&rsquo;s true chance was 53.9 in 100. Argentina&rsquo;s was 38.5.</p><p>Spain won. At the final trade, Spain&rsquo;s ticket settled near 99.9 cents. Argentina&rsquo;s settled near 0.1.${FN(24)} The frozen number was not a guess. It was a price, and the price paid.</p>`,
      trigger: 'step',
      state: 'rest',
      kind: 'resort',
      chip: [
        { token: 'identity-crimson', glyph: 'block', label: 'crimson = Spain, this morning and at the whistle' },
        { token: 'ink-low', glyph: 'block', label: 'grey = Argentina, this morning and at the whistle' },
        { token: 'accent-annotation', glyph: 'dot', label: 'amber = the frozen call that paid' },
        { token: 'field-rest', glyph: 'dim', label: 'grey dots = money at rest, the whole tournament' },
      ],
      grain: {
        text: '1 dot = {grainUsd} traded again · this is the whole tournament · it never leaves',
        variant: 'return',
      },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>Ninety minutes ended level. Spain became champion in extra time, not in regulation.${FN(24)} This piece taught that lesson once already, at the Germany-Paraguay shootout: check which ticket is talking. Tonight two tickets disagreed, and a reader who learned that lesson read both of them right.</p><p>The trophy ticket said Spain would win the World Cup. A second ticket asked a narrower question: would the match still be level after ninety minutes? Before kickoff it traded near 33 cents. As the draw held, it climbed. In the half hour after the 120-minute mark it traded 16,961 times, averaging 85 cents.${FN(24)} It settled at 99.</p><p>A piece called Regulation Time was decided beyond regulation time.</p>`,
      trigger: 'step',
      // BLIND-REVIEW FIX (scene-wide): b2-b4 carried no chip rows, so the
      // key kept displaying b1's crimson/grey bar meanings under every
      // later chart. Each beat now names exactly what it draws (<= 3
      // meaning rows + the standing rest row, G1).
      chip: [
        { token: 'ink-hi', glyph: 'line', label: 'white = the level-after-ninety ticket, minute by minute' },
        { token: 'accent-annotation', glyph: 'block', label: 'amber = the half hour the draw hardened' },
        { token: 'field-rest', glyph: 'dim', label: 'grey dots = money at rest, the whole tournament' },
      ],
      overlayStep: 'b2',
    },
    {
      id: 'b3',
      html: `<p>Now grade the deepest read of all. At five checkpoints across thirteen months, devigged, this market priced France a few points above a computer model&rsquo;s guess. It priced Spain a few points below that same guess, at four checkpoints out of five.${FN(21)}</p><p>Tonight the discounted team is the champion.</p><p>One tournament is one result. It cannot prove thirteen months of pricing right or wrong by itself, and this piece will not pretend otherwise. But the market&rsquo;s longest-held opinion was also its wrongest one, and that is worth sitting with.</p>`,
      trigger: 'step',
      chip: [
        { token: 'identity-crimson', glyph: 'line', label: "crimson = Spain's gap to the model" },
        { token: 'ink-low', glyph: 'dash', label: 'grey dashes = France, for reference' },
        { token: 'accent-annotation', glyph: 'dot', label: 'amber = the verdict, graded tonight' },
        { token: 'field-rest', glyph: 'dim', label: 'grey dots = money at rest, the whole tournament' },
      ],
      overlayStep: 'b3',
    },
    {
      id: 'b4',
      html: `<p>About eleven minutes after Spain&rsquo;s coronation settled, Kalshi opened a market on who wins the 2030 World Cup.${FN(25)} Eighty-two countries, priced before the confetti finished falling. Spain&rsquo;s ticket was already the loudest of them, about seven times the volume of the next-biggest country.${FN(25)}</p><p>The next belief was already trading before this one finished being read. Every market above, and this new one too, is still yours to check. The lab is open below.</p>`,
      trigger: 'step',
      chip: [
        { token: 'identity-crimson', glyph: 'block', label: "crimson = Spain's 2030 winner ticket" },
        { token: 'ink-mid', glyph: 'block', label: 'grey = the other 2030 tickets' },
        { token: 'accent-annotation', glyph: 'dot', label: 'amber = already the loudest of 82' },
        { token: 'field-rest', glyph: 'dim', label: 'grey dots = money at rest, the whole tournament' },
      ],
      overlayStep: 'b4',
    },
  ],

  // reducedMotion: no overrides needed. The single 'rest' state resolves
  // under CONTRACT §3.5's instant-set + 400ms canvas crossfade like every
  // other rest-field scene (s10.js/s11.js), and every custom D3 draw
  // function above checks view.reducedMotion itself and renders its static
  // end state directly — every beat's chart is already the static-readable
  // frame this scene's doctrine requires.
};
