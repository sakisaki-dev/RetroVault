"""Every player's career at each season's end, for the Deep Dive's career graphs (src/utils/careerSeasons.ts).

A rule over the data, no AI. The source is the market history (data/y80/market_history.json, read through
market_history.load): the last snapshot of each season is that season's end. For every player in it the file keeps his
card numbers then (OVR, skill, Career Legacy, value, grade) and his career totals then (the snapshot's `s`, the
players.json keys the milestone headlines watch). The site's market.json drops `s`, so this is the only place the
season-end totals reach the site.

Single seasons are never stored: the site derives a season as the change in a player's totals between two consecutive
season ends (as scripts/league_records.py and scripts/hall_of_fame.py do), so the first recorded season has no season
line and a change of more than one season (an import correction) is flagged there, not here.

Writes public/data/league/career_seasons.json. Deterministic: the same data gives the same file.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import market_history
import season_ovr

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
OUT = ROOT / "public" / "data" / "league" / "career_seasons.json"

AWARDS = ["rings", "mvp", "sbmvp"]
# the career totals a snapshot keeps per position group (src/utils/cardMarket.ts milestoneStats), in a fixed order
FIELDS = {
    "QB": ["g", "yds", "td", "int", "ryds", "rtd", *AWARDS, "opoy"],
    "RB": ["g", "ryds", "rtd", "rec", "recyds", "rectd", *AWARDS, "opoy"],
    "WR": ["g", "rec", "yds", "td", *AWARDS, "opoy"],
    "TE": ["g", "rec", "yds", "td", *AWARDS, "opoy"],
    "OL": ["g", "blk", *AWARDS, "opoy"],
    "DEF": ["g", "tkl", "int", "sck", "ff", *AWARDS, "dpoy"],
}
GROUP = {"LB": "DEF", "DB": "DEF", "DL": "DEF"}


def season_num(label) -> int:
    m = re.match(r"Y(\d+)", str(label or ""))
    return int(m.group(1)) if m else 0


def build() -> dict:
    snaps = market_history.load(SRC / "market_history.json")
    snaps = snaps["snapshots"] if isinstance(snaps, dict) else snaps
    ends: dict[int, dict] = {}
    for s in snaps:
        y = season_num(s.get("season"))
        if y:
            ends[y] = s  # the last snapshot of a season wins
    seasons = sorted(ends)
    sovr = season_ovr.history_ratings()  # {season: {key: season OVR}}; the first season has no line
    keys = sorted({k for y in seasons for k in ends[y]["players"]})
    players: dict[str, dict] = {}
    for k in keys:
        pos = k.split(":")[0]
        fields = FIELDS.get(GROUP.get(pos, pos))
        if not fields:
            continue
        rows, first = [], None
        for y in seasons:
            p = ends[y]["players"].get(k)
            if p is None:
                if first is not None:
                    rows.append(None)  # missing from this season's snapshot (kept so rows stay one per season)
                continue
            if first is None:
                first = y
            s = p.get("s") or {}
            rows.append([p.get("ovr", 0), p.get("skill"), p.get("legacy", 0), p.get("value", 0), p.get("grade") or "",
                         *[int(s.get(f) or 0) for f in fields], sovr.get(y, {}).get(k)])
        while rows and rows[-1] is None:
            rows.pop()
        if first is not None:
            players[k] = {"from": first, "rows": rows}
    return {
        "_about": "Season-end career lines from the market history (scripts/career_seasons.py). Row = [ovr, skill, "
                  "legacy, value, grade, ...fields[group], sovr] at the end of each season from `from`; null = not in "
                  "that season's snapshot. sovr = his SEASON OVR that season (scripts/season_ovr.py; null = no line: first season or no games); ovr is the career card rating. A season's own line is the change between two consecutive rows.",
        "seasons": seasons,
        "snapshots": [ends[y]["id"] for y in seasons],
        "fields": FIELDS,
        "live": ({"season": live[0], "ovr": dict(sorted(live[1].items()))} if (live := season_ovr.live_ratings()) else None),
        "players": players,
    }


def main() -> None:
    import sys
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT  # an explicit path (a dry run) or the site's copy
    data = build()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"career_seasons: {len(data['players'])} players over Y{data['seasons'][0]}-Y{data['seasons'][-1]}"
          if data["seasons"] else "career_seasons: no season snapshots")


if __name__ == "__main__":
    main()
