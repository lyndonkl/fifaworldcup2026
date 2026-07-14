"""Catalog discovery: enumerate every 2026 FIFA World Cup market on Kalshi.

Strategy (per the build brief):
  1. Page through GET /series?category=Sports (empirically returns all ~2,366
     Sports series in one call, no pagination needed -- but we still call
     through the client's generic paginator defensively).
  2. Primary match: ticker prefix KXWC* or KXMENWORLDCUP*.
  3. Secondary match: title contains 'world cup' or 'fifa' (case-insensitive),
     to catch differently-prefixed series the ticker filter would miss.
  4. Both strategies produce false positives / near-misses that were checked
     by hand against the live API on 2026-07-13 (see MANUAL_* below and the
     notes returned by this module). This is a curated allow/deny list, not
     a fully automated heuristic -- precision matters more than recall-by-
     regex for a journalism data set that downstream stages will trust.
  5. For every included series: enumerate events (GET /events?series_ticker=)
     and markets (GET /markets?series_ticker=..., limit=1000, cursor-paginated),
     capture the full market record, and write two Parquet files.

Run: pipeline/.venv/bin/python -m ingest.catalog   (from pipeline/ as cwd)
"""

from __future__ import annotations

import json
import logging
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common.api import KalshiClient  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("catalog")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FACT_BASE_PATH = REPO_ROOT / "research" / "fact-base.json"
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "catalog"

# --------------------------------------------------------------------------
# Curated corrections to the two automated match strategies.
#
# All of these were verified by hand against the live API on 2026-07-13
# (empty-string curl probes against /series, /events?series_ticker=...) --
# see the run notes in the pipeline README / structured output for the
# reasoning behind each.
# --------------------------------------------------------------------------

# Ticker starts with KXWC but is NOT the FIFA World Cup (false positives of
# the prefix strategy, caught only by inspecting the title text):
PREFIX_FALSE_POSITIVES = {
    "KXWCCODWARZONE": "Call of Duty: Warzone at the 2025 ESPORTS World Cup, not FIFA.",
    "KXWCCREG": "'West Coast Conference Regular Season Champions' -- WC = West Coast, not World Cup; title doesn't even mention 'World Cup'.",
}

# Series that matched on 'world cup'/'fifa' in the title but ARE a different
# competition or a dead ticker -- excluded even though the secondary text
# strategy would otherwise catch them:
TEXT_MATCH_EXCLUSIONS = {
    "KXMWORLDCUP": "Zero events on the live API (2026-07-13) -- appears to be an unused/duplicate ticker; KXMENWORLDCUP is the live winner series.",
    "KXFIFAWGAME": "'FIFA Women's Game' -- events are women's internationals (Netherlands vs Poland, Iceland vs Spain, etc.) unrelated to the men's 2026 World Cup.",
    "KXCLUBWC": "FIFA Club World Cup 2025 -- a different FIFA tournament (club, not national teams).",
    "KXCLUBWCHOST": "Host-bid market for the 2029 FIFA Club World Cup -- different tournament.",
    "KXT20WORLDCUP": "Cricket T20 World Cup -- different sport entirely, matched only on 'World Cup' text.",
    "KXWT20WORLDCUP": "Women's Cricket T20 World Cup -- different sport.",
    # Esports World Cup 2025 sub-events (KXEWC* family) and misc esports
    # World Cup exhibitions -- all matched only on 'World Cup' text.
    "KXEWCAPEXLEGENDS": "Esports World Cup 2025 (Apex Legends), not FIFA.",
    "KXEWCCALLOFDUTYBLOPS6": "Esports World Cup 2025 (Call of Duty), not FIFA.",
    "KXEWCCHESS": "Esports World Cup 2025 (Chess), not FIFA.",
    "KXEWCCHESS2025": "Esports World Cup 2025 (Chess), not FIFA.",
    "KXEWCCS2": "Esports World Cup 2025 (Counter-Strike 2), not FIFA.",
    "KXEWCDOTA2": "Esports World Cup 2025 (Dota 2), not FIFA.",
    "KXEWCEASPORTSFC": "Esports World Cup 2025 (EA Sports FC 25), not FIFA -- ironic near-miss given the FIFA video-game brand.",
    "KXEWCFATALFURY": "Esports World Cup 2025 (Fatal Fury), not FIFA.",
    "KXEWCFREEFIRE": "Esports World Cup 2025 (Free Fire), not FIFA.",
    "KXEWCHONOROFKINGS": "Esports World Cup 2025 (Honor of Kings), not FIFA.",
    "KXEWCLEAGUEOFLEGENDS": "Esports World Cup 2025 (League of Legends), not FIFA.",
    "KXEWCMLBB": "Esports World Cup 2025 (Mobile Legends: Bang Bang), not FIFA.",
    "KXEWCMOBILELEGENDSBBWOMENS": "Esports World Cup 2025 (MLBB Women's), not FIFA.",
    "KXEWCPUBGBATTLEG": "Esports World Cup 2025 (PUBG: Battlegrounds), not FIFA.",
    "KXEWCRAINBOW6SEIGE": "Esports World Cup 2025 (Rainbow Six Siege), not FIFA.",
    "KXEWCRB6": "Esports World Cup 2025 (Rainbow Six), not FIFA.",
    "KXEWCRSS": "Esports World Cup 2025 (Rainbow Six Siege, alt ticker), not FIFA.",
    "KXEWCSTARCRAFTII": "Esports World Cup 2025 (StarCraft II), not FIFA.",
    "KXEWCTEAMFIGHTTACTICS": "Esports World Cup 2025 (Teamfight Tactics), not FIFA.",
    "KXEWCVALORANT": "Esports World Cup 2025 (VALORANT), not FIFA.",
    "KXAUSTINMAJOR": "'Rennsport at 2025 Esports World Cup' -- sim-racing, not FIFA.",
    "KXTORONTOULTRACHAMPIONSHIP": "Tagged as 'Dota 2 at 2025 Esports World Cup' despite the ticker name -- not FIFA.",
}

