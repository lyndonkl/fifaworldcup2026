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
 * GATE-4 ROUND-2 REVISION (structure-spec §5 S2 / design-revision-spec §2
 * S2): kicker "Skill 1, continued — a price needs a crowd"; prose
 * rewritten to eighth-grade level, closing the act with two one-line
 * "skill unlocked" / "receipt" cards; the June 11 kickoff wall becomes the
 * scene's one amber unit, withheld until the final scroll increment (a
 * "keep your eye on the far right" cue precedes it); the December 5 draw
 * marker demotes from amber to ink-mid so amber stays a true singleton.
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
const WALL_MS = Date.UTC(2026, 5, 11);           // Jun 11, 2026 — the tournament's opening match, the density wall
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
  // Piece-wide spine (structure-spec §2/§3): S2 finishes the skill S1
  // opened.
  kicker: 'Skill 1, continued — a price needs a crowd',
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
    // Color: contract family (futures vs everything else). This scene's
    // subject is the winner-futures book, so it is the ACTIVE subset and
    // has to pick out of the field. Per perception-brief §9b/§10.1: keep
    // the cyan hue (the key re-narrates it away from S1's "yes" meaning)
    // but lift its alpha into the active band (opacity-alive) so the
    // engine boosts the winner-book thread's luminance above the dimmed
    // rest of the market — hue unchanged, luminance fixed. Dot size stays
    // fixed (unit grammar); the pop rides on alpha and the shader.
    const futuresColor = view.color('side-yes', view.tokens.dot['opacity-alive']); // active-tier
    const invisible = [0, 0, 0, 0];
    const futuresIdx = manifest.enums.family.indexOf('winner_futures');

    // Reveal envelope: draw week is already visible at k0 ("one visible
    // flicker at draw week" is the FIRST thing on screen); the June 11
    // wall is deliberately withheld until the final scroll increment
    // (design-revision-spec §2 S2: "keep your eye on the far right").
    // Dots beyond the reveal cutoff are never moved or destroyed
    // (population constancy) — they simply sit at alpha 0 at their
    // already-final bucket position until their moment in history is
    // reached, then fade in in place.
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

    // G3 axis-label standard: a titled unit on every axis, plain words.
    function titleStyle(sel) {
      sel.attr('fill', view.css('ink-mid'))
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-caption-size'))
        .style('font-weight', 500);
    }
    if (view.mobile) {
      const tx = view.region.x - 8 - 24;
      const ty = view.region.y + view.region.h / 2;
      titleStyle(g.append('text').attr('class', 'axis-title axis-title-time')
        .attr('x', tx).attr('y', ty).attr('text-anchor', 'middle')
        .attr('transform', `rotate(-90, ${tx}, ${ty})`)
        .text('from listing to the final (May 2025 to July 2026)'));
    } else {
      titleStyle(g.append('text').attr('class', 'axis-title axis-title-time')
        .attr('x', view.region.x + view.region.w / 2)
        .attr('y', view.region.y + view.region.h + 8 + 24)
        .attr('text-anchor', 'middle')
        .text('from listing to the final (May 2025 to July 2026)'));
    }

    // One stack-direction label at the ribbon's thickest point
    // (design-revision-spec §2 S2 item 4): the tournament's own opening
    // week is where the money piles up densest (Act 2's "the flood").
    const thickLabel = g.append('text').attr('class', 's02-thick-label')
      .style('opacity', 0);
    titleStyle(thickLabel);
    thickLabel.text('thicker = more money that day');
    if (view.mobile) {
      thickLabel.attr('x', view.region.x + view.region.w / 2 + 12)
        .attr('y', timeX(WALL_MS))
        .attr('text-anchor', 'start');
    } else {
      thickLabel.attr('x', timeX(WALL_MS))
        .attr('y', view.region.y + view.region.h / 2 - 12)
        .attr('text-anchor', 'middle');
    }

    // Reference marks (design-revision-spec §2 S2): draw-week and "you are
    // here" sit in ink-mid; the June 11 wall is the scene's one amber
    // unit, withheld until the final scroll increment; "the final" stays
    // dimmed, a future date. All sit above the ribbon (or left/right of
    // it on mobile) with an 8px standoff, never on it. "you are here" and
    // "the final" fall within days of each other on the time axis, so
    // they split above/below the ribbon rather than colliding.
    function markerAt(ms, color, dash, label, weight, opts) {
      opts = opts || {};
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
        const standoff = 8;
        const ly = opts.vpos === 'below'
          ? view.region.y + view.region.h + standoff + 14
          : view.region.y - standoff - 4;
        grp.append('line')
          .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
          .attr('x1', pos).attr('x2', pos)
          .attr('stroke', color).attr('stroke-dasharray', dash || null)
          .attr('opacity', weight);
        grp.append('text')
          .attr('x', pos + (opts.mirror ? -6 : 6))
          .attr('y', ly)
          .attr('text-anchor', opts.mirror ? 'end' : 'start')
          .attr('fill', color).attr('opacity', weight)
          .text(label);
      }
      grp.selectAll('text')
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-annotation-size'));
      return grp;
    }

    const drawWeekMarker = markerAt(
      DRAW_WEEK_MS, view.css('ink-mid'), null, 'December 5: the twitch', 1,
    );
    const wallMarker = markerAt(
      WALL_MS, view.css('accent-annotation'), null, 'June 11: the wall', 1, { mirror: true },
    );
    const hereMarker = markerAt(
      frozenMs, view.css('ink-mid'), '2,3', 'you are here', 1, { vpos: 'above' },
    );
    const finalMarker = markerAt(
      FINAL_MS, view.css('ink-low'), '1,4', 'the final', 0.6, { vpos: 'below' }, // dimmed: a future date
    );

    // Withholding + cue (design-revision-spec §2 S2 / perception-brief
    // §7): the last visible caption before the wall bursts into view.
    // Never names the wall before it appears.
    const watchCue = g.append('text').attr('class', 's02-watch-cue')
      .style('opacity', 0);
    titleStyle(watchCue);
    watchCue.attr('fill', view.css('ink-low')).text('Keep your eye on the far right.');
    if (view.mobile) {
      watchCue.attr('x', view.region.x).attr('y', view.region.y + view.region.h + 24)
        .attr('text-anchor', 'start');
    } else {
      watchCue.attr('x', view.region.x + view.region.w).attr('y', view.region.y - 24)
        .attr('text-anchor', 'end');
    }

    function fadeIn(sel) { sel.transition().duration(drawIn).style('opacity', 1); }
    function fadeOut(sel) { sel.transition().duration(drawIn).style('opacity', 0); }

    return {
      step() {
        fadeIn(drawWeekMarker);
        fadeIn(thickLabel);
      },
      scrub(t) {
        if (t > 0.02) { fadeIn(drawWeekMarker); fadeIn(thickLabel); }
        if (t > 0.7 && t < 0.92) fadeIn(watchCue); else fadeOut(watchCue);
        if (t >= 0.92) fadeIn(wallMarker); else fadeOut(wallMarker);
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
      html: `<p>This market is a bet on who lifts the trophy, and it is the only market on that question. It opened in May 2025. For almost a year, it barely moved. Even the December draw, the day teams learned their groups, only caused a small stir: 176 mostly small trades in the hour the draw happened.<sup><a href="#fn-3">3</a></sup> There are two ways to measure how busy a market is: count the tickets that changed hands, or add up the dollars that did. By the tournament's busiest match day, the market was trading about twenty-one thousand times more money each day than it had all the months before.<sup><a href="#fn-3">3</a></sup> A market like this is not a poll that runs all day, every day. It is a crowd. And a crowd only shows up when something is actually at stake.</p><p><strong>Skill unlocked.</strong> You can now read any price on this page as a chance out of a hundred, and check whether a real crowd of money stands behind it.</p><p><strong>The receipt.</strong> This market held a live price on France for thirteen months, then settled it to zero the moment the belief died. No poll can do that.</p>`,
      trigger: { type: 'scrub', span: 3 },
      state: 'k0',
      kind: 'instant', // see s01.js comment: scrub fine-motion is driven by keyframes, not `kind`
      // Micro-legend (G1): the lit cyan thread is the market on the
      // champion, grounded by this beat's own opening line; "book" is
      // untaught at this point in the piece (structure-spec §5 S2 item 1),
      // so the key avoids it too. The dimmed field is everything else
      // trading.
      chip: [
        { token: 'side-yes', glyph: 'dot', label: 'cyan = the market on the champion' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = every other market' },
      ],
      grain: {
        // "Return" variant (CONTRACT §7 / design-revision-spec CR-20): the
        // literal $75,000 figure matches CONTRACT §5.1's own manifest
        // example and is a deploy-frozen figure like the rest of this
        // beat's prose (see module data_requests note on beat.grain.text
        // being a static field with no data-slot equivalent today).
        text: '1 dot = $75,000 traded again · this is the whole tournament · it never leaves',
        variant: 'return',
      },
      overlayStep: 'b1',
    },
  ],
};
