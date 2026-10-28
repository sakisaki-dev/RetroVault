// Retro Vault widget for Scriptable: paste this once into a new Scriptable script.
// It downloads the latest widget from the public site on every refresh (and keeps the last copy for offline use),
// so the widget updates itself whenever the site does. Then add a Large Scriptable widget and pick this script.

const URL = 'https://sakisaki-dev.github.io/RetroVault/widgets/retro-vault-widget.js';
const fm = FileManager.local();
const cached = fm.joinPath(fm.documentsDirectory(), 'retro-vault-widget-cache.js');
let code = null;
try {
  const r = new Request(URL);
  r.timeoutInterval = 12;
  code = await r.loadString();
  if (!code.includes('ListWidget')) throw new Error('unexpected response');
  fm.writeString(cached, code);
} catch (e) {
  if (fm.fileExists(cached)) code = fm.readString(cached);
}
if (!code) {
  const w = new ListWidget();
  w.addText('Retro Vault: no connection yet');
  Script.setWidget(w);
  Script.complete();
} else {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(code)();
}
