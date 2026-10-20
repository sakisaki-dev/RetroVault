import { seedOf } from '../shared';

/**
 * Retro Bowl sprite poses. Each pose places the elbows, hands, knees and feet on the skeleton (facing right, y down),
 * plus the ball, the head angle, a lean / crouch, and for airborne or diving poses a lift and a rotation (applied
 * pixel by pixel, so the art stays crisp). Every player gets a pose from his position's list (or, about one in five,
 * a celebration any position can roll), picked from his name, plus small per-player variations (arm angle, stride,
 * looking up or down), so two players in the same pose still differ. data/y80/sprites.json can lock one ("pose").
 */

export type Pt = [number, number];
/** Head angle: side profile (the default), three-quarter ('tq'), looking up (catches), or facing out. */
export type HeadLook = 'side' | 'up' | 'front' | 'tq';
export type Expression = 'line' | 'grimace' | 'smile' | 'open' | 'stern' | 'exalted';

/** Skeleton anchors every pose builds from. */
export interface Skel {
  cx: number;
  /** Shoulder line and hip line */
  sy: number;
  hy: number;
  /** Front / back shoulder x, front / back hip x */
  fs: number;
  bs: number;
  fh: number;
  bh: number;
  /** Upper-arm (= forearm) length, hip-to-ankle length, half of it */
  A: number;
  L: number;
  h: number;
  /** Ankle line when standing */
  G: number;
}

export interface PoseOut {
  /** shoulder → elbow → hand, hip → knee → ankle */
  frontArm: [Pt, Pt, Pt];
  backArm: [Pt, Pt, Pt];
  frontLeg: [Pt, Pt, Pt];
  backLeg: [Pt, Pt, Pt];
  ball?: Pt;
  /** Ball drawn behind the body (a cocked arm) */
  ballBack?: boolean;
  /** Open flat hand on the front / back arm (stiff-arm, swat, punch) */
  palm?: boolean;
  backPalm?: boolean;
  look: HeadLook;
  /** Face: mouth / brows (grimace on contact, smile or open mouth on celebrations, stern, eyes-up exalted) */
  expr?: Expression;
  /** Helmet off (full face and hair); the helmet is held in the back hand or sits at his feet */
  helmetOff?: boolean;
  helmetAt?: 'hand' | 'feet';
  /** Both arms in front of the body (crossed arms) */
  armsFront?: boolean;
  /** Hair blown back as if in wind */
  wind?: boolean;
  /** Head nod: + down, − up */
  nod?: number;
  /** Light rays from above (signature praise pose) */
  halo?: boolean;
  /** Head shift forward (negative leans back) */
  lean: number;
  /** Knees bent: the upper body drops this much (feet stay planted) */
  crouch: number;
  /** Airborne: the figure is raised this much */
  lift?: number;
  /** Diving / lunging: degrees clockwise around the hips, then the figure is refit above the turf */
  rotate?: number;
}

type Arm = [Pt, Pt, Pt];
type Leg = [Pt, Pt, Pt];
type PoseFn = (k: Skel) => Partial<PoseOut> & Pick<PoseOut, 'frontArm' | 'backArm' | 'frontLeg' | 'backLeg'>;

// ---------- Limb building blocks ----------
const sh = (k: Skel, front: boolean): Pt => (front ? [k.fs, k.sy + 1] : [k.bs, k.sy + 1]);
/** Front arm tucking the ball high and tight */
const tuck = (k: Skel): Arm => [sh(k, true), [k.fs + 1, k.sy + k.A], [k.fs + 5, k.sy + k.A - 1]];
const tuckBall = (k: Skel): Pt => [k.fs + 5, k.sy + k.A - 3];
/** Running arm swings */
const pumpFront = (k: Skel): Arm => [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + 6, k.sy + 1]];
const pumpBack = (k: Skel): Arm => [sh(k, false), [k.bs - k.A + 1, k.sy + 4], [k.bs - k.A - 1, k.sy - 1]];
const swingBack = (k: Skel): Arm => [sh(k, false), [k.bs - 4, k.sy + 3], [k.bs - 6, k.sy + 7]];
/** Arm straight up (dx shifts the hand forward) */
const upArm = (k: Skel, front: boolean, dx = 0): Arm => {
  const [x, y] = sh(k, front);
  return [[x, y], [x + (front ? 1 : -1), k.sy - k.A + 1], [x + dx + (front ? 2 : -2), k.sy - k.A * 2]];
};
/** Arm reaching forward at shoulder height + dy */
const fwdArm = (k: Skel, front: boolean, dy = 0, reach = 0): Arm =>
  front ? [sh(k, true), [k.fs + k.A - 1, k.sy + 2 + dy], [k.fs + k.A * 2 - 1 + reach, k.sy + 2 + dy]] : [[k.bs + 2, k.sy + 2], [k.bs + k.A + 1, k.sy + 4 + dy], [k.fs + k.A + reach, k.sy + 4 + dy]];
/** Arm hanging loose at the side */
const hang = (k: Skel, front: boolean): Arm => {
  const [x, y] = sh(k, front);
  return [[x, y], [x + (front ? 1 : -1), k.sy + k.A], [x + (front ? 2 : -1), k.sy + k.A * 2 - 1]];
};
/** Hands on the knees / low and forward (ready stance) */
const lowArm = (k: Skel, front: boolean): Arm =>
  front ? [sh(k, true), [k.fs + k.A - 1, k.sy + 5], [k.fs + k.A * 2 - 1, k.sy + 7]] : [[k.bs + 2, k.sy + 2], [k.bs + k.A + 1, k.sy + 7], [k.fs + k.A, k.sy + 9]];

