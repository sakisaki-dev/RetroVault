/**
 * Induction speeches.
 *
 * 1. If content.json has `speeches[<player name>]` (written offline, e.g. by an AI, and uploaded with
 *    the league history on the Timeline tab), that text is used as-is.
 * 2. Otherwise a speech is assembled from the player's real data only: nickname, era, franchise,
 *    awards, signature stats, family ties, former names and editorial tags/storylines. Eight templates
 *    keep a class from sounding the same. Nothing is invented and active/retired status is never
 *    mentioned.
 */
import type { Player, Position } from '@/types/player';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { isDefensivePosition } from '@/config/stats';
import { normalizeName, matchPlayerByName, type LeagueContent } from '@/utils/leagueContent';
import { getFamilyTies, normalizeName as extrasKey, type IndexedExtras } from '@/utils/playerExtras';

export interface SpeechStat {
  label: string;
  value: number;
}

export interface SpeechFacts {
  name: string;
  first: string;
  last: string;
  nickname?: string;
  position: Position;
  positionName: string;
  /** "Buffalo Bills" (or the raw team string) */
  team?: string;
  era?: string;
  tag?: string;
  storyline?: string;
  rings: number;
  mvp: number;
  opoy: number;
  opoyLabel: string;
  sbmvp: number;
  roty: number;
  games: number;
  legacy: number;
  signature: SpeechStat[];
  family: { label: string; name: string }[];
  formerName?: string;
  retired?: { number: number; teamLabel: string };
}

export interface Speech {
  paragraphs: string[];
  source: 'content' | 'generated';
  /** Which template produced it (generated only) */
  template?: string;
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

const SIGNATURE: Record<Position, { key: string; label: string }[]> = {
  QB: [
    { key: 'passYds', label: 'passing yards' },
    { key: 'passTD', label: 'touchdown passes' },
    { key: 'rushYds', label: 'rushing yards' },
  ],
  RB: [
    { key: 'rushYds', label: 'rushing yards' },
    { key: 'rushTD', label: 'rushing touchdowns' },
    { key: 'recYds', label: 'receiving yards' },
  ],
  WR: [
    { key: 'recYds', label: 'receiving yards' },
    { key: 'recTD', label: 'touchdown catches' },
    { key: 'receptions', label: 'receptions' },
  ],
  TE: [
    { key: 'recYds', label: 'receiving yards' },
    { key: 'recTD', label: 'touchdown catches' },
    { key: 'receptions', label: 'receptions' },
  ],
  OL: [{ key: 'blocks', label: 'blocks' }],
  LB: [
    { key: 'tackles', label: 'tackles' },
    { key: 'sacks', label: 'sacks' },
    { key: 'interceptions', label: 'interceptions' },
  ],
  DB: [
    { key: 'interceptions', label: 'interceptions' },
    { key: 'tackles', label: 'tackles' },
    { key: 'forcedFumbles', label: 'forced fumbles' },
  ],
  DL: [
    { key: 'sacks', label: 'sacks' },
    { key: 'tackles', label: 'tackles' },
    { key: 'forcedFumbles', label: 'forced fumbles' },
  ],
};

export const signatureStats = (p: Player): SpeechStat[] =>
  SIGNATURE[p.position]
    .map(({ key, label }) => ({ label, value: Math.round(Number((p as unknown as Record<string, unknown>)[key]) || 0) }))
    .filter((s) => s.value > 0);

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] ?? name, last: parts.length > 1 ? parts[parts.length - 1] : name };
};

/** "Waller–Finney era · Y15–30" -> "Waller–Finney era" */
const eraName = (raw?: string) => raw?.split('·')[0].trim() || undefined;

/** Drop trailing sentence punctuation so the templates control it ("Him." -> "Him"). */
const trimEnd = (s?: string) => s?.trim().replace(/[.!?]+$/, '') || undefined;

const COMMON_ERA_WORDS = new Set(['real-roster', 'modern', 'current', 'early', 'late', 'golden', 'expansion']);
/** "Real-roster era" -> "real-roster era" (reads as "the real-roster era"); proper names stay. */
const displayEra = (name?: string) => {
  if (!name) return undefined;
  const firstWord = name.split(/\s+/)[0].toLowerCase();
  return COMMON_ERA_WORDS.has(firstWord) ? name[0].toLowerCase() + name.slice(1) : name;
};

