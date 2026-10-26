import { ALL_LESSONS, build, calm, cameraSettled, expect, newGame, settled, stepLabel, tap, test, tilePoint, uncoveredTile } from './helpers';

test('build the supply ship, load and launch it, deliver the first run, and keep building', async ({ page }, info) => {
  await newGame(page, { lessonsSeen: ALL_LESSONS.filter((l) => l !== 'shipyard') });
  await calm(page);

  // The shipyard is researched.
  const spot = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    s.inventory = { iron_plate: 999, brick: 999, plank: 999, log: 999, truss: 999, rope: 999 };
    s.researched.push('workshop', 'carpentry', 'shipyard');
    const x = w.hub.x - 22;
    const y = w.hub.y + 1;
    // The site staked out for the shipyard (D-109), on ground cleared of ore and trees.
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    s.shipSite = { x: x - 2, y: y - 2 };
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
  expect(yard).toEqual({ x: spot.x - 2, y: spot.y - 2 }); // on its site
  await page.click('.tip-next');
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();

  // Put the tool down, feed the first stage partly, and check the panel.
  await page.click('[data-tool="shipyard"]');
  await page.evaluate(() => {
    const w = window.game.world;
    const b = w.state.buildings.find((b: { type: string }) => b.type === 'shipyard');
    for (let i = 0; i < 10; i++) w.insert(b, 'plank', b.x - 1, b.y);
  });
  await page.mouse.click(...(await tilePoint(page, spot.x, spot.y)));
  await expect(page.locator('#info')).toContainText('Belt in:');
  await expect(page.locator('#info')).toContainText('10/150');

  // The side view shows the scaffolding under way and the rest still to come.
  await page.click('#info [data-action="ship-view"]');
  await expect(page.locator('#ship-view')).toBeVisible();
  await expect(page.locator('#ship-view .ship-stages li.now')).toContainText('Scaffolding');
  await expect(page.locator('#ship-view .ship-side')).toBeVisible();
  await page.click('#ship-view [data-close]');
  await expect(page.locator('#ship-view')).toBeHidden();

  // Finish every stage: the cargo list appears.
  await page.evaluate(() => {
    const w = window.game.world;
    const b = w.state.buildings.find((b: { type: string }) => b.type === 'shipyard');
    const stages = [
      { plank: 150, truss: 40, rope: 60 },
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

  // The colony offers two blueprints; the game waits for a pick.
  await expect(page.locator('#blueprints')).toBeVisible();
  await expect(page.locator('#blueprint-choices button')).toHaveCount(2);
  expect(await page.evaluate(() => window.game.ui.speed)).toBe(0);
  await page.click('[data-blueprint="express_belt"]');
  await expect(page.locator('#blueprints')).toBeHidden();
  expect(await page.evaluate(() => window.game.world.state.ship.blueprints)).toEqual(['express_belt']);
  await expect(page.locator('[data-tool="express_belt"]')).toBeVisible();
  const ship = await page.evaluate(() => ({ ...window.game.world.state.ship, yards: window.game.world.state.buildings.filter((b: { type: string }) => b.type === 'shipyard').length }));
  expect(ship.runs).toBe(1);
  expect(ship.returnAt).not.toBeNull();
  expect(ship.yards).toBe(1); // the shipyard stays for the next run
  const t = await page.evaluate(() => window.game.world.state.time);
  await expect.poll(() => page.evaluate(() => window.game.world.state.time)).toBeGreaterThan(t); // the game runs again
  expect(await page.evaluate(() => window.game.music.state.mood)).toBe('game');
  await page.mouse.click(...(await tilePoint(page, spot.x, spot.y)));
  await expect(page.locator('#info')).toContainText('away at the colony');

  // One tap or click with the Express Belt upgrades a whole belt line: no blueprint, no drag.
  const belts = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    s.inventory.gear = 50;
    s.inventory.iron_plate = 50;
    const y = w.hub.y - 6;
    const x0 = w.hub.x - 4;
    for (let i = 0; i < 6; i++) {
      s.resources[w.idx(x0 + i, y)] = 0;
      s.trees[w.idx(x0 + i, y)] = 0;
      w.place('belt', x0 + i, y, 0);
    }
    return { x0, y };
  });
  await page.click('[data-tool="express_belt"]');
  await tap(page, info, ...(await uncoveredTile(page, belts.x0 + 2, belts.y)));
  await expect
    .poll(() =>
      page.evaluate(({ x0, y }) => [0, 1, 2, 3, 4, 5].map((i) => window.game.world.buildingAt(x0 + i, y)?.type), belts),
    )
    .toEqual(Array(6).fill('express_belt'));
  expect(await page.evaluate(() => window.game.ui.plan)).toBeNull();
});
