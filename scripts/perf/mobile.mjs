// Throttled mobile measurement (node scripts/perf/mobile.mjs --dist <dir> --label <name> [--only a,b] [--net slow4g|none] [--cpu 4] [--shots dir]).
//   390 x 844, CDP slow 4G (150 ms RTT, 1.6 Mbps down) and a 4x CPU slowdown, a cold context per page. Records first contentful
//   paint, the time the tab's main content is up (marker text, no loader left) and calm, request count and bytes (own host), the last
//   own request's time, and long tasks (PerformanceObserver). External hosts (fonts, ESPN, weather) are blocked.
import fs from 'node:fs';
import path from 'node:path';
import { launch, newPage } from './cdp.mjs';
import { serve } from './serve.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? d : process.argv[i + 1]; };
const dist = path.resolve(arg('dist', 'dist'));
const label = arg('label', path.basename(dist));
const port = Number(arg('port', '4283'));
const only = arg('only')?.split(',');
const net = arg('net', 'slow4g');
const cpu = Number(arg('cpu', '4'));
const shots = arg('shots');
const BASE = `http://127.0.0.1:${port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const PAGES = [
  { id: 'arcade', hash: '#games', marker: 'PRESS START' },
  { id: 'stats', hash: '#stats/players', marker: '90\\+ OVR\\s+[1-9]' },
  { id: 'season', hash: '#season', marker: 'POWER RANK' },
  { id: 'collection', hash: '#collection', marker: 'Common\\s+\\d+/[1-9]' },
  { id: 'hof', hash: '#hof', marker: 'NEWEST ENSHRINEES' },
  { id: 'timeline', hash: '#timeline', marker: 'THE WIRE' },
  { id: 'office', hash: '#office', marker: 'SUPER BOWL RECORD' },
  { id: 'deepdive', hash: '#stats/deepdive?p=RB:Ryland%20Maxwell', marker: 'SKILL RATINGS' },
];

const INIT = `
  window.__lt = 0; window.__ltn = 0; window.__ltmax = 0;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt += Math.max(0, e.duration - 50); window.__ltn++; window.__ltmax = Math.max(window.__ltmax, e.duration); } }).observe({ entryTypes: ['longtask'] }); } catch {}
  window.__wait = async (marker, timeout) => {
    const t0 = performance.now(); let calm = 0, last = performance.now(), markerAt = 0;
    const re = new RegExp(marker);
    while (performance.now() - t0 < timeout) {
      await new Promise((r) => setTimeout(r, 0));
      const now = performance.now(), gap = now - last; last = now;
      const t = document.body ? document.body.innerText : '';
      const up = re.test(t);
      if (up && !markerAt) markerAt = now;
      // full = the marker is up, no football loader is left on screen and the main thread is calm
      calm = gap < 60 && up && !document.querySelector('.pl-ball') ? calm + 1 : 0;
      if (calm >= 6) return { ok: true, at: now, markerAt };
    }
    return { ok: false, at: performance.now(), markerAt };
  };
