/* docs/js/scenes/s16.js — "How to read the number" (the lens sequence)
 *
 * Storyboard: research/storyboard.md, Act V, S16 (§3, lines ~326-349) and
 * §4 ("The ending: lens selection and order"). CONTRACT registry: id s16,
 * act 5, layoutName 'lens-carousel', 5 steps, "one anchor grammar per
 * lens via sibling anchors exports" (docs/CONTRACT.md §4.2).
 *
 * Five lens beats, each re-sorting the population into a scaled-down echo
 * of exactly one prior scene's anchor mark (CONTRACT §4 `anchors?`):
 *   L1 braid  <- s10   L2 curve <- s14   L3 mirror <- s09
 *   L4 pair   <- s13   L5 strip <- s15 (this build's own scene)
 * No new analysis tables (storyboard S16 Data note): every number a lens
 * shows is whatever the source scene already computed from the tile.
 *
 * CROSS-SCENE DATA CONTRACT (read this before touching s09/s10/s13/s14):
 * this scene's own `needs.series` is the UNION of every sibling anchor
 * owner's `needs.series`, computed programmatically below (never
 * hand-typed section names — this build does not invent manifest keys).
 * Anchor functions MUST be self-sufficient from data.pop / data.series /
 * data.manifest alone: (a) data.scene inside an anchor call is s16's own
 * scene JSON, not the owning scene's — s16 does not request scene:true,
 * so it will be null; (b) the scale registry keys the owning scene
 * registered (e.g. 's10.x') are deleted on that scene's exit
 * (CONTRACT §6.1 registry.clearScene) long before S16 mounts, so
 * `drawAxes(g)` must build fresh local scales, never `registry.get(...)`.
 * This exact requirement is also flagged in this build's data_requests
 * for the s09/s10/s13/s14 owners and for main.js's `sceneData()`.
 */

import { registry } from '../shared.js';
import s09 from './s09.js';
import s10 from './s10.js';
import s13 from './s13.js';
import s14 from './s14.js';
import s15 from './s15.js';

/* ---------------------------------------------------------------- */

function hash01(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function findIndex(list, candidates) {
  for (const c of candidates) {
    const i = (list || []).findIndex((t) => String(t).toUpperCase() === c.toUpperCase());
    if (i >= 0) return i;
  }
  return -1;
}

/* Gate-4 visual-story review fix (s16 Tier-1 C1 / major l1,l4-t0,l5): the
 * persistent color KEY (`#chip`, CSS `position: fixed; right/top`, z above
 * the WebGL canvas per tokens.css --z-chip-and-grain-plate) is already a
 * reserved, opaque-ish, no-other-content exclusion zone sized by
 * `layout.key-exclusion-w-px` / `-h-px` (design-revision-spec G5/CR-2).
 * Every sibling anchor's own "rest" branch scatters its non-story dots
 * across a chunk of the OWNING scene's full-stage rect -- proportionate
 * there, but this recap panel is ~40% that area (see layout() below), so
 * the same dot count lands far denser and blooms past the story mark
 * regardless of per-dot alpha (perception-brief P1: "no flat per-dot alpha
 * can fix this" without a density-aware engine cap, out of scope here).
 * Parking the resting population behind the KEY removes it from the axis
 * rectangle entirely instead of merely dimming it in place -- the
 * review's own suggested fix ("route and park in-transit population
 * outside the axis rectangle, gutter or behind a scrim"). Desktop-only:
 * mobile's key sits bottom-right in vh units this module has no clean px
 * handle on, so mobile keeps the previously-shipped in-rect bottom-strip
 * compaction instead (see layout() below). */
function keyGutterRect(view) {
  const L = view.tokens.layout;
  const sp = view.tokens.spacing_px;
  const w = L['key-exclusion-w-px'] || 280;
  const h = L['key-exclusion-h-px'] || 132;
  const margin = sp[4] || 24;
  return {
    x0: view.W - margin - w, x1: view.W - margin,
    y0: margin, y1: margin + h,
  };
}

/* Gate-4 visual-story review fix (s16 major: "the key panel occludes the
 * right-axis definitions... cannot be decoded"). Standard D3 tick-wrap
 * recipe (Bostock): break a text run into tspans that each measure under
 * `maxWidth`, so the unit ribbon never runs a single unbroken line under
 * the KEY panel regardless of viewport width. */
function wrapText(sel, text, maxWidth, lineHeightEm) {
  sel.text(null);
  const words = String(text).split(/\s+/).reverse();
  const x = sel.attr('x');
  const y = sel.attr('y');
  let word;
  let line = [];
  let lineNumber = 0;
  let tspan = sel.append('tspan').attr('x', x).attr('y', y);
  while ((word = words.pop())) {
    line.push(word);
    tspan.text(line.join(' '));
    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
      line.pop();
      tspan.text(line.join(' '));
      line = [word];
      lineNumber += 1;
      tspan = sel.append('tspan').attr('x', x).attr('y', y)
        .attr('dy', `${lineNumber * lineHeightEm}em`).text(word);
    }
  }
}

function siblingNeeds(mod, name) {
  try { return (mod && mod.needs && mod.needs.series) || []; }
  catch (e) { console.warn(`[rt/s16] ${name}.needs unreadable`, e); return []; }
}

const SIBLING_SERIES = Array.from(new Set([
  ...siblingNeeds(s09, 's09'), ...siblingNeeds(s10, 's10'),
  ...siblingNeeds(s13, 's13'), ...siblingNeeds(s14, 's14'),
  ...siblingNeeds(s15, 's15'),
]));

/* Opponent resolution: the storyboard names the two live candidates
 * explicitly ("the final is Spain against England or Argentina, July 19"
 * — research/storyboard.md line 3). The resolved opponent lands after the
 * England-Argentina semifinal settles and the G3 refresh rewrites
 * manifest.hero. The hero leg label may arrive as a full country name or
 * as a FIFA trigram (ENG/GB/GBR/ARG), so match both forms; an unresolved
 * or three-candidate provisional snapshot returns null and the opponent
 * highlight stays inert (no crash, no fallback banner). */
