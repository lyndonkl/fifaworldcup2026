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
    df["created_ts_ms"] = pd.to_datetime(df["created_at"], utc=True).astype("int64") // 1_000_000
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
    crossover = _read_json_safe(os.path.join(ANALYSIS, "volume-anatomy", "family_crossover.json"))
    return {
        "_provenance": provenance(["build_tiles.py: build_family_cumulative()",
                                    "pipeline/data/analysis/volume-anatomy/family_crossover.json (R18, class B crossover-day cross-check)"]),
        "press_floor_usd": 7_400_000_000,
        "press_floor_note": "widely reported figure; matches the tape's own cumulative as of roughly 2026-06-30 (R1)",
        "final_futures_usd": family_cum_summary["final_futures_usd"],
        "final_match_usd": family_cum_summary["final_match_usd"],
        "crossover_day": family_cum_summary["crossover_day"],
        "dossier_crossover_day": crossover.get("cumulative_crossover_day"),
        "day1_futures_contracts": crossover.get("jun11_futures_contracts"),
        "day1_match_contracts": crossover.get("jun11_match_contracts"),
    }


def build_scene_s04(clock_grid):
    return dict({"_provenance": provenance(["build_tiles.py: build_clock_grid()"])}, **clock_grid)


def build_scene_s05(lorenz, census):
    novelty = _read_json_safe(os.path.join(ANALYSIS, "volume-anatomy", "novelty_vs_sports.json"))
    return {
        "_provenance": provenance(["build_tiles.py: build_lorenz()",
                                    "pipeline/data/analysis/volume-anatomy/novelty_vs_sports.json (R14, class B)"]),
        "lorenz": lorenz,
        "below_grain": census["below_grain"],
        "trump_market": {
            "ticker": novelty.get("ticker"), "contracts": novelty.get("contracts"),
            "rank": novelty.get("rank_out_of_traded_markets"), "n_traded_markets": novelty.get("n_traded_markets"),
            "biggest_market_ticker": novelty.get("biggest_market_ticker"),
            "multiple_below_biggest": novelty.get("multiple_below_biggest"),
        },
    }


def build_scene_s06():
    mexeng = _read_json_safe(os.path.join(ANALYSIS, "volume-anatomy", "mexeng_summary.json"))
    return {"_provenance": provenance(["pipeline/data/analysis/volume-anatomy/mexeng_summary.json (R8, class B)"]),
            **mexeng}


def build_scene_s07(con):
    ev = find_events_matched(con, "JUL05BRANOR")
    reaction = _read_parquet_safe(os.path.join(ANALYSIS, "ingame-microstructure", "reaction_latency.parquet"))
    rl = df_records(reaction[reaction.get("match_id", pd.Series(dtype=str)) == "JUL05BRANOR"]) if len(reaction) else []
    return {
        "_provenance": provenance(["pipeline/data/analysis/ingame-microstructure/events_matched.parquet (R3/R22, class B)",
                                    "pipeline/data/analysis/ingame-microstructure/reaction_latency.parquet (R3, class B)"]),
        "vehicle": "Norway-Brazil, Haaland's second goal",
        "event_candidates": df_records(ev) if len(ev) else [],
        "reaction_latency_rows": rl,
        "friction_band_c": 2,
        "note": "R23 standing prohibition: no cross-venue speed ranking; lanes render at native grain only.",
    }


def build_scene_s08(gerpar_meta, con):
    reg_path = os.path.join(DATA, "kalshi", "trades", "series_ticker=KXWCGAME", "KXWCGAME-26JUN29GERPAR-GER.parquet")
    lo, hi = gerpar_meta["regulation_settle_ts"] - 22 * 60, gerpar_meta["regulation_settle_ts"]
    d = con.execute(f"""
        SELECT created_ts, yes_price_usd FROM parquet_scan('{reg_path}')
        WHERE created_ts BETWEEN {lo} AND {hi} ORDER BY created_ts
    """).df()
    decay_cps_per_min = None
    if len(d) > 1:
        span_min = (d["created_ts"].iloc[-1] - d["created_ts"].iloc[0]) / 60.0
        drop_c = (d["yes_price_usd"].iloc[0] - d["yes_price_usd"].iloc[-1]) * 100
        decay_cps_per_min = round(drop_c / span_min, 3) if span_min > 0 else None
    return {
        "_provenance": provenance(["build_tiles.py: zoom[gerpar] regulation-leg decay recompute (class A)"]),
        "regulation_decay_window_s": [lo, hi],
        "regulation_decay_cents_per_min": decay_cps_per_min,
        "goal_jump_reference_c": [19, 25], "goal_jump_reference_window_s": 30,
        "advance_settle_ts": gerpar_meta["advance_settle_ts"],
        "regulation_settle_ts": gerpar_meta["regulation_settle_ts"],
    }


def build_scene_s09():
    drift = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "post_upset_drift.parquet"))
    series = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "post_upset_drift_series.parquet"))
    return {
        "_provenance": provenance(["pipeline/data/analysis/bias-forensics/post_upset_drift.parquet (R9, class B)",
                                    "pipeline/data/analysis/bias-forensics/post_upset_drift_series.parquet (R9, class B)"]),
        "drift_summary": df_records(drift) if len(drift) else [],
        "drift_series": df_records(series, limit=2000) if len(series) else [],
    }


