"""Fallback outright-winner futures history: Covers.com SportsOddsHistory.

Context (see research/fact-base.json -> benchmarks.odds_sources / Arm B task):
Arm B's primary target is Pinnacle bookmaker price history via OddsPapi
(oddspapi.io). OddsPapi's free tier (250 req/month, no card, historical-odds
calls are free/unmetered) is real and reachable, but every route to it
requires *creating an account* (email+password sign-up at
oddspapi.io/us/sign-up) to mint an API key. Account creation is on this
project's prohibited-action list regardless of cost or convenience, so this
script does NOT touch OddsPapi. See ingest/oddspapi_BLOCKED.md for the full
investigation writeup and the human unblock steps.

This script instead pulls the free, no-auth fallback named explicitly in the
Arm B brief: Covers.com's "Sports Odds History" archive page for the 2026
FIFA World Cup outright-winner market
(https://www.covers.com/sportsoddshistory/soccer-uefa/?y=2026&sa=soccer&a=wc&b=two).

What this source actually is (verified 2026-07-13 by fetching+parsing the
live page -- see the docstring at the bottom for the honest limitations):
    - ONE bookmaker: BetMGM ("Lines courtesy of BetMGM" credit on the page).
    - NOT a time series. It is a fixed set of ~11 named checkpoint columns:
      three pre-tournament dates (Dec 21 2022, Jul 1 2024, Dec 6 2025), the
      Jun 11 2026 group-stage kickoff, "Game 2" / "Game 3" (group matchday
      checkpoints, no calendar date given), then one checkpoint "prior to"
      each knockout round (Round of 32, Round of 16, Quarters, Semis,
      Finals), plus an always-blank "Result" column (would show the winner
      once the tournament settles).
    - 83 team rows (every team ever priced for WC26, including teams that
      never qualified). A team's row goes blank from the round it was
      eliminated in onward -- confirmed empirically (Germany's last
      non-blank cell is "Round of 32", matching its actual R32 penalty-
      shootout exit to Paraguay per fact-base.json).
    - American odds only. No timestamps within a column: we only know each
      column was captured "prior to" some round, not the exact minute.

Given that, this is a coarse, single-book, stage-boundary snapshot series --
useful for a "how did the market's favorite drift stage to stage" beat, NOT
a substitute for Pinnacle's genuine tick-level price history. Treat it as a
clearly-labeled fallback dataset, not a Pinnacle replacement.

Output: pipeline/data/benchmarks/odds/covers_wc26_futures_fallback.parquet
Columns (long format, one row per team x checkpoint column):
    team, stage_label, stage_order, calendar_date (ISO date or null),
    date_precision ('exact' | 'stage_upper_bound' | 'unknown'),
    epoch_utc_seconds (int or null; see date_precision for what it means),
    american_odds (int or null), decimal_odds (float or null),
    implied_prob_raw (float or null), overround (float, per stage_label),
    implied_prob_devigged (float or null), bookmaker, source_url,
    pulled_at_utc_epoch_seconds.

Usage:
    .venv/bin/python pipeline/ingest/covers_wc26_futures.py
"""

from __future__ import annotations

import datetime as dt
import logging
import time
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("covers_wc26_futures")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SOURCE_URL = "https://www.covers.com/sportsoddshistory/soccer-uefa/?y=2026&sa=soccer&a=wc&b=two"
USER_AGENT = (
    "fifaworldcup2026-research-pipeline/0.1 "
    "(data-journalism, single free page fetch, contact kushal.lyndon.dsouza@gmail.com)"
)
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "benchmarks" / "odds" / "covers_wc26_futures_fallback.parquet"

# Column order in the table, mapped to the best-available UTC anchor date.
# 'exact': the site prints this literal calendar date.
# 'stage_upper_bound': no date is printed; we anchor to the verified
#   real-world start date of that knockout round (research/fact-base.json
#   -> tournament.completed_summary / remaining_schedule), which is a valid
#   upper bound on when the snapshot was taken ("prior to" that round) but
#   not the exact capture instant.
# 'unknown': no reliable anchor at all (group-stage matchday 2/3 dates vary
#   by team/group and are not given on the page) -- left null, not guessed.
STAGE_COLUMNS: list[tuple[str, str, str | None]] = [
    ("Dec 21, 2022", "exact", "2022-12-21"),
    ("Jul 1, 2024", "exact", "2024-07-01"),
    ("Dec 6, 2025", "exact", "2025-12-06"),
    ("Jun 11, 2026", "exact", "2026-06-11"),  # verified group-stage kickoff, fact-base.json
    ("Game 2", "unknown", None),
    ("Game 3", "unknown", None),
    ("Round of 32", "stage_upper_bound", "2026-06-28"),  # fact-base: R32 June 28-July 3
    ("Round of 16", "stage_upper_bound", "2026-07-04"),  # fact-base: R16 July 4-7
    ("Quarters", "stage_upper_bound", "2026-07-09"),  # fact-base: QF July 9-11
    ("Semis", "stage_upper_bound", "2026-07-14"),  # fact-base: SF1 July 14 (earlier of the two)
    ("Finals", "stage_upper_bound", "2026-07-19"),  # fact-base: Final July 19
    ("Result", "unknown", None),  # settlement column; blank for every team pre-final
]


