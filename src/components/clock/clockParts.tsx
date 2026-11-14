import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import GameSprite from '@/components/GameSprite';
import type { SpriteAction } from '@/utils/gameSprites';
import { getReadableTextOn, getTeamColors, liftForDarkBg } from '@/utils/teamColors';
import type { Player } from '@/types/player';
import { RATINGS, type Rating } from './saveData';
import { isDefense, longClock, type ClockPlayer } from './clockModel';

/** A club's colours as CSS vars for the Clock's cards: --tc primary, --tc2 secondary, --ti readable ink */
export const clubVars = (team?: string | null): CSSProperties => {
  const c = getTeamColors(team);
  if (!c) return { '--tc': 'hsl(var(--line))', '--tc2': 'hsl(var(--panel-2))', '--ti': 'hsl(var(--chalk))' } as CSSProperties;
  return { '--tc': `hsl(${c.primary})`, '--tc2': `hsl(${c.secondary})`, '--ti': liftForDarkBg(c.primary, 66), '--tx': getReadableTextOn(c.primary) } as CSSProperties;
};

/**
 * True once the sprite's image inside the element has actually loaded (an image that is missing, fails or is still
 * loading leaves the logo at full strength, so the stage is never empty).
 */
const useSpriteShown = () => {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!el) return;
    const imgs = new Set<HTMLImageElement>();
    const check = () => setShown([...el.querySelectorAll<HTMLImageElement>('.game-sprite img')].some((i) => i.complete && i.naturalWidth > 0));
    const watch = () => {
      el.querySelectorAll<HTMLImageElement>('.game-sprite img').forEach((i) => {
        if (imgs.has(i)) return;
        imgs.add(i);
        i.addEventListener('load', check);
        i.addEventListener('error', check);
      });
      check();
    };
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    return () => {
      mo.disconnect();
      imgs.forEach((i) => {
        i.removeEventListener('load', check);
        i.removeEventListener('error', check);
      });
    };
  }, [el]);
  return [setEl, shown] as const;
};

/**
 * The player's name as a small banner strip in his club's colour with the real logo (the owner: clickable names are
 * club-colour strips, never underlined text). Render it inside the row's button; it is not a control itself.
 */
export const NameStrip = ({ name, team, className }: { name: string; team: string; className?: string }) => (
  <span className={cn('clk-strip', className)} style={clubVars(team)}>
    <TeamLogo team={team} size={18} backed decorative />
    <span className="clk-strip__name">{name}</span>
  </span>
);

/** A real club logo (brand/TeamLogo, ESPN's marks) with the club name, as the rest of the site shows a club */
export const ClubTag = ({ team }: { team: string }) => (
  <span className="clk-clubtag">
    <TeamLogo team={team} size={18} backed decorative />
    <span className="clk-club">{team}</span>
  </span>
);

/**
 * The player standing on his card: Retro Bowl's own sprite (GameSprite, 2x on cards, 3x on the spotlight; the private
 * sprites exist only on the owner's Mac) in front of his club's real logo. On the public build GameSprite renders
 * nothing and the logo, full strength, fills the stage; with a sprite the logo stays behind him as the club mark.
 */
export const ClockStage = ({
  c,
  size = 'card',
  action,
  className,
}: {
  c: Pick<ClockPlayer, 'key' | 'name' | 'pos' | 'team'>;
  size?: 'row' | 'card' | 'spot';
  action: SpriteAction;
  className?: string;
}) => {
  const [ref, shown] = useSpriteShown();
  return (
  <span ref={ref} className={cn('clk-stage', size === 'spot' && 'clk-stage--spot', size === 'row' && 'clk-stage--row', shown && 'is-sprite', className)} style={clubVars(c.team)} aria-hidden="true">
    <span className="clk-stage__logo">
      <TeamLogo team={c.team} size={size === 'spot' ? 132 : size === 'row' ? 36 : 84} decorative />
    </span>
    <GameSprite player={{ name: c.name, position: c.pos, team: c.team }} team={c.team} kind={size === 'row' ? 'bust' : 'figure'} size={size === 'spot' ? 'l' : 'm'} action={action} className="clk-stage__sprite" />
  </span>
  );
};

// ---------- Pixel trophies (7 × 7 glyphs, crisp edges) ----------

