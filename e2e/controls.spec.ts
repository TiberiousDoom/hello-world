import { expect, newGame, test } from './helpers';

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
