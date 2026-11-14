#!/usr/bin/env python3
"""Season Story and Hot Takes checks: the third and fourth AI-authored lanes (data/y80/stories.json, written only by a
`story.set` upload mutation; data/y80/hot_takes.json, written only by `takes.set`).

Used by scripts/apply_upload.py (validation before a story.set / takes.set applies) and by scripts/audit.ts (which runs
`python3 scripts/story_check.py --audit` and `--audit-takes` and reads the JSON they print).

Hot takes (check_takes): {reason, trigger, intro?, takes[]}, each take {id "y90-take-<slug>", headline (the take, one
line, at most 20 words), dek, body [1-3 paragraphs, 60-180 words], heat 1|2|3, players, teams, stats}; checked with the
same article rules below (every number cited and matching its source, tags, quotes, voice, no em dashes).

A season story is {reason, trigger, tagline, articles[], didYouKnow[]?}; didYouKnow items are short standalone facts
(statistical outliers, up-and-comers, oddities) {id, text, players: [names], stats: [{label, value, source}]}, at most
40 words, held to the same rules as an article (numbers cited, tags exist, no em dashes). Each article is
  {id, kind, headline, dek, body: [paragraphs], players: [names], teams: [names], stats: [{label, value, source}],
   related: [ids of earlier articles it continues]}
kind: lead | feature | trade | rise | fall | rivalry | chase | milestone | wherenow | quickhits

Rules checked here (CLAUDE.md "Season story"):
  * exactly one lead; lead body 180-350 words, other articles 90-220, quick hits 4-8 one-liners (<= 40 words each)
  * no em dashes anywhere
  * every tagged player exists in players.json, every tagged team in teams.json, every related id exists
  * every number written in the headline, dek or body appears in the article's stats[] values (Y82, CXLI and other
    season / Roman labels are not numbers)
  * every stats[] value matches the data at its cited source (see SOURCES below)
  * a professional story (owner: "remove my words or 'the owner', treat it like a professional story"): no "owner",
    no second person ("you", "your"), and nothing in quotation marks except a player's nickname (no journal quotes)

SOURCES (the `source` of a stats[] entry; the value is compared after dropping commas, "+", "%" and spaces;
numbers are compared at the precision written, so "17.2" matches 17.21):
  players.json <POS:Name> <key>                    career total on the card; <a>/<b> is a rate (yds/rec), <a>+<b> a
                                                    sum (td+rtd/g), a trailing % a percentage (cmp/att%)
  market_history.json <snap> <POS:Name> <field>    a market snapshot (field: ovr skill legacy value grade s.<key>;
                                                    s.<a>/s.<b> is a career rate as of that snapshot)
  market_history.json <snapA>..<snapB> <POS:Name> <field>
                                                    the change between two snapshots (s.<key>, ovr, value...);
                                                    s.<a>/s.<b> is the rate of the changes, value% the % change
  super_bowls.json Y82 <field>                      a Super Bowl row (number roman winner loser score ...)
  coach.json Y82 <field>                            a coached season (w l t finish team; "record" = w-l[-t])
  coach.json <path/with/slashes>                    any other coach.json value (record/regular, superBowlRecord/0/titles)
  records.json <record name> <field>                a record-board row (mark holder year)
  <file>.json <path/with/slashes>                   owner_facts.json, stints.json, content.json (public/data/league),
                                                    teams.json, schedule.json (public/data/league: game logs, tables,
                                                    head-to-head, e.g. "schedule.json seasons/Y88/coachGames/[week=13]/for"
                                                    or "seasons/Y88/table/[abbr=PHI]/pf"), schedules.json (raw weekly
                                                    scores), save_state.json (data/y80: the live save, e.g.
                                                    "save_state.json players/RB:Ryland Maxwell/age" or
                                                    "clubs/Eagles/w"); list items by index or [key=value]; # = list
                                                    length. content.json mechanics/... holds the rule facts' numbers
  <source> minus <source>                           a gap between two figures (yards to the record; a record-board
                                                    mark such as "7,452 yds" counts by its number)
  crossed: market_history.json <snapA>..<snapB> <POS:Name> <field>
                                                    a round milestone passed between two snapshots: the stated
                                                    value must be above the first figure and at most the second
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
CONTENT = ROOT / "public" / "data" / "league" / "content.json"
sys.path.insert(0, str(ROOT / "scripts"))
import market_history  # noqa: E402

KINDS = {"lead", "feature", "trade", "rise", "fall", "rivalry", "chase", "milestone", "wherenow", "quickhits"}
BOUNDS = {"lead": (180, 350)}
FEATURE_BOUNDS = (90, 220)
QUICK_HITS = (4, 8)
QUICK_HIT_MAX_WORDS = 40
# Hot takes (the fourth AI lane, data/y80/hot_takes.json): each take is held to the article rules, body 60-180 words
TAKE_BOUNDS = (60, 180)
TAKE_COUNT = (3, 12)
TAKE_HEADLINE_MAX_WORDS = 20
HEAT = {1, 2, 3}
EM_DASH = "—"


def _read(path: Path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


class Data:
    def __init__(self):
        self.players = {f'{p["pos"]}:{p["n"]}': p for p in _read(SRC / "players.json", [])}
        self.names = {p["n"] for p in self.players.values()}
        self.nicks = {str(p["nick"]).lower() for p in self.players.values() if p.get("nick")}
        self.teams = set(_read(SRC / "teams.json", {}))
        self.market = {s["id"]: s for s in market_history.load(SRC / "market_history.json")}
        self.sbs = {s["year"]: s for s in _read(SRC / "super_bowls.json", [])}
        self.coach = _read(SRC / "coach.json", {"seasons": []})
        self.records = {r["record"]: r for r in _read(SRC / "records.json", {"records": []})["records"]}
        self.files = {
            "owner_facts.json": SRC / "owner_facts.json",
            "stints.json": SRC / "stints.json",
            "teams.json": SRC / "teams.json",
            "content.json": CONTENT,
            "schedule.json": ROOT / "public" / "data" / "league" / "schedule.json",
            "schedules.json": SRC / "schedules.json",
            "save_state.json": SRC / "save_state.json",
        }
        self.stories = (_read(SRC / "stories.json", {}) or {}).get("seasons", {})
        self.takes = (_read(SRC / "hot_takes.json", {}) or {}).get("seasons", {})


# ---------------------------------------------------------------------------
# Source resolution
# ---------------------------------------------------------------------------
class Unresolved(Exception):
    pass


def walk(obj, path: str):
    for part in [p for p in path.split("/") if p]:
        if part == "#" and isinstance(obj, (list, dict)):
            obj = len(obj)
            continue
        m = re.fullmatch(r"\[(.+?)=(.+)\]", part)
        if m and isinstance(obj, list):
            k, v = m.groups()
            obj = next((x for x in obj if isinstance(x, dict) and str(x.get(k)) == v), None)
        elif isinstance(obj, list) and part.isdigit():
            obj = obj[int(part)] if int(part) < len(obj) else None
        elif isinstance(obj, dict):
            obj = obj.get(part)
        else:
            obj = None
        if obj is None:
            raise Unresolved(f"nothing at {part!r}")
    return obj


def ratio(get, expr: str):
    """<a>/<b> is a rate; <a>+<b> sums keys (td+rtd/g: total touchdowns per game); a trailing % makes a rate a
    percentage (cmp/att% = completion rate)."""
    pct = expr.endswith("%")
    expr = expr.rstrip("%")

    def total(e):
        return sum(get(k) for k in e.split("+"))
    if "/" in expr:
        a, b = expr.split("/", 1)
        num, den = total(a), total(b)
        if not den:
            raise Unresolved(f"{b} is 0")
        return num / den * (100 if pct else 1)
    return total(expr) * (100 if pct else 1)


def as_number(v):
    """A figure for arithmetic: numbers as they are, record-board marks like "7,452 yds" by their leading number."""
    if isinstance(v, (int, float)):
        return v
    m = re.match(r"\s*(-?[\d,]+(?:\.\d+)?)", str(v))
    if not m:
        raise Unresolved(f"{v!r} is not a number")
    return float(m.group(1).replace(",", ""))


def market_field(snap: dict, key: str, field: str):
    p = snap["players"].get(key)
    if p is None:
        raise Unresolved(f"{key} is not in market snapshot {snap['id']}")
    if field.startswith("s."):
        return (p.get("s") or {}).get(field[2:], 0)
    if field not in p:
        raise Unresolved(f"no {field} in market snapshot {snap['id']} for {key}")
    return p[field]


def resolve(d: Data, source: str):
    if " minus " in source:
        a, b = source.split(" minus ", 1)
        return as_number(resolve(d, a)) - as_number(resolve(d, b))
    file, _, rest = source.strip().partition(" ")
    rest = rest.strip()
    if not rest:
        raise Unresolved("source needs a file and a selector")
    if file == "players.json":
        target, _, expr = rest.rpartition(" ")
        p = d.players.get(target)
        if p is None:
            raise Unresolved(f"no player {target} in players.json")

        def get(k):
            if k not in p:
                raise Unresolved(f"{target} has no {k}")
            return p[k]
        return ratio(get, expr)
    if file == "market_history.json":
        snap, _, rest2 = rest.partition(" ")
        key, _, field = rest2.rpartition(" ")
        if ".." in snap:
            a_id, b_id = snap.split("..", 1)
            if a_id not in d.market or b_id not in d.market:
                raise Unresolved(f"unknown market snapshot in {snap}")
            a, b = d.market[a_id], d.market[b_id]
            if field == "value%":
                va, vb = market_field(a, key, "value"), market_field(b, key, "value")
                return (vb - va) / va * 100 if va else 0
            if field.startswith("s.") and "/" in field:
                x, y = field.split("/", 1)
                y = y if y.startswith("s.") else f"s.{y}"
                dy = market_field(b, key, y) - market_field(a, key, y)
                if not dy:
                    raise Unresolved(f"{y} did not change")
                return (market_field(b, key, x) - market_field(a, key, x)) / dy
            return market_field(b, key, field) - market_field(a, key, field)
        if snap not in d.market:
            raise Unresolved(f"unknown market snapshot {snap}")
        if field.startswith("s.") and "/" in field:  # a career rate as of that snapshot (s.yds/s.rec)
            x, y = field.split("/", 1)
            y = y if y.startswith("s.") else f"s.{y}"
            den = market_field(d.market[snap], key, y)
            if not den:
                raise Unresolved(f"{y} is 0 in market snapshot {snap} for {key}")
            return market_field(d.market[snap], key, x) / den
        return market_field(d.market[snap], key, field)
    if file == "super_bowls.json":
        year, _, field = rest.partition(" ")
        row = d.sbs.get(year)
        if row is None or field not in row:
            raise Unresolved(f"no {field} for Super Bowl {year}")
        return row[field]
    if file == "coach.json":
        m = re.fullmatch(r"Y(\d+) (\S+)", rest)
        if m:
            row = next((s for s in d.coach["seasons"] if s["year"] == int(m.group(1))), None)
            if row is None:
                raise Unresolved(f"no coached season Y{m.group(1)}")
            if m.group(2) == "record":
                return f"{row['w']}-{row['l']}" + (f"-{row['t']}" if row.get("t") else "")
            if m.group(2) not in row:
                raise Unresolved(f"Y{m.group(1)} has no {m.group(2)}")
            return row[m.group(2)]
        return walk(d.coach, rest)
    if file == "records.json":
        name, _, field = rest.rpartition(" ")
        row = d.records.get(name)
        if row is None or field not in row:
            raise Unresolved(f"no record-board row {name!r} / {field}")
        return row[field]
    if file in d.files:
        return walk(_read(d.files[file], {}), rest)
    raise Unresolved(f"unknown source file {file}")


def norm(v) -> str:
    t = str(v).replace(",", "").replace("%", "").replace(" ", "").replace("−", "-").replace("–", "-").strip()
    return t[1:] if re.fullmatch(r"\+[\d.]+", t) else t


def matches(stated, actual) -> bool:
    s, a = norm(stated), norm(actual)
    try:
        sv, av = float(s), float(actual if isinstance(actual, (int, float)) else a)
    except ValueError:
        return s.lower() == a.lower()
    dec = len(s.split(".", 1)[1]) if "." in s else 0
    a_txt, s_txt = f"{av:.{dec}f}", f"{sv:.{dec}f}"
    return a_txt == s_txt or a_txt.lstrip("-") == s_txt.lstrip("-")


# ---------------------------------------------------------------------------
# Article checks
# ---------------------------------------------------------------------------
# a number in prose; "49ers" is a team name, not a figure
NUM = re.compile(r"(?<![A-Za-z\d.,])\d[\d,]*(?:\.\d+)?(?!\d|ers\b)")
# words that break the professional voice: the person running the save is never in the story
FORBIDDEN = re.compile(r"\b(owner|owner's|owners|you|your|yours|yourself)\b", re.I)
QUOTE = re.compile(r"[\"“]([^\"”]+)[\"”]")


def words(text: str) -> int:
    return len(text.split())


def numbers_in(text: str) -> list[str]:
    out = []
    for m in NUM.finditer(text):
        tok = m.group(0).rstrip(",.")
        out.append(tok.replace(",", ""))
    return out


ART_SCENES = {"vs", "turf", "weather", "podium", "spotlight", "lineup"}
ART_WEATHER = {"snow", "rain", "dome", "clear"}
# The site draws a club's sky from these (src/components/news/ArticleArt.tsx skyOf): a roof is a dome, else snowfall
# 50+ snows and rainfall 55+ rains. A hint claiming weather must agree with that club's stadium in the save.
SNOW_AT, RAIN_AT = 50, 55


def check_art(d: Data, a: dict) -> list[str]:
    """The optional `art` hint on a story article or a hot take: {scene, players, teams, weather}. Every name a card
    player, every club one of the 32, and weather true to the club's stadium in the save (save_state.json clubs)."""
    art = a.get("art")
    aid = a.get("id") or "?"
    if art is None:
        return []
    if not isinstance(art, dict):
        return [f"{aid}: art must be an object {{scene, players, teams, weather}}"]
    errs = []
    extra = set(art) - {"scene", "players", "teams", "weather"}
    if extra:
        errs.append(f"{aid}: art has unknown keys {sorted(extra)}")
    if "scene" in art and art["scene"] not in ART_SCENES:
        errs.append(f"{aid}: art scene {art['scene']!r} is not one of {', '.join(sorted(ART_SCENES))}")
    for p in art.get("players", []) or []:
        if p not in d.names:
            errs.append(f"{aid}: art player {p!r} is not a card player in players.json")
    for t in art.get("teams", []) or []:
        if t not in d.teams:
            errs.append(f"{aid}: art team {t!r} is not one of the 32 clubs")
    w = art.get("weather")
    if w is not None:
        if w not in ART_WEATHER:
            errs.append(f"{aid}: art weather {w!r} is not one of {', '.join(sorted(ART_WEATHER))}")
        elif w != "clear":
            club = (art.get("teams") or a.get("teams") or [None])[0]
            if not club:
                names = art.get("players") or a.get("players") or []
                club = next((p.get("team") for p in d.players.values() if names and p["n"] == names[0]), None)
            stadium = ((_read(d.files["save_state.json"], {}) or {}).get("clubs") or {}).get(club or "", {})
            if "rainfall" not in stadium:
                errs.append(f"{aid}: art weather {w!r} needs a club whose stadium the save records (got {club!r})")
            else:
                roof = (stadium.get("roof") or 0) > 0
                ok = {"dome": roof, "snow": not roof and (stadium.get("snowfall") or 0) >= SNOW_AT,
                      "rain": not roof and (stadium.get("rainfall") or 0) >= RAIN_AT}[w]
                if not ok:
                    errs.append(f"{aid}: art weather {w!r} doesn't match the {club} stadium in the save "
                                f"(roof {stadium.get('roof', 0)}, snowfall {stadium.get('snowfall')}, rainfall {stadium.get('rainfall')})")
    return errs


