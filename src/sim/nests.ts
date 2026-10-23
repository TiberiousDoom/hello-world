// Bug territories (D-038). Bugs live in nests, each owning one square cell of
// the map. Calm bugs stroll around inside their cell. A nest is provoked by
// building in or next to its cell, by a building coming close to one of its
// bugs, or by its bugs being shot; then its bugs go for the nearest
// buildings, as far as their leash allows, until things have been quiet for a
// while and they wander home. A ship launch draws the nests it wakes to the
// shipyard instead, with no leash (D-047). Territories spread over time into
// neighbouring cells that have no live nest (#51, D-059).
//
// Each nest has a mound with health (D-065). Destroying it clears the territory
// for good and drops chitin; its surviving bugs stay angry, with no home and no
// leash, until they're killed. A calm nest breeds back up to the bugs it started
// with; new bugs hatch young and grow up over a few minutes. A threat level
// rising with play time makes newly bred bugs tougher and territories spread
// sooner. Shooting a nest's bugs wakes the nests next to it too. Some nights a
// nest near your buildings sends a raiding party. Bugs notice the engineer:
// walking close to calm bugs provokes them, and angry ones close by go for it.

import { BUILDINGS, CLOCK, DX, DY, ENEMIES, EnemyType, HUB_SIZE, NESTS, PLAYER, RAIDS, chitinFor, moundHp, nestComposition } from './data';
import { clockAt } from './clock';
import { hypot } from './math';
import type { Building, Enemy, World } from './world';
import { Player, hurtPlayer, playerNear } from './player';

export interface Nest {
  id: number; // also its index in GameState.nests
  x: number; // top-left tile of its cell
  y: number;
  angryUntil: number; // game time; provoked while time is below this
  hp: number; // the mound's health
  maxHp: number;
  destroyed?: boolean; // the mound is gone: the territory is clear for good
  brood: Brood; // the bugs it started with, which it breeds back up to while calm
  nextBreed: number; // game time its next bug hatches; 0 while it isn't breeding
}

/** How many bugs of each kind a nest holds. */
export type Brood = Record<EnemyType, number>;

/** A new nest whose cell has its top-left at (x, y), `distance` tiles from the hub; `share` of the usual bugs. */
export function newNest(id: number, x: number, y: number, distance: number, share = 1): Nest {
  const hp = moundHp(distance);
  return { id, x, y, angryUntil: 0, hp, maxHp: hp, brood: broodFor(distance, share), nextBreed: 0 };
}

/** The bugs a nest `distance` tiles from the hub starts with; `share` of them for a newly spread one (at least 2 crawlers). */
export function broodFor(distance: number, share = 1): Brood {
  const comp = nestComposition(distance);
  const count = (k: number) => Math.round(k * share);
  return { crawler: Math.max(share < 1 ? 2 : 0, count(comp.crawlers)), runner: count(comp.runners), brute: count(comp.brutes) };
}

const C = NESTS.cell;

export function nestCentre(n: Nest): [number, number] {
  return [n.x + C / 2, n.y + C / 2];
}

/** Provoked, or homeless: a destroyed nest's survivors never calm down. */
export function isAngry(w: World, n: Nest): boolean {
  return !!n.destroyed || w.state.time < n.angryUntil;
}

/** The nest whose cell holds tile (x, y), if any. */
export function nestAt(w: World, x: number, y: number): Nest | undefined {
  return w.nestCells.get(cellKey(Math.floor(x / C), Math.floor(y / C)));
}

export const cellKey = (cx: number, cy: number) => cx * 4096 + cy;

/** Whether a nest's mound still stands (with or without bugs). */
export function nestAlive(_w: World, n: Nest): boolean {
  return !n.destroyed;
}

/** Whether a nest still has bugs. */
export function hasBugs(w: World, n: Nest): boolean {
  return w.state.enemies.some((e) => e.nest === n.id);
}

/** The 2×2 tiles of a nest's mound, at the middle of its cell: its top-left. */
export function moundTile(n: Nest): [number, number] {
  return [n.x + C / 2 - 1, n.y + C / 2 - 1];
}

