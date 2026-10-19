import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Gift, Hammer, Info, Layers, Lock, Percent, Trophy, X } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { cn } from '@/lib/utils';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import TeamLogo from '@/components/brand/TeamLogo';
import CollectibleCard from '@/components/collection/CollectibleCard';
import { FINISH_ICON, FINISH_TEXT, TIER_ICON, TIER_TEXT } from '@/components/collection/rarityIcons';
import PackOpening from '@/components/collection/PackOpening';
import { byTierDesc, useCardPool, type CardInfo } from '@/components/collection/useCardPool';
import { matchPlayerByName, useLeagueContent } from '@/utils/leagueContent';
import { isHallOfFamer } from '@/config/stats';
import {
  CRAFT_COST,
  CRAFT_TIER_MULTIPLIER,
  DUPLICATE_SHARDS,
  EARNING_RULES,
  ELITE_GUARANTEE_TIER,
  EPIC_MIN_OVR,
  LEGENDARY_MIN_LEGACY,
  LEGEND_LEGENDARY_MIN_OVR,
  RARE_MIN_OVR,
  FINISHES,
  PACKS,
  PACK_ORDER,
  PERFECT_CHASE_FALLBACK_TIER,
  PERFECT_CHASE_HOLO_CHANCE,
  PERFECT_CHASE_SLOTS,
  PREMIUM_GUARANTEE_FINISH,
  TIERS,
  craftCost,
  craftUpgrade,
  dismissNotice,
  finishLabel,
  finishRank,
  nextFinish,
  openPack,
  packCount,
  packOdds,
  tierLabel,
  useCollection,
  type Finish,
  type PackType,
  type Tier,
} from '@/utils/collection';

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
type Own = 'all' | 'owned' | 'missing';
type Sort = 'set' | 'tier' | 'finish' | 'recent';

const MIN_CARD = 158;
const PAGE = 48;

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const PACK_SHORT: Record<PackType, string> = { standard: 'Standard', premium: 'Premium', elite: 'Elite', perfect: '18–0' };

/** Percent with enough precision for tiny odds. */
const fmtOdds = (x: number) => {
  const v = x * 100;
  if (v === 0) return '0%';
  if (v >= 10) return `${Math.round(v)}%`;
  if (v >= 1) return `${v.toFixed(1)}%`;
  if (v >= 0.1) return `${v.toFixed(2)}%`;
  return `${v.toFixed(3)}%`;
};
const oneIn = (x: number) => (x > 0 ? `1 in ${Math.round(1 / x).toLocaleString()}` : 'never');
const weightPct = <K extends string>(w: Record<K, number>, k: K) => {
  const t = (Object.values(w) as number[]).reduce((a, b) => a + b, 0);
  return t ? fmtOdds(w[k] / t) : '0%';
};

/**
 * Columns for the card grid: as many as fit at MIN_CARD, or a few fewer when that leaves fewer
 * empty spots in the last row (the last row is centered, so there are no holes either way).
 */
const useColumns = (count: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gap = width < 480 ? 10 : 14;
  const fit = Math.max(1, Math.floor((width + gap) / (MIN_CARD + gap)));
  const holes = (c: number) => (c - (count % c)) % c;
  const max = Math.min(fit, Math.max(1, count));
  // Short lists (two rows or fewer) may drop to about half the columns to even out the rows
  const min = count <= fit * 2 ? Math.max(2, Math.ceil(fit * 0.55)) : Math.max(2, fit - 1);
  let cols = max;
  for (let c = max - 1; c >= min; c--) if (holes(c) < holes(cols)) cols = c;
  return { ref, cols, gap };
};

