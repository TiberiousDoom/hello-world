import { ALL_LESSONS, calm, expect, isTouch, newGame, selectHub, setProfile, test } from './helpers';

test('the top bar has only speed, the clock and the menu; hub stock shows above the selected hub and scrolls away with it', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  await expect(page.locator('#topbar > *')).toHaveCount(3);
  await expect(page.locator('#clock')).toContainText('Spring · Day 1');
  for (const gone of ['#hub-hp', '#wave', '#contract-btn', '#mail-btn', '#research-btn']) await expect(page.locator(gone)).toHaveCount(0);

  // Hidden until the hub is selected (or, with a mouse, pointed at).
  const stock = page.locator('#inventory');
  await expect(stock).toHaveClass(/away/);
  await selectHub(page, info);
  await expect(stock).not.toHaveClass(/away/);
  const box = (await stock.boundingBox())!;
  const [hx, hy] = await page.evaluate(() => {
    const h = window.game.world.hub;
    return window.game.camera.toScreen(h.x + 4, h.y); // the middle of the 8×8 hub's top edge
  });
  expect(box.y + box.height).toBeLessThanOrEqual(hy + 1);
  expect(Math.abs(box.x + box.width / 2 - hx)).toBeLessThan(4);

  // Scroll the hub off screen: the panel goes with it instead of sticking to an edge.
  await page.evaluate(() => (window.game.camera.x += 60));
  await expect.poll(async () => (await stock.boundingBox())!.x + (await stock.boundingBox())!.width).toBeLessThan(0);
});

test('picking a tool shows no panel; placed buildings do, and the hub holds Research', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  await page.click('[data-tool="belt"]');
  await expect(page.locator('#info')).toBeHidden();
  await selectHub(page, info);
  await expect(page.locator('#info')).toContainText('research available');
  await page.click('#info [data-action="research"]');
  await expect(page.locator('#research')).toBeVisible();
  await expect(page.locator('#research-body')).toContainText('Advanced Defense');

  // While stock changes (a busy factory), the list updates in place: the button a finger is on stays the
  // same element, so the tap lands (#86).
  const start = page.locator('#research-body [data-research="defense"]');
  const before = await start.elementHandle();
  await page.evaluate(() => {
    const inv = window.game.world.state.inventory;
    inv.iron_plate = (inv.iron_plate ?? 0) + 7;
    inv.stone = (inv.stone ?? 0) + 3;
  });
  await page.waitForTimeout(400); // the list redraws every 150 ms while it's open
  expect(await before!.evaluate((b) => b.isConnected)).toBe(true);

  // Close sits at the top right, and stays there when the list scrolls.
  const close = page.locator('#research [data-close]');
  const card = (await page.locator('#research .card').boundingBox())!;
  const atTopRight = async () => {
    const b = (await close.boundingBox())!;
    return b.y - card.y < 40 && card.x + card.width - (b.x + b.width) < 40;
  };
  expect(await atTopRight()).toBe(true);
  await page.locator('#research .card').evaluate((c) => (c.scrollTop = c.scrollHeight));
  expect(await atTopRight()).toBe(true);
  await close.click();
  await expect(page.locator('#research')).toBeHidden();
});

test('the stock panel fades while the pointer is over it, and hides when the hub is deselected', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  await selectHub(page, info);
  const stock = page.locator('#inventory');
  await expect(stock).not.toHaveClass(/away/);
  const box = (await stock.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (info.project.name === 'phone') {
    // A finger held down over it; lifting it brings the panel back.
    await page.evaluate(([x, y]) => {
      window.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerType: 'touch', isPrimary: true }));
    }, [x, y] as const);
    await expect(stock).toHaveClass(/peek/);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' })));
    await expect(stock).not.toHaveClass(/peek/);
  } else {
    await page.mouse.move(x, y);
    await expect(stock).toHaveClass(/peek/);
    await page.mouse.move(x, y + 200);
    await expect(stock).not.toHaveClass(/peek/);
  }
  await page.evaluate(() => (window.game.ui.selected = null));
  if (!isTouch(info)) await page.mouse.move(5, 300); // off the hub
  await expect(stock).toHaveClass(/away/);
});

