# Save inventory: everything in the game's files, and what Retro Vault can use

A field-by-field map of the owner's NFL Retro Bowl save, the Retro Bowl College save, and the regular Retro Bowl web
build (code and data files). It covers every file and section, the formulas found in the game's code, and a ranked list
of what the site could add. Read with `docs/GAME_MECHANICS.md`, which already covers the player record, the stat
mapping (`sta_c` / `sta_s` / `sta_g`), aging, retirement, awards, the sprite filename scheme, `xp_dev`, facilities, the
cap, the achievements counters, dilemma tags and the unused perk, rogue, trait and suspension systems. This page does
not repeat those; it points to them.

**Privacy and ownership.** Everything below lives only on this Mac: `data/saves/` and `.cache/` are git-ignored. This
page quotes small illustrative values only. The plists hold device identifiers, and one abandoned save slot carries a
real name; neither is reproduced here. The art and code are New Star Games' (NFL and NFLPA marks in the NFL edition).

**Owner rules that limit what can be used:** no morale meters (`attitude` stays out), the bio line is age only
(`height`, `weight`, `dob` stay out), never surface the game's own Hall of Fame (`hof`, `hof_candidate`, `hoflist`,
`tag_hof_*`) or compare it with the site's, and never name a specific injury (the game's `injurytype_*` strings stay
out). `scripts/save_read.py` already enforces the first three (`FORBIDDEN`).

**How it is read today.** `scripts/save_read.py` reads slot 4 and writes either a `save.state` upload (live state:
ages, ratings and ceilings, contracts, salary, injuries, `delay_retirement`, `xp_level`, the season so far, every
club's W-L and O/D, facilities, cap, fans, coach rating, the coach's game log) or a season-complete bundle
(`player.set`, `superbowl.set`, `coach.season`, `record.set`, retirements, club changes). `scripts/save_state.py`
publishes `public/data/league/save_state.json`. Everything in "What we can add where" builds on that path.

---

## 1. File map

| Path (under `data/saves/2026-11-13/`) | Size | What it is | Use |
|---|---|---|---|
| `nfl/Documents/rb_nfl_savedata_4.json` | 4.3 MB | **The dynasty.** Year 93, week 16, Eagles (club 18), Extreme | Primary source |
| `nfl/Documents/backup_rb_nfl_savedata_4.json` | 4.3 MB | The same slot **one week earlier** (week 15) | Weekly deltas, last-week lines |
| `nfl/Documents/rb_nfl_savedata_5.json` (+ backup) | 3.6 MB | A second franchise: year 20, Lions (25), Hard | None (other career) |
| `nfl/Documents/rb_nfl_savedata_6.json` (+ backup) | 8.8 MB | A Rogue Mode run: year 1, week 5; adds `perk_list`, `perk_library`, `rogue` | None |
| `nfl/Documents/backup_rb_nfl_savedata_1/2/3.json` | 5.6–8.9 MB | Abandoned starts (year 1, and a year-5 Vikings save) | None |
| `nfl/Documents/rb_nfl_savedata_ffl_4.json` | 9.3 MB | `{version: 2026, players}`: the real-NFL player database (3,264 players, real careers) for the weekly online mode | None (real players stay out of league data) |
| `nfl/Documents/rb_nfl_savedata_ffl_5.json`, `backup_..._ffl_3/4` | 6.1–9.3 MB | Older copies of that database (2,127 / 3,264 players) | None |
| `nfl/Documents/*_info_*.json` | ~100 B | Slot headers: `myteam_id`, `year`, `week`, `w13_fix_result` | Slot picker (already used) |
| `nfl/Documents/rb_nfl_optiondata.dat` | 1.2 KB | 80-hex-char integrity prefix + base64 JSON of the options (below) | Context only |
| `nfl/Documents/crash.txt` | 0.5 KB | v1.0.73 crash in `gml_Script_s_choose_backup_returner` | Proves the KR picker exists (section 7.14) |
| `nfl/Documents/rb_nfl_players_2024/faces_img/*.png` | 19,123 files | Face sprite cache, `<uid>_<club or 800>_<pose>.png` | Private only (GAME_MECHANICS) |
| `nfl/Library/Preferences/com.newstarresearch.retrobowlpro.plist` | 0.5 KB | CloudKit startup, Game Center banner counters, an OpenUDID | None |
| `nfl/Library/Preferences/com.apple.gamecenter.plist` | 0.1 KB | Game Center access-point placement | None |
| `college/Documents/savedata.ini`, `savedata3.ini` (+ backups) | 1.5–1.8 MB | Retro Bowl College saves (INI, one `[savegame]` section) | None (separate game) |
| `college/Documents/rb_save_1/3.json` | 1 KB | College conference names and pro conferences | None |
| `college/Documents/ProTeams_CO_1/3.txt` | 10.7 KB | 32 NFL clubs: home, away, alternate and **color rush** kit colours, roof, rainfall, snowfall, endzone, conference | Kit colour cross-check (low) |
| `college/Documents/uniforms_custom_1/3.txt` | 86 KB | Edited college uniforms | None |
| `college/Documents/optiondata.dat` | 0.9 KB | College options (adds `cloud_sync_enabled`, `exh_op_strength_baseline`) | None |
| `college/Library/Preferences/...retrobowlcollege.plist` | 0.3 KB | OpenUDID, StoreKit check time | None |
| `.cache/retrobowl/RetroBowl.js` | 4.1 MB | Regular Retro Bowl web build (GameMaker HTML5, minified). A 1,973-entry name map (`_aF2`) sits at the top and a 1,395-entry script table (`_OU1` names, `_PU1` functions) near line 90,000 | Formulas (section 7) |
| `.cache/retrobowl/RetroBowl_texture_0/1.png` | 1 MB / 43 KB | Texture atlases | Private only |
| fan repo `html5game/*.txt` | 0.02–60 KB | Web build data files (section 5) | Reference |

