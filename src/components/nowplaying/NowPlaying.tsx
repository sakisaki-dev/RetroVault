import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { Music, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { hideNowPlaying, trackTimes, useNowPlaying, useNowPlayingShown, type NowPlaying } from '@/utils/spotify';
import './nowplaying.css';

/*
 * Now listening (owner, 2026-11-18: "I like the phone strip and the pill"): what is playing on the owner's Spotify, on
 * the stadium PA. The header pill from 640px (a click opens the card), the strip above the tab bar on a phone. Both
 * show only while Spotify is connected (the Season lamp's menu) and a song is on, read the page's one poller
 * (useNowPlaying) and hide for the current song with their close button.
 */

/** The track running along: from where Spotify last said it was to the end, over the time left (paused: held) */
export const TrackBar = ({ np, className }: { np: NowPlaying; className?: string }) => {
  const from = np.duration ? Math.min(1, np.progress / np.duration) : 0;
  return (
    <span className={`np-bar ${np.playing ? '' : 'np-bar--paused'} ${className ?? ''}`} aria-hidden="true">
      <span key={`${np.title}-${np.at}`} style={{ '--np-from': from, '--np-rest': `${Math.max(0, np.duration - np.progress)}ms` } as CSSProperties} />
    </span>
  );
};

const Cover = ({ np, className }: { np: NowPlaying; className: string }) =>
  np.art ? (
    <img className={className} src={np.art} alt="" />
  ) : (
    <span className={`${className} np-cover--none`} aria-hidden="true">
      <Music />
    </span>
  );

const Eq = () => (
  <span className="np-eq" aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

/** The elapsed time, ticking each second while the card is open */
const Times = ({ np }: { np: NowPlaying }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!np.playing) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [np.playing]);
  const t = trackTimes(np);
  return (
    <span className="np-card__times">
      <span>{t.at}</span>
      <TrackBar np={np} className="np-card__bar" />
      <span>{t.of}</span>
    </span>
  );
};

type PillMode = 'full' | 'cover' | 'hidden';

/** The desktop tab row, if it is on screen (the tablet copy sits on its own row) */
const desktopTabRow = () => {
  const rows = document.querySelectorAll<HTMLElement>('[data-site-header] nav[aria-label="Primary"] ul');
  for (const r of rows) if (r.clientWidth > 0) return r;
  return null;
};

/**
 * The pill gives way to the tabs (owner: "resize the spotify so this isn't possible"): it measures the tab row and
 * steps down full -> cover only -> hidden until the tabs no longer scroll. Re-measured when the header's width, the
 * song or the fonts change; never a fixed breakpoint.
 */
const usePillMode = (active: boolean, key: string): PillMode => {
  const [mode, setMode] = useState<PillMode>('full');
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!active) return;
    const header = document.querySelector('[data-site-header]');
    const redo = () => {
      setMode('full');
      setEpoch((n) => n + 1);
    };
    const ro = typeof ResizeObserver !== 'undefined' && header ? new ResizeObserver(redo) : null;
    if (header) ro?.observe(header);
    // the tab row itself shrinking (the season lamp arriving, a wider tab) can only take the pill down a step
    const squeeze = () => {
      const row = desktopTabRow();
      if (row && row.scrollWidth > row.clientWidth + 1) setMode((m) => (m === 'full' ? 'cover' : 'hidden'));
    };
    const rows = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(squeeze) : null;
    document.querySelectorAll('[data-site-header] nav[aria-label="Primary"] ul').forEach((u) => rows?.observe(u));
    void document.fonts?.ready.then(redo);
    document.fonts?.addEventListener?.('loadingdone', redo);
    return () => {
      ro?.disconnect();
      rows?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', redo);
    };
  }, [active]);
  useEffect(() => {
    if (active) {
      setMode('full');
      setEpoch((n) => n + 1);
    }
  }, [active, key]);
  useLayoutEffect(() => {
    if (!active || mode === 'hidden') return;
    const row = desktopTabRow();
    if (row && row.scrollWidth > row.clientWidth + 1) setMode(mode === 'full' ? 'cover' : 'hidden');
  }, [active, mode, epoch]);
  return mode;
};

/** Header: a pill beside the Season lamp (a spinning record, the equalizer, the song); a click opens the card */
export const NowPlayingPill = () => {
  const np = useNowPlaying();
  const shown = useNowPlayingShown(np);
  const on = !!np && shown;
  const mode = usePillMode(on, np ? `${np.title}|${np.artist}|${np.art}` : '');
  if (!np || !shown || mode === 'hidden') return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`np-pill ${np.playing ? '' : 'np-pill--paused'} ${mode === 'cover' ? 'np-pill--cover' : ''} hidden sm:inline-flex`}
          aria-label={`${np.playing ? 'Now playing' : 'Paused'}: ${np.title} by ${np.artist}`}
        >
          <Cover np={np} className="np-pill__disc" />
          <Eq />
          {mode === 'full' && (
            <span className="np-pill__txt">
              <span className="np-pill__title">{np.title}</span>
              <span className="np-pill__artist">{np.artist}</span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="np-card w-80 border-line bg-panel p-0">
        <div className="np-card__art">
          <Cover np={np} className="np-card__img" />
          <span className="np-card__tag">{np.playing ? 'On the PA' : 'Paused'}</span>
        </div>
        <div className="np-card__body">
          <p className="np-card__title">{np.title}</p>
          <p className="np-card__by">{[np.artist, np.album].filter(Boolean).join(' · ')}</p>
          <Times np={np} />
          <div className="np-card__acts">
            {np.url && (
              <a className="np-card__open" href={np.url} target="_blank" rel="noreferrer">
                Open in Spotify
              </a>
            )}
            <button type="button" className="np-card__hide" onClick={() => hideNowPlaying(np)}>
              Hide
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** Phone: a slim strip above the tab bar (it tucks away with the bar) */
export const NowPlayingStrip = () => {
  const np = useNowPlaying();
  const shown = useNowPlayingShown(np);
  if (!np || !shown) return null;
  return (
    <div className={`np-strip ${np.playing ? '' : 'np-strip--paused'}`}>
      <a className="np-strip__main" href={np.url ?? undefined} target="_blank" rel="noreferrer" aria-label={`${np.title} by ${np.artist}, open in Spotify`}>
        <Cover np={np} className="np-strip__cover" />
        <span className="np-strip__txt">
          <span className="np-strip__kick">
            <Eq />
            {np.playing ? 'On the PA' : 'Paused'}
          </span>
          <span className="np-strip__title">{np.title}</span>
          <span className="np-strip__artist">{np.artist}</span>
        </span>
      </a>
      <button type="button" className="np-strip__close" aria-label="Hide now playing" onClick={() => hideNowPlaying(np)}>
        <X aria-hidden="true" />
      </button>
      <TrackBar np={np} className="np-strip__bar" />
    </div>
  );
};
