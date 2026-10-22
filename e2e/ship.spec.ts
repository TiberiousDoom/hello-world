import { ALL_LESSONS, build, calm, cameraSettled, expect, newGame, settled, stepLabel, test, tilePoint, uncoveredTile } from './helpers';

test('build the supply ship, load and launch it, deliver the first run, and keep building', async ({ page }, info) => {
  await newGame(page, { lessonsSeen: ALL_LESSONS.filter((l) => l !== 'shipyard') });
  await calm(page);

  // The shipyard is researched.
  const spot = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    s.inventory = { iron_plate: 999, brick: 999 };
    s.researched.push('defense', 'workshop', 'assembly', 'shipyard');
    const x = w.hub.x - 22;
    const y = w.hub.y + 1;
    // Clear ore and trees (forest can start 20 tiles out) under the shipyard.
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    window.game.camera.x = x + 0.5;
    window.game.camera.y = y + 0.5;
    return { x, y };
  });

  await expect(stepLabel(page)).toHaveText(/^The supply ship/);
  await page.click('[data-tool="shipyard"]');
  await settled(page.locator('#tutorial .tip')); // the card moves once the tool is picked
  await cameraSettled(page);
  await build(page, info, ...(await uncoveredTile(page, spot.x, spot.y)));
  await expect.poll(() => page.evaluate(() => window.game.world.state.buildings.some((b: { type: string }) => b.type === 'shipyard'))).toBe(true);
  await expect(stepLabel(page)).toHaveText(/2 of 3/);
  const yard = await page.evaluate(() => {
    const b = window.game.world.state.buildings.find((b: { type: string }) => b.type === 'shipyard');
    return { x: b.x, y: b.y };
  });
  expect(yard).toEqual({ x: spot.x - 1, y: spot.y - 1 }); // centred on the tap
  await page.click('.tip-next');
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();

  // Put the tool down, feed the first stage partly, and check the panel.
  await page.click('[data-tool="shipyard"]');
  await page.evaluate(() => {
    const w = window.game.world;
    const b = w.state.buildings.find((b: { type: string }) => b.type === 'shipyard');
    for (let i = 0; i < 10; i++) w.insert(b, 'iron_plate', b.x - 1, b.y);
  });
  await page.mouse.click(...(await tilePoint(page, spot.x, spot.y)));
  await expect(page.locator('#info')).toContainText('Belt in:');
  await expect(page.locator('#info')).toContainText('10/150');

  // Finish every stage: the cargo list appears.
  await page.evaluate(() => {
    const w = window.game.world;
    const b = w.state.buildings.find((b: { type: string }) => b.type === 'shipyard');
    const stages = [
      { iron_plate: 150, brick: 80 },
      { motor: 30, gear: 80 },
      { wire: 120, copper_ingot: 60 },
      { motor: 20, wire: 80, gear: 40 },
    ];
    for (const st of stages) for (const [item, n] of Object.entries(st)) for (let i = 0; i < n; i++) w.insert(b, item, b.x - 1, b.y);
  });
  await expect(page.locator('#info')).toContainText('Cargo for run 1');
  await expect(page.locator('#info [data-action="launch"]')).toHaveCount(0);

  // Load the cargo: the Launch button appears.
  await page.evaluate(() => {
    const w = window.game.world;
    const b = w.state.buildings.find((b: { type: string }) => b.type === 'shipyard');
    for (const [item, n] of Object.entries({ iron_plate: 100, brick: 60, copper_ingot: 40 })) for (let i = 0; i < n; i++) w.insert(b, item, b.x - 1, b.y);
  });
  await expect(page.locator('#info')).toContainText('Loaded and ready');
  await page.click('#info [data-action="launch"]');
  await expect(page.locator('#launch-banner')).toBeVisible();
  await expect(page.locator('#launch-banner')).toContainText('Lift-off in');
  expect(await page.evaluate(() => window.game.world.state.ship.launchAt)).not.toBeNull();

  // Hold out until lift-off (skipped ahead).
  await page.evaluate(() => {
    const s = window.game.world.state;
    s.ship.launchAt = s.time + 0.3;
  });
  // The first delivery gets its own screen, which pauses the game.
  await expect(page.locator('#victory')).toBeVisible();
  await expect(page.locator('#victory')).toContainText('Supplies delivered');
  await expect(page.locator('#victory-stats')).toContainText('Supply runs delivered');
  await expect(page.locator('#launch-banner')).toBeHidden();
  expect(await page.evaluate(() => window.game.music.state.mood)).toBe('win');
  expect(await page.evaluate(() => window.game.ui.speed)).toBe(0);

  await page.click('#btn-keep-playing');
  await expect(page.locator('#victory')).toBeHidden();
  const ship = await page.evaluate(() => ({ ...window.game.world.state.ship, yards: window.game.world.state.buildings.filter((b: { type: string }) => b.type === 'shipyard').length }));
  expect(ship.runs).toBe(1);
  expect(ship.returnAt).not.toBeNull();
  expect(ship.yards).toBe(1); // the shipyard stays for the next run
  const t = await page.evaluate(() => window.game.world.state.time);
  await expect.poll(() => page.evaluate(() => window.game.world.state.time)).toBeGreaterThan(t); // the game runs again
  expect(await page.evaluate(() => window.game.music.state.mood)).toBe('game');
  await page.mouse.click(...(await tilePoint(page, spot.x, spot.y)));
  await expect(page.locator('#info')).toContainText('away at the colony');
});
