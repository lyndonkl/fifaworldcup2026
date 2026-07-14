# The Market Watched the World Cup *(working title)*

A scrollytelling analysis of Kalshi's 2026 FIFA World Cup prediction markets —
the full tick-level trade tape rendered as a WebGL unit visualization with
object constancy.

The piece retells the tournament through the market's eyes: what the crowd
believed moment by moment, how fast it reacted when Haaland scored, where it
beat the bookmakers and where it fooled itself — and, before the final, how to
*read* the market's number for July 19 knowing everything it got right and
wrong along the way.

**Status: in progress.** v1 targets publication before the July 19 final.

## Structure

- `pipeline/` — Python ingestion + analytics (Kalshi trade tape, Polymarket,
  Pinnacle odds, polls, Trends; Parquet + DuckDB). Raw data is not committed.
- `docs/` — the static site (GitHub Pages): raw-WebGL particle engine, D3
  overlays, scroll-driven scenes.
- `research/` — grounded fact base and analysis artifacts.
- `DECISIONS.md` — the full decision log with rationale.
- `CLAUDE.md` — durable build rules.

## Method notes

Built with a hierarchical multi-agent workflow pipeline (ingestion fleet →
verified analysis sweeps → storyboard → design system → build → review), with
human approval gates at every workflow launch and phase artifact. Data sources
are free and public; coverage gaps are documented rather than papered over.
