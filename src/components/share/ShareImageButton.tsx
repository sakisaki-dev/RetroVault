import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Share } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { canShareFiles, capturePoster, shareImageBlob } from '@/utils/shareImage';
import './share.css';

/**
 * A Share button that turns a poster into a picture and opens the share sheet (src/utils/shareImage.ts).
 *
 * iOS only opens the share sheet inside the tap (user activation), and drawing a picture takes longer than a tap
 * lasts, so the picture is made ahead: `eager` (default) draws it once the button has been on screen and the poster
 * key unchanged for a moment, in an idle slot. A tap with the picture ready shares it at once. A tap before it is
 * ready draws it and tries; if the phone refuses (the tap's activation ran out) the button turns gold, "Tap to share",
 * and the next tap shares the ready picture. Where files can't be shared (most desktops) it downloads the PNG.
 *
 * The poster is mounted only while a picture is being made, in an invisible stage (opacity 0, no pointer events,
 * inert) rather than off screen, so on-screen observers (lazy sprites, idle loops) behave as on the page.
 */
export interface ShareImageButtonProps {
  /** The picture's content (mounted only while it is drawn): usually a <SharePosterFrame> */
  poster: () => ReactNode;
  /** Changes whenever the picture would change; a picture made for another key is thrown away */
  shareKey: string;
  fileName: string;
  /** The share sheet's title */
  title: string;
  /** Output width in pixels (default 1080) */
  width?: number;
  /** Make the picture ahead of the tap after this many ms on screen (false: only on a tap) */
  eager?: boolean | number;
  /** 'chip' (default) on the page's panels; 'overlay' on art and photos (dark glass); 'icon' an icon button */
  look?: 'chip' | 'overlay' | 'icon';
  label?: string;
  className?: string;
  /** Called with true while the share sheet is opening or open, false after (a story pauses meanwhile) */
  onActive?: (active: boolean) => void;
}

type Status = 'idle' | 'busy' | 'retry';

const idle = (fn: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 60);
  return () => window.clearTimeout(id);
};

const ShareImageButton = ({
  poster,
  shareKey,
  fileName,
  title,
  width = 1080,
  eager = true,
  look = 'chip',
  label = 'Share',
  className,
  onActive,
}: ShareImageButtonProps) => {
  const [status, setStatus] = useState<Status>('idle');
  const [staging, setStaging] = useState<string | null>(null);
  const ready = useRef<{ key: string; blob: Blob } | null>(null);
  const inflight = useRef<{ key: string; promise: Promise<Blob> } | null>(null);
  const stageWaiter = useRef<((el: HTMLElement) => void) | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const keyRef = useRef(shareKey);
  keyRef.current = shareKey;
  const posterRef = useRef(poster);
  posterRef.current = poster;
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // a new key: the old picture no longer matches, and a "Tap to share" from it is over
  useEffect(() => {
    if (ready.current && ready.current.key !== shareKey) ready.current = null;
    setStatus((s) => (s === 'retry' ? 'idle' : s));
  }, [shareKey]);

  const prepare = useCallback((): Promise<Blob> => {
    const key = keyRef.current;
    if (ready.current?.key === key) return Promise.resolve(ready.current.blob);
    if (inflight.current?.key === key) return inflight.current.promise;
    const promise = (async () => {
      // wait for the previous picture's stage to clear, then mount this one
      const el = await new Promise<HTMLElement>((resolve) => {
        stageWaiter.current = resolve;
        setStaging(key);
      });
      try {
        const node = (el.firstElementChild as HTMLElement | null) ?? el;
        const blob = await capturePoster(node, { width });
        if (keyRef.current === key) ready.current = { key, blob };
        return blob;
      } finally {
        stageWaiter.current = null;
        if (mounted.current) setStaging(null);
        if (inflight.current?.key === key) inflight.current = null;
      }
    })();
    inflight.current = { key, promise };
    return promise;
  }, [width]);

  // Make the picture ahead of the tap: on screen, key unchanged for `delay` ms, then in an idle slot
  useEffect(() => {
    if (eager === false || ready.current?.key === shareKey) return;
    const el = btnRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const delay = typeof eager === 'number' ? eager : 1200;
    let timer = 0;
    let cancelIdle: (() => void) | null = null;
    const io = new IntersectionObserver(([e]) => {
      window.clearTimeout(timer);
      cancelIdle?.();
      if (!e?.isIntersecting) return;
      timer = window.setTimeout(() => {
        cancelIdle = idle(() => {
          prepare().catch(() => undefined);
        });
      }, delay);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      cancelIdle?.();
    };
  }, [shareKey, eager, prepare]);

  const share = (blob: Blob) => {
    onActive?.(true);
    return shareImageBlob(blob, fileName, title)
      .then((r) => {
        if (!mounted.current) return;
        setStatus('idle');
        if (r === 'downloaded') toast.success('Picture saved', { description: fileName });
      })
      .catch((e: unknown) => {
        if (!mounted.current) return;
        if (e instanceof DOMException && e.name === 'NotAllowedError') setStatus('retry');
        else {
          setStatus('idle');
          toast.error('Could not share the picture', { description: e instanceof Error ? e.message : undefined });
        }
      })
      .finally(() => onActive?.(false));
  };

  const onClick = () => {
    const r = ready.current;
    if (r && r.key === shareKey) {
      // the picture is ready: share inside this tap
      void share(r.blob);
      return;
    }
    setStatus('busy');
    onActive?.(true);
    prepare()
      .then((blob) => share(blob))
      .catch((e: unknown) => {
        if (!mounted.current) return;
        setStatus('idle');
        toast.error('Could not make the picture', { description: e instanceof Error ? e.message : undefined });
      })
      .finally(() => onActive?.(false));
  };

  const busy = status === 'busy';
  const text = status === 'retry' ? 'Tap to share' : busy ? 'Preparing' : label;
  const verb = canShareFiles() ? 'Share' : 'Save';
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-busy={busy || undefined}
        className={cn('shr-btn', `shr-btn--${look}`, status === 'retry' && 'shr-btn--retry', className)}
        title={`${verb} a picture: ${title}`}
        aria-label={look === 'icon' ? `${verb} a picture of ${title}` : undefined}
      >
        {busy ? <Loader2 className="shr-btn__icon animate-spin" aria-hidden="true" /> : <Share className="shr-btn__icon" aria-hidden="true" />}
        {look !== 'icon' && <span>{text}</span>}
      </button>
      {staging !== null &&
        createPortal(
          <div
            className="shr-stage"
            aria-hidden="true"
            {...{ inert: '' }}
            ref={(el) => {
              if (el) stageWaiter.current?.(el);
            }}
          >
            {posterRef.current()}
          </div>,
          document.body,
        )}
    </>
  );
};

export default ShareImageButton;
