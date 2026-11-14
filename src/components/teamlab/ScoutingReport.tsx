import type { CSSProperties } from 'react';
import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { bannerTeamOf } from '@/utils/playerExtras';
import { ordinal, type OfficeState } from '@/utils/clubOffice';
import { SLOTS, type LabContext, type Lineup } from '@/utils/teamLab';
import { labLedger } from './labOffice';
import { PixelStars } from './labArt';

/**
 * The broadcast half of the scouting report: the lineup through the game's own rules, from the live save. Team
 * strength by the game's formula with the coach's coordinators (7.8), the cap, the window before the first player
 * reaches his final season, and per player his stars now and his ceiling (7.1), his salary against the game's price
 * (7.2) and the pick he'd fetch (7.3). Players the save doesn't have (retired, NFL legends) are named, never rated.
 */

const Meter = ({ value, max = 10, tone }: { value: number; max?: number; tone?: string }) => (
  <span className="lab-meter" aria-hidden="true">
    {Array.from({ length: max }, (_, i) => (
      <i key={i} data-on={i < value ? '1' : '0'} style={tone && i < value ? ({ background: tone } as CSSProperties) : undefined} />
    ))}
  </span>
);

const PAY_LABEL = { underpaid: 'Underpaid', fair: 'Fair deal', overpaid: 'Overpaid' } as const;

