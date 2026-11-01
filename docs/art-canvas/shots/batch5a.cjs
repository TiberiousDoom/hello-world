// Batch 5, part 1 of the Ideas in the game (D-160): building and demolishing, a delivery and research,
// lock-on and low ammo, a raid warning, deaths by kind, footprints in snow, eyes at night, chitin.
// node shots/batch5a.cjs [folder]
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4174/');
  await p.click('#mm-new');
  await p.click('[data-mode="standard"]');
  await p.waitForFunction(() => window.game && window.game.world && window.game.world.hub);
  const at = await p.evaluate((items) => {
    const g = window.game, w = g.world, s = w.state;
    document.querySelector('#tutorial')?.setAttribute('hidden', '');
    s.explored?.fill?.(1);
    g.ui.speed = 0;
    w.isUnlocked = () => true;
    for (const item of items) s.inventory[item] = 9999;
    const hub = w.hub;
    const x0 = hub.x - 4, y0 = hub.y + 9;
    for (let y = y0 - 1; y < y0 + 12; y++) for (let x = x0 - 1; x < x0 + 18; x++) { const i = w.idx(x, y); s.trees[i] = 0; s.resources[i] = 0; }
    const put = (type, x, y, dir = 0) => { const r = w.place(type, x, y, dir); return typeof r === 'object' ? r : null; };
    const t = put('turret', x0 + 2, y0); if (t) t.ammo = 2;
    put('cannon', x0 + 4, y0);
    put('furnace', x0 + 8, y0);
    window.__x0 = x0; window.__y0 = y0;
    return { x: x0 + 6, y: y0 + 3 };
  }, ["iron_ore", "copper_ore", "stone", "iron_plate", "copper_ingot", "brick", "gear", "wire", "motor", "log", "plank", "stake", "dowel", "peg", "rope", "truss", "charcoal", "steel", "chitin", "iron_ingot", "iron_rod", "rivet", "steel_beam", "bearing", "sulfur", "gunpowder", "casing", "bullet", "shell", "ap_bullet", "he_shell", "circuit", "coil", "hub", "belt", "express_belt", "splitter", "tunnel", "extractor", "furnace", "workshop", "assembler", "turret", "cannon", "mortar", "artillery", "tesla", "ballista", "repair", "port", "wall", "reinforced_wall", "teleporter", "strike_beacon", "tree_nursery", "greenhouse", "shield_pylon", "railgun", "drone_pad", "arc_fence", "floodlight", "steel_wall", "lumber_camp", "sawmill", "blacksmith", "machine_shop", "circuit_works", "steel_works", "powder_mill", "shaft", "well", "water_wheel", "boiler", "steam_turbine", "power_pole", "palisade", "roller", "spike_pit", "trebuchet", "crate", "storage", "storage_silo", "shipyard"]);
  const cam = async (x, y, z) => { await p.evaluate(([x, y, z]) => { const c = window.game.camera; c.x = x; c.y = y; c.zoom = z; window.game.world.layout++; }, [x, y, z]); await p.waitForTimeout(300); };
  await cam(at.x, at.y, 48);
  // Build a workshop, take the furnace down, research something, fire the guns, raid, bugs dying.
  await p.evaluate(() => {
    const w = window.game.world, s = w.state, x0 = window.__x0, y0 = window.__y0;
    w.place('workshop', x0 + 11, y0, 0);
    const f = s.buildings.find((b) => b.type === 'furnace'); if (f) w.remove(f);
    s.researched.push('ideas_demo');
    for (const k of Object.keys(s.inventory).slice(0, 3)) s.inventory[k] += 5;
    const tu = s.buildings.find((b) => b.type === 'turret');
    w.shots.push({ x1: tu.x + 0.5, y1: tu.y + 0.5, x2: tu.x + 3, y2: tu.y + 4, splash: 0, age: 0 });
    const nest = s.nests.find((n) => !n.destroyed);
    ['wasp', 'beetle', 'brute'].forEach((type, k) => { const e = w.spawnBug(type, nest, 1); e.x = x0 + 2 + k * 2; e.y = y0 + 6; e.tx = e.x; e.ty = e.y; });
    const r = w.spawnBug('crawler', nest, 1); r.raid = true; r.x = x0 + 30; r.y = y0 + 4; r.tx = r.x; r.ty = r.y;
  });
  await p.waitForTimeout(120);
  await p.screenshot({ path: `${out}/b5a_events.png` });
  // The bugs die.
  await p.evaluate(() => { const s = window.game.world.state; s.enemies = s.enemies.filter((e) => e.raid); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/b5a_deaths.png` });
  // Winter, a bug walking across the snow, at night by the forest edge.
  await p.evaluate(() => { window.game.world.state.time = 10 * 540 + 320; window.game.world.layout++; });
  await p.waitForTimeout(300);
  await p.evaluate(async () => {
    const w = window.game.world, s = w.state, x0 = window.__x0, y0 = window.__y0;
    const nest = s.nests.find((n) => !n.destroyed);
    const e = w.spawnBug('brute', nest, 1); e.x = x0; e.y = y0 + 8; e.tx = e.x; e.ty = e.y;
    for (let k = 0; k < 40; k++) { e.x += 0.15; e.y += Math.sin(k / 5) * 0.05; await new Promise((r) => requestAnimationFrame(r)); }
  });
  await p.screenshot({ path: `${out}/b5a_snow.png` });
  await p.evaluate(() => { window.game.world.state.time = 10 * 540 + 470; });
  const edge = await p.evaluate(() => { const w = window.game.world, s = w.state, h = w.hub; for (let r = 6; r < 60; r++) for (let dx = -r; dx <= r; dx++) { const x = h.x + dx, y = h.y - r; if (s.trees[w.idx(x, y)] && !s.trees[w.idx(x, y + 1)]) return [x, y]; } return [h.x, h.y]; });
  await cam(edge[0], edge[1] + 3, 40);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/b5a_night.png` });
  await b.close();
})();
