/* docs/js/scenes/s13.js — S13 · Act IV · "The flags and the price"
 * (storyboard §3, R10 + R12; R21 as a footnote line). Layout: `flag-pairs`.
 *
 * Contract: docs/CONTRACT.md §4 (scene module shape), §4.2 (registry row:
 * act 4, 3 steps, no zoom tile). Tokens are law — every color/duration/size
 * below is a token lookup, never a literal.
 *
 * Also the S12 fold-contingency destination (storyboard §3 S12): if the
 * July 16 liveness check fires, S12 collapses into a two-step beat inside
 * this scene. That is a registry-and-beats amendment owned at that check;
 * this module ships the storyboard's "S12 stands alone" baseline and does
 * not pre-build the folded beats (nothing to silently improvise there).
 *
 * MOBILE (storyboard S13 Mobile note): "Pairs become sequential cards; the
 * units caption pins to the top of each." The rail already renders one
 * card per beat sequentially on every surface (CONTRACT §6.3); the units
 * caption element below is repositioned to the top of the stage on
 * view.mobile so it reads before the pair rather than beside it. Three
 * further view.mobile calls from the 390x844 DOM-geometry audit, each
 * documented at its own draw site: the pollster credit is dropped (it
 * shared a baseline with the relocated units caption), the host-panel
 * ratio suffix shortens to "model price" (the full phrase overran the
 * ~81px band step), and the zombie chip is dropped (it overran the right
 * edge and sits in the sheet-occluded footer band; b3's card states the
 * same figures verbatim).
 *
 * DATA REQUESTS (per-scene JSON field names are not specified beyond shape
 * in CONTRACT §5.5 — proposed here, grounded against the actual pipeline
 * columns inspected during this build):
 *   1. `pairs[]` — direct from
 *      pipeline/data/analysis/calibration/poll_vs_market_gaps.csv (real
 *      columns confirmed: poll, entity, poll_pct, kalshi_price_pct,
 *      gap_kalshi_minus_poll_pp). The Argentina row (Ipsos, Argentina-only
 *      poll) and the United States row (Pew) match the storyboard's 87%/11c
 *      and 7%/1.5c exactly; no new computation needed, just the two rows
 *      surfaced as JSON with a `team` code matching manifest.teams'
 *      convention (see #3), plus a display `label` ("Argentina", "USA") —
 *      the same field host_peers.teams rows already carry — so the stage
 *      kicker can name the country without a JS-side name table.
 *   2. `host_peers.teams[]` needs `pretournament_contracts`,
 *      `model_odds_pct`, and `price_ratio_x` (2.0 Mexico, 1.42 USA in the
 *      shipped JSON; R12's pre-recompute estimates were ~1.8/~1.5)
 *      restricted to the dossier's "clean pre-tournament window."
 *      GAP: pipeline/data/analysis/bias-forensics/us_home_bias_futures_peer.parquet
 *      (inspected during this build) carries only LIFETIME
 *      `volume_contracts` (USA 83.2M, Mexico 82.4M, Ecuador 22.3M) — about
 *      10x the dossier's pre-tournament figures (~7.5M/9.0M/3.6M/3.4M) and
 *      has no price-vs-model-odds ratio column at all. This scene needs a
 *      NEW or filtered table (e.g. `us_home_bias_pretournament_peer`) with
 *      the pre-tournament cutoff already applied and the ratio computed;
 *      the tile builder should reconcile against R12's cited figures.
 *   3. `pretournament_cutoff_s`: integer seconds since manifest.epoch (not
 *      hardcoded here) marking the tournament-kickoff cutoff used to filter
 *      population dots into the "honest pre-tournament scale" host-peer
 *      columns AND the b1/b2 pair fills (birth_ts < cutoff for both — the
 *      pair fills used to skip this filter and towered to the
 *      in-tournament tape under a pre-kickoff snapshot label).
 *   4. `team` code strings on every pair/host-peer row MUST match whatever
 *      convention `manifest.teams` actually uses — ticker suffixes
 *      inspected during this build are inconsistent (2-letter ISO for some
 *      teams, e.g. "GB"/"NO"/"MX", 3-letter for others, e.g. "ARG"/"CUW").
 *      This module never hardcodes a team code; it always resolves
 *      `manifest.teams.indexOf(row.team)` using the code the scene JSON
 *      supplies, so the tile builder's convention is authoritative.
 *   5. `zombie_money` totals (302 trades, ~$2,340) come from
 *      pipeline/data/analysis/bias-forensics/zombie_money.parquet, summed
 *      across all 28 knockout losers. Gate-5 provenance audit: the
 *      generating script's futures-leg JOIN matched on exact
 *      `yes_sub_title` team-name text, which silently dropped 2 of the 28
 *      losers over name-order/abbreviation mismatches (DR Congo/Congo DR,
 *      United States/USA) and shipped an under-scoped 277/$2,190 total;
 *      the JOIN now normalizes on a word-order-invariant, alias-mapped
 *      team name so all 28 losers resolve.
 *
 * GATE-5 BATCH 3 (items 14+15): b3 is now experiment-shaped — it names its
 * own control group (Ecuador, Croatia: two teams Opta rated at about the
 * hosts' own tiny chance, minus a home crowd) before stating the two
 * measured results, states the implication in plain words, and adds the
 * who-bought caveat (the tape counts trades, not passports). The former
 * standalone b4 (zombie-money footnote) is SHRUNK to a receipts line
 * folded into b3's own close, per author disposition; the scene drops
 * from 4 beats to 3 and `overlay().step()` now fires the zombie chip
 * alongside the host-peer panel on 'b3' rather than on its own step.
 */

