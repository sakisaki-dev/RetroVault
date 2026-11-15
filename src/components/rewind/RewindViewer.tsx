import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/player";
import type { SeasonRewindIndexEntry } from "@/utils/leagueContent";
import {
  markRewindSeen,
  useSeasonRewind,
  type RewindLink,
} from "@/utils/seasonRewind";
import { reducedMotion } from "@/utils/motion";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import PixelLoader from "@/components/ui/PixelLoader";
import PlayerDetailCard from "@/components/PlayerDetailCard";
import TeamLogo from "@/components/brand/TeamLogo";
import { RewindCardView } from "./RewindCards";
import { clubStyle } from "./rewindStyle";
import "./rewind.css";

/**
 * The Season Rewind viewer: a full-screen story on a phone (a centred 9:16 frame on a desktop) with progress segments
 * at the top. Each card runs CARD_MS and moves on by itself (the segment's fill is a CSS transform; its animationend
 * advances, so holding pauses it exactly). Tap the right two thirds for next, the left third for previous, hold to
 * pause, swipe left or right between seasons (ring order, newest first), swipe down to close (useSwipeToDismiss via
 * DialogContent), the arrow keys on a desktop (Shift + arrows change season, Space pauses). It is a Radix dialog, so
 * the overlay history (utils/overlayHistory.ts) takes it: the edge swipe and Back close it. Reduced motion: nothing
 * moves on its own (the reader taps through) and cards crossfade.
 */

export const CARD_MS = 6000;
const TAP_MS = 260;
const SLOP = 12;
const SWIPE_X = 56;

interface Props {
  /** The seasons in ring order (newest first) */
  seasons: SeasonRewindIndexEntry[];
  season: string | null;
  onSeason: (season: string) => void;
  onClose: () => void;
  /** A link out of the rewind (the story, a take, a tribute): the viewer has closed by the time it runs */
  onLink: (link: RewindLink) => void;
  players: Player[];
}