`;

const srv = await serve(dist, port);
const { browser, close } = await launch();
const out = {};
try {
  for (const pg of PAGES) {
    if (only && !only.includes(pg.id)) continue;
    const page = await newPage(browser);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await page.send('Network.setBlockedURLs', { urls: ['*googleapis*', '*gstatic*', '*espncdn*', '*espn.com*', '*bigdatacloud*', '*open-meteo*', '*/espn-content/*'] });
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (net === 'slow4g') await page.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT });
    const reqs = new Map(); let t00 = null;
    page.on('Network.requestWillBeSent', (p) => { if (t00 === null) t00 = p.timestamp; reqs.set(p.requestId, { url: p.request.url, enc: 0, t: p.timestamp }); });
    page.on('Network.loadingFinished', (p) => { const r = reqs.get(p.requestId); if (r) { r.enc = p.encodedDataLength; r.end = p.timestamp; } });
    const errors = [];
    page.on('Runtime.exceptionThrown', (p) => errors.push((p.exceptionDetails.exception?.description || p.exceptionDetails.text).slice(0, 200)));
    page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push('console: ' + (p.args[0]?.value || p.args[0]?.description || '').toString().slice(0, 160)); });
    if (process.env.PROFILE) { await page.send('Profiler.enable'); await page.send('Profiler.setSamplingInterval', { interval: 500 }); await page.send('Profiler.start'); }
    await page.send('Page.navigate', { url: BASE + pg.hash });
    await sleep(100);
    const r = await page.evaluate(`window.__wait(${JSON.stringify(pg.marker)}, 45000)`).catch((e) => ({ ok: false, err: String(e) }));
    await sleep(3000);
    if (process.env.PROFILE) {
      const { profile } = await page.send('Profiler.stop');
      const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const dt = profile.timeDeltas; 
      profile.samples.forEach((id, i) => { const n = byId.get(id); const f = n.callFrame; const k = `${f.functionName || '(anon)'} ${f.url.replace(BASE, '').replace(/^.*assets\//, '')}:${f.lineNumber}:${f.columnNumber}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
      const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
      process.stderr.write(`-- profile ${pg.id} (self ms at ${cpu}x)\n` + rows.map(([k, v]) => `${String(Math.round(v / 1000)).padStart(6)} ${k}`).join('\n') + '\n');
      // by file
      const byFile = new Map(); profile.samples.forEach((id, i) => { const f = byId.get(id).callFrame; const k = f.url.replace(BASE, '') || f.functionName; byFile.set(k, (byFile.get(k) || 0) + (dt[i] || 0)); });
      process.stderr.write([...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${String(Math.round(v / 1000)).padStart(6)} ${k}`).join('\n') + '\n');
    }
    const fcp = await page.evaluate(`(performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime||0`);
    const lt = await page.evaluate('({ms: window.__lt, n: window.__ltn, max: Math.round(window.__ltmax)})');
    if (shots) { fs.mkdirSync(shots, { recursive: true }); const s = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); fs.writeFileSync(path.join(shots, `${label}-${pg.id}.jpg`), Buffer.from(s.data, 'base64')); }
    const own = [...reqs.values()].filter((q) => q.url.startsWith(BASE));
    const sprites = own.filter((q) => /private-sprites\/.*\d|widget-sprites|\/sprites\//.test(q.url));
    const rest = own.filter((q) => !sprites.includes(q));
    const t0 = Math.min(...own.map((q) => q.t));
    const lastReq = Math.max(...own.map((q) => (q.end ?? q.t))) - t0;
    out[pg.id] = { fcp: Math.round(fcp), contentMs: Math.round(r.markerAt || 0), fullMs: Math.round(r.at || 0), ok: r.ok, reqs: own.length, sprites: sprites.length,
      kb: Math.round(own.reduce((s, q) => s + q.enc, 0) / 1024), lastReqMs: Math.round(lastReq * 1000), blockMs: Math.round(lt.ms), longTasks: lt.n, longMax: lt.max, errors: [...new Set(errors)].slice(0, 4) };
    if (process.env.TIMELINE) out[pg.id].timeline = [...own].sort((a, b) => a.t - b.t).map((q) => [q.url.replace(BASE, '').slice(0, 70), Math.round((q.t - t0) * 1000), Math.round(((q.end ?? q.t) - t0) * 1000), Math.round(q.enc / 1024)]);
    process.stderr.write(`${pg.id}: fcp ${out[pg.id].fcp} content ${out[pg.id].contentMs} full ${out[pg.id].fullMs} ${r.ok ? '' : 'NOT-READY '}reqs ${own.length}(+${sprites.length} spr) ${out[pg.id].kb}KB last ${out[pg.id].lastReqMs} block ${out[pg.id].blockMs}/${lt.n} max ${lt.max} ${out[pg.id].errors.join('|')}\n`);
    await page.dispose();
  }
} finally { await close(); srv.close(); }
const f = arg('out'); if (f) fs.writeFileSync(f, JSON.stringify(out, null, 1));
