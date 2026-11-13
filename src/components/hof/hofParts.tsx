import { useId } from 'react';
import { cn } from '@/lib/utils';
import { tierClass, tierOf } from './hofUtils';
import './hof.css';

/** The 0-100 Hall of Fame Score as a small gold medal. */
export const ScoreMedal = ({ score, size = 'md', className }: { score: number; size?: 'sm' | 'md' | 'lg'; className?: string }) => {
  const dim = size === 'lg' ? 'h-16 w-16 text-3xl' : size === 'sm' ? 'h-8 w-8 text-base' : 'h-10 w-10 text-xl';
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full font-display font-extrabold italic leading-none tabular-nums text-night', dim, className)}
      style={{
        background: 'radial-gradient(circle at 32% 28%, hsl(45 100% 86%), hsl(43 100% 62%) 45%, hsl(36 90% 40%) 100%)',
        boxShadow: 'inset 0 0 0 2px hsl(36 80% 32% / 0.7), 0 2px 6px hsl(228 60% 3% / 0.6)',
      }}
      aria-label={`Hall of Fame Score ${score} of 100`}
      role="img"
    >
      <span aria-hidden="true">{score}</span>
    </span>
  );
};

/**
 * The score as a medal on a ribbon: a metallic coin in its tier's finish (diamond, gold, bronze) with two
 * V-cut ribbon tails. `size` is the coin's diameter in px; the tails hang about half a coin below it.
 */
export const MedalCoin = ({ score, size = 34, className }: { score: number; size?: number; className?: string }) => {
  const tail = Math.round(size * 0.55);
  const w = size;
  const h = size + tail;
  return (
    <span
      className={cn('hof-coin', tierClass(score), className)}
      style={{ width: w, height: h }}
      role="img"
      aria-label={`Hall of Fame Score ${score} of 100`}
    >
      <svg className="hof-coin__tails" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
        <polygon points={`${w * 0.2},${size * 0.6} ${w * 0.46},${size * 0.7} ${w * 0.38},${h} ${w * 0.29},${h - tail * 0.28} ${w * 0.16},${h - 2}`} fill="var(--hof-ribbon-a)" />
        <polygon points={`${w * 0.8},${size * 0.6} ${w * 0.54},${size * 0.7} ${w * 0.62},${h} ${w * 0.71},${h - tail * 0.28} ${w * 0.84},${h - 2}`} fill="var(--hof-ribbon-b)" />
        <polygon points={`${w * 0.2},${size * 0.6} ${w * 0.46},${size * 0.7} ${w * 0.42},${size * 0.95}`} fill="hsl(228 60% 3% / 0.35)" />
      </svg>
      <span
        className="hof-coin__disc font-display font-extrabold italic leading-none tabular-nums"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.47) }}
        aria-hidden="true"
      >
        {score}
      </span>
    </span>
  );
};

/** A laurel wreath: two branches rising from the bottom around a circle and nearly meeting at the top. Decorative. */
export const Laurel = ({ className, color = 'currentColor', size = 64 }: { className?: string; color?: string; size?: number }) => {
  const R = 25;
  const n = 8;
  const leaves: { x: number; y: number; a: number }[] = [];
  for (let i = 0; i < n; i++) {
    const deg = 108 + (i * 138) / (n - 1); // bottom-left round to the top-left
    const t = (deg * Math.PI) / 180;
    const tangent = deg + 90; // the direction the branch grows
    [1, -1].forEach((side) => {
      const r = R + side * 3.6;
      leaves.push({ x: 32 + r * Math.cos(t), y: 32 + r * Math.sin(t), a: tangent - 90 + side * -32 });
    });
  }
  const arc = (from: number, to: number) => {
    const p = (d: number) => `${(32 + R * Math.cos((d * Math.PI) / 180)).toFixed(2)} ${(32 + R * Math.sin((d * Math.PI) / 180)).toFixed(2)}`;
    return `M ${p(from)} A ${R} ${R} 0 0 1 ${p(to)}`;
  };
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      {[-1, 1].map((side) => (
        <g key={side} transform={side === 1 ? 'translate(64 0) scale(-1 1)' : undefined} fill={color}>
          <path d={arc(100, 250)} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
          {leaves.map((l, i) => (
            <ellipse key={i} cx={l.x.toFixed(2)} cy={l.y.toFixed(2)} rx="1.9" ry="4.4" transform={`rotate(${l.a.toFixed(1)} ${l.x.toFixed(2)} ${l.y.toFixed(2)})`} />
          ))}
        </g>
      ))}
      <path d="M27 58 L32 55 L37 58 L35 61 L32 59.5 L29 61 Z" fill={color} />
    </svg>
  );
};

/** A small crown. Decorative. */
export const Crown = ({ className, color = 'currentColor', size = 24 }: { className?: string; color?: string; size?: number }) => (
  <svg viewBox="0 0 24 16" width={size} height={(size * 16) / 24} className={className} aria-hidden="true" focusable="false">
    <path d="M2 5 L7 9 L12 2 L17 9 L22 5 L20 14 L4 14 Z" fill={color} />
    <circle cx="2" cy="4.5" r="1.6" fill={color} />
    <circle cx="12" cy="1.8" r="1.6" fill={color} />
    <circle cx="22" cy="4.5" r="1.6" fill={color} />
    <rect x="4" y="12.5" width="16" height="1.5" fill="hsl(228 60% 3% / 0.35)" />
  </svg>
);

