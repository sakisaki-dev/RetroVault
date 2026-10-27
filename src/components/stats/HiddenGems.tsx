import { useMemo, useState } from 'react';
import { Gem, TrendingUp } from 'lucide-react';
import type { LeagueData, Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { playerKey } from '@/config/ovr';
import { SIM_MIN_GAMES } from '@/config/advanced';
import { playerSkillGrades, type GradeStep } from '@/config/skillGrades';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import PositionBadge from '../PositionBadge';
import TeamLogo from '../brand/TeamLogo';

/** Skill rating at least this high, and at least this many points above the official OVR. */
const MIN_SKILL = 80;
const MIN_GAP = 12;
/** Fewer games than this = still early in his career ("On the rise"); more = "Underrated". */
const RISING_MAX_GAMES = 100;
const MIN_GAMES = 15;
const SHOW = 8;
/** Under 32 games the rates are a small sample: flagged, never hidden. */
const SMALL_SAMPLE = 32;

const OVR_FLOOR = 60;
const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - OVR_FLOOR) / (99 - OVR_FLOOR)) * 100))}%`;

interface GemRow {
  player: Player;
  ovr: number;
  skill: number;
  grade: GradeStep;
  gap: number;
  best: string;
}

type Mode = 'rising' | 'underrated';

const MODES: { id: Mode; label: string; blurb: string; Icon: typeof Gem }[] = [
  {
    id: 'rising',
    label: 'On the rise',
    blurb: `Under ${RISING_MAX_GAMES} games and still playing: per-game skill already plays far above the overall, which needs a long career to catch up.`,
    Icon: TrendingUp,
  },
  {
    id: 'underrated',
    label: 'Underrated',
    blurb: `${RISING_MAX_GAMES}+ games, yet the overall (career production and awards) undersells how good he was every time he took the field.`,
    Icon: Gem,
  },
];

/**
 * Players whose skill rating (per-game skills vs the position, S–F) is far above their official OVR (career
 * production + awards): young players about to break out, and veterans the overall underrates.
 */
const HiddenGems = ({ data, onSelect }: { data: LeagueData; onSelect: (p: Player) => void }) => {
  const ovrMap = useOfficialOvr();
  const [mode, setMode] = useState<Mode>('rising');

  const gems = useMemo(() => {
    const league = (['quarterbacks', 'runningbacks', 'widereceivers', 'tightends', 'offensiveline', 'linebackers', 'defensivebacks', 'defensiveline'] as const)
      .flatMap((k) => data[k] as Player[])
      .filter((p) => !p.isRealLegend);
    const out: Record<Mode, GemRow[]> = { rising: [], underrated: [] };
    league.forEach((p) => {
      if (p.games < MIN_GAMES) return;
      const ovr = ovrMap.get(playerKey(p));
      const { traits, overall } = playerSkillGrades(league, p);
      if (ovr == null || !overall) return;
      const gap = overall.rating - ovr;
      if (overall.rating < MIN_SKILL || gap < MIN_GAP) return;
      const top = traits.filter((t) => Number.isFinite(t.percentile) && t.grade).sort((a, b) => b.percentile - a.percentile)[0];
      const gem: GemRow = {
        player: p,
        ovr,
        skill: overall.rating,
        grade: overall.grade,
        gap,
        best: top ? `${top.trait.name} ${top.grade!.grade}` : '',
      };
      // "Rising" means still playing (status is internal data, never shown)
      if (p.games < RISING_MAX_GAMES) {
        if (p.status !== 'Retired') out.rising.push(gem);
      } else out.underrated.push(gem);
    });
    (Object.keys(out) as Mode[]).forEach((m) => out[m].sort((a, b) => b.gap - a.gap || b.skill - a.skill));
    return out;
  }, [data, ovrMap]);

  const list = gems[mode].slice(0, SHOW);
  const active = MODES.find((m) => m.id === mode)!;

  return (
    <section id="hidden-gems" aria-labelledby="gems-title" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="gems-title" className="section-title text-2xl">
            <Gem className="h-5 w-5 text-gold" aria-hidden="true" />
            Hidden Gems
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Low overall, sky-high skill rating. The overall rewards long careers and trophies; the skill rating grades every game he plays against
            his position.
          </p>
        </div>
        <div role="tablist" aria-label="Hidden gems view" className="flex gap-1 rounded-lg border border-line bg-night/60 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                mode === m.id ? 'bg-gold text-black' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <m.Icon className="h-4 w-4" aria-hidden="true" />
              {m.label}
              <span className="font-pixel text-[9px] opacity-70">{gems[m.id].length}</span>
            </button>
          ))}
        </div>
      </div>

      <div key={active.label} className="rv-view-in glass-card p-3 sm:p-4" role="tabpanel" aria-label={active.label}>
        <p className="mb-3 text-xs text-muted-foreground">{active.blurb}</p>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nobody fits right now.</p>
        ) : (
          <ol className="grid gap-2 md:grid-cols-2">
            {list.map((g, i) => (
              <li key={playerKey(g.player)}>
                <button
                  type="button"
                  onClick={() => onSelect(g.player)}
                  aria-label={`${g.player.name}, ${g.player.position}: overall ${g.ovr}, skill rating ${g.skill} (${g.grade.grade}), ${g.gap} points higher. Open card`}
                  className="group flex w-full items-center gap-3 rounded-lg border border-line bg-night/40 px-3 py-2.5 text-left transition-colors hover:border-gold/60 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <span className="w-5 shrink-0 text-center font-display text-lg font-extrabold italic text-muted-foreground">{i + 1}</span>
                  <TeamLogo team={g.player.team} size={28} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold group-hover:text-gold">{g.player.name}</span>
                      <PositionBadge position={g.player.position} />
                      {g.player.games < SMALL_SAMPLE && (
                        <span className="shrink-0 rounded bg-panel-2 px-1.5 py-0.5 font-pixel text-[8px] uppercase text-muted-foreground" title="Under 32 games: rates can still swing">
                          small sample
                        </span>
                      )}
                    </span>
                    {/* OVR → skill on one 60–99 track: the gold stretch is how much the overall undersells him */}
                    <span className="relative mt-2 block h-2 rounded-full bg-line/60" aria-hidden="true">
                      <span className="absolute inset-y-0 rounded-full bg-gold/70" style={{ left: pos(g.ovr), right: `calc(100% - ${pos(g.skill)})` }} />
                      <span className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-sm bg-muted-foreground" style={{ left: pos(g.ovr) }} />
                      <span className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-sm bg-gold" style={{ left: pos(g.skill) }} />
                    </span>
                    <span className="mt-1 flex justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {g.player.games} G{g.best && <> · Best: {g.best}</>}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        OVR <b className="text-chalk">{g.ovr}</b> → Skill <b className="text-gold">{g.skill}</b>
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-center">
                    <span className="rounded px-1.5 font-display text-sm font-extrabold text-[#0b1020]" style={{ background: g.grade.color }}>
                      {g.grade.grade}
                    </span>
                    <span className="mt-0.5 font-display text-base font-extrabold tabular-nums text-gold">+{g.gap}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

export default HiddenGems;
