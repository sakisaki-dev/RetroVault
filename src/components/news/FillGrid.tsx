import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Spans that make a grid fill every row: with C columns and a last row of r < C cards, the grid gets C * r tracks, a
 * normal card spans r of them and a last-row card spans C, so 5 cards in 3 columns are 3 + 2 (the two spanning 1.5
 * columns each) and 7 in 3 are 3 + 3 + 1 (the last one full width). Pure, so it can be checked on its own.
 */
export const fillSpans = (count: number, cols: number): { tracks: number; spans: number[] } => {
  const c = Math.max(1, Math.floor(cols));
  if (count <= 0) return { tracks: c, spans: [] };
  if (c === 1 || count <= c) {
    // a single row: every card shares it
    const tracks = c === 1 ? 1 : count;
    return { tracks, spans: Array.from({ length: count }, () => 1) };
  }
  const r = count % c;
  if (r === 0) return { tracks: c, spans: Array.from({ length: count }, () => 1) };
  const tracks = c * r;
  const full = count - r;
  return { tracks, spans: Array.from({ length: count }, (_, i) => (i < full ? r : c)) };
};

/** Columns that fit a container of the measured width, each at least minW wide (at most max) */
export const useFillCols = (minW: number, max: number, gap: number) => {
  const ref = useRef<HTMLElement | null>(null);
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCols(Math.max(1, Math.min(max, Math.floor((el.clientWidth + gap) / (minW + gap)))));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minW, max, gap]);
  return [ref, cols] as const;
};

interface Props<T> {
  items: T[];
  /** the narrowest a card may get, and the most columns */
  minW: number;
  max?: number;
  gap?: number;
  as?: 'ul' | 'ol' | 'div';
  className?: string;
  /** `span` is the card's column span in `tracks`; `wide` is true when it spans a whole row of more than one column */
  render: (item: T, i: number, cell: { style: CSSProperties; wide: boolean; cols: number }) => ReactNode;
  label?: string;
}

/** A list whose cards always fill their rows (see fillSpans); recomputed from the container's own width */
export function FillGrid<T>({ items, minW, max = 3, gap = 12, as = 'ul', className, render, label }: Props<T>) {
  const [ref, cols] = useFillCols(minW, max, gap);
  const { tracks, spans } = fillSpans(items.length, Math.min(cols, Math.max(1, items.length)));
  const Tag = as as 'ul';
  return (
    <Tag
      ref={ref as never}
      aria-label={label}
      className={className}
      style={{ display: 'grid', gap, gridTemplateColumns: `repeat(${tracks}, minmax(0, 1fr))`, margin: 0, padding: 0, listStyle: 'none', minWidth: 0 }}
      data-cols={cols}
    >
      {items.map((it, i) => {
        const span = spans[i] ?? 1;
        return render(it, i, { style: { gridColumn: `span ${span}` }, wide: cols > 1 && span === tracks, cols });
      })}
    </Tag>
  );
}
