import { Page } from '@playwright/test';
import { ALL_LESSONS, expect, setProfile, test } from './helpers';

// Co-op phase 1 (D-078): two games in one browser, joined through the local room (`?relay=local`, a
// BroadcastChannel running the relay's own rules), so the test needs no network.

async function open(page: Page, lessonsSeen: string[]): Promise<void> {
  await setProfile(page, { lessonsSeen, tipsOff: false });
  await page.goto('/?relay=local');
  await page.click('#mm-coop');
  await expect(page.locator('#coop')).toBeVisible();
}

const ticks = (page: Page) => page.evaluate(() => Math.round(window.game.world.state.time * 20));

test('two players host and join with a code, and play one game', async ({ page: host }) => {
  const guest = await host.context().newPage();
  const guestErrors: string[] = [];
  guest.on('pageerror', (e) => guestErrors.push(e.message));

  await open(host, []); // the host hasn't seen the lessons: the first one must not pause the shared game
  await host.click('#coop-host-new');
  const code = host.locator('#coop-room-code');
  await expect(code).toHaveText(/^[A-Z2-9]{6}$/);
  await expect(host.locator('#coop-start')).toBeDisabled();

  await open(guest, ALL_LESSONS);
  await guest.fill('#coop-code', (await code.textContent())!.toLowerCase());
  await guest.click('#coop-join button[type="submit"]');
  await expect(guest.locator('#coop-status')).toContainText('Waiting for the host');
  await expect(host.locator('#coop-players li')).toHaveCount(2);
  await expect(guest.locator('#coop-players li').nth(1)).toContainText('You');

  await host.click('#coop-start');
  await expect(host.locator('#mainmenu')).toBeHidden();
  await expect(guest.locator('#mainmenu')).toBeHidden();

  // Both engineers are in both games; the guest's is the second one, and the guest has no speed buttons.
  for (const p of [host, guest]) expect(await p.evaluate(() => window.game.world.state.players.map((q: { id: number }) => q.id))).toEqual([0, 1]);
  expect(await guest.evaluate(() => window.game.ui.player)).toBe(1);
  await expect(guest.locator('#speed')).toBeHidden();
  await expect(host.locator('#speed')).toBeVisible();

  // The host's first lesson explains without stopping the clock, and the guest's game keeps up.
  await expect(host.locator('#tutorial')).toBeVisible();
  expect(await host.evaluate(() => window.game.ui.speed)).toBe(1);
  const before = await ticks(guest);
  await expect.poll(() => ticks(guest)).toBeGreaterThan(before + 10);

  // The guest walks its engineer with the keys; the move travels to the host and back.
  const start = await host.evaluate(() => window.game.world.state.players[1].x);
  await guest.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await guest.keyboard.down('d');
  await expect.poll(() => host.evaluate(() => window.game.world.state.players[1].x), { timeout: 5000 }).toBeGreaterThan(start + 1);
  await guest.keyboard.up('d');
  expect(await host.evaluate(() => window.game.world.state.players[0].x)).toBeLessThan(start + 0.5); // not the host's own

  // The host pauses: the guest runs on to the host's tick and stops there, and the two games are the same.
  await host.locator('#speed [data-speed="0"]').click();
  await expect.poll(() => guest.evaluate(() => window.game.coop.guest.speed)).toBe(0);
  await expect.poll(async () => (await ticks(guest)) === (await ticks(host)), { timeout: 5000 }).toBe(true);
  const look = (p: Page) => p.evaluate(() => JSON.stringify([window.game.world.state.players, window.game.world.state.rng, window.game.world.state.enemies]));
  expect(await look(guest)).toBe(await look(host));
  expect(await guest.evaluate(() => window.game.coop.guest.desyncedAt)).toBeNull();
  expect(await guest.evaluate(() => window.game.ui.speed)).toBe(0); // the host's pause is everyone's

  // The guest points at a spot (P under the mouse): it shows on the host's map in the guest's colour.
  const spot = await guest.evaluate(() => {
    const h = window.game.world.hub;
    window.game.ui.hover = { x: h.x + 2, y: h.y - 3 };
    return window.game.ui.hover;
  });
  await guest.keyboard.press('p');
  await expect.poll(() => host.evaluate(() => window.game.ui.pings.map((p: { player: number; x: number; y: number }) => [p.player, p.x, p.y]))).toEqual([[1, spot.x, spot.y]]);
  expect(await guest.evaluate(() => window.game.ui.pings.length)).toBe(1); // shown at once on the guest's own screen

  // The colony's offer is a card that leaves the map playable, and the first pick is everyone's.
  for (const p of [host, guest]) await p.evaluate(() => (window.game.world.state.ship.offer = ['express_belt', 'tesla']));
  await host.locator('#speed [data-speed="1"]').click(); // the host plays on: the card doesn't pause
  for (const p of [host, guest]) {
    await expect(p.locator('#blueprints')).toBeVisible();
    await expect(p.locator('#blueprints')).toHaveClass(/offer-card/);
    // Just below the card, the map still takes taps.
    expect(await p.evaluate(() => document.elementFromPoint(innerWidth / 2, document.querySelector('#blueprints .card')!.getBoundingClientRect().bottom + 12)?.id)).toBe('game');
  }
  expect(await host.evaluate(() => window.game.ui.speed)).toBe(1);
  await guest.locator('[data-blueprint="tesla"]').click();
  for (const p of [host, guest]) {
    await expect.poll(() => p.evaluate(() => window.game.world.state.ship.blueprints.join())).toBe('tesla');
    await expect(p.locator('#blueprints')).toBeHidden();
  }
  await host.locator('#speed [data-speed="0"]').click();

  // The host leaves: the guest is told, back at the main menu.
  await host.evaluate(() => {
    document.getElementById('menu-btn')!.click();
    document.getElementById('btn-mainmenu')!.click();
  });
  await expect(guest.locator('#coop-status')).toContainText('host left');
  await expect(guest.locator('#coop-status')).toContainText('saved in this browser');
  await expect(guest.locator('#mainmenu')).toBeVisible();
  // Every player keeps the shared game, to host it later (D-079).
  await expect(guest.locator('#coop-host-coop')).toBeVisible();
  expect(await guest.evaluate(() => localStorage.getItem('foundry-front-coop-save') != null)).toBe(true);
  expect(guestErrors).toEqual([]);
});

