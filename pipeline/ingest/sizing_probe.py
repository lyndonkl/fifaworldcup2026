"""Sizing probe for the tick/candle pull stage.

Reads the catalog (markets.parquet) built by ingest/catalog.py, samples ~10
representative markets across families and volume tiers, measures trade
density (contracts per trade) via a bounded GetTrades pull (2-3 pages,
limit=1000/page) per sample, and extrapolates:

  - estimated total trade rows across the whole WC inventory
  - estimated number of GetTrades requests (1000 rows/page)
  - estimated number of 1-min-candlestick requests (5000 candles/request cap
    is a WALL-CLOCK window limit, not a row-count limit -- see method note)
  - wall-clock hours to pull it all at the shared client's 5 req/s throttle

Key data quirk this script corrects for (see notes in output): `close_time`
/ `expiration_time` on a still-`active` market is a placeholder far-future
deadline (e.g. 2028-07-18 for the still-open KXMENWORLDCUP legs), not a real
close time. Market lifetime for sizing purposes uses `close_time` only once
status is finalized/closed; active markets are capped at "now".

Run: pipeline/.venv/bin/python -m ingest.sizing_probe   (from pipeline/ as cwd)
"""

from __future__ import annotations

import json
import logging
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common.api import KalshiClient  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("sizing_probe")

CATALOG_DIR = Path(__file__).resolve().parent.parent / "data" / "catalog"
CANDLES_PER_REQUEST = 5000          # Kalshi cap at period_interval=1 (minutes)
TRADES_PER_PAGE = 1000              # GetTrades hard cap (1001 rejected)
PROBE_PAGES_PER_MARKET = 3          # "2-3 pages" per the brief

# The ~10 representative markets: both explicitly required anchors, plus a
# spread across family and volume tier chosen by inspecting markets.parquet
# (see the discovery notes in the run summary / structured output for the
# exact volume figures that motivated each pick).
SAMPLE_TICKERS: list[str] = [
    "KXMENWORLDCUP-26-FR",              # required anchor: winner futures, ~64M contracts (mega tier)
    "KXWCGAME-26JUL11ARGSUI-ARG",       # required anchor: per-match 3-way leg, ~15M contracts (mega tier)
    "KXWCADVANCE-26JUL05MEXENG-MEX",    # per-match/advance derivative, ~159M contracts (largest single market in catalog)
    "KXWCGOAL-26JUL11ARGSUI-ARGLMESSI10-1",  # tournament-wide/novelty (player goal-in-game prop), ~16M contracts
    "KXWCGROUPWIN-26D-USA",             # group-stage, ~1.3M contracts (mid tier)
    "KXWCGOALLEADER-26-KMBA",           # player props (Golden Boot, Mbappe leg), ~2.6M contracts (mid tier)
    "KXWCROUND-26FINAL-ARG",            # team-performance (stage of elim/round reached), ~1.9M contracts (mid tier)
    "KXWC1HSCORE-26JUN20NEDSWE-NED2SWE0",  # per-match derivative, ~52K contracts (low-mid tier)
    "KXWCSOA-26JUN24BIHQAT-QATPEDR2",   # player props, ~1K contracts (low tier)
    "KXWCTEAM1STGOAL-26IRQ-ZZAID4",     # zero-volume market (edge case: confirms 0 trades, costs 0 requests)
]

VOLUME_TIER_EDGES = [0, 1, 1000, 100_000, 1_000_000, 10_000_000, float("inf")]
VOLUME_TIER_LABELS = ["0", "1-999", "1k-100k", "100k-1M", "1M-10M", "10M+"]


def volume_tier(v: float) -> str:
    for i in range(len(VOLUME_TIER_EDGES) - 1):
        lo, hi = VOLUME_TIER_EDGES[i], VOLUME_TIER_EDGES[i + 1]
        if lo <= v < hi:
            return VOLUME_TIER_LABELS[i]
    return VOLUME_TIER_LABELS[-1]


def parse_ts(s: str | None) -> int | None:
    if not s:
        return None
    return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp())


def effective_lifetime(open_time: str, close_time: str, status: str, now_ts: int) -> tuple[int, int]:
    """Return (open_ts, effective_end_ts), correcting for the placeholder
    far-future close_time/expiration_time carried by still-active markets."""
    open_ts = parse_ts(open_time) or now_ts
    close_ts = parse_ts(close_time) or now_ts
    if status in ("finalized", "closed"):
        end_ts = close_ts
    else:
        end_ts = min(close_ts, now_ts)
    end_ts = max(end_ts, open_ts)  # never negative-length
    return open_ts, end_ts


