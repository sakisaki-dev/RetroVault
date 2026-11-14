import { useState, type CSSProperties, type ReactNode } from 'react';
import { Cross, Crown, HeartPulse, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import GameSprite, { type SpriteSize } from '@/components/GameSprite';
import { useGameSprites, type SpriteAction } from '@/utils/gameSprites';
import { findNFLTeam } from '@/utils/nflTeams';
import { PlayerStrip } from '@/components/brand/ClubStrip';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import { openInCompFinder } from '@/components/stats/comps/compFinderLink';
import { useJerseyNumbers } from '@/utils/jerseys';
import type { AwardRace, LeaderBoard, RatingPart, SeasonEntry, SeasonRating } from '@/utils/seasonLive';
import { BOARD_BG, LampGrid, color } from './seasonGamesUi';
import { SectionTitle, Toggle } from './SeasonGames';

/**
 * The live season's player sections, slotted into the Season page's backbone (SeasonGames.tsx) in its own idiom:
 * the award races as a sprint along a track, the league leaders on podiums and the injury report. Everything is
 * computed in src/utils/seasonLive.ts; sprites come from GameSprite (private to the owner's Mac; the public build
 * draws a club-colour jersey token of the same footprint instead).
 */

export type PlayerLookup = (key: string) => Player | undefined;

const fmt = (n: number) => n.toLocaleString('en-US');
const pts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A player's name on his club's strip (brand/ClubStrip): his Deep Dive when he has a card. */
export const PlayerName = ({ e, size }: { e: SeasonEntry; size?: 'sm' | 'md' }) => (
  <PlayerStrip name={e.name} position={e.pos} team={e.team} card={e.carded} size={size} />
);

/** His sprite (GameSprite figure, s / m / l = 64 / 128 / 192 px boxes), or a club-colour jersey token in that box. */
export const PlayerFigure = ({ e, player, action, size, crown = false }: { e: SeasonEntry; player?: Player; action: SpriteAction; size: SpriteSize; crown?: boolean }) => {
  const sprites = useGameSprites();
  if (sprites)
    return (
      <span className={cn('sz-fig', `sz-fig--${size}`)}>
        <GameSprite
          player={{ name: e.name, position: e.pos, team: e.team, bannerTeam: e.team, spriteSkin: player?.spriteSkin }}
          team={e.team}
          kind="figure"
          size={size}
          action={action}
        />
      </span>
    );
  const nfl = findNFLTeam(e.team);
  return (
    <span className={cn('sz-fig', `sz-fig--${size}`)} aria-hidden>
      <span
        className={cn('sz-token', crown && 'is-crowned')}
        style={{ ['--a' as string]: nfl ? `hsl(${nfl.primaryColor})` : 'hsl(var(--muted))', ['--b' as string]: nfl ? `hsl(${nfl.secondaryColor})` : 'hsl(var(--line))' } as CSSProperties}
      >
        {crown && <Crown className="sz-token__crown" />}
        <span className="sz-token__pos">{e.pos}</span>
      </span>
    </span>
  );
};

/* ---------------- Award race ---------------- */

const PART_TONE: Record<string, string> = { Yardage: 'sky', 'TD bonus': 'gold', Tackles: 'sky', INTs: 'gold', Sacks: 'turf', 'Forced fumbles': 'violet', Fumbles: 'flag' };
const toneOf = (p: RatingPart) => (p.value < 0 ? 'flag' : PART_TONE[p.label] ?? 'sky');

/** Positive parts stacked from the left, the costs hatched back from their end; scaled to `max`. */
const RatingBar = ({ r, max }: { r: SeasonRating; max: number }) => {
  const pos = r.parts.filter((p) => p.value > 0);
  const neg = r.parts.filter((p) => p.value < 0).reduce((t, p) => t - p.value, 0);
  const gross = pos.reduce((t, p) => t + p.value, 0);
  const w = (x: number) => `${Math.max(0, (x / max) * 100)}%`;
  return (
    <span className="sz-rbar" aria-hidden>
      {pos.map((p) => (
        <i key={p.label} className={`t-${toneOf(p)}`} style={{ width: w(p.value) }} />
      ))}
      {neg > 0 && <b style={{ left: w(gross - neg), width: w(neg) }} />}
    </span>
  );
};

const Parts = ({ r }: { r: SeasonRating }) => (
  <ul className="sz-parts" aria-label="Rating parts">
    {r.parts
      .filter((p) => p.value !== 0 || p.label === 'Yardage')
      .map((p) => (
        <li key={p.label} className={`t-${toneOf(p)}`} title={p.detail}>
          <span>{p.label}</span>{' '}
          <b>
            {p.value > 0 && p.label !== 'Yardage' && p.label !== 'Tackles' ? '+' : ''}
            {p.value < 0 ? `−${pts(-p.value)}` : pts(p.value)}
          </b>
          {p.raw !== undefined && p.raw > p.value && <em> (capped from {pts(p.raw)})</em>}
          <span className="sr-only">: {p.detail}</span>
        </li>
      ))}
  </ul>
);

/** The top five as runners on a turf track, placed by rating: the leader at the finish celebrating, the chasers running. */
const RaceTrack = ({ race, lookup }: { race: AwardRace; lookup: PlayerLookup }) => {
  const rows = race.rows;
  const top = rows[0].total;
  const low = rows[rows.length - 1].total;
  // The track starts a little behind the last runner so the gaps read
  const base = Math.max(0, low - Math.max(8, (top - low) * 0.45));
  const at = (t: number) => (top > base ? (t - base) / (top - base) : 1);
  return (
    <div className="sz-track" role="img" aria-label={`${race.short} race: ${rows.map((r, i) => `${i + 1}. ${r.entry.name} ${pts(r.total)}`).join(', ')}`}>
      <span className="sz-track__finish" aria-hidden />
      {rows.map((r, i) => (
        <div key={r.entry.key} className={cn('sz-lane', i === 0 && 'is-lead')} style={{ ['--x' as string]: at(r.total), ['--club' as string]: color(r.entry.team) }}>
          <span className="sz-lane__n" aria-hidden>
            {i + 1}
          </span>
          <span className="sz-lane__run">
            <span className="sz-lane__trail" aria-hidden />
            <span className="sz-lane__who">
              <PlayerFigure e={r.entry} player={lookup(r.entry.key)} action={i === 0 ? 'celebrate' : 'run'} size="s" crown={i === 0} />
              <span className="sz-lane__gap" aria-hidden>
                {i === 0 ? pts(r.total) : `−${pts(Math.round((top - r.total) * 10) / 10)}`}
              </span>
            </span>
          </span>
        </div>
      ))}
      <div className="sz-track__scale" aria-hidden>
        <span>{pts(Math.round(base))}</span>
        <span>{pts(top)}</span>
      </div>
    </div>
  );
};

export const AwardRaces = ({ races, lookup, weeksPlayed }: { races: AwardRace[]; lookup: PlayerLookup; weeksPlayed: number }) => {
  const [id, setId] = useState(races[0]?.id);
  const race = races.find((r) => r.id === id) ?? races[0];
  if (!race) return null;
  const top = race.rows[0]?.total ?? 0;
  const max = Math.max(1, ...race.rows.map((r) => r.parts.filter((p) => p.value > 0).reduce((t, p) => t + p.value, 0)));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={Crown}>Award race · projected</SectionTitle>
        <div role="tablist" aria-label="Award" className="inline-flex max-w-full overflow-x-auto rounded-lg bg-secondary/50 p-0.5 text-xs font-semibold">
          {races.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              id={`sz-tab-${r.id}`}
              aria-selected={r.id === race.id}
              aria-controls="sz-race-panel"
              onClick={() => setId(r.id)}
              className={cn(
                'min-h-[36px] flex-shrink-0 rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                r.id === race.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r.short}
            </button>
          ))}
        </div>
      </div>
      <div id="sz-race-panel" role="tabpanel" aria-labelledby={`sz-tab-${race.id}`} className="space-y-2">
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-[hsl(var(--gold))]">{race.label}.</span> {race.rule}.
        </p>
        {race.rows.length ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:items-start">
            <RaceTrack race={race} lookup={lookup} />
            <ol className="grid gap-2">
              {race.rows.map((r, i) => (
                <li
                  key={r.entry.key}
                  className={cn(
                    'relative flex items-start gap-3 overflow-hidden rounded-lg border px-3 py-2 text-sm',
                    i === 0 ? 'border-[hsl(45_100%_55%/0.55)] bg-[hsl(45_100%_55%/0.07)]' : 'border-border/40 bg-background/40',
                  )}
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: i === 0 ? 'hsl(var(--gold))' : color(r.entry.team) }} />
                  <span className={cn('mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded font-display text-sm font-bold', i === 0 ? 'bg-[hsl(var(--gold))] text-[hsl(228_47%_7%)]' : 'bg-muted text-foreground')}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <PlayerName e={r.entry} />
                      <span className="text-[11px] text-muted-foreground">
                        {r.entry.pos} · age {r.entry.age}
                      </span>
                    </p>
                    <RatingBar r={r} max={max} />
                    <Parts r={r} />
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={cn('font-display text-lg font-bold tabular-nums leading-none', i === 0 && 'text-[hsl(45_100%_60%)]')}>{pts(r.total)}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{i === 0 ? 'Leader' : `${pts(Math.round((top - r.total) * 10) / 10)} back`}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="py-3 text-center text-sm text-muted-foreground">Nobody eligible yet.</p>
        )}
        <p className="text-[11px] leading-snug text-muted-foreground">
          The game's own season rating (docs/GAME_MECHANICS.md), projected from weeks 1–{weeksPlayed}: QB min(150, (passing + 1.35 × rushing yards) ÷ 3,300 × 100) +
          passing TDs − INTs − 0.5 × sacks; RB, WR, TE the same yardage part (÷ 1,750, 2,100, 1,350) + 1.25 × receiving TDs − 5 × fumbles; defenders 0.5 × tackles + 3 ×
          (INTs + sacks + forced fumbles). One award per player: MVP and OPOY never the same player, a QB never OPOY, rookies (21) only Rookie of the Year. Counted: at
          least half his club's games.
        </p>
      </div>
    </div>
  );
};

