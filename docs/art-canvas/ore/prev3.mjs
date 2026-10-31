import fs from 'node:fs';
import { sample } from './veins.mjs';
import { originalWithVein, crackedBedrock } from './veins3.mjs';
import { bedrock } from './veins4.mjs';
import { wornBedrock } from './veins5.mjs';
import { fissures, struck, pools, underneath } from './veins6.mjs';
import { crystals, tor, terraces, columns } from './veins7.mjs';
let torN = 0;
const repo = new URL('../../../src/art/terrain/', import.meta.url).pathname;
const uri = (p) => `data:image/svg+xml;base64,${fs.readFileSync(repo + p).toString('base64')}`;
const T = 64;
const defs = `<defs><pattern id="gr" width="64" height="64" patternUnits="userSpaceOnUse"><image href="${uri('ground.svg')}" width="64" height="64" /></pattern>${['iron', 'copper', 'stone', 'sulfur'].map((n, i) => `<image id="nd${i + 1}" href="${uri(`node_${n}.svg`)}" width="${0.86 * T}" height="${0.86 * T}" />`).join('')}</defs>`;
export const LOOKS = {
  V: (g) => originalWithVein(g, { across: 65, down: 30, width: 6, rock: 0.66 }),
  K: (g) => crackedBedrock(g, { crack: 0.06 }),
  F: (g) => bedrock(g, { step: 0.5, inside: true, cracks: true, along: 30, across: 30, width: 2.6 }),
  G: (g) => bedrock(g, { step: 1, offset: 0.5, cracks: true, along: 85, across: 15, width: 3.4 }),
  I: (g) => wornBedrock(g, { spots: 30, reach: 1.1, wide: 5.5, thin: 0.5, keep: 55, fade: 0.12 }),
  J: (g) => fissures(g, { spots: 30, r: 0.16, reach: 1.1, keep: 55, fade: 0.12 }),
  KS: (g) => struck(g, { spots: 30, r: 0.09, reach: 1.1, keep: 0, fade: 1 }),
  LP: (g) => pools(g, { snap: true, spots: 35, r: 0.12, reach: 1.4, keep: 0, fade: 0.1 }),
  M: (g) => underneath(g, { spots: 30, r: 0.12, reach: 1.1, keep: 55, fade: 0.12 }),
  CR: (g) => crystals(g),
  TO: (g) => tor(g, `t${torN++}_`),
  TE: (g) => terraces(g),
  CO: (g) => columns(g),
  H: (g) => bedrock(g, { step: 1, pockets: 70, hair: true }),
};
export function cell(look, k, scale = 1) {
  const g = sample(k);
  const W = g[0].length * T, H = g.length * T;
  return `<svg width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}" style="border-radius: 8px; display: block"><rect width="${W}" height="${H}" fill="url(#gr)" />${LOOKS[look](g)}</svg>`;
}
export const DEFS = `<svg width="0" height="0" style="position: absolute">${defs}</svg>`;
if (process.argv[1].endsWith('prev3.mjs') && process.argv[2]) {
  const look = process.argv[2];
  fs.writeFileSync(process.argv[3], `<body style="margin:0;background:#222;padding:8px">${DEFS}<div style="display:grid;grid-template-columns:repeat(2,704px);gap:8px">${[1, 2, 3, 4].map((k) => cell(look, k)).join('')}</div></body>`);
}
