/* s01.js — "Ninety minutes in Arlington" (storyboard Act 0, S1)
 *
 * Contract: docs/CONTRACT.md §4 (scene shape), §4.2 (registry row: scrub,
 * <=6 viewport-heights total INCLUDING the static pre-title header),
 * §4.3 (zoom/tick semantics), §7 (grain plate / chip).
 * Design: research/design-system.md §9 "S1" (Grain Plate pre-title,
 * non-cuttable; side-binary cyan/orange debut; chip debut; amber at
 * the repricing event; the France pour is the piece's first sight of
 * state.dead grey).
 * Findings: research/findings-dossier.md R3/R20 (goal mechanism, no
 * exploitable fade) ground the "spike is the price" framing carried
 * forward by S7/S16-L3; this scene itself only narrates the settlement,
 * per storyboard R23-adjacent discipline (no cross-venue claims here).
 *
 * GATE-4 ROUND-2 REVISION (structure-spec §5 S1 / design-revision-spec §2
 * S1): kicker "Skill 1 of 5 — what a price means"; prose rewritten to
 * eighth-grade level teaching ticket-as-chance and settle before use;
 * boot/pre-title now paints EVERY dot at field.rest (CR-18) with tonight's
 * amber tag arriving as one announced, engine-onset-pulsed tween a hair
 * into the scrub rather than baked into the very first pixel; the whistle
 * annotation drops its amber halo/white core (declutter checklist) for
 * plain ink-mid text so "the goal" stays the scene's one amber unit; the
 * color key debuts here via the row-array `setChip` API, updated
 * imperatively as the scrub crosses pre-title -> zoom -> settle.
 *
 * GATE-4 ROUND-3 REVISION (s01 integrity pass, this file's sole-writer
 * scope): the data layer rebuilt zoom/fraesp.bin as FRANCE-LEG-ONLY (one
 * leg in manifest.zoom.fraesp.legs, ticker ...-FRA; no Spain/draw legs in
 * this tile anymore), which retires the "three legs mixed on one axis"
 * flag structurally -- isFranceLeg()'s companion-leg branch below is now
 * unreachable on real data (kept as a defensive no-op, not deleted, in
 * case a future data pull re-adds legs to this tile). The second flagged
 * issue -- the match-clock axis reading uniform minutes over a window that
 * actually opens ~4 days before kickoff -- survives the earlier
 * kickoff-relative fix (computeEnvelope's FRAESP_KICKOFF_UTC_MS math,
 * below) because that fix only stopped the axis from stretching to
 * 5000'+; it still drew the pre-kickoff rows inside the SAME positive
 * pixel range real early-match trades use (0'-7'), so a first-time reader
 * had no way to tell four-day-old positioning from the game's actual
 * opening minutes. Fixed here by reserving an honestly UNTICKED sliver to
 * the LEFT of a labeled "kickoff" tick for that pre-match activity (see
 * PRE_MATCH_WIDTH_FRAC, computeEnvelope's preMatchMinutes, scales()'
 * clockX domain, and tickState()'s preKickoff branch) -- a narrated break
 * in the axis, not a second linear time scale.
 *
 * GATE-4 ROUND-4 REVISION (blind cognitive review of the captured scrub
 * frames; sole-writer scope, this file only):
 *   (1) KEY HONESTY, cyan/orange (CRITICAL): the key promised "orange =
 *       money that bet NO," but no orange mark is perceivable in any
 *       frame — and none can be: a taker-no trade prints at the SAME
 *       traded price as the taker-yes side (one tape, one price per
 *       trade), so the 4,234 in-match NO rows (25% of the in-match tape)
 *       land on exactly the pixels the 3x-larger YES mass occupies, and
 *       additive blending buries them at any alpha/tier. Truth over
 *       symmetry: every trade dot now renders one hue (side-yes cyan =
 *       "a real trade"), the orange key row is gone, and the prose
 *       teaches the yes/no pairing in words instead of promising a color
 *       the screen cannot deliver. The side-binary color debut belongs
 *       to a scene whose geometry can separate the sides (e.g. S6).
 *   (2) FIGURE-GROUND STAGING (MAJOR): the resting field's
 *       end-of-tournament density wall rendered as a full-height grey
 *       pillar that won first fixation in every frame (the blind read
 *       called it "the settlement mass"). The ground tier's Reinhard
 *       knee makes per-dot alpha nearly inert against that density
 *       (composited luminance asymptotes to rest-luminance-cap
 *       regardless), so the honest lever is geometry: during the zoom
 *       the ribbon SQUASHES along its stack axis toward its own
 *       centerline (REST_SQUASH below; the time axis, and so the
 *       ribbon's identity, is untouched) and drops to 0.08 alpha, while
 *       the story trace thickens and gains a bright current-price head —
 *       the brightest object at every scrub position is now the price
 *       itself, and the ending's dominance belongs to the settled
 *       objects (dead pour, floor band, collapsed trace), never to
 *       context. bootRest/resting (the pre-title frames) keep the full
 *       ribbon, so S2's re-merge parity is untouched.
 *   (3) SECOND CLIFF NAMED (MAJOR): the prose promised "one vertical
 *       jump" but the tape draws two comparable cliffs (wall ~19': 38c
 *       to 21c with a partial rebound; wall ~79': 15c to 3c, terminal).
 *       Verified before labeling (tile timestamps + published July 14
 *       match reports, ESPN/FIFA): Spain won 2-0 — Oyarzabal's penalty
 *       (awarded ~19' wall clock, converted in the 22nd minute of play;
 *       the detector-flagged event) and Porro's 58th-minute goal, which
 *       lands at ~79 wall-clock minutes on this axis because the axis
 *       counts minutes from kickoff THROUGH halftime. Both cliffs are
 *       now annotated — one amber meaning, "a Spain goal," two
 *       instances — the second via a tape detector (largest
 *       1-minute-median drop after the flagged event, computeEnvelope)
 *       rather than a hardcoded minute, so the deploy-morning tile
 *       re-drive cannot strand the label. AUTHOR NOTE (outside this
 *       file's write scope): docs/index.html fn-1 still reads "Spain
 *       1-0 in regulation"; the tape and every match report say 2-0.
 *   (4) KEY CHANGE NARRATED (MAJOR): the grey key row used to silently
 *       REWORD itself at settlement ("money at rest" -> "settled to
 *       zero, dead money"). The pale-grey rest row now keeps one label
 *       for the whole beat, and settlement ADDS a visually distinct
 *       dark-grey state-dead row (glyph 'dead') in the same chip update
 *       whose pulse fires in the same instant as the floor-band onset
 *       pulse — a new meaning arrives, announced; no old meaning
 *       mutates.
 *
 * STORYBOARD CONTRACT NOTE — pre-title frame: the storyboard's "Beat,
 * pre-title" text ("A still field of dots... every dot on this screen is
 * $75,000...") is already authored as static HTML in docs/index.html's
 * <header id="title-screen"> (CONTRACT §8.2) with data-slot spans for the
 * deploy-frozen census figures. It is NOT reproduced as a scene beat here
 * (buildRail() only renders scene.beats[] into #rail, which begins AFTER
 * the title header). This module's single beat is the storyboard's main
 * "Beat." paragraph (the FRA-ESP zoom), which is everything the reader
 * sees once they scroll past the title.
 *
 * FALLBACK VEHICLE (storyboard S1, drafted, not implemented here): if the
 * G1 tape re-drive fails to land 'fraesp', the storyboard's verbatim
 * fallback is a Norway-Brazil open (vehicle 'norbra', already reused by
 * S9's mirror). The scene-module contract only exposes ONE static
 * `zoom.key`; swapping vehicles is a data/tiling-stage decision (repoint
 * manifest + re-author this file's beat html), not a runtime branch this
 * module can express. See data_requests in the build handoff.
 */

