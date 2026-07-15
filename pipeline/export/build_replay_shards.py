#!/usr/bin/env python3
"""
pipeline/export/build_replay_shards.py -- Regulation Time, S18 coda shards.

The documented follow-up to build_tiles.py (TILES.md sec 5 / sec 6): builds
the per-market RTSER1 price-life shards the "Regulation Time" scrollytelling
coda (scene S18, docs/js/scenes/s18.js) fetches lazily on selection, and
rewrites docs/data/replay/index.json so every picker row carries a `shard`
URL, a human `title`, and a `settlement` label.

Run (no arguments; safe to re-run at any time -- every byte written is a pure
function of the current contents of pipeline/data/ and the picker rows in
docs/data/replay/index.json):

    pipeline/.venv/bin/python pipeline/export/build_replay_shards.py

--------------------------------------------------------------------------
RTSER1 header encoding (matched EXACTLY to shared.js's reader AND to
build_tiles.py's pack_series()/pack_columns()):

    bytes  0..7   magic     b"RTSER1\\x00\\x00"        (8 bytes)
    bytes  8..11  count     struct.pack("<I", n)      (u32 LE, # of f32)
    bytes 12..15  reserved  struct.pack("<I", 0)      (u32 LE, always 0)
    bytes 16..    payload   n little-endian float32   (starts at offset 16)

    total bytes = 16 + 4*n

docs/js/scenes/s18.js `loadReplayShard(url)` does exactly:
    const count = checkMagic(buf, 'RTSER1\\0\\0');           // shared.js
    return columnViews(buf, [{name:'v', dtype:'f32', offset:16}], count).v;
and shared.js's `checkMagic` reads the u32 count at byte 8 (little-endian),
while `columnViews` builds `new Float32Array(buffer, 16, count)`. The 16-byte
header is 4-byte aligned and the f32 payload is 4-byte aligned, so the single
"v" column lands at offset 16 with no padding -- byte-for-byte identical to
what `pack_columns(b"RTSER1\\x00\\x00", n, [("v", arr_f32)])` would emit. The
round-trip is asserted at build time by `js_read_shard()` (a faithful Python
port of the two shared.js functions) on a sample of the shards written.

--------------------------------------------------------------------------
Price-life series (per market):

  * Source (prefer candles). Read the market's own 1-minute candle file
    pipeline/data/kalshi/candles/series_ticker=<SERIES>/<TICKER>.parquet.
    The yes-price for a minute is `price_close_usd` (last trade in the
    minute); where a minute had no trade it is the standing-quote midpoint
    (yes_bid_close_usd + yes_ask_close_usd)/2, else `price_mean_usd`, else a
    forward-fill of the last known price. Kalshi's yes price in dollars *is*
    the implied probability (a $0.57 yes = 57%), so points = price * 100,
    clamped to 0..100, stored as f32.
  * Fallback (trades). If the market has no candle file (or no usable candle
    price at all), read its trade tape
    pipeline/data/kalshi/trades/series_ticker=<SERIES>/<TICKER>.parquet,
    keep the last yes_price_usd per second (R1/R8: explicit per-file read,
    ms/second-precision ordering by (created_ts, trade_id)), and resample to
    a 1-minute last-price grid.

  * Defect handling (research/data-audit.md R1-R9, the same rules build_tiles
    applies once at export):
      - Ordering (R1/R8): each market is read from its own single parquet
        file and sorted explicitly (candles by end_period_ts; trades by
        (created_ts, trade_id)) -- never relying on glob/scan order.
      - Drop bogus terminal ticks on settled markets (R9 lifetime gating):
        for a settled/voided market, trim the trailing run of zero-volume
        candles that follows the last candle with real matched volume. That
        run is the post-settlement stale carry-forward / settlement-snap
        placeholder, not price life; the shard therefore ends at the last
        minute that actually traded. Alive-at-freeze markets are left whole.
      - Prices are clamped to the probability range; NaNs are filled from the
        quote/mean/forward-fill ladder above so a shard is never partial.

  * Downsample to at most MAX_POINTS (150) points, preserving the first and
    last point, via even-stride index selection
    `np.unique(np.linspace(0, n-1, MAX_POINTS).round().astype(int))` -- the
    same np.linspace decimation convention build_tiles.py's df_records() uses.
--------------------------------------------------------------------------
"""

