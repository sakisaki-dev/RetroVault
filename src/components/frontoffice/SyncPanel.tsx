import { useState } from 'react';
import { ArrowRightLeft, Check, Copy, Share2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { decodeProgress, exportProgress, importProgress, isLocalhost, transferLink } from '@/utils/deviceSync';

/**
 * "Use on another device": your collection, arcade scores, saved Team Lab builds and Hall of Fame "seen" state live
 * in this browser. Copy a transfer code here and paste it on the other device (or share a link that carries it).
 */
const SyncPanel = () => {
  const [code, setCode] = useState('');
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const make = async () => {
    const r = await exportProgress();
    setCode(r.code);
    setCount(r.count);
    setCopied(false);
    return r.code;
  };

  const copy = async () => {
    const c = code || (await make());
    try {
      await navigator.clipboard.writeText(c);
      setCopied(true);
    } catch {
      setStatus({ ok: false, text: 'Copy failed: select the code and copy it by hand.' });
    }
  };

  const share = async () => {
    const c = code || (await make());
    try {
      await navigator.share(isLocalhost() ? { title: 'Retro Vault transfer code', text: c } : { title: 'Retro Vault progress', url: transferLink(c) });
    } catch {
      /* cancelled */
    }
  };

  const doImport = async () => {
    try {
      const data = await decodeProgress(paste);
      const n = Object.keys(data).length;
      if (!window.confirm(`Replace this device's progress with ${n} saved item${n === 1 ? '' : 's'} from the other device?`)) return;
      importProgress(data);
      setStatus({ ok: true, text: 'Imported. Reloading…' });
      window.setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'That code could not be read.' });
    }
  };

  return (
    <section aria-labelledby="sync-title" className="glass-card space-y-4 p-4 sm:p-5">
      <div>
        <h2 id="sync-title" className="section-title text-xl">
          <ArrowRightLeft className="h-5 w-5 text-gold" aria-hidden="true" />
          Use on another device
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          League data, speeches and Hall of Fame classes are the same everywhere. Your Collection, arcade scores and streaks, and saved Team Lab
          builds live in this browser: move them with a transfer code.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide">1. On this device</h3>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copy} className="gap-1.5 bg-gold text-black hover:bg-gold/90">
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy transfer code'}
            </Button>
            {canShare && (
              <Button type="button" variant="outline" onClick={share} className="gap-1.5 border-line">
                <Share2 className="h-4 w-4" aria-hidden="true" /> Share
              </Button>
            )}
          </div>
          {code && (
            <>
              <label htmlFor="sync-code" className="block text-xs text-muted-foreground">
                Transfer code ({count} saved item{count === 1 ? '' : 's'}, {Math.round(code.length / 1024)} KB)
              </label>
              <textarea
                id="sync-code"
                readOnly
                value={code}
                onFocus={(e) => e.currentTarget.select()}
                className="h-20 w-full resize-none rounded-md border border-line bg-night/60 p-2 font-mono text-[10px] text-muted-foreground"
              />
            </>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide">2. On the other device</h3>
          <label htmlFor="sync-paste" className="block text-xs text-muted-foreground">
            Paste the code (or the whole link) here. It replaces that device's progress.
          </label>
          <textarea
            id="sync-paste"
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              setStatus(null);
            }}
            placeholder="z.…"
            className="h-20 w-full resize-none rounded-md border border-line bg-night/60 p-2 font-mono text-[10px]"
          />
          <Button type="button" variant="outline" onClick={doImport} disabled={!paste.trim()} className="gap-1.5 border-line">
            <Upload className="h-4 w-4" aria-hidden="true" /> Import progress
          </Button>
        </div>
      </div>
      {status && (
        <p role="status" className={status.ok ? 'text-sm text-emerald-400' : 'text-sm text-red-400'}>
          {status.text}
        </p>
      )}
    </section>
  );
};

export default SyncPanel;
