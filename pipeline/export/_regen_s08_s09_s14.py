#!/usr/bin/env python3
"""
Scoped regeneration script -- Gate-5 items 9/10/17.

Regenerates ONLY docs/data/scenes/{s08,s09,s14}.json by calling the same
build_scene_s08 / build_scene_s09 / build_scene_s14 functions the full
build_tiles.py main() pipeline uses, but without running the rest of that
pipeline (population tiles, manifest, hero, other scenes) -- so
manifest.json's hero/frozen_at stay byte-identical and no other scene's
JSON is touched. Writes with the exact same json.dump convention
build_tiles.py's own scene-JSON writer uses (compact, default=str), so a
future full rebuild diffs cleanly against this one.

Run: pipeline/.venv/bin/python pipeline/export/_regen_s08_s09_s14.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_tiles as bt  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_DIR = os.path.join(ROOT, "docs", "data", "scenes")


def main():
    con = bt.make_con()
    gerpar_buf, gerpar_meta = bt.build_gerpar_zoom(con)

    s08 = bt.build_scene_s08(con, gerpar_meta)
    s09 = bt.build_scene_s09(con)
    s14 = bt.build_scene_s14(con)

    for sid, payload in [("s08", s08), ("s09", s09), ("s14", s14)]:
        path = os.path.join(SCENES_DIR, f"{sid}.json")
        with open(path, "w") as f:
            json.dump(payload, f, separators=(",", ":"), default=str)
        print(f"wrote {path} ({os.path.getsize(path):,} bytes)")


if __name__ == "__main__":
    main()
