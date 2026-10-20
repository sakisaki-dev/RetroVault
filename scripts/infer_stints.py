#!/usr/bin/env python3
"""Reconstruct each league player's career stints (team + approximate seasons) for the Y80 save.

Writes data/y80/stints.json. Usage: python3 scripts/infer_stints.py [--explain NAME]

How it works
------------
No per-season data exists, so stints are inferred by ring arithmetic:

* A player's franchises come from his main team, TEAM_HISTORY, card former/legacy/current team and the in-game
  Hall of Fame team he retired with (always his LAST stop), plus the extra stops in EVIDENCE below.
* Seasons ~ games / 17-21 (17 regular-season games, plus playoffs: the owner's clubs play ~20 a season).
* Stints are contiguous and ordered, and the Super Bowls his teams won while he was there must equal his rings.
* Hard anchors pin a team to a season. The in-game record board only counts games played for the owner's club,
  so a record set in year Y means the holder was on the owner's club that season (e.g. Ikarras's 5-TD game in
  Y40 puts him on the Chargers, his 2,104-yd season in Y42 on the Ravens).
* Soft scoring prefers the games-per-season fit and windows inside the player's era text.

Confidence: confirmed (owner-stated / card note), strong (one ring-year solution), likely (teams agree, years
vary), ambiguous (different team/year solutions, or rings no known franchise explains). Every curated call in
EVIDENCE carries its reason; questions for the owner live in docs/STINT_QUESTIONS.md.
"""
from __future__ import annotations

import itertools
import json
import re
import sys
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
OUT = SRC / "stints.json"
sys.path.insert(0, str(ROOT / "scripts"))
import build_league_data as B  # noqa: E402  (TEAM_FIXES, TEAM_HISTORY, CARD_NOTES, RETIRED_WITH)

LAST = 80

# ---------------------------------------------------------------------------
# League facts
# ---------------------------------------------------------------------------
SB = {int(s["year"][1:]): s for s in json.loads((SRC / "super_bowls.json").read_text())}
COACH = {s["year"]: s for s in json.loads((SRC / "coach.json").read_text())["seasons"]}
WIN = {y: s["winner"] for y, s in SB.items()}
LOSE = {y: s["loser"] for y, s in SB.items()}
OWNER = {y: s["team"] for y, s in COACH.items()}
PLAYOFF = {"Champions": 3.6, "AFC Champs": 3.0, "NFC Champs": 3.0, "Champ Rnd": 2.4, "Divisional": 1.5, "Wild Card": 1.0}


def season_games(team: str, y: int) -> float:
    """Expected games (regular + playoff) for a full season on this team."""
    if OWNER.get(y) == team:
        return 17 + PLAYOFF.get(COACH[y]["finish"], 0.0)
    if WIN.get(y) == team:
        return 20.6
    if LOSE.get(y) == team:
        return 20.0
    return 17.6


def titles(team: str, a: int, b: int) -> list[int]:
    return [y for y in range(a, b + 1) if WIN.get(y) == team]


# ---------------------------------------------------------------------------
# Curated evidence (judgment on top of the solver). Every entry says why.
#   seqs:     candidate ordered team sequences (replaces the auto permutations; a team may repeat)
#   anchors:  hard (team, year) pairs: he was on that team that season
#   start / end: hard (min, max) bounds on his first / last season
#   n:        hard (min, max) seasons, when games alone mislead (e.g. games not recorded)
#   conf / why: confidence override and the evidence sentence
#   pick:     exact stints to publish (list of (team, from, to)); the solver still checks the rings
# ---------------------------------------------------------------------------
# Imported real-NFL players (Real-roster era) were all in the league from Y1. Their card CAREER totals include
# their real NFL games and awards (Lamar's 4 MVPs = 2 real + 2 in the save), so the save part is what we place.
# (real games, real rings, real club). Games from screenshot_extras real_nfl_splits; ~ = estimated from NFL.com.
REAL: dict[str, tuple[int, int, str]] = {
    "Lamar Jackson": (111, 0, "Ravens"), "Jayden Daniels": (20, 0, "Commanders"), "Ja’Marr Chase": (69, 0, "Bengals"),
    "CeeDee Lamb": (85, 0, "Cowboys"), "Jahmyr Gibbs": (36, 0, "Lions"), "Nick Bolton": (67, 2, "Chiefs"),  # 2 real Chiefs rings (LVII, LVIII)
    "Mason Taylor": (0, 0, "Jets"), "Drake Maye": (29, 0, "Patriots"),  # ~
    "Sauce Gardner": (57, 0, "Jets"), "Breece Hall": (57, 0, "Jets"),  # ~
}

