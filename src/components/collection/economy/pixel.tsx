import type { CSSProperties } from 'react';

/**
 * Pixel art for the rewards: sprites written as rows of characters, drawn as whole-pixel SVG rects (crisp edges, scaled
 * by whole steps like the tunnel's canvas), in the game's palette. The Pyro walkout's cannons and flame bursts live
 * here so the walkout (Walkout.tsx) and the Milestones preview draw exactly the same frames.
 */

type Ink = Record<string, string>;

/** Rows of characters to run-length rects ('.' is empty) */
const runs = (rows: string[]) => {
  const out: { x: number; y: number; w: number; c: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === c) w += 1;
      if (c !== '.') out.push({ x, y, w, c });
      x += w;
    }
  });
  return out;
};

export const PixelRows = ({ rows, ink, y = 0 }: { rows: string[]; ink: Ink; y?: number }) => (
  <>
    {runs(rows).map((r, i) => (
      <rect key={i} x={r.x} y={r.y + y} width={r.w} height={1} fill={ink[r.c]} />
    ))}
  </>
);

// ---------- Pyro: cannon and flame frames ----------

const COLS = 13;
const FLAME_H = 26;
const INK: Ink = {
  K: '#0b0f1a', // outline
  G: '#5b6785', // steel
  h: '#9aa6c4', // steel highlight
  D: '#2a3350', // base
  R: '#ffc83d', // rivet
  r: '#c8261c', // flame: red
  o: '#ff7a1f', // orange
  y: '#ffd23d', // yellow
  w: '#fff6d6', // white core
};
const CANNON = [
  '...KKKKKKK...',
  '..KGGGGGGGK..',
  '..KGhhhhhGK..',
  '...KGGGGGK...',
  '...KGGGGGK...',
  '..KKKKKKKKK..',
  '.KDDDDDDDDDK.',
  '.KDRDDDDDRDK.',
  'KKKKKKKKKKKKK',
];

/** Chunky flame columns: one height per column of the nine-wide column, for each of four frames */
const FRAMES: number[][] = [
  [7, 12, 17, 22, 26, 20, 16, 11, 6],
  [9, 14, 20, 24, 21, 25, 14, 12, 8],
  [6, 11, 18, 25, 23, 19, 17, 10, 7],
  [8, 15, 16, 21, 26, 22, 18, 9, 5],
];
/** Pixel sparks per frame: [x, y from the top of the sprite] */
const SPARKS: [number, number][][] = [
  [[1, 4], [11, 7], [6, 0]],
  [[0, 8], [10, 2], [3, 1]],
  [[12, 5], [2, 3], [7, 0]],
  [[1, 1], [11, 9], [9, 0]],
];

const flameRows = (heights: number[], sparks: [number, number][]): string[] => {
  const grid = Array.from({ length: FLAME_H }, () => Array<string>(COLS).fill('.'));
  heights.forEach((h, i) => {
    const x = i + 2;
    const dist = Math.abs(i - 4);
    for (let n = 0; n < h; n += 1) {
      const t = n / h;
      const c = t < 0.3 && dist <= 1 ? 'w' : t < 0.52 && dist <= 3 ? 'y' : t < 0.8 ? 'o' : 'r';
      grid[FLAME_H - 1 - n][x] = c;
    }
  });
  sparks.forEach(([x, y], i) => {
    if (grid[y]?.[x] === '.') grid[y][x] = i % 2 ? 'y' : 'o';
  });
  return grid.map((r) => r.join(''));
};
const FLAME_FRAMES = FRAMES.map((h, i) => flameRows(h, SPARKS[i]));

/**
 * One flame cannon: a steel barrel on a base with a column of flame above it (four hand-set frames swapped in steps).
 * `still` draws one frame (reduced motion, previews that don't move).
 */
export const PyroCannon = ({ className, still = false }: { className?: string; still?: boolean }) => (
  <svg className={className} viewBox={`0 0 ${COLS} ${FLAME_H + CANNON.length}`} shapeRendering="crispEdges" aria-hidden="true">
    <PixelRows rows={CANNON} ink={INK} y={FLAME_H} />
    {(still ? FLAME_FRAMES.slice(0, 1) : FLAME_FRAMES).map((rows, i) => (
      <g key={i} className={still ? undefined : 'px-fl'} style={{ '--i': i } as CSSProperties}>
        <PixelRows rows={rows} ink={INK} />
      </g>
    ))}
  </svg>
);

// ---------- Small shared bits ----------

/** A stepped pennant outline (whole-pixel notches) for clip-path, left-to-right swallowtail-free triangle */
export const PENNANT_CLIP =
  'polygon(0 0, 100% 42%, 100% 58%, 0 100%)';
