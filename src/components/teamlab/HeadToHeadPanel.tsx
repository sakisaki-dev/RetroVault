import { useMemo, useState } from 'react';
import { Dices, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SLOTS, headToHead, isComplete, randomLineup, type LabContext, type Lineup, type Matchup, type Preset } from '@/utils/teamLab';
import type { SavedTeam } from './useTeamLab';
import { Card, GradeChip, PlayerChip } from './parts';

interface HeadToHeadPanelProps {
  ctx: LabContext;
  lineup: Lineup;
  saved: SavedTeam[];
  presets: Preset[];
}

const MatchupRow = ({ m }: { m: Matchup }) => {
  const edgeTxt = Math.abs(m.edge) < 5 ? 'even' : m.edge > 0 ? `+${Math.round(m.edge)} you` : `+${Math.round(-m.edge)} them`;
  return (
    <li className="min-w-0">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-chalk">{m.label}</span>
        <span className={cn('shrink-0 font-display text-sm font-bold tabular-nums', m.edge >= 5 ? 'text-turf' : m.edge <= -5 ? 'text-destructive' : 'text-muted-foreground')}>
          {edgeTxt}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-[2.6rem_minmax(0,1fr)_2rem] items-center gap-x-2 gap-y-0.5 text-[11px]" aria-hidden="true">
        <span className="font-pixel text-[8px] uppercase text-gold">You</span>
        <span className="h-2 overflow-hidden rounded-sm bg-black/50">
          <span className="block h-full rounded-sm bg-gold motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${Math.max(2, m.ourScore)}%` }} />
        </span>
        <span className="text-right tabular-nums text-chalk">{Math.round(m.ourScore)}</span>
        <span className="font-pixel text-[8px] uppercase text-muted-foreground">Them</span>
        <span className="h-2 overflow-hidden rounded-sm bg-black/50">
          <span
            className="block h-full rounded-sm bg-[repeating-linear-gradient(135deg,hsl(var(--muted-foreground))_0_4px,hsl(var(--line))_4px_7px)] motion-safe:transition-[width] motion-safe:duration-500"
            style={{ width: `${Math.max(2, m.theirScore)}%` }}
          />
        </span>
        <span className="text-right tabular-nums text-chalk">{Math.round(m.theirScore)}</span>
      </div>
    </li>
  );
};

