#!/usr/bin/env python3
"""
pipeline/export/build_tiles.py -- Regulation Time, Phase 4 data-tiling build.

Reads the pipeline's parquet store (pipeline/data/) and the Phase-2
adversarially-verified analysis outputs (pipeline/data/analysis/) and writes
the browser payload under docs/data/ exactly per docs/CONTRACT.md section 5
(the data manifest contract). Run with:

    pipeline/.venv/bin/python pipeline/export/build_tiles.py

Deterministic and re-runnable: every number here is either (a) recomputed
live from the raw trade tape / catalog / benchmark stores at run time
("class A"), so re-running this script after new ticks land (e.g. the G1
post-semifinal re-drive, or the v2 epilogue's incremental pull) picks up the
new data automatically with no code change, or (b) repacked verbatim from a
Phase-2 analysis script's output under pipeline/data/analysis/ ("class B"),
because that number carries interpretive methodology (a Brier score, a
favorite-longshot bucket, a devig) that was adversarially verified against
the findings-dossier and must not be silently re-derived by a second code
path at tile-build time. Class B numbers are refreshed by re-running their
Phase-2 script, then re-running this file. See pipeline/export/TILES.md for
the full method writeup, the grain-assembly algorithm, and the class A/B
ledger for every series this script emits.
"""
from __future__ import annotations

import json
import math
import os
import re
import struct
import sys
import time
import datetime as dt
from collections import OrderedDict

import numpy as np
import pandas as pd
import duckdb

# --------------------------------------------------------------------------
# 0. Paths & constants
# --------------------------------------------------------------------------

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PIPE = os.path.join(ROOT, "pipeline")
DATA = os.path.join(PIPE, "data")
ANALYSIS = os.path.join(DATA, "analysis")
OUT = os.path.join(ROOT, "docs", "data")

TRADES_GLOB = os.path.join(DATA, "kalshi", "trades", "series_ticker=*", "*.parquet")
CANDLES_ROOT = os.path.join(DATA, "kalshi", "candles")
MARKETS_PARQUET = os.path.join(DATA, "catalog", "markets.parquet")
SERIES_PARQUET = os.path.join(DATA, "catalog", "series.parquet")
PINNACLE_PARQUET = os.path.join(DATA, "benchmarks", "odds", "pinnacle.parquet")
POLY_MARKETS_PARQUET = os.path.join(DATA, "benchmarks", "polymarket", "markets.parquet")
POLY_PRICES_ROOT = os.path.join(DATA, "benchmarks", "polymarket", "prices")
ENTITY_MAP_PLAYED = os.path.join(ANALYSIS, "calibration", "_entity_map_played.parquet")
FACT_BASE = os.path.join(ROOT, "research", "fact-base.json")

EPOCH = dt.datetime(2025, 5, 1, 0, 0, 0, tzinfo=dt.timezone.utc)
EPOCH_UNIX = EPOCH.timestamp()

GRAIN_DESKTOP = 75_000.0
GRAIN_MOBILE = 250_000.0

TOTAL_BUDGET_BYTES = 40 * 1024 * 1024
CAPS = {
    "manifest+markets": 1.5 * 1024 * 1024,
    "pop-75k.bin": 4 * 1024 * 1024,
    "pop-250k.bin": 1.5 * 1024 * 1024,
    "zoom/fraesp.bin": 6 * 1024 * 1024,
    "zoom/mexeng.bin": 10 * 1024 * 1024,
    "zoom/gerpar.bin": 3 * 1024 * 1024,
    "zoom/norbra.bin": 3 * 1024 * 1024,
    "series.bin": 4 * 1024 * 1024,
    "scenes": 2 * 1024 * 1024,
}

FAMILY_ENUM = [
    "winner_futures", "match_3way", "advancement", "spread_total_score",
    "group", "stage_elimination", "golden_boot", "host_novelty_prop", "other",
]
SIDE_ENUM = ["taker_no", "taker_yes"]
FATE_ENUM = ["settled_no", "settled_yes", "voided", "alive_at_freeze"]
FLAGS_ENUM = [
    "LORENZ_TAIL", "ZOOM_FRAESP", "ZOOM_MEXENG", "ZOOM_GERPAR",
    "ZOOM_NORBRA", "FINAL_CONTRACT", "BELOW_GRAIN_STRATUM", "RESERVED7",
]
FLAG_BIT = {name: i for i, name in enumerate(FLAGS_ENUM)}

# series.parquet's own free-text `family` column collapsed to the manifest's
# 9-slot enum. Only the "Per-match markets" text bucket needs a per-ticker
# split (match_3way / advancement / spread_total_score); everything else is
# a straight text -> enum lookup. See TILES.md sec 2.
FAMILY_TEXT_TO_ENUM = {
    "Tournament winner futures": "winner_futures",
    "Group-stage markets": "group",
    "Team-performance props (stage of elimination, host-nation performance)": "stage_elimination",
    "Player props (Golden Boot / top scorer, awards, player goals)": "golden_boot",
    "Off-pitch novelty (ads, ticket prices, entertainment, politics, mentions)": "host_novelty_prop",
    "Tournament-wide totals and novelty props": "other",
    "World Cup 2026 qualifying/playoff (pre-tournament, ambiguous scope)": "other",
}
PER_MATCH_TEXT = "Per-match markets (3-way moneyline + match derivatives)"

# KXMENWORLDCUP's ticker suffix codes -> canonical FIFA-3 team codes used by
# KXWCGAME/KXWCADVANCE and most other team-keyed series. Built by hand from
# the 48-team suffix lists observed in both series (see TILES.md sec 2).
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
TEAMS = ["—"] + sorted(set(KMWC_TO_FIFA3.values()))  # index 0 = none/multi
TEAM_INDEX = {code: i for i, code in enumerate(TEAMS)}

TEAM_KEYED_SERIES = {
    "KXWCGAME", "KXWCADVANCE", "KXMENWORLDCUP", "KXWCGROUPWIN", "KXWCGROUPWINNER",
    "KXWCGROUPQUAL", "KXWCSTAGEOFELIM", "KXWCROUND", "KXWCFURTHESTADVANCING",
    "KXWCUSAOPPONENT", "KXWCHOSTWIN", "KXWCTEAMH2H", "KXWCBESTHOST",
    "KXWCGROUPORDER", "KXWCGROUPBOTTOM", "KXWCGSUNDEFEATED", "KXWCTEAMTOTALGOALS",
    "KXWCGOALSALLOWED", "KXWCHOST", "KXWCHOSTKO", "KXWCREGIONKO", "KXWCSTAGE",
    "KXWC3RDPLACE", "KXWCWINGROUP",
}
NON_TEAM_SUFFIXES = {"TIE", "YES", "NO", "OVER", "UNDER"}

# Polymarket YES-token ids for the Norway-Brazil goal window (R3/R22 vehicle).
# Shared by build_norbra_zoom() (the zoom tile) and build_s07_scene() (the
# scene-JSON reaction lanes) so both read the exact same token per leg.
NORBRA_PM_TOKENS = {
    "BRA": "105654713241167797590254709131417748215287316658191010694033065067279349239377",
    "TIE": "20802374126416843639334054489053876827939271763615197682043793548486789042986",
    "NOR": "19270630777558640544547501118520831346147002509997851493750997099589698621398",
}

# Dossier R9 (post-upset drift), verbatim class-B pop multiples: cited
# exactly as pipeline/data/analysis/bias-forensics/post_upset_drift.parquet's
# own price series shows each beneficiary's live pop (verified against the
# raw series at build-review time), not re-derived by a second code path.
POP_MULTIPLE_BY_TEAM = {"PAR": 5.0, "NOR": 3.6, "BEL": 2.0}

# S12 Golden Boot ladder: the four lanes the storyboard names (Haaland is
# the eliminated reference lane). Ticker suffixes confirmed against
# docs/data/markets.json's KXWCGOALLEADER rows.
GOLDEN_BOOT_PLAYERS = [
    {"key": "mbappe", "label": "Mbappe", "ticker": "KXWCGOALLEADER-26-KMBA", "reference": False},
    {"key": "messi", "label": "Messi", "ticker": "KXWCGOALLEADER-26-LMES", "reference": False},
    {"key": "kane", "label": "Kane", "ticker": "KXWCGOALLEADER-26-HKAN", "reference": False},
    {"key": "haaland", "label": "Haaland", "ticker": "KXWCGOALLEADER-26-EHAA", "reference": True},
]

t_start = time.time()
LOG = []


def log(msg):
    elapsed = time.time() - t_start
    line = f"[{elapsed:7.2f}s] {msg}"
    print(line, flush=True)
    LOG.append(line)


# --------------------------------------------------------------------------
# 1. DuckDB connection
# --------------------------------------------------------------------------

def make_con():
    con = duckdb.connect()
    con.execute("SET TimeZone='UTC'")
    con.execute("PRAGMA threads=8")
    con.execute("SET memory_limit='6GB'")
    con.execute("PRAGMA disable_progress_bar")
    return con


# --------------------------------------------------------------------------
# 2. Market metadata: family / team / fate per ticker
# --------------------------------------------------------------------------

def classify_family(series_ticker, family_text):
    if family_text == PER_MATCH_TEXT:
        if series_ticker == "KXWCGAME":
            return "match_3way"
        if series_ticker == "KXWCADVANCE":
            return "advancement"
        return "spread_total_score"
    return FAMILY_TEXT_TO_ENUM.get(family_text, "other")


def parse_team(ticker, series_ticker):
    if series_ticker not in TEAM_KEYED_SERIES:
        return 0
    suffix = ticker.rsplit("-", 1)[-1]
    if suffix in NON_TEAM_SUFFIXES:
        return 0
    if series_ticker == "KXMENWORLDCUP":
        code = KMWC_TO_FIFA3.get(suffix)
        return TEAM_INDEX.get(code, 0) if code else 0
    if suffix in TEAM_INDEX:
        return TEAM_INDEX[suffix]
    code = KMWC_TO_FIFA3.get(suffix)
    return TEAM_INDEX.get(code, 0) if code else 0


def fate_of(status, result):
    if status == "finalized":
        if result == "yes":
            return "settled_yes"
        if result == "no":
            return "settled_no"
        return "voided"
    if status in ("closed", "inactive"):
        return "voided"
    return "alive_at_freeze"


def build_market_meta(con):
    """One row per catalog market: ticker, series_ticker, family/team/fate
    enum indices, status, result, occurrence_datetime. ~34.7k rows, cheap."""
    mk = con.execute(f"""
        SELECT m.ticker, m.series_ticker, m.status, m.result, m.title,
               m.occurrence_datetime
        FROM parquet_scan('{MARKETS_PARQUET}') m
    """).df()
    sr = con.execute(f"SELECT ticker AS series_ticker, family FROM parquet_scan('{SERIES_PARQUET}')").df()
    mk = mk.merge(sr, on="series_ticker", how="left")
    mk["family_enum"] = [classify_family(s, f) for s, f in zip(mk["series_ticker"], mk["family"])]
    mk["family_idx"] = mk["family_enum"].map({f: i for i, f in enumerate(FAMILY_ENUM)})
    mk["team_idx"] = [parse_team(t, s) for t, s in zip(mk["ticker"], mk["series_ticker"])]
    mk["fate_enum"] = [fate_of(s, r) for s, r in zip(mk["status"], mk["result"])]
    mk["fate_idx"] = mk["fate_enum"].map({f: i for i, f in enumerate(FATE_ENUM)})
    return mk


# --------------------------------------------------------------------------
# 3. Binary packers (RTPOP1 / RTZM1 / RTSER1)
# --------------------------------------------------------------------------

DTYPE_CODE = {"uint32": "u32", "float32": "f32", "uint16": "u16", "uint8": "u8"}


def pack_columns(magic8: bytes, count: int, columns):
    """columns: list of (name, np.ndarray with an explicit little-endian
    dtype). Returns (bytes, manifest_column_list) with 4-byte-aligned
    offsets, exactly per CONTRACT.md sec 5.2/5.4. Manifest dtype strings use
    the contract's own short codes (u32/f32/u16/u8), not numpy's spelling."""
    assert len(magic8) == 8, magic8
    buf = bytearray()
    buf += magic8
    buf += struct.pack("<I", count)
    buf += struct.pack("<I", 0)  # reserved
    manifest_cols = []
    for name, arr in columns:
        assert len(arr) == count, (name, len(arr), count)
        pad = (-len(buf)) % 4
        buf += b"\x00" * pad
        offset = len(buf)
        data = arr.tobytes()
        buf += data
        np_name = str(arr.dtype).lstrip("<")
        manifest_cols.append({"name": name, "dtype": DTYPE_CODE.get(np_name, np_name), "offset": offset})
    pad = (-len(buf)) % 4
    buf += b"\x00" * pad
    return bytes(buf), manifest_cols


