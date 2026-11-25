import type { ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Adaptive } from './Adaptive';
import './controls.css';

/**
 * FilterSheet: the site's pattern for "narrow this list". One "Filters" chip (a count when something is active, plus an
 * optional one-line summary like "Reg · AFC") opens a bottom sheet on a phone and a popover on a desktop with the
 * grouped controls (FilterGroup); what is active shows as removable pills beside the chip. Props: title?, active
 * [{id, label, onClear}], onReset?, summary?, children (the groups), className?.
 */
export interface ActiveFilter {
  id: string;
  label: ReactNode;
  onClear: () => void;
}
export const FilterSheet = ({
  title = 'Filters',
  active,
  onReset,
  summary,
  children,
  className,
}: {
  title?: string;
  active: ActiveFilter[];
  onReset?: () => void;
  summary?: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={`ctl-row ${className ?? ''}`}>
    <Adaptive
      title={title}
      footer={
        <>
          {onReset && active.length > 0 && (
            <button type="button" className="ctl-link" onClick={onReset}>
              Reset
            </button>
          )}
        </>
      }
      trigger={(open) => (
        <button type="button" className={`ctl-btn${active.length ? ' is-on' : ''}`} aria-haspopup="dialog" aria-expanded={open}>
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{title}</span>
          {active.length > 0 && <span className="ctl-count">{active.length}</span>}
          {summary && <span className="ctl-sum">{summary}</span>}
        </button>
      )}
    >
      {children}
    </Adaptive>
    {active.map((a) => (
      <button key={a.id} type="button" className="ctl-pill" onClick={a.onClear} aria-label={`Remove filter: ${typeof a.label === 'string' ? a.label : a.id}`}>
        {a.label}
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    ))}
  </div>
);

/** A labelled group inside a FilterSheet or SettingsPopover. */
export const FilterGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="ctl-group">
    <div className="ctl-group__label">{label}</div>
    <div className="ctl-group__body">{children}</div>
  </div>
);
