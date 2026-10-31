// The player character (#40, D-067). An engineer who walks the map, mines by
// hand, keeps what they mine, collect or pick up off belts in an inventory of
// slots (#87, D-090; a few of it trail behind them), and drops it into the hub
// just by walking up to it (unless switched off), or into a building on request.
//
// The rules hold a list of players from the start, for co-op (D-056). Moves are
// commands like everything else; paths are found once per command and saved, so
// every game walks the same way.
//
// Bugs notice the engineer (D-074): it has health, and a knocked-out engineer
// drops what it carries and gets back up at the hub a little later.

import { BUILDINGS, DX, DY, HUB_SIZE, ItemId, PLAYER } from './data';
import { hypot } from './math';
import { moundAt } from './nests';
import type { Building, World } from './world';

/** Something the character will do on arriving next to its target. */
export type PlayerAction = { kind: 'mine'; x: number; y: number } | { kind: 'collect'; id: number } | { kind: 'drop'; id: number } | { kind: 'pickup'; id: number };

/** One inventory slot: up to PLAYER.stack of one item. */
export interface Slot {
  item: ItemId;
  n: number;
}

export interface Player {
  id: number;
  x: number; // position in tiles (a tile's centre is at +0.5)
  y: number;
  /** The inventory (#87): PLAYER.slots slots, each empty or a stack of one item. */
  slots: (Slot | null)[];
  /** Whether walking up to the hub empties the inventory into it (on unless the player switches it off). */
  autoDrop: boolean;
  /** Tile indices still to walk through, next first. */
  path: number[];
  /** Keyboard walking: the direction held, or null. */
  walk: [number, number] | null;
  /** What to do on arriving. */
  pending: PlayerAction | null;
  /** The ore tile this player is mining by hand, taps so far, and the game time of the last tap (#38). */
  mining?: { tile: number; taps: number; at: number } | null;
  hp: number;
  /** Game time of the last bite, for health coming back. */
  hurtAt?: number;
  /** Knocked out (D-074): game time it gets back up at the hub. */
  downUntil?: number;
}

/**
 * Where each co-op slot's engineer stands below the hub, out from the middle in turn, so none hides
 * another. One per slot up to MAX_PLAYERS (a test checks); the first four never move, so saves keep theirs.
 */
export const HOME_OFFSET = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5];

/** A new player standing just below the hub: the first in the middle, the others beside it. */
export function newPlayer(w: World, id: number): Player {
  const hub = w.hub;
  const x = hub ? hub.x + Math.floor(HUB_SIZE / 2) + (HOME_OFFSET[id] ?? 0) + 0.5 : w.state.width / 2;
  const y = hub ? hub.y + HUB_SIZE + 0.5 : w.state.height / 2;
  return { id, x, y, slots: emptySlots(), autoDrop: true, path: [], walk: null, pending: null, mining: null, hp: PLAYER.hp };
}

export function emptySlots(): (Slot | null)[] {
  return Array.from({ length: PLAYER.slots }, () => null);
}

/** How many items a player holds in all. */
export function held(p: Player): number {
  return p.slots.reduce((n, s) => n + (s?.n ?? 0), 0);
}

/** How many of `item` a player holds. */
export function heldOf(p: Player, item: ItemId): number {
  return p.slots.reduce((n, s) => n + (s?.item === item ? s.n : 0), 0);
}

/** How many more of `item` fit: room on stacks of it, then empty slots. */
export function roomFor(p: Player, item: ItemId): number {
  return p.slots.reduce((n, s) => n + (!s ? PLAYER.stack : s.item === item ? PLAYER.stack - s.n : 0), 0);
}

/** Puts one `item` in the inventory, on a stack of it first, then in the first empty slot. False if it's full. */
export function give(p: Player, item: ItemId): boolean {
  const stack = p.slots.find((s) => s?.item === item && s.n < PLAYER.stack);
  if (stack) {
    stack.n++;
    return true;
  }
  const i = p.slots.indexOf(null);
  if (i < 0) return false;
  p.slots[i] = { item, n: 1 };
  return true;
}

/** Takes up to `n` of `item` out of the inventory, from the last stack first. Returns how many it took. */
export function take(p: Player, item: ItemId, n: number): number {
  let took = 0;
  for (let i = p.slots.length - 1; i >= 0 && took < n; i--) {
    const s = p.slots[i];
    if (s?.item !== item) continue;
    const k = Math.min(s.n, n - took);
    s.n -= k;
    took += k;
    if (!s.n) p.slots[i] = null;
  }
  return took;
}

/**
 * Hands everything a player holds to `put`, one item at a time, slot by slot; what it refuses stays.
 * Returns how many went.
 */
