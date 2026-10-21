import { build, cameraSettled, expect, isTouch, newGame, selectHub, settled, stepLabel, test, uncoveredTile } from './helpers';

test('the Essentials and Bugs lessons run, then can be replayed and switched off', async ({ page }, info) => {
  await newGame(page, { lessonsSeen: [] });
  const step = stepLabel(page);
  const speed = () => page.evaluate(() => window.game.ui.speed);

  await expect(step).toHaveText(/^Essentials · 1/);
  expect(await speed()).toBe(0); // explanations pause the game
  await page.click('.tip-next');
  await expect.poll(speed).toBe(1); // action steps let it run

  // Pick the extractor, then build it over the highlighted ore.
  await page.click('[data-tool="extractor"]');
  if (isTouch(info)) await expect(page.locator('#tutorial .tip-text')).toContainText('tap ✓');
  await expect(page.locator('#tutorial .tip-text')).toContainText('tap the iron ore');
  await settled(page.locator('#tutorial .spot')); // it glides to the ore
  await cameraSettled(page);
  // The nearest iron ore with clear ground east of it for the belts and the furnace (maps are random).
  const node = await page.evaluate(() => {
    const w = window.game.world;
    const roomEast = (x: number, y: number) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = 1; dx <= 8; dx++) if (w.checkPlace('belt', x + dx, y + dy)) return false;
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
  await expect(step).toContainText('3 of');

  // Three belts east from the extractor's output, then a 2×2 furnace.
  await page.click('[data-tool="belt"]');
  await settled(page.locator('#tutorial .tip')); // the card moves out of the way
  await cameraSettled(page);
  const tiles = await page.evaluate(() => {
    const w = window.game.world;
    const ex = w.state.buildings.find((b: { type: string }) => b.type === 'extractor');
    const o = w.outputTile(ex);
    const belts = [0, 1, 2].map((i) => [o.x + i, o.y]);
    const furnace = [o.x + 3, o.y];
    const free = belts.every(([x, y]) => !w.checkPlace('belt', x, y)) && !w.checkPlace('furnace', furnace[0], furnace[1]);
    return free ? { belts, furnace } : null;
  });
  expect(tiles, 'room east of the extractor').not.toBeNull();
  for (const [x, y] of tiles!.belts) await build(page, info, ...(await uncoveredTile(page, x, y)));
  await expect(step).toContainText('4 of');
  await page.click('[data-tool="furnace"]');
  await settled(page.locator('#tutorial .tip'));
  await build(page, info, ...(await uncoveredTile(page, tiles!.furnace[0], tiles!.furnace[1])));
  await expect(step).toContainText('5 of');
  await page.evaluate(() => {
    const w = window.game.world;
    w.insert(w.hub, 'iron_plate', w.hub.x - 1, w.hub.y);
  });
  await expect(step).toContainText('6 of');
  await page.click('.tip-next');
  await expect(step).toContainText('7 of'); // Research lives in the hub
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
  await selectHub(page, info); // with the furnace still in hand: tapping the hub selects it
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
  await expect(page.locator('#lessons-list .lesson-seen')).toHaveCount(2);
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
  await newGame(page, { lessonsSeen: [], tutorial: false });
  await page.waitForTimeout(500);
  await expect(page.locator('#tutorial')).toBeHidden();
});
