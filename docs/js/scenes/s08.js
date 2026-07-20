/* docs/js/scenes/s08.js
 * S8 · Act II · "Which market you watch" (zoom)
 * storyboard.md §3 S8 · CONTRACT.md §4.2 row s08 (dual-path, scrub, zoom=gerpar)
 *
 * Vehicle: Germany-Paraguay, level after 90 (R4; settlement rule R4 honored
 * throughout). Two synchronized particle paths on one match clock: the
 * KXWCGAME GER leg (regulation) rides its 22-minute forced expiry glide to
 * the tie-locked settlement price; KXWCADVANCE holds level and trades dense
 * through the shootout for another hour. One path dies at the whistle; the
 * other lives on. Tick grain throughout ("one dot, one trade, both
 * contracts").
 *
 * Color is CONTRACT STATUS, not taker side (design-system.md audit FIX #1 /
 * §9 S8): the regulation leg fades state-expiring -> state-dead as its
 * price decays toward the tie-locked settlement value; the advancement leg
 * holds side-yes cyan throughout. The scene-local micro-legend chip reads
 * "color: contract status", never "color: taker side" -- reusing side-no
 * vermillion here would visually reinforce the naive "market abandoned
 * Germany" read the beat copy debunks.
 *
 * DATA_REQUEST: docs/data/scenes/s08.json (built from
 * pipeline/data/analysis/ingame-microstructure/shootout_ticks_JUN29GERPAR.parquet,
 * R4) needs fields the manifest's generic zoom spec does not carry: the
 * whistle instant itself (the regulation leg's glide begins exactly there,
 * and it anchors the scene's scroll dwell / gold-coin moment), plus the
 * regulation leg's own price at that instant (Gate-5 provenance audit --
 * b1's "48 cents" was a hand-typed dossier figure the raw tape does not
 * confirm at this exact anchor; the tape reads 43-44c here):
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "window": { "whistle_ts": ISO },
 *     "price_at_whistle_c": 44,   // GER regulation leg's last trade at or
 *                                  // before whistle_ts, class-A recompute
 *     "glide_minutes": 22         // R4's verified glide duration
 *   }
 * Per-kick markers do NOT need a data request: the zoom tile's own `flags`
 * bit 0 ("detector-anchored repricing event", CONTRACT §5.4) already tags
 * the ticks where the tape shows a kick's price cluster.
 */

