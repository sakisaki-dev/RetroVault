"""Owner-confirmed facts (data/y80/owner_facts.json), read by every build script.

Scripts hold code; facts live in data. This module only reads the file and exposes the views the build scripts
used to hard-code (TEAM_FIXES, TEAM_HISTORY, RETIRED_WITH, ACTIVE_ROSTERS, CARD_NOTES, STATUS_FIXES, tags, career
facts). The file itself is written by scripts/apply_upload.py from an upload manifest.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH = ROOT / "data" / "y80" / "owner_facts.json"


def load() -> dict:
    return json.loads(PATH.read_text()) if PATH.exists() else {"players": {}}


FACTS = load()
PLAYERS: dict[str, dict] = FACTS.get("players", {})
CURRENT_CLUB: str = FACTS.get("current_club", "")


def _field(key: str) -> dict:
    return {n: f[key] for n, f in sorted(PLAYERS.items()) if f.get(key) is not None}


TEAM_FIXES: dict[str, str] = _field("team")
TEAM_HISTORY: dict[str, list[str]] = _field("team_history")
RETIRED_WITH: dict[str, str] = _field("retired_with")
STATUS_FIXES: dict[str, str] = _field("status")
CARD_NOTES: dict[str, dict] = _field("card")
TAGS: dict[str, str] = _field("tag")
CAREER: dict[str, dict] = _field("career")
REAL_NFL: dict[str, dict] = _field("real_nfl")
ACTIVE_ROSTERS: dict[str, str] = {n: t for t, names in sorted(FACTS.get("active_rosters", {}).items()) for n in names}
# {year: {name: team}}
SEASON_ROSTERS: dict[int, dict[str, str]] = {
    int(y): {n: t for t, names in sorted(teams.items()) for n in names}
    for y, teams in sorted(FACTS.get("season_rosters", {}).items(), key=lambda kv: int(kv[0]))
}
