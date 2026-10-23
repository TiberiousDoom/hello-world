import { ALL_LESSONS, build, cameraSettled, expect, isTouch, newGame, selectHub, settled, stepLabel, tap, test, uncoveredTile } from './helpers';

test('the Essentials and Bugs lessons run, then can be replayed and switched off', async ({ page }, info) => {
  await newGame(page, { lessonsSeen: [], fresh: true });
  const step = stepLabel(page);
  const speed = () => page.evaluate(() => window.game.ui.speed);
  const stockOf = (item: string) => page.evaluate((i) => window.game.world.state.inventory[i] ?? 0, item);

  await expect(step).toHaveText(/^Essentials · 1/);
  expect(await speed()).toBe(0); // explanations pause the game
  await page.click('.tip-next');

  // The engineer.
  await expect(step).toHaveText(/^Essentials · 2/);
  await page.click('.tip-next');
  await expect.poll(speed).toBe(1); // action steps let it run

  // Mine stone by hand: a tap sends the engineer over, then eight taps loosen one stone, which they carry.
  await expect(step).toContainText('3 of');
  await settled(page.locator('#tutorial .spot'));
  await cameraSettled(page);
  const stone = await page.evaluate(() => {
    const w = window.game.world;
    let best: [number, number] = [0, 0];
    let bestD = Infinity;
    for (let y = 0; y < w.state.height; y++)
      for (let x = 0; x < w.state.width; x++) {
        if (w.resourceAt(x, y) !== 'stone' || w.buildingAt(x, y)) continue;
        const d = Math.abs(x - w.hub.x) + Math.abs(y - w.hub.y);
        if (d < bestD) [bestD, best] = [d, [x, y]];
      }
    return best;
  });
  const at = await uncoveredTile(page, ...stone);
  await tap(page, info, ...at);
  await expect
    .poll(() => page.evaluate(() => window.game.world.state.players[0].path.length), { timeout: 30000 })
    .toBe(0); // arrived
  await cameraSettled(page);
  const here = await uncoveredTile(page, ...stone); // the camera may have moved while it walked
  // Eight taps loosen a stone, which the engineer carries (or drops straight into the hub when the stone
  // is next to it). On a slow machine a tap can land late, so keep tapping until one comes loose.
  const minedStone = () =>
    page.evaluate(() => {
      const w = window.game.world;
      return w.state.players[0].carry.filter((i: string) => i === 'stone').length + (w.state.inventory.stone ?? 0);
    });
  for (let i = 0; i < 30 && (await minedStone()) === 0; i++) await tap(page, info, ...here);
  expect(await minedStone()).toBe(1);
  await page.evaluate(() => (window.game.world.state.inventory.stone = 10));
  await expect(step).toContainText('4 of');
  // With the ore in stock too, the drop-off step (5) is already done.
  await page.evaluate(() => (window.game.world.state.inventory.iron_ore = 4));
  await expect(step).toContainText('6 of');

  // Pick the extractor, then build it over the highlighted ore.
  await page.click('[data-tool="extractor"]');
  if (isTouch(info)) await expect(page.locator('#tutorial .tip-text')).toContainText('tap ✓');
  await expect(page.locator('#tutorial .tip-text')).toContainText('tap the iron ore');
  await settled(page.locator('#tutorial .spot')); // it glides to the ore
  await cameraSettled(page);
  // The nearest iron ore with clear ground around it for the extractor, and east of it for the furnace and belts (maps are random).
  const node = await page.evaluate(() => {
    const w = window.game.world;
    const roomEast = (x: number, y: number) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 8; dx++) if (!['locked', null].includes(w.checkPlace('belt', x + dx, y + dy))) return false; // belts aren't researched yet
      return true;
    };
    let best: [number, number] = [0, 0];
    let bestD = Infinity;
    for (let y = 0; y < w.state.height; y++)
      for (let x = 0; x < w.state.width; x++) {
        if (w.resourceAt(x, y) !== 'iron_ore' || w.buildingAt(x, y) || !roomEast(x, y)) continue;
        const d = Math.abs(x - w.hub.x) + Math.abs(y - w.hub.y);
        if (d < bestD) [bestD, best] = [d, [x, y]];
      }
    return best;
  });
  await build(page, info, ...(await uncoveredTile(page, ...node)));
  await expect(step).toContainText('7 of');

  // The furnace goes right in front of the extractor's arrow.
  await page.click('[data-tool="furnace"]');
  await settled(page.locator('#tutorial .tip'));
  await cameraSettled(page);
  const out = await page.evaluate(() => {
    const w = window.game.world;
    const o = w.outputTile(w.state.buildings.find((b: { type: string }) => b.type === 'extractor'));
    return [o.x, o.y] as [number, number];
  });
  await build(page, info, ...(await uncoveredTile(page, ...out)));
  await expect(step).toContainText('8 of');

  // Collect its plates by hand.
  await page.click('[data-tool="furnace"]'); // put the tool down
  const furnace = await page.evaluate(() => {
    const f = window.game.world.state.buildings.find((b: { type: string }) => b.type === 'furnace');
    f.outputs = ['iron_plate', 'iron_plate'];
    return [f.x, f.y] as [number, number];
  });
  await tap(page, info, ...(await uncoveredTile(page, ...furnace)));
  await expect(page.locator('#info [data-action="collect"]')).toHaveText(/Collect 2/);
  await page.click('#info [data-action="collect"]');
  // The engineer fetches them, then carries them back to the hub.
  await expect
    .poll(() => page.evaluate(() => window.game.world.state.players[0].carry.filter((i: string) => i === 'iron_plate').length), { timeout: 30000 })
    .toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.game.world.moveTo(window.game.world.hub.x - 1, window.game.world.hub.y + 2));
  await expect.poll(() => stockOf('iron_plate'), { timeout: 30000 }).toBeGreaterThanOrEqual(2);
  await expect(step).toContainText('9 of');
  await page.click('.tip-next');

  // Logistics, from the hub.
  await expect(step).toContainText('10 of');
  await selectHub(page, info);
  await page.click('#info [data-action="research"]');
  await page.click('[data-research="logistics"]');
  await page.click('#research [data-close]');
  await expect(step).toContainText('11 of');
  await page.evaluate(() => {
    window.game.world.state.research.paid.logistics = { iron_plate: 999 }; // finish it now
  });
  await expect.poll(() => page.evaluate(() => window.game.world.isUnlocked('belt'))).toBe(true);
  await page.evaluate(() => (window.game.world.state.inventory.iron_plate = 20));

  // Three belts east from the furnace's output.
  await page.click('[data-tool="belt"]');
  await settled(page.locator('#tutorial .tip')); // the card moves out of the way
  await cameraSettled(page);
  const belts = await page.evaluate(() => {
    const w = window.game.world;
    const f = w.state.buildings.find((b: { type: string }) => b.type === 'furnace');
    const o = w.outputTile(f);
    return [0, 1, 2].map((i) => [o.x + i, o.y] as [number, number]);
  });
  for (const [x, y] of belts) await build(page, info, ...(await uncoveredTile(page, x, y)));
  await expect(step).toContainText('12 of');
  await page.click('.tip-next');

  // Logistics also unlocked splitters, which have a lesson of their own.
  await expect(step).toHaveText(/^Splitters/);
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();

  // Bugs: the first time a nest is provoked. It waits for Basic Defense, researched from the hub.
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.nests[0].angryUntil = w.state.time + 600;
  });
  await expect(step).toHaveText(/^Bugs/);
  await page.click('.tip-next');
  await page.evaluate(() => {
    const w = window.game.world;
    for (const n of w.state.nests) n.angryUntil = 0;
  });
  await selectHub(page, info); // with the belt still in hand: tapping the hub selects it
  await page.click('#info [data-action="research"]');
  await page.click('[data-research="defense"]');
  await expect(page.locator('#research-body')).toContainText('Researching');
  await page.click('#research [data-close]');
  await page.evaluate(() => {
    window.game.world.state.research.paid.defense = { iron_plate: 999 }; // finish it now
  });
  await expect.poll(() => page.evaluate(() => window.game.world.state.researched.includes('defense'))).toBe(true);
  await expect(page.locator('#tutorial')).toBeHidden();

  // Replay from the menu, then switch lessons off.
  await page.click('#menu-btn');
  await page.click('#btn-tutorial');
  await expect(page.locator('#lessons-list .lesson-seen')).toHaveCount(3);
  await page.click('[data-lesson="essentials"]');
  await expect(step).toHaveText(/^Essentials/);
  await page.click('.tip-hide');
  await expect(page.locator('#tutorial')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('foundry-front-profile')!).tipsOff)).toBe(true);
});

