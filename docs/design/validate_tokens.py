#!/usr/bin/env python3
"""
Gate 3 validator:
  1. Recomputes WCAG 2.x contrast for every declared text/background pair
     and checks it against its target tier.
  2. Cross-checks docs/design/tokens.css against docs/design/tokens.json --
     every --token: #HEX in the CSS must match the corresponding hex/rgba
     in the JSON exactly (round-tripped through the same 0-1 float math).
Fails loudly (non-zero exit, FAIL lines) on any miss.
"""
import re, json, sys

CSS_PATH = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/docs/design/tokens.css"
JSON_PATH = "/Users/kushaldsouza/Documents/Thinking/fifaworldcup2026/docs/design/tokens.json"

# ---------- WCAG contrast math ----------
def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def srgb_to_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def rel_lum(hexcolor):
    r, g, b = hex_to_rgb(hexcolor)
    return 0.2126 * srgb_to_lin(r) + 0.7152 * srgb_to_lin(g) + 0.0722 * srgb_to_lin(b)

def contrast(h1, h2):
    L1, L2 = rel_lum(h1), rel_lum(h2)
    lighter, darker = max(L1, L2), min(L1, L2)
    return (lighter + 0.05) / (darker + 0.05)

# ---------- Load CSS tokens ----------
css_text = open(CSS_PATH).read()
css_colors = {}
for m in re.finditer(r'--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6});', css_text):
    css_colors[m.group(1)] = m.group(2).upper()

# ---------- Load JSON tokens ----------
data = json.load(open(JSON_PATH))
json_colors = {k: v["hex"].upper() for k, v in data["colors"].items()}

# ---------- 1. Cross-check CSS vs JSON ----------
print("=" * 78)
print("CROSS-CHECK: tokens.css vs tokens.json color agreement")
print("=" * 78)
cross_fail = []
all_color_names = sorted(set(json_colors.keys()) | {k for k in css_colors if k in json_colors})
for name in sorted(json_colors.keys()):
    css_val = css_colors.get(name)
    json_val = json_colors.get(name)
    if css_val is None:
        cross_fail.append(f"MISSING in tokens.css: --{name}")
        print(f"FAIL  --{name:32s} present in JSON, MISSING from CSS")
        continue
    if css_val != json_val:
        cross_fail.append(f"MISMATCH {name}: css={css_val} json={json_val}")
        print(f"FAIL  --{name:32s} css={css_val}  json={json_val}  MISMATCH")
    else:
        print(f"OK    --{name:32s} {css_val}")

# also verify JSON rgba floats round-trip to the same hex
rgba_fail = []
for name, entry in data["colors"].items():
    r, g, b, a = entry["rgba"]
    reconstructed = "#%02X%02X%02X" % (round(r*255), round(g*255), round(b*255))
    if reconstructed != entry["hex"].upper():
        rgba_fail.append(name)
        print(f"FAIL  --{name} rgba{entry['rgba']} round-trips to {reconstructed}, expected {entry['hex']}")

# ---------- 2. Contrast targets ----------
# Each entry: (token, background, target_ratio, tier_label, kind)
# kind: 'sustained-text' (AAA 7:1), 'any-text' (AA 4.5:1), 'non-text' (AA 3:1),
#       'non-text-exception' (documented sub-3:1 deviation, must still match its OWN stated ratio)
canvas = css_colors["bg-canvas"]
card = css_colors["bg-card"]
card_cap = css_colors["bg-card-composite-cap"]

pairs = [
    ("ink-hi",              "bg-canvas", 7.0,  "sustained-text"),
    ("ink-hi",              "bg-card",   7.0,  "sustained-text"),
    ("ink-mid",             "bg-canvas", 7.0,  "sustained-text"),
    ("ink-mid",             "bg-card",   7.0,  "sustained-text"),
    ("ink-mid",             "bg-card-composite-cap", 7.0, "sustained-text"),
    ("ink-low",             "bg-canvas", 4.5,  "any-text (footnote-weight by design; AA floor, not AAA)"),
    ("ink-low",             "bg-card",   4.5,  "any-text"),
    ("ink-low",             "bg-card-composite-cap", 4.5, "any-text"),
    ("ink-hero",            "bg-canvas", 7.0,  "sustained-text"),
    ("accent-annotation",   "bg-canvas", 7.0,  "sustained-text"),
    ("accent-annotation",   "bg-card",   7.0,  "sustained-text"),
    ("side-yes",            "bg-canvas", 7.0,  "sustained-text (direct label at mark)"),
    ("side-no",             "bg-canvas", 4.5,  "any-text (direct label at mark, AA floor per audit note on identity/side colors)"),
    ("venue-kalshi",        "bg-canvas", 7.0,  "sustained-text"),
    ("venue-polymarket",    "bg-canvas", 7.0,  "sustained-text"),
    ("venue-pinnacle",      "bg-canvas", 7.0,  "sustained-text"),
    ("neutral-data",        "bg-canvas", 7.0,  "sustained-text"),
    ("identity-blue",       "bg-canvas", 4.5,  "any-text (direct-at-mark identity label; AA floor per audit disposition #5)"),
    ("identity-crimson",    "bg-canvas", 7.0,  "sustained-text (FIX applied: lightened to clear AAA)"),
    ("identity-crimson",    "bg-card",   7.0,  "sustained-text (FIX applied: lightened to clear AAA)"),
    ("identity-teal",       "bg-canvas", 4.5,  "any-text (direct-at-mark identity label; AA floor)"),
    ("identity-lavender",   "bg-canvas", 4.5,  "any-text (direct-at-mark identity label; AA floor)"),
    ("identity-pink",       "bg-canvas", 4.5,  "any-text (direct-at-mark identity label; AA floor)"),
    ("identity-ref",        "bg-canvas", 4.5,  "any-text (direct-at-mark identity label; AA floor)"),
    ("bg-canvas",           "accent-annotation", 4.5, "any-text (button/toggle-active label on amber fill)"),
]