/* global d3 */
import { registry, makeState, setColor } from '../shared.js';

/* ---------------------------------------------------------------- */

function hash01(i) {
  let x = (i * 2654435761 + 0x85ebca6b) >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return (x >>> 0) / 4294967296;
}

function fieldPosition(i, view) {
  const fx = view.region.x + hash01(i * 2 + 1) * view.region.w;
  const fy = view.region.y + hash01(i * 2 + 2) * view.region.h;
  return [fx, fy];
}

const PAIR_IDENTITY = { argentina: 'identity-teal', usa: 'identity-blue' };
const HOST_IDENTITY = {
  usa: 'identity-blue', mexico: 'identity-pink',
  ecuador: 'identity-lavender', croatia: 'identity-ref',
};

/* RESHAPE (chart-first pass): "DRAWN poll-vs-money bars ... dots as fill
 * texture inside bars." Both layout() (where the dots go) and overlay()
 * (the drawn bar outline) need the identical footprint, so the width/
 * spacing constants live here once and both consume them -- a mismatch
 * between the two would make the outline lie about what the dots show. */
const PAIR_BAR_W = 64;
const HOST_BAR_SPACING = 2.2;

/* Real pre-tournament dot count per host team, shared by layout() (which
 * stacks each dot to its own rank -> the same total) and overlay() (which
 * only needs the total, to draw a bar outline the stacked dots actually
 * fill). One population pass; never a fabricated or estimated height. */
function countHostDots(data, hostTeams, cutoff) {
  const counts = new Map(hostTeams.map((t) => [t.key, 0]));
  if (cutoff === undefined) return counts;
  const pop = data.pop;
  const manifest = data.manifest;
  const famIdx = manifest.enums.family.indexOf('winner_futures');
  if (famIdx < 0) return counts;
  const keyByTeamIdx = new Map(hostTeams.map((t) => [manifest.teams.indexOf(t.team), t.key]));
  for (let i = 0; i < pop.count; i++) {
    if (pop.family[i] !== famIdx) continue;
    if (pop.birth_ts[i] >= cutoff) continue;
    const key = keyByTeamIdx.get(pop.team[i]);
    if (!key) continue;
    counts.set(key, counts.get(key) + 1);
  }
  return counts;
}

/* ---------------------------------------------------------------- */

function scales(data, view) {
  const y = d3.scaleLinear()
    .domain([0, 100])
    .range([view.region.y + view.region.h, view.region.y]);

  const pairX = { poll: view.region.x + view.region.w * 0.32, price: view.region.x + view.region.w * 0.56 };

  const sceneJson = data.scene || {};
  const hostTeams = (sceneJson.host_peers && sceneJson.host_peers.teams) || [];
  const hostX = d3.scaleBand()
    .domain(hostTeams.map((t) => t.key))
    .range([view.region.x, view.region.x + view.region.w])
    .paddingInner(0.35)
    .paddingOuter(0.15);

  registry.register('s13.y', y);
  registry.register('s13.pairX', pairX);
  registry.register('s13.hostX', hostX);
  return { y, pairX, hostX };
}

/* ---------------------------------------------------------------- */

