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
    const retiredPlayers = allPlayers.filter((p) => p.status === 'Retired');
    const hofPlayers = allPlayers.filter((p) => p.careerLegacy >= 8000);
    const legendaryPlayers = allPlayers.filter((p) => p.careerLegacy >= 12000);

    const topByLegacy = [...allPlayers].sort((a, b) => b.careerLegacy - a.careerLegacy).slice(0, 10);
    const topByTPG = [...activePlayers].sort((a, b) => b.tpg - a.tpg).slice(0, 5);
    const topByRings = [...allPlayers].sort((a, b) => b.rings - a.rings).slice(0, 5);
    const topByMVP = [...allPlayers].filter((p) => p.mvp > 0).sort((a, b) => b.mvp - a.mvp).slice(0, 5);
    const topByDominance = [...allPlayers].sort((a, b) => b.dominance - a.dominance).slice(0, 5);
    const topByTrueTalent = [...allPlayers].sort((a, b) => b.trueTalent - a.trueTalent).slice(0, 5);

    // Position-specific sorting
    const qbsByLegacy = [...careerData.quarterbacks].sort((a, b) => b.careerLegacy - a.careerLegacy);
    const rbsByLegacy = [...careerData.runningbacks].sort((a, b) => b.careerLegacy - a.careerLegacy);
    const wrsByLegacy = [...careerData.widereceivers].sort((a, b) => b.careerLegacy - a.careerLegacy);
    const defByLegacy = [...careerData.linebackers, ...careerData.defensivebacks, ...careerData.defensiveline].sort((a, b) => b.careerLegacy - a.careerLegacy);

    // Veterans (high games played)
    const veterans = activePlayers.filter((p) => p.games >= 128).sort((a, b) => b.games - a.games);
    
    // Rookies / Young players (low games)
    const rookies = activePlayers.filter((p) => p.games <= 16 && p.games > 0).sort((a, b) => b.tpg - a.tpg);
    
    // Underperformers (high talent, low legacy ratio)
    const underperformers = activePlayers.filter((p) => p.trueTalent >= 700 && p.rings === 0 && p.mvp === 0).slice(0, 5);
    
    // Award collectors (opoy field is used for both OPOY and DPOY depending on position)
    const multiAwardWinners = allPlayers.filter((p) => (p.mvp + p.opoy + p.sbmvp + p.roty) >= 3).sort((a, b) => 
      (b.mvp + b.opoy + b.sbmvp + b.roty) - (a.mvp + a.opoy + a.sbmvp + a.roty)
    );

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
      const topTE = tes.length > 0 ? tes.reduce((a, b) => (a?.recYds > b?.recYds ? a : b), tes[0]) : null;
      const topRusherTD = rbs.length > 0 ? rbs.reduce((a, b) => (a?.rushTD > b?.rushTD ? a : b), rbs[0]) : null;

      // MVP Race - Dynamic based on actual stats across all offensive positions
      const mvpCandidates: { player: Player; careerPlayer: Player; score: number; statLine: string }[] = [];
      
      // Score QBs by passing performance
      qbs.forEach((qb) => {
        if (qb.passYds > 0) {
          const careerQB = careerData.quarterbacks.find((q) => q.name === qb.name);
          const score = (qb.passYds / 100) + (qb.passTD * 10) + (qb.rushTD * 8) - (qb.interceptions * 5);
          mvpCandidates.push({
            player: qb,
            careerPlayer: careerQB || qb,
            score,
            statLine: `${qb.passYds.toLocaleString()} pass yds, ${qb.passTD} TD`
          });
        }
      });
      
      // Score RBs by rushing performance
      rbs.forEach((rb) => {
        if (rb.rushYds > 0) {
          const careerRB = careerData.runningbacks.find((r) => r.name === rb.name);
          const score = (rb.rushYds / 50) + (rb.rushTD * 12) + (rb.recYds / 100) + (rb.recTD * 8);
          mvpCandidates.push({
            player: rb,
            careerPlayer: careerRB || rb,
            score,
            statLine: `${rb.rushYds.toLocaleString()} rush yds, ${rb.rushTD} TD`
          });
        }
      });
      
      // Score WRs by receiving performance
      wrs.forEach((wr) => {
        if (wr.recYds > 0) {
          const careerWR = careerData.widereceivers.find((w) => w.name === wr.name);
          const score = (wr.recYds / 60) + (wr.recTD * 10) + (wr.receptions / 5);
          mvpCandidates.push({
            player: wr,
            careerPlayer: careerWR || wr,
            score,
            statLine: `${wr.recYds.toLocaleString()} rec yds, ${wr.recTD} TD`
          });
        }
      });
      
      // Sort by MVP score and get top candidates
      mvpCandidates.sort((a, b) => b.score - a.score);
      const topMvpCandidates = mvpCandidates.slice(0, 3);
      
      if (topMvpCandidates.length >= 2) {
        const [first, second, third] = topMvpCandidates;
        const candidateNames = topMvpCandidates.map(c => c.player.name.split(' ').pop()).join(' vs ');
        
        newsStories.push({
          id: `story-${storyId++}`,
          headline: `MVP RACE HEATS UP`,
          subheadline: candidateNames,
          body: `${topMvpCandidates.length === 3 ? 'Three' : 'Two'} titans battle for the league's most prestigious individual honor.`,
          fullContent: topMvpCandidates.map((candidate, idx) => {
            const ordinal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
            const mvpNote = candidate.careerPlayer.mvp 
              ? `With ${candidate.careerPlayer.mvp} career MVP(s), they know what it takes.` 
              : 'A first MVP would cement their elite status.';
            return `${ordinal} **${candidate.player.name}** (${candidate.player.position})\n${candidate.statLine}\n${mvpNote}`;
          }).join('\n\n') + '\n\nVoters will have a tough decision. This could go down to the wire.',
          players: topMvpCandidates.map(c => c.careerPlayer),
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
          headline: `${topQB.name.split(' ').pop()?.toUpperCase()} ENTERS HISTORY BOOKS`,
          subheadline: `5,000-yard season achieved`,
          body: `An elite performance that will be remembered for generations.`,
          fullContent: `We are witnessing greatness in its purest form.\n\n**${topQB.name}** just put up ${topQB.passYds.toLocaleString()} passing yards — joining the exclusive 5,000-yard club. Only the truly elite ever reach this milestone.\n\n${topQB.passTD} touchdown passes. A passer rating that makes defensive coordinators lose sleep. This is not just a great season. This is LEGENDARY.\n\n${careerQB.rings > 0 ? `With ${careerQB.rings} ring(s) already, this season adds another chapter to an already Hall of Fame resume.` : 'Now the mission is to turn this brilliance into a championship run.'}`,
          player: careerQB,
          tier: 'breaking',
          icon: Flame,
          category: 'Historic Season',
        });
      }

      // TD Machine - RB with 15+ rushing TDs
      if (topRusherTD && topRusherTD.rushTD >= 15) {
        const careerRB = careerData.runningbacks.find((r) => r.name === topRusherTD.name) || topRusherTD;
        newsStories.push({
          id: `story-${storyId++}`,
          headline: `TOUCHDOWN MACHINE`,
          subheadline: `${topRusherTD.name} is unstoppable in the red zone`,
          body: `${topRusherTD.rushTD} rushing touchdowns this season. Defenses have no answer.`,
          fullContent: `When the ball is on the goal line, there is only one player you want carrying it.\n\n**${topRusherTD.name}** has ${topRusherTD.rushTD} rushing touchdowns — a number that puts fear into every defensive coordinator.\n\n${topRusherTD.rushYds.toLocaleString()} rushing yards to go with it. This is not just a goal-line back. This is a complete force.\n\n${careerRB.rings > 0 ? `With ${careerRB.rings} championship ring(s), they know how to finish.` : 'A championship would be the cherry on top of this elite season.'}`,
          player: careerRB,
          tier: 'hot-take',
          icon: Zap,
          category: 'Red Zone Report',
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
          fullContent: `**${topWR.name}** is playing a different sport than everyone else.\n\n${topWR.receptions} receptions. ${topWR.recYds.toLocaleString()} yards. ${topWR.recTD} touchdowns.\n\nDefensive coordinators are game-planning specifically for this player and it does not matter. Double coverage? Does not matter. Triple coverage? Still getting open.\n\n${careerWR.opoy > 0 ? `A ${careerWR.opoy}x OPOY winner proving why.` : 'An OPOY award feels inevitable.'} ${careerWR.rings > 0 ? `And yes, they have got the rings (${careerWR.rings}) to back it up.` : ''}`,
          player: careerWR,
          tier: 'hot-take',
          icon: Zap,
          category: 'Elite Performance',
        });
      }

      // TE Breakout
      if (topTE && topTE.recYds >= 900) {
        const careerTE = careerData.tightends.find((t) => t.name === topTE.name) || topTE;
        newsStories.push({
          id: `story-${storyId++}`,
          headline: `THE TE REVOLUTION`,
          subheadline: `${topTE.name} redefining the position`,
          body: `Tight ends are the new weapon. ${topTE.recYds.toLocaleString()} yards proves it.`,
          fullContent: `The modern NFL tight end is not your father's blocking specialist.\n\n**${topTE.name}** is putting up receiver numbers from the tight end position: ${topTE.receptions} catches, ${topTE.recYds.toLocaleString()} yards, ${topTE.recTD} touchdowns.\n\nThis kind of production creates mismatches that are impossible to solve. Too big for corners. Too fast for linebackers.\n\n${careerTE.trueTalent >= 700 ? `With a ${careerTE.trueTalent.toFixed(0)} True Talent rating, this is generational ability.` : 'This breakout season could be just the beginning.'}`,
          player: careerTE,
          tier: 'analysis',
          icon: TrendingUp,
          category: 'Position Watch',
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
        fullContent: `The question that never dies: Who is the greatest player in league history?\n\nBy the numbers, **${goat.name}** has the strongest case:\n\n• ${goat.careerLegacy.toFixed(0)} Career Legacy\n• ${goat.rings} Championship(s)\n• ${goat.mvp} MVP(s)\n• ${goat.trueTalent.toFixed(0)} True Talent\n\nBut the GOAT debate is never just about numbers. It is about moments. It is about dominance. It is about changing the game.\n\n**The Top 5 All-Time:**\n${topByLegacy.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} — ${p.careerLegacy.toFixed(0)}`).join('\n')}`,
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
        fullContent: `In the modern game, efficiency is everything. **${effKing.name}** is the master of it.\n\n${effKing.tpg.toFixed(2)} Talent Per Game means every time they step on the field, they are producing at an elite level.\n\n**TPG Leaders:**\n${topByTPG.map((p, i) => `${i + 1}. ${p.name} (${p.position}) — ${p.tpg.toFixed(2)} TPG`).join('\n')}\n\nThese players do not pad stats. They win games.`,
        player: effKing,
        players: topByTPG,
        tier: 'power-ranking',
        icon: Target,
        category: 'Analytics',
      });
    }

    // Dominance Rankings
    if (topByDominance.length > 0) {
      const domKing = topByDominance[0];
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `PEAK DOMINANCE`,
        subheadline: `The most dominant players ever`,
        body: `${domKing.name} leads with ${domKing.dominance.toFixed(0)} dominance rating.`,
        fullContent: `Dominance measures how much a player outperformed their peers at their peak.\n\n**${domKing.name}** sits at the top with a staggering ${domKing.dominance.toFixed(0)} dominance score.\n\n**Most Dominant Players:**\n${topByDominance.map((p, i) => `${i + 1}. ${p.name} (${p.position}) — ${p.dominance.toFixed(0)}`).join('\n')}\n\nThese are the players who made everyone else look average.`,
        player: domKing,
        players: topByDominance,
        tier: 'power-ranking',
        icon: BarChart3,
        category: 'Analytics Deep Dive',
      });
    }

    // Pure Talent Rankings
    if (topByTrueTalent.length > 0) {
      const talentKing = topByTrueTalent[0];
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `PURE TALENT`,
        subheadline: `Raw ability at its finest`,
        body: `${talentKing.name} has a ${talentKing.trueTalent.toFixed(0)} True Talent rating.`,
        fullContent: `True Talent strips away context and measures pure ability.\n\n**${talentKing.name}** is the most talented player in league history with a ${talentKing.trueTalent.toFixed(0)} rating.\n\n**Top 5 Most Talented:**\n${topByTrueTalent.map((p, i) => `${i + 1}. ${p.name} (${p.position}) — ${talentKing.trueTalent.toFixed(0)}`).join('\n')}\n\nTalent does not guarantee championships — but it is the foundation of greatness.`,
        player: talentKing,
        players: topByTrueTalent,
        tier: 'analysis',
        icon: Star,
        category: 'Talent Evaluation',
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

    // Veteran Watch
    if (veterans.length > 0) {
      const ironMan = veterans[0];
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `IRON MAN WATCH`,
        subheadline: `${ironMan.name} defies Father Time`,
        body: `${ironMan.games} games and still going strong.`,
        fullContent: `Longevity in this league is earned, not given.\n\n**${ironMan.name}** has played ${ironMan.games} games — a testament to elite conditioning, smart play, and sheer determination.\n\n**Active Veterans (128+ games):**\n${veterans.slice(0, 5).map((p) => `• ${p.name} (${p.position}) — ${p.games} games`).join('\n')}\n\nEvery snap at this stage is a gift. These players are still competing at the highest level.`,
        player: ironMan,
        players: veterans.slice(0, 5),
        tier: 'milestone',
        icon: Medal,
        category: 'Longevity',
      });
    }

    // Rookie Impact
    if (rookies.length > 0) {
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `ROOKIE IMPACT`,
        subheadline: `First-year players making noise`,
        body: `The future is now for these young talents.`,
        fullContent: `Every great career starts somewhere. These rookies are making immediate impact.\n\n**Top Rookie Performers:**\n${rookies.slice(0, 5).map((p) => `• **${p.name}** (${p.position}) — ${p.tpg.toFixed(2)} TPG in ${p.games} games`).join('\n')}\n\nROTY candidates are emerging. The next generation has arrived.`,
        players: rookies.slice(0, 5),
        tier: 'milestone',
        icon: Sparkles,
        category: 'Rookie Watch',
      });
    }

    // Position GOAT debates
    if (qbsByLegacy.length >= 3) {
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `QB GOAT DEBATE`,
        subheadline: `The greatest quarterbacks of all time`,
        body: `${qbsByLegacy[0].name} leads all QBs with ${qbsByLegacy[0].careerLegacy.toFixed(0)} legacy.`,
        fullContent: `The most important position in football. Who is the greatest to ever do it?\n\n**All-Time QB Rankings:**\n${qbsByLegacy.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} — ${p.careerLegacy.toFixed(0)} Legacy, ${p.rings} Rings, ${p.mvp} MVPs`).join('\n')}\n\nRings matter. Stats matter. Moments matter. The debate rages on.`,
        player: qbsByLegacy[0],
        players: qbsByLegacy.slice(0, 5),
        tier: 'analysis',
        icon: Crown,
        category: 'Position Rankings',
      });
    }

    if (rbsByLegacy.length >= 3) {
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `RB LEGENDS`,
        subheadline: `The greatest running backs of all time`,
        body: `${rbsByLegacy[0].name} leads all RBs with ${rbsByLegacy[0].careerLegacy.toFixed(0)} legacy.`,
        fullContent: `Running back is the most punishing position. These players conquered it.\n\n**All-Time RB Rankings:**\n${rbsByLegacy.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} — ${p.careerLegacy.toFixed(0)} Legacy, ${p.rings} Rings`).join('\n')}\n\nYards. Touchdowns. Broken tackles. Championship runs. The complete package.`,
        player: rbsByLegacy[0],
        players: rbsByLegacy.slice(0, 5),
        tier: 'analysis',
        icon: Trophy,
        category: 'Position Rankings',
      });
    }

    if (wrsByLegacy.length >= 3) {
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `WR ROYALTY`,
        subheadline: `The greatest receivers of all time`,
        body: `${wrsByLegacy[0].name} leads all WRs with ${wrsByLegacy[0].careerLegacy.toFixed(0)} legacy.`,
        fullContent: `The playmakers. The game-breakers. The ones who make the impossible catch.\n\n**All-Time WR Rankings:**\n${wrsByLegacy.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} — ${p.careerLegacy.toFixed(0)} Legacy, ${p.rings} Rings`).join('\n')}\n\nCatching touchdowns and breaking hearts. These are the legends.`,
        player: wrsByLegacy[0],
        players: wrsByLegacy.slice(0, 5),
        tier: 'hot-take',
        icon: Zap,
        category: 'Position Rankings',
      });
    }

    if (defByLegacy.length >= 3) {
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `DEFENSIVE DOMINANCE`,
        subheadline: `The greatest defenders of all time`,
        body: `${defByLegacy[0].name} leads all defenders with ${defByLegacy[0].careerLegacy.toFixed(0)} legacy.`,
        fullContent: `Offense wins games. Defense wins championships. These players prove it.\n\n**All-Time Defensive Rankings:**\n${defByLegacy.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} (${p.position}) — ${p.careerLegacy.toFixed(0)} Legacy, ${p.rings} Rings`).join('\n')}\n\nFear-inducing, game-wrecking, championship-winning defenders.`,
        player: defByLegacy[0],
        players: defByLegacy.slice(0, 5),
        tier: 'power-ranking',
        icon: Target,
        category: 'Position Rankings',
      });
    }

    // Award Collectors
    if (multiAwardWinners.length > 0) {
      const collector = multiAwardWinners[0];
      const isDefensive = ['LB', 'DB', 'DL'].includes(collector.position);
      const totalAwards = collector.mvp + collector.opoy + collector.sbmvp + collector.roty;
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `HARDWARE COLLECTION`,
        subheadline: `The most decorated players ever`,
        body: `${collector.name} has won ${totalAwards} major individual awards.`,
        fullContent: `Awards are the ultimate recognition. These players have collected them all.\n\n**${collector.name}:**\n${collector.mvp > 0 ? `• ${collector.mvp}x MVP\n` : ''}${collector.opoy > 0 ? `• ${collector.opoy}x ${isDefensive ? 'DPOY' : 'OPOY'}\n` : ''}${collector.sbmvp > 0 ? `• ${collector.sbmvp}x Super Bowl MVP\n` : ''}${collector.roty > 0 ? `• ${collector.roty}x ROTY\n` : ''}\n**Most Decorated Players:**\n${multiAwardWinners.slice(0, 5).map((p) => `• ${p.name} — ${p.mvp + p.opoy + p.sbmvp + p.roty} awards`).join('\n')}`,
        player: collector,
        players: multiAwardWinners.slice(0, 5),
        tier: 'milestone',
        icon: Award,
        category: 'Award Watch',
      });
    }

    // Ringless Stars - Great players without championships
    if (underperformers.length > 0) {
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `RINGLESS STARS`,
        subheadline: `Elite talent still chasing glory`,
        body: `These stars have the talent. Can they get the ring?`,
        fullContent: `Championships are the ultimate goal. These elite players are still searching.\n\n**Stars Without Rings:**\n${underperformers.map((p) => `• **${p.name}** (${p.position}) — ${p.trueTalent.toFixed(0)} True Talent`).join('\n')}\n\nThe window is closing. Every season matters. Will this be the year?`,
        players: underperformers,
        tier: 'controversy',
        icon: AlertTriangle,
        category: 'Championship Chase',
      });
    }

    // Recent Retirements
    if (retiredPlayers.length > 0) {
      const recentRetirees = retiredPlayers.sort((a, b) => b.careerLegacy - a.careerLegacy).slice(0, 5);
      newsStories.push({
        id: `story-${storyId++}`,
        headline: `END OF AN ERA`,
        subheadline: `Legends who have hung up their cleats`,
        body: `${recentRetirees.length} players have retired. Their legacy lives on.`,
        fullContent: `All careers must end. These players finished theirs with distinction.\n\n**Notable Retirements:**\n${recentRetirees.map((p) => `• **${p.name}** (${p.position}) — ${p.games} games, ${p.rings} Rings, ${p.careerLegacy.toFixed(0)} Legacy`).join('\n')}\n\nThe jersey is retired. The memories remain forever.`,
        players: recentRetirees,
        tier: 'milestone',
        icon: Medal,
        category: 'Retirement',
      });
    }

    // League Parity Check
    const avgLegacy = allPlayers.reduce((sum, p) => sum + p.careerLegacy, 0) / allPlayers.length;
    const avgTPG = activePlayers.reduce((sum, p) => sum + p.tpg, 0) / activePlayers.length;
    newsStories.push({
      id: `story-${storyId++}`,
      headline: `STATE OF THE LEAGUE`,
      subheadline: `By the numbers`,
      body: `${allPlayers.length} players. ${activePlayers.length} active. ${hofPlayers.length} Hall of Famers.`,
      fullContent: `A comprehensive look at where the league stands.\n\n**League Statistics:**\n• Total Players: ${allPlayers.length}\n• Active Players: ${activePlayers.length}\n• Retired Players: ${retiredPlayers.length}\n• Hall of Famers: ${hofPlayers.length}\n• Legendary Players: ${legendaryPlayers.length}\n\n**Averages:**\n• Average Career Legacy: ${avgLegacy.toFixed(0)}\n• Average TPG (Active): ${avgTPG.toFixed(2)}\n\nThe league is ${legendaryPlayers.length >= 5 ? 'rich with elite talent' : 'still building its legends'}.`,
      tier: 'analysis',
      icon: BarChart3,
      category: 'League Report',
    });

    // Prioritize stories by tier and relevance - show max 8 most relevant
    const tierPriority: Record<string, number> = {
      'breaking': 1,
      'hot-take': 2,
      'controversy': 3,
      'milestone': 4,
      'power-ranking': 5,
      'analysis': 6,
    };

    const prioritizedStories = newsStories
      .sort((a, b) => {
        // First by tier priority
        const tierDiff = (tierPriority[a.tier] || 99) - (tierPriority[b.tier] || 99);
        if (tierDiff !== 0) return tierDiff;
        // Then prefer stories with specific players over general ones
        const aHasPlayer = a.player ? 1 : 0;
        const bHasPlayer = b.player ? 1 : 0;
        return bHasPlayer - aHasPlayer;
      })
      .slice(0, 6); // Show max 6 stories

    return {
      stories: prioritizedStories,
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
