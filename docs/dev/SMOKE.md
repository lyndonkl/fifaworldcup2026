# SMOKE.md — Re-verification after data reconciliation + scene-code completion

Date: 2026-07-15. Scope: independent re-verification of the CONTRACT §10
acceptance checklist plus the eight checks specified for this pass (syntax,
scene-JSON field coverage, s12/s13 distinctness, S16 anchor resolution,
tokens + data budget, external-reference hygiene, serve/curl the full
import+data graph, footnotes). Did not touch `research/`, `pipeline/`, or
any file under `docs/` — this is a read-only verification pass. Did not
`git commit` (no repo present at the project root anyway).

**Methodology note:** every check below was re-derived from the files on
disk, not taken on trust from any upstream job's self-report. Two upstream
job summaries were supplied ahead of this pass; one of them (data
reconciliation) carried an internal placeholder marker
(`"notes":"PAUSE_PLACEHOLDER_DO_NOT_USE"`, `"remaining_mismatches":
["BUILD_IN_PROGRESS_NOT_FINAL"]`) that contradicted the "finished build"
framing around it. Rather than trust either the placeholder or the framing,
every check re-ran against the actual files under `docs/`. The filesystem
shows real, extensive work (every scene-JSON file, every scene module, and
`manifest.json` all carry a July 15 mtime and materially different content
from the prior SMOKE pass), so the reconciliation did happen — but it is
not 100% complete (see Check 2).

## Results

| # | Check | Result |
|---|---|---|
| 1 | Syntax (`node --input-type=module --check`, all `docs/js/**/*.js`) | **PASS** |
| 2 | Scene-JSON field coverage (zero missing) | **FAIL** (1 scene, 2 fields, non-crashing) |
| 3 | `s12.json` != `s13.json`, each matches its scene's reads | **PASS** |
| 4 | S16 anchors resolve without hitting the dim-field fallback | **PASS** |
| 5 | Tokens resolve; `docs/data` <= 40MB | **PASS** |
| 6 | No external-origin refs outside vendored files | **PASS** |
| 7 | Serve + curl the full import/data graph, all 200 | **PASS** (known TODO assets excepted) |
| 8 | Footnotes: defined set == referenced set | **PASS** |

**7 of 8 pass. Check 2 fails narrowly** — see detail below; it is a
non-crashing, fallback-guarded gap in one scene, not a regression from the
prior pass (which had 8 scenes with *systemic*, in several cases
crash-causing, schema mismatches; those are now reconciled).

---

### 1. Syntax — PASS

`node --input-type=module --check < file` on all 21 ES module files
(`engine.js`, `main.js`, `shared.js`, `scenes/s01.js`…`s18.js`): all pass.
Vendored classic-script `js/vendor/d3.v7.min.js` passes plain `node
--check`.

