#!/usr/bin/env python3
"""Home Screen app art for Retro Vault: the app icons and the iOS launch (splash) screens, from the game's own art.

* Icon: a shaded pixel football (leather ramp, cream stripes, lace stitches and seams, a floodlight rim light) with a
  soft drop shadow, on Retro Bowl's own day turf (public/private-sprites/field/turf-day-tall.png: the mowed 5-yard
  stripes, a yard line and the hash marks crossing behind) under a gentle vignette. The favicons draw a simpler ball.
* Splash (owner: "keep the logo as the old one for the launch screen make it more colorful and immersive and use the
  all time greats instead of the eagles players"): the old logo (the gold pixel football with "RV", RETRO VAULT,
  LEAGUE HUB) over a violet night sky full of fireworks in the greats' club colours, coloured floodlight halos and
  beams, an "ALL-TIME GREATS" LED fascia hung with each great's club pennant, the game's crowd tiers recoloured section
  by section into those clubs, an LED ribbon of their surnames, the game's night turf under a violet haze, and the
  greats themselves (Greats below: the best Hall of Famer at each position, the best of those first) in their own
  clubs' kits, the greatest front and centre at 3x celebrating under a spotlight with his name on a club-colour strip
  at the rail, multi-club confetti, the near stands with phone lights below.

Every image is drawn on a grid of whole art pixels and blown up by a whole number with nearest-neighbour, so nothing
is ever blurry. The greats come from the data (public/data/league/halloffame.json, the banner clubs from
public/data/player-extras.json, club colours and abbreviations from src/utils/nflTeams.ts, the kit and pose by the
site's own sprite rules through scripts/widget_sprites.py), so `npm run rebuild` runs this and the splash follows the
Hall of Fame. Deterministic: two runs give the same bytes.

Writes, under public/:
  apple-touch-icon.png (180), icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png
  (the ball sits inside the maskable 80% safe circle), favicon-32.png, favicon.ico (16/32/48)
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
# The ball
# =====================================================================================================================
LEATHER = [hexc(c) for c in ("2e1309", "4a200f", "662d15", "843d1c", "a24f25", "bf6633", "d98a52", "f2b682")]
OUTLINE = hexc("140804")
CREAM = [hexc(c) for c in ("b8a27a", "dccaa0", "f3e6c6", "fffaf0")]
LACE = [hexc(c) for c in ("a99f8f", "e2ddd2", "ffffff")]
RIM = hexc("ffd2a0")
PEBBLE = [((i * 2654435761) >> 7) % 17 == 0 for i in range(97)]  # a fixed sparse pattern


def ball(w: int, h: int, detail: bool = True) -> Image.Image:
    """A w x h pixel football (outline included), lit from the upper left with a warm rim light on the lower right."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    a, b = (w - 2) / 2, (h - 2) / 2  # inside the outline
    cx, cy = w / 2, h / 2

    def half(dx: float) -> float:  # half-height at a normalised x, pointed tips
        return b * max(0.0, 1 - dx * dx) ** 0.62

    inside = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            dx = (x + 0.5 - cx) / (a + 0.6)
            inside[y][x] = abs(y + 0.5 - cy) <= half(dx) + 0.35
    ins = lambda x, y: 0 <= x < w and 0 <= y < h and inside[y][x]  # noqa: E731
    L = np.array([-0.5, -0.78, 0.55])
    L = L / np.linalg.norm(L)
    stripe_w = max(1, round(w / 20)) if detail else 1
    stripe_x = [round(cx - a * 0.64 - stripe_w / 2), round(cx + a * 0.64 - stripe_w / 2)]
    for y in range(h):
        for x in range(w):
            if not inside[y][x]:
                continue
            edge = not all(ins(x + ox, y + oy) for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                px[x, y] = (*OUTLINE, 255)
                continue
            dx = (x + 0.5 - cx) / a
            hh = max(0.5, half(dx))
            u = max(-1.0, min(1.0, (y + 0.5 - cy) / hh))
            z = math.sqrt(max(0.0, 1 - u * u))
            n = np.array([dx * 0.85, u, z * (1 - 0.35 * dx * dx)])
            n = n / np.linalg.norm(n)
            lum = max(0.0, float(n @ L))
            v = 0.12 + 0.95 * lum ** 1.15  # 0..~1
            # one step of ordered dither between the bands
            if detail:  # a checker step only right at each band edge, and the leather's pebble grain
                frac = v * 8 - math.floor(v * 8)
                if frac > 0.82 and (x + y) % 2 == 0:
                    v += 0.125
                if PEBBLE[(x * 7 + y * 13) % len(PEBBLE)]:
                    v -= 0.07
            is_stripe = any(sx <= x < sx + stripe_w for sx in stripe_x)
            ramp = CREAM if is_stripe else LEATHER
            i = max(0, min(len(ramp) - 1, int(v * len(ramp))))
            col = ramp[i]
            # rim light: the lower right edge, just inside the outline
            back = n[0] * 0.55 + n[1] * 0.8
            near_edge = not all(ins(x + ox, y + oy) for ox, oy in ((2, 0), (0, 2), (2, 2)))
            if detail and back > 0.62 and near_edge and not is_stripe:
                col = mix(col, RIM, 0.55)
            px[x, y] = (*col, 255)
    # seams and laces: the lace bar sits a little above the middle, its seam runs out toward both tips
    lace_v = -0.18
    seam_col = LEATHER[1]
    lace_half = a * (0.34 if detail else 0.36)
    for x in range(w):
        dx = (x + 0.5 - cx) / a
        if abs(dx) > 0.86:
            continue
        y = math.floor(cy + lace_v * half(dx))
        if not ins(x, y) or px[x, y][:3] == OUTLINE:
            continue
        if abs(x + 0.5 - cx) <= lace_half:
            continue
        if detail and any(sx <= x < sx + stripe_w for sx in stripe_x):
            continue
        if detail or abs(dx) < 0.55:
            px[x, y] = (*seam_col, 255)
    ly = math.floor(cy + lace_v * b)
    x0, x1 = round(cx - lace_half), round(cx + lace_half)
    # the lace bar: highlight above, the seam's shadow under it
    for x in range(x0, x1):
        if detail:
            px[x, ly] = (*LACE[1], 255)
            px[x, ly + 1] = (*LEATHER[1], 255)
        else:
            px[x, ly] = (*LACE[2], 255)
    # cross stitches
    span = x1 - x0
    count = max(3, min(7, span // 4))
    for i in range(count):
        sx = x0 + round((i + 0.5) * span / count - 0.5)
        tall = max(1, round(h / 14)) if detail else 1
        for yy in range(ly - tall, ly + tall + 1):
            px[sx, yy] = (*(LACE[2] if yy < ly else LACE[1] if yy == ly else LACE[0]), 255)
            if detail and w >= 40:
                # two-pixel-wide stitches on a big ball, the right column in shade
                px[sx + 1, yy] = (*(LACE[1] if yy < ly else LACE[0]), 255)
        if detail:
            px[sx, ly + tall + 1] = (*LEATHER[0], 255)  # the stitch's shadow
            if w >= 40:
                px[sx + 1, ly + tall + 1] = (*LEATHER[0], 255)
    # a specular streak following the upper-left contour
    if detail:
        inset = max(2, round(h / 9))
        thick = max(1, round(h / 22))
        for x in range(w):
            dx = (x + 0.5 - cx) / a
            if not -0.66 <= dx <= -0.12:
                continue
            y = round(cy - half(dx) + inset)
            core = -0.56 <= dx <= -0.22
            for j in range(thick + (1 if core else 0)):
                yy = y + j
                if ins(x, yy) and px[x, yy][:3] not in (OUTLINE, *CREAM, *LACE):
                    px[x, yy] = (*(LEATHER[7] if core and j < thick else LEATHER[6]), 255)
    return img


# =====================================================================================================================
# The icon
# =====================================================================================================================
def turf_patch(g: int, line_at: float) -> np.ndarray:
    """A g x g piece of the game's day turf (mowed stripes, hash marks), yard numbers left out, with the 5-yard line
    at line_at x g from the top."""
    t = np.array(Image.open(FIELD / "turf-day-tall.png").convert("RGB"))
    clean = t[:, 72:164]  # between the yard numbers: the two hash columns and their ticks
    # widen to g by repeating clean columns from inside the band (turf is speckle on horizontal stripes)
    cols = list(range(clean.shape[1]))
    while len(cols) < g:
        cols = [cols[4 + (len(cols) % 12)]] + cols + [cols[-5 - (len(cols) % 12)]]
    start = (len(cols) - g) // 2
    band = clean[:, cols[start:start + g]]
    top = 269 - round(line_at * g)
    return band[top:top + g].copy()


def vignette(arr: np.ndarray, strength: float, inner: float = 0.5) -> np.ndarray:
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot((xx + 0.5 - w / 2) / (w / 2), (yy + 0.5 - h / 2) / (h / 2)) / math.sqrt(2)
    f = np.clip((d - inner) / (1 - inner), 0, 1) ** 1.6 * strength
    f = np.floor(f * 8 + BAYER[yy % 4, xx % 4]) / 8  # stepped, dithered at the edges of each step
    return (arr * (1 - f[..., None])).astype(np.uint8)


def drop_shadow(arr: np.ndarray, cx: float, cy: float, rx: float, ry: float) -> None:
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot((xx + 0.5 - cx) / rx, (yy + 0.5 - cy) / ry)
    for lim, k in ((1.0, 0.80), (0.78, 0.68), (0.5, 0.58)):
        m = d <= lim
        arr[m] = (arr[m] * k).astype(np.uint8)


def icon_art(g: int, ball_share: float, favicon: bool = False) -> Image.Image:
    """The icon on a g x g art grid: the ball spans ball_share of the width."""
    bw = round(g * ball_share)
    bw += bw % 2
    bh = round(bw * 0.66)
    bh += bh % 2
    if favicon:
        # flat, high-contrast turf stripes and a simple ball: reads at 16 to 48 pixels
        arr = np.zeros((g, g, 3), np.uint8)
        stripe = max(2, g // 6)
        for y in range(g):
            arr[y] = hexc("3d8a12") if (y // stripe) % 2 == 0 else hexc("2f7008")
        arr = vignette(arr, 0.35, 0.55)
        ball_img = ball(bw, bh, detail=False)
    else:
        arr = turf_patch(g, 0.30)
        ball_img = ball(bw, bh)
    bx, by = (g - bw) // 2, (g - bh) // 2 - max(1, g // 40)
    drop_shadow(arr, g / 2 + g * 0.025, by + bh + g * 0.02, bw * 0.46, max(1.5, bh * 0.2))
    if not favicon:
        arr = vignette(arr, 0.42)
    img = Image.fromarray(arr, "RGB")
    paste(img, ball_img, bx, by)
    return img


def icon(size: int, scale: int, ball_share: float) -> Image.Image:
    g = math.ceil(size / scale)
    big = up(icon_art(g, ball_share), scale)
    off = (big.width - size) // 2
    return big.crop((off, off, off + size, off + size))


# =====================================================================================================================
# Pixel font (5 x 7) for the wordmark, the jumbotron and the ribbon board
# =====================================================================================================================
FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["111", "010", "010", "010", "010", "010", "111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["010", "110", "010", "010", "010", "010", "111"],
    "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    "·": ["0", "0", "0", "1", "0", "0", "0"],
    "-": ["000", "000", "000", "111", "000", "000", "000"],
    "★": ["00100", "00100", "11111", "01110", "01110", "11011", "10001"],
    " ": ["00", "00", "00", "00", "00", "00", "00"],
}


def text_width(s: str, cell: int = 1) -> int:
    return (sum(len(FONT[c][0]) for c in s) + max(0, len(s) - 1)) * cell


def text_mask(s: str, cell: int = 1) -> np.ndarray:
    m = np.zeros((7 * cell, text_width(s, cell)), bool)
    x = 0
    for c in s:
        g = FONT[c]
        for yy, line in enumerate(g):
            for xx, bit in enumerate(line):
                if bit == "1":
                    m[yy * cell:(yy + 1) * cell, x + xx * cell:x + (xx + 1) * cell] = True
        x += (len(g[0]) + 1) * cell
    return m


def draw_mask(arr: np.ndarray, m: np.ndarray, x: int, y: int, colour) -> None:
    """colour: an RGB, or a function row -> RGB (a vertical ramp)."""
    h, w = m.shape
    H, W = arr.shape[:2]
    for yy in range(h):
        ty = y + yy
        if not 0 <= ty < H:
            continue
        col = colour(yy) if callable(colour) else colour
        for xx in np.nonzero(m[yy])[0]:
            tx = x + int(xx)
            if 0 <= tx < W:
                arr[ty, tx] = col


def shifted(m: np.ndarray, dx: int, dy: int, pad: int) -> np.ndarray:
    out = np.zeros((m.shape[0] + 2 * pad, m.shape[1] + 2 * pad), bool)
    out[pad + dy:pad + dy + m.shape[0], pad + dx:pad + dx + m.shape[1]] = m
    return out


def outlined(m: np.ndarray, pad: int, extrude: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(face, extrude, outline) masks on a canvas padded by pad: a 1-px outline around the face and its extrusion."""
    face = shifted(m, 0, 0, pad)
    ext = np.zeros_like(face)
    for k in range(1, extrude + 1):
        ext |= shifted(m, 0, k, pad)
    ext &= ~face
    body = face | ext
    ring = np.zeros_like(face)
    for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
        ring |= np.roll(np.roll(body, oy, 0), ox, 1)
    ring &= ~body
    return face, ext, ring


# =====================================================================================================================
# The splash scene
# =====================================================================================================================
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

KEY_PRIMARY, KEY_SECONDARY, KEY_TRIM = hexc("00ff00"), hexc("ff00ff"), hexc("00ffff")
HOF = PUBLIC / "data" / "league" / "halloffame.json"
EXTRAS = PUBLIC / "data" / "player-extras.json"
TEAMS_TS = ROOT / "src" / "utils" / "nflTeams.ts"
GREATS = 7  # figures on the field: the best Hall of Famer at each position, the best of those first


# ---- the old logo (the launch screen's mark before the stadium, kept by the owner): a 24 x 16 gold pixel football
# with "RV" in navy, cream stripes near the tips, a glint, drawn at a whole cell size ----
BALL_W, BALL_H = 24, 16
NAVY_INK = (14, 22, 48)
OLD_CREAM = (255, 246, 222)
OLD_GOLD_HI = (255, 226, 130)
OLD_GOLD_LO = (176, 112, 14)
OLD_GOLD_MID = (232, 167, 30)


def old_mark() -> dict[tuple[int, int], RGB]:
    """(x, y) -> colour for every painted cell of the old mark (scripts/build_app_icons.py before 2026-11-15)."""
    cx, half_w, half_h = BALL_W / 2, BALL_W / 2, BALL_H / 2
    m = [[abs(y + 0.5 - half_h) <= half_h * max(0.0, 1 - ((x + 0.5 - cx) / half_w) ** 2) ** 0.9
          for x in range(BALL_W)] for y in range(BALL_H)]
    inside = lambda x, y: 0 <= x < BALL_W and 0 <= y < BALL_H and m[y][x]  # noqa: E731
    px: dict[tuple[int, int], RGB] = {}
    for y in range(BALL_H):
        for x in range(BALL_W):
            if not m[y][x]:
                continue
            if not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[(x, y)] = INK
                continue
            t = y / (BALL_H - 1)
            px[(x, y)] = OLD_GOLD_HI if t < 0.25 else GOLD if t < 0.6 else OLD_GOLD_MID if t < 0.8 else OLD_GOLD_LO
    for sx in (3, BALL_W - 4):
        for y in range(BALL_H):
            if (sx, y) in px and px[(sx, y)] != INK:
                px[(sx, y)] = OLD_CREAM
    r, v = FONT["R"], FONT["V"]
    x0, y0 = (BALL_W - (len(r[0]) + 1 + len(v[0]))) // 2, (BALL_H - len(r)) // 2
    for glyph, gx in ((r, x0), (v, x0 + len(r[0]) + 1)):
        for yy, line in enumerate(glyph):
            for xx, c in enumerate(line):
                if c == "1":
                    px[(gx + xx, y0 + yy)] = NAVY_INK
    for x, y in ((6, 2), (7, 2), (8, 2), (5, 3)):
        if px.get((x, y)) not in (None, INK):
            px[(x, y)] = (255, 244, 200)
    return px


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


def lift(c: RGB, min_l: int = 70) -> RGB:
    """A club colour bright enough to read on night navy (keeps its hue)."""
    lv = lum(c)
    if lv >= min_l:
        return c
    k = min_l / max(lv, 1)
    return tuple(min(255, round(v * k + 18)) for v in c)  # type: ignore[return-value]


class Greats:
    """The league's all-time greats, by rule: the best Hall of Famer at each position (Hall of Fame Score, then Career
    Legacy, then key; public/data/league/halloffame.json), the best of those first, GREATS of them. Each wears his
    banner club's kit (player-extras.json signatureTeams: where he was best known), drawn by the site's own sprite
    rules (scripts/widget_sprites.py site_rules / figure). The first is the greatest: front and centre, celebrating."""

    def __init__(self) -> None:
        self.people: list[dict] = []  # {key, name, last, club, abbr, primary, secondary, fig}
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
        picked = sorted(best.values(), key=lambda m: (-m["score"], -m["careerLegacy"], m["key"]))[:GREATS]
        clubs = club_table()
        for m in picked:
            full = (extras.get("signatureTeams") or {}).get(m["name"])
            club = full.split()[-1] if full else None
            info = clubs.get(club or "", {})
            self.people.append({"key": m["key"], "name": m["name"], "last": m["name"].split()[-1].upper(),
                                "club": club, "abbr": info.get("abbr", ""),
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


def firework(arr: np.ndarray, rng: random.Random, cx: int, cy: int, r: int, colour: RGB, accent: RGB) -> None:
    """A pixel burst: a soft bloom, spokes of sparks thinning out, a white-hot core, a few falling embers."""
    h, w = arr.shape[:2]
    glow(arr, cx, cy, r * 1.25, r * 1.25, colour, 0.22, 4)
    spokes = rng.choice((12, 14, 16))
    turn = rng.random() * math.pi
    for i in range(spokes):
        ang = turn + i * 2 * math.pi / spokes
        reach = r * (0.82 + 0.18 * rng.random())
        for j in range(3, int(reach) + 1):
            if j < reach * 0.45 and j % 2:
                continue  # the inner trail breaks up
            x, y = round(cx + math.cos(ang) * j), round(cy + math.sin(ang) * j + (j / reach) ** 2 * 2.5)
            if not (0 <= x < w and 0 <= y < h):
                continue
            t = j / reach
            c = (255, 255, 240) if t > 0.92 else accent if t > 0.78 else colour if t > 0.4 else mix(colour, (0, 0, 0), 0.35)
            arr[y, x] = c
        # a spark at the tip with a cross of light
        x, y = round(cx + math.cos(ang) * reach), round(cy + math.sin(ang) * reach + 2.5)
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + ox < w and 0 <= y + oy < h:
                arr[y + oy, x + ox] = np.clip(arr[y + oy, x + ox] * 0.4 + np.array(accent) * 0.75, 0, 255)
    for ox, oy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        if 0 <= cx + ox < w and 0 <= cy + oy < h:
            arr[cy + oy, cx + ox] = (255, 255, 235)
    for _ in range(spokes // 2):  # embers drifting down under the burst
        x, y = cx + rng.randint(-r, r), cy + r + rng.randint(0, r // 2 + 2)
        if 0 <= x < w and 0 <= y < h:
            arr[y, x] = mix(accent, (255, 255, 255), 0.3)


def draw_text(arr: np.ndarray, s: str, cell: int, x: int, y: int, colour, shadow: RGB | None = INK) -> int:
    """5 x 7 text at a whole cell size with a one-cell drop shadow; returns its width."""
    m = text_mask(s, cell)
    if shadow is not None:
        draw_mask(arr, m, x + cell, y + cell, shadow)
    draw_mask(arr, m, x, y, colour)
    return m.shape[1]


def splash_art(aw: int, ah: int, top: int, bottom: int, G: Greats) -> Image.Image:
    """The scene on an aw x ah art grid; top / bottom: the art rows the status bar and home indicator cover."""
    rng = random.Random(f"{'|'.join(p['key'] for p in G.people)}{aw}x{ah}")
    arr = np.zeros((ah, aw, 3), float)
    cxm = aw // 2
    yy_all, xx_all = np.mgrid[0:ah, 0:aw]
    people = G.people
    club_cols = [lift(p["primary"], 95) for p in people] or [GOLD]
    club_acc = [lift(p["secondary"], 120) for p in people] or [GOLD_HI]
    # left-to-right order on the field (and of the pennants): the greatest in the middle, the rest fanning out
    n = len(people)
    short = ah < 480  # iPhone SE: one crowd tier, a smaller logo
    # the group on the field: (x as a share of the width from the middle, rows up from the front feet, scale); the
    # greatest front and centre at 3x, the next two beside him, four behind (clear of his raised arm, inside the edges)
    back, edge = (-26, -6) if short else (-36, -8), min(0.40, (aw / 2 - 33) / aw)
    layout = [(0, 0, 3), (-0.29, back[1], 2), (0.29, back[1], 2), (-0.20, back[0], 2), (0.20, back[0], 2),
              (-edge, back[0], 2), (edge, back[0], 2)]
    slots_order = sorted(range(min(n, len(layout))), key=lambda i: layout[i][0])  # left to right

    # ---- the stack, top to bottom ----
    cb = max(3, round(aw * (0.34 if short else 0.46) / BALL_W))  # the ball's cell
    tc = max(2, round(aw * 0.62 / text_width("RETRO VAULT")))  # the wordmark's cell
    tg = 2 if aw >= 270 and not short else 1  # the tagline's cell
    logo_y = top + (8 if short else 14)
    ball_h = BALL_H * cb
    text_y = logo_y + ball_h + 3 * cb
    tag_y = text_y + 7 * tc + 2 * tc + 1
    logo_bot = tag_y + 7 * tg
    board_y = logo_bot + (8 if short else 14)
    board_h = 7 * tg + 8
    truss_y = board_y + board_h
    crowd_a = truss_y + 18
    crowd_b = crowd_a + 32
    ribbon_y = crowd_b + (0 if short else 32)
    crowd_c = None
    if ah - bottom - 12 - (ribbon_y + 9) > 250:  # a tall screen: a third tier
        crowd_c, ribbon_y = ribbon_y, ribbon_y + 32
    turf_y = ribbon_y + 9
    feet = min(ah - bottom - (6 if short else 12), turf_y + 200)
    sky_bot = crowd_a

    # ---- sky: a deep night going violet and magenta toward the stadium glow, stars ----
    stops = [(0.0, hexc("040615")), (0.35, hexc("0f1240")), (0.62, hexc("2a1660")), (0.82, hexc("561a6a")),
             (1.0, hexc("a0306a"))]
    for y in range(sky_bot):
        t = y / max(1, sky_bot - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                u = (t - t0) / (t1 - t0)
                lo, hi = mix(c0, c1, math.floor(u * 4) / 4), mix(c0, c1, min(1, math.floor(u * 4 + 1) / 4))
                frac = u * 4 - math.floor(u * 4)
                for x in range(aw):
                    arr[y, x] = hi if frac > BAYER[y % 4, x % 4] + 0.25 else lo
                break
    for _ in range(aw * sky_bot // 55):
        x, y = rng.randrange(aw), rng.randrange(max(1, int(sky_bot * 0.7)))
        b = rng.choice((110, 160, 220, 255))
        arr[y, x] = (b, b, min(255, b + 25))
    # ---- fireworks over the stadium, one in each great's colours ----
    bursts = []
    for i in range(max(n, 4) + 2):
        side = -1 if i % 2 == 0 else 1
        for _ in range(40):
            r = rng.randint(14, 24) if not short else rng.randint(10, 17)
            x = cxm + side * rng.randint(int(aw * 0.12), int(aw * 0.44))
            y = rng.randint(top + 6, max(top + 8, board_y - r // 2))
            if all(math.hypot(x - bx, y - by) > (r + br) * 0.85 for bx, by, br in bursts):
                bursts.append((x, y, r))
                break
    for i, (x, y, r) in enumerate(bursts):
        firework(arr, rng, x, y, r, club_cols[i % len(club_cols)], club_acc[i % len(club_acc)])
    # ---- floodlight towers in the corners: white-hot lamps, coloured halos, beams down onto the field ----
    lamp_w, lamp_h = 21, 13
    for side, (tx, tint) in enumerate(((3, hexc("5ad8ff")), (aw - lamp_w - 3, hexc("ff6ad5")))):
        ty = max(2, top - 4)
        lx, ly = tx + lamp_w / 2, ty + lamp_h / 2
        glow(arr, lx, ly, 64, 52, tint, 0.30, 6)
        glow(arr, lx, ly, 30, 24, (255, 236, 200), 0.45, 5)
        x0, y0 = lx, ty + lamp_h
        for y in range(int(y0), feet):
            f = (y - y0) / max(1, feet - y0)
            mid = x0 + (cxm + (-1 if side == 0 else 1) * aw * 0.08 - x0) * f
            half = 2 + 26 * f
            xs = np.arange(aw)
            m = np.abs(xs - mid) <= half
            k = 0.07 * (1 - f * 0.5) * (1 if (y // 2 + side) % 3 else 0.6)
            arr[y, m] += np.array(mix(tint, (255, 255, 255), 0.55)) * k
        pole = tx + lamp_w // 2 - 1
        arr[ty + lamp_h:truss_y, pole:pole + 3] = hexc("232a40")
        arr[ty + lamp_h:truss_y, pole] = hexc("4a5470")
        for yb in range(ty + lamp_h + 3, truss_y, 5):
            arr[yb, pole - 1:pole + 4] = hexc("39415a")
        arr[ty:ty + lamp_h, tx:tx + lamp_w] = hexc("1a1f2e")
        arr[ty, tx:tx + lamp_w] = hexc("6a7494")
        for r_ in range(3):
            for c in range(5):
                lx_, ly_ = tx + 1 + c * 4, ty + 1 + r_ * 4
                arr[ly_:ly_ + 3, lx_:lx_ + 3] = hexc("fff4cf")
                arr[ly_, lx_] = (255, 255, 255)
                arr[ly_ + 2, lx_ + 2] = mix(hexc("ffd98a"), tint, 0.3)
    # ---- the logo's halo: gold light behind the old mark ----
    glow(arr, cxm, logo_y + ball_h * 0.5, aw * 0.42, ball_h * 1.15, hexc("ffb347"), 0.38, 6)
    glow(arr, cxm, logo_y + ball_h * 0.5, aw * 0.26, ball_h * 0.75, hexc("ffe7a0"), 0.25, 4)

    # ---- the stadium: the game's truss, crowd tiers in the greats' club colours, section by section ----
    st = np.array(Image.open(FIELD / "stands.png").convert("RGB")).astype(float)
    st = st * np.array([0.30, 0.24, 0.46]) + 8  # blue truss into violet night steel
    off = (st.shape[1] - aw) // 2
    arr[truss_y:truss_y + 22] = st[11:33, off:off + aw]
    crowd_src = Image.open(FIELD / "crowd.png")
    sections = [(p["primary"], p["secondary"], (240, 240, 240)) for p in (people[i] for i in slots_order)] or \
        [(hexc("1d2a57"), GOLD, CHALK)]
    tiers = [np.array(recolour(crowd_src, s)) for s in sections]

    def crowd_tier(y: int, shift: int, light: float, flashes: int) -> None:
        ns = len(tiers)
        bounds = [round(aw * i / ns) for i in range(ns + 1)]
        o = (tiers[0].shape[1] - aw) // 2 + shift
        rows = min(32, ah - y)
        for i in range(ns):
            a, b = bounds[i], bounds[i + 1]
            arr[y:y + rows, a:b] = tiers[i][0:rows, o + a:o + b] * light
            if i:  # the aisle between sections
                arr[y:y + rows, a] = hexc("12101e")
                arr[y + 1:y + rows:3, a] = hexc("3a3550")
        # the floodlights catch the middle of the tier
        glow(arr, cxm, y + 14, aw * 0.6, 26, (255, 230, 200), 0.10, 4, rows=(y, y + rows))
        for _ in range(flashes):
            fx, fy = rng.randrange(1, aw - 1), y + rng.randrange(1, max(2, rows - 1))
            arr[fy, fx] = (255, 255, 255)
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= fy + oy < ah:
                    arr[fy + oy, fx + ox] = np.clip(arr[fy + oy, fx + ox] + 110, 0, 255)

    crowd_tier(crowd_a, 0, 0.92, 6)
    if not short:
        crowd_tier(crowd_b, 17, 1.0, 7)
    if crowd_c is not None:
        crowd_tier(crowd_c, 31, 1.06, 8)
    arr[crowd_a - 1] = hexc("0c0a18")
    # a light haze from the floodlights over the upper tier
    glow(arr, cxm, crowd_a + 4, aw * 0.7, 22, hexc("c060ff"), 0.10, 3)

    # ---- the board: ALL-TIME GREATS on an LED fascia, gold rails ----
    arr[board_y:board_y + board_h] = hexc("080812")
    arr[board_y] = GOLD
    arr[board_y + 1] = GOLD_LO
    arr[board_y + board_h - 1] = GOLD_DEEP
    arr[board_y + board_h - 2] = GOLD_LO
    for y in range(board_y + 2, board_y + board_h - 2, 2):  # LED scan rows
        arr[y, :] = hexc("10101e")
    msg = "★ ALL-TIME GREATS ★"
    mw = text_width(msg, tg)
    draw_text(arr, msg, tg, cxm - mw // 2, board_y + 4, lambda r: GOLD_HI if r < 3 * tg else GOLD if r < 5 * tg else
              GOLD_MID, shadow=hexc("3a1c00"))
    glow(arr, cxm, board_y + board_h / 2, mw * 0.6, board_h * 0.9, hexc("ffb020"), 0.10, 3,
         rows=(board_y + 2, board_y + board_h - 2))

    # ---- the pennants: each great's club banner hanging from the fascia, in field order ----
    pw = max(18, min(30, (aw - 12) // max(1, n) - 5))
    ph = 30 if not short else 24
    gap = (aw - n * pw) / (n + 1)
    for j, i in enumerate(slots_order):
        p = people[i]
        x0 = round(gap + j * (pw + gap))
        y0 = board_y + board_h
        prim, sec = p["primary"], p["secondary"]
        dark = mix(prim, (0, 0, 0), 0.45)
        for y in range(ph):
            notch = max(0, y - (ph - pw // 2))  # the swallowtail cut
            for x in range(pw):
                cxp = abs(x + 0.5 - pw / 2)
                if notch and cxp < notch:
                    continue
                edge = x in (0, pw - 1) or (notch and cxp < notch + 1) or y == ph - 1
                c = dark if edge else prim
                if 2 <= y <= 3 or ph - pw // 2 - 3 <= y <= ph - pw // 2 - 2:
                    c = sec if not edge else dark
                fold = 0.82 if x < 2 else 1.08 if x == pw - 3 else 1.0  # the cloth catching light
                arr[y0 + y, x0 + x] = np.clip(np.array(c, float) * fold, 0, 255)
        # the hanging rod and the abbreviation
        arr[y0, x0 - 1:x0 + pw + 1] = hexc("c9a24a")
        if p["abbr"]:
            ink = (255, 255, 255) if lum(prim) < 150 else hexc("10131c")
            am = text_mask(p["abbr"], 1)
            if am.shape[1] <= pw - 2:
                draw_mask(arr, am, x0 + (pw - am.shape[1]) // 2 + 1, y0 + 7, mix(dark, (0, 0, 0), 0.5))
                draw_mask(arr, am, x0 + (pw - am.shape[1]) // 2, y0 + 6, ink)
        # a star for the greatest
        if i == 0:
            sm = text_mask("★", 1)
            draw_mask(arr, sm, x0 + (pw - sm.shape[1]) // 2, y0 + 16, GOLD)

    # ---- LED ribbon: the greats' surnames, each in his club's colour ----
    if ribbon_y + 9 <= ah:
        arr[ribbon_y:ribbon_y + 9] = hexc("07060f")
        arr[ribbon_y] = hexc("4a3f6a")
        arr[ribbon_y + 8] = hexc("1b1830")
        parts = [("HALL OF FAME", GOLD)] + [(p["last"], lift(p["secondary"] if lum(p["primary"]) < 60 else p["primary"], 130))
                                            for p in people]
        xx = 3
        while xx < aw:
            for word, col in parts:
                for piece, c in ((word, col), ("★", GOLD_MID)):
                    m = text_mask(piece, 1)
                    draw_mask(arr, m, xx, ribbon_y + 1, c)
                    xx += m.shape[1] + 4

    # ---- the field: the game's night turf, the bench in the greatest's club ----
    lead = people[0] if people else None
    bench = (lead["primary"], lead["secondary"], (240, 240, 240)) if lead else (hexc("1d2a57"), GOLD, CHALK)
    turf = recolour(Image.open(FIELD / "turf-night.png"), bench)
    to = 320 - aw // 2
    rows = min(ah - turf_y, turf.shape[0])
    arr[turf_y:turf_y + rows] = turf[0:rows, to:to + aw] * 1.05
    if turf_y + rows < ah:
        arr[turf_y + rows:] = turf[-1, to:to + aw]
    # atmospheric haze: the far field lies under a violet mist, clearing toward the camera
    for y in range(turf_y, min(ah, turf_y + 70)):
        f = 1 - (y - turf_y) / 70
        q = stepped(np.full(aw, f * f), 5, np.full(aw, y), np.arange(aw)) * 0.42
        arr[y] = arr[y] * (1 - q[:, None]) + np.array(hexc("6a4a9a")) * q[:, None]

    # ---- the greats: the greatest front and centre at 3x celebrating, two beside him, four behind ----
    placed = []
    for i, p in enumerate(people[:len(layout)]):
        fx, dy, sc = layout[i]
        x = cxm + fx * aw
        y = feet + dy
        placed.append((i, x, y, sc))
        # a pool of his club's light on the turf, white for the greatest
        col = (255, 245, 220) if i == 0 else lift(p["primary"], 110)
        glow(arr, x, y - 1, 15 * sc, 5 * sc, col, 0.42 if i == 0 else 0.30, 4)
    # the spotlight on the greatest: a cone from above
    if placed:
        _, sx, sy, _ = placed[0]
        for y in range(turf_y, int(sy)):
            f = (y - turf_y) / max(1, sy - turf_y)
            half = 8 + 40 * f
            m = np.abs(np.arange(aw) - sx) <= half
            arr[y, m] += np.array((255, 240, 210)) * 0.05 * (0.5 + f * 0.5)

    # ---- confetti: every great's colours and gold, small and far up the field, bigger near the camera ----
    conf = club_cols + club_acc + [GOLD, GOLD_HI, (255, 255, 255)]
    lo, hi = crowd_a, feet + 4
    for _ in range(aw * (hi - lo) // 70):
        x, y = rng.randrange(aw), rng.randrange(lo, hi)
        if board_y - 1 <= y <= board_y + board_h or ribbon_y - 1 <= y <= ribbon_y + 9:
            continue
        near = (y - lo) / max(1, hi - lo)
        c = rng.choice(conf)
        if near > 0.55 and rng.random() < 0.55:
            cells = rng.choice(([(0, 0), (1, 0), (0, 1), (1, 1)], [(0, 0), (1, 0), (2, 1)], [(0, 0), (1, 1), (1, 2)]))
        else:
            cells = rng.choice(([(0, 0)], [(0, 0), (1, 0)], [(0, 0), (0, 1)]))
        shade = mix(c, (0, 0, 0), 0.35)
        for j, (ox, oy) in enumerate(cells):
            if 0 <= x + ox < aw and 0 <= y + oy < ah:
                arr[y + oy, x + ox] = c if j < 2 else shade
    for _ in range(aw * 3 // 20):  # fallen confetti on the turf
        x, y = rng.randrange(aw), rng.randrange(turf_y + 20, min(ah, feet + 8))
        arr[y, x] = np.array(rng.choice(conf)) * 0.75
    for _ in range(max(3, aw // 40)):  # streamers curling down
        x, y = rng.randrange(aw), rng.randrange(lo, max(lo + 1, hi - 30))
        c = rng.choice(conf)
        ph_ = rng.random() * 6
        for j in range(rng.randint(12, 22)):
            xx_ = round(x + 2.2 * math.sin(ph_ + j * 0.45))
            if 0 <= xx_ < aw and 0 <= y + j < ah:
                arr[y + j, xx_] = c if j % 4 else mix(c, (255, 255, 255), 0.4)

    # ---- the near stands below the field: a gold rail and the crowd in silhouette, lit at the rim ----
    near_y = feet + 9
    if near_y < ah:
        arr[near_y:near_y + 2] = GOLD_LO
        arr[near_y] = GOLD
        arr[near_y + 2:near_y + 6] = hexc("140c24")
        arr[near_y + 2] = hexc("2c1c48")
        y, t = near_y + 6, 0
        while y < ah:
            rows_ = min(32, ah - y)
            tier = tiers[t % len(tiers)]
            o = (tier.shape[1] - aw) // 2 + 9 + 23 * t
            arr[y:y + rows_] = tier[0:rows_, o:o + aw] * (0.55 - 0.1 * t) + np.array(hexc("0b0820")) * 0.35
            for _ in range(aw // 12):  # phone lights held up
                fx, fy = rng.randrange(1, aw - 1), y + rng.randrange(0, max(1, rows_ - 1))
                arr[fy, fx] = (255, 252, 230)
                arr[fy + 1 if fy + 1 < ah else fy, fx] = (120, 120, 140)
            y, t = y + 32, t + 1

    # ---- edges: a stepped vignette pulls the eye in ----
    d = np.hypot((xx_all + 0.5 - aw / 2) / (aw / 2), (yy_all + 0.5 - ah * 0.55) / (ah * 0.62)) / math.sqrt(2)
    f = stepped(np.clip((d - 0.55) / 0.45, 0, 1) ** 1.5, 6, yy_all, xx_all) * 0.45
    arr *= (1 - f[..., None])

    # ---- the logo (old mark), the wordmark and tagline, drawn last over everything above the board ----
    mark = old_mark()
    bx = cxm - BALL_W * cb // 2
    sh_y = logo_y + ball_h + cb
    sw = (BALL_W - 6) * cb
    arr[sh_y:sh_y + cb, bx + 3 * cb:bx + 3 * cb + sw] *= 0.45
    arr[sh_y + cb:sh_y + 2 * cb, bx + 5 * cb:bx + 5 * cb + sw - 4 * cb] *= 0.55
    for (x, y), col in mark.items():
        arr[logo_y + y * cb:logo_y + (y + 1) * cb, bx + x * cb:bx + (x + 1) * cb] = col
    word = "RETRO VAULT"
    ww = text_width(word, tc)
    wx = cxm - ww // 2
    r_w = text_width("RETRO ", tc)
    draw_text(arr, "RETRO", tc, wx, text_y, CHALK)
    draw_text(arr, "VAULT", tc, wx + r_w, text_y, lambda r: GOLD_HI if r < 2 * tc else GOLD if r < 5 * tc else
              GOLD_MID)
    tag = "LEAGUE HUB"
    draw_text(arr, tag, tg, cxm - text_width(tag, tg) // 2, tag_y, hexc("c9b8ff"), shadow=hexc("120a28"))

    # ---- the greatest's name on a club-colour strip at the rail (clear of the home indicator) ----
    if people:
        p = people[0]
        label = p["name"].upper()
        lc = tg if text_width(label, tg) + 12 * tg <= aw - 8 else 1
        lw = text_width(label, lc)
        ph_ = 7 * lc + 6
        py = near_y + 5
        if py + ph_ <= ah - bottom:
            x0, x1 = cxm - lw // 2 - 4 * lc - 3, cxm + (lw + 1) // 2 + 4 * lc + 3
            arr[py:py + ph_, x0:x1] = p["primary"]
            arr[py:py + ph_, x0:x0 + 2] = p["secondary"]
            arr[py:py + ph_, x1 - 2:x1] = p["secondary"]
            arr[py, x0:x1] = mix(p["primary"], (255, 255, 255), 0.35)
            arr[py + ph_ - 1, x0:x1] = mix(p["primary"], (0, 0, 0), 0.5)
            ink = (255, 255, 255) if lum(p["primary"]) < 150 else hexc("10131c")
            draw_text(arr, label, lc, cxm - lw // 2, py + 3, ink, shadow=mix(p["primary"], (0, 0, 0), 0.6))
            sm = text_mask("★", 1)
            for sx in (x0 - 9, x1 + 3):
                if 0 <= sx and sx + 5 <= aw:
                    draw_mask(arr, sm, sx, py + (ph_ - 7) // 2, GOLD)

    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    for i, x, y, sc in sorted(placed, key=lambda t: (t[2], -abs(t[1] - cxm))):
        f = people[i]["fig"]
        if f is None:
            continue
        if x > cxm + 1:
            f = f.transpose(Image.FLIP_LEFT_RIGHT)  # the right side faces in
        paste(img, up(f, sc), round(x - 32 * sc), round(y - 58 * sc))
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
    print("Icons:")
    save(icon(180, 3, 0.84), "apple-touch-icon.png")
    save(icon(192, 3, 0.84), "icon-192.png")
    save(icon(512, 6, 0.84), "icon-512.png")
    # maskable: the ball (66% wide, 42% tall) stays inside the centre circle of radius 40%
    save(icon(192, 3, 0.66), "icon-maskable-192.png")
    save(icon(512, 6, 0.66), "icon-maskable-512.png")
    fav = {n: icon_art(n, 0.86, favicon=True) for n in (16, 32, 48)}
    save(fav[32], "favicon-32.png")
    fav[48].save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[fav[16], fav[32]])
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
