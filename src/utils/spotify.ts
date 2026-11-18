import { useEffect, useSyncExternalStore } from 'react';

/*
 * Spotify now playing for the screensaver (owner, 2026-11-18). Browser only, no server: the Authorization Code flow
 * with PKCE, the one Spotify allows for an app that can't keep a secret. The Client ID is public by design; the tokens
 * stay in this browser (localStorage) and go only to Spotify. Scopes: reading what is playing, nothing else.
 *
 * The Spotify app's Redirect URIs must list this site's address exactly: https://sakisaki-dev.github.io/RetroVault/
 * on Pages, and http://127.0.0.1:<port>/ for the dev server or the LAN preview (Spotify refuses "localhost").
 */
export const SPOTIFY_CLIENT_ID = '7ce2b1e0170b40bfb7ca4034eb59e298';

const TOKEN_KEY = 'rv:spotify';
const VERIFIER_KEY = 'rv:spotify:verifier';
const SCOPES = 'user-read-currently-playing user-read-playback-state';

interface Tokens {
  access: string;
  refresh: string;
  /** ms since epoch */
  expires: number;
}

export interface NowPlaying {
  title: string;
  artist: string;
  album: string;
  art: string | null;
  /** the track on open.spotify.com */
  url: string | null;
  playing: boolean;
  progress: number;
  duration: number;
  /** when progress was read (ms since epoch), so the bar can run on between polls */
  at: number;
}

export const spotifyAvailable = () => !!SPOTIFY_CLIENT_ID;

const redirectUri = () => `${location.origin}${import.meta.env.BASE_URL}`;

const readTokens = (): Tokens | null => {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null');
    return t && typeof t.access === 'string' && typeof t.refresh === 'string' ? t : null;
  } catch {
    return null;
  }
};

const listeners = new Set<() => void>();
let tokens = readTokens();
const setTokens = (t: Tokens | null) => {
  tokens = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* kept for this visit */
  }
  listeners.forEach((l) => l());
};

/** Connected to Spotify on this device */
export const useSpotifyConnected = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => !!tokens,
    () => false,
  );

export const disconnectSpotify = () => setTokens(null);

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Off to Spotify's sign-in (from a click); it comes back to this page with ?code=… */
export const connectSpotify = async () => {
  if (!SPOTIFY_CLIENT_ID) return;
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
  try {
    localStorage.setItem(VERIFIER_KEY, JSON.stringify({ verifier, state, hash: location.hash }));
  } catch {
    return;
  }
  const q = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });
  location.assign(`https://accounts.spotify.com/authorize?${q}`);
};

const tokenRequest = async (body: Record<string, string>): Promise<Tokens | null> => {
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...body }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return { access: j.access_token, refresh: j.refresh_token ?? body.refresh_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
  } catch {
    return null;
  }
};

/**
 * Finishes a sign-in when Spotify sends the browser back (?code=…&state=…): swaps the code for tokens, then puts the
 * address back as it was (the hash route included). Called once at start-up.
 */
export const completeSpotifyLogin = async () => {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!params.has('state') || (!code && !params.has('error'))) return;
  let saved: { verifier: string; state: string; hash: string } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(VERIFIER_KEY) ?? 'null');
    localStorage.removeItem(VERIFIER_KEY);
  } catch {
    saved = null;
  }
  history.replaceState(null, '', `${location.pathname}${saved?.hash ?? location.hash}`);
  if (!code || !saved || saved.state !== state) return;
  const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: saved.verifier });
  if (t) setTokens(t);
};

const accessToken = async (): Promise<string | null> => {
  if (!tokens) return null;
  if (Date.now() < tokens.expires) return tokens.access;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh });
  setTokens(t);
  return t?.access ?? null;
};

/** What is playing now, or null (nothing, a podcast, or not connected) */
export const fetchNowPlaying = async (): Promise<NowPlaying | null> => {
  const token = await accessToken();
  if (!token) return null;
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) setTokens(null);
    if (r.status !== 200) return null;
    const j = await r.json();
    const it = j.item;
    if (!it || j.currently_playing_type !== 'track') return null;
    const imgs: { url: string; width: number }[] = it.album?.images ?? [];
    const art = [...imgs].sort((a, b) => a.width - b.width).find((x) => x.width >= 160) ?? imgs[0];
    return {
      title: it.name,
      artist: (it.artists ?? []).map((a: { name: string }) => a.name).join(', '),
      album: it.album?.name ?? '',
      art: art?.url ?? null,
      url: it.external_urls?.spotify ?? null,
      playing: !!j.is_playing,
      progress: j.progress_ms ?? 0,
      duration: it.duration_ms ?? 0,
      at: Date.now(),
    };
  } catch {
    return null;
  }
};

/*
 * One poller for the whole page: the header pill, the phone strip and the screensaver all read the same song. It asks
 * Spotify every 8 s while anything is listening and the tab is visible, and stops when nothing is.
 */
const npListeners = new Set<() => void>();
let current: NowPlaying | null = null;
let users = 0;
let timer = 0;
const emit = () => npListeners.forEach((l) => l());
const poll = async () => {
  if (document.hidden || !tokens) return;
  const n = await fetchNowPlaying();
  const same = n && current && n.title === current.title && n.artist === current.artist && n.playing === current.playing && Math.abs(n.progress - current.progress - (n.at - current.at)) < 3000;
  if (same) return;
  current = n;
  emit();
};
const start = () => {
  if (timer) return;
  void poll();
  timer = window.setInterval(poll, 8_000);
  document.addEventListener('visibilitychange', poll);
};
const stop = () => {
  window.clearInterval(timer);
  timer = 0;
  document.removeEventListener('visibilitychange', poll);
};
listeners.add(() => {
  // signed out: nothing plays; signed in while someone listens: start asking
  if (!tokens) {
    current = null;
    emit();
  } else if (users) start();
});

/** What is playing now (shared across the page), or null; `on` false stops this reader from keeping the poller alive */
export const useNowPlaying = (on = true) => {
  const connected = useSpotifyConnected();
  useEffect(() => {
    if (!on || !connected) return;
    users += 1;
    start();
    return () => {
      users -= 1;
      if (!users) stop();
    };
  }, [on, connected]);
  const np = useSyncExternalStore(
    (l) => {
      npListeners.add(l);
      return () => npListeners.delete(l);
    },
    () => current,
    () => null,
  );
  return on && connected ? np : null;
};

/** Hidden for this visit (the pill and the strip's close button); a new song brings it back */
let hiddenFor: string | null = null;
const hideListeners = new Set<() => void>();
export const hideNowPlaying = (np: NowPlaying) => {
  hiddenFor = `${np.title}|${np.artist}`;
  hideListeners.forEach((l) => l());
};
export const useNowPlayingShown = (np: NowPlaying | null) => {
  const h = useSyncExternalStore(
    (l) => {
      hideListeners.add(l);
      return () => hideListeners.delete(l);
    },
    () => hiddenFor,
    () => null,
  );
  return !!np && h !== `${np.title}|${np.artist}`;
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** "1:23" / "4:01" for a track */
export const trackTimes = (np: NowPlaying) => ({ at: mmss(np.progress + (np.playing ? Date.now() - np.at : 0)), of: mmss(np.duration) });
