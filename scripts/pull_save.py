#!/usr/bin/env python3
"""Pull NFL Retro Bowl's save off the iPhone, and nothing else.

Run it yourself in Terminal (not inside Claude Code), so nothing but the game's folder ever reaches this project:

    python3 ~/RetroVault/scripts/pull_save.py

What it does:
1. Notes the iPhone backups already on this Mac (it never touches those).
2. Waits while you make a backup in Finder (plug in, Trust, Finder > your iPhone > Back Up Now, "Back up all of the
   data on your iPhone to this Mac", leave "Encrypt local backup" OFF).
3. Finds the new backup, reads its index (Manifest.db) and copies out only the Retro Bowl app's files (any app or
   app-group folder whose id contains "retro" or "newstar"), with their real names, into
   ~/RetroVault/data/saves/<date>/ (git-ignored: never pushed).
4. Checks every copied file against the backup, then deletes that new backup. If anything is off (no game files
   found, an encrypted backup, a copy that doesn't match) it keeps the backup and says why.

Needs Full Disk Access for Terminal (System Settings > Privacy & Security > Full Disk Access > Terminal), because
macOS protects the backup folder. You can switch it off again afterwards.
"""
from __future__ import annotations

import hashlib
import os
import plistlib
import shutil
import sqlite3
import sys
import time
from datetime import date
from pathlib import Path

BACKUPS = Path(os.environ.get("RB_BACKUPS", Path.home() / "Library" / "Application Support" / "MobileSync" / "Backup"))  # RB_BACKUPS: tests only
OUT_ROOT = Path(os.environ.get("RB_OUT", Path(__file__).resolve().parent.parent / "data" / "saves"))  # RB_OUT: tests only
MATCH = ("retro", "newstar")  # the game's app id (e.g. com.newstargames.<...>retrobowl<...>)


def die(msg: str, code: int = 1) -> None:
    print(f"\n✗ {msg}")
    sys.exit(code)


def list_backups() -> set[str]:
    try:
        return {p.name for p in BACKUPS.iterdir() if p.is_dir()} if BACKUPS.exists() else set()
    except PermissionError:
        die("macOS blocked reading the backup folder. Give Terminal Full Disk Access:\n"
            "  System Settings > Privacy & Security > Full Disk Access > turn on Terminal, then quit and reopen Terminal.")
    return set()


def sha1(p: Path) -> str:
    h = hashlib.sha1()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    before = list_backups()
    print("NFL Retro Bowl save puller")
    print(f"Backups already on this Mac: {len(before)} (left alone).\n")
    print("Now, in Finder: plug in the iPhone, tap Trust, select the iPhone, choose")
    print('"Back up all of the data on your iPhone to this Mac" (Encrypt local backup OFF), then Back Up Now.')
    input("Press Enter here when Finder says the backup is finished... ")

    new = sorted(list_backups() - before, key=lambda n: (BACKUPS / n).stat().st_mtime)
    if not new:
        # Finder sometimes updates an existing backup in place: offer the newest one, but never delete it
        if not before:
            die("No backup found. Did the backup finish in Finder?")
        newest = max(before, key=lambda n: (BACKUPS / n / "Manifest.db").stat().st_mtime if (BACKUPS / n / "Manifest.db").exists() else 0)
        print(f"\nNo new backup folder appeared; Finder updated an existing one ({newest}).")
        print("I'll extract from it but NOT delete it, since it existed before this run.")
        bdir, deletable = BACKUPS / newest, False
    else:
        bdir, deletable = BACKUPS / new[-1], True

    manifest_plist = bdir / "Manifest.plist"
    manifest_db = bdir / "Manifest.db"
    if not manifest_db.exists():
        die(f"{bdir.name} has no Manifest.db yet. Wait for Finder to finish, then run this again.")
    if manifest_plist.exists() and plistlib.loads(manifest_plist.read_bytes()).get("IsEncrypted"):
        die("This backup is encrypted, so its files can't be read without the password. In Finder, untick "
            '"Encrypt local backup", back up again, and rerun. (The encrypted backup was left in place.)')

    con = sqlite3.connect(f"file:{manifest_db}?mode=ro", uri=True)
    rows = con.execute("SELECT fileID, domain, relativePath, flags FROM Files").fetchall()
    con.close()
    domains = sorted({d for _, d, _, _ in rows if d.startswith("AppDomain") and any(m in d.lower() for m in MATCH)})
    if not domains:
        bowl = sorted({d for _, d, _, _ in rows if d.startswith("AppDomain") and any(k in d.lower() for k in ("bowl", "nfl"))})
        die("Couldn't find Retro Bowl in the backup. App ids that mention bowl or NFL: "
            + (", ".join(bowl) or "none") + ".\nThe backup was kept; send me that line.")

    out = OUT_ROOT / date.today().isoformat()
    n = size = 0
    for file_id, domain, rel, flags in rows:
        if domain not in domains or flags != 1:  # 1 = a file (2 = folder, 4 = link)
            continue
        src = bdir / file_id[:2] / file_id
        if not src.exists():
            continue
        dst = out / domain / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        if sha1(src) != sha1(dst):
            die(f"Copy check failed for {rel}. The backup was kept.")
        n += 1
        size += dst.stat().st_size
    if n == 0:
        die("Found the game's folder but no files in it. The backup was kept.")

    print(f"\n✓ Copied {n} files ({size / 1e6:.1f} MB) from {', '.join(domains)}")
    print(f"  into {out}")

    if deletable:
        print(f"\nDeleting the full backup ({bdir.name}) in 5 seconds. Press Ctrl-C to keep it.")
        try:
            time.sleep(5)
        except KeyboardInterrupt:
            print("\nKept the backup. Delete it later in Finder > your iPhone > Manage Backups.")
            return
        shutil.rmtree(bdir)
        print("✓ Full backup deleted. Only the game's files remain.")
    print("\nDone. Tell Claude: the save is in", out)


if __name__ == "__main__":
    main()
