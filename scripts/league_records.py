"""The record board twice: the coach's club records (data/y80/records.json, the in-game board, which only counts games
played for the coach's club) beside the same records across the whole league, worked out from the data.

Career marks come from every player's career card (players.json). Season marks come from each player's season, the
change in his career totals between two consecutive end-of-season market snapshots (market_history.json), so they
start in the first season with a snapshot before it and only cover the players tracked at the time; a change over
more than one season (10-21 games is one season) is skipped. Single games, long plays, kicking and returns are not in
the data, so those league marks stay empty. Real NFL legends (the games' imports) are left out.

Writes public/data/league/records.json. Deterministic: the same data gives the same file.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import market_history

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
OUT = ROOT / "public" / "data" / "league" / "records.json"

DEF = ("DL", "LB", "DB")
REC = ("WR", "TE", "RB")


def rec_yds(pos: str, s: dict) -> float:
    return (s.get("recyds") if pos == "RB" else s.get("yds")) or 0


def rec_td(pos: str, s: dict) -> float:
    return (s.get("rectd") if pos == "RB" else s.get("td")) or 0


# record name -> (scope, positions, value(pos, stats), unit)
RULES = {
    "Best passing career": ("career", ("QB",), lambda p, s: s.get("yds") or 0, "yds"),
    "Most TD passes, career": ("career", ("QB",), lambda p, s: s.get("td") or 0, ""),
    "Best receiving career": ("career", REC, rec_yds, "yds"),
    "Most TD receptions, career": ("career", REC, rec_td, ""),
    "Best rushing career": ("career", ("RB", "QB"), lambda p, s: s.get("ryds") or 0, "yds"),
    "Most rushing TDs, career": ("career", ("RB", "QB"), lambda p, s: s.get("rtd") or 0, ""),
    "Most tackles, career": ("career", DEF, lambda p, s: s.get("tkl") or 0, ""),
    "Most sacks, career": ("career", DEF, lambda p, s: s.get("sck") or 0, ""),
    "Most interceptions, career": ("career", DEF, lambda p, s: s.get("int") or 0, ""),
    "Most forced fumbles, career": ("career", DEF, lambda p, s: s.get("ff") or 0, ""),
    "Best passing season": ("season", ("QB",), lambda p, s: s.get("yds") or 0, "yds"),
    "Most TD passes, season": ("season", ("QB",), lambda p, s: s.get("td") or 0, ""),
    "Best receiving season": ("season", REC, rec_yds, "yds"),
    "Most TD receptions, season": ("season", REC, rec_td, ""),
    "Best rushing season": ("season", ("RB", "QB"), lambda p, s: s.get("ryds") or 0, "yds"),
    "Most rushing TDs, season": ("season", ("RB", "QB"), lambda p, s: s.get("rtd") or 0, ""),
    "Most tackles, season": ("season", DEF, lambda p, s: s.get("tkl") or 0, ""),
    "Most sacks, season": ("season", DEF, lambda p, s: s.get("sck") or 0, ""),
    "Most interceptions, season": ("season", DEF, lambda p, s: s.get("int") or 0, ""),
    "Most forced fumbles, season": ("season", DEF, lambda p, s: s.get("ff") or 0, ""),
}
TOP = 3


def number(mark: str) -> float | None:
    m = re.search(r"[\d,]+(?:\.\d+)?", mark or "")
    return float(m.group(0).replace(",", "")) if m else None


def num(v: float):
    return int(v) if float(v).is_integer() else round(v, 1)


# A short label for the tiles: "Rush yds", "Pass TDs"...
SHORT = {"passing": "Pass yds", "TD passes": "Pass TDs", "receiving": "Rec yds", "TD receptions": "Rec TDs",
         "rushing": "Rush yds", "rushing TDs": "Rush TDs", "tackles": "Tackles", "sacks": "Sacks",
         "interceptions": "INTs", "forced fumbles": "Forced fumbles"}


def short_label(record: str) -> str:
    m = re.match(r"(?:Best|Most) (.+?)(?: career| season|, career|, season)$", record)
    return SHORT.get(m.group(1), m.group(1)) if m else record


def main() -> None:
    board = json.loads((SRC / "records.json").read_text())["records"]
    players = [p for p in json.loads((SRC / "players.json").read_text()) if not p.get("legend")]
    coach = {int(s["year"]): s["team"] for s in json.loads((SRC / "coach.json").read_text()).get("seasons", [])}
    stints = json.loads((SRC / "stints.json").read_text())
    extras = ROOT / "public" / "data" / "player-extras.json"
    signature = json.loads(extras.read_text()).get("signatureTeams", {}) if extras.exists() else {}

    def year_of(y) -> int | None:
        y = str(y).lstrip("Y")
        return int(y) if y.isdigit() else None

    def team_in(name: str, year: int | None) -> str | None:
        """His club that season (career stints), else the club he is best known for (his banner)."""
        if year is not None:
            for st in (stints.get(name) or {}).get("stints", []):
                if st["from"] <= year <= st["to"]:
                    return st["team"]
        return signature.get(name) or next((p.get("team") for p in players if p["n"] == name), None)

    def club_name(holder: str) -> str | None:
        """The full name behind the board's "POS F. Surname" (or "(now New Name)")."""
        now = re.search(r"\(now ([^)]+)\)", holder)
        if now:
            return now.group(1)
        m = re.match(r"([A-Z]{1,2}) ([A-Z])\. (.+)$", holder.split("→")[-1].strip())
        if not m:
            return None
        pos, ini, sur = m.groups()
        hits = [p["n"] for p in players if p["pos"] == pos and p["n"].endswith(" " + sur) and p["n"].startswith(ini)]
        return hits[0] if len(hits) == 1 else None
    snaps = market_history.load(SRC / "market_history.json")
    snaps = snaps["snapshots"] if isinstance(snaps, dict) else snaps

    # one season per player: the change between consecutive end-of-season snapshots
    end: dict[int, dict] = {}
    for s in snaps:
        end[int(str(s["season"]).lstrip("Y"))] = s["players"]  # the last snapshot of a season wins
    seasons = []
    for y in sorted(end):
        if y - 1 not in end:
            continue
        for key, p in end[y].items():
            q = end[y - 1].get(key)
            if not q:
                continue
            d = {f: (p.get("s", {}).get(f) or 0) - (q.get("s", {}).get(f) or 0) for f in p.get("s", {})}
            if 10 <= d.get("g", 0) <= 21:
                pos, _, name = key.partition(":")
                seasons.append((y, pos, name, d))
    first = min((y for y, *_ in seasons), default=None)
    last = max((y for y, *_ in seasons), default=None)

    out = []
    for r in board:
        club_mark = number(r["mark"])
        rule = RULES.get(r["record"])
        cy = year_of(r["year"])
        row = {"record": r["record"], "short": short_label(r["record"]),
               "club": {"mark": r["mark"], "value": club_mark, "holder": r["holder"], "year": r["year"],
                        **({"name": club_name(r["holder"])} if club_name(r["holder"]) else {}),
                        # the save's board detail (record.set from save_read.py): a game's week and opponent, the QB on
                        # a play, the exact mark
                        **{k: r[k] for k in ("week", "opponent", "qb", "exact") if r.get(k) is not None},
                        **({"team": coach[cy]} if cy in coach else {})},
               "scope": rule[0] if rule else ("game" if "game" in r["record"].lower() else "other"), "league": None}
        if rule:
            scope, poss, get, unit = rule
            if scope == "career":
                cands = [(get(p["pos"], p), p["n"], p["pos"], None) for p in players if p["pos"] in poss]
            else:
                cands = [(get(pos, d), name, pos, y) for y, pos, name, d in seasons if pos in poss]
            cands = [c for c in cands if c[0] > 0]
            if club_mark is not None:
                # the club's games are league games too: its record stands in the league list (the same season or career
                # seen in the data, e.g. Maxwell's Y87, is the club entry, so drop the data's copy within rounding)
                year = int(str(r["year"]).lstrip("Y")) if scope == "season" and str(r["year"]).lstrip("Y").isdigit() else None
                surname = r["holder"].split("→")[-1].split("(")[0].strip().split(" ")[-1]
                cands = [c for c in cands if not (c[1].split(" ")[-1] == surname and (scope == "career" or c[3] == year)
                                                  and abs(c[0] - club_mark) <= 1)]
                cands.append((club_mark, r["holder"], "club", year))
            cands = sorted(cands, key=lambda c: (-c[0], c[2] != "club", c[1], c[3] or 0))[:TOP]
            if cands:
                fmt = lambda v: f"{num(v):,}" + (f" {unit}" if unit else "")
                row["league"] = {
                    "value": num(cands[0][0]), "mark": fmt(cands[0][0]),
                    "top": [{"value": num(v), "mark": fmt(v), "player": n,
                             **({"club": True, **({"name": row["club"]["name"]} if row["club"].get("name") else {}),
                                 **({"team": row["club"]["team"]} if row["club"].get("team") else {})} if pos == "club"
                                else {"pos": pos, **({"team": t} if (t := team_in(n, y)) else {})}),
                             **({"season": f"Y{y}"} if y else {})} for v, n, pos, y in cands],
                    "basis": "career cards" if scope == "career" else f"seasons Y{first}-Y{last} (players tracked then)",
                    "clubHolds": cands[0][2] == "club",
                }
                row["broken"] = club_mark is not None and cands[0][0] > club_mark
        out.append(row)
    data = {"_about": "Generated by scripts/league_records.py: the coach's club record board beside the league-wide marks. "
                      "Do not edit.",
            "seasonsFrom": f"Y{first}" if first else None, "seasonsTo": f"Y{last}" if last else None, "records": out}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    broken = [r["record"] for r in out if r.get("broken")]
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} records, {sum(1 for r in out if r['league'])} with a league mark, "
          f"{len(broken)} beaten league-wide")


if __name__ == "__main__":
    main()
