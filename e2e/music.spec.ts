import { expect, setProfile, test } from './helpers';

test.skip(({ isMobile }) => isMobile, 'one viewport is enough');

const GAME_TRACKS = ['morning-clearing', 'workshop-polka', 'firefly-lullaby', 'conveyor-jig', 'deep-woods', 'market-day', 'starlit-night'];

test('music: silent until a click, the menu theme flows into the game tracks and back, crossfades and volume', async ({ page }) => {
  await setProfile(page, { lessonsSeen: ['essentials'], tipsOff: true });
  await page.goto('/');
  const music = () => page.evaluate(() => window.game.music.state);
  /** Skips the playing track to just before its end, where the next one starts. */
  const nearEnd = () =>
    page.evaluate(() => {
      const el = window.game.music.current.el;
      el.currentTime = el.duration - 3;
    });
  await page.waitForTimeout(500);
  expect((await music()).track).toBeNull();

  await page.mouse.click(900, 600);
  await expect.poll(async () => (await music()).time, { timeout: 10_000 }).toBeGreaterThan(0.2);
  expect((await music()).track).toBe('menu-theme');

  // Starting a game doesn't cut the menu theme: it plays on, then a game track follows.
  await page.click('#mm-new');
  await page.click('[data-mode="standard"]');
  await expect.poll(async () => (await music()).mood).toBe('game');
  await page.waitForTimeout(500);
  expect((await music()).track).toBe('menu-theme');
  await nearEnd();
  await expect.poll(async () => (await music()).track, { timeout: 10_000 }).not.toBe('menu-theme');
  const first = (await music()).track!;
  expect(GAME_TRACKS).toContain(first);
  await expect.poll(async () => (await music()).time, { timeout: 10_000 }).toBeGreaterThan(0.2);

  // Near the end of a track, the next one starts.
  await nearEnd();
  await expect.poll(async () => (await music()).track, { timeout: 10_000 }).not.toBe(first);
  expect(GAME_TRACKS).toContain((await music()).track);

  await page.click('#menu-btn');
  await page.locator('#music-volume').fill('20');
  await page.locator('#music-volume').dispatchEvent('change');
  expect((await music()).volume).toBe(0.2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('foundry-front-profile')!).musicVolume)).toBe(0.2);

  // Back on the main menu, the game track finishes, then the menu theme returns.
  const playing = (await music()).track;
  await page.click('#btn-mainmenu');
  await expect.poll(async () => (await music()).mood).toBe('menu');
  expect((await music()).track).toBe(playing);
  await nearEnd();
  await expect.poll(async () => (await music()).track, { timeout: 10_000 }).toBe('menu-theme');
});
