import type { ReactNode } from 'react';

/** Floating tooltip inside a `relative` chart box. Flips left of the point past the middle. */
export const ChartTip = ({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) => {
  const left = x > width / 2;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-20 w-max max-w-[15rem] rounded-md border border-line bg-popover px-3 py-2 text-xs shadow-elevated"
      style={{
        top: Math.max(0, y - 8),
        left: left ? undefined : x + 14,
        right: left ? Math.max(0, width - x + 14) : undefined,
        transform: 'translateY(-100%)',
      }}
    >
      {children}
    </div>
  );
};

/** Legend swatch row (identity is never colour alone: each swatch has a text label, often a shape). */
export const Legend = ({ items, label = 'Legend' }: { items: { key: string; label: ReactNode; swatch: ReactNode }[]; label?: string }) => (
  <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary-foreground" aria-label={label}>
    {items.map((i) => (
      <li key={i.key} className="inline-flex items-center gap-1.5">
        {i.swatch}
        {i.label}
      </li>
    ))}
  </ul>
);
