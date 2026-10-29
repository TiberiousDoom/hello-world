import { expect, test } from './helpers';

test.skip(({ isMobile }) => isMobile, 'one viewport is enough');

/** Average milliseconds to draw one frame of the big base, as the game would, `n` times. */
async function drawTime(page: import('@playwright/test').Page, n: number, zooming: boolean): Promise<number> {
  return page.evaluate(
    ([n, zooming]) => {
      const g = window.game;
      const z0 = g.camera.zoom;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        if (zooming) g.camera.zoom = z0 * (1 + 0.004 * i); // a pinch: a slightly different zoom every frame
        g.renderer.draw(g.world, g.ui, performance.now(), 1);
      }
      const ms = (performance.now() - t0) / n;
      g.camera.zoom = z0;
      return ms;
    },
    [n, zooming] as const,
  );
}

test('performance budget: a big base under attack draws and ticks in time', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.game?.playBench);
  await page.evaluate(() => window.game.playBench());
  await page.evaluate(() => window.game.artLoaded);
  await page.evaluate(() => (window.game.camera.zoom = 24));
  await drawTime(page, 10, false); // warm up the caches
  const still = await drawTime(page, 60, false);
  const zooming = await drawTime(page, 60, true);
  const tick = await page.evaluate(() => {
    const w = window.game.world;
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) w.tick(0.05);
    return (performance.now() - t0) / 100;
  });
  test.info().annotations.push({ type: 'perf', description: `draw ${still.toFixed(1)} ms, zooming ${zooming.toFixed(1)} ms, tick ${tick.toFixed(2)} ms` });
  console.log(`perf: draw ${still.toFixed(1)} ms, zooming ${zooming.toFixed(1)} ms, tick ${tick.toFixed(2)} ms`);
  // Headless Chromium draws without a GPU, so these are well above a real browser's. When set: about 20 ms
  // still and zooming alike; before, zooming repainted the ground every frame (about 40) and the night's
  // dark cost most of a frame.
  expect(still).toBeLessThan(60);
  expect(zooming).toBeLessThan(60);
  expect(tick).toBeLessThan(10);
});
