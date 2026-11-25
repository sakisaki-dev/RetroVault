import type { ReactNode } from 'react';
import { Settings2 } from 'lucide-react';
import { Adaptive } from './Adaptive';
import './controls.css';

/**
 * SettingsPopover: the site's pattern for display settings (units, scale, theme, SZN / OVR). A small gear button with the
 * current values as its summary ("Active · SZN") opens the grouped rows (FilterGroup) in a popover, a bottom sheet on a
 * phone. Props: title?, summary (current values), children, align?, className?.
 */
export const SettingsPopover = ({
  title = 'Settings',
  summary,
  children,
  align = 'end',
  className,
}: {
  title?: string;
  summary?: string;
  children: ReactNode;
  align?: 'start' | 'end' | 'center';
  className?: string;
}) => (
  <Adaptive
    title={title}
    align={align}
    className={className}
    trigger={(open) => (
      <button type="button" className="ctl-btn" aria-haspopup="dialog" aria-expanded={open} aria-label={`${title}${summary ? `: ${summary}` : ''}`}>
        <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
        {summary ? <span className="ctl-sum ctl-sum--lead">{summary}</span> : <span>{title}</span>}
      </button>
    )}
  >
    {children}
  </Adaptive>
);
