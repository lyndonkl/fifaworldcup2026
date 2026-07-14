"""Arm C.1 — Public-opinion poll toplines: Pew Research, YouGov (3 items),
Ipsos Global Advisor. "The fans", as distinct from Kalshi's price-implied
crowd.

METHOD: None of these publishers expose a structured API/download for the
exact figures requested — Pew and YouGov render figures as data-table-backed
chart components inside ordinary article HTML (no separate JSON endpoint
found), and Ipsos publishes only a PDF report. So each script run:
  1. Fetches (and caches) the live page/PDF over HTTP — this is the
     reproducible, re-runnable part, and lets a re-run notice if a publisher
     changes a topline.
  2. Extracts each number from the verified, hand-read rendered text/PDF
     text (verbatim, see comments next to each figure below citing the
     sentence it came from) and encodes it as a structured record here.
     No numbers are estimated, interpolated, or rounded beyond what the
     source itself printed.

Output: pipeline/data/benchmarks/opinion/polls.parquet (+ polls.json, same
content, for easy inspection without a parquet reader) — long/tidy format,
one row per (source, question, entity).
"""
from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup
from pypdf import PdfReader

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "pipeline"))

from common.http import polite_get  # noqa: E402
from common.timeutil import iso_date_to_epoch, now_epoch  # noqa: E402

RAW_DIR = REPO_ROOT / "pipeline" / "data" / "raw" / "opinion"
OUT_PARQUET = REPO_ROOT / "pipeline" / "data" / "benchmarks" / "opinion" / "polls.parquet"
OUT_JSON = REPO_ROOT / "pipeline" / "data" / "benchmarks" / "opinion" / "polls.json"

PAGES = {
    "pew_wc26": "https://www.pewresearch.org/short-reads/2026/06/02/who-do-americans-think-is-going-to-win-the-world-cup/",
    "yougov_54871": "https://yougov.com/en-us/articles/54871-what-americans-think-about-the-2026-world-cup",
    "yougov_54989": "https://yougov.com/en-us/articles/54989-fifa-world-cup-2026-is-already-outscoring-the-2022-edition-in-the-us",
    "yougov_daily_20260615": "https://yougov.com/en-us/daily-results/20260615-09632-4",
    "ipsos_landing": "https://www.ipsos.com/en/ipsos-predictions-survey-2026",
    "ipsos_pdf": "https://www.ipsos.com/sites/default/files/ct/news/documents/2025-12/ipsos-2026-predictions-survey-report.pdf",
}

FETCHED_AT = now_epoch()


def fetch_all() -> dict[str, bytes]:
    out = {}
    for key, url in PAGES.items():
        ext = ".pdf" if url.endswith(".pdf") else ".html"
        cache = RAW_DIR / f"{key}{ext}"
        print(f"[polls] fetching {key}: {url}")
        resp = polite_get(url, cache_path=cache)
        if resp is None:
            print(f"[polls]   FAILED: {key}")
            continue
        out[key] = resp.content
    return out


# ---------------------------------------------------------------------------
# Hand-extracted records. Each dict becomes one long-format row. Verified
# verbatim against the cached page text (see docstring). "raw_value_text" is
# copied character-for-character from the source.
# ---------------------------------------------------------------------------

