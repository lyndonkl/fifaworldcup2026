#!/usr/bin/env python3
"""Arm A -- Polymarket history for the 2026 FIFA World Cup.

Two jobs, run as ``markets`` then ``prices`` (or ``all``):

1. ``markets``  -- enumerate every Polymarket event tagged "FIFA World Cup"
   (Gamma API tag ``fifa-world-cup``, resolved dynamically, both open and
   closed), flatten to one row per nested market, classify by family and
   pull-priority tier, write ``benchmarks/polymarket/markets.parquet``.

   Reality check done empirically on 2026-07-13 (see
   ``research/fact-base.json`` / DECISIONS.md for the brief's ~200-market
   estimate): the tag covers **1,114 events / ~40,200 nested markets /
   ~80,500 outcome tokens** -- the Kalshi-style full breadth (qualifiers,
   per-match win/draw/win *and* halftime/2nd-half/exact-score/first-to-
   score/corners/player-prop variants, squad props, awards) rather than
   just the flagship winner + moneyline markets. All of it is enumerated
   and classified; only a prioritized subset gets price history pulled in
   one run (see below).

2. ``prices`` -- pull CLOB ``prices-history`` per outcome token:
     - 60-minute fidelity across the token's full life
     - 1-minute fidelity for the tournament window (2026-06-11 -> now)
   in <=14-day windows (60-min) / <=10-day windows (1-min) -- see
   ``PROBE_NOTES`` below for how those caps were measured. Retries the
   documented blank-response quirk (py-clob-client issue #189) with
   backoff. Writes partitioned parquet under
   ``benchmarks/polymarket/prices/priority_tier=<t>/fidelity=<f>/``, one
   file per token, so re-running is a pure resume (a JSON manifest tracks
   per-token-per-fidelity progress; a token file on disk + manifest
   ``complete: true`` = skip).

Pull-priority tiers (see ``classify_market``):
  0 = World Cup Winner market                      (60 markets / 120 tokens)
  1 = Knockout-round (>=2026-06-28) match moneylines (30 fixtures / 90
      markets / 180 tokens) -- the 3-way win/draw/win per fixture, the
      direct analogue of Kalshi's KXWCGAME
  2 = everything else (~40,000 markets / ~80,000 tokens): group-stage
      moneylines, every halftime/exact-score/corners/player-prop variant
      for every match (knockout included), Golden Boot, qualifiers, squad
      and award props. Pulled 60-minute-fidelity-only (the 1-minute
      tournament-window pass is reserved for tiers 0-1 -- see "Scope
      decision" below), sorted by (is_knockout desc, volume desc) so the
      highest-value long-tail markets fill in first, and is explicitly
      **best-effort / resumable**, not guaranteed complete in one run --
      run it again (same command) to keep filling the manifest.

Scope decision (logged so it's auditable, not a silent gap): given ~80,000
outcome tokens total, a full tick-complete pull of the entire tag at the
brief's adaptive fidelity would be on the order of 150k-300k HTTP requests
-- tens of hours even at the polite 5 req/s ceiling. The task explicitly
prioritizes "the WINNER market + all knockout-round match markets first,
then the rest" -- read as permission for tiers 0-1 to be complete and
tier 2 to be incremental. Tier 2 additionally skips the 1-minute
tournament-fidelity pass (60-min full-life only) as the "adaptive fidelity
to keep request counts sane" instruction directs.

PROBE_NOTES (empirical, 2026-07-13, against clob.polymarket.com):
  - prices-history rejects any (startTs, endTs) window wider than ~15
    calendar days regardless of requested fidelity ("interval is too
    long"); confirmed at fidelity=1 and fidelity=60 alike (15 days OK, 16
    days 400s). This script uses 14-day chunks for 60-min pulls.
  - At fidelity=1 the response additionally appears capped around ~15.9k
    points per call (14-day and 15-day windows on the same token returned
    an identical point count) -- i.e. a silent-truncation risk above that,
    not a hard error. This script uses 10-day chunks for 1-min pulls
    (<=14,400 potential points) to stay clear of that cap.
  - Polymarket CLOB prices ARE the implied probability already (dollars
    per $1-payout share, range [0,1]); "raw" and "implied_prob" columns in
    prices/ are therefore numerically identical here, kept as two columns
    only for schema parity with the other benchmark arms per the
    normalize-prices-to-probability instruction.

Usage:
  python polymarket.py markets
  python polymarket.py prices --tier 0,1        # winner + knockout, full
  python polymarket.py prices --tier 2 --max-requests 6000   # one slice
  python polymarket.py all --tier 0,1,2 --max-requests 6000
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import traceback
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

import pandas as pd
import requests

# --------------------------------------------------------------------------
# Paths / constants
# --------------------------------------------------------------------------

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = PIPELINE_ROOT / "data" / "benchmarks" / "polymarket"
MARKETS_PARQUET = OUT_ROOT / "markets.parquet"
PRICES_ROOT = OUT_ROOT / "prices"
MANIFEST_PATH = OUT_ROOT / "_manifest_prices.json"
LOG_PATH = OUT_ROOT / "_ingest_log.jsonl"

GAMMA_BASE = "https://gamma-api.polymarket.com"
CLOB_BASE = "https://clob.polymarket.com"
TAG_SLUG = "fifa-world-cup"

TOURNAMENT_START_UTC = datetime(2026, 6, 11, 0, 0, 0, tzinfo=timezone.utc)
KNOCKOUT_START_DATE = date(2026, 6, 28)  # Round of 32 kicks off this date

CHUNK_DAYS_60MIN = 14
CHUNK_DAYS_1MIN = 10

MAX_REQ_PER_SEC = 4.0  # politeness margin under the 5 req/s ceiling
HTTP_TIMEOUT = 25
MAX_RETRIES = 4
BLANK_RETRY_COUNT = 2  # extra retries specifically for the #189 blank-response quirk

MONEYLINE_SLUG_RE = re.compile(r"^fifwc-[a-z0-9]{3}-[a-z0-9]{3}-\d{4}-\d{2}-\d{2}$")
MATCH_SLUG_DATE_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


# --------------------------------------------------------------------------
# Small utilities
# --------------------------------------------------------------------------


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        OUT_ROOT.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a") as fh:
            fh.write(json.dumps({"ts": ts, "msg": msg}) + "\n")
    except Exception:
        pass


def iso_to_epoch(s: Optional[str]) -> Optional[int]:
    if not s:
        return None
    s = s.strip()
    try:
        # handle both '...Z' and '...+00:00' and space-separated '+00' forms
        s2 = s.replace("Z", "+00:00")
        if s2.endswith("+00"):
            s2 = s2 + ":00"
        dt = datetime.fromisoformat(s2)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.astimezone(timezone.utc).timestamp())
    except Exception:
        return None


def now_epoch() -> int:
    return int(datetime.now(timezone.utc).timestamp())


class RateLimiter:
    """Sleeps as needed to keep a single host at <= max_per_sec requests/sec."""

    def __init__(self, max_per_sec: float):
        self.min_interval = 1.0 / max_per_sec
        self._last = 0.0

    def wait(self) -> None:
        now = time.monotonic()
        delta = now - self._last
        if delta < self.min_interval:
            time.sleep(self.min_interval - delta)
        self._last = time.monotonic()


class Http:
    """Thin polite HTTP client: one RateLimiter per host, retry w/ backoff."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "fifaworldcup2026-research-pipeline/1.0"})
        self._limiters: dict[str, RateLimiter] = {}
        self.request_count = 0

    def _limiter_for(self, url: str) -> RateLimiter:
        host = url.split("/")[2]
        if host not in self._limiters:
            self._limiters[host] = RateLimiter(MAX_REQ_PER_SEC)
        return self._limiters[host]

    def get_json(self, url: str, params: dict | None = None) -> tuple[int, Any]:
        limiter = self._limiter_for(url)
        last_exc = None
        for attempt in range(MAX_RETRIES):
            limiter.wait()
            self.request_count += 1
            try:
                resp = self.session.get(url, params=params, timeout=HTTP_TIMEOUT)
                if resp.status_code == 429:
                    backoff = 2 ** attempt
                    log(f"429 rate-limited on {url} params={params}; backing off {backoff}s")
                    time.sleep(backoff)
                    continue
                if resp.status_code >= 500:
                    backoff = 2 ** attempt
                    log(f"HTTP {resp.status_code} on {url} params={params}; retrying in {backoff}s")
                    time.sleep(backoff)
                    continue
                try:
                    data = resp.json()
                except Exception:
                    data = None
                return resp.status_code, data
            except (requests.exceptions.RequestException,) as exc:
                last_exc = exc
                backoff = 2 ** attempt
                log(f"request error on {url} params={params}: {exc!r}; retrying in {backoff}s")
                time.sleep(backoff)
        log(f"giving up on {url} params={params} after {MAX_RETRIES} attempts: {last_exc!r}")
        return -1, None