import { registry, makeState, setColor, indicesWithFlag, durationMs } from '../shared.js';

/* ------------------------------------------------------------------ */
/* Deterministic per-dot hash (no Math.random: replays must be stable). */
function hash01(i) {
  let x = (i + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 100000) / 100000;
}

const BUCKET_PX = 4; // one time-bucket per ~4 CSS px column of the stage

// Gate-4 s01 fix, round 3 (integrity pass, see header note below): share of
// the zoom stage's width reserved for the pre-kickoff "days before" sliver,
// to the LEFT of a labeled kickoff tick. Fixed, not data-derived -- it is a
// pixel budget, not a time scale (see computeEnvelope()).
const PRE_MATCH_WIDTH_FRAC = 0.10;

/* The resting-field ("timeline-ribbon") position formula, shared in spirit
 * with s02.js (duplicated per CONTRACT §2 import rule: scenes may only
 * import ../shared.js, plus siblings for S16's anchor reuse). Identical
 * formula + identical view.region + identical dot identity (index) means
 * S1's pre-title field and S2's re-merged field are pixel-identical: the
 * "returns to its place" promise (storyboard §0 identity rule) is met
 * structurally, not by chance.
 *
 * xOf(i) returns the raw (unbucketed) pixel position along the TIME axis
 * for dot i. On mobile the ribbon rotates (storyboard S2 mobile note:
 * "Timeline rotates to vertical, scroll = time"); S1 inherits the same
 * rotation since it is the same field. */
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
    // Center-out "violin" stacking: column half-height grows with sqrt(count),
    // capped so no bucket (e.g. a match-day wall) can overflow the stage.
    // Absolute density beyond what spread alone can show is carried by the
    // engine's additive density tone-mapping (CONTRACT §3.4 / tokens
    // density_tone_mapping), not by this layout.
    const halfSpread = Math.min(stackExtent / 2 - 4, 5 * Math.sqrt(count));
    const jitter = (hash01(i) - 0.5) * 3;
    const sPos = stackOrigin + stackExtent / 2 + norm * 2 * halfSpread + jitter;
    if (mobile) { x[i] = sPos; y[i] = tPos; } else { x[i] = tPos; y[i] = sPos; }
  }
  return { x, y };
}

/* The zoom tile's flags column bit 0 is the ONLY structurally-flagged
 * event (CONTRACT §5.4: "bit 0 = detector-anchored repricing event").
 * There is no equivalent flag for the whistle/settlement boundary, so it
 * is approximated from tape geometry here — see data_requests in the
 * build handoff for a request to add an explicit boundary marker. */

// GATE-4 VISUAL-STORY REVIEW, s01 CRITICAL (x-axis contradicts the grain
// plate): `ts_ms` is milliseconds since the TILE's own t0 (this ticker's
// first-ever trade — pipeline/export/build_tiles.py build_fraesp_zoom():
// `t0 = int(d["created_ts"].min())`), NOT since kickoff. The France-Spain
// 3-way market opened ~4 days before the July 14 semifinal (manifest
// window: 2026-07-10T21:31Z -> 2026-07-14T21:00Z), so plotting raw
// ts_ms/60000 as "match clock (minutes played)" put four days of
// pre-kickoff trading on a 0'-5000'+ axis while the axis title and grain
// plate both promised a single 90-minute night — an undecodable, actively
// misleading position encoding. Kickoff is a known fact (research/
// fact-base.json remaining_schedule: "France vs Spain - Tuesday, July 14,
// 2026, 3:00 PM ET / 19:00 GMT"), inlined here since S1 carries no
// per-scene JSON (needs.scene: false) to hold it as data — mirrors S8's
// self-contained kickoff derivation (s08.js: kickoffTs = whistleTs -
// 90*60000). Every "minute" downstream of this function is now truly
// kickoff-relative: 0' is kickoff, ~90'-120' is the whistle/settlement
// tail, matching what the axis title and grain plate already claim.
const FRAESP_KICKOFF_UTC_MS = Date.parse('2026-07-14T19:00:00Z');

function computeEnvelope(zoomTile) {
  // zoomTile.t0 is populated by main.js's loadZoomTile() as an absolute
  // epoch-ms Date, so no extra manifest plumbing is needed here.
  const kickoffOffsetMin = (zoomTile && Number.isFinite(zoomTile.t0))
    ? (FRAESP_KICKOFF_UTC_MS - zoomTile.t0) / 60000
    : 0;
  function minuteOf(rawTsMs) {
    return rawTsMs / 60000 - kickoffOffsetMin;
  }
  const matchEndMinutes = zoomTile && zoomTile.count
    ? Math.max(60, minuteOf(zoomTile.ts_ms[zoomTile.count - 1]))
    : 120;
  // Gate-4 s01 fix, round 3: width (in clock-minutes, i.e. clockX domain
  // units) of the pre-kickoff sliver reserved to the LEFT of kickoff.
  // Zero when this tile carries no pre-kickoff rows at all (kickoffOffsetMin
  // <= 0), so a fully in-match tile never reserves dead axis space for a
  // window that doesn't exist. NOT a linear day scale -- see tickState's
  // preKickoff branch, which scatters rows inside it, not orders them.
  const preMatchMinutes = kickoffOffsetMin > 0
    ? matchEndMinutes * PRE_MATCH_WIDTH_FRAC / (1 - PRE_MATCH_WIDTH_FRAC)
    : 0;
  let eventMinute = null;
  let eventPriceC = 50;
  if (zoomTile) {
    for (let i = 0; i < zoomTile.count; i++) {
      if (zoomTile.flags[i] & 1) {
        eventMinute = Math.max(0, minuteOf(zoomTile.ts_ms[i]));
        eventPriceC = zoomTile.price_c[i];
        break;
      }
    }
  }
  if (eventMinute == null) eventMinute = matchEndMinutes * 0.55; // undetected fallback
  const whistleMinute = Math.min(
    matchEndMinutes,
    Math.max(eventMinute + 5, matchEndMinutes * 0.93),
  );
  const pad = Math.min(8, eventMinute / 2);

  // GATE-4 ROUND-4 (header note (3)): recover the tape's SECOND repricing
  // cliff. Only bit 0's event is structurally flagged (CONTRACT §5.4),
  // but the real tape steps down twice — Spain won 2-0, and Porro's
  // 58th-minute second goal lands at ~79 wall-clock minutes here — so
  // the second goal is detected from tape geometry: the largest
  // 1-minute-median price drop after the flagged event, kept only when
  // it is unmistakably a cliff (>= 8c). A detector, not a hardcoded
  // minute, so a deploy-morning tile re-drive keeps the anchor honest;
  // on a tape with no second cliff, event2Minute stays null and the
  // annotation never renders.
  let event2Minute = null;
  let event2PriceC = 50;
  if (zoomTile && zoomTile.count) {
    const from = Math.ceil(eventMinute + 10);
    const to = Math.floor(whistleMinute - 3);
    const pricesByMinute = new Map();
    for (let i = 0; i < zoomTile.count; i++) {
      const m = minuteOf(zoomTile.ts_ms[i]);
      if (m < from - 1 || m > to + 1) continue;
      const bucket = Math.floor(m);
      let arr = pricesByMinute.get(bucket);
      if (!arr) { arr = []; pricesByMinute.set(bucket, arr); }
      arr.push(zoomTile.price_c[i]);
    }
    const med = new Map();
    for (const [bucket, arr] of pricesByMinute) {
      arr.sort((p, q) => p - q);
      med.set(bucket, arr[arr.length >> 1]);
    }
    let bestDrop = 0;
    for (let b = from; b <= to; b++) {
      const before = med.get(b - 1);
      const after = med.get(b + 1);
      if (before === undefined || after === undefined) continue;
      const drop = before - after;
      if (drop > bestDrop) { bestDrop = drop; event2Minute = b; event2PriceC = before; }
    }
    if (bestDrop < 8) event2Minute = null;
  }

  // Scroll-fraction -> match-clock cutoff. Storyboard S1 Scroll spec:
  // "~40% of the scrub's length dwells on the minutes around the detected
  // repricing event, ~25% on the final minutes/whistle/settlement, the
  // rest of the match compresses into what remains, clock visibly
  // accelerating." Breakpoints below realize that envelope, RETIMED (Gate-4
  // visual-story review, s01 C2: "the settlement pour must be a perceivable
  // staged onset" -- a pour confined to 0.93-1.00 tweened entirely inside
  // the last 7% of the track, a span this piece's own review harness never
  // samples (its fixed scrub stops are 25/50/90%) and a real reader could
  // easily overshoot in one scroll gesture, so the fall was invisible both
  // to the audit and to a fast scroller. The pour now starts earlier and
  // finishes BEFORE the 90% mark, so scrub90 always lands on the fully
  // drained, unambiguous end state (a flat grey line at zero) instead of a
  // half-blended frame, and the last 14% of the track holds that settled
  // frame still rather than continuing to tween:
  //   0.00-0.06 intro/kickoff (6%)
  //   0.06-0.20 compressed early match (14%)
  //   0.20-0.60 dwell around the repricing event (40%)
  //   0.60-0.68 compressed post-event walk to the final stretch (8%)
  //   0.68-0.74 final minutes + whistle dwell (6%)
  //   0.74-0.86 settlement pour: France's scattered dots slide to the zero
  //     line and drain to dead grey, one continuous tween (12%)
  //   0.86-1.00 held still on the drained, settled frame (14%)
  const breakpoints = [
    { at: 0.00, clock: 0 },
    { at: 0.06, clock: 0 },
    { at: 0.20, clock: Math.max(0, eventMinute - pad) },
    { at: 0.60, clock: Math.min(whistleMinute, eventMinute + pad) },
    { at: 0.68, clock: Math.max(eventMinute + pad, whistleMinute - 10) },
    { at: 0.74, clock: whistleMinute },
    { at: 0.86, clock: matchEndMinutes },
  ];
  function cutoffAt(t) {
    if (t <= breakpoints[0].at) return breakpoints[0].clock;
    for (let k = 0; k < breakpoints.length - 1; k++) {
      const a = breakpoints[k], b = breakpoints[k + 1];
      if (t <= b.at) {
        const f = (t - a.at) / Math.max(1e-6, b.at - a.at);
        return a.clock + (b.clock - a.clock) * f;
      }
    }
    return matchEndMinutes;
  }
  return {
    eventMinute, eventPriceC, event2Minute, event2PriceC,
    whistleMinute, matchEndMinutes, breakpoints, cutoffAt,
    kickoffOffsetMin, preMatchMinutes,
  };
}

