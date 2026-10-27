import { calm, expect, newGame, test } from './helpers';

test('Electric Defense: the toolbar has the tesla, arc fence and floodlight, and their panels say they need electricity (D-126)', async ({ page }) => {
  await newGame(page);
  await calm(page);
  await page.evaluate(() => {
    const s = window.game.world.state;
    s.researched.push('engineering', 'steelmaking', 'steam_power', 'electronics', 'circuit_works', 'electric_defense');
    Object.assign(s.inventory, { steel: 99, circuit: 20, coil: 20, wire: 99, iron_rod: 99 });
  });
  for (const t of ['tesla', 'arc_fence', 'floodlight']) await expect(page.locator(`[data-tool="${t}"]`)).toBeVisible();
  const placed = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -2; dy <= 4; dy++) for (let dx = -2; dx <= 6; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    window.game.camera.x = x + 2;
    window.game.camera.y = y;
    return ['tesla', 'arc_fence', 'floodlight'].map((t, i) => w.place(t, x + 2 * i, y, 0).id as number);
  });
  for (const [id, text] of [
    [placed[0], "it can't fire"],
    [placed[1], "it doesn't shock"],
    [placed[2], "it's dark"],
  ] as const) {
    await page.evaluate((id) => (window.game.ui.selected = id), id);
    await expect(page.locator('#info')).toContainText(text);
  }
  // The tesla needs no ammunition, and takes no items.
  await page.evaluate((id) => (window.game.ui.selected = id), placed[0]);
  await expect(page.locator('#info')).toContainText('No ammunition needed');
});