const RewindViewer = ({
  seasons,
  season,
  onSeason,
  onClose,
  onLink,
  players,
}: Props) => {
  const at = seasons.findIndex((s) => s.season === season);
  const live = at >= 0 ? seasons[at] : null;
  // while it closes, the last season stays on screen under the exit
  const lastRef = useRef(live);
  if (live) lastRef.current = live;
  const entry = live ?? lastRef.current;
  const { rewind, loading } = useSeasonRewind(entry);
  const [idx, setIdx] = useState(0);
  const [held, setHeld] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [card, setCard] = useState<Player | null>(null);
  const [still] = useState(() => reducedMotion());
  const press = useRef<{
    x: number;
    y: number;
    t: number;
    id: number;
    interactive: boolean;
  } | null>(null);

  // a new season starts at its first card
  useEffect(() => {
    setIdx(0);
    if (live) markRewindSeen(live);
  }, [live]);

  const cards = rewind?.cards ?? [];
  const n = cards.length;
  const cur = cards[Math.min(idx, Math.max(0, n - 1))];
  const paused = held || userPaused || !!card || still || !live;

  const goSeason = useCallback(
    (d: 1 | -1) => {
      const next = seasons[at + d];
      if (next) onSeason(next.season);
      else if (d === 1) onClose();
    },
    [seasons, at, onSeason, onClose],
  );
  const next = useCallback(() => {
    if (idx < n - 1) setIdx(idx + 1);
    else onClose(); // the end of a season's rewind closes it
  }, [idx, n, onClose]);
  const prev = useCallback(() => {
    if (idx > 0) setIdx(idx - 1);
    else if (at > 0) onSeason(seasons[at - 1].season);
  }, [idx, at, seasons, onSeason]);

  const link = (l: RewindLink) => {
    if (l.season) {
      if (seasons.some((s) => s.season === l.season)) onSeason(l.season);
      return;
    }
    onClose();
    // let the dialog let go of its history entry before the next view opens
    window.setTimeout(() => onLink(l), 60);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (e.shiftKey) goSeason(1);
      else next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (e.shiftKey) goSeason(-1);
      else prev();
    } else if (e.key === " ") {
      e.preventDefault();
      setUserPaused((v) => !v);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || e.button > 0) return;
    const t = e.target as HTMLElement;
    press.current = {
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      id: e.pointerId,
      interactive: !!t.closest("button, a, [data-player-key]"),
    };
    setHeld(true);
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    setHeld(false);
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) > SWIPE_X && Math.abs(dx) > Math.abs(dy) * 1.3) {
      goSeason(dx < 0 ? 1 : -1);
      return;
    }
    if (
      p.interactive ||
      Math.hypot(dx, dy) > SLOP ||
      e.timeStamp - p.t > TAP_MS
    )
      return; // a hold, a drag or a control
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - box.left < box.width / 3) prev();
    else next();
  };
  const onCancel = () => {
    press.current = null;
    setHeld(false);
  };

  const title = entry ? `${entry.season} Rewind` : "Season Rewind";
  return (
    <Dialog open={!!live} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        hideClose
        data-peek-ok
        className="rw-dlg"
        overlayClassName="rw-overlay"
        onKeyDown={onKey}
        aria-describedby="rw-desc"
        style={clubStyle(cur?.club ?? entry?.club)}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription id="rw-desc" className="sr-only">
          Tap right for the next card, left for the previous one, hold to pause,
          swipe sideways for another season and down to close. On a keyboard:
          the arrow keys, Shift and an arrow for another season, Space to pause.
        </DialogDescription>
        <div
          className="rw-frame"
          data-paused={paused || undefined}
          data-still={still || undefined}
        >
          <header className="rw-top">
            <ol
              className="rw-segs"
              aria-label={n ? `Card ${idx + 1} of ${n}` : undefined}
            >
              {cards.map((c, i) => (
                <li
                  key={c.id}
                  className={cn("rw-seg", i < idx && "rw-seg--done")}
                >
                  {i === idx && (
                    <span
                      key={`${rewind?.season}-${idx}`}
                      className={cn(
                        "rw-seg__fill",
                        still && "rw-seg__fill--still",
                      )}
                      style={
                        {
                          "--rw-ms": `${CARD_MS}ms`,
                          animationPlayState: paused ? "paused" : "running",
                        } as CSSProperties
                      }
                      onAnimationEnd={next}
                    />
                  )}
                </li>
              ))}
            </ol>
            <div className="rw-bar">
              {entry && (
                <span className="rw-bar__who">
                  <span className="rw-bar__ring">
                    <TeamLogo
                      team={entry.champion ?? entry.club}
                      size={22}
                      decorative
                    />
                  </span>
                  <b>{entry.season}</b> Rewind
                  {cur && (
                    <span className="rw-bar__n">
                      {idx + 1}/{n}
                    </span>
                  )}
                </span>
              )}
              <button
                type="button"
                className="rw-icon"
                onClick={() => setUserPaused((v) => !v)}
                aria-label={userPaused ? "Play" : "Pause"}
                hidden={still}
              >
                {userPaused ? (
                  <Play className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <DialogClose className="rw-icon" aria-label="Close">
                <X className="h-5 w-5" aria-hidden="true" />
              </DialogClose>
            </div>
          </header>

          <div
            className="rw-stagebox"
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
            onContextMenu={(e) => e.preventDefault()}
          >
            {cur ? (
              <div
                key={`${rewind?.season}-${cur.id}`}
                className="rw-slide"
                aria-live="polite"
              >
                <RewindCardView
                  card={cur}
                  season={rewind!.season}
                  players={players}
                  onPlayer={setCard}
                  onLink={link}
                />
              </div>
            ) : loading ? (
              <PixelLoader
                label="Rewind"
                what={`the ${entry?.season} Rewind`}
                minHeight="100%"
              />
            ) : (
              <p className="rw-fail" role="status">
                The {entry?.season} Rewind could not be loaded. Try again in a
                moment.
              </p>
            )}
          </div>

          <button
            type="button"
            className="rw-nav rw-nav--prev"
            onClick={prev}
            aria-label="Previous card"
            disabled={idx === 0 && at <= 0}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rw-nav rw-nav--next"
            onClick={next}
            aria-label="Next card"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
          {held && !still && (
            <span className="rw-held" aria-hidden="true">
              <Pause className="h-5 w-5" />
            </span>
          )}
        </div>
      </DialogContent>
      <PlayerDetailCard player={card} onClose={() => setCard(null)} />
    </Dialog>
  );
};

export default RewindViewer;
