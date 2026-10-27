import { calm, expect, newGame, test, uncoveredTile } from './helpers';

test.skip(({ isMobile }) => isMobile, 'mouse and keyboard controls');

test('wheel, right-click and menu backdrops', async ({ page }) => {
  await newGame(page);
  const zoom = () => page.evaluate(() => window.game.camera.zoom);
  await page.mouse.move(550, 380);

  let z0 = await zoom();
  await page.mouse.wheel(0, -120);
  await expect.poll(zoom).toBeGreaterThan(z0);

  // With a tool the wheel rotates, and small trackpad deltas add up.
  await page.click('[data-tool="belt"]');
  await page.mouse.move(550, 380);
  z0 = await zoom();
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => window.game.ui.dir)).toBe(2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 10);
  await expect.poll(() => page.evaluate(() => window.game.ui.dir)).toBe(3);
  expect(await zoom()).toBe(z0);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await expect.poll(zoom).toBeGreaterThan(z0);

  // Right-drag pans and keeps the tool; right-click clears it.
  const x0 = await page.evaluate(() => window.game.camera.x);
  await page.mouse.move(500, 380);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(400, 380, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  expect(await page.evaluate(() => window.game.camera.x)).not.toBe(x0);
  expect(await page.evaluate(() => window.game.ui.tool)).toBe('belt');
  await page.mouse.click(500, 380, { button: 'right' });
  expect(await page.evaluate(() => window.game.ui.tool)).toBeNull();

  // Selecting the hub; right-click clears the selection.
  const hub = await page.evaluate(() => {
    const h = window.game.world.hub;
    return window.game.camera.toScreen(h.x + 2.5, h.y + 2.5) as [number, number];
  });
  await page.mouse.click(...hub);
  expect(await page.evaluate(() => window.game.ui.selected)).not.toBeNull();
  await page.mouse.click(...hub, { button: 'right' });
  expect(await page.evaluate(() => window.game.ui.selected)).toBeNull();

  // With a tool in hand, clicking a different kind of building selects it and puts the tool down.
  await page.click('[data-tool="belt"]');
  await page.mouse.click(...hub);
  expect(await page.evaluate(() => window.game.ui.tool)).toBeNull();
  expect(await page.evaluate(() => window.game.world.byId.get(window.game.ui.selected)?.type)).toBe('hub');

  // Menus close on a backdrop click, not on a click inside.
  await page.click('#info [data-action="research"]');
  await page.locator('#research h2').click();
  await expect(page.locator('#research')).toBeVisible();
  await page.mouse.click(15, 740);
  await expect(page.locator('#research')).toBeHidden();
  await page.click('#menu-btn');
  await page.mouse.click(15, 740);
  await expect(page.locator('#menu')).toBeHidden();
});

test('holding the mouse button on bare ore keeps mining it by hand', async ({ page }) => {
  await newGame(page, { fresh: true });
  await calm(page);
  const tile = await page.evaluate(() => {
    const w = window.game.world;
    const x = w.hub.x - 6;
    const y = w.hub.y + 2;
    w.state.resources[w.idx(x, y)] = 3; // stone
    w.state.trees[w.idx(x, y)] = 0;
    const p = w.state.players[0]; // the engineer stands next to it
    p.x = x + 1.5;
    p.y = y + 0.5;
    return [x, y] as [number, number];
  });
  const [px, py] = await uncoveredTile(page, ...tile);
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.waitForTimeout(2600);
  await page.mouse.up();
  // Four taps a second: eight taps (one stone) in about two seconds.
  await expect
    .poll(() => page.evaluate(() => window.game.world.state.players[0].slots.reduce((n: number, s: { item: string; n: number } | null) => n + (s?.item === 'stone' ? s.n : 0), 0)))
    .toBeGreaterThanOrEqual(1);
  const taps = await page.evaluate(() => window.game.world.handMiningAt(window.game.world.hub.x - 6, window.game.world.hub.y + 2));
  expect(taps).toBeLessThan(8);
});

test('the engineer walks where you click on empty ground, and with WASD or the arrow keys', async ({ page }) => {
  await newGame(page);
  await calm(page);
  const pos = () => page.evaluate(() => [window.game.world.state.players[0].x, window.game.world.state.players[0].y] as [number, number]);
  const [x0, y0] = await pos();
  const target = await page.evaluate(() => {
    const w = window.game.world;
    for (let dx = -12; dx >= -20; dx--) {
      const x = w.hub.x + dx;
      const y = w.hub.y + 8;
      if (!w.buildingAt(x, y) && !w.resourceAt(x, y) && w.treeAt(x, y) !== 1) return [x, y] as [number, number];
    }
    return null;
  });
  expect(target).not.toBeNull();
  await page.mouse.click(...(await uncoveredTile(page, ...target!)));
  await expect.poll(pos, { timeout: 15000 }).toEqual([target![0] + 0.5, target![1] + 0.5]);

  const [x1] = await pos();
  await page.keyboard.down('d');
  await page.waitForTimeout(600);
  await page.keyboard.up('d');
  const [x2, y2] = await pos();
  expect(x2).toBeGreaterThan(x1);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');
  expect((await pos())[1]).toBeLessThan(y2);
  expect([x0, y0]).not.toEqual(await pos());
});
