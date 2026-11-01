import fs from 'node:fs';
import { sample } from './veins.mjs';
import { patchSvg } from './veins2.mjs';
const repo = new URL('../../../src/art/terrain/', import.meta.url).pathname;
const uri = (p) => `data:image/svg+xml;base64,${fs.readFileSync(repo + p).toString('base64')}`;
const sprites = { 1: uri('node_iron.svg'), 2: uri('node_copper.svg'), 3: uri('node_stone.svg'), 4: uri('node_sulfur.svg') };
const ground = uri('ground.svg');
const STYLES = {
  A: { across: 65, down: 30, width: 6 },
  D: { across: 60, down: 25, width: 9, chunks: true },
  C: { across: 60, down: 25, width: 9, nuggets: true },
  B: { slab: false, margin: 0.12, across: 85, down: 35, width: 12 },
};
const which = process.argv[2] || 'A';
let html = '<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(2,704px);gap:8px;padding:8px">';
for (const k of [1, 2, 3, 4]) {
  const g = sample(k);
  const W = g[0].length * 64, H = g.length * 64;
  html += `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><pattern id="gr${k}" width="64" height="64" patternUnits="userSpaceOnUse"><image href="${ground}" width="64" height="64" /></pattern></defs><rect width="${W}" height="${H}" fill="url(#gr${k})" />${patchSvg(g, STYLES[which], sprites)}</svg>`;
}
fs.writeFileSync(process.argv[3], html);
