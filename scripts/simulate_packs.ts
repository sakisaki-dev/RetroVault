/**
 * Pack odds simulation: opens N packs of every type (and one big Legends Exchange) against a synthetic pool and
 * prints the variant × finish × tier distribution, plus how many cards it takes to see the rarest art (the Autograph)
 * Holo Legendary, and the Autograph variant's rate per card and per pack (with the parallels they roll and the
 * Autograph × Holo × Legendary odds), then the kit chase per pack (alternate, era kit, and an era kit on a Holo or a
 * Legendary; KIT_ODDS), then the Prizm colour parallels per pack (PRIZM_ODDS). Touches no real data (localStorage is an
 * in-memory stub).
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
  KIT_ODDS,
  PACK_ORDER,
  PRIZM_ODDS,
  PRIZM_PARALLELS,
  prizmAnyChance,
  rollPrizm,
  STORAGE_KEY,
  TIERS,
  VARIANTS,
  exchangeLegends,
  openPack,
  packOdds,
  rollKit,
  rollPack,
  type Finish,
  type RetiredLegend,
  type RolledCard,
  type Tier,
  type TierPool,
} from '@/utils/collection';

const N = Number(process.argv[2]) || 10000;
import { PACKS as C_PACKS } from '@/utils/collection';

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

const PACKS_SIZE = (t: (typeof PACK_ORDER)[number]) => C_PACKS[t].size;
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(2)}%` : '-');
/** The rarest art variant (the Autograph, at the retired sprite's odds): its Holo × Legendary is the chase card. */
const RAREST = VARIANTS[VARIANTS.length - 1];
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
  const rlh = cards.filter((c) => c.variant === RAREST.key && c.finish === 'holo' && c.tier === 'legendary').length;
  const lh = cards.filter((c) => c.finish === 'holo' && c.tier === 'legendary').length;
  const rarest = cards.filter((c) => c.variant === RAREST.key).length;
  console.log(`${RAREST.short} ${oneIn(rarest, total)} cards; Legendary Holo ${oneIn(lh, total)} cards; ${RAREST.short} Holo Legendary: ${rlh} seen, ${oneIn(rlh, total)} cards`);
};

PACK_ORDER.forEach((type, i) => {
  const rng = rngOf(1000 + i);
  const cards: RolledCard[] = [];
  for (let n = 0; n < N; n++) cards.push(...rollPack(type, pool, rng));
  report(type, cards, N);
  const o = packOdds(type);
  const size = cards.length / N;
  console.log(
    `exact: ${RAREST.short} Holo Legendary 1 in ${Math.round(1 / o.rarestLegendaryHolo).toLocaleString('en-US')} cards ` +
      `(1 in ${Math.round(1 / (o.rarestLegendaryHolo * size)).toLocaleString('en-US')} packs); variants ` +
      VARIANTS.map((v) => `${v.short} ${(100 * o.variants[v.key]).toFixed(2)}%`).join(', '),
  );
});

// Autographs: the Autograph art variant (rolled like any variant); each one also rolls its parallel, pen, serial…
import { PARALLELS, autographValue, freezeSnapshot, rollAutograph, type AutographSnapshot } from '@/config/autographs';
const signerOf = (hof: boolean): AutographSnapshot =>
  freezeSnapshot({ name: 'Sim Signer', position: 'QB', team: 'Falcons', number: 12, rings: hof ? 3 : 0, mvp: hof ? 1 : 0, nickname: hof ? 'The Sim' : undefined, careerLegacy: hof ? 9000 : 4000, games: 200, hof, hofClass: hof ? 'Y80' : undefined, eraYear: 80 });
