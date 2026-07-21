#!/usr/bin/env python3
"""capture_walkthrough.py — headless-Chrome screenshot harness for
"Regulation Time" (docs/).

GOAL (author's directive): clear visuals that a human can read the
narrative from, captured as the piece animates through time, in a series
that tells the story scene by scene.

Approach
--------
1. Serve docs/ on a local port (python http.server subprocess).
2. Launch Chrome headless (--headless=new) with SwiftShader ANGLE so
   WebGL2 renders in software (verified working in this environment —
   see docs/dev/engine-test.html, which this script's boot flags were
   smoke-tested against before being trusted here).
3. Drive the page over the Chrome DevTools Protocol (raw websocket,
   no Selenium/Puppeteer) from pipeline/.venv.
4. Walk EVERY scene/beat in registry order using REAL scroll simulation:
   document.scrollingElement.scrollTop is moved incrementally toward each
   beat's sentinel element (computed from the live DOM + each scene
   module's own beats[], dynamically imported in-page — never via the
   window.__rt.activate() deep-link hook, which is known not to drive
   scrub-scene visuals), scroll events are dispatched, and
   window.__rt.current is polled until it matches the expected
   "sceneId/beatId" key before any capture happens.
5. Per beat: step (non-scrub) beats get three timed frames (t0 / mid /
   settled) off ONE activation; scrub-track beats get three frames at
   25% / 50% / 90% scrub progress (three separate scrollTop targets
   inside the same track, since a scrub beat's activeBeatKey never
   changes mid-track — only its visual state does).
6. Every PNG is guarded (size + not-flat-color) as it's written; the
   first scene's shots gate the whole run — if they fail, something is
   wrong with the GL flags or the boot sequence, so the script stops
   before burning time on the other 17 scenes.

Output: research/design-review/screens/<scene>-<beat>-<frame>.png plus
research/design-review/screens/index.json (written incrementally after
every scene so a crash mid-run still leaves a usable partial record).
"""

import argparse
import base64
import html as html_lib
import json
import os
import re
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import websocket  # websocket-client, pip-installed into pipeline/.venv

# --------------------------------------------------------------------------
# Paths / constants
# --------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = REPO_ROOT / "docs"
OUT_DIR = REPO_ROOT / "research" / "design-review" / "screens"
INDEX_PATH = OUT_DIR / "index.json"
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

VIEWPORT_W = 1440
VIEWPORT_H = 900
# When True, the CDP device-metrics override reports a mobile device and
# touch emulation is enabled, so BOTH of the piece's mobile switches
# engage: main.js's layout branch (window.innerWidth < 900) and its
# engine-tier probe (`(pointer: coarse)` + small viewport -> the mobile
# population tile). Set via --mobile; --viewport alone only changes size,
# which exercises the layout branch but not the tier probe.
MOBILE_EMULATION = False

MIN_PNG_BYTES = 20_000
FLAT_COLOR_FRACTION = 0.99

# Frame timing (ms after a step beat's activation is confirmed).
STEP_FRAMES = [("t0", 0), ("mid", 600), ("settled", 2400)]
SCRUB_FRACTIONS = [("scrub25", 0.25), ("scrub50", 0.50), ("scrub90", 0.90)]

BOOT_TIMEOUT_S = 60
ACTIVATE_TIMEOUT_S = 8
SCRUB_SETTLE_S = 0.9   # time for the 120ms-tau critically-damped scrub lerp
                        # to converge after the target scrollTop is set

SCROLL_STEPS = 6
SCROLL_STEP_DELAY = 0.06


# --------------------------------------------------------------------------
# Small utils
# --------------------------------------------------------------------------

def log(msg):
    print(f"[capture] {msg}", flush=True)


def free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def strip_html(fragment):
    if not fragment:
        return ""
    text = re.sub(r"<[^>]+>", " ", fragment)
    text = html_lib.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# --------------------------------------------------------------------------
# Local static server
# --------------------------------------------------------------------------

class StaticServer:
    def __init__(self, directory, port):
        self.directory = str(directory)
        self.port = port
        self.proc = None

    def start(self):
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(self.port),
             "--directory", self.directory, "--bind", "127.0.0.1"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        deadline = time.time() + 10
        url = f"http://127.0.0.1:{self.port}/index.html"
        while time.time() < deadline:
            try:
                urlopen(url, timeout=1)
                return
            except (URLError, HTTPError):
                time.sleep(0.2)
        raise RuntimeError("static server did not come up in time")

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()


