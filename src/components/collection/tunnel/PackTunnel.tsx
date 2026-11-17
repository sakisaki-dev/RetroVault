import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { useFieldArt } from '@/components/teamlab/fieldArt';
import { homeUniform } from '../art/sprite/uniforms';
import type { PackType } from '@/utils/collection';
import { drawTunnel, rgbOf, tunnelGeo, type TunnelGeo } from './drawTunnel';
import './tunnel.css';

/**
 * "Out of the tunnel" (owner approved the storyboard, 2026-11-16: "out the tunnel for the pack opening seems cool"):
 * the scene the whole pack opening plays in. A players' tunnel seen from inside (drawTunnel.ts: pixel art drawn once),
 * the stadium bright at its mouth (the game's crowd, stand front and turf painted to the coach's club, useFieldArt; a
 * CSS stand and turf in a build without the private sprites), a jumbotron over the crowd and camera flashes popping in
 * the stands. Everything that moves is transform / opacity on small elements: the light (a gradient over the canvas
 * that takes the beam's or the walkout's colour), the crowd bouncing harder with each better card, the flashes.
 *
 * The dialog positions the pack, the beam and the dealt cards against the mouth with the CSS variables this sets on
 * itself (--tn-mx, --tn-my, --tn-mw, --tn-mh, --tn-floor: the mouth in CSS pixels, and the floor line).
 */

export interface BoardText {
  top: string;
  bottom: string;
  /** Colour of the bottom line (a tier's colour) */
  tone?: string;
}

export interface TunnelHandle {
  /** Pops `n` camera flashes in the stands now */
  flash: (n: number) => void;
}

interface PackTunnelProps {
  type: PackType;
  /** The home club: the crowd, the stand front, the turf's sideline, the wall stripe and the floor runner wear its colours */
  club: string | null;
  /** The light pouring in from the stadium: a tier's colour, or null for the stadium's own white */
  light: string | null;
  /** How hard the light floods the tunnel (0 calm … 3 a walkout) */
  surge?: number;
  /** Crowd excitement, 0-4: how often flashes pop and how hard the crowd bounces */
  level: number;
  board: BoardText;
  reduced: boolean;
  /** Portfolio milestone theme (economy.ts MILESTONES): floodlights add the towers' cones, gold rush the gold */
  theme?: string;
  /** Sets the geometry variables on the dialog too (so the stage, beam and floor can read them) */
  onGeo?: (g: TunnelGeo & { cw: number; ch: number; st: number; sb: number }) => void;
}

/** Sign over the mouth per pack. */
const SIGN: Record<PackType, string> = {
  standard: 'Retro Vault',
  premium: 'Premium',
  elite: 'Elite',
  holo: 'Holo Showcase',
  perfect: '18–0',
  exchange: 'Legends',
};

/** Ambient flashes: ms between ticks and how many pop per tick, per crowd level. */
const AMBIENT: [number, number][] = [
  [1500, 1],
  [900, 1],
  [520, 2],
  [300, 2],
  [150, 3],
];

const MAX_FLASHES = 22;

const isLiteMode = () => {
  try {
    return document.documentElement.dataset.perf === 'lite';
  } catch {
    return false;
  }
};