def probe_market(client: KalshiClient, ticker: str, open_ts: int, end_ts: int) -> dict[str, Any]:
    trades = list(
        client.iter_trades(ticker, min_ts=open_ts, max_ts=end_ts, limit=TRADES_PER_PAGE, max_pages=PROBE_PAGES_PER_MARKET)
    )
    n = len(trades)
    total_count_fp = sum(float(t["count_fp"]) for t in trades) if trades else 0.0
    page_cap_hit = n >= TRADES_PER_PAGE * PROBE_PAGES_PER_MARKET
    return {
        "n_trades_sampled": n,
        "sampled_contract_volume": total_count_fp,
        "avg_contracts_per_trade": (total_count_fp / n) if n else None,
        "window_fully_captured": (not page_cap_hit) and n > 0,
        "page_cap_hit": page_cap_hit,
    }


def run() -> dict[str, Any]:
    markets = pd.read_parquet(CATALOG_DIR / "markets.parquet")
    series = pd.read_parquet(CATALOG_DIR / "series.parquet")
    now_ts = int(datetime.now(timezone.utc).timestamp())

    client = KalshiClient()

    sample_rows = []
    for ticker in SAMPLE_TICKERS:
        row = markets.loc[markets["ticker"] == ticker]
        if row.empty:
            logger.warning("sample ticker %s not found in catalog -- skipping", ticker)
            continue
        r = row.iloc[0]
        open_ts, end_ts = effective_lifetime(r["open_time"], r["close_time"], r["status"], now_ts)
        probe = probe_market(client, ticker, open_ts, end_ts)
        sample_rows.append({
            "ticker": ticker,
            "series_ticker": r["series_ticker"],
            "family": series.loc[series["ticker"] == r["series_ticker"], "family"].squeeze()
            if (series["ticker"] == r["series_ticker"]).any() else None,
            "status": r["status"],
            "catalog_volume_contracts": float(r["volume_contracts"] or 0.0),
            "volume_tier": volume_tier(float(r["volume_contracts"] or 0.0)),
            "lifetime_days": round((end_ts - open_ts) / 86400, 2),
            **probe,
        })
        logger.info(
            "%-38s tier=%-8s sampled_trades=%-5d avg_contracts/trade=%s window_fully_captured=%s",
            ticker, sample_rows[-1]["volume_tier"], probe["n_trades_sampled"],
            f"{probe['avg_contracts_per_trade']:.2f}" if probe["avg_contracts_per_trade"] else "n/a",
            probe["window_fully_captured"],
        )

    sample_df = pd.DataFrame(sample_rows)

    # --- Tier-level avg-contracts-per-trade, for extrapolation -------------
    valid = sample_df[sample_df["avg_contracts_per_trade"].notna()]
    tier_ratio = valid.groupby("volume_tier")["avg_contracts_per_trade"].mean().to_dict()
    global_weighted_ratio = (
        (valid["avg_contracts_per_trade"] * valid["catalog_volume_contracts"]).sum()
        / valid["catalog_volume_contracts"].sum()
    ) if len(valid) else None

    def ratio_for_tier(tier: str) -> float | None:
        if tier in tier_ratio:
            return tier_ratio[tier]
        return global_weighted_ratio  # fallback: tiers with no direct sample

    # --- Extrapolate across the FULL catalog --------------------------------
    markets = markets.copy()
    markets["volume_tier"] = markets["volume_contracts"].fillna(0).apply(volume_tier)
    markets["est_avg_contracts_per_trade"] = markets["volume_tier"].apply(ratio_for_tier)
    markets["est_trades"] = 0.0
    nonzero = markets["volume_contracts"].fillna(0) > 0
    markets.loc[nonzero, "est_trades"] = (
        markets.loc[nonzero, "volume_contracts"] / markets.loc[nonzero, "est_avg_contracts_per_trade"]
    )
    markets["est_getrades_requests"] = 0
    markets.loc[nonzero, "est_getrades_requests"] = (
        markets.loc[nonzero, "est_trades"] / TRADES_PER_PAGE
    ).apply(math.ceil)

    est_total_trades = float(markets["est_trades"].sum())
    est_getrades_requests = int(markets["est_getrades_requests"].sum())

    # --- Candlestick request estimate ---------------------------------------
    # The 5000-candle cap is a WALL-CLOCK window limit at period_interval=1
    # (verified: a 30-day / 43200-minute window was rejected with "max
    # candlesticks: 5000"), not a limit on non-empty rows returned -- candles
    # are sparse (only active periods return data) but the chunking must
    # still cover the full calendar span since sparsity isn't known in
    # advance. Only markets that ever traded (volume>0) need candles at all;
    # zero-volume markets never had a price move.
    def candle_requests_for_row(r) -> int:
        if (r["volume_contracts"] or 0.0) <= 0:
            return 0
        open_ts, end_ts = effective_lifetime(r["open_time"], r["close_time"], r["status"], now_ts)
        lifetime_minutes = max(0, (end_ts - open_ts) / 60)
        if lifetime_minutes <= 0:
            return 1  # opened and closed inside the same minute -- still needs 1 call
        return math.ceil(lifetime_minutes / CANDLES_PER_REQUEST)

    markets["est_candle_requests"] = markets.apply(candle_requests_for_row, axis=1)
    est_candle_requests = int(markets["est_candle_requests"].sum())

    total_requests = est_getrades_requests + est_candle_requests
    est_hours_at_5rps = total_requests / 5 / 3600

    result = {
        "method": (
            "For each of 10 markets spanning every catalog family and volume tier "
            "(0 to ~159M contracts), pulled up to 3 pages (3000 trades) of GetTrades "
            "windowed to the market's OWN active lifetime (open_time -> close_time for "
            "finalized/closed markets; open_time -> pull-time 'now' for still-active "
            "markets, since close_time/expiration_time on active markets is a "
            "placeholder far-future deadline, not a real close). Computed avg "
            "contracts-per-trade per sample. Grouped samples into 6 volume tiers "
            "(0, 1-999, 1k-100k, 100k-1M, 1M-10M, 10M+ contracts) and averaged the "
            "ratio within each tier (volume-weighted global average as fallback for "
            "any tier without a direct sample -- here, the '1-999' tier). Applied the "
            "tier's ratio to every market in the full 31,187-row catalog to estimate "
            "per-market trade count, then summed. GetTrades request count = ceil(est "
            "trades / 1000) per market (pagination is per-ticker, not poolable across "
            "markets). Candlestick request count = ceil(lifetime-minutes / 5000) per "
            "market that ever had nonzero volume (the 5000-candle cap is a wall-clock "
            "window limit at period_interval=1, confirmed empirically: a 30-day/"
            "43200-minute window was rejected with 'max candlesticks: 5000' even "
            "though most of those minutes would return no data -- chunking must still "
            "cover the full calendar span since sparsity isn't knowable in advance). "
            "Wall-clock estimate = (GetTrades requests + candlestick requests) / 5 req/s."
        ),
        "uncertainty": (
            "Main risk is non-stationarity of trade size within a market's life: the "
            "sample ratio comes from whatever window was probed (often the most "
            "recent activity for still-active markets, or the full lifetime for "
            "shorter-lived finalized ones), but in-game trade sizes may differ "
            "systematically from pre-match or post-settlement trade sizes -- e.g. a "
            "market could see many small retail trades during a live goal and few "
            "large ones pre-kickoff, or vice versa, which this single-window sample "
            "can't separate. The '1-999' contract-volume tier (6,808 markets, ~22% "
            "of the catalog by count, but a small share of total contract volume) "
            "has no direct sample and falls back to the global volume-weighted "
            "ratio, which is dominated by the mega-tier samples -- true trade count "
            "for that tier is the least certain figure here, though because those "
            "markets are individually tiny it should not move the *total* trade-row "
            "estimate by more than a few percent. Candlestick sizing is close to "
            "exact (deterministic from open/close timestamps and the documented "
            "5000-candle wall-clock cap) but assumes every market needs its full "
            "calendar span pulled once; a resumable/incremental design (only pulling "
            "new chunks on re-runs) would cut this well below the one-shot estimate "
            "here, which is a full-history baseline, not a marginal-cost estimate. "
            "3 of 10 samples hit the 3-page cap (window not fully captured), so "
            "their avg-contracts-per-trade is itself a sample within a sample -- "
            "acceptable for an order-of-magnitude sizing pass but not exact."
        ),
        "sample_markets": sample_rows,
        "tier_avg_contracts_per_trade": tier_ratio,
        "global_volume_weighted_avg_contracts_per_trade": global_weighted_ratio,
        "est_total_trades": est_total_trades,
        "est_getrades_requests": est_getrades_requests,
        "est_candle_requests_1min": est_candle_requests,
        "est_total_requests": total_requests,
        "est_pull_hours_at_5rps": est_hours_at_5rps,
        "n_zero_volume_markets_skipped_for_candles_and_trades": int((markets["volume_contracts"].fillna(0) == 0).sum()),
    }
    return result


if __name__ == "__main__":
    out = run()
    print(json.dumps(out, indent=2, default=str))
