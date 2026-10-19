import { useMemo, useState } from 'react';
import { ArrowLeftRight, Check, Scale, Users } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { isDefensivePosition } from '@/config/stats';
import { findNFLTeam } from '@/utils/nflTeams';
import { formatDecimal, getMetricTier, getTierColor, getTierLabel } from '@/utils/metricColors';
import PositionBadge from '../PositionBadge';
import PlayerSearchSelect from '../PlayerSearchSelect';
import TeamBadge from '../brand/TeamBadge';
import TeamLogo from '../brand/TeamLogo';
import CountUp from '../brand/CountUp';
import PlayerDetailCard from '../PlayerDetailCard';

type Side = 1 | 2;

interface CompareRow {
  label: string;
  /** Long label for screen readers */
  title?: string;
  get: (p: Player) => number | null;
  decimals: number;
  /** Lower is better (e.g. interceptions thrown) */
  lowerIsBetter?: boolean;
}

interface CompareSection {
  title: string;
  rows: CompareRow[];
}

const keyOf = (p: Pick<Player, 'position' | 'name'>) => `${p.position}:${p.name}`;
const rate = (n: number, d: number, scale = 1) => (d > 0 ? (n / d) * scale : null);
const num = (p: Player, k: string) => Number((p as unknown as Record<string, unknown>)[k]) || 0;

type Family = 'QB' | 'RB' | 'REC' | 'OL' | 'DEF';
const familyOf = (p: Player): Family =>
  p.position === 'QB' ? 'QB' : p.position === 'RB' ? 'RB' : p.position === 'WR' || p.position === 'TE' ? 'REC' : p.position === 'OL' ? 'OL' : 'DEF';

const POSITION_SECTIONS: Record<Family, CompareSection> = {
  QB: {
    title: 'Passing',
    rows: [
      { label: 'Pass Yards', get: (p) => num(p, 'passYds'), decimals: 0 },
      { label: 'Pass TD', get: (p) => num(p, 'passTD'), decimals: 0 },
      { label: 'INT', title: 'Interceptions thrown', get: (p) => num(p, 'interceptions'), decimals: 0, lowerIsBetter: true },
      { label: 'Cmp %', get: (p) => rate(num(p, 'completions'), num(p, 'attempts'), 100), decimals: 1 },
      { label: 'Yds / Att', get: (p) => rate(num(p, 'passYds'), num(p, 'attempts')), decimals: 2 },
      { label: 'TD : INT', get: (p) => rate(num(p, 'passTD'), num(p, 'interceptions')), decimals: 2 },
      { label: 'Rush Yards', get: (p) => num(p, 'rushYds'), decimals: 0 },
    ],
  },
  RB: {
    title: 'Rushing & Receiving',
    rows: [
      { label: 'Rush Yards', get: (p) => num(p, 'rushYds'), decimals: 0 },
      { label: 'Rush TD', get: (p) => num(p, 'rushTD'), decimals: 0 },
      { label: 'Yds / Carry', get: (p) => rate(num(p, 'rushYds'), num(p, 'rushAtt')), decimals: 2 },
      { label: 'Rec Yards', get: (p) => num(p, 'recYds'), decimals: 0 },
      { label: 'Scrim Yds / G', title: 'Scrimmage yards per game', get: (p) => rate(num(p, 'rushYds') + num(p, 'recYds'), p.games), decimals: 1 },
      { label: 'Fumbles', get: (p) => num(p, 'fumbles'), decimals: 0, lowerIsBetter: true },
    ],
  },
  REC: {
    title: 'Receiving',
    rows: [
      { label: 'Receptions', get: (p) => num(p, 'receptions'), decimals: 0 },
      { label: 'Rec Yards', get: (p) => num(p, 'recYds'), decimals: 0 },
      { label: 'Rec TD', get: (p) => num(p, 'recTD'), decimals: 0 },
      { label: 'Yds / Catch', get: (p) => rate(num(p, 'recYds'), num(p, 'receptions')), decimals: 2 },
      { label: 'Rec Yds / G', title: 'Receiving yards per game', get: (p) => rate(num(p, 'recYds'), p.games), decimals: 1 },
    ],
  },
  OL: {
    title: 'Blocking',
    rows: [
      { label: 'Blocks', get: (p) => num(p, 'blocks'), decimals: 0 },
      { label: 'Blocks / G', get: (p) => rate(num(p, 'blocks'), p.games), decimals: 2 },
    ],
  },
  DEF: {
    title: 'Defense',
    rows: [
      { label: 'Tackles', get: (p) => num(p, 'tackles'), decimals: 0 },
      { label: 'Sacks', get: (p) => num(p, 'sacks'), decimals: 0 },
      { label: 'INT', title: 'Interceptions', get: (p) => num(p, 'interceptions'), decimals: 0 },
      { label: 'Forced Fum', get: (p) => num(p, 'forcedFumbles'), decimals: 0 },
      { label: 'Tackles / G', get: (p) => rate(num(p, 'tackles'), p.games), decimals: 2 },
    ],
  },
};

