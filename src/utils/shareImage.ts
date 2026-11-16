/**
 * Share pictures (owner: "give me the option to share pictures"): a poster element (components/share) is drawn to a
 * PNG and handed to the iOS share sheet (navigator.share with a file), or downloaded where files can't be shared.
 *
 * Drawing: html-to-image (DOM → SVG foreignObject → canvas, loaded only when a picture is made) over a poster rendered
 * from the same components the page shows, so the Google Fonts, the pixel art (sprites are local data URLs or files)
 * and the card finishes come out as on screen. Before the draw:
 *   - every running animation and transition in the poster is jumped to its end (infinite loops are paused), so
 *     entrance animations never leave a half-faded element;
 *   - cross-origin images (ESPN's club logos, served with Access-Control-Allow-Origin: *) are fetched with CORS and
 *     inlined; one that fails is replaced by a plate in the club's colour with its abbreviation, never a hole;
 *   - fonts and images are awaited, and the poster has to sit still (no DOM changes) for a moment.
 * WebKit can paint images inside an SVG image late on the first draw, so the canvas is drawn twice (the first warms
 * its image cache).
 *
 * Sharing must happen inside the tap on a phone (user activation), so callers prepare the blob ahead of the tap and
 * call shareImageBlob synchronously from the click handler (ShareImageButton does both).
 */
import { NFL_TEAMS } from './nflTeams';

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Jump every animation and transition in the subtree to its end; pause the endless ones where they are. */
const settleAnimations = (root: HTMLElement) => {
  const anims = typeof root.getAnimations === 'function' ? root.getAnimations({ subtree: true }) : [];
  for (const a of anims) {
    try {
      const it = a.effect?.getComputedTiming().iterations;
      if (it === Infinity) a.pause();
      else a.finish();
    } catch {
      try {
        a.pause();
      } catch {
        /* nothing more to do */
      }
    }
  }
};

/** Resolve once the subtree has had no DOM changes for `quiet` ms (or after `max` ms). */
const quietDom = (root: HTMLElement, quiet = 220, max = 3500) =>
  new Promise<void>((resolve) => {
    let timer = 0;
    const done = () => {
      mo.disconnect();
      window.clearTimeout(timer);
      window.clearTimeout(cap);
      resolve();
    };
    const mo = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(done, quiet);
    });
    mo.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = window.setTimeout(done, quiet);
    const cap = window.setTimeout(done, max);
  });

