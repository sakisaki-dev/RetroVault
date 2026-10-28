# Retro Vault

Fan stats hub for one Retro Bowl franchise save: stats, games, collection, Hall of Fame, Front Office.
Vite + React + TypeScript + Tailwind. Live at https://sakisaki-dev.github.io/RetroVault/. Every push to
`retrovault-v2` (or `main`) redeploys it through `.github/workflows/deploy-pages.yml`.

## The rule: data in, everything else generated

> "The only AI components in the entire system should be the speeches and the art lab variants. New information is
> uploaded through Claude in the backend; everything else must be heuristic, dynamic, and not dependent on AI
> intervention." (the owner)

The owner later approved a third AI lane, the Season Story: "option 1 give me the season story it can be multiple
articles in a news format or whatever you think is best I'm giving u creative liberty" (asked for as "for the timeline
section for what changed, make a story about the previous year … I want it in a news format").

| Kind | What | Where |
|---|---|---|
| **Data entry** (facts) | Career lines, awards, Super Bowls, coach seasons, record board, teams/trades/rosters, nicknames, owner-confirmed history ("one Titans season", "mainly a Seahawk"), card notes, the owner's own tags, sprite looks | `data/y80/players.json`, `super_bowls.json`, `coach.json`, `records.json`, `owner_facts.json`, `screenshot_extras.json`, `sprites.json` |
| **Owner prose** (verbatim) | Season notes about rivalries, disputes, drama, in the owner's words | `data/y80/journal.json` |
| **Generated** (rules over the data) | Eras, storylines, rivalries, lineages, snubs, outsiders, record chases, iron men, one-team legends, open questions, player tags and eras, Hall of Fame classes, career stints and their evidence text, market prices | `scripts/*.py`, `scripts/market_snapshot.ts` → `public/data/` |
| **AI-authored** (only these three) | Hall of Fame induction speeches; card art styles and custom sprites (Art lab); the Season Story (news articles about each completed season) | `data/y80/speeches.json`; `src/components/collection/art/**`, `public/data/sprites/`; `data/y80/stories.json` |

Never hand-write analysis: no era write-ups, storylines, rivalry blurbs, player tags or per-player stint judgments.
If something reads like analysis, it must come out of a rule in `scripts/build_league_content.py` or
`scripts/infer_stints.py`. **Phone sessions write only facts (through an upload manifest), speeches and season
stories.**

## Single source of truth

The site loads only the bundled files in `public/data/`, which `npm run rebuild` builds from `data/y80/`. Never
hand-edit generated files, and never edit `data/y80/` directly: every change goes through an upload bundle.

`npm run rebuild` runs, in order: `infer_stints.py` (career stints) → `build_league_data.py` (league CSV, extras,
legends, sprites) → `market_snapshot.ts` (Career Legacy / OVR snapshot) → `build_league_content.py`
(`public/data/league/content.json`) → `build_widget_data.py` (`public/data/widget.json`) → `audit.ts`. It is
deterministic: two runs give byte-identical output.

## Updating: the upload pipeline (the usual phone request)

### When the owner says "update"

1. Build the bundle (steps 1–3 below), then run **one command**: `npm run update -- data/uploads/<bundle>`. It
   validates and applies the bundle, rebuilds everything (stints, league data, market snapshot, eras, storylines,
   HOF classes, edition, audit), checks a season rollover, typechecks, runs `check:sprites` and `npm run build`, then
   prints a summary (players added or updated, players needing teams, records, new Hall of Famers, SPEECH NEEDED,
   STORY NEEDED, market movers, open questions, the new edition) and stops. It never commits.
2. If it printed `SPEECH NEEDED`, write the speech (step 5) as a `speech.set` mutation in a follow-up bundle and run
   `npm run update` on that bundle.
3. If it printed `STORY NEEDED: Y<n>` (a season completed with no story), write the Season Story (step 6) as a
   `story.set` mutation in a follow-up bundle and run `npm run update` on that bundle.
4. Commit and push with the commands it prints (step 7).

### Season update plan: what is AI and what is a rule

