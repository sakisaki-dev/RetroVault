# How Retro Bowl works (from its code)

Read from the game's own code: the regular Retro Bowl's web build (`RetroBowl.js`, v1.5.x, as shipped in the public
fan repo `jaxsonbunch/retro-bowl-modded`), not from guesses. The save itself is plain data; this page is the rules
the game applies to it. The owner plays **NFL Retro Bowl** (Apple Arcade), a sibling build by the same studio. Where
the league's own data can test a rule it is checked below; treat anything unchecked as "true in the regular game,
probably true in the NFL edition".

## Player record

Every player is one GameMaker map (77 fields in the sample save) with: name, position code, age, the four ratings
**speed, strength, skill, stamina** (1 to 10) and their ceilings **max_speed, max_strength, max_skill, max_stamina**
(potential), **attitude** (morale, 1 to 100), **condition** (fitness, 0 to 100), **xp / xp_level / skill_points**,
contract, salary, credit cost, signed year, team, **injury_week**, **resting**, **scouted**, appearance (skin, face),
the current game's, the season's and the career's stat lines, and, once won, **mvp, opoy, dpoy, roty, rings, hof**.

**Position codes:** 1 QB, 2 RB, 3 TE, 4 WR, 5 OL, 6 DL, 7 LB, 8 DB, 10 K, 11 P; staff 100 to 102. (The NFL edition splits
the secondary: 8 CB, 9 S; see Save format.)

## Hidden ratings

Nothing beyond those fields: there is no hidden clutch, consistency or "big game" rating. What isn't on the card:

- **Potential:** the `max_*` ceilings cap how far each rating can grow. They stay hidden until a player is scouted.
- **Attitude (morale):** at 45 or below a player won't sign an extension; at 15 or below he is toxic and can't be
  traded or signed. Playing him while his condition is under 40 costs 15 morale.
- **Condition:** fitness that drops with use and recovers with rest, reset to 90 to 100 every season.
- **XP:** earned by playing (more with better training facilities); each level gives a point to spend on a rating.

So when one 85 OVR player plays better than another, it's the mix of the four ratings (a fast low-skill receiver
and a slow sure-handed one play differently at the same OVR), his condition and morale on the day, and the dice.

## Development and aging (every season end)

- Every player gets a year older, one year comes off his contract and his condition resets to 90 to 100.
- **Improvement:** a rating goes up when *(age − 21)* is below a random number from 0 to 10, so a 22-year-old almost
  always improves and a 31-year-old almost never does.
- **Decline after 30:** stamina −1 every season, plus speed or strength −1 (a coin flip). QBs and kickers under 35
  always lose speed, never strength.

## Retirement

- A player retires once he is **older than his max age: 40 for QBs and kickers, 35 for everyone else** (staff 65).
- A player meeting can **delay retirement**: each delay adds a year to his max age and sets his contract to at least
  two years.
- Re-signing within three years of the max age gives a one-year contract.
- Rookies enter at **21**.

## Season ratings and awards

At the end of the season every player gets a season rating, worked out from his **season** line:

| Position | Rating |
|---|---|
| QB | min(150, (passing yds + 1.35 × rushing yds) ÷ 3,300 × 100) **+ passing TDs − INTs − 0.5 × sacks** |
| RB | min(150, (receiving yds + 1.35 × rushing yds) ÷ **1,750** × 100) **− 5 × fumbles + 1.25 × TDs** |
| TE | the same as RB with ÷ **1,350** |
| WR | the same as RB with ÷ **2,100** |
| DL, LB, DB | 0.5 × tackles + 3 × INTs + 3 × sacks + 3 × forced fumbles |
| OL | blocks (not eligible for awards) |
| K | (kicking distance ÷ 4,000 × 100, at most 100, + FG%) ÷ 2 (Rookie of the Year only) |

Only players above a minimum number of games count. Then:

- **MVP:** the highest offensive rating (QBs and skill players).
- **OPOY:** the next best **skill player**. A QB can never be OPOY.
- **DPOY:** the highest defensive rating.
- **Rookie of the Year:** the best rating among **21-year-olds**.

**Checked against the league (92 seasons, `data/y80/players.json`):** QBs have 62 MVPs and **0 OPOYs**, WRs 10 MVPs
and 49 OPOYs, RBs 1 MVP (Breece Hall, an early real-NFL player) and 12 OPOYs, TEs 0 and 2. That is exactly the shape
these rules give, so the NFL edition uses the same award logic.

### Why a running back almost never wins MVP

1. **The yardage part caps at 150 for everyone.** In this league a top QB and a top RB both hit the cap, so the award
   is decided by the bonuses after it.
