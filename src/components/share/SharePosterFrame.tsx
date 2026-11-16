import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useLeagueContent } from '@/utils/leagueContent';

/**
 * The frame every shared picture is drawn in: night navy with the site's faint scanlines, the content, and a small
 * footer, the app icon and "RETRO VAULT · Y94" in the pixel face. `aspect` fixes the height (9 / 16 for a story);
 * `bare` lets the content fill the frame edge to edge, with the footer laid over its bottom edge.
 */
const SharePosterFrame = ({
  width,
  aspect,
  bare = false,
  className,
  style,
  children,
}: {
  /** CSS width; the picture is scaled to 1080 pixels wide */
  width: number;
  /** width / height */
  aspect?: number;
  bare?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) => {
  const season = useLeagueContent().content?.season;
  return (
    <div className={cn('shr-poster', bare && 'shr-poster--bare', className)} style={{ width, height: aspect ? Math.round(width / aspect) : undefined, ...style }}>
      <div className="shr-poster__body">{children}</div>
      <footer className="shr-foot">
        <img src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" width={18} height={18} className="shr-foot__icon" />
        <span>
          Retro <b>Vault</b>
          {season ? <> · {season}</> : null}
        </span>
      </footer>
    </div>
  );
};

export default SharePosterFrame;
