import type { SlotId } from '@/utils/teamLab';
import { reducedMotion } from '@/utils/motion';

export const SLOT_NAMES: Record<SlotId, string> = {
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

/** Opens a slot's picker from anywhere (the field's spots): scrolls the depth chart row into view and clicks its trigger. */
export const openSlotPicker = (slot: SlotId) => {
  const row = document.getElementById(`lab-slot-${slot}`);
  if (!row) return;
  row.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  row.querySelector<HTMLButtonElement>('button[role="combobox"]')?.click();
};
