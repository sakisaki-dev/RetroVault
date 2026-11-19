import { useState, type ReactNode } from 'react';
import { Bus, CloudSun, MapPin, MonitorPlay, Music, Timer } from 'lucide-react';
import { lastSaverWeather, setSaverFx, useSaverFx, weatherKind } from '@/utils/screensaver';
import { setBusSetting, useBusSetting, useRoute } from '@/utils/bus';
import { connectSpotify, disconnectSpotify, spotifyAvailable, useSpotifyConnected } from '@/utils/spotify';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { NIGHT_FROM, NIGHT_TO, SAVER_IDLE_CHOICES, SAVER_SLEEP_CHOICES, forgetSaverPlace, requestSaverPlace, setSaverIdle, setSaverNight, setSaverSleep, startScreensaver, useSaverIdle, useSaverNight, useSaverPlace, useSaverSleep } from '@/utils/screensaver';

type Tab = 'timing' | 'weather' | 'bus' | 'music';
const TAB_KEY = 'rv:saver:menu';
const readTab = (): Tab => {
  try {
    const v = localStorage.getItem(TAB_KEY) as Tab | null;
    return v && ['timing', 'weather', 'bus', 'music'].includes(v) ? v : 'timing';
  } catch {
    return 'timing';
  }
};

const selectCls = 'rounded-md border border-line bg-night px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';

/** One setting as a compact row: the name on the left, its control on the right */
const Row = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <div className="flex flex-col gap-0.5">
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-foreground">{label}</span>
      {children}
    </label>
    {hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
  </div>
);

const minutes = (m: number) => (m === 0 ? 'Never' : m < 60 ? `${m} min` : `${m / 60} h`);

/**
 * The header's Season lamp: opens the screensaver menu (owner, 2026-11-18: "the screensaver menu is super long now, redo
 * that"): Start now on top, then one short tab at a time: Timing (start by itself, display sleep, rest overnight),
 * Weather (effects, local weather), Bus (stop, destination, walk) and Music (Spotify). The tab shown last is remembered.
 */
