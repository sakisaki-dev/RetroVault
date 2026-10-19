import { ArrowUpRight, Info, ListOrdered, ShieldAlert, ThumbsUp, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  BENCHMARK_SIZE,
  DEFENSE_UNITS,
  METHOD,
  OFFENSE_UNITS,
  SHRINK_GAMES,
  UNIT_LABELS,
  UNIT_WEIGHTS,
  ordinal,
  type RankRow,
  type Rollup,
  type TeamAnalysis,
  type UnitId,
  type UpgradePlan,
} from '@/utils/teamLab';
import { Card, GradeChip, PlayerChip, ScoreBar } from './parts';
import CallSheet from './CallSheet';

const GROUPS: { title: string; units: UnitId[] }[] = [
  { title: 'Offense', units: OFFENSE_UNITS },
  { title: 'Defense', units: DEFENSE_UNITS },
  { title: 'Roster', units: ['star'] },
];

const RollupTile = ({ label, r, main = false }: { label: string; r: Rollup; main?: boolean }) => (
  <div className={cn('flex min-w-0 items-center gap-3 rounded-lg bg-black/45 p-3 ring-1', main ? 'ring-gold/60' : 'ring-line/60')}>
    <GradeChip grade={r.grade} size="lg" label={`${label} grade ${r.grade.grade}`} />
    <div className="min-w-0">
      <p className="font-pixel text-[9px] uppercase text-gold">{label}</p>
      <p className="font-display text-2xl font-extrabold tabular-nums leading-none text-chalk">{Math.round(r.score)}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">better than {Math.round(r.score)}% of teams</p>
    </div>
  </div>
);

interface AnalysisPanelProps {
  analysis: TeamAnalysis;
  upgrades: UpgradePlan | null;
  ranking: RankRow[];
  onUpgrade: (slot: string, key: string) => void;
}