To read the code: replace every `_xx` token with its name from `_aF2`, then map each `_PU1[i]` function to
`_OU1[i]` (`gml_Script_s_*`). That gives 477 named `s_*` scripts. Helpers: `_dq(n)` = `irandom(n)` (0..n inclusive),
`_hq(a, b)` = `irandom_range`, `_Ko` = `clamp`, `_xH` = `lerp`, `_jj(…, 64).x` = `global.x`.

---

## 2. Slot 4, section by section

19 top-level sections, 4.99 MB of JSON. Numbers are floats; yards carry decimals (shown rounded half to even).

| Section | Size | Holds | Status |
|---|---|---|---|
| `players` | 4.80 MB | `{type: 1, pool: [1,434 players]}` (section 2.2) | Used (careers, live state) |
| `schedule` | 78 KB | This season's 272 games (section 2.4) | Coach's games used; **league games not yet** |
| `coaches` | 33 KB | `{type: 2, pool: [10 staff]}`: the club's OC and DC plus 8 on the market (section 2.3) | **Unused** |
| `history` | 23 KB | 92 rows, the coach's season per year (section 2.5) | Used for `coach.season`; playoff W-L unused |
| `teams` | 18 KB | `{label: "Primary", list: [32 clubs]}` (section 2.6) | W-L and O/D used; weather, presets unused |
| `achievements` | 10 KB | 95 lifetime counters `{tag, achieved, valid_in, description}` (GAME_MECHANICS) | **Unused on the site** |
| `records` | 10 KB | The 50-row record board (section 2.7) | Used (`record.set`); week, opponent, QB unused |
| `history_bowls` | 8 KB | 92 Super Bowls `{year 2026–2117, winner, result, loser (TLA), human: 1 won / −1 lost / 0 not in it}` (66 / 7 / 19) | Used (`superbowl.set`) |
| `qualified_status` | 6 KB | Weekly online-mode status per club (`this_week_score`, `last_week_status`…) | None |
| `persistent_leaderboard_data` | 3 KB | Online leaderboard cache: `lb_last_week`, `lb_previous_season` (one total per club), refresh times | None |
| `settings` | 1.8 KB | 79 franchise keys (section 2.1) | Partly used |
| `badges` | 1.5 KB | Leaderboard badge flags (top 5/10/50/100), all 0 | None |
| `dilemma_tags` | 0.7 KB | The 35 press-conference tags not yet drawn this cycle | None (morale) |
| `playoffs` | 12 B | Empty until the playoffs start | Later in the season |
| `news_list`, `news_dyn_list`, `news_tags` | 2 B each | Empty: news is not kept across saves | None |
| `use_nfl_uniforms`, `shown_ffl_splash` | scalars | 1.0 / true | None |

### 2.1 `settings` (79 keys)

