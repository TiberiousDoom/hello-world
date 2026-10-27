import { calm, expect, newGame, test } from './helpers';

test('a furnace upgrades to Mk2 from its panel, and its panel says it needs electricity (D-122)', async ({ page }) => {
  await newGame(page);
  await calm(page);
  const id = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    s.researched.push('engineering', 'steelmaking', 'steel_works', 'steam_power', 'mk2');
    Object.assign(s.inventory, { steel_beam: 20, bearing: 20, motor: 10 });
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -2; dy <= 4; dy++) for (let dx = -2; dx <= 4; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    const f = w.place('furnace', x, y, 0);
    window.game.ui.selected = f.id;
    window.game.camera.x = x + 3;
    window.game.camera.y = y + 1;
    return f.id;
  });
  await expect(page.locator('#info [data-action="upgrade"]')).toBeVisible();
  await page.click('#info [data-action="upgrade"]');
  await expect.poll(() => page.evaluate((id) => window.game.world.byId.get(id)?.tier, id)).toBe(2);
  await expect(page.locator('#info [data-action="upgrade"]')).toHaveCount(0);
  await expect(page.locator('#info')).toContainText('no electricity');
});
