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
  build: 'normal' | 'big' | 'huge'; height: 'normal' | 'tall'; pose?: string; eyes?: 'normal' | 'intense'; eyeColor?: string;
  face?: 'oval' | 'defined' | 'chiseled'; nose?: 'straight'; beard?: string; signature?: boolean; image?: string;
  locked: boolean }
// face: everyone gets the oval (HEAD_BARE, STRONG_JAW for huge builds / jawline beards). The two "good-looking" faces
//   are opt-in, set only through sprite.set bundles:
//   'defined'  Rondale Ikarras: the reference face, the proportioned ideal. Smaller and angular (10 px at the brow,
//              12 at the high cheekbones with a highlight, a shadow above and a hollow under them), then a gentle
//              taper to a 6-px chin; eyes and brows 1 px in; a jawline beard follows the jaw edge
//   'chiseled' Sherman Brandson: the most angular. The same structure tapering straight to the chin; big / huge builds
//              push the jaw out 1 px a side and end a row higher in a blunt chin (6-px last row, 4-px under-chin)
//   Beard templates are drawn for the oval; on these faces each half of a row slides in onto the narrower jaw.
//   God Johnson, Malakai Sawyer and Ty Lock also use 'chiseled' (normal build); Ryland Maxwell 'defined'.
// expr: the bare face's expression, overriding the pose's ('grin': God Johnson's happy open grin, corners up, upper
//   teeth, magenta mouth, brows lifted). stubble 'dense': a close-cropped beard, ~75 % darker stubble (Brandson).
//   On the angular faces a goatee / moustache scales about the face's centre; stubble and short beards stay inside
//   the face and only full beards hang below the chin.
// accessories 'bandana' (tied at the front over the crown, covers the hair; Sawyer) and 'hoops' (2-px hoops).
// hair 'spikyafro' (God Johnson): a rounded afro 1 px past the head each side, 4 rows high, spiky tufts on top.
//   'cornrows' (Maxwell): braids front to back with scalp lines between, no volume; only the nape ends show under a
//   helmet.
// nose 'straight': a bridge shadow (Ikarras). beard: beard colour (name or #hex) when it differs from the hair's
//   (Isaiah Karras: dark-brown beard, black locs)
// hair 'crownlocs' (Brandson): a crown of 11 thick 2-px loc strands (two tones r / fT, twist glints and some tips in
//   R), domed 5 rows above the forehead with a ragged top edge of loc tips, falling round the face to the jaw / neck,
//   nothing behind; with a helmet on, two strands hang at the nape. 'longlocs' (Karras): locs from the crown with no
//   high-top, falling onto the chest
SKIN_TONES, skinColor(t), hairColor(c), eyeColor(c), EYE_COLOR_KEYS, DEFAULT_SKIN
genericRolls(name, skin): { style, color, facial, eyeColor }   // the generic character's stable rolls
useSpriteTable(): Record<name, RawLook> | null        // public/data/sprites.json, fetched once
lookFor(player, table): SpriteLook                    // locked entry (field by field) over the generic rolls
lockedSkin(name, table): SkinTone | null              // player editor: picker read-only when locked
interface HeadOpts { look; pose: PoseOut; style; hel: Helmet }
bareHead(hx, hy, opts, tall): Rect[]                  // helmet off, face out, 14 wide; forehead hy, chin hy+14
HEAD_BARE                                             // the 14 × 16 bare face (rows 0–15 from the forehead)
faceHair(R, fx, w, rows, facial) / mouth(R, x, y, expr) / eyes(R, lx, rx, y, look, expr)   // helmet faces (unchanged)
bareHair(hx, hy, look, tall, wind?) / helmetHair(hx, hy, look, tall)   // hair on a bare head / out of a side helmet
hairRise(look): number                                // rows the bare head's hair rises above hy (render.ts fits by it)
faceColours(look): Record<Key, string>                // face colour keys, merged by render.ts colours()
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
beard, `fT` loc / twist highlight, `fH` skin highlight, `fU` durag sheen, `fl` / `fm` loc strand tones.

The Golden hour portrait (`sig-golden`) was removed at the owner's request; the key is an alias of `sig-crossed`.

**Standardisation rule.** Players without a `sprites.json` entry all get the same generic character (standard face,
normal build) and vary by stable rolls on their name (`genericRolls`, `seedOf(name + '|hair')` etc., like the pose
roll), the skin toggle (`Player.spriteSkin`, else `DEFAULT_SKIN`), the pose roll, the uniform roll and the number:
- hair style (`|hair`): short (most), buzz, twists, curly, bald, braids, dreads, afro, cornrows, spiky afro; rarely long
  or mohawk. Never the signature-only crownlocs / longlocs. Textured styles are rarer on the two lightest skins.