2. **A QB's bonus is his passing TDs** (often 40 to 50 here) minus interceptions and half his sacks: about +35 to +45.
3. **An RB's bonus only counts the `touchdowns` stat, which for a running back is his receiving TDs**, not his
   rushing TDs. Rushing yards get a 1.35 boost, but **rushing touchdowns add nothing**. A back with 32 rushing TDs and
   3 receiving TDs gets +3.75, and **each fumble costs him 5**.
4. So an RB beats the MVP QB only in a season where the QBs are weak and he catches a lot of touchdowns without
   fumbling. Ryland Maxwell's 2,839-yard, 32-TD Y92 maxes the yardage part and still loses to any QB with a normal
   touchdown season.

A WR has the same handicap with no rushing boost, but receivers score receiving TDs, which do count, so WRs win MVP
far more often than RBs (10 to 1 here), and they take most of the OPOYs.

### One award per player per season

Each player is scored once and slotted into at most one season award:

- **MVP and OPOY always go to different players.**
- **A rookie (age 21) can only be Rookie of the Year**, never MVP or OPOY.
- Defenders can only win DPOY, kickers only rookie awards, and linemen nothing (the league has 0 OL awards of any kind).
- A season award stacks with a **ring** (every player on the Super Bowl roster) and **Super Bowl MVP**, a separate
  game award.

**Quirk:** when a later player overtakes the current MVP leader, the dethroned leader is not moved to OPOY, so the OPOY
can be the third- or fourth-best player while the real runner-up gets nothing.

### What else the league's data shows

- **Every DPOY is a DB** (20 of 20). DBs get the interceptions and lots of tackles; winners average about 10.5
  tackles a game, double everyone else. The top career tacklers (Settle, Stidham, Hobbs) have none.
- **QBs last about five seasons longer**, matching the 40 against 35 retirement age: Wayne Wilson 431 games, against
  McCoy 326 (RB), Godwin 324 (WR), Suh 298 (LB), Stidham 282 (DB).
- **Tight ends have the lowest yardage bar** (2,025 yards caps them, against 2,625 for an RB and 3,150 for a WR); none
  has won MVP only because none gets the targets.
- **An interception costs a QB as much as a touchdown earns**; a sack costs half.

### The bar an RB must clear (Y81 to Y92)

The best non-RB rating each season, from the season lines (the change in career totals between end-of-season market
snapshots), against the best RB:

| Season | Bar | Best RB |
|---|---|---|
| Y81 | 180 (Ty Lock) | 117 (Jensen) |
| Y82 | 193 (Ty Lock) | 124 (Maxwell) |
| Y83 | 162 (Vyncint Heath, WR) | 151 (Maxwell) |
| Y84 | 157 (Solomon Toohill) | **155 (Maxwell, 2 short)** |
| Y85 | 169 (Tillery) | 151 (Maxwell) |
| Y86 | 184 (Larienne) | 156 (Maxwell) |
| Y87 | 180 (Toohill) | 158 (Maxwell) |
| Y88 | 182 (Toohill) | 129 (Spector) |
| Y89 | 195 (Crawford, 72 TD) | 146 (Ekuale) |
| Y90 | 188 (Crawford) | 130 (Mosley) |
| Y91 | 191 (Crawford) | 155 (Maxwell) |
| Y92 | 193 (Friend) | 164 (Maxwell) |

Median bar 183. **An MVP season for an RB here:** 1,800 rushing and 400 receiving yards (caps the yardage part at
150), **30 receiving TDs** (+37.5) and 0 fumbles, a rating of about 188; about 36 receiving TDs against a 72-TD QB year,
8 to 10 in a weak QB year. The league's best backs catch 0 to 11 receiving TDs a season.

### Where the NFL edition differs

- **Rookie awards:** the regular game has one Rookie of the Year, and defenders aren't eligible; the league has 15 DB
  and 6 DL rookie awards and the owner says "OROY and DROY exist", so the NFL edition added a defensive one.
- About 2,000 real NFL players at the start, licensed teams, a "Player Development" option (lower ratings, higher
  potential) and a fix for "Longest" stats (App Store notes). The MVP, OPOY and DPOY logic matches the league's history.

## How to play with it

- **RB MVP:** run him for the yardage but throw his touchdowns, and protect the ball (each fumble costs 5).
- **The easiest MVP route is a tight end** with heavy targets and receiving TDs.
- **DPOY:** interceptions, sacks and forced fumbles are worth 6 tackles each; DBs win it.
- **Build around 22 to 26:** players improve almost every year early and rarely after 30; from 31 stamina and speed
  or strength drop every year, so a star is worth most in a trade around 30.
- **Retirement:** after 35 (QBs and kickers after 40); each "delay retirement" meeting buys a year.
- **Morale:** don't play anyone under about 40 condition (costs 15 morale); at 45 or below he won't re-sign.

