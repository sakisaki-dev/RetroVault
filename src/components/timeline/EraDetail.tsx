import { useMemo } from 'react';
import { Swords, Trophy, Users, X } from 'lucide-react';
import type { Player } from '@/types/player';
import {
  formatYearRuns,
  getFranchiseTitles,
  matchPlayerByName,
  normalizeName,
  type LeagueContent,
} from '@/utils/leagueContent';
import { cn } from '@/lib/utils';
import MiniMarkdown from './MiniMarkdown';
import TeamLogo from './TeamLogo';
import { MarkerGlyph, markerKind } from './SuperBowlMarker';
import { teamHsl, type PlacedEra, type TimelineModel } from './timelineModel';

interface EraDetailProps {
  id: string;
  placed: PlacedEra;
  content: LeagueContent;
  model: TimelineModel;
  players: Player[];
  onPlayerSelect: (p: Player) => void;
  onClose: () => void;
  className?: string;
}

const EraDetail = ({ id, placed, content, model, players, onPlayerSelect, onClose, className }: EraDetailProps) => {
  const { era, record, dominantTeam } = placed;
  const accent = teamHsl(dominantTeam) ?? '220 10% 40%';

  const titles = useMemo(
    () => getFranchiseTitles(content.superBowls, [era.startYear, era.endYear]),
    [content.superBowls, era.startYear, era.endYear],
  );
  // Teams the era lists for you, plus any team that actually reached a Super Bowl for you in its window.
  const teams = useMemo(() => {
    const names = [...era.yourTeams];
    titles.forEach((t) => !names.includes(t.team) && names.push(t.team));
    return names.map((team) => ({ team, row: titles.find((t) => t.team === team) }));
  }, [era.yourTeams, titles]);

  const slots = model.years.filter((s) => s.year >= era.startYear && s.year <= era.endYear);
  const rivalries = content.rivalries.filter((r) => r.era === era.name);
  const overlaps = model.eras.filter(
    (o) => o.era.id !== era.id && o.era.startYear <= era.endYear && o.era.endYear >= era.startYear,
  );

  const keyPlayers = era.keyPlayers.map((raw) => {
    const qualifier = raw.match(/\((.+?)\)/)?.[1];
    const display = raw.replace(/\s*\(.+?\)\s*/g, ' ').trim();
    const player = matchPlayerByName(raw, players);
    const note = content.playerNotes.find((n) => normalizeName(n.name) === normalizeName(player?.name ?? display));
    return { raw, display, qualifier, player, note };
  });

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('relative overflow-hidden rounded-xl border border-border/40 bg-card', className)}
      style={{ borderTop: `4px solid hsl(${accent})` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-25"
        style={{ background: `linear-gradient(180deg, hsl(${accent}) 0%, transparent 100%)` }}
      />
      <div className="relative space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Y{era.startYear}–{era.endYear}
              {era.superBowlRange ? ` · Super Bowls ${era.superBowlRange}` : ''}
            </p>
            <h3 id={`${id}-title`} className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              {era.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {record.won}–{record.lost}
              </span>{' '}
              in Super Bowls this era
              {overlaps.length > 0 && <> · overlaps {overlaps.map((o) => o.era.name).join(', ')}</>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-md p-2 text-muted-foreground hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Close ${era.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Franchises this era */}
        <div className="flex flex-wrap gap-2">
          {teams.map(({ team, row }) => (
            <div
              key={team}
              className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 py-1.5 pl-1.5 pr-3"
              style={{ borderLeft: `3px solid hsl(${teamHsl(team) ?? '220 10% 40%'})` }}
            >
              <TeamLogo team={team} decorative className="h-7 w-7" />
              <div className="leading-tight">
                <p className="text-sm font-semibold">{team}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row ? (
                    <>
                      <Trophy className="mr-0.5 inline h-3 w-3 text-[hsl(45_100%_55%)]" aria-hidden />
                      {row.titles} title{row.titles === 1 ? '' : 's'}
                      {row.losses ? ` · ${row.losses} loss${row.losses === 1 ? '' : 'es'}` : ''}
                      {row.titleYears.length > 0 && <span className="hidden sm:inline"> · {formatYearRuns(row.titleYears)}</span>}
                    </>
                  ) : (
                    'No Super Bowl this era'
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Story */}
          <div className="space-y-4 lg:col-span-3">
            {era.notes && <p className="text-base leading-relaxed text-foreground/90">{era.notes}</p>}
            {era.history && <MiniMarkdown source={era.history} />}

            {(era.rival || rivalries.length > 0) && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-destructive">
                  <Swords className="h-3.5 w-3.5" aria-hidden /> Rival
                </h4>
                {era.rival && <p className="text-sm font-medium text-foreground">{era.rival}</p>}
                {rivalries.map((r) => (
                  <div key={r.id} className="mt-2 space-y-2">
                    <MiniMarkdown source={r.summary} />
                    {r.meetings.length > 0 && (
                      <ul className="flex flex-wrap gap-2" aria-label={`Super Bowls against ${r.rival}`}>
                        {r.meetings.map((m, i) => (
                          <li key={i} className="rounded border border-border/40 bg-background/60 px-2 py-1 text-xs">
                            <span className="font-semibold">{m.roman}</span>
                            {m.year ? ` · Y${m.year}` : ''} · {m.result === 'lost' ? 'L' : m.result === 'won' ? 'W' : m.result}{' '}
                            <span className="font-mono">{m.score}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: key players + Super Bowls */}
          <div className="space-y-5 lg:col-span-2">
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Users className="h-3.5 w-3.5" aria-hidden /> Key players
              </h4>
              <ul className="space-y-1.5">
                {keyPlayers.map(({ raw, display, qualifier, player, note }) => (
                  <li key={raw}>
                    {player ? (
                      <button
                        type="button"
                        onClick={() => onPlayerSelect(player)}
                        className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-primary underline-offset-2 group-hover:underline">{display}</span>
                          {qualifier && <span className="text-xs text-muted-foreground"> ({qualifier})</span>}
                          {note?.tag && <span className="block truncate text-[11px] text-muted-foreground">{note.tag}</span>}
                        </span>
                        <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                          {player.position}
                          <span className="sr-only">, open player card</span>
                        </span>
                      </button>
                    ) : (
                      <div className="px-2 py-1.5">
                        <span className="font-medium text-foreground/90">{display}</span>
                        {qualifier && <span className="text-xs text-muted-foreground"> ({qualifier})</span>}
                        {note?.tag && <span className="block text-[11px] text-muted-foreground">{note.tag}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {keyPlayers.some((k) => !k.player) && players.length > 0 && (
                <p className="mt-2 px-2 text-[11px] text-muted-foreground/80">Linked names are in your uploaded roster.</p>
              )}
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Trophy className="h-3.5 w-3.5" aria-hidden /> Super Bowls
              </h4>
              <ol className="divide-y divide-border/30 rounded-lg border border-border/40 text-sm">
                {slots.map((s) => {
                  const sb = s.sb;
                  const kind = markerKind(s);
                  const opp = sb ? (sb.yourResult === 'won' ? sb.loser : sb.yourResult === 'lost' ? sb.winner : null) : null;
                  return (
                    <li key={s.year} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="flex w-4 justify-center">
                        <MarkerGlyph kind={kind} color={s.color} />
                      </span>
                      <span className="w-10 font-mono text-xs tabular-nums text-muted-foreground">Y{s.year}</span>
                      <span className="w-16 text-xs font-semibold">{sb?.roman ?? '—'}</span>
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {!sb && 'Not yet played'}
                        {sb?.yourResult === 'won' && (
                          <>
                            <span className="font-semibold text-foreground">{sb.yourTeam}</span> over {opp}
                          </>
                        )}
                        {sb?.yourResult === 'lost' && (
                          <>
                            <span className="font-semibold text-destructive">{sb.yourTeam}</span> lost to {opp}
                          </>
                        )}
                        {sb?.yourResult === 'not in it' && (
                          <span className="text-muted-foreground">
                            {sb.winner} over {sb.loser}
                          </span>
                        )}
                        {sb?.yourResult === 'not captured' && <span className="text-muted-foreground">Not captured</span>}
                      </span>
                      {sb?.score && <span className="font-mono text-xs tabular-nums text-muted-foreground">{sb.score.replace('-', '–')}</span>}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EraDetail;
