// Retro Vault widget for Scriptable: paste this once into a new Scriptable script.
// It downloads the latest widget straight from the GitHub repo on every refresh (and keeps the last good copy for
// offline use), so the widget updates itself whenever the site does. Then add a Large Scriptable widget and pick it.

const SOURCES = [
  'https://raw.githubusercontent.com/sakisaki-dev/RetroVault/retrovault-v2/public/widgets/retro-vault-widget.js',
  'https://sakisaki-dev.github.io/RetroVault/widgets/retro-vault-widget.js',
];
const fm = FileManager.local();
const cached = fm.joinPath(fm.documentsDirectory(), 'retro-vault-widget-cache.js');
let code = null;
for (const url of SOURCES) {
  try {
    const r = new Request(url);
    r.timeoutInterval = 12;
    const text = await r.loadString();
    if (/^\s*</.test(text) || !text.includes('ListWidget')) continue; // an error page, not the widget
    code = text;
    fm.writeString(cached, code);
    break;
  } catch (e) {
    /* try the next source */
  }
}
if (!code && fm.fileExists(cached)) code = fm.readString(cached);
if (!code) {
  const w = new ListWidget();
  w.addText('Retro Vault: no connection yet');
  Script.setWidget(w);
  Script.complete();
} else {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(code)();
}
