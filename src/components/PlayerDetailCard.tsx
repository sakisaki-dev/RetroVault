import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Activity, BarChart3, Gauge, History, IdCard, Info, Pencil, Star, Trophy, Users } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { useLeague } from '@/context/LeagueContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { findNFLTeam } from '@/utils/nflTeams';
import { formatDecimal, getMetricTier, getTierBgColor, getTierColor, getTierLabel } from '@/utils/metricColors';
import { AWARD_META, POSITION_NAMES } from '@/utils/playerMeta';
import { getLegacyTier, getRawTrueTalent, isDefensivePosition, isHallOfFamer } from '@/config/stats';
import { useJerseyNumbers } from '@/utils/jerseys';
import TeamBadge from './brand/TeamBadge';
import TeamLogo from './brand/TeamLogo';
import ProPlayerBanner from './brand/ProPlayerBanner';
import { overallRating } from './brand/ProPlayerBanner.utils';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import PlayerEditDialog from './PlayerEditDialog';
import {
  getFamilyTies,
  normalizeName,
  usePlayerExtras,
  type PlayerCardExtras,
  type RealNflCareer,
} from '@/utils/playerExtras';

interface PlayerDetailCardProps {
  player: Player | null;
  onClose: () => void;
}

interface StatItem {
  label: string;
  /** Long form for screen readers / tooltips */
  title?: string;
  /** null = not enough data (shown as an em dash) */
  value: number | null;
  decimals?: number;
}

/** n / d (optionally scaled), or null when the denominator is zero. */
const rate = (n: number, d: number, scale = 1): number | null => (d > 0 ? (n / d) * scale : null);

const fmt = (v: number | null, decimals = 0) => (v == null || !Number.isFinite(v) ? '—' : formatDecimal(v, decimals));

/** Career totals for the player's position. */
const getCareerLine = (p: Player): StatItem[] => {
  const base: StatItem[] = [{ label: 'GP', title: 'Games played', value: p.games }];
  switch (p.position) {
    case 'QB':
      return [
        ...base,
        { label: 'CMP', title: 'Completions', value: p.completions },
        { label: 'ATT', title: 'Pass attempts', value: p.attempts },
        { label: 'YDS', title: 'Passing yards', value: p.passYds },
        { label: 'TD', title: 'Passing touchdowns', value: p.passTD },
        { label: 'INT', title: 'Interceptions thrown', value: p.interceptions },
        { label: 'SCK', title: 'Times sacked', value: p.sacks },
        { label: 'RUSH YDS', title: 'Rushing yards', value: p.rushYds },
        { label: 'RUSH TD', title: 'Rushing touchdowns', value: p.rushTD },
      ];
    case 'RB':
      return [
        ...base,
        { label: 'CAR', title: 'Carries', value: p.rushAtt },
        { label: 'YDS', title: 'Rushing yards', value: p.rushYds },
        { label: 'TD', title: 'Rushing touchdowns', value: p.rushTD },
        { label: 'REC', title: 'Receptions', value: p.receptions },
        { label: 'REC YDS', title: 'Receiving yards', value: p.recYds },
        { label: 'REC TD', title: 'Receiving touchdowns', value: p.recTD },
        { label: 'FUM', title: 'Fumbles', value: p.fumbles },
      ];
    case 'WR':
    case 'TE':
      return [
        ...base,
        { label: 'REC', title: 'Receptions', value: p.receptions },
        { label: 'YDS', title: 'Receiving yards', value: p.recYds },
        { label: 'TD', title: 'Receiving touchdowns', value: p.recTD },
        { label: 'LNG', title: 'Longest reception', value: p.longest },
        { label: 'FUM', title: 'Fumbles', value: p.fumbles },
      ];
    case 'OL':
      return [...base, { label: 'BLK', title: 'Blocks', value: p.blocks }];
    case 'LB':
    case 'DB':
    case 'DL':
      return [
        ...base,
        { label: 'TKL', title: 'Tackles', value: p.tackles },
        { label: 'SACK', title: 'Sacks', value: p.sacks },
        { label: 'INT', title: 'Interceptions', value: p.interceptions },
        { label: 'FF', title: 'Forced fumbles', value: p.forcedFumbles },
      ];
    default:
      return base;
  }
};