test('a player joins a game under way, and gets back in step after falling behind', async ({ page: host }) => {
  const guest = await host.context().newPage();
  await open(host, ALL_LESSONS);
  await host.click('#coop-host-new');
  await expect(host.locator('#coop-room-code')).toHaveText(/^[A-Z2-9]{6}$/);
  const code = (await host.locator('#coop-room-code').textContent())!;
  await open(guest, ALL_LESSONS);
  await guest.fill('#coop-code', code);
  await guest.click('#coop-join button[type="submit"]');
  await expect(host.locator('#coop-players li')).toHaveCount(2);
  await host.click('#coop-start');
  await expect(guest.locator('#mainmenu')).toBeHidden();

  const late = await host.context().newPage();
  await open(late, ALL_LESSONS);
  await late.fill('#coop-code', code);
  await late.click('#coop-join button[type="submit"]');
  await expect(late.locator('#mainmenu')).toBeHidden();
  await expect(host.locator('#toasts')).toContainText('Player 3 joined');
  expect(await late.evaluate(() => window.game.ui.player)).toBe(2);
  for (const p of [host, guest, late]) {
    await expect.poll(() => p.evaluate(() => window.game.world.state.players.map((q: { id: number }) => q.id).join())).toBe('0,1,2');
  }

  // A guest far behind the host (a phone that slept) takes a fresh copy instead of every missed tick.
  await guest.evaluate(() => {
    const g = window.game.coop.guest;
    g.through += 1000; // as if the host had run on for a minute while this game stood still
    window.game.oldWorld = window.game.world;
  });
  await expect(guest.locator('#toasts')).toContainText("Caught up with the host's game");
  expect(await guest.evaluate(() => window.game.world !== window.game.oldWorld)).toBe(true);
  await expect.poll(() => guest.evaluate(() => window.game.coop.guest.ahead)).toBeLessThan(40);

  // A code nobody hosts.
  const stranger = await host.context().newPage();
  await open(stranger, ALL_LESSONS);
  await stranger.fill('#coop-code', 'ZZZZZZ');
  await stranger.click('#coop-join button[type="submit"]');
  await expect(stranger.locator('#coop-status')).toContainText('No game has that code');
});