Everything an update touches, in order. **AI** steps are the only places a model writes or reads something; every
other row is a deterministic rule that `npm run update` / `npm run rebuild` runs with no AI involvement.

| # | Step | AI or rule | Trigger | How / where |
|---|---|---|---|---|
| 1 | Read the screenshots (career cards, Super Bowl list, staff screen, record board, rosters, HOF pages) | **AI** (`transcribe`) | New images in the upload | `player.set`, `superbowl.set`, `coach.season` / `coach.set`, `record.set`, `fact.set active_rosters/…` |
| 2 | Describe new portraits as sprite looks | **AI** (`portrait→look`) | The upload has portraits | `sprite.set` |
| 3 | Owner notes → journal entries with tags | **AI** (`tag notes`, text copied verbatim) | `notes.md` present | `journal.add` |
| 4 | Owner-stated facts: teams, trades, club switch, retirements, nicknames, card notes, signature teams, `career.never` | Data entry (owner's words) | Owner says it | `fact.set` / `fact.remove` / `player.set {nick}`; ask for teams of new players (`UNK`) |
| 5 | Career stints and their evidence text | Rule | Every rebuild | `infer_stints.py` |
| 6 | League sheet, extras, signature (banner) teams, active/retired status | Rule | Every rebuild | `build_league_data.py` (`signature_team()`) |
| 7 | Market snapshot (OVR, skill, Career Legacy, value, grade, totals) | Rule | Any rating changed | `market_snapshot.ts` → `market_history.json` |
| 8 | Eras, storylines, rivalries, lineages, snubs, record chases, open questions, HOF classes, headlines ("The Wire"), edition seed | Rule | Every rebuild | `build_league_content.py` |
| 9 | Skill grades, player families (map zones), similarity, Deep Dive boards | Rule (computed in the app) | Data changes | `src/config/skillGrades.ts`, `families.ts`, `advanced.ts` |
| 10 | Widget feed: the latest story's articles, its written facts plus rule-generated "Did you know" facts, "From the Vault" history cards, movers, headlines, HOF watch, record chases, milestone countdowns, the champion, banner cards | Rule | Every rebuild | `build_widget_data.py` → `public/data/widget.json` |
| 11 | Hall of Fame speech for each new member | **AI** (`speech`) | Rebuild prints `SPEECH NEEDED` | `speech.set` (step 5) |
| 12 | Season Story: news articles plus written "Did you know" facts for the completed season | **AI** (`story`) | Rebuild prints `STORY NEEDED: Y<n>` | `story.set` (step 6); professional voice, no "owner", only true facts |
| 13 | Refresh speeches or stories whose numbers went stale | **AI** (same lanes) | Audit warns that a cited number no longer matches | `speech.set` / `story.set` |
| 14 | Card art styles, custom sprites | **AI** (`art`) | Only when the owner asks | Art lab, `sprite.image`, `card.design` |
| 15 | Checks: audit (0 errors), typecheck, sprite check, build | Rule | `npm run update` | `audit.ts`, `check_sprites.ts` |
| 16 | Publish: commit and push (Pages redeploys), rebuild the LAN preview (`npm run build`), the widget picks up `widget.json` (and its own code) within about 2 hours | Rule | After the checks pass | Step 7 |

After an update, ask the owner about anything left open: new players' teams, a misread the audit flagged, open stint
questions in content.json.

The owner sends Retro Bowl screenshots (and maybe a few lines about the season) and asks to "add these". One upload
is one bundle, `data/uploads/<YYYY-MM-DD>-<slug>/`:

- `manifest.json`: the structured mutations (format below)
- `notes.md`: the owner's free text, copied verbatim (only if they wrote some)
- `images/`: the screenshots (or list their paths in the manifest). **Local only:** `.gitignore` keeps every
  bundle image out of git (owner rule: screenshots never go to GitHub); the manifest still names them.

### 1. Transcribe (AI step `transcribe`; trigger: new images)

Each player card shows `POS - FIRST LAST` and GAME / SEASON / CAREER panels. **Use only the CAREER panel**, plus
the award row (RINGS, MVP, OPOY, DPOY, ROTY, SBMVP). players.json keys:

- QB: `g att cmp yds td int sck ratt ryds rtd`
- RB: `g ratt ryds rtd fum rec recyds rectd`
- WR/TE: `g rec yds td fum lng`
- OL: `g blk`
- LB/DB/DL: `g tkl int sck ff`
- awards: `rings mvp opoy dpoy roty sbmvp`

Read the pixel digits carefully and cross-check: rushing/receiving `Avg` = yards ÷ attempts (or catches); **QB
passing `Avg` = yards ÷ completions**; `Cmp (x%)` = cmp ÷ att. A QB or RB often spans two screenshots; merge them
into one mutation. Career totals only go up; `apply-upload` refuses a drop (a misread) unless you re-check and mark it.
New players: add them with `team` from the owner. If the owner hasn't said, use `"UNK"` and **ask for their teams**
(stars beside a name don't reliably mean the current team).

Other screens: Super Bowl list → `superbowl.set` (gold rows are the owner's wins); staff screen → `coach.season` /
`coach.set`; the owner switching clubs before the new club plays → `coach.set currentStint` `{team, abbr, from}` plus
`fact.set current_club` (no `coach.season` row until the season is played); record board → `record.set`; team screens → `fact.set active_rosters/<Team>`; game Player HOF screen →
`fact.set players/<name>/retired_with`. The site's Hall of Fame is its own (Career Legacy ≥ 7000); the game's HOF
list must not add or remove anyone. Stale lines in `screenshot_extras.json` (e.g. "Y80, in progress") →
`extras.set <section>/<key>` (value `null` deletes it).

### 2. Looks (AI step `portrait→look`; trigger: the upload has portraits)

Describe portraits as sprite fields (`sprite.set`, the `data/y80/sprites.json` format: skin, hair, facial,
accessories, build, height, pose, eyes, signature). Custom sprite images and card-design requests (`sprite.image`,
`card.design`) only when the owner asks (AI step `art`).

- **Standardisation rule:** everything is standard unless specified. Players with no `sprites.json` entry all get the
  same generic character (standard face and body) and vary only by stable rolls seeded by name (hair style, hair
  colour, facial hair, eye colour; loosely matched to the skin tone), the skin toggle (Player editor → Sprite skin tone,
  stored with the player edits; "Auto" = the neutral default), the pose roll, the uniform roll (home, rarely an
  alternate) and the number. Only players with a `sprites.json` entry (locked looks from portraits, owner requests)
  deviate: build, signature pose, face, and any hair, facial-hair, eye or `eyeColor` field they set (locked fields win
  field by field; the rolls fill the rest). Only describe league players
  with cards; skip real-NFL players who just share a surname.
- **Custom pixel image:** put the PNG in the bundle and use `sprite.image` (`{"file": "images/x.png", "as":
  "<slug>.png"}`); it is copied to `public/data/sprites/<slug>.png` and listed as `"image"` in the look, replacing the
  generated sprite. Use a transparent background, feet at the bottom edge, about 58 × 60 pixels.
- Pose keys and names: the Art lab's Poses strip (`src/components/collection/art/sprite/poses.ts`); a `pose` lock may
  use the key or the name ("Heisman pose"). The sprite modules are documented in
  `src/components/collection/art/sprite/README.md`; helmet logos are regenerated with
  `python3 scripts/build_helmet_logos.py` (hand-drawn glyphs, no network). After any sprite change run `npm run check:sprites` (every
  pose draws the same head and torso, one baseline, contact poses have stand-ins).

### 3. Notes (AI step `tag notes`; trigger: `notes.md` present)

Each owner note becomes a `journal.add` with the text **copied exactly** (apply-upload checks it appears verbatim in
`notes.md`) and tags: `players`, `teams`, `seasons`, `kind` (`rivalry` | `dispute` | `drama` | `note`). Never
rewrite, summarize or add prose. Owner-stated facts ("he was traded to the Falcons") also become `fact.set`
mutations with `source: "owner"`, e.g. `players/<name>/team`, `team_history`, `career` (`order`, `on`, `stints`,
`longest`, `next_team`, `never`, `says`), `tag`, `card`, `signature_team` (the club his card and banners wear: "where he
was best").

### 4. Apply, rebuild, check

```bash
npm run apply-upload -- data/uploads/2026-10-21-y81-week1 --check   # validate only
npm run apply-upload -- data/uploads/2026-10-21-y81-week1           # apply, log in data/y80/mutations_log.json, rebuild
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

A manifest applies once (its id is logged). `npm run audit` must have 0 errors: it checks every mutation has a
source, reason and trigger, that owner text (nicknames, owner tags, card notes, quotes, journal) matches an applied
manifest, that every Hall of Famer has a speech and every speech belongs to a Hall of Famer, and that speech numbers
still match the data. Read the warnings.

### 5. Speech (AI step `speech`; trigger: the rebuild prints `SPEECH NEEDED: <name>`)

Only when the rebuild finds someone who first crossed Career Legacy 7000 with no speech, or the owner corrects one.
Write it as a `speech.set` mutation (lane `speech`, target the player's name, value `{"reason": "New Hall of Famer",
"trigger": "First crossed Career Legacy 7000: <class>", "text": "..."}`, with the `speech` AI step logged) and apply
the bundle; apply-upload checks the length, the em dash and the closing line, and the audit fails if the speech later
differs from the manifest. Never let the generic template in `src/components/ceremony/speech.ts` show. Match the
existing speeches: a one-line hook, then 2–3 short paragraphs, closing "…, welcome to the Hall of Fame."; about
120–190 words; only facts from the data (play style from his rates, never invented looks or quotes); no em dashes.

### 6. Season story (AI step `story`; trigger: the rebuild prints `STORY NEEDED: Y<n>`)

When a season completes (a new `coach.season` row) and `data/y80/stories.json` has no story for it, the rebuild prints
`STORY NEEDED`. Write a news package about that season in a bundle `data/uploads/<date>-story-y<n>/` with one
`story.set` mutation: lane `story`, target the season (`"Y82"`), source `"data:<files read>"`, the `story` AI step
logged, value `{reason, trigger: "Season Y<n> completed (coach.season <n>)", tagline, articles}`. A rewrite (a
correction, stale numbers) is another `story.set` for the same season.

Article: `{id, kind, headline, dek, body: [paragraphs], players: [names], teams: [names], stats: [{label, value,
source}], related: [ids of earlier articles it continues]}`. `kind` is `lead` (exactly one) | `feature` | `trade` |
`rise` | `fall` | `rivalry` | `chase` (record watch) | `milestone` | `wherenow` | `quickhits` (at most one; `body` is
4–8 one-liners). About 7–10 articles. Ids are unique across seasons (`y82-...`); `related` may point at an earlier
season's article, which the Timeline shows as "Continued from…". The first `stats[]` entry is the card's big number.
The season value may also carry `didYouKnow: [{id, text, players, stats}]`: short standalone facts (statistical
outliers with small samples, rookies posting elite numbers, oddities like most rings without an MVP), at most 40 words
each, under the same rules; the Timeline shows them as a rail and the Arcade widget shows one a day.

Research first: players.json, the two market snapshots around the season (career deltas, OVR, grades, values),
super_bowls.json, coach.json (and `currentStint`), owner_facts (trades, current club, careers), journal.json,
records.json, content.json (storylines, rivalries, headlines, record chases, eras), stints.json, families.

Write it as a professional sports outlet covering a real league (owner: "love the stories but remove my words or
'the owner', treat it like a professional story"). Creative liberty (owner: "feel free to take creative liberty on how
the players feel and what it means etc etc"): narrative voice, emotion, stakes and interpretation are welcome ("you
could feel Lock's relief in New York", what a trade means for a franchise or a rivalry). Hard rules:
- Every fact, number, team and who-went-where is true to the data: stats, Super Bowls, coach seasons, trades and owner
  facts, the record board, the market, stints, families, skill grades, headlines. Trades are told as the whole chain,
  ending at each player's final club (owner: "oxley went to the bears, there were so many trades").
- Never mention the owner, his notes or the person playing the save, and no second person ("you", "your"). The coach
  is Dorren Skura ("Skura", "the coach", "the head coach"). What the owner told us is restated as plain reported
  fact with no attribution (Conklin is "Takeoff" for a vertical that catches anything above his head; nobody Skura
  has coached recovered more fumbles than Van Oxley).
- Nothing in quotation marks except a player's nickname: no journal quotes, no direct quotes attributed to players or
  coaches, and no invented contracts or off-field events.
- Missed games and injury as a possible contributor (owner: "note that some players play less games due to injury";
  "update the stories, include injuries etc as well as another possuble controbutor into the stories etc"): when a
  player's games for the season (the `s.g` change between the two snapshots around it) are fewer than his club played
  (a teammate's full count, e.g. the champion's 20), the story may say he missed time and that injury may have played
  a part, alongside other possible contributors (age, a lost role, a new team). Always frame it as a possibility
  ("missed time", "may have been slowed by injury"), never name a specific injury, body part or diagnosis, and cite
  the games figure (and the gap, as `<a> minus <b>`).
- Play style comes from rates (yards per catch, tackles per game…), never from imagined looks.
- No em dashes. Lead body 180–350 words, other articles 90–220.
- Every number written in a headline, dek or body is in that article's `stats[]` with its source. Sources
  (`scripts/story_check.py` documents them all): `players.json QB:Ty Lock yds` (a career total; `yds/rec` for a
  rate), `market_history.json <snap> <POS:Name> <field>` or `<snapA>..<snapB>` for the change on a season's card
  (`s.yds`, `ovr`, `value%`, `s.yds/s.rec`), `super_bowls.json Y82 <field>`, `coach.json Y82 record` /
  `coach.json superBowlRecord/0/titles`, `records.json <record> mark`, `content.json rivalries/[id=rival-eagles]/record/won`,
  `<a> minus <b>` for a gap, `crossed: market_history.json <A>..<B> <POS:Name> <field>` for a round milestone passed.

apply-upload runs `scripts/story_check.py` on the mutation (lengths, em dashes, tags exist, every stats value matches
its source, every number in the text is cited, no "owner" or second person, only nicknames in quotes) and refuses the
bundle on any failure. The
audit re-checks the stored stories: a figure that no longer matches the data after a later update is a warning (stale,
like speech numbers), and a story that differs from its applied manifest is an error. The Timeline's "What changed"
area shows it (`src/components/news/SeasonStory.tsx`: masthead, lead hero, feed, quick hits, reading sheet, season
switcher), with the rule-based headlines as "The Wire" above it; the Arcade ticker links to the lead.

### 7. Commit and push

Commit to `retrovault-v2` with a message listing who was added or updated (include the bundle). The site redeploys
in about two minutes. Reply with a short summary: updated players, new players needing teams, anything notable
(records broken, new Hall of Famers, open questions in content.json).

### Manifest example

```json
{
  "id": "2026-10-21-y81-week1",
  "created": "2026-10-21",
  "images": [
    {"file": "images/IMG_6301.PNG", "shows": "QB Ty Lock career card"},
    {"file": "images/IMG_6302.PNG", "shows": "Super Bowl winners list"}
  ],
  "ai_steps": [
    {"step": "transcribe", "reason": "Images need reading", "trigger": "New images in the upload"},
    {"step": "tag notes", "reason": "Link the owner's notes to players and teams", "trigger": "notes.md present"}
  ],
  "mutations": [
    {"lane": "stats", "op": "player.set", "target": "QB:Ty Lock",
     "value": {"g": 61, "att": 1980, "cmp": 1402, "yds": 15880, "td": 171, "int": 31, "rings": 1},
     "source": "image:images/IMG_6301.PNG", "reason": "Career panel", "trigger": "New image"},
    {"lane": "stats", "op": "superbowl.set", "target": "Y81",
     "value": {"number": 140, "roman": "CXL", "winner": "Jets", "score": "31-24", "loser": "Chiefs",
               "your_result": "won", "your_team": "Jets"},
     "source": "image:images/IMG_6302.PNG", "reason": "Super Bowl winners list", "trigger": "New image"},
    {"lane": "stats", "op": "fact.set", "target": "players/Obinna Leary/team", "value": "Seahawks",
     "source": "owner", "reason": "Owner: traded to Seattle", "trigger": "Owner statement in notes.md"},
    {"lane": "notes", "op": "journal.add", "target": "y81-chiefs-feud",
     "value": {"text": "The Chiefs ran up the score in week 3. I haven't forgotten.", "kind": "rivalry",
               "season": "Y81", "players": [], "teams": ["Chiefs"], "seasons": [81]},
     "source": "owner", "reason": "Owner season note", "trigger": "notes.md present"}
  ]
}
```

The first bundle, `data/uploads/2026-10-19-y80-initial/`, is the backfilled record of everything before the
pipeline existed (IMG_6141–6205, the coaching screen recording, owner facts given in chat). Applying it to the
current data is a no-op.

## Owner facts (confirmed; don't "correct" them)

- The current club is the **Falcons** (from Y83; owner: "I switched teams to the falcons"). Before that the Jets,
  Y76–82. The coach is Dorren Skura; his 82 coached seasons are in `coach.json` and the new stint is its
  `currentStint` ({team, abbr, from}), mirrored by `current_club` in `owner_facts.json`. Code never hard-codes
  the club: it reads `currentClub()` / `useCurrentClub()` (`src/utils/club.ts`); the audit errors if the two disagree.
- Real NFL legends appear only in the games, never in league stats or the Collection (cards are league players only).
- Active/Retired status is internal only; never show it in the UI.
- Single-season stats are intentionally not tracked.

## How the generated parts work

- **Career stints** (`scripts/infer_stints.py` → `data/y80/stints.json`): ring arithmetic over Super Bowl winners,
  games per season, hard anchors from the record board (`records.json` counts the owner's club only) and from
  `owner_facts.json` (`career.on`, `career.stints`, `season_rosters`), and the owner's order of clubs. Evidence text
  is templated ("4 rings = Chargers Y10, Y11, Y14, Y15"). Ambiguous players become `openQuestions` in content.json;
  the owner's answer is a `fact.set players/<name>/career` mutation.
- **Signature team** (`signature_team()` in `scripts/build_league_data.py` → `signatureTeams` in
  `public/data/player-extras.json`): the club a player's card, art, walkout, HOF card and player banners wear. Owner
  rule: "for the banners if its a current team always change to whatever their current team is, the banner only
  takes the best years after they retire since that's what's best known." **Active** players always wear their
  current team (overriding the stint rule and any owner `signature_team` fact, which stays stored and takes effect
  once he retires). **Retired** players: owner fact `players/<name>/signature_team`, else the card's `legacy_team`,
  else the stint with the most rings, then most seasons, then earliest; no stints = current team. Stats, rosters,
  filters, jersey numbers and market keys keep the current team (`signatureTeamOf` / `withSignatureTeam` in
  `src/utils/playerExtras.ts`); the player card's "Latest club" line shows for retired players only. Audit errors
  when an active player's banner isn't his current team, and warns when a retired player's is a club he has no stint
  with.
- **Eras**: the owner's coaching stints (`coach.json`), split at 3+ title-less seasons between titles and merged when
  a stint won fewer than 3 titles (the current stint always stands alone); named "<Team> dynasty" (5+ titles),
  "<Team> run" (3–4) or "<Team> years". Key players: best Career Legacy whose stints overlap the era on the owner's club.
- **Edition seed** (`edition` in content.json, `src/utils/edition.ts`): FNV-1a of the season, the number of applied
  uploads and the last upload's id. It changes on every update and never between two rebuilds. Rotating,
  non-identity picks key off it (featured players, hero picks, Front Office headline order, featured storylines, the
  pack shelf accent) so the site looks fresh after each update. Never use it for player identity: sprite looks, owned
  card art, poses and uniforms stay stable.
- **Current season**: derived from the data (the owner's last season in `coach.json`; `latestSeasonYear()` in
  `src/utils/leagueContent.ts` on the site). Never hard-code "Y80" or 80 as "now"; a rollover is just new
  `coach.season` + `superbowl.set` mutations. `career.never` (owner: clubs a player never played for) keeps the stint
  solver and the audit away from those clubs.
- **Hall of Fame classes**: who first crossed Career Legacy 7000 at each market snapshot, labelled by the snapshot's
  season; the first snapshot's members are the "Inaugural class".
- **"What changed" headlines** (`build_headlines()` in `build_league_content.py` → `content.json` `headlines`
  `[{kind, text, players, teams, weight}]` + `headlinesInfo`): templated news, ranked by weight (ties by kind, then
  text; at most 2 per player). Inputs: the last two market snapshots (each point carries `grade` and the career totals
  `s`; `market_snapshot.ts` writes them and records the bundle as `upload`), the mutations of the bundles between
  them (`mutations_log.json` → manifests), `records.json`, `super_bowls.json`. Rules: Super Bowls of a rolled-over
  season; record.set / records dated in it; owner `players/<name>/team` facts ("Traded: …"); crossed Career Legacy
  7000; new cards; career totals passing a step (10,000 passing yards, 5,000 rushing / receiving yards, 100 passing
  TDs, 500 tackles…); award counts; skill grade families (S/A/B…, `skillGrades.ts` GRADE_SCALE); market movers (≥ 5%,
  base value ≥ 50); plus up to 2 record chases (≥ 85% of the mark). If the latest bundle changed nothing headline-worthy,
  it walks back to the last snapshot pair that did and marks it "Last update". Shown on the Arcade landing (ticker +
  Spotlight) and in full on the Timeline (`src/components/news/WhatChanged.tsx`); `npm run update` prints them.
- **Edition** (`content.edition`, `src/utils/edition.ts`): one seed per applied upload, stable across rebuilds. Used
  only for rotating presentation: Front Office featured stint players and rivals order, Timeline storyline order, the
  landing Spotlight (up to 2 headline players, then top Career Legacy, shuffled per edition) and the Collection
  hero / pack shelf accent (`EDITION_ACCENTS`). Never for player identity (looks, card art, poses, uniforms).
- **Widget feed** (`scripts/build_widget_data.py` → `public/data/widget.json`, about 67 KB): the only file the
  Scriptable iPhone widget (`public/widgets/retro-vault-widget.js`) reads, from raw GitHub, then Pages, then its cache.
  Templates only, numbers straight from the data: `stories` (the latest Season Story's articles, no quick hits),
  `didYouKnow` (the story's written facts, then rule facts up to 100: record chases, active players closing on a
  `MILESTONES` step, up-and-comers with an S/A grade or OVR 85+ in 60 games or fewer, oddities such as most rings
  without an MVP, one-team legends, small-sample standouts, rate leaders per position with a minimum sample, career
  leaders and the active leader, iron men; every rate names its stat, e.g. "scores a touchdown on 27.3% of his
  catches", via `UNIT`), `vault` (every Super Bowl with the owner's wins flagged, the record board credited to the
  owner's club that year, each Hall of Famer with his speech's first line, class and Career Legacy, the generated
  storylines), `movers` (top 2 risers and top faller, base value ≥ 50), the top 4 `headlines`, `spotlightFallback`,
  `hofWatch` (top 5 active players under Career Legacy 7,000: points to go, share), `chases` (the closest active
  record chases: have, mark, share, amount to go), `milestones` (top 6 countdowns to a round career number),
  `champion` (the latest season's Super Bowl), `coach` (surname), `cards` (banner team, OVR, grade, Career Legacy,
  value change for every player named) and `latestUpdateAt` (last applied upload). Widget text never says "you" or
  "your": history cards name the coach ("Skura's Ravens won it", "Set on Skura's Ravens in Y46") and storylines are
  rewritten to the third person (`third_person()`); headlines are title-cased with OVR/MVP/II kept (`title_case()`).
  **One script, every size** (`config.widgetFamily`): large (header, story, spotlight, two rotating panels, footer),
  medium (story beside the spotlight), small (spotlight only), lock screen inline (even days "🏈 Y82 · Jets won
  CXLI", odd days a countdown), circular (gauge of the closest record chase, its % and surname, drawn with
  DrawContext) and rectangular (story headline plus a one-line countdown); lock screen layouts are white-only so they
  tint. **Rotation**: one story a day (the lead pinned and tagged BREAKING for 2 days after an update), a spotlight
  that changes at midnight and noon, alternating Did you know and From the Vault, each pool shuffled by
  `edition.seed` (nothing repeats until the pool is spent); bottom panels on even days and the 2 days after an
  update MARKET + THE WIRE, on odd days HOF WATCH + RECORD CHASE (every other odd day MILESTONES instead).
  `refreshAfterDate` is the sooner of 2 hours from now and the next noon/midnight, so a pushed update reaches the
  widget within about 2 hours while the rotation still turns only at noon and midnight. **Look** (the site's tokens from
  `src/index.css`, calm on purpose): the background is a DrawContext image (navy gradient, faint scanlines at the top)
  whose one gold element is the signature gold gradient rim (bright gold top-left to deep amber bottom-right). No header
  banner: the story comes first and the footer carries "Y82 · ED 34 · <last update>". Content padding (`PAD`) keeps
  everything at least 10 pt inside the rim. Cards and panels are fixed-size stacks with their own background image
  (panel fill clipped to the rounded shape, a quiet `--line` rim, a faint team tint and rim, team stripe and dimmed
  logo watermark on player cards). Kickers are muted pixel text from a 5-row glyph table (after Silkscreen) with 7×7
  pixel icons; body text is chalk. **Team colours carry the identity**: every player name (spotlight, market, HOF
  watch, record chase, milestones, small widget) and its progress bar wear the club colour from `teamInk()`, which
  keeps the hue and raises lightness until it reaches 4.5:1 on `#111627`, `#1a2137` and `#090d1a`, switching dark
  navy/black primaries to a real secondary (Bears orange, Patriots red); a fact that opens with the name drops it under
  the coloured name line; wire bullets wear the headline's club (`team` per headline, rule-built). Pixel ▲/▼ arrows,
  neutral rank badges, a red BREAKING tag; team logos are ESPN's dark-background marks (`500-dark`, 120 px via the
  CDN combiner), cached, replaced by the colour bar offline. Every field
  is optional, so an older cached widget.json still draws. The widget's Parameter field sets the tap: empty = the
  site, a Shortcut's name = `shortcuts://run-shortcut`, a URL = as is. The audit errors if widget.json is missing,
  stale (season or edition differs from content.json), names a player without a card (facts, vault, fallback, HOF
  watch, chases, milestones) or an item without a `team` (or with a club outside the 32), has an incomplete countdown, a champion from another season, or "you/your" outside a
  Hall of Fame speech hook.
- **Card market**: `scripts/market_snapshot.ts` appends a snapshot to `data/y80/market_history.json` (built into
  `public/data/market.json`) whenever any player's OVR, skill or Career Legacy changed. The value formula lives in
  `src/utils/cardMarket.ts`. Never hand-edit either file; rebuild and commit both.

## Code notes

- Formulas and metric definitions: `docs/STATS_REFERENCE.md`, `src/config/stats.ts`, `src/config/advanced.ts`
  (similarity), `src/config/skillGrades.ts` (S–F grades), `src/config/ovr.ts` (official OVR).
- Fetch data with `${import.meta.env.BASE_URL}data/...`, never `/data/...`, because Pages serves the site under `/RetroVault/`.
- Routing is hash-based (`#stats/deepdive?p=QB:Name`); see `src/components/stats/hub/hashRoute.ts`.
- Keep every save compiling; the owner often has the dev server open.
