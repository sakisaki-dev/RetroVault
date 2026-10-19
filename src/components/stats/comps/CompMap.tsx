import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import type { Player } from '@/types/player';
import { SIM_MIN_GAMES } from '@/config/advanced';
import { isHallOfFamer } from '@/config/stats';
import { findNFLTeam } from '@/utils/nflTeams';
import TeamLogo from '../../brand/TeamLogo';
import { VIZ, usePrefersReducedMotion } from '../analytics/viz';
import { keyOf } from '../records';
import { dotColors } from './compColors';
import type { SimilarityMap } from './compModel';

const GOLD = 'hsl(43 100% 62%)';
const MAX_ZOOM = 6;

interface Props {
  map: SimilarityMap;
  ovrMap: Map<string, number>;
  selectedKey: string;
  /** The selected player's top comps (highlighted connectors), best first. */
  topComps: { player: Player; similarity: number }[];
  overlayKey: string;
  onPick: (p: Player) => void;
  wide: boolean;
  /** Zoom in on the selected player (and re-centre whenever he changes). Omit for the whole-position view. */
  focusZoom?: number;
}

interface View {
  k: number;
  tx: number;
  ty: number;
}

const radiusFor = (ovr: number | undefined, wide: boolean) => {
  const t = ovr == null ? 0.25 : Math.max(0, Math.min(1, (ovr - 55) / 40));
  return (wide ? 4 : 3.2) + t * (wide ? 8 : 6);
};

