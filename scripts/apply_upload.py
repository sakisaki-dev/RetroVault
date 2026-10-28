#!/usr/bin/env python3
"""Apply one upload bundle to the source data, then rebuild. The single way new information enters the system.

    npm run apply-upload -- data/uploads/2026-10-21-y81-week1            # validate, apply, log, npm run rebuild
    npm run apply-upload -- data/uploads/2026-10-21-y81-week1 --check    # validate only
    npm run apply-upload -- <dir> --no-rebuild                           # apply + log, skip the rebuild

A bundle is a folder data/uploads/<YYYY-MM-DD>-<slug>/ with
  manifest.json   the structured mutations (format below)
  notes.md        the uploader's free text, verbatim (optional)
  images/         copies of the screenshots (optional; a manifest may instead point at files elsewhere)

manifest.json
  id         unique id (the folder name); data/y80/mutations_log.json records applied ids, so a bundle applies once
  created    YYYY-MM-DD
  images     [{file, path?, shows?}] or groups [{group, path?, files: [...], shows?}]
  ai_steps   [{step, reason, trigger, ...}]: the AI work done to produce the mutations. Allowed steps only:
             transcribe | portrait→look | tag notes | speech | art | story
  mutations  [{lane, op, target, value, source, reason, trigger}]
             source: "owner" or "image:<file or group in images>" (the story lane also takes "data:<files read>")

Lanes and ops (deterministic; nothing is inferred here):
  stats  player.set     target "POS:Name"           value {players.json fields}; creates the player if new.
                                                    Career totals never go down (a drop is a misread) unless
                                                    value has "_allow_decrease": true
         fact.set       target "players/<name>/<field>" (or any path in owner_facts.json)  value: the new value
         fact.add       target path to a list        value: item(s) appended if missing
         fact.remove    target path                  value: list item to drop, or null to delete the key
         superbowl.set  target "Y80"                 value {number, roman, winner, score, loser, your_result, your_team}
         coach.season   target "80"                  value {team, abbr, w, l, t, finish}
         coach.set      target "<field>"             value: coach.json field (record, bests, age…; currentStint
                                                    {team, abbr, from} = a club switch before the new club plays)
         record.set     target "<record name>"       value {mark, holder, year}
         baseline       target "<data file>"         value {sha256}: marks the file state a history starts from
         extras.set     target "<section>/<key>"     value: the new entry in data/y80/screenshot_extras.json, or null to
                                                    delete it. <section> must be an existing section (season_lines,
                                                    player_cards, family, ...); the key can't be empty
  looks  sprite.set     target "<name>"              value {skin, hair, facial, accessories, build?, height?, pose?, notes?}
         sprite.image   target "<name>"              value {file: <path in the bundle>, as: <file name>} copied to
                                                    public/data/sprites/ and set as the look's image
         card.design    target "<name>"              value: the owner's card-design request (owner_facts card_design)
  notes  journal.add    target "<note id>"           value {text, kind, season?, players[], teams[], seasons[]}.
                                                    text must appear verbatim in notes.md: notes are never rewritten
  speech speech.set     target "<player name>"       value {reason, trigger, text}: writes (or rewrites) a Hall of Fame
                                                    induction speech in data/y80/speeches.json. Needs the 'speech' AI
                                                    step; the text must follow the CLAUDE.md speech rules (120-190
                                                    words, no em dashes, closing "..., welcome to the Hall of Fame.")
  story  story.set      target "Y82"                 value {reason, trigger, tagline, articles[], didYouKnow[]?}: writes (or rewrites)
                                                    the season's story in data/y80/stories.json. Needs the 'story'
                                                    AI step; scripts/story_check.py checks the CLAUDE.md story rules
                                                    (lengths, no em dashes, tags exist, every number cited in stats[]
                                                    and matching its source, quotes only from the owner's journal)
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
sys.path.insert(0, str(ROOT / "scripts"))
import story_check  # noqa: E402
LOG = SRC / "mutations_log.json"
FILES = {
    "players": SRC / "players.json",
    "facts": SRC / "owner_facts.json",
    "super_bowls": SRC / "super_bowls.json",
    "coach": SRC / "coach.json",
    "records": SRC / "records.json",
    "sprites": SRC / "sprites.json",
    "journal": SRC / "journal.json",
    "speeches": SRC / "speeches.json",
    "extras": SRC / "screenshot_extras.json",
    "stories": SRC / "stories.json",
}
SPRITE_IMAGES = ROOT / "public" / "data" / "sprites"
STORIES_ABOUT = ("Season Story: the third AI-authored lane (owner-approved). One news package per completed season, "
                 "written only by a story.set upload mutation; facts only from the data, every number cited in stats[] "
                 "with its source (scripts/story_check.py). Never hand-edit.")

AI_STEPS = {"transcribe", "portrait→look", "tag notes", "speech", "art", "story"}
LANE_OPS = {
    "stats": {"player.set", "fact.set", "fact.add", "fact.remove", "superbowl.set", "coach.season", "coach.set",
              "record.set", "baseline", "extras.set"},
    "looks": {"sprite.set", "sprite.image", "card.design"},
    "notes": {"journal.add"},
    "speech": {"speech.set"},
    "story": {"story.set"},
}
# AI step that must be logged when a lane's mutations come from images / owner prose
NEEDS_STEP = {("stats", "image"): "transcribe", ("looks", "image"): "portrait→look", ("notes", "owner"): "tag notes",
              ("speech", "owner"): "speech", ("speech", "image"): "speech",
              ("story", "data"): "story", ("story", "owner"): "story", ("story", "image"): "story"}
CAREER_KEYS = {"g", "att", "cmp", "yds", "td", "int", "sck", "ratt", "ryds", "rtd", "fum", "rec", "recyds", "rectd",
               "blk", "tkl", "ff", "rings", "mvp", "opoy", "dpoy", "roty", "sbmvp"}
FACT_ORDER = ["team", "team_history", "retired_with", "status", "tag", "card", "card_design", "career", "real_nfl"]


def dump(obj) -> str:
    return json.dumps(obj, indent=1, ensure_ascii=False) + "\n"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Bad(Exception):
    pass


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def image_names(manifest) -> set[str]:
    names = set()
    for im in manifest.get("images", []):
        if im.get("file"):
            names.add(im["file"])
        if im.get("group"):
            names.add(im["group"])
            names.update(im.get("files", []))
    return names


def validate(bundle: Path, manifest: dict) -> list[str]:
    errs = []
    if not manifest.get("id"):
        errs.append("manifest has no id")
    images = image_names(manifest)
    steps = manifest.get("ai_steps", [])
    for s in steps:
        if s.get("step") not in AI_STEPS:
            errs.append(f"ai_steps: {s.get('step')!r} is not an allowed AI step ({', '.join(sorted(AI_STEPS))})")
        if not s.get("reason") or not s.get("trigger"):
            errs.append(f"ai_steps: {s.get('step')} needs a reason and a trigger")
    done = {s.get("step") for s in steps}
    notes_md = (bundle / "notes.md").read_text() if (bundle / "notes.md").exists() else ""
    for i, m in enumerate(manifest.get("mutations", [])):
        where = f"mutation {i} ({m.get('op')} {m.get('target')})"
        for k in ("lane", "op", "target", "source", "reason", "trigger"):
            if not m.get(k):
                errs.append(f"{where}: missing {k}")
        if "value" not in m:
            errs.append(f"{where}: missing value")
        lane, op, src = m.get("lane"), m.get("op"), str(m.get("source", ""))
        if op not in LANE_OPS.get(lane, set()):
            errs.append(f"{where}: op {op!r} is not in lane {lane!r}")
        kind = "image" if src.startswith("image:") else "owner" if src == "owner" else \
            "data" if src.startswith("data:") and lane == "story" else None
        if kind is None:
            errs.append(f"{where}: source must be 'owner' or 'image:<file>'" + (" or 'data:<files>'" if lane == "story" else ""))
        elif kind == "image" and src[6:] not in images:
            errs.append(f"{where}: {src} is not listed in images")
        need = NEEDS_STEP.get((lane, kind))
        if need and need not in done and not (lane == "notes" and not (m.get("value") or {}).get("players") and not (m.get("value") or {}).get("teams")):
            errs.append(f"{where}: needs the {need!r} AI step logged in ai_steps")
        if op == "journal.add":
            text = (m.get("value") or {}).get("text", "")
            if not text or text.strip() not in notes_md:
                errs.append(f"{where}: note text must appear verbatim in notes.md")
        if op == "speech.set":
            errs += [f"{where}: {e}" for e in speech_errors(m.get("value"))]
        if op == "extras.set":
            errs += [f"{where}: {e}" for e in extras_errors(str(m.get("target", "")))]
        if op == "story.set":
            # at apply time a stats value that no longer matches its source is an error, not a stale warning
            story_errs, story_stale = story_check.check_season(story_check.Data(), str(m.get("target", "")), m.get("value"))
            errs += [f"{where}: {e}" for e in story_errs + story_stale]
    return errs


def extras_errors(target: str) -> list[str]:
    """extras.set edits one entry of an existing screenshot_extras.json section; it never adds a section."""
    section, _, key = target.partition("/")
    path = FILES["extras"]
    sections = json.loads(path.read_text()) if path.exists() else {}
    if not key.strip():
        return ['target must be "<section>/<key>"']
    if not isinstance(sections.get(section), dict):
        return [f"{section!r} is not a section of screenshot_extras.json ({', '.join(k for k, v in sections.items() if isinstance(v, dict))})"]
    return []


def speech_errors(value) -> list[str]:
    """The CLAUDE.md speech rules that can be checked mechanically."""
    if not isinstance(value, dict):
        return ["value must be {reason, trigger, text}"]
    errs = [f"speech needs a {k}" for k in ("reason", "trigger", "text") if not value.get(k)]
    text = value.get("text") or ""
    words = len(text.split())
    if text and not 120 <= words <= 190:
        errs.append(f"speech is {words} words (120-190)")
    if "\u2014" in text:
        errs.append("speech has an em dash")
    if text and not text.rstrip().endswith("welcome to the Hall of Fame."):
        errs.append('speech must close "..., welcome to the Hall of Fame."')
    return errs


# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------
def get_path(obj, parts, create=False):
    for p in parts:
        if p not in obj:
            if not create:
                return None
            obj[p] = {}
        obj = obj[p]
    return obj


def sort_facts(facts):
    players = facts.get("players", {})
    facts["players"] = {n: {k: players[n][k] for k in [*FACT_ORDER, *sorted(set(players[n]) - set(FACT_ORDER))] if k in players[n]}
                        for n in sorted(players)}
    for key in ("active_rosters",):
        if key in facts:
            facts[key] = {t: sorted(v) for t, v in sorted(facts[key].items())}


def apply(bundle: Path, manifest: dict) -> list[str]:
    data = {k: json.loads(p.read_text()) if p.exists() else None for k, p in FILES.items()}
    if data["journal"] is None:
        data["journal"] = {"notes": []}
    if data["stories"] is None:
        data["stories"] = {"_about": STORIES_ABOUT, "seasons": {}}
    changes = []
    for m in manifest["mutations"]:
        op, target, value = m["op"], m["target"], m["value"]
        if op == "baseline":
            continue
        if op == "player.set":
            pos, _, name = target.partition(":")
            rows = data["players"]
            row = next((r for r in rows if r["n"] == name and r["pos"] == pos), None)
            if row is None:
                row = {"n": name, "pos": pos, "team": "UNK"}
                rows.append(row)
                changes.append(f"new player {target}")
            for k, v in value.items():
                if k.startswith("_"):
                    continue
                old = row.get(k)
                if k in CAREER_KEYS and isinstance(old, (int, float)) and isinstance(v, (int, float)) and v < old \
                        and not value.get("_allow_decrease"):
                    raise Bad(f"{target}: {k} would drop {old} -> {v} (a misread? set _allow_decrease to force)")
                if old != v:
                    row[k] = v
                    changes.append(f"{target}.{k}: {old!r} -> {v!r}")
        elif op in ("fact.set", "fact.add", "fact.remove", "card.design"):
            facts = data["facts"]
            parts = ["players", target, "card_design"] if op == "card.design" else target.split("/")
            parent = get_path(facts, parts[:-1], create=True)
            key = parts[-1]
            if op in ("fact.set", "card.design"):
                if parent.get(key) != value:
                    parent[key] = value
                    changes.append(f"owner_facts {'/'.join(parts)}")
            elif op == "fact.add":
                lst = parent.setdefault(key, [])
                for item in value if isinstance(value, list) else [value]:
                    if item not in lst:
                        lst.append(item)
                        changes.append(f"owner_facts {'/'.join(parts)} += {item!r}")
            else:
                if value is None and key in parent:
                    del parent[key]
                    changes.append(f"owner_facts {'/'.join(parts)} removed")
                elif isinstance(parent.get(key), list) and value in parent[key]:
                    parent[key].remove(value)
                    changes.append(f"owner_facts {'/'.join(parts)} -= {value!r}")
            sort_facts(facts)
        elif op == "superbowl.set":
            sbs = data["super_bowls"]
            row = next((s for s in sbs if s["year"] == target), None)
            if row is None:
                row = {"year": target}
                sbs.append(row)
                sbs.sort(key=lambda s: int(s["year"].lstrip("Y")))
            for k, v in value.items():
                if k not in row or row[k] != v:  # a new key set to null (your_team) still lands
                    row[k] = v
                    changes.append(f"Super Bowl {target}.{k} = {v!r}")
        elif op == "coach.season":
            seasons = data["coach"]["seasons"]
            row = next((s for s in seasons if s["year"] == int(target)), None)
            if row is None:
                row = {"year": int(target)}
                seasons.append(row)
                seasons.sort(key=lambda s: s["year"])
            for k, v in value.items():
                if k not in row or row[k] != v:
                    row[k] = v
                    changes.append(f"coach Y{target}.{k} = {v!r}")
        elif op == "coach.set":
            if data["coach"].get(target) != value:
                data["coach"][target] = value
                changes.append(f"coach.{target}")
        elif op == "record.set":
            recs = data["records"]["records"]
            row = next((r for r in recs if r["record"] == target), None)
            if row is None:
                row = {"record": target}
                recs.append(row)
            for k, v in value.items():
                if k not in row or row[k] != v:
                    row[k] = v
                    changes.append(f"record {target}.{k} = {v!r}")
        elif op == "sprite.set":
            looks = data["sprites"].setdefault("players", {})
            if looks.get(target) != value:
                looks[target] = value
                changes.append(f"sprite {target}")
        elif op == "sprite.image":
            src = bundle / value["file"]
            if not src.exists():
                raise Bad(f"sprite.image {target}: {src} not found")
            SPRITE_IMAGES.mkdir(parents=True, exist_ok=True)
            dest = SPRITE_IMAGES / value["as"]
            if not dest.exists() or sha256(dest) != sha256(src):
                shutil.copyfile(src, dest)
                changes.append(f"sprite image {dest.relative_to(ROOT)}")
            look = data["sprites"].setdefault("players", {}).setdefault(target, {})
            if look.get("image") != value["as"]:
                look["image"] = value["as"]
                changes.append(f"sprite {target}.image")
        elif op == "speech.set":
            speeches = data["speeches"].setdefault("speeches", {})
            rec = {"reason": value["reason"], "trigger": value["trigger"], "text": value["text"]}
            if speeches.get(target) != rec:
                speeches[target] = rec
                data["speeches"]["speeches"] = dict(sorted(speeches.items()))
                changes.append(f"speech {target}")
        elif op == "story.set":
            seasons = data["stories"].setdefault("seasons", {})
            rec = {"reason": value["reason"], "trigger": value["trigger"], "upload": manifest["id"],
                   "tagline": value["tagline"], "articles": value["articles"]}
            if value.get("didYouKnow"):
                rec["didYouKnow"] = value["didYouKnow"]
            if seasons.get(target) != rec:
                seasons[target] = rec
                data["stories"]["seasons"] = dict(sorted(seasons.items(), key=lambda kv: int(kv[0].lstrip("Y"))))
                changes.append(f"story {target} ({len(value['articles'])} articles)")
        elif op == "extras.set":
            section, _, key = target.partition("/")
            entries = data["extras"][section]
            if value is None:
                if key in entries:
                    del entries[key]
                    changes.append(f"screenshot_extras {section}/{key} removed")
            elif entries.get(key) != value:
                entries[key] = value
                changes.append(f"screenshot_extras {section}/{key}")
        elif op == "journal.add":
            notes = data["journal"].setdefault("notes", [])
            if not any(n["id"] == target for n in notes):
                notes.append({"id": target, "upload": manifest["id"], **value})
                changes.append(f"journal note {target}")
    for k, p in FILES.items():
        if data[k] is None:
            continue
        # only files whose content changed are rewritten (unchanged files keep their exact bytes)
        if not p.exists() or json.loads(p.read_text()) != data[k]:
            p.write_text(dump(data[k]))
    return changes


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    bundle = Path(args[0]).resolve()
    manifest = json.loads((bundle / "manifest.json").read_text())
    errs = validate(bundle, manifest)
    if errs:
        print("\n".join(f"ERROR {e}" for e in errs))
        sys.exit(1)
    log = json.loads(LOG.read_text()) if LOG.exists() else {"applied": []}
    if "--check" in sys.argv:
        print(f"{manifest['id']}: {len(manifest['mutations'])} mutations OK"
              + (" (already applied)" if any(e["id"] == manifest["id"] for e in log["applied"]) else ""))
        return
    if any(e["id"] == manifest["id"] for e in log["applied"]):
        print(f"{manifest['id']} is already applied (data/y80/mutations_log.json); nothing to do.")
        return
    try:
        changes = apply(bundle, manifest)
    except Bad as e:
        sys.exit(f"ERROR {e} (nothing written)")
    lanes = {}
    for m in manifest["mutations"]:
        lanes[m["lane"]] = lanes.get(m["lane"], 0) + 1
    log["applied"].append({
        "id": manifest["id"],
        "dir": str(bundle.relative_to(ROOT)),
        "applied_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "mutations": lanes,
        "changed": len(changes),
    })
    LOG.write_text(dump(log))
    print(f"applied {manifest['id']}: {len(changes)} changes")
    for c in changes[:200]:
        print("  " + c)
    if "--no-rebuild" not in sys.argv:
        subprocess.run(["npm", "run", "-s", "rebuild"], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
