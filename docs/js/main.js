/* main.js — Regulation Time: boot, data loading, scroll driving, scene
 * orchestration.
 *
 * This file is the harness every parallel builder plugs into; the shapes it
 * expects are fixed by docs/CONTRACT.md. Skeleton state: the engine
 * (js/engine.js) and the scene modules (js/scenes/sNN.js) may not exist yet;
 * everything here degrades to a readable static page until they land.
 *
 * Split of responsibilities (CONTRACT §2):
 *   engine.js       — the GL population; owns the context exclusively
 *   scenes/sNN.js   — per-dot layouts, D3 overlays, prose beats
 *   shared.js       — scale registry, token helpers, binary readers
 *   main.js (here)  — boot, capability tier, data loader, view/geometry,
 *                     rail builder, scroll driver, chip + grain plate
 */

import {
  registry, colorOf, particleState, durationMs,
  assertLittleEndian, checkMagic, columnViews, flagBit,
  formatSlot, getPath,
} from './shared.js';

/* ---------------------------------------------------------------- */
/* Scene registry (CONTRACT §4.2). Registry order = storyboard order =  */
/* scroll order. s12 carries the July 16 fold contingency: as of this   */
/* build that check has not fired (s12/s13 both ship "stands alone" per */
/* their own header notes), so s12 is registered normally; if the fold  */
/* fires later, delete its import and its line in SCENES below and     */
/* confirm s13 has gained the folded beats.                             */
/* Note: s16 imports s09/s10/s13/s14/s15 itself (CONTRACT §2 sibling-   */
/* import exception for its anchor carousel); ES module singletons mean */
/* importing them again here is the same instances, not a duplicate.    */

import s01 from './scenes/s01.js';
import s02 from './scenes/s02.js';
import s03 from './scenes/s03.js';
import s04 from './scenes/s04.js';
import s05 from './scenes/s05.js';
import s06 from './scenes/s06.js';
import s07 from './scenes/s07.js';
import s08 from './scenes/s08.js';
import s09 from './scenes/s09.js';
import s10 from './scenes/s10.js';
import s11 from './scenes/s11.js';
import s12 from './scenes/s12.js';   // fold contingency: see storyboard S12
import s13 from './scenes/s13.js';
import s14 from './scenes/s14.js';
import s15 from './scenes/s15.js';
import s16 from './scenes/s16.js';
import s17 from './scenes/s17.js';
import s18 from './scenes/s18.js';

const SCENES = [
  s01, s02, s03, s04, s05, s06, s07, s08, s09,
  s10, s11, s12, s13, s14, s15, s16, s17, s18,
];

/* ---------------------------------------------------------------- */
/* Environment: reduced motion + capability tier (CONTRACT §8.3)     */

const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = rmQuery.matches;

function detectTier() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 768;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  if (coarse && small) return 'mobile';
  if (cores <= 4 && mem <= 4) return 'mobile';
  return 'desktop';
}
let tier = detectTier();

/* ---------------------------------------------------------------- */
/* View / geometry (CONTRACT §6.2)                                   */

let tokens = null;      // parsed design/tokens.json — law for the JS/GL layer
let manifest = null;    // parsed data/manifest.json — law for every number
let view = null;

function computeView() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const mobile = W < 900;
  // Stage rect per design-system §4: desktop right ~64% with 8% margins
  // (the left rail owns 480px + 48px inset); mobile top ~62vh.
  const region = mobile
    ? { x: W * 0.06, y: H * 0.06, w: W * 0.88, h: H * 0.56 }
    : { x: W * 0.36 + W * 0.64 * 0.08, y: H * 0.08, w: W * 0.64 * 0.84, h: H * 0.84 };
  view = {
    W, H,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    mobile,
    get reducedMotion() { return reducedMotion; },
    region,
    safe: mobile ? 16 : 24,
    tokens,
    color: (name, alpha) => colorOf(tokens, name, alpha),
    state: (name) => particleState(tokens, name),
    css: (name) => `var(--${name})`,
    grain: null,        // filled after the population tile loads
  };
  // Global scales (owned here; scenes own their 'sNN.*' keys).
  if (manifest) {
    const t0 = new Date(manifest.epoch).getTime();
    const t1 = new Date(manifest.frozen_at || manifest.generated).getTime();
    registry.register('global.time',
      d3.scaleUtc().domain([t0, t1]).range([region.x, region.x + region.w]));
    registry.register('global.price',
      d3.scaleLinear().domain([0, 100]).range([region.y + region.h, region.y]));
  }
  return view;
}

