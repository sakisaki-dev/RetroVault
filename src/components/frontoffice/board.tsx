import type { CSSProperties, ReactNode } from 'react';
import TeamLogo from '@/components/brand/TeamLogo';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';

/**
 * The Club office's shared parts (ClubOffice.tsx, CapSheet.tsx), in the trophy cabinet's language: a desk is a shelf
 * panel with a faint diagonal club tint, the real logo and a condensed title, a lamp chip on the right, its objects,
 * then a thin club-colour rule and a caption. Club colours are accents and tints only; no glows.
 */

const split = (triplet: string) => triplet.split(' ').map((x) => parseFloat(x));

/**
 * Club-neutral colours (team null: the coach's whole career, every club): the site's navy with gold, the coach's own
 * colours rather than any club's.
 */
const NEUTRAL_VARS = {
  ['--fo-team' as string]: '43 100% 55%',
  ['--cb-primary' as string]: 'hsl(226 45% 16%)',
  ['--cb-edge' as string]: 'hsl(43 100% 58%)',
  ['--cb-ink' as string]: 'hsl(43 100% 66%)',
  ['--cb-fg' as string]: 'hsl(43 100% 88%)',
} as CSSProperties;

/** The club's colours as CSS variables: --fo-team (primary triplet), --cb-primary, --cb-edge, --cb-ink (light), --cb-fg. */
export const boardVars = (team: string | null): CSSProperties => {
  if (team === null) return NEUTRAL_VARS;
  const t = findNFLTeam(team);
  const primary = t?.primaryColor ?? '226 38% 27%';
  const [h, s, l] = split(primary);
  const secondary = t && t.secondaryColor !== t.primaryColor ? t.secondaryColor : '0 0% 100%';
  return {
    ['--fo-team' as string]: primary,
    ['--cb-primary' as string]: `hsl(${primary})`,
    ['--cb-edge' as string]: `hsl(${secondary})`,
    ['--cb-ink' as string]: `hsl(${h} ${Math.min(s, 80)}% ${Math.max(l, 62)}%)`,
    ['--cb-fg' as string]: getReadableTextOn(primary),
  } as CSSProperties;
};

export const inkOf = (team: string) => {
  const p = findNFLTeam(team)?.primaryColor ?? '226 38% 27%';
  const [h, s, l] = split(p);
  return { primary: `hsl(${p})`, ink: `hsl(${h} ${Math.min(s, 80)}% ${Math.max(l, 62)}%)`, dark: `hsl(${h} ${s}% ${Math.min(l, 20)}%)` };
};

/** A cabinet-style shelf panel. `team` null = club-neutral (gold on navy, `icon` in the logo's place). */
export const Desk = ({
  team,
  icon,
  title,
  chip,
  caption,
  children,
  className,
  bodyClassName,
  id,
}: {
  team: string | null;
  icon?: ReactNode;
  title: ReactNode;
  chip?: ReactNode;
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) => (
  <section className={cn('fo-desk', team === null && 'is-neutral', className)} style={boardVars(team)} aria-labelledby={id}>
    <div className="fo-desk__head">
      {icon ?? (team !== null && <TeamLogo team={findNFLTeam(team) ?? team} size={28} decorative />)}
      <h3 id={id} className="fo-desk__title">
        {title}
      </h3>
      {chip}
    </div>
    <div className={cn('fo-desk__body', bodyClassName)}>{children}</div>
    <div className="fo-desk__rule" aria-hidden="true" />
    {caption && <div className="fo-desk__caption">{caption}</div>}
  </section>
);

/** The site's lamp chip ("254/275"). */
export const Lamp = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn('lamp shrink-0', className)}>{children}</span>;

/** A small pick token (draft-pick ticket), gold when held. */
export const PickToken = ({ round, label, dim, title }: { round: number; label?: ReactNode; dim?: boolean; title?: string }) => (
  <span className={cn('fo-token', dim && 'is-dim')} title={title} aria-label={title}>
    <span className="fo-token__r">{round === 1 ? '1st' : round === 2 ? '2nd' : '3rd'}</span>
    {label != null && <span className="fo-token__n">{label}</span>}
  </span>
);
