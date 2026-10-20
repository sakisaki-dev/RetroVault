import { startTransition, useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { CardInfo } from '../useCardPool';
import { PlayerPicker, PreviewPane } from './lab/LabParts';
import { CombosTab, FacesTab, HelmetsTab, PosesTab, UniformsTab } from './lab/LabTabs';
import { LabRootContext, select } from './lab/labStore';
import './art.css';

interface ArtLabProps {
  open: boolean;
  onClose: () => void;
  cards: CardInfo[];
  total: number;
}

interface TabProps {
  pick: CardInfo;
  league: CardInfo[];
  total: number;
}

const TABS: { key: string; label: string; hint: string; Tab: ComponentType<TabProps> }[] = [
  { key: 'combos', label: 'Combinations', hint: 'The five art variants pulled from packs × the four finishes, on one player. Switch the tier frame above.', Tab: CombosTab },
  { key: 'poses', label: 'Poses', hint: 'Every sprite pose by position, with its name and key (lock one with "pose" in sprites.json).', Tab: PosesTab },
  { key: 'helmets', label: 'Helmets', hint: 'All 32 helmets: front, three-quarter and side.', Tab: HelmetsTab },
  { key: 'uniforms', label: 'Uniforms', hint: "Each club's home uniform, then its alternates (a card rolls one about 8% of the time).", Tab: UniformsTab },
  { key: 'faces', label: 'Faces', hint: 'Locked looks from the game portraits, and the generic character in each skin tone.', Tab: FacesTab },
];

const DEFAULT_PLAYER = 'Sherman Brandson';
/** Programmatic focus without the keyboard focus ring (browsers that ignore focusVisible fall back to :focus-visible rules) */
const QUIET_FOCUS = { preventScroll: true, focusVisible: false } as FocusOptions;

/**
 * Art lab (read-only explorer): pick a league player, then browse his card as every variant × finish (with a tier
 * toggle), every pose, all 32 helmets, every uniform and every face. Click (or Enter on) any cell to see it large in
 * the preview pane with a zoom slider. Only the open tab renders, and cells mount as they scroll into view.
 */
const ArtLab = ({ open, onClose, cards, total }: ArtLabProps) => {
  const league = useMemo(() => cards.filter((c) => !c.player.isRealLegend).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || a.player.name.localeCompare(b.player.name)), [cards]);
  const [pickKey, setPickKey] = useState<string | null>(null);
  const pick = useMemo(() => league.find((c) => c.key === pickKey) ?? league.find((c) => c.player.name === DEFAULT_PLAYER) ?? league[0] ?? null, [league, pickKey]);
  const [tab, setTab] = useState(TABS[0].key);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const onPick = useCallback((c: CardInfo) => startTransition(() => setPickKey(c.key)), []);
  // A new player or tab clears the preview; so does closing
  useEffect(() => select(null), [pick, tab, open]);
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
        className="lab flex h-[94vh] max-h-[94vh] w-[96vw] max-w-[1240px] flex-col gap-0 overflow-hidden border-line bg-night p-0">
        <div className="lab__top">
          <div className="lab__titles">
            <DialogTitle className="font-display text-2xl uppercase italic">
              Art <span className="text-gold">lab</span>
            </DialogTitle>
            <DialogDescription className="lab__desc">Every variant, finish, pose, helmet, uniform and face. Preview only; nothing is added.</DialogDescription>
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
          <PreviewPane />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ArtLab;