const SIGNERS = { hof: signerOf(true), plain: signerOf(false) };
console.log(`\n=== Autograph variant: ${N.toLocaleString('en-US')} packs per type ===`);
console.log('pack        per card (sim)    exact per card    packs with one    packs per auto   Auto Holo Legendary (exact)');
const parallels: Record<keyof typeof SIGNERS, Record<string, number>> = { hof: {}, plain: {} };
const mults: Record<keyof typeof SIGNERS, number[]> = { hof: [], plain: [] };
PACK_ORDER.forEach((type, i) => {
  const rng = rngOf(5000 + i);
  let cards = 0;
  let hits = 0;
  let packsWith = 0;
  for (let n = 0; n < N; n++) {
    const pack = rollPack(type, pool, rng);
    cards += pack.length;
    const autos = pack.filter((c) => c.variant === 'auto');
    hits += autos.length;
    if (autos.length) packsWith++;
    autos.forEach(() =>
      (Object.keys(SIGNERS) as (keyof typeof SIGNERS)[]).forEach((who) => {
        const roll = rollAutograph(SIGNERS[who], Math.floor(rng() * 2 ** 32));
        parallels[who][roll.parallel] = (parallels[who][roll.parallel] ?? 0) + 1;
        mults[who].push(autographValue(roll).total);
      }),
    );
  }
  const o = packOdds(type);
  const size = cards / N;
  console.log(
    `${type.padEnd(10)}  ${oneIn(hits, cards).padEnd(16)}  ${`1 in ${(1 / o.variants.auto).toFixed(1)}`.padEnd(16)}  ${pct(packsWith, N).padEnd(16)}  ${(packsWith ? (N / packsWith).toFixed(1) : '-').padStart(14)}   ` +
      `1 in ${Math.round(1 / o.rarestLegendaryHolo).toLocaleString('en-US')} cards (1 in ${Math.round(1 / (o.rarestLegendaryHolo * size)).toLocaleString('en-US')} packs); Auto Holo any tier 1 in ${Math.round(1 / o.rarestHolo).toLocaleString('en-US')} cards`,
  );
});
console.log('\nParallel split of every Autograph pulled above (each rolled for a Hall of Famer with rings, an MVP and a nickname, and for a plain player):');
console.log('signer     ' + PARALLELS.map((p) => `${p.id} /${p.serial}`.padStart(15)).join('') + '      avg ×    median ×      max ×');
(Object.keys(SIGNERS) as (keyof typeof SIGNERS)[]).forEach((who) => {
  const n = mults[who].length;
  const sorted = [...mults[who]].sort((a, b) => a - b);
  console.log(
    `${(who === 'hof' ? 'HOF' : 'plain').padEnd(10)} ` +
      PARALLELS.map((p) => pct(parallels[who][p.id] ?? 0, n).padStart(15)).join('') +
      `${(n ? sorted.reduce((a, x) => a + x, 0) / n : 0).toFixed(2).padStart(11)}${(sorted[Math.floor(n / 2)] ?? 0).toFixed(2).padStart(12)}${(sorted[n - 1] ?? 0).toFixed(2).padStart(11)}`,
  );
});
console.log(`table weights: ${PARALLELS.map((p) => `${p.label} ${p.w}`).join(', ')} (a cut needs a Hall of Famer, an Inscribed something to inscribe; else On-card)`);

// Kits: every pull but the Autograph rolls home, an alternate or the club's era kit (KIT_ODDS). The pool here wears
// real clubs: Steelers (2 alternates + era kit) and Bears (1 + era) have both kinds; the Jets (2 alternates, no era
// kit) check that a club never rolls a kit it lacks (its era share stays home).
import { kitsOf } from '@/components/collection/art/sprite/uniforms';
import { KIT_SOURCE, clubKits } from '@/components/collection/kits';
const KIT_CLUBS = ['Steelers', 'Bears', 'Jets'];
const kitPool: TierPool = { common: [], rare: [], epic: [], legendary: [] };
TIERS.forEach(({ key }, ti) => {
  for (let i = 0; i < 60; i++) kitPool[key].push({ name: `${key} kit ${i}`, position: POS[(i + ti) % POS.length], team: KIT_CLUBS[i % KIT_CLUBS.length] } as unknown as Player);
});
const kindOfKit = (team: string | undefined, kit: string) => {
  const k = kitsOf(team);
  return k.era?.id === kit ? 'era' : k.alts.some((u) => u.id === kit) ? 'alt' : 'home';
};
console.log(`
=== Kits: ${N.toLocaleString('en-US')} packs per type (clubs with both kinds: Steelers, Bears; no era kit: Jets) ===`);
console.log('pack        table alt/era    alt per card (sim / exact)   era per card (sim / exact)   era on Holo or Legendary (sim / exact)   Jets era   1 throwback per');
PACK_ORDER.forEach((type, i) => {
  const rng = rngOf(6000 + i);
  let both = 0;
  let alt = 0;
  let era = 0;
  let eraChase = 0;
  let jetsEra = 0;
  for (let n = 0; n < N; n++)
    rollPack(type, kitPool, rng, KIT_SOURCE).forEach((c) => {
      const team = (c.player as { team?: string }).team;
      const kind = kindOfKit(team, c.kit);
      if (team === 'Jets') {
        if (kind === 'era') jetsEra++;
        return;
      }
      both++;
      if (kind === 'alt') alt++;
      if (kind === 'era') {
        era++;
        if (c.finish === 'holo' || c.tier === 'legendary') eraChase++;
      }
    });
  const o = packOdds(type);
  const size = PACKS_SIZE(type);
  console.log(
    `${type.padEnd(10)}  ${`${(100 * KIT_ODDS[type].alt).toFixed(1)}% / ${(100 * KIT_ODDS[type].era).toFixed(1)}%`.padEnd(15)}  ` +
      `${`${pct(alt, both)} / ${(100 * o.kits.alt).toFixed(2)}%`.padEnd(27)}  ${`${pct(era, both)} / ${(100 * o.kits.era).toFixed(2)}%`.padEnd(27)}  ` +
      `${`${pct(eraChase, both)} / ${(100 * o.kits.eraHoloOrLegendary).toFixed(3)}% (1 in ${Math.round(1 / o.kits.eraHoloOrLegendary).toLocaleString('en-US')})`.padEnd(39)}  ${String(jetsEra).padStart(8)}   ` +
      `${(1 / (o.kits.era * size)).toFixed(1)} packs`,
  );
});
{
  // The Legends Exchange rolls its kits at open time like any pull (exchange odds), checked here per non-Autograph card
  const rng = rngOf(6100);
  let alt = 0;
  let era = 0;
  for (let n = 0; n < N * 5; n++) {
    const kind = kindOfKit('Steelers', rollKit('exchange', clubKits('Steelers'), 'number', rng));
    if (kind === 'alt') alt++;
    if (kind === 'era') era++;
  }
  console.log(`exchange    ${`${(100 * KIT_ODDS.exchange.alt).toFixed(1)}% / ${(100 * KIT_ODDS.exchange.era).toFixed(1)}%`.padEnd(15)}  alt ${pct(alt, N * 5)}, era ${pct(era, N * 5)} per non-Autograph card (sim)`);
}

