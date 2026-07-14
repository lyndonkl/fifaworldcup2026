"""Shared Kalshi Trade API v2 client.

Public market-data endpoints (series/events/markets/trades/candlesticks) need
no authentication (verified empirically 2026-07-13, see
research/fact-base.json -> kalshi.api_details.auth). This client is
deliberately small and dependency-light (stdlib + requests) so it can be
reused unchanged by the much larger tick/candle pull stage later in the
pipeline.

Design:
    - Polite fixed-rate throttling (default max 5 req/s) via a monotonic-clock
      gate, independent of Kalshi's own token-bucket limits (Basic tier is
      ~20 req/s equivalent; we intentionally throttle well under that so a
      multi-day unattended pull never trips a limit or looks abusive).
    - Retry with exponential backoff + jitter on 429 and 5xx responses and on
      transient connection errors. Honors a `Retry-After` header if present.
    - A generic cursor-pagination generator (`paginate`) that works for every
      Kalshi list endpoint observed so far (/series, /events, /markets,
      /markets/trades): each page's JSON body has one list-valued key plus a
      `cursor` string that is empty/absent on the last page.
"""

from __future__ import annotations

import logging
import random
import time
from typing import Any, Iterator

import requests

from .timeutil import iso_datetime_to_epoch

logger = logging.getLogger("kalshi_api")

DEFAULT_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"
USER_AGENT = "fifaworldcup2026-research-pipeline/0.1 (data-journalism, public market data, no auth)"


class KalshiAPIError(RuntimeError):
    """Raised when a request exhausts its retry budget or hits a non-retryable error."""


