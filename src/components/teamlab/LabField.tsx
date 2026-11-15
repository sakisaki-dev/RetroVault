import type { CSSProperties, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import GameSprite from '@/components/GameSprite';
import TeamLogo from '@/components/brand/TeamLogo';
import type { Position } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { bannerTeamOf } from '@/utils/playerExtras';
import { useJerseyNumbers } from '@/utils/jerseys';
import { SLOTS, type LabContext, type Lineup, type PlayerProfile, type SlotId } from '@/utils/teamLab';
import { FIELD_ART, type FieldArt, type Turf } from './fieldArt';
import { PixelPlayer } from './labArt';
import PixelLoader from '@/components/ui/PixelLoader';

/**
 * The lineup standing in formation on the game's turf (private build: Retro Bowl's own field, crowd and sideline crew
 * painted in the kit club's colours, every player in that club's kit; classic build: a CSS field and pixel players in
 * the same kit). Wide on a tablet or desktop (offense left, facing right), tall on a phone (offense below the line).
 * Every spot is a button: tapping it opens that slot's picker in the depth chart.
 */

type Spot = { x: number; y: number };
const WIDE: Record<'qb' | 'rb' | 'wr1' | 'wr2' | 'te' | 'ol', Spot> = {
  wr1: { x: 46, y: 30 },
  ol: { x: 45, y: 59 },
  te: { x: 37, y: 79 },
  wr2: { x: 47, y: 95 },
  qb: { x: 30, y: 58 },
  rb: { x: 17, y: 67 },
};
const TALL: typeof WIDE = {
  wr1: { x: 13, y: 66 },
  ol: { x: 40, y: 66 },
  te: { x: 64, y: 66 },
  wr2: { x: 88, y: 66 },
  qb: { x: 40, y: 81 },
  rb: { x: 62, y: 94 },
};
// Defenders by their position: DL on the line, LBs a level back, DBs deep and wide (wide: x and a y band; tall: y and an x band)
const DEF_WIDE: Record<string, { at: number; from: number; to: number }> = {
  DL: { at: 57, from: 42, to: 68 },
  LB: { at: 68, from: 36, to: 74 },
  DB: { at: 81, from: 30, to: 86 },
};
const DEF_TALL: typeof DEF_WIDE = {
  DL: { at: 47, from: 30, to: 70 },
  LB: { at: 35, from: 22, to: 78 },
  DB: { at: 22, from: 12, to: 88 },
};
/** The classic field's yard numbers, at every 10% from one 10-yard line to the other */
const YARDS = [10, 20, 30, 40, 50, 40, 30, 20, 10];
const spread =(n: number, a: number, b: number) => (n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));

const lastName = (n: string) => {
  const parts = n.split(' ');
  return parts.length > 1 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts[parts.length - 1]) ? parts[parts.length - 2] : parts[parts.length - 1];
};

interface LabFieldProps {
  ctx: LabContext;
  lineup: Lineup;
  kitClub: string;
  turf: Turf;
  /** The painted field art (useFieldArt), all null in the classic build */
  art: FieldArt;
  tall: boolean;
  /** Sprite size: l on a wide desktop field, m on a desktop, s on smaller ones */
  size: 's' | 'm' | 'l';
  onPick: (slot: SlotId) => void;
  /** Shown over the field (the empty field's call to action) */
  overlay?: ReactNode;
}

