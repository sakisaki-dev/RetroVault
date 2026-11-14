import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Loader2, Plane, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHubRoute } from '@/components/stats/hub/hashRoute';
import { findNFLTeam } from '@/utils/nflTeams';
import { bannerTeamOf } from '@/utils/playerExtras';
import { useOfficeState } from '@/utils/clubOffice';
import { useLiveSeason } from '@/utils/seasonLive';
import {
  ALL_UNITS,
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
  scoreLineup,
  suggestUpgrades,
  teamLineup,
  type Lineup,
  type SlotId,
} from '@/utils/teamLab';
import { DepthChart, LabToolbar } from './LineupBuilder';
import { SLOT_NAMES, openSlotPicker } from './labSlots';
import SavedTeamsPanel from './SavedTeamsPanel';
import AnalysisPanel, { type Comparable } from './AnalysisPanel';
import HeadToHeadPanel from './HeadToHeadPanel';
import LabHeader from './LabHeader';
import LabField from './LabField';
import ScoutingReport from './ScoutingReport';
import { labLedger } from './labOffice';
import { useFieldArt, type Turf } from './fieldArt';
import { useMedia } from './useMedia';
import { useLegendsToggle, useSavedTeams, useTeamLabContext } from './useTeamLab';
import './teamlab.css';

/**
 * Team Lab (#lab): build a Retro Bowl lineup (QB, RB, 2 WR, TE, OL + 4 defenders) on the game's own field and get a
 * scouting report: the game's own rules from the live save (team strength, cap, final seasons, ceilings), unit
 * grades, an identity, strengths/weaknesses, a call sheet, upgrade targets, comparable dynasties and a head-to-head.
 * The engine is utils/teamLab. The lineup lives in the hash (#lab?t=…) so builds are linkable.
 */
