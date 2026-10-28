// Retro Vault large widget for Scriptable (iOS). Loaded by retro-vault-install.js, which fetches this file from the
// repo on every refresh, so the widget updates itself. A league front page, not a team page: the season story, a
// spotlight ("Did you know" facts and "From the Vault" history), market movers and the wire. It reads one small file,
// public/data/widget.json, which `npm run rebuild` generates by rule (scripts/build_widget_data.py).
//
// Rotation (local time; nothing depends on the network between refreshes):
//   story      one article a day (midnight); the lead is pinned for the first 2 days after an update
//   spotlight  twice a day (midnight, noon), alternating Did you know / From the Vault; each pool is shuffled with the
//              edition seed, so an item returns only after the whole pool has shown (months) and the order changes
//              with every update
//   refresh    at the next midnight or noon
// Tap: the widget's Parameter field (long-press > Edit Widget > Parameter). Empty = open the site. A Shortcut's name
// = run that Shortcut (shortcuts://run-shortcut?name=...). A URL (http..., or anything with ://) = open it as is.

const SITE = 'https://sakisaki-dev.github.io/RetroVault/';
// Data straight from the repo (works even if GitHub Pages is down or misconfigured); the site is the fallback.
const DATA_SOURCES = [
  'https://raw.githubusercontent.com/sakisaki-dev/RetroVault/retrovault-v2/public/data/',
  SITE + 'data/',
];

// ---------- look (the site's palette) ----------
const C = {
  night: new Color('#0b1020'),
  night2: new Color('#151d38'),
  panel: new Color('#1b2444', 0.85),
  line: new Color('#2b3660'),
  gold: new Color('#f2c14a'),
  chalk: new Color('#f3f1ea'),
  muted: new Color('#9aa3c0'),
  up: new Color('#3ddc84'),
  down: new Color('#ff5d5d'),
};
const display = (s) => new Font('AvenirNextCondensed-Heavy', s);
const displayB = (s) => new Font('AvenirNextCondensed-Bold', s);
const body = (s) => Font.mediumSystemFont(s);
const mono = (s) => Font.boldMonospacedSystemFont(s);

const TEAMS = {
  Cardinals: ['#97233F', '#000000'], Falcons: ['#A71930', '#000000'], Ravens: ['#241773', '#9E7C0C'], Bills: ['#00338D', '#C60C30'],
  Panthers: ['#0085CA', '#101820'], Bears: ['#0B162A', '#C83803'], Bengals: ['#FB4F14', '#000000'], Browns: ['#311D00', '#FF3C00'],
  Cowboys: ['#003594', '#869397'], Broncos: ['#FB4F14', '#002244'], Lions: ['#0076B6', '#B0B7BC'], Packers: ['#203731', '#FFB612'],
  Texans: ['#03202F', '#A71930'], Colts: ['#002C5F', '#A2AAAD'], Jaguars: ['#006778', '#D7A22A'], Chiefs: ['#E31837', '#FFB81C'],
  Raiders: ['#000000', '#A5ACAF'], Chargers: ['#0080C6', '#FFC20E'], Rams: ['#003594', '#FFD100'], Dolphins: ['#008E97', '#FC4C02'],
  Vikings: ['#4F2683', '#FFC62F'], Patriots: ['#002244', '#C60C30'], Saints: ['#101820', '#D3BC8D'], Giants: ['#0B2265', '#A71930'],
  Jets: ['#125740', '#FFFFFF'], Eagles: ['#004C54', '#A5ACAF'], Steelers: ['#101820', '#FFB612'], '49ers': ['#AA0000', '#B3995D'],
  Seahawks: ['#002244', '#69BE28'], Buccaneers: ['#D50A0A', '#34302B'], Titans: ['#0C2340', '#4B92DB'], Commanders: ['#5A1414', '#FFB612'],
};
const nick = (team) => {
  if (!team) return '';
  const t = String(team).trim();
  return Object.keys(TEAMS).find((k) => t === k || t.endsWith(' ' + k)) || t;
};
const teamColors = (team) => (TEAMS[nick(team)] || ['#2b3660', '#f2c14a']).map((h) => new Color(h));

