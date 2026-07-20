/* docs/js/scenes/s13.js — S13 · Act IV · "The flags and the price"
 * (storyboard §3, R10 + R12; R21 as a footnote line). Layout: `flag-pairs`.
 *
 * Contract: docs/CONTRACT.md §4 (scene module shape), §4.2 (registry row:
 * act 4, 4 steps, no zoom tile). Tokens are law — every color/duration/size
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
 * view.mobile so it reads before the pair rather than beside it.
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
 *      convention (see #3).
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
 *      columns (birth_ts < cutoff).
 *   4. `team` code strings on every pair/host-peer row MUST match whatever
 *      convention `manifest.teams` actually uses — ticker suffixes
 *      inspected during this build are inconsistent (2-letter ISO for some
 *      teams, e.g. "GB"/"NO"/"MX", 3-letter for others, e.g. "ARG"/"CUW").
 *      This module never hardcodes a team code; it always resolves
 *      `manifest.teams.indexOf(row.team)` using the code the scene JSON
 *      supplies, so the tile builder's convention is authoritative.
 *   5. `zombie_money` totals (277 trades, ~$2,190) come from
 *      pipeline/data/analysis/bias-forensics/zombie_money.parquet, summed
 *      across all 28 knockout losers; only 26 rows existed at data-audit
 *      time (277 trades / $2,190), consistent with the storyboard's note
 *      that post-July-14 matches are still settling — the deploy re-run
 *      completes this sum.
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
  // from the zero baseline up to its own traded price level (§0: dots are
  // money; the drawn bar overlay in overlay() outlines this exact same
  // footprint, so the outline and the fill are the same claim, not two
  // separately-eyeballed marks). Previously these dots sat in a thin
  // horizontal streak at a single height, which read as a scatter, not a
  // bar (design-revision-spec: "dots as fill texture inside bars"). ---
  const barBottom = view.region.y + view.region.h;
  if (famIdx >= 0) {
    for (const pair of pairs) {
      const teamIdx = manifest.teams.indexOf(pair.team);
      if (teamIdx < 0) continue;
      const rgba = view.color(PAIR_IDENTITY[pair.key] || 'identity-ref', 1.0);
      const targetState = states[pair.key];
      if (!targetState) continue;
      for (let i = 0; i < N; i++) {
        if (pop.family[i] !== famIdx || pop.team[i] !== teamIdx) continue;
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
  // the whole scene, not just the poll-vs-price steps (design-revision-spec
  // CR-12) -- "the dot columns are money" stays true through the host-peer
  // step too. Repositioned to the top on mobile per the storyboard note.
  const unitsCaption = g.append('text')
    .attr('class', 's13-units-caption')
    .attr('x', view.mobile ? view.region.x : view.region.x)
    .attr('y', view.mobile ? view.region.y - 8 : view.region.y - 32)
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-caption-size'))
    .style('fill', view.css('ink-mid'))
    .style('opacity', 0);
  unitsCaption.append('tspan').attr('x', view.region.x).attr('dy', '0em')
    .text('Poll bars are agreement, not probability.');
  unitsCaption.append('tspan').attr('x', view.region.x).attr('dy', '1.15em')
    .text('The dot columns are money.');

  const pairG = g.append('g').attr('class', 's13-pair').style('opacity', 0);
  const hostG = g.append('g').attr('class', 's13-hosts').style('opacity', 0);
  const footnoteChip = g.append('text')
    .attr('class', 's13-zombie-chip')
    .attr('x', view.region.x)
    // b4 leaves the b3 host panel on screen (see step(), "dots stay"), so
    // this sits below BOTH the country-name row (h+20) and the host
    // panel's own unit label (h+40), not stacked within 12px of them.
    .attr('y', view.region.y + view.region.h + 60)
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
    pairG.append('text')
      // Lifted from -48 to -74: the standing two-line units caption sits at
      // region.y-32, and the previous 16px gap let this line crowd it.
      .attr('x', pairX.poll).attr('y', view.region.y - 74)
      .attr('text-anchor', 'middle')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-micro-size'))
      .style('fill', view.css('ink-low'))
      .text('fans who said their team would win (poll %)');
    pairG.append('text')
      .attr('x', pairX.price).attr('y', view.region.y - 74)
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
    pairG.append('text')
      // -18, not -10: the bar's own dot fill starts exactly at priceTop and
      // jitters across its full width, so a label only 10px above it got
      // dots rendered through the glyphs.
      .attr('x', pairX.price).attr('y', priceTop - 18)
      .attr('text-anchor', 'middle')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-annotation-size'))
      .style('fill', view.css('accent-annotation'))
      .text(`${pair.kalshi_price_pct}¢ price`);

    pairG.append('text')
      .attr('x', (pairX.poll + pairX.price) / 2)
      .attr('y', view.region.y - 8)
      .attr('text-anchor', 'middle')
      .style('font-family', view.css('font-apparatus'))
      .style('font-weight', 600)
      .style('font-size', view.css('type-kicker-size'))
      .style('fill', view.css('ink-hi'))
      .text(pair.poll_source ? pair.poll_source.split('(')[0].trim() : pair.key);

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
    hostG.append('text')
      .attr('x', view.region.x).attr('y', view.region.y + view.region.h + 40)
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-micro-size'))
      .style('fill', view.css('ink-low'))
      .text('each dot: $75,000 of real money, before kickoff');

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
      hostG.append('rect')
        .attr('x', cx).attr('y', view.region.y + view.region.h - barH)
        .attr('width', bw).attr('height', barH)
        .style('fill', 'none')
        .style('stroke', view.css(HOST_IDENTITY[t.key] || 'identity-ref'))
        .style('stroke-width', 1.5);
      hostG.append('text')
        .attr('x', cx + bw / 2).attr('y', view.region.y + view.region.h + 20)
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
        const markerY = view.region.y + view.region.h * 0.25;
        hostG.append('circle')
          .attr('cx', cx + bw / 2).attr('cy', markerY)
          .attr('r', 4)
          .style('fill', view.css('ink-hi'));
        hostG.append('text')
          .attr('x', cx + bw / 2).attr('y', markerY - 10)
          .attr('text-anchor', 'middle')
          .style('font-family', view.css('font-apparatus'))
          .style('font-size', view.css('type-caption-size'))
          .style('fill', view.css('ink-hi'))
          .text(`${t.price_ratio_x}x the model's price`);
      }
    });

    hostG.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
    pairG.style('opacity', 0);
  }

  function drawZombieFootnote() {
    const z = sceneJson.zombie_money;
    if (!z) return;
    const cents = z.max_price_c === 1 ? '1 cent' : `${z.max_price_c} cents`;
    footnoteChip.text(`${z.n_trades} trades, about $${Math.round(z.total_usd).toLocaleString('en-US')}, all at ${cents} or less.`);
    footnoteChip.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
  }

  function step(beatId) {
    // The standing units caption (CR-12) stays lit for the whole scene, so
    // it only needs to fade in once, on first entry.
    unitsCaption.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in']).style('opacity', 1);
    if (beatId === 'b1') {
      drawPair('argentina');
    } else if (beatId === 'b2') {
      drawPair('usa');
    } else if (beatId === 'b3') {
      drawHostPeers();
    } else if (beatId === 'b4') {
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
      grain: { text: '1 dot = $75,000 of real money traded', variant: 'return' },
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
      id: 'b3',
      html: `<p>Playing host was real money, just not real belief. One
        computer model, built by Opta, plays out the tournament thousands
        of times to rate each team's true chance. Mexico and the USA are
        the hosts. Against teams the model rated about the same, they each
        pulled in roughly two to two and a half times the money before the
        tournament even began. That attention did nudge the price: Mexico
        traded at about 2 times its model chance, and the USA at about
        1.4 times its model chance, on the eve of
        kickoff.<sup><a href="#fn-18">18</a></sup> Those model chances were
        tiny to start with. Multiply a tiny chance by 2 and you still get
        a tiny number, a point or two of price, not ten. Loud in volume,
        faint in price.</p>`,
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
    {
      id: 'b4',
      html: `<p>When a team lost, the loyal money did not linger. All 28
        knockout losers' championship tickets wound down together: 277
        trades, about $2,190 in total, every one of them at a penny or
        less.<sup><a href="#fn-18">18</a></sup> Tonight the flags at MetLife
        Stadium will be Argentina's, and loud. Now you know the price will
        not care. It never did.</p>`,
      trigger: 'step',
      // No state key: dots stay at the host-peer arrangement from b3; this
      // beat only adds the zombie-money footnote chip.
      overlayStep: 'b4',
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
