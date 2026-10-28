import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  /** Animation length in ms */
  duration?: number;
  decimals?: number;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// One formatter per precision: toLocaleString with options builds a new Intl.NumberFormat on every call, and a
// count-up formats every frame (a player card has ~15 of them running at once)
const formatters = new Map<number, Intl.NumberFormat>();
const format = (n: number, decimals: number) => {
  let f = formatters.get(decimals);
  if (!f) formatters.set(decimals, (f = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })));
  return f.format(n);
};

/**
 * Scoreboard-style number that counts up from its previous value.
 * Screen readers get the final value only; reduced-motion users see it immediately.
 */
const CountUp = ({ value, duration = 700, decimals = 0, className }: CountUpProps) => {
  const safe = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? safe : 0));
  const fromRef = useRef(display);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(safe);
      fromRef.current = safe;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (safe - from) * eased;
      setDisplay(next);
      fromRef.current = next;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safe, duration]);

  return (
    <span className={className}>
      <span aria-hidden="true" className="tabular-nums">{format(display, decimals)}</span>
      <span className="sr-only">{format(safe, decimals)}</span>
    </span>
  );
};

export default CountUp;
