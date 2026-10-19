# RetroVault — Stats Reference (Single Source of Truth)

Everything statistical the app ingests, derives, ranks, or labels, in one place.
Line refs are as of commit `ace4cb4`. When code and this doc disagree, one of them is a bug.

---

## 1. Raw inputs (from the league spreadsheet CSV)

The CSV has one section per position. The first cell of a row is the position (`QB`, `RB`, …), the next row is the header, then player rows. Parsed in `src/utils/csvParser.ts`.

### 1.1 Fields every player has

| Field | CSV header | Notes |
|---|---|---|
| name | Name | Trimmed. The identity key is `POSITION:Name`. |
| status | Status | `Active` or anything else → `Retired` |
| age | Age | Display only. The seed CSV has no Age column. |
| team | Team | Free text. The seed CSV has no Team column. |
| games | Games | |
| rings | Rings | |
| mvp | MVP | |
| opoy | OPOY / DPOY | **DPOY is stored in `opoy` for LB/DB/DL** |
| sbmvp | SBMVP | |
| roty | ROTY | |
| trueTalent | True Talent | Per-position sheet formula (§1.4). Rescaled per position in-app (§2.2); the original is kept as `rawTrueTalent`. |
| dominance | Dominance | Derivable, see §2 |
| careerLegacy | Career Legacy | Derivable, see §2 |
| tpg | TPG | Derivable, see §2 |
| nickname | Nicknames | |

### 1.2 Stats by position (all CAREER totals)

| Pos | Fields (CSV header → field) |
|---|---|
| QB | Att(1st) → attempts, Cmp → completions, Pass Yds → passYds, Pass TD → passTD, INT → interceptions, Sacks → sacks, Att(2nd) → rushAtt, Rush Yds → rushYds, Rush TD → rushTD |
| RB | Rush Att, Rush Yds, Rush TD, Fum → fumbles, Rec → receptions, Rec Yds, Rec TD |
| WR / TE | Rec → receptions, Rec Yds, TDs/Rec TD → recTD, Fumbles, Longest (career max, not additive) |
| OL | Blocks |
| LB / DB / DL | Tackles, INT, Sacks, FF → forcedFumbles |

### 1.3 Known parser issue
- When a metric header is missing, `csvParser.ts` falls back to fixed column indices 20–23 and 25. Those indices assume a layout **with** Age and Team columns.
- In `public/data/initial-data.csv` (no Age/Team), only the QB section labels its metric columns. They actually sit at 18–21, with nickname at 23.
- Result for every non-QB player in the seed file:
  - True Talent gets the Career Legacy value.
  - Dominance gets the TPG value.
  - Career Legacy and TPG become 0.
  - Nicknames are lost.

---

### 1.4 True Talent formulas (exact on every row of the Y80 sheet)
`scripts/build_league_data.py` recomputes True Talent from stats with these, so screenshot corrections flow through.

| Pos | True Talent |
|---|---|
| QB | 0.0016·PassYds + 0.4·PassTD − 0.25·INT − 0.12·Sacks + 0.006·RushYds + 1.5·RushTD + 40·(PassYds/Att) + 45·(Cmp/Att) + 20·(PassTD/INT) |
| RB | 0.027·(RushYds + RecYds) + 1.35·(RushTD + RecTD − Fumbles) + 0.18·Games |
| WR | 0.25·Rec + 0.015·RecYds + RecTD − 1.5·Fumbles + 0.05·Longest + 0.125·Games |
| TE | 0.056·RecYds + 1.47·RecTD − 3.5·Fumbles + 0.07·Longest + 0.035·Games + 28·(RecYds/Rec) |
| OL | 2.85·Blocks + 0.285·Games |
| LB | 0.4·Tackles + 10·(INT + Sacks + FF) + 0.0049·Games |
| DB | 0.1512·Tackles + 12.6·INT + 2.5241·Sacks + 3.78·FF + 0.0126·Games |
| DL | 0.55·Tackles + 5.5·Sacks + 2.75·FF + 0.11·Games |

QBs whose screenshots lack Att/Cmp/INT/Sacks get those inputs estimated, either by carrying rates forward from their older sheet row or from league medians (YPA 6.16, Cmp% 64.7, TD/INT 5.82, 0.18 sacks/game). The build script prints which players were estimated.

## 2. Derived metrics and position normalization (`src/config/stats.ts`)

### 2.1 Formulas (reverse-engineered from the league sheet)

