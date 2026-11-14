import { useMemo } from 'react';
import { Dices, Eraser, Plane, Shirt, Sparkles, Sun, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import TeamLogo from '@/components/brand/TeamLogo';
import type { Player } from '@/types/player';
import { NFL_TEAMS } from '@/utils/nflTeams';
import { SLOT_BY_ID, filledCount, lineupKeys, type LabContext, type Lineup, type Preset, type SlotId } from '@/utils/teamLab';
import type { Turf } from './fieldArt';
import { GradeChip } from './parts';
import { SLOT_NAMES } from './labSlots';

const ORDER: SlotId[] = ['qb', 'rb', 'wr1', 'wr2', 'te', 'ol', 'd1', 'd2', 'd3', 'd4'];
const Slot = ({ ctx, slot, lineup, onSlot }: { ctx: LabContext; slot: SlotId; lineup: Lineup; onSlot: (s: SlotId, k: string) => void }) => {
  const def = SLOT_BY_ID.get(slot)!;
  const value = lineup[slot];
  const profile = value ? ctx.profiles.get(value) : undefined;
  // Valid positions, minus players already used in another slot
  const players = useMemo<Player[]>(() => {
    const used = new Set(lineupKeys(lineup).filter((k) => k !== value));
    return def.positions.flatMap((pos) => ctx.byPos.get(pos) ?? []).filter((p) => !used.has(p.key)).map((p) => p.player);
  }, [ctx, def, lineup, value]);
  const label = def.side === 'defense' ? (profile ? profile.position : 'DEF') : def.label;
  return (
    <li id={`lab-slot-${slot}`} className="lab-row" data-side={def.side}>
      <span className="lab-row-pos" aria-hidden="true">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <PlayerSearchSelect
          players={players}
          value={value}
          onValueChange={(k) => onSlot(slot, k)}
          placeholder={`Pick ${def.side === 'defense' ? 'LB / DB / DL' : def.label}`}
          ariaLabel={SLOT_NAMES[slot]}
          showOvr
        />
      </div>
      <span className="lab-row-end">
        {profile?.isLegend && <span className="font-pixel text-[7px] uppercase text-sky">Legend</span>}
        {profile && <GradeChip grade={profile.grade} size="sm" label={`Skill grade ${profile.grade?.grade ?? 'none'}`} />}
        {value && (
          <button
            type="button"
            onClick={() => onSlot(slot, '')}
            className="rounded p-0.5 text-muted-foreground hover:text-chalk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label={`Clear ${SLOT_NAMES[slot]}`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </span>
    </li>
  );
};

/** The depth chart: every slot's picker as a club-colour strip (offense, then the four defenders). */
export const DepthChart = ({ ctx, lineup, onSlot }: { ctx: LabContext; lineup: Lineup; onSlot: (slot: SlotId, key: string) => void }) => (
  <section aria-labelledby="lab-depth" className="lab-panel lab-depth">
    <header className="lab-panel-head">
      <h2 id="lab-depth" className="lab-panel-title">
        Depth chart
      </h2>
      <span className="lamp" aria-label={`${filledCount(lineup)} of 10 slots filled`}>
        <b>{filledCount(lineup)}</b>/10
      </span>
    </header>
    <p className="lab-group">Offense</p>
    <ul className="lab-rows">
      {ORDER.slice(0, 6).map((id) => (
        <Slot key={id} ctx={ctx} slot={id} lineup={lineup} onSlot={onSlot} />
      ))}
    </ul>
    <p className="lab-group">Defense · any 4 of LB / DB / DL</p>
    <ul className="lab-rows">
      {ORDER.slice(6).map((id) => (
        <Slot key={id} ctx={ctx} slot={id} lineup={lineup} onSlot={onSlot} />
      ))}
    </ul>
  </section>
);

interface ToolbarProps {
  presets: Preset[];
  onClub: () => void;
  clubName: string;
  filled: number;
  onAutoDraft: () => void;
  onRandom: () => void;
  onPreset: (id: string) => void;
  onClear: () => void;
  includeLegends: boolean;
  onLegends: (v: boolean) => void;
  /** '' = auto (the lineup's own club) */
  kit: string;
  autoKit: string;
  onKit: (club: string) => void;
  turf: Turf;
  onTurf: (t: Turf) => void;
}

const TURFS: { id: Turf; label: string }[] = [
  { id: 'day', label: 'Day game' },
  { id: 'night', label: 'Night game' },
  { id: 'snow', label: 'Snow game' },
];

/** Build controls: load the club, auto-draft, random, dynasty presets, the kit and the turf, legends. */
export const LabToolbar = (p: ToolbarProps) => (
  <div className="lab-toolbar">
    <Button type="button" size="sm" onClick={p.onClub} className="bg-gold font-display text-[15px] font-bold uppercase text-black hover:bg-gold/90">
      <Plane className="mr-1 h-4 w-4" aria-hidden="true" /> Load my {p.clubName}
    </Button>
    <Button type="button" size="sm" variant="outline" onClick={p.onAutoDraft} className="lab-btn" title="Starts from the best OVR at every slot, then swaps in whoever raises the team rating most">
      <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" /> Auto-draft
    </Button>
    <Button type="button" size="sm" variant="outline" onClick={p.onRandom} className="lab-btn">
      <Dices className="mr-1 h-4 w-4" aria-hidden="true" /> Random
    </Button>
    <Select value="" onValueChange={p.onPreset}>
      <SelectTrigger className="lab-btn h-9 w-auto min-w-[10.5rem]" aria-label="Load a franchise dynasty preset">
        <SelectValue placeholder="Franchise dynasty" />
      </SelectTrigger>
      <SelectContent className="z-[70]">
        {p.presets.map((x) => (
          <SelectItem key={x.id} value={x.id}>
            <span className="inline-flex items-center gap-2">
              {x.team && <TeamLogo team={x.team} size={16} decorative />}
              {x.name} <span className="text-muted-foreground">· {10 - x.filled.length}/10 from the franchise</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Select value={p.kit || 'auto'} onValueChange={(v) => p.onKit(v === 'auto' ? '' : v)}>
      <SelectTrigger className="lab-btn h-9 w-auto min-w-[9rem]" aria-label="Kits the lineup wears">
        <Shirt className="mr-1 h-4 w-4 shrink-0" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[70] max-h-80">
        <SelectItem value="auto">Kit: auto ({p.autoKit})</SelectItem>
        {[...NFL_TEAMS]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((t) => (
            <SelectItem key={t.id} value={t.name}>
              <span className="inline-flex items-center gap-2">
                <TeamLogo team={t} size={16} decorative /> {t.name}
              </span>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
    <Select value={p.turf} onValueChange={(v) => p.onTurf(v as Turf)}>
      <SelectTrigger className="lab-btn h-9 w-auto min-w-[8.5rem]" aria-label="Field conditions">
        <Sun className="mr-1 h-4 w-4 shrink-0" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[70]">
        {TURFS.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <label className="lab-legends">
      <Switch checked={p.includeLegends} onCheckedChange={p.onLegends} aria-label="Include NFL legends" />
      NFL legends
    </label>
    {p.filled > 0 && (
      <Button type="button" size="sm" variant="ghost" onClick={p.onClear} className="font-display text-[15px] font-bold uppercase text-muted-foreground">
        <Eraser className="mr-1 h-4 w-4" aria-hidden="true" /> Clear
      </Button>
    )}
  </div>
);
