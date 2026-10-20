import { useCallback, useMemo, useState } from 'react';
import { Building2, UserX } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import PositionBadge from '../PositionBadge';
import PlayerDetailCard from '../PlayerDetailCard';
import TeamCard from '../teams/TeamCard';
import CountUp from '../brand/CountUp';
import TeamSheet from '../teams/TeamSheet';
import PowerRanking from '../teams/PowerRanking';
import DynastyGrid from '../teams/DynastyGrid';
import { overallRating } from '../brand/ProPlayerBanner.utils';
import { latestSeasonYear, useLeagueContent } from '@/utils/leagueContent';
import { coachedByTeam } from '@/utils/frontOffice';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import { HOF_THRESHOLD } from '@/config/stats';
import {
  DIVISIONS,
  TEAM_SORTS,
  buildFranchiseRecords,
  buildTeamSummaries,
  sortTeams,
  type TeamSortKey,
  type TeamSummary,
} from '../teams/teamStats';
import { usePlayerExtras } from '@/utils/playerExtras';

type ConferenceFilter = 'all' | 'AFC' | 'NFC';
type DivisionFilter = 'all' | (typeof DIVISIONS)[number];

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
    <span className="font-pixel text-[9px] uppercase text-muted-foreground shrink-0 w-9 sm:w-auto">{label}</span>
    <div className="flex min-w-0 gap-1 overflow-x-auto scrollbar-none rounded-lg bg-secondary/50 p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'shrink-0 rounded-md px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors',
            value === o.key ? 'bg-gold text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const CONF_OPTIONS: { key: ConferenceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'AFC', label: 'AFC' },
  { key: 'NFC', label: 'NFC' },
];
const DIV_OPTIONS: { key: DivisionFilter; label: string }[] = [{ key: 'all', label: 'All' }, ...DIVISIONS.map((d) => ({ key: d, label: d }))];

const divisionLabel = (t: TeamSummary) => (t.team ? `${t.team.conference} ${t.team.division}` : 'Other');

