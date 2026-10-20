import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Hammer, Info, LayoutGrid, Lock } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { cn } from '@/lib/utils';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import CollectibleCard from '@/components/collection/CollectibleCard';
import CardDetail, { type CardDetailTarget } from '@/components/collection/CardDetail';
import CardDesigns from '@/components/collection/CardDesigns';
import ArtLab from '@/components/collection/art/ArtLab';
import { designRows, samplePack } from '@/components/collection/designSamples';
import { FINISH_ICON, FINISH_TEXT } from '@/components/collection/rarityIcons';
import PackOpening, { PackArt } from '@/components/collection/PackOpening';
import MarketView from '@/components/collection/market/MarketView';
import { byTierDesc, useCardPool, type CardInfo } from '@/components/collection/useCardPool';
import { FACE_LEGEND } from '@/components/collection/cardStats';
import { matchPlayerByName, useLeagueContent } from '@/utils/leagueContent';
import { isHallOfFamer } from '@/config/stats';
import {
  CRAFT_COST,
  DUPLICATE_SHARDS,
  EARNING_RULES,
  FINISHES,
  GIFTS,
  PACKS,
  PACK_ORDER,
  SHELF_ORDER,
  TIERS,
  finishRank,
  openPack,
  packCount,
  packOdds,
  redeemGift,
  tierRank,
  useCollection,
  type Finish,
  type EarnablePack,
  type PackType,
  type Tier,
} from '@/utils/collection';

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
    <PopoverContent align="start" className="max-h-[70vh] w-[min(92vw,460px)] overflow-y-auto border-line bg-night p-3 text-xs">
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
        </tbody>
      </table>
      <ul className="mt-3 space-y-1 text-muted-foreground">
        {PACK_ORDER.map((t) => (
          <li key={t}>
            <span className="font-semibold text-foreground">{PACKS[t].label}:</span> {PACKS[t].guarantee}
          </li>
        ))}
      </ul>
      <p className="mt-3 font-semibold">Earn packs</p>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {EARNING_RULES.map((r) => (
          <li key={r.game}>
            <span className="text-foreground">{r.game}</span> · {r.rules}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted-foreground">
        Duplicates give shards ({FINISHES.map((f) => `${f.label} ${DUPLICATE_SHARDS[f.key]}`).join(', ')}). Upgrading a card one finish costs{' '}
        {CRAFT_COST.silver}/{CRAFT_COST.gold}/{CRAFT_COST.holo}, more for higher tiers. Open any card to upgrade it.
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
  const { state, cards: owned } = useCollection();
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

  useEffect(() => setLimit(PAGE), [tier, finish, pos, team, missing, sort]);

  // #collection?gift=<id> redeems a one-time gift; #collection?view=designs opens the Card designs gallery, ?view=art the Art lab
  useEffect(() => {
    const check = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#collection')) return;
      const gift = hash.match(GIFT_HASH)?.[1];
      if (gift) {
        const r = redeemGift(gift);
        if (r === 'granted') toast.success(`${GIFTS[gift].label} added`, { description: 'Tap a pack below to open it.' });
        else if (r === 'already') toast('That gift was already redeemed on this browser.');
        cleanHash();
      }
      if (DESIGNS_HASH.test(hash)) setDesigns(true);
      if (MARKET_HASH.test(hash)) window.setTimeout(() => document.getElementById('col-market')?.scrollIntoView({ block: 'start' }), 50);
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
    return [...extra, ...eras].map((a) => ({ ...a, have: a.members.filter((p) => !!owned[`${p.position}:${p.name}`]).length }));
  }, [cards, content, owned]);

  const teamOptions = useMemo(() => [...new Set(cards.map((c) => c.franchise))].sort(), [cards]);
  useEffect(() => {
    if (team !== 'all' && cards.length && !teamOptions.includes(team)) setTeam('all');
  }, [team, cards.length, teamOptions]);

  const filtered = useMemo(() => {
    const list = cards.filter(
      (c) =>
        (tier === 'all' || c.tier === tier) &&
        (finish === 'all' || owned[c.key]?.best === finish) &&
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

  const shelf = SHELF_ORDER.filter((t) => packCount(state, t) > 0);
  const previewCards = useMemo(() => samplePack(designRows(cards), cards), [cards]);
  const openCard = (c: CardInfo, list: CardInfo[], from?: DOMRect) => setDetail({ info: c, list, from });
  const binderOwned = useMemo(() => shown.filter((c) => !!owned[c.key]), [shown, owned]);
  const describe = (pc: { player: Player }) => byKey.get(`${pc.player.position}:${pc.player.name}`)!;

  return (
    <div className="container space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      {/* Hero */}
      <section aria-labelledby="col-title" className="col-hero p-4 sm:p-6">
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
            <div className="flex items-center gap-2">
              <h1 id="col-title" className="font-display text-4xl uppercase italic sm:text-5xl">
                Collection
              </h1>
              <RulesPopover />
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
                      <span className="col-pack__count" aria-hidden="true">
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

      {/* Showcase */}
      {showcase.length > 0 && (
        <section aria-labelledby="col-best">
          <h2 id="col-best" className="section-title">
            Best pulls
          </h2>
          <ul className="col-showcase">
            {showcase.map((c) => (
              <li key={c.key}>
                <CollectibleCard
                  owned
                  live={owned[c.key].best === 'holo' || c.tier === 'legendary'}
                  player={c.player}
                  tier={c.tier}
                  finish={owned[c.key].best}
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
              const done = s.have === s.members.length;
              return (
                <li
                  key={s.id}
                  className={cn('w-40 shrink-0 rounded-lg border px-2.5 py-2', done ? 'border-gold bg-gold/10' : 'border-line bg-panel/60')}
                  title={s.members.map((p) => p.name).join(', ')}
                >
                  <p className="truncate text-xs font-semibold">{s.title}</p>
                  <p className="flex items-center gap-2">
                    <span className="block h-1 flex-1 overflow-hidden rounded-full bg-black/40" aria-hidden="true">
                      <span className="block h-full rounded-full bg-gold" style={{ width: `${pct(s.have, s.members.length)}%` }} />
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {s.have}/{s.members.length}
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
          <ul className="fut-grid" aria-label="Cards">
            {shown.map((c) => {
              const entry = owned[c.key];
              return (
                <li key={c.key}>
                  <CollectibleCard
                    player={c.player}
                    tier={c.tier}
                    finish={entry?.best ?? 'base'}
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
      <CardDesigns
        open={designs}
        onClose={closeDesigns}
        cards={cards}
        total={cards.length}
        onOpenCard={(info, t, f, from) => setDetail({ info, tier: t, finish: f, preview: true, from })}
        onPreviewPack={() => setPreview(true)}
        onArtLab={() => setArtLab(true)}
      />
      <ArtLab open={artLab} onClose={closeArtLab} cards={cards} total={cards.length} />
      <CardDetail
        target={detail}
        entry={detail && !detail.preview ? owned[detail.info.key] : undefined}
        shards={state.shards}
        total={cards.length}
        onClose={() => setDetail(null)}
        onNavigate={(info) => setDetail((d) => (d ? { info, list: d.list } : d))}
        onPlayer={(info) => {
          setDetail(null);
          setPlayer(info.player);
        }}
      />
      <PlayerDetailCard player={player} onClose={() => setPlayer(null)} />
    </div>
  );
};

export default CollectionTab;
