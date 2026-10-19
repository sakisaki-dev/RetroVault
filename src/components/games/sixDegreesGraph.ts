import { playerKey, type GamePlayer } from '@/config/ovr';
import { matchPlayerByName, type LeagueContent } from '@/utils/leagueContent';
import { findNFLTeam } from '@/utils/nflTeams';
import { normalizeName as extrasKey, type IndexedExtras } from '@/utils/playerExtras';

/**
 * "Six Degrees of Ikarras": a graph over the league's own players (real NFL legends excluded).
 * Two players are linked when they share a franchise (sheet team, plus former / legacy teams from the
 * player-extras cards), an era (era tag in playerNotes or an era's keyPlayers), a family tie, or sit
 * next to each other in a lineage chain. Every edge carries the facts behind it and a readable reason.
 * Pure module: no React, no fetching. Player status (Active/Retired) is never used.
 */

export type LinkKind = 'team' | 'era' | 'family' | 'lineage';

export interface LinkFact {
  kind: LinkKind;
  /** Short chip text, e.g. "Bills", "Bills dynasty", "Brothers", "QBs lineage" */
  label: string;
  /** Full sentence fragment, e.g. "Both Bills", "Bills dynasty era" */
  text: string;
}

export interface SixDegEdge {
  facts: LinkFact[];
  /** e.g. "Both Bills, Bills dynasty era" */
  reason: string;
}

export interface SixDegGraph {
  nodes: GamePlayer[];
  byKey: Map<string, GamePlayer>;
  adj: Map<string, Map<string, SixDegEdge>>;
}

export interface SixDegInput {
  players: GamePlayer[];
  content: LeagueContent | null;
  extras: IndexedExtras;
}

const KIND_ORDER: LinkKind[] = ['family', 'lineage', 'team', 'era'];

const isReal = (p: GamePlayer) => p.isRealLegend === true;

