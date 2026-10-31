/* global console */
// Builds docs/nest-concepts/concepts.html: the Earthworks nests for every kind and stage, queen nests and
// queen bugs, with today's nests to compare. Run after generate.mjs. Sprites are embedded as data: URIs so
// their gradient ids can't collide.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const uri = (path) => `data:image/svg+xml;base64,${readFileSync(path).toString('base64')}`;
const concept = (name) => uri(join(HERE, 'svg', `${name}.svg`));
const current = (name) => uri(join(HERE, '..', '..', 'src', 'art', 'nests', `${name}.svg`));
const bugArt = (name) => uri(join(HERE, '..', '..', 'src', 'art', 'enemies', `${name}.svg`));

const KINDS = [
  {
    id: 'warren',
    name: 'Warren',
    bug: 'crawler',
    bugName: 'Crawler',
    where: 'Near the hub',
    status: 'today',
    signs: 'Soft soil, burrows with winding tunnels between them, shed orange crawler husks. The queen nest is ringed with husks.',
  },
  {
    id: 'runnel',
    name: 'Runnel',
    bug: 'runner',
    bugName: 'Runner',
    where: 'From 60 tiles',
    status: 'new',
    signs: 'Darker, stony soil. Long straight trenches run out from the mound, more at each stage, for fast bugs. Tunnels on the mound are straight too. Shed navy segments lie in rows.',
  },
  {
    id: 'hive',
    name: 'Hive',
    bug: 'wasp',
    bugName: 'Wasp',
    where: 'From 80 tiles',
    status: 'changes',
    signs: 'Grey paper comb in place of soil rims, with yellow grubs in the cells. The comb spreads across the mound as it grows; the queen’s chamber sits in a wide ring of it.',
  },
  {
    id: 'den',
    name: 'Den',
    bug: 'brute',
    bugName: 'Brute',
    where: 'From 100 tiles',
    status: 'changes',
    signs: 'Boulders round the rim from stage 2, claw gouges, bones by stage 3. The queen nest has more boulders and bones.',
  },
  {
    id: 'barrow',
    name: 'Barrow',
    bug: 'beetle',
    bugName: 'Beetle',
    where: 'From 120 tiles',
    status: 'new',
    signs: 'Reddish clay. Beetles roll balls of packed earth: one at stage 1, more after, and the side burrows are half plugged with them. Shed blue wing cases lie about.',
  },
];

const STATUS = { today: 'As today', changes: 'Today’s kind, new focus', new: 'New kind' };

const img = (src, alt, w = 128) => `<img src="${src}" alt="${alt}" loading="lazy" width="${w}" height="${w}">`;

const kindRow = (k) => `
  <article class="kind-row" id="${k.id}" aria-labelledby="${k.id}-h">
    <header class="kind-head">
      <img class="bug-icon" src="${bugArt(k.bug)}" alt="" width="48" height="48">
      <div>
        <h3 id="${k.id}-h">${k.name} <span class="pill pill-${k.status}">${STATUS[k.status]}</span></h3>
        <p class="meta">${k.bugName}s · ${k.where}</p>
      </div>
    </header>
    <div class="strip">
      ${[1, 2, 3].map((s) => `<figure>${img(concept(`nest_${k.id}_${s}`), `${k.name} stage ${s}`)}<figcaption>Stage ${s}</figcaption></figure>`).join('')}
      <figure class="royal">${img(concept(`nest_${k.id}_queen`), `${k.name} queen nest`)}<figcaption>Queen nest</figcaption></figure>
      <figure class="royal">${img(concept(`queen_${k.bug}`), `${k.bugName} queen`, 96)}<figcaption>${k.bugName} queen</figcaption></figure>
    </div>
    <p class="signs">${k.signs}</p>
  </article>`;

const fieldData = JSON.stringify(Object.fromEntries(KINDS.map((k) => [k.id, [1, 2, 3, 'queen'].map((s) => concept(`nest_${k.id}_${s}`))])));
const queenData = JSON.stringify(Object.fromEntries(KINDS.map((k) => [k.id, concept(`queen_${k.bug}`)])));
const workerData = JSON.stringify(Object.fromEntries(KINDS.map((k) => [k.id, bugArt(k.bug)])));
// Today's art for each new kind: the sprite of the kind that holds those bugs now.
const currentData = JSON.stringify({
  warren: current('warren'),
  runnel: current('hive'),
  hive: current('hive'),
  den: current('den'),
  barrow: current('den'),
  queen: current('queen'),
  grown: current('grown'),
});