test('New game can bring the Essentials tutorial back for a returning player', async ({ page }) => {
  await newGame(page, { lessonsSeen: ['essentials'], tipsOff: true, tutorial: true });
  await expect(stepLabel(page)).toHaveText(/^Essentials/);
});

test('New game starts without the tutorial when the box is unticked', async ({ page }) => {
  await newGame(page, { lessonsSeen: [], tutorial: false, fresh: true });
  await page.waitForTimeout(500);
  await expect(page.locator('#tutorial')).toBeHidden();
});

test('Reset tutorials marks every lesson unseen and switches lessons back on', async ({ page }) => {
  await newGame(page, { lessonsSeen: ALL_LESSONS, tipsOff: true });
  await page.click('#menu-btn');
  await page.click('#btn-tutorial');
  await expect(page.locator('#lessons-list .lesson-seen')).toHaveCount(ALL_LESSONS.length);
  await expect(page.locator('#tips-toggle')).not.toBeChecked();
  await page.click('#btn-reset-lessons');
  await expect(page.locator('#lessons-list .lesson-seen')).toHaveCount(0);
  await expect(page.locator('#tips-toggle')).toBeChecked();
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('foundry-front-profile')!));
  expect(profile.lessonsSeen).toEqual([]);
  expect(profile.tipsOff).toBe(false);
});
