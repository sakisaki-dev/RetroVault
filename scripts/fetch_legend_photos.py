#!/usr/bin/env python3
"""Look up freely licensed photos of the real-NFL legends on Wikimedia Commons.

For each legend in public/data/legends.json: search Wikidata, keep the first result that is an
American football player, read its image (P18, always a Commons file) and the file's author and
license. Results are cached in data/legends/photos.json, so re-runs only look up new names.
build_league_data.py merges them into legends.json for the games.

Usage: python3 -I scripts/fetch_legend_photos.py [--refresh] [--only="Player Name"]
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEGENDS = ROOT / "public" / "data" / "legends.json"
CACHE = ROOT / "data" / "legends" / "photos.json"
UA = {"User-Agent": "RetroVault/0.1 (personal Retro Bowl fan site; legend photo lookup)"}
AMERICAN_FOOTBALL = "Q41323"
DELAY = 4.0  # seconds between API calls; Wikidata rate-limits bursts

# Disambiguation for names whose first football match is the wrong person.
WIKIDATA_IDS: dict[str, str] = {}
# Text the right person's Wikidata description must contain (usually the birth year).
DESC_HINTS = {"Reggie White": "1961", "Kellen Winslow": "1957"}


def get(url, params, retries=5):
    q = urllib.parse.urlencode({**params, "format": "json", "origin": "*"})
    for attempt in range(retries):
        time.sleep(DELAY if attempt == 0 else min(15 * 2 ** attempt, 120))  # back off hard when throttled
        try:
            with urllib.request.urlopen(urllib.request.Request(f"{url}?{q}", headers=UA), timeout=20) as r:
                return json.loads(r.read())
        except (json.JSONDecodeError, OSError) as e:
            print(f"  retry {attempt + 1} ({e.__class__.__name__})")
    raise RuntimeError(f"failed: {url} {params}")


def find_entity(name):
    if name in WIKIDATA_IDS:
        ids = [WIKIDATA_IDS[name]]
    else:
        res = get("https://www.wikidata.org/w/api.php",
                  {"action": "wbsearchentities", "search": name, "language": "en", "type": "item", "limit": 10})
        ids = [r["id"] for r in res.get("search", [])]
    if not ids:
        return None
    ents = get("https://www.wikidata.org/w/api.php",
               {"action": "wbgetentities", "ids": "|".join(ids), "props": "claims|descriptions", "languages": "en"})
    for i in ids:
        e = ents["entities"].get(i, {})
        claims = e.get("claims", {})
        sport = any(c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") == AMERICAN_FOOTBALL
                    for c in claims.get("P641", []))
        desc = e.get("descriptions", {}).get("en", {}).get("value", "")
        hint = DESC_HINTS.get(name)
        if hint and hint not in desc:
            continue
        if sport or "american football" in desc.lower():
            image = claims.get("P18", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value")
            return {"wikidata": i, "description": desc, "file": image}
    return None


def file_credit(filename):
    res = get("https://commons.wikimedia.org/w/api.php",
              {"action": "query", "titles": f"File:{filename}", "prop": "imageinfo",
               "iiprop": "extmetadata|url", "iiurlwidth": 480})
    page = next(iter(res["query"]["pages"].values()))
    info = (page.get("imageinfo") or [{}])[0]
    meta = info.get("extmetadata", {})
    strip = lambda s: "".join(part.split(">")[-1] for part in (s or "").split("<")).strip()
    return {
        "url": info.get("thumburl") or info.get("url"),
        "page": info.get("descriptionurl"),
        "author": strip(meta.get("Artist", {}).get("value")) or "Unknown author",
        "license": meta.get("LicenseShortName", {}).get("value", ""),
    }


def main():
    refresh = "--refresh" in sys.argv
    only = {a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")}
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    names = [p["name"] for p in json.loads(LEGENDS.read_text())]
    for name in names:
        if only and name not in only:
            continue
        if name in cache and not refresh and not only:
            continue
        print(f"{name}…")
        try:
            ent = find_entity(name)
        except RuntimeError as e:
            print(f"  skipped ({e}); re-run to retry")
            continue
        if not ent or not ent["file"]:
            cache[name] = {"photo": None, **(ent or {})}
            print("  no free photo")
        else:
            try:
                cache[name] = {**ent, **file_credit(ent["file"])}
            except RuntimeError as e:
                print(f"  skipped credit lookup ({e}); re-run to retry")
                continue
            print(f"  {cache[name]['description']} · {cache[name]['license']}")
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False))
    found = sum(1 for n in names if cache.get(n, {}).get("url"))
    print(f"{found}/{len(names)} legends have a Commons photo → {CACHE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
