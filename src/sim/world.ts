// The simulation. Pure logic with no DOM or rendering, so it can be unit
// tested and later driven by a different (e.g. 3D) front end.

import {
  BELT_SPACING,
  BELT_SPEED,
  BREACH,
  BUILDINGS,
  BuildingType,
  DX,
  DY,
  Dir,
  ENEMIES,
  EXTRACTOR_PERIOD,
  EnemyType,
  GameMode,
  HUB_SIZE,
  HUB_WEAPON,
  ItemCounts,
  ItemId,
  MAP_SIZE,
  NESTS,
  OUTPUT_BUFFER,
  PORT_PERIOD,
  RECIPES,
  RECIPE_BY_ID,
  REPAIR,
  RESEARCH,
  RESEARCH_BY_ID,
  RESOURCE_ITEMS,
  STARTING_BUILDINGS,
  START_INVENTORY,
  TUNNEL_RANGE,
  TURRETS,
  footprint,
  isMachine,
} from './data';
import { ResearchState, createResearchState, drawResearch, researchFraction } from './research';
import { generateNests, generateResources } from './mapgen';
import { Nest, anyAngry, cellKey, onBugHurt, onBuilt, tickBugs } from './nests';
import { ShipState, awaitingChoice, createShipState, insertShip, onShipyardRemoved, shipyard, tickShip } from './ship';

export { createResearchState };
export type { ResearchState };

/**
 * v8 (D-038) is a new kind of map (bigger, with bug territories and larger
 * buildings), so older saves can't be converted and start over.
 */
export const SAVE_VERSION = 8;
export const TICK = 1 / 20;

export interface BeltItem {
  item: ItemId;
  pos: number; // 0 = entry edge, 1 = exit edge
}

export interface Building {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  dir: Dir;
  hp: number;
  belt: BeltItem[]; // belts and tunnel entrances: items ordered front (highest pos) first
  recipe: string | null; // machines
  inputs: ItemCounts; // machines
  outputs: ItemId[]; // extractors, machines, splitters and tunnel exits
  progress: number; // extractors and machines: seconds into the current job, -1 when idle
  ammo: number; // turrets: shots stored; repair stations: HP of repairs stored
  cooldown: number; // turrets
  link: number | null; // tunnels: the paired entrance or exit
  rr: number; // splitters: which output side is next
  filter: ItemId | null; // hub ports: the item taken out of stock
}

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number; // tile units; a tile's centre is (tx + 0.5, ty + 0.5)
  y: number;
  hp: number;
  maxHp: number;
  nest: number; // home territory (Nest.id)
  tx: number; // where it's strolling to while calm
  ty: number;
  wait: number; // seconds left resting while calm
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  width: number;
  height: number;
  resources: number[]; // index into RESOURCE_ITEMS per tile
  buildings: Building[];
  enemies: Enemy[];
  nextId: number;
  time: number;
  mode: GameMode;
  researched: string[];
  research: ResearchState;
  breaches: number; // standard mode: times the hub has fallen
  inventory: ItemCounts;
  hubId: number;
  nests: Nest[];
  gameOver: boolean;
  ship: ShipState;
}

export interface Shot {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  splash: number;
  age: number;
}

export type PlaceError = 'bounds' | 'occupied' | 'locked' | 'cost' | 'needs-resource' | 'needs-hub' | 'unique';
export type ResearchError = 'unknown' | 'done' | 'requires' | 'cost';

/** A save from before v8: it can't be loaded into the new kind of map. */
export class OldSaveError extends Error {}

/** Attack paths reach this far from buildings (bugs never chase further than their leash anyway). */
const FLOW_RANGE = 80;
/** Attack paths are recomputed at most this often (seconds), while any nest is angry. */
const FLOW_REFRESH = 0.5;

export class World {
  state: GameState;
  /** Building id per tile, 0 when empty. */
  tiles: Int32Array;
  byId = new Map<number, Building>();
  /**
   * Cost for an angry bug on each tile to reach the nearest building. 64-bit,
   * like the sums compared against it: with 32-bit storage, rounding made equal
   * paths look shorter (duplicates that could pile up until the heap overflowed)
   * or longer (tiles skipped, so bugs there had no path).
   */
  flow: Float64Array;
  private flowDirty = true;
  private flowAt = -Infinity;
  /** The nest owning each territory cell (see cellKey). */
  nestCells = new Map<number, Nest>();
  shots: Shot[] = [];
  events: string[] = [];
  /** Items delivered to the hub this session (not saved); lets the tutorial notice a first delivery. */
  delivered: ItemCounts = {};

