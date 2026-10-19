/**
 * Move personal progress between devices (collection, arcade scores and streaks, saved Team Lab builds, Hall of
 * Fame "seen" state, coach name). Everything else on the site is shared data and is the same everywhere.
 *
 * Export: every localStorage key below, as JSON, deflate-compressed when the browser supports it, base64url.
 * Import: a code (or a link with #sync=<code>) replaces those keys on this device, then the page reloads.
 */

const PREFIX = 'retroVault:';
/** Personal progress worth carrying over. League data and old caches are excluded on purpose. */
const INCLUDE = [/^retroVault:collection/, /^retroVault:games:/, /^retroVault:teamLab:/, /^retroVault:(hofSeen|ringSeen|hofClasses|coachName)$/];

const syncKeys = (): string[] => {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX) && INCLUDE.some((re) => re.test(k))) keys.push(k);
    }
  } catch {
    /* storage unavailable */
  }
  return keys.sort();
};

const toB64Url = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

/** "z." = deflate-raw compressed, "j." = plain JSON (browsers without CompressionStream). */
export const exportProgress = async (): Promise<{ code: string; count: number }> => {
  const data: Record<string, string> = {};
  const keys = syncKeys();
  keys.forEach((k) => {
    const v = localStorage.getItem(k);
    if (v != null) data[k] = v;
  });
  const raw = new TextEncoder().encode(JSON.stringify({ v: 1, data }));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return { code: `z.${toB64Url(await pipe(raw, new CompressionStream('deflate-raw')))}`, count: keys.length };
    } catch {
      /* fall through to plain */
    }
  }
  return { code: `j.${toB64Url(raw)}`, count: keys.length };
};

/** Decodes a code (or a whole pasted link) into the keys it carries; throws on anything malformed. */
export const decodeProgress = async (input: string): Promise<Record<string, string>> => {
  const code = input.trim().replace(/^.*#sync=/, '');
  const [kind, body] = [code.slice(0, 2), code.slice(2)];
  if ((kind !== 'z.' && kind !== 'j.') || !body) throw new Error('Not a Retro Vault transfer code');
  let bytes = fromB64Url(body);
  if (kind === 'z.') {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read compressed codes');
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { v?: number; data?: Record<string, unknown> };
  if (parsed?.v !== 1 || !parsed.data || typeof parsed.data !== 'object') throw new Error('Unrecognised transfer code');
  const out: Record<string, string> = {};
  Object.entries(parsed.data).forEach(([k, v]) => {
    if (typeof v === 'string' && k.startsWith(PREFIX) && INCLUDE.some((re) => re.test(k))) out[k] = v;
  });
  return out;
};

/** Replaces this device's progress with the decoded keys. */
export const importProgress = (data: Record<string, string>) => {
  syncKeys().forEach((k) => localStorage.removeItem(k));
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
};

/** A shareable link to this page that carries the code (only useful from an address the other device can open). */
export const transferLink = (code: string) => `${window.location.origin}${window.location.pathname}#sync=${code}`;

/** True when this page is served from localhost, which a phone can't open. */
export const isLocalhost = () => /^(localhost|127\.|\[::1\])/.test(window.location.hostname);
