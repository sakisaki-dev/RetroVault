/**
 * The site's own jersey numbers and Career Legacy for the launch screens (scripts/build_app_icons.py runs this; no
 * pixels here). Loads the league exactly as the site does (public/data/initial-data.csv through parseCSV, the position
 * normalization of LeagueContext's normalizeAndSplit, the real NFL legends left out), indexes player-extras.json with
 * the site's loader, then numbers everyone as useJerseyNumbers does (withHomeClubs + buildJerseyIndexWithAlso), so a
 * number here is the number on his player card. Prints {"POS:Name": {number, legacy, team, inducted}} on stdout.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LeagueData, Player } from '@/types/player';
import { parseCSV } from '@/utils/csvParser';
import { normalizeLeague } from '@/config/stats';
import { loadPlayerExtras } from '@/utils/playerExtras';
import { buildJerseyIndexWithAlso, jerseyKey, preferredNumbers, withHomeClubs } from '@/utils/jerseys';

const ROOT = resolve(process.argv[2] ?? '.');
// the extras loader fetches data/player-extras.json; here it reads the file from public/
(globalThis as { fetch?: unknown }).fetch = async (url: string) => {
  const rel = String(url).replace(/^.*?data\//, 'data/');
  return { ok: true, json: async () => JSON.parse(readFileSync(resolve(ROOT, 'public', rel), 'utf8')) };
};

const KEYS: (keyof Omit<LeagueData, 'metadata'>)[] = [
  'quarterbacks', 'runningbacks', 'widereceivers', 'tightends', 'offensiveline', 'linebackers', 'defensivebacks', 'defensiveline',
];

const main = async () => {
  const data = parseCSV(readFileSync(resolve(ROOT, 'public/data/initial-data.csv'), 'utf8'));
  const all = KEYS.flatMap((k) => data[k] as Player[]);
  const players = normalizeLeague(all).filter((p) => !p.isRealLegend);
  const extras = await loadPlayerExtras();
  const homes = withHomeClubs(players, extras);
  const index = buildJerseyIndexWithAlso(homes.players, homes.also);
  const out: Record<string, { number: number; legacy: number; team: string; inducted: boolean }> = {};
  for (const p of players) {
    const k = jerseyKey(p);
    out[k] = { number: index.numbers.get(k) ?? preferredNumbers(p)[0], legacy: Math.round(p.careerLegacy ?? 0), team: p.team ?? '', inducted: !!p.inducted };
  }
  process.stdout.write(JSON.stringify(out));
};
main();