```
Dominance     = 0.7·TT + 60·Rings + 50·MVP + 30·OPOY + 40·SBMVP          (offense: QB/RB/WR/TE/OL)
Dominance     = 0.7·TT + 60·Rings + 50·MVP + 120·DPOY + 40·SBMVP         (defense: LB/DB/DL; DPOY is stored in `opoy`)
Career Legacy = 4·TT + 4·Dominance + 2·Games
TPG           = TT / (Games + 50)                                         (ROTY = 0 everywhere)
```

Award weights live in `AWARD_POINTS`. DPOY = 120 matches the current (Y80) league sheet on 99/102 rows; the older seed sheet used 30.
The parser (`withDerivedMetrics`) only fills blanks; the values shown in the app are always recomputed by normalization (§2.2).

### 2.2 Position normalization (`normalizeLeague`)

The sheet's per-position True Talent formulas are not on a common scale: defenders rate far lower
(top-3 average raw TT in the Y80 league: QB 1160, RB 1022, WR 1251, TE 993, OL 952, **LB 693, DB 845, DL 762**).
On every load/upload `LeagueContext` refits a per-position multiplier from the current data:

```
benchmark(pos) = mean of the top-N raw TT at pos     (N = NORMALIZATION_BENCHMARK_TOP_N = 3; fewer if the position has < N players)
reference      = mean of all position benchmarks
factor(pos)    = reference / benchmark(pos)
TT (adjusted)  = raw TT × factor(pos)
```

- Then Dominance, Career Legacy and TPG are **always** recomputed from the adjusted TT (using the formulas in §2.1), overriding sheet and manual values so every metric is consistent.
- Each player keeps `rawTrueTalent` (sheet / edited value) and `positionFactor`. `trueTalent` is the adjusted value everywhere in the UI.
- Player edits from IndexedDB are merged **before** normalization, and their TT is treated as raw. Editors should therefore pre-fill and save `rawTrueTalent` (`getRawTrueTalent(p)`), not the adjusted `trueTalent`.
- Players with `isRealLegend` and players with TT ≤ 0 don't count toward benchmarks. Legends get the same factors but are removed from `careerData` and exposed separately as `legends` in `useLeague()`, so league stats exclude them.
- `POSITION_NORMALIZATION_ENABLED = false` switches it off (sheet values pass through unchanged).
- `normalizeLeague` is pure and idempotent: it always starts from `rawTrueTalent` when present.

Y80 league factors: QB 0.82, RB 0.93, WR 0.82, TE 0.93, OL 1.06, LB 1.30, DB 1.12, DL 1.24.

## 3. Tier systems (currently three conflicting sets; consolidate)

### 3.1 Metric color tiers (`utils/metricColors.ts`)

A value at or above the threshold gets that tier; anything under Average is Below Avg.

| Metric | Legendary | GOAT | Elite | Very Good | Average |
|---|---|---|---|---|---|
| True Talent | 1000 | 900 | 750 | 650 | 500 |
| Dominance | 1200 | 1000 | 850 | 750 | 600 |
| Career Legacy (labels: Legendary / Elite / Great / Hall of Fame / Average) | 10000 | 8500 | 7500 | 7000 | 5000 |
| TPG | 5 | 4.5 | 4 | 3 | 2 |

### 3.2 Hall of Fame (`HOF_THRESHOLD`, `LEGACY_TIERS` in `src/config/stats.ts`)
- Induction: Career Legacy ≥ **7000**. Active players are included. Career Legacy here is the **normalized** value (§2.2).
- Tiers:
  - Legendary ≥ 10000
  - Elite ≥ 8500
  - Great ≥ 7500
  - Inductee ≥ 7000
- The thresholds were set against raw values and kept after normalization. On the Y80 sheet (97 players), normalization takes the HOF from 31 inductees (QB 13, RB 3, WR 6, TE 4, OL 2, LB 1, DB 1, DL 1) to 23 (QB 7, RB 2, WR 4, TE 2, OL 2, LB 2, DB 2, DL 2). The reference is the mean benchmark, so the overall scale barely moves (median CL 5575 → 5670; p90 9195 → 8658).

### 3.3 Commentary (`CommentaryTab.tsx`)
- HOF ≥ **8000** and Legendary ≥ **12000**. Both conflict with §3.2.
- Veteran: active and games ≥ 128.
- Rookie: active and 0 < games ≤ 16.
- Next Generation: active, games < 48 and TPG ≥ 2.5.
- Underperformer: active, TT ≥ 700, 0 rings and 0 MVP.
- Multi-award: MVP + OPOY + SBMVP + ROTY ≥ 3.
- Efficiency King: TPG ≥ 2.5.
- Elite league: ≥ 5 legendary players.

### 3.4 Other definitions in use
- "Rookie" (seasonDiff): games ≤ 21.
- "Rising Star" (LeagueOverview): highest TPG among active players.