HTTP = Http()


# --------------------------------------------------------------------------
# Step 1: enumerate + classify markets
# --------------------------------------------------------------------------


def resolve_tag_id(slug: str) -> str:
    status, data = HTTP.get_json(f"{GAMMA_BASE}/tags/slug/{slug}")
    if status != 200 or not data or "id" not in data:
        raise RuntimeError(f"could not resolve Gamma tag slug={slug!r}: status={status} data={data!r}")
    log(f"resolved tag slug={slug!r} -> tag_id={data['id']} label={data.get('label')!r}")
    return str(data["id"])


def fetch_all_events(tag_id: str) -> list[dict]:
    """Paginate Gamma /events for both closed=false and closed=true."""
    events: dict[str, dict] = {}
    for closed_flag in (False, True):
        offset = 0
        page = 0
        while True:
            status, data = HTTP.get_json(
                f"{GAMMA_BASE}/events",
                params={"tag_id": tag_id, "closed": str(closed_flag).lower(), "limit": 100, "offset": offset},
            )
            if status != 200 or data is None:
                log(f"WARNING: events page failed closed={closed_flag} offset={offset} status={status}; stopping this side")
                break
            if not isinstance(data, list) or len(data) == 0:
                break
            for e in data:
                events[e["id"]] = e
            page += 1
            log(f"  events closed={closed_flag} offset={offset}: +{len(data)} (total so far {len(events)})")
            if len(data) < 100:
                break
            offset += 100
    return list(events.values())


