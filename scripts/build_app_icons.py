#!/usr/bin/env python3
"""Home Screen app art for Retro Vault: the app icons and the iOS launch (splash) screens.

* Icon ("Kickoff"): commit 21fcb29's chunky brown pixel football (kept cell for cell) in front of a stadium in bands:
  a golden-hour sky with the sun on the horizon, navy stands dotted with gold, the red wall and the grass. Owner: "its a
  fun football website it doesn't need to be ornate it needs to be colorful memorable and representative".
* Splash: a game title screen (owner: "use the stadium as the background I did like that"; the game's own title screen
  as the model, "saying 'all time great' the pixel fonts etc etc don't seem professional"): the golden-hour sky with
  clouds and the sun low in the bowl, the stands in royal navy with the game's crowd, the football on a red plinth, a
  bevelled RETRO VAULT wordmark (chrome RETRO, gold VAULT, a dark outline and a red drop edge, our own block letters),
  the all-time greats across the field (Greats below) and the head coach, Dorren Skura, seen from behind at the bottom
  (his own sprite turned around, from_behind). No small labels.

Every image is drawn on a grid of whole art pixels and blown up by a whole number with nearest-neighbour, so nothing
is ever blurry. The greats come from the data (public/data/league/halloffame.json, the banner clubs from
public/data/player-extras.json, club colours from src/utils/nflTeams.ts, the kit and pose by the site's own sprite
rules through scripts/widget_sprites.py; the coach's club from data/y80/coach.json currentStint), so `npm run rebuild`
runs this and the splash follows the Hall of Fame. Deterministic: two runs give the same bytes.

Writes, under public/:
  apple-touch-icon.png (180), icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png
  (32 cells: the ball sits inside the maskable 80% safe circle), favicon-32.png, favicon.ico (16/32/48)
  splash/launch-<w>x<h>.png: portrait launch screens for the current iPhones, listed in SPLASH below and linked from
  index.html (python3 scripts/build_app_icons.py --links prints the <link> tags).

Run: python3 scripts/build_app_icons.py [--icons | --splash] [--links]
"""
from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
FIELD = PUBLIC / "private-sprites" / "field"
NFL = PUBLIC / "private-sprites" / "nfl"
sys.path.insert(0, str(Path(__file__).resolve().parent))

RGB = tuple[int, int, int]


def hexc(h: str) -> RGB:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def mix(a: RGB, b: RGB, t: float) -> RGB:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


# site tokens (src/index.css)
NIGHT = hexc("090d1a")
GOLD_HI = hexc("ffe7a0")
GOLD = hexc("ffc93d")
GOLD_MID = hexc("eaa21e")
GOLD_LO = hexc("b5700e")
GOLD_DEEP = hexc("6e3d06")
CHALK = hexc("f0f4ff")
CHALK_LO = hexc("b9c3e6")
MUTED = hexc("9aa6cc")
INK = hexc("05070f")

# 4 x 4 ordered dither thresholds (0..1)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=float) / 16 + 1 / 32


def up(img: Image.Image, k: int) -> Image.Image:
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def paste(dst: Image.Image, src: Image.Image, x: int, y: int) -> None:
    """Alpha-blend an RGBA sprite onto the canvas at whole art pixels (clipped at the edges)."""
    dst.paste(src, (int(x), int(y)), src)


# =====================================================================================================================
# The icon. The ball is commit 21fcb29's brown pixel football (owner: "i like the old icon we had it was simple
# pixelated and fun"), kept cell for cell below (ICON_GRID, its original 24 x 24 icon on green stripes). Owner, later:
# "take inspo for the app icon as well, its a fun football website it doesn't need to be ornate it needs to be colorful
# memorable and representative": the "Kickoff" design puts that ball in front of the launch screen's stadium in bands
# (a golden-hour sky with the sun, navy stands with gold crowd dots, the red wall, the grass).
# =====================================================================================================================
ICON_PALETTE = {
    "a": (24, 104, 54),    # turf, light stripe
    "b": (20, 92, 48),     # turf, dark stripe
    "c": (28, 18, 12),     # outline
    "d": (140, 74, 38),    # leather
    "e": (245, 242, 232),  # stripes and laces
    "f": (104, 52, 26),    # leather shade
}
ICON_GRID = [
    "aaaaaaaaaaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaa",
    "bbbbbbbbbbbbbbbbbbbbbbbb",
    "bbbbbbbbbbccccbbbbbbbbbb",
    "bbbbbbbcccddddcccbbbbbbb",
    "aaaaaccddddddddddccaaaaa",
    "aaaacddeddddddddeddcaaaa",
    "aaacdddeddddddddedddcaaa",
    "bbbcdddeddededededddcbbb",
    "bbcddddedeeeeeededdddcbb",
    "bbcddddeddededededdddcbb",
    "aacddddeddddddddeddddcaa",
    "aaacdddeddddddddedddcaaa",
    "aaacffdeddddddddedffcaaa",
    "bbbbcffffddddddffffcbbbb",
    "bbbbbccffffffffffccbbbbb",
    "bbbbbbbcccffffcccbbbbbbb",
    "aaaaaaaaaaccccaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaa",
    "bbbbbbbbbbbbbbbbbbbbbbbb",
    "bbbbbbbbbbbbbbbbbbbbbbbb",
    "bbbbbbbbbbbbbbbbbbbbbbbb",
]


