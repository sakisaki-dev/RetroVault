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
import { isLite, usePerfMode } from '@/hooks/usePerfMode';
import { useLiveSeason } from '@/utils/seasonLive';
import { useMarket } from '@/utils/useMarket';
import { fetchSaverWeather, isNightRest, useSaverFx, useSaverNight, useSaverPlace, useSaverSleep, weatherKind, windForce, windLabel, type SaverWeather } from '@/utils/screensaver';
import { Music, Flame, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Moon, Sun } from 'lucide-react';
import { useFieldArt } from '@/components/teamlab/fieldArt';
import { useCardPool, type CardInfo } from '@/components/collection/useCardPool';
import { displayWithKit } from '@/components/collection/kits';
import CollectibleCard from '@/components/collection/CollectibleCard';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import { BrandGlyph } from '@/components/brand/BrandMark';
import TeamLogo from '@/components/brand/TeamLogo';
import GameSprite from '@/components/GameSprite';
import CoachSprite from '@/components/CoachSprite';
import { useCurrentClub } from '@/utils/club';
import RaftersScene from '@/components/teams/RaftersScene';
import { bannerStats } from '@/components/hof/hofUtils';
import { clubStyle } from '@/components/stats/visual/clubTone';
import { stadiumWeather, pctText } from '@/utils/stadiumWeather';
import { useSeasonRewind } from '@/utils/seasonRewind';
import type { SeasonRewindIndexEntry } from '@/utils/leagueContent';
import { RewindCardView } from '@/components/rewind/RewindCards';
import { teamColor } from '@/components/frontoffice/shared';
import '@/components/rewind/rewind.css';
import { trackTimes, useNowPlaying, useSpotifyConnected, type NowPlaying } from '@/utils/spotify';
import { PixelCup } from '@/components/frontoffice/PixelCup';
import { busState, departures, hm, useBusSetting, useRoute } from '@/utils/bus';
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
  | { kind: 'record'; row: ClubRecordRow; holder: Player }
  | { kind: 'coach'; roll: number; stint: CoachStint | null }
  | { kind: 'rising'; items: { p: Player; line: string }[] }
  | { kind: 'farewell'; items: { p: Player; line: string }[] }
  | { kind: 'market'; title: string; rows: MarketRow[] }
  | { kind: 'dyk'; text: string; p: Player | null; club: string; roll: number }
  | { kind: 'chase'; p: Player; c: WidgetChase; roll: number }
  | { kind: 'gauntlet'; title: string; kick: string; entries: { p: Player; has: boolean[] }[] }
  | { kind: 'rivalry'; file: RivalryFileLite; a: Player | null; b: Player | null }
  | { kind: 'hofclass'; label: string; members: Player[] }
  | { kind: 'take'; take: WidgetTake; players: Player[] }
  | { kind: 'dynasty'; era: EraLite; players: Player[] }
  | { kind: 'flyover'; club: string; roll: number }
  | { kind: 'rewind'; entry: SeasonRewindIndexEntry; from: number }
  | { kind: 'trophies'; club: string; years: number[] }
  | { kind: 'stunt'; club: string }
  | { kind: 'pa' };

interface CoachStint { club: string; years: number[]; seasons: number; titles: number; w: number; l: number; t: number }
/** Seasons as spans: [34, 35, 71, 72] → "Y34–35, Y71–72" */
const spans = (years: number[]) => {
  const ys = [...years].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < ys.length; i++) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
    out.push(j > i ? `Y${ys[i]}–${ys[j]}` : `Y${ys[i]}`);
    i = j;
  }
  return out.join(', ');
};
interface MarketRow { p: Player; text: string; up: boolean | null }

/* The slices of widget.json and content.json the new scenes read (every field optional in the files) */
interface WidgetChase { player: string; stat: string; unit: string; have: number; mark: number; toGo: number; pct: number; holder: string; team: string }
interface WidgetTake { id: string; headline: string; dek?: string; heat: number; team?: string; players?: { player: string }[] }
interface WidgetFeed {
  coachTitles?: number;
  liveSeason?: string;
  ceilings?: { player: string; age: number; stars: number; ceiling: number }[];
  retirements?: { player: string; age: number; seasonsLeft: number }[];
  movers?: { key: string; pct: number }[];
  didYouKnow?: { text: string; player?: string; team?: string }[];
  chases?: WidgetChase[];
  gauntlet?: { holders?: { player: string }[]; closest?: { player: string; missing: string[] } };
  takes?: WidgetTake[];
}
interface RivalryFileLite {
  team: string;
  coachTeam: string;
  status: string;
  first: string;
  last: string;
  games: number;
  record: { text: string };
  streak?: { team: string; games: number };
  stars?: { coach?: { key: string }; rival?: { key: string } };
}
interface EraLite { name: string; startYear: number; endYear: number; superBowlRange?: string; yourTeams: string[]; keyPlayers: string[]; notes?: string }

