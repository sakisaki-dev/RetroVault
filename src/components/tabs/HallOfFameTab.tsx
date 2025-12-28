import { useMemo, useState } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Crown, Trophy, Star, Medal, Sparkles, Flame, Award, ChevronRight, Zap } from 'lucide-react';
import type { Player } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const HOF_THRESHOLD = 6000;

// Adjusted tiers to be more spread out
const getTier = (legacy: number) => {
  if (legacy >= 10000) return { 
    label: 'LEGENDARY', 
    icon: Flame,
    color: 'text-chart-4', 
    bg: 'bg-gradient-to-r from-chart-4/30 via-chart-4/20 to-chart-4/10', 
    border: 'border-chart-4',
    glow: 'shadow-chart-4/30',
    ring: 'ring-chart-4/50'
  };
  if (legacy >= 8500) return { 
    label: 'ELITE', 
    icon: Crown,
    color: 'text-amber-400', 
    bg: 'bg-gradient-to-r from-amber-500/30 via-amber-500/20 to-amber-500/10', 
    border: 'border-amber-400',
    glow: 'shadow-amber-400/30',
    ring: 'ring-amber-400/50'
  };
  if (legacy >= 7500) return { 
    label: 'GREAT', 
    icon: Star,
    color: 'text-primary', 
    bg: 'bg-gradient-to-r from-primary/30 via-primary/20 to-primary/10', 
    border: 'border-primary',
    glow: 'shadow-primary/30',
    ring: 'ring-primary/50'
  };
  return { 
    label: 'INDUCTEE', 
    icon: Award,
    color: 'text-muted-foreground', 
    bg: 'bg-gradient-to-r from-muted/30 via-muted/20 to-muted/10', 
    border: 'border-muted-foreground/50',
    glow: 'shadow-muted/20',
    ring: 'ring-muted/30'
  };
};