const lastName = (name: string) => {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  const tail = parts[parts.length - 1] ?? '';
  // "Mason Earl III" -> "Earl"
  return (/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(tail) && parts.length > 2 ? parts[parts.length - 2] : tail).toLowerCase();
};
const firstName = (name: string) => (name.trim().split(/\s+/)[0] ?? '').toLowerCase();
const fold = (s: string) => s.toLowerCase().replace(/[’‘`']/g, '').replace(/[^a-z0-9]/g, '');

/** Era name as a phrase: "Bills dynasty" -> "Bills dynasty era", "Ikarras era" stays. */
const eraPhrase = (name: string) => (/\b(era|run)$/i.test(name) ? name : `${name} era`);

/** Short name for reasons: last name, or the whole name when that's ambiguous in the pool. */
const shortNameFor = (nodes: GamePlayer[]) => {
  const counts = new Map<string, number>();
  nodes.forEach((p) => counts.set(lastName(p.name), (counts.get(lastName(p.name)) ?? 0) + 1));
  return (p: GamePlayer) => {
    const ln = lastName(p.name);
    if ((counts.get(ln) ?? 0) > 1) return p.name;
    const parts = p.name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
    return parts.find((w) => w.toLowerCase() === ln) ?? p.name;
  };
};

/** Match an editorial name to a node, preferring the stated position. */
const matchNode = (name: string, nodes: GamePlayer[], position?: string): GamePlayer | undefined => {
  if (position) {
    const samePos = nodes.filter((p) => p.position === position);
    const hit = matchPlayerByName(name, samePos);
    if (hit) return hit;
  }
  return matchPlayerByName(name, nodes);
};

const STOP = new Set(['the', 'with', 'rival', 'chases', 'breaks', 'record', 'brothers', 'brother', 'and', 'of', 'era', 'god']);

/**
 * Players named in a free-text lineage item ("Finney with Tyrion Kline", "the Wilson brothers",
 * "Waller (rival McQuay)", "God Johnson breaks the record with Jackson Kline").
 */
export const playersInText = (text: string, nodes: GamePlayer[]): GamePlayer[] => {
  const words = text.replace(/[(),;:]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Map<string, GamePlayer>();
  const add = (p?: GamePlayer) => p && out.set(playerKey(p), p);
  const cap = (w?: string) => !!w && /^[A-Z]/.test(w);
  const brothers = /\bbrothers\b/i.test(text);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!cap(w)) continue;
    // Two- or three-word full names first ("Tyrion Kline", "God Johnson", "Jackson Kline")
    let matched = false;
    for (const len of [3, 2]) {
      const span = words.slice(i, i + len);
      if (span.length < len || !span.every(cap)) continue;
      const hit = matchPlayerByName(span.join(' '), nodes);
      if (hit) {
        add(hit);
        i += len - 1;
        matched = true;
        break;
      }
    }
    if (matched || STOP.has(w.toLowerCase())) continue;
    const key = fold(w);
    const byLast = nodes.filter((p) => fold(lastName(p.name)) === key);
    if (byLast.length === 1 || (byLast.length > 1 && brothers)) {
      byLast.forEach(add);
      continue;
    }
    const byFirst = nodes.filter((p) => fold(firstName(p.name)) === key);
    if (byFirst.length === 1) add(byFirst[0]);
  }
  return [...out.values()];
};

const joinFacts = (facts: LinkFact[]) => {
  const sorted = [...facts].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  // Merge team facts: "Both Bills & Vikings"
  const teams = sorted.filter((f) => f.kind === 'team');
  const parts: string[] = [];
  sorted.forEach((f) => {
    if (f.kind !== 'team') parts.push(f.text);
    else if (f === teams[0]) parts.push(teams.length > 1 ? `Both ${teams.map((t) => t.text.replace(/^Both /, '')).join(' & ')}` : f.text);
  });
  return parts.join(', ');
};

export const buildSixDegreesGraph = ({ players, content, extras }: SixDegInput): SixDegGraph => {
  const seen = new Set<string>();
  const nodes = players.filter((p) => {
    const k = playerKey(p);
    if (isReal(p) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const byKey = new Map(nodes.map((p) => [playerKey(p), p]));
  const adj = new Map<string, Map<string, SixDegEdge>>(nodes.map((p) => [playerKey(p), new Map()]));
  const short = shortNameFor(nodes);

  const link = (a: GamePlayer, b: GamePlayer, fact: LinkFact) => {
    const ka = playerKey(a);
    const kb = playerKey(b);
    if (ka === kb) return;
    for (const [x, y] of [
      [ka, kb],
      [kb, ka],
    ]) {
      const row = adj.get(x);
      if (!row) return;
      const edge = row.get(y) ?? { facts: [], reason: '' };
      if (!edge.facts.some((f) => f.kind === fact.kind && f.label === fact.label)) edge.facts.push(fact);
      row.set(y, edge);
    }
  };
  const clique = (members: GamePlayer[], fact: (a: GamePlayer, b: GamePlayer) => LinkFact) => {
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) link(members[i], members[j], fact(members[i], members[j]));
  };

  // ---- Franchises: sheet team, note team, card team / former_team / legacy_team ----
  const notesFor = new Map<string, NonNullable<LeagueContent['playerNotes']>[number]>();
  content?.playerNotes.forEach((n) => {
    const p = matchNode(n.name, nodes, n.position);
    if (p && !notesFor.has(playerKey(p))) notesFor.set(playerKey(p), n);
  });

  type Membership = { p: GamePlayer; how?: 'former' | 'legacy' };
  const teams = new Map<string, { name: string; members: Map<string, Membership> }>();
  const join = (p: GamePlayer, teamName: unknown, how?: Membership['how']) => {
    if (typeof teamName !== 'string') return;
    const t = findNFLTeam(teamName);
    if (!t) return;
    const row = teams.get(t.id) ?? { name: t.name, members: new Map() };
    const prev = row.members.get(playerKey(p));
    // A primary membership beats a former/legacy one
    if (!prev || (prev.how && !how)) row.members.set(playerKey(p), { p, how });
    teams.set(t.id, row);
  };
  nodes.forEach((p) => {
    join(p, p.team);
    join(p, notesFor.get(playerKey(p))?.team);
    const card = extras.cards[extrasKey(p.name)];
    if (card) {
      join(p, card.team);
      join(p, card.former_team, 'former');
      join(p, card.legacy_team, 'legacy');
    }
  });
  teams.forEach(({ name, members }) => {
    clique([...members.values()].map((m) => m.p), (a, b) => {
      const notes = [a, b]
        .map((p) => {
          const how = members.get(playerKey(p))?.how;
          return how ? `${short(p)}'s ${how === 'former' ? 'former' : 'legacy'} team` : null;
        })
        .filter(Boolean);
      return { kind: 'team', label: name, text: `Both ${name}${notes.length ? ` (${notes.join(', ')})` : ''}` };
    });
  });

  // ---- Eras: playerNotes era tag + era keyPlayers ----
  const eraMembers = new Map<string, { name: string; members: Map<string, GamePlayer> }>();
  const eraIdFor = (name: string) =>
    content?.eras.find((e) => fold(e.name) === fold(name) || fold(e.id) === fold(name))?.id ?? `tag:${fold(name)}`;
  const joinEra = (p: GamePlayer, eraName: string) => {
    const id = eraIdFor(eraName);
    const proper = content?.eras.find((e) => e.id === id)?.name ?? eraName;
    const row = eraMembers.get(id) ?? { name: proper, members: new Map() };
    row.members.set(playerKey(p), p);
    eraMembers.set(id, row);
  };
  content?.eras.forEach((era) => era.keyPlayers.forEach((name) => {
    const p = matchNode(name, nodes);
    if (p) joinEra(p, era.name);
  }));
  notesFor.forEach((note, key) => {
    const tag = note.era?.split('·')[0]?.trim();
    const p = byKey.get(key);
    if (!p || !tag || /legend|nfl star|real nfl/i.test(tag)) return;
    joinEra(p, tag);
  });
  eraMembers.forEach(({ name, members }) => {
    clique([...members.values()], () => ({ kind: 'era', label: name, text: eraPhrase(name) }));
  });

  // ---- Family ties (player-extras) ----
  Object.values(extras.family).forEach(({ name, value }) => {
    const m = value.match(/^\s*(.+?)\s+of\s+(.+?)\s*$/i);
    if (!m) return;
    const a = matchNode(name, nodes);
    const b = matchNode(m[2], nodes);
    if (!a || !b) return;
    const relation = m[1].toLowerCase();
    const label = relation === 'brother' || relation === 'sister' ? 'Brothers' : relation === 'son' || relation === 'father' ? 'Father & son' : 'Family';
    link(a, b, { kind: 'family', label, text: `Family: ${short(a)} is the ${relation} of ${short(b)}` });
  });

  // ---- Lineage chains: players in the same item, and neighbouring items ----
  content?.lineages.forEach((lin) => {
    const items = lin.chain.map((text) => ({ text, players: playersInText(text, nodes) }));
    const label = `${lin.label} lineage`;
    items.forEach((item, i) => {
      clique(item.players, () => ({ kind: 'lineage', label, text: `${label}: ${item.text}` }));
      const next = items[i + 1];
      if (!next) return;
      item.players.forEach((a) =>
        next.players.forEach((b) => link(a, b, { kind: 'lineage', label, text: `${label}: ${item.text} → ${next.text}` })),
      );
    });
  });

  adj.forEach((row) => row.forEach((edge) => (edge.reason = joinFacts(edge.facts))));
  return { nodes, byKey, adj };
};

