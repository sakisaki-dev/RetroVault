import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, FastForward, Medal, Sparkles, Star, Trophy, X } from 'lucide-react';
import type { Player } from '@/types/player';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import CountUp from '@/components/brand/CountUp';
import { resolveTeam } from '@/components/brand/TeamLogo';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { getReadableTextOn } from '@/utils/teamColors';
import { getLegacyTier, isDefensivePosition, isHallOfFamer } from '@/config/stats';
import type { RetiredNumber } from '@/utils/jerseys';
import type { CeremonyVariant } from '@/utils/hallOfFameWatch';
import { signatureStats, type Speech } from './speech';
import './ceremony.css';

export interface CeremonyInductee {
  key: string;
  player: Player;
  variant: CeremonyVariant;
  number: number | null;
  ovr: number | null;
  retired?: RetiredNumber;
  speech: Speech;
}

interface InductionCeremonyProps {
  inductees: CeremonyInductee[];
  /** "Class of Y80", "Inaugural class"… */
  classLabel: string;
  onClose: () => void;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const CONFETTI_COLORS = ['43 100% 62%', '48 100% 80%', '36 90% 48%', '0 0% 100%', '43 100% 70%'];

/** Deterministic pseudo-random so particles don't jump between renders. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const Particles = () => {
  const confetti = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: `${rand(i, 1) * 100}%`,
        background: `hsl(${CONFETTI_COLORS[i % CONFETTI_COLORS.length]})`,
        '--dur': `${4 + rand(i, 2) * 3}s`,
        '--delay': `${1.1 + rand(i, 3) * 1.6}s`,
        '--drift': `${(rand(i, 4) - 0.5) * 160}px`,
        '--spin': `${360 + rand(i, 5) * 720}deg`,
        width: `${5 + rand(i, 6) * 5}px`,
      })),
    [],
  );
  const dust = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: `${10 + rand(i, 7) * 80}%`,
        '--dur': `${6 + rand(i, 8) * 6}s`,
        '--delay': `${2 + rand(i, 9) * 6}s`,
        '--drift': `${(rand(i, 10) - 0.5) * 80}px`,
      })),
    [],
  );
  return (
    <div className="cer__particles" aria-hidden="true">
      {confetti.map((style, i) => (
        <span key={`c${i}`} className="cer__confetti" style={style as CSSProperties} />
      ))}
      {dust.map((style, i) => (
        <span key={`d${i}`} className="cer__dust" style={style as CSSProperties} />
      ))}
    </div>
  );
};

const RetiredBanner = ({ retired, player }: { retired: RetiredNumber; player: Player }) => {
  const team = resolveTeam(player.team) ?? resolveTeam(retired.teamLabel);
  const primary = team?.primaryColor ?? '226 33% 24%';
  const secondary = team && team.secondaryColor !== team.primaryColor ? team.secondaryColor : '43 100% 62%';
  const style = { '--rb-primary': primary, '--rb-secondary': secondary, '--rb-fg': getReadableTextOn(primary) } as CSSProperties;
  return (
    <div className="cer__rafter">
      <div className="cer__retired" style={style} role="img" aria-label={`Number ${retired.number} retired by the ${retired.teamLabel}`}>
        <span className="cer__retired-num">{retired.number}</span>
        <span className="cer__retired-name">{player.name}</span>
        <span className="cer__retired-team">
          {retired.teamLabel}
          {retired.years ? ` · ${retired.years}` : ''}
        </span>
      </div>
    </div>
  );
};

const InducteeStage = ({ inductee, statsLive, titleId }: { inductee: CeremonyInductee; statsLive: boolean; titleId: string }) => {
  const { player, variant, retired, speech } = inductee;
  const tier = getLegacyTier(player.careerLegacy);
  const hof = isHallOfFamer(player);
  const team = resolveTeam(player.team);
  const sig = signatureStats(player).slice(0, 2);
  const stats = [
    { label: 'Career legacy', value: Math.round(player.careerLegacy), gold: true },
    { label: 'Games', value: player.games },
    ...sig.map((s) => ({ label: s.label, value: s.value })),
  ].slice(0, 4);
  const awards = [
    { label: 'Rings', value: player.rings, Icon: Trophy },
    { label: 'MVP', value: player.mvp, Icon: Medal },
    { label: isDefensivePosition(player.position) ? 'DPOY' : 'OPOY', value: player.opoy, Icon: Star },
    { label: 'SB MVP', value: player.sbmvp, Icon: Sparkles },
    { label: 'ROTY', value: player.roty, Icon: Sparkles },
  ].filter((a) => a.value > 0);

  return (
    <div className="cer__stage">
      <div>
        <div className="cer__rise">
          <ProPlayerBanner
            size="hero"
            name={player.name}
            nickname={player.nickname}
            position={player.position}
            team={player.team}
            number={inductee.number}
            ovr={inductee.ovr}
            hallOfFamer={hof}
            retiredBy={retired?.teamLabel ?? null}
            eyebrow={`${POSITION_NAMES[player.position]}${team ? ` · ${team.fullName}` : player.team ? ` · ${player.team}` : ''}`}
            nameAs="h3"
          />
        </div>

        <dl className="cer__stats" aria-label="Career numbers">
          {stats.map((s) => (
            <div key={s.label} className={`cer__stat${s.gold ? ' cer__stat--gold' : ''}`}>
              <dt>{s.label}</dt>
              <dd>
                <CountUp value={statsLive ? s.value : 0} duration={1400} />
              </dd>
            </div>
          ))}
        </dl>

        <ul className="cer__awards" aria-label="Awards">
          {tier && (
            <li className="cer__award" style={{ '--i': 0 } as CSSProperties}>
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              {tier.label} tier
            </li>
          )}
          {awards.map(({ label, value, Icon }, i) => (
            <li key={label} className="cer__award" style={{ '--i': i + 1 } as CSSProperties}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label} <b>×{value}</b>
            </li>
          ))}
        </ul>
      </div>

      <div>
        {retired && <RetiredBanner retired={retired} player={player} />}
        <figure className="cer__speech" aria-labelledby={`${titleId}-speech`}>
          <div className="cer__speech-head">
            <span id={`${titleId}-speech`} className="cer__speech-label">
              {variant === 'ring' ? 'Ring of Honor address' : 'Induction speech'}
            </span>
            <span className="cer__speech-src">
              {speech.source === 'content' ? 'From the league history file' : 'Written from career data'}
            </span>
          </div>
          <blockquote>
            {speech.paragraphs.map((p, i) => (
              <p key={i} style={{ '--i': i } as CSSProperties}>
                {p}
              </p>
            ))}
          </blockquote>
        </figure>
      </div>
    </div>
  );
};

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Full-screen Hall of Fame / Ring of Honor ceremony. Plays inductees in sequence.
 * Keys: Esc closes, Enter / → next. Focus is trapped; reduced-motion users get the final frame.
 */
const InductionCeremony = ({ inductees, classLabel, onClose }: InductionCeremonyProps) => {
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState(prefersReducedMotion);
  const [statsLive, setStatsLive] = useState(skipped);
  const rootRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduced = useMemo(prefersReducedMotion, []);

  const current = inductees[Math.min(index, inductees.length - 1)];
  const isLast = index >= inductees.length - 1;

  // New inductee: replay the staging (unless reduced motion), scroll to top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    if (reduced) return;
    setSkipped(false);
    setStatsLive(false);
    const t = window.setTimeout(() => setStatsLive(true), 1800);
    return () => window.clearTimeout(t);
  }, [index, reduced]);

  const next = useCallback(() => {
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  }, [isLast, onClose]);

  const skip = useCallback(() => {
    setSkipped(true);
    setStatsLive(true);
  }, []);

  // Focus management + body scroll lock
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nextRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    const onControl = (e.target as HTMLElement).closest('button, a');
    if ((e.key === 'Enter' && !onControl) || e.key === 'ArrowRight') {
      e.preventDefault();
      next();
      return;
    }
    if (e.key === 'Tab' && rootRef.current) {
      const items = [...rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !rootRef.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!current) return null;
  const isRing = current.variant === 'ring';
  const total = inductees.length;

  return createPortal(
    <div
      ref={rootRef}
      className={`cer${skipped ? ' cer--static' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
    >
      <div className="cer__sky" aria-hidden="true" />
      <div className="cer__spot" aria-hidden="true" />
      <div className="cer__beam cer__beam--l" aria-hidden="true" key={`bl${index}`} />
      <div className="cer__beam cer__beam--r" aria-hidden="true" key={`br${index}`} />
      <div className="cer__tower cer__tower--l" aria-hidden="true" />
      <div className="cer__tower cer__tower--r" aria-hidden="true" />
      <div className="cer__stands" aria-hidden="true" />
      {!skipped && <Particles key={`p${index}`} />}

      <button type="button" className="cer__btn cer__btn--icon cer__close" onClick={onClose} aria-label="Close ceremony">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="cer__scroll" ref={scrollRef}>
        <div className="cer__inner" key={current.key + index}>
          <header className="cer__head">
            <p className="cer__kicker">{isRing ? 'Ring of Honor · Banner night' : 'Hall of Fame · Enshrinement night'}</p>
            <h2 id={titleId} className="cer__class">
              {classLabel}
              <span className="sr-only">
                {`: ${current.player.name}, ${isRing ? 'Ring of Honor' : 'Hall of Fame'}${total > 1 ? `, ${index + 1} of ${total}` : ''}`}
              </span>
            </h2>
            <div className="cer__curtain" aria-hidden="true">
              {isRing
                ? `Ring of Honor${current.retired ? ` · ${current.retired.teamLabel}` : ''}`
                : `${getLegacyTier(current.player.careerLegacy)?.label ?? 'Hall of Fame'} inductee`}
              {total > 1 && (
                <span className="cer__curtain-sub">
                  {index + 1} / {total}
                </span>
              )}
            </div>
          </header>

          <InducteeStage inductee={current} statsLive={statsLive} titleId={titleId} />
        </div>
      </div>

      <div className="cer__controls">
        <button type="button" className="cer__btn" onClick={skipped ? onClose : skip}>
          {skipped ? <X className="h-4 w-4" aria-hidden="true" /> : <FastForward className="h-4 w-4" aria-hidden="true" />}
          {skipped ? (total > 1 ? 'End ceremony' : 'Close') : 'Skip'}
        </button>
        {total > 1 && (
          <div className="cer__dots" aria-hidden="true">
            {inductees.map((d, i) => (
              <span key={d.key + i} className={`cer__dot${i === index ? ' cer__dot--on' : i < index ? ' cer__dot--done' : ''}`} />
            ))}
          </div>
        )}
        <button ref={nextRef} type="button" className="cer__btn cer__btn--primary" onClick={next}>
          {isLast ? 'Finish' : 'Next inductee'}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {`${current.player.name}${total > 1 ? `, inductee ${index + 1} of ${total}` : ''}`}
      </p>
    </div>,
    document.body,
  );
};

export default InductionCeremony;
