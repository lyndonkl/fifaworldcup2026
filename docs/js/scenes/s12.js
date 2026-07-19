/* docs/js/scenes/s12.js — S12 · Act IV · "The market was not fooled by the
 * scoreline" (storyboard §3, R13; the anti-gotcha). Layout: `boot-ladder`.
 *
 * Contract: docs/CONTRACT.md §4 (scene module shape), §4.2 (registry row:
 * act 4, 2 steps, no zoom tile). Tokens are law (docs/design/tokens.json,
 * docs/design/tokens.css) — every color/duration/size below is a token
 * lookup via view.color()/view.state()/view.tokens, never a literal.
 *
 * FOLD TRIGGER (storyboard §3 S12, §6 ledger): July 16 morning, after
 * England-Argentina settles, this scene may fold into s13 if fewer than two
 * players with matches left remain within two goals of the outright lead.
 * That is a REGISTRY decision (main.js drops this import, s13 gains the
 * folded beats) owned by whoever assembles docs/js/main.js after the July 16
 * check — this module is built to the storyboard's "ships as specced"
 * branch and does not self-fold.
 *
 * MOBILE (storyboard S12 Mobile note): "Lanes stack; the two-step reveal is
 * preserved exactly (it is the point)." The four player lanes already stack
 * vertically on desktop (see scales()); on narrow viewports the same
 * vertical stack simply gets taller lanes and a narrower date axis — no
 * different arrangement is needed, so view.mobile only tightens spacing
 * below. The two-beat naive->resolved reveal is identical on every surface.
 *
 * DATA REQUESTS (see this scene's exit notes to the tile builder — CONTRACT
 * §5.5 defines only the generic scene-JSON shape, not per-scene fields):
 *   1. docs/data/scenes/s12.json schema proposed below, built from
 *      pipeline/data/analysis/bias-forensics/golden_boot_daily.parquet +
 *      golden_boot_snapshot.parquet (confirmed real columns: day,
 *      close_price [0..1], volume [contracts], player, ticker;
 *      goals_as_of_<date>, team_alive, cents_per_goal on the snapshot).
 *   2. Each player needs `market_indices`: population-tile `market` column
 *      row-indices (into data/markets.json) whose ticker equals this
 *      player's Golden Boot leg, so the browser never parses tickers.
 *      CONTRACT's sceneData() (main.js) does not currently expose
 *      `markets.json` to scene modules at all (§ sceneData only returns
 *      {manifest, pop, series, scene, zoom, flagBit}); baking the mapping
 *      into s12.json sidesteps that gap cleanly.
 *   3. `day_s` / `*_s` fields are integer seconds since manifest.epoch (to
 *      match the population tile's u32 birth_ts encoding directly).
 *   4. Approximate lifetime notional at the July 13 snapshot (volume x
 *      close_price, computed against golden_boot_daily.parquet during this
 *      build) puts every tracked player's leg in the low hundreds-of-
 *      thousands of dollars at most (Mbappe ~$974k, Messi ~$728k, Haaland
 *      ~$184k, Kane ~$147k) — thin against the $75k/dot population grain
 *      (roughly 2-13 dots per player). The ladder is therefore genuinely
 *      SPARSE at population grain; this layout treats the sparse real dots
 *      as the money proof and carries the legible day-by-day trajectory on
 *      a thin D3 line sourced from the same `daily` rows (a derived/quoted
 *      quantity, §0: "dots mean money and only money; derived quantities
 *      are D3 marks"). Flagging in case the tile builder would rather ship
 *      S12 at a finer bespoke grain; no zoom tile is defined for S12 in the
 *      manifest contract (§4.2 zoom column is "—"), so absent a contract
 *      amendment this module assumes population-grain dots plus a D3 path.
 */

/* global d3 */
import { registry, makeState, setColor, fmt } from '../shared.js';

/* ---------------------------------------------------------------- */
/* Local helpers (scenes may not import sibling scenes or duplicate  */
/* shared.js additions, so small utilities are kept local per file). */

function hash01(i) {
  let x = (i * 2654435761 + 0x9e3779b9) >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return (x >>> 0) / 4294967296;
}

function epochMs(manifest) {
  return new Date(manifest.epoch).getTime();
}
function secToDate(manifest, s) {
  return new Date(epochMs(manifest) + s * 1000);
}

