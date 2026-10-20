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
