import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, GripVertical, Database } from 'lucide-react';
import { loadSeasonHistory, saveSeasonHistory, type PlayerSeasonHistory } from '@/utils/seasonHistory';
import { toast } from 'sonner';

interface SeasonManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataCleared: () => void;
}

const SeasonManagementDialog = ({ open, onOpenChange, onDataCleared }: SeasonManagementDialogProps) => {
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteSeason, setConfirmDeleteSeason] = useState<string | null>(null);

  // Get unique seasons from history
  const getSeasons = (): string[] => {
    const history = loadSeasonHistory();
    const seasons = new Set<string>();
    Object.values(history).forEach((snapshots) => {
      snapshots.forEach((s) => seasons.add(s.season));
    });
    return Array.from(seasons).sort((a, b) => {
      const aNum = parseInt(a.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    });
  };

  const seasons = getSeasons();

  const handleDeleteSeason = (seasonName: string) => {
    const history = loadSeasonHistory();
    const updated: PlayerSeasonHistory = {};
    
    Object.entries(history).forEach(([playerKey, snapshots]) => {
      const filtered = snapshots.filter((s) => s.season !== seasonName);
      if (filtered.length > 0) {
        updated[playerKey] = filtered;
      }
    });
    
    saveSeasonHistory(updated);
    setConfirmDeleteSeason(null);
    toast.success(`Season "${seasonName}" deleted`);
  };

  const handleClearAllData = () => {
    // Clear all localStorage data
    localStorage.removeItem('retroVault:careerCsv');
    localStorage.removeItem('retroVault:prevCareerCsv');
    localStorage.removeItem('retroVault:currentSeason');
    localStorage.removeItem('retroVault:seasonHistory');
    localStorage.removeItem('retroVault:teamOverrides');
    
    setConfirmDeleteAll(false);
    onOpenChange(false);
    onDataCleared();
    toast.success('All data cleared successfully');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Data Management
            </DialogTitle>
            <DialogDescription>
              Manage your uploaded season data. Be careful - deletions cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Season List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Recorded Seasons</h4>
              {seasons.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {seasons.map((season) => (
                    <div
                      key={season}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/30"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                        <span className="font-medium">{season}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeleteSeason(season)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No season data recorded yet
                </p>
              )}
            </div>

            {/* Danger Zone */}
            <div className="border-t border-destructive/30 pt-4 mt-4">
              <div className="flex items-center gap-2 text-destructive mb-3">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">Danger Zone</span>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setConfirmDeleteAll(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Data
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                This will delete all career data, season history, and team overrides.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Season */}
      <AlertDialog open={!!confirmDeleteSeason} onOpenChange={() => setConfirmDeleteSeason(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Season "{confirmDeleteSeason}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>This action cannot be undone.</strong>
              </p>
              <p>
                All player statistics recorded for {confirmDeleteSeason} will be permanently deleted.
                This affects records and season history for all players.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteSeason && handleDeleteSeason(confirmDeleteSeason)}
            >
              Yes, Delete Season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Clear All Data */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent className="border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Clear ALL Data?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-foreground">
                ⚠️ WARNING: This is irreversible!
              </p>
              <p>
                You are about to permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All career statistics</li>
                <li>All season history ({seasons.length} seasons)</li>
                <li>All team override assignments</li>
                <li>Current season progress</li>
              </ul>
              <p className="text-destructive font-medium">
                There is no way to recover this data after deletion.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClearAllData}
            >
              Yes, Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SeasonManagementDialog;
