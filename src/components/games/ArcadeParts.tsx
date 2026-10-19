import { CountUp } from './ArcadeUI';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { getAwards, getScoutLine, type ScoutStat, hash, type TeamStyle } from './gameUtils';

// Player identity in the games is shown with the site's ProPlayerBanner (see GameBanner.tsx).
// This file keeps the arcade's decorative helmet and the scouting stat block.

// ---------- Helmet ----------

interface HelmetProps {
  style: TeamStyle;
  /** Stripe pattern seed */
  seed?: string;
  className?: string;
  mystery?: boolean;
}

/** Football helmet in team colors with the real team logo as the decal (when the team is known and not sealed). */
export const Helmet = ({ style, seed = '', className, mystery }: HelmetProps) => {
  const doubleStripe = hash(seed || style.abbr) % 3 === 0;
  const logo = !mystery ? style.team?.logoUrl : undefined;
  return (
    <svg viewBox="0 0 120 92" width="120" height="92" aria-hidden="true" className={className}>
      <path
        d="M14 66 C4 40 18 8 58 6 C92 4 112 26 110 52 L110 60 L86 62 L80 76 L36 80 C24 80 18 76 14 66 Z"
        fill={style.c1}
        stroke="#ffffffaa"
        strokeWidth="2.5"
      />
      {doubleStripe ? (
        <>
          <path d="M30 14 C48 4 78 4 98 18" fill="none" stroke={style.c2} strokeWidth="4" />
          <path d="M27 21 C47 10 80 10 102 26" fill="none" stroke={style.c2} strokeWidth="4" />
        </>
      ) : (
        <path d="M28 17 C48 5 80 5 100 22" fill="none" stroke={style.c2} strokeWidth="8" />
      )}
      {logo ? (
        <image href={logo} x="24" y="26" width="40" height="40" preserveAspectRatio="xMidYMid meet" />
      ) : mystery ? (
        <text x="46" y="62" fontSize="32" fontWeight="800" fill="#cfd7f5" textAnchor="middle" fontFamily="Silkscreen, monospace">
          ?
        </text>
      ) : (
        <circle cx="54" cy="52" r="6" fill="#00000055" />
      )}
      <path
        d="M84 40 L118 42 M86 54 L118 54 M84 66 L114 66 M100 40 L100 70 M112 42 L110 68"
        stroke="#b9c0d0"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M78 74 C82 82 92 84 98 80" stroke="#b9c0d0" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
};

// ---------- Stat block ----------

interface StatBlockProps {
  player: Player;
  /** Override the stat line (defaults to getScoutLine); hiddenStats indexes into it */
  line?: ScoutStat[];
  /** Indices of getScoutLine() to hide */
  hiddenStats?: number[];
  /** Indices of getAwards() to hide */
  hiddenAwards?: number[];
  className?: string;
  /** Larger tiles (stage layout) */
  big?: boolean;
  /** Count numbers up from zero */
  countUp?: boolean;
}

/** "56,837" / "64%" / "7.1" -> animated number; anything else is shown as-is. */
const Animated = ({ text }: { text: string }) => {
  const m = text.match(/^(-?[\d,]+(?:\.(\d+))?)(%?)$/);
  if (!m) return <>{text}</>;
  const value = Number(m[1].replace(/,/g, ''));
  const dec = m[2]?.length ?? 0;
  return <CountUp value={value} decimals={dec} suffix={m[3]} />;
};

/** Scouting stat tiles + award chips, with optional sealed (hidden) entries. */
export const StatBlock = ({ player, line, hiddenStats = [], hiddenAwards = [], className, big = false, countUp = false }: StatBlockProps) => (
  <div className={cn('flex flex-col gap-2', className)}>
    <dl className={big ? 'stats bigstats' : 'stats'}>
      {(line ?? getScoutLine(player)).map((s, i) => {
        const hidden = hiddenStats.includes(i);
        return (
          <div key={s.label} className={cn('stat', hidden && 'sealed-stat')}>
            <dt className="k">{s.label}</dt>
            <dd className="v">{hidden ? <span aria-label="sealed">??</span> : s.value == null ? '—' : countUp ? <Animated text={s.value} /> : s.value}</dd>
          </div>
        );
      })}
    </dl>
    <ul className={big ? 'awards big' : 'awards'} aria-label="Awards">
      {getAwards(player).map((a, i) =>
        hiddenAwards.includes(i) ? (
          <li key={a.label} className="aw sealed-aw">
            {a.label} <span aria-label="sealed">??</span>
          </li>
        ) : (
          <li key={a.label} className="aw">
            {a.label} <b>{a.value}</b>
          </li>
        ),
      )}
    </ul>
  </div>
);
