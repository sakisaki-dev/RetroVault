#!/usr/bin/env python3
"""Read NFL Retro Bowl's own save (pulled off the iPhone by scripts/pull_save.py) and turn it into Retro Vault data.

The save replaces screen-recording transcription: every number comes straight from the game's player records. The
raw save is private (data/saves/ is git-ignored, never pushed); only the derived data files it produces through an
upload bundle are committed.

    npm run -s save:check                       # reconciliation report: RV careers vs the save (no writes)
    python3 scripts/save_read.py --check        # the same
    python3 scripts/save_read.py --state        # LIVE mode: write data/uploads/<date>-save-y<n>w<week>/manifest.json (--tag X adds -X)
                                                #   (one save.state mutation: ages, ratings, contracts, the season so
                                                #   far, club records, the coach's game log); then npm run update on it
    python3 scripts/save_read.py --complete     # SEASON-COMPLETE mode: write data/uploads/<date>-save-y<n>/manifest.json
                                                #   (player.set careers, new players with their clubs, superbowl.set,
                                                #   coach.season, record.set, retirements, club changes)
    python3 scripts/save_read.py --complete --check [--season 92]
                                                # dry run: build the bundle in memory and diff it against data/y80
    options: --slot N (default: the slot with the highest settings.year), --save <path to a save .json>,
             --date YYYY-MM-DD (bundle date, default today)

Save format, stat mapping and rounding: docs/GAME_MECHANICS.md "Save format". In short:
  * a player is playing when teamid >= 0 and age <= max age (40 QB/K/P, else 35) + delay_retirement;
  * sta_c is the career, sta_s the season so far; a player who is not playing keeps his LAST season in sta_s, so his
    career is sta_c as it stands. For a playing player the career before this season is sta_c - sta_s;
  * yards are floats: the game shows them rounded half to even (Python round()).
"""
from __future__ import annotations

import collections
import datetime as dt
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
SAVES = ROOT / "data" / "saves"
UPLOADS = ROOT / "data" / "uploads"

# Position codes (docs/GAME_MECHANICS.md). The NFL edition splits the secondary: 8 cornerbacks, 9 safeties; Retro
# Vault has one DB group for both.
POS = {1: "QB", 2: "RB", 3: "TE", 4: "WR", 5: "OL", 6: "DL", 7: "LB", 8: "DB", 9: "DB", 10: "K", 11: "P"}
MAX_AGE = {"QB": 40, "K": 40, "P": 40}  # everyone else 35

# Retro Vault career key -> path in the save's stat block (sta_c / sta_s), verified against data/y80/players.json
# (299 of 324 matched players agree on every field; the rest are listed by --check). The game reuses fields by
# position: a receiver's catches are att.no and his yards pass.yds; an OL's blocks are tck; a defender's fumble
# recoveries (Retro Vault "ff") are fum, while the save's own ff only holds the imported real-life 2024 lines.
_OFF_QB = {"g": "games", "att": "att.no", "cmp": "cmp.no", "yds": "pass.yds", "td": "td", "int": "int.by",
           "sck": "sack.by", "ratt": "rush.att", "ryds": "rush.yds", "rtd": "rush.td"}
_RB = {"g": "games", "ratt": "rush.att", "ryds": "rush.yds", "rtd": "rush.td", "fum": "fum", "rec": "att.no",
       "recyds": "pass.yds", "rectd": "td"}
_REC = {"g": "games", "rec": "att.no", "yds": "pass.yds", "td": "td", "fum": "fum"}
_OL = {"g": "games", "blk": "tck"}
_DEF = {"g": "games", "tkl": "tck", "int": "int.by", "sck": "sack.by", "ff": "fum"}
_K = {"g": "games", "fgm": "fgm", "fga": "fga"}
STAT_MAP = {"QB": _OFF_QB, "RB": _RB, "WR": _REC, "TE": _REC, "OL": _OL, "DL": _DEF, "LB": _DEF, "DB": _DEF,
            "K": _K, "P": _K}
AWARDS = ("rings", "mvp", "opoy", "dpoy", "roty", "sbmvp")