/** The standing mound covering tile (x, y), if any. */
export function moundAt(w: World, x: number, y: number): Nest | undefined {
  const n = nestAt(w, x, y);
  if (!n || n.destroyed) return undefined;
  const [mx, my] = moundTile(n);
  return x >= mx && x < mx + 2 && y >= my && y < my + 2 ? n : undefined;
}

/** How far a nest's centre is from the hub's. */
export function hubDistance(w: World, n: Nest): number {
  const hub = w.hub;
  if (!hub) return 0;
  const [cx, cy] = nestCentre(n);
  return hypot(cx - (hub.x + Math.floor(HUB_SIZE / 2)), cy - (hub.y + Math.floor(HUB_SIZE / 2)));
}

/** The nearest standing mound whose edge is within `range` of (x, y), if any. */
export function moundInRange(w: World, x: number, y: number, range: number): Nest | undefined {
  const reach = range + NESTS.moundRadius;
  let best: Nest | undefined;
  let bestD = reach;
  for (let cy = Math.floor((y - reach) / C); cy <= Math.floor((y + reach) / C); cy++) {
    for (let cx = Math.floor((x - reach) / C); cx <= Math.floor((x + reach) / C); cx++) {
      const n = w.nestCells.get(cellKey(cx, cy));
      if (!n || n.destroyed || n.x / C !== cx || n.y / C !== cy) continue;
      const [nx, ny] = nestCentre(n);
      const d = hypot(nx - x, ny - y);
      if (d <= bestD) [best, bestD] = [n, d];
    }
  }
  return best;
}

/** Damage to a nest's mound: it wakes the nest, and at zero the mound is destroyed. */
export function damageMound(w: World, n: Nest, amount: number): void {
  if (n.destroyed) return;
  provoke(w, n);
  n.hp -= amount;
  if (n.hp > 0) return;
  n.hp = 0;
  n.destroyed = true;
  const chitin = chitinFor(hubDistance(w, n));
  w.state.inventory.chitin = (w.state.inventory.chitin ?? 0) + chitin;
  w.markFlowDirty();
  w.events.push(`Nest destroyed: its territory is clear. +${chitin} chitin`);
}

/** Whether a nest still owns its cell (a cleared one may have been taken over by a newer nest). */
export function ownsCell(w: World, n: Nest): boolean {
  return w.nestCells.get(cellKey(n.x / C, n.y / C)) === n;
}

/** Whether the cell with its top-left at (x, y) has a tile within the hub's safe radius. */
export function nearHub(x: number, y: number, hubCx: number, hubCy: number): boolean {
  const nx = Math.max(x, Math.min(hubCx, x + C - 1));
  const ny = Math.max(y, Math.min(hubCy, y + C - 1));
  return hypot(nx - hubCx, ny - hubCy) < NESTS.safeRadius;
}

/** Fills a new nest, `distance` tiles from the hub, with its brood, all grown up; `tougher` multiplies their health. */
export function populate(w: World, n: Nest, distance: number, tougher = 1): void {
  const hpMult = nestComposition(distance).hpMult * tougher;
  for (const type of BUG_TYPES) for (let i = 0; i < n.brood[type]; i++) w.spawnBug(type, n, hpMult);
}

/** The threat level (D-065): 0 at the start, one more every NESTS.threatEvery seconds of play. */
export function threatAt(time: number): number {
  return Math.min(NESTS.threatMax, Math.floor(Math.max(0, time) / NESTS.threatEvery));
}

/** How much more health bugs bred or spread now get, from the threat level. */
export function threatToughness(w: World): number {
  return 1 + NESTS.threatHp * threatAt(w.state.time);
}

/** Says when the threat level rises. */
export function announceThreat(w: World, before: number, now: number): void {
  const t = threatAt(now);
  if (t > threatAt(before)) w.events.push(`Threat level ${t}: new bugs are tougher, and territories spread sooner.`);
}

const BUG_TYPES: EnemyType[] = ['crawler', 'runner', 'brute'];

/**
 * Breeding (D-065). A calm nest with fewer bugs than its brood hatches one every 60–90 s, of a kind it's
 * short of. An angry nest doesn't breed, and its timer starts again once it calms down. Checked once a
 * second.
 */