/** Running stride: front knee driving, back leg pushing off */
const stride = (k: Skel, s = 1): [Leg, Leg] => [
  [[k.fh, k.hy], [k.fh + 6 + s, k.hy + 3], [k.fh + 5 + s, k.hy + k.L - 4]],
  [[k.bh, k.hy], [k.bh - 3, k.hy + k.h], [k.bh - 8 - s, k.G]],
];
/** Planted, feet w apart either side */
const plant = (k: Skel, w = 4): [Leg, Leg] => [
  [[k.fh, k.hy], [k.fh + w, k.hy + k.h], [k.fh + w + 2, k.G]],
  [[k.bh, k.hy], [k.bh - w, k.hy + k.h], [k.bh - w - 2, k.G]],
];
/** Standing tall */
const stand = (k: Skel): [Leg, Leg] => [
  [[k.fh, k.hy], [k.fh + 1, k.hy + k.h], [k.fh + 2, k.G]],
  [[k.bh, k.hy], [k.bh - 1, k.hy + k.h], [k.bh - 2, k.G]],
];
/** Airborne: knees tucked */
const tucked = (k: Skel): [Leg, Leg] => [
  [[k.fh, k.hy], [k.fh + 6, k.hy + 3], [k.fh + 3, k.hy + k.L - 5]],
  [[k.bh, k.hy], [k.bh - 1, k.hy + k.h], [k.bh - 4, k.hy + k.L - 2]],
];
/** Driving: front knee bent under, back leg long */
const drive = (k: Skel): [Leg, Leg] => [
  [[k.fh, k.hy], [k.fh + 6, k.hy + k.h - 2], [k.fh + 5, k.G]],
  [[k.bh, k.hy], [k.bh - 4, k.hy + k.h], [k.bh - 11, k.G]],
];
const legs = ([frontLeg, backLeg]: [Leg, Leg]) => ({ frontLeg, backLeg });