def _to_epoch_utc(date_str: str | None) -> int | None:
    if date_str is None or pd.isna(date_str):
        return None
    d = dt.date.fromisoformat(date_str)
    return int(dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc).timestamp())


def american_to_decimal(american: int) -> float:
    if american > 0:
        return 1.0 + american / 100.0
    return 1.0 + 100.0 / abs(american)


def fetch_page(url: str = SOURCE_URL, timeout: float = 30.0) -> str:
    logger.info("GET %s", url)
    resp = requests.get(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"}, timeout=timeout)
    resp.raise_for_status()
    return resp.text


def parse_table(html: str) -> list[dict]:
    """Parse the soh1 table into a flat list of {team, stage_label, american_odds} rows."""
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table", class_="soh1")
    if table is None:
        raise RuntimeError("covers.com page layout changed: no table.soh1 found")

    body_rows = table.find("tbody").find_all("tr")
    stage_labels = [label for label, _, _ in STAGE_COLUMNS]

    records: list[dict] = []
    for row in body_rows:
        cells = row.find_all("td")
        if not cells:
            continue
        team = cells[0].get_text(strip=True)
        value_cells = cells[1:]
        if len(value_cells) != len(stage_labels):
            raise RuntimeError(
                f"row for {team!r} has {len(value_cells)} value cells, expected {len(stage_labels)} "
                "-- covers.com table layout likely changed, re-inspect before trusting output"
            )
        for stage_label, cell in zip(stage_labels, value_cells):
            text = cell.get_text(strip=True)
            american = None
            if text and text not in {"", "\xa0", "&nbsp;"}:
                try:
                    american = int(text.replace(",", ""))
                except ValueError:
                    logger.warning("unparseable odds cell for %s / %s: %r", team, stage_label, text)
            records.append({"team": team, "stage_label": stage_label, "american_odds": american})
    return records


def build_dataframe(records: list[dict], pulled_at: int) -> pd.DataFrame:
    df = pd.DataFrame.from_records(records)

    stage_meta = {label: (order, prec, date_str) for order, (label, prec, date_str) in enumerate(STAGE_COLUMNS)}
    df["stage_order"] = df["stage_label"].map(lambda s: stage_meta[s][0])
    df["date_precision"] = df["stage_label"].map(lambda s: stage_meta[s][1])
    df["calendar_date"] = df["stage_label"].map(lambda s: stage_meta[s][2])
    df["epoch_utc_seconds"] = df["calendar_date"].map(_to_epoch_utc)

    df["decimal_odds"] = df["american_odds"].map(lambda a: american_to_decimal(a) if pd.notna(a) else None)
    df["implied_prob_raw"] = df["decimal_odds"].map(lambda d: 1.0 / d if d else None)

    # De-vig per stage_label: proportional method across all teams priced at that checkpoint.
    overround = df.groupby("stage_label")["implied_prob_raw"].sum().rename("overround")
    df = df.merge(overround, on="stage_label", how="left")
    df["implied_prob_devigged"] = df.apply(
        lambda r: (r["implied_prob_raw"] / r["overround"]) if pd.notna(r["implied_prob_raw"]) and r["overround"] else None,
        axis=1,
    )

    df["bookmaker"] = "BetMGM"
    df["source_url"] = SOURCE_URL
    df["pulled_at_utc_epoch_seconds"] = pulled_at

    df = df.sort_values(["stage_order", "team"]).reset_index(drop=True)
    cols = [
        "team",
        "stage_label",
        "stage_order",
        "calendar_date",
        "date_precision",
        "epoch_utc_seconds",
        "american_odds",
        "decimal_odds",
        "implied_prob_raw",
        "overround",
        "implied_prob_devigged",
        "bookmaker",
        "source_url",
        "pulled_at_utc_epoch_seconds",
    ]
    return df[cols]


def main() -> None:
    pulled_at = int(time.time())
    html = fetch_page()
    records = parse_table(html)
    df = build_dataframe(records, pulled_at)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)

    n_teams = df["team"].nunique()
    n_priced_cells = df["american_odds"].notna().sum()
    logger.info(
        "wrote %d rows (%d teams x %d stage checkpoints, %d priced cells) -> %s",
        len(df),
        n_teams,
        len(STAGE_COLUMNS),
        n_priced_cells,
        OUTPUT_PATH,
    )
    logger.info("overround by stage:\n%s", df.drop_duplicates("stage_label").set_index("stage_label")["overround"].round(4))

    # Sanity spot-check on a live favorite so a bad parse fails loudly.
    france_semis = df[(df["team"] == "France") & (df["stage_label"] == "Semis")]
    if france_semis.empty or france_semis["american_odds"].isna().all():
        raise RuntimeError("sanity check failed: expected a priced France row at 'Semis' checkpoint")
    logger.info(
        "sanity check France @ Semis: american=%s decimal=%.3f implied_devigged=%.4f",
        int(france_semis["american_odds"].iloc[0]),
        float(france_semis["decimal_odds"].iloc[0]),
        float(france_semis["implied_prob_devigged"].iloc[0]),
    )


if __name__ == "__main__":
    main()