def write_bin(relpath, data: bytes):
    path = os.path.join(OUT, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return len(data)


# --------------------------------------------------------------------------
# 4. Population tile: grain assembly
# --------------------------------------------------------------------------
#
# METHOD (documented in full in TILES.md sec 1; summarized here):
#
#   1 dot = one grain (GRAIN_USD dollars) of a SINGLE market's own matched
#   notional, walked in that market's own chronological trade order. Because
#   Kalshi's event contracts carry a fixed $1 notional value per contract
#   (catalog `notional_value_dollars` = 1.0000 on every binary market), a
#   trade's dollar contribution is exactly its `count_contracts`; this is
#   also the convention the Phase-2 volume-anatomy arm uses for the tape's
#   headline "$12.3B" figure (R1), so the population tile and the dossier's
#   prose numbers speak the same unit.
#
#   For each market (ticker) with lifetime dollars >= GRAIN_USD:
#     - sort its own trades by (created_ts, trade_id) ascending (trade_id is
#       an opaque UUID; used only as a deterministic tie-break)
#     - walk the cumulative sum of count_contracts; every time the running
#       total first crosses a multiple of GRAIN_USD, the trade that crossed
#       it closes one dot
#     - a dot's `dollars` is the sum of count_contracts of the trades that
#       closed it since the previous dot; for all but the last dot of a
#       market this is close to GRAIN_USD (a single oversized trade can
#       overshoot it -- money is never split across dots, so it is never
#       silently deleted); the market's OWN final, partial-remainder chunk
#       becomes its own (smaller) trailing dot -- this is the "varies at
#       the tail" the binary contract's column comment documents
#     - a dot's `birth_ts` is the created_ts of the trade that closed it
#     - a dot's `price_band`/`side` are the dollar-weighted VWAP / majority
#       taker side of the trades in its bucket
#
#   Markets with lifetime dollars < GRAIN_USD own ZERO dots; their tickers
#   and combined dollars roll into `census.below_grain` and a `strata` row
#   in markets.json (S5's below-threshold band), never silently vanishing.
#
#   This is a pure, deterministic function of the trade tape's own contents
#   and sort order -- re-running this script after new ticks land (a G1
#   re-drive, the v2 epilogue's incremental pull) reproduces the same
#   algorithm on the new tape with no code change.

def bucket_population(con, grain_usd, qualifying_tickers=None):
    """Returns a DataFrame: ticker, birth_ts(unix s), dollars, vwap_yes,
    frac_yes, n_trades -- one row per dot, for markets whose lifetime
    dollars >= grain_usd (or, if qualifying_tickers is given, restricted to
    that ticker set so mobile can reuse desktop's dot-owning-market index)."""
    ticker_filter = ""
    if qualifying_tickers is not None:
        tickers_sql = ",".join("'" + t.replace("'", "''") + "'" for t in qualifying_tickers)
        ticker_filter = f"AND tr.ticker IN ({tickers_sql})"
    q = f"""
    WITH totals AS (
        SELECT ticker, SUM(count_contracts) AS total_dollars
        FROM parquet_scan('{TRADES_GLOB}')
        GROUP BY ticker
    ),
    t AS (
        SELECT tr.ticker, tr.created_ts, tr.trade_id, tr.count_contracts,
               tr.yes_price_usd, tr.taker_side
        FROM parquet_scan('{TRADES_GLOB}') tr
        JOIN totals ON tr.ticker = totals.ticker
        WHERE totals.total_dollars >= {grain_usd} {ticker_filter}
    ),
    ordered AS (
        SELECT *,
               SUM(count_contracts) OVER (
                   PARTITION BY ticker ORDER BY created_ts, trade_id
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
               ) AS cum_after
        FROM t
    )
    SELECT ticker,
           CAST(ceil(cum_after / {grain_usd}) - 1 AS BIGINT) AS bucket_index,
           SUM(count_contracts) AS dollars,
           MAX(created_ts) AS birth_ts,
           SUM(count_contracts * yes_price_usd) / SUM(count_contracts) AS vwap_yes,
           SUM(CASE WHEN taker_side = 'yes' THEN count_contracts ELSE 0 END)
               / SUM(count_contracts) AS frac_yes,
           COUNT(*) AS n_trades
    FROM ordered
    GROUP BY ticker, bucket_index
    ORDER BY ticker, bucket_index
    """
    return con.execute(q).df()


def compute_market_totals(con):
    return con.execute(f"""
        SELECT ticker, SUM(count_contracts) AS total_dollars, COUNT(*) AS n_trades
        FROM parquet_scan('{TRADES_GLOB}')
        GROUP BY ticker
    """).df()


def zoom_ticker_sets():
    return {
        "ZOOM_FRAESP": {f"KXWCGAME-26JUL14FRAESP-{s}" for s in ("FRA", "ESP", "TIE")},
        "ZOOM_MEXENG": {"KXWCADVANCE-26JUL05MEXENG-MEX"},
        "ZOOM_GERPAR": {"KXWCGAME-26JUN29GERPAR-GER", "KXWCADVANCE-26JUN29GERPAR-GER"},
        "ZOOM_NORBRA": {f"KXWCGAME-26JUL05BRANOR-{s}" for s in ("BRA", "NOR", "TIE")},
    }


def determine_final_contract_tickers(con, market_meta):
    """Winner-futures legs belonging to the final's two participants. Spain
    is resolved (FRA-ESP settled); the England-Argentina winner is resolved
    from catalog status/result if settled by build time, else BOTH legs are
    flagged provisionally (documented in TILES.md; re-running this script
    after ENG-ARG settles narrows it to one team with no code change)."""
    tickers = set()

    def winner_of(game_prefix, teams):
        rows = market_meta[market_meta["ticker"].isin([f"{game_prefix}-{t}" for t in teams])]
        settled = rows[rows["fate_enum"].isin(["settled_yes", "settled_no"])]
        for _, r in settled.iterrows():
            if r["fate_enum"] == "settled_yes":
                return r["ticker"].rsplit("-", 1)[-1]
        # catalog stale / not yet finalized -> look at tape convergence
        for team in teams:
            tk = f"{game_prefix}-{team}"
            try:
                last = con.execute(f"""
                    SELECT yes_price_usd FROM parquet_scan(
                        '{DATA}/kalshi/trades/series_ticker=KXWCGAME/{tk}.parquet')
                    ORDER BY created_ts DESC LIMIT 1
                """).fetchone()
            except Exception:
                last = None
            if last and last[0] is not None and last[0] >= 0.98:
                return team
        return None

    spain_winner = winner_of("KXWCGAME-26JUL14FRAESP", ["FRA", "ESP"])
    finalists = []
    if spain_winner:
        finalists.append(spain_winner)
    else:
        finalists += ["FRA", "ESP"]

    sf2_winner = winner_of("KXWCGAME-26JUL15ENGARG", ["ENG", "ARG"])
    if sf2_winner:
        finalists.append(sf2_winner)
    else:
        finalists += ["ENG", "ARG"]  # provisional: not yet settled at build time

    fifa3_to_kmwc = {v: k for k, v in KMWC_TO_FIFA3.items()}
    for f3 in finalists:
        kcode = fifa3_to_kmwc.get(f3)
        if kcode:
            tickers.add(f"KXMENWORLDCUP-26-{kcode}")
    return tickers, finalists


def build_population(con, market_meta, market_totals):
    log("population: computing market totals + qualifying sets")
    total_by_ticker = dict(zip(market_totals["ticker"], market_totals["total_dollars"]))
    all_traded = sorted(total_by_ticker)
    qualifying_desktop = sorted(t for t in all_traded if total_by_ticker[t] >= GRAIN_DESKTOP)
    below_desktop = [t for t in all_traded if total_by_ticker[t] < GRAIN_DESKTOP]

    # markets.json index: the desktop (finer-grain) qualifying set is a
    # strict superset of the mobile qualifying set (250k >= 75k), so both
    # tiles' `market` column can safely index into the same table.
    ticker_to_idx = {t: i for i, t in enumerate(qualifying_desktop)}

    # LORENZ_TAIL: bottom half, by dollars, of the DOT-OWNING (desktop)
    # markets specifically -- see TILES.md sec 2 for why this differs from
    # "bottom half of all 30,133 traded markets" (that set is almost
    # entirely already-below-grain and would tag zero dots).
    sorted_by_dollars = sorted(qualifying_desktop, key=lambda t: total_by_ticker[t])
    tail_cut = len(sorted_by_dollars) // 2
    lorenz_tail_tickers = set(sorted_by_dollars[:tail_cut])

    zoom_sets = zoom_ticker_sets()
    final_tickers, finalists = determine_final_contract_tickers(con, market_meta)
    log(f"population: final-contract finalists resolved as {finalists}")

    meta_by_ticker = market_meta.set_index("ticker")

    def attach_attrs(df, grain_label):
        df = df.merge(
            meta_by_ticker[["family_idx", "team_idx", "fate_idx"]],
            left_on="ticker", right_index=True, how="left",
        )
        missing = df["family_idx"].isna().sum()
        if missing:
            log(f"population[{grain_label}]: WARNING {missing} dots with no market_meta row (defaulting family=other/team=0/fate=alive)")
            df["family_idx"] = df["family_idx"].fillna(FAMILY_ENUM.index("other"))
            df["team_idx"] = df["team_idx"].fillna(0)
            df["fate_idx"] = df["fate_idx"].fillna(FATE_ENUM.index("alive_at_freeze"))
        df["price_band"] = np.clip(np.round(df["vwap_yes"].fillna(0.5) * 100), 0, 100).astype(np.uint8)
        df["side_idx"] = (df["frac_yes"].fillna(0.5) >= 0.5).astype(np.uint8)
        flags = np.zeros(len(df), dtype=np.uint8)
        for i, tk in enumerate(df["ticker"].values):
            bit = 0
            if tk in lorenz_tail_tickers:
                bit |= 1 << FLAG_BIT["LORENZ_TAIL"]
            for fname, tks in zoom_sets.items():
                if tk in tks:
                    bit |= 1 << FLAG_BIT[fname]
            if tk in final_tickers:
                bit |= 1 << FLAG_BIT["FINAL_CONTRACT"]
            flags[i] = bit
        df["flags"] = flags
        df["market_idx"] = df["ticker"].map(ticker_to_idx)
        return df

    # ---- desktop tile ----
    log("population: bucketing desktop grain ($75k/dot)")
    desk = bucket_population(con, GRAIN_DESKTOP, qualifying_tickers=qualifying_desktop)
    desk = attach_attrs(desk, "desktop")
    desk = desk.sort_values("birth_ts", kind="mergesort").reset_index(drop=True)
    log(f"population: desktop dot count = {len(desk):,}")

    # ---- mobile tile (reuses the same market index) ----
    log("population: bucketing mobile grain ($250k/dot)")
    mob = bucket_population(con, GRAIN_MOBILE, qualifying_tickers=qualifying_desktop)
    mob = attach_attrs(mob, "mobile")
    mob = mob.sort_values("birth_ts", kind="mergesort").reset_index(drop=True)
    log(f"population: mobile dot count = {len(mob):,}")

    def to_columns(df):
        n = len(df)
        birth_ts = (df["birth_ts"].values.astype(np.int64) - int(EPOCH_UNIX)).astype("<u4")
        dollars = df["dollars"].values.astype("<f4")
        market = df["market_idx"].values.astype("<u2")
        family = df["family_idx"].values.astype("<u1")
        team = df["team_idx"].values.astype("<u1")
        side = df["side_idx"].values.astype("<u1")
        price_band = df["price_band"].values.astype("<u1")
        fate = df["fate_idx"].values.astype("<u1")
        flags = df["flags"].values.astype("<u1")
        cols = [
            ("birth_ts", birth_ts), ("dollars", dollars), ("market", market),
            ("family", family), ("team", team), ("side", side),
            ("price_band", price_band), ("fate", fate), ("flags", flags),
        ]
        return n, cols

    n_desk, cols_desk = to_columns(desk)
    buf_desk, manicols_desk = pack_columns(b"RTPOP1\x00\x00", n_desk, cols_desk)
    n_mob, cols_mob = to_columns(mob)
    buf_mob, manicols_mob = pack_columns(b"RTPOP1\x00\x00", n_mob, cols_mob)

    below_dollars = sum(total_by_ticker[t] for t in below_desktop)
    max_trade_ts = float(desk["birth_ts"].max()) if len(desk) else EPOCH_UNIX
    census = {
        "total_usd": float(sum(total_by_ticker.values())),
        "total_trades": int(market_totals["n_trades"].sum()),
        "months": round((max_trade_ts - EPOCH_UNIX) / 86400 / 30.44, 1),
        "below_grain": {"markets": len(below_desktop), "usd": float(below_dollars)},
    }

    markets_rows = []
    for t in qualifying_desktop:
        m = meta_by_ticker.loc[t]
        markets_rows.append({
            "t": t,
            "f": int(m["family_idx"]),
            "tm": int(m["team_idx"]),
            "ft": int(m["fate_idx"]),
            "d": round(float(total_by_ticker[t]), 2),
        })
    # strata: below-grain markets grouped by family for a compact S5 band.
    strata_map = OrderedDict()
    below_meta = meta_by_ticker.loc[meta_by_ticker.index.intersection(below_desktop)]
    for t in below_desktop:
        fam = int(meta_by_ticker.loc[t, "family_idx"]) if t in meta_by_ticker.index else FAMILY_ENUM.index("other")
        key = fam
        if key not in strata_map:
            strata_map[key] = {"f": fam, "n_markets": 0, "usd": 0.0}
        strata_map[key]["n_markets"] += 1
        strata_map[key]["usd"] += float(total_by_ticker[t])
    strata_rows = [dict(v, usd=round(v["usd"], 2)) for v in strata_map.values()]

    markets_json = {"markets": markets_rows, "strata": strata_rows}

    return {
        "desktop": {
            "buf": buf_desk, "cols": manicols_desk, "dots": n_desk,
            "grain_usd": int(GRAIN_DESKTOP),
            "grain_text": f"1 dot = ${int(GRAIN_DESKTOP):,} of matched volume",
        },
        "mobile": {
            "buf": buf_mob, "cols": manicols_mob, "dots": n_mob,
            "grain_usd": int(GRAIN_MOBILE),
            "grain_text": f"1 dot = ${int(GRAIN_MOBILE):,} of matched volume",
        },
        "markets_json": markets_json,
        "census": census,
        "finalists": finalists,
        "ticker_to_idx": ticker_to_idx,
    }


# --------------------------------------------------------------------------
# 5. Zoom (1:1 tick) extracts -- defect rules R1-R9 applied AT EXPORT
# --------------------------------------------------------------------------
#
# Every zoom tile below is built directly from the raw Kalshi trade parquet
# (never from a pre-aggregated analysis table) so the defect-handling rules
# in research/data-audit.md sec 4 are applied exactly once, here, and the
# browser never sees a raw tick. Rules exercised in this section:
#
#   R6 -- use trade-tape sums, never the catalog `volume` field (every zoom
#         window below reads count_contracts straight off the trade parquet)
#   R8 -- never infer row order from a parallel glob scan; each zoom window
#         is read from its OWN single ticker's parquet file and ordered by
#         (created_ts, trade_id) explicitly, never relying on on-disk order
#   R9 -- lifetimes are gated on catalog `status`, not `close_time`
#   R1/R2/R3 (Pinnacle-specific) -- applied in build_norbra_zoom() below
#
# ts_ms is milliseconds since the tile's own `t0` (manifest.zoom[key].t0),
# packed as u32 -- every window here is hours wide, far under the ~49.7-day
# u32-ms ceiling.

def read_trades(con, series_ticker, ticker, ts_lo=None, ts_hi=None):
    path = os.path.join(DATA, "kalshi", "trades", f"series_ticker={series_ticker}", f"{ticker}.parquet")
    where = ""
    if ts_lo is not None and ts_hi is not None:
        where = f"WHERE created_ts BETWEEN {ts_lo} AND {ts_hi}"
    q = f"""
        SELECT created_ts, trade_id, count_contracts, yes_price_usd, taker_side
        FROM parquet_scan('{path}')
        {where}
        ORDER BY created_ts, trade_id
    """
    return con.execute(q).df()


def zoom_rows_from_kalshi(df, leg_idx, t0_unix, event_ts_unix=None):
    n = len(df)
    ts_ms = ((df["created_ts"].values.astype(np.int64) - int(t0_unix)) * 1000).astype("<u4")
    contracts = df["count_contracts"].values.astype("<u4")  # whole-contract precision is ample here
    notional = df["count_contracts"].values.astype("<f4")
    price_c = np.clip(np.round(df["yes_price_usd"].values * 100), 1, 99).astype("<u1")
    side = (df["taker_side"].values == "yes").astype("<u1")
    leg = np.full(n, leg_idx, dtype="<u1")
    flags = np.zeros(n, dtype="<u1")
    if event_ts_unix is not None and n:
        idx = int(np.argmin(np.abs(df["created_ts"].values - event_ts_unix)))
        flags[idx] |= 1
    return ts_ms, contracts, notional, price_c, side, leg, flags


def stack_zoom_rows(parts):
    ts_ms = np.concatenate([p[0] for p in parts]) if parts else np.array([], dtype="<u4")
    contracts = np.concatenate([p[1] for p in parts]) if parts else np.array([], dtype="<u4")
    notional = np.concatenate([p[2] for p in parts]) if parts else np.array([], dtype="<f4")
    price_c = np.concatenate([p[3] for p in parts]) if parts else np.array([], dtype="<u1")
    side = np.concatenate([p[4] for p in parts]) if parts else np.array([], dtype="<u1")
    leg = np.concatenate([p[5] for p in parts]) if parts else np.array([], dtype="<u1")
    flags = np.concatenate([p[6] for p in parts]) if parts else np.array([], dtype="<u1")
    order = np.argsort(ts_ms, kind="mergesort")
    return ts_ms[order], contracts[order], notional[order], price_c[order], side[order], leg[order], flags[order]


def pack_zoom(ts_ms, contracts, notional, price_c, side, leg, flags):
    n = len(ts_ms)
    cols = [
        ("ts_ms", ts_ms.astype("<u4")), ("contracts", contracts.astype("<u4")),
        ("notional_usd", notional.astype("<f4")), ("price_c", price_c.astype("<u1")),
        ("side", side.astype("<u1")), ("leg", leg.astype("<u1")), ("flags", flags.astype("<u1")),
    ]
    return pack_columns(b"RTZM1\x00\x00\x00", n, cols)


def find_events_matched(con, match_id):
    try:
        df = con.execute(f"""
            SELECT event_ts, tv_magnitude FROM parquet_scan('{ANALYSIS}/ingame-microstructure/events_matched.parquet')
            WHERE match_id = '{match_id}' ORDER BY tv_magnitude DESC
        """).df()
        return df
    except Exception:
        return pd.DataFrame()


def detect_single_source_event(df, price_col="yes_price_usd", ts_col="created_ts", window_s=60):
    """Fallback single-source repricing-event detector (documented as a
    simplified proxy distinct from the cross-source events_matched.parquet
    method): resample to 1-min last-price, return the ts of the largest
    1-minute absolute price move."""
    if df.empty:
        return None
    s = df.set_index(pd.to_datetime(df[ts_col], unit="s", utc=True))[price_col]
    m = s.resample("1min").last().ffill()
    if len(m) < 2:
        return None
    diffs = m.diff().abs()
    peak = diffs.idxmax()
    if pd.isna(diffs.loc[peak]):
        return None
    return int(peak.timestamp())


# ---- S1: FRA-ESP (fallback vehicle documented; built as specced here) ----

def build_fraesp_zoom(con):
    log("zoom[fraesp]: reading FRA/ESP/TIE trade tape")
    legs = [("FRA", 0), ("ESP", 1), ("TIE", 2)]
    dfs = {}
    for code, _ in legs:
        dfs[code] = read_trades(con, "KXWCGAME", f"KXWCGAME-26JUL14FRAESP-{code}")
    lo = min(d["created_ts"].min() for d in dfs.values() if len(d))
    hi = max(d["created_ts"].max() for d in dfs.values() if len(d))
    # window: from ~1.5h before the last pre-settlement trade cluster begins
    # is unnecessary here -- the tape's own span for these three legs (see
    # TILES.md) already brackets kickoff-to-settlement tightly, so the full
    # available span is used directly (no additional windowing needed).
    window_lo, window_hi = lo, hi

    ev_df = find_events_matched(con, "JUL14FRAESP")
    event_ts = None
    if not ev_df.empty:
        # events_matched stores PDT-local event_ts; convert to unix seconds
        event_ts = int(pd.Timestamp(ev_df.iloc[0]["event_ts"]).timestamp())
    else:
        event_ts = detect_single_source_event(dfs["FRA"])

    parts = []
    for code, leg_idx in legs:
        d = dfs[code]
        d = d[(d["created_ts"] >= window_lo) & (d["created_ts"] <= window_hi)]
        parts.append(zoom_rows_from_kalshi(d, leg_idx, window_lo, event_ts))
    rows = stack_zoom_rows(parts)
    buf, cols = pack_zoom(*rows)
    n = len(rows[0])
    log(f"zoom[fraesp]: {n:,} rows, window {n and (window_hi-window_lo)}s, event_ts={event_ts}")
    meta = {
        "columns": cols, "t0_unix": window_lo, "window": [window_lo, window_hi],
        "legs": [
            {"ticker": "KXWCGAME-26JUL14FRAESP-FRA", "label": "France (regulation)"},
            {"ticker": "KXWCGAME-26JUL14FRAESP-ESP", "label": "Spain (regulation)"},
            {"ticker": "KXWCGAME-26JUL14FRAESP-TIE", "label": "Draw (regulation)"},
        ],
        "trades": n, "build_stride": 1,
    }
    return buf, meta


# ---- S6: MEXENG advancement, MEX leg, full lifetime (~1M trades) --------

def build_mexeng_zoom(con):
    log("zoom[mexeng]: reading MEX advancement leg (full lifetime, ~1M trades)")
    d = read_trades(con, "KXWCADVANCE", "KXWCADVANCE-26JUL05MEXENG-MEX")
    n_raw = len(d)
    cap_trades = int(CAPS["zoom/mexeng.bin"] // 16)
    build_stride = 1
    if n_raw > cap_trades:
        build_stride = math.ceil(n_raw / cap_trades)
        d = d.iloc[::build_stride].reset_index(drop=True)
        log(f"zoom[mexeng]: LOD-thinned {n_raw:,} -> {len(d):,} trades (build_stride={build_stride}) to fit {CAPS['zoom/mexeng.bin']/1e6:.0f}MB cap")
    t0 = int(d["created_ts"].min())
    rows = zoom_rows_from_kalshi(d, 0, t0, event_ts_unix=None)
    buf, cols = pack_zoom(*rows)
    n = len(rows[0])
    log(f"zoom[mexeng]: {n:,} rows packed (of {n_raw:,} raw trades)")
    meta = {
        "columns": cols, "t0_unix": t0, "window": [int(d["created_ts"].min()), int(d["created_ts"].max())],
        "legs": [{"ticker": "KXWCADVANCE-26JUL05MEXENG-MEX", "label": "Mexico to advance"}],
        "trades": n_raw, "build_stride": build_stride,
        "kickoff_iso": "2026-07-06T01:00:00Z",  # Pinnacle-verified, mexeng_summary.json
    }
    return buf, meta


# ---- S8: GER-PAR regulation vs advancement (the shootout scene) --------

def build_gerpar_zoom(con):
    log("zoom[gerpar]: reading GER regulation + GER advancement legs")
    reg = read_trades(con, "KXWCGAME", "KXWCGAME-26JUN29GERPAR-GER")
    adv = read_trades(con, "KXWCADVANCE", "KXWCADVANCE-26JUN29GERPAR-GER")
    # Empirically anchored window (see TILES.md sec 3 for why occurrence_
    # datetime is not trusted here -- data-audit.md G2 flags exactly this
    # field as unreliable for at least the semifinals, and it proved wrong
    # for this match too): from 30 minutes before the regulation leg's own
    # last trade (its settlement-decay tail) through 5 minutes after the
    # advancement leg's last trade (the shootout's own conclusion).
    reg_settle = int(reg["created_ts"].max())
    adv_settle = int(adv["created_ts"].max())
    window_lo = reg_settle - 30 * 60
    window_hi = adv_settle + 5 * 60
    reg_w = reg[(reg["created_ts"] >= window_lo) & (reg["created_ts"] <= window_hi)]
    adv_w = adv[(adv["created_ts"] >= window_lo) & (adv["created_ts"] <= window_hi)]

    ev_df = find_events_matched(con, "JUN29GERPAR")
    event_ts = int(pd.Timestamp(ev_df.iloc[0]["event_ts"]).timestamp()) if not ev_df.empty else None

    parts = [
        zoom_rows_from_kalshi(reg_w, 0, window_lo, event_ts),
        zoom_rows_from_kalshi(adv_w, 1, window_lo, event_ts),
    ]
    rows = stack_zoom_rows(parts)
    buf, cols = pack_zoom(*rows)
    n = len(rows[0])
    log(f"zoom[gerpar]: {n:,} rows (reg={len(reg_w):,}, adv={len(adv_w):,}), window {window_hi-window_lo}s")
    meta = {
        "columns": cols, "t0_unix": window_lo, "window": [window_lo, window_hi],
        "legs": [
            {"ticker": "KXWCGAME-26JUN29GERPAR-GER", "label": "Germany (regulation)"},
            {"ticker": "KXWCADVANCE-26JUN29GERPAR-GER", "label": "Germany to advance"},
        ],
        "trades": n, "build_stride": 1,
        "regulation_settle_ts": reg_settle, "advance_settle_ts": adv_settle,
    }
    return buf, meta


# ---- S7: Norway-Brazil goal, three venues (Kalshi/Pinnacle/Polymarket) --

PINNACLE_FTR_OUTCOME_TO_LEG = {"101": "team1", "102": "tie", "103": "team2"}  # standard 1X2 ordering


def screen_pinnacle_spikes(df, val_col="implied_prob_devigged", tol=0.35, neighbor_tol=0.06):
    """R3: screen isolated single-print reversion glitches. A row is an
    isolated spike if it deviates > tol from BOTH neighbors and those two
    neighbors are themselves within neighbor_tol of each other (i.e. the
    tape reverts right back), per data-audit.md rule R3."""
    if len(df) < 3:
        return df
    v = df[val_col].values
    drop = np.zeros(len(df), dtype=bool)
    for i in range(1, len(df) - 1):
        prev_v, cur_v, next_v = v[i - 1], v[i], v[i + 1]
        if abs(cur_v - prev_v) > tol and abs(cur_v - next_v) > tol and abs(prev_v - next_v) <= neighbor_tol:
            drop[i] = True
    return df[~drop]


def read_pinnacle_ftr(con, fixture_id):
    """R1 (dedup on ms created_at) + R2 (filter price_decimal<1.01, treat
    overround_at_ts=0 as NaN) + R3 (spike screen) applied here."""
    df = con.execute(f"""
        SELECT outcome_id, created_at, price_decimal, overround_at_ts,
               implied_prob_raw, implied_prob_devigged
        FROM parquet_scan('{PINNACLE_PARQUET}')
        WHERE fixture_id = '{fixture_id}' AND market_name = 'Full Time Result'
    """).df()
    if df.empty:
        return df
    df = df[df["price_decimal"] >= 1.01]  # R2
    df = df[df["overround_at_ts"].fillna(0) != 0]  # R2 (0 sentinel -> NaN/drop)
    # Bug fix (data-layer parity pass): pandas >=2 infers a non-nanosecond
    # datetime64 resolution (here, [us]) from these ISO strings, so a plain
    # `.astype("int64") // 1_000_000` silently assumed nanoseconds and
    # produced SECONDS-since-epoch values 1000x too small (verified: every
    # downstream consumer of created_ts_ms -- build_norbra_zoom's Pinnacle
    # lane, build_braid's Pinnacle series, and the S7 scene JSON's pinnacle
    # quotes -- was silently filtering to an empty result on this store's
    # pandas version). Casting through datetime64[ms] explicitly is robust
    # to whatever resolution to_datetime() happened to infer.
    df["created_ts_ms"] = df["created_at"].pipe(pd.to_datetime, utc=True).values.astype("datetime64[ms]").astype("int64")
    df = df.sort_values(["outcome_id", "created_ts_ms"]).drop_duplicates(
        subset=["outcome_id", "created_ts_ms"], keep="last")  # R1
    out = []
    for oid, g in df.groupby("outcome_id"):
        g = screen_pinnacle_spikes(g.sort_values("created_ts_ms"))  # R3
        out.append(g)
    return pd.concat(out) if out else df


def build_norbra_zoom(con):
    log("zoom[norbra]: locating goal event + assembling Kalshi/Pinnacle/Polymarket lanes")
    ev = find_events_matched(con, "JUL05BRANOR")
    if ev.empty:
        raise RuntimeError("norbra: no events_matched row for JUL05BRANOR")
    top = ev.iloc[0]
    event_ts = int(pd.Timestamp(top["event_ts"]).timestamp())
    window_lo = event_ts - 5 * 60
    window_hi = event_ts + 35 * 60

    legs_meta = []
    parts = []
    leg_i = 0

    # --- Kalshi (native tick trades) ---
    for code, label in [("BRA", "Brazil win"), ("NOR", "Norway win"), ("TIE", "Draw")]:
        d = read_trades(con, "KXWCGAME", f"KXWCGAME-26JUL05BRANOR-{code}")
        d = d[(d["created_ts"] >= window_lo) & (d["created_ts"] <= window_hi)]
        parts.append(zoom_rows_from_kalshi(d, leg_i, window_lo, event_ts))
        legs_meta.append({"venue": "kalshi", "team": code, "label": f"Kalshi: {label}", "kind": "trade"})
        leg_i += 1

    # --- Pinnacle (quote updates, resampled per R1-R3; 0 contracts/notional) ---
    pin = read_pinnacle_ftr(con, "id1000001653452517")
    for oid, code, label in [("101", "BRA", "Brazil win"), ("102", "TIE", "Draw"), ("103", "NOR", "Norway win")]:
        g = pin[pin["outcome_id"] == oid] if not pin.empty else pin
        if len(g):
            g = g[(g["created_ts_ms"] >= window_lo * 1000) & (g["created_ts_ms"] <= window_hi * 1000)]
        n = len(g)
        if n:
            ts_ms = (g["created_ts_ms"].values - window_lo * 1000).astype("<u4")
            price_c = np.clip(np.round(g["implied_prob_devigged"].values * 100), 1, 99).astype("<u1")
        else:
            ts_ms = np.array([], dtype="<u4")
            price_c = np.array([], dtype="<u1")
        contracts = np.zeros(n, dtype="<u4")
        notional = np.zeros(n, dtype="<f4")
        side = np.zeros(n, dtype="<u1")
        leg = np.full(n, leg_i, dtype="<u1")
        flags = np.zeros(n, dtype="<u1")
        if n:
            idx = int(np.argmin(np.abs(g["created_ts_ms"].values - event_ts * 1000)))
            flags[idx] |= 1
        parts.append((ts_ms, contracts, notional, price_c, side, leg, flags))
        legs_meta.append({"venue": "pinnacle", "team": code, "label": f"Pinnacle: {label} (quote)", "kind": "quote"})
        leg_i += 1

    # --- Polymarket (native 1-min snapshots; 0 contracts/notional) ---
    pm_tokens = {
        "BRA": "105654713241167797590254709131417748215287316658191010694033065067279349239377",
        "TIE": "20802374126416843639334054489053876827939271763615197682043793548486789042986",
        "NOR": "19270630777558640544547501118520831346147002509997851493750997099589698621398",
    }
    for code, label in [("BRA", "Brazil win"), ("TIE", "Draw"), ("NOR", "Norway win")]:
        token = pm_tokens[code]
        path = os.path.join(POLY_PRICES_ROOT, "priority_tier=1", "fidelity=1", f"{token}.parquet")
        n = 0
        ts_ms = np.array([], dtype="<u4")
        price_c = np.array([], dtype="<u1")
        if os.path.exists(path):
            g = con.execute(f"""
                SELECT ts_utc, implied_prob FROM parquet_scan('{path}')
                WHERE ts_utc BETWEEN {window_lo} AND {window_hi}
                ORDER BY ts_utc
            """).df()
            n = len(g)
            if n:
                ts_ms = ((g["ts_utc"].values - window_lo) * 1000).astype("<u4")
                price_c = np.clip(np.round(g["implied_prob"].values * 100), 1, 99).astype("<u1")
        contracts = np.zeros(n, dtype="<u4")
        notional = np.zeros(n, dtype="<f4")
        side = np.zeros(n, dtype="<u1")
        leg = np.full(n, leg_i, dtype="<u1")
        flags = np.zeros(n, dtype="<u1")
        if n:
            idx = int(np.argmin(np.abs((ts_ms.astype(np.int64) + window_lo * 1000) - event_ts * 1000)))
            flags[idx] |= 1
        parts.append((ts_ms, contracts, notional, price_c, side, leg, flags))
        legs_meta.append({"venue": "polymarket", "team": code, "label": f"Polymarket: {label} (1-min block)", "kind": "block60s"})
        leg_i += 1

    rows = stack_zoom_rows(parts)
    buf, cols = pack_zoom(*rows)
    n = len(rows[0])
    log(f"zoom[norbra]: {n:,} rows across {leg_i} legs (3 venues x 3 outcomes), event_ts={event_ts}")
    meta = {
        "columns": cols, "t0_unix": window_lo, "window": [window_lo, window_hi],
        "legs": legs_meta, "trades": n, "build_stride": 1,
        "event_ts": event_ts, "event_note": "Haaland's second goal (R3/R22 cross-source verified anchor)",
    }
    return buf, meta


# --------------------------------------------------------------------------
# 6. Aggregate series (series.bin) + per-scene JSON
# --------------------------------------------------------------------------

def pack_series(sections):
    """sections: list of (name, np.float32 array, meta_extra_dict)."""
    buf = bytearray()
    buf += b"RTSER1\x00\x00"
    buf += struct.pack("<I", len(sections))
    buf += struct.pack("<I", 0)
    manifest_sections = []
    for name, arr, extra in sections:
        pad = (-len(buf)) % 4
        buf += b"\x00" * pad
        offset = len(buf)
        a = arr.astype("<f4")
        buf += a.tobytes()
        sec = {"name": name, "dtype": "f32", "length": int(len(a)), "offset": offset}
        sec.update(extra)
        manifest_sections.append(sec)
    pad = (-len(buf)) % 4
    buf += b"\x00" * pad
    return bytes(buf), manifest_sections


def df_records(df, cols=None, round_map=None, limit=None):
    if cols is not None:
        df = df[cols]
    if limit is not None and len(df) > limit:
        idx = np.linspace(0, len(df) - 1, limit).astype(int)
        df = df.iloc[idx]
    df = df.copy()
    if round_map:
        for c, nd in round_map.items():
            if c in df.columns:
                df[c] = df[c].round(nd)
    df = df.where(pd.notnull(df), None)
    return json.loads(df.to_json(orient="records", date_format="iso"))


# ---- class A: family cumulative counter (S2/S3) ----

def build_family_cumulative(con, market_meta):
    log("series[family_cumulative]: recomputing daily futures-vs-match cumulative $ from trade tape")
    fam = market_meta.set_index("ticker")["family_enum"]
    con.register("fam_lookup", fam.reset_index().rename(columns={"ticker": "ticker", "family_enum": "family_enum"}))
    daily = con.execute(f"""
        SELECT date_trunc('day', to_timestamp(tr.created_ts)) AS day,
               CASE WHEN f.family_enum = 'winner_futures' THEN 'futures' ELSE 'match' END AS bucket,
               SUM(tr.count_contracts) AS dollars
        FROM parquet_scan('{TRADES_GLOB}') tr
        JOIN fam_lookup f ON tr.ticker = f.ticker
        GROUP BY 1, 2 ORDER BY 1
    """).df()
    days = pd.date_range(daily["day"].min(), daily["day"].max(), freq="D", tz="UTC")
    piv = daily.pivot(index="day", columns="bucket", values="dollars").reindex(days).fillna(0.0)
    cum_futures = piv.get("futures", pd.Series(0.0, index=days)).cumsum().values
    cum_match = piv.get("match", pd.Series(0.0, index=days)).cumsum().values
    n_days = len(days)
    log(f"series[family_cumulative]: {n_days} days, futures final=${cum_futures[-1]:,.0f}, match final=${cum_match[-1]:,.0f}")
    t0_iso = days[0].isoformat()
    extra = {"t0": t0_iso, "step_s": 86400}
    return [
        ("family_cumulative_futures", cum_futures, dict(extra)),
        ("family_cumulative_match", cum_match, dict(extra)),
    ], {
        "crossover_day": str(days[int(np.argmax(cum_match >= cum_futures))]) if (cum_match >= cum_futures).any() else None,
        "final_futures_usd": float(cum_futures[-1]), "final_match_usd": float(cum_match[-1]),
        "n_days": n_days,
    }


# ---- class A: Lorenz curve + concentration (S5) ----

def build_lorenz(market_totals, n_points=600):
    log("series[lorenz]: recomputing sorted sweep + Gini")
    d = np.sort(market_totals["total_dollars"].values)
    n = len(d)
    cum = np.cumsum(d)
    total = cum[-1]
    cum_pct_volume = cum / total
    cum_pct_markets = (np.arange(1, n + 1)) / n
    # Gini via the trapezoidal-rule area-under-Lorenz-curve formula
    trapz = getattr(np, "trapezoid", None) or np.trapz
    gini = 1.0 - 2.0 * trapz(cum_pct_volume, cum_pct_markets)
    idx = np.unique(np.linspace(0, n - 1, n_points).astype(int))
    top_n_share = {}
    for k in (1, 5, 10, 25, 50, 100, 250, 500, 1000):
        if k <= n:
            top_n_share[k] = float(np.sum(d[-k:]) / total * 100)
    half = n // 2
    bottom_half_usd = float(d[:half].sum())
    log(f"series[lorenz]: n_markets={n}, gini={gini:.4f}, bottom-half markets={half} = {bottom_half_usd/total*100:.3f}% of volume")
    return {
        "cum_pct_markets": cum_pct_markets[idx].round(6).tolist(),
        "cum_pct_volume": cum_pct_volume[idx].round(9).tolist(),
        "n_markets": int(n), "gini": round(float(gini), 4),
        "top_n_share_pct": top_n_share,
        "bottom_half": {"n_markets": int(half), "usd": round(bottom_half_usd, 2),
                         "pct_of_volume": round(bottom_half_usd / total * 100, 4)},
    }


# ---- class A: hourly clock grid + kickoff window split (S4) ----

def build_clock_grid(con):
    log("series[clock_grid]: recomputing dow x hour (ET) density + in/out-window split")
    hourly = con.execute(f"""
        SELECT dayofweek(timezone('America/New_York', to_timestamp(created_ts))) AS dow_et,
               hour(timezone('America/New_York', to_timestamp(created_ts))) AS hour_et,
               SUM(count_contracts) AS dollars, COUNT(*) AS n_trades
        FROM parquet_scan('{TRADES_GLOB}')
        GROUP BY 1, 2
    """).df()
    grid = np.zeros((7, 24), dtype=np.float64)
    for _, r in hourly.iterrows():
        grid[int(r["dow_et"]), int(r["hour_et"])] += r["dollars"]
    try:
        mw = pd.read_csv(os.path.join(ANALYSIS, "volume-anatomy", "match_window_split.csv"))
        split = {str(bool(r["in_match_window"])): {"usd": float(r["sum"]), "n_trades": int(r["count"])} for _, r in mw.iterrows()}
    except Exception:
        split = None
    return {"grid_usd": grid.round(2).tolist(), "dow_labels": ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
            "hour_labels": list(range(24)), "in_out_window_split_usd": split}


# ---- class A: S17 hero (winner-futures pair, provisional pre-G3) --------

def build_hero(con, finalists):
    log(f"hero: computing latest winner-futures prices for {finalists}")
    fifa3_to_kmwc = {v: k for k, v in KMWC_TO_FIFA3.items()}
    legs = []
    for f3 in finalists:
        kcode = fifa3_to_kmwc.get(f3)
        if not kcode:
            continue
        ticker = f"KXMENWORLDCUP-26-{kcode}"
        path = os.path.join(DATA, "kalshi", "trades", "series_ticker=KXMENWORLDCUP", f"{ticker}.parquet")
        price = None
        if os.path.exists(path):
            row = con.execute(f"SELECT yes_price_usd FROM parquet_scan('{path}') ORDER BY created_ts DESC LIMIT 1").fetchone()
            price = float(row[0]) if row else None
        legs.append({"ticker": ticker, "label": f3, "price_c": round(price * 100, 2) if price is not None else None})
    # devig across the full 48-leg winner book (sum of all last-traded prices)
    all_kmwc = con.execute(f"""
        SELECT ticker, yes_price_usd, created_ts,
               ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY created_ts DESC) AS rn
        FROM parquet_scan('{DATA}/kalshi/trades/series_ticker=KXMENWORLDCUP/*.parquet')
        QUALIFY rn = 1
    """).df()
    book_sum = float(all_kmwc["yes_price_usd"].sum())
    for leg in legs:
        if leg["price_c"] is not None and book_sum > 0:
            leg["devig_pct"] = round(leg["price_c"] / 100 / book_sum * 100, 2)
        else:
            leg["devig_pct"] = None
    log(f"hero: winner-book sum (pre-devig) = {book_sum:.4f} across {len(all_kmwc)} legs")
    return {
        "instrument": "winner_futures_pair", "legs": legs, "book_sum_raw": round(book_sum, 4),
        "threeway": [],
        "provenance": ("raw traded price, PROVISIONAL pre-G3-refresh snapshot from this build run; "
                       "the deploy-morning re-run (G3) overwrites this with the frozen, timestamped "
                       "morning-of-final price and computes the final devig line in the same pass; "
                       "multi-way legs sum above 100% before the vig is removed"),
    }


# ---- class A: S10 braid (Kalshi vs Polymarket vs Pinnacle, per-minute) --

def build_braid(con):
    log("series[braid]: assembling per-minute Kalshi/Polymarket/Pinnacle traces for 28 x 3 knockout legs")
    if not os.path.exists(ENTITY_MAP_PLAYED):
        log("series[braid]: SKIPPED, _entity_map_played.parquet not found")
        return None
    em = con.execute(f"SELECT * FROM parquet_scan('{ENTITY_MAP_PLAYED}')").df()
    kalshi_all, poly_all, pinn_all = [], [], []
    segments = []
    gaps = []
    n_terminations = 0
    for _, r in em.iterrows():
        if not r["polymarket_match_found"] or not r["pinnacle_match_found"]:
            continue
        try:
            kickoff = pd.Timestamp(r["pinnacle_kickoff_utc"]).timestamp()
        except Exception:
            continue
        lo, hi = int(kickoff - 30 * 60), int(kickoff + 150 * 60)
        minutes = np.arange(lo, hi, 60)
        legs = [
            ("team1", r["kalshi_leg_team1"], r["polymarket_team1_yes_token"], "101"),
            ("team2", r["kalshi_leg_team2"], r["polymarket_team2_yes_token"], "103"),
            ("tie", r["kalshi_leg_tie"], r["polymarket_draw_yes_token"], "102"),
        ]
        pin_df = None
        try:
            pin_df = read_pinnacle_ftr(con, r["pinnacle_fixture_id"])
        except Exception:
            pin_df = pd.DataFrame()
        for leg_name, kticker, pm_token, pin_oid in legs:
            kpath = os.path.join(DATA, "kalshi", "trades", "series_ticker=KXWCGAME", f"{kticker}.parquet")
            if not os.path.exists(kpath):
                continue
            kt = con.execute(f"""
                SELECT created_ts, yes_price_usd FROM parquet_scan('{kpath}')
                WHERE created_ts BETWEEN {lo} AND {hi} ORDER BY created_ts
            """).df()
            if kt.empty:
                continue
            ks = pd.Series(kt["yes_price_usd"].values, index=kt["created_ts"].values)
            ks = ks.groupby(level=0).last().sort_index()
            # method="ffill" propagates the last trade price at-or-before each
            # minute mark; irregular trade timestamps rarely land exactly on a
            # minute boundary, so a plain reindex()+ffill() (which only fills
            # gaps *within the already-reindexed series*) would leave this all
            # NaN. bfill() only backfills the handful of minutes before the
            # leg's very first trade in the window.
            kalshi_m = ks.reindex(minutes, method="ffill").bfill().values

            pm_path = os.path.join(POLY_PRICES_ROOT, "priority_tier=1", "fidelity=1", f"{pm_token}.parquet")
            if not os.path.exists(pm_path):
                pm_path = os.path.join(POLY_PRICES_ROOT, "priority_tier=1", "fidelity=60", f"{pm_token}.parquet")
            poly_m = np.full(len(minutes), np.nan)
            if os.path.exists(pm_path):
                pt = con.execute(f"""
                    SELECT ts_utc, implied_prob FROM parquet_scan('{pm_path}')
                    WHERE ts_utc BETWEEN {lo} AND {hi} ORDER BY ts_utc
                """).df()
                if len(pt):
                    ps = pd.Series(pt["implied_prob"].values, index=pt["ts_utc"].values)
                    ps = ps.groupby(level=0).last().sort_index()
                    poly_m = ps.reindex(minutes, method="ffill").bfill().values

            pinn_m = np.full(len(minutes), -1.0)  # -1 sentinel = no/terminated quote
            terminated_at = None
            if pin_df is not None and not pin_df.empty:
                g = pin_df[pin_df["outcome_id"] == pin_oid]
                if len(g):
                    g_ts_s = (g["created_ts_ms"].values // 1000)
                    ps = pd.Series(g["implied_prob_devigged"].values, index=g_ts_s)
                    ps = ps.groupby(level=0).last().sort_index()
                    last_ts = ps.index.max()
                    reindexed = ps.reindex(minutes, method="ffill")
                    pinn_m = np.where(minutes <= last_ts, reindexed.values, -1.0)
                    if last_ts < hi:
                        terminated_at = int(last_ts)
                        n_terminations += 1

            start = len(kalshi_all)
            kalshi_all.extend(np.nan_to_num(kalshi_m, nan=-1.0).tolist())
            poly_all.extend(np.nan_to_num(poly_m, nan=-1.0).tolist())
            pinn_all.extend(np.nan_to_num(pinn_m, nan=-1.0).tolist())
            valid_gap = np.abs(np.nan_to_num(kalshi_m, nan=np.nan) - np.nan_to_num(poly_m, nan=np.nan))
            valid_gap = valid_gap[~np.isnan(valid_gap)]
            if len(valid_gap):
                gaps.append(valid_gap)
            segments.append({
                "match_id": r["match_id"], "leg": leg_name, "start": start, "length": len(minutes),
                "kickoff_ts": int(kickoff), "terminated_at": terminated_at,
            })
    if not segments:
        log("series[braid]: no segments assembled (benchmark files unavailable) -- SKIPPED")
        return None
    all_gaps = np.concatenate(gaps) if gaps else np.array([0.0])
    log(f"series[braid]: {len(segments)} legs, {len(kalshi_all):,} minute-points, "
        f"mean |gap|={np.mean(all_gaps)*100:.3f}pp, {n_terminations} Pinnacle terminations")
    sections = [
        ("braid_kalshi", np.array(kalshi_all, dtype=np.float64), {}),
        ("braid_polymarket", np.array(poly_all, dtype=np.float64), {}),
        ("braid_pinnacle", np.array(pinn_all, dtype=np.float64), {}),
    ]
    summary = {
        "segments": segments, "n_legs": len(segments),
        "mean_abs_gap_pp": round(float(np.mean(all_gaps) * 100), 3),
        "n_pinnacle_terminations": n_terminations,
        "sentinel": -1.0,
        "note": "price values are raw fractional probability (0-1); -1 sentinel = no quote / terminated",
    }
    return sections, summary


# --------------------------------------------------------------------------
# 6b. Scene-JSON field-parity rebuilds (data-layer mismatch fix pass)
# --------------------------------------------------------------------------
#
# Every function below targets the EXACT read-set of its scene module
# (docs/js/scenes/sNN.js), enumerated by reading each module's layout()/
# overlay()/scales() bodies and its own DATA_REQUEST / DATA CONTRACT
# ASSUMPTIONS header comment. Every number is grounded in pipeline/data/ (a
# raw trade-tape recompute, a Phase-2 analysis table repacked verbatim, or a
# dossier-cited class-B constant reused the same way press_floor_usd already
# is elsewhere in this file) -- nothing here is invented. Where a live
# recompute lands a little off a dossier-verbatim figure (e.g. s05's
# core-series share), that is documented inline, the same convention TILES.md
# sec 5 already uses for the braid's 0.74pp-vs-1.21pp class A/B gap.

def build_s03_cutoffs():
    """s03.js reads day1_end / crossover_end / press_floor -- grounded in
    family_crossover.json's own day-level and cumulative crossover fields
    (R18/R1). day1_end closes 'day one' (the day per-day match volume first
    exceeds futures, per day_level_flip_first_day_match_gt_futures);
    crossover_end closes 'day two' (the day CUMULATIVE match volume first
    exceeds cumulative futures stock, per cumulative_crossover_day)."""
    crossover = _read_json_safe(os.path.join(ANALYSIS, "volume-anatomy", "family_crossover.json"))

    def end_of_day_iso(date_str, fallback):
        if not date_str:
            return fallback
        d = pd.Timestamp(date_str, tz="UTC").normalize() + pd.Timedelta(days=1)
        return d.isoformat().replace("+00:00", "Z")

    return {
        "day1_end": end_of_day_iso(crossover.get("day_level_flip_first_day_match_gt_futures"), "2026-06-12T00:00:00Z"),
        "crossover_end": end_of_day_iso(crossover.get("cumulative_crossover_day"), "2026-06-13T00:00:00Z"),
        "press_floor": {
            "usd": 7_400_000_000,
            "as_of": "2026-06-30T00:00:00Z",
            "label": "press floor, ~one week stale",
        },
    }


def build_s04_scene(con):
    """s04.js reads grid.{day0,days}, in_window[day][hour], kickoff_hist.hours,
    rest_days[], waking_band. All schedule facts (never per-dot properties,
    per the scene's own header note), built from match_windows.parquet (R11)
    converted to US Eastern -- the storyboard's own axis unit ('ET hour')."""
    mw = _read_parquet_safe(os.path.join(ANALYSIS, "volume-anatomy", "match_windows.parquet"))
    tz = "America/New_York"
    day0 = pd.Timestamp("2026-06-11T00:00:00", tz=tz)  # tournament kickoff day, ET midnight
    grid_end = pd.Timestamp("2026-07-20T00:00:00", tz=tz)  # one day past the final: settlement tail
    tournament_end = pd.Timestamp("2026-07-19T23:59:59", tz=tz)
    days = int((grid_end - day0).days)

    in_window = [[0] * 24 for _ in range(days)]
    kickoff_hours = [0] * 24
    match_days = set()

    for _, r in mw.iterrows():
        try:
            ko = pd.Timestamp(r["kickoff"]).tz_convert(tz)
            lo = pd.Timestamp(r["win_start"]).tz_convert(tz)
            hi = pd.Timestamp(r["win_end"]).tz_convert(tz)
        except Exception:
            continue
        if 0 <= ko.hour < 24:
            kickoff_hours[ko.hour] += 1
        match_days.add(ko.normalize())
        cur = lo.floor("h")
        while cur < hi:
            day_idx = int((cur.normalize() - day0).days)
            if 0 <= day_idx < days:
                in_window[day_idx][int(cur.hour)] = 1
            cur += pd.Timedelta(hours=1)

    rest_days = []
    d = day0
    while d <= tournament_end:
        if d.normalize() not in match_days:
            rest_days.append(d.tz_convert("UTC").isoformat().replace("+00:00", "Z"))
        d += pd.Timedelta(days=1)

    return {
        "grid": {"day0": day0.tz_convert("UTC").isoformat().replace("+00:00", "Z"), "days": days},
        "in_window": in_window,
        "kickoff_hist": {"hours": kickoff_hours},
        "rest_days": rest_days,
        # Documented convention (also the shape s04.js's own header comment
        # ships as its example): US waking hours, 8am-11pm ET.
        "waking_band": {"start_hour": 8, "end_hour": 23},
    }


def build_s05_scene(market_totals, market_meta, ticker_to_idx, lorenz):
    """s05.js reads total_markets, core_series.{legs,share_pct},
    tail.{markets,share_pct}, gini_pooled, gini_within_family, lorenz_curve[]
    (optional), novelty_market.{series_ticker,label,rank,contracts,
    n_markets,in_below_grain}. below_grain is read from
    manifest.census directly (s05.js's own header note), not from this file.
    core_series/gini_within_family are computed live (class A, matching this
    file's existing treatment of every other Lorenz field) off the same
    market_totals x market_meta join build_lorenz() uses; live recompute
    lands at ~63.3%/0.438 against the dossier's cited ~63.5%/0.44 (R15),
    the same small class-A/class-B drift TILES.md already documents for
    the S10 braid gap."""
    novelty = _read_json_safe(os.path.join(ANALYSIS, "volume-anatomy", "novelty_vs_sports.json"))
    concentration = _read_json_safe(os.path.join(ANALYSIS, "volume-anatomy", "concentration_summary.json"))

    tot_by_ticker = dict(zip(market_totals["ticker"], market_totals["total_dollars"]))
    grand_total = float(market_totals["total_dollars"].sum())
    series_by_ticker = market_meta.set_index("ticker")["series_ticker"].to_dict()

    series_dollars = {}
    for t, d in tot_by_ticker.items():
        st = series_by_ticker.get(t)
        if st:
            series_dollars[st] = series_dollars.get(st, 0.0) + d
    top3_series = set(sorted(series_dollars, key=lambda s: -series_dollars[s])[:3])
    top3_dollars = sum(v for s, v in series_dollars.items() if s in top3_series)
    top3_legs = sum(1 for t in tot_by_ticker if series_by_ticker.get(t) in top3_series)
    core_share_pct = round(top3_dollars / grand_total * 100, 2) if grand_total else None

    within_vals = np.sort(np.array([
        tot_by_ticker[t] for t in tot_by_ticker if series_by_ticker.get(t) in top3_series
    ]))
    gini_within = None
    if len(within_vals):
        cum = np.cumsum(within_vals)
        tot = cum[-1]
        cpv = cum / tot
        cpm = np.arange(1, len(within_vals) + 1) / len(within_vals)
        trapz = getattr(np, "trapezoid", None) or np.trapz
        gini_within = round(float(1.0 - 2.0 * trapz(cpv, cpm)), 4)

    # Novelty exemplar (Gate-4 de-politicization): the brand-advertising family
    # KXWCADS replaces the Trump-mention market everywhere, including this data
    # layer — the emitter must never resurface a political ticker in served
    # JSON. All figures are class-A recomputes off the tape (market_totals),
    # so they refreeze on every deploy-morning rebuild.
    ADS_SERIES = "KXWCADS"
    ads_tickers = {t for t, s in series_by_ticker.items() if s == ADS_SERIES}
    ads_rows = market_totals[market_totals["ticker"].isin(ads_tickers)]
    ads_contracts = float(ads_rows["total_dollars"].sum()) if len(ads_rows) else 0.0
    ads_n_markets = int(len(ads_rows))
    ads_rank = None
    ads_below_grain = None
    if len(ads_rows):
        biggest = float(ads_rows["total_dollars"].max())
        ads_rank = int((market_totals["total_dollars"] > biggest).sum()) + 1
        ads_below_grain = bool(biggest < 75000)

    lorenz_curve_pts = [
        {"market_frac": round(mf, 6), "value_frac": round(vf, 9)}
        for mf, vf in zip(lorenz["cum_pct_markets"][::3], lorenz["cum_pct_volume"][::3])
    ]

    combined = concentration.get("combined_never_traded_plus_bottom_half_traded") or {}
    return {
        "total_markets": novelty.get("n_traded_markets") or concentration.get("n_traded_markets"),
        "core_series": {"legs": top3_legs, "share_pct": core_share_pct},
        "tail": {
            "markets": combined.get("n_markets"),
            "share_pct": round(combined.get("pct_of_total_volume", 0.0), 3),
        },
        "gini_pooled": lorenz["gini"],
        "gini_within_family": gini_within,
        "lorenz_curve": lorenz_curve_pts,
        "novelty_market": {
            "series_ticker": ADS_SERIES,
            "label": "the ad family (which brands advertise around the final)",
            "rank": ads_rank,
            "contracts": round(ads_contracts),
            "n_markets": ads_n_markets,
            "in_below_grain": ads_below_grain,
        },
    }


def build_s06_scene(con, mexeng_meta):
    """s06.js reads window.kickoff_ts, rate_curve[], size_sparkline[],
    kickoff_step_multiplier, size_growth_pct (R8+R16). rate_curve/
    size_sparkline are class-A recomputes off the MEXENG MEX leg's full raw
    trade tape (never the LOD-thinned zoom tile), binned at 15-minute
    resolution across the same window the zoom tile covers. The three
    constants are the dossier's own adversarially-verified R16 figures
    (class B, same convention as press_floor_usd elsewhere in this file)."""
    ticker = "KXWCADVANCE-26JUL05MEXENG-MEX"
    path = os.path.join(DATA, "kalshi", "trades", "series_ticker=KXWCADVANCE", f"{ticker}.parquet")
    window_lo, window_hi = mexeng_meta["window"]
    bucket_s = 900
    df = con.execute(f"""
        SELECT CAST(floor((created_ts - {window_lo}) / {bucket_s}) AS BIGINT) AS bucket,
               COUNT(*) AS n_trades, AVG(count_contracts) AS avg_notional
        FROM parquet_scan('{path}')
        WHERE created_ts BETWEEN {window_lo} AND {window_hi}
        GROUP BY 1 ORDER BY 1
    """).df()
    rate_curve = [
        {"t_s": int(r["bucket"] * bucket_s), "rate_per_s": round(float(r["n_trades"]) / bucket_s, 4)}
        for _, r in df.iterrows()
    ]
    size_sparkline = [
        {"t_s": int(r["bucket"] * bucket_s), "avg_notional_usd": round(float(r["avg_notional"]), 2)}
        for _, r in df.iterrows()
    ]
    return {
        "window": {"kickoff_ts": mexeng_meta["kickoff_iso"]},
        "rate_curve": rate_curve,
        "size_sparkline": size_sparkline,
        "kickoff_step_multiplier": 5.4,
        "pre_kick_rate_per_s": 1.0,
        "size_growth_pct": 15.0,
    }


def build_s07_scene(con, norbra_meta):
    """s07.js reads event.{goal_ts,label}, friction_band_c,
    pinnacle.{quotes,suspend_start_s,suspend_end_s}, polymarket.blocks (R3).
    Recomputed directly off the same raw Pinnacle/Polymarket sources the
    norbra zoom tile uses (read_pinnacle_ftr already applies defect rules
    R1-R3), restricted to the NOR leg (outcome 103 / the PM NOR token) --
    the leg that jumps, matching the vehicle's own committed direction."""
    event_ts = norbra_meta.get("event_ts")
    if not event_ts:
        return {
            "event": None, "friction_band_c": 2,
            "pinnacle": {"quotes": [], "suspend_start_s": None, "suspend_end_s": None},
            "polymarket": {"blocks": []},
        }
    window_lo, window_hi = event_ts - 120, event_ts + 1900  # matches s07.js's CLOCK_DOMAIN_S

    pin = read_pinnacle_ftr(con, "id1000001653452517")
    quotes = []
    suspend_start_s = None
    suspend_end_s = None
    if pin is not None and len(pin):
        g = pin[pin["outcome_id"] == "103"].copy()
        g["t_s"] = g["created_ts_ms"] / 1000.0 - event_ts
        g = g[(g["t_s"] >= -120) & (g["t_s"] <= 1900)].sort_values("t_s")
        quotes = [
            {"t_s": round(float(r["t_s"]), 1), "price_c": int(np.clip(round(r["implied_prob_devigged"] * 100), 1, 99))}
            for _, r in g.iterrows()
        ]
        post = g[g["t_s"] >= -5]
        if len(post) >= 2:
            ts = post["t_s"].values
            gaps = np.diff(ts)
            idx = int(np.argmax(gaps))
            suspend_start_s = round(float(ts[idx]), 1)
            suspend_end_s = round(float(ts[idx + 1]), 1)

    token = NORBRA_PM_TOKENS["NOR"]
    pm_path = os.path.join(POLY_PRICES_ROOT, "priority_tier=1", "fidelity=1", f"{token}.parquet")
    blocks = []
    if os.path.exists(pm_path):
        pm = con.execute(f"""
            SELECT ts_utc, implied_prob FROM parquet_scan('{pm_path}')
            WHERE ts_utc BETWEEN {window_lo} AND {window_hi} ORDER BY ts_utc
        """).df()
        for i in range(len(pm)):
            r = pm.iloc[i]
            t0 = float(r["ts_utc"]) - event_ts
            t1 = (float(pm.iloc[i + 1]["ts_utc"]) - event_ts) if i + 1 < len(pm) else t0 + 60.0
            blocks.append({
                "t_s_start": round(t0, 1), "t_s_end": round(t1, 1),
                "price_c": int(np.clip(round(r["implied_prob"] * 100), 1, 99)),
            })

    return {
        "event": {
            "goal_ts": dt.datetime.fromtimestamp(event_ts, dt.timezone.utc).isoformat().replace("+00:00", "Z"),
            "label": "Haaland's second, Norway-Brazil",
        },
        "friction_band_c": 2,
        "pinnacle": {"quotes": quotes, "suspend_start_s": suspend_start_s, "suspend_end_s": suspend_end_s},
        "polymarket": {"blocks": blocks},
    }


def build_s08_scene(gerpar_meta):
    """s08.js reads only window.whistle_ts -- the instant regulation time
    ends and the regulation leg's forced-expiry glide begins. Grounded in
    the zoom tile's own empirically-anchored regulation_settle_ts (the
    regulation leg's real last trade) minus the dossier's verified 22-minute
    glide duration (R4)."""
    whistle_ts = gerpar_meta["regulation_settle_ts"] - 22 * 60
    return {
        "window": {
            "whistle_ts": dt.datetime.fromtimestamp(whistle_ts, dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        },
    }


def build_s09_scene(con):
    """s09.js reads shocks[].{team,shock_ts,pop_multiple} and
    annotations[].{t_hours,label} (R9). shock_ts/beneficiary come straight
    from post_upset_drift.parquet; the two bracket-news annotation instants
    are computed live from the raw tape's own settlement timestamps of the
    matches that actually confirmed each path (France's R32 win over Sweden
    for Paraguay's next opponent; Spain's R16 win over Portugal for
    Belgium's known quarterfinal) rather than approximated."""
    drift = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "post_upset_drift.parquet"))
    name_to_fifa3 = {"Paraguay": "PAR", "Norway": "NOR", "Belgium": "BEL"}

    def to_utc_ts(v):
        ts = pd.Timestamp(v)
        return (ts.tz_localize("UTC") if ts.tz is None else ts.tz_convert("UTC"))

    shocks = []
    shock_ts_by_team = {}
    for _, r in drift.iterrows():
        team = name_to_fifa3.get(r["beneficiary"])
        if not team:
            continue
        ts = to_utc_ts(r["shock_ts"])
        shocks.append({
            "team": team,
            "shock_ts": ts.isoformat().replace("+00:00", "Z"),
            "pop_multiple": POP_MULTIPLE_BY_TEAM.get(team),
        })
        shock_ts_by_team[team] = ts

    def last_trade_unix(series_ticker, ticker):
        path = os.path.join(DATA, "kalshi", "trades", f"series_ticker={series_ticker}", f"{ticker}.parquet")
        if not os.path.exists(path):
            return None
        row = con.execute(f"SELECT MAX(created_ts) FROM parquet_scan('{path}')").fetchone()
        return row[0] if row else None

    annotations = []
    if "PAR" in shock_ts_by_team:
        fra_settle = last_trade_unix("KXWCGAME", "KXWCGAME-26JUN30FRASWE-FRA")
        if fra_settle is not None:
            t_hours = (fra_settle - shock_ts_by_team["PAR"].timestamp()) / 3600.0
            annotations.append({"team": "PAR", "t_hours": round(t_hours, 1), "label": "France confirmed next"})
    if "BEL" in shock_ts_by_team:
        esp_settle = last_trade_unix("KXWCGAME", "KXWCGAME-26JUL06PORESP-ESP")
        if esp_settle is not None:
            # Spain's own R16 win settled BEFORE Belgium's shock (both were
            # decided the same knockout window); the honest t_hours is
            # therefore ~0 (already known at shock time), clamped to the
            # domain's non-negative half rather than plotted off-screen.
            t_hours = max(0.0, (esp_settle - shock_ts_by_team["BEL"].timestamp()) / 3600.0)
            annotations.append({"team": "BEL", "t_hours": round(t_hours, 1), "label": "Spain quarterfinal already known"})

    return {"shocks": shocks, "annotations": annotations}


def build_s10_scene(con):
    """s10.js reads knockout_window.{start,end}, gap_summary.mean_1min_gap_pts,
    braid.{t,kalshi_pts,polymarket_pts,pinnacle_pts}, goal_spikes[], and
    pinnacle_terminations[] (R2). Unlike series.bin's build_braid() (which
    pads every leg to a fixed kickoff-30min..kickoff+150min calendar with
    bfill so a whole-tournament trace never breaks), this braid is
    LIVE-WINDOW-ONLY per the build brief: each leg's points start at its own
    kickoff with no pre-match padding and no backfill, so a scene drawing
    literal per-minute D3 marks never implies a quote existed before real
    trading began. Extra-time/pens matches (went_to_et_or_pens) get a wider
    live window (210min vs 120min)."""
    empty = {
        "knockout_window": None,
        "gap_summary": None,
        "braid": {"t": [], "kalshi_pts": [], "polymarket_pts": [], "pinnacle_pts": []},
        "goal_spikes": [],
        "pinnacle_terminations": [],
    }
    if not os.path.exists(ENTITY_MAP_PLAYED):
        return empty

    em = con.execute(f"SELECT * FROM parquet_scan('{ENTITY_MAP_PLAYED}')").df()
    max_gaps = _read_csv_safe(os.path.join(ANALYSIS, "calibration", "kalshi_vs_polymarket_max_gaps.csv"))
    episodes = _read_csv_safe(os.path.join(ANALYSIS, "calibration", "divergence_episodes_kalshi_vs_pinnacle.csv"))

    t_all, k_all, p_all, pin_all = [], [], [], []
    goal_spikes = []
    win_los, win_his = [], []

    for _, r in em.iterrows():
        if not r["polymarket_match_found"] or not r["pinnacle_match_found"]:
            continue
        try:
            kickoff = pd.Timestamp(r["pinnacle_kickoff_utc"]).timestamp()
        except Exception:
            continue
        duration_min = 210 if bool(r.get("went_to_et_or_pens")) else 120
        lo, hi = int(kickoff), int(kickoff + duration_min * 60)
        win_los.append(lo)
        win_his.append(hi)
        minutes = np.arange(lo, hi, 60)
        if not len(minutes):
            continue

        legs = [
            ("team1", r["kalshi_leg_team1"], r["polymarket_team1_yes_token"], "101"),
            ("team2", r["kalshi_leg_team2"], r["polymarket_team2_yes_token"], "103"),
            ("tie", r["kalshi_leg_tie"], r["polymarket_draw_yes_token"], "102"),
        ]
        pin_df = None
        try:
            pin_df = read_pinnacle_ftr(con, r["pinnacle_fixture_id"])
        except Exception:
            pin_df = pd.DataFrame()

        for leg_name, kticker, pm_token, pin_oid in legs:
            kpath = os.path.join(DATA, "kalshi", "trades", "series_ticker=KXWCGAME", f"{kticker}.parquet")
            if not os.path.exists(kpath):
                continue
            kt = con.execute(f"""
                SELECT created_ts, yes_price_usd FROM parquet_scan('{kpath}')
                WHERE created_ts BETWEEN {lo} AND {hi} ORDER BY created_ts
            """).df()
            kalshi_m = np.full(len(minutes), np.nan)
            if len(kt):
                ks = pd.Series(kt["yes_price_usd"].values, index=kt["created_ts"].values)
                ks = ks.groupby(level=0).last().sort_index()
                kalshi_m = ks.reindex(minutes, method="ffill").values  # no bfill: live-window-only

            pm_path = os.path.join(POLY_PRICES_ROOT, "priority_tier=1", "fidelity=1", f"{pm_token}.parquet")
            if not os.path.exists(pm_path):
                pm_path = os.path.join(POLY_PRICES_ROOT, "priority_tier=1", "fidelity=60", f"{pm_token}.parquet")
            poly_m = np.full(len(minutes), np.nan)
            if os.path.exists(pm_path):
                pt = con.execute(f"""
                    SELECT ts_utc, implied_prob FROM parquet_scan('{pm_path}')
                    WHERE ts_utc BETWEEN {lo} AND {hi} ORDER BY ts_utc
                """).df()
                if len(pt):
                    ps = pd.Series(pt["implied_prob"].values, index=pt["ts_utc"].values)
                    ps = ps.groupby(level=0).last().sort_index()
                    poly_m = ps.reindex(minutes, method="ffill").values

            pinn_m = np.full(len(minutes), np.nan)
            if pin_df is not None and not pin_df.empty:
                g = pin_df[pin_df["outcome_id"] == pin_oid]
                if len(g):
                    g_ts_s = g["created_ts_ms"].values // 1000
                    ps = pd.Series(g["implied_prob_devigged"].values, index=g_ts_s)
                    ps = ps.groupby(level=0).last().sort_index()
                    last_ts = ps.index.max()
                    reindexed = ps.reindex(minutes, method="ffill")
                    pinn_m = np.where(minutes <= last_ts, reindexed.values, np.nan)

            kalshi_pts = np.round(kalshi_m * 100, 2)
            poly_pts = np.round(poly_m * 100, 2)
            pinn_pts = np.round(pinn_m * 100, 2)

            t_all.extend(int(m) for m in minutes)
            k_all.extend(None if np.isnan(v) else float(v) for v in kalshi_pts)
            p_all.extend(None if np.isnan(v) else float(v) for v in poly_pts)
            pin_all.extend(None if np.isnan(v) else float(v) for v in pinn_pts)

            gap = np.abs(kalshi_pts - poly_pts)
            valid_idx = np.where(~np.isnan(gap))[0]
            if len(valid_idx):
                peak_i = valid_idx[np.argmax(gap[valid_idx])]
                if gap[peak_i] >= 15.0:
                    goal_spikes.append({
                        "match_id": r["match_id"], "leg": leg_name,
                        "t": dt.datetime.fromtimestamp(int(minutes[peak_i]), dt.timezone.utc).isoformat().replace("+00:00", "Z"),
                        "gap_pts": round(float(gap[peak_i]), 1),
                    })

    order = np.argsort(t_all) if t_all else np.array([], dtype=int)
    t_sorted = [t_all[i] for i in order]
    k_sorted = [k_all[i] for i in order]
    p_sorted = [p_all[i] for i in order]
    pin_sorted = [pin_all[i] for i in order]

    pinnacle_terminations = [
        {
            "match_id": r["match_id"], "leg": r["leg"],
            "t": pd.Timestamp(r["end_ts"]).isoformat().replace("+00:00", "Z"),
            "last_quote_pts": round(float(r["pinnacle_mean"]) * 100, 2),
        }
        for _, r in episodes.iterrows()
    ] if len(episodes) else []

    mean_gap = round(float(max_gaps["mean_abs_gap_pp"].mean()), 2) if len(max_gaps) else None
    max_gap = round(float(max_gaps["max_abs_gap_pp"].max()), 1) if len(max_gaps) else None

    return {
        "knockout_window": {
            "start": dt.datetime.fromtimestamp(min(win_los), dt.timezone.utc).isoformat().replace("+00:00", "Z") if win_los else None,
            "end": dt.datetime.fromtimestamp(max(win_his), dt.timezone.utc).isoformat().replace("+00:00", "Z") if win_his else None,
        },
        "gap_summary": {
            "mean_1min_gap_pts": mean_gap,
            "goal_second_spike_pts": max_gap,
            "goal_second_spike_duration_s": 60,
            "n_legs": int(len(max_gaps)) if len(max_gaps) else 84,
        },
        "braid": {"t": t_sorted, "kalshi_pts": k_sorted, "polymarket_pts": p_sorted, "pinnacle_pts": pin_sorted},
        "goal_spikes": goal_spikes,
        "pinnacle_terminations": pinnacle_terminations,
    }


def build_s12_scene(ticker_to_idx):
    """s12.js reads date_range.{start_s,end_s}, players[].{key,label,
    reference,market_indices}, and annotations.{july7_8_level.day_s_start,
    kane_halving.after_day_s,assist_tiebreak.text} (R13). Per-dot price/day
    positions come straight from the population tile itself (the scene's own
    header note: 'sparse real dots as the money proof'), so no daily price
    series is shipped here -- golden_boot_daily.parquet is read only to
    ground date_range's bounds in the real trading window."""
    gb_daily = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "golden_boot_daily.parquet"))

    def day_s(ts):
        v = pd.Timestamp(ts)
        return int(v.timestamp() - EPOCH_UNIX)

    players = []
    all_days = []
    for spec in GOLDEN_BOOT_PLAYERS:
        if len(gb_daily):
            rows = gb_daily[gb_daily["player"] == spec["label"]]
            if len(rows):
                all_days.extend(rows["day"].tolist())
        players.append({
            "key": spec["key"], "label": spec["label"], "reference": spec["reference"],
            "market_indices": [ticker_to_idx[spec["ticker"]]] if spec["ticker"] in ticker_to_idx else [],
        })

    if all_days:
        start_s = day_s(min(all_days)) - 86400 * 3
        end_s = day_s(max(all_days)) + 86400 * 6
    else:
        start_s, end_s = 0, 86400 * 240

    return {
        "date_range": {"start_s": start_s, "end_s": end_s},
        "players": players,
        "annotations": {
            "july7_8_level": {"day_s_start": day_s("2026-07-07T07:00:00Z")},
            "kane_halving": {"after_day_s": day_s("2026-07-11T07:00:00Z")},
            "assist_tiebreak": {
                "text": "the contract's own tiebreak favors Mbappe: level on goals, he leads Messi on assists",
            },
        },
    }


