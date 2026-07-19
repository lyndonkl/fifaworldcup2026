/* docs/js/scenes/s18.js — "The rail releases" (coda)
 *
 * Storyboard: research/storyboard.md, Coda, S18 (§3, lines ~372-384).
 * CONTRACT registry: id s18, act 6, layoutName 'free (rail releases)',
 * interactive coda, zoom tile 'all', "bounded picker + scrubber; lazy
 * data/replay/ shards" (docs/CONTRACT.md §4.2). Bounded scope per
 * DECISIONS.md #16: a market picker and a match scrubber, not a second
 * app.
 *
 * MOUNT POINT: docs/index.html already ships a dedicated, initially
 * `hidden`, `<section id="coda" data-scene="s18">` in normal document
 * flow, below `#rail` and above `#methods` — separate from the fixed
 * per-scene `#html-overlay` div every other scene uses. CONTRACT §6.3's
 * own language ("the driver ... hands the engine to the replay UI
 * (fade-up per tokens)") reads as this scene owning that handoff, so
 * this module renders its interactive picker/transport into `#coda`
 * (revealed + `--dur-ui-chrome-fade-up` faded in on entry), while still
 * using the standard `container.svg`/`container.html` for the one
 * scroll-tracked transitional beat every scene owes the rail. Flagged in
 * this build's notes for the main.js owner to confirm.
 *
 * ENGINE ACCESS GAP (flagged in this build's notes/data_requests): the
 * scene contract (CONTRACT §4) gives scenes no documented handle to
 * drive `engine.tween()` outside the scroll-triggered beat flow, which
 * every interactive scene (this one; S14's toggle) needs. The only
 * reachable handle in the current main.js is the debug hook
 * `window.__rt.engine`, documented there as "not used by the page
 * itself." This module uses it defensively (feature-detected, never
 * assumed) so the picker's price/volume scrub and market list remain
 * fully functional even if that hook is unavailable; only the
 * "lift this market's dots" flourish is best-effort.
 *
 * DATA ACCESS GAP: `sceneData()` in main.js does not expose
 * `data/markets.json` (ticker → row index, needed to match a picker
 * selection back to population dots via `pop.market`), and `DATA.markets`
 * is declared but never populated there. This scene fetches
 * `manifest.markets.url` directly and caches it locally — same
 * justification as the lazy replay-shard fetches CONTRACT §5.6 already
 * asks a scene to perform on selection.
 */

import { registry, checkMagic, columnViews, fmt, flagBit, indicesWithFlag } from '../shared.js';

function hash01(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

async function fetchJsonLocal(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`[rt/s18] fetch ${url}: ${r.status}`);
  return r.json();
}
async function fetchBufferLocal(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`[rt/s18] fetch ${url}: ${r.status}`);
  return r.arrayBuffer();
}

/* ---------------------------------------------------------------- */
/* Free-camera resting field (Units: "the S2 timeline layout").      */

function computeRestingField(data, view) {
  const { manifest, pop } = data;
  const N = pop.count;
  const state = { x: new Float32Array(N), y: new Float32Array(N), color: new Float32Array(4 * N), size: new Float32Array(N) };
  const rest = view.state('rest');
  const t0 = new Date(manifest.epoch).getTime();
  const t1 = new Date(manifest.frozen_at || manifest.generated).getTime();
  const timeX = d3.scaleUtc().domain([t0, t1]).range([view.W * 0.04, view.W * 0.96]);
  for (let i = 0; i < N; i++) {
    state.x[i] = timeX(new Date(t0 + pop.birth_ts[i] * 1000));
    state.y[i] = view.H * (0.22 + 0.62 * hash01(i * 9 + 5));
    state.color[i * 4] = rest[0]; state.color[i * 4 + 1] = rest[1];
    state.color[i * 4 + 2] = rest[2]; state.color[i * 4 + 3] = rest[3];
    state.size[i] = view.tokens.dot['radius-base-px'];
  }
  return state;
}

