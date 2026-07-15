# SMOKE.md — Phase 4 integration pass ("wire main.js fully")

Date: 2026-07-15. Scope: `docs/js/main.js` wiring + static checks + serve/verify
+ this report. Did not touch `research/`, `pipeline/`, or the data-tiling
build. Did not `git commit` (no repo present at the project root anyway).

## 1. What main.js now does that it didn't before

- Imports all 18 scene modules (`s01.js`…`s18.js`) and registers them in
  `SCENES` in storyboard/registry order (CONTRACT §4.2). The July-16 S12
  fold contingency has not fired as of this build (both s12.js and s13.js
  ship "stands alone" per their own header notes), so s12 is registered
  normally.
- Wires the zoom grain-plate narration (CONTRACT §4.3/§7): `zoomGrainText()`
  was defined but never called in the skeleton. It's now invoked from
  `activateBeat()` — once from the `beat.grain` branch (for beats that carry
  their own `{n}`/`{count}` template, e.g. s01) and once as a fallback for
  zoom scenes whose beats carry no `grain` field at all (s06, s07, s08, none
  of which declare one). Deliberately **not** wired at `enterScene()` time —
  that function also runs from `boot()`'s silent first paint, before the
  reader has scrolled past the title, and doing it there was tried and found
  to overwrite the title screen's population-grain figures with the S1
  zoom's tick-grain text pre-scroll (caught in the browser smoke test, see
  §3, then fixed).
- Wires `container.activate(stateKey, opts)` into every scene's `overlay()`
  call — the escape hatch s14.js's weighting toggle and s18.js's dot-lift
  both code defensively against being absent (`typeof container.activate
  === 'function'`). It tweens the *current* scene's own `layout().states`
  through the same `optsFromKind()` the beat-driven path uses.
- Made `window.__rt.activate(sceneId, beatId)` (the Gate-4 deep-link hook,
  CONTRACT §10.9) async and load-aware: previously it called `activateBeat`
  directly, which only works if the target scene's `needs` were already
  preloaded by the natural one-scene-lookahead — a raw deep-link has no
  scene k-1 to trigger that fetch. It now awaits `loadSceneNeeds()` first,
  then replays `computeActive()`'s own sequence (`activateBeat` then, for
  scrub beats, `driveScrub`) instead of just the first half of it. See §3
  for the bug this closes.

## 2. Static checks

- **Syntax** — `node --check` on a **plain** `.js` file with `import`/no
  package.json silently no-ops past real syntax errors under Node 24's
  ESM-syntax auto-detection (confirmed empirically: a deliberately broken
  file with a top-level `import` passed `node --check` cleanly). Verified
  every ES module file with `node --input-type=module --check < file`
  instead (confirmed this form *does* catch real errors first). All 20 ES
  module files (`engine.js`, `main.js`, `shared.js`, `scenes/s01–s18.js`)
  and the vendored classic-script `d3.v7.min.js` pass.
- **Token references** — every `view.css()`, `view.color()`, `view.state()`,
  `colorOf()`, `particleState()`, `durationMs()`, `tokens.dot[...]`,
  `tokens.layout[...]`, `density_tone_mapping[...]`, `typography.scale`
  lookup, and every literal `var(--x)` string across `docs/js/**/*.js`
  resolves against `design/tokens.json`/`tokens.css`. Zero misses.
- **Manifest keys** — every `data-slot="…"` path in `index.html`, every
  `flagBit()`/`enums.family/side/fate.indexOf()` string literal, every
  `scene.zoom.key` / `needs.zoom` value, and the `ZOOM_${key.toUpperCase()}`
  dynamic pattern in s18.js all resolve against the actual
  `data/manifest.json`. Zero misses. `manifest.scenes` covers every scene
  with `needs.scene: true`.
- **External references** — `grep -rE 'https?://'` across every
  `.html/.js/.css/.json` in `docs/` outside `js/vendor/` returns only the
  SVG `xmlns="http://www.w3.org/2000/svg"` namespace URI (never fetched)
  in `index.html`. The two hits inside the vendored `d3.v7.min.js` are its
  own copyright comment and D3-internal XML-namespace constants — also
  never fetched. Zero live external-origin network references.

## 3. Serve + browser verification

Served `docs/` with `python3 -m http.server`. Static + browser
(claude-in-chrome) checks:

- `/` → 200; every module the import graph reaches (`shared.js`,
  `engine.js`, all 18 scene modules) → 200; every URL named in
  `manifest.json` (both population tiles, all 4 zoom tiles, `series.bin`,
  `markets.json`, `data/replay/index.json`, all 16 `data/scenes/*.json`
  that scenes actually request) → 200.
