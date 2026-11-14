import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import InLeague from '@/components/InLeague';
import { useJerseyNumbers } from '@/utils/jerseys';
import { liftForDarkBg } from '@/utils/teamColors';
import { bannerTeamOf } from '@/utils/playerExtras';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { CountUp } from './ArcadeUI';
import { getScoutLine, isLegend, legendLabel, type GamePlayer, type ScoutStat } from './gameUtils';
import { isHallOfFamer } from '@/config/stats';
import GameSprite from '../GameSprite';
import './rosterkit.css';

/*
 * Shared presentation for the card-dealing games (Blind Rank, Keep 3 Cut 3, Who's the Imposter?):
 * team-coloured player slabs, the "on the clock" deck card, a fly-in when a card lands, a staged reveal
 * clock and a short how-to strip. Everything is scoped under .arcade .rk-*.
 */

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const useMedia = (query: string) => {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [query]);
  return on;
};

// ---------- Team look ----------

export interface TeamLook {
  team: NFLTeam | null;
  /** CSS custom properties: --c1 / --c2 fills, --ink the club colour lifted for dark backgrounds */
  vars: CSSProperties;
  abbr: string;
  name: string;
}

const NEUTRAL_VARS = { '--c1': 'hsl(222 22% 26%)', '--c2': 'hsl(222 16% 48%)', '--ink': '#cfd7f5' } as CSSProperties;

export const teamLook = (p: GamePlayer): TeamLook => {
  const team = findNFLTeam(bannerTeamOf(p));
  if (!team) return { team: null, vars: NEUTRAL_VARS, abbr: 'FA', name: 'Free agent' };
  return {
    team,
    abbr: team.abbreviation,
    name: team.fullName,
    vars: {
      '--c1': `hsl(${team.primaryColor})`,
      '--c2': `hsl(${team.secondaryColor})`,
      '--ink': liftForDarkBg(team.primaryColor, 66),
    } as CSSProperties,
  };
};

const splitName = (name: string) => {
  const i = name.lastIndexOf(' ');
  return i > 0 ? [name.slice(0, i), name.slice(i + 1)] : ['', name];
};

const Logo = ({ team, className }: { team: NFLTeam | null; className?: string }) =>
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

/** The 2-3 numbers that matter most for comparing cards side by side (skips games played when space is short). */
export const keyStats = (p: GamePlayer, n = 3): ScoutStat[] => {
  const line = getScoutLine(p);
  const body = line.slice(1).filter((s) => s.value != null);
  return n >= 3 ? [line[0], ...body].slice(0, n) : body.slice(0, n);
};

// ---------- Slab: the compact player card used in slots, piles and result ladders ----------

