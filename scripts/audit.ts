/**
 * Data audit: finds hand-written facts that no longer agree with the league data, so a stats update can't leave
 * stale text behind, and checks the upload pipeline (each data/uploads bundle manifest and data/y80/mutations_log.json):
 * every mutation has a source, reason and trigger, only the allowed AI steps appear, and every owner text field
 * traces back to an applied manifest. Run after any data change (`npm run audit`); the deploy workflow runs it too.
 *
 * Exit code 1 only on errors (things that are certainly wrong); warnings are printed for a human to judge.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
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

// 2b. Numbers written into speeches must still match the data (catches stale text after a stats update)
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const num = (t: string) => WORDS[t.toLowerCase()] ?? Number(t.replace(/,/g, ''));
const statChecks: { re: RegExp; get: (p: Player) => number; label: string }[] = [
  { re: /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) rings?\b/gi, get: (p) => p.rings, label: 'rings' },
  { re: /\b([\d,]{2,}) games\b/gi, get: (p) => p.games, label: 'games' },
  { re: /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten) (?:league |regular-season )?MVPs?\b/gi, get: (p) => p.mvp, label: 'MVPs' },
  { re: /\b(\d+|one|two|three|four|five|six) Super Bowl MVPs?\b/gi, get: (p) => p.sbmvp, label: 'SB MVPs' },
];
for (const [who, text] of Object.entries(speeches)) {
  const p = byName.get(who);
  if (!p) continue;
  for (const c of statChecks) {
    for (const m of text.matchAll(c.re)) {
      const said = num(m[1]);
      // Only flag claims about him: skip sentences naming another player right before the number
      const before = text.slice(Math.max(0, m.index! - 60), m.index);
      if (/[A-Z][a-z]+ [A-Z][a-z]+(?:'s)?[^.]*$/.test(before) && !before.includes(who.split(' ').pop()!)) continue;
      if (Number.isFinite(said) && said !== c.get(p) && said < 10000)
        warnings.push(`Speech for ${who} says "${m[0]}", data has ${c.get(p)} ${c.label}`);
    }
  }
}

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
for (const [who, s] of Object.entries(extras.stints ?? {}) as [string, { stints: { rings?: number[] }[]; preLeagueRings?: number }][]) {
  const p = byName.get(who);
  if (!p) continue;
  // Imported real-NFL players carry their real rings on the card (preLeagueRings)
  const rings = s.stints.reduce((n, st) => n + (st.rings?.length ?? 0), 0) + (s.preLeagueRings ?? 0);
  if (rings !== p.rings) warnings.push(`Stints for ${who} account for ${rings} rings; he has ${p.rings}`);
}

// 8. Speeches exist only for Hall of Famers
Object.keys(speeches).forEach((who) => {
  const p = byName.get(who);
  if (!p) errors.push(`Speech for ${who}, who is not a league player`);
  else if (!isHallOfFamer(p)) errors.push(`Speech for ${who}, who is not a Hall of Famer (Career Legacy ${Math.round(p.careerLegacy)})`);
});

// 9. Upload pipeline: manifests are well formed, and owner text traces back to an applied manifest
type Mutation = { lane?: string; op?: string; target?: string; value?: unknown; source?: string; reason?: string; trigger?: string };
type Manifest = { id: string; ai_steps?: { step?: string; reason?: string; trigger?: string }[]; mutations?: Mutation[] };
const AI_STEPS = new Set(['transcribe', 'portrait→look', 'tag notes', 'speech', 'art']);
const manifests = new Map<string, Manifest>();
if (existsSync('data/uploads')) {
  for (const dir of readdirSync('data/uploads').sort()) {
    const f = `data/uploads/${dir}/manifest.json`;
    if (!existsSync(f)) continue;
    const m = read(f) as Manifest;
    manifests.set(m.id, m);
    (m.ai_steps ?? []).forEach((st) => {
      if (!AI_STEPS.has(st.step ?? '')) errors.push(`Upload ${m.id}: AI step "${st.step}" is not allowed`);
      if (!st.reason || !st.trigger) errors.push(`Upload ${m.id}: AI step "${st.step}" has no reason or trigger`);
    });
    (m.mutations ?? []).forEach((mu, i) => {
      const missing = (['lane', 'op', 'target', 'source', 'reason', 'trigger'] as const).filter((k) => !mu[k]);
      if (missing.length) errors.push(`Upload ${m.id}: mutation ${i} (${mu.op} ${mu.target}) has no ${missing.join(', ')}`);
    });
  }
}
const log = existsSync('data/y80/mutations_log.json') ? (read('data/y80/mutations_log.json').applied as { id: string }[]) : [];
log.forEach((e) => !manifests.has(e.id) && errors.push(`mutations_log lists ${e.id}, but data/uploads has no such manifest`));
manifests.forEach((_, id) => !log.some((e) => e.id === id) && warnings.push(`Upload ${id} is not applied yet (npm run apply-upload)`));

// Expected owner text, replaying the applied manifests in order: nicknames, owner tags, card notes, owner quotes, journal
const TEXT_KEYS = new Set(['nick', 'tag', 'note', 'says', 'card_design', 'text']);
const expected = new Map<string, string>();
const setLeaves = (path: string, v: unknown) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) Object.entries(v).forEach(([k, x]) => setLeaves(`${path}/${k}`, x));
  else if (typeof v === 'string' && TEXT_KEYS.has(path.split('/').pop()!)) expected.set(path, v);
};
for (const { id } of log) {
  for (const mu of manifests.get(id)?.mutations ?? []) {
    if (mu.op === 'player.set') setLeaves(`player/${String(mu.target).split(/:(.+)/)[1]}`, mu.value);
    else if (mu.op === 'fact.set') setLeaves(String(mu.target), mu.value);
    else if (mu.op === 'card.design') setLeaves(`players/${mu.target}/card_design`, mu.value);
    else if (mu.op === 'journal.add') setLeaves(`journal/${mu.target}`, mu.value);
  }
}
const actual = new Map<string, string>();
const collect = (path: string, v: unknown) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) Object.entries(v).forEach(([k, x]) => collect(`${path}/${k}`, x));
  else if (typeof v === 'string' && TEXT_KEYS.has(path.split('/').pop()!)) actual.set(path, v);
};
(read('data/y80/players.json') as { n: string; nick?: string; legend?: boolean }[])
  .filter((p) => !p.legend && p.nick)
  .forEach((p) => actual.set(`player/${p.n}/nick`, p.nick!));
const facts = read('data/y80/owner_facts.json');
collect('players', facts.players ?? {});
if (existsSync('data/y80/journal.json')) (read('data/y80/journal.json').notes ?? []).forEach((n: { id: string; text: string }) => actual.set(`journal/${n.id}/text`, n.text));
actual.forEach((v, path) => {
  if (!expected.has(path)) errors.push(`${path} is not set by any applied upload manifest (edit data only through npm run apply-upload)`);
  else if (expected.get(path) !== v) errors.push(`${path} differs from the last applied upload manifest`);
});
expected.forEach((_, path) => !actual.has(path) && warnings.push(`${path} was set by an upload but is missing from the data now`));

warnings.forEach((w) => console.log(`warn  ${w}`));
errors.forEach((e) => console.log(`ERROR ${e}`));
console.log(`\naudit: ${league.length} players, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