const LabField = ({ ctx, lineup, kitClub, turf, art, tall, size, onPick, overlay }: LabFieldProps) => {
  const { numberFor } = useJerseyNumbers();
  const team = findNFLTeam(kitClub);
  const offense = tall ? TALL : WIDE;
  const def = tall ? DEF_TALL : DEF_WIDE;

  // place the four defenders by position group
  const defSlots: SlotId[] = ['d1', 'd2', 'd3', 'd4'];
  const groups = new Map<string, SlotId[]>();
  defSlots.forEach((id) => {
    const p = ctx.profiles.get(lineup[id]);
    const pos = (p?.position as string) ?? 'LB';
    groups.set(pos, [...(groups.get(pos) ?? []), id]);
  });
  const spots = new Map<SlotId, Spot>();
  (Object.keys(offense) as (keyof typeof WIDE)[]).forEach((id) => spots.set(id, offense[id]));
  groups.forEach((ids, pos) => {
    const g = def[pos] ?? def.LB;
    // an empty slot waits on the second level; filled ones stand with their unit
    spread(ids.length, g.from, g.to).forEach((v, i) => spots.set(ids[i], tall ? { x: v, y: g.at } : { x: g.at, y: v }));
  });

  const vars = {
    '--lf-c1': team ? `hsl(${team.primaryColor})` : 'hsl(var(--turf))',
    '--lf-c2': team ? `hsl(${team.secondaryColor})` : 'hsl(var(--gold))',
    ...(art.turf ? { '--lf-turf': `url("${art.turf}")` } : {}),
  } as CSSProperties;

  const big = size !== 's';
  const pixelUnit = size === 'l' ? 4 : size === 'm' ? 3 : 2;

  const figure = (p: PlayerProfile) =>
    FIELD_ART && !p.isLegend ? (
      <GameSprite player={p.player} team={kitClub} kind="figure" size={size} />
    ) : (
      <PixelPlayer club={kitClub} number={numberFor(p.player)} unit={pixelUnit} />
    );

  return (
    <div
      className={`lab-field ${tall ? 'lab-field--tall' : 'lab-field--wide'} ${art.turf ? 'lab-field--art' : art.pending ? 'lab-field--pending' : 'lab-field--css'} lab-field--${turf}`}
      style={vars}
      role="group"
      aria-label={`Lineup on the field in ${team?.name ?? 'club'} kits`}
    >
      {/* The painted turf lands under a veil of the base green that fades away (no pop from a plain field) */}
      {art.turf && <span className="lab-field-veil" aria-hidden="true" />}
      {art.pending && <PixelLoader size="sm" label="Field" what="the field" className="lab-field-loader" />}
      {!art.turf && !art.pending && <span className="lab-field-lines" aria-hidden="true" />}
      {!art.turf && !art.pending &&
        YARDS.map((n, i) =>
          [0, 1].map((side) => (
            <span
              key={`${i}-${side}`}
              className="lab-yard"
              aria-hidden="true"
              style={tall ? { top: `${(i + 1) * 10}%`, [side ? 'right' : 'left']: '7%' } : { left: `${(i + 1) * 10}%`, [side ? 'bottom' : 'top']: side ? '17%' : '15%' }}
            >
              {n}
            </span>
          )),
        )}
      <span className="lab-field-logo" aria-hidden="true">
        <TeamLogo team={kitClub} size={size === 'l' ? 190 : big ? 150 : 96} decorative />
      </span>
      <span className="lab-los" aria-hidden="true" />
      <span className="lab-side lab-side--o" aria-hidden="true">
        Offense
      </span>
      <span className="lab-side lab-side--d" aria-hidden="true">
        Defense
      </span>

      {SLOTS.map((s) => {
        const at = spots.get(s.id)!;
        const p = ctx.profiles.get(lineup[s.id]);
        const style = { left: `${at.x}%`, top: `${at.y}%` } as CSSProperties;
        if (!p)
          return (
            <button key={s.id} type="button" className="lab-spot lab-spot--empty" style={style} onClick={() => onPick(s.id)} aria-label={`Pick a player for ${s.side === 'defense' ? 'a defender' : s.label}`}>
              <span className="lab-ghost">
                <Plus aria-hidden="true" />
              </span>
              <span className="lab-tag lab-tag--empty">{s.side === 'defense' ? 'DEF' : s.label}</span>
            </button>
          );
        const club = bannerTeamOf(p.player);
        const c = findNFLTeam(club);
        const tagVars = {
          '--tg-c': c ? `hsl(${c.primaryColor})` : 'hsl(var(--line))',
          '--tg-fg': c ? getReadableTextOn(c.primaryColor) : '#fff',
        } as CSSProperties;
        return (
          <button
            key={s.id}
            type="button"
            className="lab-spot"
            style={style}
            onClick={() => onPick(s.id)}
            aria-label={`${p.position} ${p.name}, grade ${p.grade?.grade ?? 'none'}. Change ${s.side === 'defense' ? 'this defender' : s.label}`}
          >
            <span className="lab-fig">{figure(p)}</span>
            <span className="lab-tag" style={tagVars}>
              <b>{p.position as Position}</b>
              <span className="lab-tag-name">{lastName(p.name)}</span>
              {p.grade && (
                <i className="lab-tag-grade" style={{ background: p.grade.color }}>
                  {p.grade.grade}
                </i>
              )}
            </span>
          </button>
        );
      })}
      {overlay && <div className="lab-field-overlay">{overlay}</div>}
    </div>
  );
};

export default LabField;