# Series that matched only on the secondary text strategy (different ticker
# prefix from KXWC*/KXMENWORLDCUP*) but ARE genuinely part of the 2026 FIFA
# World Cup universe. Tagged with a family label; the qualifying/playoff
# cluster is flagged as an editorial judgment call (see notes) since it
# covers pre-tournament qualification, not the tournament itself.
TEXT_MATCH_INCLUSIONS: dict[str, str] = {
    "KXFIFAUSPULL": "Novelty/political prop ('Will FIFA pull the World Cup out of the USA?') -- squarely 2026 WC-related, differently prefixed.",
    "KXFIFAUSPULLGAME": "Novelty prop on relocating a specific 2026 WC match out of the US -- same family as KXFIFAUSPULL.",
    "KXSOCCERPLAYCRON": "'Will Cristiano Ronaldo play in the World Cup?' pre-tournament participation prop.",
    "KXSOCCERPLAYMESSI": "'Will Lionel Messi play in the World Cup?' pre-tournament participation prop.",
    "KXPLAYWC": "'Will Lamine Yamal play in the World Cup' -- same participation-prop family, per-player series.",
    "KXFIFAADVANCE": "AMBIGUOUS SCOPE: 2026 World Cup qualifying/playoff match advancement (Nov 2025-Mar 2026 fixtures like Iraq vs Bolivia), not the tournament itself.",
    "KXFIFAGAME": "AMBIGUOUS SCOPE: generic FIFA international-match 3-way series covering the Nov 2025 WC qualifying window and Mar 2026 inter-confederation playoffs -- determines who reaches the WC, but is not the WC.",
    "KXFIFATOTAL": "AMBIGUOUS SCOPE: goal totals for the same WC-qualifying/playoff match set as KXFIFAGAME.",
    "KXFIFASPREAD": "AMBIGUOUS SCOPE: handicap spreads for the same WC-qualifying/playoff match set as KXFIFAGAME.",
}

QUALIFYING_FAMILY_TICKERS = {"KXFIFAADVANCE", "KXFIFAGAME", "KXFIFATOTAL", "KXFIFASPREAD"}
NOVELTY_TEXTMATCH_TICKERS = {"KXFIFAUSPULL", "KXFIFAUSPULLGAME", "KXSOCCERPLAYCRON", "KXSOCCERPLAYMESSI", "KXPLAYWC"}


