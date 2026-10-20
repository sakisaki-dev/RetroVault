import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { isLite } from '@/hooks/usePerfMode';
import { ChevronLeft, ChevronRight, Hammer, RotateCcw, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { findNFLTeam } from '@/utils/nflTeams';
import {
  FINISHES,
  VARIANTS,
  bestVariant,
  craftCost,
  craftUpgrade,
  finishLabel,
  nextFinish,
  tierLabel,
  variantLabel,
  type Finish,
  type OwnedCard,
  type Tier,
  type Variant,
} from '@/utils/collection';
import CollectibleCard from './CollectibleCard';
import CardBack from './CardBack';
import CardValue from './market/CardValue';
import { FINISH_ICON, FINISH_TEXT } from './rarityIcons';
import type { CardInfo } from './useCardPool';

export interface CardDetailTarget {
  info: CardInfo;
  /** Finish shown; defaults to the best owned */
  finish?: Finish;
  /** Art variant shown; defaults to the rarest owned */
  variant?: Variant;
  /** Tier shown (Card designs can show any tier); defaults to the player's */
  tier?: Tier;
  /** Card designs preview: no crafting, no ownership */
  preview?: boolean;
  /** On-screen box of the tapped card: the large card flies in from there */
  from?: DOMRect;
  /** Cards to step through with the arrows / ← → (the grid it was opened from) */
  list?: CardInfo[];
}

interface CardDetailProps {
  target: CardDetailTarget | null;
  entry?: OwnedCard;
  shards: number;
  total: number;
  onClose: () => void;
  onPlayer?: (info: CardInfo) => void;
  /** Step to another card of target.list */
  onNavigate?: (info: CardInfo) => void;
}

const motionOk = () => {
  try {
    return !isLite() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Floating dust in the stadium light: [left %, size px, delay s, duration s]. */
const MOTES = [
  [6, 3, 0, 11],
  [14, 2, 3.2, 9],
  [22, 4, 6.1, 13],
  [31, 2, 1.4, 10],
  [39, 3, 7.5, 12],
  [47, 2, 4.4, 9],
  [55, 4, 2.2, 14],
  [63, 2, 8.3, 10],
  [70, 3, 0.8, 12],
  [78, 2, 5.6, 9],
  [86, 4, 3.9, 13],
  [93, 2, 6.8, 11],
] as const;

const UPGRADE_MS = 1500;

/**
 * Large card showcase: a team-colour stadium (spotlight, logo watermark, floating dust; gold rays for
 * Legendary), the card big and centred with pointer / device tilt and an idle sway, a flip to the card back
 * (career, awards, skill grades, career arc, set number), finish chips to preview each finish owned, a one-tap
 * upgrade with its own animation, "Open player card", and ← → through the grid it came from. It flies in
 * from the tapped card (FLIP), with a spring at the start.
 */
const CardDetail = ({ target, entry, shards, total, onClose, onPlayer, onNavigate }: CardDetailProps) => {
  const [msg, setMsg] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [view, setView] = useState<Finish | null>(null);
  const [viewVariant, setViewVariant] = useState<Variant | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const info = target?.info;
  const key = info?.key;
  const tier = target?.tier ?? info?.tier ?? 'common';
  const variant: Variant = viewVariant ?? target?.variant ?? (target?.preview ? 'jersey' : bestVariant(entry));
  const vEntry = entry?.variants[variant];
  const hasVariant = (v: Variant) => !!target?.preview || !!entry?.variants[v];
  const owned = (f: Finish) => !!target?.preview || !!vEntry?.counts[f] || vEntry?.best === f;
  const finish = view ?? (viewVariant ? vEntry?.best : undefined) ?? target?.finish ?? vEntry?.best ?? 'base';
  const to = !target?.preview && vEntry ? nextFinish(vEntry.best) : null;
  const cost = to && info ? craftCost(to, info.tier) : 0;
  const team = info ? findNFLTeam(info.player.team) : null;

  const list = target?.list ?? [];
  const idx = info ? list.findIndex((c) => c.key === info.key) : -1;
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  // New card: front side, its own finish, no message
  useEffect(() => {
    setFlipped(false);
    setView(null);
    setViewVariant(null);
    setMsg('');
    setUpgrading(false);
  }, [key]);

  useEffect(() => {
    if (!upgrading) return;
    const id = window.setTimeout(() => setUpgrading(false), UPGRADE_MS);
    return () => window.clearTimeout(id);
  }, [upgrading]);

  // Shared-element fly-in: from the tapped card's box, a quick spring up, then into place. Runs when the large
  // card mounts (the dialog portal mounts a frame after open), once per tap.
  const fromRef = useRef<DOMRect | undefined>(undefined);
  fromRef.current = target?.from;
  const flown = useRef<DOMRect | undefined>(undefined);
  const flyRef = useCallback((el: HTMLDivElement | null) => {
    const from = fromRef.current;
    if (!el || !from || flown.current === from || !motionOk() || typeof el.animate !== 'function') return;
    flown.current = from;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const s = from.width / r.width;
    const dx = from.left + from.width / 2 - (r.left + r.width / 2);
    const dy = from.top + from.height / 2 - (r.top + r.height / 2);
    // Let the card fly over the dialog edge while it travels (the dialog clips its overflow otherwise)
    const box = el.closest<HTMLElement>('.cd');
    box?.classList.add('cd--flying');
    const a = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
        { transform: `translate(${dx}px, ${dy - 18}px) scale(${s * 1.12}) rotate(-2deg)`, offset: 0.16, easing: 'cubic-bezier(0.25, 1.15, 0.35, 1)' },
        { transform: 'none' },
      ],
      { duration: 720, fill: 'backwards' },
    );
    const done = () => box?.classList.remove('cd--flying');
    a.onfinish = done;
    a.oncancel = done;
  }, []);

  const craft = () => {
    if (!info || !to) return;
    const done = craftUpgrade(info.player, info.tier, variant);
    if (done) {
      setView(done);
      setFlipped(false);
      setUpgrading(motionOk());
      setMsg(`Upgraded to ${finishLabel(done)}!`);
    } else setMsg('Not enough shards.');
  };

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea')) return;
    if (e.key === 'ArrowLeft' && prev && onNavigate) {
      e.preventDefault();
      onNavigate(prev);
    } else if (e.key === 'ArrowRight' && next && onNavigate) {
      e.preventDefault();
      onNavigate(next);
    }
  };

  const vars = (team ? { '--cd-a': `hsl(${team.primaryColor})`, '--cd-b': `hsl(${team.secondaryColor})` } : {}) as CSSProperties;

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        className={cn('cd max-h-[96vh] max-w-5xl overflow-y-auto border-line bg-night p-0', `cd--${tier}`, upgrading && 'cd--upgrading')}
        style={vars}
        onKeyDown={onKey}
      >
        {info && (
          <div className="cd__inner">
            <div className="cd__bg" aria-hidden="true">
              <span className="cd__wash" />
              {tier === 'legendary' && <span className="cd__rays" />}
              <span className="cd__spot" />
              <span className="cd__mark">{team ? <TeamLogo team={info.player.team} size={360} decorative /> : '★'}</span>
              <span className="cd__motes">
                {MOTES.map(([x, sz, d, dur], i) => (
                  <i key={i} style={{ left: `${x}%`, width: sz, height: sz, animationDelay: `${d}s`, animationDuration: `${dur}s` }} />
                ))}
              </span>
              <span className="cd__floor" />
            </div>

            <div className="cd__body">
              <div className="cd__stage">
                <button
                  type="button"
                  className="cd__nav cd__nav--prev"
                  onClick={() => prev && onNavigate?.(prev)}
                  disabled={!prev || !onNavigate}
                  aria-label={prev ? `Previous card: ${prev.player.name}` : 'Previous card'}
                  hidden={!list.length}
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                <div className="cd__fly" ref={flyRef} key={key}>
                  <div className="cd__sway">
                    <div className={cn('cd__flipper', flipped && 'is-flipped')}>
                      <div className="cd__face" aria-hidden={flipped}>
                        <CollectibleCard
                          owned
                          large
                          live
                          player={info.player}
                          tier={tier}
                          finish={finish}
                          variant={variant}
                          ovr={info.ovr}
                          number={info.number}
                          stats={info.stats}
                          setNo={info.setNo}
                          setTotal={total}
                          marks={entry?.marks}
                        />
                        {upgrading && (
                          <span className="cd__up" aria-hidden="true">
                            <span className="cd__up-ring" />
                            <span className="cd__up-beam" />
                            <span className="cd__up-stamp">{finishLabel(finish)}!</span>
                          </span>
                        )}
                      </div>
                      <div className="cd__face cd__face--back" aria-hidden={!flipped}>
                        {flipped && <CardBack info={info} tier={tier} total={total} variant={variant} finish={finish} />}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="cd__nav cd__nav--next"
                  onClick={() => next && onNavigate?.(next)}
                  disabled={!next || !onNavigate}
                  aria-label={next ? `Next card: ${next.player.name}` : 'Next card'}
                  hidden={!list.length}
                >
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </button>
                <button type="button" className="cd__flip" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {flipped ? 'Show front' : 'Flip card'}
                </button>
              </div>

              <div className="cd__side">
                <div>
                  <p className={cn('cd__kicker', `cd__kicker--${tier}`)}>
                    {tierLabel(tier)}
                    {list.length > 1 && idx >= 0 && (
                      <span className="ml-2 font-mono text-muted-foreground">
                        {idx + 1}/{list.length}
                      </span>
                    )}
                  </p>
                  <DialogTitle className="font-display text-4xl uppercase italic leading-none">{info.player.name}</DialogTitle>
                  <DialogDescription className="mt-1.5">
                    {variantLabel(variant)} · {finishLabel(finish)} · {POSITION_NAMES[info.player.position] ?? info.player.position} · {info.franchise} · OVR {info.ovr ?? '–'}
                  </DialogDescription>
                </div>

                <div>
                  <p className="cd__label" id="cd-variants">
                    {target?.preview ? 'Art variants' : `Your variants · ${VARIANTS.filter((v) => hasVariant(v.key)).length}/${VARIANTS.length}`}
                  </p>
                  <ul className="flex flex-wrap gap-1.5" aria-labelledby="cd-variants">
                    {VARIANTS.map((v) => {
                      const has = hasVariant(v.key);
                      const e = entry?.variants[v.key];
                      return (
                        <li key={v.key}>
                          <button
                            type="button"
                            className={cn('cd-chip cd-vchip', `cd-vchip--${v.key}`, variant === v.key && 'is-on')}
                            onClick={() => {
                              setViewVariant(v.key);
                              setView(null);
                              setFlipped(false);
                            }}
                            disabled={!has}
                            aria-pressed={variant === v.key}
                            title={has ? `Show the ${v.label} variant` : `${v.label} not owned yet`}
                          >
                            <i className={cn('vdot', `vdot--${v.key}`, has && 'is-owned')} aria-hidden="true" />
                            {v.short}
                            {e && !target?.preview && <span className="text-muted-foreground">· {finishLabel(e.best)}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <p className="cd__label">{target?.preview ? 'Finishes' : `Your finishes · ${variantLabel(variant)}`}</p>
                  <ul className="flex flex-wrap gap-1.5" aria-label="Preview a finish">
                    {FINISHES.map((f) => {
                      const Icon = FINISH_ICON[f.key];
                      const n = vEntry?.counts[f.key] ?? 0;
                      const has = owned(f.key);
                      return (
                        <li key={f.key}>
                          <button
                            type="button"
                            className={cn('cd-chip', `cd-chip--${f.key}`, finish === f.key && 'is-on')}
                            onClick={() => {
                              setView(f.key);
                              setFlipped(false);
                            }}
                            disabled={!has}
                            aria-pressed={finish === f.key}
                            title={has ? `Preview the ${f.label} finish` : `${f.label} not owned yet`}
                          >
                            <Icon className={cn('h-3.5 w-3.5', FINISH_TEXT[f.key])} aria-hidden="true" />
                            {f.label}
                            {n > 1 && <span className="font-mono text-muted-foreground">×{n}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {to && (
                  <button type="button" onClick={craft} disabled={cost > shards} className={cn('cd-craft', `cd-craft--${to}`)}>
                    <span className="cd-craft__icon">
                      <Hammer className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block font-display text-xl font-extrabold uppercase italic leading-none">Upgrade to {finishLabel(to)}</span>
                      <span className="mt-1 block text-xs opacity-80">
                        {cost.toLocaleString()} shards · you have {shards.toLocaleString()}
                      </span>
                      <span className="cd-craft__bar" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, (shards / Math.max(1, cost)) * 100)}%` }} />
                      </span>
                    </span>
                  </button>
                )}

                {!target?.preview && <CardValue cardKey={info.key} name={info.player.name} finish={finish} variant={variant} ownedFinish={vEntry?.best} player={info.player} />}

                {onPlayer && (
                  <button type="button" onClick={() => onPlayer(info)} className="cd-btn">
                    <UserRound className="h-4 w-4" aria-hidden="true" /> Open player card
                  </button>
                )}
                <p className="text-sm font-semibold text-gold" role="status">
                  {msg}
                </p>
                {list.length > 1 && <p className="hidden text-xs text-muted-foreground sm:block">← → to browse cards</p>}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CardDetail;
