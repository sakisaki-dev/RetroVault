import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Crown, Trophy, Star, Medal } from 'lucide-react';
import type { Player } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';

const HOF_THRESHOLD = 8000;

const HallOfFameTab = () => {
  const { careerData } = useLeague();

  const hofPlayers = useMemo(() => {
    if (!careerData) return [];

    const allPlayers: Player[] = [
      ...careerData.quarterbacks,
      ...careerData.runningbacks,
      ...careerData.widereceivers,
      ...careerData.tightends,
      ...careerData.offensiveline,
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ];

    return allPlayers
      .filter((p) => p.careerLegacy >= HOF_THRESHOLD)
      .sort((a, b) => b.careerLegacy - a.careerLegacy);
  }, [careerData]);

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-chart-4/10 mb-6">
            <Crown className="w-10 h-10 text-chart-4" />
          </div>
          <h2 className="font-display text-4xl font-bold mb-4 text-chart-4">HALL OF FAME</h2>
          <p className="text-muted-foreground text-lg">Upload your league data to view Hall of Fame inductees.</p>
        </div>
      </div>
    );
  }

  const getTier = (legacy: number) => {
    if (legacy >= 12000) return { label: 'LEGENDARY', color: 'text-chart-4', bg: 'bg-chart-4/20', border: 'border-chart-4' };
    if (legacy >= 10000) return { label: 'ELITE', color: 'text-metric-elite', bg: 'bg-metric-elite/20', border: 'border-metric-elite' };
    if (legacy >= 9000) return { label: 'GREAT', color: 'text-primary', bg: 'bg-primary/20', border: 'border-primary' };
    return { label: 'INDUCTEE', color: 'text-accent', bg: 'bg-accent/20', border: 'border-accent' };
  };

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="glass-card-glow p-8 mb-8 text-center">
        <Crown className="w-16 h-16 text-chart-4 mx-auto mb-4" />
        <h2 className="font-display text-5xl font-bold tracking-wider text-chart-4 mb-2">HALL OF FAME</h2>
        <p className="text-muted-foreground">Players with Career Legacy ≥ {HOF_THRESHOLD.toLocaleString()}</p>
        <div className="flex justify-center gap-6 mt-6 text-sm flex-wrap">
          <span className="text-chart-4">LEGENDARY ≥ 12000</span>
          <span className="text-metric-elite">ELITE ≥ 10000</span>
          <span className="text-primary">GREAT ≥ 9000</span>
          <span className="text-accent">INDUCTEE ≥ 8000</span>
        </div>
      </div>

      {/* HOF Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hofPlayers.map((player, index) => {
          const tier = getTier(player.careerLegacy);
          const teamColors = getTeamColors(player.team);

          return (
            <div
              key={player.name}
              className={`glass-card p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform border-l-4 ${tier.border}`}
              style={teamColors ? { borderLeftColor: `hsl(${teamColors.primary})` } : undefined}
            >
              {/* Rank Badge */}
              <div className="absolute top-4 right-4 font-display text-4xl font-bold text-muted-foreground/30">#{index + 1}</div>

              {/* Tier Badge */}
              <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${tier.bg} ${tier.color} mb-4`}>
                <Star className="w-3 h-3" />
                {tier.label}
              </div>

              {/* Player Info */}
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">{player.name}</h3>
                  {player.nickname && <p className="text-sm text-muted-foreground italic mb-2">"{player.nickname}"</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    <PositionBadge position={player.position} />
                    {player.team && (
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={
                          teamColors
                            ? { backgroundColor: `hsl(${teamColors.primary} / 0.2)`, color: `hsl(${teamColors.primary})` }
                            : undefined
                        }
                      >
                        {player.team}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Career Legacy</p>
                  <p className={`font-mono text-2xl font-bold ${tier.color}`}>{player.careerLegacy.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">True Talent</p>
                  <p className="font-mono text-xl font-bold text-foreground">{player.trueTalent.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Championships</p>
                  <div className="flex items-center gap-1">
                    <Trophy className="w-4 h-4 text-chart-4" />
                    <span className="font-mono font-bold">{player.rings}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">MVP Awards</p>
                  <div className="flex items-center gap-1">
                    <Medal className="w-4 h-4 text-primary" />
                    <span className="font-mono font-bold">{player.mvp}</span>
                  </div>
                </div>
              </div>

              {/* Games Played */}
              <div className="mt-4 pt-4 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono font-medium text-foreground">{player.games}</span> Games Played •
                  <span className="font-mono font-medium text-foreground ml-1">{player.tpg.toFixed(2)}</span> TPG
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hofPlayers.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">No players have reached the Hall of Fame threshold yet.</div>
      )}
    </div>
  );
};

export default HallOfFameTab;
