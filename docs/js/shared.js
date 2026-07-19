/* shared.js — Regulation Time
 *
 * The one module both main.js and every scene module may import.
 * Contract: docs/CONTRACT.md §6.1 (scale registry), §5 (binary readers),
 * §8.6 (data-slot formatters). No DOM writes, no GL, no fetches here.
 */

/* ---------------------------------------------------------------- */
/* Scale registry (CONTRACT §6.1)                                    */
/* Keys are namespaced 'sNN.name' (scene-owned) or 'global.name'     */
/* (main.js-owned). Scenes register inside scales(); the driver      */
/* clears a scene's keys on exit.                                    */

const _scales = new Map();

export const registry = {
  register(key, scale) {
    _scales.set(key, scale);
    return scale;
  },
  get(key) {
    if (!_scales.has(key)) {
      throw new Error(`[rt] scale registry miss: ${key}`);
    }
    return _scales.get(key);
  },
  has(key) {
    return _scales.has(key);
  },
  clearScene(sceneId) {
    for (const k of _scales.keys()) {
      if (k.startsWith(sceneId + '.')) _scales.delete(k);
    }
  },
};

/* ---------------------------------------------------------------- */
/* Token color helpers                                               */
/* tokens = parsed docs/design/tokens.json. Colors reach the engine  */
/* as [r,g,b,a] floats; overlays should prefer CSS custom properties */
/* via cssVar() so tokens.css stays the CSS-layer law.               */

export function colorOf(tokens, name, alpha) {
  const c = tokens.colors[name];
  if (!c) throw new Error(`[rt] unknown color token: ${name}`);
  const [r, g, b, a] = c.rgba;
  return [r, g, b, alpha === undefined ? a : alpha];
}

export function particleState(tokens, name) {
  const s = tokens.particle_states[name];
  if (!s || !s.rgba) throw new Error(`[rt] unknown particle state: ${name}`);
  return s.rgba.slice();
}

export function cssVar(name) {
  return `var(--${name})`;
}

export function durationMs(tokens, name) {
  const d = tokens.motion.durations_ms[name];
  if (d === undefined) throw new Error(`[rt] unknown duration token: ${name}`);
  return d;
}

/* Write one rgba into a color array at dot index i. */
export function setColor(colorArray, i, rgba) {
  const o = i * 4;
  colorArray[o] = rgba[0];
  colorArray[o + 1] = rgba[1];
  colorArray[o + 2] = rgba[2];
  colorArray[o + 3] = rgba[3];
}

/* Allocate an empty DotState for N dots (CONTRACT §3.2). */
export function makeState(n) {
  return {
    x: new Float32Array(n),
    y: new Float32Array(n),
    color: new Float32Array(n * 4),
    size: new Float32Array(n),
  };
}

/* ---------------------------------------------------------------- */
/* Binary tile readers (CONTRACT §5)                                 */

const DTYPES = {
  u8: { ctor: Uint8Array, bytes: 1 },
  u16: { ctor: Uint16Array, bytes: 2 },
  u32: { ctor: Uint32Array, bytes: 4 },
  f32: { ctor: Float32Array, bytes: 4 },
};

/* All tiles are little-endian; typed-array views require a LE host.
 * Every shipping browser is LE; refuse loudly rather than misread. */
export function assertLittleEndian() {
  if (new Uint8Array(Uint32Array.of(1).buffer)[0] !== 1) {
    throw new Error('[rt] big-endian host: packed tiles unreadable');
  }
}

export function checkMagic(buffer, magic) {
  const got = String.fromCharCode(...new Uint8Array(buffer, 0, magic.length));
  if (got !== magic) {
    throw new Error(`[rt] bad tile magic: expected ${JSON.stringify(magic)}, got ${JSON.stringify(got)}`);
  }
  return new DataView(buffer).getUint32(8, true); // u32 count at byte 8
}

/* Build zero-copy column views from a manifest columns spec:
 * columns = [{ name, dtype, offset }], count = row count. */
export function columnViews(buffer, columns, count) {
  const out = { count };
  for (const col of columns) {
    const dt = DTYPES[col.dtype];
    if (!dt) throw new Error(`[rt] unknown dtype ${col.dtype} for ${col.name}`);
    if (col.offset % dt.bytes !== 0) {
      throw new Error(`[rt] misaligned column ${col.name} @ ${col.offset}`);
    }
    out[col.name] = new dt.ctor(buffer, col.offset, count);
  }
  return out;
}