export function handOver(p: Player, put: (item: ItemId) => boolean): number {
  let n = 0;
  p.slots = p.slots.map((s) => {
    if (!s) return null;
    let left = s.n;
    while (left > 0 && put(s.item)) {
      left--;
      n++;
    }
    return left ? { item: s.item, n: left } : null;
  });
  return n;
}

/**
 * A co-op player left (D-079): their engineer is back below the hub at once, rather than walking home
 * through bug country, and what it carried goes into the hub.
 */
export function sendHome(w: World, p: Player): void {
  const hub = w.hub;
  if (hub) handOver(p, (item) => w.insert(hub, item, hub.x - 1, hub.y));
  const home = newPlayer(w, p.id);
  Object.assign(p, { x: home.x, y: home.y, slots: emptySlots(), path: [], walk: null, pending: null, mining: null });
}

/** Whether a player is knocked out (D-074): it can't walk or work until it's back up. */
export function isDown(p: Player): boolean {
  return p.downUntil != null;
}

/** A bug bites the engineer; at no health it's knocked out and loses everything in its inventory. */
export function hurtPlayer(w: World, p: Player, amount: number): void {
  if (isDown(p)) return;
  p.hp -= amount;
  p.hurtAt = w.state.time;
  if (p.hp > 0) return;
  p.hp = 0;
  p.slots = emptySlots();
  p.path = [];
  p.pending = null;
  p.walk = null;
  p.mining = null;
  p.downUntil = w.state.time + PLAYER.downFor;
  w.playerEvents.push({
    player: p.id,
    mine: `Your engineer was knocked out and lost what they carried. Back on their feet at the hub in ${PLAYER.downFor} s.`,
    others: `Player ${p.id + 1}'s engineer was knocked out.`,
  });
}

/** The standing player nearest (x, y) within `range`, if any. */
export function playerNear(w: World, x: number, y: number, range: number): Player | undefined {
  let best: Player | undefined;
  let bestD = range;
  for (const p of w.state.players) {
    if (isDown(p)) continue;
    const d = hypot(p.x - x, p.y - y);
    if (d <= bestD) [best, bestD] = [p, d];
  }
  return best;
}

export function playerOf(w: World, id = 0): Player | undefined {
  // No stand-in: a command from a player with no engineer must not move someone else's.
  return w.state.players.find((p) => p.id === id);
}

/** Whether the character can't stand on tile (x, y): off the map, a pond, a solid building or a nest's mound. */
export function blocked(w: World, x: number, y: number): boolean {
  if (!w.inBounds(x, y) || w.isWater(x, y)) return true;
  const b = w.buildingAt(x, y);
  return (!!b && BUILDINGS[b.type].blocking) || !!moundAt(w, x, y);
}

/** Whether a character at (px, py) can reach a w×h area at (x, y): mine it, or hand it things. */
export function inReach(px: number, py: number, x: number, y: number, w = 1, h = 1): boolean {
  const nx = Math.max(x, Math.min(px, x + w));
  const ny = Math.max(y, Math.min(py, y + h));
  return hypot(nx - px, ny - py) <= PLAYER.reach;
}

export function reaches(w: World, p: Player, b: Building): boolean {
  const [fw, fh] = w.footprintOf(b);
  return inReach(p.x, p.y, b.x, b.y, fw, fh);
}

/** Walk to tile (x, y), or as close as the way allows. Drops any plan to act on arrival. */
export function moveTo(w: World, p: Player, x: number, y: number): boolean {
  if (isDown(p)) return false;
  p.pending = null;
  p.walk = null;
  const path = findPath(w, p, (tx, ty) => tx === x && ty === y, x, y);
  p.path = path ?? [];
  return !!path;
}

/** Walk until a w×h area at (x, y) is in reach, then do `action`. Does it at once if already there. */
export function goAndDo(w: World, p: Player, x: number, y: number, fw: number, fh: number, action: PlayerAction): boolean {
  if (isDown(p)) return false;
  p.walk = null;
  const path = findPath(w, p, (tx, ty) => inReach(tx + 0.5, ty + 0.5, x, y, fw, fh), x + fw / 2, y + fh / 2);
  if (!path) return false;
  p.path = path;
  p.pending = action;
  return true;
}

/** Keyboard walking: hold a direction (each part -1, 0 or 1), or stop with [0, 0]. */
export function walk(p: Player, dx: number, dy: number): void {
  if (isDown(p)) return;
  p.path = [];
  p.pending = null;
  p.walk = dx || dy ? [Math.sign(dx), Math.sign(dy)] : null;
}