# --------------------------------------------------------------------------
# Headless Chrome + CDP driver
# --------------------------------------------------------------------------

class Chrome:
    """Launches headless Chrome with SwiftShader WebGL and speaks raw CDP
    over its websocket. No selenium/puppeteer — just JSON-RPC frames."""

    def __init__(self, debug_port):
        self.debug_port = debug_port
        self.proc = None
        self.user_data_dir = None
        self.ws = None
        self._id = 0

    def start(self):
        self.user_data_dir = tempfile.mkdtemp(prefix="rt-review-chrome-")
        flags = [
            CHROME_BIN,
            "--headless=new",
            f"--remote-debugging-port={self.debug_port}",
            # CDP websocket handshake is origin-checked in modern Chrome;
            # without this every Runtime.evaluate call 403s at the socket
            # handshake before we ever get to JS.
            "--remote-allow-origins=*",
            # Software WebGL2 path (verified against docs/dev/engine-test.html
            # in this environment): SwiftShader via ANGLE, plus the flag
            # recent Chrome versions require to actually allow it headless.
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            f"--window-size={VIEWPORT_W},{VIEWPORT_H}",
            f"--user-data-dir={self.user_data_dir}",
            "--hide-scrollbars",
            "--disable-extensions",
            "--no-first-run",
            "--no-default-browser-check",
            # headless=new pages have no real window focus; without these,
            # Chrome throttles rAF/timers as if the tab were backgrounded,
            # which would silently stall the engine's tween/scrub loop.
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "about:blank",
        ]
        self.proc = subprocess.Popen(flags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        deadline = time.time() + 20
        last_err = None
        while time.time() < deadline:
            try:
                urlopen(f"http://127.0.0.1:{self.debug_port}/json/version", timeout=1).read()
                break
            except Exception as e:  # noqa: BLE001
                last_err = e
                time.sleep(0.25)
        else:
            raise RuntimeError(f"Chrome DevTools endpoint never came up: {last_err}")

        req = Request(f"http://127.0.0.1:{self.debug_port}/json/new?about:blank", method="PUT")
        target = json.loads(urlopen(req, timeout=5).read())
        self.ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=30)
        self.send("Runtime.enable")
        self.send("Page.enable")
        self.send("Emulation.setDeviceMetricsOverride", {
            "width": VIEWPORT_W, "height": VIEWPORT_H,
            "deviceScaleFactor": 1, "mobile": MOBILE_EMULATION,
        })
        if MOBILE_EMULATION:
            # Touch emulation flips the `(pointer: coarse)` media query,
            # which deviceTier() in main.js requires for the mobile tier.
            self.send("Emulation.setTouchEmulationEnabled",
                      {"enabled": True, "maxTouchPoints": 5})

    def send(self, method, params=None, timeout=60):
        self._id += 1
        msg_id = self._id
        self.ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            self.ws.settimeout(max(0.2, deadline - time.time()))
            try:
                raw = self.ws.recv()
            except websocket.WebSocketTimeoutException:
                continue
            msg = json.loads(raw)
            if msg.get("id") == msg_id:
                if "error" in msg:
                    raise RuntimeError(f"CDP {method} error: {msg['error']}")
                return msg.get("result", {})
            # ignore unrelated events (Page.frameNavigated etc.)
        raise TimeoutError(f"CDP {method} timed out waiting for id={msg_id}")

    def navigate(self, url):
        self.send("Page.navigate", {"url": url})

    def evaluate(self, expression, await_promise=False, timeout_ms=20000):
        result = self.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": await_promise,
            "timeout": timeout_ms,
        }, timeout=(timeout_ms / 1000.0) + 10)
        if result.get("exceptionDetails"):
            raise RuntimeError(f"JS exception: {json.dumps(result['exceptionDetails'])[:2000]}")
        return result.get("result", {}).get("value")

    def screenshot_png_bytes(self):
        result = self.send("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        return base64.b64decode(result["data"])

    def stop(self):
        if self.ws is not None:
            try:
                self.ws.close()
            except Exception:  # noqa: BLE001
                pass
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=5)
            except Exception:  # noqa: BLE001
                try:
                    self.proc.kill()
                except Exception:  # noqa: BLE001
                    pass


# --------------------------------------------------------------------------
# Guard: PNG must be non-trivial
# --------------------------------------------------------------------------

