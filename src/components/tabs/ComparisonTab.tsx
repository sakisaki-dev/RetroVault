import { useState, useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Scale, User, Trophy, Star, TrendingUp, ArrowRight, Zap, Target, Users } from 'lucide-react';
import { getTeamColors } from '@/utils/teamColors';
import { findNFLTeam } from '@/utils/nflTeams';
import PositionBadge from '../PositionBadge';
import PlayerSearchSelect from '../PlayerSearchSelect';
import type { Player } from '@/types/player';

const ComparisonTab = () => {
  const { careerData } = useLeague();
  const [player1Key, setPlayer1Key] = useState<string>('');
  const [player2Key, setPlayer2Key] = useState<string>('');

  const allPlayers = useMemo(() => {
    if (!careerData) return [];
    return [
      ...careerData.quarterbacks,
      ...careerData.runningbacks,
      ...careerData.widereceivers,
      ...careerData.tightends,
      ...careerData.offensiveline,
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [careerData]);

  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    allPlayers.forEach((p) => {
      map[`${p.position}:${p.name}`] = p;
    });
    return map;
  }, [allPlayers]);

  const player1 = player1Key ? playerMap[player1Key] : null;
  const player2 = player2Key ? playerMap[player2Key] : null;

  const player1Colors = getTeamColors(player1?.team);
  const player2Colors = getTeamColors(player2?.team);
  const nflTeam1 = findNFLTeam(player1?.team);
  const nflTeam2 = findNFLTeam(player2?.team);

  const getComparisonStats = (p1: Player | null, p2: Player | null) => {
    if (!p1 || !p2) return [];

    const stats: { label: string; p1Value: number | string; p2Value: number | string; highlight?: 1 | 2 | null }[] = [];

    // Common stats
    const addStat = (label: string, getValue: (p: Player) => number | string, numeric = true) => {
      const v1 = getValue(p1);
      const v2 = getValue(p2);
      let highlight: 1 | 2 | null = null;
      if (numeric && typeof v1 === 'number' && typeof v2 === 'number') {
        if (v1 > v2) highlight = 1;
        else if (v2 > v1) highlight = 2;
      }
      stats.push({ label, p1Value: v1, p2Value: v2, highlight });
    };

    addStat('Games', (p) => p.games);
    addStat('Career Legacy', (p) => p.careerLegacy);
    addStat('True Talent', (p) => p.trueTalent);
    addStat('Dominance', (p) => p.dominance);
    addStat('TPG', (p) => p.tpg);
    addStat('Championships', (p) => p.rings);
    addStat('MVP Awards', (p) => p.mvp);
    addStat('SB MVP', (p) => p.sbmvp);

    // Position-specific stats
    if (p1.position === 'QB' && p2.position === 'QB') {
      const q1 = p1 as any;
      const q2 = p2 as any;
      addStat('Pass Yards', () => q1.passYds, true);
      stats[stats.length - 1].p2Value = q2.passYds;
      stats[stats.length - 1].highlight = q1.passYds > q2.passYds ? 1 : q2.passYds > q1.passYds ? 2 : null;
      
      addStat('Pass TD', () => q1.passTD, true);
      stats[stats.length - 1].p2Value = q2.passTD;
      stats[stats.length - 1].highlight = q1.passTD > q2.passTD ? 1 : q2.passTD > q1.passTD ? 2 : null;
      
      addStat('Interceptions', () => q1.interceptions, true);
      stats[stats.length - 1].p2Value = q2.interceptions;
      stats[stats.length - 1].highlight = q1.interceptions < q2.interceptions ? 1 : q2.interceptions < q1.interceptions ? 2 : null;
      
      addStat('Rush Yards', () => q1.rushYds, true);
      stats[stats.length - 1].p2Value = q2.rushYds;
      stats[stats.length - 1].highlight = q1.rushYds > q2.rushYds ? 1 : q2.rushYds > q1.rushYds ? 2 : null;
    }

    if (p1.position === 'RB' && p2.position === 'RB') {
      const r1 = p1 as any;
      const r2 = p2 as any;
      addStat('Rush Yards', () => r1.rushYds, true);
      stats[stats.length - 1].p2Value = r2.rushYds;
      stats[stats.length - 1].highlight = r1.rushYds > r2.rushYds ? 1 : r2.rushYds > r1.rushYds ? 2 : null;
      
      addStat('Rush TD', () => r1.rushTD, true);
      stats[stats.length - 1].p2Value = r2.rushTD;
      stats[stats.length - 1].highlight = r1.rushTD > r2.rushTD ? 1 : r2.rushTD > r1.rushTD ? 2 : null;
      
      addStat('Rec Yards', () => r1.recYds, true);
      stats[stats.length - 1].p2Value = r2.recYds;
      stats[stats.length - 1].highlight = r1.recYds > r2.recYds ? 1 : r2.recYds > r1.recYds ? 2 : null;
    }

    if ((p1.position === 'WR' || p1.position === 'TE') && (p2.position === 'WR' || p2.position === 'TE')) {
      const w1 = p1 as any;
      const w2 = p2 as any;
      addStat('Receptions', () => w1.receptions, true);
      stats[stats.length - 1].p2Value = w2.receptions;
      stats[stats.length - 1].highlight = w1.receptions > w2.receptions ? 1 : w2.receptions > w1.receptions ? 2 : null;
      
      addStat('Rec Yards', () => w1.recYds, true);
      stats[stats.length - 1].p2Value = w2.recYds;
      stats[stats.length - 1].highlight = w1.recYds > w2.recYds ? 1 : w2.recYds > w1.recYds ? 2 : null;
      
      addStat('Rec TD', () => w1.recTD, true);
      stats[stats.length - 1].p2Value = w2.recTD;
      stats[stats.length - 1].highlight = w1.recTD > w2.recTD ? 1 : w2.recTD > w1.recTD ? 2 : null;
    }

    if (['LB', 'DB', 'DL'].includes(p1.position) && ['LB', 'DB', 'DL'].includes(p2.position)) {
      const d1 = p1 as any;
      const d2 = p2 as any;
      addStat('Tackles', () => d1.tackles, true);
      stats[stats.length - 1].p2Value = d2.tackles;
      stats[stats.length - 1].highlight = d1.tackles > d2.tackles ? 1 : d2.tackles > d1.tackles ? 2 : null;
      
      addStat('Sacks', () => d1.sacks, true);
      stats[stats.length - 1].p2Value = d2.sacks;
      stats[stats.length - 1].highlight = d1.sacks > d2.sacks ? 1 : d2.sacks > d1.sacks ? 2 : null;
      
      addStat('Interceptions', () => d1.interceptions, true);
      stats[stats.length - 1].p2Value = d2.interceptions;
      stats[stats.length - 1].highlight = d1.interceptions > d2.interceptions ? 1 : d2.interceptions > d1.interceptions ? 2 : null;
    }

    return stats;
  };

  const comparisonStats = getComparisonStats(player1, player2);

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Scale className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-4xl font-bold mb-4 text-primary">PLAYER COMPARISON</h2>
          <p className="text-muted-foreground text-lg">Upload your league data to compare players head-to-head.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-6">
      {/* Hero Header with gradient */}
      <div className="relative overflow-hidden rounded-3xl p-8 mb-8 border border-border/30"
        style={{
          background: player1Colors && player2Colors
            ? `linear-gradient(135deg, hsl(${player1Colors.primary} / 0.15) 0%, hsl(var(--background)) 50%, hsl(${player2Colors.primary} / 0.15) 100%)`
            : 'linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--background)) 50%, hsl(var(--accent) / 0.1) 100%)'
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/30 mb-4 shadow-xl shadow-primary/10">
            <Scale className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="font-display text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-2">
            HEAD-TO-HEAD
          </h1>
          <p className="text-muted-foreground text-lg">Compare any two players across all categories</p>
        </div>
      </div>

      {/* Player Selection */}
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 mb-8 items-stretch">
        {/* Player 1 Selector */}
        <div 
          className="relative rounded-2xl border-2 p-6 overflow-hidden"
          style={{
            borderColor: player1Colors ? `hsl(${player1Colors.primary} / 0.5)` : 'hsl(var(--border))',
            background: player1Colors 
              ? `linear-gradient(160deg, hsl(${player1Colors.primary} / 0.15) 0%, hsl(${player1Colors.secondary} / 0.08) 50%, transparent 100%)`
              : 'hsl(var(--secondary) / 0.3)'
          }}
        >
          {/* Team logo watermark */}
          {nflTeam1 && (
            <div className="absolute -right-8 -bottom-8 opacity-10">
              <img src={nflTeam1.logoUrl} alt="" className="w-40 h-40 object-contain" />
            </div>
          )}
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Player 1</span>
            </div>
            <PlayerSearchSelect
              players={allPlayers}
              value={player1Key}
              onValueChange={setPlayer1Key}
              placeholder="Search for a player..."
            />

            {player1 && (
              <div className="mt-5 pt-5 border-t border-border/30">
                <div className="flex items-center gap-4">
                  {nflTeam1 && (
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                      style={{ 
                        background: `linear-gradient(135deg, hsl(${nflTeam1.primaryColor} / 0.2) 0%, hsl(${nflTeam1.secondaryColor} / 0.1) 100%)`,
                        border: `2px solid hsl(${nflTeam1.primaryColor} / 0.3)`,
                      }}
                    >
                      <img src={nflTeam1.logoUrl} alt={nflTeam1.name} className="w-10 h-10 object-contain" />
                    </div>
                  )}
                  <div>
                    <p 
                      className="font-display text-2xl font-bold"
                      style={{ color: player1Colors ? `hsl(${player1Colors.primary})` : 'hsl(var(--foreground))' }}
                    >
                      {player1.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <PositionBadge position={player1.position} />
                      <span className="text-sm text-muted-foreground">{player1.team || 'Retired'}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div 
                    className="text-center p-3 rounded-xl"
                    style={{ 
                      background: `linear-gradient(135deg, hsl(var(--chart-4) / 0.15) 0%, transparent 100%)`,
                      border: '1px solid hsl(var(--chart-4) / 0.2)'
                    }}
                  >
                    <Trophy className="w-5 h-5 mx-auto text-chart-4 mb-1" />
                    <p className="font-display text-xl font-bold text-chart-4">{player1.rings}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Rings</p>
                  </div>
                  <div 
                    className="text-center p-3 rounded-xl"
                    style={{ 
                      background: `linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, transparent 100%)`,
                      border: '1px solid hsl(var(--primary) / 0.2)'
                    }}
                  >
                    <Star className="w-5 h-5 mx-auto text-primary mb-1" />
                    <p className="font-display text-xl font-bold text-primary">{player1.mvp}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">MVP</p>
                  </div>
                  <div 
                    className="text-center p-3 rounded-xl"
                    style={{ 
                      background: `linear-gradient(135deg, hsl(var(--accent) / 0.15) 0%, transparent 100%)`,
                      border: '1px solid hsl(var(--accent) / 0.2)'
                    }}
                  >
                    <TrendingUp className="w-5 h-5 mx-auto text-accent mb-1" />
                    <p className="font-display text-xl font-bold text-accent">{player1.careerLegacy.toFixed(0)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Legacy</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* VS Divider */}
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/20 to-primary/20 border-2 border-primary/30 shadow-lg shadow-primary/10">
            <span className="font-display text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">VS</span>
          </div>
        </div>

        {/* Player 2 Selector */}
        <div 
          className="relative rounded-2xl border-2 p-6 overflow-hidden"
          style={{
            borderColor: player2Colors ? `hsl(${player2Colors.primary} / 0.5)` : 'hsl(var(--border))',
            background: player2Colors 
              ? `linear-gradient(160deg, hsl(${player2Colors.primary} / 0.15) 0%, hsl(${player2Colors.secondary} / 0.08) 50%, transparent 100%)`
              : 'hsl(var(--secondary) / 0.3)'
          }}
        >
          {/* Team logo watermark */}
          {nflTeam2 && (
            <div className="absolute -left-8 -bottom-8 opacity-10">
              <img src={nflTeam2.logoUrl} alt="" className="w-40 h-40 object-contain" />
            </div>
          )}
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <User className="w-4 h-4 text-accent" />
              </div>
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Player 2</span>
            </div>
            <PlayerSearchSelect
              players={allPlayers}
              value={player2Key}
              onValueChange={setPlayer2Key}
              placeholder="Search for a player..."
            />

            {player2 && (
              <div className="mt-5 pt-5 border-t border-border/30">
                <div className="flex items-center gap-4">
                  {nflTeam2 && (
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                      style={{ 
                        background: `linear-gradient(135deg, hsl(${nflTeam2.primaryColor} / 0.2) 0%, hsl(${nflTeam2.secondaryColor} / 0.1) 100%)`,
                        border: `2px solid hsl(${nflTeam2.primaryColor} / 0.3)`,
                      }}
                    >
                      <img src={nflTeam2.logoUrl} alt={nflTeam2.name} className="w-10 h-10 object-contain" />
                    </div>
                  )}
                  <div>
                    <p 
                      className="font-display text-2xl font-bold"
                      style={{ color: player2Colors ? `hsl(${player2Colors.primary})` : 'hsl(var(--foreground))' }}
                    >
                      {player2.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <PositionBadge position={player2.position} />
                      <span className="text-sm text-muted-foreground">{player2.team || 'Retired'}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div 
                    className="text-center p-3 rounded-xl"
                    style={{ 
                      background: `linear-gradient(135deg, hsl(var(--chart-4) / 0.15) 0%, transparent 100%)`,
                      border: '1px solid hsl(var(--chart-4) / 0.2)'
                    }}
                  >
                    <Trophy className="w-5 h-5 mx-auto text-chart-4 mb-1" />
                    <p className="font-display text-xl font-bold text-chart-4">{player2.rings}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Rings</p>
                  </div>
                  <div 
                    className="text-center p-3 rounded-xl"
                    style={{ 
                      background: `linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, transparent 100%)`,
                      border: '1px solid hsl(var(--primary) / 0.2)'
                    }}
                  >
                    <Star className="w-5 h-5 mx-auto text-primary mb-1" />
                    <p className="font-display text-xl font-bold text-primary">{player2.mvp}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">MVP</p>
                  </div>
                  <div 
                    className="text-center p-3 rounded-xl"
                    style={{ 
                      background: `linear-gradient(135deg, hsl(var(--accent) / 0.15) 0%, transparent 100%)`,
                      border: '1px solid hsl(var(--accent) / 0.2)'
                    }}
                  >
                    <TrendingUp className="w-5 h-5 mx-auto text-accent mb-1" />
                    <p className="font-display text-xl font-bold text-accent">{player2.careerLegacy.toFixed(0)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Legacy</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      {player1 && player2 && (
        <div 
          className="rounded-2xl border-2 overflow-hidden"
          style={{
            borderColor: 'hsl(var(--border) / 0.3)',
            background: `linear-gradient(180deg, hsl(${player1Colors?.primary || 'var(--primary)'} / 0.03) 0%, transparent 50%, hsl(${player2Colors?.primary || 'var(--accent)'} / 0.03) 100%)`
          }}
        >
          <div 
            className="p-5 border-b border-border/30"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--secondary) / 0.5) 50%, hsl(var(--accent) / 0.1) 100%)'
            }}
          >
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                {nflTeam1 && <img src={nflTeam1.logoUrl} alt="" className="w-8 h-8" />}
                <span className="font-display text-lg font-bold" style={{ color: player1Colors ? `hsl(${player1Colors.primary})` : undefined }}>{player1.name}</span>
              </div>
              <Zap className="w-5 h-5 text-chart-4" />
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold" style={{ color: player2Colors ? `hsl(${player2Colors.primary})` : undefined }}>{player2.name}</span>
                {nflTeam2 && <img src={nflTeam2.logoUrl} alt="" className="w-8 h-8" />}
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-border/20">
            {comparisonStats.map((stat, i) => (
              <div key={stat.label} className="grid grid-cols-3 items-center">
                {/* Player 1 Value */}
                <div 
                  className="p-4 text-center transition-all"
                  style={{
                    background: stat.highlight === 1 
                      ? `linear-gradient(90deg, hsl(var(--chart-2) / 0.15) 0%, transparent 100%)`
                      : undefined
                  }}
                >
                  <span 
                    className={`font-mono text-lg font-bold ${stat.highlight === 1 ? 'text-chart-2' : 'text-foreground'}`}
                  >
                    {typeof stat.p1Value === 'number' ? stat.p1Value.toLocaleString() : stat.p1Value}
                  </span>
                  {stat.highlight === 1 && <span className="ml-2 text-chart-2">✓</span>}
                </div>
                
                {/* Stat Label */}
                <div className="p-4 text-center bg-secondary/30">
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                </div>
                
                {/* Player 2 Value */}
                <div 
                  className="p-4 text-center transition-all"
                  style={{
                    background: stat.highlight === 2 
                      ? `linear-gradient(270deg, hsl(var(--chart-2) / 0.15) 0%, transparent 100%)`
                      : undefined
                  }}
                >
                  {stat.highlight === 2 && <span className="mr-2 text-chart-2">✓</span>}
                  <span 
                    className={`font-mono text-lg font-bold ${stat.highlight === 2 ? 'text-chart-2' : 'text-foreground'}`}
                  >
                    {typeof stat.p2Value === 'number' ? stat.p2Value.toLocaleString() : stat.p2Value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Winner Summary */}
          <div 
            className="p-6 border-t border-border/30"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, hsl(var(--secondary) / 0.3) 100%)'
            }}
          >
            <div className="flex items-center justify-center gap-6">
              {(() => {
                const p1Wins = comparisonStats.filter(s => s.highlight === 1).length;
                const p2Wins = comparisonStats.filter(s => s.highlight === 2).length;
                const winner = p1Wins > p2Wins ? player1 : p2Wins > p1Wins ? player2 : null;
                const winnerColors = winner === player1 ? player1Colors : winner === player2 ? player2Colors : null;
                const winnerTeam = winner === player1 ? nflTeam1 : winner === player2 ? nflTeam2 : null;
                
                return (
                  <>
                    <div 
                      className="text-center p-4 rounded-xl min-w-[100px]"
                      style={{
                        background: p1Wins >= p2Wins 
                          ? `linear-gradient(135deg, hsl(${player1Colors?.primary || 'var(--primary)'} / 0.2) 0%, transparent 100%)`
                          : undefined,
                        border: p1Wins > p2Wins ? `2px solid hsl(${player1Colors?.primary || 'var(--primary)'} / 0.4)` : '1px solid hsl(var(--border) / 0.3)'
                      }}
                    >
                      <p 
                        className="font-display text-4xl font-bold"
                        style={{ color: player1Colors ? `hsl(${player1Colors.primary})` : 'hsl(var(--primary))' }}
                      >
                        {p1Wins}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase mt-1">Wins</p>
                    </div>
                    
                    <div 
                      className="px-6 py-3 rounded-xl flex items-center gap-3"
                      style={{
                        background: winner 
                          ? `linear-gradient(135deg, hsl(${winnerColors?.primary || 'var(--chart-4)'} / 0.2) 0%, hsl(${winnerColors?.secondary || 'var(--chart-4)'} / 0.1) 100%)`
                          : 'hsl(var(--secondary) / 0.5)',
                        border: `2px solid hsl(${winnerColors?.primary || 'var(--border)'} / 0.4)`
                      }}
                    >
                      {winnerTeam && <img src={winnerTeam.logoUrl} alt="" className="w-8 h-8" />}
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Winner</p>
                        <span 
                          className="font-display text-lg font-bold"
                          style={{ color: winnerColors ? `hsl(${winnerColors.primary})` : 'hsl(var(--chart-4))' }}
                        >
                          {winner ? winner.name : 'TIE'}
                        </span>
                      </div>
                    </div>
                    
                    <div 
                      className="text-center p-4 rounded-xl min-w-[100px]"
                      style={{
                        background: p2Wins >= p1Wins 
                          ? `linear-gradient(135deg, hsl(${player2Colors?.primary || 'var(--accent)'} / 0.2) 0%, transparent 100%)`
                          : undefined,
                        border: p2Wins > p1Wins ? `2px solid hsl(${player2Colors?.primary || 'var(--accent)'} / 0.4)` : '1px solid hsl(var(--border) / 0.3)'
                      }}
                    >
                      <p 
                        className="font-display text-4xl font-bold"
                        style={{ color: player2Colors ? `hsl(${player2Colors.primary})` : 'hsl(var(--accent))' }}
                      >
                        {p2Wins}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase mt-1">Wins</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!player1 || !player2) && (
        <div className="rounded-2xl border-2 border-dashed border-border/40 p-12 text-center bg-gradient-to-br from-secondary/20 to-transparent">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary/50 mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-2xl font-bold text-foreground mb-2">Select Two Players</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Use the search boxes above to select two players for a detailed head-to-head comparison across all statistical categories.
          </p>
        </div>
      )}
    </div>
  );
};

export default ComparisonTab;