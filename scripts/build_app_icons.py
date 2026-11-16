#!/usr/bin/env python3
"""Home Screen app art for Retro Vault: the app icons and the iOS launch (splash) screens, from the game's own art.

* Icon: a shaded pixel football (leather ramp, cream stripes, lace stitches and seams, a floodlight rim light) with a
  soft drop shadow, on Retro Bowl's own day turf (public/private-sprites/field/turf-day-tall.png: the mowed 5-yard
  stripes, a yard line and the hash marks crossing behind) under a gentle vignette. The favicons draw a simpler ball.
* Splash: a night stadium built from the game's field art (stands, crowd and sideline recoloured in the champion
  club's colours, the night turf with its yard numbers), two floodlight towers, a jumbotron and an LED ribbon naming
  the latest Super Bowl champion, the "RETRO VAULT" wordmark on the stadium fascia, and the champions on the field in
  their kit at 2x (GameSprite figures from public/private-sprites/nfl/: the star in front celebrating, two ring
  holders beside him, Dorren Skura and one more behind) under falling confetti, the near stands in the dark below.

Every image is drawn on a grid of whole art pixels and blown up by a whole number with nearest-neighbour, so nothing
is ever blurry. The champion comes from the data (public/data/widget.json `champion` / `photo`, the ring holders by
scripts/build_widget_data.py's champion_roster, the kit and pose by the site's own sprite rules through
scripts/widget_sprites.py), so `npm run rebuild` runs this after the widget feed and the splash follows each new
champion. Deterministic: two runs give the same bytes.

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
WIDGET = PUBLIC / "data" / "widget.json"
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
NEUTRAL_MAIN, NEUTRAL_SHADE, NEUTRAL_TRIM = 0xBFBFBF, 0x8F8F8F, 0xFBFFFD


class Champions:
    """The latest champion and the figures for the photo, from the data and the site's own sprite rules."""

    def __init__(self) -> None:
        self.team = "Eagles"
        self.season = ""
        self.roman = ""
        self.figures: list[tuple[str, Image.Image]] = []  # (role, 64 x 64 RGBA on the anchor), star first
        self.coach: Image.Image | None = None
        self.colours = {"primary": hexc("004c54"), "secondary": hexc("f4f5f7"), "trim": hexc("14161b"),
                        "shade": hexc("003439")}
        self.load()

    def load(self) -> None:
        widget = json.loads(WIDGET.read_text()) if WIDGET.exists() else {}
        champ = widget.get("champion") or {}
        if not champ.get("winner"):
            return
        self.team, self.season, self.roman = champ["winner"], champ.get("season", ""), champ.get("roman", "")
        if not (NFL / "index.json").exists():
            return
        import build_widget_data as W  # the ring holders (the site's TeamPhoto rule)
        import widget_sprites as WS  # the site's sprite picks and kit palettes, the GameSprite painter

        year = int(str(self.season).lstrip("Y") or 0)
        roster = W.champion_roster(year, self.team)
        photo = widget.get("photo") or {}
        star_key = next((p["player"] for p in photo.get("players", []) if p.get("star")), None) \
            if photo.get("season") == self.season else None
        keys = [W.KEY[p["n"]] for p in roster]
        if star_key in keys:
            keys.remove(star_key)
            keys.insert(0, star_key)
        keys = keys[:4]
        jobs = [{"key": k, "club": self.team, "action": "celebrate" if i == 0 else "idle"} for i, k in enumerate(keys)]
        palettes, picks = WS.site_rules(jobs) if jobs else ({}, [])
        pal = palettes.get(self.team)
        if pal:
            j, p = pal["jersey"], pal["pants"]
            self.colours = {"primary": tuple(j[str(NEUTRAL_MAIN)]), "shade": tuple(j[str(NEUTRAL_SHADE)]),
                            "trim": tuple(j[str(NEUTRAL_TRIM)]), "secondary": tuple(p[str(NEUTRAL_MAIN)])}
        for k, pick in zip(keys, picks):
            if pick and (NFL / pick["file"]).exists():
                self.figures.append((k, WS.figure(pick, palettes)))
        index = json.loads((NFL / "index.json").read_text())
        head = (index.get("coaches") or {}).get("head") or {}
        f = (head.get("kits") or {}).get(self.team)
        if f and (NFL / f).exists():
            cx, foot = (index.get("anchors") or {}).get(f, [31.5, 58])
            src = Image.open(NFL / f).convert("RGBA")
            out = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
            out.paste(src, (int(round(WS.CX - cx)), int(round(WS.FOOT - foot))))
            self.coach = out