def build_s13_scene(con):
    """s13.js reads pairs[].{team,poll_source,poll_pct,kalshi_price_pct},
    host_peers.{teams[],pretournament_cutoff_s}, zombie_money.{n_trades,
    total_usd,max_price_c} (R10+R12+R21). host_peers is a live recompute:
    us_home_bias_futures_peer.parquet only carries LIFETIME contracts
    (~10x too high for the dossier's 'clean pre-tournament window' claim,
    s13.js DATA REQUEST #2), so pretournament contracts + tournament-eve
    price-vs-model ratio are pulled straight off the raw trade tape, cutoff
    2026-06-11T00:00:00Z (verified to reproduce the dossier's cited
    7.5M/9.0M/3.6M/3.4M pre-tournament contract figures almost exactly)."""
    polls = _read_csv_safe(os.path.join(ANALYSIS, "calibration", "poll_vs_market_gaps.csv"))
    host = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "us_home_bias_futures_peer.parquet"))
    zombie = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "zombie_money.parquet"))

    pairs = []
    if len(polls):
        arg_row = polls[polls["poll"].str.startswith("Ipsos (Argentina", na=False)]
        usa_row = polls[polls["entity"] == "United States"]
        if len(arg_row):
            r = arg_row.iloc[0]
            pairs.append({"key": "argentina", "team": "ARG", "poll_source": r["poll"],
                          "poll_pct": float(r["poll_pct"]), "kalshi_price_pct": float(r["kalshi_price_pct"])})
        if len(usa_row):
            r = usa_row.iloc[0]
            pairs.append({"key": "usa", "team": "USA", "poll_source": r["poll"],
                          "poll_pct": float(r["poll_pct"]), "kalshi_price_pct": float(r["kalshi_price_pct"])})

    cutoff = dt.datetime(2026, 6, 11, 0, 0, 0, tzinfo=dt.timezone.utc).timestamp()
    host_specs = [
        {"key": "usa", "label": "USA", "team": "USA", "ticker": "KXMENWORLDCUP-26-US"},
        {"key": "mexico", "label": "Mexico", "team": "MEX", "ticker": "KXMENWORLDCUP-26-MX"},
        {"key": "ecuador", "label": "Ecuador", "team": "ECU", "ticker": "KXMENWORLDCUP-26-EC"},
        {"key": "croatia", "label": "Croatia", "team": "CRO", "ticker": "KXMENWORLDCUP-26-HR"},
    ]
    opta_by_ticker = dict(zip(host["ticker"], host["opta_win_pct"])) if len(host) else {}
    host_teams = []
    for spec in host_specs:
        path = os.path.join(DATA, "kalshi", "trades", "series_ticker=KXMENWORLDCUP", f"{spec['ticker']}.parquet")
        if not os.path.exists(path):
            continue
        row = con.execute(f"SELECT SUM(count_contracts) FROM parquet_scan('{path}') WHERE created_ts < {cutoff}").fetchone()
        lastp = con.execute(f"""
            SELECT yes_price_usd FROM parquet_scan('{path}') WHERE created_ts < {cutoff}
            ORDER BY created_ts DESC LIMIT 1
        """).fetchone()
        entry = {
            "key": spec["key"], "label": spec["label"], "team": spec["team"],
            "pretournament_contracts": round(float(row[0]), 2) if row and row[0] is not None else 0.0,
        }
        opta = opta_by_ticker.get(spec["ticker"])
        if opta:
            entry["model_odds_pct"] = float(opta)
        # Ratio annotation only where the storyboard actually makes the
        # claim (Mexico ~1.8x, USA ~1.5x); Ecuador/Croatia are the honest
        # peer comparison only, per R12.
        if spec["key"] in ("usa", "mexico") and lastp and lastp[0] is not None and opta:
            entry["price_ratio_x"] = round((lastp[0] * 100) / opta, 2)
        host_teams.append(entry)

    zn_trades = int(zombie["n_zombie_trades"].sum()) if len(zombie) else 0
    zusd = float(zombie["zombie_dollar_volume"].sum()) if len(zombie) else 0.0
    zmax = 1.0
    if len(zombie) and zombie["max_price_after_elim_c"].notna().any():
        zmax = float(zombie["max_price_after_elim_c"].max())

    return {
        "pairs": pairs,
        "host_peers": {"teams": host_teams, "pretournament_cutoff_s": int(cutoff - EPOCH_UNIX)},
        "zombie_money": {"n_trades": zn_trades, "total_usd": round(zusd, 2), "max_price_c": round(zmax, 2)},
    }


