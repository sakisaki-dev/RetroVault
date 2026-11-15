/**
 * The site's sprite rules for the widget's pre-scaled sprites (scripts/widget_sprites.py runs this; no pixels here).
 * Reads on stdin {"index": <public/private-sprites/nfl/index.json>, "looks": <public/data/sprites.json>,
 * "jobs": [{"key": "POS:Name", "club": "Eagles", "action": "idle" | "celebrate"}]} and prints on stdout
 * {"palettes": {club: paletteFor(club)}, "picks": [{file, paint, pose, cx, foot, rows, cols} | null]}: exactly what
 * GameSprite.tsx draws as a figure (nflSpriteFor with his role pose and locked skin tone, bodyFor for his body) and
 * the kit table gameKitPaint.ts paints the neutral kit with.
 */
import { readFileSync } from 'node:fs';
import { NFL_TEAMS } from '@/utils/nflTeams';
import { paletteFor } from '@/utils/gameKitPaint';
import { nflSpriteFor, type NflSprites, type SpriteAction } from '@/utils/gameSprites';
import { bodyFor, rolePose } from '@/config/bodyTypes';

interface Job {
  key: string;
  club?: string;
  action?: SpriteAction;
}
type Look = { skin?: unknown; build?: unknown; height?: unknown };
const input = JSON.parse(readFileSync(0, 'utf8')) as { index: NflSprites; looks: Record<string, Look>; jobs: Job[] };
const looks = input.looks ?? {};

const picks = input.jobs.map(({ key, club, action = 'idle' }) => {
  const i = key.indexOf(':');
  const pos = key.slice(0, i);
  const name = key.slice(i + 1);
  const look = looks[name];
  const tone = typeof look?.skin === 'string' ? look.skin : undefined;
  const pick = nflSpriteFor(input.index, key, club, club, action, false, tone, rolePose(pos));
  if (!pick) return null;
  const body = bodyFor(key, look);
  return {
    file: pick.src.slice(pick.src.lastIndexOf('/') + 1),
    paint: pick.paint ?? null,
    pose: pick.pose,
    cx: pick.cx,
    foot: pick.foot,
    rows: body.rows,
    cols: body.cols,
  };
});

const palettes: Record<string, ReturnType<typeof paletteFor>> = {};
for (const t of [...NFL_TEAMS].sort((a, b) => a.name.localeCompare(b.name))) palettes[t.name] = paletteFor(t.name);
process.stdout.write(JSON.stringify({ palettes, picks }));