import {
  registry, colorOf, particleState, indicesWithFlag, makeState, setColor,
} from '../shared.js';

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
function lerpRgba(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

// Shared scrub-reveal timeline (used by both layout()'s keyframes and
// overlay()'s progressive line draw, so the D3 lines and the particle
// reveal always agree on "how much of the tape has played").
function computeCuts(whistleTs, winStartMs, winEndMs) {
  return whistleTs
    ? [
      { at: 0.0, cutoff: winStartMs },
      { at: 0.35, cutoff: whistleTs - 30000 },
      { at: 0.55, cutoff: whistleTs + 150000 }, // the gold-coin dwell: paths visibly split
      { at: 1.0, cutoff: winEndMs },
    ]
    : [
      { at: 0.0, cutoff: winStartMs },
      { at: 1.0, cutoff: winEndMs },
    ];
}
function cutoffAt(cuts, t) {
  if (t <= cuts[0].at) return cuts[0].cutoff;
  for (let i = 1; i < cuts.length; i++) {
    if (t <= cuts[i].at) {
      const prev = cuts[i - 1];
      const span = cuts[i].at - prev.at;
      const frac = span > 0 ? (t - prev.at) / span : 1;
      return prev.cutoff + (cuts[i].cutoff - prev.cutoff) * frac;
    }
  }
  return cuts[cuts.length - 1].cutoff;
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

function findLegIndex(legs, re) {
  if (!legs) return -1;
  return legs.findIndex((l) => re.test(l.label || '') || re.test(l.ticker || ''));
}

export default {
  id: 's08',
  act: 2,
  title: 'Which market you watch',
  kicker: 'Skill 3, continued: check which ticket is talking',
  layoutName: 'dual-path',

  needs: { scene: true, series: [], zoom: 'gerpar' },

  zoom: {
    key: 'gerpar',
    tagBit: 'ZOOM_GERPAR',
    grainText: '1 dot = 1 trade · showing every {n}th of {count} trades · Germany-Paraguay, June 29',
  },

  scales(data, view) {
    const spec = data.manifest.zoom.gerpar;
    const winStart = spec ? new Date(spec.window[0]).getTime() : Date.now() - 3600000;
    const winEnd = spec ? new Date(spec.window[1]).getTime() : Date.now();
    const x = d3.scaleUtc().domain([winStart, winEnd])
      .range([view.region.x, view.region.x + view.region.w]);
    const laneH = view.region.h / 2;
    const pad = laneH * 0.1;
    const yReg = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + laneH - pad, view.region.y + pad]);
    const yAdv = d3.scaleLinear().domain([0, 100])
      .range([view.region.y + 2 * laneH - pad, view.region.y + laneH + pad]);
    registry.register('s08.x', x);
    registry.register('s08.yReg', yReg);
    registry.register('s08.yAdv', yAdv);
    return { x, yReg, yAdv, laneH, laneTop: { reg: view.region.y, adv: view.region.y + laneH } };
  },

  layout(data, view) {
    const { pop, manifest } = data;
    const N = pop.count;
    const state = makeState(N);
    const restRgba = particleState(view.tokens, 'dimmed-field-min');
    const baseSize = view.tokens.dot['radius-base-px'];
    for (let i = 0; i < N; i++) {
      const [rx, ry] = restFieldXY(i, view);
      state.x[i] = rx; state.y[i] = ry;
      setColor(state.color, i, restRgba);
      state.size[i] = baseSize;
    }

    const x = registry.get('s08.x');
    const yReg = registry.get('s08.yReg');
    const yAdv = registry.get('s08.yAdv');

    const expiring = particleState(view.tokens, 'expiring');
    const dead = particleState(view.tokens, 'dead');
    const advColor = colorOf(view.tokens, 'side-yes');

    const bit = data.flagBit('ZOOM_GERPAR');
    const tagged = indicesWithFlag(pop.flags, bit);
    const D = tagged.length;
    const tile = data.zoom.gerpar;
    const spec = manifest.zoom.gerpar;
    const T = tile ? tile.count : 0;

    let regIdx = -1; let advIdx = -1;
    if (spec && spec.legs) {
      advIdx = findLegIndex(spec.legs, /advance/i);
      regIdx = spec.legs.findIndex((l, i) => i !== advIdx);
    }

    // Partition tile rows by leg, proportional D allocation, each leg
    // sampled at its own runtime stride (CONTRACT §4.3 formula, per leg).
    const regRows = []; const advRows = [];
    if (tile) {
      for (let r = 0; r < T; r++) {
        if (tile.leg[r] === regIdx) regRows.push(r);
        else if (tile.leg[r] === advIdx) advRows.push(r);
      }
    }
    const Dreg = T ? Math.round(D * (regRows.length / T)) : 0;
    const Dadv = D - Dreg;

    const tickTs = new Float64Array(D);
    const tickLeg = new Uint8Array(D); // 0 = regulation, 1 = advancement

    function place(rows, count, offset, legFlag, yScale) {
      if (!count || !rows.length) return;
      const stride = Math.max(1, Math.ceil(rows.length / count));
      for (let i = 0; i < count; i++) {
        const row = rows[Math.min(i * stride, rows.length - 1)];
        const di = tagged[offset + i];
        const ts = tile.t0 + tile.ts_ms[row];
        tickTs[offset + i] = ts;
        tickLeg[offset + i] = legFlag;
        state.x[di] = x(ts);
        state.y[di] = yScale(tile.price_c[row]);
        if (legFlag === 0) {
          const t = Math.max(0, Math.min(1, 1 - tile.price_c[row] / 50));
          setColor(state.color, di, lerpRgba(expiring, dead, t));
        } else {
          setColor(state.color, di, advColor);
        }
        state.size[di] = 0; // hidden until reveal keyframe
      }
    }
    place(regRows, Dreg, 0, 0, yReg);
    place(advRows, Dadv, Dreg, 1, yAdv);

    const whistleTs = (data.scene && data.scene.window && data.scene.window.whistle_ts)
      ? new Date(data.scene.window.whistle_ts).getTime() : null;
    const winStartMs = spec ? new Date(spec.window[0]).getTime() : null;
    const winEndMs = spec ? new Date(spec.window[1]).getTime() : null;

    const cuts = computeCuts(whistleTs, winStartMs, winEndMs);

    const states = {};
    const keyframes = [];
    cuts.forEach((c, ci) => {
      const key = `k${ci}`;
      const s = { x: state.x, y: state.y, color: state.color, size: new Float32Array(N) };
      s.size.set(state.size);
      for (let i = 0; i < D; i++) {
        if (tickTs[i] && tickTs[i] <= c.cutoff) s.size[tagged[i]] = baseSize;
      }
      states[key] = s;
      keyframes.push({ at: c.at, state: key });
    });

    return { states, keyframes };
  },

  overlay(container, data, view, scales) {
    const { x, yReg, yAdv, laneTop, laneH } = scales;
    const g = container.svg;

    // Whistle instant, hoisted above the axis block so the x-axis can label
    // itself as match-clock minutes (kickoff ~= whistle - 90') rather than
    // raw clock time (G3).
    const whistleTs = data.scene && data.scene.window && data.scene.window.whistle_ts
      ? new Date(data.scene.window.whistle_ts).getTime() : null;
    const kickoffTs = whistleTs !== null ? whistleTs - 90 * 60000 : null;
    function matchMinuteLabel(d) {
      if (kickoffTs === null) return '';
      return `${Math.round((d.getTime() - kickoffTs) / 60000)}’`;
    }

    const axisG = g.append('g')
      .attr('transform', `translate(0,${view.region.y + view.region.h + 8})`)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisBottom(x).ticks(6).tickFormat(matchMinuteLabel));
    axisG.append('text')
      .attr('x', view.region.x + view.region.w / 2).attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)')
      .text('match clock (minutes)');

    // Dual price axes: one per lane, each with its own horizontal title
    // (G3: y titles are never rotated).
    g.append('g').attr('transform', `translate(${view.region.x - 8},0)`)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisLeft(yReg).ticks(4));
    // Titles sit 22px (not 10px) below each lane's top so they clear the
    // "REGULATION ·" / "ADVANCE ·" descriptor line 6px above the lane,
    // which the tighter spacing let them run into (perception-brief P4).
    g.append('text').attr('x', view.region.x - 8).attr('y', laneTop.reg + 22)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)').text('regulation-market price (cents)');
    g.append('g').attr('transform', `translate(${view.region.x - 8},0)`)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisLeft(yAdv).ticks(4));
    g.append('text').attr('x', view.region.x - 8).attr('y', laneTop.adv + 22)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-caption-size)')
      .attr('fill', 'var(--ink-mid)').text('advance-market price (cents)');

    g.append('text').attr('x', view.region.x).attr('y', laneTop.reg - 6)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .attr('fill', 'var(--ink-low)').text('REGULATION · Germany wins in 90, expiring by rule');
    g.append('text').attr('x', view.region.x).attr('y', laneTop.adv - 6)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .attr('fill', 'var(--ink-low)').text('ADVANCE · Germany goes through, still trading');

    // Chart-first fix (design-review C2): the regulation leg is only ~650
    // dots' worth of tagged population, split further into ~50 for this
    // lane -- at rest opacity, scattered across a 22-minute pre-whistle
    // window, those dots never composited above the field's own noise
    // floor and the split never read as a change. Two connected D3 price
    // paths, built straight from the zoom tile (not the population), carry
    // the message the particles alone could not: a labeled line, not a
    // sole-carrier scatter (RESHAPE doctrine). The dots stay as texture
    // underneath.
    const legSpec = data.manifest.zoom.gerpar;
    let regLegIdx = -1; let advLegIdx = -1;
    if (legSpec && legSpec.legs) {
      advLegIdx = findLegIndex(legSpec.legs, /advance/i);
      regLegIdx = legSpec.legs.findIndex((l, i) => i !== advLegIdx);
    }
    const gpTile = data.zoom.gerpar;
    function buildLegPoints(legIdx, maxPts) {
      if (!gpTile || legIdx < 0) return [];
      const rows = [];
      for (let r = 0; r < gpTile.count; r++) if (gpTile.leg[r] === legIdx) rows.push(r);
      if (!rows.length) return [];
      const stride = Math.max(1, Math.ceil(rows.length / maxPts));
      const pts = [];
      for (let i = 0; i < rows.length; i += stride) {
        const r = rows[i];
        pts.push({ ts: gpTile.t0 + gpTile.ts_ms[r], price: gpTile.price_c[r] });
      }
      const rLast = rows[rows.length - 1];
      const lastTs = gpTile.t0 + gpTile.ts_ms[rLast];
      if (!pts.length || pts[pts.length - 1].ts !== lastTs) {
        pts.push({ ts: lastTs, price: gpTile.price_c[rLast] });
      }
      return pts;
    }
    const regPts = buildLegPoints(regLegIdx, 400);
    const advPts = buildLegPoints(advLegIdx, 700);
    const regLineGen = d3.line().x((d) => x(d.ts)).y((d) => yReg(d.price));
    const advLineGen = d3.line().x((d) => x(d.ts)).y((d) => yAdv(d.price));
    const regPathEl = g.append('path')
      .attr('fill', 'none').attr('stroke', 'var(--state-expiring)')
      .attr('stroke-width', 2).attr('stroke-linecap', 'round');
    const advPathEl = g.append('path')
      .attr('fill', 'none').attr('stroke', 'var(--side-yes)')
      .attr('stroke-width', 2).attr('stroke-linecap', 'round');

    const whistleG = g.append('g').style('display', 'none');
    if (whistleTs !== null) {
      const wx = x(whistleTs);
      whistleG.append('line')
        .attr('x1', wx).attr('x2', wx)
        .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
        .attr('stroke', 'var(--ink-hero)').attr('stroke-width', 1.5);
      whistleG.append('text').attr('x', wx + 6).attr('y', view.region.y + 12)
        .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-annotation-size)')
        .attr('fill', 'var(--ink-hero)').text("90'");
    }

    // Shootout region shading + per-kick markers (advancement leg, tile
    // flags bit 0 = detector-anchored repricing event) -- one composite
    // annotation cluster, not N separate annotations. Markers sit in a
    // thin strip near the bottom of the advance lane (never full-lane
    // height) and stay ink-low: this scene's one amber unit is already
    // spent on the merged decay annotation below (design-revision-spec S8
    // bright-unit ledger caps this scene at cyan + white + one amber).
    const kicksG = g.append('g').style('display', 'none');
    if (whistleTs !== null) {
      const spec = data.manifest.zoom.gerpar;
      const winEndMs = new Date(spec.window[1]).getTime();
      kicksG.append('rect')
        .attr('x', x(whistleTs)).attr('width', Math.max(0, x(winEndMs) - x(whistleTs)))
        .attr('y', laneTop.adv).attr('height', laneH)
        .attr('fill', 'var(--field-rest)').attr('fill-opacity', 0.06);
      const tile = data.zoom.gerpar;
      const stripBottom = laneTop.adv + laneH - 4;
      const stripTop = stripBottom - 12;
      if (tile) {
        let kickN = 0;
        for (let r = 0; r < tile.count; r++) {
          const ts = tile.t0 + tile.ts_ms[r];
          if (ts > whistleTs && (tile.flags[r] & 1)) {
            kickN += 1;
            const kx = x(ts);
            kicksG.append('line')
              .attr('x1', kx).attr('x2', kx)
              .attr('y1', stripTop).attr('y2', stripBottom)
              .attr('stroke', 'var(--ink-low)').attr('stroke-width', 1);
            kicksG.append('text')
              .attr('x', kx).attr('y', stripTop - 3)
              .attr('text-anchor', 'middle')
              .attr('font-family', 'var(--font-tape)')
              .attr('font-size', 'var(--type-micro-size)')
              .attr('fill', 'var(--ink-low)')
              .text(String(Math.min(kickN, 99)));
          }
        }
      }
    }

    // Merged two-line annotation (CR-8): line 1 amber (the scene's one
    // amber unit), line 2 ink-mid. One leader, one block, never two
    // separate captions competing for the same story point.
    // Text-collision sweep (Gate-5 item 3 disposition 2): top used to sit
    // at laneTop.adv + 8, which put this opaque card's top edge 14px
    // *above* the "advance-market price (cents)" axis title's baseline
    // (laneTop.adv + 22) -- the card swallowed the whole title, leaving
    // only a one-letter "a" sliver visible past its left edge. Dropping
    // the top past the title's full glyph height (baseline + descender
    // clearance) clears it; the card still opens right at the advance
    // lane's data, same as before.
    const decayCaption = pinnedCaption(
      container,
      '',
      's08-decay-caption',
    ).style('left', `${view.region.x}px`).style('top', `${laneTop.adv + 32}px`)
      .html(
        '<div style="color:var(--accent-annotation)">settling out: never faster than 7 cents a minute</div>'
        + '<div style="color:var(--ink-mid); margin-top:4px">a real goal moves 19 to 25 cents in 30 seconds</div>',
      );

    // One continuous scrub track (storyboard's single Beat/Scroll spec):
    // the whistle marker, the decay caption, and the shootout/kick markers
    // reveal progressively as scroll crosses the whistle instant, driven by
    // scrub(t) rather than discrete steps.
    const whistleAt = data.scene && data.scene.window && data.scene.window.whistle_ts
      ? (() => {
        const spec = data.manifest.zoom.gerpar;
        const s = new Date(spec.window[0]).getTime();
        const e = new Date(spec.window[1]).getTime();
        return (whistleTs - s) / Math.max(1, e - s);
      })()
      : 0.35;

    const lineCuts = computeCuts(
      whistleTs,
      data.manifest.zoom.gerpar ? new Date(data.manifest.zoom.gerpar.window[0]).getTime() : null,
      data.manifest.zoom.gerpar ? new Date(data.manifest.zoom.gerpar.window[1]).getTime() : null,
    );

    function step() {} // no discrete steps in this scrub scene

    function scrub(t) {
      const cutoff = cutoffAt(lineCuts, t);
      const regDrawn = regPts.filter((d) => d.ts <= cutoff);
      const advDrawn = advPts.filter((d) => d.ts <= cutoff);
      regPathEl.attr('d', regDrawn.length > 1 ? regLineGen(regDrawn) : null);
      advPathEl.attr('d', advDrawn.length > 1 ? advLineGen(advDrawn) : null);

      const past = t >= whistleAt;
      whistleG.style('display', past ? null : 'none');
      decayCaption.style('display', past ? null : 'none');
      kicksG.style('display', past ? null : 'none');
    }

    return {
      step,
      scrub,
      exit() {
        g.selectAll('*').remove();
        decayCaption.remove();
      },
    };
  },

  beats: [
    {
      id: 'b1',
      html: `<p>Which market you watch matters more than what the players
        do. Germany and Paraguay finished level after ninety minutes.</p>
        <p>One ticket paid off only if Germany won inside those ninety
        minutes. By its own rules, that ticket had to die at the final
        whistle: a draw counts as no. Its price slid from 44 cents to 1
        cent over twenty-two minutes, like sand falling through an
        hourglass, never faster than 7 cents a
        minute.<sup><a href="#fn-13">13</a></sup> Compare that to a real
        goal: a real goal moves a price 19 to 25 cents in 30 seconds, more
        than three times as fast.</p>
        <p>A second ticket paid off if Germany went through to the next
        round, however that happened. It barely moved at the whistle and
        kept trading through every penalty kick, for another
        hour.<sup><a href="#fn-13">13</a></sup></p>
        <p>Same match. Two tickets. Two different stories. Someone watching
        only the first ticket would swear the market gave up on Germany for
        no reason. It didn't. At the whistle line, watch the two paths
        split. One dies. One keeps trading.</p>
        <p>Tonight's tie-in: if the final is level late, the
        win-in-ninety-minutes ticket will slide by rule, not by belief. The
        real belief will be sitting in the champion tickets. Check which
        ticket is talking before you react.</p>`,
      // Scrub from minute 85 through the shootout's end; the dwell at the
      // whistle (where layout().keyframes slows real time per scroll inch)
      // is the scene's gold coin, per storyboard §Scroll.
      trigger: { type: 'scrub', span: 6 },
      state: 'k0',
      kind: 'resort',
      chip: [
        { token: 'side-yes', glyph: 'dot', label: 'cyan = the advance market, still trading' },
        { token: 'state-expiring', glyph: 'dot', label: 'slate = the regulation market, expiring by rule' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      overlayStep: 'b1',
    },
  ],

  // No reducedMotion.states override: the scrub track already snaps to the
  // nearest keyframe under reduced motion (§3.5); the final keyframe is the
  // fully-settled, fully-revealed static frame.
};
