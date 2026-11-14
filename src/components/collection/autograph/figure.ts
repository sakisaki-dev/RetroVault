import { useEffect, useMemo, useState } from 'react';
import type { AutographSnapshot } from '@/config/autographs';
import { bodyFor } from '@/config/bodyTypes';
import { faceFor, nflSpriteFor, useGameSprites, type GameSprites } from '@/utils/gameSprites';

/**
 * The player sprite an autograph is drawn around (owner approved, 2026-11-13: on-card full figure on the horizon,
 * sticker over his legs, gold inscription, patch portrait with a jersey swatch, sepia cut). Only in a build with the
 * owner's private sprites (vite.config.ts `__PRIVATE_SPRITES__`, never GitHub Actions): the public build keeps the
 * autograph art exactly as before and never asks for a sprite.
 *
 * Same source as GameSprite (src/utils/gameSprites.ts): his NFL save sprite, else a stand-in template seeded by his
 * key, standing, in his card club's home kit (an autograph has no kit roll), the neutral kit painted and the body
 * reshaped to his roll by gameKitPaint.ts processSprite; the regular game's recoloured sprite only when the save's
 * sprites are absent. Timeless: the club comes from the frozen snapshot, never live data.
 */
export const AUTOGRAPH_FIGURES = typeof __PRIVATE_SPRITES__ !== 'undefined' && __PRIVATE_SPRITES__;

/** A sprite image and the region of it to draw, with the figure's centre line and feet row in image pixels. */
export interface AutoSprite {
  img: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Centre line and the last row of his feet (figure only) */
  cx: number;
  foot: number;
  /** Image pixels per NFL sprite pixel (the regular game's sprites are a third the size) */
  unit: number;
}
export interface AutoFigure {
  /** Cache key part: which sprite and body this is */
  id: string;
  figure: AutoSprite;
  /** Head and shoulders, for the patch portrait */
  bust: AutoSprite;
}
export type FigureState = { status: 'loading' } | { status: 'none' } | { status: 'ready'; figure: AutoFigure };

/** The NFL sprite's head and shoulders, as GameSprite crops them: 32 x 36 from row 6, centred on his centre line. */
const BUST = { y: 6, w: 32, h: 36 };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('sprite'));
    img.src = src;
  });

const jobs = new Map<string, Promise<AutoFigure | null>>();
const JOBS_MAX = 200;

const resolveFigure = (sprites: GameSprites, snap: Pick<AutographSnapshot, 'name' | 'position' | 'team'>): { key: string; run: () => Promise<AutoFigure | null> } | null => {
  const key = `${snap.position}:${snap.name}`;
  const looks = sprites.looks ?? sprites.regular?.skins;
  const locked = looks?.[snap.name]?.skin;
  const tone = typeof locked === 'string' ? locked : undefined;
  const pick = nflSpriteFor(sprites.nfl, key, snap.team, snap.team, 'idle', false, tone, 1);
  if (pick) {
    const body = bodyFor(key, looks?.[snap.name]);
    const id = `nfl|${pick.src}|${pick.paint ?? ''}|${body.rows},${body.cols}`;
    return {
      key: id,
      run: () =>
        import('@/utils/gameKitPaint')
          .then((m) => m.processSprite(pick.src, { paint: pick.paint, rows: body.rows, cols: body.cols, cx: pick.cx, foot: pick.foot }))
          .then(loadImage)
          .then((img) => ({
            id,
            figure: { img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight, cx: pick.cx, foot: pick.foot, unit: 1 },
            // a taller body lifts the head by its extra rows: the crop follows the head
            bust: { img, sx: Math.round(pick.cx - BUST.w / 2), sy: BUST.y - body.rows, sw: BUST.w, sh: BUST.h, cx: BUST.w / 2, foot: BUST.h, unit: 1 },
          })),
    };
  }
  const r = sprites.regular;
  if (!r) return null;
  const face = faceFor({ name: snap.name, position: snap.position }, r.skins);
  const frame = r.art.bodyFrames(r, face, snap.team, 'stand')[0];
  const portrait = r.art.facePortrait(r, face, snap.team);
  if (!frame) return null;
  const id = `reg|${frame.src.length}|${snap.team}|${key}`;
  return {
    key: id,
    run: () =>
      Promise.all([loadImage(frame.src), loadImage(portrait.src)]).then(([fi, pi]) => ({
        id,
        figure: { img: fi, sx: 0, sy: 0, sw: frame.w, sh: frame.h, cx: frame.cx ?? frame.w / 2, foot: frame.foot ?? frame.h - 1, unit: 1 / 3 },
        bust: { img: pi, sx: 0, sy: 0, sw: portrait.w, sh: portrait.h, cx: portrait.w / 2, foot: portrait.h, unit: BUST.w / portrait.w },
      })),
  };
};

/** Loads (once, cached) the figure for a snapshot from the sprites this machine has; null when there is none. */
export const loadAutographFigure = (sprites: GameSprites, snap: Pick<AutographSnapshot, 'name' | 'position' | 'team'>): Promise<AutoFigure | null> => {
  const job = resolveFigure(sprites, snap);
  if (!job) return Promise.resolve(null);
  let p = jobs.get(job.key);
  if (!p) {
    p = job.run().catch(() => null);
    jobs.set(job.key, p);
    while (jobs.size > JOBS_MAX) jobs.delete(jobs.keys().next().value!);
  }
  return p;
};

/**
 * The figure for an autograph: 'loading' until the private sprites (and his sprite) are in, 'none' on the public build
 * or when this machine has no sprite for him, else the images to draw. Cached per sprite and body.
 */
export const useAutographFigure = (snap: AutographSnapshot): FigureState => {
  const sprites = useGameSprites();
  const { name, position, team } = snap;
  const job = useMemo(() => (AUTOGRAPH_FIGURES && sprites ? resolveFigure(sprites, { name, position, team }) : null), [sprites, name, position, team]);
  const [out, setOut] = useState<{ key: string; figure: AutoFigure | null } | null>(null);
  const key = job?.key ?? '';
  // sprites still loading: give up waiting after a while and draw the card without him
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!AUTOGRAPH_FIGURES || sprites) return;
    const t = window.setTimeout(() => setWaited(true), 2500);
    return () => window.clearTimeout(t);
  }, [sprites]);
  useEffect(() => {
    if (!job) return;
    let live = true;
    loadAutographFigure(sprites!, { name, position, team }).then((figure) => live && setOut({ key: job.key, figure }));
    return () => {
      live = false;
    };
    // key stands for job
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!AUTOGRAPH_FIGURES) return { status: 'none' };
  if (!sprites) return waited ? { status: 'none' } : { status: 'loading' };
  if (!job) return { status: 'none' };
  if (!out || out.key !== key) return { status: 'loading' };
  return out.figure ? { status: 'ready', figure: out.figure } : { status: 'none' };
};
