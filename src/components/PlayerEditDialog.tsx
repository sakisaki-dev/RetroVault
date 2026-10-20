import { useState, useEffect, useMemo } from 'react';
import { Loader2, Pencil, Save, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Player, Position } from '@/types/player';
import { useLeague } from '@/context/LeagueContext';
import { toast } from 'sonner';
import {
  getPlayerEdits,
  savePlayerEdit,
  deletePlayerEdit,
  type PlayerEdit,
} from '@/utils/indexedDB';
import { calcCareerLegacy, calcDominance, calcTPG, getRawTrueTalent, isDefensivePosition } from '@/config/stats';
import SkinTonePicker from '@/components/collection/art/SkinTonePicker';

interface PlayerEditDialogProps {
  player: Player | null;
  isNewPlayer?: boolean;
  onClose: () => void;
  onSave: () => void;
  /** Called after the player's saved edit is deleted (defaults to onSave) */
  onDelete?: () => void;
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

const PlayerEditDialog = ({ player, isNewPlayer = false, onClose, onSave, onDelete }: PlayerEditDialogProps) => {
  const { refreshData } = useLeague();

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
  const [positionStats, setPositionStats] = useState<Record<string, number>>({});
  /** Sprite skin tone key, '' = auto */
  const [spriteSkin, setSpriteSkin] = useState('');
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setTrueTalent(getRawTrueTalent(player));
      setSpriteSkin(player.spriteSkin ?? '');

      // Extract position stats
      const stats: Record<string, number> = {};
      getPositionStats(player.position).forEach((stat) => {
        stats[stat] = Number((player as unknown as Record<string, unknown>)[stat]) || 0;
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
      setPositionStats({});
      setSpriteSkin('');
    }
  }, [player, isNewPlayer]);

  // Update position stats when position changes
  useEffect(() => {
    setPositionStats((prev) => {
      const newStats: Record<string, number> = {};
      getPositionStats(position).forEach((stat) => {
        newStats[stat] = prev[stat] || 0;
      });
      return newStats;
    });
  }, [position]);

  // Preview of what the league will compute (normalization recomputes these on load anyway)
  const positionFactor = player?.position === position ? player.positionFactor ?? 1 : 1;
  const derived = useMemo(() => {
    const adjusted = trueTalent * positionFactor;
    const inputs = { games, rings, mvp, opoy, sbmvp, trueTalent: adjusted, dominance: 0, careerLegacy: 0, tpg: 0 };
    const dom = calcDominance(inputs, isDefensivePosition(position));
    return { trueTalent: adjusted, dominance: dom, careerLegacy: calcCareerLegacy(inputs, dom), tpg: calcTPG(inputs) };
  }, [trueTalent, positionFactor, games, rings, mvp, opoy, sbmvp, position]);

  const handleSave = async () => {
    if (busy) return;
    if (!name.trim()) {
      toast.error('Player name is required');
      return;
    }
    setBusy('saving');

    const playerKey = `${position}:${name.trim()}`;
    const now = Date.now();
    // Keep manually added players visible on later edits (they have no CSV row to merge into)
    const existingEdit = (await getPlayerEdits())[playerKey];

    const edit: PlayerEdit = {
      playerKey,
      position,
      name: name.trim(),
      team: team.trim() || undefined,
      nickname: nickname.trim() || undefined,
      status,
      trueTalent,
      dominance: derived.dominance,
      careerLegacy: derived.careerLegacy,
      tpg: derived.tpg,
      games,
      rings,
      mvp,
      opoy,
      sbmvp,
      roty,
      positionStats,
      ...(spriteSkin ? { spriteSkin } : {}),
      createdAt: existingEdit?.createdAt ?? now,
      updatedAt: now,
      isManuallyAdded: isNewPlayer || !!existingEdit?.isManuallyAdded,
    };

    try {
      await savePlayerEdit(edit);
      toast.success(isNewPlayer ? 'Player added successfully' : 'Player updated successfully');
      refreshData();
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save player:', error);
      toast.error('Failed to save player');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!player || busy) return;
    setBusy('deleting');

    const playerKey = `${player.position}:${player.name}`;

    try {
      await deletePlayerEdit(playerKey);

      toast.success('Player edits deleted');
      setConfirmDelete(false);
      refreshData();
      (onDelete ?? onSave)();
      onClose();
    } catch (error) {
      console.error('Failed to delete player:', error);
      toast.error('Failed to delete player');
    } finally {
      setBusy(null);
    }
  };

  const positionStatsFields = useMemo(() => getPositionStats(position), [position]);


