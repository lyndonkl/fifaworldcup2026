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

/* Fresh blind review (score 3/10), s18 SIMPLIFY fix pass -- C1 "the
 * invitation has no visual carrier": pick ONE contract to stay lit past
 * the S17->S18 handoff instead of settling into the grey field like every
 * other dot. Preferring a FINAL_CONTRACT dot (the same population S17 just
 * lit) keeps the amber meaning continuous across the cut -- "the final's
 * contracts settle" becomes "except this one, still open" -- rather than
 * introducing a fresh, unexplained amber unit. Deterministic and pure (no
 * shared state): layout() and overlay() each call this and agree, because
 * they're given the same data/view. Position is fixed off the timeline,
 * clear of THE LAB card (top-left), the KEY (top-right) and the skip pill
 * (bottom-left) -- an open lane so the ring+label reads as one drawing,
 * not a collision (perception-brief §4, figure-ground).
 */
function pickExemplar(data, view) {
  const { manifest, pop } = data;
  const N = pop.count;
  let idx = Math.floor(hash01(1) * N);
  try {
    const bit = flagBit(manifest, 'FINAL_CONTRACT');
    const finalIdx = indicesWithFlag(pop.flags, bit);
    if (finalIdx.length) idx = finalIdx[Math.floor(finalIdx.length / 2)];
  } catch (e) { /* flag not in this build's enum -- hash fallback above stands */ }
  return { idx, x: view.W * 0.52, y: view.H * 0.46 };
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

/* One-shot amber ring on the picker's search field (Gate-4 visual-story
 * review, s18 SIMPLIFY: "onset pulse ... on the picker"). Scene-scoped and
 * self-contained: injected once into <head> from this module rather than
 * added to the shared docs/index.html stylesheet, so this scene's own
 * repair carries no risk of colliding with a concurrent edit to shared
 * chrome. Mirrors the existing #chip.pulse ring in shape (box-shadow
 * expand-and-fade) but is entirely local to s18. */
function injectInvitePulseStyleOnce() {
  if (document.getElementById('s18-invite-pulse-style')) return;
  const style = document.createElement('style');
  style.id = 's18-invite-pulse-style';
  style.textContent = `
    .s18-invite-pulse.s18-pulse-fire { animation: s18-invite-pulse-ring 1.2s ease-out 1; }
    @keyframes s18-invite-pulse-ring {
      0% { box-shadow: 0 0 0 0 rgba(204, 161, 62, 0.55); }
      100% { box-shadow: 0 0 0 10px rgba(204, 161, 62, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .s18-invite-pulse.s18-pulse-fire { animation: none; }
    }
  `;
  document.head.appendChild(style);
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

  // Density-aware rest-alpha floor (fresh blind review M3: "mid, settled:
  // resting field below perceptual threshold" -- brief §9b/§10.1). A flat
  // 0.35 reads fine wherever dots overlap, but most of the timeline is
  // sparse -- real volume piles into the tournament's final weeks (see the
  // y-spread note below), so a lone early dot sits close to canvas. Bin
  // births and push sparse bins toward, never past, the engine's own
  // rest/active classify line (dot.opacity-rest-classify-max), so this
  // raises the floor where it is actually dark without adding energy to
  // the late-tournament mass that already clears the tone-map cap on its
  // own.
  const BINS = 40;
  const counts = new Uint32Array(BINS);
  const binOf = new Uint16Array(N);
  const span = Math.max(1, t1 - t0);
  for (let i = 0; i < N; i++) {
    const frac = Math.min(0.999999, Math.max(0, (pop.birth_ts[i] * 1000) / span));
    const b = Math.min(BINS - 1, Math.floor(frac * BINS));
    binOf[i] = b; counts[b]++;
  }
  let maxCount = 1;
  for (let b = 0; b < BINS; b++) if (counts[b] > maxCount) maxCount = counts[b];
  const classifyMax = (view.tokens.dot && view.tokens.dot['opacity-rest-classify-max']) || 0.42;
  const alphaCeiling = Math.max(rest[3], classifyMax - 0.02); // stay under the active-tier line

  const exemplar = pickExemplar(data, view);
  const amber = view.color('accent-annotation', 1.0);

  for (let i = 0; i < N; i++) {
    state.x[i] = timeX(new Date(t0 + pop.birth_ts[i] * 1000));
    // Wider vertical spread (Gate-4 visual-story review, s15/s17/s18 shared
    // finding: real trade volume skews hard toward the tournament's final
    // weeks, so x alone already piles most of the population into a few
    // pixels near the right edge; y carries no claim, so widening it lowers
    // local overlap density ahead of the engine's rest-tier cap).
    state.y[i] = view.H * (0.10 + 0.80 * hash01(i * 9 + 5));
    const density = counts[binOf[i]] / maxCount;
    const a = rest[3] + (alphaCeiling - rest[3]) * (1 - density);
    state.color[i * 4] = rest[0]; state.color[i * 4 + 1] = rest[1];
    state.color[i * 4 + 2] = rest[2]; state.color[i * 4 + 3] = a;
    state.size[i] = view.tokens.dot['radius-base-px'];
  }

  // The one exemplar contract (see pickExemplar): pulled out of the
  // timeline into a clear spot, lit at full amber -- the scene's single
  // findable "click this" mark. Crossing the engine's active-tier
  // classify line (alpha >= 0.9) on a genuine color change gets it the
  // same automatic onset pulse + luminance boost every other lit mark in
  // the piece gets (perception-brief §7, §9b) -- no extra engine call.
  state.x[exemplar.idx] = exemplar.x;
  state.y[exemplar.idx] = exemplar.y;
  state.color[exemplar.idx * 4] = amber[0];
  state.color[exemplar.idx * 4 + 1] = amber[1];
  state.color[exemplar.idx * 4 + 2] = amber[2];
  state.color[exemplar.idx * 4 + 3] = amber[3];

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
    // Invitation carrier (Gate-4 visual-story review, s18 SIMPLIFY: "give
    // the explorable invitation a visual carrier: onset pulse + label on
    // the picker" — Tier-1 C1, "the invitation has no visual carrier"). The
    // picker was plain form chrome with nothing to draw the eye once the
    // rail released; a one-shot amber ring (bound to the same reveal event
    // as the shell's own fade-up, never a second motion trigger) plus a
    // plain-words label on the search field give the reader something to
    // look at and something that tells them what it is.
    const pickerWrap = shell.append('div').attr('class', 's18-picker interactive')
      .style('position', 'relative')
      .style('margin-top', view.css('space-32'));
    const pickerHeader = pickerWrap.append('div')
      .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'))
      .style('letter-spacing', view.css('type-micro-tracking')).style('color', view.css('ink-low'));
    pickerHeader.append('span').text('PICK A CONTRACT');
    pickerHeader.append('span')
      .style('color', view.css('accent-annotation')).style('margin-left', view.css('space-8'))
      .text('— every one below is still live, open one');
    const searchInput = pickerWrap.append('input')
      .attr('type', 'search').attr('placeholder', 'Search by ticker or title…')
      .attr('aria-label', 'Search markets')
      .attr('class', 's18-invite-pulse')
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

    /* -------- The coda's one amber singleton (see pickExemplar) --------
     * Ring + label around the exemplar dot, matching the piece's amber-
     * singleton protocol (s01/s14: halo + core + leader + label, one
     * findable mark, exactly one amber meaning on screen). Starts hidden:
     * fresh blind review C1 flagged that a ring drawn here at t0 would sit
     * over an empty patch of stage while the actual dot is still mid-
     * flight from wherever S17 left it -- reveal() below fades it in once
     * the resort tween has landed the dot at this spot. */
    const singleton = container.svg.append('g').attr('class', 's18-singleton').style('opacity', 0);
    const exemplar = pickExemplar(data, view);
    singleton.append('circle').attr('class', 'halo')
      .attr('cx', exemplar.x).attr('cy', exemplar.y)
      .attr('r', view.tokens.dot['radius-annotated-halo-px'])
      .style('fill', 'none').style('stroke', view.css('accent-annotation'))
      .style('stroke-width', view.tokens.dot['halo-stroke-px']);
    singleton.append('circle').attr('class', 'core')
      .attr('cx', exemplar.x).attr('cy', exemplar.y)
      .attr('r', view.tokens.dot['radius-annotated-core-px'])
      .style('fill', view.css('accent-annotation'));
    singleton.append('line').attr('class', 'leader')
      .attr('x1', exemplar.x + view.tokens.dot['radius-annotated-halo-px']).attr('y1', exemplar.y)
      .attr('x2', exemplar.x + 32).attr('y2', exemplar.y)
      .style('stroke', view.css('accent-annotation'))
      .style('stroke-width', view.tokens.layout['annotation-leader-weight-px']);
    const singletonLabelX = exemplar.x + 38;
    const singletonLabel = singleton.append('text').attr('class', 'label')
      .attr('x', singletonLabelX).attr('y', exemplar.y)
      .style('fill', view.css('accent-annotation'))
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-annotation-size'));
    // Mobile (2026-07 390x844 DOM-geometry audit): the one-line label ran
    // 41px past the viewport's right edge (start-anchored at W*0.52 + 38,
    // ~190px of 15px Inter against a 390px viewport). Wrap at its own
    // em dash into two tspans on the same anchor — the s01
    // pretitle-caption pattern — so the longest line ("explore it below")
    // ends well inside view.region; desktop keeps the one-line lane.
    if (view.mobile) {
      singletonLabel.append('tspan')
        .attr('x', singletonLabelX).attr('dy', '-0.26em').text('still open —');
      singletonLabel.append('tspan')
        .attr('x', singletonLabelX).attr('dy', '1.15em').text('explore it below');
    } else {
      singletonLabel.attr('dy', '0.32em').text('still open — explore it below');
    }
    // Measured clamp (s08 parked-label pattern): if the label block still
    // crosses the stage region's right edge at some other width, shift it
    // left by the measured overflow — floored at the halo's own edge so
    // the label can never back over the dot it names. Runs before the
    // scrim bbox is taken, so the scrim tracks the final placement.
    let singletonBB = null;
    try { singletonBB = singletonLabel.node().getBBox(); } catch (e) { singletonBB = null; }
    if (singletonBB) {
      const regionRight = view.region.x + view.region.w;
      const overflow = singletonBB.x + singletonBB.width - regionRight;
      const maxShift = singletonLabelX
        - (exemplar.x + view.tokens.dot['radius-annotated-halo-px']);
      const dx = Math.min(Math.max(overflow, 0), Math.max(maxShift, 0));
      if (dx > 0) {
        singletonLabel.attr('x', singletonLabelX - dx);
        singletonLabel.selectAll('tspan').attr('x', singletonLabelX - dx);
        try { singletonBB = singletonLabel.node().getBBox(); } catch (e) { /* keep prior bbox */ }
      }
      singleton.insert('rect', 'text.label').attr('class', 'label-scrim')
        .attr('x', singletonBB.x - 6).attr('y', singletonBB.y - 4)
        .attr('width', singletonBB.width + 12).attr('height', singletonBB.height + 8)
        .attr('rx', 3)
        .style('fill', view.css('bg-card-composite-cap')).style('opacity', 0.85);
    }

    /* -------- Fade-up entry (design-system.md §9 S18: 800ms) -------- */
    function reveal() {
      if (codaEl) codaEl.hidden = false;
      shell.transition().duration(view.tokens.motion.durations_ms['ui-chrome-fade-up'])
        .style('opacity', 1).style('transform', 'translateY(0px)');
      // The invitation's onset pulse rides the same one-time reveal event
      // above, not a second motion trigger (design-revision-spec G6: "one
      // motion event per beat"): it fires once, on arrival, and never
      // repeats.
      injectInvitePulseStyleOnce();
      searchInput.classed('s18-pulse-fire', true);

      // Announce the S17->S18 handoff once the population's own resort
      // tween (fired by this beat's `state: 'rest'` / `kind: 'resort'`)
      // has actually landed the exemplar dot at the ring above (fresh
      // blind review M2: "the largest luminance change in the scene ...
      // is silent" -- pulse the key and swap its text at the moment of
      // collapse, the same change-blindness countermeasure the chip
      // already uses everywhere else, brief §7).
      const resortMs = view.tokens.motion.durations_ms['resort-total-target'] || 1700;
      const settleFadeMs = view.tokens.motion.durations_ms['recolor-max'] || 600;
      const settledChip = [
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
        { token: 'accent-annotation', glyph: 'dot', label: 'amber = one contract, still open' },
      ];
      if (view.reducedMotion) {
        view.setChip(settledChip);
        singleton.style('opacity', 1);
      } else {
        setTimeout(() => {
          view.setChip(settledChip);
          singleton.transition().duration(settleFadeMs).style('opacity', 1);
        }, resortMs);
      }
    }

    return {
      step(beatId) { if (beatId === 'b1') reveal(); },
      // The #coda picker/scrubber persists past the rail by design (file
      // header note) -- but container.svg's scene-layer `g` is the normal
      // per-visit scroll-tracked overlay every other scene tears down on
      // exit(), and this pass is the first thing s18 has ever drawn into
      // it (the singleton ring). Remove just that, so scrolling back up
      // past s18 and down again doesn't stack a second ring on the first.
      exit() { singleton.remove(); },
    };
  },

  beats: [
    {
      id: 'b1',
      html: '<p>The story is told. Every dot above is still yours to open. Pick a contract and step through its price, from the day it was listed to the day it settled. Open a zoom match and step through it trade by trade. Nothing here is a simulation. Every dot is money that moved. If you doubted anything above, or want to test your own read before kickoff, open a market and check it here.</p>',
      trigger: 'step',
      state: 'rest',
      kind: 'resort',
      // Transitional key (fresh blind review M1: "key/visual mismatch and
      // amber-budget violation" -- at the instant this beat activates the
      // engine is still tweening away from S17's own amber-lit final's-
      // contracts state, so a grey-only key is momentarily undecodable.
      // Naming both marks that are actually on screen keeps the key true
      // at every frame; reveal() swaps this to the settled-state key once
      // the resort tween lands (see the M2 fix there).
      chip: [
        { token: 'accent-annotation', glyph: 'dot', label: 'amber = the final’s contracts, settling' },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      grain: { text: '1 dot = {grainUsd} of real money traded' },
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