const METRIC_ROWS: CompareRow[] = [
  { label: 'Career Legacy', get: (p) => p.careerLegacy, decimals: 0 },
  { label: 'True Talent', get: (p) => p.trueTalent, decimals: 1 },
  { label: 'Dominance', get: (p) => p.dominance, decimals: 1 },
  { label: 'TPG', title: 'Talent per game', get: (p) => p.tpg, decimals: 2 },
  { label: 'Games', get: (p) => p.games, decimals: 0 },
];

const METRIC_KEY: Record<string, string> = {
  'Career Legacy': 'careerLegacy',
  'True Talent': 'trueTalent',
  Dominance: 'dominance',
  TPG: 'tpg',
};

const awardRows = (p1: Player, p2: Player): CompareRow[] => {
  const d1 = isDefensivePosition(p1.position);
  const d2 = isDefensivePosition(p2.position);
  // Defenders store DPOY in `opoy`
  const poy = d1 && d2 ? 'DPOY' : !d1 && !d2 ? 'OPOY' : 'OPOY / DPOY';
  return [
    { label: 'Rings', title: 'Championships', get: (p) => p.rings, decimals: 0 },
    { label: 'MVP', get: (p) => p.mvp, decimals: 0 },
    { label: poy, title: 'Player of the Year awards', get: (p) => p.opoy, decimals: 0 },
    { label: 'SB MVP', title: 'Super Bowl MVP', get: (p) => p.sbmvp, decimals: 0 },
    { label: 'ROTY', title: 'Rookie of the Year', get: (p) => p.roty, decimals: 0 },
  ];
};

const winnerOf = (row: CompareRow, p1: Player, p2: Player): Side | null => {
  const a = row.get(p1);
  const b = row.get(p2);
  if (a == null || b == null || a === b) return null;
  return (row.lowerIsBetter ? a < b : a > b) ? 1 : 2;
};

const fmt = (v: number | null, d: number) => (v == null || !Number.isFinite(v) ? '—' : formatDecimal(v, d));

// ---------- Pieces ----------

const PlayerPanel = ({
  side,
  player,
  players,
  value,
  onChange,
  onOpen,
}: {
  side: Side;
  player: Player | null;
  players: Player[];
  value: string;
  onChange: (v: string) => void;
  onOpen: (p: Player) => void;
}) => {
  const team = findNFLTeam(player?.team);
  const accent = team ? `hsl(${team.primaryColor})` : side === 1 ? 'hsl(var(--sky))' : 'hsl(var(--flag))';
  return (
    <section
      aria-label={`Player ${side}`}
      className="glass-card relative overflow-hidden p-4 sm:p-5"
      style={{ boxShadow: `inset 0 4px 0 ${accent}, var(--shadow-card)` }}
    >
      {team && (
        <span aria-hidden="true" className={cn('pointer-events-none absolute -bottom-6 opacity-[0.1]', side === 1 ? '-right-6' : '-left-6')}>
          <TeamLogo team={team} size={160} decorative />
        </span>
      )}
      <div className="relative">
        <p className="mb-2 font-pixel text-[10px] uppercase" style={{ color: accent }}>
          Player {side}
        </p>
        <PlayerSearchSelect
          players={players}
          value={value}
          onValueChange={onChange}
          placeholder="Search for a player..."
          ariaLabel={`Player ${side}`}
        />

        {player ? (
          <div className="mt-4 border-t border-line pt-4">
            <button type="button" onClick={() => onOpen(player)} className="text-left">
              <span className="block font-display text-3xl font-extrabold uppercase leading-none hover:text-gold">{player.name}</span>
              {player.nickname && <span className="mt-0.5 block text-sm italic text-muted-foreground">"{player.nickname}"</span>}
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PositionBadge position={player.position} />
              {player.team ? (
                <TeamBadge team={player.team} size="sm" showName />
              ) : (
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">No team</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="lamp">Legacy <b><CountUp value={Math.round(player.careerLegacy)} /></b></span>
              <span className="lamp">Rings <b>{player.rings}</b></span>
              <span className="lamp">MVP <b>{player.mvp}</b></span>
              <span className="lamp">GP <b>{player.games}</b></span>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Pick a player to load their card.</p>
        )}
      </div>
    </section>
  );
};

/** Two bars growing from the middle, sized relative to the larger value. */
const SplitBar = ({ a, b, win }: { a: number | null; b: number | null; win: Side | null }) => {
  const max = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0));
  const w = (v: number | null) => (max > 0 && v != null ? `${(Math.abs(v) / max) * 100}%` : '0%');
  return (
    <div aria-hidden="true" className="mt-1.5 grid grid-cols-2 gap-1">
      <div className="flex h-1.5 justify-end overflow-hidden rounded-l-full bg-night">
        <div className={cn('h-full rounded-l-full transition-[width] duration-700', win === 1 ? 'bg-gold' : 'bg-line')} style={{ width: w(a) }} />
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-r-full bg-night">
        <div className={cn('h-full rounded-r-full transition-[width] duration-700', win === 2 ? 'bg-gold' : 'bg-line')} style={{ width: w(b) }} />
      </div>
    </div>
  );
};

