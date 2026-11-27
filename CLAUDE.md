# Retro Vault

Fan stats hub for one Retro Bowl franchise save: stats, games, collection, Hall of Fame, Front Office.
Vite + React + TypeScript + Tailwind. Live at https://sakisaki-dev.github.io/RetroVault/. Every push to
`retrovault-v2` (or `main`) redeploys it through `.github/workflows/deploy-pages.yml`.

**This file is kept short on purpose** (owner, 2026-11-27: token limits). The full reference, every section that used
to be here word for word, is `docs/CLAUDE_REFERENCE.md`. Before working in an area, read its section there (grep the
`## ` / `### ` headings); never read the whole file. Step numbers ("step 5", "step 6c") in scripts and messages refer to
its "Updating: the upload pipeline" section.

| Doing | Read in docs/CLAUDE_REFERENCE.md |
|---|---|
| Any "update" / upload bundle | "Updating: the upload pipeline" (all of it: steps 1–7, the season update plan, the manifest example) |
| Speech / Season Story / Hot Takes / Tribute | "5. Speech", "6. Season story", "6b. Hot takes", "6c. Player tributes" |
| Reading the game's save | "Save import" |
| Stints, signature teams, HOF, eras, headlines, widget, rewind, records, collection economy, kits, sprites, market | "How the generated parts work" (the matching bullet) |
| Search, Home Screen app, share pictures, screensaver, Stats staging, club colours | the section of that name |

## The rule: data in, everything else generated

> "The only AI components in the entire system should be the speeches and the art lab variants. New information is
> uploaded through Claude in the backend; everything else must be heuristic, dynamic, and not dependent on AI
> intervention." (the owner)

The owner later approved a third AI lane, the Season Story: "option 1 give me the season story it can be multiple
articles in a news format or whatever you think is best I'm giving u creative liberty" (asked for as "for the timeline
section for what changed, make a story about the previous year … I want it in a news format").

On 2026-11-12 the owner approved a fourth AI lane, **Hot Takes** (chose "New AI lane"): columnist opinions about each
completed season, written like the Season Story and checked by the same fact-checker, every number cited.

