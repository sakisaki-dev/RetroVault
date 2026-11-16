#!/usr/bin/env python3
"""Home Screen app art for Retro Vault: the app icons and the iOS launch (splash) screens.

Original pixel art, no game or league marks: a gold pixel football with "RV" in navy, on the site's night navy with
faint scanlines (the tokens in src/index.css: --night 228 47% 7%, --gold 43 100% 62%). Everything is drawn on a grid of
whole pixels (nearest-neighbour), so it stays crisp at every size.

Writes, under public/:
  apple-touch-icon.png (180), icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png
  (the motif inside the maskable 80% safe circle), favicon-32.png, favicon.ico
  splash/launch-<w>x<h>.png: portrait launch screens for the current iPhones, listed in SPLASH below and linked from
  index.html (python3 scripts/build_app_icons.py --links prints the <link> tags).

Run: python3 scripts/build_app_icons.py   (deterministic: two runs give the same files)
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

NIGHT = (9, 13, 26)  # --night, hsl(228 47% 7%) = #090d1a; the manifest's background
NIGHT_TOP = (20, 28, 54)  # the glow behind the mark
SCAN = (7, 10, 20)
GOLD_HI = (255, 226, 130)
GOLD = (255, 201, 61)  # --gold, hsl(43 100% 62%)
GOLD_MID = (232, 167, 30)
GOLD_LO = (176, 112, 14)
INK = (5, 7, 15)  # outline
NAVY_INK = (14, 22, 48)  # the letters
CREAM = (255, 246, 222)  # the stripes
CHALK = (240, 244, 255)  # --chalk
MUTED = (150, 160, 196)

# ---- the mark: a 24 x 16 pixel football, pointed ends, "RV" across it ----
BALL_W, BALL_H = 24, 16
GLYPHS_SMALL = {
    "R": ["1110", "1001", "1110", "1010", "1001"],
    "V": ["10001", "10001", "01010", "01010", "00100"],
}


def ball_mask() -> list[list[bool]]:
    cx, half_w, half_h = BALL_W / 2, BALL_W / 2, BALL_H / 2
    rows = []
    for y in range(BALL_H):
        row = []
        for x in range(BALL_W):
            dx = (x + 0.5 - cx) / half_w
            h = half_h * max(0.0, 1 - dx * dx) ** 0.9
            row.append(abs(y + 0.5 - BALL_H / 2) <= h)
        rows.append(row)
    return rows


def ball_pixels() -> dict[tuple[int, int], tuple[int, int, int]]:
    """(x, y) -> colour for every painted cell of the mark."""
    m = ball_mask()
    inside = lambda x, y: 0 <= x < BALL_W and 0 <= y < BALL_H and m[y][x]
    px: dict[tuple[int, int], tuple[int, int, int]] = {}
    for y in range(BALL_H):
        for x in range(BALL_W):
            if not m[y][x]:
                continue
            edge = not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                px[(x, y)] = INK
                continue
            t = y / (BALL_H - 1)
            px[(x, y)] = GOLD_HI if t < 0.25 else GOLD if t < 0.6 else GOLD_MID if t < 0.8 else GOLD_LO
    # the two stripes near the tips
    for sx in (3, BALL_W - 4):
        for y in range(BALL_H):
            if (sx, y) in px and px[(sx, y)] != INK:
                px[(sx, y)] = CREAM
    # "RV" in navy, centred
    r, v = FONT["R"], FONT["V"]
    w = len(r[0]) + 1 + len(v[0])
    x0, y0 = (BALL_W - w) // 2, (BALL_H - len(r)) // 2
    for gi, (glyph, gx) in enumerate(((r, x0), (v, x0 + len(r[0]) + 1))):
        for yy, line in enumerate(glyph):
            for xx, c in enumerate(line):
                if c == "1":
                    px[(gx + xx, y0 + yy)] = NAVY_INK
    # a highlight glint on the upper left
    for x, y in ((6, 2), (7, 2), (8, 2), (5, 3)):
        if px.get((x, y)) not in (None, INK):
            px[(x, y)] = (255, 244, 200)
    return px




def paint_background(img: Image.Image, cell: int, glow_center: tuple[float, float], glow_r: float) -> None:
    """Night navy, a soft glow behind the mark (stepped, so it stays pixel art), scanlines every other cell row."""
    w, h = img.size
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, h], fill=NIGHT)
    gx, gy = glow_center
    steps = 6
    for i in range(steps, 0, -1):
        f = i / steps
        rr = glow_r * f
        mix = (1 - f) ** 1.3
        col = tuple(round(NIGHT[k] + (NIGHT_TOP[k] - NIGHT[k]) * mix) for k in range(3))
        # snap the ellipse to whole cells
        x0 = round((gx - rr) / cell) * cell
        x1 = round((gx + rr) / cell) * cell
        y0 = round((gy - rr * 0.8) / cell) * cell
        y1 = round((gy + rr * 0.8) / cell) * cell
        d.ellipse([x0, y0, x1, y1], fill=col)
    # scanlines: one dark row of cells every 2 cells, faint
    for y in range(0, h, cell * 2):
        line = Image.new("RGB", (w, cell), SCAN)
        img.paste(Image.blend(img.crop((0, y, w, y + cell)), line, 0.35), (0, y))


def paint_mark(img: Image.Image, cell: int, left: int, top: int, shadow: bool = True) -> None:
    d = ImageDraw.Draw(img)
    if shadow:
        # a flat shadow under the ball, two cells down
        sw = BALL_W - 6
        sx = left + 3 * cell
        sy = top + (BALL_H + 1) * cell
        d.rectangle([sx, sy, sx + sw * cell - 1, sy + cell - 1], fill=SCAN)
        d.rectangle([sx + 2 * cell, sy + cell, sx + (sw - 2) * cell - 1, sy + 2 * cell - 1], fill=SCAN)
    for (x, y), col in BALL.items():
        d.rectangle([left + x * cell, top + y * cell, left + (x + 1) * cell - 1, top + (y + 1) * cell - 1], fill=col)


def icon(size: int, motif_share: float) -> Image.Image:
    """A square icon; the mark spans motif_share of the width (whole-pixel cells, centred)."""
    cell = max(1, int(size * motif_share / BALL_W))
    img = Image.new("RGB", (size, size), NIGHT)
    paint_background(img, max(1, cell // 2) if size < 64 else cell, (size / 2, size / 2), size * 0.62)
    mw, mh = BALL_W * cell, (BALL_H + 2) * cell
    paint_mark(img, cell, (size - mw) // 2, (size - mh) // 2 + cell // 2, shadow=size >= 64)
    return img


# ---- a 5 x 7 pixel font for the splash wordmark ----
FONT = {
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "·": ["00000", "00000", "00000", "00100", "00000", "00000", "00000"],
    " ": ["000", "000", "000", "000", "000", "000", "000"],
}


BALL = ball_pixels()


def text_width(s: str) -> int:
    return sum(len(FONT[c][0]) for c in s) + max(0, len(s) - 1)


def paint_text(img: Image.Image, s: str, cell: int, left: int, top: int, colours, shadow=True) -> None:
    """colours: one colour, or a function index -> colour (per character)."""
    d = ImageDraw.Draw(img)
    x = left
    for i, c in enumerate(s):
        g = FONT[c]
        col = colours(i) if callable(colours) else colours
        for yy, line in enumerate(g):
            for xx, bit in enumerate(line):
                if bit != "1":
                    continue
                px, py = x + xx * cell, top + yy * cell
                if shadow:
                    d.rectangle([px + cell, py + cell, px + 2 * cell - 1, py + 2 * cell - 1], fill=INK)
                d.rectangle([px, py, px + cell - 1, py + cell - 1], fill=col)
        x += (len(g[0]) + 1) * cell


# Portrait launch screens: (CSS width, CSS height, device pixel ratio) for the current iPhones (iOS matches the
# media query on the CSS size and ratio, so one file serves every model of that size).
SPLASH = [
    (440, 956, 3),  # iPhone 17 Pro Max, 16 Pro Max
    (402, 874, 3),  # iPhone 17, 17 Pro, 16 Pro
    (420, 912, 3),  # iPhone Air
    (430, 932, 3),  # iPhone 16 Plus, 15 Plus, 15 Pro Max, 14 Pro Max
    (393, 852, 3),  # iPhone 16, 15, 15 Pro, 14 Pro
    (428, 926, 3),  # iPhone 14 Plus, 13 Pro Max, 12 Pro Max
    (390, 844, 3),  # iPhone 16e, 14, 13, 13 Pro, 12, 12 Pro
    (375, 812, 3),  # iPhone 13 mini, 12 mini, 11 Pro, XS, X
    (414, 896, 3),  # iPhone 11 Pro Max, XS Max
    (414, 896, 2),  # iPhone 11, XR
    (375, 667, 2),  # iPhone SE (2nd, 3rd), 8
]


def splash(w_css: int, h_css: int, dpr: int) -> Image.Image:
    w, h = w_css * dpr, h_css * dpr
    img = Image.new("RGB", (w, h), NIGHT)
    cell = max(2, round(w * 0.42 / BALL_W))
    cy = int(h * 0.44)
    paint_background(img, cell, (w / 2, cy), w * 0.55)
    mw, mh = BALL_W * cell, (BALL_H + 2) * cell
    paint_mark(img, cell, (w - mw) // 2, cy - mh // 2)
    # wordmark: RETRO in chalk, VAULT in gold
    word = "RETRO VAULT"
    tc = max(2, round(w * 0.72 / text_width(word)))
    tw = text_width(word) * tc
    ty = cy + mh // 2 + cell * 3
    paint_text(img, word, tc, (w - tw) // 2, ty, lambda i: CHALK if i < 5 else GOLD)
    # tagline, small and muted
    tag = "LEAGUE HUB"
    sc = max(2, tc // 2)
    sw = text_width(tag) * sc
    paint_text(img, tag, sc, (w - sw) // 2, ty + 7 * tc + tc * 3, MUTED, shadow=False)
    return img


def splash_name(w_css: int, h_css: int, dpr: int) -> str:
    return f"splash/launch-{w_css * dpr}x{h_css * dpr}.png"


def links() -> str:
    out = []
    for w, h, dpr in SPLASH:
        media = (
            f"(device-width: {w}px) and (device-height: {h}px) and (-webkit-device-pixel-ratio: {dpr}) and (orientation: portrait)"
        )
        out.append(f'    <link rel="apple-touch-startup-image" media="{media}" href="%BASE_URL%{splash_name(w, h, dpr)}" />')
    return "\n".join(out)


def save(img: Image.Image, rel: str) -> None:
    path = PUBLIC / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print(f"  {rel} {img.size[0]}x{img.size[1]}")


def main() -> None:
    if "--links" in sys.argv:
        print(links())
        return
    print("Icons:")
    save(icon(180, 0.74), "apple-touch-icon.png")
    save(icon(192, 0.74), "icon-192.png")
    save(icon(512, 0.74), "icon-512.png")
    # maskable: everything that matters inside the centre circle of radius 40%
    save(icon(192, 0.56), "icon-maskable-192.png")
    save(icon(512, 0.56), "icon-maskable-512.png")
    fav = icon(32, 0.94)
    save(fav, "favicon-32.png")
    ico = icon(64, 0.94)
    ico.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  favicon.ico 16/32/48")
    print("Splash screens:")
    for w, h, dpr in SPLASH:
        save(splash(w, h, dpr), splash_name(w, h, dpr))


if __name__ == "__main__":
    main()
