import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const KEY = (id: string) => `rv:howto:${id}`;

const readOpen = (id: string) => {
  try {
    return window.localStorage.getItem(KEY(id)) === '1';
  } catch {
    return false;
  }
};
const writeOpen = (id: string, open: boolean) => {
  try {
    if (open) window.localStorage.setItem(KEY(id), '1');
    else window.localStorage.removeItem(KEY(id));
  } catch {
    /* private mode / blocked storage: the disclosure just doesn't remember */
  }
};

interface Props {
  /** Stable id for the remembered open state (one per section). */
  id: string;
  /**
   * One short sentence built by a rule from the data the section shows (see stats/takeaways.ts). Never hand-written
   * per player. Omitted (null) when the data can't support one.
   */
  takeaway?: ReactNode;
  /** The method / how-to-read text, collapsed behind "How to read this". */
  children?: ReactNode;
  className?: string;
}

/**
 * Section lead for the Stats pages: the data's takeaway up front, the explainer behind a small "How to read this"
 * disclosure (collapsed by default; each section's choice is remembered in this browser).
 */
const SectionIntro = ({ id, takeaway, children, className }: Props) => {
  const [open, setOpen] = useState(() => readOpen(id));
  const panel = useId();
  return (
    <div className={cn('space-y-1', className)}>
      {takeaway && <p className="max-w-3xl text-sm font-medium text-secondary-foreground">{takeaway}</p>}
      {children && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panel}
            onClick={() => {
              setOpen((o) => {
                writeOpen(id, !o);
                return !o;
              });
            }}
            className="-ml-1 inline-flex min-h-[32px] items-center gap-1 rounded px-1 text-xs font-semibold text-muted-foreground hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold max-sm:min-h-10"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
            How to read this
          </button>
          <div id={panel} hidden={!open} className="max-w-3xl text-sm text-muted-foreground">
            {children}
          </div>
        </>
      )}
    </div>
  );
};

export default SectionIntro;
