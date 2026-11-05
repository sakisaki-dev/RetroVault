import { FONTS } from '@/config/autographs';

/**
 * Lazy signature fonts. Nothing loads until the first autograph is drawn: then one Google Fonts stylesheet (the 36
 * signature families, @font-face rules only) is injected, and each family's file is fetched on demand with
 * document.fonts.load, so a binder of three players downloads three fonts. The card's own type (Barlow Condensed,
 * Barlow, JetBrains Mono) is already on the page (index.html); it is awaited the same way so the first draw is right.
 * Offline or blocked, everything resolves anyway and the card draws with fallback fonts.
 */

const HREF = `https://fonts.googleapis.com/css2?${FONTS.map((f) => `family=${f.name.replace(/ /g, '+')}`).join('&')}&display=swap`;
/** The card type the renderer uses (index.html already links these). */
export const CARD_FONTS = ['italic 800 40px "Barlow Condensed"', '800 26px "Barlow Condensed"', '600 18px "Barlow"', '700 22px "JetBrains Mono"'];
const TIMEOUT_MS = 5000;

let sheet: Promise<void> | null = null;
const ready = new Set<string>();
const pending = new Map<string, Promise<void>>();

const withTimeout = (p: Promise<unknown>) =>
  Promise.race([p.then(() => undefined), new Promise<void>((res) => window.setTimeout(res, TIMEOUT_MS))]).catch(() => undefined);

const loadSheet = () => {
  if (sheet) return sheet;
  sheet = new Promise<void>((resolve) => {
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = HREF;
      link.dataset.autographFonts = '';
      link.onload = () => resolve();
      link.onerror = () => resolve();
      document.head.appendChild(link);
      window.setTimeout(resolve, TIMEOUT_MS);
    } catch {
      resolve();
    }
  });
  return sheet;
};

/** True once this font spec (e.g. '40px "Allura"') has been awaited, so a draw now uses the real face. */
export const fontReady = (spec: string) => ready.has(spec);

/** Loads one font spec (the signature sheet first for a signature family); resolves even on failure. */
export const loadFont = (spec: string, text?: string, signature = true): Promise<void> => {
  if (ready.has(spec)) return Promise.resolve();
  const hit = pending.get(spec);
  if (hit) return hit;
  const p = (signature ? loadSheet() : Promise.resolve())
    .then(() => withTimeout(document.fonts?.load ? document.fonts.load(spec, text) : Promise.resolve()))
    .then(() => {
      ready.add(spec);
      pending.delete(spec);
    });
  pending.set(spec, p);
  return p;
};

/** Everything one autograph needs: his signature family and the card type. */
export const loadAutographFonts = (family: string, text: string) =>
  Promise.all([loadFont(`40px ${family}`, text), ...CARD_FONTS.map((f) => loadFont(f, undefined, false))]).then(() => undefined);
export const autographFontsReady = (family: string) => fontReady(`40px ${family}`) && CARD_FONTS.every(fontReady);
