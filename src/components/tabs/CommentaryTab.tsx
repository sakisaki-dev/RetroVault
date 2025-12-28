import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Newspaper, Trophy, Star, TrendingUp, Crown, Flame, AlertTriangle, Zap, Target, MessageCircle } from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';

interface NewsStory {
  headline: string;
  body: string;
  player?: Player;
  tier: 'breaking' | 'hot-take' | 'analysis' | 'controversy';
  icon: typeof Flame;
}

const CommentaryTab = () => {
  const { careerData, seasonData, currentSeason } = useLeague();

  const { stories, leagueStats } = useMemo(() => {
    if (!careerData) return { stories: [], leagueStats: null };

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

    const activePlayers = allPlayers.filter((p) => p.status === 'Active');
    const hofPlayers = allPlayers.filter((p) => p.careerLegacy >= 8000);
    const legendaryPlayers = allPlayers.filter((p) => p.careerLegacy >= 12000);

    const topByLegacy = [...allPlayers].sort((a, b) => b.careerLegacy - a.careerLegacy).slice(0, 5);
    const topByTPG = [...activePlayers].sort((a, b) => b.tpg - a.tpg).slice(0, 5);
    const topByRings = [...allPlayers].sort((a, b) => b.rings - a.rings).slice(0, 5);
    const topByMVP = [...allPlayers].filter((p) => p.mvp > 0).sort((a, b) => b.mvp - a.mvp).slice(0, 5);

    const newsStories: NewsStory[] = [];

    // Season-specific hot takes
    if (seasonData) {
      const qbs = seasonData.quarterbacks as QBPlayer[];
      const rbs = seasonData.runningbacks as RBPlayer[];
      const wrs = seasonData.widereceivers as WRPlayer[];

      // MVP race controversy
      const topQB = qbs.reduce((a, b) => (a?.passYds > b?.passYds ? a : b), qbs[0]);
      const topRB = rbs.reduce((a, b) => (a?.rushYds > b?.rushYds ? a : b), rbs[0]);
      
      if (topQB && topRB && topQB.passYds > 0 && topRB.rushYds > 0) {
        newsStories.push({
          headline: `MVP DEBATE: ${topQB.name.split(' ').pop()} vs ${topRB.name.split(' ').pop()} — Who Deserves It?`,
          body: `${topQB.name} threw for ${topQB.passYds.toLocaleString()} yards while ${topRB.name} dominated on the ground with ${topRB.rushYds.toLocaleString()} rushing yards. The voters are split. This could get ugly.`,
          player: careerData.quarterbacks.find((q) => q.name === topQB.name) || topQB,
          tier: 'controversy',
          icon: AlertTriangle,
        });
      }

      // Historic season takes
      if (topQB && topQB.passYds >= 5000) {
        newsStories.push({
          headline: `HISTORIC: ${topQB.name.split(' ').pop()} Joins 5,000-Yard Club`,
          body: `We're witnessing greatness. ${topQB.name} just put up ${topQB.passYds.toLocaleString()} passing yards — a number that will be remembered for decades. This isn't just a great season. This is LEGENDARY.`,
          player: careerData.quarterbacks.find((q) => q.name === topQB.name) || topQB,
          tier: 'breaking',
          icon: Flame,
        });
      }

      // Top WR hot take
      const topWR = wrs.reduce((a, b) => (a?.recYds > b?.recYds ? a : b), wrs[0]);
      if (topWR && topWR.recYds >= 1300) {
        newsStories.push({
          headline: `${topWR.name.split(' ').pop()} Is the Best Receiver in the League. It's Not Close.`,
          body: `${topWR.receptions} catches. ${topWR.recYds.toLocaleString()} yards. ${topWR.recTD} touchdowns. If you're still debating who the best receiver is, you're not watching the games.`,
          player: careerData.widereceivers.find((w) => w.name === topWR.name) || topWR,
          tier: 'hot-take',
          icon: Zap,
        });
      }

      // Underperformer hot take
      const underperformer = qbs.find((qb) => qb.passYds > 0 && qb.passYds < 2000);
      if (underperformer) {
        const careerQB = careerData.quarterbacks.find((q) => q.name === underperformer.name);
        if (careerQB && careerQB.careerLegacy > 3000) {
          newsStories.push({
            headline: `Is ${underperformer.name.split(' ').pop()} Washed? The Numbers Say Yes.`,
            body: `Only ${underperformer.passYds.toLocaleString()} passing yards this season. For a player with ${careerQB.careerLegacy.toFixed(0)} career legacy points, this is alarming. Father Time remains undefeated.`,
            player: careerQB,
            tier: 'hot-take',
            icon: AlertTriangle,
          });
        }
      }

      // Championship story
      const champs = allPlayers.filter((p) => p.rings > 0);
      const dynastyPlayer = champs.find((p) => p.rings >= 3);
      if (dynastyPlayer) {
        newsStories.push({
          headline: `Dynasty Alert: ${dynastyPlayer.name.split(' ').pop()} Has ${dynastyPlayer.rings} Rings`,
          body: `${dynastyPlayer.name} isn't just winning — they're building a legacy. With ${dynastyPlayer.rings} championships, we're talking about one of the greatest winners this league has ever seen.`,
          player: dynastyPlayer,
          tier: 'analysis',
          icon: Trophy,
        });
      }
    }

    // Career analysis takes
    const goatCandidate = topByLegacy[0];
    if (goatCandidate) {
      newsStories.push({
        headline: `GOAT Watch: ${goatCandidate.name.split(' ').pop()} Leads All-Time Legacy Rankings`,
        body: `With a ${goatCandidate.careerLegacy.toFixed(0)} career legacy score, ${goatCandidate.name} sits atop the all-time rankings. ${goatCandidate.rings} rings. ${goatCandidate.mvp} MVPs. ${goatCandidate.status === 'Active' ? 'And still going.' : 'A true legend.'} This is what greatness looks like.`,
        player: goatCandidate,
        tier: 'analysis',
        icon: Crown,
      });
    }

    // Efficiency take
    const efficiencyKing = topByTPG[0];
    if (efficiencyKing && efficiencyKing.tpg >= 3) {
      newsStories.push({
        headline: `${efficiencyKing.name.split(' ').pop()} Is Playing a Different Game`,
        body: `${efficiencyKing.tpg.toFixed(2)} TPG. That's elite-tier efficiency. Every snap, every touch, every play — ${efficiencyKing.name} is maximizing their impact. This is what separates the good from the GREAT.`,
        player: efficiencyKing,
        tier: 'hot-take',
        icon: Target,
      });
    }

    // Young gun take (player with high TPG but low games)
    const youngGun = activePlayers.find((p) => p.games < 50 && p.tpg >= 2.5);
    if (youngGun) {
      newsStories.push({
        headline: `Rising Star: ${youngGun.name.split(' ').pop()} Is the Future`,
        body: `Only ${youngGun.games} games played but already making waves with a ${youngGun.tpg.toFixed(2)} TPG. ${youngGun.name} is on a trajectory that could redefine their position. The league better be ready.`,
        player: youngGun,
        tier: 'analysis',
        icon: Star,
      });
    }

    return {
      stories: newsStories,
      leagueStats: {
        totalPlayers: allPlayers.length,
        activePlayers: activePlayers.length,
        hofCount: hofPlayers.length,
        legendaryCount: legendaryPlayers.length,
        topByLegacy,
        topByTPG,
        topByRings,
        topByMVP,
      },
    };
  }, [careerData, seasonData]);

  if (!careerData || !leagueStats) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-chart-4/10 mb-6">
            <Newspaper className="w-10 h-10 text-chart-4" />
          </div>
          <h2 className="font-display text-4xl font-bold mb-4 text-chart-4">THE DAILY VAULT</h2>
          <p className="text-muted-foreground text-lg">Upload your league data to see the latest hot takes and analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Masthead */}
      <div className="glass-card-glow p-8 text-center border-b-4 border-chart-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Newspaper className="w-8 h-8 text-chart-4" />
          <h1 className="font-display text-5xl font-bold tracking-wider">THE DAILY VAULT</h1>
        </div>
        <p className="text-muted-foreground uppercase tracking-widest text-sm">
          Hot Takes • Analysis • Controversy — Season {currentSeason}
        </p>
      </div>

      {/* Breaking News Ticker */}
      {stories.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="bg-destructive/20 px-4 py-2 flex items-center gap-2">
            <Flame className="w-4 h-4 text-destructive animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-destructive">Breaking</span>
          </div>
          <div className="p-4">
            <p className="font-semibold text-foreground">{stories[0]?.headline}</p>
          </div>
        </div>
      )}

      {/* Main Stories Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {stories.map((story, i) => (
          <StoryCard key={i} story={story} featured={i === 0} />
        ))}
      </div>

      {/* League Power Rankings */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 border-b border-border/30 pb-3 mb-4">
            <Crown className="w-5 h-5 text-chart-4" />
            <h3 className="font-display text-xl font-bold">LEGACY POWER RANKINGS</h3>
          </div>
          <div className="space-y-3">
            {leagueStats.topByLegacy.map((player, i) => (
              <PlayerRankRow key={player.name} player={player} rank={i + 1} stat={player.careerLegacy} statLabel="Legacy" />
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 border-b border-border/30 pb-3 mb-4">
            <Target className="w-5 h-5 text-metric-elite" />
            <h3 className="font-display text-xl font-bold">EFFICIENCY LEADERS</h3>
          </div>
          <div className="space-y-3">
            {leagueStats.topByTPG.map((player, i) => (
              <PlayerRankRow key={player.name} player={player} rank={i + 1} stat={player.tpg} statLabel="TPG" decimals={2} />
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 border-b border-border/30 pb-3 mb-4">
            <Trophy className="w-5 h-5 text-accent" />
            <h3 className="font-display text-xl font-bold">RING LEADERS</h3>
          </div>
          <div className="space-y-3">
            {leagueStats.topByRings.map((player, i) => (
              <PlayerRankRow key={player.name} player={player} rank={i + 1} stat={player.rings} statLabel="Rings" />
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 border-b border-border/30 pb-3 mb-4">
            <Star className="w-5 h-5 text-primary" />
            <h3 className="font-display text-xl font-bold">MVP LEADERS</h3>
          </div>
          <div className="space-y-3">
            {leagueStats.topByMVP.length > 0 ? (
              leagueStats.topByMVP.map((player, i) => (
                <PlayerRankRow key={player.name} player={player} rank={i + 1} stat={player.mvp} statLabel="MVPs" />
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No MVP winners yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Hot Take Section */}
      <div className="glass-card p-8">
        <div className="flex items-center gap-3 mb-6 border-b border-border/30 pb-4">
          <MessageCircle className="w-6 h-6 text-chart-4" />
          <h3 className="font-display text-2xl font-bold">THE VAULT'S VERDICT</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-8 text-muted-foreground leading-relaxed">
          <div>
            <h4 className="font-bold text-chart-4 mb-2 text-lg">🔥 The GOAT Debate Rages On</h4>
            <p>
              <span className="text-foreground font-semibold">{leagueStats.topByLegacy[0]?.name}</span> leads with{' '}
              <span className="text-chart-4 font-semibold">{leagueStats.topByLegacy[0]?.careerLegacy.toFixed(0)}</span> legacy points.
              But legacy isn't just about stats — it's about moments, championships, and clutch performances.
              The debate continues.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-metric-elite mb-2 text-lg">📈 Efficiency Over Volume</h4>
            <p>
              <span className="text-foreground font-semibold">{leagueStats.topByTPG[0]?.name}</span> is producing at
              an insane <span className="text-metric-elite font-semibold">{leagueStats.topByTPG[0]?.tpg.toFixed(2)} TPG</span>.
              In an era obsessed with volume stats, don't sleep on efficiency. This is how you build a dynasty.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-accent mb-2 text-lg">💍 Championship DNA</h4>
            <p>
              <span className="text-accent font-semibold">{leagueStats.topByRings[0]?.rings} rings</span> for{' '}
              <span className="text-foreground font-semibold">{leagueStats.topByRings[0]?.name}</span>.
              You can debate stats all day, but championships are the ultimate measure. Winners find a way.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-primary mb-2 text-lg">🏆 The Hall Awaits</h4>
            <p>
              <span className="text-primary font-semibold">{leagueStats.hofCount} players</span> have crossed the Hall of Fame threshold.
              Only <span className="text-chart-4 font-semibold">{leagueStats.legendaryCount}</span> have reached legendary status.
              The bar is high. As it should be.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StoryCard = ({ story, featured }: { story: NewsStory; featured?: boolean }) => {
  const colors = {
    breaking: { border: 'border-destructive', text: 'text-destructive', bg: 'bg-destructive/10' },
    'hot-take': { border: 'border-chart-4', text: 'text-chart-4', bg: 'bg-chart-4/10' },
    analysis: { border: 'border-primary', text: 'text-primary', bg: 'bg-primary/10' },
    controversy: { border: 'border-accent', text: 'text-accent', bg: 'bg-accent/10' },
  };
  const style = colors[story.tier];
  const teamColors = story.player ? getTeamColors(story.player.team) : null;
  const Icon = story.icon;

  return (
    <div
      className={`glass-card p-6 ${featured ? 'lg:col-span-2' : ''} ${style.bg} border-l-4 ${style.border}`}
      style={teamColors ? { borderLeftColor: `hsl(${teamColors.primary})` } : undefined}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${style.text}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>
          {story.tier.replace('-', ' ')}
        </span>
      </div>
      <h4 className={`font-display ${featured ? 'text-3xl' : 'text-xl'} font-bold text-foreground mb-3`}>
        {story.headline}
      </h4>
      <p className="text-muted-foreground leading-relaxed">{story.body}</p>
      {story.player && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/30">
          <PositionBadge position={story.player.position} className="text-xs" />
          {story.player.team && (
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={teamColors ? { backgroundColor: `hsl(${teamColors.primary} / 0.2)`, color: `hsl(${teamColors.primary})` } : undefined}
            >
              {story.player.team}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {story.player.games} GP • {story.player.careerLegacy.toFixed(0)} Legacy
          </span>
        </div>
      )}
    </div>
  );
};

const PlayerRankRow = ({ player, rank, stat, statLabel, decimals = 0 }: { player: Player; rank: number; stat: number; statLabel: string; decimals?: number }) => {
  const teamColors = getTeamColors(player.team);

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
      style={teamColors ? { borderLeft: `3px solid hsl(${teamColors.primary})` } : undefined}
    >
      <span className="font-display font-bold text-2xl text-muted-foreground/50 w-8">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{player.name}</p>
        <div className="flex items-center gap-2">
          <PositionBadge position={player.position} className="text-xs" />
          {player.team && <span className="text-xs text-muted-foreground">{player.team}</span>}
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono font-bold text-xl text-primary">{decimals > 0 ? stat.toFixed(decimals) : stat.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{statLabel}</p>
      </div>
    </div>
  );
};

export default CommentaryTab;