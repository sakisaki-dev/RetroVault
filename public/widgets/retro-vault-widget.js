// Retro Vault widget for Scriptable (iOS). Loaded by retro-vault-install.js, which fetches this file from the repo on
// every refresh, so the widget updates itself. A league front page in the site's own look: navy, one gold gradient rim
// as the signature, muted pixel kickers, and team colours on every player name (made legible on navy). It shows the
// season story, a spotlight ("Did you know" facts and "From the Vault" history) and rotating panels. It reads one small file, public/data/widget.json, which `npm run rebuild` generates by rule
// (scripts/build_widget_data.py). Every field it reads is optional, so an older cached widget.json still draws.
//
// One script, every size (Scriptable picks the layout from config.widgetFamily):
//   large      three days in turn (footer: season · edition · last update):
//                front page  the story over the champions' photo (game sprites), a spotlight strip, MARKET beside
//                            RECORD CHASE or THE WIRE
//                spotlight   a hero card (his sprite on a club pedestal, OVR · grade, Career Legacy and rank, his
//                            headline career number, card value), DID YOU KNOW, a countdown (MILESTONES, else FINAL
//                            SEASON or ROOM TO GROW from the live save)
//                hot take    the hottest take with its heat flames, the players it names squared up, the evidence line;
//                            HALL OF FAME WATCH and FROM THE VAULT
//   medium     story beside the spotlight
//   small      the spotlight alone
//   lock screen (white only, so iOS tints it): inline glances (the champion and his run of titles, record chases,
//              final seasons, the Gauntlet, milestones, the coach's titles); circular: a record-chase gauge, the
//              Gauntlet, the coach's titles or the spotlight player's silhouette; rectangular: the story headline, the
//              record chase with a bar, the spotlight with his silhouette, or From the Vault
//
// Rotation (local time; nothing depends on the network between refreshes). One turn every 3 hours (SLOT: 00, 03, 06,
// 09, 12, 15, 18, 21), 8 a day:
//   story      one article a day (midnight); the lead is pinned, tagged BREAKING, for the first 2 days after an update
//   large day  each turn the next of front page / spotlight / hot take, offset by the edition seed; in the 2 days after
//              an update the front page shows in half the turns (front, spotlight, front, hot take)
//   pools      the spotlight player, Did you know / From the Vault, the take and the bottom panels each move on a turn;
//              every pool is shuffled with the edition seed, so an item returns only after the whole pool has shown
//              and the order changes with updates
//   refresh    the sooner of 2 hours from now (so updates arrive quickly) and the next 3-hour turn
// Tap: the widget's Parameter field (long-press > Edit Widget > Parameter). Empty = open the site. A Shortcut's name
// = run that Shortcut (shortcuts://run-shortcut?name=...). A URL (http..., or anything with ://) = open it as is.

const SITE = 'https://sakisaki-dev.github.io/RetroVault/';
// Data straight from the repo (works even if GitHub Pages is down or misconfigured); the site is the fallback.
const DATA_SOURCES = [
  'https://raw.githubusercontent.com/sakisaki-dev/RetroVault/retrovault-v2/public/data/',
  SITE + 'data/',
];

// ---------- look: the site's tokens (src/index.css) ----------
const HEX = {
  night: '#090d1a', // --night 228 47% 7%
  night2: '#10162b',
  panel: '#111627', // --panel 226 40% 11%
  panel2: '#1a2137', // --panel-2
  line: '#2b375f', // --line 226 38% 27%
  gold: '#ffc83d', // --gold 43 100% 62%
  goldHi: '#ffe08a',
  goldDeep: '#cb7e0b', // ceremony --cer-gold-deep 36 90% 42%
  chalk: '#f0f3ff', // --chalk 228 100% 97%
  muted: '#9ca7c9', // --muted-foreground 225 30% 70%
  turf: '#27b46b', // --turf
  turfDeep: '#146639', // --turf-deep
  up: '#26d980', // --metric-elite 149 70% 50%
  flag: '#ff4d5e', // --flag 354 100% 65%
};
const C = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, new Color(v)]));
const display = (s) => new Font('AvenirNextCondensed-Heavy', s); // the site's Barlow Condensed headings
const displayB = (s) => new Font('AvenirNextCondensed-Bold', s);
const body = (s) => Font.mediumSystemFont(s);
const mono = (s) => Font.boldMonospacedSystemFont(s); // JetBrains Mono numbers

const TEAMS = {
  Cardinals: ['#97233F', '#000000', 'ari'], Falcons: ['#A71930', '#000000', 'atl'], Ravens: ['#241773', '#9E7C0C', 'bal'],
  Bills: ['#00338D', '#C60C30', 'buf'], Panthers: ['#101820', '#0085CA', 'car'], Bears: ['#0B162A', '#C83803', 'chi'],
  Bengals: ['#000000', '#FB4F14', 'cin'], Browns: ['#311D00', '#FF3C00', 'cle'], Cowboys: ['#869397', '#003594', 'dal'],
  Broncos: ['#FB4F14', '#002244', 'den'], Lions: ['#0076B6', '#B0B7BC', 'det'], Packers: ['#203731', '#FFB612', 'gb'],
  Texans: ['#03202F', '#A71930', 'hou'], Colts: ['#002C5F', '#A2AAAD', 'ind'], Jaguars: ['#006778', '#D7A22A', 'jax'],
  Chiefs: ['#E31837', '#FFB81C', 'kc'], Raiders: ['#A5ACAF', '#000000', 'lv'], Chargers: ['#0080C6', '#FFC20E', 'lac'],
  Rams: ['#FFD100', '#003594', 'lar'], Dolphins: ['#008E97', '#FC4C02', 'mia'], Vikings: ['#4F2683', '#FFC62F', 'min'],
  Patriots: ['#002244', '#C60C30', 'ne'], Saints: ['#D3BC8D', '#101820', 'no'], Giants: ['#0B2265', '#A71930', 'nyg'],
  Jets: ['#125740', '#FFFFFF', 'nyj'], Eagles: ['#004C54', '#A5ACAF', 'phi'], Steelers: ['#FFB612', '#101820', 'pit'],
  '49ers': ['#AA0000', '#B3995D', 'sf'], Seahawks: ['#4C8C2B', '#002244', 'sea'], Buccaneers: ['#D50A0A', '#34302B', 'tb'],
  Titans: ['#4B92DB', '#0C2340', 'ten'], Commanders: ['#5A1414', '#FFB612', 'wsh'],
};
const nick = (team) => {
  if (!team) return '';
  const t = String(team).trim();
  return Object.keys(TEAMS).find((k) => t === k || t.endsWith(' ' + k)) || t;
};
const teamHex = (team) => (TEAMS[nick(team)] || ['#2b375f', '#ffc83d']).slice(0, 2);
const teamColors = (team) => teamHex(team).map((h) => new Color(h));

// ---------- tap target (the widget's Parameter field) ----------
const PARAM = String((typeof args !== 'undefined' && args && args.widgetParameter) || '').trim();
const tap = (siteUrl) => {
  if (!PARAM) return siteUrl;
  if (/^http/i.test(PARAM) || PARAM.includes('://')) return PARAM;
  return 'shortcuts://run-shortcut?name=' + encodeURIComponent(PARAM);
};

// ---------- family and size ----------
const FAMILY = (typeof RV_FAMILY !== 'undefined' && RV_FAMILY) || config.widgetFamily || 'large'; // RV_FAMILY: harness
// Widget sizes in points by portrait screen size: [small side, medium/large width, large height]
const WIDGET_SIZES = {
  '430x932': [170, 364, 382], '428x926': [170, 364, 382], '414x896': [169, 360, 379], '414x736': [159, 348, 357],
  '393x852': [158, 338, 354], '390x844': [158, 338, 354], '375x812': [155, 329, 345], '375x667': [148, 321, 324],
  '320x568': [141, 292, 311],
};
function widgetSize(family) {
  let row = null;
  try {
    const s = Device.screenSize();
    const w = Math.round(Math.min(s.width, s.height)), h = Math.round(Math.max(s.width, s.height));
    row = WIDGET_SIZES[`${w}x${h}`] || (Device.isPad() ? [158, 338, 354] : [Math.round(w * 0.405), Math.round(w * 0.867), Math.round(w * 0.908)]);
  } catch (e) {
    row = [158, 338, 354];
  }
  const [sm, wide, tall] = row;
  if (family === 'small') return { w: sm, h: sm };
  if (family === 'medium') return { w: wide, h: sm };
  return { w: wide, h: tall };
}
const SCALE = (() => {
  try {
    return Device.screenScale() || 3;
  } catch (e) {
    return 3;
  }
})();
const PX = Math.max(1, Math.round(1.34 * SCALE)) / SCALE; // one pixel-font pixel, snapped to device pixels

// ---------- data and images (cached for offline refreshes) ----------
const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.cacheDirectory(), 'retro-vault');
if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true);

