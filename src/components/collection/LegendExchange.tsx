import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useLeague } from '@/context/LeagueContext';
import { useGamePool, loadLegends } from '@/utils/useOfficialOvr';
import { playerKey } from '@/config/ovr';
import { exchangeLegends, groupByTier, tierFor, useCollection, type RetiredLegend, type Tier, type TierPool } from '@/utils/collection';

/**
 * One-time migration (mounted once, in Index): real NFL legends are no longer collectible. If this browser's save
 * still holds legend cards, they are swapped for a Legends Exchange pack of league cards (same tier, same finish;
 * see exchangeLegends in utils/collection.ts). Renders nothing.
 */

/** How legend cards were tiered while they were collectible: Legendary at this official OVR, otherwise Epic. */
const OLD_LEGEND_LEGENDARY_MIN_OVR = 93;

const MESSAGE = 'Your NFL legend cards were exchanged: open your Legends Exchange pack.';

/** Runs the exchange once the league and the OVR pool have loaded. Mounted only when a legend card is owned. */
const ExchangeRunner = ({ legendKeys }: { legendKeys: Set<string> }) => {
  const { league, legends, ovrMap, loaded } = useGamePool();
  const ready = loaded && league.length > 0;

  const pool = useMemo<TierPool | null>(() => {
    if (!ready) return null;
    return groupByTier(league, (p) => tierFor(p, ovrMap.get(playerKey(p))));
  }, [ready, league, ovrMap]);

  useEffect(() => {
    if (!pool) return;
    const leagueKeys = new Set(league.map(playerKey));
    const byKey = new Map(legends.map((p) => [playerKey(p), p]));
    const retired = new Map<string, RetiredLegend>();
    legendKeys.forEach((k) => {
      if (leagueKeys.has(k)) return;
      const ovr = ovrMap.get(k);
      const tier: Tier = ovr != null && ovr >= OLD_LEGEND_LEGENDARY_MIN_OVR ? 'legendary' : 'epic';
      retired.set(k, { key: k, position: byKey.get(k)?.position ?? k.slice(0, 2), tier });
    });
    if (exchangeLegends(retired, pool) > 0) toast.success(MESSAGE, { duration: 10000 });
  }, [pool, league, legends, legendKeys, ovrMap]);

  return null;
};

const LegendExchange = () => {
  const { cards } = useCollection();
  const { getAllPlayers } = useLeague();
  const [legendKeys, setLegendKeys] = useState<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    loadLegends().then((list) => alive && setLegendKeys(new Set(list.map(playerKey))));
    return () => {
      alive = false;
    };
  }, []);

  // A legend whose key matches a league player is that league player's card, not a legend card
  const leagueKeys = useMemo(() => new Set(getAllPlayers().map(playerKey)), [getAllPlayers]);
  const owned = useMemo(
    () => (legendKeys && leagueKeys.size ? Object.keys(cards).some((k) => legendKeys.has(k) && !leagueKeys.has(k)) : false),
    [cards, legendKeys, leagueKeys],
  );
  return owned && legendKeys ? <ExchangeRunner legendKeys={legendKeys} /> : null;
};

export default LegendExchange;
