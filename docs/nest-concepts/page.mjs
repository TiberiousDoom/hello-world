/* global console */
// Builds docs/nest-concepts/concepts.html: the concept sprites side by side, with the current nests to compare.
// Run after generate.mjs. Sprites are embedded as data: URIs so their gradient ids can't collide.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const uri = (path) => `data:image/svg+xml;base64,${readFileSync(path).toString('base64')}`;
const concept = (name) => uri(join(HERE, 'svg', `${name}.svg`));
const current = (name) => uri(join(HERE, '..', '..', 'src', 'art', 'nests', `${name}.svg`));

const DIRS = [
  {
    id: 'earthworks',
    name: 'A · Earthworks',
    pitch:
      'The nest digs outward. It starts as one hole in a low mound and becomes a dig site: side burrows joined by raised tunnel ridges, spoil heaps, egg clutches, and by stage 3 tunnels leaving the mound and scrap stolen from your factory.',
    stages: [
      'One burrow in a low mound, a few clods.',
      'A wider mound, a second burrow joined by a tunnel ridge, the first eggs.',
      'Five burrows, tunnels heading off the mound, spoil, scrap, two clutches.',
    ],
    kinds: 'Warrens: shed crawler husks. Hives: paper comb collars instead of soil rims. Dens: boulders, claw gouges, bones.',
    fit: 'Closest to today’s art, so the least risky. Reads well from above. Growth shows as more holes, which also hints “more bugs”.',
  },
  {
    id: 'brood',
    name: 'B · Brood',
    pitch:
      'The nest is alive. A single glossy egg pod becomes a cluster of pods with veins creeping into the ground, then a ribbed chitin dome with a glowing maw, ringed by egg sacs, its roots reaching the edge of the blight.',
    stages: ['One pod half sunk in turned soil, short veins.', 'A cluster of four pods round an open one, longer veins, eggs.', 'A shelled dome like a bug’s back, a ring of seven sacs, thick roots.'],
    kinds: 'Each kind takes its bugs’ colours: crawler orange, runner navy with wasp-yellow sacs, brute crimson with bone spikes.',
    fit: 'The most readable kind at a glance (colour) and the biggest change from stage to stage. Gives the veins a job later: they could pulse while angry. Moves the look away from “holes in the ground”.',
  },
  {
    id: 'spires',
    name: 'C · Spires',
    pitch:
      'The bugs build upward, like termite mounds. A lump with a hole becomes a chimney with a younger one beside it, then a cluster of towers round a tall central spire, each with vents and a long shadow.',
    stages: ['A low cone on a patch of dug soil.', 'A tall chimney with a smaller one behind, side vents.', 'Five towers round a spire half again as tall, scrap and eggs at the foot.'],
    kinds: 'Warrens: ribbed mud. Hives: banded grey paper with comb at the foot. Dens: stacked stone with red crust and bones.',
    fit: 'The most striking silhouette, and height makes a big nest feel dangerous from far off. But it is the only direction drawn with height, so it leans 3/4 where most of the game is straight down, and tall towers cover the tiles behind them.',
  },
];

const KINDS = [
  ['warren', 'Warren', 'crawlers, near the hub'],
  ['hive', 'Hive', 'runners and wasps, from 60 tiles'],
  ['den', 'Den', 'brutes and beetles, from 100 tiles'],
];

const img = (src, alt, cls = '') => `<img src="${src}" alt="${alt}" class="${cls}" loading="lazy" width="128" height="128">`;

const dirSection = (d) => `
<section class="dir" id="${d.id}" aria-labelledby="${d.id}-h">
  <header class="dir-head">
    <h2 id="${d.id}-h">${d.name}</h2>
    <p class="pitch">${d.pitch}</p>
  </header>
  <div class="dir-body">
    <div class="sheet">
      <div class="sheet-row sheet-cols" aria-hidden="true"><span></span><span>Stage 1</span><span>Stage 2</span><span>Stage 3</span></div>
      ${KINDS.map(
        ([k, label, note]) => `
      <div class="sheet-row">
        <div class="kind"><b>${label}</b><small>${note}</small></div>
        ${[1, 2, 3].map((s) => `<figure class="cell">${img(concept(`${d.id}_${k}_${s}`), `${d.name} ${label} stage ${s}`)}</figure>`).join('')}
      </div>`,
      ).join('')}
      <div class="sheet-row">
        <div class="kind"><b>Queen</b><small>stage 3 art with a royal chamber</small></div>
        <figure class="cell queen">${img(concept(`${d.id}_queen`), `${d.name} queen`)}</figure>
      </div>
    </div>
    <aside class="notes">
      <h3>Stage by stage</h3>
      <ol class="stages">${d.stages.map((s) => `<li>${s}</li>`).join('')}</ol>
      <h3>Kinds</h3>
      <p>${d.kinds}</p>
      <h3>How it would sit in the game</h3>
      <p>${d.fit}</p>
    </aside>
  </div>
</section>`;