const P: Record<string, PoseFn> = {
  // ---------- Quarterbacks ----------
  'qb-windup': (k) => ({
    frontArm: [sh(k, true), [k.fs + k.A - 1, k.sy + 4], [k.fs + k.A * 2 - 1, k.sy + 3]],
    backArm: [sh(k, false), [k.bs - k.A + 2, k.sy - 2], [k.bs - k.A + 3, k.sy - k.A - 3]],
    ...legs(plant(k, 4)),
    ball: [k.bs - k.A + 4, k.sy - k.A - 6],
    ballBack: true,
  }),
  'qb-follow': (k) => ({
    backArm: [sh(k, false), [k.bs + k.A, k.sy + 3], [k.fs + k.A, k.sy + k.A + 1]],
    frontArm: [sh(k, true), [k.fs + 1, k.sy + k.A], [k.fs - 2, k.sy + k.A * 2 - 2]],
    frontLeg: [[k.fh, k.hy], [k.fh + 5, k.hy + k.h], [k.fh + 7, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh - 2, k.hy + k.h + 1], [k.bh - 7, k.G - 3]],
    lean: 2,
    crouch: 1,
  }),
  'qb-rollout': (k) => ({
    backArm: [sh(k, false), [k.bs - 2, k.sy - 1], [k.bs + 1, k.sy - k.A]],
    frontArm: pumpFront(k),
    ...legs(stride(k)),
    ball: [k.bs + 1, k.sy - k.A - 2],
    lean: 1,
  }),
  'qb-point': (k) => ({ look: 'tq',
    frontArm: [sh(k, true), [k.fs + 3, k.sy - 3], [k.fs + 6, k.sy - k.A - 1]],
    backArm: [sh(k, false), [k.bs + 1, k.sy + k.A], [k.fs - 2, k.sy + k.A - 1]],
    ...legs(stand(k)),
    ball: [k.fs - 2, k.sy + k.A - 2],
    palm: true,
  }),
  'qb-handoff': (k) => ({
    frontArm: [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + k.A + 4, k.sy + k.A + 1]],
    backArm: [sh(k, false), [k.bs + 2, k.sy + k.A], [k.fs + 1, k.sy + k.A + 2]],
    ...legs(plant(k, 3)),
    ball: [k.fs + k.A + 5, k.sy + k.A - 1],
    look: 'side',
    lean: 2,
    crouch: 2,
  }),
  'qb-scramble': (k) => ({
    frontArm: [sh(k, true), [k.fs + 2, k.sy - 2], [k.fs + 4, k.sy - k.A - 1]],
    backArm: pumpBack(k),
    ...legs(stride(k, 2)),
    ball: [k.fs + 4, k.sy - k.A - 3],
    lean: 1,
  }),
  'qb-sidearm': (k) => ({
    frontArm: [sh(k, true), [k.fs + k.A - 1, k.sy + 3], [k.fs + k.A * 2 - 2, k.sy + 5]],
    backArm: [sh(k, false), [k.bs - k.A, k.sy + 1], [k.bs - k.A * 2 + 1, k.sy - 1]],
    ...legs(plant(k, 5)),
    ball: [k.bs - k.A * 2, k.sy - 3],
    ballBack: true,
    lean: -1,
    crouch: 2,
  }),
  'qb-shotgun': (k) => ({ look: 'tq',
    frontArm: [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + 6, k.sy + 4]],
    backArm: [[k.bs + 2, k.sy + 2], [k.bs + 5, k.sy + 5], [k.fs + 5, k.sy + 5]],
    ...legs(plant(k, 3)),
    palm: true,
    backPalm: true,
    lean: 1,
    crouch: 4,
  }),
  'qb-sneak': (k) => ({
    frontArm: tuck(k),
    backArm: [[k.bs + 2, k.sy + 2], [k.bs + 4, k.sy + k.A], [k.fs + 3, k.sy + k.A]],
    ...legs(drive(k)),
    ball: tuckBall(k),
    rotate: 25,
  }),
  'qb-pump': (k) => ({ look: 'tq',
    frontArm: [sh(k, true), [k.fs + 3, k.sy - 1], [k.fs + 4, k.sy - 4]],
    backArm: [sh(k, false), [k.bs + 2, k.sy - 2], [k.fs + 2, k.sy - 5]],
    ...legs(plant(k, 3)),
    ball: [k.fs + 3, k.sy - 6],
  }),
  // ---------- Running backs ----------
  'rb-stiffarm': (k) => ({
    frontArm: [sh(k, true), [k.fs + k.A, k.sy], [k.fs + k.A * 2, k.sy - 1]],
    backArm: [sh(k, false), [k.bs + 1, k.sy + k.A], [k.fs - 2, k.sy + k.A + 1]],
    frontLeg: [[k.fh, k.hy], [k.fh + 7, k.hy + 4], [k.fh + 3, k.hy + k.L - 5]],
    backLeg: [[k.bh, k.hy], [k.bh - 1, k.hy + k.h], [k.bh - 3, k.G]],
    ball: [k.fs - 3, k.sy + k.A - 2],
    palm: true,
    lean: 1,
  }),
  'rb-hurdle': (k) => ({
    frontArm: tuck(k),
    backArm: [sh(k, false), [k.bs - 3, k.sy - 2], [k.bs - 5, k.sy - k.A]],
    frontLeg: [[k.fh, k.hy], [k.fh + 6, k.hy + 2], [k.fh + 12, k.hy + 3]],
    backLeg: [[k.bh, k.hy], [k.bh - 2, k.hy + 6], [k.bh - 8, k.hy + 4]],
    ball: tuckBall(k),
    lift: 9,
    lean: 1,
  }),
  'rb-juke': (k) => ({
    backArm: [sh(k, false), [k.bs + 1, k.sy + k.A], [k.bs + 3, k.sy + k.A - 2]],
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 2], [k.fs + 8, k.sy + 5]],
    frontLeg: [[k.fh, k.hy], [k.fh + 8, k.hy + k.h], [k.fh + 10, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh + 1, k.hy + k.h + 1], [k.bh - 4, k.G - 1]],
    ball: [k.bs + 3, k.sy + k.A - 3],
    lean: -2,
    crouch: 3,
  }),
  'rb-dive': (k) => ({
    frontArm: upArm(k, true),
    backArm: upArm(k, false, 3),
    frontLeg: [[k.fh, k.hy], [k.fh, k.hy + k.h], [k.fh - 1, k.hy + k.L]],
    backLeg: [[k.bh, k.hy], [k.bh - 1, k.hy + k.h - 1], [k.bh - 4, k.hy + k.L - 3]],
    ball: [k.fs + 1, k.sy - k.A * 2 - 2],
    look: 'up',
    rotate: 72,
    lift: 9,
  }),
  'rb-carry': (k) => ({ frontArm: tuck(k), backArm: pumpBack(k), ...legs(stride(k)), ball: tuckBall(k), lean: 2, crouch: 2 }),
  'rb-truck': (k) => ({
    frontArm: tuck(k),
    backArm: [[k.bs + 2, k.sy + 2], [k.bs + 4, k.sy + 5], [k.fs + 1, k.sy + 4]],
    ...legs(drive(k)),
    ball: tuckBall(k),
    lean: 4,
    crouch: 4,
  }),
  'rb-spin': (k) => ({
    frontArm: [sh(k, true), [k.fs - 1, k.sy + k.A - 1], [k.fs + 3, k.sy + k.A]],
    backArm: [sh(k, false), [k.bs - k.A, k.sy], [k.bs - k.A * 2 + 1, k.sy - 2]],
    frontLeg: [[k.fh, k.hy], [k.fh + 2, k.hy + k.h], [k.fh + 1, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh - 6, k.hy + k.h - 2], [k.bh - 9, k.hy + k.L - 4]],
    ball: [k.fs + 3, k.sy + k.A - 2],
    lean: -1,
    crouch: 2,
  }),
  'rb-catch': (k) => ({
    frontArm: [sh(k, true), [k.fs + 3, k.sy], [k.fs + 6, k.sy - 3]],
    backArm: [sh(k, false), [k.bs + 3, k.sy - 1], [k.fs + 4, k.sy - 4]],
    ...legs(stride(k)),
    ball: [k.fs + 6, k.sy - 6],
    look: 'up',
    lean: -1,
  }),
  'rb-block': (k) => ({ frontArm: fwdArm(k, true, 1), backArm: fwdArm(k, false, 0), ...legs(plant(k, 5)), palm: true, backPalm: true, lean: 1, crouch: 4 }),
  'rb-cutback': (k) => ({
    frontArm: tuck(k),
    backArm: [sh(k, false), [k.bs - 3, k.sy - 1], [k.bs - 6, k.sy - 3]],
    frontLeg: [[k.fh, k.hy], [k.fh + 4, k.hy + k.h], [k.fh + 8, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh - 2, k.hy + k.h], [k.bh - 3, k.G - 2]],
    ball: tuckBall(k),
    lean: -2,
    crouch: 3,
  }),
  // ---------- Receivers ----------
  'wr-highpoint': (k) => ({
    frontArm: [sh(k, true), [k.fs + 1, k.sy - k.A + 1], [k.cx + 4, k.sy - k.A * 2 - 1]],
    backArm: [sh(k, false), [k.bs - 1, k.sy - k.A + 1], [k.cx - 1, k.sy - k.A * 2 - 1]],
    ...legs(tucked(k)),
    ball: [k.cx + 2, k.sy - k.A * 2 - 4],
    look: 'up',
    lift: 2,
  }),
  'wr-onehand': (k) => ({
    frontArm: [sh(k, true), [k.fs + 3, k.sy - k.A + 1], [k.fs + 5, k.sy - k.A * 2]],
    backArm: swingBack(k),
    ...legs(tucked(k)),
    ball: [k.fs + 7, k.sy - k.A * 2 - 2],
    look: 'up',
    lift: 4,
    lean: 1,
  }),
  'wr-cut': (k) => ({
    frontArm: pumpFront(k),
    backArm: swingBack(k),
    frontLeg: [[k.fh, k.hy], [k.fh + 7, k.hy + k.h - 1], [k.fh + 9, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh - 4, k.hy + k.h], [k.bh - 9, k.G - 2]],
    lean: 2,
    crouch: 3,
  }),
  'wr-toetap': (k) => ({
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 1], [k.fs + k.A + 3, k.sy]],
    backArm: [sh(k, false), [k.bs + 4, k.sy + 3], [k.fs + k.A + 2, k.sy + 2]],
    frontLeg: [[k.fh, k.hy], [k.fh + 1, k.hy + k.h], [k.fh + 2, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh, k.hy + k.h], [k.bh + 1, k.G - 1]],
    ball: [k.fs + k.A + 5, k.sy],
    lean: -1,
  }),
  'wr-stance': (k) => ({ look: 'tq',
    frontArm: hang(k, true),
    backArm: [sh(k, false), [k.bs - 2, k.sy + k.A - 1], [k.bs - 1, k.sy + k.A * 2 - 2]],
    frontLeg: [[k.fh, k.hy], [k.fh + 5, k.hy + k.h], [k.fh + 6, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh - 2, k.hy + k.h], [k.bh - 5, k.G]],
    lean: 2,
    crouch: 3,
  }),
  'wr-slant': (k) => ({ frontArm: fwdArm(k, true, -1, 1), backArm: fwdArm(k, false, -2, 1), ...legs(stride(k)), ball: [k.fs + k.A * 2 + 2, k.sy], lean: 1 }),
  'wr-fade': (k) => ({
    frontArm: [sh(k, true), [k.fs + 1, k.sy - k.A + 1], [k.fs - 1, k.sy - k.A * 2]],
    backArm: [sh(k, false), [k.bs - 2, k.sy - k.A + 2], [k.bs - 3, k.sy - k.A * 2 + 1]],
    ...legs(stride(k, 2)),
    ball: [k.cx - 4, k.sy - k.A * 2 - 3],
    look: 'up',
    lean: -2,
  }),
  'wr-score': (k) => ({ frontArm: upArm(k, true, 1), backArm: pumpBack(k), ...legs(stride(k, 2)), ball: [k.fs + 3, k.sy - k.A * 2 - 2], lean: 1 }),
  'wr-stutter': (k) => ({
    frontArm: [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + 4, k.sy + 1]],
    backArm: [sh(k, false), [k.bs - 2, k.sy + 4], [k.bs - 2, k.sy + 1]],
    ...legs(plant(k, 2)),
    lean: 1,
    crouch: 3,
  }),
  'wr-yac': (k) => ({ frontArm: tuck(k), backArm: [sh(k, false), [k.bs - 4, k.sy + 1], [k.bs - 8, k.sy + 1]], ...legs(stride(k, 2)), ball: tuckBall(k), backPalm: true, lean: 2, crouch: 1 }),
  // ---------- Tight ends ----------
  'te-traffic': (k) => ({ look: 'tq',
    frontArm: [sh(k, true), [k.fs + 2, k.sy + 3], [k.fs + 4, k.sy + 1]],
    backArm: [sh(k, false), [k.bs + 3, k.sy + 4], [k.fs + 2, k.sy + 2]],
    ...legs(plant(k, 5)),
    ball: [k.fs + 5, k.sy - 1],
    lean: 1,
    crouch: 2,
  }),
  'te-block': (k) => ({ frontArm: fwdArm(k, true, 1), backArm: fwdArm(k, false, 1), ...legs(plant(k, 5)), palm: true, backPalm: true, lean: 2, crouch: 3 }),
  'te-seam': (k) => ({ frontArm: tuck(k), backArm: pumpBack(k), ...legs(stride(k, 1)), ball: tuckBall(k), lean: 1, crouch: 1 }),
  'te-stance': (k) => ({ frontArm: [sh(k, true), [k.fs + 2, k.sy + k.A], [k.fs + 3, k.G - 9]], backArm: lowArm(k, false), ...legs(drive(k)), palm: true, lean: 3, crouch: 7 }),
  'te-chip': (k) => ({ frontArm: fwdArm(k, true, 2, 2), backArm: swingBack(k), ...legs(stride(k)), palm: true, lean: 3, crouch: 2 }),
  'te-rumble': (k) => ({ frontArm: tuck(k), backArm: [[k.bs + 2, k.sy + 2], [k.bs + 5, k.sy + 4], [k.fs + 3, k.sy + 3]], ...legs(drive(k)), ball: tuckBall(k), lean: 3, crouch: 3 }),
  // ---------- Offensive line ----------
  'ol-passpro': (k) => ({ frontArm: fwdArm(k, true, 2, 1), backArm: fwdArm(k, false, 2), ...legs(plant(k, 5)), lean: 1, crouch: 3 }),
  'ol-drive': (k) => ({ frontArm: fwdArm(k, true, -1, 2), backArm: fwdArm(k, false, -1, 2), ...legs(drive(k)), palm: true, backPalm: true, lean: 3, crouch: 4 }),
  'ol-pull': (k) => ({ frontArm: pumpFront(k), backArm: [sh(k, false), [k.bs - 3, k.sy + 4], [k.bs - 6, k.sy + 2]], ...legs(stride(k)), lean: 1, crouch: 2 }),
  'ol-stance': (k) => ({ frontArm: [sh(k, true), [k.fs + 2, k.sy + k.A], [k.fs + 3, k.G - 9]], backArm: lowArm(k, false), ...legs(drive(k)), palm: true, lean: 3, crouch: 8 }),
  'ol-anchor': (k) => ({ frontArm: fwdArm(k, true, 0, 1), backArm: fwdArm(k, false, 1), ...legs(plant(k, 6)), palm: true, backPalm: true, lean: -1, crouch: 4 }),
  'ol-punch': (k) => ({ frontArm: fwdArm(k, true, 1, 3), backArm: fwdArm(k, false, 2, 3), ...legs(plant(k, 4)), palm: true, backPalm: true, lean: 2, crouch: 3 }),
  'ol-reach': (k) => ({
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 2], [k.fs + 8, k.sy + 4]],
    backArm: [sh(k, false), [k.bs - 3, k.sy + 3], [k.bs - 5, k.sy + 6]],
    frontLeg: [[k.fh, k.hy], [k.fh + 7, k.hy + k.h], [k.fh + 9, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh - 1, k.hy + k.h], [k.bh - 2, k.G]],
    palm: true,
    lean: 2,
    crouch: 3,
  }),
  'ol-ready': (k) => ({ look: 'tq', frontArm: lowArm(k, true), backArm: lowArm(k, false), ...legs(plant(k, 4)), lean: 2, crouch: 4 }),
  // ---------- Defensive line ----------
  'dl-three': (k) => ({ frontArm: [sh(k, true), [k.fs + 2, k.sy + k.A], [k.fs + 3, k.G - 9]], backArm: lowArm(k, false), ...legs(drive(k)), palm: true, lean: 3, crouch: 8 }),
  'dl-swim': (k) => ({
    backArm: [sh(k, false), [k.bs + 3, k.sy - 5], [k.fs + 4, k.sy - 8]],
    frontArm: [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + 6, k.sy + 7]],
    ...legs(stride(k)),
    palm: true,
    lean: 2,
    crouch: 2,
  }),
  'dl-bull': (k) => ({ frontArm: fwdArm(k, true, -1, 2), backArm: fwdArm(k, false, -1, 2), ...legs(drive(k)), palm: true, backPalm: true, lean: 3, crouch: 5 }),
  'dl-sack': (k) => ({
    frontArm: [sh(k, true), [k.fs + 5, k.sy + 1], [k.fs + 10, k.sy - 1]],
    backArm: [sh(k, false), [k.bs + 5, k.sy - 2], [k.fs + 8, k.sy - 4]],
    frontLeg: [[k.fh, k.hy], [k.fh + 5, k.hy + k.h], [k.fh + 3, k.hy + k.L - 2]],
    backLeg: [[k.bh, k.hy], [k.bh - 4, k.hy + k.h], [k.bh - 9, k.hy + k.L - 2]],
    palm: true,
    backPalm: true,
    rotate: 30,
  }),
  'dl-spin': (k) => ({
    frontArm: [sh(k, true), [k.fs - 1, k.sy + k.A - 1], [k.fs + 3, k.sy + k.A]],
    backArm: [sh(k, false), [k.bs - k.A, k.sy], [k.bs - k.A * 2 + 1, k.sy - 2]],
    frontLeg: [[k.fh, k.hy], [k.fh + 2, k.hy + k.h], [k.fh + 1, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh - 6, k.hy + k.h - 2], [k.bh - 9, k.hy + k.L - 4]],
    lean: -1,
    crouch: 2,
  }),
  'dl-rip': (k) => ({
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 3], [k.fs + 7, k.sy + 6]],
    backArm: [sh(k, false), [k.bs + 4, k.sy + 4], [k.fs + 2, k.sy - 3]],
    ...legs(drive(k)),
    lean: 3,
    crouch: 3,
  }),
  'dl-bat': (k) => ({ frontArm: upArm(k, true), backArm: upArm(k, false), ...legs(tucked(k)), palm: true, backPalm: true, look: 'up', lift: 5 }),
  'dl-four': (k) => ({ frontArm: [sh(k, true), [k.fs + 2, k.sy + k.A], [k.fs + 3, k.G - 9]], backArm: [[k.bs + 2, k.sy + 2], [k.bs + 4, k.sy + k.A], [k.fs, k.G - 9]], ...legs(drive(k)), palm: true, backPalm: true, lean: 3, crouch: 9 }),
  'dl-chase': (k) => ({ frontArm: pumpFront(k), backArm: swingBack(k), ...legs(stride(k, 2)), lean: 2, crouch: 1 }),
  // ---------- Linebackers ----------
  'lb-read': (k) => ({ look: 'tq', frontArm: lowArm(k, true), backArm: lowArm(k, false), frontLeg: [[k.fh, k.hy], [k.fh + 6, k.hy + k.h - 1], [k.fh + 6, k.G]], backLeg: [[k.bh, k.hy], [k.bh - 6, k.hy + k.h - 1], [k.bh - 7, k.G]], lean: 2, crouch: 4 }),
  'lb-tackle': (k) => ({
    frontArm: [sh(k, true), [k.fs + 5, k.sy + 2], [k.fs + 8, k.sy + 6]],
    backArm: [[k.bs + 2, k.sy + 2], [k.bs + 7, k.sy + 3], [k.fs + 7, k.sy + 7]],
    ...legs(drive(k)),
    lean: 3,
    crouch: 5,
  }),
  'lb-blitz': (k) => ({ frontArm: pumpFront(k), backArm: swingBack(k), frontLeg: [[k.fh, k.hy], [k.fh + 7, k.hy + 2], [k.fh + 7, k.hy + k.L - 5]], backLeg: [[k.bh, k.hy], [k.bh - 4, k.hy + k.h + 1], [k.bh - 10, k.G - 1]], lean: 2, crouch: 1 }),
  'lb-drop': (k) => ({ frontArm: upArm(k, true), backArm: upArm(k, false), ...legs(plant(k, 3)), palm: true, backPalm: true, look: 'up', crouch: 1 }),
  'lb-stack': (k) => ({ look: 'tq', frontArm: hang(k, true), backArm: [sh(k, false), [k.bs + 1, k.sy + k.A - 1], [k.bs + 4, k.sy + k.A + 3]], ...legs(plant(k, 4)), lean: 1, crouch: 3 }),
  'lb-shed': (k) => ({ frontArm: fwdArm(k, true, 0, 3), backArm: [sh(k, false), [k.bs - 3, k.sy + 2], [k.bs - 6, k.sy + 4]], ...legs(drive(k)), palm: true, lean: 2, crouch: 3 }),
  'lb-pursuit': (k) => ({ frontArm: pumpFront(k), backArm: pumpBack(k), ...legs(stride(k, 2)), lean: 2 }),
  'lb-jump': (k) => ({ frontArm: upArm(k, true, 2), backArm: upArm(k, false, 1), ...legs(tucked(k)), palm: true, backPalm: true, look: 'up', lift: 6 }),
  'lb-wrap': (k) => ({
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 1], [k.fs + 6, k.sy + 5]],
    backArm: [[k.bs + 2, k.sy + 2], [k.bs + 6, k.sy + 2], [k.fs + 5, k.sy + 6]],
    ...legs(plant(k, 4)),
    lean: 2,
    crouch: 2,
  }),
  // ---------- Defensive backs ----------
  'db-backpedal': (k) => ({
    frontArm: [sh(k, true), [k.fs + 2, k.sy + 4], [k.fs + 4, k.sy + k.A + 2]],
    backArm: [sh(k, false), [k.bs - 1, k.sy + 4], [k.bs - 3, k.sy + k.A + 2]],
    frontLeg: [[k.fh, k.hy], [k.fh + 3, k.hy + k.h], [k.fh + 2, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh - 3, k.hy + k.h], [k.bh - 6, k.G]],
    lean: 2,
    crouch: 4,
  }),
  'db-pick': (k) => ({
    frontArm: [sh(k, true), [k.fs + 1, k.sy - k.A + 1], [k.cx + 4, k.sy - k.A * 2 - 1]],
    backArm: [sh(k, false), [k.bs - 1, k.sy - k.A + 1], [k.cx - 1, k.sy - k.A * 2 - 1]],
    frontLeg: [[k.fh, k.hy], [k.fh + 1, k.hy + k.h], [k.fh, k.hy + k.L]],
    backLeg: [[k.bh, k.hy], [k.bh - 2, k.hy + k.h], [k.bh - 3, k.hy + k.L - 2]],
    ball: [k.cx + 2, k.sy - k.A * 2 - 4],
    look: 'up',
    rotate: 60,
  }),
  'db-swat': (k) => ({ frontArm: [sh(k, true), [k.fs + 3, k.sy - k.A], [k.fs + 6, k.sy - k.A * 2]], backArm: swingBack(k), ...legs(tucked(k)), ball: [k.fs + 9, k.sy - k.A * 2 - 4], palm: true, look: 'up', lift: 5 }),
  'db-press': (k) => ({ frontArm: fwdArm(k, true, 2, 1), backArm: fwdArm(k, false, 3), ...legs(plant(k, 5)), palm: true, backPalm: true, lean: 2, crouch: 4 }),
  'db-breakdown': (k) => ({ look: 'tq',
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 3], [k.fs + 7, k.sy + 6]],
    backArm: [sh(k, false), [k.bs - 4, k.sy + 3], [k.bs - 7, k.sy + 6]],
    ...legs(plant(k, 6)),
    palm: true,
    backPalm: true,
    lean: 1,
    crouch: 5,
  }),
  'db-turn': (k) => ({ frontArm: pumpFront(k), backArm: pumpBack(k), ...legs(stride(k, 2)), look: 'up', lean: 1 }),
  'db-highpick': (k) => ({
    frontArm: upArm(k, true, 2),
    backArm: upArm(k, false, 4),
    ...legs(tucked(k)),
    ball: [k.fs + 3, k.sy - k.A * 2 - 3],
    look: 'up',
    lift: 4,
  }),
  'db-return': (k) => ({ frontArm: tuck(k), backArm: pumpBack(k), ...legs(stride(k, 2)), ball: tuckBall(k), lean: 2, crouch: 1 }),
  'db-jam': (k) => ({ frontArm: fwdArm(k, true, 1, 3), backArm: swingBack(k), ...legs(plant(k, 4)), palm: true, lean: 2, crouch: 3 }),
  'db-hips': (k) => ({
    frontArm: hang(k, true),
    backArm: [sh(k, false), [k.bs - 3, k.sy + 3], [k.bs - 4, k.sy + 7]],
    frontLeg: [[k.fh, k.hy], [k.fh + 2, k.hy + k.h], [k.fh - 1, k.G]],
    backLeg: [[k.bh, k.hy], [k.bh - 6, k.hy + k.h - 1], [k.bh - 8, k.G]],
    lean: -1,
    crouch: 4,
  }),
  // ---------- Signature poses (owner-requested, locked in sprites.json) ----------
  'sig-crossed': (k) => ({
    // Arms crossed over the chest, both in front of the torso; helmet at his feet; stern; dreads blown back
    frontArm: [sh(k, true), [k.fs + 1, k.sy + k.A - 1], [k.bs + 3, k.sy + k.A - 3]],
    backArm: [sh(k, false), [k.bs - 1, k.sy + k.A], [k.fs - 1, k.sy + k.A - 1]],
    ...legs(plant(k, 3)),
    armsFront: true,
    helmetOff: true,
    helmetAt: 'feet',
    expr: 'stern',
    wind: true,
    nod: 1,
    look: 'front',
  }),
  'sig-praise': (k) => ({
    // Both arms raised and open to the sky, palms up; eyes up; helmet off (durag); light from above
    frontArm: [sh(k, true), [k.fs + 3, k.sy - k.A + 2], [k.fs + 7, k.sy - k.A * 2 + 1]],
    backArm: [sh(k, false), [k.bs - 3, k.sy - k.A + 2], [k.bs - 7, k.sy - k.A * 2 + 1]],
    ...legs(stand(k)),
    palm: true,
    backPalm: true,
    helmetOff: true,
    helmetAt: 'feet',
    expr: 'exalted',
    look: 'front',
    halo: true,
  }),
  'sig-cold': (k) => ({
    // "Scary Jerry": helmet off and hanging from one hand, the ball held at his other side, standing tall, staring out
    backArm: [sh(k, false), [k.bs - 2, k.sy + k.A], [k.bs - 3, k.sy + k.A * 2 - 1]],
    frontArm: [sh(k, true), [k.fs + 2, k.sy + k.A - 1], [k.fs + 2, k.sy + k.A * 2 - 2]],
    ...legs(plant(k, 3)),
    ball: [k.fs + 3, k.sy + k.A * 2 - 3],
    look: 'front',
    helmetOff: true,
    helmetAt: 'hand',
    expr: 'stern',
  }),
  // ---------- Celebrations (any position) ----------
  'cel-point': (k) => ({ look: 'tq',
    frontArm: [sh(k, true), [k.fs + k.A - 1, k.sy], [k.fs + k.A * 2, k.sy - 2]],
    backArm: [sh(k, false), [k.bs - 1, k.sy + k.A], [k.bs - 1, k.sy + k.A * 2 - 2]],
    ...legs(plant(k, 3)),
    ball: [k.bs - 1, k.sy + k.A * 2 - 3],
    expr: 'open',
  }),
  'cel-finger': (k) => ({
    frontArm: [sh(k, true), [k.fs + 1, k.sy - k.A + 1], [k.fs + 1, k.sy - k.A * 2]],
    backArm: hang(k, false),
    ...legs(stand(k)),
    look: 'up',
  }),
  'cel-ref': (k) => ({ look: 'tq',
    frontArm: [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + k.A + 4, k.sy + k.A]],
    backArm: hang(k, false),
    ...legs(stand(k)),
    ball: [k.fs + k.A + 5, k.sy + k.A - 2],
    expr: 'smile',
  }),
  'cel-spike': (k) => ({
    frontArm: [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + 4, k.sy + k.A * 2]],
    backArm: [sh(k, false), [k.bs - 4, k.sy - 2], [k.bs - 6, k.sy - k.A]],
    ...legs(plant(k, 4)),
    ball: [k.fs + 5, k.G - 1],
    look: 'side',
    expr: 'open',
    lean: 2,
    crouch: 2,
  }),
  'cel-flex': (k) => ({
    frontArm: [sh(k, true), [k.fs + k.A, k.sy + 1], [k.fs + k.A, k.sy - k.A + 1]],
    backArm: [sh(k, false), [k.bs - k.A, k.sy + 1], [k.bs - k.A, k.sy - k.A + 1]],
    ...legs(plant(k, 3)),
    look: 'front',
    helmetOff: true,
    helmetAt: 'feet',
    expr: 'grimace',
  }),
  'cel-leap': (k) => ({ frontArm: upArm(k, true, 2), backArm: upArm(k, false, -2), frontLeg: [[k.fh, k.hy], [k.fh + 4, k.hy + 5], [k.fh + 1, k.hy + k.L - 3]], backLeg: [[k.bh, k.hy], [k.bh - 4, k.hy + 5], [k.bh - 1, k.hy + k.L - 3]], look: 'front', expr: 'smile', lift: 10 }),
};