/* ---------------------------------------------------------------- */
/* Lazy caches, module-scoped (one coda instance per page load).     */

let marketsRowsPromise = null;
function loadMarketsRows(manifest) {
  if (!marketsRowsPromise) {
    marketsRowsPromise = manifest.markets && manifest.markets.url
      ? fetchJsonLocal(manifest.markets.url).catch((e) => { console.warn('[rt/s18] markets.json unavailable', e); return []; })
      : Promise.resolve([]);
  }
  return marketsRowsPromise;
}

let replayIndexPromise = null;
function loadReplayIndex(manifest) {
  if (!replayIndexPromise) {
    const url = manifest.coda && manifest.coda.markets_url;
    // Normalize at the one call site: the shipped index.json is
    // `{ note, markets: [...] }` (a documented "shards are a follow-up"
    // build note lives in that `note` field), not CONTRACT §5.6's bare
    // picker-rows array — accept either shape so a future re-tile that
    // switches to the bare-array form keeps working too.
    replayIndexPromise = url
      ? fetchJsonLocal(url)
        .then((json) => (Array.isArray(json) ? json : (json && Array.isArray(json.markets) ? json.markets : [])))
        .catch((e) => { console.warn('[rt/s18] replay index unavailable', e); return []; })
      : Promise.resolve([]);
  }
  return replayIndexPromise;
}

async function loadReplayShard(url) {
  const buf = await fetchBufferLocal(url);
  const count = checkMagic(buf, 'RTSER1\0\0');
  // Shard layout is a small RTSER1 series file (CONTRACT §5.5/§5.6): one
  // section, f32 values, offset 16 (immediately after the 16-byte
  // header) — the same minimal convention series.bin itself uses for a
  // single-section read.
  return columnViews(buf, [{ name: 'v', dtype: 'f32', offset: 16 }], count).v;
}

async function loadZoomTileLocal(manifest, key) {
  const spec = manifest.zoom[key];
  const buf = await fetchBufferLocal(spec.url);
  const count = checkMagic(buf, 'RTZM1\0\0\0');
  const tile = columnViews(buf, spec.columns, count);
  tile.legs = spec.legs; tile.t0 = new Date(spec.t0).getTime();
  tile.build_stride = spec.build_stride || 1;
  return tile;
}

/* ---------------------------------------------------------------- */
/* Grain plate / chip: driver-owned elements (CONTRACT §7). Past the   */
/* coda handoff this scene owns them directly (see file-header note). */

function setGrainPlateDirect(text) {
  const el = document.getElementById('grain-plate');
  if (el) { el.textContent = text; el.style.visibility = 'visible'; }
}
// NOTE (Gate-4 round-2 label pass): this used to write `el.textContent`
// directly on `#chip`, which nuked the key's own header/row markup the
// G1 rewrite gave it (`#chip` now wraps a ".key-header" + "#key-rows"
// pair, not bare text). Every call site below now goes through
// `view.setChip(rows)` instead (the same row-array API every other
// scene's `beat.chip` drives), which is exposed on `view` for exactly
// this kind of mid-scene interactive update (design-revision-spec G1;
// S14's toggle uses the identical escape hatch).

function zoomGrainText(manifest, key, taggedCount, template) {
  const spec = manifest.zoom[key];
  const runtimeStride = Math.max(1, Math.ceil(spec.trades / Math.max(taggedCount, 1)));
  const n = (spec.build_stride || 1) * runtimeStride;
  return template
    .replace('{n}', fmt.count(n))
    .replace('{count}', fmt.count(spec.trades * (spec.build_stride || 1)));
}

/* ---------------------------------------------------------------- */