/* ---------------- League leaders ---------------- */

/** Opens a carded player's Deep Dive. */
const openDive = (e: SeasonEntry) => openInCompFinder({ position: e.pos, name: e.name } as Player);

/**
 * One category as a leaderboard: the leader as a ProPlayerBanner card (club colours, giant number, his sprite on the
 * pedestal; the public build draws the classic banner), the stat in a lamp chip, then #2 to #5 as compact banner rows
 * with the figure and the gap to the leader. A player without a card yet gets the same row, not clickable.
 */
const LeaderCard = ({ board, lookup }: { board: LeaderBoard; lookup: PlayerLookup }) => {
  const { numberFor } = useJerseyNumbers();
  const [first, ...rest] = board.rows;
  if (!first) return null;
  const num = (e: SeasonEntry) => {
    const p = lookup(e.key);
    return p ? numberFor(p) : null;
  };
  const Wrap = ({ e, children, className }: { e: SeasonEntry; children: ReactNode; className?: string }) =>
    e.carded ? (
      <button
        type="button"
        onClick={() => openDive(e)}
        aria-label={`${e.name}, ${e.pos}, ${e.team}: open in the Deep Dive`}
        className={cn('block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold))]', className)}
      >
        {children}
      </button>
    ) : (
      <div className={className} aria-label={`${e.name}, ${e.pos}, ${e.team} (no card yet)`}>
        {children}
      </div>
    );
  return (
    <li className="min-w-0 space-y-1.5">
      <h4 className="font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">{board.label}</h4>
      <Wrap e={first.entry}>
        <ProPlayerBanner
          size="card"
          name={first.entry.name}
          position={first.entry.pos}
          team={first.entry.team}
          number={num(first.entry)}
          eyebrow={<span className="text-[hsl(var(--gold))]">Leader · {board.label}</span>}
          stats={[{ label: board.label, value: first.value }]}
          topRight={
            <span className="lamp">
              <b>{fmt(first.value)}</b> {board.short}
            </span>
          }
          interactive={first.entry.carded}
        />
      </Wrap>
      <ol className="space-y-1.5">
        {rest.map((r, k) => (
          <li key={r.entry.key} className="sz-leader-row flex items-center gap-2">
            <span className="w-3 flex-shrink-0 text-center font-pixel text-[9px] text-muted-foreground">{k + 2}</span>
            <Wrap e={r.entry} className="min-w-0 flex-1">
              <ProPlayerBanner
                size="compact"
                name={r.entry.name}
                position={r.entry.pos}
                team={r.entry.team}
                number={num(r.entry)}
                interactive={r.entry.carded}
                figure={<GameSprite player={{ name: r.entry.name, position: r.entry.pos, team: r.entry.team }} team={r.entry.team} kind="figure" size="s" />}
              />
            </Wrap>
            <span className="flex w-14 flex-shrink-0 flex-col items-end gap-0.5">
              <span className="lamp">
                <b>{fmt(r.value)}</b>
              </span>
              <span className="font-pixel text-[8px] tabular-nums text-muted-foreground">−{fmt(first.value - r.value)}</span>
            </span>
          </li>
        ))}
      </ol>
    </li>
  );
};