def check_article(d: Data, a: dict, known_ids: set[str], bounds: tuple[int, int] | None = None) -> tuple[list[str], list[str]]:
    """(errors, stale): stale = a stats value that no longer matches its source. `bounds` overrides the body length
    (hot takes: TAKE_BOUNDS)."""
    errs: list[str] = []
    stale: list[str] = []
    aid = a.get("id") or "?"
    kind = a.get("kind")
    if kind not in KINDS:
        errs.append(f"{aid}: kind {kind!r} is not one of {', '.join(sorted(KINDS))}")
    for k in ("id", "headline", "dek"):
        if not a.get(k) or not isinstance(a.get(k), str):
            errs.append(f"{aid}: needs a {k}")
    body = a.get("body")
    if not isinstance(body, list) or not body or not all(isinstance(p, str) and p.strip() for p in body):
        errs.append(f"{aid}: body must be a list of paragraphs")
        body = []
    text_parts = [a.get("headline") or "", a.get("dek") or "", *body]
    if kind == "quickhits":
        if not QUICK_HITS[0] <= len(body) <= QUICK_HITS[1]:
            errs.append(f"{aid}: quick hits needs {QUICK_HITS[0]}-{QUICK_HITS[1]} one-liners (has {len(body)})")
        for line in body:
            if "\n" in line or words(line) > QUICK_HIT_MAX_WORDS:
                errs.append(f"{aid}: quick hit is not a one-liner: {line[:50]}...")
    else:
        lo, hi = bounds or BOUNDS.get(kind, FEATURE_BOUNDS)
        n = sum(words(p) for p in body)
        if not lo <= n <= hi:
            errs.append(f"{aid}: body is {n} words ({lo}-{hi} for a {kind})")
    for t in text_parts:
        if EM_DASH in t:
            errs.append(f"{aid}: em dash in {t[:40]!r}")
    for p in a.get("players", []):
        if p not in d.names:
            errs.append(f"{aid}: player {p!r} is not in players.json")
    for t in a.get("teams", []):
        if t not in d.teams:
            errs.append(f"{aid}: team {t!r} is not in teams.json")
    errs.extend(check_art(d, a))
    for r in a.get("related", []):
        if r not in known_ids:
            errs.append(f"{aid}: related id {r!r} is not an earlier article")
    stats = a.get("stats", [])
    stated: set[str] = set()
    for s in stats:
        if not all(s.get(k) not in (None, "") for k in ("label", "value", "source")):
            errs.append(f"{aid}: stats entry needs label, value and source: {s}")
            continue
        if EM_DASH in str(s["label"]):
            errs.append(f"{aid}: em dash in stat label {s['label']!r}")
        stated.update(numbers_in(str(s["value"])))
        try:
            if str(s["source"]).startswith("crossed: "):
                snaps, _, rest = s["source"][len("crossed: "):].partition(" ")[2].partition(" ")
                a_id, _, b_id = snaps.partition("..")
                key, _, field = rest.rpartition(" ")
                if a_id not in d.market or b_id not in d.market:
                    raise Unresolved(f"unknown market snapshot in {snaps}")
                lo, hi = market_field(d.market[a_id], key, field), market_field(d.market[b_id], key, field)
                if not lo < float(norm(s["value"])) <= hi:
                    stale.append(f"{aid}: stat {s['label']!r}: {s['value']} was not crossed ({lo} -> {hi})")
                continue
            actual = resolve(d, s["source"])
        except (Unresolved, ValueError, TypeError) as e:
            errs.append(f"{aid}: stat {s['label']!r}: source {s['source']!r} does not resolve ({e})")
            continue
        if not matches(s["value"], actual):
            stale.append(f"{aid}: stat {s['label']!r} says {s['value']}, {s['source']} has {actual!r}")
    for t in text_parts:
        for n in numbers_in(t):
            if n not in stated and n.lstrip("0") not in {x.lstrip("0") for x in stated}:
                errs.append(f"{aid}: the number {n} in {t[:60]!r}... is not in its stats[]")
        for q in QUOTE.findall(t):
            ql = q.strip().lower().rstrip(".,")
            if ql not in d.nicks:
                errs.append(f"{aid}: quoted text {q[:50]!r} is not a nickname (only nicknames go in quotation marks)")
        for w in FORBIDDEN.findall(t):
            errs.append(f"{aid}: {w!r} in {t[:50]!r}: write it as a professional story (no owner, no second person)")
    return errs, stale


