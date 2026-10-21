// The simulation. Pure logic with no DOM or rendering, so it can be unit
// tested and later driven by a different (e.g. 3D) front end.

import {
  BELT_SPACING,
  BELT_SPEED,
  BLACK_MARKET,
  BREACH,
  BUILDINGS,
  BuildingType,
  DX,
  DY,
  Dir,
  ENEMIES,
  EXTRACTOR_PERIOD,
  EnemyType,
  FIRST_WAVE_AT,
  GameMode,
  HUB_SIZE,
  HUB_WEAPON,
  ItemCounts,
  ItemId,
  MAP_SIZE,
  OUTPUT_BUFFER,
  PORT_PERIOD,
  RECIPES,
  RECIPE_BY_ID,
  REPAIR,
  RESEARCH,
  RESEARCH_BY_ID,
  RESOURCE_ITEMS,
  SPAWN_GAP,
  STARTING_BUILDINGS,
  START_INVENTORY,
  TUNNEL_RANGE,
  TURRETS,
  WAVE_INTERVAL,
  isMachine,
  waveComposition,
} from './data';
import {
  COMPANY,
  CompanyState,
  createCompanyState,
  onBreach,
  onDelivered,
  onFirstWave,
  onResearched,
  tickCompany,
  welcomeMail,
} from './company';
import { ResearchState, createResearchState, drawResearch, researchFraction } from './research';
import {
  BlackMarketState,
  createBlackMarketState,
  insertStash,
  isBlackMarketUnlocked,
  isContraband,
  onPortWithdrawal,
  onSkim,
  onStashRemoved,
  tickBlackMarket,
} from './blackmarket';

export { createResearchState };
export type { ResearchState };

export const SAVE_VERSION = 6;
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
}

export interface PendingSpawn {
  type: EnemyType;
  x: number;
  y: number;
  hpMult: number;
  at: number;
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
  wave: number;
  nextWaveAt: number;
  spawnQueue: PendingSpawn[];
  nextSpawnPoints: { x: number; y: number }[];
  gameOver: boolean;
  company: CompanyState;
  blackMarket: BlackMarketState;
}

export interface Shot {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  splash: number;
  age: number;
}

export type PlaceError = 'bounds' | 'occupied' | 'locked' | 'cost' | 'needs-resource' | 'needs-hub';
export type ResearchError = 'unknown' | 'done' | 'requires' | 'cost';


export class World {
  state: GameState;
  /** Building id per tile, 0 when empty. */
  tiles: Int32Array;
  byId = new Map<number, Building>();
  /** Cost for an enemy on each tile to reach the hub. */
  flow: Float32Array;
  private flowDirty = true;
  shots: Shot[] = [];
  events: string[] = [];
  /** Items delivered to the hub this session (not saved); lets the tutorial notice a first delivery. */
  delivered: ItemCounts = {};

