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
  // A stand-in blueprint: the pool is empty until the special buildings come (D-126).
  for (const p of [host, guest])
    await p.evaluate(() => {
      const bp = { id: 'stand_in', name: 'Stand-in', description: 'A test blueprint.', unlocks: ['tesla'] };
      window.game.blueprints.list.push(bp);
      window.game.blueprints.byId[bp.id] = bp;
      window.game.world.state.ship.offer = ['stand_in'];
    });
  await host.locator('#speed [data-speed="1"]').click(); // the host plays on: the card doesn't pause
  for (const p of [host, guest]) {
    await expect(p.locator('#blueprints')).toBeVisible();
    await expect(p.locator('#blueprints')).toHaveClass(/offer-card/);
    // Just below the card, the map still takes taps.
    expect(await p.evaluate(() => document.elementFromPoint(innerWidth / 2, document.querySelector('#blueprints .card')!.getBoundingClientRect().bottom + 12)?.id)).toBe('game');
  }
  expect(await host.evaluate(() => window.game.ui.speed)).toBe(1);
  await guest.locator('[data-blueprint="stand_in"]').click();
  for (const p of [host, guest]) {
    await expect.poll(() => p.evaluate(() => window.game.world.state.ship.blueprints.join())).toBe('stand_in');
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
  expect(await guest.evaluate(() => localStorage.getItem('nestfall-coop-save') != null)).toBe(true);
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

// Rooms players made on the server (D-164): the main room lists them; each has its own status. The relay
// and the server's desk are faked here.
test("the server's made rooms are listed with their own status, and a new one is made through its desk", async ({ page }) => {
  const statuses: Record<string, object> = {};
  await page.route(/http:\/\/relay\.test\/rooms\/(\w+)\/status/, (r) => {
    const code = r.request().url().split('/')[4];
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(statuses[code] ?? { open: false, away: false, version: null, players: 0, max: 10, info: null }) });
  });
  const asked: { url: string; ask: Record<string, string> }[] = [];
  const joined: string[] = [];
  await page.routeWebSocket(/ws:\/\/relay\.test\/rooms\//, (ws) => {
    const url = ws.url();
    if (!url.includes('/rooms/CREWZZ')) {
      // Joining a room: seen, then turned away (no game to send here).
      joined.push(url);
      ws.send(JSON.stringify({ t: 'refused', reason: 'no-room' }));
      return ws.close();
    }
    // The desk: lets the player in, and makes the room it asks for.
    ws.send(JSON.stringify({ t: 'welcome', slot: 1, players: [0, 1] }));
    ws.onMessage((m) => {
      const ask = JSON.parse(String(m));
      asked.push({ url, ask });
      ws.send(JSON.stringify({ t: 'host', data: JSON.stringify(ask.t === 'new' ? { t: 'made', code: ask.code } : { t: 'done' }) }));
    });
  });
  await setProfile(page, { lessonsSeen: ALL_LESSONS, tipsOff: true });
  // This browser made the first room (D-165): it keeps the key that lets it change it.
  await page.addInitScript(() => localStorage.setItem('nestfall-room-key-CREWAB', 'ab'.repeat(16)));
  await page.goto('/?relay=ws://relay.test&server=CREW42');
  const versionBox = page.locator('.app-version').first();
  await expect(versionBox).not.toBeEmpty();
  const version = await versionBox.textContent();
  const rooms = [
    { code: 'CREWAB', name: 'Night shift' },
    { code: 'CREWCD', name: '<b>Busy</b>' },
    { code: 'CREWEF', name: 'Gone' },
  ];
  statuses.CREW42 = { open: true, away: false, version, players: 9, max: 10, info: { name: 'Crew', day: 3, season: 'Spring', desk: 'CREWZZ', rooms } };
  statuses.CREWAB = { open: true, away: false, version, players: 2, max: 10, info: { name: 'Night shift', day: 40, season: 'Fall' } };
  statuses.CREWCD = { open: true, away: false, version, players: 9, max: 10, info: { name: 'Busy', day: 1, season: 'Spring' } };

  await page.click('#mm-coop');
  const list = page.locator('#coop-room-list li');
  await expect(list).toHaveCount(3);
  // A full main room still lists the others.
  await expect(page.locator('#coop-server')).toHaveAttribute('data-state', 'full');
  await expect(list.nth(0)).toHaveAttribute('data-state', 'online');
  await expect(list.nth(0)).toContainText('Day 40 · Fall · 2 of 9 players');
  await expect(list.nth(0).locator('button[data-code]')).toBeEnabled();
  // Names are text, never markup.
  await expect(list.nth(1).locator('b')).toHaveText('<b>Busy</b>');
  await expect(list.nth(1)).toHaveAttribute('data-state', 'full');
  await expect(list.nth(1).locator('button[data-code]')).toBeDisabled();
  await expect(list.nth(2)).toHaveAttribute('data-state', 'offline');

  // Only the room this browser made has a Manage button. Renaming sends the desk the key, and the new name.
  await expect(list.nth(0).locator('[data-manage]')).toBeVisible();
  await expect(list.nth(1).locator('[data-manage]')).toHaveCount(0);
  await list.nth(0).locator('[data-manage]').click();
  await expect(page.locator('#coop-manage-title')).toHaveText('Night shift');
  await page.fill('#coop-manage-name', 'Day shift');
  await page.click('#coop-manage button[type="submit"]');
  await expect(page.locator('#coop-status')).toHaveText('Renamed it Day shift.');
  expect(asked.at(-1)!.ask).toEqual({ t: 'rename', code: 'CREWAB', name: 'Day shift', key: 'ab'.repeat(16) });
  // Deleting asks twice.
  await page.click('#coop-manage-delete');
  await expect(page.locator('#coop-manage-delete')).toHaveText('Delete for good?');
  expect(asked).toHaveLength(1);
  await page.click('#coop-manage-delete');
  await expect(page.locator('#coop-status')).toHaveText('Deleted the room.');
  expect(asked.at(-1)!.ask).toEqual({ t: 'delete', code: 'CREWAB', key: 'ab'.repeat(16) });
  await expect(page.locator('#coop-manage')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('nestfall-room-key-CREWAB'))).toBeNull();
  asked.length = 0;

  // Join goes to that room's code.
  await page.locator('#coop-room-list button[data-code="CREWAB"]').click();
  await expect.poll(() => joined.length).toBe(1);
  expect(joined[0]).toContain('/rooms/CREWAB?role=guest');

  // Making one: the desk is asked for a room with the server's prefix, and the game joins it.
  await page.click('#coop-make-box summary');
  await page.fill('#coop-make-name', '  Weekend   crew ');
  await page.fill('#coop-make-pass', 'secret');
  await page.click('#coop-make button');
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0].ask).toMatchObject({ t: 'new', name: 'Weekend crew' });
  expect(asked[0].ask.code).toMatch(/^CREW[A-Z2-9]{2}$/);
  // Its password goes hashed, never as typed, and so does the key that will let this browser change it.
  expect(asked[0].ask.pass).toMatch(/^[0-9a-f]{64}$/);
  expect(asked[0].ask.owner).toMatch(/^[0-9a-f]{64}$/);
  expect(await page.evaluate((code) => localStorage.getItem(`nestfall-room-key-${code}`), asked[0].ask.code)).toMatch(/^[0-9a-f]{32}$/);
  await expect.poll(() => joined.length).toBe(2);
  expect(joined[1]).toContain(`/rooms/${asked[0].ask.code}?role=guest`);

  // A server without a desk has no form.
  statuses.CREW42 = { ...statuses.CREW42, players: 0, info: { name: 'Crew', rooms } };
  await page.locator('#coop [data-close]').first().click();
  await page.click('#mm-coop');
  await expect(page.locator('#coop-server')).toHaveAttribute('data-state', 'online');
  await expect(page.locator('#coop-make-box')).toBeHidden();
  await expect(list).toHaveCount(3);
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
