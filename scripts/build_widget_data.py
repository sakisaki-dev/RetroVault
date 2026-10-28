#!/usr/bin/env python3
"""Build public/data/widget.json: the small data file the Scriptable iPhone widget reads (public/widgets/).

Run from the repo root after build_league_content.py (npm run rebuild runs it). Everything here is rule-based and
deterministic: templates over the data, never prose. The only authored text it carries is already approved text
passed through: the latest Season Story's articles and "Did you know" facts (story.set) and the first line of each
Hall of Fame speech (speech.set).

* stories           the latest Season Story's articles (no quick hits): kind, headline, dek, lead team, id
* didYouKnow        the story's facts plus rule-generated ones: rate leaders (with a minimum sample per position),
                    small-sample standouts, league and active career leaders, oddities (most rings without an MVP...),
                    iron men, one-team legends, up-and-comers (high OVR or grade, few games), active players closing
                    on a milestone, record chases
* vault             evergreen history cards: every Super Bowl, the record board, the Hall of Fame (speech hook, class,
                    Career Legacy) and the generated storylines (eras, rivalries, snubs, chases...)
* movers            top 2 risers and top faller between the last two market snapshots (base value >= 50)
* headlines         the top 4 "What changed" headlines, each with the club its bullet wears
* cards             banner data (team, OVR, grade, Career Legacy, value change) for every player an item names
* spotlightFallback notable active players for when there is nothing else to show
* hofWatch          active players closest to the Hall of Fame line (Career Legacy 7,000): points to go, share
* chases            the closest active chases of all-time career records: have, mark, share, amount to go
* milestones        active players closest to a round career number (the MILESTONES steps): amount to go
* champion          the latest season's Super Bowl (lock screen: "Y82 · Jets won CXLI")
* coach             the coach's surname: history cards say "Skura's Ravens", never "your"

The widget rotates through didYouKnow and vault with a shuffle seeded by edition.seed (scripts/build_league_content.py),
so the order changes with every update but never between two rebuilds.
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_league_content as B  # noqa: E402  (data and helpers only; its main() does not run on import)

PUB = ROOT / "public" / "data"
OUT = PUB / "widget.json"
CONTENT = json.loads((PUB / "league" / "content.json").read_text())
MARKET = json.loads((PUB / "market.json").read_text())
EXTRAS = json.loads((PUB / "player-extras.json").read_text())
LOG = json.loads((B.SRC / "mutations_log.json").read_text()).get("applied", [])

MAX_FACTS = 100
MARKET_MIN_VALUE = B.MARKET_MIN_VALUE
g, fmt, plural, join, short = B.g, B.fmt, B.plural, B.join, B.short


def nick(team: str | None) -> str | None:
    """Club nickname ("Tampa Bay Buccaneers" -> "Buccaneers"), the key the widget's colour table uses."""
    return team.split()[-1] if team else None


def sheet() -> dict[str, dict]:
    """The league sheet (public/data/initial-data.csv): status, current team and nicknames per "POS:Name"."""
    out, pos, header = {}, None, None
    for row in csv.reader(io.StringIO((PUB / "initial-data.csv").read_text())):
        cells = [c.strip() for c in row]
        if not any(cells):
            header = None
            continue
        if len(cells) == 1 and cells[0] in {"QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K", "P"}:
            pos = cells[0]
            continue
        if cells[0] == "Name":
            header = cells
            continue
        if header and pos:
            r = dict(zip(header, cells))
            out[f"{pos}:{r['Name']}"] = r
    return out


SHEET = sheet()
LATEST = MARKET[-1]["players"] if MARKET else {}
PREV = MARKET[-2]["players"] if len(MARKET) > 1 else {}
KEY = {p["n"]: f"{p['pos']}:{p['n']}" for p in B.LEAGUE}
ACTIVE = {k for k, r in SHEET.items() if r.get("Status") == "Active"}


def active(p) -> bool:
    return KEY[p["n"]] in ACTIVE


def change(k: str) -> int:
    a, b = PREV.get(k), LATEST.get(k)
    if not a or not b or a["value"] < MARKET_MIN_VALUE:
        return 0
    return round((b["value"] - a["value"]) / a["value"] * 100)


def banner_team(name: str) -> str | None:
    """The club the player's banner wears (player-extras signatureTeams: current team if active, best years if retired)."""
    k = KEY.get(name)
    return nick(EXTRAS.get("signatureTeams", {}).get(name) or (SHEET.get(k, {}).get("Team") if k else None))


def units(n: int, what: str) -> str:
    """'1 forced fumble', '3 forced fumbles', '1 receiving TD' (what is the plural)."""
    return f"{fmt(n)} {what[:-1] if n == 1 and what.endswith('s') else what}"


