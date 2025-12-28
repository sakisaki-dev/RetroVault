import { useMemo, useState } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Crown, Trophy, Star, Medal, Sparkles, Flame, Award } from 'lucide-react';
import type { Player } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const HOF_THRESHOLD = 6000;

// Color scheme: Legendary=Gold, Elite=Purple, Great=Blue, Inductee=Green
const getTier = (legacy: number) => {
  if (legacy >= 10000) return { 
    label: 'LEGENDARY', 
    icon: Flame,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/40',
    accentHsl: '45 93% 47%', // gold
  };
  if (legacy >= 8500) return { 
    label: 'ELITE', 
    icon: Crown,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-500/40',
    accentHsl: '271 91% 65%', // purple
  };
  if (legacy >= 7500) return { 
    label: 'GREAT', 
    icon: Star,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/40',
    accentHsl: '217 91% 60%', // blue
  };
  return { 
    label: 'INDUCTEE', 
    icon: Award,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/40',
    accentHsl: '160 84% 39%', // green
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

    return {
      hofPlayers: hof,
      tierCounts: {
        legendary: hof.filter(p => p.careerLegacy >= 10000).length,
        elite: hof.filter(p => p.careerLegacy >= 8500 && p.careerLegacy < 10000).length,
        great: hof.filter(p => p.careerLegacy >= 7500 && p.careerLegacy < 8500).length,
        inductee: hof.filter(p => p.careerLegacy < 7500).length,
      }
    };
  }, [careerData]);

  if (!careerData) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Crown className="w-16 h-16 text-amber-400 mb-4" />
        <h2 className="font-display text-3xl font-bold text-amber-400">HALL OF FAME</h2>
        <p className="text-muted-foreground mt-2">Upload league data to view inductees</p>
      </div>
    );
  }

  const legendaryPlayers = hofPlayers.filter(p => p.careerLegacy >= 10000);
  const elitePlayers = hofPlayers.filter(p => p.careerLegacy >= 8500 && p.careerLegacy < 10000);
  const greatPlayers = hofPlayers.filter(p => p.careerLegacy >= 7500 && p.careerLegacy < 8500);
  const inducteePlayers = hofPlayers.filter(p => p.careerLegacy < 7500);

  const PlayerCard = ({ player, rank }: { player: Player; rank: number }) => {
    const tier = getTier(player.careerLegacy);
    const teamColors = getTeamColors(player.team);
    const TierIcon = tier.icon;

    return (
      <button
        onClick={() => setSelectedPlayer(player)}
        className={`group relative rounded-xl border-2 ${tier.borderColor} ${tier.bgColor} p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg w-full`}
      >
        {/* Rank badge */}
        <span className={`absolute top-3 right-3 font-display text-2xl font-bold ${tier.color} opacity-30`}>#{rank}</span>
        
        {/* Tier badge */}
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${tier.bgColor} border ${tier.borderColor} mb-2`}>
          <TierIcon className={`w-3.5 h-3.5 ${tier.color}`} />
          <span className={`text-xs font-bold ${tier.color}`}>{tier.label}</span>
        </div>

        {/* Player Name - BIG */}
        <h3 className="font-bold text-lg leading-tight mb-1 pr-8">{player.name}</h3>
        
        {/* Position & Team */}
        <div className="flex items-center gap-2 mb-3">
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
        <div className={`flex items-baseline justify-between py-2 px-3 rounded-lg bg-background/40 border ${tier.borderColor} mb-3`}>
          <span className="text-xs text-muted-foreground uppercase font-medium">Legacy</span>
          <span className={`font-mono text-2xl font-bold ${tier.color}`}>{player.careerLegacy.toFixed(0)}</span>
        </div>

        {/* Awards row - always show all */}
        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="flex flex-col items-center">
            <Trophy className="w-4 h-4 text-amber-400 mb-0.5" />
            <span className="font-mono font-bold text-sm">{player.rings}</span>
          </div>
          <div className="flex flex-col items-center">
            <Medal className="w-4 h-4 text-purple-400 mb-0.5" />
            <span className="font-mono font-bold text-sm">{player.mvp}</span>
          </div>
          <div className="flex flex-col items-center">
            <Star className="w-4 h-4 text-blue-400 mb-0.5" />
            <span className="font-mono font-bold text-sm">{player.opoy}</span>
          </div>
          <div className="flex flex-col items-center">
            <Sparkles className="w-4 h-4 text-emerald-400 mb-0.5" />
            <span className="font-mono font-bold text-sm">{player.sbmvp}</span>
          </div>
        </div>
      </button>
    );
  };

  const TierSection = ({ 
    title, 
    players, 
    startRank, 
    icon: Icon, 
    colorClass, 
    bgClass, 
    borderClass 
  }: { 
    title: string; 
    players: Player[]; 
    startRank: number;
    icon: typeof Flame;
    colorClass: string;
    bgClass: string;
    borderClass: string;
  }) => {
    if (players.length === 0) return null;
    
    return (
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${bgClass} border ${borderClass}`}>
            <Icon className={`w-5 h-5 ${colorClass}`} />
          </div>
          <h3 className={`font-display text-xl font-bold ${colorClass}`}>{title}</h3>
          <span className="text-sm text-muted-foreground">({players.length})</span>
          <div className={`flex-1 h-px ${bgClass}`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {players.map((player, i) => (
            <PlayerCard key={player.name} player={player} rank={startRank + i} />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Grand Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 via-purple-500/10 to-blue-500/20 p-8 mb-8 border border-amber-500/30">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InN0YXJzIiB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC4xNSIvPjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjEiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjEiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNzdGFycykiLz48L3N2Zz4=')] opacity-60" />
        
        <div className="relative text-center">
          {/* Crown icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-600/20 border-2 border-amber-400/50 mb-4 shadow-lg shadow-amber-500/20">
            <Crown className="w-10 h-10 text-amber-400" />
          </div>
          
          {/* Title */}
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-wider bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-3">
            HALL OF FAME
          </h1>
          <p className="text-lg text-muted-foreground mb-6">Immortalized Legends of the Game</p>
          
          {/* Tier Legend */}
          <div className="flex justify-center gap-3 md:gap-6 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/40">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-bold">LEGENDARY</span>
              <span className="text-muted-foreground text-sm">≥10k</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-amber-500/30 text-amber-400 font-mono text-sm font-bold">{tierCounts.legendary}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/15 border border-purple-500/40">
              <Crown className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 font-bold">ELITE</span>
              <span className="text-muted-foreground text-sm">≥8.5k</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-purple-500/30 text-purple-400 font-mono text-sm font-bold">{tierCounts.elite}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-500/40">
              <Star className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-bold">GREAT</span>
              <span className="text-muted-foreground text-sm">≥7.5k</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-blue-500/30 text-blue-400 font-mono text-sm font-bold">{tierCounts.great}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/40">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-bold">INDUCTEE</span>
              <span className="text-muted-foreground text-sm">≥6k</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-400 font-mono text-sm font-bold">{tierCounts.inductee}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tier Sections */}
      <TierSection 
        title="LEGENDARY" 
        players={legendaryPlayers} 
        startRank={1}
        icon={Flame}
        colorClass="text-amber-400"
        bgClass="bg-amber-500/15"
        borderClass="border-amber-500/40"
      />
      <TierSection 
        title="ELITE" 
        players={elitePlayers} 
        startRank={legendaryPlayers.length + 1}
        icon={Crown}
        colorClass="text-purple-400"
        bgClass="bg-purple-500/15"
        borderClass="border-purple-500/40"
      />
      <TierSection 
        title="GREAT" 
        players={greatPlayers} 
        startRank={legendaryPlayers.length + elitePlayers.length + 1}
        icon={Star}
        colorClass="text-blue-400"
        bgClass="bg-blue-500/15"
        borderClass="border-blue-500/40"
      />
      <TierSection 
        title="INDUCTEES" 
        players={inducteePlayers} 
        startRank={legendaryPlayers.length + elitePlayers.length + greatPlayers.length + 1}
        icon={Award}
        colorClass="text-emerald-400"
        bgClass="bg-emerald-500/15"
        borderClass="border-emerald-500/40"
      />

      {hofPlayers.length === 0 && (
        <div className="text-center py-16">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No players have reached {HOF_THRESHOLD.toLocaleString()} legacy yet</p>
        </div>
      )}

      {/* Player Detail Dialog */}
      <Dialog open={!!selectedPlayer} onOpenChange={() => setSelectedPlayer(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {selectedPlayer && (() => {
            const tier = getTier(selectedPlayer.careerLegacy);
            const teamColors = getTeamColors(selectedPlayer.team);
            const TierIcon = tier.icon;
            const isDefensive = ['LB', 'DB', 'DL'].includes(selectedPlayer.position);

            return (
              <div>
                {/* Header with tier color */}
                <div className={`${tier.bgColor} border-b ${tier.borderColor} p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded ${tier.bgColor} border ${tier.borderColor}`}>
                      <TierIcon className={`w-4 h-4 ${tier.color}`} />
                    </div>
                    <span className={`text-xs font-bold ${tier.color}`}>{tier.label}</span>
                  </div>
                  <h2 className="text-xl font-bold">{selectedPlayer.name}</h2>
                  {selectedPlayer.nickname && <p className="text-sm text-muted-foreground italic">"{selectedPlayer.nickname}"</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <PositionBadge position={selectedPlayer.position} />
                    {selectedPlayer.team && (
                      <span className="text-xs px-2 py-0.5 rounded" style={teamColors ? { backgroundColor: `hsl(${teamColors.primary} / 0.2)`, color: `hsl(${teamColors.primary})` } : undefined}>
                        {selectedPlayer.team}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Legacy Score */}
                  <div className={`text-center p-4 rounded-lg ${tier.bgColor} border ${tier.borderColor}`}>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Career Legacy</p>
                    <p className={`font-mono text-4xl font-bold ${tier.color}`}>{selectedPlayer.careerLegacy.toFixed(0)}</p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded bg-secondary/50">
                      <p className="text-[10px] text-muted-foreground uppercase">Talent</p>
                      <p className="font-mono font-bold">{selectedPlayer.trueTalent.toFixed(0)}</p>
                    </div>
                    <div className="p-2 rounded bg-secondary/50">
                      <p className="text-[10px] text-muted-foreground uppercase">Dom</p>
                      <p className="font-mono font-bold">{selectedPlayer.dominance.toFixed(0)}</p>
                    </div>
                    <div className="p-2 rounded bg-secondary/50">
                      <p className="text-[10px] text-muted-foreground uppercase">Games</p>
                      <p className="font-mono font-bold">{selectedPlayer.games}</p>
                    </div>
                    <div className="p-2 rounded bg-secondary/50">
                      <p className="text-[10px] text-muted-foreground uppercase">TPG</p>
                      <p className="font-mono font-bold">{selectedPlayer.tpg.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Awards */}
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="p-2 rounded bg-amber-500/10">
                      <Trophy className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <p className="font-mono font-bold text-sm">{selectedPlayer.rings}</p>
                      <p className="text-[9px] text-muted-foreground">Rings</p>
                    </div>
                    <div className="p-2 rounded bg-purple-500/10">
                      <Medal className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                      <p className="font-mono font-bold text-sm">{selectedPlayer.mvp}</p>
                      <p className="text-[9px] text-muted-foreground">MVP</p>
                    </div>
                    <div className="p-2 rounded bg-blue-500/10">
                      <Star className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="font-mono font-bold text-sm">{selectedPlayer.opoy}</p>
                      <p className="text-[9px] text-muted-foreground">{isDefensive ? 'DPOY' : 'OPOY'}</p>
                    </div>
                    <div className="p-2 rounded bg-emerald-500/10">
                      <Crown className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <p className="font-mono font-bold text-sm">{selectedPlayer.sbmvp}</p>
                      <p className="text-[9px] text-muted-foreground">SBMVP</p>
                    </div>
                    <div className="p-2 rounded bg-pink-500/10">
                      <Sparkles className="w-4 h-4 text-pink-400 mx-auto mb-1" />
                      <p className="font-mono font-bold text-sm">{selectedPlayer.roty}</p>
                      <p className="text-[9px] text-muted-foreground">ROTY</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HallOfFameTab;