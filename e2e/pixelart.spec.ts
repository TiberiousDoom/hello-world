import { ALL_LESSONS, expect, isTouch, setProfile, test } from './helpers';

// The pixel art test (D-186): a setting that draws the bugs with pixel art, keeps pixels sharp and zooms in steps.
test('the pixel art test draws pixel bugs and zooms in whole steps', async ({ page }, info) => {
  await setProfile(page, { lessonsSeen: ALL_LESSONS, tipsOff: true });
  await page.goto('/');
  await page.click('#mm-settings');
  await page.locator('#pixel-toggle').setChecked(true);
  expect(await page.evaluate(() => window.game.renderer.pixelArt)).toBe(true);
  await page.click('#settings [data-close]');
  await page.click('#mm-new');
  await page.click('[data-mode="standard"]');
  await expect(page.locator('#mainmenu')).toBeHidden();

  // Every zoom is a whole number of 16-pixel steps on the screen, so each art pixel covers whole screen pixels.
  // Pixel art draws at the screen's own density, up to 3×.
  const screenPerTile = () => page.evaluate(() => window.game.camera.zoom * Math.min(window.devicePixelRatio || 1, 3));
  const whole = (v: number) => Math.abs(v / 16 - Math.round(v / 16)) < 1e-6;
  expect(whole(await screenPerTile())).toBe(true);
  if (!isTouch(info)) {
    const before = await screenPerTile();
    await page.mouse.move(400, 300);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120);
    await expect.poll(screenPerTile).toBeGreaterThan(before);
    expect(whole(await screenPerTile())).toBe(true);
  }

  // One of each bug with pixel art, in view and turned every which way: they draw without errors.
  await page.evaluate(async () => {
    const g = window.game;
    await g.artLoaded;
    const s = g.world.state;
    const nest = s.nests[0].id;
    ['crawler', 'brute', 'wasp', 'beetle', 'runner'].forEach((type, i) => {
      const [x, y] = [g.camera.x - 3 + i * 1.5, g.camera.y + 2];
      s.enemies.push({ id: s.nextId++, type, x, y, hp: 50, maxHp: 50, nest, tx: x + 1, ty: y - 1, wait: 0 } as never);
    });
  });
  await page.waitForTimeout(600);

  // The setting is kept.
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nestfall-profile')!).pixelArt)).toBe(true);
  expect(await page.evaluate(() => window.game.renderer.pixelArt)).toBe(true);
  await expect(page.locator('#pixel-toggle')).toBeChecked();
});