import json
import os
import re
import struct
import sys
import time

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# Paths (mirrors build_tiles.py's ROOT/DATA/OUT convention)
# --------------------------------------------------------------------------
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PIPE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(PIPE, "data")
OUT = os.path.join(ROOT, "docs", "data")
CANDLES_ROOT = os.path.join(DATA, "kalshi", "candles")
TRADES_ROOT = os.path.join(DATA, "kalshi", "trades")
REPLAY_DIR = os.path.join(OUT, "replay")
SHARDS_DIR = os.path.join(REPLAY_DIR, "shards")
INDEX_PATH = os.path.join(REPLAY_DIR, "index.json")

MAX_POINTS = 150
MAGIC = b"RTSER1\x00\x00"

_t0 = time.time()


def log(msg):
    print(f"[{time.time() - _t0:7.2f}s] {msg}", flush=True)


# --------------------------------------------------------------------------
# 1. RTSER1 packer + a faithful Python port of shared.js's reader
# --------------------------------------------------------------------------

def pack_shard(values) -> bytes:
    """Pack a 1-D sequence of floats into the RTSER1 single-section binary
    S18 expects. Byte-identical to pack_columns(MAGIC, n, [("v", arr)])."""
    a = np.ascontiguousarray(np.asarray(values, dtype="<f4"))
    buf = bytearray()
    buf += MAGIC                          # 8 bytes
    buf += struct.pack("<I", int(a.size))  # u32 count @ byte 8
    buf += struct.pack("<I", 0)            # u32 reserved @ byte 12
    buf += a.tobytes()                     # f32 payload @ byte 16
    return bytes(buf)


def js_read_shard(buf: bytes) -> np.ndarray:
    """Read a shard exactly as docs/js/shared.js does.

    shared.js checkMagic(buffer, 'RTSER1\\0\\0'):
        - first magic.length bytes must equal the magic string
        - returns new DataView(buffer).getUint32(8, true)   # u32 LE @ byte 8
    shared.js columnViews(buffer, [{name:'v',dtype:'f32',offset:16}], count):
        - new Float32Array(buffer, 16, count)               # LE f32 @ 16
    """
    got = bytes(buf[0:len(MAGIC)])
    if got != MAGIC:
        raise ValueError(f"bad magic: {got!r}")
    count = struct.unpack_from("<I", buf, 8)[0]        # getUint32(8, true)
    if 16 + 4 * count > len(buf):
        raise ValueError("declared count overruns buffer")
    return np.frombuffer(buf, dtype="<f4", count=count, offset=16)


# --------------------------------------------------------------------------
# 2. Price-life series builders
# --------------------------------------------------------------------------

def _num(df, col):
    return pd.to_numeric(df[col], errors="coerce") if col in df.columns else pd.Series(
        np.full(len(df), np.nan), index=df.index)


def yes_series_from_candles(df: pd.DataFrame, settled: bool):
    """Return (points_0_100 float array, n_source_rows) or (None, n) if the
    candle file yields no usable price. Applies the defect rules above."""
    df = df.sort_values("end_period_ts", kind="mergesort").reset_index(drop=True)  # R1/R8 ordering
    close = _num(df, "price_close_usd")
    mean = _num(df, "price_mean_usd")
    bid = _num(df, "yes_bid_close_usd")
    ask = _num(df, "yes_ask_close_usd")
    vol = _num(df, "volume_contracts").fillna(0.0)

    mid = (bid + ask) / 2.0
    mid = mid.where((bid > 0) & (ask > 0) & (bid <= 1) & (ask <= 1))

    # yes-price ladder: last trade -> quote midpoint -> minute mean -> ffill/bfill
    y = close.where(close.notna(), mid)
    y = y.where(y.notna(), mean)
    y = y.ffill().bfill()

    if y.notna().sum() == 0:
        return None, len(df)

    # R9 / "drop bogus terminal ticks on settled markets": trim the trailing
    # zero-volume run that follows the last minute with real matched volume.
    if settled and (vol.values > 0).any():
        last_active = int(np.where(vol.values > 0)[0].max())
        y = y.iloc[: last_active + 1]

    pts = np.clip(y.values.astype(np.float64), 0.0, 1.0) * 100.0
    pts = pts[np.isfinite(pts)]
    if pts.size == 0:
        return None, len(df)
    return pts.astype(np.float32), len(df)


def yes_series_from_trades(path: str):
    """Fallback: resample the market's trade tape to a 1-minute last-yes-price
    series. Returns (points_0_100 float array, n_trades) or (None, n)."""
    cols = ["created_ts", "trade_id", "yes_price_usd"]
    df = pd.read_parquet(path, columns=cols)
    if len(df) == 0:
        return None, 0
    df = df.sort_values(["created_ts", "trade_id"], kind="mergesort")  # R1/R8 ordering
    idx = pd.to_datetime(df["created_ts"].values, unit="s")
    s = pd.Series(pd.to_numeric(df["yes_price_usd"].values, errors="coerce"), index=idx)
    s = s[~s.index.duplicated(keep="last")]       # ms/second-precision: last wins
    r = s.resample("1min").last().ffill().dropna()
    if len(r) == 0:
        return None, len(df)
    pts = np.clip(r.values.astype(np.float64), 0.0, 1.0) * 100.0
    pts = pts[np.isfinite(pts)]
    if pts.size == 0:
        return None, len(df)
    return pts.astype(np.float32), len(df)


