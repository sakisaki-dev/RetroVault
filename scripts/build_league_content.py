#!/usr/bin/env python3
"""Build public/data/league/content.json (editorial league content) from data/y80.

Run from the repo root:  python3 -I scripts/build_league_content.py

The output is the *bundled default* editorial content. Everything subjective
(storylines, rivalries, lineages, snubs) lives in this JSON so it can be
replaced wholesale by a newer AI-written content.json uploaded in the app
(Commentary tab -> "Update coverage"). The format is documented in
src/utils/leagueContent.ts.

Text is copied from data/y80/league-history.md as-is, with one exception:
single-season stat records are stripped (the app no longer tracks them), via
the explicit EDITS list below. Each edit must match exactly once, so a changed
source file fails loudly instead of silently drifting.
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SRC = os.path.join(ROOT, "data", "y80")
OUT = os.path.join(ROOT, "public", "data", "league", "content.json")

SEASON = "Y80"

# (old, new) replacements applied to league-history.md to drop single-season records.
EDITS = [
    (
        " Baylon's 7,452-yd season (Y33) is the passing season record, and his 3.55 TPG is the best of any QB.",
        " His 3.55 TPG is the best of any QB.",
    ),
    (
        "He set the 32-TD season (Y38), 5-TD game (Y40), 2,104-yd season (Y42, 1 yard short of Dickerson's real record) and career rushing marks.",
        "He set the 5-TD game (Y40) and career rushing marks.",
    ),
    ("Set the 9-TD game and 94-TD season (Y55).", "Set the 9-TD game."),
    # User-confirmed: Avonte Gooden was the QB for the Commanders run.
    (
        "Four straight titles. Alexx Sanchez's 4 rings fit as the QB, but Jayden Daniels and Avonte Gooden are also listed as Commanders, so this is unconfirmed.",
        "Four straight titles with Avonte Gooden at quarterback.",
    ),
    ("Lamar → Sanchez (likely) → Waller", "Lamar → Gooden → Waller"),
    ("- Who played QB for the Commanders run (Sanchez or Daniels)?\n", ""),
]

# User-confirmed player storyline tags (override players.json `tag`).
PLAYER_TAG_FIXES = {
    "Avonte Gooden": "QB of the Commanders four-peat (Y16–19)",
    "Malakai Sawyer": "Won CXXXI with the Titans (Y72), then CXXXVI with the Jets (Y77); traded to the Falcons for Y80",
    "Jason Macleone": "QB of the Vikings' Y78 title (CXXXVII); now with the Seahawks",
    "Levante Hopkins": "Tight end for the Titans' Y70–72 three-peat",
    "Rondale Ikarras": "Seahawks legend and record setter with 0 MVPs; final season with the Jets",
}

# Real franchises for players the screenshots mark CUR (current club = Jets) or UNK; mirrors
# TEAM_FIXES in scripts/build_league_data.py.
CURRENT_CLUB = "Jets"
PLAYER_TEAM_FIXES = {
    "Jason Macleone": "Seahawks",
    "Malakai Sawyer": "Jets",
    "Levante Hopkins": "Titans",
}

# Induction speeches for the inaugural Hall of Fame class, written from the user's descriptions and
# the players' real career numbers. The first paragraph is the headline caption the ceremony shows large.
# Only facts from data/y80 are cited (no single-season marks; God Johnson's reception total is an estimate).
SPEECHES = {
    "Sherman Brandson": """The General never flinched.

Six-foot-seven, built like a tank, and calm enough to put a defense to sleep before he broke its heart. Sherman Brandson stood in the pocket like it belonged to him, and for twenty seasons it did. Pass rushers came in waves and bounced off. Fifty sacks in 315 games. Most quarterbacks give that up in a few bad years.

The numbers read like a typo: 91,463 passing yards, 1,150 touchdown passes, eight MVPs and ten rings, four of them with the Super Bowl MVP trophy in his hands. He looked more like a linebacker than a quarterback, and he played like a man who knew exactly how the next five plays would go.

He did not celebrate much. He did not need to. General Sherman, welcome to the Hall of Fame.""",
    "God Johnson": """He changed his name to God. Then he earned it.

Mason Earl III walked into the league as a receiver. God Johnson walked out as the standard every receiver gets measured against. Some people thought the name was a joke. Defensive coordinators never laughed.

36,005 receiving yards. 378 receiving touchdowns. Ten rings with the Vikings dynasty and five Super Bowl MVPs, because when the lights were brightest the ball found him. And three fumbles. In his entire career. Ian Finney's career receiving mark stood for decades until God took it, with Jackson Wardell Kline lined up beside him.

