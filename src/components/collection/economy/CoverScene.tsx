import type { CSSProperties } from 'react';
import type { JerseyLook } from './useRewards';
import './rewards.css';

/** Stand-in jerseys for the Locker room before three cards are owned (neutral grey, no numbers invented for a player) */
const BLANK: JerseyLook[] = [
  { num: 0, color: '215 12% 36%', name: '' },
  { num: 0, color: '215 12% 36%', name: '' },
  { num: 0, color: '215 12% 36%', name: '' },
];

/**
 * The art layer of a milestone binder cover (the `ec-skin--<skin>` background carries the base colours; this adds the
 * scene on top of it, behind the pages). Drawn on the binder itself and, at 168 x 212, in the Milestones previews.
 * Percent-placed so it fits any binder size. `jerseys` = the three most valuable owned cards (Locker room).
 */
const CoverScene = ({ skin, jerseys }: { skin?: string | null; jerseys?: JerseyLook[] }) => {
  if (!skin || skin === 'turf') return skin ? <span className="cv" aria-hidden="true" /> : null;
  return (
    <span className={`cv cv-${skin}`} aria-hidden="true">
      {skin === 'night' && (
        <>
          <i className="beam l" />
          <i className="beam r" />
          <i className="tw l" />
          <i className="tw r" />
          <i className="crowd" />
          <i className="sb">RV 21</i>
          <i className="yl" />
        </>
      )}
      {skin === 'ball' && (
        <>
          <i className="stitch" />
          <i className="stripe t" />
          <i className="stripe b" />
          <i className="lace" />
        </>
      )}
      {skin === 'playbook' && (
        <svg viewBox="0 0 120 150" fill="none" stroke="#e8ecf6" strokeWidth="2.2" strokeLinecap="round" preserveAspectRatio="xMidYMid meet">
          <circle cx="30" cy="100" r="6" />
          <circle cx="60" cy="100" r="6" />
          <circle cx="90" cy="100" r="6" />
          <path d="M24 70l12 12M36 70l-12 12M54 66l12 12M66 66l-12 12M84 70l12 12M96 70l-12 12" />
          <path d="M30 94 C30 60 50 40 70 30" />
          <path d="M66 26l6 3-3 6" />
          <path d="M90 94 C95 70 100 55 108 48" strokeDasharray="4 4" />
          <line x1="10" y1="88" x2="112" y2="88" opacity=".4" />
        </svg>
      )}
      {skin === 'locker' && (
        <>
          {(jerseys?.length ? [...jerseys, ...BLANK].slice(0, 3) : BLANK).map((j, i) => (
            <i key={i} className="stall" style={{ '--n': i } as CSSProperties}>
              <i className="jer" style={{ background: `hsl(${j.color})` }}>
                {j.num > 0 ? j.num : ''}
              </i>
              {j.name && <i className="nm">{j.name}</i>}
            </i>
          ))}
          <i className="bench" />
        </>
      )}
      {skin === 'ring' && (
        <>
          <i className="rg" />
          <i className="gem" />
        </>
      )}
    </span>
  );
};

export default CoverScene;