/** Efficiency and per-game rates, computed from career totals. */
const getRates = (p: Player): StatItem[] => {
  const g = p.games;
  switch (p.position) {
    case 'QB':
      return [
        { label: 'CMP%', title: 'Completion percentage', value: rate(p.completions, p.attempts, 100), decimals: 1 },
        { label: 'Y/A', title: 'Yards per pass attempt', value: rate(p.passYds, p.attempts), decimals: 2 },
        { label: 'YDS/G', title: 'Passing yards per game', value: rate(p.passYds, g), decimals: 1 },
        { label: 'TD/16G', title: 'Passing touchdowns per 16 games', value: rate(p.passTD, g, 16), decimals: 1 },
        { label: 'INT/16G', title: 'Interceptions per 16 games', value: rate(p.interceptions, g, 16), decimals: 1 },
        { label: 'TD:INT', title: 'Touchdowns per interception', value: rate(p.passTD, p.interceptions), decimals: 2 },
      ];
    case 'RB':
      return [
        { label: 'Y/C', title: 'Yards per carry', value: rate(p.rushYds, p.rushAtt), decimals: 2 },
        { label: 'RUSH/G', title: 'Rushing yards per game', value: rate(p.rushYds, g), decimals: 1 },
        { label: 'SCRM/G', title: 'Scrimmage yards per game', value: rate(p.rushYds + p.recYds, g), decimals: 1 },
        { label: 'TD/16G', title: 'Total touchdowns per 16 games', value: rate(p.rushTD + p.recTD, g, 16), decimals: 1 },
        { label: 'Y/R', title: 'Yards per reception', value: rate(p.recYds, p.receptions), decimals: 1 },
        { label: 'FUM/16G', title: 'Fumbles per 16 games', value: rate(p.fumbles, g, 16), decimals: 1 },
      ];
    case 'WR':
    case 'TE':
      return [
        { label: 'REC/G', title: 'Receptions per game', value: rate(p.receptions, g), decimals: 1 },
        { label: 'YDS/G', title: 'Receiving yards per game', value: rate(p.recYds, g), decimals: 1 },
        { label: 'Y/R', title: 'Yards per reception', value: rate(p.recYds, p.receptions), decimals: 1 },
        { label: 'TD/16G', title: 'Receiving touchdowns per 16 games', value: rate(p.recTD, g, 16), decimals: 1 },
      ];
    case 'OL':
      return [
        { label: 'BLK/G', title: 'Blocks per game', value: rate(p.blocks, g), decimals: 2 },
        { label: 'BLK/16G', title: 'Blocks per 16 games', value: rate(p.blocks, g, 16), decimals: 1 },
      ];
    case 'LB':
    case 'DB':
    case 'DL':
      return [
        { label: 'TKL/G', title: 'Tackles per game', value: rate(p.tackles, g), decimals: 2 },
        { label: 'SACK/16G', title: 'Sacks per 16 games', value: rate(p.sacks, g, 16), decimals: 1 },
        { label: 'INT/16G', title: 'Interceptions per 16 games', value: rate(p.interceptions, g, 16), decimals: 1 },
        { label: 'TO/16G', title: 'Takeaways (INT + FF) per 16 games', value: rate(p.interceptions + p.forcedFumbles, g, 16), decimals: 1 },
      ];
    default:
      return [];
  }
};

const METRICS = [
  { key: 'trueTalent', label: 'True Talent', decimals: 1, note: 'Production rating' },
  { key: 'dominance', label: 'Dominance', decimals: 1, note: 'Talent + award points' },
  { key: 'careerLegacy', label: 'Career Legacy', decimals: 0, note: 'Talent, dominance, longevity' },
  { key: 'tpg', label: 'TPG', decimals: 2, note: 'Talent per game' },
] as const;

/** Columns that split `n` tiles into even rows (6 → 3+3, 7 → 4+3) with at most `max` per row. */
const balancedCols = (n: number, max: number) => (n <= max ? Math.max(n, 1) : Math.ceil(n / Math.ceil(n / max)));

/** Grid-like wrap where a short last row stretches to fill, so there are never empty cells. */
const tileVars = (n: number) =>
  ({ '--cols': balancedCols(n, 5), '--cols-sm': balancedCols(n, 3) }) as CSSProperties;
const TILE = 'grow basis-[calc(100%/var(--cols-sm)-0.5rem)] sm:basis-[calc(100%/var(--cols)-0.5rem)]';

