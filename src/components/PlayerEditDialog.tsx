import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, Plus, Save, X } from 'lucide-react';
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

const statLabels: Record<string, string> = {
  passYds: 'Pass Yards',
  passTD: 'Pass TDs',
  completions: 'Completions',
  attempts: 'Attempts',
  interceptions: 'INTs',
  sacks: 'Sacks',
  rushAtt: 'Rush Attempts',
  rushYds: 'Rush Yards',
  rushTD: 'Rush TDs',
  fumbles: 'Fumbles',
  receptions: 'Receptions',
  recYds: 'Rec Yards',
  recTD: 'Rec TDs',
  longest: 'Longest',
  blocks: 'Blocks',
  tackles: 'Tackles',
  forcedFumbles: 'Forced Fumbles',
};

const PlayerEditDialog = ({ player, isNewPlayer = false, onClose, onSave }: PlayerEditDialogProps) => {
  const { getAvailableSeasons, refreshData } = useLeague();
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
  const [manualSeasons, setManualSeasons] = useState<Array<{ season: string; stats: Record<string, number> }>>([]);

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
      setManualSeasons([]);
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
      manualSeasons: manualSeasons.length > 0 ? manualSeasons : undefined,
      createdAt: player ? now : now,
      updatedAt: now,
      isManuallyAdded: isNewPlayer,
    };

    try {
      await savePlayerEdit(edit);

      // If there are manual seasons, save them to season history
      if (manualSeasons.length > 0) {
        const history = loadSeasonHistory();
        history[playerKey] = manualSeasons.map((ms) => ({
          season: ms.season,
          games: ms.stats.games || 0,
          rings: ms.stats.rings || 0,
          mvp: ms.stats.mvp || 0,
          opoy: ms.stats.opoy || 0,
          sbmvp: ms.stats.sbmvp || 0,
          roty: ms.stats.roty || 0,
          ...ms.stats,
        }));
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
    const unusedSeasons = availableSeasons.filter(
      (s) => !manualSeasons.some((ms) => ms.season === s)
    );
    if (unusedSeasons.length === 0) {
      toast.error('No more seasons available');
      return;
    }
    setManualSeasons([
      ...manualSeasons,
      { season: unusedSeasons[0], stats: {} },
    ]);
  };

  const removeSeason = (index: number) => {
    setManualSeasons(manualSeasons.filter((_, i) => i !== index));
  };

  const updateSeasonStat = (index: number, stat: string, value: number) => {
    const updated = [...manualSeasons];
    updated[index].stats[stat] = value;
    setManualSeasons(updated);
  };

  const updateSeasonName = (index: number, season: string) => {
    const updated = [...manualSeasons];
    updated[index].season = season;
    setManualSeasons(updated);
  };

  const positionStatsFields = useMemo(() => getPositionStats(position), [position]);

  return (
    <Dialog open={!!player || isNewPlayer} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
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

          <ScrollArea className="h-[60vh]">
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
                    value={games}
                    onChange={(e) => setGames(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rings">Championships</Label>
                  <Input
                    id="rings"
                    type="number"
                    value={rings}
                    onChange={(e) => setRings(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mvp">MVP Awards</Label>
                  <Input
                    id="mvp"
                    type="number"
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
                    value={opoy}
                    onChange={(e) => setOpoy(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sbmvp">SB MVP</Label>
                  <Input
                    id="sbmvp"
                    type="number"
                    value={sbmvp}
                    onChange={(e) => setSbmvp(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roty">ROTY</Label>
                  <Input
                    id="roty"
                    type="number"
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
                    value={trueTalent}
                    onChange={(e) => setTrueTalent(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dominance">Dominance</Label>
                  <Input
                    id="dominance"
                    type="number"
                    value={dominance}
                    onChange={(e) => setDominance(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="careerLegacy">Career Legacy</Label>
                  <Input
                    id="careerLegacy"
                    type="number"
                    value={careerLegacy}
                    onChange={(e) => setCareerLegacy(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpg">TPG (Titles Per Game)</Label>
                  <Input
                    id="tpg"
                    type="number"
                    step="0.01"
                    value={tpg}
                    onChange={(e) => setTpg(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="seasons" className="p-6 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Optionally add season-by-season stats for this player.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only add seasons that have been uploaded to the system.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSeason}
                  disabled={availableSeasons.length === 0}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Season
                </Button>
              </div>

              {availableSeasons.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No seasons have been uploaded yet.</p>
                  <p className="text-xs mt-1">Upload season data first to add season history.</p>
                </div>
              )}

              {manualSeasons.map((ms, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border border-border/50 bg-secondary/20 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Select
                      value={ms.season}
                      onValueChange={(v) => updateSeasonName(index, v)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSeasons.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSeason(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Games</Label>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        value={ms.stats.games || 0}
                        onChange={(e) =>
                          updateSeasonStat(index, 'games', parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                    {positionStatsFields.slice(0, 3).map((stat) => (
                      <div key={stat} className="space-y-1">
                        <Label className="text-xs">{statLabels[stat] || stat}</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          value={ms.stats[stat] || 0}
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
