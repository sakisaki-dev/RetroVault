#!/usr/bin/env python3
"""Home Screen app art for Retro Vault: the app icons and the iOS launch (splash) screens.

* Icon ("Kickoff"): commit 21fcb29's chunky brown pixel football (kept cell for cell) in front of a stadium in bands:
  a golden-hour sky with the sun on the horizon, navy stands dotted with gold, the red wall and the grass. Owner: "its a
  fun football website it doesn't need to be ornate it needs to be colorful memorable and representative".
* Splash: a game title screen after the game's own (owner: "something super similar to the retrobowl splash screen",
  then "#3 for the sunset is great"): a sunset sky, banded stands with club banners, the football on a plinth, confetti,
  a varsity RETRO (blue) arched over VAULT (gold), the best players Skura has coached in the kits of the clubs they
  played for under him with their card numbers, a painted end zone, and Skura from behind in his cap. See "Launch
  screens" below.

Every image is drawn on a grid of whole art pixels and blown up by a whole number with nearest-neighbour, so nothing
is ever blurry. The line-up comes from the data (data/y80/stints.json and coach.json, the site's Career Legacy and
jersey numbers through scripts/splash_jerseys.ts, club colours from src/utils/nflTeams.ts, the kit and poses by the
site's own sprite rules through scripts/widget_sprites.py), so `npm run rebuild` runs this and the splash follows the
data. Deterministic: two runs give the same bytes.

Writes, under public/:
  apple-touch-icon.png (180), icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png
  (32 cells: the ball sits inside the maskable 80% safe circle), favicon-32.png, favicon.ico (16/32/48)
  splash/launch-<w>x<h>.png: portrait launch screens for the current iPhones, listed in SPLASH below and linked from
  index.html (python3 scripts/build_app_icons.py --links prints the <link> tags).

Run: python3 scripts/build_app_icons.py [--icons | --splash] [--links] [--concept sky|royal|gradient]
     python3 scripts/build_app_icons.py --preview <dir> [--concept X]   (every concept, or one, outside public/)
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
# Launch screens (owner picked "#3 for the sunset"): a game title screen after the game's own (IMG_7262's staging) under
# a sunset sky. Pixel clouds and a big sun over the bowl; banded stands (pink, gold, blue) with a dotted crowd and club
# banners hanging from the decks; the football on a pink plinth; confetti and streamers; a varsity RETRO arched over
# VAULT, RETRO blue and VAULT gold (CONCEPTS, the default DEFAULT_CONCEPT); the line-up; a painted end zone in the
# foreground with the goal line and pylons; and Skura from behind in his club's cap, cut at the chest by the bottom edge.
#
# The line-up is "my guys" (owner: "make the players on the screen the best in their position that i've played with"):
# every league player with a career stint (data/y80/stints.json) on a club in a season Dorren Skura coached that club
# (data/y80/coach.json seasons, and currentStint through the season in progress), ranked by the site's Career Legacy;
# the best at each position (QB RB WR TE OL LB DB DL), then the next best to fill LINEUP, the best in the middle of the
# front row. Each wears the kit of the club he played for under Skura (the most seasons together, then the latest), in
# the game's own poses only (ROLE_POSES; mirrored to face in), with the number on his player card (the site's own
# jersey index, scripts/splash_jerseys.ts) drawn the way the game's title screen draws numbers (NUM_GLYPHS).
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

TEAMS_TS = ROOT / "src" / "utils" / "nflTeams.ts"
COACH = ROOT / "data" / "y80" / "coach.json"
STINTS = ROOT / "data" / "y80" / "stints.json"
LINEUP = 11
POSITIONS = ("QB", "RB", "WR", "TE", "OL", "LB", "DB", "DL")
FIG_FOOT = 58
SUNSET = dict(
    sky=[(0.0, hexc("3a2a9e")), (0.3, hexc("8a3cc0")), (0.58, hexc("ef5a8c")), (0.82, hexc("ff9a5a")), (1.0, hexc("ffd06a"))],
    streak=hexc("ffb3c8"), cloud=[hexc("fff1f4"), hexc("ffc6d6"), hexc("e58fb8"), hexc("a95a9e")],
    sun=(hexc("ffd84a"), hexc("ffb43a"), hexc("fff4c0")), halo=hexc("ffcf70"),
    turf=(hexc("4cb43a"), hexc("43a332")), chalk=hexc("eef8e6"))
ROUND = {  # our own chunky block caps, 10 x 11 cells, 3-cell strokes; the outer corners are rounded when drawn
    "R": ["#########.", "##########", "###....###", "###....###", "###...####", "#########.", "########..",
          "###...###.", "###....###", "###....###", "###....###"],
    "E": ["##########", "##########", "###.......", "###.......", "########..", "########..", "###.......",
          "###.......", "###.......", "##########", "##########"],
    "T": ["##########", "##########", "...####...", "...####...", "...####...", "...####...", "...####...",
          "...####...", "...####...", "...####...", "...####..."],
    "O": [".########.", "##########", "###....###", "###....###", "###....###", "###....###", "###....###",
          "###....###", "###....###", "##########", ".########."],
    "V": ["###....###", "###....###", "###....###", "###....###", "###....###", ".###..###.", ".###..###.",
          "..######..", "..######..", "...####...", "....##...."],
    "A": [".########.", "##########", "###....###", "###....###", "##########", "##########", "###....###",
          "###....###", "###....###", "###....###", "###....###"],
    "U": ["###....###", "###....###", "###....###", "###....###", "###....###", "###....###", "###....###",
          "###....###", "###....###", "##########", ".########."],
    "L": ["###.......", "###.......", "###.......", "###.......", "###.......", "###.......", "###.......",
          "###.......", "###.......", "##########", "##########"],
}
# RETRO blue over VAULT gold: each line's face ramp (top to bottom), inner line and outer line, and the shadow
CONCEPTS = {
    "sky": dict(top=([hexc(c) for c in ("ffffff", "d6f6ff", "a6e8ff", "6fd2fb", "3fb6f2", "2a9be0")], hexc("ffffff"), hexc("12205e")),
                bottom=([hexc(c) for c in ("fff3c4", "ffe07a", "ffc93d", "f0a91f", "d68a12", "c97c0c")], hexc("ffffff"), hexc("c8102e")),
                shadow=hexc("1a1450")),
    "royal": dict(top=([hexc(c) for c in ("8fb4ff", "5a8cff", "3a6cf0", "2a56d8", "1f45b8", "183a9e")], hexc("ffd23f"), hexc("0b1a5e")),
                  bottom=([hexc(c) for c in ("fff3c4", "ffe07a", "ffc93d", "f0a91f", "d68a12", "c97c0c")], hexc("2a56d8"), hexc("0b1a5e")),
                  shadow=hexc("1a1450")),
    "gradient": dict(top=([hexc(c) for c in ("c9f6ff", "8fe0ff", "55c2fa", "2f9cf0", "2274d8", "1c56b8")], hexc("ffffff"), hexc("1a0b3e")),
                     bottom=([hexc(c) for c in ("fff8a8", "ffe94a", "ffcc2e", "ffaa22", "ff861f", "f2621c")], hexc("ffffff"), hexc("1a0b3e")),
                     shadow=hexc("3a1466")),
}
DEFAULT_CONCEPT = "gradient"
# the jersey numbers as the game's title screen draws them: one-pixel strokes, three wide and six tall, in the kit's
# number colour, the top row a shade darker where it meets the collar's shadow
NUM_GLYPHS = {"0": ["###", "#.#", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", ".#.", "###"],
              "2": ["###", "..#", "..#", "###", "#..", "###"], "3": ["###", "..#", ".##", "..#", "..#", "###"],
              "4": ["#.#", "#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "###", "..#", "..#", "###"],
              "6": ["###", "#..", "###", "#.#", "#.#", "###"], "7": ["###", "..#", "..#", ".#.", ".#.", ".#."],
              "8": ["###", "#.#", "###", "#.#", "#.#", "###"], "9": ["###", "#.#", "#.#", "###", "..#", "###"]}
# the game's poses by role (1 standing, 2 ball at his side, 3 arm raised, 4 ball tucked, 5 spinning the ball): the
# first one his files have (a running back carries the ball at his side, so it doesn't hide his number)
ROLE_POSES = {"QB": (5, 2, 1), "RB": (2, 1, 4), "WR": (3, 2, 4, 1), "TE": (2, 4, 1), "DB": (1, 3), "LB": (1,),
              "OL": (1,), "DL": (1,)}
NEUTRAL_TRIM = 0xFBFFFD


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


def erode(m: np.ndarray, r: int) -> np.ndarray:
    return ~dilate(~m, r)


def _run_at(row: np.ndarray, cx: int = 31):
    if not row[cx]:
        cx = 32 if row[32] else cx
        if not row[cx]:
            return None
    l = r = cx
    while l > 0 and row[l - 1]:
        l -= 1
    while r < len(row) - 1 and row[r + 1]:
        r += 1
    return l, r


def _outside(solid: np.ndarray, y: int) -> list[int]:
    c = _run_at(solid[y])
    return [int(x) for x in np.where(solid[y])[0] if c is None or not (c[0] <= x <= c[1])]


def anatomy(a: np.ndarray) -> dict | None:
    """Where his arms leave his body and their colours, read from a standing figure."""
    from collections import Counter
    solid = a[..., 3] == 255
    ys = np.where(solid.any(axis=1))[0]
    if not len(ys):
        return None
    top = int(ys[0])
    sh = top + int(np.argmax([solid[y].sum() for y in range(top, top + 26)]))  # the shoulders: widest under the head
    arm0 = arm1 = None
    for y in range(sh + 1, FIG_FOOT - 9):
        if _run_at(solid[y]) is None:
            continue
        if _outside(solid, y):
            arm0 = y if arm0 is None else arm0
            arm1 = y
        elif arm0 is not None and y > arm1 + 1:
            break
    if arm0 is None:
        return None
    tl, tr = _run_at(solid[arm0])

    def colours(y0, y1):
        return Counter(tuple(int(v) for v in a[y, x, :3]) for y in range(y0, y1) for x in _outside(solid, y))
    up_c, fo_c, gl_c = colours(arm0, arm0 + 5), colours(arm1 - 6, arm1 - 2), colours(arm1 - 2, arm1 + 1)
    skin = up_c.most_common(1)[0][0]
    glove = gl_c.most_common(1)[0][0] if gl_c else skin
    fore = fo_c.most_common(1)[0][0] if fo_c else skin
    dk = [c for c, _ in fo_c.most_common() if lum(c) < lum(fore) - 8 and c != glove and lum(c) > 40]
    face_c = Counter(tuple(int(v) for v in a[y, x, :3]) for y in range(top + 7, top + 13)
                     for x in np.where(solid[y])[0])
    face = max((c for c, _ in face_c.most_common(4)), key=lambda c: face_c[c] if 60 < lum(c) < 235 else -1)
    lx = [x for x in np.where(solid[arm0])[0] if x < tl]
    rx = [x for x in np.where(solid[arm0])[0] if x > tr]
    return dict(face=face, face_lo=tuple(int(v * 0.8) for v in face), top=top, sh=sh, arm0=arm0, arm1=arm1, tl=tl, tr=tr, skin=skin, glove=glove,
                glove_lo=tuple(int(v * 0.78) for v in glove), fore=fore,
                fore_lo=dk[0] if dk else tuple(int(v * 0.78) for v in fore),
                la=int(min(lx)) if lx else tl - 4, lb=int(max(lx)) if lx else tl - 1,
                ra=int(min(rx)) if rx else tr + 1, rb=int(max(rx)) if rx else tr + 4)


def pose_file(pick_file: str, pose: int) -> str:
    import re
    base = re.sub(r"(_p\d)?\.png$", "", pick_file)
    return f"{base}.png" if pose == 1 else f"{base}_p{pose}.png"


def paint_sky(arr: np.ndarray, st: dict, y_end: int, rng: random.Random) -> None:
    h, aw = arr.shape[:2]
    xs = np.arange(aw)
    for y in range(y_end):
        t = y / max(1, y_end)
        lo = ramp(st["sky"], math.floor(t * 10) / 10)
        hi = ramp(st["sky"], min(1, math.floor(t * 10 + 1) / 10))
        frac = t * 10 - math.floor(t * 10)
        arr[y] = np.where((frac > BAYER[y % 4, xs % 4] + 0.3)[:, None], np.array(hi), np.array(lo))
    # the streaks: thin lighter lines across the blue, like the game's sky
    for y in range(2, y_end, 3):
        for _ in range(rng.randint(1, 3)):
            ln = rng.randint(6, 34)
            x0 = rng.randint(-10, aw)
            seg = slice(max(0, x0), min(aw, x0 + ln))
            arr[y, seg] = arr[y, seg] * 0.55 + np.array(st["streak"]) * 0.45


def chunky_cloud(arr: np.ndarray, rng: random.Random, cx: float, cy: float, w: float, cols: list) -> None:
    """A big cumulus in chunky steps: round puffs on a flat base, white tops, grey shading under each puff and a
    darker base line."""
    h, aw = arr.shape[:2]
    n = max(3, int(w // 14))
    puffs = []
    for i in range(n):
        px = cx - w / 2 + (i + 0.5) * w / n + rng.uniform(-3, 3)
        mid = 1 - abs(i - (n - 1) / 2) / ((n + 1) / 2)
        r = w / n * (0.75 + 0.75 * mid) * rng.uniform(0.85, 1.1)
        puffs.append((px, cy - r * 0.45, r))
    base = cy + 2
    for y in range(max(0, int(cy - w * 0.8)), min(h, int(base) + 1)):
        for x in range(max(0, int(cx - w)), min(aw, int(cx + w))):
            best = None
            for px, py, r in puffs:
                d = math.hypot((x + 0.5 - px) / 2, (y + 0.5 - py)) * 2 / r if False else math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.15) / r
                if d <= 1 and (best is None or (y + 0.5 - py) / r < best[1]):
                    best = (d, (y + 0.5 - py) / r, r)
            if best is None:
                continue
            k = best[1] + 0.12 * BAYER[y % 4, x % 4]
            c = cols[0] if k < -0.05 else cols[1] if k < 0.35 else cols[2]
            if y >= base - 1:
                c = cols[3]
            arr[y, x] = c


def from_behind_cap(img: Image.Image, outfit: np.ndarray, cap: RGB) -> Image.Image:
    """The coach from behind (from_behind) in a ball cap: a rounded crown a pixel wider than his head, lit on the
    left, panel seams meeting at the button, a darker band, and the back opening with its strap over his hair."""
    back = np.array(from_behind(img, outfit)).copy()
    alpha = back[..., 3] > 200
    rows = np.where(alpha.any(axis=1))[0]
    top = int(rows[0])
    shirt = int(np.where(outfit.any(axis=1))[0][0]) if outfit.any() else top + 15
    head = alpha[top:shirt]
    widest = max(range(head.shape[0]), key=lambda r: head[r].sum())
    xs = np.where(head[widest])[0]
    hx0, hx1 = int(xs[0]), int(xs[-1])
    hair = tuple(int(v) for v in back[top + 1, (hx0 + hx1) // 2, :3])
    cx = (hx0 + hx1 + 1) / 2
    hw = (hx1 - hx0 + 1) / 2 + 1  # a pixel wider than his head each side
    depth = max(6, round((shirt - top) * 0.5))
    y0 = top - 2
    Hc = depth + 2
    hi, lo, edge = mix(cap, (255, 255, 255), 0.3), mix(cap, (0, 0, 0), 0.28), mix(cap, (0, 0, 0), 0.6)
    for r in range(Hc):
        y = y0 + r
        t = (r + 0.5) / Hc
        half = hw * min(1.0, math.sqrt(max(0.0, 1 - (1 - t * 1.6) ** 2)) if t < 0.62 else 1.0)
        half = max(2.0, round(half * 2) / 2)
        x0, x1 = int(math.floor(cx - half)), int(math.ceil(cx + half)) - 1
        for x in range(x0, x1 + 1):
            if r >= Hc - 2:
                c = lo  # the band
            elif x == x0 or x == x1 or r == 0:
                c = edge
            elif x <= x0 + 2 and r < Hc - 3 or (r == 1 and x < cx):
                c = hi
            elif abs(x + 0.5 - cx) < 0.6 or abs(x + 0.5 - (cx - half * 0.55)) < 0.6 or abs(x + 0.5 - (cx + half * 0.55)) < 0.6:
                c = lo  # the panel seams
            else:
                c = cap
            if r >= Hc - 2 and (x == x0 or x == x1):
                c = edge
            back[y, x, :3] = c
            back[y, x, 3] = 255
    # the button on top, the opening at the back of the band with the strap across it
    bx = int(cx - 0.5)
    back[y0 - 1, bx:bx + 2, :3] = lo
    back[y0 - 1, bx:bx + 2, 3] = 255
    for r, w in ((Hc - 4, 1), (Hc - 3, 2), (Hc - 2, 2), (Hc - 1, 2)):
        y = y0 + r
        for x in range(int(cx - w), int(cx + w)):
            back[y, x, :3] = hair if r < Hc - 1 else edge
    back[y0 + Hc - 2, int(cx - 2):int(cx + 2), :3] = edge  # the strap
    return Image.fromarray(back, "RGBA")

def kit_number(fig: Image.Image, base: Image.Image, number: int | None, ink: RGB) -> Image.Image:
    """His number on his chest, centred under the collar like the game's title screen: NUM_GLYPHS, a one-pixel gap
    between digits, drawn only over the jersey's own colours (an arm or the ball stays in front)."""
    if number is None:
        return fig
    from collections import Counter
    a = np.array(fig.convert("RGBA")).copy()
    P = anatomy(np.array(base.convert("RGBA")))
    if not P:
        return fig
    A, tl, tr = P["arm0"], P["tl"], P["tr"]
    cnt = Counter(tuple(int(v) for v in a[y, x, :3]) for y in range(A - 3, A + 4) for x in range(tl + 2, tr - 1)
                  if a[y, x, 3] == 255)
    jersey = cnt.most_common(1)[0][0]
    digs = str(number)
    w = 4 * len(digs) - 1
    x0 = round((tl + tr + 1) / 2 - w / 2)
    y0 = A - 1
    shade = mix(ink, jersey, 0.4)
    for i, d in enumerate(digs):
        for gy, row in enumerate(NUM_GLYPHS[d]):
            for gx, v in enumerate(row):
                y, x = y0 + gy, x0 + 4 * i + gx
                p = a[y, x]
                if v == "#" and p[3] == 255 and sum(abs(int(p[c]) - jersey[c]) for c in range(3)) < 90:
                    a[y, x, :3] = shade if gy == 0 else ink
    return Image.fromarray(a, "RGBA")