export function tickBreeding(w: World, dt: number): void {
  const s = w.state;
  if (Math.floor(s.time) === Math.floor(s.time - dt)) return;
  const have = new Map<number, Brood>();
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    let b = have.get(e.nest);
    if (!b) have.set(e.nest, (b = { crawler: 0, runner: 0, brute: 0 }));
    b[e.type]++;
  }
  for (const n of s.nests) {
    if (n.destroyed || !ownsCell(w, n) || isAngry(w, n)) {
      n.nextBreed = 0;
      continue;
    }
    const got = have.get(n.id) ?? { crawler: 0, runner: 0, brute: 0 };
    const total = (b: Brood) => b.crawler + b.runner + b.brute;
    if (total(got) >= total(n.brood)) n.nextBreed = 0;
    else if (!n.nextBreed) n.nextBreed = s.time + NESTS.breedEvery[0] + w.random() * (NESTS.breedEvery[1] - NESTS.breedEvery[0]);
    else if (s.time >= n.nextBreed) {
      const distance = hubDistance(w, n);
      const short = BUG_TYPES.filter((t) => got[t] < n.brood[t]);
      let type = short.length ? short[Math.floor(w.random() * short.length)] : 'crawler';
      // With threat, crawlers more often hatch as something worse (D-065). The nest's size stays the same.
      const threat = threatAt(s.time);
      if (type === 'crawler' && w.random() < Math.min(NESTS.threatSwapMax, NESTS.threatSwap * threat)) {
        type = nestComposition(distance).brutes > 0 && w.random() < 0.5 ? 'brute' : 'runner';
      }
      w.spawnBug(type, n, nestComposition(distance).hpMult * threatToughness(w), true);
      n.nextBreed = 0;
    }
  }
}

/** How grown up a bug is, from 0 (just hatched) to 1 (an adult). */
export function growth(w: World, e: Enemy): number {
  return e.born == null ? 1 : Math.min(1, (w.state.time - e.born) / NESTS.growUp);
}

/** A bug's share of an adult's health, bite and size: from NESTS.young when it hatches, to 1 grown up. */
export function strength(w: World, e: Enemy): number {
  return NESTS.young + (1 - NESTS.young) * growth(w, e);
}

/** Young bugs grow: their health rises with their strength, keeping any damage taken. */
function grow(w: World, e: Enemy, dt: number): void {
  if (e.born == null) return;
  e.hp = Math.min(e.maxHp, e.hp + (e.maxHp * (1 - NESTS.young) * dt) / NESTS.growUp);
  if (w.state.time - e.born >= NESTS.growUp) delete e.born;
}

/**
 * Territories spread (#51, D-059). Every NESTS.spreadEvery seconds, one live nest, picked at random,
 * sends bugs into a neighbouring cell that has no live nest: a cleared territory, or open land. A live
 * territory's cell is never taken. Cells near the hub, and cells with buildings in them, stay clear,
 * so building on cleared land holds it.
 */
export function tickSpread(w: World): void {
  const s = w.state;
  if (s.time < s.nextSpread) return;
  const sooner = Math.max(NESTS.threatSpreadMin, 1 - NESTS.threatSpread * threatAt(s.time));
  s.nextSpread = s.time + NESTS.spreadEvery * sooner;
  const hub = w.hub;
  if (!hub) return;
  const hubCx = hub.x + Math.floor(HUB_SIZE / 2);
  const hubCy = hub.y + Math.floor(HUB_SIZE / 2);
  const options: [number, number][] = [];
  for (const n of s.nests) {
    if (!ownsCell(w, n) || !nestAlive(w, n)) continue;
    for (let k = 0; k < 4; k++) {
      const x = n.x + DX[k] * C;
      const y = n.y + DY[k] * C;
      if (canSettle(w, x, y, hubCx, hubCy)) options.push([x, y]);
    }
  }
  if (!options.length) return;
  const [x, y] = options[Math.floor(w.random() * options.length)];
  const distance = hypot(x + C / 2 - hubCx, y + C / 2 - hubCy);
  const nest = newNest(s.nests.length, x, y, distance, NESTS.spreadShare);
  s.nests.push(nest);
  w.nestCells.set(cellKey(x / C, y / C), nest);
  populate(w, nest, distance, threatToughness(w));
  w.events.push('Bugs have spread into a new territory.');
}

