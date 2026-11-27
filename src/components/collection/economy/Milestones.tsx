import { useMemo, type CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CollectionState } from '@/utils/collection';
import { fmtCoins } from '@/utils/cardMarket';
import { NFL_TEAMS } from '@/utils/nflTeams';
import { displayName } from '@/utils/displayName';
import { PixelSelect } from '@/components/arcade';
import { MILESTONES, activeCosmetic, pyroOn, setCosmetic, setPyro, setSlab, slabKey, type Milestone } from '@/utils/economy';
import type { CollectionSet } from '@/utils/economy';
import CardBackArt from '../CardBackArt';
import CollectibleCard from '../CollectibleCard';
import { displayWithKit } from '../kits';
import type { CardInfo } from '../useCardPool';
import PixelCup from '@/components/frontoffice/PixelCup';
import CoverScene from './CoverScene';
import Pennant from './Pennant';
import SlabFrame from './SlabFrame';
import { PixelRows, PyroCannon } from './pixel';
import { jerseyOf, type TopCard } from './useRewards';
import './rewards.css';

interface MilestonesProps {
  state: CollectionState;
  /** Portfolio value now (coins), null while the market loads */
  value: number | null;
  byKey: Map<string, CardInfo>;
  top: TopCard[];
  sets: CollectionSet[];
}

