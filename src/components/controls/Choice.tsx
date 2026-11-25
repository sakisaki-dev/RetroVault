import type { ReactNode } from 'react';
import { Segmented } from './Segmented';
import { Select } from './Select';
import './controls.css';

/**
 * Choice: one single-choice control that picks its own shape (the site's pattern for "pick one of these").
 *  - up to `segmentedMax` options (default 4), or up to 8 very short ones (positions): one segmented control that
 *    never wraps (Segmented).
 *  - anything longer: a select (Select) with the current value on the button, so the row stays one line.
 * Props: options [{value, label, title?, hint?}], value, onChange, label (accessible name), prefix? (small kicker shown
 * inside a select button), segmentedMax?, size?, club?, className?.
 */
export interface ChoiceOption<T extends string | number> {
  value: T;
  label: ReactNode;
  title?: string;
  hint?: ReactNode;
  /** plain text for type-ahead and the length rule when label is not a string */
  text?: string;
  disabled?: boolean;
}

const textOf = (o: ChoiceOption<string | number>) => o.text ?? (typeof o.label === 'string' || typeof o.label === 'number' ? String(o.label) : '');

export const fitsSegmented = (options: ChoiceOption<string | number>[], segmentedMax = 4) => {
  const n = options.length;
  const chars = options.reduce((s, o) => s + textOf(o).length, 0);
  if (n <= segmentedMax) return chars <= 26 || n <= 2;
  return n <= 8 && chars <= 20;
};

export const Choice = <T extends string | number>({
  options,
  value,
  onChange,
  label,
  prefix,
  segmentedMax = 4,
  size = 'sm',

  wrap,
  className,
}: {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  prefix?: ReactNode;
  segmentedMax?: number;
  size?: 'sm' | 'md';
  /** inside a sheet or popover: always chips that wrap (there is room, and a menu would clip) */
  wrap?: boolean;
  className?: string;
}) =>
  wrap || fitsSegmented(options as ChoiceOption<string | number>[], segmentedMax) ? (
    <Segmented
      label={label}
      size={size}
      wrap={wrap}
      className={className}
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
    />
  ) : (
    <Select
      label={label}
      prefix={prefix}
      className={className}
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o.value, label: o.label, hint: o.hint, text: textOf(o) }))}
    />
  );
export default Choice;