# Who played in the Y80 playoffs: between the e8111f1 and cf6fd15 screenshot sets (the end of Y80) these players
# gained games, and the Jets gained the Y80 ring. So each was on this club in Y80 (git history of players.json).
Y80_TEAM: dict[str, str] = {
    **{n: "Jets" for n in ["Chance Woodrum", "Jaylen Conklin", "Obinna Leary", "Kane Van Oxley", "Ryland Maxwell",
                           "Ty Lock", "Dylan Hyatt", "Kalif Suh"]},
    **{n: "Seahawks" for n in ["Jason Macleone", "Dorance Hinton", "Alvin Tufele", "Blair Iupati", "Deonte Sutton",
                               "Romeo Rodgers"]},
    "Malakai Sawyer": "Falcons", "Hamsfa Boltt": "Commanders", "Drake Wise": "Giants", "Le'Veon Richard": "Cowboys",
    "Jarred Beasley": "Titans", "Juawan Lance": "Titans", "Darrel Longa": "Titans", "Corey Ivey": "Ravens", "Dan Stout": "Ravens",
}

REC = "the in-game record board (owner's-club games only)"
EVIDENCE: dict[str, dict] = {
    # ---- Owner-confirmed / card notes ----
    "Malakai Sawyer": {
        "seqs": [["Titans", "Seahawks", "Jets", "Falcons"]],
        "pick": [("Titans", 72, 72), ("Seahawks", 73, 75), ("Jets", 76, 79), ("Falcons", 80, 80)],
        "conf": "confirmed",
        "why": "Owner: one Titans season (Y72 title, ROTY), the Jets (Y77 title), traded to the Falcons for Y80. "
               "The record board's Y75 Macleone-to-Sawyer run puts him on your Y75 Seahawks in between.",
    },
    "Jakeem Friend": {
        "seqs": [["Seahawks", "Jets"]],
        "pick": [("Vikings", 68, 69), ("Titans", 70, 73), ("Seahawks", 74, 78), ("Jets", 79, 80)],
        "conf": "ambiguous",
        "why": "Owner: mainly a Seahawk, a Jet only Y79-80 (Y80 ring). Seattle has won nothing since Y38, so 5 of his "
               "6 rings came elsewhere. Best fit: he followed you Vikings Y68-69 and Titans Y70-73 into Seattle "
               "(his longest stop, Y74-78), then the Jets.",
        "alternatives": [[("Titans", 70, 74), ("Seahawks", 75, 78), ("Jets", 79, 80)]],
    },
    "Levante Hopkins": {
        "seqs": [["Vikings", "Titans"]],
        "anchors": [("Titans", 70), ("Titans", 72)],
        "pick": [("Vikings", 64, 69), ("Titans", 70, 78)],
        "conf": "ambiguous",
        "why": "Owner: Titans TE for the Y70-72 three-peat; retired a Titan (game HOF). 9 rings in ~15 seasons need "
               "Vikings titles too: either Vikings Y64-69 then Titans Y70-78 (with the Y74 title), or Vikings Y61-66 "
               "then Titans from Y67.",
        "alternatives": [[("Vikings", 61, 66), ("Titans", 67, 75)]],
    },
    "Michael Wilson": {
        "seqs": [["Ravens", "Giants", "Titans"]],
        "pick": [("Ravens", 41, 46), ("Giants", 47, 52), ("Titans", 53, 53)],
        "conf": "ambiguous",
        "why": "Owner: Ravens, then Giants, retired injured as a Titan. 6 rings only fit the 40s-50s (Ravens Y41-49, "
               "Giants Y54-56, Titans Y53), not the Vikings dynasty. With Brandson your QB from Y45, the best fit is "
               "your Ravens QB Y41-46, Giants Y47-52 (his MVP years) and the Titans' Y53 title.",
        "alternatives": [[("Ravens", 45, 50), ("Giants", 51, 56), ("Titans", 57, 57)],
                         [("Ravens", 43, 50), ("Giants", 51, 52), ("Titans", 53, 53)]],
    },
    "Jason Macleone": {
        "seqs": [["Seahawks", "Jets", "Vikings", "Seahawks"]],
        "anchors": [("Seahawks", 75), ("Vikings", 78), ("Seahawks", 80)],
        "end": (80, 80),
        "pick": [("Seahawks", 65, 75), ("Jets", 76, 77), ("Vikings", 78, 78), ("Seahawks", 79, 80)],
        "conf": "ambiguous",
        "why": "Owner: Vikings QB for the Y78 title, now a Seahawk (played the Y80 Super Bowl for them). The record "
               "board's Y75 run puts him on your Seahawks; the sheet first listed him as your club, and his 2nd ring "
               "only fits your Jets' Y77 title, so: Seattle, your Jets Y76-77, Minnesota Y78, back to Seattle.",
    },
    "Rondale Ikarras": {
        "seqs": [["Seahawks", "Chargers", "Ravens", "Jets"]],
        "anchors": [("Seahawks", 38), ("Chargers", 40), ("Ravens", 42), ("Ravens", 47)],
        "end": (48, 48),
        "pick": [("Seahawks", 33, 38), ("Chargers", 39, 40), ("Ravens", 41, 47), ("Jets", 48, 48)],
        "conf": "strong",
        "why": f"Owner: Ravens legend (after three titles in Seattle), final season a Jet. {REC} has him with you in Y38 (Seahawks), Y40 (Chargers), "
               "Y42 and Y47 (Ravens): 9 rings = Y36-38 + Y40 + Y41-44 + Y46 exactly. 18,867 of his 23,178 yds came "
               "with you, so about two seasons were elsewhere (Y33 and the Jets year).",
    },
    "Hamsfa Boltt": {
        "seqs": [["Titans", "Commanders"]],
        "anchors": [("Titans", 74)],
        "conf": "confirmed",
        "why": "Card: QB and SB MVP of the Titans' Y74 title, now with the Commanders (in the Y80 playoffs).",
    },
    "Obinna Leary": {
        "seqs": [["Jets", "Seahawks"]],
        "pick": [("Jets", 79, 80), ("Seahawks", 81, 81)],
        "conf": "confirmed",
        "why": "Owner: traded from the Jets to the Seahawks for Alvin Tufele. He won his ring in the Y80 Super Bowl "
               "with the Jets (0 to 1 between screenshot sets), so the trade came after Y80.",
    },
    "Alvin Tufele": {
        "seqs": [["Seahawks", "Jets"]],
        "pick": [("Titans", 70, 72), ("Seahawks", 73, 80), ("Jets", 81, 81)],
        "conf": "ambiguous",
        "why": "Owner: traded from the Seahawks to the Jets for Leary, after playing the Y80 Super Bowl for Seattle. "
               "Seattle won nothing in his time, so his 3 rings came elsewhere: best fit is your Titans' Y70-72 three-peat.",
        "alternatives": [[("Titans", 71, 74), ("Seahawks", 75, 80), ("Jets", 81, 81)]],
    },
    "Dylan Hyatt": {
        "seqs": [["Titans", "Jets"]],
        "pick": [("Titans", 70, 75), ("Jets", 76, 80)],
        "conf": "ambiguous",
        "why": "Only the Jets are on record; 6 rings (5 before Y80) need the Titans too: Titans Y70-74 titles then your "
               "Jets Y77 and Y80, or Titans Y70-72 then the Jets from ~Y73 (their Y75, Y77 and Y80 titles).",
        "alternatives": [[("Titans", 70, 72), ("Jets", 73, 80)]],
    },
    # ---- Record-board anchors ----
    "Sherman Brandson": {
        "seqs": [["Ravens", "Buccaneers", "Giants", "Vikings"]],
        "anchors": [("Ravens", 46), ("Ravens", 50), ("Giants", 55), ("Vikings", 62)],
        "end": (62, 62),
        "pick": [("Ravens", 45, 50), ("Buccaneers", 51, 53), ("Giants", 54, 60), ("Vikings", 61, 62)],
        "conf": "strong",
        "why": f"{REC} puts him with you on the Ravens (Y46, Y50), Giants (Y55) and Vikings (Y62, retired injured). "
               "Following you Y46-62 would be 13 rings, so the Giants years after Y56 (no titles) must be his own: "
               "Ravens 46/48/49 + Bucs 51-52 + Giants 54-56 + Vikings 61-62 = 10.",
    },
    "God Johnson": {
        "seqs": [["Giants", "Dolphins", "Vikings"], ["Buccaneers", "Dolphins", "Vikings"], ["Dolphins", "Vikings"]],
        "anchors": [("Dolphins", 59), ("Vikings", 62), ("Vikings", 63), ("Vikings", 67)],
        "end": (67, 67),
        "n": (10, 14),
        "conf": "likely",
        "why": f"{REC}: on your Dolphins in Y59 (as Mason Earl III) and your Vikings Y62-67, his career marks frozen "
               "in Y67; retired a Viking. Dolphins 57-59 + Vikings 61-67 is 9 rings, so the 10th is most likely "
               "your Giants' Y56 title (the sheet's 216-game, 9-ring snapshot fits Y56-66 exactly).",
    },
    "Pharoah Hunter": {
        "seqs": [["Vikings", "Seahawks"]],
        "anchors": [("Vikings", 68)],
        "why": f"Owner's career card: 233 G, 4 rings, 2 SB MVPs. {REC}: 288-yd game for your Vikings in Y68. Four "
               "Vikings titles in his window put him in Minnesota through Y68; he finished as a Seahawk.",
    },
    "Tyrone Baugh": {
        "seqs": [["Bills", "Seahawks"]],
        "anchors": [("Bills", 29), ("Seahawks", 36)],
        "why": f"{REC}: forced-fumble game in Y29 (Bills) and career mark last set in Y36, when your club was the "
               "Seahawks. 7 rings = Bills Y28-33 (6) + Seahawks Y36 (1).",
    },
    "Denzel Hayes": {
        "seqs": [["Ravens", "Bears"]],
        "anchors": [("Ravens", 50)],
        "why": f"{REC}: 58-yd TD run from Brandson for your Y50 Ravens; retired a Bear (game HOF). 2 rings = Ravens Y48-49.",
    },
    "Ray Waller": {"anchors": [("Buccaneers", 26)], "why": f"{REC}: 513-yd game in Y26. 5 rings = the Bucs' Y20-26 titles."},
    "Ian Finney": {
        "seqs": [["Commanders", "Buccaneers"]],
        "anchors": [("Buccaneers", 23)],
        "conf": "strong",
        "why": f"{REC}: 6-TD game for your Y23 Bucs. History: his career starts in the Commanders run, and 9 rings = "
               "Commanders Y16-19 (4) + Bucs Y20-26 (5); retired a Buc.",
    },
    "Dennis Baylon": {"anchors": [("Bills", 33)],
                      "why": f"{REC}: 7,452-yd season for your Y33 Bills; 7 rings = Y27-33; retired a Charger after the dynasty."},
    "Germain Coulter": {"anchors": [("Buccaneers", 26)],
                        "why": f"{REC}: 7-INT season for your Y26 Bucs; 5 rings = the Bucs' Y20-26 titles."},
    "CeeDee Lamb": {"anchors": [("Dolphins", 7)],
                    "why": f"{REC}: career return-yards mark last set in Y7 with your Dolphins. His ~156 save games from Y1 "
                           "with 2 rings fit the Dolphins through Y8 (Y6 and Y8 titles)."},
    # ---- Storyline / judgment calls ----
    "Cairo Asanjh": {
        "seqs": [["Bills", "Seahawks", "Ravens"]],
        "anchors": [("Bills", 33), ("Seahawks", 36)],
        "why": "History: 9 rings = 7 Bills + 2 Seahawks, final season beside Ikarras on the Seahawks; the game HOF "
               "has him retiring a Raven. Bills Y27-33 + Seahawks Y36-37 = 9, then a last stop in Baltimore.",
    },
    "Jackson Wardell Kline": {
        "conf": "likely",
        "why": "Owner's career card: 237 G, 8 rings, 1 SB MVP. Giants on the sheet, retired a Dolphin (game HOF). "
               "8 rings = your Vikings dynasty titles beside God Johnson (Y61-64, Y66-69); the sheet's 99-game, "
               "4-ring snapshot matches the first four Vikings titles.",
    },
    "Wayne Wilson": {
        "conf": "likely",
        "why": "Chargers on the sheet, retired a Bill. 4 rings only fit the Chargers' Y10-15 titles (Bills titles come "
               "as a block of 7 or a lone Y47), so his 431-game career runs about Y4-26, not the Vikings dynasty.",
    },
    "Alexx Sanchez": {
        "why": "Only the Titans are on record: 4 rings = the Titans' Y70-72 + Y74 titles, which fits 216 games ending "
               "around Y80. The Commanders-run QB idea (also 4 rings) needs a Commanders stint nothing confirms.",
    },
    "Tyrion Kline": {
        "seqs": [["Buccaneers", "Chargers"]],
        "why": "History: Finney's WR2 on your Bucs; Chargers on the sheet (his final club). 5 rings = Bucs Y20-26, "
               "then the Chargers (no titles until Y40).",
    },
    "Avonte Gooden": {
        "conf": "likely",
        "why": "Owner: QB of the Commanders four-peat (Y16-19). His 2 rings only fit the last two titles (Y18-19), so "
               "he likely took over mid-run or missed the first two Super Bowls.",
    },
    "Derrick Myrick": {
        "anchors": [("Falcons", 35)],
    },
}

