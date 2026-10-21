import { ALL_LESSONS, expect, newGame, test } from './helpers';

test('a new game: first wave at 4:00, hub stock floats above the hub and pins to the edge', async ({ page }) => {
  await newGame(page);
  expect(await page.evaluate(() => window.game.world.state.nextWaveAt)).toBe(240);
  const stock = page.locator('#inventory');
  const box = (await stock.boundingBox())!;
  const [hx, hy] = await page.evaluate(() => {
    const h = window.game.world.hub;
    return window.game.camera.toScreen(h.x + 1.5, h.y);
  });
  expect(box.y + box.height).toBeLessThanOrEqual(hy + 1);
  expect(Math.abs(box.x + box.width / 2 - hx)).toBeLessThan(4);
  await expect(stock).not.toHaveClass(/edge/);

  await page.evaluate(() => (window.game.camera.x += 40));
  await expect(stock).toHaveClass(/edge/);
  await stock.click();
  await expect(stock).not.toHaveClass(/edge/);
});

test('the contract tracker shows what the contract needs', async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => {
    const s = window.game.world.state;
    s.nextWaveAt = 1e9;
    s.time = 29.9;
  });
  const tracker = page.locator('#contract-tracker');
  await expect(tracker).toBeVisible();
  await expect(tracker).toContainText(/0\s*\/\d+/);
  const [trackerBox, topbarBox] = [await tracker.boundingBox(), await page.locator('#topbar').boundingBox()];
  expect(trackerBox!.y).toBeGreaterThanOrEqual(topbarBox!.y + topbarBox!.height);
  await tracker.click();
  await expect(page.locator('#company')).toBeVisible();
});

test('the store lesson waits until its email is read', async ({ page }) => {
  await newGame(page, { lessonsSeen: ALL_LESSONS.filter((l) => l !== 'store') });
  await page.evaluate(() => {
    const s = window.game.world.state;
    s.nextWaveAt = 1e9;
    s.time = 29.9;
  });
  await expect.poll(() => page.evaluate(() => window.game.world.state.company.contract)).not.toBeNull();
  await page.evaluate(() => (window.game.world.state.time = window.game.world.state.company.contract.dueAt - 0.05));
  await expect.poll(() => page.evaluate(() => window.game.world.state.company.contract)).toBeNull();
  await page.waitForTimeout(400);
  await expect(page.locator('#tutorial')).toBeHidden();
  await page.evaluate(() => {
    window.game.world.state.company.inbox.find((m: { subject: string }) => m.subject.startsWith('The Company Store')).read = true;
  });
  await expect(page.locator('#tutorial .step')).toHaveText(/^Company Store/);
});
