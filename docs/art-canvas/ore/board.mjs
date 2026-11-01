import fs from 'node:fs';
import { sample, hash, ORE } from './veins.mjs';
import { patchSvg } from './veins2.mjs';
const repo = new URL('../../../src/art/terrain/', import.meta.url).pathname;
const uri = (p) => `data:image/svg+xml;base64,${fs.readFileSync(repo + p).toString('base64')}`;
const sprites = { 1: uri('node_iron.svg'), 2: uri('node_copper.svg'), 3: uri('node_stone.svg'), 4: uri('node_sulfur.svg') };
const ground = uri('ground.svg');
const T = 64;
// Each sprite once, as a symbol, so the board stays small.
const defs = `<defs><pattern id="gr" width="64" height="64" patternUnits="userSpaceOnUse"><image href="${ground}" width="64" height="64" /></pattern>${[1, 2, 3, 4].map((k) => `<image id="nd${k}" href="${sprites[k]}" width="${0.86 * T}" height="${0.86 * T}" />`).join('')}</defs>`;
const symbolSprites = { 1: '#nd1', 2: '#nd2', 3: '#nd3', 4: '#nd4' };
// The patch as the game draws it now: a bed of earth, and each tile's rocks turned a quarter at a time.
function now(g) {
  let s = '';
  const H = g.length, W = g[0].length;
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? g[y][x] : 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = g[y][x]; if (!k) continue;
    const m = 0.1; const [l, r, t, b] = [at(x - 1, y) === k ? 0 : m, at(x + 1, y) === k ? 0 : m, at(x, y - 1) === k ? 0 : m, at(x, y + 1) === k ? 0 : m];
    s += `<rect x="${(x + l) * T}" y="${(y + t) * T}" width="${(1 - l - r) * T}" height="${(1 - t - b) * T}" rx="${(Math.min(l, r, t, b) ? 0.25 : 0.12) * T}" fill="${ORE[k].bed}" />`;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = g[y][x]; if (!k) continue;
    const turn = ((x * 7 + y * 13) % 4) * 90;
    s += `<use href="#nd${k}" x="${(x + 0.07) * T}" y="${(y + 0.07) * T}" transform="rotate(${turn} ${(x + 0.5) * T} ${(y + 0.5) * T})" />`;
  }
  return s;
}
// patchSvg puts a data-URI image per lone tile; use the symbol instead.
const fix = (s) => s.replace(/<image href="data:[^"]+" x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="[\d.]+" \/>/g, (m, x, y) => m);
const OPTIONS = [
  ['Now', 'Each tile its own little pile of rocks on a shared bed of earth.', null],
  ['A · Thin veins', 'The patch is one outcrop of rock, lumpy where it ends. Thin veins of ore wind through it, carrying on from tile to tile.', { across: 65, down: 30, width: 6 }],
  ['B · Bold vein with nuggets', 'The same outcrop, with a bolder vein and a nugget of ore here and there where it bends.', { across: 60, down: 25, width: 9, nuggets: true }],
  ['C · Vein of ore chunks', 'The vein is a chain of faceted chunks of ore set in the rock, so it reads as ore rather than a line.', { across: 60, down: 25, width: 11, chunks: true }],
];
const scale = 0.5;
const rows = OPTIONS.map(([name, sub, style]) => {
  const cells = [1, 2, 3, 4].map((k) => {
    const g = sample(k);
    const W = g[0].length * T, H = g.length * T;
    let inner = style ? patchSvg(g, style, { 1: 'X1', 2: 'X2', 3: 'X3', 4: 'X4' }) : now(g);
    inner = inner.replace(/<image href="X(\d)" x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="[\d.]+" \/>/g, '<use href="#nd$1" x="$2" y="$3" />');
    return `<svg width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}" style="border-radius: 8px; display: block"><rect width="${W}" height="${H}" fill="url(#gr)" />${inner}</svg>`;
  });
  return `<div style="display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: baseline; gap: 14px"><div style="font-weight: 700; font-size: 20px; color: #ffffff; min-width: 260px">${name}</div><div style="font-size: 14px; color: #a9b6c9">${sub}</div></div>
<div style="display: flex; gap: 12px">${cells.join('')}</div></div>`;
});
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ore veins</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&amp;display=swap" rel="stylesheet">
<style>body{margin:0}</style>
</helmet>
<div style="width: 1600px; min-height: 1500px; box-sizing: border-box; padding: 56px 64px; background: #121a28; color: #e6edf7; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 30px">
<svg width="0" height="0" style="position: absolute">${defs}</svg>
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #f2c14e; font-weight: 700">Terrain · proposed, not in the game</div>
<h1 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-weight: 800; font-size: 40px; color: #ffffff">Ore patches as one vein</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #a9b6c9; max-width: 1300px">Where ore tiles touch, the patch becomes one outcrop of rock with a vein of ore running through it, instead of a pile of rocks per tile. A tile on its own keeps today's rocks (far right of each sample). The game would draw it tile by tile, each tile looking at its neighbours, so it fits any patch shape and a mined-out tile simply opens a gap. Shown on the same samples for iron, copper, stone and sulfur: a round patch, a pair, a thin winding line and a single tile.</p>
</div>
${rows.join('\n')}
</div>
</x-dc>
</body>
</html>`;
fs.writeFileSync(process.argv[2], html);
console.log('ok', html.length);