const titleCase = (s: string) =>
  /[a-z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s–-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

export const buildSpeechFacts = (
  player: Player,
  opts: {
    content?: LeagueContent | null;
    extras?: IndexedExtras | null;
    teamName?: string | null;
    retired?: { number: number; teamLabel: string } | null;
  },
): SpeechFacts => {
  const { content, extras } = opts;
  const note = content?.playerNotes.find((n) => normalizeName(n.name) === normalizeName(player.name) && (!n.position || n.position === player.position))
    ?? (content ? matchPlayerByName(player.name, content.playerNotes) : undefined);
  // Only real era names (note.era can also be a path like "Bills → Seahawks")
  const noteEra = eraName(note?.era);
  const era = displayEra(
    content?.eras.find((e) => noteEra && normalizeName(e.name) === normalizeName(noteEra))?.name ??
      content?.eras.find((e) => e.keyPlayers.some((k) => normalizeName(k) === normalizeName(player.name)))?.name,
  );
  const story = content?.storylines.find((s) => s.players.some((n) => normalizeName(n) === normalizeName(player.name)));
  const { first, last } = splitName(player.name);
  const formerName = extras?.formerNames[extrasKey(player.name)];

  return {
    name: player.name,
    first,
    last,
    nickname: trimEnd(player.nickname || note?.nickname),
    position: player.position,
    positionName: POSITION_NAMES[player.position] ?? player.position,
    team: opts.teamName ?? player.team ?? note?.team,
    era,
    tag: trimEnd(note?.tag),
    storyline: story ? titleCase(story.headline) : undefined,
    rings: player.rings || 0,
    mvp: player.mvp || 0,
    opoy: player.opoy || 0,
    opoyLabel: isDefensivePosition(player.position) ? 'Defensive Player of the Year' : 'Offensive Player of the Year',
    sbmvp: player.sbmvp || 0,
    roty: player.roty || 0,
    games: player.games || 0,
    legacy: Math.round(player.careerLegacy || 0),
    signature: signatureStats(player),
    family: extras ? getFamilyTies(extras, player.name) : [],
    formerName,
    retired: opts.retired ?? undefined,
  };
};

// ---------------------------------------------------------------------------
// Phrase helpers
// ---------------------------------------------------------------------------

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const n = (v: number) => (v >= 0 && v < WORDS.length ? WORDS[v] : v.toLocaleString('en-US'));
const fmt = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;

export const listJoin = (items: string[]) =>
  items.length <= 1 ? items[0] ?? '' : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "three championship rings, two MVPs and a Super Bowl MVP" (empty when no hardware) */
const hardware = (f: SpeechFacts) => {
  const parts: string[] = [];
  if (f.rings) parts.push(f.rings === 1 ? 'a championship ring' : `${n(f.rings)} championship rings`);
  if (f.mvp) parts.push(f.mvp === 1 ? 'an MVP award' : `${n(f.mvp)} MVP awards`);
  if (f.opoy) parts.push(f.opoy === 1 ? `a ${f.opoyLabel} award` : `${n(f.opoy)} ${f.opoyLabel} awards`);
  if (f.sbmvp) parts.push(f.sbmvp === 1 ? 'a Super Bowl MVP' : `${n(f.sbmvp)} Super Bowl MVPs`);
  if (f.roty) parts.push('Rookie of the Year honors');
  return listJoin(parts);
};

const awardCount = (f: SpeechFacts) => f.rings + f.mvp + f.opoy + f.sbmvp + f.roty;

const statLine = (f: SpeechFacts, max = 2) => listJoin(f.signature.slice(0, max).map((s) => `${fmt(s.value)} ${s.label}`));

const teamPhrase = (f: SpeechFacts) => (f.team ? `the ${f.team}` : 'this league');

const familyLine = (f: SpeechFacts) => {
  const own = f.family.find((t) => / of$/.test(t.label));
  if (own) return `${f.first} carries a family name this league already knows, as the ${own.label.toLowerCase()} ${own.name}.`;
  const kin = f.family[0];
  const relation = kin?.label.match(/\((.+)\)/)?.[1];
  if (kin) return relation ? `And the family line runs on through ${kin.name}, ${f.first}'s ${relation}.` : `And the family line runs on through ${kin.name}.`;
  return '';
};

const formerLine = (f: SpeechFacts) =>
  f.formerName ? `Some of you first knew this player as ${f.formerName}. Tonight, every one of you knows the name ${f.name}.` : '';

const tagLine = (f: SpeechFacts) => {
  if (!f.tag) return '';
  // Family tags ("Son of Tyrion Kline") are already covered by familyLine
  if (f.family.some((t) => f.tag!.toLowerCase().includes(t.name.toLowerCase()))) return '';
  return `The league history keeps it to one line: “${f.tag}.”`;
};

const storyLine = (f: SpeechFacts) => (f.storyline ? `The archives file this career under “${f.storyline}.”` : '');

const retiredLine = (f: SpeechFacts) =>
  f.retired ? `And the ${f.retired.teamLabel} have made it official: number ${f.retired.number} goes to the rafters, and nobody wears it again.` : '';

const nickLine = (f: SpeechFacts) => (f.nickname ? `“${f.nickname}”` : f.last);

const paras = (...blocks: (string | false | undefined)[][]) =>
  blocks.map((b) => b.filter((s): s is string => !!s).join(' ')).filter((p) => p.trim().length > 0);

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

interface Template {
  id: string;
  fits: (f: SpeechFacts) => boolean;
  write: (f: SpeechFacts) => string[];
}

const TEMPLATES: Template[] = [
  {
    id: 'presenter',
    fits: () => true,
    write: (f) =>
      paras(
        [
          `Ladies and gentlemen, please rise.`,
          `For ${plural(f.games, 'game')}, ${f.name} played ${f.positionName.toLowerCase()} the way it is supposed to be played${f.team ? `, wearing the colors of the ${f.team}` : ''}.`,
        ],
        [
          f.signature.length ? `The record shows ${statLine(f)}.` : '',
          hardware(f) ? `The trophy case holds ${hardware(f)}.` : 'The trophy case was never the point; the tape was.',
          f.era ? `Those numbers were built in the ${f.era}, and they still stand up.` : '',
        ],
        [tagLine(f), familyLine(f), retiredLine(f)],
        [`With a career legacy of ${fmt(f.legacy)}, it is my honor to welcome ${f.name} into the Hall of Fame.`],
      ),
  },
  {
    id: 'first-person',
    fits: () => true,
    write: (f) =>
      paras(
        [`Thank you. Thank you all.`, f.team ? `To everybody who ever filled a seat for the ${f.team}: this jacket is half yours.` : `To everybody who ever watched me play: this jacket is half yours.`],
        [
          `I played ${plural(f.games, 'game')} in this league.`,
          f.signature.length ? `People will quote ${statLine(f)} back at me, and I am grateful for every one of them.` : '',
          f.rings ? `But I will tell you what I remember: ${f.rings === 1 ? 'the night we won it all' : `all ${n(f.rings)} of those championship nights`}.` : `But I will tell you what I remember: the people in the huddle.`,
        ],
        [familyLine(f), formerLine(f)],
        [f.nickname ? `You called me “${f.nickname}.” I always tried to live up to it.` : '', `Thank you for letting me be part of this.`],
      ),
  },
  {
    id: 'numbers',
    fits: (f) => f.signature.length >= 2,
    write: (f) =>
      paras(
        [`Some careers you describe. This one, you count.`],
        [
          f.signature.map((s) => `${fmt(s.value)} ${s.label}.`).join(' '),
          `${capitalize(plural(f.games, 'game'))}.`,
          `A career legacy of ${fmt(f.legacy)}.`,
        ],
        [hardware(f) ? `Add ${hardware(f)}, and you have a résumé that ends arguments.` : '', storyLine(f), retiredLine(f)],
        [`${f.name}${f.team ? ` of the ${f.team}` : ''}: welcome to the Hall of Fame.`],
      ),
  },
  {
    id: 'era',
    fits: (f) => !!f.era,
    write: (f) =>
      paras(
        [`Every era of this league has a handful of names that define it. The ${f.era} has ${f.name}.`],
        [
          `${f.last} gave ${teamPhrase(f)} ${plural(f.games, 'game')} at ${f.positionName.toLowerCase()}${f.signature.length ? `, along with ${statLine(f)}` : ''}.`,
          hardware(f) ? `Along the way came ${hardware(f)}.` : '',
        ],
        [tagLine(f), storyLine(f), familyLine(f)],
        [retiredLine(f), `Long after the ${f.era} is a chapter in the history books, this name will be on the wall. Welcome home, ${f.first}.`],
      ),
  },
  {
    id: 'nickname',
    fits: (f) => !!f.nickname,
    write: (f) =>
      paras(
        [`In this league, you do not give yourself a nickname. The league gives it to you.`, `And the league called ${f.name} ${nickLine(f)}.`],
        [
          `That name was earned over ${plural(f.games, 'game')}${f.team ? ` with the ${f.team}` : ''}.`,
          f.signature.length ? `It was earned with ${statLine(f)}.` : '',
          hardware(f) ? `It was earned with ${hardware(f)}.` : '',
        ],
        [formerLine(f), tagLine(f), familyLine(f)],
        [retiredLine(f), `${nickLine(f)}, your bust is ready. Welcome to the Hall of Fame.`],
      ),
  },
  {
    id: 'rings',
    fits: (f) => f.rings >= 2,
    write: (f) =>
      paras(
        [`Hold up your hand, ${f.first}. Count the rings.`, `${capitalize(n(f.rings))}.`],
        [
          `${capitalize(n(f.rings))} times the season ended with a championship${f.team ? ` for the ${f.team}` : ''}, and ${f.last} was in the middle of it.`,
          f.sbmvp ? `${f.sbmvp === 1 ? 'Once' : `${capitalize(n(f.sbmvp))} times`}, the Super Bowl MVP trophy went home with ${f.last} too.` : '',
          f.mvp ? `There ${f.mvp === 1 ? 'is an MVP' : `are ${n(f.mvp)} MVPs`} on the shelf beside them.` : '',
        ],
        [f.signature.length ? `Over ${plural(f.games, 'game')}: ${statLine(f, 3)}.` : '', tagLine(f), storyLine(f)],
        [retiredLine(f), familyLine(f), `Winners belong here. ${f.name}, welcome to the Hall of Fame.`],
      ),
  },
  {
    id: 'family',
    fits: (f) => f.family.length > 0 || !!f.formerName,
    write: (f) =>
      paras(
        [`Football in this league is a family business, and tonight we honor one of its own.`],
        [familyLine(f), formerLine(f)],
        [
          `${f.name} played ${plural(f.games, 'game')}${f.team ? ` for the ${f.team}` : ''}${f.signature.length ? ` and finished with ${statLine(f)}` : ''}.`,
          hardware(f) ? `The hardware: ${hardware(f)}.` : '',
          f.era ? `It is a career that belongs to the ${f.era}.` : '',
        ],
        [retiredLine(f), `To the family: this one is for you, too. ${f.first}, welcome to the Hall.`],
      ),
  },
  {
    id: 'trenches',
    fits: (f) => awardCount(f) <= 1,
    write: (f) =>
      paras(
        [`Not every legend lives on the highlight reel.`],
        [
          `${f.name} did the work that wins games: ${plural(f.games, 'game')} at ${f.positionName.toLowerCase()}${f.team ? ` for the ${f.team}` : ''}${f.signature.length ? `, with ${statLine(f)}` : ''}.`,
          hardware(f) ? `There was ${hardware(f)} along the way, but ask any teammate and they will talk about the consistency first.` : `Ask any teammate and they will talk about the consistency first.`,
        ],
        [f.era ? `Through the ${f.era}, ${f.last} was there every week.` : '', tagLine(f), familyLine(f)],
        [retiredLine(f), `A career legacy of ${fmt(f.legacy)} says what the box score sometimes did not. ${f.name}, welcome to the Hall of Fame.`],
      ),
  },
];

const ringTemplate = (f: SpeechFacts): string[] =>
  paras(
    [f.retired ? `Tonight the ${f.retired.teamLabel} raise number ${f.retired.number} to the rafters.` : `Tonight we raise a banner.`],
    [
      `${f.name} wore it for ${plural(f.games, 'game')}${f.signature.length ? ` and left behind ${statLine(f)}` : ''}.`,
      hardware(f) ? `${capitalize(hardware(f))} came with it.` : '',
    ],
    [tagLine(f), familyLine(f)],
    [`From this night on, that number belongs to one player. Welcome to the Ring of Honor, ${f.first}.`],
  );

const GENERAL = new Set(['presenter', 'first-person']);

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Generated speech. `offset` (the inductee's place in the ceremony) rotates templates so a class does
 * not repeat itself; the choice is otherwise stable for the same player.
 */
export const generateSpeech = (f: SpeechFacts, opts: { offset?: number; variant?: 'hof' | 'ring' } = {}): Speech => {
  if (opts.variant === 'ring') return { paragraphs: ringTemplate(f), source: 'generated', template: 'ring' };
  // Templates written for something specific about this player (rings, nickname, family…) come first;
  // the two general ones join only as a single alternate so they don't dominate a class.
  const h = hash(f.name);
  const specific = TEMPLATES.filter((t) => !GENERAL.has(t.id) && t.fits(f));
  const general = TEMPLATES.filter((t) => GENERAL.has(t.id));
  const pool = specific.length ? [...specific, general[h % general.length]] : general;
  const pick = pool[(h + (opts.offset ?? 0)) % pool.length];
  return { paragraphs: pick.write(f), source: 'generated', template: pick.id };
};

/** content.json speech when present, else a generated one. */
export const getInductionSpeech = (
  f: SpeechFacts,
  content: LeagueContent | null | undefined,
  opts: { offset?: number; variant?: 'hof' | 'ring' } = {},
): Speech => {
  const speeches = content?.speeches;
  if (speeches) {
    const target = normalizeName(f.name);
    const hit = Object.entries(speeches).find(([name]) => normalizeName(name) === target);
    if (hit) {
      const paragraphs = hit[1].split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paragraphs.length) return { paragraphs, source: 'content' };
    }
  }
  return generateSpeech(f, opts);
};

/** Templates exposed for tests/tools. */
export const SPEECH_TEMPLATE_IDS = TEMPLATES.map((t) => t.id);