On 2026-11-14 the owner approved a fifth AI lane, **Player Tributes** ("both yes" to "Should player tributes become a
new written article type, checked like the Season Story?"): a long-form feature on one player's whole career, checked
by the same fact-checker, every number cited.

| Kind | What | Where |
|---|---|---|
| **Data entry** (facts) | Career lines, awards, Super Bowls, coach seasons, weekly league scores and standings, record board, teams/trades/rosters, nicknames, owner-confirmed history ("one Titans season", "mainly a Seahawk"), card notes, the owner's own tags, sprite looks; the live state read from the game's save (see Save import) | `data/y80/players.json`, `super_bowls.json`, `coach.json`, `schedules.json`, `records.json`, `owner_facts.json`, `screenshot_extras.json`, `sprites.json`, `save_state.json` |
| **Owner prose** (verbatim) | Season notes about rivalries, disputes, drama, in the owner's words | `data/y80/journal.json` |
| **Generated** (rules over the data) | Eras, storylines, rivalries, lineages, snubs, outsiders, record chases, iron men, one-team legends, open questions, player tags and eras, Hall of Fame classes, career stints and their evidence text, market prices | `scripts/*.py`, `scripts/market_snapshot.ts` → `public/data/` |
| **AI-authored** (only these five) | Hall of Fame induction speeches; card art styles and custom sprites (Art lab; custom sprites retired with the sprite card, see step 2); the Season Story (news articles about each completed season); Hot Takes (columnist opinions about each completed season); Player Tributes (a long-form feature on one player's career) | `data/y80/speeches.json`; `src/components/collection/art/**`, `public/data/sprites/`; `data/y80/stories.json`; `data/y80/hot_takes.json`; `data/y80/tributes.json` |

Never hand-write analysis: no era write-ups, storylines, rivalry blurbs, player tags or per-player stint judgments.
If something reads like analysis, it must come out of a rule in `scripts/build_league_content.py` or
`scripts/infer_stints.py`. **Phone sessions write only facts (through an upload manifest), speeches, season
stories, hot takes and player tributes.**

## Single source of truth

The site loads only the bundled files in `public/data/`, which `npm run rebuild` builds from `data/y80/`. Never
hand-edit generated files, and never edit `data/y80/` directly: every change goes through an upload bundle.

`npm run rebuild` runs, in order: `infer_stints.py` (career stints) → `build_league_data.py` (league CSV, extras,
legends, sprites) → `season_ovr.py` (SZN, `public/data/league/season_ovr.json`) → `market_snapshot.ts` (Career Legacy / OVR snapshot) → `schedule_content.py` → `league_records.py` → `career_seasons.py` (`public/data/league/career_seasons.json`: each
player's card numbers and career totals at every season end, for the Deep Dive's career graphs) →
`hall_of_fame.py` → `save_state.py` (`public/data/league/save_state.json`) → `build_league_content.py`
(`public/data/league/content.json`) → `build_widget_data.py` (`public/data/widget.json`) → `build_app_icons.py --splash`
(the launch screens' line-up) → `audit.ts`. It is
deterministic: two runs give byte-identical output.

## Updating (summary; the full pipeline is in the reference)

### When the owner says "update"

1. Build the bundle (steps 1–3 below), then run **one command**: `npm run update -- data/uploads/<bundle>`. It
   validates and applies the bundle, rebuilds everything (stints, league data, market snapshot, eras, storylines,
   HOF classes, edition, audit), checks a season rollover, typechecks, runs `check:sprites` and `npm run build`, then
   prints a summary (players added or updated, players needing teams, records, new Hall of Famers, SPEECH NEEDED,
   STORY NEEDED, TAKES NEEDED, market movers, open questions, the new edition) and stops. It never commits.
2. If it printed `SPEECH NEEDED`, write the speech (step 5) as a `speech.set` mutation in a follow-up bundle and run
   `npm run update` on that bundle.
3. If it printed `STORY NEEDED: Y<n>` (a season completed with no story), write the Season Story (step 6) as a
   `story.set` mutation in a follow-up bundle and run `npm run update` on that bundle.
4. If it printed `TAKES NEEDED: Y<n>` (a season completed with no hot takes), write the Hot Takes (step 6b) as a
   `takes.set` mutation in a follow-up bundle and run `npm run update` on that bundle.
5. If it printed `TRIBUTE NEEDED: Y<n> POS:Name (<reason>…)` (the season's one tribute pick, chosen by the rule in
   step 6c, has none yet), write the tribute (step 6c) as a `tribute.set` mutation in a follow-up bundle and run
   `npm run update` on that bundle. The `tribute queue: N players` line is information only.
6. Commit and push with the commands it prints (step 7).

## Owner facts (confirmed; don't "correct" them)

- The current club is the **Eagles** (from Y88; owner: "in this new season i've moved to the eagles"). Before that the
  Falcons Y83–87 (owner: "I switched teams to the falcons") and the Jets Y76–82. The coach is Dorren Skura; his coached
  seasons are in `coach.json` and the current stint is its `currentStint` ({team, abbr, from}), mirrored by
  `current_club` in `owner_facts.json`. Code never hard-codes
  the club: it reads `currentClub()` / `useCurrentClub()` (`src/utils/club.ts`); the audit errors if the two disagree.
- Real NFL legends appear only in the games, never in league stats or the Collection (cards are league players only).
- Active players show an **Active** tag (owner: "add in a little in the league rn indicator for the players that are",
  "An active tag"): `InLeague` / `isInLeague` in `src/components/InLeague.tsx`, active on a club only (no free agents,
  no real NFL legends), in search rows, the player picker, the Deep Dive and game cards; never on a collectible card's
  face (cards are timeless) and never as a game clue. Retired is still never shown.
- Single-season stats are intentionally not tracked.

## Code notes

- How the game itself works (read from its code: player record, aging, retirement ages, season ratings and awards,
  assets and mods): `docs/GAME_MECHANICS.md`. Stories and takes may use it to explain; site rules stay our own.
- Formulas and metric definitions: `docs/STATS_REFERENCE.md`, `src/config/stats.ts`, `src/config/advanced.ts`
  (similarity), `src/config/skillGrades.ts` (S–F grades), `src/config/ovr.ts` (official OVR).
- Fetch data with `${import.meta.env.BASE_URL}data/...`, never `/data/...`, because Pages serves the site under `/RetroVault/`.
- Routing is hash-based (`#stats/deepdive?p=QB:Name`); see `src/components/stats/hub/hashRoute.ts`.
- Keep every save compiling; the owner often has the dev server open.
