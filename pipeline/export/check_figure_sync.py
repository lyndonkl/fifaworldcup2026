#!/usr/bin/env python3
"""
pipeline/export/check_figure_sync.py -- refreeze-consistency checker.

Gate-5 item 4, disposition 3. Every scene's beat prose (docs/js/scenes/sNN.js)
occasionally restates a number that also lives, computed, in that scene's own
data (docs/data/scenes/sNN.json) or in docs/data/manifest.json. Those two
copies are written independently -- one by a narrative pass, one by a data
pass -- and nothing forces them to agree after a refreeze. That gap is
exactly what let S05's prose go stale against its own JSON after the
epilogue-day recompute (contracts/rank), and it is the same class of defect
as S17-style hardcoded numbers going stale against `manifest.hero` after a
future G3 re-run (Gate-5 item 4 finding). This script cannot know every
number in the piece means to track a field -- it checks a hand-curated map
of the pairs a human confirmed by reading each scene, extracts the prose
side with a slot-specific regex, and fails loudly when the two sides
disagree.

Design choices, spelled out because they are load-bearing:
  - This is not a general prose-number scraper. A slot exists only where a
    scene module's own DATA CONTRACT comment, or a direct read of its
    beats against its shipped JSON, showed a real hardcoded-prose /
    data-field pair. Numbers with no backing field (e.g. S02's "176
    trades in the draw hour", S08's shootout price levels, computed
    client-side from the population tile or a zoom .bin the browser owns,
    never shipped as a scene-JSON scalar) are out of scope by design --
    there is nothing to diff them against.
  - Spelled-out number words ("twenty-six", "thirty-two") are resolved
    only inside a slot that names the exact phrase; there is no general
    English-number parser scanning arbitrary prose (too fragile, too easy
    to false-positive on "a cent and a half").
  - Comparison rounds the data-side value to the precision the prose uses
    and requires the formatted strings to match. This tolerates honest
    rounding (0.357 in the JSON reads as "0.36%" in prose) while still
    failing on real drift (63.06 in the JSON does not round to "63.5%").

Run: pipeline/.venv/bin/python pipeline/export/check_figure_sync.py
Exit 0 on all slots agreeing, nonzero (with a per-slot report) on any
drift or any slot whose prose anchor text could not be found (the prose
was edited and the checker's regex needs updating -- report, don't guess).
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JS = os.path.join(ROOT, "docs", "js", "scenes")
SCENES_JSON = os.path.join(ROOT, "docs", "data", "scenes")
MANIFEST_PATH = os.path.join(ROOT, "docs", "data", "manifest.json")

# ------------------------------------------------------------------ #
# Small, scoped English-number-word resolver -- only ever called from
# a slot that names the exact phrase it expects; never scans free text.
_ONES = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
}
_TENS = {
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60,
    "seventy": 70, "eighty": 80, "ninety": 90,
}


def word_to_num(word):
    w = word.strip().lower()
    if w in _ONES:
        return _ONES[w]
    if w in _TENS:
        return _TENS[w]
    if "-" in w:
        a, b = w.split("-", 1)
        if a in _TENS and b in _ONES:
            return _TENS[a] + _ONES[b]
    return None


# ------------------------------------------------------------------ #
# Loaders (cached; every slot reads the same handful of files).

_js_cache = {}


def beat_text(scene_id):
    """Concatenated, whitespace-normalized, entity-decoded, footnote-
    stripped plain text of every `html:` beat string in
    docs/js/scenes/<scene_id>.js -- the search surface every slot's
    prose regex runs against."""
    if scene_id in _js_cache:
        return _js_cache[scene_id]
    path = os.path.join(SCENES_JS, f"{scene_id}.js")
    src = open(path, encoding="utf-8").read()
    # Beat bodies are `html: '...'` or `html: `...`` (backtick template
    # literals can span lines); this mirrors check_scene_field_parity.py's
    # sibling extraction style.
    parts = re.findall(r"html:\s*[`']((?:[^\\]|\\.)*?)[`'],\n", src)
    text = "\n".join(parts)
    text = re.sub(r"\$\{FN\(\d+\)\}", " ", text)  # template FN(n) footnote calls
    text = re.sub(r"<sup[^>]*>.*?</sup>", " ", text, flags=re.S)  # <sup> footnote markers + content
    text = re.sub(r"<[^>]+>", " ", text)  # any remaining tags
    text = html.unescape(text)  # &rsquo; etc -> real punctuation
    text = re.sub(r"\s+", " ", text).strip()
    _js_cache[scene_id] = text
    return text


_json_cache = {}


def scene_json(scene_id):
    if scene_id not in _json_cache:
        path = os.path.join(SCENES_JSON, f"{scene_id}.json")
        with open(path) as f:
            _json_cache[scene_id] = json.load(f)
    return _json_cache[scene_id]


_manifest_cache = None


def manifest():
    global _manifest_cache
    if _manifest_cache is None:
        with open(MANIFEST_PATH) as f:
            _manifest_cache = json.load(f)
    return _manifest_cache


def find_by(rows, **kv):
    for r in rows:
        if all(r.get(k) == v for k, v in kv.items()):
            return r
    raise KeyError(f"no row matching {kv!r} in {len(rows)}-row list")


# ------------------------------------------------------------------ #
# Extractors: regex match -> prose-side python value.

def num(g=1):
    return lambda m: float(m.group(g).replace(",", ""))


def intg(g=1):
    return lambda m: int(m.group(g).replace(",", ""))


def word(g=1):
    def f(m):
        v = word_to_num(m.group(g))
        if v is None:
            raise ValueError(f"unrecognized number word {m.group(g)!r}")
        return v
    return f


def bucket_range(g1=1, g2=2):
    return lambda m: (int(m.group(g1)), int(m.group(g2)))


def const(v):
    return lambda m: v


# ------------------------------------------------------------------ #
# Comparators: format both sides to the prose's own precision and
# string-compare -- tolerates honest rounding, fails on real drift.

def cmp_round(dp):
    def f(prose, actual):
        return f"{float(prose):.{dp}f}" == f"{float(actual):.{dp}f}"
    return f


def cmp_int(prose, actual):
    return f"{float(prose):.0f}" == f"{float(actual):.0f}"


def cmp_billions(dp=1):
    def f(prose, actual):
        return f"{float(prose):.{dp}f}" == f"{float(actual) / 1e9:.{dp}f}"
    return f


def cmp_tuple(prose, actual):
    return tuple(prose) == tuple(actual)


# ------------------------------------------------------------------ #
# Derived (multi-field) actual-value functions.

def s14_cheap_band_stat(field):
    """S14 b1's "implied 3.04%, paid off 1.19%" cheap-band figure is not a
    shipped scalar -- per this scene's own DATA REQUESTS comment (s14.js,
    ~line 24), it is the n_markets-weighted combination of the 1-5c and
    5-10c buckets. Recomputed here exactly as that comment specifies."""
    def f():
        d = scene_json("s14")
        b1 = find_by(d["buckets"], label="1-5c")
        b2 = find_by(d["buckets"], label="5-10c")
        n1, n2 = b1["n_markets"], b2["n_markets"]
        return (b1[field] * n1 + b2[field] * n2) / (n1 + n2)
    return f


def s14_worst_bucket_range():
    def f():
        d = scene_json("s14")
        m = re.match(r"^(\d+)-(\d+)c$", d["worst_bucket_label"])
        if not m:
            raise ValueError(f"worst_bucket_label {d['worst_bucket_label']!r} not in 'LO-HIc' shape")
        return (int(m.group(1)), int(m.group(2)))
    return f


def s07_suspend_duration():
    def f():
        p = scene_json("s07")["pinnacle"]
        return p["suspend_end_s"] - p["suspend_start_s"]
    return f


def hero_leg_price(label):
    def f():
        legs = manifest()["hero"]["legs"]
        return find_by(legs, label=label)["price_c"]
    return f


# ------------------------------------------------------------------ #
# The curated slot map. One entry per confirmed hardcoded-prose-number /
# data-field pair, built by reading each scene's beats against its own
# shipped JSON (and, for S06/S07/S09/S17, its own DATA CONTRACT comment
# naming the field explicitly).

SLOTS = [
    # -- S03 "the flood": press number and the tape's own running total --
    dict(
        id="s03-press-floor", scene="s03",
        regex=r"Newspapers had reported.{0,3}\$([\d.]+) billion",
        extract=num(), actual=lambda: scene_json("s03")["press_floor"]["usd"],
        compare=cmp_billions(1),
        note="press_floor.usd vs the '$7.4 billion' newspapers figure",
    ),
    dict(
        id="s03-final-counter", scene="s03",
        regex=r"tape.s final tally, it reached \$([\d.]+) billion",
        extract=num(), actual=lambda: manifest()["census"]["total_usd"],
        compare=cmp_billions(1),
        note="manifest.census.total_usd vs the beat's own quoted running total "
             "(this is also what the on-screen counter animates to -- see "
             "s03.js:41-42's own DATA CONTRACT comment tying the two together). "
             "Gate-5 provenance audit: was anchored 'July 14 snapshot' -- the "
             "number is the deploy-frozen total, not a July-14-dated figure "
             "(true July-14 cumulative is ~$12.35B); relabeled instead of "
             "reworking the number itself.",
    ),

    # -- S04 clock-grid: waking-hours residual --
    dict(
        id="s04-waking-residual", scene="s04",
        regex=r"trading runs about ([\d.]+) times what the schedule",
        extract=num(), actual=lambda: scene_json("s04")["waking_residual"],
        compare=cmp_round(1),
        note="s04.json waking_residual vs the '1.2 times' claim",
    ),
    # -- S04 clock-grid: kickoff-window money share/tilt (Gate-5 provenance
    # audit -- root-caused to match_windows.parquet missing the final and
    # third-place playoff; regenerated to the full 95-event catalog) --
    dict(
        id="s04-window-share-pct", scene="s04",
        regex=r"capture ([\d.]+)% of all the money traded",
        extract=num(), actual=lambda: scene_json("s04")["window_share"]["pct"],
        compare=cmp_round(1),
        note="window_share.pct vs the '50.7%' claim",
    ),
    dict(
        id="s04-window-tilt-x", scene="s04",
        regex=r"about ([\d.]+) times their fair share",
        extract=num(), actual=lambda: scene_json("s04")["window_share"]["tilt_x"],
        compare=cmp_round(1),
        note="window_share.tilt_x vs the 'about 1.7 times' claim",
    ),

    # -- S05 Lorenz sweep: family concentration + novelty-market rank --
    dict(
        id="s05-core-legs", scene="s05",
        regex=r"Those (\d[\d,]*) legs took",
        extract=intg(), actual=lambda: scene_json("s05")["core_series"]["legs"],
        compare=cmp_int,
        note="core_series.legs",
    ),
    dict(
        id="s05-core-share-pct", scene="s05",
        regex=r"legs took ([\d.]+)% of every dollar bet",
        extract=num(), actual=lambda: scene_json("s05")["core_series"]["share_pct"],
        compare=cmp_round(1),
        note="core_series.share_pct",
    ),
    dict(
        id="s05-tail-markets", scene="s05",
        regex=r"more than half the catalog, (\d[\d,]*) tiny markets",
        extract=intg(), actual=lambda: scene_json("s05")["tail"]["markets"],
        compare=cmp_int,
        note="tail.markets",
    ),
    dict(
        id="s05-tail-share-pct", scene="s05",
        regex=r"shared just ([\d.]+)% of all the money",
        extract=num(), actual=lambda: scene_json("s05")["tail"]["share_pct"],
        compare=cmp_round(2),
        note="tail.share_pct",
    ),
    dict(
        id="s05-novelty-nmarkets", scene="s05",
        regex=r"All (\d+) of those ad markets settled",
        extract=intg(), actual=lambda: scene_json("s05")["novelty_market"]["n_markets"],
        compare=cmp_int,
        note="novelty_market.n_markets",
    ),
    dict(
        id="s05-novelty-contracts", scene="s05",
        regex=r"to ([\d,]+)\. The single biggest",
        extract=intg(), actual=lambda: scene_json("s05")["novelty_market"]["contracts"],
        compare=cmp_int,
        note="novelty_market.contracts (Gate-5 item 4's original desync)",
    ),
    dict(
        id="s05-novelty-rank", scene="s05",
        regex=r"now ranks (\d[\d,]*)(?:st|nd|rd|th) of",
        extract=intg(), actual=lambda: scene_json("s05")["novelty_market"]["rank"],
        compare=cmp_int,
        note="novelty_market.rank (Gate-5 item 4's original desync)",
    ),
    dict(
        id="s05-total-markets", scene="s05",
        regex=r"(?:st|nd|rd|th) of ([\d,]+) markets by money traded",
        extract=intg(), actual=lambda: scene_json("s05")["total_markets"],
        compare=cmp_int,
        note="total_markets",
    ),

    # -- S06 MEXENG zoom: this leg's own rate constants (Gate-5 item 5) --
    dict(
        id="s06-pre-kick-rate", scene="s06",
        regex=r"about ([a-z-]+) trades landed every second",
        extract=word(), actual=lambda: scene_json("s06")["pre_kick_rate_per_s"],
        compare=cmp_round(0),
        note="pre_kick_rate_per_s",
    ),
    dict(
        id="s06-peak-rate", scene="s06",
        regex=r"printed (\d+) trades a second",
        extract=intg(), actual=lambda: scene_json("s06")["peak_minute_rate_per_s"],
        compare=cmp_round(0),
        note="peak_minute_rate_per_s",
    ),

    # -- S07 Pinnacle suspend window (goal-reaction microstructure) --
    dict(
        id="s07-suspend-start", scene="s07",
        regex=r"stops quoting about ([a-z-]+) seconds after the move begins",
        extract=word(), actual=lambda: scene_json("s07")["pinnacle"]["suspend_start_s"],
        compare=cmp_round(0),
        note="pinnacle.suspend_start_s",
    ),
    dict(
        id="s07-suspend-duration", scene="s07",
        regex=r"stays dark for roughly ([a-z-]+) seconds",
        extract=word(), actual=s07_suspend_duration(),
        compare=cmp_round(0),
        note="pinnacle.suspend_end_s - pinnacle.suspend_start_s",
    ),

    # -- S08 Germany-Paraguay: regulation leg's price at the whistle anchor
    # (Gate-5 provenance audit: "48 cents" was a hand-typed dossier figure
    # the raw tape does not confirm at the exact whistle_ts anchor driving
    # the axis; the tape reads 43-44c there) --
    dict(
        id="s08-price-at-whistle", scene="s08",
        regex=r"price slid from (\d+) cents to 1 cent over twenty-two minutes",
        extract=intg(), actual=lambda: scene_json("s08")["price_at_whistle_c"],
        compare=cmp_int,
        note="price_at_whistle_c vs the '44 cents' claim",
    ),

    # -- S09 bracket math: three shock multiples --
    dict(
        id="s09-par-multiple", scene="s09",
        regex=r"Paraguay's champion ticket jumped ([a-z-]+) times higher",
        extract=word(),
        actual=lambda: find_by(scene_json("s09")["shocks"], team="PAR")["pop_multiple"],
        compare=cmp_round(1),
        note="shocks[team=PAR].pop_multiple",
    ),
    dict(
        id="s09-nor-multiple", scene="s09",
        regex=r"Norway's ticket jumped about ([\d.]+) times",
        extract=num(),
        actual=lambda: find_by(scene_json("s09")["shocks"], team="NOR")["pop_multiple"],
        compare=cmp_round(1),
        note="shocks[team=NOR].pop_multiple",
    ),
    dict(
        id="s09-bel-multiple", scene="s09",
        regex=r"Belgium's jumped about ([a-z-]+) times",
        extract=word(),
        actual=lambda: find_by(scene_json("s09")["shocks"], team="BEL")["pop_multiple"],
        compare=cmp_round(1),
        note="shocks[team=BEL].pop_multiple",
    ),

    # -- S11 calibration: the day-out Kalshi/Pinnacle Brier pair --
    dict(
        id="s11-kalshi-t24-brier", scene="s11",
        regex=r"the two scores were ([\d.]+) and",
        extract=num(),
        actual=lambda: find_by(scene_json("s11")["scores"], horizon="T-24h", source="kalshi")["brier"],
        compare=cmp_round(3),
        note="scores[horizon=T-24h,source=kalshi].brier",
    ),
    dict(
        id="s11-pinnacle-t24-brier", scene="s11",
        regex=r"and ([\d.]+)\. The gap is tiny",
        extract=num(),
        actual=lambda: find_by(scene_json("s11")["scores"], horizon="T-24h", source="pinnacle_devig")["brier"],
        compare=cmp_round(3),
        note="scores[horizon=T-24h,source=pinnacle_devig].brier",
    ),

    # -- S13 bias forensics: polls, host-peer ratios, zombie money --
    dict(
        id="s13-argentina-poll", scene="s13",
        regex=r"In one poll, (\d+) out of 100 Argentine fans",
        extract=intg(),
        actual=lambda: find_by(scene_json("s13")["pairs"], key="argentina")["poll_pct"],
        compare=cmp_int,
        note="pairs[key=argentina].poll_pct",
    ),
    dict(
        id="s13-argentina-price", scene="s13",
        regex=r"priced that exact outcome at (\d+) cents",
        extract=intg(),
        actual=lambda: find_by(scene_json("s13")["pairs"], key="argentina")["kalshi_price_pct"],
        compare=cmp_int,
        note="pairs[key=argentina].kalshi_price_pct",
    ),
    dict(
        id="s13-usa-poll", scene="s13",
        regex=r"(\d+) out of 100 Americans",
        extract=intg(),
        actual=lambda: find_by(scene_json("s13")["pairs"], key="usa")["poll_pct"],
        compare=cmp_int,
        note="pairs[key=usa].poll_pct",
    ),
    dict(
        id="s13-usa-price-phrase", scene="s13",
        regex=r"priced the USA's\s*ticket at a cent and a half",
        extract=const(1.5),
        actual=lambda: find_by(scene_json("s13")["pairs"], key="usa")["kalshi_price_pct"],
        compare=cmp_round(1),
        note="pairs[key=usa].kalshi_price_pct ('a cent and a half' literal phrase)",
    ),
    dict(
        id="s13-mexico-ratio", scene="s13",
        regex=r"Mexico traded at about ([\d.]+) times its model chance",
        extract=num(),
        actual=lambda: find_by(scene_json("s13")["host_peers"]["teams"], key="mexico")["price_ratio_x"],
        compare=cmp_round(1),
        note="host_peers.teams[key=mexico].price_ratio_x",
    ),
    dict(
        id="s13-usa-ratio", scene="s13",
        regex=r"USA at about\s*([\d.]+) times its model chance",
        extract=num(),
        actual=lambda: find_by(scene_json("s13")["host_peers"]["teams"], key="usa")["price_ratio_x"],
        compare=cmp_round(1),
        note="host_peers.teams[key=usa].price_ratio_x",
    ),
    dict(
        id="s13-zombie-trades", scene="s13",
        regex=r"wound down together: ([\d,]+)\s*trades",
        extract=intg(), actual=lambda: scene_json("s13")["zombie_money"]["n_trades"],
        compare=cmp_int,
        note="zombie_money.n_trades",
    ),
    dict(
        id="s13-zombie-usd", scene="s13",
        regex=r"about \$([\d,]+) in total",
        extract=intg(), actual=lambda: scene_json("s13")["zombie_money"]["total_usd"],
        compare=cmp_int,
        note="zombie_money.total_usd",
    ),

    # -- S14 calibration curve: ladder attribution + the cheap-band figure --
    dict(
        id="s14-ladder-pct", scene="s14",
        regex=r"([\d.]+)% of the overpriced penny tickets\s*sit inside prop ladders",
        extract=num(),
        actual=lambda: scene_json("s14")["ladder_attribution"]["pct_in_ten_plus_leg_ladders"],
        compare=cmp_round(0),
        note="ladder_attribution.pct_in_ten_plus_leg_ladders",
    ),
    dict(
        id="s14-tick-floor-pct", scene="s14",
        regex=r"([\d.]+)% sit right at that\s*one-to-two-cent floor",
        extract=num(),
        actual=lambda: scene_json("s14")["ladder_attribution"]["pct_at_tick_floor"],
        compare=cmp_round(0),
        note="ladder_attribution.pct_at_tick_floor",
    ),
    dict(
        id="s14-worst-bucket", scene="s14",
        regex=r"the (\d+)-to-(\d+)-cent favorites",
        extract=bucket_range(), actual=s14_worst_bucket_range(),
        compare=cmp_tuple,
        note="worst_bucket_label, parsed",
    ),
    dict(
        id="s14-cheap-implied-pct", scene="s14",
        regex=r"implied a ([\d.]+)% chance",
        extract=num(), actual=s14_cheap_band_stat("mean_price_c"),
        compare=cmp_round(2),
        note="n_markets-weighted mean_price_c of buckets 1-5c + 5-10c "
             "(s14.js's own DATA REQUESTS comment names this exact derivation)",
    ),
    dict(
        id="s14-cheap-winrate-pct", scene="s14",
        regex=r"paid off only ([\d.]+)% of\s*the time",
        extract=num(), actual=s14_cheap_band_stat("win_rate_pct"),
        compare=cmp_round(2),
        note="n_markets-weighted win_rate_pct of buckets 1-5c + 5-10c",
    ),

    # -- S17 the frozen hero number --
    dict(
        id="s17-hero-esp", scene="s17",
        regex=r"Spain.s ([\d.]+) is the lift-the-trophy ticket",
        extract=num(), actual=hero_leg_price("ESP"),
        compare=cmp_round(1),
        note="manifest.hero.legs[label=ESP].price_c "
             "(Gate-5 item 4's flagged 'known sibling' hardcode)",
    ),

    # -- S19 epilogue: the restated exam + settlement + the tie climb --
    dict(
        id="s19-esp-price", scene="s19",
        regex=r"Spain.s ticket to lift the trophy cost ([\d.]+) cents",
        extract=num(),
        actual=lambda: find_by(scene_json("s19")["exam_restated"]["legs"], label="ESP")["price_c"],
        compare=cmp_round(1),
        note="exam_restated.legs[label=ESP].price_c",
    ),
    dict(
        id="s19-arg-price", scene="s19",
        regex=r"Argentina.s cost ([\d.]+)\.",
        extract=num(),
        actual=lambda: find_by(scene_json("s19")["exam_restated"]["legs"], label="ARG")["price_c"],
        compare=cmp_round(1),
        note="exam_restated.legs[label=ARG].price_c",
    ),
    dict(
        id="s19-esp-devig", scene="s19",
        regex=r"Spain.s true chance was ([\d.]+) in 100",
        extract=num(),
        actual=lambda: find_by(scene_json("s19")["exam_restated"]["legs"], label="ESP")["devig_pct"],
        compare=cmp_round(1),
        note="exam_restated.legs[label=ESP].devig_pct",
    ),
    dict(
        id="s19-arg-devig", scene="s19",
        regex=r"Argentina.s was ([\d.]+)\.\s*Spain won",
        extract=num(),
        actual=lambda: find_by(scene_json("s19")["exam_restated"]["legs"], label="ARG")["devig_pct"],
        compare=cmp_round(1),
        note="exam_restated.legs[label=ARG].devig_pct",
    ),
    dict(
        id="s19-champion-settle", scene="s19",
        regex=r"Spain.s ticket settled near ([\d.]+) cents",
        extract=num(),
        actual=lambda: scene_json("s19")["settlement"]["champion_futures_last_trade"]["price_c"],
        compare=cmp_round(1),
        note="settlement.champion_futures_last_trade.price_c",
    ),
    dict(
        id="s19-runnerup-settle", scene="s19",
        regex=r"Argentina.s settled near ([\d.]+)\.",
        extract=num(),
        actual=lambda: scene_json("s19")["settlement"]["runner_up_futures_last_trade"]["price_c"],
        compare=cmp_round(1),
        note="settlement.runner_up_futures_last_trade.price_c",
    ),
    dict(
        id="s19-tie-open", scene="s19",
        regex=r"Before kickoff it traded near ([\d.]+) cents",
        extract=num(),
        actual=lambda: find_by(scene_json("s19")["tie_climb"]["points"], minute=0)["tie_price_c"],
        compare=cmp_round(1),
        note="tie_climb.points[minute=0].tie_price_c",
    ),
    dict(
        id="s19-tie-trades", scene="s19",
        regex=r"it traded ([\d,]+) times, averaging",
        extract=intg(),
        actual=lambda: scene_json("s19")["tie_climb"]["headline_half_hour"]["n_trades"],
        compare=cmp_int,
        note="tie_climb.headline_half_hour.n_trades",
    ),
    dict(
        id="s19-tie-avg-price", scene="s19",
        regex=r"averaging ([\d.]+) cents",
        extract=num(),
        actual=lambda: scene_json("s19")["tie_climb"]["headline_half_hour"]["mean_price_c"],
        compare=cmp_round(0),
        note="tie_climb.headline_half_hour.mean_price_c",
    ),
    dict(
        id="s19-tie-settled", scene="s19",
        regex=r"It settled at (\d+)\.",
        extract=intg(),
        actual=lambda: scene_json("s19")["settlement"]["regulation_tie_last_trade"]["price_c"],
        compare=cmp_round(0),
        note="settlement.regulation_tie_last_trade.price_c",
    ),
]


def run_slot(slot):
    text = beat_text(slot["scene"])
    m = re.search(slot["regex"], text)
    if not m:
        return (slot, None, None, False,
                "prose anchor not found -- beat wording changed; "
                "regex needs re-pointing, not a data drift verdict")
    try:
        prose_val = slot["extract"](m)
    except Exception as e:
        return (slot, None, None, False, f"prose value could not be parsed: {e}")
    try:
        actual_val = slot["actual"]()
    except Exception as e:
        return (slot, prose_val, None, False, f"data field could not be read: {e}")
    ok = slot["compare"](prose_val, actual_val)
    return (slot, prose_val, actual_val, ok, None)


def main():
    results = [run_slot(s) for s in SLOTS]
    failures = [r for r in results if not r[3]]

    by_scene = {}
    for r in results:
        by_scene.setdefault(r[0]["scene"], []).append(r)

    print(f"=== refreeze-consistency check: {len(SLOTS)} figure slots across "
          f"{len(by_scene)} scenes ===\n")
    for scene in sorted(by_scene):
        rows = by_scene[scene]
        n_fail = sum(1 for r in rows if not r[3])
        status = "OK" if n_fail == 0 else f"{n_fail} DRIFT"
        print(f"[{scene}] {len(rows)} slots -- {status}")
        for slot, prose_val, actual_val, ok, err in rows:
            mark = "PASS" if ok else "FAIL"
            if err:
                print(f"  {mark}  {slot['id']}: {err}")
            else:
                print(f"  {mark}  {slot['id']}: prose={prose_val!r} "
                      f"vs data={actual_val!r}  ({slot['note']})")
        print()

    if failures:
        print(f"=== {len(failures)} of {len(SLOTS)} slots DRIFTED ===")
        for slot, prose_val, actual_val, ok, err in failures:
            if err:
                print(f"  DRIFT  [{slot['scene']}] {slot['id']}: {err}")
            else:
                print(f"  DRIFT  [{slot['scene']}] {slot['id']}: prose says "
                      f"{prose_val!r}, deployed data says {actual_val!r} "
                      f"({slot['note']})")
        sys.exit(1)

    print(f"ALL {len(SLOTS)} FIGURE SLOTS IN SYNC")


if __name__ == "__main__":
    main()