def glyph_mask(word: str, cell: int, gap: int, shear: float = 0.0, arch: float = 0.0) -> np.ndarray:
    """A word in ROUND caps on a pixel grid, corners rounded; shear: italic slant (pixels across per pixel up); arch:
    how many cells the middle letter rises above the ends."""
    gw, gh = 10, 11
    n = len(word)
    lift = [round(arch * cell * (1 - ((i - (n - 1) / 2) / ((n - 1) / 2)) ** 2)) for i in range(n)] if arch else [0] * n
    H = gh * cell + max(lift)
    widths = [max(len(r.rstrip(".")) for r in ROUND[ch]) for ch in word]
    W = sum(widths) * cell + (n - 1) * gap + round(shear * H) + 2
    m = np.zeros((H, W), bool)
    for i, ch in enumerate(word):
        x0 = sum(widths[:i]) * cell + i * gap
        y0 = max(lift) - lift[i]
        g = np.zeros((gh * cell, gw * cell), bool)
        for gy, row in enumerate(ROUND[ch]):
            for gx, v in enumerate(row):
                if v == "#":
                    g[gy * cell:(gy + 1) * cell, gx * cell:(gx + 1) * cell] = True
        r = max(1, cell * 2 // 3)
        pad = np.pad(g, r + 1)
        g = dilate(erode(pad, r), r)[r + 1:-r - 1, r + 1:-r - 1] & g  # rounded outer corners
        g = g[:, :widths[i] * cell]
        m[y0:y0 + gh * cell, x0:x0 + widths[i] * cell] |= g
    if shear:
        out = np.zeros_like(m)
        for y in range(H):
            dx = round(shear * (H - 1 - y))
            out[y, dx:] = m[y, :W - dx]
        m = out
    return m


def club_colours() -> list[tuple[RGB, RGB]]:
    t = club_table()
    return [(t[k]["primary"], t[k]["secondary"]) for k in sorted(t)]


def confetti(arr: np.ndarray, rng: random.Random, y0: int, y1: int) -> None:
    """Confetti and streamers in club colours, drifting down."""
    h, aw = arr.shape[:2]
    cols = [c for p, s in club_colours() for c in (p, s)] + [hexc("ffd84a"), hexc("ffffff"), hexc("ff5a8a")]
    for _ in range(int(aw * (y1 - y0) / 120)):
        x, y = rng.randrange(aw), rng.randrange(y0, y1)
        c = rng.choice(cols)
        if lum(c) < 50:
            continue
        if rng.random() < 0.7:
            arr[y:y + 2, x:x + 2] = c
        else:
            arr[y, x:x + 3] = c
    for _ in range(14):  # streamers: long wavy ribbons
        x = rng.randrange(aw)
        y = rng.randrange(y0, max(y0 + 1, y1 - 60))
        c = rng.choice([hexc("ffd84a"), hexc("ff5a8a"), hexc("7fe3ff"), hexc("ffffff")])
        for t in range(rng.randint(30, 60)):
            xx = round(x + 4 * math.sin(t / 5))
            if 0 <= y + t < h and 0 <= xx < aw - 1:
                arr[y + t, xx:xx + 2] = c


def long_shadow(img: Image.Image, fig: Image.Image, x: float, feet: int, sc: int) -> None:
    """His sunset shadow, cast toward the camera: his outline's width row by row, flipped down from his feet, squashed
    to half his height and leaning right, one solid soft shade."""
    a = np.array(fig)[..., 3] > 128
    ys = np.where(a.any(axis=1))[0]
    if not len(ys):
        return
    top = int(ys[0])
    base = np.array(img).astype(float)
    shade = np.zeros(base.shape[:2], bool)
    for k in range((FIG_FOOT - top) // 2):
        xs = np.where(a[FIG_FOOT - 2 * k] | a[FIG_FOOT - 2 * k - 1])[0]
        if not len(xs):
            continue
        dx = round(k * 0.6 * sc)
        x0, x1 = round(x - 32 * sc + xs[0] * sc + dx), round(x - 32 * sc + (xs[-1] + 1) * sc + dx)
        y0 = feet + k * sc
        shade[max(0, y0):max(0, min(base.shape[0], y0 + sc)), max(0, x0):max(0, min(base.shape[1], x1))] = True
    base[shade] = base[shade] * 0.78
    img.paste(Image.fromarray(base.clip(0, 255).astype(np.uint8), "RGB"))


def site_players() -> dict[str, dict]:
    """Every league player as the site sees him: {"POS:Name": {number, legacy, team, inducted}} (the site's own jersey
    index and Career Legacy, scripts/splash_jerseys.ts bundled with esbuild)."""
    import subprocess
    import tempfile
    esbuild = ROOT / "node_modules" / ".bin" / "esbuild"
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "jerseys.cjs"
        subprocess.run([str(esbuild), str(ROOT / "scripts" / "splash_jerseys.ts"), "--bundle", "--platform=node",
                        f"--alias:@={ROOT / 'src'}", '--define:import.meta.env.BASE_URL="/"', f"--outfile={out}",
                        "--log-level=error"], check=True, cwd=ROOT)
        res = subprocess.run(["node", str(out), str(ROOT)], capture_output=True, text=True, check=True, cwd=ROOT)
    return json.loads(res.stdout)


def coached_seasons() -> dict[int, str]:
    """Season -> the club Skura coached: coach.json seasons, then currentStint through the season in progress."""
    c = json.loads(COACH.read_text())
    out = {int(r["year"]): r["team"] for r in c.get("seasons", [])}
    cur = c.get("currentStint") or {}
    if cur.get("team") and out:
        for y in range(int(cur.get("from", max(out) + 1)), max(out) + 2):
            out.setdefault(y, cur["team"])
    return out


def my_guys(site: dict[str, dict]) -> list[dict]:
    """The line-up by rule: players with a stint on Skura's club in a season he coached it, best Career Legacy at each
    position, then the next best to LINEUP; each with the club (kit) he played for under Skura."""
    stints = json.loads(STINTS.read_text())
    coached = coached_seasons()
    pool = []
    for key, info in site.items():
        pos, name = key.split(":", 1)
        rec = stints.get(name)
        if not rec:
            continue
        together: dict[str, list[int]] = {}
        for s in rec.get("stints", []):
            for y in range(int(s["from"]), int(s["to"]) + 1):
                if coached.get(y) == s["team"]:
                    together.setdefault(s["team"], []).append(y)
        if together:
            club = max(sorted(together), key=lambda c: (len(together[c]), max(together[c])))
            pool.append(dict(key=key, pos=pos, name=name, legacy=info["legacy"], number=info["number"], club=club,
                             together={c: (min(v), max(v), len(v)) for c, v in sorted(together.items())}))
    pool.sort(key=lambda p: (-p["legacy"], p["key"]))
    picked = []
    for pos in POSITIONS:
        best = next((p for p in pool if p["pos"] == pos), None)
        if best:
            picked.append(best)
    picked += [p for p in pool if p not in picked][:max(0, LINEUP - len(picked))]
    return sorted(picked, key=lambda p: (-p["legacy"], p["key"]))


class TitleCast:
    """The line-up (my_guys): each with every pose the game drew for him in that club's kit, his number and the kit's
    number colour; and the head coach."""

    def __init__(self) -> None:
        self.people: list[dict] = []
        self.poses: list[dict[int, Image.Image]] = []
        self.ink: list[RGB] = []
        self.coach: tuple[Image.Image, np.ndarray] | None = None
        if not (NFL / "index.json").exists() or not STINTS.exists():
            return
        clubs = club_table()
        for p in my_guys(site_players()):
            info = clubs.get(p["club"], {})
            p.update(primary=info.get("primary", hexc("1d2a57")), secondary=info.get("secondary", hexc("ffc93d")))
            self.people.append(p)
        import widget_sprites as WS  # the site's sprite picks and kit palettes, the GameSprite painter
        palettes, picks = WS.site_rules([{"key": p["key"], "club": p["club"], "action": "idle"} for p in self.people])
        for p, pick in zip(self.people, picks):
            have: dict[int, Image.Image] = {}
            if pick:
                p["file"] = pick["file"]
                for pose in range(1, 6):
                    f = pose_file(pick["file"], pose)
                    if (NFL / f).exists():
                        have[pose] = WS.figure(dict(pick, file=f), palettes)
            self.poses.append(have)
            pal = palettes.get(p["club"])
            trim = pal["jersey"].get(str(NEUTRAL_TRIM)) if pal else None  # the trim the game paints numbers in
            if trim and abs(lum(trim) - lum(p["primary"])) > 60:
                self.ink.append(tuple(trim))
            else:
                self.ink.append((255, 255, 255) if lum(p["primary"]) < 150 else (24, 28, 48))
        self.coach = coach_sprite()

    def pose_for(self, i: int) -> int:
        have = self.poses[i]
        for p in ROLE_POSES.get(self.people[i]["pos"], (1,)):
            if p in have:
                return p
        return min(have) if have else 1

    def figure(self, i: int, flip: bool = False) -> Image.Image | None:
        have = self.poses[i]
        base = have.get(1) or (have[min(have)] if have else None)
        if base is None:
            return None
        img = have.get(self.pose_for(i)) or base
        if flip:
            img, base = img.transpose(Image.FLIP_LEFT_RIGHT), base.transpose(Image.FLIP_LEFT_RIGHT)
        return kit_number(img, base, self.people[i]["number"], self.ink[i])

    def describe(self) -> list[str]:
        out = []
        for i, p in enumerate(self.people):
            spans = ", ".join(f"{c} Y{a}-Y{b} ({n})" for c, (a, b, n) in p["together"].items())
            out.append(f"{p['key']} #{p['number']} in the {p['club']} kit ({p.get('file', 'no sprite')}, pose "
                       f"{self.pose_for(i) if self.poses[i] else '-'}), Career Legacy {p['legacy']:,}; with Skura: {spans}")
        return out


def varsity_wordmark(cell: int, concept: str) -> tuple[np.ndarray, np.ndarray]:
    """RETRO arched over a straight VAULT in varsity letters: each line's face ramp, an inner line, an outer line and a
    shadow down and right (CONCEPTS); a white shine along the top of every letter."""
    cfg = CONCEPTS[concept]
    gap = cell
    inner, ol, depth = max(2, cell // 2), max(2, cell // 2 + 1), max(3, cell)
    pad = inner + ol + depth + 2
    lines = []
    for word, arch, (faces, in_c, out_c) in (("RETRO", 4.5, cfg["top"]), ("VAULT", 0.0, cfg["bottom"])):
        m = glyph_mask(word, cell, gap, arch=arch)
        H, W = m.shape[0] + 2 * pad, m.shape[1] + 2 * pad
        face = np.zeros((H, W), bool)
        face[pad:pad + m.shape[0], pad:pad + m.shape[1]] = m
        ring = dilate(face, inner)
        body = ring | dilate(ring, ol)
        shadow = np.roll(np.roll(body, depth, 0), depth, 1) & ~body
        rgb = np.zeros((H, W, 3))
        rgb[shadow] = cfg["shadow"]
        rgb[body & ~ring] = out_c
        rgb[ring & ~face] = in_c
        n = len(faces)
        for y in range(pad, pad + m.shape[0]):
            rgb[y, face[y]] = faces[min(n - 1, int((y - pad) / m.shape[0] * n))]
        lit = face & ~np.roll(face, max(1, cell // 2), 0) & np.roll(face, -1, 0)
        rgb[lit] = rgb[lit] * 0.35 + 255 * 0.65
        lines.append((rgb, body | shadow, m.shape[0]))
    gy = round(0.8 * cell)
    (r1, a1, h1), (r2, a2, h2) = lines
    W = max(a1.shape[1], a2.shape[1])
    H = h1 + gy + a2.shape[0] + 2 * pad
    rgb, alpha = np.zeros((H, W, 3)), np.zeros((H, W), bool)
    y2 = h1 + gy  # VAULT first, RETRO over it (its shadow falls on VAULT)
    for (r, a), y0 in (((r2, a2), y2), ((r1, a1), 0)):
        x0 = (W - a.shape[1]) // 2
        sub_r, sub_a = rgb[y0:y0 + a.shape[0], x0:x0 + a.shape[1]], alpha[y0:y0 + a.shape[0], x0:x0 + a.shape[1]]
        sub_r[a] = r[a]
        sub_a |= a
    rows, cols = np.where(alpha.any(axis=1))[0], np.where(alpha.any(axis=0))[0]
    crop = (slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1))
    return rgb[crop], alpha[crop]


def paint_stands(arr: np.ndarray, rim_mid: int, rim_dip: int, horizon: int, rng: random.Random) -> None:
    """The bowl: a roof edge lit by the sunset, its dark underside, three tiers in bands of colour (pink, orange-gold,
    blue) full of crowd dots, gold decks between them with club banners hanging from them, bent into a bowl."""
    h, aw = arr.shape[:2]
    H = horizon - rim_mid + rim_dip + 4
    S = np.zeros((H, aw, 3))
    roof = (hexc("ffd27a"), hexc("2f4fd0"), hexc("12206a"))
    under = hexc("0e1240")
    S[0] = hexc("fff0b0")
    S[1] = roof[0]
    S[2:6] = roof[1]
    S[6] = roof[2]
    S[7:15] = under
    for y in range(8, 15, 3):
        S[y, ::2] = mix(under, roof[1], 0.5)
    y_seat = 15
    decks = [y_seat + round((H - y_seat) * f) for f in (0.38, 0.72)]
    tiers = [(y_seat, decks[0]), (decks[0] + 7, decks[1]), (decks[1] + 7, H)]
    tier_cols = [(hexc("ff5a8a"), hexc("fff0b0"), hexc("ffd23f")), (hexc("ffa21f"), hexc("ffffff"), hexc("7a2bc2")),
                 (hexc("2f5fe0"), hexc("ffd23f"), hexc("ffffff"))]
    clubs = club_colours()
    for (a0, a1), (base, d1, d2) in zip(tiers, tier_cols):
        for y in range(a0, a1):
            r = (y - a0) % 3
            S[y] = base if r == 0 else mix(base, (0, 0, 0), 0.18) if r == 1 else mix(base, (0, 0, 0), 0.42)
        for y in range(a0, a1 - 1, 3):
            for x in range((y // 3) % 2, aw, 3):
                if rng.random() < 0.72:
                    S[y, x] = d1 if rng.random() < 0.6 else d2
    for dy in decks:
        S[dy:dy + 6] = hexc("ffc93d")
        S[dy] = hexc("fff0b0")
        S[dy + 5] = hexc("b5700e")
        S[dy + 6] = under
    for k, dy in enumerate(decks):  # club banners hanging from the decks
        n = 9
        for j in range(n):
            cx = round((j + 0.5 + 0.5 * k) * aw / n) % aw
            pc, sc_ = clubs[(j * 3 + k * 7) % len(clubs)]
            for y in range(dy + 6, min(H, dy + 22)):
                t = y - dy - 6
                half = 4 if t < 12 else 4 - (t - 11)
                if half < 0:
                    break
                S[y, max(0, cx - half):cx + half + 1] = pc
                S[y, max(0, cx - half)] = mix(pc, (0, 0, 0), 0.35)
                if 3 <= t <= 6:
                    S[y, max(0, cx - 1):cx + 2] = sc_
    for x in range(aw):
        u = (x + 0.5 - aw / 2) / (aw / 2)
        rim = rim_mid - round(rim_dip * u * u)
        for y in range(max(0, rim), horizon):
            if 0 <= y - rim < H:
                arr[y, x] = S[y - rim, x]


def paint_field(arr: np.ndarray, horizon: int, near: int) -> None:
    """The wall at the foot of the stands, mowed bands with yard lines warmed by the sunset near the stands, and the
    end zone the camera stands in: plum with diagonal hatching, the goal line, an orange pylon at each corner."""
    h, aw = arr.shape[:2]
    arr[horizon - 8:horizon] = hexc("2f4fd0")
    arr[horizon - 8] = hexc("ffd27a")
    arr[horizon - 1] = hexc("12206a")
    a, b = SUNSET["turf"]
    y, k = horizon, 0
    while y < near:
        band = 5 + k * 4
        arr[y:min(near, y + band)] = a if k % 2 == 0 else b
        if k:
            arr[y:min(near, y + 1 + k // 3)] = SUNSET["chalk"]
        y += band
        k += 1
    arr[near:h] = hexc("5a2a9e")
    for x in range(-h, aw, 16):
        for yy in range(near, h):
            xx = x + (yy - near)
            if 0 <= xx < aw:
                arr[yy, xx:xx + 6] = hexc("6c34b4")
    for yy in range(horizon, h):
        f = max(0.0, 1 - (yy - horizon) / 90)
        arr[yy] += np.array(hexc("ff9a5a")) * 0.12 * f
    speck = np.fromfunction(lambda yy, xx: ((xx * 7919 + yy * 104729).astype(int) >> 3) % 29 == 0, (h - horizon, aw))
    arr[horizon:][speck] *= 0.9
    arr[near - 3:near + 1] = SUNSET["chalk"]  # the goal line
    for px in (4, aw - 14):
        arr[near - 18:near + 2, px:px + 10] = hexc("ff7a1a")
        arr[near - 18:near - 15, px:px + 10] = hexc("ffb060")
        arr[near - 18:near + 2, px + 8:px + 10] = hexc("c2500e")


def title_art(aw: int, ah: int, top: int, bottom: int, G: TitleCast, concept: str = DEFAULT_CONCEPT) -> Image.Image:
    st = SUNSET
    rng = random.Random(f"v7|{'|'.join(p['key'] for p in G.people)}|{aw}x{ah}")
    arr = np.zeros((ah, aw, 3), float)
    cxm = aw / 2
    short = ah < 480
    sc = 2
    cell = 5
    while cell > 2:
        wm_rgb, wm_a = varsity_wordmark(cell, concept)
        if wm_a.shape[1] <= aw - 10:
            break
        cell -= 1
    wm_h, wm_w = wm_a.shape

    # the stack from the bottom up: the coach, the line-up over his cap (five in front, the rest behind), the wordmark
    # on their heads, the football on its plinth, the bowl to about a third of the screen, the sky
    coach_k = 4 if not short else 2
    coach_top = ah - 26 * coach_k
    stand_h = 49 * sc
    front_feet = coach_top + (14 if not short else 8)
    back_feet = front_feet - (24 if not short else 18)
    lineup_top = back_feet - stand_h
    word_y = lineup_top + (6 if not short else 4) - wm_h
    cb = 3 if not short else 2
    ball_h, ball_w = 15 * cb, 20 * cb
    ball_y = word_y - ball_h - (24 if not short else 8)
    rim_mid = max(min(ball_y - (36 if not short else 14), top + round(ah * 0.3)), top + 40)
    rim_dip = round(aw * 0.1)
    horizon = lineup_top + round(stand_h * 0.45)
    near = front_feet + (36 if not short else 20)  # the goal line

    paint_sky(arr, st, rim_mid + 4, rng)
    sun_r = round(aw * 0.2)
    sun_y = rim_mid - round(sun_r * 0.35)
    glow(arr, cxm, sun_y, sun_r * 2.0, sun_r * 1.6, st["halo"], 0.25, 4, rows=(0, rim_mid + 4))
    yy, xx = np.mgrid[0:ah, 0:aw]
    d = np.hypot(xx + 0.5 - cxm, yy + 0.5 - sun_y)
    disc = (d <= sun_r) & (yy < rim_mid + 4)
    s_body, s_rim, s_core = st["sun"]
    arr[disc] = s_body
    arr[disc & (d > sun_r - 3)] = s_rim
    arr[disc & (d <= sun_r * 0.6) & (yy < sun_y - sun_r * 0.1)] = s_core
    for k in range(3):  # heat bands across the lower disc
        arr[disc & (yy == round(sun_y + sun_r * (0.3 + 0.2 * k)))] = mix(s_body, hexc("ff7a3a"), 0.5)
    for fx, fy, fw in [(-0.04, 0.10, 0.62), (1.04, 0.14, 0.62), (0.1, 0.55, 0.36), (0.9, 0.5, 0.34),
                       (0.26, 0.8, 0.24), (0.76, 0.86, 0.26), (0.55, 0.28, 0.18), (0.38, 0.34, 0.14)]:
        chunky_cloud(arr, rng, fx * aw + rng.uniform(-3, 3), round(fy * rim_mid), fw * aw, st["cloud"])
    paint_stands(arr, rim_mid, rim_dip, horizon, rng)

    # the plinth and the football
    bm = np.array(up(ball_mark(), cb)).astype(float)
    mball = bm[..., 3] > 0
    pw, sd = ball_w + 6 * cb, 3 * cb
    px0 = round(cxm - pw / 2 - sd / 2)
    ptop, pbot = ball_y + ball_h - 2 * cb, horizon + 6
    front, side, topc, ink = hexc("ff5a8a"), hexc("c22a64"), hexc("ffa0bf"), hexc("4a0b2e")
    arr[ptop:pbot, px0:px0 + pw] = front
    arr[ptop:pbot, px0:px0 + 2] = mix(front, (255, 255, 255), 0.25)
    for k in range(sd):
        arr[ptop - k:pbot, px0 + pw + k] = side
        arr[ptop - k - 1, px0 + k:px0 + pw + k] = topc
    arr[ptop:pbot, px0 - 1] = ink
    arr[ptop:pbot, px0 + pw + sd] = ink
    arr[ptop - sd - 1, px0 + sd - 1:px0 + pw + sd] = ink
    glow(arr, cxm, ball_y + ball_h / 2, ball_w * 1.1, ball_h * 1.1, hexc("fff6d0"), 0.3, 4)
    bx = round(cxm - ball_w / 2)
    sub = arr[ball_y:ball_y + ball_h, bx:bx + ball_w]
    sub[mball] = bm[..., :3][mball]

    paint_field(arr, horizon, near)
    confetti(arr, rng, top + 4, horizon + 40)
    wx = round(cxm - wm_w / 2)
    sub = arr[word_y:word_y + wm_h, wx:wx + wm_w]
    halo = dilate(wm_a, 2) & ~wm_a
    sub[halo] *= 0.55
    sub[wm_a] = wm_rgb[wm_a]
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")

    # the line-up: the best in the middle of the front row, the rest staggered behind; long sunset shadows first
    n = len(G.people)
    nf = 5 if n >= 9 else (n + 1) // 2
    slots = []

    def place(row, lo, hi, feet):
        k = len(row)
        xs_ = [aw * (lo + (hi - lo) * (j + 0.5) / k) for j in range(k)]
        order = sorted(range(k), key=lambda j: abs(j - (k - 1) / 2) + (0.1 if j < (k - 1) / 2 else 0))
        for rank, j in enumerate(order):
            slots.append((row[rank], xs_[j], feet, xs_[j] > cxm + 1))
    place(list(range(nf)), 0.1, 0.9, front_feet)
    if n - nf == nf + 1:  # the back row in the gaps of the front row, one more each end, so every number shows
        fx = [0.1 + 0.8 * (j + 0.5) / nf for j in range(nf)]
        bx = [0.1] + [(a + b) / 2 for a, b in zip(fx, fx[1:])] + [0.9]
        back = list(range(nf, n))
        order = sorted(range(len(bx)), key=lambda j: abs(j - (len(bx) - 1) / 2) + (0.1 if j < (len(bx) - 1) / 2 else 0))
        for rank, j in enumerate(order):
            slots.append((back[rank], aw * bx[j], back_feet, bx[j] > 0.5))
    else:
        place(list(range(nf, n)), 0.03, 0.97, back_feet)
    figs = {i: G.figure(i, flip) for i, x, f, flip in slots}
    for i, x, f, flip in sorted(slots, key=lambda s: s[2]):
        if figs[i] is not None:
            long_shadow(img, figs[i], x, f, sc)
    for i, x, f, flip in sorted(slots, key=lambda s: (s[2], -abs(s[1] - cxm))):
        if figs[i] is not None:
            paste(img, up(figs[i], sc), round(x - 32 * sc), round(f - FIG_FOOT * sc))

    if G.coach is not None:  # Skura from behind in his club's cap
        cimg, outfit = G.coach
        club = json.loads(COACH.read_text()).get("currentStint", {}).get("team") if COACH.exists() else None
        cap = club_table().get(club or "", {}).get("primary", hexc("1d2a57"))
        back_ = from_behind_cap(cimg, outfit, cap)
        bb = back_.getbbox()
        paste(img, up(back_, coach_k), round(cxm - 32 * coach_k), coach_top - (bb[1] - 1) * coach_k)
    return img


def safe_rows(h_css: int, dpr: int, s: int) -> tuple[int, int]:
    """Art rows under the status bar and the home indicator (portrait)."""
    top_css = 20 if h_css < 700 else 62 if h_css >= 852 else 50
    bot_css = 0 if h_css < 700 else 34
    return math.ceil(top_css * dpr / s), math.ceil(bot_css * dpr / s)


def splash(w_css: int, h_css: int, dpr: int, cast: TitleCast, concept: str = DEFAULT_CONCEPT) -> Image.Image:
    w, h = w_css * dpr, h_css * dpr
    s = max(2, int(w / 300 + 0.5))  # about 300 art pixels across
    aw, ah = math.ceil(w / s), math.ceil(h / s)
    top, bottom = safe_rows(h_css, dpr, s)
    big = up(title_art(aw, ah, top, bottom, cast, concept), s)
    ox = (big.width - w) // 2
    return big.crop((ox, 0, ox + w, h))


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


def build_splash(concept: str = DEFAULT_CONCEPT) -> None:
    if not (NFL / "index.json").exists():
        print("Splash screens: skipped (no public/private-sprites/nfl)")
        return
    cast = TitleCast()
    print(f"Splash screens (the best Skura has coached, {len(cast.people)}):")
    for line in cast.describe():
        print(f"  {line}")
    for w, h, dpr in SPLASH:
        save(splash(w, h, dpr, cast, concept), splash_name(w, h, dpr))


def arg(name: str) -> str | None:
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv[:-1] else None


def preview(out_dir: str, concepts: list[str]) -> None:
    """Each wordmark concept at 1179 x 2556 (iPhone 16 Pro) and 750 x 1334 (iPhone SE), into out_dir; public/ untouched."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    cast = TitleCast()
    for line in cast.describe():
        print(f"  {line}")
    for c in concepts:
        for (w, h, dpr), suffix in (((393, 852, 3), ""), ((375, 667, 2), "-750")):
            img = splash(w, h, dpr, cast, c)
            img.save(out / f"{c}{suffix}.png", optimize=True)
            print(f"  {out / f'{c}{suffix}.png'} {img.size[0]}x{img.size[1]}")


def main() -> None:
    concept = arg("--concept") or DEFAULT_CONCEPT
    if concept not in CONCEPTS:
        sys.exit(f"--concept: one of {', '.join(CONCEPTS)}")
    if arg("--preview"):
        preview(arg("--preview"), [concept] if arg("--concept") else list(CONCEPTS))
        return
    if "--links" in sys.argv:
        print(links())
        return
    only_icons, only_splash = "--icons" in sys.argv, "--splash" in sys.argv
    if not only_splash:
        build_icons()
    if not only_icons:
        build_splash(concept)


if __name__ == "__main__":
    main()
