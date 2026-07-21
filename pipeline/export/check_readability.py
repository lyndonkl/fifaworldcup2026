#!/usr/bin/env python3
"""
pipeline/export/check_readability.py -- five-test readability battery for
every prose surface in the piece.

Tests (official formulas):
  FK    Flesch-Kincaid Grade   0.39*(W/S) + 11.8*(Syl/W) - 15.59
  EASE  Flesch Reading Ease    206.835 - 1.015*(W/S) - 84.6*(Syl/W)
  SMOG  1.0430*sqrt(poly * 30/S) + 3.1291   (poly = words of 3+ syllables,
        proper nouns INCLUDED per the original test; a proper-noun-excluded
        variant is also computed as a diagnostic, because this piece's
        unavoidable names -- Argentina, Polymarket, Paraguay -- are
        polysyllabic and SMOG was calibrated on 30-sentence health texts,
        so short beats dense with team names read artificially high)
  FOG   Gunning Fog            0.4*((W/S) + 100*(complex/W))
        complex = 3+ syllables EXCLUDING proper nouns, hyphenated
        compounds (scored by their parts), and words that only reach
        three syllables through an -es/-ed/-ing suffix -- all three
        exclusions are part of Gunning's own definition.
  ARI   Automated Readability  4.71*(chars/W) + 0.5*(W/S) - 21.43

Prose surfaces:
  flow      -- the 48 scene beats (docs/js/scenes/sNN.js `html:` literals)
               plus the title screen's pretitle/subtitle/deck. This is
               what a reader actually scrolls through; it is gated.
  apparatus -- methods sections, footnotes, provenance, noscript fallback
               (citation-dense reference matter; reported, not gated,
               unless --gate-apparatus).

Gates (the piece's 8th-grade constraint, CLAUDE.md / Gate-5 standing
constraint), applied per flow unit:
  FK <= 9.0, ARI <= 9.0, FOG <= 9.0, EASE >= 60, SMOG <= 10.0
The SMOG gate sits one grade above the others by design: McLaughlin
calibrated SMOG against 100% comprehension where FK-family tests predict
~75%, so SMOG reads roughly one-to-two grades higher on identical text;
a SMOG of 10 corresponds to the same audience as FK ~8.

Aggregate whole-flow scores (all flow units concatenated) are printed as
well -- SMOG in particular is only really valid at that length.

Syllable counts use the standard vowel-group heuristic (count vowel-group
transitions, drop a trailing silent "e", floor of 1 per word). This is a
heuristic, not a dictionary lookup -- adequate for a grade-level screen,
not a precision instrument.

Run: pipeline/.venv/bin/python pipeline/export/check_readability.py
     [--fk 9] [--ari 9] [--fog 9] [--ease 60] [--smog 10]
     [--gate-apparatus] [--legacy-fk-only]
"""
import argparse
import html as html_mod
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_DIR = os.path.join(ROOT, "docs", "js", "scenes")
INDEX_HTML = os.path.join(ROOT, "docs", "index.html")

# Matches `id: 'xxx',` (beat or scene id) OR an `html:` string literal,
# in file order, so each html can be paired with the nearest preceding id.
ID_RE = re.compile(r"""\bid:\s*'([^']+)'""")
HTML_RE = re.compile(
    r"""\bhtml:\s*(?:`((?:[^`\\]|\\.)*)`|'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")""",
    re.DOTALL,
)

FN_EXPR_RE = re.compile(r"\$\{[^}]*\}")
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