  constructor(state: GameState) {
    this.state = state;
    this.tiles = new Int32Array(state.width * state.height);
    this.flow = new Float64Array(state.width * state.height);
    for (const b of state.buildings) this.index(b);
    for (const n of state.nests) this.nestCells.set(cellKey(n.x / NESTS.cell, n.y / NESTS.cell), n);
  }

  static create(seed = Math.floor(Math.random() * 2 ** 31), mode: GameMode = 'standard'): World {
    const size = MAP_SIZE;
    const state: GameState = {
      version: SAVE_VERSION,
      seed,
      rng: seed,
      width: size,
      height: size,
      resources: new Array(size * size).fill(0),
      buildings: [],
      enemies: [],
      nextId: 1,
      time: 0,
      mode,
      researched: [],
      research: createResearchState(),
      breaches: 0,
      inventory: { ...START_INVENTORY },
      hubId: 0,
      nests: [],
      gameOver: false,
      ship: createShipState(),
    };
    const world = new World(state);
    const hx = Math.floor((size - HUB_SIZE) / 2);
    const hy = hx;
    const centre = hx + Math.floor(HUB_SIZE / 2);
    generateResources(world, centre, centre, HUB_SIZE / 2);
    const hub = world.addBuilding('hub', hx, hy, 0);
    state.hubId = hub.id;
    state.nests = generateNests(world, centre, centre);
    for (const n of state.nests) world.nestCells.set(cellKey(n.x / NESTS.cell, n.y / NESTS.cell), n);
    return world;
  }

  static fromJSON(json: string): World {
    const state = JSON.parse(json) as GameState;
    if (state.version !== SAVE_VERSION) throw new OldSaveError(`Save version ${state.version} is from an older kind of map`);
    return new World(state);
  }

  toJSON(): string {
    return JSON.stringify(this.state);
  }

  // ---------------------------------------------------------------- helpers

