import { cn } from '@/lib/utils';

/** The Retro Vault mark: the app icon itself ("Kickoff", scripts/build_app_icons.py), so the header matches the
 *  Home Screen and the browser tab. Pixel art, drawn with nearest-neighbour scaling. */
export const BrandGlyph = ({ size = 36, className }: { size?: number; className?: string }) => (
  <img
    src={`${import.meta.env.BASE_URL}icon-192.png?v=kickoff`}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={cn('shrink-0 rounded-[22%]', className)}
    style={{ imageRendering: 'pixelated' }}
  />
);

/** "RETRO VAULT" wordmark in condensed italic caps, with VAULT in gold. */
const BrandMark = ({ className, compact = false }: { className?: string; compact?: boolean }) => (
  <span className={cn('inline-flex items-center gap-2.5', className)}>
    <BrandGlyph size={compact ? 28 : 34} />
    <span className="flex flex-col leading-none">
      <span
        className="font-display font-extrabold italic uppercase tracking-tight text-chalk"
        style={{ fontSize: compact ? 22 : 26, textShadow: '2px 2px 0 #000' }}
      >
        Retro <span className="text-gold">Vault</span>
      </span>
      {!compact && (
        <span className="font-pixel text-[9px] uppercase text-muted-foreground mt-1">League Hub</span>
      )}
    </span>
  </span>
);

export default BrandMark;
