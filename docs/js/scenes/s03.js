/* docs/js/scenes/s03.js — "The flood"
 * Storyboard: research/storyboard.md ACT I, S3 (dossier Act 3 opener, R1 + R18)
 * Contract: docs/CONTRACT.md §4 (scene module), §4.2 (registry row s03,
 * layoutName `family-race`, 3 steps, no zoom), §4.5 (overlay obligations).
 *
 * Layout grammar: the whole population (data.pop, N = the loaded tile's
 * count) re-sorts from S2's timeline arrangement into two dot-built
 * columns — futures (KXMENWORLDCUP winner book) vs everything else
 * ("match" families) — stacked bottom-up as a waffle/packed rectangle so
 * column height is literally dot count, i.e. money (CONTRACT §1.3: dot
 * size is never a magnitude channel; count/position always is). Each of
 * the scene's three steps admits a larger arrival-time cutoff, so the
 * columns visibly grow across the three beats exactly as CLAUDE.md's
 * "never cut and redraw" / "re-sort of the same dots" rule requires —
 * this is the same population, re-targeted three times, not a new one.
 *
 * Dots not yet "arrived" as of a step's cutoff rest, dimmed, along the
 * global time axis (the arrangement S2 already taught the reader),
 * pinned to a thin band above the columns: population constancy holds
 * through a narrated rest (storyboard §0), and the visual reads as
 * "money not yet arrived is still out there on the timeline."
 *
 * DATA CONTRACT ASSUMPTIONS (flagged in the builder's data_requests):
 * this scene reads `data/scenes/s03.json` for the two arrival-time
 * cutoffs and the press-floor marker (dated figures that CONTRACT §1.5
 * forbids hardcoding). Shape read here:
 *   {
 *     "_provenance": { "sources": [...], "generated": "<iso>" },
 *     "day1_end":      "<iso>",   // cutoff for beat 1 ("day one")
 *     "crossover_end": "<iso>",   // cutoff for beat 2 ("the day-two crossover")
 *     "press_floor": { "usd": 7400000000, "as_of": "<iso>",
 *                       "label": "press floor, ~one week stale" }
 *   }
 * The running counter's day-1/crossover checkpoint totals and the
 * cumulative futures-vs-match race curves are NOT read from a separate
 * series section: they are aggregated client-side, once, from the
 * already-loaded population tile's own `birth_ts`/`dollars`/`family`
 * columns. That keeps the numeral and the curve exactly consistent with
 * the dots on screen and needs no extra network payload — see
 * `buildCumulativeSeries()` below. The final snapshot total is instead
 * read from `manifest.census.total_usd` (the deploy-frozen, reconciled
 * figure the beat prose quotes as "$12.75 billion"), since that is the
 * authoritative number, not a $75k-grain-quantized approximation of it.
 */

import { registry, particleState, colorOf, makeState, fmt } from '../shared.js';

const FAMILY_COLOR = {
  futures: 'identity-teal',     // NOTE: independent per-scene color choice —
  match: 'identity-lavender',   // see this builder's returned `notes`: confirm
};                               // S2 uses the same futures/match mapping.

function hash01(i) {
  // Deterministic pseudo-random in [0,1) from a dot index; used only for
  // sub-pixel jitter inside the resting band (never for position magnitude).
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = (x * 2246822519) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function tsMs(iso, fallbackMs) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : fallbackMs;
}

/* One pass over the population: per-dot family bucket + arrival rank
 * within that bucket (cheap because the tile is already sorted ascending
 * by birth_ts — CONTRACT §5.2 — so index order IS arrival order). Also
 * builds the daily cumulative usd series per bucket for the race-curve
 * overlay, entirely from the loaded tile. */
function analyzePopulation(pop, manifest) {
  const N = pop.count;
  const famNames = manifest.enums.family;
  const futIdx = famNames.indexOf('winner_futures');
  const epochMs = Date.parse(manifest.epoch);

  const isFutures = new Uint8Array(N);
  const rank = new Uint32Array(N);
  const birthMs = new Float64Array(N);
  let futCount = 0, matchCount = 0;

  const dayMs = 86400000;
  const futByDay = new Map();
  const matchByDay = new Map();

  for (let i = 0; i < N; i++) {
    const fut = pop.family[i] === futIdx;
    isFutures[i] = fut ? 1 : 0;
    rank[i] = fut ? futCount++ : matchCount++;
    const bMs = epochMs + pop.birth_ts[i] * 1000;
    birthMs[i] = bMs;
    const day = Math.floor((bMs - epochMs) / dayMs);
    const bucket = fut ? futByDay : matchByDay;
    bucket.set(day, (bucket.get(day) || 0) + pop.dollars[i]);
  }

  return {
    N, isFutures, rank, birthMs,
    totalFutures: futCount, totalMatch: matchCount,
    futByDay, matchByDay, epochMs,
  };
}

/* Cumulative running-total series (sparse day -> usd maps collapsed to
 * sorted arrays), used only by the overlay's race-curve mini chart. */