def downsample(pts: np.ndarray) -> np.ndarray:
    """Even-stride decimation to <= MAX_POINTS, preserving first & last."""
    n = len(pts)
    if n <= MAX_POINTS:
        return pts
    idx = np.unique(np.linspace(0, n - 1, MAX_POINTS).round().astype(int))
    return pts[idx]


def series_of(ticker: str) -> str:
    return ticker.split("-", 1)[0]


def build_market_series(ticker: str, fate: str):
    """Full pipeline for one market -> (points f32 <=150, source_str, n_src).
    Returns (None, reason, 0) if there is no usable series anywhere."""
    settled = fate in ("settled_yes", "settled_no", "voided")
    series = series_of(ticker)
    cpath = os.path.join(CANDLES_ROOT, f"series_ticker={series}", f"{ticker}.parquet")
    tpath = os.path.join(TRADES_ROOT, f"series_ticker={series}", f"{ticker}.parquet")

    pts = None
    src = None
    n_src = 0
    if os.path.exists(cpath):
        try:
            want = ["end_period_ts", "price_close_usd", "price_mean_usd",
                    "yes_bid_close_usd", "yes_ask_close_usd", "volume_contracts"]
            have = pd.read_parquet(cpath).columns
            cdf = pd.read_parquet(cpath, columns=[c for c in want if c in have])
            pts, n_src = yes_series_from_candles(cdf, settled)
            src = "candles"
        except Exception as e:  # noqa: BLE001
            log(f"  ! candle read failed for {ticker}: {e}")

    if pts is None and os.path.exists(tpath):  # fallback to trades
        try:
            pts, n_src = yes_series_from_trades(tpath)
            src = "trades"
        except Exception as e:  # noqa: BLE001
            log(f"  ! trade read failed for {ticker}: {e}")

    if pts is None or len(pts) == 0:
        return None, "no-usable-series", n_src
    return downsample(pts), src, n_src


# --------------------------------------------------------------------------
# 3. Human titles + settlement labels (deterministic from ticker/family/team)
# --------------------------------------------------------------------------

KMWC_TO_FIFA3 = {
    "AR": "ARG", "AT": "AUT", "AU": "AUS", "BE": "BEL", "BIH": "BIH", "BR": "BRA",
    "CA": "CAN", "CH": "SUI", "CIV": "CIV", "CO": "COL", "COD": "COD", "CPV": "CPV",
    "CUW": "CUW", "CZE": "CZE", "DE": "GER", "DZA": "DZA", "EC": "ECU", "EGY": "EGY",
    "ES": "ESP", "FR": "FRA", "GB": "ENG", "GH": "GHA", "HR": "CRO", "HTI": "HTI",
    "IR": "IRI", "IRQ": "IRQ", "JOR": "JOR", "JP": "JPN", "KR": "KOR", "MA": "MAR",
    "MX": "MEX", "NL": "NED", "NO": "NOR", "NZL": "NZL", "PAN": "PAN", "PT": "POR",
    "PY": "PAR", "QAT": "QAT", "RSA": "RSA", "SA": "KSA", "SC": "SCO", "SE": "SWE",
    "SN": "SEN", "TN": "TUN", "TR": "TUR", "US": "USA", "UY": "URU", "UZB": "UZB",
}
FIFA3_NAME = {
    "ARG": "Argentina", "AUS": "Australia", "AUT": "Austria", "BEL": "Belgium",
    "BIH": "Bosnia & Herzegovina", "BRA": "Brazil", "CAN": "Canada", "CIV": "Ivory Coast",
    "COD": "DR Congo", "COL": "Colombia", "CPV": "Cape Verde", "CRO": "Croatia",
    "CUW": "Curacao", "CZE": "Czechia", "DZA": "Algeria", "ECU": "Ecuador",
    "EGY": "Egypt", "ENG": "England", "ESP": "Spain", "FRA": "France", "GER": "Germany",
    "GHA": "Ghana", "HTI": "Haiti", "IRI": "Iran", "IRQ": "Iraq", "JOR": "Jordan",
    "JPN": "Japan", "KOR": "South Korea", "KSA": "Saudi Arabia", "MAR": "Morocco",
    "MEX": "Mexico", "NED": "Netherlands", "NOR": "Norway", "NZL": "New Zealand",
    "PAN": "Panama", "PAR": "Paraguay", "POR": "Portugal", "QAT": "Qatar",
    "RSA": "South Africa", "SCO": "Scotland", "SEN": "Senegal", "SUI": "Switzerland",
    "SWE": "Sweden", "TUN": "Tunisia", "TUR": "Turkey", "URU": "Uruguay",
    "USA": "United States", "UZB": "Uzbekistan",
}
FAMILY_LABEL = {
    "winner_futures": "Tournament Winner", "match_3way": "Match Result",
    "advancement": "To Advance", "spread_total_score": "Match Prop",
    "group": "Group Stage", "stage_elimination": "Stage of Elimination",
    "golden_boot": "Golden Boot", "host_novelty_prop": "Novelty Market",
    "other": "Market",
}
SERIES_LABEL = {
    "KXWCTOTAL": "Total Goals", "KXWCSPREAD": "Spread", "KXWCSCORE": "Correct Score",
    "KXWCBTTS": "Both Teams to Score", "KXWCCORNERS": "Corners", "KXWCFIRSTGOAL": "First Goal",
    "KXWC1H": "1st Half Result", "KXWC2H": "2nd Half Result", "KXWC1HTOTAL": "1st Half Total",
    "KXWC1HSPREAD": "1st Half Spread", "KXWC1HSCORE": "1st Half Score",
    "KXWC1HBTTS": "1st Half BTTS", "KXWC2HTOTAL": "2nd Half Total",
    "KXWC2HSPREAD": "2nd Half Spread", "KXWC2HBTTS": "2nd Half BTTS",
    "KXWC2HTOTAL": "2nd Half Total", "KXWCGAME": "Match Result", "KXWCADVANCE": "To Advance",
}

