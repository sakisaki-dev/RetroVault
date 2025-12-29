import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, Plus, Save, X, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Player, Position } from '@/types/player';
import { useLeague } from '@/context/LeagueContext';
import { toast } from 'sonner';
import {
  savePlayerEdit,
  deletePlayerEdit,
  type PlayerEdit,
} from '@/utils/indexedDB';
import { saveSeasonHistory, loadSeasonHistory, type SeasonSnapshot } from '@/utils/seasonHistory';

interface PlayerEditDialogProps {
  player: Player | null;
  isNewPlayer?: boolean;
  onClose: () => void;
  onSave: () => void;
}

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];

const getPositionStats = (position: Position): string[] => {
  switch (position) {
    case 'QB':
      return ['passYds', 'passTD', 'completions', 'attempts', 'interceptions', 'sacks', 'rushAtt', 'rushYds', 'rushTD'];
    case 'RB':
      return ['rushAtt', 'rushYds', 'rushTD', 'fumbles', 'receptions', 'recYds', 'recTD'];
    case 'WR':
    case 'TE':
      return ['receptions', 'recYds', 'recTD', 'fumbles', 'longest'];
    case 'OL':
      return ['blocks'];
    case 'LB':
    case 'DB':
    case 'DL':
      return ['tackles', 'interceptions', 'sacks', 'forcedFumbles'];
    default:
      return [];
  }
};

// All possible season stats by position (what gets recorded per season)
const getSeasonStats = (position: Position): string[] => {
  const baseStats = ['games', 'rings', 'mvp', 'opoy', 'sbmvp', 'roty'];
  switch (position) {
    case 'QB':
      return [...baseStats, 'passYds', 'passTD', 'completions', 'attempts', 'interceptions', 'sacks', 'rushAtt', 'rushYds', 'rushTD'];
    case 'RB':
      return [...baseStats, 'rushAtt', 'rushYds', 'rushTD', 'fumbles', 'receptions', 'recYds', 'recTD'];
    case 'WR':
    case 'TE':
      return [...baseStats, 'receptions', 'recYds', 'recTD', 'fumbles', 'longest'];
    case 'OL':
      return [...baseStats, 'blocks'];
    case 'LB':
    case 'DB':
    case 'DL':
      return [...baseStats, 'tackles', 'interceptions', 'sacks', 'forcedFumbles'];
    default:
      return baseStats;
  }
};

const statLabels: Record<string, string> = {
  games: 'Games',
  rings: 'Rings',
  mvp: 'MVP',
  opoy: 'OPOY/DPOY',
  sbmvp: 'SB MVP',
  roty: 'ROTY',
  passYds: 'Pass Yards',
  passTD: 'Pass TDs',
  completions: 'Completions',
  attempts: 'Attempts',
  interceptions: 'INTs',
  sacks: 'Sacks',
  rushAtt: 'Rush Att',
  rushYds: 'Rush Yards',
  rushTD: 'Rush TDs',
  fumbles: 'Fumbles',
  receptions: 'Receptions',
  recYds: 'Rec Yards',
  recTD: 'Rec TDs',
  longest: 'Longest',
  blocks: 'Blocks',
  tackles: 'Tackles',
  forcedFumbles: 'Forced Fum',
};

interface SeasonEdit {
  season: string;
  stats: Record<string, number>;
}

