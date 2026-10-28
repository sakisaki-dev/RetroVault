// Retro Vault widget for Scriptable (iOS). Loaded by retro-vault-install.js, which fetches this file from the repo on
// every refresh, so the widget updates itself. A league front page in the site's own look: navy, one gold gradient rim
// as the signature, muted pixel kickers, and team colours on every player name (made legible on navy). It shows the
// season story, a spotlight ("Did you know" facts and "From the Vault" history) and rotating panels. It reads one small file, public/data/widget.json, which `npm run rebuild` generates by rule
// (scripts/build_widget_data.py). Every field it reads is optional, so an older cached widget.json still draws.
//
// One script, every size (Scriptable picks the layout from config.widgetFamily):
//   large      story, spotlight, two rotating panels, footer (season · edition · last update)
//   medium     story beside the spotlight
//   small      the spotlight alone
//   lock screen (accessoryInline / accessoryCircular / accessoryRectangular): the champion or top headline, a gauge of
//              the closest record chase, the story headline plus a one-line countdown. Monochrome-friendly.
//
// Rotation (local time; nothing depends on the network between refreshes):
//   story      one article a day (midnight); the lead is pinned, tagged BREAKING, for the first 2 days after an update
//   spotlight  twice a day (midnight, noon), alternating Did you know / From the Vault; each pool is shuffled with the
//              edition seed, so an item returns only after the whole pool has shown and the order changes with updates
//   panels     even days (and the 2 days after an update): MARKET + THE WIRE; odd days: HOF WATCH + RECORD CHASE,
//              every other odd day MILESTONES in place of RECORD CHASE
//   refresh    every 2 hours at most (so updates arrive quickly) and always at the next midnight or noon
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
  Bills: ['#00338D', '#C60C30', 'buf'], Panthers: ['#0085CA', '#101820', 'car'], Bears: ['#0B162A', '#C83803', 'chi'],
  Bengals: ['#FB4F14', '#000000', 'cin'], Browns: ['#311D00', '#FF3C00', 'cle'], Cowboys: ['#003594', '#869397', 'dal'],
  Broncos: ['#FB4F14', '#002244', 'den'], Lions: ['#0076B6', '#B0B7BC', 'det'], Packers: ['#203731', '#FFB612', 'gb'],
  Texans: ['#03202F', '#A71930', 'hou'], Colts: ['#002C5F', '#A2AAAD', 'ind'], Jaguars: ['#006778', '#D7A22A', 'jax'],
  Chiefs: ['#E31837', '#FFB81C', 'kc'], Raiders: ['#000000', '#A5ACAF', 'lv'], Chargers: ['#0080C6', '#FFC20E', 'lac'],
  Rams: ['#003594', '#FFD100', 'lar'], Dolphins: ['#008E97', '#FC4C02', 'mia'], Vikings: ['#4F2683', '#FFC62F', 'min'],
  Patriots: ['#002244', '#C60C30', 'ne'], Saints: ['#101820', '#D3BC8D', 'no'], Giants: ['#0B2265', '#A71930', 'nyg'],
  Jets: ['#125740', '#FFFFFF', 'nyj'], Eagles: ['#004C54', '#A5ACAF', 'phi'], Steelers: ['#101820', '#FFB612', 'pit'],
  '49ers': ['#AA0000', '#B3995D', 'sf'], Seahawks: ['#002244', '#69BE28', 'sea'], Buccaneers: ['#D50A0A', '#34302B', 'tb'],
  Titans: ['#0C2340', '#4B92DB', 'ten'], Commanders: ['#5A1414', '#FFB612', 'wsh'],
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

// ---------- time and rotation ----------
// The league moves once a season, so nothing here depends on the network: the day and half-day decide what shows.
const NOW = typeof RV_NOW !== 'undefined' && RV_NOW ? new Date(RV_NOW) : new Date(); // RV_NOW: test harness only
const dayNumber = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const TODAY = dayNumber(NOW);
const SLOT = TODAY * 2 + (NOW.getHours() >= 12 ? 1 : 0); // midnight and noon
const dateDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : null;
};
const mod = (a, n) => ((a % n) + n) % n;
function nextTurn(d) {
  const t = new Date(d.getTime());
  if (t.getHours() < 12) t.setHours(12, 0, 0, 0);
  else { t.setDate(t.getDate() + 1); t.setHours(0, 0, 0, 0); }
  return t;
}
// Refresh within 2 hours (so a pushed update shows up soon) and always at the next rotation boundary
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
  // Each pool moves once a day: Did you know in the morning, From the Vault in the afternoon
  const turn = Math.floor(SLOT / 2);
  const wantVault = SLOT % 2 === 1;
  const pools = wantVault ? [['vault', vault], ['fact', facts]] : [['fact', facts], ['vault', vault]];
  for (const [kind, pool] of pools) {
    if (pool.length) return { kind, item: pool[mod(turn, pool.length)] };
  }
  const fb = arr(data.spotlightFallback);
  return fb.length ? { kind: 'player', item: { player: fb[mod(TODAY, fb.length)] } } : null;
}