const TeamRankingsTab = () => {
  const { careerData, getAllPlayers, dataVersion } = useLeague();
  const [sortKey, setSortKey] = useState<TeamSortKey>('power');
  const [conference, setConference] = useState<ConferenceFilter>('all');
  const [division, setDivision] = useState<DivisionFilter>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const { content } = useLeagueContent();
  const extras = usePlayerExtras();
  const officialOvr = useOfficialOvr();
  const coached = useMemo(() => coachedByTeam(content), [content]);
  const superBowls = useMemo(() => content?.superBowls ?? [], [content]);
  const lastSeason = latestSeasonYear(content);

  const league = useMemo(
    () => getAllPlayers().filter((p) => !p.isRealLegend),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [careerData, getAllPlayers, dataVersion],
  );
  const { teams, unassigned } = useMemo(() => buildTeamSummaries(league, extras.stints, superBowls), [league, extras.stints, superBowls]);
  const ovrFor = useCallback((p: Player) => overallRating(p, officialOvr), [officialOvr]);
  const records = useMemo(() => buildFranchiseRecords(teams, superBowls, ovrFor), [teams, superBowls, ovrFor]);
  const openable = useMemo(() => new Set(teams.map((t) => t.key)), [teams]);

  const visible = useMemo(
    () =>
      sortTeams(
        teams.filter(
          (t) => (conference === 'all' || t.team?.conference === conference) && (division === 'all' || t.team?.division === division),
        ),
        sortKey,
        records,
      ),
    [teams, sortKey, conference, division, records],
  );
  const groups = useMemo(() => {
    if (sortKey !== 'division') return [{ label: null as string | null, teams: visible }];
    const out: { label: string | null; teams: TeamSummary[] }[] = [];
    visible.forEach((t) => {
      const label = divisionLabel(t);
      const last = out.at(-1);
      if (last?.label === label) last.teams.push(t);
      else out.push({ label, teams: [t] });
    });
    return out;
  }, [visible, sortKey]);

  const openSummary = teams.find((t) => t.key === openKey) ?? null;
  const totals = useMemo(
    () => ({
      yourTitles: superBowls.filter((sb) => sb.yourResult === 'won').length,
      hof: league.filter((p) => (p.careerLegacy || 0) >= HOF_THRESHOLD).length,
      champions: new Set(superBowls.map((sb) => sb.winner).filter(Boolean)).size,
    }),
    [superBowls, league],
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

  const filterLabel = [conference !== 'all' ? conference : null, division !== 'all' ? division : null].filter(Boolean).join(' ');
  let tileIndex = 0;

  return (
    <div className="container py-6 sm:py-8 space-y-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="font-pixel text-[10px] uppercase text-gold">League Hub · Franchises</p>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold italic uppercase leading-none">Teams</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Every franchise in the league's {lastSeason ? `${lastSeason} years` : 'history'}: who won, who built dynasties, and who is on the roster now. Pick a team for its
            franchise page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="lamp">Franchises <b><CountUp value={teams.length} /></b></span>
          <span className="lamp">Super Bowls <b><CountUp value={superBowls.length} /></b></span>
          <span className="lamp">Champions <b><CountUp value={totals.champions} /></b></span>
          <span className="lamp">Your titles <b><CountUp value={totals.yourTitles} /></b></span>
          <span className="lamp">Hall of Famers <b><CountUp value={totals.hof} /></b></span>
        </div>
      </header>

      {/* League overview: power ranking + dynasty timeline */}
      {teams.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7 min-w-0">
            <PowerRanking teams={teams} records={records} lastSeason={lastSeason} onOpen={setOpenKey} highlight={highlight} onHighlight={setHighlight} />
          </div>
          {superBowls.length > 0 && (
            <div className="lg:col-span-5 min-w-0">
              <DynastyGrid superBowls={superBowls} openable={openable} onOpen={setOpenKey} highlight={highlight} onHighlight={setHighlight} />
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <section aria-labelledby="franchises-heading" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="franchises-heading" className="section-title text-2xl flex-1">
            Franchises
            <span className="font-pixel text-[9px] text-muted-foreground">{visible.length}</span>
          </h2>
        </div>
        <div className="glass-card flex flex-col gap-2.5 p-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
          <Segmented<TeamSortKey> label="Sort" value={sortKey} options={TEAM_SORTS} onChange={setSortKey} />
          <Segmented<ConferenceFilter> label="Conf" value={conference} options={CONF_OPTIONS} onChange={setConference} />
          <Segmented<DivisionFilter> label="Div" value={division} options={DIV_OPTIONS} onChange={setDivision} />
        </div>

        {/* Team tiles */}
        {teams.length === 0 ? (
          <div className="glass-card p-6 text-sm text-muted-foreground">
            No players have a team yet. Add a <span className="font-mono text-foreground">Team</span> column to your sheet, or set a team
            from a player's edit dialog.
          </div>
        ) : visible.length === 0 ? (
          <div className="glass-card p-6 text-sm text-muted-foreground">No {filterLabel} franchises in the league yet.</div>
        ) : (
          groups.map((g) => (
            <div key={g.label ?? 'all'} className="space-y-2">
              {g.label && <h3 className="font-display text-lg font-bold uppercase tracking-wide text-gold">{g.label}</h3>}
              <ul
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                aria-label={g.label ? `${g.label} franchises` : 'Franchises'}
              >
                {g.teams.map((summary) => (
                  <li key={summary.key} className="stagger-in" style={{ ['--i' as string]: tileIndex++ }}>
                    <TeamCard
                      summary={summary}
                      record={records.get(summary.key)}
                      onOpen={() => setOpenKey(summary.key)}
                      onHighlight={setHighlight}
                      coached={coached.get(summary.team?.id ?? summary.label)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

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
            These players have no team in your sheet. Open a player and use <span className="text-foreground">Edit</span> to set their
            team in the player edit dialog.
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
                      <span className="block text-xs text-muted-foreground">{p.games} GP</span>
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

      <TeamSheet
        summary={openSummary}
        record={openSummary ? records.get(openSummary.key) : undefined}
        coached={openSummary ? coached.get(openSummary.team?.id ?? openSummary.label) : undefined}
        league={league}
        ovrFor={ovrFor}
        onClose={() => setOpenKey(null)}
      />
      <PlayerDetailCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
};

export default TeamRankingsTab;