def classify_market(event_slug: str) -> str:
    if event_slug == "world-cup-winner":
        return "winner"
    if event_slug.startswith("fifwc-"):
        return "match_moneyline" if MONEYLINE_SLUG_RE.match(event_slug) else "match_prop"
    if "golden-boot" in event_slug:
        return "golden_boot"
    if "qualif" in event_slug:
        return "qualifier"
    if "squad" in event_slug:
        return "squad_prop"
    if any(
        k in event_slug
        for k in (
            "top-goalscorer",
            "top-scorer-nation",
            "most-assists",
            "most-goal-contributions",
            "most-clean-sheets",
            "nation-of-top-goalscorer",
        )
    ):
        return "player_award"
    return "other"


def parse_match_date(event_slug: str) -> Optional[date]:
    m = MATCH_SLUG_DATE_RE.search(event_slug)
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def is_knockout_slug(event_slug: str, family: str) -> bool:
    if family not in ("match_moneyline", "match_prop"):
        return False
    d = parse_match_date(event_slug)
    return bool(d and d >= KNOCKOUT_START_DATE)


def priority_tier_for(family: str, is_ko: bool) -> int:
    if family == "winner":
        return 0
    if family == "match_moneyline" and is_ko:
        return 1
    return 2


def flatten_events_to_markets(events: list[dict]) -> pd.DataFrame:
    rows = []
    for e in events:
        family = classify_market(e["slug"])
        is_ko = is_knockout_slug(e["slug"], family)
        match_date = parse_match_date(e["slug"])
        tier = priority_tier_for(family, is_ko)
        event_common = dict(
            event_id=e.get("id"),
            event_slug=e.get("slug"),
            event_ticker=e.get("ticker"),
            event_title=e.get("title"),
            event_category=e.get("category"),
            event_closed=bool(e.get("closed")),
            event_active=bool(e.get("active")),
            event_archived=bool(e.get("archived")),
            event_volume=_to_float(e.get("volume")),
            event_liquidity=_to_float(e.get("liquidity")),
            event_open_interest=_to_float(e.get("openInterest")),
            event_neg_risk=bool(e.get("negRisk")),
            event_created_at_ts=iso_to_epoch(e.get("createdAt")),
            event_start_date_ts=iso_to_epoch(e.get("startDate")),
            event_end_date_ts=iso_to_epoch(e.get("endDate")),
            event_closed_time_ts=iso_to_epoch(e.get("closedTime")),
            family=family,
            is_knockout=is_ko,
            match_date=match_date.isoformat() if match_date else None,
            priority_tier=tier,
        )
        markets = e.get("markets") or []
        if not markets:
            # event with no nested markets (rare) -- still record it once for the catalog
            row = dict(event_common)
            row.update(
                market_id=None,
                market_slug=None,
                question=None,
                group_item_title=None,
                outcomes_json=None,
                outcome_prices_json=None,
                clob_token_ids_json=None,
                n_tokens=0,
                volume=None,
                liquidity=None,
                volume_24hr=None,
                volume_1wk=None,
                volume_1mo=None,
                volume_1yr=None,
                active=None,
                closed=None,
                archived=None,
                restricted=None,
                created_at_ts=None,
                updated_at_ts=None,
                start_date_ts=None,
                end_date_ts=None,
                closed_time_ts=None,
            )
            rows.append(row)
            continue
        for m in markets:
            try:
                token_ids = json.loads(m.get("clobTokenIds") or "[]")
            except Exception:
                token_ids = []
            try:
                outcomes = json.loads(m.get("outcomes") or "[]")
            except Exception:
                outcomes = []
            try:
                outcome_prices = json.loads(m.get("outcomePrices") or "[]")
            except Exception:
                outcome_prices = []
            row = dict(event_common)
            row.update(
                market_id=m.get("id"),
                market_slug=m.get("slug"),
                question=m.get("question"),
                group_item_title=m.get("groupItemTitle"),
                outcomes_json=json.dumps(outcomes),
                outcome_prices_json=json.dumps(outcome_prices),
                clob_token_ids_json=json.dumps(token_ids),
                n_tokens=len(token_ids),
                volume=_to_float(m.get("volume")),
                liquidity=_to_float(m.get("liquidity")),
                volume_24hr=_to_float(m.get("volume24hr")),
                volume_1wk=_to_float(m.get("volume1wk")),
                volume_1mo=_to_float(m.get("volume1mo")),
                volume_1yr=_to_float(m.get("volume1yr")),
                active=bool(m.get("active")),
                closed=bool(m.get("closed")),
                archived=bool(m.get("archived")),
                restricted=bool(m.get("restricted")),
                created_at_ts=iso_to_epoch(m.get("createdAt")),
                updated_at_ts=iso_to_epoch(m.get("updatedAt")),
                start_date_ts=iso_to_epoch(m.get("startDate")),
                end_date_ts=iso_to_epoch(m.get("endDate")),
                closed_time_ts=iso_to_epoch(m.get("closedTime")),
            )
            rows.append(row)
    return pd.DataFrame(rows)