async function load(name) {
  const path = fm.joinPath(cacheDir, name.replace(/\//g, '_'));
  for (const base of DATA_SOURCES) {
    try {
      const r = new Request(base + name);
      r.timeoutInterval = 12;
      const text = await r.loadString();
      if (r.response && r.response.statusCode && r.response.statusCode >= 400) continue;
      if (/^\s*</.test(text)) continue; // an HTML error page, not data
      const data = JSON.parse(text); // validate before caching
      fm.writeString(path, text);
      return data;
    } catch (e) {
      /* try the next source */
    }
  }
  if (!fm.fileExists(path)) return null;
  try {
    return JSON.parse(fm.readString(path));
  } catch (e) {
    return null;
  }
}

// Team logos: the ESPN CDN marks the site uses (src/utils/nflTeams.ts), in their dark-background variant, resized by
// the CDN to 120 px, fetched once and kept in the cache.
// Offline and never fetched: null, and the layout falls back to the team colour bar.
async function teamLogo(team) {
  const t = TEAMS[nick(team)];
  if (!t) return null;
  const path = fm.joinPath(cacheDir, `logo-dark-${t[2]}.png`);
  try {
    if (fm.fileExists(path)) return fm.readImage(path);
  } catch (e) {
    /* refetch */
  }
  for (const url of [
    `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500-dark/${t[2]}.png&h=120&w=120`, // light marks for navy
    `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${t[2]}.png&h=120&w=120`,
  ]) {
    try {
      const r = new Request(url);
      r.timeoutInterval = 6;
      const img = await r.loadImage();
      if (img && img.size && img.size.width > 0) {
        try { fm.writeImage(path, img); } catch (e) { /* cache is best effort */ }
        return img;
      }
    } catch (e) {
      /* next */
    }
  }
  return null;
}

// Game sprites (public/data/widget-sprites/, scripts/widget_sprites.py): the site's own Retro Bowl sprites, already
// blown up 4x with nearest-neighbour pixels, so the widget only ever draws them at whole device pixels. widget.json
// names each by a path relative to the site ("data/widget-sprites/rb-ryland-maxwell-eagles.png"): fetched from raw
// GitHub, then Pages, then the cache; a cached copy younger than a day is used without the network. Missing: null,
// and the layout draws without him.
const SITE_SOURCES = ['https://raw.githubusercontent.com/sakisaki-dev/RetroVault/retrovault-v2/public/', SITE];
const SPRITE_FILE_SCALE = 4; // file pixels per game pixel
const SPRITE_CACHE = {};
async function sprite(path) {
  if (!path || typeof path !== 'string') return null;
  if (path in SPRITE_CACHE) return SPRITE_CACHE[path];
  const file = fm.joinPath(cacheDir, 'spr-' + path.replace(/[^a-z0-9.-]/gi, '_'));
  const fresh = (() => {
    try {
      return fm.fileExists(file) && NOW.getTime() - fm.modificationDate(file).getTime() < 864e5;
    } catch (e) {
      return false;
    }
  })();
  let img = null;
  if (fresh) {
    try { img = fm.readImage(file); } catch (e) { img = null; }
  }
  for (const base of img ? [] : SITE_SOURCES) {
    try {
      const r = new Request(base + path);
      r.timeoutInterval = 8;
      const got = await r.loadImage();
      if (got && got.size && got.size.width >= 64) {
        img = got;
        try { fm.writeImage(file, got); } catch (e) { /* cache is best effort */ }
        break;
      }
    } catch (e) {
      /* next source */
    }
  }
  if (!img && fm.fileExists(file)) {
    try { img = fm.readImage(file); } catch (e) { img = null; }
  }
  return (SPRITE_CACHE[path] = img);
}
// Device pixels per game pixel for a wanted size in points (whole device pixels keep the art crisp)
const spriteK = (ptPerPixel) => Math.max(1, Math.round(ptPerPixel * SCALE));
const snap = (v) => Math.round(v * SCALE) / SCALE;
// Draws a sprite with its centre line at x and the bottom of his feet at y (points); k device px per game pixel.
// Every file shares one anchor: centre line 31.5 (pixel centres, so the edge at 32), feet on row 58 of the 64 frame.
function drawSprite(dc, img, x, y, k) {
  if (!img) return;
  const u = k / SCALE;
  dc.drawImageInRect(img, new Rect(snap(x - 32 * u), snap(y - 59 * u), 64 * u, 64 * u));
}

// ---------- time and rotation ----------
// The league moves once a season, so nothing here depends on the network: the day and half-day decide what shows.
const NOW = typeof RV_NOW !== 'undefined' && RV_NOW ? new Date(RV_NOW) : new Date(); // RV_NOW: test harness only
const dayNumber = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const TODAY = dayNumber(NOW);
const SLOT_HOURS = 3;
const SLOT = TODAY * (24 / SLOT_HOURS) + Math.floor(NOW.getHours() / SLOT_HOURS); // 00, 03, 06 ... 21
const dateDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : null;
};
const mod = (a, n) => ((a % n) + n) % n;
function nextTurn(d) {
  const t = new Date(d.getTime());
  t.setHours((Math.floor(t.getHours() / SLOT_HOURS) + 1) * SLOT_HOURS, 0, 0, 0); // 24 rolls over to tomorrow 00:00
  return t;
}
// Refresh within 2 hours (so a pushed update shows up soon) and always at the next 3-hour turn
const refreshAt = (d) => new Date(Math.min(d.getTime() + 2 * 36e5, nextTurn(d).getTime()));
// Deterministic shuffle (mulberry32 seeded by the edition): the same order all season, a new one after each update
function shuffled(list, seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const arr = (x) => (Array.isArray(x) ? x : []);
const sinceUpdate = (data) => {
  const d = dateDay(data.latestUpdateAt);
  return d == null ? null : TODAY - d;
};
const isBreaking = (data) => {
  const s = sinceUpdate(data);
  return s != null && s >= 0 && s < 2;
};

function pickStory(data) {
  const arts = arr(data.stories);
  if (!arts.length) return null;
  const since = sinceUpdate(data);
  if (since != null && since >= 0 && since < 2) return arts[0]; // breaking news: the lead for 2 days
  if (since != null && since >= 2) return arts[(since - 1) % arts.length];
  return arts[mod(TODAY, arts.length)];
}

function pickSpotlight(data) {
  const seed = (data.edition && data.edition.seed) || 1;
  const facts = shuffled(arr(data.didYouKnow), seed);
  const vault = shuffled(arr(data.vault), seed ^ 0x9e3779b9);
  // Each turn alternates Did you know and From the Vault, each pool moving on one item when it comes round
  const turn = Math.floor(SLOT / 2);
  const wantVault = SLOT % 2 === 1;
  const pools = wantVault ? [['vault', vault], ['fact', facts]] : [['fact', facts], ['vault', vault]];
  for (const [kind, pool] of pools) {
    if (pool.length) return { kind, item: pool[mod(turn, pool.length)] };
  }
  const fb = arr(data.spotlightFallback);
  return fb.length ? { kind: 'player', item: { player: fb[mod(TODAY, fb.length)] } } : null;
}

// The large widget's three days: front page (story over the champions' photo, spotlight strip, MARKET + RECORD CHASE
// or THE WIRE), spotlight day (hero card, DID YOU KNOW, a countdown) and hot take day (the take, HALL OF FAME WATCH,
// FROM THE VAULT). Each 3-hour turn moves to the next day, offset by the edition seed; in the 2 days after an update
// (BREAKING) the front page takes every other turn (front, spotlight, front, hot take). A day without data is skipped.
const LARGE_DAYS = ['front', 'spot', 'take'];
function pickDay(data) {
  if (typeof RV_DAY !== 'undefined' && RV_DAY) return RV_DAY; // harness only
  const has = { front: true, spot: arr(data.spotlights).length > 0, take: arr(data.takes).length > 0 };
  const seed = (data.edition && data.edition.seed) || 0;
  const order = isBreaking(data) ? ['front', 'spot', 'front', 'take'] : LARGE_DAYS;
  const days = order.filter((d) => has[d]);
  return days[mod(SLOT + (seed % order.length), days.length)];
}
// The spotlight pool (risers first, then notable actives), shuffled by edition; `offset` keeps two views apart
function pickSpot(data, offset = 0) {
  const pool = shuffled(arr(data.spotlights), ((data.edition && data.edition.seed) || 1) ^ 0x5bd1e995);
  return pool.length ? pool[mod(SLOT + offset, pool.length)] : null;
}
// The hottest takes first (each heat shuffled by edition), one a turn
function pickTake(data) {
  const seed = (data.edition && data.edition.seed) || 1;
  const all = arr(data.takes);
  const pool = [3, 2, 1].flatMap((h) => shuffled(all.filter((t) => (t.heat || 1) === h), seed ^ h));
  return pool.length ? pool[mod(SLOT, pool.length)] : null;
}
function pickPool(list, seed, turn) {
  const pool = shuffled(arr(list), seed);
  return pool.length ? pool[mod(turn, pool.length)] : null;
}

// ---------- pixel art: 5-row font (after the site's Silkscreen kickers) and 7x7 icons ----------
const GLYPHS = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'], B: ['###.', '#..#', '###.', '#..#', '###.'], C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'], E: ['####', '#...', '###.', '#...', '####'], F: ['####', '#...', '###.', '#...', '#...'],
  G: ['.###', '#...', '#.##', '#..#', '.###'], H: ['#..#', '#..#', '####', '#..#', '#..#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..##', '...#', '...#', '#..#', '.##.'], K: ['#..#', '#.#.', '##..', '#.#.', '#..#'], L: ['#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  P: ['###.', '#..#', '###.', '#...', '#...'], Q: ['.##.', '#..#', '#..#', '#.#.', '.#.#'], R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '###.'], T: ['#####', '..#..', '..#..', '..#..', '..#..'], U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  V: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#..#', '#..#', '.##.', '#..#', '#..#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'], Z: ['####', '..#.', '.#..', '#...', '####'],
  0: ['.##.', '#.##', '##.#', '#..#', '.##.'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###.', '...#', '.##.', '#...', '####'],
  3: ['###.', '...#', '.##.', '...#', '###.'], 4: ['#..#', '#..#', '####', '...#', '...#'], 5: ['####', '#...', '###.', '...#', '###.'],
  6: ['.##.', '#...', '###.', '#..#', '.##.'], 7: ['####', '...#', '..#.', '.#..', '.#..'], 8: ['.##.', '#..#', '.##.', '#..#', '.##.'],
  9: ['.##.', '#..#', '.###', '...#', '.##.'], ' ': ['..', '..', '..', '..', '..'], '·': ['.', '.', '#', '.', '.'],
  ':': ['.', '#', '.', '#', '.'], '-': ['...', '...', '###', '...', '...'], '+': ['...', '.#.', '###', '.#.', '...'],
  '%': ['#..#', '...#', '..#.', '.#..', '#..#'], '/': ['...#', '..#.', '.#..', '#...', '....'], '.': ['.', '.', '.', '.', '#'],
  '!': ['#', '#', '#', '.', '#'], "'": ['#', '#', '.', '.', '.'], '&': ['.#..', '#.#.', '.#.#', '#.#.', '.#.#'],
};
const ICONS = {
  trophy: ['d.ggg.d', 'd.ggg.d', '.dgggd.', '..ggg..', '...g...', '..ggg..', '.ddddd.'],
  ticker: ['...gggg', '.....gg', '....g.g', 'g..g...', '.gg....', '.......', 'ddddddd'],
  radio: ['.g...g.', 'g..g..g', '.g.g.g.', '...g...', '..d.d..', '..d.d..', '.d...d.'],
  stopwatch: ['..ggg..', '...g...', '.ddddd.', 'd..g..d', 'd..gg.d', 'd.....d', '.ddddd.'],
  hourglass: ['ggggggg', '.d...d.', '..ddd..', '...g...', '..d.d..', '.dgggd.', 'ggggggg'],
  climb: ['...g...', '..ggg..', '.g.g.g.', '...g...', '...d...', '.d.d.d.', 'ddddddd'],
  pillar: ['...g...', '.ggggg.', 'ggggggg', '.d.d.d.', '.d.d.d.', '.d.d.d.', 'ggggggg'],
  bulb: ['..ggg..', '.g...g.', '.g.g.g.', '.g.g.g.', '..ggg..', '..ddd..', '...d...'],
  flag: ['gggggg.', 'g.g.g..', 'gg.g.g.', 'g.g.g..', 'd......', 'd......', 'd......'],
  trade: ['....g..', 'gggggg.', '....g..', '.......', '..d....', '.dddddd', '..d....'],
  dot: ['.......', '.......', '..ggg..', '..ggg..', '..ggg..', '.......', '.......'],
};
const IMG_CACHE = {};

function rgba(hex, a) {
  return new Color(hex, a == null ? 1 : a);
}
function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('');
}
function newCtx(w, h) {
  const dc = new DrawContext();
  dc.size = new Size(w, h);
  dc.opaque = false;
  dc.respectScreenScale = true;
  return dc;
}
const textWidth = (s) => [...String(s).toUpperCase()].reduce((n, ch) => n + (GLYPHS[ch] || GLYPHS[' '])[0].length + 1, 0) - 1;

// Pixel text, optionally with a leading 7x7 icon; parts = [[text, hex], ...]. Returns { image, w, h } in points.
function pixelLabel(parts, opts = {}) {
  const icon = opts.icon ? ICONS[opts.icon] : null;
  const px = opts.px || PX;
  const list = typeof parts === 'string' ? [[parts, HEX.muted]] : parts; // kickers: muted, like the site's labels
  const cols = (icon ? 7 + 3 : 0) + list.reduce((n, [t]) => n + textWidth(t), 0) + (list.length - 1);
  const rows = icon ? 7 : 5;
  const key = JSON.stringify([list, opts.icon, px, opts.iconHex, opts.iconDeep]);
  if (IMG_CACHE[key]) return IMG_CACHE[key];
  const dc = newCtx(cols * px, rows * px);
  let x = 0;
  if (icon) {
    drawGrid(dc, icon, 0, 0, px, { g: opts.iconHex || HEX.muted, d: opts.iconDeep || mixHex(HEX.muted, HEX.night, 0.35), w: HEX.chalk });
    x = 10;
  }
  const top = icon ? 1 : 0;
  list.forEach(([t, hex], i) => {
    if (i) x += 1;
    for (const ch of String(t).toUpperCase()) {
      const g = GLYPHS[ch] || GLYPHS[' '];
      drawGrid(dc, g, x, top, px, { '#': hex });
      x += g[0].length + 1;
    }
    x -= 1;
  });
  return (IMG_CACHE[key] = { image: dc.getImage(), w: cols * px, h: rows * px });
}
function drawGrid(dc, grid, x0, y0, px, pal) {
  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (!pal[ch]) return;
      dc.setFillColor(new Color(pal[ch]));
      dc.fillRect(new Rect((x0 + x) * px, (y0 + y) * px, px, px));
    }),
  );
}
function addPixel(stack, parts, opts) {
  const p = pixelLabel(parts, opts);
  const im = stack.addImage(p.image);
  im.imageSize = new Size(p.w, p.h);
  return im;
}
// Green up / red down pixel triangle
function arrowImage(up) {
  const g = up ? ['..#..', '.###.', '#####'] : ['#####', '.###.', '..#..'];
  const px = PX * 1.25;
  const dc = newCtx(5 * px, 3 * px);
  drawGrid(dc, g, 0, 0, px, { '#': up ? HEX.up : HEX.flag });
  return { image: dc.getImage(), w: 5 * px, h: 3 * px };
}

