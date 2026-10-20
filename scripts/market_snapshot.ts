/**
 * Card market snapshot (see src/utils/cardMarket.ts for the value formula).
 *
 *   npm run market              append a snapshot of the current public/data if any player's OVR, skill or legacy
 *                               changed since the last one; then write public/data/market.json
 *   npm run market -- --backfill  rebuild data/y80/market_history.json from git history first: one snapshot per
 *                               commit that changed the league data (identical neighbours deduped), then as above
 *
 * Runs in `npm run rebuild` after the league data build and before the content build, so prices move whenever the
 * data does and the content build can read Career Legacy / OVR and derive the Hall of Fame classes from the snapshots.
 * Every snapshot carries `season` (the latest Super Bowl in data/y80/super_bowls.json at that point; older snapshots
 * get it from git once).
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { parseCSV } from '@/utils/csvParser';
import { normalizeLeague } from '@/config/stats';
import type { Player, Position } from '@/types/player';
import { samePlayers, snapshotPlayers, type MarketHistory, type MarketSnapshot } from '@/utils/cardMarket';

const HISTORY = 'data/y80/market_history.json';
const OUT = 'public/data/market.json';
const CSV = 'public/data/initial-data.csv';
const LEGENDS = 'public/data/legends.json';
const EXCLUSIONS = 'public/data/game-exclusions.json';
const KEYS = ['quarterbacks', 'runningbacks', 'widereceivers', 'tightends', 'offensiveline', 'linebackers', 'defensivebacks', 'defensiveline'];
const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];

/** Market points from the three data files' contents (the same inputs officialOvrMap uses on the site). */
const compute = (csv: string, legendsJson: string | null, exclusionsJson: string | null) => {
  const data = parseCSV(csv) as unknown as Record<string, Player[]>;
  const league = normalizeLeague(KEYS.flatMap((k) => data[k] ?? [])).filter((p) => !p.isRealLegend);
  const rawLegends: unknown = legendsJson ? JSON.parse(legendsJson) : [];
  const legends = (Array.isArray(rawLegends) ? rawLegends : [])
    .filter((r) => r && typeof r.name === 'string' && POSITIONS.includes(r.position))
    .map((r) => ({ ...r, name: String(r.name).trim(), isRealLegend: true }) as Player);
  const ex = exclusionsJson ? (JSON.parse(exclusionsJson) as { excludeFromGames?: unknown }).excludeFromGames : [];
  const excluded = new Set(Array.isArray(ex) ? ex.filter((k): k is string => typeof k === 'string') : []);
  return snapshotPlayers(league, legends, excluded);
};

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const gitShow = (sha: string, path: string) => {
  try {
    return git('show', `${sha}:${path}`);
  } catch {
    return null;
  }
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 19, 22:30" from an ISO string, in the time zone the string carries. */
const dateLabel = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[4]}:${m[5]}` : iso;
};

type Snap = MarketSnapshot & { season?: string };
const SUPER_BOWLS = 'data/y80/super_bowls.json';
/** "Y80": the latest Super Bowl year in a super_bowls.json text. */
const seasonOf = (json: string | null): string | undefined => {
  if (!json) return undefined;
  try {
    const sbs = JSON.parse(json) as { year?: string }[];
    const years = sbs.map((s) => Number(String(s.year ?? '').replace(/\D/g, ''))).filter(Number.isFinite);
    return years.length ? `Y${Math.max(...years)}` : undefined;
  } catch {
    return undefined;
  }
};
/** Older snapshots: season from the label ("Y80 · Oct 19…") or from super_bowls.json at the snapshot's commit. */
const fillSeasons = (history: Snap[]) =>
  history.forEach((s) => {
    if (s.season) return;
    const fromLabel = s.label.match(/^(Y\d+) · /)?.[1];
    const sha = s.id.match(/^git-([0-9a-f]+)$/)?.[1];
    const season = fromLabel ?? (sha ? seasonOf(gitShow(sha, SUPER_BOWLS)) : undefined);
    if (season) s.season = season;
  });

const append = (history: MarketHistory, snap: MarketSnapshot) => {
  const last = history[history.length - 1];
  if (last && samePlayers(last.players, snap.players)) return false;
  history.push(snap);
  return true;
};

/** One snapshot per commit that changed the league data, oldest first. Pre-Y80 saves (no legends.json) are skipped. */
const backfill = (): MarketHistory => {
  const shas = git('log', '--reverse', '--format=%H %cI', '--', CSV, 'data/y80/players.json')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(' ') as [string, string]);
  const history: MarketHistory = [];
  shas.forEach(([sha, date]) => {
    const csv = gitShow(sha, CSV);
    const legends = gitShow(sha, LEGENDS);
    if (!csv || !legends) return;
    const players = compute(csv, legends, gitShow(sha, EXCLUSIONS));
    if (!Object.keys(players).length) return;
    const season = seasonOf(gitShow(sha, SUPER_BOWLS));
    if (append(history, { id: `git-${sha.slice(0, 7)}`, label: dateLabel(date), date, ...(season ? { season } : {}), players })) {
      console.log(`  ${sha.slice(0, 7)} ${dateLabel(date)}: ${Object.keys(players).length} players`);
    }
  });
  return history;
};

const localIso = (d: Date) => {
  const off = -d.getTimezoneOffset();
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const local = new Date(d.getTime() + off * 60000).toISOString().slice(0, 19);
  return `${local}${off >= 0 ? '+' : '-'}${pad(off / 60)}:${pad(off % 60)}`;
};

const main = () => {
  const doBackfill = process.argv.includes('--backfill');
  let history: Snap[] = [];
  if (doBackfill) {
    console.log('Backfilling market history from git…');
    history = backfill();
  } else if (existsSync(HISTORY)) {
    const parsed: unknown = JSON.parse(readFileSync(HISTORY, 'utf8'));
    history = Array.isArray(parsed) ? (parsed as Snap[]) : [];
  }

  const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
  const players = compute(readFileSync(CSV, 'utf8'), read(LEGENDS), read(EXCLUSIONS));
  const now = new Date();
  const iso = localIso(now);
  const season = seasonOf(read(SUPER_BOWLS));
  const label = `${season ? `${season} · ` : ''}${dateLabel(iso)}`;
  const id = `snap-${iso.slice(0, 16).replace(/\D/g, '')}`;
  fillSeasons(history);
  const added = append(history, { id, label, date: iso, ...(season ? { season } : {}), players } as Snap);

  // One line per player, so a data update reads as a small diff
  const json = (h: MarketHistory) =>
    `[\n${h
      .map(({ players: ps, ...meta }) => {
        const head = JSON.stringify(meta).slice(0, -1);
        const rows = Object.entries(ps).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
        return ` ${head},"players":{\n${rows.join(',\n')}\n }}`;
      })
      .join(',\n')}\n]\n`;
  writeFileSync(HISTORY, json(history));
  writeFileSync(OUT, JSON.stringify(history));
  console.log(
    `Market: ${history.length} snapshot${history.length === 1 ? '' : 's'}, ${Object.keys(players).length} cards` +
      (added ? ` (added "${label}")` : ' (no OVR / skill / legacy changes; nothing added)'),
  );
};

main();