const HallOfFameTab = () => {
  const { careerData } = useLeague();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const { hofPlayers, tierCounts } = useMemo(() => {
    if (!careerData) return { hofPlayers: [], tierCounts: { legendary: 0, elite: 0, great: 0, inductee: 0 } };

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

    const hof = allPlayers
      .filter((p) => p.careerLegacy >= HOF_THRESHOLD)
      .sort((a, b) => b.careerLegacy - a.careerLegacy);

    const counts = {
      legendary: hof.filter(p => p.careerLegacy >= 10000).length,
      elite: hof.filter(p => p.careerLegacy >= 8500 && p.careerLegacy < 10000).length,
      great: hof.filter(p => p.careerLegacy >= 7500 && p.careerLegacy < 8500).length,
      inductee: hof.filter(p => p.careerLegacy >= 6000 && p.careerLegacy < 7500).length,
    };

    return { hofPlayers: hof, tierCounts: counts };
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

  const legendaryPlayers = hofPlayers.filter(p => p.careerLegacy >= 10000);
  const elitePlayers = hofPlayers.filter(p => p.careerLegacy >= 8500 && p.careerLegacy < 10000);
  const greatPlayers = hofPlayers.filter(p => p.careerLegacy >= 7500 && p.careerLegacy < 8500);
  const inducteePlayers = hofPlayers.filter(p => p.careerLegacy < 7500);

  const PlayerCard = ({ player, index, featured = false }: { player: Player; index: number; featured?: boolean }) => {
    const tier = getTier(player.careerLegacy);
    const teamColors = getTeamColors(player.team);
    const TierIcon = tier.icon;
    const isDefensive = ['LB', 'DB', 'DL'].includes(player.position);

    return (
      <button
        onClick={() => setSelectedPlayer(player)}
        className={`group relative overflow-hidden rounded-xl border text-left transition-all duration-300 hover:scale-[1.02] ${tier.border} ${featured ? 'p-8' : 'p-5'} ${tier.bg} hover:shadow-lg ${tier.glow}`}
      >
        {/* Glow effect for legendary */}
        {player.careerLegacy >= 10000 && (
          <div className="absolute inset-0 bg-gradient-to-r from-chart-4/10 via-transparent to-chart-4/10 animate-pulse" />
        )}
        
        {/* Rank Badge */}
        <div className={`absolute top-3 right-3 font-display font-bold text-muted-foreground/20 ${featured ? 'text-6xl' : 'text-3xl'}`}>
          #{index + 1}
        </div>

        <div className="relative">
          {/* Tier Badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${tier.color} bg-background/50 backdrop-blur-sm border ${tier.border} mb-3`}>
            <TierIcon className="w-3.5 h-3.5" />
            {tier.label}
          </div>

          {/* Player Name */}
          <h3 className={`font-bold mb-1 group-hover:text-primary transition-colors ${featured ? 'text-2xl' : 'text-lg'}`}>
            {player.name}
          </h3>
          {player.nickname && (
            <p className={`text-muted-foreground italic mb-2 ${featured ? 'text-base' : 'text-sm'}`}>"{player.nickname}"</p>
          )}

          {/* Position & Team */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <PositionBadge position={player.position} />
            {player.team && (
              <span
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={teamColors ? { backgroundColor: `hsl(${teamColors.primary} / 0.2)`, color: `hsl(${teamColors.primary})` } : undefined}
              >
                {player.team}
              </span>
            )}
          </div>

          {/* Legacy Score - prominent */}
          <div className={`mb-4 p-3 rounded-lg bg-background/30 border ${tier.border}`}>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Career Legacy</p>
            <p className={`font-mono font-bold ${tier.color} ${featured ? 'text-4xl' : 'text-2xl'}`}>
              {player.careerLegacy.toFixed(0)}
            </p>
          </div>

          {/* Awards Row */}
          <div className={`grid gap-3 ${featured ? 'grid-cols-4' : 'grid-cols-2'}`}>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-chart-4" />
              <span className="font-mono font-bold">{player.rings}</span>
              <span className="text-xs text-muted-foreground">Rings</span>
            </div>
            <div className="flex items-center gap-2">
              <Medal className="w-4 h-4 text-primary" />
              <span className="font-mono font-bold">{player.mvp}</span>
              <span className="text-xs text-muted-foreground">MVP</span>
            </div>
            {featured && (
              <>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-chart-2" />
                  <span className="font-mono font-bold">{player.opoy}</span>
                  <span className="text-xs text-muted-foreground">{isDefensive ? 'DPOY' : 'OPOY'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span className="font-mono font-bold">{player.sbmvp}</span>
                  <span className="text-xs text-muted-foreground">SBMVP</span>
                </div>
              </>
            )}
          </div>

          {/* Stats footer */}
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <span className="font-mono font-medium text-foreground">{player.games}</span> Games • 
              <span className="font-mono font-medium text-foreground ml-1">{player.trueTalent.toFixed(0)}</span> Talent
            </p>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      {/* Grand Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-chart-4/20 via-amber-500/10 to-primary/20 p-8 border border-chart-4/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InN0YXJzIiB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMSIvPjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjAuNSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC4xIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMC41IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjc3RhcnMpIi8+PC9zdmc+')] opacity-50" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-chart-4/20 border-2 border-chart-4/50 mb-4 shadow-lg shadow-chart-4/20">
            <Crown className="w-10 h-10 text-chart-4" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-wider bg-gradient-to-r from-chart-4 via-amber-400 to-chart-4 bg-clip-text text-transparent mb-3">
            HALL OF FAME
          </h1>
          <p className="text-muted-foreground text-lg mb-6">Immortalized Legends of the Game</p>
          
          {/* Tier Legend */}
          <div className="flex justify-center gap-4 md:gap-8 flex-wrap text-sm">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-chart-4/10 border border-chart-4/30">
              <Flame className="w-4 h-4 text-chart-4" />
              <span className="text-chart-4 font-bold">LEGENDARY</span>
              <span className="text-muted-foreground">≥10k</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-chart-4/20 text-chart-4 font-mono text-xs">{tierCounts.legendary}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-400/30">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-bold">ELITE</span>
              <span className="text-muted-foreground">≥8.5k</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-amber-400/20 text-amber-400 font-mono text-xs">{tierCounts.elite}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
              <Star className="w-4 h-4 text-primary" />
              <span className="text-primary font-bold">GREAT</span>
              <span className="text-muted-foreground">≥7.5k</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-primary/20 text-primary font-mono text-xs">{tierCounts.great}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/10 border border-muted/30">
              <Award className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground font-bold">INDUCTEE</span>
              <span className="text-muted-foreground">≥6k</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-muted/20 text-muted-foreground font-mono text-xs">{tierCounts.inductee}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legendary Section */}
      {legendaryPlayers.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-chart-4/20 border border-chart-4/30">
              <Flame className="w-5 h-5 text-chart-4" />
            </div>
            <h2 className="font-display text-2xl font-bold text-chart-4">LEGENDARY</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-chart-4/50 to-transparent" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {legendaryPlayers.map((player, i) => (
              <PlayerCard key={player.name} player={player} index={i} featured />
            ))}
          </div>
        </section>
      )}

      {/* Elite Section */}
      {elitePlayers.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/30">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-amber-400">ELITE</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-amber-400/50 to-transparent" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {elitePlayers.map((player, i) => (
              <PlayerCard key={player.name} player={player} index={legendaryPlayers.length + i} />
            ))}
          </div>
        </section>
      )}

      {/* Great Section */}
      {greatPlayers.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-primary">GREAT</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/50 to-transparent" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {greatPlayers.map((player, i) => (
              <PlayerCard key={player.name} player={player} index={legendaryPlayers.length + elitePlayers.length + i} />
            ))}
          </div>
        </section>
      )}

      {/* Inductee Section */}
      {inducteePlayers.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-muted/20 border border-muted/30">
              <Award className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold text-muted-foreground">INDUCTEES</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-muted/50 to-transparent" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {inducteePlayers.map((player, i) => (
              <PlayerCard key={player.name} player={player} index={legendaryPlayers.length + elitePlayers.length + greatPlayers.length + i} />
            ))}
          </div>
        </section>
      )}

      {hofPlayers.length === 0 && (
        <div className="text-center py-20">
          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No players have reached the Hall of Fame threshold yet.</p>
          <p className="text-muted-foreground text-sm mt-2">Career Legacy ≥ {HOF_THRESHOLD.toLocaleString()} required</p>
        </div>
      )}

      {/* Player Detail Dialog */}
      <Dialog open={!!selectedPlayer} onOpenChange={() => setSelectedPlayer(null)}>
        <DialogContent className="max-w-lg">
          {selectedPlayer && (() => {
            const tier = getTier(selectedPlayer.careerLegacy);
            const teamColors = getTeamColors(selectedPlayer.team);
            const TierIcon = tier.icon;
            const isDefensive = ['LB', 'DB', 'DL'].includes(selectedPlayer.position);

            return (
              <ScrollArea className="max-h-[80vh]">
                <div className="p-2">
                  {/* Header */}
                  <div className={`p-6 rounded-xl ${tier.bg} border ${tier.border} mb-6`}>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${tier.color} bg-background/50 border ${tier.border} mb-3`}>
                      <TierIcon className="w-3.5 h-3.5" />
                      {tier.label}
                    </div>
                    <h2 className="text-2xl font-bold">{selectedPlayer.name}</h2>
                    {selectedPlayer.nickname && <p className="text-muted-foreground italic">"{selectedPlayer.nickname}"</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <PositionBadge position={selectedPlayer.position} />
                      {selectedPlayer.team && (
                        <span className="text-sm px-2 py-0.5 rounded font-medium" style={teamColors ? { backgroundColor: `hsl(${teamColors.primary} / 0.2)`, color: `hsl(${teamColors.primary})` } : undefined}>
                          {selectedPlayer.team}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Legacy Score */}
                  <div className={`text-center p-6 rounded-xl bg-background border ${tier.border} mb-6`}>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Career Legacy</p>
                    <p className={`font-mono text-5xl font-bold ${tier.color}`}>{selectedPlayer.careerLegacy.toFixed(0)}</p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-xs text-muted-foreground uppercase">True Talent</p>
                      <p className="font-mono text-2xl font-bold">{selectedPlayer.trueTalent.toFixed(0)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-xs text-muted-foreground uppercase">Dominance</p>
                      <p className="font-mono text-2xl font-bold">{selectedPlayer.dominance.toFixed(0)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-xs text-muted-foreground uppercase">Games</p>
                      <p className="font-mono text-2xl font-bold">{selectedPlayer.games}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-xs text-muted-foreground uppercase">TPG</p>
                      <p className="font-mono text-2xl font-bold">{selectedPlayer.tpg.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Awards */}
                  <div className="p-4 rounded-xl bg-chart-4/5 border border-chart-4/20">
                    <p className="text-sm font-bold text-chart-4 mb-3">HARDWARE</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-chart-4" />
                        <span className="font-mono font-bold text-lg">{selectedPlayer.rings}</span>
                        <span className="text-sm text-muted-foreground">Championships</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Medal className="w-5 h-5 text-primary" />
                        <span className="font-mono font-bold text-lg">{selectedPlayer.mvp}</span>
                        <span className="text-sm text-muted-foreground">MVP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-chart-2" />
                        <span className="font-mono font-bold text-lg">{selectedPlayer.opoy}</span>
                        <span className="text-sm text-muted-foreground">{isDefensive ? 'DPOY' : 'OPOY'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-400" />
                        <span className="font-mono font-bold text-lg">{selectedPlayer.sbmvp}</span>
                        <span className="text-sm text-muted-foreground">SB MVP</span>
                      </div>
                      {selectedPlayer.roty > 0 && (
                        <div className="flex items-center gap-2 col-span-2">
                          <Sparkles className="w-5 h-5 text-chart-3" />
                          <span className="font-mono font-bold text-lg">{selectedPlayer.roty}</span>
                          <span className="text-sm text-muted-foreground">ROTY</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HallOfFameTab;
