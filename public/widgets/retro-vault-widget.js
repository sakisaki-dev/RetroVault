// Retro Vault large widget for Scriptable (iOS). Loaded by retro-vault-install.js, which fetches this file from the
// public site on every refresh, so the widget updates itself. A league front page, not a team page: the season story,
// a rotating spotlight player, market movers and the wire, all read from the site's public JSON.

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

// ---------- data (cached for offline refreshes) ----------
const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.cacheDirectory(), 'retro-vault');
if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true);

async function load(name, kind) {
  const path = fm.joinPath(cacheDir, name.replace(/\//g, '_'));
  for (const base of DATA_SOURCES) {
    try {
      const r = new Request(base + name);
      r.timeoutInterval = 12;
      const text = await r.loadString();
      if (r.response && r.response.statusCode && r.response.statusCode >= 400) continue;
      if (/^\s*</.test(text)) continue; // an HTML error page, not data
      if (kind === 'json') JSON.parse(text); // validate before caching
      fm.writeString(path, text);
      return kind === 'json' ? JSON.parse(text) : text;
    } catch (e) {
      /* try the next source */
    }
  }
  if (!fm.fileExists(path)) return null;
  const text = fm.readString(path);
  return kind === 'json' ? JSON.parse(text) : text;
}

function parseCsv(text) {
  // The league sheet: a position line ("QB"), its header ("Name,Status,Team,…"), then rows.
  const rows = [];
  let pos = null, header = null;
  const split = (line) => {
    const out = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { header = null; continue; }
    if (/^(QB|RB|WR|TE|OL|DL|LB|DB|K|P)$/.test(line)) { pos = line; continue; }
    if (line.startsWith('Name,')) { header = split(line); continue; }
    if (!header || !pos) continue;
    const cells = split(line), row = { pos };
    header.forEach((h, i) => (row[h] = cells[i]));
    rows.push(row);
  }
  return rows;
}

// The league moves once a season, so the widget rotates once a day (local midnight), not every refresh.
const dayIndex = () => {
  const d = new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
};
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------- build ----------
async function build() {
  const [content, market, csv] = await Promise.all([
    load('league/content.json', 'json'),
    load('market.json', 'json'),
    load('initial-data.csv', 'text'),
  ]);

  const w = new ListWidget();
  const bg = new LinearGradient();
  bg.colors = [C.night2, C.night];
  bg.locations = [0, 1];
  w.backgroundGradient = bg;
  w.setPadding(12, 14, 12, 14);
  w.url = SITE + '#timeline';
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

  if (!content) {
    const t = w.addText('Retro Vault');
    t.font = display(22); t.textColor = C.gold;
    w.addSpacer(4);
    const m = w.addText('Could not reach the site yet. Pull to refresh later.');
    m.font = body(12); m.textColor = C.muted;
    return w;
  }

  // Header
  const head = w.addStack();
  head.centerAlignContent();
  const ball = head.addImage(footballImage());
  ball.imageSize = new Size(18, 18);
  head.addSpacer(6);
  const brand = head.addText('RETRO VAULT');
  brand.font = display(16); brand.textColor = C.chalk;
  head.addSpacer();
  const ed = head.addText((content.edition && content.edition.label) || content.season || '');
  ed.font = mono(10); ed.textColor = C.gold;

  w.addSpacer(8);

  // Story (rotates through the season's articles; falls back to the top headline)
  const story = (content.seasonStories || []).slice(-1)[0];
  const articles = story ? story.articles.filter((a) => a.kind !== 'quickhits' && a.kind !== 'didyouknow') : [];
  const art = articles.length ? articles[dayIndex() % articles.length] : null;
  const leadTeam = art && art.teams && art.teams[0];
  const storyRow = w.addStack();
  storyRow.layoutHorizontally();
  const bar = storyRow.addStack();
  bar.size = new Size(4, 0);
  bar.backgroundColor = teamColors(leadTeam)[0];
  bar.cornerRadius = 2;
  storyRow.addSpacer(8);
  const sCol = storyRow.addStack();
  sCol.layoutVertically();
  const kicker = sCol.addText(
    art ? `THE ${story.season} SEASON · ${kindLabel(art.kind)}` : `${content.season || ''} · WHAT CHANGED`,
  );
  kicker.font = mono(9); kicker.textColor = C.gold;
  sCol.addSpacer(2);
  const hl = sCol.addText(art ? art.headline : ((content.headlines || [])[0] || {}).text || 'No news yet');
  hl.font = display(21); hl.textColor = C.chalk; hl.lineLimit = 2; hl.minimumScaleFactor = 0.8;
  if (art && art.dek) {
    sCol.addSpacer(2);
    const dk = sCol.addText(art.dek);
    dk.font = body(11.5); dk.textColor = C.muted; dk.lineLimit = 3;
  }
  if (art) storyRow.url = SITE + '#timeline';

  w.addSpacer(10);

  // Spotlight (rotates hourly over active nicknamed players, big market movers and S-tier players)
  const latest = market && market.length ? market[market.length - 1].players : {};
  const prev = market && market.length > 1 ? market[market.length - 2].players : {};
  const rows = csv ? parseCsv(csv) : [];
  const active = rows.filter((r) => r.Status === 'Active');
  const change = (k) => (prev[k] && prev[k].value >= 50 && latest[k] ? (latest[k].value - prev[k].value) / prev[k].value : 0);
  const cands = active
    .map((r) => ({ r, k: `${r.pos}:${r.Name}` }))
    .filter(({ r, k }) => latest[k] && ((r.Nicknames || '').trim() || latest[k].grade === 'S' || Math.abs(change(k)) >= 0.25))
    .sort((a, b) => (latest[b.k].legacy || 0) - (latest[a.k].legacy || 0));
  // Prefer the names worth a spotlight: nicknames and S grades first, then the biggest movers; top 14 by legacy rotate.
  const score = ({ r, k }) => ((r.Nicknames || '').trim() ? 2 : 0) + (latest[k].grade === 'S' ? 2 : 0) + Math.min(1, Math.abs(change(k)));
  const pool = cands.sort((a, b) => score(b) - score(a) || (latest[b.k].legacy || 0) - (latest[a.k].legacy || 0)).slice(0, 14);
  const pick = pool.length ? pool[(dayIndex() * 7) % pool.length] : null;
  const facts = story ? story.didYouKnow || story.articles.filter((a) => a.kind === 'didyouknow') : [];
  const fact = facts.length ? facts[dayIndex() % facts.length] : null;
  const factRow = fact && fact.players && fact.players.length ? active.concat(rows).find((r) => r.Name === fact.players[0]) : null;
  const factSpot = factRow && latest[`${factRow.pos}:${factRow.Name}`] ? { r: factRow, k: `${factRow.pos}:${factRow.Name}` } : null;
  const spot = factSpot || pick;
  if (spot && latest[spot.k]) {
    const { r, k } = spot;
    const p = latest[k];
    const [c1, c2] = teamColors(r.Team);
    const card = w.addStack();
    card.layoutHorizontally();
    card.centerAlignContent();
    card.setPadding(8, 10, 8, 10);
    card.cornerRadius = 12;
    const g = new LinearGradient();
    g.colors = [c1, new Color('#0b1020', 0.95)];
    g.locations = [0, 1];
    g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1);
    card.backgroundGradient = g;
    card.borderColor = c2; card.borderWidth = 1;
    card.url = SITE + '#stats/deepdive?p=' + encodeURIComponent(k);
    const left = card.addStack();
    left.layoutVertically();
    const lab = left.addText((factSpot ? 'DID YOU KNOW · ' : 'SPOTLIGHT · ') + nick(r.Team).toUpperCase());
    lab.font = mono(8.5); lab.textColor = new Color('#ffffff', 0.75);
    const nm = left.addText(r.Name.toUpperCase());
    nm.font = display(18); nm.textColor = Color.white(); nm.lineLimit = 1; nm.minimumScaleFactor = 0.7;
    const nn = (r.Nicknames || '').trim();
    const factText = factSpot ? fact.text || fact.dek || fact.headline : null;
    const sub = left.addText(factText || `${nn ? '"' + nn + '" · ' : ''}${r.pos} · Legacy ${fmt(p.legacy || 0)}`);
    sub.font = factText ? body(11) : displayB(12); sub.textColor = C.gold; sub.lineLimit = factText ? 3 : 1;
    card.addSpacer();
    const right = card.addStack();
    right.layoutVertically();
    const ovr = right.addText(String(p.ovr));
    ovr.font = display(26); ovr.textColor = Color.white(); ovr.rightAlignText();
    const ch = change(k);
    const vline = right.addText(`${p.grade || ''} ${ch ? (ch > 0 ? '▲' : '▼') + Math.abs(Math.round(ch * 100)) + '%' : ''}`.trim());
    vline.font = mono(10); vline.textColor = ch > 0 ? C.up : ch < 0 ? C.down : C.muted; vline.rightAlignText();
  }

  w.addSpacer(9);

  // Market strip: two risers, one faller
  const movers = Object.keys(latest)
    .map((k) => ({ k, d: change(k) }))
    .filter((m) => m.d)
    .sort((a, b) => b.d - a.d);
  const strip = w.addStack();
  strip.centerAlignContent();
  const mk = strip.addText('MARKET');
  mk.font = mono(9); mk.textColor = C.gold;
  strip.addSpacer(6);
  const chosen = [...movers.slice(0, 2), ...movers.slice(-1).filter((m) => m.d < 0)];
  if (!chosen.length) {
    const q = strip.addText('Quiet since the last update');
    q.font = body(11); q.textColor = C.muted;
  }
  chosen.forEach((m, i) => {
    if (i) strip.addSpacer(8);
    const last = m.k.split(':')[1].split(' ').slice(-1)[0];
    const t = strip.addText(`${m.d > 0 ? '▲' : '▼'} ${last} ${Math.abs(Math.round(m.d * 100))}%`);
    t.font = mono(10.5); t.textColor = m.d > 0 ? C.up : C.down; t.lineLimit = 1;
  });

  w.addSpacer(8);

  // Wire: newest headlines (the record chase gets its own icon)
  const wireHead = w.addText('THE WIRE');
  wireHead.font = mono(9); wireHead.textColor = C.gold;
  w.addSpacer(3);
  const news = (content.headlines || []).slice(art ? 0 : 1, art ? 3 : 4);
  news.forEach((h) => {
    const t = w.addText(`${h.kind === 'chase' ? '⏱' : h.kind === 'trade' ? '⇄' : '●'}  ${h.text}`);
    t.font = body(11.5); t.textColor = C.chalk; t.lineLimit = 1; t.minimumScaleFactor = 0.85;
    w.addSpacer(2);
  });

  w.addSpacer();
  const foot = w.addText(((content.headlinesInfo && content.headlinesInfo.label) || '') + ' · tap for the full story');
  foot.font = mono(8.5); foot.textColor = C.muted; foot.lineLimit = 1;
  return w;
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
