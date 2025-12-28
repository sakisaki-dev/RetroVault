import { useMemo, useState } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { 
  Newspaper, Trophy, Star, TrendingUp, Crown, Flame, AlertTriangle, Zap, Target, 
  X, ChevronRight, Award, Medal, Users, Calendar, BarChart3, Sparkles
} from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NewsStory {
  id: string;
  headline: string;
  subheadline?: string;
  body: string;
  fullContent?: string;
  player?: Player;
  players?: Player[];
  tier: 'breaking' | 'hot-take' | 'analysis' | 'controversy' | 'milestone' | 'power-ranking';
  icon: typeof Flame;
  category: string;
  imageGradient?: string;
}

const TIER_STYLES = {
  breaking: { 
    border: 'border-l-4 border-destructive', 
    badge: 'bg-destructive text-destructive-foreground',
    glow: 'shadow-destructive/20',
    gradient: 'from-destructive/30 via-destructive/10 to-transparent'
  },
  'hot-take': { 
    border: 'border-l-4 border-chart-4', 
    badge: 'bg-chart-4 text-chart-4-foreground',
    glow: 'shadow-chart-4/20',
    gradient: 'from-chart-4/30 via-chart-4/10 to-transparent'
  },
  analysis: { 
    border: 'border-l-4 border-primary', 
    badge: 'bg-primary text-primary-foreground',
    glow: 'shadow-primary/20',
    gradient: 'from-primary/30 via-primary/10 to-transparent'
  },
  controversy: { 
    border: 'border-l-4 border-accent', 
    badge: 'bg-accent text-accent-foreground',
    glow: 'shadow-accent/20',
    gradient: 'from-accent/30 via-accent/10 to-transparent'
  },
  milestone: { 
    border: 'border-l-4 border-chart-2', 
    badge: 'bg-chart-2 text-chart-2-foreground',
    glow: 'shadow-chart-2/20',
    gradient: 'from-chart-2/30 via-chart-2/10 to-transparent'
  },
  'power-ranking': { 
    border: 'border-l-4 border-chart-3', 
    badge: 'bg-chart-3 text-chart-3-foreground',
    glow: 'shadow-chart-3/20',
    gradient: 'from-chart-3/30 via-chart-3/10 to-transparent'
  },
};

