#!/usr/bin/env python3
"""One command for "update": apply an upload bundle and refresh everything generated from it, then stop.

    npm run update -- data/uploads/2026-10-21-y81-week1
    npm run update -- <bundle> --skip-build        # skip tsc / check:sprites / vite build (data steps only)

Steps (each stops the run on failure; nothing is committed or pushed):
  1. validate        apply-upload --check
  2. apply           apply-upload --no-rebuild (a bundle already in mutations_log.json is a no-op)
  3. rebuild         npm run rebuild: stints, league data, market snapshot, content (eras, storylines, HOF classes,
                     edition), audit
  4. rollover        if the bundle adds a season (coach.json / super_bowls.json), check both agree and list the
                     season-relative owner facts to review. Everything else derives the season from the data:
                     stints (infer_stints.py LAST), the CSV season tag, content.json season and edition, the market
                     snapshot season, Timeline / Teams / Front Office (coach.json, superBowls in content.json)
  5. checks          tsc --noEmit, check:sprites, vite build
  6. summary         players added / updated, players needing teams, records, new Hall of Famers and SPEECH NEEDED,
                     market movers, the "What changed" headlines (content.json), open questions, the new edition;
                     then the commit and push commands to run
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
CONTENT = ROOT / "public" / "data" / "league" / "content.json"
UPLOADS = ROOT / "data" / "uploads"


def read(path: Path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def state() -> dict:
    """The parts of the data the summary compares before and after."""
    players = {f'{p["pos"]}:{p["n"]}': p for p in read(SRC / "players.json", []) if not p.get("legend")}
    coach = read(SRC / "coach.json", {"seasons": []})
    sbs = read(SRC / "super_bowls.json", [])
    content = read(CONTENT, {})
    market = read(SRC / "market_history.json", [])
    return {
        "players": players,
        "coach_last": max((s["year"] for s in coach["seasons"]), default=0),
        "sb_last": max((int(s["year"].lstrip("Y")) for s in sbs), default=0),
        "records": {r["record"]: r for r in read(SRC / "records.json", {"records": []})["records"]},
        "hof": {k for c in content.get("hofClasses", []) for k in c["keys"]},
        # open questions are strings: "Name (n rings): A or B?"
        "questions": {(q.split(" (")[0] if isinstance(q, str) else json.dumps(q, sort_keys=True)): q
                      for q in content.get("openQuestions", [])},
        "snapshots": len(market),
        "edition": content.get("edition", {}),
    }


def run(label: str, cmd: list[str], capture: bool = False) -> str:
    print(f"\n== {label}: {' '.join(cmd)}", flush=True)
    if capture:
        res = subprocess.run(cmd, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        print(res.stdout, end="", flush=True)
    else:
        res = subprocess.run(cmd, cwd=ROOT, text=True)
    if res.returncode:
        sys.exit(f"\nupdate stopped: {label} failed (exit {res.returncode}). Fix it and run npm run update again.")
    return res.stdout if capture else ""


def rollover(before: dict, after: dict) -> list[str]:
    """Season rollover: the season is derived from coach.json everywhere; this checks the inputs agree and lists the
    owner facts that were true "as of" the old season, for a human to confirm."""
    old, new = before["coach_last"], after["coach_last"]
    sb_new = after["sb_last"]
    if new == old and sb_new == before["sb_last"]:
        return []
    out = [f"Season rollover: Y{old} -> Y{new}"]
    if new != sb_new:
        out.append(f"  WARNING coach.json ends at Y{new} but super_bowls.json at Y{sb_new}: add the missing "
                   f"{'superbowl.set' if sb_new < new else 'coach.season'} mutation")
    facts = read(SRC / "owner_facts.json", {})
    for name, f in sorted(facts.get("players", {}).items()):
        career = f.get("career", {})
        if career.get("next_team"):
            out.append(f"  review: {name} career.next_team = {career['next_team']} (said in Y{old}: traded after that "
                       f"season; if he played Y{new} there, replace it with career.on [[team, {new}]])")

    extras = read(SRC / "screenshot_extras.json", {})
    for key in sorted(extras.get("season_lines", {})):
        if "in progress" in key:
            out.append(f"  review: season line \"{key}\" (screenshot_extras.json) was recorded mid-season: still current?")
    cards = {**extras.get("player_cards", {}),
             **{n: f["card"] for n, f in facts.get("players", {}).items() if f.get("card")}}
    for name, card in sorted(cards.items()):
        if re.search(r"in progress|this season", json.dumps(card, ensure_ascii=False), re.I):
            out.append(f"  review: {name}'s card says the Y{old} season is in progress")
    coach = read(SRC / "coach.json", {})
    stale = [k for k in ("record", "bests", "superBowlRecord", "gamesPlayed", "age") if k in coach]
    if stale:
        out.append(f"  review: coach.json {', '.join(stale)} are staff-screen snapshots from Y{old}; the Front Office "
                   f"prefers them over the season rows, so send the new staff screen (coach.set)")
    if facts.get("active_rosters"):
        out.append(f"  review: active_rosters were recorded for Y{old}; send new team screens (fact.set "
                   f"active_rosters/<Team>) or keep them as the Y{old} rosters (season_rosters/{old})")
    return out


def summary(bundle_id: str, before: dict, after: dict, rebuild_out: str, roll: list[str]) -> None:
    print("\n" + "=" * 72 + f"\nUPDATE SUMMARY: {bundle_id}\n" + "=" * 72)
    added = sorted(set(after["players"]) - set(before["players"]))
    changed = []
    for k in sorted(set(after["players"]) & set(before["players"])):
        a, b = after["players"][k], before["players"][k]
        diff = [f for f in sorted(set(a) | set(b)) if a.get(f) != b.get(f)]
        if diff:
            changed.append(f"{k} ({', '.join(diff)})")
    print(f"Players added ({len(added)}): {', '.join(added) or 'none'}")
    print(f"Players updated ({len(changed)}): {'; '.join(changed) or 'none'}")
    fixed = {n for n, f in read(SRC / "owner_facts.json", {}).get("players", {}).items() if f.get("team")}
    unk = sorted(k for k, p in after["players"].items() if p.get("team") in (None, "", "UNK") and p["n"] not in fixed)
    print(f"Players needing teams ({len(unk)}): {', '.join(unk) or 'none'} {'(ask the owner)' if unk else ''}")
    recs = [f'{r} -> {v.get("mark")} ({v.get("holder")}, {v.get("year")})' for r, v in sorted(after["records"].items())
            if before["records"].get(r) != v]
    print(f"Records set ({len(recs)}): {'; '.join(recs) or 'none'}")
    new_hof = sorted(after["hof"] - before["hof"])
    print(f"New Hall of Famers ({len(new_hof)}): {', '.join(new_hof) or 'none'}")
    needed = [l for l in rebuild_out.splitlines() if l.startswith("SPEECH NEEDED")]
    for l in needed:
        print(f"  {l}")
    market = read(SRC / "market_history.json", [])
    if after["snapshots"] > before["snapshots"] and len(market) >= 2:
        prev, cur = market[-2]["players"], market[-1]["players"]
        moves = []
        for k, v in cur.items():
            p = prev.get(k)
            if not p:
                moves.append((10**9, f"{k} new card ({v.get('ovr')} OVR, value {v.get('value')})"))
                continue
            dv, do = v.get("value", 0) - p.get("value", 0), v.get("ovr", 0) - p.get("ovr", 0)
            if dv or do:
                moves.append((abs(dv), f"{k} value {p.get('value')} -> {v.get('value')}, OVR {p.get('ovr')} -> {v.get('ovr')}"))
        moves.sort(key=lambda m: (-m[0], m[1]))
        print(f"Market snapshot added ({market[-1].get('label')}); top movers:")
        for _, m in moves[:8]:
            print(f"  {m}")
    else:
        print("Market: no OVR / skill / legacy changes (no new snapshot)")
    content = read(CONTENT, {})
    info, heads = content.get("headlinesInfo", {}), content.get("headlines", [])
    scope = info.get("scope", "none")
    when = f" ({info['since']} -> {info['label']})" if info.get("since") else ""
    print(f"Headlines: {len(heads)}, {scope}{when}" + (" (this bundle changed nothing headline-worthy)" if scope == "Last update" else ""))
    for h in heads:
        print(f"  [{h.get('kind')}] {h.get('text')}")
    new_q = sorted(set(after["questions"]) - set(before["questions"]))
    print(f"Open questions: {len(after['questions'])} ({len(new_q)} new{': ' + ', '.join(new_q) if new_q else ''})")
    for l in roll:
        print(l)
    ed = after["edition"]
    print(f"Edition: {ed.get('label')} (seed {ed.get('seed')}); was {before['edition'].get('label')}")
    rel = Path(bundle_id)
    print("\nNothing was committed. When it looks right:")
    print(f"  git add -A data public scripts src CLAUDE.md\n"
          f"  git commit -m \"Update {rel.name}: <who was added or updated>\"\n"
          f"  git push origin retrovault-v2")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    bundle = Path(args[0]).resolve()
    manifest = read(bundle / "manifest.json")
    if manifest is None:
        sys.exit(f"{bundle}/manifest.json not found")
    log = read(SRC / "mutations_log.json", {"applied": []})
    applied = any(e["id"] == manifest["id"] for e in log["applied"])
    if not applied and UPLOADS.resolve() not in bundle.parents:
        sys.exit(f"{bundle} is not under data/uploads/: move the bundle there first (the audit traces data to it)")

    before = state()
    run("validate", ["python3", "scripts/apply_upload.py", str(bundle), "--check"])
    run("apply", ["python3", "scripts/apply_upload.py", str(bundle), "--no-rebuild"])
    rebuild_out = run("rebuild", ["npm", "run", "-s", "rebuild"], capture=True)
    after = state()
    roll = rollover(before, after)
    for l in roll:
        print(l)
    if "--skip-build" not in sys.argv:
        run("typecheck", ["npx", "tsc", "--noEmit", "-p", "tsconfig.app.json"])
        run("sprites", ["npm", "run", "-s", "check:sprites"])
        run("build", ["npm", "run", "-s", "build"])
    summary(manifest["id"], before, after, rebuild_out, roll)


if __name__ == "__main__":
    main()
