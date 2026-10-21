import { build, calm, cameraSettled, expect, isTouch, newGame, settled, stepLabel, test, uncoveredTile } from './helpers';

test('the Essentials, Contracts and Defense lessons run, then can be replayed and switched off', async ({ page }, info) => {
  await newGame(page, { lessonsSeen: [] });
  await calm(page); // the test brings the first contract and wave in when it's ready for them
  const step = stepLabel(page);
  const speed = () => page.evaluate(() => window.game.ui.speed);

  await expect(step).toHaveText(/^Essentials · 1/);
  expect(await speed()).toBe(0); // explanations pause the game
  await page.click('.tip-next');
  await expect.poll(speed).toBe(1); // action steps let it run

  // Pick the extractor, then build on the highlighted node.
  await page.click('[data-tool="extractor"]');
  if (isTouch(info)) await expect(page.locator('#tutorial .tip-text')).toContainText('tap ✓');
  await expect(page.locator('#tutorial .tip-text')).toContainText('tap the iron ore node');
  await settled(page.locator('#tutorial .spot')); // it glides to the node
  // Let the camera finish gliding too, then aim at the node the lesson picked (the nearest free iron).
  await cameraSettled(page);
  const node = await page.evaluate(() => {
    const w = window.game.world;
    let best: [number, number] = [0, 0];
    let bestD = Infinity;
    for (let y = 0; y < w.state.height; y++)
      for (let x = 0; x < w.state.width; x++) {
        if (w.resourceAt(x, y) !== 'iron_ore' || w.buildingAt(x, y)) continue;
        const d = Math.abs(x - w.hub.x) + Math.abs(y - w.hub.y);
        if (d < bestD) [bestD, best] = [d, [x, y]];
      }
    return best;
  });
  await build(page, info, ...(await uncoveredTile(page, ...node)));
  await expect(step).toContainText('3 of');

  // Three belts and a furnace in a free line next to the extractor.
  await page.click('[data-tool="belt"]');
  await settled(page.locator('#tutorial .tip')); // the card moves out of the way
  // Centre on the extractor once the lesson's camera glide is over, let a frame
  // place the overlays, then pick the line.
  await cameraSettled(page);
  await page.evaluate(() => {
    const ex = window.game.world.state.buildings.find((b: { type: string }) => b.type === 'extractor');
    window.game.camera.x = ex.x + 0.5;
    window.game.camera.y = ex.y + 0.5;
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const line = await page.evaluate(() => {
    const w = window.game.world;
    const c = window.game.camera;
    const ex = w.state.buildings.find((b: { type: string }) => b.type === 'extractor');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tiles = [1, 2, 3, 4].map((i) => [ex.x + dx * i, ex.y + dy * i]);
      const pts = tiles.map(([x, y]) => c.toScreen(x + 0.5, y + 0.5) as [number, number]);
      // On screen and not under the tutorial card, the info panel or a toast.
      const onScreen = pts.every(([sx, sy]) => sx > 20 && sx < innerWidth - 20 && document.elementFromPoint(sx, sy)?.id === 'game');
      if (onScreen && tiles.every(([x, y]) => !w.checkPlace('belt', x, y))) return pts;
    }
    return null;
  });
  expect(line, 'a free line next to the extractor').not.toBeNull();
  for (const p of line!.slice(0, 3)) await build(page, info, ...p);
  await expect(step).toContainText('4 of');
  await page.click('[data-tool="furnace"]');
  await build(page, info, ...line![3]);
  await expect(step).toContainText('5 of');
  await page.evaluate(() => {
    const w = window.game.world;
    w.insert(w.hub, 'iron_plate', w.hub.x - 1, w.hub.y);
  });
  await expect(step).toContainText('6 of');
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();

  // Contracts: when the first contract arrives.
  await page.evaluate(() => (window.game.world.state.company.nextContractAt = window.game.world.state.time + 0.5));
  await expect(step).toHaveText(/^Contracts/);
  await page.click('.tip-next');
  await page.click('.tip-next');

  // Defense: at the first wave warning; it waits for Basic Defense.
  await page.evaluate(() => (window.game.world.state.nextWaveAt = window.game.world.state.time + 25));
  await expect(step).toHaveText(/^Defense/);
  await page.click('.tip-next');
  await page.click('#research-btn');
  await page.click('[data-research="defense"]');
  await expect(page.locator('#research-body')).toContainText('Researching');
  await page.click('#research [data-close]');
  await expect(page.locator('#research-label')).toHaveText(/Research · \d+%/);
  await page.evaluate(() => {
    const s = window.game.world.state;
    s.research.paid.defense = { iron_plate: 999 }; // finish it now
    s.nextWaveAt = 1e9;
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
  await newGame(page, { lessonsSeen: [], tutorial: false });
  await page.waitForTimeout(500);
  await expect(page.locator('#tutorial')).toBeHidden();
});