const TeamLabTab = () => {
  const { route, navigate } = useHubRoute();
  const [includeLegends, setIncludeLegends] = useLegendsToggle();
  const { ctx, legendKeys, presets, club } = useTeamLabContext(includeLegends);
  const saved = useSavedTeams();
  const office = useOfficeState();
  const live = useLiveSeason();
  const [lineup, setLineup] = useState<Lineup>(emptyLineup);
  const [kit, setKit] = useState('');
  const [turfPick, setTurfPick] = useState<Turf | null>(null);
  const hydrated = useRef(false);
  const tall = useMedia('(max-width: 639px)');
  const big = useMedia('(min-width: 1024px)');
  const huge = useMedia('(min-width: 1280px)');

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
  const loadClub = useCallback(() => ctx && club && setLineup(teamLineup(ctx, club)), [ctx, club]);
  const clubName = findNFLTeam(club)?.name ?? (club || 'club');

  // The kits: the club most of the lineup is known for (the current club breaks a tie), unless one is picked
  const autoKit = useMemo(() => {
    if (!ctx) return club;
    const count = new Map<string, number>();
    lineupKeys(lineup).forEach((k) => {
      const p = ctx.profiles.get(k);
      const t = p && !p.isLegend ? findNFLTeam(bannerTeamOf(p.player))?.name : undefined;
      if (t) count.set(t, (count.get(t) ?? 0) + 1);
    });
    const best = Math.max(0, ...count.values());
    if (!best) return findNFLTeam(club)?.name ?? club;
    const top = [...count.entries()].filter(([, n]) => n === best).map(([t]) => t);
    const own = findNFLTeam(club)?.name;
    return own && top.includes(own) ? own : top.sort()[0];
  }, [ctx, lineup, club]);
  const kitClub = kit || autoKit || 'Eagles';
  const kitTeam = findNFLTeam(kitClub);
  // Snow on the field when the kit club's open-air stadium sees heavy snow (snowfall 50+), else a day game
  const stadium = live?.clubs[kitTeam?.name ?? ''];
  const turf: Turf = turfPick ?? ((stadium?.snowfall ?? 0) >= 50 && !stadium?.roof ? 'snow' : 'day');
  const art = useFieldArt(kitClub, turf, tall);

  const analysis = useMemo(() => (ctx ? analyzeLineup(ctx, lineup) : null), [ctx, lineup]);
  const upgrades = useMemo(() => (ctx && analysis ? suggestUpgrades(ctx, lineup, club) : null), [ctx, analysis, lineup, club]);
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
  // Comparable dynasties: the presets whose unit profile sits closest to this one (mean unit-score gap)
  const comparables = useMemo<Comparable[]>(() => {
    if (!ctx || !analysis) return [];
    return presets
      .map((p) => {
        const s = scoreLineup(ctx, p.lineup);
        if (!s) return null;
        const gap = ALL_UNITS.reduce((a, u) => a + Math.abs(s.units[u].score - analysis.units[u].score), 0) / ALL_UNITS.length;
        return { preset: p, match: Math.max(0, 100 - gap), team: s.team };
      })
      .filter((x): x is Comparable => !!x)
      .sort((a, b) => b.match - a.match)
      .slice(0, 3);
  }, [ctx, analysis, presets]);
  const ledger = useMemo(() => (office ? labLedger(office, lineup) : null), [office, lineup]);

  if (!ctx) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" /> Loading the league…
      </div>
    );
  }

  const filled = filledCount(lineup);
  const missing = SLOTS.filter((s) => !lineup[s.id]);
  const rankPos = ranking.findIndex((r) => r.isCurrent) + 1;
  const vars = {
    '--lab-c1': kitTeam ? `hsl(${kitTeam.primaryColor})` : 'hsl(var(--turf))',
    '--lab-c2': kitTeam ? `hsl(${kitTeam.secondaryColor})` : 'hsl(var(--gold))',
    ...(art.crowd ? { '--lab-crowd': `url("${art.crowd}")` } : {}),
    ...(art.stands ? { '--lab-standfront': `url("${art.stands}")` } : {}),
  } as CSSProperties;
  const loadPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (p) setLineup({ ...p.lineup });
  };

  return (
    <div className="lab container min-w-0 py-3 sm:py-4" style={vars}>
      <div className="lab-stadium">
        <LabHeader
          kitClub={kitClub}
          analysis={isComplete(lineup) ? analysis : null}
          filled={filled}
          strength={ledger?.strength ?? null}
          rated={ledger?.rated ?? 0}
          rankText={rankPos > 0 && ranking.length > 1 ? `ranked ${rankPos} of ${ranking.length}` : undefined}
        >
          <LabToolbar
            presets={presets}
            onClub={loadClub}
            clubName={clubName}
            filled={filled}
            onAutoDraft={() => setLineup(autoDraft(ctx))}
            onRandom={() => setLineup(randomLineup(ctx, Math.floor(Math.random() * 1e9)))}
            onPreset={loadPreset}
            onClear={() => setLineup(emptyLineup())}
            includeLegends={includeLegends}
            onLegends={setIncludeLegends}
            kit={kit}
            autoKit={autoKit}
            onKit={setKit}
            turf={turf}
            onTurf={setTurfPick}
          />
        </LabHeader>
        <div className={`lab-stands ${art.crowd ? 'lab-stands--art' : 'lab-stands--css'}`} aria-hidden="true">
          <span className="lab-crowd" />
          <span className="lab-standfront" />
        </div>
        <div className="lab-pitch">
          <LabField
            ctx={ctx}
            lineup={lineup}
            kitClub={kitClub}
            turf={turf}
            art={art}
            tall={tall}
            size={huge ? 'l' : big ? 'm' : 's'}
            onPick={openSlotPicker}
            overlay={
              filled === 0 ? (
                <div className="lab-cta">
                  <p className="lab-kicker">Empty field</p>
                  <p className="lab-cta-title">Scout your own squad</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" onClick={loadClub} className="bg-gold font-display text-lg font-extrabold uppercase text-black hover:bg-gold/90">
                      <Plane className="mr-1.5 h-4 w-4" aria-hidden="true" /> Load my {clubName}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setLineup(autoDraft(ctx))} className="lab-btn text-lg">
                      <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" /> Auto-draft
                    </Button>
                  </div>
                  <p className="lab-cta-note">or tap any spot to pick a player</p>
                </div>
              ) : undefined
            }
          />
          <DepthChart ctx={ctx} lineup={lineup} onSlot={setSlot} />
        </div>
      </div>

      {filled > 0 && !isComplete(lineup) && (
        <div className="lab-togo" role="status">
          <span className="lab-togo-n">{10 - filled}</span>
          <span className="min-w-0 flex-1">
            <b>slot{10 - filled === 1 ? '' : 's'} to go</b>
            <span className="block truncate text-xs text-muted-foreground">
              Still need: {missing.map((s) => (s.side === 'defense' ? 'defender' : SLOT_NAMES[s.id].toLowerCase())).join(', ')}
            </span>
          </span>
          <span className="lab-togo-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${filled / 10})` }} />
          </span>
        </div>
      )}

      {office && <ScoutingReport ctx={ctx} lineup={lineup} office={office} />}

      {analysis && isComplete(lineup) && (
        <>
          <AnalysisPanel
            clubName={clubName}
            analysis={analysis}
            upgrades={upgrades}
            ranking={ranking}
            comparables={comparables}
            onUpgrade={(slot, key) => setSlot(slot as SlotId, key)}
            onPreset={loadPreset}
          />
          <HeadToHeadPanel ctx={ctx} lineup={lineup} saved={saved.teams} presets={presets} kitClub={kitClub} />
        </>
      )}

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
  );
};

export default TeamLabTab;