- hair colour (`|hairColor`): mostly black, then dark brown and brown; auburn, dirty blond and blond only on lighter
  skins. Textured hair stays black or dark brown.
- facial hair (`|facial`): none (most), stubble, goatee, chinstrap, short beard, occasionally a full beard.
- eye colour (`|eyes`, look field `eyeColor`): the pupil pixel. Mostly dark brown, some brown or hazel; green and blue
  rare and only on lighter skins. `EYE_COLORS`: dark `#160b00`, brown, hazel, green, blue, grey (all dark enough to read
  against the white), or a #hex.
The skin feeds the colour weights, so changing the skin toggle can change the hair / eye colour roll. A locked look
wins field by field: rolls only fill the fields its `sprites.json` entry leaves out (`eyeColor` included: the Wilsons
and Charlie John are locked to blue).

## `helmets.ts`

```ts
interface Helmet { shell; stripe: 'none' | 'single' | 'double' | 'triple'; stripes: [centre, edge]; mask;
  logo: string[] /* 7 × 5 unit mark */; colors: string[]; pants?; fine?: { rows; colors } /* 14 × 12 fine cells */;
  team? /* club id, set by helmetFor */; logoVariant? /* a uniform's period glyph key, or 'none' */;
  pattern?: 'tiger' | 'rams' }
HELMETS: Record<teamId, Helmet>; helmetFor(team): Helmet     // + pants, fine logo (HAND_FINE = helmetLogos.ts)
HEAD_SIDE (20 × 17), HEAD_TQ (18 × 16), HEAD_FRONT (18 × 16), MINI_HELMET (12 × 9)
sideHead(hx, hy, opts) / tqHead(hx, hy, opts) / frontHead(hx, hy, opts): Rect[]   // helmet on, with the face inside
miniHelmet(x, y, hel): Rect[]                                // in hand / on the ground / Art lab Helmets row
shellLogo(R, x, y, hel, clip?)                               // decal centred on a 14 × 12 fine box, optionally clipped to a template's shell
tiger(R, template, hx, hy, hel, view = 'side')               // shell design for a view (SHELL_DESIGNS): Bengals stripes / Rams horn
helmetColours(hel): Record<Key, string>
fineOf(hel)                                                  // the logo shown: variant ('none' = plain) › own fine › club glyph
```

**Logos on other shells and period logos.** A uniform that changes the shell keeps the club's detailed logo
(`fineOf` falls back to the club glyph via `hel.team`); `helmetColours` recolours it for the shell: a glyph colour equal
to the shell it was drawn for (`HELMET_LOGOS[k].shell`) follows the new shell, and a colour that would vanish against
the new shell takes the glyph's own shell colour (or white / near-black). A uniform picks a period glyph with
`helmet: { logoVariant: '<key>' }` (`VARIANTS` in `scripts/build_helmet_logos.py`: `broncos-d`, `dolphins-1972`,
`commanders-r`, `bucs-bruce`, `patriots-pat`, `titans-oilers`, `49ers-80s`, `packers-60s`, `lions-90s`), or `'none'`
for a plain helmet (NY Titans, Packers Acme, Browns white helmet).

Logos are hand-drawn pixel glyphs, one per club with a decal, authored in `scripts/build_helmet_logos.py` (no
network; `--preview out.png` renders them all big on their shells) which writes `helmetLogos.ts`. A glyph is up to
16 × 14 fine cells (nominally 14 × 12, centred), faces forward (+x), uses up to four colours and 2-cell strokes for
letters. The Bengals stripes and Rams horn are per-view pixel templates (`SHELL_DESIGNS`: side, tq, front, mini)
clipped to the shell; the Browns have no decal. Side-view crown stripes (side head and mini helmet) are a narrow band
(`SIDE_BAND`, `MINI_BAND`: three concentric 1-px curves) from the forehead over the crown, one row under the top, and
down the back edge; triple = edge / centre / edge colours, single = two curves, double = outer and inner. Front and
three-quarter views draw the stripe as a vertical band down the middle.
Helmets are one compact size for every build, and every shell is a full round dome (a ball, not an egg). The crown is
circle-like: 1-px steps per side at the top, then the widest rows repeat (0-px steps) at the bulge, so the sides read
curved rather than diagonal (never more than 1 px per side between rows; `scripts/check_sprites.ts` asserts it).
The narrowest top row was taken off every view (owner request). Round-out caps (`HEAD_SIDE_CAP`, `HEAD_TQ_CAP`, `HEAD_FRONT_CAP`, `MINI_CAP`, arrays of rows) are drawn just above
each template (`capAt`), so every anchor inside the templates (face, chin strap, cage, logo) is unchanged:
- side: 16 wide inside the 20 × 17 box (columns 0–1 empty), no cap: crown 8 (row 0) → 10 → 12 → 14 → 14 → 16 …,
  the back curving in toward the neck
