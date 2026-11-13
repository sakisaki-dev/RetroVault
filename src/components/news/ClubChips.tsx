import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { matchPlayerByName } from '@/utils/leagueContent';
import { getTeamColors, getTeamTextColor } from '@/utils/teamColors';
import { bannerTeamOf } from '@/utils/playerExtras';
import TeamLogo from '@/components/brand/TeamLogo';

/**
 * Player and team chips that wear their club's colours and a small logo (Season Story, Hot Takes, Did you know): the
 * name in the club's text colour (lifted to stay readable on the dark panels) with a club-colour edge. A player wears
 * his best-known club (bannerTeamOf). A known player opens his card; an unknown name is a plain chip.
 */

/** A club's colours as CSS vars: --cc (edge), --cc-ink (readable text) */
const clubVars = (team?: string | null): CSSProperties | undefined => {
  const c = getTeamColors(team);
  const ink = getTeamTextColor(team);
  return c && ink ? ({ '--cc': `hsl(${c.primary})`, '--cc2': `hsl(${c.secondary})`, '--cc-ink': ink } as CSSProperties) : undefined;
};

interface Props {
  names: string[];
  teams?: string[];
  players: Player[];
  onPlayer: (p: Player) => void;
  /** Players shown before "+n" */
  max?: number;
  label?: string;
}

export const ClubChips = ({ names, teams = [], players, onPlayer, max, label = 'Players' }: Props) => {
  const shown = max ? names.slice(0, max) : names;
  const more = names.length - shown.length;
  // a fact about clubs only (no players) shows its clubs instead
  const clubChips = names.length ? [] : teams;
  if (!shown.length && !clubChips.length) return null;
  return (
    <ul className="cc-chips" aria-label={label}>
      {shown.map((n) => {
        const p = matchPlayerByName(n, players);
        return (
          <li key={n}>
            {p ? (
              <button type="button" className="cc-chip" style={clubVars(bannerTeamOf(p))} onClick={() => onPlayer(p)} aria-label={`Open ${p.name}'s card`}>
                {bannerTeamOf(p) && <TeamLogo team={bannerTeamOf(p)} size={14} decorative className="cc-chip__logo" />}
                <span className="cc-chip__pos">{p.position}</span>
                <span className="cc-chip__name">{p.name}</span>
              </button>
            ) : (
              <span className="cc-chip cc-chip--plain">{n}</span>
            )}
          </li>
        );
      })}
      {more > 0 && (
        <li>
          <span className="cc-chip cc-chip--plain">+{more}</span>
        </li>
      )}
      {clubChips.map((t) => (
        <li key={t}>
          <span className="cc-chip cc-chip--team" style={clubVars(t)}>
            <TeamLogo team={t} size={14} decorative className="cc-chip__logo" />
            <span className="cc-chip__name">{t}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};
