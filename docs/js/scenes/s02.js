/* s02.js — "Thirteen months, asleep" (storyboard Act 0, S2)
 *
 * Contract: docs/CONTRACT.md §4 (scene shape), §4.2 (registry row:
 * timeline-ribbon, scrub, no zoom tile; "re-merge narrated; density spans
 * governed by §3.4"), §3.4 (density tone-mapping — this scene is the
 * design system's own worked example: draw-week vs match-day spans
 * ~3,400x contracts / ~21,000x dollars, §7 of research/design-system.md).
 * Design: research/design-system.md §9 "S2" (Grain Plate "return" variant;
 * family color muted/low-sat; mobile timeline rotates vertical).
 *
 * Object constancy: this scene's resting-field position formula is
 * DELIBERATELY identical to s01.js's (same bucket/stack algorithm, same
 * view.region, same per-dot identity = population tile row index), so
 * the "S1 tick dots shrink and merge back into their place in the
 * resting field the reader saw before the title" beat is a literal
 * return to the same coordinates, not an approximation. (CONTRACT §2
 * bars scenes from importing each other outside S16's anchor reuse, so
 * the formula is duplicated here rather than shared — see s01.js for the
 * twin copy.)
 */

import { registry, makeState, setColor, durationMs } from '../shared.js';

const BUCKET_PX = 4;
const DRAW_WEEK_MS = Date.UTC(2025, 11, 5);      // Dec 5, 2025 — fixed WC-2026 draw date
const FINAL_MS = Date.UTC(2026, 6, 19);          // Jul 19, 2026 — fixed WC-2026 final date

function hash01(i) {
  let x = (i + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 100000) / 100000;
}

/* Twin of s01.js's restingFieldPositions — see that file's header comment
 * for why this is intentionally duplicated rather than shared. */
function restingFieldPositions(N, region, mobile, xOf) {
  const timeExtent = mobile ? region.h : region.w;
  const timeOrigin = mobile ? region.y : region.x;
  const stackExtent = mobile ? region.w : region.h;
  const stackOrigin = mobile ? region.x : region.y;
  const nBuckets = Math.max(40, Math.round(timeExtent / BUCKET_PX));

  const bucketOf = new Int32Array(N);
  const counts = new Int32Array(nBuckets);
  for (let i = 0; i < N; i++) {
    const px = xOf(i);
    let b = Math.floor(((px - timeOrigin) / timeExtent) * nBuckets);
    if (b < 0) b = 0; else if (b >= nBuckets) b = nBuckets - 1;
    bucketOf[i] = b;
    counts[b]++;
  }
  const rankInBucket = new Int32Array(N);
  const seen = new Int32Array(nBuckets);
  for (let i = 0; i < N; i++) {
    const b = bucketOf[i];
    rankInBucket[i] = seen[b]++;
  }

  const x = new Float32Array(N);
  const y = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const b = bucketOf[i];
    const count = counts[b];
    const rank = rankInBucket[i];
    const tPos = timeOrigin + (b + 0.5) * (timeExtent / nBuckets);
    const norm = count > 1 ? rank / (count - 1) - 0.5 : 0;
    const halfSpread = Math.min(stackExtent / 2 - 4, 5 * Math.sqrt(count));
    const jitter = (hash01(i) - 0.5) * 3;
    const sPos = stackOrigin + stackExtent / 2 + norm * 2 * halfSpread + jitter;
    if (mobile) { x[i] = sPos; y[i] = tPos; } else { x[i] = tPos; y[i] = sPos; }
  }
  return { x, y };
}

