import { useState } from 'react';
import { Check, Link2, Pencil, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { filledCount, scoreLineup, type LabContext, type Lineup } from '@/utils/teamLab';
import type { SavedTeam } from './useTeamLab';
import { GradeChip } from './parts';

interface SavedTeamsPanelProps {
  ctx: LabContext;
  lineup: Lineup;
  teams: SavedTeam[];
  onSave: (name: string) => void;
  onLoad: (t: SavedTeam) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const SavedTeamsPanel = ({ ctx, lineup, teams, onSave, onLoad, onRename, onDelete }: SavedTeamsPanelProps) => {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const canSave = filledCount(lineup) > 0;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="lab-saved" className="glass-card min-w-0 p-3 sm:p-4">
      <h2 id="lab-saved" className="section-title mb-3 text-lg">
        Saved teams
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) return;
          onSave(name || `Team ${teams.length + 1}`);
          setName('');
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this build" aria-label="Team name" maxLength={40} className="h-9 min-w-0 border-line bg-night/60" />
        <Button type="submit" size="sm" disabled={!canSave} className="shrink-0 font-display font-bold uppercase">
          <Save className="mr-1 h-4 w-4" aria-hidden="true" /> Save team
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={copyLink} disabled={!canSave} className="shrink-0 border-line" aria-label="Copy a link to this build">
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
          <span className="sr-only sm:not-sr-only sm:ml-1">{copied ? 'Copied' : 'Link'}</span>
        </Button>
      </form>
      <p className="sr-only" aria-live="polite">
        {copied ? 'Link copied' : ''}
      </p>

      {teams.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Saved builds stay in this browser. Save a few to rank them and use them as head-to-head opponents.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {teams.map((t) => {
            const s = scoreLineup(ctx, t.lineup);
            return (
              <li key={t.id} className="flex min-w-0 items-center gap-2 rounded-md bg-panel-2/60 px-2 py-1.5 ring-1 ring-line/60">
                <GradeChip grade={s?.team.grade ?? null} size="sm" label={s ? `Team grade ${s.team.grade.grade}` : 'Incomplete lineup'} />
                {editing === t.id ? (
                  <form
                    className="flex min-w-0 flex-1 gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onRename(t.id, draft);
                      setEditing(null);
                    }}
                  >
                    <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`New name for ${t.name}`} maxLength={40} className="h-7 min-w-0 border-line bg-night/60 text-sm" />
                    <Button type="submit" size="sm" variant="ghost" className="h-7 px-2" aria-label="Save name">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </form>
                ) : (
                  <span className="min-w-0 flex-1 truncate font-display text-[15px] font-bold uppercase tracking-wide text-chalk">
                    {t.name}
                    {!s && <span className="ml-1 text-xs normal-case text-muted-foreground">({filledCount(t.lineup)}/10)</span>}
                  </span>
                )}
                {editing !== t.id && (
                  <span className="flex shrink-0 items-center">
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => onLoad(t)} aria-label={`Load ${t.name}`}>
                      <Upload className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => {
                        setEditing(t.id);
                        setDraft(t.name);
                      }}
                      aria-label={`Rename ${t.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => onDelete(t.id)} aria-label={`Delete ${t.name}`}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default SavedTeamsPanel;
