/**
 * Sprite check (`npm run check:sprites`): renders every pose for a normal-build player and asserts the scale rules in
 * src/components/collection/art/sprite/README.md:
 *   - the head and the torso are the same pixel size in every pose (per head kind: side, three-quarter, front, bare);
 *     rotated poses keep the head exact and the torso within 10 % (pixel rotation)
 *   - grounded poses stand on one baseline (the cleats' bottom row is GROUND − 1)
 *   - only build / height change size (huge + tall is the biggest)
 *   - every position has 10–12 named poses, names are unique, old keys resolve, every contact pose has a stand-in,
 *     and turf marks (goal line, sideline) are never knocked off by the frame
 *   - the grey stand-in opponent is drawn on the card players' normal frame: his head and torso match theirs in every
 *     stand-in pose (no oversized helmet, no hulking torso)
 * Exit code 1 on any failure.
 */
import { F, GROUND } from '@/components/collection/art/sprite/grid';
import { lookFor, type SpriteLook } from '@/components/collection/art/sprite/faces';
import { helmetFor } from '@/components/collection/art/sprite/helmets';
import { homeUniform } from '@/components/collection/art/sprite/uniforms';
import { teamStyleFor } from '@/components/collection/art/teamStyle';
import { boundsOf, composeSprite, STAND_IN_HELMET, STAND_IN_LOOK, STAND_IN_UNIFORM, type Grid } from '@/components/collection/art/sprite/render';
import { allPoseKeys, CELEBRATIONS, CONTACT_POSES, isPose, markFor, POSITION_POSES, poseLabel, resolvePose, SIGNATURES, standInsFor } from '@/components/collection/art/sprite/poses';

const errors: string[] = [];
const team = 'Jets';
const style = teamStyleFor({ team });
const hel = helmetFor(team);
const uni = homeUniform(team);
const base = lookFor({ name: 'Sprite Check', position: 'WR', team } as never, null);

const cells = (g: Grid) => g.reduce((n, v) => n + (v ? 1 : 0), 0);
const size = (g: Grid) => {
  const b = boundsOf(g);
  return b ? { w: (b[2] - b[0] + 1) / F, h: (b[3] - b[1] + 1) / F, n: cells(g) / (F * F), bottom: (b[3] + 1) / F } : { w: 0, h: 0, n: 0, bottom: 0 };
};
const render = (look: SpriteLook, key: string) => composeSprite(look, key, style, hel, 27, 'Sprite Check', uni);

// ---------- 1. Catalogue ----------
Object.entries(POSITION_POSES).forEach(([pos, list]) => {
  if (list.length < 10 || list.length > 12) errors.push(`${pos}: ${list.length} poses (want 10–12)`);
  const names = new Set<string>();
  list.forEach(({ key, label }) => {
    if (!isPose(key)) errors.push(`${pos}: ${key} is not a pose`);
    if (!label || label === key) errors.push(`${pos}: ${key} has no name`);
    if (names.has(label)) errors.push(`${pos}: name "${label}" used twice`);
    names.add(label);
  });
});
[...CELEBRATIONS, ...SIGNATURES].forEach(({ key, label }) => {
  if (!isPose(key) || !label) errors.push(`celebration ${key}: missing or unnamed`);
});
allPoseKeys().forEach((k) => {
  if (resolvePose(poseLabel(k)) !== k) errors.push(`${k}: its name "${poseLabel(k)}" does not resolve back to it`);
});
['qb-sneak', 'rb-dive', 'rb-juke', 'rb-spin', 'cel-leap', 'lambeau', 'heisman'].forEach((old) => {
  if (!isPose(old)) errors.push(`old key ${old} no longer resolves`);
});

// ---------- 2. Stand-ins ----------
const standInKeys = new Set<string>();
CONTACT_POSES.forEach((k) => {
  const s = standInsFor(k);
  if (!s.length) errors.push(`${k}: contact pose without a stand-in`);
  s.forEach((st) => {
    if (!isPose(st.pose)) errors.push(`${k}: stand-in pose ${st.pose} is not a pose`);
    standInKeys.add(st.pose);
  });
});