## Assets, sprites and mods

- **Sprites:** the web build's art is two texture atlases (`RetroBowl_texture_0.png` 2048 × 2048 and `_1` 2048 × 512):
  every field (normal, worn, snow), fonts, UI, faces and the player sprites. Players are drawn in placeholder green
  and magenta and recoloured at runtime into each club's kit from `uniforms_default.txt`, so one drawing serves 32
  uniforms. Cutting the atlas into single sprites needs the frame table inside `RetroBowl.js`; desktop and Android
  builds pack the same into `data.win` / `game.droid`, which UndertaleModTool opens.
- **Data files** (tab-separated text): `Teams.txt` (32 clubs, colours, conference, ratings, rain, snow, roof),
  `uniforms_default.txt` (home, away, alternate kits), `Schedule17.txt`, `PlayerRecords.txt` (the record board's
  categories, single-game ones included), `Achievements.txt`, name lists, `LanguageUS.txt` (every on-screen text).
- **Mods:** save edits (credits, salary cap) through the browser's local storage; data-file edits (names, kits,
  schedule); and code hooks: modded builds wrap the engine's per-frame function (one multiplies the ball-carrier's
  speed every frame).
- **Ownership:** all of this art and code is New Star Games' (the NFL edition adds NFL and NFLPA licensed marks).
  Fine to study locally; never ship it on Retro Vault's public site, whose sprites and card art are its own.

## Save format (NFL Retro Bowl, read by scripts/save_read.py)

Verified on the owner's save pulled 2026-11-13 (`data/saves/2026-11-13/nfl/Documents/`, git-ignored), slot 4: Y93 week
16, the Eagles (`myteam_id` 18), 1,434 players in the pool.

**Files.** `rb_nfl_savedata_<slot>.json` is one career (slots 4, 5, 6 here: Y93, Y20, Y1); `backup_*` are the game's
own copies, `_info_<slot>` a 99-byte summary (`year`, `week`, `myteam_id`), `_ffl_*` another mode. Each save is plain
JSON (GameMaker maps: every number is a float). Top level: `players.pool`, `teams.list`, `history.list`,
`history_bowls.list`, `records.list`, `schedule.list`, `playoffs.list`, `settings`, plus news, badges, achievements,
coaches and leaderboard caches.

**Settings.** `year` is the season (93 = Y93), `week` the next week to play (16 = weeks 1 to 15 played), `start_year`
2025 (calendar years in the save are `start_year + Y`), `myteam_id`, `salary_cap`, `fans`, `coach_rating`,
`facility_rehab` / `_stadium` / `_training`, coach and staff names.

**Players.** `fname`, `lname`, `position`, `teamid`, `age`, `speed` / `strength` / `skill` / `stamina` and their
`max_*` ceilings, `condition`, `attitude` (morale), `contract` (1 to 3), `salary`, `injury_week`, `delay_retirement`,
`xp`, `xp_level`, `xp_dev`, `skill_points`, `number`, `dob`, `rookie_year`, `teamid_orig`, `team_leave_reason`
(`retired`, `cut` or empty), `hof` / `hof_candidate`, appearance, and four stat blocks: `sta_c` career, `sta_s` season,
`sta_g` last game, `sta_r` the imported real-life 2024 line (`year` 2024). Facts that matter for reading it:

- **Position codes in the NFL edition:** 1 QB, 2 RB, 3 TE, 4 WR, 5 OL, 6 DL, 7 LB, **8 CB, 9 S** (the safeties: Hamlin,
  Poyer, Peppers are 9), 10 K. Retro Vault's DB covers 8 and 9; it has no kickers.
- **`uid` is not unique** (1,118 distinct over 1,434 players: generated players reuse ids). Match on name + position.
- **Who is playing:** `teamid >= 0` and `age <= max age + delay_retirement`, max age 40 for QB/K/P and 35 for everyone
  else. 321 players are playing (about 10 a club, 31 of them kickers). `teamid -1` (54) is the free agent / draft pool;
  `teamid -4` (408) are the imported real NFL players long gone (ages 110 to 128); a retiree **keeps the `teamid` of
  his last club** and keeps ageing.
- **`sta_s` is not reset for players who stop playing:** a retiree's `sta_s` is still his last season (Sherman
  Brandson, retired, still shows 6 games), so his career is `sta_c` as it stands. For a player still playing, the
  career through the last completed season is `sta_c − sta_s`.

**Stat mapping** (Retro Vault career key = save path in `sta_c` / `sta_s`). The game reuses fields by position:

