// "Bare trees" artboard: late-fall and winter broadleaf trees, alone and in a forest with the game's pines.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { bareTree } from './baretree.mjs';

const [repo, root] = process.argv.slice(2);
const SEED = 11;
// The trees as they were before 0.87.9 (the board's "Now" column), from git, since the release replaced them.
const BEFORE = 'f09df4d';
const art = (name) => (/^tree_round_winter/.test(name) ? execSync(`git -C ${repo} show ${BEFORE}:src/art/terrain/${name}.svg`).toString() : fs.readFileSync(path.join(repo, 'src/art/terrain', `${name}.svg`), 'utf8'));
const uri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const SPR = {
  ground_fall: uri(art('ground_fall')),
  ground_winter: uri(art('ground_winter')),
  round_fall: uri(art('tree_round_fall')),
  round_winter: uri(art('tree_round_winter')),
  round_frost: uri(art('tree_round_winter_frost')),
  pine_fall: uri(art('tree_pine_fall')),
  pine_winter: uri(art('tree_pine_winter')),
  pine_snow: uri(art('tree_pine_winter_snow')),
  bare: uri(bareTree('bare', SEED)),
  leaves: uri(bareTree('leaves', SEED)),
  snow: uri(bareTree('snow', SEED)),
};

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};
const T = 44; // pixels a tile
/** A patch of forest as the game lays it out: each tile a broadleaf or a pine, sized, nudged and turned by a hash. */
let uses = 0;
function forest(w, h, ground, round, pine, overRound, overPine) {
  // Each sprite once, in defs, then placed by <use>.
  const ids = new Map();
  let defs = '';
  const ref = (href) => {
    if (!ids.has(href)) {
      const id = `fs${uses++}`;
      ids.set(href, id);
      defs += `<image id="${id}" href="${href}" width="${T}" height="${T}" />`;
    }
    return ids.get(href);
  };
  let s = '';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s += `<use href="#${ref(ground)}" x="${x * T}" y="${y * T}" />`;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const hv = hash(x + 5000, y + 5000);
      if (hash(x, y + 77) % 10 < 2) continue; // a few clearings
      const kind = hv % 10;
      const isPine = kind >= 5 && kind < 9;
      const size = (1.35 + ((hv >>> 8) % 30) / 100) * T;
      const jx = (((hv >>> 12) % 20) / 100 - 0.1) * T;
      const jy = (((hv >>> 20) % 20) / 100 - 0.1) * T;
      const rot = ((hv >>> 4) % 8) * 45;
      const cx = (x + 0.5) * T + jx, cy = (y + 0.5) * T + jy;
      const k = size / T;
      const at = `transform="rotate(${rot} ${cx.toFixed(1)} ${cy.toFixed(1)}) translate(${(cx - size / 2).toFixed(1)} ${(cy - size / 2).toFixed(1)}) scale(${k.toFixed(3)})"`;
      s += `<use href="#${ref(isPine ? pine : round)}" ${at} />`;
      const over = isPine ? overPine : overRound;
      if (over) s += `<use href="#${ref(over)}" ${at} />`;
    }
  return `<svg viewBox="0 0 ${w * T} ${h * T}" width="${w * T}" height="${h * T}" style="display: block; border-radius: 8px"><defs>${defs}</defs>${s}</svg>`;
}
const one = (bg, imgs, w = 220) => `<div style="background: ${bg}; border-radius: 10px; padding: 10px; display: flex"><svg viewBox="0 0 128 128" width="${w}" height="${w}">${imgs.map((h) => `<image href="${h}" width="128" height="128" />`).join('')}</svg></div>`;
const card = (inner, title, sub) => `<div style="display: flex; flex-direction: column; gap: 8px; width: ${inner.includes('viewBox="0 0 128') ? 240 : 'auto'}px">${inner}<div style="font-weight: 700; font-size: 16px; color: #ffffff">${title}</div><div style="font-size: 13px; line-height: 1.45; color: #a9b6c9; max-width: 400px">${sub}</div></div>`;
const FALL = '#3f4a2c', SNOW = '#dfe7f0';

const singles = [
  card(one(FALL, [SPR.round_fall]), 'Now · fall', 'The broadleaf tree all through fall: an orange crown.'),
  card(one(FALL, [SPR.bare]), 'End of fall · bare', 'Limbs spread out from the trunk and fork into twigs, lit from the top-left, casting a lacy shadow.'),
  card(one(FALL, [SPR.leaves]), 'End of fall · last leaves (option)', 'The same tree with a few orange and gold leaves still clinging to the twigs.'),
  card(one(SNOW, [SPR.round_winter, SPR.round_frost]), 'Now · winter', 'A frosted grey-green crown.'),
  card(one(SNOW, [SPR.snow]), 'Winter · bare with snow', 'Snow lies along the tops of the limbs and heaps in the fork over the trunk.'),
];
const scenes = [
  card(forest(9, 6, SPR.ground_fall, SPR.round_fall, SPR.pine_fall), 'Fall now', 'Orange broadleaf trees among the pines.'),
  card(forest(9, 6, SPR.ground_fall, SPR.bare, SPR.pine_fall), 'End of fall', 'The broadleaf trees bare; the pines keep their needles.'),
  card(forest(9, 6, SPR.ground_winter, SPR.snow, SPR.pine_winter, null, SPR.pine_snow), 'Winter', 'Bare trees with snow on their limbs, among the snowy pines.'),
];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bare trees</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&amp;display=swap" rel="stylesheet">
<style>body{margin:0}</style>
</helmet>
<div style="width: 1440px; min-height: 1060px; box-sizing: border-box; padding: 56px 64px; background: #121a28; color: #e6edf7; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 32px">
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #f2c14e; font-weight: 700">Terrain · proposed, not in the game</div>
<h1 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-weight: 800; font-size: 40px; color: #ffffff">Bare trees for the end of fall and winter</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #a9b6c9; max-width: 1100px">The broadleaf trees lose their leaves towards the end of fall and stand bare through winter, with snow along their limbs. Seen from straight above like the rest of the map. Pines are evergreen, so they keep their needles and stay as they are now (snowy in winter). The forests below use the game's own ground and pine sprites, laid out, sized and turned the way the game does.</p>
</div>
<div style="display: flex; gap: 20px; align-items: flex-start">${singles.join('')}</div>
<div style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap">${scenes.join('')}</div>
</div>
</x-dc>
</body>
</html>`;
fs.writeFileSync(path.join(root, 'project/BareTrees.dc.html'), html);
console.log('ok', html.length);
