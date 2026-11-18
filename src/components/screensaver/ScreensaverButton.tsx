import { useState } from 'react';
import { MapPin, MonitorPlay, Music } from 'lucide-react';
import { connectSpotify, disconnectSpotify, spotifyAvailable, useSpotifyConnected } from '@/utils/spotify';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { NIGHT_FROM, NIGHT_TO, SAVER_IDLE_CHOICES, SAVER_SLEEP_CHOICES, forgetSaverPlace, requestSaverPlace, setSaverIdle, setSaverNight, setSaverSleep, startScreensaver, useSaverIdle, useSaverNight, useSaverPlace, useSaverSleep } from '@/utils/screensaver';

/** The header's Season lamp on a desktop: opens the screensaver menu (start now, start by itself after, local weather) */
const ScreensaverButton = ({ season }: { season: string | number }) => {
  const idle = useSaverIdle();
  const spotify = useSpotifyConnected();
  const sleep = useSaverSleep();
  const night = useSaverNight();
  const hour = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });
  const place = useSaverPlace();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const share = () => {
    setBusy(true);
    setErr('');
    requestSaverPlace()
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Season ${season}. Screensaver`}
          title="Screensaver"
          className="lamp hidden shrink-0 cursor-pointer transition-[box-shadow,border-color] hover:border-gold/60 hover:shadow-[inset_0_0_10px_hsl(var(--gold)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:inline-flex"
        >
          <MonitorPlay className="h-3 w-3 opacity-70" aria-hidden="true" />
          Season <b>{season}</b>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 border-line bg-panel p-4">
        <p className="font-pixel text-[10px] uppercase tracking-[0.12em] text-gold">Screensaver</p>
        <p className="mt-1 text-sm text-muted-foreground">Players, cards, line-ups, Hall of Famers and the rafters, one scene at a time. Any key or mouse move ends it.</p>
        <button
          type="button"
          onClick={startScreensaver}
          className="mt-3 w-full rounded-md bg-gold px-3 py-2 font-display text-base font-bold uppercase text-night transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        >
          Start now
        </button>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start by itself after</p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Start by itself after">
          {SAVER_IDLE_CHOICES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={idle === m}
              onClick={() => setSaverIdle(m)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                idle === m ? 'border-gold bg-gold/15 text-gold' : 'border-line text-muted-foreground hover:text-foreground',
              )}
            >
              {m ? `${m} min` : 'Never'}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Let the display sleep after</p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Let the display sleep after">
          {SAVER_SLEEP_CHOICES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={sleep === m}
              onClick={() => setSaverSleep(m)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                sleep === m ? 'border-gold bg-gold/15 text-gold' : 'border-line text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 0 ? 'Never' : m < 60 ? `${m} min` : `${m / 60} h`}
            </button>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={night} onChange={(e) => setSaverNight(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--gold))]" />
          <span>
            Rest overnight
            <span className="block text-xs text-muted-foreground">
              Dark from {hour(NIGHT_FROM)} to {hour(NIGHT_TO)}, and it won't start by itself then.
            </span>
          </span>
        </label>
        <p className="mt-1.5 text-xs text-muted-foreground">Resting fades the show to black and lets your computer's own display sleep take over.</p>
        {spotifyAvailable() && (
          <>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Now playing</p>
            {spotify ? (
              <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <Music className="h-4 w-4 shrink-0 text-turf" aria-hidden="true" />
                  Spotify connected
                </span>
                <button type="button" onClick={disconnectSpotify} className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  Disconnect
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void connectSpotify()}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-foreground transition-colors hover:border-gold/60"
                >
                  <Music className="h-4 w-4" aria-hidden="true" />
                  Connect Spotify
                </button>
                <p className="mt-1.5 text-xs text-muted-foreground">Shows the song playing on your Spotify in a corner of the screensaver. Only this browser talks to Spotify.</p>
              </>
            )}
          </>
        )}
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Local weather</p>
        {place ? (
          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              <span className="truncate">{place.city || 'Your location'}</span>
            </span>
            <button type="button" onClick={forgetSaverPlace} className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              Turn off
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={share}
              disabled={busy}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-foreground transition-colors hover:border-gold/60 disabled:opacity-60"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Finding you…' : 'Use my location'}
            </button>
            <p className="mt-1.5 text-xs text-muted-foreground">{err || 'Shows the weather and your town in the corner. Kept on this device; only rounded coordinates go to the weather service.'}</p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ScreensaverButton;
