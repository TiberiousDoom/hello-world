// Batch 5, part 2 of the Ideas in the game (D-160): blossom, clouds, birds and animals, butterflies,
// flowers closed at night, co-op colours, wall cracks, worn spikes, a worn path, the water wheel and well,
// and the research badges. node shots/batch5b.cjs [folder]
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
    s.time = 120; // mid-morning, spring
    const hub = w.hub;
    const x0 = hub.x - 4, y0 = hub.y + 9;
    for (let y = y0 - 1; y < y0 + 10; y++) for (let x = x0 - 1; x < x0 + 18; x++) { const i = w.idx(x, y); s.trees[i] = 0; s.resources[i] = 0; }
    const put = (type, x, y, dir = 0) => { const r = w.place(type, x, y, dir); return typeof r === 'object' ? r : null; };
    [1, 0.7, 0.45, 0.2].forEach((f, k) => { const wl = put('wall', x0 + k, y0); if (wl) wl.hp = w.maxHp(wl) * f; });
    [1, 0.5, 0.25, 0.05].forEach((f, k) => { const sp = put('spike_pit', x0 + 5 + k, y0); if (sp) sp.ammo = 60 * f; });
    // A second, third and fourth player, standing in a row.
    for (let k = 1; k < 4; k++) { const q = JSON.parse(JSON.stringify(s.players[0])); q.id = 100 + k; q.x = x0 + 1 + k; q.y = y0 + 3; s.players.push(q); }
    s.players[0].x = x0 + 1; s.players[0].y = y0 + 3;
    // A worn path, as if walked many times.
    const r = window.game.renderer;
    r.trodden = new Uint16Array(s.width * s.height);
    for (let x = x0; x < x0 + 12; x++) { r.trodden[w.idx(x, y0 + 6)] = 60; r.trodden[w.idx(x, y0 + 7)] = 20; }
    return { x: x0 + 6, y: y0 + 3, hub: [hub.x, hub.y] };
  }, ["iron_ore", "copper_ore", "stone", "iron_plate", "copper_ingot", "brick", "gear", "wire", "motor", "log", "plank", "stake", "dowel", "peg", "rope", "truss", "charcoal", "steel", "chitin", "iron_ingot", "iron_rod", "rivet", "steel_beam", "bearing", "sulfur", "gunpowder", "casing", "bullet", "shell", "ap_bullet", "he_shell", "circuit", "coil", "hub", "belt", "express_belt", "splitter", "tunnel", "extractor", "furnace", "workshop", "assembler", "turret", "cannon", "mortar", "artillery", "tesla", "ballista", "repair", "port", "wall", "reinforced_wall", "teleporter", "strike_beacon", "tree_nursery", "greenhouse", "shield_pylon", "railgun", "drone_pad", "arc_fence", "floodlight", "steel_wall", "lumber_camp", "sawmill", "blacksmith", "machine_shop", "circuit_works", "steel_works", "powder_mill", "shaft", "well", "water_wheel", "boiler", "steam_turbine", "power_pole", "palisade", "roller", "spike_pit", "trebuchet", "crate", "storage", "storage_silo", "shipyard"]);
  const cam = async (x, y, z) => { await p.evaluate(([x, y, z]) => { const c = window.game.camera; c.x = x; c.y = y; c.zoom = z; window.game.world.layout++; }, [x, y, z]); await p.waitForTimeout(400); };
  await cam(at.x, at.y, 48);
  await p.screenshot({ path: `${out}/b5b_day.png` });
  // Out by the forest in spring (blossom) and in summer (butterflies).
  const edge = await p.evaluate(() => { const w = window.game.world, s = w.state, h = w.hub; for (let r = 6; r < 60; r++) for (let dx = -r; dx <= r; dx++) { const x = h.x + dx, y = h.y - r; if (s.trees[w.idx(x, y)] && !s.trees[w.idx(x, y + 1)]) return [x, y]; } return [h.x, h.y]; });
  await cam(edge[0], edge[1] + 2, 30);
  await p.screenshot({ path: `${out}/b5b_spring.png` });
  await p.evaluate(() => { window.game.world.state.time = 4 * 540 + 120; window.game.world.layout++; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/b5b_summer.png` });
  // Night: the flowers closed.
  await p.evaluate(() => { window.game.world.state.time = 4 * 540 + 450; window.game.world.layout++; });
  await cam(at.x, at.y, 56);
  await p.screenshot({ path: `${out}/b5b_night.png` });
  // The research menu, with its badges.
  await p.evaluate(() => { window.game.world.state.time = 120; });
  await p.evaluate(() => document.querySelector('[data-action="research"]')?.click());
  await p.evaluate(([x, y]) => { window.game.ui.selected = window.game.world.hub.id; }, at.hub);
  await p.waitForTimeout(300);
  await p.evaluate(() => { const r = document.getElementById('research'); if (r) r.hidden = false; window.game.ui?.renderResearch?.(window.game.world); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/b5b_research.png` });
  await b.close();
})();
