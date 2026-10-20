/** Squarified treemap (Bruls et al.): lays `items` out in a w × h box, areas proportional to `size`. Pure. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const worst = (row: number[], side: number) => {
  const s = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
};

export const squarify = <T,>(items: T[], size: (t: T) => number, box: Rect): (Rect & { item: T })[] => {
  const list = items.filter((t) => size(t) > 0).sort((a, b) => size(b) - size(a));
  const total = list.reduce((a, t) => a + size(t), 0);
  if (!total) return [];
  const scale = (box.w * box.h) / total;
  const out: (Rect & { item: T })[] = [];
  let { x, y, w, h } = box;
  let i = 0;
  while (i < list.length) {
    const side = Math.min(w, h);
    const row: T[] = [list[i]];
    let areas = [size(list[i]) * scale];
    i++;
    while (i < list.length) {
      const next = [...areas, size(list[i]) * scale];
      if (worst(next, side) > worst(areas, side)) break;
      areas = next;
      row.push(list[i]);
      i++;
    }
    const sum = areas.reduce((a, b) => a + b, 0);
    if (w >= h) {
      // Column on the left
      const cw = sum / h;
      let cy = y;
      row.forEach((t, j) => {
        const ch = areas[j] / cw;
        out.push({ x, y: cy, w: cw, h: ch, item: t });
        cy += ch;
      });
      x += cw;
      w -= cw;
    } else {
      // Row on top
      const rh = sum / w;
      let cx = x;
      row.forEach((t, j) => {
        const rw = areas[j] / rh;
        out.push({ x: cx, y, w: rw, h: rh, item: t });
        cx += rw;
      });
      y += rh;
      h -= rh;
    }
  }
  return out;
};