const CommentaryTab = () => {
  const { careerData, seasonData, currentSeason } = useLeague();
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);

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

    const topByLegacy = [...allPlayers].sort((a, b) => b.careerLegacy - a.careerLegacy).slice(0, 10);
    const topByTPG = [...activePlayers].sort((a, b) => b.tpg - a.tpg).slice(0, 5);
    const topByRings = [...allPlayers].sort((a, b) => b.rings - a.rings).slice(0, 5);
    const topByMVP = [...allPlayers].filter((p) => p.mvp > 0).sort((a, b) => b.mvp - a.mvp).slice(0, 5);

    const newsStories: NewsStory[] = [];
    let storyId = 0;

    // Season-specific stories
    if (seasonData) {
      const qbs = seasonData.quarterbacks as QBPlayer[];
      const rbs = seasonData.runningbacks as RBPlayer[];
      const wrs = seasonData.widereceivers as WRPlayer[];
      const tes = seasonData.tightends as TEPlayer[];

      const topQB = qbs.length > 0 ? qbs.reduce((a, b) => (a?.passYds > b?.passYds ? a : b), qbs[0]) : null;
      const topRB = rbs.length > 0 ? rbs.reduce((a, b) => (a?.rushYds > b?.rushYds ? a : b), rbs[0]) : null;
      const topWR = wrs.length > 0 ? wrs.reduce((a, b) => (a?.recYds > b?.recYds ? a : b), wrs[0]) : null;

      // MVP Race
      if (topQB && topRB && topQB.passYds > 0 && topRB.rushYds > 0) {
        const careerQB = careerData.quarterbacks.find((q) => q.name === topQB.name);
        const careerRB = careerData.runningbacks.find((r) => r.name === topRB.name);
        newsStories.push({
          id: `story-${storyId++}`,
          headline: `MVP RACE HEATS UP`,
          subheadline: `${topQB.name.split(' ').pop()} vs ${topRB.name.split(' ').pop()}`,
          body: `Two titans battle for the league's most prestigious individual honor.`,
          fullContent: `The MVP race this season has come down to two incredible performers.\n\n**${topQB.name}** has been surgical from the pocket, throwing for ${topQB.passYds.toLocaleString()} yards this season. ${careerQB?.mvp ? `With ${careerQB.mvp} career MVPs, they know what it takes to win.` : 'A first MVP would cement their elite status.'}\n\n**${topRB.name}** has been a different kind of dominant, rushing for ${topRB.rushYds.toLocaleString()} yards. ${careerRB?.mvp ? `Already a ${careerRB.mvp}x MVP.` : 'Could this be their breakthrough year?'}\n\nVoters will have a tough decision. This could go down to the wire.`,
          players: [careerQB || topQB, careerRB || topRB],
          tier: 'controversy',
          icon: AlertTriangle,
          category: 'MVP Watch',
        });
      }

      // Historic QB season
      if (topQB && topQB.passYds >= 5000) {
        const careerQB = careerData.quarterbacks.find((q) => q.name === topQB.name) || topQB;
        newsStories.push({
          id: `story-${storyId++}`,
          headline: `${topQB.name.split(' ').pop().toUpperCase()} ENTERS HISTORY BOOKS`,
          subheadline: `5,000-yard season achieved`,
          body: `An elite performance that will be remembered for generations.`,
          fullContent: `We are witnessing greatness in its purest form.\n\n**${topQB.name}** just put up ${topQB.passYds.toLocaleString()} passing yards — joining the exclusive 5,000-yard club. Only the truly elite ever reach this milestone.\n\n${topQB.passTD} touchdown passes. A passer rating that makes defensive coordinators lose sleep. This isn't just a great season. This is LEGENDARY.\n\n${careerQB.rings > 0 ? `With ${careerQB.rings} ring(s) already, this season adds another chapter to an already Hall of Fame resume.` : 'Now the mission is to turn this brilliance into a championship run.'}`,
          player: careerQB,
          tier: 'breaking',
          icon: Flame,
          category: 'Historic Season',
        });
      }

      // Top WR
      if (topWR && topWR.recYds >= 1200) {
        const careerWR = careerData.widereceivers.find((w) => w.name === topWR.name) || topWR;
        newsStories.push({
          id: `story-${storyId++}`,
          headline: `UNSTOPPABLE`,
          subheadline: `${topWR.name} is the best receiver in football`,
          body: `${topWR.recYds.toLocaleString()} receiving yards. The debate is over.`,
          fullContent: `**${topWR.name}** is playing a different sport than everyone else.\n\n${topWR.receptions} receptions. ${topWR.recYds.toLocaleString()} yards. ${topWR.recTD} touchdowns.\n\nDefensive coordinators are game-planning specifically for this player and it doesn't matter. Double coverage? Doesn't matter. Triple coverage? Still getting open.\n\n${careerWR.opoy > 0 ? `A ${careerWR.opoy}x OPOY winner proving why.` : 'An OPOY award feels inevitable.'} ${careerWR.rings > 0 ? `And yes, they've got the rings (${careerWR.rings}) to back it up.` : ''}`,
          player: careerWR,
          tier: 'hot-take',
          icon: Zap,
          category: 'Elite Performance',
        });
      }

      // Dynasty alert
      const dynastyPlayer = allPlayers.find((p) => p.rings >= 3);
      if (dynastyPlayer) {
        newsStories.push({
          id: `story-${storyId++}`,
          headline: `DYNASTY WATCH`,
          subheadline: `${dynastyPlayer.name} building a legacy`,
          body: `${dynastyPlayer.rings} championships and counting.`,
          fullContent: `Championships are the ultimate measure of greatness. **${dynastyPlayer.name}** has ${dynastyPlayer.rings} of them.\n\nThat is not luck. That is not being carried. That is championship DNA — the ability to elevate your game when it matters most.\n\n${dynastyPlayer.mvp > 0 ? `Add ${dynastyPlayer.mvp} MVP(s) and ` : ''}${dynastyPlayer.sbmvp > 0 ? `${dynastyPlayer.sbmvp} Super Bowl MVP(s)` : ''} ${dynastyPlayer.mvp > 0 || dynastyPlayer.sbmvp > 0 ? "and you are looking at an all-time great." : "The winner mentality is undeniable."}\n\nCan they add another ring this season?`,
          player: dynastyPlayer,
          tier: 'analysis',
          icon: Trophy,
          category: 'Championship Corner',
        });
      }

      // Emerging star
      const risingStars = activePlayers.filter((p) => p.games < 48 && p.tpg >= 2.5).slice(0, 3);
      if (risingStars.length > 0) {
        newsStories.push({
          id: `story-${storyId++}`,
          headline: `THE NEXT GENERATION`,
          subheadline: `Young stars ready to take over`,
          body: `These players are just getting started.`,
          fullContent: risingStars.map((star) => 
            `**${star.name}** (${star.position})\n${star.games} games • ${star.tpg.toFixed(2)} TPG • ${star.trueTalent.toFixed(0)} True Talent\n${star.status === 'Active' ? 'Currently active and ascending.' : ''}`
          ).join('\n\n'),
          players: risingStars,
          tier: 'milestone',
          icon: Sparkles,
          category: 'Rising Stars',
        });
      }
    }

    // GOAT Watch
    const goat = topByLegacy[0];
    if (goat) {
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `THE GOAT DEBATE`,
        subheadline: `Who is the greatest of all time?`,
        body: `${goat.name} leads all-time with ${goat.careerLegacy.toFixed(0)} legacy points.`,
        fullContent: `The question that never dies: Who is the greatest player in league history?\n\nBy the numbers, **${goat.name}** has the strongest case:\n\n• ${goat.careerLegacy.toFixed(0)} Career Legacy\n• ${goat.rings} Championship(s)\n• ${goat.mvp} MVP(s)\n• ${goat.trueTalent.toFixed(0)} True Talent\n\nBut the GOAT debate is never just about numbers. It's about moments. It's about dominance. It's about changing the game.\n\n**The Top 5 All-Time:**\n${topByLegacy.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} — ${p.careerLegacy.toFixed(0)}`).join('\n')}`,
        player: goat,
        players: topByLegacy.slice(0, 5),
        tier: 'analysis',
        icon: Crown,
        category: 'GOAT Watch',
      });
    }

    // Efficiency Kings
    const effKing = topByTPG[0];
    if (effKing && effKing.tpg >= 2.5) {
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `EFFICIENCY KINGS`,
        subheadline: `Maximum impact, every snap`,
        body: `${effKing.name} leads with ${effKing.tpg.toFixed(2)} TPG.`,
        fullContent: `In the modern game, efficiency is everything. **${effKing.name}** is the master of it.\n\n${effKing.tpg.toFixed(2)} Talent Per Game means every time they step on the field, they're producing at an elite level.\n\n**TPG Leaders:**\n${topByTPG.map((p, i) => `${i + 1}. ${p.name} (${p.position}) — ${p.tpg.toFixed(2)} TPG`).join('\n')}\n\nThese players don't pad stats. They win games.`,
        player: effKing,
        players: topByTPG,
        tier: 'power-ranking',
        icon: Target,
        category: 'Analytics',
      });
    }

    // Hall of Fame class
    if (hofPlayers.length > 0) {
      const newHofers = hofPlayers.filter((p) => p.status === 'Retired').slice(0, 5);
      if (newHofers.length > 0) {
        newsStories.push({
          id: `story-${storyId++}`,
          headline: `HALL OF FAME CLASS`,
          subheadline: `${hofPlayers.length} players have earned immortality`,
          body: `The greatest to ever play, enshrined forever.`,
          fullContent: `The Hall of Fame represents the pinnacle of achievement. ${hofPlayers.length} players have crossed the 8,000 legacy threshold.\n\n**Recent Inductees:**\n${newHofers.map((p) => `• **${p.name}** (${p.position}) — ${p.careerLegacy.toFixed(0)} Legacy, ${p.rings} Rings`).join('\n')}\n\n${legendaryPlayers.length > 0 ? `**Legendary Status (12,000+):** ${legendaryPlayers.length} players` : ''}\n\nThese are the names that will be remembered forever.`,
          players: newHofers,
          tier: 'milestone',
          icon: Award,
          category: 'Hall of Fame',
        });
      }
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
          <h2 className="font-display text-4xl font-bold mb-4 text-chart-4">VAULT SPORTS NETWORK</h2>
          <p className="text-muted-foreground text-lg">Upload your league data to generate dynamic news coverage.</p>
        </div>
      </div>
    );
  }

  const featuredStory = stories[0];
  const secondaryStories = stories.slice(1, 3);
  const gridStories = stories.slice(3);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Network Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-chart-4/20 via-primary/10 to-accent/20 p-6 border border-border/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-chart-4/20 border border-chart-4/30">
              <Newspaper className="w-8 h-8 text-chart-4" />
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">VAULT SPORTS NETWORK</h1>
              <p className="text-muted-foreground text-sm uppercase tracking-widest">
                Season {currentSeason} Coverage
              </p>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50">
              <Users className="w-4 h-4 text-primary" />
              <span>{leagueStats.activePlayers} Active</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50">
              <Award className="w-4 h-4 text-chart-4" />
              <span>{leagueStats.hofCount} HOF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breaking News Ticker */}
      {stories.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 overflow-hidden">
          <span className="flex-shrink-0 flex items-center gap-2 px-3 py-1 rounded bg-destructive text-destructive-foreground text-xs font-bold uppercase">
            <Flame className="w-3 h-3 animate-pulse" />
            Live
          </span>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">
              {stories.map((s) => s.headline).join(' • ')}
            </p>
          </div>
        </div>
      )}

      {/* Featured + Secondary Grid */}
      {featuredStory && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Featured Story */}
          <button
            onClick={() => setSelectedStory(featuredStory)}
            className="lg:col-span-2 group relative overflow-hidden rounded-xl border border-border/30 bg-card hover:border-primary/50 transition-all duration-300 text-left"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${TIER_STYLES[featuredStory.tier].gradient} opacity-50`} />
            <div className="relative p-8">
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${TIER_STYLES[featuredStory.tier].badge}`}>
                  {featuredStory.category}
                </span>
                <featuredStory.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-2 group-hover:text-primary transition-colors">
                {featuredStory.headline}
              </h2>
              {featuredStory.subheadline && (
                <p className="text-xl text-muted-foreground mb-4">{featuredStory.subheadline}</p>
              )}
              <p className="text-muted-foreground leading-relaxed mb-6">{featuredStory.body}</p>
              <div className="flex items-center gap-2 text-primary text-sm font-medium">
                <span>Read Full Story</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* Secondary Stories */}
          <div className="flex flex-col gap-4">
            {secondaryStories.map((story) => (
              <StoryCard 
                key={story.id} 
                story={story} 
                variant="compact" 
                onClick={() => setSelectedStory(story)} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Story Grid */}
      {gridStories.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gridStories.map((story) => (
            <StoryCard 
              key={story.id} 
              story={story} 
              onClick={() => setSelectedStory(story)} 
            />
          ))}
        </div>
      )}

      {/* Power Rankings Section */}
      <div className="grid lg:grid-cols-2 gap-4">
        <RankingCard 
          title="Legacy Power Rankings" 
          icon={Crown} 
          players={leagueStats.topByLegacy.slice(0, 5)} 
          statKey="careerLegacy"
          statLabel="Legacy"
        />
        <RankingCard 
          title="Ring Leaders" 
          icon={Trophy} 
          players={leagueStats.topByRings} 
          statKey="rings"
          statLabel="Rings"
        />
      </div>

      {/* Story Modal */}
      <StoryModal story={selectedStory} onClose={() => setSelectedStory(null)} />
    </div>
  );
};

interface StoryCardProps {
  story: NewsStory;
  variant?: 'default' | 'compact';
  onClick: () => void;
}

const StoryCard = ({ story, variant = 'default', onClick }: StoryCardProps) => {
  const style = TIER_STYLES[story.tier];
  const Icon = story.icon;

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={`group flex-1 p-4 rounded-xl border border-border/30 bg-card hover:border-primary/50 transition-all text-left ${style.border}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${style.badge}`}>
            {story.category}
          </span>
        </div>
        <h3 className="font-display text-lg font-bold mb-1 group-hover:text-primary transition-colors line-clamp-2">
          {story.headline}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{story.body}</p>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`group p-5 rounded-xl border border-border/30 bg-card hover:border-primary/50 transition-all text-left ${style.border}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4`} style={{ color: `hsl(var(--${story.tier === 'breaking' ? 'destructive' : story.tier === 'hot-take' ? 'chart-4' : 'primary'}))` }} />
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${style.badge}`}>
          {story.category}
        </span>
      </div>
      <h3 className="font-display text-xl font-bold mb-2 group-hover:text-primary transition-colors">
        {story.headline}
      </h3>
      {story.subheadline && (
        <p className="text-sm text-foreground/80 mb-2">{story.subheadline}</p>
      )}
      <p className="text-sm text-muted-foreground line-clamp-3">{story.body}</p>
      {story.player && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/30">
          <PositionBadge position={story.player.position} className="text-xs" />
          <span className="text-xs text-muted-foreground">{story.player.name}</span>
        </div>
      )}
    </button>
  );
};

