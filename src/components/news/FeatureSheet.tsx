import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { matchPlayerByName, type StoryStat } from '@/utils/leagueContent';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import TeamLogo from '@/components/brand/TeamLogo';
import { ClubChips } from './ClubChips';
import { HeroLogos, PlayerBanners, teamVars } from './clubArt';
import './feature.css';

/**
 * The reading sheet for every Season Story article and every Hot Take, laid out like a magazine feature:
 *
 * - a tall cinematic header in the main club's colours: the huge lit logo (or two clubs facing off), the first figure
 *   as a hero number, a slow stadium-light sweep (still under reduced motion and lite mode), and the kicker, headline,
 *   dek and byline;
 * - a magazine body: a wide lead paragraph with a drop cap, the next figures as big pull figures between paragraphs
 *   (repeats of the box score, hidden from screen readers);
 * - a side rail (sticky beside the text from 1024px, inline on a phone): the players as banners, the box score with a
 *   source on every figure, the clubs with their logos;
 * - previous / next at the bottom, also on the Left and Right arrow keys (each change is announced).
 *
 * Phone: a full-screen sheet in one column. Desktop: nearly the whole viewport, up to 1200px wide.
 */

export interface SheetHero {
  teams: string[];
  mode: 'one' | 'vs' | 'trade';
}

export interface SheetPiece {
  /** Stable id (changes scroll the sheet back to the top) */
  id: string;
  kicker: ReactNode;
  headline: string;
  dek: string;
  byline: ReactNode;
  body: string[];
  /** Body lines as a numbered list (quick hits) */
  list?: boolean;
  stats: StoryStat[];
  players: string[];
  teams: string[];
  hero: SheetHero;
  /** Cards above the body (Continued from) and below it (Read next) */
  before?: ReactNode;
  after?: ReactNode;
  sourcesNote: string;
  /** "Story 3 of 9" / "Take 2 of 11", for the announcement */
  position?: string;
  className?: string;
}

export interface SheetLink {
  headline: string;
  label: string;
  onGo: () => void;
}

interface Props {
  piece: SheetPiece | null;
  onClose: () => void;
  prev?: SheetLink | null;
  next?: SheetLink | null;
  players: Player[];
  onPlayer: (p: Player) => void;
}

/** The figures that become pull figures, and the paragraph each follows */
const pulls = (body: string[], stats: StoryStat[]) => {
  const out = new Map<number, StoryStat>();
  if (body.length >= 3 && stats[1]) out.set(1, stats[1]);
  if (body.length >= 5 && stats[2]) out.set(3, stats[2]);
  return out;
};

