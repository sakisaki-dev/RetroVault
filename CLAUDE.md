# Retro Vault

Fan stats hub for one Retro Bowl franchise save: stats, games, collection, Hall of Fame, Front Office.
Vite + React + TypeScript + Tailwind. Live at https://sakisaki-dev.github.io/RetroVault/. Every push to
`retrovault-v2` (or `main`) redeploys it through `.github/workflows/deploy-pages.yml`.

## Single source of truth

The site loads only the bundled files in `public/data/`, which scripts build from `data/y80/`. Never add
uploads, alternate data paths or hand-edited copies of the generated files.

| Edit this (source) | Built by | Into (generated, never hand-edit) |
|---|---|---|
| `data/y80/players.json` (career lines, teams, awards) | `python3 scripts/build_league_data.py` | `public/data/initial-data.csv`, `legends.json`, `player-extras.json`, `game-exclusions.json` |
| `scripts/build_league_data.py` (`TEAM_FIXES`, `TEAM_HISTORY`, `CARD_NOTES`) | same | same |
| `data/y80/super_bowls.json`, `eras.json`, `coach.json`, `league-history.md` | `python3 scripts/build_league_content.py` | `public/data/league/content.json` |
| (the files above) | `npm run market` (part of `npm run rebuild`) | `data/y80/market_history.json` (append-only), `public/data/market.json` |

`build_league_data.py` needs numpy (`pip install numpy`). Run both scripts after any data change.

## Updating from game screenshots (the usual phone request)

The owner sends Retro Bowl screenshots and asks to "add these". Each player card shows `POS - FIRST LAST`
and GAME / SEASON / CAREER panels. **Use only the CAREER panel**, plus the award row (RINGS, MVP, OPOY,
DPOY, ROTY, SBMVP).

1. **Transcribe** the CAREER numbers into `data/y80/players.json`. Keys:
   - QB: `g att cmp yds td int sck ratt ryds rtd`
   - RB: `g ratt ryds rtd fum rec recyds rectd`
   - WR/TE: `g rec yds td fum lng`
   - OL: `g blk`
   - LB/DB/DL: `g tkl int sck ff`
   - awards: `rings mvp opoy dpoy roty sbmvp`

   Read the pixel digits carefully and cross-check each one:
   - Rushing/receiving `Avg` = yards ÷ attempts (or catches).
   - **QB passing `Avg` = yards ÷ completions**, not attempts.
   - `Cmp (x%)` = cmp ÷ att.

   A QB or RB often spans two screenshots (Passing + Rushing, or Rushing + Receiving); merge them into one record.
2. **Existing player:** update in place. Career totals only go up, so if any number drops, it's a misread:
   re-check before saving.
3. **New player:** append `{"n", "pos", "team": "UNK", ..., "era": "Modern era · Y70–80"}`, then **list the new
   players and ask the owner for their teams** (red-white-blue stars beside the name don't reliably mean the
   current team). Team values are nicknames from `data/y80/teams.json` ("Jets", "Seahawks", …).
4. **Trades and earlier teams:** set `team` to the current club and add the old one to `TEAM_HISTORY` in
   `scripts/build_league_data.py`, so League Grid counts both. Facts and nicknames for player cards go in
   `CARD_NOTES`, or in `nick` in players.json.
5. **Other screens:**
   - Super Bowl winners list → `data/y80/super_bowls.json`. Add new years; gold rows are the owner's wins.
   - Staff/coach screen → `data/y80/coach.json`.
   - The site's Hall of Fame is its own: Career Legacy ≥ 7000. The game's HOF list and ribbons (stored as
     `hof_ingame` / `retired_team` on cards) must not add or remove anyone. The owner wants the two to stay different.
6. **Rebuild and verify:**
   ```bash
   npm run rebuild    # career stints → league data → content → audit (prints "no team: …" for anyone still UNK)
                      # fix every audit ERROR; read the warnings (stale numbers in speeches, team contradictions)
   npx tsc --noEmit -p tsconfig.app.json
   npm run build
   ```
7. **New Hall of Famers need a custom speech.** If an update pushes anyone to Career Legacy ≥ 7000 (the build
   summary and the site's HOF tab show who), write his induction speech in `SPEECHES` in
   `scripts/build_league_content.py`, then rebuild. Never let the generic template in `src/components/ceremony/speech.ts`
   show. Match the existing speeches:
   - a one-line hook, then 2–3 short paragraphs, closing "…, welcome to the Hall of Fame."
   - about 120–190 words
   - only facts from the data; describe play style from his rates, never invent looks or quotes
   - no em dashes
8. **Commit and push** to `retrovault-v2` with a message listing who was added or updated. The site redeploys
   in about two minutes. Reply with a short summary: updated players, new players needing teams, and
   anything notable (records broken, new Hall of Famers).

## Owner facts (confirmed; don't "correct" them)

- The current club is the **Jets**. The coach is Dorren Skura; his 80 seasons are in `coach.json`.
- Real NFL legends appear only in the games, never in league stats or the Collection (cards are league players only).
- Active/Retired status is internal only; never show it in the UI.
- Single-season stats are intentionally not tracked.

## Keeping everything in sync

Pages compute from the data files on every load, so a data change updates every page by itself. Only hand-written
facts can go stale: speeches, `CARD_NOTES`, era key players and stints. After any data change, run `npm run audit`
and fix what it reports. Prefer deriving a fact from data over writing it down.

Card market prices (Collection → Market, card detail) are derived too: `npm run rebuild` runs
`scripts/market_snapshot.ts`, which appends a snapshot to `data/y80/market_history.json` (built into
`public/data/market.json`) whenever any player's OVR, skill or Career Legacy changed. The value formula lives in
`src/utils/cardMarket.ts`. Never hand-edit either file; just rebuild after a data change and commit both.

## Code notes

- Formulas and metric definitions: `docs/STATS_REFERENCE.md`, `src/config/stats.ts`, `src/config/advanced.ts`
  (similarity), `src/config/skillGrades.ts` (S–F grades), `src/config/ovr.ts` (official OVR).
- Fetch data with `${import.meta.env.BASE_URL}data/...`, never `/data/...`, because Pages serves the site under `/RetroVault/`.
- Routing is hash-based (`#stats/deepdive?p=QB:Name`); see `src/components/stats/hub/hashRoute.ts`.
- Keep every save compiling; the owner often has the dev server open.