function layout(data, view) {
  const N = data.pop.count;
  const pop = data.pop;
  const manifest = data.manifest;
  const sceneJson = data.scene || {};
  const pairs = sceneJson.pairs || [];
  const hostPeers = sceneJson.host_peers || {};
  const hostTeams = hostPeers.teams || [];
  const famIdx = manifest.enums.family.indexOf('winner_futures');

  const y = registry.get('s13.y');
  const pairX = registry.get('s13.pairX');
  const hostX = registry.get('s13.hostX');

  const baseSize = view.tokens.dot['radius-base-px'];
  // Resting field uses the dimmed-field tint (dimmed-field-min, 0.25 alpha),
  // not the standard rest tint, so the tournament's money recedes and the
  // featured country/host columns read as figure. That low alpha lands in
  // the engine's rest-classify tier, so the shader dims it while boosting
  // the full-alpha active subset (research/revision/perception-brief.md
  // §9b, §10.1); matches this scene's own S16 anchor, which already dims to
  // dimmed-field-min.
  const restRgba = view.state('dimmed-field-min');

  const states = { argentina: makeState(N), usa: makeState(N), peers: makeState(N) };

  // Default: scattered, dim (population constancy).
  for (const key of Object.keys(states)) {
    const st = states[key];
    for (let i = 0; i < N; i++) {
      const [fx, fy] = fieldPosition(i, view);
      st.x[i] = fx; st.y[i] = fy;
      setColor(st.color, i, restRgba);
      st.size[i] = baseSize;
    }
  }

  // --- Pair steps: one country's winner-futures dots FILL a bar footprint
  // from the zero baseline up to the price each dot actually traded at,
  // restricted -- exactly like the host-peer step below -- to money born
  // BEFORE the tournament-kickoff cutoff (birth_ts < pretournament_cutoff_s,
  // the same scene-JSON field). That window is the claim everything else in
  // the beat makes: the amber label is a pre-kickoff snapshot price, and the
  // host panel's footer already promises "before kickoff." Unfiltered, this
  // fill towered to the in-tournament tape (Argentina money bought at 40c+
  // as they advanced) under an 11-cent label -- the outline told the
  // snapshot claim and the dots told a different one. Post-fix the two
  // agree by construction: pre-kickoff Argentina dots sit in the 9-10c
  // bands against the 11c outline, USA dots at 1-4c against 1.5c (verified
  // against pop-75k.bin during this fix). Previously these dots also sat in
  // a thin horizontal streak at a single height, which read as a scatter,
  // not a bar (design-revision-spec: "dots as fill texture inside bars"). ---
  const barBottom = view.region.y + view.region.h;
  const pairCutoff = hostPeers.pretournament_cutoff_s;
  if (famIdx >= 0 && pairCutoff !== undefined) {
    for (const pair of pairs) {
      const teamIdx = manifest.teams.indexOf(pair.team);
      if (teamIdx < 0) continue;
      const rgba = view.color(PAIR_IDENTITY[pair.key] || 'identity-ref', 1.0);
      const targetState = states[pair.key];
      if (!targetState) continue;
      for (let i = 0; i < N; i++) {
        if (pop.family[i] !== famIdx || pop.team[i] !== teamIdx) continue;
        if (pop.birth_ts[i] >= pairCutoff) continue;
        const priceC = pop.price_band[i];
        if (priceC === 255) continue;
        const barTop = y(priceC);
        const fx = pairX.price - PAIR_BAR_W / 2 + hash01(i) * PAIR_BAR_W;
        const fy = barTop + hash01(i * 13 + 5) * Math.max(1, barBottom - barTop);
        targetState.x[i] = fx;
        targetState.y[i] = fy;
        setColor(targetState.color, i, rgba);
      }
    }
  }

  // --- Host-peer step: four teams' winner-futures dots, restricted to the
  // clean pre-tournament window, stacked bottom-up so column height (dot
  // count) is the "honest pre-tournament scale." Zero-baselined (§4.5). ---
  if (famIdx >= 0 && hostTeams.length) {
    const bottom = view.region.y + view.region.h;
    const spacing = HOST_BAR_SPACING;
    const ranks = new Map(hostTeams.map((t) => [t.key, 0]));
    const teamIdxByKey = new Map(hostTeams.map((t) => [t.key, manifest.teams.indexOf(t.team)]));
    const keyByTeamIdx = new Map(hostTeams.map((t) => [manifest.teams.indexOf(t.team), t.key]));
    const cutoff = hostPeers.pretournament_cutoff_s;

    if (cutoff !== undefined) {
      for (let i = 0; i < N; i++) {
        if (pop.family[i] !== famIdx) continue;
        if (pop.birth_ts[i] >= cutoff) continue;
        const key = keyByTeamIdx.get(pop.team[i]);
        if (!key) continue;
        const rank = ranks.get(key);
        ranks.set(key, rank + 1);
        const cx = hostX(key);
        if (cx === undefined) continue;
        const bw = hostX.bandwidth();
        const jitter = (hash01(i) - 0.5) * bw * 0.6;
        states.peers.x[i] = cx + bw / 2 + jitter;
        states.peers.y[i] = bottom - rank * spacing;
        setColor(states.peers.color, i, view.color(HOST_IDENTITY[key] || 'identity-ref', 1.0));
      }
    }
  }

  return { states };
}

/* ---------------------------------------------------------------- */