/** Contact poses grimace. */
const GRIMACE = new Set(['dl-bull', 'dl-sack', 'lb-tackle', 'rb-truck', 'ol-drive', 'lb-shed', 'dl-rip', 'te-block', 'ol-punch', 'db-jam', 'rb-stiffarm', 'qb-sneak']);

const L = (keys: string[], labels: string[]) => keys.map((key, i) => ({ key, label: labels[i] }));

/** Poses per position (and the celebrations anyone can roll), with names for the Art lab. */
export const POSITION_POSES: Record<string, { key: string; label: string }[]> = {
  QB: L(
    ['qb-windup', 'qb-follow', 'qb-rollout', 'qb-point', 'qb-handoff', 'qb-scramble', 'qb-sidearm', 'qb-shotgun', 'qb-sneak', 'qb-pump'],
    ['Windup', 'Follow-through', 'Rollout throw', 'Audible', 'Handoff', 'Scramble', 'Sidearm', 'Shotgun', 'QB sneak', 'Pump fake'],
  ),
  RB: L(
    ['rb-stiffarm', 'rb-hurdle', 'rb-juke', 'rb-dive', 'rb-carry', 'rb-truck', 'rb-spin', 'rb-catch', 'rb-block', 'rb-cutback'],
    ['Stiff-arm', 'Hurdle', 'Juke', 'Goal-line dive', 'Carry', 'Truck stick', 'Spin move', 'Catch out of the backfield', 'Pass block', 'Cutback'],
  ),
  WR: L(
    ['wr-highpoint', 'wr-onehand', 'wr-cut', 'wr-toetap', 'wr-stance', 'wr-slant', 'wr-fade', 'wr-score', 'wr-stutter', 'wr-yac'],
    ['High-point', 'One-hander', 'Route cut', 'Toe-tap', 'Stance', 'Slant catch', 'Fade', 'Ball up, scoring', 'Stutter-go', 'Yards after catch'],
  ),
  TE: L(
    ['te-traffic', 'te-block', 'te-seam', 'te-stance', 'te-chip', 'te-rumble', 'wr-highpoint', 'rb-stiffarm'],
    ['Catch in traffic', 'Block', 'Seam route', 'Three-point stance', 'Chip and release', 'Rumble', 'High-point', 'Stiff-arm'],
  ),
  OL: L(
    ['ol-passpro', 'ol-drive', 'ol-pull', 'ol-stance', 'ol-anchor', 'ol-punch', 'ol-reach', 'ol-ready'],
    ['Pass pro', 'Drive block', 'Pull', 'Three-point stance', 'Anchor', 'Punch', 'Reach block', 'Ready'],
  ),
  DL: L(
    ['dl-three', 'dl-swim', 'dl-bull', 'dl-sack', 'dl-spin', 'dl-rip', 'dl-bat', 'dl-four', 'dl-chase'],
    ['Three-point', 'Swim move', 'Bull rush', 'Sack lunge', 'Spin move', 'Rip', 'Batted ball', 'Four-point', 'Chase'],
  ),
  LB: L(
    ['lb-read', 'lb-tackle', 'lb-blitz', 'lb-drop', 'lb-stack', 'lb-shed', 'lb-pursuit', 'lb-jump', 'lb-wrap'],
    ['Read and react', 'Form tackle', 'Blitz', 'Pass drop', 'Stack', 'Shed a block', 'Pursuit', 'Leap', 'Wrap up'],
  ),
  DB: L(
    ['db-backpedal', 'db-pick', 'db-swat', 'db-press', 'db-breakdown', 'db-turn', 'db-highpick', 'db-return', 'db-jam', 'db-hips'],
    ['Backpedal', 'Diving pick', 'Swat', 'Press', 'Breakdown', 'Turn and run', 'High-point pick', 'Pick-six return', 'Jam', 'Open the hips'],
  ),
};
export const SIGNATURES = L(['sig-praise', 'sig-cold'], ['Signature: Hands up in reverence', 'Signature: Scary Jerry stare']);
// 'sig-crossed' (arms crossed, helmet off) was Brandson's signature; the owner moved it into the generic pool
export const CELEBRATIONS = L(['cel-spike', 'cel-point', 'cel-flex', 'cel-finger', 'cel-leap', 'cel-ref', 'sig-crossed'], ['Spike', 'Point downfield', 'Flex', 'Finger to the sky', 'Lambeau leap', 'Ball to the ref', 'Arms crossed']);

