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

**Position codes:** 1 QB, 2 RB, 3 TE, 4 WR, 5 OL, 6 DL, 7 LB, 8 DB, 10 K, 11 P; staff 100 to 102.

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

## Using this in Retro Vault

- With the save, ages are exact: retirement becomes a countdown (a 34-year-old RB has one season left unless he
  delays).
- The season rating above can be computed for every player each season, explaining (or contesting) every award. That
  is material for Hot Takes, all from data.
- Retro Vault's own OVR, Career Legacy and Hall of Fame are its own rules (docs/STATS_REFERENCE.md), not the game's.
