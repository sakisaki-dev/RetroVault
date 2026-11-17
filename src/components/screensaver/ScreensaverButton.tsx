import { useState } from 'react';
import { MapPin, MonitorPlay } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SAVER_IDLE_CHOICES, forgetSaverPlace, requestSaverPlace, setSaverIdle, startScreensaver, useSaverIdle, useSaverPlace } from '@/utils/screensaver';

/** Header control (desktop only): start the screensaver now, or pick when it starts by itself */
const ScreensaverButton = () => {
  const idle = useSaverIdle();
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
          aria-label="Screensaver"
          title="Screensaver"
          className="hidden shrink-0 items-center rounded-md border border-line px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:inline-flex"
        >
          <MonitorPlay className="h-4 w-4" aria-hidden="true" />
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