const short = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1000}K`);
const KIND_LABEL: Record<Milestone['kind'], string> = { binder: 'Binder cover', back: 'Card back', slab: 'Display', pyro: 'Walkout', case: 'Collection' };
const CUP_BANDS = ['140 45% 32%', '215 70% 45%', '38 85% 52%', '0 70% 46%', '270 50% 48%', '190 70% 40%', '330 60% 50%', '45 90% 55%'];

// ---------- the value track ----------

const STEPS = [...new Set(MILESTONES.map((m) => m.at))];
/** 0..1 along the track: equal spacing between steps, log-scaled inside each step */
const along = (v: number): number => {
  if (v <= 0) return 0;
  if (v >= STEPS[STEPS.length - 1]) return 1;
  const i = STEPS.findIndex((s) => v < s);
  if (i === 0) return 0;
  const a = STEPS[i - 1];
  const b = STEPS[i];
  return (i - 1 + Math.log(v / a) / Math.log(b / a)) / (STEPS.length - 1);
};

const Track = ({ value }: { value: number | null }) => {
  const p = value == null ? 0 : along(value);
  return (
    <div className="rw-track" role="img" aria-label={value == null ? 'Portfolio value loading' : `Portfolio value ${fmtCoins(value)}`}>
      <span className="rw-track__bar">
        <i style={{ width: `${p * 100}%` }} />
        {value != null && <b style={{ left: `${p * 100}%` }} aria-hidden="true" />}
      </span>
      {STEPS.map((s, i) => (
        <span key={s} className={cn('rw-track__tick', value != null && value >= s && 'is-hit')} style={{ left: `${(i / (STEPS.length - 1)) * 100}%` }}>
          <i />
          <span>{short(s)}</span>
        </span>
      ))}
    </div>
  );
};

// ---------- live previews ----------

/** A pixel scene for the Pyro walkout: the tunnel mouth, the turf and a cannon each side, frames running */
const PYRO_SCENE = (() => {
  const W = 48;
  const H = 34;
  const g: string[][] = Array.from({ length: H }, (_, y) => Array.from({ length: W }, () => (y < 20 ? 'n' : y % 4 < 2 ? 'g' : 'G')));
  for (let y = 4; y < 20; y += 1) {
    const half = y < 10 ? 4 + (y - 4) * 2 : 11;
    for (let x = W / 2 - half - 2; x < W / 2 + half + 2; x += 1) g[y][x] = Math.abs(x - W / 2 + 0.5) > half ? 'f' : 'k';
  }
  for (let x = 0; x < W; x += 1) if (g[20][x] === 'g' || g[20][x] === 'G') g[20][x] = 'w';
  return g.map((r) => r.join(''));
})();
const SCENE_INK = { n: '#0b1020', k: '#05070f', f: '#3d4f80', g: '#2e7d32', G: '#2a7030', w: '#d8e0f0' };
const PyroPreview = ({ on }: { on: boolean }) => (
  <div className="rw-pyro" style={{ ['--px' as string]: '3px' } as CSSProperties}>
    <svg viewBox="0 0 48 34" shapeRendering="crispEdges" aria-hidden="true">
      <PixelRows rows={PYRO_SCENE} ink={SCENE_INK} />
    </svg>
    <PyroCannon className="rw-pyro__c rw-pyro__c--l" still={!on} />
    <PyroCannon className="rw-pyro__c rw-pyro__c--r" still={!on} />
  </div>
);

const CasePreview = ({ top, count }: { top: TopCard[]; count: number }) => (
  <div className="rw-case rw-case--mini" aria-hidden="true">
    <div className="rw-case__row">
      {[0, 1, 2].map((i) => {
        const t = top[i];
        return <i key={i} className="rw-case__slot" style={{ background: t ? `hsl(${jerseyOf(t).color})` : '#4a3a24' }} />;
      })}
    </div>
    <div className="rw-case__row">
      {Array.from({ length: Math.max(3, Math.min(5, count)) }, (_, i) => (
        <span key={i} className="rw-case__cup">
          <PixelCup band={CUP_BANDS[i]} />
        </span>
      ))}
    </div>
  </div>
);

const SlabPreview = ({ info, state, total }: { info?: CardInfo; state: CollectionState; total: number }) => {
  const entry = info ? state.cards[info.key] : undefined;
  const d = info && entry ? displayWithKit(entry, state.display?.[info.key], info.player) : undefined;
  return (
    <div className="rw-slabbed rw-slabprev">
      {info ? (
        <CollectibleCard owned player={info.player} tier={info.tier} finish={d?.finish ?? 'base'} variant={d?.variant} kit={d?.kit} prizm={d?.prizm} ovr={info.ovr} number={info.number} stats={info.stats} setNo={info.setNo} setTotal={total} />
      ) : (
        <div className="rw-slabprev__blank" />
      )}
      <SlabFrame />
    </div>
  );
};

const Preview = ({ m, props }: { m: Milestone; props: { state: CollectionState; top: TopCard[]; byKey: Map<string, CardInfo>; total: number; pyro: boolean; cups: number } }) => {
  switch (m.kind) {
    case 'binder':
      return (
        <div className={cn('rw-binder', `ec-skin--${m.key}`)}>
          <CoverScene skin={m.key} jerseys={props.top.map(jerseyOf)} />
          <span className="rings" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="lbl">{m.label}</span>
        </div>
      );
    case 'back':
      return (
        <div className="rw-back">
          <CardBackArt finish={m.key} />
        </div>
      );
    case 'slab': {
      const pick = slabKey(props.state);
      return <SlabPreview info={pick ? props.byKey.get(pick) : props.top[0]?.info} state={props.state} total={props.total} />;
    }
    case 'pyro':
      return <PyroPreview on={props.pyro} />;
    default:
      return <CasePreview top={props.top} count={props.cups} />;
  }
};

/**
 * Milestones: the portfolio's market value crossing each line unlocks a reward for good (it stays unlocked if the value
 * later drops). A value track, every reward as a live preview with its state and switch, and the club pennant wall.
 */
const Milestones = ({ state, value, byKey, top, sets }: MilestonesProps) => {
  const unlocked = new Set(state.unlocks ?? []);
  const next = MILESTONES.find((m) => !unlocked.has(m.id));
  const active = { binder: activeCosmetic(state, 'binder'), back: activeCosmetic(state, 'back') };
  const slab = slabKey(state);
  const pyro = pyroOn(state);
  const total = byKey.size;
  const cups = MILESTONES.filter((m) => unlocked.has(m.id)).length;

  const owned = useMemo(
    () =>
      Object.keys(state.cards)
        .map((k) => byKey.get(k))
        .filter((c): c is CardInfo => !!c)
        .sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0))
        .slice(0, 300),
    [state.cards, byKey],
  );

  const clubSets = useMemo(() => new Map(sets.filter((s) => s.kind === 'club').map((s) => [s.team as string, s])), [sets]);
  const wall = NFL_TEAMS.map((t) => {
    const set = clubSets.get(t.name);
    const have = set ? set.members.filter((k) => !!state.cards[k]).length : 0;
    return { team: t, have, total: set?.members.length ?? 0, done: !!set && set.members.length > 0 && have === set.members.length };
  });
  const doneClubs = wall.filter((w) => w.done).length;

  const action = (m: Milestone, open: boolean) => {
    if (!open) return null;
    if (m.kind === 'binder' || m.kind === 'back') {
      const on = active[m.kind] === m.key;
      return (
        <button type="button" className={cn('ec-btn ec-btn--sm', on ? 'ec-btn--ghost' : 'ec-btn--gold')} aria-pressed={on} onClick={() => setCosmetic(m.kind as 'binder' | 'back', on ? null : m.key)}>
          {on ? 'In use · switch off' : 'Use it'}
        </button>
      );
    }
    if (m.kind === 'pyro') {
      return (
        <button type="button" className={cn('ec-btn ec-btn--sm', pyro ? 'ec-btn--ghost' : 'ec-btn--gold')} aria-pressed={pyro} onClick={() => setPyro(!pyro)}>
          {pyro ? 'On · switch off' : 'Switch on'}
        </button>
      );
    }
    if (m.kind === 'slab') {
      return (
        <div className="flex w-full flex-col gap-2">
          <PixelSelect
            label="Card in the slab"
            prefix="Card"
            placeholder="Pick a card"
            value={slab ?? null}
            onChange={(k) => setSlab(k)}
            options={owned.map((c) => ({ value: c.key, label: displayName(c.player.name), text: displayName(c.player.name), hint: c.ovr ?? undefined }))}
          />
          {slab && (
            <button type="button" className="ec-btn ec-btn--sm ec-btn--ghost" onClick={() => setSlab(null)}>
              Take out of the slab
            </button>
          )}
        </div>
      );
    }
    return <span className="ec-kicker">On the Collection page</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="ec-kicker">Portfolio value</p>
          <p className="font-display text-3xl font-extrabold tabular-nums">{value == null ? '…' : fmtCoins(value)}</p>
        </div>
        {next && value != null && (
          <p className="text-xs text-muted-foreground">
            {fmtCoins(Math.max(0, next.at - value))} to {short(next.at)}: {next.label}
          </p>
        )}
      </div>
      <Track value={value} />

      <ul className="rw-grid">
        {/* the default back stays; it is not a reward */}
        <li className={cn('rw-card is-open', !active.back && 'is-on')}>
          <div className="rw-card__stage">
            <div className="rw-back">
              <CardBackArt finish="chrome" />
            </div>
          </div>
          <p className="ec-kicker">Default · Card back</p>
          <p className="rw-card__name">White chrome</p>
          <div className="rw-card__act">
            {active.back ? (
              <button type="button" className="ec-btn ec-btn--sm ec-btn--gold" onClick={() => setCosmetic('back', null)}>
                Use it
              </button>
            ) : (
              <span className="ec-kicker text-gold">In use</span>
            )}
          </div>
        </li>
        {MILESTONES.map((m) => {
          const open = unlocked.has(m.id);
          const on = (m.kind === 'binder' || m.kind === 'back') && active[m.kind] === m.key ? true : (m.kind === 'pyro' && open && pyro) || (m.kind === 'slab' && !!slab) || (m.kind === 'case' && open);
          const share = value == null ? 0 : Math.min(1, value / m.at);
          return (
            <li key={m.id} className={cn('rw-card', open && 'is-open', on && 'is-on')}>
              <div className="rw-card__stage">
                <div className={cn('rw-card__prev', !open && 'is-locked')}>
                  <Preview m={m} props={{ state, top, byKey, total, pyro: open && pyro, cups }} />
                </div>
                {!open && <Lock className="rw-card__lock" aria-hidden="true" />}
              </div>
              <p className="ec-kicker">
                {short(m.at)} · {KIND_LABEL[m.kind]}
              </p>
              <p className="rw-card__name">{m.label}</p>
              <p className="rw-card__blurb">{m.blurb}</p>
              <div className="rw-card__act">
                {open ? (
                  action(m, open)
                ) : (
                  <div className="flex w-full items-center gap-2">
                    <span className="ec-meter flex-1" role="progressbar" aria-label={`${m.label}: ${Math.round(share * 100)}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
                      <i style={{ width: `${share * 100}%` }} />
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{Math.round(share * 100)}%</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="rw-pen-title" className="rw-wall">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="ec-kicker">Club pennants</p>
            <h3 id="rw-pen-title" className="font-display text-2xl font-extrabold uppercase">
              Pennant wall
            </h3>
          </div>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            <b className="text-foreground">{doneClubs}</b> / {NFL_TEAMS.length}
          </span>
        </div>
        <ul className="rw-wall__grid">
          {wall.map((w) => (
            <li key={w.team.id} className={cn('rw-wall__item', w.done && 'is-done')}>
              <Pennant club={w.team.name} locked={!w.done} />
              <span className="rw-wall__n">{w.total ? `${w.have}/${w.total}` : '–'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default Milestones;