/* ---------------------------------------------------------------- */
/* Data loader (CONTRACT §5)                                         */

const DATA = {
  manifest: null,
  pop: null,          // column views over the loaded population tile
  zoom: {},           // key -> column views (+ legs), lazy
  series: {},         // section name -> typed array view
  scenes: {},         // sceneId -> parsed scene JSON
  markets: null,
};

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`[rt] fetch ${url}: ${r.status}`);
  return r.json();
}
async function fetchBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`[rt] fetch ${url}: ${r.status}`);
  return r.arrayBuffer();
}

async function loadPopulationTile(tierName) {
  const spec = manifest.population[tierName];
  const buf = await fetchBuffer(spec.url);
  const count = checkMagic(buf, 'RTPOP1\0\0');
  if (count !== spec.dots) {
    throw new Error(`[rt] tile count ${count} != manifest dots ${spec.dots}`);
  }
  DATA.pop = columnViews(buf, spec.columns, count);
  view.grain = { usd: spec.grain_usd, text: spec.grain_text, dots: count };
  return DATA.pop;
}

async function loadZoomTile(key) {
  if (DATA.zoom[key]) return DATA.zoom[key];
  const spec = manifest.zoom[key];
  const buf = await fetchBuffer(spec.url);
  const count = checkMagic(buf, 'RTZM1\0\0\0');
  const tile = columnViews(buf, spec.columns, count);
  tile.legs = spec.legs;
  tile.t0 = new Date(spec.t0).getTime();
  tile.build_stride = spec.build_stride || 1;
  DATA.zoom[key] = tile;
  return tile;
}

async function loadSeriesSections(names) {
  const missing = names.filter((n) => !DATA.series[n]);
  if (!missing.length) return;
  if (!DATA._seriesBuf) {
    DATA._seriesBuf = await fetchBuffer(manifest.series.url);
    checkMagic(DATA._seriesBuf, 'RTSER1\0\0');
  }
  for (const name of missing) {
    const sec = manifest.series.sections.find((s) => s.name === name);
    if (!sec) throw new Error(`[rt] unknown series section: ${name}`);
    DATA.series[name] = columnViews(DATA._seriesBuf,
      [{ name: 'v', dtype: sec.dtype, offset: sec.offset }], sec.length).v;
    DATA.series[name].meta = sec;
  }
}

async function loadSceneNeeds(scene) {
  const n = scene.needs || {};
  const jobs = [];
  if (n.scene && manifest.scenes[scene.id] && !DATA.scenes[scene.id]) {
    jobs.push(fetchJson(manifest.scenes[scene.id])
      .then((j) => { DATA.scenes[scene.id] = j; }));
  }
  if (n.series && n.series.length) jobs.push(loadSeriesSections(n.series));
  if (n.zoom) jobs.push(loadZoomTile(n.zoom));
  await Promise.all(jobs);
}

/* Data object handed to scenes (CONTRACT §4): manifest + population
 * columns + this scene's aggregates + lazy zoom tiles. */
function sceneData(scene) {
  return {
    manifest,
    pop: DATA.pop,
    series: DATA.series,
    scene: DATA.scenes[scene.id] || null,
    zoom: DATA.zoom,
    flagBit: (name) => flagBit(manifest, name),
  };
}

/* ---------------------------------------------------------------- */
/* data-slot fill (CONTRACT §8.6)                                    */

function fillSlots() {
  document.querySelectorAll('[data-slot]').forEach((el) => {
    const v = getPath(manifest, el.dataset.slot);
    if (v !== undefined && v !== null) {
      el.textContent = formatSlot(v, el.dataset.format);
    }
  });
}

/* ---------------------------------------------------------------- */
/* Chip + grain plate (CONTRACT §7)                                  */

const chipEl = document.getElementById('chip');
const plateEl = document.getElementById('grain-plate');
let chipText = null;

function setChip(text) {
  if (!text || text === chipText) return;
  chipText = text;
  chipEl.textContent = text;
  chipEl.style.visibility = 'visible';   // debuts once; never disappears after
  chipEl.classList.remove('pulse');
  void chipEl.offsetWidth;               // restart the pulse animation
  chipEl.classList.add('pulse');
}

function setGrainPlate(text) {
  if (!text) return;
  plateEl.textContent = text;
  plateEl.style.visibility = 'visible';
}

