import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeftRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { useLeague } from '@/context/LeagueContext';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import TeamLogo from '@/components/brand/TeamLogo';
import GameSprite from '@/components/GameSprite';
import { useGameSprites } from '@/utils/gameSprites';
import { findNFLTeam } from '@/utils/nflTeams';
import { getTeamColors, liftForDarkBg } from '@/utils/teamColors';
import { bannerTeamOf } from '@/utils/playerExtras';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { tributeEntryOf, useLeagueContent, useTribute, type StoryStat, type Tribute, type TributeChapter, type TributeIndexEntry } from '@/utils/leagueContent';
import './tribute.css';

/**
 * A Player Tribute (the fifth AI-authored lane: data/y80/tributes.json, written only by tribute.set; every figure
 * checked by scripts/story_check.py like the Season Story). A long-form feature on one player's whole career, laid out
 * after the owner's prototype (the Tribute artboard):
 *
 * - hero: his sprite celebrating under a light in his club's colours, the nickname as a giant watermark, the deck;
 * - the journey: one tile per club in that club's kit (GameSprite paints the save's neutral kit per club), years and
 *   rings from stints.json; a club logo where this machine has no sprites (the public build);
 * - the sections in order: club chapters (kicker: chapter number, city, years), the trade card (each side as the
 *   market saw it at the trade, and what each player did after), what the market thought (the card value per season,
 *   bars in the club colours of the season, a second player as a tick), the rival (two careers side by side), the
 *   numbers as tiles, and the last lap;
 * - every section's figures and their sources behind a toggle.
 *
 * The text comes from the tribute verbatim; the cards' figures come from the data (the builder's `data`). Phone first
 * (one column at 390px), a reading column up to 760px on a desktop. The tribute file loads on open; the hero shows
 * at once from the index, and a small loader fades in after ~150 ms for the rest. Reduced motion: nothing moves.
 */

const fmt = (n: number | undefined, d = 0) => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const yrs = (a: number, b: number) => (a === b ? `Y${a}` : `Y${a}–${b}`);

/** A club's colours as CSS vars for the tribute: --c (primary), --c2 (secondary), --ink (readable on dark) */
const clubVars = (team?: string | null): CSSProperties => {
  const c = getTeamColors(team);
  return c ? ({ '--c': `hsl(${c.primary})`, '--c2': `hsl(${c.secondary})`, '--ink': liftForDarkBg(c.primary, 66) } as CSSProperties) : {};
};

const Sources = ({ stats }: { stats: StoryStat[] }) =>
  stats.length ? (
    <details className="trib-sources">
      <summary>Figures and sources ({stats.length})</summary>
      <ul>
        {stats.map((s, i) => (
          <li key={`${s.label}-${i}`}>
            <b>{s.value}</b> <span>{s.label}</span>
            <code>{s.source}</code>
          </li>
        ))}
      </ul>
    </details>
  ) : null;

const Body = ({ body, className }: { body: string[]; className?: string }) => (
  <div className={cn('trib-body', className)}>
    {body.map((p, i) => (
      <p key={i}>{p}</p>
    ))}
  </div>
);

/** A player as a figure in a club's kit, or that club's logo where there are no sprites */
const Figure = ({ player, team, size, action, sprites }: { player?: Player; team: string; size: 's' | 'm' | 'l'; action?: 'idle' | 'celebrate' | 'run' | 'stiffarm'; sprites: boolean }) =>
  player && sprites ? (
    <GameSprite player={player} team={team} kind="figure" size={size} action={action} />
  ) : (
    <span className="trib-logo">
      <TeamLogo team={team} size={size === 'l' ? 120 : size === 'm' ? 64 : 32} decorative />
    </span>
  );

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

const Chapter = ({ c, n, years }: { c: TributeChapter; n: number; years: string | null }) => {
  const team = findNFLTeam(c.club);
  return (
    <section className="trib-chapter" style={clubVars(c.club)} aria-labelledby={`${c.id}-h`}>
      <p className="trib-kicker">
        Chapter {n}
        {team ? ` · ${team.city}` : ''}
        {years ? ` · ${years}` : ''}
      </p>
      <h2 id={`${c.id}-h`} className="trib-h2">
        {c.headline}
      </h2>
      {c.dek && <p className="trib-dek">{c.dek}</p>}
      <Body body={c.body} />
      <Sources stats={c.stats} />
    </section>
  );
};