Methodology sanity check (per this pass's own instructions, since plain
`node --check` silently no-ops past real syntax errors on a bare `.js` file
with `import`/no `package.json` under Node 24's ESM auto-detection):
confirmed empirically again this pass — a deliberately broken file
(`function broken( { return 1; }` after a top-level `import`) exits 0 under
plain `node --check` and correctly throws `SyntaxError: Unexpected number`
under `node --input-type=module --check < file`. Every file in this build
was checked with the correct (stdin, `--input-type=module`) form.

### 2. Scene-JSON field coverage — FAIL (narrow)

Parsed every scene module's `needs.scene` declaration and its top-level
`data.scene`/`sj.`/`sceneJson.` field accesses; checked each against the
actual top-level keys of `docs/data/scenes/sNN.json`, then spot-verified
nested shapes (bucket rows, stage rows, pinnacle/polymarket sub-objects,
annotation sub-objects, host-peer rows) by hand for every scene that reads
one. Also checked `manifest.scenes` coverage, `data-slot="…"` paths,
`flagBit()` literals, `enums.family/side/fate.indexOf()` literals, and
`needs.zoom`/`scene.zoom.key` literals against `data/manifest.json` —
**zero misses** on all of those.

**The gap:** `docs/js/scenes/s11.js` reads `scene.n_legs` and
`scene.effective_n` (both with a `??` fallback: `scene.n_legs ?? 84`,
`scene.effective_n ?? 28`, matching the dossier-verified "84 coupled legs,
effective n of 28" language its own header comment documents as the
expected shape). `docs/data/scenes/s11.json` does not carry either key —
its actual top-level shape is `{_provenance, scores, three_traps_receipt}`.
Because the reads are `??`-guarded, this **does not crash** and the
fallback numbers **are** the dossier-correct ones, so the on-screen copy is
right either way — but per this check's literal bar ("assert each field
exists... ZERO missing"), it is a miss. Two fields also named in the same
header comment block (`blowout_share_pct`, `blowout_matches_n`) are never
actually read anywhere in the file (comment-only), so they don't count
against this check.

Every other scene that declares `needs.scene: true` (`s03, s04, s05, s06,
s07, s08, s09, s10, s12, s13, s14, s15`) now has **zero** field-coverage
misses, including the eight scenes the prior SMOKE pass flagged with
systemic mismatches (`s03, s04, s05, s07, s08, s09, s12, s13, s14`) — all
reconciled with the real field names (verified by direct inspection, not
just absence of a crash):

- `s03.json`: `day1_end` / `crossover_end` / `press_floor` — matches `s03.js`'s `sj.day1_end` / `sj.crossover_end` / `sj.press_floor`.
- `s04.json`: `grid` / `in_window` / `kickoff_hist.hours` / `rest_days` / `waking_band` — matches `s04.js` exactly.
- `s05.json`: `novelty_market.{n_markets,contracts}` — matches `s05.js` (de-politicize swap: the former `trump_market` singleton is replaced by the sub-grain KXWCADS ad family, annotated on the below-threshold band rather than lit as a dot).
- `s07.json`: `event.{goal_ts,label}`, `pinnacle.{quotes,suspend_start_s,suspend_end_s}`, `polymarket.blocks`, `friction_band_c` — matches `s07.js` exactly.
- `s08.json`: `window.whistle_ts` — matches `s08.js`.
- `s09.json`: `shocks[].{team,shock_ts,pop_multiple}`, `annotations[].{team,t_hours,label}` — matches `s09.js`.
- `s12.json`: `date_range`, `players[].{key,label,reference,market_indices}`, `annotations.{july7_8_level,kane_halving,assist_tiebreak}` — matches `s12.js`.
- `s13.json`: `pairs[].{key,team,poll_source,poll_pct,kalshi_price_pct}`, `host_peers.teams[]`, `zombie_money.{n_trades,total_usd,max_price_c}` — matches `s13.js`.
- `s14.json`: `buckets[].{label,lo_c,hi_c,n_markets,mean_price_c,win_rate_pct,vol_weighted_price_c,vol_weighted_win_rate_pct}`, `tick_floor`, `worst_bucket_label`, `ladder_attribution` — matches `s14.js`.
- `s10.json`'s `braid` is now the scene's proposed `{t, kalshi_pts, polymarket_pts, pinnacle_pts}` shape exactly (previously long-format `{segments, n_legs, ...}` that crashed `toPoints()`; that shape is gone).
- `s15.json`'s `stages` still ship long-format rows without a usable `window` on most rows (same as the prior pass), but `s15.js`'s defensive hash-bucketing fallback (added last pass) still covers it — not a new issue, not re-flagged as a field miss since `stages` itself is present and the code path that reads it is guarded by design.

`s12.json` and `s13.json` are no longer byte-identical placeholders (see
Check 3) — this is the single largest resolved item from the prior pass.

**Recommendation:** either add `n_legs`/`effective_n` to `s11.json`'s
export (cheap: both are already-known constants used nowhere else
differently) or explicitly accept the coded fallback as final and note it
in `s11.json`'s own `_provenance` block so a future re-verification doesn't
re-flag it. Author call, not a blocker for publish given the numbers are
already correct on screen.

### 3. `s12.json` != `s13.json` — PASS

Byte-distinct: `s12.json` 815 bytes (md5 `8fbfd3e0...`), `s13.json` 1205
bytes (md5 `b16b5438...`). `s12.json` is the Golden Boot ladder
(`date_range`, `players` = Mbappé/Messi/Kane, `annotations`); `s13.json` is
the flag-pairs scene (`pairs` = Argentina/USA poll-vs-price rows,
`host_peers`, `zombie_money`). Each matches its own scene's reads exactly
(see Check 2 detail). This is the exact bug the prior SMOKE pass flagged
("byte-identical files, both shaped for neither scene") — resolved.

### 4. S16 anchors — PASS

`s16.js` imports `s09, s10, s13, s14, s15` and calls
`callAnchor(s10,'braid',...)`, `callAnchor(s14,'curve',...)`,
`callAnchor(s09,'mirror',...)`, `callAnchor(s13,'pair',...)`,
`callAnchor(s15,'strip',...)` inside `layout()`. Confirmed by name-exact
grep that each sibling module exports precisely that method name inside
its `anchors: {}` object (`s10.braid`, `s14.curve`, `s09.mirror`,
`s13.pair`, `s15.strip` — all present, all functions).

Verified functionally two independent ways, using a synthetic ~2,000-dot
population built from the **real** `manifest.json` teams/enums (not a
hand-rolled short list):

1. **Isolated per-anchor calls**, each returning `{state, drawAxes}` with
   `state.x`/`.y`/`.size` as `Float32Array(N)` and `.color` as
   `Float32Array(4N)`, zero `NaN`, `drawAxes` callable without throwing.
2. **Drove `s16.layout(data, view)` directly** — the actual runtime call
   path (`main.js` calls `layout()` on scene activation) — with
   `console.warn` instrumented to catch the `[rt/s16] anchor "…"
   unavailable — fallback rendered` message `callAnchor()` emits on any
   failure. **Zero fallback warnings fired** across all 5 lenses; all 5
   `lensN` states came back correctly shaped with zero NaN.

Both runs used the **real vendored `docs/js/vendor/d3.v7.min.js`**, loaded
into Node via `vm.runInThisContext` exactly as `index.html`'s classic
`<script>` tag loads it (not a hand-rolled scale stub). This matters: an
earlier pass of this same test using a hand-rolled `d3.scalePoint` stub
(the same stub shape used in the prior job's own
`scratchpad/anchor_test.mjs` harness) produced 89 false `NaN` positions in
the `s15.strip` lens, traced to that stub's `.padding()` getter always
returning the scale function itself instead of the stored padding number
(`x.step() * x.padding()` → `number * function` → `NaN`). Re-running
against the real d3 library eliminated all NaN — confirming it was a
**test-harness artifact**, not a production bug, and that the prior job's
harness happened not to trigger it only because its tiny (N=60) synthetic
population had too few FRA/ESP dots to exercise that code path. Flagging
so a future re-verification prefers the real vendored library over a
hand-rolled stub.

**Separate real finding (does not fail this check — no crash, no
fallback, so it's a silent feature gap, not a correctness bug):**
`manifest.hero` currently ships a 3-leg provisional threeway
(`ESP`/`ENG`/`ARG`, 3-letter codes) rather than CONTRACT §5.1's documented
2-leg `{label:"Spain"}` / `{label:"OPPONENT"}` shape (expected, since
`manifest.hero.provenance` self-labels this a "PROVISIONAL pre-G3-refresh
snapshot"). `s16.js`'s `opponentCode()` does
`label.includes('ENGLAND')`/`label.includes('ARGENTINA')` substring
matching against `manifest.hero.legs[1].label`, which never matches the
actual 3-letter codes shipped today. Net effect: `opponentCode()` always
returns `null` against the current manifest, so `tintOpponent()` and the
L4/L5 opponent-highlight silently never light up the actual opponent leg
(the FRA/ESP spotlighting in the same lenses is unaffected and works).
Flagged for eyes — see the residual list; needs either the G3 refresh
script to emit full country-name labels, or a small patch to
`opponentCode()` to match 3-letter codes directly.

### 5. Tokens + data budget — PASS

`python3 docs/design/validate_tokens.py` → `ALL CHECKS PASSED` (27 contrast
pairs + 1 documented sub-floor exception, 25 tokens cross-checked
css↔json, 25 rgba round-trips).

Additionally, independently re-scanned (this pass, not reused from the
validator): every `var(--x)` literal across `docs/js/**/*.js` and
`index.html` against `tokens.css`'s 129 declared custom properties — zero
misses. Every `tokens.*`/`view.tokens.*` JS-side property-chain literal
(including `typography.scale.find(s => s.name === '…')` lookups) against
`tokens.json`'s structure — zero misses (a few regex false-positives on
`"...tokens.json"` fetch-URL strings and `.find(` array-method calls were
manually confirmed as non-issues, not counted). Every `view.color('…')` /
`view.state('…')` string literal against `tokens.json`'s `colors` (25
entries) and `particle_states` (6 entries) — zero misses.

Data budget: `docs/data` total = **16.02 MB** (budget ≤ 40MB). Every
per-tile cap in CONTRACT §5 individually satisfied: `pop-75k.bin` 2.44MB
(cap 4), `pop-250k.bin` 0.73MB (cap 1.5), `zoom/fraesp.bin` 1.14MB (cap 6),
`zoom/mexeng.bin` 7.63MB (cap 10), `zoom/gerpar.bin` 2.39MB (cap 3),
`zoom/norbra.bin` 0.50MB (cap 3), `series.bin` 0.18MB (cap 4),
`manifest.json`+`markets.json` combined 0.59MB (cap 1.5),
`data/scenes/*.json` combined 0.38MB (cap 2), `data/replay/*` 0.06MB (cap
6, lazy). `docs/js` code = 0.66MB, well under the 1.5MB code+fonts+CSS
budget (fonts are the reason that budget isn't fully consumed yet — see
residual list).

### 6. External-origin refs — PASS

`grep -rE 'https?://'` across every file in `docs/` outside `js/vendor/`
returns exactly one hit: the inert `xmlns="http://www.w3.org/2000/svg"`
namespace attribute in `index.html` (never fetched). The two hits inside
`js/vendor/d3.v7.min.js` are its own copyright comment and a D3-internal
XML-namespace constant, also never fetched.

### 7. Serve + curl the full import/data graph — PASS

Served `docs/` with `python3 -m http.server`. Curled: `index.html`;
`js/shared.js`, `js/engine.js`, `js/main.js`; the vendored
`js/vendor/d3.v7.min.js`; all 18 `js/scenes/sNN.js`; `design/tokens.json`,
`design/tokens.css`. Then parsed `data/manifest.json` and curled **every**
URL it declares — both population tiles, all 4 zoom tiles, `series.bin`,
`markets.json`, `data/replay/index.json`, and all 16
`data/scenes/sNN.json` files referenced in `manifest.scenes` — **26/26
manifest-graph URLs returned 200**, zero 404s, in addition to zero 404s on
every JS module and the tokens files.

Confirmed the *only* 404s anywhere on the served site are the
already-declared TODO assets: `docs/fonts/*.woff2` (4 files: Source Serif
4, Inter, IBM Plex Mono Regular/Medium) and `docs/og.png` — both still
absent on disk, both already marked `TODO(build)` in `index.html` and
`CONTRACT.md`. `docs/css/main.css` also 404s but is **not a live
reference**: confirmed no `<link href="css/main.css">` exists in
`index.html` (CSS is inline per CONTRACT §2's explicit "may start inline
in index.html; extract here when it grows" allowance) — a redundant
comment mentions the path but nothing requests it.

Noted, not a Check 7 failure (these files aren't in the manifest's static
URL graph — they're fetched lazily, only on user interaction in the coda):
`data/replay/index.json`'s 500 market rows carry no `shard` field. This is
**self-documented** in the file's own `note` field: *"per-market RTSER1
price-life shards are a documented follow-up (see TILES.md sec 5), not
generated in this build pass."* `s18.js`'s `loadReplayShard()` call is
wrapped in try/catch and degrades to a "price life unavailable" label —
confirmed this does not throw — but every coda market selection will show
that placeholder until shards actually get built. Flagged for eyes.

### 8. Footnotes — PASS

`index.html`'s `#footnotes` list renders exactly **23** `<li id="fn-N">`
entries (`fn-1`…`fn-23`), each a complete, sourced sentence. Cross-checked
every literal `#fn-N` string *and* every dynamic `FN(n)` helper call
(`` `<sup class="fn"><a href="#fn-${n}">${n}</a></sup>` ``, used by
`s10.js` and `s11.js`) across all 18 scene modules plus `index.html`: the
**defined** set `{1..23}` and the **referenced** set `{1..23}` are
identical — zero orphan references, zero unreferenced definitions. `fn-24`
(the unverified pre-kick probe, deliberately quarantined per the prior
job's notes) is confirmed absent everywhere in the served page.

---

## Known gaps — flagged for eyes (residual, not fixed here)

1. **Check 2's one residual field gap**: `data/scenes/s11.json` is missing
   `n_legs` (84) and `effective_n` (28); `s11.js` already falls back to the
   dossier-correct constants via `??`, so nothing is visibly wrong, but the
   literal field doesn't exist. Cheap to close either way (see Check 2).
2. **Browser visual/motion QA not exercised this pass.** This pass was
   static analysis + a Node functional harness + curl, not a live browser
   session. Still needs, in a real browser: interrupt-retargeting (reverse
   scroll mid-tween never snaps), scrub-track pinning and the 120ms lerp,
   chip/grain-plate pulse timing, the S14 toggle's real click (not just
   JS-dispatch), and `window.__rt.activate(sceneId, beatId)` deep-links for
   all beats with zero thrown exceptions (the prior SMOKE pass did this and
   found/fixed 4 bugs; nothing since has re-verified it against the
   reconciled data).
3. **Mobile / capability-tier parity.** `pop-250k.bin` tile loads fine over
   HTTP (Check 7), but portrait reflow, the mobile stage-rect math, and the
   ≤40ms `frameCost()` demotion probe are unverified this pass.
4. **`prefers-reduced-motion` pass.** Unverified this pass: instant states
   + 400ms canvas crossfade, scrub-to-nearest-keyframe snapping, no
   positional interpolation ever playing.
5. **Morning-of-final (G3) refresh.** `manifest.frozen_at` is still `null`
   (expected pre-G3). `manifest.hero` is a 3-leg provisional threeway with
   3-letter labels (`ESP`/`ENG`/`ARG`) — confirm the G3 refresh script's
   label format actually resolves `s16.js`'s `opponentCode()` string match
   (see Check 4 finding) before or at the July 19 re-run, or patch
   `opponentCode()` to match 3-letter codes directly so the fix doesn't
   depend on the pipeline's exact label wording.
6. **`data/replay/*` per-market shards not yet built.** Self-documented
   follow-up (see Check 7); the coda will show "price life unavailable" for
   every market selection until shards exist.
7. **Design-system assets still not dropped in**: `docs/fonts/*.woff2` (4
   files), `docs/og.png`. Both already marked `TODO(build)`; reconfirmed
   still absent (404 in the live curl pass).
8. **Minor doc staleness (not a functional bug)**: `s13.js`'s header
   comment cites "302 trades, ~$2,340" for the zombie-money footnote; the
   actual shipped `s13.json` carries 277 trades / $2,190.47 (the runtime
   reads the JSON correctly — this is a stale comment only, worth a
   one-line touch-up for a future editor's sanity).
9. **`drawAxes()` DOM rendering** was exercised against a Node/real-d3
   selection proxy, not a real browser SVG — confirms the functions don't
   throw and build valid `d3.line()`/scale calls, but not that the axis
   marks land pixel-correct inside S16's lens rects. One real-browser check
   of all 5 lens draw-ins recommended before publish.

## Files/tools used this pass

- Read: `CLAUDE.md`, `research/storyboard.md`, `research/design-system.md`,
  `docs/design/tokens.json`, `research/findings-dossier.md`,
  `docs/CONTRACT.md`, prior `docs/dev/SMOKE.md`.
- Ran: `python3 docs/design/validate_tokens.py`; `node --input-type=module
  --check` over all 21 ES modules; `python3 -m http.server` + `curl`/
  `urllib` over the full manifest-declared graph; several ad hoc Python
  field-coverage scanners (not committed); two Node ESM functional
  harnesses for the S16 anchors, one reusing the prior job's own
  `scratchpad/anchor_test.mjs`, one new
  (`scratchpad/smoke_reverify_s16_reald3.mjs`) that loads the real vendored
  d3 library via `vm.runInThisContext` instead of a hand-rolled stub.
- No files under `docs/`, `research/`, or `pipeline/` were modified. No
  `git commit` was made (this pass is verification-only).