/* Heuristic leg classification from manifest.zoom.fraesp.legs entries
 * (ticker/label strings). Storyboard: "y = price of the France winner
 * leg; the 3-way legs run as fainter companion streams."
 *
 * GATE-4 ROUND-2 FIX (s01 hero/companion split): the original heuristic
 * looked for a separate season-long WORLDCUP futures leg to treat as
 * "hero." The live fraesp.bin tile (manifest.zoom.fraesp.legs) carries
 * only the match's own three regulation legs (KXWCGAME-...-FRA/-ESP/-TIE)
 * — no WORLDCUP leg is ever present in this tile — so that check matched
 * nothing and EVERY sampled trade, including France's own, fell into the
 * "faint companion" branch: the whole tick stream rendered at 0.40 alpha,
 * below the engine's active-tier floor, and the scene's one bright figure
 * (the France price path this scene's own axis and prose promise) never
 * popped. The axis is titled "price of the France contract" and the
 * settlement pour is defined on the France leg alone (see makeSettled()
 * below), so "hero" is redefined here to mean exactly that leg: France's
 * own regulation contract is the active/bright stream; Spain's and the
 * draw's regulation legs (present in the same tile, at their own,
 * different prices) stay the faint companions the caption names. */
function isFranceLeg(leg) {
  if (!leg) return false;
  const s = `${leg.ticker || ''} ${leg.label || ''}`;
  return /france/i.test(s) || /-FRA?(\b|$)/i.test(leg.ticker || '');
}

