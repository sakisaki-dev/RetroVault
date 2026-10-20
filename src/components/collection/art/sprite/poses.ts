import { seedOf } from '../shared';

/**
 * Retro Bowl sprite poses. Each pose places the elbows, hands, knees and feet on the skeleton (facing right, y down),
 * plus the ball, the head angle and the body: a lean (shear from the hips, in whole sprite pixels), a crouch, and for
 * airborne or diving poses a lift and a rotation round the hips (the head stays upright, so a diver keeps his head
 * up). Poses only move limbs and the body; head and torso sizes come from the build (render.ts), so every pose draws
 * the same body.
 *
 * Every player gets a pose from his position's list (or, about one in five, a celebration any position can roll),
 * picked from his name, plus per-player variation (arm angle, which hand carries the ball, stride, head direction),
 * so two players in the same pose still differ. data/y80/sprites.json can lock one ("pose": a key or its name).
 * Contact poses get grey stand-in opponents (STAND_INS); a few poses mark the turf (a goal line, a sideline).
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
  /** Index finger out on the front hand (pointing, finger to the sky) */
  finger?: boolean;
  /** Toes pointed down (heel up): a foot dragging or pushing off */
  toes?: 'front' | 'back' | 'both';
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
  /** Upper body lean from the hips: sprite pixels the shoulders move (+ forward, − back); the head rides along */
  shear?: number;
  /** Knees bent: the upper body drops this much (feet stay planted) */
  crouch: number;
  /** Airborne: the figure is raised this much */
  lift?: number;
  /** Diving / lunging: degrees clockwise around the hips; the figure is then refit above the turf */
  rotate?: number;
  /** Rotated poses keep the head upright (default); false turns it with the body (a player face down in a pile) */
  headUp?: boolean;
  /** Whole-figure shift in sprite pixels (rotated poses, to keep the dive inside the frame) */
  shiftX?: number;
  /** Bent at the waist: degrees the upper body (torso, arms, head position) turns forward round the hips; the legs
   * stay put, the head stays upright, and a held ball is on the turf (not turned) */
  bend?: number;
}

type Arm = [Pt, Pt, Pt];
type Leg = [Pt, Pt, Pt];
type PoseFn = (k: Skel, v: Jitter) => Partial<PoseOut> & Pick<PoseOut, 'frontArm' | 'backArm' | 'frontLeg' | 'backLeg'>;

// ---------- Limb building blocks ----------
const RAD = Math.PI / 180;
const sh = (k: Skel, front: boolean): Pt => (front ? [k.fs, k.sy + 1] : [k.bs, k.sy + 1]);
const pol = ([x, y]: Pt, deg: number, len: number): Pt => [x + Math.cos(deg * RAD) * len, y + Math.sin(deg * RAD) * len];
const rnd = ([x, y]: Pt): Pt => [Math.round(x), Math.round(y)];
/**
 * Arm by angles, in degrees clockwise from straight ahead: 0 forward, −90 up, 90 down, 180 back. The upper arm and
 * the forearm are both k.A long, so the arm scales with the build.
 */
const arm = (k: Skel, front: boolean, upper: number, fore: number): Arm => {
  const s = sh(k, front);
  const e = pol(s, upper, k.A);
  return [s, rnd(e), rnd(pol(e, fore, k.A))];
};
/** The far arm reaching across to a point in front of the body (its shoulder sits forward, as in profile). */
const reach = (k: Skel, hand: Pt, bend = 2): Arm => {
  const s: Pt = [k.bs + 3, k.sy + 2];
  return [s, [Math.round((s[0] + hand[0]) / 2), Math.round((s[1] + hand[1]) / 2) + bend], hand];
};
/** A point relative to an arm's hand */
const at = (a: Arm, dx: number, dy: number): Pt => [a[2][0] + dx, a[2][1] + dy];
/**
 * For a pose bent at the waist (bend°, crouch c): the pose-space point that lands on a target after the bend, so a
 * hand can be put exactly on a ball on the turf.
 */
const unbend = (k: Skel, c: number, bend: number, [tx, ty]: Pt): Pt => {
  const [px, py] = [k.cx, k.hy + c + 1];
  const r = -bend * RAD;
  return [Math.round(px + (tx - px) * Math.cos(r) - (ty - py) * Math.sin(r)), Math.round(py + (tx - px) * Math.sin(r) + (ty - py) * Math.cos(r) - c)];
};

/** Front arm tucking the ball high and tight */
const tuck = (k: Skel): Arm => [sh(k, true), [k.fs + 1, k.sy + k.A], [k.fs + 5, k.sy + k.A - 1]];
const tuckBall = (k: Skel): Pt => [k.fs + 5, k.sy + k.A - 3];
/** Running arm swings */
const pumpFront = (k: Skel): Arm => [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + 6, k.sy + 1]];
const pumpBack = (k: Skel): Arm => [sh(k, false), [k.bs - k.A + 1, k.sy + 4], [k.bs - k.A - 1, k.sy - 1]];
const swingBack = (k: Skel): Arm => [sh(k, false), [k.bs - 4, k.sy + 3], [k.bs - 6, k.sy + 7]];
/** Arm hanging loose at the side */
const hang = (k: Skel, front: boolean): Arm => {
  const [x, y] = sh(k, front);
  return [[x, y], [x + (front ? 1 : -1), k.sy + k.A], [x + (front ? 2 : -1), k.sy + k.A * 2 - 1]];
};
/** Hands low and forward (ready stance) */
const lowArm = (k: Skel, front: boolean): Arm =>
  front ? [sh(k, true), [k.fs + k.A - 1, k.sy + 5], [k.fs + k.A * 2 - 1, k.sy + 7]] : [[k.bs + 2, k.sy + 2], [k.bs + k.A + 1, k.sy + 7], [k.fs + k.A, k.sy + 9]];
/** Both hands punching out at chest height (blocks), palms */
const punch = (k: Skel, dy = 2, out = 1) => ({
  frontArm: [sh(k, true), [k.fs + k.A - 1, k.sy + 2 + dy], [k.fs + k.A * 2 - 1 + out, k.sy + 2 + dy]] as Arm,
  backArm: [[k.bs + 2, k.sy + 2], [k.bs + k.A + 1, k.sy + 4 + dy], [k.fs + k.A + out, k.sy + 4 + dy]] as Arm,
  palm: true,
  backPalm: true,
});
/** Hand down on the turf (three-point stance) */
const handDown = (k: Skel, c: number): Arm => [sh(k, true), [k.fs + 2, k.sy + k.A], [k.fs + 3, k.G - 2 - c]];
/**
 * Ball carried high and tight. The variation v.swap carries it in the far arm instead (the ball shows at the
 * front of the chest, clear of the number) and the near arm pumps.
 */
const carry = (k: Skel, v: Jitter, back: Arm = pumpBack(k)): { frontArm: Arm; backArm: Arm; ball: Pt } =>
  v.swap ? { frontArm: pumpFront(k), backArm: reach(k, [k.fs + 1, k.sy + k.A - 1], 1), ball: [k.fs + 2, k.sy + k.A - 3] } : { frontArm: tuck(k), backArm: back, ball: tuckBall(k) };

