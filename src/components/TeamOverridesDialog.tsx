import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Player } from '@/types/player';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { mergeTeamOverrides, type TeamOverrides } from '@/utils/teamOverrides';

interface TeamOverridesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  players: Player[];
  onApplied?: (overrides: TeamOverrides) => void;
}

const PLACEHOLDER = ['Buccaneers', 'Chargers', 'Commanders', 'Bills', '...'].join('\n');

/** Accepts one team per line, comma-separated, or space-separated on a single line. */
const splitTeams = (input: string): string[] => {
  const raw = (input || '').trim();
  if (!raw) return [];
  const parts = raw.includes('\n') || raw.includes(',') ? raw.split(/\r?\n|,/) : raw.split(/\s+/);
  return parts.map((s) => s.trim()).filter(Boolean);
};

const TeamOverridesDialog = ({ open, onOpenChange, title, players, onApplied }: TeamOverridesDialogProps) => {
  const [teamsText, setTeamsText] = useState('');
  const textareaId = useId();
  const hintId = useId();

  const playersMissingTeam = useMemo(() => players.filter((p) => !p.team), [players]);
  const parsedCount = useMemo(() => splitTeams(teamsText).length, [teamsText]);

  const applyTeams = () => {
    const teams = splitTeams(teamsText);

    if (teams.length === 0) {
      toast.error('No teams provided', { description: 'Paste a list of team names to continue.' });
      return;
    }

    let targetPlayers: Player[] = players;
    if (teams.length === playersMissingTeam.length && playersMissingTeam.length > 0) {
      targetPlayers = playersMissingTeam;
    } else if (teams.length !== players.length) {
      toast.error('Team count mismatch', {
        description: `You provided ${teams.length} teams. Expected ${
          playersMissingTeam.length > 0 ? `${playersMissingTeam.length} (missing only) or ` : ''
        }${players.length} (all players).`,
      });
      return;
    }

    const next: TeamOverrides = {};
    targetPlayers.forEach((p, i) => {
      next[p.name] = teams[i];
    });

    const merged = mergeTeamOverrides(next);
    toast.success('Teams saved', { description: 'Team banners and badges update immediately.' });
    onApplied?.(merged);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto border-line p-4 sm:p-6">
        <DialogHeader className="text-left">
          <p className="font-pixel text-[10px] uppercase text-gold">Team overrides</p>
          <DialogTitle className="font-display text-2xl sm:text-3xl font-extrabold uppercase">{title}</DialogTitle>
          <DialogDescription>
            Your CSV export doesn't include a Team column for this position group. Paste teams in the same order as the
            table.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor={textareaId} className="text-sm text-muted-foreground">
            Teams (one per line, comma-separated, or space-separated)
          </Label>
          <Textarea
            id={textareaId}
            aria-describedby={hintId}
            value={teamsText}
            onChange={(e) => setTeamsText(e.target.value)}
            placeholder={PLACEHOLDER}
            className="min-h-[160px] font-mono bg-night/60"
          />
          <p id={hintId} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="lamp">
              Entered <b>{parsedCount}</b>
            </span>
            <span>
              Expected{' '}
              {playersMissingTeam.length > 0 ? `${playersMissingTeam.length} (missing only) or ` : ''}
              {players.length} (all rows)
            </span>
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={applyTeams}>Apply teams</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeamOverridesDialog;
