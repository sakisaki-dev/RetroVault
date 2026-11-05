"""Market history reader: full snapshots from data/y80/market_history.json or public/data/market.json.

Both files store changes only (format 2, written by scripts/market_snapshot.ts through src/utils/marketHistory.ts,
which documents the layout): the first, the latest and every Nth snapshot in full (`players`), every other one as a
`delta` on the snapshot before it (`set` changed fields, `unset` dropped fields, `removed` players, `at` / `order`
for the player order). load() walks them back into the full snapshots the old file stored, oldest first, with the
same player order and field order; a plain list (the old layout) is returned as is. Every Python reader goes
through here (build_league_data, build_league_content, build_widget_data, story_check, update).
"""
from __future__ import annotations

import json
from pathlib import Path

FIELD_ORDER = ["ovr", "skill", "legacy", "value", "grade", "s"]


def _ordered(p: dict) -> dict:
    out = {f: p[f] for f in FIELD_ORDER if f in p}
    out.update({f: v for f, v in p.items() if f not in out})
    return out


def expand(raw) -> list[dict]:
    """Full snapshots from the parsed file (either layout)."""
    if isinstance(raw, list):
        return raw
    if not isinstance(raw, dict) or not isinstance(raw.get("snapshots"), list):
        return []
    out: list[dict] = []
    prev: dict | None = None
    for s in raw["snapshots"]:
        if not isinstance(s, dict):
            continue
        meta = {k: v for k, v in s.items() if k not in ("players", "delta")}
        if isinstance(s.get("players"), dict):
            full = s["players"]
        elif isinstance(s.get("delta"), dict) and prev is not None:
            d = s["delta"]
            removed = set(d.get("removed") or [])
            sets = d.get("set") or {}
            unset = d.get("unset") or {}
            at = d.get("at") or {}
            if d.get("order") is not None:
                order = list(d["order"])
            else:
                order = [k for k in prev if k not in removed]
                known = set(order)
                for k, i in sorted(((k, i) for k, i in at.items() if k not in known), key=lambda x: x[1]):
                    order.insert(i, k)
                order += [k for k in sets if k not in known and k not in at]
            full = {}
            for k in order:
                p = {**prev.get(k, {}), **sets.get(k, {})}
                for f in unset.get(k, []):
                    p.pop(f, None)
                full[k] = _ordered(p)
        else:
            continue
        out.append({**meta, "players": full})
        prev = full
    return out


def load(path: Path) -> list[dict]:
    """Full snapshots, oldest first; [] when the file is missing."""
    return expand(json.loads(Path(path).read_text())) if Path(path).exists() else []