def a_an(word: str) -> str:
    return ("an " if word[:1] in "AEFHILMNORSX" else "a ") + word


def num(v: float, d: int) -> str:
    return f"{v:,.{d}f}"


COACH = (B.COACH.get("name") or "the coach").split()[-1]  # "Dorren Skura" -> "Skura": "Skura's Ravens", never "your"
KEEP_UPPER = {"OVR", "MVP", "MVPS", "QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "TD", "TDS", "INT", "HOF", "NFL", "SB"}
SMALL_WORDS = {"a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "without"}


def title_case(text: str) -> str:
    """'HIGHEST OVR WITHOUT AN MVP' -> 'Highest OVR without an MVP', 'DOLPHINS RUN II' -> 'Dolphins Run II'."""
    out = []
    for i, w in enumerate(text.split()):
        u = w.upper()
        if u in KEEP_UPPER:
            out.append(u[:-1] + "s" if u in ("MVPS", "TDS") else u)
        elif re.fullmatch(r"[IVX]{2,}", u):
            out.append(u)
        elif i and w.lower() in SMALL_WORDS:
            out.append(w.lower())
        else:
            out.append("-".join(x[:1].upper() + x[1:].lower() for x in w.split("-")))
    return " ".join(out)


def third_person(text: str) -> str:
    """Generated storylines speak to the owner ("You met the Eagles", "on your club"); the widget names the coach."""
    text = re.sub(r"\bYou\b", COACH, text)
    text = re.sub(r"\b[Yy]our\b", f"{COACH}'s", text)
    text = re.sub(r"\byou\b", COACH, text)
    return text.replace(" W score not recorded", " W, score not recorded")


# ---------------------------------------------------------------------------
# Did you know: rule-generated facts
# ---------------------------------------------------------------------------
FACTS: list[dict] = []


def fact(fid: str, kind: str, text: str, name: str | None):
    FACTS.append({"id": fid, "kind": kind, "text": text, "player": KEY.get(name) if name else None,
                  "team": banner_team(name) if name else None})


GROUP = {"QB": "quarterback", "RB": "back", "WR": "receiver", "TE": "tight end", "OL": "lineman", "LB": "linebacker",
         "DB": "defensive back", "DL": "defensive lineman"}
# (id, positions, numerator, denominator, sample key, minimum, sample label, higher is better, digits, scale, sentence)
# scale 100 shows a percentage; scale 0 ranks by numerator/denominator but shows the inverse ("one every N games")
# sentence placeholders: {n} name, {v} value, {s} sample, {grp} position group, {min} minimum
RATES = [
    ("qb-cmp", {"QB"}, "cmp", "att", "att", 1000, "attempts", True, 1, 100,
     "{n} completes {v}% of his passes, the best of any quarterback with {min}+ attempts."),
    ("qb-tdint", {"QB"}, "td", "int", "att", 1000, "attempts", True, 2, 1,
     "{n} throws {v} touchdowns for every interception, the best ratio of any quarterback with {min}+ attempts."),
    ("qb-ypa", {"QB"}, "yds", "att", "att", 1000, "attempts", True, 2, 1,
     "{n} averages {v} yards a pass attempt, the best of any quarterback with {min}+ attempts."),
    ("qb-ypg", {"QB"}, "yds", "g", "g", 50, "games", True, 1, 1,
     "{n} averages {v} passing yards a game, the most of any quarterback with {min}+ games."),
    ("qb-tdpg", {"QB"}, "td", "g", "g", 50, "games", True, 2, 1,
     "{n} throws {v} touchdown passes a game, the most of any quarterback with {min}+ games."),
    ("rb-ypc", {"RB"}, "ryds", "ratt", "ratt", 500, "carries", True, 2, 1,
     "{n} averages {v} yards a carry, the best of any back with {min}+ carries."),
    ("rb-ypg", {"RB"}, "ryds", "g", "g", 50, "games", True, 1, 1,
     "{n} averages {v} rushing yards a game, the most of any back with {min}+ games."),
    ("rb-tdpg", {"RB"}, "rtd", "g", "g", 50, "games", True, 2, 1,
     "{n} scores {v} rushing touchdowns a game, the best rate of any back with {min}+ games."),
    ("rb-recypc", {"RB"}, "recyds", "rec", "rec", 100, "catches", True, 1, 1,
     "{n} averages {v} yards a catch out of the backfield, the best of any back with {min}+ catches."),
    ("wr-ypc", {"WR"}, "yds", "rec", "rec", 200, "catches", True, 1, 1,
     "{n} averages {v} yards a catch, the best of any receiver with {min}+ catches."),
    ("wr-ypg", {"WR"}, "yds", "g", "g", 50, "games", True, 1, 1,
     "{n} averages {v} receiving yards a game, the most of any receiver with {min}+ games."),
    ("wr-tdrate", {"WR"}, "td", "rec", "rec", 200, "catches", True, 1, 100,
     "{n} scores a touchdown on {v}% of his catches, the best rate of any receiver with {min}+ catches."),
    ("te-ypc", {"TE"}, "yds", "rec", "rec", 100, "catches", True, 1, 1,
     "{n} averages {v} yards a catch, the best of any tight end with {min}+ catches."),
    ("te-ypg", {"TE"}, "yds", "g", "g", 50, "games", True, 1, 1,
     "{n} averages {v} receiving yards a game, the most of any tight end with {min}+ games."),
    ("te-tdrate", {"TE"}, "td", "rec", "rec", 50, "catches", True, 1, 100,
     "{n} scores a touchdown on {v}% of his catches, the best rate of any tight end with {min}+ catches."),
    ("db-tklpg", {"DB"}, "tkl", "g", "g", 100, "games", True, 2, 1,
     "{n} makes {v} tackles a game, the most of any defensive back with {min}+ games."),
    ("db-intpg", {"DB"}, "int", "g", "g", 100, "games", True, 1, 0,
     "{n} picks off a pass every {v} games, the best rate of any defensive back with {min}+ games."),
    ("lb-tklpg", {"LB"}, "tkl", "g", "g", 100, "games", True, 2, 1,
     "{n} makes {v} tackles a game, the most of any linebacker with {min}+ games."),
    ("lb-sckpg", {"LB"}, "sck", "g", "g", 100, "games", True, 1, 0,
     "{n} gets a sack every {v} games, the best rate of any linebacker with {min}+ games."),
    ("dl-tklpg", {"DL"}, "tkl", "g", "g", 100, "games", True, 2, 1,
     "{n} makes {v} tackles a game, the most of any defensive lineman with {min}+ games."),
    ("dl-sckpg", {"DL"}, "sck", "g", "g", 100, "games", True, 1, 0,
     "{n} gets a sack every {v} games, the best rate of any defensive lineman with {min}+ games."),
    ("ol-blkpg", {"OL"}, "blk", "g", "g", 100, "games", True, 2, 1,
     "{n} makes {v} blocks a game, the most of any lineman with {min}+ games."),
]
# How each rate reads after a number, so a bare "13.4" never shows: {v} is the shown value
UNIT = {"qb-cmp": "{v} completion rate", "qb-tdint": "{v} TDs per INT", "qb-ypa": "{v} yds per attempt",
        "qb-ypg": "{v} passing yds a game", "qb-tdpg": "{v} TD passes a game", "rb-ypc": "{v} yds a carry",
        "rb-ypg": "{v} rushing yds a game", "rb-tdpg": "{v} rushing TDs a game", "rb-recypc": "{v} yds a catch",
        "wr-ypc": "{v} yds a catch", "wr-ypg": "{v} receiving yds a game", "wr-tdrate": "{v} TDs per catch",
        "te-ypc": "{v} yds a catch", "te-ypg": "{v} receiving yds a game", "te-tdrate": "{v} TDs per catch",
        "db-tklpg": "{v} tackles a game", "db-intpg": "one INT every {v} games", "lb-tklpg": "{v} tackles a game",
        "lb-sckpg": "one sack every {v} games", "dl-tklpg": "{v} tackles a game", "dl-sckpg": "one sack every {v} games",
        "ol-blkpg": "{v} blocks a game"}
# Lower-is-better rates: (id, positions, numerator, denominator, sample key, minimum, digits, sentence)
RARE = [
    ("qb-intevery", {"QB"}, "att", "int", "att", 1000, 1,
     "{n} throws an interception once every {v} attempts, the rarest of any quarterback with {min}+ attempts."),
    ("rb-fumevery", {"RB"}, "ratt", "fum", "ratt", 1000, 1,
     "{n} fumbles once every {v} carries, the surest hands of any back with {min}+ carries."),
]


def rate_facts():
    for fid, poss, nu, de, samp, minimum, _label, _hi, d, scale, sentence in RATES:
        pool = [p for p in B.LEAGUE if p["pos"] in poss and g(p, de) > 0]
        val = lambda p: g(p, nu) / g(p, de) * (scale or 1)  # noqa: E731
        show = lambda p: (num(1 / val(p), d) if scale == 0 else num(val(p), d)) + ("%" if scale == 100 else "")  # noqa: E731
        at = lambda p: UNIT[fid].format(v=show(p))  # noqa: E731
        clause = lambda p: sentence.format(n=p["n"], v=show(p).rstrip("%"), min=fmt(minimum)).split(", the ")[0]  # noqa: E731
        pool = [p for p in pool if g(p, nu) > 0] if scale == 0 else pool
        qual = sorted([p for p in pool if g(p, samp) >= minimum], key=lambda p: (-val(p), p["n"]))
        if len(qual) < 3:
            continue
        top, nxt = qual[0], qual[1]
        fact(fid, "leader", sentence.format(n=top["n"], v=show(top).rstrip("%"), min=fmt(minimum))
             + f" Next: {nxt['n']}, {show(nxt)}.", top["n"])
        act = next((p for p in qual if active(p)), None)
        if act and act is not top:
            fact(fid + "-active", "leader", f"Among active players, {act['n']} leads the {GROUP[act['pos']]}s at "
                 f"{at(act)} ({fmt(g(act, samp))} {_label}). The all-time best: {top['n']}, {at(top)}.",
                 act["n"])
        # A short career beating every qualified player
        small = sorted([p for p in pool if minimum // 5 <= g(p, samp) < minimum and val(p) > val(top)],
                       key=lambda p: (-val(p), p["n"]))
        if small:
            s = small[0]
            fact(fid + "-small", "sample", f"{clause(s)} in only {fmt(g(s, samp))} {_label}, better than every "
                 f"{GROUP[s['pos']]} with {fmt(minimum)}+ {_label} (the best of those: {top['n']}, {at(top)}).", s["n"])
    for fid, poss, nu, de, samp, minimum, d, sentence in RARE:
        qual = sorted([p for p in B.LEAGUE if p["pos"] in poss and g(p, samp) >= minimum and g(p, de) > 0],
                      key=lambda p: (-(g(p, nu) / g(p, de)), p["n"]))
        if len(qual) >= 3:
            top, nxt = qual[0], qual[1]
            fact(fid, "leader", sentence.format(n=top["n"], v=num(g(top, nu) / g(top, de), d), min=fmt(minimum))
                 + f" Next: {nxt['n']}, every {num(g(nxt, nu) / g(nxt, de), d)}.", top["n"])


def total_facts():
    """League record holders for each career total, plus the active leader when the record holder has retired."""
    for label, poss, get in B.CAREER_MARKS:
        pool = sorted([p for p in B.LEAGUE if poss is None or p["pos"] in poss], key=lambda p: (-get(p), p["n"]))
        if len(pool) < 2 or get(pool[0]) <= 0:
            continue
        top = pool[0]
        ties = [p for p in pool if get(p) == get(top)]
        fid = "total-" + B.slug(label)
        if len(ties) > 1:
            fact(fid, "record", f"{join([p['n'] for p in ties[:4]])} share the league mark for {label}: {fmt(get(top))}"
                 + (f" ({len(ties)} players)." if len(ties) > 4 else "."), top["n"])
        else:
            nxt = next(p for p in pool if get(p) < get(top))
            fact(fid, "record", f"{top['n']} holds the league mark for {label}: {fmt(get(top))}. "
                 f"Next: {nxt['n']}, {fmt(get(nxt))}.", top["n"])
        act = next((p for p in pool if active(p) and get(p) > 0), None)
        if act and not active(top) and act not in ties and get(act) >= max(2, get(top) * 0.3):
            fact(fid + "-active", "record", f"{act['n']} has the most {label} of any active player: {fmt(get(act))}. "
                 f"The league mark is {fmt(get(top))}.", act["n"])


def oddity_facts():
    L = B.LEAGUE

    def best(fid, cands, key, text):
        cands = sorted(cands, key=lambda p: (-key(p), -B.legacy(p["n"]), p["n"]))
        if cands and key(cands[0]) > 1:
            fact(fid, "oddity", text(cands[0]), cands[0]["n"])

    best("odd-rings-no-mvp", [p for p in L if not g(p, "mvp")], lambda p: g(p, "rings"),
         lambda p: f"{p['n']} has {plural(g(p, 'rings'), 'ring')} and has never won an MVP, the most rings of any player without one.")
    best("odd-sbmvp-no-mvp", [p for p in L if not g(p, "mvp")], lambda p: g(p, "sbmvp"),
         lambda p: f"{p['n']} has {plural(g(p, 'sbmvp'), 'Super Bowl MVP')} but no regular-season MVP, the most of anyone without one.")
    best("odd-mvp-no-ring", [p for p in L if not g(p, "rings")], lambda p: g(p, "mvp"),
         lambda p: f"{p['n']} has {plural(g(p, 'mvp'), 'MVP')} and no ring, the most MVPs of any player still waiting for a title.")
    best("odd-games-no-ring", [p for p in L if not g(p, "rings")], lambda p: g(p, "g"),
         lambda p: f"{p['n']} has played {plural(g(p, 'g'), 'game')} without a ring, the longest wait in the league.")
    best("odd-qb-rush", [p for p in L if p["pos"] == "QB"], lambda p: g(p, "ryds"),
         lambda p: f"{p['n']} has run for {fmt(g(p, 'ryds'))} yards and {plural(g(p, 'rtd'), 'touchdown')}, the most rushing yards by a quarterback.")
    best("odd-db-sacks", [p for p in L if p["pos"] == "DB"], lambda p: g(p, "sck"),
         lambda p: f"{p['n']} has {plural(g(p, 'sck'), 'sack')}, the most by a defensive back.")
    best("odd-lb-int", [p for p in L if p["pos"] == "LB"], lambda p: g(p, "int"),
         lambda p: f"{p['n']} has {plural(g(p, 'int'), 'interception')}, the most by a linebacker.")
    best("odd-dl-int", [p for p in L if p["pos"] == "DL"], lambda p: g(p, "int"),
         lambda p: f"{p['n']} has {plural(g(p, 'int'), 'interception')}, the most by a defensive lineman.")
    best("odd-longest", [p for p in L if p["pos"] in ("WR", "TE")], lambda p: g(p, "lng"),
         lambda p: f"{p['n']}'s longest catch went {fmt(g(p, 'lng'))} yards, the longest by any receiver or tight end card.")
    best("odd-awards", L, lambda p: g(p, "mvp") + g(p, "opoy") + g(p, "dpoy") + g(p, "sbmvp") + g(p, "roty"),
         lambda p: f"{p['n']} has won {plural(g(p, 'mvp') + g(p, 'opoy') + g(p, 'dpoy') + g(p, 'sbmvp') + g(p, 'roty'), 'major award')} "
                   f"(MVP, Player of the Year, Super Bowl MVP, Rookie of the Year), the most in the league.")
    roty_mvp = sorted([p for p in L if g(p, "roty") and g(p, "mvp")], key=lambda p: (-g(p, "mvp"), p["n"]))
    if roty_mvp:
        p = roty_mvp[0]
        fact("odd-roty-mvp", "oddity", f"{plural(len(roty_mvp), 'player')} won Rookie of the Year and later an MVP"
             + ("." if len(roty_mvp) > 1 else ": " + p["n"] + ".")
             + (f" {p['n']} turned it into the most, {g(p, 'mvp')}." if len(roty_mvp) > 1 else ""), p["n"])
    multi = sorted([p for p in L if g(p, "dpoy") >= 2], key=lambda p: (-g(p, "dpoy"), p["n"]))
    if multi:
        p = multi[0]
        fact("odd-dpoy", "oddity", f"{p['n']} has {plural(g(p, 'dpoy'), 'Defensive Player of the Year award')}, the most of any defender.", p["n"])


def iron_facts():
    iron = sorted(B.LEAGUE, key=lambda p: (-g(p, "g"), p["n"]))
    if len(iron) > 1:
        fact("iron-top", "iron", f"{iron[0]['n']} has played {plural(g(iron[0], 'g'), 'game')}, the most in the league. "
             f"Next: {iron[1]['n']}, {fmt(g(iron[1], 'g'))}.", iron[0]["n"])
    act = [p for p in iron if active(p)]
    if act and act[0] is not iron[0]:
        fact("iron-active", "iron", f"{act[0]['n']} has played {plural(g(act[0], 'g'), 'game')}, the most of any active player.", act[0]["n"])
    for pos in ("QB", "RB", "WR", "TE", "OL", "LB", "DB", "DL"):
        pool = [p for p in iron if p["pos"] == pos]
        if pool and pool[0] is not iron[0]:
            fact(f"iron-{pos.lower()}", "iron", f"No {GROUP[pos]} has played more games than {pool[0]['n']}: {fmt(g(pool[0], 'g'))}.", pool[0]["n"])


def one_team_facts():
    legends = []
    for p in B.LEAGUE:
        ds = B.dated_stints(p["n"])
        if ds and len({x["team"] for x in ds}) == 1 and g(p, "g") >= 150 and len(B.STINTS[p["n"]]["stints"]) == len(ds):
            legends.append((p, ds))
    for p, ds in sorted(legends, key=lambda x: (-B.legacy(x[0]["n"]), x[0]["n"]))[:8]:
        fact(f"oneteam-{B.slug(p['n'])}", "oneteam",
             f"{p['n']} has spent all {plural(g(p, 'g'), 'game')} of his career with the {ds[0]['team']} "
             f"(Y{ds[0]['from']}–{ds[-1]['to']}).", p["n"])


def upcomer_facts():
    out = []
    for p in B.LEAGUE:
        k = KEY[p["n"]]
        m = LATEST.get(k)
        if not m or not active(p) or not 0 < g(p, "g") <= 60:
            continue
        if m["ovr"] >= 85 or (m.get("grade") or "")[:1] in ("S", "A"):
            out.append((p, m))
    out.sort(key=lambda pm: (-pm[1]["ovr"], -pm[1].get("skill", 0), pm[0]["n"]))
    for p, m in out[:8]:
        fact(f"rising-{B.slug(p['n'])}", "rising", f"{p['n']} ({p['pos']}) already carries {a_an(m['grade'])} skill grade "
             f"(OVR {m['ovr']}) after only {plural(g(p, 'g'), 'game')}.", p["n"])


def close_milestones() -> list[tuple]:
    """Active players within 10% of a step of the next round career number: (share left, player, key, label, next, now)."""
    out = []
    for p in B.LEAGUE:
        if not active(p):
            continue
        for key, poss, label, step in B.MILESTONES:
            if poss is not None and p["pos"] not in poss:
                continue
            v = g(p, key)
            nxt = (v // step + 1) * step
            if v >= step * 0.9 and nxt - v <= step * 0.1:
                out.append(((nxt - v) / step, p, key, label, nxt, v))
    out.sort(key=lambda x: (x[0], x[1]["n"], x[3]))
    return out


def milestone_facts():
    for share, p, key, label, nxt, v in close_milestones()[:10]:
        what = "games" if key == "g" else label.replace("career ", "")
        fact(f"close-{B.slug(p['n'])}-{B.slug(label)}", "milestone",
             f"{p['n']} is {units(nxt - v, what)} short of {fmt(nxt)} {label} (now {fmt(v)}).", p["n"])


def chase_facts():
    for share, label, holder, chaser, get in B.record_chases():
        fact(f"chase-{B.slug(label)}", "chase", f"{chaser['n']} is {units(get(holder) - get(chaser), label.replace('career ', ''))} "
             f"behind {holder['n']}'s league record for {label} ({fmt(get(holder))}): {round(share * 100)}% of the way there.",
             chaser["n"])


def story_facts(story) -> list[dict]:
    out = []
    for f in (story or {}).get("didYouKnow", []):
        names = [n for n in f.get("players", []) if n in KEY]
        out.append({"id": f["id"], "kind": "story", "text": f["text"], "player": KEY[names[0]] if names else None,
                    "team": banner_team(names[0]) if names else None})
    return out


# ---------------------------------------------------------------------------
# From the Vault: evergreen history
# ---------------------------------------------------------------------------
def vault() -> list[dict]:
    out = []
    for sb in CONTENT["superBowls"]:
        score = (sb.get("score") or "").replace("-", "–")
        mine = f"{COACH}'s {sb['yourTeam']}" if sb.get("yourTeam") else None
        won = sb["yourResult"] == "won" and mine
        winner = mine if won else sb["winner"]
        if score and sb.get("loser"):
            text = f"{sb['winner']} {score} {sb['loser']}." + (f" {mine} won it." if won else f" {mine} lost it." if sb["yourResult"] == "lost" and mine else "")
        elif sb.get("loser"):
            text = f"{winner} beat the {sb['loser']}." + (f" {mine} lost it." if sb["yourResult"] == "lost" and mine else "")
        else:
            text = f"{winner} won it. Opponent and score not recorded."
        out.append({"id": f"sb-{sb['number']}", "kind": "superbowl", "when": f"Y{sb['year']}",
                    "title": f"Super Bowl {sb['roman']}", "text": text, "team": sb["winner"],
                    "owner": sb["yourResult"] == "won"})
    for i, r in enumerate(B.RECORDS):
        names = [n for n in B.board_holder_names(r["holder"]) if n in KEY]
        y = int(r["year"].lstrip("Y")) if r.get("year", "").startswith("Y") else None
        out.append({"id": f"rec-{i}", "kind": "record", "when": r.get("year"), "title": r["record"],
                    "text": f"{r['mark']}, {r['holder']}. Set on {COACH}'s {B.OWNER.get(y) or 'club'}" + (f" in {r['year']}." if y else "."),
                    "team": B.OWNER.get(y), "player": KEY[names[0]] if names else None})
    for cls in CONTENT.get("hofClasses", []):
        for k in cls["keys"]:
            name = k.split(":", 1)[1]
            hook = (CONTENT["speeches"].get(name) or "").strip().split("\n")[0].strip()
            out.append({"id": f"hof-{B.slug(name)}", "kind": "hof", "when": cls["label"] if cls["label"] != "Inaugural class" else "Inaugural",
                        "title": f"Hall of Fame · {name}",
                        "text": (hook + " " if hook else "") + f"Career Legacy {fmt(B.legacy(name))}, {cls['label'].lower() if cls['label'] == 'Inaugural class' else cls['label'] + ' class'}.",
                        "team": banner_team(name), "player": k})
    for s in CONTENT.get("storylines", []):
        if s.get("source") != "generated":
            continue
        out.append({"id": f"story-{s['id']}", "kind": s.get("category", "storyline").lower().replace(" ", "-"),
                    "when": None, "title": third_person(title_case(s["headline"]) if s["headline"].isupper() else s["headline"]),
                    "text": third_person(s["summary"]),
                    "team": next((t for t in (s.get("subheadline") or "").split(" · ")[-1].split(", ") if t in B_TEAMS), None)
                    or (banner_team(s["players"][0]) if s.get("players") and s["players"][0] in KEY else None),
                    "player": KEY.get((s.get("players") or [None])[0])})
    return [{k: v for k, v in x.items() if v not in (None, False)} for x in out]


B_TEAMS = {s["winner"] for s in CONTENT["superBowls"]} | {s["loser"] for s in CONTENT["superBowls"]}


# ---------------------------------------------------------------------------
# Countdowns for the widget's rotating panels and the lock screen
# ---------------------------------------------------------------------------
# Short stat names for the panels ("1,488 rush yds to go"): CAREER_MARKS / MILESTONES label -> abbreviation
SHORT = {"career passing yards": "pass yds", "career passing TDs": "pass TDs", "career rushing yards": "rush yds",
         "career rushing TDs": "rush TDs", "career receiving yards": "rec yds", "career receiving TDs": "rec TDs",
         "career receptions": "catches", "career tackles": "tackles", "career interceptions": "INTs",
         "career sacks": "sacks", "career forced fumbles": "forced fumbles", "career blocks": "blocks",
         "career games": "games"}
HOF_WATCH = 5


def short_unit(label: str, n: int) -> str:
    u = SHORT.get(label, label.replace("career ", ""))
    return u[:-1] if n == 1 and u.endswith("s") and u not in ("pass yds", "rush yds", "rec yds") else u


def hof_watch() -> list[dict]:
    """Active players closest under the Hall of Fame line (Career Legacy 7,000), best first."""
    pool = sorted(((v["legacy"], k) for k, v in LATEST.items() if k in ACTIVE and 0 < v["legacy"] < B.HOF_THRESHOLD),
                  key=lambda x: (-x[0], x[1]))
    out = []
    for lg, k in pool[:HOF_WATCH]:
        name = k.split(":", 1)[1]
        out.append({"player": k, "last": B.surname(name), "pos": k.split(":")[0], "legacy": int(round(lg)),
                    "toGo": int(B.HOF_THRESHOLD - round(lg)), "pct": round(lg / B.HOF_THRESHOLD * 100, 1),
                    "team": banner_team(name)})
    return out


def chases() -> list[dict]:
    """The closest active chases of the league's career records (build_league_content.record_chases)."""
    out = []
    for share, label, holder, chaser, get in B.record_chases():
        gap = get(holder) - get(chaser)
        out.append({"player": KEY[chaser["n"]], "last": B.surname(chaser["n"]), "stat": label.replace("career ", ""),
                    "unit": short_unit(label, gap), "have": get(chaser), "mark": get(holder), "toGo": gap,
                    "pct": round(share * 100), "holder": B.surname(holder["n"]), "team": banner_team(chaser["n"])})
    return out


def milestones() -> list[dict]:
    out = []
    for share, p, key, label, nxt, v in close_milestones()[:6]:
        out.append({"player": KEY[p["n"]], "last": B.surname(p["n"]), "unit": short_unit(label, nxt - v),
                    "toGo": nxt - v, "target": nxt, "have": v, "team": banner_team(p["n"])})
    return out


def champion() -> dict | None:
    sb = next((x for x in reversed(CONTENT["superBowls"]) if f"Y{x['year']}" == CONTENT["season"]), None)
    if not sb:
        return None
    return {k: v for k, v in {"season": CONTENT["season"], "roman": sb["roman"], "winner": sb["winner"],
                              "loser": sb.get("loser"), "owner": sb["yourResult"] == "won"}.items() if v is not None}


def headline_team(h: dict) -> str | None:
    """The club a headline's bullet wears: its first player's banner team, else its first team."""
    names = [n for n in h.get("players") or [] if n in KEY]
    return banner_team(names[0]) if names else nick((h.get("teams") or [None])[0])


# ---------------------------------------------------------------------------
def main():
    story = (CONTENT.get("seasonStories") or [None])[-1]
    stories = [{"id": a["id"], "kind": a["kind"], "headline": a["headline"], "dek": a.get("dek", ""),
                "team": (a.get("teams") or [None])[0]}
               for a in (story or {}).get("articles", []) if a["kind"] not in ("quickhits", "didyouknow")]

    rate_facts()
    total_facts()
    oddity_facts()
    iron_facts()
    one_team_facts()
    upcomer_facts()
    milestone_facts()
    chase_facts()
    seen, facts = set(), []
    order = ["chase", "milestone", "rising", "oddity", "oneteam", "sample", "leader", "record", "iron"]
    ranked = sorted(FACTS, key=lambda f: order.index(f["kind"]))  # stable: keeps each rule's own order
    for f in [*story_facts(story), *ranked]:
        if f["id"] in seen or not f["text"]:
            continue
        seen.add(f["id"])
        facts.append({k: v for k, v in f.items() if v is not None})
    facts = facts[:MAX_FACTS]
    vault_items = vault()

    # Market movers (base value >= 50) between the last two snapshots
    moves = sorted(((change(k), k) for k in LATEST if change(k)), key=lambda x: (-x[0], x[1]))
    movers = [*moves[:2], *[m for m in moves[-1:] if m[0] < 0]]

    # Notable active players for a spotlight when nothing else applies
    def score(k):
        r, m = SHEET[k], LATEST[k]
        return ((2 if r.get("Nicknames") else 0) + (2 if m.get("grade") == "S" else 0) + min(1, abs(change(k)) / 100))
    notable = sorted((k for k in ACTIVE if k in LATEST and (SHEET[k].get("Nicknames") or LATEST[k].get("grade") == "S"
                                                             or abs(change(k)) >= 25)),
                     key=lambda k: (-score(k), -LATEST[k]["legacy"], k))[:14]

    watch, chase_list, close = hof_watch(), chases(), milestones()
    named = ({f["player"] for f in facts if f.get("player")} | {v["player"] for v in vault_items if v.get("player")}
             | set(notable) | {x["player"] for x in [*watch, *chase_list, *close]})
    cards = {}
    for k in sorted(named):
        m = LATEST.get(k)
        name = k.split(":", 1)[1]
        c = {"team": banner_team(name)}
        if m:
            c.update({"ovr": m["ovr"], "grade": m.get("grade"), "legacy": int(round(m["legacy"])), "chg": change(k)})
        nn = SHEET.get(k, {}).get("Nicknames")
        if nn:
            c["nick"] = nn
        cards[k] = {a: b for a, b in c.items() if b not in (None, "")}

    last = LOG[-1] if LOG else {}
    info = CONTENT.get("headlinesInfo") or {}
    data = {
        "version": 1,
        "season": CONTENT["season"],
        "edition": {"label": CONTENT["edition"]["label"], "seed": CONTENT["edition"]["seed"]},
        "updatedLabel": info.get("label") or (MARKET[-1]["label"] if MARKET else ""),
        "latestUpdateAt": (last.get("applied_at") or "")[:10],
        "latestUpload": last.get("id"),
        "storySeason": story["season"] if story else None,
        "storyTagline": story.get("tagline") if story else None,
        "stories": stories,
        "didYouKnow": facts,
        "vault": vault_items,
        "movers": [{"key": k, "last": B.surname(k.split(":", 1)[1]), "pct": d, "team": banner_team(k.split(":", 1)[1])}
                   for d, k in movers],
        "headlines": [{k: v for k, v in {"kind": h["kind"], "text": h["text"], "team": headline_team(h)}.items() if v}
                      for h in CONTENT.get("headlines", [])[:4]],
        "spotlightFallback": notable,
        "hofWatch": watch,
        "chases": chase_list,
        "milestones": close,
        "champion": champion(),
        "coach": COACH,
        "cards": cards,
    }
    data = {k: v for k, v in data.items() if v is not None}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(stories)} articles, {len(facts)} facts "
          f"({sum(f['kind'] == 'story' for f in facts)} from the story), {len(vault_items)} vault cards, "
          f"{len(cards)} player cards, {len(watch)} on HOF watch, {len(chase_list)} record chases, "
          f"{len(close)} milestone countdowns, {OUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
