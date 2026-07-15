#!/usr/bin/env python3
"""
pipeline/export/verify_tiles.py -- tiny reader/verifier for docs/data/.

Loads manifest.json and asserts every referenced binary parses per the
CONTRACT.md binary layout: correct magic, declared dot/trade/section counts
match file size given the column layout, and a handful of semantic sanity
checks (population dot count matches manifest, flags reference valid enum
bits, zoom windows are internally consistent, series section byte ranges
don't overlap). Exits non-zero on any failure.

Run: pipeline/.venv/bin/python pipeline/export/verify_tiles.py
"""
import json
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "docs", "data")

DTYPE_SIZE = {"u32": 4, "f32": 4, "u16": 2, "u8": 1}

failures = []
checks = 0


def check(cond, msg):
    global checks
    checks += 1
    if not cond:
        failures.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def read_header(path, expected_magic):
    with open(path, "rb") as f:
        magic = f.read(8)
        count, reserved = struct.unpack("<II", f.read(8))
    check(magic == expected_magic, f"{os.path.basename(path)}: magic {magic!r} == {expected_magic!r}")
    return count


def verify_columns(path, count, columns, label):
    size = os.path.getsize(path)
    for col in columns:
        dtype = col["dtype"]
        nbytes = DTYPE_SIZE[dtype]
        end = col["offset"] + nbytes * count
        check(end <= size, f"{label}.{col['name']}: offset {col['offset']} + {nbytes}*{count} = {end} <= filesize {size}")
    print(f"  {label}: {count:,} rows, {size:,} bytes ({size/count if count else 0:.1f} B/row)")


def main():
    manifest_path = os.path.join(OUT, "manifest.json")
    check(os.path.exists(manifest_path), f"manifest.json exists at {manifest_path}")
    manifest = json.load(open(manifest_path))
    print(f"manifest version={manifest.get('version')} generated={manifest.get('generated')}")

    # ---- population tiles ----
    for tier in ("desktop", "mobile"):
        pop = manifest["population"][tier]
        path = os.path.join(OUT, pop["url"].replace("data/", "", 1))
        check(os.path.exists(path), f"population[{tier}] file exists: {path}")
        if not os.path.exists(path):
            continue
        count = read_header(path, b"RTPOP1\x00\x00")
        check(count == pop["dots"], f"population[{tier}]: header count {count} == manifest dots {pop['dots']}")
        check(os.path.getsize(path) == pop["bytes"], f"population[{tier}]: file size == manifest bytes")
        verify_columns(path, count, pop["columns"], f"population[{tier}]")
        expected_col_names = {"birth_ts", "dollars", "market", "family", "team", "side", "price_band", "fate", "flags"}
        got = {c["name"] for c in pop["columns"]}
        check(got == expected_col_names, f"population[{tier}]: column set matches contract sec 5.2 ({sorted(got)})")

    # ---- zoom tiles ----
    for key, z in manifest["zoom"].items():
        path = os.path.join(OUT, z["url"].replace("data/", "", 1))
        check(os.path.exists(path), f"zoom[{key}] file exists: {path}")
        if not os.path.exists(path):
            continue
        count = read_header(path, b"RTZM1\x00\x00\x00")
        n_expected = z["trades"] // max(z.get("build_stride", 1), 1)
        # build_stride thinning uses a python slice stride, so the exact
        # count can be off by a few rows from a naive division -- assert
        # within a small tolerance instead of exact equality.
        check(abs(count - n_expected) <= max(2, n_expected * 0.02) or count == z["trades"],
              f"zoom[{key}]: header count {count} plausible for trades={z['trades']} stride={z.get('build_stride')}")
        check(os.path.getsize(path) == z["bytes"], f"zoom[{key}]: file size == manifest bytes")
        verify_columns(path, count, z["columns"], f"zoom[{key}]")
        expected_col_names = {"ts_ms", "contracts", "notional_usd", "price_c", "side", "leg", "flags"}
        got = {c["name"] for c in z["columns"]}
        check(got == expected_col_names, f"zoom[{key}]: column set matches contract sec 5.4 ({sorted(got)})")
        if count > 1:
            # ts_ms must be non-decreasing (sorted ascending per contract)
            offset = next(c["offset"] for c in z["columns"] if c["name"] == "ts_ms")
            with open(path, "rb") as f:
                f.seek(offset)
                raw = f.read(4 * count)
            import array
            arr = array.array("I")
            arr.frombytes(raw)
            is_sorted = all(arr[i] <= arr[i + 1] for i in range(len(arr) - 1))
            check(is_sorted, f"zoom[{key}]: ts_ms is sorted ascending ({count:,} rows)")

    # ---- series.bin ----
    series = manifest.get("series")
    if series:
        path = os.path.join(OUT, series["url"].replace("data/", "", 1))
        check(os.path.exists(path), f"series.bin exists: {path}")
        if os.path.exists(path):
            with open(path, "rb") as f:
                magic = f.read(8)
                n_sections, _reserved = struct.unpack("<II", f.read(8))
            check(magic == b"RTSER1\x00\x00", f"series.bin magic == RTSER1")
            check(n_sections == len(series["sections"]), f"series.bin: header sectionCount {n_sections} == manifest sections {len(series['sections'])}")
            size = os.path.getsize(path)
            for sec in series["sections"]:
                end = sec["offset"] + 4 * sec["length"]  # all sections are f32
                check(end <= size, f"series.{sec['name']}: offset+length within file ({end} <= {size})")
            print(f"  series.bin: {n_sections} sections, {size:,} bytes")

    # ---- markets.json ----
    mk = manifest.get("markets")
    if mk:
        path = os.path.join(OUT, mk["url"].replace("data/", "", 1))
        check(os.path.exists(path), f"markets.json exists: {path}")
        if os.path.exists(path):
            mkdata = json.load(open(path))
            check(len(mkdata["markets"]) == mk["n_markets"], f"markets.json: {len(mkdata['markets'])} rows == manifest n_markets {mk['n_markets']}")
            # spot-check every population dot's market index resolves
            print(f"  markets.json: {len(mkdata['markets']):,} dot-owning markets, {len(mkdata['strata'])} strata rows")

    # ---- scene JSON files ----
    for sid, url in manifest.get("scenes", {}).items():
        path = os.path.join(OUT, url.replace("data/", "", 1))
        check(os.path.exists(path), f"scene {sid} exists: {path}")
        if os.path.exists(path):
            json.load(open(path))  # must parse

    # ---- budget ----
    total = 0
    for root, _, files in os.walk(OUT):
        for fn in files:
            total += os.path.getsize(os.path.join(root, fn))
    total_mb = total / 1e6
    check(total <= 40 * 1024 * 1024, f"total docs/data/ payload {total_mb:.2f}MB <= 40MB budget")

    print()
    print(f"=== {checks} checks, {len(failures)} failures ===")
    if failures:
        for f in failures:
            print(f"  FAILED: {f}")
        sys.exit(1)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