function canSettle(w: World, x: number, y: number, hubCx: number, hubCy: number): boolean {
  if (x < 0 || y < 0 || x + C > w.state.width || y + C > w.state.height) return false;
  const there = w.nestCells.get(cellKey(x / C, y / C));
  if (there && nestAlive(w, there)) return false;
  if (nearHub(x, y, hubCx, hubCy)) return false;
  for (let ty = y; ty < y + C; ty++) for (let tx = x; tx < x + C; tx++) if (w.tiles[w.idx(tx, ty)]) return false;
  return true;
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

/**
 * Night raids (D-065). At nightfall, from the second night on, a raid comes with RAIDS.chance (more with
 * threat; every night in Hardcore): one calm nest near your buildings, picked at random, sends a party of
 * its grown bugs. The rest of the nest stays calm. Raiders go for the nearest buildings with no leash, and
 * biting doesn't anger their nest; at morning they go home.
 */
export function startRaids(w: World, before: number, now: number): void {
  const was = clockAt(before);
  const c = clockAt(now);
  if (was.night || !c.night || c.day < RAIDS.firstNight) return;
  const s = w.state;
  const threat = threatAt(now);
  const chance = s.mode === 'hardcore' ? 1 : RAIDS.chance + RAIDS.chancePerThreat * threat;
  if (w.random() >= chance) return;
  const grown = (n: Nest) => s.enemies.filter((e) => e.nest === n.id && e.hp > 0 && e.born == null && !e.raid);
  const near = (n: Nest) => {
    const [cx, cy] = nestCentre(n);
    return s.buildings.some((b) => {
      const [bw, bh] = w.footprintOf(b);
      return hypot(Math.max(b.x, Math.min(cx, b.x + bw)) - cx, Math.max(b.y, Math.min(cy, b.y + bh)) - cy) <= RAIDS.range;
    });
  };
  const options = s.nests.filter((n) => !n.destroyed && ownsCell(w, n) && !isAngry(w, n) && grown(n).length >= 2 && near(n));
  if (!options.length) return;
  const n = options[Math.floor(w.random() * options.length)];
  const size = Math.min(RAIDS.partyMax, RAIDS.party + Math.floor(threat / RAIDS.partyThreat));
  for (const e of grown(n).slice(0, size)) e.raid = true;
  w.markFlowDirty();
  w.events.push(`Bugs are raiding from the ${compass(w, n)}!`);
}

/** Which way a nest lies from the hub, as a compass point. */
function compass(w: World, n: Nest): string {
  const hub = w.hub;
  const [cx, cy] = nestCentre(n);
  const dx = cx - (hub ? hub.x + HUB_SIZE / 2 : w.state.width / 2);
  const dy = cy - (hub ? hub.y + HUB_SIZE / 2 : w.state.height / 2);
  const points = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  // Octants by comparing the offsets (tan 22.5° ≈ 0.414), not Math.atan2, which isn't exact across browsers.
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay <= ax * 0.414) return dx >= 0 ? points[0] : points[4];
  if (ax <= ay * 0.414) return dy >= 0 ? points[2] : points[6];
  if (dx >= 0) return dy >= 0 ? points[1] : points[7];
  return dy >= 0 ? points[3] : points[5];
}

/** A bug was hurt (a turret or the hub gun): its whole nest wakes, and so do the nests next to it (D-065). */
export function onBugHurt(w: World, e: Enemy): void {
  const n = w.state.nests[e.nest];
  if (!n) return;
  provoke(w, n);
  if (n.destroyed) return;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nb = w.nestCells.get(cellKey(n.x / C + dx, n.y / C + dy));
      if (nb && nb !== n && !nb.destroyed) provoke(w, nb);
    }
  }
}