const TradeCard = ({ c, subject }: { c: TributeChapter; subject: string }) => {
  const t = c.trade;
  return (
    <section className="trib-card trib-trade" aria-labelledby={`${c.id}-h`}>
      <header className="trib-trade__head">
        <p className="trib-kicker trib-kicker--gold">
          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" /> The trade{t ? ` · after ${t.after}` : ''}
        </p>
        <h2 id={`${c.id}-h`} className="trib-h3">
          {c.headline}
        </h2>
      </header>
      {t && (
        <div className="trib-trade__sides" role="group" aria-label={`The sides of the trade, as the market saw them after ${t.after}`}>
          {t.sides.map((sd) => (
            <div key={sd.to} className="trib-trade__side" style={clubVars(sd.to)}>
              <p className="trib-trade__to">
                <TeamLogo team={sd.to} size={18} decorative backed /> To the {sd.to}
              </p>
              <ul className="trib-trade__players">
                {sd.players.map((p) => (
                  <li key={p.key} className={cn(p.key === subject && 'is-subject')}>
                    <span className="trib-trade__name">
                      {p.name}
                      <span className="trib-trade__pos">{p.pos}</span>
                    </span>
                    <span className="trib-trade__line">
                      {p.ovr != null ? `CAR ${p.ovr}` : ''}
                      {p.grade ? ` · ${p.grade}` : ''}
                      {p.value != null ? ` · ${fmt(p.value)}` : ''}
                    </span>
                    {p.played === false && <span className="trib-trade__tag">Moved on before playing for them</span>}
                  </li>
                ))}
              </ul>
              <p className="trib-trade__value">
                <b>{fmt(sd.value)}</b>
                <span>Card value at the trade</span>
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="trib-card__text">
        <Body body={c.body} />
        {t && (
          <div className="trib-after">
            <p className="trib-mini">Since the trade{t.laterLabel ? ` · to ${t.laterLabel.split(' · ')[0]}` : ''}</p>
            <table className="trib-after__table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Games</th>
                  <th scope="col">Rings</th>
                </tr>
              </thead>
              <tbody>
                {t.sides.flatMap((sd) =>
                  sd.players.map((p) => (
                    <tr key={p.key} style={clubVars(sd.to)} className={cn(p.key === subject && 'is-subject')}>
                      <th scope="row">
                        <span className="trib-after__dot" aria-hidden="true" />
                        {p.name}
                      </th>
                      <td>{p.played === false && !p.after?.games ? '—' : fmt(p.after?.games)}</td>
                      <td>{fmt(p.after?.rings)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
        <Sources stats={c.stats} />
      </div>
    </section>
  );
};

const MarketCard = ({ c, journey, names }: { c: TributeChapter; journey: Tribute['journey']; names: Record<string, string> }) => {
  const m = c.market;
  const subject = m?.players[0];
  const other = m?.players[1];
  const max = Math.max(1, ...(m?.series ?? []).flatMap((r) => Object.values(r.values)));
  const clubIn = (season: string) => {
    const y = Number(season.slice(1));
    return journey.find((j) => j.from <= y && y <= j.to)?.team ?? journey[journey.length - 1]?.team;
  };
  // the first season his card was worth more than the other player's
  const passed = other && subject ? m?.series.find((r, i) => i > 0 && (r.values[subject] ?? 0) > (r.values[other] ?? Infinity) && (m.series[i - 1].values[subject] ?? 0) <= (m.series[i - 1].values[other] ?? 0))?.season : undefined;
  return (
    <section className="trib-card trib-market" aria-labelledby={`${c.id}-h`}>
      <p className="trib-kicker trib-kicker--gold">What the market thought · card value by season</p>
      <h2 id={`${c.id}-h`} className="trib-h3">
        {c.headline}
      </h2>
      {m && subject && (
        <figure className="trib-chart">
          <figcaption className="sr-only">
            {names[subject]}'s card value at the end of each season{other ? `, with ${names[other]}'s for comparison` : ''}.
          </figcaption>
          <ol className="trib-chart__rows">
            {m.series.map((r, i) => {
              const v = r.values[subject];
              const o = other ? r.values[other] : undefined;
              return (
                <li key={r.season} className={cn('trib-chart__row', r.season === passed && 'is-passed')} style={{ ...clubVars(clubIn(r.season)), '--i': i } as CSSProperties}>
                  <span className="trib-chart__season">{r.season}</span>
                  <span className="trib-chart__track" aria-hidden="true">
                    <span className="trib-chart__bar" style={{ width: `${Math.max(1.5, ((v ?? 0) / max) * 100)}%` }} />
                    {o != null && <span className="trib-chart__tick" style={{ left: `${(o / max) * 100}%` }} />}
                  </span>
                  <span className="trib-chart__value">
                    {fmt(v)}
                    <span className="sr-only">{o != null ? `, ${names[other!]} ${fmt(o)}` : ''}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="trib-chart__key" aria-hidden="true">
            <span className="trib-chart__swatch" style={{ background: `linear-gradient(90deg, ${[...journey, ...journey].slice(0, Math.max(2, journey.length)).map((j) => `hsl(${getTeamColors(j.team)?.primary ?? '43 90% 60%'})`).join(', ')})` }} /> {names[subject]}, in the colours of his club that season
            {other && (
              <>
                <span className="trib-chart__tickkey" /> {names[other]}
              </>
            )}
          </p>
          {passed && other && (
            <p className="trib-chart__note">
              {passed}: his card passed {names[other].split(' ').slice(-1)[0]}'s for the first time.
            </p>
          )}
        </figure>
      )}
      <Body body={c.body} />
      <Sources stats={c.stats} />
    </section>
  );
};

const RivalCard = ({ c, subjectName, subjectTeam, rivalTeam }: { c: TributeChapter; subjectName: string; subjectTeam: string; rivalTeam: string }) => {
  const r = c.rival;
  const last = (n: string) => n.split(' ').slice(-1)[0];
  return (
    <section className="trib-card trib-rival" aria-labelledby={`${c.id}-h`}>
      <p className="trib-kicker trib-kicker--gold">The rival{r ? ` · ${r.name}` : ''}</p>
      <h2 id={`${c.id}-h`} className="trib-h3">
        {c.headline}
      </h2>
      {r && (
        <table className="trib-vs">
          <caption className="sr-only">
            {subjectName} and {r.name}, career against career
          </caption>
          <thead>
            <tr>
              <th scope="col" style={clubVars(subjectTeam)}>
                {last(subjectName)}
              </th>
              <th scope="col">
                <span className="sr-only">Figure</span>
                <span aria-hidden="true">VS</span>
              </th>
              <th scope="col" style={clubVars(rivalTeam)}>
                {last(r.name)}
              </th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.label}>
                <td className={cn(row.a > row.b && 'is-lead')}>{fmt(row.a, row.decimals)}</td>
                <th scope="row">{row.label}</th>
                <td className={cn(row.b > row.a && 'is-lead')}>{fmt(row.b, row.decimals)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Body body={c.body} className="trib-body--small" />
      <Sources stats={c.stats} />
    </section>
  );
};

const NumbersCard = ({ c, team }: { c: TributeChapter; team: string }) => (
  <section className="trib-numbers" style={clubVars(team)} aria-labelledby={`${c.id}-h`}>
    <h2 id={`${c.id}-h`} className="trib-kicker trib-kicker--gold">
      {c.headline}
    </h2>
    <dl className="trib-tiles">
      {c.stats.map((s, i) => (
        <div key={`${s.label}-${i}`} className={cn('trib-tile', i < 2 && 'trib-tile--gold')} title={`Source: ${s.source}`}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
    <Body body={c.body} className="trib-body--small" />
    <Sources stats={c.stats} />
  </section>
);

const LastLap = ({ c }: { c: TributeChapter }) => (
  <section className="trib-lastlap" aria-labelledby={`${c.id}-h`}>
    <p className="trib-kicker trib-kicker--gold">The last lap</p>
    <h2 id={`${c.id}-h`} className="trib-h3">
      {c.headline}
    </h2>
    <Body body={c.body} />
    <Sources stats={c.stats} />
  </section>
);

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

const Hero = ({ entry, tribute, player, team, sprites }: { entry: TributeIndexEntry; tribute: Tribute | null; player?: Player; team: string; sprites: boolean }) => {
  const nick = tribute?.nickname ?? entry.nickname;
  const h = tribute?.hero;
  const pos = tribute?.pos ?? entry.key.split(':')[0];
  const meta = [POSITION_NAMES[pos as keyof typeof POSITION_NAMES] ?? pos, h ? `${h.clubs} ${h.clubs === 1 ? 'club' : 'clubs'}` : null, h ? `${fmt(h.games)} games` : null, h ? `${h.rings} ${h.rings === 1 ? 'ring' : 'rings'}` : null, h ? (h.active ? 'still active' : h.hallOfFame ? `Hall of Fame, ${h.hallOfFame}` : 'retired') : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <header className="trib-hero" style={clubVars(team)}>
      {nick && (
        <span className="trib-hero__watermark" aria-hidden="true">
          {nick}
        </span>
      )}
      <div className="trib-hero__top">
        <p className="trib-kicker trib-kicker--gold">
          <BookOpen className="h-3 w-3" aria-hidden="true" /> Player tribute
        </p>
        <p className="trib-hero__meta">{meta}</p>
      </div>
      <div className="trib-hero__stage" aria-hidden="true">
        <span className="trib-hero__light" />
        <span className="trib-hero__shadow" />
        <Figure player={player} team={team} size="l" action="celebrate" sprites={sprites} />
      </div>
      <div className="trib-hero__text">
        {nick && <p className="trib-hero__nick">&ldquo;{nick}&rdquo;</p>}
        <DialogTitle className="trib-hero__name">{entry.name}</DialogTitle>
        <DialogDescription className="trib-hero__deck">{tribute?.deck ?? entry.deck}</DialogDescription>
      </div>
    </header>
  );
};

const Journey = ({ journey, player, sprites }: { journey: Tribute['journey']; player?: Player; sprites: boolean }) => (
  <ol className="trib-journey" aria-label="His clubs" style={{ '--n': journey.length } as CSSProperties}>
    {journey.map((j, i) => (
      <li key={`${j.team}-${j.from}-${i}`} className="trib-journey__club" style={clubVars(j.team)}>
        <Figure player={player} team={j.team} size="m" sprites={sprites} />
        <span className="trib-journey__name">{j.team}</span>
        <span className="trib-journey__years">
          {yrs(j.from, j.to)}
          {j.rings.length ? ` · ${j.rings.length} ${j.rings.length === 1 ? 'ring' : 'rings'}` : ''}
        </span>
      </li>
    ))}
  </ol>
);

const TributeView = ({ playerKey, open, onClose }: { playerKey: string; open: boolean; onClose: () => void }) => {
  const { content } = useLeagueContent();
  const { getAllPlayers } = useLeague();
  const entry = tributeEntryOf(content, playerKey);
  const { tribute, loading } = useTribute(entry);
  const sprites = !!useGameSprites();
  const players = useMemo(() => getAllPlayers(), [getAllPlayers]);
  const byKey = useMemo(() => new Map(players.map((p) => [`${p.position}:${p.name}`, p])), [players]);
  const player = byKey.get(playerKey);
  const journey = tribute?.journey ?? [];
  const team = (player && bannerTeamOf(player)) || journey[journey.length - 1]?.team || '';
  const names = useMemo(() => Object.fromEntries(players.map((p) => [`${p.position}:${p.name}`, p.name])), [players]);

  // chapter numbers count club chapters only; a club's years show on its first chapter
  let n = 0;
  const seen = new Set<string>();
  const sections: ReactNode[] = (tribute?.chapters ?? []).map((c) => {
    switch (c.kind) {
      case 'chapter': {
        n += 1;
        const club = c.club ?? '';
        const stint = journey.filter((j) => j.team === club);
        const years = !seen.has(club) && stint.length ? stint.map((j) => yrs(j.from, j.to)).join(', ') : null;
        seen.add(club);
        return <Chapter key={c.id} c={c} n={n} years={years} />;
      }
      case 'trade':
        return <TradeCard key={c.id} c={c} subject={playerKey} />;
      case 'market':
        return <MarketCard key={c.id} c={c} journey={journey} names={names} />;
      case 'rival': {
        const rival = c.rival ? byKey.get(c.rival.player) : undefined;
        return <RivalCard key={c.id} c={c} subjectName={entry?.name ?? ''} subjectTeam={team} rivalTeam={rival ? bannerTeamOf(rival) : ''} />;
      }
      case 'numbers':
        return <NumbersCard key={c.id} c={c} team={team} />;
      case 'lastlap':
        return <LastLap key={c.id} c={c} />;
      default:
        return null;
    }
  });

  return (
    <Dialog open={open && !!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        phoneSheet
        className={cn(
          'trib w-screen max-w-none h-[var(--safe-h,100dvh)] max-h-none rounded-none border-0 overflow-y-auto overflow-x-hidden gap-0 p-0',
          'sm:w-[min(820px,calc(100vw-2rem))] sm:h-[calc(var(--safe-h,100dvh)-2rem)] sm:rounded-2xl sm:border',
        )}
      >
        {entry && (
          <article className="trib__inner">
            <Hero entry={entry} tribute={tribute} player={player} team={team} sprites={sprites} />
            {journey.length > 0 && <Journey journey={journey} player={player} sprites={sprites} />}
            {loading ? (
              <p className="trib-loading rv-fallback" role="status">
                <span className="trib-loading__dot" aria-hidden="true" /> Loading the tribute…
              </p>
            ) : !tribute ? (
              <p className="trib-loading" role="status">
                The tribute could not be loaded. Try again in a moment.
              </p>
            ) : (
              <div className="trib-sections">{sections}</div>
            )}
            {tribute && <p className="trib-foot">Every figure is checked against the league data when the tribute is published. Open a section's sources to see where each one comes from.</p>}
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TributeView;