// Points around a rounded rectangle, clockwise from the top-left corner's end
function roundedPoints(x, y, w, h, r, step) {
  const pts = [];
  const arc = (cx, cy, a0) => {
    const n = Math.max(4, Math.ceil((Math.PI / 2) * r / step));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (Math.PI / 2) * (i / n);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  const line = (x1, y1, x2, y2) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let i = 1; i < n; i++) pts.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
  };
  arc(x + r, y + r, Math.PI); line(x + r, y, x + w - r, y);
  arc(x + w - r, y + r, -Math.PI / 2); line(x + w, y + r, x + w, y + h - r);
  arc(x + w - r, y + h - r, 0); line(x + w - r, y + h, x + r, y + h);
  arc(x + r, y + h - r, Math.PI / 2); line(x, y + h - r, x, y + r);
  return pts;
}
// The signature rim: a rounded outline that runs bright gold at the top-left to deep amber, fading, at the bottom-right
function strokeGoldRim(dc, x, y, w, h, r, lw, strength = 1) {
  const pts = roundedPoints(x, y, w, h, r, 2);
  const shade = (px, py) => {
    const t = ((px - x) / w + (py - y) / h) / 2; // 0 top-left .. 1 bottom-right
    const hex = t < 0.3 ? mixHex(HEX.goldHi, HEX.gold, t / 0.3) : mixHex(HEX.gold, HEX.goldDeep, (t - 0.3) / 0.7);
    const a = (t < 0.35 ? 0.95 : 0.95 - (t - 0.35) * 1.05) * strength;
    return [hex, Math.max(0.12, Math.min(1, a))];
  };
  dc.setLineWidth(lw);
  let path = null, cur = null;
  const flush = () => {
    if (path) { dc.addPath(path); dc.setStrokeColor(rgba(cur[0], cur[1])); dc.strokePath(); }
  };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const s = shade(a[0], a[1]);
    const q = [s[0], Math.round(s[1] * 20) / 20];
    if (!cur || q[0] !== cur[0] || q[1] !== cur[1]) {
      flush();
      path = new Path();
      path.move(new Point(a[0], a[1]));
      cur = q;
    }
    path.addLine(new Point(b[0], b[1]));
  }
  flush();
}
function fillRounded(dc, rect, r, color) {
  const p = new Path();
  p.addRoundedRect(rect, r, r);
  dc.addPath(p);
  dc.setFillColor(color);
  dc.fillPath();
}
// Vertical gradient by bands (DrawContext has no gradients)
function fillVertical(dc, x, y, w, h, top, bottom, bands = 48, alpha = 1) {
  for (let i = 0; i < bands; i++) {
    dc.setFillColor(rgba(mixHex(top, bottom, i / (bands - 1)), alpha));
    dc.fillRect(new Rect(x, y + (h * i) / bands, w, h / bands + 0.6));
  }
}
function fillDiagonal(dc, w, h, from, to, alpha = 1) {
  const n = 40;
  for (let i = 0; i < n; i++) {
    dc.setFillColor(rgba(mixHex(from, to, i / (n - 1)), alpha));
    dc.fillRect(new Rect((w * i) / n, 0, w / n + 0.6, h));
  }
}
// Fills clipped to a rounded rectangle (DrawContext cannot clip): 1-pt strips inset at the corners, so the card's
// corners stay transparent over any background
function cornerInset(t, len, r) {
  const d = t < r ? r - t : t > len - r ? t - (len - r) : 0;
  return d > 0 ? r - Math.sqrt(Math.max(0, r * r - d * d)) : 0;
}
function roundedRows(dc, w, h, r, top, bottom, alpha = 1) {
  for (let y = 0; y < h; y += 1) {
    const dx = cornerInset(y + 0.5, h, r);
    dc.setFillColor(rgba(mixHex(top, bottom, y / Math.max(1, h - 1)), alpha));
    dc.fillRect(new Rect(dx, y, w - 2 * dx, Math.min(1.4, h - y)));
  }
}
function roundedCols(dc, w, h, r, from, to, alpha = 1) {
  for (let x = 0; x < w; x += 1) {
    const dy = cornerInset(x + 0.5, w, r);
    dc.setFillColor(rgba(mixHex(from, to, x / Math.max(1, w - 1)), alpha));
    dc.fillRect(new Rect(x, dy, Math.min(1.4, w - x), h - 2 * dy));
  }
}
// Soft glow: stacked translucent ellipses (the site's radial-gradient glows)
function glow(dc, cx, cy, rx, ry, hex, peak) {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const k = 1 - i / n;
    dc.setFillColor(rgba(hex, peak / n));
    dc.fillEllipse(new Rect(cx - rx * k, cy - ry * k, 2 * rx * k, 2 * ry * k));
  }
}

// ---------- team colour, made legible on navy ----------
// Names wear their club's colour. A colour must reach 4.5:1 against the panels (#111627, #1a2137) and the night
// (#090d1a); dark navy/black primaries switch to the club's secondary when that is a real colour (Bears orange,
// Patriots red), otherwise the primary's lightness is raised just enough, keeping its hue (Jets green, Colts blue).
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const INK_BACKS = [HEX.panel, HEX.panel2, HEX.night];
function hslHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
// Raise the lightness (keeping the hue, and some saturation so it stays the club's colour) until it reads
function readable(hex) {
  const [h, s0, l0] = hsl(hex);
  const s = s0 < 0.12 ? s0 : Math.max(s0, 0.5);
  for (let l = l0; l <= 0.97; l += 0.015) {
    const c = hslHex(h, s, l);
    if (INK_BACKS.every((b) => contrast(c, b) >= 4.5)) return c;
  }
  return HEX.chalk;
}
const INK = {};
function teamInk(team) {
  const k = nick(team);
  if (!TEAMS[k]) return HEX.chalk;
  if (INK[k]) return INK[k];
  const [p, s] = TEAMS[k];
  const [hue, sat] = hsl(p);
  const navyish = lum(p) < 0.03 && ((hue >= 195 && hue <= 235) || sat < 0.25);
  const chromatic = hsl(s)[1] >= 0.25 && lum(s) < 0.85;
  return (INK[k] = readable(navyish && chromatic ? s : p));
}
const inkColor = (team) => new Color(teamInk(team));

// ---------- backgrounds ----------
// The widget background: navy, a faint lift at the top, scanlines behind the first block, and the one gold
// signature: the gradient rim. Content padding (PAD) keeps everything clear of the rim (inset + stroke + air).
const RIM_INSET = 3, RIM_W = 1.7;
function backgroundImage(w, h, opts = {}) {
  const dc = newCtx(w, h);
  fillVertical(dc, 0, 0, w, h, HEX.night2, HEX.night);
  glow(dc, w * 0.3, -h * 0.15, w * 0.8, h * 0.4, HEX.panel2, 0.5);
  glow(dc, w * 0.85, h * 1.05, w * 0.6, h * 0.3, HEX.turfDeep, 0.1);
  const band = opts.scan || 0;
  for (let y = RIM_INSET + 2; y < band; y += 3) {
    dc.setFillColor(rgba('#ffffff', 0.03 * (1 - y / band)));
    dc.fillRect(new Rect(0, y, w, 1));
  }
  strokeGoldRim(dc, RIM_INSET, RIM_INSET, w - 2 * RIM_INSET, h - 2 * RIM_INSET, opts.radius || 19, RIM_W);
  return dc.getImage();
}
// A plain rounded outline in one colour (cards and panels: the line colour, or a faint team tint)
function strokeRim(dc, x, y, w, h, r, lw, hex, alpha = 1) {
  const p = new Path();
  p.addRoundedRect(new Rect(x, y, w, h), r, r);
  dc.addPath(p);
  dc.setStrokeColor(rgba(hex, alpha));
  dc.setLineWidth(lw);
  dc.strokePath();
}
// A card behind a fixed-size stack: panel fill, optional team stripe, dimmed logo watermark, a quiet rim
function cardImage(w, h, opts = {}) {
  const dc = newCtx(w, h);
  const r = opts.radius || 11;
  const fill = (alpha) => roundedRows(dc, w, h, r, HEX.panel2, HEX.panel, alpha);
  fill(0.94);
  if (opts.tint) roundedCols(dc, w, h, r, opts.tint, HEX.panel, 0.16);
  if (opts.logo) {
    // A watermark kept inside the card (images cannot be clipped), dimmed by a second wash of the fill
    const s = Math.min(h - 8, w * 0.5);
    dc.drawImageInRect(opts.logo, new Rect(w - s - r * 0.5, (h - s) / 2, s, s));
    fill(0.86);
    if (opts.tint) roundedCols(dc, w, h, r, opts.tint, HEX.panel, 0.12);
  }
  if (opts.stripe) {
    for (let y = 0; y < h; y += 1) {
      const dx = cornerInset(y + 0.5, h, r);
      if (dx >= 4) continue;
      dc.setFillColor(new Color(opts.stripe));
      dc.fillRect(new Rect(dx, y, 4 - dx, Math.min(1.4, h - y)));
    }
  }
  strokeRim(dc, 0.6, 0.6, w - 1.2, h - 1.2, r - 0.3, 1, opts.rim || HEX.line, opts.rimAlpha || 1);
  return dc.getImage();
}
// A small pill tag (BREAKING) in the site's flag red
function tagImage(text, hex = HEX.flag) {
  const t = pixelLabel([[text, '#ffffff']]);
  const w = t.w + 7, h = t.h + 3.4;
  const dc = newCtx(w, h);
  fillRounded(dc, new Rect(0, 0, w, h), 2, new Color(hex));
  dc.drawImageInRect(t.image, new Rect(3.5, 1.7, t.w, t.h));
  return { image: dc.getImage(), w, h };
}
// Progress bar in the player's team colour
function barImage(w, pct, hex, h = 3.5) {
  const dc = newCtx(w, h);
  fillRounded(dc, new Rect(0, 0, w, h), h / 2, rgba('#ffffff', 0.1));
  const fw = Math.max(h, (w * Math.max(0, Math.min(100, pct))) / 100);
  roundedCols(dc, fw, h, h / 2, mixHex(hex, HEX.night, 0.45), hex);
  return dc.getImage();
}
// Place badge (1, 2, 3): a quiet chip with a pixel digit
function rankBadge(n) {
  const s = 11;
  const dc = newCtx(s, s);
  fillRounded(dc, new Rect(0, 0, s, s), 2.5, new Color(n === 1 ? mixHex(HEX.line, HEX.chalk, 0.25) : HEX.line));
  const g = GLYPHS[String(n)];
  const px = PX * 0.9;
  g.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '#') return;
    dc.setFillColor(new Color(HEX.chalk));
    dc.fillRect(new Rect((s - row.length * px) / 2 + x * px, (s - 5 * px) / 2 + y * px, px, px));
  }));
  return dc.getImage();
}
// The site's brand glyph (src/components/brand/BrandMark.tsx): only the circular lock screen fallback uses it
function brandGlyph() {
  const k = 'brand';
  if (IMG_CACHE[k]) return IMG_CACHE[k];
  const s = 4;
  const dc = newCtx(16 * s, 16 * s);
  fillRounded(dc, new Rect(0, 0, 16 * s, 16 * s), 3 * s, new Color(HEX.turfDeep));
  const r = (x, y, w, h, c) => { dc.setFillColor(new Color(c)); dc.fillRect(new Rect(x * s, y * s, w * s, h * s)); };
  r(0, 7, 16, 1, '#2d7a50');
  r(5, 4, 6, 1, '#8a4b1f'); r(3, 5, 10, 1, '#8a4b1f'); r(2, 6, 12, 4, '#9c5726'); r(3, 10, 10, 1, '#7a3f17'); r(5, 11, 6, 1, '#7a3f17');
  r(5, 7, 6, 1, '#ffffff'); r(6, 6, 1, 3, '#ffffff'); r(8, 6, 1, 3, '#ffffff'); r(10, 6, 1, 3, '#ffffff');
  r(13, 1, 2, 2, HEX.gold);
  return (IMG_CACHE[k] = dc.getImage());
}

