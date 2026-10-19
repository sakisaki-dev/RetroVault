import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Loader2, Plane, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHubRoute } from '@/components/stats/hub/hashRoute';
import {
  SLOTS,
  analyzeLineup,
  autoDraft,
  decodeLineup,
  emptyLineup,
  encodeLineup,
  filledCount,
  isComplete,
  lineupKeys,
  randomLineup,
  rankAmong,
  suggestUpgrades,
  teamLineup,
  type Lineup,
  type SlotId,
} from '@/utils/teamLab';
import LineupBuilder from './LineupBuilder';
import SavedTeamsPanel from './SavedTeamsPanel';
import AnalysisPanel from './AnalysisPanel';
import HeadToHeadPanel from './HeadToHeadPanel';
import { useLegendsToggle, useSavedTeams, useTeamLabContext } from './useTeamLab';

const SLOT_WORD: Record<string, string> = { qb: 'QB', rb: 'RB', wr1: 'WR', wr2: 'WR', te: 'TE', ol: 'OL', d1: 'defender', d2: 'defender', d3: 'defender', d4: 'defender' };

/**
 * Team Lab (#lab): build a Retro Bowl lineup (QB, RB, 2 WR, TE, OL + 4 defenders) and get unit grades, an
 * identity, strengths/weaknesses, a game plan, upgrade targets and a head-to-head. The engine is utils/teamLab.
 * The lineup lives in the hash (#lab?t=…) so builds are linkable.
 */
