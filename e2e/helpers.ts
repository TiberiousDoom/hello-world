// Shared setup for the browser tests. The game exposes `window.game`
// (world, camera, ui, music) for exactly this purpose.

import { Locator, Page, TestInfo, expect, test as base } from '@playwright/test';

export const ALL_LESSONS = ['essentials', 'rollers', 'workshop', 'industry', 'defense', 'logistics', 'power', 'electricity', 'breach', 'shipyard'];

/** Fails any test whose page throws an uncaught error. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await use(errors);
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const isTouch = (info: TestInfo) => info.project.name === 'phone';

/** Sets the device profile before the page loads (lessons seen, tips on or off). */
export async function setProfile(page: Page, profile: Record<string, unknown>): Promise<void> {
  await page.addInitScript((p) => {
    // Only on the first load, so a test can reload and see what the game saved.
    if (sessionStorage.getItem('e2e-profile')) return;
    sessionStorage.setItem('e2e-profile', '1');
    localStorage.setItem('foundry-front-profile', JSON.stringify(p));
  }, profile);
}

/**
 * Opens the game and starts a new Standard game. By default every lesson is
 * marked seen, so no lesson gets in the way, and the hub gets some stock and
 * belts (games start from nothing, #38); `fresh` leaves the start as it is.
 */
export async function newGame(page: Page, opts: { lessonsSeen?: string[]; tipsOff?: boolean; tutorial?: boolean; fresh?: boolean } = {}): Promise<void> {
  await setProfile(page, { lessonsSeen: opts.lessonsSeen ?? ALL_LESSONS, tipsOff: opts.tipsOff ?? false });
  await page.goto('/');
  await page.click('#mm-new');
  if (opts.tutorial !== undefined) await page.locator('#newgame-tutorial').setChecked(opts.tutorial);
  await page.click('[data-mode="standard"]');
  await expect(page.locator('#mainmenu')).toBeHidden();
  if (!opts.fresh) await stock(page);
}

/** Some hub stock, and Forestry, Industry (extractors, furnaces), Blacksmith, Hydraulics and Metal Logistics (belts, splitters, underground belts). */
export async function stock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = window.game.world.state;
    Object.assign(s.inventory, { iron_plate: 100, brick: 24, copper_ingot: 16, stone: 40, iron_ore: 20, log: 40, plank: 20 });
    for (const id of ['forestry', 'industry', 'blacksmith', 'hydraulics', 'logistics']) if (!s.researched.includes(id)) s.researched.push(id);
  });
}

/** Removes every bug territory, so nothing a test builds provokes an attack. */
export async function calm(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.nests = [];
    w.state.enemies = [];
    w.nestCells.clear();
  });
}

