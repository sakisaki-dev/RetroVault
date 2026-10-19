import type { CSSProperties } from 'react';
import { balancedCols } from './records';

/**
 * Balanced wrap grid: rows split as evenly as possible per breakpoint, and a short last row stretches to
 * fill, so there are never empty cells. Put `style={gridVars(n, …)}` on a `flex flex-wrap gap-3` parent
 * and GRID_ITEM on each child. `xl` defaults to `lg`.
 */
export const gridVars = (
  n: number,
  { base = 1, sm = 2, lg = 3, xl = lg }: { base?: number; sm?: number; lg?: number; xl?: number } = {},
) =>
  ({
    '--c-base': balancedCols(n, base),
    '--c-sm': balancedCols(n, sm),
    '--c-lg': balancedCols(n, lg),
    '--c-xl': balancedCols(n, xl),
  }) as CSSProperties;

export const GRID_ITEM =
  'min-w-0 grow basis-[calc(100%/var(--c-base)-0.75rem)] sm:basis-[calc(100%/var(--c-sm)-0.75rem)] lg:basis-[calc(100%/var(--c-lg)-0.75rem)] xl:basis-[calc(100%/var(--c-xl)-0.75rem)]';
