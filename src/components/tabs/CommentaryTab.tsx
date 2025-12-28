import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Newspaper, Trophy, Award, Star, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Player } from '@/types/player';

const CommentaryTab = () => {
  const { careerData, currentSeason } = useLeague();

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

    // MVP candidates by true talent (active only)
    const mvpCandidates = [...activePlayers]
      .sort((a, b) => b.trueTalent - a.trueTalent)
      .slice(0, 5)
      .map((p, i) => ({
        name: p.name,
        value: Math.round((5 - i) * 20), // Simulated odds
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
        name: p.name,
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
      { name: 'QB', value: careerData.quarterbacks.length },
      { name: 'RB', value: careerData.runningbacks.length },
      { name: 'WR', value: careerData.widereceivers.length },
      { name: 'TE', value: careerData.tightends.length },
      { name: 'OL', value: careerData.offensiveline.length },
      { name: 'LB', value: careerData.linebackers.length },
      { name: 'DB', value: careerData.defensivebacks.length },
      { name: 'DL', value: careerData.defensiveline.length },
    ];

    return {
      mvpCandidates,
      opoyCandidates,
      allTimeGreats,
      positionDist,
      totalPlayers: allPlayers.length,
      activePlayers: activePlayers.length,
    };
  }, [careerData]);

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-chart-4/10 mb-6">
            <Newspaper className="w-10 h-10 text-chart-4" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4" style={{ color: 'hsl(var(--chart-4))' }}>
            League Commentary
          </h2>
          <p className="text-muted-foreground text-lg">
            Upload your league data in the Career tab to unlock AI-powered 
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
            <h2 className="font-display text-2xl font-bold tracking-wide">LEAGUE REPORT</h2>
            <p className="text-muted-foreground">Season {currentSeason} Analysis</p>
          </div>
        </div>
        <div className="prose prose-invert max-w-none">
          <p className="text-lg leading-relaxed">
            As we wrap up <span className="text-primary font-medium">{currentSeason}</span>, the league 
            continues to showcase incredible talent across all positions. With{' '}
            <span className="text-metric-elite font-medium">{analysis?.activePlayers}</span> active 
            players competing at the highest level, the competition for postseason awards has 
            never been fiercer.
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* MVP Race */}
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            MVP RACE
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis?.mvpCandidates} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 25%)" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(220, 15%, 55%)" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100}
                  stroke="hsl(220, 15%, 55%)"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(230, 25%, 12%)', 
                    border: '1px solid hsl(220, 20%, 25%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [`${value}%`, 'Odds']}
                />
                <Bar dataKey="value" fill="hsl(190, 100%, 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* OPOY Race */}
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-accent" />
            OPOY RACE
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis?.opoyCandidates} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 25%)" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(220, 15%, 55%)" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100}
                  stroke="hsl(220, 15%, 55%)"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(230, 25%, 12%)', 
                    border: '1px solid hsl(220, 20%, 25%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Odds']}
                />
                <Bar dataKey="value" fill="hsl(270, 80%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Position Distribution */}
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
            <Star className="w-5 h-5 text-chart-4" />
            POSITION BREAKDOWN
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analysis?.positionDist}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {analysis?.positionDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

        {/* All-Time Greats */}
        <div className="glass-card p-6">
          <h3 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-metric-elite" />
            ALL-TIME GREATS
          </h3>
          <div className="space-y-3">
            {analysis?.allTimeGreats.slice(0, 5).map((player, i) => (
              <div 
                key={player.name}
                className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30"
              >
                <span className="font-display font-bold text-2xl text-muted-foreground w-8">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{player.name}</p>
                  <p className="text-xs text-muted-foreground uppercase">{player.position}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold metric-elite">
                    {player.careerLegacy.toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Legacy</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* News-style Analysis */}
      <div className="glass-card p-8">
        <h3 className="font-display font-bold text-xl mb-6 border-b border-border/30 pb-4">
          SEASON STORYLINES
        </h3>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-bold text-primary mb-3">🏆 Championship Contenders</h4>
            <p className="text-muted-foreground leading-relaxed">
              With players like <span className="text-foreground font-medium">
                {analysis?.allTimeGreats[0]?.name}
              </span> leading the charge, the race for the championship is heating up. 
              Their <span className="metric-elite font-mono">
                {analysis?.allTimeGreats[0]?.trueTalent.toFixed(1)}
              </span> True Talent rating puts them among the elite performers this season.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-accent mb-3">⭐ Rising Stars</h4>
            <p className="text-muted-foreground leading-relaxed">
              The league is witnessing the emergence of new talent that could reshape 
              the competitive landscape. Keep an eye on players with high TPG ratings, 
              as they show the most potential per game played.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-chart-4 mb-3">📊 Statistical Leaders</h4>
            <p className="text-muted-foreground leading-relaxed">
              The Crown emoji (👑) throughout the Career tab marks statistical leaders 
              in each category. These elite performers are setting the standard for 
              excellence at their respective positions.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-metric-elite mb-3">🎯 Legacy Watch</h4>
            <p className="text-muted-foreground leading-relaxed">
              Career Legacy scores above <span className="metric-elite font-mono">7000</span> are 
              considered Hall of Fame caliber. Currently, {' '}
              {analysis?.allTimeGreats.filter(p => p.careerLegacy >= 7000).length} players 
              have achieved this prestigious milestone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentaryTab;