const LABELS = new Map([...Object.values(POSITION_POSES).flat(), ...CELEBRATIONS, ...SIGNATURES].map((p) => [p.key, p.label]));
/** Human-readable pose name (card back, Art lab), e.g. "Rollout throw". */
export const poseLabel = (key: string) => LABELS.get(ALIASES[key] ?? key) ?? key;

/**
 * Stand-in opponents for contact poses: a plain grey player behind the card's player so the action reads.
 *   pose: the opponent's own pose; x: his centre (sprite grid); flip: facing left (toward the player)
 */
export type OpponentKind = 'rusher' | 'blocker' | 'carrier' | 'receiver' | 'defender' | 'chaser' | 'pile';
export interface StandIn {
  pose: string;
  x: number;
  flip: boolean;
  /** Lowered into the pile */
  dy?: number;
}
const OPP: Record<OpponentKind, StandIn[]> = {
  rusher: [{ pose: 'dl-bull', x: 46, flip: true }],
  blocker: [{ pose: 'ol-anchor', x: 44, flip: true }],
  carrier: [{ pose: 'rb-carry', x: 43, flip: true }],
  receiver: [{ pose: 'wr-highpoint', x: 44, flip: true }],
  defender: [{ pose: 'lb-tackle', x: 47, flip: true }],
  chaser: [{ pose: 'lb-blitz', x: 3, flip: false }],
  pile: [
    { pose: 'dl-four', x: 32, flip: true, dy: 3 },
    { pose: 'ol-stance', x: 14, flip: false, dy: 4 },
  ],
};
export const OPPONENT: Record<string, OpponentKind> = {
  'ol-passpro': 'rusher',
  'ol-drive': 'rusher',
  'ol-punch': 'rusher',
  'ol-anchor': 'rusher',
  'te-block': 'rusher',
  'rb-block': 'rusher',
  'dl-swim': 'blocker',
  'dl-spin': 'blocker',
  'dl-bull': 'blocker',
  'dl-rip': 'blocker',
  'lb-shed': 'blocker',
  'lb-tackle': 'carrier',
  'lb-wrap': 'carrier',
  'dl-sack': 'carrier',
  'db-swat': 'receiver',
  'db-press': 'receiver',
  'db-jam': 'receiver',
  'rb-stiffarm': 'defender',
  'rb-juke': 'defender',
  'rb-truck': 'defender',
  'qb-scramble': 'chaser',
  'rb-dive': 'pile',
  'qb-sneak': 'pile',
};
export const standInsFor = (key: string): StandIn[] => {
  const kind = OPPONENT[ALIASES[key] ?? key];
  return kind ? OPP[kind] : [];
};

