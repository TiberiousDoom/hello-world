// Batch 2 of the Ideas in the game (D-157): buildings that show their work, the railgun charging, the
// tesla's bolt and stores at each fill. node shots/batch2.cjs [folder]
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
    for (let y = y0 - 1; y < y0 + 12; y++) for (let x = x0 - 1; x < x0 + 18; x++) { const i = w.idx(x, y); s.trees[i] = 0; if (s.resources) s.resources[i] = 0; }
    const errs = [];
    const put = (type, x, y, dir = 0) => { const r = w.place(type, x, y, dir); if (typeof r !== 'object') errs.push(`${type}: ${r}`); return typeof r === 'object' ? r : null; };
    put('tree_nursery', x0, y0);
    const tp = put('teleporter', x0 + 3, y0); if (tp) tp.filter = 'iron_plate';
    put('drone_pad', x0 + 5, y0);
    put('shield_pylon', x0 + 7, y0);
    put('strike_beacon', x0 + 9, y0);
    const rg = put('railgun', x0 + 11, y0);
    const ts = put('tesla', x0 + 14, y0);
    // Stores at each fill: empty, a third, two thirds, full.
    [0, 0.2, 0.55, 1].forEach((f, k) => {
      const c = put('crate', x0 + k * 2, y0 + 4); if (c) c.outputs = Array(Math.round(50 * f)).fill('gear');
      const u = put('storage', x0 + 9 + k * 2, y0 + 4, 1); if (u) u.outputs = Array(Math.round(300 * f)).fill('iron_plate');
      const sl = put('storage_silo', x0 + k * 3, y0 + 7); if (sl) sl.outputs = Array(Math.round(1200 * f)).fill('stone');
    });
    // A port: next to the hub, sending.
    let port = null;
    for (let d = 0; d < 8 && !port; d++) port = put('port', hub.x + d, hub.y - 1);
    if (port) { port.filter = 'iron_plate'; port.progress = 0.5; }
    window.__rg = rg?.id; window.__ts = ts;
    return { x: x0 + 8, y: y0 + 4, errs, hub: [hub.x, hub.y], port: port && [port.x, port.y] };
  }, ["iron_ore", "copper_ore", "stone", "iron_plate", "copper_ingot", "brick", "gear", "wire", "motor", "log", "plank", "stake", "dowel", "peg", "rope", "truss", "charcoal", "steel", "chitin", "iron_ingot", "iron_rod", "rivet", "steel_beam", "bearing", "sulfur", "gunpowder", "casing", "bullet", "shell", "ap_bullet", "he_shell", "circuit", "coil", "hub", "belt", "express_belt", "splitter", "tunnel", "extractor", "furnace", "workshop", "assembler", "turret", "cannon", "mortar", "artillery", "tesla", "ballista", "repair", "port", "wall", "reinforced_wall", "teleporter", "strike_beacon", "tree_nursery", "greenhouse", "shield_pylon", "railgun", "drone_pad", "arc_fence", "floodlight", "steel_wall", "lumber_camp", "sawmill", "blacksmith", "machine_shop", "circuit_works", "steel_works", "powder_mill", "shaft", "well", "water_wheel", "boiler", "steam_turbine", "power_pole", "palisade", "roller", "spike_pit", "trebuchet", "crate", "storage", "storage_silo", "shipyard"]);
  if (at.errs.length) console.log(at.errs.join('\n'));
  const cam = async (x, y, z) => { await p.evaluate(([x, y, z]) => { const c = window.game.camera; c.x = x; c.y = y; c.zoom = z; window.game.world.layout++; }, [x, y, z]); await p.waitForTimeout(300); };
  await cam(at.x, at.y, 48);
  for (const k of [0, 1, 2, 3]) {
    await p.evaluate((k) => {
      const w = window.game.world;
      w.state.time = 100 + k / 8; // the working strips step on game time, 8 frames a second
      const ts = window.__ts;
      if (ts) w.shots.push({ x1: ts.x + 0.5, y1: ts.y + 0.5, x2: ts.x + 3.5, y2: ts.y + 3, splash: 0, age: 0.02, arc: true });
      window.game.renderer.fired.set(window.__rg, performance.now() - [150, 600, 1500, 2300][k]);
    }, k);
    await p.waitForTimeout(60);
    await p.screenshot({ path: `${out}/b2_${k}.png` });
  }
  if (at.port) { await cam(at.port[0] + 0.5, at.port[1] + 2, 64); await p.screenshot({ path: `${out}/b2_port.png` }); }
  await b.close();
})();
