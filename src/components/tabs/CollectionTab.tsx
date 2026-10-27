import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { GalleryHorizontal, Hammer, Info, LayoutGrid, Lock } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { cn } from '@/lib/utils';
import { reducedMotion, useStagger } from '@/utils/motion';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import CollectibleCard from '@/components/collection/CollectibleCard';
import CardDetail, { type CardDetailTarget } from '@/components/collection/CardDetail';
import CardBrowser from '@/components/collection/CardBrowser';
import { designRows, samplePack } from '@/components/collection/designSamples';
import { FINISH_ICON, FINISH_TEXT } from '@/components/collection/rarityIcons';
import PackOpening, { PackArt } from '@/components/collection/PackOpening';
import MarketView from '@/components/collection/market/MarketView';
import { byTierDesc, useCardPool, type CardInfo } from '@/components/collection/useCardPool';
import { FACE_LEGEND } from '@/components/collection/cardStats';
import VariantBadges from '@/components/collection/VariantBadges';
import ShardWorkshop from '@/components/collection/ShardWorkshop';
import { VARIANT_MULTIPLIER } from '@/utils/cardMarket';
import { matchPlayerByName, useLeagueContent } from '@/utils/leagueContent';
import { editionAccent } from '@/utils/edition';
import { isHallOfFamer } from '@/config/stats';
import {
  CLAIM_COST,
  CRAFT_COST,
  CRAFT_TIER_MULTIPLIER,
  CRAFT_VARIANT_MULTIPLIER,
  DUPLICATE_SHARDS,
  DUPLICATE_TIER_MULTIPLIER,
  PACK_SHARDS,
  EARNING_RULES,
  FINISHES,
  giftSummary,
  PACKS,
  PACK_ORDER,
  SHELF_ORDER,
  TIERS,
  VARIANTS,
  cardKey,
  displayOf,
  expectedShardsPerPack,
  finishRank,
  openPack,
  packCount,
  packOdds,
  redeemGift,
  tierRank,
  useCollection,
  variantsOwned,
  type Finish,
  type EarnablePack,
  type PackType,
  type Tier,
} from '@/utils/collection';

// The Card designs gallery and the Art lab are their own chunks, loaded the first time they open
const CardDesigns = lazy(() => import('@/components/collection/CardDesigns'));
const ArtLab = lazy(() => import('@/components/collection/art/ArtLab'));
const DialogFallback = () => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-night/70" role="status" aria-label="Loading">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold border-t-transparent" />
  </div>
);

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
type Sort = 'set' | 'ovr' | 'tier' | 'finish' | 'recent';
const PAGE = 60;

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const PACK_SHORT: Record<EarnablePack, string> = { standard: 'Std', premium: 'Prem', elite: 'Elite', perfect: '18–0', holo: 'Holo' };
const fmtOdds = (x: number) => {
  const v = x * 100;
  if (v === 0) return '–';
  if (v >= 10) return `${Math.round(v)}%`;
  if (v >= 1) return `${v.toFixed(1)}%`;
  return `${v.toFixed(2)}%`;
};
const oneIn = (p: number) => (p > 0 ? Math.round(1 / p).toLocaleString('en-US') : '–');
const ODDS = Object.fromEntries(PACK_ORDER.map((t) => [t, packOdds(t)])) as Record<EarnablePack, ReturnType<typeof packOdds>>;

const DESIGNS_HASH = /[?&]view=designs\b/;
const MARKET_HASH = /[?&]view=market\b/;
const ART_HASH = /[?&]view=art\b/;
const GIFT_HASH = /[?&]gift=([\w-]+)/;
const cleanHash = () => window.history.replaceState(window.history.state, '', '#collection');