// ---------- 3. Head / torso size and baseline, every pose, normal build ----------
const keys = [...new Set([...allPoseKeys(), ...standInKeys])];
const kindOf = (p: ReturnType<typeof render>['pose']) => (p.helmetOff ? 'bare' : p.look === 'front' ? 'front' : p.look === 'tq' ? 'tq' : 'side');
const ref: Record<string, { w: number; h: number; n: number }> = {};
let torsoRef: { h: number; n: number } | null = null;
const rows: string[] = [];
keys.forEach((key) => {
  const c = render(base, key);
  const head = size(c.head);
  const torso = size(c.torso);
  const kind = kindOf(c.pose);
  const r = (ref[kind] ??= head);
  const rot = !!c.pose.rotate && c.pose.headUp === false;
  if (!rot && (head.w !== r.w || head.h !== r.h)) errors.push(`${key}: ${kind} head ${head.w}×${head.h}, expected ${r.w}×${r.h}`);
  if (!c.pose.rotate) {
    torsoRef ??= { h: torso.h, n: torso.n };
    if (torso.h !== torsoRef.h || torso.n !== torsoRef.n) errors.push(`${key}: torso ${torso.h} rows / ${torso.n} px, expected ${torsoRef.h} / ${torsoRef.n}`);
  }
  const grounded = !c.pose.lift && !c.pose.rotate;
  const sole = size(c.grid).bottom;
  if (grounded && sole !== GROUND) errors.push(`${key}: grounded but the soles end on row ${sole - 1}, not ${GROUND - 1}`);
  if (c.clamped && markFor(key)) errors.push(`${key}: the frame shifted the figure, so its turf mark would miss`);
  rows.push(`${key.padEnd(14)} ${kind.padEnd(5)} head ${head.w}×${head.h} (${head.n} px)  torso ${torso.w}×${torso.h} (${torso.n} px)  ${grounded ? `sole row ${sole - 1}` : c.pose.rotate ? `rotated ${c.pose.rotate}°` : `lift ${c.pose.lift}`}${c.clamped ? '  [frame-clamped]' : ''}`);
});
// Rotated torsos: pixel rotation keeps the area within 10 %
keys.forEach((key) => {
  const c = render(base, key);
  if (!c.pose.rotate || !torsoRef) return;
  const n = size(c.torso).n;
  if (Math.abs(n - torsoRef.n) > torsoRef.n * 0.1) errors.push(`${key}: rotated torso ${n} px vs ${torsoRef.n}`);
});

// ---------- 3b. The stand-in opponent matches the normal build ----------
if (STAND_IN_LOOK.build !== 'normal' || STAND_IN_LOOK.height !== 'normal') errors.push(`stand-in: build ${STAND_IN_LOOK.build} / ${STAND_IN_LOOK.height}, want normal / normal`);
[...standInKeys].forEach((key) => {
  const c = composeSprite(STAND_IN_LOOK, key, style, STAND_IN_HELMET, null, 'stand-in-0', STAND_IN_UNIFORM);
  const head = size(c.head);
  const kind = kindOf(c.pose);
  const r = ref[kind];
  if (!r) errors.push(`stand-in ${key}: ${kind} head has no card-player reference`);
  else if (!(c.pose.rotate && c.pose.headUp === false) && (head.w !== r.w || head.h !== r.h)) errors.push(`stand-in ${key}: ${kind} head ${head.w}×${head.h}, card players' ${r.w}×${r.h}`);
  const torso = size(c.torso);
  if (!c.pose.rotate && torsoRef && (torso.h !== torsoRef.h || torso.n !== torsoRef.n)) errors.push(`stand-in ${key}: torso ${torso.h} rows / ${torso.n} px, card players' ${torsoRef.h} / ${torsoRef.n}`);
  if (c.pose.rotate && torsoRef && Math.abs(torso.n - torsoRef.n) > torsoRef.n * 0.1) errors.push(`stand-in ${key}: rotated torso ${torso.n} px vs ${torsoRef.n}`);
});

// ---------- 4. Only build / height change size ----------
const builds: SpriteLook['build'][] = ['normal', 'big', 'huge'];
const heights: SpriteLook['height'][] = ['normal', 'tall'];
const sizes = builds.flatMap((build) =>
  heights.map((height) => {
    const look = { ...base, build, height };
    const c = render(look, 'wr-stance');
    const fig = size(c.grid);
    return { id: `${build}/${height}`, torso: size(c.torso).n, h: fig.h, n: fig.n };
  }),
);
const biggest = sizes.find((s) => s.id === 'huge/tall');
sizes.forEach((s) => {
  if (biggest && s !== biggest && (s.n >= biggest.n || s.torso > biggest.torso)) errors.push(`${s.id} is as big as huge/tall`);
});
for (const h of heights) {
  const [n, b, g] = builds.map((bd) => sizes.find((s) => s.id === `${bd}/${h}`)!);
  if (!(n.torso < b.torso && b.torso < g.torso)) errors.push(`${h}: torso does not grow normal < big < huge (${n.torso}, ${b.torso}, ${g.torso})`);
}
for (const bd of builds) {
  const [n, t] = heights.map((h) => sizes.find((s) => s.id === `${bd}/${h}`)!);
  if (!(t.h > n.h)) errors.push(`${bd}: tall (${t.h}) is not taller than normal (${n.h})`);
}

console.log(`Sprite check: ${keys.length} poses (${allPoseKeys().length} rollable + ${standInKeys.size} stand-in), normal build; stand-in opponent checked in ${standInKeys.size} poses`);
Object.entries(ref).forEach(([k, r]) => console.log(`  ${k.padEnd(5)} head ${r.w}×${r.h}`));
if (torsoRef) console.log(`  torso ${torsoRef.h} rows, ${torsoRef.n} px in every unrotated pose`);
console.log(`  builds (wr-stance): ${sizes.map((s) => `${s.id} ${s.h} rows / torso ${s.torso} px`).join(', ')}`);
if (process.argv.includes('--verbose')) rows.forEach((r) => console.log('  ' + r));
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.log('  ✗ ' + e));
  process.exit(1);
}
console.log('OK: identical head and torso sizes in every pose, one baseline, only build / height change size');
