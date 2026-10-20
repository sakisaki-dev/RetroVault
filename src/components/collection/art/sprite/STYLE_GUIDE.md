# Retro Bowl art-style reference (for sprite artists)

This guide comes from pixel measurements of the owner's own NFL Retro Bowl '27 screenshots
(`~/Downloads/Retrobowl Uploads/IMG_6200–6223`). They were captured at 2622 × 1206 and resampled back to the game's
pixel grid. App Store, Fandom wiki and Reddit images were measured the same way (see the reference index at the end).
**Where this guide and the current code disagree, the screenshots win.**

Units: an **art px** is one pixel of the character art. The game draws its UI on a ~587 × 270 grid (one UI px is
about 4.47 screen px on the owner's phone). Character art appears at two scales:

| Context | Scale | Figure height | Head (hair top → chin) | Head share |
|---|---|---|---|---|
| Player detail / signing screen (IMG_6206–6210) | 1 art px = **2 UI px** | **48 art px** (hair top → shoe sole) | 18–19 px | **≈ 40 %** |
| Roster / draft / HOF cards (IMG_6200–6205, 6211–6223) | 1 art px = **1 UI px** | same art, cropped at the waist (card shows head + torso + hands) | 16–18 px | — |
| Title / key art (nflrb27_iphone_01) | 1 art px = 2 UI px | ≈ 50 px | ≈ 19 px | ≈ 38 % |
| On-field gameplay, NFL '27 (nflrb27_iphone_03) | 1 art px ≈ 6 screen px | **16–18 px** | helmet 5 × 4 px | ≈ 25–28 % |
| On-field, classic Retro Bowl (Fandom `Washingtonhome.png`) | — | **15–16 px** | helmet 4–5 × 3–4 px | ≈ 25 % |

The card and portrait art is the same character drawn at a different size, not a separate design.

---

## 1. The 12 rules that matter most

1. **No outline.** Detail sprites, card sprites, title art and on-field sprites have **no black or dark contour**.
   Skin, jersey and shoe pixels sit directly against the background. Edges are defined by colour contrast and by a
   darker shade of the same material on the edge columns. (Black appears only where the thing is black: hair, cleats,
   pupils, mouth interiors.) The only outlined art is the **helmet icons** (big match-up helmets, small leaderboard
   and schedule helmets), which have a 1 px pure-black outline.
2. **Chibi proportions.** The head is about 40 % of the figure's height and about 13 px wide, against a torso about
   14 px wide (22 px across the shoulder pads). Legs are short (about 10 px from the pants hem to the shoe sole).
3. **Helmet off in every menu, card and portrait.** Every roster card, HOF card, draft card and detail screen shows
   the player bare-headed, with hair, so each player can be told apart by face and hair. Helmets appear only on field,
   on helmet icons, and on the ground or in a hand during celebrations (Fandom `Cover.png`).
4. **Few tones per material, and no gradients.** Use a base and one shadow for cloth, plus a highlight for skin. Some
   materials (hair, gold blazer, card backgrounds) also use a 50 % checkerboard dither. Shading comes from the front
   and above: highlight on the forehead centre, shadow down **both** edges of the face, torso, arms and thighs (like
   ambient occlusion), and a darker hem row on the jersey.
5. **Faces use very few pixels.** Each eye is **1 white px + 1 pupil px**, one row tall, with the pupils toward the
   nose. Brows are a 2-px dark bar one row above the eyes, angled for intense looks. The nose is two
   nostril pixels, 3 px apart. An open smile is three rows: dark lip line, white teeth, magenta mouth.
6. **Hair carries most of the identity.** Locs, twists and braids are vertical 1-px strands in two near-black tones,
   with a lighter checkerboard on the scalp between parts. They hang past the jaw and onto the shoulders. Hair sits
   *on* the head and adds 2–3 px above the skull. Beards are solid near-black, or a darker version of the hair colour
   for light hair, and cover the jaw from ear to ear.
7. **Use the official team colours (exact hex) as the base tone**, with a hand-picked darker shade (about 70–80 %
   value). For example, 49ers `#aa0000` / `#8a0000` with pants `#b3995d` / `#967b3c`, and Commanders `#5a1414` /
   `#390b0b` with gold `#f09f17` / `#c3800f`.
8. **Numbers are solid, 1-px strokes, 7 px tall, 3–4 px wide**, with no outline. They are white (or the team's number
   colour), and the vertical stems take a pale lavender shade (`#bec6dd`). The number sits centred on the chest,
   below a darker chest band.
9. **One shoe and sock formula for every team.** A white sock top (2 rows), a pale lavender-grey shoe (`#bec6dd`)
   with a darker sole (`#89a1ab`), about 5 px long and 3 px tall, toes pointing out.
10. **Shadow is a flat, darker, semi-transparent ellipse** under the feet, about 26 × 3 px, about 2 px wider than
    the stance. On menu blue it reads as `#173686`. On grass it is a darker green (`#255405` / `#1e4304`). Nothing
    else (no drop shadow on the body, no glow).
11. **Mostly static, front-facing poses for cards.** The figure stands facing the viewer, feet apart and arms
    slightly away from the body. The variety comes from the arms (ball at hip, wave, fist, ball toss, flex). Motion
    is shown with **sparse white dot trails** (ball toss), never blur.
12. **Fixed backgrounds.** Cards: offense uses light-blue diagonal stripes, defense red, kicker orange, and HOF gold.
    Menus are royal blue with a faint dithered watermark. Sprites never get a coloured glow or an outline to separate
    them from the background.

---

## 2. Proportions (detail-screen sprite, 48 px tall; St. Brown IMG_6207 measured)

Rows are counted from the top of the hair (y = 0) to the sole (y = 48).

| Part | Rows | Size / notes |
|---|---|---|
| Hair above skull | 0–2 | 2–3 px of hair; afro and locs styles go up to 4–5 px |
| Forehead (with highlight) | 2–5 | face 12 px wide |
| Brows | 6 | 2 px each, inner ends 5 px apart |
| Eyes | 8 | white + pupil, 1 row; inner pupils 7 px apart |
| Ears | 7–11 | 1 px out on each side, 1 shadow pixel inside |
| Nostrils | 10 | 2 dark pixels, 3 px apart |
| Mouth | 11–13 | 6 px wide when open |
| Chin / beard | 14–18 | jaw narrows by 1 px per side over the last 3 rows |
| Neck | 18–19 | 6 px wide, skin shadow at the sides |
| Shoulder pads | 19–21 | 22 px across (pads stick out 3–4 px past the torso) |
| Jersey torso | 19–32 | 13–14 px wide; darker hem row at 31–32 |
| Number | 23–29 | 7 rows |
| Arms | 21–33 | **3 px wide**, hang 1 px clear of the torso; sleeve 4–5 px long, then skin |
| Wristbands / gloves | 32–34 | 2 rows, white or team colour |
| Hands | 33–36 | 3 × 3 px skin with a 1-px shadow; fists |
| Pants | 32–40 | 13 px wide, 2 legs split by a 1-px notch at the crotch row |
| Socks (team colour) | 40–44 | each leg **3 px wide**, legs 5 px apart |
| Sock top / shoe | 44–48 | white 1–2 rows, then the shoe: 5–6 px long, 3 px tall, last row = sole |

Head : body ratio is about **1 : 1.5** (19 px of head over 29 px of body). The head is about 13 px wide (with ears),
against 22 px across the shoulder pads. Limbs never taper: arms and legs are straight 3-px columns. Builds vary by
shoulder width (big linemen get +2 px of pads and +1 px of arm), not by height.

**On field (NFL '27):** 16–18 px tall. The helmet is 5 × 4 px with a 1–2 px grey facemask bar at the front. The
torso and the white or coloured number block are 5–6 px. Legs are 2 px wide with a running stride, and the cleats
are 2 × 1 px black. **Classic on field (Fandom Washington set):** 16 px tall, 9 px wide, completely flat colour (one tone
per material). Its parts: a helmet with a 1-px logo dot (`#feb71c`), a 2-px grey facemask (`#9e9e9e`), a jersey with a
1-px sleeve stripe, white pants (`#d9d9d9`), socks (`#7f364c`) and black cleats.

**Mapping to our 64-row grid (`grid.ts`, ground at y = 59):** a full figure should be about **48–52 px tall**, with a
head of about 19–20 px and a face 12–13 px wide. Do not shrink the head below about 37 % of the figure.

## 3. Outline

- **Figures: none.** No outline on the silhouette, between arm and torso, or around the ball. Where an arm crosses
  the torso, the arm stays separate because its colour (skin or sleeve) differs from the jersey, or because the
  jersey shadow tone runs along the contact edge. There is no black line there.
- **Interior lines:** only material shadows (the jersey's dark chest band and hem row, pants folds). No black
  interior lines.
- **Helmet icons** (match-up 60 px helmets, 12-px leaderboard helmets): a **1-px pure black `#000000` outline**, plus a
  1-px black ground line under the big helmets.
- **Black is used deliberately**: hair `#0c0600` / `#110e0a`, pupils `#160b00` / `#0c1826`, beards `#0c1826`,
  Eagles/Jaguars black trim `#000000`.

## 4. Shading

| Material | Tones | Notes |
|---|---|---|
| Skin | **4** (highlight, base, shadow, dark) | Highlight = a **checker / "plus" cluster on the forehead centre**, 4–6 px. Shadow runs down both face edges, inside the ears, the neck sides and arm edges. Dark is for brows, nostrils, lip line and creases |
| Jersey | **2** (base, shadow) | Shadow on both side columns, a 2-row band under the collar / across the chest, and the hem row |
| Pants | **2** | Shadow as fold blocks: outer thighs, a crotch notch, knee blocks |
| Socks | 1–2 | |
| Shoes | 3 | white top `#ffffff`, upper `#bec6dd`, sole `#89a1ab` |
| Hair | 2–3 | two near-blacks in strands, plus a lighter scalp checker |
| Ball | 3 + laces | base `#743d42`, shadow `#512234`, one highlight `#de5c44`, 3 white lace pixels |
| Helmet icon | 3–4 + dither | base, shadow (lower back), highlight band (top front), checker dither between them, grey/silver for stripe and facemask |

Light comes from the front and slightly above. Highlights sit on the centre (forehead, crown of the hair), and
shadows sit on **both** sides. **No highlight on cloth.**

## 5. Faces

**Eyes:** `white | pupil` per eye, 1 row tall, with the pupils on the nose side. Light-eyed players get a blue iris
pixel (`#1a5fa0`-ish) instead of the black pupil. A centred look uses 3 px (`white pupil white`, for example Bouye on
HOF p1). Intense or angry looks drop the brow onto the eye row (no gap) and slant it 1 px down toward the nose (Jefferson on the
title art, Higgins on HOF p1).

**Brows:** 2 px long, 1 row, the darkest skin tone or hair colour, with a 1-row gap above the eyes.

**Nose:** no outline. Two nostril pixels in skin-dark, 3 px apart, 2 rows below the eyes. Some faces add a single
bridge pixel in skin-shadow.

**Mouths:**
- **Open grin** (most common on cards): a dark lip / moustache line (5–6 px), teeth `#ffffff` (4–5 px), then a
  magenta mouth `#ac5288` (lighter faces use `#f17a7c` / `#f6757a`). The corners turn up with 1 px of skin-dark.
- **Closed / neutral:** 2–3 px of lip colour (`#c16263` on tan, `#f17a7c` on light), one row.
- **Shout** (title Hurts): a tall open mouth, 3 rows of magenta and pink with white teeth on top.
- **Frown / pout:** 1 px of lip over 3 px of lip.

**Facial hair:** full beards are a solid block of near-black (`#0c1826` / `#160b00`) from ear to ear. The block is
2–3 px thick at the jaw and 4–5 px at the chin, and the open mouth is drawn *through* it. Goatees are 3–4 px under
the lip. Light-haired beards use 2 browns (Ewers: `#36200c`, `#503318`) with a 1-px checker. Moustaches merge into the
lip line.

**Ears and accessories:** ears are 1 px wide and 3–4 px tall, with an inner shadow pixel. Earrings and studs are
**1 silver-white pixel** (`#c0cbdc`). Chains are a 1-px dark row with a checker at the neckline.

**Skin tones** (exact samples; every face in the screenshots uses one of these five bases):

| Tone | Highlight | **Base** | Shadow | Dark (brows / nostrils / creases) | Lips / mouth |
|---|---|---|---|---|---|
| Light | `#e8c09e` | **`#eab39e`** | `#bb8f7e` / `#b5896c` | `#966143` | `#f17a7c` |
| Tan | `#d7ab7c` | **`#cf9064`** (also `#e2a589`) | `#a57350` | `#966143` | `#c16263` |
| Medium | `#c7936b` | **`#b36849`** | `#8f533a` / `#844c33` | `#503424` / `#5f3724` | `#ac5288` inside |
| Brown | `#9a6d57` | **`#885345`** | `#6d4237` | `#4f2f22` / `#5d3b34` | `#ac5288` inside |
| Deep | `#7c5a48` | **`#623c32`** | `#4e3028` | `#281d1a` / `#3a2219` | `#ac5288` inside |

On field, the NFL '27 sprites use the same family at lower detail (for example deep skin `#5d3324`, tan `#e2a589`).
The classic version used a single flat `#ba8857`.

**Hair** (sits on the skull, 2–3 px above it, covering the temples down to the ear top):

- **Short / fade / buzz:** a 1–2 row black cap, `#0c0600` with `#5f3724` at the hairline (St. Brown).
- **Bald:** skin to the top, with the forehead highlight moved up to the crown (Higgins).
- **Twists / short locs** (Daniels): spiky strands 1 px wide alternating `#0c0600` / `#1e1d1c`. They stand 2–3 px
  above the head and hang to the jaw on both sides. The parting shows skin on the forehead.
- **Long locs** (Bolton, Gibbs, Lamb): 1-px vertical strands in `#120e1f` / `#212121`, reaching the shoulders or
  chest and spreading 2–3 px past the face on each side. The scalp has a checker of hair and skin. Optional beads are
  1 px coloured (Lamb has green).
- **Braids / cornrows** (Jackson HOF): horizontal-ish rows with a checker pattern on top, and short ends at the nape.
- **Afro / curly top:** a rounded 3–4 px block with an irregular 1-px top edge.
- **Long straight / flowing** (Conklin, Bouye, Kmet): blond `#b8a060`-family hair with a 2-tone strand pattern,
  falling to the shoulders with a parting in the centre.
- **Headbands:** a 2-row band across the forehead, which covers the brows' top row. Barnes wears a navy `#313548`
  band with a team-colour centre pixel (`#175740`); Hurts on the title art wears a white band. Hair puffs out above it.
- **Beanies / durags:** a 3–4 row black cap with a 1-px logo pixel (Lock, Jets).

## 6. Helmets

- **Where they appear:** on field (side / three-quarter view, 5 × 4 px), as icons (schedule, leaderboard, match-up),
  carried or on the ground in celebrations. **Not on cards or portraits.**
- **Big match-up helmet** (nflrb27_iphone_06, about 60 × 40 UI px): profile facing **right**, with a 1-px black outline
  and a black ground line. The shell has 3 tones plus a checker dither (Seahawks: `#0d174b` / `#192b67` / dark
  `#090f32`). The logo spans about 45 % of the shell side, is fully detailed (Seahawks hawk with a green
  `#69bd28` eye), and sits on the upper half. The stripe or wing runs along the crown (a grey band). The ear hole is a
  grey ring `#9e9e9e` with a black centre, plus a jaw pad pixel group. The facemask is 2-px team-colour bars in a
  cage with black gaps, and the chin strap is a dark 1-px line.
- **Small icons** (12–16 px): an outlined shell, the logo as 2–4 px of colour, and a facemask of 1-px grey bars.
- **On-field sprite:** 1 logo pixel on the shell side, a 1–2 px grey facemask at the front, and no stripe unless the
  stripe colour is high-contrast (one 1-px row).

## 7. Uniforms

- The colour slots (from the in-game team editor, Fandom `Teameditor.png`) are **HELMET, LOGO, JERSEY, SLEEVE, PANTS,
  STRIPE, SOCKS1, SOCKS2**. Design every uniform with exactly these slots.
- **Jersey:** base plus shadow. The collar has 1 px of trim colour or white, with a white 1-px **chest pixel**
  (the NFL shield) under the collar.
- **Shoulder pads / sleeves:** a 2-px cap of white or trim colour on the shoulder top (Lions grey-white, Commanders
  white over gold, Eagles black). Sleeve stripes are 1-px rows.
- **Numbers:** see rule 8. Two digits take 9 px of width with a 1-px gap.
- **Pants:** team pants colour with 2-tone fold blocks. The pants stripe is a 1-px column on the outer thigh, when
  the team has one.
- **Socks:** team colour, 3 px wide, 4 rows, then 1–2 rows of white. Some teams have black knee bands (Ewers
  IMG_6210: black `#000000` rows above teal socks).
- **Cleats:** pale lavender `#bec6dd` with a `#89a1ab` sole on cards. Black `#000000` on the classic on-field sprite.
- **Gloves / wristbands:** white with one team-colour logo pixel (Lions). Wristbands are 2 rows of white.
- **Off-field outfit (HOF cards):** a gold blazer `#c2af1c` with fold shadow `#a3911a` (plus a dither), a white shirt
  collar `#ffffff` / `#d5d5d5`, a black tie `#1b1225`, and the hands at the sides with white cuffs.

## 8. Poses

All card and detail poses are **front-facing, feet planted and spread wide**, with the arms carrying the variation:

| Pose | Seen in | Notes |
|---|---|---|
| Idle, arms down | St. Brown (IMG_6207), Higgins | arms hang straight, 1 px off the torso, fists |
| Ball at hip | Barnes, Daniels, Ewers (6208–6210) | ball 6–7 px tall held vertically against the hip, partly covering the hand, laces facing out |
| Wave / salute | Warner (IMG_6206) | one arm raised straight up from the shoulder, palm open (fingers as 1-px bumps), wristband visible; head tilted, eyes to the side |
| Ball toss | Karras (Seahawks card) | ball floating above the hand with **white dotted motion pixels** below it |
| Flex / arms up | Oxley (Jets card), Hurts title | both forearms raised, elbows out |
| Ball in hand, cradle | Lock, Kmet cards | ball tucked under one arm or held at the side |
| Point / fist | title art | one arm across or forward |

**On field (side view, facing the direction of play):** running is a 2-px leg scissor with the back leg kicked up
and the arms pumping. The throw has the arm cocked back with the ball behind the helmet. A catch has both arms up.
A tackle or pile overlaps sprites with no outline, each kept readable by its team colours. **Celebrations** (cover
art): helmets off and on the ground, a fist in the air, a Gatorade-bucket dump, confetti as 2–3 px diagonal flecks.

## 9. Ground, shadow and backgrounds

- **Shadow:** an ellipse made of 3 stacked rectangles (about 26 / 30 / 22 px wide, 1 px tall each) centred under
  the feet. It is a translucent darkening of whatever is behind: `#173686` on menu blue, `#294897` on the classic
  `#2c68ff`, and darker greens on grass.
- **Menu blue:** `#1f49b2` (base) with `#1b3f99` / `#2353cc` watermark shapes, dithered "NFL shield" and "'27"
  tiles. Older and App Store builds use a brighter `#2c68ff` / `#2a63f2`.
- **Cards:**
  - Offense: diagonal 2-tone stripes `#57bcf0` / `#5cc8ff`.
  - Defense: `#f03c3c` / `#ff4040`.
  - Kicker / punter: `#d7570f` / `#e45c10`.
  - Newly inducted HOF: `#f0c418` / `#ffd019`.
  - Older HOF: a muted gold building backdrop, `#b29a3f` / `#d0b95e` / `#e1ca6f`.
  - Name plate: navy `#001b76` with `#1d3b8a` scan-line stripes. Card frame: white with a black 2-px drop shadow.
- **Grass:** `#377c08` / `#306c07` mowing stripes with darker speckles `#2b6106`, and lines `#fefefe` / `#cddec1`.

## 10. Colour palette (sampled)

| Use | Hex |
|---|---|
| Pure white (teeth, eye whites, numbers, socks) | `#ffffff` |
| Pale lavender (number stems, shoe upper) | `#bec6dd` |
| Shoe sole | `#89a1ab` |
| Pupils / near-black | `#160b00`, `#0c1826`, `#0c0600` |
| Hair blacks | `#0c0600`, `#110e0a`, `#120e1f`, `#1e1d1c`, `#212121`; greys `#2d2d2d`, `#545454` |
| Mouth interior | `#ac5288` (dark skin), `#b55088`; light-skin lips `#f17a7c`, `#f6757a`; tan lips `#c16263` |
| Earring / stud | `#c0cbdc` |
| Football | `#743d42`, `#512234`, highlight `#de5c44` |
| Helmet outline | `#000000` |
| 49ers | jersey `#aa0000` / `#8a0000`, pants `#b3995d` / `#967b3c` |
| Lions | jersey Honolulu blue (team hex `#0076b6`) + shadow; pants `#b0b7bc` / `#8e979d` |
| Commanders | `#5a1414` / `#390b0b`, gold `#f09f17` / `#c3800f`; classic `#651c32`, `#feb71c`, socks `#7f364c` |
| Jaguars / teal | `#006778` / `#01424d`, black trim `#000000`, gold dot |
| Jets | `#175740` / `#0f3628` |
| Seahawks | navy `#002244` / `#001223`, grey `#a5a9b0`, action green `#549719` (cards), `#69bd28` (field) |
| HOF blazer | `#c2af1c` / `#a3911a` |

Skin ramps are in section 5.

## 11. Do / Don't

**Do**
- Keep every figure outline-free, and separate overlapping parts with colour and the material's shadow tone.
- Make the head big (about 40 %) and expressive: a grin with teeth is the default card face.
- Draw each player's real hair or headband, beard and skin tone. The hair is what makes a sprite recognisable.
- Use the exact official team colours as bases, with one hand-picked shadow per colour.
- Use symmetric "rim" shading (both sides dark), a forehead highlight checker, and the white + pupil eyes.
- Use 1-px strokes for numbers, laces, earrings, sleeve stripes and fingers.
- Keep shoes and socks identical across teams (white top, lavender shoe, grey sole).
- Draw a flat translucent shadow under the feet, and nothing else.

**Don't**
- Don't draw a black or dark contour around the figure, ball or limbs (the game doesn't). Only helmet icons are
  outlined.
- Don't put helmets on card or portrait art.
- Don't use gradients, anti-aliasing, soft shadows, glows or more than 4 tones per material.
- Don't give eyes more than 1 row or more than 3 px, or draw a nose outline or a mouth wider than 6 px.
- Don't taper limbs or draw realistic anatomy: arms and legs are straight 3-px columns, and hands are 3 × 3 blobs.
- Don't put cloth highlights on jerseys, or pick team colours by eye.
- Don't add a background or vignette inside the sprite frame. Card backgrounds are separate, flat and patterned.
- Don't add motion blur. Use 1-px white dot trails or a pose change.

### Where the current code differs from the game

- **Helmets stay on in the normal poses.** The game draws card and detail sprites bare-headed (rule 3); the owner
  wants NFL-accurate helmets on the cards, so only celebrations and signatures take the helmet off. This is deliberate.
- **Card backdrop.** The game's cards are light, flat stripes (rule 12); ours keep the tier backgrounds (some near
  black), so the sprite card's backdrop is a lighter wash of the team colour (`art.css`, `.fut__art:has(> .ra--pixel)`)
  to keep outline-free dark kits readable.
- Resolved: no figure outline (`render.ts rim()` does the 2-tone edge shading; only helmet icons keep a black ring),
  the five skin ramps, 1-px eyes, 7-px solid numbers with `#bec6dd` stem rows, the chest band and hem row, one shoe
  for every team, the three-row shadow ellipse.

---

## 12. Reference index

### Owner screenshots (`/Users/saketh/Downloads/Retrobowl Uploads/`, NFL Retro Bowl '27, 2622 × 1206)

| File | Shows best |
|---|---|
| IMG_6200.PNG | HOF p1: gold blazer portraits. Long locs (Bolton, Gibbs, Lamb with beads), braids (Jackson), bald + beard (Higgins), headband + long hair (Bouye), light skin (Taylor); old vs new HOF card backgrounds |
| IMG_6201.PNG – IMG_6203.PNG | HOF p2–4: more hair and skin variety (Brandson locs, Russell, Woodrum) |
| IMG_6204.PNG | Jets roster: offense and defense card colours, durag/cap (Lock), long blond (Conklin), arms-up pose (Oxley), ball cradle |
| IMG_6205.PNG | Seahawks roster: kicker orange card, Karras ball toss with motion dots, Kmet light skin with blue eyes, Seahawks shoulders |
| **IMG_6206.PNG** | **Fred Warner detail sprite: wave pose, 49ers colours, full beard, twists, ball at side. Best single reference** |
| IMG_6207.PNG | St. Brown detail: idle stance, short hair, Lions colours, gloves, grin. **Proportion measurements in section 2 come from this one** |
| IMG_6208.PNG | Derrick Barnes detail: deep skin, headband, ball at hip |
| IMG_6209.PNG | Jayden Daniels detail: brown skin, twists, goatee, Commanders burgundy and gold |
| IMG_6210.PNG | Quinn Ewers detail: light skin, light-brown beard, teal and black, black knee bands |
| IMG_6211.PNG – IMG_6223.PNG | "Choose QB/WR/LB/DB/OL/RB" pages: about 140 card portraits across every team, skin tone and hair style. Best for variety |

### Zoomed crops made for this guide (`…/scratchpad/rb-refs/zoom/`)

Directory: `/private/tmp/claude-501/-Users-saketh-RetroVault/b4855ccb-e968-49e8-a0dc-cbb748be3f4e/scratchpad/rb-refs/zoom/`

| File | Shows |
|---|---|
| owner_6206_warner_wave_art16x.png … owner_6210_ewers_lightskin_beard_art16x.png | detail sprites resampled to **true art pixels**, ×16 |
| owner_6200_hof_heads_row1_12x.png, owner_6200_hof_heads_row2_12x.png | HOF heads ×12 (hair, earrings, chains) |
| owner_6204_jets_cards_10x.png, owner_6205_seahawks_cards_10x.png | card sprites at UI grid ×10 |
| nflrb27_iphone_01_title_lineup_10x.png | key art, front view (headbands, blue eyes, shout) |
| nflrb27_iphone_03_onfield_10x.png | on-field NFL '27 sprites, running |
| nflrb27_iphone_06_seahawks_helmet_zoom.png | match-up helmet (outline, logo, facemask) |
| fandom_washington_classic_onfield_zoom.png | classic flat on-field sprite, home vs away |
| fandom_cover_celebration_crop.png | celebration: helmets off, fists, Gatorade dump |

### Downloaded references (`…/scratchpad/rb-refs/`)

Each folder has a `SOURCES.tsv` with the exact source URL.

| File | Source | Shows |
|---|---|---|
| appstore/nflrb27_iphone_01.png | App Store, NFL Retro Bowl '27 (id 6476767864), mzstatic `…/2868x1320_01.png` | title key art: front-view lineup, real uniforms |
| appstore/nflrb27_iphone_03.png | same, `_03` | gameplay: on-field sprites, Commanders end zone |
| appstore/nflrb27_iphone_04.png | same | Ravens roster cards |
| appstore/nflrb27_iphone_05.png, appstore/nflrb27_iphone_07.png | same | gameplay with real logos at midfield |
| appstore/nflrb27_iphone_06.png | same | big match-up helmets, Seahawks vs Commanders, plus uniform previews |
| appstore/nflrb27_iphone_09.png | same | schedule helmets (Patriots, Colts, Chargers) |
| appstore/nflrb27_ipad_01.png – appstore/nflrb27_ipad_09.png | same (iPad, 2752 × 2064) | the same set at another aspect: Dolphins roster, Broncos/Browns helmets, Chiefs gameplay |
| appstore/rb_iphone_01.png – appstore/rb_iphone_08.png | App Store, Retro Bowl (id 1478902583) | classic unlicensed: gameplay, snow game, draft cards, "Caught!" |
| appstore/rbcollege_iphone_01.png – appstore/rbcollege_iphone_05.png | App Store, Retro Bowl College (id 1632904520) | college: yearbook suit portraits, gameplay |
| appstore/rbplus_iphone_01.png – appstore/rbplus_iphone_08.png | App Store, Retro Bowl+ (id 6446029554) | Retro Bowl '25 teaser, press interview cards |
| fandom/Washingtonhome.png, Washingtonaway.png, Washingtonalt.png, Washingtonrush.png | retro-bowl.fandom.com (static.wikia.nocookie.net) | classic on-field sprite in 4 uniforms (flat colour, no outline) |
| fandom/Cover.png | Fandom | celebration key art |
| fandom/SwRMqEkK.jpg | Fandom | enlarged classic sprite (helmet, crossed arms) |
| fandom/Teameditor.png | Fandom | uniform colour slots (HELMET … SOCKS2) |
| fandom/Roster.webp, fandom/Draft.webp, fandom/QB_Retro_Bowl.webp, fandom/Hero.jpg, fandom/Retro_bowl_run.gif, … | Fandom | classic roster cards, detail screen, gameplay |
| reddit/texans_uniform_lineup.jpeg | r/RetroBowl post 1pvyhof | 4 uniforms side by side (home / away / alt / rush) |
| reddit/celebration_excessive.jpeg, reddit/press_lb.png | r/RetroBowl posts 1e40ect, 1duxvn1 | classic card portraits |
| reddit/celebration_what_happened.jpeg | r/RetroBowl post 1eqtp7e | College gameplay, sideline sprites |
| reddit/player_card_view.jpg | r/RetroBowl post s4xmno | classic detail screen layout |

The press kit on newstargames.com has no downloadable screenshot pack, so App Store assets stand in for official
press images.
