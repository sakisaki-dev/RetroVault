"""The Hall of Fame and the clubs' Rings of Honor (owner, Y92: "about 20-25, bar 65", "retired only", "ring of honor
yes", "every member is now treated as completely new if they fit they fit").

A rule over the data, no AI and no hand-picked names:

- Only retired players are eligible. A player's case is frozen the season he last played (the end-of-season market
  snapshot where his games last went up; a player already retired when first recorded freezes at his first snapshot),
  so a later upload can't move a retired player in or out.
- Hall of Fame Score, 0-100, from that frozen snapshot:
    standing  up to 60  his rank by Career Legacy among every player at his position in that snapshot (DBs against
                        DBs, QBs against QBs): 1st 60, 2nd 54, 3rd 49 ... 10th 27, then 2 fewer a place
    honours   up to 24  30 per MVP, 18 per OPOY/DPOY, 12 per Super Bowl MVP, 4 per ring, capped at 40, times 0.6
    records   +15 each  a league career record he held when he retired (passing, rushing and receiving yards and
                        touchdowns; tackles, sacks, interceptions, forced fumbles)
- The ballot: every season, eligible retirees at or above the bar go in, highest score first, at most CAP a class
  (the first, inaugural class has no cap); the rest wait on the ballot. In the first year eligible = First Ballot.
  Once in, always in. Owner facts can override: players/<name>/hof "in" (enshrine) or "out" (exclude).
- Ring of Honor, per club: his Hall of Fame club(s) for members; for other retirees, the club he is best known for
  (owner signature team / retired_by, else the stint with the most rings, then most seasons) when his frozen Career
  Legacy reached RING_LEGACY or he won RING_RINGS rings there.

Writes public/data/league/halloffame.json; other scripts import members() / is_member(). Deterministic.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import market_history
from owner_facts import ACTIVE_ROSTERS, FACTS, RETIRED_BY, RETIRED_WITH, SIGNATURE_TEAM, STATUS_FIXES

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
OUT = ROOT / "public" / "data" / "league" / "halloffame.json"

BAR = 65
CAP = 3
RING_LEGACY = 6000
RING_RINGS = 3
STANDING = {1: 60, 2: 54, 3: 49, 4: 45, 5: 42, 6: 39, 7: 36, 8: 33, 9: 30, 10: 27}
RECORDS = [  # (label, positions, snapshot field)
    ("Passing yards", ("QB",), "yds"), ("Passing TDs", ("QB",), "td"),
    ("Rushing yards", ("RB", "QB"), "ryds"), ("Rushing TDs", ("RB", "QB"), "rtd"),
    ("Receiving yards", ("WR", "TE"), "yds"), ("Receiving TDs", ("WR", "TE"), "td"),
    ("Tackles", ("LB", "DB", "DL"), "tkl"), ("Sacks", ("LB", "DB", "DL"), "sck"),
    ("Interceptions", ("LB", "DB", "DL"), "int"), ("Forced fumbles", ("LB", "DB", "DL"), "ff"),
]


def standing_points(rank: int) -> int:
    return STANDING.get(rank, max(0, 27 - 2 * (rank - 10)))


def season_num(label) -> int:
    m = re.match(r"Y(\d+)", str(label or ""))
    return int(m.group(1)) if m else 0


def status(p, sheet) -> str:
    """build_league_data.player_status: owner status, the game's team screens, the game's Player HOF screen, the
    league sheet; no sheet row = active."""
    return (STATUS_FIXES.get(p["n"]) or ("Active" if p["n"] in ACTIVE_ROSTERS else None)
            or ("Retired" if p["n"] in RETIRED_WITH else None) or (sheet.get((p["n"], p["pos"])) or {}).get("st")) or "Active"


def compute() -> dict:
    players = [p for p in json.loads((SRC / "players.json").read_text()) if not p.get("legend")]
    sheet = {(r["n"], r["pos"]): r for r in json.loads((SRC / "spreadsheet_parsed.json").read_text())}
    stints = json.loads((SRC / "stints.json").read_text())
    snaps = market_history.load(SRC / "market_history.json")
    snaps = snaps["snapshots"] if isinstance(snaps, dict) else snaps
    ends: dict[int, dict] = {}
    for s in snaps:
        if season_num(s.get("season")):
            ends[season_num(s["season"])] = s["players"]  # the last snapshot of a season wins
    seasons = sorted(ends)
    if not seasons:
        return {"bar": BAR, "cap": CAP, "members": [], "classes": [], "ballot": [], "watch": [], "ringOfHonor": {}}
    first = seasons[0]
    owner_hof = {n: f.get("hof") for n, f in FACTS.get("players", {}).items() if f.get("hof") in ("in", "out")}
    key = {f"{p['pos']}:{p['n']}": p for p in players}

    def case(k: str, at: int) -> dict | None:
        """The player's Hall of Fame case from the end-of-season snapshot of season `at`."""
        snap = ends.get(at, {})
        v = snap.get(k)
        if not v:
            return None
        pos, _, name = k.partition(":")
        p = key[k]
        legacy = v.get("legacy", 0)
        rank = 1 + sum(1 for k2, v2 in snap.items() if k2.split(":")[0] == pos and v2.get("legacy", 0) > legacy)
        hon_raw = 30 * (p.get("mvp") or 0) + 18 * ((p.get("opoy") or 0) + (p.get("dpoy") or 0)) \
            + 12 * (p.get("sbmvp") or 0) + 4 * (p.get("rings") or 0)
        honours = round(min(hon_raw, 40) * 0.6)
        held = []
        for label, poss, f in RECORDS:
            if pos not in poss:
                continue
            mine = (v.get("s") or {}).get(f) or 0
            if mine and all(((v2.get("s") or {}).get(f) or 0) <= mine for k2, v2 in snap.items() if k2.split(":")[0] in poss):
                held.append(label)
        standing = standing_points(rank)
        return {"key": k, "name": name, "pos": pos, "frozenSeason": f"Y{at}", "careerLegacy": round(legacy),
                "rank": rank, "score": min(100, standing + honours + 15 * len(held)),
                "parts": {"standing": standing, "honours": honours, "records": 15 * len(held)}, "records": held,
                "rings": p.get("rings") or 0, "mvp": p.get("mvp") or 0, "opoy": p.get("opoy") or 0,
                "dpoy": p.get("dpoy") or 0, "sbmvp": p.get("sbmvp") or 0, "games": p.get("g") or 0}

    # when each retired player last played: the last season his games went up between two season-end snapshots; with
    # none, he retired before he was recorded. His case is the first season-end snapshot from then on. One retired
    # before he was ever recorded joins the ballot the season he was added (a veteran, never "first ballot").
    retired, eligible_from, veteran = {}, {}, set()
    for k, p in key.items():
        if status(p, sheet) != "Retired":
            continue
        present = [y for y in seasons if k in ends[y]]
        if not present:
            continue
        # seasons his games went up; a lone rise between the first two recorded seasons is the first import being
        # corrected (God Johnson 216 -> 234), not a season played
        played = [y for y in present[1:] if ((ends[y][k].get("s") or {}).get("g") or 0)
                  > ((ends[seasons[seasons.index(y) - 1]].get(k, {}).get("s") or {}).get("g") or 0)]
        if played and not (len(played) == 1 and played[0] == seasons[1]):
            last_played = played[-1]
        else:
            runs = (stints.get(p["n"]) or {}).get("stints", [])
            last_played = min(max((s["to"] for s in runs), default=0), present[0] - 1)  # retired before recorded
        at = next((y for y in present if y >= last_played), present[-1])
        retired[k] = case(k, at)
        later = [y for y in seasons if y > at]
        if at == last_played:
            eligible_from[k] = later[0] if later else at  # retired during the recorded seasons: on the next ballot
        else:
            eligible_from[k] = at             # retired before he was recorded
            if at != first:
                veteran.add(k)

    # the ballot, season by season
    members, waiting, classes = {}, {}, []
    for y in seasons:
        for k, c in retired.items():
            if c and eligible_from[k] == y and k not in members:
                if owner_hof.get(c["name"]) == "out":
                    continue
                if c["score"] >= BAR or owner_hof.get(c["name"]) == "in":
                    waiting[k] = y
        order = sorted(waiting, key=lambda k: (-retired[k]["score"], -retired[k]["careerLegacy"], k))
        take = order if y == first else order[:CAP]
        cls = []
        for k in take:
            members[k] = {**retired[k], "class": "Inaugural class" if y == first else f"Y{y}", "classSeason": f"Y{y}",
                          "firstBallot": waiting[k] == y and y != first and k not in veteran, "veteran": k in veteran,
                          "yearsOnBallot": y - waiting[k] + 1,
                          **({"owner": True} if owner_hof.get(retired[k]["name"]) == "in" else {})}
            cls.append(k)
            del waiting[k]
        if cls:
            classes.append({"season": f"Y{y}", "label": "Inaugural class" if y == first else f"Class of Y{y}",
                            "members": [retired[k]["name"] for k in cls]})

    last = seasons[-1]
    ballot = sorted(({**retired[k], "since": f"Y{waiting[k]}", "yearsOnBallot": last - waiting[k] + 1} for k in waiting),
                    key=lambda c: (-c["score"], c["key"]))
    near = sorted((c for k, c in retired.items() if c and k not in members and k not in waiting and c["score"] >= BAR - 15),
                  key=lambda c: (-c["score"], c["key"]))[:8]
    watch = []
    for k, p in key.items():
        if status(p, sheet) == "Active" and k in ends[last]:
            c = case(k, last)
            if c and c["score"] >= BAR - 15:
                watch.append({**c, "projected": True})
    watch.sort(key=lambda c: (-c["score"], c["key"]))

    # Rings of Honor
    def best_club(name: str) -> str | None:
        own = SIGNATURE_TEAM.get(name)
        if own:
            return own
        runs = (stints.get(name) or {}).get("stints", [])
        best = min(runs, key=lambda s: (-len(s.get("rings", [])), -(s["to"] - s["from"] + 1), s["from"]), default=None)
        return best["team"] if best else None

    def short(team: str | None) -> str | None:
        return team.split()[-1] if team and team.split()[-1] != "49ers" or not team else "49ers"

    rings: dict[str, list] = {}
    for k, c in retired.items():
        if not c:
            continue
        name = c["name"]
        clubs: list[str] = []
        why = ""
        if k in members:
            clubs = [short(t) for t in (RETIRED_BY.get(name) or [best_club(name)]) if t]
            why = "Hall of Famer"
        else:
            club = best_club(name)
            runs = [s for s in (stints.get(name) or {}).get("stints", []) if club and s["team"] == short(club)]
            club_rings = sum(len(s.get("rings", [])) for s in runs)
            if club and (c["careerLegacy"] >= RING_LEGACY or club_rings >= RING_RINGS):
                clubs = [short(club)]
                why = f"{club_rings} rings with the club" if club_rings >= RING_RINGS else "Career Legacy"
        for t in clubs:
            if t:
                rings.setdefault(t, []).append({"name": name, "pos": c["pos"], "careerLegacy": c["careerLegacy"],
                                                "score": c["score"], "hof": k in members, "why": why,
                                                "frozenSeason": c["frozenSeason"]})
    for t in rings:
        rings[t].sort(key=lambda r: (not r["hof"], -r["careerLegacy"], r["name"]))

    return {"_about": "Generated by scripts/hall_of_fame.py: the rule-based Hall of Fame (retired players only, a frozen "
                      "score, a yearly ballot) and the clubs' Rings of Honor. Do not edit.",
            "bar": BAR, "cap": CAP, "season": f"Y{last}",
            "members": sorted(members.values(), key=lambda m: (-m["score"], -m["careerLegacy"], m["key"])),
            "classes": classes, "ballot": ballot, "near": near, "watch": watch[:10],
            "ringOfHonor": dict(sorted(rings.items()))}


_CACHE: dict | None = None


def data() -> dict:
    global _CACHE
    if _CACHE is None:
        _CACHE = compute()
    return _CACHE


def members() -> dict[str, dict]:
    """POS:Name -> member record."""
    return {m["key"]: m for m in data()["members"]}


def is_member(key: str) -> bool:
    return key in members()


def main() -> None:
    d = data()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n")
    rh = sum(len(v) for v in d["ringOfHonor"].values())
    print(f"wrote {OUT.relative_to(ROOT)}: {len(d['members'])} Hall of Famers in {len(d['classes'])} classes, "
          f"{len(d['ballot'])} waiting on the ballot, {rh} Ring of Honor places across {len(d['ringOfHonor'])} clubs")


if __name__ == "__main__":
    main()