const PackTunnel = forwardRef<TunnelHandle, PackTunnelProps>(({ type, club, light, surge = 0, level, board, reduced, theme, onGeo }, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [geo, setGeo] = useState<(TunnelGeo & { cw: number; ch: number; st: number; sb: number }) | null>(null);
  const art = useFieldArt(club ?? '', 'night');
  const kit = homeUniform(club ?? undefined);

  // Measure the scene; the geometry changes only when its size does
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!cw || !ch) return;
      // the safe areas (a Home Screen app on an iPhone): the mouth stays clear of the title, the floor of the home bar
      const st = probeRef.current?.offsetHeight ?? 0;
      const sb = probeRef.current?.offsetWidth ?? 0;
      setGeo((g) => (g && g.cw === cw && g.ch === ch && g.st === st && g.sb === sb ? g : { ...tunnelGeo(cw, ch, st), cw, ch, st, sb }));
    };
    measure();
    const ro = new ResizeObserver(() => {
      if (!raf) raf = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (geo) onGeo?.(geo);
  }, [geo, onGeo]);

  // Draw the tunnel once per size, pack and club
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !geo) return;
    c.width = geo.W;
    c.height = geo.H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const jersey = rgbOf(kit.jersey);
    const trim = rgbOf(kit.trim);
    drawTunnel(ctx, geo, {
      type,
      stripe: jersey,
      runner: jersey.map((v) => v * 0.78) as [number, number, number],
      runnerEdge: trim,
    });
  }, [geo, type, kit.jersey, kit.trim]);

  // Camera flashes: pop `n` in the stands (imperative: short-lived elements, removed when their animation ends)
  const flash = (n: number) => {
    const box = flashRef.current;
    if (!box || reduced) return;
    const lite = isLiteMode();
    const count = lite ? Math.ceil(n / 2) : n;
    for (let k = 0; k < count; k++) {
      if (box.childElementCount >= MAX_FLASHES) break;
      const f = document.createElement('i');
      f.className = Math.random() < 0.22 ? 'tn__flash tn__flash--big' : 'tn__flash';
      f.style.left = `${3 + Math.random() * 94}%`;
      f.style.top = `${4 + Math.random() * 86}%`;
      f.style.animationDelay = `${Math.round(Math.random() * 180)}ms`;
      f.addEventListener('animationend', () => f.remove(), { once: true });
      box.appendChild(f);
    }
  };
  const flashLatest = useRef(flash);
  flashLatest.current = flash;
  useImperativeHandle(ref, () => ({ flash: (n: number) => flashLatest.current(n) }), []);

  // Ambient flashes, more often as the crowd gets louder
  useEffect(() => {
    if (reduced) return;
    const [ms, n] = AMBIENT[Math.max(0, Math.min(4, level))];
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (Math.random() < 0.7) flashLatest.current(1 + Math.floor(Math.random() * n));
    }, ms);
    return () => window.clearInterval(id);
  }, [level, reduced]);

  const vars = geo
    ? ({
        '--tn-p': `${geo.P}px`,
        // the stadium's art is further away: one art pixel smaller
        '--tn-q': `${Math.max(2, geo.P - 1)}px`,
        '--tn-mx': `${geo.mx * geo.P}px`,
        '--tn-my': `${geo.my * geo.P}px`,
        '--tn-mw': `${geo.mw * geo.P}px`,
        '--tn-mh': `${geo.mh * geo.P}px`,
        '--tn-vx': `${geo.vx * geo.P}px`,
        '--tn-vy': `${geo.vy * geo.P}px`,
        '--tn-cw': `${geo.W * geo.P}px`,
        '--tn-ch': `${geo.H * geo.P}px`,
        '--tn-c1': kit.jersey,
        '--tn-c2': kit.trim,
        '--tn-light': light ?? 'hsl(45 100% 92%)',
      } as CSSProperties)
    : ({ '--tn-light': light ?? 'hsl(45 100% 92%)' } as CSSProperties);

  return (
    <div
      ref={rootRef}
      className={cn('tn', `tn--${type}`, `tn--lv${Math.max(0, Math.min(4, level))}`, `tn--surge${Math.max(0, Math.min(3, surge))}`, light && 'tn--lit', theme && `tn--theme-${theme}`, reduced && 'tn--rm', !geo && 'tn--measuring')}
      style={vars}
      aria-hidden="true"
    >
      {/* The stadium at the end of the tunnel */}
      <div className="tn__mouth">
        <span className="tn__sky" />
        <span className="tn__towers" />
        <div className={cn('tn__board', board.top.length + board.bottom.length > 26 && 'tn__board--long')}>
          <span key={`${board.top}|${board.bottom}`} className="tn__board-text">
            <b>{board.top}</b>
            <span style={board.tone ? { color: board.tone } : undefined}>{board.bottom}</span>
          </span>
        </div>
        <div className="tn__crowd">
          {art.crowd ? (
            <>
              <span className="tn__crowd-row tn__crowd-row--back" style={{ backgroundImage: `url(${art.crowd})` }} />
              <span className="tn__crowd-row" style={{ backgroundImage: `url(${art.crowd})` }} />
            </>
          ) : (
            <>
              <span className="tn__crowd-row tn__crowd-row--back tn__crowd-css" />
              <span className="tn__crowd-row tn__crowd-css" />
            </>
          )}
          <div ref={flashRef} className="tn__flashes" />
        </div>
        {art.stands ? <span className="tn__stands" style={{ backgroundImage: `url(${art.stands})` }} /> : <span className="tn__stands tn__stands-css" />}
        {art.turf ? <span className="tn__turf" style={{ backgroundImage: `url(${art.turf})` }} /> : <span className="tn__turf tn__turf-css" />}
        <span className="tn__bloom" />
      </div>
      <canvas ref={canvasRef} className="tn__walls" />
      <span ref={probeRef} className="tn__probe" />
      <span className="tn__sign">
        <span>{SIGN[type]}</span>
      </span>
      {/* Light from the stadium: a pool on the floor, a wash up the walls; takes the beam's colour */}
      <span className="tn__spill" />
      <span className="tn__wash" />
      <span className="tn__vignette" />
    </div>
  );
});
PackTunnel.displayName = 'PackTunnel';

export default memo(PackTunnel);
