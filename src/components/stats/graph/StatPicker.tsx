import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import type { Position } from '@/types/player';
import { POSITIONS } from '@/config/advanced';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GRAPH_STATS, STAT_BY_ID, STAT_GROUPS, type GraphStat } from './graphStats';

const fold = (s: string) => s.toLowerCase().replace(/[’']/g, '');

/** Word-prefix match over label, short label and id ("td" → TD%, Pass TD, Rec TD); plain substring ranks last. */
const matchStat = (value: string, search: string) => {
  const q = fold(search).trim();
  if (!q) return 1;
  const hay = fold(value);
  const tokens = hay.split(/[\s/()+·,.-]+/).filter(Boolean);
  const words = q.split(/\s+/);
  if (words.every((w) => tokens.some((t) => t.startsWith(w)))) return tokens[0]?.startsWith(words[0]) ? 1 : 0.7;
  return hay.includes(q) ? 0.3 : 0;
};

const posNote = (s: GraphStat) =>
  s.positions.length === POSITIONS.length ? 'All' : s.positions.length > 4 ? `${s.positions.length} pos` : s.positions.join(' ');

/**
 * Searchable stat combobox grouped by category, with each stat's positions and one-line definition. Stats that
 * share no position with `pairWith` (the other axis) are dimmed and marked, so dead-end pairs are visible up front.
 */
const StatPicker = ({
  id,
  label,
  value,
  onChange,
  pairWith,
  allowNone,
  compact,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Positions the other axis covers. */
  pairWith?: Position[];
  allowNone?: boolean;
  /** Phone axis bar: no definition line or group tag, so two pickers fit side by side */
  compact?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const current = value ? STAT_BY_ID.get(value) : undefined;
  const groups = useMemo(() => STAT_GROUPS.map((g) => ({ g, stats: GRAPH_STATS.filter((s) => s.group === g) })), []);
  const fits = (s: GraphStat) => !pairWith || s.positions.some((p) => pairWith.includes(p));

  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="flex gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-label={`${label}: ${current?.label ?? 'none'}`}
              className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-line bg-night/60 px-3 text-left hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {current ? (
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className={cn('truncate font-display font-bold uppercase tracking-wide text-foreground', compact ? 'text-[15px]' : 'text-base')}>{compact ? current.short : current.label}</span>
                  {!compact && <span className="shrink-0 font-pixel text-[8px] uppercase text-muted-foreground">{current.group}</span>}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">{allowNone ? 'None' : 'Pick a stat…'}</span>
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="z-[70] w-[min(400px,calc(100vw-1.5rem))] overflow-hidden border-line bg-popover p-0 shadow-elevated"
            align="start"
            sideOffset={6}
            collisionPadding={12}
          >
            <Command className="bg-popover" filter={matchStat}>
              <CommandInput placeholder="Search stats: td, yards, sacks…" className="h-11" aria-label={`Search ${label} stats`} />
              <CommandList className="max-h-[min(420px,55vh)] overscroll-contain">
                <CommandEmpty>No stat matches.</CommandEmpty>
                {groups.map(({ g, stats }) => (
                  <CommandGroup
                    key={g}
                    heading={g}
                    className="[&_[cmdk-group-heading]]:font-display [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gold/80"
                  >
                    {stats.map((s) => {
                      const ok = fits(s);
                      return (
                        <CommandItem
                          key={s.id}
                          value={`${s.label} ${s.short} ${s.id} ${s.group}`}
                          onSelect={() => {
                            onChange(s.id);
                            setOpen(false);
                          }}
                          className="flex cursor-pointer items-start gap-2 px-2 py-1.5 data-[selected=true]:bg-panel-2 data-[selected=true]:text-foreground"
                        >
                          <Check className={cn('mt-0.5 h-4 w-4 shrink-0 text-gold', s.id === value ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                          <span className={cn('min-w-0 flex-1', !ok && 'opacity-50')}>
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="font-semibold">{s.label}</span>
                              <span className="shrink-0 font-pixel text-[8px] uppercase text-muted-foreground">{posNote(s)}</span>
                            </span>
                            <span className="line-clamp-1 text-[11px] text-muted-foreground">
                              {!ok && <span className="text-flag">No shared position · </span>}
                              {s.definition}
                            </span>
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {allowNone && current && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Clear ${label}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line bg-night/60 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {current && !compact && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {current.definition}
          {current.lowerIsBetter && !/lower is better/i.test(current.definition) ? ' Lower is better.' : ''}
        </p>
      )}
    </div>
  );
};

export default StatPicker;