def recolour(img: Image.Image, cols: dict, light: float = 1.0) -> Image.Image:
    """The game's key colours (green primary, magenta secondary, cyan trim) into the club's, everything times light."""
    a = np.array(img.convert("RGBA")).astype(float)
    rgb = a[..., :3]
    for key, to in ((KEY_PRIMARY, cols["primary"]), (KEY_SECONDARY, cols["secondary"]), (KEY_TRIM, cols["trim"])):
        m = np.all(rgb == key, axis=-1)
        rgb[m] = to
    rgb *= light
    a[..., :3] = np.clip(rgb, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def lift(c: RGB, min_l: int = 70) -> RGB:
    """A club colour bright enough to read on night navy (keeps its hue)."""
    lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    if lum >= min_l:
        return c
    k = min_l / max(lum, 1)
    out = tuple(min(255, round(v * k + 18)) for v in c)
    return out  # type: ignore[return-value]


def add_light(arr: np.ndarray, mask: np.ndarray, colour: RGB, amount: float) -> None:
    arr[mask] = np.clip(arr[mask] + np.array(colour) * amount, 0, 255)


def splash_art(aw: int, ah: int, top: int, bottom: int, ch: Champions) -> Image.Image:
    """The scene on an aw x ah art grid; top / bottom: the art rows the status bar and home indicator cover."""
    rng = random.Random(f"{ch.season}{ch.team}{aw}x{ah}")
    cols = ch.colours
    arr = np.zeros((ah, aw, 3), float)
    cxm = aw // 2

    # ---- the stack, top to bottom ----
    jumbo_h = 26
    jumbo_y = top + 3
    facade_y = jumbo_y + jumbo_h - 6
    crowd_a = facade_y + 22
    band_y = crowd_a + 30
    rc = 4 if aw >= 240 else 3  # RETRO's cell
    big = rc + 2  # VAULT's
    r_top = band_y + 5  # the glyph rows: RETRO, VAULT, the tagline
    v_top = r_top + 7 * rc + 2 + 3
    tag_y = v_top + 7 * big + 3 + 5
    band_h = tag_y + 7 + 5 - band_y
    crowd_b = band_y + band_h - 2
    ribbon_y = crowd_b + 30
    feet = ah - bottom - 10
    fig_h = 94 + 24  # the back row at 2x, feet to the top of the head
    if feet - fig_h < ribbon_y + 9 + 36 + 8:
        ribbon_y = crowd_b = band_y + band_h  # short screens (iPhone SE): one crowd tier
    turf_y = ribbon_y + 9
    feet = min(feet, turf_y + 192)  # the team stands on the field, above the near sideline
    near_y = max(feet + 8, turf_y + 222)  # the near stands, in the dark below the field
    # ---- sky: banded night, stars ----
    sky_top, sky_bot = hexc("05081a"), hexc("1d2a57")
    for y in range(ah):
        t = min(1.0, y / max(1, crowd_a))
        t = math.floor(t * 7 + BAYER[y % 4][0] * 0.0) / 7
        arr[y, :] = mix(sky_top, sky_bot, t ** 1.4)
    for _ in range(aw * crowd_a // 70):
        x, y = rng.randrange(aw), rng.randrange(max(1, crowd_a))
        b = rng.choice((90, 140, 200))
        arr[y, x] = (b, b, min(255, b + 30))
    # ---- floodlight towers (behind the stands) ----
    lamp_w, lamp_h = 21, 13
    towers = [(3, top - 6), (aw - lamp_w - 3, top - 6)]
    for tx, ty in towers:
        ty = max(2, ty)
        # the glow: stepped halo
        yy, xx = np.mgrid[0:ah, 0:aw]
        d = np.hypot((xx - (tx + lamp_w / 2)) / 1.0, (yy - (ty + lamp_h / 2)) * 1.25)
        for r, k in ((44, 0.06), (32, 0.08), (22, 0.12), (15, 0.16)):
            add_light(arr, d <= r, (255, 236, 190), k)
        # beams toward the field centre
        for spread, k in ((10, 0.05), (5, 0.05)):
            x0, y0 = tx + lamp_w / 2, ty + lamp_h
            tgt_x, tgt_y = cxm, feet
            for y in range(int(y0), int(feet)):
                f = (y - y0) / (tgt_y - y0)
                mid = x0 + (tgt_x - x0) * f
                half = 3 + spread * f * 4
                xs = np.arange(aw)
                m = np.abs(xs - mid) <= half
                arr[y, m] = np.clip(arr[y, m] + np.array((255, 240, 205)) * k * (1 - f * 0.6), 0, 255)
        # the pole
        px0 = tx + lamp_w // 2 - 1
        arr[ty + lamp_h:crowd_a + 4, px0:px0 + 3] = hexc("2b3245")
        arr[ty + lamp_h:crowd_a + 4, px0] = hexc("4a5470")
        for yb in range(ty + lamp_h + 3, crowd_a, 5):  # lattice rungs
            arr[yb, px0 - 1:px0 + 4] = hexc("39415a")
        # the lamp bank: a frame and 5 x 3 lamps
        arr[ty:ty + lamp_h, tx:tx + lamp_w] = hexc("1a1f2e")
        arr[ty, tx:tx + lamp_w] = hexc("4a5470")
        for r in range(3):
            for c in range(5):
                lx, ly = tx + 1 + c * 4, ty + 1 + r * 4
                arr[ly:ly + 3, lx:lx + 3] = hexc("fff4cf")
                arr[ly, lx] = (255, 255, 255)
                arr[ly + 2, lx + 2] = hexc("ffd98a")
    # ---- jumbotron: the champion ----
    jw = min(aw - 2 * (lamp_w + 10), 104)
    jx = cxm - jw // 2
    arr[jumbo_y + jumbo_h:facade_y + 4, jx + 8:jx + 11] = hexc("2b3245")  # legs
    arr[jumbo_y + jumbo_h:facade_y + 4, jx + jw - 11:jx + jw - 8] = hexc("2b3245")
    arr[jumbo_y:jumbo_y + jumbo_h, jx:jx + jw] = hexc("10131c")
    arr[jumbo_y, jx:jx + jw] = hexc("5b6584")
    arr[jumbo_y + 1:jumbo_y + jumbo_h - 1, jx + 1:jx + jw - 1] = hexc("2a3042")
    sx0, sy0, sw, sh = jx + 3, jumbo_y + 3, jw - 6, jumbo_h - 6
    screen = mix(cols["shade"], (0, 0, 0), 0.35)
    arr[sy0:sy0 + sh, sx0:sx0 + sw] = screen
    for y in range(sy0, sy0 + sh, 2):  # LED scan rows
        arr[y, sx0:sx0 + sw] = np.clip(arr[y, sx0:sx0 + sw] * 0.78, 0, 255)
    team_word = ch.team.upper()
    l1 = text_mask(team_word, 1)
    l2 = text_mask(f"{ch.season} CHAMPIONS" if ch.season else "CHAMPIONS", 1)
    draw_mask(arr, l1, cxm - l1.shape[1] // 2, sy0 + 1, (255, 255, 255))
    draw_mask(arr, l2, cxm - l2.shape[1] // 2, sy0 + 10, GOLD)
    # ---- the upper facade (the game's stands art, lit steel) and crowd ----
    stands = recolour(Image.open(FIELD / "stands.png"), cols)
    st = np.array(stands.convert("RGB")).astype(float)
    # blue truss into night steel
    st = st * np.array([0.22, 0.26, 0.40]) + 6
    off = (st.shape[1] - aw) // 2
    arr[facade_y:facade_y + 22] = st[11:33, off:off + aw]
    crowd_img = recolour(Image.open(FIELD / "crowd.png"), cols, 0.9)
    cr = np.array(crowd_img.convert("RGB")).astype(float)

    def crowd_tier(y: int, shift: int, flashes: int) -> None:
        o = (cr.shape[1] - aw) // 2 + shift
        arr[y:y + 32] = cr[0:32, o:o + aw]
        for _ in range(flashes):  # camera flashes
            fx, fy = rng.randrange(1, aw - 1), y + rng.randrange(1, 31)
            arr[fy, fx] = (255, 255, 255)
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                arr[fy + oy, fx + ox] = np.clip(arr[fy + oy, fx + ox] + 90, 0, 255)

    crowd_tier(crowd_a, 0, 4)
    if crowd_b < ribbon_y:
        crowd_tier(crowd_b, 17, 5)
    arr[crowd_a - 1] = hexc("0c0f18")
    # ---- LED ribbon board under the lower tier ----
    arr[ribbon_y:ribbon_y + 9] = hexc("07090f")
    arr[ribbon_y] = hexc("3a4157")
    arr[ribbon_y + 8] = hexc("1b2030")
    msg = f"SUPER BOWL {ch.roman} ★ {ch.team.upper()} ★ " if ch.roman else "RETRO VAULT ★ "
    rib = text_mask(msg * 6, 1)
    o = (ch.season.__hash__() and 0) + 7
    for yy in range(7):
        for xx in range(aw):
            if rib[yy, (xx + o) % rib.shape[1]]:
                arr[ribbon_y + 1 + yy, xx] = GOLD if yy < 4 else GOLD_MID
    # ---- the field: the game's night turf, the bench recoloured ----
    turf = np.array(recolour(Image.open(FIELD / "turf-night.png"), cols).convert("RGB")).astype(float)
    to = 320 - aw // 2
    rows = min(ah - turf_y, turf.shape[0])
    arr[turf_y:turf_y + rows] = turf[0:rows, to:to + aw]
    if turf_y + rows < ah:
        arr[turf_y + rows:] = turf[-1, to:to + aw]
    # floodlight pool on the field around the team
    yy, xx = np.mgrid[0:ah, 0:aw]
    d = np.hypot((xx - cxm) / (aw * 0.55), (yy - (feet - 18)) / 46)
    for r, k in ((1.0, 0.05), (0.75, 0.06), (0.5, 0.07)):
        m = (d <= r) & (yy >= turf_y + 36)
        arr[m] = np.clip(arr[m] * (1 + k) + 4, 0, 255)
    # ---- the near stands: a padded wall with a gold rail, the crowd below it in silhouette ----
    if near_y < ah:
        arr[near_y:near_y + 2] = GOLD_LO
        arr[near_y] = GOLD
        wall = mix(cols["shade"], (0, 0, 0), 0.25)
        arr[near_y + 2:near_y + 7] = wall
        arr[near_y + 2] = mix(wall, (255, 255, 255), 0.15)
        y, k = near_y + 7, 0
        while y < ah:
            o = (cr.shape[1] - aw) // 2 + 9 + 23 * k
            rows_ = min(32, ah - y)
            tier = cr[0:rows_, o:o + aw] * (0.42 - 0.08 * k) + np.array(hexc("0b1024")) * 0.35
            arr[y:y + rows_] = tier
            y, k = y + 32, k + 1
    # ---- the title band (stadium fascia over the stands, the crowd dimly through it) ----
    band = arr[band_y:band_y + band_h]
    band *= 0.24
    band += np.array(hexc("0b1024")) * 0.76
    arr[band_y] = GOLD_LO
    arr[band_y + 1] = GOLD_DEEP
    arr[band_y + band_h - 1] = GOLD_LO
    arr[band_y + band_h - 2] = GOLD_DEEP
    for x in range(2, aw - 2, 6):  # fascia rivets
        arr[band_y + 3, x] = hexc("2a3252")
        arr[band_y + band_h - 4, x] = hexc("2a3252")
    retro, vault = text_mask("RETRO", rc), text_mask("VAULT", big)
    # RETRO: chalk with a cool shade, a dark outline
    face, ext, ring = outlined(retro, 3, 2)
    rx, ry = cxm - face.shape[1] // 2, r_top - 3
    draw_mask(arr, ring, rx, ry, INK)
    draw_mask(arr, ext, rx, ry, hexc("4b5784"))
    draw_mask(arr, face, rx, ry, lambda r: CHALK if r - 3 < 4 * rc else CHALK_LO)
    # gold stars either side of RETRO
    star = text_mask("★", 1)
    for sx in (rx - 4 - star.shape[1], rx + face.shape[1] + 4):
        draw_mask(arr, star, sx, r_top + (7 * rc - 7) // 2, GOLD)
    # VAULT: gold ramp, a deep amber extrusion
    face, ext, ring = outlined(vault, 4, 3)
    vx, vy = cxm - face.shape[1] // 2, v_top - 4
    vh = 7 * big
    ramp = lambda r: (GOLD_HI if r - 4 < vh * 0.25 else GOLD if r - 4 < vh * 0.55 else GOLD_MID  # noqa: E731
                      if r - 4 < vh * 0.8 else GOLD_LO)
    draw_mask(arr, ring, vx, vy, INK)
    draw_mask(arr, ext, vx, vy, GOLD_DEEP)
    draw_mask(arr, face, vx, vy, ramp)
    for i in range(big - 1):  # a glint on the V
        arr[v_top + 1 + i, vx + 4 + 1 + i] = (255, 255, 240)
    tag = "STATS · CARDS · LEGENDS"
    tm = text_mask(tag, 1)
    draw_mask(arr, tm, cxm - tm.shape[1] // 2, tag_y, MUTED)
    # ---- confetti in the club's colours and gold ----
    conf_cols = [lift(cols["primary"], 90), cols["secondary"], GOLD, GOLD_HI, (255, 255, 255), lift(cols["shade"], 80)]
    for _ in range(aw * (feet - band_y - band_h) // 120):
        x, y = rng.randrange(aw), rng.randrange(band_y + band_h, feet + 6)
        if band_y - 1 <= y <= band_y + band_h or ribbon_y - 1 <= y <= ribbon_y + 9:
            continue
        c = rng.choice(conf_cols)
        shape = rng.randrange(4)
        cells = [(0, 0)] + ([(1, 0)] if shape == 1 else [(0, 1)] if shape == 2 else [(1, 1)] if shape == 3 else [])
        for ox, oy in cells:
            if 0 <= x + ox < aw and 0 <= y + oy < ah:
                arr[y + oy, x + ox] = c
    for _ in range(aw * max(1, near_y - feet) // 60):  # some on the turf
        x, y = rng.randrange(aw), rng.randrange(feet - 4, max(feet - 3, min(ah, near_y)))
        arr[y, x] = np.array(rng.choice(conf_cols)) * 0.7
    # above the band, a few drifting pieces over the crowd
    for _ in range(aw // 6):
        x, y = rng.randrange(aw), rng.randrange(crowd_a, band_y - 1)
        arr[y, x] = rng.choice(conf_cols)

    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")

    # ---- the champions' photo, a step closer (2x): the star in front celebrating, two ring holders beside him,
    # Dorren Skura and one more behind ----
    people = [f for _, f in ch.figures[:4]]
    slots = [(0, 0), (-56, -4), (56, -4), (32, -24)][:len(people)]
    if ch.coach is not None:
        people.append(ch.coach)
        slots.append((-32, -24))
    for i in sorted(range(len(people)), key=lambda i: slots[i][1]):
        dx, dy = slots[i]
        f = people[i]
        if dx > 0:
            f = f.transpose(Image.FLIP_LEFT_RIGHT)
        paste(img, up(f, 2), cxm - 64 + dx, feet - 116 + dy)
    return img


def safe_rows(h_css: int, dpr: int, s: int) -> tuple[int, int]:
    """Art rows under the status bar and the home indicator (portrait)."""
    top_css = 20 if h_css < 700 else 62 if h_css >= 852 else 50
    bot_css = 0 if h_css < 700 else 34
    return math.ceil(top_css * dpr / s), math.ceil(bot_css * dpr / s)


def splash(w_css: int, h_css: int, dpr: int, ch: Champions) -> Image.Image:
    w, h = w_css * dpr, h_css * dpr
    s = max(2, int(w / 240 + 0.6))  # about 240 art pixels across
    aw, ah = math.ceil(w / s), math.ceil(h / s)
    top, bottom = safe_rows(h_css, dpr, s)
    art = splash_art(aw, ah, top, bottom, ch)
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
    ch = Champions()
    print(f"Splash screens ({ch.season} {ch.team}, {len(ch.figures)} players{', coach' if ch.coach else ''}):")
    for w, h, dpr in SPLASH:
        save(splash(w, h, dpr, ch), splash_name(w, h, dpr))


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
