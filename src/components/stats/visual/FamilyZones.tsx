import { X } from 'lucide-react';
import type { Player } from '@/types/player';
import type { Family, PositionFamilies } from '@/config/families';
import { isHallOfFamer } from '@/config/stats';
import { VIZ } from '../analytics/viz';
import { placeZoneLabels, type ZoneShape } from './zones';
import './familyZones.css';

/**
 * Family zones, shared by the similarity map (CompMap) and the Graph Builder scatter: the shaded regions (drawn
 * behind the dots), their labels (drawn on top, never colliding), and the legend + member list under the chart.
 * Families come from config/families.ts (rule-based, per position); this file only draws them.
 */

interface LayerProps {
  zones: ZoneShape[];
  fams: PositionFamilies;
  /** SVG transform from zone coordinates to the screen (pan / zoom); omit when they already match. */
  transform?: string;
  /** Highlighted family (hover or open), or null. */
  active: number | null;
  onHover: (id: number | null) => void;
  onOpen: (id: number) => void;
  /** Ignore the click that ends a drag. */
  isDrag?: () => boolean;
}

/** The shaded regions. Hovering one highlights its family; clicking opens its member list. */
export const FamilyZoneLayer = ({ zones, fams, transform, active, onHover, onOpen, isDrag }: LayerProps) => (
  <g className="fz-layer" transform={transform}>
    {zones.map((z) => {
      const f = fams.families[z.id];
      const on = active === z.id;
      const off = active != null && !on;
      return (
        <path
          key={z.id}
          d={z.d}
          className="fz-zone"
          fill={f.color}
          fillOpacity={on ? 0.2 : off ? 0.04 : 0.1}
          stroke={f.color}
          strokeOpacity={on ? 0.85 : off ? 0.15 : 0.45}
          strokeWidth={on ? 2 : 1.2}
          strokeDasharray={on ? undefined : '6 4'}
          vectorEffect="non-scaling-stroke"
          onMouseEnter={() => onHover(z.id)}
          onMouseLeave={() => onHover(null)}
          onClick={() => {
            if (!isDrag?.()) onOpen(z.id);
          }}
          style={{ cursor: 'pointer' }}
        >
          <title>{`${f.name} (${f.members.length}): ${f.definition}`}</title>
        </path>
      );
    })}
  </g>
);

/** Zone labels in screen coordinates, nudged apart. `toScreen` maps a zone centroid to the screen. */
export const FamilyZoneLabels = ({
  zones,
  fams,
  toScreen,
  W,
  H,
  active,
  small,
  dots = [],
}: {
  zones: ZoneShape[];
  fams: PositionFamilies;
  toScreen: (x: number, y: number) => [number, number];
  /** Dots in screen coordinates: a label avoids covering them when it can. */
  dots?: { x: number; y: number; r: number }[];
  W: number;
  H: number;
  active: number | null;
  small?: boolean;
}) => {
  const size = small ? 9.5 : 11;
  const items = zones
    .map((z) => {
      const [cx, cy] = toScreen(z.cx, z.cy);
      const top = toScreen(z.cx, z.top)[1];
      const bottom = toScreen(z.cx, z.bottom)[1];
      const f = fams.families[z.id];
      const text = f.name.toUpperCase();
      return { id: z.id, cx, cy, top: Math.min(top, bottom), bottom: Math.max(top, bottom), w: text.length * size * 0.66 + 14, h: size + 8, text, n: f.members.length };
    })
    .filter((it) => it.cx > -40 && it.cx < W + 40 && it.cy > -40 && it.cy < H + 40)
    .sort((a, b) => b.n - a.n || a.id - b.id);
  const placed = placeZoneLabels(items, dots, W, H);
  return (
    <g aria-hidden="true" pointerEvents="none">
      {placed.map((l) => {
        const it = items.find((x) => x.id === l.id)!;
        const f = fams.families[l.id];
        const off = active != null && active !== l.id;
        return (
          <g key={l.id} className="fz-zone" opacity={off ? 0.3 : 1}>
            <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={l.h / 2} fill={VIZ.surface} fillOpacity={0.82} stroke={f.color} strokeOpacity={0.9} strokeWidth={1.2} />
            <text x={l.x + l.w / 2} y={l.y + l.h / 2 + size * 0.36} textAnchor="middle" fontSize={size} fill={f.color} className="font-display font-bold" letterSpacing={0.6}>
              {it.text}
            </text>
          </g>
        );
      })}
    </g>
  );
};