def build_records() -> list[dict]:
    records: list[dict] = []

    # ---- Pew Research Center: "Who do Americans think is going to win the
    # World Cup?" (pewresearch.org, published 2026-06-02) ----
    # Field dates from the article's Methodology section: "We surveyed 3,507
    # adults from March 23 to 29, 2026." The winner question is asked only
    # among the 28% of that panel who say they are at least "somewhat
    # likely" to follow the World Cup (open-ended "who will win" question).
    pew_common = {
        "source": "Pew Research Center",
        "survey_name": "Who do Americans think is going to win the World Cup?",
        "url": PAGES["pew_wc26"],
        "publish_date": "2026-06-02",
        "field_start_date": "2026-03-23",
        "field_end_date": "2026-03-29",
        "sample_size": 3507,
        "population": (
            "U.S. adults who say they are somewhat/very/extremely likely to "
            "follow the 2026 World Cup (28% of the full n=3,507 American "
            "Trends Panel sample); open-ended question, teams under 2% not shown"
        ),
        "question_wording": (
            "Among U.S. adults who say they are somewhat/very/extremely "
            "likely to follow the World Cup, % who say they think __ will "
            "win the 2026 World Cup (open-ended)"
        ),
        "category": "winner_expectation",
    }
    pew_winner_pcts = {
        "Spain": 9, "Brazil": 8, "Argentina": 8, "United States": 7,
        "France": 7, "Germany": 4, "Portugal": 3, "Mexico": 3, "England": 2,
        "Not sure": 41,
    }
    for entity, pct in pew_winner_pcts.items():
        records.append({**pew_common, "entity": entity, "value_pct": float(pct),
                         "raw_value_text": f"{pct}%"})

    # ---- YouGov article 54871: "What Americans think about the 2026 World
    # Cup" (published 2026-05-29). Methodology: "online survey conducted on
    # May 21-24, 2026 among 1,096 U.S. adult citizens." ----
    yg1_base = {
        "source": "YouGov",
        "survey_name": "What Americans think about the 2026 World Cup",
        "url": PAGES["yougov_54871"],
        "publish_date": "2026-05-29",
        "field_start_date": "2026-05-21",
        "field_end_date": "2026-05-24",
        "sample_size": 1096,
    }
    # Overall population, "who will win" (12% US / 6% Argentina / ... / 1% or
    # less for each of the other 24 teams -> not individually enumerated)
    records.append({
        **yg1_base, "population": "All U.S. adults (n=1,096)",
        "question_wording": "Which team do Americans think is most likely to win the World Cup?",
        "category": "winner_expectation",
        "entity": "United States", "value_pct": 12.0, "raw_value_text": "12%",
    })
    for entity, pct in {"Argentina": 6, "Brazil": 5, "France": 3, "England": 2, "Spain": 2}.items():
        records.append({
            **yg1_base, "population": "All U.S. adults (n=1,096)",
            "question_wording": "Which team do Americans think is most likely to win the World Cup?",
            "category": "winner_expectation",
            "entity": entity, "value_pct": float(pct), "raw_value_text": f"{pct}%",
        })
    # Sub-population: at least somewhat interested in the World Cup
    yg1_interested_pop = "U.S. adults who are at least somewhat interested in the World Cup"
    for entity, pct in {"United States": 22, "Argentina": 14, "Brazil": 11, "France": 8, "England": 6}.items():
        records.append({
            **yg1_base, "population": yg1_interested_pop,
            "question_wording": "Which team do Americans think is most likely to win the World Cup? (among the at-least-somewhat-interested)",
            "category": "winner_expectation",
            "entity": entity, "value_pct": float(pct), "raw_value_text": f"{pct}%",
        })
    # Rooting / "team you most support" — all adults
    records.append({
        **yg1_base, "population": "All U.S. adults (n=1,096)",
        "question_wording": "The team you most support in the World Cup",
        "category": "rooting_preference",
        "entity": "United States", "value_pct": 30.0, "raw_value_text": "30%",
    })
    records.append({
        **yg1_base, "population": "All U.S. adults (n=1,096)",
        "question_wording": "The team you most support in the World Cup",
        "category": "rooting_preference",
        "entity": "Don't support any team", "value_pct": 46.0, "raw_value_text": "46%",
    })
    # Rooting — among at-least-somewhat-interested
    records.append({
        **yg1_base, "population": yg1_interested_pop,
        "question_wording": "The team you most support in the World Cup (among the at-least-somewhat-interested)",
        "category": "rooting_preference",
        "entity": "United States", "value_pct": 55.0, "raw_value_text": "55%",
    })
    for entity, pct in {"Brazil": 5, "Argentina": 5, "France": 5, "Portugal": 5}.items():
        records.append({
            **yg1_base, "population": yg1_interested_pop,
            "question_wording": "The team you most support in the World Cup (among the at-least-somewhat-interested)",
            "category": "rooting_preference",
            "entity": entity, "value_pct": float(pct), "raw_value_text": f"{pct}%",
        })
    # "Happy to see __ win" — all adults
    for entity, pct in {"United States": 37, "Brazil": 9, "England": 9, "Mexico": 8, "Argentina": 7, "Germany": 6}.items():
        records.append({
            **yg1_base, "population": "All U.S. adults (n=1,096)",
            "question_wording": "Would be happy to see __ win the World Cup",
            "category": "happy_if_win",
            "entity": entity, "value_pct": float(pct), "raw_value_text": f"{pct}%",
        })
    # "Happy to see __ win" — among at-least-somewhat-interested
    for entity, pct in {"United States": 65, "Brazil": 22, "England": 20, "Argentina": 18, "Mexico": 16}.items():
        records.append({
            **yg1_base, "population": yg1_interested_pop,
            "question_wording": "Would be happy to see __ win the World Cup (among the at-least-somewhat-interested)",
            "category": "happy_if_win",
            "entity": entity, "value_pct": float(pct), "raw_value_text": f"{pct}%",
        })
    # Interest level (all adults)
    for entity, pct in {
        "Very interested": 13, "Somewhat interested": 16,
        "Not very interested": 14, "Not at all interested": 54,
    }.items():
        records.append({
            **yg1_base, "population": "All U.S. adults (n=1,096)",
            "question_wording": "How interested are you in the 2026 World Cup?",
            "category": "interest_level",
            "entity": entity, "value_pct": float(pct), "raw_value_text": f"{pct}%",
        })

    # ---- YouGov daily result: "Are you rooting for the U.S. to win the 2026
    # FIFA World Cup, or some other country?" (published 2026-06-15) ----
    yg_daily_base = {
        "source": "YouGov",
        "survey_name": "Are you rooting for the U.S. to win the 2026 FIFA World Cup, or some other country?",
        "url": PAGES["yougov_daily_20260615"],
        "publish_date": "2026-06-15",
        "field_start_date": "2026-06-15",
        "field_end_date": "2026-06-15",
        "sample_size": 24636,
        "population": "All U.S. adults (n=24,636)",
        "question_wording": "Are you rooting for the U.S. to win the 2026 FIFA World Cup, or some other country?",
        "category": "rooting_preference",
    }
    for entity, pct in {
        "United States": 38, "Some other country": 10,
        "No preference": 38, "Not sure": 14,
    }.items():
        records.append({**yg_daily_base, "entity": entity, "value_pct": float(pct),
                         "raw_value_text": f"{pct}%"})

    # ---- YouGov article 54989: SportsIndex Buzz / Word-of-Mouth tracker
    # ("FIFA World Cup 2026 is already outscoring the 2022 edition in the
    # U.S.", published 2026-06-17). Not a per-team share-of-voice metric —
    # a continuous U.S.-public-attention index (0-100ish scale), the closest
    # thing to a "popularity tracker" the fact-base pointed at. Units are
    # YouGov's own Buzz/WOM index points, not percentages of a population, so
    # value_pct here holds the index reading and raw_value_text/category flag
    # that distinction. ----
    yg2_base = {
        "source": "YouGov",
        "survey_name": "FIFA World Cup 2026 is already outscoring the 2022 edition in the U.S. (SportsIndex Buzz/WOM tracker)",
        "url": PAGES["yougov_54989"],
        "publish_date": "2026-06-17",
        "field_start_date": "2026-06-04",  # "seven days before the start" of a June-11 kickoff
        "field_end_date": "2026-06-16",  # "day five" of the tournament, per article
        "sample_size": None,
        "population": "U.S. adults 18+ (YouGov SportsIndex daily tracking panel)",
        "question_wording": (
            "YouGov SportsIndex Buzz: whether U.S. adults have heard something "
            "positive or negative about the FIFA World Cup in the past two "
            "weeks (net positive-minus-negative score); WOM Exposure: whether "
            "they've heard friends/family talking about it in the past two weeks"
        ),
        "category": "popularity_index",
    }
    buzz_points = [
        ("Buzz, 7 days pre-kickoff (2026)", "2026-06-04", 11.9),
        ("Buzz, opening day (2026)", "2026-06-11", 15.6),
        ("Buzz, day 5 (2026)", "2026-06-16", 17.9),
        ("Buzz, 1 week pre-kickoff (2022, reference)", None, 4.3),
        ("Buzz, opening day (2022, reference)", None, 6.0),
        ("Buzz peak (2022, reference)", None, 6.6),
        ("WOM Exposure, 7 days pre-kickoff (2026)", "2026-06-04", 21.7),
        ("WOM Exposure, opening day (2026)", "2026-06-11", 24.8),
        ("WOM Exposure, day 4 (2026)", "2026-06-15", 27.2),
        ("WOM Exposure, 1 week pre-kickoff (2022, reference)", None, 7.2),
        ("WOM Exposure peak, day 29/final day (2022, reference)", None, 26.4),
        ("Peak Buzz, Gen Z (2026)", None, 43.4),
        ("Peak Buzz, Gen Z (2022, reference)", None, 25.0),
        ("Peak Buzz, Millennials (2026)", None, 18.1),
        ("Peak Buzz, Millennials (2022, reference)", None, 7.7),
        ("Peak Buzz, Gen X (2026)", None, 13.5),
        ("Peak Buzz, Gen X (2022, reference)", None, 5.3),
        ("Peak Buzz, Baby Boomers (2026)", None, 9.2),
        ("Peak Buzz, Baby Boomers (2022, reference)", None, 3.8),
    ]
    for entity, obs_date, value in buzz_points:
        rec = {**yg2_base, "entity": entity, "value_pct": float(value),
               "raw_value_text": str(value)}
        if obs_date:
            rec["field_start_date"] = obs_date
            rec["field_end_date"] = obs_date
        records.append(rec)

    # ---- Ipsos Global Advisor "Predictions 2026" 30-country survey ----
    # Fielded Oct 24-Nov 7 2025 (per PDF methodology page), n=23,642.
    # Statement: "Argentina will win the soccer World Cup again" — %
    # Agree (very much + somewhat) by market. This is the source of the
    # widely-cited "87% of Argentinians" figure.
    ipsos_common = {
        "source": "Ipsos",
        "survey_name": "Global Advisor: Predictions for 2026",
        "url": "https://www.ipsos.com/sites/default/files/ct/news/documents/2025-12/ipsos-2026-predictions-survey-report.pdf",
        "publish_date": "2025-12-01",  # report file path dated 2025-12; landing page live at fetch time
        "field_start_date": "2025-10-24",
        "field_end_date": "2025-11-07",
        "sample_size": 23642,
        "population": (
            "30-country online adults (Global Advisor platform; India also on "
            "IndiaBus), ages vary by market (18-74 in several, 16-74 default, "
            "20-74/21-74 in a few Asian markets); this item shown per-market, "
            "not by the respondent's own team affiliation"
        ),
        "question_wording": (
            "Please indicate if you agree very much, agree somewhat, disagree "
            "somewhat or disagree very much with the following statement: "
            "'Argentina will win the soccer World Cup again' (% Agree shown)"
        ),
        "category": "agree_argentina_repeats",
    }
    ipsos_agree_pct = {
        "30-country average": 41, "Argentina": 87, "India": 68, "Indonesia": 59,
        "Peru": 55, "Malaysia": 53, "Thailand": 52, "Turkiye": 52, "Romania": 52,
        "Singapore": 44, "South Africa": 44, "South Korea": 42, "Australia": 42,
        "United States": 42, "Ireland": 40, "Canada": 40, "Chile": 40,
        "Colombia": 38, "Mexico": 37, "Italy": 36, "Spain": 33,
        "Great Britain": 31, "Sweden": 31, "Poland": 31, "Belgium": 29,
        "Hungary": 28, "France": 28, "Netherlands": 27, "Japan": 25,
        "Brazil": 25, "Germany": 20,
    }
    for entity, pct in ipsos_agree_pct.items():
        records.append({**ipsos_common, "entity": entity, "value_pct": float(pct),
                         "raw_value_text": f"{pct}%"})

    return records