const StatGrid = ({ items, label, accent }: { items: StatItem[]; label: string; accent?: boolean }) => (
  <dl className="flex flex-wrap gap-px overflow-hidden rounded-lg border border-line bg-line" style={tileVars(items.length)} aria-label={label}>
    {items.map((s) => (
      <div key={s.label} className={cn(TILE, 'flex flex-col-reverse bg-panel px-2 py-2.5 text-center')} title={s.title}>
        <dt className="mt-1 font-pixel text-[9px] uppercase text-muted-foreground">
          <span aria-hidden="true">{s.label}</span>
          <span className="sr-only">{s.title ?? s.label}</span>
        </dt>
        <dd className={cn('font-display text-2xl font-bold leading-none tabular-nums', accent ? 'text-sky' : 'text-chalk')}>
          {fmt(s.value, s.decimals ?? 0)}
        </dd>
      </div>
    ))}
  </dl>
);

// ---------- Extras (secondary info from player-extras.json; never merged into career totals) ----------

const EXTRA_LABELS: Record<string, string> = {
  games: 'GP', att: 'ATT', cmp: 'CMP', pass_yds: 'PASS YDS', pass_td: 'PASS TD', int: 'INT',
  rush_att: 'CAR', rush_yds: 'RUSH YDS', rush_td: 'RUSH TD', rec: 'REC', yds: 'YDS', td: 'TD',
  rec_yds: 'REC YDS', rec_td: 'REC TD', fum: 'FUM', fumbles: 'FUM', ret_yds: 'RET YDS', ret_td: 'RET TD',
  ret_long: 'RET LNG', tackles: 'TKL', sacks: 'SACK', forced_fumbles: 'FF', pass_long: 'PASS LNG',
  rush_long: 'RUSH LNG', long_run: 'LONG RUN', rec_long: 'REC LNG', rush_fum: 'RUSH FUM', sacks_taken: 'SACKED',
  xp_level: 'XP LVL',
};

const EXTRA_TITLES: Record<string, string> = {
  games: 'Games played', att: 'Pass attempts', cmp: 'Completions', pass_yds: 'Passing yards', pass_td: 'Passing touchdowns',
  int: 'Interceptions', rush_att: 'Carries', rush_yds: 'Rushing yards', rush_td: 'Rushing touchdowns', rec: 'Receptions',
  yds: 'Receiving yards', td: 'Receiving touchdowns', rec_yds: 'Receiving yards', rec_td: 'Receiving touchdowns',
  fum: 'Fumbles', fumbles: 'Fumbles', ret_yds: 'Return yards', ret_td: 'Return touchdowns', ret_long: 'Longest return',
  tackles: 'Tackles', sacks: 'Sacks', forced_fumbles: 'Forced fumbles', pass_long: 'Longest pass', rush_long: 'Longest run',
  long_run: 'Longest run', rec_long: 'Longest reception', rush_fum: 'Rushing fumbles', sacks_taken: 'Times sacked',
  xp_level: 'Experience level',
};

const humanize = (k: string) => k.replace(/_/g, ' ').toUpperCase();
const extraLabel = (k: string) => EXTRA_LABELS[k] ?? humanize(k);
const extraTitle = (k: string) => EXTRA_TITLES[k] ?? k.replace(/_/g, ' ');

/** Text card fields shown as label/value rows rather than numbers. */
const CARD_TEXT_FIELDS: { key: string; label: string }[] = [
  { key: 'age', label: 'Age' },
  { key: 'team', label: 'Card team' },
  { key: 'contract', label: 'Contract' },
  { key: 'trade_value', label: 'Trade value' },
  { key: 'weakest_attribute', label: 'Weakest attribute' },
];
const CARD_SKIP = new Set(['rating', 'potential', 'hof_flag', ...CARD_TEXT_FIELDS.map((f) => f.key)]);

const ExtraNumbers = ({ entries, label }: { entries: [string, number][]; label: string }) => (
  <dl className="flex flex-wrap gap-1.5" style={tileVars(entries.length)} aria-label={label}>
    {entries.map(([k, v]) => (
      <div key={k} className={cn(TILE, 'flex flex-col-reverse rounded-md bg-night/50 px-2 py-1.5 text-center')} title={extraTitle(k)}>
        <dt className="mt-0.5 font-pixel text-[8px] uppercase text-muted-foreground">
          <span aria-hidden="true">{extraLabel(k)}</span>
          <span className="sr-only">{extraTitle(k)}</span>
        </dt>
        <dd className="font-mono text-sm font-semibold tabular-nums text-secondary-foreground">{formatDecimal(v, Number.isInteger(v) ? 0 : 1)}</dd>
      </div>
    ))}
  </dl>
);