interface StoryModalProps {
  story: NewsStory | null;
  onClose: () => void;
}

const StoryModal = ({ story, onClose }: StoryModalProps) => {
  if (!story) return null;

  const style = TIER_STYLES[story.tier];
  const Icon = story.icon;
  const teamColors = story.player ? getTeamColors(story.player.team) : null;

  return (
    <Dialog open={!!story} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-border/50">
        {/* Header */}
        <div 
          className={`p-6 bg-gradient-to-br ${style.gradient}`}
          style={teamColors ? {
            borderBottom: `3px solid hsl(${teamColors.primary})`,
          } : undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5" />
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${style.badge}`}>
                {story.category}
              </span>
            </div>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">{story.headline}</h2>
          {story.subheadline && (
            <p className="text-xl text-muted-foreground">{story.subheadline}</p>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Full article content */}
            <div className="prose prose-invert prose-sm max-w-none">
              {(story.fullContent || story.body).split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {paragraph.split('**').map((part, j) => 
                    j % 2 === 1 ? <strong key={j} className="text-foreground">{part}</strong> : part
                  )}
                </p>
              ))}
            </div>

            {/* Featured Players */}
            {(story.players || (story.player ? [story.player] : [])).length > 0 && (
              <div className="pt-4 border-t border-border/30">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Featured Players</h4>
                <div className="grid gap-2">
                  {(story.players || [story.player]).filter(Boolean).map((p) => {
                    const colors = getTeamColors(p!.team);
                    return (
                      <div 
                        key={p!.name} 
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                        style={colors ? { borderLeft: `3px solid hsl(${colors.primary})` } : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <PositionBadge position={p!.position} className="text-xs" />
                          <div>
                            <p className="font-semibold">{p!.name}</p>
                            <p className="text-xs text-muted-foreground">{p!.team || 'Free Agent'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-primary">{p!.careerLegacy.toFixed(0)}</p>
                          <p className="text-xs text-muted-foreground">Legacy</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

interface RankingCardProps {
  title: string;
  icon: typeof Trophy;
  players: Player[];
  statKey: keyof Player;
  statLabel: string;
}

const RankingCard = ({ title, icon: Icon, players, statKey, statLabel }: RankingCardProps) => (
  <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
    <div className="flex items-center gap-2 p-4 border-b border-border/30 bg-secondary/20">
      <Icon className="w-5 h-5 text-chart-4" />
      <h3 className="font-display text-lg font-bold uppercase">{title}</h3>
    </div>
    <div className="p-2">
      {players.map((player, i) => {
        const colors = getTeamColors(player.team);
        const value = player[statKey] as number;
        return (
          <div 
            key={player.name}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors"
            style={colors ? { borderLeft: `3px solid hsl(${colors.primary})` } : undefined}
          >
            <span className="font-display text-2xl font-bold text-muted-foreground/40 w-8">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{player.name}</p>
              <div className="flex items-center gap-2">
                <PositionBadge position={player.position} className="text-xs" />
                {player.team && <span className="text-xs text-muted-foreground">{player.team}</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-bold text-primary">
                {typeof value === 'number' ? (statKey === 'careerLegacy' ? value.toFixed(0) : value.toLocaleString()) : value}
              </p>
              <p className="text-xs text-muted-foreground">{statLabel}</p>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default CommentaryTab;
