/**
 * Data audit: finds hand-written facts that no longer agree with the league data, so a stats update can't leave
 * stale text behind, and checks the upload pipeline (each data/uploads bundle manifest and data/y80/mutations_log.json):
 * every mutation has a source, reason and trigger, only the allowed AI steps appear, and every owner text field
 * traces back to an applied manifest. Run after any data change (`npm run audit`); the deploy workflow runs it too.
 *
 * Exit code 1 only on errors (things that are certainly wrong); warnings are printed for a human to judge.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { parseCSV } from '@/utils/csvParser';
import { normalizeLeague, isHallOfFamer } from '@/config/stats';
import { findNFLTeam, NFL_TEAMS } from '@/utils/nflTeams';
import type { Player } from '@/types/player';
import { MARKET_FORMAT, expandMarket } from '@/utils/marketHistory';

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
// A new card the owner hasn't placed yet has team "UNK" in players.json (blank in the CSV). CLAUDE.md says add it and
// ask the owner, so that is a warning; any other missing team is an error.
const unplaced = new Set((read('data/y80/players.json') as { n: string; team?: string }[])
  .filter((p) => p.team === 'UNK').map((p) => p.n));
// A free agent (owner fact team "FA") has no club on purpose: blank in the CSV, banner = where he was best known.
const freeAgents = new Set(Object.entries((read('data/y80/owner_facts.json') as { players?: Record<string, { team?: string }> })
  .players ?? {}).filter(([, f]) => f.team === 'FA').map(([n]) => n));
league.filter((p) => !findNFLTeam(p.team) && !freeAgents.has(p.name)).forEach((p) =>
  unplaced.has(p.name)
    ? warnings.push(`No team yet: ${p.position} ${p.name} (UNK in players.json: ask the owner)`)
    : errors.push(`No team: ${p.position} ${p.name}`));

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

// 3b. Clubs the owner says a player never played for (owner_facts career.never) must not appear in his stints, his
// speech or his card note, even as an opponent; a single-club order with no trade ("only a Lion") pins every stint
type CareerFact = { never?: string[]; order?: string[]; next_team?: string };
const ownerPlayers = (read('data/y80/owner_facts.json').players ?? {}) as Record<string, { career?: CareerFact; team?: string }>;
for (const [who, f] of Object.entries(ownerPlayers)) {
  const never = new Set((f.career?.never ?? []).map((t) => findNFLTeam(t)?.id).filter(Boolean));
  const stintTeams = (extras.stints?.[who]?.stints ?? []).map((s: { team: string }) => s.team as string);
  stintTeams.filter((t: string) => never.has(findNFLTeam(t)?.id)).forEach((t: string) => errors.push(`Stints for ${who} include the ${t}; the owner says he never played for them`));
  // a later owner team fact for another club (traded on after the order was given) lifts the single-club pin
  const movedOn = !!f.team && !!findNFLTeam(f.team) && findNFLTeam(f.team)?.id !== findNFLTeam(f.career?.order?.[0] ?? '')?.id;
  const only = f.career?.order?.length === 1 && !f.career.next_team && !movedOn ? findNFLTeam(f.career.order[0])?.id : undefined;
  if (only) stintTeams.filter((t: string) => findNFLTeam(t)?.id !== only).forEach((t: string) => errors.push(`Stints for ${who} include the ${t}; the owner says he only played for the ${f.career!.order![0]}`));
  if (!never.size) continue;
  const texts: [string, unknown][] = [['Speech', speeches[who]], ['Card note', extras.cards?.[who]?.note]];
  for (const [where, text] of texts) {
    if (typeof text !== 'string') continue;
    const named = teamsNamed(text).filter((t) => never.has(t.id));
    if (named.length) errors.push(`${where} for ${who} names ${named.map((t) => t.n).join(', ')}; the owner says he never played for them`);
  }
}

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

// 5b. Signature team (card / banner identity) is a real franchise the player has a stint with. An active player
// wears his current team (owner rule: the banner follows a current player; best years only once he retires), so an
// owner signature_team fact that differs is expected while he plays and is never flagged.
for (const [who, team] of Object.entries(extras.signatureTeams ?? {}) as [string, string][]) {
  const p = byName.get(who);
  const id = findNFLTeam(team)?.id;
  if (!p) warnings.push(`Signature team for unknown player ${who}`);
  else if (!id) errors.push(`Signature team for ${who} is not a franchise: ${team}`);
  else if (p.status !== 'Retired' && !freeAgents.has(who) && findNFLTeam(p.team)?.id !== id)
    errors.push(`Signature team for active ${who} is the ${team}, but his current team is the ${p.team}`);
  else if (p.status !== 'Retired') continue;
  else {
    const stintIds = new Set((extras.stints?.[who]?.stints ?? []).map((s: { team: string }) => findNFLTeam(s.team)?.id));
    if (stintIds.size ? !stintIds.has(id) : !franchisesOf(p).has(id))
      warnings.push(`Signature team for ${who} is the ${team}, but he has no stint there`);
  }
}

// 5c. The owner's current club agrees everywhere: coach.json currentStint (or the last coached season) and
// owner_facts.json current_club (the club "CUR" on the sheet resolves to)
{
  const coach = read('data/y80/coach.json');
  const club = coach.currentStint?.team ?? coach.seasons?.at(-1)?.team;
  const facts = read('data/y80/owner_facts.json');
  if (club && facts.current_club && findNFLTeam(club)?.id !== findNFLTeam(facts.current_club)?.id)
    errors.push(`Current club disagrees: coach.json says the ${club}, owner_facts.json current_club the ${facts.current_club}`);
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
const AI_STEPS = new Set(['transcribe', 'portrait→look', 'tag notes', 'speech', 'art', 'story', 'takes', 'tribute']);
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
const speechSet = new Map<string, string>();
const storySet = new Map<string, unknown>();
const takesSet = new Map<string, unknown>();
const tributeSet = new Map<string, unknown>();
let saveState: { id: string; upload: string; value: Record<string, unknown> } | null = null;
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
    else if (mu.op === 'speech.set') speechSet.set(String(mu.target), String((mu.value as { text?: string })?.text ?? ''));
    else if (mu.op === 'speech.remove') speechSet.delete(String(mu.target));
    else if (mu.op === 'story.set') storySet.set(String(mu.target), { ...(mu.value as object), upload: id });
    else if (mu.op === 'story.remove') storySet.delete(String(mu.target));
    else if (mu.op === 'takes.set') takesSet.set(String(mu.target), { ...(mu.value as object), upload: id });
    else if (mu.op === 'tribute.set') tributeSet.set(String(mu.target), { ...(mu.value as object), upload: id });
    else if (mu.op === 'tribute.remove') tributeSet.delete(String(mu.target));
    else if (mu.op === 'save.state') saveState = { id: String(mu.target), upload: id, value: mu.value as Record<string, unknown> };
  }
}
// Speeches rewritten through an upload (speech.set) must still read exactly as the last applied manifest wrote them
speechSet.forEach((text, who) => {
  if (speeches[who] === undefined) warnings.push(`Speech for ${who} was set by an upload but is missing from the data now`);
  else if (speeches[who] !== text) errors.push(`Speech for ${who} differs from the last applied upload manifest (edit speeches through speech.set)`);
});
// Season stories (the third AI-authored lane) must read exactly as the last applied story.set wrote them, and pass the
// story rules: tags exist, every stats[] figure resolves to its source (a mismatch after a later update is a stale
// warning, as with speech numbers), no em dashes, lengths, numbers in the text cited in stats[] (scripts/story_check.py)
{
  const stories = (existsSync('data/y80/stories.json') ? read('data/y80/stories.json').seasons : {}) ?? {};
  const canon = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
  storySet.forEach((value, season) => {
    if (!stories[season]) warnings.push(`Story for ${season} was set by an upload but is missing from the data now`);
    else if (canon(stories[season]) !== canon(value)) errors.push(`Story for ${season} differs from the last applied upload manifest (edit stories through story.set)`);
  });
  Object.keys(stories).forEach((season) => !storySet.has(season) && errors.push(`Story for ${season} is not set by any applied upload manifest`));
  try {
    const out = JSON.parse(execFileSync('python3', ['scripts/story_check.py', '--audit'], { encoding: 'utf8' })) as { errors: string[]; warnings: string[] };
    out.errors.forEach((e) => errors.push(`Story ${e}`));
    out.warnings.forEach((w) => warnings.push(w));
  } catch (e) {
    errors.push(`Story check failed to run (python3 scripts/story_check.py --audit): ${(e as Error).message.split('\n')[0]}`);
  }
}
// Season story files (public/data/league/stories/<Y>.json): content.json keeps only an index; every index entry has
// its file, every file has its entry, and each file is the story in data/y80/stories.json as the index describes it
{
  const stories = (existsSync('data/y80/stories.json') ? read('data/y80/stories.json').seasons : {}) ?? {};
  const dir = 'public/data/league/stories';
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const index = (content.seasonStoryIndex ?? []) as { season: string; file: string; articleCount: number; lead?: { id: string }; articles: { id: string }[] }[];
  if (content.seasonStories) errors.push('content.json still embeds seasonStories (the stories live in public/data/league/stories/; rebuild)');
  index.forEach((e) => {
    const path = `public/data/league/${e.file}`;
    if (e.file !== `stories/${e.season}.json`) errors.push(`Story index ${e.season} points at ${e.file}, not stories/${e.season}.json`);
    if (!existsSync(path)) return errors.push(`Story index ${e.season} has no file ${path} (rebuild)`);
    const s = read(path);
    if (s.season !== e.season) errors.push(`${path} is the story for ${s.season}, not ${e.season}`);
    if ((s.articles ?? []).length !== e.articleCount || JSON.stringify((s.articles ?? []).map((a: { id: string }) => a.id)) !== JSON.stringify(e.articles.map((a) => a.id)))
      errors.push(`${path} articles differ from the content.json index (rebuild)`);
    if (e.lead?.id && !(s.articles ?? []).some((a: { id: string; kind: string }) => a.id === e.lead!.id && a.kind === 'lead')) errors.push(`Story index ${e.season} lead ${e.lead.id} is not the file's lead`);
    if (!stories[e.season]) errors.push(`Story index has ${e.season}, which data/y80/stories.json does not`);
    else if (JSON.stringify(stories[e.season].articles) !== JSON.stringify(s.articles) || JSON.stringify(stories[e.season].didYouKnow ?? []) !== JSON.stringify(s.didYouKnow ?? []))
      errors.push(`${path} differs from data/y80/stories.json (rebuild)`);
  });
  files.forEach((f) => !index.some((e) => e.file === `stories/${f}`) && errors.push(`${dir}/${f} has no entry in content.json seasonStoryIndex (rebuild)`));
  Object.keys(stories).forEach((y) => !index.some((e) => e.season === y) && errors.push(`Story for ${y} is missing from the content.json story index (rebuild)`));
}
// Season Rewind (scripts/season_rewind.py, rules only): every index entry has its file and every file its entry; every
// player a card names has a league card, every club is one of the 32, and a quoted card's link points at a written
// piece that exists (the story's lead, a take, a tribute)
{
  const dir = 'public/data/league/rewind';
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const index = (content.seasonRewindIndex ?? []) as { season: string; file: string; count: number; kinds: string[] }[];
  const club = (t: unknown, where: string) => {
    if (t !== undefined && t !== null && !NFL_TEAMS.some((x) => x.name === t)) errors.push(`${where}: club "${String(t)}" is not one of the 32`);
  };
  type RP = { key?: string; name?: string; team?: string; holder?: string };
  const person = (p: RP, where: string) => {
    if (!p.name || !byName.has(p.name) || p.key !== `${byName.get(p.name)!.position}:${p.name}`) errors.push(`${where} names ${p.key ?? p.name} without a card`);
    if (p.holder && !byName.has(p.holder)) errors.push(`${where} names ${p.holder} (a mark's holder) without a card`);
    club(p.team, where);
  };
  const takeIds = new Set(((content.hotTakesIndex ?? []) as { takes: { id: string }[] }[]).flatMap((s) => s.takes.map((t) => t.id)));
  const leadIds = new Set(((content.seasonStoryIndex ?? []) as { lead?: { id: string } }[]).map((s) => s.lead?.id).filter(Boolean));
  const tributeKeys = new Set(((content.tributeIndex ?? []) as { key: string }[]).map((t) => t.key));
  const rivalryIds = new Set(((content.rivalryFiles ?? []) as { id: string }[]).map((f) => f.id));
  index.forEach((e) => {
    const path = `public/data/league/${e.file}`;
    if (e.file !== `rewind/${e.season}.json`) errors.push(`Rewind index ${e.season} points at ${e.file}, not rewind/${e.season}.json`);
    if (!existsSync(path)) return errors.push(`Rewind index ${e.season} has no file ${path} (rebuild)`);
    const r = read(path);
    if (r.season !== e.season) errors.push(`${path} is the rewind for ${r.season}, not ${e.season}`);
    const cards = (r.cards ?? []) as { id: string; kind: string; club?: string; teams?: string[]; players?: RP[]; rows?: { players?: RP[]; team?: string }[]; upset?: { winner: string; loser: string }; live?: { club: string }; link?: { story?: string; take?: string; tribute?: string; rivalry?: string } }[];
    if (cards.length !== e.count || JSON.stringify(cards.map((c) => c.kind)) !== JSON.stringify(e.kinds)) errors.push(`${path} cards differ from the content.json rewind index (rebuild)`);
    if (cards[0]?.kind !== 'cover' || cards.at(-1)?.kind !== 'outro') errors.push(`${path} must open with its cover and end with its outro`);
    club(r.club, path);
    club(r.champion, path);
    cards.forEach((c) => {
      const where = `${path} ${c.id}`;
      club(c.club, where);
      (c.teams ?? []).forEach((t) => club(t, where));
      (c.players ?? []).forEach((p) => person(p, where));
      (c.rows ?? []).forEach((row) => {
        club(row.team, where);
        (row.players ?? []).forEach((p) => person(p, where));
      });
      if (c.upset) [c.upset.winner, c.upset.loser].forEach((t) => club(t, where));
      if (c.live) club(c.live.club, where);
      if (c.link?.story && !leadIds.has(c.link.story)) errors.push(`${where} links story ${c.link.story}, not a Season Story lead`);
      if (c.link?.take && !takeIds.has(c.link.take)) errors.push(`${where} links take ${c.link.take}, which does not exist`);
      if (c.link?.tribute && !tributeKeys.has(c.link.tribute)) errors.push(`${where} links tribute ${c.link.tribute}, which is not written`);
      if (c.link?.rivalry && !rivalryIds.has(c.link.rivalry)) errors.push(`${where} links rivalry file ${c.link.rivalry}, which does not exist`);
    });
  });
  files.forEach((f) => !index.some((e) => e.file === `rewind/${f}`) && errors.push(`${dir}/${f} has no entry in content.json seasonRewindIndex (rebuild)`));
}
// Rivalry files (build_league_content.py build_rivalry_files, rules only): every club is one of the 32, every star a
// league player with a card on the club he stands for, the series adds up (record, points, meeting count), a lasting
// file met in one of the last two completed seasons and a lapsed one did not, exactly one meeting is the biggest
// margin, every paper is a written story or take that names the rival, and each file's rivalry in content.json
// rivalries points back at it
{
  type RF = {
    id: string; team: string; coachTeam: string; status: string; games: number; last: string;
    record: { w: number; l: number; t: number };
    pointsFor: number; pointsAgainst: number;
    stars?: Record<string, { key: string; name: string; team: string }>;
    meetings: { season: string; coachTeam: string; for: number; against: number; result: string; biggest?: boolean }[];
    papers: { type: string; id: string }[];
  };
  const files = (content.rivalryFiles ?? []) as RF[];
  const club = (t: unknown, where: string) => {
    if (!NFL_TEAMS.some((x) => x.name === t)) errors.push(`${where}: club "${String(t)}" is not one of the 32`);
  };
  const lastSeason = Math.max(...((content.coach?.seasons ?? []) as { year: number }[]).map((s) => s.year));
  const takeIds = new Set(((content.hotTakesIndex ?? []) as { takes: { id: string }[] }[]).flatMap((s) => s.takes.map((t) => t.id)));
  const articleIds = new Set(((content.seasonStoryIndex ?? []) as { articles: { id: string }[] }[]).flatMap((s) => s.articles.map((a) => a.id)));
  const seen = new Set<string>();
  files.forEach((f) => {
    const where = `content.json rivalryFiles ${f.id}`;
    if (seen.has(f.id)) errors.push(`${where} appears twice`);
    seen.add(f.id);
    club(f.team, where);
    club(f.coachTeam, where);
    f.meetings.forEach((m) => club(m.coachTeam, where));
    Object.entries(f.stars ?? {}).forEach(([side, s]) => {
      const p = byName.get(s.name);
      if (!p || `${p.position}:${p.name}` !== s.key) errors.push(`${where} ${side} star ${s.key} has no card`);
      club(s.team, where);
    });
    const count = (r: string) => f.meetings.filter((m) => m.result === r).length;
    if (f.meetings.length !== f.games || count('W') !== f.record.w || count('L') !== f.record.l || count('T') !== f.record.t)
      errors.push(`${where}: the record does not add up to its meetings (rebuild)`);
    if (f.meetings.reduce((s, m) => s + m.for, 0) !== f.pointsFor || f.meetings.reduce((s, m) => s + m.against, 0) !== f.pointsAgainst)
      errors.push(`${where}: the points do not add up to its meetings (rebuild)`);
    if (f.meetings.filter((m) => m.biggest).length !== 1) errors.push(`${where}: exactly one meeting must be the biggest margin`);
    const recent = f.meetings.some((m) => Number(m.season.slice(1)) >= lastSeason - 1);
    if ((f.status === 'lasting') !== recent) errors.push(`${where}: status ${f.status} but ${recent ? 'met' : 'did not meet'} in the last two completed seasons`);
    f.papers.forEach((p) => {
      if (p.type === 'story' ? !articleIds.has(p.id) : !takeIds.has(p.id)) errors.push(`${where} cites ${p.type} ${p.id}, which does not exist`);
    });
    const r = ((content.rivalries ?? []) as { team?: string; file?: string }[]).find((x) => x.team === f.team);
    if (!r || r.file !== f.id) errors.push(`${where}: its club has no rivalry in content.json rivalries pointing at it (rebuild)`);
  });
  ((content.rivalries ?? []) as { id: string; file?: string }[]).forEach((r) => {
    if (r.file && !seen.has(r.file)) errors.push(`content.json rivalry ${r.id} points at rivalry file ${r.file}, which does not exist`);
  });
}
// Hot Takes (the fourth AI-authored lane) get the same treatment: data/y80/hot_takes.json reads exactly as the last
// applied takes.set wrote each season, every take passes the story rules (scripts/story_check.py --audit-takes; a
// figure that no longer matches is a stale warning), and the site's copy (public/data/league/takes.json, newest first)
// and the content.json index agree with it
{
  const takes = ((existsSync('data/y80/hot_takes.json') ? read('data/y80/hot_takes.json').seasons : {}) ?? {}) as Record<string, { upload?: string; intro?: string; takes: { id: string; heat: number; headline: string }[] }>;
  const canon = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
  takesSet.forEach((value, season) => {
    if (!takes[season]) warnings.push(`Hot takes for ${season} were set by an upload but are missing from the data now`);
    else if (canon(takes[season]) !== canon(value)) errors.push(`Hot takes for ${season} differ from the last applied upload manifest (edit them through takes.set)`);
  });
  Object.keys(takes).forEach((season) => !takesSet.has(season) && errors.push(`Hot takes for ${season} are not set by any applied upload manifest`));
  try {
    const out = JSON.parse(execFileSync('python3', ['scripts/story_check.py', '--audit-takes'], { encoding: 'utf8' })) as { errors: string[]; warnings: string[] };
    out.errors.forEach((e) => errors.push(`Hot takes ${e}`));
    out.warnings.forEach((w) => warnings.push(w));
  } catch (e) {
    errors.push(`Hot takes check failed to run (python3 scripts/story_check.py --audit-takes): ${(e as Error).message.split('\n')[0]}`);
  }
  const seasons = Object.keys(takes).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
  const expectedFile = seasons.map((y) => ({ season: y, upload: takes[y].upload, ...(takes[y].intro ? { intro: takes[y].intro } : {}), takes: takes[y].takes }));
  const path = 'public/data/league/takes.json';
  if (!seasons.length) {
    if (existsSync(path)) errors.push(`${path} exists but data/y80/hot_takes.json has no takes (rebuild)`);
  } else if (!existsSync(path)) errors.push(`${path} is missing (npm run rebuild writes it)`);
  else if (canon(read(path).seasons) !== canon(expectedFile)) errors.push(`${path} differs from data/y80/hot_takes.json (rebuild)`);
  const index = (content.hotTakesIndex ?? []) as { season: string; count: number; takes: { id: string }[] }[];
  if (JSON.stringify(index.map((e) => e.season)) !== JSON.stringify(seasons)) errors.push('content.json hotTakesIndex seasons differ from data/y80/hot_takes.json (rebuild)');
  index.forEach((e) => {
    const t = takes[e.season]?.takes ?? [];
    if (e.count !== t.length || JSON.stringify(e.takes.map((x) => x.id)) !== JSON.stringify(t.map((x) => x.id))) errors.push(`content.json hotTakesIndex ${e.season} differs from its takes (rebuild)`);
  });
}
// Player Tributes (the fifth AI-authored lane) get the same treatment: data/y80/tributes.json reads exactly as the last
// applied tribute.set wrote each player's, every chapter passes the story rules (scripts/story_check.py
// --audit-tributes; a figure that no longer matches is a stale warning), and the site's copy (one file per tribute,
// public/data/league/tributes/<pos-name>.json, the stored text plus figures filled from the data under each chapter's
// `data`) and the content.json tributeIndex agree with it
{
  type Chapter = { id: string; kind: string; headline: string; data?: unknown };
  type Tribute = { upload?: string; nickname?: string; deck: string; chapters: Chapter[] };
  const tributes = ((existsSync('data/y80/tributes.json') ? read('data/y80/tributes.json').players : {}) ?? {}) as Record<string, Tribute>;
  const canon = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
  tributeSet.forEach((value, key) => {
    if (!tributes[key]) warnings.push(`Tribute for ${key} was set by an upload but is missing from the data now`);
    else if (canon(tributes[key]) !== canon(value)) errors.push(`Tribute for ${key} differs from the last applied upload manifest (edit it through tribute.set)`);
  });
  Object.keys(tributes).forEach((key) => !tributeSet.has(key) && errors.push(`Tribute for ${key} is not set by any applied upload manifest`));
  try {
    const out = JSON.parse(execFileSync('python3', ['scripts/story_check.py', '--audit-tributes'], { encoding: 'utf8' })) as { errors: string[]; warnings: string[] };
    out.errors.forEach((e) => errors.push(`Tribute ${e}`));
    out.warnings.forEach((w) => warnings.push(w));
  } catch (e) {
    errors.push(`Tribute check failed to run (python3 scripts/story_check.py --audit-tributes): ${(e as Error).message.split('\n')[0]}`);
  }
  const fileOf = (key: string) => `tributes/${key.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.json`;
  const index = (content.tributeIndex ?? []) as { key: string; file: string; chapters: { id: string }[] }[];
  const dir = 'public/data/league/tributes';
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  if (JSON.stringify(index.map((e) => e.key)) !== JSON.stringify(Object.keys(tributes).sort())) errors.push('content.json tributeIndex differs from data/y80/tributes.json (rebuild)');
  index.forEach((e) => {
    const path = `public/data/league/${e.file}`;
    if (e.file !== fileOf(e.key)) errors.push(`Tribute index ${e.key} points at ${e.file}, not ${fileOf(e.key)}`);
    if (!existsSync(path)) return errors.push(`Tribute index ${e.key} has no file ${path} (rebuild)`);
    const site = read(path) as Tribute & { key: string };
    const t = tributes[e.key];
    if (!t) return;
    const text = (c: Chapter) => {
      const rest = { ...c };
      delete rest.data;
      return rest;
    };
    if (site.key !== e.key || site.deck !== t.deck || (site.nickname ?? null) !== (t.nickname ?? null) || site.upload !== t.upload || canon(site.chapters.map(text)) !== canon(t.chapters))
      errors.push(`${path} differs from data/y80/tributes.json (rebuild)`);
    site.chapters.forEach((c) => ['trade', 'market', 'rival'].includes(c.kind) && !c.data && errors.push(`${path} ${c.id}: the ${c.kind} card has no figures from the data (rebuild)`));
    if (JSON.stringify(e.chapters.map((c) => c.id)) !== JSON.stringify(t.chapters.map((c) => c.id))) errors.push(`content.json tributeIndex ${e.key} differs from its chapters (rebuild)`);
  });
  files.forEach((f) => !index.some((e) => e.file === `tributes/${f}`) && errors.push(`${dir}/${f} has no entry in content.json tributeIndex (rebuild)`));
  // One tribute a season (content.json tributePlan, build_league_content.py tribute_plan): the latest season's pick
  // waiting to be written is a warning, never an error; a pick named twice is a rule bug
  type Pick = { season: string; player: string; reason: string; written: boolean };
  const plan = (content.tributePlan ?? []) as Pick[];
  const latestPick = plan[plan.length - 1];
  if (latestPick && latestPick.season === content.season && !tributes[latestPick.player])
    warnings.push(`Tribute for ${latestPick.season} (${latestPick.player}, ${latestPick.reason}) is not written yet (CLAUDE.md, step 6c)`);
  if (new Set(plan.map((p) => p.player)).size !== plan.length) errors.push('content.json tributePlan picks a player twice (rebuild)');
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

// 10. The widget feed (public/data/widget.json, scripts/build_widget_data.py) exists, is current and well formed
// Weekly scores: every schedule.set season is in the generated schedule.json, with one game-log row per week
if (existsSync('data/y80/schedules.json')) {
  const raw = read('data/y80/schedules.json') as { seasons?: Record<string, { weeks?: unknown[] }> };
  const gen = existsSync('public/data/league/schedule.json')
    ? (read('public/data/league/schedule.json') as { seasons?: Record<string, { games?: unknown[]; coachGames?: { playoff?: boolean }[] }> })
    : null;
  for (const [y, s] of Object.entries(raw.seasons ?? {})) {
    const g = gen?.seasons?.[y];
    if (!g) errors.push(`schedule.json has no ${y} (npm run rebuild runs scripts/schedule_content.py)`);
    else if ((g.coachGames ?? []).filter((x) => !x.playoff).length !== (s.weeks ?? []).length)
      errors.push(`schedule.json ${y}: the coach's game log doesn't have one row per week`);
  }
}
// Live state from the game's save (save.state, scripts/save_read.py): data/y80/save_state.json is exactly the last
// applied save.state, the site's copy (public/data/league/save_state.json, scripts/save_state.py) matches it, every
// player key is a league player, and nothing the owner ruled out (morale, height/weight, the game's Hall of Fame) is in it
{
  const canon = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
  const file = 'data/y80/save_state.json';
  const site = 'public/data/league/save_state.json';
  const ss = saveState as { id: string; upload: string; value: Record<string, unknown> } | null;
  if (existsSync(file)) {
    const { _about: _a, ...stored } = read(file) as Record<string, unknown>;
    if (!ss) errors.push(`${file} is not set by any applied save.state upload (edit data only through npm run apply-upload)`);
    else if (canon(stored) !== canon({ id: ss.id, upload: ss.upload, ...ss.value })) errors.push(`${file} differs from the last applied save.state (${ss.upload})`);
    if (!existsSync(site)) errors.push(`${site} is missing (npm run rebuild runs scripts/save_state.py)`);
    else if (canon(read(site)) !== canon(stored)) errors.push(`${site} does not match ${file} (rebuild)`);
    const keys = new Set((read('data/y80/players.json') as { n: string; pos: string }[]).map((p) => `${p.pos}:${p.n}`));
    Object.keys((stored.players ?? {}) as object).forEach((k) => !keys.has(k) && errors.push(`${file} names ${k}, who is not in players.json`));
    const banned = /"(attitude|morale|height|weight|hof|hof_candidate)":/.exec(JSON.stringify(stored));
    if (banned) errors.push(`${file} carries "${banned[1]}" (owner: no morale meters, bio is age only, never the game's Hall of Fame)`);
  } else if (ss) warnings.push(`save.state ${ss.id} was applied but ${file} is missing`);
}
// Market history (changes only, utils/marketHistory.ts): both files expand, the latest snapshot is a full keyframe,
// and the site's market.json is the history minus the milestone totals, snapshot for snapshot
{
  const files = ['data/y80/market_history.json', 'public/data/market.json'] as const;
  const [hist, site] = files.map((f) => {
    if (!existsSync(f)) return null;
    const raw = read(f);
    if (!raw || Array.isArray(raw) || raw.format !== MARKET_FORMAT) errors.push(`${f} is not in the changes-only format ${MARKET_FORMAT} (npm run market rewrites it)`);
    else if (raw.snapshots?.length && !raw.snapshots.at(-1).players) errors.push(`${f}: the latest snapshot is not stored in full`);
    return expandMarket(raw);
  });
  if (hist && site) {
    const lean = hist.map((h) => ({ ...h, players: Object.fromEntries(Object.entries(h.players).map(([k, { s: _s, ...v }]) => [k, v])) }));
    if (JSON.stringify(lean) !== JSON.stringify(site)) errors.push('public/data/market.json does not match data/y80/market_history.json (npm run market)');
  }
}
if (!existsSync('public/data/widget.json')) errors.push('public/data/widget.json is missing (npm run rebuild writes it)');
else {
  try {
    const wj = read('public/data/widget.json');
    if (wj.season !== content.season) errors.push(`widget.json is for ${wj.season}, content.json for ${content.season} (rebuild)`);
    if (wj.edition?.seed !== content.edition?.seed) errors.push('widget.json edition differs from content.json (rebuild)');
    for (const k of ['stories', 'didYouKnow', 'vault', 'movers', 'headlines', 'spotlightFallback'])
      if (!Array.isArray(wj[k])) errors.push(`widget.json has no ${k} list`);
    const cards = wj.cards ?? {};
    const items = [...(wj.didYouKnow ?? []), ...(wj.vault ?? [])] as { text?: string; title?: string; player?: string }[];
    items.forEach((it) => {
      if (!it.text) errors.push(`widget.json item without text: ${JSON.stringify(it).slice(0, 80)}`);
      if (it.player && !cards[it.player]) errors.push(`widget.json names ${it.player} without a card`);
    });
    (wj.spotlightFallback ?? []).forEach((k: string) => !cards[k] && errors.push(`widget.json fallback ${k} has no card`));
    // Countdown panels and the lock screen (optional lists; the widget skips any that are missing)
    for (const k of ['hofWatch', 'chases', 'milestones']) {
      if (wj[k] === undefined) continue;
      if (!Array.isArray(wj[k])) { errors.push(`widget.json ${k} is not a list`); continue; }
      (wj[k] as { player?: string; toGo?: number; last?: string }[]).forEach((x) => {
        if (!x.player || !cards[x.player]) errors.push(`widget.json ${k} names ${x.player} without a card`);
        // a future Hall of Famer already over the bar has 0 to go (he goes in when he retires)
        const done = k === 'hofWatch' && typeof x.toGo === 'number' && x.toGo === 0;
        if (!(typeof x.toGo === 'number' && (x.toGo > 0 || done)) || !x.last) errors.push(`widget.json ${k} item is incomplete: ${JSON.stringify(x).slice(0, 80)}`);
      });
    }
    // Live-save countdowns (optional): final seasons and star ceilings, each a card player with his numbers
    for (const k of ['retirements', 'ceilings']) {
      if (wj[k] === undefined) continue;
      if (!Array.isArray(wj[k])) { errors.push(`widget.json ${k} is not a list`); continue; }
      (wj[k] as { player?: string; last?: string; seasonsLeft?: number; stars?: number; ceiling?: number }[]).forEach((x) => {
        if (!x.player || !cards[x.player]) errors.push(`widget.json ${k} names ${x.player} without a card`);
        const ok = k === 'retirements' ? typeof x.seasonsLeft === 'number' && x.seasonsLeft >= 0
          : typeof x.stars === 'number' && typeof x.ceiling === 'number' && x.ceiling > x.stars;
        if (!ok || !x.last) errors.push(`widget.json ${k} item is incomplete: ${JSON.stringify(x).slice(0, 80)}`);
      });
    }
    // Team colours: every item that names a player carries his club, and every club is one of the 32 (the widget's
    // colour table and logo map cover exactly those)
    const lists = ['didYouKnow', 'vault', 'movers', 'hofWatch', 'chases', 'milestones', 'retirements', 'ceilings', 'headlines', 'takes'];
    lists.forEach((k) => (wj[k] ?? []).forEach((x: { player?: string; key?: string; team?: string }) => {
      if ((x.player || x.key) && !x.team) errors.push(`widget.json ${k} item for ${x.player || x.key} has no team (names wear team colours)`);
      if (x.team && !NFL_TEAMS.some((t) => t.name === x.team)) errors.push(`widget.json ${k} team "${x.team}" is not one of the 32 clubs`);
    }));
    const takesIdx = (content.hotTakesIndex ?? []) as { season: string; count: number }[];
    if (takesIdx.length && (wj.takesSeason !== takesIdx[0].season || (wj.takes ?? []).length !== takesIdx[0].count))
      errors.push(`widget.json takes are not the latest Hot Takes (${takesIdx[0].season}; rebuild)`);
    (wj.takes ?? []).forEach((t: { headline?: string }) => /\b(your|you)\b/i.test(t.headline ?? '') && errors.push(`widget.json take says "you/your": ${t.headline}`));
    if (wj.champion && wj.champion.season !== content.season) errors.push(`widget.json champion is for ${wj.champion.season}, not ${content.season}`);
    // The large widget's days and the lock screen: every player named has a card and a club, every sprite is a file
    // in public/data/widget-sprites/ (scripts/widget_sprites.py), and the photo is the current season's champions
    type Named = { player?: string; team?: string; sprite?: string; sil?: string };
    const named: [string, Named][] = [
      ...((wj.spotlights ?? []) as Named[]).map((x): [string, Named] => ['spotlights', x]),
      ...((wj.photo?.players ?? []) as Named[]).map((x): [string, Named] => ['photo', x]),
      ...((wj.takes ?? []) as { players?: Named[] }[]).flatMap((t) => (t.players ?? []).map((x): [string, Named] => ['takes', x])),
      ...((wj.gauntlet?.holders ?? []) as Named[]).map((x): [string, Named] => ['gauntlet', x]),
      ...(wj.gauntlet?.closest ? [['gauntlet', wj.gauntlet.closest] as [string, Named]] : []),
    ];
    named.forEach(([k, x]) => {
      if (!x.player || !cards[x.player]) errors.push(`widget.json ${k} names ${x.player} without a card`);
      for (const f of [x.sprite, x.sil]) {
        if (f && !(f.startsWith('data/widget-sprites/') && existsSync(`public/${f}`))) errors.push(`widget.json ${k} sprite ${f} is not a file (rebuild)`);
      }
      if (k !== 'photo' && x.team && !NFL_TEAMS.some((t) => t.name === x.team)) errors.push(`widget.json ${k} team "${x.team}" is not one of the 32 clubs`);
    });
    if (wj.photo && wj.photo.season !== content.season && wj.photo.season !== wj.storySeason) errors.push(`widget.json photo is for ${wj.photo.season}, not the story's season`);
    // Widget cards name the coach ("Skura's Ravens"), never "you" / "your" (speech hooks are quoted verbatim)
    items.forEach((it) => {
      if ((it as { kind?: string }).kind === 'hof') return;
      if (/\b(your|you)\b/i.test(`${it.title ?? ''} ${it.text ?? ''}`)) errors.push(`widget.json says "you/your": ${(it.text ?? '').slice(0, 80)}`);
    });
    if ((wj.didYouKnow ?? []).length < 40) warnings.push(`widget.json has only ${(wj.didYouKnow ?? []).length} Did you know facts`);
  } catch (e) {
    errors.push(`public/data/widget.json is not valid JSON: ${(e as Error).message}`);
  }
}

warnings.forEach((w) => console.log(`warn  ${w}`));
errors.forEach((e) => console.log(`ERROR ${e}`));
console.log(`\naudit: ${league.length} players, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
