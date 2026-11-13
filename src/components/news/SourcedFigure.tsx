import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import type { StoryStat } from '@/utils/leagueContent';

/**
 * A card's big number with its label; its data source shows on hover (title) and on tap (a toggle under the figure),
 * so a phone can check it too. Used by Hot Takes and Did you know.
 */
export const SourcedFigure = ({ stat, className }: { stat: StoryStat; className?: string }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={cn('sf', className)}>
      <button
        type="button"
        className="sf__btn"
        title={stat.source ? `Source: ${stat.source}` : undefined}
        aria-expanded={stat.source ? open : undefined}
        aria-controls={stat.source ? id : undefined}
        onClick={() => stat.source && setOpen((o) => !o)}
      >
        <span className="sf__value">{stat.value}</span>
        <span className="sf__label">{stat.label}</span>
      </button>
      {stat.source && open && (
        <p id={id} className="sf__src">
          <span>Source</span> <code>{stat.source}</code>
        </p>
      )}
    </div>
  );
};

/** Every figure of a card with its source (the expanded body of a take) */
export const SourceList = ({ stats }: { stats: StoryStat[] }) =>
  stats.length ? (
    <ul className="sf-list" aria-label="Figures and sources">
      {stats.map((s) => (
        <li key={s.label}>
          <b>{s.value}</b> {s.label}
          <code>{s.source}</code>
        </li>
      ))}
    </ul>
  ) : null;
