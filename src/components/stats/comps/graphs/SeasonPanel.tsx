import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import TeamLogo from '@/components/brand/TeamLogo';
import GameSprite from '@/components/GameSprite';
import { fmtFixed } from '@/utils/numberFormat';
import { ordinal } from '../../analytics/viz';
import type { Career } from './careerStory';
import { BOX, fmtRate, groupOf, seasonRates } from './statDefs';
import { EVENT_LABEL, GlyphIcon, clubInk, shortNum, yLabel } from './graphKit';

const STATUS_NOTE: Record<string, string> = {
  first: 'First recorded season: no snapshot before it, so no season line',
  idle: 'No games between the two season ends',
  multi: 'An import correction spans more than one season here: no season line',
  short: 'Fewer than 8 games: a small sample, kept out of the percentile pools',
  live: 'Season in progress (live save); card numbers carried from the last season end',
};

const PctBar = ({ pct }: { pct: number | undefined }) => {
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative h-1.5 w-14 overflow-hidden rounded-sm bg-panel-2" aria-hidden="true">
        <span className="absolute inset-y-0 left-0" style={{ width: `${pct == null ? 0 : Math.max(3, pct)}%`, background: pct == null ? 'transparent' : `hsl(213 80% ${42 + (pct / 100) * 26}%)` }} />
      </span>
      <span className="w-8 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{pct == null ? '—' : ordinal(pct)}</span>
    </span>
  );
};

