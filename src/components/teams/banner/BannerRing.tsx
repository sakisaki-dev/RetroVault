import { useMemo, type CSSProperties } from 'react';
import TeamLogo from '@/components/brand/TeamLogo';
import type { Player } from '@/types/player';
import type { BannerClub, BannerData } from './useBannerData';
import { Beams, Counts, Figure, plateOf, stars, useStadiumVars, Wordmark } from './parts';

/** Clubs whose logo is drawn in their own primary (the Jets' green on green): their plaque is light so the logo reads */
const LIGHT_PLAQUE = new Set(['Jets']);

/**
 * Banner 3, "Ring of honor": the stadium bowl seen from midfield. All 32 clubs hang on the upper-deck ring as plaques in
 * their colours (all-time power order, No. 1 first, a star for every title), the game's stand front and crowd below, the
 * jumbotron hung from the ring with TEAMS and the counts, and the top five franchises' greatest players on the turf in
 * their kits, the No. 1's in the middle celebrating.
 */
const RING_B = 120; // px: the ring ellipse's height, the plaques' drop is derived from it
const drop = (u: number) => {
  const t = (u - 0.5) / 0.6;
  return Math.round(RING_B * (1 - Math.sqrt(Math.max(0, 1 - t * t))));
};

const BannerRing = ({ data, onOpenClub, onOpenPlayer }: { data: BannerData; onOpenClub?: (key: string) => void; onOpenPlayer?: (p: Player) => void }) => {
  const lead = data.clubs[0];
  const vars = useStadiumVars(lead.team.name, 'night');
  const front = useMemo(() => {
    const [a, b, c, d, e] = data.clubs.slice(0, 5);
    return [d, b, a, c, e].filter(Boolean) as BannerClub[];
  }, [data.clubs]);
  return (
    <div className="bn bn3" style={vars} role="group" aria-label={`Teams: ${data.totals.franchises} franchises ranked by all-time power, with each club's Ring of Honor`}>
      <span className="bn3-stands" />
      <span className="bn3-crowd" />
      <span className="bn3-turf" />
      <Beams />
      <span className="bn3-rim" aria-hidden="true" />
      <ol className="bn3-ring">
        {data.clubs.map((c, i) => {
          const p = plateOf(c);
          return (
            <li key={c.s.key} className="bn3-li" style={{ ['--dy32' as string]: `${drop(i / 31)}px`, ['--dy16' as string]: `${drop((i % 16) / 15)}px` } as CSSProperties}>
            <button
              type="button"
              onClick={() => onOpenClub?.(c.s.key)}
              aria-label={`${c.team.city} ${c.team.name}, all-time power rank ${c.rank}${c.titles ? `, ${c.titles} Super Bowl titles` : ''}${c.honoured ? `, ${c.honoured} on the Ring of Honor` : ''}. Open club page`}
              className={i === 0 ? 'bn3-plaque is-first' : 'bn3-plaque'}
              style={{ ['--c1' as string]: LIGHT_PLAQUE.has(c.team.name) ? '#f4f6f2' : p.fill, ['--c2' as string]: p.edge } as CSSProperties}
              title={`#${c.rank} ${c.team.city} ${c.team.name}${c.honoured ? ` · ${c.honoured} honoured` : ''}`}
            >
              <TeamLogo team={c.team} size={26} decorative />
              <b>{stars(c.titles) || ' '}</b>
            </button>
            </li>
          );
        })}
      </ol>
      <div className="bn3-jumbo">
        <Wordmark data={data} />
        <Counts data={data} />
      </div>
      <div className="bn3-row">
        {front.map((c) => {
          const first = c === lead;
          const p = plateOf(c);
          return (
            <button key={c.s.key} type="button" disabled={!c.star} onClick={() => c.star && onOpenPlayer?.(c.star)} aria-label={c.star ? `${c.star.name}, ${c.team.name}. Open Deep Dive` : c.team.name} className={first ? 'bn3-fig is-first' : 'bn3-fig'} style={{ ['--c1' as string]: p.fill, ['--c2' as string]: p.edge, ['--ink' as string]: p.ink } as CSSProperties}>
              <Figure club={c} action={first ? 'celebrate' : 'idle'} size="m" />
              <span className="bn3-name">
                <i>#{c.rank}</i>
                <TeamLogo team={c.team} size={14} decorative />
                <b>{c.star ? c.star.name : c.team.name}</b>
                {c.retired != null && <em>#{c.retired}</em>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BannerRing;