export default {
  id: 's18',
  act: 6,
  title: 'Check it yourself',
  kicker: 'The lab',
  layoutName: 'free (rail releases)',

  needs: { scene: false, series: [], zoom: null }, // zoom tiles fetched lazily on selection

  scales(data, view) {
    const t0 = new Date(data.manifest.epoch).getTime();
    const t1 = new Date(data.manifest.frozen_at || data.manifest.generated).getTime();
    return { x: registry.register('s18.x', d3.scaleUtc().domain([t0, t1]).range([view.W * 0.04, view.W * 0.96])) };
  },

  layout(data, view) {
    return { states: { rest: computeRestingField(data, view) } };
  },

  overlay(container, data, view, scales) {
    const codaEl = document.getElementById('coda');
    const mount = codaEl ? d3.select(codaEl) : container.html.append('div').attr('class', 's18-fallback-mount');
    mount.selectAll('*').remove();

    const shell = mount.append('div').attr('class', 's18-shell')
      .style('max-width', '68ch').style('margin', '0 auto')
      .style('opacity', 0).style('transform', 'translateY(12px)');

    shell.append('p').attr('class', 's18-intro')
      .style('font-family', view.css('font-prose')).style('font-size', view.css('type-lede-size'))
      .style('color', view.css('ink-hi')).style('max-width', '60ch')
      .html('The story is told. Every dot above is still yours to open. Pick a contract and step through its price, from the day it was listed to the day it settled. Open a zoom match and step through it trade by trade. Nothing here is a simulation. Every dot is money that moved. If you doubted anything above, or want to test your own read before kickoff, open a market and check it here.');

    /* -------- Market picker -------- */
    const pickerWrap = shell.append('div').attr('class', 's18-picker interactive')
      .style('margin-top', view.css('space-32'));
    pickerWrap.append('div')
      .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'))
      .style('letter-spacing', view.css('type-micro-tracking')).style('color', view.css('ink-low'))
      .text('PICK A CONTRACT');
    const searchInput = pickerWrap.append('input')
      .attr('type', 'search').attr('placeholder', 'Search by ticker or title…')
      .attr('aria-label', 'Search markets')
      .style('width', '100%').style('margin-top', view.css('space-8'))
      .style('background', view.css('bg-card')).style('color', view.css('ink-hi'))
      .style('border', `1px solid ${view.css('ink-low')}`).style('border-radius', view.css('space-4'))
      .style('padding', view.css('space-8'))
      .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-caption-size'));
    const listEl = pickerWrap.append('ul').attr('class', 's18-list')
      .style('list-style', 'none').style('max-height', '32vh').style('overflow-y', 'auto')
      .style('margin-top', view.css('space-8')).style('border-top', `1px solid rgba(124,135,148,0.18)`);

    const chartWrap = pickerWrap.append('div').attr('class', 's18-chart')
      .style('margin-top', view.css('space-16')).style('display', 'none');
    const chartMeta = chartWrap.append('div')
      .style('font-family', view.css('font-tape')).style('font-size', view.css('type-tape-size'))
      .style('color', view.css('ink-mid'));
    const chartSvg = chartWrap.append('svg').attr('width', '100%').attr('height', 160)
      .attr('viewBox', '0 0 640 160').attr('preserveAspectRatio', 'none');
    // Titled axes (design-revision-spec §2 S18 item 3: "market lifetime
    // (date)" / "price (cents)"), rendered once as static SVG text — this
    // chart is a small fixed-viewBox picker preview, not a scaled D3
    // axis, so a text label carries the unit without new tick machinery.
    chartSvg.append('text').attr('x', 8).attr('y', 154)
      .attr('fill', view.css('ink-mid')).attr('font-family', view.css('font-apparatus'))
      .attr('font-size', '9').text('market lifetime (date)');
    chartSvg.append('text').attr('x', 8).attr('y', 12)
      .attr('fill', view.css('ink-mid')).attr('font-family', view.css('font-apparatus'))
      .attr('font-size', '9').text('price (cents)');

    let rows = [];
    function renderRows(filter) {
      const f = (filter || '').trim().toLowerCase();
      const filtered = f
        ? rows.filter((r) => (r.ticker || '').toLowerCase().includes(f) || (r.title || '').toLowerCase().includes(f))
        : rows.slice(0, 200); // bounded render (§ bounded scope, DECISIONS #16)
      const li = listEl.selectAll('li').data(filtered, (d) => d.ticker);
      li.exit().remove();
      const enter = li.enter().append('li')
        .style('padding', `${view.css('space-8')} 0`)
        .style('border-bottom', '1px solid rgba(124,135,148,0.12)')
        .style('cursor', 'pointer')
        .style('display', 'flex').style('justify-content', 'space-between').style('gap', view.css('space-12'))
        .on('click', (ev, d) => selectMarket(d));
      enter.append('span').attr('class', 'ttl')
        .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-caption-size'))
        .style('color', view.css('ink-hi'));
      enter.append('span').attr('class', 'dollars')
        .style('font-family', view.css('font-tape')).style('font-size', view.css('type-tape-size'))
        .style('color', view.css('ink-mid'));
      enter.merge(li).select('.ttl').text((d) => d.title || d.ticker);
      enter.merge(li).select('.dollars').text((d) => fmt.usd(d.dollars || 0));
    }
    searchInput.on('input', function () { renderRows(this.value); });

    let liftedRows = [];
    async function selectMarket(row) {
      chartWrap.style('display', null);
      chartMeta.text(`${row.ticker} · ${fmt.usd(row.dollars || 0)} traded · ${row.settlement || 'settlement pending'}`);
      // Only clear the previous pick's own mark, not the static axis
      // titles appended once at chart setup (they carry the ".chart-mark"
      // class so a bare selectAll('*') here can no longer wipe them).
      chartSvg.selectAll('.chart-mark').remove();
      try {
        const series = await loadReplayShard(row.shard);
        const x = d3.scaleLinear().domain([0, series.length - 1]).range([8, 632]);
        const y = d3.scaleLinear().domain(d3.extent(series)).range([152, 8]);
        const line = d3.line().x((_, i) => x(i)).y((v) => y(v));
        chartSvg.append('path').attr('class', 'chart-mark').attr('d', line(series)).attr('fill', 'none')
          .attr('stroke', view.css('side-yes')).attr('stroke-width', 1.5);
        // On pick, the key repopulates with this market's own grammar
        // (design-revision-spec §2 S18 item 3): the line drawn above is a
        // cyan price trace, so the key names exactly that mark.
        view.setChip([{ token: 'side-yes', glyph: 'line', label: 'cyan = this market’s price over time' }]);
      } catch (e) {
        console.warn('[rt/s18] shard render failed', e);
        chartSvg.append('text').attr('class', 'chart-mark')
          .attr('x', 8).attr('y', 80).attr('fill', view.css('ink-low')).text('price life unavailable');
      }
      // Best-effort dot-lift (see file-header ENGINE ACCESS GAP note).
      try {
        const engine = window.__rt && window.__rt.engine;
        if (engine) {
          const marketRows = await loadMarketsRows(data.manifest);
          const rowIdx = marketRows.findIndex((m) => m.ticker === row.ticker);
          if (rowIdx >= 0) {
            const N = data.pop.count;
            // ENCODING (perception-brief §9b/§10.1): the selected market's dots
            // are the ACTIVE subset and must pop against the dimmed resting
            // field. computeRestingField() lays every dot at rest-tier (state
            // 'rest', alpha 0.35 <= classify-max -> engine dims it); the lifted
            // dots take accent-annotation at full alpha 1.0 (>= classify-min ->
            // engine boosts them), so lifting reads as luminance, not just hue.
            const lifted = computeRestingField(data, view); // start from the resting field
            const amber = view.color('accent-annotation'); // full alpha 1.0 -> active-tier
            const idxs = [];
            for (let i = 0; i < N; i++) if (data.pop.market[i] === rowIdx) idxs.push(i);
            idxs.forEach((i, k) => {
              const t = idxs.length > 1 ? k / (idxs.length - 1) : 0.5;
              lifted.x[i] = view.W * 0.15 + t * view.W * 0.7;
              lifted.y[i] = view.H * 0.1;
              lifted.color[i * 4] = amber[0]; lifted.color[i * 4 + 1] = amber[1];
              lifted.color[i * 4 + 2] = amber[2]; lifted.color[i * 4 + 3] = amber[3];
              lifted.size[i] = view.tokens.dot['radius-base-px'];
            });
            liftedRows = idxs;
            // Name what the lit dots are, so the reader reads amber as this
            // market's money and not a bare color (chip is driver-owned;
            // s18 owns it past the coda handoff via view.setChip, see the
            // module-header NOTE above). Keeps the price-line row from the
            // try block above so both marks on screen stay named.
            view.setChip([
              { token: 'side-yes', glyph: 'line', label: 'cyan = this market’s price over time' },
              { token: 'accent-annotation', glyph: 'dot', label: 'amber = this market’s money, lifted' },
            ]);
            engine.tween(lifted, { duration: 1200, stagger: 0.3, easing: 'ease.move' });
          }
        }
      } catch (e) { console.warn('[rt/s18] dot-lift skipped', e); }
    }

    loadReplayIndex(data.manifest).then((idx) => { rows = idx; renderRows(''); });

    /* -------- Zoom match scrubber -------- */
    const zoomWrap = shell.append('div').attr('class', 's18-zoom interactive')
      .style('margin-top', view.css('space-48'));
    zoomWrap.append('div')
      .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'))
      .style('letter-spacing', view.css('type-micro-tracking')).style('color', view.css('ink-low'))
      .text('OPEN A ZOOM MATCH');
    const zoomBtns = zoomWrap.append('div').style('display', 'flex').style('gap', view.css('space-8'))
      .style('flex-wrap', 'wrap').style('margin-top', view.css('space-8'));

    const ZOOM_LABELS = {
      fraesp: 'France – Spain', mexeng: 'Mexico – England',
      gerpar: 'Germany – Paraguay', norbra: 'Norway – Brazil',
    };
    const zoomOut = zoomWrap.append('div').attr('class', 's18-zoom-out').style('margin-top', view.css('space-16'));
    const zoomSvg = zoomOut.append('svg').attr('width', '100%').attr('height', 120)
      .attr('viewBox', '0 0 640 120').attr('preserveAspectRatio', 'none').style('display', 'none');
    // Titled axes (design-revision-spec §2 S18 item 3: zoom scrubs reuse
    // their source scene's titles verbatim; this coda zoom reuses S1's
    // plain phrasing). Added once; renderZoomTicks() only ever touches
    // its own keyed <circle> selection, so these persist across scrubs.
    zoomSvg.append('text').attr('x', 8).attr('y', 116)
      .attr('fill', view.css('ink-mid')).attr('font-family', view.css('font-apparatus'))
      .attr('font-size', '9').text('the trades, in order');
    zoomSvg.append('text').attr('x', 8).attr('y', 12)
      .attr('fill', view.css('ink-mid')).attr('font-family', view.css('font-apparatus'))
      .attr('font-size', '9').text('price (cents; 100 = certain)');
    const zoomScrub = zoomOut.append('input').attr('type', 'range').attr('min', 0).attr('max', 1000).attr('value', 0)
      .style('width', '100%').style('display', 'none')
      .attr('aria-label', 'Scrub through the match tick by tick');
    const zoomStatus = zoomOut.append('div')
      .style('font-family', view.css('font-tape')).style('font-size', view.css('type-tape-size'))
      .style('color', view.css('ink-mid'));

    Object.keys(ZOOM_LABELS).forEach((key) => {
      zoomBtns.append('button')
        .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-caption-size'))
        .style('color', view.css('ink-hi')).style('background', view.css('bg-card'))
        .style('border', `1px solid ${view.css('ink-low')}`).style('border-radius', view.css('space-4'))
        .style('padding', `${view.css('space-4')} ${view.css('space-12')}`)
        .style('cursor', 'pointer')
        .text(ZOOM_LABELS[key])
        .on('click', () => openZoomMatch(key));
    });

    let currentTicks = null;
    async function openZoomMatch(key) {
      if (!data.manifest.zoom || !data.manifest.zoom[key]) return;
      const bit = flagBit(data.manifest, `ZOOM_${key.toUpperCase()}`);
      const tagged = indicesWithFlag(data.pop.flags, bit).length;
      // Grain Plate banner FIRST, before any tick-level rendering — this
      // build's explicit requirement, matching the narrative zoom scenes'
      // own protocol (CONTRACT §4.3, §7).
      setGrainPlateDirect(zoomGrainText(data.manifest, key,
        Math.max(tagged, 1), `1 dot = 1 trade · showing every {n}th of {count} trades`));
      view.setChip([
        { token: 'side-yes', glyph: 'dot', label: 'cyan = money that bet yes' },
        { token: 'side-no', glyph: 'dot', label: 'orange = money that bet no' },
      ]);
      zoomStatus.text('loading tick tape…');
      zoomSvg.style('display', null); zoomScrub.style('display', null);
      try {
        currentTicks = await loadZoomTileLocal(data.manifest, key);
        renderZoomTicks(0);
        zoomScrub.attr('max', currentTicks.count - 1).on('input', function () { renderZoomTicks(+this.value); });
      } catch (e) {
        console.warn('[rt/s18] zoom tile load failed', e);
        zoomStatus.text('tick tape unavailable');
      }
    }

    function renderZoomTicks(centerIdx) {
      if (!currentTicks) return;
      const n = currentTicks.count;
      const span = 400; // bounded render window around the scrub head (SVG, not WebGL — see file-header note)
      const lo = Math.max(0, centerIdx - span / 2);
      const hi = Math.min(n, lo + span);
      const x = d3.scaleLinear().domain([lo, hi]).range([8, 632]);
      const y = d3.scaleLinear().domain([1, 99]).range([112, 8]);
      const pts = [];
      for (let i = Math.floor(lo); i < hi; i++) pts.push(i);
      const sel = zoomSvg.selectAll('circle').data(pts, (i) => i);
      sel.exit().remove();
      const yesColor = view.css('side-yes'), noColor = view.css('side-no');
      sel.enter().append('circle').attr('r', 1.5)
        .merge(sel)
        .attr('cx', (i) => x(i)).attr('cy', (i) => y(currentTicks.price_c[i]))
        .attr('fill', (i) => (currentTicks.side[i] === 1 ? yesColor : noColor))
        .attr('opacity', 0.85);
      const leg = currentTicks.legs && currentTicks.legs[currentTicks.leg[Math.min(centerIdx, n - 1)]];
      zoomStatus.text(`trade ${fmt.count(centerIdx + 1)} of ${fmt.count(n)}${leg ? ` · ${leg.label}` : ''}`);
    }

    /* -------- Fade-up entry (design-system.md §9 S18: 800ms) -------- */
    function reveal() {
      if (codaEl) codaEl.hidden = false;
      shell.transition().duration(view.tokens.motion.durations_ms['ui-chrome-fade-up'])
        .style('opacity', 1).style('transform', 'translateY(0px)');
    }

    return {
      step(beatId) { if (beatId === 'b1') reveal(); },
      exit() { /* the coda persists past the rail by design; nothing to tear down */ },
    };
  },

  beats: [
    {
      id: 'b1',
      html: '<p>The story is told. Every dot above is still yours to open. Pick a contract and step through its price, from the day it was listed to the day it settled. Open a zoom match and step through it trade by trade. Nothing here is a simulation. Every dot is money that moved. If you doubted anything above, or want to test your own read before kickoff, open a market and check it here.</p>',
      trigger: 'step',
      state: 'rest',
      kind: 'resort',
      chip: [
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      grain: { text: '1 dot = $75,000 of real money traded' },
      overlayStep: 'b1',
    },
  ],

  // reducedMotion: the resting field's own default crossfade suffices for
  // the one tracked beat; the interactive picker/scrubber below it uses
  // ordinary (non-canvas) DOM transitions already governed by the
  // page-level `prefers-reduced-motion` CSS (index.html disables the
  // chip pulse and scrim transition under that query) — no scene-level
  // override needed.
};