**Proposal:** one `LEGACY_TIERS` table plus `getLegacyTier()` and `isHallOfFamer()` (§7).

---

## 4. Career leaderboards and records (CAREER data, keep)

### 4.1 Records tab: career top-N (`findTopN`, top 5, 3 shown)
- **QB:**
  - Pass Yds
  - Pass TD
  - Yds/Att
  - TD/INT (bug: returns raw TD when INT = 0)
  - Total TD (Pass + Rush)
  - Total Yds (computed, never shown)
- **RB:**
  - Rush Yds
  - Rush TD
  - Yds/Carry
  - Scrimmage Yds
  - Scrimmage Yds/Game
- **WR:**
  - Rec Yds
  - Rec TD
  - Yds/Rec
  - TD per 16 games
- **TE:** Rec Yds, Rec TD
- **DEF (LB + DB + DL):**
  - Tackles
  - Sacks
  - INT
  - Turnovers (INT + FF)
  - Tackles/Game
- **All players:** Rings, MVP, Career Legacy, Dominance

Rate stats have **no minimum sample** here, so a one-game player can top them.

### 4.2 Advanced metrics (single leader, strict `>` minimums)

| Metric | Formula | Minimum |
|---|---|---|
| Yds/Att | passYds / att | att > 200 |
| TD/INT | passTD / INT | INT > 0 |
| Comp % | cmp / att × 100 | att > 200 |
| Yds/Carry | rushYds / rushAtt | rushAtt > 100 |
| Scrimmage/G | (rush + rec yds) / G | G > 16 |
| Yds/Catch | recYds / rec | rec > 50 |
| Rec Yds/G | recYds / G | G > 16 |
| Sacks/G | sacks / G | G > 32 |
| Turnovers/G | (INT + FF) / G | G > 32 |

### 4.3 Pace to record (career)
- Record holders: QB pass yards, RB rush yards and WR rec yards only.
- Eligible: active players with ≥ 16 games.
- `pace = stat / G × 16`
- `seasonsToBreak = ceil((record − current) / pace)`; a player is shown only if this is ≤ 5.

### 4.4 Other career views
- **Team rankings:** sort by Σ Career Legacy. Display: Σ rings, Σ MVP, average legacy, top player. Players with no team go into an "Unknown" team.
- **League Overview:**
  - Greatest Legacy (max CL)
  - Rising Star (max TPG among active players)
  - Most Successful Team (Σ CL; players with no team skipped)
  - Total / active / retired counts
- **Comparison:**
  - Common rows: Games, CL, TT, Dom, TPG, Rings, MVP, SBMVP.
  - Position rows: QB INT is lower-is-better.
  - Winner = the player who wins the most rows.

---

## 4A. Advanced metrics (Analytics Lab, `src/config/advanced.ts`)

The Stats page centerpiece. Pure functions over **career totals** (no per-season data); league players only (real-life legends excluded). Every metric has a one-line `definition` (shown on hover/focus in the UI) and an inclusive (`>=`) minimum sample (`ADV_MIN`: 200 att, 100 touches, 50 rec, 16 G, 32 G for defense). Players below a minimum get no value and never enter a position average or percentile.

| Metric (`id`) | Positions | Formula | Minimum |
|---|---|---|---|
| Passer Rating (`passerRating`) | QB | Official NFL: a = (Cmp/Att − 0.3)·5, b = (Y/A − 3)·0.25, c = TD/Att·20, d = 2.375 − INT/Att·25, each clamped 0–2.375; (a+b+c+d)/6·100 | 200 att |
| AY/A (`ayPerAtt`) | QB | (passYds + 20·TD − 45·INT) / att. ANY/A's sack-yards term is omitted: the sheet has sack counts but no sack yards | 200 att |
| TD% (`tdPct`) | QB | passTD / att · 100 | 200 att |
| INT% (`intPct`) | QB | INT / att · 100 (lower is better) | 200 att |
| Rush Share (`rushShare`) | QB | rushYds / (passYds + rushYds) · 100. Style marker, kept out of the + index grid | 200 att |
| Scrimmage Yds/G (`scrimPerGame`) | RB WR TE | (rushYds + recYds) / G | 16 G |
| Yards/Touch (`ydsPerTouch`) | RB | (rushYds + recYds) / (rushAtt + rec) | 100 touches |
| Total TD/16 (`tdPer16`) | RB WR TE | (rushTD + recTD) / G · 16 | 16 G |
| Fumble Rate (`fumbleRate`) | RB WR TE | fumbles / touches · 100; touches = carries + rec (RB) or rec (WR/TE). Lower is better | 100 touches (RB) / 50 rec |
| Impact Plays/G (`impactPerGame`) | LB DB DL | (sacks + INT + FF) / G | 32 G |
| Takeaways/16 (`takeawaysPer16`) | LB DB DL | (INT + FF) / G · 16 | 32 G |
| Tackles/G (`tacklesPerGame`) | LB DB DL | tackles / G | 32 G |
| Blocks/G (`blocksPerGame`) | OL | blocks / G | 16 G |
| League Score/G (`scorePerGame`) | all | `leagueScore` (config/ovr.ts, production + awards) / G | 16 G |
| VOR (`vor`) | all | League Score − replacement, replacement = 20th percentile (linear interpolation) of League Score at the position (`REPLACEMENT_PERCENTILE`) | 1 G |
| VOR/16 (`vorPer16`) | all | VOR / G · 16 | 16 G |
| Award Points/100 G (`awardRate`) | all | (60·rings + 50·MVP + 30·OPOY or 120·DPOY + 40·SB MVP) / G · 100 (`AWARD_POINTS`, the Dominance weights) | 16 G |