def guard_png(path):
    size = path.stat().st_size
    if size < MIN_PNG_BYTES:
        return False, f"file too small ({size} bytes < {MIN_PNG_BYTES})"
    try:
        from PIL import Image
    except ImportError:
        return True, f"ok by size only ({size} bytes) — Pillow unavailable, skipped flat-color check"
    with Image.open(path) as img:
        thumb = img.convert("RGB").resize((160, 100))
        colors = thumb.getcolors(maxcolors=160 * 100)
    if colors is None:
        return True, f"ok ({size} bytes, >{160*100} distinct colors)"
    colors.sort(reverse=True)
    top_count = colors[0][0]
    frac = top_count / (160 * 100)
    if frac > FLAT_COLOR_FRACTION:
        return False, f"dominant color covers {frac*100:.1f}% of frame ({size} bytes)"
    return True, f"ok ({size} bytes, dominant color {frac*100:.1f}%)"


# --------------------------------------------------------------------------
# Beat plan: dynamically import every scene module IN THE PAGE and read its
# beats[] + the live sentinel element each beat maps to in #rail.
# --------------------------------------------------------------------------

SCAN_JS = r"""
(async () => {
  const ids = window.__rt.scenes;
  const sections = Array.from(document.querySelectorAll('#rail section.scene'));
  const out = [];
  for (let si = 0; si < ids.length; si++) {
    const id = ids[si];
    const m = await import('/js/scenes/' + id + '.js');
    const s = m.default;
    const section = sections[si];
    const children = section ? Array.from(section.children) : [];
    const beats = (s.beats || []).map((b, bi) => {
      const el = children[bi];
      const rect = el ? el.getBoundingClientRect() : null;
      const absTop = rect ? (rect.top + window.scrollY) : null;
      const height = el ? el.offsetHeight : null;
      return {
        id: b.id,
        scrub: !!(b.trigger && b.trigger.type === 'scrub'),
        span: (b.trigger && b.trigger.span) || null,
        html: b.html || '',
        absTop, height,
      };
    });
    out.push({ id: s.id, kicker: s.kicker || s.title || s.id, beats });
  }
  return JSON.stringify(out);
})()
"""

CAPTURE_STATE_JS = r"""
JSON.stringify({
  current: window.__rt.current,
  chip: (document.getElementById('key-rows') || {}).innerText || '',
  grain: (document.getElementById('grain-plate') || {}).innerText || '',
  scrollY: window.scrollY,
})
"""


def build_plan(chrome):
    raw = chrome.evaluate(SCAN_JS, await_promise=True, timeout_ms=30000)
    scenes = json.loads(raw)
    total = sum(len(s["beats"]) for s in scenes)
    log(f"scanned {len(scenes)} scenes / {total} beats from the live scene registry")
    return scenes


def viewport_and_marker(chrome):
    dims = chrome.evaluate("[window.innerWidth, window.innerHeight]")
    inner_w, inner_h = dims
    misc = chrome.evaluate(
        "window.__rt.view && window.__rt.view.tokens "
        "? window.__rt.view.tokens.motion.misc : null"
    )
    down_pct = (misc or {}).get("step-trigger-viewport-pct", 55) / 100.0
    return inner_w, inner_h, down_pct


# --------------------------------------------------------------------------
# Scroll driving
# --------------------------------------------------------------------------

def get_scroll_top(chrome):
    return chrome.evaluate("document.scrollingElement.scrollTop")


def scroll_to(chrome, target_y, steps=SCROLL_STEPS, step_delay=SCROLL_STEP_DELAY):
    """Real scroll simulation: move scrollTop incrementally toward target,
    dispatching a 'scroll' event at each step (main.js listens on window,
    passive), so the driver's own rAF-scheduled computeActive()/driveScrub()
    path runs exactly as it would for a human scrolling — never the
    window.__rt.activate() deep-link shortcut."""
    target_y = max(0, target_y)
    current = get_scroll_top(chrome)
    if steps < 1:
        steps = 1
    for i in range(1, steps + 1):
        y = current + (target_y - current) * (i / steps)
        chrome.evaluate(
            f"document.scrollingElement.scrollTop = {y}; "
            f"window.dispatchEvent(new Event('scroll'));"
        )
        time.sleep(step_delay)
    # Exact final placement + one more dispatch.
    chrome.evaluate(
        f"document.scrollingElement.scrollTop = {target_y}; "
        f"window.dispatchEvent(new Event('scroll'));"
    )


