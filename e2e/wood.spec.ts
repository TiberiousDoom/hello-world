import { ALL_LESSONS, build, buildTile, calm, cameraSettled, expect, newGame, settled, stepLabel, test, uncoveredTile } from './helpers';

test('wood: trees blocking building, a lumber camp cutting trees, and a sawmill', async ({ page }, info) => {
  await newGame(page, { fresh: true });
  await calm(page);

  // Forestry, paid in logs, unlocks the camp and sawmill (D-093).
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.inventory = { log: 999 };
    w.researchNow('forestry');
  });
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
  await cameraSettled(page);
  await build(page, info, ...(await uncoveredTile(page, spot!.x, spot!.y)));
  await expect.poll(() => page.evaluate(() => window.game.world.state.buildings.some((b: { type: string }) => b.type === 'lumber_camp'))).toBe(true);

  // The camp cuts a tree into logs, leaving a stump (skipped ahead to just before its first cut).
  const camp = await page.evaluate(() => {
    const w = window.game.world;
    const b = w.state.buildings.find((b: { type: string }) => b.type === 'lumber_camp');
    b.progress = 2.9;
    return { id: b.id, x: b.x, y: b.y };
  });
  await expect.poll(() => page.evaluate(() => window.game.world.state.trees.some((t: number) => t === 2))).toBe(true);

  // The sawmill goes at the camp's output.
  await page.click('[data-tool="sawmill"]');
  await build(page, info, ...(await uncoveredTile(page, camp.x + 2, camp.y)));
  await expect.poll(() => page.evaluate(() => window.game.world.state.buildings.some((b: { type: string }) => b.type === 'sawmill'))).toBe(true);

  // The camp's panel shows its trees and stumps.
  await page.click('[data-tool="sawmill"]'); // put the tool down
  await page.evaluate((id) => (window.game.ui.selected = id), camp.id);
  await expect(page.locator('#info')).toContainText('Lumber Camp');
  await expect(page.locator('#info')).toContainText(/\d+ trees? in reach, \d+ stumps? growing back/);
});

test('wooden parts: Workshops starts its lesson, a workshop goes up, and it makes rope from logs (D-105)', async ({ page }, info) => {
  await newGame(page, { fresh: true, lessonsSeen: ALL_LESSONS.filter((l) => l !== 'workshop') });
  await calm(page);
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.inventory = { log: 999, plank: 999 };
    w.researchNow('forestry');
    w.researchNow('workshop');
  });
  await expect(stepLabel(page)).toHaveText(/^Wooden parts · 1 of 3/);
  await page.click('[data-tool="workshop"]');
  await settled(page.locator('#tutorial .tip'));
  // Open ground near the hub.
  const spot = await page.evaluate(() => {
    const w = window.game.world;
    for (let d = 8; d < 40; d++) for (let dy = -d; dy <= d; dy++) if (!w.checkPlace('workshop', w.hub.x - d, w.hub.y + dy, 0)) return [w.hub.x - d, w.hub.y + dy] as [number, number];
    return null;
  });
  expect(spot).not.toBeNull();
  await buildTile(page, info, ...spot!);
  await expect(stepLabel(page)).toHaveText(/^Wooden parts · 2 of 3/);
  await page.click('.tip-next');
  await expect(stepLabel(page)).toHaveText(/^Wooden parts · 3 of 3/);
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();
  // Logs in make rope.
  const ropes = await page.evaluate(() => {
    const w = window.game.world;
    const b = w.state.buildings.find((b: { type: string }) => b.type === 'workshop');
    w.insert(b, 'log', b.x - 1, b.y);
    w.insert(b, 'log', b.x - 1, b.y);
    return b.recipe;
  });
  expect(ropes).toBe('rope');
});

test('rollers: Basic Logistics starts its lesson, and three rollers carry a log to the hub (D-106)', async ({ page }, info) => {
  await newGame(page, { fresh: true, lessonsSeen: ALL_LESSONS.filter((l) => l !== 'rollers') });
  await calm(page);
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.inventory = { log: 999, plank: 999, dowel: 999, peg: 999 };
    w.researchNow('forestry');
    w.researchNow('rollers');
  });
  await expect(stepLabel(page)).toHaveText(/^Rollers · 1 of 2/);
  await page.click('[data-tool="roller"]');
  await settled(page.locator('#tutorial .tip'));
  // Three rollers into the hub's west side, one at a time.
  const row = await page.evaluate(() => {
    const w = window.game.world;
    return [3, 2, 1].map((d) => [w.hub.x - d, w.hub.y + 2] as [number, number]);
  });
  for (const [x, y] of row) await buildTile(page, info, x, y);
  await expect(stepLabel(page)).toHaveText(/^Rollers · 2 of 2/);
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();
  // A log put on the first roller reaches the hub.
  const before = await page.evaluate(() => window.game.world.state.inventory.log ?? 0);
  await page.evaluate(([x, y]) => {
    const w = window.game.world;
    w.insert(w.buildingAt(x, y), 'log', x - 1, y);
  }, row[0]);
  await expect.poll(() => page.evaluate(() => window.game.world.state.inventory.log ?? 0), { timeout: 15000 }).toBe(before + 1);
});

test('wooden defences: a spike pit and a trebuchet go up, and their panels show what they hold (D-107)', async ({ page }, info) => {
  await newGame(page, { fresh: true });
  await calm(page);
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.inventory = { plank: 999, stake: 999, rope: 999, truss: 99, stone: 99 };
    w.state.researched.push('forestry', 'rollers', 'workshop', 'carpentry', 'palisades', 'defense2');
  });
  const spot = await page.evaluate(() => {
    const w = window.game.world;
    for (let d = 8; d < 40; d++)
      for (let dy = -d; dy <= d; dy++)
        if (!w.checkPlace('trebuchet', w.hub.x - d, w.hub.y + dy, 0) && !w.checkPlace('spike_pit', w.hub.x - d - 2, w.hub.y + dy, 0)) return [w.hub.x - d, w.hub.y + dy] as [number, number];
    return null;
  });
  expect(spot).not.toBeNull();
  await page.click('[data-tool="trebuchet"]');
  await buildTile(page, info, ...spot!);
  await page.click('[data-tool="spike_pit"]');
  await buildTile(page, info, spot![0] - 2, spot![1]);
  await page.click('[data-tool="spike_pit"]'); // put the tool down
  const ids = await page.evaluate(([x, y]) => [window.game.world.buildingAt(x, y).id, window.game.world.buildingAt(x - 2, y).id], spot!);
  await page.evaluate((id) => (window.game.ui.selected = id), ids[0]);
  await expect(page.locator('#info')).toContainText('Trebuchet');
  await expect(page.locator('#info')).toContainText('Ammo 12 / 12');
  await page.evaluate((id) => (window.game.ui.selected = id), ids[1]);
  await expect(page.locator('#info')).toContainText('Spike Pit');
  await expect(page.locator('#info')).toContainText('Spikes 60 / 60');
});