const Chip = ({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) => (
  <button
    type="button"
    aria-pressed={active}
    aria-label={label}
    onClick={onClick}
    className={cn(
      'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors',
      active ? 'border-gold bg-gold/15 text-gold' : 'border-line bg-panel/70 text-muted-foreground hover:text-foreground',
    )}
  >
    {children}
  </button>
);

/** Odds, earning and crafting rules, behind the ⓘ. */
const RulesPopover = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="grid h-8 w-8 place-items-center rounded-full border border-line text-muted-foreground hover:border-gold/60 hover:text-gold"
        aria-label="Pack odds and rules"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="max-h-[calc(var(--dvh)*0.7)] w-[min(92vw,460px)] overflow-y-auto border-line bg-night p-3 text-xs">
      <table className="w-full table-fixed font-mono tabular-nums">
        <caption className="mb-1 text-left font-sans text-[11px] font-semibold">Chance per card</caption>
        <thead>
          <tr className="text-right text-muted-foreground">
            <th scope="col" className="w-[26%] text-left font-sans font-normal" />
            {PACK_ORDER.map((t) => (
              <th key={t} scope="col" className="font-sans font-semibold">
                {PACK_SHORT[t]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIERS.map((t) => (
            <tr key={t.key} className="border-t border-line/40 text-right">
              <th scope="row" className="py-0.5 text-left font-sans font-semibold">
                {t.label}
              </th>
              {PACK_ORDER.map((p) => (
                <td key={p}>{fmtOdds(ODDS[p].tiers[t.key])}</td>
              ))}
            </tr>
          ))}
          {FINISHES.map((f) => (
            <tr key={f.key} className="border-t border-line/40 text-right">
              <th scope="row" className="py-0.5 text-left font-sans font-semibold">
                {f.label}
              </th>
              {PACK_ORDER.map((p) => (
                <td key={p}>{fmtOdds(ODDS[p].finishes[f.key])}</td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-line text-left">
            <th scope="rowgroup" colSpan={PACK_ORDER.length + 1} className="pt-2 font-sans text-[11px] font-semibold">
              Art variant
            </th>
          </tr>
          {VARIANTS.map((v) => (
            <tr key={v.key} className="border-t border-line/40 text-right">
              <th scope="row" className="py-0.5 text-left font-sans font-semibold">
                {v.short}
              </th>
              {PACK_ORDER.map((p) => (
                <td key={p}>{fmtOdds(ODDS[p].variants[v.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-3 space-y-1 text-muted-foreground">
        {PACK_ORDER.map((t) => (
          <li key={t}>
            <span className="font-semibold text-foreground">{PACKS[t].label}:</span> {PACKS[t].guarantee}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted-foreground">
        Every card rolls tier, then player, then finish, then art variant ({VARIANTS.map((v) => v.label).join(', ')}; the sprite is rarest). From
        Standard packs a Holo is about 1 card in {oneIn(ODDS.standard.finishes.holo)}, a Gold 1 in {oneIn(ODDS.standard.finishes.gold)} and a
        Legendary player 1 in {oneIn(ODDS.standard.tiers.legendary)}. The rarities stack: the rarer arts get rarer still on better players and
        finishes. A Retro Bowl sprite Holo is about 1 card in {oneIn(ODDS.holo.spriteHolo)} from Holo Showcase packs, and a sprite Holo Legendary
        about 1 in {oneIn(Math.max(...PACK_ORDER.map((t) => ODDS[t].spriteLegendaryHolo)))} even from the best pack. A player can own every
        variant and they stack in the binder. Market value × variant: {VARIANTS.map((v) => `${v.short} ×${VARIANT_MULTIPLIER[v.key]}`).join(', ')}.
      </p>
      <p className="mt-3 font-semibold">Earn packs</p>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {EARNING_RULES.map((r) => (
          <li key={r.game}>
            <span className="text-foreground">{r.game}</span> · {r.rules}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted-foreground">
        Shards: every pack opened gives {PACK_ORDER.map((t) => `${PACK_SHORT[t]} ${PACK_SHARDS[t]}`).join(', ')}; duplicates (same player, variant
        and finish) give {FINISHES.map((f) => `${f.label} ${DUPLICATE_SHARDS[f.key]}`).join(', ')}, × {TIERS.slice(1).map((t) => `${t.label} ${DUPLICATE_TIER_MULTIPLIER[t.key]}`).join(', ')}.
        Claim a chosen player&apos;s Base card for {TIERS.map((t) => `${t.label} ${CLAIM_COST[t.key].toLocaleString()}`).join(', ')} shards (a Legend claim
        for a Legendary). Upgrading one finish costs {CRAFT_COST.silver}/{CRAFT_COST.gold}/{CRAFT_COST.holo.toLocaleString()} (Silver/Gold/Holo), ×{' '}
        {TIERS.slice(1).map((t) => `${t.label} ${CRAFT_TIER_MULTIPLIER[t.key]}`).join(', ')} and × art ({VARIANTS.filter((v) => CRAFT_VARIANT_MULTIPLIER[v.key] !== 1).map((v) => `${v.short} ${CRAFT_VARIANT_MULTIPLIER[v.key]}`).join(', ')}). Open any card to claim or upgrade it.
      </p>
      <p className="mt-3 font-semibold">Card stats</p>
      <p className="mt-0.5 text-muted-foreground">
        {FACE_LEGEND.map((s) => `${s.code} ${s.name}`).join(' · ')}. Each is 0–99 from his percentile at the position.
      </p>
    </PopoverContent>
  </Popover>
);

const CollectionTab = () => {
  const { cards, byKey, tierPool, loaded } = useCardPool();
  const { state, cards: owned, fresh } = useCollection();
  const { content } = useLeagueContent();

  const [tier, setTier] = useState<Tier | 'all'>('all');
  const [finish, setFinish] = useState<Finish | 'all'>('all');
  const [pos, setPos] = useState<Position | 'all'>('all');
  const [team, setTeam] = useState('all');
  const [missing, setMissing] = useState(true);
  const [sort, setSort] = useState<Sort>('set');
  const [limit, setLimit] = useState(PAGE);
  const [player, setPlayer] = useState<Player | null>(null);
  const [detail, setDetail] = useState<CardDetailTarget | null>(null);
  const [opening, setOpening] = useState<PackType | null>(null);
  const [designs, setDesigns] = useState(false);
  const [preview, setPreview] = useState(false);
  const [artLab, setArtLab] = useState(false);
  // Swipe browser over the binder's filter; browseFocus follows CardDetail when it steps to another card on top of it
  const [browsing, setBrowsing] = useState(false);
  const [browseFocus, setBrowseFocus] = useState<string | null>(null);
  // Once opened, the lazy dialogs stay mounted so they close with their animation and reopen instantly
  const [designsSeen, setDesignsSeen] = useState(false);
  const [artLabSeen, setArtLabSeen] = useState(false);
  useEffect(() => void (designs && setDesignsSeen(true)), [designs]);
  useEffect(() => void (artLab && setArtLabSeen(true)), [artLab]);

  useEffect(() => setLimit(PAGE), [tier, finish, pos, team, missing, sort]);

  // #collection?gift=<id> redeems a one-time gift; #collection?view=designs opens the Card designs gallery, ?view=art the Art lab
  useEffect(() => {
    const check = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#collection')) return;
      const gift = hash.match(GIFT_HASH)?.[1];
      if (gift) {
        const r = redeemGift(gift);
        if (r === 'granted') toast.success(`New packs added: ${giftSummary(gift)}`, { description: 'Tap a pack below to open it.' });
        else if (r === 'already') toast('That gift was already redeemed on this browser.');
        cleanHash();
      }
      if (DESIGNS_HASH.test(hash)) setDesigns(true);
      if (MARKET_HASH.test(hash)) window.setTimeout(() => document.getElementById('col-market')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }), 50);
      if (ART_HASH.test(hash)) setArtLab(true);
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  const closeDesigns = () => {
    setDesigns(false);
    if (DESIGNS_HASH.test(window.location.hash)) cleanHash();
  };
  const closeArtLab = () => {
    setArtLab(false);
    if (ART_HASH.test(window.location.hash)) cleanHash();
  };

  const ownedCount = useMemo(() => cards.filter((c) => !!owned[c.key]).length, [cards, owned]);
  const variantCount = useMemo(() => variantsOwned(owned, cards.map((c) => c.key)), [cards, owned]);
  const tierStats = useMemo(
    () =>
      TIERS.map((t) => {
        const list = cards.filter((c) => c.tier === t.key);
        return { ...t, total: list.length, have: list.filter((c) => !!owned[c.key]).length };
      }),
    [cards, owned],
  );

  const showcase = useMemo(
    () =>
      cards
        .filter((c) => owned[c.key])
        .sort(
          (a, b) =>
            tierRank(b.tier) - tierRank(a.tier) ||
            finishRank(owned[b.key].best) - finishRank(owned[a.key].best) ||
            Object.keys(owned[b.key].variants).length - Object.keys(owned[a.key].variants).length ||
            (b.ovr ?? 0) - (a.ovr ?? 0),
        )
        .slice(0, 10),
    [cards, owned],
  );

  const sets = useMemo(() => {
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
        return { id: era.id, title: era.name, members };
      })
      .filter((a) => a.members.length > 0);
    const extra = [
      { id: 'legacy-elite', title: 'Legacy elite', members: cards.filter((c) => c.tier === 'legendary').map((c) => c.player) },
      { id: 'hof-wing', title: 'Hall of Fame', members: cards.filter((c) => !c.player.isRealLegend && isHallOfFamer(c.player)).map((c) => c.player) },
    ].filter((a) => a.members.length > 0);
    // Set progress counts every player × variant
    return [...extra, ...eras].map((a) => ({ ...a, have: variantsOwned(owned, a.members.map((p) => `${p.position}:${p.name}`)), total: a.members.length * VARIANTS.length }));
  }, [cards, content, owned]);

  const teamOptions = useMemo(() => [...new Set(cards.map((c) => c.franchise))].sort(), [cards]);
  useEffect(() => {
    if (team !== 'all' && cards.length && !teamOptions.includes(team)) setTeam('all');
  }, [team, cards.length, teamOptions]);

  const filtered = useMemo(() => {
    const list = cards.filter(
      (c) =>
        (tier === 'all' || c.tier === tier) &&
        (finish === 'all' || (!!owned[c.key] && Object.values(owned[c.key].variants).some((v) => v?.best === finish))) &&
        (pos === 'all' || c.player.position === pos) &&
        (team === 'all' || c.franchise === team) &&
        (missing || !!owned[c.key]),
    );
    const fr = (c: CardInfo) => (owned[c.key] ? finishRank(owned[c.key].best) : -1);
    if (sort === 'ovr') return [...list].sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || a.setNo - b.setNo);
    if (sort === 'tier') return [...list].sort(byTierDesc);
    if (sort === 'finish') return [...list].sort((a, b) => fr(b) - fr(a) || byTierDesc(a, b));
    if (sort === 'recent') return [...list].sort((a, b) => (owned[b.key]?.last ?? 0) - (owned[a.key]?.last ?? 0) || a.setNo - b.setNo);
    return list;
  }, [cards, tier, finish, pos, team, missing, sort, owned]);
  const shown = filtered.slice(0, limit);
  // First appearance staggers in; later filter changes and "Show more" only fade (utils/motion useStagger)
  const gridMotion = useStagger(loaded && cards.length > 0);
  // The swipe browser shows every owned card of the filter (not just the loaded page of the grid)
  const browseList = useMemo(() => filtered.filter((c) => !!owned[c.key]), [filtered, owned]);

  const shelf = SHELF_ORDER.filter((t) => packCount(state, t) > 0);
  const previewCards = useMemo(() => samplePack(designRows(cards), cards), [cards]);
  const openCard = (c: CardInfo, list: CardInfo[], from?: DOMRect) => setDetail({ info: c, list, from });
  const binderOwned = useMemo(() => shown.filter((c) => !!owned[c.key]), [shown, owned]);
  const describe = (pc: { player: Player }) => byKey.get(`${pc.player.position}:${pc.player.name}`)!;
  // What a card shows by default: the display choice when still owned, else auto
  const shown_ = (k: string) => {
    const d = displayOf(owned[k], state.display?.[k]);
    return { variant: d.variant, finish: d.finish, pinned: d.pinned };
  };
  // Shard estimate for "about N packs to go": a Standard pack against this binder
  const poolKeys = useMemo(
    () => ({ common: tierPool.common.map(cardKey), rare: tierPool.rare.map(cardKey), epic: tierPool.epic.map(cardKey), legendary: tierPool.legendary.map(cardKey) }),
    [tierPool],
  );
  const shardsPerPack = useMemo(() => expectedShardsPerPack('standard', owned, poolKeys), [owned, poolKeys]);

  // Per-edition accent on the hero and pack shelf (utils/edition.ts): changes after an update, same for everyone
  const accent = editionAccent(content?.edition);

  return (
    <div className="container space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      {/* Hero */}
      <section aria-labelledby="col-title" className="col-hero p-4 sm:p-6" style={{ ['--ed' as string]: accent.hsl }}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div
            className="col-ring"
            style={{ ['--p' as string]: pct(ownedCount, cards.length) }}
            role="img"
            aria-label={`${ownedCount} of ${cards.length} players collected`}
          >
            <span className="text-center leading-none">
              <span className="block font-display text-4xl font-extrabold tabular-nums">{ownedCount}</span>
              <span className="font-mono text-xs text-muted-foreground">/ {cards.length}</span>
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="col-title" className="font-display text-4xl uppercase italic sm:text-5xl">
                Collection
              </h1>
              <RulesPopover />
              {content?.edition?.label && (
                <span className="col-edition" title={`${accent.name} edition: the shelf colour changes with every update`}>
                  {content.edition.label}
                </span>
              )}
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Collected by tier">
              {tierStats.map((t) => (
                <li key={t.key} className={cn('col-gem', `col-gem--${t.key}`)}>
                  <i aria-hidden="true" />
                  <span className="font-semibold">{t.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {t.have}/{t.total}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                <span className="font-mono text-foreground">{variantCount}</span> / {cards.length * VARIANTS.length} variants
              </span>
              <span className="inline-flex items-center gap-1">
                <Hammer className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span className="font-mono text-foreground">{state.shards.toLocaleString()}</span> shards
              </span>
              <button type="button" onClick={() => setDesigns(true)} className="inline-flex items-center gap-1 font-semibold text-gold hover:underline">
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /> Card designs
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          {shelf.length ? (
            <ul className="col-shelf" aria-label="Unopened packs">
              {shelf.map((t) => {
                const n = packCount(state, t);
                return (
                  <li key={t}>
                    <button
                      type="button"
                      className="col-pack"
                      onClick={() => setOpening(t)}
                      disabled={!loaded || !cards.length}
                      aria-label={`Open a ${PACKS[t].label}, ${n} unopened`}
                    >
                      {n > 1 && <span className="col-pack__stack" aria-hidden="true" />}
                      <span className={cn('pk-pack', `pk-pack--${t}`)}>
                        <PackArt type={t} small />
                      </span>
                      {/* Keyed by the count, so it pops each time a pack is opened (or earned) */}
                      <span key={n} className="col-pack__count" aria-hidden="true">
                        {n}
                      </span>
                      <span className="text-xs font-semibold">{PACKS[t].label.replace(/ Pack$/, '')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No packs. Win them in the Arcade.</p>
          )}
        </div>
      </section>

      {loaded && cards.length > 0 && <ShardWorkshop cards={cards} owned={owned} shards={state.shards} perPack={shardsPerPack} onOpen={(c) => openCard(c, [c])} />}

      {/* Showcase */}
      {showcase.length > 0 && (
        <section aria-labelledby="col-best">
          <h2 id="col-best" className="section-title">
            Best pulls
          </h2>
          <ul className={cn('col-showcase', gridMotion)}>
            {showcase.map((c) => (
              <li key={c.key}>
                <CollectibleCard
                  owned
                  live={owned[c.key].best === 'holo' || c.tier === 'legendary'}
                  player={c.player}
                  tier={c.tier}
                  {...shown_(c.key)}
                  ovr={c.ovr}
                  number={c.number}
                  stats={c.stats}
                  setNo={c.setNo}
                  setTotal={cards.length}
                  marks={owned[c.key].marks}
                  onOpen={(from) => openCard(c, showcase, from)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Market */}
      {loaded && cards.length > 0 && (
        <section aria-labelledby="col-market" className="scroll-mt-20">
          <h2 id="col-market" className="section-title">
            Market
          </h2>
          <MarketView byKey={byKey} owned={owned} onOpen={(info, list) => setDetail({ info, list })} />
        </section>
      )}

      {/* Sets */}
      {sets.length > 0 && ownedCount > 0 && (
        <section aria-labelledby="col-sets">
          <h2 id="col-sets" className="sr-only">
            Sets
          </h2>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
            {sets.map((s) => {
              const done = s.have === s.total;
              return (
                <li
                  key={s.id}
                  className={cn('w-40 shrink-0 rounded-lg border px-2.5 py-2', done ? 'border-gold bg-gold/10' : 'border-line bg-panel/60')}
                  title={`${s.members.map((p) => p.name).join(', ')} (${s.have} of ${s.total} player variants)`}
                >
                  <p className="truncate text-xs font-semibold">{s.title}</p>
                  <p className="flex items-center gap-2">
                    <span className="block h-1 flex-1 overflow-hidden rounded-full bg-black/40" aria-hidden="true">
                      <span className="block h-full rounded-full bg-gold" style={{ width: `${pct(s.have, s.total)}%` }} />
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {s.have}/{s.total}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Binder */}
      <section aria-labelledby="col-binder" className="space-y-3">
        <div className="flex items-baseline gap-3">
          <h2 id="col-binder" className="section-title">
            Binder
          </h2>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {loaded ? `${filtered.length} cards` : 'Loading…'}
          </span>
          {loaded && cards.length > 0 && (
            <button
              type="button"
              className="col-swipe-btn"
              onClick={() => {
                setBrowseFocus(null);
                setBrowsing(true);
              }}
              aria-label={`Swipe through your cards (${browseList.length} in this filter)`}
            >
              <GalleryHorizontal className="h-4 w-4" aria-hidden="true" />
              Swipe
            </button>
          )}
        </div>
        <div className="space-y-2">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Tier and finish">
            {TIERS.map((t) => (
              <Chip key={t.key} active={tier === t.key} onClick={() => setTier(tier === t.key ? 'all' : t.key)}>
                <span className={cn('col-dot', `col-gem--${t.key}`)} aria-hidden="true" />
                {t.label}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden="true" />
            {FINISHES.map((f) => {
              const Icon = FINISH_ICON[f.key];
              return (
                <Chip key={f.key} active={finish === f.key} onClick={() => setFinish(finish === f.key ? 'all' : f.key)} label={`${f.label} finish`}>
                  <Icon className={cn('h-3.5 w-3.5', FINISH_TEXT[f.key])} aria-hidden="true" />
                  {f.label}
                </Chip>
              );
            })}
          </div>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Position">
            {POSITIONS.map((p) => (
              <Chip key={p} active={pos === p} onClick={() => setPos(pos === p ? 'all' : p)}>
                {p}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden="true" />
            <Chip active={missing} onClick={() => setMissing((m) => !m)} label="Show missing cards">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Missing
            </Chip>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              aria-label="Team"
              className="h-8 shrink-0 rounded-full border border-line bg-panel/70 px-3 text-xs font-semibold text-foreground"
            >
              <option value="all">All teams</option>
              {teamOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort"
              className="h-8 shrink-0 rounded-full border border-line bg-panel/70 px-3 text-xs font-semibold text-foreground"
            >
              <option value="set">Set #</option>
              <option value="ovr">OVR</option>
              <option value="tier">Tier</option>
              <option value="finish">Finish</option>
              <option value="recent">Recent</option>
            </select>
          </div>
        </div>

        {!loaded || !cards.length || filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted-foreground" role="status">
            {!loaded ? 'Loading cards…' : !cards.length ? 'No league data yet.' : 'No cards match.'}
          </div>
        ) : (
          <ul className={cn('fut-grid', gridMotion)} aria-label="Cards">
            {shown.map((c) => {
              const entry = owned[c.key];
              // One tile per player: his display choice, else his rarest variant owned at that variant's best finish
              const d = entry ? displayOf(entry, state.display?.[c.key]) : undefined;
              return (
                <li key={c.key} className={cn('fut-tile', fresh?.has(c.key) && 'fut-tile--fresh')}>
                  <CollectibleCard
                    player={c.player}
                    tier={c.tier}
                    finish={d?.finish ?? 'base'}
                    variant={d?.variant}
                    pinned={d?.pinned}
                    owned={!!entry}
                    ovr={c.ovr}
                    number={c.number}
                    stats={c.stats}
                    setNo={c.setNo}
                    setTotal={cards.length}
                    hint={c.hint}
                    marks={entry?.marks}
                    onOpen={entry ? (from) => openCard(c, binderOwned, from) : undefined}
                  />
                  <VariantBadges entry={entry} />
                </li>
              );
            })}
          </ul>
        )}
        {shown.length < filtered.length && (
          <div className="flex justify-center">
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="h-10 rounded-full border border-line bg-panel px-5 text-sm font-semibold hover:border-gold/60">
              Show more ({filtered.length - shown.length})
            </button>
          </div>
        )}
      </section>

      <PackOpening
        type={opening}
        onClose={() => setOpening(null)}
        onTear={(t) => openPack(t, tierPool)}
        describe={describe}
        total={cards.length}
        remaining={opening ? packCount(state, opening) : 0}
        provenance={state.perfect[0]?.label}
      />
      <PackOpening
        preview
        type={preview ? 'elite' : null}
        onClose={() => setPreview(false)}
        onTear={() => (previewCards.length ? previewCards : null)}
        describe={describe}
        total={cards.length}
        remaining={0}
      />
      <Suspense fallback={<DialogFallback />}>
        {(designs || designsSeen) && (
          <CardDesigns
            open={designs}
            onClose={closeDesigns}
            cards={cards}
            total={cards.length}
            onOpenCard={(info, t, f, v, from) => setDetail({ info, tier: t, finish: f, variant: v, preview: true, from })}
            onPreviewPack={() => setPreview(true)}
            onArtLab={() => setArtLab(true)}
          />
        )}
        {(artLab || artLabSeen) && <ArtLab open={artLab} onClose={closeArtLab} cards={cards} total={cards.length} />}
      </Suspense>
      <CardDetail
        target={detail}
        entry={detail && !detail.preview ? owned[detail.info.key] : undefined}
        shards={state.shards}
        shardsPerPack={shardsPerPack}
        display={detail ? state.display?.[detail.info.key] : undefined}
        total={cards.length}
        onClose={() => setDetail(null)}
        onNavigate={(info) => {
          setDetail((d) => (d ? { info, list: d.list } : d));
          if (browsing) setBrowseFocus(info.key);
        }}
        onPlayer={(info) => {
          setDetail(null);
          setPlayer(info.player);
        }}
      />
      <CardBrowser
        open={browsing}
        list={browseList}
        owned={owned}
        display={state.display}
        total={cards.length}
        covered={!!detail || !!player}
        focusKey={browseFocus}
        onClose={() => setBrowsing(false)}
        onDetails={(info, variant, finish, from) => setDetail({ info, list: browseList, variant, finish, from })}
      />
      <PlayerDetailCard player={player} onClose={() => setPlayer(null)} />
    </div>
  );
};

export default CollectionTab;
