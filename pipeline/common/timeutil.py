"""Timestamp normalization helpers. Every ingest script normalizes all
timestamps to UTC epoch seconds alongside the original ISO string, per
project CLAUDE.md."""
from __future__ import annotations

from datetime import date, datetime, timezone


def iso_date_to_epoch(iso_date: str | None) -> int | None:
    """'YYYY-MM-DD' -> UTC epoch seconds at 00:00:00 UTC that day."""
    if not iso_date:
        return None
    d = date.fromisoformat(iso_date)
    return int(datetime(d.year, d.month, d.day, tzinfo=timezone.utc).timestamp())


def iso_datetime_to_epoch(iso_dt: str | None) -> int | None:
    """Full ISO-8601 datetime (with or without offset) -> UTC epoch seconds."""
    if not iso_dt:
        return None
    dt = datetime.fromisoformat(iso_dt.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.astimezone(timezone.utc).timestamp())


def now_epoch() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())
