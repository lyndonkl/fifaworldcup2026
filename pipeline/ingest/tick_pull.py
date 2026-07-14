"""Full-history Kalshi tick/candle puller for the 2026 FIFA World Cup catalog.

Pulls, for every catalog market with volume > 0:
  - full tick-level trade history (GetTrades, cursor-paginated, split across
    the live (/markets/trades) and historical (/historical/trades) tiers at
    Kalshi's rolling cutoff -- see `_trade_segments` / `get_historical_cutoff`
    in common/api.py)
  - full 1-minute candlestick history, chunked into <=5000-minute wall-clock
    windows (the API's hard per-request cap, verified empirically)

Design notes (see research/catalog-summary.md and CLAUDE.md for the sizing
context this stage implements):

  - PRIORITY QUEUE, not a flat pull. `build_queue` orders markets so the
    hottest, most narrative-relevant data lands first even if the run is
    interrupted partway through:
      (a) KXMENWORLDCUP winner legs
      (b) knockout-round KXWCGAME/KXWCADVANCE legs -- "knockout" is derived
          from the data itself, not a hardcoded date: every KXWCADVANCE
          market is inherently a knockout ("to advance") market, so its
          event-ticker match-ids define the knockout set; KXWCGAME legs
          sharing one of those match-ids are knockout too.
      (c) everything else in the per-match family (group-stage games,
          totals, spreads, 1H/2H scores, etc.)
      (d) everything else in the catalog (player props, group markets,
          team-performance/stage-of-elim, novelty, off-pitch)

  - W1 FINDING (load-bearing): close_time/expiration_time on a still-active
    market is a far-future placeholder, not real. Every window is capped at
    *pull time* ("now" when that specific market is actually processed, not
    catalog-build time) unless the catalog's `status` is closed/finalized/
    settled, in which case close_time is trusted as-is. A market's window
    (open_ts, end_ts) and its historical/live cutoff are FROZEN into the
    ledger record the first time the market is touched, so a resumed run
    days later can't retroactively shift segment boundaries out from under
    an in-progress cursor.

  - RESUMABILITY is page-level, not just market-level. Every GetTrades page
    and every candlestick chunk is (a) appended to a per-market JSONL spool
    file and (b) checkpointed to the JSONL ledger (last-record-per-key
    wins) before the next request goes out. A crash loses at most the
    request in flight. Final parquet output is written once per market via
    temp+rename (atomic) by consolidating the spool with any pre-existing
    parquet (dedup on trade_id / end_period_ts), then the spool is deleted.

  - ADAPTIVE THROTTLE: starts at --rate (default 5 req/s, matching W1's
    baseline). Any observed 429 halves the rate (down to a floor); a
    sustained clean streak creeps it back up toward the ceiling. This is a
    thin controller around the shared KalshiClient's own fixed-rate gate +
    retry/backoff (common/api.py) -- it does not replace per-request retry,
    it adjusts the steady-state pace between requests.

Run (from pipeline/ as cwd):
    .venv/bin/python -m ingest.tick_pull --dry-run
    .venv/bin/python -m ingest.tick_pull --only TICKER1,TICKER2,TICKER3
    .venv/bin/python -m ingest.tick_pull                 # full pull (long-running)
    .venv/bin/python -m ingest.tick_pull --since 2026-07-13T00:00:00Z   # v2 incremental
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common.api import KalshiAPIError, KalshiClient  # noqa: E402
from common.timeutil import iso_datetime_to_epoch  # noqa: E402
from ingest.catalog import FAM_PER_MATCH  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("tick_pull")

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------
PIPELINE_DIR = Path(__file__).resolve().parent.parent
CATALOG_DIR = PIPELINE_DIR / "data" / "catalog"
KALSHI_DIR = PIPELINE_DIR / "data" / "kalshi"
TRADES_DIR = KALSHI_DIR / "trades"
CANDLES_DIR = KALSHI_DIR / "candles"
LEDGER_DIR = KALSHI_DIR / "ledger"
LEDGER_PATH = LEDGER_DIR / "tick_pull_ledger.jsonl"
STATUS_PATH = KALSHI_DIR / "pull_status.json"
LOG_PATH = KALSHI_DIR / "pull.log"
SPOOL_DIR = KALSHI_DIR / "_spool"
TRADES_SPOOL_DIR = SPOOL_DIR / "trades"
CANDLES_SPOOL_DIR = SPOOL_DIR / "candles"

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------
TRADES_LIMIT = 1000                 # GetTrades hard per-page cap (1001 rejected)
CANDLE_CHUNK_SECONDS = 5000 * 60    # verified empirically: exactly 5000 candles OK, 5001 rejected
TERMINAL_STATUSES = {"finalized", "closed", "settled"}
SETTLEMENT_TAIL_PAD_SECONDS = 3600  # settlement prints observed up to 41 min past close_time
HEARTBEAT_INTERVAL_SEC = 30.0
CUTOFF_REFRESH_INTERVAL_SEC = 1800.0  # /historical/cutoff is a slow-moving rolling boundary

PRIORITY_BAND_LABELS = {
    1: "(a) KXMENWORLDCUP winner legs",
    2: "(b) knockout-round KXWCGAME/KXWCADVANCE legs",
    3: "(c) remaining per-match family markets",
    4: "(d) everything else",
}


# ==========================================================================
# Work queue
# ==========================================================================
def compute_priority_bands(markets: pd.DataFrame, series: pd.DataFrame) -> pd.DataFrame:
    """Assign each market a priority_band (1=hottest .. 4=coldest) per the
    brief's ordering. Knockout-ness is derived from the data: KXWCADVANCE
    ("To Advance") markets only exist for knockout-stage matches, so their
    event-ticker match-ids (the part after "KXWCADVANCE-") define the
    knockout set; a KXWCGAME leg sharing that match-id is knockout too.
    """
    fam_by_series = dict(zip(series["ticker"], series["family"]))
    m = markets.copy()
    m["family"] = m["series_ticker"].map(fam_by_series)

    advance_prefix = "KXWCADVANCE-"
    advance_rows = m.loc[m["series_ticker"] == "KXWCADVANCE", "event_ticker"]
    knockout_match_ids = set(
        advance_rows.map(lambda et: et[len(advance_prefix):] if isinstance(et, str) and et.startswith(advance_prefix) else et)
    )

    def match_id(event_ticker: Any, series_ticker: str) -> Any:
        prefix = f"{series_ticker}-"
        if isinstance(event_ticker, str) and event_ticker.startswith(prefix):
            return event_ticker[len(prefix):]
        return event_ticker

    def band(row: pd.Series) -> int:
        if row["series_ticker"] == "KXMENWORLDCUP":
            return 1
        if row["series_ticker"] in ("KXWCGAME", "KXWCADVANCE"):
            if match_id(row["event_ticker"], row["series_ticker"]) in knockout_match_ids:
                return 2
        if row["family"] == FAM_PER_MATCH:
            return 3
        return 4

    m["priority_band"] = m.apply(band, axis=1)
    return m


def build_queue(
    markets: pd.DataFrame,
    series: pd.DataFrame,
    only: list[str] | None = None,
    limit: int | None = None,
) -> pd.DataFrame:
    """Return the priority-ordered work queue: every market with volume > 0,
    sorted by priority_band ascending, then volume_contracts descending
    within a band (hottest data in each band first)."""
    m = compute_priority_bands(markets, series)
    m = m.copy()
    m["volume_contracts"] = m["volume_contracts"].fillna(0.0)
    queue = m[m["volume_contracts"] > 0].copy()

    if only:
        only_set = {t.strip() for t in only if t.strip()}
        found = queue[queue["ticker"].isin(only_set)]
        missing = only_set - set(found["ticker"])
        if missing:
            logger.warning(
                "--only tickers not found in catalog (or have zero volume, so excluded "
                "from the work queue): %s", sorted(missing),
            )
        queue = found

    queue = queue.sort_values(["priority_band", "volume_contracts"], ascending=[True, False]).reset_index(drop=True)
    if limit is not None:
        queue = queue.head(limit)

    return queue[[
        "ticker", "series_ticker", "event_ticker", "open_time", "close_time",
        "status", "volume_contracts", "priority_band",
    ]]


def print_dry_run(queue: pd.DataFrame, total_catalog_markets: int, zero_volume_markets: int) -> dict[str, Any]:
    band_stats = (
        queue.groupby("priority_band")
        .agg(markets=("ticker", "count"), volume_contracts=("volume_contracts", "sum"))
        .reset_index()
        .sort_values("priority_band")
    )
    lines = [
        f"Work queue: {len(queue)} markets (volume > 0) out of {total_catalog_markets} cataloged "
        f"({zero_volume_markets} zero-volume markets skipped, left untouched in the catalog).",
        "",
        "By priority band:",
    ]
    for _, r in band_stats.iterrows():
        band = int(r["priority_band"])
        lines.append(
            f"  band {band}  {PRIORITY_BAND_LABELS[band]:52s} markets={int(r['markets']):6d}  "
            f"volume={r['volume_contracts']:>18,.0f} contracts"
        )
    lines.append("")
    lines.append("First 12 markets in pull order (hottest data first):")
    for _, r in queue.head(12).iterrows():
        lines.append(
            f"    band{int(r['priority_band'])}  {r['ticker']:40s} status={str(r['status']):10s} "
            f"volume={r['volume_contracts']:>14,.0f}"
        )
    lines.append("")
    lines.append(
        "Request/time sizing for the full nonzero-volume catalog: see "
        "research/catalog-summary.md (~52.1M trades / ~72.3k GetTrades requests / "
        "~99.9k candlestick requests / ~9.6h wall-clock at 5 req/s). Dry-run makes zero "
        "API calls, so it does not recompute this estimate; it reports queue composition "
        "and ordering only."
    )
    text = "\n".join(lines)
    print(text)
    return {
        "queue_size": len(queue),
        "band_counts": {int(r["priority_band"]): int(r["markets"]) for _, r in band_stats.iterrows()},
        "band_volume": {int(r["priority_band"]): float(r["volume_contracts"]) for _, r in band_stats.iterrows()},
        "summary_text": text,
    }


# ==========================================================================
# Ledger (resumable checkpoint log)
# ==========================================================================
class Ledger:
    """Crash-safe JSONL checkpoint log. Every `put` appends a *full* state
    snapshot (not a delta); on load, only the last record per ledger_key
    survives (latest write wins). A torn/partial final line from a hard
    kill mid-write is tolerated (skipped) rather than corrupting prior
    state -- worst case a resumed run loses the single in-flight
    checkpoint, never more.
    """

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._state: dict[str, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        n_lines = 0
        n_bad = 0
        with open(self.path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                n_lines += 1
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    n_bad += 1
                    continue
                key = rec.get("ledger_key")
                if key:
                    self._state[key] = rec
        logger.info(
            "ledger loaded: %d lines (%d unparseable, tolerated), %d distinct markets tracked",
            n_lines, n_bad, len(self._state),
        )

    def get(self, key: str) -> dict[str, Any] | None:
        rec = self._state.get(key)
        return dict(rec) if rec is not None else None

    def put(self, key: str, record: dict[str, Any]) -> None:
        record = dict(record)
        record["ledger_key"] = key
        record["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._state[key] = record
        with open(self.path, "a") as f:
            f.write(json.dumps(record, default=str) + "\n")

    def all_records(self) -> list[dict[str, Any]]:
        return list(self._state.values())


def new_ledger_record(
    ticker: str, series_ticker: str, priority_band: int,
    window_open_ts: int, window_end_ts: int, cutoff_ts: int, since_ts: int | None,
) -> dict[str, Any]:
    return {
        "ticker": ticker,
        "series_ticker": series_ticker,
        "priority_band": priority_band,
        "window_open_ts": window_open_ts,
        "window_end_ts": window_end_ts,
        "cutoff_ts": cutoff_ts,          # frozen at first touch -- see module docstring
        "since_ts": since_ts,
        "phase": "pending",              # pending -> trades -> candles -> done -> error
        "trades_done": False,
        "trades_rows": 0,
        "trades_segment": None,          # "historical" | "live" | None (in-flight segment)
        "trades_cursor": None,           # resume cursor for the in-flight segment
        "trades_historical_done": False,
        "trades_live_done": False,
        "candles_done": False,
        "candles_rows": 0,
        "candles_next_start_ts": window_open_ts,
        "error": None,
    }


# ==========================================================================
# Spool + parquet consolidation
# ==========================================================================
def append_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a") as f:
        for r in rows:
            f.write(json.dumps(r, default=str) + "\n")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def atomic_write_parquet(df: pd.DataFrame, final_path: Path) -> None:
    final_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = final_path.with_name(final_path.name + f".tmp{os.getpid()}")
    df.to_parquet(tmp_path, index=False)
    os.replace(tmp_path, final_path)  # atomic rename on the same filesystem


def consolidate(spool_path: Path, final_path: Path, dedupe_key: str, sort_key: str | None) -> int:
    """Merge a market's spool (this run's newly-fetched rows) with any
    pre-existing parquet (from a prior run, or --since incremental mode),
    dedupe, and write the result atomically. Deletes the spool on success.
    Returns the final row count."""
    new_rows = read_jsonl(spool_path)
    new_df = pd.DataFrame(new_rows) if new_rows else pd.DataFrame()

    if final_path.exists():
        old_df = pd.read_parquet(final_path)
        combined = pd.concat([old_df, new_df], ignore_index=True) if len(new_df) else old_df
    else:
        combined = new_df

    if len(combined) == 0:
        if spool_path.exists():
            spool_path.unlink()
        return 0

    if dedupe_key in combined.columns:
        combined = combined.drop_duplicates(subset=[dedupe_key], keep="last")
    if sort_key and sort_key in combined.columns:
        combined = combined.sort_values(sort_key, kind="stable")
    combined = combined.reset_index(drop=True)

    atomic_write_parquet(combined, final_path)
    if spool_path.exists():
        spool_path.unlink()
    return len(combined)


def consolidate_trades(spool_path: Path, final_path: Path) -> int:
    return consolidate(spool_path, final_path, dedupe_key="trade_id", sort_key="created_ts")


def consolidate_candles(spool_path: Path, final_path: Path) -> int:
    return consolidate(spool_path, final_path, dedupe_key="end_period_ts", sort_key="end_period_ts")


# ==========================================================================
# Record parsing (raw fidelity + parsed numeric/epoch columns)
# ==========================================================================
def parse_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_trade_row(t: dict[str, Any], series_ticker: str, segment: str) -> dict[str, Any]:
    """Keep every raw field from GetTrades verbatim (count_fp, *_dollars
    strings included) and add parsed numeric + UTC-epoch columns alongside."""
    row = dict(t)
    row["series_ticker"] = series_ticker
    row["source_segment"] = segment  # "historical" | "live" -- audit trail of which tier served this row
    row["count_contracts"] = parse_float(t.get("count_fp"))
    row["yes_price_usd"] = parse_float(t.get("yes_price_dollars"))
    row["no_price_usd"] = parse_float(t.get("no_price_dollars"))
    row["created_ts"] = iso_datetime_to_epoch(t.get("created_time"))
    return row


_CANDLE_GROUPS = ("price", "yes_ask", "yes_bid")
_CANDLE_STATS = ("open", "high", "low", "close", "mean", "previous")


def parse_candle_row(c: dict[str, Any], ticker: str, series_ticker: str) -> dict[str, Any]:
    """Flatten the nested price/yes_ask/yes_bid OHLC objects into columns,
    keeping the raw *_dollars strings plus parsed float twins. Candles are
    sparse -- not every group/stat key is present on every candle (a quiet
    period may carry only `price.previous_dollars`) -- missing keys are
    simply omitted per-row; pandas fills the gaps with NaN at DataFrame
    construction."""
    row: dict[str, Any] = {
        "ticker": ticker,
        "series_ticker": series_ticker,
        "end_period_ts": c.get("end_period_ts"),
        "open_interest_fp": c.get("open_interest_fp"),
        "volume_fp": c.get("volume_fp"),
        "open_interest_contracts": parse_float(c.get("open_interest_fp")),
        "volume_contracts": parse_float(c.get("volume_fp")),
    }
    for group in _CANDLE_GROUPS:
        g = c.get(group) or {}
        for stat in _CANDLE_STATS:
            key = f"{stat}_dollars"
            if key in g:
                col = f"{group}_{stat}_dollars"
                row[col] = g[key]
                row[f"{group}_{stat}_usd"] = parse_float(g[key])
    return row


# ==========================================================================
# Adaptive throttle
# ==========================================================================
class AdaptiveThrottle:
    """Adjusts KalshiClient.min_interval (its fixed req/s gate) around a
    ceiling rate in response to observed 429s. W1 finding: 429s occurred
    even at a steady 5 req/s, so per-request retry/backoff (already in
    KalshiClient) isn't sufficient on its own -- this also backs off the
    *steady-state pace* after a 429, then creeps back toward the ceiling
    after a sustained clean streak.
    """

    def __init__(self, client: KalshiClient, ceiling_rate: float, floor_rate: float | None = None, clean_streak_target: int = 200):
        self.client = client
        self.ceiling_rate = max(0.1, ceiling_rate)
        self.floor_rate = floor_rate if floor_rate is not None else max(0.5, self.ceiling_rate / 10.0)
        self.current_rate = self.ceiling_rate
        self.clean_streak_target = clean_streak_target
        self._last_429_count = client.retry_429_count
        self._clean_ticks = 0
        self.client.min_interval = 1.0 / self.current_rate

    def tick(self) -> None:
        n429 = self.client.retry_429_count
        if n429 > self._last_429_count:
            self._last_429_count = n429
            self._clean_ticks = 0
            new_rate = max(self.floor_rate, self.current_rate / 2.0)
            if new_rate != self.current_rate:
                self.current_rate = new_rate
                self.client.min_interval = 1.0 / self.current_rate
                logger.info("adaptive throttle: 429 observed, rate -> %.2f req/s", self.current_rate)
        else:
            self._clean_ticks += 1
            if self._clean_ticks >= self.clean_streak_target and self.current_rate < self.ceiling_rate:
                self._clean_ticks = 0
                self.current_rate = min(self.ceiling_rate, self.current_rate * 1.25)
                self.client.min_interval = 1.0 / self.current_rate
                logger.info("adaptive throttle: clean streak, rate -> %.2f req/s", self.current_rate)


# ==========================================================================
# Heartbeat
# ==========================================================================
class HeartbeatWriter:
    def __init__(self, path: Path, interval_sec: float = HEARTBEAT_INTERVAL_SEC):
        self.path = path
        self.interval_sec = interval_sec
        self._last_write = 0.0

    def maybe_write(self, state: dict[str, Any], force: bool = False) -> None:
        now = time.monotonic()
        if not force and (now - self._last_write) < self.interval_sec:
            return
        self._last_write = now
        payload = dict(state)
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_name(self.path.name + f".tmp{os.getpid()}")
        with open(tmp, "w") as f:
            json.dump(payload, f, indent=2, default=str)
        os.replace(tmp, self.path)


def configure_file_logging() -> None:
    KALSHI_DIR.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    fh = logging.FileHandler(LOG_PATH, mode="a")
    fh.setFormatter(fmt)
    logging.getLogger().addHandler(fh)


# ==========================================================================
# Trade / candle pulling (page- and chunk-level resumable)
# ==========================================================================
def _trade_segments(record: dict[str, Any]) -> list[tuple[str, int, int]]:
    """Which (segment, start_ts, end_ts) sub-pulls remain for this market,
    given its frozen window/cutoff and what's already done. Historical
    precedes live chronologically, so this list is naturally resume-order."""
    win_open, win_end, cutoff = record["window_open_ts"], record["window_end_ts"], record["cutoff_ts"]
    segs: list[tuple[str, int, int]] = []
    if win_open < cutoff and not record["trades_historical_done"]:
        segs.append(("historical", win_open, min(win_end, cutoff)))
    if win_end > cutoff and not record["trades_live_done"]:
        segs.append(("live", max(win_open, cutoff), win_end))
    return segs


def pull_trades_for_market(client: KalshiClient, record: dict[str, Any], spool_path: Path, state: dict[str, Any], checkpoint_fn) -> None:
    if record["trades_done"]:
        return
    if record["window_end_ts"] <= record["window_open_ts"]:
        record["trades_done"] = True
        checkpoint_fn(record)
        return

    while True:
        segs = _trade_segments(record)
        if not segs:
            break
        seg_name, seg_start, seg_end = segs[0]
        path = "/historical/trades" if seg_name == "historical" else "/markets/trades"
        resume_cursor = record.get("trades_cursor") if record.get("trades_segment") == seg_name else None
        record["trades_segment"] = seg_name
        params = {"ticker": record["ticker"], "min_ts": seg_start, "max_ts": seg_end, "limit": TRADES_LIMIT}

        for items, _cursor_used, next_cursor in client.paginate_pages(
            path, items_key="trades", params=params, start_cursor=resume_cursor
        ):
            if items:
                rows = [parse_trade_row(t, record["series_ticker"], seg_name) for t in items]
                append_jsonl(spool_path, rows)
                record["trades_rows"] += len(items)
                state["trades_rows"] += len(items)
            record["trades_cursor"] = next_cursor
            checkpoint_fn(record)

        if seg_name == "historical":
            record["trades_historical_done"] = True
        else:
            record["trades_live_done"] = True
        record["trades_segment"] = None
        record["trades_cursor"] = None
        checkpoint_fn(record)

    record["trades_done"] = True
    checkpoint_fn(record)


def pull_candles_for_market(client: KalshiClient, record: dict[str, Any], spool_path: Path, state: dict[str, Any], checkpoint_fn) -> None:
    if record["candles_done"]:
        return
    win_open, win_end = record["window_open_ts"], record["window_end_ts"]
    if win_end <= win_open:
        record["candles_done"] = True
        checkpoint_fn(record)
        return

    while record["candles_next_start_ts"] < win_end:
        chunk_start = record["candles_next_start_ts"]
        chunk_end = min(chunk_start + CANDLE_CHUNK_SECONDS, win_end)
        candles = client.get_candlesticks(
            record["series_ticker"], record["ticker"], chunk_start, chunk_end, period_interval=1
        )
        if candles:
            rows = [parse_candle_row(c, record["ticker"], record["series_ticker"]) for c in candles]
            append_jsonl(spool_path, rows)
            record["candles_rows"] += len(candles)
            state["candle_rows"] += len(candles)
        record["candles_next_start_ts"] = chunk_end
        checkpoint_fn(record)

    record["candles_done"] = True
    checkpoint_fn(record)


# ==========================================================================
# Lifetime windowing
# ==========================================================================
def effective_window(open_time: str, close_time: str, status: str, since_ts: int | None) -> tuple[int, int]:
    """(open_ts, end_ts) for a market's ACTIVE lifetime, computed at *pull
    time* (caller passes "now" implicitly via close_time capping below).
    W1 finding: close_time/expiration_time on a non-terminal-status market
    is a far-future placeholder -- only trust it when status is
    closed/finalized/settled; otherwise cap at pull-time now.
    Pilot finding: Kalshi prints settlement-flurry trades (and the final
    partial-minute candle) AFTER close_time on terminal markets -- observed
    tails up to 41 min past close, to-the-cent equal to the reconciliation
    shortfall on 6 of 14 finalized pilot markets. Pad the terminal window;
    dedupe-on-write makes the overlap safe."""
    now_ts = int(datetime.now(timezone.utc).timestamp())
    open_ts = iso_datetime_to_epoch(open_time) or now_ts
    close_ts = iso_datetime_to_epoch(close_time) or now_ts
    if status in TERMINAL_STATUSES:
        end_ts = min(close_ts + SETTLEMENT_TAIL_PAD_SECONDS, now_ts)
    else:
        end_ts = min(close_ts, now_ts)
    end_ts = max(end_ts, open_ts)
    if since_ts is not None:
        open_ts = min(max(open_ts, since_ts), end_ts)
    return open_ts, end_ts


# ==========================================================================
# Main
# ==========================================================================
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", type=str, default=None, help="Comma-separated market tickers to restrict the pull to (pilot/smoke-test mode).")
    ap.add_argument("--limit", type=int, default=None, help="Cap the work queue to the first N markets after priority sorting.")
    ap.add_argument("--dry-run", action="store_true", help="Print queue stats and exit. Makes zero API calls.")
    ap.add_argument("--rate", type=float, default=5.0, help="Starting/ceiling requests-per-second (default 5.0).")
    ap.add_argument(
        "--since", type=str, default=None,
        help="ISO-8601 UTC timestamp. Incremental v2 mode: pull only trades/candles at/after "
             "this time per market, merging into existing per-market parquet files instead of "
             "requiring a fresh full-history pull. Default (omitted) is a full-history pull.",
    )
    args = ap.parse_args()

    only = [t.strip() for t in args.only.split(",")] if args.only else None
    since_ts = iso_datetime_to_epoch(args.since) if args.since else None

    markets = pd.read_parquet(CATALOG_DIR / "markets.parquet")
    series = pd.read_parquet(CATALOG_DIR / "series.parquet")
    total_catalog_markets = len(markets)
    zero_volume_markets = int((markets["volume_contracts"].fillna(0) <= 0).sum())

    queue = build_queue(markets, series, only=only, limit=args.limit)

    if args.dry_run:
        print_dry_run(queue, total_catalog_markets, zero_volume_markets)
        return

    if len(queue) == 0:
        logger.warning("work queue is empty (check --only tickers / catalog volume filter) -- nothing to do")
        return

    configure_file_logging()
    logger.info(
        "tick_pull starting: %d markets queued (--only=%s --limit=%s --rate=%.2f --since=%s)",
        len(queue), only, args.limit, args.rate, args.since,
    )

    for d in (TRADES_DIR, CANDLES_DIR, LEDGER_DIR, TRADES_SPOOL_DIR, CANDLES_SPOOL_DIR):
        d.mkdir(parents=True, exist_ok=True)

    client = KalshiClient(max_requests_per_second=args.rate)
    throttle = AdaptiveThrottle(client, ceiling_rate=args.rate)
    ledger = Ledger(LEDGER_PATH)
    heartbeat = HeartbeatWriter(STATUS_PATH)

    cutoff_state = {"ts": client.get_historical_cutoff()["trades_created_ts"], "fetched_at": time.monotonic()}
    if cutoff_state["ts"] is None:
        cutoff_state["ts"] = int(datetime.now(timezone.utc).timestamp())
    logger.info(
        "historical/live trades cutoff: %s (%d)",
        datetime.fromtimestamp(cutoff_state["ts"], tz=timezone.utc).isoformat(), cutoff_state["ts"],
    )

    def current_cutoff() -> int:
        if time.monotonic() - cutoff_state["fetched_at"] > CUTOFF_REFRESH_INTERVAL_SEC:
            try:
                fresh = client.get_historical_cutoff()["trades_created_ts"]
                if fresh is not None:
                    cutoff_state["ts"] = fresh
                cutoff_state["fetched_at"] = time.monotonic()
            except KalshiAPIError as exc:
                logger.warning("cutoff refresh failed, keeping previous value: %s", exc)
        return cutoff_state["ts"]

    # Scope initial cumulative counters to exactly this run's (ticker, mode)
    # ledger keys -- looking up by ticker alone would double-count a market
    # that has both a completed full-history record AND a completed
    # --since:<ts> record (they're deliberately separate ledger entries).
    initial_done = 0
    initial_trades_rows = 0
    initial_candle_rows = 0
    for row in queue.itertuples(index=False):
        key = row.ticker if since_ts is None else f"{row.ticker}::since:{since_ts}"
        rec = ledger.get(key)
        if rec is None:
            continue
        if rec.get("trades_done") and rec.get("candles_done"):
            initial_done += 1
        initial_trades_rows += int(rec.get("trades_rows") or 0)
        initial_candle_rows += int(rec.get("candles_rows") or 0)

    state: dict[str, Any] = {
        "done_markets": initial_done,
        "total_markets": len(queue),
        "trades_rows": initial_trades_rows,
        "candle_rows": initial_candle_rows,
        "requests_made": client.request_count,
        "http_429s": client.retry_429_count,
        "current_rate": throttle.current_rate,
        "eta_hours": None,
        "current_priority_band": None,
        "last_market": None,
    }
    start_time = time.monotonic()
    heartbeat.maybe_write(state, force=True)

    def checkpoint(record: dict[str, Any]) -> None:
        throttle.tick()
        state["current_rate"] = throttle.current_rate
        state["requests_made"] = client.request_count
        state["http_429s"] = client.retry_429_count
        ledger.put(ledger_key, record)
        heartbeat.maybe_write(state)

    n_skipped = 0
    n_errored = 0
    newly_completed = 0

    for row in queue.itertuples(index=False):
        ticker = row.ticker
        series_ticker = row.series_ticker
        priority_band = int(row.priority_band)
        ledger_key = ticker if since_ts is None else f"{ticker}::since:{since_ts}"

        state["current_priority_band"] = priority_band
        state["last_market"] = ticker

        existing = ledger.get(ledger_key)
        if existing and existing.get("trades_done") and existing.get("candles_done"):
            n_skipped += 1
            state["done_markets"] = initial_done + newly_completed  # unchanged, already in initial_done
            continue

        try:
            if existing is not None:
                record = existing
            else:
                open_ts, end_ts = effective_window(row.open_time, row.close_time, row.status, since_ts)
                record = new_ledger_record(
                    ticker, series_ticker, priority_band, open_ts, end_ts, current_cutoff(), since_ts,
                )
                ledger.put(ledger_key, record)

            trades_spool = TRADES_SPOOL_DIR / series_ticker / f"{ticker}.jsonl"
            candles_spool = CANDLES_SPOOL_DIR / series_ticker / f"{ticker}.jsonl"

            record["phase"] = "trades"
            pull_trades_for_market(client, record, trades_spool, state, checkpoint)

            record["phase"] = "candles"
            pull_candles_for_market(client, record, candles_spool, state, checkpoint)

            trades_final = TRADES_DIR / f"series_ticker={series_ticker}" / f"{ticker}.parquet"
            candles_final = CANDLES_DIR / f"series_ticker={series_ticker}" / f"{ticker}.parquet"
            n_trades = consolidate_trades(trades_spool, trades_final)
            n_candles = consolidate_candles(candles_spool, candles_final)

            state["trades_rows"] += n_trades - record.get("trades_rows", 0)
            state["candle_rows"] += n_candles - record.get("candles_rows", 0)
            record["trades_rows"] = n_trades
            record["candles_rows"] = n_candles
            record["phase"] = "done"
            record["error"] = None
            ledger.put(ledger_key, record)

            newly_completed += 1
            state["done_markets"] = initial_done + newly_completed
            elapsed = time.monotonic() - start_time
            remaining = state["total_markets"] - state["done_markets"]
            if newly_completed > 0 and elapsed > 0:
                state["eta_hours"] = round((elapsed / newly_completed) * remaining / 3600, 3)
            heartbeat.maybe_write(state, force=True)

            logger.info(
                "[%d/%d] band%d %-40s trades=%-6d candles=%-6d",
                state["done_markets"], state["total_markets"], priority_band, ticker, n_trades, n_candles,
            )

        except Exception as exc:  # noqa: BLE001 -- one bad market must not kill a 9.6h run
            n_errored += 1
            logger.error("market %s failed: %s\n%s", ticker, exc, traceback.format_exc())
            try:
                record["phase"] = "error"
                record["error"] = f"{type(exc).__name__}: {exc}"
                ledger.put(ledger_key, record)
            except Exception:
                logger.error("failed to even checkpoint the error for %s", ticker)
            heartbeat.maybe_write(state, force=True)
            continue

    heartbeat.maybe_write(state, force=True)
    logger.info(
        "tick_pull finished: %d/%d markets done (%d skipped as already-complete, %d newly processed, %d errored) "
        "trades_rows=%d candle_rows=%d requests_made=%d http_429s=%d elapsed=%.1fs",
        state["done_markets"], state["total_markets"], n_skipped, newly_completed, n_errored,
        state["trades_rows"], state["candle_rows"], client.request_count, client.retry_429_count,
        time.monotonic() - start_time,
    )


if __name__ == "__main__":
    main()
