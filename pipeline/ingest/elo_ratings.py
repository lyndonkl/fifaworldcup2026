"""Arm C.3 — World Football Elo ratings (eloratings.net) for the semifinalist
context set: the 8 quarterfinalists + Germany, Brazil, Portugal, Netherlands,
USA, Mexico, Canada.

METHOD (documented per task instructions: "if direct fetch fails, find its
underlying data files"):

  eloratings.net's landing pages (e.g. /2026_World_Cup) are a near-empty JS
  shell — all content is client-rendered by scripts/ratings.js, which fetches
  plain TSV files over AJAX and computes/display Elo numbers in the browser.
  Reverse-engineered from ratings.js (see startRequest()/pushMatchRow()):

    - https://www.eloratings.net/en.teams.tsv
        Team-code lookup: 2-letter code -> full English name(s).
        e.g. "AR\tArgentina", "US\tUnited States  USA".
    - https://www.eloratings.net/{Full_Team_Name}.tsv  (spaces -> underscores;
      this is exactly what the site's pageName() JS function does to a team's
      full name to build the request URL)
        The team's COMPLETE match history, tab-separated, one row per match,
        oldest first. Columns (0-indexed, per ratings.js pushMatchRow()):
          0-2  year, month, day
          3    team1 code (fixed per match; not "home" in a broadcast sense,
               just the first-listed side in the source data)
          4    team2 code
          5    team1 score
          6    team2 score
          7    tournament code (WC=World Cup, F=Friendly, CA=Copa America,
               EC=Euro, LPT=Lipton Cup, ... see en.tournaments.tsv)
          8    host country code (blank if not recorded)
          9    rating CHANGE for team1 only, signed (verified empirically:
               team2's change is the exact negative of this value — checked
               by cross-referencing the same fixture as it appears in BOTH
               teams' own history files, e.g. the 2026-07-11 Argentina 3-1
               Switzerland QF: team1=AR, change=+21 in both AR's and CH's
               files; CH's post-match rating of 1928 = its prior rating of
               1949 (from its 2026-07-07 match) - 21, confirming zero-sum)
          10   team1 rating AFTER this match
          11   team2 rating AFTER this match
          12   team1 rank-position change (display glyph, not parsed here)
          13   team2 rank-position change
          14   team1 rank position after this match
          15   team2 rank position after this match

  This gives a genuine per-team rating TIME SERIES (one point per match, full
  history back to the team's first recorded international), which is what
  the task asks for — not just eloratings.net's live "current" snapshot.

Output: pipeline/data/benchmarks/opinion/elo.parquet — one row per
(team, match), chronological, with the team's rating immediately after that
match and a UTC-normalized timestamp.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "pipeline"))

from common.http import polite_get  # noqa: E402
from common.timeutil import iso_date_to_epoch, now_epoch  # noqa: E402

RAW_DIR = REPO_ROOT / "pipeline" / "data" / "raw" / "elo"
OUT_PATH = REPO_ROOT / "pipeline" / "data" / "benchmarks" / "opinion" / "elo.parquet"

BASE = "https://www.eloratings.net"

# Full English names as used by eloratings.net's own team-name -> URL slug
# function (pageName(): spaces -> underscores). Verified against en.teams.tsv.
TARGET_TEAMS = [
    # 8 quarterfinalists (2026 WC QF lineup: France, Morocco, Spain, Belgium,
    # England, Norway, Argentina, Switzerland)
    "France", "Morocco", "Spain", "Belgium", "England", "Norway",
    "Argentina", "Switzerland",
    # explicitly requested additional context teams
    "Germany", "Brazil", "Portugal", "Netherlands", "United States",
    "Mexico", "Canada",
]

def fetch_team_code_map() -> dict[str, str]:
    """en.teams.tsv: 2-letter code -> English display name(s)."""
    cache = RAW_DIR / "en.teams.tsv"
    resp = polite_get(f"{BASE}/en.teams.tsv", cache_path=cache)
    if resp is None:
        raise RuntimeError("could not fetch en.teams.tsv — eloratings.net unreachable")
    code_to_name: dict[str, str] = {}
    for line in resp.content.decode("utf-8").splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        code = parts[0]
        if code.endswith("_loc"):
            continue
        code_to_name[code] = parts[1]
    return code_to_name


def fetch_tournament_code_map() -> dict[str, str]:
    cache = RAW_DIR / "en.tournaments.tsv"
    resp = polite_get(f"{BASE}/en.tournaments.tsv", cache_path=cache)
    if resp is None:
        return {}
    out = {}
    for line in resp.content.decode("utf-8").splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        out[parts[0]] = parts[1]
    return out


def fetch_team_history(team_display_name: str) -> str | None:
    slug = team_display_name.replace(" ", "_")
    cache = RAW_DIR / f"{slug}.tsv"
    resp = polite_get(f"{BASE}/{slug}.tsv", cache_path=cache)
    if resp is None:
        return None
    return resp.content.decode("utf-8")


def parse_team_history(
    team_display_name: str,
    tsv_text: str,
    code_to_name: dict[str, str],
) -> list[dict]:
    rows = []
    target_code = None
    # Determine this team's own code by finding it in the code map (reverse lookup)
    for code, name in code_to_name.items():
        if name.split("\t")[0] == team_display_name or name == team_display_name:
            target_code = code
            break
    for line in tsv_text.splitlines():
        if not line.strip():
            continue
        f = line.split("\t")
        if len(f) < 16:
            continue
        year, month, day = f[0], f[1], f[2]
        team1_code, team2_code = f[3], f[4]
        score1, score2 = f[5], f[6]
        tournament_code = f[7]
        host_code = f[8] or None
        change_team1 = f[9]
        rating1, rating2 = f[10], f[11]
        rank1, rank2 = f[14], f[15]

        is_team1 = team1_code == target_code if target_code else None
        if is_team1 is None:
            # Fallback: infer from which code isn't the opponent-only side;
            # skip row if we truly can't tell (shouldn't happen in practice).
            continue
        if is_team1:
            opponent_code = team2_code
            team_score, opp_score = score1, score2
            rating_after = rating1
            rank_after = rank1
            try:
                change = float(change_team1)
            except ValueError:
                change = None
        else:
            if team1_code != target_code and team2_code != target_code:
                continue
            opponent_code = team1_code
            team_score, opp_score = score2, score1
            rating_after = rating2
            rank_after = rank2
            try:
                change = -float(change_team1)
            except ValueError:
                change = None

        try:
            ts, os_ = int(team_score), int(opp_score)
            result = "W" if ts > os_ else ("L" if ts < os_ else "D")
        except ValueError:
            result = None

        # A handful of very old matches (e.g. Morocco 1959) have month/day
        # recorded as "00" (unknown exact date, year only known). Preserve
        # the raw string for display but fall back to Jan-1 for the epoch so
        # the row still sorts/joins correctly, and flag the precision.
        month_i, day_i = int(month), int(day)
        if month_i == 0 or day_i == 0:
            date_precision = "year_only"
            epoch_month, epoch_day = 1, 1
        else:
            date_precision = "exact"
            epoch_month, epoch_day = month_i, day_i
        iso_date = f"{year}-{month}-{day}"
        epoch_date = f"{year}-{epoch_month:02d}-{epoch_day:02d}"
        rows.append(
            {
                "team": team_display_name,
                "team_code": target_code,
                "match_date": iso_date,
                "date_precision": date_precision,
                "match_epoch_utc": iso_date_to_epoch(epoch_date),
                "opponent_code": opponent_code,
                "opponent": code_to_name.get(opponent_code, "").split("\t")[0] or opponent_code,
                "is_team1": is_team1,
                "team_score": int(team_score) if team_score.lstrip("-").isdigit() else None,
                "opponent_score": int(opp_score) if opp_score.lstrip("-").isdigit() else None,
                "result": result,
                "tournament_code": tournament_code,
                "host_code": host_code,
                "rating_after": float(rating_after) if rating_after not in ("", None) else None,
                "rating_change": change,
                "rank_after": int(rank_after) if rank_after.lstrip("-").isdigit() else None,
            }
        )
    return rows


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("[elo] fetching team code map (en.teams.tsv) ...")
    code_to_name = fetch_team_code_map()
    tournament_map = fetch_tournament_code_map()
    print(f"[elo] {len(code_to_name)} team codes, {len(tournament_map)} tournament codes")

    all_rows: list[dict] = []
    method_note = (
        "eloratings.net has no public API; the landing page is a JS shell "
        "(scripts/ratings.js) that fetches plain per-team TSV files via AJAX "
        "at https://www.eloratings.net/{Full_Team_Name}.tsv (spaces -> "
        "underscores). Discovered by reading ratings.js's startRequest()/"
        "pushMatchRow() and en.teams.tsv's code lookup. Fetched directly, "
        "no headless browser / JS execution needed."
    )

    fetched_teams = []
    missing_teams = []
    for team in TARGET_TEAMS:
        print(f"[elo] fetching {team} ...")
        text = fetch_team_history(team)
        if text is None:
            print(f"[elo]   FAILED to fetch {team}")
            missing_teams.append(team)
            continue
        rows = parse_team_history(team, text, code_to_name)
        print(f"[elo]   {len(rows)} matches parsed")
        all_rows.extend(rows)
        fetched_teams.append(team)

    if not all_rows:
        raise RuntimeError("no Elo rows parsed at all — check site/parsing")

    df = pd.DataFrame(all_rows)
    fetched_at = now_epoch()
    df["source_url_pattern"] = "https://www.eloratings.net/{Team_Name}.tsv"
    df["method"] = method_note
    df["fetched_epoch_utc"] = fetched_at
    df = df.sort_values(["team", "match_epoch_utc"]).reset_index(drop=True)

    df.to_parquet(OUT_PATH, index=False)
    print(f"[elo] wrote {len(df)} rows ({df['team'].nunique()} teams) -> {OUT_PATH}")
    if missing_teams:
        print(f"[elo] GAP: could not fetch {missing_teams}")
    print(f"[elo] tournament code legend sample: {dict(list(tournament_map.items())[:5])}")


if __name__ == "__main__":
    main()
