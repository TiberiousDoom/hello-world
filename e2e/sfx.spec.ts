import { build, calm, expect, newGame, test, uncoveredTile } from './helpers';

test('sound effects: buttons click, building and research sound, the slider mutes them', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  const log = () => page.evaluate(() => [...window.game.sfx.log] as string[]);
  const clear = () => page.evaluate(() => (window.game.sfx.log.length = 0));

  await clear();
  await page.click('[data-tool="furnace"]');
  await expect.poll(log).toContain('click');

  // A furnace on clear ground next to the hub.
  const spot = await page.evaluate(() => {
    const w = window.game.world;
    const h = w.hub;
    for (let x = h.x - 4; x > h.x - 20; x--) if (!w.checkPlace('furnace', x, h.y + 2)) return [x, h.y + 2];
    return null;
  });
  expect(spot).not.toBeNull();
  await build(page, info, ...(await uncoveredTile(page, spot![0], spot![1])));
  await expect.poll(log).toContain('place_big');

  // Research is a milestone.
  await clear();
  await page.evaluate(() => window.game.world.state.researched.push('charcoal'));
  await expect.poll(log).toContain('research');

  // Zero volume: nothing plays.
  await page.click('#menu-btn');
  await page.click('#btn-settings');
  await page.locator('#sfx-volume').fill('0');
  await page.locator('#sfx-volume').dispatchEvent('change');
  await page.click('#settings [data-close]'); // back to the pause menu
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('foundry-front-profile')!).sfxVolume)).toBe(0);
  await clear();
  await page.click('#btn-resume');
  await page.evaluate(() => window.game.world.state.researched.push('defense'));
  await page.waitForTimeout(300);
  expect(await log()).toEqual([]);
});