def _to_float(x) -> Optional[float]:
    if x is None or x == "":
        return None
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def run_markets_job() -> pd.DataFrame:
    log("=== Step 1: enumerate + classify markets ===")
    tag_id = resolve_tag_id(TAG_SLUG)
    events = fetch_all_events(tag_id)
    log(f"fetched {len(events)} unique events tagged {TAG_SLUG!r}")
    df = flatten_events_to_markets(events)
    log(f"flattened to {len(df)} market rows, {int(df['n_tokens'].sum())} outcome tokens")
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    df.to_parquet(MARKETS_PARQUET, index=False)
    log(f"wrote {MARKETS_PARQUET} ({len(df)} rows)")

    by_tier = df.groupby("priority_tier").agg(markets=("market_id", "count"), tokens=("n_tokens", "sum"))
    by_family = df.groupby("family").agg(markets=("market_id", "count"), tokens=("n_tokens", "sum"))
    log("markets by priority_tier:\n" + by_tier.to_string())
    log("markets by family:\n" + by_family.to_string())
    return df


# --------------------------------------------------------------------------
# Step 2: pull CLOB prices-history per token
# --------------------------------------------------------------------------


@dataclass
class PriceJob:
    token_id: str
    outcome_index: int
    outcome_label: str
    market_id: str
    market_slug: str
    question: str
    event_id: str
    event_slug: str
    event_title: str
    family: str
    priority_tier: int
    life_start_ts: int
    life_end_ts: int


