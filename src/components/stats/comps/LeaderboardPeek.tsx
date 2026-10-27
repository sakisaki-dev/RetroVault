import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from 'react';
import type { Player } from '@/types/player';
import type { GradeStep } from '@/config/skillGrades';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import TeamLogo from '@/components/brand/TeamLogo';
import { getTeamColors } from '@/utils/teamColors';
import { signatureTeamOf, usePlayerExtras, type IndexedExtras } from '@/utils/playerExtras';
import { fmtNum, ordinal } from '../analytics/viz';
import { GROUP_META, type RecordBoardData } from '../records';
import { GradeChip } from './ddParts';

/** Rows shown before the divider; the viewed player is appended below it when he sits further down. */
const TOP = 10;

export interface PeekRow {
  player: Player;
  /** Formatted value, right-aligned */
  display: string;
  /** Letter grade chip (skill boards) */
  grade?: GradeStep | null;
}

export interface PeekBoard {
  title: string;
  /** Pool / qualifier line, e.g. "Wide Receivers · min 50 rec · 29 qualifiers" */
  sub: string;
  /** Every qualifier, best first: the same sorted list the rank / grade came from */
  rows: PeekRow[];
}

const same = (a: Pick<Player, 'name' | 'position'>, b: Pick<Player, 'name' | 'position'>) => a.name === b.name && a.position === b.position;

/** A record-book board as a leaderboard (same order and values as its rank chips). */
export const recordPeek = (b: RecordBoardData): PeekBoard => ({
  title: b.title,
  sub: [b.mixed ? 'All positions' : GROUP_META[b.group].label, b.minLabel, `${b.entries.length} qualifiers`].filter(Boolean).join(' · '),
  rows: b.entries.map((e) => ({ player: e.player, display: fmtNum(e.value, b.decimals) })),
});

