// Batch 4 of the Ideas in the game (D-159): the engineer carrying, a queen calling her nest out, a hatchling
// climbing out of the ground, power sparks, ingots and ore on a belt, scaffolding, a ruin, rain, a pond and
// dawn fog, a floodlight at night, and the ship climbing at lift-off. node shots/batch4.cjs [folder]
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
    // Power poles in a row, a belt carrying ingots and ore, a furnace under repair.
    for (let k = 0; k < 4; k++) put('power_pole', x0 + k * 4, y0);
    for (let x = x0; x < x0 + 10; x++) { const bt = put('belt', x, y0 + 3, 0); if (bt) bt.belt.push({ item: x % 2 ? 'iron_ingot' : 'iron_ore', pos: 0.5, lane: 0 }); }
    const f = put('furnace', x0 + 12, y0 + 2);
    put('floodlight', x0 + 15, y0 + 6, 1);
    // A queen beside her roused nest, and a hatchling climbing out.
    const nest = s.nests.find((n) => !n.destroyed);
    nest.angryUntil = s.time + 999;
    const q = w.spawnBug('brute', nest, 1); q.queen = true; q.x = x0 + 2; q.y = y0 + 7; q.tx = q.x; q.ty = q.y;
    const h = w.spawnBug('crawler', nest, 1, true); h.x = x0 + 5; h.y = y0 + 7; h.tx = h.x; h.ty = h.y; h.born = s.time - 0.3;
    // The engineer, carrying, on the move.
    const pl = s.players[0]; pl.x = x0 + 8; pl.y = y0 + 8; pl.slots[0] = { item: 'log', count: 5 }; pl.walk = { x: x0 + 12, y: y0 + 8 };
    window.__f = f;
    return { x: x0 + 7, y: y0 + 4, errs };
  }, ["iron_ore", "copper_ore", "stone", "iron_plate", "copper_ingot", "brick", "gear", "wire", "motor", "log", "plank", "stake", "dowel", "peg", "rope", "truss", "charcoal", "steel", "chitin", "iron_ingot", "iron_rod", "rivet", "steel_beam", "bearing", "sulfur", "gunpowder", "casing", "bullet", "shell", "ap_bullet", "he_shell", "circuit", "coil", "hub", "belt", "express_belt", "splitter", "tunnel", "extractor", "furnace", "workshop", "assembler", "turret", "cannon", "mortar", "artillery", "tesla", "ballista", "repair", "port", "wall", "reinforced_wall", "teleporter", "strike_beacon", "tree_nursery", "greenhouse", "shield_pylon", "railgun", "drone_pad", "arc_fence", "floodlight", "steel_wall", "lumber_camp", "sawmill", "blacksmith", "machine_shop", "circuit_works", "steel_works", "powder_mill", "shaft", "well", "water_wheel", "boiler", "steam_turbine", "power_pole", "palisade", "roller", "spike_pit", "trebuchet", "crate", "storage", "storage_silo", "shipyard"]);
  if (at.errs.length) console.log(at.errs.join('\n'));
  const cam = async (x, y, z) => { await p.evaluate(([x, y, z]) => { const c = window.game.camera; c.x = x; c.y = y; c.zoom = z; window.game.world.layout++; }, [x, y, z]); await p.waitForTimeout(400); };
  await cam(at.x, at.y, 52);
  // Mend the furnace and lose a building, then look.
  await p.evaluate(() => {
    const w = window.game.world, f = window.__f;
    w.healed.push({ x: f.x + 1, y: f.y + 1, age: 0, by: 0 });
    w.lost.push({ id: 99999, age: 0, x: f.x - 2, y: f.y + 6, size: 2 });
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/b4_day.png` });
  // A rainy spring day (one whose hash picks rain), at dawn for the fog, then at night for the floodlight.
  const day = await p.evaluate(() => {
    for (let d = 1; d < 40; d++) {
      let h = Math.imul(d, 374761393) + Math.imul(4401, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      if (((h ^ (h >>> 16)) >>> 0) % 3 === 0 && (d - 1) % 12 < 4) return d;
    }
    return 1;
  });
  await p.evaluate((d) => { window.game.world.state.time = (d - 1) * 540 + 20; window.game.world.layout++; }, day);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/b4_rain_dawn.png` });
  await p.evaluate(() => { window.game.world.state.time = 400; window.game.world.layout++; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/b4_night.png` });
  await b.close();
})();
