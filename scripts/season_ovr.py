#!/usr/bin/env python3
"""Season OVR: a player's rating for ONE season (owner, 2026-11-23: "have that apply across the board ... until they
retire, when the whole career is evaluated"). A rule over the data, no AI.

A season line is the change in a player's career totals between two consecutive season-end market snapshots (the `s`
totals career_seasons.py reads), awards counted only when won that season. The season in progress (save_state.json,
when its season is after the latest completed one) is the save's own `season` stats with no awards yet. A player whose
games did not rise, or rose by more than a season holds (SEASON_MAX_GAMES: several seasons added at once), has no line.

League Score is the career formula (data/y80/formula/ovr.py `score`) on the line; ROTY and fumbles are not in the
snapshots' totals, so a season line leaves them out. Small samples are shrunk toward the position's mean line:
`adj = mean + (score - mean) * min(1, games / SHRINK_GAMES)`. The rating is the career curve on the adj score, ranked
within position among the players who played that season: OVR = round(62 + 37 * pct ** 0.85).

Never touches the stored `ovr` in market_history.json (the card market and the stories cite it, and stay on the
career rating). Writes public/data/league/season_ovr.json (the current season's rating for everyone who played it);
career_seasons.py adds each recorded season's rating to its rows (`sovr`).

Retirees (owner undecided, 2026-11-23) keep their career OVR: the one switch is `retiredRating` in src/config/ovr.ts.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import market_history  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
OUT = ROOT / "public" / "data" / "league" / "season_ovr.json"

SHRINK_GAMES = 17
SEASON_MAX_GAMES = 21

DEF = ("LB", "DB", "DL")


def _g(p, k):
    return p.get(k) or 0


def score(pos: str, p: dict) -> int:
    """League Score on a line in players.json keys (the same weights as ovr.py / src/config/ovr.ts, no ROTY or fumbles)."""
    a = 40 * _g(p, "rings") + 90 * _g(p, "mvp") + 45 * _g(p, "opoy") + 90 * _g(p, "dpoy") + 40 * _g(p, "sbmvp")
    if pos == "QB":
        pr = _g(p, "yds") / 80 + 0.9 * _g(p, "td") + 0.9 * _g(p, "rtd") - 0.6 * _g(p, "int")
    elif pos == "RB":
        pr = _g(p, "ryds") / 18 + 2.2 * _g(p, "rtd") + _g(p, "recyds") / 30 + 2.2 * _g(p, "rectd")
    elif pos in ("WR", "TE"):
        pr = _g(p, "yds") / (14 if pos == "WR" else 8) + (2.5 if pos == "WR" else 3) * _g(p, "td")
    elif pos == "OL":
        pr = 5 * _g(p, "blk") + 2 * _g(p, "g")
    else:
        pr = 0.7 * _g(p, "tkl") + 12 * _g(p, "int") + 14 * _g(p, "sck") + 14 * _g(p, "ff")
    return round(pr + a)


def rate(lines: dict[str, dict]) -> dict[str, int]:
    """{key: season OVR} for {key: line}; each line has `g` and the players.json totals."""
    by_pos = defaultdict(list)
    for k in sorted(lines):
        by_pos[k.split(":")[0]].append(k)
    out = {}
    for pos, keys in by_pos.items():
        raw = {k: score(pos, lines[k]) for k in keys}
        mean = sum(raw.values()) / len(keys)
        adj = {k: mean + (raw[k] - mean) * min(1.0, lines[k]["g"] / SHRINK_GAMES) for k in keys}
        order = sorted(keys, key=lambda k: adj[k])
        n = len(order)
        for i, k in enumerate(order):
            pct = i / (n - 1) if n > 1 else 1
            out[k] = round(62 + 37 * pct ** 0.85)
    return out


def season_num(label) -> int:
    m = re.match(r"Y?(\d+)", str(label or ""))
    return int(m.group(1)) if m else 0


def season_ends() -> dict[int, dict]:
    snaps = market_history.load(SRC / "market_history.json")
    snaps = snaps["snapshots"] if isinstance(snaps, dict) else snaps
    ends: dict[int, dict] = {}
    for s in snaps:
        y = season_num(s.get("season"))
        if y:
            ends[y] = s  # the last snapshot of a season wins
    return ends


def diff_line(pos: str, cur: dict, base: dict | None) -> dict | None:
    b = base or {}
    g = (cur.get("g") or 0) - (b.get("g") or 0)
    if g <= 0 or g > SEASON_MAX_GAMES:
        return None
    line = {"g": g}
    for k, v in cur.items():
        if k != "g":
            line[k] = max(0, v - (b.get(k) or 0))
    return line


def history_ratings() -> dict[int, dict[str, int]]:
    """{season: {key: season OVR}} for every season with a season-end snapshot before it (the first has no line)."""
    ends = season_ends()
    out = {}
    years = sorted(ends)
    for prev, y in zip(years, years[1:]):
        lines = {}
        for k, p in ends[y]["players"].items():
            line = diff_line(k.split(":")[0], p.get("s") or {}, (ends[prev]["players"].get(k) or {}).get("s"))
            if line:
                lines[k] = line
        out[y] = rate(lines)
    return out


def live_ratings() -> tuple[int, dict[str, int]] | None:
    """(season, {key: OVR}) from the save's season so far, when that season is after the latest completed one."""
    path = SRC / "save_state.json"
    if not path.exists():
        return None
    save = json.loads(path.read_text())
    done = max(s["year"] for s in json.loads((SRC / "coach.json").read_text())["seasons"])
    if not save.get("season") or int(save["season"]) <= done:
        return None
    lines = {}
    for k, st in save.get("players", {}).items():
        sv = dict(st.get("season") or {})
        if (sv.get("g") or 0) > 0:
            lines[k] = sv
    return (int(save["season"]), rate(lines)) if lines else None


