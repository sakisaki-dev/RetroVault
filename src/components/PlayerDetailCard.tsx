import { Trophy, Star, Crown, TrendingUp, Calendar, Medal, Award, Pencil } from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import { getTeamColors } from '@/utils/teamColors';
import { findNFLTeam } from '@/utils/nflTeams';
import { getMetricColor, getMetricBgColor, getMetricTier, getTierLabel } from '@/utils/metricColors';
import PositionBadge from './PositionBadge';
import StatusBadge from './StatusBadge';
import PlayerEditDialog from './PlayerEditDialog';
import { useLeague } from '@/context/LeagueContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PlayerDetailCardProps {
  player: Player | null;
  onClose: () => void;
}

const PlayerDetailCard = ({ player, onClose }: PlayerDetailCardProps) => {
  const { getSeasonHistory, refreshData } = useLeague();
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (!player) return null;

  const seasonHistory = getSeasonHistory(player);
  const teamColors = getTeamColors(player.team);
  const nflTeam = findNFLTeam(player.team);

  const getStatRows = (p: Player) => {
    const pos = p.position;

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

    return { positionStats };
  };

  const { positionStats } = getStatRows(player);

  const isDefense = ['LB', 'DB', 'DL'].includes(player.position);

  const awards = [
    { label: 'Games', value: player.games, icon: null },
    { label: 'Rings', value: player.rings, icon: Trophy },
    { label: 'MVP', value: player.mvp, icon: Crown },
    { label: isDefense ? 'DPOY' : 'OPOY', value: player.opoy, icon: Star },
    { label: 'SB MVP', value: player.sbmvp, icon: Medal },
    { label: 'ROTY', value: player.roty, icon: Award },
  ];

  const metrics = [
    { label: 'Legacy', value: player.careerLegacy, metric: 'careerLegacy' },
    { label: 'Talent', value: player.trueTalent, metric: 'trueTalent' },
    { label: 'Dominance', value: player.dominance, metric: 'dominance' },
    { label: 'TPG', value: player.tpg, metric: 'tpg' },
  ];

  return (
    <Dialog open={!!player} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl glass-card border-border/50 p-0 overflow-hidden">
        {/* Header with team colors and NFL branding */}
        <div 
          className="p-6 border-b border-border/30 relative"
          style={teamColors ? {
            background: `linear-gradient(135deg, hsl(${teamColors.primary} / 0.2) 0%, transparent 100%)`,
            borderLeft: `4px solid hsl(${teamColors.primary})`,
          } : undefined}
        >
          {/* NFL Team Logo Banner */}
          {nflTeam && (
            <div className="absolute right-4 top-4 opacity-20">
              <img 
                src={nflTeam.logoUrl} 
                alt={nflTeam.fullName} 
                className="w-24 h-24 object-contain"
              />
            </div>
          )}
          <DialogHeader>
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-start gap-4">
                {/* Team Logo */}
                {nflTeam && (
                  <div 
                    className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                    style={{ 
                      backgroundColor: `hsl(${nflTeam.primaryColor} / 0.15)`,
                      border: `2px solid hsl(${nflTeam.primaryColor} / 0.3)`,
                    }}
                  >
                    <img 
                      src={nflTeam.logoUrl} 
                      alt={nflTeam.fullName} 
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                )}
                <div>
                  <DialogTitle className="font-display text-3xl tracking-wide text-foreground">
                    {player.name}
                  </DialogTitle>
                  {player.nickname && (
                    <p className="text-lg text-muted-foreground italic mt-1">"{player.nickname}"</p>
                  )}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <PositionBadge position={player.position} />
                    <StatusBadge status={player.status} />
                    {nflTeam ? (
                      <span 
                        className="text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2"
                        style={{
                          backgroundColor: `hsl(${nflTeam.primaryColor} / 0.2)`,
                          color: `hsl(${nflTeam.primaryColor})`,
                        }}
                      >
                        <img src={nflTeam.logoUrl} alt="" className="w-4 h-4" />
                        {nflTeam.fullName}
                      </span>
                    ) : player.team ? (
                      <span 
                        className="text-sm font-medium px-3 py-1 rounded-full"
                        style={teamColors ? {
                          backgroundColor: `hsl(${teamColors.primary} / 0.2)`,
                          color: `hsl(${teamColors.primary})`,
                        } : undefined}
                      >
                        {player.team}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditOpen(true)}
                title="Edit player"
                className="h-9 w-9"
              >
                <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        {/* Metrics Bar with tier labels */}
        <div className="grid grid-cols-4 gap-0 border-b border-border/30">
          {metrics.map((m) => {
            const tier = getMetricTier(m.value, m.metric);
            const color = getMetricColor(m.value, m.metric);
            const bgColor = getMetricBgColor(m.value, m.metric);
            const tierLabel = getTierLabel(tier);
            return (
              <div key={m.label} className="p-4 text-center border-r border-border/30 last:border-r-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
                <p 
                  className="font-mono text-xl font-bold px-2 py-1 rounded"
                  style={{ color, backgroundColor: bgColor }}
                >
                  {m.value.toLocaleString()}
                </p>
                <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color }}>
                  {tierLabel}
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
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {awards.map((award) => {
                const Icon = award.icon;
                return (
                  <div key={award.label} className="p-3 rounded-lg bg-secondary/30 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      {Icon && <Icon className="w-3 h-3" />}
                      {award.label}
                    </p>
                    <p className="font-mono text-lg font-bold text-foreground">{award.value}</p>
                  </div>
                );
              })}
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

          {/* Season History Table */}
          {seasonHistory.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                Season-by-Season Breakdown ({seasonHistory.length} seasons)
              </h4>
              <ScrollArea className="h-[200px] rounded-lg border border-border/30">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30">
                      <TableHead className="font-bold text-foreground sticky top-0 bg-secondary/80">Season</TableHead>
                      <TableHead className="text-right sticky top-0 bg-secondary/80">GP</TableHead>
                      {player.position === 'QB' && (
                        <>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Pass Yds</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Pass TD</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">INT</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Rush Yds</TableHead>
                        </>
                      )}
                      {player.position === 'RB' && (
                        <>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Rush Yds</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Rush TD</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Rec Yds</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Rec TD</TableHead>
                        </>
                      )}
                      {(player.position === 'WR' || player.position === 'TE') && (
                        <>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Rec</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Rec Yds</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Rec TD</TableHead>
                        </>
                      )}
                      {['LB', 'DB', 'DL'].includes(player.position) && (
                        <>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Tackles</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">Sacks</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">INT</TableHead>
                          <TableHead className="text-right sticky top-0 bg-secondary/80">FF</TableHead>
                        </>
                      )}
                      <TableHead className="text-right sticky top-0 bg-secondary/80">🏆</TableHead>
                      <TableHead className="text-right sticky top-0 bg-secondary/80">MVP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasonHistory.map((sh) => (
                      <TableRow key={sh.season} className="hover:bg-secondary/20">
                        <TableCell className="font-display font-bold text-accent">{sh.season}</TableCell>
                        <TableCell className="text-right font-mono">{sh.games}</TableCell>
                        {player.position === 'QB' && (
                          <>
                            <TableCell className="text-right font-mono">{(sh.passYds || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{sh.passTD || 0}</TableCell>
                            <TableCell className="text-right font-mono">{sh.interceptions || 0}</TableCell>
                            <TableCell className="text-right font-mono">{(sh.rushYds || 0).toLocaleString()}</TableCell>
                          </>
                        )}
                        {player.position === 'RB' && (
                          <>
                            <TableCell className="text-right font-mono">{(sh.rushYds || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{sh.rushTD || 0}</TableCell>
                            <TableCell className="text-right font-mono">{(sh.recYds || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{sh.recTD || 0}</TableCell>
                          </>
                        )}
                        {(player.position === 'WR' || player.position === 'TE') && (
                          <>
                            <TableCell className="text-right font-mono">{sh.receptions || 0}</TableCell>
                            <TableCell className="text-right font-mono">{(sh.recYds || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{sh.recTD || 0}</TableCell>
                          </>
                        )}
                        {['LB', 'DB', 'DL'].includes(player.position) && (
                          <>
                            <TableCell className="text-right font-mono">{sh.tackles || 0}</TableCell>
                            <TableCell className="text-right font-mono">{sh.sacks || 0}</TableCell>
                            <TableCell className="text-right font-mono">{sh.interceptions || 0}</TableCell>
                            <TableCell className="text-right font-mono">{sh.forcedFumbles || 0}</TableCell>
                          </>
                        )}
                        <TableCell className="text-right font-mono text-chart-4">{sh.rings || 0}</TableCell>
                        <TableCell className="text-right font-mono text-primary">{sh.mvp || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Stats shown are per-season increments. Upload more seasons to build history.
              </p>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Edit Dialog */}
      <PlayerEditDialog
        player={isEditOpen ? player : null}
        onClose={() => setIsEditOpen(false)}
        onSave={() => {
          refreshData();
          setIsEditOpen(false);
        }}
      />
    </Dialog>
  );
};

export default PlayerDetailCard;
