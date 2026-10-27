// The simulation. Pure logic with no DOM or rendering, so it can be unit
// tested and later driven by a different (e.g. 3D) front end.

import {
  BELT_SPACING,
  BELT_SPEED,
  CRATE_SIZE,
  BLUEPRINTS,
  BLUEPRINT_BY_ID,
  beltSpeed,
  isBelt,
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
  LUMBER,
  ROLLER,
  MAP_SIZE,
  NESTS,
  ORE,
  OUTPUT_BUFFER,
  PORT_PERIOD,
  RECIPES,
  RECIPE_BY_ID,
  REPAIR,
  RESEARCH,
  RESEARCH_BY_ID,
  RESOURCE_ITEMS,
  SHIP,
  SHIP_SITE,
  SPIKES,
  STARTING_BUILDINGS,
  START_INVENTORY,
  TUNNEL_RANGE,
  TURRETS,
  HAND_MINING,
  PLATING,
  PLAYER,
  footprint,
  moundHp,
  isMachine,
  FUEL,
  burnsFuel,
  storageRoom,
  POWER,
  HYDRAULIC,
  CONDUCTS,
} from './data';
import { clockAt } from './clock';
import { ResearchState, createResearchState, drawResearch, researchFraction } from './research';
import { generateNests, generatePonds, generateResources, generateTrees, seeded } from './mapgen';
import { hypot } from './math';
import { newFog, revealBuilding, tickFog } from './fog';
import { Nest, announceThreat, anyAngry, broodFor, startRaids, cellKey, damageMound, moundAt, moundInRange, nestCentre, onBugHurt, onBuilt, tickBreeding, tickBugs, tickSpread } from './nests';
import { Player, PlayerAction, emptySlots, give, goAndDo, handOver, isDown, moveTo, newPlayer, playerOf, reaches, inReach, roomFor, sendHome, tickPlayers, walk } from './player';
import { ShipState, createShipState, insertShip, onShipyardRemoved, shipyard, tickShip } from './ship';

export { createResearchState };
export type { Player };
export type { ResearchState };

/**
 * v8 (D-038) is a new kind of map (bigger, with bug territories and larger
 * buildings), so older saves can't be converted and start over.
 * v9 (D-044) adds trees; v8 saves get forest grown around what's already built.
 * v10 (D-046) turns the escape ship into a supply ship; an escaped game counts one run delivered.
 * v11 (D-049) adds colony blueprints; a game with runs delivered gets an offer to pick from.
 * v14 (#38) moves belts into the Logistics research; older games get it for free.
 * v15 (#33, #34) resizes the workshop, assembler and splitter; ones that no longer fit are refunded.
 * v16 (D-065) gives nests mounds with health; nests already cleared of bugs count as destroyed.
 * v17 (#40, D-067) gives players a character: a position, a path and what it carries.
 * v18 (#61, D-069) gives belts two lanes; items already on belts go onto the right lane.
 * v19 (D-065) lets nests breed: each records the bugs it breeds back up to.
 * v20 (D-074) gives the engineer health.
 * v21 (#87, D-090) turns what the engineer carries into an inventory of slots.
 * v22 (D-091) lets an angry bug give up and head home; older saves' bugs are all still chasing.
 * v27 (D-112) adds fog of war; older saves have seen what their buildings and engineers can see.
 * v28 (D-113): furnaces smelt iron ingots; workshops making gears or wire become machine shops.
 * v29 (D-114): furnaces and blacksmiths burn fuel; old ones start with a full store.
 * v30 (D-115) adds ponds, and powered belts: old games get Hydraulics with Logistics, and stock for wells.
 * v31 (D-117): turrets and cannons need power, and Masonry goes into Advanced Defense.
 * v32 (D-118): the ship gains the launch pad, its second stage; a ship past the scaffolding has it built.
 * v33 (D-120): steel needs Steelmaking; a game already making or holding steel gets it, and Engineering.
 */
export const SAVE_VERSION = 33;
export const TICK = 1 / 20;

/** What grows on a tile (GameState.trees). */
export const NO_TREE = 0;
export const TREE = 1;
export const STUMP = 2;

/** A belt's two lanes (#61): 0 is the left, 1 the right, looking the way the belt runs. */
export type Lane = 0 | 1;
export const LEFT: Lane = 0;
export const RIGHT: Lane = 1;

export interface BeltItem {
  item: ItemId;
  pos: number; // 0 = entry edge, 1 = exit edge
  lane: Lane;
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
  ammo: number; // turrets: shots stored; repair stations: HP of repairs stored; furnaces and blacksmiths: seconds of fuel (D-114)
  cooldown: number; // turrets
  link: number | null; // tunnels: the paired entrance or exit
  rr: number; // splitters: which output side is next
  filter: ItemId | null; // hub ports: the item taken out of stock; splitters: the item sorted to `side` (#62)
  /** Splitters: the lane each buffered item came in on, so it leaves on the same one (#61). */
  outLanes?: Lane[];
  /** Splitters: which side the filtered item goes out of; everything else takes the other (#62). */
  side?: 'left' | 'right';
  /** Splitters: the last item each of its two lanes took in, and when, to keep two kinds apart (#92). */
  fed?: ({ item: ItemId; at: number } | null)[];
  /** Splitters: the lane (0 or 1, see splitterLanes) the buffered item came in through (#92). */
  inFrom?: number;
}

/** A furnace or blacksmith with no fuel left, which stops until it gets more (D-114). */
export const outOfFuel = (b: Building): boolean => burnsFuel(b.type) && b.ammo <= 0;

/** A splitter whose two lanes both took in an item this recently, of different kinds, keeps them apart (#92). */
export const SPLITTER_SORT_WINDOW = 5;

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
  born?: number; // game time it hatched, while it's still growing up (D-065); adults have none
  raid?: boolean; // out on a night raid (D-065), until morning and nothing is left in reach
  home?: boolean; // gave up the chase with nothing in reach (D-091): heading back into its territory
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  width: number;
  height: number;
  resources: number[]; // index into RESOURCE_ITEMS per tile
  trees: number[]; // NO_TREE, TREE or STUMP per tile
  regrow: Record<number, number>; // stump tile index -> game time it grows back
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
  /** When the attack-path fields were last rebuilt, and whether they're due (saved so co-op games agree, D-058). */
  paths: PathTimers;
  /** Who is playing. One in single player; co-op adds more (D-056). */
  players: Player[];
  /** Game time when a bug territory next spreads (#51). */
  nextSpread: number;
  /** Where the shipyard goes: a 5×5 site staked out at the start (D-109). Its top-left tile. */
  shipSite?: { x: number; y: number };
  /** Ore taken from each ore tile so far (D-096); at ORE.perTile it's bare ground. */
  oreMined?: Record<number, number>;
  /** Times each tile's tree has been cut (D-094); past LUMBER.regrowths the stump doesn't grow back. */
  cuts?: Record<number, number>;
  /** Fog of war (D-112): 1 for each FOG.cell-sized cell anyone has seen, row by row. */
  explored: number[];
  /** Ponds (D-095, D-115): the indices of water tiles, in order. */
  water: number[];
}

/** One power network (D-115): what its sources give and its belts use. */
export interface PowerNet {
  supply: number;
  demand: number;
}

export interface PathTimers {
  dirty: boolean;
  at: number | null; // game time of the last rebuild; null: never, or rebuild at once
  shipDirty: boolean;
  shipAt: number | null;
}


/** One tap of hand mining (#38): `item` is set when the tap finished one. */
export interface HandTap {
  x: number;
  y: number;
  ore: ItemId;
  item: ItemId | null;
  age: number;
}

export interface Shot {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  splash: number;
  age: number;
  arc?: boolean; // a tesla's lightning
  jump?: boolean; // an arc jumping on from one bug to the next, not fired from a turret
}

/** 'far': the character walks over and mines on arriving. 'full': its inventory has no room for it. */
export type MineError = 'no-ore' | 'occupied' | 'far' | 'full' | 'down';
export type PlaceError = 'bounds' | 'occupied' | 'tree' | 'nest' | 'locked' | 'cost' | 'needs-resource' | 'needs-trees' | 'needs-hub' | 'unique' | 'site' | 'unmovable' | 'water' | 'needs-water';
export type ResearchError = 'unknown' | 'done' | 'requires' | 'cost';

/** A save from before v8: it can't be loaded into the new kind of map. */
export class OldSaveError extends Error {}