def build_price_jobs(markets_df: pd.DataFrame, tiers: set[int]) -> list[PriceJob]:
    jobs: list[PriceJob] = []
    df = markets_df[markets_df["priority_tier"].isin(tiers)].copy()
    # tier 2 gets pulled knockout-first, then by volume, so the highest-value
    # long tail fills the manifest before the deep tail does
    df["_volume_sort"] = df["volume"].fillna(0.0)
    df = df[df["_volume_sort"] > 0]  # never-traded markets have nothing to pull
    df = df.sort_values(["priority_tier", "is_knockout", "_volume_sort"], ascending=[True, False, False])

    nowe = now_epoch()
    for _, r in df.iterrows():
        try:
            token_ids = json.loads(r["clob_token_ids_json"] or "[]")
            outcomes = json.loads(r["outcomes_json"] or "[]")
        except Exception:
            continue
        if not token_ids:
            continue
        life_start = r["created_at_ts"] or r["event_created_at_ts"]
        if life_start is None:
            continue
        if r["closed"]:
            life_end = r["closed_time_ts"] or r["updated_at_ts"] or nowe
            life_end = min(int(life_end) + 86400, nowe)  # +1 day buffer past settlement
        else:
            life_end = nowe
        life_start = int(life_start)
        life_end = max(life_end, life_start)
        for idx, tok in enumerate(token_ids):
            label = outcomes[idx] if idx < len(outcomes) else str(idx)
            gil = r.get("group_item_title")
            outcome_label = f"{gil} - {label}" if gil else str(label)
            jobs.append(
                PriceJob(
                    token_id=str(tok),
                    outcome_index=idx,
                    outcome_label=outcome_label,
                    market_id=str(r["market_id"]),
                    market_slug=r["market_slug"],
                    question=r["question"],
                    event_id=str(r["event_id"]),
                    event_slug=r["event_slug"],
                    event_title=r["event_title"],
                    family=r["family"],
                    priority_tier=int(r["priority_tier"]),
                    life_start_ts=life_start,
                    life_end_ts=life_end,
                )
            )
    return jobs


def chunk_windows(start_ts: int, end_ts: int, chunk_days: int) -> Iterable[tuple[int, int]]:
    step = chunk_days * 86400
    t = start_ts
    while t < end_ts:
        t2 = min(t + step, end_ts)
        yield t, t2
        t = t2


def fetch_prices_history(token_id: str, start_ts: int, end_ts: int, fidelity_min: int) -> Optional[list[dict]]:
    """Returns list of {'t':..,'p':..} or None on unrecoverable error. Retries
    the documented blank-response quirk (#189)."""
    params = {"market": token_id, "startTs": start_ts, "endTs": end_ts, "fidelity": fidelity_min}
    attempt = 0
    while True:
        status, data = HTTP.get_json(f"{CLOB_BASE}/prices-history", params=params)
        if status == 400:
            # window too long / bad params for this token -- caller should shrink window
            return None
        if status != 200 or data is None:
            return None
        history = data.get("history") if isinstance(data, dict) else None
        if history:
            return history
        # blank / empty response: could be a genuine gap (no trades yet / market
        # not yet listed in this window) or the #189 quirk. Retry a couple of
        # times with short backoff before accepting it as real.
        if attempt >= BLANK_RETRY_COUNT:
            return []
        attempt += 1
        time.sleep(0.5 * attempt)


def manifest_key(token_id: str, fidelity_min: int) -> str:
    return f"{token_id}|{fidelity_min}"


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text())
        except Exception:
            log(f"WARNING: could not parse {MANIFEST_PATH}, starting fresh")
    return {}


def save_manifest(manifest: dict) -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    tmp = MANIFEST_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, indent=0))
    tmp.replace(MANIFEST_PATH)


def part_path(priority_tier: int, fidelity_min: int, token_id: str) -> Path:
    d = PRICES_ROOT / f"priority_tier={priority_tier}" / f"fidelity={fidelity_min}"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{token_id}.parquet"