def build_scene_s14_v2(con):
    """s14.js reads buckets[].{label,lo_c,hi_c,mean_price_c,win_rate_pct,
    vol_weighted_price_c,vol_weighted_win_rate_pct}, ladder_attribution.
    {pct_in_ten_plus_leg_ladders,pct_at_tick_floor}, tick_floor.{lo_c,hi_c},
    worst_bucket_label (R7). lo_c/hi_c are shipped explicitly (data request
    #1) rather than left to the client's label-string fallback parser.
    ladder_attribution is a live recompute off flb_kalshi_market_level.parquet
    verified to reproduce the dossier's 3.04%/1.19% cheap-band implied/
    realized pair (72%/55% for the two ladder-attribution shares)."""
    buckets = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "flb_kalshi_buckets.parquet"))
    buckets_vw = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "flb_kalshi_buckets_volweighted.parquet"))
    vw_by_bucket = buckets_vw.set_index("bucket") if len(buckets_vw) else pd.DataFrame()

    def parse_bounds(label):
        m = re.match(r"^(\d+)-(\d+)c$", str(label))
        return (int(m.group(1)), int(m.group(2))) if m else (None, None)

    merged = []
    for _, r in buckets.iterrows():
        lo_c, hi_c = parse_bounds(r["bucket"])
        row = {
            "label": r["bucket"], "lo_c": lo_c, "hi_c": hi_c,
            "n_markets": int(r["n_markets"]),
            "mean_price_c": round(float(r["mean_price_c"]), 3),
            "win_rate_pct": round(float(r["win_rate_pct"]), 3),
        }
        if r["bucket"] in vw_by_bucket.index:
            vw = vw_by_bucket.loc[r["bucket"]]
            row["vol_weighted_price_c"] = round(float(vw["vol_weighted_price_c"]), 3)
            row["vol_weighted_win_rate_pct"] = round(float(vw["vol_weighted_win_rate_pct"]), 3)
        merged.append(row)

    ml = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "flb_kalshi_market_level.parquet"))
    ladder_attribution = None
    if len(ml):
        ml = ml.copy()
        ml["price_c"] = ml["price_t_minus_1h"] * 100
        cheap = ml[(ml["price_c"] >= 1) & (ml["price_c"] < 10)].copy()
        if len(cheap):
            cheap_ladder_size = cheap.groupby("event_ticker").size()
            cheap["ladder_size"] = cheap["event_ticker"].map(cheap_ladder_size)
            pct_ten_plus = float((cheap["ladder_size"] >= 10).mean() * 100)
            pct_tick_floor = float(cheap["price_c"].round().isin([1, 2]).mean() * 100)
            ladder_attribution = {
                "pct_in_ten_plus_leg_ladders": round(pct_ten_plus, 1),
                "pct_at_tick_floor": round(pct_tick_floor, 1),
            }

    return {
        "buckets": merged,
        "ladder_attribution": ladder_attribution,
        "tick_floor": {"lo_c": 1, "hi_c": 2},
        "worst_bucket_label": "90-95c",
    }


