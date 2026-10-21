import { Page } from '@playwright/test';
import { calm, expect, newGame, test, tilePoint } from './helpers';

/** Finds a clear 8×5 area below the hub, centres the camera on it, and gives plenty of stock. */
async function clearArea(page: Page): Promise<{ x0: number; y0: number }> {
  const area = await page.evaluate(() => {
    const w = window.game.world;
    const c = window.game.camera;
    w.state.inventory = { iron_plate: 999, brick: 999, copper_ingot: 999 };
    w.state.researched.push('masonry', 'defense');
    const h = w.hub;
    for (let oy = 7; oy < 30; oy++) {
      for (let ox = -10; ox < 8; ox++) {
        const x0 = h.x + ox;
        const y0 = h.y + oy;
        let free = true;
        for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x0 + 8; x++) if (w.checkPlace('belt', x, y) || w.resourceAt(x, y)) free = false;
        if (free) {
          c.x = x0 + 4;
          c.y = y0 + 2.5;
          return { x0, y0 };
        }
      }
    }
    return null;
  });
  expect(area, 'a clear area near the hub').not.toBeNull();
  return area!;
}

const count = (page: Page, type: string) =>
  page.evaluate((t) => window.game.world.state.buildings.filter((b: { type: string }) => b.type === t).length, type);
const at = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => {
    const b = window.game.world.buildingAt(x, y);
    return b ? { type: b.type as string, dir: b.dir as number } : null;
  }, [x, y] as const);
const planLength = (page: Page) => page.evaluate(() => window.game.ui.plan?.tiles.length ?? 0);

async function drag(page: Page, from: [number, number], ...to: [number, number][]): Promise<void> {
  await page.mouse.move(...from);
  await page.mouse.down();
  for (const p of to) await page.mouse.move(...p, { steps: 6 });
  await page.mouse.up();
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse only');

  test('dragged belt and wall lines become blueprints; single clicks build at once', async ({ page }) => {
    await newGame(page);
    await calm(page);
    const { x0, y0 } = await clearArea(page);
    await page.click('[data-tool="belt"]');

    await drag(page, await tilePoint(page, x0, y0), await tilePoint(page, x0 + 3, y0));
    await expect.poll(() => planLength(page)).toBe(4);
    expect(await count(page, 'belt')).toBe(0);
    await expect(page.locator('#plan-bar')).toBeVisible();
    await page.click('[data-plan="rotate"]'); // reverses the line
    await page.keyboard.press('Enter');
    await expect.poll(() => count(page, 'belt')).toBe(4);
    expect((await at(page, x0, y0))?.dir).toBe(2);
    await expect(page.locator('#plan-bar')).toBeHidden();

    // Dragging back shortens it; right-click cancels but keeps the tool.
    await drag(page, await tilePoint(page, x0, y0 + 1), await tilePoint(page, x0 + 4, y0 + 1), await tilePoint(page, x0 + 2, y0 + 1));
    expect(await planLength(page)).toBe(3);
    await page.mouse.click(...(await tilePoint(page, x0 + 2, y0 + 1)), { button: 'right' });
    expect(await planLength(page)).toBe(0);
    expect(await page.evaluate(() => window.game.ui.tool)).toBe('belt');

    await page.mouse.click(...(await tilePoint(page, x0, y0 + 2)));
    expect((await at(page, x0, y0 + 2))?.type).toBe('belt');
    await page.click('[data-tool="furnace"]');
    await page.mouse.click(...(await tilePoint(page, x0 + 5, y0 + 2)));
    expect((await at(page, x0 + 5, y0 + 2))?.type).toBe('furnace');

    // A furnace (still the tool) clicked onto a belt replaces it and faces along the line.
    await page.mouse.click(...(await tilePoint(page, x0 + 1, y0)));
    expect(await at(page, x0 + 1, y0)).toEqual({ type: 'furnace', dir: 2 });

    await page.click('[data-tool="wall"]');
    await drag(page, await tilePoint(page, x0 + 1, y0 + 2), await tilePoint(page, x0 + 4, y0 + 2));
    expect(await planLength(page)).toBe(4);
    expect(await count(page, 'wall')).toBe(0);
    await page.click('[data-plan="confirm"]');
    await expect.poll(() => count(page, 'wall')).toBe(4);
  });
});

test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch only');

  test('every placement is a blueprint to confirm, unless switched off', async ({ page }) => {
    await newGame(page);
    await calm(page);
    const { x0, y0 } = await clearArea(page);
    await page.click('[data-tool="belt"]');

    await page.touchscreen.tap(...(await tilePoint(page, x0, y0)));
    await expect.poll(() => planLength(page)).toBe(1);
    expect(await count(page, 'belt')).toBe(0);
    await page.click('[data-plan="rotate"]');
    await page.click('[data-plan="confirm"]');
    await expect.poll(async () => (await at(page, x0, y0))?.dir).toBe(1);

    // A furnace on that belt: a blueprint, then it replaces the belt and keeps its direction.
    await page.click('[data-tool="furnace"]');
    await page.touchscreen.tap(...(await tilePoint(page, x0, y0)));
    await page.click('[data-plan="confirm"]');
    await expect.poll(() => at(page, x0, y0)).toEqual({ type: 'furnace', dir: 1 });
    await page.click('[data-tool="belt"]');

    // The same spot twice builds.
    await page.touchscreen.tap(...(await tilePoint(page, x0 + 2, y0)));
    await page.touchscreen.tap(...(await tilePoint(page, x0 + 2, y0)));
    await expect.poll(async () => (await at(page, x0 + 2, y0))?.type).toBe('belt');

    // Another spot moves the blueprint; ✕ cancels.
    await page.touchscreen.tap(...(await tilePoint(page, x0 + 4, y0)));
    await page.touchscreen.tap(...(await tilePoint(page, x0 + 5, y0)));
    expect(await page.evaluate(() => window.game.ui.plan?.tiles)).toEqual([{ x: x0 + 5, y: y0 }]);
    await page.click('[data-plan="cancel"]');
    expect(await planLength(page)).toBe(0);
    expect(await at(page, x0 + 5, y0)).toBeNull();

    // Switched off in the menu: a tap builds.
    await page.click('#menu-btn');
    await page.click('#confirm-toggle');
    await page.click('#btn-resume');
    await page.touchscreen.tap(...(await tilePoint(page, x0, y0 + 2)));
    await expect.poll(async () => (await at(page, x0, y0 + 2))?.type).toBe('belt');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('foundry-front-profile')!).confirmTouch)).toBe(false);
  });
});
