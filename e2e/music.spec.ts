import { expect, setProfile, test } from './helpers';

test.skip(({ isMobile }) => isMobile, 'one viewport is enough');

test('music: silent until a click, corporate on the menu, lo-fi in game, crossfades and volume', async ({ page }) => {
  await setProfile(page, { lessonsSeen: ['essentials'], tipsOff: true });
  await page.goto('/');
  const music = () => page.evaluate(() => window.game.music.state);
  await page.waitForTimeout(500);
  expect((await music()).track).toBeNull();

  await page.mouse.click(900, 600);
  await expect.poll(async () => (await music()).time, { timeout: 10_000 }).toBeGreaterThan(0.2);
  expect((await music()).track).toBe('corporate-background');

  await page.click('#mm-new');
  await page.click('[data-mode="standard"]');
  await expect.poll(async () => (await music()).mood).toBe('game');
  await expect.poll(async () => (await music()).time, { timeout: 10_000 }).toBeGreaterThan(0.2);
  const first = (await music()).track;
  expect(first).not.toBe('corporate-background');

  // Near the end of a track, the next one starts.
  await page.evaluate(() => {
    const el = window.game.music.current.el;
    el.currentTime = el.duration - 3;
  });
  await expect.poll(async () => (await music()).track, { timeout: 10_000 }).not.toBe(first);

  await page.click('#menu-btn');
  await page.locator('#music-volume').fill('20');
  await page.locator('#music-volume').dispatchEvent('change');
  expect((await music()).volume).toBe(0.2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('foundry-front-profile')!).musicVolume)).toBe(0.2);

  await page.click('#btn-mainmenu');
  await expect.poll(async () => (await music()).track, { timeout: 10_000 }).toBe('corporate-background');
});
