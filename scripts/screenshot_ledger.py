"""Screenshot ledger: one row per screenshot the owner has sent, so the inbox can be cleaned without losing data.

Screenshots never go to GitHub (owner rule), so this ledger records only names, fingerprints and what each image
gave the data, never the image. It reads the applied upload manifests (data/y80/mutations_log.json) and scans:

  - the inbox, ~/Downloads/Retrobowl Uploads (and its subfolders), where new screenshots arrive
  - the archive, data/uploads/<bundle>/images/, the copy each bundle keeps (gitignored)

Status per image (by SHA-256, so a renamed or duplicated file is still the same screenshot):
  tabulated  listed in an applied manifest: its data is in data/y80
  no-data    listed in an applied manifest as showing nothing usable (title screens, duplicates)
  pending    not in any applied manifest yet: still to transcribe, or never used

Writes data/y80/screenshots.json. With --clean it lists the inbox copies that are safe to delete (tabulated or
no-data, and an identical archived copy exists in a bundle); --clean --yes deletes them. Nothing is ever deleted
from the bundle archives, and pending images are never touched.

  npm run ledger                  # rebuild the ledger and print a summary
  npm run ledger -- --clean       # also list the inbox files that are safe to delete
  npm run ledger -- --clean --yes # delete them
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
OUT = SRC / "screenshots.json"
INBOX = Path.home() / "Downloads" / "Retrobowl Uploads"
MEDIA = {".png", ".jpg", ".jpeg", ".heic", ".mp4", ".mov"}
NO_DATA = re.compile(r"no data|duplicate|title screen", re.I)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def media(folder: Path) -> list[Path]:
    if not folder.exists():
        return []
    return sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in MEDIA)


def applied_manifests() -> list[tuple[str, dict]]:
    log = json.loads((SRC / "mutations_log.json").read_text())
    out = []
    for e in log.get("applied", []):
        path = ROOT / e.get("dir", f"data/uploads/{e['id']}") / "manifest.json"
        if path.exists():
            out.append((e["id"], json.loads(path.read_text())))
    return out


def uses_by_name() -> dict[str, list[dict]]:
    """Image file name -> what each applied manifest says it shows and whether a mutation cites it."""
    uses: dict[str, list[dict]] = {}
    for bundle, m in applied_manifests():
        cited = {Path(str(x.get("source", ""))[6:]).name for x in m.get("mutations", [])
                 if str(x.get("source", "")).startswith("image:")}
        merged = {n for x in m.get("mutations", []) for n in re.findall(r"IMG_\d+\.\w+", str(x.get("reason", "")))}
        listed = {}
        for im in m.get("images", []):
            for f in [im.get("file")] + list(im.get("files", [])):
                if f:
                    listed[Path(f).name] = im.get("shows", "")
        # older bundles name images only in prose (reasons, sources), so pick those up too
        for name in set(re.findall(r"(?:IMG_\d+|ScreenRecording[^\"/]*?)\.(?:PNG|png|JPG|jpg|MP4|mp4)", json.dumps(m))):
            listed.setdefault(name, "")
        for name, shows in listed.items():
            uses.setdefault(name, []).append({"bundle": bundle, "shows": shows,
                                              "cited": name in cited or name in merged})
    return uses


def build() -> dict:
    uses = uses_by_name()
    rows: dict[str, dict] = {}
    for where, folder in (("inbox", INBOX), ("archive", ROOT / "data" / "uploads")):
        for p in media(folder):
            digest = sha256(p)
            row = rows.setdefault(digest, {"sha256": digest, "names": [], "bytes": p.stat().st_size, "inbox": [],
                                           "archive": []})
            if p.name not in row["names"]:
                row["names"].append(p.name)
            row[where].append(str(p.relative_to(folder if where == "inbox" else ROOT)))
    for row in rows.values():
        found = [u for n in row["names"] for u in uses.get(n, [])]
        row["bundles"] = sorted({u["bundle"] for u in found})
        row["shows"] = next((u["shows"] for u in found if u["shows"]), "")
        row["cited"] = any(u["cited"] for u in found)
        row["status"] = ("pending" if not found else "no-data" if row["shows"] and NO_DATA.search(row["shows"])
                         and not row["cited"] else "tabulated")
    ordered = sorted(rows.values(), key=lambda r: (r["names"][0].lower(), r["sha256"]))
    return {
        "_about": ("Screenshot ledger (scripts/screenshot_ledger.py, npm run ledger): one row per screenshot by SHA-256, "
                   "with what it showed, the applied bundles that used it and where copies live (inbox = "
                   "~/Downloads/Retrobowl Uploads, archive = data/uploads/<bundle>/images, both outside git). "
                   "Generated; never hand-edit."),
        "screenshots": [{k: r[k] for k in ("names", "sha256", "bytes", "status", "shows", "bundles", "cited", "inbox",
                                           "archive")} for r in ordered],
    }


def main() -> None:
    ledger = build()
    rows = ledger["screenshots"]
    OUT.write_text(json.dumps(ledger, indent=1, ensure_ascii=False) + "\n")
    mb = lambda rs: f"{sum(r['bytes'] for r in rs) / 1e6:.0f} MB"
    by = {s: [r for r in rows if r["status"] == s] for s in ("tabulated", "no-data", "pending")}
    print(f"wrote {OUT.relative_to(ROOT)}: {len(rows)} screenshots")
    for s, rs in by.items():
        print(f"  {s:9} {len(rs):4}  {mb(rs)}")
    dupes = [r for r in rows if len(r["inbox"]) > 1]
    if dupes:
        print(f"  {len(dupes)} screenshots have more than one copy in the inbox")
    pending_inbox = [r for r in by["pending"] if r["inbox"]]
    if pending_inbox:
        print("pending in the inbox (not in any applied bundle): " + ", ".join(r["names"][0] for r in pending_inbox[:20])
              + (" …" if len(pending_inbox) > 20 else ""))
    if "--clean" not in sys.argv:
        return
    safe = [r for r in rows if r["status"] != "pending" and r["inbox"] and r["archive"]]
    unarchived = [r for r in rows if r["status"] != "pending" and r["inbox"] and not r["archive"]]
    print(f"\nsafe to delete from the inbox: {sum(len(r['inbox']) for r in safe)} files, {mb(safe)} "
          f"(tabulated or no data, identical copy archived in a bundle)")
    for r in safe:
        print(f"  {', '.join(r['inbox'])}  [{r['status']}; {r['bundles'][-1]}]")
    if unarchived:
        print(f"kept: {len(unarchived)} tabulated inbox files with no archived copy (the inbox is their only copy): "
              + ", ".join(r["names"][0] for r in unarchived[:20]) + (" …" if len(unarchived) > 20 else ""))
    if "--yes" in sys.argv:
        for r in safe:
            for rel in r["inbox"]:
                (INBOX / rel).unlink()
        print(f"deleted {sum(len(r['inbox']) for r in safe)} inbox files")
        main_argv = [a for a in sys.argv if a not in ("--clean", "--yes")]
        sys.argv = main_argv
        main()


if __name__ == "__main__":
    main()
