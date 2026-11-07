import { calm, cameraSettled, expect, newGame, tap, test, uncoveredTile } from './helpers';

test('Move picks a building up as a ghost, which moves it, with what it holds, only once confirmed (#76, #83, #258)', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  const start = await page.evaluate(() => {
    const w = window.game.world;
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -2; dy <= 4; dy++) for (let dx = -2; dx <= 8; dx++) w.state.resources[w.idx(x + dx, y + dy)] = w.state.trees[w.idx(x + dx, y + dy)] = 0;
    const f = w.place('furnace', x, y, 0);
    f.outputs = ['iron_plate'];
    window.game.ui.selected = f.id;
    window.game.camera.x = x + 3;
    window.game.camera.y = y + 1;
    return { id: f.id, x, y };
  });
  await expect(page.locator('#info [data-action="move"]')).toBeVisible();
  await page.click('#info [data-action="move"]');
  // The panel closes, and a ghost of the building waits on it.
  const picked = await page.evaluate(() => ({ tool: window.game.ui.tool, selected: window.game.ui.selected, plan: !!window.game.ui.plan }));
  expect(picked).toEqual({ tool: 'furnace', selected: null, plan: true });
  await expect(page.locator('#info [data-action="move"]')).toBeHidden();
  await cameraSettled(page);
  // The first tap only puts the ghost there.
  const spot = await uncoveredTile(page, start.x + 5, start.y);
  await tap(page, info, ...spot);
  await expect.poll(() => page.evaluate(() => window.game.ui.plan?.tiles[0].x)).toBe(start.x + 5);
  expect(await page.evaluate((id) => window.game.world.byId.get(id).x, start.id)).toBe(start.x);
  // Tapping the ghost again moves the building there.
  await tap(page, info, ...spot);
  await expect.poll(() => page.evaluate((id) => window.game.world.byId.get(id)?.x, start.id)).not.toBe(start.x);
  const moved = await page.evaluate(({ id, x, y }) => {
    const w = window.game.world;
    const ui = window.game.ui;
    return { outputs: w.byId.get(id).outputs, tool: ui.tool, selected: ui.selected, plan: ui.plan, oldSpot: w.buildingAt(x, y)?.id ?? null };
  }, start);
  expect(moved.outputs).toEqual(['iron_plate']); // it kept what it held
  expect(moved.tool).toBeNull(); // the tool is put away
  expect(moved.selected).toBeNull(); // and its panel stays closed
  expect(moved.plan).toBeNull();
  expect(moved.oldSpot).toBeNull();
  // ✕ cancels a move: the building stays put.
  await page.evaluate((id) => (window.game.ui.selected = id), start.id);
  await page.click('#info [data-action="move"]');
  await expect(page.locator('#plan-bar')).toBeVisible();
  const before = await page.evaluate((id) => window.game.world.byId.get(id).x, start.id);
  await page.click('#plan-bar [data-plan="cancel"]');
  const after = await page.evaluate((id) => ({ x: window.game.world.byId.get(id).x, tool: window.game.ui.tool, plan: window.game.ui.plan }), start.id);
  expect(after).toEqual({ x: before, tool: null, plan: null });
  // The hub has no Move button.
  await page.evaluate(() => (window.game.ui.selected = window.game.world.hub.id));
  await expect(page.locator('#info')).toContainText('Hub');
  await expect(page.locator('#info [data-action="move"]')).toHaveCount(0);
});

test('A moved building can be dragged into place and confirmed with ✓ (#258)', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  const start = await page.evaluate(() => {
    const w = window.game.world;
    const [x, y] = [w.hub.x - 10, w.hub.y + 2];
    for (let dy = -2; dy <= 4; dy++) for (let dx = -2; dx <= 8; dx++) w.state.resources[w.idx(x + dx, y + dy)] = w.state.trees[w.idx(x + dx, y + dy)] = 0;
    const f = w.place('furnace', x, y, 0);
    window.game.ui.selected = f.id;
    window.game.camera.x = x + 3;
    window.game.camera.y = y + 1;
    return { id: f.id, x, y };
  });
  await page.click('#info [data-action="move"]');
  await cameraSettled(page);
  const from = await uncoveredTile(page, start.x, start.y);
  const to = await page.evaluate(({ x, y }) => window.game.camera.toScreen(x + 4.5, y + 0.5) as [number, number], start); // same camera as `from`
  if (info.project.name === 'phone') {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, [x, y]: readonly number[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', from);
    for (let k = 1; k <= 8; k++) await touch('touchMove', [from[0] + ((to[0] - from[0]) * k) / 8, from[1]]);
    await touch('touchEnd', to);
  } else {
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps: 8 });
    await page.mouse.up();
  }
  // Dragged, it waits: nothing has moved yet.
  await expect.poll(() => page.evaluate(() => window.game.ui.plan?.tiles[0].x)).toBe(start.x + 4);
  expect(await page.evaluate((id) => window.game.world.byId.get(id).x, start.id)).toBe(start.x);
  await page.click('#plan-bar [data-plan="confirm"]');
  await expect.poll(() => page.evaluate((id) => window.game.world.byId.get(id).x, start.id)).toBe(start.x + 4);
  expect(await page.evaluate(() => window.game.ui.selected)).toBeNull();
});