def build_scene_s15_v2():
    """s15.js reads stages[].{id,label,window:[start,end],opta_pct} (R6).
    Population dots draw at their OWN traded price (money, never invented);
    the single model reference line the scene overlay draws needs one
    number per stage, so this ships France's own raw Opta win_pct (the
    storyboard's headline team, 'priced France ... above Opta') -- verified
    to put France's own price above this line at all 5 stages by
    construction, and Spain's own price below it at 4 of 5 (the pre-
    tournament stage is the one honest exception in the real data, not
    smoothed away). A future scene-module revision could plot Spain's own
    opta line separately; the module currently supports only one line."""
    sf = _read_csv_safe(os.path.join(ANALYSIS, "calibration", "semifinalists_price_vs_opta_elo.csv"))
    if not len(sf):
        return {"stages": []}
    stage_meta = (sf[["stage_id", "stage_label", "as_of_date"]]
                  .drop_duplicates().sort_values("stage_id").reset_index(drop=True))
    fra_by_stage = sf[sf["team"] == "France"].set_index("stage_id")["opta_win_pct"]

    stages = []
    prev_end = "2025-05-15T00:00:00Z"  # winner book's own first-trade date (s02.json)
    for _, row in stage_meta.iterrows():
        sid = int(row["stage_id"])
        end_iso = pd.Timestamp(row["as_of_date"], tz="UTC").isoformat().replace("+00:00", "Z")
        opta_pct = round(float(fra_by_stage.loc[sid]) * 100, 2) if sid in fra_by_stage.index else None
        stages.append({
            "id": f"s{sid}", "label": row["stage_label"],
            "window": [prev_end, end_iso], "opta_pct": opta_pct,
        })
        prev_end = end_iso
    return {"stages": stages}