function opponentCode(manifest) {
  const legs = (manifest.hero && manifest.hero.legs) || [];
  // Prefer an explicitly-resolved opponent leg; fall back to legs[1].
  const labels = legs.map(l => (l && l.label || '').toUpperCase());
  const has = (...needles) => labels.some(lb => needles.some(n => lb === n || lb.includes(n)));
  // A resolved final has exactly two legs (Spain + opponent); a provisional
  // three-leg pair (ESP/ENG/ARG) is not yet resolved.
  const resolved = legs.length <= 2;
  if (resolved && has('ENGLAND', 'ENG', 'GB', 'GBR')) return 'ENG';
  if (resolved && has('ARGENTINA', 'ARG')) return 'ARG';
  return null;
}
function isArgentinaOpponent(manifest) {
  return opponentCode(manifest) === 'ARG';
}

function fallbackAnchor(data, view, rect) {
  // Graceful degrade if a sibling hasn't shipped `anchors` yet: population
  // rests, dimmed, nothing highlighted. Logged, never silent.
  const N = data.pop.count;
  const state = { x: new Float32Array(N), y: new Float32Array(N), color: new Float32Array(4 * N), size: new Float32Array(N) };
  const rest = view.state('dimmed-field-min');
  for (let i = 0; i < N; i++) {
    state.x[i] = rect.x + rect.w * (0.1 + 0.8 * hash01(i));
    state.y[i] = rect.y + rect.h * (0.1 + 0.8 * hash01(i * 3 + 1));
    state.color[i * 4] = rest[0]; state.color[i * 4 + 1] = rest[1];
    state.color[i * 4 + 2] = rest[2]; state.color[i * 4 + 3] = rest[3];
    state.size[i] = view.tokens.dot['radius-base-px'];
  }
  return { state, drawAxes() {} };
}

function callAnchor(mod, name, data, view, rect) {
  try {
    if (!mod || !mod.anchors || typeof mod.anchors[name] !== 'function') {
      throw new Error(`${mod && mod.id} anchors.${name} not implemented`);
    }
    const r = mod.anchors[name](data, view, rect);
    if (!r || !r.state) throw new Error(`${mod.id} anchors.${name} returned no state`);
    return r;
  } catch (e) {
    console.warn(`[rt/s16] anchor "${name}" unavailable — fallback rendered`, e);
    return fallbackAnchor(data, view, rect);
  }
}

/* Gate-4 visual-story review (RESHAPE directive): four of the five recap
 * charts need geometry that lives only in the OWNING scene's own JSON — the
 * braid's two price traces (L1), the shock timestamp (L3), the poll
 * percentage (L4), and the checkpoint dates + model line (L5). S16 itself
 * requests no new analysis table (storyboard S16 Data note: "no new
 * analysis tables"), but that note is about not inventing a SIXTH table;
 * reading a sibling scene's own already-published, already-verified JSON
 * is not inventing anything, and main.js already exposes every scene's
 * file at `manifest.scenes[id]` (the same URL its OWNING scene fetches via
 * `needs.scene: true`). This mirrors s18.js's own precedent of a scene
 * doing its own direct fetch when CONTRACT's sceneData() doesn't expose
 * what a build needs (s18's `loadMarketsRows`/`loadReplayIndex`). Fetched
 * once per page load, cached, and patched in without ever re-tweening a
 * dot position: every anchor below already places its dots truthfully
 * without this data; only the missing chart/axis/line geometry is being
 * completed once it arrives. */
let siblingJsonPromise = null;
function loadSiblingScenes(manifest) {
  if (siblingJsonPromise) return siblingJsonPromise;
  const get = (id) => {
    const url = manifest.scenes && manifest.scenes[id];
    if (!url) return Promise.resolve(null);
    return fetch(url).then((r) => (r.ok ? r.json() : null))
      .catch((e) => { console.warn(`[rt/s16] ${id}.json unavailable`, e); return null; });
  };
  siblingJsonPromise = Promise.all([get('s09'), get('s10'), get('s13'), get('s15')])
    .then(([s09json, s10json, s13json, s15json]) => ({ s09json, s10json, s13json, s15json }));
  return siblingJsonPromise;
}

/* Per-lens spotlight: which population indices are exempt from S16's own
 * progressive desaturation ramp (design-system.md §9 S16: "Global
 * desaturation ramps until only Spain and the opponent hold color").
 * Built independently of what a sibling anchor colors internally, purely
 * from data.pop columns + manifest enums — never invented. */
function computeSpotlight(lensIndex, data) {
  const { manifest, pop } = data;
  const N = pop.count;
  const spot = new Uint8Array(N);
  const winnerFuturesIdx = (manifest.enums.family || []).indexOf('winner_futures');
  if (lensIndex === 1) {
    // Gate-4 visual-story review fix (s16 critical: amber spans BOTH
    // diagonals at every price level, destroying the exactly-1-amber-
    // singleton budget). LORENZ_TAIL flags a MARKET by its own thin
    // lifetime dollar volume (pipeline/export/build_tiles.py), not a
    // price level, so on its own it scatters amber across the whole
    // curve. The beat's own claim is specifically about "cheap longshot
    // tickets" -- s14.js's own live scene already draws the line at
    // price_band <= 10c ("penny tickets," s14.js's cheapBuckets filter)
    // -- so amber here is gated on a thin-tail market AND a sub-10c
    // price. ALSO gated on settled (fate === yes/no), matching the exact
    // condition curve()'s own anchor (s14.js) uses to decide whether a
    // dot earns a real x(c)/y(realized) calibration position at all --
    // without this, an unsettled tail+cheap dot (open markets exist
    // today, match day) still lands in curve()'s OTHER branch, a
    // hash01-scattered position uncorrelated with price, which a
    // spotlight exemption then held at that scattered position instead
    // of relocating it, producing an unexplained amber diagonal streak.
    const bit = data.flagBit('LORENZ_TAIL');
    const PENNY_C = 10;
    const yesIdx = manifest.enums.fate.indexOf('settled_yes');
    const noIdx = manifest.enums.fate.indexOf('settled_no');
    for (let i = 0; i < N; i++) {
      if (!(pop.flags[i] & bit)) continue;
      if (pop.price_band[i] === 255 || pop.price_band[i] > PENNY_C) continue;
      if (pop.fate[i] !== yesIdx && pop.fate[i] !== noIdx) continue;
      spot[i] = 1;
    }
  } else if (lensIndex === 2) {
    // Family-gated to match what mirror()'s own anchor actually plots
    // (s09.js: `isNor = team===NOR && family===winner_futures`) -- a
    // NOR/ARG dot from any other family was previously spotlighted
    // (exempted from dimming/relocation below) while still sitting at
    // mirror()'s generic "rest" position and color, leaving unexplained
    // grey noise inside the axis rectangle.
    const nor = findIndex(manifest.teams, ['NOR']);
    const arg = findIndex(manifest.teams, ['ARG']);
    for (let i = 0; i < N; i++) {
      if (pop.family[i] !== winnerFuturesIdx) continue;
      if (pop.team[i] === nor || pop.team[i] === arg) spot[i] = 1;
    }
  } else if (lensIndex === 3) {
    const arg = findIndex(manifest.teams, ['ARG']);
    for (let i = 0; i < N; i++) if (pop.team[i] === arg && pop.family[i] === winnerFuturesIdx) spot[i] = 1;
  } else if (lensIndex === 4) {
    // Gate-4 visual-story review fix (s16 critical: "the dead element
    // owns the scene" -- France's settled money was exempt from dimming
    // and became the frame's luminance peak; a second, un-keyed teal
    // mass from `tintOpponent` below competed with Spain's own keyed red).
    // France is context now, not the figure ("Spain is the team still
    // playing tonight"): it no longer earns a spotlight exemption, so the
    // dim/relocate pass below treats it like any other resting money.
    // The opponent is dropped from the spotlight for the same reason
    // (see the now-unused `tintOpponent` below); only Spain, this beat's
    // one figure, stays lit.
    const esp = findIndex(manifest.teams, ['ESP', 'SPA']);
    for (let i = 0; i < N; i++) {
      if (pop.family[i] !== winnerFuturesIdx) continue;
      if (pop.team[i] === esp) spot[i] = 1;
    }
  }
  // lensIndex === 0 (braid): no dot-level spotlight; braid is D3-only
  // (S10's own population rests throughout — storyboard S10 Units).
  return spot;
}

