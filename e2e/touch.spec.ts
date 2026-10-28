import { type Page } from '@playwright/test';
import { buildTile, calm, expect, isTouch, newGame, selectHub, test } from './helpers';

/** Open ground right of the hub, cleared of ore and trees. */
async function clearing(page: Page): Promise<[number, number]> {
  return page.evaluate(() => {
    const w = window.game.world;
    const [x0, y0] = [w.hub.x + 11, w.hub.y];
    for (let y = y0 - 4; y < y0 + 10; y++) for (let x = x0 - 2; x < x0 + 10; x++) w.state.resources[w.idx(x, y)] = w.state.trees[w.idx(x, y)] = 0;
    return [x0, y0] as [number, number];
  });
}

const tool = (page: Page) => page.evaluate(() => window.game.ui.tool);

test('on touch, building puts the tool down; a double tap keeps it (#164)', async ({ page }, info) => {
  test.skip(!isTouch(info), 'touch only: the mouse keeps its tool');
  await newGame(page);
  await calm(page);
  const [x, y] = await clearing(page);
  await page.click('[data-tool="furnace"]');
  await buildTile(page, info, x + 1, y + 1);
  await expect.poll(() => tool(page)).toBeNull();

  // Two quick taps pin it: it stays in hand for the next one.
  await page.locator('[data-tool="furnace"]').dblclick();
  await expect(page.locator('[data-tool="furnace"]')).toHaveClass(/pinned/);
  await buildTile(page, info, x + 4, y + 1);
  expect(await tool(page)).toBe('furnace');
  await buildTile(page, info, x + 7, y + 1);
  expect(await tool(page)).toBe('furnace');

  // A line tool stays in hand anyway.
  await page.click('[data-tool="belt"]');
  expect(await page.locator('[data-tool="belt"]').getAttribute('class')).not.toContain('pinned');
  await buildTile(page, info, x + 1, y + 5);
  expect(await tool(page)).toBe('belt');
});

test('the research menu lists what can start first and what is done last (#154)', async ({ page }, info) => {
  await newGame(page);
  await selectHub(page, info);
  await page.click('#info [data-action="research"]');
  // The rows and headings in order: newGame's stock researched Forestry and four more, listed under Done.
  const seq = await page.evaluate(() =>
    [...document.querySelectorAll('#research-body h3, #research-body .research')].map((el) =>
      el.tagName === 'H3' ? `# ${el.textContent}` : `${el.classList.contains('done') ? 'done' : 'open'} ${el.querySelector('b')!.textContent}`,
    ),
  );
  const doneAt = seq.indexOf('# Done');
  expect(doneAt).toBeGreaterThan(0);
  expect(seq[0]).toMatch(/^open /);
  expect(seq.slice(0, doneAt).every((r) => r.startsWith('open'))).toBe(true);
  expect(seq[doneAt + 1]).toBe('done Forestry'); // researched first
});