/* Narrated zoom sampling (CONTRACT §4.3): n = build_stride * runtime stride.
 * `template` defaults to the scene's own zoom.grainText but accepts a
 * beat-level override (e.g. s01's beat carries a vehicle-specific suffix
 * on the same {n}/{count} template) — both are interpolated identically. */
function zoomGrainText(scene, template) {
  const spec = manifest.zoom[scene.zoom.key];
  const tile = DATA.zoom[scene.zoom.key];
  const bit = flagBit(manifest, scene.zoom.tagBit);
  let tagged = 0;
  const flags = DATA.pop.flags;
  for (let i = 0; i < flags.length; i++) if (flags[i] & bit) tagged++;
  const tileCount = tile ? tile.count : 0;
  const buildStride = (tile && tile.build_stride) || spec.build_stride || 1;
  const runtimeStride = Math.max(1, Math.ceil(tileCount / Math.max(tagged, 1)));
  const n = buildStride * runtimeStride;
  return (template || scene.zoom.grainText)
    .replace('{n}', formatSlot(n, 'count'))
    .replace('{count}', formatSlot(spec.trades * (spec.build_stride || 1), 'count'));
}

/* ---------------------------------------------------------------- */
/* Engine bootstrap (CONTRACT §3, §8.4)                              */

const canvas = document.getElementById('gl-canvas');
let engine = null;

async function bootEngine() {
  let createEngine;
  try {
    ({ createEngine } = await import('./engine.js'));
  } catch (e) {
    console.warn('[rt] engine.js not present yet — static skeleton mode', e);
    return null;
  }
  const tryTier = async (t) => {
    await loadPopulationTile(t);
    const eng = createEngine(canvas, {
      count: DATA.pop.count,
      tokens,
      reducedMotion,
      dprCap: 2,
    });
    if (!eng) throw new Error('[rt] no WebGL');
    return eng;
  };
  try {
    engine = await tryTier(tier);
  } catch (e) {
    console.warn(`[rt] ${tier} tier failed (${e.message}); falling back`, e);
    if (tier === 'desktop') {
      tier = 'mobile';
      try {
        engine = await tryTier('mobile');
      } catch (e2) {
        engine = null;
      }
    }
  }
  if (!engine) {
    document.body.classList.add('no-webgl');
    return null;
  }
  engine.resize(view.W, view.H);
  setGrainPlate(view.grain.text);        // the plate narrates the LOADED tile
  return engine;
}

/* ---------------------------------------------------------------- */
/* Rail builder (CONTRACT §6.3): DOM from the scene registry         */

const railEl = document.getElementById('rail');
const overlaySvg = d3.select('#overlay');
const overlayHtml = d3.select('#html-overlay');

/* Flat beat index across scenes; each entry knows its sentinel element. */
const BEAT_INDEX = [];

function buildRail() {
  for (const scene of SCENES) {
    const section = document.createElement('section');
    section.className = 'scene';
    section.dataset.scene = scene.id;
    for (const beat of scene.beats) {
      const isScrub = beat.trigger && beat.trigger.type === 'scrub';
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        `<div class="kicker">${scene.title || scene.id}</div>${beat.html || ''}`;
      let sentinel;
      if (isScrub) {
        const track = document.createElement('div');
        track.className = 'scrub-track';
        track.style.height = `${Math.max(beat.trigger.span || 1, 1) * 100}vh`;
        const pin = document.createElement('div');
        pin.className = 'beat-pin';
        pin.appendChild(card);
        track.appendChild(pin);
        section.appendChild(track);
        sentinel = track;
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'beat';
        wrap.appendChild(card);
        section.appendChild(wrap);
        sentinel = wrap;
      }
      BEAT_INDEX.push({ scene, beat, sentinel, scrub: isScrub, card });
    }
    railEl.appendChild(section);
  }
}

/* ---------------------------------------------------------------- */
/* Scene lifecycle                                                   */

let activeScene = null;       // scene def
let activeLayout = null;      // layout() result
let activeOverlay = null;     // overlay handle
let activeBeatKey = null;     // `${sceneId}/${beatId}`

