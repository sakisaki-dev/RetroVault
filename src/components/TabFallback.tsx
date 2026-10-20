import { Skeleton } from '@/components/ui/skeleton';

/** Shown for a moment while a tab's code chunk loads (pages/Index.tsx lazy-loads every tab). */
const TabFallback = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="container space-y-5 px-4 py-6 sm:px-6 sm:py-8" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    <Skeleton className="h-8 w-48 bg-panel/80" />
    <Skeleton className="h-4 w-72 max-w-full bg-panel/60" />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28 border border-line/50 bg-panel/60" />
      ))}
    </div>
  </div>
);

export default TabFallback;
