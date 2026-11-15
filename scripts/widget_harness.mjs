#!/usr/bin/env node
/**
 * Test harness for the Scriptable widget (public/widgets/retro-vault-widget.js), which can't run off the phone.
 *
 * It stubs the slice of Scriptable's API the widget uses (ListWidget, WidgetStack, WidgetText, WidgetImage,
 * DrawContext, Path, Image, Font, Color, Size, Rect, Point, LinearGradient, Request, FileManager, Device, config,
 * args, Script), serves Request from the repo's own public/ folder (widget.json, widget-sprites; team logos fail,
 * as offline), runs the script once per view and:
 *   - dumps each widget tree as indented text (stacks, sizes, texts, images, DrawContext op counts)
 *   - renders each tree to static HTML: stacks as flex boxes, DrawContext images as inline SVG of the exact draw calls
 *     (pixel labels, rims, sprites at the drawn rects), so the preview is the script's own output
 * Any exception fails the run (exit code 1).
 *
 *   node scripts/widget_harness.mjs [outDir]          every view; HTML + tree dumps in outDir
 *   RV_NOW=2026-11-20T09:00 node scripts/widget_harness.mjs  pin the clock (default: the day after the last update + 3)
 *
 * Views: large x3 days (front, spot, take), medium, small, accessoryInline, accessoryCircular (every rotation),
 * accessoryRectangular (every rotation).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'node_modules', '.tmp', 'widget-preview'));
mkdirSync(OUT, { recursive: true });
const SCRIPT = readFileSync(join(ROOT, 'public/widgets/retro-vault-widget.js'), 'utf8');
const DATA = JSON.parse(readFileSync(join(ROOT, 'public/data/widget.json'), 'utf8'));

// ---------------- stubs ----------------
class Color {
  constructor(hex, alpha = 1) {
    this.hex = String(hex).startsWith('#') ? hex : '#' + hex;
    this.alpha = alpha;
  }
  static white() { return new Color('#ffffff'); }
  static black() { return new Color('#000000'); }
  static clear() { return new Color('#000000', 0); }
  get css() {
    const n = parseInt(this.hex.slice(1, 7), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${this.alpha})`;
  }
}
class Font {
  constructor(name, size) { this.name = name; this.size = size; }
  static sys(size, weight, extra = {}) { const f = new Font('system', size); f.weight = weight; Object.assign(f, extra); return f; }
  static systemFont(s) { return Font.sys(s, 400); }
  static mediumSystemFont(s) { return Font.sys(s, 500); }
  static semiboldSystemFont(s) { return Font.sys(s, 600); }
  static boldSystemFont(s) { return Font.sys(s, 700); }
  static heavySystemFont(s) { return Font.sys(s, 800); }
  static boldMonospacedSystemFont(s) { return Font.sys(s, 700, { mono: true }); }
  static heavyRoundedSystemFont(s) { return Font.sys(s, 800, { rounded: true }); }
  get css() {
    if (this.name === 'system') {
      const fam = this.mono ? 'ui-monospace, Menlo, monospace' : this.rounded ? 'ui-rounded, -apple-system, sans-serif' : '-apple-system, sans-serif';
      return `font-family:${fam};font-weight:${this.weight};font-size:${this.size}px`;
    }
    const italic = /Italic/.test(this.name);
    const weight = /Heavy/.test(this.name) ? 800 : /Bold/.test(this.name) ? 700 : 500;
    return `font-family:Avenir Next Condensed,sans-serif;font-weight:${weight};font-style:${italic ? 'italic' : 'normal'};font-size:${this.size}px`;
  }
}
class Size { constructor(w, h) { this.width = w; this.height = h; } }
class Point { constructor(x, y) { this.x = x; this.y = y; } }
class Rect {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; }
  get minX() { return this.x; } get minY() { return this.y; }
}
class Path {
  constructor() { this.d = []; }
  move(p) { this.d.push(`M${p.x} ${p.y}`); }
  addLine(p) { this.d.push(`L${p.x} ${p.y}`); }
  addRect(r) { this.d.push(`M${r.x} ${r.y}h${r.width}v${r.height}h${-r.width}Z`); }
  addRoundedRect(r, rx, ry) {
    const { x, y, width: w, height: h } = r;
    rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
    this.d.push(`M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`);
  }
  closeSubpath() { this.d.push('Z'); }
}
class Image {
  constructor(size, kind, payload) { this.size = size; this.kind = kind; this.payload = payload; }
}
const pngSize = (buf) => new Size(buf.readUInt32BE(16), buf.readUInt32BE(20));
class DrawContext {
  constructor() { this.ops = []; this.size = new Size(0, 0); this.fill = null; this.stroke = null; this.lw = 1; this.path = null; this.font = Font.systemFont(12); this.tc = Color.black(); this.align = 'left'; }
  setFillColor(c) { this.fill = c; }
  setStrokeColor(c) { this.stroke = c; }
  setLineWidth(w) { this.lw = w; }
  fillRect(r) { this.ops.push(['rect', r, this.fill]); }
  fill(r) { this.fillRect(r); }
  fillEllipse(r) { this.ops.push(['ellipse', r, this.fill]); }
  strokeEllipse(r) { this.ops.push(['sellipse', r, this.stroke, this.lw]); }
  addPath(p) { this.path = p; }
  fillPath() { if (this.path) this.ops.push(['path', this.path.d.join(''), this.fill, null]); }
  strokePath() { if (this.path) this.ops.push(['path', this.path.d.join(''), null, this.stroke, this.lw]); }
  drawImageInRect(img, r) { if (!img) throw new Error('drawImageInRect(null)'); this.ops.push(['image', img, r]); }
  drawImageAtPoint(img, p) { this.ops.push(['image', img, new Rect(p.x, p.y, img.size.width, img.size.height)]); }
  setFont(f) { this.font = f; }
  setTextColor(c) { this.tc = c; }
  setTextAlignedCenter() { this.align = 'center'; }
  setTextAlignedLeft() { this.align = 'left'; }
  setTextAlignedRight() { this.align = 'right'; }
  drawTextInRect(t, r) { this.ops.push(['text', String(t), r, this.font, this.tc, this.align]); }
  drawText(t, p) { this.ops.push(['text', String(t), new Rect(p.x, p.y, 1000, this.font.size * 1.3), this.font, this.tc, 'left']); }
  getImage() {
    if (!(this.size.width > 0 && this.size.height > 0)) throw new Error('DrawContext without a size');
    return new Image(new Size(this.size.width, this.size.height), 'draw', this.ops.slice());
  }
}
class LinearGradient { constructor() { this.colors = []; this.locations = []; } }
class Node {
  constructor(kind, parent) { this.kind = kind; this.children = []; this.parent = parent; this.layout = kind === 'stack' ? 'h' : 'v'; this.align = null; }
  addStack() { const s = new Node('stack', this); this.children.push(s); return s; }
  addText(t) { const n = new Node('text', this); n.text = String(t); n.font = Font.systemFont(17); this.children.push(n); return n; }
  addImage(img) {
    if (!img || !img.size) throw new Error('addImage(null)');
    const n = new Node('image', this); n.image = img; this.children.push(n); return n;
  }
  addSpacer(n) { const s = new Node('spacer', this); s.length = n == null ? null : n; this.children.push(s); return s; }
  addDate(d) { return this.addText(d.toISOString()); }
  layoutHorizontally() { this.layout = 'h'; }
  layoutVertically() { this.layout = 'v'; }
  topAlignContent() { this.align = 'flex-start'; }
  centerAlignContent() { this.align = 'center'; }
  bottomAlignContent() { this.align = 'flex-end'; }
  setPadding(t, l, b, r) { this.padding = [t, l, b, r]; }
  useDefaultPadding() { this.padding = null; }
  centerAlignImage() { this.imgAlign = 'center'; }
  leftAlignImage() { this.imgAlign = 'left'; }
  rightAlignImage() { this.imgAlign = 'right'; }
  centerAlignText() { this.textAlign = 'center'; }
  leftAlignText() { this.textAlign = 'left'; }
  rightAlignText() { this.textAlign = 'right'; }
  async presentLarge() {} async presentMedium() {} async presentSmall() {}
}
class ListWidget extends Node { constructor() { super('widget', null); this.layout = 'v'; } }

function makeEnv(family, opts) {
  const files = new Map();
  const fm = {
    joinPath: (a, b) => `${a}/${b}`,
    cacheDirectory: () => '/cache',
    documentsDirectory: () => '/docs',
    fileExists: (p) => p === '/cache/retro-vault' || files.has(p),
    createDirectory: () => {},
    writeString: (p, s) => files.set(p, { s, t: new Date() }),
    readString: (p) => files.get(p).s,
    writeImage: (p, i) => files.set(p, { i, t: new Date() }),
    readImage: (p) => files.get(p).i,
    modificationDate: (p) => files.get(p).t,
  };
  const requests = [];
  class Request {
    constructor(url) { this.url = url; this.response = { statusCode: 200 }; }
    local() {
      const m = /\/public\/(.+)$/.exec(this.url) || /github\.io\/RetroVault\/(.+)$/.exec(this.url);
      return m ? join(ROOT, 'public', m[1]) : null;
    }
    async loadString() {
      requests.push(this.url);
      const p = this.local();
      if (opts.offline || !p || !existsSync(p)) { this.response.statusCode = 404; throw new Error('404 ' + this.url); }
      if (/widget\.json$/.test(p) && opts.data) return JSON.stringify(opts.data);
      return readFileSync(p, 'utf8');
    }
    async loadImage() {
      requests.push(this.url);
      const p = this.local();
      if (opts.offline || !p || !existsSync(p)) throw new Error('image 404 ' + this.url);
      const buf = readFileSync(p);
      return new Image(pngSize(buf), 'file', p);
    }
  }
  let captured = null;
  const env = {
    ListWidget, DrawContext, Path, Image, Font, Color, Size, Rect, Point, LinearGradient, Request,
    FileManager: { local: () => fm, iCloud: () => fm },
    Device: { screenSize: () => new Size(430, 932), screenScale: () => 3, isPad: () => false },
    config: { widgetFamily: family, runsInWidget: true },
    args: { widgetParameter: '' },
    Script: { setWidget: (w) => { captured = w; }, complete: () => {} },
    RV_FAMILY: family, RV_NOW: opts.now, RV_DAY: opts.day || null, RV_LOCK: opts.lock || null,
  };
  return { env, get widget() { return captured; }, requests };
}

async function run(family, opts = {}) {
  const box = makeEnv(family, opts);
  const names = Object.keys(box.env);
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const fn = new AsyncFunction(...names, SCRIPT);
  await fn(...names.map((n) => box.env[n]));
  if (!box.widget) throw new Error('Script.setWidget was never called');
  return box;
}

// ---------------- tree dump ----------------
function dump(n, d = 0) {
  const pad = '  '.repeat(d);
  const sz = n.size ? ` size=${Math.round(n.size.width)}x${Math.round(n.size.height)}` : '';
  if (n.kind === 'text') return `${pad}text "${n.text.slice(0, 90)}" (${n.font.name} ${n.font.size}${n.lineLimit ? `, ${n.lineLimit} lines` : ''})\n`;
  if (n.kind === 'image') {
    const i = n.image;
    const what = i.kind === 'file' ? `file ${i.payload.replace(ROOT + '/', '')}` : `draw ${i.payload.length} ops`;
    const s = n.imageSize || i.size;
    return `${pad}image ${what} at ${Math.round(s.width)}x${Math.round(s.height)}\n`;
  }
  if (n.kind === 'spacer') return `${pad}spacer ${n.length == null ? 'flex' : n.length}\n`;
  let out = `${pad}${n.kind}${n.kind === 'stack' ? '(' + n.layout + ')' : ''}${sz}${n.backgroundImage ? ' bg=' + n.backgroundImage.payload.length + 'ops' : ''}${n.url ? ' url=' + n.url.replace(/^https:\/\/[^#]+/, '') : ''}\n`;
  for (const c of n.children) out += dump(c, d + 1);
  return out;
}

// ---------------- HTML ----------------
const dataUris = new Map();
const fileUri = (p) => {
  if (!dataUris.has(p)) dataUris.set(p, 'data:image/png;base64,' + readFileSync(p).toString('base64'));
  return dataUris.get(p);
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const col = (c) => (c ? c.css : 'none');
function svgOf(img, w, h) {
  if (img.kind === 'file') return `<img src="${fileUri(img.payload)}" style="width:${w}px;height:${h}px;image-rendering:pixelated;display:block">`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${img.size.width} ${img.size.height}" preserveAspectRatio="none" style="display:block;overflow:hidden">${svgOps(img.payload)}</svg>`;
}
function svgOps(ops) {
  let s = '';
  for (const op of ops) {
    const [k] = op;
    if (k === 'rect') s += `<rect x="${op[1].x}" y="${op[1].y}" width="${op[1].width}" height="${op[1].height}" fill="${col(op[2])}"/>`;
    else if (k === 'ellipse') s += `<ellipse cx="${op[1].x + op[1].width / 2}" cy="${op[1].y + op[1].height / 2}" rx="${op[1].width / 2}" ry="${op[1].height / 2}" fill="${col(op[2])}"/>`;
    else if (k === 'sellipse') s += `<ellipse cx="${op[1].x + op[1].width / 2}" cy="${op[1].y + op[1].height / 2}" rx="${op[1].width / 2}" ry="${op[1].height / 2}" fill="none" stroke="${col(op[2])}" stroke-width="${op[3]}"/>`;
    else if (k === 'path') s += `<path d="${op[1]}" fill="${op[2] ? col(op[2]) : 'none'}" stroke="${op[3] ? col(op[3]) : 'none'}" stroke-width="${op[4] || 0}" stroke-linejoin="round"/>`;
    else if (k === 'image') {
      const [, img, r] = op;
      if (img.kind === 'file') s += `<image href="${fileUri(img.payload)}" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
      else s += `<svg x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" viewBox="0 0 ${img.size.width} ${img.size.height}" preserveAspectRatio="none">${svgOps(img.payload)}</svg>`;
    } else if (k === 'text') {
      const [, t, r, f, c, a] = op;
      s += `<foreignObject x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"><div xmlns="http://www.w3.org/1999/xhtml" style="${f.css};color:${col(c)};text-align:${a};line-height:1.15;white-space:nowrap">${esc(t)}</div></foreignObject>`;
    }
  }
  return s;
}
// A stack's own flexibility: a flexible spacer along its axis makes it grow along that axis
const flexAlong = (n) => n.children.some((c) => c.kind === 'spacer' && c.length == null);
function html(n, parentLayout) {
  if (n.kind === 'spacer') {
    if (n.length == null) return `<div style="flex:1 1 0;min-width:0;min-height:0"></div>`;
    return `<div style="flex:none;${parentLayout === 'h' ? 'width' : 'height'}:${n.length}px"></div>`;
  }
  if (n.kind === 'text') {
    const lines = n.lineLimit || 0;
    const clamp = lines ? `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lines};overflow:hidden;` : '';
    return `<div style="${n.font.css};color:${col(n.textColor || Color.black())};line-height:1.17;${clamp}position:relative;min-width:0;flex:0 1 auto;text-align:${n.textAlign || 'left'}">${esc(n.text)}</div>`;
  }
  if (n.kind === 'image') {
    const s = n.imageSize || n.image.size;
    const self = n.imgAlign === 'center' ? 'align-self:center;' : '';
    return `<div style="flex:none;position:relative;${self}">${svgOf(n.image, s.width, s.height)}</div>`;
  }
  const v = n.layout === 'v';
  const st = [];
  st.push(`display:flex;flex-direction:${v ? 'column' : 'row'};position:relative;box-sizing:border-box`);
  st.push(`align-items:${n.align || (v ? 'flex-start' : 'center')}`);
  if (n.padding) st.push(`padding:${n.padding.map((p) => p + 'px').join(' ')}`);
  const w = n.size && n.size.width > 0 ? n.size.width : null;
  const h = n.size && n.size.height > 0 ? n.size.height : null;
  if (w) st.push(`width:${w}px;flex-shrink:0`);
  if (h) st.push(`height:${h}px;flex-shrink:0`);
  if (n.kind !== 'widget' && n.parent) {
    const grows = flexAlong(n);
    const along = n.parent.layout === n.layout;
    if (grows && along && !(along && (v ? h : w))) st.push('flex:1 1 auto');
    if (grows && !along && !(v ? w : h)) st.push('align-self:stretch');
    if (!w && n.parent.layout === 'h') st.push('min-width:0');
  }
  if (n.backgroundColor) st.push(`background:${col(n.backgroundColor)}`);
  if (n.cornerRadius) st.push(`border-radius:${n.cornerRadius}px;overflow:hidden`);
  let inner = '';
  if (n.backgroundImage) {
    inner += `<div style="position:absolute;inset:0;z-index:0">${svgOf(n.backgroundImage, '100%', '100%').replace(/width="100%" height="100%"/, 'width="100%" height="100%"')}</div>`;
  }
  inner += `<div style="display:contents">${n.children.map((c) => html(c, n.layout)).join('')}</div>`;
  return `<div style="${st.join(';')}">${inner}</div>`;
}
// Children sit over the background image
const layer = (s) => s.replace(/<div style="display:contents">/g, '<div style="display:contents;position:relative;z-index:1">');

const SIZES = { large: [364, 382], medium: [364, 170], small: [170, 170], accessoryInline: [240, 22], accessoryCircular: [72, 72], accessoryRectangular: [172, 76] };
function widgetHtml(w, family) {
  const [W, H] = SIZES[family];
  const lock = family.startsWith('accessory');
  const st = [`width:${W}px;height:${H}px;box-sizing:border-box;position:relative;overflow:hidden;display:flex;flex-direction:column`];
  if (!lock) st.push(`border-radius:24px;background:${col(w.backgroundColor)}`);
  if (w.addAccessoryWidgetBackground) st.push(`background:rgba(255,255,255,.16);border-radius:${family === 'accessoryCircular' ? '50%' : '12px'}`);
  const pad = w.padding || (lock ? [0, 0, 0, 0] : [16, 16, 16, 16]);
  st.push(`padding:${pad.map((p) => p + 'px').join(' ')}`);
  st.push(family === 'accessoryCircular' ? 'align-items:center;justify-content:center' : 'align-items:stretch');
  const bg = w.backgroundImage ? `<div style="position:absolute;inset:0">${svgOf(w.backgroundImage, W, H)}</div>` : '';
  const kids = w.children.map((c) => html(c, 'v')).join('');
  const color = lock ? 'color:#fff;' : '';
  return layer(`<div style="${st.join(';')};${color}">${bg}<div style="display:contents">${kids}</div></div>`);
}
function inlineHtml(w) {
  const t = w.children.find((c) => c.kind === 'text');
  return `<div style="font:600 15px -apple-system,sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:${SIZES.accessoryInline[0]}px">${esc(t ? t.text : '')}</div>`;
}
const page = (title, body, w, h, bg = '#05070f') =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>html,body{margin:0;background:${bg}}*{-webkit-font-smoothing:antialiased}</style></head><body><div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">${body}</div></body></html>`;

// ---------------- run every view ----------------
const lastUpdate = /^(\d{4})-(\d{2})-(\d{2})/.exec(DATA.latestUpdateAt || '');
const NOW = process.env.RV_NOW || (lastUpdate ? new Date(Date.UTC(+lastUpdate[1], +lastUpdate[2] - 1, +lastUpdate[3] + 3, 9)).toISOString().slice(0, 16) : '2026-11-20T09:00');
const BREAKING_NOW = lastUpdate ? `${lastUpdate[1]}-${lastUpdate[2]}-${lastUpdate[3]}T09:00` : NOW;
const views = [
  ['large-front', 'large', { day: 'front', now: BREAKING_NOW }],
  ['large-front-later', 'large', { day: 'front' }],
  ['large-spot', 'large', { day: 'spot' }],
  ['large-take', 'large', { day: 'take' }],
  ['large-rotation', 'large', {}],
  ['medium', 'medium', {}],
  ['small', 'small', {}],
  ['inline', 'accessoryInline', {}],
  ['circular-chase', 'accessoryCircular', { lock: 'chase' }],
  ['circular-gauntlet', 'accessoryCircular', { lock: 'gauntlet' }],
  ['circular-titles', 'accessoryCircular', { lock: 'titles' }],
  ['circular-spot', 'accessoryCircular', { lock: 'spot' }],
  ['rect-story', 'accessoryRectangular', { lock: 'story' }],
  ['rect-chase', 'accessoryRectangular', { lock: 'chase' }],
  ['rect-spot', 'accessoryRectangular', { lock: 'spot' }],
  ['rect-vault', 'accessoryRectangular', { lock: 'vault' }],
  ['large-offline', 'large', { offline: true }],
  ['large-no-sprites', 'large', { day: 'take', data: stripSprites(DATA) }],
  ['lock-no-sprites', 'accessoryCircular', { lock: 'spot', data: stripSprites(DATA) }],
];
function stripSprites(d) {
  const c = JSON.parse(JSON.stringify(d));
  const walk = (x) => { if (x && typeof x === 'object') { delete x.sprite; delete x.sil; Object.values(x).forEach(walk); } };
  walk(c);
  return c;
}

let failed = 0;
const results = {};
const inlineLines = [];
for (const [id, family, opts] of views) {
  try {
    const box = await run(family, { now: NOW, ...opts });
    const w = box.widget;
    results[id] = { family, w };
    writeFileSync(join(OUT, `${id}.tree.txt`), dump(w));
    if (family === 'accessoryInline') inlineLines.push(w.children.find((c) => c.kind === 'text').text);
    console.log(`ok   ${id.padEnd(20)} ${family}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${id.padEnd(20)} ${family}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
  }
}
// every inline rotation (one per 3-hour turn)
for (let i = 1; i < 12; i++) {
  const d = new Date(Date.parse(NOW + 'Z') + i * 3 * 36e5).toISOString().slice(0, 16);
  try {
    const box = await run('accessoryInline', { now: d });
    inlineLines.push(box.widget.children.find((c) => c.kind === 'text').text);
  } catch (e) { failed++; console.log('FAIL inline rotation', d, e.message); }
}

// Previews: the three large days, plus the lock screen sheet
for (const id of ['large-front', 'large-spot', 'large-take', 'medium', 'small']) {
  const r = results[id];
  if (!r) continue;
  const [W, H] = SIZES[r.family];
  writeFileSync(join(OUT, `${id}.html`), page(id, widgetHtml(r.w, r.family), W, H));
}
const lockIds = ['circular-gauntlet', 'circular-chase', 'circular-titles', 'circular-spot', 'rect-story', 'rect-chase', 'rect-spot', 'rect-vault'];
const kicker = (t) => `<div style="font:8px Menlo,monospace;letter-spacing:1px;color:rgba(255,255,255,.6);margin:14px 0 8px">${t}</div>`;
const uniq = [...new Set(inlineLines)];
const lockBody = `<div style="width:390px;height:640px;box-sizing:border-box;padding:22px 20px;background:linear-gradient(180deg,#34405f,#151b2e);border-radius:22px">
${kicker('INLINE, ROTATING (EVERY 3 HOURS)')}${uniq.map((t) => `<div style="margin-bottom:6px">${inlineHtml({ children: [{ kind: 'text', text: t }] })}</div>`).join('')}
${kicker('CIRCULAR')}<div style="display:flex;justify-content:space-between">${lockIds.slice(0, 4).map((id) => results[id] ? widgetHtml(results[id].w, 'accessoryCircular') : '').join('')}</div>
${kicker('RECTANGULAR')}<div style="display:grid;grid-template-columns:repeat(2,172px);gap:10px">${lockIds.slice(4).map((id) => results[id] ? `<div style="background:rgba(255,255,255,.14);border-radius:14px;padding:3px">${widgetHtml(results[id].w, 'accessoryRectangular')}</div>` : '').join('')}</div>
</div>`;
writeFileSync(join(OUT, 'lock.html'), page('lock', lockBody, 390, 640));
writeFileSync(join(OUT, 'inline.txt'), uniq.join('\n') + '\n');
console.log(`\n${Object.keys(results).length}/${views.length} views ran, ${failed} failures; trees and previews in ${OUT}`);
process.exit(failed ? 1 : 0);