| Group | Keys (slot 4 value) | Meaning | Status |
|---|---|---|---|
| Season clock | `year` 93, `week` 16, `start_year` 2025, `last_week_regular` 18, `first_week_playoffs` 19, `start_of_season`, `stage`, `draft_round` 4 (draft done), `draft_info_done`, `year_stagger` 6 | Calendar year = `start_year + year`. Weeks 19+ are playoffs | Used |
| Club | `myteam_id` 18, `favourite_team_id` 0, `fname`/`lname` (the coach), `fname_coach`/`lname_coach` (a second, unused name pair), `myface_uid` | The coach's club and face | Used |
| Difficulty | `op_difficulty` 4 (Extreme), `suppress_difficulty` −5 (dynamic-difficulty memory: +1 per loss), `op_matchlength` 0 | See 7.8 | Context |
| Money | `salary_cap` 150, **`boost_salary_cap` 125**, `cap_breach_flag` 1, `roster_cap` 10, `coach_credit` 43, `purchased_credit`, `season_credits_purchased`, `qb_salary` | **The real cap is 150 + 125 = 275** (five commissioner boosts of +25). Payroll is **254**: the ten playing key players (an earlier count of 269 included Vyncint Heath, retired but still carrying the Eagles' `teamid`) | In `save.state` (`salary_cap` 275, `salary_cap_base`, `credits`, `draft_picks`, `roster_cap`) |
| Franchise | `facility_stadium` 6, `facility_training` 3, `facility_rehab` 10, `facility_upgraded_*` (the **week** of this season's upgrade, 0 = none; rehab 12; one upgrade a week), `fans` 100, `coach_rating` 20 (the maximum), `relationship_boss` 50 (no code reads it) | See 7.6, 7.7, 7.11 | Levels used; rest unused |
| Training | `training_reg_of` 2, `training_reg_df` 2 | 1 light, 2 normal, 3 hard (7.5, 7.6) | Unused |
| Draft | `draft_picks_0/1/2` 1 each | Picks per round next draft | Unused |
| Counters | `matchcount` 1,845 (games coached), `gamestarts` 17, `tip_count` 19 | | Unused |
| Last results | `result_last_game_0..3` (true = win) | Last four results | Unused |
| Names | `name_conf1/2` AFC/NFC, `name_div1..4(b)` EAST…SOUTH | Editable league names | None |
| Flags | `prematch_dilemma_done`, `expiredcontract_msg_done`, `timeout_message_done`, `bullet_throw_message_done`, `tag_hof_message_done`, `tag_kr_message_done` 4, `offers_done`, `intro`, `is_mvp`, `is_nfl` 1, `fr_mode` 1, `co_mode` 0, `rogue_mode` 0, `starrating` 50, `qb_nrg`, `qb_tdbonus`, `qb_training_hiscore`, `op_autorun(_p2)`, `op_ball` | UI one-shots and the QB-training minigame | None |

### 2.2 `players.pool` (1,434 records, 72 fields)

Who is in the pool: 321 league players playing now (`teamid` ≥ 0, no `team_leave_reason`, age within the max);
retired league players keep their last club and `team_leave_reason: "retired"` (50) or `"cut"` (2), and keep ageing;
the real NFL players of the 2025 start (`is_real_crew`, `dob`, `height`, `weight`, `rookie_year`) are all retired by
now (ages 115–131, many still carrying a club id, 408 with `teamid` −4); 54 free agents sit at `teamid` −1 (`type` 5).
`uid` repeats (900105 seven times), so the pool index is the identity, as `save_read.py` does.

| Group | Fields | Notes | Status |
|---|---|---|---|
| Identity | `fname`, `lname`, `position` (1 QB, 2 RB, 3 TE, 4 WR, 5 OL, 6 DL, 7 LB, **8 CB, 9 S**, 10 K), `uid`, `teamid`, `teamid_orig`, `type`, `team_leave_reason` | `teamid_orig` is −1 for every league player (no draft origin) | Used |
| Ratings | `speed`, `strength`, `skill`, `stamina` (1–10) and `max_*` | Stars and potential are computed from these (7.1) | In `save.state` |
| Progress | `xp`, `xp_level`, `xp_gain`, `skill_points`, `xp_dev` | Next level at `xp ≥ xp_level × 100`; `xp_dev` multiplies XP (Eagles 0.83–1.47) | `xp_level` only |
| Condition | `condition` (0–100; **negative = injured, −weeks left**), `injury_week`, `resting` | No playing player is injured now; two retirees retired injured | `injury_week` only |
| Contract | `salary`, `contract` (years left), `signed_year` (the season the coach signed, re-signed or traded for him; 0 for AI players; in `save.state` when set), `creditcost`, `intrade_pick`, `outtrade_pick`, `trade_delay`, `potential_trade_team` | Salary formula in 7.2 | Salary, contract |
| Age | `age`, `delay_retirement` (2 players use it) | Max age 40 QB/K, 35 others, + delays | In `save.state` |
| Stats | `sta_c` (career), `sta_s` (season), **`sta_g` (the last game)**, `sta_r` (the real 2024 career at import, `year: 2024`) | Each block: games, `att`/`cmp` `{no, xp}` (kickers' `xp` = PATs), `pass`/`rush`/`rec`/`kick` `{yds, lng}`, `rush.att/td`, `td`, `int`/`sack` `{by, vs}`, `tck`, `fum`, `ff`, `fgm`, `fga`, `blk`, `ret {att, yds, td, lng}`, awards | `sta_c`, `sta_s` used; **`sta_g` and `lng` unused** |
| Appearance | `skin`, `col_skin`, `col_cleats`, `pose`, `randnum`, `number` (−4 for every league player), `uniform_record` (custom kit string on 53 AI players) | | None |
| Scouting | `scouted` (42 true), `store_potential`, `ai_team_potential`, `percent_grade`, `saved.percent_grade` | Potential is shown in-game only once scouted | None |
| Excluded | `attitude` (morale), `height`, `weight`, `dob`, `hof`, `hof_candidate` | Owner rules | Never |
| Unused by the game | `trait`, `suspended`, `walk_on`, `disposable`, `is_legacy_crew`, `epilogue`, `epilogue_story`, `drafted_pro_team`, `meetingdone`, `rating`, `rc_cost`, `kr` (all false), `backup`, `flash_time`, `rookie_year` | Constant across the pool, or College/legacy hooks | None |

### 2.3 `coaches.pool` (10 staff)

Same record shape as a player. Position **102 = offensive coordinator, 101 = defensive coordinator** (the code reads
102 for team offense, 101 for defense), 100 = the head coach. `rating` 1–10 (5 stars at 10), `trait` (0 here; the 9
traits are in 7.11), `age` (staff retire past 65), `contract`, `xp`, `xp_level`.

The Eagles' pair: **OC Von Clement**, rating 10, age 61, 1 year left; **DC Damiere Kirklin**, rating 10, age 49, 1 year
left. Both are in `save.state` (`staff`). The regular game's code ages staff at the season's end and retires them past
65 (+ delays); the NFL edition retires players on reaching their max age (nobody in slot 4 plays at 35 or 40), so the
Front Office reads a coordinator's final season the same way: season + (65 + delays − 1 − age), Clement Y96, Kirklin Y108. Eight more coordinators (all rating 10, ages 36–57) sit on the
market with `teamid` −1.

### 2.4 `schedule.list` (272 games, this season only)

`{week 1–18, away_team, home_team, away_score, home_score (−1 unplayed), human_result ("win" / "loss" / "no" for
games without the coach / "unplayed"), weather (0 clear, 1 = weather on the day; 4 games), difficulty ("Extreme" on
the coach's games), op_matchlength, year (9: the schedule template slot), team_opt_1/2, real_world, field, date,
location}`. 255 league games and 14 Eagles wins are in, 3 to play. Earlier seasons' schedules are not kept: only a
pull per season captures them.

### 2.5 `history.list` (92 seasons)

`{year, uid, name, tla, wins, losses, ties, finish, wins_po, losses_po, wins_cnf, losses_cnf, wins_sim, losses_sim,
ties_sim}`. `finish` counts: Champions 66, Champ Rnd 7, Wild Card 4, NFC Champs 4, AFC Champs 3, Divisional 2, and 6 rows
with a division place instead ("AFC EAS 3rd", "NFC NOR 1st"; `coach.json` says 90 of 92 playoff trips, so a 1st-place
label can also mean an early exit). **`wins_po` / `losses_po` give each season's playoff record**
(Y92: 3-0); `coach.json` has only the finish. The `_sim` and `_cnf` columns are 0 in every row.

### 2.6 `teams.list` (32 clubs)

`{uid, name, longname, city, namesafe, tla, assetid, conference, division, offense, defense, preset_offense,
preset_defense, wins, losses, ties, rainfall, snowfall, roof (0 open 21, 1 five, 2 six), helmet, helmet_r,
uniform_count, colhelmet, colshirt, colpants, colsleeves, colsleevesalt, coltertiary}`.
`offense` / `defense` are this season's AI ratings (PHI 10/10). The O+D totals form a ladder, two clubs per step (one
per conference) from 20 down to 7: the reseeding rule in 7.8. `preset_*` are the NFL edition's base ratings (PHI 9/10).

### 2.7 `records.list` (50 rows)

`{order, tag (ui_LongPassingPlay …), stat (float), stat_text, playername, qbname, team, opponent, year, week,
coachstat}`. Single-game rows carry the **week and opponent** (Best rushing game: R. Maxwell, ATL, Y85 week 17 vs
BUF), passing plays the **QB**, and four club rows (`ui_MostPointsGame`, `ui_BiggestWin`, `ui_BiggestLoss`,
`ui_MostTDsGame`) hold the score in `playername`. Season rows show week 31 (season end). Compared with
`data/y80/records.json`, only Maxwell's two in-progress Y93 career marks (24,784 rushing yards, 346 rushing TDs)
differ; everything else matches. The three return-yard records date from Y1–Y7 (7.14).

---

## 3. Other NFL files

- **Backup = last week.** `backup_rb_nfl_savedata_4.json` is week 15. Between it and week 16 only `matchcount`,
  `coach_credit` (+4 for the game), `tip_count`, `week`, `gamestarts`, the players' `sta_g` / `sta_s` and the two
  Maxwell records change. With the backup, each pull yields **two consecutive weekly lines** and the last game's box
  score (Maxwell: 10 carries, 74 yards, 2 TDs, long 33; Crawford 12 of 14 for 259, 2 TDs).
- **`rb_nfl_optiondata.dat`:** `op_difficulty` lives in the save, but here: `op_salarycap` 275, `op_kickoffs` **0**
  (kick returns off), `op_weather` 1, `op_replays` 1, `op_trade_mode` 0, `op_draw_star_mode` 0, `saveslot` 4,
  `my_version` 43, `ffl_*` (online mode, never played), `exh_op_*` (exhibition settings), audio and control options.
- **FFL databases:** the real-NFL rosters for the online weekly mode. They never touch the dynasty.
- **Rogue slot:** `perk_list` (cards such as "Strength1", `off_strength_bonus`, cost 16, tier 1), `rogue.total_score`
  25,873 over 4 rounds. A separate mode.

## 4. Retro Bowl College

Four saves in INI form; the best is `savedata3.ini`: year 15, club 138, 198 games, 7 national titles, 18 bowl wins,
10 conference titles, 843 recruitment credits earned. Keys (120 kinds): `roster_0..7`, `schedule_*` (1,670 games),
`teamlist_*` (299 schools), `records_*`, `achievements_*`, `pro_drafted_players`, `college_historical_winners`,
`rec_*`, `rc_*`, scholarship and admissions flags. Lists are GameMaker hex blobs or handles. It is another game and
another career: nothing for Retro Vault except `ProTeams_CO_*.txt`, the cleanest table of all 32 NFL kits (four sets
each, including color rush), useful to check `uniforms.ts`.

## 5. Web build data files (fan repo `jaxsonbunch/retro-bowl-modded`)

| File | Rows | Holds | Notes |
|---|---|---|---|
| `Teams.txt` | 32 | uid, city, conference, division, colours, TLA, defense, offense, W-L-T, roof, rainfall, snowfall, helmet | Same weather numbers as the NFL save (BUF rain 40, snow 89) |
| `uniforms_default.txt` | 32 | Home, away, alternate kits | |
| `Schedule17.txt` | 3,264 | 12 template seasons × 272 games (year, week, away, home) | Template = `(year + year_stagger) mod 12`, so schedules repeat every 12 seasons. The NFL edition uses its own templates: Y88–Y92 share at most 42 of 272 games with these |
| `PlayerRecords.txt` | 50 | The empty record board | Same 50 tags as the save |
| `Achievements.txt` | 95 | Tags and descriptions | Same as the save |
| `LanguageUS.txt` | 1,138 | Every string (section 6) | First line is the modder's |
| `Colleges.txt` | ~80 | College names for player bios | |
| `Names_F0.txt`, `Names_F1.txt`, `Names_L.txt` | | First and last name pools | **`Names_L.txt` is vandalised in the fan repo** (comic-book names) |
| `Charities.txt` | 7 | Charity names for news | **Vandalised** (joke entries). Never quote |
| `RetroBowlHOF.txt` | 1 | Empty game Hall of Fame | Excluded |

## 6. `LanguageUS.txt`: strings the NFL edition shares

Key families: `ui` 396, `msg` 177, `comm` 61 (simulated-drive commentary), `info` 47, `tla` 44, `match` 44, `trait` 36,
`dilemma` 36, `news` 35, `choice` 26, `postmatch` 24, `pos` 20, `training` 17, `attribute` 14, `injurytype` 12,
`coachtrait` 10, `finish` 7, `condition` 7, `attitude` 7, `rating` 6.

Worth knowing: the **finish labels** (`finish_*`: No, Wild Card, Divisional, Champ Rnd, AFC/NFC Champs, Champions, the
same strings as `history.finish`); the **condition tiers** (Injured, Exhausted, Tired, Ok, Good, Great, Perfect); the
**season fan poll** (`msg_SeasonRatings`, ratings Terrible…Incredible); the attribute names per position (QB Throw
Accuracy and Arm Strength, K Kick Accuracy and Range, OL Blocking, defenders Tackling); `info_Staff` ("coordinators
determine the base rating for defense and offense"); `msg_CannotTradeWeek` (**no trades after week 8**);
`info_Draft` (3 rounds, 1 pick a round, scouting reveals potential); news templates for retirements, signings,
awards (`news_mvp` etc.) and job moves. `trait_app_*`, `trait_issue_*`, `trait_vice_*` (Gambler, Party Animal…) are
the unused personality system. Not for the site: `attitude_*`, `injurytype_*` (Head…Foot), `dilemma_*` texts.

---

## 7. Mechanics found in the code

Read from the web build (v1.5.x). The NFL edition is the same codebase (crash log, same field names, same awards).
"Checked" means tested against slot 4.

### 7.1 Star rating and potential (the game's own)

```
stars     = clamp(round(10 × (speed + strength + skill + stamina) / POS_MAX), 1, 10)      // half-stars: 10 = 5 stars
potential = the same over max_speed + max_strength + max_skill + max_stamina
POS_MAX   = QB 37, RB 34, TE 33, WR 34, OL 35, DL 35, LB 33, CB 33, S 33, K 37
```

There is no hidden overall: this is the star count on the card, the trade value and the salary base. Every Eagles
starter is 8–10 now; Maxwell is 10 with a 10 ceiling. Retro Vault's OVR (`src/config/ovr.ts`) is its own scale.

### 7.2 Salary and contracts

```
salary = round(stars × POS_PAY × 3 × age_factor)
POS_PAY    = QB 1.66, RB 1.0, TE 0.9, WR 1.1, OL 0.8, DL 1.0, LB 0.9, CB 0.8, S 0.75, K 0.55
age_factor = 0.6 at exactly 21 (rookie); else, with max = max age + delay_retirement:
             0.55 if age > max − 2, 0.65 if age > max − 3, 0.75 if age > max − 4, 0.85 if age > max − 5, else 1
stars      = the half-star rating of 7.1 (1 to 10)
```

(Checked in the code, `s_` salary script: the age tests are strict, so "years to max age" under 2, 3, 4, 5. With `≤`
instead only 186 of 321 match.) The Front Office prices every key player with it and tags his salary: within max(1,
round(10% of the price)) of it a fair deal, below underpaid, above overpaid (rounded with JavaScript's `Math.round`, as
the HTML5 runner does).

**Checked:** 238 of 321 playing players (74%) match exactly; the rest were set when their ratings differed (salary is
fixed at signing). At each season end every player ages, loses a contract year and resets condition to 90–100. An
expired contract re-prices him (2–3 years, 1 year within 3 of max age) and, unless the coach extends, sends him to free
agency. An extension meeting costs `stars + salary / 2 + 5 × years left` credits. Payroll counts only the key players
(up to 10, 12 with the upgrade) against `salary_cap + boost_salary_cap`.

### 7.3 Trades and draft picks

```
trade value (round of the pick) = 1 if stars ≥ 8, 2 if stars ≥ 4, else 3     // half-stars; checked: the script that
                                                                             // prices the coach trading his own player
offer for an AI player:  value of (stars − 4); a toxic player (morale ≤ 15) costs a 3rd
AI request for yours:    value of (stars + 4), so any 4-star player fetches a 1st
requesting club = (week + skill + strength + stamina + speed + age + morale) mod 32, skipping the coach's club
```

A weekly random event offers one of the two. Trading a player away from the roster screen (checked in the code) is
refused after week 8 (unless a pick is already set), while he is injured (condition ≤ −1) or toxic, and warns when he was
signed this season; the pick is this year's or next year's depending on where the draft stands. No trades after week 8; a player signed this season, over 31 or toxic
can't be requested. `potential_trade_team` (32 players) is the NFL edition's stored version of the requesting club.
Lifetime counters in `achievements`: 160 trades in, 287 trades out, 119 draftees, 127 free agents, 11 cuts.

### 7.4 Draft and rookie generation

```
50 prospects, all age 21, positions cycling QB…K (CB/S rerolled half the time)
best possible stars = round(lerp(8.5, 5.5, last season's win %)); prospects 1–4 and the year-2 draft: 8
  (after a club change: win % = 0.05 × the new club's O+D)
each prospect: target stars random 2..best; ratings rolled in position ranges, then nudged to the target
ceilings: each max_* = rating + irandom(5) (half the class: irandom(6))
rookie: contract 2 years, condition 80–100, salary × 0.6
```

**So the better the season, the weaker the draft:** a 15-2 year (88%) caps prospects 5–50 at 3 stars (6 half-stars);
an 8-9 year (47%) allows 3.5, a winless one 4 to 4.5. Scouting (`interviews`) is 5 a draft on Extreme, +3 per Scout-trait coach.

### 7.5 Injuries, condition and rehab

After each game the coach's key players are checked in roster order, **at most one injury a game**:

```
skip in year 1, week 1, from the week before the Super Bowl, or with < 2 games left
training: light skips 90%, normal 80%, hard never
age gate: skip unless 5 + irandom(40) ≤ age            (25: 51% pass, 30: 63%, 34: 73%)
squad caps: at most 3 injured at once; total weeks out < 11 − floor(rehab / 2)   (rehab 10: 6)
roll: condition ≤ 20: 1 in 5, weeks 1..cap;  21–40: 1 in 9, weeks 1..cap−1;  > 40: 1 in 13, weeks 1–2
weeks: +1 if age > 29, − irandom(round(0.4 × rehab)), clamp 1–10; a QB in years 1–2 at most 2
stored as condition = −weeks; +1 a week until 0, then condition 85–100
```

At normal training, a 28-year-old at 80 condition has about a 0.9% chance a game. With rehab 10 most injuries last one
week. **Only the coach's key players are rolled**; AI rosters have no injury model in this code.

Condition: a game costs `25 + age + clamp(round(0.6 × week), 2, 10) + match rating` (kickers half). Each week returns
`50 + 1.5 × rehab` (double if resting, +10 light / −10 hard training, +5 with a Physio coordinator); a bye week returns
`10 × rehab`. Season end resets to 90–100.

### 7.6 XP and development

```
XP per game = 2 × training facility + production (QB 2.5 per TD, 0.1 per yard, −5 per fumble, −2.5 per INT or sack;
             RB 5 per TD, 0.3 per rushing and 0.25 per receiving yard; defenders 5 per tackle, 5 per forced fumble, 5 per sack)
           × 0.6 light / 1.5 hard training × xp_dev, capped at 200 × level
level up at xp ≥ 100 × xp_level: one point to spend (only below the ceiling)
```

Season-end growth and decline are in GAME_MECHANICS. The training facility here is 3, so it adds 6 XP a game.

### 7.7 Facilities and cap boosts

Upgrading a facility costs the new level in credits (`level + 1`, capped at level 10, so re-upgrading a maxed one costs
10 and still counts as this season's upgrade); one upgrade per facility per week (`facility_upgraded_*` holds the week).
**At each season's end one facility at random may drop a level:** the code rolls `irandom(2)`: 0 stadium, 1 training,
2 rehab, and a facility drops only if it was not upgraded that season and is above level 1. **Case 1 has no `break`**, so
the training roll falls through to the rehab check: per season the stadium and training are at risk 1 in 3, rehab 2 in 3
(and a training roll can cost both). Then every flag resets to 0. The Front Office shows each facility's risk and the
credits to protect it. Stadium: fans per game (7.11). Training: XP (7.6). Rehab: injury caps and lengths (7.5) and
weekly recovery. The commissioner raises the cap by 25 per purchase (here five times, 150 → 275).

### 7.8 Team strength

```
coach's offense = clamp(round(0.225 × (sum of healthy, non-resting offensive key players' stars + OC rating)), 1, 10)
coach's defense = clamp(round(0.25  × (sum of defensive key players' stars + DC rating)), 1, 10)
// Eagles Y93: offense 0.225 × (57 + 10) = 15.1 → 10, defense 0.25 × (38 + 10) = 12.0 → 10 (the Front Office shows both)
AI club on Extreme: 10 and 10, whatever its listed ratings
```

Each new season the AI ratings are re-dealt as a ladder per conference: clubs sorted by record, the top O+D 20 (or 19),
each next club 0.8 lower on Extreme (0.875 otherwise), floor 2 each. **Checked:** slot 4's totals run 20, 19, 18, 18 …
7, 7, two per step. On Extreme the season-summary O/D ratings decide AI-vs-AI games only; against Skura every opponent
plays at 10/10.

### 7.9 AI-vs-AI results

```
each side: irandom_range(6, 12) chances; each a TD (1 in 3: 7, PAT missed 6%), FG (1 in 3: 3, missed 1 in 6) or nothing
tie: home +3 two times in three
strength = O + D (+1 home); if the weaker side outscored the stronger, the scores are swapped
  unless irandom(round(0.25 × |gap|)) = 0
```

So the favourite wins about `1 − 0.5 / (round(gap / 4) + 1)`: a coin flip at a 0–1 gap, 75% at 2–5, 83% at 6–9.
**Checked:** across Y88–Y92 (2,550 AI team scores in `schedules.json`) no score the model can't make appears (1, 2, 4,
5, 8, 11), and the mean is 31.2 against the model's 28.4; in Y93 the favourite has won 139 of 196 decided AI games
(71%).

### 7.10 How the simulated defense credits stats (and OL blocks)

On each simulated opponent snap a random defensive key player is involved with chance (n + 1) / (n + 2) for n
defensive key players (a CB on a Hail Mary). He rolls one of skill, strength or speed (`random(his rating +
min(0.05 × the group's total, 1 on Extreme))`) against `cpu = about 1.5 + random(10)` on Extreme (opponents play at
10). A tired roll (`random(stamina) < random(9)`) takes 1 off. If he wins, the drive ends: two times in three a punt,
one in three a turnover. If he loses, the commentary says he missed the tackle, wasn't strong enough or was too slow.
With no defender involved, the team defense rating rolls instead. A turnover is credited by play type:

- **run play:** half a tackle-for-a-stop, half a **forced fumble** (counted in `fum`, Retro Vault's `ff`);
- **pass play:** a **DL always sacks**; an **LB sacks half the time**; otherwise it is an **interception** (so every
  CB and S stop on a pass is a pick).

Separately, at each simulated possession every healthy DL and LB key player gets a tackle with `P(random(4) < random(skill))`
(skill 10: 80%), and every CB and S with `P(random(6) < random(skill))` (skill 10: 70%). This is why every DPOY is a
DB (they take the interceptions, worth 3 tackles each in the award rating), why DLs never intercept, and why the career
tackle leaders win nothing.

**OL "blocks"** are the `tck` stat for OL and TE in the coach's own snaps: one per play when his block knocks a
defender back with the ball at or past the line (within 5 yards behind it), at most one per player per play. WRs get
one only on a run past the line; QBs and kickers never. The postgame match rating for an OL is
`blocks + 0.25 × completions − sacks`.

### 7.11 Fans, coach rating, staff traits

- **Fans** per game: `stadium − 6 + (win +8 / tie −3 / loss −10) + Fan-Favorite coaches`, clamped 1–100 (100 here).
- **Coach rating** (1–20, here 20): at the regular-season end +4 for the 1 seed, +3 for 2, +2 for 3, 0 for 4, halved
  when out of the playoffs; then +3 (wild card exit), +4 (divisional), +5 (conference), +6 (Super Bowl loss), +8
  (title). Job offers come only from clubs whose O+D is at most the coach rating, each interested 3 times in 4. At 20,
  every club.
- **Staff cost:** `2.5 × rating (+5 with a trait)` credits. Traits: Experience (instant level-up), Talent Spotter
  (potential up), Motivator, Negotiator, Fan Favorite (+1 fan a game), Physio (+5 condition a week), Likeable (+5% XP),
  Positive, Scout (+3 interviews).

### 7.12 Press conferences (dilemmas)

Each tag in `dilemma_tags` is a prompt with two choices; each choice moves one meter: player or team morale (Praise
+15, Criticise −15, Side with +10, Rest +15, Fine −10, Meet team +10), team XP (Focus on team: 300 split over the
roster), coach XP (100), fans (Praise fans +3, Criticise −10, Media +5; trivia ±3/−5), or credits (owner meetings
+1/+2, defending a player −1). Tags are drawn without repeats until the pool empties. Morale-only: not for the site.

### 7.13 Weather

Home club's `rainfall` and `snowfall` decide it; none in year 1 or the Super Bowl; option `op_weather` must be on.

```
weeks 1–11:   rain if irandom(200) < rainfall
weeks 12–18:  rain as above, else snow if 1 + irandom(150) < snowfall
playoffs:     snow if 1 + irandom(100) < snowfall, else rain as above
wind 0–9 (0 in snow); roof 1 or 2 covers the field
```

Philadelphia (47 / 15, open): rain 23% early, rain 23% and snow 7% late, snow 14% and rain 20% in a home playoff game.
Buffalo (40 / 89): snow 47% late, 87% in a home playoff game. Rain and snow raise fumbles (GAME_MECHANICS).

### 7.14 Kick returns

The web build has none. The NFL edition picks a returner (`s_choose_backup_returner`, from the crash log) unless one is
tagged (`kr`, false for everyone; `tag_kr_message_done`). This save runs with **`op_kickoffs` 0**, so no returns are
played: every league player's `ret` line is empty, only imported real careers carry return yards, and the board's
three return records are frozen at Y1–Y7.

### 7.15 Meeting costs (credits)

Morale talk 1–4 by tier; condition boost `(100 − condition) / 5`; instant level-up `4 × level`; **delay retirement
`25 + 25 × (age − max age)²`** (25 when done at the max age); contract extension in 7.2.

---

## 8. Caveats

- The web build is the regular game. The NFL edition adds the CB/S split, the defensive rookie award, kick returns, and
  its own schedules; every formula above that could be checked against slot 4 held (salary, ladder, scores, awards).
- Weekly or per-game history doesn't exist in the save beyond this season's schedule and the last game. A season's
  league schedule and a player's game lines survive only if a pull happens in time.
- `signed_year` resets on re-signing, so it isn't "joined the club" for long-time Eagles.
- Career `lng` (longest play) is filled mostly from the coach's own snaps; simulated games rarely set it.
- `relationship_boss`, `starrating`, `trait`, `walk_on` and similar keys have no effect in this code.

---

## 9. What we can add where (ranked by value)

Data needed: **S** = already in `save_state.json`; **+** = a small addition to `save_read.py live_value`; **R** = a rule
over existing data. Stories and Hot Takes may cite only what lives in a data file with a `story_check.py` source, so
any save figure they use needs a `save_state.json <path>` source first.

| # | Addition | Where | Data | Why it matters |
|---|---|---|---|---|
| 1 | **Retirement clock**: seasons left = max age + delays − age ("final season" tag at 0) | Player page, Front Office roster, widget countdowns, Hot Takes | S | Exact, not guessed; drives "last chance" stories |
| 2 | **The game's stars and ceiling** (7.1): now / potential, with "room to grow" = ceiling − now | Player page, Deep Dive, Front Office roster | S + R | The number the game itself uses for trades, salary, team strength |
| 3 | **League schedule and standings from the save** (all 272 games, scores, weather flag) in place of screenshot `schedule.set` | Season page (Timeline), power rankings, Games tab | + | Removes the heaviest transcription; adds weather per game |
| 4 | **Last game box score** (`sta_g`) and week-over-week lines (the backup) | Season page "Last game", widget, The Wire | + | The only per-game data the save keeps |
| 5 | **Defensive credit rules** (7.10) as rule facts: why DBs win DPOY, why DLs never intercept, what a block is | Did you know, Award Race, Hot Takes context | R | Turns the league's oddities into explained facts |
| 6 | **Built (Front Office, Club office).** **Payroll and cap**: salary per player, total 254 of **275**, contract years, salary vs the formula's price | Front Office dashboard | S (+ fix) | A real cap sheet; "underpaid" stars are a story |
| 7 | **Built (Front Office, Club office).** **Coordinators**: OC Clement and DC Kirklin, ratings, ages, contracts, staff retirement year | Front Office | + | Staff are half of team strength (7.8) |
| 8 | **Per-season playoff record** (`wins_po`-`losses_po`) | Front Office season log, Timeline | + (history) | 243-24 broken down by year |
| 9 | **Built (Front Office, Club office).** **Franchise dashboard**: facilities (with the decline rule), fans, coach rating 20/20, credits, Extreme, training regimes, draft picks, games coached 1,845 | Front Office | S + small + | One honest panel of the club's state |
| 10 | **Built (Front Office, Club office).** **Franchise counters** from `achievements`: trades in 160 / out 287, draftees 119, free agents 127, unbeaten seasons 11, shutouts 7, 50-point games 12, doinks 14 | Front Office achievements, Did you know | + | Lifetime facts no screenshot shows |
| 11 | **Draft-quality rule** (7.4): winning shrinks the next class's ceiling | Did you know, Hot Takes, draft-season story | R | Explains why the dynasty restocks by trade |
| 12 | **Injury model** (7.5): one injury a game at most, three at a time, rehab 10 keeps most to a week, only the coach's club rolls | Hot Takes context, missed-games rule notes | R | Grounds "missed through injury" without naming injuries |
| 13 | **Development line**: XP progress to the next level and `xp_dev` as a growth rate | Player page (active players) | + | Shows who is still climbing |
| 14 | **Upset index**: expected win chance from the ladder (7.9) for every league game | Season page power rankings, The Wire upsets | R | Makes "upset" a measured term |
| 15 | **Weather odds by stadium** and the game's weather flag | Games tab club sheets, Season page game log | + | Small colour, all real |
| 16 | **Record Book detail**: week, opponent and QB on game records, exact decimals | Record Book chips | + | "Set in week 17 against Buffalo" |
| 17 | **Built (Front Office, Club office).** **Acquired in Y<n>** for the coach's signings and trades (`signed_year`; shown as "Signed Y<n>" on the cap sheet, since a re-signing resets it) | Player page, Front Office | + | Partial tenure fact |
| 18 | **Arcade ideas**: guess the stars, higher-or-lower salary, who retires first | Arcade games | S | Uses facts players won't know |
| 19 | **Kit check**: compare `uniforms.ts` alternates with `ProTeams_CO` (home, away, alt, color rush) | Collection kits (art review) | College file | Colour accuracy only; no art copied |
| 20 | Career longest plays (`lng`) | Player page | + | Low: mostly the coach's snaps |

**Not to add:** morale, condition shown as a meter (it is fitness, but it reads as one), height, weight, birth dates,
the game's Hall of Fame and tags, injury types, press-conference choices, online leaderboards, FFL, Rogue Mode, the
other franchise slots and the College career. **Collection:** cards stay timeless; if stars or ceilings ever appear,
freeze them at the pull like the rest of the snapshot.