non_text_pairs = [
    # (token, background, target, label)
    ("venue-pinnacle-terminated", "bg-canvas", 3.0, "non-text (dashed termination mark)"),
    ("state-expiring",            "bg-canvas", 3.0, "non-text (S8 mechanism-decay mark; FIX-introduced token)"),
]

documented_exceptions = [
    # (token, background, stated_ratio, wcag_clause)
    ("state-dead", "bg-canvas", 2.5, "WCAG 2.1 SC 1.4.11 Non-text Contrast -- Inactive User Interface Components exception; mandatory-paired ink-mid text label per design-system.md"),
]

print()
print("=" * 78)
print("CONTRAST VALIDATION: text/background pairs vs. declared targets")
print("=" * 78)
contrast_fail = []
results_table = []
for tok, bg, target, tier in pairs:
    c1 = css_colors.get(tok)
    c2 = css_colors.get(bg)
    if c1 is None or c2 is None:
        contrast_fail.append(f"UNKNOWN TOKEN in pair ({tok}, {bg})")
        print(f"FAIL  unknown token(s) in pair ({tok}, {bg})")
        continue
    ratio = contrast(c1, c2)
    status = "PASS" if ratio >= target - 0.005 else "FAIL"
    if status == "FAIL":
        contrast_fail.append(f"{tok} on {bg}: {ratio:.2f}:1 < target {target}:1 [{tier}]")
    print(f"{status}  {tok:22s} on {bg:26s} {ratio:6.2f}:1  (target {target:.1f}:1)  {tier}")
    results_table.append((tok, bg, ratio, target, tier, status))

print()
print("-" * 78)
print("Non-text marks (AA 3:1 floor)")
print("-" * 78)
for tok, bg, target, label in non_text_pairs:
    c1, c2 = css_colors[tok], css_colors[bg]
    ratio = contrast(c1, c2)
    status = "PASS" if ratio >= target - 0.005 else "FAIL"
    if status == "FAIL":
        contrast_fail.append(f"{tok} on {bg}: {ratio:.2f}:1 < target {target}:1 [{label}]")
    print(f"{status}  {tok:22s} on {bg:26s} {ratio:6.2f}:1  (target {target:.1f}:1)  {label}")
    results_table.append((tok, bg, ratio, target, label, status))

print()
print("-" * 78)
print("Documented sub-floor exceptions (must match THEIR OWN stated ratio, not the generic floor)")
print("-" * 78)
for tok, bg, stated, clause in documented_exceptions:
    c1, c2 = css_colors[tok], css_colors[bg]
    ratio = contrast(c1, c2)
    status = "PASS" if abs(ratio - stated) < 0.1 else "FAIL"
    if status == "FAIL":
        contrast_fail.append(f"{tok} on {bg}: {ratio:.2f}:1 does not match documented exception value {stated}:1")
    print(f"{status}  {tok:22s} on {bg:26s} {ratio:6.2f}:1  (documented exception: {stated}:1)  {clause}")
    results_table.append((tok, bg, ratio, stated, clause, status))

print()
print("=" * 78)
print("SUMMARY")
print("=" * 78)
total_fail = len(cross_fail) + len(rgba_fail) + len(contrast_fail)
if total_fail == 0:
    print(f"ALL CHECKS PASSED. {len(pairs)+len(non_text_pairs)} contrast pairs + {len(documented_exceptions)} documented exception verified; "
          f"{len(json_colors)} tokens cross-checked css<->json; {len(data['colors'])} rgba round-trips verified.")
else:
    print(f"{total_fail} FAILURE(S):")
    for f in cross_fail + rgba_fail + contrast_fail:
        print("  - " + f)
    sys.exit(1)