export default {
  id: 's02',
  act: 0,
  title: 'Thirteen months, asleep',
  layoutName: 'timeline-ribbon',

  needs: { scene: false, series: [], zoom: null },

  scales(data, view) {
    const { manifest } = data;
    const region = view.region;
    const epochMs = new Date(manifest.epoch).getTime();
    const frozenMs = new Date(manifest.frozen_at || manifest.generated).getTime();
    // Domain extends at least through the final (Jul 19) so the dimmed
    // "the final" marker sits inside the drawn axis even when the deploy
    // snapshot (frozen_at) predates it.
    const domainEnd = Math.max(frozenMs, FINAL_MS + 86400000);
    const range = view.mobile
      ? [region.y, region.y + region.h]
      : [region.x, region.x + region.w];
    const timeX = d3.scaleUtc().domain([epochMs, domainEnd]).range(range);
    registry.register('s02.time', timeX);
    return { timeX, epochMs, frozenMs, domainEnd };
  },

  layout(data, view) {
    const { manifest, pop } = data;
    const N = pop.count;
    const region = view.region;
    const timeX = registry.get('s02.time');
    const epochMs = new Date(manifest.epoch).getTime();
    const frozenMs = new Date(manifest.frozen_at || manifest.generated).getTime();
    const domainEnd = Math.max(frozenMs, FINAL_MS + 86400000);

    const restPos = restingFieldPositions(
      N, region, view.mobile,
      (i) => timeX(epochMs + pop.birth_ts[i] * 1000),
    );

    const BASE_PX = view.tokens.dot['radius-base-px'] * 2;
    const restColor = view.state('rest'); // 0.35 -> rest-tier: engine dims it
    // Color: contract family (futures vs everything else). REVISION
    // (perception-brief §9b, §10.1): the winner-futures family is this scene's
    // subject, so it is the ACTIVE subset and has to pick out of the field.
    // The prior build tinted it muted cyan at alpha 0.30 -- below even the rest
    // field's 0.35, separated from it by hue alone, which the brief showed
    // reads ~isoluminant (side.yes vs field.rest ~1.20:1) and does not pop.
    // The fix keeps the same cyan hue (the chip re-narrates it away from S1's
    // "taker YES" meaning, per design-system §6's team-vs-semantic discipline)
    // and lifts its alpha into the active band (opacity-alive), so the engine
    // boosts the winner-book thread's luminance above the dimmed rest of the
    // market. Hue unchanged, luminance fixed -- exactly the brief's fix. Dot
    // size stays fixed (unit grammar); the pop rides on alpha and the shader.
    const futuresColor = view.color('side-yes', view.tokens.dot['opacity-alive']); // active-tier
    const invisible = [0, 0, 0, 0];
    const futuresIdx = manifest.enums.family.indexOf('winner_futures');

    // Reveal envelope: draw week is already visible at k0 ("one visible
    // flicker at draw week" is the FIRST thing on screen); the June-11
    // wall is withheld until the final increments (storyboard Scroll
    // spec: "the June 11 wall is deliberately withheld until the final
    // scroll increment — gold-coin placement"). Dots beyond the reveal
    // cutoff are never moved or destroyed (population constancy) — they
    // simply sit at alpha 0 at their already-final bucket position until
    // their moment in history is reached, then fade in in place.
    const bp = [
      { at: 0.00, cutoff: DRAW_WEEK_MS + 14 * 86400000 },
      { at: 0.30, cutoff: Date.UTC(2026, 2, 1) },
      { at: 0.55, cutoff: Date.UTC(2026, 4, 15) },
      { at: 0.78, cutoff: Date.UTC(2026, 5, 1) },  // just before the wall — withheld
      { at: 0.92, cutoff: Date.UTC(2026, 5, 20) }, // the wall bursts into view
      { at: 1.00, cutoff: domainEnd },
    ];

    function stateAtCutoff(cutoffMs) {
      const s = makeState(N);
      for (let i = 0; i < N; i++) {
        s.x[i] = restPos.x[i]; s.y[i] = restPos.y[i];
        s.size[i] = BASE_PX;
        const revealed = epochMs + pop.birth_ts[i] * 1000 <= cutoffMs;
        if (!revealed) { setColor(s.color, i, invisible); continue; }
        setColor(s.color, i, pop.family[i] === futuresIdx ? futuresColor : restColor);
      }
      return s;
    }

    const states = {};
    bp.forEach((b, idx) => { states[`k${idx}`] = stateAtCutoff(b.cutoff); });
    const keyframes = bp.map((b, idx) => ({ at: b.at, state: `k${idx}` }));
    return { states, keyframes };
  },

  overlay(container, data, view, scales) {
    const { svg } = container;
    const { timeX, frozenMs } = scales;
    const tokens = view.tokens;
    const drawIn = durationMs(tokens, 'overlay-draw-in');

    const g = svg.append('g').attr('class', 's02-overlay');

    const axisG = g.append('g').attr('class', 'axis axis-time')
      .attr('transform', view.mobile
        ? `translate(${view.region.x - 8}, 0)`
        : `translate(0, ${view.region.y + view.region.h + 8})`);
    const axis = view.mobile
      ? d3.axisLeft(timeX).ticks(d3.utcMonth.every(2)).tickFormat(d3.utcFormat('%b %y'))
      : d3.axisBottom(timeX).ticks(d3.utcMonth.every(2)).tickFormat(d3.utcFormat('%b %y'));
    axisG.call(axis);
    axisG.selectAll('text')
      .attr('fill', view.css('ink-mid'))
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-micro-size'));
    axisG.selectAll('path,line').attr('stroke', view.css('ink-low'));

    // Three reference marks (storyboard overlay spec): draw-week (a real
    // narrative beat, so it gets the amber "look here" treatment), "you
    // are here" (the deploy snapshot), and a dimmed "the final" marker.
    // These cascade in at different scrub thresholds rather than
    // appearing simultaneously, so the token guidance on annotation count
    // per discrete step (CONTRACT §4.5, tokens layout.max-annotations-
    // per-step = 2) is respected in spirit for a continuous scrub scene.
    function markerAt(ms, color, dash, label, weight) {
      const pos = timeX(ms);
      const grp = g.append('g').attr('class', 'marker').style('opacity', 0);
      if (view.mobile) {
        grp.append('line')
          .attr('x1', view.region.x).attr('x2', view.region.x + view.region.w)
          .attr('y1', pos).attr('y2', pos)
          .attr('stroke', color).attr('stroke-dasharray', dash || null)
          .attr('opacity', weight);
        grp.append('text')
          .attr('x', view.region.x + view.region.w).attr('y', pos - 6)
          .attr('text-anchor', 'end').attr('fill', color).attr('opacity', weight)
          .text(label);
      } else {
        grp.append('line')
          .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
          .attr('x1', pos).attr('x2', pos)
          .attr('stroke', color).attr('stroke-dasharray', dash || null)
          .attr('opacity', weight);
        grp.append('text')
          .attr('x', pos + 6).attr('y', view.region.y + 14)
          .attr('fill', color).attr('opacity', weight)
          .text(label);
      }
      grp.selectAll('text')
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-annotation-size'));
      return grp;
    }

    const drawWeekMarker = markerAt(
      DRAW_WEEK_MS, view.css('accent-annotation'), null, 'December 5: the twitch', 1,
    );
    const hereMarker = markerAt(
      frozenMs, view.css('ink-mid'), '2,3', 'you are here', 1,
    );
    const finalMarker = markerAt(
      FINAL_MS, view.css('ink-low'), '1,4', 'the final', 0.6, // dimmed: a future date
    );

    function fadeIn(sel) { sel.transition().duration(drawIn).style('opacity', 1); }

    return {
      step() { fadeIn(drawWeekMarker); },
      scrub(t) {
        if (t > 0.02) fadeIn(drawWeekMarker);
        if (t > 0.85) fadeIn(hereMarker);
        if (t > 0.95) fadeIn(finalMarker);
      },
      exit() { g.remove(); },
    };
  },

  // Reduced motion: as with s01.js, this is a single-beat scrub scene, so
  // the driver's generic stepped-keyframe-crossfade handling (CONTRACT
  // §3.5/§9) already covers it — every k0..k5 snapshot above is a
  // complete, static-readable frame. No per-beat override declared.

  beats: [
    {
      id: 'b1',
      html: `<p>A book is one market's running ledger of live orders, and the winner book is the single market for who lifts the trophy. It opened in May 2025 and then did almost nothing for a year. The December draw, the moment the tournament became concrete, registers as a twitch: 190,000 contracts on the day, and the cleaner fingerprint is participation, 176 mostly small trades in the reveal hour.<sup><a href="#fn-3">3</a></sup> A market can be sized two ways: by contracts, each a one-dollar bet, and by premium, the dollars actually paid at the prices those bets traded. The two move apart when prices themselves climb. Peak match day would eventually run about 3,400 times larger in contracts and roughly 21,000 times larger in premium dollars.<sup><a href="#fn-3">3</a></sup> A market is not a poll that runs continuously; it is a crowd that shows up when something is at stake.</p>`,
      trigger: { type: 'scrub', span: 3 },
      state: 'k0',
      kind: 'instant', // see s01.js comment: scrub fine-motion is driven by keyframes, not `kind`
      // Micro-legend names the color's referent, not just "contract family":
      // the lit cyan thread is the winner book (grounded by this beat's own
      // opening gloss); the dimmed field is everything else trading.
      chip: 'cyan: the winner book · grey: every other market',
      grain: {
        // Storyboard-verbatim "return" narration (CONTRACT §7 "return"
        // variant on re-merge). The literal $75,000 figure is the value
        // this storyboard drafted and matches CONTRACT §5.1's own
        // manifest.population.desktop.grain_text example; it is a
        // deploy-frozen figure like the rest of this beat's prose (see
        // module data_requests note on beat.grain.text being a static
        // field with no data-slot equivalent today).
        text: 'one dot again stands for $75,000 of traded volume; the population on this screen is the entire tournament, and it never leaves',
        variant: 'return',
      },
      overlayStep: 'b1',
    },
  ],
};