// ---------- Queries ----------

export const edgeBetween = (g: SixDegGraph, a: string, b: string): SixDegEdge | null => g.adj.get(a)?.get(b) ?? null;

export const degree = (g: SixDegGraph, key: string) => g.adj.get(key)?.size ?? 0;

/** BFS hop counts from `from` to every reachable node. */
export const distancesFrom = (g: SixDegGraph, from: string): Map<string, number> => {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    const d = dist.get(cur)!;
    g.adj.get(cur)?.forEach((_, nb) => {
      if (!dist.has(nb)) {
        dist.set(nb, d + 1);
        queue.push(nb);
      }
    });
  }
  return dist;
};

/** One shortest path (node keys, start..target), ties broken at random; null if unreachable. */
export const shortestPath = (g: SixDegGraph, from: string, to: string, distToTarget?: Map<string, number>): string[] | null => {
  const dt = distToTarget ?? distancesFrom(g, to);
  if (!dt.has(from)) return null;
  const path = [from];
  let cur = from;
  while (cur !== to) {
    const d = dt.get(cur)!;
    const next = [...(g.adj.get(cur)?.keys() ?? [])].filter((k) => dt.get(k) === d - 1);
    cur = next[Math.floor(Math.random() * next.length)];
    path.push(cur);
  }
  return path;
};

/** Neighbours of `from` that lie on some shortest path to the target (for hints). */
export const hintNeighbors = (g: SixDegGraph, from: string, distToTarget: Map<string, number>): string[] => {
  const d = distToTarget.get(from);
  if (d == null) return [];
  return [...(g.adj.get(from)?.keys() ?? [])].filter((k) => distToTarget.get(k) === d - 1);
};

// ---------- Puzzles ----------

export const IKARRAS = 'Rondale Ikarras';

export interface SixDegPuzzle {
  id: string;
  start: string;
  target: string;
  /** Fewest links between start and target */
  shortest: number;
  /** BFS distances to the target (for validation hints and the give-up path) */
  distToTarget: Map<string, number>;
}

