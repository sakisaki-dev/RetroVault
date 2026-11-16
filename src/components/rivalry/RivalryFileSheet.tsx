import { useCallback, useMemo, useRef, useState } from 'react';
import type { Player } from '@/types/player';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import { openSeasonStory } from '@/components/news/SeasonStory';
import { openHotTake } from '@/components/news/HotTakes';
import { useLeague } from '@/context/LeagueContext';
import { useLeagueContent } from '@/utils/leagueContent';
import { findNFLTeam } from '@/utils/nflTeams';
import { reducedMotion } from '@/utils/motion';
import { rivalryFilesOf, type RivalryPaper } from '@/utils/rivalryFiles';
import RivalryFileView from './RivalryFileView';

interface Props {
  id: string;
  open: boolean;
  onClose: () => void;
  /** Switch to the Timeline (where a story or take in "In the papers" opens) */
  onTimeline: () => void;
}

/**
 * A rivalry file as a phone sheet (full screen on a phone, a centred card from 640px). RivalryHost lazy-loads it. A
 * star opens his player card; a piece in "In the papers" closes the sheet and opens on the Timeline.
 */
const RivalryFileSheet = ({ id, open, onClose, onTimeline }: Props) => {
  const { content } = useLeagueContent();
  const { getAllPlayers, dataVersion } = useLeague();
  const [card, setCard] = useState<Player | null>(null);
  const file = useMemo(() => rivalryFilesOf(content).find((f) => f.id === id), [content, id]);
  const players = useMemo(() => {
    const m = new Map<string, Player>();
    getAllPlayers().forEach((p) => !p.isRealLegend && m.set(`${p.position}:${p.name}`, p));
    return m;
    // dataVersion: a new league load is a new player list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllPlayers, dataVersion]);
  const scroller = useRef<HTMLDivElement>(null);
  const coach = findNFLTeam(file?.coachTeam)?.name ?? file?.coachTeam;
  const rival = findNFLTeam(file?.team)?.name ?? file?.team;

  const onPaper = useCallback(
    (p: RivalryPaper) => {
      onClose();
      // let the sheet let go of its history entry before the Timeline opens the piece
      window.setTimeout(() => {
        if (p.type === 'story') openSeasonStory(p.id);
        else openHotTake(p.id);
        onTimeline();
        if (p.type === 'story')
          window.setTimeout(() => document.getElementById('season-story')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }), 400);
      }, 60);
    },
    [onClose, onTimeline],
  );

  return (
    <>
      <Dialog open={open && !!file} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          ref={scroller}
          phoneSheet
          swipeRight
          data-peek-ok
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            scroller.current?.focus({ preventScroll: true });
          }}
          className="rf-sheet w-screen max-w-none h-[var(--safe-h,100dvh)] max-h-none overflow-y-auto overflow-x-hidden rounded-none border-0 gap-0 p-0 sm:h-auto sm:max-h-[calc(var(--safe-h,100dvh)-2rem)] sm:w-[min(560px,calc(100vw-2rem))] sm:rounded-2xl sm:border [&_.dlg-x]:border-white/20 [&_.dlg-x]:bg-black/55 [&_.dlg-x]:text-white"
        >
          {file && (
            <>
              <DialogTitle className="sr-only">
                Rivalry file: {coach} vs {rival}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {file.record.text} in {file.games} meetings, {file.first} to {file.last}. Every meeting, the story so far and the coverage.
              </DialogDescription>
              <RivalryFileView file={file} players={players} onPlayer={setCard} onPaper={onPaper} />
            </>
          )}
        </DialogContent>
      </Dialog>
      <PlayerDetailCard player={card} onClose={() => setCard(null)} />
    </>
  );
};

export default RivalryFileSheet;