const ordinal = (n: number) => {
  const t = n % 100;
  const suf = t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suf}`;
};

const Swatch = ({ color }: { color: string }) => (
  <span aria-hidden="true" className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full border" style={{ background: `${color}33`, borderColor: color }} />
);

/** Legend (with the Zones toggle) and, when a family is open, its members by Career Legacy. */
export const FamilyPanel = ({
  fams,
  zonesOn,
  onToggle,
  active,
  open,
  onHover,
  onOpen,
  onPick,
  pickLabel = 'Open his Deep Dive',
}: {
  fams: PositionFamilies;
  zonesOn: boolean;
  onToggle: (on: boolean) => void;
  active: number | null;
  open: number | null;
  onHover: (id: number | null) => void;
  onOpen: (id: number | null) => void;
  onPick: (p: Player) => void;
  pickLabel?: string;
}) => {
  const fam: Family | undefined = open != null ? fams.families[open] : undefined;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-pixel text-[9px] uppercase text-gold">Families</span>
          {'  '}
          {fams.families.length} {fams.position} families by play-style shape (rule-based clusters; level kept out of the names).
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
          <input type="checkbox" className="h-3.5 w-3.5 accent-[hsl(43_100%_62%)]" checked={zonesOn} onChange={(e) => onToggle(e.target.checked)} />
          Zones
        </label>
      </div>
      {zonesOn && (
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3" aria-label={`${fams.position} families`}>
          {fams.families.map((f) => {
            const on = active === f.id || open === f.id;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  aria-expanded={open === f.id}
                  className={`fz-legend flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${on ? 'bg-white/5' : 'border-line/60 hover:bg-white/5'}`}
                  style={on ? { borderColor: f.color } : undefined}
                  onMouseEnter={() => onHover(f.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(f.id)}
                  onBlur={() => onHover(null)}
                  onClick={() => onOpen(open === f.id ? null : f.id)}
                >
                  <Swatch color={f.color} />
                  <span className="min-w-0">
                    <span className="font-semibold text-foreground" style={{ color: f.color }}>
                      {f.name}
                    </span>
                    <span className="text-muted-foreground"> · {f.members.length}</span>
                    <span className="block text-muted-foreground">{f.definition}</span>
                    <span className="block text-[10px] text-muted-foreground/80">
                      Level: {ordinal(Math.round(f.levelPct))} percentile · avg Legacy {Math.round(f.avgLegacy).toLocaleString()}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {zonesOn && fam && (
        <div className="rounded-md border bg-night/60 p-2.5" style={{ borderColor: `${fam.color}88` }} role="region" aria-label={`${fam.name} members`}>
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <p className="text-xs">
              <b style={{ color: fam.color }}>{fam.name}</b>
              <span className="text-muted-foreground">
                {' '}
                · {fam.members.length} {fams.position}s · {fam.definition}. By Career Legacy; tap a name for his Deep Dive.
              </span>
            </p>
            <button type="button" aria-label="Close member list" className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" onClick={() => onOpen(null)}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <ol className="flex flex-wrap gap-1.5">
            {fam.members.map((p, i) => (
              <li key={p.name}>
                <button
                  type="button"
                  title={pickLabel}
                  className="flex items-center gap-1.5 rounded-full border border-line/70 bg-white/[0.03] px-2 py-0.5 text-xs hover:border-gold/60 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  onClick={() => onPick(p)}
                >
                  <span className="font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                  <span className="font-semibold">{p.name}</span>
                  {isHallOfFamer(p) && <span className="font-pixel text-[7px] text-gold">HOF</span>}
                  <span className="font-mono text-[10px] text-muted-foreground">{Math.round(p.careerLegacy).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
