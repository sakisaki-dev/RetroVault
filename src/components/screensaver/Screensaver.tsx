import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Player } from '@/types/player';
import { useLeague } from '@/context/LeagueContext';
import { playerKey } from '@/config/ovr';
import { isHallOfFamer } from '@/config/stats';
import { tierLabel, tierRank, finishRank, FINISHES } from '@/config/cardTiers';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import { useJerseyNumbers } from '@/utils/jerseys';
import { bannerTeamOf } from '@/utils/playerExtras';
import { findNFLTeam } from '@/utils/nflTeams';
import { useGameSprites } from '@/utils/gameSprites';
import { useHallOfFame } from '@/utils/hallOfFame';
import { useRafters } from '@/utils/rafters';
import { useCollection } from '@/utils/collection';
import { usePerfMode } from '@/hooks/usePerfMode';
import { useFieldArt } from '@/components/teamlab/fieldArt';
import { useCardPool, type CardInfo } from '@/components/collection/useCardPool';
import { displayWithKit } from '@/components/collection/kits';
import CollectibleCard from '@/components/collection/CollectibleCard';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import { BrandGlyph } from '@/components/brand/BrandMark';
import TeamLogo from '@/components/brand/TeamLogo';
import GameSprite from '@/components/GameSprite';
import RaftersScene from '@/components/teams/RaftersScene';
import { bannerStats } from '@/components/hof/hofUtils';
import { clubStyle } from '@/components/stats/visual/clubTone';
import './screensaver.css';

/*
 * The desktop screensaver (owner, 2026-11-17): a full-screen show that cycles through the site's art, one scene at a
 * time with a crossfade: a player's hero banner in a night stadium painted to his club, a card from the binder turning
 * under a spotlight, a club's all-time line-up on its turf, a Hall of Famer on his pedestal, and a club's rafters.
 * Picks are shuffled each run (presentation only, never identity). Any key, click or real mouse move ends it; the
 * screen is kept awake (Wake Lock) while it runs. Reduced motion: still scenes, crossfades only.
 */

type Scene =
  | { kind: 'spotlight'; player: Player }
  | { kind: 'card'; card: CardInfo }
  | { kind: 'lineup'; club: string; players: Player[] }
  | { kind: 'hof'; player: Player; label: string }
  | { kind: 'rafters'; club: string };

const SCENE_MS = 14_000;
const FADE_MS = 1_400;
const MOVE_EXIT_PX = 24;

const shuffle = <T,>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const clubOf = (p: Player) => findNFLTeam(bannerTeamOf(p));

/** The stadium behind a scene: the game's night stands, crowd and turf painted to the club (CSS fallback without) */
const Stadium = ({ club, children, className }: { club: string; children: ReactNode; className?: string }) => {
  const art = useFieldArt(club, 'night');
  const t = findNFLTeam(club);
  const style = {
    ...(t ? { '--sv-1': `hsl(${t.primaryColor})`, '--sv-2': `hsl(${t.secondaryColor})` } : {}),
    ...(art.stands ? { '--sv-stands': `url(${art.stands})` } : {}),
    ...(art.crowd ? { '--sv-crowd': `url(${art.crowd})` } : {}),
    ...(art.turf ? { '--sv-turf': `url(${art.turf})` } : {}),
  } as CSSProperties;
  return (
    <div className={`sv-stadium ${art.turf ? 'sv-stadium--art' : ''} ${className ?? ''}`} style={style}>
      <span className="sv-stadium__sky" aria-hidden="true" />
      <span className="sv-stadium__lights" aria-hidden="true" />
      <span className="sv-stadium__stands" aria-hidden="true" />
      <span className="sv-stadium__crowd" aria-hidden="true" />
      <span className="sv-stadium__turf" aria-hidden="true" />
      <span className="sv-stadium__wash" aria-hidden="true" />
      {children}
    </div>
  );
};

const Figure = ({ player, sprites, action = 'idle', scale = 1 }: { player: Player; sprites: boolean; action?: 'idle' | 'celebrate'; scale?: number }) => (
  <span className="sv-fig" style={{ '--sv-scale': scale } as CSSProperties}>
    <span className="sv-fig__shadow" />
    {sprites ? (
      <GameSprite player={player} kind="figure" size="l" action={action} className="sv-fig__sprite" />
    ) : (
      <span className="sv-fig__logo">
        <TeamLogo team={bannerTeamOf(player)} size={120} decorative />
      </span>
    )}
  </span>
);