# Questions: only for ambiguous cases. Built in main() from the solutions and these hints.


def parse_era(era: str | None):
    if not era:
        return None
    m = re.search(r"Y(\d+)\s*[–-]\s*Y?(\d+)", era)
    if not m:
        m1 = re.search(r"Y(\d+)", era)
        return (int(m1.group(1)), int(m1.group(1))) if m1 else None
    return int(m.group(1)), int(m.group(2))


def short(team_name_or_key: str | None, teams: dict) -> str | None:
    if not team_name_or_key:
        return None
    key = team_name_or_key.split(" (")[0].strip()
    if key in teams and teams[key].get("conference"):
        return key
    for k, t in teams.items():
        if t.get("name") == key:
            return k
    return None


def franchise_facts(p, teams, cards):
    name = p["n"]
    main = B.TEAM_FIXES.get(name, p.get("team", ""))
    main = B.CURRENT_CLUB if main == "CUR" else main
    main = short(main, teams)
    card = cards.get(name, {})
    retired = short(B.RETIRED_WITH.get(name), teams)
    current = short(card.get("team"), teams) if name in B.CARD_NOTES else None
    former = short(card.get("former_team"), teams)
    legacy = short(card.get("legacy_team"), teams)
    hist = [short(t, teams) for t in B.TEAM_HISTORY.get(name, [])]
    known = {t for t in [main, retired, current, former, legacy, *hist] if t}
    return {"main": main, "retired": retired, "current": current, "former": former, "legacy": legacy, "known": known}


