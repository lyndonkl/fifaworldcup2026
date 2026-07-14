#!/usr/bin/env python3
"""Watch a Kalshi market until it reaches a terminal status, then run the
--since incremental re-drive (audit follow-up G1: capture the pre-match
surge + in-game tape + settlement tail for all active markets).

Usage: settle_watch.py TICKER [--since ISO8601] [--timeout-hours N]
Polls GET /markets/{ticker} every 10 minutes (2 tokens/poll, negligible).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from common.api import KalshiClient  # noqa: E402

TERMINAL = {"finalized", "closed", "settled"}
POLL_SECONDS = 600


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ticker")
    ap.add_argument("--since", default="2026-07-14T05:00:00Z",
                    help="since_ts handed to tick_pull once the market settles")
    ap.add_argument("--timeout-hours", type=float, default=6.0)
    args = ap.parse_args()

    client = KalshiClient(max_requests_per_second=1.0)
    deadline = time.time() + args.timeout_hours * 3600
    while time.time() < deadline:
        markets = client.get_markets(tickers=args.ticker, limit=1)
        status = markets[0].get("status", "?") if markets else "?"
        print(f"[{datetime.now(timezone.utc).isoformat()}] {args.ticker} status={status}", flush=True)
        if status in TERMINAL:
            break
        time.sleep(POLL_SECONDS)
    else:
        print("timeout reached without settlement -- running re-drive anyway", flush=True)

    print("launching --since re-drive", flush=True)
    root = Path(__file__).resolve().parents[2]
    subprocess.run(
        [str(root / "pipeline/.venv/bin/python"), str(root / "pipeline/ingest/tick_pull.py"),
         "--since", args.since],
        check=True,
    )


if __name__ == "__main__":
    main()