const GLYPHS: Record<string, { rows: string[]; ink: Record<string, string> }> = {
  ring: {
    rows: ['..#@#..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..###..'],
    ink: { '#': '#ffc83d', '@': '#8fe3ff' },
  },
  mvp: {
    rows: ['#.###.#', '#.###.#', '.#####.', '..###..', '...#...', '..###..', '.#####.'],
    ink: { '#': '#ffc83d' },
  },
  poy: {
    rows: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
    ink: { '#': '#ffe08a' },
  },
  sbmvp: {
    rows: ['...bb..', '..bbbb.', '.bbwbbb', 'bbwbwbb', 'bbbwbb.', '.bbbb..', '..bb...'],
    ink: { b: '#b8733a', w: '#fff3d6' },
  },
  roty: {
    rows: ['.##.##.', '#..#..#', '.#.#.#.', '...#...', '...#...', '..###..', '.#####.'],
    ink: { '#': '#3ddc84' },
  },
};

export const PixelGlyph = ({ kind, px = 3, className }: { kind: keyof typeof GLYPHS; px?: number; className?: string }) => {
  const g = GLYPHS[kind];
  return (
    <svg width={7 * px} height={7 * px} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className={className}>
      {g.rows.flatMap((row, y) =>
        [...row].map((ch, x) => (g.ink[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={g.ink[ch]} /> : null)),
      )}
    </svg>
  );
};

/** His rings and awards as compact chips (nothing at all when he has none) */
export const AwardChips = ({ p, className }: { p: Player; className?: string }) => {
  const def = isDefense(p.position);
  const items = [
    { kind: 'ring' as const, n: p.rings, label: p.rings === 1 ? 'Ring' : 'Rings', full: 'rings' },
    { kind: 'mvp' as const, n: p.mvp, label: 'MVP', full: 'MVP' },
    { kind: 'poy' as const, n: p.opoy, label: def ? 'DPOY' : 'OPOY', full: def ? 'Defensive Player of the Year' : 'Offensive Player of the Year' },
    { kind: 'sbmvp' as const, n: p.sbmvp, label: 'SB MVP', full: 'Super Bowl MVP' },
    { kind: 'roty' as const, n: p.roty, label: def ? 'DROY' : 'OROY', full: def ? 'Defensive Rookie of the Year' : 'Offensive Rookie of the Year' },
  ].filter((i) => i.n > 0);
  if (!items.length) return null;
  return (
    <ul className={cn('clk-awards', className)} aria-label={`Awards: ${items.map((i) => `${i.n} ${i.full}`).join(', ')}`}>
      {items.map((i) => (
        <li key={i.kind} className="clk-award" aria-hidden="true">
          <PixelGlyph kind={i.kind} px={2} />
          {i.n > 1 && <b>{i.n}</b>}
          {i.label}
        </li>
      ))}
    </ul>
  );
};

// ---------- Rating bars: now vs ceiling, 10 segments ----------

export const RATING_LABEL: Record<Rating, string> = { speed: 'Speed', strength: 'Strength', skill: 'Skill', stamina: 'Stamina' };
const RATING_SHORT: Record<Rating, string> = { speed: 'SPD', strength: 'STR', skill: 'SKL', stamina: 'STA' };

export const RatingBars = ({ c, className }: { c: ClockPlayer; className?: string }) => (
  <dl className={cn('clk-bars', className)}>
    {RATINGS.map((r) => {
      const now = c.now[r];
      const max = c.max[r];
      return (
        <div key={r} className="clk-bar">
          <dt className="clk-bar__k">
            <abbr title={RATING_LABEL[r]} className="no-underline">
              {RATING_SHORT[r]}
            </abbr>
          </dt>
          <dd className="clk-bar__track" aria-label={`${RATING_LABEL[r]} ${now} of 10, ceiling ${max}${max > now ? `, ${max - now} to grow` : ', at his ceiling'}`}>
            <span className="clk-bar__segs" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < now ? 'on' : i < max ? 'gap' : undefined} />
              ))}
            </span>
            <span className="clk-bar__v" aria-hidden="true">
              {now}
              {max > now && <b>→{max}</b>}
            </span>
          </dd>
        </div>
      );
    })}
  </dl>
);

