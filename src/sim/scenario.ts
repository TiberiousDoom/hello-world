// A short, scripted game with a fight in it: building, demolishing and turning
// things while angry bugs chew through them. Unit tests replay it, and browser
// tests run it in Chromium, Firefox and WebKit to check every browser computes
// exactly the same game (co-op phase 0, D-058).

import { Command } from './commands';
import { BLUEPRINTS, BuildingType, CLOCK, Dir, HUB_SIZE, ITEM_IDS, RESEARCH } from './data';
import { hypot } from './math';
import { nestCentre } from './nests';
import { Session, hashText, summaryHash } from './session';
import { World } from './world';

/** A real map, nearly everything researched, plenty of stock, and the nearest nest angry for a long while. */
export function fightingWorld(seed = 7): { w: World; cx: number; cy: number } {
  const w = World.create(seed);
  w.state.researched = RESEARCH.map((r) => r.id).filter((id) => id !== 'assembly');
  w.state.inventory = {
    iron_plate: 9999,
    stone: 9999,
    iron_ore: 9999,
    brick: 9999,
    copper_ingot: 9999,
    gear: 9999,
    wire: 9999,
    motor: 9999,
    plank: 9999,
    rivet: 9999,
    iron_rod: 9999,
    log: 9999,
    stake: 9999,
  };
  const hub = w.hub!;
  const n = w.state.nests.slice().sort((a, b) => Math.abs(a.x - hub.x) + Math.abs(a.y - hub.y) - (Math.abs(b.x - hub.x) + Math.abs(b.y - hub.y)))[0];
  n.angryUntil = 1e9;
  w.markFlowDirty();
  // A spot between the nest and the hub, inside the bugs' reach.
  const [nx, ny] = nestCentre(n);
  const cx = Math.round(nx + (hub.x - nx) * 0.35);
  const cy = Math.round(ny + (hub.y - ny) * 0.35);
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) w.state.resources[w.idx(x, y)] = w.state.trees[w.idx(x, y)] = 0;
  return { w, cx, cy };
}

/** Some building, demolishing and turning, at set ticks: what a player might do during a fight. */
export function script(cx: number, cy: number): [number, Command][] {
  return [
    [0, { kind: 'place', type: 'wall', x: cx - 2, y: cy, dir: 0, replaceBelt: false }],
    [0, { kind: 'place', type: 'wall', x: cx - 1, y: cy, dir: 0, replaceBelt: false }],
    [0, { kind: 'place', type: 'turret', x: cx + 1, y: cy, dir: 0, replaceBelt: false }],
    [0, { kind: 'place', type: 'well', x: cx + 2, y: cy, dir: 0, replaceBelt: false }], // the turret's power (D-117)
    [40, { kind: 'research', id: 'assembly' }],
    [100, { kind: 'place', type: 'palisade', x: cx, y: cy - 2, dir: 0, replaceBelt: false }],
    [130, { kind: 'rotate', id: -1, dir: 2 }], // the turret, by id once known
    [200, { kind: 'place', type: 'belt', x: cx + 2, y: cy + 2, dir: 1, replaceBelt: false }],
    [260, { kind: 'pause-research' }],
    [300, { kind: 'place', type: 'repair', x: cx + 3, y: cy - 1, dir: 0, replaceBelt: false }],
    [420, { kind: 'demolish', id: -1 }],
    [500, { kind: 'place', type: 'wall', x: cx - 3, y: cy + 1, dir: 0, replaceBelt: false }],
  ];
}

/** Runs `session` to `end`, issuing the script's commands on their ticks (id -1: the turret). */
export function play(session: Session, steps: [number, Command][], end: number): void {
  for (const [tick, command] of steps) {
    session.runTo(tick);
    const turret = session.world.state.buildings.find((b) => b.type === 'turret');
    const c: Command = (command.kind === 'rotate' || command.kind === 'demolish') && command.id === -1 ? { ...command, id: turret?.id ?? 0 } : command;
    session.do(c);
  }
  session.runTo(end);
}

