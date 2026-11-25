/**
 * The site's data files, fetched through one door (`dataFetch`): callers asking for the same file while it is on its way
 * share one request (each gets its own clone), and the requests wait their turn in a small scheduler.
 *
 * Why: the line is the bottleneck on a phone (a cold start asks for 40 to 70 files, 600 to 800 KB, all at once, so the
 * league sheet every tab blocks on shared the line with files nothing on screen needs yet; save_state.json was asked for
 * by three modules at once). At most SLOTS requests run at a time, the files the first screen of any tab needs go first
 * (`URGENT`), the ones for sections far down a page or other tabs (`BACKGROUND`) only take a slot nothing else wants.
 * Everything is still fetched and every caller still gets its Response; a failed fetch still rejects like `fetch`.
 */
const BASE = import.meta.env.BASE_URL;

const SLOTS = 4;
const URGENT = /^(data\/initial-data\.csv|data\/player-extras\.json|data\/sprites\.json|private-sprites\/(nfl\/)?index\.json)/;
const BACKGROUND = /^(data\/league\/(takes\.json|rewind\/|tributes\/|career_seasons\.json)|data\/transit\/|data\/widget\.json)/;

const rank = (url: string) => {
  const path = url.startsWith(BASE) ? url.slice(BASE.length) : url;
  return URGENT.test(path) ? 0 : BACKGROUND.test(path) ? 2 : 1;
};

let running = 0;
const waiting: { rank: number; start: () => void }[] = [];
const pump = () => {
  while (running < SLOTS && waiting.length) {
    // the best rank first, first come first served within it
    let best = 0;
    for (let i = 1; i < waiting.length; i++) if (waiting[i].rank < waiting[best].rank) best = i;
    const [next] = waiting.splice(best, 1);
    running += 1;
    next.start();
  }
};

/** Runs a fetch in a slot, held until the whole body is in (the headers alone arrive long before the bytes do). */
const scheduledFetch = (url: string, init?: RequestInit): Promise<Response> =>
  new Promise<Response>((resolve, reject) => {
    waiting.push({
      rank: rank(url),
      start: () =>
        (async () => {
          const r = await fetch(url, init);
          if (!r.ok) return r;
          return new Response(await r.arrayBuffer(), { status: r.status, statusText: r.statusText, headers: r.headers });
        })()
          .then(resolve, reject)
          .finally(() => {
            running -= 1;
            pump();
          }),
    });
    pump();
  });

const flights = new Map<string, Promise<Response>>();

/**
 * A drop-in for `fetch(url, init)` for the site's own files (a full URL under BASE_URL). Callers asking for the same URL
 * while it is in flight share one request; later calls ask again (the callers memoize their parsed data themselves).
 */
export const dataFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  let job = flights.get(url);
  if (!job) {
    job = scheduledFetch(url, init);
    flights.set(url, job);
    // keep the entry only while the request is in flight
    const drop = () => void flights.delete(url);
    job.then(drop, drop);
  }
  return (await job).clone();
};

/** Starts the files the first screen of any tab needs, the moment the entry module runs (main.tsx). */
export const prewarmData = (paths: string[]) => {
  paths.forEach((p) => void dataFetch(`${BASE}${p}`, { cache: 'no-cache' }).catch(() => undefined));
};