// ---------- shared pieces ----------
function label(stack, text, font, color, lines) {
  const t = stack.addText(text);
  t.font = font; t.textColor = color;
  if (lines) t.lineLimit = lines;
  return t;
}
function kindLabel(kind) {
  return ({ lead: 'LEAD', feature: 'FEATURE', trade: 'TRADES', rise: 'RISING', fall: 'FALLING', rivalry: 'RIVALRY',
    chase: 'RECORD WATCH', milestone: 'MILESTONES', wherenow: 'WHERE ARE THEY NOW' })[kind] || 'STORY';
}
function vaultWhat(item) {
  const named = { superbowl: 'SUPER BOWL', record: 'RECORD BOARD', hof: 'HALL OF FAME' };
  return item.kind in named ? named[item.kind] : String(item.kind || '').replace(/-/g, ' ').toUpperCase();
}
function vaultIcon(item) {
  return item.kind === 'hof' ? 'pillar' : item.kind === 'record' ? 'stopwatch' : 'trophy';
}
// "Y82 · ED 34 · Oct 26, 23:00": the season and edition folded into the footer
function footLine(data) {
  const m = /^(Y\d+)\s*·\s*Edition\s*(\d+)/i.exec((data.edition && data.edition.label) || '');
  const season = (m && m[1]) || data.season || '';
  const when = String(data.updatedLabel || '').replace(new RegExp('^' + season + '\\s*·\\s*'), '');
  return [season, m ? 'ED ' + m[2] : null, when].filter(Boolean).join(' · ');
}
// A fact that opens with the player's name loses it when the coloured name sits above it ("NICK BOLTON" / "makes…")
function afterName(text, name) {
  const t = String(text || '');
  return name && t.startsWith(name + ' ') ? t.slice(name.length + 1) : t;
}

// Story block: team colour bar, pixel kicker (+ BREAKING), condensed headline, dek, the lead team's logo
function story(parent, data, art, size, logo, opts = {}) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.topAlignContent();
  row.size = size;
  row.url = tap(SITE + '#timeline');
  const bar = row.addStack();
  bar.size = new Size(3, 0);
  bar.backgroundColor = art && art.team ? inkColor(art.team) : C.line;
  bar.cornerRadius = 1.5;
  row.addSpacer(8);
  const col = row.addStack();
  col.layoutVertically();
  const kick = col.addStack();
  kick.layoutHorizontally();
  kick.centerAlignContent();
  const season = data.storySeason || data.season || '';
  addPixel(kick, art ? (opts.short ? `${season} ${kindLabel(art.kind)}` : `THE ${season} SEASON · ${kindLabel(art.kind)}`) : `${data.season || ''} · WHAT CHANGED`);
  if (art && isBreaking(data) && art === arr(data.stories)[0]) {
    kick.addSpacer(5);
    const tag = tagImage('BREAKING');
    const im = kick.addImage(tag.image);
    im.imageSize = new Size(tag.w, tag.h);
  }
  col.addSpacer(opts.short ? 4 : 5);
  const headline = art ? art.headline : (arr(data.headlines)[0] || {}).text || 'No news yet';
  const hl = label(col, headline, display(opts.hl || 20), C.chalk, opts.hlLines || 2);
  hl.minimumScaleFactor = 0.75;
  if (art && art.dek && opts.dek !== false) {
    col.addSpacer(3);
    const first = (/^(.+?[.!?])\s/.exec(art.dek + ' ') || [null, art.dek])[1]; // the dek's first sentence
    // About 26 condensed characters a line beside the logo: a wrapped headline leaves room for fewer dek lines
    const dk = label(col, first, body(opts.dekSize || 11), C.muted, opts.dekLines || (headline.length <= 26 ? 3 : 2));
    dk.minimumScaleFactor = 0.85;
  }
  col.addSpacer();
  if (logo && opts.logo !== false) {
    row.addSpacer(6);
    const im = row.addImage(logo);
    im.imageSize = new Size(opts.logoSize || 30, opts.logoSize || 30);
  } else row.addSpacer();
}

// Spotlight card (fixed size, its own background image): a player card (team stripe, faint team tint and rim, logo
// watermark, the name in team colour, OVR) or a history card (team stripe, chalk title)
function spotlight(parent, spot, cards, size, logo, opts = {}) {
  const it = spot.item;
  const key = it.player;
  const card = key ? cards[key] : null;
  const name = key ? key.split(':').slice(1).join(':') : null;
  const isVault = spot.kind === 'vault';
  const team = it.team || (card && card.team);
  const ink = teamInk(team);
  const box = parent.addStack();
  box.size = size;
  box.layoutHorizontally();
  box.centerAlignContent();
  const compact = !!opts.compact;
  const kickerIcon = isVault ? vaultIcon(it) : spot.kind === 'fact' ? 'bulb' : 'pillar';
  const player = card && card.ovr != null;
  // The kicker never runs under the OVR column: drop the section name, then the season, until it fits
  const room = size.width - 23 - (player && !compact ? 54 : 0) - 10 * PX;
  const tries = isVault ? [['FROM THE VAULT', vaultWhat(it), it.when], ['FROM THE VAULT', it.when], ['FROM THE VAULT']]
    : [[spot.kind === 'fact' ? 'DID YOU KNOW' : 'SPOTLIGHT']];
  const kickerText = tries.map((t) => t.filter(Boolean).join(' · ')).find((t) => textWidth(t) * PX <= room) || tries[tries.length - 1][0];
  box.backgroundImage = cardImage(size.width, size.height, {
    stripe: team ? ink : null, tint: player ? ink : null, logo,
    rim: player ? mixHex(ink, HEX.line, 0.55) : HEX.line,
  });
  box.setPadding(8, 13, 8, 11);
  box.url = player ? tap(SITE + '#stats/deepdive?p=' + encodeURIComponent(key)) : tap(SITE + (it.kind === 'hof' ? '#hof' : '#timeline'));
  const left = box.addStack();
  left.layoutVertically();
  addPixel(left, kickerText, { icon: kickerIcon });
  left.addSpacer(4);
  // Title line: the player's name in his team colour; a history card's title in chalk
  const isHofOrFact = !isVault || it.kind === 'hof';
  const title = player && isHofOrFact ? name : isVault ? it.title || name : name;
  const titleInk = title && title === name && team ? new Color(ink) : C.chalk;
  if (title) {
    const t = label(left, title.toUpperCase(), display(compact ? 14 : 16), titleInk, 1);
    t.minimumScaleFactor = 0.7;
    left.addSpacer(1);
  }
  const text = spot.kind === 'player'
    ? `${card.nick ? '"' + card.nick + '" · ' : ''}${key.split(':')[0]} · Career Legacy ${fmt(card.legacy || 0)}`
    : title === name ? afterName(it.text, name) : it.text || '';
  const tx = label(left, text, body(opts.textSize || 10.5), C.chalk, opts.lines || 4);
  tx.minimumScaleFactor = 0.85;
  left.addSpacer();
  if (!player || compact) {
    box.addSpacer();
    return;
  }
  box.addSpacer(6);
  const right = box.addStack();
  right.layoutVertically();
  right.size = new Size(48, 0);
  const top = right.addStack();
  top.addSpacer();
  label(top, String(card.ovr), display(26), Color.white(), 1);
  const ch = card.chg || 0;
  const vline = right.addStack();
  vline.centerAlignContent();
  vline.addSpacer();
  label(vline, `${card.grade || 'OVR'}${ch ? ' ' : ''}`, mono(10), C.muted, 1);
  if (ch) {
    const a = arrowImage(ch > 0);
    const im = vline.addImage(a.image);
    im.imageSize = new Size(a.w, a.h);
    vline.addSpacer(2);
    label(vline, `${Math.abs(ch)}%`, mono(10), ch > 0 ? C.up : C.flag, 1);
  }
}

// ---------- bottom panels (large) ----------
function panelShell(cols, title, icon, size) {
  const p = cols.addStack();
  p.layoutVertically();
  p.size = size;
  p.setPadding(8, 10, 8, 10);
  p.backgroundImage = cardImage(size.width, size.height, { radius: 10 });
  addPixel(p, title, { icon });
  p.addSpacer(6);
  return p;
}
const rowsFor = (h, per) => Math.max(1, Math.floor((h - 30) / per));
function nameText(stack, text, team, size = 12.5) {
  const n = label(stack, text || '', displayB(size), inkColor(team), 1);
  n.minimumScaleFactor = 0.75;
  return n;
}