/** Moves every bug: chasing when its nest is angry, strolling at home otherwise. */
export function tickBugs(w: World, dt: number): void {
  const s = w.state;
  // Looking around for nearby buildings is done a few times a second, not every tick.
  const look = Math.floor(s.time * 4) !== Math.floor((s.time - dt) * 4);
  const drawn = new Set(s.ship.launchAt != null ? s.ship.drawn : []);
  // Bugs range further in the dark (#42).
  const night = clockAt(s.time).night;
  const leash = night ? CLOCK.nightLeash : NESTS.leash;
  const closeRadius = night ? CLOCK.nightCloseRadius : NESTS.closeRadius;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    grow(w, e, dt);
    const n = s.nests[e.nest];
    const [hx, hy] = nestCentre(n);
    const def = ENEMIES[e.type];
    if (e.raid) {
      if (night) {
        chase(w, e, n, dt, w.flow, Infinity, false); // a raid: no leash, and the nest stays calm
        continue;
      }
      delete e.raid; // morning: home they go
    }
    if (n.destroyed) {
      chase(w, e, n, dt, w.flow); // homeless: no leash, no calming down
      continue;
    }
    if (drawn.has(n.id) && isAngry(w, n)) {
      chase(w, e, n, dt, w.shipFlow);
      continue;
    }
    if (isAngry(w, n) && hypot(e.x - hx, e.y - hy) <= leash) {
      chase(w, e, n, dt, w.flow, leash);
      continue;
    }
    if (look && (buildingNear(w, e.x, e.y, closeRadius) || playerNear(w, e.x, e.y, closeRadius))) {
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
    const d = hypot(e.tx - e.x, e.ty - e.y);
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

/**
 * Follow a flow field (to the nearest building, or to the shipyard), and chew on whatever is reached.
 * With a leash, a step that would leave it isn't taken: the bug holds at the edge. Otherwise it would
 * step out, turn for home, step back in and chase again, twitching on the spot every tick.
 */
function chase(w: World, e: Enemy, n: Nest, dt: number, flow: Float64Array, leash = Infinity, angers = true): void {
  const def = ENEMIES[e.type];
  const p = playerNear(w, e.x, e.y, PLAYER.notice);
  if (p && hunt(w, e, n, p, dt, leash, angers)) return;
  const tx = Math.floor(e.x);
  const ty = Math.floor(e.y);
  const here = w.buildingAt(tx, ty);
  const dps = def.dps * strength(w, e);
  if (here) {
    bite(w, here, n, dps * dt, angers);
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
  const dist = hypot(gx - e.x, gy - e.y);
  const blocker = w.buildingAt(nx, ny);
  if (blocker && BUILDINGS[blocker.type].blocking && dist <= 0.55 + def.radius) {
    bite(w, blocker, n, dps * dt, angers);
    return;
  }
  const step = Math.min(dist, def.speed * dt);
  if (dist > 0) {
    const mx = e.x + ((gx - e.x) / dist) * step;
    const my = e.y + ((gy - e.y) / dist) * step;
    const [hx, hy] = nestCentre(n);
    if (hypot(mx - hx, my - hy) > leash) return;
    e.x = mx;
    e.y = my;
  }
}

/**
 * Go straight for an engineer close by (D-074), and bite it once in reach. Returns false when the way is
 * blocked by a building, or the leash won't allow it, so the bug follows its path field instead.
 */
function hunt(w: World, e: Enemy, n: Nest, p: Player, dt: number, leash: number, angers: boolean): boolean {
  const def = ENEMIES[e.type];
  const dist = hypot(p.x - e.x, p.y - e.y);
  if (dist <= def.radius + 0.4) {
    hurtPlayer(w, p, def.dps * strength(w, e) * dt);
    if (angers) n.angryUntil = Math.max(n.angryUntil, w.state.time + NESTS.calmAfter);
    return true;
  }
  const step = Math.min(dist - def.radius - 0.3, def.speed * dt);
  const mx = e.x + ((p.x - e.x) / dist) * step;
  const my = e.y + ((p.y - e.y) / dist) * step;
  const blocker = w.buildingAt(Math.floor(mx), Math.floor(my));
  if (blocker && BUILDINGS[blocker.type].blocking) return false;
  const [hx, hy] = nestCentre(n);
  if (hypot(mx - hx, my - hy) > leash) return false;
  e.x = mx;
  e.y = my;
  return true;
}

/** Damage a building; a nest stays angry while it's busy biting (raiders leave it be). */
function bite(w: World, b: Building, n: Nest, amount: number, angers = true): void {
  b.hp -= amount;
  if (angers) n.angryUntil = Math.max(n.angryUntil, w.state.time + NESTS.calmAfter);
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

/** Any nest angry, or any raid out, right now (the flow field is only needed then). */
export function anyAngry(w: World): boolean {
  return w.state.nests.some((n) => isAngry(w, n)) || w.state.enemies.some((e) => e.raid);
}
