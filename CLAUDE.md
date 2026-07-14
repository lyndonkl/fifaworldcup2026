# CLAUDE.md — The Market Watched the World Cup (working title)

Standing context for this project. These rules hold across every turn and every
workflow. Decisions behind them are logged with rationale in `DECISIONS.md`;
grounded facts (Kalshi catalog, API mechanics, benchmark sources, tournament
state) live in `research/fact-base.json`.

## What this project is

A standalone, portfolio-grade **scrollytelling web piece** that retells the 2026
FIFA World Cup through the eyes of Kalshi's prediction markets, using **unit
visualization with object constancy** over the full tick-level trade tape.

- **Protagonist:** the market itself. Every contract is a living belief — born at
  listing (May 2025), twitching through the group stage, convulsing in-game,
  dying at settlement.
- **Dramatic question:** what did the market believe, moment by moment — and was
  it right?
- **The ending:** not a cliffhanger. The final act *reinterprets* the market's
  live odds for the July 19 final through everything the reader has learned
  about this market's habits (calibration record, reaction speed, overreactions,
  biases). v1 is complete on day one. A **v2 epilogue** after settlement judges
  the reinterpretation itself.
- **Success criterion (tiebreaker for every tradeoff): the story lands.**
  Narrative clarity and reader impact beat technical ambition, analytical
  completeness, and scope. Cut anything that does not serve the reader.

## Hard constraints

- **v1 publishes before the July 19, 2026 final** (target July 17–18).
- **Hard $0 data budget.** Free sources only. Coverage gaps become honest
  methods-note lines, never purchases.
- **GitHub Pages, fully static, zero-build.** Served from `docs/`. No bundler
  output that can't be committed. No server. No client-side calls to external
  APIs (the piece must still work in five years).
- The ending's "current odds" number is **frozen + timestamped** at deploy; one
  manual pipeline re-run + redeploy on the morning of the final refreshes it.

## Data (a co-equal craft goal: this is a big-data exercise)

- **Everything, tick-level.** Full trade-by-trade history and 1-minute
  candlesticks for *every* WC-related Kalshi market (~80 `KXWC*` series; winner
  futures, per-match 3-ways, spreads/totals/scores, groups, stage-of-elimination,
  Golden Boot, host and novelty props). Public API, no auth. Details and
  verified endpoints in `research/fact-base.json`.
- **Benchmarks (the supporting cast):** Polymarket (free CLOB minute-history) =
  the offshore crowd; Pinnacle via OddsPapi free tier = the professionals;
  Pew/YouGov/Ipsos poll waves + Google Trends = the fans; Opta supercomputer
  snapshots / Elo-derived probabilities = the model.
- **Pipeline discipline:** `pipeline/` holds Python that does the pulling and
  processing — reproducible scripts, not ad-hoc agent HTTP. Partitioned
  **Parquet** store, DuckDB for analytics, resumable/incremental so the v2
  epilogue is one incremental pull. Raw data stays **out of git** (only derived
  LOD tiles, aggregates, and small reference files are committed).
- Browser payload: packed-binary LOD tiles, ~20–40MB total budget.

## Visualization conventions

- **The unit: one trade = one particle.** Every dot is money that actually moved.
- **One population, zoom scenes:** a persistent tournament-scale population
  (~100–200k particles, 1 dot = a fixed grain of traded volume) lives through
  the piece under strict object constancy. In-game set pieces explicitly zoom
  into a single match rendered **1:1 at tick level**. Grain changes are always
  narrated, never silent.
- **Renderer: raw WebGL**, evolving the `engine.js` pattern from the
  understandingsoccer repo (`/Users/kushaldsouza/Documents/Thinking/understandingsoccer/docs/js/engine.js`):
  fixed population of point sprites; every visual change is a GPU-interpolated
  tween between per-identity A→B attribute buffers; interrupts retarget from
  current interpolated values; **never cut and redraw**. WebGL2/instancing only
  if the population demands it. D3 for scales, axes, and annotation overlays;
  scroll-driven scenes; vanilla JS; no framework.
- **Design authority: the cognitive-design-architect agent** owns the design
  system — palette, typography, spacing, visual hierarchy, cognitive-load and
  fallacy audits. **Fresh identity** (no branding ties to prior pieces).
- **Full mobile parity + reduced-motion:** capability-scaled population (~40–60k
  on mobile GPUs), portrait reflow, native scroll behavior,
  `prefers-reduced-motion` gets crossfades, every scene has a static-readable
  end state.
- **Explorable coda:** after the ending the rail releases — readers can replay
  any market's price life and scrub the zoom matches tick by tick. Bounded
  final scene, not a second app.

## Analytical acts (all four graduate to scenes)

1. **Calibration verdict** — Brier scores, calibration curves, Kalshi vs
   bookies/Polymarket/fans/model; who won each argument.
2. **In-game microstructure** — goal→price reaction latency, Kalshi–Polymarket
   lead/lag, overreaction-and-fade, shootout tick panic. Event vehicles:
   Germany–Paraguay pens, Norway–Brazil, all three hosts dead in 24 hours,
   Argentina's extra-time escapes.
3. **Volume anatomy** — where $7.4B went: arrival timeline, US-retail-hours
   pulse, contract-family breakdown, volume-vs-attention (Trends).
4. **Bias forensics** — favorite-longshot bias, US-home-team pricing on a US
   exchange, fan-country bias vs polls, post-upset recency. Feeds the ending's
   reinterpretation directly.

## Prose

- Claude drafts, the author edits at gates. Nothing publishes unread.
- Register: the **strategist-voice** skill (analyst voice — third person,
  sparing first person, numbered footnotes, topic-forward paragraphs, no em
  dashes, no negation cascades). Every draft passes the **slop-detector**
  skill; narrative beats shaped with **communication-storytelling**.
- The title is decided at the storyboard gate as an editorial artifact.

## Process

- Hierarchical multi-workflow build. **Every workflow plan is approved by the
  author before launch** — agents, stages, model mix, outputs, one screen.
- Four artifact gates: (1) data-audit report; (2) findings dossier +
  scene-by-scene storyboard; (3) design-system spec; (4) staging build.
- **Models tiered by task:** Haiku-class for mechanical pulls/conversions,
  Sonnet-class for standard analysis, strongest tier for narrative, design,
  adversarial verification, and the reinterpretation.
- Findings that make it into scenes are **adversarially verified** first.
- Commit in logical increments, never one giant commit. Push to
  `lyndonkl/fifaworldcup2026` (public).

## Phases

- **Phase 0** — repo bootstrap (this commit).
- **Phase 1** — ingestion fleet: Kalshi catalog discovery → tick/candle pull →
  benchmark pulls → **Gate 1: data audit**.
- **Phase 2** — analysis sweeps (4 angles + event studies, verified) →
  **Gate 2: findings dossier + storyboard**.
- **Phase 3** — design system via cognitive-design-architect → **Gate 3**.
- **Phase 4** — build: engine, LOD tiles, scenes, prose.
- **Phase 5** — review: code review, fallacy/fact-check audits → **Gate 4:
  staging** → publish v1 before July 19.
- **Phase 6** — post-final: incremental pull, epilogue, v2.
