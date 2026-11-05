import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Play, RotateCcw, Shirt } from 'lucide-react';
import { isLite } from '@/hooks/usePerfMode';
import { cn } from '@/lib/utils';
import { sfx } from '@/utils/sfx';
import {
  FINISHES,
  PACKS,
  PRIZM_ODDS,
  PRIZM_PARALLELS,
  SHELF_ORDER,
  TIERS,
  VARIANTS,
  finishLabel,
  groupByTier,
  kitChance,
  packOdds,
  prizmAnyChance,
  prizmStamp,
  rollKit,
  rollPack,
  rollPrizm,
  tierLabel,
  variantLabel,
  variantWeights,
  type Finish,
  type PackCard,
  type PackType,
  type PrizmCopy,
  type PrizmParallel,
  type RolledCard,
  type Tier,
  type TierPool,
  type Variant,
} from '@/utils/collection';
import { findNFLTeam } from '@/utils/nflTeams';
import CollectibleCard from '../../CollectibleCard';
import PackOpening, { PackArt } from '../../PackOpening';
import Walkout from '../../Walkout';
import { designRows, samplePack } from '../../designSamples';
import type { CardInfo } from '../../useCardPool';
import { walkoutBeats, skipStep, type WkBeat } from '../../walkoutBeats';
import JerseyArt from '../JerseyArt';
import { paletteFor } from '../shared';
import { kitName, kitsOf, type Uniform } from '../sprite/uniforms';
import { KIT_SOURCE, clubKits } from '../../kits';
import { Chips, Lazy } from './LabParts';
import AutographPreview from '../../autograph/AutographPreview';

/** What every lab tab receives: the picked player, every league card (for sample packs) and the set size. */
export interface LabTabProps {
  pick: CardInfo;
  league: CardInfo[];
  total: number;
}

/** One entry of the tab registry (ArtLab renders the strip from LAB_TABS; only the open tab mounts). */
export interface LabTab {
  key: string;
  label: string;
  /** One line under the tab strip, after the player's name */
  hint: string;
  Tab: ComponentType<LabTabProps>;
}

const CARD_RATIO = '100 / 142';
const STANDARD = packOdds('standard');
const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
/** Kit odds: one decimal, trailing zero dropped ("2.5%", "4%", "88.5%"). */
const kitPct = (x: number) => `${Number((x * 100).toFixed(1))}%`;

/** Parallel odds: one in N for the rare ones ("0.02% (1 in 5,000)"), else a percentage. */
const oddsPct = (x: number) => (x < 0.01 ? `${Number((x * 100).toFixed(3))}% (1 in ${Math.round(1 / x).toLocaleString('en-US')})` : kitPct(x));
/** A sample serial for the lab: his jersey number when it fits the run, else 1 (a Black is always 1/1). */
const sampleSerial = (c: PrizmParallel, number: number | null | undefined) => {
  const run = PRIZM_PARALLELS.find((p) => p.key === c)!.run;
  return number && number >= 1 && number <= run ? number : 1;
};

