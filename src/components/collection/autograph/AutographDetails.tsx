import { PACKS, finishLabel, packOdds, type Finish, type PackType } from '@/utils/collection';
import { autographValue, eraOf, fmtMult, identity, inkRowOf, parallelOf, serialStr, PRESTIGE, type AutographRoll, type AutographSnapshot } from '@/config/autographs';
import { FINISH_MULTIPLIER, autographPrice, fmtCoins } from '@/utils/cardMarket';

const eraYears = (id: AutographRoll['era']) => {
  const e = eraOf(id);
  return e.to >= 9999 ? `Y${e.from} on` : `Y${e.from}–${e.to}`;
};

/** "Standard 1 in 33" per pack type: the Autograph variant's chance per card (packOdds), for the empty state and the rules. */
export const autographOddsLine = () =>
  (['standard', 'premium', 'elite', 'holo', 'perfect'] as const)
    .map((t) => `${PACKS[t].label.replace(/ Pack$/, '')} 1 in ${Math.round(1 / packOdds(t).variants.auto)}`)
    .join(', ');

interface DetailsProps {
  snap: AutographSnapshot;
  roll: AutographRoll;
  /** His base card's market value now (null: not on the market) */
  value?: number | null;
  pulledAt?: number;
  pack?: PackType;
  /** The finish of the card it was pulled on (prices × the finish) */
  finish?: Finish;
}

/**
 * The facts of one autograph as a definition list: every roll with its multiplier, the frozen career details it shows,
 * and (when known) the price: the card's market value × the multiplier.
 */
const AutographDetails = ({ snap, roll, value, pulledAt, pack, finish = 'base' }: DetailsProps) => {
  const v = autographValue(roll);
  const hand = identity(snap.name).hand;
  const tier = PRESTIGE[snap.prestige].label;
  const rows: [string, string][] = [
    ['Card', `${finishLabel(finish)} finish${finish !== 'base' ? ` · ×${FINISH_MULTIPLIER[finish]}` : ''}`],
    ['Parallel', `${parallelOf(roll.parallel).label} · ${fmtMult(v.parallel)}`],
    ['Serial', `${serialStr(roll)}${v.serial > 1 ? ` · ${fmtMult(v.serial)}` : ''}`],
    ['Pen and ink', `${inkRowOf(roll).label} · ${fmtMult(v.ink)}`],
    ['Inscription', roll.inscription ? `${roll.inscription} · ${fmtMult(v.inscription)}` : 'None'],
    ['Design', `${eraOf(roll.era).label} (${eraYears(roll.era)})${roll.throwback ? ` · throwback ${fmtMult(v.throwback)}` : ''}`],
    ['Hand', `${hand.fontName} · ${hand.formLabel}`],
    ['As signed', [`${snap.position} #${snap.number}`, snap.team, tier, snap.hof ? `Hall of Fame${snap.hofClass ? ` ${snap.hofClass === 'Inaugural' ? 'Inaugural class' : snap.hofClass}` : ''}` : ''].filter(Boolean).join(' · ')],
  ];
  if (pulledAt) rows.push(['Pulled', `${new Date(pulledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${pack ? ` · ${PACKS[pack].label}` : ''}`]);
  return (
    <dl className="au-facts">
      {rows.map(([k, val]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{val}</dd>
        </div>
      ))}
      <div className="au-facts__total">
        <dt>Value</dt>
        <dd>{fmtMult(v.total)} the card</dd>
      </div>
      {value !== undefined && (
        <div className="au-facts__total">
          <dt>Price</dt>
          <dd>
            {value != null
              ? `${fmtCoins(autographPrice(value, v.total, finish))} coins (${fmtCoins(value)}${finish !== 'base' ? ` × ${FINISH_MULTIPLIER[finish]}` : ''} × ${fmtMult(v.total).slice(1)})`
              : 'Not on the market yet'}
          </dd>
        </div>
      )}
    </dl>
  );
};

export default AutographDetails;
