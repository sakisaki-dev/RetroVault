import type { CSSProperties } from 'react';
import type { Player, Position } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import GameSprite from '../GameSprite';
import './rosterField.css';

/**
 * The roster as a formation (the owner's private Retro Bowl sprites; TeamSheet shows it only when this Mac has them):
 * a pixel field (portrait, so each row has room for the 2x sprites) with the line of scrimmage across the middle, the offence below it (OL on the line, TE beside them,
 * WRs split wide, QB behind the centre, RB behind him) and the defence facing them (DL on the line, LBs behind, DBs
 * deep and wide). Every player stands in his club's kit; a tap opens his card. Spots are percentages of the field,
 * so a crowded position (five DBs) spreads across its row.
 */

type Row = { pos: Position; y: number; x0: number; x1: number };
// y: where his feet are, % from the top. Defence on top (deep backs first), the line of scrimmage at 50%, offence below.
const ROWS: Row[] = [
  { pos: 'DB', y: 18, x0: 12, x1: 88 },
  { pos: 'LB', y: 33, x0: 26, x1: 74 },
  { pos: 'DL', y: 48.5, x0: 30, x1: 70 },
  { pos: 'OL', y: 66, x0: 32, x1: 56 },
  { pos: 'TE', y: 66, x0: 72, x1: 76 },
  { pos: 'WR', y: 66, x0: 10, x1: 91 },
  { pos: 'QB', y: 82, x0: 46, x1: 54 },
  { pos: 'RB', y: 97, x0: 40, x1: 60 },
];

// A lone LB or RB stands off the centre line so he doesn't stack on the man in front of him
const OFFSET: Partial<Record<Position, number>> = { LB: 38, RB: 62 };

const spread = (n: number, x0: number, x1: number): number[] => (n === 1 ? [(x0 + x1) / 2] : Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1)));

interface Props {
  players: Player[];
  team: string;
  numberFor: (p: Player) => number | string | null | undefined;
  onOpen: (p: Player) => void;
}

const RosterField = ({ players, team, numberFor, onOpen }: Props) => {
  const t = findNFLTeam(team);
  const vars = {
    '--rf-c1': t ? `hsl(${t.primaryColor})` : 'hsl(226 33% 30%)',
    '--rf-fg': t ? getReadableTextOn(t.primaryColor) : '#fff',
  } as CSSProperties;

  const spots: { p: Player; x: number; y: number }[] = [];
  for (const row of ROWS) {
    const group = players.filter((p) => p.position === row.pos).sort((a, b) => (b.careerLegacy || 0) - (a.careerLegacy || 0));
    if (!group.length) continue;
    // WRs split to both sidelines; everyone else fills his band
    const xs =
      row.pos === 'WR'
        ? group.map((_, i) => (i % 2 === 0 ? row.x0 + Math.floor(i / 2) * 12 : row.x1 - Math.floor(i / 2) * 12))
        : group.length === 1 && OFFSET[row.pos] !== undefined
          ? [OFFSET[row.pos]!]
          : spread(group.length, row.x0, row.x1);
    group.forEach((p, i) => spots.push({ p, x: xs[i], y: row.y }));
  }

  return (
    <div className="rf" style={vars}>
      <div className="rf-field" role="list" aria-label={`${t?.name ?? team} roster on the field`}>
        <span className="rf-los" aria-hidden="true" />
        <span className="rf-side rf-side--d" aria-hidden="true">
          Defense
        </span>
        <span className="rf-side rf-side--o" aria-hidden="true">
          Offense
        </span>
        {spots.map(({ p, x, y }) => (
          <button
            key={`${p.position}:${p.name}`}
            type="button"
            role="listitem"
            className="rf-spot"
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => onOpen(p)}
            aria-label={`${p.name}, ${p.position}, number ${numberFor(p) ?? ''}. Open player`}
          >
            <GameSprite player={p} team={team} kind="figure" size="m" />
          </button>
        ))}
        {/* Name tags on their own layer above every figure, so no sprite ever covers a name */}
        {spots.map(({ p, x, y }) => (
          <span key={`tag-${p.position}:${p.name}`} className="rf-tag" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">
            <b>{p.position}</b> {p.name.split(' ').slice(-1)[0]}
          </span>
        ))}
      </div>
    </div>
  );
};

export default RosterField;
