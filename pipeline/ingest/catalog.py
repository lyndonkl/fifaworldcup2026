"""Catalog discovery: enumerate every 2026 FIFA World Cup market on Kalshi.

v2 -- remediates two filter bugs an adversarial audit found in v1
(research/catalog-gaps.json, 2026-07-13): (1) the crawl only ever queried
GET /series?category=Sports, so ~28 WC-related series living in Financials,
Entertainment, Politics and Mentions were structurally unreachable; (2) the
secondary title-text strategy was AND-ed with the primary prefix strategy's
*rejections* in a way that made the two independent OR-branches behave like
a single narrower filter, so text-matched series outside the KXWC*/
KXMENWORLDCUP* prefix families never got a real chance either. See the
docstrings on `discover_series` and `run` below for the exact fix.

Strategy v2:
  1. Page through GET /series with NO category filter. Empirically this
     returns the entire live catalog (11,384 unique series across 18
     categories as of 2026-07-13) in one page -- a strict superset of the
     12-category loop the auditor used to find 9,370 unique series, and
     removes any dependency on a hardcoded category list going stale.
  2. A series is a *candidate* if ANY of:
       (a) ticker prefix in {KXWC, KXMENWORLDCUP}
       (b) title contains 'world cup' or 'fifa' (case-insensitive)
       (c) ticker is in the explicit include list sourced from
           research/catalog-gaps.json (the auditor's `missing` +
           `extra_discoveries` arrays) -- catches series like
           KXRONALDOTRUMPHANDSHAKE / KXMESSIWCDEAL whose titles don't
           literally contain 'world cup' or 'fifa' but were confirmed
           WC-2026-related by hand.
  3. A candidate is DROPPED if it matches the curated exclusion list
     (esports World Cup, Club World Cup, cricket T20 World Cup, West Coast
     Conference, women's internationals, a dead duplicate ticker, and two
     inflation series that happen to share the KXWC prefix). Exclusion is
     applied AFTER the union in step 2, so over-inclusive sourcing in (c)
     is safe -- it cannot smuggle an esports/cricket/club series past the
     denylist.
  4. Two series stay in the catalog for audit-trail completeness but are
     flagged `in_narrative_scope=False`: KXWCHOST (2038 host selection --
     WC-branded, not the 2026 tournament) and the four qualifying/playoff
     shells KXFIFAADVANCE/KXFIFAGAME/KXFIFATOTAL/KXFIFASPREAD (determine
     who reaches the WC, are not the WC itself; carried over unchanged
     from v1, all still 0 markets).
  5. For every newly included series: enumerate events (GET /events?
     series_ticker=) and markets (GET /markets?series_ticker=...,
     limit=1000, cursor-paginated), capture the full market record. Series
     already present from the v1 pull are NOT re-fetched -- v2 is an
     additive merge, nothing already in the parquet store is deleted or
     overwritten.

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
GAPS_PATH = REPO_ROOT / "research" / "catalog-gaps.json"
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "catalog"

# --------------------------------------------------------------------------
# Curated corrections layered on top of the three match strategies.
#
# All of these were verified by hand against the live API (empty-string curl
# probes against /series, /events?series_ticker=...) both during the v1 pull
# (2026-07-13) and again during the v2 remediation (2026-07-13, same day --
# an adversarial audit caught the two filter bugs a few hours after v1
# shipped). See research/catalog-gaps.json for the audit's full reasoning.
# --------------------------------------------------------------------------

# Exact-ticker exclusions. Reason string is the audit trail.
EXCLUDE_TICKERS: dict[str, str] = {
    "KXWCCODWARZONE": "Call of Duty: Warzone at the 2025 ESPORTS World Cup, not FIFA.",
    "KXWCCREG": "'West Coast Conference Regular Season Champions' -- WC = West Coast, not World Cup; title doesn't even mention 'World Cup'.",
    "KXMWORLDCUP": "Zero events on the live API -- unused/duplicate ticker; KXMENWORLDCUP is the live winner series.",
    "KXFIFAWGAME": "'FIFA Women's Game' -- events are women's internationals (Netherlands vs Poland, Iceland vs Spain, etc.), unrelated to the men's 2026 World Cup.",
    "KXAUSTINMAJOR": "'Rennsport at 2025 Esports World Cup' -- sim-racing, not FIFA; matched only on 'World Cup' text, no KXEWC/KXCLUBWC prefix to catch it structurally.",
    "KXTORONTOULTRACHAMPIONSHIP": "Tagged as 'Dota 2 at 2025 Esports World Cup' despite the ticker name -- not FIFA; same structural gap as KXAUSTINMAJOR.",
    # Cross-category false positives only visible once the crawl stopped
    # being Sports-only (bug fix #1) -- both share the KXWC prefix with the
    # real World Cup series but are Economics-category inflation gauges.
    "KXWCPI-RU": "'Russian inflation' -- KXWC here stands for a price-index ticker root, not World Cup. Not in the task brief's named exclusion list, but the same false-positive-KXWC-prefix category the auditor flagged for 'filter hygiene'; added defensively so the all-categories crawl doesn't pull in FX/inflation markets.",
    "KXWCPI-TR": "'Turkey inflation' -- same KXWCPI false-positive family as KXWCPI-RU.",
}

# Prefix exclusions (ticker.startswith(...)). Catches whole families without
# hand-enumerating every member (robust to Kalshi adding new sub-events).
EXCLUDE_PREFIXES: dict[str, str] = {
    "KXEWC": "2025 Esports World Cup sub-event family (Apex Legends, CS2, Dota 2, Valorant, chess, etc.) -- matched only on 'World Cup' text, not FIFA.",
    "KXCLUBWC": "FIFA Club World Cup 2025/2029 (KXCLUBWC, KXCLUBWCHOST) -- a different FIFA tournament (club, not national teams).",
}

# Suffix exclusions (ticker.endswith(...)).
EXCLUDE_SUFFIXES: dict[str, str] = {
    "T20WORLDCUP": "Cricket T20 World Cup, men's and women's (KXT20WORLDCUP, KXWT20WORLDCUP) -- different sport entirely, matched only on 'World Cup' text.",
}

# Included, but flagged out of the narrative's 2026-tournament scope. These
# stay in the parquet store (audit trail) with in_narrative_scope=False.
OUT_OF_SCOPE_NOTES: dict[str, str] = {
    "KXWCHOST": "2038 FIFA World Cup host-selection series -- WC-branded but not the 2026 tournament (catalog-gaps.json flagged this as a borderline miss).",
    "KXFIFAADVANCE": "2026 WC qualifying/playoff match advancement (pre-tournament fixtures, e.g. Nov 2025-Mar 2026 windows) -- determines who reaches the WC, is not the WC itself. 0 markets as of 2026-07-13 (qualifying already resolved by tournament start).",
    "KXFIFAGAME": "Generic FIFA international 3-way series covering the WC qualifying/playoff window -- not the tournament proper. 0 markets as of 2026-07-13.",
    "KXFIFATOTAL": "Goal totals for the same WC-qualifying/playoff match set as KXFIFAGAME -- not the tournament proper. 0 markets as of 2026-07-13.",
    "KXFIFASPREAD": "Handicap spreads for the same WC-qualifying/playoff match set as KXFIFAGAME -- not the tournament proper. 0 markets as of 2026-07-13.",
}

# Text-matched inclusions from v1 that are NOT KXWC*/KXMENWORLDCUP*-prefixed
# but ARE genuinely part of the 2026 FIFA World Cup universe (pre-tournament
# participation props). Kept as documentation; under v2's OR-filter these
# match strategy (b) on their own ('fifa'/'world cup' in title), so this
# dict is no longer load-bearing for inclusion -- it now only feeds the
# family classifier.
NOVELTY_TEXTMATCH_TICKERS = {
    "KXFIFAUSPULL", "KXFIFAUSPULLGAME", "KXSOCCERPLAYCRON", "KXSOCCERPLAYMESSI", "KXPLAYWC",
}
QUALIFYING_FAMILY_TICKERS = {"KXFIFAADVANCE", "KXFIFAGAME", "KXFIFATOTAL", "KXFIFASPREAD"}


def load_explicit_include_tickers() -> set[str]:
    """Explicit include list per the remediation brief: every KX-prefixed
    ticker token mentioned in catalog-gaps.json's `missing` and
    `extra_discoveries` arrays (the adversarial auditor's 23-entry gap list
    plus its bonus finds), regex-extracted for direct traceability back to
    the audit rather than re-transcribed by hand.

    This is deliberately over-inclusive -- e.g. the auditor's own
    'false-positive KXWC prefixes to exclude' sentence contains tokens like
    KXWCCODWARZONE and KXCLUBWC that get swept into this set too. That's
    safe: `discover_series` applies EXCLUDE_TICKERS/PREFIXES/SUFFIXES to
    the union of all three match strategies, so anything caught by the
    denylist is dropped regardless of which strategy flagged it.
    """
    with open(GAPS_PATH) as f:
        gaps = json.load(f)
    text = " ".join(gaps.get("missing", [])) + " " + " ".join(gaps.get("extra_discoveries", []))
    return set(re.findall(r"KX[A-Z][A-Z0-9]*", text))


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
# New in v2: cross-category series (Financials/Entertainment/Politics/
# Mentions) that bug fix #1 unlocked -- ads, ticket prices, opening-ceremony
# setlists, attendance, Trump/Messi/Ronaldo novelty props, mentions.
FAM_OFFPITCH = "Off-pitch novelty (ads, ticket prices, entertainment, politics, mentions)"

# Fallback keyword rules (substring match on ticker) for KXWC*/explicit-
# include series not explicitly named in fact-base.json's free text. Order
# matters: first hit wins. Kept intentionally coarse -- this is
# informational grouping for the catalog summary, not an analytical
# dependency.
FALLBACK_FAMILY_RULES: list[tuple[str, list[str]]] = [
    (FAM_PLAYER,
     ["GOALLEADER", "TEAMLEADGOAL", "PLAYERGOALS", "WCAST", "WCSOA", "HATTRICK", "AWARD",
      "GBOOTGOALS", "GOLDENBOOTCLEAT", "GOALCOMBO", "GOALSTREAK", "FIFATOP10", "SQUAD",
      "MESSIMBAPPE", "MESSIRONALDO", "MBAPPEGOALLEADER"]),
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
    (FAM_OFFPITCH,
     ["WCADS", "WCPRICE", "FINALSONGS", "WCATTEND", "OCUSA", "OCMEX", "OCCAN", "VIEWERSHIP",
      "WCUPSONG", "WCSONG", "WCMENTION", "TRUMPWORLDCUP", "FIFATRAVEL", "FIFAPEACE",
      "TRUMPHANDSHAKE", "WCDEAL", "PERSONATTENDTRUMP"]),
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
def is_excluded(ticker: str) -> str | None:
    """Return the exclusion reason if ticker matches the curated denylist,
    else None."""
    if ticker in EXCLUDE_TICKERS:
        return EXCLUDE_TICKERS[ticker]
    for prefix, reason in EXCLUDE_PREFIXES.items():
        if ticker.startswith(prefix):
            return reason
    for suffix, reason in EXCLUDE_SUFFIXES.items():
        if ticker.endswith(suffix):
            return reason
    return None


def discover_series(client: KalshiClient) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Return (included_series, audit_info).

    Fix #1 (crawl all categories): GET /series with no `category` param
    returns the entire live catalog in one page -- verified empirically
    (11,384 unique series, no cursor in the response) -- so this supersedes
    both v1's Sports-only call and the auditor's own 12-category loop
    (which undercounted at 9,370 because it queried a hardcoded list of 12
    categories and missed Elections/Mentions/Exotics/Education entirely).

    Fix #2 (OR, not AND, filter): a series is a candidate if its ticker
    prefix matches KXWC*/KXMENWORLDCUP*, OR its title contains 'world cup'/
    'fifa', OR it's in the explicit include list sourced from
    catalog-gaps.json -- three independent OR-branches, not one strategy
    gated behind another's rejection. The curated denylist (EXCLUDE_*) is
    applied to the union afterward.
    """
    all_series = client.get_series_list(category=None)
    logger.info("fetched %d total series across all categories", len(all_series))

    def is_wc_prefix(t: str) -> bool:
        return t.startswith("KXWC") or t.startswith("KXMENWORLDCUP")

    def is_text_match(title: str) -> bool:
        title_l = title.lower()
        return "world cup" in title_l or "fifa" in title_l

    explicit_tickers = load_explicit_include_tickers()

    prefix_matched = [s for s in all_series if is_wc_prefix(s["ticker"])]
    prefix_matched_tickers = {s["ticker"] for s in prefix_matched}

    text_matched = [
        s for s in all_series
        if s["ticker"] not in prefix_matched_tickers and is_text_match(s["title"])
    ]
    text_matched_tickers = {s["ticker"] for s in text_matched}

    explicit_matched = [
        s for s in all_series
        if s["ticker"] in explicit_tickers
        and s["ticker"] not in prefix_matched_tickers
        and s["ticker"] not in text_matched_tickers
    ]

    def matched_by_for(ticker: str) -> str:
        if ticker in prefix_matched_tickers:
            return "prefix"
        if ticker in text_matched_tickers:
            return "title_text"
        return "explicit_include"

    candidates = prefix_matched + text_matched + explicit_matched

    included: list[dict[str, Any]] = []
    excluded: list[tuple[str, str, str]] = []  # (ticker, title, reason)
    for s in candidates:
        reason = is_excluded(s["ticker"])
        if reason:
            excluded.append((s["ticker"], s["title"], reason))
        else:
            included.append(s)

    included_tickers = {s["ticker"] for s in included}
    explicit_used = sorted(explicit_tickers & included_tickers)
    explicit_missing_from_live = sorted(explicit_tickers - {s["ticker"] for s in all_series})

    logger.info(
        "series selection (v2, all categories): %d total series scanned, %d prefix-matched, "
        "%d text-matched (additional), %d explicit-include-only (additional), "
        "%d excluded by denylist -> %d included",
        len(all_series), len(prefix_matched), len(text_matched), len(explicit_matched),
        len(excluded), len(included),
    )

    category_counts = pd.Series([s.get("category") for s in included]).value_counts().to_dict()
    logger.info("included series by category: %s", category_counts)

    audit = {
        "total_series_all_categories": len(all_series),
        "prefix_matched": sorted(prefix_matched_tickers),
        "text_matched_additional": sorted(text_matched_tickers),
        "explicit_include_tickers_loaded": sorted(explicit_tickers),
        "explicit_include_tickers_used": explicit_used,
        "explicit_include_tickers_not_found_live": explicit_missing_from_live,
        "excluded": [{"ticker": t, "title": ti, "reason": r} for t, ti, r in excluded],
        "included_by_category": category_counts,
        "matched_by": {s["ticker"]: matched_by_for(s["ticker"]) for s in included},
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


def scope_flags(ticker: str) -> tuple[bool, str]:
    if ticker in OUT_OF_SCOPE_NOTES:
        return False, OUT_OF_SCOPE_NOTES[ticker]
    return True, ""


def run() -> dict[str, Any]:
    """Additive merge: v1's markets.parquet/series.parquet (if present) are
    loaded, retrofitted with the new in_narrative_scope/scope_note columns,
    and kept in full. Only series not already present are freshly
    enumerated (events + markets) against the live API. Nothing already in
    the store is deleted or overwritten -- this is the audit trail the
    brief asked to keep.
    """
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    client = KalshiClient()

    markets_path = OUT_DIR / "markets.parquet"
    series_path = OUT_DIR / "series.parquet"

    prior_markets_df = pd.read_parquet(markets_path) if markets_path.exists() else pd.DataFrame()
    prior_series_df = pd.read_parquet(series_path) if series_path.exists() else pd.DataFrame()
    prior_tickers: set[str] = set(prior_series_df["ticker"]) if len(prior_series_df) else set()
    n_market_rows_before = len(prior_markets_df)
    n_series_rows_before = len(prior_series_df)

    included_series, audit = discover_series(client)
    fb_map = load_fact_base_family_map()

    new_series = [s for s in included_series if s["ticker"] not in prior_tickers]
    logger.info(
        "%d series already in the store, %d newly included series to enumerate",
        len(prior_tickers), len(new_series),
    )

    new_market_records: list[dict[str, Any]] = []
    new_series_rows: list[dict[str, Any]] = []

    for i, s in enumerate(new_series, 1):
        ticker = s["ticker"]
        matched_by = audit["matched_by"].get(ticker, "unknown")
        family = classify_family(ticker, fb_map)
        in_scope, note = scope_flags(ticker)

        events = client.get_events(series_ticker=ticker, limit=200)
        event_title_by_ticker = {e["event_ticker"]: e.get("title") for e in events}

        markets = client.get_markets(series_ticker=ticker, limit=1000)
        for m in markets:
            ev_title = event_title_by_ticker.get(m.get("event_ticker"))
            rec = build_market_record(m, ticker, ev_title)
            rec["in_narrative_scope"] = in_scope
            rec["scope_note"] = note
            new_market_records.append(rec)

        vols = [parse_dollars(m.get("volume_fp")) or 0.0 for m in markets]
        new_series_rows.append({
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
            "in_narrative_scope": in_scope,
            "scope_note": note,
        })

        logger.info(
            "[%d/%d] %-28s family=%-55s events=%-4d markets=%-4d volume=%.0f in_scope=%s",
            i, len(new_series), ticker, family, len(events), len(markets), sum(vols), in_scope,
        )

    new_markets_df = pd.DataFrame(new_market_records)
    new_series_df = pd.DataFrame(new_series_rows)

    # Retrofit the two new columns onto every pre-existing row (default:
    # in scope) before applying the out-of-scope overrides that also apply
    # to carried-over v1 series (KXFIFAADVANCE/GAME/TOTAL/SPREAD).
    if len(prior_series_df):
        prior_series_df = prior_series_df.copy()
        flags = prior_series_df["ticker"].apply(scope_flags)
        prior_series_df["in_narrative_scope"] = flags.apply(lambda t: t[0])
        prior_series_df["scope_note"] = flags.apply(lambda t: t[1])
    if len(prior_markets_df):
        prior_markets_df = prior_markets_df.copy()
        scope_by_ticker = {t: scope_flags(t) for t in prior_markets_df["series_ticker"].unique()}
        prior_markets_df["in_narrative_scope"] = prior_markets_df["series_ticker"].map(
            lambda t: scope_by_ticker[t][0]
        )
        prior_markets_df["scope_note"] = prior_markets_df["series_ticker"].map(
            lambda t: scope_by_ticker[t][1]
        )

    series_df = pd.concat([prior_series_df, new_series_df], ignore_index=True) if len(new_series_df) else prior_series_df
    markets_df = pd.concat([prior_markets_df, new_markets_df], ignore_index=True) if len(new_markets_df) else prior_markets_df

    series_df.to_parquet(series_path, index=False)
    markets_df.to_parquet(markets_path, index=False)

    logger.info("wrote %d market rows (+%d new) -> %s", len(markets_df), len(new_markets_df), markets_path)
    logger.info("wrote %d series rows (+%d new) -> %s", len(series_df), len(new_series_df), series_path)

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
        "n_series_before": n_series_rows_before,
        "n_markets_before": n_market_rows_before,
        "n_new_series": len(new_series_df),
        "n_new_markets": len(new_markets_df),
        "n_zero_volume_markets": zero_vol,
        "n_out_of_scope_series": int((~series_df["in_narrative_scope"]).sum()) if len(series_df) else 0,
        "family_breakdown": family_breakdown.to_dict(orient="records"),
        "audit": audit,
        "markets_path": str(markets_path),
        "series_path": str(series_path),
    }
    return summary


if __name__ == "__main__":
    result = run()
    print(json.dumps({k: v for k, v in result.items() if k != "audit"}, indent=2, default=str))