function overlay(container, data, view, scalesObj) {
  const sceneJson = data.scene || {};
  const pairs = sceneJson.pairs || [];
  const hostPeers = sceneJson.host_peers || {};
  const hostTeams = hostPeers.teams || [];
  const y = scalesObj.y;
  const pairX = scalesObj.pairX;
  const hostX = scalesObj.hostX;

  const g = container.svg.append('g').attr('class', 's13-overlay');

  // Units caption: the scene's one standing Zone K occupant, on screen for
  // the whole scene (design-revision-spec CR-12), but its TEXT now tracks
  // the step: the pair beats' "poll bars" line was persisting into b3,
  // where no poll bar exists and column height means dot count, not price.
  // Each step restates its own encoding instead. Both wordings carry the
  // pre-kickoff qualifier the b1/b2 fill filter (layout()) now enforces.
  // Repositioned to the top on mobile per the storyboard note.
  const unitsCaption = g.append('text')
    .attr('class', 's13-units-caption')
    .attr('x', view.mobile ? view.region.x : view.region.x)
    .attr('y', view.mobile ? view.region.y - 8 : view.region.y - 32)
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-caption-size'))
    .style('fill', view.css('ink-mid'))
    .style('opacity', 0);
  const unitsLine1 = unitsCaption.append('tspan')
    .attr('x', view.region.x).attr('dy', '0em');
  const unitsLine2 = unitsCaption.append('tspan')
    .attr('x', view.region.x).attr('dy', '1.15em');
  function setUnitsCaption(l1, l2) {
    unitsLine1.text(l1);
    unitsLine2.text(l2);
  }

  const pairG = g.append('g').attr('class', 's13-pair').style('opacity', 0);
  const hostG = g.append('g').attr('class', 's13-hosts').style('opacity', 0);
  const footnoteChip = g.append('text')
    .attr('class', 's13-zombie-chip')
    .attr('x', view.region.x)
    // Gate-5 batch 3: this draws together with the b3 host panel (see
    // step(), one beat, not two), so it sits below BOTH the country-name
    // row (h+18) and the host panel's own unit label (h+34). Two tspan
    // lines (subject, then figures) starting at h+50: the subject prefix
    // pushed a single line to ~700px of 13px tape, wider than the room
    // right of region.x at the 900px-wide desktop floor, and the second
    // line's baseline (h+50 + 1.1em = h+64, i.e. 0.92*H + 64) still
    // clears the canvas bottom at H=900 (892 < 900).
    .attr('y', view.region.y + view.region.h + 50)
    .style('font-family', view.css('font-tape'))
    .style('font-size', view.css('type-tape-size'))
    .style('fill', view.css('ink-low'))
    .style('opacity', 0);

  function drawPair(key) {
    pairG.selectAll('*').remove();
    const pair = pairs.find((p) => p.key === key);
    if (!pair) return;

    // Scale titles, redrawn with the pair (design-revision-spec G3: "s13
    // scale titles at first pair" -- shown on every pair so the units are
    // never more than one screen away from the marks they describe).
    // These used to hang at region.y - 74, which the review viewport
    // clips: at H=900, region.y = 0.08*900 = 72, so the baseline sat at
    // -2, off-canvas. Down here the arithmetic works at every sane
    // height: titleBase = region.y + region.h = 0.92*H (828 at H=900),
    // titles at +20/+36 land at 848/864, inside the canvas whenever
    // H >= ~500. The two rows STAGGER vertically because the poll title
    // is ~260px wide at micro size and the two column centers sit only
    // 0.24*region.w apart (~116px at the 900px-wide desktop floor), too
    // close to share one row. Nothing else draws below the baseline on
    // the pair beats (the b3 footer ladder lives in hostG).
    const titleBase = view.region.y + view.region.h;
    pairG.append('text')
      .attr('x', pairX.poll).attr('y', titleBase + 20)
      .attr('text-anchor', 'middle')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-micro-size'))
      .style('fill', view.css('ink-low'))
      .text('fans who said their team would win (poll %)');
    pairG.append('text')
      .attr('x', pairX.price).attr('y', titleBase + 36)
      .attr('text-anchor', 'middle')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-micro-size'))
      .style('fill', view.css('ink-low'))
      .text('market price (cents)');

    // Poll bar: outline-only D3 mark (respondents are not trades, §0).
    const pollH = (pair.poll_pct / 100) * view.region.h;
    pairG.append('rect')
      .attr('x', pairX.poll - PAIR_BAR_W / 2)
      .attr('y', view.region.y + view.region.h - pollH)
      .attr('width', PAIR_BAR_W).attr('height', pollH)
      .style('fill', 'none')
      .style('stroke', view.css('neutral-data'))
      .style('stroke-width', 1.5);
    pairG.append('text')
      .attr('x', pairX.poll).attr('y', view.region.y + view.region.h - pollH - 10)
      .attr('text-anchor', 'middle')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-annotation-size'))
      .style('fill', view.css('ink-hi'))
      // Round to one decimal so pipeline float artifacts (e.g.
      // 7.000000000000001) never render (Gate-4 visual-story review).
      .text(`${Math.round(pair.poll_pct * 10) / 10}% poll`);

    // Money bar: a DRAWN outline over the exact footprint layout()'s dot
    // fill uses (PAIR_BAR_W, same zero baseline) -- the population itself
    // is the fill texture inside this shape, never a separate mark
    // (design-revision-spec: "dots as fill texture inside bars"). Stroke
    // is the player's own identity hue (matches the key row); the price
    // number is the beat's one amber callout.
    const priceTop = y(pair.kalshi_price_pct);
    const priceH = Math.max(0, (view.region.y + view.region.h) - priceTop);
    pairG.append('rect')
      .attr('x', pairX.price - PAIR_BAR_W / 2)
      .attr('y', priceTop)
      .attr('width', PAIR_BAR_W).attr('height', priceH)
      .style('fill', 'none')
      .style('stroke', view.css(PAIR_IDENTITY[key] || 'identity-ref'))
      .style('stroke-width', 1.5);
    // The beat's one amber callout, anchored OUTSIDE the dot footprint:
    // to the RIGHT of the column at the price line, tied back by a short
    // leader. Over the column itself (the old priceTop - 18) the fill
    // overprinted the glyphs -- b2's whole blob trades at 1-4c, engulfing
    // any label near its own top. The right side is open field on every
    // surface: the column's right edge is region.x + 0.56*region.w + 32,
    // and the label ends ~150px past it, inside region.w (484px at the
    // 900px-wide desktop floor).
    const priceEdgeR = pairX.price + PAIR_BAR_W / 2;
    pairG.append('line')
      .attr('x1', priceEdgeR + 4).attr('y1', priceTop)
      .attr('x2', priceEdgeR + 40).attr('y2', priceTop)
      .style('stroke', view.css('accent-annotation'))
      .style('stroke-width', 1);
    pairG.append('text')
      .attr('x', priceEdgeR + 46).attr('y', priceTop + 4)
      .attr('text-anchor', 'start')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-annotation-size'))
      .style('fill', view.css('accent-annotation'))
      .text(`${pair.kalshi_price_pct}¢ price`);

    // Kicker: the COUNTRY -- the subject the beat is actually about --
    // with the pollster demoted to a caption-size source line beneath it.
    // The pollster name used to BE the 28px ink-hi kicker while the
    // country never appeared on stage at all. `pair.label` is the scene
    // JSON's own display name (same field host_peers.teams rows carry);
    // the team code is the fallback, never a JS-side name table.
    // Anchored text-end just LEFT of the fixed KEY panel: the region's
    // own top-right corner sits UNDER that panel (the blind re-read saw
    // both lines as a dark smudge behind it), so the exclusion width the
    // design system reserves for the KEY is the real right edge here.
    // The standing caption at the top-left ends well short of where a
    // country name of this length starts, at every viewport width.
    const kickerX = view.mobile
      ? view.region.x + view.region.w
      : view.W - (view.tokens.spacing_px[4] || 24)
        - (view.tokens.layout['key-exclusion-w-px'] || 280)
        - (view.tokens.spacing_px[2] || 12);
    pairG.append('text')
      .attr('x', kickerX)
      .attr('y', view.region.y - 26)
      .attr('text-anchor', 'end')
      .style('font-family', view.css('font-apparatus'))
      .style('font-weight', 600)
      .style('font-size', view.css('type-kicker-size'))
      .style('fill', view.css('ink-hi'))
      .text(pair.label || pair.team);
    // Mobile (390x844 DOM-geometry audit): this right-anchored pollster
    // credit shares its baseline (region.y - 8) with the standing units
    // caption's first line once that caption moves to the top on mobile,
    // and the two met mid-strip with ~20px of bbox overlap. At this width
    // the credit is the strip's lowest-value occupant -- the sourcing
    // already lives in footnote 17 in the card, and the kicker above
    // still names the country -- so it is dropped behind a view.mobile
    // guard rather than crammed. Desktop keeps the credit.
    if (!view.mobile) {
      pairG.append('text')
        .attr('x', kickerX)
        .attr('y', view.region.y - 8)
        .attr('text-anchor', 'end')
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-caption-size'))
        .style('fill', view.css('ink-mid'))
        .text(pair.poll_source ? `${pair.poll_source.split('(')[0].trim()} poll` : '');
    }

    pairG.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
    hostG.style('opacity', 0);
    footnoteChip.style('opacity', 0);
  }

  function drawHostPeers() {
    hostG.selectAll('*').remove();
    // Zero baseline (§4.5: "zero-baselined columns always").
    hostG.append('line')
      .attr('x1', view.region.x).attr('x2', view.region.x + view.region.w)
      .attr('y1', view.region.y + view.region.h).attr('y2', view.region.y + view.region.h)
      .style('stroke', view.css('ink-low')).style('stroke-width', 1);

    // Unit label for this panel (G3: every chart names its units). Column
    // height here is a dot count, not a price, so the honest label ties
    // back to the piece's own grain grammar rather than borrowing a price
    // axis this panel does not actually have.
    // Moved from inside the chart (baseline - 8) to the footer, below the
    // country-name row: at the baseline, this text crossed the SHORTER
    // bars' own top edges and dot fill (Ecuador, Croatia) once those bars
    // gained a drawn outline this pass. Zone F placement (G5): left-aligned
    // to region.x, clear of every bar regardless of height.
    // Footer ladder, compressed so the now-two-line zombie chip fits the
    // 0.08*H band under the baseline (72px at H=900): countries +18,
    // this unit line +34, chip lines +50/+64 -- every neighboring pair
    // keeps >=3px between descenders and cap tops at those sizes.
    hostG.append('text')
      .attr('x', view.region.x).attr('y', view.region.y + view.region.h + 34)
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-micro-size'))
      .style('fill', view.css('ink-low'))
      .text(`each dot: $${Math.round(view.grain.usd).toLocaleString('en-US')} of real money, before kickoff`);

    // Bar outlines: the SAME per-host dot count layout() stacked into a
    // column, drawn once as a rectangle so the stacked dots read as "fill
    // texture inside a bar" rather than a loose scatter (design-revision-
    // spec: "DRAWN ... host columns").
    const hostCounts = countHostDots(data, hostTeams, hostPeers.pretournament_cutoff_s);

    hostTeams.forEach((t) => {
      const cx = hostX(t.key);
      if (cx === undefined) return;
      const bw = hostX.bandwidth();
      const barH = (hostCounts.get(t.key) || 0) * HOST_BAR_SPACING;
      const barTop = view.region.y + view.region.h - barH;
      hostG.append('rect')
        .attr('x', cx).attr('y', barTop)
        .attr('width', bw).attr('height', barH)
        .style('fill', 'none')
        .style('stroke', view.css(HOST_IDENTITY[t.key] || 'identity-ref'))
        .style('stroke-width', 1.5);
      hostG.append('text')
        .attr('x', cx + bw / 2).attr('y', view.region.y + view.region.h + 18)
        .attr('text-anchor', 'middle')
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-caption-size'))
        .style('fill', view.css('ink-mid'))
        .text(t.label || t.key);

      if (typeof t.price_ratio_x === 'number') {
        // Derived quantity (a ratio, not money): D3 mark, not a dot.
        // No amber here (design-revision-spec CR: "b3: NO amber") -- the
        // beat's point is that attention bought volume, not belief, so the
        // ratio reads as plain fact, not a flagged anomaly.
        // The label hangs just above ITS OWN bar top -- barTop is the same
        // stacked-dot height the outline uses, so the annotation stays
        // bound to the bar it describes at any recompute (the old fixed
        // markerY at region.h * 0.25 floated ~320px above both bars).
        // Two short stacked lines, not one wide one: adjacent host columns
        // sit one band step apart (~122px at the 900px-wide desktop
        // floor), and "the model's price" (~120px at caption size) fits a
        // step where the full one-line phrase (~155px) did not.
        const ratioLabel = hostG.append('text')
          .attr('x', cx + bw / 2).attr('y', barTop - 28)
          .attr('text-anchor', 'middle')
          .style('font-family', view.css('font-apparatus'))
          .style('font-size', view.css('type-caption-size'))
          .style('fill', view.css('ink-hi'));
        ratioLabel.append('tspan')
          .attr('x', cx + bw / 2).attr('dy', '0em')
          .style('font-weight', 600)
          .text(`${t.price_ratio_x}x`);
        ratioLabel.append('tspan')
          .attr('x', cx + bw / 2).attr('dy', '1.15em')
          // Mobile (390x844 DOM-geometry audit): the USA and Mexico
          // columns sit one band step apart (~81px at 390px wide), and
          // "the model's price" (~109px at caption size there) overlapped
          // its neighbor by ~28px. "model price" (~70px) fits the step
          // with ~10px between adjacent labels and keeps the ratio's
          // referent on stage -- a bare "2x" could read as 2x the peers'
          // MONEY (the beat's other true fact), so the suffix is
          // shortened, never dropped. Desktop keeps the full phrase.
          .text(view.mobile ? 'model price' : "the model's price");
      }
    });

    hostG.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
    pairG.style('opacity', 0);
  }

  function drawZombieFootnote() {
    const z = sceneJson.zombie_money;
    if (!z) return;
    // Mobile (390x844 DOM-geometry audit): the chip's figures line ran
    // 34px past the viewport's right edge, and the whole footer band it
    // lives in -- below region bottom, which IS the 62vh stage floor on
    // mobile -- sits behind the 38vh prose sheet anyway (shared.js
    // mobileAxisOrientation note: below-baseline text is occluded, G3).
    // The receipt is not lost: b3's own card states the same figures in
    // full ("302 housekeeping trades worth about $2,340"). Dropped behind
    // a view.mobile guard rather than wrapped into three occluded lines;
    // desktop keeps the chip.
    if (view.mobile) return;
    const cents = z.max_price_c === 1 ? '1 cent' : `${z.max_price_c} cents`;
    // The chip leads with its own SUBJECT. Bare, the figures sat directly
    // under "each dot: $75,000 of real money" and read as a contradiction
    // of it; the subject line names whose money this is. The wording
    // mirrors the rail's own "all 28 knocked-out teams" sentence without
    // restating the count, which lives in the rail prose, not this JSON.
    footnoteChip.selectAll('*').remove();
    footnoteChip.append('tspan')
      .attr('x', view.region.x).attr('dy', '0em')
      .text('wind-down across every knocked-out team:');
    footnoteChip.append('tspan')
      .attr('x', view.region.x).attr('dy', '1.1em')
      .text(`${z.n_trades} trades, about $${Math.round(z.total_usd).toLocaleString('en-US')}, all at ${cents} or less.`);
    footnoteChip.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
  }

  function step(beatId) {
    // The standing units caption (CR-12) stays lit for the whole scene;
    // its text switches to each step's own encoding (see its comment).
    if (beatId === 'b3') {
      setUnitsCaption('Each column stacks money traded before kickoff.',
        'Taller means more money, not a higher price.');
    } else {
      setUnitsCaption('Poll bars are agreement, not probability.',
        'Dot columns are money traded before kickoff.');
    }
    unitsCaption.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
    if (beatId === 'b1') {
      drawPair('argentina');
    } else if (beatId === 'b2') {
      drawPair('usa');
    } else if (beatId === 'b3') {
      // Gate-5 batch 3 (item 15): the zombie-money receipt is now this
      // beat's own close, not a fourth scroll step, so both panels draw
      // together here.
      drawHostPeers();
      drawZombieFootnote();
    }
  }

  function exit() {
    g.selectAll('*').interrupt();
    g.remove();
  }

  return { step, scrub: undefined, exit };
}