function panelMarket(p, data, size) {
  const movers = arr(data.movers);
  p.url = tap(SITE + '#collection');
  if (!movers.length) label(p, 'Quiet since the last update', body(10.5), C.muted, 3);
  movers.slice(0, rowsFor(size.height, 20)).forEach((m, i) => {
    if (i) p.addSpacer(6);
    const row = p.addStack();
    row.centerAlignContent();
    nameText(row, m.last, m.team, 13);
    row.addSpacer();
    const a = arrowImage(m.pct > 0);
    const im = row.addImage(a.image);
    im.imageSize = new Size(a.w, a.h);
    row.addSpacer(3);
    label(row, `${Math.abs(m.pct)}%`, mono(10.5), m.pct > 0 ? C.up : C.flag, 1);
  });
  p.addSpacer();
}
function panelWire(p, data, size, art) {
  const news = arr(data.headlines).slice(art ? 0 : 1, (art ? 0 : 1) + rowsFor(size.height, 26));
  p.url = tap(SITE + '#timeline');
  const icon = { chase: 'stopwatch', trade: 'trade', superbowl: 'trophy', hof: 'pillar', milestone: 'flag', record: 'stopwatch' };
  news.forEach((h, i) => {
    if (i) p.addSpacer(5);
    const row = p.addStack();
    row.topAlignContent();
    // The bullet wears the headline's club colour (WidgetText cannot colour part of a line)
    const hex = h.team ? teamInk(h.team) : HEX.muted;
    const ic = pixelLabel([], { icon: icon[h.kind] || 'dot', px: 1.1, iconHex: hex, iconDeep: hex });
    const im = row.addImage(ic.image);
    im.imageSize = new Size(7.7, 7.7);
    row.addSpacer(5);
    const t = label(row, h.text, body(10.5), C.chalk, 2);
    t.minimumScaleFactor = 0.85;
  });
  p.addSpacer();
}
function panelHof(p, data, size) {
  p.url = tap(SITE + '#hof');
  const inner = size.width - 20;
  arr(data.hofWatch).slice(0, rowsFor(size.height, 22)).forEach((x, i) => {
    if (i) p.addSpacer(5);
    const row = p.addStack();
    row.centerAlignContent();
    const b = row.addImage(rankBadge(i + 1));
    b.imageSize = new Size(11, 11);
    row.addSpacer(5);
    nameText(row, x.last, x.team);
    row.addSpacer();
    // Hall of Fame Score against the bar (eligible once he retires); an older feed carried Career Legacy points
    label(row, x.score != null ? (x.toGo > 0 ? `${fmt(x.toGo)} pts to go` : `score ${x.score} · on track`) : `${fmt(x.toGo || 0)} to go`, mono(9), C.muted, 1);
    p.addSpacer(3);
    const bar = p.addImage(barImage(inner, x.pct || 0, teamInk(x.team)));
    bar.imageSize = new Size(inner, 3.5);
  });
  p.addSpacer();
}
function panelChase(p, data, size) {
  p.url = tap(SITE + '#timeline');
  const inner = size.width - 20;
  arr(data.chases).slice(0, rowsFor(size.height, 32)).forEach((x, i) => {
    if (i) p.addSpacer(6);
    const row = p.addStack();
    row.centerAlignContent();
    nameText(row, x.last, x.team);
    row.addSpacer();
    label(row, `${x.pct}%`, mono(10), C.chalk, 1);
    p.addSpacer(3);
    const bar = p.addImage(barImage(inner, x.pct || 0, teamInk(x.team)));
    bar.imageSize = new Size(inner, 3.5);
    p.addSpacer(2);
    const sub = label(p, `${fmt(x.toGo || 0)} ${x.unit || ''} to go${x.holder ? ' · ' + x.holder : ''}`, body(8.5), C.muted, 1);
    sub.minimumScaleFactor = 0.8;
  });
  p.addSpacer();
}
function panelMiles(p, data, size) {
  p.url = tap(SITE + '#timeline');
  const all = arr(data.milestones);
  const n = Math.min(all.length, rowsFor(size.height, 27));
  const start = all.length ? mod(SLOT, all.length) : 0; // a different set each time the panel comes round
  Array.from({ length: n }, (_, i) => all[(start + i) % all.length]).forEach((x, i) => {
    if (i) p.addSpacer(5);
    nameText(p, x.last, x.team);
    const sub = label(p, `${fmt(x.toGo || 0)} ${x.unit || ''} to ${fmt(x.target || 0)}`, mono(9), C.muted, 1);
    sub.minimumScaleFactor = 0.8;
  });
  p.addSpacer();
}
// Live-save countdowns. Stars are the game's own rating (half-stars allowed): "3.5", "5"
const starText = (n) => (Math.round(n * 2) % 2 ? (Math.round(n * 2) / 2).toFixed(1) : String(Math.round(n)));
const leftText = (x) => (x.seasonsLeft > 0 ? `${x.seasonsLeft + 1} seasons left` : 'final season');
function panelClock(p, data, size) {
  p.url = tap(SITE + '#season');
  const all = arr(data.retirements);
  const n = Math.min(all.length, rowsFor(size.height, 27));
  const start = all.length ? mod(SLOT, all.length) : 0;
  Array.from({ length: n }, (_, i) => all[(start + i) % all.length]).forEach((x, i) => {
    if (i) p.addSpacer(5);
    nameText(p, x.last, x.team);
    const sub = label(p, `${x.pos || ''} · age ${x.age || '?'} · ${leftText(x)}`, mono(9), C.muted, 1);
    sub.minimumScaleFactor = 0.8;
  });
  p.addSpacer();
}
function panelRise(p, data, size) {
  p.url = tap(SITE + '#season');
  const inner = size.width - 20;
  arr(data.ceilings).slice(0, rowsFor(size.height, 32)).forEach((x, i) => {
    if (i) p.addSpacer(6);
    const row = p.addStack();
    row.centerAlignContent();
    nameText(row, x.last, x.team);
    row.addSpacer();
    label(row, `${starText(x.stars || 0)}→${starText(x.ceiling || 0)}★`, mono(10), C.chalk, 1);
    p.addSpacer(3);
    // the bar is the star rating now as a share of the ceiling
    const bar = p.addImage(barImage(inner, x.ceiling ? Math.round((x.stars / x.ceiling) * 100) : 0, teamInk(x.team)));
    bar.imageSize = new Size(inner, 3.5);
    p.addSpacer(2);
    const sub = label(p, `${x.pos || ''} · age ${x.age || '?'} · ${starText(x.room || 0)} to grow`, body(8.5), C.muted, 1);
    sub.minimumScaleFactor = 0.8;
  });
  p.addSpacer();
}
const PANELS = {
  market: ['MARKET', 'ticker', panelMarket], wire: ['THE WIRE', 'radio', panelWire], hof: ['HOF WATCH', 'pillar', panelHof],
  chase: ['RECORD CHASE', 'stopwatch', panelChase], miles: ['MILESTONES', 'flag', panelMiles],
  clock: ['FINAL SEASON', 'hourglass', panelClock], rise: ['ROOM TO GROW', 'climb', panelRise],
};

// ---------- layouts ----------
// Content padding: the rim sits RIM_INSET in and is RIM_W wide; PAD leaves at least 10 pt of air inside it
const PAD = { top: 15, side: 16, bottom: 15 };
function base(sz, opts = {}) {
  const w = new ListWidget();
  w.backgroundColor = C.night;
  try {
    w.backgroundImage = backgroundImage(sz.w, sz.h, opts);
  } catch (e) {
    const bg = new LinearGradient();
    bg.colors = [C.night2, C.night];
    bg.locations = [0, 1];
    w.backgroundGradient = bg;
  }
  w.setPadding(PAD.top, PAD.side, PAD.bottom, PAD.side);
  w.url = tap(SITE + '#timeline');
  w.refreshAfterDate = refreshAt(NOW);
  return w;
}
function offline(w) {
  const t = w.addText('Retro Vault');
  t.font = display(20); t.textColor = C.chalk;
  w.addSpacer(4);
  const m = w.addText('Could not reach the site yet. It will try again soon.');
  m.font = body(12); m.textColor = C.muted;
  return w;
}
const spotTeamOf = (data, spot) => spot && (spot.item.team || ((data.cards || {})[spot.item.player] || {}).team);

// ---------- large: three days (pickDay) ----------
const displayI = (s) => new Font('AvenirNextCondensed-HeavyItalic', s);
const ordinal = (n) => {
  const t = n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH';
  return `${n}${t}`;
};
const KICK_GOLD = '#c9a14a';
const sizedStack = (parent, w, h) => {
  const s = parent.addStack();
  s.size = new Size(w, h);
  return s;
};

// Footer in pixel type: "Y94 · ED 2" left, "UPDATED NOV 14" right
function pixelFooter(w, data) {
  const m = /^(Y\d+)\s*·\s*Edition\s*(\d+)/i.exec((data.edition && data.edition.label) || '');
  const season = (m && m[1]) || data.season || '';
  const left = [season, m ? 'ED ' + m[2] : null].filter(Boolean).join(' · ');
  const when = String(data.updatedLabel || '').replace(new RegExp('^' + season + '\\s*·\\s*'), '').split(',')[0].trim();
  const foot = w.addStack();
  foot.centerAlignContent();
  addPixel(foot, [[left, mixHex(HEX.muted, HEX.night, 0.25)]]);
  foot.addSpacer();
  if (when) addPixel(foot, [['UPDATED ' + when, mixHex(HEX.muted, HEX.night, 0.25)]]);
}

// A rounded card filled top to bottom, with a quiet rim (the new days' panels)
function plainCard(w, h, top, bottom, rim, rimAlpha = 1, r = 12) {
  const dc = newCtx(w, h);
  roundedRows(dc, w, h, r, top, bottom);
  strokeRim(dc, 0.6, 0.6, w - 1.2, h - 1.2, r - 0.3, 1, rim, rimAlpha);
  return dc;
}
// Fades a card's left part toward `hex` (text legibility over art), clipped to the rounded corners
function fadeLeft(dc, w, h, r, hex, upto, peak) {
  for (let x = 0; x < upto; x += 1) {
    const dy = cornerInset(x + 0.5, w, r);
    dc.setFillColor(rgba(hex, peak * Math.pow(1 - x / upto, 1.3)));
    dc.fillRect(new Rect(x, dy, 1, h - 2 * dy));
  }
}

// ---- A: front page ----
// The champions' photo: the club's colours, the star celebrating in the middle, two ring holders a step behind
function photoImage(w, h, team, figs) {
  const r = 14;
  const p = teamHex(team)[0];
  const dc = newCtx(w, h);
  roundedRows(dc, w, h, r, mixHex(p, '#ffffff', 0.1), mixHex(p, HEX.night, 0.6));
  glow(dc, w - 70, h, 90, 60, mixHex(p, '#ffffff', 0.45), 0.35);
  const star = figs.find((f) => f.star);
  const others = figs.filter((f) => !f.star);
  const kO = spriteK(1.34), kS = spriteK(1.9);
  const cx = w - 66, base = h + 2;
  others.forEach((f, i) => drawSprite(dc, f.img, cx + (i ? 1 : -1) * (14 * kO / SCALE + 12), base - 3, kO));
  if (star) drawSprite(dc, star.img, cx, base + 2, kS);
  fadeLeft(dc, w, h, r, mixHex(p, HEX.night, 0.82), w * 0.7, 0.94);
  strokeRim(dc, 0.6, 0.6, w - 1.2, h - 1.2, r - 0.3, 1, mixHex(p, '#a5acaf', 0.6), 0.6);
  return dc.getImage();
}
// A long headline loses its subtitle after the colon (the dek carries the rest)
const shortHeadline = (h) => (h.length > 48 && h.includes(': ') ? h.split(': ')[0] : h);

function frontStory(parent, data, art, size, figs) {
  const team = (data.photo && data.photo.team) || (art && art.team) || (data.champion || {}).winner;
  const box = sizedStack(parent, size.width, size.height);
  box.layoutHorizontally();
  box.topAlignContent();
  box.setPadding(10, 12, 10, 0);
  box.url = tap(SITE + '#timeline');
  box.backgroundImage = photoImage(size.width, size.height, team, figs);
  const col = box.addStack();
  col.layoutVertically();
  col.size = new Size(size.width - 12 - (figs.length ? 112 : 16), size.height - 20);
  const kick = col.addStack();
  kick.centerAlignContent();
  const p = teamHex(team)[0];
  const soft = mixHex('#ffffff', p, 0.25);
  if (art && isBreaking(data) && art === arr(data.stories)[0]) {
    const tag = tagImage('BREAKING');
    const im = kick.addImage(tag.image);
    im.imageSize = new Size(tag.w, tag.h);
    kick.addSpacer(5);
  }
  const season = data.storySeason || data.season || '';
  addPixel(kick, [[art ? `${season} ${art.kind === 'lead' ? 'STORY' : kindLabel(art.kind)}` : `${season} · WHAT CHANGED`, soft]]);
  col.addSpacer(5);
  const headline = art ? shortHeadline(art.headline) : (arr(data.headlines)[0] || {}).text || 'No news yet';
  const hl = label(col, headline.toUpperCase(), display(19), Color.white(), 3);
  hl.minimumScaleFactor = 0.7;
  if (art && art.dek) {
    col.addSpacer(4);
    const first = (/^(.+?[.!?])\s/.exec(art.dek + ' ') || [null, art.dek])[1];
    const dk = label(col, first, body(10.5), new Color(soft), headline.length > 40 ? 2 : 3);
    dk.minimumScaleFactor = 0.85;
  }
  col.addSpacer();
  box.addSpacer();
}

// Head and shoulders (game rows 6-42, 32 wide), crisp
function bustImage(img, hpt) {
  const k = spriteK(hpt / 36);
  const u = k / SCALE;
  const dc = newCtx(32 * u, 36 * u);
  drawSprite(dc, img, 16 * u, 53 * u, k);
  return { image: dc.getImage(), w: 32 * u, h: 36 * u };
}
const statLine = (sp, card) => [sp.pos, card.ovr != null ? `OVR ${card.ovr}` : null,
  sp.stat ? `${fmt(sp.stat.value)} ${sp.stat.label}` : null].filter(Boolean).join(' · ');
