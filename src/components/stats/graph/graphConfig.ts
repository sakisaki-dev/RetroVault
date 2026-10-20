import { useCallback, useEffect, useState } from 'react';
import type { Player, Position } from '@/types/player';
import { HEADLINE_METRIC, METRIC_BY_ID, POSITIONS } from '@/config/advanced';
import { HOF_THRESHOLD, getLegacyTier, isHallOfFamer } from '@/config/stats';
import { findNFLTeam } from '@/utils/nflTeams';
import { keyOf } from '../records';
import type { LPoint, LandscapeSpec, Quadrants } from '../visual/landscape';
import { STAT_BY_ID, fmtStat, type GraphDeps, type GraphStat } from './graphStats';

/** Graph Builder model: the config (what is plotted), its URL form, presets, and config → points + spec. */

export type ColorBy = 'team' | 'position' | 'tier';

export interface GraphConfig {
  x: string;
  y: string;
  /** Optional third stat for bubble size. */
  size?: string;
  /** Positions shown; empty = every position both stats apply to. */
  pos: Position[];
  /** Team id (utils/nflTeams). */
  team?: string;
  hof?: boolean;
  minGames: number;
  color: ColorBy;
  logX?: boolean;
  logY?: boolean;
  trend?: boolean;
  /** Median lines + quadrant names (default on). */
  splits: boolean;
  // Fixed charts only
  title?: string;
  subtitle?: string;
  quadrants?: Quadrants;
  diagonal?: boolean;
  xSplit?: { value: number; label: string };
  ySplit?: { value: number; label: string };
  /** Only players who meet this advanced metric's minimum sample. */
  qualifyBy?: string;
}

export const DEFAULT_CONFIG: GraphConfig = { x: 'tdPct', y: 'intPct', pos: [], minGames: 16, color: 'team', splits: true };

// ---------- URL (hash) form ----------

export const GRAPH_PARAMS = ['gx', 'gy', 'gs', 'pos', 'team', 'hof', 'gmin', 'gc', 'glx', 'gly', 'gtr', 'gsp'] as const;

export const configToParams = (c: GraphConfig): Record<string, string> => {
  const out: Record<string, string> = { gx: c.x, gy: c.y };
  if (c.size) out.gs = c.size;
  if (c.pos.length) out.pos = c.pos.join(',');
  if (c.team) out.team = c.team;
  if (c.hof) out.hof = '1';
  if (c.minGames !== DEFAULT_CONFIG.minGames) out.gmin = String(c.minGames);
  if (c.color !== 'team') out.gc = c.color;
  if (c.logX) out.glx = '1';
  if (c.logY) out.gly = '1';
  if (c.trend) out.gtr = '1';
  if (!c.splits) out.gsp = '0';
  return out;
};

export const paramsToConfig = (p: Record<string, string>): GraphConfig | null => {
  if (!p.gx || !p.gy || !STAT_BY_ID.has(p.gx) || !STAT_BY_ID.has(p.gy)) return null;
  const pos = (p.pos ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is Position => (POSITIONS as string[]).includes(s));
  const color: ColorBy = p.gc === 'position' || p.gc === 'tier' ? p.gc : 'team';
  const min = Number(p.gmin);
  return {
    x: p.gx,
    y: p.gy,
    size: p.gs && STAT_BY_ID.has(p.gs) ? p.gs : undefined,
    pos,
    team: p.team || undefined,
    hof: p.hof === '1',
    minGames: Number.isFinite(min) && min >= 0 ? min : DEFAULT_CONFIG.minGames,
    color,
    logX: p.glx === '1',
    logY: p.gly === '1',
    trend: p.gtr === '1',
    splits: p.gsp !== '0',
  };
};

// ---------- Presets ----------

export interface GraphPreset {
  id: string;
  name: string;
  config: GraphConfig;
}

export const TRY_THESE: GraphPreset[] = [
  { id: 'td-int', name: 'TD% vs INT%', config: { ...DEFAULT_CONFIG, x: 'tdPct', y: 'intPct', pos: ['QB'], trend: true } },
  { id: 'rings-legacy', name: 'Rings vs Career Legacy', config: { ...DEFAULT_CONFIG, x: 'careerLegacy', y: 'rings', minGames: 0 } },
  { id: 'sacks-int', name: 'Sacks/G vs INT/G', config: { ...DEFAULT_CONFIG, x: 'sackG', y: 'intG', pos: ['LB', 'DB', 'DL'], minGames: 32 } },
  { id: 'hardware', name: 'Awards vs production', config: { ...DEFAULT_CONFIG, x: 'scorePerGame', y: 'awardRate', trend: true } },
  { id: 'ypc-volume', name: 'Y/C vs rush yds/G', config: { ...DEFAULT_CONFIG, x: 'rushYdsG', y: 'ypc', pos: ['RB'], size: 'rushTD' } },
  { id: 'legacy-ovr', name: 'OVR vs Career Legacy', config: { ...DEFAULT_CONFIG, x: 'ovr', y: 'careerLegacy', minGames: 0, color: 'position', trend: true } },
];