const AnalysisPanel = ({ analysis: a, upgrades, ranking, onUpgrade }: AnalysisPanelProps) => {
  const rankPos = ranking.findIndex((r) => r.isCurrent) + 1;
  return (
    <div className="min-w-0 space-y-4">
      {/* Identity banner */}
      <section aria-labelledby="lab-identity" className="glass-card-glow relative overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_200px_at_0%_0%,hsl(var(--gold)/0.18),transparent_70%)]" aria-hidden="true" />
        <p className="relative font-pixel text-[10px] uppercase text-gold">Team identity</p>
        <h2 id="lab-identity" className="relative mt-1 font-display text-4xl font-extrabold uppercase italic tracking-tight text-chalk sm:text-5xl glow-text">
          {a.identity.label}
        </h2>
        <p className="relative mt-2 max-w-2xl text-sm text-muted-foreground">{a.identity.why}</p>
        <div className="relative mt-4 grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
          <RollupTile label="Team overall" r={a.team} main />
          <RollupTile label="Offense" r={a.offense} />
          <RollupTile label="Defense" r={a.defense} />
        </div>
        {rankPos > 0 && ranking.length > 1 && (
          <p className="relative mt-3 text-xs text-muted-foreground">
            <span className="lamp mr-2">
              Rank <b>{rankPos}</b>/{ranking.length}
            </span>
            among your saved teams and the dynasty presets.
          </p>
        )}
      </section>

      {/* Call sheet: the in-game view */}
      <CallSheet analysis={a} />

      {/* Unit ratings */}
      <Card title="Unit ratings" icon={<TrendingUp className="h-5 w-5 text-gold" aria-hidden="true" />}>
        <p className="mb-3 text-xs text-muted-foreground">
          Each score is a percentile against {BENCHMARK_SIZE} random league lineups: 80 means better than 80% of possible teams.
        </p>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 font-pixel text-[9px] uppercase text-muted-foreground">{g.title}</p>
              <div className="space-y-1.5">
                {g.units.map((u) => (
                  <ScoreBar key={u} label={UNIT_LABELS[u]} score={a.units[u].score} grade={a.units[u].grade} hint={a.units[u].summary} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-chalk">View as table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="stats-table">
              <caption className="sr-only">Unit ratings</caption>
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col" className="num">
                    Score
                  </th>
                  <th scope="col">Grade</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.flatMap((g) => g.units).map((u) => (
                  <tr key={u}>
                    <th scope="row" className="text-left font-medium normal-case text-chalk">
                      {UNIT_LABELS[u]}
                    </th>
                    <td className="num">{Math.round(a.units[u].score)}</td>
                    <td>{a.units[u].grade.grade}</td>
                    <td className="text-xs text-muted-foreground">{a.units[u].summary ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      {/* Strengths and weaknesses */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Strengths" icon={<ThumbsUp className="h-5 w-5 text-turf" aria-hidden="true" />}>
          <ul className="space-y-2">
            {a.strengths.map((s) => (
              <li key={s.unit} className="rounded-md bg-turf/10 p-2.5 ring-1 ring-turf/40">
                <p className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-chalk">
                  <GradeChip grade={s.grade} size="sm" /> {UNIT_LABELS[s.unit]}
                  <span className="ml-auto text-xs font-normal normal-case text-muted-foreground">{ordinal(s.score)} pct</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Weaknesses" icon={<ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" />}>
          <ul className="space-y-2">
            {a.weaknesses.map((s) => (
              <li key={s.unit} className="rounded-md bg-destructive/10 p-2.5 ring-1 ring-destructive/40">
                <p className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-chalk">
                  <GradeChip grade={s.grade} size="sm" /> {UNIT_LABELS[s.unit]}
                  <span className="ml-auto text-xs font-normal normal-case text-muted-foreground">{ordinal(s.score)} pct</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Who to upgrade */}
      {upgrades && (
        <Card title="Who to upgrade" icon={<ArrowUpRight className="h-5 w-5 text-gold" aria-hidden="true" />}>
          <p className="mb-2 text-sm text-muted-foreground">
            Weakest slot: <span className="font-semibold text-chalk">{upgrades.current.position} {upgrades.current.name}</span> (skill grade{' '}
            {upgrades.current.grade?.grade ?? '—'}, {ordinal(upgrades.current.overallPct)} percentile at his position).
          </p>
          {upgrades.options.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody available raises the team rating from this slot.</p>
          ) : (
            <ul className="space-y-2">
              {upgrades.options.map((o) => (
                <li key={o.in.key} className="flex min-w-0 flex-wrap items-center gap-2">
                  <PlayerChip p={o.in} className="min-w-[12rem] flex-1" />
                  <span className="lamp" aria-label={`Team rating plus ${o.delta.toFixed(1)}`}>
                    +<b>{o.delta.toFixed(1)}</b> team
                  </span>
                  <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', o.fromCurrentTeam ? 'bg-turf/25 text-chalk' : 'bg-panel-2 text-muted-foreground')}>
                    {o.fromCurrentTeam ? 'On your Jets roster' : o.in.isLegend ? 'NFL legend' : 'Trade target'}
                  </span>
                  {o.styleMatch != null && o.styleMatch >= 1 && <span className="text-[11px] text-muted-foreground">plays like him: {Math.round(o.styleMatch)}</span>}
                  <Button type="button" size="sm" variant="outline" className="h-7 border-line px-2 text-xs" onClick={() => onUpgrade(o.slot, o.in.key)}>
                    Swap in
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {upgrades.options.length > 0 && !upgrades.options.some((o) => o.fromCurrentTeam) && (
            <p className="mt-2 text-xs text-muted-foreground">No Jets player raises the team rating from this slot, so all three are trade targets.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Projected change in the team rating (the weighted unit score, 0–100) with only this slot changed.</p>
        </Card>
      )}

      {/* Ranking */}
      {ranking.length > 1 && (
        <Card title="Where this build ranks" icon={<ListOrdered className="h-5 w-5 text-gold" aria-hidden="true" />}>
          <ol className="space-y-1">
            {ranking.map((r, i) => (
              <li
                key={r.id}
                className={cn('flex items-center gap-2 rounded px-2 py-1 text-sm', r.isCurrent ? 'bg-gold/15 ring-1 ring-gold/60' : 'bg-panel-2/40')}
                aria-current={r.isCurrent ? 'true' : undefined}
              >
                <span className="w-6 font-display font-bold tabular-nums text-gold">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-chalk">
                  {r.name}
                  {r.isCurrent && <span className="ml-1 text-xs text-gold">(you)</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{r.teamRaw.toFixed(1)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">Sorted by team rating (weighted unit scores, 0–100).</p>
        </Card>
      )}

      {/* Method */}
      <details className="glass-card group p-4 sm:p-5">
        <summary className="flex cursor-pointer items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-chalk">
          <Info className="h-5 w-5 text-gold" aria-hidden="true" /> How this is calculated
        </summary>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <p>
            Every player is rated on his skill traits (the same S–F grades as Build-a-Legend and the Deep Dive): per-position rate percentiles
            against league players. Short careers are pulled toward average ({SHRINK_GAMES} games of average added). QBs also get a sack rate
            (sacks per dropback). Defenders count by their per-game rates, summed over the four.
          </p>
          <ul className="space-y-1.5">
            {METHOD.map((m) => (
              <li key={m.unit}>
                <span className="font-semibold text-chalk">{UNIT_LABELS[m.unit]}:</span> {m.inputs}
              </li>
            ))}
          </ul>
          <p>
            Each unit is then a percentile against {BENCHMARK_SIZE} random valid lineups of league players (fixed seed, so it never shifts between
            visits). Offense ={' '}
            {OFFENSE_UNITS.map((u) => `${Math.round(UNIT_WEIGHTS.offense[u] * 100)}% ${UNIT_LABELS[u].toLowerCase()}`).join(', ')}. Defense ={' '}
            {DEFENSE_UNITS.map((u) => `${Math.round(UNIT_WEIGHTS.defense[u] * 100)}% ${UNIT_LABELS[u].toLowerCase()}`).join(', ')}. Team rating ={' '}
            {Math.round(UNIT_WEIGHTS.team.offense * 100)}% offense + {Math.round(UNIT_WEIGHTS.team.defense * 100)}% defense +{' '}
            {Math.round(UNIT_WEIGHTS.team.star * 100)}% star power; offense weighs most because you play it and the defense is simulated. Offense,
            defense and team are percentiled against the same random lineups.
          </p>
          <p>The game plan comes from rules over these unit scores and individual traits; every tip cites the numbers that triggered it.</p>
        </div>
      </details>
    </div>
  );
};

export default AnalysisPanel;