function changeText(parent, ch, size) {
  const t = label(parent, ch ? `${ch > 0 ? '+' : '−'}${Math.abs(ch)}%` : '0%', display(size), ch > 0 ? C.up : ch < 0 ? C.flag : C.muted, 1);
  t.minimumScaleFactor = 0.7;
  return t;
}

function spotStrip(parent, data, sp, size, img) {
  const card = (data.cards || {})[sp.player] || {};
  const ink = teamInk(sp.team);
  const box = sizedStack(parent, size.width, size.height);
  box.layoutHorizontally();
  box.centerAlignContent();
  box.backgroundImage = cardImage(size.width, size.height, { stripe: ink, tint: ink, rim: mixHex(ink, HEX.line, 0.55), radius: 12 });
  box.setPadding(0, 7, 0, 12);
  box.url = tap(SITE + '#stats/deepdive?p=' + encodeURIComponent(sp.player));
  if (img) {
    const b = bustImage(img, size.height - 6);
    const im = box.addImage(b.image);
    im.imageSize = new Size(b.w, b.h);
    box.addSpacer(6);
  } else box.addSpacer(6);
  const col = box.addStack();
  col.layoutVertically();
  addPixel(col, [['SPOTLIGHT', KICK_GOLD]]);
  col.addSpacer(2);
  const row = col.addStack();
  row.centerAlignContent();
  const n = label(row, sp.player.split(':').slice(1).join(':'), display(16), new Color(ink), 1);
  n.minimumScaleFactor = 0.7;
  row.addSpacer(5);
  const d = label(row, statLine(sp, card), body(10), C.muted, 1);
  d.minimumScaleFactor = 0.75;
  box.addSpacer();
  changeText(box, card.chg || 0, 15);
}

// ---- B: spotlight day ----
function heroImage(w, h, leftW, sp, img) {
  const r = 14;
  const p = teamHex(sp.team)[0];
  const ink = teamInk(sp.team);
  const dc = newCtx(w, h);
  roundedRows(dc, w, h, r, mixHex(p, '#ffffff', 0.12), mixHex(p, HEX.night, 0.45));
  // the stat side: the panel colour, right corners rounded
  for (let y = 0; y < h; y += 1) {
    const dx = cornerInset(y + 0.5, h, r);
    dc.setFillColor(new Color(mixHex(HEX.panel, HEX.panel2, 0.35)));
    dc.fillRect(new Rect(leftW, y, w - leftW - dx, Math.min(1.4, h - y)));
  }
  glow(dc, leftW / 2, h * 0.88, leftW * 0.55, h * 0.3, HEX.gold, 0.32);
  dc.setFont(displayI(76));
  dc.setTextColor(rgba('#ffffff', 0.08));
  dc.setTextAlignedCenter();
  dc.drawTextInRect(sp.pos || '', new Rect(0, -4, leftW, 90));
  const k = spriteK(Math.min(2.7, (h - 14) / 53));
  const u = k / SCALE;
  dc.setFillColor(rgba('#000000', 0.45));
  dc.fillEllipse(new Rect(leftW / 2 - 15 * u, h - 8 - 3 * u, 30 * u, 5 * u));
  drawSprite(dc, img, leftW / 2, h - 7, k);
  strokeRim(dc, 0.6, 0.6, w - 1.2, h - 1.2, r - 0.3, 1, mixHex(ink, HEX.line, 0.5), 0.8);
  return dc.getImage();
}
function statTile(parent, size, value, color, kicker) {
  const t = sizedStack(parent, size.width, size.height);
  t.layoutVertically();
  t.setPadding(4, 7, 4, 6);
  t.backgroundColor = new Color(HEX.panel2);
  t.cornerRadius = 6;
  const v = label(t, value, display(17), color, 1);
  v.minimumScaleFactor = 0.6;
  t.addSpacer();
  addPixel(t, kicker, { px: PX * 0.85 });
}
function heroCard(parent, data, sp, size, img) {
  const card = (data.cards || {})[sp.player] || {};
  const name = sp.player.split(':').slice(1).join(':');
  const leftW = Math.round(size.width * 0.4);
  const box = sizedStack(parent, size.width, size.height);
  box.layoutHorizontally();
  box.url = tap(SITE + '#stats/deepdive?p=' + encodeURIComponent(sp.player));
  box.backgroundImage = heroImage(size.width, size.height, leftW, sp, img);
  box.addSpacer(leftW);
  const col = box.addStack();
  col.layoutVertically();
  col.setPadding(10, 11, 10, 10);
  const innerW = size.width - leftW - 21;
  const kick = card.nick ? `SPOTLIGHT · ${card.nick}` : 'SPOTLIGHT';
  addPixel(col, [[textWidth(kick) * PX <= innerW ? kick : 'SPOTLIGHT', KICK_GOLD]]);
  col.addSpacer(4);
  const n = label(col, name.toUpperCase(), displayI(23), inkColor(sp.team), 2);
  n.minimumScaleFactor = 0.6;
  col.addSpacer();
  const tw = Math.floor((innerW - 4) / 2), th = Math.min(38, Math.floor((size.height - 20) * 0.27));
  const rows = [
    [[card.ovr != null ? `${card.ovr}${card.grade ? ' · ' + card.grade : ''}` : '—', C.chalk, 'OVR · GRADE'],
      [fmt(card.legacy || 0), new Color(HEX.gold), sp.rank ? `LEGACY · ${ordinal(sp.rank)}` : 'LEGACY']],
    [[sp.stat ? fmt(sp.stat.value) : String(card.ovr || ''), C.chalk, sp.stat ? `${sp.stat.label}${sp.stat.record ? ' · REC' : ''}` : 'OVR'],
      [card.chg ? `${card.chg > 0 ? '+' : '−'}${Math.abs(card.chg)}%` : '0%', card.chg > 0 ? C.up : card.chg < 0 ? C.flag : C.muted, 'CARD VALUE']],
  ];
  rows.forEach((pair, i) => {
    if (i) col.addSpacer(4);
    const row = col.addStack();
    pair.forEach(([v, c, k], j) => {
      if (j) row.addSpacer(4);
      statTile(row, new Size(tw, th), v, c, k);
    });
  });
}
function factPanel(parent, item, size) {
  const p = sizedStack(parent, size.width, size.height);
  p.layoutVertically();
  p.setPadding(8, 11, 8, 11);
  p.backgroundImage = cardImage(size.width, size.height, { radius: 12, stripe: item && item.team ? teamInk(item.team) : null });
  p.url = tap(SITE + '#timeline');
  addPixel(p, 'DID YOU KNOW', { icon: 'bulb' });
  p.addSpacer(4);
  const t = label(p, item ? item.text : 'Nothing new yet.', body(11.5), C.chalk, Math.max(2, Math.floor((size.height - 26) / 14)));
  t.minimumScaleFactor = 0.8;
  p.addSpacer();
}
// A wide row: the name in club ink, a bar, a number on the right
function barRow(p, inner, nameW, rightW, x, pct, right, rightColor) {
  const row = p.addStack();
  row.centerAlignContent();
  const ns = row.addStack();
  ns.size = new Size(nameW, 0);
  nameText(ns, x.last, x.team, 12);
  ns.addSpacer();
  row.addSpacer(6);
  const bw = inner - nameW - rightW - 12;
  const bar = row.addImage(barImage(bw, pct, teamInk(x.team), 5));
  bar.imageSize = new Size(bw, 5);
  row.addSpacer(6);
  const rs = row.addStack();
  rs.size = new Size(rightW, 0);
  rs.addSpacer();
  const t = label(rs, right, mono(9.5), rightColor || C.muted, 1);
  t.minimumScaleFactor = 0.7;
}
function panelMilesBars(p, data, size) {
  p.url = tap(SITE + '#timeline');
  const all = arr(data.milestones);
  const n = Math.min(all.length, Math.max(1, Math.floor((size.height - 26) / 20)));
  const start = all.length ? mod(SLOT, all.length) : 0;
  Array.from({ length: n }, (_, i) => all[(start + i) % all.length]).forEach((x, i) => {
    if (i) p.addSpacer(6);
    barRow(p, size.width - 22, 66, 112, x, x.target ? (x.have / x.target) * 100 : 0,
      `${fmt(x.toGo || 0)} to ${fmt(x.target || 0)} ${x.unit || ''}`);
  });
  p.addSpacer();
}

// ---- C: hot take day ----
const HEAT = { 1: 'WARM TAKE', 2: 'HOT TAKE', 3: 'SCORCHING TAKE' };
// Three pixel flames, as many lit as the take's heat
function flamesImage(heat) {
  const f = ['..#..', '.#o#.', '.#o#.', '#oyo#', '#oyo#', '.###.'];
  const px = PX * 1.15;
  const dc = newCtx((3 * 5 + 2 * 2) * px, 6 * px);
  for (let i = 0; i < 3; i++) {
    const lit = i < (heat || 1);
    drawGrid(dc, f, i * 7, 0, px, lit ? { '#': '#ff7a2f', o: '#ffb13d', y: '#ffe08a' } : { '#': '#5a3a2c', o: '#4a2f24', y: '#4a2f24' });
  }
  return { image: dc.getImage(), w: 19 * px, h: 6 * px };
}
// Lines a condensed headline takes in `w` points at `size` (an estimate; the text also shrinks to fit)
const headLines = (text, w, size, max) => Math.min(max, Math.max(1, Math.ceil(text.length / Math.max(8, w / (size * 0.47)))));
// The take: flames and the headline on top; below it the two players squared up on the right (as big as the room
// allows), the evidence line bottom-left
function takeImage(w, h, top, figs, logo) {
  const r = 14;
  const dc = newCtx(w, h);
  roundedRows(dc, w, h, r, '#2c1b14', '#120c0b');
  glow(dc, w * 0.72, h, w * 0.42, h * 0.55, '#ff6e28', 0.4);
  const room = h - top;
  // a standing figure is up to 46 game pixels from hair to shoes: with the shoes 6 pixels off the bottom edge, the
  // tallest whole-pixel scale whose head stays under the headline
  const k = Math.max(1, Math.floor(((room - 2) / 40) * SCALE));
  const u = k / SCALE;
  const right = w * 0.72;
  const feet = h + 6 * u;
  if (figs.length >= 2) {
    const gap = 17 * u;
    figs.slice(0, 2).forEach((f, i) => {
      dc.setFillColor(rgba('#000000', 0.4));
      dc.fillEllipse(new Rect(right + (i ? gap : -gap) - 14 * u, h - 3 * u, 28 * u, 5 * u));
      drawSprite(dc, f.img, right + (i ? gap : -gap), feet, k);
    });
    const vs = pixelLabel([['VS', '#ffb13d']], { px: PX * 1.3 });
    dc.drawImageInRect(vs.image, new Rect(right - vs.w / 2, top + room * 0.55, vs.w, vs.h));
  } else if (figs.length === 1) {
    glow(dc, right, h - room * 0.5, 30 * u, room * 0.6, '#ffe08a', 0.18);
    drawSprite(dc, figs[0].img, right, feet, k);
  } else if (logo) {
    const s = Math.min(room - 6, 64);
    dc.drawImageInRect(logo, new Rect(right - s / 2, h - s - 6, s, s));
  }
  strokeRim(dc, 0.6, 0.6, w - 1.2, h - 1.2, r - 0.3, 1, '#ff8c3c', 0.45);
  return dc.getImage();
}
function takeBlock(parent, data, take, size, figs, logo) {
  const box = sizedStack(parent, size.width, size.height);
  box.layoutVertically();
  box.setPadding(8, 12, 8, 12);
  box.url = tap(SITE + '#timeline');
  const kick = box.addStack();
  kick.centerAlignContent();
  const fl = flamesImage(take.heat);
  const fi = kick.addImage(fl.image);
  fi.imageSize = new Size(fl.w, fl.h);
  kick.addSpacer(6);
  addPixel(kick, [[`${HEAT[take.heat] || 'HOT TAKE'}${data.takesSeason ? ' · ' + data.takesSeason : ''}`, '#ffc58a']]);
  box.addSpacer(4);
  const hlSize = 18;
  const text = take.headline.toUpperCase();
  const lines = headLines(text, size.width - 24, hlSize, 3);
  const hl = label(box, text, display(hlSize), Color.white(), lines);
  hl.minimumScaleFactor = 0.65;
  const top = 8 + fl.h + 4 + lines * hlSize * 1.2 + 2;
  box.backgroundImage = takeImage(size.width, size.height, top, figs, logo);
  box.addSpacer();
  if (take.dek) {
    const row = box.addStack();
    const col = row.addStack();
    col.size = new Size((size.width - 24) * (figs.length || logo ? 0.48 : 1), 0);
    const d = label(col, take.dek, body(10), new Color('#e8c9b0'), 3);
    d.minimumScaleFactor = 0.8;
    col.addSpacer();
    row.addSpacer();
  }
}
function panelHofBars(p, data, size) {
  p.url = tap(SITE + '#hof');
  const all = arr(data.hofWatch);
  const n = Math.min(all.length, 3, Math.max(1, Math.floor((size.height - 24) / 19)));
  all.slice(0, n).forEach((x, i) => {
    if (i) p.addSpacer(5);
    barRow(p, size.width - 22, 74, 46, x, x.pct || 0, x.score != null ? String(x.score) : fmt(x.toGo || 0), new Color(HEX.gold));
  });
  p.addSpacer();
}
function vaultPanel(parent, item, size) {
  const p = sizedStack(parent, size.width, size.height);
  p.layoutVertically();
  p.setPadding(8, 11, 8, 11);
  const dc = plainCard(size.width, size.height, '#2a2210', '#171207', HEX.gold, 0.35);
  p.backgroundImage = dc.getImage();
  if (!item) return;
  p.url = tap(SITE + (item.kind === 'hof' ? '#hof' : '#timeline'));
  addPixel(p, [[['FROM THE VAULT', item.when].filter(Boolean).join(' · '), '#f1c35c']], { icon: vaultIcon(item), iconHex: '#f1c35c', iconDeep: '#a07a2a' });
  p.addSpacer(4);
  if (item.title) {
    const t = label(p, item.title.toUpperCase(), display(14), new Color('#fff3d6'), 1);
    t.minimumScaleFactor = 0.7;
    p.addSpacer(1);
  }
  const tx = label(p, item.text || '', body(11), new Color('#e9dfc4'), Math.max(1, Math.floor((size.height - 44) / 13.5)));
  tx.minimumScaleFactor = 0.8;
  p.addSpacer();
}
function widePanel(parent, title, icon, size) {
  const p = sizedStack(parent, size.width, size.height);
  p.layoutVertically();
  p.setPadding(8, 11, 8, 11);
  p.backgroundImage = cardImage(size.width, size.height, { radius: 12 });
  addPixel(p, title, { icon });
  p.addSpacer(6);
  return p;
}