/* Population flags helpers (CONTRACT §5.3). */
export function flagBit(manifest, flagName) {
  const i = manifest.enums.flags.indexOf(flagName);
  if (i < 0) throw new Error(`[rt] unknown flag: ${flagName}`);
  return 1 << i;
}

export function indicesWithFlag(flagsColumn, bit) {
  const out = [];
  for (let i = 0; i < flagsColumn.length; i++) {
    if (flagsColumn[i] & bit) out.push(i);
  }
  return out;
}

/* ---------------------------------------------------------------- */
/* Formatters (CONTRACT §8.6 data-slot; tabular-nums do the rest)    */

export const fmt = {
  usd(v) {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${Math.round(v).toLocaleString('en-US')}`;
  },
  count(v) {
    return Math.round(v).toLocaleString('en-US');
  },
  cents(v) {
    return `${v}¢`;
  },
  pct(v) {
    return `${(+v).toFixed(1)}%`;
  },
  iso(v) {
    return String(v).replace('T', ' ').replace(/\.\d+Z$/, 'Z');
  },
};

export function formatSlot(value, format) {
  const f = fmt[format];
  return f ? f(value) : String(value);
}

/* Resolve 'a.b.c' into a nested object (manifest paths for data-slot). */
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/* ---------------------------------------------------------------- */
/* Axis-label standard (design-revision-spec G3, Gate-4 round 2).    */
/* Pure position/style spec builders only -- this module's own contract
 * (top of file) is "no DOM writes here." A scene applies the returned
 * attrs/style to its own D3 <text> selection, e.g.:
 *   g.append('text').attr('x', p.x).attr('y', p.y)
 *    .attr('text-anchor', p.textAnchor).call(applyAxisTitleStyle)
 *    .text(axisLabel('trades arriving', 'per second'));
 * Centralizing the math/wording here means all 18 scenes' axis titles
 * agree on placement and register without each hand-deriving the rule. */

/* Shared type spec for every axis title (G3): font-apparatus, caption
 * size, weight 500, ink-mid. `sel` is a D3 selection (or a plain object
 * with a `.style` method matching that call shape); this only sets
 * style, so it composes with whatever `.attr()` chain the caller builds. */
export function applyAxisTitleStyle(sel) {
  return sel
    .style('font-family', 'var(--font-apparatus)')
    .style('font-size', 'var(--type-caption-size)')
    .style('font-weight', 500)
    .style('fill', 'var(--ink-mid)');
}

/* X title: centered beneath the tick labels, offset --space-24 below the
 * axis line (region.y + region.h). */
export function axisTitleXAttrs(view) {
  const r = view.region;
  return { x: r.x + r.w / 2, y: r.y + r.h + 24, textAnchor: 'middle' };
}

/* Y title: HORIZONTAL, never rotated (no `transform: rotate(...)`);
 * left-aligned over its axis, --space-12 above the topmost tick. One
 * licensed piece-wide exception (S14's "perfectly priced" diagonal label,
 * which names the line itself) is a scene-level call, not this helper's. */
export function axisTitleYAttrs(view) {
  const r = view.region;
  return { x: r.x, y: r.y - 12, textAnchor: 'start' };
}

/* Wording template (G3): "[what it measures] ([unit])", <= 7 words before
 * the parenthesis; omit the unit entirely when there isn't one. Scenes
 * still author their own measure/unit strings -- this just keeps the
 * parenthetical shape mechanically consistent piece-wide. */
export function axisLabel(measure, unit) {
  return unit ? `${measure} (${unit})` : measure;
}

/* Mobile: every bottom x-axis renders as d3.axisTop translated to
 * y = region.y + region.h, so tick labels sit above the axis line, inside
 * the stage -- the mobile stage bottom (~0.62H) abuts the 38vh prose sheet
 * and labels drawn below it are occluded (G3). Returns which D3 axis
 * constructor orientation to use; the scene still builds
 * `d3['axis' + capitalize(mobileAxisOrientation(view))](scale)` (or an
 * equivalent if/else) and positions the <g> at the y this implies. */
export function mobileAxisOrientation(view) {
  return view.mobile ? 'top' : 'bottom';
}
