import { useSyncExternalStore } from 'react';

/*
 * The desktop screensaver (owner, 2026-11-17: "a screensaver option for the desktop site so that I can leave my computer
 * and it'll rifle through beautiful artwork, players, banners etc with animations"). Started from the header's
 * Screensaver button, or by itself after the chosen idle time; any key, click or real mouse move ends it.
 * Desktop only: a wide screen with a fine pointer. The idle choice is a per-device convenience (localStorage).
 */

export const SAVER_IDLE_KEY = 'rv:saver:idle';
/** Idle minutes before it starts by itself; 0 = only from the button */
export const SAVER_IDLE_CHOICES = [0, 2, 5, 10, 15] as const;
const DEFAULT_IDLE = 5;

const START = 'rv:screensaver:start';
const listeners = new Set<() => void>();

const readIdle = (): number => {
  try {
    const v = Number(localStorage.getItem(SAVER_IDLE_KEY));
    const raw = localStorage.getItem(SAVER_IDLE_KEY);
    return raw !== null && (SAVER_IDLE_CHOICES as readonly number[]).includes(v) ? v : DEFAULT_IDLE;
  } catch {
    return DEFAULT_IDLE;
  }
};

let idle = readIdle();

export const setSaverIdle = (min: number) => {
  idle = min;
  try {
    localStorage.setItem(SAVER_IDLE_KEY, String(min));
  } catch {
    /* private window: the choice lasts this visit */
  }
  listeners.forEach((l) => l());
};

export const useSaverIdle = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => idle,
    () => DEFAULT_IDLE,
  );

/*
 * Letting the display sleep (owner, 2026-11-18): after the chosen time the show fades to black and gives up its Wake
 * Lock, so the computer's own display sleep takes over; "Rest overnight" does the same from 11 pm to 7 am and keeps it
 * from starting by itself then. Any key or mouse move still ends it as usual.
 */
export const SAVER_SLEEP_KEY = 'rv:saver:sleep';
export const SAVER_NIGHT_KEY = 'rv:saver:night';
/** Minutes before the show rests; 0 = keep the display awake */
export const SAVER_SLEEP_CHOICES = [0, 30, 60, 120, 240] as const;
const DEFAULT_SLEEP = 60;
export const NIGHT_FROM = 23;
export const NIGHT_TO = 7;

const readNum = (key: string, choices: readonly number[], fallback: number) => {
  try {
    const raw = localStorage.getItem(key);
    const v = Number(raw);
    return raw !== null && choices.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
};
let sleep = readNum(SAVER_SLEEP_KEY, SAVER_SLEEP_CHOICES, DEFAULT_SLEEP);
let night = (() => {
  try {
    return localStorage.getItem(SAVER_NIGHT_KEY) === '1';
  } catch {
    return false;
  }
})();
const store = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* lasts this visit */
  }
};
export const setSaverSleep = (min: number) => {
  sleep = min;
  store(SAVER_SLEEP_KEY, String(min));
  listeners.forEach((l) => l());
};
export const setSaverNight = (on: boolean) => {
  night = on;
  store(SAVER_NIGHT_KEY, on ? '1' : '0');
  listeners.forEach((l) => l());
};
const sub = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useSaverSleep = () => useSyncExternalStore(sub, () => sleep, () => DEFAULT_SLEEP);
export const useSaverNight = () => useSyncExternalStore(sub, () => night, () => false);
/**
 * Weather effects over the show (owner, 2026-11-18: "add snow and rain as toggles in the screensaver settings even if
 * the weather isn't"): the real weather (default), or rain, snow or a storm whatever it is outside, or none
 */
export type SaverFx = 'real' | 'rain' | 'snow' | 'storm' | 'none';
export const SAVER_FX_KEY = 'rv:saver:fx';
const FX_CHOICES: SaverFx[] = ['real', 'rain', 'snow', 'storm', 'none'];
let fxSetting: SaverFx = (() => {
  try {
    const v = localStorage.getItem(SAVER_FX_KEY) as SaverFx | null;
    return v && FX_CHOICES.includes(v) ? v : 'real';
  } catch {
    return 'real';
  }
})();
export const setSaverFx = (v: SaverFx) => {
  fxSetting = v;
  store(SAVER_FX_KEY, v);
  listeners.forEach((l) => l());
};
export const useSaverFx = () => useSyncExternalStore(sub, () => fxSetting, (): SaverFx => 'real');

/** Inside the overnight rest window (local time) */
export const isNightRest = (d = new Date()) => {
  const h = d.getHours();
  return h >= NIGHT_FROM || h < NIGHT_TO;
};

/** Start it now (the header button). Called inside the click, so it can go full screen. */
export const startScreensaver = () => window.dispatchEvent(new Event(START));
export const onScreensaverStart = (fn: () => void) => {
  window.addEventListener(START, fn);
  return () => window.removeEventListener(START, fn);
};

/**
 * Where it starts by itself after the idle time: a big screen that isn't a phone or tablet in the hand: wide, with no
 * coarse (touch) pointer, so a desktop with a mouse or a TV browser driven by a remote (Fire TV's Silk reports no
 * pointer at all; owner, 2026-11-18: "trying to use the screensaver on my tv with the amazon silk browser")
 */