/** The scrubbed season: club and kit, card numbers, the box score and rates with percentiles, and its events. */
const SeasonPanel = ({ player, career, idx }: { player: Player; career: Career; idx: number }) => {
  const p = career.points[idx];
  const club = career.clubs[idx];
  const ink = clubInk(club);
  const prev = idx > 0 ? career.points[idx - 1] : null;
  const evs = career.events.filter((e) => e.year === p.year);
  const ringSeason = evs.some((e) => e.kind === 'ring');
  const g = groupOf(player.position);
  const rates = seasonRates(player.position).filter((r) => Number.isFinite(p.rates[r.id]));
  const delta = (a: number, b: number | undefined) => (b == null || a === b ? null : a - b);
  const tiles = [
    { k: 'OVR', v: fmtFixed(p.ovr, 0), d: delta(p.ovr, prev?.ovr) },
    { k: 'Value', v: shortNum(p.value), d: prev ? delta(p.value, prev.value) : null, pct: true },
    { k: 'Legacy', v: fmtFixed(p.legacy, 0), d: delta(p.legacy, prev?.legacy) },
    { k: 'Rank', v: `#${p.legacyRank}`, d: prev ? -(delta(p.legacyRank, prev.legacyRank) ?? 0) || null : null },
    { k: 'HOF', v: String(p.hof.score), d: delta(p.hof.score, prev?.hof.score) },
    { k: 'Grade', v: p.grade || '—', d: null },
  ];
  return (
    <div className="cg-panel min-w-0" style={{ '--cg-club': ink.mark } as CSSProperties} aria-live="polite">
      <div className="cg-panel__head">
        <div className="cg-panel__stage" aria-hidden="true">
          <GameSprite key={`${club}-${ringSeason}`} player={player} team={club ?? undefined} kind="figure" size="m" action={ringSeason ? 'celebrate' : undefined} className="cg-panel__sprite" />
          {ink.team && <TeamLogo team={ink.team} size={40} decorative className="cg-panel__logo" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-pixel text-[9px] uppercase text-muted-foreground">{p.status === 'live' ? 'Live season' : 'Season'}</p>
          <p className="font-display text-4xl font-bold leading-none tabular-nums text-chalk">{yLabel(p.year)}</p>
          <p className="mt-1 truncate font-display text-sm font-bold uppercase tracking-wide" style={{ color: ink.mark }}>
            {club ? `${ink.team?.city ?? ''} ${club}`.trim() : 'Retired'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {p.games > 0 ? `${p.games} games` : p.status === 'first' ? `${p.totals.g ?? 0} career games` : 'Did not play'}
            {p.careerYear ? ` · career year ${p.careerYear}` : ''}
          </p>
        </div>
      </div>

      <ul className="cg-tiles" aria-label={`${yLabel(p.year)} card numbers`}>
        {tiles.map((t) => (
          <li key={t.k}>
            <span className="cg-tile__k">{t.k}</span>
            <span className="cg-tile__v">{t.v}</span>
            {t.d != null && t.d !== 0 && (
              <span className={t.d > 0 ? 'cg-up' : 'cg-down'}>
                {t.d > 0 ? '▲' : '▼'}
                {t.pct && prev?.value ? `${Math.abs(Math.round((100 * t.d) / prev.value))}%` : shortNum(Math.abs(t.d))}
              </span>
            )}
          </li>
        ))}
      </ul>

      {STATUS_NOTE[p.status] && <p className="cg-note">{STATUS_NOTE[p.status]}</p>}

      {p.box && (
        <table className="cg-box">
          <caption className="sr-only">{`${yLabel(p.year)} box score with percentile among ${player.position}s that season (per game)`}</caption>
          <thead>
            <tr>
              <th scope="col">Box score</th>
              <th scope="col" className="text-right">Total</th>
              <th scope="col" className="text-right">/G</th>
              <th scope="col" className="text-right">Pctl</th>
            </tr>
          </thead>
          <tbody>
            {BOX[g].map((b) => (
              <tr key={b.key}>
                <th scope="row">{b.label}</th>
                <td>{fmtFixed(p.box![b.key] ?? 0, 0)}</td>
                <td>{p.games ? fmtFixed((p.box![b.key] ?? 0) / p.games, 1) : '—'}</td>
                <td>
                  <PctBar pct={p.pct[b.key]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rates.length > 0 && (
        <table className="cg-box">
          <caption className="sr-only">{`${yLabel(p.year)} rates`}</caption>
          <thead>
            <tr>
              <th scope="col">Rates</th>
              <th scope="col" className="text-right" colSpan={2}>
                Value
              </th>
              <th scope="col" className="text-right">Pctl</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} title={r.definition}>
                <th scope="row">{r.trait ? r.name : r.label}</th>
                <td colSpan={2}>{fmtRate(r, p.rates[r.id])}</td>
                <td>
                  <PctBar pct={p.pct[r.id]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="cg-todate">
        <p className="font-pixel text-[7px] uppercase text-muted-foreground">Career to the end of {yLabel(p.year)}</p>
        <dl className="cg-split__stats">
          {[{ key: 'g', short: 'Games' }, ...BOX[g], { key: 'rings', short: 'Rings' }].map((b) => (
            <div key={b.key}>
              <dt>{b.short}</dt>
              <dd>{shortNum(p.totals[b.key] ?? 0)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {evs.length > 0 && (
        <ul className="cg-evs" aria-label={`${yLabel(p.year)} events`}>
          {evs.map((e, i) => (
            <li key={i}>
              <GlyphIcon kind={e.kind} px={2} />
              <span className="font-semibold text-chalk">{e.label}</span>
              {e.detail && <span className="text-muted-foreground">{e.detail}</span>}
              <span className="sr-only">({EVENT_LABEL[e.kind]})</span>
            </li>
          ))}
        </ul>
      )}
      {career.live && idx === career.points.length - 1 && (
        <p className="cg-note">
          Age {career.live.age} in Y{career.live.season}. Stars {career.live.starsNow / 2} now, ceiling {career.live.starsMax / 2}.{' '}
          {career.live.finalSeason <= career.live.season ? 'This is his final season by the game’s clock.' : `Final season by the game’s clock: Y${career.live.finalSeason}.`}
        </p>
      )}
    </div>
  );
};

export default SeasonPanel;
