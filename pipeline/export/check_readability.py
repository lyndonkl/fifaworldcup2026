#!/usr/bin/env python3
"""
pipeline/export/check_readability.py -- Flesch-Kincaid grade checker for
scene beat prose.

Extracts every `html: '...'` / `html: `...`` string literal from each
docs/js/scenes/sNN.js module (paired with the nearest preceding `id: '...'`
so each beat's grade can be attributed), strips HTML tags and entities,
strips `${FN(n)}` footnote-helper template expressions (numeric footnote
markers only, no prose content), and computes the standard Flesch-Kincaid
Grade Level formula per beat:

    FKGL = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59

Syllable counts use the standard vowel-group heuristic (count vowel-group
transitions, drop a trailing silent "e", floor of 1 per word). This is a
heuristic, not a dictionary lookup -- adequate for a grade-level screen,
not a precision instrument.

Reports every beat whose grade exceeds --threshold (default 10, per the
revision task's "flag anything above grade 10" instruction; the task's
own accessibility target is <= 9, so beats between 9 and 10 are printed
as a softer warning but do not fail the run).

Run: pipeline/.venv/bin/python pipeline/export/check_readability.py
"""
import argparse
import html as html_mod
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_DIR = os.path.join(ROOT, "docs", "js", "scenes")

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
# point/percent/dollar sign count as one "word" too (FK treats any token
# between spaces as a word for the words/sentence ratio).
WORD_RE = re.compile(r"[A-Za-z][A-Za-z’'\-]*|\d[\d,.]*")
SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+(?=[A-Z0-9"“‘])')

VOWELS = "aeiouy"


def strip_html_to_text(raw_js_string_literal_body):
    """raw body between the JS quote delimiters (already de-escaped for our
    purposes -- no backslash escapes are used in these files, verified by
    grep before writing this script)."""
    s = FN_EXPR_RE.sub("", raw_js_string_literal_body)
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


def fk_grade(text):
    sentences = [s for s in SENTENCE_SPLIT_RE.split(text) if s.strip()]
    n_sentences = max(len(sentences), 1)
    words = WORD_RE.findall(text)
    n_words = len(words)
    if n_words == 0:
        return None, 0, 0, 0
    n_syllables = sum(count_syllables(w) for w in words)
    grade = 0.39 * (n_words / n_sentences) + 11.8 * (n_syllables / n_words) - 15.59
    return grade, n_words, n_sentences, n_syllables


def extract_beats(path):
    """Returns list of (beat_id, text) in file order. Pairs each html
    match with the nearest preceding `id: '...'` occurrence (beat ids
    follow the scene's own top-level id, so within a beat object the
    beat's own id always precedes its html key)."""
    with open(path, encoding="utf-8") as f:
        src = f.read()

    # Build one merged, ordered stream of (pos, kind, value) for ids and
    # html matches, then walk it linearly.
    events = []
    for m in ID_RE.finditer(src):
        events.append((m.start(), "id", m.group(1)))
    for m in HTML_RE.finditer(src):
        body = m.group(1) if m.group(1) is not None else (
            m.group(2) if m.group(2) is not None else m.group(3)
        )
        events.append((m.start(), "html", body))
    events.sort(key=lambda e: e[0])

    beats = []
    last_id = None
    for _, kind, val in events:
        if kind == "id":
            last_id = val
        else:
            beats.append((last_id or "?", val))
    return beats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=10.0,
                     help="grade above which a beat is reported as a failure (default 10)")
    ap.add_argument("--target", type=float, default=9.0,
                     help="the piece's own accessibility target (default 9); "
                          "beats between target and threshold print as soft warnings")
    args = ap.parse_args()

    scene_files = sorted(
        f for f in os.listdir(SCENES_DIR) if re.match(r"^s\d\d\.js$", f)
    )
    if not scene_files:
        print(f"No scene files found in {SCENES_DIR}", file=sys.stderr)
        return 2

    over_threshold = []
    soft_warnings = []
    all_rows = []

    for fname in scene_files:
        scene_id = fname[:-3]
        path = os.path.join(SCENES_DIR, fname)
        beats = extract_beats(path)
        if not beats:
            print(f"  {scene_id}: no beat html found (0 beats)")
            continue
        for beat_id, raw in beats:
            text = strip_html_to_text(raw)
            grade, n_words, n_sent, n_syll = fk_grade(text)
            if grade is None:
                continue
            all_rows.append((scene_id, beat_id, grade, n_words, n_sent))
            if grade > args.threshold:
                over_threshold.append((scene_id, beat_id, grade, text))
            elif grade > args.target:
                soft_warnings.append((scene_id, beat_id, grade, text))

    print(f"Checked {len(all_rows)} beats across {len(scene_files)} scene files.")
    print(f"Target grade (accessible, CLAUDE.md/revision spec): <= {args.target:g}")
    print(f"Fail threshold (this check's own gate): > {args.threshold:g}")
    print()

    all_rows.sort(key=lambda r: -r[2])
    print("All beats, worst-first:")
    for scene_id, beat_id, grade, n_words, n_sent in all_rows:
        flag = "FAIL" if grade > args.threshold else ("warn" if grade > args.target else "ok  ")
        print(f"  [{flag}] {scene_id} / {beat_id:>4}  grade={grade:5.2f}  words={n_words:4d}  sentences={n_sent:3d}")

    if soft_warnings:
        print()
        print(f"Soft warnings (grade > {args.target:g} but <= {args.threshold:g}, target-miss only, not a hard fail):")
        for scene_id, beat_id, grade, text in soft_warnings:
            print(f"  - {scene_id}/{beat_id}: grade {grade:.2f}")

    if over_threshold:
        print()
        print(f"FAILURES (grade > {args.threshold:g}):")
        for scene_id, beat_id, grade, text in over_threshold:
            print(f"\n  === {scene_id} / {beat_id}  (grade {grade:.2f}) ===")
            print(f"  {text}")
        print(f"\n{len(over_threshold)} beat(s) exceed grade {args.threshold:g}.")
        return 1

    print(f"\nAll {len(all_rows)} beats are at or below grade {args.threshold:g}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
