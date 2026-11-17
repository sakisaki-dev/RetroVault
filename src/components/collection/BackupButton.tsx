import { useRef, useState } from 'react';
import { Archive, Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  collectionBackupText,
  readBackup,
  readCollection,
  restoreCollection,
  summarizeCollection,
  type BackupSummary,
  type CollectionState,
} from '@/utils/collection';

const fmt = (n: number) => n.toLocaleString('en-US');
const line = (s: BackupSummary) =>
  `${fmt(s.cards)} players · ${fmt(s.autos)} autographs · ${fmt(s.coins)} coins · ${fmt(s.shards)} shards`;

/** Saves the binder as a file (share sheet on a phone, a download elsewhere) and restores one. */
const BackupButton = ({ className }: { className?: string }) => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ state: CollectionState; summary: BackupSummary } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setMsg(null);
    const text = collectionBackupText();
    const day = new Date().toISOString().slice(0, 10);
    const name = `retro-vault-cards-${day}.json`;
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Retro Vault cards' });
        setMsg('Backup saved.');
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg('Backup downloaded.');
    } catch {
      setMsg("Couldn't save the file on this device.");
    }
  };

  const pick = async (f: File | undefined) => {
    setMsg(null);
    setPending(null);
    if (!f) return;
    const got = readBackup(await f.text());
    if (!got) setMsg("That file isn't a Retro Vault card backup.");
    else setPending(got);
  };

  const restore = () => {
    if (!pending) return;
    restoreCollection(pending.state);
    setPending(null);
    setMsg('Restored. Your binder is back.');
  };

  const now = summarizeCollection(readCollection());

  return (
    <>
      <button type="button" className={cn('a2hs-tag', className)} onClick={() => setOpen(true)} title="Save or restore your cards">
        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
        Backup
      </button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPending(null); setMsg(null); } }}>
        <DialogContent className="max-w-md">
          <DialogTitle className="font-display uppercase tracking-tight">Back up your cards</DialogTitle>
          <DialogDescription>
            Your cards live on this device only. Deleting the Home Screen app deletes them with it, so save a backup
            first (to Files or iCloud Drive) and restore it in the new app.
          </DialogDescription>
          <p className="text-xs text-muted-foreground">Now: {line(now)}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Save a backup
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Restore from file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          {pending && (
            <div className="rounded-md border border-gold/50 bg-night/60 p-3 text-sm">
              <p className="font-semibold">
                Replace this binder with the backup{pending.summary.savedAt ? ` from ${pending.summary.savedAt.slice(0, 10)}` : ''}?
              </p>
              <p className="mt-1 text-muted-foreground">Backup: {line(pending.summary)}</p>
              <p className="text-muted-foreground">This device now: {line(now)}</p>
              <div className="mt-3 flex gap-2">
                <Button onClick={restore}>Replace with backup</Button>
                <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
              </div>
            </div>
          )}
          {msg && <p className="text-sm text-gold" role="status">{msg}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BackupButton;