/** Efficiency vs volume axes per position (style features), qualified by the position's headline metric. */
const EFF_AXES: Record<Position, { x: string; y: string }> = {
  QB: { x: 'passYdsG', y: 'ya' },
  RB: { x: 'rushYdsG', y: 'ypc' },
  WR: { x: 'recYdsG', y: 'ypr' },
  TE: { x: 'recYdsG', y: 'ypr' },
  OL: { x: 'games', y: 'blocksG' },
  LB: { x: 'tklG', y: 'impactG' },
  DB: { x: 'tklG', y: 'impactG' },
  DL: { x: 'tklG', y: 'impactG' },
};

/** The Lab's fixed charts. Efficiency follows the Lab's position. */
export const fixedCharts = (position: Position): GraphPreset[] => [
  {
    id: 'peak',
    name: 'Peak vs longevity',
    config: {
      ...DEFAULT_CONFIG,
      x: 'games',
      y: 'tpg',
      minGames: 0,
      title: 'Peak vs longevity',
      subtitle: 'Talent per game against games played: great for a long time, or a brilliant flash?',
      quadrants: { tr: 'Peak & longevity', tl: 'Flash', br: 'Compilers', bl: 'Role players' },
    },
  },
  {
    id: 'vor',
    name: 'Value (VOR)',
    config: {
      ...DEFAULT_CONFIG,
      x: 'vor',
      y: 'vorPer16',
      title: 'Value over replacement',
      subtitle: 'Total value above a replacement-level player against value per 16 games: pillars, compilers and per-game monsters.',
      quadrants: { tr: 'Franchise pillars', tl: 'Per-game monsters', br: 'Compilers', bl: 'Replacement level' },
      xSplit: { value: 0, label: 'replacement' },
      trend: false,
    },
  },
  {
    id: 'efficiency',
    name: `Efficiency vs volume (${position})`,
    config: {
      ...DEFAULT_CONFIG,
      x: EFF_AXES[position].x,
      y: EFF_AXES[position].y,
      pos: [position],
      minGames: 0,
      qualifyBy: HEADLINE_METRIC[position],
      title: `${position} efficiency vs volume`,
      subtitle: 'Who does it efficiently at volume, and who just piles it up?',
      quadrants: { tr: 'Efficient volume', br: 'Volume compiler', tl: 'Efficient in a small role', bl: 'Struggling' },
    },
  },
  {
    id: 'skill',
    name: 'Skill vs OVR',
    config: {
      ...DEFAULT_CONFIG,
      x: 'ovr',
      y: 'skill',
      minGames: 0,
      diagonal: true,
      title: 'Skill rating vs OVR',
      subtitle: 'Above the diagonal the per-game skill outplays the overall: underrated or rising. Below it, a career-built overall.',
      quadrants: { tr: 'Stars', tl: 'Underrated / rising', br: 'Career-built', bl: 'Depth' },
    },
  },
];

const PRESET_KEY = 'retroVault:graphPresets';
const PRESET_EVENT = 'retrovault:graph-presets';

const readPresets = (): GraphPreset[] => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PRESET_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((r: { id?: unknown; name?: unknown; params?: Record<string, string> }) => {
      const config = r.params ? paramsToConfig(r.params) : null;
      return config && typeof r.id === 'string' && typeof r.name === 'string' ? [{ id: r.id, name: r.name, config }] : [];
    });
  } catch {
    return [];
  }
};

