// Batch 3 of the Ideas in the game (D-158): Hardcore bugs and nests, a drone, Mk plates, the hub breach,
// worn terraces by an extractor, leaves on an idle belt in fall, and snowfall. node shots/batch3.cjs [folder]
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
    w.electrified = () => 1;
    for (const item of items) s.inventory[item] = 9999;
    const hub = w.hub;
    const x0 = hub.x - 4, y0 = hub.y + 9;
    for (let y = y0 - 1; y < y0 + 12; y++) for (let x = x0 - 1; x < x0 + 18; x++) { const i = w.idx(x, y); s.trees[i] = 0; s.resources[i] = 0; }
    const errs = [];
    const put = (type, x, y, dir = 0) => { const r = w.place(type, x, y, dir); if (typeof r !== 'object') errs.push(`${type}: ${r}`); return typeof r === 'object' ? r : null; };
    // Two furnaces, Mk2 and Mk3.
    const f2 = put('furnace', x0, y0); if (f2) f2.tier = 2;
    const f3 = put('furnace', x0 + 3, y0); if (f3) f3.tier = 3;
    // A drone between two pads.
    const a = put('drone_pad', x0 + 6, y0), c = put('drone_pad', x0 + 12, y0);
    if (a && c) s.drones.push({ home: a.id, to: c.id, item: 'gear', count: 1, flown: 3, back: false });
    // An iron patch with an extractor on it.
    for (let y = y0 + 4; y < y0 + 10; y++) for (let x = x0; x < x0 + 7; x++) s.resources[w.idx(x, y)] = 1;
    put('extractor', x0 + 2, y0 + 6);
    // An idle line of belts.
    for (let x = x0 + 9; x < x0 + 15; x++) put('belt', x, y0 + 5, 0);
    // Bugs.
    const nest = s.nests.find((n) => !n.destroyed);
    ['crawler', 'brute', 'beetle', 'wasp'].forEach((t, k) => { const e = w.spawnBug(t, nest, 1); e.x = x0 + 9.5 + k * 1.6; e.y = y0 + 8; e.tx = e.x; e.ty = e.y; });
    w.layout++;
    window.__nest = nest;
    return { x: x0 + 7, y: y0 + 5, errs, nest: [nest.x, nest.y] };
  }, ["iron_ore", "copper_ore", "stone", "iron_plate", "copper_ingot", "brick", "gear", "wire", "motor", "log", "plank", "stake", "dowel", "peg", "rope", "truss", "charcoal", "steel", "chitin", "iron_ingot", "iron_rod", "rivet", "steel_beam", "bearing", "sulfur", "gunpowder", "casing", "bullet", "shell", "ap_bullet", "he_shell", "circuit", "coil", "hub", "belt", "express_belt", "splitter", "tunnel", "extractor", "furnace", "workshop", "assembler", "turret", "cannon", "mortar", "artillery", "tesla", "ballista", "repair", "port", "wall", "reinforced_wall", "teleporter", "strike_beacon", "tree_nursery", "greenhouse", "shield_pylon", "railgun", "drone_pad", "arc_fence", "floodlight", "steel_wall", "lumber_camp", "sawmill", "blacksmith", "machine_shop", "circuit_works", "steel_works", "powder_mill", "shaft", "well", "water_wheel", "boiler", "steam_turbine", "power_pole", "palisade", "roller", "spike_pit", "trebuchet", "crate", "storage", "storage_silo", "shipyard"]);
  if (at.errs.length) console.log(at.errs.join('\n'));
  const cam = async (x, y, z) => { await p.evaluate(([x, y, z]) => { const c = window.game.camera; c.x = x; c.y = y; c.zoom = z; window.game.world.layout++; }, [x, y, z]); await p.waitForTimeout(400); };
  const season = async (day) => { await p.evaluate((day) => { window.game.world.state.time = day; window.game.world.layout++; }, day); await p.waitForTimeout(400); };
  await cam(at.x, at.y, 52);
  await p.screenshot({ path: `${out}/b3_standard.png` });
  await p.evaluate(() => { window.game.world.state.mode = 'hardcore'; });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/b3_hardcore.png` });
  const n = await p.evaluate(() => { const n = window.__nest; return [n.x + 5, n.y + 5]; });
  await cam(n[0], n[1], 40);
  await p.screenshot({ path: `${out}/b3_nest.png` });
  await p.evaluate(() => { window.game.world.state.mode = 'standard'; });
  // The hub breached.
  const hub = await p.evaluate(() => { const h = window.game.world.hub; window.game.world.state.breaches++; return [h.x + 4, h.y + 4]; });
  await cam(hub[0], hub[1], 26);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/b3_breach.png` });
  // Fall (day 8, its middle) and winter (day 11, once the snow has settled): a day is 540 s.
  await cam(at.x + 3, at.y, 52);
  await season(7 * 540 + 100);
  await p.screenshot({ path: `${out}/b3_fall.png` });
  await season(10 * 540 + 320);
  await p.screenshot({ path: `${out}/b3_winter.png` });
  await b.close();
})();
