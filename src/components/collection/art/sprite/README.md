# Retro Bowl sprite modules

The "Retro Bowl sprite" card art (and the stand-ins, helmet props and Art lab strips) is built by five modules plus a
shared grid. `../PixelSprite.tsx` is the React wrapper; nothing else should import the modules' internals.

```
grid.ts      types, constants, drawing primitives            (no imports)
faces.ts     looks (sprites.json), heads, faces, hair         → grid, (types: helmets, poses)
helmets.ts   32-team helmet table + helmet renderer           → grid, faces (eyes/mouth/faceHair), helmetLogos.ts
uniforms.ts  home uniform per team + alternates               → helmets (types), ../shared (seedOf)
poses.ts     pose catalogue, names, jitter, stand-ins, marks  → ../shared (seedOf)
render.ts    compositor: body, layering, raster, colours      → all of the above
```

## Grid conventions (`grid.ts`)

- **Sprite pixels.** x from `PIX_X` (−4) to `PIX_X + PIX_W` (54), y from 0 to `PIX_H` (64). The turf starts at
  `GROUND` (59). The figure's centre line is x = 22 (`cx`), facing **right** (+x is forward).
- **Rects** are `[x, y, w, h, key]` in sprite pixels. Keys are colour slots (`'H'` shell, `'s'` skin, `'J'` jersey …,
  see `render.ts colours()`); later rects win.
- **Fine grid.** `render.ts` rasterises at `F` (2) cells per sprite pixel. Everything is drawn in whole sprite pixels
  except fine detail (helmet logos, sleeve and pants stripes), which uses multiples of `1 / F`.
- Primitives: `line(a, b, thickness, key, from?, to?, offset?)` (thick Bresenham line, optionally a fraction of it),
  `stamp(rows, x, y, map?)` (a string template, one char per pixel, `'.'` = empty), `set`, `span`, `shade`, `tint`.

## `faces.ts`

```ts
type SkinTone = 'pale' | 'light' | 'tan' | 'medium' | 'brown' | 'deep';
interface SpriteLook { skin; hair: { style: HairStyle; color }; facial: Facial; accessories: string[];
  build: 'normal' | 'big' | 'huge'; height: 'normal' | 'tall'; pose?: string; eyes?: 'normal' | 'intense';
  signature?: boolean; image?: string; locked: boolean }
SKIN_TONES, skinColor(t), hairColor(c), DEFAULT_SKIN
useSpriteTable(): Record<name, RawLook> | null        // public/data/sprites.json, fetched once
lookFor(player, table): SpriteLook                    // locked entry, else the standard generic character
lockedSkin(name, table): SkinTone | null              // player editor: picker read-only when locked
interface HeadOpts { look; pose: PoseOut; style; hel: Helmet }
bareHead(hx, hy, opts, tall): Rect[]                  // helmet off, face out, 14 wide; forehead hy, chin hy+14
HEAD_BARE                                             // the 14 × 16 bare face (rows 0–15 from the forehead)
faceHair(R, fx, w, rows, facial) / mouth(R, x, y, expr) / eyes(R, lx, rx, y, look, expr)   // helmet faces (unchanged)
bareHair(hx, hy, look, tall, wind?) / helmetHair(hx, hy, look, tall)   // hair on a bare head / out of a side helmet
hairRise(look): number                                // rows the bare head's hair rises above hy (render.ts fits by it)
faceColours(look): Record<Key, string>                // face + portrait colour keys, merged by render.ts colours()
PORTRAIT_POSES, isPortraitPose(key)                   // pose keys drawn as a portrait ('sig-golden')
goldenHourPortrait(look, number): Rect[]              // "Signature: Golden hour", fine-grid cells incl. background
```