_DATE_RE = re.compile(r"^\d{2}[A-Z]{3}\d{2}")


def is_team(code):
    """True only for codes that resolve to a real team (not e.g. a line value)."""
    return bool(code) and (code.upper() in FIFA3_NAME or code.upper() in KMWC_TO_FIFA3)


def team_name(code):
    if not code:
        return None
    code = code.upper()
    return FIFA3_NAME.get(code, FIFA3_NAME.get(KMWC_TO_FIFA3.get(code, ""), code))


def _match_pair(parts):
    """Parse the two-team match segment from the ticker's middle field
    (e.g. '26JUL05MEXENG' -> ('Mexico', 'England'))."""
    if len(parts) < 2:
        return (None, None)
    seg = _DATE_RE.sub("", parts[1])
    if len(seg) == 6 and seg.isalpha():
        return (team_name(seg[:3]), team_name(seg[3:]))
    return (None, None)


def _humanize_series(series):
    s = re.sub(r"^KX(WC|MEN)?", "", series)
    return SERIES_LABEL.get(series, s.title() or series)


def make_title(ticker, family, team):
    """A human label derived purely from ticker/family/team."""
    try:
        parts = ticker.split("-")
        series = parts[0]
        leg = parts[-1]
        team = None if team in (None, "", "—", "—") else team

        if family == "winner_futures":
            code = team or KMWC_TO_FIFA3.get(leg, leg)
            return f"{team_name(code) or code} — Champion?"

        a, b = _match_pair(parts)

        if family == "advancement":
            who = team_name(team or KMWC_TO_FIFA3.get(leg, leg)) or leg
            return f"{a} vs {b} — {who} to Advance" if a and b else f"{who} — To Advance"

        if family == "match_3way":
            outcome = "Draw" if leg.upper() in ("TIE", "DRAW") else (team_name(leg) or leg)
            return f"{a} vs {b} — {outcome}" if a and b else f"{outcome} — Match Result"

        if family == "spread_total_score":
            label = SERIES_LABEL.get(series, _humanize_series(series))
            line = "" if is_team(leg) else leg   # keep the total/spread line value
            head = f"{a} vs {b} — " if a and b else ""
            return f"{head}{label} {line}".strip()

        if family == "group":
            who = team_name(team) if team else None
            return f"{who} — Group Stage" if who else f"{_humanize_series(series)} — Group Stage"

        # golden_boot / stage_elimination / host_novelty_prop / other
        base = FAMILY_LABEL.get(family, _humanize_series(series))
        who = team_name(team) if team else None
        if who:
            return f"{base} — {who}"
        tail = _humanize_series(series)
        return f"{base}" if base.lower() == tail.lower() else f"{base} — {tail}"
    except Exception:  # noqa: BLE001 -- a label must never crash the build
        return ticker