/** Runs the scripted game and fingerprints the result: the summary, and the whole saved game. */
export function runScenario(seed = 7, ticks = 1200): { summary: string; full: string } {
  const { w, cx, cy } = fightingWorld(seed);
  const s = new Session(w);
  play(s, script(cx, cy), ticks);
  return { summary: summaryHash(s.world), full: hashText(s.world.toJSON()) };
}

/**
 * The performance budget's case (ROADMAP: 60 fps on a mid-range phone with 1,000 buildings and 200 bugs):
 * a big base around the hub — belts carrying items, furnaces at work, turrets, repair stations,
 * teleporters, spike pits and walls — with 200 angry bugs at its edge, at night (when bugs reach furthest).
 */
export function benchWorld(seed = 11): World {
  const w = World.create(seed);
  w.freePower = true;
  w.clearWater();
  const s = w.state;
  s.researched = RESEARCH.map((r) => r.id);
  s.ship.blueprints = BLUEPRINTS.map((bp) => bp.id);
  s.inventory = Object.fromEntries(ITEM_IDS.map((i) => [i, 99999]));
  s.time = CLOCK.day + 60; // night
  const hub = w.hub!;
  const [hx, hy] = [hub.x + HUB_SIZE / 2, hub.y + HUB_SIZE / 2];
  const R = 34;
  for (let y = hy - R; y <= hy + R; y++) for (let x = hx - R; x <= hx + R; x++) if (w.inBounds(x, y)) s.resources[w.idx(x, y)] = s.trees[w.idx(x, y)] = 0;
  const place = (type: BuildingType, x: number, y: number, dir: Dir = 0) => {
    const b = w.place(type, x, y, dir);
    return typeof b === 'string' ? null : b;
  };
  // Rows of belts, each fed by a furnace and passing a turret; a spike pit, a repair station and a
  // teleporter every so often.
  let i = 0;
  for (let y = hy - R + 2; y <= hy + R - 3; y += 4) {
    for (let x = hx - R + 2; x <= hx + R - 3; x++) {
      if (x >= hub.x - 2 && x <= hub.x + HUB_SIZE + 1 && y >= hub.y - 3 && y <= hub.y + HUB_SIZE + 1) continue;
      const belt = place('belt', x, y, 0);
      if (belt && i % 3 === 0) belt.belt.push({ item: 'iron_plate', pos: 0.5, lane: 0 });
      const k = i++ % 12;
      if (k === 0) {
        const f = place('furnace', x, y + 1, 0);
        if (f) {
          f.recipe = 'iron_ingot';
          f.inputs = { iron_ore: 3 };
        }
      } else if (k === 4) place('turret', x, y + 1, 0);
      else if (k === 6) place('spike_pit', x, y + 1, 0);
      else if (k === 8 && i % 5 === 0) {
        const t = place('teleporter', x, y + 1, 0);
        if (t && i % 2) w.setFilter(t.id, 'iron_plate'); // every other one receives
      } else if (k === 8) place('repair', x, y + 1, 0);
    }
  }
  // A wall around it all.
  for (let d = -R; d <= R; d++)
    for (const [x, y] of [
      [hx + d, hy - R],
      [hx + d, hy + R],
      [hx - R, hy + d],
      [hx + R, hy + d],
    ])
      place('wall', x, y, 0);
  // 200 angry bugs from the nearest nests, waiting just outside the wall.
  const near = s.nests
    .filter((n) => !n.destroyed)
    .sort((a, b) => hypot(a.x - hx, a.y - hy) - hypot(b.x - hx, b.y - hy))
    .slice(0, 8);
  s.enemies = [];
  for (let k = 0; k < 200; k++) {
    const n = near[k % near.length];
    const e = w.spawnBug(k % 10 === 0 ? 'wasp' : k % 4 === 0 ? 'runner' : 'crawler', n, 1);
    // Spread around the square just outside the wall (no trig: the same numbers in every browser).
    const t = (k / 200) * 4;
    const side = Math.floor(t);
    const f = (t - side) * 2 - 1;
    const o = R + 3;
    [e.x, e.y] = [
      [hx + f * o, hy - o],
      [hx + o, hy + f * o],
      [hx - f * o, hy + o],
      [hx - o, hy - f * o],
    ][side];
  }
  for (const n of near) n.angryUntil = 1e9;
  w.markFlowDirty();
  return w;
}