export const Slab = ({
  player,
  ovr,
  reveal = false,
  stats = 3,
  rank,
  tag,
  tone,
  className,
  style,
  children,
}: {
  player: GamePlayer;
  ovr?: number | null;
  /** Answer is out: OVR, HOF and legend tags show */
  reveal?: boolean;
  /** Number of key stats in the line (0 hides it) */
  stats?: number;
  /** Slot marker on the left (1-5, K, C); defaults to the jersey number */
  rank?: ReactNode;
  tag?: ReactNode;
  tone?: 'good' | 'bad' | 'near' | null;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) => {
  const { numberFor } = useJerseyNumbers();
  const look = teamLook(player);
  const [first, last] = splitName(player.name);
  const legend = isLegend(player);
  const line = stats ? keyStats(player, stats) : [];
  return (
    <div className={cn('rk-slab', tone && `is-${tone}`, className)} style={{ ...look.vars, ...style }}>
      <span className="rk-slab-no" aria-hidden="true">
        {rank ?? <small>#{numberFor(player)}</small>}
      </span>
      <Logo team={look.team} className="rk-slab-logo" />
      <GameSprite player={player} team={look.team?.name} legend={legend} kind="figure" size="m" className="rk-slab-sprite" />
      <span className="rk-slab-id">
        <span className="rk-slab-first">
          {first}
          <InLeague player={player} label={false} />
          {reveal && legend && <em className="rk-flag">{legendLabel(player)}</em>}
          {reveal && !legend && isHallOfFamer(player) && <em className="rk-flag hof">HOF</em>}
        </span>
        <span className="rk-slab-last">{last}</span>
        {line.length > 0 && (
          <span className="rk-slab-line">
            {line.map((s) => (
              <span key={s.label} className={s.label === 'GP' ? 'gp' : undefined}>
                <i>{s.label}</i> {s.value ?? '-'}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="rk-slab-side">
        <span className="rk-pos">
          {player.position}
          <b>{look.abbr}</b>
        </span>
        {reveal && ovr != null ? (
          <span className="rk-ovr" aria-label={`OVR ${ovr}`}>
            {ovr}
          </span>
        ) : (
          <span className="rk-ovr sealed" aria-hidden="true">
            ??
          </span>
        )}
      </span>
      {tag}
      {children}
    </div>
  );
};

// ---------- Deck card: the player on the clock ----------

export const DeckCard = ({
  player,
  eyebrow,
  grip,
  className,
  dragProps,
  dragWhole = false,
  overlay,
  footer,
}: {
  player: GamePlayer;
  eyebrow: ReactNode;
  /** Small hint line under the name ("Drag to a slot") */
  grip?: ReactNode;
  className?: string;
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { style?: CSSProperties; ref?: React.Ref<HTMLDivElement> };
  /** Drag the whole card (swipe) instead of just the name plate */
  dragWhole?: boolean;
  /** Drawn over the face (stamps) */
  overlay?: ReactNode;
  footer?: ReactNode;
}) => {
  const { numberFor } = useJerseyNumbers();
  const look = teamLook(player);
  const [first, last] = splitName(player.name);
  const line = getScoutLine(player);
  const { style: dragStyle, ref: dragRef, ...dragRest } = dragProps ?? {};
  const cardDrag = dragWhole ? { ref: dragRef, ...dragRest } : {};
  const faceDrag = dragWhole ? {} : { ref: dragRef, ...dragRest };
  return (
    <article
      className={cn('rk-deck', dragProps && (dragWhole ? 'drag-card' : 'drag-face'), className)}
      style={{ ...look.vars, ...(dragWhole ? dragStyle : null) }}
      aria-label={`${player.name}, ${player.position}, ${look.name}`}
      {...cardDrag}
    >
      <div className="rk-deck-face" style={dragWhole ? undefined : dragStyle} {...faceDrag}>
        {overlay}
        <span className="rk-deck-num" aria-hidden="true">
          {numberFor(player)}
        </span>
        <Logo team={look.team} className="rk-deck-logo" />
        <GameSprite player={player} team={look.team?.name} legend={isLegend(player)} kind="figure" size="l" className="rk-deck-sprite" />
        <span className="rk-deck-eyebrow">{eyebrow}</span>
        <h3 className="rk-deck-name">
          <span>{first}</span>
          {last}
        </h3>
        <span className="rk-deck-team">
          <InLeague player={player} /> <b>{player.position}</b> {look.name} · #{numberFor(player)}
          {player.nickname ? <i> · "{player.nickname}"</i> : null}
        </span>
        {grip && <span className="rk-deck-grip">{grip}</span>}
      </div>
      <dl className="rk-deck-stats">
        {line.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value == null ? '-' : <Animated text={s.value} />}</dd>
          </div>
        ))}
        <div className="rk-deck-aw" style={{ gridColumn: `span ${4 - (line.length % 4)}` }}>
          <dt>Trophies</dt>
          <dd>{trophies(player)}</dd>
        </div>
      </dl>
      {footer}
    </article>
  );
};

const trophies = (p: GamePlayer) => {
  const parts = [
    p.rings ? `${p.rings} ring${p.rings === 1 ? '' : 's'}` : '',
    p.mvp ? `${p.mvp} MVP` : '',
    p.opoy ? `${p.opoy} ${['LB', 'DB', 'DL'].includes(p.position) ? 'DPOY' : 'OPOY'}` : '',
    p.sbmvp ? `${p.sbmvp} SB MVP` : '',
    p.roty ? 'ROTY' : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'None';
};

const Animated = ({ text }: { text: string }) => {
  const m = text.match(/^(-?[\d,]+(?:\.(\d+))?)(%?)$/);
  if (!m) return <>{text}</>;
  return <CountUp value={Number(m[1].replace(/,/g, ''))} decimals={m[2]?.length ?? 0} suffix={m[3]} duration={550} />;
};

// ---------- Fly-in: a placed card travels from where it was launched ----------

let launch: DOMRect | null = null;
/** Remember where the next landing card should fly in from. */
export const launchFrom = (el: Element | null | undefined) => {
  launch = el ? el.getBoundingClientRect() : null;
};

/** Wraps a freshly placed card; it flies from the last launch point to its slot, then flashes. */
export const Land = ({ active, children, className }: { active: boolean; children: ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const from = launch;
    launch = null;
    if (!from || prefersReducedMotion() || !el.animate) return;
    const to = el.getBoundingClientRect();
    if (!to.width) return;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const s = Math.min(1.4, Math.max(0.6, from.width / to.width));
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(-4deg)`, opacity: 0.4 },
        { transform: 'translate(0,0) scale(1.04) rotate(0)', opacity: 1, offset: 0.8 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 460, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className={cn(active && 'rk-landed', className)}>
      {children}
    </div>
  );
};

// ---------- Staged reveal clock ----------

/** Counts 0..steps, one tick every `ms` after `delay`; jumps to the end with reduced motion. Reset by `key`. */
export const useRevealClock = (on: boolean, steps: number, ms = 380, delay = 250, key?: unknown) => {
  const [step, setStep] = useState(on && prefersReducedMotion() ? steps : 0);
  useEffect(() => {
    if (!on) {
      setStep(0);
      return;
    }
    if (prefersReducedMotion()) {
      setStep(steps);
      return;
    }
    setStep(0);
    let n = 0;
    let iv = 0;
    const t = window.setTimeout(() => {
      iv = window.setInterval(() => {
        n += 1;
        setStep(n);
        if (n >= steps) window.clearInterval(iv);
      }, ms);
    }, delay);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(iv);
    };
  }, [on, steps, ms, delay, key]);
  return { step, finish: () => setStep(steps), done: step >= steps };
};

// ---------- HUD ----------

export const Hud = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('rk-hud', className)}>{children}</div>
);

export const HudStat = ({ label, value, live, accent }: { label: ReactNode; value: ReactNode; live?: boolean; accent?: boolean }) => (
  <span className={cn('rk-hud-stat', accent && 'accent')} aria-live={live ? 'polite' : undefined}>
    <i>{label}</i>
    <b>{value}</b>
  </span>
);

/** Row of progress pips: filled for done, a pulse for the current one. */
export const Pips = ({ total, done, tones, label }: { total: number; done: number; tones?: (string | undefined)[]; label?: string }) => (
  <span className="rk-pips" role="img" aria-label={label ?? `${done} of ${total}`}>
    {Array.from({ length: total }, (_, i) => (
      <span key={i} className={cn('rk-pip', i < done && 'done', i === done && 'now', tones?.[i])} />
    ))}
  </span>
);

// ---------- Pointer drag (mouse and touch) onto [data-drop] targets ----------

export interface DragState {
  dx: number;
  dy: number;
  over: string | null;
  active: boolean;
}

/**
 * Drag a source element with the pointer. Targets are elements with a data-drop attribute; the one under the
 * pointer is reported as `over`. Releasing calls onRelease(target, dx, dy) (target null when dropped elsewhere).
 */
export const usePointerDrag = (onRelease: (target: string | null, dx: number, dy: number, el: HTMLElement) => void, enabled = true) => {
  const [drag, setDrag] = useState<DragState>({ dx: 0, dy: 0, over: null, active: false });
  const start = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const cb = useRef(onRelease);
  cb.current = onRelease;

  const targetAt = (x: number, y: number, src: HTMLElement) => {
    const hit = document.elementsFromPoint(x, y).find((el) => !src.contains(el) && el.closest('[data-drop]'));
    return (hit?.closest('[data-drop]') as HTMLElement | null)?.dataset.drop ?? null;
  };

  const handlers = enabled
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
          if (e.button !== 0) return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
        },
        onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (!s.moved && Math.hypot(dx, dy) < 8) return;
          if (!s.moved) {
            s.moved = true;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          setDrag({ dx, dy, over: targetAt(e.clientX, e.clientY, e.currentTarget), active: true });
        },
        onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
          const s = start.current;
          start.current = null;
          if (!s || !s.moved) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          const target = targetAt(e.clientX, e.clientY, e.currentTarget);
          setDrag({ dx: 0, dy: 0, over: null, active: false });
          cb.current(target, dx, dy, e.currentTarget);
        },
        onPointerCancel: () => {
          start.current = null;
          setDrag({ dx: 0, dy: 0, over: null, active: false });
        },
      }
    : {};
  return { drag, handlers };
};