/** Selects the hub by clicking or tapping its middle. */
export async function selectHub(page: Page, info: TestInfo): Promise<void> {
  // An open info panel can cover the middle of a phone screen, where the hub is about to be.
  const close = page.locator('#info:not([hidden]) [data-action="close"]');
  if (await close.isVisible()) await close.click();
  // A lesson can still be gliding the camera, moving the hub from under the tap: check the panel shows, and tap again if not.
  await expect(async () => {
    await cameraSettled(page);
    const [x, y] = await page.evaluate(() => {
      const h = window.game.world.hub;
      const c = window.game.camera;
      c.x = h.x + 2.5;
      c.y = h.y + 2.5;
      return c.toScreen(h.x + 2.5, h.y + 2.5) as [number, number];
    });
    await tap(page, info, x, y);
    await expect(page.locator('#info .info-head')).toContainText('Hub', { timeout: 1000 });
    await expect(page.locator('#info')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
}

/** In the page: what's on top at (x, y): 'game' for the map, otherwise a short description. */
function coveredBy([x, y]: readonly [number, number]): string {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return 'nothing';
  if (el.id) return el.id;
  const owner = el.closest('[id]');
  return `${el.tagName.toLowerCase()}.${el.className} in #${owner?.id ?? '?'}`;
}

/**
 * Screen point for a map tile that nothing covers, panning the camera if the
 * tile sits under an overlay (the lesson card, the stock panel, a toast).
 */
export async function uncoveredTile(page: Page, tx: number, ty: number): Promise<[number, number]> {
  for (const [ox, oy] of [[0, 0], [0, -3], [0, 3], [-3, 0], [3, 0], [0, -6], [0, 6]]) {
    const pt = await page.evaluate(
      ([tx, ty, ox, oy]) => {
        const c = window.game.camera;
        if (ox || oy) {
          c.x = tx + 0.5 - ox;
          c.y = ty + 0.5 - oy;
        }
        return c.toScreen(tx + 0.5, ty + 0.5) as [number, number];
      },
      [tx, ty, ox, oy] as const,
    );
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    if ((await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, pt)) === 'game') return pt;
  }
  throw new Error(`tile ${tx},${ty} is covered wherever the camera puts it`);
}

/** A tap on touch screens, a click on desktop, on the map at (x, y). */
export async function tap(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  // Wait for anything gliding over that spot (the tutorial card, a toast) to get out of the way.
  await expect
    .poll(() => page.evaluate(coveredBy, [x, y] as const), { message: 'the map is uncovered at the tap point' })
    .toBe('game');
  if (isTouch(info)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Builds with the current tool at a point: on touch, a blueprint then ✓. */
export async function build(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  await tap(page, info, x, y);
  if (!isTouch(info)) return;
  // Confirm the blueprint once it's there. Callers check that the building went up.
  const planned = await page
    .waitForFunction(() => window.game.ui.plan != null, null, { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (planned) await page.click('[data-plan="confirm"]');
}

/**
 * Builds the tool in hand at a tile, and checks it went up. A tap that lands while the camera is still
 * gliding can put the blueprint on the wrong tile, so a blueprint anywhere else is cancelled, and the
 * tap tried again, before anything is paid for.
 */
export async function buildTile(page: Page, info: TestInfo, tx: number, ty: number): Promise<void> {
  const tool = await page.evaluate(() => window.game.ui.tool);
  const built = () => page.evaluate(([x, y, t]) => window.game.world.buildingAt(x, y)?.type === t, [tx, ty, tool] as const);
  for (let i = 0; i < 4 && !(await built()); i++) {
    await cameraSettled(page);
    const pt = await uncoveredTile(page, tx, ty);
    await tap(page, info, ...pt);
    if (isTouch(info)) {
      const plan = await page
        .waitForFunction(() => window.game.ui.plan?.tiles[0] ?? null, null, { timeout: 3000 })
        .then((h) => h.jsonValue() as Promise<{ x: number; y: number }>)
        .catch(() => null);
      if (!plan) continue;
      if (plan.x !== tx || plan.y !== ty) {
        await page.click('[data-plan="cancel"]');
        continue;
      }
      await page.click('[data-plan="confirm"]');
    }
    await expect.poll(built, { timeout: 2000 }).toBe(true).catch(() => undefined);
  }
  expect(await built(), `a ${tool} at ${tx},${ty}`).toBe(true);
}

/** Screen point at the centre of a tile. */
export function tilePoint(page: Page, x: number, y: number): Promise<[number, number]> {
  return page.evaluate(([x, y]) => window.game.camera.toScreen(x + 0.5, y + 0.5), [x, y] as const);
}

export const stepLabel = (page: Page) => page.locator('#tutorial .step');

/** Waits until an element stops moving (e.g. the tutorial card or spotlight gliding), then returns its box. */
export async function settled(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  let box = (await locator.boundingBox())!;
  await locator.page().waitForTimeout(150); // so the first comparison spans real movement
  await expect
    .poll(async () => {
      const prev = box;
      box = (await locator.boundingBox())!;
      return Math.abs(box.x - prev.x) + Math.abs(box.y - prev.y);
    })
    .toBeLessThan(0.5);
  return box;
}

/** Waits until the camera stops moving (lessons glide it to their targets). */
export async function cameraSettled(page: Page): Promise<void> {
  const where = () => page.evaluate(() => [window.game.camera.x, window.game.camera.y, window.game.camera.zoom]);
  let cam = await where();
  await page.waitForTimeout(150);
  await expect
    .poll(async () => {
      const prev = cam;
      cam = await where();
      return Math.abs(cam[0] - prev[0]) + Math.abs(cam[1] - prev[1]) + Math.abs(cam[2] - prev[2]);
    })
    .toBeLessThan(0.001);
}