const html = `<title>Nest Growth Concepts</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bitter:wght@500;700;800&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Layout: a field-guide sheet. Hero with the live field preview, then one strip per nest kind, then the open questions. */
:root {
  --paper: #efe8d8; --panel: #e4dbc6; --ink: #2a2116; --muted: #6b5d48; --rule: #c8b998;
  --accent: #b4531a; --grass: #6f8f4a; --grass-dark: #5c7a3c; --chip: #f7f2e6; --new: #2f6b3a; --gold: #8a5a10;
  --display: 'Bitter', Georgia, serif; --body: 'Source Sans 3', system-ui, sans-serif; --mono: 'JetBrains Mono', ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #1c1813; --panel: #262019; --ink: #ece2cc; --muted: #ab9b80; --rule: #3e352a; --accent: #e08a3c; --chip: #2f281f; --new: #8fd09a; --gold: #f2c14e; color-scheme: dark } }
:root[data-theme="dark"] { --paper: #1c1813; --panel: #262019; --ink: #ece2cc; --muted: #ab9b80; --rule: #3e352a; --accent: #e08a3c; --chip: #2f281f; --new: #8fd09a; --gold: #f2c14e; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--paper); color: var(--ink); font: 16px/1.55 var(--body); }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 48px; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0 }
h1 { font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800; line-height: 1.05 }
h2 { font-size: 1.75rem; font-weight: 800 }
h3 { font-size: 1.3rem; font-weight: 800; display: flex; flex-wrap: wrap; gap: 8px; align-items: center }
p { margin: 0; max-width: 65ch }
.eyebrow { font: 600 .78rem var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--accent) }
.label { font: 600 .78rem var(--body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted) }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 32px; align-items: start }
.hero-text { display: grid; gap: 16px }
.hero-text p { color: var(--muted) }
.hero-text p b { color: var(--ink) }
.field-card { display: grid; gap: 12px }
.field { width: 100%; aspect-ratio: 16 / 10; max-width: 100%; border-radius: 6px; display: block; border: 1px solid var(--rule) }
.controls { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center }
.seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--rule); border-radius: 18px; overflow: hidden; background: var(--chip) }
.seg button { font: 600 .85rem var(--body); color: var(--ink); background: none; border: 0; padding: 6px 11px; cursor: pointer }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--paper) }
.seg button:focus-visible, .play:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
.play { font: 600 .85rem var(--body); border: 1px solid var(--rule); background: var(--chip); color: var(--ink); border-radius: 999px; padding: 6px 14px; cursor: pointer }
.caption { font: .8rem var(--mono); color: var(--muted) }
.section { display: grid; gap: 20px; border-top: 2px solid var(--ink); padding-top: 20px }
.section > p { color: var(--muted) }
.kinds { display: grid; gap: 28px }
.kind-row { display: grid; gap: 10px }
.kind-head { display: flex; gap: 12px; align-items: center }
.bug-icon { width: 48px; height: 48px; background: var(--grass); border-radius: 50%; padding: 2px }
.meta { font: .85rem var(--mono); color: var(--muted) }
.pill { font: 600 .7rem var(--body); letter-spacing: .06em; text-transform: uppercase; border: 1px solid currentColor; border-radius: 999px; padding: 1px 8px }
.pill-today { color: var(--muted) }
.pill-changes { color: var(--accent) }
.pill-new { color: var(--new) }
.strip { display: grid; grid-template-columns: repeat(5, minmax(96px, 1fr)); gap: 8px; background: var(--grass); background-image: radial-gradient(circle at 20% 30%, var(--grass-dark) 0 2px, transparent 3px), radial-gradient(circle at 70% 80%, var(--grass-dark) 0 2px, transparent 3px); background-size: 46px 46px, 64px 64px; border-radius: 6px; padding: 12px; overflow-x: auto }
.strip figure { margin: 0; display: grid; justify-items: center; align-content: end; gap: 4px }
.strip img { width: 100%; max-width: 170px; height: auto; display: block }
.strip figcaption { font: 600 .72rem var(--mono); color: #fbf7ea; text-transform: uppercase; letter-spacing: .05em; text-shadow: 0 1px 2px rgba(0,0,0,.5) }
.strip .royal figcaption { color: #ffe08a }
.strip .royal:first-of-type { border-left: 1px dashed rgba(255,255,255,.35); padding-left: 8px }
.signs { font-size: .95rem }
.compare-row { display: flex; flex-wrap: wrap; gap: 12px; background: var(--grass); border-radius: 6px; padding: 12px; }
.compare-row figure { margin: 0; display: grid; justify-items: center; gap: 4px; color: #fbf7ea; font: .78rem var(--mono) }
.compare-row img { width: 104px; height: auto }
.qs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px }
.q { border: 1px solid var(--rule); border-radius: 6px; padding: 14px 16px; display: grid; gap: 6px; align-content: start; background: var(--chip) }
.q b { font-family: var(--display) }
.q p { font-size: .95rem }
.q .rec { color: var(--muted); font-size: .88rem }
.plan ul { margin: 0; padding-left: 1.2em; display: grid; gap: 6px; max-width: 75ch }
code { font: .88em var(--mono); background: var(--chip); padding: 1px 5px; border-radius: 4px }
@media (max-width: 860px) {
  .hero { grid-template-columns: minmax(0, 1fr) }
  .strip { grid-template-columns: repeat(5, minmax(84px, 1fr)) }
}
</style>

<main class="wrap">
  <section class="hero">
    <div class="hero-text">
      <span class="eyebrow">Foundry Front · nest art · round 2 · Earthworks</span>
      <h1>A nest for every bug, and a queen for each</h1>
      <p>You picked <b>Earthworks</b>: the nest digs outward as it grows. Each stage is its own drawing: <b>one burrow</b> at stage 1, a <b>side burrow joined by a tunnel</b> at stage 2, a <b>dig site</b> with five burrows and tunnels leaving the mound at stage 3.</p>
      <p>This round adds <b>runnels</b> for runners and <b>barrows</b> for beetles, so each of the five bugs has its own nest. Each kind has a <b>queen nest</b>, and each bug has a <b>queen</b>.</p>
      <p>Try the preview: it shows one nest at game scale with its blight. The dashed square marks the 2×2 tiles it blocks.</p>
    </div>
    <div class="field-card">
      <canvas class="field" id="field" width="800" height="500" aria-label="A nest on grass, at game scale"></canvas>
      <div class="controls">
        <div class="seg" role="group" aria-label="Kind" id="kindSeg">
          ${KINDS.map((k, i) => `<button type="button" data-v="${k.id}" aria-pressed="${i === 0}">${k.name}</button>`).join('')}
        </div>
        <div class="seg" role="group" aria-label="Stage" id="stageSeg">
          <button type="button" data-v="1" aria-pressed="false">1</button>
          <button type="button" data-v="2" aria-pressed="false">2</button>
          <button type="button" data-v="3" aria-pressed="true">3</button>
          <button type="button" data-v="4" aria-pressed="false">Queen</button>
        </div>
        <div class="seg" role="group" aria-label="Art" id="artSeg">
          <button type="button" data-v="new" aria-pressed="true">New</button>
          <button type="button" data-v="today" aria-pressed="false">Today</button>
        </div>
        <button type="button" class="play" id="play">Grow ▸</button>
      </div>
      <span class="caption" id="cap"></span>
    </div>
  </section>

  <section class="section" aria-labelledby="kinds-h">
    <h2 id="kinds-h">Five kinds, three stages, a queen nest each</h2>
    <p>Every kind shares the Earthworks growth: more burrows, tunnels, spoil and eggs at each stage, and scrap from your factory at stage 3. Each kind has its own soil and leftovers, so you can tell them apart from far off. A queen nest is wider and has a glowing royal chamber in the middle, with a ring of spikes in its bug’s colour.</p>
    <div class="kinds">${KINDS.map(kindRow).join('')}</div>
  </section>

  <section class="section" aria-labelledby="queens-h">
    <h2 id="queens-h">The queens</h2>
    <p>Each queen is her bug with a swollen abdomen trailing behind, eggs showing through the skin, and a gold crest at the back of the head. Wasp queens keep the stripes and sting; beetle queens’ wing cases have split over the abdomen. They’re drawn in a box half again as big as a worker’s.</p>
    <div class="strip" style="grid-template-columns: repeat(5, minmax(96px, 1fr))">
      ${KINDS.map((k) => `<figure class="royal">${img(concept(`queen_${k.bug}`), `${k.bugName} queen`, 96)}<figcaption>${k.bugName}</figcaption></figure>`).join('')}
    </div>
    <div class="strip" style="grid-template-columns: repeat(5, minmax(96px, 1fr))" aria-label="Today's worker bugs, for scale">
      ${KINDS.map((k) => `<figure><img src="${bugArt(k.bug)}" alt="${k.bugName}" width="64" height="64" style="max-width:64px"><figcaption>${k.bugName} worker</figcaption></figure>`).join('')}
    </div>
  </section>

  <section class="section" aria-labelledby="today-h">
    <h2 id="today-h">Today’s nests</h2>
    <p>For comparison: three kinds and one queen nest, scaled up by stage, with the egg overlay added at stages 2 and 3.</p>
    <div class="compare-row">
      <figure><img src="${current('warren')}" alt="Current warren"><figcaption>warren</figcaption></figure>
      <figure><img src="${current('hive')}" alt="Current hive"><figcaption>hive</figcaption></figure>
      <figure><img src="${current('den')}" alt="Current den"><figcaption>den</figcaption></figure>
      <figure><img src="${current('queen')}" alt="Current queen nest"><figcaption>queen</figcaption></figure>
      <figure><img src="${current('grown')}" alt="Current grown overlay"><figcaption>grown overlay</figcaption></figure>
    </div>
  </section>

  <section class="section" aria-labelledby="qs-h">
    <h2 id="qs-h">To settle before building it</h2>
    <p>Two new kinds and queen bugs change the rules as well as the art. These are my recommendations; tell me where you’d go another way.</p>
    <div class="qs">
      <div class="q"><b>Which bugs live where</b><p>Each kind is mostly its own bug, with some crawlers as now. Hives would hold wasps (with some runners) instead of runners, and dens brutes without beetles.</p><p class="rec">Distances follow today’s lines: warrens near the hub, runnels from 60 tiles, hives from 80, dens from 100, barrows from 120.</p></div>
      <div class="q"><b>Queen nests</b><p>“Queen” stops being a kind of its own and becomes something any nest can be. A queen nest keeps today’s queen rules (3× mound health and chitin, breeds twice as fast, near the map edge) and its kind’s bugs.</p><p class="rec">Its kind comes from its distance like any nest. Today’s queen nests hold every bug kind; under this plan they’d hold only their own.</p></div>
      <div class="q"><b>What a queen bug does</b><p>One queen lives in each queen nest. She stays in the chamber and comes out only once the mound falls, then fights as a slow, tough version of her bug (about 6× health, 2× bite).</p><p class="rec">Killing her drops extra chitin. While she lives, the nest’s bugs hatch faster. That’s already the queen nest’s rule, so it now has a face.</p></div>
      <div class="q"><b>Saves</b><p>This changes saved state (nest kinds, the queen flag, queen bugs), so it needs a save version bump. Old queen nests become queen nests of their distance’s kind. Old hives and dens keep their bugs and only change the bugs they breed.</p></div>
    </div>
  </section>

  <section class="section plan" aria-labelledby="plan-h">
    <h2 id="plan-h">What it takes to put it in</h2>
    <ul>
      <li><b>Sprites:</b> 5 kinds × 3 stages (<code>nests/warren_1</code> … <code>nests/barrow_3</code>), 5 queen nests (<code>nests/warren_queen</code> …) and 5 queens (<code>enemies/crawler_queen</code> …), with walking strips for the queens. Hardcore gets a darker take on each stage instead of one <code>nests/hardcore</code> sprite.</li>
      <li><b>Size:</b> every stage drawn in the same 4-tile box (the Hardcore cover ring is 4×4 too); the art itself grows from about 1.6 tiles across to 3.4. The blocked 2×2 tiles don’t change.</li>
      <li><b>Merged nests:</b> stage 3 art at 1.3× as now, with a tunnel drawn in code towards each other cell the nest owns.</li>
      <li><b>Kept as they are:</b> the angry eyes, damaged rim and destroyed overlays, the health bar and the blight.</li>
      <li><b>Done in steps:</b> the art first (no rule changes: runners’ and beetles’ nests keep today’s kinds until the second step); then the two new kinds and the queen flag; then queen bugs.</li>
    </ul>
  </section>
</main>

<script>
const ART = ${fieldData};
const QUEEN = ${queenData};
const WORKER = ${workerData};
const NOW = ${currentData};
const NAMES = ${JSON.stringify(Object.fromEntries(KINDS.map((k) => [k.id, k.name])))};
const state = { kind: 'warren', stage: 3, art: 'new' };
const cache = new Map();
function load(src) {
  if (!cache.has(src)) cache.set(src, new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
  return cache.get(src);
}
const cv = document.getElementById('field');
const ctx = cv.getContext('2d');
const T = 44; // pixels per tile in the preview
let fade = null;

/** Grass, tufts, the blight, the nest, the 2×2 blocked tiles, and a worker (and queen) for scale. */
async function draw(alpha = 1, prev = null) {
  const W = cv.width, H = cv.height, cx = W / 2 - T, cy = H / 2;
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
    ctx.globalAlpha = a;
    if (state.art === 'today') {
      const q = st === 4;
      const size = 2 * (0.7 + 0.15 * Math.min(st, 3)) * T * (q ? 1.3 : 1);
      const base = await load(q ? NOW.queen : NOW[state.kind]); const grown = await load(NOW.grown);
      if (base) ctx.drawImage(base, cx - size / 2, cy - size / 2, size, size);
      if (grown && st >= 2) ctx.drawImage(grown, cx - size / 2, cy - size / 2, size, size);
      if (grown && st >= 3) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI); ctx.drawImage(grown, -size / 2, -size / 2, size, size); ctx.restore(); }
    } else {
      const im = await load(ART[state.kind][st - 1]); const size = (st === 4 ? 4.6 : 4) * T;
      if (im) ctx.drawImage(im, cx - size / 2, cy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  };
  if (prev) await paint(prev, 1 - alpha);
  await paint(state.stage, alpha);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - T, cy - T, 2 * T, 2 * T); ctx.setLineDash([]);
  // A worker beside the nest for scale (bugs are drawn about a tile across), and the queen by a queen nest.
  const w = await load(WORKER[state.kind]);
  if (w) ctx.drawImage(w, cx + 3.4 * T, cy + 0.6 * T, T, T);
  if (state.stage === 4 && state.art === 'new') { const q = await load(QUEEN[state.kind]); if (q) ctx.drawImage(q, cx + 3.2 * T, cy - 1.8 * T, 1.5 * T, 1.5 * T); }
  const st = state.stage === 4 ? 'queen nest' : 'stage ' + state.stage;
  document.getElementById('cap').textContent = (state.art === 'today' ? 'Today · ' : '') + NAMES[state.kind] + ' · ' + st + ' · dashed: the 2×2 tiles it blocks';
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
  for (const [segId, key] of [['kindSeg', 'kind'], ['stageSeg', 'stage'], ['artSeg', 'art']])
    for (const b of document.getElementById(segId).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === String(state[key])));
}
for (const [segId, key] of [['kindSeg', 'kind'], ['artSeg', 'art']])
  document.getElementById(segId).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state[key] = b.dataset.v; fade = null; sync(); draw(); });
document.getElementById('stageSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setStage(+b.dataset.v, true); });
let timer = null;
document.getElementById('play').addEventListener('click', () => {
  clearInterval(timer); setStage(1, false);
  let st = 1; timer = setInterval(() => { st++; setStage(st, true); if (st >= 4) clearInterval(timer); }, 1200);
});
sync(); draw();
</script>
`;

writeFileSync(join(HERE, 'concepts.html'), html);
console.log('Wrote concepts.html');
