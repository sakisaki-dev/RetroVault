#!/usr/bin/env python3
"""Export the live state read from the game's save (data/y80/save_state.json, written only by a save.state upload
mutation) to public/data/league/save_state.json for the site. Run by npm run rebuild; deterministic.

The public file is the data file minus its _about note, written compactly: {id, upload, season, week, club, settings,
clubs, coachGames, players (Retro Vault key -> live fields and the season so far), newPlayers (playing in the save,
not yet in Retro Vault)}. With no save state yet, nothing is written.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80" / "save_state.json"
OUT = ROOT / "public" / "data" / "league" / "save_state.json"


def public(state: dict) -> dict:
    return {k: v for k, v in state.items() if not k.startswith("_")}


def main():
    if not SRC.exists():
        if OUT.exists():
            OUT.unlink()
        return
    out = public(json.loads(SRC.read_text()))
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n"
    if not OUT.exists() or OUT.read_text() != text:
        OUT.write_text(text)
    print(f"save_state.json: {out['id']}, {len(out.get('players', {}))} players, {len(out.get('newPlayers', {}))} new")


if __name__ == "__main__":
    main()