| Position | Mapping |
|---|---|
| QB | g `games`, att `att.no`, cmp `cmp.no`, yds `pass.yds`, td `td`, int `int.by`, sck `sack.by` (sacks taken), ratt `rush.att`, ryds `rush.yds`, rtd `rush.td` |
| RB | g `games`, ratt `rush.att`, ryds `rush.yds`, rtd `rush.td`, fum `fum`, rec `att.no` (catches), recyds `pass.yds`, rectd `td` |
| WR, TE | g `games`, rec `att.no`, yds `pass.yds`, td `td`, fum `fum` |
| OL | g `games`, blk `tck` |
| LB, DB, DL | g `games`, tkl `tck`, int `int.by`, sck `sack.by`, ff **`fum`** |
| all | rings, mvp, opoy, dpoy, roty, sbmvp: the same names in `sta_c` (career only; `sta_s` has none) |

- A defender's `fum` is what Retro Vault calls ff (the card's fumble column: recoveries, "nobody recovered more fumbles
  than Van Oxley"). The save's own `ff` is only non-zero in the imported 2024 real-life lines (Fred Warner 16, Von
  Miller 30); the game never adds to it.
- The `rec` block (`rec.no`, `rec.yds`) stays 0 for league players; receiving lives in `att.no` / `pass.yds` / `td`.
- Longest plays (`*.lng`) are career maxima, not sums: `sta_c − sta_s` doesn't give an earlier season's value.
- **Rounding:** yards are floats; the game shows them **rounded half to even** (Python `round()`). Over the matched
  players 28 fractional totals only match rounding (none only flooring), and the one exact half, Maurice Vigil's
  15,482.5 rushing yards, shows as 15,482.

**Check against Retro Vault** (`npm run -s save:check`, Y92 careers vs the save in Y93 week 16): 319 of 471 league
players matched (the other 152 are long retired: the game drops them from the pool); 300 agree on every field and 3,634
of 3,693 fields agree. Every one of the 19 that differ is retired, and most are the imported real-life players (Lamar
Jackson, Ja'Marr Chase, CeeDee Lamb, Jahmyr Gibbs, Breece Hall, Drake Maye, Jayden Daniels) or veterans whose last
transcription predates their last seasons (Alexx Sanchez, Aubrey Jewell, Shemar Wood, Rob Lowe, Jakeem Friend, Wayne
Wilson), plus a few single awards (God Johnson and Alohi Godwin one more OPOY each, Pharoah Hunter and Aubrey Jewell
no ROTY in the save). 18 playing players are new (17 Y93 rookies and Ketner Tauaefa); 31 kickers aren't tracked.
Super Bowls and coach seasons agree for all 92 seasons except two the screens never captured (Y67 and Y85 scores,
the Y67 opponent), which the save fills in; the record board adds two marks Retro Vault missed (Longest pass (air) 31
yds, Rahman Y90; Best rushing season 2,839 yds, Maxwell Y92).

**Other lists.** `history.list`: the coach's seasons (`year` as Y, club `name` / `tla`, regular-season `wins` /
`losses` / `ties`, playoff `wins_po` / `losses_po`, `finish` exactly as Retro Vault's coach.json). `history_bowls.list`:
every Super Bowl (`year` = start_year + Y, `winner` club name, `loser` TLA, `result` "30-21", `human` 1 won, −1 lost, 0
not in it). `records.list`: the 50-row record board (46 player records, `tag` ui_*, float `stat`, `stat_text` "y" for
yards, `qbname` the holder or the passer, `playername` the receiver or runner on a play record, `team`, `year`; plus 4
coach records with `coachstat` 1: most points, biggest win and loss, most TDs). `schedule.list`: the current season
only, 272 games (18 weeks, byes), `home_team` / `away_team` club uids, scores (−1 unplayed), `human_result` win / loss
/ unplayed for the coach's games; its `year` field is not the season (9 for every row). `teams.list`: 32 clubs (uid 0
to 31) with `name`, `longname`, `tla`, colours, conference and division, `offense` / `defense` ratings and this
season's `wins` / `losses` / `ties`. `playoffs.list` is empty mid-season.

## Using this in Retro Vault

- With the save, ages are exact: retirement becomes a countdown (a 34-year-old RB has one season left unless he
  delays).
- The season rating above can be computed for every player each season, explaining (or contesting) every award. That
  is material for Hot Takes, all from data.
- Ideas, by what they need. **Now:** an Award Race (every season's ratings, winner, runner-up, margin, the robbed),
  position facts for Did you know and The Wire, and a rating breakdown on the player page. **With the save:** a
  retirement clock from real ages, true potential bars from the hidden ceilings, development and decline curves, a
  real injury report with morale and condition, and the 47 single-game records.
- Retro Vault's own OVR, Career Legacy and Hall of Fame are its own rules (docs/STATS_REFERENCE.md), not the game's.