There is not much left to say about a man who named himself after the only being with a better résumé. God Johnson, welcome to the Hall of Fame.""",
    "Levante Hopkins": """The quiet one who did the dirty work.

Levante Hopkins never looked the part. Glasses off the field, soft-spoken in the locker room, the guy you would mistake for a team analyst. Then he put the helmet on, and nobody in the league wanted to be the one assigned to him.

He played 291 games and caught 1,194 passes for 12,353 yards and 174 touchdowns. He won nine rings and was Super Bowl MVP twice. He was the tight end at the center of the Titans' three-peat from Y70 to Y72: blocking on first down, finding the soft spot on third, and finishing in the red zone.

He never asked for the ball. He just made it hard to lose with him on the field. Levante Hopkins, welcome to the Hall of Fame.""",
    "Ian Finney": """The first superstar. The Infinity Man.

Before the dynasties had names, there was Ian Finney. He was the first player in this league who made you stop what you were doing to watch, the receiver every kid in the backyard pretended to be.

He started with the Commanders' four-peat, then carried the Buccaneers through the Waller–Finney era with Tyrion Kline at his side: nine rings, four in Washington and five in Tampa Bay. He caught 1,902 passes for 32,980 yards and 292 touchdowns at 17.3 yards a catch, and every one of them looked effortless. Add five Offensive Player of the Year awards, an MVP and three Super Bowl MVPs.

Every great receiver who came after him was chasing Ian Finney. Most of them still are. The Infinity Man, welcome to the Hall of Fame.""",
    "Rondale Ikarras": """Flashy, loud, unstoppable, and he knew it. He was that guy.

Rondale Ikarras never just ran through a hole. He ran through it with style, pointed at the crowd, and made sure the cameras got his good side on the way to the end zone. The Prodigal Son played like every snap was a highlight reel, and most of them were.

23,178 rushing yards. 374 rushing touchdowns. Nine rings, four Offensive Player of the Year awards and five Super Bowl MVPs. The career rushing records carry his name. He built a legend in Seattle, three straight titles as the heartbeat of the Seahawks, and took one last ride with the Jets before hanging it up.

Zero regular-season MVPs. He will tell you about that one. Rondale Ikarras, Seahawks legend, welcome to the Hall of Fame.""",
}

# User-confirmed corrections to eras.json, keyed by era name.
ERA_FIXES = {
    "Commanders run": {
        "key_players": ["Avonte Gooden", "Ian Finney", "Brennan Higgins"],
        "notes": "Four straight titles with Avonte Gooden at quarterback.",
    },
    "Ikarras era": {
        "notes": "Ikarras's 9 rings match your 9 titles in this window, and every rushing record falls. "
        "He is a Seahawks legend (titles Y36–38); he finished his career with one season as a Jet.",
    },
    "Modern era": {
        "key_players": ["Malakai Sawyer", "Jason Macleone", "Levante Hopkins", "Chance Woodrum"],
        "notes": "Titans three-peat (Y70–72) with Levante Hopkins at tight end and Malakai Sawyer in his one "
        "Titans season, then a loss to those same Titans as the Seahawks in CXXXIII (Y74). The Jets, your "
        "current club, won CXXXVI (Y77) with Sawyer. Jason Macleone, now a Seahawk, quarterbacked the Vikings "
        "to the Y78 title (CXXXVII). Sawyer was traded to the Falcons ahead of Y80.",
    },
}


def team_for(p):
    """Real franchise for a player note: user-confirmed fixes, CUR -> current club, UNK -> none."""
    team = PLAYER_TEAM_FIXES.get(p["n"], p.get("team"))
    if team == "CUR":
        return CURRENT_CLUB
    return None if team == "UNK" else team


def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return json.load(f) if name.endswith(".json") else f.read()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("’", "").replace("'", "")).strip("-")


def parse_years(years):
    """'Y1–15' -> (1, 15)."""
    m = re.match(r"Y(\d+)\s*[–-]\s*Y?(\d+)", years)
    if not m:
        raise ValueError(f"Unparseable era years: {years!r}")
    return int(m.group(1)), int(m.group(2))


def split_sections(md, level):
    """Split markdown into {heading: body} for headings of exactly `level` #'s."""
    prefix = "#" * level + " "
    out, cur, buf = {}, None, []
    for line in md.splitlines():
        if line.startswith(prefix):
            if cur is not None:
                out[cur] = "\n".join(buf).strip()
            cur, buf = line[len(prefix):].strip(), []
        elif cur is not None:
            if re.match(r"^#{1,%d} " % level, line):  # higher-level heading ends the section
                out[cur] = "\n".join(buf).strip()
                cur, buf = None, []
            else:
                buf.append(line)
    if cur is not None:
        out[cur] = "\n".join(buf).strip()
    return out


