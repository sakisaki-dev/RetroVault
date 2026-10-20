import { Quote } from 'lucide-react';
import type { Player } from '@/types/player';
import { matchPlayerByName, type Storyline } from '@/utils/leagueContent';
import { cn } from '@/lib/utils';
import MiniMarkdown from './MiniMarkdown';

interface StorylinesProps {
  storylines: Storyline[];
  players: Player[];
  onPlayerSelect: (p: Player) => void;
}

/** Era reports already live in the era panels, and the QB lineage has its own card. */
const HIDDEN = new Set(['Era Report']);

/**
 * League storylines: rule-generated from the data (records, rivalries, snubs…), plus the commissioner's own notes,
 * which are quoted exactly as the owner wrote them.
 */
const Storylines = ({ storylines, players, onPlayerSelect }: StorylinesProps) => {
  const owner = storylines.filter((s) => s.source === 'owner');
  const generated = storylines.filter((s) => s.source !== 'owner' && !HIDDEN.has(s.category) && s.id !== 'lineages');
  if (!owner.length && !generated.length) return null;

  const chips = (s: Storyline) =>
    s.players.length > 0 && (
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Players in this story">
        {s.players.map((name) => {
          const p = matchPlayerByName(name, players);
          return (
            <li key={name}>
              {p ? (
                <button
                  type="button"
                  onClick={() => onPlayerSelect(p)}
                  className="rounded-md bg-secondary/50 px-2 py-0.5 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {name}
                </button>
              ) : (
                <span className="rounded-md bg-secondary/50 px-2 py-0.5 text-xs">{name}</span>
              )}
            </li>
          );
        })}
      </ul>
    );

  return (
    <section aria-labelledby="storylines-heading" className="space-y-4">
      <h2 id="storylines-heading" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Storylines
      </h2>
      {owner.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {owner.map((s) => (
            <article key={s.id} className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Quote className="h-3.5 w-3.5" aria-hidden /> From the commissioner
                {s.subheadline && <span className="font-normal normal-case tracking-normal text-muted-foreground">· {s.subheadline}</span>}
              </p>
              <blockquote className="whitespace-pre-line border-l-2 border-primary/50 pl-3 text-sm italic leading-relaxed text-foreground/90">
                {s.body.replace(/^> ?/gm, '')}
              </blockquote>
              {chips(s)}
            </article>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {generated.map((s) => (
          <article key={s.id} className={cn('rounded-xl border border-border/40 bg-card p-4')}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{s.category}</p>
            <h3 className="font-display text-lg font-bold uppercase leading-tight">{s.headline}</h3>
            {s.subheadline && <p className="mb-2 text-xs text-muted-foreground">{s.subheadline}</p>}
            <MiniMarkdown source={s.body} className="text-sm" />
            {chips(s)}
          </article>
        ))}
      </div>
    </section>
  );
};

export default Storylines;