function buildCumulativeSeries(an) {
  const days = new Set([...an.futByDay.keys(), ...an.matchByDay.keys()]);
  const sorted = [...days].sort((a, b) => a - b);
  let runFut = 0, runMatch = 0;
  const points = [];
  for (const d of sorted) {
    runFut += an.futByDay.get(d) || 0;
    runMatch += an.matchByDay.get(d) || 0;
    points.push({ day: d, futUsd: runFut, matchUsd: runMatch });
  }
  return points;
}

/* Pack `count` dots ascending-index-first into a bottom-up waffle rect
 * centered at colCenterX with width colW, baseline at baseY, pitch
 * `spacing`. Returns {x,y} accessor for a given in-column rank. */
function makePacker(colCenterX, colW, baseY, spacing, perRow) {
  return (r) => {
    const row = Math.floor(r / perRow);
    const col = r % perRow;
    return {
      x: colCenterX - (colW / 2) + spacing * (col + 0.5),
      y: baseY - spacing * (row + 0.5),
    };
  };
}

export default {
  id: 's03',
  act: 1,
  title: 'The flood',
  // Gate-4 round 2 (structure-spec §2/§3): course spine, shown on every
  // beat card via main.js's kicker fallback chain (scene.kicker wins).
  kicker: 'Skill 2 of 5 — what volume means',
  layoutName: 'family-race',

  needs: { scene: true, series: [], zoom: null },

  scales(data, view) {
    const region = view.region;
    // Mini race-curve chart occupies a bounded inset at the top of the
    // stage rect so it never collides with the dot columns beneath.
    // Gate-4 visual-story review (s03 C3): nearly all of the tournament's
    // money trades in the domain's final ~5% (kickoff through freeze), so
    // the one pixel range that actually matters sat directly under the
    // fixed KEY RECT (top-right no-fly zone, design-revision-spec G5) and
    // was never visible in any captured frame. Stop the chart before that
    // reserved band -- the same pattern s10/s12 already use -- so the
    // curve's climb has somewhere on screen to be seen.
    const keyMarginPx = view.mobile ? 0
      : (view.tokens.layout['key-exclusion-w-px'] || 280) + view.tokens.spacing_px[3];
    const chartRight = view.mobile
      ? region.x + region.w
      : Math.min(region.x + region.w, view.W - keyMarginPx - view.safe);
    const chartRect = {
      x: region.x, y: region.y,
      w: chartRight - region.x, h: region.h * 0.16,
    };
    const x = registry.register('s03.time',
      d3.scaleUtc()
        .domain([new Date(data.manifest.epoch), new Date(data.manifest.frozen_at || data.manifest.generated)])
        .range([chartRect.x, chartRect.x + chartRect.w]));
    const maxUsd = Math.max(1, data.manifest.census ? data.manifest.census.total_usd : 1);
    const y = registry.register('s03.usd',
      d3.scaleLinear().domain([0, maxUsd]).range([chartRect.y + chartRect.h, chartRect.y]));
    return { x, y, chartRect };
  },

  layout(data, view) {
    const { pop, manifest, scene } = data;
    const an = analyzePopulation(pop, manifest);
    const sj = scene || {};
    const region = view.region;

    const day1CutMs = tsMs(sj.day1_end, an.epochMs);
    const crossoverCutMs = tsMs(sj.crossover_end, an.epochMs);

    const restRgba = particleState(view.tokens, 'rest');
    const futColor = colorOf(view.tokens, FAMILY_COLOR.futures, view.tokens.dot['opacity-alive']);
    const matchColor = colorOf(view.tokens, FAMILY_COLOR.match, view.tokens.dot['opacity-alive']);
    const baseSize = view.tokens.dot['radius-base-px'] * 2;

    // Geometry: mobile stacks the two families as horizontal bars growing
    // rightward; desktop stacks them as vertical columns growing upward
    // (storyboard Mobile note: "columns become stacked horizontal bars").
    const mobile = view.mobile;
    const gutter = mobile ? region.h * 0.10 : region.w * 0.10;
    const colSpanW = mobile ? region.w * 0.86 : (region.w - gutter) / 2 * 0.72;
    // Gate-4 visual-story review (s03 M2/M3): at full population (b3) the
    // column was tall enough to run up behind the counter and the KEY
    // RECT. Reserve that chrome band explicitly -- 0.62 (recalibrated
    // against the counter's own measured on-screen box: top offset
    // key-exclusion-h + 3 stacked space tokens + a ~58px 48px-font line
    // box) leaves the column's tallest possible top comfortably below the
    // counter's footprint instead of relying on the mini-chart's height
    // alone.
    const colSpanH = mobile ? region.h * 0.16 : region.h * 0.62;

    // Adaptive pitch: choose a packing pitch so the larger (match) family's
    // FINAL dot count just fills the available colSpanW x colSpanH box —
    // the standard "fit N items into a W x H rectangle" pitch, applied
    // symmetrically to both orientations (desktop wraps into new rows
    // growing upward with width bounded; mobile wraps into new strips
    // growing rightward with height bounded) so neither ever overflows
    // its budget. At population scale (tens of thousands of dots in a
    // few hundred px) the fitted pitch is routinely sub-pixel — that is
    // correct, not a bug: dot RENDER size stays fixed at the token's
    // `--dot-radius-base-px` regardless of how close centers pack, and
    // heavy center overlap is exactly the additive-density signal
    // `docs/CONTRACT.md` §3.4 / design-system.md §7 are built around.
    // The only floor is a sanity epsilon against div-by-zero; the only
    // cap keeps very sparse (low-N) cases from spacing out absurdly.
    const tokenPitch = baseSize * 1.15;
    const areaNeeded = Math.max(an.totalMatch, an.totalFutures, 1);
    const fitPitch = Math.sqrt((colSpanW * colSpanH) / areaNeeded);
    const spacing = Math.max(0.15, Math.min(fitPitch, tokenPitch * 4));
    const perRow = mobile
      ? Math.max(1, Math.floor(colSpanH / spacing))   // dots per vertical strip (mobile)
      : Math.max(1, Math.floor(colSpanW / spacing));  // dots per row (desktop)

    let futCenterX, matchCenterX, baseY, futTop, matchTop, baseX;
    if (mobile) {
      futTop = region.y + region.h * 0.22;
      matchTop = region.y + region.h * 0.48;
      baseX = region.x + region.w * 0.08;
    } else {
      futCenterX = region.x + region.w * 0.27;
      matchCenterX = region.x + region.w * 0.73;
      baseY = region.y + region.h * 0.94;
    }

    // Mobile packer: grows rightward in vertical strips of `perRow` dots
    // each (a 90°-rotated version of the desktop waffle), so a column
    // never runs off-screen the way an un-wrapped single row would.
    const packHorizontal = (rowTopY, originX, pitch, perStrip) => (r) => {
      const strip = Math.floor(r / perStrip);
      const within = r % perStrip;
      return {
        x: originX + pitch * (strip + 0.5),
        y: rowTopY + pitch * (within + 0.5),
      };
    };

    const packFut = mobile
      ? packHorizontal(futTop, baseX, spacing, perRow)
      : makePacker(futCenterX, colSpanW, baseY, spacing, perRow);
    const packMatch = mobile
      ? packHorizontal(matchTop, baseX, spacing, perRow)
      : makePacker(matchCenterX, colSpanW, baseY, spacing, perRow);

    // Resting band: dots not yet arrived sit along the global time axis
    // (the S2 arrangement), dim, in a thin strip above the columns.
    const timeScale = registry.has('global.time') ? registry.get('global.time') : null;
    const restY = region.y + region.h * 0.06;

    function buildState(cutoffMs) {
      const st = makeState(an.N);
      for (let i = 0; i < an.N; i++) {
        const arrived = an.birthMs[i] <= cutoffMs;
        const o = i * 4;
        if (arrived) {
          const p = an.isFutures[i] ? packFut(an.rank[i]) : packMatch(an.rank[i]);
          st.x[i] = p.x; st.y[i] = p.y;
          const c = an.isFutures[i] ? futColor : matchColor;
          st.color[o] = c[0]; st.color[o + 1] = c[1]; st.color[o + 2] = c[2]; st.color[o + 3] = c[3];
          st.size[i] = baseSize;
        } else {
          const jitter = (hash01(i) - 0.5) * region.w * 0.02;
          st.x[i] = timeScale ? timeScale(an.birthMs[i]) + jitter : region.x + hash01(i) * region.w;
          st.y[i] = restY + (hash01(i * 7 + 1) - 0.5) * (region.h * 0.03);
          st.color[o] = restRgba[0]; st.color[o + 1] = restRgba[1];
          st.color[o + 2] = restRgba[2]; st.color[o + 3] = restRgba[3];
          st.size[i] = baseSize;
        }
      }
      return st;
    }

    return {
      states: {
        // Gate-4 visual-story review (s03 C1): the population arrives at
        // this scene however the PREVIOUS scene left it (object constancy
        // — the engine never cuts and redraws), so the very first captured
        // frame of b1 is mostly that prior scene's colors and shape, not
        // this scene's key. `entryRest` is every dot at the resting-band
        // position/tint (buildState with an unreachable cutoff arrives
        // nobody), snapped to instantly in overlay() below, so the b1
        // resort always animates FROM a clean, key-matching rest field,
        // never from another scene's residue.
        entryRest: buildState(-Infinity),
        day1: buildState(day1CutMs),
        crossover: buildState(crossoverCutMs),
        snapshot: buildState(Infinity),
      },
      // Handed to overlay() via closure below is not possible (pure fn
      // contract), so the overlay recomputes analyzePopulation() itself
      // on mount — acceptable: it runs once per scene activation, not
      // per frame, and both call sites read the same immutable pop tile.
    };
  },

  overlay(container, data, view, scales) {
    const { svg, html, activate } = container;
    const sj = data.scene || {};
    const an = analyzePopulation(data.pop, data.manifest);
    const points = buildCumulativeSeries(an);
    const { x, y, chartRect } = scales;

    // Gate-4 visual-story review (s03 C1, "settle residue to rest before
    // entry"): an instant (duration 0) tween is a hard snap, not a visible
    // frame — it runs before activateBeat()'s own b1 tween call in the
    // same synchronous pass, so the reader never sees it. It only changes
    // what the b1 resort animates FROM.
    if (typeof activate === 'function') activate('entryRest', { kind: 'instant' });

    const g = svg.append('g').attr('class', 's03-chart');
    const axisX = d3.axisBottom(x).ticks(6).tickSizeOuter(0);
    const axisY = d3.axisLeft(y).ticks(4).tickFormat((v) => fmt.usd(v)).tickSizeOuter(0);
    g.append('g')
      .attr('transform', `translate(0,${chartRect.y + chartRect.h})`)
      .attr('class', 'axis axis-x')
      .style('color', view.css('ink-low'))
      .style('font', `${view.tokens.typography.scale.find((s) => s.name === 'micro').size} var(--font-apparatus)`)
      .call(axisX);
    g.append('g')
      .attr('transform', `translate(${chartRect.x},0)`)
      .attr('class', 'axis axis-y')
      .style('color', view.css('ink-low'))
      .call(axisY);

    // Axis titles (design-revision-spec G3: every D3 axis names what it
    // measures, with a unit). X sits centered below its tick labels; Y
    // stays horizontal, left-aligned above its topmost tick.
    g.append('text').attr('class', 'axis-title axis-title-x')
      .attr('x', chartRect.x + chartRect.w / 2)
      .attr('y', chartRect.y + chartRect.h + 24 + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', view.css('ink-mid'))
      .style('font', `${view.css('type-caption-size')} var(--font-apparatus)`)
      .style('font-weight', 500)
      .text('tournament days (date)');
    g.append('text').attr('class', 'axis-title axis-title-y')
      .attr('x', chartRect.x)
      .attr('y', chartRect.y - 12)
      .attr('text-anchor', 'start')
      .attr('fill', view.css('ink-mid'))
      .style('font', `${view.css('type-caption-size')} var(--font-apparatus)`)
      .style('font-weight', 500)
      .text('total traded so far (dollars)');

    const lineFut = d3.line().x((d) => x(an.epochMs + d.day * 86400000)).y((d) => y(d.futUsd)).curve(d3.curveStepAfter);
    const lineMatch = d3.line().x((d) => x(an.epochMs + d.day * 86400000)).y((d) => y(d.matchUsd)).curve(d3.curveStepAfter);
    const lineTotal = d3.line().x((d) => x(an.epochMs + d.day * 86400000))
      .y((d) => y(d.futUsd + d.matchUsd)).curve(d3.curveStepAfter);

    // Gate-4 visual-story review (s03 C3): neither per-family line ever
    // reaches anywhere near the press-floor line on its own, so they step
    // back to dim context and a single combined line -- the SAME
    // quantity the counter shows and the press line marks -- becomes the
    // chart's one figure, the encoding the crossing is actually about.
    const pathFut = g.append('path').datum(points).attr('fill', 'none')
      .attr('stroke', view.css(FAMILY_COLOR.futures)).attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4).attr('d', lineFut);
    const pathMatch = g.append('path').datum(points).attr('fill', 'none')
      .attr('stroke', view.css(FAMILY_COLOR.match)).attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4).attr('d', lineMatch);
    const pathTotal = g.append('path').datum(points).attr('fill', 'none')
      .attr('stroke', view.css('ink-hero')).attr('stroke-width', 2.5).attr('d', lineTotal);

    // Press-floor dashed reference line, per storyboard: "a horizontal
    // marker labeled 'press floor, ~one week stale' at $7.4B."
    // Gate-4 visual-story review (s03 C2, "stage the $7.4B crossing on the
    // counter"): the line and its label start invisible (opacity 0, not
    // display:none, so a d3 transition can fade them) and are revealed
    // exactly when the counter's own animated number passes pf.usd — see
    // setCounter()'s onCross hook below. That is the scene's one staged
    // event on step 3: the counter is the figure, the line is its proof.
    const pf = sj.press_floor || null;
    let pfLine = null, pfLabel = null, crossDot = null;
    if (pf) {
      pfLine = g.append('line')
        .attr('x1', chartRect.x).attr('x2', chartRect.x + chartRect.w)
        .attr('y1', y(pf.usd)).attr('y2', y(pf.usd))
        .attr('stroke', view.css('ink-mid')).attr('stroke-dasharray', '4,4').attr('stroke-width', 1)
        .style('opacity', 0);
      // Gate-4 visual-story review (s03 critical, "$7.4B crossing is
      // mute"): the reference line now carries its dollar figure and its
      // meaning in the label, anchored at the LEFT end of the line where
      // the KEY panel (top-right) can never occlude it.
      pfLabel = g.append('text')
        .attr('x', chartRect.x + 8)
        .attr('text-anchor', 'start')
        .attr('fill', view.css('ink-mid'))
        .style('font', `${view.tokens.typography.scale.find((s) => s.name === 'caption').size} var(--font-apparatus)`)
        .style('opacity', 0);
      if (view.mobile) {
        // Mobile layout audit (390px, pair s03/b1): the short mobile
        // chart (region.h * 0.16) puts y(pf.usd) on the same text row as
        // the amber crossover label pinned at chartRect.y + 12, and the
        // one-line label is nearly chart-wide, so the two collided
        // (~227x6 px) whenever both are shown (b2 reveals the dim floor
        // line under the amber annotation; b3 brightens both). Drop the
        // label BELOW its dashed line and wrap it into two tspans (the
        // s01 pretitle-caption wrap pattern): the amber row above stays
        // clear, and the shorter lines keep the tail clear of the
        // crossing dot at the chart's right edge. The clamp keeps the
        // second line inside the chart at any region height; fills and
        // opacity set on the parent <text> inherit to the tspans, so
        // step()'s reveal/brighten transitions are unchanged.
        const lineH = 15;
        const yTop = Math.min(y(pf.usd) + 14, chartRect.y + chartRect.h - lineH - 4);
        pfLabel.attr('y', yTop);
        pfLabel.append('tspan')
          .attr('x', chartRect.x + 8).attr('dy', 0)
          .text(`${fmt.usd(pf.usd)}: the press number,`);
        pfLabel.append('tspan')
          .attr('x', chartRect.x + 8).attr('dy', lineH)
          .text('about one week stale');
      } else {
        pfLabel.attr('y', y(pf.usd) - 6)
          .text(`${fmt.usd(pf.usd)}: the press number, about one week stale`);
      }

      // Gate-4 visual-story review (s03 C3, "the strongest encoding
      // available -- position on a common scale -- is unused"): mark the
      // exact point where the total line passes the press floor, so the
      // crossing the beat narrates is a point the reader can see, not two
      // printed numbers ($X.XXB vs $7.40B) they have to compare by hand.
      const crossPt = points.find((p) => (p.futUsd + p.matchUsd) >= pf.usd) || points[points.length - 1];
      crossDot = g.append('circle')
        .attr('cx', x(an.epochMs + crossPt.day * 86400000))
        .attr('cy', y(crossPt.futUsd + crossPt.matchUsd))
        .attr('r', 4).attr('fill', view.css('ink-hero'))
        .style('opacity', 0);
    }

    // Crossover annotation. The scene's one amber unit, step 2 only
    // (design-revision-spec S3 §2); it decays to ink-mid on step 3, no
    // new amber unit replacing it (bright-unit ledger: step 3 carries
    // zero amber). Label kept to the 8-word annotation cap.
    const crossMs = tsMs(sj.crossover_end, null);
    let crossMark = null, crossLine = null, crossLabel = null;
    if (crossMs) {
      const crossX = x(crossMs);
      // Gate-4 visual-story review (s03 M5): the label used to open
      // rightward off a line that sits close to the domain's right edge,
      // clipping the piece's one amber singleton at the viewport border.
      // Flip it to open leftward whenever there is not enough room.
      const opensLeft = crossX > chartRect.x + chartRect.w - 150;
      crossMark = g.append('g').attr('class', 's03-crossover');
      crossLine = crossMark.append('line')
        .attr('x1', crossX).attr('x2', crossX)
        .attr('y1', chartRect.y).attr('y2', chartRect.y + chartRect.h)
        .attr('stroke', view.css('accent-annotation')).attr('stroke-width', 1.5);
      crossLabel = crossMark.append('text')
        .attr('x', crossX + (opensLeft ? -6 : 6)).attr('y', chartRect.y + 12)
        .attr('text-anchor', opensLeft ? 'end' : 'start')
        .attr('fill', view.css('accent-annotation'))
        .style('font', `${view.tokens.typography.scale.find((s) => s.name === 'annotation').size} var(--font-apparatus)`)
        .text('day two: match markets catch up');
      crossMark.style('display', 'none');
    }

    // The demoted-share caption (structure-spec S3 b3: the in-tournament
    // share figure moves out of prose into a caption). One pinned
    // Zone-K-weight line, ink-mid, shown only once the tape has climbed
    // past the press floor (step 3).
    // Gate-5 provenance audit (WRONG_VALUE, "98.6%" was a frozen dossier
    // citation with zero check_figure_sync coverage): computed live here
    // off the already-loaded population tile's own per-dot dollars/
    // birth_ts, against the tournament's opening day boundary (June 11,
    // 2026 UTC -- the same "day one" boundary s03.json's day1_end
    // closes), so the figure can never drift stale against a re-pulled
    // tape the way a hardcoded literal did.
    const KICKOFF_MS = Date.UTC(2026, 5, 11);
    let beforeKickoffUsd = 0;
    let afterKickoffUsd = 0;
    for (let i = 0; i < an.N; i++) {
      const usd = data.pop.dollars[i];
      if (an.birthMs[i] < KICKOFF_MS) beforeKickoffUsd += usd; else afterKickoffUsd += usd;
    }
    const shareTotal = beforeKickoffUsd + afterKickoffUsd;
    const afterSharePct = shareTotal ? (afterKickoffUsd / shareTotal * 100) : null;
    const shareCaption = g.append('text').attr('class', 's03-share-caption')
      .attr('x', chartRect.x).attr('y', chartRect.y + chartRect.h + 24 + 12 + 18)
      .attr('fill', view.css('ink-mid'))
      .style('font', `${view.css('type-caption-size')} var(--font-apparatus)`)
      .text(afterSharePct != null
        ? `${afterSharePct.toFixed(1)}% of everything on this tape traded after kickoff.`
        : '')
      .style('display', 'none');

    // Gate-4 visual-story review (s03 C1/M4, "the floor bars are an
    // unexplained encoding" / "the resting state itself must carry the
    // comparison"): a direct, always-legible label at each column's base
    // states its category and running total, so the settled frame reads
    // correctly even where the dot-count delta between beats is only a
    // few pixels tall. Desktop only (the reviewed layout); geometry
    // mirrors layout()'s desktop branch -- overlay() cannot read layout()'s
    // locals under the pure-fn contract (see file header), the same
    // constraint analyzePopulation() already works around above.
    const mobile = view.mobile;
    const region = view.region;
    let futLabelVal = null, matchLabelVal = null;
    if (!mobile) {
      const futCenterX = region.x + region.w * 0.27;
      const matchCenterX = region.x + region.w * 0.73;
      const baseY = region.y + region.h * 0.94;
      const microFont = `${view.tokens.typography.scale.find((s) => s.name === 'micro').size} var(--font-apparatus)`;
      const valFont = `600 ${view.tokens.typography.scale.find((s) => s.name === 'annotation').size} var(--font-apparatus)`;

      const futG = g.append('g').attr('class', 's03-col-label').attr('transform', `translate(${futCenterX},${baseY + 22})`);
      futG.append('text').attr('text-anchor', 'middle').attr('y', 0)
        .attr('fill', view.css('ink-low')).style('font', microFont)
        .style('letter-spacing', '0.02em').style('text-transform', 'uppercase')
        .text('winner bets');
      futLabelVal = futG.append('text').attr('text-anchor', 'middle').attr('y', 18)
        .attr('fill', view.css(FAMILY_COLOR.futures)).style('font', valFont).text(fmt.usd(0));

      const matchG = g.append('g').attr('class', 's03-col-label').attr('transform', `translate(${matchCenterX},${baseY + 22})`);
      matchG.append('text').attr('text-anchor', 'middle').attr('y', 0)
        .attr('fill', view.css('ink-low')).style('font', microFont)
        .style('letter-spacing', '0.02em').style('text-transform', 'uppercase')
        .text('match bets');
      matchLabelVal = matchG.append('text').attr('text-anchor', 'middle').attr('y', 18)
        .attr('fill', view.css(FAMILY_COLOR.match)).style('font', valFont).text(fmt.usd(0));
    }

    // Gate-4 visual-story review (s03 M3): a persistent micro-label binds
    // the counter to its referent (Gestalt proximity for label-referent
    // binding) so it never reads as an ambient, unexplained UI clock.
    // Extra clearance beyond the KEY-EXCLUSION-H token: the token (132px)
    // reserves less than the panel's actual rendered height once its
    // three two-line rows are laid out (observed ~180px), so the fixed
    // offset undershoots and the label ends up drawn behind the panel.
    const counterLabelEl = html.append('div').attr('class', 's03-counter-label')
      .style('position', 'absolute')
      .style('right', 'var(--space-24)')
      .style('top', 'calc(var(--layout-key-exclusion-h-px) + var(--space-24) + var(--space-48))')
      .style('font-family', 'var(--font-apparatus)')
      .style('font-size', 'var(--type-micro-size)')
      .style('font-weight', '500')
      .style('letter-spacing', '0.02em')
      .style('text-transform', 'uppercase')
      .style('color', 'var(--ink-low)')
      .style('text-align', 'right')
      .style('pointer-events', 'none')
      .text('the tape’s running total');

    // The running dollar counter — the scene's protagonist number, but
    // only in b3 (its own beat). Moved to the stage's top-right
    // (design-revision-spec S3 §1), clear of the KEY RECT (G5): ink-hi,
    // not amber, so motion (not the reserved annotation hue) carries the
    // attention.
    // Gate-4 visual-story review (s03 M3, "the counter owns the
    // luminance peak in nearly every frame even when the beat's figure is
    // elsewhere"): it now starts at a demoted size/weight (b1's figure is
    // the two piles, b2's is the reversal) and is promoted to the large,
    // bright reading only inside setCounterProminence(true) at b3.
    const counterEl = html.append('div').attr('class', 'interactive s03-counter')
      .style('position', 'absolute')
      .style('right', 'var(--space-24)')
      .style('top', 'calc(var(--layout-key-exclusion-h-px) + var(--space-24) + var(--space-48) + var(--space-16))')
      .style('font-family', 'var(--font-apparatus)')
      .style('font-weight', '500')
      .style('font-size', 'clamp(20px, 2.6vw, 30px)')
      .style('color', 'var(--ink-mid)')
      .style('font-variant-numeric', 'tabular-nums lining-nums')
      .style('text-align', 'right')
      .style('pointer-events', 'none');

    // Gate-4 visual-story review (s03 M3): promote the counter's own
    // weight only in b3 -- its own beat -- so it stops out-competing b1's
    // flood and b2's reversal for the frame's one luminance peak.
    function setCounterProminence(active) {
      counterEl
        .style('font-size', active ? 'clamp(28px, 4vw, 48px)' : 'clamp(20px, 2.6vw, 30px)')
        .style('font-weight', active ? '600' : '500')
        .style('color', active ? 'var(--ink-hi)' : 'var(--ink-mid)');
    }

    // Gate-4 visual-story review (s03 C2): a brief white flash on the
    // numerals themselves — the counter is ink-hi, never amber (motion,
    // not the reserved annotation hue, carries this scene's attention),
    // so the onset borrows the one brighter rung available, ink-hero.
    function flashCounter() {
      counterEl.interrupt().style('color', 'var(--ink-hero)');
      counterEl.transition().delay(120).duration(400).style('color', 'var(--ink-hi)');
    }

    let raf = null;
    let shown = 0;
    // `opts.crossValue`/`opts.onCross` (s03 C2): fires once, the instant
    // the animated numeral passes a threshold — used to stage the $7.40B
    // press-floor line's reveal exactly on the counter's own crossing,
    // instead of showing the line statically from the beat's first frame.
    function setCounter(target, animate, opts = {}) {
      const { crossValue = null, onCross = null } = opts;
      if (raf) cancelAnimationFrame(raf);
      if (!animate || view.reducedMotion) {
        shown = target;
        counterEl.text(fmt.usd(shown)).classed('fade-in', true);
        if (crossValue != null && shown >= crossValue && onCross) onCross(true);
        return;
      }
      const start = shown, t0 = performance.now();
      // Gate-4 visual-story review (s03 C2): the counter used to finish
      // its count-up (1200ms) well before the population's own resort
      // tween (1700ms + stagger) had moved the dots that number
      // represents, so the numeral raced ahead of a field that had not
      // visibly changed yet -- "money appears in no visible form." Match
      // the counter's nominal duration to the resort tween's instead.
      const dur = view.tokens.motion.durations_ms['resort-total-target']
        || view.tokens.motion.durations_ms['counter-count-up-max'] || 1200;
      let crossed = crossValue == null || start >= crossValue;
      if (crossed && crossValue != null && onCross) onCross(true);
      function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        shown = start + (target - start) * p;
        counterEl.text(fmt.usd(shown));
        if (!crossed && shown >= crossValue) {
          crossed = true;
          if (onCross) onCross(false);
        }
        if (p < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }

    function sumUpTo(cutoffMs) {
      let s = 0;
      for (let i = 0; i < an.N; i++) if (an.birthMs[i] <= cutoffMs) s += data.pop.dollars[i];
      return s;
    }

    // Feeds the column-base labels (s03 C1/M4): the same per-dot arrival
    // test as sumUpTo(), split by family, so each column's own label
    // matches exactly what that column's dots represent.
    function sumFamilyUpTo(cutoffMs, wantFutures) {
      let s = 0;
      for (let i = 0; i < an.N; i++) {
        if (an.birthMs[i] <= cutoffMs && (an.isFutures[i] === 1) === wantFutures) s += data.pop.dollars[i];
      }
      return s;
    }

    return {
      step(beatId) {
        if (beatId === 'b1') {
          setCounterProminence(false);
          const cut = tsMs(sj.day1_end, an.epochMs);
          setCounter(sumUpTo(cut), true);
          if (pfLine) {
            pfLine.interrupt().style('display', 'none').style('opacity', 0).attr('stroke', view.css('ink-mid'));
            pfLabel.interrupt().style('display', 'none').style('opacity', 0).attr('fill', view.css('ink-mid'));
          }
          if (crossMark) crossMark.style('display', 'none');
          if (crossDot) crossDot.interrupt().style('opacity', 0).attr('r', 4);
          shareCaption.style('display', 'none');
          if (futLabelVal) {
            futLabelVal.text(fmt.usd(sumFamilyUpTo(cut, true)));
            matchLabelVal.text(fmt.usd(sumFamilyUpTo(cut, false)));
          }
        } else if (beatId === 'b2') {
          setCounterProminence(false);
          const cut = tsMs(sj.crossover_end, an.epochMs);
          setCounter(sumUpTo(cut), true);
          if (crossMark) crossMark.style('display', null);
          // Gate-4 visual-story review (s03 M1, "pre-announced element
          // arrives late and doubled-up"): the beat's own prose says
          // "watch the counter pass the grey dashed line," so the line
          // now appears here, quietly (dim, ink-mid, no flash) -- context
          // set before any climb happens. b3 only brightens it, at the
          // crossing, as that beat's sole change.
          if (pfLine) {
            pfLine.interrupt().style('display', null).attr('stroke', view.css('ink-mid'))
              .transition().duration(300).style('opacity', 0.55);
            pfLabel.interrupt().style('display', null).attr('fill', view.css('ink-mid'))
              .transition().duration(300).style('opacity', 0.55);
          }
          if (crossDot) crossDot.interrupt().style('opacity', 0).attr('r', 4);
          shareCaption.style('display', 'none');
          if (futLabelVal) {
            futLabelVal.text(fmt.usd(sumFamilyUpTo(cut, true)));
            matchLabelVal.text(fmt.usd(sumFamilyUpTo(cut, false)));
          }
        } else if (beatId === 'b3') {
          setCounterProminence(true);
          const finalTotal = (data.manifest.census && data.manifest.census.total_usd) || sumUpTo(Infinity);
          setCounter(finalTotal, true, pf ? {
            crossValue: pf.usd,
            onCross(instant) {
              const dur = (instant || view.reducedMotion) ? 0 : 400;
              pfLine.transition().duration(dur).style('opacity', 1).attr('stroke', view.css('ink-hi'));
              pfLabel.transition().duration(dur).style('opacity', 1).attr('fill', view.css('ink-hi'));
              if (crossDot) {
                crossDot.interrupt().style('opacity', 1).attr('r', 7)
                  .transition().delay(dur).duration(350).attr('r', 4);
              }
              if (!instant && !view.reducedMotion) flashCounter();
            },
          } : {});
          // Emphasis decay (G4): the one amber unit this scene ever shows
          // demotes to ink-mid here; no new amber replaces it.
          if (crossLine && crossLabel) {
            const dim = view.reducedMotion ? 0 : 550;
            crossLine.transition().duration(dim).attr('stroke', view.css('ink-mid'));
            crossLabel.transition().duration(dim).attr('fill', view.css('ink-mid'));
          }
          shareCaption.style('display', null);
          if (futLabelVal) {
            futLabelVal.text(fmt.usd(sumFamilyUpTo(Infinity, true)));
            matchLabelVal.text(fmt.usd(sumFamilyUpTo(Infinity, false)));
          }
        }
      },
      exit() {
        if (raf) cancelAnimationFrame(raf);
        g.remove();
        counterEl.remove();
        counterLabelEl.remove();
      },
    };
  },

  // Layout-audit disposition (round of 2026-07-21, desktop widths 1280/
  // 1440/1512): this scene's only flagged overlaps are the two fixed
  // chrome pills over a scrolling beat card at the audit's mid-active
  // stop -- #grain-plate x card (all beats) and a.skip x card (a
  // neighboring card's tail/head in the corner at 1280/1512). Both are
  // the documented-accepted scrim case, not defects: the chrome is the
  // upper element (tokens.css --z-prose-card 3 < --z-chip-and-grain-plate
  // 4 < --z-skip-controls 5) and each carries the 0.82 bg + blur(8px)
  // scrim treatment (index.html #grain-plate rule; .skip rule per Gate-5
  // item 3 disposition 2), so the pill reads cleanly over blurred prose
  // during the pass-under; index.html's .card comment records the same
  // plate-x-card audit hits as benign at the reading rest. Nothing in
  // this module positions either pill or the card, so no code change
  // here could (or should) alter that geometry.
  beats: [
    {
      id: 'b1',
      html: '<p>The tournament kicked off, and the money poured in all at once. Watch two towers grow: one for bets on the tournament winner, one for bets on single matches.</p>',
      trigger: 'step',
      state: 'day1',
      kind: 'resort',
      chip: [
        { token: 'identity-teal', glyph: 'dot', label: 'teal = bets on the tournament winner' },
        { token: 'identity-lavender', glyph: 'dot', label: 'lavender = bets on single matches' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      grain: { text: '1 dot = {grainUsd} of real money traded' },
    },
    {
      id: 'b2',
      html: '<p>Match markets are bets on a single game. They cannot open until the schedule is set, so kickoff created thousands of them at once. On day one alone, those match markets traded 49.4 million contracts. The tournament-winner market, open for a whole year already, traded only 31.6 million that same day.<sup><a href="#fn-4">4</a></sup> By day two, match markets had out-traded everything the winner market sold across its entire fourteen-month history. The winner market sped up too, trading about ninety times faster than before the tournament began.<sup><a href="#fn-4">4</a></sup> Next, watch the counter pass the grey dashed line.</p>',
      trigger: 'step',
      state: 'crossover',
      kind: 'resort',
    },
    {
      id: 'b3',
      html: '<p>The counter just passed the press number and kept climbing. The tape, the exchange&rsquo;s trade-by-trade record you met at the start, is also its complete receipt: every trade it ever cleared, kept forever. This counter is the tape&rsquo;s running total. By July 8 that total reached $10.94 billion. By the tape&rsquo;s final tally, it reached $12.75 billion.<sup><a href="#fn-5">5</a></sup> Each contract is a one-dollar box: the yes side puts in its price, the no side puts in the rest. Count the filled boxes and you have counted the dollars: $12.75 billion means 12.75 billion boxes. Newspapers had reported &ldquo;$7.4 billion,&rdquo; which is 7.4 billion boxes.<sup><a href="#fn-5">5</a></sup> That number was not the press measuring the market. It was the exchange&rsquo;s own running total from around June 30. Newspapers republished it about a week later, on July 8. A receipt only ever grows, so any dated total is really a floor, not a ceiling.</p>',
      trigger: 'step',
      state: 'snapshot',
      kind: 'resort',
    },
  ],

  // Reduced motion: engine-level instant + crossfade already satisfies
  // "no dot ever moves"; the counter's own count-up is skipped in favor
  // of an immediate value + fade (handled inside setCounter() above via
  // view.reducedMotion), so no state substitution is needed here.
};
