"""Polite HTTP fetch helper shared by all ingest scripts.

Design goals (see project CLAUDE.md):
  - <=5 requests/sec to any single host (token-bucket style min-interval sleep,
    keyed per-host so unrelated hosts don't wait on each other).
  - Real browser User-Agent (some sources — eloratings.net, YouGov — vary
    behavior for bare `python-requests` UAs).
  - Every fetch is cached to disk under pipeline/data/raw/... so re-running a
    script is cheap and the exact bytes we parsed are auditable. Raw cache
    stays out of git (see .gitignore: pipeline/data/).
  - Small retry/backoff on 429/5xx, but NOT infinite — a source that keeps
    429ing (e.g. Google Trends from this environment's egress IP) should fail
    fast and let the caller record status='blocked' rather than hammering it.
"""
from __future__ import annotations

import hashlib
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

MIN_INTERVAL_SEC = 0.25  # >=4 req/s ceiling per host, comfortably under the 5/s budget

_last_request_at: dict[str, float] = {}


def _throttle(host: str) -> None:
    last = _last_request_at.get(host)
    now = time.monotonic()
    if last is not None:
        wait = MIN_INTERVAL_SEC - (now - last)
        if wait > 0:
            time.sleep(wait)
    _last_request_at[host] = time.monotonic()


def polite_get(
    url: str,
    *,
    cache_path: Path | None = None,
    headers: dict | None = None,
    max_retries: int = 3,
    timeout: int = 30,
    force: bool = False,
) -> requests.Response | None:
    """GET a URL with host-level rate limiting, UA spoofing, and disk caching.

    Returns the Response on success (2xx), or None if all retries were
    exhausted on a non-2xx status (caller decides how to record the gap).
    If cache_path exists and force=False, skips the network entirely and
    returns a lightweight Response-like object backed by the cached bytes.
    """
    if cache_path is not None and cache_path.exists() and not force:
        resp = requests.Response()
        resp.status_code = 200
        resp._content = cache_path.read_bytes()
        resp.url = url
        return resp

    host = urlparse(url).netloc
    req_headers = {"User-Agent": DEFAULT_UA, "Accept-Language": "en-US,en;q=0.9"}
    if headers:
        req_headers.update(headers)

    last_resp = None
    for attempt in range(max_retries):
        _throttle(host)
        try:
            resp = requests.get(url, headers=req_headers, timeout=timeout)
        except requests.RequestException as exc:
            print(f"  [http] {url} -> exception {exc!r} (attempt {attempt + 1}/{max_retries})")
            time.sleep(2 * (attempt + 1))
            continue
        last_resp = resp
        if resp.status_code == 200:
            if cache_path is not None:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_bytes(resp.content)
            return resp
        if resp.status_code == 429:
            print(f"  [http] {url} -> 429 (attempt {attempt + 1}/{max_retries})")
            time.sleep(3 * (attempt + 1))
            continue
        if 500 <= resp.status_code < 600:
            print(f"  [http] {url} -> {resp.status_code} (attempt {attempt + 1}/{max_retries})")
            time.sleep(2 * (attempt + 1))
            continue
        # 4xx other than 429: not retryable
        print(f"  [http] {url} -> {resp.status_code}, not retrying")
        return None

    print(f"  [http] {url} -> giving up after {max_retries} attempts (last status "
          f"{last_resp.status_code if last_resp is not None else 'n/a'})")
    return None


def cache_key(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
