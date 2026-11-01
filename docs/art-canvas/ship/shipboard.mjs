// The "Ship side view" artboard for the art canvas.
import fs from 'node:fs';
import path from 'node:path';
import { sideView, PARTS, ORDER, NAMES, STAGES, defs } from './shipside.mjs';

const [repo, root] = process.argv.slice(2);
// The game's current side view, for comparison: its PARTS, taken from shipview.ts as they stand.
const src = (await import('node:child_process')).execSync(`git -C ${repo} show 093c494:src/ui/shipview.ts`).toString();
const old = {};
// The placeholder as it was before 0.87.8, from git.

for (const m of src.matchAll(/(\w+): \{\s*fill: '([^']+)',\s*shapes:\s*((?:'[^']*'\s*\+?\s*)+)/g)) old[m[1]] = { fill: m[2], shapes: [...m[3].matchAll(/'([^']*)'/g)].map((x) => x[1]).join('') };
const oldView = ['pad', 'scaffold', 'engine', 'hull', 'life', 'nav']
  .map((id) => `<g fill="${old[id].fill}" stroke="${id === 'scaffold' ? old[id].fill : '#0f1a2e'}" stroke-width="2">${old[id].shapes}</g>`)
  .join('');
const oldSvg = `<rect x="0" y="240" width="200" height="20" fill="#3a2a1c"/><path d="M0 240 H200" stroke="#6b4423" stroke-width="2"/>${oldView}`;

const AGE = { scaffold: 'Wood Age', pad: 'Iron Age', hull: 'Steam Age', engine: 'Electric Age', life: 'Electric Age', nav: 'Electric Age' };
const all = Object.fromEntries(ORDER.map((id) => [id, 1]));
const svg = (inner, w, label, vb = '0 0 200 260') => {
  const [, , vw, vh] = vb.split(' ').map(Number);
  return `<svg viewBox="${vb}" width="${w}" height="${Math.round((w * vh) / vw)}" role="img" aria-label="${label}">${inner}</svg>`;
};
const frame = (inner, caption, sub, bg = '#24324a', capW = 260) => `<div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start">
<div style="background: ${bg}; border-radius: 10px; padding: 8px; display: flex">${inner}</div>
<div style="font-weight: 700; font-size: 15px; color: #ffffff">${caption}</div>
<div style="font-size: 13px; line-height: 1.4; color: #a9b6c9; max-width: ${capW}px">${sub}</div>
</div>`;

// The build, in the game's stage order: each frame has the stages so far built and the next one half done.
const build = STAGES.map((id, k) => {
  const progress = {};
  STAGES.forEach((s, j) => (progress[s] = j < k ? 1 : j === k ? 0.5 : 0));
  return frame(svg(sideView(`b${k}`, progress), 176, `${NAMES[id]} under way`), `${k + 1} · ${NAMES[id]}`, `${AGE[id]}. Built stages solid, this one filling in, the rest dashed.`, '#24324a', 192);
});
const parts = STAGES.map((id, k) => frame(svg(defs(`q${k}`) + (PARTS[id](`q${k}`).art + (PARTS[id](`q${k}`).over ?? '')), 176, NAMES[id]), NAMES[id], AGE[id], '#24324a', 192));

const W = 1440;
const H = Number(process.env.H || 2180);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ship side view</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&amp;display=swap" rel="stylesheet">
<style>
body{margin:0}
a{color:#7cc4ff}a:hover{color:#bfe4ff}
</style>
</helmet>
<div style="width: ${W}px; min-height: ${H}px; box-sizing: border-box; padding: 56px 64px; background: #121a28; color: #e6edf7; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 40px">
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #f2c14e; font-weight: 700">Ship and shipyard · in the game from 0.87.8</div>
<h1 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-weight: 800; font-size: 40px; color: #ffffff">The ship from the side</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #a9b6c9; max-width: 1040px">What the shipyard's Side view window shows, as in the game since 0.87.8 (src/ui/shipview.ts). Drawn in the game's side-view box (200 × 260, ground at 240) and its stage order. Each part also has a plain silhouette for the dashed outline of a stage not yet built. A white steel rocket with navy bands, matching the ship seen from above on the map.</p>
</div>

<div style="display: flex; gap: 40px; align-items: flex-start">
${frame(svg(sideView('full', all), 420, 'The finished ship on its pad, in its scaffolding'), 'Ready to launch', 'Every stage built: scaffolding, launch pad, engine, hull, life support and navigation.')}
${frame(svg(sideView('lift', all, { liftoff: true }), 420, 'The ship lifting off on its flames', '0 -50 200 310'), 'Lift-off', 'For the launch: the ship rises off the pad on three flames, smoke rolling out over the ground. The pad and scaffolding stay.')}
${frame(svg(oldSvg, 260, 'The side view in the game now'), 'Before 0.87.8', 'The placeholder shapes it replaced.', '#1a2537')}
</div>

<div style="display: flex; flex-direction: column; gap: 14px">
<h2 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-size: 22px; color: #ffffff">Built stage by stage</h2>
<div style="display: flex; gap: 16px; flex-wrap: wrap">${build.join('\n')}</div>
</div>

<div style="display: flex; flex-direction: column; gap: 14px">
<h2 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-size: 22px; color: #ffffff">The parts</h2>
<div style="display: flex; gap: 16px; flex-wrap: wrap">${parts.join('\n')}</div>
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${W},"height":${H}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;
if (html.includes('{{')) throw new Error('holds {{');
fs.writeFileSync(path.join(root, 'project', 'ShipSideView.dc.html'), html);
// A preview page for checking it here.
fs.writeFileSync(path.join(root, '..', 'shipboard-preview.html'), html.replace('<script src="./support.js"></script>', '').replace(/<\/?x-dc>|<\/?helmet>/g, ''));
console.log('ok', Object.keys(old).length, html.length);
