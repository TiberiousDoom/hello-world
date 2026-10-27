import { Page } from '@playwright/test';
import { calm, expect, newGame, test } from './helpers';

// The engineer's inventory (#87, D-090): 12 slots of 10, a toolbar button at the bottom right, a switch
// for dropping off at the hub, and Pick up on belts.

const stone = (page: Page) => page.evaluate(() => window.game.world.state.players[0].slots.reduce((n: number, s: { item: string; n: number } | null) => n + (s?.item === 'stone' ? s.n : 0), 0));

test('the Inventory button shows the slots, drop-off at the hub can be switched off, and a belt offers Pick up', async ({ page }) => {
  await newGame(page);
  await calm(page);
  await page.evaluate(() => {
    const w = window.game.world;
    const p = w.state.players[0];
    // Away from the hub, which would take everything (drop-off is on to begin with).
    p.x = w.hub!.x - 6 + 0.5;
    p.y = w.hub!.y + 8 + 0.5;
    p.slots[0] = { item: 'stone', n: 7 };
    p.slots[1] = { item: 'iron_ore', n: 10 };
  });

  // At the bottom right of the screen, with how full it is.
  const btn = page.locator('#toolbar [data-tool="pack"]');
  await expect(btn).toContainText('17/120');
  const box = (await btn.boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x + box.width).toBeGreaterThan(view.width - 12);
  expect(box.y + box.height).toBeGreaterThan(view.height - 40);

  await btn.click();
  await expect(page.locator('#pack')).toBeVisible();
  await expect(page.locator('#pack .slot')).toHaveCount(12);
  await expect(page.locator('#pack .slot:not(.empty)')).toHaveCount(2);
  await expect(page.locator('#pack .slot').first()).toContainText('7');

  await page.locator('#pack [data-pack="auto"]').uncheck();
  await expect.poll(() => page.evaluate(() => window.game.world.state.players[0].autoDrop)).toBe(false);

  // A belt with a stone on it: selecting it closes the inventory, and its panel picks the stone up.
  const id = await page.evaluate(() => {
    const w = window.game.world;
    const h = w.hub!;
    const [x, y] = [h.x - 2, h.y + 7];
    for (let dx = -1; dx <= 1; dx++) {
      w.state.trees[w.idx(x + dx, y)] = 0;
      w.state.resources[w.idx(x + dx, y)] = 0;
    }
    const b = w.place('belt', x, y, 0, false);
    if (typeof b === 'string') throw new Error(b);
    b.belt = [{ item: 'stone', pos: 0.4, lane: 1 }];
    window.game.ui.selected = b.id;
    return b.id;
  });
  expect(id).toBeGreaterThan(0);
  await expect(page.locator('#pack')).toBeHidden();
  const pick = page.locator('#info [data-action="pickup"]');
  await expect(pick).toContainText('Pick up 1');
  await pick.click();
  await expect.poll(() => stone(page), { timeout: 8000 }).toBe(8);
});

test('Clear line puts every item on a belt line back in hub stock (D-141)', async ({ page }) => {
  await newGame(page);
  await calm(page);
  const before = await page.evaluate(() => {
    const w = window.game.world;
    const h = w.hub!;
    const [x, y] = [h.x - 3, h.y + 7];
    const ids: number[] = [];
    for (let dx = 0; dx < 3; dx++) {
      w.state.trees[w.idx(x + dx, y)] = 0;
      w.state.resources[w.idx(x + dx, y)] = 0;
      const b = w.place('belt', x + dx, y, 0, false);
      if (typeof b === 'string') throw new Error(b);
      b.belt = [{ item: 'gear', pos: 0.4, lane: 1 }];
      ids.push(b.id);
    }
    window.game.ui.selected = ids[0];
    return w.state.inventory.gear ?? 0;
  });
  await page.locator('#info [data-action="clear-belts"]').click();
  await expect(page.locator('#toasts')).toContainText('3 items back in hub stock');
  expect(await page.evaluate(() => window.game.world.state.inventory.gear ?? 0)).toBe(before + 3);
});