const useNarrow = () => {
  const q = '(max-width: 640px)';
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const fn = () => setOn(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return on;
};

const Row = ({ place, row, me, extras, onOpen }: { place: number | null; row: PeekRow; me: boolean; extras: IndexedExtras; onOpen: (p: Player) => void }) => {
  const team = signatureTeamOf(extras, row.player);
  const c = getTeamColors(team);
  return (
    <li>
      <button
        type="button"
        data-rbk-row=""
        data-me={me || undefined}
        aria-current={me || undefined}
        onClick={() => onOpen(row.player)}
        style={{ '--rb-1': c ? `hsl(${c.primary})` : 'hsl(var(--line))' } as CSSProperties}
        className="rbk-row flex w-full items-center gap-2 rounded-md py-1 pl-2.5 pr-2 text-left focus-visible:outline-none"
      >
        <span className={cn('w-8 shrink-0 font-pixel text-[9px] uppercase tabular-nums', place === 1 ? 'text-gold' : 'text-muted-foreground')} title={place == null ? 'Not in the qualifier pool' : undefined}>
          {place == null ? 'NQ' : ordinal(place)}
        </span>
        {team ? <TeamLogo team={team} size={22} decorative /> : <span className="h-[22px] w-[22px] shrink-0" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">{row.player.name}</span>
        <span className="shrink-0 rounded bg-panel-2 px-1 py-px font-pixel text-[8px] text-muted-foreground">{row.player.position}</span>
        <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-chalk">{row.display}</span>
        {row.grade !== undefined && <GradeChip grade={row.grade} size="sm" className="h-5 min-w-[1.6rem] text-xs" />}
      </button>
    </li>
  );
};

/** Arrow keys / Home / End move between rows (Enter opens the focused player, Esc closes via Radix). */
const onListKey = (e: KeyboardEvent<HTMLElement>) => {
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-rbk-row]')];
  const i = rows.indexOf(document.activeElement as HTMLElement);
  const next = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? (i < 0 ? rows.length - 1 : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : null;
  if (next == null || rows.length === 0) return;
  e.preventDefault();
  rows[Math.max(0, Math.min(rows.length - 1, next))].focus();
};

const Body = ({ board, player, self, onOpen, sheet }: { board: PeekBoard; player: Player; self?: PeekRow; onOpen: (p: Player) => void; sheet: boolean }) => {
  const extras = usePlayerExtras();
  const rank = board.rows.findIndex((r) => same(r.player, player));
  const extra = rank >= TOP ? board.rows[rank] : rank < 0 ? self : undefined;
  const Title = sheet ? SheetTitle : 'h4';
  const Desc = sheet ? SheetDescription : 'p';
  return (
    <div className="space-y-2">
      <div className={sheet ? 'min-h-[3.25rem] pr-12' : undefined}>
        <Title className="font-display text-sm font-bold uppercase tracking-wide text-foreground">{board.title}</Title>
        <Desc className="font-pixel text-[8px] uppercase leading-relaxed text-muted-foreground">{board.sub}</Desc>
      </div>
      <ul className="space-y-1" onKeyDown={onListKey} aria-label={`${board.title} leaders`}>
        {board.rows.slice(0, TOP).map((r, i) => (
          <Row key={`${r.player.position}:${r.player.name}`} place={i + 1} row={r} me={same(r.player, player)} extras={extras} onOpen={onOpen} />
        ))}
        {extra && (
          <>
            <li role="separator" className="mx-1 border-t border-dashed border-line/80 pt-0.5" />
            <Row place={rank >= 0 ? rank + 1 : null} row={extra} me extras={extras} onOpen={onOpen} />
          </>
        )}
      </ul>
    </div>
  );
};

interface Props {
  /** Built only while open (skill boards grade the whole position). */
  getBoard: () => PeekBoard | null;
  player: Player;
  /** His row when he isn't in the pool (shown below the divider as "NQ") */
  self?: () => PeekRow | undefined;
  onOpenPlayer: (p: Player) => void;
  children: ReactElement;
}

/**
 * A compact leaderboard behind a Deep Dive chip or tile: the top 10 as slim team-colour banners (card team colours,
 * logo, name, position, value, optional grade), the viewed player highlighted or appended below a divider. A popover
 * anchored to the trigger; on phones a small bottom sheet. Picking a row opens that player's Deep Dive.
 */
const LeaderboardPeek = ({ getBoard, player, self, onOpenPlayer, children }: Props) => {
  const narrow = useNarrow();
  const [open, setOpen] = useState(false);
  const leaving = useRef(false);
  // getBoard changes identity every render; the board only needs rebuilding when opened or the player changes.
  const getRef = useRef(getBoard);
  getRef.current = getBoard;
  const board = useMemo(() => (open ? getRef.current() : null), [open, player]); // eslint-disable-line react-hooks/exhaustive-deps
  const selfRow = useMemo(() => (open ? self?.() : undefined), [open, player]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the last board through the close animation, so the sheet doesn't collapse to nothing as it leaves
  const last = useRef<{ board: PeekBoard | null; self?: PeekRow }>({ board: null });
  if (board) last.current = { board, self: selfRow };
  const shown = board ? { board, self: selfRow } : last.current;

  const go = (p: Player) => {
    leaving.current = true;
    setOpen(false);
    onOpenPlayer(p);
  };
  // Start on the viewed player's row (arrow keys move from there).
  const focusMe = (e: Event) => {
    e.preventDefault();
    const root = e.currentTarget as HTMLElement | null;
    (root?.querySelector<HTMLElement>('[data-me]') ?? root?.querySelector<HTMLElement>('[data-rbk-row]') ?? root)?.focus({ preventScroll: true });
  };
  // After jumping to another player, don't pull focus (and the scroll) back to this trigger.
  const onCloseFocus = (e: Event) => {
    if (leaving.current) e.preventDefault();
    leaving.current = false;
  };
  const body = shown.board && <Body board={shown.board} player={player} self={shown.self} onOpen={go} sheet={narrow} />;

  if (narrow) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent side="bottom" className="rbk-sheet max-h-[75vh] overflow-y-auto rounded-t-2xl border-line bg-popover px-3 pb-4 pt-7" onOpenAutoFocus={focusMe} onCloseAutoFocus={onCloseFocus}>
          {body ?? <SheetTitle className="sr-only">Leaderboard</SheetTitle>}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="rbk-pop z-[70] max-h-[var(--radix-popover-content-available-height)] w-[23rem] max-w-[calc(100vw-1.5rem)] overflow-y-auto border-line bg-popover p-2.5 shadow-elevated"
        onOpenAutoFocus={focusMe}
        onCloseAutoFocus={onCloseFocus}
      >
        {body}
      </PopoverContent>
    </Popover>
  );
};

export default LeaderboardPeek;
