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
league.filter((p) => !findNFLTeam(p.team)).forEach((p) =>
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
const ownerPlayers = (read('data/y80/owner_facts.json').players ?? {}) as Record<string, { career?: CareerFact }>;
for (const [who, f] of Object.entries(ownerPlayers)) {
  const never = new Set((f.career?.never ?? []).map((t) => findNFLTeam(t)?.id).filter(Boolean));
  const stintTeams = (extras.stints?.[who]?.stints ?? []).map((s: { team: string }) => s.team as string);
  stintTeams.filter((t: string) => never.has(findNFLTeam(t)?.id)).forEach((t: string) => errors.push(`Stints for ${who} include the ${t}; the owner says he never played for them`));
  const only = f.career?.order?.length === 1 && !f.career.next_team ? findNFLTeam(f.career.order[0])?.id : undefined;
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
  else if (p.status !== 'Retired' && findNFLTeam(p.team)?.id !== id)
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
const AI_STEPS = new Set(['transcribe', 'portrait→look', 'tag notes', 'speech', 'art', 'story']);
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
        if (!(typeof x.toGo === 'number' && x.toGo > 0) || !x.last) errors.push(`widget.json ${k} item is incomplete: ${JSON.stringify(x).slice(0, 80)}`);
      });
    }
    // Team colours: every item that names a player carries his club, and every club is one of the 32 (the widget's
    // colour table and logo map cover exactly those)
    const lists = ['didYouKnow', 'vault', 'movers', 'hofWatch', 'chases', 'milestones', 'headlines'];
    lists.forEach((k) => (wj[k] ?? []).forEach((x: { player?: string; key?: string; team?: string }) => {
      if ((x.player || x.key) && !x.team) errors.push(`widget.json ${k} item for ${x.player || x.key} has no team (names wear team colours)`);
      if (x.team && !NFL_TEAMS.some((t) => t.name === x.team)) errors.push(`widget.json ${k} team "${x.team}" is not one of the 32 clubs`);
    }));
    if (wj.champion && wj.champion.season !== content.season) errors.push(`widget.json champion is for ${wj.champion.season}, not ${content.season}`);
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
