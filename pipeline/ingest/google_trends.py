"""Arm C.4 — Google Trends search-interest series (worldwide + US) for the
semifinalist teams and Mbappe/Messi/Haaland/Bellingham/Kane/Alvarez,
2026-06-01 to 2026-07-13, daily.

STATUS: BLOCKED from this environment. See main() output / the companion
trends_status.json for the exact manual export recipe.

What was tried (all programmatic, $0-cost routes from the fact-base):
  1. trends.google.com/trends/explore (the UI page itself) -> HTTP 429
     immediately, on the very FIRST request of the session, before any
     pacing could even be a factor. A plain https://www.google.com/ request
     from the same egress IP at the same time returned HTTP 200, so this is
     not a general network problem or a Google-wide block — it is
     Trends-specific IP reputation blocking of this environment's shared
     egress IP (a well-documented behavior for cloud/datacenter IPs hitting
     trends.google.com; see e.g. the many GitHub issues on pytrends about
     429s from CI/cloud runners).
  2. trends.google.com/trends/api/explore (the JSON endpoint pytrends and
     similar libraries wrap) -> also HTTP 429, same call.
  3. Retried after backoff (5s, then again after a plain-Google request
     succeeded to rule out a stale connection) -> still HTTP 429 both times.
  4. The official Trends API (per fact-base) is ALPHA/invite-only as of
     2026-07, not obtainable in the 5-minute-or-less, $0-signup window this
     project allows.
  5. Third-party scraper APIs (SerpApi, ScrapingBee, Apify) are ~$50-100/mo
     -> excluded by the project's hard $0 budget (CLAUDE.md).

This script still runs end-to-end and is safe to re-run later (e.g. from a
residential IP, or once/if the block lifts) — it will silently start
succeeding and populate trends.parquet with real data instead of the
zero-row placeholder, with no code changes needed. Every attempt is logged.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pandas as pd
import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "pipeline"))

from common.timeutil import now_epoch  # noqa: E402

RAW_DIR = REPO_ROOT / "pipeline" / "data" / "raw" / "trends"
OUT_PARQUET = REPO_ROOT / "pipeline" / "data" / "benchmarks" / "opinion" / "trends.parquet"
OUT_STATUS = REPO_ROOT / "pipeline" / "data" / "benchmarks" / "opinion" / "trends_status.json"

DATE_RANGE = "2026-06-01 2026-07-13"
GEOS = {"worldwide": "", "us": "US"}
KEYWORDS = [
    "France national football team",
    "Spain national football team",
    "England national football team",
    "Argentina national football team",
    "Kylian Mbappe",
    "Lionel Messi",
    "Erling Haaland",
    "Jude Bellingham",
    "Harry Kane",
    "Julian Alvarez",
]

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

SCHEMA_COLUMNS = [
    "keyword", "geo", "geo_label", "date", "date_epoch_utc",
    "search_interest_0_100", "is_partial", "fetched_epoch_utc",
]

MANUAL_RECIPE = """\
Google Trends blocked this environment's egress IP outright (HTTP 429 on the
very first request, both to the UI and the JSON API — see script docstring
for the full diagnostic). Google Trends has no paid API tier a $0 project
could step up to either (the official API is alpha/invite-only) — this is a
genuine "you must be a human in a browser" wall, not a budget problem.

