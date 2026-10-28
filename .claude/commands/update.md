---
description: Add attached Retro Bowl screenshots (and any notes) to the league, end to end
argument-hint: "[notes about trades, teams, nicknames…]"
---

The owner wants an update. Follow CLAUDE.md exactly: the "When the owner says 'update'" flow and the
"Season update plan" table. Owner notes for this update, if any: $ARGUMENTS

1. Setup (cloud/phone sessions start clean): `npm ci` if `node_modules` is missing. Work on `retrovault-v2`;
   `git pull --rebase origin retrovault-v2` first.
2. Read every attached screenshot carefully (CAREER panel only; cross-check the SEASON panel and the averages; careers
   only go up). Identify the season shown and any staff screen, Super Bowl list, record board, roster or HOF page.
3. Build one bundle `data/uploads/<today>-<slug>/`: `manifest.json`, `notes.md` with the owner's notes verbatim,
   and the screenshots in `images/` (git-ignored: never commit them). Owner facts (teams, trades, club switches,
   retirements, nicknames) become `fact.set` / `player.set` mutations quoting the owner; trade reasons say "traded".
4. Run `npm run update -- data/uploads/<bundle>`. Then:
   - `SPEECH NEEDED` → write the speech (`speech.set`) in a follow-up bundle and run update on it.
   - `STORY NEEDED: Y<n>` → write the Season Story (`story.set`, professional voice, no "owner"/"you", true facts
     with `stats[]` sources, continue threads from last season via `related[]`) in a follow-up bundle; run update.
   - Audit flags stale numbers in a speech or story → refresh it the same way.
   - The audit must end with 0 errors.
5. New players without a known team stay `"UNK"`: **ask the owner for their teams** (give hints from their last
   game) before or right after committing, then apply the answers as a small follow-up bundle.
6. Commit everything except images (`git add data public scripts src CLAUDE.md`, never `images/`), with a message
   listing who was added or updated and the bundle id, then `git push origin retrovault-v2`. GitHub Pages redeploys
   the site in about 2 minutes and the widget picks up `public/data/widget.json` within about 2 hours.
7. Reply briefly: season result, players updated/added, new Hall of Famers, the story headlines, records, players
   needing teams, anything you weren't sure you read correctly, and open questions.