  constructor(state: GameState) {
    this.state = state;
    this.tiles = new Int32Array(state.width * state.height);
    this.flow = new Float32Array(state.width * state.height);
    for (const b of state.buildings) this.index(b);
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
      wave: 0,
      nextWaveAt: FIRST_WAVE_AT,
      spawnQueue: [],
      nextSpawnPoints: [],
      gameOver: false,
      company: createCompanyState(),
      blackMarket: createBlackMarketState(),
    };
    const world = new World(state);
    welcomeMail(world);
    const hx = Math.floor(size / 2) - 1;
    const hy = Math.floor(size / 2) - 1;
    world.generateResources(hx + 1, hy + 1);
    const hub = world.addBuilding('hub', hx, hy, 0);
    state.hubId = hub.id;
    state.nextSpawnPoints = world.pickSpawnPoints(waveComposition(1).spawnPoints);
    return world;
  }

  static fromJSON(json: string): World {
    const state = JSON.parse(json) as GameState;
    if (state.version === 1) {
      // v2 added tunnels and splitters.
      for (const b of state.buildings) Object.assign(b, { link: null, rr: 0 });
      state.version = 2;
    }
    if (state.version === 2) {
      // v3 replaced tiers with research and added modes and hub ports.
      const old = state as unknown as { tier?: number; tierProgress?: unknown };
      const byTier = [
        ['defense', 'masonry', 'workshop', 'logistics', 'underground'],
        ['distribution', 'assembly', 'repair', 'ordnance'],
      ];
      state.researched = byTier.slice(0, (old.tier ?? 0) + 1).flat();
      delete old.tier;
      delete old.tierProgress;
      state.mode = 'standard';
      state.breaches = 0;
      for (const b of state.buildings) b.filter = null;
      state.version = 3;
    }
    let addedCompany = false;
    if (state.version === 3) {
      // v4 added the Company: contracts, debt and the inbox.
      state.company = createCompanyState();
      state.company.nextContractAt = state.time + COMPANY.firstContractAt;
      state.version = 4;
      addedCompany = true;
    }
    if (state.version === 4) {
      // v5 made research take time.
      state.research = createResearchState();
      state.version = 5;
    }
    if (state.version === 5) {
      // v6 added the black market: stash, skimmer, suspicion and audits.
      state.blackMarket = createBlackMarketState();
      state.version = 6;
    }
    if (state.version !== SAVE_VERSION) throw new Error(`Unsupported save version ${state.version}`);
    const world = new World(state);
    if (addedCompany) welcomeMail(world);
    return world;
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

  sizeOf(type: BuildingType): number {
    return type === 'hub' ? HUB_SIZE : 1;
  }

  get hub(): Building | undefined {
    return this.byId.get(this.state.hubId);
  }

  isUnlocked(type: BuildingType): boolean {
    if (STARTING_BUILDINGS.includes(type)) return true;
    if (isContraband(type)) return isBlackMarketUnlocked(this, type);
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
    onResearched(this, r.name);
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
    const s = this.sizeOf(b.type);
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) this.tiles[this.idx(b.x + dx, b.y + dy)] = b.id;
    this.flowDirty = true;
  }

  private unindex(b: Building): void {
    this.byId.delete(b.id);
    const s = this.sizeOf(b.type);
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) this.tiles[this.idx(b.x + dx, b.y + dy)] = 0;
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

  // ------------------------------------------------------------ map setup

  private generateResources(hubCx: number, hubCy: number): void {
    // Patches are spaced apart, and no two node tiles touch side by side, so
    // every node has free sides for a belt or a neighbouring machine.
    const centres: [number, number][] = [];
    const baseAngle = this.random() * Math.PI * 2;
    [1, 2, 3].forEach((kind, i) => {
      const a = baseAngle + (i * Math.PI * 2) / 3;
      const d = 8 + this.random() * 3;
      const cx = Math.round(hubCx + Math.cos(a) * d);
      const cy = Math.round(hubCy + Math.sin(a) * d);
      centres.push([cx, cy]);
      this.patch(cx, cy, kind, 8);
    });
    const counts: [number, number][] = [
      [1, 7],
      [2, 6],
      [3, 5],
    ];
    for (const [kind, n] of counts) {
      for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
        const x = 3 + Math.floor(this.random() * (this.state.width - 6));
        const y = 3 + Math.floor(this.random() * (this.state.height - 6));
        if (Math.abs(x - hubCx) < 8 && Math.abs(y - hubCy) < 8) continue;
        if (centres.some(([cx, cy]) => Math.abs(x - cx) < 9 && Math.abs(y - cy) < 9)) continue;
        centres.push([x, y]);
        this.patch(x, y, kind, 6 + Math.floor(this.random() * 6));
        i++;
      }
    }
  }

  /** Scatters up to `size` node tiles within 3 tiles of a centre, none touching side by side. */
  private patch(cx: number, cy: number, kind: number, size: number): void {
    const spots: [number, number][] = [];
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) spots.push([cx + dx, cy + dy]);
    }
    // Closest spots first, with some jitter so patches aren't perfect diamonds.
    const order = spots
      .map(([x, y]) => ({ x, y, k: Math.hypot(x - cx, y - cy) + this.random() * 2 }))
      .sort((a, b) => a.k - b.k);
    let placed = 0;
    for (const { x, y } of order) {
      if (placed >= size) break;
      if (!this.inBounds(x, y) || this.state.resources[this.idx(x, y)]) continue;
      const touching = [0, 1, 2, 3].some((d) => {
        const nx = x + DX[d];
        const ny = y + DY[d];
        return this.inBounds(nx, ny) && this.state.resources[this.idx(nx, ny)] !== 0;
      });
      if (touching) continue;
      this.state.resources[this.idx(x, y)] = kind;
      placed++;
    }
  }

  pickSpawnPoints(n: number): { x: number; y: number }[] {
    const { width: w, height: h } = this.state;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const side = Math.floor(this.random() * 4);
      const along = 3 + Math.floor(this.random() * (Math.min(w, h) - 6));
      if (side === 0) points.push({ x: w - 1, y: along });
      else if (side === 1) points.push({ x: along, y: h - 1 });
      else if (side === 2) points.push({ x: 0, y: along });
      else points.push({ x: along, y: 0 });
    }
    return points;
  }

  // ------------------------------------------------------- player actions

  checkPlace(type: BuildingType, x: number, y: number): PlaceError | null {
    if (!this.inBounds(x, y)) return 'bounds';
    if (this.buildingAt(x, y)) return 'occupied';
    if (!this.isUnlocked(type)) return 'locked';
    if (type === 'extractor' && !this.resourceAt(x, y)) return 'needs-resource';
    if (type === 'port' && this.awayFromHub(x, y) == null) return 'needs-hub';
    if (!this.canAfford(BUILDINGS[type].cost)) return 'cost';
    return null;
  }

  place(type: BuildingType, x: number, y: number, dir: Dir): Building | PlaceError {
    const err = this.checkPlace(type, x, y);
    if (err) return err;
    this.pay(BUILDINGS[type].cost);
    if (type === 'port') dir = this.awayFromHub(x, y)!;
    const entrance = type === 'tunnel' ? this.findTunnelEntrance(x, y, dir) : undefined;
    const b = this.addBuilding(type, x, y, dir);
    if (entrance) {
      entrance.link = b.id;
      b.link = entrance.id;
    }
    return b;
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

  /** Removes a building with no refund (an audit confiscating contraband). */
  confiscate(b: Building): void {
    this.remove(b);
  }

  private remove(b: Building): void {
    if (b.type === 'stash') onStashRemoved(this);
    const partner = b.link != null ? this.byId.get(b.link) : undefined;
    if (partner) {
      partner.link = null;
      partner.belt = []; // items in transit are lost
    }
    this.unindex(b);
    const i = this.state.buildings.indexOf(b);
    if (i >= 0) this.state.buildings.splice(i, 1);
  }

  rotate(id: number, dir?: Dir): void {
    const b = this.byId.get(id);
    // Tunnels would lose their pair, and ports always face away from the hub.
    if (!b || b.type === 'hub' || b.type === 'tunnel' || b.type === 'port') return;
    b.dir = dir ?? (((b.dir + 1) % 4) as Dir);
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
      case 'stash':
        return insertStash(this, item);
      case 'skimmer':
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
    onDelivered(this, item);
  }

  private pushOutput(b: Building): void {
    if (!b.outputs.length) return;
    const target = this.buildingAt(b.x + DX[b.dir], b.y + DY[b.dir]);
    if (target && target !== b && this.insert(target, b.outputs[0], b.x, b.y)) b.outputs.shift();
  }

  // ------------------------------------------------------------- the tick

  tick(dt = TICK): void {
    const s = this.state;
    if (s.gameOver) return;
    s.time += dt;

    for (const b of s.buildings) {
      switch (b.type) {
        case 'belt':
          this.tickBelt(b, dt);
          break;
        case 'splitter':
          this.tickSplitter(b);
          break;
        case 'skimmer':
          this.tickSkimmer(b);
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
    this.tickWaves();
    tickCompany(this);
    tickBlackMarket(this, dt);
    if (this.flowDirty) this.computeFlow();
    this.tickEnemies(dt);

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
        this.remove(b);
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

  /** Passes items straight on, except every Nth, which slips out of the right side. */
  private tickSkimmer(b: Building): void {
    if (!b.outputs.length) return;
    const item = b.outputs[0];
    const skimTurn = b.rr % BLACK_MARKET.skimEvery === BLACK_MARKET.skimEvery - 1;
    if (skimTurn) {
      const right = ((b.dir + 1) % 4) as Dir;
      const side = this.buildingAt(b.x + DX[right], b.y + DY[right]);
      if (side && this.insert(side, item, b.x, b.y)) {
        b.outputs.shift();
        b.rr++;
        onSkim(this);
        return;
      }
    }
    const front = this.buildingAt(b.x + DX[b.dir], b.y + DY[b.dir]);
    if (front && this.insert(front, item, b.x, b.y)) {
      b.outputs.shift();
      b.rr++;
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
        onPortWithdrawal(this);
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
      const size = this.sizeOf(o.type);
      const d = Math.hypot(o.x + size / 2 - (b.x + 0.5), o.y + size / 2 - (b.y + 0.5));
      if (d <= REPAIR.range + size / 2 - 0.5) {
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
    const item = this.resourceAt(b.x, b.y);
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
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.cooldown > 0 || (!hub && b.ammo <= 0)) return; // the hub's gun needs no ammo
    const half = this.sizeOf(b.type) / 2;
    const cx = b.x + half;
    const cy = b.y + half;
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
        if ((e.x - target.x) ** 2 + (e.y - target.y) ** 2 <= def.splash ** 2) e.hp -= def.damage;
      }
    } else {
      target.hp -= def.damage;
    }
    this.shots.push({ x1: cx, y1: cy, x2: target.x, y2: target.y, splash: def.splash, age: 0 });
  }

  /** Standard mode's softer fail: the attack ends, but it costs stock and time. */
  private breach(hub: Building): void {
    const s = this.state;
    s.breaches++;
    s.enemies = [];
    s.spawnQueue = [];
    for (const item of Object.keys(s.inventory) as ItemId[]) {
      s.inventory[item] = Math.floor(s.inventory[item]! * (1 - BREACH.stockLost));
    }
    hub.hp = BUILDINGS.hub.hp * BREACH.hubRestore;
    s.nextWaveAt = Math.max(s.nextWaveAt, s.time) + BREACH.waveDelay;
    this.events.push(`The hub was breached! The attack is over, but ${BREACH.stockLost * 100}% of hub stock was lost.`);
    onBreach(this);
  }

  // ---------------------------------------------------------------- waves

  private tickWaves(): void {
    const s = this.state;
    if (s.time >= s.nextWaveAt) this.startWave();
    if (!s.spawnQueue.length) return;
    const due = s.spawnQueue.filter((p) => p.at <= s.time);
    if (!due.length) return;
    s.spawnQueue = s.spawnQueue.filter((p) => p.at > s.time);
    for (const p of due) {
      const def = ENEMIES[p.type];
      const hp = Math.round(def.hp * p.hpMult);
      s.enemies.push({ id: s.nextId++, type: p.type, x: p.x, y: p.y, hp, maxHp: hp });
    }
  }

  startWave(): void {
    const s = this.state;
    s.wave++;
    if (s.wave === 1) onFirstWave(this);
    const comp = waveComposition(s.wave);
    const points = s.nextSpawnPoints.length ? s.nextSpawnPoints : this.pickSpawnPoints(comp.spawnPoints);
    const types: EnemyType[] = [
      ...Array(comp.crawlers).fill('crawler'),
      ...Array(comp.runners).fill('runner'),
      ...Array(comp.brutes).fill('brute'),
    ];
    types.forEach((type, i) => {
      const p = points[i % points.length];
      const jitter = () => (this.random() - 0.5) * 1.5;
      s.spawnQueue.push({
        type,
        x: Math.min(s.width - 0.01, Math.max(0, p.x + 0.5 + jitter())),
        y: Math.min(s.height - 0.01, Math.max(0, p.y + 0.5 + jitter())),
        hpMult: comp.hpMult,
        at: s.time + Math.floor(i / points.length) * SPAWN_GAP,
      });
    });
    s.nextWaveAt += WAVE_INTERVAL;
    s.nextSpawnPoints = this.pickSpawnPoints(waveComposition(s.wave + 1).spawnPoints);
    this.events.push(`Wave ${s.wave} incoming!`);
  }

  // -------------------------------------------------------------- enemies

  /** Cost for an enemy to step onto a tile; blocking buildings must be chewed through. */
  private enterCost(i: number): number {
    const id = this.tiles[i];
    if (!id) return 1;
    const b = this.byId.get(id)!;
    if (b.type === 'hub' || !BUILDINGS[b.type].blocking) return 1;
    return 1 + BUILDINGS[b.type].hp / 25;
  }

  /** Dijkstra from the hub over the whole map. */
  computeFlow(): void {
    const { width: w, height: h } = this.state;
    const flow = this.flow;
    flow.fill(Infinity);
    const heap = new MinHeap();
    const hub = this.hub;
    if (hub) {
      for (let dy = 0; dy < HUB_SIZE; dy++)
        for (let dx = 0; dx < HUB_SIZE; dx++) {
          const i = this.idx(hub.x + dx, hub.y + dy);
          flow[i] = 0;
          heap.push(i, 0);
        }
    }
    while (heap.size) {
      const [i, d] = heap.pop();
      if (d > flow[i]) continue;
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
  }

  private tickEnemies(dt: number): void {
    const s = this.state;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMIES[e.type];
      const tx = Math.floor(e.x);
      const ty = Math.floor(e.y);
      let bestTile = -1;
      let bestCost = Infinity;
      for (let k = 0; k < 4; k++) {
        const nx = tx + DX[k];
        const ny = ty + DY[k];
        if (!this.inBounds(nx, ny)) continue;
        const n = this.idx(nx, ny);
        const c = this.flow[n] + this.enterCost(n);
        if (c < bestCost) {
          bestCost = c;
          bestTile = n;
        }
      }
      if (bestTile < 0) continue;
      const nx = bestTile % s.width;
      const ny = (bestTile - nx) / s.width;
      const blocker = this.buildingAt(nx, ny);
      const gx = nx + 0.5;
      const gy = ny + 0.5;
      const dist = Math.hypot(gx - e.x, gy - e.y);
      if (blocker && BUILDINGS[blocker.type].blocking && dist <= 0.55 + def.radius) {
        blocker.hp -= def.dps * dt;
        continue;
      }
      const step = Math.min(dist, def.speed * dt);
      if (dist > 0) {
        e.x += ((gx - e.x) / dist) * step;
        e.y += ((gy - e.y) / dist) * step;
      }
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
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
