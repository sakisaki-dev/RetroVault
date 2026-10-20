import { cn } from '@/lib/utils';
import { SKIN_TONES, lockedSkin, skinColor, useSpriteTable } from './sprite/faces';

interface SkinTonePickerProps {
  /** Player name (a look locked in sprites.json makes the picker read-only) */
  name: string;
  /** SKIN_TONES key, or '' for auto */
  value: string;
  onChange: (v: string) => void;
}

/**
 * Skin tone for the player's generated Retro Bowl sprite: six swatches plus Auto (picked from his name). Saved with
 * the player edits. Players whose look is locked in data/y80/sprites.json show their locked tone, read-only.
 */
const SkinTonePicker = ({ name, value, onChange }: SkinTonePickerProps) => {
  const table = useSpriteTable();
  const locked = lockedSkin(name, table);
  const current = locked ?? value;
  const options = [{ key: '', label: 'Auto', color: '' }, ...SKIN_TONES];
  return (
    <fieldset className="space-y-2 rounded-md border border-line p-3" disabled={!!locked} aria-describedby="skin-help">
      <legend className="px-1 text-sm font-medium">Sprite skin tone</legend>
      <div role="radiogroup" aria-label="Sprite skin tone" className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = current === o.key;
          return (
            <button
              key={o.key || 'auto'}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              title={o.label}
              onClick={() => onChange(o.key)}
              className={cn(
                'grid h-9 min-w-[2.25rem] place-items-center rounded-full border-2 px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                on ? 'border-gold ring-2 ring-gold/40' : 'border-line hover:border-gold/60',
              )}
              style={o.key ? { background: skinColor(o.key as (typeof SKIN_TONES)[number]['key']) } : undefined}
            >
              {o.key ? <span className="sr-only">{o.label}</span> : 'Auto'}
            </button>
          );
        })}
      </div>
      <p id="skin-help" className="text-xs text-muted-foreground">
        {locked
          ? `Locked by the owner's sprite looks (data/y80/sprites.json): ${SKIN_TONES.find((t) => t.key === locked)!.label}.`
          : 'Used by his Retro Bowl sprite card. Auto picks one from his name.'}
      </p>
    </fieldset>
  );
};

export default SkinTonePicker;
