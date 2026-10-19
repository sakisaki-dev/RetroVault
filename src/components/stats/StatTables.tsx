import { useMemo, useState } from 'react';
import { Search, Table2, UserPlus } from 'lucide-react';
import type { LeagueData, Player, Position } from '@/types/player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { findNFLTeam } from '@/utils/nflTeams';
import TeamFilterButtons from '../TeamFilterButtons';
import PlayerEditDialog from '../PlayerEditDialog';
import QBTable from '../tables/QBTable';
import RBTable from '../tables/RBTable';
import ReceiverTable from '../tables/ReceiverTable';
import OLTable from '../tables/OLTable';
import DefenseTable from '../tables/DefenseTable';

const TABS: { pos: Position; key: keyof Omit<LeagueData, 'metadata'>; label: string }[] = [
  { pos: 'QB', key: 'quarterbacks', label: 'Quarterbacks' },
  { pos: 'RB', key: 'runningbacks', label: 'Running Backs' },
  { pos: 'WR', key: 'widereceivers', label: 'Wide Receivers' },
  { pos: 'TE', key: 'tightends', label: 'Tight Ends' },
  { pos: 'OL', key: 'offensiveline', label: 'Offensive Line' },
  { pos: 'LB', key: 'linebackers', label: 'Linebackers' },
  { pos: 'DB', key: 'defensivebacks', label: 'Defensive Backs' },
  { pos: 'DL', key: 'defensiveline', label: 'Defensive Line' },
];

const matchesSearch = (p: Player, q: string) =>
  !q || p.name.toLowerCase().includes(q) || (p.nickname ?? '').toLowerCase().includes(q);

/** Raw career tables, one position at a time, with search, team filter and Add Player. */
const StatTables = ({ data }: { data: LeagueData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const tabs = TABS.filter((t) => data[t.key].length > 0);
  const [tab, setTab] = useState<Position>(tabs[0]?.pos ?? 'QB');

  const allPlayers = useMemo(() => TABS.flatMap((t) => data[t.key] as Player[]), [data]);

  const filtered = useMemo(() => {
    const byTeam = (p: Player) => !selectedTeam || findNFLTeam(p.team)?.id === selectedTeam;
    const q = searchQuery.trim().toLowerCase();
    const out = {} as Record<Position, { team: Player[]; count: number }>;
    TABS.forEach((t) => {
      const team = (data[t.key] as Player[]).filter(byTeam);
      out[t.pos] = { team, count: team.filter((p) => matchesSearch(p, q)).length };
    });
    return out;
  }, [data, selectedTeam, searchQuery]);

  const filtering = !!selectedTeam || !!searchQuery.trim();
  const activeTab = tabs.some((t) => t.pos === tab) ? tab : tabs[0]?.pos;

  const renderTable = (pos: Position) => {
    const players = filtered[pos].team;
    switch (pos) {
      case 'QB':
        return <QBTable players={players as typeof data.quarterbacks} searchQuery={searchQuery} />;
      case 'RB':
        return <RBTable players={players as typeof data.runningbacks} searchQuery={searchQuery} />;
      case 'WR':
        return <ReceiverTable players={players as typeof data.widereceivers} position="WR" title="Wide Receivers" searchQuery={searchQuery} />;
      case 'TE':
        return <ReceiverTable players={players as typeof data.tightends} position="TE" title="Tight Ends" searchQuery={searchQuery} />;
      case 'OL':
        return <OLTable players={players as typeof data.offensiveline} searchQuery={searchQuery} />;
      case 'LB':
        return <DefenseTable players={players as typeof data.linebackers} position="LB" title="Linebackers" searchQuery={searchQuery} />;
      case 'DB':
        return <DefenseTable players={players as typeof data.defensivebacks} position="DB" title="Defensive Backs" searchQuery={searchQuery} />;
      case 'DL':
        return <DefenseTable players={players as typeof data.defensiveline} position="DL" title="Defensive Line" searchQuery={searchQuery} />;
    }
  };

  return (
    <section id="tables" aria-labelledby="tables-title" className="scroll-mt-20 space-y-3">
      <h2 id="tables-title" className="section-title text-2xl">
        <Table2 className="h-5 w-5 text-gold" aria-hidden="true" />
        Full Stat Tables
      </h2>
      <p className="text-sm text-muted-foreground">Every player&rsquo;s career line. Sort any column, or select a player for the full card.</p>

      <PlayerEditDialog
        player={null}
        isNewPlayer={isAddingPlayer}
        onClose={() => setIsAddingPlayer(false)}
        onSave={() => setIsAddingPlayer(false)}
      />

      <div className="glass-card relative space-y-4 overflow-hidden p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[12rem] max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search players by name or nickname"
              placeholder="Search players…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-border/30 bg-secondary/50 pl-10"
            />
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setIsAddingPlayer(true)}>
            <UserPlus className="mr-1 h-4 w-4" aria-hidden="true" />
            Add Player
          </Button>
        </div>
        <TeamFilterButtons players={allPlayers} selectedTeam={selectedTeam} onSelectTeam={setSelectedTeam} />
      </div>

      {activeTab && (
        <Tabs value={activeTab} onValueChange={(v) => setTab(v as Position)} className="space-y-3">
          <TabsList
            aria-label="Position"
            className="h-auto w-full justify-start gap-1 overflow-x-auto border border-line bg-panel p-1 scrollbar-none sm:w-fit"
          >
            {tabs.map((t) => (
              <TabsTrigger
                key={t.pos}
                value={t.pos}
                title={t.label}
                className="gap-1.5 font-display text-base font-bold uppercase tracking-wide data-[state=active]:bg-gold data-[state=active]:text-primary-foreground"
              >
                {t.pos}
                {filtering && (
                  <span className="font-pixel text-[9px] opacity-70">
                    <span className="sr-only">, </span>
                    {filtered[t.pos].count}
                    <span className="sr-only"> matches</span>
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.pos} value={t.pos} className="mt-0">
              {filtered[t.pos].count > 0 ? (
                renderTable(t.pos)
              ) : (
                <p className="glass-card p-6 text-center text-sm text-muted-foreground">
                  No {t.label.toLowerCase()} match these filters.
                </p>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  );
};

export default StatTables;
