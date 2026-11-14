#!/usr/bin/env python3
"""Cut Retro Bowl's own field art (turf, crowd, stand front) for the Team Lab's stadium.

The art is New Star Games' (the owner's choice: the private sprites ship with the site, gated by
__PRIVATE_SPRITES__). This script holds no art: it reads the game's web build (RetroBowl.js and its texture pages,
the same .cache/retrobowl/ files scripts/private_sprites.py downloads) and writes the pieces the Team Lab draws to
public/private-sprites/field/. A build without public/private-sprites/ never fetches them and draws its CSS field.

    python3 scripts/private_field_art.py [path/to/html5game]

Output (public/private-sprites/field/), every piece the middle 640 px of the game's 1300 px field (x 330-969, the
50-yard line at its centre):
- turf-day.png, turf-night.png, turf-snow.png: spr_field frames 0 (normal), 4 (dark) and 1 (snow), 640 x 237, with
  the sideline crew along the top. The crew wears the game's key colours (below), painted to a club on the site.
- crowd.png: spr_fieldfans frame 0, the crowd in the stands, 640 x 33 (key colours).
- stands.png: spr_fieldfans frame 1, the stand front, 640 x 33.
- index.json: the files, sizes, the field's playing rows and the key colours.
Key colours: #00ff00 club primary, #ff00ff club secondary, #00ffff a light trim.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from private_sprites import atlas, source  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "private-sprites" / "field"
X0, X1 = 330, 970
TURF = {"turf-day.png": 0, "turf-night.png": 4, "turf-snow.png": 1}


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
    files: dict[str, list[int]] = {}
    for name, f in TURF.items():
        img = frame(spr["spr_field"]["frames"][f]).crop((X0, 0, X1, 237))
        img.save(OUT / name, optimize=True)
        files[name] = list(img.size)
        # the portrait field for a phone: turned a quarter so the yard lines run across (the crew down the left)
        tall = img.transpose(Image.Transpose.ROTATE_90)
        tall.save(OUT / name.replace(".png", "-tall.png"), optimize=True)
        files[name.replace(".png", "-tall.png")] = list(tall.size)
    for name, f in (("crowd.png", 0), ("stands.png", 1)):
        img = frame(spr["spr_fieldfans"]["frames"][f]).crop((X0, 0, X1, 33))
        img.save(OUT / name, optimize=True)
        files[name] = list(img.size)
    index = {
        "about": "Retro Bowl's own field art (New Star Games), cut by scripts/private_field_art.py for the Team Lab.",
        "files": files,
        # rows of turf-*.png: the sideline crew above the field, the field between its white lines
        "field": {"top": 36, "bottom": 199},
        "keys": {"primary": "#00ff00", "secondary": "#ff00ff", "trim": "#00ffff"},
    }
    (OUT / "index.json").write_text(json.dumps(index, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {', '.join(files)}")


if __name__ == "__main__":
    main()