class KalshiClient:
    """Thin, polite, retrying HTTP client for Kalshi's public Trade API v2.

    Parameters
    ----------
    base_url:
        API base. Defaults to the elections host, which fact-base.json
        confirms serves the same public v2 API as external-api.kalshi.com.
    max_requests_per_second:
        Hard ceiling on outbound request rate (default 5). Requests block
        (sleep) as needed to respect this; it is a floor-of-politeness, not
        an attempt to use Kalshi's full allowed budget.
    max_retries:
        Retry attempts for 429 / 5xx / connection errors before giving up.
    timeout:
        Per-request socket timeout in seconds.
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        max_requests_per_second: float = 5.0,
        max_retries: int = 6,
        timeout: float = 20.0,
        backoff_base: float = 1.0,
        backoff_cap: float = 30.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.min_interval = 1.0 / max_requests_per_second
        self.max_retries = max_retries
        self.timeout = timeout
        self.backoff_base = backoff_base
        self.backoff_cap = backoff_cap

        self._session = requests.Session()
        self._session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
        self._last_request_at: float | None = None

        # Cumulative counters, useful for sizing/cost estimates downstream.
        self.request_count = 0
        self.retry_count = 0
        # Cause-specific retry counters (tick_pull's heartbeat needs http_429s
        # isolated from 5xx/connection-error retries, which retry_count lumps
        # together).
        self.retry_429_count = 0
        self.retry_5xx_count = 0
        self.retry_conn_count = 0

    # ------------------------------------------------------------------ #
    # Low-level request plumbing
    # ------------------------------------------------------------------ #
    def _throttle(self) -> None:
        """Block until at least `min_interval` seconds have passed since the
        last request left this client, enforcing the max req/s ceiling."""
        if self._last_request_at is None:
            return
        elapsed = time.monotonic() - self._last_request_at
        remaining = self.min_interval - elapsed
        if remaining > 0:
            time.sleep(remaining)

    def _sleep_for_retry(self, attempt: int, retry_after: str | None) -> None:
        if retry_after is not None:
            try:
                delay = float(retry_after)
            except ValueError:
                delay = self.backoff_base * (2**attempt)
        else:
            delay = min(self.backoff_cap, self.backoff_base * (2**attempt))
        delay += random.uniform(0, delay * 0.25)  # jitter, avoids thundering herd on shared runs
        logger.warning("retrying after %.1fs (attempt %d/%d)", delay, attempt + 1, self.max_retries)
        time.sleep(delay)

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """GET a path (relative to base_url) with throttling + retry.

        Returns the parsed JSON body. Raises KalshiAPIError if all retries
        are exhausted or a non-retryable (4xx other than 429) status occurs.
        """
        url = f"{self.base_url}{path}" if path.startswith("/") else f"{self.base_url}/{path}"
        clean_params = {k: v for k, v in (params or {}).items() if v is not None}

        last_exc: Exception | None = None
        for attempt in range(self.max_retries + 1):
            self._throttle()
            try:
                self._last_request_at = time.monotonic()
                resp = self._session.get(url, params=clean_params, timeout=self.timeout)
                self.request_count += 1
            except (requests.ConnectionError, requests.Timeout) as exc:
                last_exc = exc
                self.retry_count += 1
                self.retry_conn_count += 1
                logger.warning("connection error on %s: %s", url, exc)
                if attempt < self.max_retries:
                    self._sleep_for_retry(attempt, None)
                    continue
                raise KalshiAPIError(f"GET {url} failed after {self.max_retries} retries: {exc}") from exc

            if resp.status_code == 200:
                return resp.json()

            if resp.status_code == 429 or resp.status_code >= 500:
                self.retry_count += 1
                if resp.status_code == 429:
                    self.retry_429_count += 1
                else:
                    self.retry_5xx_count += 1
                logger.warning("HTTP %d on %s (params=%s)", resp.status_code, url, clean_params)
                if attempt < self.max_retries:
                    self._sleep_for_retry(attempt, resp.headers.get("Retry-After"))
                    continue
                raise KalshiAPIError(
                    f"GET {url} kept returning {resp.status_code} after {self.max_retries} retries"
                )

            # Non-retryable 4xx: surface immediately with response body for debugging.
            raise KalshiAPIError(f"GET {url} -> HTTP {resp.status_code}: {resp.text[:500]}")

        raise KalshiAPIError(f"GET {url} failed: {last_exc}")

    # ------------------------------------------------------------------ #
    # Generic cursor pagination
    # ------------------------------------------------------------------ #
    def paginate(
        self,
        path: str,
        items_key: str,
        params: dict[str, Any] | None = None,
        cursor_param: str = "cursor",
        cursor_key: str = "cursor",
        max_pages: int | None = None,
    ) -> Iterator[dict[str, Any]]:
        """Yield individual items from a cursor-paginated Kalshi list endpoint.

        Works for /series, /events, /markets, /markets/trades: each page is
        a JSON object with a list under `items_key` and a `cursor` string
        that is empty ("") or absent once there is no further page.
        """
        params = dict(params or {})
        cursor: str | None = None
        pages = 0
        while True:
            page_params = dict(params)
            if cursor:
                page_params[cursor_param] = cursor
            body = self.get(path, page_params)
            items = body.get(items_key, [])
            for item in items:
                yield item
            pages += 1
            cursor = body.get(cursor_key) or None
            if not cursor:
                break
            if not items:
                # Defensive: a cursor with zero items would otherwise loop forever.
                break
            if max_pages is not None and pages >= max_pages:
                break

    def paginate_pages(
        self,
        path: str,
        items_key: str,
        params: dict[str, Any] | None = None,
        cursor_param: str = "cursor",
        cursor_key: str = "cursor",
        start_cursor: str | None = None,
        max_pages: int | None = None,
    ) -> Iterator[tuple[list[dict[str, Any]], str | None, str | None]]:
        """Page-level variant of `paginate`: yields (items, cursor_used_for_this_page,
        next_cursor) once per page instead of flattening to individual items.

        Gives callers checkpoint-level control -- e.g. tick_pull.py persists
        `next_cursor` to a resumable ledger after each page so a crashed/
        interrupted pull can resume mid-market instead of re-fetching from
        scratch. `start_cursor` seeds the first page's cursor param, so a
        resumed run can pick up exactly where a prior run left off.
        """
        params = dict(params or {})
        cursor = start_cursor
        pages = 0
        while True:
            page_params = dict(params)
            if cursor:
                page_params[cursor_param] = cursor
            body = self.get(path, page_params)
            items = body.get(items_key, [])
            next_cursor = body.get(cursor_key) or None
            yield items, cursor, next_cursor
            pages += 1
            if not next_cursor:
                break
            if not items:
                # Defensive: a cursor with zero items would otherwise loop forever.
                break
            cursor = next_cursor
            if max_pages is not None and pages >= max_pages:
                break

    # ------------------------------------------------------------------ #
    # Endpoint-specific convenience wrappers
    # ------------------------------------------------------------------ #
    def get_series_list(self, category: str | None = None, **extra: Any) -> list[dict[str, Any]]:
        """GET /series (optionally filtered by category). Paginated defensively,
        though empirically the API returns the whole category in one page."""
        params = {"category": category, **extra}
        return list(self.paginate("/series", items_key="series", params=params))

    def get_series(self, series_ticker: str) -> dict[str, Any]:
        """GET /series/{series_ticker}."""
        body = self.get(f"/series/{series_ticker}")
        return body.get("series", body)

    def get_events(
        self,
        series_ticker: str | None = None,
        status: str | None = None,
        with_nested_markets: bool = False,
        limit: int = 200,
        **extra: Any,
    ) -> list[dict[str, Any]]:
        """GET /events, paginated, for a given series (or all series if omitted)."""
        params = {
            "series_ticker": series_ticker,
            "status": status,
            "with_nested_markets": with_nested_markets or None,
            "limit": limit,
            **extra,
        }
        return list(self.paginate("/events", items_key="events", params=params))

    def get_markets(
        self,
        series_ticker: str | None = None,
        event_ticker: str | None = None,
        status: str | None = None,
        limit: int = 1000,
        **extra: Any,
    ) -> list[dict[str, Any]]:
        """GET /markets, cursor-paginated, limit=1000/page by default."""
        params = {
            "series_ticker": series_ticker,
            "event_ticker": event_ticker,
            "status": status,
            "limit": limit,
            **extra,
        }
        return list(self.paginate("/markets", items_key="markets", params=params))

    def iter_trades(
        self,
        ticker: str,
        min_ts: int | None = None,
        max_ts: int | None = None,
        limit: int = 1000,
        max_pages: int | None = None,
        start_cursor: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        """Stream tick-level trades for one market ticker via GetTrades (live tier).

        limit is capped at 1000/page by the API (1001 is rejected). Use
        min_ts/max_ts (unix seconds) to window a pull; combine with
        max_pages to bound a sizing probe. Only serves trades at/after the
        rolling historical cutoff (see get_historical_cutoff) -- trades
        before the cutoff return empty here even if min_ts/max_ts covers
        them; use iter_historical_trades for those.
        """
        params = {"ticker": ticker, "min_ts": min_ts, "max_ts": max_ts, "limit": limit}
        for items, _cursor_used, _next_cursor in self.paginate_pages(
            "/markets/trades", items_key="trades", params=params, max_pages=max_pages, start_cursor=start_cursor
        ):
            yield from items

    def iter_historical_trades(
        self,
        ticker: str,
        min_ts: int | None = None,
        max_ts: int | None = None,
        limit: int = 1000,
        max_pages: int | None = None,
        start_cursor: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        """Stream tick-level trades via GET /historical/trades (historical tier).

        Same request/response shape as iter_trades (verified empirically
        2026-07-13), but only serves trades strictly before the rolling
        historical cutoff -- see get_historical_cutoff(). Markets settled
        long enough ago migrate entirely off the live tier, so full-history
        pulls need both this and iter_trades, split at the cutoff.
        """
        params = {"ticker": ticker, "min_ts": min_ts, "max_ts": max_ts, "limit": limit}
        for items, _cursor_used, _next_cursor in self.paginate_pages(
            "/historical/trades", items_key="trades", params=params, max_pages=max_pages, start_cursor=start_cursor
        ):
            yield from items

    def get_historical_cutoff(self) -> dict[str, int | None]:
        """GET /historical/cutoff -- the rolling boundary (currently ~2 months
        trailing) between the live tier (/markets/trades, candlesticks) and
        the historical tier (/historical/trades). Returns UTC epoch seconds
        for each of the three cutoff fields Kalshi exposes (as of 2026-07-13
        they are always equal, but callers should use the field relevant to
        what they're pulling -- trades_created_ts for GetTrades)."""
        body = self.get("/historical/cutoff")
        return {
            "market_settled_ts": iso_datetime_to_epoch(body.get("market_settled_ts")),
            "trades_created_ts": iso_datetime_to_epoch(body.get("trades_created_ts")),
            "orders_updated_ts": iso_datetime_to_epoch(body.get("orders_updated_ts")),
        }

    def get_candlesticks(
        self,
        series_ticker: str,
        ticker: str,
        start_ts: int,
        end_ts: int,
        period_interval: int = 1,
    ) -> list[dict[str, Any]]:
        """GET /series/{series_ticker}/markets/{ticker}/candlesticks.

        Single call, not paginated by cursor: the API instead errors if the
        requested [start_ts, end_ts] window would exceed 5000 candlesticks
        at the given period_interval (1/60/1440 minutes) -- callers must
        chunk the window themselves for long-lived markets.
        """
        params = {"period_interval": period_interval, "start_ts": start_ts, "end_ts": end_ts}
        body = self.get(f"/series/{series_ticker}/markets/{ticker}/candlesticks", params)
        return body.get("candlesticks", [])
