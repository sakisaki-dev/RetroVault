import { cn } from '@/lib/utils';

/** Pixel football glyph used as the Retro Vault mark (original artwork, no league marks). */
export const BrandGlyph = ({ size = 36, className }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    shapeRendering="crispEdges"
    aria-hidden="true"
    className={cn('shrink-0', className)}
  >
    <rect width="16" height="16" rx="3" fill="hsl(var(--turf-deep))" />
    <rect x="0" y="7" width="16" height="1" fill="hsl(0 0% 100% / 0.12)" />
    {/* ball */}
    <rect x="5" y="4" width="6" height="1" fill="#8a4b1f" />
    <rect x="3" y="5" width="10" height="1" fill="#8a4b1f" />
    <rect x="2" y="6" width="12" height="4" fill="#9c5726" />
    <rect x="3" y="10" width="10" height="1" fill="#7a3f17" />
    <rect x="5" y="11" width="6" height="1" fill="#7a3f17" />
    {/* laces */}
    <rect x="5" y="7" width="6" height="1" fill="#fff" />
    <rect x="6" y="6" width="1" height="3" fill="#fff" />
    <rect x="8" y="6" width="1" height="3" fill="#fff" />
    <rect x="10" y="6" width="1" height="3" fill="#fff" />
    {/* gold corner pip */}
    <rect x="13" y="1" width="2" height="2" fill="hsl(var(--gold))" />
  </svg>
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