- Real browser boot: title updates to "Regulation Time", `webgl2` context
  acquired, `engine.N === 159809 === manifest.population.desktop.dots ===
  pop tile's own header count`, `tier: "desktop"`, no `no-webgl` class.
- Real scroll (not just deep-links) drives S1's scrub track correctly:
  grain plate switches from the population figure to the interpolated
  zoom text ("1 dot = 1 trade · showing every 215th of 74,439 trades,
  France–Spain, July 14") exactly on entering the beat, chip appears and
  pulses, rail card highlights, footnote superscripts render.
- **Bug found + fixed (main.js):** the very first version of the grain-plate
  wiring (§1) set the zoom text from `enterScene()`, which also fires
  during boot's silent first paint — this overwrote the title screen's
  own population-grain caption before any scroll happened. Fixed by moving
  the auto-narrate fallback into `activateBeat()`, which only runs on a
  genuine (scroll- or deep-link-driven) beat activation. Re-verified: the
  title screen now correctly shows "1 dot = $75,000 of matched volume"
  pre-scroll.
- **Bug found + fixed (main.js):** `window.__rt.activate('s06')` rendered
  the *previous* scene's leftover visual instead of s06's own kf0. Root
  cause: `entry.sentinel.scrollIntoView()` fires a native `scroll` event
  asynchronously, which can race the deep-link's own `activateBeat()` call;
  and for scrub scenes the real visual comes from `driveScrub()`, which
  `activate()` never called. Fixed per §1. Re-verified with a genuine
  `window.scrollTo()` position at 60% through S6's scrub track (not via
  `activate()`) showing the correct tick-assembly visual, then re-verified
  `activate('s06')` itself now lands on the correct kf0 frame.
