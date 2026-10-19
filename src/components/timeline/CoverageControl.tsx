import { useRef, useState } from 'react';
import { FileJson, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ContentSource } from '@/utils/leagueContent';

interface CoverageControlProps {
  source: ContentSource;
  season?: string;
  storyCount: number;
  upload: (file: File) => Promise<unknown>;
  reset: () => void;
}

/**
 * "Update league history": upload a new (AI-written) content.json that replaces the
 * eras, Super Bowls, rivalries and lineages on the Timeline. Stored in this browser only.
 */
const CoverageControl = ({ source, season, storyCount, upload, reset }: CoverageControlProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await upload(file);
      toast.success('League history updated', { description: `${file.name} now drives the Timeline.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
          {source === 'uploaded' ? 'Custom league history' : source === 'bundled' ? `Bundled ${season ?? ''} history` : 'No league history loaded'}
          {storyCount ? ` · ${storyCount} eras` : ''}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="secondary" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Update league history
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] space-y-3 text-sm">
            <p className="font-semibold">Upload new league history</p>
            <p className="text-muted-foreground">
              Upload a <code className="text-xs">content.json</code> (for example one written by an AI from your latest save). It{' '}
              <strong className="text-foreground">replaces</strong> the eras, Super Bowl results, rivalries and lineages on this page. Your
              roster and stats are not affected.
            </p>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <FileJson className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
              Expected keys: <code>storylines</code> (headline, body, tier, category, players), <code>eras</code>, <code>superBowls</code>,{' '}
              <code>rivalries</code>, <code>lineages</code>, <code>snubs</code>. Missing sections are simply left empty.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {busy ? 'Reading…' : 'Choose file'}
              </Button>
              {source === 'uploaded' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    reset();
                    setError(null);
                    toast('League history reset', { description: 'Back to the bundled league history.' });
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Reset to bundled
                </Button>
              )}
            </div>
            {error && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                {error}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/80">Saved in this browser only.</p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default CoverageControl;
