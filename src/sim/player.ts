// The player character (#40, D-067). An engineer who walks the map, mines by
// hand, carries what they mine or collect (it trails behind them), and drops it
// into the hub just by walking up to it, or into a building on request.
//
// The rules hold a list of players from the start, for co-op (D-056). Moves are
// commands like everything else; paths are found once per command and saved, so
// every game walks the same way.

import { BUILDINGS, DX, DY, HUB_SIZE, ItemId, PLAYER } from './data';
import { hypot } from './math';
import { moundAt } from './nests';
import type { Building, World } from './world';

/** Something the character will do on arriving next to its target. */
export type PlayerAction = { kind: 'mine'; x: number; y: number } | { kind: 'collect'; id: number } | { kind: 'drop'; id: number };

export interface Player {
  id: number;
  x: number; // position in tiles (a tile's centre is at +0.5)
  y: number;
  /** What they carry, oldest first (it trails behind them). */
  carry: ItemId[];
  /** Tile indices still to walk through, next first. */
  path: number[];
  /** Keyboard walking: the direction held, or null. */
  walk: [number, number] | null;
  /** What to do on arriving. */
  pending: PlayerAction | null;
  /** The ore tile this player is mining by hand, taps so far, and the game time of the last tap (#38). */
  mining?: { tile: number; taps: number; at: number } | null;
}

/** A new player standing just below the middle of the hub. */
export function newPlayer(w: World, id: number): Player {
  const hub = w.hub;
  const x = hub ? hub.x + Math.floor(HUB_SIZE / 2) + 0.5 : w.state.width / 2;
  const y = hub ? hub.y + HUB_SIZE + 0.5 : w.state.height / 2;
  return { id, x, y, carry: [], path: [], walk: null, pending: null, mining: null };
}

export function playerOf(w: World, id = 0): Player {
  return w.state.players.find((p) => p.id === id) ?? w.state.players[0];
}

/** Whether the character can't stand on tile (x, y): off the map, a solid building or a nest's mound. */
export function blocked(w: World, x: number, y: number): boolean {
  if (!w.inBounds(x, y)) return true;
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
  p.pending = null;
  p.walk = null;
  const path = findPath(w, p, (tx, ty) => tx === x && ty === y, x, y);
  p.path = path ?? [];
  return !!path;
}

/** Walk until a w×h area at (x, y) is in reach, then do `action`. Does it at once if already there. */
export function goAndDo(w: World, p: Player, x: number, y: number, fw: number, fh: number, action: PlayerAction): boolean {
  p.walk = null;
  const path = findPath(w, p, (tx, ty) => inReach(tx + 0.5, ty + 0.5, x, y, fw, fh), x + fw / 2, y + fh / 2);
  if (!path) return false;
  p.path = path;
  p.pending = action;
  return true;
}

/** Keyboard walking: hold a direction (each part -1, 0 or 1), or stop with [0, 0]. */
export function walk(p: Player, dx: number, dy: number): void {
  p.path = [];
  p.pending = null;
  p.walk = dx || dy ? [Math.sign(dx), Math.sign(dy)] : null;
}

/** Moves every player along its path or held direction, acts on arrival, and drops off at the hub. */
export function tickPlayers(w: World, dt: number, act: (p: Player, a: PlayerAction) => void): void {
  for (const p of w.state.players) {
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
    if (hub && p.carry.length && inReach(p.x, p.y, hub.x, hub.y, HUB_SIZE, HUB_SIZE)) {
      for (const item of p.carry) w.insert(hub, item, hub.x - 1, hub.y);
      p.carry = [];
    }
  }
}

/** Keyboard walking moves freely, sliding along whatever is in the way. */
function slide(w: World, p: Player, dx: number, dy: number): void {
  const free = (x: number, y: number) => !blocked(w, Math.floor(x), Math.floor(y));
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
  if (goal(sx, sy)) return [];
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