def check_season(d: Data, season: str, value) -> tuple[list[str], list[str]]:
    if not isinstance(value, dict):
        return [f"{season}: value must be {{reason, trigger, tagline, articles}}"], []
    errs = [f"{season}: needs a {k}" for k in ("reason", "trigger", "tagline") if not value.get(k)]
    if not re.fullmatch(r"Y\d+", season):
        errs.append(f"target {season!r} must be a season like Y82")
    if EM_DASH in (value.get("tagline") or ""):
        errs.append(f"{season}: em dash in the tagline")
    if FORBIDDEN.search(value.get("tagline") or ""):
        errs.append(f"{season}: the tagline mentions the owner or uses the second person")
    arts = value.get("articles") or []
    if not arts:
        errs.append(f"{season}: no articles")
    if sum(1 for a in arts if a.get("kind") == "lead") != 1:
        errs.append(f"{season}: needs exactly one lead article")
    if sum(1 for a in arts if a.get("kind") == "quickhits") > 1:
        errs.append(f"{season}: at most one quick hits block")
    ids = [a.get("id") for a in arts]
    if len(set(ids)) != len(ids):
        errs.append(f"{season}: article ids repeat")
    others = {a["id"] for y, s in d.stories.items() if y != season for a in s.get("articles", [])}
    errs += [f"{season}: article id {i!r} is already used in another season" for i in ids if i in others]
    stale: list[str] = []
    dyk = value.get("didYouKnow") or []
    if not isinstance(dyk, list):
        errs.append(f"{season}: didYouKnow must be a list")
        dyk = []
    dyk_ids = [x.get("id") for x in dyk]
    if len(set(dyk_ids)) != len(dyk_ids) or set(dyk_ids) & set(ids):
        errs.append(f"{season}: didYouKnow ids repeat or clash with article ids")
    for x in dyk:
        text = x.get("text") or ""
        if not x.get("id") or not text:
            errs.append(f"{season}: didYouKnow item needs an id and text: {x}")
            continue
        if words(text) > QUICK_HIT_MAX_WORDS:
            errs.append(f"{season} {x['id']}: did-you-know is {words(text)} words (max {QUICK_HIT_MAX_WORDS})")
        # checked as a one-line article: tags, numbers, quotes, em dashes, stats against their sources
        e, st = check_article(d, {"id": x["id"], "kind": "quickhits", "headline": "Fact", "dek": "-",
                                  "body": [text] * QUICK_HITS[0], "players": x.get("players", []), "teams": x.get("teams", []),
                                  "stats": x.get("stats", []), "related": []}, set())
        errs += [f"{season} {m}" for m in dict.fromkeys(e)]
        stale += [f"{season} {m}" for m in st]
    known = set(others)
    for a in arts:
        e, s = check_article(d, a, known)
        errs += [f"{season} {x}" for x in e]
        stale += [f"{season} {x}" for x in s]
        known.add(a.get("id"))
    return errs, stale


