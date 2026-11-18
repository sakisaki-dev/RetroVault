import { useEffect, useState, useSyncExternalStore } from 'react';

/*
 * The screensaver's bus line (owner, 2026-11-18: "a small alert saying leave now and the next bus option"; style A,
 * "make it a bit more subtle"). The route's timetable is public data (public/data/transit/route-<n>.json, built by
 * scripts/transit_route.py from Santa Cruz METRO's GTFS); which stop a viewer uses and how long their walk is are
 * picked in the Season lamp's menu and kept in this browser only (never in the repo). Times are the published
 * timetable: METRO's live feed can't be read from a web page (no cross-origin access).
 */
export interface BusSetting {
  route: string;
  /** a boarding point's id in the route file */
  point: string;
  /** minutes from the door to the stop */
  walk: number;
}
export interface RoutePoint {
  id: string;
  name: string;
  toward: string;
  headsign: string | null;
}
export interface RouteFile {
  route: string;
  name: string;
  ends: string | null;
  points: RoutePoint[];
  services: { dates: string[]; times: Record<string, number[]> }[];
}

const KEY = 'rv:saver:bus';
const listeners = new Set<() => void>();
const read = (): BusSetting | null => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v.point === 'string' && typeof v.walk === 'number' ? v : null;
  } catch {
    return null;
  }
};
let setting = read();
export const setBusSetting = (v: BusSetting | null) => {
  setting = v;
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* kept for this visit */
  }
  listeners.forEach((l) => l());
};
export const useBusSetting = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => setting,
    () => null,
  );

const cache = new Map<string, Promise<RouteFile | null>>();
export const loadRoute = (route: string) => {
  let p = cache.get(route);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/transit/route-${route}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RouteFile>) : null))
      .catch(() => null);
    cache.set(route, p);
  }
  return p;
};
export const useRoute = (route: string | null | undefined) => {
  const [file, setFile] = useState<RouteFile | null>(null);
  useEffect(() => {
    if (!route) return;
    let alive = true;
    void loadRoute(route).then((f) => alive && setFile(f));
    return () => {
      alive = false;
    };
  }, [route]);
  return file;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Departures from a boarding point, as Dates, from today on (today and tomorrow are enough for a line) */
export const departures = (file: RouteFile, point: string, now: Date): Date[] => {
  const p = String(file.points.findIndex((x) => x.id === point));
  if (p === '-1') return [];
  const out: Date[] = [];
  for (let day = 0; day < 2; day++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
    const key = iso(d);
    for (const s of file.services) {
      if (!s.dates.includes(key)) continue;
      for (const m of s.times[p] ?? []) out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m));
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
};

export type BusState =
  | { kind: 'now'; bus: Date; next: Date | null }
  | { kind: 'soon'; bus: Date; next: Date | null; inMin: number }
  | { kind: 'later'; bus: Date; leave: Date }
  | { kind: 'none' };

/** Leave now (it's walking time, a minute to spare), leave in N minutes (within 20), or the next bus and when to go */
export const busState = (deps: Date[], walk: number, now: Date): BusState => {
  const t = now.getTime();
  const catchable = deps.filter((d) => d.getTime() - walk * 60_000 >= t - 30_000);
  const bus = catchable[0];
  if (!bus) return { kind: 'none' };
  const next = catchable[1] ?? null;
  const leave = new Date(bus.getTime() - (walk + 1) * 60_000);
  const inMin = Math.ceil((leave.getTime() - t) / 60_000);
  if (inMin <= 0) return { kind: 'now', bus, next };
  if (inMin <= 20) return { kind: 'soon', bus, next, inMin };
  return { kind: 'later', bus, leave };
};

/** "8:24" (no AM / PM: the clock above says which) */
export const hm = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
