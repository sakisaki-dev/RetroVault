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
import { useGameSprites, type SpriteAction } from '@/utils/gameSprites';
import { useLeagueContent, type SuperBowlEntry, type SeasonStoryIndexEntry, type HotTakesIndexEntry } from '@/utils/leagueContent';
import { useClubRecords, entryName, type ClubRecordRow } from '@/components/stats/clubRecords';
import { useHallOfFame } from '@/utils/hallOfFame';
import { useRafters } from '@/utils/rafters';
import { useCollection } from '@/utils/collection';
import { usePerfMode } from '@/hooks/usePerfMode';
import { useLiveSeason } from '@/utils/seasonLive';
import { fetchSaverWeather, useSaverPlace, weatherKind, type SaverWeather } from '@/utils/screensaver';
import { Flame, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Moon, Sun } from 'lucide-react';
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
  | { kind: 'spotlight'; player: Player; roll: number }
  | { kind: 'card'; card: CardInfo }
  | { kind: 'lineup'; club: string; players: Player[]; roll: number }
  | { kind: 'hof'; player: Player; label: string }
  | { kind: 'rafters'; club: string }
  | { kind: 'duel'; a: Player; b: Player; pos: string }
  | { kind: 'champs'; bowl: SuperBowlEntry }
  | { kind: 'paper'; story: SeasonStoryIndexEntry; takes: HotTakesIndexEntry | null }
  | { kind: 'record'; row: ClubRecordRow; holder: Player };

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

/** Falling bits (confetti, snowflakes), each with its own place, size, speed and drift: no visible grid */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const Particles = ({ kind, count, colors }: { kind: 'confetti' | 'snow'; count: number; colors: string[] }) => (
  <span className={`sv-parts sv-parts--${kind}`} aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <i
        key={i}
        style={
          {
            left: `${hash(i + 1) * 100}%`,
            '--d': `${-hash(i + 7) * 20}s`,
            '--t': `${(kind === 'snow' ? 14 : 8) + hash(i + 13) * (kind === 'snow' ? 14 : 8)}s`,
            '--s': `${(kind === 'snow' ? 2 : 5) + hash(i + 29) * (kind === 'snow' ? 4 : 6)}px`,
            '--x': `${(hash(i + 41) - 0.5) * 160}px`,
            '--r': `${hash(i + 53) * 720 - 360}deg`,
            '--c': colors[i % colors.length],
            opacity: 0.45 + hash(i + 67) * 0.55,
          } as CSSProperties
        }
      />
    ))}
  </span>
);

type Look = 'day' | 'dusk' | 'night' | 'snow' | 'dome';

/**
 * The club's own ground, from its stadium in the save: a covered stadium is a dome, one where it snows is sometimes
 * a snow game, the rest a day, dusk or night game (the scene's roll picks)
 */
const lookFor = (club: string, roll: number, live: ReturnType<typeof useLiveSeason>): Look => {
  const c = live?.clubs?.[club];
  if ((c?.roof ?? 0) > 0) return 'dome';
  if ((c?.snowfall ?? 0) >= 50 && roll < 0.45) return 'snow';
  return roll < 0.3 ? 'day' : roll < 0.55 ? 'dusk' : 'night';
};

/** The stadium behind a scene: the game's stands, crowd and turf painted to the club, its logo at midfield, its pennants */
const Stadium = ({ club, roll, children, className }: { club: string; roll: number; children: ReactNode; className?: string }) => {
  const live = useLiveSeason();
  const look = lookFor(club, roll, live);
  const art = useFieldArt(club, look === 'day' || look === 'dusk' ? 'day' : look === 'snow' ? 'snow' : 'night');
  const t = findNFLTeam(club);
  const style = {
    ...(t ? { '--sv-1': `hsl(${t.primaryColor})`, '--sv-2': `hsl(${t.secondaryColor})` } : {}),
    ...(art.stands ? { '--sv-stands': `url(${art.stands})` } : {}),
    ...(art.crowd ? { '--sv-crowd': `url(${art.crowd})` } : {}),
    ...(art.turf ? { '--sv-turf': `url(${art.turf})` } : {}),
  } as CSSProperties;
  return (
    <div className={`sv-stadium sv-stadium--${look} ${art.turf ? 'sv-stadium--art' : ''} ${className ?? ''}`} style={style}>
      <span className="sv-stadium__sky" aria-hidden="true" />
      <span className="sv-stadium__word" aria-hidden="true">
        {t?.fullName ?? club}
      </span>
      <span className="sv-stadium__lights" aria-hidden="true" />
      <span className="sv-stadium__roof" aria-hidden="true" />
      <span className="sv-stadium__stands" aria-hidden="true" />
      <span className="sv-stadium__pennants" aria-hidden="true" />
      <span className="sv-stadium__crowd" aria-hidden="true" />
      <span className="sv-stadium__turf" aria-hidden="true" />
      <span className="sv-stadium__mid" aria-hidden="true">
        <TeamLogo team={club} size={260} decorative />
      </span>
      <span className="sv-stadium__wash" aria-hidden="true" />
      {look === 'snow' && <Particles kind="snow" count={90} colors={['#ffffff']} />}
      {children}
    </div>
  );
};