const HeadToHeadPanel = ({ ctx, lineup, saved, presets }: HeadToHeadPanelProps) => {
  const [choice, setChoice] = useState<string>('');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const options = useMemo(
    () => [
      ...saved.filter((t) => isComplete(t.lineup)).map((t) => ({ id: `saved:${t.id}`, name: t.name, lineup: t.lineup, group: 'Saved teams' })),
      ...presets.map((p) => ({ id: p.id, name: p.name, lineup: p.lineup, group: 'Franchise dynasties' })),
    ],
    [saved, presets],
  );
  const current = choice || options.find((o) => o.group === 'Franchise dynasties')?.id || options[0]?.id || 'random';
  const opp = useMemo(() => {
    if (current === 'random') return { name: 'Random team', lineup: randomLineup(ctx, seed) };
    return options.find((o) => o.id === current) ?? { name: 'Random team', lineup: randomLineup(ctx, seed) };
  }, [current, options, ctx, seed]);
  const h2h = useMemo(() => headToHead(ctx, lineup, opp.lineup), [ctx, lineup, opp]);

  return (
    <Card
      title="Head-to-head"
      icon={<Swords className="h-5 w-5 text-gold" aria-hidden="true" />}
      className="scroll-mt-28"
      action={
        <div className="flex items-center gap-1.5">
          <Select value={current} onValueChange={setChoice}>
            <SelectTrigger className="h-8 w-[min(13rem,50vw)] border-line text-sm" aria-label="Choose an opponent">
              <SelectValue placeholder="Opponent" />
            </SelectTrigger>
            <SelectContent className="z-[70]">
              {['Saved teams', 'Franchise dynasties'].map((g) =>
                options.some((o) => o.group === g) ? (
                  <SelectGroup key={g}>
                    <SelectLabel>{g}</SelectLabel>
                    {options
                      .filter((o) => o.group === g)
                      .map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ) : null,
              )}
              <SelectGroup>
                <SelectLabel>Other</SelectLabel>
                <SelectItem value="random">Random team</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {current === 'random' && (
            <Button type="button" size="sm" variant="outline" className="h-8 border-line px-2" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} aria-label="New random opponent">
              <Dices className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      }
    >
      {!h2h ? (
        <p className="text-sm text-muted-foreground">Pick an opponent with a full lineup.</p>
      ) : (
        <div className="space-y-4">
          {/* Scoreboard */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg bg-black/50 p-3 ring-1 ring-line/60">
            <div className="flex min-w-0 items-center gap-2">
              <GradeChip grade={h2h.a.team.grade} size="md" label={`Your team grade ${h2h.a.team.grade.grade}`} />
              <div className="min-w-0">
                <p className="font-pixel text-[8px] uppercase text-gold">You</p>
                <p className="truncate font-display text-base font-bold uppercase text-chalk">{h2h.a.identity.label}</p>
              </div>
            </div>
            <div className="text-center">
              <p className="font-display text-3xl font-extrabold tabular-nums text-chalk">{Math.round(h2h.winProb * 100)}%</p>
              <p className="font-pixel text-[7px] uppercase text-muted-foreground">Est. win chance</p>
            </div>
            <div className="flex min-w-0 items-center justify-end gap-2 text-right">
              <div className="min-w-0">
                <p className="truncate font-pixel text-[8px] uppercase text-muted-foreground">{opp.name}</p>
                <p className="truncate font-display text-base font-bold uppercase text-chalk">{h2h.b.identity.label}</p>
              </div>
              <GradeChip grade={h2h.b.team.grade} size="md" label={`Opponent team grade ${h2h.b.team.grade.grade}`} />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Estimate only: a logistic curve of the team-rating gap ({h2h.a.team.raw.toFixed(1)} vs {h2h.b.team.raw.toFixed(1)}), not a game simulation.
          </p>

          {/* Unit vs unit */}
          <div className="grid gap-4 md:grid-cols-2">
            {(['offense', 'defense'] as const).map((side) => (
              <div key={side}>
                <p className="mb-1.5 font-pixel text-[9px] uppercase text-muted-foreground">{side === 'offense' ? 'When you have the ball' : 'When they have the ball'}</p>
                <ul className="space-y-2.5">
                  {h2h.matchups
                    .filter((m) => m.side === side)
                    .map((m) => (
                      <MatchupRow key={m.id} m={m} />
                    ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Mismatches */}
          <div>
            <p className="mb-1.5 font-pixel text-[9px] uppercase text-gold">Biggest mismatches</p>
            <ul className="grid gap-2 sm:grid-cols-3">
              {h2h.mismatches.map((m) => (
                <li key={m.id} className={cn('rounded-md p-2 text-sm ring-1', m.edge >= 0 ? 'bg-turf/10 ring-turf/40' : 'bg-destructive/10 ring-destructive/40')}>
                  <p className="font-display font-bold uppercase text-chalk">{m.edge >= 0 ? 'Your edge' : 'Their edge'}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.label}: {Math.round(m.ourScore)} vs {Math.round(m.theirScore)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Matchup plan */}
          <div>
            <p className="mb-1.5 font-pixel text-[9px] uppercase text-gold">Matchup game plan</p>
            <ul className="space-y-1.5">
              {h2h.plan.map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-chalk/90">
                  <span className="font-display font-bold text-gold" aria-hidden="true">
                    ›
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-chalk">View as table · their lineup</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="stats-table">
                <caption className="sr-only">Unit matchups</caption>
                <thead>
                  <tr>
                    <th scope="col">Matchup</th>
                    <th scope="col" className="num">
                      You
                    </th>
                    <th scope="col" className="num">
                      Them
                    </th>
                    <th scope="col" className="num">
                      Edge
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {h2h.matchups.map((m) => (
                    <tr key={m.id}>
                      <th scope="row" className="text-left font-medium normal-case text-chalk">
                        {m.label}
                      </th>
                      <td className="num">{Math.round(m.ourScore)}</td>
                      <td className="num">{Math.round(m.theirScore)}</td>
                      <td className="num">{m.edge > 0 ? `+${Math.round(m.edge)}` : Math.round(m.edge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {SLOTS.map((s) => (
                <li key={s.id}>
                  <PlayerChip p={h2h.b.slots[s.id]} />
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </Card>
  );
};

export default HeadToHeadPanel;
