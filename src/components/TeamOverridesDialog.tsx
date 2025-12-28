import { useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { mergeTeamOverrides, TeamOverrides } from '@/utils/teamOverrides';

interface TeamOverridesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  players: Player[];
  onApplied?: (overrides: TeamOverrides) => void;
}

const splitTeams = (input: string): string[] => {
  const raw = (input || '').trim();
  if (!raw) return [];

  // Accept either: one per line OR space-separated (single line) OR comma-separated
  if (raw.includes('\n') || raw.includes(',')) {
    return raw
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return raw.split(/\s+/).map((s) => s.trim()).filter(Boolean);
};

const TeamOverridesDialog = ({ open, onOpenChange, title, players, onApplied }: TeamOverridesDialogProps) => {
  const [teamsText, setTeamsText] = useState('');

  const playersMissingTeam = useMemo(() => players.filter((p) => !p.team), [players]);

  const applyTeams = () => {
    const teams = splitTeams(teamsText);

    if (teams.length === 0) {
      toast({ title: 'No teams provided', description: 'Paste a list of team names to continue.' });
      return;
    }

    let targetPlayers: Player[] = players;
    if (teams.length === playersMissingTeam.length && playersMissingTeam.length > 0) {
      targetPlayers = playersMissingTeam;
    } else if (teams.length !== players.length) {
      toast({
        title: 'Team count mismatch',
        description: `You provided ${teams.length} teams. Expected ${playersMissingTeam.length} (missing only) or ${players.length} (all players).`,
      });
      return;
    }

    const next: TeamOverrides = {};
    targetPlayers.forEach((p, i) => {
      next[p.name] = teams[i];
    });

    const merged = mergeTeamOverrides(next);
    toast({ title: 'Teams saved', description: 'Team banners and badges will update immediately.' });
    onApplied?.(merged);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your CSV export doesn’t include a Team column for this position group. Paste teams in the same order as the table.
          </p>

          <div className="grid gap-2">
            <Label className="text-sm text-muted-foreground">
              Teams (one per line, or space-separated)
            </Label>
            <Textarea
              value={teamsText}
              onChange={(e) => setTeamsText(e.target.value)}
              placeholder="Buccaneers\nChargers\nCommanders\nBills\n..."
              className="min-h-[140px] font-mono"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Expected: {playersMissingTeam.length > 0 ? `${playersMissingTeam.length} teams (missing only) or ` : ''}{players.length} teams (all rows)
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={applyTeams}>Apply Teams</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeamOverridesDialog;
