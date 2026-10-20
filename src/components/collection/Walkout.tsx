import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { Gamepad2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { findNFLTeam } from '@/utils/nflTeams';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { tierLabel, variantLabel, type PackCard } from '@/utils/collection';
import CollectibleCard, { PlayerJersey } from './CollectibleCard';
import type { CardInfo } from './useCardPool';
import type { WkBeat, WkStage } from './walkoutBeats';

/** Firework bursts: [left %, top %, delay s]; Legendary fires a second volley. */
const VOLLEY = [
  [22, 32, 0],
  [78, 26, 0.22],
  [50, 16, 0.45],
] as const;
const VOLLEY_2 = [
  [34, 22, 0.8],
  [66, 36, 1.0],
] as const;
const SPARKS_PER_BURST = 14;

/** Shatter: 12 glass triangles from the card's centre to its edge, each flying outward. */
const EDGE = [
  [0, 0],
  [33, 0],
  [66, 0],
  [100, 0],
  [100, 33],
  [100, 66],
  [100, 100],
  [66, 100],
  [33, 100],
  [0, 100],
  [0, 66],
  [0, 33],
] as const;
const SHARDS = EDGE.map(([x1, y1], i) => {
  const [x2, y2] = EDGE[(i + 1) % EDGE.length];
  const cx = (50 + x1 + x2) / 3 - 50;
  const cy = (52 + y1 + y2) / 3 - 52;
  const len = Math.hypot(cx, cy) || 1;
  return {
    clip: `polygon(50% 52%, ${x1}% ${y1}%, ${x2}% ${y2}%)`,
    dx: `${((cx / len) * 120).toFixed(0)}%`,
    dy: `${((cy / len) * 120).toFixed(0)}%`,
    rot: `${((i * 47) % 120) - 60}deg`,
  };
});
const PRISM_BITS = 30;
/** Sprite beat: blocks of the 8-bit flash grid (8 × 6) */
const PIXEL_BLOCKS = 48;

const CLUES: WkStage[] = ['logo', 'pos', 'ovr'];

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** OVR counting up to its value; writes the number straight to the DOM on animation frames (no re-renders). */
const OvrCount = ({ to, ms }: { to: number | null; ms: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (to == null) {
      el.textContent = '–';
      return;
    }
    if (reducedMotion()) {
      el.textContent = String(to);
      return;
    }
    const from = Math.max(40, to - 38);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / ms));
      const e = 1 - (1 - k) ** 4;
      el.textContent = String(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    el.textContent = String(from);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <span ref={ref} aria-hidden="true" />;
};

interface WalkoutProps {
  card: PackCard;
  info: CardInfo;
  total: number;
  beats: WkBeat[];
  step: number;
  reduced: boolean;
  badge?: string;
  /** Tap anywhere: next stage now */
  onAdvance: () => void;
  onSkip: () => void;
  onDone: () => void;
  /** Reveal every remaining card (shown while other cards are still face down) */
  onRevealAll?: () => void;
}

/**
 * FUT-style walkout for Epic+ pulls and every holo: a dark tunnel with light beams, fireworks in the TIER colour,
 * a team-colour sweep and logo, the position, the OVR counting up, a silhouette walking out, then the card flips.
 * A holo looks like a normal walkout of its tier until after the flip; then the twist: white flash, prismatic
 * shockwave, the card shatters and reforms as holo, prism confetti, a HOLO stamp, a screen shake and a slow 360°.
 */
const Walkout = ({ card, info, total, beats, step, reduced, badge, onAdvance, onSkip, onDone, onRevealAll }: WalkoutProps) => {
  const team = findNFLTeam(info.player.team);
  const stage = beats[Math.min(step, beats.length - 1)].stage;
  const reached = (s: WkStage) => {
    const k = beats.findIndex((b) => b.stage === s);
    return k >= 0 && step >= k;
  };
  const holo = card.finish === 'holo';
  const twisted = holo && reached('twist');
  const sprite = card.variant === 'sprite';
  const pixeled = sprite && reached('pixel');
  const legendary = card.tier === 'legendary';
  const isFinal = stage === 'final';
  const doneRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Focus the stage (so Space / Enter reach Skip next), then Continue once it is over
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (isFinal) doneRef.current?.focus();
  }, [isFinal]);

  const photo = info.player.isRealLegend ? info.player.photo?.url : undefined;
  const style = (team ? { '--wk-a': `hsl(${team.primaryColor})`, '--wk-b': `hsl(${team.secondaryColor})` } : {}) as CSSProperties;
  const teamName = team?.name ?? (info.player.isRealLegend ? 'NFL Legend' : info.franchise);
  const ovrBeat = beats.find((b) => b.stage === 'ovr')?.ms ?? 1000;

  const hero = CLUES.includes(stage) ? stage : null;
  const hud = CLUES.filter((c) => reached(c) && c !== hero);
  const showClues = !reached('flip');

  const tap = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onAdvance();
  };

  return (
    // Tapping the stage advances one beat; Skip / Continue are the keyboard path
    <div
      className={cn(
        'wk',
        `wk--t-${card.tier}`,
        `wk--${stage}`,
        reduced && 'wk--rm',
        reached('flares') && 'wk--lit',
        reached('sweep') && 'wk--team',
        reached('walk') && 'wk--out',
        reached('flip') && 'wk--carded',
        twisted && 'wk--holo',
        pixeled && 'wk--8bit',
        stage === 'pixel' && 'wk--pixel-beat',
      )}
      style={style}
      onClick={tap}
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label={`${tierLabel(card.tier)} walkout`}
    >
      <div className="wk__shake">
        {!reduced && (
          <>
            <span className="wk__tunnel" aria-hidden="true" />
            <span className="wk__floor" aria-hidden="true" />
            <span className="wk__exit" aria-hidden="true" />
            <span className="wk__beam wk__beam--l" aria-hidden="true" />
            <span className="wk__beam wk__beam--r" aria-hidden="true" />
            {legendary && (
              <>
                <span className="wk__beam wk__beam--cl" aria-hidden="true" />
                <span className="wk__beam wk__beam--cr" aria-hidden="true" />
              </>
            )}
            <span className="wk__wash" aria-hidden="true" />
          </>
        )}
        {!reduced && reached('flares') && (
          <span className="wk__fireworks" aria-hidden="true">
            {[...VOLLEY, ...(legendary ? VOLLEY_2 : [])].map(([x, y, d], b) => (
              <span key={b} className="wk__fw" style={{ left: `${x}%`, top: `${y}%`, '--d': `${d}s` } as CSSProperties}>
                {Array.from({ length: SPARKS_PER_BURST }, (_, i) => (
                  <i key={i} style={{ '--i': i } as CSSProperties} />
                ))}
              </span>
            ))}
          </span>
        )}
        {!reduced && stage === 'sweep' && <span className="wk__sweep" aria-hidden="true" />}

        {showClues && (
          <>
            <div className="wk__hud" aria-hidden="true">
              {hud.map((c) => (
                <span key={c} className={cn('wk__chip', `wk__chip--${c}`)}>
                  {c === 'logo' && (team ? <TeamLogo team={info.player.team} size={30} decorative /> : <span className="wk__star">★</span>)}
                  {c === 'pos' && info.player.position}
                  {c === 'ovr' && (info.ovr ?? '–')}
                </span>
              ))}
            </div>
            <div className="wk__hero" aria-live="polite">
              {hero === 'logo' && (
                <span key="logo" className="wk__logo">
                  <span className="wk__logo-mark">
                    {team ? <TeamLogo team={info.player.team} size={112} decorative /> : <span className="wk__star wk__star--big">★</span>}
                  </span>
                  <span className="wk__team-name">{teamName}</span>
                </span>
              )}
              {hero === 'pos' && (
                <span key="pos" className="wk__pos">
                  <span className="wk__pos-code">{info.player.position}</span>
                  <span className="wk__pos-name">{POSITION_NAMES[info.player.position] ?? info.player.position}</span>
                </span>
              )}
              {hero === 'ovr' && (
                <span key="ovr" className="wk__ovr" aria-label={`OVR ${info.ovr ?? 'unknown'}`}>
                  <OvrCount to={info.ovr} ms={Math.min(1100, ovrBeat * 0.75)} />
                  <span className="wk__ovr-label">OVR</span>
                </span>
              )}
            </div>
          </>
        )}

        {!reduced && reached('walk') && !reached('flip') && (
          <span className={cn('wk__sil', photo && 'wk__sil--photo')} aria-hidden="true">
            {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" draggable={false} /> : <PlayerJersey number={info.number} id={`wk-${info.key.replace(/\W/g, '')}`} />}
          </span>
        )}

        {reached('flip') && (
          <div className="wk__card">
            {twisted && !reduced && (
              <>
                <span className="wk__rays" aria-hidden="true" />
                <span className="wk__wave" aria-hidden="true" />
                <span className="wk__wave wk__wave--2" aria-hidden="true" />
                {legendary && <span className="wk__wave wk__wave--3" aria-hidden="true" />}
              </>
            )}
            <div className="wk__spin">
              <div className="wk__flip">
                <div className="wk__face">
                  <CollectibleCard
                    owned
                    live
                    large
                    player={info.player}
                    tier={card.tier}
                    finish={holo && !twisted ? 'base' : card.finish}
                    variant={card.variant}
                    ovr={info.ovr}
                    number={info.number}
                    stats={info.stats}
                    setNo={info.setNo}
                    setTotal={total}
                    badge={isFinal ? badge : undefined}
                  />
                  {twisted && <span className="wk__prism-sweep" aria-hidden="true" />}
                </div>
                <div className="wk__face wk__face--back" aria-hidden="true">
                  <span className="pk-back__shape">
                    <span className="pk-back__logo">RV</span>
                  </span>
                </div>
              </div>
            </div>
            {twisted && !reduced && (
              <span className="wk__shards" aria-hidden="true">
                {SHARDS.map((s, i) => (
                  <i key={i} style={{ clipPath: s.clip, '--dx': s.dx, '--dy': s.dy, '--rot': s.rot } as CSSProperties} />
                ))}
              </span>
            )}
            {twisted && !reduced && (
              <span className="wk__prism" aria-hidden="true">
                {Array.from({ length: legendary ? PRISM_BITS + 14 : PRISM_BITS }, (_, i) => (
                  <i key={i} style={{ '--i': i, '--n': legendary ? PRISM_BITS + 14 : PRISM_BITS } as CSSProperties} />
                ))}
              </span>
            )}
            {pixeled && !twisted && (
              <span className="wk__stamp wk__stamp--8bit" aria-hidden="true">
                <Gamepad2 className="h-5 w-5" /> 8-bit
              </span>
            )}
            {twisted && (
              <span className="wk__stamp" aria-hidden="true">
                <Sparkles className="h-5 w-5" /> Holo
              </span>
            )}
          </div>
        )}
        {twisted && !reduced && <span className="wk__white" aria-hidden="true" />}
        {stage === 'pixel' && !reduced && (
          <span className="wk__8bit" aria-hidden="true">
            {Array.from({ length: PIXEL_BLOCKS }, (_, i) => (
              <i key={i} style={{ '--d': `${((i * 29) % PIXEL_BLOCKS) * 14}ms` } as CSSProperties} />
            ))}
          </span>
        )}
        {!reduced && stage === 'flip' && <span className="wk__flash" aria-hidden="true" />}
      </div>

      <p className="sr-only" role="status">
        {reached('flip')
          ? `${tierLabel(card.tier)}! ${info.player.name}, ${variantLabel(card.variant)}${pixeled ? '. 8-bit: a Retro Bowl sprite card!' : ''}${twisted ? '. Twist: it is a Holo!' : ''}`
          : `${tierLabel(card.tier)} walkout`}
      </p>

      <div className="wk__actions">
        {!isFinal && !reduced && <span className="wk__hint">Tap to speed up</span>}
        {!isFinal ? (
          <>
            {onRevealAll && (
              <Button variant="ghost" size="sm" onClick={onRevealAll}>
                Reveal all
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onSkip}>
              Skip
            </Button>
          </>
        ) : (
          <Button ref={doneRef} onClick={onDone}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
};

export default Walkout;
