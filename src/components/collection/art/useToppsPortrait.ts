import { useEffect, useMemo, useState } from 'react';
import type { GamePlayer } from '@/config/ovr';
import { bodyFor } from '@/config/bodyTypes';
import { nflSpriteFor, useGameSprites } from '@/utils/gameSprites';
import type { Uniform } from './sprite/uniforms';

/**
 * True only in a build with the owner's private sprites (vite.config.ts; never GitHub Actions). The public build keeps
 * the Topps card exactly as before (helmet-and-pads silhouette, the 100 x 108 art); this Mac's builds draw the printed
 * portrait in the rounder, taller frame.
 */
export const TOPPS_PORTRAIT = typeof __PRIVATE_SPRITES__ !== 'undefined' && __PRIVATE_SPRITES__;

export type PortraitState = { status: 'loading' } | { status: 'none' } | { status: 'ready'; url: string };

/**
 * The Topps printed portrait for a card (src/utils/toppsPortrait.ts): his NFL save sprite, the same pick as GameSprite
 * (his real sprite, else a stand-in template seeded by his key), in the card's own kit, `uniform` (the kit the pull
 * rolled, so an owned card never changes: the kit comes from the stored pull and the club from the card's snapshot).
 * Home on a club the save drew keeps the save's own drawing; any other kit paints the neutral one.
 * 'none' when this machine has no NFL sprites (or he is a real NFL legend: cards are league players only).
 */
export const useToppsPortrait = (player: GamePlayer, uniform: Uniform): PortraitState => {
  const sprites = useGameSprites();
  const key = `${player.position}:${player.name}`;
  const job = useMemo(() => {
    const nfl = sprites?.nfl;
    if (!TOPPS_PORTRAIT || !nfl || player.isRealLegend) return null;
    const looks = sprites?.looks ?? sprites?.regular?.skins;
    const locked = looks?.[player.name]?.skin;
    const tone = typeof locked === 'string' ? locked : player.spriteSkin;
    const home = uniform.id === 'home';
    // home: his club's kit as the save drew it (else the neutral kit, painted below); other kits: the neutral kit
    const pick = home ? nflSpriteFor(nfl, key, player.team, player.team, 'idle', false, tone, 1) : nflSpriteFor(nfl, key, undefined, undefined, 'idle', false, tone, 1);
    if (!pick) return null;
    const body = bodyFor(key, looks?.[player.name]);
    const paint = pick.paint || pick.kit === 'neutral';
    return { src: pick.src, uniform: paint ? uniform : undefined, rows: body.rows, cols: body.cols, cx: pick.cx, foot: pick.foot };
  }, [sprites, key, player.name, player.team, player.spriteSkin, player.isRealLegend, uniform]);

  const jobKey = job ? `${job.src}|${job.uniform ? JSON.stringify(job.uniform) : ''}|${job.rows},${job.cols}|${job.cx},${job.foot}` : '';
  const [out, setOut] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!job) return;
    let live = true;
    import('@/utils/toppsPortrait')
      .then((m) => m.toppsPortrait(job))
      .then((url) => live && setOut({ key: jobKey, url }))
      .catch(() => live && setOut({ key: jobKey, url: null }));
    return () => {
      live = false;
    };
    // jobKey stands for job
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobKey]);

  if (!TOPPS_PORTRAIT) return { status: 'none' };
  // sprites still loading: hold the window empty rather than flash the silhouette
  if (!sprites?.nfl) return sprites ? { status: 'none' } : { status: 'loading' };
  if (!job) return { status: 'none' };
  if (!out || out.key !== jobKey) return { status: 'loading' };
  return out.url ? { status: 'ready', url: out.url } : { status: 'none' };
};

// ---------- Ink colours for the duotone (the SVG filter needs numbers) ----------

type RGB = [number, number, number];

const hsl = (h: number, s: number, l: number): RGB => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};

/**
 * A palette colour as sRGB 0-255: hex, hsl(h s% l%) and color-mix(in srgb, A p%, B), the forms the card palette uses
 * (shared.ts paletteFor). Null for anything else.
 */
export const rgbOfCss = (c: string): RGB | null => {
  const s = c.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (m) return hsl(((Number(m[1]) % 360) + 360) % 360, Number(m[2]), Number(m[3]));
  const mix = s.match(/^color-mix\(\s*in srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+)\)$/i);
  if (mix) {
    const a = rgbOfCss(mix[1]);
    const b = rgbOfCss(mix[3]);
    const p = Number(mix[2]) / 100;
    return a && b ? [a[0] * p + b[0] * (1 - p), a[1] * p + b[1] * (1 - p), a[2] * p + b[2] * (1 - p)] : null;
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
};

/** feFuncR/G/B tableValues mapping black → `dark` and white → `light`. */
export const duotoneTables = (dark: string, light: string): [string, string, string] => {
  const d = rgbOfCss(dark) ?? [20, 24, 40];
  const l = rgbOfCss(light) ?? [244, 234, 210];
  return [0, 1, 2].map((i) => `${(d[i] / 255).toFixed(3)} ${(l[i] / 255).toFixed(3)}`) as [string, string, string];
};

const luminance = ([r, g, b]: RGB) => {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/**
 * The pennant's text ink on its fill: the card's deep ink when it reads at 4.5:1 on the fill (light trims), else cream
 * (dark trims: Eagles, Steelers, Bucs), whichever contrasts more when neither reaches it.
 */
export const pennantInk = (fill: string, deep: string, cream = '#f4ead2'): string => {
  const f = rgbOfCss(fill);
  const d = rgbOfCss(deep);
  const c = rgbOfCss(cream);
  if (!f || !d || !c) return deep;
  const cd = contrast(f, d);
  if (cd >= 4.5) return deep;
  return contrast(f, c) >= cd ? cream : deep;
};
