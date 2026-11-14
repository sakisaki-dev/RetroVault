#!/usr/bin/env python3
"""Copy the owner's own NFL Retro Bowl player sprites into the PRIVATE folder the site uses on this Mac.

Owner choice (2026-11-13): the game's art (New Star Games; the NFL edition adds NFL and NFLPA marks) is shown only on
this Mac, never on the public site. This script holds no art. It reads the newest save pulled by scripts/pull_save.py
(data/saves/<date>/nfl/Documents/, git-ignored) through scripts/save_read.py (the slot with the highest settings.year,
its reader and its matcher: normalised name + position), skips a uid shared by players who look different (uids repeat
in the pool; see main), and copies only the matched
players' sprites from rb_nfl_players_2024/faces_img/ into public/private-sprites/nfl/ (git-ignored). The GitHub Pages
build never has that folder, so the public site is unchanged; the dev server and the LAN preview show them.

    python3 scripts/private_nfl_sprites.py [path/to/Documents]

Sprites in the game: faces_img/<uid>_<kit>[_p2.._p5].png, 64 x 64 full-body players drawn in real kits with their
numbers; <kit> is a club uid (000-031, the save's teams.list) or 800, a neutral white kit; no suffix = pose 1.

Output: public/private-sprites/nfl/<uid>_<kit>[_pN].png and index.json:
    { "players": { "<POS>:<Name>": { "uid": "...", "kits": { "<Club>": [1, 2] }, "neutral": [1] } },
      "save": {...}, "unmatched": [...] }
Club names are the site's (the save's team names: "Eagles", "49ers").
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import save_read  # noqa: E402  (the save importer: one reader and one matcher for the whole site)

OUT = ROOT / "public" / "private-sprites" / "nfl"
SPRITE = re.compile(r"^(\d+)_(\d{3})(?:_p([2-9]))?\.png$")


def main() -> None:
    slot = save_read.find_save(path=sys.argv[1] if len(sys.argv) > 1 else None)
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

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
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
        uid = pick["uid"]
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
        players[key] = {"uid": uid, "kits": dict(kits), "neutral": neutral}

    index = {
        "about": "The owner's NFL Retro Bowl player sprites (New Star Games, NFL/NFLPA marks), copied by "
                 "scripts/private_nfl_sprites.py. Private: git-ignored, never on the public site.",
        "size": [64, 64],
        "file": "{uid}_{kit:03d}{suffix}.png (kit = club uid, 800 neutral; suffix '' for pose 1, else _p<pose>)",
        "clubs": {name: uid for uid, name in sorted(clubs.items())},
        "save": {"slot": slot.name, "year": save.year, "myteam": clubs.get(save.my_team)},
        "players": players,
        "unmatched": unmatched,
        "ambiguous": ambiguous,
    }
    (OUT / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n")
    files = sum(1 for _ in OUT.glob("*.png"))
    print(f"{slot.name}: year {save.year}, {len(save.players)} save players")
    print(f"sprites for {len(players)} of {len(pairs) + len(missing)} Retro Vault players ({files} files) -> "
          f"{OUT.relative_to(ROOT)}")
    print(f"ambiguous uid, regular-game fallback ({len(ambiguous)}): " + ", ".join(ambiguous))
    print(f"not in the save ({len(unmatched)}): " + ", ".join(unmatched))


if __name__ == "__main__":
    main()
