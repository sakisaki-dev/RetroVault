#!/usr/bin/env python3
"""Pre-scaled game sprites for the Scriptable widget (public/data/widget-sprites/), written by build_widget_data.py.

Scriptable scales images smoothly, which blurs pixel art, so the widget gets each sprite already blown up with
nearest-neighbour pixels (SCALE x: a 64 x 64 frame becomes 256 x 256) and draws it at whole device pixels. Only the
players the widget names get one: the champions' photo, the Hot Takes' players, the spotlight pool (plus a white
silhouette of each spotlight player for the lock screen, which iOS tints).

Same source and rules as the site (src/components/GameSprite.tsx), nothing re-decided here:
* which file, kit and pose: scripts/widget_sprite_picks.ts runs the site's own nflSpriteFor (the kit the save drew for
  the club, else the neutral kit to paint, stand-ins for players the save lacks, assigned looks, his role's pose) and
  bodyFor (src/config/bodyTypes.ts) on public/private-sprites/nfl/index.json and public/data/sprites.json
* the kit colours: the same script hands over gameKitPaint.ts paletteFor for every club
* the pixels: paint and reshape below are line-for-line ports of gameKitPaint.ts paintPixels and reshape

Every file is normalised to one anchor: the figure's centre line on x 31.5 and his feet on row 58 of the 64 frame, so
the widget places any sprite the same way. Output is deterministic (same input, same bytes); files no longer named are
deleted.
"""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
NFL = ROOT / "public" / "private-sprites" / "nfl"
LOOKS = ROOT / "public" / "data" / "sprites.json"
OUT = ROOT / "public" / "data" / "widget-sprites"
URL = "data/widget-sprites/"  # relative to the site root (the widget prefixes raw GitHub's public/ or the Pages site)
SCALE = 4
FRAME = 64
CX, FOOT = 31.5, 58  # the normalised anchor

# gameKitPaint.ts row bands of the 64 x 64 body template
BODY_TOP, PANTS_TOP, SOCKS_TOP, SHOES_TOP = 27, 41, 52, 56


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def site_rules(jobs: list[dict]) -> tuple[dict, list]:
    """The site's picks and kit palettes for these jobs (scripts/widget_sprite_picks.ts, bundled with esbuild)."""
    esbuild = ROOT / "node_modules" / ".bin" / "esbuild"
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "picks.cjs"
        subprocess.run([str(esbuild), str(ROOT / "scripts" / "widget_sprite_picks.ts"), "--bundle", "--platform=node",
                        f"--alias:@={ROOT / 'src'}", '--define:import.meta.env.BASE_URL="/"', f"--outfile={out}",
                        "--log-level=error"], check=True, cwd=ROOT)
        payload = json.dumps({"index": json.loads((NFL / "index.json").read_text()),
                              "looks": json.loads(LOOKS.read_text()) if LOOKS.exists() else {}, "jobs": jobs})
        res = subprocess.run(["node", str(out)], input=payload, capture_output=True, text=True, check=True, cwd=ROOT)
    data = json.loads(res.stdout)
    return data["palettes"], data["picks"]


def paint(px: list, w: int, h: int, pal: dict):
    """gameKitPaint.ts paintPixels: the neutral kit's three colours, band by band, into the club's home kit."""
    bands = {k: {int(c): tuple(v) for c, v in pal[k].items()} for k in ("jersey", "pants", "socks")}
    for y in range(BODY_TOP, min(SHOES_TOP, h)):
        band = bands["jersey"] if y < PANTS_TOP else bands["pants"] if y < SOCKS_TOP else bands["socks"]
        for x in range(w):
            r, g, b, a = px[y * w + x]
            if a < 255:
                continue
            to = band.get((r << 16) | (g << 8) | b)
            if to:
                px[y * w + x] = (*to, a)