def pull_job_fidelity(
    job: PriceJob,
    fidelity_min: int,
    target_start: int,
    target_end: int,
    chunk_days: int,
    manifest: dict,
    row_buffer: list[dict],
) -> bool:
    """Pulls one (job, fidelity) pair, resuming from manifest. Returns True if
    it reached completion (or there was nothing to do), False if it stopped
    early because the request budget ran out (checked by caller)."""
    key = manifest_key(job.token_id, fidelity_min)
    entry = manifest.get(key)
    if entry is None:
        entry = {
            "target_start_ts": target_start,
            "target_end_ts": target_end,
            "next_start_ts": target_start,
            "complete": False,
            "gap_windows": [],
            "rows_written": 0,
        }
        manifest[key] = entry
    if entry.get("complete"):
        return True
    if target_start >= target_end:
        entry["complete"] = True
        return True

    cursor = max(entry.get("next_start_ts", target_start), target_start)
    reached_end = True
    for w_start, w_end in chunk_windows(cursor, target_end, chunk_days):
        history = fetch_prices_history(job.token_id, w_start, w_end, fidelity_min)
        entry["last_attempt_utc"] = now_epoch()
        if history is None:
            # unrecoverable for this window (e.g. 400) -- log gap, move past it
            entry["gap_windows"].append([w_start, w_end])
            log(f"GAP token={job.token_id} fidelity={fidelity_min} window=({w_start},{w_end}) event={job.event_slug}")
        elif len(history) == 0:
            entry["gap_windows"].append([w_start, w_end])
        else:
            for pt in history:
                t = pt.get("t")
                p = pt.get("p")
                if t is None or p is None:
                    continue
                row_buffer.append(
                    dict(
                        token_id=job.token_id,
                        outcome_index=job.outcome_index,
                        outcome_label=job.outcome_label,
                        market_id=job.market_id,
                        market_slug=job.market_slug,
                        question=job.question,
                        event_id=job.event_id,
                        event_slug=job.event_slug,
                        event_title=job.event_title,
                        family=job.family,
                        priority_tier=job.priority_tier,
                        fidelity_minutes=fidelity_min,
                        ts_utc=int(t),
                        price_raw=float(p),
                        implied_prob=float(p),  # Polymarket prices are already probabilities
                    )
                )
            entry["rows_written"] = entry.get("rows_written", 0) + len(history)
        entry["next_start_ts"] = w_end
        if HTTP.request_count >= pull_job_fidelity.budget_stop:  # type: ignore[attr-defined]
            reached_end = w_end >= target_end
            break
    if entry["next_start_ts"] >= target_end:
        entry["complete"] = True
    return entry["complete"]


def flush_token_rows(rows: list[dict], job: PriceJob, fidelity_min: int) -> None:
    if not rows:
        return
    path = part_path(job.priority_tier, fidelity_min, job.token_id)
    new_df = pd.DataFrame(rows)
    if path.exists():
        try:
            old_df = pd.read_parquet(path)
            new_df = pd.concat([old_df, new_df], ignore_index=True)
        except Exception:
            log(f"WARNING: could not read existing {path}, overwriting")
    new_df = new_df.drop_duplicates(subset=["token_id", "fidelity_minutes", "ts_utc"]).sort_values("ts_utc")
    new_df.to_parquet(path, index=False)