export const FeatureSheet = ({ piece, onClose, prev, next, players, onPlayer }: Props) => {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [piece?.id]);

  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, summary, [role="slider"]')) return;
    if (e.key === 'ArrowLeft' && prev) {
      e.preventDefault();
      prev.onGo();
    } else if (e.key === 'ArrowRight' && next) {
      e.preventDefault();
      next.onGo();
    }
  };

  const p = piece;
  const bannered = (p?.players ?? []).filter((n) => matchPlayerByName(n, players)).slice(0, 4);
  const rest = (p?.players ?? []).filter((n) => !bannered.includes(n));
  const lead = p?.stats[0];
  const pullAt = p && !p.list ? pulls(p.body, p.stats) : new Map<number, StoryStat>();
  const main = p?.hero.teams[0];

  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        ref={scroller}
        onKeyDown={onKey}
        // open at the top with the sheet itself focused (not the first banner, which would scroll a phone down);
        // Tab still starts at the first control and the arrow keys work at once
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          scroller.current?.focus({ preventScroll: true });
        }}
        className={cn(
          'fs ss-reader w-screen max-w-none h-[var(--safe-h,100dvh)] max-h-none rounded-none border-0 overflow-y-auto overflow-x-hidden gap-0 p-0',
          'sm:w-[min(1200px,calc(100vw-2rem))] sm:h-[calc(var(--safe-h,100dvh)-2rem)] sm:rounded-2xl sm:border',
          p?.className,
        )}
        style={teamVars(main)}
      >
        {p && (
          <article className="fs__inner">
            <header className={cn('fs-head', p.hero.mode !== 'one' && 'fs-head--pair')}>
              <span className="fs-head__sweep" aria-hidden="true" />
              <div className="fs-head__art">
                <HeroLogos teams={p.hero.teams} mode={p.hero.mode} />
                {lead && (
                  <p className="fs-head__fig" title={lead.source ? `Source: ${lead.source}` : undefined}>
                    <b>{lead.value}</b>
                    <span>{lead.label}</span>
                  </p>
                )}
              </div>
              <span className="fs-head__fade" aria-hidden="true" />
              <div className="fs-head__text">
                <div className="fs-head__kicker">{p.kicker}</div>
                <DialogTitle className="fs-head__title">{p.headline}</DialogTitle>
                <DialogDescription className="fs-head__dek">{p.dek}</DialogDescription>
                <p className="fs-head__byline">{p.byline}</p>
              </div>
            </header>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {p.position ? `${p.position}: ${p.headline}` : ''}
            </p>

            <div className="fs-grid">
              <div className="fs-main">
                {p.before}
                <div className={cn('fs-body', p.list && 'fs-body--list')}>
                  {p.list ? (
                    <ol className="fs-hits">
                      {p.body.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ol>
                  ) : (
                    p.body.map((para, i) => (
                      <div key={i} className="contents">
                        <p className={cn(i === 0 && 'fs-lede')}>{para}</p>
                        {pullAt.has(i) && (
                          <aside className="fs-pull" aria-hidden="true">
                            <b>{pullAt.get(i)!.value}</b>
                            <span>{pullAt.get(i)!.label}</span>
                          </aside>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {p.after}
              </div>

              <aside className="fs-rail" aria-label="Players, figures and clubs">
                <div className="fs-rail__inner">
                  {bannered.length > 0 && (
                    <section className="fs-rail__block" aria-labelledby="fs-players">
                      <h3 id="fs-players" className="fs-rail__h">
                        Players
                      </h3>
                      <PlayerBanners names={bannered} players={players} onPlayer={onPlayer} max={4} className="fs-banners" label="Players in this piece" />
                      {rest.length > 0 && <ClubChips names={rest} players={players} onPlayer={onPlayer} label="More players" />}
                    </section>
                  )}
                  {bannered.length === 0 && rest.length > 0 && (
                    <section className="fs-rail__block" aria-labelledby="fs-players">
                      <h3 id="fs-players" className="fs-rail__h">
                        Players
                      </h3>
                      <ClubChips names={rest} players={players} onPlayer={onPlayer} label="Players in this piece" />
                    </section>
                  )}
                  {!p.list && p.stats.length > 0 && (
                    <section className="nz-box" aria-labelledby="fs-box">
                      <h3 id="fs-box" className="nz-box__h">
                        Box score
                      </h3>
                      <dl className="nz-box__grid fs-box" data-n={Math.min(p.stats.length, 6)}>
                        {p.stats.slice(0, 6).map((s) => (
                          <div key={s.label} className="nz-box__cell" title={s.source ? `Source: ${s.source}` : undefined}>
                            <dd className="nz-box__value">{s.value}</dd>
                            <dt className="nz-box__label">{s.label}</dt>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}
                  {p.teams.length > 0 && (
                    <section className="fs-rail__block" aria-labelledby="fs-clubs">
                      <h3 id="fs-clubs" className="fs-rail__h">
                        Clubs
                      </h3>
                      <ul className="fs-clubs">
                        {p.teams.map((t) => (
                          <li key={t} className="fs-club" style={teamVars(t)}>
                            <TeamLogo team={t} size={22} decorative backed />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {p.stats.length > 0 && (
                    <details className="ss-sources">
                      <summary>Figures and sources ({p.stats.length})</summary>
                      <ul>
                        {p.stats.map((s) => (
                          <li key={s.label}>
                            <b>{s.value}</b> {s.label}
                            <code>{s.source}</code>
                          </li>
                        ))}
                      </ul>
                      <p>{p.sourcesNote}</p>
                    </details>
                  )}
                </div>
              </aside>
            </div>

            {(prev || next) && (
              <nav className="fs-nav" aria-label="More pieces">
                {prev ? (
                  <button type="button" className="fs-nav__btn fs-nav__btn--prev" onClick={prev.onGo} aria-keyshortcuts="ArrowLeft">
                    <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="fs-nav__text">
                      <span className="fs-nav__label">{prev.label}</span>
                      <span className="fs-nav__title">{prev.headline}</span>
                    </span>
                  </button>
                ) : (
                  <span />
                )}
                {next ? (
                  <button type="button" className="fs-nav__btn fs-nav__btn--next" onClick={next.onGo} aria-keyshortcuts="ArrowRight">
                    <span className="fs-nav__text">
                      <span className="fs-nav__label">{next.label}</span>
                      <span className="fs-nav__title">{next.headline}</span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                  </button>
                ) : (
                  <span />
                )}
              </nav>
            )}
            <p className="fs-keys" aria-hidden="true">
              Tip: the Left and Right arrow keys move between pieces.
            </p>
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
};