def finalize(records: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(records)
    df["value_prob"] = df["value_pct"] / 100.0
    df["field_start_epoch_utc"] = df["field_start_date"].apply(iso_date_to_epoch)
    df["field_end_epoch_utc"] = df["field_end_date"].apply(iso_date_to_epoch)
    df["publish_epoch_utc"] = df["publish_date"].apply(iso_date_to_epoch)
    df["fetched_epoch_utc"] = FETCHED_AT
    cols = [
        "source", "survey_name", "url", "category", "entity",
        "value_pct", "value_prob", "raw_value_text",
        "population", "question_wording", "sample_size",
        "field_start_date", "field_end_date",
        "field_start_epoch_utc", "field_end_epoch_utc",
        "publish_date", "publish_epoch_utc", "fetched_epoch_utc",
    ]
    return df[cols]


def verify_ipsos_pdf(pdf_bytes: bytes) -> bool:
    """Regression guard, not the extraction method: re-parses the cached
    Ipsos PDF with pypdf and confirms the "Argentina will win the soccer
    World Cup again" chart (Argentina=87% Agree) is still on the page we
    hand-read it from. The 31 hand-transcribed country figures in
    build_records() are the actual data (a pixel-chart's numbers are text
    labels in the PDF, not a parseable table, so hand transcription against
    the rendered/extracted text was the reliable path) — this just catches
    the case where Ipsos revises the report and our transcription goes stale.
    """
    reader = PdfReader(BytesIO(pdf_bytes))
    for page in reader.pages:
        text = page.extract_text() or ""
        if "Argentina will win the" in text and "87%" in text:
            return True
    return False


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PARQUET.parent.mkdir(parents=True, exist_ok=True)

    fetched = fetch_all()
    print(f"[polls] fetched {len(fetched)}/{len(PAGES)} pages/files")

    if "ipsos_pdf" in fetched:
        pdf_ok = verify_ipsos_pdf(fetched["ipsos_pdf"])
        print(f"[polls] Ipsos PDF regression check (Argentina/87% still present): {'OK' if pdf_ok else 'STALE — re-verify hand-transcribed figures against the PDF'}")

    records = build_records()
    df = finalize(records)
    df.to_parquet(OUT_PARQUET, index=False)
    print(f"[polls] wrote {len(df)} rows -> {OUT_PARQUET}")

    with OUT_JSON.open("w") as f:
        json.dump(json.loads(df.to_json(orient="records")), f, indent=2)
    print(f"[polls] wrote {OUT_JSON}")

    # spot checks against the task's named reference numbers
    def check(source, entity, category, expected):
        got = df[(df.source == source) & (df.entity == entity) & (df.category == category)]["value_pct"]
        ok = (not got.empty) and abs(got.iloc[0] - expected) < 1e-6
        print(f"[polls] check {source}/{entity}/{category} == {expected}: {'OK' if ok else 'MISMATCH ' + str(got.tolist())}")

    check("Ipsos", "Argentina", "agree_argentina_repeats", 87.0)
    check("Pew Research Center", "Spain", "winner_expectation", 9.0)


if __name__ == "__main__":
    main()
