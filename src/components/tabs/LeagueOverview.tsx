import { useMemo } from 'react';
import type { LeagueData, Player } from '@/types/player';
import { Trophy, Users, Crown, Zap } from 'lucide-react';
import { getTeamColors } from '@/utils/teamColors';
import PositionBadge from '../PositionBadge';

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
    
    // Greatest Legacy player
    const topLegacy = [...allPlayers].sort((a, b) => b.careerLegacy - a.careerLegacy)[0];
    
    // Rising Star - highest TPG (use existing tpg field)
    const risingStars = [...activePlayers]
      .filter(p => p.tpg > 0)
      .sort((a, b) => b.tpg - a.tpg);
    const risingStar = risingStars[0];
    
    // Most Successful Team - team with highest total career legacy
    const teamStats: Record<string, { legacy: number; rings: number; players: number }> = {};
    allPlayers.forEach(p => {
      if (p.team) {
        if (!teamStats[p.team]) {
          teamStats[p.team] = { legacy: 0, rings: 0, players: 0 };
        }
        teamStats[p.team].legacy += p.careerLegacy;
        teamStats[p.team].rings += p.rings;
        teamStats[p.team].players += 1;
      }
    });
    
    const topTeam = Object.entries(teamStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.legacy - a.legacy)[0];

    return {
      total: allPlayers.length,
      active: activePlayers.length,
      retired: retiredPlayers.length,
      topLegacy,
      risingStar,
      topTeam,
    };
  }, [data]);

  const topLegacyColors = getTeamColors(stats.topLegacy?.team);
  const risingStarColors = getTeamColors(stats.risingStar?.team);
  const topTeamColors = getTeamColors(stats.topTeam?.name);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Greatest Legacy */}
      <div 
        className="relative overflow-hidden rounded-2xl border-2 p-6"
        style={{ 
          borderColor: topLegacyColors ? `hsl(${topLegacyColors.primary} / 0.4)` : 'hsl(var(--border))',
          background: topLegacyColors 
            ? `linear-gradient(135deg, hsl(${topLegacyColors.primary} / 0.15) 0%, transparent 60%)`
            : 'hsl(var(--secondary) / 0.3)'
        }}
      >
        <div 
          className="absolute top-0 right-0 w-32 h-32 opacity-20"
          style={{
            background: topLegacyColors 
              ? `radial-gradient(circle at top right, hsl(${topLegacyColors.primary}), transparent 70%)`
              : 'radial-gradient(circle at top right, hsl(var(--primary)), transparent 70%)'
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Greatest Legacy</span>
            <div 
              className="p-2 rounded-xl"
              style={{ backgroundColor: topLegacyColors ? `hsl(${topLegacyColors.primary} / 0.2)` : 'hsl(var(--primary) / 0.1)' }}
            >
              <Crown className="w-5 h-5" style={{ color: topLegacyColors ? `hsl(${topLegacyColors.primary})` : 'hsl(var(--primary))' }} />
            </div>
          </div>
          <p 
            className="font-display text-2xl font-bold truncate"
            style={{ color: topLegacyColors ? `hsl(${topLegacyColors.primary})` : 'hsl(var(--foreground))' }}
          >
            {stats.topLegacy?.name || '-'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {stats.topLegacy && <PositionBadge position={stats.topLegacy.position as any} />}
            <span className="text-sm text-muted-foreground">{stats.topLegacy?.team}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/20">
            <span 
              className="font-mono text-3xl font-bold"
              style={{ color: topLegacyColors ? `hsl(${topLegacyColors.primary})` : 'hsl(var(--primary))' }}
            >
              {stats.topLegacy?.careerLegacy.toFixed(0)}
            </span>
            <span className="text-sm text-muted-foreground ml-2">Career Legacy</span>
          </div>
        </div>
      </div>

      {/* Most Successful Team */}
      <div 
        className="relative overflow-hidden rounded-2xl border-2 p-6"
        style={{ 
          borderColor: topTeamColors ? `hsl(${topTeamColors.primary} / 0.4)` : 'hsl(var(--border))',
          background: topTeamColors 
            ? `linear-gradient(135deg, hsl(${topTeamColors.primary} / 0.15) 0%, transparent 60%)`
            : 'hsl(var(--secondary) / 0.3)'
        }}
      >
        <div 
          className="absolute top-0 right-0 w-32 h-32 opacity-20"
          style={{
            background: topTeamColors 
              ? `radial-gradient(circle at top right, hsl(${topTeamColors.primary}), transparent 70%)`
              : 'radial-gradient(circle at top right, hsl(var(--accent)), transparent 70%)'
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Most Successful Team</span>
            <div 
              className="p-2 rounded-xl"
              style={{ backgroundColor: topTeamColors ? `hsl(${topTeamColors.primary} / 0.2)` : 'hsl(var(--accent) / 0.1)' }}
            >
              <Trophy className="w-5 h-5" style={{ color: topTeamColors ? `hsl(${topTeamColors.primary})` : 'hsl(var(--accent))' }} />
            </div>
          </div>
          <p 
            className="font-display text-2xl font-bold truncate"
            style={{ color: topTeamColors ? `hsl(${topTeamColors.primary})` : 'hsl(var(--foreground))' }}
          >
            {stats.topTeam?.name || '-'}
          </p>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>{stats.topTeam?.players} players</span>
            <span>•</span>
            <span>{stats.topTeam?.rings} rings</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/20">
            <span 
              className="font-mono text-3xl font-bold"
              style={{ color: topTeamColors ? `hsl(${topTeamColors.primary})` : 'hsl(var(--accent))' }}
            >
              {stats.topTeam?.legacy.toLocaleString() || 0}
            </span>
            <span className="text-sm text-muted-foreground ml-2">Total Legacy</span>
          </div>
        </div>
      </div>

      {/* Total Players */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-border/40 p-6 bg-gradient-to-br from-secondary/40 via-transparent to-secondary/20">
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10 bg-gradient-radial from-foreground to-transparent" />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Players</span>
            <div className="p-2 rounded-xl bg-foreground/10">
              <Users className="w-5 h-5 text-foreground" />
            </div>
          </div>
          <p className="font-display text-4xl font-bold text-foreground">
            {stats.total}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm">
              <span className="font-semibold text-emerald-400">{stats.active}</span>
              <span className="text-muted-foreground ml-1">Active</span>
            </span>
            <span className="text-sm">
              <span className="font-semibold text-muted-foreground">{stats.retired}</span>
              <span className="text-muted-foreground ml-1">Retired</span>
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/20">
            <span className="text-sm text-muted-foreground">Across all positions in your league</span>
          </div>
        </div>
      </div>

      {/* Rising Star */}
      <div 
        className="relative overflow-hidden rounded-2xl border-2 p-6"
        style={{ 
          borderColor: risingStarColors ? `hsl(${risingStarColors.primary} / 0.4)` : 'hsl(var(--chart-4) / 0.4)',
          background: risingStarColors 
            ? `linear-gradient(135deg, hsl(${risingStarColors.primary} / 0.15) 0%, transparent 60%)`
            : 'linear-gradient(135deg, hsl(var(--chart-4) / 0.15) 0%, transparent 60%)'
        }}
      >
        <div 
          className="absolute top-0 right-0 w-32 h-32 opacity-20"
          style={{
            background: risingStarColors 
              ? `radial-gradient(circle at top right, hsl(${risingStarColors.primary}), transparent 70%)`
              : 'radial-gradient(circle at top right, hsl(var(--chart-4)), transparent 70%)'
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rising Star</span>
            <div 
              className="p-2 rounded-xl"
              style={{ backgroundColor: risingStarColors ? `hsl(${risingStarColors.primary} / 0.2)` : 'hsl(var(--chart-4) / 0.1)' }}
            >
              <Zap className="w-5 h-5" style={{ color: risingStarColors ? `hsl(${risingStarColors.primary})` : 'hsl(var(--chart-4))' }} />
            </div>
          </div>
          <p 
            className="font-display text-2xl font-bold truncate"
            style={{ color: risingStarColors ? `hsl(${risingStarColors.primary})` : 'hsl(var(--chart-4))' }}
          >
            {stats.risingStar?.name || '-'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {stats.risingStar && <PositionBadge position={stats.risingStar.position as any} />}
            <span className="text-sm text-muted-foreground">{stats.risingStar?.team}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/20">
            <span 
              className="font-mono text-3xl font-bold"
              style={{ color: risingStarColors ? `hsl(${risingStarColors.primary})` : 'hsl(var(--chart-4))' }}
            >
              {stats.risingStar?.tpg?.toFixed(2) || '-'}
            </span>
            <span className="text-sm text-muted-foreground ml-2">Talent/Game</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeagueOverview;