def check_takes(d: Data, season: str, value) -> tuple[list[str], list[str]]:
    """Hot takes for one season (takes.set): {reason, trigger, intro?, takes[]}; each take is
    {id, headline, dek, body[], heat 1-3, players[], teams[], stats[]} and passes the article rules (numbers cited and
    matching their sources, tags exist, no em dashes, quotes only nicknames, no owner or second person), body 60-180
    words. Ids look like y90-take-<slug>, are unique across every season's takes and never reuse a story or
    did-you-know id. The intro (optional) carries no figures."""
    if not isinstance(value, dict):
        return [f"{season}: value must be {{reason, trigger, intro?, takes}}"], []
    errs = [f"{season}: needs a {k}" for k in ("reason", "trigger") if not value.get(k)]
    if not re.fullmatch(r"Y\d+", season):
        errs.append(f"target {season!r} must be a season like Y90")
    intro = value.get("intro")
    if intro is not None:
        if not isinstance(intro, str) or not intro.strip():
            errs.append(f"{season}: intro must be text")
        else:
            if EM_DASH in intro:
                errs.append(f"{season}: em dash in the intro")
            if FORBIDDEN.search(intro):
                errs.append(f"{season}: the intro mentions the owner or uses the second person")
            if numbers_in(intro):
                errs.append(f"{season}: the intro has figures ({', '.join(numbers_in(intro))}); put them in a take with its stats[]")
            if words(intro) > 60:
                errs.append(f"{season}: the intro is {words(intro)} words (max 60)")
            for q in QUOTE.findall(intro):
                if q.strip().lower().rstrip(".,") not in d.nicks:
                    errs.append(f"{season}: quoted text {q[:50]!r} in the intro is not a nickname")
    takes = value.get("takes")
    if not isinstance(takes, list) or not takes:
        return errs + [f"{season}: no takes"], []
    if not TAKE_COUNT[0] <= len(takes) <= TAKE_COUNT[1]:
        errs.append(f"{season}: {len(takes)} takes ({TAKE_COUNT[0]}-{TAKE_COUNT[1]})")
    ids = [t.get("id") for t in takes if isinstance(t, dict)]
    if len(set(ids)) != len(ids):
        errs.append(f"{season}: take ids repeat")
    prefix = f"{season.lower()}-take-"
    other_takes = {t.get("id") for y, s in d.takes.items() if y != season for t in s.get("takes", [])}
    story_ids = {a.get("id") for s in d.stories.values() for a in [*s.get("articles", []), *s.get("didYouKnow", [])]}
    stale: list[str] = []
    for t in takes:
        if not isinstance(t, dict):
            errs.append(f"{season}: a take must be an object")
            continue
        tid = t.get("id") or "?"
        if not str(tid).startswith(prefix) or len(str(tid)) <= len(prefix):
            errs.append(f"{season} {tid}: take ids look like {prefix}<slug>")
        if tid in other_takes:
            errs.append(f"{season} {tid}: the id is already a take in another season")
        if tid in story_ids:
            errs.append(f"{season} {tid}: the id is already a Season Story article or did-you-know")
        if t.get("heat") not in HEAT or isinstance(t.get("heat"), bool):
            errs.append(f"{season} {tid}: heat must be 1, 2 or 3 (has {t.get('heat')!r})")
        if words(str(t.get("headline") or "")) > TAKE_HEADLINE_MAX_WORDS:
            errs.append(f"{season} {tid}: the headline is the take in one punchy line (max {TAKE_HEADLINE_MAX_WORDS} words)")
        extra = set(t) - {"id", "headline", "dek", "body", "heat", "players", "teams", "stats"}
        if extra:
            errs.append(f"{season} {tid}: unknown fields {', '.join(sorted(extra))}")
        if not t.get("stats"):
            errs.append(f"{season} {tid}: a take needs at least one figure in stats[] (its first is the card's big number)")
        e, st = check_article(d, {"id": tid, "kind": "feature", "headline": t.get("headline"), "dek": t.get("dek"),
                                  "body": t.get("body"), "players": t.get("players", []), "teams": t.get("teams", []),
                                  "stats": t.get("stats", []), "related": []}, set(), bounds=TAKE_BOUNDS)
        errs += [f"{season} {x}" for x in e]
        stale += [f"{season} {x}" for x in st]
    return errs, stale


def audit() -> dict:
    d = Data()
    errors, warnings = [], []
    for season, story in sorted(d.stories.items()):
        e, s = check_season(d, season, story)
        errors += e
        warnings += [f"Story {x} (stale after a later update? correct it with a new story.set)" for x in s]
    return {"errors": errors, "warnings": warnings, "seasons": sorted(d.stories)}


def audit_takes() -> dict:
    d = Data()
    errors, warnings = [], []
    for season, value in sorted(d.takes.items()):
        e, s = check_takes(d, season, value)
        errors += e
        warnings += [f"Hot take {x} (stale after a later update? correct it with a new takes.set)" for x in s]
    return {"errors": errors, "warnings": warnings, "seasons": sorted(d.takes)}


if __name__ == "__main__":
    if "--audit-takes" in sys.argv:
        print(json.dumps(audit_takes()))
    elif "--audit" in sys.argv:
        print(json.dumps(audit()))
    else:
        sys.exit(__doc__)
