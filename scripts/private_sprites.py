#!/usr/bin/env python3
"""Cut Retro Bowl's own player sprites into a PRIVATE folder the site uses when it runs on this Mac.

The art is New Star Games' (owner choice, 2026-11-13: private sprites, never on the public site). This script holds
no art. It reads the game's web build (RetroBowl.js and its two texture pages), cuts the sprites the site needs, and
writes them to public/private-sprites/ (git-ignored). The GitHub Pages build never has that folder, so the public site
keeps its own art; the dev server and the LAN preview (npm run build on this Mac) show the real sprites.

    python3 scripts/private_sprites.py [path/to/html5game]

Without a path it downloads the web build's three files from the fan repo jaxsonbunch/retro-bowl-modded into
.cache/retrobowl/ (git-ignored) once.

Output (public/private-sprites/):
- faces.png: the 96 portraits (12 sheets x 8 faces: dark 1-8, light 1-3, mix 1), one row per sheet, 32 x 36 each.
  Key colours: #00ff00 shirt (and caps), #ff00ff collar and trim, #ff0000 shoulder stripes (recoloured to a club's
  kit on the site).
- bodies.png: on-field poses (stand, run, celebrate, jump, dive, stiff arm, QB throw), one row per pose, frames left to
  right on a 32 x 26 grid with feet on a shared baseline. Keys: #ff0000 helmet, #0000ff / #8080ff / #000080 jersey,
  #ff00ff / #800080 pants and stripe, #ffff00 socks, #00ff00 / #008000 / #007f00 skin.
- helmet.png: the big helmet (2 frames, 60 x 60). Keys: #ff0000 shell, #00ff00 and #ff00ff stripes.
- index.json: where everything is, the key colours, and the face sheets in the save's order (face_x, face_y).
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "private-sprites"
CACHE = ROOT / ".cache" / "retrobowl"
REPO = "https://raw.githubusercontent.com/jaxsonbunch/retro-bowl-modded/main/html5game/"
FILES = ["RetroBowl.js", "RetroBowl_texture_0.png", "RetroBowl_texture_1.png"]
FACE_SHEETS = [f"spr_dark_{i:03d}" for i in range(1, 9)] + [f"spr_light_{i:03d}" for i in range(1, 4)] + ["spr_mix_001"]
POSES = ["spr_stand", "spr_run", "spr_celebrate", "spr_jump", "spr_dive", "spr_stiffarm", "spr_qb_throw"]
CELL = (32, 26)  # body grid cell (dives are wide)


def source(arg: str | None) -> Path:
    if arg:
        return Path(arg)
    CACHE.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        if not (CACHE / f).exists():
            print("downloading", f)
            urllib.request.urlretrieve(REPO + f, CACHE / f)
    return CACHE


def atlas(js: str):
    end = js.find("_nh: ['RetroBowl_texture_0.png'")
    if end < 0:
        sys.exit("This RetroBowl.js has no texture table where expected (a different build?).")
    keys = ["x", "y", "w", "h", "xo", "yo", "cw", "ch", "ow", "oh", "page"]
    tpe = [dict(zip(keys, map(int, m.groups()))) for m in re.finditer(
        r"\{\s*x: (-?\d+),\s*y: (-?\d+),\s*_a2: (\d+),\s*_b2: (\d+),\s*_gh: (-?\d+),\s*_hh: (-?\d+),\s*_ih: (\d+),"
        r"\s*_jh: (\d+),\s*_kh: (\d+),\s*_lh: (\d+),\s*_mh: (\d+)\s*\}", js[:end])]
    spr: dict[str, dict] = {}
    for m in re.finditer(r"_51: '(spr_[A-Za-z0-9_]+)',", js[:end]):
        seg = js[m.end():m.end() + 600]
        l1 = re.search(r"_l1: \[([0-9,\s]*)\]", seg)
        org = re.search(r"_i1: (-?\d+),.*?_j1: (-?\d+)", seg)
        if l1 and m.group(1) not in spr:
            spr[m.group(1)] = {"frames": [int(x) for x in l1.group(1).replace(" ", "").split(",") if x],
                               "ox": int(org.group(1)) if org else 0, "oy": int(org.group(2)) if org else 0}
    return tpe, spr


def main() -> None:
    src = source(sys.argv[1] if len(sys.argv) > 1 else None)
    js = (src / "RetroBowl.js").read_text(encoding="utf-8", errors="ignore")
    tpe, spr = atlas(js)
    pages = [Image.open(src / f"RetroBowl_texture_{i}.png").convert("RGBA") for i in (0, 1)]

    def frame(i: int) -> Image.Image:
        t = tpe[i]
        img = Image.new("RGBA", (t["ow"], t["oh"]), (0, 0, 0, 0))
        crop = pages[t["page"]].crop((t["x"], t["y"], t["x"] + t["w"], t["y"] + t["h"]))
        if (t["w"], t["h"]) != (t["cw"], t["ch"]):
            crop = crop.resize((t["cw"], t["ch"]), Image.NEAREST)
        img.paste(crop, (t["xo"], t["yo"]))
        return img

    OUT.mkdir(parents=True, exist_ok=True)
    index: dict = {"about": "Retro Bowl's own sprites (New Star Games), cut by scripts/private_sprites.py. Private: "
                            "git-ignored, never on the public site.",
                   "faces": {"file": "faces.png", "w": 32, "h": 36, "sheets": FACE_SHEETS, "perSheet": 8,
                             "keys": {"shirt": "#00ff00", "trim": "#ff00ff", "stripe": "#ff0000"}},
                   "bodies": {"file": "bodies.png", "cell": list(CELL), "poses": {},
                              "keys": {"helmet": ["#ff0000"], "jersey": ["#0000ff", "#8080ff", "#000080"],
                                       "pants": ["#ff00ff", "#800080"], "socks": ["#ffff00"],
                                       "skin": ["#00ff00", "#008000", "#007f00"]}},
                   "helmet": {"file": "helmet.png", "w": 60, "h": 60, "frames": 2,
                              "keys": {"shell": "#ff0000", "stripe": "#00ff00", "stripe2": "#ff00ff"}}}

    faces = Image.new("RGBA", (32 * 8, 36 * len(FACE_SHEETS)), (0, 0, 0, 0))
    for r, name in enumerate(FACE_SHEETS):
        for c, i in enumerate(spr[name]["frames"][:8]):
            faces.paste(frame(i), (c * 32, r * 36))
    faces.save(OUT / "faces.png")

    rows = [p for p in POSES if p in spr]
    width = max(len(spr[p]["frames"]) for p in rows)
    bodies = Image.new("RGBA", (CELL[0] * width, CELL[1] * len(rows)), (0, 0, 0, 0))
    for r, name in enumerate(rows):
        s = spr[name]
        for c, i in enumerate(s["frames"]):
            f = frame(i)
            # every frame is cut at its sprite's full size (the poses' origins are 0, 0, top-left): centre it in the
            # cell and stand its bottom edge on the cell's bottom, the shared baseline
            bodies.paste(f, (c * CELL[0] + (CELL[0] - f.width) // 2, r * CELL[1] + CELL[1] - f.height), f)
        index["bodies"]["poses"][name.removeprefix("spr_")] = {"row": r, "frames": len(s["frames"])}
    bodies.save(OUT / "bodies.png")

    helmet = Image.new("RGBA", (120, 60), (0, 0, 0, 0))
    for c, i in enumerate(spr["spr_helmet"]["frames"][:2]):
        helmet.paste(frame(i), (c * 60, 0))
    helmet.save(OUT / "helmet.png")

    (OUT / "index.json").write_text(json.dumps(index, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(FACE_SHEETS) * 8} faces, {len(rows)} poses, helmet")


if __name__ == "__main__":
    main()
