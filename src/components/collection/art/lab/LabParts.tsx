import { memo, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, X, ZoomIn } from 'lucide-react';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { cn } from '@/lib/utils';
import type { CardInfo } from '../../useCardPool';
import { LabRootContext, select, useIsSelected, usePreview, type PreviewItem } from './labStore';

// ---------- Lazy: mount children only near the visible part of the lab ----------

/** Renders a placeholder of the same shape until the box comes within ~1.5 screens of the lab's visible area. */
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
    const io = new IntersectionObserver((es) => es.some((x) => x.isIntersecting) && setSeen(true), { root, rootMargin: '600px 200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [root, seen]);
  return (
    <div ref={ref} className={cn('lab-lazy', !seen && 'lab-lazy--wait')} style={{ aspectRatio: ratio }}>
      {seen ? children : null}
    </div>
  );
};

// ---------- Cell: one clickable, focusable preview target ----------

interface CellProps {
  item: PreviewItem;
  /** First cell of its grid (the one in the tab order until arrows move focus) */
  first?: boolean;
  ratio: string;
  caption?: ReactNode;
  role?: 'gridcell';
  children: ReactNode;
}

/** A grid cell: click / Enter / Space shows it in the preview pane. Re-renders only when its own selection flips. */
export const Cell = memo(({ item, first, ratio, caption, role, children }: CellProps) => {
  const on = useIsSelected(item.id);
  const open = () => select(item);
  return (
    <div
      data-cell
      role={role ?? 'button'}
      tabIndex={first ? 0 : -1}
      aria-label={`${item.title}. ${item.facts.map(([k, v]) => `${k} ${v}`).join(', ')}. Show in preview`}
      aria-selected={role ? on : undefined}
      aria-pressed={role ? undefined : on}
      className={cn('lab-cell', on && 'is-on')}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <Lazy ratio={ratio}>{children}</Lazy>
      {caption && <span className="lab-cell__cap">{caption}</span>}
    </div>
  );
});
Cell.displayName = 'Cell';

// ---------- Preview pane ----------

/** The big preview: the selected cell at a zoom the viewer picks (pixel art stays crisp), with its full label. */
const SHEET_QUERY = '(max-width: 1023px)';
/** True while the preview is a bottom sheet (phones and tablets), not the desktop side pane */
const useSheetLayout = () => {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(SHEET_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(SHEET_QUERY);
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return on;
};

export const PreviewPane = () => {
  const item = usePreview();
  const [zoom, setZoom] = useState(1);
  const zoomId = useId();
  const sheet = useSheetLayout();
  // On phones the preview is a bottom sheet: swipe it down (from its handle, or anywhere once scrolled to the top)
  const swipeRef = useSwipeToDismiss<HTMLElement>({ onDismiss: () => select(null), enabled: sheet && !!item });
  // Each new item opens at 1×
  useEffect(() => setZoom(1), [item?.id]);
  return (
    <aside ref={swipeRef} className={cn('lab-pv', item && 'lab-pv--open')} aria-label="Preview" aria-live="polite">
      {!item ? (
        <p className="lab-pv__empty">Click any card, helmet or uniform to see it large here. Arrow keys move, Enter previews.</p>
      ) : (
        <>
          <div className="lab-pv__grab" data-swipe-handle aria-hidden="true">
            <span />
          </div>
          <div className="lab-pv__head" data-swipe-handle>
            <h3 className="lab-pv__title">{item.title}</h3>
            <button type="button" className="lab-pv__close" onClick={() => select(null)} aria-label="Close preview">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <dl className="lab-pv__facts">
            {item.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="lab-pv__zoom">
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
            <label htmlFor={zoomId} className="sr-only">
              Zoom
            </label>
            <input
              id={zoomId}
              type="range"
              data-no-swipe
              min={1}
              max={item.maxZoom}
              step={0.5}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <output htmlFor={zoomId}>{zoom.toFixed(1)}×</output>
          </div>
          <div className="lab-pv__stage" data-no-swipe>
            <div className="lab-pv__art" style={{ width: item.base * zoom }}>
              {item.render()}
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

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
