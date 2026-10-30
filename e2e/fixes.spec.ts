import { calm, expect, newGame, test } from './helpers';

test.skip(({ isMobile }) => isMobile, 'keyboard and menu behaviour: one viewport is enough');

test('shortcuts wait while a dialog is open: Space does nothing under the menu', async ({ page }) => {
  await newGame(page);
  await calm(page);
  const speed = () => page.evaluate(() => window.game.ui.speed);
  await page.click('#menu-btn');
  await expect(page.locator('#menu')).toBeVisible();
  const before = await speed();
  await page.keyboard.press(' ');
  expect(await speed()).toBe(before);
  await page.click('#btn-resume');
  await expect(page.locator('#menu')).toBeHidden();
  await page.evaluate(() => (window.game.ui.speed = 1));
  await page.keyboard.press(' ');
  await expect.poll(speed).toBe(0);
});

test('a new game starts with nothing in hand: no tool, no strike being aimed', async ({ page }) => {
  await newGame(page);
  await calm(page);
  await page.evaluate(() => {
    window.game.ui.tool = 'belt';
    window.game.ui.aiming = 1;
  });
  await page.click('#menu-btn');
  await page.click('#btn-new');
  await page.click('[data-mode="standard"]');
  await expect.poll(() => page.evaluate(() => [window.game.ui.tool, window.game.ui.aiming])).toEqual([null, null]);
});

test('Save says so when the browser refuses to store the game', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.click('#menu-btn');
  await page.click('#btn-save');
  await expect(page.locator('#toasts')).toContainText("couldn't be saved");
  await expect(page.locator('#toasts')).not.toContainText('Game saved.');
});

test('Settings opened from the pause menu goes back to it, however it is closed', async ({ page }) => {
  await newGame(page);
  for (const close of ['button', 'backdrop'] as const) {
    await page.click('#menu-btn');
    await page.click('#btn-settings');
    await expect(page.locator('#settings')).toBeVisible();
    if (close === 'button') await page.click('#settings [data-close]');
    else await page.mouse.click(15, 740);
    await expect(page.locator('#settings')).toBeHidden();
    await expect(page.locator('#menu')).toBeVisible();
    await page.click('#btn-resume');
    await expect(page.locator('#menu')).toBeHidden();
  }
});

test('the toolbar scrolls with the mouse wheel, and the Inventory button sits beside the tools, never over one', async ({ page }) => {
  await newGame(page);
  await calm(page);
  await page.evaluate(() => {
    const s = window.game.world.state;
    for (const id of ['forestry', 'workshop', 'rollers', 'palisades', 'carpentry', 'defense', 'defense2', 'shipyard', 'industry', 'blacksmith', 'hydraulics', 'logistics', 'machine_shop'])
      if (!s.researched.includes(id)) s.researched.push(id);
  });
  const strip = page.locator('#toolbar .tools');
  await expect.poll(() => strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const stripBox = (await strip.boundingBox())!;
  const pack = (await page.locator('#toolbar [data-tool="pack"]').boundingBox())!;
  expect(pack.x).toBeGreaterThanOrEqual(stripBox.x + stripBox.width);
  await page.mouse.move(stripBox.x + stripBox.width / 2, stripBox.y + stripBox.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  // The last tool can be scrolled fully into view, left of the Inventory button.
  await page.mouse.wheel(0, 10000);
  const last = (await page.locator('#toolbar .tools [data-tool="demolish"]').boundingBox())!;
  expect(last.x + last.width).toBeLessThanOrEqual(pack.x);
});

test("a trebuchet's panel shows its stone, and doesn't say it fires on electricity", async ({ page }) => {
  await newGame(page);
  await calm(page);
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.researched.push('workshop', 'rollers', 'palisades', 'carpentry', 'defense', 'defense2');
    Object.assign(w.state.inventory, { plank: 99, rope: 99, truss: 99, stone: 99 });
    const t = w.place('trebuchet', w.hub.x - 8, w.hub.y, 0);
    window.game.ui.selected = t.id;
  });
  await expect(page.locator('#info')).toContainText('Ammo 12 / 12');
  await expect(page.locator('#info')).not.toContainText('electricity');
});
