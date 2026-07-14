# DECISIONS.md — Grilling session log, 2026-07-13

Every load-bearing decision from the requirements interview, with rationale.
Facts referenced here are grounded in `research/fact-base.json` (Kalshi catalog
and API mechanics, benchmark source access, tournament state as of 2026-07-13).

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Audience & venue | **Public portfolio piece** on GitHub Pages | Pudding-grade standalone scrolly with the author's byline; justifies the WebGL + object-constancy investment. |
| 2 | Narrative spine | **Market as protagonist** | The only frame that absorbs all themes (accuracy, volume, volatility) as one story; natively suited to unit viz — units persist first scene to last. |
| 3 | Publish timing | **Before the July 19 final**, ending as analysis | Original cliffhanger idea upgraded by the author: the ending *reinterprets* the market's live final odds through its learned tournament habits, so v1 is complete on day one. v2 epilogue after settlement judges the reinterpretation. |
| 4 | Data scope | **Everything, tick-level** | Big-data analysis is a co-equal project goal, not plumbing. Full trade tape + 1-min candles for all ~80 KXWC* series. Confirmed feasible: public API, no auth, settled markets retrievable. |
| 5 | The unit | **One trade = one particle** | Every dot is a real transaction — honest, scales to WebGL, volume/volatility scenes fall out for free. |
| 6 | Population grain | **One persistent population (~100–200k, fixed volume grain) + 1:1 tick-level zoom scenes** | Strict object constancy for the protagonist-population; explicit narrated zooms give in-game scenes full tick texture; mobile stays viable; payload ~20–40MB. |
| 7 | Renderer | **Raw WebGL, evolving understandingsoccer's engine.js** | Verified: the prior piece's "insanely smooth" animation is a hand-rolled fixed-population point-sprite engine with GPU A→B attribute-buffer tweens. Supersedes the earlier regl recommendation. D3 for overlays; vanilla JS; zero-build. |
| 8 | Design authority | **cognitive-design-architect agent owns the design system** | Author's explicit requirement: palette, spacing, type, hierarchy, cognitive-load and fallacy audits, as a gated phase. |
| 9 | Benchmarks | **All four: Polymarket, Pinnacle/bookmakers, polls + Google Trends, Opta/Elo model** | Full supporting cast: the offshore crowd, the professionals, the fans, the model — each with a distinct data personality. Model kept as a light overlay. |
| 10 | Analytical angles | **All four graduate to scenes: calibration, in-game microstructure, volume anatomy, bias forensics** | Event moments (Germany out on pens, Norway over Brazil, hosts' 24 hours) are vehicles; angles are what the reader learns through them; all feed the ending. |
| 11 | Collaboration model | **Gate every workflow launch + four artifact gates** | Author wants full control and visibility into the orchestration craft. Plans kept to one screen for speed. |
| 12 | Identity | **Standalone, fresh visual identity** | No sequel framing to "The Two Meanings of 26¢"; design system built from scratch for this material. |
| 13 | Model assignment | **Tiered by task** | Haiku-class mechanical, Sonnet-class analysis, strongest tier for narrative/design/verification/reinterpretation. Declared per workflow plan. |
| 14 | Prose | **Claude drafts, author edits at gates; strategist-voice register** | Author's explicit skill picks: strategist-voice (primary), slop-detector on every draft, communication-storytelling for beat shaping. |
| 15 | Ending's live number | **Freeze + timestamp; manual morning-of-final refresh** | Honest, robust, zero infrastructure; the reinterpretation argues how to read the number, so it survives drift. |
| 16 | Reader agency | **Explorable coda** | After the ending the rail releases: replay any market, scrub zoom matches tick by tick. Rewards the full tick pull; bounded scope. |
| 17 | Mobile & a11y | **Full mobile parity + reduced-motion** | Capability-scaled population, portrait reflow, native scroll, crossfades under prefers-reduced-motion, static-readable end states. Most first impressions arrive on phones. |
| 18 | Data budget | **Hard $0** | Free sources only (Kalshi public API, Polymarket, OddsPapi free tier, poll toplines, Trends CSV, Opta articles, Elo). Gaps become methods-note lines. |
| 19 | Success criterion | **The story first** | Tiebreaker for all tradeoffs: narrative clarity and reader impact beat technical ambition and analytical completeness. |
| 20 | Repo hygiene | **Public repo `lyndonkl/fifaworldcup2026`; raw data gitignored; title decided at storyboard gate** | Working defaults confirmed by the author. |

## Key grounded facts the decisions rest on (2026-07-13)

- Tournament state: quarterfinals done; semifinals France–Spain (Jul 14, Dallas)
  and England–Argentina (Jul 15, Atlanta); final Jul 19, MetLife. All four
  semifinalists were pre-tournament favorites ("chalk at the top, chaos
  underneath").
- Kalshi: ~80 `KXWC*` series; winner event ~1.17B contracts traded; >$7.4B
  across all WC markets by Jul 8; public market data needs **no API key**;
  trades via `GetTrades` (max 1000/page, cursor); candles 1/60/1440-min (max
  5000/request); settled markets remain fully queryable; pre-2026-05-14
  settlements served from `/historical/*`.
- Polymarket: free CLOB `prices-history` (1-min fidelity, chunked windows);
  ~203 WC26 markets; ~$4.1B winner-market lifetime volume.
- Pinnacle history: OddsPapi free tier (full price history since Jan 2026,
  1 req/5s, 3 books/request). The Odds API exists as a paid alternative —
  ruled out by decision #18.
- Public opinion: Pew (Jun 2 "who will win"), YouGov waves, Ipsos 30-country
  (87% of Argentinians picked Argentina); Google Trends CSV export is the only
  continuous public-attention series.
- Model: Opta supercomputer stage-by-stage articles (Spain 16.1% pre → France
  27.3% pre-QF); eloratings.net histories scrapeable for DIY probabilities.
