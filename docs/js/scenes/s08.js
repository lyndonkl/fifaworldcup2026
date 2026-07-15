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
 * R4) needs one field the manifest's generic zoom spec does not carry: the
 * whistle instant itself (the regulation leg's glide begins exactly there,
 * and it anchors the scene's scroll dwell / gold-coin moment):
 *   {
 *     "_provenance": { "sources": [...], "generated": ISO },
 *     "window": { "whistle_ts": ISO }
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
  layoutName: 'dual-path',

  needs: { scene: true, series: [], zoom: 'gerpar' },

  zoom: {
    key: 'gerpar',
    tagBit: 'ZOOM_GERPAR',
    grainText: '1 dot = 1 trade · showing every {n}th of {count} trades',
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

    const cuts = whistleTs
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

    g.append('g')
      .attr('transform', `translate(0,${view.region.y + view.region.h + 8})`)
      .attr('font-family', 'var(--font-apparatus)')
      .attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisBottom(x).ticks(6));

    // Dual price axes: one per lane.
    g.append('g').attr('transform', `translate(${view.region.x - 8},0)`)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisLeft(yReg).ticks(4));
    g.append('g').attr('transform', `translate(${view.region.x - 8},0)`)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .call(d3.axisLeft(yAdv).ticks(4));

    g.append('text').attr('x', view.region.x).attr('y', laneTop.reg - 6)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .attr('fill', 'var(--ink-low)').text('REGULATION (GER leg)');
    g.append('text').attr('x', view.region.x).attr('y', laneTop.adv - 6)
      .attr('font-family', 'var(--font-apparatus)').attr('font-size', 'var(--type-micro-size)')
      .attr('fill', 'var(--ink-low)').text('ADVANCEMENT');

    const whistleTs = data.scene && data.scene.window && data.scene.window.whistle_ts
      ? new Date(data.scene.window.whistle_ts).getTime() : null;
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
    // annotation cluster, not N separate annotations.
    const kicksG = g.append('g').style('display', 'none');
    if (whistleTs !== null) {
      const spec = data.manifest.zoom.gerpar;
      const winEndMs = new Date(spec.window[1]).getTime();
      kicksG.append('rect')
        .attr('x', x(whistleTs)).attr('width', Math.max(0, x(winEndMs) - x(whistleTs)))
        .attr('y', laneTop.adv).attr('height', laneH)
        .attr('fill', 'var(--field-rest)').attr('fill-opacity', 0.06);
      const tile = data.zoom.gerpar;
      if (tile) {
        for (let r = 0; r < tile.count; r++) {
          const ts = tile.t0 + tile.ts_ms[r];
          if (ts > whistleTs && (tile.flags[r] & 1)) {
            kicksG.append('line')
              .attr('x1', x(ts)).attr('x2', x(ts))
              .attr('y1', laneTop.adv).attr('y2', laneTop.adv + laneH)
              .attr('stroke', 'var(--accent-annotation)').attr('stroke-width', 1)
              .attr('stroke-opacity', 0.6);
          }
        }
      }
    }

    const decayCaption = pinnedCaption(
      container,
      'regulation leg decay: no more than 7¢/min · a real goal jumps 19–25¢ in 30s — this is expiry, not news',
      's08-decay-caption',
    ).style('left', `${view.region.x}px`).style('top', `${laneTop.reg + laneH + 8}px`);

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

    function step() {} // no discrete steps in this scrub scene

    function scrub(t) {
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
      html: `<p>Which market you watch matters more than what the players do.
        Germany and Paraguay finished level, and the regulation-time
        contract did exactly what its rules require: the Germany leg ground
        from 48 cents to one over twenty-two minutes on accelerating
        settlement volume, a decay never exceeding seven cents a minute,
        while real goals jump nineteen to twenty-five cents inside thirty
        seconds.<sup><a href="#fn-13">13</a></sup> The advancement contract
        barely moved at the whistle and kept trading through the shootout
        for another hour.<sup><a href="#fn-13">13</a></sup> A reader
        watching only the regulation leg would see the market abandon
        Germany without news. The tape shows a contract obeying its own
        settlement clock, while belief kept trading in the advancement leg
        through every kick.</p>`,
      // Scrub from minute 85 through the shootout's end; the dwell at the
      // whistle (where layout().keyframes slows real time per scroll inch)
      // is the scene's gold coin, per storyboard §Scroll.
      trigger: { type: 'scrub', span: 6 },
      state: 'k0',
      kind: 'resort',
      chip: 'color: contract status',
      overlayStep: 'b1',
    },
  ],

  // No reducedMotion.states override: the scrub track already snaps to the
  // nearest keyframe under reduced motion (§3.5); the final keyframe is the
  // fully-settled, fully-revealed static frame.
};
