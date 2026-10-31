// "Front fin options" artboard: the 0.87.8 ship with different front fins rooted on the owner's line.
import fs from 'node:fs';
import path from 'node:path';
import { sideView, PARTS, ORDER } from './shipside.mjs';

const [root] = process.argv.slice(2);
const INK = '#0f1a2e';
const all = Object.fromEntries(ORDER.map((id) => [id, 1]));
const baseEngine = PARTS.engine;
// The 0.87.8 front fins and their highlight, taken out so each option can put its own in front of the hull.
const OLD_FRONT = [
  /<path d="M78 180 L62 214[^\n]*\n/,
  /<path d="M76 188 L66 210"[^\n]*\n/,
];
const mirror = (s) => `${s}<g transform="translate(200 0) scale(-1 1)">${s}</g>`;
// The root fairing: a steel strip on the hull's edge along the owner's line, bolted, so the fin is plainly fixed to the outside.
const fairing = (p, y0, y1) => `<rect x="73" y="${y0}" width="6" height="${y1 - y0}" rx="2.5" fill="url(#${p}steel)" stroke-width="1.6" />
<g fill="#3e4858" stroke="none">${[0.2, 0.5, 0.8].map((t) => `<circle cx="76" cy="${(y0 + (y1 - y0) * t).toFixed(1)}" r="1" />`).join('')}</g>`;
const fin = (d, hi) => (p) => `<path d="${d}" fill="url(#${p}navy)" stroke-width="2.2" /><path d="${hi}" stroke="#6f9ad8" stroke-width="1.4" stroke-linecap="round" fill="none" />`;

const OPTIONS = [
  { name: 'A · Swept delta', sub: 'A straight leading edge swept back from the top of your line to a sharp tip at the pad.', draw: fin('M77 174 L35 220 Q33 223 37 223 H52 L77 202 Z', 'M73 182 L41 217'), y: [172, 204] },
  { name: 'B · Clipped delta', sub: 'Swept back, with a square tip standing upright beside the booster, like a model rocket.', draw: fin('M77 174 L40 204 V222 H46 L77 202 Z', 'M72 180 L43 204'), y: [172, 204] },
  { name: 'C · Curved', sub: 'A curved leading edge that bellies out and sweeps down to the pad, wider at the foot.', draw: fin('M77 172 Q50 184 36 222 H60 L77 204 Z', 'M72 178 Q52 190 42 214'), y: [170, 206] },
  { name: 'D · Landing leg', sub: 'Juts straight out, then drops down to stand on the pad, like a retro rocket fin.', draw: fin('M77 176 Q58 178 42 192 Q36 198 34 210 L33 222 H44 L48 206 Q54 200 77 202 Z', 'M72 180 Q56 182 44 194'), y: [172, 206] },
];

const engineWith = (opt) => (p) => {
  const e = baseEngine(p);
  let art = e.art;
  for (const r of OLD_FRONT) art = art.replace(r, '');
  return { ...e, art, over: `<g stroke="${INK}" stroke-linejoin="round">${mirror(opt.draw(p) + fairing(p, ...opt.y))}</g>` };
};
const LINE = '<path d="M75.7 174 C76.3 177.8 75.2 180.7 74.7 184.5 C74 190.3 74.9 196.3 73.8 202" fill="none" stroke="#ff5a5a" stroke-width="1" stroke-dasharray="2 1.5" />';

const svg = (inner, w, vb) => {
  const [, , vw, vh] = vb.split(' ').map(Number);
  return `<svg viewBox="${vb}" width="${w}" height="${Math.round((w * vh) / vw)}" role="img">${inner}</svg>`;
};
const cards = OPTIONS.map((opt, k) => {
  PARTS.engine = engineWith(opt);
  const full = sideView(`f${k}`, all);
  const close = sideView(`c${k}`, all) + LINE;
  PARTS.engine = baseEngine;
  return `<div style="display: flex; flex-direction: column; gap: 8px; width: 300px">
<div style="background: #24324a; border-radius: 10px; padding: 8px; display: flex; justify-content: center">${svg(full, 284, '0 0 200 260')}</div>
<div style="background: #24324a; border-radius: 10px; padding: 8px; display: flex">${svg(close, 284, '24 150 152 82')}</div>
<div style="font-weight: 700; font-size: 17px; color: #ffffff">${opt.name}</div>
<div style="font-size: 13px; line-height: 1.45; color: #a9b6c9">${opt.sub}</div>
</div>`;
});
const nowFull = sideView('nf', all);
const nowClose = sideView('nc', all) + LINE;
const now = `<div style="display: flex; flex-direction: column; gap: 8px; width: 300px">
<div style="background: #1a2537; border-radius: 10px; padding: 8px; display: flex; justify-content: center">${svg(nowFull, 284, '0 0 200 260')}</div>
<div style="background: #1a2537; border-radius: 10px; padding: 8px; display: flex">${svg(nowClose, 284, '24 150 152 82')}</div>
<div style="font-weight: 700; font-size: 17px; color: #ffffff">Now · 0.87.8</div>
<div style="font-size: 13px; line-height: 1.45; color: #a9b6c9">Short front fins tucked behind the hull's edge.</div>
</div>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Front fin options</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&amp;display=swap" rel="stylesheet">
<style>body{margin:0}</style>
</helmet>
<div style="width: 1700px; min-height: 1000px; box-sizing: border-box; padding: 56px 64px; background: #121a28; color: #e6edf7; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 32px">
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #f2c14e; font-weight: 700">Ship side view · options, not in the game</div>
<h1 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-weight: 800; font-size: 40px; color: #ffffff">Front fin options</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #a9b6c9; max-width: 1100px">Each front fin is rooted on the line you drew down the hull's left edge (the dashed red line in the close-ups), held by a bolted steel fairing, and drawn in front of the booster. The right fin mirrors it. The back fins are unchanged, so these front fins now mostly hide them (they can be raised to peek out above if you want both pairs visible). Pick one, or mix: the tip of one with the edge of another.</p>
</div>
<div style="display: flex; gap: 24px; align-items: flex-start">${now}${cards.join('')}</div>
</div>
</x-dc>
</body>
</html>`;
fs.writeFileSync(path.join(root, 'project/FinOptions.dc.html'), html);
console.log('ok', html.length);
