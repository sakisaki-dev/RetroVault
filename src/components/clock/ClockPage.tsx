import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { Hourglass, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { useHubRoute } from '../stats/hub/hashRoute';
import { useSaveState } from './saveData';
import { buildClock, farewellTour, prospectBoard } from './clockModel';
import FarewellTour from './FarewellTour';
import ProspectBoard, { type DraftInfo } from './ProspectBoard';
import { useLeagueContent, type LeagueContent } from '@/utils/leagueContent';
import type { SaveState } from './saveData';
import './clock.css';

/**
 * The Clock (Stats › Clock, #stats/clock/<view>): the league's ages from the owner's live save. Two views: the
 * Farewell Tour (last and next-to-last seasons) and the Prospect board (under-25s by room to grow). The league-wide
 * age curves live on Stats › Graphs (#stats/graphs/age-curves; old #stats/clock/curves links go there).
 * All computed (clockModel.ts); the view lives in the hash's section so each is linkable.
 */

const VIEWS = [
  { id: 'farewell', label: 'Farewell Tour', short: 'Farewell', Icon: Hourglass },
  { id: 'prospects', label: 'Prospects', short: 'Prospects', Icon: Sprout },
] as const;
type View = (typeof VIEWS)[number]['id'];

const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ''}`;
const pctOf = (w: number, l: number, t: number) => (w + l + t ? w / (w + l + t) : 0);

/**
 * What the next draft is built from (docs/SAVE_INVENTORY.md 7.4): the coach's last completed season (coach.json),
 * or, when he has moved clubs since (currentStint after that season), 0.05 × the new club's offense + defense from
 * the save. Plus this season so far from the save's standings.
 */
const draftInfo = (content: LeagueContent | null, state: SaveState): DraftInfo | null => {
  const coach = content?.coach;
  const last = coach?.seasons.at(-1);
  if (!last) return null;
  const club = state.clubs[state.club];
  const now = club ? { record: rec(club.w, club.l, club.t), pct: pctOf(club.w, club.l, club.t), season: `Y${state.season}` } : undefined;
  const stint = coach?.currentStint;
  if (stint && stint.from > last.year) {
    const nc = state.clubs[stint.team];
    if (!nc) return null;
    return { record: `${nc.off}+${nc.def} O+D`, season: `Y${stint.from}`, pct: Math.min(1, 0.05 * (nc.off + nc.def)), clubChange: `After the move to the ${stint.team}`, now };
  }
  return { record: rec(last.w, last.l, last.t), season: `Y${last.year}`, pct: pctOf(last.w, last.l, last.t), now: last.year < state.season ? now : undefined };
};

const ClockPage = ({ players, onSelect }: { players: Player[]; onSelect: (p: Player) => void }) => {
  const state = useSaveState();
  const { route, navigate } = useHubRoute();
  const view: View = (VIEWS.find((v) => v.id === route.section)?.id ?? 'farewell') as View;
  const all = useMemo(() => (state ? buildClock(state, players) : []), [state, players]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { content } = useLeagueContent();
  const draft = useMemo(() => (state ? draftInfo(content, state) : null), [content, state]);

  // The age curves moved to Stats › Graphs
  useEffect(() => {
    if (route.section === 'curves') navigate({ tab: 'career', sub: 'graphs', section: 'age-curves' }, { replace: true });
  }, [route.section, navigate]);

  const go = (v: View) => navigate({ tab: 'career', sub: 'clock', section: v === 'farewell' ? undefined : v }, { replace: true });
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = VIEWS.length;
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    go(VIEWS[j].id);
    tabs.current[j]?.focus();
  };

  if (state === undefined) {
    return (
      <div role="status" aria-label="Loading the clock" className="rv-fallback container flex min-h-[50vh] items-start justify-center pt-16">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </div>
    );
  }
  if (!state) {
    return (
      <div className="container py-12">
        <p className="clk-empty">No save has been imported yet: the clock starts once the game&apos;s save is read.</p>
      </div>
    );
  }

  const tour = farewellTour(all);
  const finals = tour.filter((c) => c.left === 0).length;
  const ones = tour.filter((c) => c.left === 1).length;
  const prospects = prospectBoard(all).length;

  return (
    <div className="clk container py-3 sm:py-4">
      <header className="clk-band">
        <div className="clk-band__id">
          <h1 className="clk-band__title">
            The <span className="text-gold">Clock</span>
          </h1>
          <p className="clk-band__intro">Who walks off and who still grows · Y{state.season} week {state.week} save</p>
        </div>
        <dl className="clk-band__nums">
          <div>
            <dt>FINAL</dt>
            <dd>{finals}</dd>
          </div>
          <div>
            <dt>ONE MORE</dt>
            <dd>{ones}</dd>
          </div>
          <div>
            <dt>UNDER 25</dt>
            <dd>{prospects}</dd>
          </div>
        </dl>
        <div role="tablist" aria-label="Clock views" className="clk-tabs clk-band__tabs">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              ref={(el) => (tabs.current[i] = el)}
              type="button"
              role="tab"
              id={`clk-tab-${v.id}`}
              aria-selected={view === v.id}
              aria-controls={`clk-panel-${v.id}`}
              tabIndex={view === v.id ? 0 : -1}
              onClick={() => go(v.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn('clk-tab', view === v.id && 'is-on')}
            >
              <v.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">{v.short}</span>
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>

      </header>

      <div key={view} role="tabpanel" id={`clk-panel-${view}`} aria-labelledby={`clk-tab-${view}`} className="rv-view-in mt-3">
        {view === 'farewell' && <FarewellTour all={all} season={state.season} week={state.week} onSelect={onSelect} />}
        {view === 'prospects' && <ProspectBoard all={all} onSelect={onSelect} draft={draft} />}
      </div>
    </div>
  );
};

export default ClockPage;