**Position-relative views**
- **+ index** (`plusIndex`): 100 = mean of the position's qualifiers. Higher-is-better: 100 · value / avg (like OPS+). Lower-is-better: 100 · avg / value (like ERA+). Capped at 300 (`PLUS_CAP`; a zero-INT sample gets 300). Not computed for VOR / VOR/16 (centered near zero).
- **Percentile**: mid-rank among the position's qualifiers, best = 100, worst = 0, ties share a value; inverted for lower-is-better.
- **Headline stat per position** (`HEADLINE_METRIC`, sorts the grid): QB Passer Rating; RB/WR/TE Scrimmage Yds/G; OL Blocks/G; LB/DB/DL Impact Plays/G.

**Legacy composition** (`legacyMix`). Career Legacy = 4·TT + 4·Dom + 2·G with Dom = 0.7·TT + award points, so it splits exactly:
talent = 6.8·TT, awards = 4·award points, longevity = 2·G (sum matches the stored value to rounding).

**Peak vs longevity**: TPG (TT / (G + 50)) against games; reference lines at the league medians.

**Similarity / play-style comps** (`similarPlayers`, `pairSimilarity`, `similarityToVector`; used by Player comps, Head-to-Head and the Build-a-Legend arcade game): same position only. Compares **how a player plays, not how long**: only per-game and efficiency rates, never games, career totals or True Talent (TT is built from cumulative totals), so a rookie can match a ten-year veteran.

| Position | Features (weight 1 unless noted) |
|---|---|
| QB | Y/A, Cmp%, TD%, INT%, passer rating (½: mostly repeats the four rates), pass yds/G, rush yds/G, rush share (carries / (carries + attempts)) |
| RB | Y/C, rush yds/G, rec yds/G, rec share (rec yds / scrimmage yds), TD per 16 G, fumbles per 100 touches, scrimmage yds per touch |
| WR / TE | Rec/G, rec yds/G, Y/R, rec TD per catch, fumbles per 100 catches |
| OL | Blocks/G |
| LB / DB / DL | Tackles/G, sacks/G, INT/G, FF/G, impact plays/G (sacks + INT + FF; ½) |

**Inputs are strict.** A stat missing from the sheet is never read as 0, and a rate with a zero or missing denominator is blank (e.g. rush share, Y/A, Cmp%, TD%, INT% and rating need pass attempts > 0; per-game rates need games > 0; RB rec share needs both rush and rec yards). A player with fewer than **3** usable features (OL: its single feature) is shown as "insufficient data" and never scored.

Each feature is z-scored against the league players at the position with **≥ 8 games** (`SIM_MIN_GAMES`) and enough data; players with fewer games are still matched but flagged "small sample". Two scores are exposed (`similarPlayers(players, target, count, mode)`, `pairSimilarity(players, a, b, mode)`):