const SpotlightScene = ({ player, rank, number, ovr, sprites }: { player: Player; rank: number; number: number | null; ovr: number | null; sprites: boolean }) => {
  const t = clubOf(player);
  return (
    <Stadium club={t?.name ?? 'Eagles'}>
      <div className="sv-spot">
        <p className="sv-kick">Retro Vault · Legends of the league</p>
        <div className="sv-spot__banner">
          <ProPlayerBanner
            size="hero"
            name={player.name}
            nickname={player.nickname}
            position={player.position}
            team={t ?? player.team}
            number={number}
            ovr={ovr}
            hallOfFamer={isHallOfFamer(player)}
            eyebrow={t ? `${t.fullName}` : undefined}
            figure={sprites ? <GameSprite player={player} team={t?.name} kind="figure" size="l" showKit /> : undefined}
            stats={bannerStats(player)}
          />
        </div>
        <p className="sv-cap">
          Career Legacy <b>{fmt(player.careerLegacy)}</b> · No. {rank} all time
          {player.rings ? (
            <>
              {' '}
              · <b>{player.rings}</b> {player.rings === 1 ? 'ring' : 'rings'}
            </>
          ) : null}
        </p>
      </div>
    </Stadium>
  );
};

const CardScene = ({ card, owned, display }: { card: CardInfo; owned: ReturnType<typeof useCollection>['cards']; display: ReturnType<typeof useCollection>['state']['display'] }) => {
  const entry = owned[card.key];
  const d = displayWithKit(entry, display?.[card.key], card.player);
  const finish = FINISHES.find((f) => f.key === d.finish)?.label ?? '';
  return (
    <div className="sv-vault" style={clubStyle(card.player)}>
      <span className="sv-vault__cone" aria-hidden="true" />
      <div className="sv-vault__row">
        <div className="sv-vault__card">
          <CollectibleCard
            player={card.player}
            tier={card.tier}
            finish={d.finish}
            variant={d.variant}
            kit={d.kit}
            prizm={d.prizm}
            owned
            ovr={card.ovr}
            number={card.number}
            stats={card.stats}
            setNo={card.setNo}
            large
            live
          />
        </div>
        <div className="sv-vault__text">
          <p className="sv-kick">From the binder</p>
          <h2 className="sv-title">{card.player.name}</h2>
          <p className="sv-sub">
            {tierLabel(card.tier)}
            {finish ? ` · ${finish}` : ''}
          </p>
          <p className="sv-sub sv-sub--dim">Card No. {card.setNo}</p>
        </div>
      </div>
      <span className="sv-vault__floor" aria-hidden="true" />
    </div>
  );
};

