import type { ReactNode } from 'react';
import TeamLogo from '@/components/brand/TeamLogo';
import { findNFLTeam } from '@/utils/nflTeams';
import type { Strength } from '@/utils/clubOffice';
import type { Rollup, TeamAnalysis } from '@/utils/teamLab';
import { GradeChip } from './parts';

/**
 * The stadium's jumbotron: the kit club's crest and colours, the lab's title or the lineup's identity, and the
 * scoreboard (team, offense and defense grades against random lineups; the game's own team strength out of 10).
 */
const Led = ({ label, r }: { label: string; r: Rollup | null }) => (
  <div className="lab-led">
    <span className="lab-led-k">{label}</span>
    {r ? (
      <span className="lab-led-v">
        <GradeChip grade={r.grade} size="md" label={`${label} grade ${r.grade.grade}`} />
        <b>{Math.round(r.score)}</b>
      </span>
    ) : (
      <span className="lab-led-v lab-led-off">--</span>
    )}
  </div>
);

interface LabHeaderProps {
  kitClub: string;
  analysis: TeamAnalysis | null;
  filled: number;
  strength: Strength[] | null;
  rated: number;
  rankText?: string;
  children?: ReactNode;
}

const LabHeader = ({ kitClub, analysis: a, filled, strength, rated, rankText, children }: LabHeaderProps) => {
  const t = findNFLTeam(kitClub);
  return (
    <header className="lab-jumbo">
      <span className="lab-jumbo-crest" aria-hidden="true">
        <TeamLogo team={kitClub} size={220} decorative />
      </span>
      <div className="lab-jumbo-main">
        <div className="lab-jumbo-id">
          <span className="lab-jumbo-logo">
            <TeamLogo team={kitClub} size={44} decorative priority />
          </span>
          <div className="min-w-0">
            <p className="lab-kicker">
              Team Lab · {t?.fullName ?? kitClub} kits{rankText ? ` · ${rankText}` : ''}
            </p>
            <h1 className="lab-title">
              {a ? (
                a.identity.label
              ) : (
                <>
                  Team <span className="text-gold">Lab</span>
                </>
              )}
            </h1>
            <p className="lab-sub">
              {a
                ? a.identity.why
                : filled === 0
                  ? "Build a lineup in Retro Bowl's roster shape and get a scouting report: what to call, when to go for it, and who to trade for."
                  : `${filled} of 10 on the field. The full report appears when all 10 are in.`}
            </p>
          </div>
        </div>
        <div className="lab-scoreboard" aria-label="Scoreboard">
          <Led label="Team" r={a?.team ?? null} />
          <Led label="Offense" r={a?.offense ?? null} />
          <Led label="Defense" r={a?.defense ?? null} />
          <div className="lab-led lab-led--game" title="The game's own team strength (offense and defense out of 10) for the players the save rates">
            <span className="lab-led-k">Game O / D</span>
            <span className="lab-led-v">
              {strength && rated ? (
                <b className="lab-led-pix">
                  {strength[0].rating}
                  <i>/</i>
                  {strength[1].rating}
                </b>
              ) : (
                <span className="lab-led-off">--</span>
              )}
            </span>
          </div>
        </div>
      </div>
      {children}
    </header>
  );
};

export default LabHeader;