const PlayerEditDialog = ({ player, isNewPlayer = false, onClose, onSave }: PlayerEditDialogProps) => {
  const { getAvailableSeasons, refreshData, currentSeason } = useLeague();
  const availableSeasons = getAvailableSeasons();

  // Form state
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('QB');
  const [team, setTeam] = useState('');
  const [nickname, setNickname] = useState('');
  const [status, setStatus] = useState<'Active' | 'Retired'>('Active');
  const [games, setGames] = useState(0);
  const [rings, setRings] = useState(0);
  const [mvp, setMvp] = useState(0);
  const [opoy, setOpoy] = useState(0);
  const [sbmvp, setSbmvp] = useState(0);
  const [roty, setRoty] = useState(0);
  const [trueTalent, setTrueTalent] = useState(0);
  const [dominance, setDominance] = useState(0);
  const [careerLegacy, setCareerLegacy] = useState(0);
  const [tpg, setTpg] = useState(0);
  const [positionStats, setPositionStats] = useState<Record<string, number>>({});
  
  // Season history - each season is independent, stats are per-season deltas
  const [seasonEdits, setSeasonEdits] = useState<SeasonEdit[]>([]);

  // Load player data when dialog opens
  useEffect(() => {
    if (player && !isNewPlayer) {
      setName(player.name);
      setPosition(player.position);
      setTeam(player.team || '');
      setNickname(player.nickname || '');
      setStatus(player.status);
      setGames(player.games);
      setRings(player.rings);
      setMvp(player.mvp);
      setOpoy(player.opoy);
      setSbmvp(player.sbmvp);
      setRoty(player.roty);
      setTrueTalent(player.trueTalent);
      setDominance(player.dominance);
      setCareerLegacy(player.careerLegacy);
      setTpg(player.tpg);

      // Extract position stats
      const stats: Record<string, number> = {};
      getPositionStats(player.position).forEach((stat) => {
        stats[stat] = (player as any)[stat] || 0;
      });
      setPositionStats(stats);

      // Load existing season history - each entry is a per-season delta
      const history = loadSeasonHistory();
      const playerKey = `${player.position}:${player.name}`;
      const existingSeasons = history[playerKey] || [];
      
      setSeasonEdits(existingSeasons.map((s) => {
        const { season, ...rest } = s;
        const stats: Record<string, number> = {};
        Object.entries(rest).forEach(([k, v]) => {
          if (typeof v === 'number') stats[k] = v;
        });
        return { season, stats };
      }));
    } else if (isNewPlayer) {
      // Reset for new player
      setName('');
      setPosition('QB');
      setTeam('');
      setNickname('');
      setStatus('Active');
      setGames(0);
      setRings(0);
      setMvp(0);
      setOpoy(0);
      setSbmvp(0);
      setRoty(0);
      setTrueTalent(0);
      setDominance(0);
      setCareerLegacy(0);
      setTpg(0);
      setPositionStats({});
      setSeasonEdits([]);
    }
  }, [player, isNewPlayer]);

  // Update position stats when position changes
  useEffect(() => {
    const newStats: Record<string, number> = {};
    getPositionStats(position).forEach((stat) => {
      newStats[stat] = positionStats[stat] || 0;
    });
    setPositionStats(newStats);
  }, [position]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Player name is required');
      return;
    }

    const playerKey = `${position}:${name}`;
    const now = Date.now();

    const edit: PlayerEdit = {
      playerKey,
      position,
      name: name.trim(),
      team: team.trim() || undefined,
      nickname: nickname.trim() || undefined,
      status,
      trueTalent,
      dominance,
      careerLegacy,
      tpg,
      games,
      rings,
      mvp,
      opoy,
      sbmvp,
      roty,
      positionStats,
      manualSeasons: seasonEdits.length > 0 ? seasonEdits : undefined,
      createdAt: player ? now : now,
      updatedAt: now,
      isManuallyAdded: isNewPlayer,
    };

    try {
      await savePlayerEdit(edit);

      // Save season history - each season is stored independently as per-season deltas
      if (seasonEdits.length > 0) {
        const history = loadSeasonHistory();
        
        // Sort seasons by number
        const sortedSeasons = [...seasonEdits].sort((a, b) => {
          const aNum = parseInt(a.season.replace(/\D/g, '')) || 0;
          const bNum = parseInt(b.season.replace(/\D/g, '')) || 0;
          return aNum - bNum;
        });

        // Convert to snapshots - each season's stats are independent deltas
        const snapshots: SeasonSnapshot[] = sortedSeasons.map((se) => {
          const snapshot: SeasonSnapshot = {
            season: se.season,
            games: se.stats.games || 0,
            rings: se.stats.rings || 0,
            mvp: se.stats.mvp || 0,
            opoy: se.stats.opoy || 0,
            sbmvp: se.stats.sbmvp || 0,
            roty: se.stats.roty || 0,
          };
          
          // Add position-specific stats
          const posStats = getSeasonStats(position);
          posStats.forEach((stat) => {
            if (stat !== 'games' && stat !== 'rings' && stat !== 'mvp' && stat !== 'opoy' && stat !== 'sbmvp' && stat !== 'roty') {
              (snapshot as any)[stat] = se.stats[stat] || 0;
            }
          });
          
          return snapshot;
        });

        history[playerKey] = snapshots;
        saveSeasonHistory(history);
      } else {
        // If no seasons, remove from history
        const history = loadSeasonHistory();
        delete history[playerKey];
        saveSeasonHistory(history);
      }

      toast.success(isNewPlayer ? 'Player added successfully' : 'Player updated successfully');
      refreshData();
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save player:', error);
      toast.error('Failed to save player');
    }
  };

  const handleDelete = async () => {
    if (!player) return;

    const playerKey = `${player.position}:${player.name}`;

    try {
      await deletePlayerEdit(playerKey);

      // Also remove from season history
      const history = loadSeasonHistory();
      delete history[playerKey];
      saveSeasonHistory(history);

      toast.success('Player deleted');
      refreshData();
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to delete player:', error);
      toast.error('Failed to delete player');
    }
  };

  const addSeason = () => {
    // Include current season if available, plus all historical seasons
    const allSeasons = [...new Set([...availableSeasons, ...(currentSeason ? [currentSeason] : [])])];
    const unusedSeasons = allSeasons.filter(
      (s) => !seasonEdits.some((se) => se.season === s)
    );
    
    // If no available seasons, allow manual entry starting from Y1
    const nextSeason = unusedSeasons.length > 0 
      ? unusedSeasons[0] 
      : `Y${seasonEdits.length + 1}`;
    
    setSeasonEdits([...seasonEdits, { season: nextSeason, stats: {} }]);
  };

  const removeSeason = (index: number) => {
    setSeasonEdits(seasonEdits.filter((_, i) => i !== index));
  };

  const updateSeasonStat = (index: number, stat: string, value: number) => {
    setSeasonEdits(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        stats: { ...updated[index].stats, [stat]: value }
      };
      return updated;
    });
  };

  const updateSeasonName = (index: number, season: string) => {
    setSeasonEdits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], season };
      return updated;
    });
  };

  const positionStatsFields = useMemo(() => getPositionStats(position), [position]);
  const seasonStatsFields = useMemo(() => getSeasonStats(position), [position]);

  // Get all possible seasons for dropdown (including manual entries)
  const allPossibleSeasons = useMemo(() => {
    const seasons = new Set([...availableSeasons]);
    if (currentSeason) seasons.add(currentSeason);
    // Add Y1 through Y50 as options
    for (let i = 1; i <= 50; i++) {
      seasons.add(`Y${i}`);
    }
    return Array.from(seasons).sort((a, b) => {
      const aNum = parseInt(a.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    });
  }, [availableSeasons, currentSeason]);

  return (
    <Dialog open={!!player || isNewPlayer} onOpenChange={() => onClose()}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            {isNewPlayer ? 'Add New Player' : `Edit ${player?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isNewPlayer
              ? 'Add a new player with career statistics. Optionally add season history.'
              : 'Update player details, statistics, and season history.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="w-full justify-start px-6 border-b rounded-none h-12 bg-transparent">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="stats">Career Stats</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="seasons">Season History</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[55vh]">
            <TabsContent value="basic" className="p-6 space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Player Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter player name"
                    disabled={!isNewPlayer && !!player}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g., The GOAT"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={position}
                    onValueChange={(v) => setPosition(v as Position)}
                    disabled={!isNewPlayer && !!player}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <Input
                    id="team"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="Team name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={status === 'Active'}
                      onCheckedChange={(checked) =>
                        setStatus(checked ? 'Active' : 'Retired')
                      }
                    />
                    <span className="text-sm">{status}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="games">Games Played</Label>
                  <Input
                    id="games"
                    type="number"
                    min="0"
                    value={games}
                    onChange={(e) => setGames(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rings">Championships</Label>
                  <Input
                    id="rings"
                    type="number"
                    min="0"
                    value={rings}
                    onChange={(e) => setRings(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mvp">MVP Awards</Label>
                  <Input
                    id="mvp"
                    type="number"
                    min="0"
                    value={mvp}
                    onChange={(e) => setMvp(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="opoy">OPOY/DPOY</Label>
                  <Input
                    id="opoy"
                    type="number"
                    min="0"
                    value={opoy}
                    onChange={(e) => setOpoy(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sbmvp">SB MVP</Label>
                  <Input
                    id="sbmvp"
                    type="number"
                    min="0"
                    value={sbmvp}
                    onChange={(e) => setSbmvp(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roty">ROTY</Label>
                  <Input
                    id="roty"
                    type="number"
                    min="0"
                    value={roty}
                    onChange={(e) => setRoty(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="p-6 space-y-4 mt-0">
              <p className="text-sm text-muted-foreground">
                Enter the career totals for {position} statistics.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {positionStatsFields.map((stat) => (
                  <div key={stat} className="space-y-2">
                    <Label htmlFor={stat}>{statLabels[stat] || stat}</Label>
                    <Input
                      id={stat}
                      type="number"
                      min="0"
                      value={positionStats[stat] || 0}
                      onChange={(e) =>
                        setPositionStats({
                          ...positionStats,
                          [stat]: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="p-6 space-y-4 mt-0">
              <p className="text-sm text-muted-foreground">
                Set the player's performance metrics. These affect rankings and tier display.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trueTalent">True Talent</Label>
                  <Input
                    id="trueTalent"
                    type="number"
                    min="0"
                    step="0.1"
                    value={trueTalent}
                    onChange={(e) => setTrueTalent(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dominance">Dominance</Label>
                  <Input
                    id="dominance"
                    type="number"
                    min="0"
                    step="0.1"
                    value={dominance}
                    onChange={(e) => setDominance(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="careerLegacy">Career Legacy</Label>
                  <Input
                    id="careerLegacy"
                    type="number"
                    min="0"
                    step="0.1"
                    value={careerLegacy}
                    onChange={(e) => setCareerLegacy(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpg">TPG (Titles Per Game)</Label>
                  <Input
                    id="tpg"
                    type="number"
                    min="0"
                    step="0.001"
                    value={tpg}
                    onChange={(e) => setTpg(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="seasons" className="p-6 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Add season-by-season stats for this player.
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                            <Info className="w-3 h-3" />
                            <span>Each season represents that season's production only (not cumulative)</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Enter the stats earned during that specific season. For example, if a QB threw 4000 yards in Y1 and 4500 in Y2, enter 4000 for Y1 and 4500 for Y2.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSeason}
                  className="ml-4"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Season
                </Button>
              </div>

              {seasonEdits.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border/50 rounded-lg">
                  <p>No seasons added yet.</p>
                  <p className="text-xs mt-1">Click "Add Season" to start tracking season history.</p>
                </div>
              )}

              {seasonEdits.map((se, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border border-border/50 bg-secondary/20 space-y-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Select
                        value={se.season}
                        onValueChange={(v) => updateSeasonName(index, v)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allPossibleSeasons.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Badge variant="secondary" className="text-xs">
                        Season Stats
                      </Badge>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSeason(index)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                    {seasonStatsFields.map((stat) => (
                      <div key={stat} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{statLabels[stat] || stat}</Label>
                        <Input
                          type="number"
                          min="0"
                          className="h-9 text-sm"
                          value={se.stats[stat] ?? ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateSeasonStat(index, stat, parseInt(e.target.value) || 0)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex items-center justify-between p-6 border-t border-border/30 bg-secondary/20">
          {!isNewPlayer && player && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Player
            </Button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />
              {isNewPlayer ? 'Add Player' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerEditDialog;