# players.json key -> Player field (src/types/player.ts), by position group: the season lines the Deep Dive grades
FIELD_MAP = {
    "QB": {"g": "games", "att": "attempts", "cmp": "completions", "yds": "passYds", "td": "passTD", "int": "interceptions",
           "sck": "sacks", "ratt": "rushAtt", "ryds": "rushYds", "rtd": "rushTD"},
    "RB": {"g": "games", "ratt": "rushAtt", "ryds": "rushYds", "rtd": "rushTD", "fum": "fumbles", "rec": "receptions",
           "recyds": "recYds", "rectd": "recTD"},
    "REC": {"g": "games", "rec": "receptions", "yds": "recYds", "td": "recTD", "fum": "fumbles", "lng": "longest"},
    "OL": {"g": "games", "blk": "blocks"},
    "DEF": {"g": "games", "tkl": "tackles", "int": "interceptions", "sck": "sacks", "ff": "forcedFumbles"},
}


def _group(pos: str) -> str:
    return "REC" if pos in ("WR", "TE") else "DEF" if pos in DEF else pos


def lines_for_skills() -> tuple[str, dict[str, dict]]:
    """The current season's stat lines in Player fields, for the Deep Dive's "This season" skill grades. The save's own
    season stats when its season is the latest completed one or later (full: attempts, completions, fumbles...), else
    the change between the last two season-end snapshots (only the totals a snapshot keeps)."""
    done = max(s["year"] for s in json.loads((SRC / "coach.json").read_text())["seasons"])
    path = SRC / "save_state.json"
    out: dict[str, dict] = {}
    if path.exists():
        save = json.loads(path.read_text())
        if save.get("season") and int(save["season"]) >= done:
            for k, st in save.get("players", {}).items():
                sv = st.get("season") or {}
                if (sv.get("g") or 0) > 0:
                    m = FIELD_MAP[_group(k.split(":")[0])]
                    out[k] = {m[f]: v for f, v in sv.items() if f in m}
            return "save", dict(sorted(out.items()))
    ends = season_ends()
    years = sorted(ends)
    if len(years) >= 2:
        prev, y = years[-2], years[-1]
        for k, p in ends[y]["players"].items():
            pos = k.split(":")[0]
            line = diff_line(pos, p.get("s") or {}, (ends[prev]["players"].get(k) or {}).get("s"))
            if not line:
                continue
            m = FIELD_MAP[_group(pos)]
            fields = {}
            for f, v in line.items():
                if f == "yds" and pos == "QB":
                    fields["passYds"] = v
                elif f in m:
                    fields[m[f]] = v
            out[k] = fields
    return "history", dict(sorted(out.items()))


