import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { fmtCoins } from '@/utils/cardMarket';
import { squarify } from './treemap';
import { changeText, dirOf, type MarketRow } from './marketRows';

const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
const GAP = 2;
const HEAD = 16;

/** Tile fill: green up / red down, deeper with the size of the move (capped at ±30%); grey when flat. */
const fill = (change: number): CSSProperties => {
  const t = Math.min(1, Math.abs(change) / 0.3);
  const d = dirOf(change);
  if (d === 'flat') return { background: 'hsl(226 22% 24%)' };
  return d === 'up' ? { background: `hsl(149 ${45 + 20 * t}% ${20 + 14 * t}%)` } : { background: `hsl(354 ${50 + 20 * t}% ${24 + 12 * t}%)` };
};

/**
 * Finviz-style heatmap: one block per position, a tile per card; tile area = card value, colour = change over the
 * period, and every tile that fits also prints its name and ▲/▼ change (all tiles carry it in their label).
 */
const Heatmap = ({ rows, onOpen }: { rows: MarketRow[]; onOpen: (r: MarketRow) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!box.w || !box.h) return [];
    const groups = POS_ORDER.map((pos) => ({ pos, list: rows.filter((r) => r.info.player.position === pos) })).filter((g) => g.list.length);
    const total = (g: { pos: string; list: MarketRow[] }) => g.list.reduce((a, r) => a + r.value, 0);
    return squarify(groups, total, { x: 0, y: 0, w: box.w, h: box.h }).map((g) => {
      const inner = { x: g.x + GAP, y: g.y + HEAD, w: Math.max(0, g.w - GAP * 2), h: Math.max(0, g.h - HEAD - GAP) };
      return { ...g, tiles: squarify(g.item.list, (r) => r.value, inner) };
    });
  }, [rows, box]);

  return (
    <div ref={ref} className="mk-heat" role="group" aria-label="Heatmap of card values by position: tile size is value, colour is change">
      {layout.map((g) => (
        <div key={g.item.pos} className="contents">
          <span className="mk-heat__group" style={{ left: g.x, top: g.y, width: g.w, height: g.h }} aria-hidden="true">
            <span className="mk-heat__pos">{g.item.pos}</span>
          </span>
          {g.tiles.map((t) => {
            const r = t.item;
            const label = `${r.info.player.name}, ${r.info.player.position}: ${fmtCoins(r.value)} coins, ${changeText(r.change)}`;
            return (
              <button
                key={r.key}
                type="button"
                className="mk-heat__tile"
                style={{ left: t.x + 1, top: t.y + 1, width: Math.max(0, t.w - 2), height: Math.max(0, t.h - 2), ...fill(r.change) }}
                aria-label={label}
                title={label}
                onClick={() => onOpen(r)}
              >
                <span className="mk-heat__name">{r.info.player.name.split(' ').slice(-1)[0]}</span>
                <span className="mk-heat__chg">{changeText(r.change)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default Heatmap;