// Prizm colour parallels: every Prizm number pull rolls one (PRIZM_ODDS; most stay plain). Per card through real packs
// (the Prizm share × any parallel), then each colour per Prizm card from rollPrizm alone (100× the draws, so the
// Black 1/1 rate settles), each beside its exact value.
console.log(`
=== Prizm parallels: ${N.toLocaleString('en-US')} packs per type, colours from ${(N * 100).toLocaleString('en-US')} Prizm rolls ===`);
console.log(
  'pack        any per card (sim / exact)   any per Prizm (sim / exact)   ' +
    PRIZM_PARALLELS.map((p) => `${p.label} ${p.run === 1 ? '1/1' : `/${p.run}`} per Prizm`.padEnd(30)).join('') +
    'packs per parallel',
);
PACK_ORDER.forEach((type, i) => {
  const rng = rngOf(6500 + i);
  let cards = 0;
  let prizms = 0;
  let pars = 0;
  for (let n = 0; n < N; n++)
    rollPack(type, pool, rng).forEach((c) => {
      cards++;
      if (c.variant === 'number') prizms++;
      if (c.prizm) pars++;
    });
  const r2 = rngOf(6600 + i);
  const hits: Record<string, number> = {};
  const serialOk = { ok: true };
  for (let n = 0; n < N * 100; n++) {
    const p = rollPrizm(type, 'number', r2);
    if (!p) continue;
    hits[p.c] = (hits[p.c] ?? 0) + 1;
    const run = PRIZM_PARALLELS.find((x) => x.key === p.c)!.run;
    if (p.n < 1 || p.n > run || !Number.isInteger(p.n)) serialOk.ok = false;
  }
  const o = packOdds(type);
  console.log(
    `${type.padEnd(10)}  ${`${pct(pars, cards)} / ${(100 * o.parallels.any).toFixed(2)}%`.padEnd(27)}  ${`${pct(pars, prizms)} / ${(100 * prizmAnyChance(type)).toFixed(2)}%`.padEnd(28)}  ` +
      PRIZM_PARALLELS.map((p) => {
        const x = PRIZM_ODDS[type][p.key];
        return `${pct(hits[p.key] ?? 0, N * 100)} / ${(100 * x).toFixed(x < 0.001 ? 3 : 2)}% (1 in ${Math.round(1 / x).toLocaleString('en-US')})`.padEnd(30);
      }).join('') +
      `${(1 / (o.parallels.any * PACKS_SIZE(type))).toFixed(1)}${serialOk.ok ? '' : '  SERIAL OUT OF RUN'}`,
  );
});
{
  const rng = rngOf(6700);
  let n = 0;
  for (let k = 0; k < N * 20; k++) if (rollPrizm('exchange', 'number', rng)) n++;
  console.log(`exchange    any per Prizm ${pct(n, N * 20)} / ${(100 * prizmAnyChance('exchange')).toFixed(2)}% (sim / exact)`);
}

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
// The store signs an Autograph-variant card with a frozen snapshot (without a freezer it would be a Locker stall)
report('exchange', openPack('exchange', pool, () => SIGNERS.plain) ?? [], 1);

// ---------- Pacing: an active player's packs per day, shards from duplicates, and days to each milestone ----------
// Pool: the real league (latest market snapshot: OVR and Career Legacy), tiered by tierFor. Packs come only from the
// Arcade (EARNING_RULES; no coins, no shop). "Active" is an estimate of a daily ~30–45 minute session: 6 Standard
// and 2 Premium packs a day, plus a Perfect Season pack every 3 weeks. Shards come from duplicates and the flat PACK_SHARDS per pack (when defined).
import * as fs from 'node:fs';
import * as C from '@/utils/collection';
import { tierFor } from '@/config/cardTiers';

import { expandMarket } from '@/utils/marketHistory';

// market.json is stored as changes only (keyframes plus deltas, format 2): expand it to full snapshots
const snaps = expandMarket(JSON.parse(fs.readFileSync('public/data/market.json', 'utf8')));
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
          // A duplicate is the same finish in the same kit and Prizm parallel (a new kit or parallel pays no shards)
          const fk = `${c.finish}|${c.kit ?? 'home'}|${c.prizm?.c ?? 'plain'}`;
          if (fs_.has(fk)) income += typeof X.duplicateShards === 'function' ? (X.duplicateShards as (f: string, t: Tier) => number)(c.finish, c.tier) : C.DUPLICATE_SHARDS[c.finish];
          fs_.add(fk);
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
