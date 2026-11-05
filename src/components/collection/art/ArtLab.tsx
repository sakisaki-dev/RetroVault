import { startTransition, useCallback, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { CardInfo } from '../useCardPool';
import { LabRootContext, PlayerPicker } from './lab/LabParts';
import { LAB_TABS as TABS } from './lab/LabTabs';
import './art.css';

interface ArtLabProps {
  open: boolean;
  onClose: () => void;
  cards: CardInfo[];
  total: number;
}

const DEFAULT_PLAYER = 'Sherman Brandson';
/** Programmatic focus without the keyboard focus ring (browsers that ignore focusVisible fall back to :focus-visible rules) */
const QUIET_FOCUS = { preventScroll: true, focusVisible: false } as FocusOptions;

/**
 * Art lab (preview only): pick a league player, then watch the parts of a card opening. Pack opening plays a sample
 * pack of any type through the real pack dialog in preview mode; Walkout plays his walkout at a chosen tier, finish
 * and art; Card designs shows his card in the four arts at one finish and his club's uniforms. Nothing is written to
 * the collection: samples come from rollPack (pure) or the Card designs sample pack. Only the open tab mounts (the
 * registry is LAB_TABS in lab/LabTabs.tsx), and cards mount as they scroll into view.
 */
const ArtLab = ({ open, onClose, cards, total }: ArtLabProps) => {
  const league = useMemo(() => cards.filter((c) => !c.player.isRealLegend).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || a.player.name.localeCompare(b.player.name)), [cards]);
  const [pickKey, setPickKey] = useState<string | null>(null);
  const pick = useMemo(() => league.find((c) => c.key === pickKey) ?? league.find((c) => c.player.name === DEFAULT_PLAYER) ?? league[0] ?? null, [league, pickKey]);
  const [tab, setTab] = useState(TABS[0].key);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const onPick = useCallback((c: CardInfo) => startTransition(() => setPickKey(c.key)), []);
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const { Tab } = active;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        // Focus the active tab, not the search box (no phone keyboard popping up on open)
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          // No focus ring for this programmatic focus: the ring is for keyboard users moving between tabs
          window.setTimeout(() => document.getElementById(`lab-tab-${tab}`)?.focus(QUIET_FOCUS), 0);
        }}
        className="lab flex h-[calc(var(--safe-h)-1rem)] max-h-[calc(var(--safe-h)-1rem)] w-[calc(100vw-1rem)] max-w-[1240px] flex-col gap-0 overflow-hidden border-line bg-night p-0">
        <div className="lab__top">
          <div className="lab__titles">
            <DialogTitle className="font-display text-2xl uppercase italic">
              Art <span className="text-gold">lab</span>
            </DialogTitle>
            <DialogDescription className="lab__desc">Packs, walkouts and card art, played on samples. Preview only; nothing is added.</DialogDescription>
          </div>
          <PlayerPicker players={league} value={pick} onPick={onPick} />
        </div>
        <div className="lab__tabs" role="tablist" aria-label="Art lab sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`lab-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="lab-panel"
              tabIndex={tab === t.key ? 0 : -1}
              className={cn('lab__tab', tab === t.key && 'is-on')}
              onClick={(e) => {
                // A tap doesn't move focus on iOS, so the previously focused tab would keep its ring: move it here
                e.currentTarget.focus(QUIET_FOCUS);
                startTransition(() => setTab(t.key));
              }}
              onKeyDown={(e) => {
                const i = TABS.findIndex((x) => x.key === tab);
                const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                const next = TABS[(i + d + TABS.length) % TABS.length].key;
                startTransition(() => setTab(next));
                document.getElementById(`lab-tab-${next}`)?.focus();
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="lab__body">
          <div ref={setRoot} className="lab__main" id="lab-panel" role="tabpanel" aria-labelledby={`lab-tab-${tab}`}>
            {pick && (
              <p className="lab__hint">
                <b>{pick.player.name}</b> · {pick.player.position} · {pick.franchise} · {active.hint}
              </p>
            )}
            {!pick ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading cards…</p>
            ) : (
              <LabRootContext.Provider value={root}>{root && <Tab key={`${tab}|${pick.key}`} pick={pick} league={league} total={total} />}</LabRootContext.Provider>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ArtLab;