def auto_seqs(f) -> list[list[str]]:
    """Every order of his known clubs. The game-HOF/current club is last; otherwise the sheet's team is (it
    records his final club, per data/y80/README.md); a card's former team precedes the sheet team."""
    teams = sorted(f["known"])
    if not teams:
        return []
    last = f["retired"] or f["current"] or f["main"]
    out = []
    for perm in itertools.permutations(teams):
        if last and perm[-1] != last:
            continue
        if f["former"] and f["main"] and f["former"] != f["main"] and f["main"] in perm:
            if perm.index(f["former"]) > perm.index(f["main"]):
                continue
        out.append(list(perm))
    return out


def solve(target, ev, era, seqs):
    """All stint layouts for these team orders that hit his ring count and the hard constraints, scored."""
    g, rings = target["games"], target["rings"]
    anchors = ev.get("anchors", []) + target.get("anchors", [])
    smin, smax = ev.get("start", target.get("start", (1, LAST)))
    emin, emax = ev.get("end", target.get("end", (1, LAST)))
    nmin_h, nmax_h = ev.get("n", (1, 30))
    if g:
        nmin_h = max(nmin_h, int(g / 22))
        nmax_h = min(nmax_h, int(g / 12) + 2)
    sols = []

    def finish(seq, stints):
        s, e = stints[0][1], stints[-1][2]
        if not (smin <= s <= smax and emin <= e <= emax):
            return
        n = e - s + 1
        if not (nmin_h <= n <= nmax_h):
            return
        for t, y in anchors:
            if not any(st[0] == t and st[1] <= y <= st[2] for st in stints):
                return
        pred = sum(season_games(t, y) for t, a, b in stints for y in range(a, b + 1))
        score = 0.0
        if g:
            # can't play more games than the schedule allows; fewer (injuries, rest) is cheaper
            score += max(0.0, g - pred) / 8 + max(0.0, pred - 1.12 * g) / 17
        if era:
            a, b = era
            out = sum(1 for y in range(s, e + 1) if y < a - 1 or y > b + 1)
            score += 0.3 * out + (1.5 if e < a or s > b else 0)
        sols.append((round(score, 3), tuple(seq), tuple(stints)))

    def rec(seq, i, y, acc, got):
        t = seq[i]
        for L in range(1, 31):
            b = y + L - 1
            if b > LAST:
                break
            r = got + len(titles(t, y, b))
            if r > rings:
                break
            if i == len(seq) - 1:
                if r == rings:
                    finish(seq, acc + [(t, y, b)])
            else:
                rec(seq, i + 1, b + 1, acc + [(t, y, b)], r)

    for seq in seqs:
        for s in range(max(1, smin), min(LAST, smax) + 1):
            rec(seq, 0, s, [], 0)
    sols.sort(key=lambda x: x[0])
    return sols


