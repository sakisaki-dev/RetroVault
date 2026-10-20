import { createContext, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';

/** What the preview pane shows for a clicked cell. */
export interface PreviewItem {
  id: string;
  title: string;
  /** Label rows: variant, finish, tier, pose, uniform… */
  facts: [string, string][];
  /** Width at zoom 1, in CSS px */
  base: number;
  /** Largest zoom (pixel art goes further than cards) */
  maxZoom: number;
  render: () => ReactNode;
}

/*
 * Selection lives outside React state, so clicking a cell re-renders only the preview pane and the two cells whose
 * "selected" flag changed, never the whole lab.
 */
let selected: PreviewItem | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const select = (item: PreviewItem | null) => {
  if (selected === item) return;
  selected = item;
  listeners.forEach((l) => l());
};
export const usePreview = () => useSyncExternalStore(subscribe, () => selected, () => null);
export const useIsSelected = (id: string) => useSyncExternalStore(subscribe, () => selected?.id === id, () => false);

/** The lab's scroll container (root for lazy rows), or null for the viewport. */
export const LabRootContext = createContext<HTMLElement | null>(null);

/**
 * Arrow-key navigation inside any element marked data-grid: Left / Right step through its [data-cell]s, Up / Down
 * move to the nearest cell in the row above / below (by layout, so it works for fixed matrices and wrapping tile
 * grids alike), Home / End jump to the ends. Roving tabindex: only the focused cell is in the tab order.
 */
export const onGridKey = (e: KeyboardEvent) => {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const cur = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
  const grid = cur?.closest<HTMLElement>('[data-grid]');
  if (!cur || !grid) return;
  const cells = [...grid.querySelectorAll<HTMLElement>('[data-cell]')];
  const i = cells.indexOf(cur);
  let next: HTMLElement | undefined;
  if (e.key === 'ArrowLeft') next = cells[i - 1];
  else if (e.key === 'ArrowRight') next = cells[i + 1];
  else if (e.key === 'Home') next = cells[0];
  else if (e.key === 'End') next = cells[cells.length - 1];
  else {
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const down = e.key === 'ArrowDown';
    const rows = cells
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      .filter(({ r: q }) => (down ? q.top >= r.bottom - 2 : q.bottom <= r.top + 2));
    if (rows.length) {
      const edge = down ? Math.min(...rows.map((x) => x.r.top)) : Math.max(...rows.map((x) => x.r.top));
      next = rows
        .filter((x) => Math.abs(x.r.top - edge) < 4)
        .sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx))[0]?.c;
    }
  }
  e.preventDefault();
  if (!next) return;
  cur.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
  next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};