const ScreensaverButton = ({ season }: { season: string | number }) => {
  const idle = useSaverIdle();
  const sleep = useSaverSleep();
  const night = useSaverNight();
  const fx = useSaverFx();
  const place = useSaverPlace();
  const bus = useBusSetting();
  const route = useRoute('11');
  const spotify = useSpotifyConnected();
  const [tab, setTabState] = useState<Tab>(readTab);
  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* this visit only */
    }
  };
  const hour = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const share = () => {
    setBusy(true);
    setErr('');
    requestSaverPlace()
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  };
  const tabs: { id: Tab; label: string; icon: typeof Timer }[] = [
    { id: 'timing', label: 'Timing', icon: Timer },
    { id: 'weather', label: 'Weather', icon: CloudSun },
    { id: 'bus', label: 'Bus', icon: Bus },
    ...(spotifyAvailable() ? [{ id: 'music' as Tab, label: 'Music', icon: Music }] : []),
  ];
  const pts = route?.points ?? [];
  const from = bus ? pts.findIndex((p) => p.id === bus.point) : -1;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Season ${season}. Screensaver`}
          title="Screensaver"
          className="lamp hidden shrink-0 cursor-pointer transition-[box-shadow,border-color] hover:border-gold/60 hover:shadow-[inset_0_0_10px_hsl(var(--gold)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:inline-flex"
        >
          <MonitorPlay className="h-3 w-3 opacity-70" aria-hidden="true" />
          Season <b>{season}</b>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-line bg-panel p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-pixel text-[10px] uppercase tracking-[0.12em] text-gold">Screensaver</p>
            <p className="text-xs text-muted-foreground">Any key or mouse move ends it.</p>
          </div>
          <button
            type="button"
            onClick={startScreensaver}
            className="shrink-0 rounded-md bg-gold px-3 py-1.5 font-display text-sm font-bold uppercase text-night transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          >
            Start now
          </button>
        </div>

        <div role="tablist" aria-label="Screensaver settings" className="mt-3 grid grid-flow-col gap-1 rounded-lg bg-night/60 p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                tab === id ? 'bg-gold/15 text-gold' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="mt-3 flex flex-col gap-2.5">
          {tab === 'timing' && (
            <>
              <Row label="Start by itself after">
                <select value={idle} onChange={(e) => setSaverIdle(Number(e.target.value))} className={selectCls}>
                  {SAVER_IDLE_CHOICES.map((m) => (
                    <option key={m} value={m}>
                      {minutes(m)}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Let the display sleep after" hint="The show fades to black and your computer's own sleep takes over.">
                <select value={sleep} onChange={(e) => setSaverSleep(Number(e.target.value))} className={selectCls}>
                  {SAVER_SLEEP_CHOICES.map((m) => (
                    <option key={m} value={m}>
                      {minutes(m)}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Rest overnight" hint={`Dark from ${hour(NIGHT_FROM)} to ${hour(NIGHT_TO)}, and no starting by itself then.`}>
                <input type="checkbox" checked={night} onChange={(e) => setSaverNight(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--gold))]" />
              </Row>
            </>
          )}

          {tab === 'weather' && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-foreground">Effects</span>
                <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Weather effects">
                  {(
                    [
                      ['real', 'Real'],
                      ['rain', 'Rain'],
                      ['snow', 'Snow'],
                      ['storm', 'Storm'],
                      ['none', 'None'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={fx === v}
                      onClick={() => setSaverFx(v)}
                      className={cn(
                        'rounded-md border px-1 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                        fx === v ? 'border-gold bg-gold/15 text-gold' : 'border-line text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] leading-snug text-muted-foreground">Real follows the weather where you are; the others play whatever it's doing outside.</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground">
                  <MapPin className={cn('h-4 w-4 shrink-0', place ? 'text-gold' : 'text-muted-foreground')} aria-hidden="true" />
                  <span className="truncate">{place ? place.city || 'Your location' : 'Local weather off'}</span>
                </span>
                {place ? (
                  <button type="button" onClick={forgetSaverPlace} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                    Turn off
                  </button>
                ) : (
                  <button type="button" onClick={share} disabled={busy} className="shrink-0 rounded-md border border-line px-2 py-1 text-xs text-foreground transition-colors hover:border-gold/60 disabled:opacity-60">
                    {busy ? 'Finding you…' : 'Use my location'}
                  </button>
                )}
              </div>
              {err && <span className="text-[11px] text-muted-foreground">{err}</span>}
              {(() => {
                // what the screensaver last saw, so it's clear what Real will show
                const wx = place ? lastSaverWeather() : null;
                if (!place) return <span className="text-[11px] leading-snug text-muted-foreground">Real needs your location to know the weather.</span>;
                if (!wx) return <span className="text-[11px] leading-snug text-muted-foreground">Checks the weather when the screensaver starts.</span>;
                return (
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    Last seen: {weatherKind(wx.code).label} · {wx.temp}°{place.unit === 'fahrenheit' ? 'F' : 'C'} (rechecked every 10 min)
                  </span>
                );
              })()}
            </>
          )}

          {tab === 'bus' && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground">Route 11 · your stop</span>
                <select
                  value={bus?.point ?? ''}
                  onChange={(e) => setBusSetting(e.target.value ? { route: '11', point: e.target.value, walk: bus?.walk ?? 7, to: bus?.to } : null)}
                  className={selectCls}
                >
                  <option value="">Off</option>
                  {pts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} → {p.toward}
                    </option>
                  ))}
                </select>
              </label>
              {bus && (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-foreground">Going to</span>
                    <select value={bus.to ?? ''} onChange={(e) => setBusSetting({ ...bus, to: e.target.value || undefined })} className={selectCls}>
                      <option value="">Don't show</option>
                      {pts.slice(from + 1).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Row label="Walk to the stop">
                    <select value={bus.walk} onChange={(e) => setBusSetting({ ...bus, walk: Number(e.target.value) })} className={selectCls}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((m) => (
                        <option key={m} value={m}>
                          {m} min
                        </option>
                      ))}
                    </select>
                  </Row>
                </>
              )}
              <span className="text-[11px] leading-snug text-muted-foreground">By METRO's timetable, under the weather. Kept on this device.</span>
            </>
          )}

          {tab === 'music' && (
            <>
              {spotify ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <Music className="h-4 w-4 shrink-0 text-turf" aria-hidden="true" />
                    Spotify connected
                  </span>
                  <button type="button" onClick={disconnectSpotify} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void connectSpotify()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-foreground transition-colors hover:border-gold/60"
                >
                  <Music className="h-4 w-4" aria-hidden="true" />
                  Connect Spotify
                </button>
              )}
              <span className="text-[11px] leading-snug text-muted-foreground">The song playing shows on the scoreboard in the corner. Only this browser talks to Spotify.</span>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ScreensaverButton;