// The field preview: one sprite per direction, on grass with blight, at the size the game would draw it.
const fieldData = JSON.stringify(Object.fromEntries(DIRS.map((d) => [d.id, Object.fromEntries(['warren', 'hive', 'den'].map((k) => [k, [1, 2, 3].map((s) => concept(`${d.id}_${k}_${s}`))]))])));
const currentData = JSON.stringify(Object.fromEntries(['warren', 'hive', 'den', 'grown'].map((k) => [k, current(k)])));

const html = `<title>Nest Growth Concepts</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bitter:wght@500;700;800&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Layout: a field-guide sheet. Hero with the live field preview, then one plate per direction (sprite grid + notes column). */
:root {
  --paper: #efe8d8; --panel: #e4dbc6; --ink: #2a2116; --muted: #6b5d48; --rule: #c8b998;
  --accent: #b4531a; --grass: #6f8f4a; --grass-dark: #5c7a3c; --chip: #f7f2e6;
  --display: 'Bitter', Georgia, serif; --body: 'Source Sans 3', system-ui, sans-serif; --mono: 'JetBrains Mono', ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #1c1813; --panel: #262019; --ink: #ece2cc; --muted: #ab9b80; --rule: #3e352a; --accent: #e08a3c; --chip: #2f281f; color-scheme: dark } }
:root[data-theme="dark"] { --paper: #1c1813; --panel: #262019; --ink: #ece2cc; --muted: #ab9b80; --rule: #3e352a; --accent: #e08a3c; --chip: #2f281f; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--paper); color: var(--ink); font: 16px/1.55 var(--body); }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 56px; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0 }
h1 { font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800; line-height: 1.05 }
h2 { font-size: 1.75rem; font-weight: 800 }
h3 { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-family: var(--body); font-weight: 600 }
p { margin: 0; max-width: 65ch }
.eyebrow { font: 600 .78rem var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--accent) }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 32px; align-items: start }
.hero-text { display: grid; gap: 16px }
.hero-text p { color: var(--muted) }
.hero-text p b { color: var(--ink) }
.field-card { display: grid; gap: 12px }
.field { width: 100%; aspect-ratio: 16 / 10; max-width: 100%; border-radius: 6px; display: block; border: 1px solid var(--rule) }
.controls { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center }
.seg { display: inline-flex; border: 1px solid var(--rule); border-radius: 999px; overflow: hidden; background: var(--chip) }
.seg button { font: 600 .85rem var(--body); color: var(--ink); background: none; border: 0; padding: 6px 12px; cursor: pointer }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--paper) }
.seg button:focus-visible, .play:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
.play { font: 600 .85rem var(--body); border: 1px solid var(--rule); background: var(--chip); color: var(--ink); border-radius: 999px; padding: 6px 14px; cursor: pointer }
.caption { font: .8rem var(--mono); color: var(--muted) }
.dir { display: grid; gap: 20px; border-top: 2px solid var(--ink); padding-top: 20px }
.dir-head { display: grid; gap: 8px }
.pitch { color: var(--muted) }
.dir-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 300px); gap: 32px; align-items: start }
.sheet { display: grid; gap: 4px; background: var(--grass); background-image: radial-gradient(circle at 20% 30%, var(--grass-dark) 0 2px, transparent 3px), radial-gradient(circle at 70% 80%, var(--grass-dark) 0 2px, transparent 3px); background-size: 46px 46px, 64px 64px; border-radius: 6px; padding: 12px; overflow-x: auto }
.sheet-row { display: grid; grid-template-columns: 120px repeat(3, minmax(96px, 1fr)); gap: 8px; align-items: center }
.sheet-cols span { font: 600 .72rem var(--mono); color: #f4f0e2; text-transform: uppercase; letter-spacing: .06em; text-align: center }
.kind { display: grid; color: #fbf7ea; text-shadow: 0 1px 2px rgba(0,0,0,.5) }
.kind b { font-family: var(--display); font-size: 1.05rem }
.kind small { font-size: .78rem; opacity: .9; line-height: 1.3 }
.cell { margin: 0; display: grid; place-items: center }
.cell img { width: 100%; max-width: 168px; height: auto; display: block }
.notes { display: grid; gap: 10px }
.notes p, .stages { font-size: .95rem }
.stages { margin: 0; padding-left: 1.2em; display: grid; gap: 4px }
.compare { display: grid; gap: 16px }
.compare-row { display: flex; flex-wrap: wrap; gap: 12px; background: var(--grass); border-radius: 6px; padding: 12px; }
.compare-row figure { margin: 0; display: grid; justify-items: center; gap: 4px; color: #fbf7ea; font: .78rem var(--mono) }
.compare-row img { width: 112px; height: auto }
.plan { display: grid; gap: 12px }
.plan ul { margin: 0; padding-left: 1.2em; display: grid; gap: 6px; max-width: 75ch }
code { font: .88em var(--mono); background: var(--chip); padding: 1px 5px; border-radius: 4px }
@media (max-width: 860px) {
  .hero, .dir-body { grid-template-columns: minmax(0, 1fr) }
  .sheet-row { grid-template-columns: 76px repeat(3, minmax(72px, 1fr)) }
  .kind small { display: none }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important } }
</style>

<main class="wrap">
  <section class="hero">
    <div class="hero-text">
      <span class="eyebrow">Foundry Front · art proposal · nests</span>
      <h1>Nests that grow, not just get bigger</h1>
      <p>Today a nest is one burrow sprite drawn <b>1.7, 2 or 2.3 tiles</b> across by stage, with an egg-clutch overlay added at stages 2 and 3. These three directions draw <b>each stage as its own picture</b>, so a stage 3 nest has new parts a stage 1 nest doesn’t.</p>
      <p>Each direction covers all three kinds and a queen. They are concepts drawn in code, to choose a direction from; the chosen one gets a proper polish pass before it goes in the game.</p>
      <p>Try the preview: it puts one nest on grass with its blight, at game scale, with the 2×2 tiles it blocks marked.</p>
    </div>
    <div class="field-card">
      <canvas class="field" id="field" width="800" height="500" aria-label="A nest on grass, at game scale"></canvas>
      <div class="controls">
        <div class="seg" role="group" aria-label="Direction" id="dirSeg">
          <button type="button" data-v="current" aria-pressed="false">Today</button>
          <button type="button" data-v="earthworks" aria-pressed="true">A</button>
          <button type="button" data-v="brood" aria-pressed="false">B</button>
          <button type="button" data-v="spires" aria-pressed="false">C</button>
        </div>
        <div class="seg" role="group" aria-label="Kind" id="kindSeg">
          <button type="button" data-v="warren" aria-pressed="true">Warren</button>
          <button type="button" data-v="hive" aria-pressed="false">Hive</button>
          <button type="button" data-v="den" aria-pressed="false">Den</button>
        </div>
        <div class="seg" role="group" aria-label="Stage" id="stageSeg">
          <button type="button" data-v="1" aria-pressed="true">1</button>
          <button type="button" data-v="2" aria-pressed="false">2</button>
          <button type="button" data-v="3" aria-pressed="false">3</button>
        </div>
        <button type="button" class="play" id="play">Grow ▸</button>
      </div>
      <span class="caption" id="cap"></span>
    </div>
  </section>

  <section class="compare" aria-labelledby="today-h">
    <h3 id="today-h">Today’s nests, for comparison</h3>
    <div class="compare-row">
      <figure><img src="${current('warren')}" alt="Current warren"><figcaption>warren</figcaption></figure>
      <figure><img src="${current('hive')}" alt="Current hive"><figcaption>hive</figcaption></figure>
      <figure><img src="${current('den')}" alt="Current den"><figcaption>den</figcaption></figure>
      <figure><img src="${current('queen')}" alt="Current queen"><figcaption>queen</figcaption></figure>
      <figure><img src="${current('grown')}" alt="Current grown overlay"><figcaption>grown overlay</figcaption></figure>
    </div>
  </section>

  ${DIRS.map(dirSection).join('')}

  <section class="plan dir" aria-labelledby="plan-h">
    <h2 id="plan-h">What it takes to put one in</h2>
    <ul>
      <li><b>Sprites:</b> 9 per direction (<code>nests/warren_1</code> to <code>nests/den_3</code>) plus <code>nests/queen</code>. Hardcore gets a darker take on each stage instead of one <code>nests/hardcore</code> sprite.</li>
      <li><b>Size:</b> every stage drawn in the same 4-tile box (the Hardcore cover ring is 4×4 too), and the art itself grows: about 1.6 tiles across at stage 1, 2.5 at stage 2, 3.4 at stage 3. The blocked 2×2 tiles don’t change.</li>
      <li><b>Merged nests:</b> stage 3 art at 1.3× as now; for A and B, a tunnel or vein drawn in code towards each other cell the nest owns.</li>
      <li><b>Kept as they are:</b> the angry eyes, damaged rim and destroyed overlays, the health bar and the blight.</li>
      <li><b>Optional, later:</b> a short crossfade when a nest moves up a stage, and for B, veins that pulse while angry.</li>
      <li><b>Code:</b> one change in <code>Renderer.drawNest</code> (pick the sprite by stage, drop the <code>nests/grown</code> overlay), <code>TILES</code> in <code>art/index.ts</code>, <code>ART_LIST.md</code>, and a decision row. No change to the rules or saves.</li>
    </ul>
  </section>
</main>

<script>
const ART = ${fieldData};
const NOW = ${currentData};
const state = { dir: 'earthworks', kind: 'warren', stage: 1 };
const cache = new Map();
function load(src) {
  if (!cache.has(src)) cache.set(src, new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
  return cache.get(src);
}
const cv = document.getElementById('field');
const ctx = cv.getContext('2d');
const T = 40; // pixels per tile in the preview
let fade = null;

/** Grass, a few tufts, the blight, the 2×2 blocked tiles, then the nest. */
async function draw(alpha = 1, prev = null) {
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
  ctx.fillStyle = '#6f8f4a'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
  for (let x = cx % T; x < W; x += T) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = cy % T; y < H; y += T) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  ctx.fillStyle = '#5c7a3c';
  for (let i = 0; i < 160; i++) { ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 1.5 + rnd() * 1.5, 0, 6.3); ctx.fill(); }
  const r = 5.5 * T, g = ctx.createRadialGradient(cx, cy, 0.8 * T, cx, cy, r);
  g.addColorStop(0, 'rgba(110,90,52,0.75)'); g.addColorStop(0.5, 'rgba(138,122,66,0.45)'); g.addColorStop(1, 'rgba(122,122,64,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  const paint = async (st, a) => {
    if (state.dir === 'current') {
      const size = 2 * (0.7 + 0.15 * st) * T;
      const base = await load(NOW[state.kind]); const grown = await load(NOW.grown);
      ctx.globalAlpha = a;
      if (base) ctx.drawImage(base, cx - size / 2, cy - size / 2, size, size);
      if (grown && st >= 2) ctx.drawImage(grown, cx - size / 2, cy - size / 2, size, size);
      if (grown && st >= 3) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI); ctx.drawImage(grown, -size / 2, -size / 2, size, size); ctx.restore(); }
    } else {
      const im = await load(ART[state.dir][state.kind][st - 1]); const size = 4 * T;
      ctx.globalAlpha = a;
      if (im) ctx.drawImage(im, cx - size / 2, cy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  };
  if (prev) await paint(prev, 1 - alpha);
  await paint(state.stage, alpha);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - T, cy - T, 2 * T, 2 * T); ctx.setLineDash([]);
  const name = state.dir === 'current' ? 'Today' : { earthworks: 'A · Earthworks', brood: 'B · Brood', spires: 'C · Spires' }[state.dir];
  document.getElementById('cap').textContent = name + ' · ' + state.kind + ' · stage ' + state.stage + '  (dashed square: the 2×2 tiles it blocks)';
}

function setStage(st, animate) {
  const prev = state.stage; state.stage = st; sync();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reduced || prev === st) return draw();
  const t0 = performance.now(); const id = (fade = {});
  const step = (t) => { if (fade !== id) return; const a = Math.min(1, (t - t0) / 600); draw(a, prev); if (a < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function sync() {
  for (const [segId, key] of [['dirSeg', 'dir'], ['kindSeg', 'kind'], ['stageSeg', 'stage']])
    for (const b of document.getElementById(segId).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === String(state[key])));
}
for (const [segId, key] of [['dirSeg', 'dir'], ['kindSeg', 'kind']])
  document.getElementById(segId).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state[key] = b.dataset.v; fade = null; sync(); draw(); });
document.getElementById('stageSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setStage(+b.dataset.v, true); });
let timer = null;
document.getElementById('play').addEventListener('click', () => {
  clearInterval(timer); setStage(1, false);
  let st = 1; timer = setInterval(() => { st++; setStage(st, true); if (st >= 3) clearInterval(timer); }, 1200);
});
sync(); draw();
</script>
`;

writeFileSync(join(HERE, 'concepts.html'), html);
console.log('Wrote concepts.html');