// Alpha multiplier for non-spotlighted dots, per lens. L5's 0.18 (down
// from the shipped 1.0/0.75/0.55/0.35/0.18 progression) combined with
// France's own 0.55 base alpha (state-dead token) rendered functionally
// invisible once France stopped being spotlight-exempt (see layout()
// below) — the key row "grey = France, settled to zero" needs SOME
// findable mark, not zero. 0.4 keeps France well below Spain's full-alpha
// figure (Spain stays the one luminance peak) while staying findable.
const RAMP = [1.0, 0.75, 0.55, 0.35, 0.4];

/* identity-teal is unused as a team color elsewhere in the piece by this
 * point (venue.polymarket/identity.lavender is retired from the "venue"
 * meaning after Act III; chip re-narrates per design-system.md §2). Used
 * here, once, to give the final's opponent a body at L5 — flagged in
 * this build's notes for design-authority confirmation.
 *
 * NO LONGER CALLED (Gate-4 visual-story review fix, s16 major: "a small
 * teal Spain cluster despite the key saying red = Spain's money" — this
 * function was painting the OPPONENT teal with no key row of its own,
 * competing with Spain's actual keyed red mass and never resolved by the
 * design-authority flag above). computeSpotlight(4, ...) no longer
 * spotlights the opponent either, so its dots fall through to the
 * ordinary dim/relocate pass in layout() like any other resting money.
 * Left defined, unused, rather than deleted, so the design-authority
 * question stays visible in the diff. */
function tintOpponent(state, data, view) {
  const { manifest, pop } = data;
  const winnerFuturesIdx = (manifest.enums.family || []).indexOf('winner_futures');
  const opp = findIndex(manifest.teams, [opponentCode(manifest) || '\0']);
  if (opp < 0) return;
  const teal = view.color('identity-teal');
  for (let i = 0; i < pop.count; i++) {
    if (pop.team[i] === opp && pop.family[i] === winnerFuturesIdx) {
      state.color[i * 4] = teal[0]; state.color[i * 4 + 1] = teal[1];
      state.color[i * 4 + 2] = teal[2]; state.color[i * 4 + 3] = teal[3];
    }
  }
}

// Retitled per the Gate-4 round-2 structure spec §5 S16: the five cards
// are named, not renumbered (the "Skill N of 5" numbering belongs to the
// acts that taught each skill, in scene order, and this recital runs in a
// different order). The small-caps kicker therefore counts tonight's USE
// order, never re-using the acts' skill numbers; l1's narrated line
// bridges the order change. Each name is the literal instruction the
// reader carries into tonight. S17 §5 enumerates these five names word
// for word, so if you edit a title here, edit it there too.
const LOCKUPS = [
  { ordinal: 'First tonight', title: 'no one sharper' },
  { ordinal: 'Second tonight', title: 'trust the pools, smile at the ladders' },
  { ordinal: 'Third tonight', title: 'the spike is the price' },
  { ordinal: 'Fourth tonight', title: 'the flags don’t move it' },
  { ordinal: 'Fifth tonight', title: 'it holds opinions' },
];

