#!/usr/bin/env python3
"""Copy the owner's own NFL Retro Bowl player sprites into the PRIVATE folder the site uses on this Mac.

Owner choice (2026-11-13): the game's art (New Star Games; the NFL edition adds NFL and NFLPA marks) is shown only on
this Mac, never on the public site. This script holds no art. It reads the newest save pulled by scripts/pull_save.py
(data/saves/<date>/nfl/Documents/, git-ignored) through scripts/save_read.py (the slot with the highest settings.year,
its reader and its matcher: normalised name + position), skips a uid shared by players who look different (uids repeat
in the pool; see main), and copies only the matched
players' sprites from rb_nfl_players_2024/faces_img/ into public/private-sprites/nfl/ (git-ignored). The GitHub Pages
build never has that folder, so the public site is unchanged; the dev server and the LAN preview show them.

    python3 scripts/private_nfl_sprites.py [path/to/Documents or a save slot] [--coaches]

--coaches refreshes only the coach and staff sprites and index.coaches (the players' files stay as they are).

Sprites in the game: faces_img/<uid>_<kit>[_p2.._p5].png, 64 x 64 full-body players drawn in real kits with their
numbers; <kit> is a club uid (000-031, the save's teams.list) or 800, a neutral white kit; no suffix = pose 1.

Output: public/private-sprites/nfl/<uid>_<kit>[_pN].png and index.json (with "anchors": file -> [centre x, feet row],
the figure's own centre line and baseline, so the site can centre the player rather than the canvas):
    { "players": { "<POS>:<Name>": { "uid": "...", "kits": { "<Club>": [1, 2] }, "neutral": [1] } },
      "coaches": { "head": { "name", "uid", "kits": { "<Club>": file }, "neutral": file, "mask": [...] },
                   "staff": [{ "name", "role": "OC" | "DC", "uid", "teamid", "club", "kits", "neutral", "mask" }],
                   "polo": { "<Club>": "#rrggbb" } },
      "save": {...}, "unmatched": [...] }
Coaches and coordinators (coach_sprites): faces_img/<uid>_<club>.png in a club polo, <uid>_900.png in white; the head
coach is settings.myface_uid, the staff coaches.pool (teamid = his club, or -1 on the market).
Club names are the site's (the save's team names: "Eagles", "49ers").
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import save_read  # noqa: E402  (the save importer: one reader and one matcher for the whole site)

OUT = ROOT / "public" / "private-sprites" / "nfl"
SPRITE = re.compile(r"^(\d+)_(\d{3})(?:_p([2-9]))?\.png$")


def anchor(path: Path) -> list[float]:
    """Where the figure stands in its 64 x 64 frame: [centre x, last row of the feet]. The centre is the middle of the
    legs and shoes (rows 50 down, solid pixels only), so a held ball, a raised arm or the soft ground shadow doesn't
    pull it sideways; the site centres every sprite on it and stands it on a shared baseline."""
    im = Image.open(path).convert("RGBA")
    px = im.load()
    solid = [(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3] > 200]
    if not solid:
        return [im.width / 2, im.height - 1]
    foot = max(y for _, y in solid)
    legs = [x for x, y in solid if y >= foot - 9]
    return [round((min(legs) + max(legs) + 1) / 2, 1), foot]


STAFF_ROLE = {100: "HC", **save_read.STAFF_ROLE}  # coaches.pool position codes: 100 head coach, 101 DC, 102 OC
WHITE = (255, 255, 255)


def coach_sprites(save, sprites: dict, clubs: dict[int, str], img_dir: Path, anchors: dict) -> dict:
    """The head coach (settings.myface_uid) and every coordinator in coaches.pool (the club's OC and DC, teamid = the
    coach's club, and the ones on the market, teamid -1). The game draws staff as one 64 x 64 standing figure in a
    club polo (<uid>_<club>.png) and a white neutral one (<uid>_900.png), with their own faces, glasses and beards.

    A staff member's club polo is his neutral sprite multiplied, pixel by pixel, by one club colour (checked over the
    save's 80 staff and 404 club files: 142,754 of 142,788 kit pixels within 1 of round-down(colour x neutral / 255)),
    on the pixels his outfit covers (shirt or hoodie, its shading, trousers, shoes; never the face, glasses or the white
    teeth). So the index keeps, per club, that `polo` colour (read from every staff file), and per staff member the
    `mask` of his outfit pixels (the union of the pixels any of his club files changes: 64 rows of 16 hex digits, bit
    63 - x of a row = column x), and the site paints a club he has no file for exactly as the game would."""
    raw = json.loads(save.path.read_text())
    st = raw["settings"]
    my_uid = str(int(float(st.get("myface_uid", -1))))
    my_team = int(float(st.get("myteam_id", -1)))
    polo_votes: dict[int, dict[tuple, int]] = defaultdict(lambda: defaultdict(int))

    def entry(uid: str) -> dict | None:
        files = {kit: name for kit, pose, name in sprites.get(uid, []) if pose == 1}
        if 900 not in files:
            return None
        neutral = Image.open(img_dir / files[900]).convert("RGBA").load()
        mask = [0] * 64
        kits: dict[str, str] = {}
        for kit, name in sorted(files.items()):
            shutil.copy2(img_dir / name, OUT / name)
            anchors[name] = anchor(OUT / name)
            if kit == 900 or kit not in clubs:
                continue
            kits[clubs[kit]] = name
            im = Image.open(img_dir / name).convert("RGBA").load()
            for y in range(64):
                for x in range(64):
                    if im[x, y] != neutral[x, y]:
                        mask[y] |= 1 << (63 - x)
                        if neutral[x, y][:3] == WHITE:
                            polo_votes[kit][im[x, y][:3]] += 1
        return {"uid": uid, "kits": kits, "neutral": files[900], "mask": [f"{m:016x}" for m in mask]}

    head = entry(my_uid)
    if head:
        head = {"name": f'{st.get("fname", "")} {st.get("lname", "")}'.strip(), **head}
    staff = []
    for c in raw.get("coaches", {}).get("pool", []):
        role = STAFF_ROLE.get(int(float(c.get("position", 0))))
        e = entry(str(c["uid"])) if role else None
        if not e:
            continue
        team = int(float(c.get("teamid", -1)))
        staff.append({"name": f'{c.get("fname", "")} {c.get("lname", "")}'.strip(), "role": role, "teamid": team,
                      "club": clubs.get(team), **e})
    staff.sort(key=lambda s: (s["teamid"] != my_team, s["role"] != "OC", s["name"]))

    # every staff sprite in the folder votes for its club's polo colour, not only the coach's and coordinators'
    for uid, files in sprites.items():
        if not uid.startswith("9") or not any(k == 900 for k, _, _ in files):
            continue
        neutral = None
        for kit, pose, name in files:
            if pose != 1 or kit not in clubs or kit in polo_votes and sum(polo_votes[kit].values()) > 2000:
                continue
            neutral = neutral or Image.open(img_dir / f"{uid}_900.png").convert("RGBA").load()
            im = Image.open(img_dir / name).convert("RGBA").load()
            for y in range(27, 64):
                for x in range(64):
                    if neutral[x, y][:3] == WHITE and neutral[x, y][3] == 255 and im[x, y] != neutral[x, y]:
                        polo_votes[kit][im[x, y][:3]] += 1
    polo = {clubs[k]: "#%02x%02x%02x" % max(v.items(), key=lambda kv: kv[1])[0]
            for k, v in sorted(polo_votes.items()) if v}
    return {"head": head, "staff": staff, "polo": polo,
            "file": "{uid}_{club:03d}.png (club polo; one standing pose), {uid}_900.png (white neutral)"}


def report_coaches(coaches: dict) -> None:
    head = coaches.get("head") or {}
    print(f"head coach {head.get('name')} ({head.get('uid')}): kits " + ", ".join(head.get("kits", {})))
    print(f"staff ({len(coaches['staff'])}): " + ", ".join(
        f"{s['name']} {s['role']} ({s['club'] or 'market'}; {len(s['kits'])} kits)" for s in coaches["staff"]))
    print(f"polo colours for {len(coaches['polo'])} clubs")


def main() -> None:
    # --coaches: refresh only the coach and staff sprites (and index.coaches), leaving the players' files as they are
    coaches_only = "--coaches" in sys.argv[1:]
    args = [a for a in sys.argv[1:] if a != "--coaches"]
    arg = Path(args[0]) if args else None
    if arg and arg.is_dir():  # a Documents folder: its slot with the highest settings.year
        arg = max(arg.glob("rb_nfl_savedata_[0-9]*.json"), key=lambda f: json.loads(f.read_text())["settings"]["year"])
    slot = save_read.find_save(path=str(arg) if arg else None)
    docs = slot.parent
    save = save_read.Save(slot)
    clubs = {uid: t["name"] for uid, t in save.teams.items()}
    # Players are matched the importer's way (normalised name + position; a name found once at another position in
    # the same stat group). uids repeat in the pool: the game's generated players (900xxx) are drawn from a look
    # template, and the players sharing one have the same skin and skin colour (100 of 104 groups in the Y93 save), so
    # the uid's sprite is how the game draws each of them. A uid shared by people with different skins can't say
    # whose sprite it is: those players are ambiguous and keep the regular-game fallback.
    pairs, missing, _ = save_read.match(save, save_read.rv_players())
    looks_by_uid: dict[str, set[tuple[str, int]]] = defaultdict(set)
    for p in save.players:
        looks_by_uid[p["uid"]].add((str(int(float(p["raw"].get("skin", -1)))), int(float(p["raw"].get("col_skin", -1)))))

    sprites: dict[str, list[tuple[int, int, str]]] = defaultdict(list)  # uid -> [(kit, pose, file)]
    img_dir = docs / "rb_nfl_players_2024" / "faces_img"
    for f in img_dir.iterdir():
        m = SPRITE.match(f.name)
        if m:
            sprites[m.group(1)].append((int(m.group(2)), int(m.group(3) or 1), f.name))

    if coaches_only:
        index = json.loads((OUT / "index.json").read_text())
        old = index.get("coaches") or {}
        for c in [old.get("head") or {}, *old.get("staff", [])]:  # the last run's coach files go first
            for name in [*c.get("kits", {}).values(), c.get("neutral")]:
                if name:
                    (OUT / name).unlink(missing_ok=True)
                    index.get("anchors", {}).pop(name, None)
        index["coaches"] = coach_sprites(save, sprites, clubs, img_dir, index.setdefault("anchors", {}))
        (OUT / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n")
        report_coaches(index["coaches"])
        return

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    anchors: dict[str, list[float]] = {}

    def copy(uid: str) -> dict:
        kits: dict[str, list[int]] = defaultdict(list)
        neutral: list[int] = []
        for kit, pose, name in sorted(sprites[uid]):
            if kit == 800:
                neutral.append(pose)
            elif kit in clubs:
                kits[clubs[kit]].append(pose)
            else:
                continue
            shutil.copy2(img_dir / name, OUT / name)
            anchors[name] = anchor(OUT / name)
        return {"uid": uid, "kits": dict(kits), "neutral": neutral}

    players: dict[str, dict] = {}
    unmatched: list[str] = [save_read.rv_key(r) for r in missing]
    ambiguous: list[str] = []
    for r, pick in pairs:
        key = save_read.rv_key(r)
        if len(looks_by_uid[pick["uid"]]) > 1:
            ambiguous.append(key)
            continue
        if not sprites.get(pick["uid"]):
            unmatched.append(key + " (no sprite)")
            continue
        players[key] = copy(pick["uid"])

    # Real NFL legends (public/data/legends.json): the arcade games only, never league stats or the Collection. The
    # NFL edition's real players (is_real_crew, uids 1xxxxx, never shared) may have left the current pool, so every
    # save file in the folder (backups too) is searched for them by name and position.
    legend_rows = json.loads((ROOT / "public" / "data" / "legends.json").read_text())
    want = {(save_read.norm(r["name"]), r["position"]): f'{r["position"]}:{r["name"]}' for r in legend_rows}
    legend_uid: dict[str, str] = {}
    for f in sorted(docs.glob("*rb_nfl_savedata*.json")):
        try:
            pool = json.loads(f.read_text()).get("players", {}).get("pool") or []
        except (OSError, ValueError, AttributeError):
            continue
        for q in pool:
            if not q.get("is_real_crew"):
                continue
            pos = save_read.POS.get(int(q.get("position", 0)))
            key = want.get((save_read.norm(f'{q.get("fname", "")} {q.get("lname", "")}'), pos))
            if key and str(q["uid"]) in sprites:
                legend_uid.setdefault(key, str(q["uid"]))
    legends = {key: copy(uid) for key, uid in sorted(legend_uid.items())}

    # Stand-ins: league players the save doesn't have (older retirees) still wear the save's style. The game itself draws
    # all its generated players from about a hundred look templates (the 900xxx uids, shared by several players each),
    # so a stand-in is one of those templates: never a real NFL player, never a uid shared by different-looking players,
    # with all five neutral poses and the game's skin group (0 dark, 1 mix, 2 light) so the site can pick one matching
    # the player's skin, and paint the kit.
    standins: list[dict] = []
    skin_of = {q["uid"]: int(float(q["raw"].get("skin", 0))) for q in save.players if not q["raw"].get("is_real_crew")}
    for uid in sorted(skin_of):
        if not uid.startswith("9") or len(looks_by_uid[uid]) != 1:
            continue
        poses = sorted(pose for kit, pose, _ in sprites.get(uid, []) if kit == 800)
        if poses != [1, 2, 3, 4, 5]:
            continue
        for kit, pose, name in sprites[uid]:
            if kit == 800 and name not in anchors:
                shutil.copy2(img_dir / name, OUT / name)
                anchors[name] = anchor(OUT / name)
        standins.append({"uid": uid, "skin": skin_of[uid], "neutral": poses})

    coaches = coach_sprites(save, sprites, clubs, img_dir, anchors)

    index = {
        "about": "The owner's NFL Retro Bowl player and coach sprites (New Star Games, NFL/NFLPA marks), copied by "
                 "scripts/private_nfl_sprites.py. Committed by the owner's choice (2026-11-14).",
        "size": [64, 64],
        "file": "{uid}_{kit:03d}{suffix}.png (kit = club uid, 800 neutral; suffix '' for pose 1, else _p<pose>)",
        "clubs": {name: uid for uid, name in sorted(clubs.items())},
        "save": {"slot": slot.name, "year": save.year, "myteam": clubs.get(save.my_team)},
        "players": players,
        "legends": legends,
        "standins": standins,
        "coaches": coaches,
        "anchors": anchors,
        "unmatched": unmatched,
        "ambiguous": ambiguous,
    }
    (OUT / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n")
    files = sum(1 for _ in OUT.glob("*.png"))
    print(f"{slot.name}: year {save.year}, {len(save.players)} save players")
    print(f"sprites for {len(players)} of {len(pairs) + len(missing)} Retro Vault players ({files} files) -> "
          f"{OUT.relative_to(ROOT)}")
    print(f"real NFL legends for the games ({len(legends)}): " + ", ".join(legends))
    print(f"stand-in looks for players the save lacks: {len(standins)} "
          f"(dark {sum(x['skin'] == 0 for x in standins)}, mix {sum(x['skin'] == 1 for x in standins)}, "
          f"light {sum(x['skin'] == 2 for x in standins)})")
    report_coaches(coaches)
    print(f"ambiguous uid, regular-game fallback ({len(ambiguous)}): " + ", ".join(ambiguous))
    print(f"not in the save ({len(unmatched)}): " + ", ".join(unmatched))


if __name__ == "__main__":
    main()
