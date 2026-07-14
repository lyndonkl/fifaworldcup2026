"""Arm C.2 — Opta 'supercomputer' win-probability snapshots from
theanalyst.com's stage-by-stage World Cup 2026 prediction article series.

METHOD: theanalyst.com has no public API and no structured data table/embed
for these numbers (checked: no <table>, no Flourish embed with a data
endpoint — the only iframe on these pages is a live match-ticker widget, and
the site's dedicated bracket page (2026-world-cup-bracket-opta-supercomputer)
embeds a JS-rendered probability bracket at dataviz.theanalyst.com with no
visible JSON endpoint in the static HTML, so it was left as a documented gap
rather than requiring a headless browser). The stage articles themselves are
plain WordPress posts; every win-probability number the Opta supercomputer
has published is stated as a number in the prose (e.g. "Spain ... winning
the tournament in 16.1% of the 25,000 pre-tournament simulations"). The
article set was located via theanalyst.com/post-sitemap9.xml (filtered for
"opta-supercomputer" + "world-cup"/"fifa" in the URL slug), then each
article's <meta property="article:published_time"> gives an exact publish
timestamp and each article states "All prediction numbers correct as of
<date>" giving the as-of date for that stage's simulation batch.

Because the numbers live in prose, not a table, they were hand-extracted by
reading each article's rendered text (cached under pipeline/data/raw/opta/)
and cross-checked against every percentage figure that appears attached to a
team name. Only numbers EXPLICITLY stated in the article text are recorded —
no interpolation/estimation for teams only described qualitatively (e.g. an
article that says a team's chances are "close to Switzerland's" without
giving Switzerland's own number is not recorded for that team at that stage).

Five stages were found, spanning pre-tournament through pre-semifinal
(the most recent article at ingest time, published 2026-07-12 — this is the
"post-QF/pre-SF update" the task asked to look for if it existed):

  1. pre_tournament        publishe. 2026-06-01, as-of 2026-06-01 (pre-group-stage)
  2. post_group_pre_r32    publ.    2026-06-28, as-of 2026-06-28 (R32 about to start)
  3. post_r32_pre_r16      publ.    2026-07-04, as-of 2026-07-04 (R16/"Last 16" about to start)
  4. post_r16_pre_qf       publ.    2026-07-08, as-of ~2026-07-08 (QFs about to start)
  5. post_qf_pre_sf        publ.    2026-07-12, as-of ~2026-07-12 (SFs about to start)

Metrics captured per team per stage (whichever the article explicitly gives):
  win_pct          - chance of winning the tournament outright
  reach_final_pct  - chance of reaching the final
  reach_semis_pct  - chance of reaching the semifinals
  reach_qf_pct     - chance of reaching the quarterfinals
  top_group_pct    - chance of topping their group (stage 1 only, spot uses)

Output: pipeline/data/benchmarks/opinion/opta.parquet, long/tidy format
(stage, team, metric, value) — one row per (stage, team, metric).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "pipeline"))

from common.http import polite_get  # noqa: E402
from common.timeutil import iso_datetime_to_epoch, now_epoch  # noqa: E402

RAW_DIR = REPO_ROOT / "pipeline" / "data" / "raw" / "opta"
OUT_PATH = REPO_ROOT / "pipeline" / "data" / "benchmarks" / "opinion" / "opta.parquet"

BASE = "https://theanalyst.com/articles"

# (stage_id, stage_label, slug, as_of_date) — as_of_date is the date each
# article itself cites as its simulation cutoff ("All prediction numbers
# correct as of ...", or equivalent phrasing in the article).
ARTICLES = [
    (1, "pre_tournament",
     "who-will-win-2026-fifa-world-cup-predictions-opta-supercomputer",
     "2026-06-01"),
    (2, "post_group_pre_r32",
     "world-cup-2026-knockout-stage-predictions-opta-supercomputer",
     "2026-06-28"),
    (3, "post_r32_pre_r16",
     "world-cup-predictions-2026-quarter-finals-opta-supercomputer",
     "2026-07-04"),
    (4, "post_r16_pre_qf",
     "world-cup-2026-quarter-final-predictions-opta-supercomputer",
     "2026-07-08"),
    (5, "post_qf_pre_sf",
     "world-cup-2026-semi-final-predictions-opta-supercomputer",
     "2026-07-12"),
]

SIMS = 25000

# Hand-extracted from each article's rendered text. Every value here is a
# number that appears verbatim in the article prose (see docstring above).
# metric keys: win_pct, reach_final_pct, reach_semis_pct, reach_qf_pct,
# top_group_pct
STAGE_DATA: dict[str, dict[str, dict[str, float]]] = {
    "pre_tournament": {
        "Spain": {"win_pct": 16.1, "reach_qf_pct": 52.1, "reach_semis_pct": 39.0,
                   "reach_final_pct": 25.6, "top_group_pct": 75.3},
        "France": {"win_pct": 13.0, "reach_qf_pct": 47.9, "top_group_pct": 60.3},
        "England": {"win_pct": 11.2, "reach_qf_pct": 47.7, "top_group_pct": 67.9},
        "Argentina": {"win_pct": 10.4, "reach_final_pct": 18.1, "top_group_pct": 73.0},
        "Portugal": {"win_pct": 7.0, "reach_semis_pct": 23.9},
        "Brazil": {"win_pct": 6.6, "reach_semis_pct": 22.1, "top_group_pct": 60.4},
        "Germany": {"win_pct": 5.1, "reach_final_pct": 10.6},
        "Netherlands": {"win_pct": 3.6},
        "Norway": {"win_pct": 3.5},
        "Belgium": {"win_pct": 2.4},
        "Colombia": {"win_pct": 2.1},
        "Morocco": {"win_pct": 1.9},
        "Croatia": {"win_pct": 1.6},
        "Ecuador": {"win_pct": 1.4, "reach_qf_pct": 43.4},
        "United States": {"win_pct": 1.2, "top_group_pct": 32.8},
        "Mexico": {"win_pct": 1.0, "top_group_pct": 47.8, "reach_qf_pct": 24.2},
        "Egypt": {"win_pct": 0.4, "reach_qf_pct": 30.6},
        "Australia": {"win_pct": 0.3, "top_group_pct": 17.9, "reach_qf_pct": 26.3},
        "Scotland": {"win_pct": 0.2, "reach_qf_pct": 24.4},
        "Uzbekistan": {"win_pct": 0.1},
        "Jordan": {"win_pct": 0.1},
        "South Africa": {"win_pct": 0.1},
        "Curacao": {"win_pct": 0.0},
    },
    "post_group_pre_r32": {
        "France": {"win_pct": 18.7},
        "Argentina": {"win_pct": 16.3},
        "Spain": {"win_pct": 13.5},
        "England": {"win_pct": 9.7},
        "Brazil": {"win_pct": 6.5},
        "Netherlands": {"win_pct": 5.1},
        "United States": {"reach_qf_pct": 42.5},
        "Mexico": {"reach_qf_pct": 28.3},
        "Canada": {"reach_qf_pct": 25.2},
    },
    "post_r32_pre_r16": {
        "France": {"win_pct": 28.9, "reach_final_pct": 44.7},
        "Argentina": {"win_pct": 16.3},
        "Spain": {"win_pct": 13.0},
        "Brazil": {"win_pct": 9.1},
        "England": {"win_pct": 8.1},
        "Portugal": {"win_pct": 5.0},
        "Colombia": {"win_pct": 3.4},
        "Morocco": {"win_pct": 3.2},
        "Norway": {"win_pct": 2.9},
        "Mexico": {"win_pct": 2.7},
        "United States": {"win_pct": 2.1},
        "Canada": {"win_pct": 0.5},
        "Paraguay": {"win_pct": 0.3},
    },
    "post_r16_pre_qf": {
        "Spain": {"win_pct": 21.3},
        "France": {"win_pct": 27.3, "reach_final_pct": 44.3},
        "England": {"win_pct": 16.5},
        "Argentina": {"win_pct": 17.3},
        "Norway": {"win_pct": 6.6, "reach_qf_pct": 37.7},  # reach_qf_pct here = P(beat England in the QF)
        "Morocco": {"win_pct": 3.7},
        "Switzerland": {"win_pct": 3.8},
        "Belgium": {"win_pct": 3.6},
    },
    "post_qf_pre_sf": {
        "France": {"win_pct": 34.0, "reach_final_pct": 57.7},
        "Spain": {"win_pct": 23.4, "reach_final_pct": 42.3},
        "England": {"win_pct": 21.9, "reach_final_pct": 50.9},
        "Argentina": {"win_pct": 20.6, "reach_final_pct": 49.1},
    },
}

STAGE_NOTES = {
    "post_r16_pre_qf": (
        "Norway's reach_qf_pct here is specifically P(beat England in the "
        "quarterfinal), as stated in the article, not a generic "
        "'reach quarterfinal' probability (Norway had already qualified for "
        "the QF at this point)."
    ),
}


def fetch_article_meta(slug: str) -> dict:
    cache = RAW_DIR / f"{slug}.html"
    resp = polite_get(f"{BASE}/{slug}", cache_path=cache)
    if resp is None:
        return {"published_time": None, "modified_time": None, "title": None}
    soup = BeautifulSoup(resp.content, "lxml")
    pub = soup.find("meta", {"property": "article:published_time"})
    mod = soup.find("meta", {"property": "article:modified_time"})
    title = soup.title.get_text().replace(" | Opta Analyst", "").strip() if soup.title else None
    return {
        "published_time": pub["content"] if pub else None,
        "modified_time": mod["content"] if mod else None,
        "title": title,
    }


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    fetched_at = now_epoch()
    for stage_id, stage_label, slug, as_of in ARTICLES:
        print(f"[opta] fetching stage {stage_id} ({stage_label}): {slug}")
        meta = fetch_article_meta(slug)
        url = f"{BASE}/{slug}"
        team_metrics = STAGE_DATA.get(stage_label, {})
        note = STAGE_NOTES.get(stage_label, "")
        for team, metrics in team_metrics.items():
            for metric, value in metrics.items():
                rows.append(
                    {
                        "stage_id": stage_id,
                        "stage_label": stage_label,
                        "as_of_date": as_of,
                        "team": team,
                        "metric": metric,
                        "value_pct": value,
                        "value_prob": value / 100.0,
                        "sims": SIMS,
                        "article_title": meta["title"],
                        "article_url": url,
                        "published_iso": meta["published_time"],
                        "published_epoch_utc": iso_datetime_to_epoch(meta["published_time"]),
                        "modified_iso": meta["modified_time"],
                        "modified_epoch_utc": iso_datetime_to_epoch(meta["modified_time"]),
                        "note": note,
                        "fetched_epoch_utc": fetched_at,
                    }
                )
        print(f"[opta]   {len(team_metrics)} teams, meta={meta}")

    df = pd.DataFrame(rows)
    df = df.sort_values(["stage_id", "team", "metric"]).reset_index(drop=True)
    df.to_parquet(OUT_PATH, index=False)
    print(f"[opta] wrote {len(df)} rows across {df['stage_id'].nunique()} stages -> {OUT_PATH}")

    # Sanity spot-check against the task's named reference numbers
    checks = [
        ("pre_tournament", "Spain", "win_pct", 16.1),
        ("post_r32_pre_r16", "Spain", "win_pct", 13.0),  # NB: see notes in findings
        ("post_r16_pre_qf", "Spain", "win_pct", 21.3),
        ("post_r16_pre_qf", "Argentina", "win_pct", 17.3),
        ("post_r16_pre_qf", "France", "win_pct", 27.3),
    ]
    for stage, team, metric, expected in checks:
        got = df[(df.stage_label == stage) & (df.team == team) & (df.metric == metric)]["value_pct"]
        ok = (not got.empty) and abs(got.iloc[0] - expected) < 1e-6
        print(f"[opta] check {stage}/{team}/{metric} == {expected}: {'OK' if ok else 'MISMATCH ' + str(got.tolist())}")


if __name__ == "__main__":
    main()