const imagesReady = async (root: HTMLElement) => {
  const imgs = [...root.querySelectorAll('img')];
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : Promise.race([img.decode().catch(() => undefined), sleep(2500)]),
    ),
  );
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const inlined = new Map<string, Promise<string | null>>();
/** An image as a data URL (cached per URL), or null when CORS or the network says no. */
const inlineUrl = (url: string) => {
  let p = inlined.get(url);
  if (!p) {
    p = fetch(url, { mode: 'cors', credentials: 'omit' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(blobToDataUrl)
      .catch(() => null);
    inlined.set(url, p);
  }
  return p;
};

/** A round plate in the club's colours with its abbreviation: what a logo that can't be drawn becomes. */
const clubPlate = (url: string, size: number) => {
  const team = NFL_TEAMS.find((t) => t.logoUrl === url || url.includes(`/${t.abbreviation.toLowerCase()}.png`));
  const c = document.createElement('canvas');
  const s = Math.max(32, Math.min(512, Math.round(size * 2)));
  c.width = c.height = s;
  const g = c.getContext('2d');
  if (!g) return '';
  g.fillStyle = team ? `hsl(${team.primaryColor})` : '#1b2340';
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - s * 0.04, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = s * 0.06;
  g.strokeStyle = team ? `hsl(${team.secondaryColor})` : '#ffc93d';
  g.stroke();
  if (team) {
    g.fillStyle = '#fff';
    g.font = `800 ${Math.round(s * 0.34)}px "Barlow Condensed", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(team.abbreviation, s / 2, s / 2 + s * 0.02);
  }
  return c.toDataURL('image/png');
};

const isCrossOrigin = (src: string) => {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false;
  try {
    return new URL(src, location.href).origin !== location.origin;
  } catch {
    return false;
  }
};

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Inline every image of the poster as a data URL before the draw: cross-origin ones through CORS (or a club plate
 * when that fails), same-origin ones from the cache. html-to-image then has nothing left to fetch, and its wait for
 * each cloned image to load (which never ends for a lazy or empty image in WebKit) is skipped. SVG <image>s too.
 * The poster is a throwaway copy, so nothing is restored.
 */
const inlineImages = async (root: HTMLElement) => {
  const imgs = [...root.querySelectorAll('img')];
  const svgImages = [...root.querySelectorAll('image')];
  await Promise.all([
    ...imgs.map(async (img) => {
      img.loading = 'eager';
      const url = img.currentSrc || img.src;
      img.removeAttribute('srcset');
      if (url.startsWith('data:')) return;
      if (!/^(https?:|blob:)/.test(url)) {
        img.src = BLANK;
        return;
      }
      const data = await inlineUrl(url);
      img.src = data ?? (isCrossOrigin(url) ? clubPlate(url, img.width || img.naturalWidth || 64) : BLANK);
    }),
    ...svgImages.map(async (im) => {
      const url = im.href.baseVal;
      if (!url || url.startsWith('data:')) return;
      const data = await inlineUrl(new URL(url, location.href).href);
      im.href.baseVal = data ?? BLANK;
    }),
  ]);
};

/**
 * html-to-image copies computed styles onto HTML elements only: an SVG <text> styled by a class (the card art's
 * jersey numbers, chart labels) would lose its font in the picture. Write those font properties inline first.
 */
const inlineSvgText = (root: HTMLElement) => {
  for (const el of root.querySelectorAll<SVGElement>('svg text, svg tspan')) {
    const cs = getComputedStyle(el);
    el.style.fontFamily = cs.fontFamily;
    el.style.fontWeight = cs.fontWeight;
    el.style.fontStyle = cs.fontStyle;
    if (cs.letterSpacing && cs.letterSpacing !== 'normal') el.style.letterSpacing = cs.letterSpacing;
  }
};

export interface CaptureOptions {
  /** Output width in device pixels (the poster's CSS width is scaled to it) */
  width?: number;
  background?: string;
}

const loadImage = (src: string, timeout: number) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const t = window.setTimeout(() => reject(new Error('The picture took too long to draw')), timeout);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      reject(new Error('The picture could not be drawn'));
    };
    img.decoding = 'sync';
    img.src = src;
  });

type H2I = typeof import('html-to-image');
const fontCache = new Map<string, Promise<string>>();
/** Latin and Latin Extended subsets only (player names), never the Cyrillic, Greek or Vietnamese files. */
const LATIN = /unicode-range:\s*U\+(0|100)-/i;
/**
 * The @font-face rules the poster uses, with the font files inlined: built once per set of families and reused (the
 * slow part of a picture). html-to-image's own woff2 filter dropped `src` from some of WebKit's rules, so it is not
 * used; the subset filter here keeps the SVG small instead.
 */
const fontCss = (h2i: H2I, node: HTMLElement, opts: Parameters<H2I['getFontEmbedCSS']>[1]) => {
  const families = new Set<string>();
  const walk = (el: Element) => {
    getComputedStyle(el)
      .fontFamily.split(',')
      .forEach((f) => families.add(f.trim().replace(/["']/g, '')));
    for (const c of el.children) walk(c);
  };
  walk(node);
  const key = [...families].sort().join('|');
  let p = fontCache.get(key);
  if (!p) {
    p = h2i
      .getFontEmbedCSS(node, opts)
      .then((css) =>
        css
          .split(/(?=@font-face)/)
          .filter((rule) => !/unicode-range/i.test(rule) || LATIN.test(rule))
          .join('\n'),
      )
      .catch((e) => {
        fontCache.delete(key);
        throw e;
      });
    fontCache.set(key, p);
  }
  return p;
};

/** Draw a poster element to a PNG blob. */
export const capturePoster = async (node: HTMLElement, { width = 1080, background = '#090d1a' }: CaptureOptions = {}): Promise<Blob> => {
  const log = (m: string) => import.meta.env.DEV && console.info(`[share] ${m}`);
  const h2i = await import('html-to-image');
  await (document.fonts?.ready ?? Promise.resolve());
  await frame();
  await quietDom(node);
  log('quiet');
  await inlineImages(node);
  inlineSvgText(node);
  await imagesReady(node);
  log('images');
  settleAnimations(node);
  await frame();
  const box = node.getBoundingClientRect();
  const pixelRatio = Math.max(1, Math.min(4, width / Math.max(1, box.width)));
  const t0 = performance.now();
  const base = {
    pixelRatio,
    backgroundColor: background,
    // the poster's root is positioned by its stage; the picture starts at its own corner
    style: { margin: '0', transform: 'none' },
  };
  const opts = { ...base, fontEmbedCSS: await fontCss(h2i, node, base) };
  const t1 = performance.now();
  log('fonts ready');
  const svg = await h2i.toSvg(node, opts);
  log(`svg ${Math.round(svg.length / 1024)} KB`);
  const w = Math.round(box.width * pixelRatio);
  const h = Math.round(box.height * pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('No canvas');
  // WebKit decodes images inside an SVG image late: the first draw warms them, the second (a fresh image of the same
  // SVG, after a short pause) is the picture
  for (let pass = 0; pass < 2; pass++) {
    const img = await loadImage(svg, 15000);
    if (pass === 0) await sleep(120);
    g.fillStyle = background;
    g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
  }
  log(`fonts ${Math.round(t1 - t0)} ms, draw ${Math.round(performance.now() - t1)} ms`);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The picture could not be encoded'))), 'image/png'),
  );
};

/** A file name from a title: "Ty Lock" → "retro-vault-ty-lock.png". */
export const shareFileName = (...parts: (string | number | null | undefined)[]) =>
  `retro-vault-${parts
    .filter((p) => p != null && p !== '')
    .join('-')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.png`;

/** True when this browser can hand a picture to the system share sheet. */
export const canShareFiles = () => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Blob([''], { type: 'image/png' })], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
};

const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

/**
 * Open the share sheet with the picture (or download it). Call it straight from the tap handler with a ready blob:
 * everything before navigator.share is synchronous, so the tap's user activation still holds on iOS. Rejects with
 * NotAllowedError when the activation was lost (the caller asks for a second tap).
 */
export const shareImageBlob = (blob: Blob, fileName: string, title: string): Promise<ShareResult> => {
  const file = new File([blob], fileName, { type: 'image/png' });
  let shareable = false;
  try {
    shareable = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    shareable = false;
  }
  if (!shareable) {
    download(blob, fileName);
    return Promise.resolve('downloaded');
  }
  return navigator.share({ files: [file], title }).then(
    () => 'shared' as const,
    (e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled' as const;
      throw e;
    },
  );
};
