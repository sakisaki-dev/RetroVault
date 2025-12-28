import { useMemo } from 'react';
import type { LeagueData, Player } from '@/types/player';
import { Trophy, Medal, Star, TrendingUp } from 'lucide-react';

interface LeagueOverviewProps {
  data: LeagueData;
}

const LeagueOverview = ({ data }: LeagueOverviewProps) => {
  const stats = useMemo(() => {
    const allPlayers: Player[] = [
      ...data.quarterbacks,
      ...data.runningbacks,
      ...data.widereceivers,
      ...data.tightends,
      ...data.offensiveline,
      ...data.linebackers,
      ...data.defensivebacks,
      ...data.defensiveline,
    ];

    const activePlayers = allPlayers.filter(p => p.status === 'Active');
    const retiredPlayers = allPlayers.filter(p => p.status === 'Retired');
    
    const totalRings = allPlayers.reduce((sum, p) => sum + p.rings, 0);
    const totalMVPs = allPlayers.reduce((sum, p) => sum + p.mvp, 0);
    
    // Top players by legacy
    const topByLegacy = [...allPlayers]
      .sort((a, b) => b.careerLegacy - a.careerLegacy)
      .slice(0, 5);

    return {
      total: allPlayers.length,
      active: activePlayers.length,
      retired: retiredPlayers.length,
      totalRings,
      totalMVPs,
      topByLegacy,
    };
  }, [data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total Players */}
      <div className="glass-card-glow p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm uppercase tracking-wider">Total Players</p>
            <p className="font-display text-4xl font-bold mt-1 glow-text">{stats.total}</p>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-metric-elite">{stats.active} Active</span>
              <span className="text-muted-foreground">{stats.retired} Retired</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-primary/10">
            <Star className="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>

      {/* Championships */}
      <div className="glass-card-glow p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm uppercase tracking-wider">Championships</p>
            <p className="font-display text-4xl font-bold mt-1 glow-text-accent" style={{ color: 'hsl(var(--accent))' }}>
              {stats.totalRings}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Total rings won</p>
          </div>
          <div className="p-3 rounded-lg bg-accent/10">
            <Trophy className="w-6 h-6 text-accent" />
          </div>
        </div>
      </div>

      {/* MVP Awards */}
      <div className="glass-card-glow p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm uppercase tracking-wider">MVP Awards</p>
            <p className="font-display text-4xl font-bold mt-1" style={{ color: 'hsl(var(--chart-4))' }}>
              {stats.totalMVPs}
            </p>
            <p className="text-sm text-muted-foreground mt-2">League MVP titles</p>
          </div>
          <div className="p-3 rounded-lg bg-chart-4/10">
            <Medal className="w-6 h-6 text-chart-4" />
          </div>
        </div>
      </div>

      {/* Top Legacy */}
      <div className="glass-card-glow p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm uppercase tracking-wider">Top Legacy</p>
            <p className="font-display text-2xl font-bold mt-1 glow-text truncate">
              {stats.topByLegacy[0]?.name || '-'}
            </p>
            <p className="text-sm mt-2">
              <span className="metric-elite font-mono font-medium">
                {stats.topByLegacy[0]?.careerLegacy.toFixed(0)}
              </span>
              <span className="text-muted-foreground ml-1">Career Legacy</span>
            </p>
          </div>
          <div className="p-3 rounded-lg bg-metric-elite/10">
            <TrendingUp className="w-6 h-6 text-metric-elite" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeagueOverview;