- three-quarter: one cap row at `hy − 1`; 8 → 10 → 12 → 14 → 14 → 16 → 17
- front: a ball 16 wide × 15 tall, no cap: 10 (row 0) → 12 → 14 → 14 → 16 …, sides straight down to the jaw
  (row 13), one 1-px step (row 14), the chin strap below (row 15)
- mini: a 10-wide dome, one cap row at `y − 1`; 6 → 8 → 8 → 10 (`PixelHelmet` draws it at y = 2 in a 14 × 12
  box, so the top lands on row 1) plus its facemask. Stripes run over the cap and are clipped to the dome
(`onShell`); the gloss sits in the crown. `render.ts` lifts helmet-on heads by `armT − 3` rows (big +1, huge +2) so the near sleeve doesn't
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
derived from it). Home sets for all 32 clubs; 39 real modern alternates, at most two per club (Color Rush sets,
throwbacks, alternates such as Indiana Nights, Winter Warrior, H-Town Blue, Orange Crush); and 15 famous **era kits**
(`ERAS`, at most one per club, `era: true`, labelled by era with no player names: "1985 Bears"). The roll is 8% in
all: for a club with both kinds, 2% (`ERA_CHANCE`) era kit and 6% alternates (split evenly); a club with only
alternates keeps the full 8%. An alternate's helmet change goes through `helmet` (shell / stripe / mask only:
period logos such as the Broncos' old "D" or the Titans of New York shield are not drawn; the current decal is
dropped when the shell changes).

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
uniformKind(player, variant?, finish?): 'home' | 'alt' | 'era'   // market bonus
isAlternate(player, variant?, finish?): boolean    // any non-home kit
uniformLabel(u): string                            // card back "Uniform: <label>" ("1985 Bears (era)")
helmetWith(baseHelmet, uniform): Helmet            // alternates may swap the shell / stripe / mask
sleeveBands(u) / pantsBands(u) / sockBands(u)      // resolved stripe lists for any uniform (legacy kinds included)
ALT_VALUE_BONUS ×1.1, ERA_VALUE_BONUS ×1.15 (defined in src/utils/cardMarket.ts; cardPrice(value, finish, variant, kind))
allHomes(), allAlternates(), allEraKits()           // Art lab Uniforms tab (filters: All 32 / With alternates / Era kits)
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
POSITION_POSES (9–12 per position), CELEBRATIONS (8), SIGNATURES        // { key, label } — label = the pose's name
poseLabel(key), resolvePose(keyOrNameOrAlias), isPose(x), allPoseKeys()
poseKeyFor(name, position, locked?)   // locked pose (key or name), else 1 in 5 a celebration, else the position's list
runPose(key, skel, jitter?) / jitterFor(name)
standInsFor(key): StandIn[]; CONTACT_POSES // grey opponents for contact poses (STAND_INS)
markFor(key): 'goal' | 'sideline'     // turf mark the pose needs (pylon + goal line, sideline)
turfFor(key): [x0, x1] | null         // turf patch (only where something is on the ground); else just the shadow
```

- **Names.** Every pose has a human-readable name (the `[key, name]` rows in `POSITION_POSES` / `CELEBRATIONS`). It is
  the card-back note, the Art lab Poses strip label, and a valid `pose` in `sprites.json` ("Heisman pose" or
  `cel-heisman`). Removed keys stay in `ALIASES` (e.g. `rb-dive` → `rb-pylon`, `qb-sneak` → `qb-slide`,
  `cel-leap` → `cel-heisman`, and the removed stances `wr-stance`, `te-stance`, `ol-stance`, `ol-ready`, `dl-three`,
  `dl-four`, `qb-shotgun` → an action pose), so an old lock still draws a believable pose.
- **Both arms read.** The far arm's forearm and hand are drawn again over the torso and near leg in the far skin
  shade (`render.ts farForearm`), and two-hand catches put the far hand on the far side of the ball.
- **Bent at the waist** (`bend`, e.g. the snap): the upper body turns forward round the hips, legs stay put, the
  head stays upright and a held ball sits on the turf (`unbend` puts a hand exactly on it).
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
size in every pose, grounded poses share the baseline, huge + tall is the biggest frame, every position has
uniquely named poses (8–12), every contact pose has a stand-in, every turf mark has a turf patch and no turf mark is
knocked off by the frame.

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