// ---------- tap target (the widget's Parameter field) ----------
const PARAM = String((typeof args !== 'undefined' && args && args.widgetParameter) || '').trim();
const tap = (siteUrl) => {
  if (!PARAM) return siteUrl;
  if (/^http/i.test(PARAM) || PARAM.includes('://')) return PARAM;
  return 'shortcuts://run-shortcut?name=' + encodeURIComponent(PARAM);
};

// ---------- data (cached for offline refreshes) ----------
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
function nextTurn(d) {
  const t = new Date(d.getTime());
  if (t.getHours() < 12) t.setHours(12, 0, 0, 0);
  else { t.setDate(t.getDate() + 1); t.setHours(0, 0, 0, 0); }
  return t;
}
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

function pickStory(data) {
  const arts = data.stories || [];
  if (!arts.length) return null;
  const since = dateDay(data.latestUpdateAt) == null ? null : TODAY - dateDay(data.latestUpdateAt);
  if (since != null && since >= 0 && since < 2) return arts[0]; // breaking news: the lead for 2 days
  if (since != null && since >= 2) return arts[(since - 1) % arts.length];
  return arts[((TODAY % arts.length) + arts.length) % arts.length];
}

function pickSpotlight(data) {
  const seed = (data.edition && data.edition.seed) || 1;
  const facts = shuffled(data.didYouKnow || [], seed);
  const vault = shuffled(data.vault || [], seed ^ 0x9e3779b9);
  // Each pool moves once a day: Did you know in the morning, From the Vault in the afternoon
  const turn = Math.floor(SLOT / 2);
  const wantVault = SLOT % 2 === 1;
  const pools = wantVault ? [['vault', vault], ['fact', facts]] : [['fact', facts], ['vault', vault]];
  for (const [kind, pool] of pools) {
    if (pool.length) return { kind, item: pool[((turn % pool.length) + pool.length) % pool.length] };
  }
  const fb = data.spotlightFallback || [];
  return fb.length ? { kind: 'player', item: { player: fb[((TODAY % fb.length) + fb.length) % fb.length] } } : null;
}

