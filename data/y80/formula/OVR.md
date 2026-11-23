# OVR formula

> **Two ratings (owner, 2026-11-23).** **CAR** is the career OVR described below (whole career, ranked within position among
> every player, active and retired). **SZN** is a season OVR: the same League Score and curve on ONE season's line, ranked
> within position among the players who played that season (see "Season OVR" at the end). Active players show SZN first
> and CAR beside it; a retired player shows CAR only (his past seasons' SZN stay in the career graphs).

OVR (62–99) is the main rating in the arcade and the data. It is built in two steps: a **League Score** from career production plus awards, then a **percentile within the player's position**.

## Step 1 — League Score

`score = production + awards`, rounded to a whole number. Missing stats count as 0.

### Awards (all positions)

| Award | Points |
|---|---|
| Ring | 40 |
| MVP | 90 |
| OPOY | 45 |
| DPOY | 90 |
| Super Bowl MVP | 40 |
| ROTY | 10 |

An MVP is worth more than a ring on purpose: rings measure the team, MVPs measure the player.

### Production by position

| Pos | Production |
|---|---|
| QB | pass yds / 80 + 0.9 × pass TD + 0.9 × rush TD − 0.6 × INT |
| RB | rush yds / 18 + 2.2 × rush TD + rec yds / 30 + 2.2 × rec TD − 0.8 × fumbles |
| WR | rec yds / 14 + 2.5 × TD − fumbles |
| TE | rec yds / 8 + 3 × TD − fumbles |
| OL | 5 × blocks + 2 × games |
| LB, DB, DL | 0.7 × tackles + 12 × INT + 14 × sacks + 14 × forced fumbles |

If a WR or TE has no TD total, TD is estimated as rec yds / 95.

## Step 2 — OVR

Within each position, sort players by League Score from lowest to highest. For the player at index `i` (0 = lowest) out of `n`:

```
pct = i / (n − 1)
OVR = round(62 + 37 × pct ^ 0.85)
```

So the best player at every position is 99, the lowest is 62, and the 0.85 exponent spreads out the top of the curve. OVR is relative: adding players to a position moves everyone's OVR at that position.

## How the games use it

- **Blind Rank and Keep 3, Cut 3** rank by OVR, with League Score breaking ties. This makes mixed-position rounds fair.
- **Can you go 18–0?** Team OVR is a weighted average of the nine starters: QB ×3, RB ×1.3, WR1 ×1.3, WR2 ×1.1, DB ×1, TE/OL/LB/DL ×0.9. Each game's win chance is `1 / (1 + e^(−(teamOVR − oppOVR) / 4.5))`, with +1 to the opponent on the road.

## Season OVR (SZN)

Rule over the data, no AI: `scripts/season_ovr.py` (the Python twin; the site reads its output, so there is one
implementation), run by `npm run rebuild` right after the league data and before the market snapshot.

- **Season line**: the change in career totals between two consecutive season-end market snapshots (the `s` totals); the
  latest completed season is rated from the CSV against the last snapshot before it. The season in progress (save_state.json's
  season after the latest completed one) is the save's own `season` stats, no awards yet. Awards count only when won that
  season (deltas of rings, MVP, OPOY/DPOY, SB MVP). ROTY and fumbles are not in the snapshots' totals, so a season line
  leaves them out. A player whose games did not rise, or rose by more than 21 (several seasons added at once), has no
  line: no SZN that season (the site shows CAR).
- **League Score** on the line with the same weights as above.
- **Small samples** shrink toward the position's mean line: `adj = mean + (score - mean) * min(1, games / 17)`.
- **SZN** = `round(62 + 37 * pct ** 0.85)` ranked by `adj` within position among the players who played that season.
- Output: `public/data/league/season_ovr.json` (the current season's SZN, `lines` = his season stats for the Deep Dive's
  "This season" skill grades) and a `sovr` per player per season-end in `career_seasons.json` (the career graphs' OVR
  series, labelled Season OVR). `market_history.json`'s stored `ovr` is untouched (it stays CAR; stories cite it).
- **Card price**: an active player's value reads `0.8 * CAR + 0.2 * SZN` (`priceRating` in `src/utils/cardMarket.ts`);
  retired, or no season line: CAR alone. A market point carries the new `szn` field beside `ovr`.
- **Arcade**: the games rank by CAR (everyone, legends included) by default; `useGamePlayers(includeLegends, 'szn')` is the
  this-season mode (SZN, active players who played it only).

## Reference code

`ovr.py` in this folder reproduces every CAR `score` and `ovr` value in `data/players.json` (the career formula; the season rating is `scripts/season_ovr.py`).
