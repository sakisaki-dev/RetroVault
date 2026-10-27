import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { dur } from '@/utils/motion';

/**
 * Animated expander: the height eases open and shut (grid-template-rows 0fr → 1fr, .rv-collapse in index.css) and
 * the content fades. Children mount on open and unmount once the close has finished, so a closed panel costs nothing.
 */
const Collapse = ({ open, children, className, id }: { open: boolean; children: ReactNode; className?: string; id?: string }) => {
  const [mounted, setMounted] = useState(open);
  // Opening: mount closed for one frame, then flip to open so the transition runs
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let id = requestAnimationFrame(() => {
        id = requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), dur.slow + 40);
    return () => window.clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return (
    <div id={id} className={cn('rv-collapse', className)} data-open={shown}>
      <div>{children}</div>
    </div>
  );
};

export default Collapse;