const IDENTITY_TOKEN = {
  mbappe: 'identity-blue',
  messi: 'identity-teal',
  kane: 'identity-pink',
  haaland: 'identity-ref', // "eliminated reference" per storyboard text;
                            // identity-ref is documented for exactly this.
};

/* Deterministic scattered position for dots resting outside this scene's
 * featured subset — keeps population constancy legible (the rest of the
 * tournament's money is present, just dim) without inventing new dots. */
function fieldPosition(i, view) {
  const fx = view.region.x + hash01(i * 2 + 1) * view.region.w;
  const fy = view.region.y + hash01(i * 2 + 2) * view.region.h;
  return [fx, fy];
}

/* ---------------------------------------------------------------- */

function scales(data, view) {
  const manifest = data.manifest;
  const sceneJson = data.scene || {};
  const players = sceneJson.players || [];
  const dr = sceneJson.date_range || { start_s: 0, end_s: 86400 * 240 };

  const x = d3.scaleUtc()
    .domain([secToDate(manifest, dr.start_s), secToDate(manifest, dr.end_s)])
    .range([view.region.x + 96, view.region.x + view.region.w]);

  const lane = d3.scaleBand()
    .domain(players.map((p) => p.key))
    .range([view.region.y, view.region.y + view.region.h])
    .paddingInner(0.3)
    .paddingOuter(0.12);

  const laneY = (playerKey, priceC) => {
    const y0 = lane(playerKey);
    if (y0 === undefined) return view.region.y;
    const h = lane.bandwidth();
    const p = Math.max(0, Math.min(100, priceC));
    // Zero-baselined within the lane (§4.5): 0c sits at the lane floor.
    return y0 + h - (p / 100) * h;
  };

  registry.register('s12.x', x);
  registry.register('s12.lane', lane);
  registry.register('s12.laneY', laneY);
  return { x, lane, laneY };
}

/* ---------------------------------------------------------------- */

function layout(data, view) {
  const N = data.pop.count;
  const pop = data.pop;
  const manifest = data.manifest;
  const sceneJson = data.scene || {};
  const players = sceneJson.players || [];
  const famIdx = manifest.enums.family.indexOf('golden_boot');

  const x = registry.get('s12.x');
  const laneY = registry.get('s12.laneY');

  const naive = makeState(N);
  const resolved = makeState(N);
  const baseSize = view.tokens.dot['radius-base-px'];
  // Resting field uses the dimmed-field tint (dimmed-field-min, 0.25 alpha),
  // not the standard rest tint, so the tournament's money recedes and the
  // featured ladder reads as figure. That low alpha also lands in the
  // engine's rest-classify tier (<= dot.opacity-rest-classify-max), so the
  // shader dims its energy while boosting the full-alpha active subset
  // (research/revision/perception-brief.md §9b, §10.1).
  const restRgba = view.state('dimmed-field-min');

  // Default: every dot rests scattered and dim (population constancy: the
  // rest of the tournament's money is present, just not the story now).
  for (let i = 0; i < N; i++) {
    const [fx, fy] = fieldPosition(i, view);
    naive.x[i] = fx; naive.y[i] = fy;
    resolved.x[i] = fx; resolved.y[i] = fy;
    setColor(naive.color, i, restRgba);
    setColor(resolved.color, i, restRgba);
    naive.size[i] = baseSize;
    resolved.size[i] = baseSize;
  }

  // market row-index -> player, built once from the scene JSON's mapping.
  const marketToPlayer = new Map();
  for (const p of players) {
    for (const mi of (p.market_indices || [])) marketToPlayer.set(mi, p);
  }

  const naiveMuted = view.color('neutral-data', 0.7);

  if (marketToPlayer.size && famIdx >= 0) {
    for (let i = 0; i < N; i++) {
      if (pop.family[i] !== famIdx) continue;
      const p = marketToPlayer.get(pop.market[i]);
      if (!p) continue;
      const priceC = pop.price_band[i];
      if (priceC === 255) continue; // mixed-price bucket: stays in the dim field
      const px = x(secToDate(manifest, pop.birth_ts[i]));
      const py = laneY(p.key, priceC);
      const jitter = (hash01(i) - 0.5) * 5;

      naive.x[i] = px + jitter; naive.y[i] = py;
      resolved.x[i] = px + jitter; resolved.y[i] = py;
      setColor(naive.color, i, naiveMuted);
      setColor(resolved.color, i, view.color(IDENTITY_TOKEN[p.key] || 'identity-ref', 1.0));
      naive.size[i] = baseSize;
      resolved.size[i] = baseSize;
    }
  }

  return { states: { naive, resolved } };
}