def bullets(body):
    return [l[2:].strip() for l in body.splitlines() if l.startswith("- ")]


def table_rows(body):
    rows = [l for l in body.splitlines() if l.startswith("|")]
    parsed = [[c.strip() for c in r.strip("|").split("|")] for r in rows]
    return parsed[2:] if len(parsed) > 2 else []  # skip header + separator


def first_sentence(text):
    plain = re.sub(r"\*\*|__|\*", "", text).strip()
    plain = re.sub(r"^[-|]\s*", "", plain.split("\n")[0])
    m = re.match(r"(.+?[.!?])(\s|$)", plain)
    return (m.group(1) if m else plain).strip()


# Surnames too generic to match on their own in prose.
SURNAME_STOPLIST = {"Hall", "John", "Junior", "Wood", "Square", "Candy", "Fox", "Baker", "Rice", "Daniel", "Lamb",
                    "Chase", "Jackson", "Queen", "Taylor", "Wilson", "Kline", "Hunter", "Ankou", "Irving", "Rankin"}


def main():
    eras_src = [{**e, **ERA_FIXES.get(e["name"], {})} for e in load("eras.json")]
    sbs_src = load("super_bowls.json")
    players_src = load("players.json")
    md = load("league-history.md")

    for old, new in EDITS:
        if md.count(old) != 1:
            sys.exit(f"Edit did not match exactly once: {old[:60]!r}")
        md = md.replace(old, new)

    known_names = sorted({p["n"] for p in players_src}, key=len, reverse=True)

    surname_counts = {}
    for n in known_names:
        last = n.split()[-1]
        surname_counts[last] = surname_counts.get(last, 0) + 1

    def mentioned(text):
        """Known player names referenced in text: full names first, then unambiguous surnames."""
        found = []
        for n in known_names:
            if n in text and not any(n in f for f in found):
                found.append(n)
        for n in known_names:
            last = n.split()[-1]
            if n in found or surname_counts[last] > 1 or last in SURNAME_STOPLIST:
                continue
            if re.search(r"\b%s\b" % re.escape(last), text):
                found.append(n)
        return found

    # ---- Super Bowls -------------------------------------------------------
    super_bowls = []
    for sb in sbs_src:
        super_bowls.append({
            "number": sb["number"],
            "roman": sb["roman"],
            "year": int(sb["year"].lstrip("Y")),
            "winner": sb["winner"],
            "loser": sb["loser"],
            "score": sb["score"],
            "yourResult": sb["your_result"],
            "yourTeam": sb["your_team"],
        })

    # ---- Eras --------------------------------------------------------------
    h2 = split_sections(md, 2)
    era_md = split_sections(h2["Eras"], 3)
    era_sections = {}
    for heading, body in era_md.items():
        m = re.match(r"\d+\.\s*(.+?)\s*\(", heading)
        if m:
            era_sections[m.group(1).strip()] = body

    eras = []
    for e in eras_src:
        start, end = parse_years(e["years"])
        history = era_sections.get(e["name"], "")
        eras.append({
            "id": slug(e["name"]),
            "name": e["name"],
            "startYear": start,
            "endYear": end,
            "superBowlRange": e["super_bowls"],
            "yourTeams": e["your_teams"],
            "keyPlayers": e["key_players"],
            "rival": e.get("rival"),
            "notes": e["notes"],
            "history": history,
        })

    # ---- Storylines --------------------------------------------------------
    storylines = []

    def add(**kw):
        kw.setdefault("players", mentioned(kw["body"]))
        kw.setdefault("summary", first_sentence(kw["body"]))
        storylines.append({k: v for k, v in kw.items() if v is not None})

    record = h2["Your record"]
    record_bullets = record.split("\n\n")[0]
    add(id="your-record", headline="54–6 IN THE BIG GAME",
        subheadline="Sixty Super Bowl appearances, Y1 through Y79",
        body=record_bullets, tier="breaking", category="Dynasty Ledger")

    era_tiers = ["analysis", "milestone", "analysis", "milestone", "controversy", "analysis", "milestone", "analysis"]
    for i, era in enumerate(eras):
        body = era["history"]
        rival_para = None
        paras = body.split("\n\n")
        kept = []
        for p in paras:
            if p.startswith("**The rival:**"):
                rival_para = p
            else:
                kept.append(p)
        body = "\n\n".join(kept)
        era["history"] = body
        era["_rival_para"] = rival_para
        add(id=f"era-{era['id']}", headline=era["name"].upper(),
            subheadline=f"Y{era['startYear']}–{era['endYear']} · Super Bowls {era['superBowlRange']} · {', '.join(era['yourTeams'])}",
            body=body, tier=era_tiers[i % len(era_tiers)], category="Era Report", era=era["name"])

    # Rivalries
    rivalries = []
    for era in eras:
        para = era.pop("_rival_para")
        if not para:
            continue
        text = para.replace("**The rival:** ", "")
        meetings = [
            {"roman": sb["roman"], "year": sb["year"], "score": sb["score"], "result": sb["yourResult"],
             "yourTeam": sb["yourTeam"], "opponent": sb["winner"] if sb["yourResult"] == "lost" else sb["loser"]}
            for sb in super_bowls
            if era["startYear"] <= sb["year"] <= era["endYear"] and sb["yourResult"] == "lost"
        ]
        rivalries.append({
            "id": f"rival-{era['id']}",
            "rival": "Kyric McQuay" if "McQuay" in text else mentioned(text)[0],
            "team": meetings[0]["opponent"] if meetings else None,
            "era": era["name"],
            "summary": text,
            "meetings": meetings,
        })
        add(id=f"rivalry-{era['id']}", headline="THE ONE WHO GOT AWAY",
            subheadline=era["rival"], body=text, tier="hot-take", category="Rivalry", era=era["name"])

    # Lineages
    lineages = []
    for b in bullets(h2["Lineages"]):
        m = re.match(r"\*\*(.+?):\*\*\s*(.+)", b)
        label, rest = m.group(1), m.group(2)
        chain_part, _, note = rest.partition(". ")
        chain = [c.strip().rstrip(".") for c in chain_part.split("→")]
        lineages.append({"id": slug(label), "label": label, "chain": chain, "note": note.strip() or None})
    add(id="lineages", headline="PASSING THE TORCH", subheadline="Quarterback and receiver lineages across 80 seasons",
        body=h2["Lineages"], tier="analysis", category="Lineage")

    # Snubs
    snubs = []
    for b in bullets(h2["Snubs"]):
        m = re.match(r"\*\*(.+?)\*\*:?\s*(.+)", b)
        title = m.group(1).rstrip(":") if m else None
        snubs.append({"id": slug(title or b[:30]), "title": title, "summary": b, "players": mentioned(b)})
    add(id="snubs", headline="ZERO MVPS, EVERY RECORD", subheadline="The league's biggest snubs",
        body=h2["Snubs"], tier="controversy", category="Snub Watch")

    # Outsiders
    outsiders = [
        {"player": r[0], "position": r[1].split(",")[0].strip(), "team": r[1].split(",")[1].strip() if "," in r[1] else None, "summary": r[2]}
        for r in table_rows(h2["Best players who never played for you"])
    ]
    add(id="outsiders", headline="THE ONES THAT GOT AWAY", subheadline="Best players who never played for you",
        body=h2["Best players who never played for you"], tier="hot-take", category="Outside the Dynasty",
        summary="Amani Bryant, Nico Curl, Jayon Queen and the stars who never wore your colors.")

    add(id="metrics", headline="THE RING TAX", subheadline="What your spreadsheet metrics get wrong",
        body=h2["Your spreadsheet metrics"], tier="controversy", category="Analytics")
    add(id="composites", headline="BUILD THE PERFECT PLAYER", subheadline="Composite greats at every position",
        body=h2['Composite "perfect" players'], tier="power-ranking", category="Fantasy Draft")

    open_questions = bullets(h2["Open questions"])
    add(id="open-questions", headline="UNSOLVED MYSTERIES", subheadline="What the archives can't confirm",
        body=h2["Open questions"], tier="analysis", category="Open Questions")

    # Player storyline tags (era + tag) from players.json
    player_notes = [
        {k: v for k, v in {"name": p["n"], "team": team_for(p), "position": p.get("pos"), "nickname": p.get("nick"),
                           "era": p.get("era"), "tag": PLAYER_TAG_FIXES.get(p["n"], p.get("tag"))}.items() if v}
        for p in players_src if p.get("tag") or p.get("era") or p["n"] in PLAYER_TAG_FIXES
    ]

    content = {
        "version": 1,
        "season": SEASON,
        "title": "Y80 League History",
        "source": "data/y80 (eras.json, super_bowls.json, league-history.md, players.json)",
        "eras": eras,
        "superBowls": super_bowls,
        "storylines": storylines,
        "rivalries": rivalries,
        "lineages": lineages,
        "snubs": snubs,
        "outsiders": outsiders,
        "openQuestions": open_questions,
        "playerNotes": player_notes,
        "speeches": SPEECHES,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"Wrote {os.path.relpath(OUT, ROOT)}: {len(eras)} eras, {len(super_bowls)} Super Bowls, "
          f"{len(storylines)} storylines, {len(rivalries)} rivalries, {len(lineages)} lineages, {len(snubs)} snubs")


if __name__ == "__main__":
    main()