async function large(data) {
  const sz = widgetSize('large');
  const w = base(sz, { scan: 60 });
  if (!data) return offline(w);
  const cw = sz.w - 2 * PAD.side;
  const gap = 7, footH = 8;
  const avail = sz.h - PAD.top - PAD.bottom - footH - 3 * gap;
  const seed = (data.edition && data.edition.seed) || 1;
  let day = pickDay(data);
  if ((day === 'spot' && !arr(data.spotlights).length) || (day === 'take' && !arr(data.takes).length)) day = 'front';

  if (day === 'spot') {
    const sp = pickSpot(data, 1);
    const heroH = Math.round(avail * 0.5), factH = Math.round(avail * 0.22), countH = avail - heroH - factH;
    const img = await sprite(sp.sprite);
    heroCard(w, data, sp, new Size(cw, heroH), img);
    w.addSpacer(gap);
    factPanel(w, pickPool(data.didYouKnow, seed, SLOT), new Size(cw, factH));
    w.addSpacer(gap);
    const has = { miles: arr(data.milestones).length > 0, clock: arr(data.retirements).length > 0, rise: arr(data.ceilings).length > 0 };
    const turn = ['miles', 'clock', 'rise'];
    const t0 = mod(SLOT, turn.length);
    const k = turn.map((_, i) => turn[(t0 + i) % turn.length]).find((x) => has[x]) || 'hof';
    const size = new Size(cw, countH);
    if (k === 'miles') panelMilesBars(widePanel(w, 'MILESTONES', 'flag', size), data, size);
    else if (k === 'hof') panelHofBars(widePanel(w, 'HALL OF FAME WATCH · ACTIVE', 'pillar', size), data, size);
    else {
      const [title, icon, fill] = PANELS[k];
      fill(widePanel(w, title, icon, size), data, size);
    }
  } else if (day === 'take') {
    const take = pickTake(data);
    const takeH = Math.round(avail * 0.5), hofH = Math.round(avail * 0.25), vaultH = avail - takeH - hofH;
    const people = arr(take.players);
    const imgs = await Promise.all(people.map((x) => sprite(x.sprite)));
    const figs = people.map((x, i) => ({ img: imgs[i] })).filter((f) => f.img);
    const logo = figs.length ? null : await teamLogo(take.team);
    takeBlock(w, data, take, new Size(cw, takeH), figs, logo);
    w.addSpacer(gap);
    const hs = new Size(cw, hofH);
    if (arr(data.hofWatch).length) panelHofBars(widePanel(w, 'HALL OF FAME WATCH · ACTIVE', 'pillar', hs), data, hs);
    else panelMarket(widePanel(w, 'MARKET', 'ticker', hs), data, hs);
    w.addSpacer(gap);
    vaultPanel(w, pickPool(data.vault, seed ^ 0x9e3779b9, SLOT), new Size(cw, vaultH));
  } else {
    const art = pickStory(data);
    const storyH = Math.round(avail * 0.44), stripH = 46, panelH = avail - storyH - stripH;
    const sp = pickSpot(data);
    const people = arr(data.photo && data.photo.players);
    const [spImg, ...imgs] = await Promise.all([sp ? sprite(sp.sprite) : null, ...people.map((x) => sprite(x.sprite))]);
    const figs = people.map((x, i) => ({ img: imgs[i], star: !!x.star })).filter((f) => f.img);
    frontStory(w, data, art, new Size(cw, storyH), figs);
    w.addSpacer(gap);
    if (sp) spotStrip(w, data, sp, new Size(cw, stripH), spImg);
    else w.addSpacer(stripH);
    w.addSpacer(gap);
    const cols = w.addStack();
    cols.layoutHorizontally();
    cols.topAlignContent();
    const pw = Math.floor((cw - gap) / 2);
    const right = mod(SLOT, 2) === 0 ? 'wire' : 'chase'; // alternates turn by turn
    const plan = ['market', right === 'chase' && !arr(data.chases).length ? 'wire' : right === 'wire' && !arr(data.headlines).length ? 'chase' : right];
    plan.forEach((k, i) => {
      if (i) cols.addSpacer(gap);
      const [title, icon, fill] = PANELS[k];
      const size = new Size(pw, panelH);
      fill(panelShell(cols, title, icon, size), data, size, art);
    });
  }
  w.addSpacer();
  pixelFooter(w, data);
  return w;
}

async function medium(data) {
  const sz = widgetSize('medium');
  const w = base(sz, { scan: 40 });
  if (!data) return offline(w);
  const cw = sz.w - 2 * PAD.side;
  const h = sz.h - PAD.top - PAD.bottom;
  const art = pickStory(data);
  const spot = pickSpotlight(data);
  const spotTeam = spotTeamOf(data, spot);
  const spotLogo = spotTeam ? await teamLogo(spotTeam) : null;
  const row = w.addStack();
  row.layoutHorizontally();
  row.topAlignContent();
  const leftW = Math.floor((cw - 8) * 0.48);
  story(row, data, art, new Size(leftW, h), null, { short: true, hl: 17, hlLines: 3, dekSize: 10.5, logo: false,
    dekLines: art && art.headline.length <= 34 ? 3 : 2 });
  row.addSpacer(8);
  if (spot) spotlight(row, spot, data.cards || {}, new Size(cw - leftW - 8, h), spotLogo, { compact: true, lines: 5, textSize: 10 });
  return w;
}

async function small(data) {
  const sz = widgetSize('small');
  const w = base(sz, { scan: 30 });
  if (!data) return offline(w);
  const spot = pickSpotlight(data);
  if (!spot) return offline(w);
  const it = spot.item;
  const card = it.player ? (data.cards || {})[it.player] : null;
  const name = it.player ? it.player.split(':').slice(1).join(':') : null;
  const team = it.team || (card && card.team);
  const isVault = spot.kind === 'vault';
  w.url = card && card.ovr != null ? tap(SITE + '#stats/deepdive?p=' + encodeURIComponent(it.player)) : tap(SITE + (it.kind === 'hof' ? '#hof' : '#timeline'));
  addPixel(w, isVault ? 'FROM THE VAULT' : spot.kind === 'fact' ? 'DID YOU KNOW' : 'SPOTLIGHT', { icon: isVault ? vaultIcon(it) : 'bulb' });
  w.addSpacer(8);
  const row = w.addStack();
  row.layoutHorizontally();
  const bar = row.addStack();
  bar.size = new Size(3, 0);
  bar.backgroundColor = team ? inkColor(team) : C.line;
  bar.cornerRadius = 1.5;
  row.addSpacer(7);
  const col = row.addStack();
  col.layoutVertically();
  const title = isVault && it.kind !== 'hof' ? it.title : name || (isVault ? it.title : null);
  if (title) {
    const t = label(col, title.toUpperCase(), display(14.5), title === name ? inkColor(team) : C.chalk, 1);
    t.minimumScaleFactor = 0.65;
    col.addSpacer(2);
  }
  const text = it.text ? (title === name ? afterName(it.text, name) : it.text)
    : card ? `${it.player.split(':')[0]} · Career Legacy ${fmt(card.legacy || 0)}` : '';
  const tx = label(col, text, body(11), C.chalk, title ? 5 : 6);
  tx.minimumScaleFactor = 0.8;
  col.addSpacer();
  w.addSpacer();
  const foot = w.addStack();
  foot.centerAlignContent();
  label(foot, isVault && it.when ? it.when : nick(team) || '', mono(8.5), team && !(isVault && it.when) ? inkColor(team) : C.muted, 1);
  foot.addSpacer();
  label(foot, data.season || '', mono(8.5), C.muted, 1);
  return w;
}

