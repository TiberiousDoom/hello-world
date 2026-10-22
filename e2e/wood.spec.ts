import { ALL_LESSONS, build, calm, cameraSettled, expect, newGame, settled, stepLabel, test, uncoveredTile } from './helpers';

test('wood: the lesson, trees blocking building, a lumber camp cutting trees, and a sawmill', async ({ page }, info) => {
  await newGame(page, { lessonsSeen: ALL_LESSONS.filter((l) => l !== 'forestry') });
  await calm(page);

  // Forestry unlocks the camp and sawmill, and starts the Wood lesson.
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.inventory = { iron_plate: 999, brick: 999 };
    w.researchNow('forestry');
  });
  await expect(stepLabel(page)).toHaveText(/^Wood · 1 of 4/);
  await expect(page.locator('[data-tool="lumber_camp"]')).toBeVisible();

  // A spot beside the trees nearest the hub, with room for the sawmill at the camp's output.
  const spot = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    const cx = w.hub.x + 2;
    const cy = w.hub.y + 2;
    let best: { x: number; y: number; tree: [number, number] } | null = null;
    let bestD = Infinity;
    for (let y = cy - 40; y < cy + 40; y++) {
      for (let x = cx - 40; x < cx + 40; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d >= bestD || w.checkPlace('lumber_camp', x, y, 0) || w.checkPlace('sawmill', x + 2, y, 0)) continue;
        const reach = w.treesInReach(x, y, 2, 2);
        if (!reach.trees.length) continue;
        const t = reach.trees[0];
        best = { x, y, tree: [t % s.width, Math.floor(t / s.width)] };
        bestD = d;
      }
    }
    return best;
  });
  expect(spot, 'room for a camp and sawmill beside some trees').not.toBeNull();

  // Trees are in the way of building.
  expect(await page.evaluate(([x, y]) => window.game.world.checkPlace('belt', x, y, 0), spot!.tree)).toBe('tree');

  await page.click('[data-tool="lumber_camp"]');
  await settled(page.locator('#tutorial .tip'));
  await cameraSettled(page);
  await build(page, info, ...(await uncoveredTile(page, spot!.x, spot!.y)));
  await expect.poll(() => page.evaluate(() => window.game.world.state.buildings.some((b: { type: string }) => b.type === 'lumber_camp'))).toBe(true);
  await expect(stepLabel(page)).toHaveText(/^Wood · 2 of 4/);

  // The camp cuts a tree into logs, leaving a stump (skipped ahead to just before its first cut).
  const camp = await page.evaluate(() => {
    const w = window.game.world;
    const b = w.state.buildings.find((b: { type: string }) => b.type === 'lumber_camp');
    b.progress = 2.9;
    return { id: b.id, x: b.x, y: b.y };
  });
  await page.click('.tip-next'); // the lesson's explanation pauses the game; this lets it run
  await expect.poll(() => page.evaluate(() => window.game.world.state.trees.some((t: number) => t === 2))).toBe(true);
  await expect(stepLabel(page)).toHaveText(/^Wood · 3 of 4/);

  // The sawmill goes at the camp's output.
  await page.click('[data-tool="sawmill"]');
  await settled(page.locator('#tutorial .tip'));
  await build(page, info, ...(await uncoveredTile(page, camp.x + 2, camp.y)));
  await expect.poll(() => page.evaluate(() => window.game.world.state.buildings.some((b: { type: string }) => b.type === 'sawmill'))).toBe(true);
  await expect(stepLabel(page)).toHaveText(/^Wood · 4 of 4/);
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();

  // The camp's panel shows its trees and stumps.
  await page.click('[data-tool="sawmill"]'); // put the tool down
  await page.evaluate((id) => (window.game.ui.selected = id), camp.id);
  await expect(page.locator('#info')).toContainText('Lumber Camp');
  await expect(page.locator('#info')).toContainText(/\d+ trees? in reach, \d+ stumps? growing back/);
});
