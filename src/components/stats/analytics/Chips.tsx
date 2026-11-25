import type { ReactNode } from 'react';
import { Choice } from '@/components/controls';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** One pick of several (the Lab's position, metric and chart rows). Delegates to Choice: a segmented control for a few
 * short options, a select for a long list, so a row never wraps to several lines. */
const Chips = <T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Option<NoInfer<T>>[];
  value: T;
  onChange: (v: NoInfer<T>) => void;
  label: string;
  className?: string;
}) => <Choice label={label} value={value} onChange={onChange} options={options} className={className} />;

export default Chips;