/** Shortest path length the puzzle aims for at a given streak: 2 early, up to 4 later. */
export const lengthsForStreak = (streak: number): number[] =>
  streak < 2 ? [2] : streak < 4 ? [2, 3] : streak < 7 ? [3] : streak < 10 ? [3, 4] : [4];

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const weightedPick = <T,>(items: T[], weight: (t: T) => number): T => {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let r = Math.random() * total;
  for (const t of items) {
    r -= weight(t);
    if (r <= 0) return t;
  }
  return items[items.length - 1];
};

/** Players with an editorial hook (era, family, lineage) make friendlier endpoints. */
const notability = (g: SixDegGraph, key: string) => {
  const kinds = new Set<LinkKind>();
  g.adj.get(key)?.forEach((e) => e.facts.forEach((f) => kinds.add(f.kind)));
  return 1 + (kinds.has('era') ? 2 : 0) + (kinds.has('family') || kinds.has('lineage') ? 2 : 0);
};

export const makePuzzle = (
  g: SixDegGraph,
  { streak = 0, recent = [], ikarrasChance = 0.5 }: { streak?: number; recent?: string[]; ikarrasChance?: number } = {},
): SixDegPuzzle | null => {
  const linked = g.nodes.map(playerKey).filter((k) => degree(g, k) > 0);
  if (linked.length < 3) return null;
  const ikarras = g.nodes.find((p) => p.name === IKARRAS);
  const ikKey = ikarras && degree(g, playerKey(ikarras)) > 0 ? playerKey(ikarras) : null;
  const wanted = lengthsForStreak(streak);
  const fallbackOrder = [...new Set([...wanted, 3, 2, 4])];

  for (let attempt = 0; attempt < 40; attempt++) {
    const start = ikKey && (attempt < 20 ? Math.random() < ikarrasChance : false) ? ikKey : weightedPick(linked, (k) => notability(g, k));
    const dist = distancesFrom(g, start);
    // Exact difficulty on the first tries, then anything in 2..4
    const lengths = attempt < 30 ? [pick(wanted)] : fallbackOrder;
    for (const len of lengths) {
      const pool = [...dist.entries()].filter(([k, d]) => d === len && !recent.includes(k) && k !== start).map(([k]) => k);
      if (!pool.length) continue;
      const target = weightedPick(pool, (k) => notability(g, k));
      return {
        id: `${start}>${target}>${Date.now()}>${attempt}`,
        start,
        target,
        shortest: len,
        distToTarget: distancesFrom(g, target),
      };
    }
  }
  return null;
};

// ---------- Scoring ----------

/** Golf-style par: two strokes of slack over the shortest chain. */
export const parFor = (shortest: number) => shortest + 2;

export const scoreLabel = (strokes: number, shortest: number): { label: string; tone: 'gold' | 'turf' | 'sky' | 'flag' } => {
  const over = strokes - parFor(shortest);
  if (over <= -2) return { label: 'Eagle', tone: 'gold' };
  if (over === -1) return { label: 'Birdie', tone: 'turf' };
  if (over === 0) return { label: 'Par', tone: 'sky' };
  if (over === 1) return { label: 'Bogey', tone: 'flag' };
  if (over === 2) return { label: 'Double bogey', tone: 'flag' };
  return { label: 'Triple bogey+', tone: 'flag' };
};

// ---------- Stats (for sanity checks) ----------

export const graphStats = (g: SixDegGraph) => {
  const keys = g.nodes.map(playerKey);
  let edges = 0;
  g.adj.forEach((row) => (edges += row.size));
  edges /= 2;
  const lengthCounts = new Map<number, number>();
  let pairs = 0;
  let connected = 0;
  keys.forEach((k, i) => {
    const dist = distancesFrom(g, k);
    for (let j = i + 1; j < keys.length; j++) {
      pairs++;
      const d = dist.get(keys[j]);
      if (d != null) {
        connected++;
        lengthCounts.set(d, (lengthCounts.get(d) ?? 0) + 1);
      }
    }
  });
  const kinds = new Map<LinkKind, number>();
  g.adj.forEach((row, a) =>
    row.forEach((e, b) => {
      if (a < b) e.facts.forEach((f) => kinds.set(f.kind, (kinds.get(f.kind) ?? 0) + 1));
    }),
  );
  return {
    nodes: keys.length,
    isolated: keys.filter((k) => degree(g, k) === 0).length,
    edges,
    edgeFactsByKind: Object.fromEntries(kinds),
    pairs,
    connectedPct: pairs ? (100 * connected) / pairs : 0,
    pathLengths: Object.fromEntries([...lengthCounts.entries()].sort((a, b) => a[0] - b[0])),
  };
};
