# OVR formula

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

## Reference code

`ovr.py` in this folder reproduces every `score` and `ovr` value in `data/players.json`.