const Chip = ({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) => (
  <button
    type="button"
    aria-pressed={active}
    aria-label={label}
    onClick={onClick}
    className={cn(
      'inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold transition-colors',
      active ? 'border-gold bg-gold/15 text-gold' : 'border-line bg-panel text-muted-foreground hover:text-foreground',
    )}
  >
    {children}
  </button>
);

const Select = ({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <label className="flex min-w-0 flex-col gap-1">
    <span className="font-pixel text-[9px] uppercase text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 min-w-0 rounded-md border border-line bg-panel px-2 text-sm text-foreground"
    >
      {children}
    </select>
  </label>
);

const Bar = ({ value, className }: { value: number; className?: string }) => (
  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-black/40" aria-hidden="true">
    <span className={cn('block h-full rounded-full bg-gold transition-[width] duration-500', className)} style={{ width: `${value}%` }} />
  </span>
);

const ODDS = Object.fromEntries(PACK_ORDER.map((t) => [t, packOdds(t)])) as Record<PackType, ReturnType<typeof packOdds>>;

/** Exact chance of k Legendary Holos from the Perfect Season pack's chase slots (regular slots add a little). */
const chaseDistribution = () => {
  const p = PERFECT_CHASE_HOLO_CHANCE;
  const n = PERFECT_CHASE_SLOTS;
  const choose = (k: number) => {
    let c = 1;
    for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
    return c;
  };
  return Array.from({ length: n + 1 }, (_, k) => choose(k) * p ** k * (1 - p) ** (n - k));
};

const CollectionTab = () => {
  const { cards, byKey, tierPool, loaded } = useCardPool();
  const { state, cards: owned } = useCollection();
  const { content } = useLeagueContent();

  const [tier, setTier] = useState<Tier | 'all'>('all');
  const [finish, setFinish] = useState<Finish | 'all'>('all');
  const [pos, setPos] = useState<Position | 'all'>('all');
  const [team, setTeam] = useState('all');
  const [own, setOwn] = useState<Own>('all');
  const [sort, setSort] = useState<Sort>('set');
  const [limit, setLimit] = useState(PAGE);
  const [allTeams, setAllTeams] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);
  const [opening, setOpening] = useState<PackType | null>(null);
  const [craftKey, setCraftKey] = useState('');
  const [craftMsg, setCraftMsg] = useState('');

  useEffect(() => setLimit(PAGE), [tier, finish, pos, team, own, sort]);

  const isOwned = (c: CardInfo) => !!owned[c.key]?.best;
  const ownedCount = cards.filter(isOwned).length;

  const tierStats = useMemo(
    () =>
      TIERS.map((t) => {
        const list = cards.filter((c) => c.tier === t.key);
        return { ...t, total: list.length, have: list.filter((c) => !!owned[c.key]).length };
      }),
    [cards, owned],
  );
  /** Players owned at each finish (a player can count under several). */
  const finishStats = useMemo(
    () => FINISHES.map((f) => ({ ...f, have: cards.filter((c) => !!owned[c.key]?.counts[f.key]).length })),
    [cards, owned],
  );

  const franchises = useMemo(() => {
    const map = new Map<string, { name: string; team: string | null; total: number; have: number }>();
    cards.forEach((c) => {
      const e = map.get(c.franchise) ?? { name: c.franchise, team: c.player.isRealLegend ? null : c.player.team ?? null, total: 0, have: 0 };
      e.total++;
      if (owned[c.key]) e.have++;
      map.set(c.franchise, e);
    });
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [cards, owned]);

  const achievements = useMemo(() => {
    const players = cards.map((c) => c.player);
    const eras = (content?.eras ?? [])
      .map((era) => {
        const members = [
          ...new Map(
            era.keyPlayers
              .map((n) => matchPlayerByName(n, players))
              .filter((p): p is CardInfo['player'] => !!p)
              .map((p) => [`${p.position}:${p.name}`, p] as const),
          ).values(),
        ];
        const name = /dynasty|run|era|years/i.test(era.name) ? era.name : `${era.name} era`;
        return { id: era.id, title: `Complete the ${name}`, sub: `Y${era.startYear}–${era.endYear}`, members };
      })
      .filter((a) => a.members.length > 0);
    const extra = [
      { id: 'legacy-elite', title: 'Assemble the legacy elite', sub: 'Every Legendary player', members: cards.filter((c) => c.tier === 'legendary').map((c) => c.player) },
      { id: 'hof-wing', title: 'Fill the Hall of Fame wing', sub: 'Every Hall of Famer', members: cards.filter((c) => !c.player.isRealLegend && isHallOfFamer(c.player)).map((c) => c.player) },
      { id: 'legends-room', title: 'Open the Legends room', sub: 'Every NFL Legend', members: cards.filter((c) => c.player.isRealLegend).map((c) => c.player) },
    ].filter((a) => a.members.length > 0);
    return [...eras, ...extra].map((a) => ({ ...a, have: a.members.filter((p) => !!owned[`${p.position}:${p.name}`]).length }));
  }, [cards, content, owned]);

  const teamOptions = useMemo(() => [...new Set(cards.map((c) => c.franchise))].sort(), [cards]);

  // Any filter value that no longer matches an option (stale state, changed league data) counts as "all",
  // so a select that displays "All …" always filters as "All …".
  useEffect(() => {
    if (tier !== 'all' && !TIERS.some((t) => t.key === tier)) setTier('all');
    if (finish !== 'all' && !FINISHES.some((f) => f.key === finish)) setFinish('all');
    if (pos !== 'all' && !POSITIONS.includes(pos)) setPos('all');
    if (team !== 'all' && cards.length && !teamOptions.includes(team)) setTeam('all');
    if (!['all', 'owned', 'missing'].includes(own)) setOwn('all');
  }, [tier, finish, pos, team, own, cards.length, teamOptions]);

  const filtered = useMemo(() => {
    const list = cards.filter(
      (c) =>
        (tier === 'all' || c.tier === tier) &&
        (finish === 'all' || owned[c.key]?.best === finish) &&
        (pos === 'all' || c.player.position === pos) &&
        (team === 'all' || c.franchise === team) &&
        (own === 'all' || (own === 'owned') === !!owned[c.key]?.best),
    );
    const fr = (c: CardInfo) => (owned[c.key] ? finishRank(owned[c.key].best) : -1);
    if (sort === 'tier') return [...list].sort(byTierDesc);
    if (sort === 'finish') return [...list].sort((a, b) => fr(b) - fr(a) || byTierDesc(a, b));
    if (sort === 'recent') return [...list].sort((a, b) => (owned[b.key]?.last ?? 0) - (owned[a.key]?.last ?? 0) || a.setNo - b.setNo);
    return list;
  }, [cards, tier, finish, pos, team, own, sort, owned]);

  const { ref: gridRef, cols, gap } = useColumns(filtered.length);
  // Whole rows only while paging, so the grid never ends on a ragged row until the last page
  const shownCount = Math.min(filtered.length, Math.max(cols, Math.ceil(limit / cols) * cols));
  const shown = filtered.slice(0, shownCount);

  const craftable = useMemo(
    () =>
      cards
        .filter((c) => owned[c.key] && nextFinish(owned[c.key].best))
        .map((c) => {
          const to = nextFinish(owned[c.key].best)!;
          return { c, to, cost: craftCost(to, c.tier) };
        })
        .sort((a, b) => a.cost - b.cost || a.c.player.name.localeCompare(b.c.player.name)),
    [cards, owned],
  );
  const craftPick = craftable.find((x) => x.c.key === craftKey) ?? null;

  const craft = () => {
    if (!craftPick) return;
    const done = craftUpgrade(craftPick.c.player, craftPick.c.tier);
    setCraftMsg(done ? `${craftPick.c.player.name} is now ${finishLabel(done)}.` : 'Not enough shards.');
    if (done) setCraftKey('');
  };

  const resetFilters = () => {
    setTier('all');
    setFinish('all');
    setPos('all');
    setTeam('all');
    setOwn('all');
  };

  const totalPacks = PACK_ORDER.reduce((s, t) => s + packCount(state, t), 0);
  const chase = chaseDistribution();

  return (
    <div className="container space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {!state.noticeSeen && (
        <section aria-labelledby="col-notice" className="flex gap-3 rounded-xl border border-gold/50 bg-gold/10 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <h2 id="col-notice" className="font-display text-lg uppercase">
              New: reward packs
            </h2>
            <p className="text-muted-foreground">
              {state.migrated ? 'Your binder was reset. ' : ''}
              Games no longer hand out specific cards. Strong Arcade results earn reward packs, and every card comes from opening one. Each pull rolls a
              player (Legendary players are rare) and a finish (Base, Silver, Gold or the very rare Holo). Duplicates become shards for crafting upgrades.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissNotice}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-black/30 hover:text-foreground"
            aria-label="Dismiss notice"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>
      )}

      {/* Progress header */}
      <section aria-labelledby="col-title" className="glass-card overflow-hidden">
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_minmax(300px,380px)] lg:items-start">
          <div className="min-w-0 space-y-3">
            <p className="font-pixel text-[10px] uppercase tracking-wider text-gold">Card binder</p>
            <h1 id="col-title" className="font-display text-4xl uppercase italic sm:text-5xl">
              Collection
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Every player in the vault has a card in four finishes. Earn packs in the Arcade, open them here.
            </p>
            <div className="space-y-1.5">
              <p className="flex items-baseline gap-2">
                <span className="font-display text-3xl tabular-nums text-chalk">{ownedCount}</span>
                <span className="text-muted-foreground">/ {cards.length} players collected</span>
                <span className="ml-auto font-mono text-sm text-gold">{pct(ownedCount, cards.length)}%</span>
              </p>
              <div
                role="progressbar"
                aria-label="Collection progress"
                aria-valuemin={0}
                aria-valuemax={cards.length}
                aria-valuenow={ownedCount}
                aria-valuetext={`${ownedCount} of ${cards.length} players`}
              >
                <Bar value={pct(ownedCount, cards.length)} className="bg-gradient-to-r from-turf to-gold" />
              </div>
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Players collected by tier">
              {tierStats.map((t) => {
                const Icon = TIER_ICON[t.key];
                return (
                  <li key={t.key} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-xs">
                    <Icon className={cn('h-3.5 w-3.5', TIER_TEXT[t.key])} aria-hidden="true" />
                    <span className="font-semibold">{t.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {t.have}/{t.total}
                    </span>
                  </li>
                );
              })}
            </ul>
            <ul className="flex flex-wrap gap-2" aria-label="Players owned in each finish">
              {finishStats.map((f) => {
                const Icon = FINISH_ICON[f.key];
                return (
                  <li key={f.key} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel/60 px-2 py-1 text-xs">
                    <Icon className={cn('h-3.5 w-3.5', FINISH_TEXT[f.key])} aria-hidden="true" />
                    <span className="font-semibold">{f.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{f.have}</span>
                  </li>
                );
              })}
              <li className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel/60 px-2 py-1 text-xs">
                <Hammer className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span className="font-semibold">Shards</span>
                <span className="font-mono tabular-nums text-muted-foreground">{state.shards.toLocaleString()}</span>
              </li>
            </ul>
          </div>

          {/* Pack shelf */}
          <div className="space-y-3 rounded-xl border border-gold/40 bg-gold/5 p-4" aria-labelledby="col-packs">
            <div className="flex items-center gap-2">
              <Gift className={cn('h-6 w-6 shrink-0 text-gold', totalPacks > 0 && 'motion-safe:animate-bounce')} aria-hidden="true" />
              <h2 id="col-packs" className="font-display text-xl uppercase">
                Your packs
              </h2>
              <span className="ml-auto font-mono text-sm tabular-nums text-gold">{totalPacks}</span>
            </div>
            <ul className="space-y-2">
              {PACK_ORDER.filter((t) => t !== 'perfect' || packCount(state, t) > 0).map((t) => {
                const n = packCount(state, t);
                return (
                  <li key={t} className="flex items-center gap-3 rounded-lg border border-line bg-panel/70 p-2">
                    <span className={cn('pk-mini', `pk-pack--${t}`)} aria-hidden="true">
                      {t === 'perfect' ? <Trophy className="h-4 w-4" /> : PACKS[t].size}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{PACKS[t].label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t === 'perfect' ? state.perfect[0]?.label : `${PACKS[t].size} cards`} · {n} unopened
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpening(t)}
                      disabled={!n || !loaded || !cards.length}
                      aria-label={`Open a ${PACKS[t].label} (${n} unopened)`}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-gold px-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Open
                    </button>
                  </li>
                );
              })}
            </ul>
            {totalPacks === 0 && <p className="text-xs text-muted-foreground">No packs yet. Earn them with strong results in the Arcade (see How to earn packs below).</p>}
          </div>
        </div>
      </section>

      {/* Pack odds */}
      <section aria-labelledby="col-odds" className="space-y-3">
        <h2 id="col-odds" className="section-title">
          <Percent className="h-5 w-5 text-gold" aria-hidden="true" /> Pack odds
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every card is two rolls: which player, then which finish. <strong className="text-foreground">Legendary = the league&apos;s legacy elite</strong>{' '}
          (Career Legacy {LEGENDARY_MIN_LEGACY.toLocaleString()}+) and the top real NFL legends (OVR {LEGEND_LEGENDARY_MIN_OVR}+). Epic is every other Hall of
          Famer and legend, or OVR {EPIC_MIN_OVR}+; Rare is OVR {RARE_MIN_OVR}–{EPIC_MIN_OVR - 1}; Common is the rest. Odds below are per card; a Legendary
          Holo is the rarest card in the vault.
        </p>
        <div className="rounded-xl border border-line bg-panel/60">
          <table className="w-full table-fixed text-xs sm:text-sm">
            <caption className="sr-only">Chance per card by pack type</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="w-[30%] p-2 font-pixel text-[9px] uppercase text-muted-foreground sm:w-[28%]">
                  Per card
                </th>
                {PACK_ORDER.map((t) => (
                  <th key={t} scope="col" className="p-2 text-right font-semibold">
                    {PACK_SHORT[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {TIERS.map((t) => {
                const Icon = TIER_ICON[t.key];
                return (
                  <tr key={t.key} className="border-b border-line/50">
                    <th scope="row" className="p-2 text-left font-sans font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', TIER_TEXT[t.key])} aria-hidden="true" />
                        {t.label}
                      </span>
                    </th>
                    {PACK_ORDER.map((p) => (
                      <td key={p} className="p-2 text-right">
                        {fmtOdds(ODDS[p].tiers[t.key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {FINISHES.map((f, i) => {
                const Icon = FINISH_ICON[f.key];
                return (
                  <tr key={f.key} className={cn('border-b border-line/50', i === 0 && 'border-t-2 border-t-line')}>
                    <th scope="row" className="p-2 text-left font-sans font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', FINISH_TEXT[f.key])} aria-hidden="true" />
                        {f.label}
                      </span>
                    </th>
                    {PACK_ORDER.map((p) => (
                      <td key={p} className="p-2 text-right">
                        {fmtOdds(ODDS[p].finishes[f.key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr className="border-t-2 border-line bg-gold/5">
                <th scope="row" className="p-2 text-left font-sans font-semibold text-fuchsia-200">
                  Legendary Holo
                </th>
                {PACK_ORDER.map((p) => (
                  <td key={p} className="p-2 text-right">
                    <span className="block">{fmtOdds(ODDS[p].legendaryHolo)}</span>
                    <span className="block font-sans text-[10px] text-muted-foreground">{oneIn(ODDS[p].legendaryHolo)}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {PACK_ORDER.map((t) => (
            <li key={t} className="flex gap-2 rounded-lg border border-line bg-panel/50 p-2.5">
              <span className={cn('pk-mini !h-9 !w-7 !text-sm', `pk-pack--${t}`)} aria-hidden="true">
                {t === 'perfect' ? <Trophy className="h-3 w-3" /> : PACKS[t].size}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{PACKS[t].label}</span>
                <span className="block text-xs text-muted-foreground">
                  {PACKS[t].guarantee}
                  {t === 'perfect' &&
                    ` Chase Holo chance ${Math.round(PERFECT_CHASE_HOLO_CHANCE * 100)}% each: 0/1/2/3 Legendary Holos from the chase slots ${chase.map((x) => fmtOdds(x)).join(' / ')}. Earned only by going 18–0, one per perfect season.`}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <details className="rounded-xl border border-line bg-panel/40 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Full weight tables, shards and crafting</summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {PACK_ORDER.filter((t) => t !== 'perfect').map((t) => (
              <div key={t} className="min-w-0">
                <p className="mb-1 font-semibold">{PACKS[t].label}: finish by tier (regular slots)</p>
                <table className="w-full table-fixed font-mono text-xs tabular-nums">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th scope="col" className="w-[34%] py-1 font-sans font-normal">
                        Tier (odds)
                      </th>
                      {FINISHES.map((f) => (
                        <th key={f.key} scope="col" className="py-1 text-right font-sans font-normal">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIERS.map((tt) => (
                      <tr key={tt.key} className="border-t border-line/40">
                        <th scope="row" className="py-1 text-left font-sans font-semibold">
                          {tt.label} <span className="font-mono font-normal text-muted-foreground">{weightPct(PACKS[t].tiers, tt.key)}</span>
                        </th>
                        {FINISHES.map((f) => (
                          <td key={f.key} className="py-1 text-right">
                            {weightPct(PACKS[t].finishes[tt.key], f.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Premium guarantee:</span> if the first three cards have no Gold or Holo, the last card rolls
                Gold or Holo ({TIERS.map((t) => `${t.label} ${weightPct(PREMIUM_GUARANTEE_FINISH[t.key], 'holo')} Holo`).join(', ')}).
              </p>
              <p>
                <span className="font-semibold text-foreground">Elite guarantee:</span> if the first four cards have no Epic or Legendary player, the last
                card is Epic ({weightPct(ELITE_GUARANTEE_TIER, 'epic')}) or Legendary ({weightPct(ELITE_GUARANTEE_TIER, 'legendary')}).
              </p>
              <p>
                <span className="font-semibold text-foreground">Perfect Season pack:</span> two cards at Elite odds, then {PERFECT_CHASE_SLOTS} chase cards:
                each a Legendary Holo ({Math.round(PERFECT_CHASE_HOLO_CHANCE * 100)}%) or else a Gold card of an Epic (
                {weightPct(PERFECT_CHASE_FALLBACK_TIER, 'epic')}) or Legendary ({weightPct(PERFECT_CHASE_FALLBACK_TIER, 'legendary')}) player.
              </p>
              <p>
                <span className="font-semibold text-foreground">Duplicates</span> (same player and finish) give shards:{' '}
                {FINISHES.map((f) => `${f.label} ${DUPLICATE_SHARDS[f.key]}`).join(', ')}.
              </p>
              <p>
                <span className="font-semibold text-foreground">Crafting</span> one finish up costs Silver {CRAFT_COST.silver}, Gold {CRAFT_COST.gold}, Holo{' '}
                {CRAFT_COST.holo} shards, × {TIERS.map((t) => `${CRAFT_TIER_MULTIPLIER[t.key]} ${t.label}`).join(', ')}.
              </p>
            </div>
          </div>
        </details>
      </section>

      {/* How to earn + workshop */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="col-earn" className="rounded-xl border border-line bg-panel/50 p-4">
          <h2 id="col-earn" className="section-title mb-3">
            <Gift className="h-5 w-5 text-gold" aria-hidden="true" /> How to earn packs
          </h2>
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            {EARNING_RULES.map((r) => (
              <div key={r.game} className="contents">
                <dt className="font-semibold">{r.game}</dt>
                <dd className="mb-1 text-muted-foreground sm:mb-0">{r.rules}</dd>
              </div>
            ))}
          </dl>
          {state.earned.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Last earned: {PACKS[state.earned[0].type].label} ({state.earned[0].reason})
            </p>
          )}
        </section>

        <section aria-labelledby="col-craft" className="space-y-3 rounded-xl border border-line bg-panel/50 p-4">
          <h2 id="col-craft" className="section-title">
            <Hammer className="h-5 w-5 text-sky-300" aria-hidden="true" /> Workshop
          </h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{state.shards.toLocaleString()}</span> shards. Duplicates turn into shards; spend them to raise a card
            you own one finish.
          </p>
          {craftable.length ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Select label="Upgrade" value={craftKey} onChange={(v) => (setCraftKey(v), setCraftMsg(''))}>
                <option value="">Choose a card…</option>
                {craftable.map(({ c, to, cost }) => (
                  <option key={c.key} value={c.key}>
                    {c.player.name}: {finishLabel(owned[c.key].best)} → {finishLabel(to)} ({cost.toLocaleString()})
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={craft}
                disabled={!craftPick || craftPick.cost > state.shards}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-sky-300/60 px-3 text-sm font-bold text-sky-200 transition hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {craftPick && craftPick.cost > state.shards ? `Need ${(craftPick.cost - state.shards).toLocaleString()} more` : 'Craft'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Open packs to get cards you can upgrade.</p>
          )}
          <p className="text-xs text-gold" role="status">
            {craftMsg}
          </p>
        </section>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <section aria-labelledby="col-ach">
          <h2 id="col-ach" className="section-title mb-3">
            <Trophy className="h-5 w-5 text-gold" aria-hidden="true" /> Sets
          </h2>
          <ul className="relative -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" aria-label="Set achievements">
            {achievements.map((a) => {
              const done = a.have === a.members.length;
              return (
                <li key={a.id} className={cn('w-64 shrink-0 space-y-2 rounded-xl border p-3', done ? 'border-gold bg-gold/10' : 'border-line bg-panel')}>
                  <div className="flex items-start gap-2">
                    <span
                      className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full', done ? 'bg-gold text-primary-foreground' : 'bg-black/40 text-muted-foreground')}
                      aria-hidden="true"
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-base uppercase leading-tight">{a.title}</p>
                      <p className="font-pixel text-[9px] uppercase text-muted-foreground">
                        {a.sub} · {a.have}/{a.members.length}
                        <span className="sr-only">{done ? ', complete' : ''}</span>
                      </p>
                    </div>
                  </div>
                  <Bar value={pct(a.have, a.members.length)} />
                  {a.members.length <= 10 && (
                    <p className="text-xs leading-snug text-muted-foreground">
                      {a.members.map((p, i) => (
                        <span key={`${p.position}:${p.name}`} className={owned[`${p.position}:${p.name}`] ? 'text-chalk' : 'opacity-60'}>
                          {i > 0 && ', '}
                          {p.name}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Franchise completion */}
      <section aria-labelledby="col-fr">
        <h2 id="col-fr" className="section-title mb-3">
          <Layers className="h-5 w-5 text-gold" aria-hidden="true" /> By franchise
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(allTeams ? franchises : franchises.slice(0, 8)).map((f) => (
            <li key={f.name}>
              <button
                type="button"
                onClick={() => setTeam(team === f.name ? 'all' : f.name)}
                aria-pressed={team === f.name}
                aria-label={`${f.name}: ${f.have} of ${f.total} players, ${pct(f.have, f.total)}%. Filter the binder`}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors',
                  team === f.name ? 'border-gold bg-gold/10' : 'border-line bg-panel hover:border-gold/50',
                )}
              >
                {f.team ? <TeamLogo team={f.team} size={28} decorative /> : <span className="grid h-7 w-7 place-items-center text-gold" aria-hidden="true">★</span>}
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">{f.name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{pct(f.have, f.total)}%</span>
                  </span>
                  <Bar value={pct(f.have, f.total)} className={f.have === f.total ? 'bg-turf' : undefined} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        {franchises.length > 8 && (
          <button type="button" onClick={() => setAllTeams((v) => !v)} className="mt-2 text-sm font-semibold text-gold hover:underline" aria-expanded={allTeams}>
            {allTeams ? 'Show fewer' : `Show all ${franchises.length} franchises`}
          </button>
        )}
      </section>

      {/* Binder */}
      <section aria-labelledby="col-binder" className="space-y-4">
        <h2 id="col-binder" className="section-title">
          Binder
        </h2>
        <div className="space-y-3 rounded-xl border border-line bg-panel/60 p-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Tier">
            <Chip active={tier === 'all'} onClick={() => setTier('all')}>
              All tiers
            </Chip>
            {TIERS.map((t) => {
              const Icon = TIER_ICON[t.key];
              return (
                <Chip key={t.key} active={tier === t.key} onClick={() => setTier(tier === t.key ? 'all' : t.key)}>
                  <Icon className={cn('h-3.5 w-3.5', TIER_TEXT[t.key])} aria-hidden="true" />
                  {t.label}
                </Chip>
              );
            })}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Best finish owned">
            <Chip active={finish === 'all'} onClick={() => setFinish('all')}>
              Any finish
            </Chip>
            {FINISHES.map((f) => {
              const Icon = FINISH_ICON[f.key];
              return (
                <Chip key={f.key} active={finish === f.key} onClick={() => setFinish(finish === f.key ? 'all' : f.key)} label={`Best finish ${f.label}`}>
                  <Icon className={cn('h-3.5 w-3.5', FINISH_TEXT[f.key])} aria-hidden="true" />
                  {f.label}
                </Chip>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select label="Show" value={own} onChange={(v) => setOwn(v as Own)}>
              <option value="all">All cards</option>
              <option value="owned">Collected</option>
              <option value="missing">Missing</option>
            </Select>
            <Select label="Position" value={pos} onChange={(v) => setPos(v as Position | 'all')}>
              <option value="all">All positions</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select label="Team" value={team} onChange={setTeam}>
              <option value="all">All teams</option>
              {teamOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)}>
              <option value="set">Set number</option>
              <option value="tier">Tier</option>
              <option value="finish">Best finish</option>
              <option value="recent">Recently pulled</option>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {!loaded ? 'Loading cards…' : !cards.length ? 'No cards yet' : `${filtered.length} card${filtered.length === 1 ? '' : 's'} · ${filtered.filter(isOwned).length} collected`}
        </p>

        <div ref={gridRef}>
          {!loaded || !cards.length || filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted-foreground" role="status">
              {!loaded ? (
                'Loading cards…'
              ) : !cards.length ? (
                'Load league data to start a collection.'
              ) : (
                <>
                  No cards match.{' '}
                  <button type="button" className="font-semibold text-gold hover:underline" onClick={resetFilters}>
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <ul className="cc-grid" style={{ ['--cc-cols' as string]: cols, ['--cc-gap' as string]: `${gap}px` }} aria-label="Cards">
              {shown.map((c) => {
                const entry = owned[c.key];
                return (
                  <li key={c.key}>
                    <CollectibleCard
                      player={byKey.get(c.key)!.player}
                      tier={c.tier}
                      finish={entry?.best ?? 'base'}
                      owned={!!entry}
                      ovr={c.ovr}
                      number={c.number}
                      retiredBy={c.retiredBy}
                      setNo={c.setNo}
                      setTotal={cards.length}
                      hint={c.hint}
                      marks={entry?.marks}
                      onOpen={entry ? () => setSelected(c.player) : undefined}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {shownCount < filtered.length && (
          <div className="flex justify-center">
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="h-10 rounded-md border border-line bg-panel px-4 text-sm font-semibold hover:border-gold/60">
              Show more ({filtered.length - shownCount} left)
            </button>
          </div>
        )}
      </section>

      <PackOpening
        type={opening}
        onClose={() => setOpening(null)}
        onTear={(t) => openPack(t, tierPool)}
        describe={(pc) => byKey.get(`${pc.player.position}:${pc.player.name}`)!}
        total={cards.length}
        remaining={opening ? packCount(state, opening) : 0}
        provenance={state.perfect[0]?.label}
      />
      <PlayerDetailCard player={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default CollectionTab;
