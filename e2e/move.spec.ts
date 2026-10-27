import { calm, cameraSettled, expect, newGame, tap, test, uncoveredTile } from './helpers';

test('Move picks a building up and puts it down where you tap, with what it holds (#76, #83)', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  const start = await page.evaluate(() => {
    const w = window.game.world;
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -2; dy <= 4; dy++) for (let dx = -2; dx <= 8; dx++) w.state.resources[w.idx(x + dx, y + dy)] = w.state.trees[w.idx(x + dx, y + dy)] = 0;
    const f = w.place('furnace', x, y, 0);
    f.outputs = ['iron_plate'];
    window.game.ui.selected = f.id;
    window.game.camera.x = x + 3;
    window.game.camera.y = y + 1;
    return { id: f.id, x, y };
  });
  await expect(page.locator('#info [data-action="move"]')).toBeVisible();
  await page.click('#info [data-action="move"]');
  expect(await page.evaluate(() => window.game.ui.tool)).toBe('furnace');
  await cameraSettled(page);
  await tap(page, info, ...(await uncoveredTile(page, start.x + 5, start.y)));
  await expect.poll(() => page.evaluate((id) => window.game.world.byId.get(id)?.x, start.id)).not.toBe(start.x);
  const moved = await page.evaluate(({ id, x, y }) => {
    const w = window.game.world;
    return { outputs: w.byId.get(id).outputs, tool: window.game.ui.tool, oldSpot: w.buildingAt(x, y)?.id ?? null };
  }, start);
  expect(moved.outputs).toEqual(['iron_plate']); // it kept what it held
  expect(moved.tool).toBeNull(); // the tool is put away
  expect(moved.oldSpot).toBeNull();
  // The hub has no Move button.
  await page.evaluate(() => (window.game.ui.selected = window.game.world.hub.id));
  await expect(page.locator('#info')).toContainText('Hub');
  await expect(page.locator('#info [data-action="move"]')).toHaveCount(0);
});