- **Bug found + fixed (js/scenes/s18.js, not main.js):** `data/replay/
  index.json` ships as `{ note, markets: [...] }`; s18.js's picker assumed
  a bare array and called `.slice()`/`.filter()` on the whole object,
  throwing `TypeError: rows.slice is not a function` on every visit to the
  coda. Fixed by normalizing at the one fetch call site (accepts either
  shape). Verified: the picker now lists 200 (of 500, bounded per
  DECISIONS #16) real market rows with no console error.
- **Bug found + fixed (js/scenes/s10.js, not main.js):** `data/scenes/
  s10.json`'s `braid` key is present but shaped
  `{segments, n_legs, mean_abs_gap_pp, n_pinnacle_terminations, sentinel,
  note}`, not the scene's proposed `{t, kalshi_pts, polymarket_pts,
  pinnacle_pts}`. `scene.braid || {...}` doesn't catch this (the object
  *is* truthy), so `toPoints()` threw `Cannot read properties of undefined
  (reading 'length')` on `braid.t.length` — an **uncaught exception thrown
  synchronously inside `scene.overlay()`**, which propagates out through
  `enterScene()`/`activateBeat()` and leaves the scene half-initialized
  (engine never tweened, overlay never mounted) for every reader who
  scrolls that far, with no recovery until the reader scrolls past into
  s11. Fixed with a defensive length guard (degrades to an empty line, same
  pattern the rest of that file already uses for its other missing
  sub-fields) rather than attempting to reconcile the schema.
- **Bug found + fixed (js/scenes/s15.js, not main.js):** same class of bug.
  `data/scenes/s15.json`'s `stages` array is present (20 rows) but is
  long-format per-(team, snapshot-date) rows
  (`stage_id/stage_label/as_of_date/team/opta_win_pct/kalshi_price/...`),
  not the scene's proposed short-format `{id, window:[start,end],
  opta_pct}` rows. `stageForBirth()` did `s.window[0]` unconditionally,
  throwing `Cannot read properties of undefined (reading '0')` on the very
  first beat. Fixed with the same defensive-filter pattern (stages missing
  a usable `window` fall back to deterministic hash bucketing, same as the
  "no stages shipped at all" path already coded). This scene's `anchors.
  strip` is reused verbatim by s16's L5 lens, so this crash would also have
  broken that recap panel.
- **Full-coverage re-test after fixes:** every one of the 42 declared beats
  across all 18 scenes (`s01/b1` … `s18/b1`) activates via
  `window.__rt.activate(sceneId, beatId)` with zero thrown exceptions.
  Remaining console output is exclusively the scenes' own **self-documented**
  `console.warn` graceful-degradation notices (see §4), never an uncaught
  exception.
- Clicked S14's "By dollars traded" toggle for real (not via JS dispatch):
  `aria-checked` flips correctly, and `container.activate()` (§1) actually
  drives `engine.tween()` — confirmed via the engine's `__debug` hooks
  (dedup correctly no-ops a second click on the already-selected option).

## 4. Known gaps — NOT fixed here, flagged for eyes

These are pre-existing gaps in other builders' deliverables (data-tiling
stage, other scene modules) or explicitly-deferred assets, not main.js
wiring problems. Left alone rather than guessed at, per "never fabricate a
number."

1. **Scene-JSON schema mismatch, systemic.** Beyond the two crashes fixed
   in §3, six more scene JSON files have a materially different shape than
   the scene module reading them expects (top-level keys present in neither
   direction, or present-but-differently-shaped): `s03.json` (no
   `day1_end`/`crossover_end`/`press_floor`; has `crossover_day`,
   `press_floor_usd`, etc.), `s04.json` (no `grid`/`in_window`/
   `kickoff_hist`/`rest_days`/`waking_band`), `s05.json` (no `total_markets`/
   `core_series`/`tail`/`lorenz_curve`), `s07.json` (`event_candidates` +
   `reaction_latency_rows`, not the proposed `event`/`pinnacle`/
   `polymarket`), `s08.json` (no `window.whistle_ts`), `s09.json`
   (`drift_summary`/`drift_series`, not `shocks`/`annotations`), `s12.json`
   and `s13.json` (byte-identical files, both shaped for neither scene —
   worth checking whether that duplication is itself a build-script bug
   in the tiling stage), `s14.json` (`buckets_by_market_count`/
   `buckets_by_dollars`, not `buckets`). None of these throw (every access
   path is `||`/`?.`/`&&`-guarded except the two fixed in §3), but the
   practical effect is that most of these scenes' data-driven annotations,
   counters, and axis callouts render **empty or with placeholder `—`
   values** rather than the storyboard's actual numbers. This is a
   data-tiling-stage ↔ scene-module reconciliation, not something to
   silently patch by guessing field mappings.
2. **S16's lens carousel is ~80% unimplemented.** CONTRACT §4.2 specs "one
   anchor grammar per lens via sibling `anchors` exports" for all 5 lenses.
   Only `s15.js` actually exports `anchors.strip` (used by L5). `s09.js`,
   `s10.js`, `s13.js`, `s14.js` export no `anchors` object at all, so L1–L4
   always hit s16.js's own documented fallback (a dim, unhighlighted
   scattered field) — confirmed via the four `[rt/s16] anchor "…"
   unavailable` warnings on every visit. s16's prose, chip, and lockup
   titles are all correct; the visual recap itself is not there yet for
   4 of 5 lenses.
3. **Design-system assets not yet dropped in:** `docs/fonts/*.woff2` (4
   files), `docs/og.png`, `docs/css/main.css` are all referenced (by
   `@font-face`, `og:image`, and CONTRACT's own file layout respectively)
   but don't exist on disk — all confirmed 404/503 in the live browser
   network log. `index.html` and `CONTRACT.md` both already mark these
   `TODO(build)`; not a wiring issue, just re-confirmed still open.
4. **`manifest.frozen_at` is `null`** (pre-G3-refresh build, per its own
   `frozen_at_note`). Every consumer already falls back to `manifest.
   generated` or prints the static "refrozen at deploy" placeholder
   correctly — verified no crash — but the methods footer's timestamp and
   S17's hero provenance line will read as placeholders until the G3
   morning-of-final re-run populates it. Expected, not a bug.
5. **Methods/footnotes section is a content stub**, not a wiring gap: the
   provenance figures it needs (`frozen_at`, `census.total_usd`,
   `census.total_trades`) are wired via the existing generic `data-slot`
   mechanism (confirmed filling correctly) and need no main.js change. The
   actual footnote *text* (`#footnotes` list, currently one placeholder
   `<li>`) has no source to pull from — the task's own inputs list
   `prose result: null`. Left as-is.
6. Async data race is inherent to the documented one-scene-lookahead
   design (CONTRACT §6.3), not something this pass changed: a reader who
   scrolls unusually fast could reach a scene before its `needs` finish
   fetching. Every scene module already codes defensively for `data.scene
   === null` / an unloaded zoom tile (empty axes, no fabricated numbers).
   Not fixed because it isn't broken — flagging only so the human pass
   knows to sanity-check on a throttled connection.

## 5. Files touched this pass

- `docs/js/main.js` — scene imports/registry, grain-plate wiring,
  `container.activate` escape hatch, async load-aware `window.__rt.activate`.
- `docs/js/scenes/s10.js` — one defensive guard in `toPoints()`.
- `docs/js/scenes/s15.js` — one defensive guard in `stageForBirth()`.
- `docs/js/scenes/s18.js` — one defensive normalization in
  `loadReplayIndex()`.
- `docs/dev/SMOKE.md` — this file.

No other files were modified. No `git commit` was made.
