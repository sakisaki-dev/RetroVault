#!/usr/bin/env python3
"""Export the live state read from the game's save (data/y80/save_state.json, written only by a save.state upload
mutation) to public/data/league/save_state.json for the site. Run by npm run rebuild; deterministic.

The public file is the data file minus its _about note, written compactly: {id, upload, season, week, club, settings,
clubs, coachGames, players (Retro Vault key -> live fields and the season so far), newPlayers (playing in the save,
not yet in Retro Vault), leagueGames}. It also writes public/data/league/live_season.json: the season in progress in
schedule.json's shape, built from leagueGames by schedule_content.season_content (the same rules). With no save state
yet, neither is written.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80" / "save_state.json"
OUT = ROOT / "public" / "data" / "league" / "save_state.json"
LIVE = ROOT / "public" / "data" / "league" / "live_season.json"


def live_season(state: dict) -> dict | None:
    """The season in progress in schedule.json's shape, built by scripts/schedule_content.py's own season_content from
    the save's league games played so far (leagueGames): the 32-club table with points, differential, SOS, power score,
    form and splits, the league by the numbers, the notable games and the coach's game log. Divisions are ranked by
    record as they stand (pct, then wins, then fewest losses)."""
    games = [g for g in state.get("leagueGames") or [] if "hs" in g and "as" in g]
    clubs = state.get("clubs") or {}
    if not games or state.get("club") not in clubs:
        return None
    import schedule_content as sc  # same rules and formulas as the weekly scores
    abbr = {name: c["abbr"] for name, c in clubs.items()}
    weeks = {}
    for g in games:
        weeks.setdefault(g["week"], []).append({"away": abbr[g["away"]], "home": abbr[g["home"]],
                                                "away_score": g["as"], "home_score": g["hs"]})
    standings = {}
    for name, c in clubs.items():
        t = sc.TEAMS.get(name, {})
        if t.get("conference") and t.get("division"):
            standings.setdefault(f'{t["conference"]} {t["division"]}', []).append((name, c))
    order = lambda nc: (-sc.pct(nc[1]["w"], nc[1]["l"], nc[1]["t"]), -nc[1]["w"], nc[1]["l"], nc[0])
    season = f'Y{state["season"]}'
    src = {"team": state["club"], "abbr": abbr[state["club"]],
           "weeks": [{"week": w, "games": weeks[w]} for w in sorted(weeks)],
           "standings": {d: [{"team": n} for n, _ in sorted(rows, key=order)] for d, rows in sorted(standings.items())}}
    return sc.season_content(season, src)


def public(state: dict) -> dict:
    return {k: v for k, v in state.items() if not k.startswith("_")}


def main():
    if not SRC.exists():
        for f in (OUT, LIVE):
            if f.exists():
                f.unlink()
        return
    out = public(json.loads(SRC.read_text()))
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n"
    if not OUT.exists() or OUT.read_text() != text:
        OUT.write_text(text)
    live = live_season(out)
    if live is None:
        if LIVE.exists():
            LIVE.unlink()
    else:
        text = json.dumps(live, ensure_ascii=False, separators=(",", ":")) + "\n"
        if not LIVE.exists() or LIVE.read_text() != text:
            LIVE.write_text(text)
    print(f"save_state.json: {out['id']}, {len(out.get('players', {}))} players, {len(out.get('newPlayers', {}))} new")


if __name__ == "__main__":
    main()
