// Builds "Current art" artboards for the art upgrade canvas from the game's src/art sprites.
// Usage: node gen-current.mjs <repo> <canvas root>
import fs from 'node:fs';
import path from 'node:path';

const [repo, root] = process.argv.slice(2);
const art = path.join(repo, 'src/art');
const data = fs.readFileSync(path.join(repo, 'src/sim/data.ts'), 'utf8');
const version = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version;

// Display names from data.ts: `key: { name: 'Name'` (on one line or the next).
const names = {};
for (const m of data.matchAll(/^\s+(\w+): \{\s*(?:\n\s*)?name: '([^']+)'/gm)) names[m[1]] ??= m[2];
const TILES = {};
for (const m of fs.readFileSync(path.join(art, 'index.ts'), 'utf8').matchAll(/'([a-z_]+\/[a-z_0-9]+)': \[(\d+), (\d+)\]/g)) TILES[m[1]] = [+m[2], +m[3]];

const all = new Set();
for (const dir of fs.readdirSync(art)) {
  const p = path.join(art, dir);
  if (!fs.statSync(p).isDirectory()) continue;
  for (const f of fs.readdirSync(p)) if (f.endsWith('.svg')) all.add(`${dir}/${f.slice(0, -4)}`);
}
const used = new Set();

let uid = 0;
/** An SVG file inlined at w×h px, its ids made unique on the page. */
function svg(key, w, h, label, extra = '') {
  used.add(key);
  let s = fs.readFileSync(path.join(art, `${key}.svg`), 'utf8');
  s = s.replace(/<\?xml[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const p = `s${++uid}-`;
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s
      .replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="${p}${id}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${p}${id})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${p}${id}"`);
  }
  if (s.includes('{{')) throw new Error(`${key}: holds {{`);
  // Size it: drop any width/height on the root, then set ours.
  s = s.replace(/<svg\b([^>]*)>/, (_, attrs) => {
    const a = attrs.replace(/\s(width|height)="[^"]*"/g, '');
    return `<svg${a} width="${w}" height="${h}" role="img" aria-label="${label}"${extra}>`;
  });
  return s;
}

const PX = 56; // px per tile on the boards
const MAX = 224;
const frames = (key) => +(/_(\d+)f$/.exec(key)?.[1] ?? 0);
function tiles(key) {
  const base = key.replace(/_\d+f$/, '').replace(/_working$/, '').replace(/_(walk|attack|idle|ko|work)$/, '');
  return TILES[key.replace(/_\d+f$/, '')] ?? TILES[key.replace(/_\d+f$/, '').replace(/_working$/, '')] ?? TILES[base] ?? [1, 1];
}
const nice = (s) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
function labelOf(key) {
  const [, n] = key.split('/');
  return names[n] ?? nice(n);
}

/** Card for one sprite (or strip, shown whole). */
function card(key, { label = labelOf(key), bg = 'grass', note = key } = {}) {
  const [tw, th] = tiles(key);
  const n = frames(key);
  const unit = key.startsWith('items/') ? PX : PX;
  let fw = Math.min(MAX, tw * unit);
  let fh = Math.min(MAX, th * unit);
  if (tw !== th && Math.max(tw, th) * unit > MAX) [fw, fh] = tw > th ? [MAX, (MAX * th) / tw] : [(MAX * tw) / th, MAX];
  const w = n ? fw * n : fw;
  return { w, h: fh, html: (i) => box(svg(key, w, fh, label), w, fh, label, note, bg) };
}

/** A turret: its base with its barrel over it, facing east as placed. */
function turret(type) {
  const [tw, th] = tiles(`buildings/${type}_base`);
  const s = Math.min(MAX, tw * PX);
  const label = names[type] ?? nice(type);
  const inner = `<div style="position: relative; width: ${s}px; height: ${s}px">${svg(`buildings/${type}_base`, s, s, `${label} base`, ' style="position: absolute; left: 0; top: 0"')}${svg(`buildings/${type}_barrel`, s, s, `${label} barrel`, ' style="position: absolute; left: 0; top: 0"')}</div>`;
  return { w: s, h: s, html: () => box(inner, s, s, label, `${type}_base + _barrel`, 'grass') };
}

const BG = { grass: '#2e4d33', navy: '#1d3b6e', dark: '#0f1a2e' };
function box(inner, w, h, label, note, bg) {
  const cw = Math.max(w, 132);
  return `<div style="width: ${cw + 24}px; box-sizing: border-box; background: #1a2537; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px">
<div style="height: ${h}px; display: flex; align-items: center; justify-content: center; background: ${BG[bg]}; border-radius: 8px">${inner}</div>
<div style="font-weight: 700; font-size: 14px; color: #ffffff; line-height: 1.2">${label}</div>
<div style="font-size: 12px; color: #a9b6c9; line-height: 1.2; overflow-wrap: anywhere">${note}</div>
</div>`;
}
const CARD_EXTRA = 24 + 8 + 17 + 8 + 15; // padding, gaps, two caption lines (approx.)

/** A board: sections of cards, packed into rows; returns its file text and height. */
function board(file, kicker, title, intro, sections) {
  const W = 1440;
  const inner = W - 128;
  const gap = 16;
  let h = 56 + 22 + 8 + 48 + 10 + 24 + 28; // padding, kicker, title, intro, gap
  const parts = [];
  for (const sec of sections) {
    const cards = sec.cards.filter(Boolean);
    // Pack rows to know the height.
    let rowW = 0;
    let rowH = 0;
    let rows = 0;
    let total = 0;
    for (const c of cards) {
      const cw = Math.max(c.w, 132) + 24;
      if (rowW && rowW + gap + cw > inner) {
        total += rowH + gap;
        rowW = 0;
        rowH = 0;
      }
      rowW += (rowW ? gap : 0) + cw;
      rowH = Math.max(rowH, c.h + CARD_EXTRA);
      rows++;
    }
    total += rowH;
    h += 24 + 10 + total + 32; // heading, gap, cards, section gap
    parts.push(`<div style="display: flex; flex-direction: column; gap: 10px">
<h2 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-size: 20px; color: #ffffff">${sec.title}</h2>
<div style="display: flex; flex-wrap: wrap; gap: ${gap}px; align-items: flex-start">
${cards.map((c, i) => c.html(i)).join('\n')}
</div>
</div>`);
  }
  h = Math.ceil((h * 1.06 + 60) / 20) * 20; // a little slack: over-tall beats clipped
  const text = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
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
<div style="width: ${W}px; min-height: ${h}px; box-sizing: border-box; padding: 56px 64px; background: #121a28; color: #e6edf7; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 32px">
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #f2c14e; font-weight: 700">${kicker}</div>
<h1 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-weight: 800; font-size: 40px; color: #ffffff">${title}</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #a9b6c9; max-width: 1000px">${intro}</p>
</div>
${parts.join('\n')}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${W},"height":${h}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(root, 'project', file), text);
  return { file, title, h };
}

const B = (n, o) => card(`buildings/${n}`, o);
const has = (k) => all.has(k);
const kick = `Current art · ${version}`;
const boards = [];

const factory = ['hub', 'hub_damaged', 'lumber_camp', 'sawmill', 'workshop', 'extractor', 'furnace', 'blacksmith', 'machine_shop', 'assembler', 'steel_works', 'powder_mill', 'circuit_works', 'greenhouse', 'tree_nursery'];
const power = ['well', 'water_wheel', 'shaft', 'boiler', 'steam_turbine', 'power_pole', 'floodlight'];
const logistics = ['belt', 'belt_start', 'belt_end', 'belt_corner', 'belt_flange', 'express_belt', 'express_belt_start', 'express_belt_corner', 'roller', 'splitter', 'tunnel_in', 'tunnel_out', 'port', 'crate', 'storage', 'storage_silo', 'drone_pad', 'teleporter', 'strike_beacon'];
boards.push(
  board('CurrentFactory.dc.html', kick, 'Factory, power and logistics', 'Every building sprite the game draws now, at its size in tiles (56 px a tile here), facing east. Sprites come straight from src/art.', [
    { title: 'Hub and machines', cards: factory.map((n) => B(n, n === 'hub_damaged' ? { label: 'Hub, damaged' } : {})) },
    { title: 'Water and electric power', cards: power.map((n) => B(n)) },
    { title: 'Belts, rollers and storage', cards: logistics.map((n) => B(n, { label: n.includes('_') && !names[n] ? nice(n) : labelOf(`buildings/${n}`) })) },
  ]),
);

const turrets = ['turret', 'cannon', 'turret2', 'mortar', 'artillery', 'tesla', 'railgun', 'ballista', 'trebuchet'];
const walls = ['palisade', 'wall', 'reinforced_wall', 'steel_wall', 'arc_fence'];
const pieces = ['', '_v', '_ne', '_nw', '_se', '_sw', '_end_e', '_end_w', '_pier', '_post'];
boards.push(
  board('CurrentDefense.dc.html', kick, 'Defenses and walls', 'Turrets show their base with the barrel over it, facing east (the barrel turns to aim in the game). Walls and palisades are sets of pieces picked from their neighbours.', [
    { title: 'Turrets', cards: turrets.map(turret) },
    { title: 'Traps and support', cards: ['spike_pit', 'repair', 'shield_pylon'].map((n) => B(n)) },
    ...walls.map((wl) => ({
      title: `${names[wl] ?? nice(wl)} pieces`,
      cards: pieces.filter((p) => has(`buildings/${wl}${p}`)).map((p) => B(`${wl}${p}`, { label: p ? nice(p.slice(1)) : 'East–west', note: `${wl}${p}` })),
    })),
  ]),
);

boards.push(
  board('CurrentShip.dc.html', kick, 'Shipyard and ship', 'The 5×5 shipyard and each stage of the escape ship as it is built on the pad.', [
    { title: 'Shipyard and stages', cards: ['shipyard', 'ship_scaffold', 'ship_pad', 'ship_hull', 'ship_engine', 'ship_life', 'ship_nav'].map((n) => B(n, { label: nice(n) })) },
  ]),
);

const working = [...all].filter((k) => k.startsWith('buildings/') && k.endsWith('_working_4f')).sort();
boards.push(
  board('CurrentWorking.dc.html', kick, 'Working and firing animations', 'Each machine’s 4-frame working strip, built from its own sprite by art/working.mjs, and the trebuchet’s and ballista’s firing strips, built by art/animate.mjs. Frames run left to right.', [
    { title: 'Working strips', cards: working.map((k) => card(k, { label: labelOf(k.replace('_working_4f', '')) })) },
    { title: 'Firing (played once per shot)', cards: [...all].filter((k) => /_barrel_fire_\d+f$/.test(k)).sort().map((k) => card(k, { label: labelOf(k.replace(/_barrel_fire_\d+f$/, '')) })) },
  ]),
);

const bugs = ['crawler', 'runner', 'brute', 'wasp', 'beetle'];
boards.push(
  board('CurrentBugs.dc.html', kick, 'Bugs and nests', 'Each bug, its alternate look and its walk and attack strips; then the nest burrows and their states.', [
    { title: 'Bugs', cards: bugs.flatMap((b) => [card(`enemies/${b}`), has(`enemies/${b}_b`) ? card(`enemies/${b}_b`, { label: `${labelOf(`enemies/${b}`)}, alternate` }) : null]) },
    {
      title: 'Walk and attack strips',
      cards: bugs.flatMap((b) => ['walk', 'attack'].filter((s) => has(`enemies/${b}_${s}_4f`)).map((s) => card(`enemies/${b}_${s}_4f`, { label: `${labelOf(`enemies/${b}`)} ${s}` }))),
    },
    { title: 'Nests', cards: ['warren', 'hive', 'den', 'queen', 'hardcore', 'grown', 'angry', 'damaged', 'destroyed'].map((n) => card(`nests/${n}`, { label: nice(n) })) },
  ]),
);

boards.push(
  board('CurrentItems.dc.html', kick, 'Items', 'Every item icon, as drawn on belts (half a tile in the game; shown at a full tile here) and in the HUD.', [
    { title: 'Items', cards: [...all].filter((k) => k.startsWith('items/')).sort().map((k) => card(k, { bg: 'dark' })) },
  ]),
);

const terrain = [...all].filter((k) => k.startsWith('terrain/')).sort();
boards.push(
  board('CurrentTerrain.dc.html', kick, 'Terrain, seasons and the engineer', 'Ground tiles, ore nodes and plants, the trees for each season, and the engineer with its animation strips.', [
    { title: 'Ground and ore', cards: terrain.filter((k) => /ground|node_/.test(k)).map((k) => card(k, { label: nice(k.split('/')[1]) })) },
    { title: 'Trees by season', cards: terrain.filter((k) => /tree_/.test(k)).map((k) => card(k, { label: nice(k.split('/')[1]) })) },
    { title: 'Plants and ground cover', cards: terrain.filter((k) => !/ground|node_|tree_/.test(k)).map((k) => card(k, { label: nice(k.split('/')[1]) })) },
    { title: 'Engineer', cards: [...all].filter((k) => k.startsWith('units/')).sort().map((k) => card(k, { label: nice(k.split('/')[1]) })) },
  ]),
);

boards.push(
  board('CurrentEffectsUI.dc.html', kick, 'Effects and UI icons', 'Effect strips (frames left to right), damage overlays, and the icons used in menus and the toolbar.', [
    { title: 'Effects', cards: [...all].filter((k) => k.startsWith('effects/')).sort().map((k) => card(k, { label: nice(k.split('/')[1].replace(/_\d+f$/, '')), bg: 'dark' })) },
    { title: 'UI icons', cards: [...all].filter((k) => k.startsWith('ui/')).sort().map((k) => card(k, { label: nice(k.split('/')[1]), bg: 'navy' })) },
  ]),
);

const missing = [...all].filter((k) => !used.has(k));
if (missing.length) {
  console.error('not on any board:', missing.join(', '));
  process.exit(1);
}
console.log(JSON.stringify({ count: used.size, boards: boards.map((b) => [b.file, b.h, fs.statSync(path.join(root, 'project', b.file)).size]) }, null, 1));