// ---------- The game's stars: five pixel stars from 1-10 half-stars ----------

const STAR_ROWS = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##', '.......'];
const PixelStar = ({ fill, px }: { fill: 'full' | 'half' | 'empty'; px: number }) => (
  <svg width={7 * px} height={7 * px} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true">
    {STAR_ROWS.flatMap((row, y) =>
      [...row].map((ch, x) =>
        ch === '#' ? (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill === 'full' || (fill === 'half' && x <= 3) ? '#ffc83d' : 'hsl(226 38% 30%)'} />
        ) : null,
      ),
    )}
  </svg>
);

export const starText = (half: number) => `${half / 2} star${half === 2 ? '' : 's'}`;

/** Half-stars (1-10) as five pixel stars; the label reads the count */
export const StarRow = ({ half, px = 2, className, label }: { half: number; px?: number; className?: string; label?: string }) => (
  <span role="img" aria-label={label ?? starText(half)} className={cn('clk-stars', className)}>
    {Array.from({ length: 5 }, (_, i) => (
      <PixelStar key={i} px={px} fill={half >= 2 * (i + 1) ? 'full' : half === 2 * i + 1 ? 'half' : 'empty'} />
    ))}
  </span>
);

// ---------- Scoreboard pieces: lamp stat bar, the countdown pips, medals ----------

/** A tight scoreboard stat bar: small pixel labels over gold lamp digits */
export const LampBar = ({ cells, className }: { cells: { label: string; value: string; tone?: 'gold' | 'chalk' | 'turf' }[]; className?: string }) => (
  <dl className={cn('clk-lamps', className)}>
    {cells.map((x) => (
      <div key={x.label} className={x.tone ? `is-${x.tone}` : undefined}>
        <dt>{x.label}</dt>
        <dd>{x.value}</dd>
      </div>
    ))}
  </dl>
);

/**
 * His retirement countdown: one pip per season he has left including this one (red = this season, the last one lit
 * red too when it is his final), with the season it ends; a QB or kicker's pips are diamonds (the 40 clock).
 */
export const ClockPips = ({ c, season, className }: { c: Pick<ClockPlayer, 'left' | 'pos' | 'delay'>; season: number; className?: string }) => {
  const n = c.left + 1;
  const long = longClock(c.pos);
  const label = `${c.left === 0 ? 'Final season' : `${n} seasons left`}, ends Y${season + c.left}${long ? ', on the 40 clock' : ''}${c.delay ? `, ${c.delay} delay${c.delay === 1 ? '' : 's'}` : ''}`;
  return (
    <span className={cn('clk-clock', long && 'is-long', className)} role="img" aria-label={label} title={label}>
      <span className="clk-clock__pips" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <i key={i} className={i === 0 ? 'is-now' : undefined} />
        ))}
      </span>
      <span className="clk-clock__k" aria-hidden="true">
        ENDS Y{season + c.left}
        {long ? ' · 40' : ''}
        {c.delay ? ` · +${c.delay}` : ''}
      </span>
    </span>
  );
};

/** Rings and awards as small pixel medals with a count (nothing when he has none) */
export const Medals = ({ p, className }: { p: Player; className?: string }) => {
  const def = isDefense(p.position);
  const items = [
    { kind: 'ring' as const, n: p.rings, full: p.rings === 1 ? 'ring' : 'rings' },
    { kind: 'mvp' as const, n: p.mvp, full: 'MVP' },
    { kind: 'poy' as const, n: p.opoy, full: def ? 'DPOY' : 'OPOY' },
    { kind: 'sbmvp' as const, n: p.sbmvp, full: 'Super Bowl MVP' },
    { kind: 'roty' as const, n: p.roty, full: def ? 'DROY' : 'OROY' },
  ].filter((i) => i.n > 0);
  if (!items.length) return null;
  const label = items.map((i) => `${i.n} ${i.full}`).join(', ');
  return (
    <span className={cn('clk-medals', className)} role="img" aria-label={label} title={label}>
      {items.map((i) => (
        <span key={i.kind} className="clk-medal" aria-hidden="true">
          <PixelGlyph kind={i.kind} px={2} />
          {i.n > 1 && <b>{i.n}</b>}
        </span>
      ))}
    </span>
  );
};