// ---------- build ----------
async function build() {
  const data = await load('widget.json');

  const w = new ListWidget();
  const bg = new LinearGradient();
  bg.colors = [C.night2, C.night];
  bg.locations = [0, 1];
  w.backgroundGradient = bg;
  w.setPadding(12, 14, 17, 14);
  w.url = tap(SITE + '#timeline');
  w.refreshAfterDate = nextTurn(NOW);

  if (!data) {
    const t = w.addText('Retro Vault');
    t.font = display(22); t.textColor = C.gold;
    w.addSpacer(4);
    const m = w.addText('Could not reach the site yet. Pull to refresh later.');
    m.font = body(12); m.textColor = C.muted;
    return w;
  }
  const cards = data.cards || {};

  // Header
  const head = w.addStack();
  head.centerAlignContent();
  const ball = head.addImage(footballImage());
  ball.imageSize = new Size(18, 18);
  head.addSpacer(6);
  const brand = head.addText('RETRO VAULT');
  brand.font = display(16); brand.textColor = C.chalk;
  head.addSpacer();
  const ed = head.addText((data.edition && data.edition.label) || data.season || '');
  ed.font = mono(10); ed.textColor = C.gold;

  w.addSpacer(8);

  // Story: one article a day (the lead pinned for 2 days after an update); falls back to the top headline
  const art = pickStory(data);
  const storyRow = w.addStack();
  storyRow.layoutHorizontally();
  const bar = storyRow.addStack();
  bar.size = new Size(4, 0);
  bar.backgroundColor = teamColors(art && art.team)[0];
  bar.cornerRadius = 2;
  storyRow.addSpacer(8);
  const sCol = storyRow.addStack();
  sCol.layoutVertically();
  // The story is about the season it names (a newer data season without a story yet keeps the honest label)
  const kicker = sCol.addText(
    art ? `THE ${data.storySeason} SEASON · ${kindLabel(art.kind)}` : `${data.season || ''} · WHAT CHANGED`,
  );
  kicker.font = mono(9); kicker.textColor = C.gold;
  sCol.addSpacer(2);
  const hl = sCol.addText(art ? art.headline : ((data.headlines || [])[0] || {}).text || 'No news yet');
  hl.font = display(21); hl.textColor = C.chalk; hl.lineLimit = 2; hl.minimumScaleFactor = 0.8;
  if (art && art.dek) {
    sCol.addSpacer(2);
    const dk = sCol.addText(art.dek);
    dk.font = body(11.5); dk.textColor = C.muted; dk.lineLimit = 3;
  }
  storyRow.url = tap(SITE + '#timeline');

  w.addSpacer(10);

  // Spotlight: Did you know / From the Vault, twice a day
  const spot = pickSpotlight(data);
  if (spot) drawSpotlight(w, spot, cards);

  w.addSpacer(9);

  // Bottom: two panels side by side, Market (left) and The Wire (right)
  const cols = w.addStack();
  cols.layoutHorizontally();
  cols.topAlignContent();
  const panel = (title, width) => {
    const p = cols.addStack();
    p.layoutVertically();
    p.size = new Size(width, 0);
    p.setPadding(7, 9, 7, 9);
    p.cornerRadius = 10;
    p.backgroundColor = C.panel;
    p.borderColor = C.line; p.borderWidth = 1;
    const h = p.addText(title);
    h.font = mono(8.5); h.textColor = C.gold;
    p.addSpacer(4);
    return p;
  };
  const market = panel('MARKET', 118);
  const movers = data.movers || [];
  if (!movers.length) {
    const q = market.addText('Quiet since the last update');
    q.font = body(10.5); q.textColor = C.muted; q.lineLimit = 3;
  }
  movers.slice(0, 3).forEach((m, i) => {
    if (i) market.addSpacer(4);
    const row = market.addStack();
    row.centerAlignContent();
    const n = row.addText(m.last);
    n.font = displayB(12.5); n.textColor = C.chalk; n.lineLimit = 1; n.minimumScaleFactor = 0.75;
    row.addSpacer();
    const t = row.addText(`${m.pct > 0 ? '▲' : '▼'}${Math.abs(m.pct)}%`);
    t.font = mono(10); t.textColor = m.pct > 0 ? C.up : C.down; t.lineLimit = 1;
  });
  market.addSpacer();
  cols.addSpacer(8);
  const wire = panel('THE WIRE', 0);
  const news = (data.headlines || []).slice(art ? 0 : 1, art ? 3 : 4);
  news.forEach((h, i) => {
    if (i) wire.addSpacer(4);
    const t = wire.addText(`${h.kind === 'chase' ? '⏱' : h.kind === 'trade' ? '⇄' : '●'} ${h.text}`);
    t.font = body(10.5); t.textColor = C.chalk; t.lineLimit = 2; t.minimumScaleFactor = 0.85;
  });
  wire.addSpacer();

  w.addSpacer();
  const foot = w.addText((data.updatedLabel || '') + ' · tap for the full story');
  foot.font = mono(8.5); foot.textColor = C.muted; foot.lineLimit = 1;
  return w;
}

function vaultLabel(item) {
  const named = { superbowl: '', record: 'RECORD BOARD', hof: 'HALL OF FAME' };
  const what = item.kind in named ? named[item.kind] : String(item.kind || '').replace(/-/g, ' ');
  return ['FROM THE VAULT', what, item.when].filter(Boolean).join(' · ').toUpperCase();
}

