import { Page } from '@playwright/test';
import { calm, expect, newGame, test, tilePoint } from './helpers';

/** Finds a clear 8×5 area below the hub, centres the camera on it, and gives plenty of stock. */
async function clearArea(page: Page): Promise<{ x0: number; y0: number }> {
  const area = await page.evaluate(() => {
    const w = window.game.world;
    const c = window.game.camera;
    w.state.inventory = { iron_plate: 999, stone: 999, iron_ore: 999, brick: 999, copper_ingot: 999, rivet: 999 };
    w.state.researched.push('blacksmith', 'hydraulics', 'defense');
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
// Just the tiles (a plan also remembers where in a tile the pointer was, for snapping splitters).
const planTiles = (page: Page) => page.evaluate(() => window.game.ui.plan?.tiles.map((t: { x: number; y: number }) => ({ x: t.x, y: t.y })) ?? null);

/** One finger pressed at `from`, slid to `to`, and lifted. */
async function touchDrag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1] }] });
  for (let i = 1; i <= 6; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / 6;
    const y = from[1] + ((to[1] - from[1]) * i) / 6;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

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

  test('a belt dragged across a belt goes under it; a new underground entrance offers its exit', async ({ page }) => {
    await newGame(page);
    await calm(page);
    const { x0, y0 } = await clearArea(page);
    const link = (x: number, y: number) => page.evaluate(([x, y]) => window.game.world.buildingAt(x, y)?.link ?? null, [x, y] as const);
    await page.click('[data-tool="belt"]');
    await drag(page, await tilePoint(page, x0 + 3, y0), await tilePoint(page, x0 + 3, y0 + 4)); // a belt running south
    await page.keyboard.press('Enter');
    await expect.poll(() => count(page, 'belt')).toBe(5);

    // Across it, eastward: the line goes under.
    await drag(page, await tilePoint(page, x0, y0 + 2), await tilePoint(page, x0 + 6, y0 + 2));
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await at(page, x0 + 2, y0 + 2))?.type).toBe('tunnel');
    expect(await at(page, x0 + 3, y0 + 2)).toEqual({ type: 'belt', dir: 1 }); // left alone
    expect((await at(page, x0 + 4, y0 + 2))?.type).toBe('tunnel');
    expect(await link(x0 + 2, y0 + 2)).not.toBeNull();
    expect((await at(page, x0 + 6, y0 + 2))?.type).toBe('belt');

    // The underground tool: the entrance, then an exit blueprint past the belt, built by clicking it.
    await page.click('[data-tool="tunnel"]');
    await page.mouse.click(...(await tilePoint(page, x0 + 2, y0 + 4)));
    expect((await at(page, x0 + 2, y0 + 4))?.type).toBe('tunnel');
    await expect.poll(() => planTiles(page)).toEqual([{ x: x0 + 4, y: y0 + 4 }]);
    await page.mouse.click(...(await tilePoint(page, x0 + 4, y0 + 4)));
    await expect.poll(async () => (await at(page, x0 + 4, y0 + 4))?.type).toBe('tunnel');
    expect(await link(x0 + 4, y0 + 4)).not.toBeNull();
    expect(await planLength(page)).toBe(0);
  });

  test('a single building dragged into place waits for a click on it', async ({ page }) => {
    await newGame(page);
    await calm(page);
    const { x0, y0 } = await clearArea(page);
    await page.click('[data-tool="turret"]');

    await drag(page, await tilePoint(page, x0, y0), await tilePoint(page, x0 + 4, y0 + 2));
    expect(await planTiles(page)).toEqual([{ x: x0 + 4, y: y0 + 2 }]);
    expect(await count(page, 'turret')).toBe(0);
    await expect(page.locator('#plan-bar')).toBeVisible();

    // Dragging the blueprint moves it; clicking it builds.
    await drag(page, await tilePoint(page, x0 + 4, y0 + 2), await tilePoint(page, x0 + 2, y0 + 3));
    expect(await planTiles(page)).toEqual([{ x: x0 + 2, y: y0 + 3 }]);
    expect(await count(page, 'turret')).toBe(0);
    await page.mouse.click(...(await tilePoint(page, x0 + 2, y0 + 3)));
    await expect.poll(async () => (await at(page, x0 + 2, y0 + 3))?.type).toBe('turret');
    expect(await planLength(page)).toBe(0);

    // A plain click still builds at once.
    await page.mouse.click(...(await tilePoint(page, x0 + 6, y0)));
    expect((await at(page, x0 + 6, y0))?.type).toBe('turret');
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
    expect(await planTiles(page)).toEqual([{ x: x0 + 5, y: y0 }]);
    await page.click('[data-plan="cancel"]');
    expect(await planLength(page)).toBe(0);
    expect(await at(page, x0 + 5, y0)).toBeNull();

    // A single building dragged into place, then moved by dragging its blueprint, waits for ✓.
    await page.click('[data-tool="turret"]');
    await touchDrag(page, await tilePoint(page, x0 + 4, y0 + 2), await tilePoint(page, x0 + 6, y0 + 3));
    await expect.poll(() => planTiles(page)).toEqual([{ x: x0 + 6, y: y0 + 3 }]);
    await touchDrag(page, await tilePoint(page, x0 + 6, y0 + 3), await tilePoint(page, x0 + 7, y0 + 4));
    await expect.poll(() => planTiles(page)).toEqual([{ x: x0 + 7, y: y0 + 4 }]);
    expect(await count(page, 'turret')).toBe(0);
    await page.click('[data-plan="confirm"]');
    await expect.poll(async () => (await at(page, x0 + 7, y0 + 4))?.type).toBe('turret');
    await page.click('[data-tool="belt"]');

    // Switched off in the menu: a tap builds.
    await page.click('#menu-btn');
    await page.click('#confirm-toggle');
    await page.click('#btn-resume');
    await page.touchscreen.tap(...(await tilePoint(page, x0, y0 + 2)));
    await expect.poll(async () => (await at(page, x0, y0 + 2))?.type).toBe('belt');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('foundry-front-profile')!).confirmTouch)).toBe(false);
  });
});
