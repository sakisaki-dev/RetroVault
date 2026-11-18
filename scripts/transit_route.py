#!/usr/bin/env python3
"""
One bus route's timetable for the screensaver's bus line (owner, 2026-11-18: "the 11 that i consistently take … a small
alert saying leave now and the next bus option"). Not part of `npm run rebuild`: run it when METRO publishes a new
timetable (its feed says how long it runs, `ends`).

    python3 scripts/transit_route.py [route] [gtfs.zip or folder]

Reads Santa Cruz METRO's public GTFS (https://developer.scmetro.org/gtfs.zip, downloaded when no path is given) and
writes public/data/transit/route-<route>.json: every stop the route serves (in trip order, per direction), and for each
service pattern the dates it runs and the departure minutes at every stop. The whole route, never one person's stop:
the stop a viewer uses and their walk are picked in the screensaver menu and kept in that browser only.
"""
import csv
import io
import json
import sys
import urllib.request
import zipfile
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://developer.scmetro.org/gtfs.zip"


def read_feed(src: str | None):
    if src and Path(src).is_dir():
        return lambda name: open(Path(src) / name, newline="", encoding="utf-8-sig")
    data = Path(src).read_bytes() if src else urllib.request.urlopen(URL, timeout=60).read()
    z = zipfile.ZipFile(io.BytesIO(data))
    return lambda name: io.TextIOWrapper(z.open(name), encoding="utf-8-sig", newline="")


def minutes(t: str) -> int:
    h, m, s = (int(x) for x in t.split(":"))
    return h * 60 + m + (1 if s >= 30 else 0)


def main():
    route = sys.argv[1] if len(sys.argv) > 1 else "11"
    open_ = read_feed(sys.argv[2] if len(sys.argv) > 2 else None)
    routes = {r["route_id"]: r for r in csv.DictReader(open_("routes.txt"))}
    rids = {rid for rid, r in routes.items() if r["route_short_name"] == route}
    if not rids:
        sys.exit(f"route {route} not in the feed")
    r0 = routes[next(iter(rids))]
    trips = {t["trip_id"]: t for t in csv.DictReader(open_("trips.txt")) if t["route_id"] in rids}
    stops = {s["stop_id"]: s for s in csv.DictReader(open_("stops.txt"))}
    times = defaultdict(list)  # trip -> [(seq, stop, minutes)]
    for st in csv.DictReader(open_("stop_times.txt")):
        if st["trip_id"] in trips and st["departure_time"]:
            times[st["trip_id"]].append((int(st["stop_sequence"]), st["stop_id"], minutes(st["departure_time"])))

    # a stop visited twice on a loop is two boarding points (its direction is where the bus goes next)
    order: dict[str, list[str]] = {}
    for tid, rows in times.items():
        rows.sort()
        key = trips[tid].get("direction_id", "0")
        if key not in order or len(rows) > len(order[key]):
            order[key] = [s for _, s, _ in rows]
    points = []
    index = {}
    for d, seq in sorted(order.items()):
        for i, sid in enumerate(seq[:-1]):  # nobody boards at the last stop
            nxt = stops[seq[i + 1]]["stop_name"]
            key = f"{sid}:{i}"
            index[(d, i)] = len(points)
            points.append({"id": key, "stop": sid, "name": stops[sid]["stop_name"], "toward": nxt, "headsign": None, "dir": d})

    service = defaultdict(lambda: defaultdict(list))  # service -> point -> minutes
    for tid, rows in times.items():
        t = trips[tid]
        d = t.get("direction_id", "0")
        seq = [s for _, s, _ in rows]
        for i, (_, sid, m) in enumerate(rows[:-1]):
            p = index.get((d, i))
            if p is None or points[p]["stop"] != sid:
                # a short trip: match the stop by its first unused place in the full pattern
                full = order[d]
                try:
                    j = full.index(sid, i)
                except ValueError:
                    continue
                p = index.get((d, j))
                if p is None:
                    continue
            points[p]["headsign"] = points[p]["headsign"] or t.get("trip_headsign")
            service[t["service_id"]][p].append(m)

    # the dates each service runs, from the calendar and its exceptions
    days = {}
    end = None
    for c in csv.DictReader(open_("calendar.txt")):
        if c["service_id"] not in service:
            continue
        a = date.fromisoformat(f"{c['start_date'][:4]}-{c['start_date'][4:6]}-{c['start_date'][6:]}")
        b = date.fromisoformat(f"{c['end_date'][:4]}-{c['end_date'][4:6]}-{c['end_date'][6:]}")
        end = max(end or b, b)
        wd = [c[k] == "1" for k in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")]
        ds = set()
        d = a
        while d <= b:
            if wd[d.weekday()]:
                ds.add(d.isoformat())
            d += timedelta(days=1)
        days[c["service_id"]] = ds
    try:
        for x in csv.DictReader(open_("calendar_dates.txt")):
            sid = x["service_id"]
            if sid not in service:
                continue
            d = f"{x['date'][:4]}-{x['date'][4:6]}-{x['date'][6:]}"
            days.setdefault(sid, set())
            (days[sid].add if x["exception_type"] == "1" else days[sid].discard)(d)
    except KeyError:
        pass

    out = {
        "route": route,
        "name": r0["route_long_name"],
        "agency": "Santa Cruz METRO",
        "source": URL,
        "ends": end.isoformat() if end else None,
        "points": points,
        "services": [
            {"dates": sorted(days.get(sid, [])), "times": {str(p): sorted(set(v)) for p, v in sorted(pts.items())}}
            for sid, pts in sorted(service.items())
            if days.get(sid)
        ],
    }
    path = ROOT / "public" / "data" / "transit" / f"route-{route}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"route {route}: {len(points)} boarding points, {len(out['services'])} service patterns, runs to {out['ends']} → {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
