import { useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { usePhone } from '@/hooks/usePhone';
import { cn } from '@/lib/utils';

/** A trigger that opens its content as a bottom sheet on a phone and a popover from 640px. Internal to the controls. */
export const Adaptive = ({
  trigger,
  title,
  children,
  footer,
  align = 'start',
  className,
}: {
  trigger: (open: boolean) => ReactNode;
  title: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  footer?: ReactNode;
  align?: 'start' | 'end' | 'center';
  className?: string;
}) => {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const body = typeof children === 'function' ? children(() => setOpen(false)) : children;
  if (phone) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        {/* the trigger is a plain button so the sheet's own focus return works */}
        <span className="ctl-anchor" onClick={() => setOpen(true)}>{trigger(open)}</span>
        <SheetContent side="bottom" className="ctl-sheet">
          <SheetTitle className="ctl-sheet__title">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title} options</SheetDescription>
          <div className="ctl-body">{body}</div>
          {footer && <div className="ctl-foot">{footer}</div>}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span className="ctl-anchor">{trigger(open)}</span>
      </PopoverTrigger>
      <PopoverContent align={align} className={cn('ctl-pop', className)}>
        <div className="ctl-pop__title">{title}</div>
        <div className="ctl-body">{body}</div>
        {footer && <div className="ctl-foot">{footer}</div>}
      </PopoverContent>
    </Popover>
  );
};
