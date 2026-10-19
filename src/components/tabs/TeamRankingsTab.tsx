import { useMemo, useState } from 'react';
import { Building2, UserX } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import PositionBadge from '../PositionBadge';
import PlayerDetailCard from '../PlayerDetailCard';
import TeamCard from '../teams/TeamCard';
import CountUp from '../brand/CountUp';
import TeamSheet from '../teams/TeamSheet';
import { useLeagueContent } from '@/utils/leagueContent';
import { coachedByTeam } from '@/utils/frontOffice';
import { TEAM_SORTS, buildTeamSummaries, sortTeams, type TeamSortKey } from '../teams/teamStats';

type ConferenceFilter = 'all' | 'AFC' | 'NFC';

const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) => (
  <div role="group" aria-label={label} className="flex items-center gap-2 min-w-0">
    <span className="font-pixel text-[10px] uppercase text-muted-foreground shrink-0">{label}</span>
    <div className="flex gap-1 overflow-x-auto scrollbar-none rounded-lg bg-secondary/50 p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
            value === o.key ? 'bg-gold text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const TeamRankingsTab = () => {
  const { careerData, getAllPlayers, dataVersion } = useLeague();
  const [sortKey, setSortKey] = useState<TeamSortKey>('legacy');
  const [conference, setConference] = useState<ConferenceFilter>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const { content } = useLeagueContent();
  const coached = useMemo(() => coachedByTeam(content), [content]);

  const { teams, unassigned } = useMemo(
    () => buildTeamSummaries(getAllPlayers()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [careerData, getAllPlayers, dataVersion],
  );

  // Rank is always by total legacy, regardless of the chosen sort
  const legacyRank = useMemo(() => {
    const m = new Map<string, number>();
    sortTeams(teams, 'legacy').forEach((t, i) => m.set(t.key, i + 1));
    return m;
  }, [teams]);

  const visible = useMemo(
    () => sortTeams(conference === 'all' ? teams : teams.filter((t) => t.team?.conference === conference), sortKey),
    [teams, sortKey, conference],
  );

  const openSummary = teams.find((t) => t.key === openKey) ?? null;
  const totals = useMemo(
    () => ({
      rings: teams.reduce((s, t) => s + t.rings, 0),
      mvps: teams.reduce((s, t) => s + t.mvps, 0),
      players: teams.reduce((s, t) => s + t.players.length, 0),
    }),
    [teams],
  );

  if (!careerData) {
    return (
      <div className="container py-16 text-center">
        <Building2 className="mx-auto mb-4 h-12 w-12 text-gold" aria-hidden="true" />
        <h1 className="font-display text-4xl font-extrabold uppercase">Teams</h1>
        <p className="mt-2 text-muted-foreground">Upload your league data to see every franchise and its roster.</p>
      </div>
    );
  }

  return (
    <div className="container py-6 sm:py-8 space-y-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-pixel text-[10px] uppercase text-gold">League Hub</p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold italic uppercase leading-none">Teams</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Every franchise with at least one player in your league. Select a team to see its roster by position.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="lamp">Teams <b><CountUp value={teams.length} /></b></span>
          <span className="lamp">Rostered <b><CountUp value={totals.players} /></b></span>
          <span className="lamp">Rings <b><CountUp value={totals.rings} /></b></span>
          <span className="lamp">MVPs <b><CountUp value={totals.mvps} /></b></span>
        </div>
      </header>

      {/* Controls */}
      <div className="glass-card flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Segmented<TeamSortKey> label="Sort" value={sortKey} options={TEAM_SORTS} onChange={setSortKey} />
        <Segmented<ConferenceFilter>
          label="Conf"
          value={conference}
          options={[
            { key: 'all', label: 'All' },
            { key: 'AFC', label: 'AFC' },
            { key: 'NFC', label: 'NFC' },
          ]}
          onChange={setConference}
        />
      </div>

      {/* Team grid */}
      {teams.length === 0 ? (
        <div className="glass-card p-6 text-sm text-muted-foreground">
          No players have a team yet. Add a <span className="font-mono text-foreground">Team</span> column to your sheet,
          or set a team from a player's edit dialog.
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card p-6 text-sm text-muted-foreground">No {conference} teams have players yet.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Franchises">
          {visible.map((summary, i) => (
            <li key={summary.key} className="stagger-in" style={{ ['--i' as string]: i }}>
              <TeamCard
                summary={summary}
                rank={legacyRank.get(summary.key) ?? 0}
                onOpen={() => setOpenKey(summary.key)}
                coached={coached.get(summary.team?.id ?? summary.label)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Unassigned bucket */}
      {unassigned.length > 0 && (
        <section className="glass-card p-4 sm:p-5" aria-labelledby="unassigned-heading">
          <div className="flex flex-wrap items-center gap-2">
            <UserX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 id="unassigned-heading" className="font-display text-2xl font-bold uppercase">
              Unassigned
            </h2>
            <span className="lamp">Players <b>{unassigned.length}</b></span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            These players have no team in your sheet. Open a player and use <span className="text-foreground">Edit</span>{' '}
            to set their team in the player edit dialog.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...unassigned]
              .sort((a, b) => (b.careerLegacy || 0) - (a.careerLegacy || 0))
              .map((p) => (
                <li key={`${p.name}-${p.position}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer(p)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-left hover:bg-secondary"
                  >
                    <PositionBadge position={p.position} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {p.games} GP
                      </span>
                    </span>
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {Math.round(p.careerLegacy || 0).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      <TeamSheet summary={openSummary} onClose={() => setOpenKey(null)} />
      <PlayerDetailCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
};

export default TeamRankingsTab;
