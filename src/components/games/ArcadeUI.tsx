import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { NFLTeam } from '@/utils/nflTeams';

const t1 = (n: number, d: number) => (d ? Number(n.toFixed(d)) : n);

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Scoreboard lamp: black pill with gold pixel text. */
export const Lamp = ({ label, value, live = false, flicker = false }: { label: ReactNode; value?: ReactNode; live?: boolean; flicker?: boolean }) => (
  <span className={cn('lamp', flicker && 'flicker')} aria-live={live ? 'polite' : undefined}>
    {label}
    {value != null && <b className="num">{value}</b>}
  </span>
);

export const LampRow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('lamps', className)}>{children}</div>
);

type BtnTone = 'go' | 'green' | 'red' | 'sky' | 'ghost' | 'plain';

/** Chunky arcade button (0 4px 0 shadow). */
export const ArcadeButton = ({
  tone = 'plain',
  wide = false,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BtnTone; wide?: boolean }) => (
  <button type={type} className={cn('btn', tone !== 'plain' && tone, wide && 'wide', className)} {...rest} />
);

interface ChipOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

/** Toggle-chip group (aria-pressed buttons) for position / pool pickers. */
export const ChipGroup = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ChipOption<T>[];
  onChange: (v: T) => void;
}) => (
  <div className="chips" role="group" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className="chip"
        aria-pressed={o.value === value}
        disabled={o.disabled}
        title={o.title}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/** Number that counts up from 0 when it mounts or changes. */
export const CountUp = ({
  value,
  duration,
  decimals = 0,
  suffix = '',
  format,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  format?: (n: number) => string;
}) => {
  const dur = duration ?? 650 + Math.min(500, String(Math.round(value)).length * 80);
  const show = format ?? ((n: number) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix);
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const v = value * (1 - (1 - t) ** 3);
      setShown(decimals ? v : Math.round(v));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur, decimals]);
  return <>{show(t1(shown, decimals))}</>;
};

/** End-of-round strip: big score, verdict, action. */
export const ResultPanel = ({ score, verdict, detail, action }: { score: ReactNode; verdict: ReactNode; detail?: ReactNode; action?: ReactNode }) => (
  <div className="result" role="status">
    <div>
      <div className="big">{score}</div>
      <div className="verdict">{verdict}</div>
      {detail && <div className="hint">{detail}</div>}
    </div>
    {action}
  </div>
);

/** Progress dots ("player 2 of 5"). */
export const Dots = ({ total, current, doneAll = false }: { total: number; current: number; doneAll?: boolean }) => (
  <span className="flex gap-1.5" aria-hidden="true">
    {Array.from({ length: total }, (_, i) => (
      <span key={i} className={cn('dot', doneAll || i < current ? 'done' : i === current && 'on')} />
    ))}
  </span>
);

/** Real team logo from the ESPN CDN; hides itself if the image fails. */
export const TeamLogo = ({ team, className }: { team: NFLTeam | null | undefined; className?: string }) =>
  team ? (
    <img
      src={team.logoUrl}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={className}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  ) : null;

const CONFETTI_COLORS = ['#ffc83d', '#27b36a', '#ff4f61', '#5cc8ff', '#f1f4ff'];

/** Full-screen confetti burst whenever `fire` changes to a new truthy value. Skipped with reduced motion. */
export const Confetti = ({ fire }: { fire: number | false }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!fire || !c || reducedMotion()) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.hidden = false;
    const bits = Array.from({ length: 180 }, () => ({
      x: Math.random() * c.width,
      y: -20 - Math.random() * c.height * 0.5,
      v: 2 + Math.random() * 4,
      s: 4 + Math.floor(Math.random() * 5),
      c: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      d: Math.random() * 2 - 1,
    }));
    let frame = 0;
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      bits.forEach((b) => {
        b.y += b.v;
        b.x += b.d;
        ctx.fillStyle = b.c;
        ctx.fillRect(b.x, b.y, b.s, b.s);
      });
      if (++frame < 240) raf = requestAnimationFrame(draw);
      else c.hidden = true;
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      c.hidden = true;
    };
  }, [fire]);

  return <canvas ref={ref} hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 60 }} aria-hidden="true" />;
};
