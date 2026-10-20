import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { useLeague } from '@/context/LeagueContext';
import { getLegacyTier, isDefensivePosition, isHallOfFamer } from '@/config/stats';
import { playerSkillGrades } from '@/config/skillGrades';
import { formatDecimal } from '@/utils/metricColors';
import { AWARD_META, POSITION_NAMES } from '@/utils/playerMeta';
import { findNFLTeam } from '@/utils/nflTeams';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useLeagueContent } from '@/utils/leagueContent';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import { buildCareerArc, stintYears } from '@/components/player/arcData';
import { careerTotals } from '@/components/player/statLines';
import { variantLabel, type Finish, type Tier, type Variant } from '@/utils/collection';
import { lookFor, useSpriteTable } from './art/sprite/faces';
import { poseKeyFor, poseLabel } from './art/sprite/poses';
import { uniformFor } from './art/sprite/uniforms';
import type { CardInfo } from './useCardPool';

/** "Pose: Rollout throw" for sprite cards (plus "Custom look" when sprites.json locks his look), else "Art: 70s Topps". */
const artNote = (variant: Variant, info: CardInfo, table: ReturnType<typeof useSpriteTable>) => {
  if (variant !== 'sprite') return `Art: ${variantLabel(variant)}`;
  const look = lookFor(info.player, table);
  const pose = poseLabel(poseKeyFor(info.player.name, info.player.position, look.pose));
  return `Pose: ${pose}${look.locked ? ' · Custom look' : ''}`;
};

const fmt = (v: number | null, decimals = 0) => (v == null || !Number.isFinite(v) ? '–' : formatDecimal(v, decimals));

interface CardBackProps {
  info: CardInfo;
  tier: Tier;
  total: number;
  /** Art variant on the front (names the art / the sprite pose on the back) */
  variant?: Variant;
  /** Finish on the front (with the variant, decides the uniform roll) */
  finish?: Finish;
}

/**
 * The back of a card in the large view: career totals, awards, skill-grade bars (league players), a mini career
 * arc (franchise stops with years and rings, from the same builder as the player page) and the set number.
 */
const CardBack = ({ info, tier, total, variant, finish }: CardBackProps) => {
  const table = useSpriteTable();
  const { getAllPlayers } = useLeague();
  const extras = usePlayerExtras();
  const { content } = useLeagueContent();
  const { retiredInfo } = useJerseyNumbers();
  const p = info.player;
  const legend = !!p.isRealLegend;

  const grades = useMemo(() => {
    if (legend) return [];
    const league = getAllPlayers().filter((x) => !(x as { isRealLegend?: boolean }).isRealLegend);
    return playerSkillGrades(league, p).traits.filter((t) => t.grade);
  }, [getAllPlayers, p, legend]);

  const arc = useMemo(() => {
    const key = normalizeName(p.name);
    return buildCareerArc({
      player: p,
      content,
      card: extras.cards[key],
      retired: retiredInfo(p),
      hofTier: getLegacyTier(p.careerLegacy)?.label ?? null,
      stints: extras.stints[key],
    });
  }, [p, content, extras, retiredInfo]);

  const totals = careerTotals(p).slice(0, 9);
  const awards = AWARD_META[isDefensivePosition(p.position) ? 'defense' : 'offense']
    .map((a) => ({ ...a, n: (p[a.key] as number) ?? 0 }))
    .filter((a) => a.n > 0);
  const team = findNFLTeam(p.team);
  // Only alternates get a line ("Uniform: Bucs Creamsicle"); the home uniform is the standard
  const uniform = variant ? uniformFor(p, variant, finish) : null;

  return (
    <div className={cn('cb', `cb--${tier}`)}>
      <div className="cb__head">
        <span className="cb__logo">{team ? <TeamLogo team={p.team} size={34} decorative /> : <span aria-hidden="true">★</span>}</span>
        <span className="min-w-0 flex-1">
          <span className="cb__name">{p.name}</span>
          <span className="cb__sub">
            {POSITION_NAMES[p.position] ?? p.position} · {info.franchise}
          </span>
        </span>
        <span className="cb__set" title="Set number">
          #{info.setNo}
          <small>/{total}</small>
        </span>
      </div>
      {variant && <p className="cb__art">{artNote(variant, info, table)}</p>}
      {uniform && uniform.id !== 'home' && <p className="cb__art">Uniform: {uniform.label}</p>}

      <h4 className="cb__h">Career</h4>
      <dl className="cb__stats">
        {totals.map((s) => (
          <div key={s.key} title={s.title}>
            <dd>{fmt(s.value, s.decimals)}</dd>
            <dt>{s.label}</dt>
          </div>
        ))}
      </dl>

      <h4 className="cb__h">Awards</h4>
      {awards.length ? (
        <ul className="cb__awards">
          {awards.map(({ key, label, long, Icon, hsl, n }) => (
            <li key={key} title={`${n}× ${long}`} style={{ color: `hsl(${hsl})` }}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <b>{n}</b>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cb__none">No major awards</p>
      )}

      {grades.length > 0 && (
        <>
          <h4 className="cb__h">Skill grades</h4>
          <ul className="cb__grades">
            {grades.slice(0, 6).map((g) => (
              <li key={g.trait.id} title={`${g.trait.name}: ${g.display} (${Math.round(g.percentile)}th percentile at ${p.position})`}>
                <span className="cb__gname">{g.trait.name}</span>
                <span className="cb__bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(4, g.percentile)}%`, background: g.grade!.color }} />
                </span>
                <b style={{ background: g.grade!.color }}>{g.grade!.grade}</b>
              </li>
            ))}
          </ul>
        </>
      )}

      {arc.stints.length > 0 && (
        <>
          <h4 className="cb__h">Career arc</h4>
          <ol className="cb__arc">
            {arc.stints.map((s) => {
              const years = stintYears(s);
              return (
                <li key={s.key} title={s.source}>
                  <span className="cb__arc-logo">{s.team ? <TeamLogo team={s.team} size={22} decorative /> : '•'}</span>
                  <span className="cb__arc-team">{s.label}</span>
                  {years && <span className="cb__arc-years">{years}</span>}
                  {s.rings.length > 0 && <span className="cb__arc-rings">{s.rings.length}× ring</span>}
                </li>
              );
            })}
          </ol>
        </>
      )}
      {arc.hallOfFame && !legend && isHallOfFamer(p) && <p className="cb__hof">Hall of Fame · {arc.hallOfFame.tier}</p>}
    </div>
  );
};

export default CardBack;
