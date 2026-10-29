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