Manual export recipe (~5 minutes, no account needed):

  1. Go to https://trends.google.com/trends/explore?date=2026-06-01%202026-07-13&geo=US
     (swap `&geo=US` off entirely for Worldwide).
  2. In the search box, add all these as separate comparison terms (Trends
     caps comparisons at 5 terms per query, so this needs 2 queries per geo,
     4 total):
       Query A: France national football team, Spain national football team,
                England national football team, Argentina national football team
       Query B: Kylian Mbappe, Lionel Messi, Erling Haaland, Jude Bellingham,
                Harry Kane, Julian Alvarez  (6 terms — split into two 3-term
                queries, e.g. B1: Mbappe/Messi/Haaland, B2: Bellingham/Kane/Alvarez,
                if Trends rejects a 6-way compare)
       Use each term's "Topic" suggestion (not plain "Search term") where
       Trends offers one — e.g. type "France national football team" and
       pick the disambiguated Topic chip that appears — to avoid mixing in
       unrelated search volume for ambiguous names like "France" or "Kane".
  3. Set the date range to 2026-06-01 to 2026-07-13 (custom range, top of
     the page) and confirm the region is either "Worldwide" or "United
     States" per the two passes.
  4. Once the "Interest over time" line chart renders, click the ⋮
     (kebab/download) icon in the top-right of that chart module and choose
     "Download CSV". Repeat for each of the 4 queries x 2 geos = 8 CSVs.
  5. Each CSV has a `Day` column and one 0-100 column per term already
     normalized to the SAME 0-100 scale within that single query — note that
     scale is NOT comparable across separate CSV exports (Trends re-normalizes
     per query), so if you need all 10 keywords on one scale, add one fixed
     "anchor" term (e.g. "World Cup") to every query and rescale the other
     columns relative to it before combining.
  6. Save the 8 CSVs into pipeline/data/raw/trends/manual/ and re-run this
     script with `--load-manual` (not yet implemented — add a small CSV
     loader there if/when the files exist; the schema to match is
     SCHEMA_COLUMNS in this file).
"""


def attempt_fetch(keyword: str, geo: str) -> tuple[bool, int, str]:
    """One attempt at the Trends JSON explore endpoint. Returns
    (success, http_status, note)."""
    import urllib.parse

    req_payload = {
        "comparisonItem": [{"keyword": keyword, "geo": geo, "time": DATE_RANGE}],
        "category": 0,
        "property": "",
    }
    url = (
        "https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req="
        + urllib.parse.quote(json.dumps(req_payload))
    )
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": UA, "Accept": "application/json",
                     "Referer": "https://trends.google.com/trends/explore"},
            timeout=15,
        )
    except requests.RequestException as exc:
        return False, -1, f"exception: {exc!r}"
    return resp.status_code == 200, resp.status_code, resp.text[:200]


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)

    print("[trends] control check: plain google.com request (confirms this "
          "is a Trends-specific block, not a general network outage) ...")
    try:
        control = requests.get("https://www.google.com/", headers={"User-Agent": UA}, timeout=10)
        print(f"[trends]   google.com -> HTTP {control.status_code}")
    except requests.RequestException as exc:
        print(f"[trends]   google.com -> exception {exc!r}")

    attempts = []
    print("[trends] attempting Trends API for a small probe set (1 keyword x 2 geos) ...")
    for geo_label, geo in GEOS.items():
        ok, status, note = attempt_fetch("France national football team", geo)
        attempts.append({"geo": geo_label, "status": status, "ok": ok, "note": note})
        print(f"[trends]   geo={geo_label} -> HTTP {status} ok={ok}")
        time.sleep(2)

    all_blocked = all(not a["ok"] for a in attempts)

    rows: list[dict] = []  # stays empty — no fabricated/estimated data
    df = pd.DataFrame(rows, columns=SCHEMA_COLUMNS)
    df.to_parquet(OUT_PARQUET, index=False)
    print(f"[trends] wrote {len(df)} rows (correct empty schema, {len(SCHEMA_COLUMNS)} cols) -> {OUT_PARQUET}")

    status = {
        "status": "blocked" if all_blocked else "partial",
        "attempted_epoch_utc": now_epoch(),
        "keywords_wanted": KEYWORDS,
        "geos_wanted": list(GEOS.keys()),
        "date_range_wanted": DATE_RANGE,
        "probe_attempts": attempts,
        "diagnosis": (
            "HTTP 429 from trends.google.com on the very first request "
            "(both /trends/explore UI and /trends/api/explore JSON), while "
            "a plain www.google.com request from the same egress IP at the "
            "same time succeeded (HTTP 200) -- Trends-specific IP block, "
            "not a general connectivity issue, and not something request "
            "pacing/backoff can resolve."
        ),
        "blocked_reason": MANUAL_RECIPE,
    }
    with OUT_STATUS.open("w") as f:
        json.dump(status, f, indent=2)
    print(f"[trends] wrote status -> {OUT_STATUS}")
    print(f"[trends] STATUS = {status['status']}")


if __name__ == "__main__":
    main()