/** Saved Graph Builder presets (pinned to the Lab), per viewer. */
export const useSavedPresets = () => {
  const [presets, setPresets] = useState<GraphPreset[]>(readPresets);
  useEffect(() => {
    const sync = () => setPresets(readPresets());
    window.addEventListener(PRESET_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PRESET_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const write = useCallback((next: GraphPreset[]) => {
    try {
      window.localStorage.setItem(PRESET_KEY, JSON.stringify(next.map((p) => ({ id: p.id, name: p.name, params: configToParams(p.config) }))));
    } catch {
      /* storage blocked: keep the in-memory list */
    }
    setPresets(next);
    window.dispatchEvent(new Event(PRESET_EVENT));
  }, []);
  const save = useCallback((name: string, config: GraphConfig) => write([...readPresets(), { id: `p${Date.now().toString(36)}`, name, config }]), [write]);
  const remove = useCallback((id: string) => write(readPresets().filter((p) => p.id !== id)), [write]);
  return { presets, save, remove };
};

// ---------- Config → plot ----------

/** Positions where every chosen stat applies. */
export const applicablePositions = (c: GraphConfig): Position[] => {
  const stats = [c.x, c.y, c.size].filter(Boolean).map((id) => STAT_BY_ID.get(id as string)).filter((s): s is GraphStat => !!s);
  return POSITIONS.filter((p) => stats.every((s) => s.positions.includes(p)));
};

export const POSITION_COLORS: Record<Position, string> = {
  QB: '#3987e5',
  RB: '#d95926',
  WR: '#199e70',
  TE: '#c94fc9',
  OL: '#9aa3c0',
  LB: '#e5b83a',
  DB: '#4fc3d9',
  DL: '#e5484d',
};

/** Legacy tier colours: the gold ramp used by the Hall of Fame charts, neutral below the bar. */
export const TIER_COLORS: Record<string, string> = {
  legendary: 'hsl(45 100% 70%)',
  elite: 'hsl(41 92% 56%)',
  great: 'hsl(37 80% 44%)',
  inductee: 'hsl(33 64% 33%)',
  none: 'hsl(226 22% 46%)',
};

const autoQuadrants = (x: GraphStat, y: GraphStat, yInvert: boolean): Quadrants => {
  const hiY = yInvert ? `low ${y.short}` : `high ${y.short}`;
  const loY = yInvert ? `high ${y.short}` : `low ${y.short}`;
  return { tr: `High ${x.short}, ${hiY}`, tl: `Low ${x.short}, ${hiY}`, br: `High ${x.short}, ${loY}`, bl: `Low ${x.short}, ${loY}` };
};

export interface GraphModel {
  xs: GraphStat;
  ys: GraphStat;
  ss?: GraphStat;
  points: LPoint[];
  spec: LandscapeSpec;
  positions: Position[];
  shown: Position[];
}

/** Plots a config: league players (baseline) plus optional real NFL legends, filtered as the config says. */
export const buildGraph = (c: GraphConfig, players: Player[], legends: Player[], deps: GraphDeps): GraphModel | null => {
  const xs = STAT_BY_ID.get(c.x);
  const ys = STAT_BY_ID.get(c.y);
  if (!xs || !ys) return null;
  const ss = c.size ? STAT_BY_ID.get(c.size) : undefined;
  const positions = applicablePositions(c);
  const shown = c.pos.length ? c.pos.filter((p) => positions.includes(p)) : positions;
  const teamId = c.team ? findNFLTeam(c.team)?.id ?? c.team : null;
  const qualify = c.qualifyBy ? METRIC_BY_ID.get(c.qualifyBy) : undefined;

  const toPoint = (p: Player, nfl: boolean): LPoint | null => {
    if (!shown.includes(p.position)) return null;
    if (p.games < c.minGames) return null;
    if (qualify && !qualify.qualifies(p)) return null;
    if (teamId && findNFLTeam(p.team)?.id !== teamId) return null;
    if (c.hof && (nfl || !isHallOfFamer(p))) return null;
    const x = xs.get(p, deps);
    const y = ys.get(p, deps);
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    if ((c.logX && x <= 0) || (c.logY && y <= 0)) return null;
    const size = ss ? ss.get(p, deps) : null;
    if (ss && (size == null || !Number.isFinite(size))) return null;
    const color =
      c.color === 'position' ? POSITION_COLORS[p.position] : c.color === 'tier' ? TIER_COLORS[nfl ? 'none' : getLegacyTier(p.careerLegacy)?.key ?? 'none'] : undefined;
    return {
      key: `${nfl ? 'nfl:' : ''}${keyOf(p)}`,
      player: p,
      x,
      y,
      xText: `${fmtStat(xs, x)} ${xs.short}`,
      yText: `${fmtStat(ys, y)} ${ys.short}`,
      nfl,
      size: ss && size != null ? size : undefined,
      sizeText: ss && size != null ? `${fmtStat(ss, size)} ${ss.short}` : undefined,
      color,
    };
  };

  const points = [...players.map((p) => toPoint(p, false)), ...legends.map((p) => toPoint(p, true))].filter((p): p is LPoint => !!p);
  const yInvert = !!ys.lowerIsBetter;
  const spec: LandscapeSpec = {
    xLabel: xs.label,
    yLabel: ys.label,
    quadrants: c.quadrants ?? autoQuadrants(xs, ys, yInvert),
    diagonal: c.diagonal,
    xSplit: c.xSplit,
    ySplit: c.ySplit ?? (ys.integer ? { value: 0.5, label: `1+ ${ys.short}` } : undefined),
    yInteger: ys.integer,
    yZero: ys.integer,
    yInvert,
    logX: c.logX,
    logY: c.logY,
    trend: c.trend,
    noSplits: !c.splits,
  };
  return { xs, ys, ss, points, spec, positions, shown };
};

export const HOF_LABEL = `Hall of Fame (${HOF_THRESHOLD.toLocaleString('en-US')}+ Career Legacy)`;
