/**
 * Data audit: finds hand-written facts that no longer agree with the league data, so a stats update can't leave
 * stale text behind. Run after any data change (`npm run audit`); the deploy workflow runs it too.
 *
 * Exit code 1 only on errors (things that are certainly wrong); warnings are printed for a human to judge.
 */
import { readFileSync } from 'fs';
import { parseCSV } from '@/utils/csvParser';
import { normalizeLeague, isHallOfFamer } from '@/config/stats';
import { findNFLTeam } from '@/utils/nflTeams';
import type { Player } from '@/types/player';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const data = parseCSV(readFileSync('public/data/initial-data.csv', 'utf8')) as unknown as Record<string, Player[]>;
const KEYS = ['quarterbacks', 'runningbacks', 'widereceivers', 'tightends', 'offensiveline', 'linebackers', 'defensivebacks', 'defensiveline'];
const league = normalizeLeague(KEYS.flatMap((k) => data[k] ?? [])).filter((p) => !p.isRealLegend);
const content = read('public/data/league/content.json');
const extras = read('public/data/player-extras.json');

const errors: string[] = [];
const warnings: string[] = [];
const byName = new Map(league.map((p) => [p.name, p]));
const franchisesOf = (p: Player): Set<string> => {
  const ids = new Set<string>();
  const add = (t?: string | null) => {
    const team = findNFLTeam(t ?? '');
    if (team) ids.add(team.id);
  };
  add(p.team);
  (extras.franchises?.[p.name] ?? []).forEach(add);
  const card = extras.cards?.[p.name] ?? {};
  [card.former_team, card.legacy_team, card.retired_team].forEach(add);
  (extras.stints?.[p.name]?.stints ?? []).forEach((s: { team: string }) => add(s.team));
  return ids;
};

// 1. Every league player has a real team
league.filter((p) => !findNFLTeam(p.team)).forEach((p) => errors.push(`No team: ${p.position} ${p.name}`));

// 2. Every Hall of Famer has a custom induction speech (the generic template must never show)
const speeches: Record<string, string> = content.speeches ?? {};
league
  .filter(isHallOfFamer)
  .filter((p) => !speeches[p.name])
  .forEach((p) => errors.push(`Hall of Famer without a custom speech: ${p.name} (Career Legacy ${Math.round(p.careerLegacy)})`));

// 3. Speeches / notes that name a team the player never played for
const NICKS = new Map<string, string>();
['Bills', 'Dolphins', 'Jets', 'Patriots', 'Bengals', 'Browns', 'Ravens', 'Steelers', 'Colts', 'Jaguars', 'Texans', 'Titans', 'Broncos', 'Chargers', 'Chiefs', 'Raiders', 'Commanders', 'Cowboys', 'Giants', 'Eagles', 'Lions', 'Packers', 'Vikings', 'Bears', 'Buccaneers', 'Falcons', 'Saints', 'Panthers', '49ers', 'Cardinals', 'Rams', 'Seahawks'].forEach((n) => {
  const t = findNFLTeam(n);
  if (t) NICKS.set(n, t.id);
});
const teamsNamed = (text: string) => [...NICKS.entries()].filter(([n]) => new RegExp(`\\b${n}\\b`).test(text)).map(([n, id]) => ({ n, id }));
const checkText = (who: string, text: string, where: string) => {
  const p = byName.get(who);
  if (!p) return;
  const mine = franchisesOf(p);
  // Opponents are named too ("beat the Seahawks"), so this is a warning for a human to read, not an error
  const strangers = teamsNamed(text).filter((t) => !mine.has(t.id) && !new RegExp(`(over|beat|against|vs\\.?|past|to) the ${t.n}`, 'i').test(text));
  if (strangers.length) warnings.push(`${where} for ${who} names ${strangers.map((t) => t.n).join(', ')}, not in his franchises (${[...mine].join(', ') || 'none'})`);
};
Object.entries(speeches).forEach(([who, text]) => checkText(who, text, 'Speech'));
Object.entries(extras.cards ?? {}).forEach(([who, card]) => {
  const c = card as Record<string, unknown>;
  if (typeof c.note === 'string') checkText(who, c.note, 'Card note');
});

// 4. Notes that still describe something as "in progress" (season lines are not tracked; they go stale)
Object.entries(extras.cards ?? {}).forEach(([who, card]) => {
  const text = JSON.stringify(card);
  if (/in progress/i.test(text)) warnings.push(`Card for ${who} says "in progress": still true?`);
});

// 5. Era key players who never played for any of that era's teams
for (const era of content.eras ?? []) {
  const eraTeams = new Set((era.yourTeams ?? []).map((t: string) => findNFLTeam(t)?.id).filter(Boolean));
  for (const raw of era.keyPlayers ?? []) {
    const name = String(raw).replace(/\s*\(.+?\)\s*/g, ' ').trim();
    const p = byName.get(name);
    if (!p || !eraTeams.size) continue;
    if (![...franchisesOf(p)].some((id) => eraTeams.has(id)))
      warnings.push(`Era "${era.name}" lists ${name}, who never played for ${[...eraTeams].join('/')}`);
  }
}

// 6. Hall of Fame classes point at real Hall of Famers
for (const cls of content.hofClasses ?? []) {
  for (const key of cls.keys) {
    const [, name] = key.split(/:(.+)/);
    const p = byName.get(name);
    if (!p) errors.push(`HOF class ${cls.label}: unknown player ${key}`);
    else if (!isHallOfFamer(p)) warnings.push(`HOF class ${cls.label}: ${name} is below the Hall of Fame line now`);
  }
}

// 7. Stints (when present) explain each player's rings
for (const [who, s] of Object.entries(extras.stints ?? {}) as [string, { stints: { rings?: number[] }[] }][]) {
  const p = byName.get(who);
  if (!p) continue;
  const rings = s.stints.reduce((n, st) => n + (st.rings?.length ?? 0), 0);
  if (rings !== p.rings) warnings.push(`Stints for ${who} account for ${rings} rings; he has ${p.rings}`);
}

warnings.forEach((w) => console.log(`warn  ${w}`));
errors.forEach((e) => console.log(`ERROR ${e}`));
console.log(`\naudit: ${league.length} players, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
