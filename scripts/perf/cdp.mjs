// Minimal Chrome DevTools Protocol driver (no dependencies): chrome-headless-shell from Playwright's cache (or CHROME_BIN),
// Node 22+'s global WebSocket. Used by measure.mjs.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const findChrome = () => {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const base = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse() : [];
  for (const d of dirs) {
    for (const arch of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux']) {
      const p = path.join(base, d, arch, 'chrome-headless-shell');
      if (fs.existsSync(p)) return p;
    }
  }
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
};

export const launch = async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-perf-'));
  const bin = findChrome();
  const args = ['--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--disable-extensions',
    '--window-size=1280,900', '--hide-scrollbars', '--mute-audio', '--enable-precise-memory-info', '--js-flags=--expose-gc'];
  if (!bin.includes('headless-shell')) args.push('--headless=new');
  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const ws = await new Promise((resolve, reject) => {
    let buf = '';
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    proc.on('exit', () => reject(new Error('chrome exited')));
    setTimeout(() => reject(new Error('chrome start timeout')), 20000);
  });
  const browser = await connect(ws);
  const close = async () => { try { await browser.send('Browser.close'); } catch { /* gone */ } proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { browser, close };
};

export const connect = (url) =>
  new Promise((resolve, reject) => {
    const sock = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const handlers = new Map(); // `${sessionId}:${method}` -> Set<fn>
    const any = new Set();
    sock.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id) {
        const p = pending.get(m.id);
        if (p) { pending.delete(m.id); m.error ? p.reject(new Error(`${m.error.message} (${p.method})`)) : p.resolve(m.result); }
      } else if (m.method) {
        for (const fn of any) fn(m);
        const hs = handlers.get(`${m.sessionId || ''}:${m.method}`);
        if (hs) hs.forEach((fn) => fn(m.params));
      }
    };
    sock.onerror = reject;
    sock.onopen = () => {
      const make = (sessionId) => ({
        send: (method, params = {}) => new Promise((res, rej) => {
          const i = ++id;
          pending.set(i, { resolve: res, reject: rej, method });
          sock.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
        }),
        on: (method, fn) => {
          const k = `${sessionId || ''}:${method}`;
          if (!handlers.has(k)) handlers.set(k, new Set());
          handlers.get(k).add(fn);
        },
        off: (method, fn) => handlers.get(`${sessionId || ''}:${method}`)?.delete(fn),
        sessionId,
      });
      const root = make(null);
      root.session = make;
      resolve(root);
    };
  });

/** A fresh incognito-like context with one page, its own storage and cache. */
export const newPage = async (browser) => {
  const { browserContextId } = await browser.send('Target.createBrowserContext');
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const page = browser.session(sessionId);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Network.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  page.evaluate = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  page.dispose = async () => { try { await browser.send('Target.disposeBrowserContext', { browserContextId }); } catch { /* ignore */ } };
  return page;
};