function enterScene(scene) {
  if (activeScene === scene) return;
  if (activeOverlay) { activeOverlay.exit(); activeOverlay = null; }
  if (activeScene) registry.clearScene(activeScene.id);
  activeScene = scene;
  const data = sceneData(scene);
  const scales = scene.scales ? scene.scales(data, view) : {};
  activeLayout = scene.layout(data, view);
  const g = overlaySvg.append('g')
    .attr('class', 'scene-layer').attr('data-scene', scene.id);
  const div = overlayHtml.append('div')
    .attr('class', 'scene-html').attr('data-scene', scene.id);
  activeOverlay = scene.overlay(
    { svg: g, html: div, activate: activateSceneState }, data, view, scales,
  );
  // NOTE: grain-plate narration for zoom scenes deliberately does NOT live
  // here. enterScene() also runs from boot()'s silent "first paint" (set,
  // never animate/narrate the initial render, CONTRACT §8.4 step 6) before
  // the reader has scrolled past the title — s01 IS the first scene and
  // carries a zoom tile, so narrating here would overwrite the title
  // screen's own population-grain figures before the reader ever scrolls.
  // See activateBeat()'s fallback branch below, which only runs on a
  // genuine scroll-driven beat activation.
  // Preload the next scene's needs (one-scene lookahead).
  const i = SCENES.indexOf(scene);
  if (SCENES[i + 1]) loadSceneNeeds(SCENES[i + 1]).catch(() => {});
}

/* Beat kind -> engine tween opts (CONTRACT §4.4). Tokens, not literals. */
function optsFromKind(kind, ceremonial) {
  const d = (name) => durationMs(tokens, name);
  switch (kind) {
    case 'recolor': return { duration: (d('recolor-min') + d('recolor-max')) / 2, stagger: 0 };
    case 'pour': return { duration: Math.max(d('settlement-pour-min'), 900), stagger: 0.2, easing: 'ease.fall' };
    case 'ceremonial': return { duration: d('ceremonial-max'), stagger: 0.35, easing: 'ease.arrive', ceremonial: true };
    case 'instant': return { duration: 0 };
    case 'resort':
    default: return { duration: d('resort-total-target'), stagger: 0.35, easing: 'ease.move', ceremonial };
  }
}

/* Escape hatch for mid-scene interactives (S14's weighting toggle is the
 * one piece-wide user of this) to drive the engine outside the scroll-
 * triggered beat flow. CONTRACT §4's overlay() handle has no documented
 * reverse channel into engine.tween(); s14.js/s18.js both flag this gap
 * and already code defensively against container.activate being absent
 * (`typeof container.activate === 'function'`), so this is additive: a
 * no-op wherever the engine or the requested state isn't available. */
function activateSceneState(stateKey, opts = {}) {
  if (!engine || !activeLayout || !activeLayout.states[stateKey]) return;
  engine.tween(activeLayout.states[stateKey], optsFromKind(opts.kind, opts.ceremonial));
}

function activateBeat(entry) {
  const key = `${entry.scene.id}/${entry.beat.id}`;
  if (key === activeBeatKey) return;
  activeBeatKey = key;
  enterScene(entry.scene);
  const beat = entry.beat;

  if (beat.grain) {
    // Zoom beats template their grain text with {n}/{count} (CONTRACT
    // §4.3); a beat may carry its own vehicle-specific template (e.g.
    // s01's beat appends "France–Spain, July 14") so the template comes
    // from the beat itself, not always the scene's bare zoom.grainText.
    const needsZoomFill = entry.scene.zoom && /\{n\}|\{count\}/.test(beat.grain.text);
    setGrainPlate(needsZoomFill ? zoomGrainText(entry.scene, beat.grain.text) : beat.grain.text);
  } else if (entry.scene.zoom && DATA.zoom[entry.scene.zoom.key]) {
    // Zoom scenes with no beat-level grain override at all (s06/s07/s08:
    // every one of their beats omits `grain`) still owe the reader the
    // narrated sampling rate the moment their tick-grain window becomes
    // the active beat (CONTRACT §4.3/§7) — this is that fallback. Tied to
    // genuine beat activation (not scene entry, see enterScene()'s note)
    // so it never fires ahead of the reader's actual scroll position.
    setGrainPlate(zoomGrainText(entry.scene));
  }
  if (beat.chip) setChip(beat.chip);

  if (engine && beat.state && activeLayout.states[beat.state]) {
    let stateKey = beat.state;
    const rm = entry.scene.reducedMotion;
    if (reducedMotion && rm && rm.states && rm.states[beat.id]) {
      stateKey = rm.states[beat.id];
    }
    engine.tween(activeLayout.states[stateKey], optsFromKind(beat.kind));
  }
  if (activeOverlay) activeOverlay.step(beat.overlayStep || beat.id);
  BEAT_INDEX.forEach((e) => e.card.classList.toggle('active', e === entry));
}