# Record board: the game's tag -> Retro Vault's record name (records.json). The four coach records (most points,
# biggest win / loss, most TDs) live in coach.json bests, not on the player board.
RECORD_TAGS = {
    "ui_LongPassingPlay": "Longest passing play", "ui_LongRushingPlay": "Longest rushing play",
    "ui_LongPassTD": "Longest passing TD", "ui_LongRushTD": "Longest rushing TD", "ui_LongPassAir": "Longest pass (air)",
    "ui_LongFG": "Longest field goal", "ui_BestPassGame": "Best passing game", "ui_BestPassSeason": "Best passing season",
    "ui_BestPassCareer": "Best passing career", "ui_BestRecGame": "Best receiving game",
    "ui_BestRecSeason": "Best receiving season", "ui_BestRecCareer": "Best receiving career",
    "ui_BestRushGame": "Best rushing game", "ui_BestRushSeason": "Best rushing season",
    "ui_BestRushCareer": "Best rushing career", "ui_MostTDPassesGame": "Most TD passes, game",
    "ui_MostTDPassesSeason": "Most TD passes, season", "ui_MostTDPassesCareer": "Most TD passes, career",
    "ui_MostTDRecGame": "Most TD receptions, game", "ui_MostTDRecSeason": "Most TD receptions, season",
    "ui_MostTDRecCareer": "Most TD receptions, career", "ui_MostTDRushGame": "Most rushing TDs, game",
    "ui_MostTDRushSeason": "Most rushing TDs, season", "ui_MostTDRushCareer": "Most rushing TDs, career",
    "ui_BestFGDistGame": "Most FG yards, game", "ui_BestFGDistSeason": "Most FG yards, season",
    "ui_BestFGDistCareer": "Most FG yards, career", "ui_MostFGGame": "Most field goals, game",
    "ui_MostFGSeason": "Most field goals, season", "ui_MostFGCareer": "Most field goals, career",
    "ui_MostTacklesGame": "Most tackles, game", "ui_MostTacklesSeason": "Most tackles, season",
    "ui_MostTacklesCareer": "Most tackles, career", "ui_MostSacksGame": "Most sacks, game",
    "ui_MostSacksSeason": "Most sacks, season", "ui_MostSacksCareer": "Most sacks, career",
    "ui_MostIntGame": "Most interceptions, game", "ui_MostIntSeason": "Most interceptions, season",
    "ui_MostIntCareer": "Most interceptions, career", "ui_MostFFGame": "Most forced fumbles, game",
    "ui_MostFFSeason": "Most forced fumbles, season", "ui_MostFFCareer": "Most forced fumbles, career",
    "ui_LongKickReturn": "Longest kick return", "ui_MostReturnYardsGame": "Most return yards, game",
    "ui_MostReturnYardsSeason": "Most return yards, season", "ui_MostReturnYardsCareer": "Most return yards, career",
}

# Live-state fields per player (owner decisions: no morale, bio is age only, never the game's own Hall of Fame)
LIVE_FIELDS = ("age", "speed", "strength", "skill", "stamina", "max_speed", "max_strength", "max_skill", "max_stamina",
               "injury_week", "contract", "salary", "delay_retirement", "xp_level")