# ---- class B repackers: verbatim numbers from Phase-2 analysis outputs --

def _read_parquet_safe(path, **kw):
    try:
        return pd.read_parquet(path, **kw)
    except Exception as e:
        log(f"  WARNING: could not read {path}: {e}")
        return pd.DataFrame()


def _read_csv_safe(path, **kw):
    try:
        return pd.read_csv(path, **kw)
    except Exception as e:
        log(f"  WARNING: could not read {path}: {e}")
        return pd.DataFrame()


def _read_json_safe(path):
    try:
        return json.load(open(path))
    except Exception as e:
        log(f"  WARNING: could not read {path}: {e}")
        return {}


def provenance(sources):
    return {"sources": sources, "generated": dt.datetime.now(dt.timezone.utc).isoformat()}


def build_scene_s02(family_cum_summary):
    return {
        "_provenance": provenance(["build_tiles.py: build_family_cumulative()"]),
        "listing_first_trade": "2025-05-15",
        "draw_date": "2025-12-05",
        "tournament_start": "2026-06-11",
        "final_date": "2026-07-19",
        "you_are_here": dt.datetime.now(dt.timezone.utc).date().isoformat(),
    }


def build_scene_s03(family_cum_summary):
    cutoffs = build_s03_cutoffs()
    return dict({
        "_provenance": provenance([
            "build_tiles.py: build_family_cumulative() (class A)",
            "pipeline/data/analysis/volume-anatomy/family_crossover.json (R18/R1, day-boundary cross-check)",
        ]),
    }, **cutoffs)