const ValueCell = ({ row, player, win, side }: { row: CompareRow; player: Player; win: boolean; side: Side }) => {
  const v = row.get(player);
  const metricKey = METRIC_KEY[row.label];
  const tier = metricKey && v != null ? getMetricTier(v, metricKey) : null;
  return (
    <td className={cn('px-2 py-2.5 sm:px-4', side === 1 ? 'text-right' : 'text-left')}>
      <span className={cn('inline-flex items-center gap-1.5', side === 1 ? 'flex-row' : 'flex-row-reverse')}>
        {win && (
          <>
            <Check className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
            <span className="sr-only">Leads: </span>
          </>
        )}
        <span className={cn('font-mono text-base sm:text-lg font-bold tabular-nums', win ? 'text-gold' : 'text-chalk')}>
          {fmt(v, row.decimals)}
        </span>
      </span>
      {tier && (
        <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: getTierColor(tier) }}>
          {getTierLabel(tier, metricKey)}
        </span>
      )}
    </td>
  );
};

// ---------- Page ----------

const ComparisonTab = () => {
  const { careerData } = useLeague();
  const [player1Key, setPlayer1Key] = useState('');
  const [player2Key, setPlayer2Key] = useState('');
  const [detail, setDetail] = useState<Player | null>(null);

  const allPlayers = useMemo(() => {
    if (!careerData) return [];
    return [
      ...careerData.quarterbacks,
      ...careerData.runningbacks,
      ...careerData.widereceivers,
      ...careerData.tightends,
      ...careerData.offensiveline,
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [careerData]);

  const playerMap = useMemo(() => new Map(allPlayers.map((p) => [keyOf(p), p])), [allPlayers]);
  const player1 = playerMap.get(player1Key) ?? null;
  const player2 = playerMap.get(player2Key) ?? null;

  // Don't offer the player already picked on the other side
  const options1 = useMemo(() => allPlayers.filter((p) => keyOf(p) !== player2Key), [allPlayers, player2Key]);
  const options2 = useMemo(() => allPlayers.filter((p) => keyOf(p) !== player1Key), [allPlayers, player1Key]);

  const sections = useMemo<CompareSection[]>(() => {
    if (!player1 || !player2) return [];
    const out: CompareSection[] = [
      { title: 'Advanced Metrics', rows: METRIC_ROWS },
      { title: 'Awards', rows: awardRows(player1, player2) },
    ];
    const f1 = familyOf(player1);
    if (f1 === familyOf(player2)) out.push(POSITION_SECTIONS[f1]);
    return out;
  }, [player1, player2]);

  const score = useMemo(() => {
    if (!player1 || !player2) return { 1: 0, 2: 0 };
    const s = { 1: 0, 2: 0 };
    sections.forEach((sec) =>
      sec.rows.forEach((r) => {
        const w = winnerOf(r, player1, player2);
        if (w) s[w] += 1;
      }),
    );
    return s;
  }, [sections, player1, player2]);

  if (!careerData) {
    return (
      <div className="container py-16 text-center">
        <Scale className="mx-auto mb-4 h-12 w-12 text-gold" aria-hidden="true" />
        <h1 className="font-display text-4xl font-extrabold uppercase">Head-to-Head</h1>
        <p className="mt-2 text-muted-foreground">Upload your league data to compare players head-to-head.</p>
      </div>
    );
  }

  const winner = score[1] > score[2] ? player1 : score[2] > score[1] ? player2 : null;
  const sameFamily = player1 && player2 && familyOf(player1) === familyOf(player2);
  const swap = () => {
    setPlayer1Key(player2Key);
    setPlayer2Key(player1Key);
  };

  return (
    <div className="container py-6 sm:py-8 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-pixel text-[10px] uppercase text-gold">League Hub</p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold italic uppercase leading-none">
            Head-to-<span className="text-gold">Head</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Pick any two players. Metrics and awards always compare; position stats appear when both play the same
            position group.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="lamp">Players <b><CountUp value={allPlayers.length} /></b></span>
        </div>
      </header>

      <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-5">
        <PlayerPanel side={1} player={player1} players={options1} value={player1Key} onChange={setPlayer1Key} onOpen={setDetail} />
        <div className="flex items-center justify-center gap-3 md:flex-col">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-gold bg-black font-display text-2xl font-extrabold italic text-gold shadow-glow"
          >
            VS
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={swap}
            disabled={!player1Key && !player2Key}
            className="gap-1.5 border-line"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            Swap
          </Button>
        </div>
        <PlayerPanel side={2} player={player2} players={options2} value={player2Key} onChange={setPlayer2Key} onOpen={setDetail} />
      </div>

      {player1 && player2 ? (
        <section aria-labelledby="tale-of-tape" className="glass-card overflow-hidden">
          {/* Scoreboard */}
          <div className="scoreboard-strip grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:px-6">
            <div className="flex min-w-0 items-center justify-end gap-2 text-right">
              <span className="truncate font-display text-base sm:text-xl font-bold uppercase">{player1.name}</span>
              <TeamLogo team={player1.team} size={28} decorative />
            </div>
            <div className="flex items-center gap-2 rounded bg-black px-3 py-1.5 font-display text-3xl font-extrabold tabular-nums" aria-live="polite">
              <span className={score[1] >= score[2] ? 'text-gold' : 'text-muted-foreground'}>
                <CountUp value={score[1]} />
              </span>
              <span className="text-muted-foreground" aria-hidden="true">
                -
              </span>
              <span className="sr-only"> to </span>
              <span className={score[2] >= score[1] ? 'text-gold' : 'text-muted-foreground'}>
                <CountUp value={score[2]} />
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogo team={player2.team} size={28} decorative />
              <span className="truncate font-display text-base sm:text-xl font-bold uppercase">{player2.name}</span>
            </div>
          </div>
          <p id="tale-of-tape" className="border-b border-line px-4 py-2 text-center text-sm">
            <span className="font-pixel text-[10px] uppercase text-muted-foreground">Categories won · </span>
            {winner ? (
              <span className="font-semibold text-gold">{winner.name} leads</span>
            ) : (
              <span className="font-semibold text-chalk">Dead even</span>
            )}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <caption className="sr-only">
                {player1.name} compared with {player2.name}. Leading values are marked.
              </caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">{player1.name}</th>
                  <th scope="col">Stat</th>
                  <th scope="col">{player2.name}</th>
                </tr>
              </thead>
              {sections.map((sec) => (
                <tbody key={sec.title}>
                  <tr>
                    <th colSpan={3} scope="colgroup" className="bg-panel-2 px-4 py-1.5 text-center font-pixel text-[10px] font-normal uppercase text-gold">
                      {sec.title}
                    </th>
                  </tr>
                  {sec.rows.map((row) => {
                    const win = winnerOf(row, player1, player2);
                    return (
                      <tr key={`${sec.title}:${row.label}`} className="border-b border-border/40 last:border-b-0">
                        <ValueCell row={row} player={player1} win={win === 1} side={1} />
                        <th scope="row" className="w-[34%] px-1 py-2.5 text-center align-middle font-normal sm:w-[30%]">
                          <span className="font-display text-xs sm:text-sm font-bold uppercase tracking-wide text-muted-foreground" title={row.title}>
                            {row.label}
                          </span>
                          {row.lowerIsBetter && <span className="block text-[9px] text-muted-foreground">lower is better</span>}
                          <SplitBar a={row.get(player1)} b={row.get(player2)} win={win} />
                        </th>
                        <ValueCell row={row} player={player2} win={win === 2} side={2} />
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
          {!sameFamily && (
            <p className="border-t border-line px-4 py-3 text-center text-xs text-muted-foreground">
              Different position groups ({player1.position} vs {player2.position}): only metrics and awards are compared.
            </p>
          )}
        </section>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-line p-8 text-center sm:p-12">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold uppercase">Select two players</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Use the search boxes above to set up a head-to-head across metrics, awards and position stats.
          </p>
        </div>
      )}

      <PlayerDetailCard player={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

export default ComparisonTab;
