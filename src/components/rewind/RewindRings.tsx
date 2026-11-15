import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { History } from "lucide-react";
import type { Player } from "@/types/player";
import type { SeasonRewindIndexEntry } from "@/utils/leagueContent";
import {
  OPEN_REWIND_EVENT,
  takePendingRewind,
  useRewindSeen,
  type RewindLink,
} from "@/utils/seasonRewind";
import { reducedMotion } from "@/utils/motion";
import { openSeasonStory } from "@/components/news/SeasonStory";
import { openHotTake } from "@/components/news/HotTakes";
import { openTribute } from "@/components/tribute/openTribute";
import TeamLogo from "@/components/brand/TeamLogo";
import PixelLoader from "@/components/ui/PixelLoader";
import { clubStyle } from "./rewindStyle";
import "./rewind.css";

const RewindViewer = lazy(() => import("./RewindViewer"));

/**
 * The Season Rewind rings at the top of the Timeline's news area: one circular avatar per season (the champion's logo
 * in that club's colours), newest first, ringed gold until this viewer has watched that season at its current card
 * count (localStorage, a per-viewer convenience). A tap opens the viewer (RewindViewer.tsx, loaded on first use).
 * openSeasonRewind(season) opens one from anywhere (the Arcade ticker).
 */
interface Props {
  /** content.json's seasonRewindIndex (oldest first) */
  index: SeasonRewindIndexEntry[];
  players: Player[];
}

const RewindRings = ({ index, players }: Props) => {
  const seasons = useMemo(() => [...index].reverse(), [index]);
  const seen = useRewindSeen();
  const [open, setOpen] = useState<string | null>(null);
  // once opened the viewer stays mounted, so closing plays its exit (and lets go of its history entry) in place
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const openSeason = useCallback(
    (s: string) => {
      if (index.some((e) => e.season === s)) setOpen(s);
    },
    [index],
  );
  useEffect(() => {
    const p = takePendingRewind();
    if (p) openSeason(p);
    const on = (e: Event) => {
      takePendingRewind();
      openSeason(String((e as CustomEvent).detail));
    };
    window.addEventListener(OPEN_REWIND_EVENT, on);
    return () => window.removeEventListener(OPEN_REWIND_EVENT, on);
  }, [openSeason]);

  const onLink = useCallback((l: RewindLink) => {
    const go = (id: string) =>
      window.setTimeout(
        () =>
          document
            .getElementById(id)
            ?.scrollIntoView({
              block: "start",
              behavior: reducedMotion() ? "auto" : "smooth",
            }),
        120,
      );
    if (l.story) {
      openSeasonStory(l.story);
      go("season-story");
    } else if (l.take) {
      openHotTake(l.take);
    } else if (l.tribute) {
      openTribute(l.tribute);
    }
  }, []);

  if (!seasons.length) return null;
  return (
    <section className="rw-rings" aria-labelledby="rw-rings-title">
      <h2 id="rw-rings-title" className="rw-rings__title">
        <History className="h-4 w-4" aria-hidden="true" /> Season Rewind
        <span className="rw-rings__hint">Tap a season</span>
      </h2>
      <ul className="rw-rings__list" data-no-swipe-x>
        {seasons.map((s, i) => {
          const fresh = !seen(s);
          const team = s.champion ?? s.club;
          return (
            <li
              key={s.season}
              className="stagger-in"
              style={{ "--i": Math.min(i, 8) } as CSSProperties}
            >
              <button
                type="button"
                className="rw-ring"
                data-fresh={fresh || undefined}
                style={clubStyle(team)}
                onClick={() => setOpen(s.season)}
                aria-label={`${s.season} Rewind: ${s.champion ? `${s.champion} won the Super Bowl` : ""}, ${s.count} cards${fresh ? ", new" : ""}`}
              >
                <span className="rw-ring__halo" aria-hidden="true">
                  <span className="rw-ring__face">
                    <TeamLogo team={team} size={34} decorative />
                  </span>
                </span>
                <span className="rw-ring__y">{s.season}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {(open || mounted) && (
        <Suspense
          fallback={
            <PixelLoader
              variant="overlay"
              label="Rewind"
              what="the Season Rewind"
            />
          }
        >
          <RewindViewer
            seasons={seasons}
            season={open}
            onSeason={setOpen}
            onClose={() => setOpen(null)}
            onLink={onLink}
            players={players}
          />
        </Suspense>
      )}
    </section>
  );
};

export default RewindRings;