test("the main menu shows the version, and What's new lists the changes until it's been seen", async ({ page }) => {
  await page.goto('/');
  const version = await page.evaluate(() => window.game.version);
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  await expect(page.locator('#mm-whatsnew')).toContainText(`v${version}`);
  await expect(page.locator('#mm-whatsnew .new-dot')).toBeVisible();
  await page.click('#mm-whatsnew');
  await expect(page.locator('#changelog')).toBeVisible();
  await expect(page.locator('#changelog .release[open] summary')).toContainText(`v${version}`);
  await expect(page.locator('#changelog .release[open] li').first()).toBeVisible(); // its notes are shown
  await expect(page.locator('#changelog .release:not([open])').first()).toBeAttached(); // older ones are folded
  await page.click('#changelog [data-close]');
  await expect(page.locator('#changelog')).toBeHidden();
  await expect(page.locator('#mm-whatsnew .new-dot')).toBeHidden();
  await page.reload();
  await expect(page.locator('#mm-whatsnew .new-dot')).toBeHidden(); // remembered
});

test('Send feedback builds a report with diagnostics, opens GitHub, copies it and downloads the save', async ({ page, context }, info) => {
  await newGame(page);
  await page.click('#menu-btn');
  await page.click('#btn-feedback');
  await expect(page.locator('#feedback')).toBeVisible();
  const speed = await page.evaluate(() => window.game.ui.speed);
  await page.fill('#fb-text', 'The splitter ate my plates');
  await page.press('#fb-text', ' '); // typing a space doesn't pause or unpause the game
  expect(await page.evaluate(() => window.game.ui.speed)).toBe(speed);
  await page.click('#fb-details summary');
  await expect(page.locator('#fb-diag-text')).toContainText(`Version: ${await page.evaluate(() => window.game.version)}`);

  await page.evaluate(() => {
    (window as unknown as { opened: string[] }).opened = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { opened: string[] }).opened.push(String(url));
      return null;
    };
  });
  await page.click('#fb-github');
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened);
  expect(opened).toHaveLength(1);
  const url = new URL(opened[0]);
  expect(url.searchParams.get('title')).toBe('Bug: The splitter ate my plates');
  expect(url.searchParams.get('body')).toContain('### Diagnostics');
  await expect(page.locator('#fb-status')).toContainText('Submit');

  if (info.project.name !== 'phone') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.click('#fb-copy');
    await expect(page.locator('#fb-status')).toContainText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('The splitter ate my plates');
  }

  const download = page.waitForEvent('download');
  await page.click('#fb-save');
  expect((await download).suggestedFilename()).toMatch(/^foundry-front-.*-save\.json$/);
});

test('a new Standard game can be Easy or Hard; the game keeps the choice (D-138)', async ({ page }) => {
  await setProfile(page, { lessonsSeen: ALL_LESSONS });
  await page.goto('/');
  await page.click('#mm-new');
  await expect(page.locator('[data-difficulty="normal"]')).toHaveClass(/active/);
  await page.click('[data-difficulty="hard"]');
  await expect(page.locator('[data-difficulty="hard"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#difficulty-note')).toContainText('+40%');
  await page.click('[data-mode="standard"]');
  await expect(page.locator('#mainmenu')).toBeHidden();
  expect(await page.evaluate(() => window.game.world.state.difficulty)).toBe('hard');
});

test("a wall's panel upgrades it a tier (D-142)", async ({ page }) => {
  await newGame(page);
  await calm(page);
  const id = await page.evaluate(() => {
    const w = window.game.world;
    const h = w.hub!;
    const [x, y] = [h.x - 3, h.y + 7];
    w.state.trees[w.idx(x, y)] = 0;
    w.state.resources[w.idx(x, y)] = 0;
    for (const r of ['defense', 'plating']) if (!w.state.researched.includes(r)) w.state.researched.push(r);
    Object.assign(w.state.inventory, { chitin: 50, stone: 200, iron_plate: 200, brick: 200, log: 200, plank: 200 });
    const b = w.place('wall', x, y, 0, false);
    if (typeof b === 'string') throw new Error(b);
    window.game.ui.selected = b.id;
    return b.id;
  });
  await expect(page.locator('#info')).toContainText('Tier 1 of 4');
  await page.locator('#info [data-action="upgrade"]').click();
  await expect(page.locator('#info')).toContainText('Tier 2 of 4');
  expect(await page.evaluate((i) => window.game.world.byId.get(i)!.tier, id)).toBe(2);
});

test("the hub's panel lists its stock by name, for touch as well as mouse", async ({ page }, info) => {
  await newGame(page);
  await selectHub(page, info);
  await expect(page.locator('#info .stock-list')).toContainText('Iron Plate');
  await expect(page.locator('#info .stock-list')).toContainText('100');
});