def build_scene_s04(con):
    grid = build_s04_scene(con)
    return dict({
        "_provenance": provenance([
            "build_tiles.py: build_s04_scene() (class A)",
            "pipeline/data/analysis/volume-anatomy/match_windows.parquet (R11)",
        ]),
    }, **grid)


def build_scene_s05(con, market_totals, market_meta, ticker_to_idx, lorenz):
    s05 = build_s05_scene(market_totals, market_meta, ticker_to_idx, lorenz)
    return dict({
        "_provenance": provenance([
            "build_tiles.py: build_lorenz() + build_s05_scene() (class A)",
            "pipeline/data/analysis/volume-anatomy/novelty_vs_sports.json (R14, class B)",
            "pipeline/data/analysis/volume-anatomy/concentration_summary.json (R15, class B)",
        ]),
    }, **s05)


def build_scene_s06(con, mexeng_meta):
    s06 = build_s06_scene(con, mexeng_meta)
    return dict({
        "_provenance": provenance([
            "build_tiles.py: build_s06_scene(), live rate/size recompute off the MEXENG trade tape (class A)",
            "pipeline/data/analysis/volume-anatomy/mexeng_summary.json (R8, class B cross-check)",
            "pipeline/data/analysis/ingame-microstructure/size_regime.parquet (R16, class B constants)",
        ]),
    }, **s06)


def build_scene_s07(con, norbra_meta):
    s07 = build_s07_scene(con, norbra_meta)
    return dict({
        "_provenance": provenance([
            "build_tiles.py: build_s07_scene(), live Pinnacle/Polymarket NOR-leg recompute (class A, R1-R3 filtered)",
            "pipeline/data/analysis/ingame-microstructure/events_matched.parquet (R3/R22, event anchor)",
        ]),
    }, **s07)


def build_scene_s08(gerpar_meta):
    s08 = build_s08_scene(gerpar_meta)
    return dict({
        "_provenance": provenance(["build_tiles.py: build_s08_scene(), zoom[gerpar] regulation-settle recompute (class A)"]),
    }, **s08)


def build_scene_s09(con):
    s09 = build_s09_scene(con)
    return dict({
        "_provenance": provenance([
            "pipeline/data/analysis/bias-forensics/post_upset_drift.parquet (R9, class B shock_ts/beneficiary)",
            "build_tiles.py: build_s09_scene(), live bracket-confirmation timestamp recompute (class A)",
        ]),
    }, **s09)


def build_scene_s10(con):
    s10 = build_s10_scene(con)
    return dict({
        "_provenance": provenance([
            "build_tiles.py: build_s10_scene(), live-window-only per-minute braid recompute (class A)",
            "pipeline/data/analysis/calibration/kalshi_vs_polymarket_max_gaps.csv (R2, class B gap_summary)",
            "pipeline/data/analysis/calibration/divergence_episodes_kalshi_vs_pinnacle.csv (R2, class B terminations)",
        ]),
    }, **s10)


def build_scene_s11():
    scores = _read_csv_safe(os.path.join(ANALYSIS, "calibration", "scores_match3way_by_source_horizon.csv"))
    return {
        "_provenance": provenance(["pipeline/data/analysis/calibration/scores_match3way_by_source_horizon.csv (R5, class B)"]),
        "scores": df_records(scores) if len(scores) else [],
        "three_traps_receipt": [
            "the 16 Kalshi-Pinnacle 'divergence episodes' (S10): feed termination, not disagreement",
            "the 29s/60s/119s reaction ladder (S7): three measurement artifacts, not a speed ranking",
            "the T-5min Brier 'blowout' (this scene): live repricing scored against a closed book",
        ],
    }


def build_scene_s12(ticker_to_idx):
    s12 = build_s12_scene(ticker_to_idx)
    return dict({
        "_provenance": provenance([
            "pipeline/data/analysis/bias-forensics/golden_boot_daily.parquet (R13, date_range grounding only)",
            "docs/data/markets.json market index (this build's ticker_to_idx)",
        ]),
    }, **s12)


def build_scene_s13(con):
    s13 = build_s13_scene(con)
    return dict({
        "_provenance": provenance([
            "pipeline/data/analysis/calibration/poll_vs_market_gaps.csv (R10, class B)",
            "build_tiles.py: live pre-tournament host-peer recompute off the raw trade tape (class A, R12 cutoff)",
            "pipeline/data/analysis/bias-forensics/zombie_money.parquet (R21, class B)",
        ]),
    }, **s13)