FORBIDDEN = {"attitude", "morale", "height", "weight", "hof", "hof_candidate"}


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------
def norm(name: str) -> str:
    """The site's normalizeName (src/utils/leagueContent.ts) plus accent folding: curly or straight apostrophes
    dropped, punctuation to spaces, lower case."""
    s = unicodedata.normalize("NFKD", name)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[‘’ʼ`´']", "", s).lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def num(v: float) -> int:
    """A save number as the game shows it: yards are floats, rounded half to even (15,482.5 shows as 15,482)."""
    return int(round(v + 0.0))


def find_save(slot: int | None = None, path: str | None = None) -> Path:
    """The newest data/saves/<date>/nfl/Documents, then the slot with the highest settings.year (or --slot)."""
    if path:
        return Path(path).resolve()
    days = sorted(d for d in SAVES.glob("*/nfl/Documents") if d.is_dir())
    if not days:
        sys.exit(f"no save found under {SAVES.relative_to(ROOT)}/<date>/nfl/Documents (run scripts/pull_save.py)")
    docs = days[-1]
    files = sorted(docs.glob("rb_nfl_savedata_[0-9]*.json"))
    if slot is not None:
        f = docs / f"rb_nfl_savedata_{slot}.json"
        if not f.exists():
            sys.exit(f"{f.relative_to(ROOT)} not found (slots here: {', '.join(x.stem.rsplit('_', 1)[1] for x in files)})")
        return f
    best = None
    for f in files:
        try:
            year = json.loads(f.read_text())["settings"]["year"]
        except (ValueError, KeyError):
            continue
        if best is None or year > best[0]:
            best = (year, f)
    if best is None:
        sys.exit(f"no readable save slot in {docs.relative_to(ROOT)}")
    return best[1]


def _get(block: dict, path: str) -> float:
    for k in path.split("."):
        block = block.get(k, 0) if isinstance(block, dict) else 0
    return block or 0


def line(block: dict, pos: str, minus: dict | None = None) -> dict:
    """A stat block (sta_c or sta_s, optionally minus another) as Retro Vault career keys."""
    out = {}
    for k, path in STAT_MAP.get(pos, {}).items():
        v = _get(block, path) - (_get(minus, path) if minus else 0)
        out[k] = num(v)
    for a in AWARDS:
        if a in block:
            out[a] = num(block[a] - (minus.get(a, 0) if minus else 0))
    return out


class Save:
    """One save slot, normalised."""

    def __init__(self, path: Path):
        self.path = path
        raw = json.loads(path.read_text())
        self.sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
        st = raw["settings"]
        self.settings = st
        self.year = int(st["year"])
        self.week = int(st["week"])
        self.start_year = int(st["start_year"])
        self.my_team = int(st["myteam_id"])
        self.teams = {int(t["uid"]): t for t in raw["teams"]["list"]}
        self.tla = {t["tla"]: t["name"] for t in self.teams.values()}
        self.history = raw["history"]["list"]
        self.bowls = raw["history_bowls"]["list"]
        self.records = raw["records"]["list"]
        self.schedule = raw["schedule"]["list"]
        # the current season is complete once the coach's history has a row for it
        self.season_done = any(int(h["year"]) == self.year for h in self.history)
        self.players = [self._player(i, p) for i, p in enumerate(raw["players"]["pool"])]
        self.id = f"Y{self.year}w{self.week}"

    def club(self, uid) -> str | None:
        t = self.teams.get(int(uid))
        return t["name"] if t else None

    def _player(self, i: int, p: dict) -> dict:
        pos = POS.get(int(p["position"]), str(int(p["position"])))
        playing = p["teamid"] >= 0 and p["age"] <= MAX_AGE.get(pos, 35) + p.get("delay_retirement", 0)
        name = f'{p["fname"]} {p["lname"]}'.strip()
        c, s = p["sta_c"], p["sta_s"]
        # a player who isn't playing keeps his last season in sta_s: his career is sta_c as it stands
        before = line(c, pos, s) if playing and not self.season_done else line(c, pos)
        return {
            "i": i, "uid": str(p["uid"]), "name": name, "pos": pos,  # uids repeat in the pool: i (index) is the id
            "norm": norm(name), "playing": playing,
            "teamid": int(p["teamid"]), "club": self.club(p["teamid"]) if p["teamid"] >= 0 else None,
            "leave": p.get("team_leave_reason", ""), "raw": p,
            "career_now": line(c, pos),          # everything to date, this season included
            "career_before": before,             # through the last completed season
            "season": line(s, pos) if playing else None,
        }


# ---------------------------------------------------------------------------
# Matching to data/y80/players.json
# ---------------------------------------------------------------------------
GROUP = {"QB": "QB", "RB": "RB", "WR": "REC", "TE": "REC", "OL": "OL", "DL": "DEF", "LB": "DEF", "DB": "DEF"}


def rv_players() -> list[dict]:
    return [p for p in json.loads((SRC / "players.json").read_text()) if not p.get("legend")]


def match(save: Save, rv: list[dict]):
    """Pairs (rv row, save player) on normalised name + position; a name found once at another position in the same
    stat group (LB/DL/DB, WR/TE) also matches. Returns pairs, RV players not in the save, save players not in RV."""
    by_np = collections.defaultdict(list)
    by_n = collections.defaultdict(list)
    for p in save.players:
        by_np[(p["norm"], p["pos"])].append(p)
        by_n[p["norm"]].append(p)

    def pick(cands):
        # same name twice: prefer the one playing, then the most games
        return sorted(cands, key=lambda p: (not p["playing"], -p["career_now"].get("g", 0)))[0]

    pairs, missing, used = [], [], set()
    for r in rv:
        cands = by_np.get((norm(r["n"]), r["pos"]))
        if not cands:
            alt = [p for p in by_n.get(norm(r["n"]), []) if GROUP.get(p["pos"]) == GROUP.get(r["pos"])]
            cands = alt if len(alt) == 1 else None
        if cands:
            p = pick(cands)
            pairs.append((r, p))
            used.add(p["i"])
        else:
            missing.append(r)
    extra = [p for p in save.players if p["i"] not in used]
    return pairs, missing, extra


def rv_key(r: dict) -> str:
    return f'{r["pos"]}:{r["n"]}'


def rv_status() -> dict:
    """Retro Vault's effective status and club per player, from the generated league sheet (public/data/initial-data.csv)."""
    out, pos = {}, None
    path = ROOT / "public" / "data" / "initial-data.csv"
    if not path.exists():
        return out
    import csv
    short = {t["name"]: k for k, t in json.loads((SRC / "teams.json").read_text()).items()}  # full name -> club
    for row in csv.reader(path.read_text().splitlines()):
        if len(row) == 1 and row[0] in GROUP:
            pos = row[0]
        elif pos and len(row) > 3 and row[0] != "Name":
            out[(row[0], pos)] = {"status": row[1], "team": short.get(row[2], row[2]) or None}
    return out


# ---------------------------------------------------------------------------
# --check: reconciliation report
# ---------------------------------------------------------------------------
def reconcile(save: Save) -> dict:
    rv = rv_players()
    pairs, missing, extra = match(save, rv)
    mism = []
    for r, p in pairs:
        diffs = [(k, r[k], v) for k, v in p["career_before"].items() if k in r and isinstance(r[k], (int, float)) and r[k] != v]
        if diffs:
            mism.append((r, p, diffs))
    return {"pairs": pairs, "missing": missing, "extra": extra, "mismatches": mism}


def print_report(save: Save):
    rep = reconcile(save)
    pairs, missing, extra, mism = rep["pairs"], rep["missing"], rep["extra"], rep["mismatches"]
    rel = save.path.relative_to(ROOT) if save.path.is_relative_to(ROOT) else save.path
    print(f"save {rel}: Y{save.year} week {save.week}, {'season complete' if save.season_done else 'season in progress'}, "
          f"coach's club {save.club(save.my_team)}, {len(save.players)} players in the pool, "
          f"{sum(p['playing'] for p in save.players)} playing")
    fields = sum(1 for r, p in pairs for k in p["career_before"] if k in r)
    bad = sum(len(d) for _, _, d in mism)
    print(f"\nmatched {len(pairs)} of {len(pairs) + len(missing)} Retro Vault players (legends excluded); "
          f"{len(pairs) - len(mism)} agree on every field, {fields - bad} of {fields} fields agree")
    print(f"  (compared: Retro Vault's Y{save.year - 1 if not save.season_done else save.year} career = save career"
          f"{' - save season' if not save.season_done else ''} for players still playing, save career for the rest)")
    if mism:
        print(f"\nSTAT MISMATCHES ({len(mism)} players): field RV -> save")
        for r, p, diffs in sorted(mism, key=lambda x: (x[0]["pos"], x[0]["n"])):
            state = "playing" if p["playing"] else f"not playing (age {num(p['raw']['age'])}{', ' + p['leave'] if p['leave'] else ''})"
            print(f"  {rv_key(r)} [{state}]: " + ", ".join(f"{k} {a} -> {b}" for k, a, b in diffs))
    new = [p for p in extra if p["playing"] and p["pos"] in GROUP]
    kickers = [p for p in extra if p["playing"] and p["pos"] not in GROUP]
    print(f"\nNEW IN THE SAVE ({len(new)} playing players Retro Vault lacks; {len(kickers)} kickers/punters, which Retro "
          f"Vault doesn't track; {sum(not p['playing'] for p in extra)} more not playing: free agents and draft pool "
          f"(teamid -1), long-retired real players (teamid -4), retirees)")
    for p in sorted(new, key=lambda p: (p["club"] or "", p["pos"], p["name"])):
        print(f"  {p['pos']}:{p['name']} ({p['club']}, age {num(p['raw']['age'])}, {p['career_now'].get('g', 0)} games)")
    print(f"\nRETRO VAULT PLAYERS NOT IN THE SAVE ({len(missing)}; expected: long-retired players the game dropped)")
    by_pos = collections.defaultdict(list)
    for r in missing:
        by_pos[r["pos"]].append(r["n"])
    for pos in sorted(by_pos):
        print(f"  {pos} ({len(by_pos[pos])}): " + ", ".join(sorted(by_pos[pos])))
    st = rv_status()
    act_rv = {k for k, v in st.items() if v["status"] == "Active"}
    gone = [(r, p) for r, p in pairs if (r["n"], r["pos"]) in act_rv and not p["playing"]]
    if gone:
        print(f"\nACTIVE IN RETRO VAULT, NOT PLAYING IN THE SAVE ({len(gone)})")
        for r, p in gone:
            print(f"  {rv_key(r)}: age {num(p['raw']['age'])}, {p['leave'] or 'past retirement age' if p['teamid'] >= 0 else 'no club'}")
    moved = [(r, p) for r, p in pairs if p["playing"] and st.get((r["n"], r["pos"]), {}).get("team") not in (None, p["club"])]
    if moved:
        print(f"\nCLUB DIFFERS ({len(moved)}): Retro Vault -> save")
        for r, p in moved:
            print(f"  {rv_key(r)}: {st[(r['n'], r['pos'])]['team'] or 'FA'} -> {p['club']}")


# ---------------------------------------------------------------------------
# LIVE mode: one save.state mutation
# ---------------------------------------------------------------------------
def coach_games(save: Save) -> list[dict]:
    me = save.my_team
    games = []
    for g in sorted(save.schedule, key=lambda g: g["week"]):
        home, away = int(g["home_team"]), int(g["away_team"])
        if me not in (home, away):
            continue
        at_home = home == me
        opp = save.teams[away if at_home else home]["tla"]
        row = {"week": int(g["week"]), "opp": opp, "home": at_home}
        if g["human_result"] != "unplayed" and g["home_score"] >= 0:
            us, them = (g["home_score"], g["away_score"]) if at_home else (g["away_score"], g["home_score"])
            row.update({"for": int(us), "against": int(them), "result": "W" if us > them else "L" if us < them else "T"})
        games.append(row)
    return games


def live_value(save: Save) -> dict:
    rv = rv_players()
    pairs, _, extra = match(save, rv)

    def fields(p):
        raw = p["raw"]
        out = {"team": p["club"]}
        out.update({k: num(raw.get(k, 0)) for k in LIVE_FIELDS})
        out["season"] = {k: v for k, v in (p["season"] or {}).items() if v or k == "g"}
        return out

    players = {rv_key(r): fields(p) for r, p in sorted(pairs, key=lambda x: rv_key(x[0])) if p["playing"]}
    new = {f'{p["pos"]}:{p["name"]}': fields(p) for p in sorted(extra, key=lambda p: (p["pos"], p["name"]))
           if p["playing"] and p["pos"] in GROUP}
    clubs = {t["name"]: {"abbr": t["tla"], "w": num(t["wins"]), "l": num(t["losses"]), "t": num(t["ties"]),
                         "off": num(t["offense"]), "def": num(t["defense"])}
             for _, t in sorted(save.teams.items())}
    st = save.settings
    return {
        "season": save.year, "week": save.week,
        "club": save.club(save.my_team),
        "settings": {"facilities": {"rehab": num(st.get("facility_rehab", 0)), "stadium": num(st.get("facility_stadium", 0)),
                                    "training": num(st.get("facility_training", 0))},
                     "salary_cap": num(st.get("salary_cap", 0)) + num(st.get("boost_salary_cap", 0)),  # the cap in force: base + the boost the game adds
                     "salary_cap_base": num(st.get("salary_cap", 0)), "fans": num(st.get("fans", 0)),
                     "coach_rating": num(st.get("coach_rating", 0))},
        "clubs": clubs,
        "coachGames": coach_games(save),
        "players": players,
        "newPlayers": new,
    }


def save_source(save: Save) -> str:
    return f"save:{save.path.name}"


def manifest_head(save: Save, bundle_id: str, date: str) -> dict:
    rel = save.path.relative_to(ROOT) if save.path.is_relative_to(ROOT) else save.path
    return {"id": bundle_id, "created": date,
            "save": {"file": save.path.name, "path": str(rel), "sha256": save.sha256, "season": save.year,
                     "week": save.week, "complete": save.season_done},
            "ai_steps": [], "mutations": []}


def build_state(save: Save, date: str, tag: str | None = None) -> dict:
    bid = f"{date}-save-y{save.year}w{save.week}" + (f"-{tag}" if tag else "")  # --tag: a second import of the same week (a fix)
    m = manifest_head(save, bid, date)
    m["mutations"].append({
        "lane": "stats", "op": "save.state", "target": save.id, "value": live_value(save),
        "source": save_source(save), "reason": f"Live state of Y{save.year} week {save.week} read from the game's save",
        "trigger": "New save pulled from the phone (scripts/pull_save.py)"})
    return m


# ---------------------------------------------------------------------------
# SEASON-COMPLETE mode: an ordinary upload bundle
# ---------------------------------------------------------------------------
def roman(n: int) -> str:
    out = ""
    for v, s in ((1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
                 (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")):
        while n >= v:
            out += s
            n -= v
    return out


def record_holder(r: dict) -> str:
    def name(s):
        return re.sub(r"^(\S+) (\S)\.\s*", r"\1 \2. ", s)
    if r.get("playername") not in (None, "", "0"):
        return f"{name(r['qbname'])} → {name(r['playername'])}"
    return name(r["qbname"])


def record_mark(r: dict) -> str:
    v = num(r["stat"])
    return f"{v:,} yds" if r.get("stat_text") == "y" else f"{v:,}"


def build_complete(save: Save, date: str, season: int | None = None) -> tuple[dict, list[str]]:
    """The bundle for a completed season. season defaults to the latest complete one (the save's year once its
    history row exists, else the year before). Careers are taken through that season."""
    done = save.year if save.season_done else save.year - 1
    season = season or done
    if season != done:
        sys.exit(f"the save can only reproduce Y{done} (its latest completed season), not Y{season}")
    m = manifest_head(save, f"{date}-save-y{season}", date)
    src = save_source(save)
    notes = []
    muts = m["mutations"]

    def add(op, target, value, reason, trigger=f"Season Y{season} complete in the save"):
        muts.append({"lane": "stats", "op": op, "target": target, "value": value, "source": src, "reason": reason,
                     "trigger": trigger})

    rv = rv_players()
    pairs, _, extra = match(save, rv)
    st = rv_status()
    facts = json.loads((SRC / "owner_facts.json").read_text())
    for r, p in sorted(pairs, key=lambda x: rv_key(x[0])):
        car = p["career_before"]
        change, drops = {}, []
        for k, v in car.items():
            old = r.get(k)
            if old is None and not v:
                continue
            if old == v:
                continue
            if isinstance(old, (int, float)) and v < old:
                drops.append(f"{k} {old} -> {v}")
            else:
                change[k] = v
        if drops:  # a total that would drop means the two disagree: hold the whole line back for a human
            notes.append(f"held back (a career total would drop; check by hand): {rv_key(r)} " + ", ".join(drops)
                         + (f"; would also raise {', '.join(f'{k} {r.get(k)} -> {v}' for k, v in change.items())}" if change else ""))
        elif change:
            add("player.set", rv_key(r), change, "Career line from the save")
        status = st.get((r["n"], r["pos"]), {})
        owner = facts.get("players", {}).get(r["n"], {})
        if status.get("status") == "Active" and not p["playing"]:
            why = "retired" if p["leave"] == "retired" else f"past retirement age ({num(p['raw']['age'])})" \
                if p["teamid"] >= 0 else "no club"
            add("fact.set", f"players/{r['n']}/status", "Retired", f"Not playing in the save: {why}")
        elif p["playing"] and status.get("team") not in (None, p["club"]) and owner.get("team") != p["club"]:
            add("fact.set", f"players/{r['n']}/team", p["club"], f"The save has him at the {p['club']}")
    for p in sorted(extra, key=lambda p: (p["pos"], p["name"])):
        if p["playing"] and p["career_before"].get("g", 0) > 0 and p["pos"] in GROUP:
            add("player.set", f"{p['pos']}:{p['name']}", {"team": p["club"], **p["career_before"]},
                "New player from the save")
    # Super Bowls, coach seasons
    sbs = {s["year"]: s for s in json.loads((SRC / "super_bowls.json").read_text())}
    coach = json.loads((SRC / "coach.json").read_text())
    seasons = {s["year"]: s for s in coach["seasons"]}
    hist = {int(h["year"]): h for h in save.history}
    for b in save.bowls:
        y = int(b["year"]) - save.start_year
        if y > season:
            continue
        mine = hist.get(y, {}).get("name")
        val = {"number": y + 59, "roman": roman(y + 59), "winner": save.tla.get(b["winner"], b["winner"]),
               "score": b["result"], "loser": save.tla.get(b["loser"], b["loser"]),
               "your_result": {1: "won", -1: "lost"}.get(int(b["human"]), "not in it"),
               "your_team": mine if int(b["human"]) else None}
        old = sbs.get(f"Y{y}")
        if old is None or any(old.get(k) != v for k, v in val.items()):
            add("superbowl.set", f"Y{y}", val, "Super Bowl history in the save")
    for y, h in sorted(hist.items()):
        if y > season:
            continue
        val = {"team": h["name"], "abbr": h["tla"], "w": num(h["wins"]), "l": num(h["losses"]), "t": num(h["ties"]),
               "finish": h["finish"]}
        old = seasons.get(y)
        if old is None or any(old.get(k) != v for k, v in val.items()):
            add("coach.season", str(y), val, "The coach's season history in the save")
    # Record board: only marks set through the season (a mark from a later week of an unfinished season waits)
    recs = {r["record"]: r for r in json.loads((SRC / "records.json").read_text())["records"]}
    for r in save.records:
        name = RECORD_TAGS.get(r["tag"])
        if not name:
            continue
        y = int(r["year"])
        if y > season:
            notes.append(f"record {name}: {record_mark(r)} by {record_holder(r)} is from Y{y} (after Y{season}); not set")
            continue
        val = {"mark": record_mark(r), "holder": record_holder(r), "year": f"Y{y}"}
        old = recs.get(name)
        if old is None or old.get("mark") != val["mark"] or old.get("year") != val["year"]:
            add("record.set", name, val, "Record board in the save")
    return m, notes


def dry_run(save: Save, m: dict, notes: list[str]):
    ops = collections.Counter(x["op"] for x in m["mutations"])
    print(f"--complete --check: {m['id']} would carry {len(m['mutations'])} mutations "
          f"({', '.join(f'{k} {v}' for k, v in sorted(ops.items())) or 'none'}); nothing written")
    for x in m["mutations"]:
        v = x["value"]
        shown = json.dumps(v, ensure_ascii=False)
        print(f"  {x['op']:<14} {x['target']}: {shown[:160]}")
    for n in notes:
        print(f"  note: {n}")


def write_bundle(m: dict) -> Path:
    d = UPLOADS / m["id"]
    d.mkdir(parents=True, exist_ok=True)
    (d / "manifest.json").write_text(json.dumps(m, indent=1, ensure_ascii=False) + "\n")
    return d


def main():
    args = sys.argv[1:]

    def opt(name):
        return args[args.index(name) + 1] if name in args else None

    save = Save(find_save(int(opt("--slot")) if opt("--slot") else None, opt("--save")))
    date = opt("--date") or dt.date.today().isoformat()
    if "--state" in args:
        d = write_bundle(build_state(save, date, opt("--tag")))
        print(f"wrote {d.relative_to(ROOT)}/manifest.json; next: npm run update -- {d.relative_to(ROOT)}")
    elif "--complete" in args:
        m, notes = build_complete(save, date, int(opt("--season")) if opt("--season") else None)
        if "--check" in args:
            dry_run(save, m, notes)
        else:
            d = write_bundle(m)
            for n in notes:
                print(f"note: {n}")
            print(f"wrote {d.relative_to(ROOT)}/manifest.json ({len(m['mutations'])} mutations); next: "
                  f"npm run update -- {d.relative_to(ROOT)}")
    else:
        print_report(save)


if __name__ == "__main__":
    main()