def owner_rings(stints) -> bool:
    """True when every ring in these stints was won by the owner's club."""
    return all(OWNER.get(y) == t for t, a, b in stints for y in titles(t, a, b))


def ring_sig(stints):
    return tuple((t, tuple(titles(t, a, b))) for t, a, b in stints)


def classify(sols):
    if not sols:
        return "ambiguous", []
    best = sols[0][0]
    top = [s for s in sols if s[0] <= best + 0.75]
    seqs = {s[1] for s in top}
    sigs = {ring_sig(s[2]) for s in top}
    starts = [s[2][0][1] for s in top]
    if len(seqs) > 1:
        return "ambiguous", top
    if len(sigs) == 1:
        return ("strong" if max(starts) - min(starts) <= 4 else "likely"), top
    return "likely", top


def pick_solution(top):
    """Best score; among ties, the median start (keeps undated careers centred, not pushed to an edge)."""
    best = top[0][0]
    tied = [s for s in top if s[0] <= best + 0.05]
    tied.sort(key=lambda s: s[2][0][1])
    return tied[len(tied) // 2]


def to_json_stints(stints):
    return [{"team": t, "from": a, "to": b, "rings": titles(t, a, b)} for t, a, b in stints]


def describe(stints):
    return ", ".join(f"{t} Y{a}" + (f"-{b}" if b != a else "") for t, a, b in stints)


def main():
    players = [p for p in json.loads((SRC / "players.json").read_text()) if not p.get("legend")]
    teams = json.loads((SRC / "teams.json").read_text())
    sheet = {r["n"]: r for r in json.loads((SRC / "spreadsheet_parsed.json").read_text())}
    extras = json.loads((SRC / "screenshot_extras.json").read_text()).get("player_cards", {})
    cards = {k: dict(v) for k, v in extras.items()}
    for n, notes in B.CARD_NOTES.items():
        cards[n] = {**cards.get(n, {}), **notes}

    explain = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == "--explain" else None
    winners = sorted({w for w in WIN.values() if w and w != "None"})
    out, report = {}, []
    for p in players:
        name = p["n"]
        if explain and explain.lower() not in name.lower():
            continue
        ev = EVIDENCE.get(name, {})
        f = franchise_facts(p, teams, cards)
        seqs = ev.get("seqs") or auto_seqs(f)
        era = parse_era(p.get("era"))
        status = B.STATUS_FIXES.get(name) or ("Retired" if name in B.RETIRED_WITH else None) or sheet.get(name, {}).get("st") or "Active"
        real = REAL.get(name)
        target = {"games": (p.get("g") or 0) - (real[0] if real else 0), "rings": (p.get("rings") or 0) - (real[1] if real else 0)}
        notes = []
        if real:
            target["start"] = (1, 1)
            notes.append(f"imported real-NFL player (in the league from Y1; ~{target['games']} save games after his {real[0]} real ones)")
        if name in Y80_TEAM:
            target["end"] = (80, 80)
            target["anchors"] = [(Y80_TEAM[name], 80)]
        elif status == "Active" and name not in sheet:
            # added after the sheet and not retired in the game: still playing in Y80
            target["end"] = (80, 80)
        sols = solve(target, ev, era, seqs) if seqs else []
        conf, top = classify(sols)
        extra = False
        if not sols and seqs and "pick" not in ev:
            # Rings no known franchise explains: try one extra stop with a title-winning club. Your clubs are the
            # usual source ("every ring went to your team"); an imported player's real club is the natural first stop.
            trial = []
            fixed_last = bool(f["retired"] or f["current"] or f["main"] or "end" in ev)
            cands = winners + ([real[2]] if real and real[2] not in winners else [])
            for seq in seqs:
                for t in cands:
                    if t in seq:
                        continue
                    for i in range(len(seq) if fixed_last else len(seq) + 1):
                        trial.append(seq[:i] + [t] + seq[i:])
            sols = solve(target, ev, era, trial)

            def penalty(sq, sts):
                bonus = -1.0 if real and sq[0] == real[2] else 0
                return 1.0 + (0 if owner_rings(sts) else 0.8) + bonus

            sols = sorted(((sc + penalty(sq, sts), sq, sts) for sc, sq, sts in sols), key=lambda x: x[0])
            if sols:
                conf, top = "ambiguous", [s for s in sols if s[0] <= sols[0][0] + 0.75]
                extra = True
        if explain:
            print(name, f, target, era, len(sols), conf)
            for s in top[:30]:
                print("  ", s[0], s[2])
        chosen = None
        if "pick" in ev:
            chosen = tuple(ev["pick"])
            got = sum(len(titles(t, a, b)) for t, a, b in chosen)
            assert got == target["rings"], f"{name}: picked stints give {got} rings, expected {target['rings']}"
        elif top:
            chosen = pick_solution(top)[2]
        dated = bool(target["rings"] or ev.get("anchors") or target.get("anchors") or era or "end" in target or real)
        if not dated and conf == "strong":
            conf = "likely"
        conf = ev.get("conf", conf)
        if chosen is None:
            print(f"warn: no placement for {name}")
            continue
        ring_txt = f"{target['rings']} ring{'s' if target['rings'] != 1 else ''}"
        why = ev.get("why")
        if not why:
            if extra:
                why = (f"{ring_txt} that his known club{'s' if len(f['known']) > 1 else ''} "
                       f"({', '.join(sorted(f['known']))}) cannot account for; best fit adds a stop: {describe(chosen)}.")
            elif conf == "ambiguous":
                alts = sorted({" > ".join(s[1]) for s in top})
                why = f"{ring_txt}; different orders fit: {' | '.join(alts[:3])}."
            elif target["rings"]:
                won = ", ".join(f"{t} Y{y}" for t, a, b in chosen for y in titles(t, a, b))
                why = f"{ring_txt} = {won}" + ("; the only window that fits." if conf == "strong" else "; exact seasons are approximate.")
            elif dated:
                why = f"No rings: placed in his era in seasons his club won nothing ({p.get('g')} games)."
            else:
                why = (f"No rings, era or record to date him; only the team is known. The {p.get('g')}-game window "
                       "is a placeholder in a stretch where his club won nothing.")
        if notes:
            why = f"{why} ({'; '.join(notes)})"
        rec = {"stints": to_json_stints(chosen), "confidence": conf, "evidence": why}
        if real and real[1]:
            rec["preLeagueRings"] = real[1]  # real-NFL rings on his card, won before the save began
        if not dated:
            rec["approx"] = True  # years are a placeholder; only the team is known
        alts = [list(a) for a in ev.get("alternatives", [])]
        if not alts and conf == "ambiguous":
            seen = {ring_sig(chosen)}
            for s in top:
                if ring_sig(s[2]) not in seen:
                    seen.add(ring_sig(s[2]))
                    alts.append(list(s[2]))
        if alts:
            rec["alternatives"] = [[{"team": t, "from": a, "to": b} for t, a, b in alt] for alt in alts[:3]]
        out[name] = rec
        report.append((conf, name, rec))

    if explain:
        return
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    from collections import Counter
    c = Counter(r[0] for r in report)
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} players", dict(sorted(c.items())))
    if "--list" in sys.argv:
        for conf, name, rec in sorted(report):
            st = " ; ".join(f"{x['team']} {x['from']}-{x['to']} {x['rings']}" for x in rec["stints"])
            print(f"{conf:9} {name:24} {st}{'  (approx)' if rec.get('approx') else ''}")


if __name__ == "__main__":
    main()
