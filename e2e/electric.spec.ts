import { calm, expect, newGame, tap, test, uncoveredTile } from './helpers';

test('Electric Defense: the toolbar has the tesla, arc fence and floodlight, and their panels say they need electricity (D-126)', async ({ page }) => {
  await newGame(page);
  await calm(page);
  await page.evaluate(() => {
    const s = window.game.world.state;
    s.researched.push('engineering', 'steelmaking', 'steam_power', 'electronics', 'circuit_works', 'electric_defense');
    Object.assign(s.inventory, { steel: 99, circuit: 20, coil: 20, wire: 99, iron_rod: 99 });
  });
  for (const t of ['tesla', 'arc_fence', 'floodlight']) await expect(page.locator(`[data-tool="${t}"]`)).toBeVisible();
  const placed = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -2; dy <= 4; dy++) for (let dx = -2; dx <= 6; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    window.game.camera.x = x + 2;
    window.game.camera.y = y;
    return ['tesla', 'arc_fence', 'floodlight'].map((t, i) => w.place(t, x + 2 * i, y, 0).id as number);
  });
  for (const [id, text] of [
    [placed[0], "it can't fire"],
    [placed[1], "it doesn't shock"],
    [placed[2], "it's dark"],
  ] as const) {
    await page.evaluate((id) => (window.game.ui.selected = id), id);
    await expect(page.locator('#info')).toContainText(text);
  }
  // The tesla needs no ammunition, and takes no items.
  await page.evaluate((id) => (window.game.ui.selected = id), placed[0]);
  await expect(page.locator('#info')).toContainText('No ammunition needed');
});

test('an assembler upgrades to Mk3 from its panel, and its panel says it needs electricity (D-127)', async ({ page }) => {
  await newGame(page);
  await calm(page);
  const id = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    s.researched.push('assembly', 'electronics', 'circuit_works', 'mk2', 'mk3');
    Object.assign(s.inventory, { gear: 20, wire: 20, circuit: 20, coil: 20, steel_beam: 20 });
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -2; dy <= 4; dy++) for (let dx = -2; dx <= 4; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    const a = w.place('assembler', x, y, 0);
    window.game.ui.selected = a.id;
    window.game.camera.x = x + 3;
    window.game.camera.y = y + 1;
    return a.id;
  });
  await expect(page.locator('#info [data-action="upgrade"]')).toContainText('Mk3');
  await page.click('#info [data-action="upgrade"]');
  await expect.poll(() => page.evaluate((id) => window.game.world.byId.get(id)?.tier, id)).toBe(3);
  await expect(page.locator('#info [data-action="upgrade"]')).toHaveCount(0);
  await expect(page.locator('#info')).toContainText('Mk3: no electricity');
});

test('a drone pad switches between sending and receiving an item from its panel (D-128)', async ({ page }) => {
  await newGame(page);
  await calm(page);
  await expect(page.locator('[data-tool="drone_pad"]')).toHaveCount(0);
  const id = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    s.researched.push('electronics', 'circuit_works', 'drones');
    Object.assign(s.inventory, { circuit: 20, motor: 20, steel_beam: 20 });
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    const p = w.place('drone_pad', x, y, 0);
    window.game.ui.selected = p.id;
    window.game.camera.x = x + 3;
    window.game.camera.y = y;
    return p.id;
  });
  await expect(page.locator('[data-tool="drone_pad"]')).toBeVisible();
  await expect(page.locator('#info')).toContainText('Sends: holds empty');
  await page.click('#info [data-action="filter"][data-item="iron_plate"]');
  await expect.poll(() => page.evaluate((id) => window.game.world.byId.get(id)?.filter, id)).toBe('iron_plate');
  await expect(page.locator('#info')).toContainText('Receives');
  await page.click('#info [data-action="filter"][data-item=""]');
  await expect.poll(() => page.evaluate((id) => window.game.world.byId.get(id)?.filter, id)).toBeNull();
});

test('Electric Defense 2: the shield pylon and railgun are on the toolbar, and the pylon shows its shield (D-129)', async ({ page }) => {
  await newGame(page);
  await calm(page);
  const id = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    s.researched.push('electronics', 'circuit_works', 'electric_defense', 'electric_defense2');
    Object.assign(s.inventory, { circuit: 20, coil: 20, steel_beam: 40, bearing: 10 });
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 4; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    w.place('railgun', x + 2, y, 0);
    const p = w.place('shield_pylon', x, y, 0);
    window.game.ui.selected = p.id;
    window.game.camera.x = x + 3;
    window.game.camera.y = y;
    return p.id;
  });
  for (const t of ['railgun', 'shield_pylon']) await expect(page.locator(`[data-tool="${t}"]`)).toBeVisible();
  await expect(page.locator('#info')).toContainText('Shield 0 / 600');
  await expect(page.locator('#info')).toContainText("it doesn't recharge");
  expect(await page.evaluate((id) => window.game.world.byId.get(id)?.type, id)).toBe('shield_pylon');
});

test('a charged strike beacon calls a strike on the spot tapped next (D-131)', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  const { id, x, y } = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    s.ship.blueprints.push('strike_beacon');
    Object.assign(s.inventory, { circuit: 40, coil: 20, steel: 40 });
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    const b = w.place('strike_beacon', x, y, 0);
    b.ammo = 540; // charged
    window.game.ui.selected = b.id;
    return { id: b.id as number, x, y };
  });
  await expect(page.locator('[data-tool="strike_beacon"]')).toBeVisible();
  await page.click('#info [data-action="strike"]');
  expect(await page.evaluate(() => window.game.ui.aiming)).toBe(id);
  const [sx, sy] = await uncoveredTile(page, x - 6, y);
  await tap(page, info, sx, sy);
  await expect.poll(() => page.evaluate((id) => window.game.world.byId.get(id)?.ammo, id)).toBe(0);
  expect(await page.evaluate(() => window.game.ui.aiming)).toBeNull();
});