SETTLEMENT = {
    "settled_yes": "settled yes",
    "settled_no": "settled no",
    "alive_at_freeze": "still trading",
    "voided": "voided",
}


def make_settlement(fate):
    return SETTLEMENT.get(fate, "settlement pending")


# --------------------------------------------------------------------------
# 4. Main
# --------------------------------------------------------------------------

def main():
    with open(INDEX_PATH) as f:
        index = json.load(f)
    # accept either the {note, markets:[...]} shape or a bare array
    markets = index["markets"] if isinstance(index, dict) else index
    log(f"loaded {len(markets)} picker rows from {INDEX_PATH}")

    os.makedirs(SHARDS_DIR, exist_ok=True)

    written, sizes, no_series, from_trades = 0, [], [], []
    new_rows = []
    for i, m in enumerate(markets):
        ticker = m["ticker"]
        fate = m.get("fate", "")
        row = {
            "ticker": ticker,
            "family": m.get("family"),
            "team": m.get("team"),
            "dollars": m.get("dollars"),
            "fate": fate,
            "title": make_title(ticker, m.get("family"), m.get("team")),
            "settlement": make_settlement(fate),
        }
        pts, src, n_src = build_market_series(ticker, fate)
        if pts is None:
            no_series.append(ticker)
            # no `shard` key -> s18.js catches the missing fetch and shows
            # "price life unavailable" for just this one row (graceful).
        else:
            data = pack_shard(pts)
            with open(os.path.join(SHARDS_DIR, f"{ticker}.bin"), "wb") as f:
                f.write(data)
            row["shard"] = f"data/replay/shards/{ticker}.bin"
            written += 1
            sizes.append(len(data))
            if src == "trades":
                from_trades.append(ticker)
        new_rows.append(row)
        if (i + 1) % 100 == 0:
            log(f"  {i + 1}/{len(markets)} processed ({written} shards)")

    # ---- byte-for-byte JS round-trip verification on a sample ----
    _verify_sample(new_rows)

    # ---- rewrite index.json: same top-level shape, drop `note` ----
    out_index = {"markets": new_rows}
    with open(INDEX_PATH, "w") as f:
        json.dump(out_index, f, separators=(",", ":"))
    log(f"rewrote {INDEX_PATH} (dropped stale note; added shard/title/settlement)")

    # ---- report ----
    _report(written, sizes, no_series, from_trades)


def _verify_sample(rows):
    sample = [r for r in rows if "shard" in r]
    if not sample:
        log("verify: no shards written to verify")
        return
    picks = {0, len(sample) // 2, len(sample) - 1}
    for j in sorted(picks):
        r = sample[j]
        path = os.path.join(OUT, r["shard"].replace("data/", "", 1))
        with open(path, "rb") as f:
            buf = f.read()
        v = js_read_shard(buf)                       # faithful shared.js port
        assert len(buf) == 16 + 4 * len(v), (len(buf), len(v))
        assert v.dtype == np.dtype("<f4")
        assert np.all(np.isfinite(v)) and v.min() >= 0.0 and v.max() <= 100.0, (v.min(), v.max())
        assert len(v) <= MAX_POINTS
        log(f"verify OK: {r['ticker']} -> {len(v)} pts, {len(buf)} B, "
            f"range [{v.min():.1f},{v.max():.1f}], JS columnViews round-trips")


def _report(written, sizes, no_series, from_trades):
    def dir_bytes(d):
        tot = 0
        for base, _dirs, files in os.walk(d):
            for fn in files:
                tot += os.path.getsize(os.path.join(base, fn))
        return tot

    shards_bytes = sum(sizes)
    docs_data_bytes = dir_bytes(OUT)
    log("")
    log("================ REPLAY SHARD BUILD REPORT ================")
    log(f"shards written        : {written}")
    if sizes:
        log(f"shard size avg / max  : {shards_bytes / len(sizes):.0f} B / {max(sizes)} B")
    log(f"shards total          : {shards_bytes / 1024:.1f} KB ({shards_bytes} B)")
    log(f"from trades fallback  : {len(from_trades)}"
        + (f"  e.g. {from_trades[:5]}" if from_trades else ""))
    log(f"no usable series      : {len(no_series)}"
        + (f"  {no_series}" if no_series else ""))
    log(f"docs/data TOTAL       : {docs_data_bytes / 1e6:.2f} MB "
        f"(budget 40 MB -> {'OK' if docs_data_bytes < 40e6 else 'OVER'})")
    log("==========================================================")


if __name__ == "__main__":
    sys.exit(main())
