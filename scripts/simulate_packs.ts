/**
 * Pack odds simulation: opens N packs of every type (and one big Legends Exchange) against a synthetic pool and
 * prints the variant × finish × tier distribution, plus how many cards it takes to see a Retro Bowl sprite Holo
 * Legendary. Touches no real data (localStorage is an in-memory stub).
 *
 *   npm run -s sim:packs            # 10,000 packs per type
 *   npm run -s sim:packs -- 50000   # more
 */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

import type { Player } from '@/types/player';
import {
  FINISHES,
  PACK_ORDER,
  STORAGE_KEY,
  TIERS,
  VARIANTS,
  exchangeLegends,
  openPack,
  packOdds,
  rollPack,
  type Finish,
  type RetiredLegend,
  type RolledCard,
  type Tier,
  type TierPool,
} from '@/utils/collection';

const N = Number(process.argv[2]) || 10000;

// Deterministic RNG (mulberry32) so two runs print the same numbers
const rngOf = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
const pool: TierPool = { common: [], rare: [], epic: [], legendary: [] };
TIERS.forEach(({ key }, ti) => {
  for (let i = 0; i < 60; i++) pool[key].push({ name: `${key} ${i}`, position: POS[(i + ti) % POS.length] } as unknown as Player);
});

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(2)}%` : '-');
const oneIn = (n: number, d: number) => (n ? `1 in ${Math.round(d / n).toLocaleString('en-US')}` : `none in ${d.toLocaleString('en-US')}`);

const report = (title: string, cards: RolledCard[], packs: number) => {
  const total = cards.length;
  console.log(`\n=== ${title}: ${packs.toLocaleString('en-US')} packs, ${total.toLocaleString('en-US')} cards ===`);
  console.log('variant   ' + VARIANTS.map((v) => v.short.padStart(8)).join(''));
  console.log('all       ' + VARIANTS.map((v) => pct(cards.filter((c) => c.variant === v.key).length, total).padStart(8)).join(''));
  TIERS.forEach(({ key: t, label }) => {
    const sub = cards.filter((c) => c.tier === t);
    console.log(`${label.padEnd(10)}` + VARIANTS.map((v) => pct(sub.filter((c) => c.variant === v.key).length, sub.length).padStart(8)).join('') + `   (${pct(sub.length, total)} of cards)`);
  });
  FINISHES.forEach(({ key: f, label }) => {
    const sub = cards.filter((c) => c.finish === f);
    console.log(`${label.padEnd(10)}` + VARIANTS.map((v) => pct(sub.filter((c) => c.variant === v.key).length, sub.length).padStart(8)).join('') + `   (${pct(sub.length, total)} of cards)`);
  });
  const slh = cards.filter((c) => c.variant === 'sprite' && c.finish === 'holo' && c.tier === 'legendary').length;
  const lh = cards.filter((c) => c.finish === 'holo' && c.tier === 'legendary').length;
  const sprites = cards.filter((c) => c.variant === 'sprite').length;
  console.log(`sprites ${oneIn(sprites, total)} cards; Legendary Holo ${oneIn(lh, total)} cards; Sprite Holo Legendary: ${slh} seen, ${oneIn(slh, total)} cards`);
};

PACK_ORDER.forEach((type, i) => {
  const rng = rngOf(1000 + i);
  const cards: RolledCard[] = [];
  for (let n = 0; n < N; n++) cards.push(...rollPack(type, pool, rng));
  report(type, cards, N);
  const o = packOdds(type);
  const size = cards.length / N;
  console.log(
    `exact: Sprite Holo Legendary 1 in ${Math.round(1 / o.spriteLegendaryHolo).toLocaleString('en-US')} cards ` +
      `(1 in ${Math.round(1 / (o.spriteLegendaryHolo * size)).toLocaleString('en-US')} packs); variants ` +
      VARIANTS.map((v) => `${v.short} ${(100 * o.variants[v.key]).toFixed(2)}%`).join(', '),
  );
});

// Legends Exchange: one exchange of N legend cards (Epic/Legendary, mixed finishes), opened through the real store
const legends = new Map<string, RetiredLegend>();
const seeded: Record<string, { best: Finish; counts: Partial<Record<Finish, number>>; first: number; last: number }> = {};
const lr = rngOf(7);
for (let i = 0; i < N; i++) {
  const key = `QB:Legend ${i}`;
  const tier: Tier = lr() < 0.4 ? 'legendary' : 'epic';
  const finish = FINISHES[Math.floor(lr() * FINISHES.length)].key;
  legends.set(key, { key, position: 'QB', tier });
  seeded[key] = { best: finish, counts: { [finish]: 1 }, first: 1, last: 1 };
}
store.set(STORAGE_KEY, JSON.stringify({ v: 2, cards: seeded, packs: {}, perfect: [], exchange: [], shards: 0, opened: {}, earned: [] }));
exchangeLegends(legends, pool, rngOf(8));
report('exchange', openPack('exchange', pool) ?? [], 1);

// ---------- Pacing: an active player's packs per day, shards from duplicates, and days to each milestone ----------
// Pool: the real league (latest market snapshot: OVR and Career Legacy), tiered by tierFor. Packs come only from the
// Arcade (EARNING_RULES; no coins, no shop). "Active" is an estimate of a daily ~30–45 minute session: 6 Standard
// and 2 Premium packs a day, plus a Perfect Season pack every 3 weeks. Shards come from duplicates and the flat PACK_SHARDS per pack (when defined).
import * as fs from 'node:fs';
import * as C from '@/utils/collection';
import { tierFor } from '@/config/cardTiers';

const snaps = JSON.parse(fs.readFileSync('public/data/market.json', 'utf8')) as { players: Record<string, { ovr: number | null; legacy: number }> }[];
const realPool: TierPool = { common: [], rare: [], epic: [], legendary: [] };
const ovrOf = new Map<string, number | null>();
Object.entries(snaps[snaps.length - 1].players).forEach(([k, v]) => {
  const [position, name] = [k.slice(0, 2), k.slice(3)];
  const p = { name, position, careerLegacy: v.legacy } as unknown as Player;
  ovrOf.set(k, v.ovr);
  realPool[tierFor(p, v.ovr)].push(p);
});
console.log(`\n=== Pacing (real pool: ${TIERS.map((t) => `${realPool[t.key].length} ${t.label}`).join(', ')}) ===`);

const X = C as unknown as Record<string, unknown>;
const craft = (to: 'silver' | 'gold' | 'holo', tier: Tier, variant: string) => (C.craftCost as (a: string, b: Tier, c?: string) => number)(to, tier, variant);
const claim = (tier: Tier): number | null => (typeof X.claimCost === 'function' ? (X.claimCost as (t: Tier) => number)(tier) : null);

const PROFILES: { name: string; day: [EarnablePackT, number][] }[] = [
  { name: 'active (6 Std + 2 Prem a day, 18–0 every 3 weeks)', day: [['standard', 6], ['premium', 2]] },
  { name: 'casual (2 Std + 0.5 Prem a day)', day: [['standard', 2], ['premium', 0.5]] },
];
type EarnablePackT = Parameters<typeof rollPack>[0];
const DAYS = 150;
const TRIALS = 300;
const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const miss = xs.length - s.length;
  return s.length > xs.length / 2 ? `${s[Math.floor(xs.length / 2)]}` : `>${DAYS} (${miss}/${xs.length} never)`;
};
const finishOrder = ['base', 'silver', 'gold', 'holo'] as const;

PROFILES.forEach((prof, pi) => {
  const rng = rngOf(9000 + pi);
  const res: Record<string, number[]> = {};
  const put = (k: string, v: number) => (res[k] ??= []).push(v);
  let packsPerDay = 0;
  let shardsPerDay = 0;
  let holoPulls = 0;
  let legPulls = 0;
  let cardsTotal = 0;
  const favEpic = realPool.epic[0];
  const favLeg = realPool.legendary[0];
  for (let t = 0; t < TRIALS; t++) {
    const owned = new Map<string, Map<string, Set<string>>>();
    let income = 0;
    let carry = 0;
    const m: Record<string, number> = {};
    const hit = (k: string, d: number) => m[k] ??= d;
    // Goal wallets: shards spent on one goal each (independent), [spent so far]
    const goals = {
      epicFav: { spent: 0, stage: 0 },
      legFav: { spent: 0, stage: 0 },
    };
    for (let d = 1; d <= DAYS; d++) {
      const packs: EarnablePackT[] = [];
      prof.day.forEach(([type, n]) => {
        carry += n % 1;
        for (let i = 0; i < Math.floor(n); i++) packs.push(type);
      });
      if (carry >= 1) {
        packs.push('premium');
        carry -= 1;
      }
      if (pi === 0 && d % 21 === 0) packs.push('perfect');
      if (t === 0) packsPerDay += packs.length;
      packs.forEach((type) => {
        income += (X.PACK_SHARDS as Record<string, number> | undefined)?.[type] ?? 0;
        rollPack(type, realPool, rng).forEach((c) => {
          const k = `${c.player.position}:${c.player.name}`;
          const pv = owned.get(k) ?? new Map<string, Set<string>>();
          owned.set(k, pv);
          const fs_ = pv.get(c.variant) ?? new Set<string>();
          pv.set(c.variant, fs_);
          if (fs_.has(c.finish)) income += typeof X.duplicateShards === 'function' ? (X.duplicateShards as (f: string, t: Tier) => number)(c.finish, c.tier) : C.DUPLICATE_SHARDS[c.finish];
          fs_.add(c.finish);
          cardsTotal++;
          if (c.finish === 'holo') {
            holoPulls++;
            hit('holoPull', d);
          }
          if (c.tier === 'legendary') {
            legPulls++;
            hit('legPull', d);
          }
          if (k === `${favEpic.position}:${favEpic.name}`) hit('epicFavPulled', d);
        });
      });
      if ([7, 14, 28, 56].includes(d)) put(`shards earned by day ${d}`, income);
      // Legend claim: shards toward claiming a chosen Legendary player's Base card
      const lc = claim('legendary');
      if (lc != null && income >= lc) hit('legClaim', d);
      // Favourite player: owned by a pull or a claim, then Silver → Gold → Holo, every shard spent on him
      const path = (fav: Player, tier: Tier, key: 'epicFav' | 'legFav') => {
        const g = goals[key];
        const wallet = () => income - g.spent;
        const stages = ['own', 'silver', 'gold', 'holo'] as const;
        for (;;) {
          const st = stages[g.stage];
          if (!st) return;
          if (st === 'own') {
            const c = claim(tier);
            if (owned.has(`${fav.position}:${fav.name}`)) g.stage++;
            else if (c != null && wallet() >= c) {
              g.spent += c;
              g.stage++;
            } else return;
            continue;
          }
          const cost = craft(st, tier, 'number');
          if (wallet() < cost) return;
          g.spent += cost;
          g.stage++;
          hit(`${key}:${st}`, d);
        }
      };
      path(favEpic, 'epic', 'epicFav');
      path(favLeg, 'legendary', 'legFav');
    }
    if (t === 0) shardsPerDay = income / DAYS;
    put('first Legendary pull', m.legPull ?? Infinity);
    put('Legend claim affordable', m.legClaim ?? Infinity);
    put('first Legendary (pull or claim)', Math.min(m.legPull ?? Infinity, m.legClaim ?? Infinity));
    put('first Holo pull', m.holoPull ?? Infinity);
    put(`Gold on a chosen Epic (${favEpic.name})`, m['epicFav:gold'] ?? Infinity);
    put(`Holo on a chosen Epic (${favEpic.name})`, m['epicFav:holo'] ?? Infinity);
    put(`Gold on a chosen Legendary (${favLeg.name})`, m['legFav:gold'] ?? Infinity);
    put(`Holo on a chosen Legendary (${favLeg.name})`, m['legFav:holo'] ?? Infinity);
  }
  console.log(`\n${prof.name}: ${(packsPerDay / DAYS).toFixed(1)} packs/day, ~${Math.round(shardsPerDay)} shards/day (150-day average), ` +
    `Holo pulls ${((7 * holoPulls) / (TRIALS * DAYS)).toFixed(2)}/week, Legendary pulls ${((7 * legPulls) / (TRIALS * DAYS)).toFixed(2)}/week, ${Math.round(cardsTotal / (TRIALS * DAYS))} cards/day`);
  console.log(`  median days to milestone (${TRIALS} runs):`);
  Object.entries(res).forEach(([k, v]) => console.log(`    ${k.padEnd(44)} ${median(v)}`));
});
void finishOrder;

// ---------- Gifts: what a device's one-time gift packs hold on average (expected cards, exact odds) ----------
console.log('\n=== Gifts (expected per redemption) ===');
Object.entries(C.GIFTS).forEach(([id, g]) => {
  let cards = 0;
  let holo = 0;
  let leg = 0;
  let legHolo = 0;
  g.packs.forEach(([type, n]) => {
    const o = packOdds(type);
    const size = C.PACKS[type].size;
    cards += n * size;
    holo += n * size * o.finishes.holo;
    leg += n * size * o.tiers.legendary;
    legHolo += n * size * o.legendaryHolo;
  });
  console.log(`${id.padEnd(20)} ${cards} cards: ${holo.toFixed(2)} Holo, ${leg.toFixed(2)} Legendary, ${legHolo.toFixed(2)} Legendary Holo`);
});