def build_scene_s14(con):
    s14 = build_scene_s14_v2(con)
    return dict({
        "_provenance": provenance([
            "pipeline/data/analysis/bias-forensics/flb_kalshi_buckets.parquet, flb_kalshi_buckets_volweighted.parquet (R7, class B)",
            "build_tiles.py: live ladder_attribution recompute off flb_kalshi_market_level.parquet (class A, verified against R7's 3.04%/1.19%)",
        ]),
        "lorenz_tail_cross_ref": "dots in these buckets carrying LORENZ_TAIL (flag bit 0) are the same identities as S5's tail sweep",
    }, **s14)


def build_scene_s15(con=None):
    s15 = build_scene_s15_v2()
    return dict({
        "_provenance": provenance(["pipeline/data/analysis/calibration/semifinalists_price_vs_opta_elo.csv (R6, class B)"]),
    }, **s15)


def build_scene_s16():
    return {
        "_provenance": provenance(["no new analysis tables; recaps single anchor marks from s10/s14/s09/s13/s15"]),
        "lenses": [
            {"id": "L1", "lockup": "Habit one: the number is the number", "anchor": "s10.braid"},
            {"id": "L2", "lockup": "Habit two: where the money is", "anchor": "s14.calibration_curve_dollar_weighted"},
            {"id": "L3", "lockup": "Habit three: the spike is the price", "anchor": "s09.norway_argentina_mirror"},
            {"id": "L4", "lockup": "Habit four: attention is not belief", "anchor": "s13.argentina_poll_price_pair"},
            {"id": "L5", "lockup": "Habit five: this market holds opinions", "anchor": "s15.stage_strip"},
        ],
    }


def build_scene_s17(hero):
    return {
        "_provenance": provenance(["build_tiles.py: build_hero() (class A, provisional pre-G3)"]),
        "hero_ref": "manifest.hero",
        "provenance_line_template": "raw traded price, frozen at pipeline run {frozen_at}; multi-way legs sum above 100% before the vig is removed; this number does not update",
    }


# --------------------------------------------------------------------------
# 7. Manifest assembly + main
# --------------------------------------------------------------------------

def check_cap(name, nbytes):
    cap = CAPS.get(name)
    status = "OK"
    if cap is not None and nbytes > cap:
        status = "OVER CAP"
    log(f"  cap check: {name:24s} {nbytes/1e6:8.3f}MB / {cap/1e6:.2f}MB cap  [{status}]" if cap else
        f"  cap check: {name:24s} {nbytes/1e6:8.3f}MB  (no per-file cap)")
    return status == "OK"


def main():
    # --freeze: the G3 morning-of-final refresh pass. Stamps manifest.frozen_at
    # with this run's UTC instant so S17's provenance line ("raw traded price,
    # frozen at {frozen_at}; ... this number does not update") renders the real
    # freeze moment instead of the pre-G3 placeholder.
    freeze = "--freeze" in sys.argv

    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.join(OUT, "zoom"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "scenes"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "replay"), exist_ok=True)

    con = make_con()
    generated_iso = dt.datetime.now(dt.timezone.utc).isoformat()

    log("=== step 1/6: market metadata (family/team/fate) ===")
    market_meta = build_market_meta(con)
    log(f"market_meta: {len(market_meta):,} catalog rows")

    log("=== step 2/6: market totals (full tape scan) ===")
    market_totals = compute_market_totals(con)
    log(f"market_totals: {len(market_totals):,} traded tickers, "
        f"${market_totals['total_dollars'].sum():,.0f} total, "
        f"{int(market_totals['n_trades'].sum()):,} trades")

    log("=== step 3/6: population tile ===")
    pop = build_population(con, market_meta, market_totals)

    log("=== step 4/6: zoom extracts ===")
    fraesp_buf, fraesp_meta = build_fraesp_zoom(con)
    mexeng_buf, mexeng_meta = build_mexeng_zoom(con)
    gerpar_buf, gerpar_meta = build_gerpar_zoom(con)
    try:
        norbra_buf, norbra_meta = build_norbra_zoom(con)
    except Exception as e:
        log(f"zoom[norbra]: FAILED ({e}); writing empty placeholder tile")
        buf, cols = pack_zoom(*(np.array([], dtype=t) for t in ("<u4", "<u4", "<f4", "<u1", "<u1", "<u1", "<u1")))
        norbra_buf, norbra_meta = buf, {"columns": cols, "t0_unix": 0, "window": [0, 0], "legs": [], "trades": 0, "build_stride": 1}

    log("=== step 5/6: aggregate series + scene JSON ===")
    ticker_to_idx = pop["ticker_to_idx"]
    fam_sections, fam_summary = build_family_cumulative(con, market_meta)
    lorenz = build_lorenz(market_totals)
    hero = build_hero(con, pop["finalists"])
    braid_result = None
    try:
        braid_result = build_braid(con)
    except Exception as e:
        log(f"series[braid]: FAILED ({e}); series.bin will ship without a live braid trace")

    series_sections = list(fam_sections)
    if braid_result:
        b_sections, _braid_summary_unused = braid_result
        series_sections += b_sections
    series_buf, series_manifest_sections = pack_series(series_sections)

    log("=== step 5b/6: scene-JSON field-parity rebuilds (s03/s04/s05/s06/s07/s08/s09/s10/s12/s13/s14/s15) ===")
    scenes = {
        "s02": build_scene_s02(fam_summary),
        "s03": build_scene_s03(fam_summary),
        "s04": build_scene_s04(con),
        "s05": build_scene_s05(con, market_totals, market_meta, ticker_to_idx, lorenz),
        "s06": build_scene_s06(con, mexeng_meta),
        "s07": build_scene_s07(con, norbra_meta),
        "s08": build_scene_s08(gerpar_meta),
        "s09": build_scene_s09(con),
        "s10": build_scene_s10(con),
        "s11": build_scene_s11(),
        "s12": build_scene_s12(ticker_to_idx),
        "s13": build_scene_s13(con),
        "s14": build_scene_s14(con),
        "s15": build_scene_s15(),
        "s16": build_scene_s16(),
        "s17": build_scene_s17(hero),
    }

    log("=== step 6/6: writing files + manifest ===")
    sizes = {}

    sizes["pop-75k.bin"] = write_bin("pop-75k.bin", pop["desktop"]["buf"])
    sizes["pop-250k.bin"] = write_bin("pop-250k.bin", pop["mobile"]["buf"])
    sizes["zoom/fraesp.bin"] = write_bin("zoom/fraesp.bin", fraesp_buf)
    sizes["zoom/mexeng.bin"] = write_bin("zoom/mexeng.bin", mexeng_buf)
    sizes["zoom/gerpar.bin"] = write_bin("zoom/gerpar.bin", gerpar_buf)
    sizes["zoom/norbra.bin"] = write_bin("zoom/norbra.bin", norbra_buf)
    sizes["series.bin"] = write_bin("series.bin", series_buf)

    markets_json_path = os.path.join(OUT, "markets.json")
    with open(markets_json_path, "w") as f:
        json.dump(pop["markets_json"], f, separators=(",", ":"))
    sizes["markets.json"] = os.path.getsize(markets_json_path)

    scenes_bytes = 0
    scene_urls = {}
    for sid, payload in scenes.items():
        path = os.path.join(OUT, "scenes", f"{sid}.json")
        with open(path, "w") as f:
            json.dump(payload, f, separators=(",", ":"), default=str)
        scenes_bytes += os.path.getsize(path)
        scene_urls[sid] = f"data/scenes/{sid}.json"
    sizes["scenes"] = scenes_bytes

    # ---- coda replay index (shards deferred; see TILES.md sec 5) ----
    replay_candidates = pop["markets_json"]["markets"]
    replay_sorted = sorted(replay_candidates, key=lambda m: -m["d"])[:500]
    replay_index = {
        "note": "market picker rows only; per-market RTSER1 price-life shards are a documented follow-up (see TILES.md sec 5), not generated in this build pass",
        "markets": [
            {"ticker": m["t"], "family": FAMILY_ENUM[m["f"]], "team": TEAMS[m["tm"]],
             "dollars": m["d"], "fate": FATE_ENUM[m["ft"]]}
            for m in replay_sorted
        ],
    }
    replay_index_path = os.path.join(OUT, "replay", "index.json")
    with open(replay_index_path, "w") as f:
        json.dump(replay_index, f, separators=(",", ":"))
    sizes["replay/index.json"] = os.path.getsize(replay_index_path)

    manifest = {
        "version": 1,
        "generated": generated_iso,
        "frozen_at": generated_iso.replace("+00:00", "Z") if freeze else None,
        "frozen_at_note": ("G3 morning-of-final refresh: hero legs + every scene figure frozen at this run"
                           if freeze else
                           "set by the G3 morning-of-final refresh pass; this build predates it"),
        "epoch": EPOCH.isoformat().replace("+00:00", "Z"),
        "population": {
            "desktop": {
                "url": "data/pop-75k.bin", "bytes": sizes["pop-75k.bin"], "dots": pop["desktop"]["dots"],
                "grain_usd": pop["desktop"]["grain_usd"], "grain_text": pop["desktop"]["grain_text"],
                "columns": pop["desktop"]["cols"],
            },
            "mobile": {
                "url": "data/pop-250k.bin", "bytes": sizes["pop-250k.bin"], "dots": pop["mobile"]["dots"],
                "grain_usd": pop["mobile"]["grain_usd"], "grain_text": pop["mobile"]["grain_text"],
                "columns": pop["mobile"]["cols"],
            },
        },
        "enums": {
            "family": FAMILY_ENUM, "side": SIDE_ENUM, "fate": FATE_ENUM, "flags": FLAGS_ENUM,
        },
        "teams": TEAMS,
        "markets": {"url": "data/markets.json", "bytes": sizes["markets.json"],
                    "n_markets": len(pop["markets_json"]["markets"]), "n_strata": len(pop["markets_json"]["strata"])},
        "zoom": {
            "fraesp": {"url": "data/zoom/fraesp.bin", "bytes": sizes["zoom/fraesp.bin"],
                       "trades": fraesp_meta["trades"], "build_stride": fraesp_meta["build_stride"],
                       "t0": dt.datetime.fromtimestamp(fraesp_meta["t0_unix"], dt.timezone.utc).isoformat(),
                       "window": [dt.datetime.fromtimestamp(w, dt.timezone.utc).isoformat() for w in fraesp_meta["window"]],
                       "legs": fraesp_meta["legs"], "columns": fraesp_meta["columns"]},
            "mexeng": {"url": "data/zoom/mexeng.bin", "bytes": sizes["zoom/mexeng.bin"],
                       "trades": mexeng_meta["trades"], "build_stride": mexeng_meta["build_stride"],
                       "t0": dt.datetime.fromtimestamp(mexeng_meta["t0_unix"], dt.timezone.utc).isoformat(),
                       "window": [dt.datetime.fromtimestamp(w, dt.timezone.utc).isoformat() for w in mexeng_meta["window"]],
                       "legs": mexeng_meta["legs"], "columns": mexeng_meta["columns"],
                       "kickoff_iso": mexeng_meta["kickoff_iso"]},
            "gerpar": {"url": "data/zoom/gerpar.bin", "bytes": sizes["zoom/gerpar.bin"],
                       "trades": gerpar_meta["trades"], "build_stride": gerpar_meta["build_stride"],
                       "t0": dt.datetime.fromtimestamp(gerpar_meta["t0_unix"], dt.timezone.utc).isoformat(),
                       "window": [dt.datetime.fromtimestamp(w, dt.timezone.utc).isoformat() for w in gerpar_meta["window"]],
                       "legs": gerpar_meta["legs"], "columns": gerpar_meta["columns"]},
            "norbra": {"url": "data/zoom/norbra.bin", "bytes": sizes["zoom/norbra.bin"],
                       "trades": norbra_meta["trades"], "build_stride": norbra_meta["build_stride"],
                       "t0": dt.datetime.fromtimestamp(norbra_meta["t0_unix"], dt.timezone.utc).isoformat() if norbra_meta["window"][1] else None,
                       "window": [dt.datetime.fromtimestamp(w, dt.timezone.utc).isoformat() for w in norbra_meta["window"]] if norbra_meta["window"][1] else [],
                       "legs": norbra_meta["legs"], "columns": norbra_meta["columns"],
                       "event_ts": norbra_meta.get("event_ts"), "event_note": norbra_meta.get("event_note")},
        },
        "series": {"url": "data/series.bin", "bytes": sizes["series.bin"], "sections": series_manifest_sections},
        "scenes": scene_urls,
        "hero": hero,
        "census": pop["census"],
        "coda": {"markets_url": "data/replay/index.json", "bytes": sizes["replay/index.json"]},
    }

    manifest_path = os.path.join(OUT, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=None, separators=(",", ":"), default=str)
    sizes["manifest.json"] = os.path.getsize(manifest_path)

    # ---- budget report ----
    log("")
    log("=== BUDGET REPORT ===")
    all_ok = True
    for name in ["manifest.json", "markets.json", "pop-75k.bin", "pop-250k.bin",
                 "zoom/fraesp.bin", "zoom/mexeng.bin", "zoom/gerpar.bin", "zoom/norbra.bin",
                 "series.bin", "scenes", "replay/index.json"]:
        nb = sizes.get(name, 0)
        cap_name = "manifest+markets" if name in ("manifest.json", "markets.json") else name
        ok = check_cap(cap_name, nb) if cap_name in CAPS else check_cap(name, nb)
        all_ok = all_ok and ok

    total_bytes = sum(sizes.values())
    total_mb = total_bytes / 1e6
    log(f"TOTAL: {total_mb:.3f} MB  (budget: {TOTAL_BUDGET_BYTES/1e6:.0f} MB)  "
        f"[{'OK' if total_bytes <= TOTAL_BUDGET_BYTES else 'OVER BUDGET'}]")

    tiles_written = [{"name": k, "bytes": v} for k, v in sorted(sizes.items())]

    result = {
        "tiles_written": tiles_written,
        "total_bytes": total_bytes,
        "total_mb": round(total_mb, 3),
        "manifest_path": manifest_path,
        "all_caps_ok": all_ok,
        "population_dots_desktop": pop["desktop"]["dots"],
        "population_dots_mobile": pop["mobile"]["dots"],
        "finalists": pop["finalists"],
    }
    result_path = os.path.join(os.path.dirname(__file__), "_last_build_report.json")
    with open(result_path, "w") as f:
        json.dump(result, f, indent=2, default=str)
    log(f"build report written to {result_path}")
    log("DONE.")
    return result


if __name__ == "__main__":
    main()
