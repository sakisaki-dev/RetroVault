import {
  ArrowUpDown,
  Building2,
  CircleDot,
  Crown,
  Flame,
  Grid3x3,
  Hammer,
  Landmark,
  Lock,
  RotateCcw,
  Search,
  Shield,
  Star,
  Swords,
  Timer,
  Trophy,
  Tv,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/utils/frontOffice';
import { staggerStyle } from './shared';

const ICONS: Record<Achievement['icon'], LucideIcon> = {
  crown: Crown,
  flame: Flame,
  tv: Tv,
  building: Building2,
  trophy: Trophy,
  hammer: Hammer,
  timer: Timer,
  swords: Swords,
  rebound: RotateCcw,
  shield: Shield,
  ring: CircleDot,
  hall: Landmark,
  perfect: Star,
  grid: Grid3x3,
  arrows: ArrowUpDown,
  search: Search,
};

const Achievements = ({ items }: { items: Achievement[] }) => {
  const unlocked = items.filter((a) => a.unlocked).length;
  const pct = items.length ? Math.round((unlocked / items.length) * 100) : 0;

  return (
    <section aria-labelledby="fo-achievements" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="fo-achievements" className="section-title min-w-0 flex-1">
          Achievements
        </h2>
        <div className="flex w-full items-center gap-2 sm:w-64">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            <b className="text-foreground">{unlocked}</b> of {items.length} unlocked
          </span>
          <span
            className="fo-progress flex-1"
            role="progressbar"
            aria-label="Achievements unlocked"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={unlocked}
          >
            <span style={{ width: `${pct}%` }} />
          </span>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((a, i) => {
          const Icon = ICONS[a.icon];
          return (
            <li key={a.id} className="stagger-in" style={staggerStyle(i)}>
              <article className={cn('fo-badge', a.unlocked && 'fo-badge--on')} aria-labelledby={`fo-ach-${a.id}`}>
                <div className="flex items-start gap-3">
                  <span className="fo-medal" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                    {!a.unlocked && (
                      <span className="fo-lock">
                        <Lock className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {a.group} · <span className={a.unlocked ? 'text-gold' : undefined}>{a.unlocked ? 'Unlocked' : 'Locked'}</span>
                    </p>
                    <h3 id={`fo-ach-${a.id}`} className={cn('font-display text-lg uppercase leading-tight', !a.unlocked && 'text-foreground/75')}>
                      {a.title}
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-foreground/85">{a.description}</p>
                {a.unlocked && a.when && (
                  <p className="text-xs text-gold">
                    <span className="sr-only">Unlocked </span>
                    {a.when}
                  </p>
                )}
                {a.detail && <p className="text-xs text-muted-foreground">{a.detail}</p>}
                <div className="mt-auto space-y-2 pt-1">
                  {!a.unlocked && a.progress != null && (
                    <span
                      className="fo-progress block"
                      role="progressbar"
                      aria-label={`${a.title} progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(a.progress * 100)}
                    >
                      <span style={{ width: `${Math.round(a.progress * 100)}%` }} />
                    </span>
                  )}
                  <details className="text-xs text-muted-foreground">
                    <summary className="inline-flex rounded font-semibold text-sky hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      How it's computed
                    </summary>
                    <p className="mt-1 leading-relaxed">{a.rule}</p>
                  </details>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default Achievements;
