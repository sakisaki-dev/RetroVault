import type { Player, Position } from '@/types/player';
import { evaluateMetric, type AdvContext, type AdvMetric } from '@/config/advanced';
import { formatDecimal } from '@/utils/metricColors';
import type { RecordBoardData } from './records';

/**
 * One-sentence takeaways that lead each Stats section (SectionIntro). Each is a template over the same data the section
 * draws, so it changes with every upload; nothing here names a player or a number by hand. Null = no sentence (too
 * little data for a fair one).
 */

const surname = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
};
const fmt = (v: number, d: number) => formatDecimal(v, d);
const list = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** Lead over #2 as a share of #2 (direction-aware), for comparing leads across stats with different scales. */
const leadShare = (b: RecordBoardData) => {
  const [a, c] = b.entries;
  if (!a || !c || !c.value) return 0;
  return Math.abs(a.value - c.value) / Math.abs(c.value);
};

/** Record Book: who owns the most headline records, else the widest lead among them. */
export const recordsTakeaway = (boards: RecordBoardData[]): string | null => {
  const held = new Map<string, { player: Player; titles: string[] }>();
  boards.forEach((b) => {
    const top = b.entries[0];
    if (!top) return;
    const k = `${top.player.position}:${top.player.name}`;
    const cur = held.get(k) ?? { player: top.player, titles: [] };
    cur.titles.push(b.title.toLowerCase());
    held.set(k, cur);
  });
  const most = [...held.values()].sort((a, b) => b.titles.length - a.titles.length || a.player.name.localeCompare(b.player.name))[0];
  if (most && most.titles.length >= 2) {
    return `${most.player.name} holds ${most.titles.length} of the ${boards.length} headline records: ${list(most.titles)}.`;
  }
  const widest = [...boards].sort((a, b) => leadShare(b) - leadShare(a))[0];
  const [a, c] = widest?.entries ?? [];
  if (!a || !c) return null;
  return `The widest lead is ${a.player.name}'s ${widest.title.toLowerCase()} record, ${fmt(a.value, widest.decimals)} to ${fmt(c.value, widest.decimals)} for ${surname(c.player.name)}.`;
};

/** Efficiency Leaders: the rate record with the biggest lead over #2. */
export const efficiencyTakeaway = (boards: RecordBoardData[]): string | null => {
  const widest = [...boards].filter((b) => b.entries.length >= 2).sort((a, b) => leadShare(b) - leadShare(a))[0];
  if (!widest) return null;
  const [a, c] = widest.entries;
  return `${a.player.name} has the clearest efficiency edge: ${fmt(a.value, widest.decimals)} ${widest.title.toLowerCase()}, ${fmt(Math.abs(a.value - c.value), widest.decimals)} clear of ${surname(c.player.name)} at #2.`;
};

/**
 * Analytics Lab: of the league-best metrics the Lab leads with, the one furthest above its position's average (in
 * standard deviations), told against that average.
 */
export const labTakeaway = (players: Player[], ctx: AdvContext, metrics: AdvMetric[]): string | null => {
  let best: { metric: AdvMetric; pos: Position; player: Player; value: number; mean: number; z: number } | null = null;
  metrics.forEach((metric) => {
    metric.positions.forEach((pos) => {
      const board = evaluateMetric(players, metric, pos, ctx);
      if (board.rows.length < 5) return;
      const sd = Math.sqrt(board.rows.reduce((s, r) => s + (r.value - board.mean) ** 2, 0) / board.rows.length);
      const top = board.rows[0];
      if (!sd || !top) return;
      const z = Math.abs(top.value - board.mean) / sd;
      if (!best || z > best.z) best = { metric, pos, player: top.player, value: top.value, mean: board.mean, z };
    });
  });
  if (!best) return null;
  const b = best as { metric: AdvMetric; pos: Position; player: Player; value: number; mean: number };
  const d = b.metric.decimals;
  const gap = Math.abs(b.value - b.mean);
  const side = b.metric.lowerIsBetter ? 'under' : 'over';
  const unit = b.metric.suffix ?? '';
  return `${b.player.name} leads ${b.metric.label.toLowerCase()} at ${fmt(b.value, d)}${unit}, ${fmt(gap, d)}${unit} ${side} the ${b.pos} average of ${fmt(b.mean, d)}${unit}.`;
};

/** League Landscape: who sits in the top tier at the shown position. */
export const landscapeTakeaway = (tiers: { letter: string; entries: { player: Player }[] }[], position: Position, by: string): string | null => {
  const total = tiers.reduce((s, t) => s + t.entries.length, 0);
  const top = tiers.find((t) => t.entries.length);
  if (!top || !total) return null;
  const names = top.entries.slice(0, 3).map((e) => e.player.name);
  const more = top.entries.length - names.length;
  return `${top.entries.length} of ${total} league ${position}s grade ${top.letter} on ${by}: ${list(names)}${more > 0 ? ` and ${more} more` : ''}.`;
};

/** Hidden Gems: the biggest gap between skill and overall in the shown list. */
export const gemsTakeaway = (rows: { player: Player; ovr: number; skill: number; gap: number }[], mode: string): string | null => {
  const top = rows[0];
  if (!top) return null;
  return `${rows.length} player${rows.length === 1 ? '' : 's'} ${mode}; ${top.player.name} has the biggest gap, a ${top.skill} skill rating on a ${top.ovr} overall (+${top.gap}).`;
};

/** League Shape: the position with the most Hall of Famers and its share of the Hall. */
export const shapeTakeaway = (players: Player[], isHof: (p: Player) => boolean): string | null => {
  const hof = players.filter(isHof);
  if (!hof.length) return null;
  const by = new Map<Position, number>();
  hof.forEach((p) => by.set(p.position, (by.get(p.position) ?? 0) + 1));
  const [pos, n] = [...by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return `${hof.length} of ${players.length} league players are Hall of Famers; ${pos}s make up the most, ${n} (${Math.round((n / hof.length) * 100)}%).`;
};

/** Leaders by Position: whoever tops the most position boards. */
export const leadersTakeaway = (boards: RecordBoardData[]): string | null => {
  const tops = new Map<string, { player: Player; n: number }>();
  boards.forEach((b) => {
    const top = b.entries[0];
    if (!top) return;
    const k = `${top.player.position}:${top.player.name}`;
    tops.set(k, { player: top.player, n: (tops.get(k)?.n ?? 0) + 1 });
  });
  const best = [...tops.values()].sort((a, b) => b.n - a.n || a.player.name.localeCompare(b.player.name))[0];
  if (!best) return null;
  return best.n >= 2
    ? `${best.player.name} tops ${best.n} of the ${boards.length} position boards, more than anyone.`
    : `${boards.length} position boards, ${tops.size} different leaders: no one tops more than one.`;
};

/** Full Stat Tables: the size of the league and its biggest position group. */
export const tablesTakeaway = (groups: { label: string; count: number }[]): string | null => {
  const total = groups.reduce((s, g) => s + g.count, 0);
  const biggest = [...groups].sort((a, b) => b.count - a.count)[0];
  if (!total || !biggest) return null;
  return `${total} league players across ${groups.length} positions; ${biggest.label.toLowerCase()} are the biggest group with ${biggest.count}.`;
};