def ball_mark() -> Image.Image:
    """The ball alone (no turf), 20 x 15 RGBA: the icon's and the launch screens' football."""
    img = Image.new("RGBA", (20, 15), (0, 0, 0, 0))
    for y in range(15):
        for x in range(20):
            c = ICON_GRID[y + 4][x + 2]
            if c not in "ab":
                img.putpixel((x, y), (*ICON_PALETTE[c], 255))
    return img


KICKOFF_SKY = [hexc(c) for c in ("2f63d8", "5a8ce9", "9db3ee", "f2b8a4", "ffc98a", "ffdb7a")]
ICON_GRASS = (hexc("3fae3a"), hexc("33942e"))


def icon_design(pad: int = 4) -> Image.Image:
    """The Kickoff icon on its 24-cell design, with pad cells of bleed a side (the bands run on): sky rows 0-8 with the
    sun on the horizon, stands 9-13 (navy, a dark rim, two rows of gold and white crowd dots), the red wall 14, a chalk
    sideline 15, the grass in 3-row stripes; the ball (cells 2-21) two rows lower than in the original, its shadow."""
    n = 24 + 2 * pad
    a = np.zeros((n, n, 3), np.uint8)
    for y in range(pad + 9):
        a[y] = KICKOFF_SKY[min(5, max(0, (y - pad) * 6 // 9))]
        for x in range(n):
            d = math.hypot(x + 0.5 - n / 2, y + 0.5 - (pad + 9))
            if d <= 7.5:
                a[y, x] = hexc("fff1b8") if d <= 5 else hexc("ffcf55")
    a[pad + 9:pad + 14] = hexc("1f3a9e")
    a[pad + 9] = hexc("0f1c55")
    for y in (pad + 10, pad + 12):
        for x in range((y // 2) % 2, n, 2):
            a[y, x] = GOLD if (x * 5 + y) % 3 else hexc("f4f4fa")
    a[pad + 14] = hexc("e8364a")
    for y in range(pad + 15, n):
        a[y] = ICON_GRASS[((y - pad) // 3) % 2]
    a[pad + 15] = hexc("f4f7ee")
    sy = pad + 21
    for r, x0, x1, k in ((0, 6, 18, 0.62), (1, 8, 16, 0.7)):
        a[sy + r, pad + x0:pad + x1] = (a[sy + r, pad + x0:pad + x1] * k).astype(np.uint8)
    bm = np.array(ball_mark())
    m = bm[..., 3] > 0
    a[pad + 6:pad + 21, pad + 2:pad + 22][m] = bm[..., :3][m]
    return Image.fromarray(a, "RGB")


def icon(size: int) -> Image.Image:
    """size px at a whole number of pixels a cell: the 24-cell design blown up by ceil(size / 24), the bleed cropped."""
    k = math.ceil(size / 24)
    big = up(icon_design(4), k)
    off = (big.width - size) // 2
    return big.crop((off, off, off + size, off + size))


def icon_maskable(size: int) -> Image.Image:
    """The maskable icon: 32 cells (the design plus 4 of bleed a side), so the ball sits well inside the 80% circle."""
    k = math.ceil(size / 32)
    big = up(icon_design(4), k)
    off = (big.width - size) // 2
    return big.crop((off, off, off + size, off + size))


# =====================================================================================================================
# Launch screens: a game title screen (owner: "use the stadium as the background I did like that"; the game's own
# title screen as the reference): a golden-hour sky with the sun low behind the bowl, the stands in one strong colour
# with a dotted crowd, the pixel football on a plinth at the centre, a bevelled metallic RETRO VAULT wordmark, the
# all-time greats lined up across the field and the head coach seen from behind at the bottom. No small labels.
# =====================================================================================================================
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

KEY_PRIMARY, KEY_SECONDARY, KEY_TRIM = hexc("00ff00"), hexc("ff00ff"), hexc("00ffff")
HOF = PUBLIC / "data" / "league" / "halloffame.json"
EXTRAS = PUBLIC / "data" / "player-extras.json"
TEAMS_TS = ROOT / "src" / "utils" / "nflTeams.ts"
COACH = ROOT / "data" / "y80" / "coach.json"
GREATS = 11  # figures on the field: the best Hall of Famer at each position, then the next best, the best first

# the palette: a golden-hour sky, royal navy stands with a gold rail, the site's flag red under the wordmark
SKY = [(0.0, hexc("2f63d8")), (0.38, hexc("6b9cf0")), (0.66, hexc("c9b4e6")), (0.84, hexc("ffb784")),
       (1.0, hexc("ffd977"))]
SUN, SUN_HI, SUN_CORE = hexc("ffc44d"), hexc("ffe38f"), hexc("fff6d6")
CLOUD = [hexc("ffffff"), hexc("f3ecff"), hexc("dccdf2"), hexc("c3a9dc")]
STAND, STAND_LO, STAND_HI = hexc("1f3a9e"), hexc("142770"), hexc("3657c4")
FASCIA = hexc("0f1c55")
RED, RED_LO = hexc("e8364a"), hexc("8e1426")
OUTLINE_INK = hexc("0b1030")
TURF_A, TURF_B = hexc("3f9a2c"), hexc("358a24")
SILVER = [hexc(c) for c in ("ffffff", "f2f5fb", "dfe5f0", "b9c3d6", "8e9bb5", "c9d1e2", "eef1f8")]
GOLDS = [hexc(c) for c in ("fff3c4", "ffe07a", "ffc93d", "f0a91f", "c97c0c", "f5b52e", "ffe08a")]

# the wordmark's letters: our own chunky block caps, 7 x 9 cells, 2-cell strokes (the T's stem 3)
LETTERS = {
    "R": ["1111110", "1111111", "1100011", "1100011", "1111111", "1111110", "1101110", "1100111", "1100011"],
    "E": ["1111111", "1111111", "1100000", "1111110", "1111110", "1100000", "1100000", "1111111", "1111111"],
    "T": ["1111111", "1111111", "0011100", "0011100", "0011100", "0011100", "0011100", "0011100", "0011100"],
    "O": ["0111110", "1111111", "1100011", "1100011", "1100011", "1100011", "1100011", "1111111", "0111110"],
    "V": ["1100011", "1100011", "1100011", "1100011", "1110111", "0110110", "0111110", "0011100", "0011100"],
    "A": ["0011100", "0111110", "1110111", "1100011", "1100011", "1111111", "1111111", "1100011", "1100011"],
    "U": ["1100011", "1100011", "1100011", "1100011", "1100011", "1100011", "1100011", "1111111", "0111110"],
    "L": ["1100000", "1100000", "1100000", "1100000", "1100000", "1100000", "1100000", "1111111", "1111111"],
}


def hsl(spec: str) -> RGB:
    import colorsys
    h, s, l = (float(p.rstrip("%")) for p in spec.split())
    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
    return round(r * 255), round(g * 255), round(b * 255)


def club_table() -> dict[str, dict]:
    """The site's club table (src/utils/nflTeams.ts): abbreviation and brand colours per club name."""
    out = {}
    if not TEAMS_TS.exists():
        return out
    import re
    for m in re.finditer(r"name: '([^']+)'.*?abbreviation: '([^']+)'.*?primaryColor: '([^']+)', secondaryColor: '([^']+)'",
                         TEAMS_TS.read_text()):
        out[m.group(1)] = {"abbr": m.group(2), "primary": hsl(m.group(3)), "secondary": hsl(m.group(4))}
    return out


def lum(c) -> float:
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


class Greats:
    """The league's all-time greats, by rule: the best Hall of Famer at each position (Hall of Fame Score, then Career
    Legacy, then key; public/data/league/halloffame.json), the best of those first, then the next best Hall of Famers
    to fill the line, GREATS in all. Each wears his banner club's kit (player-extras.json signatureTeams: where he was
    best known), drawn by the site's own sprite rules (scripts/widget_sprites.py site_rules / figure). The first is the
    greatest: front and centre, celebrating. Also the head coach (his own sprite in his current club's polo)."""

    def __init__(self) -> None:
        self.people: list[dict] = []  # {key, name, club, primary, secondary, fig}
        self.coach: Image.Image | None = None
        self.load()

    def load(self) -> None:
        if not HOF.exists():
            return
        hof = json.loads(HOF.read_text())
        extras = json.loads(EXTRAS.read_text()) if EXTRAS.exists() else {}
        order = sorted(hof.get("members", []), key=lambda m: (-m["score"], -m["careerLegacy"], m["key"]))
        best: dict[str, dict] = {}
        for m in order:
            best.setdefault(m["pos"], m)
        picked = sorted(best.values(), key=lambda m: (-m["score"], -m["careerLegacy"], m["key"]))
        picked += [m for m in order if m not in picked]
        clubs = club_table()
        for m in picked[:GREATS]:
            full = (extras.get("signatureTeams") or {}).get(m["name"])
            club = full.split()[-1] if full else None
            info = clubs.get(club or "", {})
            self.people.append({"key": m["key"], "name": m["name"], "club": club,
                                "primary": info.get("primary", hexc("1d2a57")),
                                "secondary": info.get("secondary", GOLD), "fig": None})
        if not (NFL / "index.json").exists() or not self.people:
            return
        import widget_sprites as WS  # the site's sprite picks and kit palettes, the GameSprite painter

        jobs = [{"key": p["key"], "club": p["club"], "action": "celebrate" if i == 0 else "idle"}
                for i, p in enumerate(self.people)]
        palettes, picks = WS.site_rules(jobs)
        for p, pick in zip(self.people, picks):
            if pick and (NFL / pick["file"]).exists():
                p["fig"] = WS.figure(pick, palettes)
        self.coach = coach_sprite()


def coach_sprite() -> tuple[Image.Image, np.ndarray] | None:
    """The head coach's own standing sprite in his current club's polo (the white neutral if the save drew none), and
    his outfit mask (index.json coaches.head.mask: the polo and trousers)."""
    idx = json.loads((NFL / "index.json").read_text())
    head = (idx.get("coaches") or {}).get("head")
    if not head:
        return None
    club = json.loads(COACH.read_text()).get("currentStint", {}).get("team") if COACH.exists() else None
    f = (head.get("kits") or {}).get(club or "") or head.get("neutral")
    if not f or not (NFL / f).exists():
        return None
    mask = np.array([[(int(row, 16) >> (63 - x)) & 1 for x in range(64)] for row in head.get("mask", [])], bool)
    if mask.shape != (64, 64):
        mask = np.zeros((64, 64), bool)
    return Image.open(NFL / f).convert("RGBA"), mask


def from_behind(img: Image.Image, outfit: np.ndarray) -> Image.Image:
    """The coach seen from behind, made from his own front sprite (the game draws no back view): the same silhouette;
    the head becomes the back of his head (his crown in his skin tone, the hair he has at the sides and back from his
    own sprite's darkest head colours, the nape of the neck), and the polo loses its open collar. Only his own colours."""
    a = np.array(img).astype(int)
    alpha = a[..., 3] > 200
    rows = np.where(alpha.any(axis=1))[0]
    if not len(rows):
        return img
    top = rows[0]
    shirt = int(np.where(outfit.any(axis=1))[0][0]) if outfit.any() else top + 15
    head = alpha & ~outfit
    head[shirt + 3:] = False
    # his colours: skin = the commonest head colour, hair = the darkest head colours on his top rows
    cols = [tuple(a[y, x, :3]) for y, x in zip(*np.where(head))]
    from collections import Counter
    skin = Counter(cols).most_common(1)[0][0]
    top_cols = sorted({tuple(a[top + k, x, :3]) for k in range(2) for x in np.where(alpha[top + k])[0]}, key=lum)
    hair_edge = top_cols[0]
    hair_lo = top_cols[min(1, len(top_cols) - 1)]
    hair = top_cols[min(2, len(top_cols) - 1)]
    skin_lo = tuple(max(0, v - 40) for v in skin)
    out = a.copy()
    widest = max(range(top, shirt), key=lambda y: (head[y].sum(), -y))
    nape = top + round((shirt - top) * 0.78)  # the hairline at the back of the neck
    for y in range(top, shirt + 3):
        xs = np.where(head[y])[0]
        if not len(xs):
            continue
        x0, x1 = xs[0], xs[-1]
        for x in xs:
            edge = x in (x0, x1)
            if y >= nape:
                c = skin_lo if edge else skin  # the nape of the neck
            elif abs(y - widest) <= 1 and (x == x0 or x == x1):
                c = skin  # his ears
            elif y == top or edge:
                c = hair_edge
            elif y <= top + 2 and x0 + 2 <= x <= x0 + 4:
                c = hair  # the light on his crown
            else:
                c = hair_lo if (x in (x0 + 1, x1 - 1) or y >= nape - 1) else hair
            out[y, x, :3] = c
    # the polo's back: the open collar (skin and its dark edges at the middle of the first rows) closed in the polo's
    # own colour, its top row a shade darker for the collar's back
    ys, xs_ = np.where(outfit[shirt + 4:shirt + 10])
    body = Counter(tuple(a[y + shirt + 4, x, :3]) for y, x in zip(ys, xs_)).most_common(1)[0][0]
    collar = tuple(max(0, v - 22) for v in body)
    for y in range(shirt, shirt + 4):
        for x in np.where(alpha[y])[0]:
            if abs(x + 0.5 - a.shape[1] / 2) < 4:
                out[y, x, :3] = collar if y == shirt else body
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA")


def recolour(img: Image.Image, cols: tuple[RGB, RGB, RGB], light: float = 1.0) -> np.ndarray:
    """The game's key colours (green primary, magenta secondary, cyan trim) into cols, everything times light."""
    a = np.array(img.convert("RGB")).astype(float)
    for key, to in zip((KEY_PRIMARY, KEY_SECONDARY, KEY_TRIM), cols):
        a[np.all(a == key, axis=-1)] = to
    return a * light


def stepped(f: np.ndarray, levels: int, yy: np.ndarray, xx: np.ndarray) -> np.ndarray:
    """A smooth 0..1 field quantised to whole steps, ordered-dithered at each step's edge (stays pixel art)."""
    return np.floor(f * levels + BAYER[yy % 4, xx % 4] - 0.5).clip(0, levels) / levels


def glow(arr: np.ndarray, cx: float, cy: float, rx: float, ry: float, colour, amount: float, levels: int = 5,
         rows: tuple[int, int] | None = None) -> None:
    """Additive stepped light: an elliptical pool of colour, strongest at the centre."""
    h, w = arr.shape[:2]
    y0, y1 = rows or (0, h)
    y0, y1 = max(0, int(cy - ry - 1), y0), min(h, int(cy + ry + 2), y1)
    x0, x1 = max(0, int(cx - rx - 1)), min(w, int(cx + rx + 2))
    if y0 >= y1 or x0 >= x1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d = np.hypot((xx + 0.5 - cx) / rx, (yy + 0.5 - cy) / ry)
    f = stepped(np.clip(1 - d, 0, 1) ** 1.5, levels, yy, xx) * amount
    arr[y0:y1, x0:x1] += f[..., None] * np.array(colour, float)


def ramp(stops: list[tuple[float, RGB]], t: float) -> RGB:
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            return mix(c0, c1, (t - t0) / max(1e-9, t1 - t0))
    return stops[-1][1]


def dilate(m: np.ndarray, r: int) -> np.ndarray:
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + r:
                out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def enclosed(m: np.ndarray) -> np.ndarray:
    """The pixels outside m that the background can't reach from the edges (counters, closed-in gaps)."""
    outside = np.zeros_like(m)
    outside[0, :] = outside[-1, :] = True
    outside[:, 0] = outside[:, -1] = True
    outside &= ~m
    while True:  # flood the background in from the edges
        grown = outside.copy()
        grown[1:] |= outside[:-1]
        grown[:-1] |= outside[1:]
        grown[:, 1:] |= outside[:, :-1]
        grown[:, :-1] |= outside[:, 1:]
        grown &= ~m
        if (grown == outside).all():
            return ~m & ~outside
        outside = grown


def wordmark(cell: int) -> tuple[np.ndarray, np.ndarray]:
    """RETRO over VAULT in bevelled metal: RETRO chrome, VAULT gold, each with a dark outline and a red drop edge.
    Returns (rgb, alpha) on its own grid."""
    lines = ("RETRO", "VAULT")
    gap_x, gap_y = cell, 2 * cell
    lw = 7 * cell * 5 + gap_x * 4
    lh = 9 * cell
    ol, drop = max(2, cell // 2 + 1), max(3, cell)  # outline and the drop edge, in art pixels
    pad = ol + 1
    W, H = lw + 2 * pad + drop, 2 * lh + gap_y + 2 * pad + drop
    face = np.zeros((H, W), bool)
    which = np.zeros((H, W), int)
    for li, word in enumerate(lines):
        y0 = pad + li * (lh + gap_y)
        for ci, ch in enumerate(word):
            x0 = pad + ci * (7 * cell + gap_x)
            for gy, row in enumerate(LETTERS[ch]):
                for gx, v in enumerate(row):
                    if v == "1":
                        face[y0 + gy * cell:y0 + (gy + 1) * cell, x0 + gx * cell:x0 + (gx + 1) * cell] = True
                        which[y0 + gy * cell:y0 + (gy + 1) * cell, x0 + gx * cell:x0 + (gx + 1) * cell] = li
    body = face.copy()
    for d in range(1, drop + 1):  # the extrusion: straight down
        body |= np.roll(face, d, 0)
    edge_only = body & ~face
    outline = dilate(body, ol) & ~body
    rgb = np.zeros((H, W, 3))
    rgb[outline] = OUTLINE_INK
    # the drop edge: red, darker at its foot, a lit line where it meets the face
    for y in range(H):
        row = edge_only[y]
        if row.any():
            under = np.zeros(W, bool)
            for d in range(1, drop + 1):
                if y - d >= 0:
                    under |= face[y - d]
            k = 0
            while k < drop and y - k - 1 >= 0 and edge_only[y - k - 1].any():
                k += 1
            rgb[y, row] = RED if k < drop - 1 else RED_LO
    # the face: a chrome / gold ramp by height within the line, plus a bevel (lit top-left, shaded bottom-right)
    for li, ramp_cols in enumerate((SILVER, GOLDS)):
        y0 = pad + li * (lh + gap_y)
        for y in range(y0, y0 + lh):
            t = (y - y0) / max(1, lh - 1)
            i = 0 if t < 0.12 else 1 if t < 0.3 else 2 if t < 0.46 else 3 if t < 0.52 else 4 if t < 0.6 else 5 if t < 0.82 else 6
            m = face[y] & (which[y] == li)
            rgb[y, m] = ramp_cols[i]
        m_line = np.zeros_like(face)
        m_line[y0:y0 + lh] = face[y0:y0 + lh]
        lit = m_line & ~np.roll(m_line, 1, 0) | m_line & ~np.roll(m_line, 1, 1)
        shade = m_line & ~np.roll(m_line, -1, 0) | m_line & ~np.roll(m_line, -1, 1)
        rgb[lit] = np.clip(rgb[lit] * 0.4 + np.array((255, 255, 255)) * 0.6, 0, 255)
        rgb[shade & ~lit] = rgb[shade & ~lit] * 0.72
    alpha = outline | body
    # the counters and the gaps the outline closes in: ink, so only the metal and its edge read
    # (the face and its outline, without the drop edge, decide what is enclosed: the counters stay clean ink)
    solid = face | dilate(face, ol)
    holes = enclosed(solid)
    rgb[holes] = OUTLINE_INK
    alpha |= holes
    # the narrow gaps between neighbouring letters: closed with ink too, so each line reads as one sign
    k = 5 * cell + 2
    left = np.zeros_like(alpha)
    right = np.zeros_like(alpha)
    for d in range(1, k + 1):
        left[:, d:] |= alpha[:, :-d]
        right[:, :-d] |= alpha[:, d:]
    bridge = ~alpha & left & right
    up_, down = np.zeros_like(alpha), np.zeros_like(alpha)
    for d in range(1, 2 * cell + 1):
        up_[d:] |= alpha[:-d]
        down[:-d] |= alpha[d:]
    bridge |= ~alpha & up_ & down & left  # and the slots left between the two lines
    alpha |= bridge
    bridge |= enclosed(alpha)  # and whatever that closed in
    rgb[bridge] = OUTLINE_INK
    return rgb, alpha | bridge


def cloud(arr: np.ndarray, rng: random.Random, cx: int, cy: int, w: int, light: float) -> None:
    """A puffy pixel cloud: overlapping round puffs, white on top, violet-grey underneath, flat bottom."""
    h, aw = arr.shape[:2]
    puffs = []
    n = max(3, w // 9)
    for i in range(n):
        px = cx - w / 2 + (i + 0.5) * w / n + rng.uniform(-2, 2)
        r = w / n * rng.uniform(0.75, 1.15) * (1.25 if 0 < i < n - 1 else 0.85)
        puffs.append((px, cy - r * 0.35, r))
    flat = cy + 2
    y0, y1 = max(0, int(cy - w)), min(h, flat + 1)
    for y in range(y0, y1):
        for x in range(max(0, int(cx - w)), min(aw, int(cx + w))):
            best = None
            for px, py, r in puffs:
                d = math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.1) / r
                if d <= 1 and (best is None or d < best[0]):
                    best = (d, (y + 0.5 - py) / r)
            if best is None:
                continue
            under = (y - (cy - w * 0.12)) / (w * 0.25)
            k = best[1] + under * 0.8 + 0.25 * BAYER[y % 4, x % 4]
            c = CLOUD[0] if k < 0.0 else CLOUD[1] if k < 0.45 else CLOUD[2] if k < 0.95 else CLOUD[3]
            arr[y, x] = arr[y, x] * (1 - light) + np.array(c) * light


def splash_art(aw: int, ah: int, top: int, bottom: int, G: Greats) -> Image.Image:
    """The scene on an aw x ah art grid; top / bottom: the art rows the status bar and home indicator cover."""
    rng = random.Random(f"{'|'.join(p['key'] for p in G.people)}{aw}x{ah}")
    arr = np.zeros((ah, aw, 3), float)
    cxm = aw / 2
    short = ah < 480  # iPhone SE (16:9): a tighter stack
    xs = np.arange(aw)

    # ---- the stack, top down: the rim of the bowl, the football on its plinth, the wordmark across the sideline,
    # the line-up, the coach nearest the camera ----
    cell = 6 if not short else 5  # the wordmark's cell: as big as fits with a margin
    while cell > 2 and 39 * cell + 2 * (cell // 2 + 2) + cell > aw - 20:
        cell -= 1
    wm_rgb, wm_a = wordmark(cell)
    cb = 4 if not short else 3  # the football's cell
    ball_h, ball_w = 15 * cb, 20 * cb
    # a taller screen than the stack needs: half the slack goes to the sky, half between the wordmark and the players
    coach_k = 4
    coach_top = ah - (42 - 13) * coach_k  # the coach shows from his crown (sprite row 13) to his belt (row 42)
    need = top + round(ah * 0.13) + (22 if not short else 12) + 15 * (4 if not short else 3) + 2 + wm_a.shape[0] + \
        (100 if not short else 96) + (16 if not short else 13) + (14 if not short else 8)
    lift_down = max(0, coach_top - need) // 2
    rim_mid = top + round(ah * 0.13) + lift_down  # the bowl's rim at the middle (its lowest point)
    rim_dip = round(aw * 0.09)  # how much higher the rim stands at the sides
    ball_y = rim_mid + (22 if not short else 12)
    word_y = ball_y + ball_h + 2
    horizon = word_y + round(wm_a.shape[0] * 0.72)  # the far sideline: the stands end, the field begins
    # the coach is cut at the waist by the bottom edge; the line-up stands just above his head, never into the wordmark
    front_feet = max(word_y + wm_a.shape[0] + (100 if not short else 96) + (16 if not short else 13),
                     coach_top - (14 if not short else 8))
    back_feet = front_feet - (16 if not short else 13)

    # ---- sky: golden hour, stepped and dithered ----
    sky_h = horizon
    for y in range(sky_h):
        t = y / max(1, rim_mid + 10)
        t = min(1.0, t)
        lo = ramp(SKY, math.floor(t * 14) / 14)
        hi = ramp(SKY, min(1, math.floor(t * 14 + 1) / 14))
        frac = t * 14 - math.floor(t * 14)
        arr[y] = np.where((frac > BAYER[y % 4, xs % 4] + 0.25)[:, None], np.array(hi), np.array(lo))
    # the sun: low behind the middle of the bowl, a stepped halo
    sun_r = round(aw * 0.15)
    sun_y = rim_mid - round(sun_r * 0.15)
    glow(arr, cxm, sun_y, aw * 0.75, aw * 0.42, hexc("ffb060"), 0.34, 6)
    glow(arr, cxm, sun_y, aw * 0.36, aw * 0.26, hexc("fff0b0"), 0.30, 5)
    yy, xx = np.mgrid[0:ah, 0:aw]
    d = np.hypot(xx + 0.5 - cxm, yy + 0.5 - sun_y)
    disc = d <= sun_r
    arr[disc] = SUN
    arr[disc & (yy < sun_y - sun_r * 0.25)] = SUN_HI
    arr[disc & (d <= sun_r * 0.55) & (yy < sun_y)] = SUN_CORE
    for k in range(3):  # the heat bands across the lower disc, like the game's sun
        band = disc & (yy == round(sun_y + sun_r * (0.25 + 0.22 * k)))
        arr[band] = mix(SUN, hexc("ff9d3a"), 0.6)
    # clouds: a few big ones at the sides, smaller ones higher up, clear over the sun
    spots = [(0.12, 0.42, 0.34), (0.88, 0.36, 0.32), (0.30, 0.20, 0.20), (0.74, 0.16, 0.22), (0.02, 0.10, 0.18),
             (0.98, 0.62, 0.22), (0.52, 0.06, 0.14)]
    for fx, fy, fw in spots:
        cy = round(top * 0.4 + fy * (rim_mid - top * 0.4))
        cloud(arr, rng, round(fx * aw + rng.uniform(-4, 4)), cy, round(fw * aw), 0.96)

    # ---- the stands: the game's crowd in one colour, tiers with rails, bent into a bowl ----
    crowd_src = Image.open(FIELD / "crowd.png")
    tier_a = recolour(crowd_src, (STAND, GOLD, (245, 245, 250)))
    tier_b = recolour(crowd_src, (STAND, (255, 255, 255), GOLD))
    stand_h = horizon - rim_mid + rim_dip + 8
    stands = np.zeros((stand_h, aw, 3))
    stands[:] = STAND_LO
    y, t = 0, 0
    fascia_h = 5
    stands[0:fascia_h] = FASCIA
    stands[1] = STAND_HI
    stands[fascia_h - 1] = GOLD
    y = fascia_h
    while y < stand_h:
        rows = min(31, stand_h - y)
        tier = tier_a if t % 2 == 0 else tier_b
        o = (tier.shape[1] - aw) // 2 + 13 * t
        stands[y:y + rows] = tier[1:1 + rows, o:o + aw] * 0.72 + np.array(STAND) * 0.28
        y += rows
        if y < stand_h:  # the walkway rail between tiers
            stands[y:y + 3] = STAND_LO
            stands[y] = STAND_HI
            y += 3
        t += 1
    # aisles: steps of darker blue every so often
    for ax in range(round(aw * 0.08), aw, round(aw * 0.21)):
        stands[fascia_h:, ax:ax + 2] = stands[fascia_h:, ax:ax + 2] * 0.55 + np.array(STAND_LO) * 0.45
    # warm light from the sun across the upper tiers
    glow(stands, cxm, 4, aw * 0.6, 40, hexc("ffb060"), 0.18, 4)
    # bend: each column drops by the bowl's curve, deepest in the middle
    for x in range(aw):
        u = (x + 0.5 - cxm) / cxm
        rim = rim_mid - round(rim_dip * u * u)
        for yy_ in range(max(0, rim), horizon):
            sy = yy_ - rim
            if 0 <= sy < stand_h:
                arr[yy_, x] = stands[sy, x]
    # the plinth at the centre of the stands, the football on top in the light
    pw = ball_w + 2 * cb
    px0 = round(cxm - pw / 2)
    plinth_top = ball_y + ball_h - cb
    plinth_bot = word_y + 2 * cell  # it stands behind the wordmark, never between its letters
    arr[plinth_top:plinth_bot, px0:px0 + pw] = RED
    arr[plinth_top:plinth_bot, px0:px0 + 2] = mix(RED, (255, 255, 255), 0.25)
    arr[plinth_top:plinth_bot, px0 + pw - 3:px0 + pw] = RED_LO
    arr[plinth_top:plinth_top + 2, px0 - 2:px0 + pw + 2] = GOLD
    arr[plinth_top + 2, px0 - 2:px0 + pw + 2] = GOLD_LO
    glow(arr, cxm, ball_y + ball_h / 2, ball_w * 1.2, ball_h * 1.3, hexc("fff0c0"), 0.28, 4)
    bm = np.array(up(ball_mark(), cb)).astype(float)
    bx0 = round(cxm - ball_w / 2)
    m = bm[..., 3] > 0
    arr[ball_y:ball_y + ball_h, bx0:bx0 + ball_w][m] = bm[..., :3][m]

    # ---- the field: the wall at the sideline, mowed stripes widening toward the camera, the far sideline chalk ----
    wall_h = 6 if short else 8
    arr[horizon - wall_h:horizon] = RED
    arr[horizon - wall_h] = mix(RED, (255, 255, 255), 0.3)
    arr[horizon - 1] = RED_LO
    y, k = horizon, 0
    while y < ah:
        hband = 4 + k * (2 if short else 3)
        c = TURF_A if k % 2 == 0 else TURF_B
        arr[y:y + hband] = c
        y += hband
        k += 1
    speck = (np.array([[((x * 7919 + y * 104729) >> 3) % 23 for x in range(aw)] for y in range(ah - horizon)]) == 0)
    arr[horizon:][speck] *= 0.86
    arr[horizon + 2:horizon + 4] = (236, 240, 232)  # the sideline
    for x in range(0, aw, 6):  # the coaching box dashes
        arr[horizon + 7, x:x + 3] = (214, 222, 205)
    # golden light falling across the field from the sun, fading toward the camera
    for y in range(horizon, ah):
        f = 1 - (y - horizon) / (ah - horizon)
        arr[y] += np.array(hexc("ffcf80")) * 0.10 * f * f

    # ---- the line-up: back row across the width, front row between them, the greatest centre front ----
    people = G.people
    n = len(people)
    front_n = min(n, 5)
    back_n = n - front_n
    slots = []  # (person index, x, feet)
    if n:
        # the back row spread to the edges; the front row in the gaps between them, the greatest in the middle, the
        # next best either side of him, alternating outward
        back_xs = [aw * (0.06 + 0.88 * (j + 0.5) / back_n) for j in range(back_n)] if back_n else []
        if back_n >= front_n + 1:
            mid = (back_n - front_n) // 2
            f_xs = [(back_xs[mid + j] + back_xs[mid + j + 1]) / 2 for j in range(front_n)]
        else:
            f_xs = [cxm + (j - (front_n - 1) / 2) * aw * 0.17 for j in range(front_n)]
        order = sorted(range(front_n), key=lambda j: abs(j - (front_n - 1) / 2) + (0.1 if j < (front_n - 1) / 2 else 0))
        for rank, j in enumerate(order):
            slots.append((rank, f_xs[j], front_feet))
        for j, x in enumerate(back_xs):
            slots.append((front_n + j, x, back_feet))
    # shadows on the turf, then the players back to front
    for i, x, f in slots:
        for dy, half, a in ((0, 10, 0.55), (1, 12, 0.7), (2, 9, 0.8)):
            yy_ = f + dy - 1
            if 0 <= yy_ < ah:
                m = np.abs(xs + 0.5 - (x + 3)) <= half
                arr[yy_, m] *= a
    # ---- the edges: a gentle stepped vignette at the corners ----
    yy, xx = np.mgrid[0:ah, 0:aw]
    d = np.hypot((xx + 0.5 - aw / 2) / (aw / 2), (yy + 0.5 - ah * 0.5) / (ah * 0.6)) / math.sqrt(2)
    f = stepped(np.clip((d - 0.62) / 0.38, 0, 1) ** 1.6, 5, yy, xx) * 0.35
    arr *= (1 - f[..., None])

    # ---- the wordmark over the stands, the sideline and the field ----
    wx = round(cxm - wm_a.shape[1] / 2)
    sub = arr[word_y:word_y + wm_a.shape[0], wx:wx + wm_a.shape[1]]
    # a soft dark halo so the metal reads on the crowd
    halo = dilate(wm_a, 3) & ~wm_a
    sub[halo[:sub.shape[0], :sub.shape[1]]] *= 0.7
    sub[wm_a[:sub.shape[0], :sub.shape[1]]] = wm_rgb[:sub.shape[0], :sub.shape[1]][wm_a[:sub.shape[0], :sub.shape[1]]]

    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    sc = 2
    for i, x, f in sorted(slots, key=lambda s: (s[2], -abs(s[1] - cxm))):
        fig = people[i]["fig"]
        if fig is None:
            continue
        if x > cxm + 1:
            fig = fig.transpose(Image.FLIP_LEFT_RIGHT)  # the right side faces in
        paste(img, up(fig, sc), round(x - 32 * sc), round(f - 58 * sc))
    # ---- the coach from behind, at the bottom centre, nearest the camera ----
    if G.coach is not None:
        back = from_behind(*G.coach)
        k = coach_k
        bb = back.getbbox()
        big = up(back, k)
        head_top = (bb[1] if bb else 13) * k
        y0 = max(coach_top, front_feet + (14 if not short else 8)) - head_top  # under the front row's feet
        paste(img, big, round(cxm - 32 * k), y0)
    return img



def safe_rows(h_css: int, dpr: int, s: int) -> tuple[int, int]:
    """Art rows under the status bar and the home indicator (portrait)."""
    top_css = 20 if h_css < 700 else 62 if h_css >= 852 else 50
    bot_css = 0 if h_css < 700 else 34
    return math.ceil(top_css * dpr / s), math.ceil(bot_css * dpr / s)


def splash(w_css: int, h_css: int, dpr: int, greats: Greats) -> Image.Image:
    w, h = w_css * dpr, h_css * dpr
    s = max(2, int(w / 300 + 0.5))  # about 300 art pixels across
    aw, ah = math.ceil(w / s), math.ceil(h / s)
    top, bottom = safe_rows(h_css, dpr, s)
    art = splash_art(aw, ah, top, bottom, greats)
    big = up(art, s)
    ox, oy = (big.width - w) // 2, 0
    return big.crop((ox, oy, ox + w, oy + h))


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


def build_icons() -> None:
    print("Icons (Kickoff: the 21fcb29 pixel football in front of the stadium):")
    save(icon(180), "apple-touch-icon.png")
    save(icon(192), "icon-192.png")
    save(icon(512), "icon-512.png")
    save(icon_maskable(192), "icon-maskable-192.png")
    save(icon_maskable(512), "icon-maskable-512.png")
    fav32 = icon_design(4)  # the whole 32-cell design, one pixel a cell
    save(fav32, "favicon-32.png")
    fav48 = icon(48)
    fav16 = fav32.resize((16, 16), Image.NEAREST)
    fav48.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[fav16, fav32])
    print("  favicon.ico 16/32/48")


def build_splash() -> None:
    if not (FIELD / "turf-night.png").exists():
        print("Splash screens: skipped (no public/private-sprites/field)")
        return
    greats = Greats()
    names = ", ".join(f"{p['key']} ({p['club']})" for p in greats.people)
    drawn = sum(1 for p in greats.people if p["fig"] is not None)
    print(f"Splash screens (all-time greats, {drawn} drawn: {names}):")
    for w, h, dpr in SPLASH:
        save(splash(w, h, dpr, greats), splash_name(w, h, dpr))


def main() -> None:
    if "--links" in sys.argv:
        print(links())
        return
    only_icons, only_splash = "--icons" in sys.argv, "--splash" in sys.argv
    if not only_splash:
        build_icons()
    if not only_icons:
        build_splash()


if __name__ == "__main__":
    main()