// Which two bottom panels show today (large). Deterministic by day; news first right after an update.
function pickPanels(data) {
  const has = {
    market: true, wire: arr(data.headlines).length > 0, hof: arr(data.hofWatch).length > 0,
    chase: arr(data.chases).length > 0, miles: arr(data.milestones).length > 0,
  };
  let plan = isBreaking(data) || TODAY % 2 === 0 ? ['market', 'wire'] : ['hof', mod(TODAY, 4) === 1 ? 'chase' : 'miles'];
  const backup = { market: 'market', wire: 'market', hof: 'market', chase: 'miles', miles: 'chase' };
  plan = plan.map((p) => (has[p] ? p : has[backup[p]] ? backup[p] : p === 'wire' || p === 'chase' || p === 'miles' ? 'wire' : 'market'));
  if (plan[1] === plan[0]) plan[1] = has.wire && plan[0] !== 'wire' ? 'wire' : 'market';
  if (plan[1] === plan[0]) plan = ['market', 'wire'];
  return plan;
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
    label(row, `${fmt(x.toGo || 0)} to go`, mono(9), C.muted, 1);
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
  const start = all.length ? mod(TODAY, all.length) : 0; // a different set each time the panel comes round
  Array.from({ length: n }, (_, i) => all[(start + i) % all.length]).forEach((x, i) => {
    if (i) p.addSpacer(5);
    nameText(p, x.last, x.team);
    const sub = label(p, `${fmt(x.toGo || 0)} ${x.unit || ''} to ${fmt(x.target || 0)}`, mono(9), C.muted, 1);
    sub.minimumScaleFactor = 0.8;
  });
  p.addSpacer();
}
const PANELS = {
  market: ['MARKET', 'ticker', panelMarket], wire: ['THE WIRE', 'radio', panelWire], hof: ['HOF WATCH', 'pillar', panelHof],
  chase: ['RECORD CHASE', 'stopwatch', panelChase], miles: ['MILESTONES', 'flag', panelMiles],
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

async function large(data) {
  const sz = widgetSize('large');
  const w = base(sz, { scan: 60 });
  if (!data) return offline(w);
  const cw = sz.w - 2 * PAD.side;
  const footH = 11, slack = 8;
  const avail = sz.h - PAD.top - PAD.bottom - 8 - 8 - footH - slack;
  const storyH = Math.round(avail * 0.3), spotH = Math.round(avail * 0.33), panelH = avail - storyH - spotH;
  const art = pickStory(data);
  const spot = pickSpotlight(data);
  const spotTeam = spotTeamOf(data, spot);
  const [storyLogo, spotLogo] = await Promise.all([art ? teamLogo(art.team) : null, spotTeam ? teamLogo(spotTeam) : null]);

  story(w, data, art, new Size(cw, storyH), storyLogo);
  w.addSpacer(8);
  if (spot) spotlight(w, spot, data.cards || {}, new Size(cw, spotH), spotLogo);
  else w.addSpacer(spotH);
  w.addSpacer(8);
  const cols = w.addStack();
  cols.layoutHorizontally();
  cols.topAlignContent();
  const pw = Math.floor((cw - 8) / 2);
  pickPanels(data).forEach((k, i) => {
    if (i) cols.addSpacer(8);
    const [title, icon, fill] = PANELS[k];
    const size = new Size(pw, panelH);
    fill(panelShell(cols, title, icon, size), data, size, art);
  });
  w.addSpacer();
  const foot = w.addStack();
  foot.centerAlignContent();
  label(foot, footLine(data), mono(8.5), C.muted, 1);
  foot.addSpacer();
  label(foot, 'tap for the full story ›', mono(8.5), C.muted, 1);
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
// A one-line countdown: "Van Oxley: 79 rec yds to 15,000", "Jensen: 1,488 rush yds from the record",
// "Horsted: 372 pts to the Hall"
function glanceLines(data) {
  const out = [];
  arr(data.milestones).forEach((x) => out.push(`${x.last}: ${fmt(x.toGo)} ${x.unit} to ${fmt(x.target)}`));
  arr(data.chases).forEach((x) => out.push(`${x.last}: ${fmt(x.toGo)} ${x.unit} from the record`));
  arr(data.hofWatch).forEach((x) => out.push(`${x.last}: ${fmt(x.toGo)} pts to the Hall`));
  return out;
}
// Inline: the champion on even days, a countdown on odd days; the top headline when either is missing
function inlineText(data) {
  const ch = data.champion;
  const lines = glanceLines(data);
  const h = (arr(data.headlines)[0] || {}).text;
  if (ch && (TODAY % 2 === 0 || !lines.length)) return `🏈 ${ch.season} · ${ch.winner} won ${ch.roman}`;
  if (lines.length) return `🏈 ${lines[mod(Math.floor(TODAY / 2), lines.length)]}`;
  if (h) return `🏈 ${h}`;
  return `🏈 Retro Vault · ${data.season || ''}`;
}
function gaugeImage(pct, big, small) {
  const s = 64;
  const dc = newCtx(s, s);
  const r = 27, lw = 5.5, cx = s / 2, cy = s / 2;
  const arc = (from, to, color) => {
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
  };
  arc(0, 1, new Color('#ffffff', 0.25));
  arc(0, Math.max(0.02, Math.min(1, pct / 100)), Color.white());
  // a knob at the end, like the site's progress dots
  const a = -Math.PI / 2 + 2 * Math.PI * Math.min(1, pct / 100);
  dc.setFillColor(Color.white());
  dc.fillEllipse(new Rect(cx + r * Math.cos(a) - lw * 0.75, cy + r * Math.sin(a) - lw * 0.75, lw * 1.5, lw * 1.5));
  dc.setTextAlignedCenter();
  dc.setFont(Font.heavyRoundedSystemFont ? Font.heavyRoundedSystemFont(17) : Font.boldSystemFont(17));
  dc.setTextColor(Color.white());
  dc.drawTextInRect(big, new Rect(0, 17, s, 22));
  dc.setFont(Font.boldSystemFont(8));
  dc.setTextColor(new Color('#ffffff', 0.8));
  dc.drawTextInRect(small, new Rect(4, 37, s - 8, 11));
  return dc.getImage();
}
function accessory(data) {
  const w = new ListWidget();
  w.refreshAfterDate = refreshAt(NOW);
  w.url = tap(SITE + '#timeline');
  if (FAMILY === 'accessoryInline') {
    const t = w.addText(data ? inlineText(data) : '🏈 Retro Vault');
    t.lineLimit = 1;
    return w;
  }
  if (FAMILY === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    w.setPadding(0, 0, 0, 0);
    const c = data && arr(data.chases)[0];
    const hw = data && arr(data.hofWatch)[0];
    if (!c && !hw) {
      // An older widget.json without countdowns: the brand glyph
      const im = w.addImage(brandGlyph());
      im.imageSize = new Size(40, 40);
      im.centerAlignImage();
      return w;
    }
    const [pct, sub] = c ? [c.pct, String(c.last || '').toUpperCase().slice(0, 9)]
      : [Math.floor(hw.pct), 'HOF ' + String(hw.last || '').toUpperCase().slice(0, 5)];
    if (!c) w.url = tap(SITE + '#hof');
    const im = w.addImage(gaugeImage(pct, `${pct}%`, sub));
    im.imageSize = new Size(64, 64);
    im.centerAlignImage();
    return w;
  }
  // accessoryRectangular: story headline + one countdown line
  w.addAccessoryWidgetBackground = false;
  w.setPadding(2, 4, 2, 4);
  if (!data) return offline(w);
  const art = pickStory(data);
  const k = w.addText(`🏈 ${data.storySeason || data.season || ''} ${art ? kindLabel(art.kind) : 'RETRO VAULT'}${art && isBreaking(data) && art === arr(data.stories)[0] ? ' · BREAKING' : ''}`);
  k.font = Font.boldSystemFont(10); k.textColor = new Color('#ffffff', 0.7); k.lineLimit = 1;
  const h = w.addText(art ? art.headline : (arr(data.headlines)[0] || {}).text || 'Retro Vault');
  h.font = Font.boldSystemFont(14); h.textColor = Color.white(); h.lineLimit = 2; h.minimumScaleFactor = 0.8;
  const lines = glanceLines(data);
  if (lines.length) {
    const g = w.addText('↳ ' + lines[mod(TODAY, lines.length)]);
    g.font = Font.mediumSystemFont(11); g.textColor = new Color('#ffffff', 0.85); g.lineLimit = 1; g.minimumScaleFactor = 0.7;
  }
  w.addSpacer();
  return w;
}

async function build() {
  const data = await load('widget.json');
  if (String(FAMILY).startsWith('accessory')) return accessory(data);
  if (FAMILY === 'small') return small(data);
  if (FAMILY === 'medium') return medium(data);
  return large(data);
}

const widget = await build();
if (config.runsInWidget || typeof RV_FAMILY !== 'undefined') Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