/** Same rule as the pack dialog: performance mode or the OS setting means the short versions. */
const reducedMotion = () => {
  try {
    return isLite() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** A card as the pack dialog wants it. Preview mode hides the NEW / duplicate tags, so the flags don't matter. */
const asPackCard = (c: RolledCard): PackCard => ({ ...c, isNew: true, newVariant: false, upgrade: false, newKit: false, newParallel: false, duplicate: false, shards: 0 });

const weighted = <K extends string>(w: Record<K, number>): K => {
  const items = Object.entries(w) as [K, number][];
  let r = Math.random() * items.reduce((s, [, x]) => s + x, 0);
  for (const [k, x] of items) {
    r -= x;
    if (r <= 0) return k;
  }
  return items[items.length - 1][0];
};

/** A Legends Exchange pack is planned from retired legend cards, never rolled: the preview stands in a typical one. */
const EXCHANGE_PLAN: [Tier, Finish][] = [
  ['rare', 'base'],
  ['rare', 'silver'],
  ['epic', 'base'],
  ['epic', 'gold'],
  ['legendary', 'silver'],
];

/** A throwaway pack of `type` at its real odds (rollPack never touches storage). */
const rollSample = (type: PackType, pool: TierPool): PackCard[] => {
  if (type !== 'exchange') return rollPack(type, pool, Math.random, KIT_SOURCE).map(asPackCard);
  const taken = new Set<string>();
  return EXCHANGE_PLAN.flatMap(([tier, finish]) => {
    const list = pool[tier].filter((p) => !taken.has(`${p.position}:${p.name}`));
    const player = list[Math.floor(Math.random() * list.length)];
    if (!player) return [];
    taken.add(`${player.position}:${player.name}`);
    const variant = weighted(variantWeights('exchange', tier, finish));
    const kit = rollKit('exchange', clubKits(player.team), variant);
    const prizm = rollPrizm('exchange', variant);
    return [asPackCard({ player, tier, finish, variant, kit, ...(prizm ? { prizm } : {}), slot: 'chase' })];
  });
};

// ---------- Pack opening: the real pack dialog, in preview mode ----------

type Mix = 'odds' | 'showcase';

export const PacksTab = memo(({ league, total }: LabTabProps) => {
  const [type, setType] = useState<PackType>('standard');
  const [mix, setMix] = useState<Mix>('odds');
  const [playing, setPlaying] = useState<PackType | null>(null);
  const [plays, setPlays] = useState(0);
  const byKey = useMemo(() => new Map(league.map((c) => [c.key, c])), [league]);
  const pool = useMemo<TierPool>(() => {
    const g = groupByTier(league, (c) => c.tier);
    return { common: g.common.map((c) => c.player), rare: g.rare.map((c) => c.player), epic: g.epic.map((c) => c.player), legendary: g.legendary.map((c) => c.player) };
  }, [league]);
  // The Card designs sample: a Common, a Rare, two Epics and a Legendary Holo Autograph, so every reveal plays once
  const showcase = useMemo(() => samplePack(designRows(league), league), [league]);
  const describe = useCallback((c: PackCard) => byKey.get(`${c.player.position}:${c.player.name}`)!, [byKey]);
  // Fresh objects every tear, so the walkout decoys re-roll on Replay
  const onTear = useCallback((t: PackType) => (mix === 'showcase' ? showcase.map((c) => ({ ...c })) : rollSample(t, pool)), [mix, showcase, pool]);
  const play = () => {
    setPlays((n) => n + 1);
    setPlaying(type);
  };
  return (
    <section aria-label="Pack opening" className="lab-sec">
      <div className="lab-packs" role="radiogroup" aria-label="Pack type">
        {SHELF_ORDER.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={type === t} className={cn('lab-pack', type === t && 'is-on')} onClick={() => setType(t)}>
            <span className={cn('pk-pack', `pk-pack--${t}`)}>
              <PackArt type={t} small />
            </span>
            <span className="lab-pack__name">{PACKS[t].label.replace(/ Pack$/, '')}</span>
          </button>
        ))}
      </div>
      <p className="lab-note">
        <b>{PACKS[type].label}.</b> {type === 'exchange' ? 'Built from retired legend cards; the preview deals a typical one.' : PACKS[type].guarantee}
      </p>
      <Chips<Mix>
        label="Cards"
        value={mix}
        options={[
          { key: 'odds', label: 'Rolled at real odds' },
          { key: 'showcase', label: 'Every reveal' },
        ]}
        onChange={setMix}
      />
      <div className="lab-play">
        <button type="button" className="lab-play__btn" onClick={play} disabled={!league.length}>
          {plays ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {plays ? 'Replay' : 'Open a sample pack'}
        </button>
        <span className="lab-note">
          {mix === 'showcase' ? 'A Common, a Rare, two Epics and a Legendary Autograph that turns Holo, every art once. ' : 'Different cards every time. '}
          Nothing is added and no pack is used.
        </span>
      </div>
      {plays > 0 && (
        <PackOpening preview type={playing} onClose={() => setPlaying(null)} onTear={onTear} describe={describe} total={total} remaining={0} />
      )}
    </section>
  );
});
PacksTab.displayName = 'PacksTab';

// ---------- Walkout: one reveal at a time, inside the lab ----------

interface Run {
  card: PackCard;
  beats: WkBeat[];
  step: number;
}

export const WalkoutTab = memo(({ pick, total }: LabTabProps) => {
  const [tier, setTier] = useState<Tier>('legendary');
  const [finish, setFinish] = useState<Finish>('holo');
  const [variant, setVariant] = useState<Variant>('jersey');
  const [kit, setKit] = useState('home');
  const [par, setPar] = useState<PrizmParallel | 'plain'>('plain');
  const [run, setRun] = useState<Run | null>(null);
  const [played, setPlayed] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const clubKits = useMemo(() => {
    const k = kitsOf(pick.player.team);
    return [k.home, ...k.alts, ...(k.era ? [k.era] : [])];
  }, [pick.player.team]);
  // A new choice stops the one playing
  useEffect(() => setRun(null), [tier, finish, variant, kit, par]);
  // Each beat holds for its own time, then the next starts (a tap advances early), as in the pack dialog
  useEffect(() => {
    const ms = run?.beats[run.step]?.ms ?? 0;
    if (!run || ms <= 0) return;
    const id = window.setTimeout(() => setRun((r) => (r ? { ...r, step: Math.min(r.step + 1, r.beats.length - 1) } : r)), ms);
    return () => window.clearTimeout(id);
  }, [run]);
  const play = () => {
    const prizm: PrizmCopy | undefined = variant === 'number' && par !== 'plain' ? { c: par, n: sampleSerial(par, pick.number) } : undefined;
    const card = asPackCard({ player: pick.player, tier, finish, variant, kit: variant === 'auto' ? 'home' : kit, ...(prizm ? { prizm } : {}), slot: 'regular' });
    sfx('walkout');
    setPlayed(true);
    const reduced = reducedMotion();
    setRun({ card, beats: walkoutBeats(card, reduced), step: 0 });
    // On a phone the chips push the stage below the fold: bring it into view
    stageRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  };
  const sample = `${tierLabel(tier)} · ${finishLabel(finish)} · ${variantLabel(variant)}`;
  return (
    <section aria-label="Walkout" className="lab-sec">
      <Chips<Tier> label="Tier" value={tier} options={TIERS.map((t) => ({ key: t.key, label: t.label }))} onChange={setTier} />
      <Chips<Finish> label="Finish" value={finish} options={FINISHES.map((f) => ({ key: f.key, label: f.label }))} onChange={setFinish} />
      <Chips<Variant> label="Art" value={variant} options={VARIANTS.map((v) => ({ key: v.key, label: v.label }))} onChange={setVariant} />
      {clubKits.length > 1 && variant !== 'auto' && (
        <Chips<string> label="Kit" value={kit} options={clubKits.map((u) => ({ key: u.id, label: u.era ? `${u.label} (throwback)` : kitName(u) }))} onChange={setKit} />
      )}
      {variant === 'number' && (
        <Chips<PrizmParallel | 'plain'>
          label="Parallel"
          value={par}
          options={[{ key: 'plain', label: 'Plain' }, ...PRIZM_PARALLELS.map((p) => ({ key: p.key, label: `${p.label} ${p.run === 1 ? '1/1' : `/${p.run}`}` }))]}
          onChange={setPar}
        />
      )}
      <div className="lab-play">
        <button type="button" className="lab-play__btn" onClick={play}>
          {played ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {played ? 'Replay' : 'Play walkout'}
        </button>
        <span className="lab-note">
          {finish === 'holo'
            ? 'Hidden holo: it walks out like a normal card of its tier, flips, then shatters into a Holo.'
            : tier === 'legendary'
              ? 'Every Legendary walks out.'
              : variant === 'auto'
                ? 'Every Autograph walks out.'
                : variant === 'number' && (par === 'gold' || par === 'black')
                  ? `Every ${par === 'gold' ? 'Gold /10' : 'Black 1/1'} Prizm walks out, with its PRIZM beat.`
                : 'In a pack this one walks out only as a decoy (about one card in five).'}
          {variant === 'auto' && finish === 'holo' ? ' Then the AUTOGRAPH beat signs it.' : variant === 'auto' && tier === 'legendary' ? ' The AUTOGRAPH beat signs it last.' : ''}
        </span>
      </div>
      <div ref={stageRef} className="lab-stage">
        {run ? (
          <Walkout
            card={run.card}
            info={pick}
            total={total}
            beats={run.beats}
            step={run.step}
            reduced={reducedMotion()}
            onAdvance={() => setRun((r) => (r ? { ...r, step: Math.min(r.step + 1, r.beats.length - 1) } : r))}
            onSkip={() => setRun((r) => (r ? { ...r, step: skipStep(r.beats, r.step) } : r))}
            onDone={() => setRun(null)}
          />
        ) : (
          <button type="button" className="lab-stage__idle" onClick={play}>
            <Play className="h-8 w-8" aria-hidden="true" />
            <b>{pick.player.name}</b>
            <span>{sample}</span>
          </button>
        )}
      </div>
    </section>
  );
});
WalkoutTab.displayName = 'WalkoutTab';

// ---------- Card designs: his card in each art, plus his club's uniform roll ----------

/** Team jersey art in a given uniform. */
const jerseyArt = (info: CardInfo, uniform: Uniform) => <JerseyArt player={info.player} number={info.number} pal={paletteFor(info.player, uniform)} uniform={uniform} />;

const LabCard = ({ info, finish, variant, total, uniform, prizm }: { info: CardInfo; finish: Finish; variant: Variant; total: number; uniform?: Uniform; prizm?: PrizmCopy }) => (
  <Lazy ratio={CARD_RATIO}>
    <CollectibleCard
      owned
      player={info.player}
      tier={info.tier}
      finish={finish}
      variant={variant}
      prizm={prizm}
      autograph="sample"
      ovr={info.ovr}
      number={info.number}
      stats={info.stats}
      setNo={info.setNo}
      setTotal={total}
      art={uniform ? jerseyArt(info, uniform) : undefined}
    />
  </Lazy>
);

export const DesignsTab = memo(({ pick, total }: LabTabProps) => {
  const [finish, setFinish] = useState<Finish>('base');
  const [kits, setKits] = useState(false);
  const [pars, setPars] = useState(false);
  const team = findNFLTeam(pick.player.team);
  const uniforms = useMemo(() => {
    if (!team) return [];
    const k = kitsOf(team.name);
    return [k.home, ...k.alts, ...(k.era ? [k.era] : [])];
  }, [team]);
  return (
    <section aria-label="Card designs" className="lab-sec">
      <Chips<Finish> label="Finish" value={finish} options={FINISHES.map((f) => ({ key: f.key, label: f.label }))} onChange={setFinish} />
      <ul className="lab-cards" aria-label={`${pick.player.name}: the ${VARIANTS.length} art variants, ${finishLabel(finish)} finish`}>
        {VARIANTS.map((v) => (
          <li key={v.key}>
            <LabCard info={pick} finish={finish} variant={v.key} total={total} />
            <p className="lab-cap">
              <span className={`lab-tag vbadge--${v.key}`}>{v.short}</span>
              <b>{v.label}</b>
              <span>
                {pct(STANDARD.variants[v.key])} of Standard pulls ·{' '}
                {v.key === 'auto'
                  ? 'a sample roll (each pull rolls its own parallel, ink and serial)'
                  : v.key === 'number'
                    ? `home kit, plain here; each pull rolls its own kit, and a colour parallel on ${pct(prizmAnyChance('standard'))} of Standard Prizms`
                    : 'home kit here; each pull rolls its own kit'}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <div className="lab-kits">
        <button type="button" className="lab-chip" aria-expanded={pars} onClick={() => setPars((k) => !k)}>
          {pars ? 'Hide' : 'Show'} Prizm parallels ({PRIZM_PARALLELS.length})
        </button>
        {pars && (
          <>
            <p className="lab-note">
              Every Prizm number pull also rolls a colour parallel (most stay plain), numbered out of its run. Chance per Prizm card, Standard pack to Holo
              Showcase; any parallel {kitPct(prizmAnyChance('standard'))} to {kitPct(prizmAnyChance('holo'))}.
            </p>
            <ul className="lab-cards" aria-label="Prizm parallels">
              {PRIZM_PARALLELS.map((p) => (
                <li key={p.key}>
                  <LabCard info={pick} finish={finish} variant="number" total={total} prizm={{ c: p.key, n: sampleSerial(p.key, pick.number) }} />
                  <p className="lab-cap">
                    <span className="lab-tag">{prizmStamp(p.key)}</span>
                    <span>
                      {oddsPct(PRIZM_ODDS.standard[p.key])} Standard · {oddsPct(PRIZM_ODDS.holo[p.key])} Holo Showcase
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {team && uniforms.length > 0 && (
        <div className="lab-kits">
          <button type="button" className="lab-chip" aria-expanded={kits} onClick={() => setKits((k) => !k)}>
            <Shirt className="mr-1.5 inline h-4 w-4 align-[-3px]" aria-hidden="true" />
            {kits ? 'Hide' : 'Show'} {team.name} uniforms ({uniforms.length})
          </button>
          {kits && (
            <>
              <p className="lab-note">
                Every pull but the Autograph rolls its kit: the home uniform, a modern alternate or the club&apos;s era kit (a throwback). Chance per card,
                Standard pack to Holo Showcase, on the Team jersey art.
              </p>
              <ul className="lab-cards" aria-label={`${team.name} uniforms`}>
                {uniforms.map((u) => (
                  <li key={u.id}>
                    <LabCard info={pick} finish="base" variant="jersey" total={total} uniform={u} />
                    <p className="lab-cap">
                      {u.id !== 'home' && <span className="lab-tag">{u.era ? 'Throwback' : 'Alt kit'}</span>}
                      <b>{kitName(u)}</b>
                      <span>
                        {kitPct(kitChance('standard', clubKits(team.name), u.id))} Standard · {kitPct(kitChance('holo', clubKits(team.name), u.id))} Holo Showcase
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
});
DesignsTab.displayName = 'DesignsTab';

// ---------- Registry ----------

/**
 * The Art lab's tabs, in strip order. To add one, write a component taking LabTabProps and add an entry; ArtLab
 * mounts only the open tab (remounted per player), inside the lab's scroll box (LabRootContext, for Lazy).
 */
/** A sample autograph for the picked player (never touches the collection; same rules as a pack's roll). */
const AutographsTab = ({ pick, league }: LabTabProps) => <AutographPreview cards={league} player={pick} />;

export const LAB_TABS: LabTab[] = [
  { key: 'packs', label: 'Pack opening', hint: 'Pick a pack and open a sample of it: the real tear, tell, flips and walkouts.', Tab: PacksTab },
  { key: 'walkout', label: 'Walkout', hint: 'His walkout at any tier, finish, art and kit, one at a time.', Tab: WalkoutTab },
  { key: 'designs', label: 'Card designs', hint: "His card in each of the five art variants at one finish (the Autograph a sample roll), the Prizm parallels, and his club's uniforms.", Tab: DesignsTab },
  { key: 'autographs', label: 'Autographs', hint: 'His autograph as a pack would roll it: roll again for another parallel, pen, era and serial.', Tab: AutographsTab },
];
// The heavy grids (Combinations: 4 variants × 4 finishes; Uniforms: all 32 clubs) were replaced by these (owner:
// "update the artlab to be less intensive and show me just the parts of the cards opening"). The sprite tabs (Poses,
// Helmets, Faces) went with the Retro Bowl sprite card (owner: "Remove the sprite card from the game").