/** "5 stars" / "4.5" -> star row with the text for assistive tech. */
const StarRating = ({ value }: { value: string | number }) => {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return <span>{String(value)}</span>;
  const full = Math.floor(n);
  const half = n - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5 text-gold">
      {Array.from({ length: full }, (_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
      ))}
      {half && <Star className="h-3.5 w-3.5 fill-current opacity-50" aria-hidden="true" />}
      <span className="sr-only">{n} out of 5 stars</span>
    </span>
  );
};

const numericEntries = (rec: Record<string, unknown>, skip: Set<string> = new Set()) =>
  Object.entries(rec).filter((e): e is [string, number] => !skip.has(e[0]) && typeof e[1] === 'number' && Number.isFinite(e[1]));

const RealCareerPanel = ({ career }: { career: RealNflCareer }) => (
  <section className="rounded-lg border border-line/70 bg-panel/60 p-3" aria-label="Real NFL career before the league">
    <h4 className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <History className="h-3.5 w-3.5 text-sky" aria-hidden="true" />
      Before the league · real NFL career
      {career.years && <span className="lamp ml-auto">{String(career.years)}</span>}
    </h4>
    <ExtraNumbers entries={numericEntries(career, new Set(['years']))} label="Real NFL career totals" />
    <p className="mt-2 text-[11px] text-muted-foreground">Shown for context only; not included in league career totals.</p>
  </section>
);

const PlayerCardPanel = ({ card }: { card: PlayerCardExtras }) => {
  const texts = CARD_TEXT_FIELDS.filter((f) => card[f.key] != null && card[f.key] !== '');
  const nums = numericEntries(card, CARD_SKIP);
  return (
    <section className="rounded-lg border border-line/70 bg-panel/60 p-3" aria-label="Player card">
      <h4 className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <IdCard className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        Player card
        {card.hof_flag === true && <span className="lamp ml-auto">HOF track</span>}
      </h4>
      {(card.rating != null || card.potential != null) && (
        <dl className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {card.rating != null && (
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Rating</dt>
              <dd><StarRating value={card.rating as string | number} /></dd>
            </div>
          )}
          {card.potential != null && (
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Potential</dt>
              <dd><StarRating value={card.potential as string | number} /></dd>
            </div>
          )}
        </dl>
      )}
      {texts.length > 0 && (
        <dl className="mb-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {texts.map((f) => (
            <div key={f.key} className="flex justify-between gap-2 border-b border-border/30 py-0.5">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="text-right font-medium capitalize text-secondary-foreground">{String(card[f.key])}</dd>
            </div>
          ))}
        </dl>
      )}
      {nums.length > 0 && <ExtraNumbers entries={nums} label="Card stats" />}
    </section>
  );
};

const SectionTitle = ({ icon: Icon, children, id }: { icon: typeof Trophy; children: string; id: string }) => (
  <h3 id={id} className="section-title text-base sm:text-lg mb-3">
    <Icon className="h-4 w-4 text-gold" aria-hidden="true" />
    {children}
  </h3>
);