# CSV columns (scripts/build_league_data.py CSV_SECTIONS order) -> the `s` keys a market snapshot keeps (cardMarket.ts
# milestoneStats), so the latest completed season is rated from the CSV before this rebuild's snapshot exists
CSV_COLS = {
    "QB": ["att", "cmp", "yds", "td", "int", "sck", "ratt", "ryds", "rtd"],
    "RB": ["ratt", "ryds", "rtd", "fum", "rec", "recyds", "rectd"],
    "WR": ["rec", "yds", "td", "fum", "lng"], "TE": ["rec", "yds", "td", "fum", "lng"],
    "OL": ["blk"], "LB": ["tkl", "int", "sck", "ff"], "DB": ["tkl", "int", "sck", "ff"], "DL": ["tkl", "int", "sck", "ff"],
}
S_KEYS = {"QB": ["yds", "td", "int", "ryds", "rtd"], "RB": ["ryds", "rtd", "rec", "recyds", "rectd"],
          "WR": ["rec", "yds", "td"], "TE": ["rec", "yds", "td"], "OL": ["blk"],
          "LB": ["tkl", "int", "sck", "ff"], "DB": ["tkl", "int", "sck", "ff"], "DL": ["tkl", "int", "sck", "ff"]}


def csv_totals() -> dict[str, dict]:
    """{POS:Name: `s`-style career totals (rounded, nonzero only)} from public/data/initial-data.csv, plus status."""
    import csv
    out, pos = {}, None
    for row in csv.reader((ROOT / "public" / "data" / "initial-data.csv").open()):
        if len(row) == 1 and row[0] in CSV_COLS:
            pos = row[0]
            continue
        if not pos or not row or row[0] in ("Name", "") or len(row) < 10:
            continue
        cols = CSV_COLS[pos]
        vals = {k: v for k, v in zip(cols, row[4:4 + len(cols)])}
        n = lambda v: int(round(float(v))) if v not in ("", None) else 0
        i = 4 + len(cols)
        s = {"g": n(row[3])}
        s.update({k: n(vals[k]) for k in S_KEYS[pos]})
        s.update({"rings": n(row[i]), "mvp": n(row[i + 1]), "sbmvp": n(row[i + 3]),
                  ("dpoy" if pos in DEF else "opoy"): n(row[i + 2])})
        out[f"{pos}:{row[0]}"] = {"s": {k: v for k, v in s.items() if v}, "status": row[1]}
    return out


def completed_ratings() -> tuple[int, dict[str, int]]:
    """The latest completed season rated from the CSV against the last season-end snapshot before it."""
    done = max(s["year"] for s in json.loads((SRC / "coach.json").read_text())["seasons"])
    base = None
    for y, snap in sorted(season_ends().items()):
        if y < done:
            base = snap
    if base is None:
        return done, {}
    lines = {}
    for k, v in csv_totals().items():
        line = diff_line(k.split(":")[0], v["s"], (base["players"].get(k) or {}).get("s"))
        if line:
            lines[k] = line
    return done, rate(lines)


def current() -> tuple[int, bool, dict[str, int]]:
    live = live_ratings()
    if live:
        return live[0], True, live[1]
    y, r = completed_ratings()
    return y, False, r


def main() -> None:
    season, live, ovr = current()
    source, lines = lines_for_skills()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"season": season, "live": live, "shrinkGames": SHRINK_GAMES, "ovr": dict(sorted(ovr.items())),
                               "linesFrom": source, "lines": lines},
                              ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"season_ovr: Y{season}{' (live)' if live else ''}, {len(ovr)} players rated")


if __name__ == "__main__":
    main()
