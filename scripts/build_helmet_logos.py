#!/usr/bin/env python3
"""Hand-drawn pixel-art helmet logos for the Retro Bowl sprite (source of truth; output is committed).

Every club's helmet decal is drawn here by hand on the sprite's fine grid (2 cells per sprite pixel), in the style of
Retro Bowl's menu helmets: flat colours, no anti-aliasing, letters with 2-cell strokes. A glyph is up to 16 × 14 cells
(nominally 14 × 12) and faces right (+x is the front of the helmet). Rows use '.' for the shell and '1'..'4' for
`colors[0..3]`.

Writes src/components/collection/art/sprite/helmetLogos.ts: { teamId: { rows: [...], colors: [...] } }.
Teams whose helmet carries a shell design instead of a decal (Bengals stripes, Rams horn) or no logo (Browns) are
drawn in helmets.ts and are not listed here.

Usage:
  python3 scripts/build_helmet_logos.py                 # write helmetLogos.ts
  python3 scripts/build_helmet_logos.py --preview x.png # also render every glyph big on its shell (needs Pillow)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "components" / "collection" / "art" / "sprite" / "helmetLogos.ts"
MAX_W, MAX_H = 16, 14

W = "#f4f5f7"
K = "#14161b"


def drop(rows, k="2"):
    """Adds a 1-cell drop shadow (right and below) in colour `k` behind the '1' cells of a letter mark."""
    w = max(len(r) for r in rows) + 1
    g = [list(r.ljust(w, ".")) for r in rows] + [["."] * w]
    on = lambda x, y: 0 <= y < len(rows) and 0 <= x < len(rows[y]) and rows[y][x] == "1"
    for y in range(len(g)):
        for x in range(w):
            if g[y][x] == "." and (on(x - 1, y) or on(x, y - 1) or on(x - 1, y - 1)):
                g[y][x] = k
    return ["".join(r) for r in g]


def beside(*marks, gap=1):
    """Letters side by side, top-aligned, `gap` empty columns apart."""
    h = max(len(m) for m in marks)
    ws = [max(len(r) for r in m) for m in marks]
    return [("." * gap).join((m[j] if j < len(m) else "").ljust(w, ".") for m, w in zip(marks, ws)) for j in range(h)]


# team: (shell colour the glyph is drawn for: the preview, and helmets.ts recolouring on other shells), colours, rows
LOGOS = {
    "bills": ("#f4f5f7", ["#00338d", "#c60c30", "#0a1f44"], [
        "...3333.......",
        "..311113333...",
        ".31111111113.3",
        "3111111111113.",
        "22222222221113",
        ".2222222221113",
        "..311111111113",
        "...31111111.3.",
        "...311..311...",
        "...33...33....",
    ]),
    "dolphins": ("#f4f5f7", ["#008e97", "#fc4c02", "#005778", W], [
        ".....2222.....",
        "...22222222...",
        "..2222222222..",
        "..1111111.....",
        ".111111111111.",
        "11.1111114113.",
        "1...1111111...",
        "11....11......",
        ".11...........",
    ]),
    "patriots": ("#b0b7bc", ["#002244", "#c60c30", W], [
        "......1111....",
        "....11111111..",
        "222211111111..",
        ".33331133331..",
        "..222213333311",
        "...3331333331.",
        "....22113333..",
        ".......1133...",
        "........11....",
    ]),
    # White football-shaped oval on the green shell, a small green "NY" over the green "JETS" wordmark
    "jets": ("#125740", [W, "#125740"], [
        ".....111111.....",
        "...1111111111...",
        ".11121121212111.",
        ".11122121212111.",
        "1111212211211111",
        "1111211211211111",
        "1111111111111111",
        "1121222122212221",
        "1121211112112111",
        "1121221112112221",
        "1121211112111121",
        "1211222112112221",
        "..111111111111..",
        ".....111111.....",
    ]),
    # Purple raven head in profile facing forward: dark purple outline, feather tufts at the back, gold eye with a black pupil, white beak edges
    "ravens": ("#1a1a1a", ["#6a4fc0", W, "#d4a82c", "#3a2a80"], [
        "......44444.....",
        "....441111144...",
        "44441111111114..",
        ".44111111111114.",
        "4444111111331144",
        ".441111111341114",
        "..41111111222222",
        "4444111114444444",
        ".44111111422224.",
        "..411111114444..",
        "...441111144....",
        ".....44444......",
    ]),
    "steelers": ("#14161b", [W, "#ffb612", "#c60c30", "#00539b"], [
        "....1111....",
        "..11111111..",
        ".1111112111.",
        ".1111122211.",
        "111111121111",
        "1......11311",
        "1......13331",
        "1......11311",
        "111111141111",
        ".1111144411.",
        ".1111114111.",
        "..11111111..",
        "....1111....",
    ]),
    "texans": ("#03202f", ["#a71930", W, "#03202f"], [
        "2............2",
        "22..........22",
        ".22........22.",
        "..2222222222..",
        "..2111223332..",
        "..2112223332..",
        "...21122332...",
        "...21222232...",
        "....211332....",
        ".....2222.....",
    ]),
    "colts": ("#f4f5f7", ["#002c5f", W], [
        "11........11",
        "11........11",
        "11........11",
        "121......121",
        "11........11",
        "111......111",
        "121......121",
        ".111....111.",
        "..11111111..",
        "...111111...",
    ]),
    "jaguars": ("#14161b", ["#d7a22a", "#006778", K, W], [
        "..11..........",
        ".111111.......",
        "1111111111....",
        "111311111111..",
        "1131111141111.",
        "1111311111111.",
        "11311111.2222.",
        ".11113111222..",
        "..111111111...",
        "...11111......",
    ]),
    "titans": ("#0c2340", [W, "#c8102e", "#0c2340", "#4b92db"], [
        "........1111....",
        "......11111111..",
        "4....1122222211.",
        ".44.112333333211",
        "..44112333333211",
        "4444112223322211",
        "..44111123321111",
        ".44.111123321111",
        "4....1112332111.",
        ".....1112332111.",
        "......11222211..",
        "........1111....",
    ]),
    "broncos": ("#002244", ["#fb4f14", W, "#002244"], [
        "....111.......",
        "..11112222....",
        ".111222222222.",
        "1111222232222.",
        ".111222222222.",
        "..11222...222.",
        "..1122....2...",
        "...1222.......",
        "....122.......",
    ]),
    "chiefs": ("#e31837", [W, "#e31837"], [
        "...111111.......",
        ".11111111111....",
        "1111111111111...",
        "122112111111111.",
        "1221221122221111",
        "1222211221111111",
        "1222111221111111",
        "1222211221111111",
        "1221221122221111",
        "122112111111111.",
        "1111111111111...",
        ".11111111111....",
        "...111111.......",
    ]),
    "raiders": ("#a5acaf", [K, W, "#a5acaf"], [
        "11111111111111",
        "12222222222221",
        "12121212121221",
        "12222222222221",
        "13111333311131",
        "11313333331311",
        "11133113133111",
        ".111333333111.",
        "..1133113311..",
        "...11333311...",
        "....111111....",
        "......11......",
    ]),
    "chargers": ("#0080c6", ["#ffc20e", W], [
        "..........2222",
        ".......22221112",
        "....2221111122.",
        "..22111111112..",
        "2211111111112..",
        "2222222111122..",
        "......211112...",
        "....2211112....",
        "..22111122.....",
        ".21112222......",
        "2222...........",
    ]),
    "cowboys": ("#b0b7bc", ["#003594", W], [
        "......22......",
        ".....2112.....",
        ".....2112.....",
        "....211112....",
        "2222211112222.",
        "2111111111112.",
        ".21111111112..",
        "..211111112...",
        "..211122112...",
        ".21122..2112..",
        ".2222....222..",
    ]),
    "giants": ("#0b2265", [W, "#a71930"], drop(beside(['11111.', '111111', '11..11', '11..11', '11..11', '11..11'], ['11..11', '11..11', '11..11', '11..11', '111111', '.11111', '....11', '.1111.']))),
    "eagles": ("#004c54", [W, "#a5acaf", K], [
        "...........111..",
        ".......11111122.",
        "....11112222222.",
        "..111222222222..",
        "1112222222333...",
        ".22222233333....",
        "...2223333......",
        "....33..........",
    ]),
    "commanders": ("#5a1414", ["#ffb612", K], [
        "2222.2222.2222",
        "2112.2112.2112",
        "2112.2112.2112",
        "2112.2112.2112",
        "21122111122112",
        ".211112211112.",
        ".211122221112.",
        "..2112..2112..",
        "..2222..2222..",
    ]),
    "bears": ("#0b162a", ["#c83803", W], [
        "....22222222.",
        "...2111111112",
        "..2111111112.",
        ".21112222....",
        ".2112........",
        ".2112........",
        ".2112........",
        ".21112222....",
        "..2111111112.",
        "...2111111112",
        "....22222222.",
    ]),
    "lions": ("#0076b6", ["#c5cbd1", W, "#0b3d66"], [
        "........11....",
        "......11111...",
        ".....1112131..",
        "1...11111111..",
        "11.1111111....",
        ".111111111....",
        "..111111111...",
        "..11.....111..",
        ".11.......11..",
        ".1.........11.",
    ]),
    # Green football oval with a white rim and a white "G", on the gold shell
    "packers": ("#ffb612", [W, "#203731", W], [
        "...1111111111...",
        ".11222222222211.",
        "1122223333332211",
        "1222333333332221",
        "1222332222222221",
        "1222332223333221",
        "1222332222233221",
        "1222333333333221",
        "1122223333332211",
        ".11222222222211.",
        "...1111111111...",
    ]),
    "vikings": ("#4f2683", [W, "#ffc62f"], [
        "22............",
        "122...........",
        "1122..........",
        ".11122........",
        "..1111222.....",
        "...111111222..",
        "....111111112.",
        "......1111111.",
        "........1111..",
    ]),
    # Stylised falcon "F" (mirrored to face forward): black body, white outline, red accents, head and hooked beak top right, wing tips as the F bars
    "falcons": ("#14161b", [K, W, "#a71930", "#a5acaf"], [
        "..........22222.",
        ".........2211122",
        "2222222222113112",
        "2111111111111112",
        "2212123333331122",
        ".22222221112222.",
        "..212111111112..",
        "..221233333112..",
        "...22222211122..",
        "......2211122...",
        "......211222....",
        "......2122......",
        "......222.......",
    ]),
    "panthers": ("#bfc0bf", [K, "#0085ca", W], [
        "..2...........",
        ".212..........",
        "21112222222...",
        "2111111111122.",
        "2111111211112.",
        "21111111111112",
        ".21111113331112",
        "..211113.3.312",
        "...21111111112",
        "....222222222.",
    ]),
    "saints": ("#d3bc8d", [K], [
        "......11......",
        ".....1111.....",
        "..11.1111.11..",
        ".11..1111..11.",
        ".1...1111...1.",
        ".11..1111..11.",
        "..1111111111..",
        "11111111111111",
        "..1111111111..",
        ".....1111.....",
        "....11..11....",
        "...11....11...",
    ]),
    "buccaneers": ("#5b5752", ["#d50a0a", W, K], [
        "31111111111...",
        "3111111111111.",
        "311112221111..",
        "311122222111..",
        "3111232321111.",
        "311112222111..",
        "312111212112..",
        "3112.....211..",
        "311111111111..",
        "3.............",
        "3.............",
    ]),
    "cardinals": ("#f4f5f7", ["#97233f", "#ffb612", K], [
        "....1.........",
        "...111........",
        "..11111.......",
        "..111111......",
        ".1111111111...",
        "11111133331...",
        "1111133333222.",
        "111111111122..",
        ".1111111112...",
        "..111111......",
        "...11.........",
    ]),
    "49ers": ("#b3995d", ["#aa0000", W, K], [
        "...3333333333...",
        ".33111111111133.",
        "3311222211222213",
        "3112211112211113",
        "3112211112211113",
        "3111222112222113",
        "3111112212211113",
        "3111112212211113",
        "3112222112211113",
        ".33111111111133.",
        "...3333333333...",
    ]),
    "seahawks": ("#002244", ["#a5acaf", W, "#69be28", "#0b2a50"], [
        "....1111......",
        "..1111111111..",
        "3311111222211.",
        "..331111243222",
        "....3311222.2.",
        "......3311....",
        ".......331....",
        "........3.....",
    ]),
}

# Period / alternate-uniform logos, chosen by a uniform's helmet override (`logoVariant: '<key>'`, see helmets.ts).
# Keyed '<team>-<era>'; each is drawn for the shell given (helmets.ts adapts the colours to other shells).
VARIANTS = {
    # Broncos 1977 (Orange Crush): orange "D", white outline, a white bronco in the counter
    "broncos-d": ("#1f3c88", ["#fb4f14", W], [
        "2222222222....",
        "21111111122...",
        "211111111122..",
        "2111....11122.",
        "2111...221112.",
        "2111..2222112.",
        "2111.22.21112.",
        "2111...2.1112.",
        "2111.....1112.",
        "2111....11122.",
        "211111111122..",
        "21111111122...",
        "2222222222....",
    ]),
    # Dolphins 1972: orange sunburst, aqua dolphin leaping across it in a navy helmet
    "dolphins-1972": ("#f4f5f7", ["#008e97", "#fc4c02", "#1a2d5a", W], [
        "....2..2..2.....",
        ".2...222222...2.",
        "..22222222222...",
        ".2222222222222..",
        "22222222222222..",
        ".111111111.333..",
        "1111111111113333",
        "11..111111113434",
        "1.....1111111...",
        "11......11......",
        ".1..............",
    ]),
    # Washington 1970s/80s: gold "R" with a white outline
    "commanders-r": ("#651c32", ["#feb71c", W], [
        "2222222222..",
        "21111111122.",
        "21111111112.",
        "21122222112.",
        "21122222112.",
        "21111111112.",
        "21111111122.",
        "2112221122..",
        "2112.221122.",
        "2112..221122",
        "2112...22112",
        "2222....2222",
    ]),
    # Bucs 1976-96 "Bucco Bruce": orange pirate, red plume and hat band, a wink, a knife in his teeth
    "bucs-bruce": ("#f4f5f7", ["#f58025", "#d50a0a", K, "#a5acaf"], [
        "........222.....",
        ".......22222....",
        "..1111111222....",
        ".111111111111...",
        "..3333333333....",
        "...111111111....",
        "...131113331....",
        "...111111111....",
        "44444441444444..",
        "...1113331......",
        "....111111......",
        "......11........",
    ]),
    # Pat Patriot (1961-92): navy tricorn, red coat, crouched over a brown ball
    "patriots-pat": ("#f4f5f7", ["#002244", "#c60c30", "#e0a986", "#7a4a1c"], [
        ".....1111.......",
        "...11111111.....",
        "..1111111111....",
        ".....3333.......",
        ".....3333.......",
        "....22222.......",
        "...2222222......",
        "..222222222.44..",
        "..2222222224444.",
        "...22222222.44..",
        "...111..111.....",
        "...11....11.....",
    ]),
    # Houston Oilers: red oil derrick with a white outline
    "titans-oilers": ("#7ab2dd", ["#c8102e", W], [
        "....2222....",
        "....2112....",
        "...221122...",
        "...211112...",
        "...212212...",
        "..22111122..",
        "..21211212..",
        "..21122112..",
        ".221211212..",
        ".2111111122.",
        ".2121221212.",
        "221122221122",
        "211111111112",
        "222222222222",
    ]),
}
# Era recolours of the modern glyphs: 1970s/80s 49ers oval (white rim, no black), 1960s Packers G (no white rim),
# 1990s Lions (a plain Honolulu-blue leaping lion on the silver shell)
VARIANTS["49ers-80s"] = ("#b3995d", ["#aa0000", W, W], LOGOS["49ers"][2])
VARIANTS["packers-60s"] = ("#ffb612", ["#ffb612", "#203731", W], LOGOS["packers"][2])
VARIANTS["lions-90s"] = ("#b0b7bc", ["#0076b6", "#0076b6", "#0076b6"], LOGOS["lions"][2])


def check():
    for team, (_, colors, rows) in {**LOGOS, **VARIANTS}.items():
        w = max(len(r) for r in rows)
        assert w <= MAX_W and len(rows) <= MAX_H, f"{team}: {w}×{len(rows)} is over {MAX_W}×{MAX_H}"
        used = {c for r in rows for c in r if c != "."}
        assert all(c in "1234" and int(c) <= len(colors) for c in used), f"{team}: colour index out of range {used}"


def write():
    # `shell` is the shell each glyph was drawn for; helmets.ts uses it to keep the glyph readable on other shells
    out = {t: {"rows": [r.ljust(max(len(x) for x in rows), ".") for r in rows], "colors": colors, "shell": shell} for t, (shell, colors, rows) in {**LOGOS, **VARIANTS}.items()}
    head = ("// Generated by scripts/build_helmet_logos.py (do not hand-edit): hand-drawn pixel-art helmet logos on the sprite's fine grid.\n"
            "export const HELMET_LOGOS: Record<string, { rows: string[]; colors: string[]; shell: string }> = ")
    OUT.write_text(head + json.dumps(out, indent=1) + ";\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} logos")


def preview(path: str, s: int = 14):
    from PIL import Image, ImageDraw

    cell_w, cell_h = (MAX_W + 4) * s, (MAX_H + 4) * s + 16
    cols = 8
    n = len(LOGOS) + len(VARIANTS)
    img = Image.new("RGB", (cols * cell_w, -(-n // cols) * cell_h), "#1b2030")
    d = ImageDraw.Draw(img)
    for i, (team, (shell, colors, rows)) in enumerate({**LOGOS, **VARIANTS}.items()):
        ox, oy = (i % cols) * cell_w, (i // cols) * cell_h
        d.rectangle([ox + s, oy + s, ox + cell_w - s, oy + cell_h - 16 - s], fill=shell)
        w = max(len(r) for r in rows)
        x0 = ox + (cell_w - w * s) // 2
        y0 = oy + (cell_h - 16 - len(rows) * s) // 2
        for j, r in enumerate(rows):
            for k, c in enumerate(r):
                if c != ".":
                    d.rectangle([x0 + k * s, y0 + j * s, x0 + (k + 1) * s - 1, y0 + (j + 1) * s - 1], fill=colors[int(c) - 1])
        d.text((ox + s, oy + cell_h - 14), team, fill="#ccd")
    img.save(path)
    print(f"preview: {path}")


if __name__ == "__main__":
    check()
    if "--preview" in sys.argv:
        preview(sys.argv[sys.argv.index("--preview") + 1])
    if "--no-write" not in sys.argv:
        write()