  random(): number {
    // mulberry32, with its state kept in the save so runs are reproducible.
    let t = (this.state.rng = (this.state.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.state.width && y < this.state.height;
  }

  idx(x: number, y: number): number {
    return y * this.state.width + x;
  }

  buildingAt(x: number, y: number): Building | undefined {
    if (!this.inBounds(x, y)) return undefined;
    const id = this.tiles[this.idx(x, y)];
    return id ? this.byId.get(id) : undefined;
  }

  resourceAt(x: number, y: number): ItemId | null {
    if (!this.inBounds(x, y)) return null;
    return RESOURCE_ITEMS[this.state.resources[this.idx(x, y)]];
  }

  /** A placed building's width and height on the map. */
  footprintOf(b: Building): [number, number] {
    return footprint(b.type, b.dir);
  }

  /** A placed building's centre, in tile units. */
  centreOf(b: Building): [number, number] {
    const [w, h] = this.footprintOf(b);
    return [b.x + w / 2, b.y + h / 2];
  }

  /** Recomputes attack paths soon (buildings changed, or a nest got angry). */
  markFlowDirty(): void {
    this.flowDirty = true;
    this.flowAt = -Infinity;
  }

  /** Adds a calm bug at a random spot in its nest's territory. */
  spawnBug(type: EnemyType, nest: Nest, hpMult: number): Enemy {
    const c = NESTS.cell;
    const x = nest.x + 0.5 + this.random() * (c - 1);
    const y = nest.y + 0.5 + this.random() * (c - 1);
    const hp = Math.round(ENEMIES[type].hp * hpMult);
    const e: Enemy = { id: this.state.nextId++, type, x, y, hp, maxHp: hp, nest: nest.id, tx: x, ty: y, wait: this.random() * NESTS.pause[1] };
    this.state.enemies.push(e);
    return e;
  }

  get hub(): Building | undefined {
    return this.byId.get(this.state.hubId);
  }

  isUnlocked(type: BuildingType): boolean {
    if (STARTING_BUILDINGS.includes(type)) return true;
    return this.state.researched.some((id) => RESEARCH_BY_ID[id]?.unlocks.includes(type));
  }

  /** Why a research can't be started yet, or null if it can. */
  checkResearch(id: string): ResearchError | null {
    const r = RESEARCH_BY_ID[id];
    if (!r) return 'unknown';
    if (this.state.researched.includes(id)) return 'done';
    if (!r.requires.every((q) => this.state.researched.includes(q))) return 'requires';
    return null;
  }

  /**
   * Makes `id` the active research. It then draws its items from hub stock
   * over its research time. Switching keeps what was already put in.
   */
  startResearch(id: string): ResearchError | null {
    const err = this.checkResearch(id);
    if (err) return err;
    const rs = this.state.research;
    if (rs.active !== id) rs.budget = 0;
    rs.active = id;
    rs.stalled = false;
    return null;
  }

  pauseResearch(): void {
    this.state.research.active = null;
    this.state.research.budget = 0;
    this.state.research.stalled = false;
  }

  /** Fraction (0–1) of a research's items put in so far. */
  researchProgress(id: string): number {
    return researchFraction(this.state.research, RESEARCH_BY_ID[id]);
  }

  /** Finishes a research at once, paying whatever is left from stock (tests, debugging, the menu demo). */
  researchNow(id: string): ResearchError | null {
    const err = this.checkResearch(id);
    if (err) return err;
    const r = RESEARCH_BY_ID[id];
    const paid = this.state.research.paid[id] ?? {};
    const rest: ItemCounts = {};
    for (const [k, n] of Object.entries(r.cost)) rest[k as ItemId] = n! - Math.min(n!, paid[k as ItemId] ?? 0);
    if (!this.canAfford(rest)) return 'cost';
    this.pay(rest);
    this.completeResearch(id);
    return null;
  }

  private completeResearch(id: string): void {
    const r = RESEARCH_BY_ID[id];
    const rs = this.state.research;
    delete rs.paid[id];
    if (rs.active === id) this.pauseResearch();
    this.state.researched.push(id);
    this.events.push(`Researched ${r.name}: ${r.unlocks.map((t) => BUILDINGS[t].name).join(', ')} unlocked`);
  }

  /** Draws the active research's items from hub stock at a steady pace. */
  private tickResearch(dt: number): void {
    const rs = this.state.research;
    if (!rs.active) return;
    if (drawResearch(rs, RESEARCH_BY_ID[rs.active], this.state.inventory, dt)) this.completeResearch(rs.active);
  }

  /** Research whose prerequisites are met but which isn't done yet. */
  availableResearch() {
    return RESEARCH.filter((r) => this.checkResearch(r.id) === null);
  }

  private pay(cost: ItemCounts): void {
    for (const [item, n] of Object.entries(cost)) this.state.inventory[item as ItemId]! -= n!;
  }

  /** Direction pointing away from an adjacent hub, if there is one. */
  private awayFromHub(x: number, y: number): Dir | null {
    for (let d = 0; d < 4; d++) {
      if (this.buildingAt(x - DX[d], y - DY[d])?.type === 'hub') return d as Dir;
    }
    return null;
  }

  canAfford(cost: ItemCounts): boolean {
    return Object.entries(cost).every(([item, n]) => (this.state.inventory[item as ItemId] ?? 0) >= n!);
  }

  private index(b: Building): void {
    this.byId.set(b.id, b);
    const [w, h] = this.footprintOf(b);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.tiles[this.idx(b.x + dx, b.y + dy)] = b.id;
    this.flowDirty = true;
  }

  private unindex(b: Building): void {
    this.byId.delete(b.id);
    const [w, h] = this.footprintOf(b);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.tiles[this.idx(b.x + dx, b.y + dy)] = 0;
    this.flowDirty = true;
  }

  private addBuilding(type: BuildingType, x: number, y: number, dir: Dir): Building {
    const b: Building = {
      id: this.state.nextId++,
      type,
      x,
      y,
      dir,
      hp: BUILDINGS[type].hp,
      belt: [],
      recipe: null,
      inputs: {},
      outputs: [],
      progress: -1,
      // Turrets and repair stations arrive stocked.
      ammo: TURRETS[type]?.maxShots ?? (type === 'repair' ? REPAIR.maxCharge / 2 : 0),
      cooldown: 0,
      link: null,
      rr: 0,
      filter: null,
    };
    this.state.buildings.push(b);
    this.index(b);
    return b;
  }

  // ------------------------------------------------------- player actions

  /**
   * The belt at tile (x, y), if a `type` building placed there would replace
   * it. Any building except another belt can be dropped onto a belt line: it
   * takes over the belts under it and faces the way they ran (D-037).
   */
  beltToReplace(type: BuildingType, x: number, y: number): Building | undefined {
    if (type === 'belt') return undefined;
    const b = this.buildingAt(x, y);
    return b?.type === 'belt' ? b : undefined;
  }

  /**
   * Whether a building can go with its top-left at (x, y), facing `dir`.
   * `replaceBelt`: allow building over a belt (single placements, not drags across a line).
   */
  checkPlace(type: BuildingType, x: number, y: number, dir: Dir = 0, replaceBelt = false): PlaceError | null {
    const [w, h] = footprint(type, dir);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.inBounds(x + dx, y + dy)) return 'bounds';
        const b = this.buildingAt(x + dx, y + dy);
        if (b && !(replaceBelt && this.beltToReplace(type, x + dx, y + dy))) return 'occupied';
      }
    }
    if (type === 'shipyard' && (shipyard(this) || this.state.ship.escaped)) return 'unique';
    if (!this.isUnlocked(type)) return 'locked';
    if (type === 'extractor' && !this.oreUnder(x, y, w, h)) return 'needs-resource';
    if (type === 'port' && this.awayFromHub(x, y) == null) return 'needs-hub';
    if (!this.canAfford(BUILDINGS[type].cost)) return 'cost';
    return null;
  }

  place(type: BuildingType, x: number, y: number, dir: Dir, replaceBelt = false): Building | PlaceError {
    const err = this.checkPlace(type, x, y, dir, replaceBelt);
    if (err) return err;
    this.pay(BUILDINGS[type].cost);
    // Replacing belts: refund them, keeping what they carried for the new building.
    const carried: ItemId[] = [];
    if (replaceBelt) {
      const [w, h] = footprint(type, dir);
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const belt = this.beltToReplace(type, x + dx, y + dy);
          if (!belt) continue;
          carried.push(...belt.belt.map((it) => it.item));
          this.demolish(belt.id);
        }
      }
    }
    if (type === 'port') dir = this.awayFromHub(x, y)!;
    const entrance = type === 'tunnel' ? this.findTunnelEntrance(x, y, dir) : undefined;
    const b = this.addBuilding(type, x, y, dir);
    if (entrance) {
      entrance.link = b.id;
      b.link = entrance.id;
    }
    // Items that were on the belt go into the new building if it takes them.
    for (const item of carried) this.insert(b, item, x - DX[dir], y - DY[dir]);
    if (type === 'extractor') b.recipe = this.oreUnder(x, y, ...footprint(type, dir));
    onBuilt(this, b);
    return b;
  }

  /** The ore covering most of a w×h area at (x, y), if any. */
  oreUnder(x: number, y: number, w: number, h: number): ItemId | null {
    const counts = new Map<ItemId, number>();
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const r = this.resourceAt(x + dx, y + dy);
        if (r) counts.set(r, (counts.get(r) ?? 0) + 1);
      }
    }
    let best: ItemId | null = null;
    let most = 0;
    for (const [r, n] of counts) if (n > most) [best, most] = [r, n];
    return best;
  }

  /** The unpaired tunnel entrance a new tunnel at (x, y) facing `dir` would become the exit of. */
  findTunnelEntrance(x: number, y: number, dir: Dir): Building | undefined {
    for (let k = 1; k <= TUNNEL_RANGE; k++) {
      const b = this.buildingAt(x - DX[dir] * k, y - DY[dir] * k);
      if (b?.type === 'tunnel' && b.dir === dir) return b.link == null ? b : undefined;
    }
    return undefined;
  }

  /** A tunnel is an exit when its partner lies behind it. */
  isTunnelExit(b: Building): boolean {
    const p = b.link != null ? this.byId.get(b.link) : undefined;
    return !!p && (p.x - b.x) * DX[b.dir] + (p.y - b.y) * DY[b.dir] < 0;
  }

  private tunnelLength(entrance: Building): number {
    const p = entrance.link != null ? this.byId.get(entrance.link) : undefined;
    return p ? Math.abs(p.x - entrance.x) + Math.abs(p.y - entrance.y) : 1;
  }

  /** Removes a building, refunding its cost scaled by remaining health. */
  demolish(id: number): boolean {
    const b = this.byId.get(id);
    if (!b || b.type === 'hub') return false;
    const def = BUILDINGS[b.type];
    const frac = b.hp / def.hp;
    for (const [item, n] of Object.entries(def.cost)) {
      const inv = this.state.inventory;
      inv[item as ItemId] = (inv[item as ItemId] ?? 0) + Math.floor(n! * frac);
    }
    this.remove(b);
    return true;
  }

  /** Takes a building off the map. `destroyed`: lost to bugs, not taken down by the player. */
  remove(b: Building, destroyed = false): void {
    if (b.type === 'shipyard') onShipyardRemoved(this, destroyed);
    const partner = b.link != null ? this.byId.get(b.link) : undefined;
    if (partner) {
      partner.link = null;
      partner.belt = []; // items in transit are lost
    }
    this.unindex(b);
    const i = this.state.buildings.indexOf(b);
    if (i >= 0) this.state.buildings.splice(i, 1);
  }

  /** Turns a building in place. Bigger buildings turn only if their new footprint is free. */
  rotate(id: number, dir?: Dir): boolean {
    const b = this.byId.get(id);
    // Tunnels would lose their pair, and ports always face away from the hub.
    if (!b || b.type === 'hub' || b.type === 'tunnel' || b.type === 'port') return false;
    const next = dir ?? (((b.dir + 1) % 4) as Dir);
    const [w, h] = footprint(b.type, next);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const o = this.buildingAt(b.x + dx, b.y + dy);
        if (!this.inBounds(b.x + dx, b.y + dy) || (o && o !== b)) return false;
      }
    }
    this.unindex(b);
    b.dir = next;
    this.index(b);
    return true;
  }

  setRecipe(id: number, recipeId: string | null): void {
    const b = this.byId.get(id);
    if (!b || !isMachine(b.type) || b.recipe === recipeId) return;
    b.recipe = recipeId;
    b.inputs = {};
    b.progress = -1;
  }

  setFilter(id: number, item: ItemId | null): void {
    const b = this.byId.get(id);
    if (b?.type === 'port') b.filter = item;
  }

  /** Recipes a machine can use. */
  recipesFor(type: BuildingType) {
    return RECIPES.filter((r) => r.machine === type);
  }

  // ------------------------------------------------------------ item flow

  /** Tries to hand an item to a building. `fromX/fromY` is the source tile. */
  insert(target: Building, item: ItemId, fromX: number, fromY: number): boolean {
    switch (target.type) {
      case 'belt': {
        // Don't accept items from the tile this belt feeds into.
        if (target.x + DX[target.dir] === fromX && target.y + DY[target.dir] === fromY) return false;
        const last = target.belt[target.belt.length - 1];
        if (last && last.pos < BELT_SPACING) return false;
        target.belt.push({ item, pos: 0 });
        return true;
      }
      case 'shipyard':
        return insertShip(this, item);
      case 'splitter': {
        // Only from directly behind.
        if (target.x - DX[target.dir] !== fromX || target.y - DY[target.dir] !== fromY) return false;
        if (target.outputs.length) return false;
        target.outputs.push(item);
        return true;
      }
      case 'tunnel': {
        if (this.isTunnelExit(target)) return false;
        if (target.x + DX[target.dir] === fromX && target.y + DY[target.dir] === fromY) return false;
        const last = target.belt[target.belt.length - 1];
        if (last && last.pos < BELT_SPACING / this.tunnelLength(target)) return false;
        target.belt.push({ item, pos: 0 });
        return true;
      }
      case 'repair': {
        if (item !== 'iron_plate' || target.ammo + REPAIR.hpPerPlate > REPAIR.maxCharge) return false;
        target.ammo += REPAIR.hpPerPlate;
        return true;
      }
      case 'hub':
        this.deliver(item);
        return true;
      case 'furnace':
      case 'workshop':
      case 'assembler': {
        if (!target.recipe) {
          const r = RECIPES.find((r) => r.machine === target.type && r.inputs[item]);
          if (!r) return false;
          target.recipe = r.id;
        }
        const need = RECIPE_BY_ID[target.recipe].inputs[item];
        if (!need) return false;
        const have = target.inputs[item] ?? 0;
        if (have >= need * 3) return false;
        target.inputs[item] = have + 1;
        return true;
      }
      case 'turret':
      case 'cannon': {
        const def = TURRETS[target.type]!;
        if (item !== def.ammoItem || target.ammo + def.shotsPerItem > def.maxShots) return false;
        target.ammo += def.shotsPerItem;
        return true;
      }
      default:
        return false;
    }
  }

  private deliver(item: ItemId): void {
    const inv = this.state.inventory;
    inv[item] = (inv[item] ?? 0) + 1;
    this.delivered[item] = (this.delivered[item] ?? 0) + 1;
  }

  /**
   * Where a building sends items facing `dir`: the tile just past the middle of
   * that edge (`x, y`), and its own tile on that edge (`fromX, fromY`).
   */
  outputTile(b: Building, dir: Dir = b.dir): { x: number; y: number; fromX: number; fromY: number } {
    const [w, h] = this.footprintOf(b);
    const midX = b.x + Math.floor((w - 1) / 2);
    const midY = b.y + Math.floor((h - 1) / 2);
    const fromX = dir === 0 ? b.x + w - 1 : dir === 2 ? b.x : midX;
    const fromY = dir === 1 ? b.y + h - 1 : dir === 3 ? b.y : midY;
    return { x: fromX + DX[dir], y: fromY + DY[dir], fromX, fromY };
  }

  private pushOutput(b: Building): void {
    if (!b.outputs.length) return;
    const o = this.outputTile(b);
    const target = this.buildingAt(o.x, o.y);
    if (target && target !== b && this.insert(target, b.outputs[0], o.fromX, o.fromY)) b.outputs.shift();
  }

  // ------------------------------------------------------------- the tick

  tick(dt = TICK): void {
    const s = this.state;
    if (s.gameOver || awaitingChoice(this)) return; // lost, or won and waiting on the player
    s.time += dt;

    for (const b of s.buildings) {
      switch (b.type) {
        case 'belt':
          this.tickBelt(b, dt);
          break;
        case 'splitter':
          this.tickSplitter(b);
          break;
        case 'tunnel':
          this.tickTunnel(b, dt);
          break;
        case 'repair':
          this.tickRepair(b, dt);
          break;
        case 'port':
          this.tickPort(b, dt);
          break;
        case 'extractor':
          this.tickExtractor(b, dt);
          break;
        case 'furnace':
        case 'workshop':
        case 'assembler':
          this.tickMachine(b, dt);
          break;
        case 'hub':
        case 'turret':
        case 'cannon':
          this.tickTurret(b, dt);
          break;
      }
    }

    this.tickResearch(dt);
    tickShip(this);
    // Attack paths matter only while a nest is angry; buildings change often, so refresh them at most twice a second.
    if (this.flowDirty && s.time - this.flowAt >= FLOW_REFRESH && anyAngry(this)) this.computeFlow();
    tickBugs(this, dt);
    s.enemies = s.enemies.filter((e) => e.hp > 0);

    for (const b of [...s.buildings]) {
      if (b.hp > 0) continue;
      if (b.type === 'hub') {
        if (s.mode === 'hardcore') {
          s.gameOver = true;
          this.events.push('The hub was destroyed.');
        } else {
          this.breach(b);
        }
      } else {
        this.remove(b, true);
      }
    }

    for (const shot of this.shots) shot.age += dt;
    this.shots = this.shots.filter((sh) => sh.age < 0.12);
  }

  /** Moves items along a belt (or tunnel) of `length` tiles, keeping them spaced. */
  private advanceItems(items: BeltItem[], dt: number, length: number): void {
    const spacing = BELT_SPACING / length;
    for (let i = 0; i < items.length; i++) {
      const limit = i === 0 ? 1 : items[i - 1].pos - spacing;
      items[i].pos = Math.max(items[i].pos, Math.min(items[i].pos + (BELT_SPEED * dt) / length, limit));
    }
  }

  private tickBelt(b: Building, dt: number): void {
    const items = b.belt;
    this.advanceItems(items, dt, 1);
    const front = items[0];
    if (front && front.pos >= 1) {
      const target = this.buildingAt(b.x + DX[b.dir], b.y + DY[b.dir]);
      if (target && this.insert(target, front.item, b.x, b.y)) items.shift();
    }
  }

  private tickSplitter(b: Building): void {
    if (!b.outputs.length) return;
    // Front, left, right, starting from the side after the last one used.
    const sides: Dir[] = [b.dir, ((b.dir + 3) % 4) as Dir, ((b.dir + 1) % 4) as Dir];
    for (let i = 0; i < 3; i++) {
      const k = (b.rr + i) % 3;
      const target = this.buildingAt(b.x + DX[sides[k]], b.y + DY[sides[k]]);
      if (target && this.insert(target, b.outputs[0], b.x, b.y)) {
        b.outputs.shift();
        b.rr = (k + 1) % 3;
        return;
      }
    }
  }

  private tickTunnel(b: Building, dt: number): void {
    this.pushOutput(b); // exits, or a former exit whose entrance was removed
    if (this.isTunnelExit(b)) return;
    const exit = b.link != null ? this.byId.get(b.link) : undefined;
    this.advanceItems(b.belt, dt, this.tunnelLength(b));
    const front = b.belt[0];
    if (exit && front && front.pos >= 1 && exit.outputs.length < OUTPUT_BUFFER) {
      exit.outputs.push(front.item);
      b.belt.shift();
    }
  }

  private tickPort(b: Building, dt: number): void {
    const inv = this.state.inventory;
    if (b.filter && !b.outputs.length && (inv[b.filter] ?? 0) > 0) {
      b.progress = Math.max(b.progress, 0) + dt;
      if (b.progress >= PORT_PERIOD) {
        b.progress = 0;
        inv[b.filter]!--;
        b.outputs.push(b.filter);
      }
    }
    this.pushOutput(b);
  }

  private tickRepair(b: Building, dt: number): void {
    if (b.ammo <= 0) return;
    let worst: Building | undefined;
    let worstFrac = 1;
    for (const o of this.state.buildings) {
      const frac = o.hp / BUILDINGS[o.type].hp;
      if (frac >= worstFrac) continue;
      const [cx, cy] = this.centreOf(o);
      const [ow, oh] = this.footprintOf(o);
      const d = Math.hypot(cx - (b.x + 0.5), cy - (b.y + 0.5));
      if (d <= REPAIR.range + Math.max(ow, oh) / 2 - 0.5) {
        worst = o;
        worstFrac = frac;
      }
    }
    if (!worst) return;
    const heal = Math.min(REPAIR.hpPerSecond * dt, BUILDINGS[worst.type].hp - worst.hp, b.ammo);
    worst.hp += heal;
    b.ammo -= heal;
  }

  private tickExtractor(b: Building, dt: number): void {
    const item = b.recipe as ItemId | null; // the ore it was placed over
    if (item && b.outputs.length < OUTPUT_BUFFER) {
      b.progress = Math.max(b.progress, 0) + dt;
      if (b.progress >= EXTRACTOR_PERIOD) {
        b.progress = 0;
        b.outputs.push(item);
      }
    }
    this.pushOutput(b);
  }

  private tickMachine(b: Building, dt: number): void {
    const recipe = b.recipe ? RECIPE_BY_ID[b.recipe] : undefined;
    if (recipe) {
      if (b.progress < 0 && b.outputs.length + recipe.count <= OUTPUT_BUFFER + 1) {
        const ready = Object.entries(recipe.inputs).every(([k, n]) => (b.inputs[k as ItemId] ?? 0) >= n!);
        if (ready) {
          for (const [k, n] of Object.entries(recipe.inputs)) b.inputs[k as ItemId]! -= n!;
          b.progress = 0;
        }
      }
      if (b.progress >= 0) {
        b.progress += dt;
        if (b.progress >= recipe.time) {
          for (let i = 0; i < recipe.count; i++) b.outputs.push(recipe.output);
          b.progress = -1;
        }
      }
    }
    this.pushOutput(b);
  }

  private tickTurret(b: Building, dt: number): void {
    const hub = b.type === 'hub';
    const def = hub ? HUB_WEAPON : TURRETS[b.type]!;
    if (!hub) this.supplyFromHub(b);
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.cooldown > 0 || (!hub && b.ammo <= 0)) return; // the hub's gun needs no ammo
    const [cx, cy] = this.centreOf(b);
    let target: Enemy | undefined;
    let best = def.range * def.range;
    for (const e of this.state.enemies) {
      const d = (e.x - cx) ** 2 + (e.y - cy) ** 2;
      if (d <= best) {
        best = d;
        target = e;
      }
    }
    if (!target) return;
    if (!hub) b.ammo--;
    b.cooldown = 1 / def.rate;
    if (def.splash > 0) {
      for (const e of this.state.enemies) {
        if ((e.x - target.x) ** 2 + (e.y - target.y) ** 2 > def.splash ** 2) continue;
        e.hp -= def.damage;
        onBugHurt(this, e);
      }
    } else {
      target.hp -= def.damage;
      onBugHurt(this, target);
    }
    this.shots.push({ x1: cx, y1: cy, x2: target.x, y2: target.y, splash: def.splash, age: 0 });
  }

  /** A turret touching the hub reloads from hub stock, one item at a time. */
  private supplyFromHub(b: Building): void {
    const t = TURRETS[b.type];
    if (!t || b.ammo + t.shotsPerItem > t.maxShots || this.awayFromHub(b.x, b.y) == null) return;
    const inv = this.state.inventory;
    if ((inv[t.ammoItem] ?? 0) <= 0) return;
    inv[t.ammoItem]!--;
    b.ammo += t.shotsPerItem;
  }

  /** Whether a building at (x, y) touches the hub's side. */
  touchesHub(x: number, y: number): boolean {
    return this.awayFromHub(x, y) != null;
  }

  /** Standard mode's softer fail: the bugs go home, but it costs stock. */
  private breach(hub: Building): void {
    const s = this.state;
    s.breaches++;
    for (const n of s.nests) n.angryUntil = 0;
    for (const item of Object.keys(s.inventory) as ItemId[]) {
      s.inventory[item] = Math.floor(s.inventory[item]! * (1 - BREACH.stockLost));
    }
    hub.hp = BUILDINGS.hub.hp * BREACH.hubRestore;
    this.events.push(`The hub was breached! The bugs went home, but ${BREACH.stockLost * 100}% of hub stock was lost.`);
  }

  // -------------------------------------------------------------- bugs

  /** Cost for a bug to step onto a tile; blocking buildings must be chewed through. */
  private enterCost(i: number): number {
    const id = this.tiles[i];
    if (!id) return 1;
    const b = this.byId.get(id)!;
    if (!BUILDINGS[b.type].blocking) return 1;
    return 1 + BUILDINGS[b.type].hp / 25;
  }

  /** Dijkstra from every building tile outwards, up to FLOW_RANGE: angry bugs follow it downhill. */
  computeFlow(): void {
    const { width: w, height: h } = this.state;
    const flow = this.flow;
    flow.fill(Infinity);
    const heap = new MinHeap();
    for (const b of this.state.buildings) {
      const [bw, bh] = this.footprintOf(b);
      for (let dy = 0; dy < bh; dy++)
        for (let dx = 0; dx < bw; dx++) {
          const i = this.idx(b.x + dx, b.y + dy);
          flow[i] = 0;
          heap.push(i, 0);
        }
    }
    while (heap.size) {
      const [i, d] = heap.pop();
      if (d > flow[i] || d > FLOW_RANGE) continue;
      const x = i % w;
      const y = (i - x) / w;
      const step = this.enterCost(i);
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        const nd = d + step;
        if (nd < flow[n]) {
          flow[n] = nd;
          heap.push(n, nd);
        }
      }
    }
    this.flowDirty = false;
    this.flowAt = this.state.time;
  }
}

/** Minimal binary heap keyed by distance, for the flow field. */
class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, key: number): void {
    const ids = this.ids;
    const keys = this.keys;
    let i = ids.length;
    ids.push(id);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      ids[i] = ids[p];
      keys[i] = keys[p];
      i = p;
    }
    ids[i] = id;
    keys[i] = key;
  }

  pop(): [number, number] {
    const ids = this.ids;
    const keys = this.keys;
    const top: [number, number] = [ids[0], keys[0]];
    const lastId = ids.pop()!;
    const lastKey = keys.pop()!;
    const n = ids.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && keys[r] < keys[l] ? r : l;
        if (keys[c] >= lastKey) break;
        ids[i] = ids[c];
        keys[i] = keys[c];
        i = c;
      }
      ids[i] = lastId;
      keys[i] = lastKey;
    }
    return top;
  }
}