export default {
  id: 's16',
  act: 5,
  title: 'How to read the number',
  kicker: 'The exam, part one: your five skills',
  layoutName: 'lens-carousel',

  needs: {
    scene: false,           // no new analysis tables (storyboard S16 Data note)
    series: SIBLING_SERIES, // union of the 5 anchor owners' own needs
    zoom: null,
  },

  scales(data, view) {
    // No scene-owned scales: each anchor's drawAxes builds its own local
    // scale (see file-header note). Nothing to register under 's16.*'.
    return {};
  },

  layout(data, view) {
    const rect = {
      x: view.region.x + view.region.w * 0.05,
      y: view.region.y + view.region.h * 0.05,
      w: view.region.w * 0.9,
      h: view.region.h * 0.9,
    };
    this._rect = rect; // reused by overlay() to place the recap-chart geometry below
    loadSiblingScenes(data.manifest); // fire-and-forget: give the fetch a head start; consumed in overlay()
    // ENCODING (perception-brief §9b/§10.1,4): each lens must read as one
    // active subset popping against a dimmed resting field. The pop is
    // luminance, resolved engine-side by per-dot alpha tier — so the
    // non-spotlighted field must land in rest-tier (alpha <=
    // dot.opacity-rest-classify-max 0.42) for the engine to dim it. The RAMP
    // multiplier below already carries the progressive desaturation the design
    // note calls for; dimCeil is the guarantee that whatever alpha a sibling
    // anchor handed back, the resting field never floats up into the
    // unclassified 0.42-0.90 band and stops receding. Spotlighted dots are
    // exempt and keep their anchor alpha (~1.0 -> active-tier, boosted).
    // Gate-4 visual-story review re-capture (this pass): a recap panel is
    // ~40% the area of its parent scene's own stage, so the same dot count
    // lands at higher local density here than in the scene it echoes. The
    // parent scenes' own dimmed-field-max (0.40) still let several recap
    // panels' non-spotlighted texture compete with the one story line/bar
    // this scene exists to show. Recap panels drop the ceiling one notch
    // further, to dimmed-field-min (0.25) — still a token this piece
    // already sanctions for a resting population, just the dimmer of the
    // two, and appropriate here because every recap's chart-first line/bar
    // is now the sole carrier (rule: "particles support as texture ...
    // never carry sole meaning").
    const dimCeil = view.tokens.dot['opacity-dimmed-field-min']; // 0.25, safely below classify-max
    const calls = [
      () => callAnchor(s10, 'braid', data, view, rect),
      () => callAnchor(s14, 'curve', data, view, rect),
      () => callAnchor(s09, 'mirror', data, view, rect),
      () => callAnchor(s13, 'pair', data, view, rect),
      () => callAnchor(s15, 'strip', data, view, rect),
    ];
    const gutter = keyGutterRect(view);
    const results = calls.map((fn, idx) => {
      const r = fn();
      const spot = computeSpotlight(idx, data);
      const ramp = RAMP[idx];
      const N = data.pop.count;
      // L3 (mirror, idx===2) only: the two identity hues (identity-blue /
      // identity-lavender) are near-isoluminant once bloomed (perception-
      // brief §9b: both land at ~1.0-1.15:1 contrast against field.rest —
      // functionally isoluminant), a token-level Tier-0 issue out of this
      // file's reach. The one lever this file owns is a deliberate
      // luminance/size split between the two spotlighted paths so they
      // stay tellable apart under bloom (Gate-4 visual-story review s16
      // critical: "give the two identity hues distinct lightness values").
      const norIdx = idx === 2 ? findIndex(data.manifest.teams, ['NOR']) : -1;
      // L5 (strip, idx===4) only: France keeps its own key row ("grey =
      // France, settled to zero") — de-spotlighting it (above) must dim
      // it, not disappear it, or the key row loses its mark and trades
      // one P3 key-hygiene violation for another. So France is the one
      // non-spotlighted population that keeps s15's own authored "pour"
      // position below and only loses brightness; every OTHER
      // non-spotlighted L5 dot (the un-keyed opponent tint this pass
      // removes, plus ordinary rest money) still relocates to the gutter.
      const winnerFuturesIdx = idx === 4 ? (data.manifest.enums.family || []).indexOf('winner_futures') : -1;
      const fraIdx = idx === 4 ? findIndex(data.manifest.teams, ['FRA']) : -1;
      for (let i = 0; i < N; i++) {
        if (!spot[i]) {
          state_dim(r.state, i, ramp);
          const isFranceInL5 = idx === 4 && data.pop.team[i] === fraIdx && data.pop.family[i] === winnerFuturesIdx;
          if (isFranceInL5) continue; // dimmed in place, position untouched
          // Gate-4 visual-story review fix (s16 Tier-1 C1 / major
          // l1,l4-t0,l5): park the resting population behind the KEY
          // instead of leaving it scattered across this rect (see
          // keyGutterRect() above for the full rationale). Mobile keeps
          // the previously-shipped in-rect bottom-strip compaction (no
          // clean px handle on the mobile key's vh-based position).
          if (view.mobile) {
            r.state.x[i] = rect.x + rect.w * hash01(i * 31 + 3);
            r.state.y[i] = rect.y + rect.h * (0.94 + 0.05 * hash01(i * 37 + 7));
          } else {
            r.state.x[i] = gutter.x0 + (gutter.x1 - gutter.x0) * hash01(i * 31 + 3);
            r.state.y[i] = gutter.y0 + (gutter.y1 - gutter.y0) * hash01(i * 37 + 7);
          }
          r.state.size[i] *= 0.5; // smaller footprint behind the translucent key card
        } else if (idx === 2) {
          if (data.pop.team[i] === norIdx) {
            r.state.color[i * 4 + 3] = Math.min(1, r.state.color[i * 4 + 3] * 1.15);
            r.state.size[i] *= 1.3;
          } else {
            r.state.color[i * 4 + 3] *= 0.55;
            r.state.size[i] *= 0.85;
          }
        }
      }
      return r;
    });
    this._anchors = results; // cached for overlay(); layout() runs before
                              // overlay() within the same enterScene() call
                              // (main.js §6.3 "on activation, in order").
    return {
      states: {
        lens0: results[0].state, lens1: results[1].state, lens2: results[2].state,
        lens3: results[3].state, lens4: results[4].state,
      },
    };

    function state_dim(state, i, factor) {
      // Progressive ramp, then a hard rest-tier ceiling so the resting field is
      // always dimmed by the engine (alpha <= classify-max), never stranded in
      // the unclassified band. Only non-spotlighted dots reach this path.
      state.color[i * 4 + 3] = Math.min(state.color[i * 4 + 3] * factor, dimCeil);
    }
  },

  overlay(container, data, view, scales) {
    const g = container.svg.append('g').attr('class', 's16-overlay');
    const anchors = this._anchors || [];
    const rect = this._rect
      || { x: view.region.x, y: view.region.y, w: view.region.w, h: view.region.h };

    const lockupOrd = g.append('text').attr('class', 's16-ord')
      .attr('x', view.region.x).attr('y', view.region.y - 28)
      .attr('fill', view.css('accent-annotation'))
      .attr('font-family', view.css('font-tape')).attr('font-size', view.css('type-tape-size'))
      .attr('letter-spacing', view.css('type-tape-tracking'))
      .attr('opacity', 0);
    const lockupTitle = g.append('text').attr('class', 's16-title')
      .attr('x', view.region.x).attr('y', view.region.y - 6)
      .attr('fill', view.css('ink-hi'))
      .attr('font-family', view.css('font-apparatus')).attr('font-weight', 600)
      .attr('font-size', view.css('type-kicker-size'))
      .attr('opacity', 0);
    // Unit ribbon (design-revision-spec §2 S16 item 3): one plain-words
    // line under each anchor's lockup, naming what its two axes measure —
    // the storyboard's promised mini-axes, at caption weight so the
    // recap stays fast to read.
    const unitRibbon = g.append('text').attr('class', 's16-ribbon')
      .attr('x', view.region.x).attr('y', view.region.y + 14)
      .attr('fill', view.css('ink-mid'))
      .attr('font-family', view.css('font-tape')).attr('font-size', view.css('type-micro-size'))
      .attr('letter-spacing', view.css('type-tape-tracking'))
      .attr('opacity', 0);
    const RIBBONS = [
      'x axis: Kalshi’s price (cents) · y axis: Polymarket’s price (cents)',
      'left axis: what the price implied (cents) · right axis: how often it happened (%)',
      // Gate-4 visual-story review fix (s16 critical: header claimed
      // "hours since the shock" while the rendered x-axis is a calendar
      // timeline — s09.js's mirror() anchor builds `d3.scaleUtc()` over
      // the full 14-month span, ticks(4), no y-axis is drawn at all).
      // Rewritten to match what a reader can actually decode on screen.
      'x axis: match date (dashed line marks the shock) · y axis: this team’s ticket price (cents)',
      'left axis: fans who said win (%) · right axis: market price (cents)',
      'left axis: five checkpoints · right axis: ticket price (cents), grey line is the model, devigged (bookmaker’s cut removed)',
    ];
    const axesG = g.append('g').attr('class', 's16-axes');

    /* -------------------------------------------------------------- */
    /* Supplementary chart geometry (RESHAPE): each function below adds
     * the ONE piece of real, data-derived geometry its lens's anchor
     * cannot supply on its own — never a second story mark, always the
     * thing the doctrine named as missing for that lens. All read from
     * data already fetched (either s16's own `data.pop`/`data.manifest`,
     * already loaded per `needs.series`, or a sibling scene's own JSON
     * once `loadSiblingScenes()` resolves it). Nothing here is invented:
     * every number plotted comes from a loaded array or object field. */

    // L1: the braid's own anchor has no price axis (its dot population
    // never carries a price — see s10.js's `braid()` comment), so the
    // "two crowds, one price" claim is otherwise untestable by eye. This
    // draws it as an agreement plot: one point per matched minute, Kalshi's
    // price on x, Polymarket's price on y. Tight to the diagonal = the two
    // crowds agreed. Subsampled to keep the mark count small for a recap
    // panel; every point plotted is a real matched-minute pair, never
    // interpolated.
    function drawAgreementScatter(target, s10json) {
      const b = s10json && s10json.braid;
      if (!b || !Array.isArray(b.kalshi_pts) || !Array.isArray(b.polymarket_pts)) return false;
      const n = b.kalshi_pts.length;
      const stride = Math.max(1, Math.floor(n / 400));
      const px = d3.scaleLinear().domain([0, 100]).range([rect.x + 8, rect.x + rect.w - 8]);
      const py = d3.scaleLinear().domain([0, 100]).range([rect.y + rect.h - 8, rect.y + 8]);
      const pts = [];
      for (let i = 0; i < n; i += stride) {
        const k = b.kalshi_pts[i], p = b.polymarket_pts[i];
        if (typeof k === 'number' && typeof p === 'number') pts.push([k, p]);
      }
      if (!pts.length) return false;
      const ax = target.append('g').attr('class', 's16-l1-chart');
      ax.append('g')
        .attr('transform', `translate(0,${rect.y + rect.h})`)
        .call(d3.axisBottom(px).ticks(4).tickFormat((d) => `${d}c`))
        .call((s) => {
          s.selectAll('text').attr('fill', view.css('ink-low'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
          s.selectAll('path,line').attr('stroke', view.css('ink-low'));
        });
      ax.append('g')
        .attr('transform', `translate(${rect.x},0)`)
        .call(d3.axisLeft(py).ticks(4).tickFormat((d) => `${d}c`))
        .call((s) => {
          s.selectAll('text').attr('fill', view.css('ink-low'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
          s.selectAll('path,line').attr('stroke', view.css('ink-low'));
        });
      ax.append('path').attr('fill', 'none').attr('stroke', view.css('ink-hi')).attr('opacity', 0.5)
        .attr('stroke-width', 1)
        .attr('d', d3.line().x((d) => px(d)).y((d) => py(d))([0, 100]));
      ax.selectAll('circle.s16-agree').data(pts).enter().append('circle').attr('class', 's16-agree')
        .attr('cx', (d) => px(d[0])).attr('cy', (d) => py(d[1])).attr('r', 1.6)
        .attr('fill', view.css('venue-kalshi')).attr('opacity', 0.55);
      ax.append('text').attr('x', rect.x).attr('y', rect.y - 6)
        .attr('fill', view.css('ink-mid'))
        .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-caption-size'))
        .text('each dot: one minute, Kalshi price vs Polymarket price');
      return true;
    }

    // L2: s14's own anchor plots the scatter and the plain y=x reference,
    // but draws no line through the realized rates themselves, so the
    // "calibrated" claim is left for the reader to eyeball from noise. This
    // recomputes the same dollar-weighted bucket average s14.js's anchor
    // already computes (duplicated in-file, matching this piece's existing
    // per-scene helper-duplication convention) and draws it as one
    // connected line. Buckets run low price to high price on x by
    // construction, and y is scaled 0 (bottom) to 100 (top) exactly like
    // every other axis in this piece, so a well-calibrated market draws a
    // line that climbs left-to-right — verified here, not assumed (Gate-4
    // visual-story review, s16 critical: "l2 slope-inversion").
    function drawCalibrationTrace(target) {
      const { pop, manifest } = data;
      const N = pop.count;
      const yesIdx = manifest.enums.fate.indexOf('settled_yes');
      const noIdx = manifest.enums.fate.indexOf('settled_no');
      const NB = 20;
      const bucketOf = (c) => Math.max(0, Math.min(NB - 1, Math.floor(c / (100 / NB))));
      const yesCt = new Float64Array(NB), totCt = new Float64Array(NB);
      for (let i = 0; i < N; i++) {
        const c = pop.price_band[i];
        if (c === 255) continue;
        if (pop.fate[i] === yesIdx) { const b = bucketOf(c); yesCt[b] += 1; totCt[b] += 1; }
        else if (pop.fate[i] === noIdx) { totCt[bucketOf(c)] += 1; }
      }
      const pts = [];
      for (let b = 0; b < NB; b++) {
        if (totCt[b] > 0) pts.push([(b + 0.5) * (100 / NB), 100 * yesCt[b] / totCt[b]]);
      }
      if (pts.length < 2) return;
      const px = d3.scaleLinear().domain([0, 100]).range([rect.x + 8, rect.x + rect.w - 8]);
      const py = d3.scaleLinear().domain([0, 100]).range([rect.y + rect.h - 8, rect.y + 8]);
      target.append('path').attr('class', 's16-cal-line')
        .attr('fill', 'none').attr('stroke', view.css('ink-hi')).attr('stroke-width', 2)
        .attr('d', d3.line().x((p) => px(p[0])).y((p) => py(p[1]))(pts));
      const last = pts[pts.length - 1];
      const labelX = px(last[0]);
      const labelY = py(last[1]) - 8;
      // Text-collision sweep (Gate-5 item 3 disposition 2): this label
      // rides the curve's own last point, which on this build's data sits
      // near the top-price bucket's high realized rate -- top-right of
      // the panel, directly under the fixed KEY. keyGutterRect() is this
      // file's own exclusion-rect helper (already used for the unit
      // ribbon's wrap width above); only clamp leftward when the label
      // would actually land inside the KEY's band, so a differently
      // calibrated future dataset that lands elsewhere is left alone.
      const gutter = keyGutterRect(view);
      const safeLabelX = (!view.mobile && labelY >= gutter.y0 - 12 && labelY <= gutter.y1)
        ? Math.min(labelX, gutter.x0 - 8)
        : labelX;
      target.append('text')
        .attr('x', safeLabelX).attr('y', labelY)
        .attr('text-anchor', 'end')
        .attr('fill', view.css('ink-hi'))
        .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'))
        .text('the market’s own line, bucket by bucket');
    }

    // L2 direct callout (Gate-4 visual-story review fix, s16 critical:
    // amber needs "a direct callout" once it is restricted to the
    // low-cent region by computeSpotlight above — a reader should not
    // have to infer the claim from an unlabeled color alone). Fixed
    // position at the low-price corner of the curve, where the now-
    // restricted amber cluster actually sits.
    function drawAmberCallout(target) {
      target.append('text')
        .attr('x', rect.x + 10).attr('y', rect.y + rect.h - 14)
        .attr('fill', view.css('accent-annotation'))
        .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'))
        .text('penny tickets (under 10c): pay off less often than they cost');
    }

    // L3 label collision fix (Gate-4 visual-story review follow-up: the
    // KEY word-wrap above can grow the unit ribbon to 2 lines, and s09.js's
    // own "Norway"/"Argentina" in-chart labels are hardcoded to a fixed
    // `rect.y - 6`, sized for the OLD one-line ribbon). Measures the
    // ribbon's own real rendered bbox (already final by the time this
    // runs — wrapText() executes before redrawAxes() in showLens() below)
    // rather than guessing a line count, and only pushes the labels down
    // as far as that measurement requires. The KEY chip already carries
    // the same "blue = Norway / lavender = Argentina" pairing as a
    // decode fallback either way.
    function fixMirrorLabelOverlap(target) {
      const node = unitRibbon.node();
      if (!node) return;
      const bbox = node.getBBox();
      const safeY = Math.max(rect.y - 6, bbox.y + bbox.height + 12);
      target.select('.s09-anchor-axes').selectAll(':scope > text').attr('y', safeY);
    }

    // Text-collision sweep (Gate-5 item 3 disposition 2): the same defect
    // fixMirrorLabelOverlap fixes for L3 also hits L2 -- s14.js's own
    // drawAxes() hardcodes its "implied vs realized, weighted by dollars"
    // title to rect.y - 6, sized for a one-line ribbon. L2's ribbon text
    // is long enough to wrap to two lines at this panel's width, and the
    // wrapped second line ("...happened (%)") lands right under this
    // title. Same fix, same measured-not-guessed approach.
    function fixCalibrationLabelOverlap(target) {
      const node = unitRibbon.node();
      if (!node) return;
      const bbox = node.getBBox();
      const safeY = Math.max(rect.y - 6, bbox.y + bbox.height + 12);
      target.select('.s14-anchor-axes').selectAll(':scope > text').attr('y', safeY);
    }

    // L5 tick-label collision fix (Gate-4 visual-story review fix, s16
    // major: "after the round of 16after the quarterfinals" — the five
    // checkpoint labels s15.js's strip() anchor draws collide edge-to-edge
    // at THIS panel's ~40%-area width; s15's own full-stage axis has room
    // for them horizontal). Standard D3 rotated-tick recipe, applied here
    // rather than in s15.js since the collision is a product of this
    // panel's width, not a defect in s15's own axis.
    function fixStripTickCollision(target) {
      target.selectAll('.s15-anchor-axes .tick text')
        .attr('text-anchor', 'end')
        .attr('transform', 'rotate(-28)')
        .attr('dx', '-0.4em').attr('dy', '0.5em');
    }

    // L3: the mirror's own anchor spreads Norway/Argentina across the
    // whole 14-month timeline, so the shock itself (a ~43-hour move) is a
    // few pixels wide against that span. A full re-zoom would mean
    // re-tweening the population outside this scene's normal scroll-driven
    // flow, which this build does not attempt; a labeled marker at the real
    // shock timestamp at least tells the reader where to look.
    function drawShockMarker(target, s09json) {
      const shocks = (s09json && s09json.shocks) || [];
      const nor = shocks.find((s) => s.team === 'NOR');
      if (!nor || !nor.shock_ts) return;
      const epochMs = new Date(data.manifest.epoch).getTime();
      const endMs = new Date(data.manifest.frozen_at || data.manifest.generated).getTime();
      const x = d3.scaleUtc().domain([epochMs, endMs]).range([rect.x + 8, rect.x + rect.w - 8]);
      const shockX = x(new Date(nor.shock_ts).getTime());
      target.append('line').attr('class', 's16-shock')
        .attr('x1', shockX).attr('x2', shockX)
        .attr('y1', rect.y).attr('y2', rect.y + rect.h)
        .attr('stroke', view.css('ink-low')).attr('stroke-dasharray', '2 3').attr('stroke-width', 1);
      // Text-collision sweep (Gate-5 item 3 disposition 2): this build's
      // real shock timestamp lands late enough in the 14-month span that
      // shockX sits inside the KEY's own x-range, and the label's fixed
      // rect.y + 12 sits inside its y-range too — "the shock" rendered
      // inside the KEY panel's own card. Drop the label to the bottom of
      // its own line (still directly on the mark it names) whenever the
      // top placement would land inside the KEY's exclusion rect.
      const gutter = keyGutterRect(view);
      const shockLabelYTop = rect.y + 12;
      const shockLabelY = (!view.mobile && shockX + 4 >= gutter.x0 - 8
        && shockLabelYTop >= gutter.y0 - 12 && shockLabelYTop <= gutter.y1)
        ? rect.y + rect.h - 8
        : shockLabelYTop;
      target.append('text').attr('x', shockX + 4).attr('y', shockLabelY)
        .attr('fill', view.css('ink-mid'))
        .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'))
        .text('the shock');
    }

    // L4: s13's own `pair()` anchor draws the outline poll bar and the
    // filled money column once `data.scene.pairs` is on hand (patched in
    // below), but neither carries its own number — a reader has to already
    // know "87%" and "11 cents" from the prose. Direct labels on the two
    // bars themselves are the doctrine's own rule ("labeled axes with
    // units, direct labels on lines/bars, no legend-hunting"). Both
    // numbers are read straight from the same s13.json fetch, never
    // recomputed or invented.
    function drawPairLabels(target, s13json) {
      const pairs = (s13json && s13json.pairs) || [];
      const argPair = pairs.find((p) => p.key === 'argentina' || p.team === 'ARG');
      if (!argPair) return;
      const py = d3.scaleLinear().domain([0, 100]).range([rect.y + rect.h - 8, rect.y + 8]);
      const pollX = rect.x + rect.w * 0.30;
      const colX = rect.x + rect.w * 0.60;
      if (typeof argPair.poll_pct === 'number') {
        target.append('text').attr('x', pollX).attr('y', py(argPair.poll_pct) - 10)
          .attr('text-anchor', 'middle').attr('fill', view.css('ink-mid'))
          .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'))
          .text(`${Math.round(argPair.poll_pct)}% said win (poll)`);
      }
      if (typeof argPair.kalshi_price_pct === 'number') {
        target.append('text').attr('x', colX).attr('y', rect.y + rect.h + 20)
          .attr('text-anchor', 'middle').attr('fill', view.css('identity-teal'))
          .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'))
          .text(`${argPair.kalshi_price_pct}c: the market`);
      }
    }

    // L4's Argentina callback (storyboard S16 Data note; see file-footer
    // NOTE): beats[].html is a static string consumed once by main.js's
    // buildRail() (CONTRACT §6.3), so a per-reader conditional cannot
    // reach the rail card through the documented contract. Rendered here
    // instead, into this scene's own `#html-overlay` div (pointer-events
    // none, matches every other non-interactive annotation in the piece),
    // positioned to read as part of the L4 beat rather than the rail.
    const argCallout = container.html.append('p').attr('class', 's16-arg-callout')
      .style('position', 'absolute')
      .style('left', `${view.region.x}px`)
      .style('bottom', `${Math.max(view.H - view.region.y - view.region.h + 24, 24)}px`)
      .style('max-width', '46ch')
      .style('font-family', view.css('font-prose'))
      .style('font-size', view.css('type-caption-size'))
      .style('color', view.css('ink-mid'))
      .style('opacity', 0)
      .text('That same 87% belongs to tonight’s crowd too. The price will not treat them any differently.');

    let siblingData = {};
    let currentAxes = null;

    // The one-time chart-geometry redraw, split out from showLens() so the
    // async sibling-JSON patch (below) can refresh a lens's chart without
    // re-firing the lockup/ribbon fade-in — a network response landing
    // while the reader sits still must not read as unexplained motion
    // (design-revision-spec G6: "stillness is the default").
    function redrawAxes(idx) {
      axesG.selectAll('*').remove();
      let handled = false;
      if (idx === 0) handled = drawAgreementScatter(axesG, siblingData.s10json);
      if (!handled) {
        const a = anchors[idx];
        if (a && typeof a.drawAxes === 'function') {
          try { a.drawAxes(axesG); } catch (e) { console.warn('[rt/s16] drawAxes failed', e); }
        }
      }
      if (idx === 1) { drawCalibrationTrace(axesG); drawAmberCallout(axesG); fixCalibrationLabelOverlap(axesG); }
      if (idx === 2) { drawShockMarker(axesG, siblingData.s09json); fixMirrorLabelOverlap(axesG); }
      if (idx === 3) drawPairLabels(axesG, siblingData.s13json);
      if (idx === 4) fixStripTickCollision(axesG);
    }

    function showLens(idx) {
      const l = LOCKUPS[idx];
      lockupOrd.text(l.ordinal.toUpperCase()).transition().duration(400).attr('opacity', 1);
      lockupTitle.text(l.title).transition().duration(400).attr('opacity', 1);
      // Gate-4 visual-story review fix (s16 major: the KEY panel occludes
      // the right-axis definitions in three of five beats — "how often it
      // happe...", "price (times its price before...", "grey line..." all
      // truncated). Wrap to the safe width left of the KEY's reserved
      // exclusion zone instead of one unbroken line that runs under it.
      const g = keyGutterRect(view);
      const maxRibbonWidth = Math.max(160, g.x0 - view.region.x - 16);
      wrapText(unitRibbon, RIBBONS[idx], maxRibbonWidth, 1.15);
      unitRibbon.transition().duration(400).attr('opacity', 1);
      redrawAxes(idx);
      currentAxes = idx;
      const showArg = idx === 3 && isArgentinaOpponent(data.manifest);
      argCallout.transition().duration(400).style('opacity', showArg ? 1 : 0);
    }

    // Hydrate L1/L3's supplementary geometry and L4/L5's real bar/line once
    // each sibling's own scene JSON resolves, then patch L4/L5's anchors in
    // place by re-invoking them (unmodified) with that JSON attached as
    // `data.scene` — exactly what s13.js's `pair()` and s15.js's `strip()`
    // already expect and already know how to draw; s16 was simply never
    // handing it to them (Gate-4 visual-story review Tier-1 C4/C5). Dot
    // positions are not re-tweened: every anchor already places its dots
    // truthfully without this data, so only the chart's axis/bar/line
    // geometry is being completed. A currently-visible L4/L5 lens gets a
    // silent redraw (no lockup re-fade, see redrawAxes() above); an
    // off-screen lens simply has its cached anchor updated for next time.
    loadSiblingScenes(data.manifest).then((sib) => {
      siblingData = sib;
      if (sib.s13json) {
        anchors[3] = callAnchor(s13, 'pair', Object.assign({}, data, { scene: sib.s13json }), view, rect);
      }
      if (sib.s15json) {
        anchors[4] = callAnchor(s15, 'strip', Object.assign({}, data, { scene: sib.s15json }), view, rect);
      }
      if (currentAxes !== null) redrawAxes(currentAxes);
    });

    return {
      step(beatId) {
        const idx = { l1: 0, l2: 1, l3: 2, l4: 3, l5: 4 }[beatId];
        if (idx !== undefined) showLens(idx);
      },
      exit() { g.remove(); argCallout.remove(); },
    };
  },

  beats: [
    {
      id: 'l1',
      html: '<p>Here are your five skills again. They come back in a new order now: the order you will need them tonight, not the order you learned them. First tonight: take the number at face value. Once you take out the bookmaker&rsquo;s fee, the price is the price. All tournament, the everyday crowd and the professional bookmakers scored the same, a day out from every match.<sup class="fn"><a href="#fn-16">16</a></sup> And the two crowd markets never drifted five cents apart for even half an hour.<sup class="fn"><a href="#fn-15">15</a></sup> No one sharper is hiding behind this number. Use it tonight: believe Spain&rsquo;s price.</p>',
      trigger: 'step', state: 'lens0', kind: 'resort',
      chip: [
        { token: 'venue-kalshi', glyph: 'dot', label: 'cyan dot = one minute, both venues' },
        { token: 'ink-low', glyph: 'dash', label: 'dashed = perfect agreement' },
      ],
      grain: { text: '1 dot = $75,000 of real money traded' },
      overlayStep: 'l1',
    },
    {
      id: 'l2',
      html: '<p>Second tonight: trust the deep pools, and smile at the penny ladders. Tonight&rsquo;s three-way market and the two teams&rsquo; championship tickets are the deepest pools this exchange has ever traded. Weighted by real dollars, those big markets priced almost perfectly all tournament.<sup class="fn"><a href="#fn-20">20</a></sup> The thin side bets, like first scorer or exact score, carried the one real flaw this study confirmed: a small tax on cheap longshot tickets.<sup class="fn"><a href="#fn-20">20</a></sup> Use it tonight: trust the big number, and shrug at the long-shot props.</p>',
      trigger: 'step', state: 'lens1', kind: 'resort',
      chip: [
        { token: 'field-rest', glyph: 'dim', label: 'pale = money at each price level' },
        { token: 'ink-hi', glyph: 'line', label: 'white line = the market’s own calibration' },
        { token: 'accent-annotation', glyph: 'dot', label: 'amber = the overpriced penny longshots' },
      ],
      overlayStep: 'l2',
    },
    {
      id: 'l3',
      html: '<p>Third tonight: if a goal lands, the jump is the new truth. Every clean goal spike this tournament held steady afterward; none of them snapped back like a panic.<sup class="fn"><a href="#fn-12">12</a></sup> The same math that cut Kane&rsquo;s price in half after 120 scoreless minutes prices any shock: what is left to happen, not what the highlight reel shows.<sup class="fn"><a href="#fn-19">19</a></sup> One rule for tonight, if the score is level near the ninetieth minute: the ninety-minute ticket has to slide toward zero by contract rules, not by belief. Watch the championship tickets instead.<sup class="fn"><a href="#fn-13">13</a></sup></p>',
      trigger: 'step', state: 'lens2', kind: 'resort',
      chip: [
        { token: 'identity-blue', glyph: 'dot', label: 'blue = Norway, rising' },
        { token: 'identity-lavender', glyph: 'dot', label: 'lavender = Argentina, falling' },
      ],
      overlayStep: 'l3',
    },
    {
      id: 'l4',
      html: '<p>Fourth tonight: the flags in the stadium do not move the price. 87 percent of Argentine fans, polled, said Argentina would win it all again. The market priced that same ticket at 11 cents.<sup class="fn"><a href="#fn-17">17</a></sup> All tournament, love for the home team moved how much money showed up, and never moved the price by more than a point or two.<sup class="fn"><a href="#fn-18">18</a></sup> Tonight the flags will be loud. The price will not care.</p>',
      trigger: 'step', state: 'lens3', kind: 'resort',
      chip: [
        { token: 'ink-mid', glyph: 'box', label: 'outline = what fans said (poll %)' },
        // Gate-4 visual-story review fix (s16 major: key swatch said grey,
        // the money renders teal — s13.js's pair() anchor colors
        // Argentina's money `identity-teal`). Swatch now matches the mark.
        { token: 'identity-teal', glyph: 'dot', label: 'filled = what the money said (cents)' },
      ],
      overlayStep: 'l4',
    },
    {
      id: 'l5',
      html: '<p>Fifth tonight: this market can hold one opinion for a long time. Take out the bookmaker&rsquo;s fee, a step this piece calls <strong>devigged</strong> (the bookmaker&rsquo;s cut removed), and the market priced France above a computer model for thirteen months, and Spain below it.<sup class="fn"><a href="#fn-21">21</a></sup> Spain is the team still playing tonight. Was that year-long doubt real information, or just a habit? No one can answer that yet. Tonight&rsquo;s number carries the answer, whichever way it turns out.</p>',
      trigger: 'step', state: 'lens4', kind: 'resort',
      chip: [
        { token: 'state-dead', glyph: 'dead', label: 'grey = France, settled to zero' },
        { token: 'identity-crimson', glyph: 'dot', label: 'red = Spain’s money' },
        { token: 'neutral-data', glyph: 'line', label: 'dashed grey = the model’s guess' },
      ],
      overlayStep: 'l5',
    },
  ],

  // reducedMotion: default (instant target + 400ms crossfade) matches the
  // storyboard exactly ("reduced-motion gets crossfades between held end
  // states" — S16 Scroll note); no per-beat override needed.
};

/* NOTE — L4's Argentina callback (storyboard S16 Data: "if Argentina, L4
 * gains a one-line callback to the 87% figure, drafted both ways at
 * Phase 4"). The storyboard defers the exact wording to this build; the
 * line drafted above ("The 87% figure belongs to tonight's opponent
 * too...") reuses the already-cited 87% figure verbatim (no new
 * footnote) and stays inside the piece's antithesis-mold cap (Appendix A
 * V2: capped at two uses piece-wide, both already spent by S2/S12).
 * beats[].html must be a plain string per CONTRACT §4.1, and main.js's
 * buildRail() reads it once at boot to build the static rail card — it
 * has no documented per-reader templating hook. So the England/Argentina
 * branch cannot land inside the rail card's own prose through the
 * current contract; it is rendered instead as a same-beat annotation in
 * `#html-overlay` (pointer-events: none, matching every other
 * non-interactive overlay text), shown only on l4 when
 * manifest.hero.legs[1].label resolves to Argentina. Flagged in this
 * build's returned notes as a possible CONTRACT/main.js gap (no
 * conditional-prose hook on beat html) for the prose-integration owner. */