let widgetReq: Promise<WidgetFeed | null> | null = null;
/** undefined while loading, null when the feed can't be read */
const useWidgetFeed = () => {
  const [w, setW] = useState<WidgetFeed | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    widgetReq ??= fetch(`${import.meta.env.BASE_URL}data/widget.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    widgetReq.then((x) => live && setW(x));
    return () => {
      live = false;
    };
  }, []);
  return w;
};

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

/** The surfaces snow settles on and rain bounces off (WeatherCanvas) */
const SNOW_SURFACES = [
  '.sv-spot__banner',
  '.sv-duel__card',
  '.sv-hall__plaque',
  '.sv-tro__svg',
  '.sv-troom__shelf',
  '.sv-rec__board',
  '.sv-market__board',
  '.sv-pa__board',
  '.sv-paper__sheet',
  '.sv-rw__phone',
  '.sv-stunt__stand',
  '.sv-fly__cap',
].join(',');
/** Where a surface really meets falling snow or rain, in viewport px: its box's top edge, except where the drawn
 * object sits inside transparent space (owner: "the transparent border for their assets isn't the actual point at
 * which they contact"): a pixel cup is touched at its rim (row 0 of its 18 × 28 grid, columns 4 to 14), a trophy
 * shelf at the top of its wooden board (the bottom 14 px) */
const contactLedge = (el: Element): { x: number; y: number; w: number } | null => {
  const r = el.getBoundingClientRect();
  if (r.width < 24) return null;
  // a rounded top corner (the element's own, or the card drawn inside it) holds no snow: the ledge starts where it's flat
  const radius = (e: Element | null) => {
    if (!e) return 0;
    const cs = getComputedStyle(e);
    return Math.max(parseFloat(cs.borderTopLeftRadius) || 0, parseFloat(cs.borderTopRightRadius) || 0);
  };
  const round = Math.min(r.width / 4, Math.max(radius(el), radius(el.firstElementChild)));
  if (el.classList.contains('sv-tro__svg')) return { x: r.left + (r.width * 4) / 18, y: r.top, w: (r.width * 10) / 18 };
  if (el.classList.contains('sv-troom__shelf')) return { x: r.left, y: r.bottom - 14, w: r.width };
  return { x: r.left + round, y: r.top, w: r.width - round * 2 };
};
/**
 * Rain (owner, 2026-11-18: "keep the rain that we had previously … the rain is making everything super slow"): one streak
 * per drop moved by CSS transform only (composited, no canvas, no splashes), each with its own lane, speed, length and
 * depth, leaning with the wind (--sv-wind)
 */
const Rain = () => (
  <>
    {Array.from({ length: 110 }, (_, i) => {
      const z = hash(i + 101); // 0 far … 1 near
      return (
        <i
          key={i}
          style={
            {
              left: `${hash(i + 3) * 115 - 5}%`,
              '--d': `${-hash(i + 17) * 3}s`,
              '--t': `${0.95 - z * 0.45}s`,
              '--l': `${40 + z * 70}px`,
              '--w': `${z > 0.75 ? 2 : 1}px`,
              opacity: 0.25 + z * 0.55,
            } as CSSProperties
          }
        />
      );
    })}
  </>
);

/**
 * Rain and snow as particles with physics (owner, 2026-11-18: "the snow kinda looks really mid … look online for snow
 * effects and physics", then "do the same particle physics for rain, don't let it collect but let it bounce off of the
 * cards, trophies etc"). One canvas; each drop or flake has a depth (near: bigger, faster, brighter). Real fall speeds
 * set the scale (snow 0.5–2 m/s, rain 5–9 m/s, about seven times faster): rain leans with the wind and, where it meets
 * the top of a card, banner, board or shelf (the same surfaces snow settles on) or the turf, bursts into droplets that
 * bounce off and fade; snow flutters and drifts in gusts and settles on those surfaces and the ground, melting into the
 * caps and drifts. The surfaces are re-read every half second, so a floating banner keeps its edge.
 */
interface Drop { x: number; y: number; z: number; v: number; len: number }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number }
interface Flake { x: number; y: number; z: number; r: number; v: number; ph: number; fq: number; amp: number; rest: number }
interface Ledge { x1: number; x2: number; y: number; h?: Float32Array; grain?: Float32Array }
const WeatherCanvas = ({ kind, wind, scene, lite }: { kind: 'rain' | 'storm' | 'snow'; wind: number; scene: number; lite: boolean }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const ledges = useRef<Ledge[]>([]);
  const windRef = useRef(wind);
  windRef.current = wind;
  // pixels per CSS pixel: the screen's own density, or half a CSS pixel in lite mode (a TV's chip draws an eighth as many)
  const pxScale = lite ? 0.5 : devicePixelRatio || 1;
  const scaleRef = useRef(pxScale);
  scaleRef.current = pxScale;
  // the surfaces of the scene on screen (none for the first moments of a scene, while it rises in)
  const sceneChange = useRef(0);
  const dropped = useRef<Ledge[]>([]);
  useEffect(() => {
    sceneChange.current += 1;
    let t2 = 0;
    const read = () => {
      const dpr = scaleRef.current;
      const out: Ledge[] = [];
      document.querySelectorAll<HTMLElement>(SNOW_SURFACES.split(',').map((x) => `.sv-slide--in ${x}`).join(',')).forEach((el) => {
        // a surface fading out (a banner leaving at the end of its scene) holds no snow
        let op = 1;
        for (let e: HTMLElement | null = el; e && !e.classList.contains('sv-slide'); e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
        if (op < 0.5) return;
        const r = contactLedge(el);
        if (r && r.y > 10) out.push({ x1: r.x * dpr, x2: (r.x + r.w) * dpr, y: r.y * dpr });
      });
      // the same surfaces as last time (a floating banner moved a few px): keep what has piled up on them
      if (ledges.current.length === out.length) out.forEach((l, i) => ((l.h = ledges.current[i].h), (l.grain = ledges.current[i].grain)));
      else dropped.current.push(...ledges.current);
      ledges.current = out;
    };
    const t1 = window.setTimeout(() => {
      read();
      t2 = window.setInterval(read, 500);
    }, 1600);
    return () => {
      window.clearTimeout(t1);
      window.clearInterval(t2);
    };
  }, [scene]);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = scaleRef.current;
    let W = 0;
    let H = 0;
    const size = () => {
      W = cv.width = Math.round(innerWidth * dpr);
      H = cv.height = Math.round(innerHeight * dpr);
    };
    size();
    addEventListener('resize', size);
    const rnd = Math.random;
    const snow = kind === 'snow';
    const N = Math.round((snow ? 280 : kind === 'storm' ? 560 : 400) * (lite ? 0.35 : 1));
    // where a particle meets the field: nearer ones lower on the screen
    const groundY = (z: number) => H * (0.8 + 0.17 * z);
    const drops: Drop[] = [];
    const flakes: Flake[] = [];
    const bits: Bit[] = [];
    const spawnDrop = (d: Drop | null, anywhere: boolean): Drop => {
      const z = d?.z ?? rnd();
      const o = d ?? ({} as Drop);
      o.z = z;
      o.v = (620 + 520 * z + rnd() * 80) * dpr; // px/s
      o.len = (10 + 26 * z) * dpr;
      o.x = (rnd() * 1.3 - 0.05) * W;
      o.y = anywhere ? rnd() * H : -o.len - rnd() * H * 0.25;
      return o;
    };
    const spawnFlake = (f: Flake | null, anywhere: boolean): Flake => {
      const z = f?.z ?? rnd() ** 1.4; // more far flakes than near ones
      const o = f ?? ({} as Flake);
      o.z = z;
      o.r = (0.8 + 3.6 * z * z + rnd() * 0.6) * dpr;
      o.v = (28 + 82 * z + rnd() * 14) * dpr;
      o.ph = rnd() * Math.PI * 2;
      o.fq = 0.6 + rnd() * 1.4;
      o.amp = (8 + 22 * rnd()) * (0.4 + z) * dpr;
      o.x = (rnd() * 1.3 - 0.05) * W;
      o.y = anywhere ? rnd() * H : -10 * dpr - rnd() * H * 0.2;
      o.rest = 0;
      return o;
    };
    for (let i = 0; i < N; i++) {
      if (snow) flakes.push(spawnFlake(null, true));
      else drops.push(spawnDrop(null, true));
    }
    // a soft flake, drawn once and scaled: the near ones look out of focus
    const flakeImg = document.createElement('canvas');
    flakeImg.width = flakeImg.height = 32;
    const fg = flakeImg.getContext('2d')!;
    const grad = fg.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    fg.fillStyle = grad;
    fg.fillRect(0, 0, 32, 32);
    const splash = (x: number, y: number, z: number, vx: number) => {
      const n = 2 + Math.round(rnd() * 2 + z * 2);
      for (let k = 0; k < n && bits.length < 900; k++)
        bits.push({
          x,
          y: y - 1,
          vx: ((rnd() - 0.5) * 220 + vx * 0.15) * dpr,
          vy: -(90 + rnd() * 200) * (0.5 + z) * dpr,
          life: 0,
          max: 0.25 + rnd() * 0.25,
          r: (0.6 + z * 1.2) * dpr,
        });
    };
    // what has piled up, as a height profile along each surface and along the ground (one bin every 3 px)
    const BIN = 3 * dpr;
    const heights = (l: Ledge) => (l.h ??= new Float32Array(Math.max(2, Math.ceil((l.x2 - l.x1) / BIN))));
    const topAt = (l: Ledge, x: number) => (snow ? l.y - (heights(l)[Math.min(heights(l).length - 1, Math.max(0, Math.floor((x - l.x1) / BIN)))] || 0) : l.y);
    const hit = (x: number, y0: number, y1: number): Ledge | null => {
      for (const l of ledges.current) {
        if (x < l.x1 || x > l.x2) continue;
        const top = topAt(l, x);
        if (y0 < top && y1 >= top) return l;
      }
      return null;
    };
    // the most a surface holds: a few px on a cup's rim, about 26 px along a banner; less towards the ends
    // each surface's own unevenness: drifts and dips at several scales, fixed for that surface
    const grainOf = (l: Ledge) => {
      if (l.grain) return l.grain;
      const n = heights(l).length;
      const g = new Float32Array(n);
      const p = [rnd() * 9, rnd() * 9, rnd() * 9];
      for (let i = 0; i < n; i++) {
        const x = i / n;
        g[i] = Math.max(0.15, 0.62 + 0.22 * Math.sin(x * 5.3 + p[0]) + 0.14 * Math.sin(x * 13.7 + p[1]) + 0.1 * Math.sin(x * 31 + p[2]) + (rnd() - 0.5) * 0.12);
      }
      return (l.grain = g);
    };
    const capMax = (l: Ledge, i: number, n: number) => {
      const full = Math.min(18 * dpr, (l.x2 - l.x1) * 0.09);
      const edge = Math.min(i, n - 1 - i) * BIN;
      // rounded ends: snow slumps off the corners
      const e = Math.min(1, edge / (8 * dpr));
      return full * Math.sqrt(1 - (1 - e) * (1 - e)) * grainOf(l)[i];
    };
    const deposit = (l: Ledge, x: number, amount: number) => {
      const h = heights(l);
      const n = h.length;
      const c = Math.floor((x - l.x1) / BIN);
      for (let k = -4; k <= 4; k++) {
        const i = c + k;
        if (i < 0 || i >= n) continue;
        h[i] = Math.min(capMax(l, i, n), h[i] + amount * Math.exp(-(k * k) / 5));
      }
    };
    const ground = new Float32Array(Math.ceil(W / (6 * dpr)) + 2);
    const groundSeed = [rnd() * 6, rnd() * 6, rnd() * 6];
    const groundMax = (i: number) => {
      const x = i / ground.length;
      // banks and hollows, not a flat band
      const n = 0.5 + 0.3 * Math.sin(x * 5.1 + groundSeed[0]) + 0.16 * Math.sin(x * 13.3 + groundSeed[1]) + 0.07 * Math.sin(x * 37 + groundSeed[2]) + 0.03 * Math.sin(x * 97 + groundSeed[1]);
      return H * 0.065 * Math.max(0.12, n);
    };
    const chunks: { x: number; y: number; vx: number; vy: number; r: number; life: number }[] = [];
    let seenChange = sceneChange.current;
    let sinking = 0;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const w = windRef.current;
      ctx.clearRect(0, 0, W, H);
      if (!snow) {
        ctx.lineCap = 'round';
        for (const d of drops) {
          const vx = -(70 + w * 620) * (0.55 + 0.45 * d.z) * dpr;
          const y0 = d.y;
          d.x += vx * dt;
          d.y += d.v * dt;
          // near drops strike the surfaces; every drop ends on the field
          const l = d.z > 0.3 ? hit(d.x, y0, d.y) : null;
          if (l) {
            splash(d.x, l.y, d.z, vx);
            spawnDrop(d, false);
            continue;
          }
          if (d.y >= groundY(d.z)) {
            if (d.z > 0.35 && rnd() < 0.7) splash(d.x, groundY(d.z), d.z * 0.7, vx);
            spawnDrop(d, false);
            continue;
          }
          const k = d.len / d.v;
          ctx.strokeStyle = `rgba(200,218,255,${0.18 + 0.5 * d.z})`;
          ctx.lineWidth = (0.6 + 1.3 * d.z) * dpr;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - vx * k, d.y - d.len);
          ctx.stroke();
        }
      } else {
        for (const f of flakes) {
          if (f.rest > 0) {
            // settled: melts into the cap or the drift
            f.rest -= dt;
            if (f.rest <= 0) spawnFlake(f, false);
            else {
              ctx.globalAlpha = Math.min(1, f.rest / 2) * (0.5 + 0.5 * f.z);
              ctx.drawImage(flakeImg, f.x - f.r * 1.4, f.y - f.r * 1.4, f.r * 2.8, f.r * 2.8);
            }
            continue;
          }
          const gust = (Math.sin(t * 0.37 + f.y * 0.003) * 14 + Math.sin(t * 0.11 + f.ph) * (10 + 40 * w)) * dpr;
          const vx = -(12 + w * 210) * (0.5 + 0.5 * f.z) * dpr + gust + Math.cos(t * f.fq + f.ph) * f.amp;
          const y0 = f.y;
          f.x += vx * dt;
          f.y += f.v * dt;
          const l = f.z > 0.35 ? hit(f.x, y0, f.y) : null;
          if (l) {
            // it lands and becomes part of the pile
            deposit(l, f.x, f.r * 0.55);
            spawnFlake(f, false);
            continue;
          }
          const gi = Math.floor(f.x / (6 * dpr));
          if (f.z > 0.7 && gi >= 0 && gi < ground.length && f.y >= H - ground[gi] - 2 * dpr) {
            for (let k = -3; k <= 3; k++) {
              const i = gi + k;
              if (i >= 0 && i < ground.length) ground[i] = Math.min(groundMax(i), ground[i] + f.r * 0.5 * Math.exp(-(k * k) / 4));
            }
            spawnFlake(f, false);
            continue;
          }
          if (f.y >= groundY(f.z)) {
            f.y = groundY(f.z);
            f.rest = 1.5 + rnd() * 2.5;
          }
          if (f.x < -0.1 * W) f.x += 1.2 * W;
          ctx.globalAlpha = 0.3 + 0.65 * f.z;
          const s = f.r * (f.z > 0.75 ? 3.2 : 2.4);
          ctx.drawImage(flakeImg, f.x - s / 2, f.y - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        // a new scene: what piled up on the old one breaks into clumps that slide off and fall; the drift sinks away
        const breakOff = (list: Ledge[]) => {
          for (const l of list) {
            const h = l.h;
            if (!h) continue;
            for (let i = 0; i < h.length; i += 4)
              if (h[i] > 1.5 * dpr && chunks.length < 700)
                chunks.push({ x: l.x1 + i * BIN, y: l.y - h[i] / 2, vx: (rnd() - 0.5) * 60 * dpr - w * 80 * dpr, vy: rnd() * 40 * dpr, r: Math.max(2 * dpr, h[i] * (0.6 + rnd() * 0.5)), life: 0 });
          }
        };
        if (dropped.current.length) {
          breakOff(dropped.current);
          dropped.current = [];
        }
        if (seenChange !== sceneChange.current) {
          seenChange = sceneChange.current;
          for (const l of ledges.current) {
            const h = l.h;
            if (!h) continue;
            for (let i = 0; i < h.length; i += 4)
              if (h[i] > 1.5 * dpr && chunks.length < 700)
                chunks.push({ x: l.x1 + i * BIN, y: l.y - h[i] / 2, vx: (rnd() - 0.5) * 60 * dpr - w * 80 * dpr, vy: rnd() * 40 * dpr, r: Math.max(2 * dpr, h[i] * (0.6 + rnd() * 0.5)), life: 0 });
          }
          ledges.current = [];
          sinking = 1;
        }
        if (sinking > 0) {
          sinking = Math.max(0, sinking - dt / 1.2);
          for (let i = 0; i < ground.length; i++) ground[i] *= 1 - dt * 3.5;
        }
        // the fine snow too small to see adds to every pile a little all the time, unevenly
        const fine = dt / 13;
        for (const l of ledges.current) {
          const h = heights(l);
          const n = h.length;
          for (let i = 0; i < n; i++) h[i] = Math.min(capMax(l, i, n), h[i] + capMax(l, i, n) * fine * (0.4 + 1.2 * rnd()));
          // snow slumps a little into soft mounds
          for (let i = 1; i < n - 1; i++) h[i] = h[i] * 0.98 + (h[i - 1] + h[i + 1]) * 0.01;
        }
        if (!sinking) for (let i = 0; i < ground.length; i++) ground[i] = Math.min(groundMax(i), ground[i] + groundMax(i) * fine * 0.9);
        for (let i = 1; i < ground.length - 1; i++) ground[i] = ground[i] * 0.9 + (ground[i - 1] + ground[i + 1]) * 0.05;
        // draw the piles: white on top, a cool blue-grey shadow under, a bright rim of light
        const pile = (x0: number, base: number, h: Float32Array, step: number, top: number) => {
          const g = ctx.createLinearGradient(0, base - top, 0, base);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.55, '#eef3fb');
          g.addColorStop(1, '#c9d6ea');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x0, base);
          for (let i = 0; i < h.length; i++) {
            const x = x0 + i * step;
            const nx = x0 + (i + 1) * step;
            const y = base - h[i];
            const ny = base - (h[i + 1] ?? h[i]);
            ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
          }
          ctx.lineTo(x0 + (h.length - 1) * step, base);
          ctx.closePath();
          ctx.shadowColor = 'rgba(160,185,225,0.55)';
          ctx.shadowBlur = lite ? 0 : 6 * dpr;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 0.8 * dpr;
          ctx.stroke();
          // a few crystals catching the light
          ctx.fillStyle = '#ffffff';
          for (let i = 3; i < h.length; i += 11) {
            if (h[i] < 3 * dpr || Math.sin(t * 1.3 + i * 7.7) < 0.92) continue;
            ctx.fillRect(x0 + i * step, base - h[i] + 1.5 * dpr, 1.6 * dpr, 1.6 * dpr);
          }
        };
        for (const l of ledges.current) {
          const h = heights(l);
          let top = 0;
          for (const v of h) top = Math.max(top, v);
          if (top > 0.6 * dpr) {
            // a new cap fades in rather than starting as a hard line
            ctx.globalAlpha = Math.min(1, top / (5 * dpr));
            pile(l.x1, l.y, h, BIN, top);
            ctx.globalAlpha = 1;
          }
        }
        let gtop = 0;
        for (const v of ground) gtop = Math.max(gtop, v);
        if (gtop > 1) pile(0, H, ground, 6 * dpr, gtop);
        // clumps falling off a surface at the change of scene
        for (let i = chunks.length - 1; i >= 0; i--) {
          const c = chunks[i];
          c.life += dt;
          c.vy += 1300 * dpr * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          if (c.life > 1.4 || c.y > H) {
            chunks.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = Math.max(0, 1 - c.life / 1.4);
          ctx.drawImage(flakeImg, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
        }
        ctx.globalAlpha = 1;
      }
      // droplets bouncing off: gravity pulls them back down, they fade as they go
      ctx.fillStyle = 'rgba(210,225,255,0.9)';
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.life += dt;
        if (b.life >= b.max) {
          bits.splice(i, 1);
          continue;
        }
        b.vy += 1700 * dpr * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        ctx.globalAlpha = 1 - b.life / b.max;
        ctx.fillRect(b.x, b.y, b.r * 1.6, b.r * 1.6);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', size);
    };
  }, [kind, lite]);
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return <canvas ref={ref} className="sv-weather__canvas" aria-hidden="true" />;
};

/**
 * Where the stadium meets the sky (owner, 2026-11-18: "for the sky i think all of them look great, pick whichever one per
 * city that you feel"): downtown grounds see the city's skyline through fog beyond the rim, the great old bowls show
 * their far side curving round, a few big two-tier grounds a second deck receding, the rest a floodlight haze rising
 * off the rim. A dome has its roof instead.
 */
type Rim = 'city' | 'bowl' | 'deck' | 'haze';
const RIMS: Record<string, Rim> = {
  Bears: 'city', Steelers: 'city', Browns: 'city', Ravens: 'city', Bengals: 'city', Seahawks: 'city', Broncos: 'city',
  Titans: 'city', Panthers: 'city', Eagles: 'city', Jets: 'city', Giants: 'city',
  Chiefs: 'bowl', Packers: 'bowl', Bills: 'bowl', Patriots: 'bowl', Dolphins: 'bowl', Buccaneers: 'bowl', Jaguars: 'bowl',
  Commanders: 'deck', '49ers': 'deck',
};
const rimFor = (club: string): Rim => RIMS[findNFLTeam(club)?.name ?? club] ?? 'haze';

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

/** A club's name as a small chip: its logo, its name, edged in its own colours (readable on any background) */
const ClubTag = ({ team, label }: { team: string; label?: string }) => {
  const t = findNFLTeam(team);
  const style = (t ? { '--c1': `hsl(${t.primaryColor})`, '--c2': `hsl(${t.secondaryColor})` } : {}) as CSSProperties;
  return (
    <span className="sv-club" style={style}>
      <TeamLogo team={t?.name ?? team} size={18} decorative />
      <span>{label ?? t?.fullName ?? team}</span>
    </span>
  );
};

/** The stadium behind a scene: the game's stands, crowd and turf painted to the club, its logo at midfield, its pennants */
const Stadium = ({ club, roll, children, className }: { club: string; roll: number; children?: ReactNode; className?: string }) => {
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
      {look !== 'dome' && <span className={`sv-stadium__rim sv-stadium__rim--${rimFor(club)}`} aria-hidden="true" />}
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
          <p className="sv-duel__club">
            <ClubTag team={t?.name ?? p.team} />
          </p>
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


/** A row of players on the turf, each with a plate under his name */
const Row = ({ items, sprites, best = 0, action = 'idle' }: { items: { p: Player; line: string }[]; sprites: boolean; best?: number; action?: SpriteAction }) => (
  <ul className="sv-line__row">
    {items.map(({ p, line }, i) => (
      <li key={playerKey(p)} className={i === best ? 'sv-line__man sv-line__man--best' : 'sv-line__man'} style={{ ...clubStyle(p), '--i': i } as CSSProperties}>
        <Figure player={p} sprites={sprites} action={i === best ? 'celebrate' : action} scale={i === best ? 1.2 : 1} />
        <span className="sv-line__name">{p.name.split(' ').slice(-1)[0]}</span>
        <span className="sv-line__cl">{line}</span>
      </li>
    ))}
  </ul>
);

/** A headline board over the field (the line-up's jumbotron style) */
const Board = ({ kick, title, sub, logo }: { kick: string; title: string; sub?: string; logo?: string }) => (
  <div className="sv-line__head">
    {logo && <TeamLogo team={logo} size={92} decorative />}
    <div>
      <p className="sv-kick">{kick}</p>
      <h2 className="sv-title">{title}</h2>
      {sub && <p className="sv-sub">{sub}</p>}
    </div>
  </div>
);

const CoachScene = ({ roll, titles, stint }: { roll: number; titles: number | null; stint: CoachStint | null }) => {
  const { content } = useLeagueContent();
  const current = useCurrentClub() ?? 'Eagles';
  const club = stint?.club ?? current;
  const seasons = content?.coach?.seasons ?? [];
  const clubs: string[] = [];
  seasons.forEach((x) => {
    const n = findNFLTeam(x.team)?.name;
    if (n && !clubs.includes(n)) clubs.push(n);
  });
  const t = findNFLTeam(club);
  return (
    <Stadium club={club} roll={roll}>
      <div className="sv-coach">
        <div className="sv-coach__man">
          <span className="sv-fig" style={{ '--sv-scale': 1.8 } as CSSProperties}>
            <span className="sv-fig__shadow" />
            <CoachSprite who="head" team={club} kind="figure" size="l" className="sv-fig__sprite" />
          </span>
        </div>
        <div className="sv-rec__board sv-coach__board">
          {stint ? (
            <>
              <p className="sv-kick">
                Head coach · {t?.fullName ?? club} · {spans(stint.years)}
              </p>
              <h2 className="sv-rec__name">{content?.coach?.name ?? 'Dorren Skura'}</h2>
              <p className="sv-rec__mark">
                {stint.titles}
                <small> {stint.titles === 1 ? 'title' : 'titles'} here</small>
              </p>
              <p className="sv-rec__gap">
                {stint.seasons} {stint.seasons === 1 ? 'season' : 'seasons'} · {stint.w}-{stint.l}
                {stint.t ? `-${stint.t}` : ''} in the regular season
              </p>
            </>
          ) : (
            <>
              <p className="sv-kick">Head coach · career</p>
              <h2 className="sv-rec__name">{content?.coach?.name ?? 'Dorren Skura'}</h2>
              {titles != null && (
                <p className="sv-rec__mark">
                  {titles}
                  <small> titles</small>
                </p>
              )}
              <p className="sv-rec__gap">
                {seasons.length} seasons · {clubs.length} clubs
              </p>
              <div className="sv-coach__clubs">
                {clubs.map((c) => (
                  <TeamLogo key={c} team={c} size={34} decorative />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Stadium>
  );
};

const RowScene = ({ kick, title, sub, items, sprites, roll, club, action }: { kick: string; title: string; sub?: string; items: { p: Player; line: string }[]; sprites: boolean; roll: number; club: string; action?: SpriteAction }) => (
  <Stadium club={club} roll={roll}>
    <div className="sv-line">
      <Board kick={kick} title={title} sub={sub} />
      <Row items={items} sprites={sprites} action={action} />
    </div>
  </Stadium>
);

const MarketScene = ({ title, rows, sprites }: { title: string; rows: MarketRow[]; sprites: boolean }) => (
  <div className="sv-market">
    <div className="sv-market__board">
      <p className="sv-kick">Card market · {title}</p>
      <ul>
        {rows.map(({ p, text, up }) => (
          <li key={playerKey(p)} style={clubStyle(p)}>
            <span className="sv-market__sw" />
            <span className="sv-market__name">{p.name}</span>
            <span className="sv-market__pos">{p.position}</span>
            <b className={up === null ? 'sv-flat' : up ? 'sv-up' : 'sv-down'}>
              {up === null ? '' : up ? '▲ ' : '▼ '}
              {text}
            </b>
          </li>
        ))}
      </ul>
      <span className="sv-market__ticker" aria-hidden="true">
        {rows.map(({ p, text, up }) => `${p.name.toUpperCase()} ${up === null ? '' : up ? '▲' : '▼'}${text}`).join('   ·   ')}
      </span>
    </div>
    {rows[0] && (
      <div className="sv-market__man" style={clubStyle(rows[0].p)}>
        <Figure player={rows[0].p} sprites={sprites} action={rows[0].up === false ? 'idle' : 'celebrate'} scale={1.6} />
      </div>
    )}
  </div>
);

const DykScene = ({ text, p, club, roll, sprites }: { text: string; p: Player | null; club: string; roll: number; sprites: boolean }) => (
  <Stadium club={club} roll={roll}>
    <div className="sv-dyk">
      {p && (
        <div className="sv-dyk__man" style={clubStyle(p)}>
          <Figure player={p} sprites={sprites} scale={1.7} />
        </div>
      )}
      <div className="sv-dyk__third">
        <p className="sv-dyk__tab">Did you know</p>
        <p className="sv-dyk__text">{text}</p>
      </div>
    </div>
  </Stadium>
);

const ChaseScene = ({ p, c, roll, sprites }: { p: Player; c: WidgetChase; roll: number; sprites: boolean }) => (
  <Stadium club={clubOf(p)?.name ?? c.team} roll={roll}>
    <div className="sv-rec">
      <div className="sv-rec__board">
        <p className="sv-kick">Record chase · {c.holder} holds it</p>
        <h2 className="sv-rec__name">
          {p.name}: {fmt(c.have)} {c.unit}
        </h2>
        <div className="sv-chase">
          <i style={{ '--w': `${Math.min(100, c.pct)}%` } as CSSProperties} />
        </div>
        <p className="sv-rec__gap">
          <b>{fmt(c.toGo)}</b> to go to {fmt(c.mark)} · {c.pct}% of the way
        </p>
      </div>
      <div className="sv-rec__man" style={clubStyle(p)}>
        <Figure player={p} sprites={sprites} action="run" scale={1.6} />
        <span className="sv-line__name">{p.name}</span>
      </div>
    </div>
  </Stadium>
);

const AWARDS = ['Ring', 'MVP', 'Player of the Year', 'Rookie of the Year', 'Super Bowl MVP'];
const awardsOf = (p: Player) => [p.rings > 0, p.mvp > 0, p.opoy > 0, p.roty > 0, p.sbmvp > 0];
const GauntletScene = ({ title, kick, entries, sprites }: { title: string; kick: string; entries: { p: Player; has: boolean[] }[]; sprites: boolean }) => (
  <div className="sv-gauntlet">
    <span className="sv-champs__rays" aria-hidden="true" />
    <div className="sv-gauntlet__body">
      <p className="sv-kick">{kick}</p>
      <h2 className="sv-title">{title}</h2>
      <ul className="sv-gauntlet__row">
        {entries.slice(0, 5).map(({ p, has }, i) => (
          <li key={playerKey(p)} style={{ ...clubStyle(p), '--i': i } as CSSProperties}>
            <Figure player={p} sprites={sprites} action={has.every(Boolean) ? 'celebrate' : 'idle'} scale={1.05} />
            <span className="sv-line__name">{p.name.split(' ').slice(-1)[0]}</span>
            <span className="sv-gauntlet__rings">
              {AWARDS.map((a, k) => (
                <i key={a} title={a} className={has[k] ? undefined : 'sv-off'} />
              ))}
            </span>
            {!has.every(Boolean) && <span className="sv-line__cl">needs {AWARDS.filter((_, k) => !has[k]).join(', ')}</span>}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const RivalryScene = ({ file, a, b, sprites }: { file: RivalryFileLite; a: Player | null; b: Player | null; sprites: boolean }) => {
  const ta = findNFLTeam(file.coachTeam);
  const tb = findNFLTeam(file.team);
  return (
    <div className="sv-duel sv-rival" style={{ '--a': ta ? `hsl(${ta.primaryColor})` : undefined, '--b': tb ? `hsl(${tb.primaryColor})` : undefined } as CSSProperties}>
      <div className="sv-duel__side">
        {ta && <TeamLogo team={ta.name} size={180} decorative />}
        {a && <Figure player={a} sprites={sprites} scale={1.2} />}
        <h3 className="sv-duel__name">{ta?.name}</h3>
      </div>
      <div className="sv-duel__mid">
        <p className="sv-kick">Rivalry file · {file.first}–{file.last}</p>
        <span className="sv-duel__vs">{file.record.text}</span>
        <p className="sv-sub">
          {file.games} meetings
          {file.streak ? ` · longest streak ${file.streak.games}, ${file.streak.team}` : ''}
        </p>
      </div>
      <div className="sv-duel__side sv-duel__side--r">
        {tb && <TeamLogo team={tb.name} size={180} decorative />}
        {b && <Figure player={b} sprites={sprites} scale={1.2} mirror />}
        <h3 className="sv-duel__name">{tb?.name}</h3>
      </div>
    </div>
  );
};

const HofClassScene = ({ label, members, sprites }: { label: string; members: Player[]; sprites: boolean }) => (
  <div className="sv-hall sv-hofclass">
    <span className="sv-hall__columns" aria-hidden="true" />
    <span className="sv-hall__glow sv-hall__glow--wide" aria-hidden="true" />
    <div className="sv-hofclass__body">
      <p className="sv-kick">Hall of Fame</p>
      <h2 className="sv-title">{label}</h2>
      <ul className="sv-hofclass__steps">
        {members.slice(0, 7).map((p, i) => (
          <li key={playerKey(p)} style={{ ...clubStyle(p), '--i': i, '--step': Math.abs(i - Math.floor(Math.min(7, members.length) / 2)) } as CSSProperties}>
            <Figure player={p} sprites={sprites} action={i === Math.floor(Math.min(7, members.length) / 2) ? 'celebrate' : 'idle'} scale={0.95} />
            <span className="sv-line__name">{p.name.split(' ').slice(-1)[0]}</span>
          </li>
        ))}
      </ul>
      {members.length > 7 && <p className="sv-sub sv-sub--dim">and {members.length - 7} more</p>}
    </div>
  </div>
);

const TakeScene = ({ take, players, sprites }: { take: WidgetTake; players: Player[]; sprites: boolean }) => {
  const t = findNFLTeam(take.team ?? '');
  const style = (t ? { '--cs-1': `hsl(${t.primaryColor})` } : {}) as CSSProperties;
  return (
    <div className="sv-take" style={style}>
      <span className="sv-take__heat" aria-label={`Heat ${take.heat}`}>
        {Array.from({ length: take.heat }, (_, i) => (
          <Flame key={i} aria-hidden="true" />
        ))}
      </span>
      <p className="sv-kick">Hot take</p>
      <blockquote className="sv-take__q">{take.headline}</blockquote>
      {take.dek && <p className="sv-sub">{take.dek}</p>}
      <div className="sv-take__men">
        {players.slice(0, 2).map((p, i) => (
          <span key={playerKey(p)} style={clubStyle(p)}>
            <Figure player={p} sprites={sprites} scale={1.1} mirror={i === 1} />
          </span>
        ))}
      </div>
    </div>
  );
};

const DynastyScene = ({ era, players, sprites }: { era: EraLite; players: Player[]; sprites: boolean }) => {
  // the club the era is named for ("Ravens dynasty"), else its last club
  const named = era.yourTeams.find((t) => era.name.toLowerCase().startsWith((findNFLTeam(t)?.name ?? t).toLowerCase()));
  const club = findNFLTeam(named ?? era.yourTeams[era.yourTeams.length - 1] ?? '')?.name ?? 'Eagles';
  const lead = (era.notes ?? '').split('. ')[0];
  return (
    <Stadium club={club} roll={0.6}>
      <div className="sv-line">
        <div className="sv-line__head">
          <TeamLogo team={club} size={92} decorative />
          <div>
            <p className="sv-kick">
              Y{era.startYear}–{era.endYear}
              {era.superBowlRange ? ` · Super Bowls ${era.superBowlRange}` : ''}
            </p>
            <h2 className="sv-title">{era.name}</h2>
            {lead && <p className="sv-sub">{lead}.</p>}
          </div>
        </div>
        <div className="sv-dynasty__row">
          <span className="sv-fig" style={{ '--sv-scale': 1.15 } as CSSProperties}>
            <span className="sv-fig__shadow" />
            <CoachSprite who="head" team={club} kind="figure" size="l" className="sv-fig__sprite" />
          </span>
          <Row items={players.slice(0, 5).map((p) => ({ p, line: fmt(p.careerLegacy) }))} sprites={sprites} />
        </div>
      </div>
    </Stadium>
  );
};

const WX_ICON = { clear: [Sun, Moon], cloud: [Cloud, Cloud], fog: [CloudFog, CloudFog], rain: [CloudRain, CloudRain], snow: [CloudSnow, CloudSnow], storm: [CloudLightning, CloudLightning] } as const;

/** The corner: the time, the date, the town and its weather (when the location is shared from the menu) */
type Weather = { fx: ReturnType<typeof weatherKind>['fx'] | null; wind: number };

/**
 * The bus line under the weather (owner: style A "one line, like the weather", "a bit more subtle"): the route's small
 * badge and one quiet line: leave now, leave in N minutes, or the next bus and when to set off, from the stop and walk
 * set in the menu, by the published timetable
 */
const BusLine = ({ now }: { now: Date }) => {
  const bus = useBusSetting();
  const file = useRoute(bus?.route);
  if (!bus || !file) return null;
  if (file.ends && file.ends < now.toISOString().slice(0, 10)) return null;
  const st = busState(departures(file, bus.point, now, bus.to), bus.walk, now);
  if (st.kind === 'none') return null;
  // "→ Science Hill 8:42": the stop's short name (the part in brackets, else the street)
  const dest = bus.to ? file.points.find((p) => p.id === bus.to)?.name ?? '' : '';
  const short = (dest.match(/\((?:UCSC - )?([^)]+)\)/)?.[1] ?? dest).trim();
  const arrive = st.arrive && short ? ` → ${short} ${hm(st.arrive)}` : '';
  return (
    <span className={st.kind === 'now' ? 'sv-bus sv-bus--now' : 'sv-bus'}>
      <i className="sv-bus__badge">{file.route}</i>
      {st.kind === 'now' && (
        <>
          <b>Leave now</b> · bus {hm(st.bus)}
          {arrive}
          {st.next && ` · next ${hm(st.next)}`}
        </>
      )}
      {st.kind === 'soon' && (
        <>
          <b>Leave in {st.inMin} min</b> · bus {hm(st.bus)}
          {arrive}
          {st.next && ` · next ${hm(st.next)}`}
        </>
      )}
      {st.kind === 'later' && (
        <>
          Next bus {hm(st.bus)}
          {arrive} · leave {hm(st.leave)}
        </>
      )}
    </span>
  );
};

const Corner = ({ onWeather, children }: { onWeather: (w: Weather) => void; children?: ReactNode }) => {
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
    const t = window.setInterval(load, 10 * 60_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [place]);
  const kind = wx ? weatherKind(wx.code) : null;
  const force = windForce(wx);
  useEffect(() => onWeather({ fx: kind?.fx ?? null, wind: force }), [kind?.fx, force, onWeather]);
  const windy = wx?.wind ? windLabel(wx.wind) : null;
  const windText = wx?.wind && windy ? `${windy} ${place?.unit === 'fahrenheit' ? `${Math.round(wx.wind / 1.609)} mph` : `${wx.wind} km/h`}` : null;
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
            {[kind?.label, windText, place.city].filter(Boolean).join(' · ')}
            {wx ? ` · H ${wx.hi}° L ${wx.lo}°` : ''}
          </span>
        </span>
      )}
      <BusLine now={now} />
      {children}
    </div>
  );
};


/** Stadium flyover: the club's own ground (its roof, its snow and rain) under a slow aerial camera, its weather odds */
const FlyoverScene = ({ club, roll }: { club: string; roll: number }) => {
  const live = useLiveSeason();
  const t = findNFLTeam(club);
  const wx = stadiumWeather(live?.clubs?.[club]);
  const late = wx?.phases.find((ph) => ph.key === 'late');
  const playoff = wx?.phases.find((ph) => ph.key === 'playoffs');
  const facts = !wx
    ? []
    : wx.covered
      ? ['Under a roof · no weather, ever']
      : [`Rain in ${pctText(late?.rain ?? 0)} of games`, ...((late?.snow ?? 0) > 0.005 ? [`snow in ${pctText(late?.snow ?? 0)} after week 11`] : []), ...((playoff?.snow ?? 0) > 0.005 ? [`${pctText(playoff?.snow ?? 0)} in a home playoff game`] : [])];
  const rainy = !!wx && !wx.covered && (late?.rain ?? 0) >= 0.25 && roll > 0.5;
  return (
    <div className={`sv-fly sv-fly--${Math.floor(roll * 3)}`}>
      <div className="sv-fly__cam">
        <Stadium club={club} roll={roll} />
      </div>
      {rainy && (
        <span className="sv-weather sv-weather--rain sv-fly__rain" aria-hidden="true">
          <Rain />
        </span>
      )}
      <div className="sv-fly__cap">
        <p className="sv-kick">Stadium tour</p>
        <h2 className="sv-title sv-fly__title">
          <TeamLogo team={club} size={64} decorative /> {t?.fullName ?? club}
        </h2>
        {facts.length > 0 && <p className="sv-cap">{facts.join(' · ')}</p>}
      </div>
    </div>
  );
};

/** Season Rewind, played back: three of a season's cards in turn, in a phone frame over the club's colours */
const REWIND_EACH = 4_400;
const RewindScene = ({ entry, from }: { entry: SeasonRewindIndexEntry; from: number }) => {
  const { getAllPlayers } = useLeague();
  const players = useMemo(() => getAllPlayers(), [getAllPlayers]);
  const { rewind } = useSeasonRewind(entry);
  const cards = rewind?.cards.slice(from, from + 3) ?? [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (cards.length < 2) return;
    const t = window.setInterval(() => setI((n) => Math.min(n + 1, cards.length - 1)), REWIND_EACH);
    return () => window.clearInterval(t);
  }, [cards.length]);
  const cur = cards[i];
  const club = findNFLTeam(cur?.club ?? entry.club ?? '');
  const style = (club ? { '--sv-1': `hsl(${club.primaryColor})`, '--sv-2': `hsl(${club.secondaryColor})` } : {}) as CSSProperties;
  return (
    <div className="sv-rw" style={style}>
      <div className="sv-rw__side">
        <p className="sv-kick">Season Rewind</p>
        <h2 className="sv-title">{entry.season}</h2>
        <p className="sv-cap">
          {[entry.club && findNFLTeam(entry.club)?.fullName, entry.record].filter(Boolean).join(' · ')}
        </p>
        {entry.champion && (
          <p className="sv-sub sv-sub--dim">
            Champions: <ClubTag team={entry.champion} />
          </p>
        )}
      </div>
      <div className="sv-rw__phone">
        <div className="sv-rw__segs" aria-hidden="true">
          {cards.map((c, k) => (
            <span key={c.id} className={k < i ? 'is-done' : k === i ? 'is-on' : ''} style={{ '--rw-each': `${REWIND_EACH}ms` } as CSSProperties} />
          ))}
        </div>
        <div className="sv-rw__screen">
          {cur && (
            <div key={cur.id} className="rw-slide">
              <RewindCardView card={cur} season={entry.season} players={players} onPlayer={() => {}} onLink={() => {}} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** The trophy room: one shelf of trophies a club, each engraved with the season Skura won it there (the Front Office cabinet's cup) */
const Trophy = ({ year, big, band, glint }: { year: number; big: boolean; band: string; glint?: number }) => (
  <span className={big ? 'sv-tro sv-tro--big' : 'sv-tro'}>
    <PixelCup band={band} className="sv-tro__svg" spark={glint} />
    <span className="sv-tro__year">Y{year}</span>
  </span>
);

const TrophiesScene = ({ club, years }: { club: string; years: number[] }) => {
  const { lite } = usePerfMode();
  // the glint is an SVG animation, so reduced motion and lite mode leave it out here
  const still = lite || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const t = findNFLTeam(club);
  const style = (t ? { '--sv-1': `hsl(${t.primaryColor})`, '--sv-2': `hsl(${t.secondaryColor})` } : {}) as CSSProperties;
  const ys = [...years].sort((a, b) => a - b);
  const perShelf = ys.length <= 8 ? 8 : ys.length <= 24 ? 12 : 16;
  const shelves: number[][] = [];
  for (let k = 0; k < ys.length; k += perShelf) shelves.push(ys.slice(k, k + perShelf));
  const band = teamColor(club);
  return (
    <div className="sv-troom" style={style}>
      <span className="sv-troom__logo" aria-hidden="true">
        <TeamLogo team={club} size={520} decorative />
      </span>
      <span className="sv-troom__light" aria-hidden="true" />
      <div className="sv-troom__head">
        <p className="sv-kick">The trophy room · Dorren Skura</p>
        <h2 className="sv-title">{t?.fullName ?? club}</h2>
        <p className="sv-cap">
          <b>{ys.length}</b> Super Bowl {ys.length === 1 ? 'title' : 'titles'} here · {spans(ys)}
        </p>
      </div>
      <div className={`sv-troom__case sv-troom__case--${perShelf}`}>
        {shelves.map((row, r) => (
          <div key={r} className="sv-troom__shelf" style={{ '--r': r } as CSSProperties}>
            {row.map((y, k) => (
              <span key={y} className="sv-troom__slot" style={{ '--k': k + r * 3 } as CSSProperties}>
                <Trophy year={y} big={ys.length <= 8} band={band} glint={still ? undefined : 1 + (k + r * 3) * 0.35} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Card stunt: the home end holds up cards that, together, print the club's own banner: its colour, trim stripes in
 * its second colour, its logo on a white roundel and its name in block type (the city is left off: too small to read). Column by column the fans turn their
 * cards over, hold the banner, then a wave rolls across. One canvas: the banner is drawn once, sampled to one colour a
 * card, and the seats are drawn from that each frame (no DOM per seat).
 */
const STUNT_COLS = 156;
const STUNT_ROWS = 42;
const hslL = (hsl: string) => Number(hsl.split(' ')[2]?.replace('%', '') ?? 50);
const bannerColors = async (t: ReturnType<typeof findNFLTeam>, club: string): Promise<string[]> => {
  const S = 8; // the banner is drawn 8× the seat grid, then averaged down to one colour a seat
  const W = STUNT_COLS * S;
  const H = STUNT_ROWS * S;
  const b = document.createElement('canvas');
  b.width = W;
  b.height = H;
  const g = b.getContext('2d')!;
  const c1 = t ? `hsl(${t.primaryColor})` : '#1b2a6b';
  const c2 = t ? `hsl(${t.secondaryColor})` : '#ffc63e';
  // light primaries (silver, sol) take dark lettering, the rest white
  const ink = t && hslL(t.primaryColor) > 62 ? '#0b0f1d' : '#ffffff';
  g.fillStyle = c1;
  g.fillRect(0, 0, W, H);
  // trim: a second-colour stripe with a white pinstripe, top and bottom
  const band = H * 0.09;
  for (const y of [0, H - band]) {
    g.fillStyle = c2;
    g.fillRect(0, y, W, band);
  }
  g.fillStyle = '#ffffff';
  g.fillRect(0, band, W, H * 0.018);
  g.fillRect(0, H - band - H * 0.018, W, H * 0.018);
  // the logo on a white roundel ringed in the second colour, at the left
  const R = H * 0.34;
  const cx = H * 0.5 + W * 0.03;
  const cy = H / 2;
  g.beginPath();
  g.arc(cx, cy, R + H * 0.03, 0, Math.PI * 2);
  g.fillStyle = c2;
  g.fill();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
  if (t?.logoUrl) {
    const img = await new Promise<HTMLImageElement | null>((res) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = t.logoUrl;
    });
    if (img) {
      const L = R * 1.62;
      g.drawImage(img, cx - L / 2, cy - L / 2, L, L);
    }
  }
  // the name: the city small over the club name, as big as fits beside the logo
  try {
    await document.fonts.load('800 italic 100px "Barlow Condensed"');
  } catch {
    /* system font */
  }
  const left = cx + R + W * 0.04;
  const room = W - left - W * 0.03;
  const name = (t?.name ?? club).toUpperCase();
  let size = H * 0.62;
  const font = (px: number) => `italic 800 ${px}px "Barlow Condensed", Impact, sans-serif`;
  g.font = font(size);
  while (g.measureText(name).width > room && size > 10) g.font = font((size -= 2));
  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'center';
  const mid = left + room / 2;
  g.fillText(name, mid, H * 0.73);
  // one colour a seat: let the browser average each 8×8 block
  const small = document.createElement('canvas');
  small.width = STUNT_COLS;
  small.height = STUNT_ROWS;
  const sg = small.getContext('2d')!;
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(b, 0, 0, STUNT_COLS, STUNT_ROWS);
  let px: Uint8ClampedArray;
  try {
    px = sg.getImageData(0, 0, STUNT_COLS, STUNT_ROWS).data;
  } catch {
    return [];
  }
  const out: string[] = [];
  for (let i = 0; i < STUNT_COLS * STUNT_ROWS; i++) {
    // cards are printed card stock: each a touch lighter or darker than the next
    const k = 0.94 + hash(i * 7 + 3) * 0.1;
    out.push(`rgb(${Math.min(255, px[i * 4] * k)},${Math.min(255, px[i * 4 + 1] * k)},${Math.min(255, px[i * 4 + 2] * k)})`);
  }
  return out;
};

const StuntScene = ({ club }: { club: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = findNFLTeam(club);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const COLS = STUNT_COLS;
    const ROWS = STUNT_ROWS;
    const crowd = ['#3b3f4f', '#565b6e', '#2c2f3c', '#6b5a4a', '#4a4f63'];
    const k = isLite() ? 0.5 : devicePixelRatio;
    const W = (cv.width = cv.clientWidth * k);
    const H = (cv.height = cv.clientHeight * k);
    const cw = W / COLS;
    const ch = H / ROWS;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let faces: string[] | null = null;
    let t0 = performance.now();
    let raf = 0;
    let alive = true;
    void bannerColors(t, club).then((f) => {
      if (!alive) return;
      faces = f.length ? f : null;
      t0 = performance.now();
    });
    const fallback = t ? `hsl(${t.primaryColor})` : '#1b2a6b';
    const draw = (now: number) => {
      // the stand waits in its seats until the banner is ready, then the turn sweeps from 1 s
      const s = !faces ? 0 : still ? 9 : (now - t0) / 1000;
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, W, H);
      const wavePos = s < 6.5 ? -99 : (((s - 6.5) % 3.6) / 3.6) * (COLS + 30) - 15;
      for (let c = 0; c < COLS; c++) {
        const turn = Math.min(1, Math.max(0, (s - 1 - c * 0.02) / 0.4));
        const lift = Math.max(0, 1 - Math.abs(c - wavePos) / 6);
        for (let r = 0; r < ROWS; r++) {
          const x = c * cw;
          const y = r * ch - lift * ch * 0.6;
          const seat = hash(c * 131 + r * 7 + 1);
          if (turn <= 0) {
            ctx.fillStyle = crowd[Math.floor(seat * crowd.length)];
            ctx.fillRect(x + cw * 0.18, y + ch * 0.2, cw * 0.64, ch * 0.62);
            continue;
          }
          const sq = Math.abs(Math.cos(turn * Math.PI)); // the card flips: thin at the half-turn
          const face = turn < 0.5 ? crowd[Math.floor(seat * crowd.length)] : (faces?.[r * COLS + c] ?? fallback);
          const h = ch * 0.92 * Math.max(0.08, sq);
          ctx.fillStyle = face;
          ctx.fillRect(x + cw * 0.05, y + (ch - h) / 2, cw * 0.9, h);
          if (lift > 0.05 && turn >= 1) {
            ctx.fillStyle = `rgba(255,255,255,${lift * 0.22})`;
            ctx.fillRect(x + cw * 0.05, y + ch * 0.04, cw * 0.9, ch * 0.92);
          }
        }
      }
      if (!still || !faces) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [club, t]);
  return (
    <Stadium club={club} roll={0.9} className="sv-stunt-ground">
      <div className="sv-stunt">
        <canvas ref={ref} className="sv-stunt__stand" aria-hidden="true" />
        <div className="sv-stunt__cap">
          <p className="sv-kick">Card stunt · the home end</p>
          <p className="sv-cap">{t?.fullName ?? club}</p>
        </div>
      </div>
    </Stadium>
  );
};

/** The cover as stadium-screen pixels: drawn small once, shown big with hard edges */
const PixelCover = ({ src }: { src: string | null }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || !src) return;
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
    };
    img.src = src;
  }, [src]);
  return src ? <canvas ref={ref} width={40} height={40} className="sv-pa__cover" aria-hidden="true" /> : <span className="sv-pa__cover sv-pa__cover--none" aria-hidden="true"><Music /></span>;
};

/**
 * Stadium PA (owner, 2026-11-18: "for the stadium PA panel make it a screensaver"): the song playing on Spotify on the
 * big screen over the current club's ground: the cover as screen pixels, the title running in gold lights, an
 * equalizer, the track. Only dealt while Spotify is connected; skipped at once when nothing is playing.
 */
const PaScene = ({ np, club }: { np: NowPlaying; club: string }) => {
  const line = `${np.title} · ${np.artist}`.toUpperCase();
  const t = trackTimes(np);
  return (
    <Stadium club={club} roll={0.9} className="sv-pa-ground">
      <div className={np.playing ? 'sv-pa' : 'sv-pa sv-pa--paused'}>
        <p className="sv-kick">Stadium PA · now playing</p>
        <div className="sv-pa__board">
          <PixelCover src={np.art} />
          <div className="sv-pa__info">
            <span className="sv-pa__live">
              <i />
              {np.playing ? 'On the speakers' : 'Paused'}
            </span>
            <span className="sv-pa__marquee">
              <span className="sv-pa__run">
                <span>{line}</span>
                <span>{line}</span>
              </span>
            </span>
            {np.album && <span className="sv-pa__album">{np.album}</span>}
            <span className="sv-pa__eq" aria-hidden="true">
              {Array.from({ length: 24 }, (_, k) => (
                <i key={k} style={{ '--d': `${-hash(k + 3) * 0.9}s`, '--t': `${0.45 + hash(k + 11) * 0.5}s` } as CSSProperties} />
              ))}
            </span>
            <span className="sv-pa__times">
              <span>{t.at}</span>
              <span className="sv-pa__bar">
                <span key={`${np.title}-${np.at}`} style={{ '--np-from': np.duration ? Math.min(1, np.progress / np.duration) : 0, '--np-rest': `${Math.max(0, np.duration - np.progress)}ms` } as CSSProperties} />
              </span>
              <span>{t.of}</span>
            </span>
          </div>
        </div>
      </div>
    </Stadium>
  );
};

/**
 * Now playing on Spotify, bottom right (owner, concept A "end-zone tower … a bit more subtle and on theme"): the end-zone
 * scoreboard, standing on two steel legs at the bottom edge and cut off by the right edge: the cover on the replay
 * panel, HOME the song, AWAY the artist, the time into the track on the game clock, in muted stadium colours
 */
const NowPlayingCard = ({ np }: { np: NowPlaying }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!np.playing) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [np.playing]);
  const ms = Math.min(np.duration || Infinity, np.progress + (np.playing ? Date.now() - np.at : 0));
  const clock = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const from = np.duration ? Math.min(1, np.progress / np.duration) : 0;
  const rest = Math.max(0, np.duration - np.progress);
  return (
    <div className={np.playing ? 'sv-tower' : 'sv-tower sv-tower--paused'}>
      <span className="sv-tower__lamps" aria-hidden="true">
        <i />
        <i />
      </span>
      <span className="sv-tower__board">
        <span className="sv-tower__head">
          Now playing <b>{np.playing ? 'Live' : 'Paused'}</b>
        </span>
        <span className="sv-tower__body">
          <span className="sv-tower__replay">
            <span className="sv-tower__label">Replay</span>
            <PixelCover src={np.art} />
          </span>
          <span className="sv-tower__score">
            <span className="sv-tower__label">Home</span>
            <span className="sv-tower__home">{np.title}</span>
            <span className="sv-tower__label">Away</span>
            <span className="sv-tower__away">{np.artist}</span>
            <span className="sv-tower__clock">{clock}</span>
          </span>
        </span>
        <span className="sv-tower__bar">
          <span key={`${np.title}-${np.at}`} style={{ '--np-from': from, '--np-rest': `${rest}ms` } as CSSProperties} />
        </span>
      </span>
      <span className="sv-tower__legs" aria-hidden="true">
        <i />
        <i />
      </span>
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
  const { cards: pool, byKey, loaded: poolLoaded } = useCardPool();
  const { state, cards: owned } = useCollection();
  const { lite } = usePerfMode();
  const { content, loading: contentLoading } = useLeagueContent();
  const records = useClubRecords();
  const feed = useWidgetFeed();
  const marketHist = useMarket();
  const live = useLiveSeason();
  const spotifyOn = useSpotifyConnected();
  const paClub = useCurrentClub() ?? 'Eagles';
  const rootRef = useRef<HTMLDivElement>(null);

  const players = useMemo(
    () => getAllPlayers().filter((p) => !p.isRealLegend).sort((a, b) => b.careerLegacy - a.careerLegacy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAllPlayers, dataVersion],
  );
  const rankOf = useMemo(() => new Map(players.map((p, i) => [playerKey(p), i + 1])), [players]);

  // The playlist: each kind shuffled, then dealt in turn (spotlight, card, line-up, Hall of Famer, rafters, …)
  // the playlist is dealt once everything it reads is in (dealt early, it would reshuffle and skip scenes mid-show)
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 4_000);
    return () => window.clearTimeout(t);
  }, []);
  const ready = players.length > 0 && ((feed !== undefined && !contentLoading && hof !== undefined && !!records && poolLoaded && !!marketHist && live !== undefined) || waited);
  const scenes = useMemo<Scene[]>(() => {
    if (!ready) return [];
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
    const P = (k?: string) => (k ? byKeyP.get(k) : undefined);
    const byName = new Map(players.map((p) => [p.name, p]));
    const w = feed;
    // the coach: his career, and each club he coached (its seasons, record and titles there)
    const stints = new Map<string, CoachStint>();
    (content?.coach?.seasons ?? []).forEach((x) => {
      const club = findNFLTeam(x.team)?.name;
      if (!club) return;
      const st = stints.get(club) ?? { club, years: [], seasons: 0, titles: 0, w: 0, l: 0, t: 0 };
      st.years.push(x.year);
      st.seasons += 1;
      st.titles += x.finish === 'Champions' ? 1 : 0;
      st.w += x.w;
      st.l += x.l;
      st.t += x.t ?? 0;
      stints.set(club, st);
    });
    const coachDeck: Scene[] = content?.coach
      ? shuffle([null, ...stints.values()]).map((stint): Scene => ({ kind: 'coach', roll: Math.random(), stint }))
      : [];
    // rising stars and final season: a different five each run
    const rising: Scene[] = (() => {
      const items = shuffle(w?.ceilings ?? [])
        .map((c) => ({ p: P(c.player), line: `${c.stars}★ → ${c.ceiling}★ · age ${c.age}` }))
        .filter((x): x is { p: Player; line: string } => !!x.p);
      return items.length >= 3 ? [{ kind: 'rising', items: items.slice(0, 5) }] : [];
    })();
    const farewell: Scene[] = (() => {
      const items = shuffle((w?.retirements ?? []).filter((r) => r.seasonsLeft === 0))
        .map((r) => ({ p: P(r.player), line: `age ${r.age}` }))
        .filter((x): x is { p: Player; line: string } => !!x.p);
      return items.length >= 2 ? [{ kind: 'farewell', items: items.slice(0, 5) }] : [];
    })();
    // the market: the biggest risers and fallers between the last two snapshots, and the most valuable cards
    const market: Scene[] = (() => {
      const snaps = marketHist ?? [];
      const a = snaps[snaps.length - 2]?.players ?? {};
      const b = snaps[snaps.length - 1]?.players ?? {};
      const moves = Object.entries(b)
        .map(([k, pt]) => ({ p: P(k), pct: a[k] && a[k].value >= 50 ? Math.round(((pt.value - a[k].value) / a[k].value) * 100) : null, value: pt.value }))
        .filter((x): x is { p: Player; pct: number | null; value: number } => !!x.p);
      const withPct = moves.filter((x): x is { p: Player; pct: number; value: number } => x.pct !== null && x.pct !== 0);
      const out: Scene[] = [];
      const up = [...withPct].sort((x, y) => y.pct - x.pct).filter((x) => x.pct > 0).slice(0, 5);
      const down = [...withPct].sort((x, y) => x.pct - y.pct).filter((x) => x.pct < 0).slice(0, 5);
      const top = [...moves].sort((x, y) => y.value - x.value).slice(0, 5);
      if (up.length) out.push({ kind: 'market', title: 'biggest risers', rows: up.map((x) => ({ p: x.p, text: `${x.pct}%`, up: true })) });
      if (down.length) out.push({ kind: 'market', title: 'biggest fallers', rows: down.map((x) => ({ p: x.p, text: `${Math.abs(x.pct)}%`, up: false })) });
      if (top.length) out.push({ kind: 'market', title: 'most valuable cards', rows: top.map((x) => ({ p: x.p, text: `${fmt(x.value)} c`, up: null })) });
      return shuffle(out);
    })();
    const dyks = shuffle(w?.didYouKnow ?? [])
      .slice(0, 30)
      .map((d): Scene => {
        const p = P(d.player) ?? null;
        return { kind: 'dyk', text: d.text, p, club: (p && clubOf(p)?.name) || findNFLTeam(d.team ?? '')?.name || 'Eagles', roll: Math.random() };
      });
    const chases = shuffle(w?.chases ?? [])
      .map((c) => ({ c, p: P(c.player) }))
      .filter((x): x is { c: WidgetChase; p: Player } => !!x.p)
      .map(({ c, p }): Scene => ({ kind: 'chase', c, p, roll: Math.random() }));
    // the Gauntlet from every player's awards: who has the full set, and groups of five who are one short
    const gauntlet: Scene[] = (() => {
      const all = players.map((p) => ({ p, has: awardsOf(p) }));
      const full = all.filter((x) => x.has.every(Boolean));
      const short = shuffle(all.filter((x) => x.has.filter(Boolean).length === 4));
      const out: Scene[] = [];
      if (full.length) out.push({ kind: 'gauntlet', title: 'Ran the Gauntlet', kick: 'The Gauntlet · every award on his side of the ball', entries: full });
      for (let k = 0; k < short.length && out.length < 6; k += 5)
        out.push({ kind: 'gauntlet', title: 'One short', kick: 'The Gauntlet · four of the five', entries: short.slice(k, k + 5) });
      return shuffle(out);
    })();
    const rivals = shuffle(((content?.rivalryFiles ?? []) as unknown as RivalryFileLite[]).filter((f) => f.status === 'lasting')).map(
      (file): Scene => ({ kind: 'rivalry', file, a: P(file.stars?.coach?.key) ?? null, b: P(file.stars?.rival?.key) ?? null }),
    );
    const classes = shuffle(((content?.hofClasses ?? []) as unknown as { label: string; keys?: string[] }[]))
      .map((c) => ({ label: c.label, members: (c.keys ?? []).map((k) => P(k)).filter((x): x is Player => !!x) }))
      .filter((c) => c.members.length >= 2)
      .map((c): Scene => ({ kind: 'hofclass', label: c.label, members: c.members }));
    const takeScenes = shuffle(w?.takes ?? []).map(
      (take): Scene => ({ kind: 'take', take, players: (take.players ?? []).map((x) => P(x.player)).filter((x): x is Player => !!x) }),
    );
    const dynasties = shuffle(((content?.eras ?? []) as unknown as EraLite[]))
      .map((era) => ({ era, players: era.keyPlayers.map((n) => byName.get(n)).filter((x): x is Player => !!x) }))
      .filter((x) => x.players.length >= 2)
      .map(({ era, players: ps }): Scene => ({ kind: 'dynasty', era, players: ps }));
    // stadium flyovers (every club with stadium figures), Season Rewind playback (the cards in threes), the trophy room
    // (each club Skura won with) and card stunts (the clubs he coached)
    const clubNames = Object.keys(live?.clubs ?? {}).filter((c) => findNFLTeam(c));
    const flyovers = shuffle(clubNames).map((club): Scene => ({ kind: 'flyover', club, roll: Math.random() }));
    const rewinds = shuffle(
      (content?.seasonRewindIndex ?? []).flatMap((entry) => Array.from({ length: Math.ceil(entry.count / 3) }, (_, k): Scene => ({ kind: 'rewind', entry, from: k * 3 }))),
    );
    const trophies = shuffle(
      [...stints.values()]
        .map((st) => ({ club: st.club, years: (content?.coach?.seasons ?? []).filter((x) => x.finish === 'Champions' && findNFLTeam(x.team)?.name === st.club).map((x) => x.year) }))
        .filter((x) => x.years.length),
    ).map((x): Scene => ({ kind: 'trophies', club: x.club, years: x.years }));
    const stunts = shuffle([...stints.keys()]).map((club): Scene => ({ kind: 'stunt', club }));
    // the PA comes round a few times a run while Spotify is connected (skipped when nothing is playing)
    const pas: Scene[] = spotifyOn ? [{ kind: 'pa' }, { kind: 'pa' }, { kind: 'pa' }] : [];
    const decks = [spot, pas, flyovers, cardScenes, duels, rewinds, dyks, lineups, trophies, champs, coachDeck, stunts, hofScenes, takeScenes, recs, rising, papers, chases, rivals, market, classes, dynasties, gauntlet, farewell, rafters].filter((d) => d.length);
    const out: Scene[] = [];
    for (let i = 0; out.length < 60 && decks.some((d) => i < d.length); i++) decks.forEach((d) => d[i] && out.push(d[i]));
    return out;
    // the playlist is dealt once a run; later collection or rafters changes wait for the next run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [hint, setHint] = useState(true);
  const [weather, setWeather] = useState<Weather>({ fx: null, wind: 0 });
  // Resting: after the sleep time (or overnight) the show fades to black and lets the display sleep
  const sleepMin = useSaverSleep();
  const night = useSaverNight();
  const [resting, setResting] = useState(() => night && isNightRest());
  const nowPlaying = useNowPlaying(!resting);
  const onPa = scenes[idx]?.kind === 'pa';
  const paIdle = onPa && !nowPlaying;
  // a 3 s fade to black, then nothing is drawn at all
  const [asleep, setAsleep] = useState(resting);
  useEffect(() => {
    if (!resting) return;
    const t = window.setTimeout(() => setAsleep(true), 3_000);
    return () => window.clearTimeout(t);
  }, [resting]);
  useEffect(() => {
    const started = Date.now();
    const check = () => {
      if ((sleepMin && Date.now() - started >= sleepMin * 60_000) || (night && isNightRest())) setResting(true);
    };
    check();
    const t = window.setInterval(check, 30_000);
    return () => window.clearInterval(t);
  }, [sleepMin, night]);
  // the menu can force rain, snow or a storm (or none) whatever the real weather
  const fxChoice = useSaverFx();
  const fx = fxChoice === 'real' ? weather.fx : fxChoice === 'none' ? null : fxChoice;
  const wind = fxChoice === 'real' ? weather.wind : Math.max(weather.wind, fxChoice === 'storm' ? 0.55 : 0.15);

  useEffect(() => {
    if (scenes.length < 2 || resting) return;
    // the PA with nothing playing passes straight on to the next scene
    const t = window.setTimeout(() => {
      setPrev(idx);
      setIdx((i) => (i + 1) % scenes.length);
    }, paIdle ? 0 : SCENE_MS);
    return () => window.clearTimeout(t);
  }, [idx, scenes.length, resting, paIdle]);
  useEffect(() => {
    if (prev === null) return;
    // the old scene leaves the page as soon as it has faded (a short fade in lite)
    const t = window.setTimeout(() => setPrev(null), lite ? 650 : FADE_MS);
    return () => window.clearTimeout(t);
  }, [prev, lite]);
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

  // Full screen when the browser allows it (the header button's click)
  useEffect(() => {
    rootRef.current?.requestFullscreen?.().catch(() => {});
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevOverflow;
    };
  }, []);

  // Keep the display awake while the show runs; resting gives the lock back so the display can sleep
  useEffect(() => {
    if (resting) return;
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
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [resting]);

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
      case 'coach':
        return <CoachScene roll={s.roll} titles={feed?.coachTitles ?? null} stint={s.stint} />;
      case 'rising':
        return <RowScene kick="Room to grow · the game's star ceilings" title="Rising stars" items={s.items} sprites={sprites} roll={0.1} club={clubOf(s.items[0].p)?.name ?? 'Eagles'} />;
      case 'farewell':
        return <RowScene kick={feed?.liveSeason ? `Season ${feed.liveSeason}` : 'This season'} title="Final season" sub="Their last lap by the game's retirement clock" items={s.items} sprites={sprites} roll={0.4} club={clubOf(s.items[0].p)?.name ?? 'Eagles'} />;
      case 'market':
        return <MarketScene title={s.title} rows={s.rows} sprites={sprites} />;
      case 'dyk':
        return <DykScene text={s.text} p={s.p} club={s.club} roll={s.roll} sprites={sprites} />;
      case 'chase':
        return <ChaseScene p={s.p} c={s.c} roll={s.roll} sprites={sprites} />;
      case 'gauntlet':
        return <GauntletScene title={s.title} kick={s.kick} entries={s.entries} sprites={sprites} />;
      case 'rivalry':
        return <RivalryScene file={s.file} a={s.a} b={s.b} sprites={sprites} />;
      case 'hofclass':
        return <HofClassScene label={s.label} members={s.members} sprites={sprites} />;
      case 'take':
        return <TakeScene take={s.take} players={s.players} sprites={sprites} />;
      case 'dynasty':
        return <DynastyScene era={s.era} players={s.players} sprites={sprites} />;
      case 'flyover':
        return <FlyoverScene club={s.club} roll={s.roll} />;
      case 'rewind':
        return <RewindScene entry={s.entry} from={s.from} />;
      case 'trophies':
        return <TrophiesScene club={s.club} years={s.years} />;
      case 'stunt':
        return <StuntScene club={s.club} />;
      case 'pa':
        return nowPlaying ? <PaScene np={nowPlaying} club={paClub} /> : null;
    }
  };

  const shown = [prev, idx].filter((i): i is number => i !== null && !!scenes[i]);

  return (
    <div
      ref={rootRef}
      className={`sv ${lite ? 'sv--lite' : ''} ${wind >= 0.1 ? 'sv--windy' : ''} ${resting ? 'sv--rest' : ''}`}
      style={{ '--sv-wind': wind } as CSSProperties}
      role="dialog" aria-modal="true" aria-label="Screensaver: press any key to return">
      {!asleep && shown.map((i) => (
        <div key={`${i}-${scenes[i].kind}`} className={i === idx ? 'sv-slide sv-slide--in' : 'sv-slide sv-slide--out'} style={{ '--sv-dur': `${SCENE_MS}ms` } as CSSProperties}>
          {render(scenes[i])}
        </div>
      ))}
      {!asleep && fx && fx !== 'clear' && fx !== 'cloud' && (
        <span className={`sv-weather sv-weather--${fx}`} aria-hidden="true">
          {(fx === 'rain' || fx === 'storm') && <Rain />}
          {fx === 'snow' && <WeatherCanvas kind={fx} wind={wind} scene={idx} lite={lite} />}
        </span>
      )}
      {!asleep && (
        <>
          <span className="sv-dust" aria-hidden="true" />
          <span className="sv-dust sv-dust--far" aria-hidden="true" />
          <span className="sv-grain" aria-hidden="true" />
        </>
      )}
      {!scenes.length && !asleep && (
        <div className="sv-empty">
          <BrandGlyph size={96} />
        </div>
      )}
      <div className="sv-chrome" aria-hidden="true" hidden={asleep}>
        <span className="sv-brand">
          <BrandGlyph size={28} />
          Retro <b>Vault</b>
        </span>
        <Corner onWeather={setWeather} />
        {nowPlaying && !onPa && <NowPlayingCard np={nowPlaying} />}
        <span key={idx} className="sv-progress" style={{ '--sv-dur': `${SCENE_MS}ms` } as CSSProperties} />
      </div>
      <p className={hint ? 'sv-hint' : 'sv-hint sv-hint--gone'}>Move the mouse or press any key to return</p>
    </div>
  );
};

export default Screensaver;