# --------------------------------------------------------------------------
# Family classification
# --------------------------------------------------------------------------
def load_fact_base_family_map() -> dict[str, str]:
    """Extract an explicit ticker->family map from fact-base.json's free-text
    `example_tickers` fields (regex for KX-prefixed tokens), so the family
    labels used here are directly traceable to the verified fact base rather
    than a fresh ad-hoc taxonomy."""
    with open(FACT_BASE_PATH) as f:
        fb = json.load(f)
    mapping: dict[str, str] = {}
    for fam in fb["kalshi"]["contract_families"]:
        name = fam["family"]
        tickers = re.findall(r"KX[A-Z0-9]+", fam.get("example_tickers", ""))
        for t in tickers:
            mapping.setdefault(t, name)
    return mapping


# Canonical family names, copied verbatim from fact-base.json's
# kalshi.contract_families[*].family strings so fallback-classified series
# land in the SAME bucket as fact-base-named series instead of fragmenting
# the summary into near-duplicate labels.
FAM_WINNER = "Tournament winner futures"
FAM_PER_MATCH = "Per-match markets (3-way moneyline + match derivatives)"
FAM_GROUP = "Group-stage markets"
FAM_TEAM_PERF = "Team-performance props (stage of elimination, host-nation performance)"
FAM_PLAYER = "Player props (Golden Boot / top scorer, awards, player goals)"
FAM_NOVELTY = "Tournament-wide totals and novelty props"
FAM_QUALIFYING = "World Cup 2026 qualifying/playoff (pre-tournament, ambiguous scope)"

# Fallback keyword rules (substring match on ticker) for KXWC* series not
# explicitly named in fact-base.json's free text. Order matters: first hit
# wins. Kept intentionally coarse -- this is informational grouping for the
# catalog summary, not an analytical dependency.
FALLBACK_FAMILY_RULES: list[tuple[str, list[str]]] = [
    (FAM_PLAYER,
     ["GOALLEADER", "TEAMLEADGOAL", "PLAYERGOALS", "WCAST", "WCSOA", "HATTRICK", "AWARD",
      "GBOOTGOALS", "GOLDENBOOTCLEAT", "GOALCOMBO", "GOALSTREAK", "FIFATOP10", "SQUAD"]),
    (FAM_GROUP,
     ["GROUPWIN", "WINGROUP", "GROUPQUAL", "GROUPORDER", "GROUPBOTTOM", "GROUPPTS",
      "GROUPGOALS", "GSGOALS", "3RDPLACEQUAL", "GSUNDEFEATED", "GS3WINS"]),
    (FAM_TEAM_PERF,
     ["STAGEOFELIM", "WCROUND", "WCSTAGE", "REGIONKO", "FURTHESTADVANCING", "USAOPPONENT",
      "TEAMTOTALGOALS", "GOALSALLOWED", "TEAMH2H", "WCCONGO", "WCIRAN", "WCADVANCE",
      "HOSTKO", "HOSTSTAGE", "BESTHOST", "HOSTWIN", "WCHOST"]),
    (FAM_WINNER,
     ["FINALMATCHUP", "3RDPLACE", "CONTINENT", "1STTIMEWIN", "NOEURSA", "FINISHINGORDER"]),
    (FAM_PER_MATCH,
     ["WCGAME", "SPREAD", "WCTOTAL", "SCORE", "BTTS", "WC1H", "WC2H", "WCMOV", "WINMARGIN",
      "TTSF", "FTTS", "CONCEDE1ST", "WCMOF", "CORNERS", "SHOT", "SOG", "SAVE", "GOALCOUNT",
      "START", "MATCHUP", "WCPLAY", "TEAMSINGAME", "TEAMTOTAL", "TEAMGOALS", "TEAM1STGOAL",
      "TEAMFIRSTGOAL", "FIRSTGOAL"]),
    (FAM_NOVELTY,
     ["TOTALGOAL", "FASTESTGOAL", "GAMEGOALS", "GOALEVERYGAME", "EVERYTEAMGOAL", "KOPENALTIES",
      "LONGESTPEN", "GOALIEGOAL", "GOALIEPEN", "OLIMPICO", "FREEKICKGOAL", "RECORD",
      "WINNERTRAIL", "DELAY", "LOCATION", "FIRSTSONG", "PREPACK", "CLUBGOALS", "WCGOAL"]),
]

