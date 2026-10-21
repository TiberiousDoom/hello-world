import { ALL_LESSONS, calm, expect, isTouch, newGame, stepLabel, tap, test } from './helpers';

test('A Friend, the stash and an audit', async ({ page }, info) => {
  await newGame(page, { lessonsSeen: ALL_LESSONS.filter((l) => l !== 'blackmarket') });
  await calm(page);
  await page.evaluate(() => {
    window.game.world.state.inventory = { iron_plate: 500, brick: 500, gear: 100, wire: 100 };
  });
  await expect(page.locator('#suspicion-btn')).toBeHidden();

  // A Friend writes; nothing is revealed until the email is read.
  await page.evaluate(() => {
    const s = window.game.world.state;
    s.blackMarket.contactAt = s.time + 0.5;
    s.company.contractsMissed = 1;
  });
  await expect.poll(() => page.evaluate(() => window.game.world.state.blackMarket.contacted)).toBe(true);
  await page.waitForTimeout(300);
  await expect(page.locator('#suspicion-btn')).toBeHidden();
  await expect(page.locator('#tutorial')).toBeHidden();

  await page.click('#mail-btn');
  await page.click('details.mail.unread summary');
  await page.click('#company [data-close]');
  await expect(page.locator('#suspicion-btn')).toBeVisible();
  await expect(stepLabel(page)).toHaveText(/^Black market/);
  await page.click('.tip-next');

  // A stash inside the watch ring (by hand) and one outside it.
  await page.click('[data-tool="stash"]');
  const near = await page.evaluate(() => {
    const h = window.game.world.hub;
    return window.game.camera.toScreen(h.x - 1.5, h.y + 4.5) as [number, number];
  });
  await tap(page, info, ...near);
  if (isTouch(info)) await page.click('[data-plan="confirm"]');
  await expect(page.locator('#tutorial')).toBeHidden();
  await page.evaluate(() => {
    const w = window.game.world;
    w.place('stash', w.hub.x - 20, w.hub.y + 1, 0);
  });
  if (isTouch(info)) await page.click('[data-tool="stash"]');
  else await page.mouse.click(5, 300, { button: 'right' });
  expect(await page.evaluate(() => window.game.ui.tool)).toBeNull();

  await page.click('#suspicion-btn');
  await expect(page.locator('#bm-body')).toContainText('1 piece there now');
  await page.click('#blackmarket [data-close]');

  // An audit: countdown, sweep, then findings. Standard mode fines and keeps the stashes.
  await page.evaluate(() => (window.game.world.state.blackMarket.suspicion = 100));
  await expect(page.locator('#suspicion-label')).toHaveText(/^Audit/);
  await page.evaluate(() => {
    const s = window.game.world.state;
    s.time = s.blackMarket.audit.at - 0.1;
    window.game.ui.speed = 4;
  });
  await expect
    .poll(() => page.evaluate(() => window.game.world.state.company.inbox[0].subject), { timeout: 20_000 })
    .toBe('Audit findings: unauthorised equipment');
  expect(await page.evaluate(() => window.game.world.state.buildings.filter((b: { type: string }) => b.type === 'stash').length)).toBe(2);
});
