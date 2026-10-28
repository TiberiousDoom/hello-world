import { type Page } from '@playwright/test';
import { buildTile, calm, pickTool, expect, isTouch, newGame, tap, test, uncoveredTile } from './helpers';

/** Open ground to the right of the hub, `w`×`h` tiles, cleared of ore and trees. Returns its corner. */
async function clearing(page: Page, w: number, h: number): Promise<[number, number]> {
  return page.evaluate(
    ([w, h]) => {
      const world = window.game.world;
      const hub = world.hub;
      const [x0, y0] = [hub.x + 11, hub.y];
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) world.state.resources[world.idx(x, y)] = world.state.trees[world.idx(x, y)] = 0;
      world.markFlowDirty?.();
      return [x0, y0] as [number, number];
    },
    [w, h] as const,
  );
}

const typeAt = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => window.game.world.buildingAt(x, y)?.type ?? null, [x, y] as const);

test('undo takes back building, then demolishing', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  const [x, y] = await clearing(page, 6, 4);
  await page.click('[data-tool="furnace"]');
  await buildTile(page, info, x + 1, y + 1);
  await page.click('[data-tool="undo"]');
  await expect.poll(() => typeAt(page, x + 1, y + 1)).toBeNull();

  // Built again and set to bricks, then demolished: undo puts it back, still making bricks.
  await pickTool(page, 'furnace');
  await buildTile(page, info, x + 1, y + 1);
  await page.evaluate(([x, y]) => window.game.world.setRecipe(window.game.world.buildingAt(x, y).id, 'brick'), [x + 1, y + 1] as const);
  await page.click('[data-tool="demolish"]');
  await tap(page, info, ...(await uncoveredTile(page, x + 1, y + 1)));
  await expect.poll(() => typeAt(page, x + 1, y + 1)).toBeNull();
  if (isTouch(info)) await page.click('[data-tool="undo"]');
  else await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(([x, y]) => window.game.world.buildingAt(x, y)?.recipe ?? null, [x + 1, y + 1] as const)).toBe('brick');
  await page.click('[data-tool="undo"]');
  await page.click('[data-tool="undo"]');
  await expect(page.locator('#toasts')).toContainText('Nothing to undo');
});

test('copy an area, turn it and paste it', async ({ page }, info) => {
  test.skip(isTouch(info), 'drags with the mouse');
  await newGame(page);
  await calm(page);
  const [x, y] = await clearing(page, 12, 8);
  await page.evaluate(
    ([x, y]) => {
      const w = window.game.world;
      const f = w.place('furnace', x, y, 0);
      w.setRecipe(f.id, 'brick');
      w.place('belt', x + 2, y, 0);
    },
    [x, y] as const,
  );
  await page.evaluate(([x, y]) => Object.assign(window.game.camera, { x: x + 5, y: y + 4, zoom: 34 }), [x, y] as const);
  const pt = (tx: number, ty: number) => page.evaluate(([tx, ty]) => window.game.camera.toScreen(tx + 0.5, ty + 0.5) as [number, number], [tx, ty] as const);

  await page.keyboard.press('c');
  await expect.poll(() => page.evaluate(() => window.game.ui.clipMode)).toBe('copy');
  await page.mouse.move(...(await pt(x, y)));
  await page.mouse.down();
  await page.mouse.move(...(await pt(x + 2, y + 1)), { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.game.ui.clipMode)).toBe('paste');
  expect(await page.evaluate(() => window.game.ui.clip.items.length)).toBe(2);

  // Turned a quarter: the belt ends up below the furnace. The copy (2×3 once turned) centres on the tile, so its corner is one up.
  await page.keyboard.press('r');
  await page.mouse.click(...(await pt(x + 7, y + 4)));
  await expect.poll(() => typeAt(page, x + 7, y + 3)).toBe('furnace');
  expect(await page.evaluate(([x, y]) => window.game.world.buildingAt(x, y).recipe, [x + 7, y + 3] as const)).toBe('brick');
  expect(await typeAt(page, x + 8, y + 5)).toBe('belt');
  expect(await page.evaluate(([x, y]) => window.game.world.buildingAt(x, y).dir, [x + 8, y + 5] as const)).toBe(1);

  // Esc leaves pasting, and undo takes the whole paste back in one go.
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.game.ui.clipMode)).toBeNull();
  await page.keyboard.press('Control+z');
  await expect.poll(() => typeAt(page, x + 7, y + 3)).toBeNull();
  expect(await typeAt(page, x + 8, y + 5)).toBeNull();
  expect(await typeAt(page, x, y)).toBe('furnace');
});

test('settings: size, motion and keys', async ({ page }, info) => {
  await page.goto('/');
  await page.click('#mm-settings');
  await expect(page.locator('#settings')).toBeVisible();
  await page.locator('#ui-scale').fill('120');
  await page.locator('#ui-scale').dispatchEvent('change');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui').trim())).toBe('1.2');
  await page.locator('#motion-toggle').setChecked(true);
  await expect(page.locator('body')).toHaveClass(/reduce-motion/);
  expect(await page.evaluate(() => window.game.renderer.reducedMotion)).toBe(true);

  // Rotate moves to T; a key with a job of its own is refused.
  await page.click('[data-key="rotate"]');
  await expect(page.locator('[data-key="rotate"]')).toHaveText('Press a key…');
  await page.keyboard.press('w');
  await expect(page.locator('#toasts')).toContainText("can't be changed");
  await page.keyboard.press('t');
  await expect(page.locator('[data-key="rotate"]')).toHaveText('T');
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('foundry-front-profile')!));
  expect(profile).toMatchObject({ uiScale: 1.2, reducedMotion: true });
  await page.click('#settings [data-close]');

  if (isTouch(info)) return;
  await newGame(page);
  await page.click('[data-tool="belt"]');
  const dir = await page.evaluate(() => window.game.ui.dir);
  await page.keyboard.press('t');
  expect(await page.evaluate(() => window.game.ui.dir)).toBe((dir + 1) % 4);
  await page.keyboard.press('r'); // no longer rotates
  expect(await page.evaluate(() => window.game.ui.dir)).toBe((dir + 1) % 4);
  // The tool hotkeys: 2 picks the second tool.
  await page.keyboard.press('Escape');
  await page.keyboard.press('2');
  expect(await page.evaluate(() => window.game.ui.tool)).toBe(await page.locator('#toolbar [data-tool]').nth(1).getAttribute('data-tool'));
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });
  test('the game installs and plays offline once opened', async ({ page, context }, info) => {
    test.skip(isTouch(info), 'once is enough');
    await page.goto('/');
    expect(await page.locator('link[rel="manifest"]').getAttribute('href')).toBe('./manifest.webmanifest');
    const manifest = await (await page.request.get('manifest.webmanifest')).json();
    expect(manifest.icons.length).toBeGreaterThan(0);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#mm-new')).toBeVisible();
    await page.click('#mm-new');
    await page.click('[data-mode="standard"]');
    await expect(page.locator('#mainmenu')).toBeHidden();
    await context.setOffline(false);
  });
});
