// Bug territories (D-038). Bugs live in nests, each owning one square cell of
// the map. Calm bugs stroll around inside their cell. A nest is provoked by
// building in or next to its cell, by a building coming close to one of its
// bugs, or by its bugs being shot; then its bugs go for the nearest
// buildings, as far as their leash allows, until things have been quiet for a
// while and they wander home. A ship launch draws the nests it wakes to the
// shipyard instead, with no leash (D-047).

import { BUILDINGS, DX, DY, ENEMIES, NESTS } from './data';
import type { Building, Enemy, World } from './world';

export interface Nest {
  id: number; // also its index in GameState.nests
  x: number; // top-left tile of its cell
  y: number;
  angryUntil: number; // game time; provoked while time is below this
}

const C = NESTS.cell;

export function nestCentre(n: Nest): [number, number] {
  return [n.x + C / 2, n.y + C / 2];
}

export function isAngry(w: World, n: Nest): boolean {
  return w.state.time < n.angryUntil;
}

/** The nest whose cell holds tile (x, y), if any. */
export function nestAt(w: World, x: number, y: number): Nest | undefined {
  return w.nestCells.get(cellKey(Math.floor(x / C), Math.floor(y / C)));
}

export const cellKey = (cx: number, cy: number) => cx * 4096 + cy;

/** Whether a nest still has bugs. */
export function nestAlive(w: World, n: Nest): boolean {
  return w.state.enemies.some((e) => e.nest === n.id);
}

export function provoke(w: World, n: Nest): void {
  if (!nestAlive(w, n)) return;
  const was = isAngry(w, n);
  n.angryUntil = Math.max(n.angryUntil, w.state.time + NESTS.calmAfter);
  if (!was) {
    w.markFlowDirty();
    w.events.push('You disturbed a nest. Its bugs are attacking!');
  }
}

/** A building went up: provoke any territory it's in or next to. */
export function onBuilt(w: World, b: Building): void {
  const [bw, bh] = w.footprintOf(b);
  const m = NESTS.nearMargin;
  const seen = new Set<number>();
  for (let cy = Math.floor((b.y - m) / C); cy <= Math.floor((b.y + bh - 1 + m) / C); cy++) {
    for (let cx = Math.floor((b.x - m) / C); cx <= Math.floor((b.x + bw - 1 + m) / C); cx++) {
      const n = w.nestCells.get(cellKey(cx, cy));
      if (n && !seen.has(n.id)) {
        seen.add(n.id);
        provoke(w, n);
      }
    }
  }
}

/** A bug was hurt (a turret or the hub gun): its whole nest wakes. */
export function onBugHurt(w: World, e: Enemy): void {
  const n = w.state.nests[e.nest];
  if (n) provoke(w, n);
}

/** Moves every bug: chasing when its nest is angry, strolling at home otherwise. */
export function tickBugs(w: World, dt: number): void {
  const s = w.state;
  // Looking around for nearby buildings is done a few times a second, not every tick.
  const look = Math.floor(s.time * 4) !== Math.floor((s.time - dt) * 4);
  const drawn = new Set(s.ship.launchAt != null ? s.ship.drawn : []);
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const n = s.nests[e.nest];
    const [hx, hy] = nestCentre(n);
    const def = ENEMIES[e.type];
    if (drawn.has(n.id) && isAngry(w, n)) {
      chase(w, e, n, dt, w.shipFlow);
      continue;
    }
    if (isAngry(w, n) && Math.hypot(e.x - hx, e.y - hy) <= NESTS.leash) {
      chase(w, e, n, dt, w.flow);
      continue;
    }
    if (look && buildingNear(w, e.x, e.y, NESTS.closeRadius)) {
      provoke(w, n);
      continue;
    }
    // Calm: walk back into the cell if outside it, then stroll between random spots and rest.
    const inside = e.x >= n.x && e.x < n.x + C && e.y >= n.y && e.y < n.y + C;
    if (!inside) {
      e.tx = hx;
      e.ty = hy;
      e.wait = 0;
    } else if (e.wait > 0) {
      e.wait -= dt;
      continue;
    }
    const d = Math.hypot(e.tx - e.x, e.ty - e.y);
    if (d < 0.05) {
      e.tx = n.x + 0.5 + w.random() * (C - 1);
      e.ty = n.y + 0.5 + w.random() * (C - 1);
      e.wait = NESTS.pause[0] + w.random() * (NESTS.pause[1] - NESTS.pause[0]);
      continue;
    }
    const step = Math.min(d, def.speed * 0.6 * dt); // strolling, not charging
    const nx = e.x + ((e.tx - e.x) / d) * step;
    const ny = e.y + ((e.ty - e.y) / d) * step;
    const blocker = w.buildingAt(Math.floor(nx), Math.floor(ny));
    if (blocker && BUILDINGS[blocker.type].blocking) {
      e.tx = e.x; // something's in the way: pick another spot next time
      e.ty = e.y;
      continue;
    }
    e.x = nx;
    e.y = ny;
  }
}

/** Follow a flow field (to the nearest building, or to the shipyard), and chew on whatever is reached. */
function chase(w: World, e: Enemy, n: Nest, dt: number, flow: Float64Array): void {
  const def = ENEMIES[e.type];
  const tx = Math.floor(e.x);
  const ty = Math.floor(e.y);
  const here = w.buildingAt(tx, ty);
  if (here) {
    bite(w, here, n, def.dps * dt);
    return;
  }
  let best = -1;
  let bestCost = flow[w.idx(tx, ty)];
  for (let k = 0; k < 4; k++) {
    const nx = tx + DX[k];
    const ny = ty + DY[k];
    if (!w.inBounds(nx, ny)) continue;
    const i = w.idx(nx, ny);
    if (flow[i] < bestCost) {
      bestCost = flow[i];
      best = i;
    }
  }
  if (best < 0) return; // nothing within reach
  const nx = best % w.state.width;
  const ny = (best - nx) / w.state.width;
  const gx = nx + 0.5;
  const gy = ny + 0.5;
  const dist = Math.hypot(gx - e.x, gy - e.y);
  const blocker = w.buildingAt(nx, ny);
  if (blocker && BUILDINGS[blocker.type].blocking && dist <= 0.55 + def.radius) {
    bite(w, blocker, n, def.dps * dt);
    return;
  }
  const step = Math.min(dist, def.speed * dt);
  if (dist > 0) {
    e.x += ((gx - e.x) / dist) * step;
    e.y += ((gy - e.y) / dist) * step;
  }
}

/** Damage a building; a nest stays angry while it's busy biting. */
function bite(w: World, b: Building, n: Nest, amount: number): void {
  b.hp -= amount;
  n.angryUntil = Math.max(n.angryUntil, w.state.time + NESTS.calmAfter);
}

function buildingNear(w: World, x: number, y: number, r: number): boolean {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      if (w.buildingAt(cx + dx, cy + dy)) return true;
    }
  }
  return false;
}

/** Any nest angry right now (the flow field is only needed then). */
export function anyAngry(w: World): boolean {
  return w.state.nests.some((n) => isAngry(w, n));
}