const ZoomButton = ({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-night/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-40"
  >
    {children}
  </button>
);

/** 2-D similarity map of one position: dots that sit close together play alike. Drag to pan, pinch / ctrl+wheel / buttons to zoom. */
const CompMap = ({ map, ovrMap, selectedKey, topComps, overlayKey, onPick, wide, focusZoom }: Props) => {
  const reduced = usePrefersReducedMotion();
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const W = wide ? 1100 : 360;
  const H = wide ? 540 : 470;
  const pad = wide ? 40 : 24;

  const layout = useMemo(() => {
    // Phones: rotate a quarter turn (distances unchanged) so the long axis runs down the tall box.
    const raw = map.points.map((p) => (wide ? { x: p.x, y: p.y } : { x: p.y, y: 1 - p.x }));
    const xs = raw.map((r) => r.x);
    const ys = raw.map((r) => r.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX || 1;
    const spanY = Math.max(...ys) - minY || 1;
    const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
    const offX = (W - spanX * scale) / 2;
    const offY = (H - spanY * scale) / 2;
    const pts = map.points.map((p, i) => {
      const ovr = ovrMap.get(keyOf(p.player));
      return { ...p, key: keyOf(p.player), px: offX + (raw[i].x - minX) * scale, py: offY + (raw[i].y - minY) * scale, ovr, r: radiusFor(ovr, wide) };
    });
    // Deterministic collision relaxation: nudge overlapping dots apart (small moves; neighbourhoods are kept).
    const gap = wide ? 2.5 : 1.5;
    for (let it = 0; it < 80; it++) {
      let moved = false;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          let dx = b.px - a.px;
          let dy = b.py - a.py;
          let d = Math.hypot(dx, dy);
          const need = a.r + b.r + gap;
          if (d >= need) continue;
          if (d < 1e-6) {
            const ang = ((i * 7 + j * 13) % 360) * (Math.PI / 180);
            dx = Math.cos(ang);
            dy = Math.sin(ang);
            d = 1;
          }
          const push = (need - d) / 2 / d;
          a.px -= dx * push;
          a.py -= dy * push;
          b.px += dx * push;
          b.py += dy * push;
          moved = true;
        }
      }
      pts.forEach((p) => {
        p.px = Math.max(p.r + 4, Math.min(W - p.r - 4, p.px));
        p.py = Math.max(p.r + 4, Math.min(H - p.r - 4, p.py));
      });
      if (!moved) break;
    }
    return pts;
  }, [map, ovrMap, wide, W, H, pad]);

  // Reset the view when the position, mode or layout size changes (or centre on the selected player when focused).
  useEffect(() => {
    const p = focusZoom ? layout.find((x) => x.key === selectedKey) : undefined;
    setView(p && focusZoom ? clampView({ k: focusZoom, tx: -(p.px - W / 2) * focusZoom, ty: -(p.py - H / 2) * focusZoom }) : { k: 1, tx: 0, ty: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, wide, focusZoom, focusZoom ? selectedKey : '']);

  const clampView = (v: View): View => {
    const k = Math.max(1, Math.min(MAX_ZOOM, v.k));
    const mx = ((k - 1) * W) / 2 + 40 * (k - 1);
    const my = ((k - 1) * H) / 2 + 40 * (k - 1);
    return { k, tx: Math.max(-mx, Math.min(mx, v.tx)), ty: Math.max(-my, Math.min(my, v.ty)) };
  };
  const zoomAt = (factor: number, sx = W / 2, sy = H / 2) =>
    setView((v) => {
      const k = Math.max(1, Math.min(MAX_ZOOM, v.k * factor));
      const f = k / v.k;
      return clampView({ k, tx: sx - W / 2 - (sx - W / 2 - v.tx) * f, ty: sy - H / 2 - (sy - H / 2 - v.ty) * f });
    });
  const sx = (px: number) => (px - W / 2) * view.k + W / 2 + view.tx;
  const sy = (py: number) => (py - H / 2) * view.k + H / 2 + view.ty;

  // Keep the selected player in view when zoomed in.
  useEffect(() => {
    setView((v) => {
      if (v.k === 1) return v;
      const p = layout.find((x) => x.key === selectedKey);
      if (!p) return v;
      const x = (p.px - W / 2) * v.k + W / 2 + v.tx;
      const y = (p.py - H / 2) * v.k + H / 2 + v.ty;
      if (x > 30 && x < W - 30 && y > 30 && y < H - 30) return v;
      return clampView({ k: v.k, tx: -(p.px - W / 2) * v.k, ty: -(p.py - H / 2) * v.k });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, layout]);

  // Pointer pan + pinch zoom; trackpad pinch / ctrl+wheel zoom (plain wheel scrolls the page).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);
  const toSvg = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return { x: 0, y: 0 };
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  };
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.01), ((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, toSvg(e.clientX, e.clientY));
    dragged.current = false;
  };
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = toSvg(e.clientX, e.clientY);
    if (pointers.current.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      if (!dragged.current && Math.hypot(dx, dy) < 4) return;
      if (view.k === 1 && e.pointerType === 'touch') return; // let the page scroll
      if (!dragged.current) svgRef.current?.setPointerCapture?.(e.pointerId);
      dragged.current = true;
      setView((v) => clampView({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.entries()].map(([id, p]) => (id === e.pointerId ? cur : p));
      const [pa, pb] = [...pointers.current.values()];
      const before = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      if (before > 0) zoomAt(after / before, (a.x + b.x) / 2, (a.y + b.y) / 2);
      dragged.current = true;
    }
    pointers.current.set(e.pointerId, cur);
  };
  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
  };

  const byKey = useMemo(() => new Map(layout.map((p) => [p.key, p])), [layout]);
  // Focus order: left to right, then top to bottom.
  const order = useMemo(() => [...layout].sort((a, b) => a.px - b.px || a.py - b.py), [layout]);
  const nnLines = useMemo(() => {
    const seen = new Set<string>();
    return layout.flatMap((p, i) => {
      if (p.nn < 0) return [];
      const id = [i, p.nn].sort((a, b) => a - b).join('-');
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id, a: p, b: layout[p.nn] }];
    });
  }, [layout]);

  const sel = byKey.get(selectedKey);
  const highlighted = topComps.map((c, rank) => ({ ...c, rank, pt: byKey.get(keyOf(c.player)) })).filter((c) => c.pt);
  const hover = hoverKey ? byKey.get(hoverKey) : undefined;
  const labelled = new Set([selectedKey, ...highlighted.map((h) => keyOf(h.player))]);

  // Names for the selected player and his top comps, greedily nudged up/down so they never overlap.
  const labels = (() => {
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const items = [...(sel ? [sel] : []), ...highlighted.map((h) => h.pt!)];
    return items.flatMap((p) => {
      const px = sx(p.px);
      const py = sy(p.py);
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) return [];
      const isSel = p.key === selectedKey;
      const right = px < W * 0.75;
      const size = wide ? (isSel ? 15 : 12.5) : isSel ? 12 : 10.5;
      const text = isSel || wide || view.k > 1.5 ? p.player.name : p.player.name.split(' ').slice(-1)[0];
      const width = text.length * size * (isSel ? 0.62 : 0.56);
      const x = px + (right ? 1 : -1) * (p.r + (isSel ? 15 : 6));
      const x0 = right ? x : x - width;
      const box = (y: number) => ({ x0, x1: x0 + width, y0: y - size, y1: y + 3 });
      const hits = (b: ReturnType<typeof box>) => placed.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
      let y = py + 4;
      for (let k = 1; k <= 12 && hits(box(y)); k++) y = py + 4 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (size + 3);
      y = Math.max(size + 2, Math.min(H - 4, y));
      placed.push(box(y));
      return [{ key: p.key, x, y, anchor: right ? ('start' as const) : ('end' as const), size, text, isSel, dotX: px + (right ? p.r : -p.r), dotY: py }];
    });
  })();

  const onKey = (e: KeyboardEvent, p: Player) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(p);
    }
  };

  const tip = hover && (() => {
    const fx = sx(hover.px) / W;
    const fy = sy(hover.py) / H;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
    return (
      <div
        role="tooltip"
        className="pointer-events-none absolute z-10 w-max max-w-[240px] rounded-md border border-line bg-popover/95 px-2.5 py-2 text-xs shadow-elevated backdrop-blur"
        style={{
          left: `${fx * 100}%`,
          top: `${fy * 100}%`,
          transform: `translate(${fx > 0.66 ? '-100%' : fx < 0.33 ? '0%' : '-50%'}, ${fy < 0.3 ? '16px' : 'calc(-100% - 16px)'})`,
        }}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {hover.player.team && <TeamLogo team={hover.player.team} size={18} decorative />}
          {hover.player.name}
          {isHallOfFamer(hover.player) && <span className="font-pixel text-[8px] text-gold">HOF</span>}
        </span>
        <span className="mt-0.5 block text-muted-foreground">
          {findNFLTeam(hover.player.team)?.fullName ?? hover.player.team ?? 'No team'}
          {hover.ovr != null && (
            <>
              {' · '}OVR <b className="text-chalk">{hover.ovr}</b>
            </>
          )}
          {hover.player.games < SIM_MIN_GAMES && <span className="text-gold"> · small sample</span>}
        </span>
        {hover.nn >= 0 && (
          <span className="mt-0.5 block text-muted-foreground">
            Top comp: <b className="text-chalk">{layout[hover.nn].player.name}</b> {Math.round(hover.nnScore)}%
          </span>
        )}
      </div>
    );
  })();

  const zoomed = view.k > 1.001;

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-line/60" style={{ background: 'radial-gradient(ellipse at center, rgba(57,135,229,0.07), transparent 70%)' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full select-none"
        style={{ touchAction: zoomed ? 'none' : 'pan-y', cursor: zoomed ? 'grab' : undefined }}
        role="group"
        aria-label={`Similarity map of ${layout.length} ${map.position}s. Closer dots play more alike. Tab through players, Enter selects.`}
        onMouseLeave={() => setHoverKey(null)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Nearest-neighbour web */}
        <g aria-hidden="true" stroke={VIZ.axis} strokeOpacity={0.55} strokeWidth={wide ? 1 : 0.8}>
          {nnLines.map((l) => (
            <line key={l.id} x1={sx(l.a.px)} y1={sy(l.a.py)} x2={sx(l.b.px)} y2={sy(l.b.py)} />
          ))}
        </g>
        {/* Selected player's top comps */}
        {sel && (
          <g aria-hidden="true">
            {highlighted.map((h) => {
              const isOverlay = keyOf(h.player) === overlayKey;
              return (
                <line
                  key={keyOf(h.player)}
                  x1={sx(sel.px)}
                  y1={sy(sel.py)}
                  x2={sx(h.pt!.px)}
                  y2={sy(h.pt!.py)}
                  stroke={GOLD}
                  strokeOpacity={isOverlay ? 0.95 : 0.6}
                  strokeWidth={isOverlay ? 2.8 : 1.7}
                  strokeDasharray={isOverlay ? undefined : '5 4'}
                />
              );
            })}
          </g>
        )}

        {/* Selected: pulsing halo */}
        {sel && (
          <g aria-hidden="true" pointerEvents="none">
            <circle cx={sx(sel.px)} cy={sy(sel.py)} r={sel.r + 9} fill={GOLD} fillOpacity={0.12} stroke={GOLD} strokeOpacity={0.5} strokeWidth={1.5}>
              {!reduced && (
                <>
                  <animate attributeName="r" values={`${sel.r + 6};${sel.r + 20};${sel.r + 6}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.18;0;0.18" dur="2s" repeatCount="indefinite" />
                </>
              )}
            </circle>
          </g>
        )}

        {/* Dots (focusable, left-to-right) */}
        {order.map((p) => {
          const r = p.r;
          const cx = sx(p.px);
          const cy = sy(p.py);
          const { fill, ring } = dotColors(p.player.team);
          const hof = isHallOfFamer(p.player);
          const isSel = p.key === selectedKey;
          const dim = sel && !isSel && !labelled.has(p.key) && p.key !== hoverKey;
          return (
            <g
              key={p.key}
              tabIndex={0}
              role="button"
              aria-pressed={isSel}
              aria-label={`${p.player.name}, ${findNFLTeam(p.player.team)?.abbreviation ?? p.player.team ?? 'no team'}${p.ovr != null ? `, OVR ${p.ovr}` : ''}${hof ? ', Hall of Famer' : ''}${p.nn >= 0 ? `. Top comp ${layout[p.nn].player.name} ${Math.round(p.nnScore)}%` : ''}`}
              className="cursor-pointer outline-none"
              onClick={() => {
                if (!dragged.current) onPick(p.player);
              }}
              onKeyDown={(e) => onKey(e, p.player)}
              onMouseEnter={() => setHoverKey(p.key)}
              onFocus={() => setHoverKey(p.key)}
              onBlur={() => setHoverKey((k) => (k === p.key ? null : k))}
            >
              <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
              {hof && <circle cx={cx} cy={cy} r={r + 2.8} fill="none" stroke={GOLD} strokeWidth={2} />}
              <circle cx={cx} cy={cy} r={r} fill={fill} stroke={ring} strokeWidth={1.2} opacity={dim ? 0.5 : 1} />
              {p.player.games < SIM_MIN_GAMES && <circle cx={cx} cy={cy} r={r} fill={VIZ.surface} opacity={0.45} />}
            </g>
          );
        })}

        {/* Decorations on top: selection, hover/focus ring, names */}
        <g aria-hidden="true" pointerEvents="none">
          {hover && <circle cx={sx(hover.px)} cy={sy(hover.py)} r={hover.r + 5} fill="none" stroke={VIZ.ink} strokeWidth={2} />}
          {sel && <circle cx={sx(sel.px)} cy={sy(sel.py)} r={sel.r + 6} fill="none" stroke={GOLD} strokeWidth={2.8} />}
          {labels.map((l) => (
            <g key={`lbl-${l.key}`}>
              {Math.abs(l.y - 4 - l.dotY) > 3 && (
                <line x1={l.dotX} y1={l.dotY} x2={l.anchor === 'start' ? l.x - 2 : l.x + 2} y2={l.y - 4} stroke={VIZ.muted} strokeOpacity={0.6} strokeWidth={0.8} />
              )}
              <text
                x={l.x}
                y={l.y}
                textAnchor={l.anchor}
                fontSize={l.size}
                fill={l.isSel ? GOLD : VIZ.ink}
                stroke={VIZ.surface}
                strokeWidth={3.5}
                paintOrder="stroke"
                className={l.isSel ? 'font-display font-bold uppercase' : 'font-semibold'}
              >
                {l.text}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {tip}
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <ZoomButton label="Zoom in" onClick={() => zoomAt(1.5)} disabled={view.k >= MAX_ZOOM}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </ZoomButton>
        <ZoomButton label="Zoom out" onClick={() => zoomAt(1 / 1.5)} disabled={!zoomed}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </ZoomButton>
        <ZoomButton label="Reset zoom" onClick={() => setView({ k: 1, tx: 0, ty: 0 })} disabled={!zoomed}>
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </ZoomButton>
      </div>
      {zoomed && <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-night/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{view.k.toFixed(1)}×</span>}
    </div>
  );
};

export default CompMap;
