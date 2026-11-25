import { useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import { playerKey, seasonPlayerOf, type SeasonOvrFile } from '@/config/ovr';
import { playerSkillGrades } from '@/config/skillGrades';
import { cn } from '@/lib/utils';
import DdSkills from './DdSkills';

interface Props {
  player: Player;
  /** OVR: his career OVR */
  car: number | undefined;
  /** League players (career) */
  players: Player[];
  seasonOvr: SeasonOvrFile | null;
  onOpenPlayer: (p: Player) => void;
}

/**
 * Skill ratings with a This season / Career switch (owner, 2026-11-23). Default: This season for an active player who
 * played it, Career for a retiree. The season grades rank his season's per-game rates against everyone at his position
 * who played that season (same traits, same curve); a stat the season line lacks shows "no data".
 */
const DdSkillsSwitch = ({ player, car, players, seasonOvr, onOpenPlayer }: Props) => {
  const key = playerKey(player);
  const line = seasonOvr?.lines?.[key];
  const hasSeason = !!line && player.status === 'Active';
  const [mode, setMode] = useState<'season' | 'career' | null>(null);
  const shown = mode ?? (hasSeason ? 'season' : 'career');

  const seasonPlayers = useMemo(() => {
    const lines = seasonOvr?.lines;
    if (!lines) return [] as Player[];
    return players.flatMap((p) => (lines[playerKey(p)] ? [seasonPlayerOf(p, lines[playerKey(p)])] : []));
  }, [players, seasonOvr]);

  const career = useMemo(() => playerSkillGrades(players, player), [players, player]);
  const seasonMe = useMemo(() => seasonPlayers.find((p) => playerKey(p) === key) ?? null, [seasonPlayers, key]);
  const season = useMemo(() => (seasonMe ? playerSkillGrades(seasonPlayers, seasonMe) : null), [seasonPlayers, seasonMe]);

  const useSeason = shown === 'season' && !!season && !!seasonMe;
  const grades = useSeason ? season! : career;
  const label = seasonOvr ? `Y${seasonOvr.season}` : 'This season';

  return (
    <div className="space-y-3">
      {hasSeason && (
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Skill ratings basis" className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
            {(['season', 'career'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={shown === m}
                onClick={() => setMode(m)}
                className={cn('px-3 py-1.5 font-display font-bold uppercase tracking-wide', shown === m ? 'bg-gold/20 text-gold' : 'text-muted-foreground hover:text-foreground')}
              >
                {m === 'season' ? `This season (${label})` : 'Career'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {useSeason
              ? `Graded on ${label}${seasonOvr?.live ? ' so far' : ''} alone, against ${player.position}s who played it.`
              : 'Graded on his whole career, against every ' + player.position + '.'}
          </p>
        </div>
      )}
      <DdSkills
        player={useSeason ? seasonMe! : player}
        ovr={useSeason ? seasonOvr?.ovr[key] : car}
        ovrLabel={useSeason ? 'SZN' : 'OVR'}
        traits={grades.traits}
        overall={grades.overall}
        players={useSeason ? seasonPlayers : players}
        onOpenPlayer={(p) => onOpenPlayer(players.find((x) => playerKey(x) === playerKey(p)) ?? p)}
      />
    </div>
  );
};

export default DdSkillsSwitch;
