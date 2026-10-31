import fs from 'node:fs';
import { sample, ORE } from './veins.mjs';
import { cell, DEFS, LOOKS } from './prev3.mjs';
const T = 64;
// Today's look, from the first board's code.
LOOKS.N = (g) => {
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
    s += `<use href="#nd${k}" x="${(x + 0.07) * T}" y="${(y + 0.07) * T}" transform="rotate(${((x * 7 + y * 13) % 4) * 90} ${(x + 0.5) * T} ${(y + 0.5) * T})" />`;
  }
  return s;
};
const OPTIONS = [
  ['N', 'Now', 'Each tile its own little pile of rocks on a shared bed of earth.'],
  ['K', 'E · Cracked bedrock (last round)', 'For reference: too cracked and veiny, and no crystals wanted.'],
  ['F', 'F · A few fine cracks', 'One smooth slab of bedrock for the whole patch, with a scattering of fine, broken cracks of ore through it: some joined, most short. No crystals.'],
  ['G', 'G · Long seams', 'The same slab with a few long seams of ore running across it, mostly one way, like layers in the rock, now and then turning. Thin parts of a patch carry a seam or none.'],
  ['H', 'H · Worn through', 'The same slab with no cracks of ore: here and there the rock is worn through and a patch of ore shows, with a few dark hairline cracks in the rock.'],
];
const rows = OPTIONS.map(([look, name, sub]) => `<div style="display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: baseline; gap: 14px"><div style="font-weight: 700; font-size: 20px; color: #ffffff; min-width: 340px">${name}</div><div style="font-size: 14px; color: #a9b6c9; max-width: 1060px">${sub}</div></div>
<div style="display: flex; gap: 12px">${[1, 2, 3, 4].map((k) => cell(look, k, 0.5)).join('')}</div></div>`);
// A closer look at iron in each new style, at about the size the game shows it.
const close = ['F', 'G', 'H'].map((look) => `<div style="display: flex; flex-direction: column; gap: 8px"><div style="font-weight: 700; font-size: 16px; color: #ffffff">${look} · iron, closer</div>${cell(look, 1, 0.64)}</div>`);
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
<div style="width: 1600px; min-height: 2200px; box-sizing: border-box; padding: 56px 64px; background: #121a28; color: #e6edf7; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 30px">
${DEFS}
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #f2c14e; font-weight: 700">Terrain · proposed, not in the game · round 3</div>
<h1 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-weight: 800; font-size: 40px; color: #ffffff">Ore patches as one vein</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #a9b6c9; max-width: 1300px">Three gentler takes on E's bedrock: one smooth slab of rock for the whole patch, with much less ore showing and no crystals. The game would draw either tile by tile, each tile looking at its neighbours, so it fits any patch and a mined-out tile simply leaves a gap. Samples for iron, copper, stone and sulfur: a round patch, a pair, a thin winding line and a single tile.</p>
</div>
${rows.join('\n')}
<div style="display: flex; gap: 24px">${close.join('')}</div>
</div>
</x-dc>
</body>
</html>`;
fs.writeFileSync(process.argv[2], html);
console.log('ok', html.length);