const TeamLabTab = () => {
  const { route, navigate } = useHubRoute();
  const [includeLegends, setIncludeLegends] = useLegendsToggle();
  const { ctx, legendKeys, presets } = useTeamLabContext(includeLegends);
  const saved = useSavedTeams();
  const [lineup, setLineup] = useState<Lineup>(emptyLineup);
  const hydrated = useRef(false);

  // Hash → lineup (first load, Back/Forward, pasted links)
  useEffect(() => {
    if (!ctx) return;
    const t = route.t ?? '';
    if (t === encodeLineup(lineup)) {
      hydrated.current = true;
      return;
    }
    const wantsLegends = lineupKeys(decodeLineup(t)).some((k) => legendKeys.has(k) && !ctx.profiles.has(k));
    if (wantsLegends && !includeLegends) {
      setIncludeLegends(true); // ctx rebuilds with legends, then this effect runs again
      return;
    }
    setLineup(decodeLineup(t, (k) => ctx.profiles.has(k)));
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the hash and the data, not to local edits
  }, [ctx, route.t]);

  // Lineup → hash (replace, so editing doesn't flood history)
  useEffect(() => {
    if (!ctx || !hydrated.current) return;
    const t = encodeLineup(lineup);
    if ((route.t ?? '') !== t) navigate({ tab: 'lab', t: t || undefined }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup]);

  // Legends switched off: drop any legends from the build
  useEffect(() => {
    if (!ctx || includeLegends) return;
    setLineup((l) => {
      const ids = SLOTS.map((s) => s.id).filter((id) => l[id] && !ctx.profiles.has(l[id]));
      if (!ids.length) return l;
      const next = { ...l };
      ids.forEach((id) => (next[id] = ''));
      return next;
    });
  }, [ctx, includeLegends]);

  const setSlot = useCallback((slot: SlotId, key: string) => setLineup((l) => ({ ...l, [slot]: key })), []);
  const loadJets = useCallback(() => ctx && setLineup(teamLineup(ctx)), [ctx]);

  const analysis = useMemo(() => (ctx ? analyzeLineup(ctx, lineup) : null), [ctx, lineup]);
  const upgrades = useMemo(() => (ctx && analysis ? suggestUpgrades(ctx, lineup) : null), [ctx, analysis, lineup]);
  const ranking = useMemo(
    () =>
      ctx && analysis
        ? rankAmong(ctx, lineup, [
            ...saved.teams.map((t) => ({ id: `saved:${t.id}`, name: t.name, lineup: t.lineup })),
            ...presets.map((p) => ({ id: p.id, name: p.name, lineup: p.lineup })),
          ])
        : [],
    [ctx, analysis, lineup, saved.teams, presets],
  );

  if (!ctx) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" /> Loading the league…
      </div>
    );
  }

  const filled = filledCount(lineup);
  const missing = SLOTS.filter((s) => !lineup[s.id]);

  return (
    <div className="container min-w-0 py-6">
      <header className="mb-5">
        <p className="font-pixel text-[10px] uppercase text-gold">Front office · lab</p>
        <h1 className="font-display text-4xl font-extrabold uppercase italic tracking-tight text-chalk sm:text-5xl">
          Team <span className="text-gold">Lab</span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Build a lineup in Retro Bowl's roster shape and get a scouting report written for how you play: what to call, when to go for it,
          and who to trade for.
        </p>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0 space-y-4">
          <LineupBuilder
            ctx={ctx}
            lineup={lineup}
            onSlot={setSlot}
            presets={presets}
            onJets={loadJets}
            onAutoDraft={() => setLineup(autoDraft(ctx))}
            onRandom={() => setLineup(randomLineup(ctx, Math.floor(Math.random() * 1e9)))}
            onPreset={(id) => {
              const p = presets.find((x) => x.id === id);
              if (p) setLineup({ ...p.lineup });
            }}
            onClear={() => setLineup(emptyLineup())}
            includeLegends={includeLegends}
            onLegends={setIncludeLegends}
          />
          <SavedTeamsPanel
            ctx={ctx}
            lineup={lineup}
            teams={saved.teams}
            onSave={(name) => saved.save(name, lineup)}
            onLoad={(t) => setLineup(decodeLineup(encodeLineup(t.lineup), (k) => ctx.profiles.has(k)))}
            onRename={saved.rename}
            onDelete={saved.remove}
          />
        </div>

        <div className="min-w-0 space-y-4">
          {analysis && isComplete(lineup) ? (
            <>
              <AnalysisPanel analysis={analysis} upgrades={upgrades} ranking={ranking} onUpgrade={(slot, key) => setSlot(slot as SlotId, key)} />
              <HeadToHeadPanel ctx={ctx} lineup={lineup} saved={saved.teams} presets={presets} />
            </>
          ) : (
            <section className="glass-card-glow relative overflow-hidden p-6 text-center sm:p-10" aria-labelledby="lab-empty">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_220px_at_50%_0%,hsl(var(--gold)/0.16),transparent_70%)]" aria-hidden="true" />
              <FlaskConical className="relative mx-auto h-12 w-12 text-gold" aria-hidden="true" />
              {filled === 0 ? (
                <>
                  <h2 id="lab-empty" className="relative mt-3 font-display text-3xl font-extrabold uppercase italic text-chalk">
                    Scout your own squad
                  </h2>
                  <p className="relative mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Load the current Jets and get unit grades, your team's identity, a game plan for 4th downs, 2-point tries and the clock,
                    and the trade targets that would help most.
                  </p>
                </>
              ) : (
                <>
                  <h2 id="lab-empty" className="relative mt-3 font-display text-3xl font-extrabold uppercase italic text-chalk">
                    {10 - filled} slot{10 - filled === 1 ? '' : 's'} to go
                  </h2>
                  <p className="relative mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Still need: {missing.map((s) => SLOT_WORD[s.id]).join(', ')}. The report appears when all 10 are filled.
                  </p>
                  <div className="relative mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded bg-black/50" aria-hidden="true">
                    <div className="h-full bg-gold" style={{ width: `${filled * 10}%` }} />
                  </div>
                </>
              )}
              <div className="relative mt-5 flex flex-wrap justify-center gap-2">
                <Button type="button" size="lg" onClick={loadJets} className="bg-gold font-display text-xl font-extrabold uppercase text-black hover:bg-gold/90">
                  <Plane className="mr-2 h-5 w-5" aria-hidden="true" /> Load my Jets
                </Button>
                <Button type="button" size="lg" variant="outline" onClick={() => setLineup(autoDraft(ctx))} className="border-line font-display text-lg font-bold uppercase">
                  <Sparkles className="mr-2 h-5 w-5" aria-hidden="true" /> Auto-draft best
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamLabTab;
