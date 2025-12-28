import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Newspaper, Trophy, Award, Star, TrendingUp, Calendar, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { Player, QBPlayer, RBPlayer } from '@/types/player';

const CommentaryTab = () => {
  const { careerData, seasonData, previousData, currentSeason } = useLeague();

  const analysis = useMemo(() => {
    if (!careerData) return null;

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

    const activePlayers = allPlayers.filter(p => p.status === 'Active');
    const retiredPlayers = allPlayers.filter(p => p.status === 'Retired');

    // MVP candidates by true talent (active only)
    const mvpCandidates = [...activePlayers]
      .sort((a, b) => b.trueTalent - a.trueTalent)
      .slice(0, 5)
      .map((p, i) => ({
        name: p.name.split(' ').pop() || p.name,
        fullName: p.name,
        value: Math.round((5 - i) * 20),
        trueTalent: p.trueTalent,
        position: p.position,
      }));

    // OPOY candidates (offense positions)
    const offensePlayers = [
      ...careerData.quarterbacks.filter(p => p.status === 'Active'),
      ...careerData.runningbacks.filter(p => p.status === 'Active'),
      ...careerData.widereceivers.filter(p => p.status === 'Active'),
      ...careerData.tightends.filter(p => p.status === 'Active'),
    ];
    const opoyCandidates = [...offensePlayers]
      .sort((a, b) => b.dominance - a.dominance)
      .slice(0, 5)
      .map((p, i) => ({
        name: p.name.split(' ').pop() || p.name,
        fullName: p.name,
        value: Math.round((5 - i) * 18),
        dominance: p.dominance,
        position: p.position,
      }));

    // DPOY candidates
    const defensePlayers = [
      ...careerData.linebackers.filter(p => p.status === 'Active'),
      ...careerData.defensivebacks.filter(p => p.status === 'Active'),
      ...careerData.defensiveline.filter(p => p.status === 'Active'),
    ];
    const dpoyCandidates = [...defensePlayers]
      .sort((a, b) => b.dominance - a.dominance)
      .slice(0, 5)
      .map((p, i) => ({
        name: p.name.split(' ').pop() || p.name,
        fullName: p.name,
        value: Math.round((5 - i) * 18),
        dominance: p.dominance,
        position: p.position,
      }));

    // All-time greats by legacy
    const allTimeGreats = [...allPlayers]
      .sort((a, b) => b.careerLegacy - a.careerLegacy)
      .slice(0, 10);

    // Position distribution
    const positionDist = [
      { name: 'QB', value: careerData.quarterbacks.length, fill: 'hsl(190, 100%, 50%)' },
      { name: 'RB', value: careerData.runningbacks.length, fill: 'hsl(270, 80%, 60%)' },
      { name: 'WR', value: careerData.widereceivers.length, fill: 'hsl(45, 100%, 55%)' },
      { name: 'TE', value: careerData.tightends.length, fill: 'hsl(150, 70%, 45%)' },
      { name: 'OL', value: careerData.offensiveline.length, fill: 'hsl(200, 70%, 50%)' },
      { name: 'LB', value: careerData.linebackers.length, fill: 'hsl(0, 70%, 55%)' },
      { name: 'DB', value: careerData.defensivebacks.length, fill: 'hsl(30, 80%, 50%)' },
      { name: 'DL', value: careerData.defensiveline.length, fill: 'hsl(280, 60%, 50%)' },
    ];

    // Career milestones
    const hofPlayers = allPlayers.filter(p => p.careerLegacy >= 5000);
    const legendaryPlayers = allPlayers.filter(p => p.careerLegacy >= 8000);
    const championshipWinners = allPlayers.filter(p => p.rings > 0);
    const mvpWinners = allPlayers.filter(p => p.mvp > 0);

    // Top performers by TPG (efficiency)
    const topTPG = [...activePlayers]
      .sort((a, b) => b.tpg - a.tpg)
      .slice(0, 5);

    return {
      mvpCandidates,
      opoyCandidates,
      dpoyCandidates,
      allTimeGreats,
      positionDist,
      totalPlayers: allPlayers.length,
      activePlayers: activePlayers.length,
      retiredPlayers: retiredPlayers.length,
      hofPlayers: hofPlayers.length,
      legendaryPlayers: legendaryPlayers.length,
      championshipWinners: championshipWinners.length,
      mvpWinners: mvpWinners.length,
      topTPG,
    };
  }, [careerData]);

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-chart-4/10 mb-6">
            <Newspaper className="w-10 h-10 text-chart-4" />
          </div>
          <h2 className="font-display text-4xl font-bold mb-4 text-chart-4">
            LEAGUE COMMENTARY
          </h2>
          <p className="text-muted-foreground text-lg">
            Upload your league data in the Career tab to unlock 
            commentary and advanced analytics.
          </p>
        </div>
      </div>
    );
  }

  const COLORS = [
    'hsl(190, 100%, 50%)',
    'hsl(270, 80%, 60%)',
    'hsl(150, 70%, 45%)',
    'hsl(45, 100%, 55%)',
    'hsl(0, 70%, 55%)',
  ];

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="glass-card-glow p-8">
        <div className="flex items-center gap-4 mb-4">
          <Newspaper className="w-8 h-8 text-chart-4" />
          <div>
            <h2 className="font-display text-3xl font-bold tracking-wide">LEAGUE REPORT</h2>
            <p className="text-muted-foreground">Season {currentSeason} Analysis</p>
          </div>
        </div>
        <div className="prose prose-invert max-w-none">
          <p className="text-lg leading-relaxed">
            As we wrap up <span className="text-primary font-semibold">{currentSeason}</span>, the league 
            continues to showcase incredible talent across all positions. With{' '}
            <span className="text-metric-elite font-semibold">{analysis?.activePlayers}</span> active 
            players competing at the highest level, the competition for postseason awards has 
            never been fiercer. <span className="text-muted-foreground">{analysis?.retiredPlayers} legends have hung up their cleats.</span>
          </p>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/30">
          <div className="text-center">
            <p className="font-display text-3xl font-bold text-primary">{analysis?.hofPlayers}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Hall of Famers</p>
          </div>
          <div className="text-center">
            <p className="font-display text-3xl font-bold text-chart-4">{analysis?.legendaryPlayers}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Legendary Status</p>
          </div>
          <div className="text-center">
            <p className="font-display text-3xl font-bold text-accent">{analysis?.championshipWinners}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ring Winners</p>
          </div>
          <div className="text-center">
            <p className="font-display text-3xl font-bold text-metric-elite">{analysis?.mvpWinners}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">MVP Winners</p>
          </div>
        </div>
      </div>

      {/* Award Races Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* MVP Race */}
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            MVP RACE
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis?.mvpCandidates} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 25%)" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(220, 15%, 55%)" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={70}
                  stroke="hsl(220, 15%, 55%)"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(230, 25%, 12%)', 
                    border: '1px solid hsl(220, 20%, 25%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Odds']}
                  labelFormatter={(label) => analysis?.mvpCandidates.find(c => c.name === label)?.fullName}
                />
                <Bar dataKey="value" fill="hsl(190, 100%, 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* OPOY Race */}
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-chart-4" />
            OPOY RACE
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis?.opoyCandidates} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 25%)" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(220, 15%, 55%)" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={70}
                  stroke="hsl(220, 15%, 55%)"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(230, 25%, 12%)', 
                    border: '1px solid hsl(220, 20%, 25%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Odds']}
                  labelFormatter={(label) => analysis?.opoyCandidates.find(c => c.name === label)?.fullName}
                />
                <Bar dataKey="value" fill="hsl(45, 100%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DPOY Race */}
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-accent" />
            DPOY RACE
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis?.dpoyCandidates} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 25%)" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(220, 15%, 55%)" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={70}
                  stroke="hsl(220, 15%, 55%)"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(230, 25%, 12%)', 
                    border: '1px solid hsl(220, 20%, 25%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Odds']}
                  labelFormatter={(label) => analysis?.dpoyCandidates.find(c => c.name === label)?.fullName}
                />
                <Bar dataKey="value" fill="hsl(270, 80%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Position Distribution */}
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-chart-4" />
            ROSTER BREAKDOWN
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analysis?.positionDist}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {analysis?.positionDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(230, 25%, 12%)', 
                    border: '1px solid hsl(220, 20%, 25%)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Efficiency */}
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-metric-elite" />
            TOP EFFICIENCY (TPG)
          </h3>
          <div className="space-y-3">
            {analysis?.topTPG.map((player, i) => (
              <div 
                key={player.name}
                className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30"
              >
                <span className="font-display font-bold text-2xl text-muted-foreground/50 w-8">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{player.name}</p>
                  <p className="text-xs text-muted-foreground uppercase">{player.position}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-xl metric-elite">
                    {player.tpg.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">TPG</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Career & Season Analysis */}
      <div className="glass-card p-8">
        <h3 className="font-display font-bold text-2xl mb-6 border-b border-border/30 pb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" />
          SEASON {currentSeason} STORYLINES
        </h3>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-bold text-primary mb-3 text-lg">Championship Contenders</h4>
            <p className="text-muted-foreground leading-relaxed">
              With players like <span className="text-foreground font-semibold">
                {analysis?.allTimeGreats[0]?.name}
              </span> leading the charge, the race for the championship is heating up. 
              Their <span className="metric-elite font-mono font-semibold">
                {analysis?.allTimeGreats[0]?.trueTalent.toFixed(0)}
              </span> True Talent rating puts them among the elite performers. 
              Currently holding <span className="text-chart-4 font-semibold">{analysis?.allTimeGreats[0]?.rings} rings</span>.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-accent mb-3 text-lg">Rising Stars</h4>
            <p className="text-muted-foreground leading-relaxed">
              The league is witnessing the emergence of new talent. 
              <span className="text-foreground font-semibold"> {analysis?.topTPG[0]?.name}</span> leads 
              all active players with a stunning <span className="metric-elite font-mono font-semibold">
                {analysis?.topTPG[0]?.tpg.toFixed(2)}
              </span> TPG, showcasing elite efficiency from the {analysis?.topTPG[0]?.position} position.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-chart-4 mb-3 text-lg">Career Milestones</h4>
            <p className="text-muted-foreground leading-relaxed">
              <span className="text-chart-4 font-semibold">{analysis?.hofPlayers} players</span> have 
              achieved Hall of Fame status (Legacy ≥5000), with <span className="text-foreground font-semibold">
                {analysis?.legendaryPlayers}
              </span> reaching Legendary tier (≥8000). The all-time leader{' '}
              <span className="text-foreground font-semibold">{analysis?.allTimeGreats[0]?.name}</span> holds 
              a <span className="metric-elite font-mono font-semibold">
                {analysis?.allTimeGreats[0]?.careerLegacy.toFixed(0)}
              </span> Career Legacy.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-metric-elite mb-3 text-lg">Award Favorites</h4>
            <p className="text-muted-foreground leading-relaxed">
              The MVP race is led by <span className="text-foreground font-semibold">
                {analysis?.mvpCandidates[0]?.fullName}
              </span> ({analysis?.mvpCandidates[0]?.position}). 
              For OPOY, watch <span className="text-foreground font-semibold">
                {analysis?.opoyCandidates[0]?.fullName}
              </span>, while <span className="text-foreground font-semibold">
                {analysis?.dpoyCandidates[0]?.fullName}
              </span> leads DPOY voting.
            </p>
          </div>
        </div>
      </div>

      {/* All-Time Greats */}
      <div className="glass-card p-6">
        <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
          <Star className="w-5 h-5 text-chart-4" />
          ALL-TIME LEGACY LEADERS
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
          {analysis?.allTimeGreats.slice(0, 5).map((player, i) => (
            <div 
              key={player.name}
              className="glass-card p-4 text-center"
            >
              <span className="font-display font-bold text-4xl text-muted-foreground/30">
                #{i + 1}
              </span>
              <p className="font-semibold mt-2">{player.name}</p>
              <p className="text-xs text-muted-foreground uppercase mb-2">{player.position}</p>
              <p className="font-mono font-bold text-xl metric-elite">
                {player.careerLegacy.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">Career Legacy</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommentaryTab;
