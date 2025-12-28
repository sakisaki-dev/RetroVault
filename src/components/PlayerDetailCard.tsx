import { useMemo } from 'react';
import { X, Trophy, Star, Crown, TrendingUp, Calendar } from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import { getTeamColors } from '@/utils/teamColors';
import PositionBadge from './PositionBadge';
import StatusBadge from './StatusBadge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PlayerDetailCardProps {
  player: Player | null;
  seasonHistory?: { season: string; stats: Partial<Player> }[];
  onClose: () => void;
}

const PlayerDetailCard = ({ player, seasonHistory = [], onClose }: PlayerDetailCardProps) => {
  if (!player) return null;

  const teamColors = getTeamColors(player.team);

  const getStatRows = (p: Player) => {
    const pos = p.position;
    const baseStats = [
      { label: 'Games', value: p.games },
      { label: 'Rings', value: p.rings },
      { label: 'MVP', value: p.mvp },
      { label: 'SB MVP', value: p.sbmvp },
    ];

    let positionStats: { label: string; value: number | string }[] = [];

    if (pos === 'QB') {
      const qb = p as QBPlayer;
      positionStats = [
        { label: 'Pass Yds', value: qb.passYds.toLocaleString() },
        { label: 'Pass TD', value: qb.passTD },
        { label: 'Comp', value: qb.completions.toLocaleString() },
        { label: 'INT', value: qb.interceptions },
        { label: 'Rush Yds', value: qb.rushYds.toLocaleString() },
        { label: 'Rush TD', value: qb.rushTD },
      ];
    } else if (pos === 'RB') {
      const rb = p as RBPlayer;
      positionStats = [
        { label: 'Rush Yds', value: rb.rushYds.toLocaleString() },
        { label: 'Rush TD', value: rb.rushTD },
        { label: 'Attempts', value: rb.rushAtt },
        { label: 'Rec Yds', value: rb.recYds.toLocaleString() },
        { label: 'Rec TD', value: rb.recTD },
      ];
    } else if (pos === 'WR' || pos === 'TE') {
      const rec = p as WRPlayer | TEPlayer;
      positionStats = [
        { label: 'Rec Yds', value: rec.recYds.toLocaleString() },
        { label: 'Rec', value: rec.receptions },
        { label: 'Rec TD', value: rec.recTD },
        { label: 'Longest', value: rec.longest },
      ];
    } else if (['LB', 'DB', 'DL'].includes(pos)) {
      const def = p as LBPlayer | DBPlayer | DLPlayer;
      positionStats = [
        { label: 'Tackles', value: def.tackles },
        { label: 'Sacks', value: def.sacks },
        { label: 'INTs', value: def.interceptions },
        { label: 'FF', value: def.forcedFumbles },
      ];
    }

    return { baseStats, positionStats };
  };

  const { baseStats, positionStats } = getStatRows(player);

  const metricTier = (value: number, metric: string) => {
    if (metric === 'careerLegacy') {
      if (value >= 12000) return 'elite';
      if (value >= 8000) return 'good';
      if (value >= 5000) return 'average';
      return 'below';
    }
    if (value >= 8000) return 'elite';
    if (value >= 6000) return 'good';
    if (value >= 4000) return 'average';
    return 'below';
  };

  return (
    <Dialog open={!!player} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl glass-card border-border/50 p-0 overflow-hidden">
        {/* Header with team colors */}
        <div 
          className="p-6 border-b border-border/30"
          style={teamColors ? {
            background: `linear-gradient(135deg, hsl(${teamColors.primary} / 0.2) 0%, transparent 100%)`,
            borderLeft: `4px solid hsl(${teamColors.primary})`,
          } : undefined}
        >
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="font-display text-3xl tracking-wide text-foreground">
                  {player.name}
                </DialogTitle>
                {player.nickname && (
                  <p className="text-lg text-muted-foreground italic mt-1">"{player.nickname}"</p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <PositionBadge position={player.position} />
                  <StatusBadge status={player.status} />
                  {player.team && (
                    <span 
                      className="text-sm font-medium px-3 py-1 rounded-full"
                      style={teamColors ? {
                        backgroundColor: `hsl(${teamColors.primary} / 0.2)`,
                        color: `hsl(${teamColors.primary})`,
                      } : undefined}
                    >
                      {player.team}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-4 gap-0 border-b border-border/30">
          {[
            { label: 'Legacy', value: player.careerLegacy, metric: 'careerLegacy' },
            { label: 'Talent', value: player.trueTalent, metric: 'trueTalent' },
            { label: 'Dominance', value: player.dominance, metric: 'dominance' },
            { label: 'TPG', value: player.tpg, metric: 'tpg' },
          ].map((m) => {
            const tier = metricTier(m.value, m.metric);
            return (
              <div key={m.label} className="p-4 text-center border-r border-border/30 last:border-r-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
                <p className={`font-mono text-xl font-bold metric-${tier}`}>
                  {m.value.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Stats Grid */}
        <div className="p-6 space-y-6">
          {/* Career Accolades */}
          <div>
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-chart-4" />
              Career Accolades
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {baseStats.map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg bg-secondary/30 text-center">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="font-mono text-lg font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Position Stats */}
          <div>
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Career Statistics
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {positionStats.map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg bg-secondary/30 text-center">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="font-mono text-lg font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Season History */}
          {seasonHistory.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                Season History
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {seasonHistory.map((sh) => (
                  <div 
                    key={sh.season} 
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/30"
                  >
                    <span className="font-display text-lg text-accent">{sh.season}</span>
                    <div className="flex gap-4 text-sm">
                      {Object.entries(sh.stats).slice(0, 4).map(([key, val]) => (
                        <span key={key} className="text-muted-foreground">
                          <span className="text-foreground font-medium">{val as number}</span> {key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerDetailCard;
