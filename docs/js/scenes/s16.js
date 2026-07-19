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
    const bit = data.flagBit('LORENZ_TAIL');
    for (let i = 0; i < N; i++) if (pop.flags[i] & bit) spot[i] = 1;
  } else if (lensIndex === 2) {
    const nor = findIndex(manifest.teams, ['NOR']);
    const arg = findIndex(manifest.teams, ['ARG']);
    for (let i = 0; i < N; i++) if (pop.team[i] === nor || pop.team[i] === arg) spot[i] = 1;
  } else if (lensIndex === 3) {
    const arg = findIndex(manifest.teams, ['ARG']);
    for (let i = 0; i < N; i++) if (pop.team[i] === arg && pop.family[i] === winnerFuturesIdx) spot[i] = 1;
  } else if (lensIndex === 4) {
    const fra = findIndex(manifest.teams, ['FRA']);
    const esp = findIndex(manifest.teams, ['ESP', 'SPA']);
    const opp = findIndex(manifest.teams, [opponentCode(manifest) || '\0']);
    for (let i = 0; i < N; i++) {
      if (pop.family[i] !== winnerFuturesIdx) continue;
      if (pop.team[i] === fra || pop.team[i] === esp || pop.team[i] === opp) spot[i] = 1;
    }
  }
  // lensIndex === 0 (braid): no dot-level spotlight; braid is D3-only
  // (S10's own population rests throughout — storyboard S10 Units).
  return spot;
}

const RAMP = [1.0, 0.75, 0.55, 0.35, 0.18]; // alpha multiplier for non-spotlighted dots, per lens

/* identity-teal is unused as a team color elsewhere in the piece by this
 * point (venue.polymarket/identity.lavender is retired from the "venue"
 * meaning after Act III; chip re-narrates per design-system.md §2). Used
 * here, once, to give the final's opponent a body at L5 — flagged in
 * this build's notes for design-authority confirmation. */
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
    const dimCeil = view.tokens.dot['opacity-dimmed-field-max']; // 0.40, safely below classify-max
    const calls = [
      () => callAnchor(s10, 'braid', data, view, rect),
      () => callAnchor(s14, 'curve', data, view, rect),
      () => callAnchor(s09, 'mirror', data, view, rect),
      () => callAnchor(s13, 'pair', data, view, rect),
      () => callAnchor(s15, 'strip', data, view, rect),
    ];
    const results = calls.map((fn, idx) => {
      const r = fn();
      const spot = computeSpotlight(idx, data);
      const ramp = RAMP[idx];
      const N = data.pop.count;
      for (let i = 0; i < N; i++) {
        if (!spot[i]) state_dim(r.state, i, ramp);
      }
      if (idx === 4) tintOpponent(r.state, data, view);
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
      'left axis: date of the knockout stage · right axis: price (1 point = 1 cent)',
      'left axis: what the price implied (cents) · right axis: how often it happened (%)',
      'left axis: hours since the shock · right axis: price (times its price before the shock)',
      'left axis: fans who said win (%) · right axis: market price (cents)',
      'left axis: five checkpoints · right axis: ticket price (cents), grey line is the model, devigged (bookmaker’s cut removed)',
    ];
    const axesG = g.append('g').attr('class', 's16-axes');

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

    let currentAxes = null;
    function showLens(idx) {
      const l = LOCKUPS[idx];
      lockupOrd.text(l.ordinal.toUpperCase()).transition().duration(400).attr('opacity', 1);
      lockupTitle.text(l.title).transition().duration(400).attr('opacity', 1);
      unitRibbon.text(RIBBONS[idx]).transition().duration(400).attr('opacity', 1);
      axesG.selectAll('*').remove();
      const a = anchors[idx];
      if (a && typeof a.drawAxes === 'function') {
        try { a.drawAxes(axesG); } catch (e) { console.warn('[rt/s16] drawAxes failed', e); }
      }
      currentAxes = idx;
      const showArg = idx === 3 && isArgentinaOpponent(data.manifest);
      argCallout.transition().duration(400).style('opacity', showArg ? 1 : 0);
    }

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
        { token: 'side-yes', glyph: 'line', label: 'cyan = Kalshi’s price' },
        { token: 'identity-lavender', glyph: 'line', label: 'lavender = Polymarket’s price' },
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
        { token: 'ink-mid', glyph: 'dot', label: 'filled = what the money said (cents)' },
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