/* ---------------------------------------------------------------- */
/* Scroll driver (CONTRACT §6.3) — hand-rolled: passive listener +   */
/* rAF, NOT IntersectionObserver (IO notifications ride main-thread  */
/* rendering steps and arrive late while the compositor scrolls).    */

let scrollTick = false;
let scrubSmooth = null;      // { entry, t } critically-damped toward target

function stepThresholds() {
  const pct = tokens
    ? tokens.motion.misc['step-trigger-viewport-pct'] / 100
    : 0.55;
  const hys = tokens
    ? tokens.motion.misc['step-trigger-hysteresis-pct'] / 100
    : 0.10;
  return { down: pct, up: pct + hys };
}

function computeActive() {
  if (!BEAT_INDEX.length) return;
  const { down, up } = stepThresholds();
  const markerDown = window.innerHeight * down;
  const markerUp = window.innerHeight * up;
  // Active = LAST beat whose sentinel top crossed the marker. Hysteresis:
  // a beat we are already past only deactivates once its top falls back
  // below the wider marker.
  let active = null;
  for (const entry of BEAT_INDEX) {
    const top = entry.sentinel.getBoundingClientRect().top;
    const marker = (activeBeatKey === `${entry.scene.id}/${entry.beat.id}`)
      ? markerUp : markerDown;
    if (top < marker) active = entry;
    else break;
  }
  if (active) {
    activateBeat(active);
    if (active.scrub) driveScrub(active);
  }
}

function driveScrub(entry) {
  const el = entry.sentinel;
  const r = el.getBoundingClientRect();
  const total = el.offsetHeight - window.innerHeight;
  const raw = total > 0 ? Math.min(Math.max(-r.top / total, 0), 1) : 1;

  if (reducedMotion) {
    // Stepped keyframe crossfades: snap to the nearest keyframe end state.
    if (activeOverlay && activeOverlay.scrub) activeOverlay.scrub(raw);
    if (engine && activeLayout && activeLayout.keyframes) {
      const kfs = activeLayout.keyframes;
      let nearest = kfs[0];
      for (const k of kfs) if (Math.abs(k.at - raw) < Math.abs(nearest.at - raw)) nearest = k;
      engine.tween(activeLayout.states[nearest.state], { duration: 0 });
    }
    return;
  }

  // 120ms critically-damped smoothing (scrub-lerp-smoothing token).
  if (!scrubSmooth || scrubSmooth.entry !== entry) {
    scrubSmooth = { entry, t: raw, pair: null };
  }
  const tau = tokens ? durationMs(tokens, 'scrub-lerp-smoothing') : 120;
  const alpha = 1 - Math.exp(-16.7 / tau);   // per-frame at ~60Hz
  scrubSmooth.t += (raw - scrubSmooth.t) * alpha;
  const t = scrubSmooth.t;

  if (engine && activeLayout && activeLayout.keyframes) {
    const kfs = activeLayout.keyframes;
    let i = 0;
    while (i < kfs.length - 2 && t > kfs[i + 1].at) i++;
    const a = kfs[i], b = kfs[i + 1];
    const pairKey = `${a.state}->${b.state}`;
    if (scrubSmooth.pair !== pairKey) {
      engine.scrubBetween(activeLayout.states[a.state], activeLayout.states[b.state], { stagger: 0 });
      scrubSmooth.pair = pairKey;
    }
    const span = Math.max(b.at - a.at, 1e-6);
    engine.setScrub(Math.min(Math.max((t - a.at) / span, 0), 1));
  }
  if (activeOverlay && activeOverlay.scrub) activeOverlay.scrub(t);
  if (Math.abs(raw - scrubSmooth.t) > 1e-3) scheduleScroll(); // keep easing
}

function scheduleScroll() {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => { scrollTick = false; computeActive(); });
}

/* ---------------------------------------------------------------- */
/* Resize + visibility                                               */

let resizeT = null;
function onResize() {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    computeView();
    if (engine) engine.resize(view.W, view.H);
    overlaySvg.attr('viewBox', `0 0 ${view.W} ${view.H}`)
      .attr('width', view.W).attr('height', view.H);
    if (activeScene) {
      // Hard repaint: re-derive scales + layout, set (never tween) the
      // current end state, redraw the overlay (precedent semantics).
      const scene = activeScene;
      const beatKey = activeBeatKey;
      activeScene = null; activeBeatKey = null;
      enterScene(scene);
      const entry = BEAT_INDEX.find((e) => `${e.scene.id}/${e.beat.id}` === beatKey);
      if (entry) {
        if (engine && entry.beat.state && activeLayout.states[entry.beat.state]) {
          engine.setState(activeLayout.states[entry.beat.state]);
        }
        activeBeatKey = beatKey;
        if (activeOverlay) activeOverlay.step(entry.beat.overlayStep || entry.beat.id);
      }
    }
  }, 160);
}