**Bare face** (follows `STYLE_GUIDE.md` §5): a 14 × 15 oval (forehead row 0 to chin row 14, neck shadow row 15,
hair above row 0). Skin is the game's 4-tone ramp (`skinRamp`: highlight checker on the forehead centre, shadow down
**both** edges, dark for brows / nostrils / lip line). Brows are 2 px on row 4 (angry / intense: dropped onto the eye
and slanted toward the nose); eyes are 1 white + 1 pupil on row 6, pupils toward the nose (intense: 3 px, a centred
pupil; eyes-up: the pupil on the white's top edge as half a pixel); nostrils are 2 px, 3 apart, on row 8; the mouth
is rows 9–11 (grin: dark lip line, white teeth, the ramp's mouth colour; closed: 2–3 px of lip; pout: 1 over 3).
Ears rows 6–9, studs `#c0cbdc`. Beards are solid blocks ear to ear (`BEARDS`, near-black `#0c1826`, or a darker
version of light hair) with the mouth drawn through. Huge builds and the `jawline` beard get a square jaw. Long
styles hang strands behind the head over the shoulders; `pose.wind` sweeps them back.

**Skin tones.** The six picker keys stay (saved `spriteSkin` values and sprites.json resolve unchanged) but map onto
the game's five ramps: `pale` = Light, `light` = the lighter Tan base `#e2a589`, `tan`, `medium`, `brown`, `deep`.

**Interface changes (backward compatible).** `bareHead`'s anchor is unchanged where it matters (the chin is still
`hy + 14`, so it sits on the shoulder line at `sy − 15`), but the face is taller: the forehead starts at `hy` (was
`hy + 3`) and the hair rises up to 7 rows above it. New colour keys: `fL` lips, `fM` grin mouth, `fb` beard, `fE` stud, `fN` nostrils, `fS` stubble, `fB` dark
beard, `fT` loc / twist highlight, `fH` skin highlight, `fU` durag sheen, `fR` / `fr` golden rim / warm highlight,
`g0`–`g6` sky bands, `gF` / `gf` sun and flare.

**Golden hour** (`sig-golden`; no player uses it since the owner reverted Brandson to arms crossed): `buildSprite` returns `goldenHourPortrait` instead of a body:
a head-and-shoulders portrait on the fine grid (F cells per sprite pixel), the head tilted up ~20° toward a low sun
at the upper right, eyes up, golden rim light on the sun side, a stepped sun glow and lens flare, locs over massive
shoulders, the card's number on the near shoulder in the card's uniform. No outline (like every figure). poses.ts registers the key in `SIGNATURES` (label "Signature: Golden hour") with
a fallback body (`sig-crossed`) for full-figure contexts.

**Standardisation rule.** Players without a `sprites.json` entry all get the same generic character (hair hidden
under the helmet, the standard short cut when it's off, no facial hair, normal build); they vary only by the skin toggle (`Player.spriteSkin`, else
`DEFAULT_SKIN`), the pose roll, the uniform roll and the number.

## `helmets.ts`

```ts
interface Helmet { shell; stripe: 'none' | 'single' | 'double' | 'triple'; stripes: [centre, edge]; mask;
  logo: string[] /* 7 × 5 unit mark */; colors: string[]; pants?; fine?: { rows; colors } /* 14 × 12 fine cells */;
  pattern?: 'tiger' | 'rams' }
HELMETS: Record<teamId, Helmet>; helmetFor(team): Helmet     // + pants, fine logo (HAND_FINE = helmetLogos.ts)
HEAD_SIDE (20 × 17), HEAD_TQ (18 × 16), HEAD_FRONT (18 × 16), MINI_HELMET (12 × 9)
sideHead(hx, hy, opts) / tqHead(hx, hy, opts) / frontHead(hx, hy, opts): Rect[]   // helmet on, with the face inside
miniHelmet(x, y, hel): Rect[]                                // in hand / on the ground / Art lab Helmets row
shellLogo(R, x, y, hel, clip?)                               // decal centred on a 14 × 12 fine box, optionally clipped to a template's shell
tiger(R, template, hx, hy, hel, view = 'side')               // shell design for a view (SHELL_DESIGNS): Bengals stripes / Rams horn
helmetColours(hel): Record<Key, string>
```

Logos are hand-drawn pixel glyphs, one per club with a decal, authored in `scripts/build_helmet_logos.py` (no
network; `--preview out.png` renders them all big on their shells) which writes `helmetLogos.ts`. A glyph is up to
16 × 14 fine cells (nominally 14 × 12, centred), faces forward (+x), uses up to four colours and 2-cell strokes for
letters. The Bengals stripes and Rams horn are per-view pixel templates (`SHELL_DESIGNS`: side, tq, front, mini)
clipped to the shell; the Browns have no decal. On the side head the crown stripe runs one row in from the top edge.
Helmets are one compact size for every build: the side shell is 18 × 15 inside the 20 × 17 box (rows 0–1 and columns
0–1 empty, so the face and chin anchors are unchanged), the three-quarter shell 17 × 15; the back no longer drops
below the jaw. `render.ts` lifts helmet-on heads by `armT − 3` rows (big +1, huge +2) so the near sleeve doesn't
cover the jaw. Near-black facemasks are drawn dark graphite (`#4a4f58`) so the cage stays visible.

Head boxes and anchors (sprite pixels, relative to the head's top-left `(hx, hy)`):

| Head | Size | Face window | Chin strap row | Placed at (render.ts) |
|---|---|---|---|---|
| side (profile) | 20 × 17 | x 12–18, y 7–14 | 15 | `hx = cx − 11 + lean`, `hy = shoulderY + crouch − 15` |
| three-quarter | 18 × 16 | x 7–15, y 5–14 | 15 | `hx = cx − 8 + lean` |
| front | 18 × 16 | x 4–13, y 5–14 | 15 | `hx = cx − 9 + lean` |
| bare (helmet off) | 14 × 16 (+ hair above) | x 1–12, y 0–14 | – | `hx = cx − 7 + lean` (forehead at `hy`) |

## `uniforms.ts`

One table drives every art style: the sprite (`render.ts`), and the Jersey, Jersey back, Locker and Topps art
(`JerseyGarment` / `UniformSleeves`, `JerseyBackArt`, `LockerArt`, `VintageArt`, and `teamStyle.ts`, which is now
derived from it). Home sets for all 32 clubs; at most two real alternates per club (Color Rush, throwbacks).

```ts
type Band = [color: string | null /* null = jersey colour */, width?: number /* half sprite pixels, default 1 */]
interface Uniform { id; label; jersey; trim; sleeve: 'stripes2' | 'stripes3' | 'yoke' | 'bolt' | 'tiger' | 'none' | 'bands';
  yoke?; number; numberOutline; numberStyle: 'outlined' | 'double' | 'solid'; pants; pantsStripe | null; socks;
  sockStripe; cleats; helmet?: Partial<Helmet>;
  // optional detail (added; readers fall back to the fields above when absent)
  bands?: Band[] /* sleeve stripes, shoulder side → hem */; shoulder? /* cap along the shoulder top */; collar?;
  numberOutline2? /* 'double': second colour */; pantsStripes?: string[] /* half-px columns */;
  sockStripes?: string[] /* half-px rows */ }
homeUniform(team): Uniform                         // cached; clubs outside the table get team colours
uniformFor(player, variant?, finish?): Uniform     // ALT_CHANCE (8%) of an alternate, stable per player × variant × finish
isAlternate(player, variant?, finish?): boolean    // card back "Uniform: <label>" line, market bonus
helmetWith(baseHelmet, uniform): Helmet            // alternates may swap the shell / stripe / mask
sleeveBands(u) / pantsBands(u) / sockBands(u)      // resolved stripe lists for any uniform (legacy kinds included)
ALT_VALUE_BONUS (×1.1, defined in src/utils/cardMarket.ts, applied by cardPrice(value, finish, variant, alt))
allHomes(), allAlternates()                         // Art lab strips
```

`sleeve` meanings: `stripes2` / `stripes3` sleeve stripes (from `bands` when set), `yoke` shoulder yoke, `bolt`,
`tiger` (yoke-coloured sleeves with stripes in the jersey colour), `bands` (bumblebee hoops round the body), `none`.

Rendering (`render.ts`): sleeve bands are drawn across the arm on the fine grid, clipped to the sleeve's pixels, ending
half a pixel above the hem; pants stripes run along the thigh as half-pixel columns; sock stripes are half-pixel rows;
the sprite draws numbers solid (no outline; the outline fields serve the other art styles). New colour keys: `u1…` sleeve bands,
`p1…` pants columns, `c1…` sock rows, `uc` collar, `us` shoulder cap, `n2` second number outline, `tg` tiger stripes.

## `poses.ts`

```ts
interface Skel { cx; sy /* shoulder line */; hy /* hip line */; fs; bs /* front / back shoulder x */; fh; bh; A /* arm segment */; L /* hip→ankle */; h; G /* ankle line */ }
interface PoseOut { frontArm, backArm, frontLeg, backLeg: [Pt, Pt, Pt]; ball?; ballBack?; palm?; backPalm?; finger?;
  toes?: 'front' | 'back' | 'both'; look: 'side' | 'up' | 'front' | 'tq'; expr?; helmetOff?; helmetAt?: 'hand' | 'feet';
  armsFront?; nod?; halo?; lean; shear? /* lean from the waist */; crouch; lift?; rotate?; headUp?; shiftX? }
POSITION_POSES (10–12 per position), CELEBRATIONS (8), SIGNATURES        // { key, label } — label = the pose's name
poseLabel(key), resolvePose(keyOrNameOrAlias), isPose(x), allPoseKeys()
poseKeyFor(name, position, locked?)   // locked pose (key or name), else 1 in 5 a celebration, else the position's list
runPose(key, skel, jitter?) / jitterFor(name)
standInsFor(key): StandIn[]; CONTACT_POSES // grey opponents for contact poses (STAND_INS)
markFor(key): 'goal' | 'sideline'     // turf mark the pose needs (pylon + goal line, sideline)
```

- **Names.** Every pose has a human-readable name (the `[key, name]` rows in `POSITION_POSES` / `CELEBRATIONS`). It is
  the card-back note, the Art lab Poses strip label, and a valid `pose` in `sprites.json` ("Heisman pose" or
  `cel-heisman`). Removed keys stay in `ALIASES` (e.g. `rb-dive` → `rb-pylon`, `qb-sneak` → `qb-slide`,
  `cel-leap` → `cel-heisman`), so an old lock still draws a believable pose.
- **Arms by angle.** `arm(k, front, upper°, fore°)` (0 forward, −90 up, 90 down, 180 back) scales with the build;
  `reach(k, hand)` is the far arm reaching across the body; `at(arm, dx, dy)` places a held ball relative to a hand.
- **Variation** (`jitterFor(name)`, stable per player): hands ±1, knee ±1, stride ±1, an arm angle (±7°, free arms
  swing round the shoulder and a held ball moves with its hand), which arm carries the ball in carry poses (`swap`),
  chin up a pixel, and profile ↔ three-quarter head where a pose reads either way (`HEAD_TURN`).
- **Stand-ins** (`x-…` poses, never rolled) are upright players on the same frame as the card's player (normal
  build: same head and torso, which `check:sprites` asserts): arms at chest height, full-length legs, no hunch or
  lean, the head three-quarter so the facemask shows. `render.ts` defines him (`STAND_IN_LOOK`, `STAND_IN_HELMET`,
  `STAND_IN_UNIFORM`, `standInColours`: flat two-tone greys per material, a darker helmet with a light cage, no logo
  or number); `PixelSprite.tsx` draws him opaque, behind the turf (so a pile could sink into it) and behind the card's
  player, so he never covers his face or number.
- **Static.** No idle animation; a pose is one frame.

**Scale.** Poses only move limbs, lean (`shear`, a bend at the waist: the chest, number, arms and head move as one
block), crouch, lift and rotation; head size and torso height come from the build (`render.ts BUILDS`), so every
pose draws the same body. Only `build` / `height` change size. `bodyFor` fits the frame by height: the bare head (15
rows) plus `hairRise(look)` must stay 2 px below the top, so when a tall, huge player with a high-top would clip, the
legs shrink first (to 14), then the torso; the head never does. Grounded poses stand on one baseline: the soles' bottom
row is `GROUND − 1` (feet on the ankle line `G = GROUND − 2`; a pointed toe ends on the same row).

**Check:** `npm run check:sprites` (`scripts/check_sprites.ts`, add `-- --verbose` for the per-pose table) renders
every pose and stand-in for a normal-build player and fails unless the head (per head kind) and torso are the same
size in every pose, grounded poses share the baseline, huge + tall is the biggest frame, every position has 10–12
uniquely named poses, every contact pose has a stand-in and no turf mark is knocked off by the frame.

## `render.ts` (compositor)

`buildSprite(look, poseKey, style, helmet, number, name, uniform): Rect[]` (fine-grid runs) is
`runsOf(composeSprite(…).grid)`. `composeSprite` does, in order:

1. Frame from `bodyFor(look)`; `skeletonFor(body)` (feet on the ankle line, hips and shoulders up from it); `runPose`.
2. Layers, back to front: cocked ball → back arm → helmet in hand → back leg → hair behind a side helmet → torso
   (yoke, sleeve trim, collar) → chest number → front leg → helmet on the ground → head (`sideHead` / `tqHead` /
   `frontHead` / `bareHead`) → crossed back arm → front arm (+ finger) → held ball.
3. Each layer is rasterised at F×. Body layers lean (`shear`) and rotate round the hips; head layers ride the neck
   with a rigid shift, so a diver's head stays upright (`headUp: false` turns it with the body). `separate` (a crease
   shade where raised arms touch the head), `ring` (the 1-px black ring round a helmet in a hand or on the ground, the
   only outline in a figure), `rim` (edge shading, below), then lift; rotated poses are refit just above the turf.
   Shifts are whole sprite pixels. `runsOf` makes the horizontal runs.

