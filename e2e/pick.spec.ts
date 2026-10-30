import { calm, expect, isTouch, newGame, test, uncoveredTile } from './helpers';

test('picking a placed building makes it the tool in hand, facing the same way', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  // A furnace facing south, on clear ground near the hub.
  const tile = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    s.inventory = { iron_plate: 999, stone: 999, iron_ore: 999, brick: 999, log: 99 };
    const x = w.hub.x - 8;
    const y = w.hub.y - 8;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    const b = w.place('furnace', x, y, 1);
    return typeof b === 'string' ? null : { x, y };
  });
  expect(tile, 'the furnace was placed').not.toBeNull();
  const [px, py] = await uncoveredTile(page, tile!.x, tile!.y);

  if (isTouch(info)) {
    // A finger held still on it.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: px, y: py }] });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    // A middle-click on it.
    await page.mouse.click(px, py, { button: 'middle' });
  }
  await expect.poll(() => page.evaluate(() => window.game.ui.tool)).toBe('furnace');
  expect(await page.evaluate(() => window.game.ui.dir)).toBe(1);
  expect(await page.evaluate(() => window.game.ui.plan)).toBeNull();
  // Nothing new was built by the press.
  expect(await page.evaluate(() => window.game.world.state.buildings.filter((b: { type: string }) => b.type === 'furnace').length)).toBe(1);

  if (!isTouch(info)) {
    // A middle-drag still pans, and picks nothing.
    await page.evaluate(() => (window.game.ui.tool = null));
    const x0 = await page.evaluate(() => window.game.camera.x);
    await page.mouse.move(px, py);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(px - 120, py, { steps: 5 });
    await page.mouse.up({ button: 'middle' });
    expect(await page.evaluate(() => window.game.camera.x)).not.toBe(x0);
    expect(await page.evaluate(() => window.game.ui.tool)).toBeNull();
  }
});