test("the host's connection drops: the others wait, and catch up when it's back", async ({ page: host }) => {
  const guest = await host.context().newPage();
  await open(host, ALL_LESSONS);
  await host.click('#coop-host-new');
  await expect(host.locator('#coop-room-code')).toHaveText(/^[A-Z2-9]{6}$/);
  const code = (await host.locator('#coop-room-code').textContent())!;
  await open(guest, ALL_LESSONS);
  await guest.fill('#coop-code', code);
  await guest.click('#coop-join button[type="submit"]');
  await expect(host.locator('#coop-players li')).toHaveCount(2);
  await host.click('#coop-start');
  await expect(guest.locator('#mainmenu')).toBeHidden();

  await host.evaluate(() => window.game.coop.link.drop());
  await expect(guest.locator('#toasts')).toContainText("The host's connection dropped");
  await expect(host.locator('#toasts')).toContainText('Back in the room');
  await expect(guest.locator('#toasts')).toContainText('The host is back');
  await expect(guest.locator('#toasts')).toContainText("Caught up with the host's game");
  // Both play on together.
  await host.locator('#speed [data-speed="0"]').click();
  await expect.poll(async () => (await ticks(guest)) === (await ticks(host)), { timeout: 5000 }).toBe(true);
  const look = (p: Page) => p.evaluate(() => JSON.stringify([window.game.world.state.players, window.game.world.state.rng]));
  expect(await look(guest)).toBe(await look(host));
});

// The dedicated server's card (D-086): its status comes from the relay, faked here.
test("the dedicated server's card shows its status, and Join works only when it can", async ({ page }) => {
  let body: object = { open: true, away: false, version: 'mine', players: 3, max: 10, info: { name: "Stephen's server", day: 12, season: 'Winter' } };
  await page.route('http://relay.test/rooms/CREW42/status', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }));
  await setProfile(page, { lessonsSeen: ALL_LESSONS, tipsOff: true });
  await page.goto('/?relay=ws://relay.test&server=CREW42');
  const versionBox = page.locator('.app-version').first();
  await expect(versionBox).not.toBeEmpty();
  const version = await versionBox.textContent();
  body = { ...body, version };
  const card = page.locator('#coop-server');
  const reopen = async () => {
    await page.locator('#coop [data-close]').first().click();
    await page.click('#mm-coop');
  };

  await page.click('#mm-coop');
  await expect(card).toHaveAttribute('data-state', 'online');
  await expect(page.locator('#coop-server-name')).toHaveText("Stephen's server");
  await expect(page.locator('#coop-server-players')).toHaveText('3 of 9');
  await expect(page.locator('#coop-server-game')).toHaveText('Day 12 · Winter');
  await expect(page.locator('#coop-server-join')).toBeEnabled();
  // The other ways to play are still there, apart from it.
  await expect(page.locator('#coop-host-new')).toBeVisible();
  await expect(page.locator('#coop-join')).toBeVisible();

  body = { open: false, away: false, version: null, players: 0, max: 10, info: null };
  await reopen();
  await expect(card).toHaveAttribute('data-state', 'offline');
  await expect(page.locator('#coop-server-join')).toBeDisabled();
  await expect(page.locator('#coop-server-note')).toContainText("isn't running");

  body = { open: true, away: false, version: '999.0.0', players: 0, max: 10, info: null };
  await reopen();
  await expect(card).toHaveAttribute('data-state', 'version');
  await expect(page.locator('#coop-server-state')).toHaveText('Reload');
  await expect(page.locator('#coop-server-join')).toBeDisabled();
});

test('Join the server joins its room with one button', async ({ page: host }) => {
  const guest = await host.context().newPage();
  await open(host, ALL_LESSONS);
  await host.click('#coop-host-new');
  // The code shows once the room is open: wait for it before reading it.
  const codeBox = host.locator('#coop-room-code');
  await expect(codeBox).toHaveText(/^[A-Z2-9]{6}$/);
  const code = (await codeBox.textContent())!;

  // The guest's server is that room. Another tab's local room can't be checked, so Join stays open.
  await setProfile(guest, { lessonsSeen: ALL_LESSONS, tipsOff: true });
  await guest.goto(`/?relay=local&server=${code}`);
  await guest.click('#mm-coop');
  await expect(guest.locator('#coop-server')).toHaveAttribute('data-state', 'unknown');
  await guest.click('#coop-server-join');
  await expect(host.locator('#coop-players li')).toHaveCount(2);
  await expect(guest.locator('#coop-players li').first()).toContainText('Server');
  await expect(guest.locator('#coop-status')).toContainText('Getting the game from the server');
  await host.click('#coop-start');
  await expect(guest.locator('#mainmenu')).toBeHidden();
  expect(await guest.evaluate(() => window.game.ui.player)).toBe(1);
});