def reshape(cur: list, w: int, h: int, cx: float, foot: int, rows: int, cols: int) -> list:
    """gameKitPaint.ts reshape: whole rows and columns repeated or dropped (feet row and centre line fixed)."""
    empty = (0, 0, 0, 0)
    if cols:
        out = [empty] * (w * h)
        head, legs = foot - 24, foot - 9
        for y in range(h):
            L, R = (cx - 8.5, cx + 7.5) if y < head else (cx - 5.5, cx + 4.5) if y < legs else (cx - 5.5, cx + 5.5)
            for x in range(w):
                ox = x
                if x <= L:
                    ox = min(x + cols, L) if cols > 0 else x + cols
                elif x >= R:
                    ox = max(x - cols, R) if cols > 0 else x - cols
                ok = 0 <= ox < w and float(ox).is_integer()  # a typed array reads a fractional index as nothing
                out[y * w + x] = cur[y * w + int(ox)] if ok else empty
        cur = out
    if rows:
        order = [foot - 8, foot - 27, foot - 5][: abs(rows)]
        lst = []
        for y in range(h):
            if rows < 0 and y in order:
                continue
            lst.append(y)
            if rows > 0 and y in order:
                lst.append(y)
        while len(lst) > h:
            lst.pop(0)
        while len(lst) < h:
            lst.insert(0, -1)
        out = [empty] * (w * h)
        for y, sy in enumerate(lst):
            if sy >= 0:
                out[y * w:(y + 1) * w] = cur[sy * w:(sy + 1) * w]
        cur = out
    return cur


def figure(pick: dict, palettes: dict) -> Image.Image:
    """The sprite as GameSprite draws it (painted, reshaped), moved onto the normalised anchor, 64 x 64."""
    img = Image.open(NFL / pick["file"]).convert("RGBA")
    w, h = img.size
    px = list(img.getdata())
    if pick.get("paint") and pick["paint"] in palettes:
        paint(px, w, h, palettes[pick["paint"]])
    if pick["rows"] or pick["cols"]:
        px = reshape(px, w, h, pick["cx"], pick["foot"], pick["rows"], pick["cols"])
    src = Image.new("RGBA", (w, h))
    src.putdata(px)
    out = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    out.paste(src, (int(round(CX - pick["cx"])), int(round(FOOT - pick["foot"]))))
    return out


def silhouette(img: Image.Image) -> Image.Image:
    """Every drawn pixel white, its alpha kept: iOS tints it on the lock screen."""
    alpha = img.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    out = Image.new("RGBA", img.size, (255, 255, 255, 0))
    out.putalpha(alpha)
    return out


def save(img: Image.Image, path: Path):
    big = img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)
    big.save(path, format="PNG", optimize=True)


class SpriteSet:
    """Collects the sprites the widget names, then writes them in one pass (one esbuild run)."""

    def __init__(self):
        self.jobs: dict[str, dict] = {}

    def want(self, key: str, club: str | None, action: str = "idle", variant: str = "") -> str | None:
        """Ask for a sprite; returns its URL (relative to the site) or None when there is no club or no sprite folder.
        variant: '' (as drawn), 'left' (mirrored, facing the other way) or 'sil' (white silhouette)."""
        if not club or not (NFL / "index.json").exists():
            return None
        name = "-".join(x for x in (slug(key.replace(":", " ")), slug(club), "cheer" if action == "celebrate" else "",
                                    variant) if x) + ".png"
        self.jobs.setdefault(name, {"key": key, "club": club, "action": action, "variant": variant})
        return URL + name

    def write(self) -> dict[str, str | None]:
        """Writes every wanted sprite; returns {url: url or None when the site has no sprite for him}. Deletes stale
        files. The widget draws its layout without a sprite where one is missing."""
        OUT.mkdir(parents=True, exist_ok=True)
        names = sorted(self.jobs)
        result: dict[str, str | None] = {}
        written = set()
        if names:
            palettes, picks = site_rules([{k: self.jobs[n][k] for k in ("key", "club", "action")} for n in names])
            for n, pick in zip(names, picks):
                if not pick or not (NFL / pick["file"]).exists():
                    result[URL + n] = None
                    continue
                img = figure(pick, palettes)
                v = self.jobs[n]["variant"]
                if v == "left":
                    img = img.transpose(Image.FLIP_LEFT_RIGHT)  # x -> 63 - x keeps the centre line on 31.5
                elif v == "sil":
                    img = silhouette(img)
                save(img, OUT / n)
                written.add(n)
                result[URL + n] = URL + n
        for f in OUT.glob("*.png"):
            if f.name not in written:
                f.unlink()
        return result

    @staticmethod
    def stats() -> tuple[int, int]:
        files = list(OUT.glob("*.png")) if OUT.exists() else []
        return len(files), sum(f.stat().st_size for f in files)