- **Closest overall (level + style)** (`mode: 'level'`, the default): 100 · exp(−D / 2W), D = Σ wᵢ·(Δzᵢ)² over the shared usable features, W = Σ wᵢ (needs ≥ 3 shared features; a feature with zero spread is skipped). 100 = identical rates. Calibration: an average gap of 1 SD per feature scores **≈ 61**, 0.5 SD ≈ 88, 2 SD ≈ 14 — so "~60 = about one standard deviation apart on average".
- **Plays like (style)** (`mode: 'style'`): the same strengths and weaknesses relative to the position. Each rate becomes an oriented percentile (higher = better; INT% and fumble rates flipped) minus 50, so every axis says how far above or below the middle of the position the player sits. The weighted cosine of the two vectors over shared features (≥ 4) gives **max(0, cos) · 100**. Level matters less than direction: a lesser player who is above average in the same places scores high, while an above-average runner never matches a below-average one. This is the same picture the Deep Dive radar draws. (Before Y80 the score used a Pearson r centred on each player's own mean, which let an elite passer with merely good legs match pure pocket passers.)

Player comps (Analytics Lab) lists the top 3 for each score; Head-to-Head shows both; Build-a-Legend reveals by level.

---

## 5. Single-season stats (removed)

Per-season tracking (upload diffs, season history, single-season records, Greatest Seasons, MVP race, Season tab) was removed: career totals are the only source. `data/y80/records.json` (the in-game record board) is kept as source data but not shown.

## 6. Persistence map

| Store | Key | Holds | Fate under career-only model |
|---|---|---|---|
| localStorage | `retroVault:careerCsv` | Latest CSV | **Keep** (becomes the only data source) |
| localStorage | `retroVault:careerBaseCsv` | Baseline CSV | Remove |
| localStorage | `retroVault:prevCareerCsv` | Previous CSV (for the diff) | Remove |
| localStorage | `retroVault:seasonSnapshots` | One full CSV per season (quota risk) | Remove |
| localStorage | `retroVault:seasonHistory` | Per-player season deltas | **Export the record holders first**, then remove |
| localStorage | `retroVault:currentSeason` | e.g. "Y31" | Keep as a plain "current year" label |
| localStorage | `retroVault:teamOverrides` | name → team | Keep; apply app-wide (today only ReceiverTable uses it) |
| IndexedDB | `playerEdits` | Per-player overrides | Keep; drop the `manualSeasons` field |
| IndexedDB | `careerBaseCsv`, `seasonSnapshots`, `seasonHistory`, `settings` | Never read (migration is dead code) | Remove |
| new | `retroVault:seasonRecords` | Single-season record book | **Add** (see §5) |

---

## 7. Proposed code home

`src/config/stats.ts` would export:
- derived-metric functions from §2;
- one tier table (§3);
- the leaderboard definitions with their minimum samples (§4);
- the single-season record categories and thresholds (§5).

Every tab would import from it instead of re-declaring numbers.

---

## 8. Bundled league data (`public/data/initial-data.csv`)
Generated by `python3 -I scripts/build_league_data.py` from `data/y80/` (screenshots win, the sheet fills gaps).
- Real-NFL legends (`legend: 1`, plus `data/legends/real_nfl_legends.json`) are excluded from league stats and written to `public/data/legends.json` for the games only.
- `CUR` (your current club) maps to the **Jets** (`CURRENT_CLUB`). Per-player overrides in `TEAM_FIXES`: Macleone → Seahawks (formerly Vikings, Y78 Super Bowl QB), Sawyer → Jets (one Titans season with the Y72 title, then the Jets and the Y77 title; traded to the Falcons for the in-progress Y80, noted on his card). `UNK` players stay unassigned until added there.
- 7 short-career players (`in_games: 0`) count in league stats but are listed in `public/data/game-exclusions.json` and left out of the games.
- `public/data/player-extras.json` carries card extras from `screenshot_extras.json`: real-NFL careers before the league, card details, former names and family ties. Single-season lines are dropped.
- Game OVR follows `data/y80/formula/OVR.md` (League Score, then position percentile across the game pool).
- Michael Wilson has no games recorded, so his TPG/Legacy are understated until games are added.
- When a screenshot is a newer career snapshot than the sheet, sheet-only counting stats are **scaled** by the growth in the position's volume stat (yds / rush yds / tackles) and listed as estimates in the build output. Currently: Wayne Wilson (att, cmp, int), Pharoah Hunter and Jackson W. Kline (rec, td, fum), God Johnson (rec), Bilal Tolbert (int, ff). Real values from a screenshot replace them.
- Game OVR matches `ovr.py` exactly when given the same inputs; it differs for those estimated players because `ovr.py` treats missing stats as 0.
- Single source of truth: the site always loads this bundled file (no browser uploads or cached league copies). New data comes in by updating `data/y80/` and re-running the build script.
- Legend photos: `python3 -I scripts/fetch_legend_photos.py` finds a freely licensed Wikimedia Commons image for each legend (via Wikidata, filtered to American football players; `DESC_HINTS` disambiguates names like Reggie White) and caches author and license in `data/legends/photos.json`. The build merges them into `legends.json`; the games show them only after a reveal, with credit. 65 of 66 have one (no free photo of Kellen Winslow Sr.).