/** Moves every player along its path or held direction, acts on arrival, and drops off at the hub. */
export function tickPlayers(w: World, dt: number, act: (p: Player, a: PlayerAction) => void): void {
  for (const p of w.state.players) {
    if (p.downUntil != null) {
      if (w.state.time < p.downUntil) continue;
      // Back on their feet, just below the hub.
      const fresh = newPlayer(w, p.id);
      p.x = fresh.x;
      p.y = fresh.y;
      p.hp = PLAYER.hp;
      delete p.downUntil;
      delete p.hurtAt;
    }
    if (p.hp < PLAYER.hp && (p.hurtAt == null || w.state.time - p.hurtAt >= PLAYER.regenAfter)) {
      p.hp = Math.min(PLAYER.hp, p.hp + PLAYER.regen * dt);
    }
    let step = PLAYER.speed * dt;
    if (p.walk) {
      const [dx, dy] = p.walk;
      const len = hypot(dx, dy);
      slide(w, p, (dx / len) * step, (dy / len) * step);
    }
    while (p.path.length && step > 0) {
      const i = p.path[0];
      const tx = (i % w.state.width) + 0.5;
      const ty = Math.floor(i / w.state.width) + 0.5;
      if (blocked(w, tx - 0.5, ty - 0.5)) {
        // Something was built in the way: stop here (a new command finds a new way).
        p.path = [];
        p.pending = null;
        break;
      }
      const d = hypot(tx - p.x, ty - p.y);
      if (d <= step) {
        p.x = tx;
        p.y = ty;
        p.path.shift();
        step -= d;
      } else {
        p.x += ((tx - p.x) / d) * step;
        p.y += ((ty - p.y) / d) * step;
        step = 0;
      }
    }
    if (!p.path.length && p.pending) {
      const a = p.pending;
      p.pending = null;
      act(p, a);
    }
    const hub = w.hub;
    if (hub && p.autoDrop && held(p) && inReach(p.x, p.y, hub.x, hub.y, HUB_SIZE, HUB_SIZE)) {
      handOver(p, (item) => w.insert(hub, item, hub.x - 1, hub.y));
    }
  }
}

/** Keyboard walking moves freely, sliding along whatever is in the way. */
function slide(w: World, p: Player, dx: number, dy: number): void {
  // The tile the engineer stands on always counts as free: a building put up on it (or one standing
  // where they get back on their feet) must not hold them in place.
  const [tx, ty] = [Math.floor(p.x), Math.floor(p.y)];
  const free = (x: number, y: number) => (Math.floor(x) === tx && Math.floor(y) === ty) || !blocked(w, Math.floor(x), Math.floor(y));
  if (free(p.x + dx, p.y + dy)) {
    p.x += dx;
    p.y += dy;
  } else if (free(p.x + dx, p.y)) p.x += dx;
  else if (free(p.x, p.y + dy)) p.y += dy;
}

const DIAG = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

/**
 * Breadth-first search from the character's tile, in 8 directions (no cutting corners), to the
 * nearest tile where `goal` holds. If none is found within PLAYER.searchLimit tiles searched, it
 * heads for the searched tile nearest (gx, gy) instead. Returns the tiles to walk through.
 */
function findPath(w: World, p: Player, goal: (x: number, y: number) => boolean, gx: number, gy: number): number[] | null {
  const W = w.state.width;
  const sx = Math.floor(p.x);
  const sy = Math.floor(p.y);
  if (!w.inBounds(sx, sy)) return null;
  const start = sy * W + sx;
  // Already on a tile that will do: step to its middle, which is what counts as in reach. Standing off
  // it, an engineer could be out of reach, and every tap would plan this same empty walk (#169). (A tile
  // something was built on can't be walked to: look for another.)
  if (goal(sx, sy) && !blocked(w, sx, sy)) return [start];
  const from = new Map<number, number>([[start, -1]]);
  const queue = [start];
  let best = start;
  let bestD = hypot(sx + 0.5 - gx, sy + 0.5 - gy);
  let found = -1;
  for (let q = 0; q < queue.length && queue.length < PLAYER.searchLimit; q++) {
    const i = queue[q];
    const x = i % W;
    const y = (i - x) / W;
    const steps: [number, number][] = [[DX[0], DY[0]], [DX[1], DY[1]], [DX[2], DY[2]], [DX[3], DY[3]], ...(DIAG as [number, number][])];
    for (const [dx, dy] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      if (blocked(w, nx, ny)) continue;
      if (dx && dy && (blocked(w, x + dx, y) || blocked(w, x, y + dy))) continue;
      const n = ny * W + nx;
      if (from.has(n)) continue;
      from.set(n, i);
      if (goal(nx, ny)) {
        found = n;
        break;
      }
      const d = hypot(nx + 0.5 - gx, ny + 0.5 - gy);
      if (d < bestD) [best, bestD] = [n, d];
      queue.push(n);
    }
    if (found >= 0) break;
  }
  const end = found >= 0 ? found : best;
  if (end === start) return found >= 0 ? [] : null;
  const path: number[] = [];
  for (let i = end; i !== start; i = from.get(i)!) path.push(i);
  return path.reverse();
}