def wait_for_current(chrome, expected_key, timeout_s=ACTIVATE_TIMEOUT_S, poll_interval=0.15):
    deadline = time.time() + timeout_s
    last = None
    while time.time() < deadline:
        last = chrome.evaluate("window.__rt.current")
        if last == expected_key:
            return True, last
        time.sleep(poll_interval)
    return False, last


def activate_step_beat(chrome, scene_id, beat_id, target_y, margin_attempts):
    """Scroll to a non-scrub beat and confirm window.__rt.current matches,
    retrying with a larger past-threshold margin if the first attempt
    doesn't land (guards against any timing race on a slow first paint)."""
    expected = f"{scene_id}/{beat_id}"
    for attempt_margin in margin_attempts:
        scroll_to(chrome, target_y + attempt_margin)
        ok, seen = wait_for_current(chrome, expected)
        if ok:
            return True, seen
        log(f"  retry {expected}: current={seen!r} after margin+{attempt_margin}px")
    return False, seen


def activate_scrub_fraction(chrome, scene_id, beat_id, track_abs_top, track_height,
                             inner_h, fraction):
    expected = f"{scene_id}/{beat_id}"
    total = max(1, track_height - inner_h)
    target_y = track_abs_top + fraction * total
    scroll_to(chrome, target_y)
    ok, seen = wait_for_current(chrome, expected)
    if not ok:
        # one retry, pushed slightly further in case of a hysteresis edge
        scroll_to(chrome, target_y + 40)
        ok, seen = wait_for_current(chrome, expected)
    time.sleep(SCRUB_SETTLE_S)  # let the 120ms-tau scrub lerp converge
    return ok, seen


# --------------------------------------------------------------------------
# Capture
# --------------------------------------------------------------------------

def capture_frame(chrome, out_path):
    png = chrome.screenshot_png_bytes()
    out_path.write_bytes(png)
    ok, detail = guard_png(out_path)
    return ok, detail, len(png)


def read_capture_state(chrome):
    raw = chrome.evaluate(CAPTURE_STATE_JS)
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return {"current": None, "chip": "", "grain": "", "scrollY": None}


# --------------------------------------------------------------------------
# Main walk
# --------------------------------------------------------------------------

def write_index(shots):
    INDEX_PATH.write_text(json.dumps(shots, indent=2) + "\n")


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--limit-scenes", type=int, default=None,
                    help="only walk the first N scenes (smoke-testing the harness itself)")
    p.add_argument("--scenes", type=str, default=None,
                    help="comma-separated scene ids to walk (e.g. s01,s03,s04); "
                         "combine with --keep-existing to re-capture fixed scenes only")
    p.add_argument("--keep-existing", action="store_true",
                    help="don't clear OUT_DIR/index.json before running")
    p.add_argument("--viewport", type=str, default=None, metavar="WxH",
                    help="viewport size override, e.g. 390x844 (default 1440x900)")
    p.add_argument("--mobile", action="store_true",
                    help="emulate a mobile device (touch + mobile device metrics), "
                         "engaging both the layout branch and the engine tier probe; "
                         "implies --viewport 390x844 unless --viewport is given")
    p.add_argument("--out-dir", type=str, default=None,
                    help="write PNGs + index.json to this directory instead of "
                         "research/design-review/screens (use a separate dir for "
                         "mobile captures so the canonical desktop set is never "
                         "clobbered — protocol-v2 lesson)")
    return p.parse_args()


