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
/*                                                                       */
/* GATE-4 ROUND 2 (structure-spec §6): the revision council evaluated a  */
/* reorder (s13 between s11 and s12) and REJECTED it for this pass --    */
/* zero reorder_needed. s12/s13 instead fold into the Skill-5 act as its */
/* two "fake flaws" before s14's real one, entirely in prose (kickers +  */
/* beat html), with no registry surgery and no transition re-QA. Cuts:   */
/* none -- every scene carries a named skill job in the structure spec.  */
/* Do not reorder or comment out any line below without a corresponding  */
/* structure-spec revision; this array is intentionally untouched.       */
/*                                                                       */
/* PHASE 6 (v2 epilogue): s19 ("The morning after," storyboard §5 SE1)   */
/* is wired into the SCENES array between s17 and s18 per SE1's own      */
/* placement guidance and this build's explicit instruction -- s18 stays */
/* the final scene, the rail still releases there. The import line below */
/* sits after s18's for minimal diff; array position is what determines  */
/* scroll order (main.js §6.3: "registry order = storyboard order =      */
/* scroll order"), not import order.                                     */

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
import s19 from './scenes/s19.js';  // v2 epilogue, placed between s17 and s18

const SCENES = [
  s01, s02, s03, s04, s05, s06, s07, s08, s09,
  s10, s11, s12, s13, s14, s15, s16, s17, s19, s18,
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
  // Mobile floors (final-polish layout audit at 390x844): a bare 6%
  // margin put region.x at 23px, so every scene's left-of-axis tick
  // labels ("100¢", axis titles) rendered up to 25px off-screen left --
  // 48px clears the widest live label ("100¢" was still 4px out at 44).
  // Same story vertically: region.y at 50px sat scene kickers, axis
  // titles, and s08's period-band row underneath the fixed grain plate
  // (measured bottom ~64px on the two-line mobile clamp, grazes seen up
  // to 15px deep at a 96px floor); 108px clears every measured row. The
  // region BOTTOM stays exactly where it was (62vh, the prose sheet's
  // top edge), so only the stage's own height absorbs the shift.
  const region = mobile
    ? (() => {
        const mx = Math.max(W * 0.06, 48);
        const my = Math.max(H * 0.06, 108);
        return { x: mx, y: my, w: W - mx - W * 0.06, h: H * 0.62 - my };
      })()
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
    // Persistent color key update API (design-revision-spec G1), exposed
    // on `view` per the spec's "expose it on the view or a shared module"
    // instruction -- the same escape-hatch pattern activateSceneState()
    // already uses for mid-scene interactives (S14's toggle, S18's picker)
    // that need to drive chrome outside the normal beat-activation flow.
    setChip: (rows) => setChip(rows),
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
/* Persistent color key + grain plate (CONTRACT §7)                  */
/* Key rebuilt per design-revision-spec G1 (Gate-4 round 2): a stacked   */
/* list, one row per active color meaning, each row a rendered swatch +  */
/* plain color word + meaning -- recognition over recall. #chip/#key-rows*/
/* markup and the standing rest-field debut row live in index.html; this */
/* module only ever repopulates #key-rows, never hides the container.    */

const chipEl = document.getElementById('chip');
const chipRowsEl = document.getElementById('key-rows');
const plateEl = document.getElementById('grain-plate');
let chipText = null;              // fingerprint of the last-rendered rows

const KEY_MAX_MEANING_ROWS = 3;   // + 1 standing row per beat (G1, 4+/-1)

/* Swatch fill (G1): every glyph renders at alpha 1.0 EXCEPT the two
 * state-swatches -- 'dim' (the resting field) and 'dead' (settled money)
 * -- which render at their own particle-state alpha so the key matches
 * what the reader actually sees on screen rather than a boosted preview. */
function keySwatchRGBA(token, glyph) {
  if (glyph === 'dim') return particleState(tokens, 'rest');
  if (glyph === 'dead') return particleState(tokens, 'dead');
  return colorOf(tokens, token, 1.0);
}
function rgbaCss(rgba) {
  const [r, g, b, a] = rgba;
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

/* Glyph-true swatches (G1): the key must reproduce the actual mark, never
 * default every row to a dot -- dot = money (filled circle) · line = D3
 * price/model line · dash = Pinnacle requotes · block = Polymarket minutes
 * · box = non-money D3 marks, outline-only (filled-vs-outline is the
 * piece's "dots are money" grammar, so it must be legible in the key too)
 * · ramp = brightness-means-density (S4 b1) · dim/dead = state swatches,
 * see keySwatchRGBA above. A row with no token/glyph (the bare-string
 * compat branch below) renders an empty slot rather than a wrong mark. */
function makeKeySwatch(token, glyph) {
  const el = document.createElement('span');
  const g = glyph || 'dot';
  el.className = `key-swatch key-swatch-${g}`;
  el.setAttribute('aria-hidden', 'true');
  if (!token || !glyph) { el.style.visibility = 'hidden'; return el; }
  const css = rgbaCss(keySwatchRGBA(token, glyph));
  switch (glyph) {
    case 'line':
      el.style.width = '12px'; el.style.height = '2px'; el.style.borderRadius = '0';
      el.style.background = css;
      break;
    case 'dash':
      el.style.width = '10px'; el.style.height = '2px'; el.style.borderRadius = '0';
      el.style.background = `repeating-linear-gradient(to right, ${css} 0 3px, transparent 3px 5px)`;
      break;
    case 'block':
      el.style.width = '12px'; el.style.height = '8px'; el.style.borderRadius = '2px';
      el.style.background = css;
      break;
    case 'box':
      el.style.width = '12px'; el.style.height = '8px'; el.style.borderRadius = '2px';
      el.style.background = 'transparent';
      el.style.border = `1.5px solid ${css}`;
      break;
    case 'ramp': {
      const lo = rgbaCss(keySwatchRGBA(token, 'dim'));
      const hiRgba = colorOf(tokens, token, 1.0);
      const mid = rgbaCss([hiRgba[0], hiRgba[1], hiRgba[2], 0.6]);
      const hi = rgbaCss(hiRgba);
      el.style.width = '12px'; el.style.height = '8px'; el.style.borderRadius = '2px';
      el.style.background = `linear-gradient(to right, ${lo} 0 33%, ${mid} 33% 66%, ${hi} 66% 100%)`;
      break;
    }
    case 'dot':
    case 'dim':
    case 'dead':
    default:
      el.style.width = '10px'; el.style.height = '10px'; el.style.borderRadius = '50%';
      el.style.background = css;
      el.style.border = '1px solid rgba(124, 135, 148, 0.4)';
      break;
  }
  return el;
}

/* The key's update API (G1). rows: [{token, glyph, label}], label <= 9
 * words, capped to 3 meaning rows + 1 standing row per beat. Also exposed
 * as `view.setChip` (computeView(), above) for mid-scene interactives.
 *
 * Backward-compat shim: a scene module not yet migrated to the row-array
 * shape (structure-spec §9's prose-rewrite pass) may still pass a bare
 * string -- every current `beat.chip: '...'` does, and so does s18.js's
 * own setChipDirect(). Rendered as one unlabeled text row so nothing
 * breaks; delete this branch once every scene ships row arrays. */
function setChip(rows) {
  if (typeof rows === 'string') {
    rows = rows ? [{ token: null, glyph: null, label: rows }] : [];
  }
  if (!rows || !rows.length) return;

  const fingerprint = JSON.stringify(rows);
  if (fingerprint === chipText) return;
  chipText = fingerprint;

  const capped = rows.slice(0, KEY_MAX_MEANING_ROWS + 1);
  const render = () => {
    chipRowsEl.innerHTML = '';
    for (const row of capped) {
      const rowEl = document.createElement('div');
      rowEl.className = 'key-row';
      rowEl.appendChild(makeKeySwatch(row.token, row.glyph));
      const label = document.createElement('span');
      label.textContent = row.label;
      rowEl.appendChild(label);
      chipRowsEl.appendChild(rowEl);
    }
    chipRowsEl.style.opacity = '1';
  };

  if (reducedMotion) {
    render();
  } else {
    // Outgoing/incoming rows crossfade over --dur-recolor-min (500ms, G1);
    // the pulse below fires at t=0 of the change, never at tween end.
    chipRowsEl.style.opacity = '0';
    requestAnimationFrame(render);
  }

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
  // Ordinal-correct sampling text (Gate-4 visual-story review, s08 grain
  // plate read "every 243th"): templates write "every {n}th"; the whole
  // '{n}th' unit is replaced first so the suffix agrees with the number
  // (243rd, 132nd, 101st). Bare '{n}' still substitutes plainly.
  const nTxt = formatSlot(n, 'count');
  const v = n % 100;
  const ordSuffix = (v >= 11 && v <= 13) ? 'th'
    : (n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th');
  // Gate-5 provenance audit (s06 finding, WRONG_SCOPE): `spec.trades` is
  // every zoom tile's own RAW pre-thin lifetime count (build_tiles.py
  // ships `n_raw`, not the post-thin packed row count, for every one of
  // the four zoom tiles) -- {count} reads it directly. The previous
  // `spec.trades * spec.build_stride` double-applied the thinning factor
  // for any tile whose meta already carried the raw count (mexeng:
  // 999,889 raw -> was reported as 1,999,778), silently contradicting
  // that same scene's own prose ("in about a million separate trades").
  return (template || scene.zoom.grainText)
    .replace('{n}th', nTxt + ordSuffix)
    .replace('{n}', nTxt)
    .replace('{count}', formatSlot(spec.trades, 'count'));
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
      // GATE-4 ROUND 2 (structure-spec §2/§3): the course spine is carried
      // on screen by scene kickers ("Skill 1 of 5", ...), distinct from
      // each scene's own dramatic title. A scene module that has adopted
      // the new `kicker` field wins here; `title` (today's behavior) is
      // the fallback for any scene not yet migrated by the prose-rewrite
      // pass, so this ships safely ahead of and after that pass lands.
      card.innerHTML =
        `<div class="kicker">${scene.kicker || scene.title || scene.id}</div>${beat.html || ''}`;
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
  watchMobileCardSpotlight();
}

/* Mobile card spotlight (final-polish reader feedback): on the phone the
 * bottom-sheet card sits directly over the full-viewport particle field,
 * and the two fight for attention. While any STEP-beat card is on screen
 * the stage fades down and the card gets the light; scroll the card out
 * and the stage comes back up for the animation between cards. The CSS
 * side lives in index.html under the max-width:900px block
 * (body.mobile-card-lit #stage). Scrub-track cards are deliberately
 * excluded: their card stays pinned for the whole tick-level zoom, and
 * dimming the tape for the entire scrub would kill the very scenes the
 * piece zooms in for -- readability there is carried by the sheet's own
 * near-opaque mobile background instead. Reduced-motion keeps the
 * opacity crossfade (the piece's allowed transition class). */
let spotlightIO = null;
function watchMobileCardSpotlight() {
  const mq = window.matchMedia('(max-width: 900px)');
  const visible = new Set();
  const apply = () => {
    document.body.classList.toggle(
      'mobile-card-lit', mq.matches && visible.size > 0);
  };
  if (spotlightIO) spotlightIO.disconnect();
  spotlightIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target);
      else visible.delete(e.target);
    }
    apply();
  }, { threshold: 0.05 });
  for (const entry of BEAT_INDEX) {
    if (!entry.scrub) spotlightIO.observe(entry.card);
  }
  // Crossing the breakpoint either way re-evaluates without a scroll.
  mq.addEventListener('change', apply);
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
  // Fast-scroll data race: a quick scroll can outrun the one-scene
  // lookahead, mounting a scene before its lazy JSON/zoom tile arrived
  // (observed as s05 rendering with a collapsed band + console warn).
  // Scenes degrade gracefully on missing data, so render now with what we
  // have, then re-enter once the fetch lands if the reader is still here —
  // computeActive() re-runs the normal enter + beat-activation path.
  const n = scene.needs || {};
  const missing = (n.scene && manifest.scenes[scene.id] && !DATA.scenes[scene.id])
    || (n.zoom && !DATA.zoom[n.zoom]);
  if (missing) {
    loadSceneNeeds(scene).then(() => {
      if (activeScene === scene) {
        // Reset the beat key too: computeActive() re-activates via
        // activateBeat(), whose same-key early return fires BEFORE its
        // enterScene() call — with the key left in place the "re-enter
        // once the fetch lands" below never actually re-entered, and a
        // degraded mount (empty scene JSON / zoom tile) stayed on screen
        // for good (observed: s13 rendering only its caption + dot field
        // when a fast scroll outran the s13.json fetch).
        activeScene = null; activeBeatKey = null;
        computeActive();
      }
    }).catch(() => {});
  }
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
  // Leaving a scrub track for a step beat brings the mobile KEY back
  // (see driveScrub's scrub-deep retreat).
  if (!entry.scrub) document.body.classList.remove('scrub-deep');
  enterScene(entry.scene);
  const beat = entry.beat;

  if (beat.grain) {
    // Zoom beats template their grain text with {n}/{count} (CONTRACT
    // §4.3); a beat may carry its own vehicle-specific template (e.g.
    // s01's beat appends "France–Spain, July 14") so the template comes
    // from the beat itself, not always the scene's bare zoom.grainText.
    const needsZoomFill = entry.scene.zoom && /\{n\}|\{count\}/.test(beat.grain.text);
    let text = needsZoomFill ? zoomGrainText(entry.scene, beat.grain.text) : beat.grain.text;
    // Non-zoom "return" plates (S2/S3/S5/S9/S12-S19) restate the LIVE
    // per-device grain dollar figure via a `{grainUsd}` token instead of
    // a hardcoded desktop-only literal (Gate-5 provenance audit: shipped
    // beats read a flat "$75,000" even on the mobile tier, where the
    // loaded population tile's own grain is $250,000 -- view.grain.usd
    // is always the figure for the ACTUALLY loaded tile, set once at
    // boot from the tile's own manifest spec). Full-dollar form (not
    // fmt.usd's "$75K" abbreviation) matches this prose register.
    if (text.indexOf('{grainUsd}') !== -1) {
      text = text.replace('{grainUsd}', `$${Math.round(view.grain.usd).toLocaleString('en-US')}`);
    }
    setGrainPlate(text);
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

  // Mobile scrub-deep KEY retreat (final-polish blind mobile round): on a
  // phone the KEY panel floats over the stage band where the scrub scenes'
  // late-tape climaxes land (s02's June-11 wall + you-are-here + axis
  // tail; s08's Tah spike label, deciding-kick callout, and kick strip
  // were all painting behind it). By 60% of a scrub track the palette has
  // been on screen the whole time; the panel slides away so the climax
  // annotations own that band, and slides back on scroll-up or at the
  // next step beat (activateBeat clears the class). Desktop is untouched,
  // and the CSS transition is an allowed transform crossfade. Placed
  // before the reduced-motion early return so both paths get it, keyed
  // on raw (the honest scroll position, not the smoothed lerp).
  document.body.classList.toggle('scrub-deep', view.mobile && raw > 0.6);

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

  // 3. Rail FIRST — pure DOM + inline CSS from the static scene registry, so
  // the scroll runway and readable prose exist immediately, independent of the
  // (multi-second) engine + population-tile load. Without this ordering an
  // early scroll during boot finds a zero-height rail and overshoots straight
  // to the methods footer.
  if (!SCENES.length) {
    console.warn('[rt] no scene modules registered yet — rail is empty');
    status('');
    return;
  }
  buildRail();
  overlaySvg.attr('viewBox', `0 0 ${view.W} ${view.H}`)
    .attr('width', view.W).attr('height', view.H);

  // 4. Engine + population tile (tier fallback chain inside).
  status('loading the population…');
  await bootEngine();
  status('loading scene data…');
  await loadSceneNeeds(SCENES[0]);      // S1's zoom tile is part of boot

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