# Word token: letters plus internal apostrophe/curly-apostrophe (contractions,
# possessives) or hyphen (compound words); numerals with optional decimal
# point/percent/dollar sign count as one "word" too.
WORD_RE = re.compile(r"[A-Za-z][A-Za-z’'\-]*|\d[\d,.]*")
SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+(?=[A-Z0-9"“‘])')

VOWELS = "aeiouy"


def strip_html_to_text(raw):
    s = FN_EXPR_RE.sub("", raw)
    s = TAG_RE.sub(" ", s)
    s = html_mod.unescape(s)
    s = WS_RE.sub(" ", s).strip()
    return s


def count_syllables(word):
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    count = 0
    prev_vowel = False
    for ch in w:
        is_vowel = ch in VOWELS
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    if w.endswith("e") and not w.endswith("le") and count > 1:
        count -= 1
    return max(count, 1)


SUFFIX_RE = re.compile(r"(es|ed|ing)$")


def analyze(text):
    """Token-level pass shared by all five tests. Returns None for empty
    text, else the raw counts every formula needs."""
    sentences = [s for s in SENTENCE_SPLIT_RE.split(text) if s.strip()]
    n_sent = max(len(sentences), 1)

    words = []            # (token, sentence_initial)
    for sent in sentences or [text]:
        toks = WORD_RE.findall(sent)
        for i, t in enumerate(toks):
            words.append((t, i == 0))
    n_words = len(words)
    if n_words == 0:
        return None

    n_syll = 0
    n_chars = 0
    poly_all = 0          # SMOG: every 3+ syllable word
    poly_no_proper = 0    # SMOG diagnostic variant
    fog_complex = 0       # FOG: Gunning's exclusions applied
    for tok, sent_initial in words:
        n_chars += sum(c.isalnum() for c in tok)
        syl = count_syllables(tok)
        n_syll += syl
        if syl >= 3:
            poly_all += 1
            proper = tok[0].isupper() and not sent_initial
            if not proper:
                poly_no_proper += 1
            # Gunning Fog complex-word rules:
            #  - proper nouns don't count
            #  - hyphenated compounds score by their parts
            #  - -es/-ed/-ing suffixes don't push a word to 3 syllables
            if proper:
                continue
            if "-" in tok and all(count_syllables(p) < 3
                                  for p in tok.split("-") if p):
                continue
            stem = SUFFIX_RE.sub("", tok)
            if stem != tok and count_syllables(stem) < 3:
                continue
            fog_complex += 1

    return {
        "n_sent": n_sent, "n_words": n_words, "n_syll": n_syll,
        "n_chars": n_chars, "poly_all": poly_all,
        "poly_no_proper": poly_no_proper, "fog_complex": fog_complex,
    }


def scores(c):
    wps = c["n_words"] / c["n_sent"]
    spw = c["n_syll"] / c["n_words"]
    return {
        "fk": 0.39 * wps + 11.8 * spw - 15.59,
        "ease": 206.835 - 1.015 * wps - 84.6 * spw,
        "smog": 1.0430 * math.sqrt(c["poly_all"] * 30.0 / c["n_sent"]) + 3.1291,
        "smog_np": 1.0430 * math.sqrt(c["poly_no_proper"] * 30.0 / c["n_sent"]) + 3.1291,
        "fog": 0.4 * (wps + 100.0 * c["fog_complex"] / c["n_words"]),
        "ari": 4.71 * (c["n_chars"] / c["n_words"]) + 0.5 * wps - 21.43,
    }


def extract_beats(path):
    """(beat_id, raw_html) pairs in file order; each html literal pairs
    with the nearest preceding `id: '...'`."""
    with open(path, encoding="utf-8") as f:
        src = f.read()
    events = []
    for m in ID_RE.finditer(src):
        events.append((m.start(), "id", m.group(1)))
    for m in HTML_RE.finditer(src):
        body = m.group(1) if m.group(1) is not None else (
            m.group(2) if m.group(2) is not None else m.group(3))
        events.append((m.start(), "html", body))
    events.sort(key=lambda e: e[0])
    beats, last_id = [], None
    for _, kind, val in events:
        if kind == "id":
            last_id = val
        else:
            beats.append((last_id or "?", val))
    return beats


def extract_index_units():
    """Prose units from docs/index.html: title-screen prose (flow class)
    and methods/footnotes/fallback (apparatus class)."""
    with open(INDEX_HTML, encoding="utf-8") as f:
        src = f.read()
    # HTML comments hold TODO notes, not prose.
    src = re.sub(r"<!--.*?-->", " ", src, flags=re.DOTALL)
    units = []

    def block(tag_re, uid, cls):
        m = re.search(tag_re, src, flags=re.DOTALL)
        if m:
            text = strip_html_to_text(m.group(1))
            if text:
                units.append((uid, cls, text))

    block(r'<p class="pretitle">(.*?)</p>', "title/pretitle", "flow")
    block(r'<p class="subtitle">(.*?)</p>', "title/subtitle", "flow")
    block(r'<p class="deck">(.*?)</p>', "title/deck", "flow")
    block(r'<p class="fallback-note">(.*?)</p>', "noscript/fallback", "apparatus")
    block(r'<p class="provenance">(.*?)</p>', "methods/provenance", "apparatus")

    # Methods body: each <h3>Title</h3><p>...</p> pair.
    for m in re.finditer(r"<h3>(.*?)</h3>\s*<p>(.*?)</p>", src, flags=re.DOTALL):
        title = strip_html_to_text(m.group(1)).lower().replace(" ", "-")
        text = strip_html_to_text(m.group(2))
        if text:
            units.append((f"methods/{title}", "apparatus", text))

    # Footnotes.
    for m in re.finditer(r'<li id="(fn-\d+)">(.*?)</li>', src, flags=re.DOTALL):
        text = strip_html_to_text(m.group(2))
        if text:
            units.append((m.group(1), "apparatus", text))
    return units


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fk", type=float, default=9.0)
    ap.add_argument("--ari", type=float, default=9.0)
    ap.add_argument("--fog", type=float, default=9.0)
    ap.add_argument("--ease", type=float, default=60.0)
    ap.add_argument("--smog", type=float, default=10.0)
    ap.add_argument("--gate-apparatus", action="store_true",
                    help="apply the flow gates to apparatus units too")
    ap.add_argument("--legacy-fk-only", action="store_true",
                    help="old behavior: FK-only, threshold 10 (kept so any "
                         "caller pinned to the previous contract still works)")
    ap.add_argument("--threshold", type=float, default=10.0,
                    help="legacy FK hard-fail threshold (with --legacy-fk-only)")
    args = ap.parse_args()

    units = []   # (uid, class, text)
    scene_files = sorted(
        f for f in os.listdir(SCENES_DIR) if re.match(r"^s\d\d\.js$", f))
    for fname in scene_files:
        scene_id = fname[:-3]
        for beat_id, raw in extract_beats(os.path.join(SCENES_DIR, fname)):
            text = strip_html_to_text(raw)
            if text:
                units.append((f"{scene_id}/{beat_id}", "flow", text))
    units.extend(extract_index_units())

    rows = []
    for uid, cls, text in units:
        c = analyze(text)
        if c is None:
            continue
        rows.append((uid, cls, scores(c), c, text))

    if args.legacy_fk_only:
        fails = [(u, s["fk"]) for u, cl, s, c, t in rows
                 if cl == "flow" and s["fk"] > args.threshold]
        for u, cl, s, c, t in sorted(rows, key=lambda r: -r[2]["fk"]):
            if cl != "flow":
                continue
            print(f"  [{'FAIL' if s['fk'] > args.threshold else 'ok  '}] "
                  f"{u:>12}  grade={s['fk']:5.2f}")
        if fails:
            print(f"\n{len(fails)} beat(s) exceed grade {args.threshold:g}.")
            return 1
        print(f"\nAll flow units at or below grade {args.threshold:g}.")
        return 0

    def gate_misses(s):
        m = []
        if s["fk"] > args.fk:
            m.append(f"FK {s['fk']:.2f}>{args.fk:g}")
        if s["ari"] > args.ari:
            m.append(f"ARI {s['ari']:.2f}>{args.ari:g}")
        if s["fog"] > args.fog:
            m.append(f"FOG {s['fog']:.2f}>{args.fog:g}")
        if s["ease"] < args.ease:
            m.append(f"EASE {s['ease']:.1f}<{args.ease:g}")
        if s["smog"] > args.smog:
            m.append(f"SMOG {s['smog']:.2f}>{args.smog:g}")
        return m

    n_flow = sum(1 for _, cl, _, _, _ in rows if cl == "flow")
    n_app = len(rows) - n_flow
    print(f"Readability battery: {n_flow} flow units + {n_app} apparatus units.")
    print(f"Flow gates: FK<={args.fk:g}  ARI<={args.ari:g}  FOG<={args.fog:g}  "
          f"EASE>={args.ease:g}  SMOG<={args.smog:g} "
          "(SMOG gate sits one grade higher by calibration; see header)")
    print()

    hdr = (f"  {'':6} {'unit':>18}  {'FK':>6} {'ARI':>6} {'FOG':>6} "
           f"{'EASE':>6} {'SMOG':>6} {'SMOGnp':>6}  {'words':>5}")
    failures = []
    for cls in ("flow", "apparatus"):
        sub = [r for r in rows if r[1] == cls]
        sub.sort(key=lambda r: -max(r[2]["fk"], r[2]["ari"], r[2]["fog"]))
        print(f"--- {cls} ({len(sub)} units, worst-first) ---")
        print(hdr)
        for uid, _, s, c, text in sub:
            misses = gate_misses(s)
            gated = cls == "flow" or args.gate_apparatus
            flag = ("FAIL" if misses else "ok  ") if gated else ("note" if misses else "ok  ")
            if gated and misses:
                failures.append((uid, misses, text))
            print(f"  [{flag}] {uid:>18}  {s['fk']:6.2f} {s['ari']:6.2f} "
                  f"{s['fog']:6.2f} {s['ease']:6.1f} {s['smog']:6.2f} "
                  f"{s['smog_np']:6.2f}  {c['n_words']:5d}"
                  + ("   " + "; ".join(misses) if misses else ""))
        print()

    # Whole-flow aggregate (SMOG is only really valid at this length).
    flow_text = " ".join(t for _, cl, _, _, t in rows if cl == "flow")
    agg = scores(analyze(flow_text))
    print("--- whole-flow aggregate (all flow prose concatenated) ---")
    print(f"  FK {agg['fk']:.2f}   ARI {agg['ari']:.2f}   FOG {agg['fog']:.2f}   "
          f"EASE {agg['ease']:.1f}   SMOG {agg['smog']:.2f} "
          f"(no-proper-noun {agg['smog_np']:.2f})")

    if failures:
        print(f"\n{len(failures)} unit(s) miss the flow gates:")
        for uid, misses, text in failures:
            print(f"\n  === {uid}  ({'; '.join(misses)}) ===")
            print(f"  {text[:400]}{'…' if len(text) > 400 else ''}")
        return 1
    print("\nALL GATED UNITS PASS THE FIVE-TEST BATTERY.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