def main():
    global VIEWPORT_W, VIEWPORT_H, MOBILE_EMULATION, OUT_DIR, INDEX_PATH
    args = parse_args()
    if args.mobile:
        MOBILE_EMULATION = True
        VIEWPORT_W, VIEWPORT_H = 390, 844
    if args.viewport:
        try:
            w, h = args.viewport.lower().split("x")
            VIEWPORT_W, VIEWPORT_H = int(w), int(h)
        except ValueError:
            sys.exit(f"bad --viewport {args.viewport!r}; expected WxH like 390x844")
    if args.out_dir:
        # resolve(): the index rows store paths via relative_to(REPO_ROOT),
        # which raises on an already-relative Path.
        OUT_DIR = Path(args.out_dir).resolve()
        INDEX_PATH = OUT_DIR / "index.json"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if not args.keep_existing:
        for p in OUT_DIR.glob("*.png"):
            p.unlink()
        if INDEX_PATH.exists():
            INDEX_PATH.unlink()

    http_port = free_port()
    debug_port = free_port()

    server = StaticServer(DOCS_DIR, http_port)
    chrome = Chrome(debug_port)

    shots = []
    failures = []
    # --keep-existing kept the PNGs but write_index() then rewrote index.json
    # from this empty list, silently dropping every other scene's rows (bitten
    # in the Gate-5 fix round: an s08-only re-capture emptied s09-s14 from the
    # index while their PNGs sat on disk). Seed from the existing index, minus
    # the scenes this run will re-shoot, so a partial run merges instead of
    # truncating.
    if args.keep_existing and INDEX_PATH.exists():
        recapturing = ({s.strip() for s in args.scenes.split(",") if s.strip()}
                       if args.scenes else None)
        try:
            prior = json.loads(INDEX_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            prior = []
        if isinstance(prior, list) and recapturing is not None:
            # Only merge for a --scenes partial run; a full keep-existing walk
            # re-shoots everything, so prior rows would just duplicate.
            shots = [row for row in prior
                     if row.get("scene") not in recapturing]
            log(f"--keep-existing: carried {len(shots)} prior index rows forward")

    def cleanup():
        chrome.stop()
        server.stop()

    try:
        log(f"serving {DOCS_DIR} on http://127.0.0.1:{http_port}")
        server.start()

        log(f"launching headless Chrome (SwiftShader, port {debug_port})")
        chrome.start()

        target_url = f"http://127.0.0.1:{http_port}/index.html"
        log(f"navigating to {target_url}")
        chrome.navigate(target_url)

        # PHASE 6 FIX (v2 epilogue, s19 added between s17/s18): this gate was
        # hardcoded to the v1 scene count (18) and never became true once the
        # registry grew to 19, blocking every capture run including scenes
        # that hadn't changed. Compare against window.__rt.scenes.length (the
        # live registry, main.js's own debug hook) instead of a literal, so
        # this gate tracks whatever main.js's SCENES array actually contains
        # rather than needing a hand-edit at every future scene count change.
        log("waiting for boot: window.__rt.engine + one <section> per registered scene ...")
        boot_expr = (
            "!!(window.__rt && window.__rt.engine && window.__rt.scenes && "
            "document.querySelectorAll('#rail section.scene').length===window.__rt.scenes.length)"
        )
        deadline = time.time() + BOOT_TIMEOUT_S
        booted = False
        while time.time() < deadline:
            if chrome.evaluate(boot_expr):
                booted = True
                break
            time.sleep(0.5)
        if not booted:
            raise RuntimeError(
                f"boot condition never became true within {BOOT_TIMEOUT_S}s "
                "(window.__rt.engine + one <section> per registered scene)"
            )
        pop_count = chrome.evaluate(
            "window.__rt.data.pop ? window.__rt.data.pop.count : null"
        )
        tier = chrome.evaluate("window.__rt.tier")
        log(f"booted: tier={tier} population={pop_count}")

        inner_w, inner_h, down_pct = viewport_and_marker(chrome)
        marker_down_px = inner_h * down_pct
        log(f"viewport {inner_w}x{inner_h}, step-trigger marker at {down_pct*100:.0f}% "
            f"= {marker_down_px:.0f}px")

        plan = build_plan(chrome)
        if args.limit_scenes:
            plan = plan[: args.limit_scenes]
            log(f"--limit-scenes set: walking only {len(plan)} scene(s)")
        if args.scenes:
            wanted = {s.strip() for s in args.scenes.split(",") if s.strip()}
            plan = [s for s in plan if s["id"] in wanted]
            missing = wanted - {s["id"] for s in plan}
            if missing:
                log(f"--scenes: WARNING, unknown scene id(s) ignored: {sorted(missing)}")
            log(f"--scenes set: walking {[s['id'] for s in plan]}")

        first_scene_gate_passed = None

        for si, scene in enumerate(plan):
            scene_id = scene["id"]
            scene_shots = []
            log(f"--- {scene_id} ({len(scene['beats'])} beat(s)) ---")

            for beat in scene["beats"]:
                beat_id = beat["id"]
                key = f"{scene_id}/{beat_id}"
                abs_top = beat["absTop"]
                height = beat["height"]
                if abs_top is None or height is None:
                    failures.append(f"{key}: no sentinel element found in DOM scan")
                    log(f"  {key}: SKIP — no sentinel element in DOM scan")
                    continue

                prose_text = strip_html(beat["html"])

                if beat["scrub"]:
                    for frame_label, fraction in SCRUB_FRACTIONS:
                        ok, seen = activate_scrub_fraction(
                            chrome, scene_id, beat_id, abs_top, height, inner_h, fraction,
                        )
                        if not ok:
                            msg = f"{key} [{frame_label}]: current={seen!r}, expected {key}"
                            failures.append(msg)
                            log(f"  FAIL activate: {msg}")
                            continue
                        state = read_capture_state(chrome)
                        fname = f"{scene_id}-{beat_id}-{frame_label}.png"
                        fpath = OUT_DIR / fname
                        guard_ok, guard_detail, nbytes = capture_frame(chrome, fpath)
                        entry = {
                            "scene": scene_id,
                            "beat": beat_id,
                            "frame": frame_label,
                            "file": str(fpath.relative_to(REPO_ROOT)),
                            "beat_prose_text": prose_text,
                            "chip_or_key_text": state.get("chip", ""),
                            "grain_plate_text": state.get("grain", ""),
                            "scrub_fraction": fraction,
                            "bytes": nbytes,
                            "guard_ok": guard_ok,
                            "guard_detail": guard_detail,
                        }
                        scene_shots.append(entry)
                        shots.append(entry)
                        status = "ok" if guard_ok else "GUARD-FAIL"
                        log(f"  {fname}: {status} ({guard_detail})")
                        if not guard_ok:
                            failures.append(f"{fname}: guard failed — {guard_detail}")
                else:
                    margin_attempts = [40, 120, 260, 500]
                    activated, seen = activate_step_beat(
                        chrome, scene_id, beat_id,
                        abs_top - marker_down_px, margin_attempts,
                    )
                    if not activated:
                        msg = f"{key}: could not activate (current={seen!r})"
                        failures.append(msg)
                        log(f"  FAIL activate: {msg}")
                        continue
                    t_activate = time.time()
                    for frame_label, offset_ms in STEP_FRAMES:
                        target_t = t_activate + offset_ms / 1000.0
                        now = time.time()
                        if target_t > now:
                            time.sleep(target_t - now)
                        state = read_capture_state(chrome)
                        fname = f"{scene_id}-{beat_id}-{frame_label}.png"
                        fpath = OUT_DIR / fname
                        guard_ok, guard_detail, nbytes = capture_frame(chrome, fpath)
                        entry = {
                            "scene": scene_id,
                            "beat": beat_id,
                            "frame": frame_label,
                            "file": str(fpath.relative_to(REPO_ROOT)),
                            "beat_prose_text": prose_text,
                            "chip_or_key_text": state.get("chip", ""),
                            "grain_plate_text": state.get("grain", ""),
                            "offset_ms": offset_ms,
                            "bytes": nbytes,
                            "guard_ok": guard_ok,
                            "guard_detail": guard_detail,
                        }
                        scene_shots.append(entry)
                        shots.append(entry)
                        status = "ok" if guard_ok else "GUARD-FAIL"
                        log(f"  {fname}: {status} ({guard_detail})")
                        if not guard_ok:
                            failures.append(f"{fname}: guard failed — {guard_detail}")

            write_index(shots)  # incremental checkpoint after every scene

            if si == 0:
                bad = [s for s in scene_shots if not s["guard_ok"]]
                first_scene_gate_passed = len(bad) == 0 and len(scene_shots) > 0
                if not first_scene_gate_passed:
                    log("!!! GATE FAILED: scene s01's captures did not pass the guard. "
                        "Stopping before burning time on the remaining 17 scenes — "
                        "this points at the GL flags / boot sequence, not scene s02+.")
                    failures.append(
                        "GATE: s01 capture guard failed — stopped after scene 1 to debug "
                        "GL flags before proceeding (per harness spec)."
                    )
                    break

        write_index(shots)

    finally:
        cleanup()

    n_ok = sum(1 for s in shots if s["guard_ok"])
    n_total = len(shots)
    log(f"done: {n_ok}/{n_total} shots passed the guard, {len(failures)} failure(s) recorded")
    log(f"index: {INDEX_PATH}")

    return shots, failures


if __name__ == "__main__":
    shots, failures = main()
    print(json.dumps({
        "shots_captured": len(shots),
        "shots_guard_ok": sum(1 for s in shots if s["guard_ok"]),
        "index_path": str(INDEX_PATH),
        "failures": failures,
    }, indent=2))
    sys.exit(0 if not failures else 1)
