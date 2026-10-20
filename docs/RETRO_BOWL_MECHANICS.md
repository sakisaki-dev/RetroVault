# Retro Bowl game mechanics (research notes for Team Lab)

What is known about how Retro Bowl works, gathered from sources, and what it means for the Team Lab advice
(`src/utils/teamLab.ts`). New Star Games has never published the sim formulas, so most of this is observed
behaviour.

**Confidence levels**
- **H**: developer patch notes, the in-game loading tips, or the wiki quoting the game.
- **M**: the wiki's own write-up, or community consensus across several threads or guides.
- **L**: a single anecdote or guide.

**Sources** (short names used below)

| Tag | Source |
|---|---|
| WIKI | Retro Bowl Fandom wiki, read through its MediaWiki API (`retro-bowl.fandom.com/api.php?action=parse&page=…`; normal page views return HTTP 402). Pages: [Positions](https://retro-bowl.fandom.com/wiki/Positions), [Gameplay](https://retro-bowl.fandom.com/wiki/Gameplay), [Morale](https://retro-bowl.fandom.com/wiki/Morale), [Condition](https://retro-bowl.fandom.com/wiki/Condition), [Injuries](https://retro-bowl.fandom.com/wiki/Injuries), [Facilities](https://retro-bowl.fandom.com/wiki/Facilities), [2 point conversion](https://retro-bowl.fandom.com/wiki/2_point_conversion), [Field Goals](https://retro-bowl.fandom.com/wiki/Field_Goals), [Defensive Coordinator](https://retro-bowl.fandom.com/wiki/Defensive_Coordinator), [Difficulty](https://retro-bowl.fandom.com/wiki/Difficulty), [Rookie](https://retro-bowl.fandom.com/wiki/Rookie), [Resting](https://retro-bowl.fandom.com/wiki/Resting) |
| TIPS | The in-game loading-screen tips, transcribed on r/RetroBowl: <https://www.reddit.com/r/RetroBowl/comments/t98smz/> (comment `hzstoie`) |
| APP | App Store version history (New Star Games release notes): <https://apps.apple.com/us/app/retro-bowl/id1478902583> |
| OS | Operation Sports reprints of official patch notes: <https://www.operationsports.com/retro-bowl-update-adds-kickoff-returns-replay-controls-updated-team-strengths-more-patch-notes/>, <https://www.operationsports.com/games/retro-bowl/> |
| ROB1/2/3 | Rob's Complete Guide to Retro Bowl: [roster basics](https://robwritesaboutwhatever.com/2021/04/20/robs-complete-guide-to-retro-bowl-roster-basics-and-player-evaluation/), [drafting and managing](https://robwritesaboutwhatever.com/2021/04/22/robs-complete-guide-to-retro-bowl-drafting-and-managing-players/), [winning games](https://robwritesaboutwhatever.com/2021/04/27/robs-complete-guide-to-retro-bowl-winning-football-games/) |
| LW | Level Winner guide: <https://www.levelwinner.com/retro-bowl-guide-tips-tricks-strategies-to-secure-wins-and-form-a-dominant-franchise/> |
| RED | r/RetroBowl threads, read through the Pullpush archive (reddit.com blocks direct fetches). Specific threads are linked inline. |
| WP | Wikipedia: <https://en.wikipedia.org/wiki/Retro_Bowl> |
| AAPL | Apple Newsroom, NFL Retro Bowl '26: <https://www.apple.com/newsroom/2025/08/apple-arcade-exclusive-nfl-retro-bowl-26-launching-september-4/> |

Claims marked "(prior run)" come from an earlier research pass over r/RetroBowl that this pass did not re-fetch. They
are kept at the confidence that pass gave them.

---

## 1. Ratings and what they do

| Claim | Conf. | Source |
|---|---|---|
| Every player has four attributes. QB: Accuracy, Arm, Speed, Stamina. RB/WR/TE: Catching, Strength, Speed, Stamina. OL: Blocking, Strength, Speed, Stamina. Defenders: Tackling, Strength, Speed, Stamina. K: Accuracy, Range, Speed, Stamina. | M | WIKI Positions, ROB1 |
| Arm sets the maximum pass distance. Accuracy sets how much of the aiming arc you see; with low accuracy a small misjudgement becomes an interception. | M | ROB1, LW |
| **A QB's arm strength wears down during a game according to his Stamina.** The kicker's range drops the same way. | H | WIKI Gameplay ("QB arm strength deteriorates the more you play depending on the QB's stamina"), TIPS |
| Catching governs catches under duress and ball security: better hands mean fewer fumbles. | H/M | TIPS, ROB1, WIKI Tips |
| Strength gives more stiff arms and broken tackles. Speed gives more hurdles and separation. Stamina is how long a player holds top speed, or for OL how long he keeps blocking. | H/M | TIPS, WIKI Positions, [RED](https://reddit.com/r/RetroBowl/comments/1p3ey0m/what_does_strength_stat_do_for_wrs/nq47nqv/) |
| Rookies fumble more and break fewer tackles, while experienced players avoid tackles better. | M | WIKI Rookie |
| Coordinators raise the play of non-star players. A higher-rated Defensive Coordinator improves the defensive players. | M | WIKI Defensive Coordinator / Offensive coordinator |
| "No amount of 5 star guys will be good if the defensive coordinator is only 1 star." | M | [RED](https://reddit.com/r/RetroBowl/comments/196nwdp/how_to_fix_my_defense/khv453w/) |
| Extreme difficulty makes every opponent play as a 5-star team. | M | WIKI Difficulty |
| Stars map to outcomes only through these attributes and the coordinators. Nobody has published a numeric star-to-result formula. | n/a | none found |

## 2. The simulated defense

| Claim | Conf. | Source |
|---|---|---|
| You cannot play defense. Opponent drives are simulated and shown as text boxes. | H | WP, ROB1 |
| Tackling is the key rating for every defensive position. The sim's failure messages are tackle-based ("missed the tackle", "wasn't strong enough", "was too slow"). | M | ROB1, ROB2 |
| A better defense downgrades opponent drives: TD → FG → miss → punt or failed 4th down. It raises the odds of stops and turnovers, but no numbers are known. | M (one detailed guide) | ROB1 |
| Community model: each sim drive checks a few of your defenders (up to about 3) plus a team/DC rating, so a few elite defenders beat a deep group of average ones. | M (prior run) | RED |
| DBs make most of the interceptions (speed matters), and DL make the sacks and forced fumbles. | L–M (prior run) | RED, WIKI Positions |
| Low morale makes defenders miss more tackles. | M | WIKI Morale |
| Drives are still streaky. Even 5-star defenses give up quick TDs when the CPU has time: "If you leave them a minute… they'll score every time." | L | [RED](https://reddit.com/r/RetroBowl/comments/1vg83lj/deep_passes_are_too_easy_running_is_impossible/p1vdhqy/), [review](https://inreviewcritics.com/2020/05/18/death-by-algorithm-retro-bowl-mobile-game-review-seasons-1-5/) |
| A kicker with more range kicks and punts deeper, which gives the defense a longer field. | M | [RED](https://reddit.com/r/RetroBowl/comments/1n7x7ca/what_difficulties_do_you_play_on_and_do_you/ncbb1y9/) |

**No source says a defender's per-game tackles, sacks, INTs or forced fumbles are the sim's inputs.** They are what
the sim produced from his ratings, so Team Lab's defense grades are an estimate.

## 3. 4th down, 2-point tries, kicks

| Claim | Conf. | Source |
|---|---|---|
| The 2-point try is one snap from the 2-yard line. | M | WIKI 2 point conversion / Conversions |
| A timeout lets you switch between the 1-point and 2-point attempt. | H | APP (v1.5.77) |
| Experienced players convert most 2-point tries (reports of 80–99%) and go for 2 by default. Some Hard-mode players say the opposite: "don't go for 2 unless necessary". | M / L | RED (prior run), [RED](https://reddit.com/r/RetroBowl/comments/196yojl/extreme_is_way_too_hard_and_dynamic_is_way_too/khx1vma/) |
| Football-math chart: go for 2 when down 14+ before the TD, when the PAT would only tie late, and so on. | L | ROB3 |
| The game rewards 4th-down aggression: treat giving the ball up as a likely opponent score, and go for it in their territory. | L–M | ROB3 |
| Onside kicks: patch notes "kicker accuracy affects onside kick chance" and "Fixed incorrect onside kick chance". | H | OS |
| Onside odds were about 5% in early versions. Since 1.5.17 they are roughly 10–20%, better with a good kicker. The option is only offered late in the 4th quarter when trailing. | H (5% fix) / M (current odds) | ROB3 (5%, max ~15% in 2021), RED prior run, [1.5.17 notes](https://reddit.com/r/RetroBowl/comments/twd3ab/the_retro_bowl_updated_has_been_confirmed_as/) |
| Field goals from 15 to 66 yards. Wind moves FGs and PATs. | M | WIKI Field Goals, Gameplay |
| Under the current kickoff rules a touchback goes to the 35. Kick returns are optional. | H | APP (v1.6.27) |
| Punts are automatic, with no punt returns. | M (prior run) | RED |

## 4. Clock, tempo and end of half

| Claim | Conf. | Source |
|---|---|---|
| Quarters run 1–3 minutes. You get 2 timeouts per half on 1–2 minute quarters and 3 on 3-minute quarters. | M | WIKI Gameplay |
| Timeouts can only be called when you have the ball. Stepping out of bounds stops the clock. | M / H | ROB3, TIPS |
| A QB slide out of bounds behind the line is a kneel, not a sack. | H | APP (v1.5.57) |
| A strong CPU offense goes the length of the field in about 25–40 s. Score last with under about 20–25 s left. | L–M | LW, RED prior run, [RED](https://reddit.com/r/RetroBowl/comments/1k6dvhz/extreme_difficulty_is_completely_inasane/mop897s/) ("on Extreme it becomes a clock-management game") |
| Both teams get an OT possession. | H | APP (v1.6.27) |

## 5. Passing, drops, fumbles

| Claim | Conf. | Source |
|---|---|---|
| INTs come from throws placed near a defender, short throws with a linebacker in the lane, and over-powered throws. | M | ROB3, [review](https://inreviewcritics.com/2020/05/18/death-by-algorithm-retro-bowl-mobile-game-review-seasons-1-5/) |
| Bullet passes are fast and low, and INT-prone if you misread coverage. Many experts never throw them. | M | WIKI Gameplay, [RED](https://reddit.com/r/RetroBowl/comments/1reqlsv/what_is_a_feature_that_you_always_forget_about/o7eodcl/) |
| Lead receivers into space. Over-the-middle throws are easier than sideline throws. High-Catching receivers rescue inaccurate balls. | M / L | ROB3 |
| There are no penalties, so a throwaway is always safe: an incompletion beats a sack or a pick. | M | ROB3 |
| Diving, or going out of bounds before contact, can't fumble. | H | TIPS |
| Tired players fumble more, and so do low-morale RBs and WRs. Rain and snow raise fumble chances. | H / M | TIPS, WIKI Morale, WIKI Gameplay |
| Trucking (1.6.25+) is slow and leaves the runner exposed. Each use costs more energy and charges more slowly (resets each down). It is weaker for low-Strength, non-star players and QBs. | H | APP |

## 6. Sacks and the offensive line

| Claim | Conf. | Source |
|---|---|---|
| OL Blocking is the key OL rating. TIPS say a stronger OL helps when rushed, and 1.5.57 gave star OL a slight buff. | H | TIPS, APP, WIKI Positions |
| "Fixed QB not being sacked for more than 5 yards" (sacks were capped before). | H | OS |
| Two careful community tests (114 plays, on video) found star OL barely change time-to-sack, with an unblocked rusher on more than half of plays. Throw quicker, use 2-TE sets, and throw it away. | M (prior run) | RED |
| Sacks cost the QB XP. | M | ROB2 |

## 7. Condition, injuries, morale, facilities, XP

| Claim | Conf. | Source |
|---|---|---|
| Condition falls the more a player plays, and faster for older players. Rest, rehab facilities and CC restore it. Stamina also speeds post-game recovery. | M | WIKI Condition, ROB1 |
| Injuries are rolled after games. They are likelier for heavily used, low-condition and older players, and rehab upgrades reduce them. Benched players can't get game-day injuries. | M / H | WIKI Injuries, APP (v1.6.1) |
| Morale tiers run from Exceptional (≥ 90%) down to Toxic (< 10%). Performance feeds morale and morale feeds performance. Tired players lose morale, and resting restores it. | M / H | WIKI Morale, TIPS |
| Training Facility: more XP per game. Rehab: better condition, faster recovery. Stadium: fan mood. | M | WIKI Facilities |
| XP comes from production (QB: yards and TDs, minus sacks and INTs). Each level adds 1 point to one attribute, levels get more expensive, and a fully maxed player earns a CC per level instead. | M | ROB2 |

## 8. NFL-licensed vs College

| Claim | Conf. | Source |
|---|---|---|
| NFL Retro Bowl '25/'26/'27 (Apple Arcade) is licensed by the NFL and NFLPA, with real players, a 12-man roster option and selectable kick-return rules. No documented change to the core sim. | H | WP, AAPL, [OS '27](https://www.operationsports.com/nfl-retro-bowl-27-available-today-on-apple-arcade-with-new-gauntlet-mode/) |
| Retro Bowl College adds a scholarship fund instead of a cap, graduations, GPA, and training intensity that trades XP against energy, morale and injury risk. **None of this applies to the owner's NFL save.** | M | WP, [retrobowl.me](https://retrobowl.me/retro-bowl-college-online) |

---

## What this means for Team Lab

Applied in `src/utils/teamLab.ts`:

1. **Defense grades are estimates.** The sim runs on ratings (Tackling first) and the DC. Box stats only trace them.
   - The defensive roll-up now weights tackles most: runDef 0.3, passRush 0.25, coverage 0.25, playmaking 0.2 (was 0.2 / 0.3 / 0.25 / 0.25).
   - The 4th-down notes say "estimated from box stats".
   - The "pin-deep" rule is now a *Tip*. It no longer claims that backed-up offenses throw into your rush, which no source supports.
2. **A strong defense downgrades drives; it doesn't stop them.**
   - Every 4th-down policy now goes for it on 4th & 1–2 past midfield. Before, the conservative policy did so only with offense ≥ 70.
   - The standard policy goes on 4th & 3–5 at their 40–25.
   - The aggressive text explains that a turnover on downs costs little when the opponent was likely to score anyway.
3. **Onside is a last resort (~10–20%, set by the kicker).** It is now its own rule for every team, replacing "onside in the last 3 minutes", which sat in the weak-defense rule.
4. **Go for 2 by default.** The 2-point try is one snap from the 2, and experienced players convert most.
   - Strong and standard red zones go at every chart margin.
   - Weak red zones keep the old standard chart.
   - All 2-point advice mentions the timeout switch.
5. **The QB's arm fades with Stamina.** The "deep" rule now says to take shots in the first half and make timing throws at the sticks late. It no longer promises "you have time in the pocket", because OL stars barely buy time.
6. **Ball security.** The fumbler rule adds: dive or step out before contact (can't fumble), and tired or low-morale carriers fumble more.
7. **Fatigue (new rule, Tip):** ration trucking, since each truck costs more energy. Spread touches, and rest Tired stars, since injuries follow heavy use and low condition.
8. **Clock.** Score last with under 20 s left, not 30, because simulated CPU drives score when given time. Save timeouts for the last 30 s; the count depends on quarter length.

Not applied, because the data has no ratings:
- Kicker range and wind for FG/punt calls.
- "Upgrade your best 3 defenders and the DC, not depth" (M, community model). It belongs in roster advice, not the in-game call sheet.