**No outline** (STYLE_GUIDE.md rule 1). `rim` gives every material the game's 2-tone edge: a cell within one sprite
pixel of the background on its left, right or underside takes its shadow (`s`→`x`, `J`→`Z`, `P`→`z`, `K`→`q`, else
the derived `<key>~` that `colours()` adds at ~74 % value); top edges stay lit. Where a later layer of the same
material overlaps (a sleeve over the jersey) the lower one takes the shadow along the contact edge. Eyes, teeth,
numbers, logos, shoes and the ball keep their colours. `runsOf(grid, true)` (a black ring round everything) is only
for helmet icons: `PixelHelmet` and the Art lab's `PixelHead` views.

**Jersey, number, shoes.** The torso has a 2-row dark chest band behind the number's top, a dark hem row and a white
chest pixel under the collar. Numbers are solid 4 × 7 digits with 1-px strokes and no outline (two digits 9 px wide),
rows 1–2 in the number's shade (`Ns`: `#bec6dd` for white). Sleeve stripes are clipped to the sleeve outside the
torso, so they never draw lines across the chest. Every team wears the same shoe: a white sock-top row, a `#bec6dd`
upper and a `#89a1ab` sole row (`B`, `Bs`).

`fieldMarkFor(look, poseKey, name)` gives the sprite x of a pose's turf mark (the goal line and pylon under a reaching
ball, the sideline under a toe-tap's toes) from the same placement maths; `PixelSpriteArt` draws it in place of the
yard line.

`colours(palette, look, style, helmet, uniform)` maps every key to a colour.
