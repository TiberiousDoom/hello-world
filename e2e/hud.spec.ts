import { calm, expect, isTouch, newGame, selectHub, test } from './helpers';

test('the top bar has only speed and the menu; hub stock shows above the selected hub and scrolls away with it', async ({ page }, info) => {
  await newGame(page);
  await calm(page);
  await expect(page.locator('#topbar > *')).toHaveCount(2);
  for (const gone of ['#hub-hp', '#wave', '#contract-btn', '#mail-btn', '#research-btn']) await expect(page.locator(gone)).toHaveCount(0);

  // Hidden until the hub is selected (or, with a mouse, pointed at).
  const stock = page.locator('#inventory');
  await expect(stock).toHaveClass(/away/);
  await selectHub(page, info);
  await expect(stock).not.toHaveClass(/away/);
  const box = (await stock.boundingBox())!;
  const [hx, hy] = await page.evaluate(() => {
    const h = window.game.world.hub;
    return window.game.camera.toScreen(h.x + 2.5, h.y);
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
  await expect(page.locator('#research-body')).toContainText('Basic Defense');

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