  return (
    <Dialog open={!!player || isNewPlayer} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden border-line bg-card p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        aria-busy={!!busy}
      >
        <DialogHeader className="border-b border-line p-4 pr-12 text-left sm:p-6 sm:pr-12">
          <p className="font-pixel text-[10px] uppercase text-gold">{isNewPlayer ? 'New player' : 'Player editor'}</p>
          <DialogTitle className="font-display text-2xl sm:text-3xl font-extrabold uppercase flex items-center gap-2">
            <Pencil className="w-5 h-5 text-gold shrink-0" aria-hidden="true" />
            {isNewPlayer ? 'Add New Player' : `Edit ${player?.name}`}
          </DialogTitle>
          <DialogDescription>
            {isNewPlayer
              ? 'Add a new player with career statistics.'
              : 'Update player details and career statistics.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="flex min-h-0 w-full flex-1 flex-col">
          <TabsList className="h-12 w-full shrink-0 justify-start overflow-x-auto rounded-none border-b border-line bg-panel-2/60 px-2 sm:px-6 scrollbar-none">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="stats">Career Stats</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[55vh] sm:h-[52vh]">
            <TabsContent value="basic" className="p-4 sm:p-6 space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Select
                    value={position}
                    onValueChange={(v) => setPosition(v as Position)}
                    disabled={!isNewPlayer && !!player}
                  >
                    <SelectTrigger id="position">
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
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

              <SkinTonePicker name={name.trim()} value={spriteSkin} onChange={setSpriteSkin} />

              <section
                aria-labelledby="internal-heading"
                className="rounded-md border border-dashed border-border p-3 space-y-2"
              >
                <h3 id="internal-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Internal
                </h3>
                <div className="flex items-center gap-2">
                  <Switch
                    id="status"
                    checked={status === 'Active'}
                    onCheckedChange={(checked) => setStatus(checked ? 'Active' : 'Retired')}
                    aria-describedby="status-help"
                  />
                  <Label htmlFor="status" className="text-sm cursor-pointer">
                    Still playing
                  </Label>
                </div>
                <p id="status-help" className="text-xs text-muted-foreground">
                  Not shown on the site; used for pace tracking only.
                </p>
              </section>
            </TabsContent>

            <TabsContent value="stats" className="p-4 sm:p-6 space-y-4 mt-0">
              <p className="text-sm text-muted-foreground">
                Enter the career totals for {position} statistics.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <TabsContent value="metrics" className="p-4 sm:p-6 space-y-4 mt-0">
              <p className="text-sm text-muted-foreground">
                Enter the sheet's True Talent. Dominance, Career Legacy and TPG are calculated from it plus games and
                awards, after the league's position adjustment
                {positionFactor !== 1 && ` (×${positionFactor.toFixed(3)} for ${position})`}.
              </p>
              <div className="space-y-2 sm:max-w-xs">
                <Label htmlFor="trueTalent">True Talent (sheet value)</Label>
                <Input
                  id="trueTalent"
                  type="number"
                  min="0"
                  step="0.1"
                  value={trueTalent}
                  onChange={(e) => setTrueTalent(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Adjusted Talent', value: derived.trueTalent.toFixed(1) },
                  { label: 'Dominance', value: derived.dominance.toFixed(1) },
                  { label: 'Career Legacy', value: derived.careerLegacy.toFixed(0) },
                  { label: 'TPG (Talent Per Game)', value: derived.tpg.toFixed(2) },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-line bg-night/60 px-3 py-2">
                    <p className="font-pixel text-[9px] uppercase text-muted-foreground">{m.label}</p>
                    <p className="font-display text-2xl font-bold tabular-nums text-gold">{m.value}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

          </ScrollArea>
        </Tabs>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-panel-2/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          {!isNewPlayer && player ? (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
              <Trash2 className="w-4 h-4 mr-1" aria-hidden="true" />
              Delete edits
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={onClose} disabled={!!busy}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!!busy}>
              {busy === 'saving' ? (
                <Loader2 className="w-4 h-4 mr-1 motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-4 h-4 mr-1" aria-hidden="true" />
              )}
              {busy === 'saving' ? 'Saving...' : isNewPlayer ? 'Add Player' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !busy && setConfirmDelete(open)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] border-line bg-card">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="font-display text-2xl font-extrabold uppercase">
              Delete edits for {player?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes your saved edits for this player. Players from your CSV go back to their sheet values; players you
              added by hand are removed from the league. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Keep player</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={!!busy}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {busy === 'deleting' && <Loader2 className="w-4 h-4 mr-1 motion-safe:animate-spin" aria-hidden="true" />}
              {busy === 'deleting' ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default PlayerEditDialog;
