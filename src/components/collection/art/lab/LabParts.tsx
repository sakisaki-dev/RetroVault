import { createContext, memo, startTransition, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CardInfo } from '../../useCardPool';

/** The lab's scroll container (root for lazy cards), or null for the viewport. */
export const LabRootContext = createContext<HTMLElement | null>(null);

// ---------- Lazy: mount children only near the visible part of the lab ----------

/** Renders a placeholder of the same shape until the box comes within about 400px of the lab's visible area. */
export const Lazy = ({ ratio, children }: { ratio: string; children: ReactNode }) => {
  const root = useContext(LabRootContext);
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((es) => es.some((x) => x.isIntersecting) && setSeen(true), { root, rootMargin: '400px 100px' });
    io.observe(el);
    return () => io.disconnect();
  }, [root, seen]);
  return (
    <div ref={ref} className={cn('lab-lazy', !seen && 'lab-lazy--wait')} style={{ aspectRatio: ratio }}>
      {seen ? children : null}
    </div>
  );
};

// ---------- Chips (tier, finish, pack type…) ----------

interface ChipsProps<T extends string> {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}
export const Chips = <T extends string>({ label, value, options, onChange }: ChipsProps<T>) => (
  <div className="lab-chips" role="radiogroup" aria-label={label}>
    <span className="lab-chips__label">{label}</span>
    {options.map((o) => (
      <button
        key={o.key}
        type="button"
        role="radio"
        aria-checked={value === o.key}
        className={cn('lab-chip', value === o.key && 'is-on')}
        onClick={() => startTransition(() => onChange(o.key))}
      >
        {o.label}
      </button>
    ))}
  </div>
);

// ---------- Player picker ----------

interface PickerProps {
  players: CardInfo[];
  value: CardInfo | null;
  onPick: (c: CardInfo) => void;
}

/** Search every league player with a card (combobox: type, arrows, Enter). */
export const PlayerPicker = memo(({ players, value, onPick }: PickerProps) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const listId = useId();
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? players.filter((c) => c.player.name.toLowerCase().includes(s) || c.player.position.toLowerCase() === s || c.franchise.toLowerCase().includes(s)) : players;
    return list.slice(0, 40);
  }, [players, q]);
  const pick = (c: CardInfo) => {
    onPick(c);
    setQ('');
    setOpen(false);
  };
  return (
    <div className="lab-pick">
      <Search className="lab-pick__icon h-4 w-4" aria-hidden="true" />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits[hi] ? `${listId}-${hi}` : undefined}
        aria-label="Player"
        placeholder={value ? `${value.player.name} · ${value.player.position}` : 'Search players'}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setHi(0);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHi((h) => Math.min(hits.length - 1, h + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => Math.max(0, h - 1));
          } else if (e.key === 'Enter' && open && hits[hi]) {
            e.preventDefault();
            pick(hits[hi]);
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="lab-pick__list" aria-label="Players">
          {hits.length === 0 && <li className="lab-pick__none">No player matches</li>}
          {hits.map((c, i) => (
            <li
              key={c.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === hi}
              className={cn('lab-pick__opt', i === hi && 'is-hi')}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setHi(i)}
            >
              <b>{c.player.name}</b>
              <span>
                {c.player.position} · {c.franchise} · {c.ovr ?? '–'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
PlayerPicker.displayName = 'PlayerPicker';