/** Attack paths reach this far from buildings (bugs give up long before; see NESTS.giveUp). */
const FLOW_RANGE = 80;
/** Attack paths are recomputed at most this often (seconds), while any nest is angry. */
const FLOW_REFRESH = 0.5;
/** Extra reach of the shipyard's flow field past its furthest woken nest: detours and chewing through walls. */
const SHIP_FLOW_MARGIN = 40;

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
  /** Cost to reach the shipyard from each tile, for bugs drawn to it by a launch (D-047). */
  shipFlow: Float64Array;
  /** The nest owning each territory cell (see cellKey). */
  nestCells = new Map<number, Nest>();
  shots: Shot[] = [];
  /**
   * Buildings lost to bugs in the last moment (not saved); lets sound tell them from demolishing, and
   * says where the debris flies (its centre, and how many tiles across it was).
   */
  lost: { id: number; age: number; x: number; y: number; size: number }[] = [];
  /** Buildings a repair station mended in the last moment (not saved), for sparkles: their centres, and the station. */
  healed: { x: number; y: number; age: number; by: number }[] = [];
  events: string[] = [];
  /**
   * Messages about one engineer (not saved): its own player reads `mine`, the others `others` (co-op
   * phase 3, D-080).
   */
  playerEvents: { player: number; mine: string; others: string }[] = [];
  /** Trees cut in the last moment (not saved), for effects and sound. */
  felled: { x: number; y: number; age: number }[] = [];
  /** Hand-mining taps in the last moment (not saved), for sparks and sound. */
  taps: HandTap[] = [];
  /** Counts changes to what stands on the ground: buildings and trees (not saved). Lets the renderer keep a cached picture of the ground until it changes. */
  layout = 0;
  /** Items handed to the next belt this tick: they've had their move, even if that belt is updated later in the tick. */
  private movedThisTick = new Set<BeltItem>();
  /** When each building made something in the last minute, and since when it's been watched (not saved), for the rates in its panel. */
  private made = new Map<number, number[]>();
  private watchedSince = new Map<number, number>();
  /** Items delivered to the hub this session (not saved); lets the tutorial notice a first delivery. */
  delivered: ItemCounts = {};
  /** Water tiles (D-115), from `state.water`. */
  private wet: Uint8Array;
  /** Power networks (D-115), worked out from the buildings whenever they change (`layout`): each conductor's network. */
  private nets = new Map<number, PowerNet>();
  private netsAt = -1;

  constructor(state: GameState) {
    this.state = state;
    this.tiles = new Int32Array(state.width * state.height);
    this.wet = new Uint8Array(state.width * state.height);
    for (const i of state.water ?? []) this.wet[i] = 1;
    this.flow = new Float64Array(state.width * state.height);
    this.shipFlow = new Float64Array(state.width * state.height);
    for (const b of state.buildings) this.index(b, false);
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
      trees: new Array(size * size).fill(NO_TREE),
      regrow: {},
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
      paths: { dirty: true, at: null, shipDirty: true, shipAt: null },
      players: [],
      nextSpread: NESTS.spreadEvery,
      explored: [],
      water: [],
    };
    state.explored = newFog(state);
    const world = new World(state);
    const hx = Math.floor((size - HUB_SIZE) / 2);
    const hy = hx;
    const centre = hx + Math.floor(HUB_SIZE / 2);
    generateResources(world, centre, centre, HUB_SIZE / 2);
    world.addWater(generatePonds(size, size, centre, centre, () => world.random(), () => true));
    const hub = world.addBuilding('hub', hx, hy, 0);
    state.hubId = hub.id;
    state.players = [newPlayer(world, 0)];
    tickFog(state);
    generateTrees(world, centre, centre);
    state.nests = generateNests(world, centre, centre);
    for (const n of state.nests) world.nestCells.set(cellKey(n.x / NESTS.cell, n.y / NESTS.cell), n);
    const sites = shipSites(state);
    state.shipSite = sites[Math.floor(world.random() * sites.length)];
    return world;
  }

  static fromJSON(json: string): World {
    const state = JSON.parse(json) as GameState;
    const before = state.version;
    if (state.version === 8) World.migrateV8(state);
    if (state.version === 9) World.migrateV9(state);
    if (state.version === 10) World.migrateV10(state);
    if (state.version === 11) World.migrateV11(state);
    if (state.version === 12) World.migrateV12(state);
    if (state.version === 13) World.migrateV13(state);
    if (state.version === 14) World.migrateV14(state);
    if (state.version === 15) World.migrateV15(state);
    if (state.version === 16) World.migrateV16(state);
    if (state.version === 17) World.migrateV17(state);
    if (state.version === 18) World.migrateV18(state);
    if (state.version === 19) World.migrateV19(state);
    if (state.version === 20) World.migrateV20(state);
    if (state.version === 21) World.migrateV21(state);
    if (state.version === 22) World.migrateV22(state);
    if (state.version === 23) World.migrateV23(state);
    if (state.version === 24) World.migrateV24(state);
    if (state.version === 25) World.migrateV25(state);
    if (state.version === 26) World.migrateV26(state);
    if (state.version === 27) World.migrateV27(state);
    if (state.version === 28) World.migrateV28(state);
    if (state.version === 29) World.migrateV29(state);
    if (state.version === 30) World.migrateV30(state);
    if (state.version === 31) World.migrateV31(state);
    if (state.version === 32) World.migrateV32(state);
    if (state.version !== SAVE_VERSION) throw new OldSaveError(`Save version ${state.version} is from an older kind of map`);
    const world = new World(state);
    if (before < 30) world.addPonds(); // once the building index exists, to keep ponds off buildings
    world.rebuildPaths();
    return world;
  }

  /** Ponds for a game saved before them (D-115), away from its buildings, from a generator of its own. */
  private addPonds(): void {
    const hub = this.hub;
    if (!hub) return;
    const c = hub.x + Math.floor(HUB_SIZE / 2);
    const cy = hub.y + Math.floor(HUB_SIZE / 2);
    const site = this.state.shipSite;
    const free = (x: number, y: number) =>
      !this.tiles[this.idx(x, y)] && !moundAt(this, x, y) && !(site && x >= site.x - 1 && y >= site.y - 1 && x <= site.x + 5 && y <= site.y + 5);
    this.addWater(generatePonds(this.state.width, this.state.height, c, cy, seeded(this.state.seed ^ 0x5eed), free));
  }

  /**
   * v32 to v33 (D-120): the steel recipe needs Steelmaking, in the Steam Age. A game already making or
   * holding steel gets it, with Engineering, the age's keystone, so its furnaces carry on.
   */
  private static migrateV32(state: GameState): void {
    const steel = (state.inventory.steel ?? 0) > 0 || state.buildings.some((b) => b.recipe === 'steel');
    if (steel) for (const id of ['engineering', 'steelmaking']) if (!state.researched.includes(id)) state.researched.push(id);
    state.version = 33;
  }

  /**
   * v31 to v32 (D-118): the launch pad goes in as the ship's second stage, after the scaffolding. A ship past
   * the scaffolding counts it as built, with its research, and keeps what it has towards the stage it was on.
   */
  private static migrateV31(state: GameState): void {
    const ship = state.ship;
    if (ship.stage >= 1) {
      ship.stage = Math.min(ship.stage + 1, SHIP.stages.length);
      if (!state.researched.includes('launch_pad')) state.researched.push('launch_pad');
    }
    state.version = 32;
  }

  /**
   * v30 to v31 (D-117): hydraulic defences. Masonry goes: its brick wall comes with Advanced Defense, so a game
   * with Masonry (or Field Repair, which needed it) gets Advanced Defense instead, and with it Hydraulics,
   * which it now needs. Turrets and cannons fire only with power, so a game with any gets stock for enough
   * wells, and rods for shafts to reach them.
   */
  private static migrateV30(state: GameState): void {
    const done = state.researched;
    const grant = (id: string) => done.includes(id) || done.push(id);
    const r = state.research;
    const masonry = done.includes('masonry') || done.includes('repair') || r.active === 'masonry' || !!r.paid.masonry;
    if (masonry) grant('defense');
    if (done.includes('defense')) ['blacksmith', 'hydraulics'].forEach(grant);
    state.researched = done.filter((id) => id !== 'masonry');
    if (r.active === 'masonry') r.active = null;
    const inv = state.inventory;
    const add = (items: ItemCounts) => {
      for (const [k, n] of Object.entries(items)) inv[k as ItemId] = (inv[k as ItemId] ?? 0) + n!;
    };
    if (r.paid.masonry) add(r.paid.masonry); // what was paid towards it comes back
    delete r.paid.masonry;
    const defences = state.buildings.filter((b) => HYDRAULIC.includes(b.type));
    if (defences.length) {
      const need = defences.reduce((sum, b) => sum + POWER.uses[b.type]!, 0);
      const wells = Math.ceil(need / POWER.sources.well!);
      for (let i = 0; i < wells; i++) add(BUILDINGS.well.cost);
      inv.iron_rod = (inv.iron_rod ?? 0) + 10 * wells + 4 * defences.length; // shafts to reach them
    }
    state.version = 31;
  }

  /**
   * v29 to v30 (D-115): ponds, and belts that need power. A game with Logistics gets Hydraulics, which it
   * now needs, and enough stock for wells and shafts to keep its belts at full speed.
   */
  private static migrateV29(state: GameState): void {
    state.water = [];
    if (state.researched.includes('logistics') && !state.researched.includes('hydraulics')) state.researched.push('hydraulics');
    const belts = state.buildings.filter((b) => b.type === 'belt').length;
    if (belts) {
      const wells = Math.ceil((belts * POWER.uses.belt!) / POWER.sources.well!);
      const inv = state.inventory;
      for (const [k, n] of Object.entries(BUILDINGS.well.cost)) inv[k as ItemId] = (inv[k as ItemId] ?? 0) + n! * wells;
      inv.iron_rod = (inv.iron_rod ?? 0) + 10 * wells; // shafts to reach the belts
    }
    state.version = 30;
  }

  /**
   * v28 to v29 (D-114): furnaces and blacksmiths burn fuel. Old ones start with a full store, and a game
   * already making or holding charcoal gets the Charcoal research, which its recipe now needs.
   */
  private static migrateV28(state: GameState): void {
    let charcoal = (state.inventory.charcoal ?? 0) > 0 || (state.inventory.steel ?? 0) > 0;
    for (const b of state.buildings) {
      if (burnsFuel(b.type)) b.ammo = FUEL.max;
      if (b.recipe === 'charcoal' || b.recipe === 'steel') charcoal = true;
    }
    if (charcoal && !state.researched.includes('charcoal')) state.researched.push('charcoal');
    state.version = 29;
  }

  /**
   * v27 to v28 (D-113): furnaces smelt iron ore into ingots, and plates come from the Blacksmith; gears and
   * wire move from the workshop to the Machine Shop, the same size, so a workshop making them becomes one in
   * place. A game already past Industry gets the two shops' researches, so what it built still makes sense.
   */
  private static migrateV27(state: GameState): void {
    let shops = false;
    for (const b of state.buildings) {
      if (b.type === 'furnace' && b.recipe === 'iron_plate') b.recipe = 'iron_ingot';
      if (b.type === 'workshop' && (b.recipe === 'gear' || b.recipe === 'wire')) {
        b.type = 'machine_shop';
        shops = true;
      }
    }
    const done = state.researched;
    const grant = (id: string) => done.includes(id) || done.push(id);
    const past = (ids: string[]) => ids.some((id) => done.includes(id));
    if (shops || past(['assembly', 'repair', 'ordnance'])) ['blacksmith', 'machine_shop'].forEach(grant);
    else if (past(['logistics', 'defense', 'distribution', 'plating'])) grant('blacksmith');
    state.version = 28;
  }

  /** v26 to v27 (D-112): fog of war. What the buildings and engineers can see now counts as explored. */
  private static migrateV26(state: GameState): void {
    state.explored = newFog(state);
    for (const b of state.buildings) revealBuilding(state, b, ...footprint(b.type, b.dir));
    tickFog(state);
    state.version = 27;
  }

  /**
   * v25 to v26 (D-109): the shipyard grows to 5×5 on a site staked out for it, and the ship gains a first
   * stage, the scaffolding. The site goes on the nearest free spot. An old 3×3 shipyard is refunded (it
   * may not fit where it was); a ship already started counts its scaffolding as built and keeps the rest.
   */
  private static migrateV25(state: GameState): void {
    const old = state.buildings.find((b) => b.type === 'shipyard');
    if (old) {
      state.buildings = state.buildings.filter((b) => b !== old);
      for (const [k, n] of Object.entries({ brick: 30, iron_plate: 30, plank: 20 })) state.inventory[k as ItemId] = (state.inventory[k as ItemId] ?? 0) + n;
    }
    const ship = state.ship;
    if (old || ship.stage > 0 || ship.runs > 0 || Object.keys(ship.delivered).length) ship.stage = Math.min(ship.stage + 1, SHIP.stages.length);
    state.shipSite = shipSites(state)[0];
    state.version = 26;
  }

  /**
   * v24 to v25 (D-108): the hub grows from 5×5 to 8×8 about its old centre (a tile more to the left and
   * up, two more to the right and down). Buildings in the way are refunded, trees there cleared, and an
   * engineer standing there steps out below.
   */
  private static migrateV24(state: GameState): void {
    const hub = state.buildings.find((b) => b.id === state.hubId);
    if (hub) {
      hub.x -= 1;
      hub.y -= 1;
      const [hx, hy] = [hub.x, hub.y];
      const overlaps = (b: Building) => {
        const [fw, fh] = footprint(b.type, b.dir);
        return b.x < hx + HUB_SIZE && b.x + fw > hx && b.y < hy + HUB_SIZE && b.y + fh > hy;
      };
      state.buildings = state.buildings.filter((b) => {
        if (b === hub || !overlaps(b)) return true;
        for (const [k, n] of Object.entries(BUILDINGS[b.type].cost)) state.inventory[k as ItemId] = (state.inventory[k as ItemId] ?? 0) + n!;
        return false;
      });
      for (let y = hy; y < hy + HUB_SIZE; y++) {
        for (let x = hx; x < hx + HUB_SIZE; x++) {
          const i = y * state.width + x;
          state.trees[i] = NO_TREE;
          delete state.regrow[i];
        }
      }
      for (const p of state.players) {
        if (p.x >= hx && p.x < hx + HUB_SIZE && p.y >= hy && p.y < hy + HUB_SIZE) [p.x, p.y, p.path] = [hx + HUB_SIZE / 2 + 0.5, hy + HUB_SIZE + 0.5, []];
      }
    }
    state.version = 25;
  }

  /**
   * v23 to v24 (D-107): the Ballistae research went into Basic Defense 2, which also gives the trebuchet,
   * so a game that had Ballistae has Basic Defense 2.
   */
  private static migrateV23(state: GameState): void {
    if (state.researched.includes('ballistae')) {
      state.researched = state.researched.filter((id) => id !== 'ballistae');
      if (!state.researched.includes('defense2')) state.researched.push('defense2');
    }
    if (state.research.active === 'ballistae') state.research.active = null;
    delete state.research.paid.ballistae;
    state.version = 24;
  }

  /**
   * v22 to v23 (D-093): extractors and furnaces moved behind the new Industry research, and Forestry behind
   * nothing. A game saved before that was played with smelting from the start, so it gets Industry, and
   * Forestry with it, as researched.
   */
  private static migrateV22(state: GameState): void {
    for (const id of ['forestry', 'industry']) if (!state.researched.includes(id)) state.researched.push(id);
    if (state.research.active === 'forestry' || state.research.active === 'industry') state.research.active = null;
    state.version = 23;
  }

  /** v21 to v22 (D-091): bugs may carry a `home` flag; none has given up yet, so nothing to change. */
  private static migrateV21(state: GameState): void {
    state.version = 22;
  }

  /** v20 to v21 (#87): what each engineer carried goes into its inventory, which empties at the hub as before. */
  private static migrateV20(state: GameState): void {
    for (const p of state.players) {
      const old = p as Player & { carry?: ItemId[] };
      p.slots = emptySlots();
      p.autoDrop = true;
      for (const item of old.carry ?? []) give(p, item);
      delete old.carry;
    }
    state.version = 21;
  }

  /** v19 to v20 (D-074): engineers get health, at full. */
  private static migrateV19(state: GameState): void {
    for (const p of state.players) p.hp = PLAYER.hp;
    state.version = 20;
  }

  /** v18 to v19 (D-065): nests breed back up to the bugs a nest that far out starts with. */
  private static migrateV18(state: GameState): void {
    const hub = state.buildings.find((b) => b.id === state.hubId);
    const hx = hub ? hub.x + Math.floor(HUB_SIZE / 2) : state.width / 2;
    const hy = hub ? hub.y + Math.floor(HUB_SIZE / 2) : state.height / 2;
    for (const n of state.nests) {
      n.brood = broodFor(hypot(n.x + NESTS.cell / 2 - hx, n.y + NESTS.cell / 2 - hy));
      n.nextBreed = 0;
    }
    state.version = 19;
  }

  /** v17 to v18 (#61): belts get two lanes. Everything already on a belt or in a tunnel is on the right one. */
  private static migrateV17(state: GameState): void {
    for (const b of state.buildings) {
      for (const it of b.belt) it.lane = RIGHT;
      if (b.type === 'splitter') b.outLanes = b.outputs.map(() => RIGHT);
    }
    state.version = 18;
  }

  /** v16 to v17 (#40): each player gets a character, standing just below the hub. */
  private static migrateV16(state: GameState): void {
    const world = new World(state);
    state.players = state.players.map((p) => ({ ...newPlayer(world, p.id), mining: p.mining ?? null }));
    state.version = 17;
  }

  /** v15 to v16 (D-065): every nest gets a mound. One with no bugs left was cleared, so its mound counts as destroyed. */
  private static migrateV15(state: GameState): void {
    const hub = state.buildings.find((b) => b.id === state.hubId);
    const hx = hub ? hub.x + Math.floor(HUB_SIZE / 2) : state.width / 2;
    const hy = hub ? hub.y + Math.floor(HUB_SIZE / 2) : state.height / 2;
    const withBugs = new Set(state.enemies.map((e) => e.nest));
    for (const n of state.nests) {
      const hp = moundHp(hypot(n.x + NESTS.cell / 2 - hx, n.y + NESTS.cell / 2 - hy));
      n.maxHp = hp;
      n.hp = withBugs.has(n.id) ? hp : 0;
      if (!withBugs.has(n.id)) n.destroyed = true;
    }
    state.version = 16;
  }

  /**
   * v14 to v15 (#33, #34): the workshop goes from 3×2 to 2×2, the assembler from 4×2 to 3×3 and the
   * splitter from 1×1 to 1×2. Each moves to the spot overlapping its old one where it fits, keeping its
   * output where it was if it can; one that fits nowhere is removed and refunded, with what it held.
   */
  private static migrateV14(state: GameState): void {
    const old: Partial<Record<BuildingType, [number, number]>> = { workshop: [3, 2], assembler: [4, 2], splitter: [1, 1] };
    const size = (b: Building): [number, number] => {
      const [w, h] = old[b.type] ?? BUILDINGS[b.type].size ?? [1, 1];
      return b.dir % 2 ? [h, w] : [w, h];
    };
    const W = state.width;
    const taken = new Map<number, number>();
    const mark = (b: Building, [w, h]: [number, number], id: number) => {
      for (let y = b.y; y < b.y + h; y++) for (let x = b.x; x < b.x + w; x++) if (id) taken.set(y * W + x, id); else taken.delete(y * W + x);
    };
    for (const b of state.buildings) mark(b, size(b), b.id);
    const fits = (x: number, y: number, w: number, h: number) => {
      for (let ty = y; ty < y + h; ty++)
        for (let tx = x; tx < x + w; tx++) if (tx < 0 || ty < 0 || tx >= W || ty >= state.height || taken.has(ty * W + tx) || state.trees[ty * W + tx] === TREE) return false;
      return true;
    };
    // The tile just past the middle of the front edge, as World.outputTile works it out.
    const outAt = (x: number, y: number, w: number, h: number, dir: Dir) => {
      const fx = dir === 0 ? x + w - 1 : dir === 2 ? x : x + Math.floor((w - 1) / 2);
      const fy = dir === 1 ? y + h - 1 : dir === 3 ? y : y + Math.floor((h - 1) / 2);
      return (fy + DY[dir]) * W + fx + DX[dir];
    };
    const removed = new Set<number>();
    for (const b of state.buildings) {
      if (!old[b.type]) continue;
      const [ow, oh] = size(b);
      mark(b, [ow, oh], 0);
      const [w, h] = footprint(b.type, b.dir);
      const wasOut = outAt(b.x, b.y, ow, oh, b.dir);
      let best: [number, number] | null = null;
      let bestScore = -Infinity;
      for (let y = b.y - h + 1; y < b.y + oh; y++) {
        for (let x = b.x - w + 1; x < b.x + ow; x++) {
          if (!fits(x, y, w, h)) continue;
          const overlap = (Math.min(x + w, b.x + ow) - Math.max(x, b.x)) * (Math.min(y + h, b.y + oh) - Math.max(y, b.y));
          if (overlap <= 0) continue;
          const score = (outAt(x, y, w, h, b.dir) === wasOut ? 1000 : 0) + overlap * 10 - Math.abs(x - b.x) - Math.abs(y - b.y);
          if (score > bestScore) [best, bestScore] = [[x, y], score];
        }
      }
      if (best) {
        [b.x, b.y] = best;
        mark(b, [w, h], b.id);
        continue;
      }
      removed.add(b.id);
      const inv = state.inventory;
      const give = (item: ItemId, n = 1) => (inv[item] = (inv[item] ?? 0) + n);
      for (const [item, n] of Object.entries(BUILDINGS[b.type].cost)) give(item as ItemId, n!);
      for (const [item, n] of Object.entries(b.inputs)) if (n) give(item as ItemId, n);
      for (const item of b.outputs) give(item);
    }
    state.buildings = state.buildings.filter((b) => !removed.has(b.id));
    state.version = 15;
  }

  /**
   * v13 to v14 (#38): belts, splitters and underground belts all come from Logistics, now the first
   * research, and the Underground Belt research is gone. Older games had belts from the start, so they
   * get Logistics as done; anything put into the old research is dropped.
   */
  private static migrateV13(state: GameState): void {
    const rs = state.research;
    state.researched = state.researched.filter((id) => id !== 'underground' && id !== 'logistics');
    state.researched.unshift('logistics');
    delete rs.paid.underground;
    delete rs.paid.logistics;
    if (rs.active === 'underground' || rs.active === 'logistics') {
      rs.active = null;
      rs.budget = 0;
      rs.stalled = false;
    }
    state.version = 14;
  }

  /** v12 to v13: territories spread (#51); the first spread comes a full interval after loading. */
  private static migrateV12(state: GameState): void {
    state.nextSpread = state.time + NESTS.spreadEvery;
    state.version = 13;
  }

  /** v11 to v12: path timers and players move into the save (co-op phase 0). Paths rebuild at once. */
  private static migrateV11(state: GameState): void {
    state.paths = { dirty: true, at: null, shipDirty: true, shipAt: null };
    state.players = [{ id: 0 } as Player]; // its character arrives in v17
    state.version = 12;
  }

  /** v8 to v9: grows forest on the existing map, around the buildings already there. */
  private static migrateV8(state: GameState): void {
    state.trees = new Array(state.width * state.height).fill(NO_TREE);
    state.regrow = {};
    const world = new World(state);
    const hub = world.hub;
    const cx = hub ? hub.x + Math.floor(HUB_SIZE / 2) : state.width / 2;
    const cy = hub ? hub.y + Math.floor(HUB_SIZE / 2) : state.height / 2;
    generateTrees(world, cx, cy);
    state.version = 9;
  }

  /** v9 to v10: the escape ship becomes a supply ship. Escaping counts as the first run delivered. */
  private static migrateV9(state: GameState): void {
    const old = state.ship as ShipState & { escaped?: boolean; endless?: boolean };
    const escaped = !!old.escaped;
    delete old.escaped;
    delete old.endless;
    state.ship = { ...old, runs: escaped ? 1 : 0, returnAt: null, drawn: [], blueprints: [], offer: null };
    if (escaped) {
      state.ship.stage = SHIP.stages.length;
      state.ship.delivered = {};
      state.ship.launchAt = null;
    }
    state.version = 10;
  }

  /** v10 to v11: colony blueprints. Runs already delivered earn one pick from the first two. */
  private static migrateV10(state: GameState): void {
    state.ship.blueprints = [];
    state.ship.offer = state.ship.runs > 0 ? BLUEPRINTS.slice(0, 2).map((b) => b.id) : null;
    state.version = 11;
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

  isWater(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.wet[this.idx(x, y)] === 1;
  }

  /** Removes every pond (test worlds that want plain ground). */
  clearWater(): void {
    this.wet.fill(0);
    this.state.water = [];
  }

  /** Makes water tiles, clearing ore and trees off them (map generation and migration only). */
  private addWater(tiles: number[]): void {
    for (const i of tiles) {
      this.wet[i] = 1;
      this.state.resources[i] = 0;
      this.state.trees[i] = NO_TREE;
      delete this.state.regrow[i];
    }
    this.state.water = [...new Set([...(this.state.water ?? []), ...tiles])].sort((a, b) => a - b);
  }

  /** The tile of a water wheel's footprint that must be in the water: its front (D-095). */
  wheelFront(x: number, y: number, dir: Dir): { x: number; y: number } {
    const [w, h] = footprint('water_wheel', dir);
    return { x: DX[dir] > 0 ? x + w - 1 : x, y: DY[dir] > 0 ? y + h - 1 : y };
  }

  // ------------------------------------------------------------ power (D-115)

  /** The power network a building is on, if it carries power at all. */
  powerNet(b: Building): PowerNet | undefined {
    this.refreshPower();
    return this.nets.get(b.id);
  }

  /**
   * Every belt runs at full speed, as if powered (not saved): for unit tests of other rules, and the main
   * menu's demo, neither of which is a co-op game.
   */
  freePower = false;

  /** How much of what it needs a belt or hydraulic defence gets: 1 is full speed, 0 rolls at roller speed or doesn't fire. */
  powered(b: Building): number {
    if (this.freePower) return 1;
    const n = this.powerNet(b);
    if (!n || n.supply <= 0) return 0;
    return n.demand <= 0 ? 1 : Math.min(1, n.supply / n.demand);
  }

  /** How fast items move on a belt-like building, in tiles a second. Powered belts slow without power (D-115). */
  speedOf(b: Building): number {
    if (b.type === 'belt') return ROLLER.speed + (BELT_SPEED - ROLLER.speed) * this.powered(b);
    return beltSpeed(b.type);
  }

  /**
   * Works out the power networks: every conductor (shafts, sources, belts, splitters, underground belts and
   * hydraulic defences) connects to the conductors it touches, and an underground pair to its other end.
   */
  private refreshPower(): void {
    if (this.netsAt === this.layout) return;
    this.netsAt = this.layout;
    this.nets.clear();
    for (const start of this.state.buildings) {
      if (!CONDUCTS.includes(start.type) || this.nets.has(start.id)) continue;
      const net: PowerNet = { supply: 0, demand: 0 };
      const queue = [start];
      this.nets.set(start.id, net);
      while (queue.length) {
        const b = queue.pop()!;
        net.supply += POWER.sources[b.type] ?? 0;
        net.demand += POWER.uses[b.type] ?? 0;
        const next: Building[] = [];
        const [fw, fh] = this.footprintOf(b);
        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            for (let d = 0; d < 4; d++) {
              const n = this.buildingAt(b.x + dx + DX[d], b.y + dy + DY[d]);
              if (n && n !== b && CONDUCTS.includes(n.type)) next.push(n);
            }
          }
        }
        if (b.type === 'tunnel' && b.link != null) {
          const other = this.byId.get(b.link);
          if (other) next.push(other);
        }
        for (const n of next) {
          if (this.nets.has(n.id)) continue;
          this.nets.set(n.id, net);
          queue.push(n);
        }
      }
    }
  }

  treeAt(x: number, y: number): number {
    return this.inBounds(x, y) ? this.state.trees[this.idx(x, y)] : NO_TREE;
  }

  /**
   * Tiles with a tree, and the number of stumps, that a Lumber Camp with its
   * top-left at (x, y) would reach: within LUMBER.range of its centre, outside its own footprint.
   */
  treesInReach(x: number, y: number, w = 2, h = 2): { trees: number[]; stumps: number } {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = LUMBER.range;
    const trees: number[] = [];
    let stumps = 0;
    for (let ty = Math.floor(cy - r); ty <= Math.ceil(cy + r); ty++) {
      for (let tx = Math.floor(cx - r); tx <= Math.ceil(cx + r); tx++) {
        if (!this.inBounds(tx, ty) || hypot(tx + 0.5 - cx, ty + 0.5 - cy) > r) continue;
        if (tx >= x && tx < x + w && ty >= y && ty < y + h) continue;
        const t = this.state.trees[this.idx(tx, ty)];
        if (t === TREE) trees.push(this.idx(tx, ty));
        else if (t === STUMP) stumps++;
      }
    }
    return { trees, stumps };
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
    const p = this.state.paths;
    p.dirty = p.shipDirty = true;
    p.at = p.shipAt = null;
  }

  /**
   * Rebuilds both attack-path fields from the world as it is, leaving the saved timers alone.
   * The fields aren't saved, so a loaded game needs them before its first tick.
   */
  /** What angry bugs go for: every building but spike pits, traps on the way that they walk over (D-107). */
  private bugTargets(): Building[] {
    return this.state.buildings.filter((b) => b.type !== 'spike_pit');
  }

  rebuildPaths(): void {
    this.fillFlow(this.flow, this.bugTargets(), FLOW_RANGE);
    this.fillFlow(this.shipFlow, this.shipTargets(), this.shipRange());
  }

  /**
   * A point every co-op game reaches on the same tick before a snapshot is taken: the path fields are
   * rebuilt and marked fresh, so a game loading that snapshot (which rebuilds them too) has the same ones.
   */
  checkpoint(): void {
    this.rebuildPaths();
    const p = this.state.paths;
    p.dirty = p.shipDirty = false;
    p.at = p.shipAt = this.state.time;
  }

  /** Adds a calm bug at a random spot in its nest's territory: an adult, or `young`, just hatched (D-065). */
  spawnBug(type: EnemyType, nest: Nest, hpMult: number, young = false): Enemy {
    const c = NESTS.cell;
    const x = nest.x + 0.5 + this.random() * (c - 1);
    const y = nest.y + 0.5 + this.random() * (c - 1);
    const hp = Math.round(ENEMIES[type].hp * hpMult);
    const e: Enemy = { id: this.state.nextId++, type, x, y, hp, maxHp: hp, nest: nest.id, tx: x, ty: y, wait: this.random() * NESTS.pause[1] };
    if (young) {
      e.hp = hp * NESTS.young;
      e.born = this.state.time;
    }
    this.state.enemies.push(e);
    return e;
  }

  /** A building's full health: its base health, more with Chitin Plating for turrets and walls (D-065). */
  maxHpFor(type: BuildingType): number {
    const hp = BUILDINGS[type].hp;
    return PLATING.types.includes(type) && this.state.researched.includes('plating') ? Math.round(hp * PLATING.bonus) : hp;
  }

  maxHp(b: Building): number {
    return this.maxHpFor(b.type);
  }

  get hub(): Building | undefined {
    return this.byId.get(this.state.hubId);
  }

  isUnlocked(type: BuildingType): boolean {
    if (STARTING_BUILDINGS.includes(type)) return true;
    if (this.state.ship.blueprints.some((id) => BLUEPRINT_BY_ID[id]?.unlocks.includes(type))) return true;
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
    const before = r.effect === 'plating' ? new Map(this.state.buildings.map((b) => [b.id, this.maxHp(b)])) : null;
    this.state.researched.push(id);
    // Plating adds its extra health to what's already built, too.
    if (before) for (const b of this.state.buildings) b.hp += this.maxHp(b) - before.get(b.id)!;
    this.events.push(r.unlocks.length ? `Researched ${r.name}: ${r.unlocks.map((t) => BUILDINGS[t].name).join(', ')} unlocked` : `Researched ${r.name}`);
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

  /** `changed`: false while building the index from a save, whose path timers already say what's due. */
  private index(b: Building, changed = true): void {
    this.byId.set(b.id, b);
    const [w, h] = this.footprintOf(b);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.tiles[this.idx(b.x + dx, b.y + dy)] = b.id;
    if (changed) this.state.paths.dirty = this.state.paths.shipDirty = true;
    this.layout++;
    this.watchedSince.set(b.id, this.state.time);
  }

  private unindex(b: Building): void {
    this.byId.delete(b.id);
    const [w, h] = this.footprintOf(b);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.tiles[this.idx(b.x + dx, b.y + dy)] = 0;
    this.state.paths.dirty = this.state.paths.shipDirty = true;
    this.layout++;
    this.made.delete(b.id);
    this.watchedSince.delete(b.id);
  }

  private addBuilding(type: BuildingType, x: number, y: number, dir: Dir): Building {
    const b: Building = {
      id: this.state.nextId++,
      type,
      x,
      y,
      dir,
      hp: this.maxHpFor(type),
      belt: [],
      recipe: null,
      inputs: {},
      outputs: [],
      progress: -1,
      // Turrets, repair stations and fuel burners arrive stocked.
      ammo: TURRETS[type]?.maxShots ?? (type === 'repair' ? REPAIR.maxCharge / 2 : type === 'spike_pit' ? SPIKES.maxCharge : burnsFuel(type) ? FUEL.max : 0),
      cooldown: 0,
      link: null,
      rr: 0,
      filter: null,
    };
    this.state.buildings.push(b);
    this.index(b);
    revealBuilding(this.state, b, ...footprint(type, dir));
    return b;
  }

  // ------------------------------------------------------- player actions

  /**
   * The belt at tile (x, y), if a `type` building placed there would replace
   * it. Any building except another belt can be dropped onto a belt line: it
   * takes over the belts under it and faces the way they ran (D-037).
   */
  beltToReplace(type: BuildingType, x: number, y: number): Building | undefined {
    if (isBelt(type)) return undefined;
    const b = this.buildingAt(x, y);
    return b && isBelt(b.type) ? b : undefined;
  }

  /**
   * The ordinary belts in the line through `start`: every belt joined to it
   * belt-to-belt, in both directions (side merges included), up to any other
   * building. Nearest first.
   */
  beltLine(start: Building): Building[] {
    if (start.type !== 'belt') return [];
    const seen = new Set([start.id]);
    const line = [start];
    for (let i = 0; i < line.length; i++) {
      const b = line[i];
      const next: (Building | undefined)[] = [];
      // Downstream: the belt this one feeds, unless it points straight back.
      const front = this.buildingAt(b.x + DX[b.dir], b.y + DY[b.dir]);
      if (front && !(front.x + DX[front.dir] === b.x && front.y + DY[front.dir] === b.y)) next.push(front);
      // Upstream: belts pointing into this one from its back or sides.
      for (let d = 0; d < 4; d++) {
        if (d === b.dir) continue;
        const n = this.buildingAt(b.x + DX[d], b.y + DY[d]);
        if (n && n.x + DX[n.dir] === b.x && n.y + DY[n.dir] === b.y) next.push(n);
      }
      for (const n of next) {
        if (n && n.type === 'belt' && !seen.has(n.id)) {
          seen.add(n.id);
          line.push(n);
        }
      }
    }
    return line;
  }

  /**
   * Upgrades the whole belt line through (x, y) to express belts in place,
   * keeping each belt's facing and items and refunding the old belts. With
   * too little stock it upgrades as many as it can, nearest the tap first.
   */
  upgradeBeltLine(x: number, y: number): { upgraded: number; left: number } | PlaceError {
    const start = this.buildingAt(x, y);
    if (start?.type !== 'belt') return 'occupied';
    if (!this.isUnlocked('express_belt')) return 'locked';
    const line = this.beltLine(start);
    const refund = BUILDINGS.belt.cost;
    const cost = BUILDINGS.express_belt.cost;
    let upgraded = 0;
    for (const b of line) {
      this.refund(refund);
      if (!this.canAfford(cost)) {
        this.pay(refund);
        break;
      }
      this.pay(cost);
      b.hp = (b.hp / BUILDINGS.belt.hp) * BUILDINGS.express_belt.hp;
      b.type = 'express_belt';
      upgraded++;
    }
    if (!upgraded) return 'cost';
    const left = line.length - upgraded;
    this.events.push(
      left
        ? `Upgraded ${upgraded} belt${upgraded === 1 ? '' : 's'}. Not enough stock for the other ${left}.`
        : `Upgraded ${upgraded} belt${upgraded === 1 ? '' : 's'} to express.`,
    );
    return { upgraded, left };
  }

  private refund(cost: ItemCounts): void {
    const inv = this.state.inventory;
    for (const [item, n] of Object.entries(cost)) inv[item as ItemId] = (inv[item as ItemId] ?? 0) + n!;
  }

  /**
   * Whether a building can go with its top-left at (x, y), facing `dir`.
   * `replaceBelt`: allow building over a belt (single placements, not drags across a line).
   */
  /** Whether `type` can go at (x, y) facing `dir`. Moving (#76, #83): `moving` itself is no obstacle, and it's free. */
  checkPlace(type: BuildingType, x: number, y: number, dir: Dir = 0, replaceBelt = false, moving?: Building): PlaceError | null {
    const [w, h] = footprint(type, dir);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.inBounds(x + dx, y + dy)) return 'bounds';
        const b = this.buildingAt(x + dx, y + dy);
        if (b && b !== moving && !(replaceBelt && this.beltToReplace(type, x + dx, y + dy))) return 'occupied';
        if (this.treeAt(x + dx, y + dy) === TREE) return 'tree';
        if (moundAt(this, x + dx, y + dy)) return 'nest';
        if (type !== 'water_wheel' && this.isWater(x + dx, y + dy)) return 'water';
      }
    }
    if (type === 'water_wheel') {
      // Its front tile in a pond, the other two on land (D-095).
      const f = this.wheelFront(x, y, dir);
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const front = x + dx === f.x && y + dy === f.y;
          if (front !== this.isWater(x + dx, y + dy)) return front ? 'needs-water' : 'water';
        }
      }
    }
    if (type === 'shipyard' && shipyard(this)) return 'unique';
    const site = this.state.shipSite;
    if (type === 'shipyard' && site && (x !== site.x || y !== site.y)) return 'site'; // only on its stakes (D-109)
    if (!this.isUnlocked(type)) return 'locked';
    if (type === 'extractor' && !this.oreUnder(x, y, w, h)) return 'needs-resource';
    if (type === 'lumber_camp') {
      const reach = this.treesInReach(x, y, w, h);
      if (!reach.trees.length && !reach.stumps) return 'needs-trees';
    }
    if (type === 'port' && this.awayFromHub(x, y) == null) return 'needs-hub';
    if (!moving && !this.canAfford(BUILDINGS[type].cost)) return 'cost';
    return null;
  }

  /** Whether a building can be moved at all (#76, #83): not the hub, the shipyard (it has its site) or a paired tunnel. */
  canMove(b: Building): boolean {
    return b.type !== 'hub' && b.type !== 'shipyard' && b.type !== 'tunnel';
  }

  /**
   * Moves a building to (x, y), facing `dir` (#76, #83). It keeps everything it holds and costs nothing.
   * It can go anywhere a new one could, its old tiles included.
   */
  relocate(id: number, x: number, y: number, dir: Dir): Building | PlaceError {
    const b = this.byId.get(id);
    if (!b) return 'occupied';
    if (!this.canMove(b)) return 'unmovable';
    const err = this.checkPlace(b.type, x, y, dir, false, b);
    if (err) return err;
    this.unindex(b);
    [b.x, b.y, b.dir] = [x, y, dir];
    if (b.type === 'extractor') b.recipe = this.oreUnder(x, y, ...footprint(b.type, dir));
    this.index(b);
    revealBuilding(this.state, b, ...footprint(b.type, dir));
    return b;
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
    // Building over stumps clears them for good.
    const [fw, fh] = footprint(type, dir);
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        const i = this.idx(x + dx, y + dy);
        this.state.trees[i] = NO_TREE;
        delete this.state.regrow[i];
      }
    }
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
    const frac = b.hp / this.maxHp(b);
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
    if (destroyed) {
      const [cx, cy] = this.centreOf(b);
      const [fw, fh] = this.footprintOf(b);
      this.lost.push({ id: b.id, age: 0, x: cx, y: cy, size: Math.max(fw, fh) });
    }
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
    if (recipeId != null && !this.recipesFor(b.type).some((r) => r.id === recipeId)) return; // another machine's, or not researched
    b.recipe = recipeId;
    b.inputs = {};
    b.progress = -1;
  }

  /** A hub port's item, or the item a splitter sorts to one side (#62). */
  setFilter(id: number, item: ItemId | null): void {
    const b = this.byId.get(id);
    if (b?.type === 'port' || b?.type === 'splitter') b.filter = item;
  }

  /** Which side of a splitter its filtered item goes out of (#62). */
  setSplitterSide(id: number, side: 'left' | 'right'): void {
    const b = this.byId.get(id);
    if (b?.type === 'splitter') b.side = side;
  }

  /** Recipes a machine can use: its own, once any research they need is done (D-105). */
  recipesFor(type: BuildingType) {
    return RECIPES.filter((r) => r.machine === type && (!r.requires || this.state.researched.includes(r.requires)));
  }

  // ------------------------------------------------------------ item flow

  /**
   * Tries to hand an item to a building. `fromX/fromY` is the source tile. `lane` is the lane it was on
   * when it comes off a belt (or out of a splitter or tunnel); buildings put items onto a belt's right
   * lane (#61).
   */
  insert(target: Building, item: ItemId, fromX: number, fromY: number, lane?: Lane): boolean {
    switch (target.type) {
      case 'belt':
      case 'express_belt':
      case 'roller': {
        // Don't accept items from the tile this belt feeds into.
        if (target.x + DX[target.dir] === fromX && target.y + DY[target.dir] === fromY) return false;
        const to = this.laneFrom(target, fromX, fromY, lane);
        if (!this.roomOn(target.belt, to, BELT_SPACING)) return false;
        target.belt.push({ item, pos: 0, lane: to });
        return true;
      }
      case 'shipyard':
        return insertShip(this, item);
      case 'crate': {
        // Up to CRATE_SIZE of one kind, from anywhere but the tile in front, where it sends them (D-106).
        if (target.x + DX[target.dir] === fromX && target.y + DY[target.dir] === fromY) return false;
        if (target.outputs.length >= CRATE_SIZE || (target.outputs.length && target.outputs[0] !== item)) return false;
        target.outputs.push(item);
        return true;
      }
      case 'storage': {
        // Six stacks of 50, mixed, from anywhere but the tiles in front, where it sends them (D-116).
        if (this.inFront(target, fromX, fromY) || !storageRoom(target.outputs, item)) return false;
        target.outputs.push(item);
        return true;
      }
      case 'splitter': {
        // Only from directly behind one of its two lanes.
        const k = this.splitterLanes(target).findIndex((l) => l.x - DX[target.dir] === fromX && l.y - DY[target.dir] === fromY);
        if (k < 0) return false;
        if (target.outputs.length) return false;
        target.outputs.push(item);
        target.outLanes = [lane ?? RIGHT];
        target.inFrom = k;
        (target.fed ??= [null, null])[k] = { item, at: this.state.time };
        return true;
      }
      case 'tunnel': {
        if (this.isTunnelExit(target)) return false;
        if (target.x + DX[target.dir] === fromX && target.y + DY[target.dir] === fromY) return false;
        const to = this.laneFrom(target, fromX, fromY, lane);
        if (!this.roomOn(target.belt, to, BELT_SPACING / this.tunnelLength(target))) return false;
        target.belt.push({ item, pos: 0, lane: to });
        return true;
      }
      case 'repair': {
        const hp = item === 'iron_plate' ? REPAIR.hpPerPlate : item === 'plank' ? REPAIR.hpPerPlank : 0;
        if (!hp || target.ammo + hp > REPAIR.maxCharge) return false;
        target.ammo += hp;
        return true;
      }
      case 'hub':
        this.deliver(item);
        return true;
      case 'furnace':
      case 'workshop':
      case 'assembler':
      case 'sawmill':
      case 'blacksmith':
      case 'machine_shop':
      case 'steel_works': {
        // Fuel goes into the fuel store, unless the recipe uses it and still has room for it (D-114).
        const burn = burnsFuel(target.type) ? FUEL.burns[item] : undefined;
        if (burn) {
          const need = target.recipe ? RECIPE_BY_ID[target.recipe].inputs[item] : undefined;
          if (!need || (target.inputs[item] ?? 0) >= need * 3) {
            if (target.ammo + burn > FUEL.max) return false;
            target.ammo += burn;
            return true;
          }
        }
        if (!target.recipe) {
          const r = this.recipesFor(target.type).find((r) => r.inputs[item]);
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
      case 'spike_pit': {
        if (item !== 'stake' || target.ammo + SPIKES.perStake > SPIKES.maxCharge) return false;
        target.ammo += SPIKES.perStake;
        return true;
      }
      case 'turret':
      case 'ballista':
      case 'cannon':
      case 'tesla':
      case 'trebuchet': {
        const def = TURRETS[target.type]!;
        if (item !== def.ammoItem || target.ammo + def.shotsPerItem > def.maxShots) return false;
        target.ammo += def.shotsPerItem;
        return true;
      }
      default:
        return false;
    }
  }

  /**
   * One tap of mining by hand (#38). HAND_MINING.taps taps in a row on the same ore tile loosen one
   * of its ore, which the character carries (#40); tapping another tile, or pausing too long, starts
   * the count over. Out of reach, the character walks over first and mines on arriving. A tree is
   * chopped the same way (D-093): the last tap fells it for LUMBER.logsPerTree logs, leaving a stump.
   */
  mineByHand(x: number, y: number, player = 0): HandTap | MineError {
    const tree = this.treeAt(x, y) === TREE;
    const ore = tree ? 'log' : this.resourceAt(x, y);
    if (!ore) return 'no-ore';
    if (this.buildingAt(x, y)) return 'occupied';
    const p = playerOf(this, player);
    if (isDown(p)) return 'down';
    if (!inReach(p.x, p.y, x, y)) {
      goAndDo(this, p, x, y, 1, 1, { kind: 'mine', x, y });
      return 'far';
    }
    const yields = tree ? LUMBER.logsPerTree : 1;
    if (roomFor(p, ore) < yields) return 'full';
    const tile = this.idx(x, y);
    const t = this.state.time;
    const m = p.mining && p.mining.tile === tile && t - p.mining.at <= HAND_MINING.resetAfter ? p.mining : { tile, taps: 0, at: t };
    m.taps++;
    m.at = t;
    let item: ItemId | null = null;
    if (m.taps >= HAND_MINING.taps) {
      m.taps = 0;
      item = ore;
      for (let k = 0; k < yields; k++) give(p, ore);
      if (tree) this.fell(tile);
      else this.takeOre(tile);
    }
    p.mining = m;
    const tap: HandTap = { x, y, ore, item, age: 0 };
    this.taps.push(tap);
    return tap;
  }

  /** Taps so far on the tile a player is mining by hand, or 0 once the count has run out. */
  handMiningAt(x: number, y: number, player = 0): number {
    const m = this.state.players.find((q) => q.id === player)?.mining;
    if (!m || m.tile !== this.idx(x, y) || this.state.time - m.at > HAND_MINING.resetAfter) return 0;
    return m.taps;
  }

  /**
   * The character picks up a building's finished items (#38, #40): before belts, this is how the
   * first plates get from a furnace to the hub. Out of reach, it walks over first. Items that don't fit in
   * the inventory stay. Returns how many were picked up now.
   */
  collect(id: number, player = 0): number {
    const b = this.byId.get(id);
    if (!b || !canCollect(b.type)) return 0;
    const p = playerOf(this, player);
    if (isDown(p)) return 0;
    if (!reaches(this, p, b)) {
      const [fw, fh] = this.footprintOf(b);
      goAndDo(this, p, b.x, b.y, fw, fh, { kind: 'collect', id });
      return 0;
    }
    const before = b.outputs.length;
    b.outputs = b.outputs.filter((item) => !give(p, item));
    return before - b.outputs.length;
  }

  /**
   * The character takes the items off a belt, splitter or underground belt (#87), as many as fit in its
   * inventory, front first. Out of reach, it walks over first. Returns how many were picked up now.
   */
  pickUp(id: number, player = 0): number {
    const b = this.byId.get(id);
    if (!b || !(isBelt(b.type) || b.type === 'splitter' || b.type === 'tunnel')) return 0;
    const p = playerOf(this, player);
    if (isDown(p)) return 0;
    if (!reaches(this, p, b)) {
      const [fw, fh] = this.footprintOf(b);
      goAndDo(this, p, b.x, b.y, fw, fh, { kind: 'pickup', id });
      return 0;
    }
    let n = 0;
    b.belt = b.belt.filter((it) => !(give(p, it.item) && ++n));
    if (b.outputs.length) {
      const lanes = b.outLanes;
      const kept: ItemId[] = [];
      const keptLanes: Lane[] = [];
      b.outputs.forEach((item, i) => {
        if (give(p, item)) n++;
        else {
          kept.push(item);
          if (lanes) keptLanes.push(lanes[i]);
        }
      });
      b.outputs = kept;
      if (lanes) b.outLanes = keptLanes;
    }
    return n;
  }

  /** Whether walking up to the hub empties a player's inventory into it (#87). */
  setAutoDrop(on: boolean, player = 0): boolean {
    playerOf(this, player).autoDrop = on;
    return true;
  }

  /**
   * The character hands a building whatever it will take of what it carries (#40). Out of reach, it
   * walks over first. Returns how many items went in now.
   */
  dropOff(id: number, player = 0): number {
    const b = this.byId.get(id);
    if (!b) return 0;
    const p = playerOf(this, player);
    if (isDown(p)) return 0;
    if (!reaches(this, p, b)) {
      const [fw, fh] = this.footprintOf(b);
      goAndDo(this, p, b.x, b.y, fw, fh, { kind: 'drop', id });
      return 0;
    }
    const fx = Math.floor(p.x);
    const fy = Math.floor(p.y);
    return handOver(p, (item) => this.insert(b, item, fx, fy));
  }

  /** An engineer for a co-op player (D-076), standing below the hub. False if they already have one. */
  addPlayer(id: number): boolean {
    if (this.state.players.some((p) => p.id === id)) return false;
    this.state.players.push(newPlayer(this, id));
    this.state.players.sort((a, b) => a.id - b.id);
    return true;
  }

  /** A co-op player left: their engineer goes back to the hub at once, handing in what it carried (D-079). */
  sendHome(id: number): boolean {
    const p = this.state.players.find((q) => q.id === id);
    if (!p) return false;
    sendHome(this, p);
    return true;
  }

  /** The character walks to tile (x, y) (#40). */
  moveTo(x: number, y: number, player = 0): boolean {
    return moveTo(this, playerOf(this, player), x, y);
  }

  /** Keyboard walking: hold a direction, or [0, 0] to stop (#40). */
  walk(dx: number, dy: number, player = 0): void {
    walk(playerOf(this, player), dx, dy);
  }

  /** A message when night falls, at dawn and when a season begins (#42). */
  private announceClock(before: number, now: number): void {
    const a = clockAt(before);
    const b = clockAt(now);
    if (a.season !== b.season) this.events.push(`${b.season.name} has come.${b.season.regrow > 1 ? ' Trees grow back faster.' : ' Trees grow back slower.'}`);
    else if (!a.night && b.night) this.events.push('Night falls. Bugs range further in the dark.');
    else if (a.night && !b.night) this.events.push(`Morning: day ${b.day}.`);
  }

  /** What a character does on arriving where it was sent. */
  private act(p: Player, a: PlayerAction): void {
    if (a.kind === 'mine') this.mineByHand(a.x, a.y, p.id);
    else if (a.kind === 'collect') this.collect(a.id, p.id);
    else if (a.kind === 'pickup') this.pickUp(a.id, p.id);
    else this.dropOff(a.id, p.id);
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

  /** Whether tile (x, y) lies just past the edge `b` faces. */
  private inFront(b: Building, x: number, y: number): boolean {
    const [w, h] = this.footprintOf(b);
    const inside = (tx: number, ty: number) => tx >= b.x && ty >= b.y && tx < b.x + w && ty < b.y + h;
    return !inside(x, y) && inside(x - DX[b.dir], y - DY[b.dir]);
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
    if (s.gameOver) return;
    s.time += dt;
    this.movedThisTick.clear();

    for (const b of s.buildings) {
      switch (b.type) {
        case 'belt':
        case 'express_belt':
        case 'roller':
          this.tickBelt(b, dt);
          break;
        case 'crate':
        case 'storage':
          this.pushOutput(b); // a belt or roller leaving its front takes items out
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
        case 'lumber_camp':
          this.tickLumberCamp(b, dt);
          break;
        case 'furnace':
        case 'workshop':
        case 'assembler':
        case 'sawmill':
        case 'blacksmith':
        case 'machine_shop':
        case 'steel_works':
          this.tickMachine(b, dt);
          break;
        case 'hub':
        case 'turret':
        case 'ballista':
        case 'cannon':
        case 'tesla':
        case 'trebuchet':
          this.tickTurret(b, dt);
          break;
        case 'spike_pit':
          this.tickSpikes(b, dt);
          break;
      }
    }

    this.tickResearch(dt);
    this.tickRegrowth();
    tickShip(this);
    // Attack paths matter only while a nest is angry; buildings change often, so refresh them at most twice a second.
    const p = s.paths;
    if (p.dirty && (p.at == null || s.time - p.at >= FLOW_REFRESH) && anyAngry(this)) this.computeFlow();
    if (s.ship.launchAt != null && p.shipDirty && (p.shipAt == null || s.time - p.shipAt >= FLOW_REFRESH)) this.computeShipFlow();
    tickBugs(this, dt);
    tickSpread(this);
    tickBreeding(this, dt);
    tickPlayers(this, dt, (p, a) => this.act(p, a));
    tickFog(s);
    this.announceClock(s.time - dt, s.time);
    announceThreat(this, s.time - dt, s.time);
    startRaids(this, s.time - dt, s.time);
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
    for (const l of this.lost) l.age += dt;
    this.lost = this.lost.filter((l) => l.age < 2);
    for (const h of this.healed) h.age += dt;
    this.healed = this.healed.filter((h) => h.age < 1);
    for (const f of this.felled) f.age += dt;
    this.felled = this.felled.filter((f) => f.age < 2);
    for (const tap of this.taps) tap.age += dt;
    this.taps = this.taps.filter((tap) => tap.age < 1);
  }

  /** Stumps whose time has come grow back into trees. */
  private tickRegrowth(): void {
    const s = this.state;
    for (const k in s.regrow) {
      const i = Number(k);
      if (s.regrow[i] > s.time) continue;
      delete s.regrow[i];
      if (s.trees[i] === STUMP) s.trees[i] = TREE;
      this.layout++;
    }
  }

  /**
   * A tree comes down, by a lumber camp or by hand: a stump that grows back in time, LUMBER.regrowths
   * times; after that the ground stays clear (D-094).
   */
  private fell(i: number): void {
    const s = this.state;
    const cuts = (s.cuts ??= {});
    this.layout++;
    this.felled.push({ x: i % s.width, y: Math.floor(i / s.width), age: 0 });
    cuts[i] = (cuts[i] ?? 0) + 1;
    if (cuts[i] > LUMBER.regrowths) {
      s.trees[i] = NO_TREE;
      delete cuts[i];
      return;
    }
    s.trees[i] = STUMP;
    // Seasons change how fast stumps grow back (#42): the season when it's cut sets its time.
    s.regrow[i] = s.time + (LUMBER.regrow + (this.random() * 2 - 1) * LUMBER.regrowSpread) / clockAt(s.time).season.regrow;
  }

  /** One ore taken from an ore tile (D-096): used up, the tile is bare ground. */
  private takeOre(i: number): void {
    const s = this.state;
    const mined = (s.oreMined ??= {});
    mined[i] = (mined[i] ?? 0) + 1;
    if (mined[i] < ORE.perTile) return;
    delete mined[i];
    s.resources[i] = 0;
    this.layout++;
  }

  /** Ore left in one tile (D-096). */
  oreLeft(x: number, y: number): number {
    const i = this.idx(x, y);
    return this.state.resources[i] ? ORE.perTile - (this.state.oreMined?.[i] ?? 0) : 0;
  }

  /** Cuts the nearest tree in reach into logs, one tree every LUMBER.period seconds. */
  private tickLumberCamp(b: Building, dt: number): void {
    const s = this.state;
    if (b.outputs.length + LUMBER.logsPerTree <= OUTPUT_BUFFER) {
      const [w, h] = this.footprintOf(b);
      const { trees } = this.treesInReach(b.x, b.y, w, h);
      if (!trees.length) {
        b.progress = -1; // nothing to cut until a stump grows back
      } else {
        b.progress = Math.max(b.progress, 0) + dt;
        if (b.progress >= LUMBER.period) {
          b.progress = 0;
          const [cx, cy] = this.centreOf(b);
          let pick = trees[0];
          let best = Infinity;
          for (const i of trees) {
            const d = hypot((i % s.width) + 0.5 - cx, Math.floor(i / s.width) + 0.5 - cy);
            if (d < best) [pick, best] = [i, d];
          }
          this.fell(pick);
          for (let k = 0; k < LUMBER.logsPerTree; k++) b.outputs.push('log');
          this.noteMade(b, LUMBER.logsPerTree);
        }
      }
    }
    this.pushOutput(b);
  }

  /** Moves items along a belt (or tunnel) of `length` tiles, keeping them spaced. */
  /**
   * Moves items along a belt (or tunnel) of `length` tiles, keeping them spaced. Returns how far (in
   * tiles) the front item would have gone past the end, so it can carry on onto the next belt.
   */
  private advanceItems(items: BeltItem[], dt: number, length: number, speed = BELT_SPEED): [number, number] {
    // Each lane keeps its own spacing; items are in front-first order within each lane.
    const spacing = BELT_SPACING / length;
    const over: [number, number] = [0, 0];
    const ahead: [number | null, number | null] = [null, null];
    for (const it of items) {
      const prev = ahead[it.lane];
      if (!this.movedThisTick.has(it)) {
        const want = it.pos + (speed * dt) / length;
        const limit = prev == null ? 1 : prev - spacing;
        if (prev == null && want > 1) over[it.lane] = (want - 1) * length;
        it.pos = Math.max(it.pos, Math.min(want, limit));
      }
      ahead[it.lane] = it.pos;
    }
    return over;
  }

  /** Whether a lane has room for a new item at its entry edge. */
  private roomOn(items: BeltItem[], lane: Lane, spacing: number): boolean {
    for (let i = items.length - 1; i >= 0; i--) if (items[i].lane === lane) return items[i].pos >= spacing;
    return true;
  }

  /**
   * The lane an item lands on when it enters a belt from (fromX, fromY) (#61). Coming from behind, or
   * round a corner, it keeps its lane; fed in from the side by another belt, it takes the near lane.
   * Anything else (a building's output, `lane` not given) goes onto the right lane.
   */
  private laneFrom(target: Building, fromX: number, fromY: number, lane?: Lane): Lane {
    if (lane == null || target.type === 'roller') return RIGHT; // rollers have one lane (D-106)
    const d = target.dir;
    if (fromX === target.x - DX[d] && fromY === target.y - DY[d]) return lane;
    const left = ((d + 3) % 4) as Dir;
    const fromLeft = fromX === target.x + DX[left] && fromY === target.y + DY[left];
    // A corner: nothing feeds it from behind or from the other side, so the line just turns.
    const other = fromLeft ? (((d + 1) % 4) as Dir) : left;
    if (!this.feedsInto(target.x - DX[d], target.y - DY[d], target) && !this.feedsInto(target.x + DX[other], target.y + DY[other], target)) return lane;
    return fromLeft ? LEFT : RIGHT;
  }

  /** Whether the building on tile (x, y) sends items onto `target`'s tile. */
  private feedsInto(x: number, y: number, target: Building): boolean {
    const n = this.buildingAt(x, y);
    if (!n || n === target) return false;
    if (isBelt(n.type) || n.type === 'tunnel') return x + DX[n.dir] === target.x && y + DY[n.dir] === target.y;
    if (n.type === 'splitter') return this.splitterLanes(n).some((l) => l.outX === target.x && l.outY === target.y);
    if (!isMachine(n.type) && n.type !== 'extractor' && n.type !== 'lumber_camp' && n.type !== 'port' && n.type !== 'crate' && n.type !== 'storage') return false;
    const o = this.outputTile(n);
    return o.x === target.x && o.y === target.y;
  }

  /** Belts, and tunnel exits (which run like one belt tile once items come up). */
  private tickBelt(b: Building, dt: number): void {
    const items = b.belt;
    // A roller rolls items slowly on its own, and at belt speed while it's packed: pushed (D-106).
    const speed = b.type === 'tunnel' ? BELT_SPEED : b.type === 'roller' && items.length >= ROLLER.packed ? BELT_SPEED : this.speedOf(b);
    const over = this.advanceItems(items, dt, 1, speed);
    for (const lane of [LEFT, RIGHT]) {
      const i = items.findIndex((it) => it.lane === lane);
      const front = items[i];
      if (!front || front.pos < 1) continue;
      const target = this.buildingAt(b.x + DX[b.dir], b.y + DY[b.dir]);
      if (!target) continue;
      const moved = isBelt(target.type) ? this.passAlong(target, front, over[lane], b.x, b.y) : this.insert(target, front.item, b.x, b.y, front.lane);
      if (moved) items.splice(i, 1);
    }
  }

  /**
   * Hands an item from the end of one belt onto the next, keeping the distance it still had to go this
   * tick, so items flow across tile edges without pausing or jumping (#49). It counts as moved this tick.
   */
  private passAlong(target: Building, it: BeltItem, over: number, fromX: number, fromY: number): boolean {
    // Don't accept items from the tile this belt feeds into.
    if (target.x + DX[target.dir] === fromX && target.y + DY[target.dir] === fromY) return false;
    const lane = this.laneFrom(target, fromX, fromY, it.lane);
    if (!this.roomOn(target.belt, lane, BELT_SPACING)) return false;
    let last: BeltItem | undefined;
    for (let i = target.belt.length - 1; i >= 0 && !last; i--) if (target.belt[i].lane === lane) last = target.belt[i];
    it.pos = Math.min(over, last ? last.pos - BELT_SPACING : 1);
    it.lane = lane;
    target.belt.push(it);
    this.movedThisTick.add(it);
    return true;
  }

  /** A splitter's two lanes (#34): its tiles, each with the tile in front that it sends items to. */
  splitterLanes(b: Building): { x: number; y: number; outX: number; outY: number }[] {
    const across = b.dir % 2 ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
    return [0, 1].map((i) => {
      const x = b.x + across.dx * i;
      const y = b.y + across.dy * i;
      return { x, y, outX: x + DX[b.dir], outY: y + DY[b.dir] };
    });
  }

  /** Whether a splitter is being fed two different kinds of item, one on each lane (#92). */
  private sortsKinds(b: Building): boolean {
    const [a, c] = b.fed ?? [];
    const recent = (f: { at: number } | null | undefined) => !!f && this.state.time - f.at <= SPLITTER_SORT_WINDOW;
    return recent(a) && recent(c) && a!.item !== c!.item;
  }

  /** Which of a splitter's two lanes (see splitterLanes) is on its left, looking the way it faces. */
  splitterLeft(b: Building): 0 | 1 {
    const left = (b.dir + 3) % 4;
    const across = b.dir % 2 ? 0 : 1; // the direction from lane 0 to lane 1: east (0) or south (1)
    return left === across ? 1 : 0;
  }

  /**
   * Sends the buffered item on, keeping the belt lane it came in on (#61). With a filter, that item
   * goes out of its chosen side and everything else out of the other (#62). Without one, when both lanes
   * are being fed two different kinds of item, each goes straight through on its own side (#92);
   * otherwise the two sides take turns, and a blocked side is skipped.
   */
  private tickSplitter(b: Building): void {
    if (!b.outputs.length) return;
    const item = b.outputs[0];
    const lane = b.outLanes?.[0] ?? RIGHT;
    const lanes = this.splitterLanes(b);
    let order: number[];
    if (b.filter) {
      const leftSide = (item === b.filter) === ((b.side ?? 'left') === 'left');
      const left = this.splitterLeft(b);
      order = [leftSide ? left : 1 - left];
    } else if (b.inFrom != null && this.sortsKinds(b)) order = [b.inFrom];
    else order = [b.rr % 2, (b.rr + 1) % 2];
    for (const k of order) {
      const l = lanes[k];
      const target = this.buildingAt(l.outX, l.outY);
      if (target && target !== b && this.insert(target, item, l.x, l.y, lane)) {
        b.outputs.shift();
        b.outLanes?.shift();
        if (!b.filter) b.rr = (k + 1) % 2;
        return;
      }
    }
  }

  private tickTunnel(b: Building, dt: number): void {
    this.pushOutput(b); // items buffered by older saves, or a former exit whose entrance was removed
    if (this.isTunnelExit(b)) {
      this.tickBelt(b, dt); // items come up on the lane they went down on (#61)
      return;
    }
    const exit = b.link != null ? this.byId.get(b.link) : undefined;
    this.advanceItems(b.belt, dt, this.tunnelLength(b));
    if (!exit) return;
    for (const lane of [LEFT, RIGHT]) {
      const i = b.belt.findIndex((it) => it.lane === lane);
      const front = b.belt[i];
      if (!front || front.pos < 1 || !this.roomOn(exit.belt, lane, BELT_SPACING)) continue;
      b.belt.splice(i, 1);
      front.pos = 0;
      exit.belt.push(front);
      this.movedThisTick.add(front);
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
      const frac = o.hp / this.maxHp(o);
      if (frac >= worstFrac) continue;
      const [cx, cy] = this.centreOf(o);
      const [ow, oh] = this.footprintOf(o);
      const d = hypot(cx - (b.x + 0.5), cy - (b.y + 0.5));
      if (d <= REPAIR.range + Math.max(ow, oh) / 2 - 0.5) {
        worst = o;
        worstFrac = frac;
      }
    }
    if (!worst) return;
    const heal = Math.min(REPAIR.hpPerSecond * dt, this.maxHp(worst) - worst.hp, b.ammo);
    worst.hp += heal;
    b.ammo -= heal;
    // A sparkle every half second or so on the building being mended.
    const [hx, hy] = this.centreOf(worst);
    if (!this.healed.some((h) => h.age < 0.45 && h.x === hx && h.y === hy)) this.healed.push({ x: hx, y: hy, age: 0, by: b.id });
  }

  /**
   * An extractor mines its ore: one from each tile of it under its footprint every EXTRACTOR_PERIOD, so
   * up to 4 (D-096). Each tile runs out in time; with none left, it stands idle.
   */
  private tickExtractor(b: Building, dt: number): void {
    const item = b.recipe as ItemId | null; // the ore it was placed over
    if (item && b.outputs.length < OUTPUT_BUFFER) {
      const [fw, fh] = this.footprintOf(b);
      const tiles: number[] = [];
      for (let y = b.y; y < b.y + fh; y++) for (let x = b.x; x < b.x + fw; x++) if (this.resourceAt(x, y) === item) tiles.push(this.idx(x, y));
      if (!tiles.length) {
        b.progress = -1; // used up
      } else {
        b.progress = Math.max(b.progress, 0) + dt;
        if (b.progress >= EXTRACTOR_PERIOD) {
          b.progress = 0;
          for (const i of tiles) {
            b.outputs.push(item);
            this.takeOre(i);
          }
          this.noteMade(b, tiles.length);
        }
      }
    }
    this.pushOutput(b);
  }

  private noteMade(b: Building, n: number): void {
    const now = this.state.time;
    const times = this.made.get(b.id) ?? [];
    for (let i = 0; i < n; i++) times.push(now);
    while (times.length && times[0] <= now - 60) times.shift();
    this.made.set(b.id, times);
  }

  /** How many items a building made in the last minute, over how many seconds it's been watched (up to 60). */
  madeRecently(id: number): { count: number; seconds: number } {
    const now = this.state.time;
    const count = (this.made.get(id) ?? []).filter((t) => t > now - 60).length;
    return { count, seconds: Math.min(60, now - (this.watchedSince.get(id) ?? now)) };
  }

  private tickMachine(b: Building, dt: number): void {
    const recipe = b.recipe ? RECIPE_BY_ID[b.recipe] : undefined;
    const fuel = burnsFuel(b.type);
    if (recipe && !(fuel && b.ammo <= 0)) {
      if (b.progress < 0 && b.outputs.length + recipe.count <= OUTPUT_BUFFER + 1) {
        const ready = Object.entries(recipe.inputs).every(([k, n]) => (b.inputs[k as ItemId] ?? 0) >= n!);
        if (ready) {
          for (const [k, n] of Object.entries(recipe.inputs)) b.inputs[k as ItemId]! -= n!;
          b.progress = 0;
        }
      }
      if (b.progress >= 0) {
        b.progress += dt;
        if (fuel) b.ammo = Math.max(0, b.ammo - dt);
        if (b.progress >= recipe.time) {
          for (let i = 0; i < recipe.count; i++) b.outputs.push(recipe.output);
          this.noteMade(b, recipe.count);
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
    // Hydraulic defences fire only with power, and more slowly when their network runs short (D-117).
    const power = HYDRAULIC.includes(b.type) ? this.powered(b) : 1;
    if (power <= 0) return;
    const reload = 1 / (def.rate * power);
    const [cx, cy] = this.centreOf(b);
    let target: Enemy | undefined;
    let best = def.range * def.range;
    const min = (def.minRange ?? 0) ** 2; // the trebuchet's blind spot
    for (const e of this.state.enemies) {
      const d = (e.x - cx) ** 2 + (e.y - cy) ** 2;
      if (d <= best && d >= min) {
        best = d;
        target = e;
      }
    }
    if (!target) {
      // With no bugs in reach, a turret shoots a nest's mound (D-065). The hub's gun only defends.
      const mound = hub ? undefined : moundInRange(this, cx, cy, def.range);
      if (!mound) return;
      const [mx0, my0] = nestCentre(mound);
      if ((mx0 - cx) ** 2 + (my0 - cy) ** 2 < min) return;
      b.ammo--;
      b.cooldown = reload;
      damageMound(this, mound, def.damage);
      const [mx, my] = nestCentre(mound);
      this.shots.push({ x1: cx, y1: cy, x2: mx, y2: my, splash: def.splash, age: 0, arc: !!def.chain });
      return;
    }
    if (!hub) b.ammo--;
    b.cooldown = reload;
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
    this.shots.push({ x1: cx, y1: cy, x2: target.x, y2: target.y, splash: def.splash, age: 0, arc: !!def.chain });
    // Tesla: the arc jumps on to the nearest bug it hasn't hit yet, within reach of the last.
    const hit = new Set([target]);
    let last = target;
    for (let k = 0; k < (def.chain ?? 0); k++) {
      let next: Enemy | undefined;
      let near = def.chainRange! ** 2;
      for (const e of this.state.enemies) {
        if (hit.has(e) || e.hp <= 0) continue;
        const d = (e.x - last.x) ** 2 + (e.y - last.y) ** 2;
        if (d <= near) {
          near = d;
          next = e;
        }
      }
      if (!next) break;
      next.hp -= def.damage;
      onBugHurt(this, next);
      this.shots.push({ x1: last.x, y1: last.y, x2: next.x, y2: next.y, splash: 0, age: 0, arc: true, jump: true });
      hit.add(next);
      last = next;
    }
  }

  /**
   * A spike pit (D-107) hurts every bug standing on it, and wears down by the second for each one;
   * stakes refill it. Bugs on it move slower (see nests.ts).
   */
  private tickSpikes(b: Building, dt: number): void {
    if (b.ammo <= 0) return;
    for (const e of this.state.enemies) {
      if (Math.floor(e.x) !== b.x || Math.floor(e.y) !== b.y) continue;
      e.hp -= SPIKES.dps * dt;
      onBugHurt(this, e);
      b.ammo = Math.max(0, b.ammo - dt);
      if (b.ammo <= 0) return;
    }
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
    for (const e of s.enemies) delete e.raid;
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
    if (!id) return this.wet[i] ? 4 : 1; // bugs wade through ponds, slowly (D-115)
    const b = this.byId.get(id)!;
    if (!BUILDINGS[b.type].blocking) return 1;
    return 1 + BUILDINGS[b.type].hp / 25;
  }

  /** Dijkstra from every building tile outwards, up to FLOW_RANGE: angry bugs follow it downhill. */
  computeFlow(): void {
    this.fillFlow(this.flow, this.bugTargets(), FLOW_RANGE);
    this.state.paths.dirty = false;
    this.state.paths.at = this.state.time;
  }

  /**
   * The same from the shipyard alone, for a launch's woken bugs. It reaches just
   * past the furthest of their nests (with room for detours and chewing), which
   * keeps it cheap enough to refresh during a fight on a phone.
   */
  computeShipFlow(): void {
    this.fillFlow(this.shipFlow, this.shipTargets(), this.shipRange());
    this.state.paths.shipDirty = false;
    this.state.paths.shipAt = this.state.time;
  }

  private shipTargets(): Building[] {
    return this.state.buildings.filter((b) => b.type === 'shipyard');
  }

  private shipRange(): number {
    const yards = this.shipTargets();
    let range = 0;
    if (yards.length) {
      const [yx, yy] = this.centreOf(yards[0]);
      for (const id of this.state.ship.drawn) {
        const n = this.state.nests[id];
        if (n) range = Math.max(range, Math.abs(n.x + NESTS.cell / 2 - yx) + Math.abs(n.y + NESTS.cell / 2 - yy));
      }
    }
    return range + NESTS.cell + SHIP_FLOW_MARGIN;
  }

  private fillFlow(flow: Float64Array, targets: Building[], range: number): void {
    const { width: w, height: h } = this.state;
    flow.fill(Infinity);
    const heap = new MinHeap();
    for (const b of targets) {
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
      if (d > flow[i] || d > range) continue;
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

/** Buildings whose finished items can be carried to the hub by hand (#38). */
/**
 * Spots for the shipyard's site (D-109): 5×5, its middle SHIP_SITE.minDist to maxDist from the hub's,
 * on clear ground (no buildings, ore, trees or nest mounds), nearest first. Plain state, so a save
 * migration can use it too.
 */
export function shipSites(state: GameState): { x: number; y: number }[] {
  const hub = state.buildings.find((b) => b.id === state.hubId);
  if (!hub) return [];
  const [fw] = BUILDINGS.shipyard.size!;
  const taken = new Set<number>();
  for (const b of state.buildings) {
    const [w, h] = footprint(b.type, b.dir);
    for (let y = b.y; y < b.y + h; y++) for (let x = b.x; x < b.x + w; x++) taken.add(y * state.width + x);
  }
  const mounds = new Set<number>();
  for (const n of state.nests) {
    const c = Math.floor(NESTS.cell / 2);
    for (let y = n.y + c - 1; y <= n.y + c + 1; y++) for (let x = n.x + c - 1; x <= n.x + c + 1; x++) mounds.add(y * state.width + x);
  }
  const hx = hub.x + HUB_SIZE / 2;
  const hy = hub.y + HUB_SIZE / 2;
  const out: { x: number; y: number; d: number }[] = [];
  for (let y = Math.floor(hy - SHIP_SITE.maxDist - fw); y <= hy + SHIP_SITE.maxDist; y++) {
    for (let x = Math.floor(hx - SHIP_SITE.maxDist - fw); x <= hx + SHIP_SITE.maxDist; x++) {
      const d = hypot(x + fw / 2 - hx, y + fw / 2 - hy);
      if (d < SHIP_SITE.minDist || d > SHIP_SITE.maxDist) continue;
      let ok = x >= 0 && y >= 0 && x + fw <= state.width && y + fw <= state.height;
      for (let ty = y; ok && ty < y + fw; ty++) {
        for (let tx = x; tx < x + fw; tx++) {
          const i = ty * state.width + tx;
          if (taken.has(i) || mounds.has(i) || state.resources[i] || state.trees[i] === TREE) {
            ok = false;
            break;
          }
        }
      }
      if (ok) out.push({ x, y, d });
    }
  }
  out.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  return out.map(({ x, y }) => ({ x, y }));
}

export function canCollect(t: BuildingType): boolean {
  return t === 'extractor' || t === 'lumber_camp' || t === 'crate' || t === 'storage' || isMachine(t);
}