/** A leg from its hip: knee at (dx, dy) from the hip, ankle at dx from the hip on row y. */
const lg = (k: Skel, front: boolean, kx: number, ky: number, ax: number, ay: number = k.G): Leg => {
  const x = front ? k.fh : k.bh;
  return [[x, k.hy], [x + kx, k.hy + ky], [x + ax, ay]];
};
/** Running stride (the game's leg scissor): front foot striking the turf, back leg kicked up behind */
const stride = (k: Skel, s = 1): [Leg, Leg] => [lg(k, true, 5 + s, k.h - 2, 4 + s), lg(k, false, -2, k.h, -9 - s, k.G - 5)];
/** Planted, feet w apart either side */
const plant = (k: Skel, w = 4): [Leg, Leg] => [lg(k, true, w, k.h, w + 2), lg(k, false, -w, k.h, -w - 2)];
/** Standing tall */
const stand = (k: Skel): [Leg, Leg] => [lg(k, true, 1, k.h, 2), lg(k, false, -1, k.h, -2)];
/** Airborne: knees tucked */
const tucked = (k: Skel): [Leg, Leg] => [lg(k, true, 6, 3, 3, k.hy + k.L - 5), lg(k, false, -1, k.h, -4, k.hy + k.L - 2)];
/** Driving: front knee bent under, back leg long */
const drive = (k: Skel): [Leg, Leg] => [lg(k, true, 6, k.h - 2, 5), lg(k, false, -4, k.h, -11)];
/** Diving / lying: legs trailing straight down the body axis, the back knee bent */
const trail = (k: Skel): [Leg, Leg] => [lg(k, true, 0, k.h, -1, k.hy + k.L), lg(k, false, 3, k.h, -3, k.hy + k.L - 3)];
const legs = ([frontLeg, backLeg]: [Leg, Leg]) => ({ frontLeg, backLeg });

