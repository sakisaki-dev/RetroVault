import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import PixelLoader from '@/components/ui/PixelLoader';

/**
 * The site's one "content on its way" slot. While `ready` is false it holds the space the content will take
 * (`minHeight`, so nothing below it jumps) and, after a ~180 ms grace (a quick load never shows it), the hopping pixel
 * football (ui/PixelLoader.tsx); when `ready` flips, the content cross-fades in (`rv-load-in`) where the loader was.
 * Use it where a hook returns null/undefined while a file is fetched, instead of rendering nothing.
 *
 *   <FootballLoader ready={!!board} minHeight={420} what="the leaders">…</FootballLoader>
 *
 * `hide` renders nothing once loading is over and there is nothing to show (a failed fetch), so an empty slot collapses.
 */
export const FootballLoader = ({
  ready,
  minHeight = 240,
  what,
  label,
  size = 'md',
  hide = false,
  className,
  children,
}: {
  ready: boolean;
  minHeight?: number | string;
  what?: string;
  label?: string;
  size?: 'sm' | 'md';
  hide?: boolean;
  className?: string;
  children?: ReactNode;
}) => {
  if (ready) return hide ? null : <div className={cn('rv-load-in', className)}>{children}</div>;
  return <PixelLoader label={label} what={what} size={size} minHeight={minHeight} className={cn('justify-start pt-[10vh]', className)} />;
};

export default FootballLoader;
