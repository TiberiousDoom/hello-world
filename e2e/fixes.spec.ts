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
  // The toolbar is rebuilt as the HUD updates: measure once it's settled, not mid-rebuild (a null box).
  const box = async (sel: string) => {
    let b = await page.locator(sel).boundingBox();
    await expect.poll(async () => (b = await page.locator(sel).boundingBox())).not.toBeNull();
    return b!;
  };
  const stripBox = await box('#toolbar .tools');
  const pack = await box('#toolbar [data-tool="pack"]');
  expect(pack.x).toBeGreaterThanOrEqual(stripBox.x + stripBox.width);
  await page.mouse.move(stripBox.x + stripBox.width / 2, stripBox.y + stripBox.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  // The last tool can be scrolled fully into view, left of the Inventory button.
  await page.mouse.wheel(0, 10000);
  const last = await box('#toolbar .tools [data-tool="demolish"]');
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

test('an error asks once whether to send reports; the answer is kept, and Settings changes it (D-173)', async ({ page }) => {
  await newGame(page);
  await calm(page);
  const profile = () => page.evaluate(() => JSON.parse(localStorage.getItem('foundry-front-profile')!).errorReports);
  const fail = (message: string) => page.evaluate((m) => window.dispatchEvent(new ErrorEvent('error', { message: m, filename: 'https://x/index.js', lineno: 7 })), message);

  await fail('something broke at tile 3,4');
  await expect(page.locator('#report-ask')).toBeVisible();
  await page.click('#report-yes');
  await expect(page.locator('#report-ask')).toBeHidden();
  expect(await profile()).toBe(true);
  const log = await page.evaluate(() => window.game.reports.log);
  expect(log).toHaveLength(1);
  expect(log[0].report).toMatchObject({ message: 'something broke at tile 3,4', where: 'index.js:7', game: 'standard, 0 min' });
  expect(log[0].sent).toBe(false); // never sent from a test: only from the game's own address

  // Another error doesn't ask again.
  await fail('another thing');
  await expect(page.locator('#report-ask')).toBeHidden();
  expect(await page.evaluate(() => window.game.reports.log.length)).toBe(2);

  // Settings switches it off.
  await page.click('#menu-btn');
  await page.click('#btn-settings');
  await expect(page.locator('#reports-toggle')).toBeChecked();
  await page.locator('#reports-toggle').uncheck();
  expect(await profile()).toBe(false);
});