const P: Record<string, PoseFn> = {
  // ---------- Quarterbacks ----------
  'qb-windup': (k) => {
    const backArm = arm(k, false, -160, -105);
    return { frontArm: arm(k, true, -5, -15), backArm, ...legs(plant(k, 4)), ball: at(backArm, -1, -4), shear: -1 };
  },
  'qb-follow': (k) => ({
    backArm: [[k.bs + 3, k.sy + 2], [k.cx + 4, k.sy + 5], [k.fs + 4, k.sy + 9]],
    frontArm: arm(k, true, 110, 160),
    frontLeg: lg(k, true, 5, k.h, 7),
    backLeg: lg(k, false, -3, k.h, -9, k.G - 2),
    toes: 'back',
    shear: 2,
    crouch: 1,
  }),
  'qb-rollout': (k) => {
    const backArm = arm(k, false, -150, -95);
    return { frontArm: arm(k, true, 20, -60), backArm, ...legs(stride(k)), ball: at(backArm, 0, -4), shear: 1 };
  },
  'qb-point': (k) => ({
    look: 'tq',
    frontArm: arm(k, true, -45, -80),
    backArm: [sh(k, false), [k.bs + 1, k.sy + k.A], [k.cx, k.sy + k.A + 2]],
    ...legs(stand(k)),
    ball: [k.cx + 3, k.sy + k.A + 4],
    palm: true,
    expr: 'open',
  }),
  'qb-scramble': (k) => {
    const frontArm = arm(k, true, 60, -60);
    return { frontArm, backArm: pumpBack(k), ...legs(stride(k, 2)), ball: at(frontArm, 1, -2), shear: 1 };
  },
  'qb-sidearm': (k) => {
    const backArm = arm(k, false, 170, 190);
    return { frontArm: arm(k, true, -20, 10), backArm, ...legs(plant(k, 5)), ball: at(backArm, -2, -1), shear: -1, crouch: 2 };
  },
  'qb-slide': (k) => ({
    // Feet-first slide to end the run: sitting back at 45° on the turf, lead leg out flat along it, the other knee
    // bent up, ball tucked (the legs are set 45° forward so they lie flat once the body tips back)
    frontArm: tuck(k),
    backArm: arm(k, false, 150, 100),
    frontLeg: [[k.fh, k.hy], [k.fh + 6, k.hy + 6], [k.fh + 12, k.hy + 12]],
    backLeg: [[k.bh, k.hy], [k.bh + 9, k.hy + 1], [k.bh + 8, k.hy + 9]],
    ball: tuckBall(k),
    toes: 'front',
    rotate: -45,
    lift: -2,
    shiftX: 2,
  }),
  'qb-dropback': (k) => {
    const frontArm = arm(k, true, 80, -40);
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), frontLeg: lg(k, true, 3, k.h, 4), backLeg: lg(k, false, -5, k.h, -10), ball: at(frontArm, 1, -2), toes: 'front', shear: -1 };
  },
  'qb-jump': (k) => {
    const backArm = arm(k, false, -110, -70);
    return { frontArm: arm(k, true, 0, -20), backArm, ...legs(tucked(k)), ball: at(backArm, 0, -4), lift: 7 };
  },
  // ---------- Running backs ----------
  'rb-stiffarm': (k) => ({
    frontArm: arm(k, true, -8, -8),
    backArm: reach(k, [k.fs + 1, k.sy + 6], 1),
    frontLeg: lg(k, true, 7, 4, 3, k.hy + k.L - 5),
    backLeg: lg(k, false, -2, k.h, -4),
    ball: [k.fs + 2, k.sy + 4],
    palm: true,
    shear: 1,
  }),
  'rb-hurdle': (k, v) => ({
    ...carry(k, v, [sh(k, false), [k.bs - 3, k.sy - 2], [k.bs - 5, k.sy - k.A]]),
    frontLeg: lg(k, true, 6, 2, 12, k.hy + 3),
    backLeg: lg(k, false, -2, 6, -8, k.hy + 4),
    lift: 9,
    shear: 1,
  }),
  'rb-pylon': (k) => {
    // Airborne for the corner of the end zone: stretched out flat, the ball reached out in the outside hand past the
    // pylon, the far arm swept back, legs trailing with one knee bent
    const frontArm: Arm = [sh(k, true), [k.fs + 1, k.sy - k.A + 1], [k.fs + 1, k.sy - k.A * 2 + 1]];
    return { frontArm, backArm: arm(k, false, 100, 95), ...legs(trail(k)), ball: at(frontArm, 0, -6), toes: 'both', rotate: 80, lift: 8, shiftX: -2 };
  },
  'rb-escape': (k) => ({
    // High-stepping out of a diving tackle at the ankles: front knee up, back foot kicking free, ball tucked outside
    frontArm: tuck(k),
    backArm: pumpBack(k),
    frontLeg: lg(k, true, 7, 2, 6, k.hy + k.L - 6),
    backLeg: lg(k, false, -4, k.h - 1, -9, k.G - 4),
    ball: tuckBall(k),
    toes: 'back',
    shear: 1,
    lift: 2,
  }),
  'rb-drag': (k) => ({
    // Carrying a tackler: driving forward bent low, a grey defender hanging on round his waist from behind
    frontArm: tuck(k),
    backArm: reach(k, [k.fs + 3, k.sy + 3]),
    ...legs(drive(k)),
    ball: tuckBall(k),
    toes: 'back',
    shear: 4,
    crouch: 3,
  }),
  'rb-carry': (k, v) => ({ ...carry(k, v), ...legs(stride(k)), shear: 2, crouch: 2 }),
  'rb-truck': (k, v) => ({
    ...(v.swap ? carry(k, v) : { frontArm: tuck(k), backArm: reach(k, [k.fs + 3, k.sy + 1]), ball: tuckBall(k) }),
    ...legs(drive(k)),
    toes: 'back',
    shear: 3,
    crouch: 4,
  }),
  'rb-catch': (k) => {
    // Both hands up for the ball: the near hand in front of it, the far hand (darker) just behind and below
    const frontArm = arm(k, true, -35, -55);
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(stride(k)), ball: at(frontArm, -1, -4), look: 'up' };
  },
  'rb-block': (k) => ({ ...punch(k, 1), ...legs(plant(k, 5)), shear: 1, crouch: 4 }),
  'rb-cutback': (k, v) => ({
    ...carry(k, v, [sh(k, false), [k.bs - 3, k.sy - 1], [k.bs - 6, k.sy - 3]]),
    frontLeg: lg(k, true, 4, k.h, 8),
    backLeg: lg(k, false, -2, k.h, -3, k.G - 1),
    toes: 'back',
    shear: -2,
    crouch: 3,
  }),
  'rb-secure': (k) => ({
    // Two hands on the ball: the near hand over its nose, the far hand cupping it from below
    frontArm: [sh(k, true), [k.fs + 2, k.sy + k.A], [k.fs + 5, k.sy + 2]],
    backArm: reach(k, [k.fs + 1, k.sy + 7], 1),
    ...legs(drive(k)),
    ball: [k.fs + 2, k.sy + 4],
    toes: 'back',
    shear: 2,
    crouch: 3,
  }),
  // ---------- Receivers ----------
  'wr-highpoint': (k) => {
    const frontArm = arm(k, true, -60, -75);
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(tucked(k)), ball: at(frontArm, 0, -4), look: 'up', lift: 3 };
  },
  'wr-onehand': (k) => {
    const frontArm = arm(k, true, -50, -40);
    return { frontArm, backArm: arm(k, false, 160, 120), ...legs(tucked(k)), ball: at(frontArm, 2, -3), look: 'up', lift: 4, shear: 1 };
  },
  'wr-cut': (k) => ({ frontArm: pumpFront(k), backArm: swingBack(k), frontLeg: lg(k, true, 7, k.h - 1, 9), backLeg: lg(k, false, -4, k.h, -9, k.G - 1), toes: 'back', shear: 2, crouch: 3 }),
  'wr-toetap': (k) => {
    // Both hands securing the ball up front at eye level, leaning back over the sideline, toes dragging on it
    const ball: Pt = [k.fs + 11, k.sy - 7];
    return {
      frontArm: [sh(k, true), [k.fs + 5, k.sy - 1], [ball[0] - 2, ball[1] + 3]],
      backArm: reach(k, [ball[0] - 4, ball[1] - 1], 0),
      frontLeg: lg(k, true, 5, k.h - 1, 8),
      backLeg: lg(k, false, 6, k.h, 9),
      ball,
      toes: 'both',
      shear: -5,
    };
  },
  'wr-slant': (k) => {
    const frontArm = arm(k, true, 0, -10);
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(stride(k)), ball: at(frontArm, 3, -1), shear: 1 };
  },
  'wr-fade': (k) => {
    const frontArm = arm(k, true, -55, -85);
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(stride(k, 2)), ball: at(frontArm, -1, -4), look: 'up', shear: -1 };
  },
  'wr-score': (k) => {
    const frontArm = arm(k, true, -70, -90);
    return { frontArm, backArm: pumpBack(k), ...legs(stride(k, 2)), ball: at(frontArm, 1, -3), shear: 1, expr: 'open' };
  },
  'wr-stutter': (k) => ({ frontArm: [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + 4, k.sy + 1]], backArm: [sh(k, false), [k.bs - 2, k.sy + 4], [k.bs - 2, k.sy + 1]], ...legs(plant(k, 2)), shear: 1, crouch: 3 }),
  'wr-yac': (k, v) => ({ ...carry(k, v, [sh(k, false), [k.bs - 4, k.sy + 1], [k.bs - 8, k.sy + 1]]), ...legs(stride(k, 2)), backPalm: !v.swap, shear: 2, crouch: 1 }),
  'wr-dive': (k) => {
    const frontArm: Arm = [sh(k, true), [k.fs + 1, k.sy - k.A + 1], [k.fs + 2, k.sy - k.A * 2 + 1]];
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(trail(k)), ball: at(frontArm, 1, -4), toes: 'both', look: 'up', rotate: 80, lift: 2, shiftX: -2 };
  },
  'wr-stalk': (k) => ({ ...punch(k, 0, 0), ...legs(plant(k, 4)), shear: 1, crouch: 3 }),
  // ---------- Tight ends ----------
  'te-traffic': (k) => {
    const frontArm = arm(k, true, -20, -60);
    return { look: 'up', frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(plant(k, 5)), ball: at(frontArm, 0, -4), crouch: 2 };
  },
  'te-block': (k) => ({ ...punch(k, 1), ...legs(plant(k, 5)), shear: 2, crouch: 3 }),
  'te-seam': (k) => {
    const frontArm = arm(k, true, -40, -70);
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(stride(k, 2)), ball: at(frontArm, 0, -4), look: 'up', shear: 1 };
  },
  'te-chip': (k) => ({ frontArm: [sh(k, true), [k.fs + k.A - 1, k.sy + 4], [k.fs + k.A * 2 + 1, k.sy + 3]], backArm: swingBack(k), ...legs(stride(k)), palm: true, shear: 3, crouch: 2 }),
  'te-rumble': (k, v) => ({ ...carry(k, v, reach(k, [k.fs + 3, k.sy + 3])), ...legs(drive(k)), toes: 'back', shear: 3, crouch: 3 }),
  'te-leak': (k) => ({ look: 'tq', frontArm: arm(k, true, 40, -70), backArm: reach(k, [k.fs + 2, k.sy - 1]), ...legs(stride(k)), palm: true, backPalm: true, expr: 'open' }),
  'te-drag': (k, v) => ({ ...carry(k, v, reach(k, [k.fs + 3, k.sy + 3])), ...legs(drive(k)), toes: 'back', shear: 4, crouch: 4 }),
  // ---------- Offensive line ----------
  'ol-passpro': (k) => ({ ...punch(k, 2, 1), palm: false, backPalm: false, ...legs(plant(k, 5)), shear: -1, crouch: 3 }),
  'ol-drive': (k) => ({ ...punch(k, -1, 2), ...legs(drive(k)), toes: 'back', shear: 3, crouch: 4 }),
  'ol-pull': (k) => ({ frontArm: pumpFront(k), backArm: [sh(k, false), [k.bs - 3, k.sy + 4], [k.bs - 6, k.sy + 2]], ...legs(stride(k)), look: 'tq', shear: 1, crouch: 2 }),
  'ol-anchor': (k) => ({ ...punch(k, 0, 1), ...legs(plant(k, 6)), shear: -2, crouch: 4 }),
  'ol-punch': (k) => ({ ...punch(k, 1, 3), ...legs(plant(k, 4)), shear: 1, crouch: 3 }),
  'ol-reach': (k) => ({
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 2], [k.fs + 9, k.sy + 3]],
    backArm: [sh(k, false), [k.bs - 3, k.sy + 3], [k.bs - 5, k.sy + 6]],
    frontLeg: lg(k, true, 7, k.h, 9),
    backLeg: lg(k, false, -1, k.h, -2),
    palm: true,
    shear: 2,
    crouch: 3,
  }),
  'ol-pancake': (k) => ({
    frontArm: [sh(k, true), [k.fs + k.A - 1, k.sy + 4], [k.fs + k.A * 2, k.sy + 8]],
    backArm: reach(k, [k.fs + k.A + 3, k.sy + 9]),
    ...legs(drive(k)),
    palm: true,
    backPalm: true,
    toes: 'back',
    shear: 5,
    crouch: 4,
  }),
  'ol-kick': (k) => ({
    frontArm: arm(k, true, 80, -60),
    backArm: reach(k, [k.fs + 2, k.sy + 4]),
    frontLeg: lg(k, true, 3, k.h, 3),
    backLeg: lg(k, false, -6, k.h, -10),
    palm: true,
    backPalm: true,
    shear: -1,
    crouch: 4,
  }),
  'ol-snap': (k) => {
    // Center over the ball: bent at the waist with a flat back, knees bent on a wide base, the ball on the turf in
    // front of him with both hands on it, head up looking forward (three-quarter)
    const c = 3;
    const bend = 60;
    const ball: Pt = [k.cx + 10, k.G - 1];
    const fHand = unbend(k, c, bend, [ball[0] + 2, ball[1] - 2]);
    const bHand = unbend(k, c, bend, [ball[0] - 3, ball[1] - 2]);
    const s = sh(k, true);
    return {
      look: 'tq',
      frontArm: [s, [Math.round((s[0] + fHand[0]) / 2) + 2, Math.round((s[1] + fHand[1]) / 2)], fHand],
      backArm: reach(k, bHand, 0),
      ...legs(plant(k, 8)),
      ball: [ball[0], ball[1] - c],
      crouch: c,
      bend,
    };
  },
  // ---------- Defensive line ----------
  'dl-swim': (k) => ({
    backArm: [[k.bs + 2, k.sy + 1], [k.cx + 3, k.sy - 6], [k.fs + 6, k.sy - 8]],
    frontArm: [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + 7, k.sy + 7]],
    ...legs(stride(k)),
    palm: true,
    backPalm: true,
    shear: 2,
    crouch: 2,
  }),
  'dl-bull': (k) => ({ ...punch(k, -1, 2), ...legs(drive(k)), toes: 'back', shear: 4, crouch: 5 }),
  'dl-sack': (k) => ({
    frontArm: [sh(k, true), [k.fs + 5, k.sy + 1], [k.fs + 10, k.sy - 1]],
    backArm: reach(k, [k.fs + 8, k.sy - 3]),
    frontLeg: lg(k, true, 5, k.h, 3, k.hy + k.L - 2),
    backLeg: lg(k, false, -4, k.h, -9, k.hy + k.L - 2),
    palm: true,
    backPalm: true,
    toes: 'back',
    rotate: 30,
    shiftX: -1,
  }),
  'dl-spin': (k) => ({
    look: 'tq',
    frontArm: [sh(k, true), [k.fs - 1, k.sy + k.A - 1], [k.fs + 3, k.sy + k.A]],
    backArm: arm(k, false, 185, 205),
    frontLeg: lg(k, true, 2, k.h, 1),
    backLeg: lg(k, false, -6, k.h - 2, -9, k.hy + k.L - 4),
    shear: -1,
    crouch: 2,
  }),
  'dl-rip': (k) => ({
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 3], [k.fs + 7, k.sy + 6]],
    backArm: reach(k, [k.fs + 4, k.sy - 4]),
    ...legs(drive(k)),
    toes: 'back',
    shear: 3,
    crouch: 3,
  }),
  'dl-bat': (k) => ({ frontArm: arm(k, true, -80, -88), backArm: arm(k, false, -95, -85), ...legs(tucked(k)), ball: [k.fs + 1, k.sy - k.A * 2 - 4], palm: true, backPalm: true, look: 'up', lift: 5 }),
  'dl-chase': (k) => ({ frontArm: pumpFront(k), backArm: swingBack(k), ...legs(stride(k, 2)), shear: 2, crouch: 1 }),
  'dl-club': (k) => ({ frontArm: arm(k, true, -30, 40), backArm: pumpBack(k), ...legs(stride(k)), palm: true, toes: 'back', shear: 2, crouch: 2 }),
  'dl-strip': (k) => ({ frontArm: arm(k, true, -40, 50), backArm: reach(k, [k.fs + 5, k.sy + 2]), ...legs(drive(k)), palm: true, backPalm: true, toes: 'back', shear: 3, crouch: 2 }),
  // ---------- Linebackers ----------
  'lb-read': (k) => ({
    // Ready to react: near hand out in front, far hand low on the near thigh, knees bent wide
    look: 'tq',
    frontArm: [sh(k, true), [k.fs + k.A - 1, k.sy + 4], [k.fs + k.A * 2 - 2, k.sy + 4]],
    backArm: reach(k, [k.fs + 2, k.sy + 11], 1),
    frontLeg: lg(k, true, 6, k.h - 1, 6),
    backLeg: lg(k, false, -6, k.h - 1, -7),
    shear: 1,
    crouch: 4,
  }),
  'lb-tackle': (k) => ({
    frontArm: [sh(k, true), [k.fs + 5, k.sy + 2], [k.fs + 8, k.sy + 6]],
    backArm: reach(k, [k.fs + 7, k.sy + 7]),
    ...legs(drive(k)),
    toes: 'back',
    shear: 3,
    crouch: 5,
  }),
  'lb-blitz': (k) => ({ frontArm: pumpFront(k), backArm: swingBack(k), frontLeg: lg(k, true, 7, 2, 7, k.hy + k.L - 5), backLeg: lg(k, false, -4, k.h + 1, -10), toes: 'back', shear: 2, crouch: 1 }),
  'lb-drop': (k) => ({ look: 'tq', frontArm: arm(k, true, 70, -30), backArm: arm(k, false, 120, 60), frontLeg: lg(k, true, 3, k.h, 3), backLeg: lg(k, false, -5, k.h, -9), toes: 'front', shear: -1, crouch: 2 }),
  'lb-stack': (k) => ({ look: 'tq', frontArm: hang(k, true), backArm: [sh(k, false), [k.bs + 1, k.sy + k.A - 1], [k.bs + 4, k.sy + k.A + 3]], ...legs(plant(k, 4)), shear: 1, crouch: 3 }),
  'lb-shed': (k) => ({ frontArm: [sh(k, true), [k.fs + k.A - 1, k.sy + 2], [k.fs + k.A * 2 + 2, k.sy + 2]], backArm: [sh(k, false), [k.bs - 3, k.sy + 2], [k.bs - 6, k.sy + 4]], ...legs(drive(k)), palm: true, shear: 2, crouch: 3 }),
  'lb-pursuit': (k) => ({ frontArm: pumpFront(k), backArm: pumpBack(k), ...legs(stride(k, 2)), shear: 2 }),
  'lb-jump': (k) => ({ frontArm: arm(k, true, -75, -85), backArm: arm(k, false, -100, -80), ...legs(tucked(k)), palm: true, backPalm: true, look: 'up', lift: 6 }),
  'lb-wrap': (k) => ({
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 1], [k.fs + 6, k.sy + 5]],
    backArm: reach(k, [k.fs + 5, k.sy + 6]),
    ...legs(plant(k, 4)),
    shear: 2,
    crouch: 2,
  }),
  'lb-fill': (k) => ({ frontArm: arm(k, true, 60, -70), backArm: reach(k, [k.fs + 1, k.sy + 3]), ...legs(drive(k)), shear: 2, crouch: 4 }),
  'lb-hit': (k) => ({
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 4], [k.fs + 8, k.sy + 3]],
    backArm: reach(k, [k.fs + 6, k.sy + 6]),
    frontLeg: lg(k, true, 6, k.h - 2, 4),
    backLeg: lg(k, false, -5, k.h - 1, -13, k.G - 1),
    toes: 'back',
    shear: 5,
    crouch: 5,
  }),
  // ---------- Defensive backs ----------
  'db-backpedal': (k) => ({ frontArm: arm(k, true, 70, 80), backArm: arm(k, false, 110, 95), frontLeg: lg(k, true, 3, k.h, 2), backLeg: lg(k, false, -3, k.h, -6), toes: 'front', shear: 1, crouch: 4 }),
  'db-pick': (k) => {
    const frontArm: Arm = [sh(k, true), [k.fs + 1, k.sy - k.A + 1], [k.fs + 2, k.sy - k.A * 2 + 1]];
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(trail(k)), ball: at(frontArm, 1, -4), toes: 'both', look: 'up', rotate: 62, lift: 4, shiftX: -2 };
  },
  'db-swat': (k) => ({ frontArm: arm(k, true, -60, -50), backArm: swingBack(k), ...legs(tucked(k)), ball: [k.fs + 11, k.sy - k.A * 2 - 2], palm: true, look: 'up', lift: 5 }),
  'db-press': (k) => ({ ...punch(k, 2, 0), ...legs(plant(k, 5)), shear: 2, crouch: 4 }),
  'db-breakdown': (k) => ({ look: 'tq', frontArm: arm(k, true, 45, 50), backArm: arm(k, false, 135, 130), ...legs(plant(k, 6)), palm: true, backPalm: true, shear: 1, crouch: 5 }),
  'db-turn': (k) => ({ frontArm: pumpFront(k), backArm: pumpBack(k), ...legs(stride(k, 2)), look: 'up', shear: 1 }),
  'db-highpick': (k) => {
    const frontArm = arm(k, true, -70, -80);
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(tucked(k)), ball: at(frontArm, 0, -4), look: 'up', lift: 4 };
  },
  'db-return': (k, v) => ({ ...carry(k, v), ...legs(stride(k, 2)), shear: 2, crouch: 1 }),
  'db-jam': (k) => ({ frontArm: [sh(k, true), [k.fs + k.A - 1, k.sy + 3], [k.fs + k.A * 2 + 1, k.sy + 3]], backArm: swingBack(k), ...legs(plant(k, 4)), palm: true, shear: 2, crouch: 3 }),
  'db-hips': (k) => ({
    frontArm: hang(k, true),
    backArm: [sh(k, false), [k.bs - 3, k.sy + 3], [k.bs - 4, k.sy + 7]],
    frontLeg: lg(k, true, 2, k.h, -1),
    backLeg: lg(k, false, -6, k.h - 1, -8),
    look: 'tq',
    shear: -1,
    crouch: 4,
  }),
  'db-breakup': (k) => {
    const frontArm = arm(k, true, -35, -30);
    return { frontArm, backArm: swingBack(k), ...legs(stride(k)), ball: at(frontArm, 3, -3), palm: true, look: 'up', shear: 1 };
  },
  'db-punch': (k) => ({
    frontArm: [sh(k, true), [k.fs + 4, k.sy + 4], [k.fs + 9, k.sy + 4]],
    backArm: reach(k, [k.fs + 4, k.sy + 6]),
    ...legs(drive(k)),
    ball: [k.fs + 13, k.sy + 2],
    toes: 'back',
    shear: 2,
    crouch: 3,
  }),
  // ---------- Signature poses (owner-requested, locked in sprites.json) ----------
  'sig-crossed': (k) => ({
    // Arms crossed over the chest, both in front of the torso; helmet at his feet; stern; dreads blown back
    // Forearms cross at mid-chest, below the chin and beard (faces.ts: the bare face ends on the shoulder line)
    frontArm: [sh(k, true), [k.fs + 1, k.sy + k.A + 1], [k.bs + 3, k.sy + k.A]],
    backArm: [sh(k, false), [k.bs - 1, k.sy + k.A + 2], [k.fs - 1, k.sy + k.A + 1]],
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
  // Brandson's "Golden hour": drawn as a head-and-shoulders portrait (faces.ts goldenHourPortrait, PORTRAIT_POSES);
  // this body is only the fallback where a full figure is needed
  'sig-golden': (k, v) => ({ ...P['sig-crossed'](k, v), expr: 'exalted' }),
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
  'cel-point': (k) => ({
    // First-down point: arm straight out toward the far end zone, ball at his side
    look: 'tq',
    frontArm: arm(k, true, -12, -12),
    backArm: [sh(k, false), [k.bs - 1, k.sy + k.A], [k.bs - 1, k.sy + k.A * 2 - 2]],
    ...legs(plant(k, 3)),
    ball: [k.bs - 1, k.sy + k.A * 2 - 3],
    finger: true,
    expr: 'open',
  }),
  'cel-finger': (k) => ({ frontArm: arm(k, true, -85, -92), backArm: hang(k, false), ...legs(stand(k)), finger: true, look: 'up' }),
  'cel-ref': (k) => {
    const frontArm = arm(k, true, 50, 0);
    return { look: 'tq', frontArm, backArm: hang(k, false), ...legs(stand(k)), ball: at(frontArm, 2, -2), expr: 'smile' };
  },
  'cel-spike': (k) => ({
    frontArm: [sh(k, true), [k.fs + 3, k.sy + 4], [k.fs + 4, k.sy + k.A * 2]],
    backArm: arm(k, false, -150, -120),
    ...legs(plant(k, 4)),
    ball: [k.fs + 6, k.G - 3],
    expr: 'open',
    shear: 2,
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
    // Head sits down on the shoulders (shrugged into the flex), so only a pixel or two of neck shows
    nod: 2,
  }),
  'cel-heisman': (k) => ({
    // The Heisman: stiff-arm out, ball tucked, front knee raised high, standing on the back leg
    frontArm: arm(k, true, -6, -6),
    backArm: reach(k, [k.fs + 1, k.sy + 6], 1),
    frontLeg: lg(k, true, 7, 1, 6, k.hy + k.h + 1),
    backLeg: lg(k, false, 0, k.h, -1),
    ball: [k.fs + 2, k.sy + 4],
    palm: true,
    expr: 'stern',
  }),
  'cel-salute': (k) => ({
    // Hand snapped to the helmet brow, standing tall, facing out
    frontArm: [sh(k, true), [k.fs + 4, k.sy - 4], [k.cx + 3, k.sy - 10]],
    backArm: hang(k, false),
    ...legs(stand(k)),
    palm: true,
    look: 'front',
    expr: 'stern',
  }),
  // ---------- Stand-in opponents only (never rolled) ----------
  // Upright and built on the same frame as every card player: arms at chest height, legs at full length, no hunch or
  // lean, the head turned three-quarter so his facemask shows past the card's player
  /** Pass rusher engaging a blocker */
  'x-rush': (k) => ({ ...punch(k, 0, 1), ...legs(stride(k)), look: 'tq' }),
  /** Blocker with his hands on the rusher's chest */
  'x-block': (k) => ({ ...punch(k, 1, 0), ...legs(plant(k, 4)), look: 'tq' }),
  /** Ball carrier running at the tackler */
  'x-carrier': (k) => ({ frontArm: tuck(k), backArm: pumpBack(k), ball: tuckBall(k), ...legs(stride(k)), look: 'tq' }),
  /** Defender reaching for the runner at chest height */
  'x-tackler': (k) => ({ frontArm: arm(k, true, 10, 0), backArm: reach(k, [k.fs + 9, k.sy + 4]), ...legs(stride(k)), look: 'tq' }),
  /** Receiver reaching up for the ball */
  'x-catch': (k) => {
    const frontArm = arm(k, true, -60, -75);
    return { frontArm, backArm: reach(k, at(frontArm, 2, -5)), ...legs(stand(k)), look: 'tq' };
  },
  /** Receiver set at the line */
  'x-set': (k) => ({ frontArm: arm(k, true, 60, -40), backArm: reach(k, [k.fs + 3, k.sy + 4]), ...legs(plant(k, 3)), look: 'tq' }),
  /** Hanging on round a runner's waist from behind, feet dragging */
  'x-hang': (k) => ({ frontArm: arm(k, true, 30, 10), backArm: reach(k, [k.fs + 8, k.sy + 8]), frontLeg: lg(k, true, 3, k.h, 4), backLeg: lg(k, false, -4, k.h, -8), toes: 'both', shear: 1, look: 'tq' }),
  /** Quarterback with the ball cocked */
  'x-qb': (k) => {
    const backArm = arm(k, false, -160, -105);
    return { frontArm: arm(k, true, -5, -15), backArm, ...legs(plant(k, 3)), ball: at(backArm, -1, -4), look: 'tq' };
  },
  /** Knocked onto his back */
  'x-fall': (k) => ({ frontArm: arm(k, true, -60, -100), backArm: arm(k, false, -120, -150), frontLeg: lg(k, true, 6, 4, 10, k.hy + 8), backLeg: lg(k, false, 4, k.h, 6), rotate: -35, lift: 0 }),
  /** Diving at a runner's legs and missing */
  'x-lunge': (k) => ({ frontArm: arm(k, true, -60, -40), backArm: reach(k, [k.fs + 5, k.sy - 6]), ...legs(trail(k)), rotate: 70, lift: -1 }),
  /** A ball carrier without the ball showing (the card's player is going after it) */
  'x-runner': (k) => ({ frontArm: pumpFront(k), backArm: pumpBack(k), ...legs(stride(k)), look: 'tq' }),
};

/** Contact poses grimace. */
const GRIMACE = new Set([
  'dl-bull', 'dl-sack', 'dl-rip', 'dl-club', 'dl-strip', 'lb-tackle', 'lb-shed', 'lb-hit', 'rb-truck', 'rb-stiffarm', 'rb-secure', 'ol-drive',
  'ol-punch', 'ol-pancake', 'te-block', 'te-drag', 'db-jam', 'db-punch', 'rb-drag', 'rb-escape', 'wr-stalk',
]);
/** Poses that read the same with the head in profile or three-quarter (the variation can turn it). */
const HEAD_TURN = new Set(['qb-dropback', 'wr-stutter', 'ol-kick', 'lb-read', 'lb-stack', 'lb-fill', 'db-backpedal', 'db-breakdown', 'cel-ref', 'cel-point', 'rb-block']);

type Entry = [key: string, name: string];
const L = (rows: Entry[]) => rows.map(([key, label]) => ({ key, label }));

/** Poses per position (and the celebrations anyone can roll), with their names (card back, Art lab, sprites.json). */
export const POSITION_POSES: Record<string, { key: string; label: string }[]> = {
  QB: L([
    ['qb-windup', 'Windup'],
    ['qb-follow', 'Follow-through'],
    ['qb-rollout', 'Rollout throw'],
    ['qb-point', 'Audible at the line'],
    ['qb-scramble', 'Scramble'],
    ['qb-sidearm', 'Sidearm throw'],
    ['qb-slide', 'Feet-first slide'],
    ['qb-dropback', 'Dropback'],
    ['qb-jump', 'Jump pass'],
  ]),
  RB: L([
    ['rb-stiffarm', 'Stiff-arm'],
    ['rb-hurdle', 'Hurdle'],
    ['rb-pylon', 'Reaching for the pylon'],
    ['rb-escape', 'Ankle-tackle escape'],
    ['rb-carry', 'Carry'],
    ['rb-truck', 'Truck stick'],
    ['rb-drag', 'Carrying a tackler'],
    ['rb-catch', 'Catch out of the backfield'],
    ['rb-block', 'Pass block'],
    ['rb-cutback', 'Cutback'],
    ['rb-secure', 'Two hands on the ball'],
  ]),
  WR: L([
    ['wr-highpoint', 'High-point catch'],
    ['wr-onehand', 'One-handed catch'],
    ['wr-cut', 'Route cut'],
    ['wr-toetap', 'Sideline toe-tap'],
    ['wr-slant', 'Slant catch'],
    ['wr-fade', 'Fade catch'],
    ['wr-score', 'Ball raised, scoring'],
    ['wr-stutter', 'Stutter-go'],
    ['wr-yac', 'Yards after catch'],
    ['wr-dive', 'Diving catch'],
    ['wr-stalk', 'Stalk block'],
  ]),
  TE: L([
    ['te-traffic', 'Catch in traffic'],
    ['te-block', 'Run block'],
    ['te-seam', 'Seam catch'],
    ['te-chip', 'Chip and release'],
    ['te-rumble', 'Rumble'],
    ['wr-highpoint', 'High-point catch'],
    ['rb-stiffarm', 'Stiff-arm'],
    ['te-leak', 'Leak out'],
    ['te-drag', 'Dragging a tackler'],
  ]),
  OL: L([
    ['ol-passpro', 'Pass pro'],
    ['ol-drive', 'Drive block'],
    ['ol-pull', 'Pull'],
    ['ol-anchor', 'Anchor'],
    ['ol-punch', 'Punch'],
    ['ol-reach', 'Reach block'],
    ['ol-pancake', 'Pancake block'],
    ['ol-kick', 'Kick slide'],
    ['ol-snap', 'Snap'],
  ]),
  DL: L([
    ['dl-swim', 'Swim move'],
    ['dl-bull', 'Bull rush'],
    ['dl-sack', 'Sack'],
    ['dl-spin', 'Spin move'],
    ['dl-rip', 'Rip move'],
    ['dl-bat', 'Batted ball'],
    ['dl-chase', 'Chase'],
    ['dl-club', 'Club move'],
    ['dl-strip', 'Strip sack'],
  ]),
  LB: L([
    ['lb-read', 'Read and react'],
    ['lb-tackle', 'Form tackle'],
    ['lb-blitz', 'Blitz'],
    ['lb-drop', 'Pass drop'],
    ['lb-stack', 'Stack'],
    ['lb-shed', 'Shed a block'],
    ['lb-pursuit', 'Pursuit'],
    ['lb-jump', 'Leap'],
    ['lb-wrap', 'Wrap up'],
    ['lb-fill', 'Fill the gap'],
    ['lb-hit', 'Hit stick'],
  ]),
  DB: L([
    ['db-backpedal', 'Backpedal'],
    ['db-pick', 'Diving pick'],
    ['db-swat', 'Swat'],
    ['db-press', 'Press'],
    ['db-breakdown', 'Breakdown'],
    ['db-turn', 'Turn and run'],
    ['db-highpick', 'High-point pick'],
    ['db-return', 'Pick-six return'],
    ['db-jam', 'Jam'],
    ['db-hips', 'Open the hips'],
    ['db-breakup', 'Pass breakup'],
    ['db-punch', 'Punch out'],
  ]),
};
export const SIGNATURES = L([
  ['sig-praise', 'Signature: Hands up in reverence'],
  ['sig-cold', 'Signature: Scary Jerry stare'],
  ['sig-golden', 'Signature: Golden hour'],
]);
// 'sig-crossed' (arms crossed, helmet off) was Brandson's signature; the owner moved it into the generic pool
export const CELEBRATIONS = L([
  ['cel-spike', 'Spike'],
  ['cel-point', 'Point downfield'],
  ['cel-flex', 'Flex'],
  ['cel-finger', 'Finger to the sky'],
  ['cel-ref', 'Ball to the ref'],
  ['sig-crossed', 'Arms crossed'],
  ['cel-heisman', 'Heisman pose'],
  ['cel-salute', 'Salute'],
]);

/** Older pose names still accepted in sprites.json. */
const ALIASES: Record<string, string> = {
  qb: 'qb-windup',
  rb: 'rb-carry',
  heisman: 'cel-heisman',
  wr: 'wr-highpoint',
  ol: 'ol-passpro',
  def: 'lb-read',
  // Removed from the pool: locked old names fall back to a believable pose
  'cel-sky': 'cel-finger',
  'cel-dance': 'cel-point',
  'cel-bump': 'cel-flex',
  // Removed at the owner's request (stances, and poses that didn't read): old locks fall back to an action pose
  'qb-handoff': 'qb-windup',
  'qb-pump': 'qb-windup',
  'qb-shotgun': 'qb-windup',
  'rb-breakaway': 'rb-carry',
  'wr-stance': 'wr-highpoint',
  'te-stance': 'te-seam',
  'ol-stance': 'ol-passpro',
  'ol-ready': 'ol-passpro',
  'dl-three': 'dl-bull',
  'dl-four': 'dl-bull',
  // Replaced at the owner's request (new poses designed from scratch)
  'rb-dive': 'rb-pylon',
  'rb-juke': 'rb-escape',
  'rb-spin': 'rb-cutback',
  'qb-sneak': 'qb-slide',
  // The Lambeau leap was dropped (owner); the Heisman replaces it
  'cel-leap': 'cel-heisman',
  'cel-lambeau': 'cel-heisman',
  lambeau: 'cel-heisman',
};

const LABELS = new Map([...Object.values(POSITION_POSES).flat(), ...CELEBRATIONS, ...SIGNATURES].map((p) => [p.key, p.label]));
const norm = (s: string) => s.toLowerCase().replace(/^signature:\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const BY_NAME = new Map([...LABELS].map(([key, label]) => [norm(label), key]));

/** A pose key from a key, an older alias or a human-readable name ("Sideline toe-tap"); null if none. */
export const resolvePose = (x: unknown): string | null => {
  if (typeof x !== 'string') return null;
  if (x in P) return x;
  if (x in ALIASES) return ALIASES[x];
  return BY_NAME.get(norm(x)) ?? null;
};
export const isPose = (x: unknown): x is string => resolvePose(x) !== null;
/** Human-readable pose name (card back, Art lab), e.g. "Rollout throw". */
export const poseLabel = (key: string) => {
  const k = resolvePose(key) ?? key;
  return LABELS.get(k) ?? k;
};
/** Every pose key a player can roll or lock (positions, celebrations, signatures). */
export const allPoseKeys = (): string[] => [...LABELS.keys()];

// ---------- Stand-in opponents ----------

/**
 * Stand-in opponents for contact poses: plain grey players drawn behind the card's player so the action reads.
 *   pose: the opponent's own pose; x: his centre (sprite grid); flip: facing left (toward the player); dy: lowered
 */
export interface StandIn {
  pose: string;
  x: number;
  flip: boolean;
  dy?: number;
}
const S = (pose: string, x: number, flip = true, dy = 0): StandIn => (dy ? { pose, x, flip, dy } : { pose, x, flip });
const RUSHER = [S('x-rush', 41)];
const BLOCKER = [S('x-block', 41)];
const CARRIER = [S('x-carrier', 42)];
const TACKLER = [S('x-tackler', 42)];
const STAND_INS: Record<string, StandIn[]> = {
  // Offensive line and blocking backs / tight ends vs a rusher
  'ol-passpro': RUSHER,
  'ol-drive': RUSHER,
  'ol-punch': RUSHER,
  'ol-anchor': RUSHER,
  'ol-reach': [S('x-rush', 43)],
  'ol-kick': [S('x-rush', 45)],
  'ol-pancake': [S('x-fall', 43)],
  'te-block': RUSHER,
  'te-chip': [S('x-rush', 43)],
  'rb-block': RUSHER,
  'wr-stalk': [S('x-block', 41)],
  // Pass rushers and linebackers vs a blocker
  'dl-swim': BLOCKER,
  'dl-spin': BLOCKER,
  'dl-bull': BLOCKER,
  'dl-rip': BLOCKER,
  'dl-club': BLOCKER,
  'lb-shed': BLOCKER,
  // Tacklers vs a ball carrier / the quarterback
  'lb-tackle': CARRIER,
  'lb-wrap': CARRIER,
  'lb-hit': CARRIER,
  'dl-sack': [S('x-qb', 43)],
  'dl-strip': [S('x-qb', 42)],
  'db-punch': [S('x-runner', 44)],
  // Coverage vs a receiver
  'db-swat': [S('x-catch', 43)],
  'db-breakup': [S('x-catch', 43)],
  'db-press': [S('x-set', 40)],
  'db-jam': [S('x-set', 41)],
  'te-traffic': [S('x-catch', 43)],
  // Ball carriers vs a defender
  'rb-stiffarm': TACKLER,
  'rb-escape': [S('x-lunge', 46)],
  'rb-hurdle': [S('x-lunge', 44)],
  'rb-truck': TACKLER,
  'rb-drag': [S('x-hang', 9, false)],
  'te-drag': [S('x-hang', 9, false)],
  'qb-scramble': [S('lb-pursuit', 3, false)],
};
/** Poses that need a stand-in to read (the sprite check fails if one has none). */
export const CONTACT_POSES = Object.keys(STAND_INS);
export const standInsFor = (key: string): StandIn[] => STAND_INS[resolvePose(key) ?? key] ?? [];

// ---------- Field marks ----------

/** Turf marks some poses need: the goal line and pylon under a reaching ball, the sideline under a toe-tap's toes. */
export type FieldMark = 'goal' | 'sideline';
const MARKS: Record<string, FieldMark> = { 'rb-pylon': 'goal', 'wr-toetap': 'sideline' };
export const markFor = (key: string): FieldMark | undefined => MARKS[resolvePose(key) ?? key];

// ---------- Turf ----------

/**
 * Poses that need turf: something lies on the ground (a diving or sliding body, a tackler at his feet, a knocked-down
 * blocker, the snap's ball, a helmet) or the pose marks the field (sideline, goal line). Value: the patch's x-span in
 * sprite pixels, only as wide as needed. Every other pose stands on its flat shadow alone (STYLE_GUIDE.md §9).
 */
const TURF: Record<string, [number, number]> = {
  'wr-toetap': [12, 50],
  'rb-pylon': [26, 54],
  'wr-dive': [2, 52],
  'db-pick': [2, 48],
  'qb-slide': [6, 46],
  'rb-escape': [14, 54],
  'rb-hurdle': [12, 54],
  'ol-pancake': [6, 54],
  'ol-snap': [4, 42],
  'cel-flex': [-2, 40],
  'sig-crossed': [-2, 40],
  'sig-praise': [-2, 40],
};
export const turfFor = (key: string): [number, number] | null => TURF[resolvePose(key) ?? key] ?? null;

// ---------- Choosing and varying ----------

/** The pose a player is drawn in: the locked one, else (from his name) a celebration about one time in five, else one of his position's. */
export const poseKeyFor = (name: string, position: string, locked?: string): string => {
  const lockedKey = resolvePose(locked);
  if (lockedKey) return lockedKey;
  const seed = seedOf(`${name}|pose`);
  if (seed % 5 === 0) return CELEBRATIONS[(seed >>> 3) % CELEBRATIONS.length].key;
  const list = POSITION_POSES[position] ?? POSITION_POSES.LB;
  return list[(seed >>> 7) % list.length].key;
};

/**
 * Per-player variation inside a pose, from his name: hand ±1, knee ±1, stride, an arm angle (±7°, the free arms
 * swing round the shoulder; a held ball moves with its hand), which arm carries the ball, and the head (chin up, or
 * turned to three-quarter where the pose reads either way).
 */
export interface Jitter {
  hand: Pt;
  knee: number;
  stride: number;
  tilt: -1 | 0 | 1;
  arm: -1 | 0 | 1;
  swap: boolean;
  turn: boolean;
}
export const jitterFor = (name: string): Jitter => {
  const s = seedOf(`${name}|jitter`);
  const pick = (n: number, shift: number) => ((s >>> shift) % n) - Math.floor(n / 2);
  return {
    hand: [pick(3, 1), pick(3, 4)],
    knee: pick(3, 7),
    stride: pick(3, 10),
    tilt: pick(3, 13) as -1 | 0 | 1,
    arm: pick(3, 16) as -1 | 0 | 1,
    swap: (s >>> 19) % 3 === 0,
    turn: ((s >>> 22) & 1) === 1,
  };
};
const NONE: Jitter = { hand: [0, 0], knee: 0, stride: 0, tilt: 0, arm: 0, swap: false, turn: false };

/** Rotate an arm's elbow and hand round its shoulder. */
const swing = (a: Arm, deg: number): Arm => {
  if (!deg) return a;
  const [s] = a;
  const r = deg * RAD;
  const rot = ([x, y]: Pt): Pt => [Math.round(s[0] + (x - s[0]) * Math.cos(r) - (y - s[1]) * Math.sin(r)), Math.round(s[1] + (x - s[0]) * Math.sin(r) + (y - s[1]) * Math.cos(r))];
  return [s, rot(a[1]), rot(a[2])];
};
const near = (a: Pt, b: Pt, d: number) => Math.abs(a[0] - b[0]) <= d && Math.abs(a[1] - b[1]) <= d;

export const runPose = (key: string, k: Skel, j?: Jitter): PoseOut => {
  const k2 = resolvePose(key) ?? key;
  const v = j ?? NONE;
  const out: PoseOut = { look: 'side', lean: 0, crouch: 0, ...(GRIMACE.has(k2) ? { expr: 'grimace' as const } : {}), ...(P[k2] ?? P['lb-read'])(k, v) };
  // A back foot kicked up off the turf (running) points its toe
  if (!out.toes && !out.lift && !out.rotate && out.backLeg[2][1] < k.G - 2) out.toes = 'back';
  if (!j || k2.startsWith('x-')) return out;
  const leg = (l: Leg, s: number): Leg => [l[0], [l[1][0] + j.knee, l[1][1]], [l[2][0] + s, l[2][1]]];
  const legsOut = { frontLeg: leg(out.frontLeg, j.stride), backLeg: leg(out.backLeg, -j.stride) };
  if (out.armsFront || out.bend) return { ...out, ...legsOut };
  // Arm angle: free arms swing round the shoulder; an arm holding the ball takes the ball with it unless both hands hold it
  const ball = out.ball;
  const holdsF = !!ball && near(out.frontArm[2], ball, 5);
  const holdsB = !!ball && near(out.backArm[2], ball, 5);
  let frontArm = out.frontArm;
  let backArm = out.backArm;
  let newBall = ball;
  const deg = j.arm * 7;
  if (!(holdsF && holdsB)) {
    if (!holdsB) backArm = swing(backArm, deg);
    if (!holdsF) frontArm = swing(frontArm, -deg / 2);
    else if (ball) {
      frontArm = swing(frontArm, deg / 2);
      newBall = [ball[0] + frontArm[2][0] - out.frontArm[2][0], ball[1] + frontArm[2][1] - out.frontArm[2][1]];
    }
  }
  // Hands ±1 where no ball depends on them
  const nudge = (a: Arm): Arm => [a[0], a[1], [a[2][0] + j.hand[0], a[2][1] + j.hand[1]]];
  if (!holdsF) frontArm = nudge(frontArm);
  if (!holdsB) backArm = nudge(backArm);
  // Head: chin up a pixel, or turned to three-quarter where the pose reads either way
  let look = out.look;
  if (j.turn && HEAD_TURN.has(k2)) look = look === 'side' ? 'tq' : look === 'tq' ? 'side' : look;
  const nod = out.nod ?? (j.tilt < 0 && look !== 'up' && !GRIMACE.has(k2) ? -1 : undefined);
  return { ...out, ...legsOut, frontArm, backArm, look, ...(newBall ? { ball: newBall } : {}), ...(nod !== undefined ? { nod } : {}) };
};