def run_prices_job(markets_df: pd.DataFrame, tiers: set[int], max_requests: int) -> None:
    log(f"=== Step 2: pull CLOB prices-history (tiers={sorted(tiers)}, max_requests={max_requests}) ===")
    jobs = build_price_jobs(markets_df, tiers)
    log(f"built {len(jobs)} price jobs (token x market) across tiers {sorted(tiers)}")

    manifest = load_manifest()
    HTTP.request_count = 0
    start_budget = HTTP.request_count
    pull_job_fidelity.budget_stop = max_requests  # type: ignore[attr-defined]

    tournament_start_ts = int(TOURNAMENT_START_UTC.timestamp())
    nowe = now_epoch()

    done_tokens = 0
    skipped_complete = 0
    budget_hit = False

    for job in jobs:
        if HTTP.request_count >= max_requests:
            budget_hit = True
            break

        # Pass A: 60-min fidelity, full life
        k60 = manifest_key(job.token_id, 60)
        already60 = manifest.get(k60, {}).get("complete", False)
        rows: list[dict] = []
        if not already60:
            pull_job_fidelity(job, 60, job.life_start_ts, job.life_end_ts, CHUNK_DAYS_60MIN, manifest, rows)
            flush_token_rows(rows, job, 60)
        else:
            skipped_complete += 1

        if HTTP.request_count >= max_requests:
            budget_hit = True
            save_manifest(manifest)
            break

        # Pass B: 1-min fidelity, tournament window only -- tiers 0 and 1 only
        # (see module docstring "Scope decision")
        if job.priority_tier in (0, 1):
            win_start = max(job.life_start_ts, tournament_start_ts)
            win_end = min(job.life_end_ts, nowe)
            k1 = manifest_key(job.token_id, 1)
            already1 = manifest.get(k1, {}).get("complete", False)
            rows1: list[dict] = []
            if not already1 and win_start < win_end:
                pull_job_fidelity(job, 1, win_start, win_end, CHUNK_DAYS_1MIN, manifest, rows1)
                flush_token_rows(rows1, job, 1)
            elif win_start >= win_end:
                manifest.setdefault(
                    k1,
                    {
                        "target_start_ts": win_start,
                        "target_end_ts": win_end,
                        "next_start_ts": win_start,
                        "complete": True,
                        "gap_windows": [],
                        "rows_written": 0,
                    },
                )

        done_tokens += 1
        if done_tokens % 25 == 0:
            save_manifest(manifest)
            log(
                f"progress: {done_tokens}/{len(jobs)} tokens touched this run "
                f"({skipped_complete} already-complete skipped), requests={HTTP.request_count}"
            )

    save_manifest(manifest)
    n_complete = sum(1 for v in manifest.values() if v.get("complete"))
    n_total_keys = len(manifest)
    log(
        f"prices job done: touched {done_tokens} tokens this run, requests_used={HTTP.request_count}, "
        f"budget_hit={budget_hit}, manifest_keys_complete={n_complete}/{n_total_keys}"
    )
    if budget_hit:
        log("request budget exhausted before all jobs finished -- re-run the same command to resume (manifest-driven).")


# --------------------------------------------------------------------------
# Reporting
# --------------------------------------------------------------------------


def print_row_counts() -> None:
    if not PRICES_ROOT.exists():
        log("no prices/ directory yet")
        return
    total_rows = 0
    total_files = 0
    per_tier: dict[str, int] = {}
    for tier_dir in sorted(PRICES_ROOT.glob("priority_tier=*")):
        tier_rows = 0
        for fid_dir in sorted(tier_dir.glob("fidelity=*")):
            for f in fid_dir.glob("*.parquet"):
                try:
                    n = pd.read_parquet(f, columns=["ts_utc"]).shape[0]
                except Exception:
                    n = 0
                tier_rows += n
                total_rows += n
                total_files += 1
        per_tier[tier_dir.name] = tier_rows
    log(f"row counts by partition: {per_tier}")
    log(f"TOTAL price rows: {total_rows} across {total_files} token-parquet files")


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def parse_tiers(s: str) -> set[int]:
    return {int(x) for x in s.split(",") if x.strip() != ""}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("job", choices=["markets", "prices", "all", "report"], help="which step to run")
    ap.add_argument("--tier", default="0,1,2", help="comma-separated priority tiers to pull prices for")
    ap.add_argument("--max-requests", type=int, default=200_000, help="HTTP request budget for the prices step")
    args = ap.parse_args()

    tiers = parse_tiers(args.tier)

    if args.job == "report":
        print_row_counts()
        return

    markets_df = None
    if args.job in ("markets", "all"):
        markets_df = run_markets_job()

    if args.job in ("prices", "all"):
        if markets_df is None:
            if not MARKETS_PARQUET.exists():
                log(f"ERROR: {MARKETS_PARQUET} does not exist -- run the 'markets' job first")
                sys.exit(1)
            markets_df = pd.read_parquet(MARKETS_PARQUET)
        run_prices_job(markets_df, tiers, args.max_requests)
        print_row_counts()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
