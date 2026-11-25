// Attributes a built chunk's bytes to source modules via its hidden source map: node scripts/perf/bundle_attr.mjs dist/assets/index-XXXX.js [topN]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { SourceMapConsumer } = require('source-map-js');
const file = process.argv[2];
const code = fs.readFileSync(file, 'utf8');
const map = new SourceMapConsumer(JSON.parse(fs.readFileSync(file + '.map', 'utf8')));
const lines = code.split('\n');
const sizes = {};
let prev = null;
const segs = [];
map.eachMapping((m) => segs.push(m));
segs.sort((a, b) => a.generatedLine - b.generatedLine || a.generatedColumn - b.generatedColumn);
for (let i = 0; i < segs.length; i++) {
  const m = segs[i], n = segs[i + 1];
  const len = n && n.generatedLine === m.generatedLine ? n.generatedColumn - m.generatedColumn : (lines[m.generatedLine - 1] || '').length - m.generatedColumn;
  let s = (m.source || '?').replace(/^(\.\.\/)+/, '');
  const nm = s.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  s = nm ? 'nm:' + nm[1] : s;
  sizes[s] = (sizes[s] || 0) + len;
}
const top = Number(process.argv[3] || 40);
Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, top).forEach(([k, v]) => console.log(String(v).padStart(8), k));
console.log('total', Object.values(sizes).reduce((a, b) => a + b, 0));