# fact-base's own family strings, normalized so any near-duplicate wording
# there (unlikely, but defensive) still collapses onto the FAM_* constants.
_FB_FAMILY_CANONICAL = {
    FAM_WINNER: FAM_WINNER,
    FAM_PER_MATCH: FAM_PER_MATCH,
    FAM_GROUP: FAM_GROUP,
    FAM_TEAM_PERF: FAM_TEAM_PERF,
    FAM_PLAYER: FAM_PLAYER,
    FAM_NOVELTY: FAM_NOVELTY,
}


def classify_family(ticker: str, fb_map: dict[str, str]) -> str:
    if ticker == "KXMENWORLDCUP":
        return FAM_WINNER
    if ticker in QUALIFYING_FAMILY_TICKERS:
        return FAM_QUALIFYING
    if ticker in NOVELTY_TEXTMATCH_TICKERS:
        return FAM_NOVELTY
    if ticker in fb_map:
        return _FB_FAMILY_CANONICAL.get(fb_map[ticker], fb_map[ticker])
    for family, needles in FALLBACK_FAMILY_RULES:
        if any(n in ticker for n in needles):
            return family
    return "Other KXWC* (uncategorized -- not named in fact-base, no fallback rule hit)"


# --------------------------------------------------------------------------
# Discovery
# --------------------------------------------------------------------------
def discover_series(client: KalshiClient) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Return (included_series, audit_info)."""
    all_series = client.get_series_list(category="Sports")
    logger.info("fetched %d total Sports-category series", len(all_series))

    def is_wc_prefix(t: str) -> bool:
        return t.startswith("KXWC") or t.startswith("KXMENWORLDCUP")

    prefix_candidates = [s for s in all_series if is_wc_prefix(s["ticker"])]

    prefix_included = []
    prefix_dropped = []
    for s in prefix_candidates:
        title_l = s["title"].lower()
        if s["ticker"] in PREFIX_FALSE_POSITIVES:
            prefix_dropped.append(s)
            continue
        if "world cup" not in title_l:
            prefix_dropped.append(s)
            continue
        if "esports" in title_l:
            prefix_dropped.append(s)
            continue
        prefix_included.append(s)

    prefix_included_tickers = {s["ticker"] for s in prefix_included}

    text_candidates = [
        s for s in all_series
        if s["ticker"] not in prefix_included_tickers
        and ("world cup" in s["title"].lower() or "fifa" in s["title"].lower())
    ]

    text_included = [s for s in text_candidates if s["ticker"] in TEXT_MATCH_INCLUSIONS]
    text_excluded = [s for s in text_candidates if s["ticker"] not in TEXT_MATCH_INCLUSIONS]

    unexplained_text_excluded = [
        s for s in text_excluded
        if s["ticker"] not in TEXT_MATCH_EXCLUSIONS and s["ticker"] not in PREFIX_FALSE_POSITIVES
    ]
    if unexplained_text_excluded:
        logger.warning(
            "%d text-matched series excluded WITHOUT a documented reason -- "
            "review MANUAL_* lists in catalog.py: %s",
            len(unexplained_text_excluded),
            [s["ticker"] for s in unexplained_text_excluded],
        )

    included = prefix_included + text_included
    logger.info(
        "series selection: %d prefix-matched, %d prefix false-positives dropped, "
        "%d text-matched included, %d text-matched excluded -> %d total included",
        len(prefix_included), len(prefix_dropped), len(text_included), len(text_excluded), len(included),
    )

    audit = {
        "total_sports_series": len(all_series),
        "prefix_candidates": len(prefix_candidates),
        "prefix_included": [s["ticker"] for s in prefix_included],
        "prefix_dropped_false_positives": [(s["ticker"], s["title"]) for s in prefix_dropped],
        "text_included": [(s["ticker"], s["title"]) for s in text_included],
        "text_excluded": [(s["ticker"], s["title"]) for s in text_excluded],
        "unexplained_text_excluded": [(s["ticker"], s["title"]) for s in unexplained_text_excluded],
    }
    return included, audit


def jsonify_complex(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)
    return value


def parse_dollars(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_market_record(m: dict[str, Any], series_ticker: str, event_title: str | None) -> dict[str, Any]:
    rec = {k: jsonify_complex(v) for k, v in m.items()}
    rec["series_ticker"] = series_ticker
    rec["event_title"] = event_title
    # Convenience numeric columns parsed from the *_fp / *_dollars string fields
    # (fact-base: legacy integer fields return null; everything is fixed-point
    # dollar strings now). Contract counts are fractional (partial-cent fills).
    rec["volume_contracts"] = parse_dollars(m.get("volume_fp"))
    rec["volume_24h_contracts"] = parse_dollars(m.get("volume_24h_fp"))
    rec["open_interest_contracts"] = parse_dollars(m.get("open_interest_fp"))
    rec["liquidity_usd"] = parse_dollars(m.get("liquidity_dollars"))
    rec["last_price_usd"] = parse_dollars(m.get("last_price_dollars"))
    rec["expiration"] = m.get("expiration_time")
    return rec


def run() -> dict[str, Any]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    client = KalshiClient()

    included_series, audit = discover_series(client)

    fb_map = load_fact_base_family_map()

    market_records: list[dict[str, Any]] = []
    series_rows: list[dict[str, Any]] = []

    for i, s in enumerate(included_series, 1):
        ticker = s["ticker"]
        matched_by = "prefix" if ticker in audit["prefix_included"] else "title_text"
        family = classify_family(ticker, fb_map)

        events = client.get_events(series_ticker=ticker, limit=200)
        event_title_by_ticker = {e["event_ticker"]: e.get("title") for e in events}

        markets = client.get_markets(series_ticker=ticker, limit=1000)
        for m in markets:
            ev_title = event_title_by_ticker.get(m.get("event_ticker"))
            market_records.append(build_market_record(m, ticker, ev_title))

        vols = [parse_dollars(m.get("volume_fp")) or 0.0 for m in markets]
        series_rows.append({
            "ticker": ticker,
            "title": s["title"],
            "category": s.get("category"),
            "tags": jsonify_complex(s.get("tags")),
            "fee_type": s.get("fee_type"),
            "frequency": s.get("frequency"),
            "matched_by": matched_by,
            "family": family,
            "n_events": len(events),
            "n_markets": len(markets),
            "total_volume_contracts": sum(vols),
            "zero_volume_market_count": sum(1 for v in vols if v == 0.0),
        })

        logger.info(
            "[%d/%d] %-28s family=%-55s events=%-4d markets=%-4d volume=%.0f",
            i, len(included_series), ticker, family, len(events), len(markets), sum(vols),
        )

    markets_df = pd.DataFrame(market_records)
    series_df = pd.DataFrame(series_rows)

    markets_path = OUT_DIR / "markets.parquet"
    series_path = OUT_DIR / "series.parquet"
    markets_df.to_parquet(markets_path, index=False)
    series_df.to_parquet(series_path, index=False)

    logger.info("wrote %d market rows -> %s", len(markets_df), markets_path)
    logger.info("wrote %d series rows -> %s", len(series_df), series_path)

    zero_vol = int((markets_df["volume_contracts"].fillna(0) == 0).sum()) if len(markets_df) else 0

    family_breakdown = (
        series_df.groupby("family")
        .agg(series=("ticker", "count"), markets=("n_markets", "sum"), volume=("total_volume_contracts", "sum"))
        .reset_index()
        .sort_values("volume", ascending=False)
    )

    summary = {
        "n_series": len(series_df),
        "n_markets": len(markets_df),
        "n_zero_volume_markets": zero_vol,
        "family_breakdown": family_breakdown.to_dict(orient="records"),
        "audit": audit,
        "markets_path": str(markets_path),
        "series_path": str(series_path),
    }
    return summary


if __name__ == "__main__":
    result = run()
    print(json.dumps({k: v for k, v in result.items() if k != "audit"}, indent=2, default=str))