/** Older pose names still accepted in sprites.json. */
const ALIASES: Record<string, string> = {
  qb: 'qb-windup',
  rb: 'rb-carry',
  heisman: 'rb-stiffarm',
  wr: 'wr-highpoint',
  ol: 'ol-passpro',
  def: 'lb-read',
  // Removed from the pool (read as unnatural): locked old names fall back to a believable pose
  'cel-sky': 'cel-finger',
  'cel-dance': 'cel-point',
  'cel-bump': 'cel-flex',
};

export const isPose = (x: unknown): x is string => typeof x === 'string' && (x in P || x in ALIASES);

/** The pose a player is drawn in: the locked one, else (from his name) a celebration about one time in five, else one of his position's. */
export const poseKeyFor = (name: string, position: string, locked?: string): string => {
  if (locked && isPose(locked)) return ALIASES[locked] ?? locked;
  const seed = seedOf(`${name}|pose`);
  if (seed % 5 === 0) return CELEBRATIONS[(seed >>> 3) % CELEBRATIONS.length].key;
  const list = POSITION_POSES[position] ?? POSITION_POSES.LB;
  return list[(seed >>> 7) % list.length].key;
};

/** Small per-player variations: hands ±1, knees ±1, stride, head up / down. */
export interface Jitter {
  hand: Pt;
  knee: number;
  stride: number;
  tilt: -1 | 0 | 1;
}
export const jitterFor = (name: string): Jitter => {
  const s = seedOf(`${name}|jitter`);
  const pick = (n: number, shift: number) => ((s >>> shift) % n) - Math.floor(n / 2);
  return { hand: [pick(3, 1), pick(3, 4)], knee: pick(3, 7), stride: pick(3, 10), tilt: pick(3, 13) as -1 | 0 | 1 };
};

export const runPose = (key: string, k: Skel, j?: Jitter): PoseOut => {
  const k2 = ALIASES[key] ?? key;
  const out: PoseOut = { look: 'side', lean: 0, crouch: 0, ...(GRIMACE.has(k2) ? { expr: 'grimace' as const } : {}), ...(P[k2] ?? P['lb-read'])(k) };
  if (!j) return out;
  const hand = (a: Arm): Arm => [a[0], a[1], [a[2][0] + j.hand[0], a[2][1] + j.hand[1]]];
  const leg = (l: Leg, s: number): Leg => [l[0], [l[1][0] + j.knee, l[1][1]], [l[2][0] + s, l[2][1]]];
  const handMoved = !out.ball && !out.armsFront;
  if (out.armsFront) return { ...out, frontLeg: leg(out.frontLeg, j.stride), backLeg: leg(out.backLeg, -j.stride) };
  return {
    ...out,
    frontArm: handMoved ? hand(out.frontArm) : out.frontArm,
    backArm: hand(out.backArm),
    frontLeg: leg(out.frontLeg, j.stride),
    backLeg: leg(out.backLeg, -j.stride),
  };
};