// ---------- lock screen ----------
// White only (iOS tints lock screen widgets to the wallpaper). Everything rotates every 3 hours (SLOT).
const gauntletPick = (data) => {
  const g = data.gauntlet;
  if (!g) return null;
  const h = arr(g.holders).find((x) => x.active);
  if (h) return { last: h.last, have: g.of, of: g.of, holder: true, player: h.player };
  if (g.closest) return { last: g.closest.last, have: g.closest.have, of: g.of, holder: false, player: g.closest.player };
  return null;
};
// One-line glances: "Y94 · Eagles won CLIII, 4 in a row", "Atwell · 126 tackles to the record", "Maxwell · final
// season Y95", "Maxwell · ran the Gauntlet, 5/5", "Burford · 1 tackle to 500", "Skura · 68 Super Bowl titles"
function glanceLines(data) {
  const out = [];
  const ch = data.champion;
  if (ch) out.push(`${ch.season} · ${ch.winner} won ${ch.roman}${ch.run > 1 ? `, ${ch.run} in a row` : ''}`);
  arr(data.chases).slice(0, 2).forEach((x) => out.push(`${x.last} · ${fmt(x.toGo)} ${x.unit} to the record`));
  arr(data.retirements).filter((x) => x.seasonsLeft === 0).slice(0, 2)
    .forEach((x) => out.push(`${x.last} · final season${data.liveSeason ? ' ' + data.liveSeason : ''}`));
  const g = gauntletPick(data);
  if (g) out.push(g.holder ? `${g.last} · ran the Gauntlet, ${g.of}/${g.of}` : `${g.last} · ${g.have}/${g.of} of the Gauntlet`);
  arr(data.milestones).slice(0, 2).forEach((x) => out.push(`${x.last} · ${fmt(x.toGo)} ${x.unit} to ${fmt(x.target)}`));
  arr(data.ceilings).slice(0, 1).forEach((x) => out.push(`${x.last} · ${starText(x.stars || 0)}→${starText(x.ceiling || 0)}★ ceiling`));
  if (data.coachTitles && data.coach) out.push(`${data.coach} · ${data.coachTitles} Super Bowl titles`);
  arr(data.hofWatch).slice(0, 1).forEach((x) => out.push(x.toGo > 0 ? `${x.last} · ${fmt(x.toGo)} pts to the Hall` : `${x.last} · Hall of Fame bound`));
  return out;
}
function inlineText(data) {
  const lines = glanceLines(data);
  if (lines.length) return lines[mod(SLOT, lines.length)];
  const h = (arr(data.headlines)[0] || {}).text;
  return h || `Retro Vault · ${data.season || ''}`;
}
function ringArc(dc, cx, cy, r, lw, from, to, color) {
  const p = new Path();
  const n = Math.max(2, Math.ceil((to - from) * 40));
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + 2 * Math.PI * (from + ((to - from) * i) / n);
    const pt = new Point(cx + r * Math.cos(a), cy + r * Math.sin(a));
    if (i) p.addLine(pt); else p.move(pt);
  }
  dc.addPath(p);
  dc.setStrokeColor(color);
  dc.setLineWidth(lw);
  dc.strokePath();
}
function ringText(dc, s, big, small, bigSize = 17) {
  dc.setTextAlignedCenter();
  dc.setFont(Font.heavyRoundedSystemFont ? Font.heavyRoundedSystemFont(bigSize) : Font.boldSystemFont(bigSize));
  dc.setTextColor(Color.white());
  dc.drawTextInRect(big, new Rect(0, s / 2 - bigSize * 0.85, s, bigSize * 1.3));
  dc.setFont(Font.boldSystemFont(small.length > 7 ? 7 : 8));
  dc.setTextColor(new Color('#ffffff', 0.8));
  dc.drawTextInRect(small, new Rect(9, s / 2 + bigSize * 0.38, s - 18, 11));
}
function gaugeImage(pct, big, small) {
  const s = 64;
  const dc = newCtx(s, s);
  const r = 27, lw = 5.5, cx = s / 2, cy = s / 2;
  ringArc(dc, cx, cy, r, lw, 0, 1, new Color('#ffffff', 0.25));
  ringArc(dc, cx, cy, r, lw, 0, Math.max(0.02, Math.min(1, pct / 100)), Color.white());
  // a knob at the end, like the site's progress dots
  const a = -Math.PI / 2 + 2 * Math.PI * Math.min(1, pct / 100);
  dc.setFillColor(Color.white());
  dc.fillEllipse(new Rect(cx + r * Math.cos(a) - lw * 0.75, cy + r * Math.sin(a) - lw * 0.75, lw * 1.5, lw * 1.5));
  ringText(dc, s, big, small);
  return dc.getImage();
}
// The Gauntlet: one ring segment per award, lit for each he holds
function gauntletImage(g) {
  const s = 64;
  const dc = newCtx(s, s);
  const segs = g.of || 5, gapA = 0.035;
  for (let i = 0; i < segs; i++) {
    ringArc(dc, s / 2, s / 2, 27, 5.5, i / segs + gapA / 2, (i + 1) / segs - gapA / 2, i < g.have ? Color.white() : new Color('#ffffff', 0.25));
  }
  ringText(dc, s, `${g.have}/${g.of}`, 'GAUNTLET', 18);
  return dc.getImage();
}
function titlesImage(n) {
  const s = 64;
  const dc = newCtx(s, s);
  ringArc(dc, s / 2, s / 2, 28, 2, 0, 1, new Color('#ffffff', 0.35));
  ringText(dc, s, String(n), 'TITLES', 22);
  return dc.getImage();
}
// The spotlight player's head and shoulders as a white silhouette, filling the circle
function silhouetteCircle(img) {
  const s = 64;
  const dc = newCtx(s, s);
  const k = spriteK(s / 32);
  const u = k / SCALE;
  drawSprite(dc, img, s / 2, 4 + 52 * u, k); // the head near the top, cut at the chest
  return dc.getImage();
}
function silhouetteFigure(img, w, h) {
  const dc = newCtx(w, h);
  const k = spriteK((h + 8) / 52);
  drawSprite(dc, img, w / 2, h + 5 * (k / SCALE), k);
  return dc.getImage();
}
function lockKicker(stack, text) {
  const k = stack.addText(text);
  k.font = Font.boldSystemFont(10);
  k.textColor = new Color('#ffffff', 0.7);
  k.lineLimit = 1;
  return k;
}

async function accessory(data) {
  const w = new ListWidget();
  w.refreshAfterDate = refreshAt(NOW);
  w.url = tap(SITE + '#timeline');
  const pickOpt = (opts) => {
    const forced = typeof RV_LOCK !== 'undefined' && RV_LOCK; // harness only
    if (forced && opts.includes(forced)) return forced;
    return opts.length ? opts[mod(SLOT, opts.length)] : null;
  };
  const sp = data ? pickSpot(data) : null;
  if (FAMILY === 'accessoryInline') {
    const t = w.addText(data ? inlineText(data) : 'Retro Vault');
    t.lineLimit = 1;
    return w;
  }
  if (FAMILY === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    w.setPadding(0, 0, 0, 0);
    const c = data && arr(data.chases)[0];
    const g = data && gauntletPick(data);
    const sil = sp && sp.sil ? await sprite(sp.sil) : null;
    const opts = [c && 'chase', g && 'gauntlet', data && data.coachTitles && 'titles', sil && 'spot'].filter(Boolean);
    const pick = pickOpt(opts);
    let image = null;
    if (pick === 'chase') image = gaugeImage(c.pct, `${c.pct}%`, String(c.last || '').toUpperCase().slice(0, 9));
    else if (pick === 'gauntlet') {
      image = gauntletImage(g);
      w.url = tap(SITE + '#stats/deepdive?p=' + encodeURIComponent(g.player));
    } else if (pick === 'titles') image = titlesImage(data.coachTitles);
    else if (pick === 'spot') {
      image = silhouetteCircle(sil);
      w.url = tap(SITE + '#stats/deepdive?p=' + encodeURIComponent(sp.player));
    }
    const hw = data && arr(data.hofWatch)[0];
    if (!image && hw) {
      image = gaugeImage(Math.floor(hw.pct), `${Math.floor(hw.pct)}%`, 'HOF ' + String(hw.last || '').toUpperCase().slice(0, 5));
      w.url = tap(SITE + '#hof');
    }
    const im = w.addImage(image || brandGlyph());
    im.imageSize = image ? new Size(64, 64) : new Size(40, 40);
    im.centerAlignImage();
    return w;
  }
  // accessoryRectangular: the story headline, the closest record chase with a bar, the spotlight with his
  // silhouette, or From the Vault
  w.addAccessoryWidgetBackground = false;
  w.setPadding(2, 4, 2, 4);
  if (!data) return offline(w);
  const art = pickStory(data);
  const c = arr(data.chases)[0];
  const sil = sp && sp.sil ? await sprite(sp.sil) : null;
  const seed = (data.edition && data.edition.seed) || 1;
  const vault = pickPool(data.vault, seed ^ 0x9e3779b9, SLOT);
  const opts = [art && 'story', c && 'chase', sil && 'spot', vault && 'vault'].filter(Boolean);
  const pick = pickOpt(opts) || 'story';
  if (pick === 'chase') {
    w.url = tap(SITE + '#stats/deepdive?p=' + encodeURIComponent(c.player));
    lockKicker(w, 'RECORD CHASE');
    const h = w.addText(`${c.last} · ${fmt(c.toGo)} to go`);
    h.font = Font.heavySystemFont(15); h.textColor = Color.white(); h.lineLimit = 1; h.minimumScaleFactor = 0.7;
    w.addSpacer(3);
    const dc = newCtx(150, 5);
    fillRounded(dc, new Rect(0, 0, 150, 5), 2.5, new Color('#ffffff', 0.25));
    fillRounded(dc, new Rect(0, 0, Math.max(5, 1.5 * (c.pct || 0)), 5), 2.5, Color.white());
    const bar = w.addImage(dc.getImage());
    bar.imageSize = new Size(150, 5);
    w.addSpacer(2);
    const s = w.addText(`${fmt(c.have)} of ${c.holder}'s ${fmt(c.mark)} ${c.stat || ''}`);
    s.font = Font.mediumSystemFont(10); s.textColor = new Color('#ffffff', 0.8); s.lineLimit = 1; s.minimumScaleFactor = 0.7;
  } else if (pick === 'spot') {
    const card = (data.cards || {})[sp.player] || {};
    w.setPadding(0, 0, 0, 4);
    w.url = tap(SITE + '#stats/deepdive?p=' + encodeURIComponent(sp.player));
    const row = w.addStack();
    row.centerAlignContent();
    const im = row.addImage(silhouetteFigure(sil, 50, 70));
    im.imageSize = new Size(50, 70);
    row.addSpacer(4);
    const col = row.addStack();
    col.layoutVertically();
    lockKicker(col, 'SPOTLIGHT');
    const n = col.addText(sp.last.toUpperCase());
    n.font = Font.heavySystemFont(16); n.textColor = Color.white(); n.lineLimit = 1; n.minimumScaleFactor = 0.6;
    const l = col.addText([card.ovr != null ? `${card.ovr} OVR` : null, card.legacy ? `${fmt(card.legacy)} CL` : null].filter(Boolean).join(' · '));
    l.font = Font.mediumSystemFont(11); l.textColor = new Color('#ffffff', 0.85); l.lineLimit = 1; l.minimumScaleFactor = 0.7;
    row.addSpacer();
    return w;
  } else if (pick === 'vault') {
    w.url = tap(SITE + (vault.kind === 'hof' ? '#hof' : '#timeline'));
    lockKicker(w, ['FROM THE VAULT', vault.when].filter(Boolean).join(' · '));
    const t = w.addText(vault.title && vault.kind !== 'hof' ? `${vault.title}: ${vault.text}` : vault.text || '');
    t.font = Font.mediumSystemFont(12); t.textColor = Color.white(); t.lineLimit = 3; t.minimumScaleFactor = 0.75;
  } else {
    lockKicker(w, `${data.storySeason || data.season || ''} ${art ? (art.kind === 'lead' ? 'STORY' : kindLabel(art.kind)) : 'RETRO VAULT'}${art && isBreaking(data) && art === arr(data.stories)[0] ? ' · BREAKING' : ''}`);
    const h = w.addText(art ? shortHeadline(art.headline) : (arr(data.headlines)[0] || {}).text || 'Retro Vault');
    h.font = Font.heavySystemFont(15); h.textColor = Color.white(); h.lineLimit = 3; h.minimumScaleFactor = 0.75;
  }
  w.addSpacer();
  return w;
}

async function build() {
  const data = await load('widget.json');
  if (String(FAMILY).startsWith('accessory')) return await accessory(data);
  if (FAMILY === 'small') return small(data);
  if (FAMILY === 'medium') return medium(data);
  return large(data);
}

const widget = await build();
if (config.runsInWidget || typeof RV_FAMILY !== 'undefined') Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
