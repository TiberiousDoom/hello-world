// Shared setup for the browser tests. The game exposes `window.game`
// (world, camera, ui, music) for exactly this purpose.

import { Locator, Page, TestInfo, expect, test as base } from '@playwright/test';

export const ALL_LESSONS = ['essentials', 'contracts', 'defense', 'store', 'logistics', 'breach', 'blackmarket', 'shipyard'];

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
 * marked seen, so no lesson gets in the way.
 */
export async function newGame(page: Page, opts: { lessonsSeen?: string[]; tipsOff?: boolean; tutorial?: boolean } = {}): Promise<void> {
  await setProfile(page, { lessonsSeen: opts.lessonsSeen ?? ALL_LESSONS, tipsOff: opts.tipsOff ?? false });
  await page.goto('/');
  await page.click('#mm-new');
  if (opts.tutorial !== undefined) await page.locator('#newgame-tutorial').setChecked(opts.tutorial);
  await page.click('[data-mode="standard"]');
  await expect(page.locator('#mainmenu')).toBeHidden();
}

/** Stops waves and contracts so a test controls the clock. */
export async function calm(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = window.game.world.state;
    s.nextWaveAt = 1e9;
    s.company.nextContractAt = 1e9;
  });
}

/** A tap on touch screens, a click on desktop, on the map at (x, y). */
export async function tap(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  // Wait for anything gliding over that spot (the tutorial card, a toast) to get out of the way.
  await expect
    .poll(() => page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [x, y] as const), { message: 'the map is uncovered at the tap point' })
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