/* ---------------------------------------------------------------- */

function overlay(container, data, view, scalesObj) {
  const sceneJson = data.scene || {};
  const players = sceneJson.players || [];
  const manifest = data.manifest;
  const x = scalesObj.x;
  const lane = scalesObj.lane;

  const g = container.svg.append('g').attr('class', 's12-overlay');

  // Lane labels + tally badges (goal counts), one per player, drawn once.
  const laneLabels = g.append('g').attr('class', 's12-lane-labels');
  players.forEach((p) => {
    const y0 = lane(p.key);
    if (y0 === undefined) return;
    const row = laneLabels.append('g')
      .attr('transform', `translate(${view.region.x}, ${y0 + lane.bandwidth() / 2})`);
    row.append('text')
      .attr('class', 's12-lane-name')
      .attr('dy', '0.35em')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-annotation-size'))
      .style('font-weight', 500)
      .style('fill', view.css('ink-mid'))
      .text(p.label + (p.reference ? ' (eliminated, reference)' : ''));
  });

  // Date axis, drawn once at the shared x range.
  const axisG = g.append('g')
    .attr('class', 's12-axis-x')
    .attr('transform', `translate(0, ${view.region.y + view.region.h + 8})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.utcFormat('%b %d')))
    .call((sel) => sel.selectAll('text')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-micro-size'))
      .style('fill', view.css('ink-low')))
    .call((sel) => sel.selectAll('line, path').style('stroke', view.css('ink-low')));

  // Axis titles (design-revision-spec G3/G4: every D3 axis names what it
  // measures and its unit; s12 previously shipped with no titled axis at
  // all). X title sits centered below the tick labels, the standard slot.
  g.append('text')
    .attr('class', 's12-axis-x-title')
    .attr('x', view.region.x + view.region.w / 2)
    .attr('y', view.region.y + view.region.h + 30)
    .attr('text-anchor', 'middle')
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-caption-size'))
    .style('font-weight', 500)
    .style('fill', view.css('ink-mid'))
    .text('date (July 2026)');

  // Per-lane price axis (G3: "s12 has no y-axis" was the named gap). Each
  // player's row is its own 0-100c scale within its band, so the axis is
  // drawn once per lane at the chart's own left edge rather than as one
  // shared vertical scale; a single shared title names the unit for all of
  // them at once, placed in the footer row so it never contests the
  // rewrite-on-screen caption block pinned above the stage.
  const yAxisG = g.append('g').attr('class', 's12-axis-y');
  players.forEach((p) => {
    const y0 = lane(p.key);
    if (y0 === undefined) return;
    const h = lane.bandwidth();
    const laneScale = d3.scaleLinear().domain([0, 100]).range([y0 + h, y0]);
    yAxisG.append('g')
      .attr('transform', `translate(${view.region.x + 96}, 0)`)
      .call(d3.axisLeft(laneScale).tickValues([0, 50, 100]).tickFormat((d) => `${d}c`))
      .call((sel) => sel.selectAll('text')
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-micro-size'))
        .style('fill', view.css('ink-low')))
      .call((sel) => sel.selectAll('line, path').style('stroke', view.css('ink-low')));
  });
  g.append('text')
    .attr('class', 's12-axis-y-title')
    .attr('x', view.region.x)
    .attr('y', view.region.y + view.region.h + 44)
    .style('font-family', view.css('font-apparatus'))
    .style('font-size', view.css('type-caption-size'))
    .style('font-weight', 500)
    .style('fill', view.css('ink-mid'))
    .text('price of winning the Golden Boot (cents)');

  // The pinned caption whose text rewrites itself between steps — this is
  // the scene's signature (storyboard: "the rewrite-on-screen").
  const captionG = g.append('g').attr('class', 's12-caption')
    .attr('transform', `translate(${view.region.x}, ${view.region.y - 28})`);
  const captionLabel = captionG.append('text')
    .attr('class', 's12-caption-label')
    .style('font-family', view.css('font-tape'))
    .style('font-size', view.css('type-tape-size'))
    .style('letter-spacing', view.css('type-tape-tracking'))
    // Naive-frame label starts ink-low, not amber (design-revision-spec
    // CR-11): amber on a debunked claim is an anchoring bug, not emphasis.
    .style('fill', view.css('ink-low'));
  const captionQuestion = captionG.append('text')
    .attr('class', 's12-caption-question')
    .attr('dy', '1.6em')
    .style('font-family', view.css('font-prose'))
    .style('font-size', view.css('type-lede-size'))
    .style('fill', view.css('ink-hi'));

  // Annotation group for the resolved step (July 7-8 level, Kane halving,
  // assist tiebreak footnote). Built lazily on b2 so it never shows early.
  const annoG = g.append('g').attr('class', 's12-annotations').style('opacity', 0);

  function findPlayer(key) { return players.find((p) => p.key === key); }

  function drawAnnotations() {
    annoG.selectAll('*').remove();
    const anno = sceneJson.annotations || {};
    const mbappe = findPlayer('mbappe');
    const messi = findPlayer('messi');
    const kane = findPlayer('kane');

    if (anno.july7_8_level && mbappe && messi) {
      const y0 = lane('mbappe');
      if (y0 !== undefined) {
        const px = x(secToDate(manifest, anno.july7_8_level.day_s_start));
        annoG.append('circle')
          .attr('cx', px).attr('cy', y0 + lane.bandwidth() / 2)
          .attr('r', view.tokens.dot['radius-annotated-core-px'])
          .style('fill', 'none')
          .style('stroke', view.css('accent-annotation'))
          .style('stroke-width', view.css('dot-halo-stroke-px'));
        annoG.append('text')
          .attr('x', px + 12).attr('y', y0 + lane.bandwidth() / 2)
          .attr('dy', '0.35em')
          .style('font-family', view.css('font-apparatus'))
          .style('font-size', view.css('type-annotation-size'))
          .style('fill', view.css('accent-annotation'))
          .text('July 7–8: traded level, Mbappe one goal behind');
      }
    }

    // Kane's callout loses its amber halo (design-revision-spec CR-11,
    // deletion checklist): only the July 7-8 mark keeps amber in this
    // beat, so Kane's annotation demotes to a plain ink-mid at-mark label.
    if (anno.kane_halving && kane) {
      const y0 = lane('kane');
      if (y0 !== undefined) {
        const px = x(secToDate(manifest, anno.kane_halving.after_day_s));
        annoG.append('text')
          .attr('x', px + 12).attr('y', y0 + lane.bandwidth() / 2)
          .attr('dy', '0.35em')
          .style('font-family', view.css('font-apparatus'))
          .style('font-size', view.css('type-annotation-size'))
          .style('fill', view.css('ink-mid'))
          .text('Kane: 120 scoreless minutes, price halved');
      }
    }

    if (anno.assist_tiebreak && anno.assist_tiebreak.text) {
      annoG.append('text')
        .attr('class', 's12-footnote-chip')
        .attr('x', view.region.x)
        .attr('y', view.region.y + view.region.h + 32)
        .style('font-family', view.css('font-tape'))
        .style('font-size', view.css('type-tape-size'))
        .style('fill', view.css('ink-low'))
        .text(anno.assist_tiebreak.text);
    }

    annoG.transition().duration(view.tokens.motion.durations_ms['overlay-draw-in'])
      .style('opacity', 1);
  }

  // Holds the pending b2 caption-swap so rapid back-and-forth scrolling
  // never stacks two swaps on top of each other.
  let captionSwapTimer = null;

  function step(beatId) {
    if (captionSwapTimer) { window.clearTimeout(captionSwapTimer); captionSwapTimer = null; }
    if (beatId === 'b1') {
      captionLabel.style('fill', view.css('ink-low')).text('the naive read');
      captionQuestion.style('fill', view.css('ink-hi')).text('Same goals, double the price?');
      annoG.style('opacity', 0);
    } else if (beatId === 'b2') {
      // The dot recolor (naive -> resolved) is this beat's one motion
      // event; the caption text trails it as a short crossfade so color
      // and words never change in the same instant (CR-11). Positions are
      // frozen throughout -- only color, then text.
      captionLabel.style('fill', view.css('ink-mid'));
      captionQuestion.style('fill', view.css('ink-hi'));
      const recolorMs = view.reducedMotion
        ? 0
        : (view.tokens.motion.durations_ms['recolor-min'] + view.tokens.motion.durations_ms['recolor-max']) / 2;
      captionSwapTimer = window.setTimeout(() => {
        captionLabel.text('the resolved read');
        captionQuestion.text('Different futures, different price.');
      }, recolorMs);
      drawAnnotations();
    }
  }

  function exit() {
    g.selectAll('*').interrupt();
    g.remove();
  }

  return { step, scrub: undefined, exit };
}

/* ---------------------------------------------------------------- */

const s12 = {
  id: 's12',
  act: 4,
  title: 'The false alarm',
  // Gate-4 round 2 (structure-spec §3): S12 opens Skill 5, the course's
  // last lesson -- most "the market is wrong" alarms are false alarms.
  kicker: 'Skill 5 of 5 — its fake flaws, and its real ones',
  layoutName: 'boot-ladder',

  needs: { scene: true, series: [], zoom: null },

  scales,
  layout,
  overlay,

  beats: [
    {
      id: 'b1',
      html: `<p>Here is a trap you can dodge. In the Golden Boot market,
        the book on who finishes as the tournament's top scorer, Mbappe's
        ticket cost 61 cents. Messi's ticket cost 31 to 32 cents. Both men
        had scored eight goals. Same goals, double the price. It looks
        broken.<sup><a href="#fn-19">19</a></sup> The full-color answer is
        next.</p>`,
      trigger: 'step',
      state: 'naive',
      kind: 'resort',
      chip: [
        { token: 'identity-blue', glyph: 'dot', label: "blue = Mbappe's Golden Boot money" },
        { token: 'identity-teal', glyph: 'dot', label: "teal = Messi's Golden Boot money" },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      grain: { text: '1 dot = $75,000 of real money traded', variant: 'return' },
      overlayStep: 'b1',
    },
    {
      id: 'b2',
      html: `<p>It wasn't broken. The market was pricing goals still to
        come, not goals already scored. On July 7 and 8 the two tickets had
        traded at the same price, back when Mbappe was still a goal behind;
        he simply kept scoring faster after that. The contract's own
        tiebreak rule, based on assists, decided the
        rest.<sup><a href="#fn-19">19</a></sup></p>
        <p>Goals tend to arrive at a fairly steady rate. So the more
        minutes a player has left to play, the more chances he has left to
        score. That is why Harry Kane, England's striker, was fairly priced
        at four cents on six goals. It is also why his ticket halved on the
        very day England won the match: he had just played 120 scoreless
        minutes, so his remaining chances
        shrank.<sup><a href="#fn-19">19</a></sup> This top-scorer market is
        a ladder, one rung of tickets for each contender, and it climbs on
        goals still to come, not goals already banked.</p>
        <p>Before you call any price crazy tonight, ask two questions: what
        do the rules actually pay for, and what does the road ahead look
        like?</p>`,
      trigger: 'step',
      state: 'resolved',
      kind: 'recolor',
      chip: [
        { token: 'identity-blue', glyph: 'dot', label: "blue = Mbappe's Golden Boot money" },
        { token: 'identity-teal', glyph: 'dot', label: "teal = Messi's Golden Boot money" },
        { token: 'identity-pink', glyph: 'dot', label: "pink = Kane's Golden Boot money" },
        { token: 'field-rest', glyph: 'dim', label: 'grey = money at rest, the whole tournament' },
      ],
      overlayStep: 'b2',
    },
  ],

  /* Reduced motion (CONTRACT §9): both beats already land on a fully
   * static-readable end state (naive desaturated ladder, then the same
   * geometry recolored). The engine's reduced-motion mode already turns
   * both the resort and the recolor into instant-set + 400ms crossfade
   * (§3.5) with no scene-level substitution required; kept explicit here
   * for auditability rather than a silent default. */
  reducedMotion: { states: {} },
};

export default s12;
