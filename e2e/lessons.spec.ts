import { ALL_LESSONS, buildTile, cameraSettled, expect, isTouch, newGame, putDown, selectHub, settled, stepLabel, tap, test, uncoveredTile } from './helpers';

test('the Essentials, Smelting and Bugs lessons run, then can be replayed and switched off', async ({ page }, info) => {
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

  // Chop a tree by hand: a tap sends the engineer over, then eight taps fell it for two logs, which they carry.
  await expect(step).toContainText('3 of');
  await expect(page.locator('#tutorial .tip-text')).toContainText('0 of 23');
  await settled(page.locator('#tutorial .spot'));
  await cameraSettled(page);
  // The tree the lesson's spotlight is on (as nearestTrees finds it), so the lesson card keeps clear of it.
  const tree = await page.evaluate(() => {
    const w = window.game.world;
    const cx = w.hub.x + 5 / 2;
    const cy = w.hub.y + 5 / 2;
    let best: [number, number] = [0, 0];
    let bestD = Infinity;
    w.state.trees.forEach((t: number, i: number) => {
      if (t !== 1) return;
      const d = Math.hypot((i % w.state.width) - cx, Math.floor(i / w.state.width) - cy);
      if (d < bestD) [bestD, best] = [d, [i % w.state.width, Math.floor(i / w.state.width)]];
    });
    return best;
  });
  const logs = () => page.evaluate(() => window.game.world.state.players[0].slots.reduce((n: number, s: { item: string; n: number } | null) => n + (s?.item === 'log' ? s.n : 0), 0));
  // A tap that lands while the camera glides can miss the tree and send the engineer elsewhere: then try again.
  for (let attempt = 0; attempt < 3 && (await logs()) === 0; attempt++) {
    await cameraSettled(page);
    await tap(page, info, ...(await uncoveredTile(page, ...tree)));
    await expect.poll(() => page.evaluate(() => window.game.world.state.players[0].path.length), { timeout: 30000 }).toBe(0); // arrived
    await cameraSettled(page);
    const here = await uncoveredTile(page, ...tree); // the camera may have moved while it walked
    // On a slow machine a tap can land late, so keep tapping until the tree comes down.
    for (let i = 0; i < 30 && (await logs()) === 0; i++) await tap(page, info, ...here);
  }
  expect(await logs()).toBe(2);
  expect(await page.evaluate(([x, y]) => window.game.world.treeAt(x, y), tree)).toBe(2); // a stump
  // The rest of the logs, as if chopped.
  await page.evaluate(() => {
    const p = window.game.world.state.players[0];
    p.slots[5] = { item: 'log', n: 10 };
    p.slots[6] = { item: 'log', n: 10 };
    p.slots[7] = { item: 'log', n: 1 };
  });
  await expect(step).toContainText('4 of');

  // Back to the hub, where the logs go into stock.
  await page.evaluate(() => window.game.world.moveTo(window.game.world.hub.x - 1, window.game.world.hub.y + 2));
  await expect(step).toContainText('5 of', { timeout: 30000 });
  expect(await stockOf('log')).toBe(23);

  // Forestry, from the hub.
  await selectHub(page, info);
  await page.click('#info [data-action="research"]');
  await page.click('[data-research="forestry"]');
  await page.click('#research [data-close]');
  await expect(step).toContainText('6 of');
  await page.evaluate(() => {
    window.game.world.state.research.paid.forestry = { log: 999 }; // finish it now
  });
  await expect.poll(() => page.evaluate(() => window.game.world.isUnlocked('lumber_camp'))).toBe(true);

  // A Lumber Camp beside the trees nearest the hub, with room for the sawmill at its output.
  const spot = await page.evaluate(() => {
    const w = window.game.world;
    const cx = w.hub.x + 2;
    const cy = w.hub.y + 2;
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let y = cy - 40; y < cy + 40; y++) {
      for (let x = cx - 40; x < cx + 40; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d >= bestD || w.checkPlace('lumber_camp', x, y, 0) || w.checkPlace('sawmill', x + 2, y, 0)) continue;
        if (!w.treesInReach(x, y, 2, 2).trees.length) continue;
        // Building within 16 tiles of a nest would start the Bugs lesson ahead of the ones this test expects.
        if (w.state.nests.some((n: { x: number; y: number }) => Math.hypot(n.x + 5 - x, n.y + 5 - y) < 22)) continue;
        best = [x, y];
        bestD = d;
      }
    }
    return best;
  });
  expect(spot, 'room for a camp and sawmill beside some trees').not.toBeNull();
  await page.click('[data-tool="lumber_camp"]');
  await settled(page.locator('#tutorial .tip'));
  await buildTile(page, info, ...spot!);
  await expect(step).toContainText('7 of');

  // The sawmill, once there are logs for it, at the camp's output.
  await page.evaluate(() => (window.game.world.state.inventory.log = 20));
  await page.click('[data-tool="sawmill"]');
  await settled(page.locator('#tutorial .tip'));
  await buildTile(page, info, spot![0] + 2, spot![1]);
  await expect(step).toContainText('8 of');

  // Collect its planks by hand and bring them to the hub.
  await putDown(page, 'sawmill');
  // Selected directly: a tap could land on the lumber camp next to it while the camera glides.
  await page.evaluate(() => {
    const b = window.game.world.state.buildings.find((b: { type: string }) => b.type === 'sawmill');
    b.outputs = ['plank', 'plank'];
    window.game.ui.selected = b.id;
  });
  await expect(page.locator('#info')).toContainText('Sawmill');
  await page.click('#info [data-action="collect"]');
  const planks = () => page.evaluate(() => window.game.world.state.players[0].slots.reduce((n: number, s: { item: string; n: number } | null) => n + (s?.item === 'plank' ? s.n : 0), 0));
  await expect.poll(planks, { timeout: 30000 }).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.game.world.moveTo(window.game.world.hub.x - 1, window.game.world.hub.y + 2));
  await expect(step).toContainText('9 of', { timeout: 30000 });
  await page.click('.tip-next');
  await expect(step).toContainText('10 of');
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();

  // Industry starts the Smelting lesson. With stone and ore in stock, its first step is done.
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.inventory = { plank: 999, stone: 999, truss: 999 };
    w.state.researched.push('workshop', 'carpentry', 'defense2');
    w.researchNow('industry');
    w.state.inventory = { stone: 10, iron_ore: 4 };
  });
  await expect(step).toHaveText(/^Smelting · 2/);

  // Pick the extractor, then build it over the highlighted ore.
  await page.click('[data-tool="extractor"]');
  if (isTouch(info)) await expect(page.locator('#tutorial .tip-text')).toContainText('tap ✓');
  await expect(page.locator('#tutorial .tip-text')).toContainText(isTouch(info) ? 'tap the iron ore' : 'click the iron ore');
  await settled(page.locator('#tutorial .spot')); // it glides to the ore
  await cameraSettled(page);
  // A clear patch of iron ore made for the test, with room east of it for the furnace and belts, and no
  // bugs nearby (maps are random, and ore lies 20+ tiles out, D-097).
  const node = await page.evaluate(() => {
    const w = window.game.world;
    const s = w.state;
    // The spot 24 to 34 tiles out farthest from any nest (building within 16 tiles of one starts the
    // Bugs lesson ahead of the ones this test expects).
    const nearest = (x: number, y: number) => Math.min(...s.nests.map((n: { x: number; y: number }) => Math.hypot(n.x + 5 - x, n.y + 5 - y)));
    let [x, y, best] = [0, 0, -1];
    for (let r = 24; r <= 34; r += 2) {
      for (let k = 0; k < 24; k++) {
        const sx = Math.round(w.hub.x + 4 + r * Math.cos((k * Math.PI) / 12));
        const sy = Math.round(w.hub.y + 4 + r * Math.sin((k * Math.PI) / 12));
        const d = nearest(sx + 4, sy);
        if (d > best) [x, y, best] = [sx, sy, d];
      }
    }
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 9; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.resources[w.idx(x + dx, y + dy)] = 1;
    w.layout++; // redraw the ground
    return [x, y] as [number, number];
  });
  await buildTile(page, info, ...node);
  await expect(step).toContainText('3 of');

  // The furnace goes right in front of the extractor's arrow.
  await page.click('[data-tool="furnace"]');
  await settled(page.locator('#tutorial .tip'));
  await cameraSettled(page);
  const out = await page.evaluate(() => {
    const w = window.game.world;
    const o = w.outputTile(w.state.buildings.find((b: { type: string }) => b.type === 'extractor'));
    return [o.x, o.y] as [number, number];
  });
  await buildTile(page, info, ...out);
  await expect(step).toContainText('4 of');

  // Collect its ingots by hand (D-113).
  await putDown(page, 'furnace');
  const furnace = await page.evaluate(() => {
    const f = window.game.world.state.buildings.find((b: { type: string }) => b.type === 'furnace');
    f.outputs = ['iron_ingot', 'iron_ingot'];
    return [f.x, f.y] as [number, number];
  });
  await tap(page, info, ...(await uncoveredTile(page, ...furnace)));
  await expect(page.locator('#info [data-action="collect"]')).toHaveText(/Collect [2-4]/); // it may finish more ingots meanwhile
  // Ore lies 20+ tiles out (D-097): skip the engineer's walk there and back, which isn't what this tests.
  await page.evaluate(([x, y]) => Object.assign(window.game.world.state.players[0], { x: x - 0.5, y: y + 0.5, path: [] }), furnace);
  await page.click('#info [data-action="collect"]');
  // The engineer fetches them, then carries them back to the hub. (Next to the hub, they go straight in.)
  const ingots = () =>
    page.evaluate(() => {
      const w = window.game.world;
      return w.state.players[0].slots.reduce((n: number, s: { item: string; n: number } | null) => n + (s?.item === 'iron_ingot' ? s.n : 0), 0) + (w.state.inventory.iron_ingot ?? 0);
    });
  await expect.poll(ingots, { timeout: 30000 }).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => {
    const w = window.game.world;
    Object.assign(w.state.players[0], { x: w.hub.x - 1.5, y: w.hub.y + 2.5, path: [] }); // beside the hub: it drops off
  });
  await expect.poll(() => stockOf('iron_ingot'), { timeout: 30000 }).toBeGreaterThanOrEqual(2);
  // Blacksmith, from the hub.
  await expect(step).toContainText('5 of');
  await selectHub(page, info);
  await page.click('#info [data-action="research"]');
  await page.click('[data-research="blacksmith"]');
  await page.click('#research [data-close]');
  await expect(step).toContainText('6 of');
  await page.evaluate(() => {
    window.game.world.state.research.paid.blacksmith = { iron_ingot: 999, stone: 999 }; // finish it now
  });
  await expect.poll(() => page.evaluate(() => window.game.world.isUnlocked('blacksmith'))).toBe(true);
  await page.evaluate(() => Object.assign(window.game.world.state.inventory, { iron_ingot: 20, stone: 20 }));

  // The blacksmith goes right in front of the furnace's arrow.
  await page.click('[data-tool="blacksmith"]');
  await settled(page.locator('#tutorial .tip')); // the card moves out of the way
  await cameraSettled(page);
  const anvil = await page.evaluate(() => {
    const w = window.game.world;
    const o = w.outputTile(w.state.buildings.find((b: { type: string }) => b.type === 'furnace'));
    return [o.x, o.y] as [number, number];
  });
  await buildTile(page, info, ...anvil);
  await expect(step).toContainText('7 of');
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();

  // Logistics unlocks splitters, which have a lesson of their own.
  await putDown(page, 'blacksmith');
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.inventory.iron_plate = 20;
    w.state.research.active = 'logistics';
    w.state.research.paid.logistics = { iron_plate: 999, iron_rod: 999, brick: 999 }; // finish it now
  });
  await expect(step).toHaveText(/^Splitters/);
  await page.click('.tip-next');
  await expect(page.locator('#tutorial')).toBeHidden();

  // Bugs: the first time a nest is provoked. It waits for Advanced Defense (turrets), researched from the hub once Hydraulics is done.
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
  // Advanced Defense needs Hydraulics (D-117); a well already built keeps the Water power lesson away.
  await page.evaluate(() => {
    const w = window.game.world;
    w.state.researched.push('hydraulics');
    w.state.inventory = { ...w.state.inventory, brick: 99, iron_plate: 99, iron_rod: 99 };
    for (let d = 8; d < 40 && !w.state.buildings.some((b: { type: string }) => b.type === 'well'); d++) w.place('well', w.hub.x - d, w.hub.y - d, 0);
  });
  await selectHub(page, info);
  await page.click('#info [data-action="research"]');
  await page.click('[data-research="defense"]');
  await expect(page.locator('#research-body')).toContainText('Researching');
  await page.click('#research [data-close]');
  await page.evaluate(() => {
    window.game.world.state.research.paid.defense = { iron_plate: 999, copper_ingot: 999, rivet: 999, brick: 999 }; // finish it now
  });
  await expect.poll(() => page.evaluate(() => window.game.world.state.researched.includes('defense'))).toBe(true);
  await expect(page.locator('#tutorial')).toBeHidden();

  // Replay from the menu, then switch lessons off.
  await page.click('#menu-btn');
  await page.click('#btn-tutorial');
  await expect(page.locator('#lessons-list .lesson-seen')).toHaveCount(4);
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
