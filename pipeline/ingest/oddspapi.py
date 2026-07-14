"""Pinnacle (+ backup books) full WC26 price history via OddsPapi.

STATUS AS WRITTEN: NOT YET RUN AGAINST LIVE DATA.

OddsPapi (oddspapi.io) is real, free, and reachable -- verified 2026-07-13 by
reading its live docs (oddspapi.io/us/docs*) and free-tier page:
    - Free tier: no credit card, 250 billable requests/month, ALL 350+
      bookmakers (Pinnacle included) and 69 sports unlocked.
    - Crucially: GET /v4/historical-odds -- the exact endpoint this script
      needs -- is UNMETERED ("always free, calls never increment your
      request count"; see oddspapi.io/us/docs/requests-and-quota). Its own
      cooldown is 5000ms/call regardless of plan. So the 250/month cap only
      constrains the bookkeeping calls (tournaments/fixtures/markets), not
      the actual history pull -- this script uses ~3-4 of those, total.
    - GET /v4/historical-odds?fixtureId=...&bookmakers=<up to 3 slugs> ->
      decimal odds, one entry per price CHANGE with an ISO createdAt, since
      January 2026 (matches research/fact-base.json).

The one hard requirement is an API key, and the ONLY way to get one is to
create an account (email + password at https://oddspapi.io/us/sign-up).
Account creation is on this project's prohibited-actions list regardless of
cost -- no agent session may do it. So this arm is BLOCKED pending a human
completing that ~2-minute, no-card sign-up. See the "oddspapi" entry under
research/fact-base.json -> benchmarks.odds_sources for the full writeup
(auth mechanics, quota mechanics, verified endpoint contracts) and exact
unblock steps.

This script is written and smoke-tested against the *documented* response
shape (see `_SAMPLE_HISTORICAL_ODDS_RESPONSE` / `_smoke_test_parse()` at the
bottom -- run with `python oddspapi.py --smoke-test`, needs no API key) so
that once a human exports ODDSPAPI_API_KEY, running this file should just
work. Do a `--fixtures-limit 2` smoke run against the live API first anyway
before trusting a full ~100+-fixture pull -- the response shape has only
been verified against docs examples, not a live call.

Usage (once ODDSPAPI_API_KEY is set):
    .venv/bin/python pipeline/ingest/oddspapi.py --fixtures-limit 2   # smoke
    .venv/bin/python pipeline/ingest/oddspapi.py                      # full pull + consolidate
    .venv/bin/python pipeline/ingest/oddspapi.py --consolidate-only   # re-consolidate raw/ into parquet
    .venv/bin/python pipeline/ingest/oddspapi.py --smoke-test         # offline parser self-test, no key/network needed

Output: pipeline/data/benchmarks/odds/pinnacle.parquet (long format, raw +
de-vigged implied probabilities; despite the filename it carries whichever
--bookmakers were pulled, Pinnacle plus up to 2 backups per the brief).
Raw per-fixture JSON checkpoints live in
pipeline/data/benchmarks/odds/_raw/oddspapi/ (gitignored-scale, not meant
for commit) so a killed/resumed run skips fixtures already fetched.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
import requests

logger = logging.getLogger("oddspapi")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

HOST = "https://api.oddspapi.io"
USER_AGENT = (
    "fifaworldcup2026-research-pipeline/0.1 "
    "(data-journalism, free-tier, contact kushal.lyndon.dsouza@gmail.com)"
)

DATA_ROOT = Path(__file__).resolve().parents[1] / "data" / "benchmarks" / "odds"
RAW_DIR = DATA_ROOT / "_raw" / "oddspapi"
OUTPUT_PATH = DATA_ROOT / "pinnacle.parquet"
FIXTURES_MANIFEST = RAW_DIR / "_fixtures_manifest.json"
MARKETS_LOOKUP_PATH = RAW_DIR / "_markets_lookup.json"

DEFAULT_SPORT_ID = 10  # soccer, per oddspapi.io/us/docs worked examples
DEFAULT_BOOKMAKERS = ["pinnacle", "bet365", "betmgm"]  # Pinnacle + 2 widely-covered backups; max 3/request
# WC26 group stage (Jun 11) through the second semifinal (Jul 15), per
# research/fact-base.json tournament.remaining_schedule. Adjust with
# --cutoff-date to also pull 3rd-place/final once played.
DEFAULT_CUTOFF_DATE = "2026-07-16"

# Endpoint cooldowns as documented (ms -> s). Unlisted endpoints default to
# the conservative 5s historical-odds cooldown.
ENDPOINT_COOLDOWN_S = {
    "/v4/historical-odds": 5.0,  # documented, and this is the hot loop
    "/v4/fixtures": 2.0,  # documented
    "/v4/tournaments": 3.0,  # not documented in the pages we could read; conservative default
    "/v4/markets": 3.0,
    "/v4/account": 1.0,
}
DEFAULT_COOLDOWN_S = 5.0


class OddsPapiError(RuntimeError):
    pass


class OddsPapiClient:
    """Small, polite, retrying REST client for OddsPapi v4.

    Auth is a query parameter (apiKey), not a header -- the docs call this
    out explicitly as a common gotcha. Rate limiting is per-endpoint-path,
    tracked with a monotonic clock, independent of and *more* conservative
    than the documented per-endpoint cooldowns would strictly require.
    """

    def __init__(self, api_key: str, max_retries: int = 5, timeout: float = 30.0) -> None:
        self.api_key = api_key
        self.max_retries = max_retries
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
        self._last_call_at: dict[str, float] = {}
        self.request_count = 0

    def _throttle(self, path: str) -> None:
        cooldown = ENDPOINT_COOLDOWN_S.get(path, DEFAULT_COOLDOWN_S)
        last = self._last_call_at.get(path)
        if last is None:
            return
        remaining = cooldown - (time.monotonic() - last)
        if remaining > 0:
            time.sleep(remaining)

    def get(self, path: str, params: dict[str, Any] | None = None, etag: str | None = None) -> tuple[int, Any, str | None]:
        """Returns (status_code, parsed_json_or_None, response_etag_or_None)."""
        self._throttle(path)
        url = f"{HOST}{path}"
        query = dict(params or {})
        query["apiKey"] = self.api_key
        headers = {}
        if etag:
            headers["If-None-Match"] = etag

        last_exc: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                self._last_call_at[path] = time.monotonic()
                resp = self._session.get(url, params=query, headers=headers, timeout=self.timeout)
                self.request_count += 1
            except (requests.ConnectionError, requests.Timeout) as exc:
                last_exc = exc
                logger.warning("connection error on %s: %s (attempt %d/%d)", path, exc, attempt + 1, self.max_retries)
                if attempt < self.max_retries:
                    time.sleep(min(30.0, 2.0 * (2**attempt)))
                    continue
                raise OddsPapiError(f"GET {path} failed after retries: {exc}") from exc

            if resp.status_code == 304:
                return 304, None, resp.headers.get("ETag")
            if resp.status_code == 200:
                return 200, resp.json(), resp.headers.get("ETag")
            if resp.status_code == 429 or resp.status_code >= 500:
                logger.warning("HTTP %d on %s (attempt %d/%d)", resp.status_code, path, attempt + 1, self.max_retries)
                if attempt < self.max_retries:
                    retry_after = resp.headers.get("Retry-After")
                    delay = float(retry_after) if retry_after else min(30.0, 2.0 * (2**attempt))
                    time.sleep(delay)
                    continue
                raise OddsPapiError(f"GET {path} kept returning {resp.status_code} after retries")
            # Non-retryable 4xx (401 bad key, 429 handled above, etc).
            raise OddsPapiError(f"GET {path} -> HTTP {resp.status_code}: {resp.text[:500]}")

        raise OddsPapiError(f"GET {path} failed: {last_exc}")

    # -- endpoint wrappers -------------------------------------------------
    def get_tournaments(self, sport_id: int) -> list[dict]:
        _, body, _ = self.get("/v4/tournaments", {"sportId": sport_id})
        return body or []

    def get_fixtures(self, tournament_id: int) -> list[dict]:
        _, body, _ = self.get("/v4/fixtures", {"tournamentId": tournament_id})
        return body or []

    def get_markets(self) -> list[dict]:
        _, body, _ = self.get("/v4/markets")
        return body or []

    def get_historical_odds(self, fixture_id: str, bookmakers: list[str], etag: str | None = None) -> tuple[int, Any, str | None]:
        bookmakers = bookmakers[:3]  # API hard limit
        return self.get("/v4/historical-odds", {"fixtureId": fixture_id, "bookmakers": ",".join(bookmakers)}, etag=etag)


# --------------------------------------------------------------------------
# Discovery
# --------------------------------------------------------------------------
def find_wc26_tournament_id(client: OddsPapiClient, sport_id: int, slug_hint: str = "world-cup") -> dict:
    tournaments = client.get_tournaments(sport_id)
    candidates = [
        t for t in tournaments
        if slug_hint in (t.get("tournamentSlug") or "").lower()
        or "world cup" in (t.get("tournamentName") or "").lower()
    ]
    if not candidates:
        raise OddsPapiError(
            f"no tournament matching slug hint {slug_hint!r} found among {len(tournaments)} sportId={sport_id} tournaments. "
            "Inspect the raw list (client.get_tournaments) and pass --tournament-id explicitly."
        )
    if len(candidates) > 1:
        logger.warning(
            "multiple tournament matches for %r: %s -- using the first. Pass --tournament-id to disambiguate.",
            slug_hint,
            [(t["tournamentId"], t.get("tournamentName")) for t in candidates],
        )
    return candidates[0]


def load_or_fetch_fixtures(client: OddsPapiClient, tournament_id: int, refresh: bool = False) -> list[dict]:
    if FIXTURES_MANIFEST.exists() and not refresh:
        logger.info("reusing cached fixtures manifest %s (pass --refresh-fixtures to re-pull)", FIXTURES_MANIFEST)
        return json.loads(FIXTURES_MANIFEST.read_text())
    fixtures = client.get_fixtures(tournament_id)
    FIXTURES_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    FIXTURES_MANIFEST.write_text(json.dumps(fixtures, indent=2))
    logger.info("fetched %d fixtures for tournamentId=%d, cached -> %s", len(fixtures), tournament_id, FIXTURES_MANIFEST)
    return fixtures


def load_or_fetch_markets_lookup(client: OddsPapiClient, refresh: bool = False) -> dict[str, str]:
    if MARKETS_LOOKUP_PATH.exists() and not refresh:
        return json.loads(MARKETS_LOOKUP_PATH.read_text())
    try:
        markets = client.get_markets()
    except OddsPapiError as exc:
        logger.warning("could not fetch /v4/markets lookup (%s); market_name column will be null", exc)
        return {}
    # Response shape for GET markets isn't in the docs pages we could read;
    # be defensive about key names.
    lookup: dict[str, str] = {}
    for m in markets:
        mid = m.get("marketId") or m.get("id")
        name = m.get("marketName") or m.get("name")
        if mid is not None and name:
            lookup[str(mid)] = name
    MARKETS_LOOKUP_PATH.parent.mkdir(parents=True, exist_ok=True)
    MARKETS_LOOKUP_PATH.write_text(json.dumps(lookup, indent=2))
    return lookup


def filter_fixtures_through_date(fixtures: list[dict], cutoff_date: str) -> list[dict]:
    cutoff = dt.datetime.fromisoformat(cutoff_date).replace(tzinfo=dt.timezone.utc)
    out = []
    for f in fixtures:
        start = f.get("startTime")
        if not start:
            continue
        start_dt = dt.datetime.fromisoformat(start.replace("Z", "+00:00"))
        if start_dt <= cutoff:
            out.append(f)
    return out


# --------------------------------------------------------------------------
# Pull loop (checkpointed / resumable)
# --------------------------------------------------------------------------
def pull_all_fixtures(
    client: OddsPapiClient,
    fixtures: list[dict],
    bookmakers: list[str],
    limit: int | None = None,
    refresh: bool = False,
) -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    todo = fixtures[:limit] if limit else fixtures
    n_done = 0
    n_skipped = 0
    for i, fx in enumerate(todo, start=1):
        fixture_id = fx["fixtureId"]
        raw_path = RAW_DIR / f"{fixture_id}.json"
        if raw_path.exists() and not refresh:
            n_skipped += 1
            continue
        status, body, etag = client.get_historical_odds(fixture_id, bookmakers)
        if status == 304:
            logger.info("[%d/%d] %s: 304 not modified, cached copy already up to date", i, len(todo), fixture_id)
            continue
        record = {
            "fixture_meta": fx,
            "bookmakers_requested": bookmakers,
            "fetched_at_utc_epoch_seconds": int(time.time()),
            "etag": etag,
            "response": body,
        }
        raw_path.write_text(json.dumps(record))
        n_done += 1
        logger.info(
            "[%d/%d] %s (%s vs %s, %s): fetched, %d bookmaker(s) in response",
            i, len(todo), fixture_id,
            fx.get("participant1Name"), fx.get("participant2Name"), fx.get("startTime"),
            len(((body or {}).get("bookmakers")) or {}),
        )
    logger.info("pull complete: %d fetched, %d already cached/skipped, %d total", n_done, n_skipped, len(todo))


# --------------------------------------------------------------------------
# Parse + de-vig
# --------------------------------------------------------------------------
def _iter_price_points(response_body: dict, fixture_id: str, fixture_meta: dict) -> Iterable[dict]:
    """Flatten one historical-odds response into price-point rows.

    Response shape (verified against oddspapi.io/us/docs/get-historical-odds):
        {"fixtureId": ..., "bookmakers": {slug: {"markets": {market_id: {
            "outcomes": {outcome_id: {"players": {player_id: [
                {"createdAt": iso, "price": decimal, "limit": float,
                 "active": bool, "exchangeMeta": obj|null}, ...]}}}}}}}
    """
    bookmakers = (response_body or {}).get("bookmakers") or {}
    for bookmaker, bdata in bookmakers.items():
        markets = (bdata or {}).get("markets") or {}
        for market_id, mdata in markets.items():
            outcomes = (mdata or {}).get("outcomes") or {}
            for outcome_id, odata in outcomes.items():
                players = (odata or {}).get("players") or {}
                for player_id, points in players.items():
                    for point in points or []:
                        yield {
                            "fixture_id": fixture_id,
                            "participant1": fixture_meta.get("participant1Name"),
                            "participant2": fixture_meta.get("participant2Name"),
                            "fixture_start_time": fixture_meta.get("startTime"),
                            "tournament_id": fixture_meta.get("tournamentId"),
                            "bookmaker": bookmaker,
                            "market_id": str(market_id),
                            "outcome_id": str(outcome_id),
                            "player_id": str(player_id),
                            "created_at": point.get("createdAt"),
                            "price_decimal": point.get("price"),
                            "limit": point.get("limit"),
                            "active": point.get("active"),
                        }


def _created_at_to_epoch(created_at: str | None) -> int | None:
    if not created_at:
        return None
    d = dt.datetime.fromisoformat(created_at)
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return int(d.timestamp())


def _devig_wide(group: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    """Build the forward-filled wide panel + overround + de-vigged panel for
    one (fixture_id, bookmaker, market_id) group.

    Odds move asynchronously per outcome (e.g. the home price ticks without
    the draw/away prices changing at the same instant). To de-vig honestly
    we reconstruct, at the union of every price-change timestamp across all
    outcomes, the best-known ACTIVE price of every outcome at that instant
    (forward-fill), then compute the overround = sum(1/price) across
    outcomes across that full simultaneous state and strip it
    proportionally. This is standard practice for de-vigging asynchronous
    tick-level odds feeds -- naive same-row de-vig would implicitly assume
    outcomes update in lockstep, which they don't.

    Returns (wide_prices, overround_series, devigged_wide) all indexed by
    epoch_utc_seconds, columns = outcome_id. `devigged_wide.iloc[-1]` sums
    to 1.0 across outcomes that were active at the final known timestamp
    (see _smoke_test_parse for a worked check).
    """
    wide = group.pivot_table(
        index="epoch_utc_seconds", columns="outcome_id", values="price_decimal", aggfunc="last"
    ).sort_index()
    active_wide = group.pivot_table(
        index="epoch_utc_seconds", columns="outcome_id", values="active", aggfunc="last"
    ).sort_index()
    wide = wide.ffill()
    active_wide = active_wide.ffill().fillna(False).astype(bool)

    implied = 1.0 / wide
    implied = implied.where(active_wide)  # only count currently-active outcomes toward overround
    overround = implied.sum(axis=1)
    devigged = implied.div(overround, axis=0)
    return wide, overround, devigged


def devig_group(group: pd.DataFrame) -> pd.DataFrame:
    """De-vig one (fixture_id, bookmaker, market_id) group; see _devig_wide.

    Each output row keeps the raw price-point's OWN timestamp and reports
    the de-vigged probability using the full-market state (all outcomes,
    forward-filled) as of that same timestamp -- i.e. "what did this price
    change imply about this outcome's probability, given what was known
    about the other outcomes at that instant". Because different outcomes
    update at different times, rows for different outcome_ids at their
    respective *own* last timestamps will NOT generally sum to 1.0 (they're
    snapshotting the market at different instants) -- to compare outcomes
    at one common instant, use _devig_wide directly and read one row of the
    wide devigged panel.
    """
    wide, overround, devigged = _devig_wide(group)

    out = group.copy()
    out["overround_at_ts"] = out["epoch_utc_seconds"].map(overround)
    out["implied_prob_raw"] = 1.0 / out["price_decimal"]
    out["implied_prob_devigged"] = out.apply(
        lambda r: devigged.at[r["epoch_utc_seconds"], r["outcome_id"]]
        if r["outcome_id"] in devigged.columns and r["epoch_utc_seconds"] in devigged.index
        else None,
        axis=1,
    )
    return out


def consolidate_to_parquet(markets_lookup: dict[str, str] | None = None) -> pd.DataFrame:
    raw_files = sorted(RAW_DIR.glob("*.json"))
    raw_files = [p for p in raw_files if not p.name.startswith("_")]
    if not raw_files:
        raise OddsPapiError(f"no raw fixture files found under {RAW_DIR} -- run a pull first")

    rows: list[dict] = []
    for p in raw_files:
        record = json.loads(p.read_text())
        fixture_meta = record["fixture_meta"]
        fixture_id = fixture_meta["fixtureId"]
        rows.extend(_iter_price_points(record["response"], fixture_id, fixture_meta))

    if not rows:
        raise OddsPapiError("parsed 0 price points from raw files -- check response shape / _iter_price_points")

    df = pd.DataFrame.from_records(rows)
    df["epoch_utc_seconds"] = df["created_at"].map(_created_at_to_epoch)
    df["pulled_at_utc_epoch_seconds"] = int(time.time())

    if markets_lookup:
        df["market_name"] = df["market_id"].map(markets_lookup)
    else:
        df["market_name"] = None

    parts = []
    for _, group in df.groupby(["fixture_id", "bookmaker", "market_id"], sort=False):
        parts.append(devig_group(group))
    out = pd.concat(parts, ignore_index=True)

    out = out.sort_values(["fixture_id", "bookmaker", "market_id", "outcome_id", "epoch_utc_seconds"]).reset_index(drop=True)

    # Structural sanity check: the docs' own historical-odds example shows
    # exactly ONE outcome_id per market_id (e.g. market "101" -> outcomes
    # {"101": [...]}), which would make de-vigging a no-op (nothing to
    # strip vig against). The live odds-by-tournaments example shows the
    # opposite -- one market_id ("101" moneyline) containing THREE outcomes
    # (home/draw/away) -- which is what devig_group needs to do anything
    # useful. We can't tell which shape historical-odds actually has until
    # a real key exists, so this is a loud, unmissable self-report on the
    # first live run rather than a silent wrong answer.
    outcomes_per_market = out.groupby(["fixture_id", "bookmaker", "market_id"])["outcome_id"].nunique()
    avg_outcomes = float(outcomes_per_market.mean())
    if avg_outcomes < 1.5:
        logger.warning(
            "avg outcomes per (fixture,bookmaker,market_id) = %.2f (looks like ~1) -- "
            "de-vigging is likely a no-op because outcomes are NOT nested together under one "
            "market_id in this response. If so, group by a different key (e.g. strip a "
            "home/draw/away suffix from market_id, or use bookmakerMarketId if present) before "
            "trusting implied_prob_devigged. Inspect one raw file under %s to confirm.",
            avg_outcomes, RAW_DIR,
        )
    else:
        logger.info("avg outcomes per (fixture,bookmaker,market_id) = %.2f -- de-vig grouping looks sane", avg_outcomes)

    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    out.to_parquet(OUTPUT_PATH, index=False)
    logger.info("wrote %d price-point rows across %d fixtures -> %s", len(out), out["fixture_id"].nunique(), OUTPUT_PATH)
    return out


# --------------------------------------------------------------------------
# Offline smoke test (no network, no API key) -- validates the parse/de-vig
# logic against a hand-built response matching the documented schema.
# --------------------------------------------------------------------------
_SAMPLE_HISTORICAL_ODDS_RESPONSE = {
    "fixtureId": "id_smoke_test",
    "bookmakers": {
        "pinnacle": {
            "markets": {
                "101": {
                    "outcomes": {
                        "101": {"players": {"0": [
                            {"createdAt": "2026-06-10T10:00:00+00:00", "price": 2.20, "limit": 1000, "active": True, "exchangeMeta": None},
                            {"createdAt": "2026-06-11T09:00:00+00:00", "price": 2.05, "limit": 1000, "active": True, "exchangeMeta": None},
                        ]}},
                        "102": {"players": {"0": [
                            {"createdAt": "2026-06-10T10:00:00+00:00", "price": 3.40, "limit": 1000, "active": True, "exchangeMeta": None},
                        ]}},
                        "103": {"players": {"0": [
                            {"createdAt": "2026-06-10T10:00:00+00:00", "price": 3.60, "limit": 1000, "active": True, "exchangeMeta": None},
                            {"createdAt": "2026-06-11T09:30:00+00:00", "price": 3.80, "limit": 1000, "active": True, "exchangeMeta": None},
                        ]}},
                    }
                }
            }
        }
    },
}


def _smoke_test_parse() -> None:
    fixture_meta = {
        "fixtureId": "id_smoke_test",
        "participant1Name": "Home FC",
        "participant2Name": "Away FC",
        "startTime": "2026-06-12T19:00:00.000Z",
        "tournamentId": 999,
    }
    rows = list(_iter_price_points(_SAMPLE_HISTORICAL_ODDS_RESPONSE, "id_smoke_test", fixture_meta))
    assert len(rows) == 5, f"expected 5 price points, got {len(rows)}"
    df = pd.DataFrame.from_records(rows)
    df["epoch_utc_seconds"] = df["created_at"].map(_created_at_to_epoch)

    # 1. Row-level devig_group output: right shape, raw implied probs sane.
    parts = [devig_group(g) for _, g in df.groupby(["fixture_id", "bookmaker", "market_id"], sort=False)]
    out = pd.concat(parts, ignore_index=True)
    assert len(out) == 5
    assert abs(out.loc[out["created_at"] == "2026-06-10T10:00:00+00:00", "implied_prob_raw"].sum() - (1 / 2.20 + 1 / 3.40 + 1 / 3.60)) < 1e-9

    # 2. Wide-panel devig: at a single common instant, de-vigged probabilities
    # across all three outcomes must sum to ~1.0 (this is the property a
    # naive per-row devig on asynchronously-updating outcomes would violate).
    key_cols = ["fixture_id", "bookmaker", "market_id"]
    (_, group), = df.groupby(key_cols, sort=False)
    wide, overround, devigged = _devig_wide(group)
    last_row = devigged.iloc[-1]
    total = last_row.sum()
    assert abs(total - 1.0) < 1e-9, f"de-vigged probs should sum to 1.0 at a common instant, got {total}"
    assert last_row["101"] > last_row["102"], "favorite (lower decimal price) should have higher devigged prob than the draw"
    # Overround should be > 1.0 pre-devig (that's the vig) at every instant.
    assert (overround > 1.0).all()
    print("smoke test OK. final common-instant de-vigged probs:", dict(last_row.round(4)), "| overround by ts:", dict(overround.round(4)))


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api-key", default=os.environ.get("ODDSPAPI_API_KEY"), help="defaults to $ODDSPAPI_API_KEY")
    ap.add_argument("--sport-id", type=int, default=DEFAULT_SPORT_ID)
    ap.add_argument("--tournament-slug-hint", default="world-cup")
    ap.add_argument("--tournament-id", type=int, default=None, help="skip discovery, use this tournamentId directly")
    ap.add_argument("--bookmakers", default=",".join(DEFAULT_BOOKMAKERS), help="comma-separated, max 3, Pinnacle first")
    ap.add_argument("--cutoff-date", default=DEFAULT_CUTOFF_DATE, help="only pull fixtures starting on/before this UTC date")
    ap.add_argument("--fixtures-limit", type=int, default=None, help="cap fixtures pulled, for smoke-testing the live API")
    ap.add_argument("--refresh-fixtures", action="store_true", help="re-fetch the fixtures list instead of reusing the cached manifest")
    ap.add_argument("--refresh", action="store_true", help="re-fetch fixtures whose raw json is already cached")
    ap.add_argument("--consolidate-only", action="store_true", help="skip pulling, just rebuild the parquet from raw/")
    ap.add_argument("--smoke-test", action="store_true", help="offline parser self-test, no network/key needed, then exit")
    args = ap.parse_args()

    if args.smoke_test:
        _smoke_test_parse()
        return

    if not args.api_key:
        raise SystemExit(
            "No API key. OddsPapi requires a free account (no card) at "
            "https://oddspapi.io/us/sign-up -- see research/fact-base.json -> benchmarks.odds_sources[oddspapi]. "
            "Once you have a key: export ODDSPAPI_API_KEY=... and re-run."
        )

    client = OddsPapiClient(args.api_key)
    bookmakers = [b.strip() for b in args.bookmakers.split(",") if b.strip()][:3]

    if not args.consolidate_only:
        if args.tournament_id is not None:
            tournament_id = args.tournament_id
        else:
            tournament = find_wc26_tournament_id(client, args.sport_id, args.tournament_slug_hint)
            tournament_id = tournament["tournamentId"]
            logger.info("resolved WC26 tournament: id=%s slug=%s name=%s", tournament_id, tournament.get("tournamentSlug"), tournament.get("tournamentName"))

        fixtures = load_or_fetch_fixtures(client, tournament_id, refresh=args.refresh_fixtures)
        fixtures = filter_fixtures_through_date(fixtures, args.cutoff_date)
        logger.info("%d fixtures on/before cutoff %s", len(fixtures), args.cutoff_date)

        pull_all_fixtures(client, fixtures, bookmakers, limit=args.fixtures_limit, refresh=args.refresh)

    markets_lookup = load_or_fetch_markets_lookup(client)
    consolidate_to_parquet(markets_lookup)


if __name__ == "__main__":
    main()