/** ESPN-style player page: broadcast banner, career line, per-game rates, tiered metrics and awards. */
const PlayerDetailCard = ({ player: selectedProp, onClose }: PlayerDetailCardProps) => {
  const { getAllPlayers, legends } = useLeague();
  const officialOvr = useOfficialOvr();
  const extras = usePlayerExtras();
  const { numberFor, retiredInfo } = useJerseyNumbers();
  const [isEditOpen, setIsEditOpen] = useState(false);
  // Following a family-tie chip swaps the shown player without closing the dialog
  const [jumpTo, setJumpTo] = useState<Player | null>(null);
  useEffect(() => setJumpTo(null), [selectedProp]);
  const selected = selectedProp ? jumpTo ?? selectedProp : null;

  // Re-resolve from the league so the page reflects edits; keep a caller-provided team (e.g. local overrides).
  const player = useMemo(() => {
    if (!selected) return null;
    const live = getAllPlayers().find((p) => p.position === selected.position && p.name === selected.name);
    return live ? ({ ...live, team: live.team || selected.team } as Player) : selected;
  }, [selected, getAllPlayers]);

  const findByName = (name: string) => {
    const key = normalizeName(name);
    return [...getAllPlayers(), ...legends].find((p) => normalizeName(p.name) === key) ?? null;
  };

  if (!player) return null;

  const nameKey = normalizeName(player.name);
  const realCareer = extras.realNflCareer[nameKey];
  const card = extras.cards[nameKey];
  const formerName = extras.formerNames[nameKey];
  const familyTies = getFamilyTies(extras, player.name);

  const team = findNFLTeam(player.team);
  const jerseyNumber = numberFor(player);
  const retired = retiredInfo(player);
  const ovr = overallRating(player, officialOvr);
  const isDefense = isDefensivePosition(player.position);
  const hofTier = getLegacyTier(player.careerLegacy);
  const rawTT = getRawTrueTalent(player);
  const factor = player.positionFactor ?? 1;
  const adjusted = Math.abs(factor - 1) > 0.0005;
  const careerLine = getCareerLine(player);
  const rates = getRates(player);
  const awards = AWARD_META[isDefense ? 'defense' : 'offense'];
  const headingId = `pdc-${player.position}-${player.name.replace(/\W+/g, '-')}`;

  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'w-[calc(100vw-1rem)] max-w-2xl max-h-[92vh] overflow-y-auto gap-0 border-line bg-card p-0',
          // Make the built-in close button readable on any team color
          '[&>button:last-child]:rounded-full [&>button:last-child]:bg-black/55 [&>button:last-child]:p-1.5 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:top-3 [&>button:last-child]:right-3',
        )}
      >
        {/* Broadcast banner */}
        <header className="relative">
          <ProPlayerBanner
            size="hero"
            name={player.name}
            nickname={player.nickname}
            position={player.position}
            team={team ?? player.team}
            number={jerseyNumber}
            ovr={ovr}
            hallOfFamer={isHallOfFamer(player)}
            retiredBy={retired?.teamLabel ?? null}
            eyebrow={`${POSITION_NAMES[player.position]}${team ? ` · ${team.conference} ${team.division}` : ''}`}
            nameAs={DialogTitle}
            topRight={<span className="w-20 shrink-0 sm:w-24" aria-hidden="true" />}
            className="rounded-none [&_.ppb\_\_field]:rounded-none"
          />
          <DialogDescription className="sr-only">
            Career profile for {player.name}: totals, per-game rates, advanced metrics and awards.
            {retired ? ` Number ${retired.number} retired by the ${retired.teamLabel}.` : ''}
          </DialogDescription>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setIsEditOpen(true)}
            className="absolute right-14 top-3 z-10 h-8 gap-1.5 border border-black/20 bg-black/55 px-2.5 text-white hover:bg-black/70"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Edit</span>
            <span className="sr-only sm:hidden">Edit player</span>
          </Button>

          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2 sm:px-6">
            {team ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-chalk">
                <TeamLogo team={team} size={18} decorative />
                {team.fullName}
              </span>
            ) : player.team ? (
              <TeamBadge team={player.team} size="sm" />
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">No team</span>
            )}
            {hofTier && (
              <span className="inline-flex items-center gap-1 rounded bg-black/40 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-gold">
                <Trophy className="h-3 w-3" aria-hidden="true" />
                Hall of Fame · {hofTier.label}
              </span>
            )}
            {formerName && <span className="text-xs text-muted-foreground">Formerly known as {formerName}</span>}
          </div>
        </header>

        {/* Scoreboard strip */}
        <div className="scoreboard-strip flex flex-wrap gap-1.5 px-4 py-2 sm:px-6" aria-label="Career summary">
          <span className="lamp">GP <b>{player.games}</b></span>
          <span className="lamp">Legacy <b>{fmt(player.careerLegacy, 0)}</b></span>
          <span className="lamp">Rings <b>{player.rings}</b></span>
          <span className="lamp">MVP <b>{player.mvp}</b></span>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <section aria-labelledby={`${headingId}-career`}>
            <SectionTitle icon={BarChart3} id={`${headingId}-career`}>Career stats</SectionTitle>
            <StatGrid items={careerLine} label="Career totals" />
          </section>

          {rates.length > 0 && (
            <section aria-labelledby={`${headingId}-rates`}>
              <SectionTitle icon={Activity} id={`${headingId}-rates`}>Rates</SectionTitle>
              <StatGrid items={rates} label="Per-game and efficiency rates" accent />
              <p className="mt-2 text-xs text-muted-foreground">
                Computed from career totals. "/16G" is per 16 games played; a dash means there are no attempts to divide by.
              </p>
            </section>
          )}

          {(realCareer || card || familyTies.length > 0) && (
            <div className="space-y-2">
              {realCareer && <RealCareerPanel career={realCareer} />}
              {card && <PlayerCardPanel card={card} />}
              {familyTies.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="sr-only">Family:</span>
                  {familyTies.map((tie) => {
                    const target = findByName(tie.name);
                    const text = (
                      <>
                        <span className="text-muted-foreground">{tie.label}</span> <span className="font-semibold">{tie.name}</span>
                      </>
                    );
                    return target ? (
                      <button
                        key={`${tie.label}:${tie.name}`}
                        type="button"
                        onClick={() => setJumpTo(target)}
                        className="rounded-full border border-line bg-panel-2 px-2.5 py-1 hover:border-gold hover:text-gold"
                      >
                        {text}
                      </button>
                    ) : (
                      <span key={`${tie.label}:${tie.name}`} className="rounded-full border border-line/60 px-2.5 py-1">
                        {text}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <section aria-labelledby={`${headingId}-metrics`}>
            <SectionTitle icon={Gauge} id={`${headingId}-metrics`}>Advanced metrics</SectionTitle>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {METRICS.map((m) => {
                const value = player[m.key] ?? 0;
                const tier = getMetricTier(value, m.key);
                const color = getTierColor(tier);
                return (
                  <div
                    key={m.key}
                    className="flex flex-col rounded-lg border bg-panel p-3"
                    style={{ borderColor: getTierBgColor(tier, 0.55), boxShadow: `inset 0 3px 0 ${color}` }}
                  >
                    <dt className="font-pixel text-[9px] uppercase text-muted-foreground">{m.label}</dt>
                    <dd className="mt-1 font-display text-3xl font-bold leading-none tabular-nums" style={{ color }}>
                      {fmt(value, m.decimals)}
                    </dd>
                    <dd className="mt-1.5">
                      <span
                        className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ color, backgroundColor: getTierBgColor(tier) }}
                      >
                        {getTierLabel(tier, m.key)}
                      </span>
                    </dd>
                    {m.key === 'trueTalent' && adjusted ? (
                      <dd className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                        Raw {fmt(rawTT, 1)} × {factor.toFixed(3)}
                      </dd>
                    ) : (
                      <dd className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{m.note}</dd>
                    )}
                  </div>
                );
              })}
            </dl>
            {adjusted && (
              <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky" aria-hidden="true" />
                <span>
                  Position-adjusted: the sheet's {player.position} True Talent ({fmt(rawTT, 1)}) is scaled by{' '}
                  {factor.toFixed(3)} to {fmt(player.trueTalent, 1)} so every position shares one scale. Dominance, Legacy
                  and TPG use the adjusted value.
                </span>
              </p>
            )}
          </section>

          <section aria-labelledby={`${headingId}-awards`}>
            <SectionTitle icon={Trophy} id={`${headingId}-awards`}>Awards</SectionTitle>
            <ul className="flex flex-wrap gap-2" style={tileVars(awards.length)}>
              {awards.map(({ key, label, long, Icon, hsl }) => {
                const n = player[key] ?? 0;
                const has = n > 0;
                return (
                  <li
                    key={key}
                    className={cn(TILE, 'flex flex-col items-center rounded-lg border px-2 py-2.5 text-center', !has && 'opacity-55')}
                    style={{
                      borderColor: has ? `hsl(${hsl} / 0.45)` : 'hsl(var(--line))',
                      background: has ? `hsl(${hsl} / 0.1)` : 'hsl(var(--panel))',
                    }}
                    title={long}
                  >
                    <Icon className="h-5 w-5" style={{ color: has ? `hsl(${hsl})` : undefined }} aria-hidden="true" />
                    <span className="mt-1 font-display text-2xl font-bold leading-none tabular-nums">{n}</span>
                    <span className="mt-1 font-pixel text-[9px] uppercase text-muted-foreground" aria-hidden="true">
                      {label}
                    </span>
                    <span className="sr-only">{long}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </DialogContent>

      <PlayerEditDialog
        player={isEditOpen ? player : null}
        onClose={() => setIsEditOpen(false)}
        // PlayerEditDialog refreshes league data itself
        onSave={() => setIsEditOpen(false)}
        onDelete={() => {
          setIsEditOpen(false);
          onClose();
        }}
      />
    </Dialog>
  );
};

export default PlayerDetailCard;
