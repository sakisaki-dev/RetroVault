# Retro Vault

Fan stats hub for one Retro Bowl franchise save: stats, games, collection, Hall of Fame, Front Office.
Vite + React + TypeScript + Tailwind. Live at https://sakisaki-dev.github.io/RetroVault/. Every push to
`retrovault-v2` (or `main`) redeploys it through `.github/workflows/deploy-pages.yml`.

## The rule: data in, everything else generated

> "The only AI components in the entire system should be the speeches and the art lab variants. New information is
> uploaded through Claude in the backend; everything else must be heuristic, dynamic, and not dependent on AI
> intervention." (the owner)

| Kind | What | Where |
|---|---|---|
| **Data entry** (facts) | Career lines, awards, Super Bowls, coach seasons, record board, teams/trades/rosters, nicknames, owner-confirmed history ("one Titans season", "mainly a Seahawk"), card notes, the owner's own tags, sprite looks | `data/y80/players.json`, `super_bowls.json`, `coach.json`, `records.json`, `owner_facts.json`, `screenshot_extras.json`, `sprites.json` |
| **Owner prose** (verbatim) | Season notes about rivalries, disputes, drama, in the owner's words | `data/y80/journal.json` |
| **Generated** (rules over the data) | Eras, storylines, rivalries, lineages, snubs, outsiders, record chases, iron men, one-team legends, open questions, player tags and eras, Hall of Fame classes, career stints and their evidence text, market prices | `scripts/*.py`, `scripts/market_snapshot.ts` → `public/data/` |
| **AI-authored** (only these two) | Hall of Fame induction speeches; card art styles and custom sprites (Art lab) | `data/y80/speeches.json`; `src/components/collection/art/**`, `public/data/sprites/` |

Never hand-write analysis: no era write-ups, storylines, rivalry blurbs, player tags or per-player stint judgments.
If something reads like analysis, it must come out of a rule in `scripts/build_league_content.py` or
`scripts/infer_stints.py`. **Phone sessions write only facts (through an upload manifest) and speeches.**

## Single source of truth

The site loads only the bundled files in `public/data/`, which `npm run rebuild` builds from `data/y80/`. Never
hand-edit generated files, and never edit `data/y80/` directly: every change goes through an upload bundle.

`npm run rebuild` runs, in order: `infer_stints.py` (career stints) → `build_league_data.py` (league CSV, extras,
legends, sprites) → `market_snapshot.ts` (Career Legacy / OVR snapshot) → `build_league_content.py`
(`public/data/league/content.json`) → `audit.ts`. It is deterministic: two runs give byte-identical output.

## Updating: the upload pipeline (the usual phone request)

### When the owner says "update"

1. Build the bundle (steps 1–3 below), then run **one command**: `npm run update -- data/uploads/<bundle>`. It
   validates and applies the bundle, rebuilds everything (stints, league data, market snapshot, eras, storylines,
   HOF classes, edition, audit), checks a season rollover, typechecks, runs `check:sprites` and `npm run build`, then
   prints a summary (players added or updated, players needing teams, records, new Hall of Famers, SPEECH NEEDED,
   market movers, open questions, the new edition) and stops. It never commits.
2. If it printed `SPEECH NEEDED`, write the speech (step 5) as a `speech.set` mutation in a follow-up bundle and run
   `npm run update` on that bundle.
3. Commit and push with the commands it prints (step 6).

The owner sends Retro Bowl screenshots (and maybe a few lines about the season) and asks to "add these". One upload
is one bundle, `data/uploads/<YYYY-MM-DD>-<slug>/`:

- `manifest.json`: the structured mutations (format below)
- `notes.md`: the owner's free text, copied verbatim (only if they wrote some)
- `images/`: the screenshots (or list their paths in the manifest)

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
`coach.set`; record board → `record.set`; team screens → `fact.set active_rosters/<Team>`; game Player HOF screen →
`fact.set players/<name>/retired_with`. The site's Hall of Fame is its own (Career Legacy ≥ 7000); the game's HOF
list must not add or remove anyone.

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

### 6. Commit and push

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

- The current club is the **Jets**. The coach is Dorren Skura; his 80 seasons are in `coach.json`.
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
  fact `players/<name>/signature_team`, else the card's `legacy_team`, else the stint with the most rings, then most
  seasons, then earliest; no stints = current team. Stats, rosters, filters, jersey numbers and market keys keep the
  current team (`signatureTeamOf` / `withSignatureTeam` in `src/utils/playerExtras.ts`). Audit warns when it's a club
  he has no stint with.
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
- **Card market**: `scripts/market_snapshot.ts` appends a snapshot to `data/y80/market_history.json` (built into
  `public/data/market.json`) whenever any player's OVR, skill or Career Legacy changed. The value formula lives in
  `src/utils/cardMarket.ts`. Never hand-edit either file; rebuild and commit both.

## Code notes

- Formulas and metric definitions: `docs/STATS_REFERENCE.md`, `src/config/stats.ts`, `src/config/advanced.ts`
  (similarity), `src/config/skillGrades.ts` (S–F grades), `src/config/ovr.ts` (official OVR).
- Fetch data with `${import.meta.env.BASE_URL}data/...`, never `/data/...`, because Pages serves the site under `/RetroVault/`.
- Routing is hash-based (`#stats/deepdive?p=QB:Name`); see `src/components/stats/hub/hashRoute.ts`.
- Keep every save compiling; the owner often has the dev server open.