function drawSpotlight(w, spot, cards) {
  const it = spot.item;
  const key = it.player;
  const card = key ? cards[key] : null;
  const name = key ? key.split(':').slice(1).join(':') : null;
  const isVault = spot.kind === 'vault';
  const team = it.team || (card && card.team);
  const [c1, c2] = teamColors(team);
  const box = w.addStack();
  box.layoutHorizontally();
  box.centerAlignContent();
  box.cornerRadius = 12;

  if (card && card.ovr != null) {
    // A player: the team-coloured banner with his OVR, grade and value move
    box.setPadding(8, 10, 8, 10);
    const g = new LinearGradient();
    g.colors = [c1, new Color('#0b1020', 0.95)];
    g.locations = [0, 1];
    g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1);
    box.backgroundGradient = g;
    box.borderColor = c2; box.borderWidth = 1;
    box.url = tap(SITE + '#stats/deepdive?p=' + encodeURIComponent(key));
    const left = box.addStack();
    left.layoutVertically();
    const lab = left.addText(isVault ? vaultLabel(it) : spot.kind === 'fact' ? 'DID YOU KNOW · ' + nick(team).toUpperCase() : 'SPOTLIGHT · ' + nick(team).toUpperCase());
    lab.font = mono(8.5); lab.textColor = new Color('#ffffff', 0.75); lab.lineLimit = 1;
    const nm = left.addText(name.toUpperCase());
    nm.font = display(18); nm.textColor = Color.white(); nm.lineLimit = 1; nm.minimumScaleFactor = 0.7;
    const text = spot.kind === 'player'
      ? `${card.nick ? '"' + card.nick + '" · ' : ''}${key.split(':')[0]} · Legacy ${fmt(card.legacy || 0)}`
      : isVault && it.kind !== 'hof' ? `${it.title}: ${it.text}` : it.text;
    const sub = left.addText(text);
    sub.font = spot.kind === 'player' ? displayB(12) : body(11); sub.textColor = C.gold;
    sub.lineLimit = spot.kind === 'player' ? 1 : 3; sub.minimumScaleFactor = 0.85;
    box.addSpacer();
    const right = box.addStack();
    right.layoutVertically();
    const ovr = right.addText(String(card.ovr));
    ovr.font = display(26); ovr.textColor = Color.white(); ovr.rightAlignText();
    const ch = card.chg || 0;
    const vline = right.addText(`${card.grade || ''} ${ch ? (ch > 0 ? '▲' : '▼') + Math.abs(ch) + '%' : ''}`.trim());
    vline.font = mono(10); vline.textColor = ch > 0 ? C.up : ch < 0 ? C.down : C.muted; vline.rightAlignText();
    return;
  }

  // No player card: the dark history card with a gold kicker and the team colour bar
  box.setPadding(8, 0, 8, 10);
  box.backgroundColor = C.panel;
  box.borderColor = C.line; box.borderWidth = 1;
  box.url = tap(SITE + (it.kind === 'superbowl' ? '#timeline' : it.kind === 'hof' ? '#hof' : '#timeline'));
  const stripe = box.addStack();
  stripe.size = new Size(5, 0);
  stripe.backgroundColor = c1;
  box.addSpacer(9);
  const col = box.addStack();
  col.layoutVertically();
  const lab = col.addText(isVault ? vaultLabel(it) : 'DID YOU KNOW' + (team ? ' · ' + nick(team).toUpperCase() : ''));
  lab.font = mono(8.5); lab.textColor = C.gold; lab.lineLimit = 1;
  if (isVault && it.title) {
    col.addSpacer(1);
    const tt = col.addText(it.title.toUpperCase());
    tt.font = display(17); tt.textColor = C.chalk; tt.lineLimit = 1; tt.minimumScaleFactor = 0.7;
  }
  col.addSpacer(1);
  const tx = col.addText(it.text || '');
  tx.font = body(11.5); tx.textColor = it.owner ? C.gold : C.chalk; tx.lineLimit = isVault ? 2 : 3; tx.minimumScaleFactor = 0.85;
  box.addSpacer();
}

function kindLabel(kind) {
  return ({ lead: 'LEAD', feature: 'FEATURE', trade: 'TRADES', rise: 'RISING', fall: 'FALLING', rivalry: 'RIVALRY',
    chase: 'RECORD WATCH', milestone: 'MILESTONES', wherenow: 'WHERE ARE THEY NOW' })[kind] || 'STORY';
}

// The site's pixel football (same art as the home-screen icon)
function footballImage() {
  const art = [
    '......kkkk......',
    '...kkkbbbbkkk...',
    '.kkbbbbbbbbbbkk.',
    'kbbwbbbbbbbbwbbk',
    'kbbwbwwwwwwbwbbk',
    'kbbwbbwbwbwbwbbk',
    'kddwbbbbbbbbwddk',
    '.kkddddddddddkk.',
    '...kkkddddkkk...',
  ];
  const pal = { k: '#1c120c', b: '#8c4a26', d: '#68341a', w: '#f5f2e8' };
  const s = 6, W = 16, H = 16, top = 3;
  const dc = new DrawContext();
  dc.size = new Size(W * s, H * s);
  dc.opaque = false;
  dc.respectScreenScale = true;
  art.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (!pal[ch]) return;
      dc.setFillColor(new Color(pal[ch]));
      dc.fillRect(new Rect(x * s, (y + top) * s, s, s));
    }),
  );
  return dc.getImage();
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
