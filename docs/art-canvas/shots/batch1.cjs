// Batch 1 of the Ideas in the game (D-156): a greenhouse at work, guns mid-recoil, wasps and beetles walking
// and attacking, and young bugs at each age. node shots/batch1.cjs [folder]
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4174/');
  await p.click('#mm-new');
  await p.click('[data-mode="standard"]');
  await p.waitForFunction(() => window.game && window.game.world && window.game.world.hub);
  const at = await p.evaluate(() => {
    const g = window.game, w = g.world, s = w.state;
    document.querySelector('#tutorial')?.setAttribute('hidden', '');
    s.explored?.fill?.(1);
    g.ui.speed = 0; // still, so the bugs stay where they're put
    const hub = w.hub;
    // Clear a patch south of the hub.
    const x0 = hub.x - 2, y0 = hub.y + 10;
    for (let y = y0; y < y0 + 10; y++) for (let x = x0; x < x0 + 14; x++) { const i = w.idx(x, y); s.trees[i] = 0; if (s.ore) s.ore[i] = 0; }
    w.isUnlocked = () => true;
    const errs = [];
    // Plenty of everything a building could cost.
    for (const item of ['iron_ore', 'copper_ore', 'stone', 'iron_plate', 'copper_ingot', 'brick', 'gear', 'wire', 'motor', 'log', 'plank', 'stake', 'dowel', 'peg', 'rope', 'truss', 'charcoal', 'steel', 'chitin', 'iron_ingot', 'iron_rod', 'rivet', 'steel_beam', 'bearing', 'sulfur', 'gunpowder', 'casing', 'bullet', 'shell', 'ap_bullet', 'he_shell', 'circuit', 'coil', 'hub', 'belt', 'express_belt', 'splitter', 'tunnel', 'extractor', 'furnace', 'workshop', 'assembler', 'turret', 'cannon', 'mortar', 'artillery', 'tesla', 'ballista', 'repair', 'port', 'wall', 'reinforced_wall', 'teleporter', 'strike_beacon', 'tree_nursery', 'greenhouse', 'shield_pylon', 'railgun', 'drone_pad', 'arc_fence', 'floodlight', 'steel_wall', 'lumber_camp', 'sawmill', 'blacksmith', 'machine_shop', 'circuit_works', 'steel_works', 'powder_mill', 'shaft', 'well', 'water_wheel', 'boiler', 'steam_turbine', 'power_pole', 'palisade', 'roller', 'spike_pit', 'trebuchet', 'crate', 'storage', 'storage_silo', 'shipyard']) s.inventory[item] = 9999;
    const put = (type, x, y) => { const r = w.place(type, x, y, 0); if (typeof r !== 'object') errs.push(`${type}: ${r}`); return typeof r === 'object' ? r : null; };
    const guns = ['turret', 'turret2', 'cannon', 'mortar'].map((t, k) => put(t, x0 + k * 2, y0));
    guns.push(put('artillery', x0 + 8, y0));
    const gh = put('greenhouse', x0 + 11, y0);
    if (gh) { gh.progress = 0.5; w.speedUp = () => 1; }
    for (const gun of guns) if (gun) gun.ammo = 10;
    const nest = s.nests.find((n) => !n.destroyed);
    const bug = (type, x, y, young, age) => { const e = w.spawnBug(type, nest, 1, young); e.x = x; e.y = y; e.tx = x; e.ty = y; if (young) e.born = s.time - age; return e; };
    for (let k = 0; k < 3; k++) bug('wasp', x0 + 1 + k * 1.5, y0 + 4);
    for (let k = 0; k < 3; k++) bug('beetle', x0 + 6 + k * 1.5, y0 + 4);
    // Young crawlers, runners and brutes: just hatched, a third grown, two thirds, grown.
    ['crawler', 'brute'].forEach((t, row) => [0, 0.33, 0.66, 1].forEach((f, k) => bug(t, x0 + 1 + k * 2, y0 + 6.5 + row * 2, f < 1, f * 180)));
    window.__guns = guns.filter(Boolean).map((g) => g.id);
    return { x: x0 + 6, y: y0 + 4, errs };
  });
  const cam = async (x, y, z) => { await p.evaluate(([x, y, z]) => { const c = window.game.camera; c.x = x; c.y = y; c.zoom = z; window.game.world.layout++; }, [x, y, z]); await p.waitForTimeout(300); };
  if (at.errs.length) console.log(at.errs.join('\n'));
  await cam(at.x, at.y, 56);
  await p.screenshot({ path: `${out}/scene.png` });
  // Fire every gun and catch them mid-recoil.
  for (const [name, ms] of [['fire1', 30], ['fire2', 90]]) {
    await p.evaluate((ms) => { const r = window.game.renderer; for (const id of window.__guns) r.fired.set(id, performance.now() - ms); }, ms);
    await p.waitForTimeout(16);
    await p.screenshot({ path: `${out}/${name}.png` });
  }
  await b.close();
})();