export const Leaders = ({ boards, lookup }: { boards: LeaderBoard[]; lookup: PlayerLookup }) => {
  const [side, setSide] = useState<'offense' | 'defense'>('offense');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={Medal}>League leaders · season so far</SectionTitle>
        <Toggle<'offense' | 'defense'>
          label="Side of the ball"
          value={side}
          onChange={setSide}
          options={[
            { value: 'offense', label: 'Offense' },
            { value: 'defense', label: 'Defense' },
          ]}
        />
      </div>
      <ul className="grid gap-x-3 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {boards
          .filter((b) => b.side === side)
          .map((b) => (
            <LeaderCard key={b.id} board={b} lookup={lookup} />
          ))}
      </ul>
    </div>
  );
};

/* ---------------- Injury report ---------------- */

export const InjuryReport = ({ entries }: { entries: SeasonEntry[] }) => {
  const hurt = entries.filter((e) => e.injury_week > 0).sort((a, b) => b.injury_week - a.injury_week || a.name.localeCompare(b.name));
  return (
    <div className="space-y-2">
      <SectionTitle icon={HeartPulse}>Injury report · {hurt.length}</SectionTitle>
      {hurt.length ? (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {hurt.map((e) => (
            <li key={e.key} className="relative flex min-h-[52px] items-center gap-3 overflow-hidden rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm">
              <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: color(e.team) }} />
              <div className="min-w-0 flex-1">
                <PlayerName e={e} />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {e.pos} · age {e.age}
                </p>
              </div>
              <span className="flex-shrink-0 text-right font-display text-lg font-bold tabular-nums text-[hsl(357_80%_70%)]">
                {e.injury_week} wk{e.injury_week === 1 ? '' : 's'}
                <span className="block font-pixel text-[8px] font-normal uppercase text-muted-foreground">out</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-border/40 px-3 py-2.5 text-sm text-muted-foreground">
          <Cross className="h-4 w-4 flex-shrink-0 text-[hsl(145_63%_52%)]" aria-hidden />
          No player in the save has an injury week left.
        </p>
      )}
    </div>
  );
};