/* ---------------------------------------------------------------- */

const s13 = {
  id: 's13',
  act: 4,
  title: 'The flags and the price',
  // Gate-4 round 2 (structure-spec §3): S13 is the course's second fake
  // flaw, on Argentina-flag night: fan love never got a vote in the price.
  kicker: 'Skill 5, continued — the patriotism alarm is false too',
  layoutName: 'flag-pairs',

  needs: { scene: true, series: [], zoom: null },

  scales,
  layout,
  overlay,

  beats: [
    {
      id: 'b1',
      html: `<p>The fans never got a vote on the price. In one poll, 87 out
        of 100 Argentine fans said Argentina would win the World Cup again.
        At the same time, this market priced that exact outcome at 11
        cents. A poll counts how many people agree. A price is real money
        betting on what will actually happen. Here, the two told very
        different stories.<sup><a href="#fn-17">17</a></sup></p>`,
      trigger: 'step',
      state: 'argentina',
      kind: 'resort',
      chip: [
        { token: 'identity-teal', glyph: 'dot', label: "teal = Argentina's money" },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      grain: { text: '1 dot = {grainUsd} of real money traded', variant: 'return' },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>The same gap showed up at home. 7 out of 100 Americans
        picked the USA to win it all. The exchange that lists this market
        is built in the United States, and it still priced the USA's
        ticket at a cent and a half.<sup><a href="#fn-17">17</a></sup></p>`,
      trigger: 'step',
      state: 'usa',
      kind: 'resort',
      chip: [
        { token: 'identity-blue', glyph: 'dot', label: "blue = the USA's money" },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      overlayStep: 'b2',
    },
    {
      // Gate-5 batch 3 (items 14+15): experiment-shaped host-bias close.
      // b1/b2 already showed belief (the poll) barely moving the price;
      // this beat runs the same test on enthusiasm (host money) and folds
      // the former standalone zombie-money beat in as its own receipt, so
      // the scene ends on one beat, not two.
      id: 'b3',
      html: `<p>Playing host was real money, just not real belief. Mexico
        and the USA are the hosts. One computer model, built by Opta,
        plays out the tournament thousands of times and rates each team's
        true chance. Ecuador and Croatia carried about the same tiny
        chance, with no home crowd behind them. Those two make the fair
        comparison.</p><p>Against those two peers, Mexico and the USA each
        pulled in roughly two to two and a half times the money before the
        tournament even began. That attention did nudge the price, but
        only a little. Mexico traded at about 2 times its model chance,
        and the USA at about 1.4 times its model chance, on the eve of
        kickoff.<sup><a href="#fn-18">18</a></sup> Those model chances
        started tiny. Multiply a tiny chance by 2 and you still land on a
        tiny number, a point or two of price, not ten.</p><p>Read next to
        the polls above, the pattern repeats: belief barely moved the
        price, and love barely moved it either. The market took the fans'
        extra money and mostly shrugged it off. One honest limit belongs
        here too: the tape counts trades, not passports. Nobody signs a
        name to a buy order. Calling that extra money &ldquo;fan
        money&rdquo; is this piece's best guess, not a fact the tape can
        prove.</p><p>And when teams actually died, their tickets died
        clean. Across all 28 knocked-out teams, the wind-down was 302
        housekeeping trades worth about $2,340, closed-out positions and
        leftover orders, nothing more.<sup><a href="#fn-18">18</a></sup>
        Tonight the flags at MetLife Stadium will be Argentina's, and
        loud. Now you know the price will not care. It never
        did.</p>`,
      trigger: 'step',
      state: 'peers',
      kind: 'resort',
      chip: [
        { token: 'identity-blue', glyph: 'dot', label: "blue = the USA's money" },
        { token: 'identity-pink', glyph: 'dot', label: "pink = Mexico's money" },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      overlayStep: 'b3',
    },
  ],

  /* Reduced motion: every beat already targets a static-readable resort
   * end state (rest -> a price/poll pair, or -> the host-peer columns);
   * the engine's instant-set + 400ms crossfade covers all four without a
   * scene-level substitution (CONTRACT §3.5, §9). */
  reducedMotion: { states: {} },

  anchors: {
    /* L4 recap for S16's lens carousel (CONTRACT §4 `anchors?`): the
     * Argentina poll-price pair, rebuilt as a price column from the
     * population's own Argentina winner_futures dots at their real traded
     * price (the storyboard's 11-cent market). Self-sufficient: reads only
     * data.pop and data.manifest, builds a fresh local price scale, and
     * never depends on data.scene (S16 loads no scenes table). The 87% poll
     * bar is a D3 outline mark drawn only when a caller supplies the poll
     * row, so the figure is never fabricated here; the real column of money
     * carries the recap, and S16 spotlights exactly these dots. */
    pair(data, view, rect) {
      const { pop, manifest } = data;
      const N = pop.count;
      const state = makeState(N);
      const famIdx = manifest.enums.family.indexOf('winner_futures');
      const argIdx = manifest.teams.indexOf('ARG');
      const y = d3.scaleLinear().domain([0, 100]).range([rect.y + rect.h - 8, rect.y + 8]);
      const colX = rect.x + rect.w * 0.60;
      const teal = view.color('identity-teal', 1.0);
      const rest = view.state('dimmed-field-min');
      const baseSize = view.tokens.dot['radius-base-px'];
      for (let i = 0; i < N; i++) {
        if (pop.team[i] === argIdx && pop.family[i] === famIdx && pop.price_band[i] !== 255) {
          state.x[i] = colX + (hash01(i) - 0.5) * rect.w * 0.14;
          state.y[i] = y(pop.price_band[i]);
          setColor(state.color, i, teal);
        } else {
          state.x[i] = rect.x + rect.w * (0.04 + 0.36 * hash01(i * 5 + 1));
          state.y[i] = rect.y + rect.h * (0.08 + 0.84 * hash01(i * 9 + 2));
          setColor(state.color, i, rest);
        }
        state.size[i] = baseSize;
      }
      const pairs = (data.scene && data.scene.pairs) || [];
      const argPair = pairs.find((p) => p.key === 'argentina' || p.team === 'ARG');
      return {
        state,
        drawAxes(g) {
          const ax = g.append('g').attr('class', 's13-anchor-axes');
          ax.append('g')
            .attr('transform', `translate(${rect.x},0)`)
            .call(d3.axisLeft(y).ticks(4).tickFormat((d) => `${d}¢`))
            .call((s) => {
              s.selectAll('text').attr('fill', view.css('ink-low'))
                .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-micro-size'));
              s.selectAll('path,line').attr('stroke', view.css('ink-low'));
            });
          if (argPair && typeof argPair.poll_pct === 'number') {
            const pollX = rect.x + rect.w * 0.30;
            const barW = Math.min(48, rect.w * 0.12);
            const pollH = (argPair.poll_pct / 100) * rect.h;
            ax.append('rect')
              .attr('x', pollX - barW / 2).attr('y', rect.y + rect.h - pollH)
              .attr('width', barW).attr('height', pollH)
              .attr('fill', 'none').attr('stroke', view.css('neutral-data')).attr('stroke-width', 1.5);
          }
          ax.append('text').attr('x', rect.x).attr('y', rect.y - 6)
            .attr('fill', view.css('ink-mid'))
            .style('font-family', view.css('font-apparatus')).style('font-size', view.css('type-caption-size'))
            .text('poll bars are agreement, not probability');
        },
      };
    },
  },
};

export default s13;
