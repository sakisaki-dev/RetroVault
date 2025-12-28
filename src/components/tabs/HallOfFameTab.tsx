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
        className={`group relative rounded-lg border ${tier.borderColor} ${tier.bgColor} p-3 text-left transition-all hover:scale-[1.02] hover:shadow-md`}
      >
        {/* Rank */}
        <span className="absolute top-2 right-2 font-mono text-xs text-muted-foreground/50">#{rank}</span>
        
        {/* Tier icon + Name */}
        <div className="flex items-center gap-2 mb-1">
          <TierIcon className={`w-4 h-4 ${tier.color}`} />
          <span className="font-bold text-sm truncate">{player.name}</span>
        </div>

        {/* Position + Legacy */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PositionBadge position={player.position} />
            {player.team && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={teamColors ? { backgroundColor: `hsl(${teamColors.primary} / 0.2)`, color: `hsl(${teamColors.primary})` } : undefined}
              >
                {player.team}
              </span>
            )}
          </div>
          <span className={`font-mono font-bold text-sm ${tier.color}`}>{player.careerLegacy.toFixed(0)}</span>
        </div>

        {/* Awards row */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {player.rings > 0 && (
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" />{player.rings}
            </span>
          )}
          {player.mvp > 0 && (
            <span className="flex items-center gap-1">
              <Medal className="w-3 h-3 text-purple-400" />{player.mvp}
            </span>
          )}
          {player.opoy > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-blue-400" />{player.opoy}
            </span>
          )}
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
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-1.5 rounded ${bgClass} border ${borderClass}`}>
            <Icon className={`w-4 h-4 ${colorClass}`} />
          </div>
          <h3 className={`font-display text-lg font-bold ${colorClass}`}>{title}</h3>
          <span className="text-xs text-muted-foreground">({players.length})</span>
          <div className={`flex-1 h-px ${bgClass}`} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {players.map((player, i) => (
            <PlayerCard key={player.name} player={player} rank={startRank + i} />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="container mx-auto px-4 py-4">
      {/* Compact Header */}
      <div className="text-center mb-6 pb-4 border-b border-border/30">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Crown className="w-8 h-8 text-amber-400" />
          <h1 className="font-display text-4xl font-bold bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            HALL OF FAME
          </h1>
        </div>
        
        {/* Tier legend - compact */}
        <div className="flex justify-center gap-4 flex-wrap text-xs">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Flame className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400 font-semibold">Legendary</span>
            <span className="text-muted-foreground">≥10k</span>
            <span className="ml-1 px-1.5 rounded bg-amber-500/20 text-amber-400 font-mono">{tierCounts.legendary}</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/30">
            <Crown className="w-3 h-3 text-purple-400" />
            <span className="text-purple-400 font-semibold">Elite</span>
            <span className="text-muted-foreground">≥8.5k</span>
            <span className="ml-1 px-1.5 rounded bg-purple-500/20 text-purple-400 font-mono">{tierCounts.elite}</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
            <Star className="w-3 h-3 text-blue-400" />
            <span className="text-blue-400 font-semibold">Great</span>
            <span className="text-muted-foreground">≥7.5k</span>
            <span className="ml-1 px-1.5 rounded bg-blue-500/20 text-blue-400 font-mono">{tierCounts.great}</span>
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <Award className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">Inductee</span>
            <span className="text-muted-foreground">≥6k</span>
            <span className="ml-1 px-1.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">{tierCounts.inductee}</span>
          </span>
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