const Figure = ({ player, sprites, action = 'idle', scale = 1, mirror = false }: { player: Player; sprites: boolean; action?: SpriteAction; scale?: number; mirror?: boolean }) => (
  <span className={mirror ? 'sv-fig sv-fig--mirror' : 'sv-fig'} style={{ '--sv-scale': scale } as CSSProperties}>
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

const SpotlightScene = ({ player, roll, rank, number, ovr, sprites }: { player: Player; roll: number; rank: number; number: number | null; ovr: number | null; sprites: boolean }) => {
  const t = clubOf(player);
  return (
    <Stadium club={t?.name ?? 'Eagles'} roll={roll}>
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

const LineupScene = ({ club, players, roll, sprites }: { club: string; players: Player[]; roll: number; sprites: boolean }) => {
  const t = findNFLTeam(club);
  // the best in the middle, the rest fanning out
  const order: Player[] = [];
  players.forEach((p, i) => (i % 2 ? order.push(p) : order.unshift(p)));
  return (
    <Stadium club={club} roll={roll}>
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
      {t && (
        <>
          <span className="sv-drape sv-drape--l" aria-hidden="true">
            <TeamLogo team={t.name} size={96} decorative />
          </span>
          <span className="sv-drape sv-drape--r" aria-hidden="true">
            <TeamLogo team={t.name} size={96} decorative />
          </span>
        </>
      )}
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
  const style = (t ? { '--sv-1': `hsl(${t.primaryColor})`, '--sv-2': `hsl(${t.secondaryColor})` } : {}) as CSSProperties;
  return (
    <div className="sv-rafters" style={style}>
      <span className="sv-rafters__logo" aria-hidden="true">
        <TeamLogo team={club} size={520} decorative />
      </span>
      <div className="sv-rafters__frame">
        <RaftersScene team={t} banners={bannersFor(club)} ring={ringFor(t)} headingId="sv-rafters-title" />
      </div>
    </div>
  );
};

/** Two of a position's greatest squared up: the debate, in their kits and their club colours */
const DuelScene = ({ a, b, pos, sprites }: { a: Player; b: Player; pos: string; sprites: boolean }) => {
  const side = (p: Player, right: boolean) => {
    const t = clubOf(p);
    return (
      <div className={right ? 'sv-duel__side sv-duel__side--r' : 'sv-duel__side'} style={clubStyle(p)}>
        <span className="sv-duel__logo" aria-hidden="true">
          {t && <TeamLogo team={t.name} size={300} decorative />}
        </span>
        <Figure player={p} sprites={sprites} scale={1.7} mirror={right} />
        <div className="sv-duel__card">
          <h3 className="sv-duel__name">{p.name}</h3>
          <p className="sv-duel__club">{t?.fullName ?? p.team}</p>
          <dl className="sv-duel__nums">
            {[...bannerStats(p), { label: 'Career Legacy', value: Math.round(p.careerLegacy) }].map((x) => (
              <div key={x.label}>
                <dd>{fmt(Number(x.value))}</dd>
                <dt>{x.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    );
  };
  return (
    <div className="sv-duel" style={{ '--a': clubStyle(a)['--cs-1' as keyof CSSProperties], '--b': clubStyle(b)['--cs-1' as keyof CSSProperties] } as CSSProperties}>
      {side(a, false)}
      <div className="sv-duel__mid">
        <p className="sv-kick">The greatest {pos}</p>
        <span className="sv-duel__vs">VS</span>
      </div>
      {side(b, true)}
    </div>
  );
};

/** A Super Bowl: the champion's logo in gold light, the score, confetti in its colours */
const ChampsScene = ({ bowl }: { bowl: SuperBowlEntry }) => {
  const w = findNFLTeam(bowl.winner ?? '');
  const l = findNFLTeam(bowl.loser ?? '');
  const style = (w ? { '--sv-1': `hsl(${w.primaryColor})`, '--sv-2': `hsl(${w.secondaryColor})` } : {}) as CSSProperties;
  return (
    <div className="sv-champs" style={style}>
      <span className="sv-champs__rays" aria-hidden="true" />
      <Particles kind="confetti" count={80} colors={[w ? `hsl(${w.primaryColor})` : '#ffc63e', w ? `hsl(${w.secondaryColor})` : '#ffffff', '#ffc63e', '#ffffff']} />
      <div className="sv-champs__body">
        <p className="sv-kick">Super Bowl {bowl.roman} · Y{bowl.year}</p>
        <div className="sv-champs__logo">{w && <TeamLogo team={w.name} size={300} decorative />}</div>
        <h2 className="sv-title">{w?.fullName ?? bowl.winner}</h2>
        <p className="sv-champs__score">
          <b>{bowl.score}</b>
          {l && (
            <span>
              over the <TeamLogo team={l.name} size={34} decorative /> {l.name}
            </span>
          )}
        </p>
        <p className="sv-sub sv-sub--dim">World champions</p>
      </div>
    </div>
  );
};

/** The league's paper: a season's story on a front page, its hot takes down the side */
const PaperScene = ({ story, takes }: { story: SeasonStoryIndexEntry; takes: HotTakesIndexEntry | null }) => {
  const rest = story.articles.filter((a) => a.id !== story.lead?.id && a.kind !== 'quickhits').slice(0, 4);
  return (
    <div className="sv-paper">
      <div className="sv-paper__sheet">
        <header className="sv-paper__mast">
          <span>Season {story.season}</span>
          <h2>The Retro Vault Times</h2>
          <span>League edition</span>
        </header>
        <p className="sv-paper__tag">{story.tagline}</p>
        <div className="sv-paper__grid">
          <div>
            <h3 className="sv-paper__lead">{story.lead?.headline ?? story.articles[0]?.headline}</h3>
            <ul className="sv-paper__more">
              {rest.map((a) => (
                <li key={a.id}>
                  <span>{a.kind === 'wherenow' ? 'Where now' : a.kind}</span>
                  {a.headline}
                </li>
              ))}
            </ul>
          </div>
          {takes && (
            <aside className="sv-paper__takes">
              <p>Hot takes</p>
              {takes.takes.slice(0, 4).map((t) => (
                <div key={t.id}>
                  <span className="sv-paper__heat" aria-label={`Heat ${t.heat}`}>
                    {Array.from({ length: t.heat }, (_, i) => (
                      <Flame key={i} aria-hidden="true" />
                    ))}
                  </span>
                  {t.headline}
                </div>
              ))}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

/** A league record and the man who holds it, stiff-arming the field, the mark on a dot-matrix board */
const RecordScene = ({ row, holder, sprites }: { row: ClubRecordRow; holder: Player; sprites: boolean }) => {
  const top = row.league?.top ?? [];
  const t = clubOf(holder);
  const gap = top[1] ? top[0].value - top[1].value : 0;
  return (
    <Stadium club={t?.name ?? 'Eagles'} roll={0.9}>
      <div className="sv-rec">
        <div className="sv-rec__board">
          <p className="sv-kick">League record · {row.scope === 'season' ? 'single season' : 'career'}</p>
          <h2 className="sv-rec__name">{row.record}</h2>
          <p className="sv-rec__mark">{row.league?.mark ?? fmt(top[0]?.value ?? 0)}</p>
          {top[1] && (
            <p className="sv-rec__gap">
              {fmt(gap)} clear of {entryName(top[1])}
            </p>
          )}
        </div>
        <div className="sv-rec__man" style={clubStyle(holder)}>
          <Figure player={holder} sprites={sprites} action="stiffarm" scale={1.6} />
          <span className="sv-line__name">{holder.name}</span>
        </div>
      </div>
    </Stadium>
  );
};

const WX_ICON = { clear: [Sun, Moon], cloud: [Cloud, Cloud], fog: [CloudFog, CloudFog], rain: [CloudRain, CloudRain], snow: [CloudSnow, CloudSnow], storm: [CloudLightning, CloudLightning] } as const;

/** The corner: the time, the date, the town and its weather (when the location is shared from the menu) */
const Corner = ({ onWeather }: { onWeather: (fx: ReturnType<typeof weatherKind>['fx'] | null) => void }) => {
  const [now, setNow] = useState(() => new Date());
  const place = useSaverPlace();
  const [wx, setWx] = useState<SaverWeather | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!place) return;
    let live = true;
    const load = () => fetchSaverWeather(place).then((w) => live && setWx(w));
    void load();
    const t = window.setInterval(load, 20 * 60_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [place]);
  const kind = wx ? weatherKind(wx.code) : null;
  useEffect(() => onWeather(kind?.fx ?? null), [kind?.fx, onWeather]);
  const Icon = kind ? WX_ICON[kind.fx][kind.fx === 'clear' && wx && !wx.day ? 1 : 0] : null;
  const deg = place?.unit === 'fahrenheit' ? '°F' : '°C';
  return (
    <div className="sv-corner">
      <span className="sv-corner__time">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
      <span className="sv-corner__date">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>
      {place && (
        <span className="sv-corner__wx">
          {Icon && <Icon className="sv-corner__icon" aria-hidden="true" />}
          {wx && (
            <b>
              {wx.temp}
              {deg}
            </b>
          )}
          <span>
            {[kind?.label, place.city].filter(Boolean).join(' · ')}
            {wx ? ` · H ${wx.hi}° L ${wx.lo}°` : ''}
          </span>
        </span>
      )}
    </div>
  );
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
  const { content } = useLeagueContent();
  const records = useClubRecords();
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
    const spot = shuffle(players.slice(0, 80)).map((p): Scene => ({ kind: 'spotlight', player: p, roll: Math.random() }));
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
    const lineups = shuffle([...byClub.entries()].filter(([, ps]) => ps.length >= 5)).map(([club, ps]): Scene => ({ kind: 'lineup', club, players: ps.slice(0, 5), roll: Math.random() }));
    const byKeyP = new Map(players.map((p) => [playerKey(p), p]));
    const hofScenes = shuffle(hof?.members ?? [])
      .map((m) => ({ m, p: byKeyP.get(m.key) }))
      .filter((x): x is { m: (typeof x)['m']; p: Player } => !!x.p)
      .map(({ m, p }): Scene => ({ kind: 'hof', player: p, label: m.class }));
    const rafters = shuffle(clubsWithRafters.filter((t) => bannersFor(t.id).length >= 2)).map((t): Scene => ({ kind: 'rafters', club: t.name }));
    const POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
    const duels = shuffle(POS)
      .map((pos): Scene | null => {
        const top = players.filter((p) => p.position === pos).slice(0, 2);
        return top.length === 2 ? { kind: 'duel', a: top[0], b: top[1], pos } : null;
      })
      .filter((x): x is Scene => !!x);
    const champs = shuffle((content?.superBowls ?? []).filter((b) => b.winner && b.score && findNFLTeam(b.winner))).map((bowl): Scene => ({ kind: 'champs', bowl }));
    const papers = shuffle(content?.seasonStoryIndex ?? []).map(
      (story): Scene => ({ kind: 'paper', story, takes: content?.hotTakesIndex?.find((t) => t.season === story.season) ?? null }),
    );
    const recs = shuffle(
      (records?.records ?? [])
        .filter((r) => (r.scope === 'career' || r.scope === 'season') && r.league?.top?.[0])
        .map((row) => {
          const e = row.league!.top[0];
          const holder = byKeyP.get(`${e.pos}:${entryName(e)}`);
          return holder ? ({ kind: 'record', row, holder } as Scene) : null;
        })
        .filter((x): x is Scene => !!x),
    );
    const decks = [spot, cardScenes, duels, lineups, champs, hofScenes, recs, papers, rafters].filter((d) => d.length);
    const out: Scene[] = [];
    for (let i = 0; out.length < 60 && decks.some((d) => i < d.length); i++) decks.forEach((d) => d[i] && out.push(d[i]));
    return out;
    // the playlist is dealt once a run; later collection or rafters changes wait for the next run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, hof, pool.length, content, records]);

  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [hint, setHint] = useState(true);
  const [fx, setFx] = useState<ReturnType<typeof weatherKind>['fx'] | null>(null);

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
        return <SpotlightScene player={s.player} roll={s.roll} rank={rankOf.get(playerKey(s.player)) ?? 0} number={numberFor(s.player)} ovr={ovrMap.get(playerKey(s.player)) ?? null} sprites={sprites} />;
      case 'card':
        return byKey.get(s.card.key) ? <CardScene card={s.card} owned={owned} display={state.display} /> : null;
      case 'lineup':
        return <LineupScene club={s.club} players={s.players} roll={s.roll} sprites={sprites} />;
      case 'hof':
        return <HofScene player={s.player} label={s.label} sprites={sprites} />;
      case 'rafters':
        return <RaftersSceneSlide club={s.club} />;
      case 'duel':
        return <DuelScene a={s.a} b={s.b} pos={s.pos} sprites={sprites} />;
      case 'champs':
        return <ChampsScene bowl={s.bowl} />;
      case 'paper':
        return <PaperScene story={s.story} takes={s.takes} />;
      case 'record':
        return <RecordScene row={s.row} holder={s.holder} sprites={sprites} />;
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
      {fx && fx !== 'clear' && fx !== 'cloud' && <span className={`sv-weather sv-weather--${fx}`} aria-hidden="true" />}
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
        <Corner onWeather={setFx} />
        <span key={idx} className="sv-progress" style={{ '--sv-dur': `${SCENE_MS}ms` } as CSSProperties} />
      </div>
      <p className={hint ? 'sv-hint' : 'sv-hint sv-hint--gone'}>Move the mouse or press any key to return</p>
    </div>
  );
};

export default Screensaver;