def build_scene_s10(braid_summary):
    max_gaps = _read_csv_safe(os.path.join(ANALYSIS, "calibration", "kalshi_vs_polymarket_max_gaps.csv"))
    episodes = _read_csv_safe(os.path.join(ANALYSIS, "calibration", "divergence_episodes_kalshi_vs_pinnacle.csv"))
    out = {
        "_provenance": provenance(["build_tiles.py: build_braid() (class A recompute)",
                                    "pipeline/data/analysis/calibration/kalshi_vs_polymarket_max_gaps.csv (R2, class B)",
                                    "pipeline/data/analysis/calibration/divergence_episodes_kalshi_vs_pinnacle.csv (R2, class B)"]),
        "max_gaps": df_records(max_gaps) if len(max_gaps) else [],
        "n_pinnacle_episodes": len(episodes),
    }
    if braid_summary:
        out["braid"] = braid_summary
    return out


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


def build_scene_s12_13():
    gb_daily = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "golden_boot_daily.parquet"))
    gb_snap = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "golden_boot_snapshot.parquet"))
    polls = _read_csv_safe(os.path.join(ANALYSIS, "calibration", "poll_vs_market_gaps.csv"))
    host = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "us_home_bias_futures_peer.parquet"))
    zombie = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "zombie_money.parquet"))
    return {
        "_provenance": provenance([
            "pipeline/data/analysis/bias-forensics/golden_boot_daily.parquet, golden_boot_snapshot.parquet (R13, class B)",
            "pipeline/data/analysis/calibration/poll_vs_market_gaps.csv (R10, class B)",
            "pipeline/data/analysis/bias-forensics/us_home_bias_futures_peer.parquet (R12, class B)",
            "pipeline/data/analysis/bias-forensics/zombie_money.parquet (R21, class B)",
        ]),
        "golden_boot_daily": df_records(gb_daily, limit=1500) if len(gb_daily) else [],
        "golden_boot_snapshot": df_records(gb_snap) if len(gb_snap) else [],
        "poll_vs_market_gaps": df_records(polls) if len(polls) else [],
        "host_peer_band": df_records(host) if len(host) else [],
        "zombie_money_summary": df_records(zombie) if len(zombie) else [],
    }


def build_scene_s14():
    buckets = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "flb_kalshi_buckets.parquet"))
    buckets_vw = _read_parquet_safe(os.path.join(ANALYSIS, "bias-forensics", "flb_kalshi_buckets_volweighted.parquet"))
    return {
        "_provenance": provenance([
            "pipeline/data/analysis/bias-forensics/flb_kalshi_buckets.parquet (R7, class B)",
            "pipeline/data/analysis/bias-forensics/flb_kalshi_buckets_volweighted.parquet (R7, class B)",
        ]),
        "buckets_by_market_count": df_records(buckets) if len(buckets) else [],
        "buckets_by_dollars": df_records(buckets_vw) if len(buckets_vw) else [],
        "lorenz_tail_cross_ref": "dots in these buckets carrying LORENZ_TAIL (flag bit 0) are the same identities as S5's tail sweep",
    }


def build_scene_s15():
    sf = _read_csv_safe(os.path.join(ANALYSIS, "calibration", "semifinalists_price_vs_opta_elo.csv"))
    return {
        "_provenance": provenance(["pipeline/data/analysis/calibration/semifinalists_price_vs_opta_elo.csv (R6, class B)"]),
        "stages": df_records(sf) if len(sf) else [],
    }


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
    fam_sections, fam_summary = build_family_cumulative(con, market_meta)
    lorenz = build_lorenz(market_totals)
    clock_grid = build_clock_grid(con)
    hero = build_hero(con, pop["finalists"])
    braid_result = None
    try:
        braid_result = build_braid(con)
    except Exception as e:
        log(f"series[braid]: FAILED ({e}); S10 will ship without a live braid trace")

    series_sections = list(fam_sections)
    braid_summary = None
    if braid_result:
        b_sections, braid_summary = braid_result
        series_sections += b_sections
    series_buf, series_manifest_sections = pack_series(series_sections)

    scenes = {
        "s02": build_scene_s02(fam_summary),
        "s03": build_scene_s03(fam_summary),
        "s04": build_scene_s04(clock_grid),
        "s05": build_scene_s05(lorenz, pop["census"]),
        "s06": build_scene_s06(),
        "s07": build_scene_s07(con),
        "s08": build_scene_s08(gerpar_meta, con),
        "s09": build_scene_s09(),
        "s10": build_scene_s10(braid_summary),
        "s11": build_scene_s11(),
        "s12": build_scene_s12_13(),
        "s13": build_scene_s12_13(),
        "s14": build_scene_s14(),
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
        "frozen_at": None,
        "frozen_at_note": "set by the G3 morning-of-final refresh pass; this build predates it",
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