export default {
  id: 's01',
  act: 0,
  title: 'Ninety minutes in Arlington',
  // Piece-wide spine (structure-spec §2/§3): the scene kicker names which
  // of the five skills this scene teaches. main.js's buildRail() already
  // prefers `scene.kicker` over `scene.title` for the rail card header.
  kicker: 'Skill 1 of 5 — what a price means',
  layoutName: 'resting-field → tick-stream',

  // No per-scene JSON: everything s01 needs is already in the contract's
  // existing manifest surface (population tile + its ZOOM_FRAESP flag +
  // the fraesp zoom tile itself, loaded as part of boot per CONTRACT §6.3
  // "S1's tile is part of the boot load set").
  needs: { scene: false, series: [], zoom: 'fraesp' },

  scales(data, view) {
    const { manifest } = data;
    const region = view.region;
    const epochMs = new Date(manifest.epoch).getTime();
    const frozenMs = new Date(manifest.frozen_at || manifest.generated).getTime();
    const timeRange = view.mobile
      ? [region.y, region.y + region.h]
      : [region.x, region.x + region.w];
    const timeX = d3.scaleUtc().domain([epochMs, frozenMs]).range(timeRange);

    const zoomTile = data.zoom.fraesp;
    const env = computeEnvelope(zoomTile);
    // Gate-4 s01 fix, round 3: domain starts BEFORE 0 (kickoff) so the
    // pre-match sliver gets its own honest pixel space instead of sharing
    // pixels with the real match's first few minutes (see header note).
    const clockX = d3.scaleLinear()
      .domain([-env.preMatchMinutes, env.matchEndMinutes])
      .range([region.x, region.x + region.w]);
    const priceY = d3.scaleLinear()
      .domain([0, 100])
      .range([region.y + region.h, region.y]);

    registry.register('s01.time', timeX);
    registry.register('s01.clock', clockX);
    registry.register('s01.price', priceY);
    return { timeX, clockX, priceY, env };
  },

  layout(data, view) {
    const { manifest, pop } = data;
    const N = pop.count;
    const region = view.region;
    const epochMs = new Date(manifest.epoch).getTime();
    const zoomTile = data.zoom.fraesp;
    const env = computeEnvelope(zoomTile);
    const timeX = registry.get('s01.time');
    const clockX = registry.get('s01.clock');
    const priceY = registry.get('s01.price');

    const heroBit = data.flagBit('ZOOM_FRAESP');
    const taggedIdx = indicesWithFlag(pop.flags, heroBit);
    const D = taggedIdx.length;
    const T = zoomTile ? zoomTile.count : 0;
    // CONTRACT §4.3 stride formula: runtime stride = ceil(T / D); narrated
    // n = build_stride * runtime stride (interpolated into zoom.grainText
    // at the driver layer once wired — see data_requests).
    const stride = Math.max(1, Math.ceil(T / Math.max(D, 1)));
    const sampleIdx = new Int32Array(D);
    for (let d = 0; d < D; d++) sampleIdx[d] = Math.min(Math.max(T - 1, 0), d * stride);

    const restPos = restingFieldPositions(
      N, region, view.mobile,
      (i) => timeX(epochMs + pop.birth_ts[i] * 1000),
    );

    const BASE_PX = view.tokens.dot['radius-base-px'] * 2; // radius -> diameter
    // ACTIVE/REST luminance encoding (perception-brief §9b, §10.1-2):
    // the pop between "tonight's trades" and the resting field is bought here
    // purely by which ALPHA BAND each dot lands in, not by hue. The engine
    // (FRAG_POINTS/VERT_POINTS) dims any dot whose own alpha is <=
    // opacity-rest-classify-max (0.42) and boosts + onset-pulses any dot whose
    // alpha is >= opacity-active-classify-min (0.90); the brief showed every
    // identity/side hue reads ~isoluminant against field.rest (<=1.24:1), so a
    // hue swap alone is close to inert for a "did that just change" judgment.
    // Dot SIZE is never touched (unit grammar: one trade = one dot), so the
    // whole encoding rides on alpha here and luminance in the shader.
    const ACTIVE_A = view.tokens.dot['opacity-alive']; // 1.0 -> active-tier (boosted)
    const restColor = view.state('rest');              // 0.35 -> rest-tier (dimmed)
    // Tonight's FRA-ESP subset, lifted into the active band so it pops against
    // the dimmed resting field (was 0.85, which fell in the unclassified
    // 0.42-0.90 gap and did not pop). Amber = the reserved "story points here"
    // hue naming tonight's match.
    const amber = view.color('accent-annotation', ACTIVE_A);
    // Round 4, header note (1): ONE hue for every trade dot. The old
    // yesColor/noColor split promised orange the screen could not deliver
    // (a taker-no trade prints at the same traded price as the yes side,
    // so NO's 25% share sits on exactly YES's pixels and additive
    // blending buries it). Cyan here means "a real trade," nothing more.
    const tradeColor = view.color('side-yes', ACTIVE_A); // real ticks: active-tier
    const waitColor = view.color('field-rest', 0.10);  // staged/not-yet-arrived: below rest band
    // Gate-4 visual-story review (s01 critical, "un-keyed near-white
    // column") + round 4, header note (2): during the zoom the resting
    // field is CONTEXT, not story. Alpha alone could not stop its
    // end-of-tournament density wall from rendering as the frame's
    // dominant grey pillar (the ground tier's Reinhard knee asymptotes to
    // rest-luminance-cap at any per-dot alpha once density is high), so
    // the in-zoom field is BOTH dimmed below the rest band (0.08) and
    // squashed geometrically (REST_SQUASH below) into a narrow mid-stage
    // band. The key's "pale grey = money at rest" stays true of what is
    // rendered (perception-brief §4, §9b).
    const zoomFieldColor = view.color('field-rest', 0.08);
    const deadColor = view.state('dead');              // 0.55 -> unclassified receding state, engine leaves it

    // Round 4, header note (2): stack-axis squeeze toward the ribbon's
    // own centerline for the in-zoom keyframes. The TIME axis is never
    // touched — this is the same ribbon, compressed, not a relocation —
    // and the pre-title states (bootRest/resting) keep the full-spread
    // restPos, so S1's first pixel and S2's re-merged field stay
    // pixel-identical to each other.
    const REST_SQUASH = 0.18;
    const stackCenter = view.mobile
      ? region.x + region.w / 2
      : region.y + region.h / 2;
    function squashedRestX(i) {
      return view.mobile
        ? stackCenter + (restPos.x[i] - stackCenter) * REST_SQUASH
        : restPos.x[i];
    }
    function squashedRestY(i) {
      return view.mobile
        ? restPos.y[i]
        : stackCenter + (restPos.y[i] - stackCenter) * REST_SQUASH;
    }

    // Gate-4 s01 fix, round 3: off the LEFT of the WHOLE domain (pre-match
    // sliver included), not just left of kickoff -- clockX(0) now sits
    // mid-chart (see scales()), so anchoring here would park "not yet
    // arrived" dots inside the visible pre-match band instead of off-canvas.
    const stageX = region.x - 14; // "not yet arrived" staging point
    const stageY = priceY(50);

    // ---- state: 'bootRest' — the TRUE first pixel painted, before any
    // reader interaction (CR-18, perception-brief §7 on change blindness /
    // onset capture): every dot, including tonight's FRA-ESP subset, sits
    // at plain field.rest. No amber pre-light. This is the state
    // boot()/activateBeat() snap to for the silent first paint. ----
    function makeAllRest() {
      const s = makeState(N);
      for (let i = 0; i < N; i++) {
        s.x[i] = restPos.x[i]; s.y[i] = restPos.y[i];
        setColor(s.color, i, restColor);
        s.size[i] = BASE_PX;
      }
      return s;
    }

    // ---- state: 'resting' — the amber-tagged frame the reader reaches a
    // hair into the scrub (kf at 0.02, see `keyframes` below): tonight's
    // FRA-ESP dots light up amber against the resting field as ONE
    // announced color tween out of 'bootRest', crossing the engine's
    // active alpha band so its onset pulse fires (CR-18). ----
    function makeResting() {
      const s = makeAllRest();
      for (const i of taggedIdx) setColor(s.color, i, amber);
      return s;
    }

    // ---- tick-grain cumulative-reveal state: every tagged dot whose
    // sampled trade falls at or before `cutoffMinutes` sits at its real
    // (match-clock, price) position; everything else stages just before
    // kickoff, invisible-adjacent. The whole non-tonight population dims
    // (dimmed-field-max) behind it. Because driveScrub() interpolates
    // linearly between adjacent keyframe pairs with zero stagger (engine.js
    // scrubBetween default), consecutive cumulative-reveal snapshots
    // produce a genuine "trades enter left to right" streaming look even
    // though the engine's true per-identity emitOrder channel (built for
    // exactly this, engine.js header item 5) is not wired through the
    // scrub path today — see data_requests. ----
    function tickState(cutoffMinutes) {
      const s = makeState(N);
      for (let i = 0; i < N; i++) {
        s.x[i] = squashedRestX(i); s.y[i] = squashedRestY(i);
        setColor(s.color, i, zoomFieldColor);
        s.size[i] = BASE_PX;
      }
      for (let d = 0; d < D; d++) {
        const i = taggedIdx[d];
        const t = sampleIdx[d];
        // Gate-4 s01 fix, round 3 (was: hash01(t) * matchEndMinutes*0.06,
        // a POSITIVE offset that shared pixels with the real match's first
        // few minutes -- the axis-honesty flag this round fixes): minute
        // is kickoff-relative (see computeEnvelope), so the ~4 days of
        // pre-kickoff trading on this ticker no longer stretches the axis
        // to 5000'+. Those rows now scatter into the NEGATIVE sliver
        // clockX's domain reserves to the LEFT of the labeled kickoff tick
        // (scales()), deterministically but with no chronological meaning
        // to their position within it — an honest "this much happened
        // before kickoff, compressed" rather than a fake day-by-day scale.
        // Pre-kickoff activity is outside "the match" this scene narrates,
        // so it stays in the faint tier below (same tier the companion
        // legs would use if this tile ever carried more than one — see
        // the header note: today's tile is France-leg-only, so `faint`
        // reduces to exactly `preKickoff` on real data).
        const rawMinute = T ? (zoomTile.ts_ms[t] / 60000 - env.kickoffOffsetMin) : 0;
        const preKickoff = rawMinute < 0;
        const minute = preKickoff ? -hash01(t) * env.preMatchMinutes : rawMinute;
        if (T && minute <= cutoffMinutes) {
          const legSpec = (zoomTile.legs || [])[zoomTile.leg[t]];
          // Round 3: today's tile is France-leg-only (header note), so
          // !isFranceLeg(legSpec) never fires on real data; kept as a
          // defensive fallback rather than deleted.
          const faint = preKickoff || !isFranceLeg(legSpec); // pre-kickoff (+ any non-France leg): fainter
          // Round 4, header note (1): one hue for every trade, whichever
          // side took it — the side split rendered as a promise ("orange =
          // NO") that no frame could keep, because both sides of a trade
          // share one (minute, price) coordinate.
          const base = tradeColor;
          s.x[i] = clockX(minute);
          s.y[i] = priceY(zoomTile.price_c[t]);
          // Hero (France's own regulation leg) stays active-tier (base alpha
          // 1.0, boosted); the Spain/draw companion legs drop to 0.40
          // (perception-brief §9b: a dimmed-field-tier alpha, not the old 0.5
          // which sat in the shader's unclassified 0.42-0.90 gap and
          // half-competed with the boosted hero stream). A deliberate
          // two-tier read: France's price path pops as the scene's one
          // bright figure; the other two legs recede into the same tier as
          // the resting field.
          setColor(s.color, i, faint ? [base[0], base[1], base[2], base[3] * 0.40] : base);
        } else {
          s.x[i] = stageX; s.y[i] = stageY;
          setColor(s.color, i, waitColor);
        }
        s.size[i] = BASE_PX;
      }
      return s;
    }

    // ---- settlement: "the France dots pour to the zero line" — France's
    // own regulation leg (this scene's hero, see isFranceLeg above), hue
    // drained to state.dead, position at price 0. Spain's and the draw's
    // legs keep whatever their last real traded price shows (real data
    // already encodes the settlement move for the winning side; both stay
    // in the faint companion tier, so the pour reads as one bright figure
    // falling, not three). ----
    function makeSettled() {
      const s = tickState(Infinity);
      for (let d = 0; d < D; d++) {
        const i = taggedIdx[d];
        const t = sampleIdx[d];
        const legSpec = T ? (zoomTile.legs || [])[zoomTile.leg[t]] : null;
        if (isFranceLeg(legSpec)) {
          s.y[i] = priceY(0);
          setColor(s.color, i, deadColor);
        }
      }
      return s;
    }

    const bp = env.breakpoints;
    const states = {
      bootRest: makeAllRest(),
      resting: makeResting(),
      kickoff: tickState(bp[1].clock),
      preEvent: tickState(bp[2].clock),
      postEvent: tickState(bp[3].clock),
      approachFinal: tickState(bp[4].clock),
      whistle: tickState(bp[5].clock),
      settled: makeSettled(),
    };
    // CR-18: an extra kf0 (bootRest, at=0.00) precedes the amber-tagged
    // 'resting' frame (moved to at=0.02, a hair into the scrub) so the
    // amber ignition is a witnessed tween, not a fact the reader arrives
    // to. `bp` (env.breakpoints, used separately by the overlay's
    // cutoffAt/axis logic) is untouched; only this engine-facing keyframe
    // list gains the one extra entry.
    const keyframes = [
      { at: 0.00, state: 'bootRest' },
      { at: 0.02, state: 'resting' },
      { at: bp[1].at, state: 'kickoff' },
      { at: bp[2].at, state: 'preEvent' },
      { at: bp[3].at, state: 'postEvent' },
      { at: bp[4].at, state: 'approachFinal' },
      { at: bp[5].at, state: 'whistle' },
      { at: bp[6].at, state: 'settled' },
    ];
    return { states, keyframes };
  },

  overlay(container, data, view, scales) {
    const { svg, html } = container;
    const { clockX, priceY, env } = scales;
    const zoomTile = data.zoom.fraesp;
    const tokens = view.tokens;
    const drawIn = durationMs(tokens, 'overlay-draw-in');
    const stagger = durationMs(tokens, 'overlay-stagger');
    const standoff = tokens.layout['annotation-leader-standoff-px'];

    const g = svg.append('g').attr('class', 's01-overlay');

    const clockAxisG = g.append('g').attr('class', 'axis axis-clock')
      // G3 mobile fix: the bottom x-axis abuts the mobile prose sheet, so
      // its tick labels render ABOVE the axis line (d3.axisTop) on mobile
      // instead of below it, staying inside the visible stage.
      .attr('transform', `translate(0, ${view.region.y + view.region.h + (view.mobile ? 0 : 8)})`);
    const priceAxisG = g.append('g').attr('class', 'axis axis-price')
      .attr('transform', `translate(${view.region.x - 8}, 0)`);

    function styleAxis(sel) {
      sel.selectAll('text')
        .attr('fill', view.css('ink-mid'))
        .style('font-family', view.css('font-tape'))
        .style('font-size', view.css('type-tape-size'));
      sel.selectAll('path,line').attr('stroke', view.css('ink-low'));
    }

    // Gate-4 s01 critical fix (axis/position integrity): this used to
    // rebuild its OWN scale with a domain that shrank/grew toward the
    // current scrub cutoff ("the match-clock axis visibly accelerating"),
    // while every dot's x-position kept using the scene's real, fixed
    // clockX domain (0 to matchEndMinutes) — two different scales sharing
    // one pixel range. A tick under a dot could read e.g. "2'" for a dot
    // whose real trade was at minute 13, only converging once cutoff
    // reached matchEndMinutes. That is the same "undecodable position
    // encoding" failure the 5000'+ domain bug was, just smaller and easier
    // to miss. The axis now always reads off the SAME clockX used to place
    // every dot, so whatever tick sits under a mark is that mark's real
    // minute, at every scrub position.
    // Gate-4 s01 fix, round 3: ticks come from the REAL match window
    // [0, matchEndMinutes] only, never from clockX's own domain (which now
    // runs negative to cover the pre-match sliver) -- a tick like "-40'"
    // would be its own new lie ("40 minutes before kickoff" on a scale
    // that isn't linear in days). The 0' tick reads "kickoff" in plain
    // words, naming the boundary exactly where a first-time reader's eye
    // already lands.
    const clockTickValues = d3.scaleLinear().domain([0, env.matchEndMinutes]).ticks(6);
    function formatClockTick(d) {
      return d === 0 ? 'kickoff' : `${Math.round(d)}'`;
    }
    function drawClockAxis() {
      const axisFn = view.mobile
        ? d3.axisTop(clockX).tickValues(clockTickValues).tickFormat(formatClockTick)
        : d3.axisBottom(clockX).tickValues(clockTickValues).tickFormat(formatClockTick);
      clockAxisG.call(axisFn);
      styleAxis(clockAxisG);
    }
    function drawPriceAxis() {
      priceAxisG.call(d3.axisLeft(priceY).ticks(5).tickFormat((d) => `${d}¢`));
      styleAxis(priceAxisG);
    }

    // G3 axis-label standard: every D3 axis carries a titled unit. X title
    // centered below the tick labels; Y title horizontal, left-aligned
    // above the topmost tick.
    function titleStyle(sel) {
      sel.attr('fill', view.css('ink-mid'))
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-caption-size'))
        .style('font-weight', 500);
    }
    if (view.mobile) {
      const cx = view.region.x - 8 - 20;
      const cy = view.region.y + view.region.h / 2;
      titleStyle(g.append('text').attr('class', 'axis-title axis-title-clock')
        .attr('x', cx).attr('y', cy).attr('text-anchor', 'middle')
        .attr('transform', `rotate(-90, ${cx}, ${cy})`)
        .text('match clock (minutes from kickoff)'));
    } else {
      titleStyle(g.append('text').attr('class', 'axis-title axis-title-clock')
        .attr('x', view.region.x + view.region.w / 2)
        .attr('y', view.region.y + view.region.h + 8 + 24)
        .attr('text-anchor', 'middle')
        .text('match clock (minutes from kickoff)'));
    }
    titleStyle(g.append('text').attr('class', 'axis-title axis-title-price')
      .attr('x', view.region.x - 8)
      .attr('y', view.region.y - 12)
      .attr('text-anchor', 'start')
      .text('price of the France contract (cents; 100 = certain)'));

    // Gate-4 s01 fix, round 3 (axis honesty, header note): the pre-match
    // sliver clockX's domain reserves gets its own dim band, a dashed
    // boundary at the kickoff tick, and a plain-language label — so it
    // reads as "backdrop, not the match" on sight, before a reader ever
    // parses a single tick. Static furniture, drawn once like the axes
    // above (not gated by scrub position); skipped entirely when this
    // tile carries no pre-kickoff rows (env.preMatchMinutes === 0).
    if (env.preMatchMinutes > 0) {
      const kickoffPx = clockX(0);
      g.insert('rect', ':first-child').attr('class', 'prematch-band')
        .attr('x', view.region.x)
        .attr('width', Math.max(0, kickoffPx - view.region.x))
        .attr('y', view.region.y)
        .attr('height', view.region.h)
        .attr('fill', view.css('ink-low'))
        .attr('fill-opacity', 0.07)
        .style('pointer-events', 'none');
      g.append('line').attr('class', 'kickoff-divider')
        .attr('x1', kickoffPx).attr('x2', kickoffPx)
        .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
        .attr('stroke', view.css('ink-low'))
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .attr('opacity', 0.6);
      const preMatchDays = Math.max(1, Math.round(env.kickoffOffsetMin / 1440));
      const preMatchLabelX = (view.region.x + kickoffPx) / 2;
      const preMatchLabelY = view.region.y + view.region.h / 2;
      g.append('text').attr('class', 'prematch-label')
        .attr('x', preMatchLabelX).attr('y', preMatchLabelY)
        .attr('text-anchor', 'middle')
        .attr('transform', `rotate(-90, ${preMatchLabelX}, ${preMatchLabelY})`)
        .attr('fill', view.css('ink-low'))
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-micro-size'))
        .text(`${preMatchDays} day${preMatchDays === 1 ? '' : 's'} of trading squeezed before kickoff`);
    }

    // Gate-4 s01 major fix (settlement pour has no visual floor): the old
    // faint dotted gridline at price=0 read as axis furniture, not "money
    // died here" (perception-brief §9b: near-isoluminant marks vanish
    // against the field). Bumped to ink-mid + a bolder dash so it reads as
    // a labeled boundary rather than a tick line, and paired with a low,
    // wide floor band (below) that gives the settled sediment a visible
    // carrier independent of any single dot's own luminance.
    const settleLine = g.append('line').attr('class', 'settle-line')
      .attr('x1', view.region.x).attr('x2', view.region.x + view.region.w)
      .attr('y1', priceY(0)).attr('y2', priceY(0))
      .attr('stroke', view.css('ink-mid')).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .style('opacity', 0);
    const floorBand = g.append('rect').attr('class', 'settle-floor-band')
      .attr('x', view.region.x).attr('width', view.region.w)
      .attr('y', priceY(0) - 3).attr('height', 6)
      .attr('fill', view.css('state-dead'))
      .attr('fill-opacity', 0)
      .style('pointer-events', 'none');

    // One pre-title caption line (storyboard overlay spec), lifted
    // verbatim from the beat's own narration. Retimed (CR-18) to be
    // visible from kf0 rather than gated behind a t>0.005 threshold.
    // Gate-4 visual-story review (s01 critical, caption collision): the
    // two narration captions each get the SAME lane, 34px above the
    // stage, clear of the price-axis title at region.y - 12 — and they
    // are sequenced below so at most one is visible at a time (one
    // change on screen at a time; Mayer coherence).
    const caption = g.append('text').attr('class', 'pretitle-caption')
      .attr('x', view.region.x).attr('y', view.region.y - 34)
      .attr('fill', view.css('ink-mid'))
      .style('font-family', view.css('font-tape'))
      .style('font-size', view.css('type-tape-size'))
      // Names what the lit/active movers ARE (tonight's match) so the pop has a
      // referent, and keeps the unit statement at first contact.
      .text('the lit dots: tonight, France–Spain · one dot is one trade')
      .style('opacity', 0);

    // Gate-4 s01 major fix (grey/meaning-budget cleanup): the transient
    // "fainter streams" caption named a fourth population that read to a
    // blind viewer as a third meaning of "grey," and it was one of the
    // scrub25 frame's ~6 simultaneous meanings against the ≤4 budget. Cut
    // per the SIMPLIFY doctrine ("cut anything that does not serve the
    // reader") — the Spain/draw legs stay on screen as dim, unlabeled
    // texture (tickState's faint tier); they no longer spend a captioned
    // working-memory slot.

    // Gate-4 s01 critical fix ("the collapse must survive as a picture"):
    // France's own price path, drawn as a literal, persistent SVG line —
    // not inferred from particle positions the fixed-percentage capture
    // grid can miss between frames. Progressively revealed with the scrub
    // and, crucially, its FINAL segment is the fall to the 0c floor at the
    // whistle, so the settled frame keeps the collapse on screen as a
    // static, readable shape instead of an absence.
    function buildFranceTracePoints(maxPts) {
      if (!zoomTile || !zoomTile.count) return [];
      // Kickoff-relative, and trimmed to minute >= 0: the trace reads the
      // match itself, not the ~4 days of pre-kickoff order-book warmup on
      // this ticker (which tickState above compresses into a dim intro
      // sliver instead) — a line built from same-x pre-kickoff rows would
      // just tangle at x=0.
      const rows = [];
      for (let r = 0; r < zoomTile.count; r++) {
        const legSpec = (zoomTile.legs || [])[zoomTile.leg[r]];
        const m = zoomTile.ts_ms[r] / 60000 - env.kickoffOffsetMin;
        // Round 4: the LINE's real points stop at the whistle — the
        // post-whistle settlement-crush trades (which run past the
        // approximated whistle) stay on screen as dots, but appending
        // them to the path after the (whistleMinute, 0) pour point would
        // draw a backward-hooking segment, a visible feature with no
        // meaning. The pour is the trace's final segment, strictly down.
        if (isFranceLeg(legSpec) && m >= 0 && m <= env.whistleMinute) rows.push(r);
      }
      if (!rows.length) return [];
      const stride = Math.max(1, Math.ceil(rows.length / maxPts));
      const pts = [];
      for (let k = 0; k < rows.length; k += stride) {
        const r = rows[k];
        const minute = zoomTile.ts_ms[r] / 60000 - env.kickoffOffsetMin;
        pts.push({ minute, price: zoomTile.price_c[r] });
      }
      const rLast = rows[rows.length - 1];
      const lastMinute = zoomTile.ts_ms[rLast] / 60000 - env.kickoffOffsetMin;
      if (!pts.length || pts[pts.length - 1].minute !== lastMinute) {
        pts.push({ minute: lastMinute, price: zoomTile.price_c[rLast] });
      }
      // The pour itself: France's contract drains to zero at settlement.
      // Appending this point makes the fall a real segment of the drawn
      // line, not an inference from vanished dots.
      pts.push({ minute: env.whistleMinute, price: 0 });
      return pts;
    }
    const franceTracePts = buildFranceTracePoints(400);
    const traceLineGen = d3.line()
      .x((d) => clockX(d.minute)).y((d) => priceY(d.price))
      .curve(d3.curveMonotoneX);
    // ink-hero while the price is live (a neutral "read this" line, not a
    // new categorical hue competing with cyan/orange), switching to
    // state-dead the instant it reaches the floor — a visible, staged
    // announcement of the same grey redefinition the key makes at
    // settlement (Gate-4 s01 major fix: no more silent key reword).
    const tracePathEl = g.append('path').attr('class', 'france-trace')
      .attr('fill', 'none')
      .attr('stroke', view.css('ink-hero'))
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', 0.95)
      .style('opacity', 0);
    // Round 4, header note (2): a bright current-price head rides the
    // trace tip while the market is live, so the story's "now" — not any
    // grey context mass — owns the frame's luminance peak at every scrub
    // position (perception-brief §1: luminance singleton). Radius stays
    // below the annotated-singleton core (5px) so the goal markers keep
    // their rank in the emphasis stack; it retires at the pour, when the
    // ending takes over.
    const traceHead = g.append('circle').attr('class', 'trace-head')
      .attr('r', 3)
      .attr('fill', view.css('ink-hero'))
      .style('opacity', 0);
    let tracePourFired = false;
    function updateTrace(cutoff) {
      const pts = franceTracePts.filter((p) => p.minute <= cutoff);
      if (pts.length < 2) {
        tracePathEl.attr('d', null);
        fadeOut(tracePathEl);
        fadeOut(traceHead);
        return;
      }
      tracePathEl.attr('d', traceLineGen(pts));
      fadeIn(tracePathEl);
      const reachedFloor = cutoff >= env.whistleMinute - 0.5;
      tracePathEl.attr('stroke', reachedFloor ? view.css('state-dead') : view.css('ink-hero'));
      if (reachedFloor) {
        fadeOut(traceHead);  // the pour is the story now, not the "now" point
      } else {
        const tip = pts[pts.length - 1];
        traceHead.attr('cx', clockX(tip.minute)).attr('cy', priceY(tip.price));
        fadeIn(traceHead);
      }
      // Reverse scrub: rearm the pour and clear the floor band so a
      // reader scrolling back up returns to the live-market frame.
      if (!reachedFloor && tracePourFired) {
        tracePourFired = false;
        floorBand.interrupt().attr('fill-opacity', 0);
      }
      if (reachedFloor && !tracePourFired) {
        tracePourFired = true;
        // Onset pulse (perception-brief §7): per-dot size is never touched
        // (unit grammar — one trade, one dot), so this line is the
        // collapse's one luminance/size transient at the moment of the
        // drop, then settles to a still-legible, floor-separated weight.
        tracePathEl.transition().duration(160).attr('stroke-width', 4)
          .transition().duration(500).attr('stroke-width', 2);
        floorBand.transition().duration(160).attr('fill-opacity', 0.55)
          .transition().duration(600).attr('fill-opacity', 0.28);
      }
    }

    // Gate-4 s01 major fix (scrub25 budget: zero amber singletons): a dim,
    // persistent amber guide at the goal's clock position, visible from the
    // moment trades start flowing until the goal resolves it into the full
    // annotation below. Exactly one amber unit on screen at any time —
    // pre-announcing "watch here" instead of appearing cold at the reveal.
    const goalPreview = g.append('line').attr('class', 'goal-preview')
      .attr('x1', clockX(env.eventMinute)).attr('x2', clockX(env.eventMinute))
      .attr('y1', view.region.y).attr('y2', view.region.y + view.region.h)
      .attr('stroke', view.css('accent-annotation'))
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,3')
      .attr('stroke-opacity', 0.4)
      .style('opacity', 0);

    // Amber protocol (design-system §6 emphasis stack: luminance
    // singleton, white core + amber halo). Round 4, header note (3): the
    // scene now carries ONE amber MEANING — "a Spain goal" — in two
    // instances, one per verified goal; the whistle stays demoted to
    // plain ink-mid below, so nothing else competes for the amber budget.
    function makeAnnotation() {
      const grp = g.append('g').attr('class', 'annotation').style('opacity', 0);
      grp.append('circle').attr('class', 'halo')
        .attr('r', tokens.dot['radius-annotated-halo-px'])
        .attr('fill', 'none')
        .attr('stroke', view.css('accent-annotation'))
        .attr('stroke-width', tokens.dot['halo-stroke-px']);
      grp.append('circle').attr('class', 'core')
        .attr('r', tokens.dot['radius-annotated-core-px'])
        .attr('fill', view.css('ink-hero'));
      grp.append('line').attr('class', 'leader')
        .attr('stroke', view.css('accent-annotation'))
        .attr('stroke-width', tokens.layout['annotation-leader-weight-px']);
      grp.append('text').attr('class', 'label')
        .attr('fill', view.css('accent-annotation'))
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-annotation-size'));
      return grp;
    }
    function placeAnnotation(grp, cx, cy, dx, dy, text) {
      grp.select('.halo').attr('cx', cx).attr('cy', cy);
      grp.select('.core').attr('cx', cx).attr('cy', cy);
      grp.select('.leader')
        .attr('x1', cx).attr('y1', cy)
        .attr('x2', cx + dx).attr('y2', cy + dy - standoff);
      grp.select('.label').attr('x', cx + dx).attr('y', cy + dy).text(text);
    }

    const goalAnn = makeAnnotation();
    const goal2Ann = makeAnnotation();  // round 4: Porro's 58th-minute goal (~79' wall clock)

    // Declutter checklist (design-revision-spec §4): the whistle drops its
    // amber halo, white core, and amber leader — a plain ink-mid text mark
    // (mirrored, since the whistle lands near the stage's right edge) at
    // the same coordinates, >= space-24 clear of "the goal" vertically.
    const whistleGrp = g.append('g').attr('class', 'annotation-plain').style('opacity', 0);
    whistleGrp.append('line').attr('class', 'leader')
      .attr('stroke', view.css('ink-low'))
      .attr('stroke-width', tokens.layout['annotation-leader-weight-px']);
    whistleGrp.append('text').attr('class', 'label')
      .attr('fill', view.css('ink-mid'))
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-annotation-size'));
    function placeWhistle(cx, cy, dx, dy, text) {
      whistleGrp.select('.leader')
        .attr('x1', cx).attr('y1', cy)
        .attr('x2', cx + dx).attr('y2', cy + dy - standoff);
      whistleGrp.select('.label')
        .attr('x', cx + dx).attr('y', cy + dy)
        .attr('text-anchor', 'end')
        .text(text);
    }

    // Mobile (storyboard S1 mobile note): "annotations collapse to
    // numbered markers with a footer legend."
    let footerLegend = null;
    if (view.mobile) {
      footerLegend = html.append('div').attr('class', 'interactive s01-footer-legend')
        .style('position', 'absolute').style('left', '0').style('right', '0')
        // G5 mobile Zone F: clear of the mobile prose sheet (was bottom:0,
        // sitting inside the sheet band).
        .style('bottom', 'calc(var(--layout-card-max-height-mobile-vh) + var(--space-8))')
        .style('font-family', 'var(--font-apparatus)')
        .style('font-size', 'var(--type-caption-size)')
        .style('color', 'var(--ink-mid)')
        .style('padding', 'var(--space-8) var(--space-16)')
        .style('opacity', 0)
        .html('<span>① first goal (penalty)</span>&nbsp;&nbsp;<span>② second goal</span>&nbsp;&nbsp;<span>③ the whistle</span>');
    }

    function fadeIn(sel, delayMs) {
      sel.transition().duration(drawIn).delay(delayMs || 0).style('opacity', 1);
    }
    function fadeOut(sel) {
      sel.transition().duration(drawIn).style('opacity', 0);
    }

    // Color key (G1): imperative updates as the scrub crosses pre-title ->
    // zoom -> settle, since this single-beat scrub scene changes color
    // meaning mid-beat (the declarative `beat.chip` below only covers the
    // first activation snap). Capped at 3 meaning rows + 1 standing row.
    // Round 4, header notes (1) and (4): no orange row — no orange mark is
    // findable on screen (key hygiene: a row exists iff its mark is) — and
    // no row ever rewords. The pale-grey rest row keeps one label across
    // all three phases; settlement ADDS the visually distinct dark-grey
    // state-dead row (its swatch renders at the dead state's own alpha,
    // main.js keySwatchRGBA), and the chip's own pulse fires on that
    // update in the same instant as the floor-band onset pulse, so the
    // new meaning arrives announced.
    let chipPhase = null;
    function updateChip(cutoff, t) {
      let phase;
      if (t < 0.02) phase = 'pretitle';
      else if (cutoff >= env.whistleMinute - 0.5) phase = 'settled';
      else phase = 'zoom';
      if (phase === chipPhase) return;
      chipPhase = phase;
      if (phase === 'pretitle') {
        view.setChip([
          { token: 'accent-annotation', glyph: 'dot', label: "amber = tonight's match, France v Spain" },
          { token: 'field-rest', glyph: 'dim', label: 'pale grey = money at rest, the whole tournament' },
        ]);
      } else if (phase === 'zoom') {
        view.setChip([
          { token: 'side-yes', glyph: 'dot', label: 'cyan = one dot, one real trade' },
          { token: 'field-rest', glyph: 'dim', label: 'pale grey = money at rest, the whole tournament' },
        ]);
      } else {
        view.setChip([
          { token: 'side-yes', glyph: 'dot', label: 'cyan = one dot, one real trade' },
          { token: 'field-rest', glyph: 'dim', label: 'pale grey = money at rest, the whole tournament' },
          { token: 'state-dead', glyph: 'dead', label: 'dark grey = settled to zero, dead money' },
        ]);
      }
    }

    function updateForScrub(t) {
      const cutoff = env.cutoffAt(t);
      updateChip(cutoff, t);
      updateTrace(cutoff);
      // Pretitle caption: visible from kf0 (CR-18); it now clears the
      // moment trades start flowing (cutoff > 0) so it never shares its
      // lane with anything else (one caption at a time).
      if (cutoff <= 0) fadeIn(caption); else fadeOut(caption);
      // Gate-4 s01 major fix (scrub25: zero amber singletons): the dim
      // goal-preview guide owns the amber budget until the first goal
      // resolves it into the full annotation, never both at once.
      if (cutoff > 0 && cutoff < env.eventMinute) fadeIn(goalPreview); else fadeOut(goalPreview);
      if (cutoff >= env.eventMinute) {
        placeAnnotation(
          goalAnn, clockX(env.eventMinute), priceY(env.eventPriceC), 24, -28,
          view.mobile ? '①' : 'the first goal, a penalty',
        );
        fadeIn(goalAnn);
      } else {
        fadeOut(goalAnn);
      }
      // Round 4, header note (3): the second cliff gets the same amber
      // treatment when the scrub reaches it — one meaning, two instances.
      if (env.event2Minute != null && cutoff >= env.event2Minute) {
        placeAnnotation(
          goal2Ann, clockX(env.event2Minute), priceY(env.event2PriceC), 24, -30,
          view.mobile ? '②' : 'the second goal',
        );
        fadeIn(goal2Ann);
      } else {
        fadeOut(goal2Ann);
      }
      if (cutoff >= env.whistleMinute - 0.5) {
        if (view.mobile) {
          placeWhistle(clockX(env.whistleMinute), priceY(0) - 40, 24, -12, '③');
        } else {
          placeWhistle(clockX(env.whistleMinute), priceY(0) - 40, -24, -12, 'the whistle');
        }
        fadeIn(whistleGrp);
        fadeIn(settleLine, stagger);
        // floorBand's own reveal (fill-opacity) is driven by updateTrace()'s
        // onset pulse above, fired the instant the trace reaches the floor.
        if (footerLegend) fadeIn(footerLegend);
      } else {
        // Reverse scrub: the settlement furniture leaves with the pour.
        fadeOut(whistleGrp);
        fadeOut(settleLine);
        if (footerLegend) fadeOut(footerLegend);
      }
    }

    drawPriceAxis();
    drawClockAxis();
    updateChip(0, 0);

    return {
      step() {
        drawClockAxis();
        fadeIn(caption);
        updateChip(0, 0);
      },
      scrub(t) { updateForScrub(t); },
      exit() {
        g.remove();
        if (footerLegend) footerLegend.remove();
      },
    };
  },

  // Reduced motion: main.js's driveScrub() already snaps scrub tracks to
  // the nearest keyframe end-state with the standard canvas crossfade when
  // view.reducedMotion is true (CONTRACT §3.5 / §6.3). Every keyframe
  // above (bootRest / resting / kickoff / preEvent / postEvent /
  // approachFinal / whistle / settled) is independently a complete,
  // static-readable frame by construction, so the generic driver behavior
  // already satisfies "end states plus crossfades" (CONTRACT §9) for this
  // scene; no per-beat override is declared.

  beats: [
    {
      id: 'b1',
      html: `<p>For more than a year, a ticket that pays off if France wins the World Cup cost about forty cents.<sup><a href="#fn-2">2</a></sup> Here is the deal on every ticket like it: it pays one dollar if its team wins, and nothing if it does not. So a price of forty cents means the crowd thought France's chance was about forty out of a hundred. The market's own word for a ticket like this is a contract. On July 14, Spain beat France in ninety minutes, and the ticket fell to zero.<sup><a href="#fn-1">1</a></sup> Watch the white line on the chart ahead: it is France's price through that night, and it falls twice. Each fall is a Spain goal, one in each half, the first from the penalty spot. Down here, one cyan dot is one real trade from that night, and every trade has two sides: one buyer said yes, France wins, and another said no. At the final whistle, the exchange pays a dollar to every winning ticket and nothing to every losing one, a moment traders call settling, and the market closes for good. That is the grey pour you see hit the floor on screen. This was the night Spain booked tonight's final. Before you judge tonight's price, you should meet the thing that set it. The story starts fourteen months earlier.</p>`,
      // Hard budget (storyboard): the whole of S1, pre-title included,
      // occupies at most 6 viewport-heights. The static title header
      // (CONTRACT §8.2) already spends 1; this scrub spends the remaining 5.
      trigger: { type: 'scrub', span: 5 },
      // CR-18: the beat's own state key now points at the true no-amber
      // boot frame; the announced amber ignition is the scrub's kf1 (see
      // layout().keyframes), not this snap.
      state: 'bootRest',
      // 'instant': this is only the ONE-TIME snap into kf0 on first
      // activation, which already matches the boot-time setState frame
      // (engine.js dedupes same-reference/t>=1 tweens to a true no-op).
      // The fine-grained scrub motion itself is driven by
      // scrubBetween/setScrub over layout().keyframes, not by `kind`.
      kind: 'instant',
      // Declarative color-key snap for first activation (G1): plain color
      // words, matching the imperative phases the overlay drives as the
      // scrub proceeds (updateChip above).
      chip: [
        { token: 'accent-annotation', glyph: 'dot', label: "amber = tonight's match, France v Spain" },
        { token: 'field-rest', glyph: 'dim', label: 'pale grey = money at rest, the whole tournament' },
      ],
      grain: {
        // Storyboard-verbatim template (CONTRACT §4.2/§4.3 zoom.grainText
        // format); {n}/{count} are filled in by main.js's activateBeat() ->
        // zoomGrainText() at beat activation (round 3: confirmed wired —
        // the earlier "not yet called" note here was stale). {count} now
        // reads off manifest.zoom.fraesp.trades, so it tracks the rebuilt
        // France-leg-only tile automatically, with no template edit needed
        // here when the data layer re-runs the tile build.
        text: '1 dot = 1 trade · showing every {n}th of {count} trades · France–Spain, July 14',
        variant: 'debut',
      },
      overlayStep: 'b1',
    },
  ],

  zoom: {
    key: 'fraesp',
    tagBit: 'ZOOM_FRAESP',
    grainText: '1 dot = 1 trade · showing every {n}th of {count} trades · France–Spain, July 14',
  },
};