document.addEventListener('visibilitychange', () => {
  if (!engine) return;
  if (document.hidden) engine.pause(); else engine.resume();
});

rmQuery.addEventListener('change', (e) => {
  reducedMotion = e.matches;
  if (engine) engine.setReducedMotion(reducedMotion);
});

/* ---------------------------------------------------------------- */
/* Boot (CONTRACT §8.4)                                              */

const bootStatus = document.getElementById('boot-status');
function status(msg) { if (bootStatus) bootStatus.textContent = msg; }

async function boot() {
  assertLittleEndian();

  // 1. Law files.
  try {
    tokens = await fetchJson('design/tokens.json');
  } catch (e) {
    console.error('[rt] tokens.json missing — cannot style the GL layer', e);
    status('design tokens missing');
    return;
  }
  computeView();

  // 2. Manifest (may not exist yet in skeleton state).
  try {
    manifest = await fetchJson('data/manifest.json');
    computeView();          // re-register global scales with real domain
    fillSlots();
  } catch (e) {
    console.warn('[rt] data/manifest.json not present yet — skeleton mode', e);
    status('');
    return;                 // page remains a readable document
  }

  // 3. Engine + population tile (tier fallback chain inside).
  status('loading the population…');
  await bootEngine();

  // 4. Scenes.
  if (!SCENES.length) {
    console.warn('[rt] no scene modules registered yet — rail is empty');
    status('');
    return;
  }
  status('loading scene data…');
  await loadSceneNeeds(SCENES[0]);      // S1's zoom tile is part of boot
  buildRail();
  overlaySvg.attr('viewBox', `0 0 ${view.W} ${view.H}`)
    .attr('width', view.W).attr('height', view.H);

  // First paint: set, never animate the initial render (precedent rule).
  const first = BEAT_INDEX[0];
  if (first) {
    enterScene(first.scene);
    if (engine && first.beat.state && activeLayout.states[first.beat.state]) {
      engine.setState(activeLayout.states[first.beat.state]);
    }
  }
  status('');

  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', onResize);
  computeActive();
}

boot();

/* Deterministic hook for tests, review screenshots, and the Gate 4 checks
 * (CONTRACT §10.9). Not used by the page itself. */
window.__rt = {
  get scenes() { return SCENES.map((s) => s.id); },
  get engine() { return engine; },
  get data() { return DATA; },
  get view() { return view; },
  get tier() { return tier; },
  get reducedMotion() { return reducedMotion; },
  get current() { return activeBeatKey; },
  // Async (CONTRACT §10.9 "work headlessly for review screenshots"):
  // a raw jump can land on a scene the one-scene-lookahead never
  // preloaded (natural scroll always activates scene k-1 first, which is
  // what triggers fetching scene k's needs — a deep-link has no k-1).
  // Awaiting loadSceneNeeds first means the target renders with its real
  // scene JSON / zoom tile instead of silently degrading to fallbacks.
  // Load BEFORE scrolling (not after): scrollIntoView() fires a native
  // 'scroll' event asynchronously, and if that lands mid-fetch it races
  // computeActive()'s own activateBeat/driveScrub pair against this
  // function's — loading first removes the race entirely.
  // For scrub beats, mirror computeActive()'s own sequence exactly
  // (activateBeat THEN driveScrub): activateBeat alone only snaps the
  // kf0 tween, which driveScrub immediately supersedes on real scroll —
  // a deep-link has no scroll to drive it, so it must call both, in order,
  // itself, or a scrub scene renders whatever was on screen before the
  // jump instead of its own kf0.
  async activate(sceneId, beatId) {
    const entry = BEAT_INDEX.find((e) => e.scene.id === sceneId
      && (beatId === undefined || e.beat.id === beatId));
    if (!entry) return;
    await loadSceneNeeds(entry.scene).catch((e) => {
      console.warn(`[rt] __rt.activate('${sceneId}') preload failed`, e);
    });
    entry.sentinel.scrollIntoView();
    activateBeat(entry);
    if (entry.scrub) driveScrub(entry);
  },
};
