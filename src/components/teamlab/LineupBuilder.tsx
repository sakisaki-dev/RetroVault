import { useMemo } from 'react';
import { Dices, Eraser, Plane, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import type { Player } from '@/types/player';
import { SLOT_BY_ID, filledCount, lineupKeys, type LabContext, type Lineup, type Preset, type SlotId } from '@/utils/teamLab';
import { GradeChip } from './parts';

interface LineupBuilderProps {
  ctx: LabContext;
  lineup: Lineup;
  onSlot: (slot: SlotId, key: string) => void;
  presets: Preset[];
  /** Load the owner's current club (from the data) */
  onClub: () => void;
  clubName: string;
  onAutoDraft: () => void;
  onRandom: () => void;
  onPreset: (id: string) => void;
  onClear: () => void;
  includeLegends: boolean;
  onLegends: (v: boolean) => void;
}

const OFFENSE_ORDER: SlotId[] = ['wr1', 'wr2', 'ol', 'te', 'qb', 'rb'];
const DEFENSE_ORDER: SlotId[] = ['d1', 'd2', 'd3', 'd4'];
const SLOT_NAMES: Record<SlotId, string> = {
  qb: 'Quarterback',
  rb: 'Running back',
  wr1: 'Wide receiver 1',
  wr2: 'Wide receiver 2',
  te: 'Tight end',
  ol: 'Offensive line',
  d1: 'Defender 1',
  d2: 'Defender 2',
  d3: 'Defender 3',
  d4: 'Defender 4',
};

const Slot = ({ ctx, slot, lineup, onSlot }: { ctx: LabContext; slot: SlotId; lineup: Lineup; onSlot: (s: SlotId, k: string) => void }) => {
  const def = SLOT_BY_ID.get(slot)!;
  const value = lineup[slot];
  const profile = value ? ctx.profiles.get(value) : undefined;
  // Valid positions, minus players already used in another slot
  const players = useMemo<Player[]>(() => {
    const used = new Set(lineupKeys(lineup).filter((k) => k !== value));
    return def.positions.flatMap((pos) => ctx.byPos.get(pos) ?? []).filter((p) => !used.has(p.key)).map((p) => p.player);
  }, [ctx, def, lineup, value]);
  const label = def.side === 'defense' && profile ? `DEF · ${profile.position}` : def.label;
  return (
    <div className="min-w-0 rounded-lg bg-black/55 p-2 ring-1 ring-white/10">
      <div className="mb-1.5 flex min-h-5 items-center gap-1.5">
        <span className="font-pixel text-[9px] uppercase text-gold">{label}</span>
        {profile?.isLegend && <span className="font-pixel text-[7px] uppercase text-sky">NFL legend</span>}
        <span className="ml-auto flex items-center gap-1">
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
      </div>
      <PlayerSearchSelect
        players={players}
        value={value}
        onValueChange={(k) => onSlot(slot, k)}
        placeholder={`Pick ${def.side === 'defense' ? 'LB / DB / DL' : def.label}`}
        ariaLabel={SLOT_NAMES[slot]}
        showOvr
      />
    </div>
  );
};

const LineupBuilder = ({ ctx, lineup, onSlot, presets, onClub, clubName, onAutoDraft, onRandom, onPreset, onClear, includeLegends, onLegends }: LineupBuilderProps) => {
  const filled = filledCount(lineup);
  return (
    <section aria-labelledby="lab-builder" className="glass-card min-w-0 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="lab-builder" className="section-title min-w-0 flex-1 text-xl">
          Lineup
        </h2>
        <span className="lamp" aria-label={`${filled} of 10 slots filled`}>
          <b>{filled}</b>/10
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onClub} className="bg-gold font-display text-[15px] font-bold uppercase text-black hover:bg-gold/90">
          <Plane className="mr-1 h-4 w-4" aria-hidden="true" /> Load my {clubName}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onAutoDraft} className="border-line font-display text-[15px] font-bold uppercase" title="Starts from the best OVR at every slot, then swaps in whoever raises the team rating most">
          <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" /> Auto-draft best
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRandom} className="border-line font-display text-[15px] font-bold uppercase">
          <Dices className="mr-1 h-4 w-4" aria-hidden="true" /> Random
        </Button>
        <Select value="" onValueChange={onPreset}>
          <SelectTrigger className="h-9 w-auto min-w-[11rem] border-line font-display text-[15px] font-bold uppercase" aria-label="Load a franchise dynasty preset">
            <SelectValue placeholder="Franchise dynasty" />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {presets.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} <span className="text-muted-foreground">· {10 - p.filled.length}/10 from the franchise</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filled > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={onClear} className="font-display text-[15px] font-bold uppercase text-muted-foreground">
            <Eraser className="mr-1 h-4 w-4" aria-hidden="true" /> Clear
          </Button>
        )}
      </div>

      <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={includeLegends} onCheckedChange={onLegends} aria-label="Include NFL legends" />
        Include NFL legends <span className="hidden text-xs sm:inline">(real players from the arcade pool)</span>
      </label>

      {/* Field: offense on top, line of scrimmage, then the defense */}
      <div className="turf-stripes relative overflow-hidden rounded-xl p-2 ring-1 ring-black/40 sm:p-3">
        <p className="mb-1.5 font-pixel text-[9px] uppercase text-white/80">Offense</p>
        <div className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2">
          {OFFENSE_ORDER.map((id) => (
            <Slot key={id} ctx={ctx} slot={id} lineup={lineup} onSlot={onSlot} />
          ))}
        </div>
        <div className="my-3 flex items-center gap-2" aria-hidden="true">
          <span className="h-0 flex-1 border-t-2 border-dashed border-white/70" />
          <span className="font-pixel text-[8px] uppercase text-white/80">Line of scrimmage</span>
          <span className="h-0 flex-1 border-t-2 border-dashed border-white/70" />
        </div>
        <p className="mb-1.5 font-pixel text-[9px] uppercase text-white/80">Defense · any 4 of LB / DB / DL</p>
        <div className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2">
          {DEFENSE_ORDER.map((id) => (
            <Slot key={id} ctx={ctx} slot={id} lineup={lineup} onSlot={onSlot} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default LineupBuilder;