export const saverSupported = () => {
  try {
    return window.matchMedia('(min-width: 900px)').matches && !window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

/*
 * Local weather for the screensaver's corner (owner, 2026-11-17: "add in a bit of weather, time and location").
 * Opt-in from the Screensaver menu: the browser asks for the location once, it is rounded to 2 decimals (about 1 km)
 * and kept on this device with the town's name; the screensaver then asks Open-Meteo for the current weather (no key,
 * rounded coordinates only), at most every 20 minutes (cached on the device).
 */
export interface SaverPlace {
  lat: number;
  lon: number;
  city: string;
  /** °F where the browser's region is the US (also Liberia, Myanmar), else °C */
  unit: 'fahrenheit' | 'celsius';
}

const PLACE_KEY = 'rv:saver:place';
const WX_KEY = 'rv:saver:wx';
const placeListeners = new Set<() => void>();

const readPlace = (): SaverPlace | null => {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null');
    return p && typeof p.lat === 'number' && typeof p.lon === 'number' ? p : null;
  } catch {
    return null;
  }
};
let place = readPlace();

const savePlace = (p: SaverPlace | null) => {
  place = p;
  try {
    if (p) localStorage.setItem(PLACE_KEY, JSON.stringify(p));
    else {
      localStorage.removeItem(PLACE_KEY);
      localStorage.removeItem(WX_KEY);
    }
  } catch {
    /* kept for this visit */
  }
  placeListeners.forEach((l) => l());
};

export const useSaverPlace = () =>
  useSyncExternalStore(
    (l) => {
      placeListeners.add(l);
      return () => placeListeners.delete(l);
    },
    () => place,
    () => null,
  );

export const forgetSaverPlace = () => savePlace(null);

const unitFor = (): SaverPlace['unit'] => {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region ?? '';
    return ['US', 'LR', 'MM'].includes(region) ? 'fahrenheit' : 'celsius';
  } catch {
    return 'celsius';
  }
};

/** Ask the browser for the location (from a click), name the town, keep both on this device */
export const requestSaverPlace = (): Promise<SaverPlace> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available in this browser'));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        let city = '';
        try {
          const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
          const j = await r.json();
          city = j.city || j.locality || j.principalSubdivision || '';
        } catch {
          city = '';
        }
        const p: SaverPlace = { lat, lon, city, unit: unitFor() };
        savePlace(p);
        resolve(p);
      },
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location permission was denied' : 'Could not find the location')),
      { maximumAge: 3_600_000, timeout: 15_000 },
    );
  });

export interface SaverWeather {
  temp: number;
  code: number;
  day: boolean;
  hi: number;
  lo: number;
  /** wind speed in km/h (missing in a cache from before wind was read) */
  wind?: number;
  gust?: number;
}

/** The current weather at the saved place, from the device cache when it is under 10 minutes old */
export const fetchSaverWeather = async (p: SaverPlace): Promise<SaverWeather | null> => {
  const key = `${p.lat},${p.lon},${p.unit},w`;
  try {
    const c = JSON.parse(localStorage.getItem(WX_KEY) ?? 'null');
    if (c && c.key === key && Date.now() - c.at < 10 * 60_000) return c.wx;
  } catch {
    /* no cache */
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
      `&current=temperature_2m,weather_code,is_day,wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto&temperature_unit=${p.unit}`;
    const j = await (await fetch(url)).json();
    const wx: SaverWeather = {
      temp: Math.round(j.current.temperature_2m),
      code: j.current.weather_code,
      day: j.current.is_day === 1,
      hi: Math.round(j.daily.temperature_2m_max[0]),
      lo: Math.round(j.daily.temperature_2m_min[0]),
      wind: Math.round(j.current.wind_speed_10m ?? 0),
      gust: Math.round(j.current.wind_gusts_10m ?? 0),
    };
    try {
      localStorage.setItem(WX_KEY, JSON.stringify({ key, at: Date.now(), wx }));
    } catch {
      /* fine */
    }
    return wx;
  } catch {
    return null;
  }
};

/** What the screensaver last read for the saved place (the menu shows it), or null */
export const lastSaverWeather = (): SaverWeather | null => {
  try {
    const c = JSON.parse(localStorage.getItem(WX_KEY) ?? 'null');
    return c?.wx ?? null;
  } catch {
    return null;
  }
};

/** WMO weather code → a word and the screensaver's weather layer */
export const weatherKind = (code: number): { label: string; fx: 'clear' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm' } => {
  if (code === 0) return { label: 'Clear', fx: 'clear' };
  if (code <= 2) return { label: 'Partly cloudy', fx: 'clear' };
  if (code === 3) return { label: 'Overcast', fx: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', fx: 'fog' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', fx: 'rain' };
  if (code >= 61 && code <= 67) return { label: 'Rain', fx: 'rain' };
  if (code >= 71 && code <= 77) return { label: 'Snow', fx: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Showers', fx: 'rain' };
  if (code === 85 || code === 86) return { label: 'Snow showers', fx: 'snow' };
  if (code >= 95) return { label: 'Thunderstorm', fx: 'storm' };
  return { label: 'Cloudy', fx: 'cloud' };
};

/**
 * How hard the wind blows for the screensaver, 0 (calm) to 1 (a gale): banners swing wider and faster and the rain
 * leans with it. Light air under 8 km/h counts as calm; gusts count for a third.
 */
export const windForce = (wx: SaverWeather | null): number => {
  if (!wx?.wind) return 0;
  const kmh = wx.wind + Math.max(0, (wx.gust ?? 0) - wx.wind) / 3;
  return Math.round(Math.min(1, Math.max(0, (kmh - 8) / 42)) * 100) / 100;
};

/** A word for the corner once the wind is worth naming (Beaufort 4 and up) */
export const windLabel = (kmh: number): string | null =>
  kmh >= 62 ? 'Gale' : kmh >= 39 ? 'Very windy' : kmh >= 29 ? 'Windy' : kmh >= 20 ? 'Breezy' : null;