const ScoutingReport = ({ ctx, lineup, office }: { ctx: LabContext; lineup: Lineup; office: OfficeState }) => {
  const L = labLedger(office, lineup);
  if (!L.filled) return null;
  const [off, def] = L.strength;
  const room = L.cap - L.payroll;
  const unrated = SLOTS.filter((s) => lineup[s.id] && !L.rows[s.id]).map((s) => ctx.profiles.get(lineup[s.id])).filter(Boolean);
  // the age chart's span: this season to the last final season (at most 12 seasons)
  const rows = SLOTS.map((s) => ({ slot: s, r: L.rows[s.id], p: ctx.profiles.get(lineup[s.id]) })).filter((x) => x.r && x.p);
  const last = Math.min(L.season + 11, Math.max(L.season + 4, ...rows.map((x) => x.r!.finalSeason)));
  const span = last - L.season + 1;
  const pct = (season: number) => ((season - L.season + 1) / span) * 100;

  return (
    <section aria-labelledby="lab-report" className="lab-panel lab-report">
      <header className="lab-broadcast">
        <span className="lab-live">
          <Radio className="h-3.5 w-3.5" aria-hidden="true" /> Live save
        </span>
        <h2 id="lab-report" className="lab-broadcast-title">
          Front-office report
        </h2>
        <span className="lab-broadcast-meta">
          Y{L.season} · {L.rated} of {L.filled} rated by the game
        </span>
      </header>

      <div className="lab-boxes">
        {[off, def].map((s) => (
          <div key={s.side} className="lab-box">
            <p className="lab-k">{s.side === 'offense' ? 'Team offense' : 'Team defense'}</p>
            <p className="lab-big">
              {s.rating}
              <small>/10</small>
            </p>
            <Meter value={s.rating} />
            <p className="lab-note">
              {s.factor} × ({s.stars} stars + {s.side === 'offense' ? 'OC' : 'DC'} {s.coord}) = {s.raw.toFixed(1)}
              {s.raw > 10 ? ', capped at 10' : ''}
              {(s.side === 'offense' ? L.offenseRated < 6 : L.defenseRated < 4) && (
                <> · {s.side === 'offense' ? `${L.offenseRated} of 6` : `${L.defenseRated} of 4`} rated</>
              )}
            </p>
          </div>
        ))}
        <div className="lab-box">
          <p className="lab-k">Payroll</p>
          <p className={cn('lab-big', room < 0 && 'text-destructive')}>
            {L.payroll}
            <small>/{L.cap}</small>
          </p>
          <span className="lab-capbar" aria-hidden="true">
            {rows.map(({ slot, r, p }) => {
              const c = findNFLTeam(bannerTeamOf(p!.player));
              return <i key={slot.id} style={{ width: `${(r!.p.salary / Math.max(L.cap, L.payroll)) * 100}%`, background: c ? `hsl(${c.primaryColor})` : 'hsl(var(--line))' }} title={`${p!.name} ${r!.p.salary}`} />;
            })}
          </span>
          <p className="lab-note">{room >= 0 ? `${room} room under the cap` : `${-room} over the cap`} · the coach's cap with every boost</p>
        </div>
        <div className="lab-box">
          <p className="lab-k">Window</p>
          {L.window ? (
            <>
              <p className="lab-big">
                Y{L.window.season}
              </p>
              <Meter value={Math.min(10, L.window.season - L.season + 1)} tone="hsl(var(--turf))" />
              <p className="lab-note">
                {L.window.season === L.season ? 'This is ' : 'Holds together through '}
                {L.window.season === L.season ? `${L.window.name}'s final season` : `Y${L.window.season}, ${L.window.name}'s final season`}
              </p>
            </>
          ) : (
            <p className="lab-note">Nobody in this lineup plays in the save.</p>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="lab-ledger" role="table" aria-label="Ratings, contracts and final seasons">
          <div className="lab-ledger-head" role="row">
            <span role="columnheader">Player</span>
            <span role="columnheader">Age</span>
            <span role="columnheader">Stars → ceiling</span>
            <span role="columnheader">Salary</span>
            <span role="columnheader" className="lab-ledger-years">
              <span>Y{L.season}</span>
              <span>Y{last}</span>
            </span>
          </div>
          {rows.map(({ slot, r, p }) => {
            const club = bannerTeamOf(p!.player);
            const c = findNFLTeam(club);
            const strip = {
              '--tg-c': c ? `hsl(${c.primaryColor})` : 'hsl(var(--line))',
              '--tg-fg': c ? getReadableTextOn(c.primaryColor) : '#fff',
            } as CSSProperties;
            const row = r!;
            return (
              <div key={slot.id} className="lab-ledger-row" role="row">
                <span role="cell" className="lab-strip" style={strip}>
                  <TeamLogo team={club} size={16} decorative />
                  <b>{row.spos}</b>
                  <span className="truncate">{p!.name}</span>
                </span>
                <span role="cell" className="lab-num">
                  {row.p.age}
                </span>
                <span role="cell" className="flex items-center gap-1">
                  <PixelStars now={row.stars} ceiling={row.ceiling} label={`${row.stars / 2} stars now, ceiling ${row.ceiling / 2}`} />
                  {row.ceiling > row.stars && <em className="lab-room">+{(row.ceiling - row.stars) / 2}</em>}
                </span>
                <span role="cell" className="flex items-center gap-1.5">
                  <b className="lab-num">{row.p.salary}</b>
                  <span className={cn('lab-pay', `lab-pay--${row.pay.tag}`)} title={`The game prices him at ${row.price}`}>
                    {PAY_LABEL[row.pay.tag]}
                    {row.pay.tag !== 'fair' && ` ${row.pay.gap > 0 ? '+' : ''}${row.pay.gap}`}
                  </span>
                  <span className="lab-pick" title="The pick the game offers if the coach trades him">
                    {ordinal(row.trade)}
                  </span>
                </span>
                <span role="cell" className="lab-years" aria-label={`Final season Y${row.finalSeason}`}>
                  <i style={{ width: `${Math.min(100, pct(row.finalSeason))}%` }} data-last={row.finalSeason === L.season ? '1' : '0'} />
                  <b>Y{row.finalSeason}</b>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {unrated.length > 0 && (
        <p className="lab-note px-3 pb-2">
          Not playing in the save (retired, or an NFL legend), so the game has no ratings for: {unrated.map((p) => p!.name).join(', ')}.
        </p>
      )}
      <p className="lab-note border-t border-line/60 px-3 py-2">
        The game's own rules from the save: stars are its half-star rating, team strength is its formula with the {office.club}' coordinators
        {L.coordinators.oc ? ` (OC ${L.coordinators.oc}, DC ${L.coordinators.dc})` : ''}, salary is tagged against its price, and the pick is what a trade
        would fetch.
      </p>
    </section>
  );
};

export default ScoutingReport;