/** The crest on a card frame's top edge: a crown for the diamond tier, a laurel sprig pair otherwise. */
export const FrameCrest = ({ score }: { score: number }) => {
  const id = useId().replace(/:/g, '');
  const tier = tierOf(score);
  const stops =
    tier === 'diamond' ? ['#ffffff', '#b7c8ee'] : tier === 'gold' ? ['#fff3c2', '#d39a24'] : ['#ffe0c2', '#b9713f'];
  return (
    <svg className="hof-crest" viewBox="0 0 34 16" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`c${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="1" stopColor={stops[1]} />
        </linearGradient>
      </defs>
      <rect x="3" y="7" width="28" height="8" rx="4" fill="hsl(228 47% 8%)" stroke={`url(#c${id})`} strokeWidth="1.2" />
      {tier === 'diamond' ? (
        <path d="M10 13 L11 8 L14 10.5 L17 6.5 L20 10.5 L23 8 L24 13 Z" fill={`url(#c${id})`} />
      ) : (
        <g fill={`url(#c${id})`}>
          {[0, 1, 2].map((i) => (
            <ellipse key={`l${i}`} cx={14.5 - i * 3.2} cy={11 - i * 0.4} rx="1.3" ry="2.6" transform={`rotate(${-55 - i * 8} ${14.5 - i * 3.2} ${11 - i * 0.4})`} />
          ))}
          {[0, 1, 2].map((i) => (
            <ellipse key={`r${i}`} cx={19.5 + i * 3.2} cy={11 - i * 0.4} rx="1.3" ry="2.6" transform={`rotate(${55 + i * 8} ${19.5 + i * 3.2} ${11 - i * 0.4})`} />
          ))}
          <circle cx="17" cy="11" r="1.3" />
        </g>
      )}
    </svg>
  );
};

/** FIRST BALLOT (gold) / VETERAN (silver) badge. */
export const BallotBadge = ({ firstBallot, veteran, className }: { firstBallot?: boolean; veteran?: boolean; className?: string }) => {
  if (!firstBallot && !veteran) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 font-pixel text-[8px] uppercase leading-none tracking-wide',
        firstBallot ? 'bg-gold text-night' : 'bg-slate-300 text-night',
        className,
      )}
    >
      {firstBallot ? 'First ballot' : 'Veteran'}
    </span>
  );
};

/** FIRST BALLOT / VETERAN as a notched ribbon banner. */
export const RibbonBanner = ({ firstBallot, veteran, className }: { firstBallot?: boolean; veteran?: boolean; className?: string }) => {
  if (!firstBallot && !veteran) return null;
  return <span className={cn('hof-banner', !firstBallot && 'hof-banner--silver', className)}>{firstBallot ? 'First ballot' : 'Veteran'}</span>;
};

/** A section heading with a pixel kicker and a gold ornament rule. */
export const HallHeading = ({ id, kicker, title, sub, className }: { id: string; kicker: string; title: string; sub?: string; className?: string }) => (
  <div className={cn('mb-3', className)}>
    <p className="font-pixel text-[10px] uppercase tracking-widest text-gold/90">{kicker}</p>
    <h2 id={id} className="font-display text-2xl font-extrabold uppercase italic text-chalk sm:text-3xl">
      {title}
    </h2>
    <div className="hof-ornament" aria-hidden="true">
      <Crown size={12} color="hsl(var(--gold))" />
    </div>
    {sub && <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>}
  </div>
);

/** A 0-100 score bar with gold ticks every ten and a marker at the bar; gold once it reaches the bar. */
export const ScoreGauge = ({ score, bar, label, className }: { score: number; bar: number; label: string; className?: string }) => {
  const over = score >= bar;
  return (
    <div
      className={cn('relative h-2.5 w-full rounded-full', className)}
      style={{
        background:
          'repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), hsl(var(--gold) / 0.28) calc(10% - 1px) 10%), hsl(var(--muted))',
        boxShadow: 'inset 0 1px 2px hsl(228 60% 2% / 0.6)',
      }}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-valuetext={`${score} of 100; the bar is ${bar}`}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${Math.max(2, Math.min(100, score))}%`,
          background: over ? 'linear-gradient(180deg, hsl(45 100% 80%), hsl(43 100% 58%) 50%, hsl(36 90% 40%))' : 'hsl(var(--sky) / 0.75)',
          boxShadow: over ? '0 0 8px hsl(var(--gold) / 0.55)' : undefined,
        }}
      />
      <span aria-hidden="true" className="absolute -top-1.5 -bottom-1 w-0.5 rounded bg-gold" style={{ left: `calc(${bar}% - 1px)` }} />
      <span aria-hidden="true" className="absolute -top-2 h-1.5 w-1.5 rotate-45 bg-gold" style={{ left: `calc(${bar}% - 3px)` }} />
    </div>
  );
};