const LineupScene = ({ club, players, sprites }: { club: string; players: Player[]; sprites: boolean }) => {
  const t = findNFLTeam(club);
  // the best in the middle, the rest fanning out
  const order: Player[] = [];
  players.forEach((p, i) => (i % 2 ? order.push(p) : order.unshift(p)));
  return (
    <Stadium club={club}>
      <div className="sv-line">
        <div className="sv-line__head">
          <TeamLogo team={club} size={92} decorative />
          <div>
            <p className="sv-kick">All-time greats</p>
            <h2 className="sv-title">{t?.fullName ?? club}</h2>
          </div>
        </div>
        <ul className="sv-line__row">
          {order.map((p, i) => {
            const best = p === players[0];
            return (
              <li key={playerKey(p)} className={best ? 'sv-line__man sv-line__man--best' : 'sv-line__man'} style={{ ...clubStyle(p), '--i': i } as CSSProperties}>
                <Figure player={p} sprites={sprites} action={best ? 'celebrate' : 'idle'} scale={best ? 1.3 : 1.05} />
                <span className="sv-line__name">{p.name.split(' ').slice(-1)[0]}</span>
                <span className="sv-line__cl">{fmt(p.careerLegacy)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Stadium>
  );
};

const HofScene = ({ player, label, sprites }: { player: Player; label: string; sprites: boolean }) => {
  const t = clubOf(player);
  const awards = [
    player.rings ? `${player.rings} ${player.rings === 1 ? 'ring' : 'rings'}` : '',
    player.mvp ? `${player.mvp} MVP` : '',
    player.sbmvp ? `${player.sbmvp} Super Bowl MVP` : '',
  ].filter(Boolean);
  return (
    <div className="sv-hall" style={clubStyle(player)}>
      <span className="sv-hall__columns" aria-hidden="true" />
      <span className="sv-hall__glow" aria-hidden="true" />
      <div className="sv-hall__stage">
        <Figure player={player} sprites={sprites} action="celebrate" scale={1.9} />
        <span className="sv-hall__pedestal" aria-hidden="true">
          {t && <TeamLogo team={t.name} size={44} decorative />}
        </span>
      </div>
      <div className="sv-hall__plaque">
        <p className="sv-kick">Hall of Fame · {label}</p>
        <h2 className="sv-title">{player.name}</h2>
        {player.nickname && <p className="sv-nick">“{player.nickname}”</p>}
        <p className="sv-sub">
          {t?.fullName ?? player.team} · Career Legacy {fmt(player.careerLegacy)}
          {awards.length ? ` · ${awards.join(' · ')}` : ''}
        </p>
      </div>
    </div>
  );
};

const RaftersSceneSlide = ({ club }: { club: string }) => {
  const { bannersFor, ringFor } = useRafters();
  const t = findNFLTeam(club) ?? null;
  return (
    <div className="sv-rafters">
      <div className="sv-rafters__frame">
        <RaftersScene team={t} banners={bannersFor(club)} ring={ringFor(t)} headingId="sv-rafters-title" />
      </div>
    </div>
  );
};

/** One clock in the corner, a minute at a time */
const Clock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="sv-clock">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>;
};

const Screensaver = ({ onClose }: { onClose: () => void }) => {
  const { getAllPlayers, dataVersion } = useLeague();
  const ovrMap = useOfficialOvr();
  const { numberFor } = useJerseyNumbers();
  const sprites = !!useGameSprites();
  const { data: hof } = useHallOfFame();
  const { clubsWithRafters, bannersFor } = useRafters();
  const { cards: pool, byKey } = useCardPool();
  const { state, cards: owned } = useCollection();
  const { lite } = usePerfMode();
  const rootRef = useRef<HTMLDivElement>(null);

  const players = useMemo(
    () => getAllPlayers().filter((p) => !p.isRealLegend).sort((a, b) => b.careerLegacy - a.careerLegacy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAllPlayers, dataVersion],
  );
  const rankOf = useMemo(() => new Map(players.map((p, i) => [playerKey(p), i + 1])), [players]);

  // The playlist: each kind shuffled, then dealt in turn (spotlight, card, line-up, Hall of Famer, rafters, …)
  const scenes = useMemo<Scene[]>(() => {
    if (!players.length) return [];
    const spot = shuffle(players.slice(0, 80)).map((p): Scene => ({ kind: 'spotlight', player: p }));
    const ownedCards = pool
      .filter((c) => owned[c.key])
      .sort((a, b) => {
        const da = displayWithKit(owned[a.key], state.display?.[a.key], a.player);
        const db = displayWithKit(owned[b.key], state.display?.[b.key], b.player);
        return tierRank(b.tier) - tierRank(a.tier) || finishRank(db.finish) - finishRank(da.finish);
      })
      .slice(0, 40);
    const cardScenes = shuffle(ownedCards).map((c): Scene => ({ kind: 'card', card: c }));
    const byClub = new Map<string, Player[]>();
    players.forEach((p) => {
      const c = clubOf(p)?.name;
      if (c) byClub.set(c, [...(byClub.get(c) ?? []), p]);
    });
    const lineups = shuffle([...byClub.entries()].filter(([, ps]) => ps.length >= 5)).map(([club, ps]): Scene => ({ kind: 'lineup', club, players: ps.slice(0, 5) }));
    const byKeyP = new Map(players.map((p) => [playerKey(p), p]));
    const hofScenes = shuffle(hof?.members ?? [])
      .map((m) => ({ m, p: byKeyP.get(m.key) }))
      .filter((x): x is { m: (typeof x)['m']; p: Player } => !!x.p)
      .map(({ m, p }): Scene => ({ kind: 'hof', player: p, label: m.class }));
    const rafters = shuffle(clubsWithRafters.filter((t) => bannersFor(t.id).length >= 2)).map((t): Scene => ({ kind: 'rafters', club: t.name }));
    const decks = [spot, cardScenes, lineups, hofScenes, rafters].filter((d) => d.length);
    const out: Scene[] = [];
    for (let i = 0; out.length < 60 && decks.some((d) => i < d.length); i++) decks.forEach((d) => d[i] && out.push(d[i]));
    return out;
    // the playlist is dealt once a run; later collection or rafters changes wait for the next run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, hof, pool.length]);

  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    if (scenes.length < 2) return;
    const t = window.setTimeout(() => {
      setPrev(idx);
      setIdx((i) => (i + 1) % scenes.length);
    }, SCENE_MS);
    return () => window.clearTimeout(t);
  }, [idx, scenes.length]);
  useEffect(() => {
    if (prev === null) return;
    const t = window.setTimeout(() => setPrev(null), FADE_MS);
    return () => window.clearTimeout(t);
  }, [prev]);
  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 4_000);
    return () => window.clearTimeout(t);
  }, []);

  // Exit on any key, click, wheel or a real mouse move; the click that ends it never reaches the page beneath
  const exit = useCallback(() => {
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 500);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  }, [onClose]);

  useEffect(() => {
    const started = Date.now();
    let origin: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (Date.now() - started < 900) return;
      if (!origin) {
        origin = { x: e.clientX, y: e.clientY };
        return;
      }
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MOVE_EXIT_PX) exit();
    };
    const onDown = (e: Event) => {
      if (Date.now() - started < 400) return;
      e.preventDefault();
      e.stopPropagation();
      exit();
    };
    const onKey = (e: KeyboardEvent) => {
      if (Date.now() - started < 400) return;
      e.preventDefault();
      e.stopPropagation();
      exit();
    };
    window.addEventListener('pointermove', onMove, { capture: true });
    window.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('wheel', onDown, { capture: true, passive: false });
    window.addEventListener('keydown', onKey, { capture: true });
    // leaving full screen with Esc (the browser eats that key) ends it too
    const onFs = () => !document.fullscreenElement && Date.now() - started > 1000 && exit();
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('pointermove', onMove, { capture: true });
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('wheel', onDown, { capture: true });
      window.removeEventListener('keydown', onKey, { capture: true });
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [exit]);

  // Full screen when the browser allows it (the header button's click), and keep the display awake
  useEffect(() => {
    rootRef.current?.requestFullscreen?.().catch(() => {});
    let lock: { release: () => Promise<void> } | null = null;
    const wake = async () => {
      try {
        lock = (await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
      } catch {
        lock = null;
      }
    };
    void wake();
    const onVis = () => document.visibilityState === 'visible' && void wake();
    document.addEventListener('visibilitychange', onVis);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
      document.documentElement.style.overflow = prevOverflow;
    };
  }, []);

  const render = (s: Scene) => {
    switch (s.kind) {
      case 'spotlight':
        return <SpotlightScene player={s.player} rank={rankOf.get(playerKey(s.player)) ?? 0} number={numberFor(s.player)} ovr={ovrMap.get(playerKey(s.player)) ?? null} sprites={sprites} />;
      case 'card':
        return byKey.get(s.card.key) ? <CardScene card={s.card} owned={owned} display={state.display} /> : null;
      case 'lineup':
        return <LineupScene club={s.club} players={s.players} sprites={sprites} />;
      case 'hof':
        return <HofScene player={s.player} label={s.label} sprites={sprites} />;
      case 'rafters':
        return <RaftersSceneSlide club={s.club} />;
    }
  };

  const shown = [prev, idx].filter((i): i is number => i !== null && !!scenes[i]);

  return (
    <div ref={rootRef} className={`sv ${lite ? 'sv--lite' : ''}`} role="dialog" aria-modal="true" aria-label="Screensaver: press any key to return">
      {shown.map((i) => (
        <div key={`${i}-${scenes[i].kind}`} className={i === idx ? 'sv-slide sv-slide--in' : 'sv-slide sv-slide--out'} style={{ '--sv-dur': `${SCENE_MS}ms` } as CSSProperties}>
          {render(scenes[i])}
        </div>
      ))}
      <span className="sv-dust" aria-hidden="true" />
      <span className="sv-dust sv-dust--far" aria-hidden="true" />
      <span className="sv-grain" aria-hidden="true" />
      {!scenes.length && (
        <div className="sv-empty">
          <BrandGlyph size={96} />
        </div>
      )}
      <div className="sv-chrome" aria-hidden="true">
        <span className="sv-brand">
          <BrandGlyph size={28} />
          Retro <b>Vault</b>
        </span>
        <Clock />
        <span key={idx} className="sv-progress" style={{ '--sv-dur': `${SCENE_MS}ms` } as CSSProperties} />
      </div>
      <p className={hint ? 'sv-hint' : 'sv-hint sv-hint--gone'}>Move the mouse or press any key to return</p>
    </div>
  );
};

export default Screensaver;
