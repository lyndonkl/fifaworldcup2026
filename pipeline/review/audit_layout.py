#!/usr/bin/env python3
"""
pipeline/review/audit_layout.py -- DOM-geometry audit for the walkthrough.

Screenshots answer "does it look right"; this answers "is anything
measurably wrong": at every beat's resting scroll position (plus the
title, coda, and end-matter stops) it collects bounding rects for the
piece's chrome and annotation surfaces and reports, mechanically:

  1. viewport-edge overflow -- any audited element whose rect pokes past
     the viewport's left/right edge (>1px), plus the page-level symptom
     (document scrollWidth > innerWidth, which is what puts a horizontal
     scrollbar at the bottom of a desktop browser and lets the content
     sit "slightly off-screen to the left");
  2. box-pair overlaps -- pairwise intersections among the fixed chrome
     (#grain-plate, #chip, .skip), the visible prose card(s), the s14
     toggle, and every visible SVG <text> node (annotation collisions),
     ignoring parent-child pairs and sub-4px grazes.

Runs on the same harness plumbing as capture_walkthrough.py (StaticServer,
Chrome-over-CDP, the live scene-registry plan walk) and honors its
--viewport / --mobile flags, so the same audit runs at 1440x900 and at an
emulated 390x844 phone.

Output: a JSON defect list (research/design-review/layout-audit-<WxH>.json)
plus a worst-first stdout table.

Run:
  pipeline/.venv/bin/python pipeline/review/audit_layout.py
  pipeline/.venv/bin/python pipeline/review/audit_layout.py --mobile
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import capture_walkthrough as cw  # noqa: E402

REPO_ROOT = cw.REPO_ROOT
OUT_DIR = REPO_ROOT / "research" / "design-review"

# One self-contained expression per stop. Collects candidate rects and
# reports edge overflow + pairwise overlaps. Everything is computed in the
# page so only the (small) defect list crosses the CDP boundary.
AUDIT_JS = r"""
(function () {
  const W = window.innerWidth, H = window.innerHeight;
  const pad = 1;            // sub-pixel tolerance on edge checks
  const minOverlap = 4;     // px on both axes before an overlap "counts"

  function visible(el) {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const op = parseFloat(cs.opacity);
    if (!Number.isNaN(op) && op < 0.05) return false;
    // Inherited opacity: any ancestor faded to ~0 hides this node too
    // (scene overlays park groups at opacity 0 all the time).
    for (let a = el.parentElement; a; a = a.parentElement) {
      const o = parseFloat(getComputedStyle(a).opacity);
      if (!Number.isNaN(o) && o < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    // Off-viewport vertically = not part of this stop's picture.
    if (r.bottom < 0 || r.top > H) return false;
    return true;
  }

  function rect(el) {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top),
             w: Math.round(r.width), h: Math.round(r.height) };
  }

  function label(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.classList && el.classList.length) s += '.' + el.classList[0];
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (t) s += ' "' + t.slice(0, 48) + (t.length > 48 ? '…' : '') + '"';
    return s;
  }

  // ---- Candidate set ----
  const items = [];
  function add(el, kind) {
    if (visible(el)) items.push({ el, kind, r: el.getBoundingClientRect() });
  }
  ['#grain-plate', '#chip', '.skip', '#boot-status'].forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => add(el, 'chrome'));
  });
  document.querySelectorAll('.s14-toggle button').forEach((el) => add(el, 'control'));
  document.querySelectorAll('#rail .card').forEach((el) => add(el, 'card'));
  document.querySelectorAll('#overlay text').forEach((el) => {
    if ((el.textContent || '').trim()) add(el, 'svgtext');
  });

  // ---- 1. Edge overflow ----
  const edge = [];
  for (const it of items) {
    if (it.r.left < -pad) {
      edge.push({ what: label(it.el), kind: it.kind, side: 'left',
                  by: Math.round(-it.r.left), rect: rect(it.el) });
    }
    if (it.r.right > W + pad) {
      edge.push({ what: label(it.el), kind: it.kind, side: 'right',
                  by: Math.round(it.r.right - W), rect: rect(it.el) });
    }
  }

  // Page-level horizontal overflow: the bottom-scrollbar symptom. When
  // present, walk the whole DOM for the culprit elements so the report
  // names them instead of just the symptom.
  const se = document.scrollingElement;
  const pageOverflowPx = Math.max(0, se.scrollWidth - W);
  const culprits = [];
  if (pageOverflowPx > 0) {
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      if (!(el instanceof Element)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right > W + pad || r.left < -pad) {
        // skip elements whose parent already reported (innermost wins)
        culprits.push({ what: label(el),
                        left: Math.round(r.left), right: Math.round(r.right),
                        rect: rect(el) });
        if (culprits.length >= 12) break;
      }
    }
  }

  // ---- 2. Pairwise overlaps ----
  const overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      // svgtext-svgtext pairs matter (annotation collisions) and
      // chrome/card/control vs anything matters; skip pairs where one
      // contains the other in the DOM (parent-child is layout, not
      // collision).
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ix > minOverlap && iy > minOverlap) {
        overlaps.push({ a: label(a.el), aKind: a.kind, b: label(b.el),
                        bKind: b.kind, ix: Math.round(ix), iy: Math.round(iy) });
      }
    }
  }

  return JSON.stringify({
    viewport: { w: W, h: H },
    scrollY: Math.round(se.scrollTop),
    pageOverflowPx,
    overflowCulprits: culprits,
    edge,
    overlaps,
  });
})()
"""


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--viewport", type=str, default=None, metavar="WxH")
    p.add_argument("--mobile", action="store_true")
    p.add_argument("--scenes", type=str, default=None,
                   help="comma-separated scene ids (default: all)")
    return p.parse_args()


def main():
    args = parse_args()
    if args.mobile:
        cw.MOBILE_EMULATION = True
        cw.VIEWPORT_W, cw.VIEWPORT_H = 390, 844
    if args.viewport:
        w, h = args.viewport.lower().split("x")
        cw.VIEWPORT_W, cw.VIEWPORT_H = int(w), int(h)

    http_port = cw.free_port()
    debug_port = cw.free_port()
    server = cw.StaticServer(cw.DOCS_DIR, http_port)
    chrome = cw.Chrome(debug_port)
    stops = []
    try:
        server.start()
        chrome.start()
        chrome.navigate(f"http://127.0.0.1:{http_port}/index.html")

        boot_expr = (
            "!!(window.__rt && window.__rt.engine && window.__rt.scenes && "
            "document.querySelectorAll('#rail section.scene').length===window.__rt.scenes.length)"
        )
        deadline = time.time() + cw.BOOT_TIMEOUT_S
        while time.time() < deadline:
            if chrome.evaluate(boot_expr):
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("boot timeout")

        inner_w, inner_h, down_pct = cw.viewport_and_marker(chrome)
        plan = cw.build_plan(chrome)
        if args.scenes:
            wanted = {s.strip() for s in args.scenes.split(",") if s.strip()}
            plan = [s for s in plan if s["id"] in wanted]

        def audit(tag):
            time.sleep(0.4)  # let transitions/fixed chrome settle
            raw = chrome.evaluate(AUDIT_JS)
            rec = json.loads(raw)
            rec["stop"] = tag
            stops.append(rec)
            n = len(rec["edge"]) + len(rec["overlaps"]) + (1 if rec["pageOverflowPx"] else 0)
            cw.log(f"  {tag}: {n} finding(s)"
                   + (f" [page overflows {rec['pageOverflowPx']}px]" if rec["pageOverflowPx"] else ""))

        # Title stop.
        cw.scroll_to(chrome, 0)
        audit("title")

        for scene in plan:
            for beat in scene["beats"]:
                tag = f"{scene['id']}/{beat['id']}"
                if beat.get("scrub"):
                    for frac in (0.5, 0.9):
                        cw.activate_scrub_fraction(
                            chrome, scene["id"], beat["id"], beat["absTop"],
                            beat["height"], inner_h, frac)
                        audit(f"{tag}@{frac}")
                else:
                    target = beat["absTop"] + inner_h * down_pct
                    cw.activate_step_beat(chrome, scene["id"], beat["id"],
                                          target, [8, 80])
                    time.sleep(1.2)  # settled state
                    audit(tag)

        # End matter: coda top, methods top, absolute bottom.
        for sel, tag in (("#coda", "coda"), ("#methods", "methods")):
            y = chrome.evaluate(
                f"(function(){{const el=document.querySelector('{sel}');"
                "return el ? el.getBoundingClientRect().top + "
                "document.scrollingElement.scrollTop : null})()")
            if y is not None:
                cw.scroll_to(chrome, y)
                audit(tag)
        chrome.evaluate(
            "document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight")
        chrome.evaluate("window.dispatchEvent(new Event('scroll'))")
        audit("bottom")
    finally:
        chrome.stop()
        server.stop()

    out = OUT_DIR / f"layout-audit-{cw.VIEWPORT_W}x{cw.VIEWPORT_H}.json"
    out.write_text(json.dumps(stops, indent=2) + "\n")

    # Worst-first summary.
    flagged = [s for s in stops
               if s["edge"] or s["overlaps"] or s["pageOverflowPx"]]
    print(f"\n=== layout audit {cw.VIEWPORT_W}x{cw.VIEWPORT_H}"
          f"{' (mobile emulation)' if cw.MOBILE_EMULATION else ''} ===")
    print(f"stops audited: {len(stops)}   stops with findings: {len(flagged)}")
    for s in sorted(flagged, key=lambda r: -(len(r['edge']) + len(r['overlaps']))):
        print(f"\n[{s['stop']}] scrollY={s['scrollY']}"
              + (f"  PAGE-OVERFLOW {s['pageOverflowPx']}px" if s["pageOverflowPx"] else ""))
        for c in s["overflowCulprits"]:
            print(f"    culprit: {c['what']}  left={c['left']} right={c['right']}")
        for e in s["edge"]:
            print(f"    edge-{e['side']} by {e['by']}px: {e['what']}")
        for o in s["overlaps"]:
            print(f"    overlap {o['ix']}x{o['iy']}px: [{o['aKind']}] {o['a']}"
                  f"  ×  [{o['bKind']}] {o['b']}")
    print(f"\nfull report: {out}")


if __name__ == "__main__":
    main()
