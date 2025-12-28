import { useState, useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Scale, User, Trophy, Star, TrendingUp, ArrowRight } from 'lucide-react';
import { getTeamColors } from '@/utils/teamColors';
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
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/20 p-8 mb-8 border border-indigo-500/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InN0YXJzIiB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxjaXJjbGUgY3g9IjI1IiBjeT0iMjUiIHI9IjEiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMSIvPjxjaXJjbGUgY3g9IjUiIGN5PSI1IiByPSIwLjUiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMDgiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjc3RhcnMpIi8+PC9zdmc+')] opacity-60" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 border-2 border-indigo-400/50 mb-4 shadow-lg shadow-indigo-500/20">
            <Scale className="w-8 h-8 text-indigo-400" />
          </div>
          
          <h1 className="font-display text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            PLAYER COMPARISON
          </h1>
          <p className="text-muted-foreground">Compare any two players head-to-head</p>
        </div>
      </div>

      {/* Player Selection */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Player 1 Selector */}
        <div 
          className="rounded-2xl border-2 p-6"
          style={{
            borderColor: player1Colors ? `hsl(${player1Colors.primary} / 0.4)` : 'hsl(var(--border))',
            background: player1Colors 
              ? `linear-gradient(135deg, hsl(${player1Colors.primary} / 0.1) 0%, transparent 60%)`
              : 'hsl(var(--secondary) / 0.3)'
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Player 1</span>
          </div>
          <PlayerSearchSelect
            players={allPlayers}
            value={player1Key}
            onValueChange={setPlayer1Key}
            placeholder="Search for a player..."
          />

          {player1 && (
            <div className="mt-4 pt-4 border-t border-border/20">
              <div className="flex items-center gap-3">
                <PositionBadge position={player1.position} />
                <div>
                  <p 
                    className="font-display text-2xl font-bold"
                    style={{ color: player1Colors ? `hsl(${player1Colors.primary})` : 'hsl(var(--foreground))' }}
                  >
                    {player1.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{player1.team || 'Retired'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-2 rounded-lg bg-background/30">
                  <Trophy className="w-4 h-4 mx-auto text-amber-400 mb-1" />
                  <p className="font-bold">{player1.rings}</p>
                  <p className="text-xs text-muted-foreground">Rings</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/30">
                  <Star className="w-4 h-4 mx-auto text-purple-400 mb-1" />
                  <p className="font-bold">{player1.mvp}</p>
                  <p className="text-xs text-muted-foreground">MVP</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/30">
                  <TrendingUp className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
                  <p className="font-bold">{player1.careerLegacy.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Legacy</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* VS Divider - Mobile */}
        <div className="md:hidden flex items-center justify-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
            <span className="font-display font-bold text-indigo-400">VS</span>
          </div>
        </div>

        {/* Player 2 Selector */}
        <div 
          className="rounded-2xl border-2 p-6"
          style={{
            borderColor: player2Colors ? `hsl(${player2Colors.primary} / 0.4)` : 'hsl(var(--border))',
            background: player2Colors 
              ? `linear-gradient(135deg, hsl(${player2Colors.primary} / 0.1) 0%, transparent 60%)`
              : 'hsl(var(--secondary) / 0.3)'
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Player 2</span>
          </div>
          <PlayerSearchSelect
            players={allPlayers}
            value={player2Key}
            onValueChange={setPlayer2Key}
            placeholder="Search for a player..."
          />

          {player2 && (
            <div className="mt-4 pt-4 border-t border-border/20">
              <div className="flex items-center gap-3">
                <PositionBadge position={player2.position} />
                <div>
                  <p 
                    className="font-display text-2xl font-bold"
                    style={{ color: player2Colors ? `hsl(${player2Colors.primary})` : 'hsl(var(--foreground))' }}
                  >
                    {player2.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{player2.team || 'Retired'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-2 rounded-lg bg-background/30">
                  <Trophy className="w-4 h-4 mx-auto text-amber-400 mb-1" />
                  <p className="font-bold">{player2.rings}</p>
                  <p className="text-xs text-muted-foreground">Rings</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/30">
                  <Star className="w-4 h-4 mx-auto text-purple-400 mb-1" />
                  <p className="font-bold">{player2.mvp}</p>
                  <p className="text-xs text-muted-foreground">MVP</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/30">
                  <TrendingUp className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
                  <p className="font-bold">{player2.careerLegacy.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Legacy</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparison Table */}
      {player1 && player2 && (
        <div className="rounded-2xl border border-border/30 overflow-hidden bg-background/50">
          <div className="p-4 border-b border-border/20 bg-secondary/30">
            <h3 className="font-display text-xl font-bold text-center">Head-to-Head Comparison</h3>
          </div>
          
          <div className="divide-y divide-border/20">
            {comparisonStats.map((stat, i) => (
              <div key={stat.label} className="grid grid-cols-3 items-center">
                {/* Player 1 Value */}
                <div 
                  className={`p-4 text-center transition-colors ${stat.highlight === 1 ? 'bg-emerald-500/10' : ''}`}
                >
                  <span 
                    className={`font-mono text-lg font-bold ${stat.highlight === 1 ? 'text-emerald-400' : 'text-foreground'}`}
                  >
                    {typeof stat.p1Value === 'number' ? stat.p1Value.toLocaleString() : stat.p1Value}
                  </span>
                  {stat.highlight === 1 && <span className="ml-2 text-emerald-400 text-xs">★</span>}
                </div>
                
                {/* Stat Label */}
                <div className="p-4 text-center bg-secondary/20">
                  <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                </div>
                
                {/* Player 2 Value */}
                <div 
                  className={`p-4 text-center transition-colors ${stat.highlight === 2 ? 'bg-emerald-500/10' : ''}`}
                >
                  {stat.highlight === 2 && <span className="mr-2 text-emerald-400 text-xs">★</span>}
                  <span 
                    className={`font-mono text-lg font-bold ${stat.highlight === 2 ? 'text-emerald-400' : 'text-foreground'}`}
                  >
                    {typeof stat.p2Value === 'number' ? stat.p2Value.toLocaleString() : stat.p2Value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Winner Summary */}
          <div className="p-6 bg-gradient-to-r from-secondary/30 via-transparent to-secondary/30 border-t border-border/20">
            <div className="flex items-center justify-center gap-4">
              {(() => {
                const p1Wins = comparisonStats.filter(s => s.highlight === 1).length;
                const p2Wins = comparisonStats.filter(s => s.highlight === 2).length;
                return (
                  <>
                    <div className="text-center">
                      <p 
                        className="font-display text-3xl font-bold"
                        style={{ color: player1Colors ? `hsl(${player1Colors.primary})` : 'hsl(var(--primary))' }}
                      >
                        {p1Wins}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase">Categories Won</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    <div className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                      <span className="font-display font-bold text-indigo-400">
                        {p1Wins > p2Wins ? player1.name : p2Wins > p1Wins ? player2.name : 'TIE'}
                      </span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground rotate-180" />
                    <div className="text-center">
                      <p 
                        className="font-display text-3xl font-bold"
                        style={{ color: player2Colors ? `hsl(${player2Colors.primary})` : 'hsl(var(--accent))' }}
                      >
                        {p2Wins}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase">Categories Won</p>
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
        <div className="rounded-2xl border border-dashed border-border/50 p-12 text-center">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Select two players above to compare their stats</p>
        </div>
      )}
    </div>
  );
};

export default ComparisonTab;