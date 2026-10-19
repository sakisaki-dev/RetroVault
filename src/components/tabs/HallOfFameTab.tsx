import { useMemo, useState } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Crown, Trophy, Star, Medal, Sparkles, Flame, Award } from 'lucide-react';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { useJerseyNumbers } from '@/utils/jerseys';
import TeamBadge from '../brand/TeamBadge';
import ProPlayerBanner from '../brand/ProPlayerBanner';
import { overallRating } from '../brand/ProPlayerBanner.utils';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import PlayerDetailCard from '../PlayerDetailCard';
import { HOF_THRESHOLD, LEGACY_TIERS, formatThreshold, getLegacyTier } from '@/config/stats';

const tierMin = (key: (typeof LEGACY_TIERS)[number]['key']) => LEGACY_TIERS.find((t) => t.key === key)!.min;

// Color scheme: Legendary=Gold, Elite=Purple, Great=Blue, Inductee=Green
const getTier = (legacy: number) => {
  if (legacy >= tierMin('legendary')) return { 
    label: 'LEGENDARY', 
    icon: Flame,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/40',
    accentHsl: '45 93% 47%', // gold
  };
  if (legacy >= tierMin('elite')) return { 
    label: 'ELITE', 
    icon: Crown,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-500/40',
    accentHsl: '271 91% 65%', // purple
  };
  if (legacy >= tierMin('great')) return { 
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
  const { careerData, getAllPlayers } = useLeague();
  const { numberFor, retiredInfo } = useJerseyNumbers();
  const officialOvr = useOfficialOvr();
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
        legendary: hof.filter(p => getLegacyTier(p.careerLegacy)?.key === 'legendary').length,
        elite: hof.filter(p => getLegacyTier(p.careerLegacy)?.key === 'elite').length,
        great: hof.filter(p => getLegacyTier(p.careerLegacy)?.key === 'great').length,
        inductee: hof.filter(p => getLegacyTier(p.careerLegacy)?.key === 'inductee').length,
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

  const legendaryPlayers = hofPlayers.filter(p => getLegacyTier(p.careerLegacy)?.key === 'legendary');
  const elitePlayers = hofPlayers.filter(p => getLegacyTier(p.careerLegacy)?.key === 'elite');
  const greatPlayers = hofPlayers.filter(p => getLegacyTier(p.careerLegacy)?.key === 'great');
  const inducteePlayers = hofPlayers.filter(p => getLegacyTier(p.careerLegacy)?.key === 'inductee');

  const PlayerCard = ({ player, rank }: { player: Player; rank: number }) => {
    const tier = getTier(player.careerLegacy);
    const nflTeam = findNFLTeam(player.team);
    const TierIcon = tier.icon;
    const number = numberFor(player);
    const retired = retiredInfo(player);

    return (
      <button
        type="button"
        onClick={() => setSelectedPlayer(player)}
        aria-label={`#${rank} ${player.name}, number ${number}${nflTeam ? `, ${nflTeam.fullName}` : ''}, ${tier.label.toLowerCase()} tier, ${Math.round(player.careerLegacy).toLocaleString()} legacy. Open details`}
        className={`group relative flex w-full flex-col overflow-hidden rounded-xl border ${tier.borderColor} bg-card text-left shadow-card hover-lift`}
      >
        <ProPlayerBanner
          size="card"
          name={player.name}
          position={player.position}
          team={player.team}
          number={number}
          ovr={overallRating(player, officialOvr)}
          hallOfFamer
          retiredBy={retired?.teamLabel ?? null}
          interactive
          topRight={
            <span aria-hidden="true" className="font-pixel text-[10px] rounded bg-black/70 px-1.5 py-1 text-gold">
              #{rank}
            </span>
          }
          className="rounded-b-none"
        />

        <div className="flex flex-1 flex-col gap-2.5 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${tier.bgColor} border ${tier.borderColor}`}>
              <TierIcon className={`w-3.5 h-3.5 ${tier.color}`} aria-hidden="true" />
              <span className={`text-[11px] font-bold ${tier.color}`}>{tier.label}</span>
            </span>
            <TeamBadge team={player.team} size="sm" />
          </div>

          <div className={`flex items-baseline justify-between py-1.5 px-3 rounded-lg bg-background/60 border ${tier.borderColor}`}>
            <span className="text-xs text-muted-foreground uppercase font-medium">Legacy</span>
            <span className={`font-display text-2xl font-bold tabular-nums ${tier.color}`}>{Math.round(player.careerLegacy).toLocaleString()}</span>
          </div>

          <dl className="grid grid-cols-4 gap-1 text-center">
            {[
              { label: 'Rings', value: player.rings, Icon: Trophy, color: 'text-amber-400' },
              { label: 'MVP', value: player.mvp, Icon: Medal, color: 'text-purple-400' },
              { label: ['LB', 'DB', 'DL'].includes(player.position) ? 'DPOY' : 'OPOY', value: player.opoy, Icon: Star, color: 'text-blue-400' },
              { label: 'SB MVP', value: player.sbmvp, Icon: Sparkles, color: 'text-emerald-400' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="flex flex-col-reverse items-center">
                <dt className="font-pixel text-[8px] uppercase text-muted-foreground mt-0.5">{label}</dt>
                <dd className="font-mono font-bold text-sm tabular-nums">{value}</dd>
                <Icon className={`w-4 h-4 ${color} mb-0.5`} aria-hidden="true" />
              </div>
            ))}
          </dl>
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
          <h2 className={`font-display text-2xl font-bold uppercase ${colorClass}`}>{title}</h2>
          <span className="text-sm text-muted-foreground">({players.length})</span>
          <div className={`flex-1 h-px ${bgClass}`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {players.map((player, i) => (
            <div key={`${player.name}-${player.position}`} className="stagger-in" style={{ ['--i' as string]: i }}>
              <PlayerCard player={player} rank={startRank + i} />
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="container py-6 sm:py-8">
      {/* Grand Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/15 via-card to-card p-5 sm:p-8 mb-8 border border-amber-500/30">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InN0YXJzIiB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC4xNSIvPjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjEiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjEiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNzdGFycykiLz48L3N2Zz4=')] opacity-60" />
        
        <div className="relative text-center">
          {/* Crown icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-400/50 mb-4" aria-hidden="true">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
          
          {/* Title */}
          <h1 className="font-display text-5xl md:text-6xl font-extrabold italic uppercase text-chalk mb-2" style={{ textShadow: '3px 3px 0 #000' }}>
            Hall of <span className="text-gold">Fame</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mb-6">
            Every player with {HOF_THRESHOLD.toLocaleString()}+ career legacy
          </p>
          
          {/* Tier Legend */}
          <div className="flex justify-center gap-3 md:gap-6 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/40">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-bold">LEGENDARY</span>
              <span className="text-muted-foreground text-sm">{formatThreshold(tierMin('legendary'))}</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-amber-500/30 text-amber-400 font-mono text-sm font-bold">{tierCounts.legendary}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/15 border border-purple-500/40">
              <Crown className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 font-bold">ELITE</span>
              <span className="text-muted-foreground text-sm">{formatThreshold(tierMin('elite'))}</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-purple-500/30 text-purple-400 font-mono text-sm font-bold">{tierCounts.elite}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-500/40">
              <Star className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-bold">GREAT</span>
              <span className="text-muted-foreground text-sm">{formatThreshold(tierMin('great'))}</span>
              <span className="ml-1 px-2 py-0.5 rounded bg-blue-500/30 text-blue-400 font-mono text-sm font-bold">{tierCounts.great}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/40">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-bold">INDUCTEE</span>
              <span className="text-muted-foreground text-sm">{formatThreshold(tierMin('inductee'))}</span>
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

      <PlayerDetailCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
};

export default HallOfFameTab;