/**
 * How the private sprite PNGs are fetched (gameKitPaint.ts processSprite, the sprite hooks in GameSprite / CoachSprite).
 *
 * Measured on a production preview (search "cook", cold): painting a sprite takes 0.3 ms, but a sprite waited 900 ms on
 * average for its PNG: every keystroke mounted a new list of rows, every row asked for its file at once (80 requests for
 * 24 visible rows, stale ones included, none cancellable) and the browser queued them all, newest last. So:
 *
 *  - a small queue: at most MAX_ACTIVE loads in flight, the newest request first (what is on screen now), and a request
 *    nobody wants any more (its row unmounted, the query moved on) is dropped before it starts;
 *  - Cache Storage keeps the PNG bytes (a revisit, or another page wanting the same file, answers from the stored
 *    response whatever the server's cache headers say; a new save pull changes the stamp and clears them);
 *  - the decode is `createImageBitmap` (off the main thread) where it exists.
 */

const MAX_ACTIVE = 8;
const DONE_MAX = 900;
const CACHE_NAME = 'rv-sprites-v1';
const USE_CACHE = !import.meta.env.DEV && typeof caches !== 'undefined';

export type SpriteImage = ImageBitmap | HTMLImageElement;

interface Entry {
  src: string;
  promise: Promise<SpriteImage>;
  resolve: (i: SpriteImage) => void;
  reject: (e: unknown) => void;
  refs: number;
  started: boolean;
}

const live = new Map<string, Entry>(); // queued or loading
const done = new Map<string, Promise<SpriteImage>>(); // loaded (small LRU)
const queue: Entry[] = [];
let active = 0;

let stampJob: Promise<Cache | null> | null = null;
let stamp = '';
/** The sprite files' version (the save the index was cut from); a different stamp drops the stored copies. */
export const setSpriteCacheStamp = (s: string): void => {
  if (!USE_CACHE || stamp === s) return;
  stamp = s;
  stampJob = caches
    .open(CACHE_NAME)
    .then(async (cache) => {
      const key = `${import.meta.env.BASE_URL}__stamp`;
      const had = await cache.match(key);
      if ((had ? await had.text() : '') !== s) {
        for (const req of await cache.keys()) await cache.delete(req);
        await cache.put(key, new Response(s));
      }
      return cache;
    })
    .catch(() => null);
};

const loadElement = (src: string, blob?: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    const url = blob ? URL.createObjectURL(blob) : src;
    img.onload = () => {
      if (blob) URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error('sprite'));
    img.src = url;
  });

const blobOf = async (src: string): Promise<Blob | null> => {
  const cache = USE_CACHE && stamp ? await stampJob : null;
  try {
    if (cache) {
      const hit = await cache.match(src);
      if (hit) return await hit.blob();
    }
    const r = await fetch(src);
    if (!r.ok) return null;
    if (cache) cache.put(src, r.clone()).catch(() => undefined);
    return await r.blob();
  } catch {
    return null;
  }
};

const fetchImage = async (src: string): Promise<SpriteImage> => {
  const blob = await blobOf(src);
  if (blob && typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // fall through to an element
    }
  }
  return loadElement(src, blob ?? undefined);
};

const pump = () => {
  while (active < MAX_ACTIVE && queue.length) {
    const e = queue.pop()!; // newest first: what the screen shows now
    e.started = true;
    active++;
    fetchImage(e.src).then(
      (img) => {
        live.delete(e.src);
        done.set(e.src, e.promise);
        if (done.size > DONE_MAX) done.delete(done.keys().next().value!);
        e.resolve(img);
      },
      (err) => {
        live.delete(e.src);
        e.reject(err);
      },
    ).finally(() => {
      active--;
      pump();
    });
  }
};

export interface SpriteRequest {
  promise: Promise<SpriteImage>;
  /** The caller no longer wants it: a request still waiting in the queue is dropped (its promise rejects) */
  release: () => void;
}

/** The sprite file as a decoded image (shared between callers of the same file). */
export const requestSpriteImage = (src: string): SpriteRequest => {
  const hit = done.get(src);
  if (hit) return { promise: hit, release: () => undefined };
  let e = live.get(src);
  if (!e) {
    let resolve!: Entry['resolve'];
    let reject!: Entry['reject'];
    const promise = new Promise<SpriteImage>((a, b) => {
      resolve = a;
      reject = b;
    });
    promise.catch(() => undefined);
    e = { src, promise, resolve, reject, refs: 0, started: false };
    live.set(src, e);
    queue.push(e);
    pump();
  }
  e.refs++;
  const entry = e;
  let released = false;
  return {
    promise: entry.promise,
    release: () => {
      if (released) return;
      released = true;
      if (--entry.refs > 0 || entry.started) return;
      const i = queue.indexOf(entry);
      if (i >= 0) queue.splice(i, 1);
      live.delete(entry.src);
      entry.reject(new Error('cancelled'));
    },
  };
};
