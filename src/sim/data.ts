// Static game content: items, recipes, buildings, research, enemies and bug territories.
// Balance numbers live here so they can be tuned without touching the sim.

export type Dir = 0 | 1 | 2 | 3; // East, South, West, North
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;

export const ITEMS = {
  iron_ore: { name: 'Iron Ore', color: '#8c6a55' },
  copper_ore: { name: 'Copper Ore', color: '#3fa68c' },
  stone: { name: 'Stone', color: '#a29e94' },
  iron_plate: { name: 'Iron Plate', color: '#d4dbe3' },
  copper_ingot: { name: 'Copper Ingot', color: '#e0893a' },
  brick: { name: 'Brick', color: '#c0573f' },
  gear: { name: 'Gear', color: '#7f93ab' },
  wire: { name: 'Copper Wire', color: '#f2c14e' },
  motor: { name: 'Motor', color: '#9b7fe0' },
  log: { name: 'Log', color: '#8a5a32' },
  plank: { name: 'Plank', color: '#d9a866' },
  stake: { name: 'Stake', color: '#b98a50' },
  // Wooden parts (D-089, D-105).
  dowel: { name: 'Dowel', color: '#d8b07a' },
  peg: { name: 'Peg', color: '#a8743e' },
  rope: { name: 'Rope', color: '#c2a46b' },
  truss: { name: 'Truss', color: '#b07a3c' },
  charcoal: { name: 'Charcoal', color: '#3b3a3f' },
  steel: { name: 'Steel', color: '#8fa3b8' },
  chitin: { name: 'Chitin', color: '#7a8a3c' },
  // The Iron Age's parts (D-089, D-113): furnaces smelt ingots, the Blacksmith hammers them.
  iron_ingot: { name: 'Iron Ingot', color: '#9aa4ae' },
  iron_rod: { name: 'Iron Rod', color: '#b7c0c9' },
  rivet: { name: 'Rivet', color: '#c9ced4' },
} as const;
export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export type ItemCounts = Partial<Record<ItemId, number>>;

// Resource tiles on the map. Index 0 means "no resource".
export const RESOURCE_ITEMS: (ItemId | null)[] = [null, 'iron_ore', 'copper_ore', 'stone'];

export type MachineType = 'furnace' | 'workshop' | 'assembler' | 'sawmill' | 'blacksmith' | 'machine_shop';

export interface Recipe {
  id: string;
  machine: MachineType;
  inputs: ItemCounts;
  output: ItemId;
  count: number;
  time: number; // seconds
  /** A research that has to be done before a machine can use it. */
  requires?: string;
}

export const RECIPES: Recipe[] = [
  { id: 'iron_ingot', machine: 'furnace', inputs: { iron_ore: 1 }, output: 'iron_ingot', count: 1, time: 1.6 },
  { id: 'copper_ingot', machine: 'furnace', inputs: { copper_ore: 1 }, output: 'copper_ingot', count: 1, time: 1.6 },
  { id: 'brick', machine: 'furnace', inputs: { stone: 2 }, output: 'brick', count: 1, time: 2 },
  // The workshop's wooden parts come first, so a log or plank fed to a new one starts them (D-105).
  { id: 'peg', machine: 'workshop', inputs: { dowel: 1 }, output: 'peg', count: 2, time: 1.5 },
  { id: 'rope', machine: 'workshop', inputs: { log: 2 }, output: 'rope', count: 1, time: 3 },
  { id: 'truss', machine: 'workshop', inputs: { plank: 3, peg: 2, rope: 1 }, output: 'truss', count: 1, time: 4, requires: 'carpentry' },
  // Plates come first, so an ingot fed to a new blacksmith starts them (D-113).
  { id: 'iron_plate', machine: 'blacksmith', inputs: { iron_ingot: 1 }, output: 'iron_plate', count: 1, time: 1.5 },
  { id: 'iron_rod', machine: 'blacksmith', inputs: { iron_ingot: 1 }, output: 'iron_rod', count: 2, time: 1.5 },
  { id: 'rivet', machine: 'blacksmith', inputs: { iron_rod: 1 }, output: 'rivet', count: 4, time: 1.5 },
  // Gears and wire moved from the workshop to the Machine Shop (D-113).
  { id: 'gear', machine: 'machine_shop', inputs: { iron_plate: 2 }, output: 'gear', count: 1, time: 2 },
  { id: 'wire', machine: 'machine_shop', inputs: { copper_ingot: 1 }, output: 'wire', count: 2, time: 1.5 },
  { id: 'plank', machine: 'sawmill', inputs: { log: 1 }, output: 'plank', count: 2, time: 1.5 },
  { id: 'stake', machine: 'sawmill', inputs: { plank: 1 }, output: 'stake', count: 3, time: 1.5 },
  { id: 'dowel', machine: 'sawmill', inputs: { plank: 1 }, output: 'dowel', count: 4, time: 1.5 },
  { id: 'charcoal', machine: 'furnace', inputs: { log: 2 }, output: 'charcoal', count: 1, time: 2.5, requires: 'charcoal' },
  { id: 'steel', machine: 'furnace', inputs: { iron_plate: 2, charcoal: 1 }, output: 'steel', count: 1, time: 3 },
  { id: 'motor', machine: 'assembler', inputs: { gear: 1, wire: 2, iron_plate: 1 }, output: 'motor', count: 1, time: 4 },
];
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export type BuildingType =
  | 'hub'
  | 'belt'
  | 'express_belt'
  | 'splitter'
  | 'tunnel'
  | 'extractor'
  | 'furnace'
  | 'workshop'
  | 'assembler'
  | 'turret'
  | 'ballista'
  | 'cannon'
  | 'tesla'
  | 'repair'
  | 'port'
  | 'wall'
  | 'shipyard'
  | 'lumber_camp'
  | 'sawmill'
  | 'blacksmith'
  | 'machine_shop'
  | 'palisade'
  | 'roller'
  | 'crate'
  | 'spike_pit'
  | 'trebuchet';

export interface BuildingDef {
  name: string;
  short: string; // placeholder label drawn on the tile
  color: string;
  hp: number;
  cost: ItemCounts;
  blocking: boolean; // enemies must break through it rather than walk over it
  description: string;
  /** Width (along its facing) and depth in tiles, when facing east. Default 1×1. */
  size?: [number, number];
}

export const TUNNEL_RANGE = 5; // max distance from an entrance to its exit
/** How many items a storage crate holds, all of one kind (D-093). */
export const CRATE_SIZE = 50;

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  hub: { name: 'Hub', short: 'HUB', color: '#3b6fd6', hp: 1000, size: [8, 8], cost: {}, blocking: true, description: 'Receives items and pays for everything you build. Select it for research. It defends itself with a built-in gun.' },
  belt: { name: 'Belt', short: '', color: '#3a3f4b', hp: 30, cost: { iron_plate: 1 }, blocking: false, description: 'Moves items. Drag to lay a line.' },
  express_belt: {
    name: 'Express Belt',
    short: '',
    color: '#3a3f4b',
    hp: 40,
    cost: { iron_plate: 1, gear: 1 },
    blocking: false,
    description: 'Moves items twice as fast as a belt. Tap a belt to upgrade its whole line.',
  },
  splitter: { name: 'Splitter', short: 'SP', color: '#4a5a78', hp: 40, size: [1, 2], cost: { iron_plate: 3, copper_ingot: 1 }, blocking: false, description: 'Spans two belt lanes. Takes items from behind either lane and sends them out of both in turn.' },
  tunnel: { name: 'Underground Belt', short: '', color: '#2e3442', hp: 40, cost: { iron_plate: 4, brick: 1 }, blocking: false, description: `Place an entrance, then an exit up to ${TUNNEL_RANGE} tiles ahead facing the same way. Items pass underneath.` },
  extractor: { name: 'Extractor', short: 'EX', color: '#6b8f3a', hp: 80, size: [2, 2], cost: { stone: 4, iron_ore: 4 }, blocking: true, description: 'Place over ore. It mines whichever ore covers most of its base.' },
  furnace: { name: 'Furnace', short: 'FU', color: '#b5562f', hp: 120, size: [2, 2], cost: { stone: 6 }, blocking: true, description: 'Smelts ore into iron and copper ingots, and stone into bricks.' },
  workshop: { name: 'Workshop', short: 'WS', color: '#8a6d3b', hp: 120, size: [2, 2], cost: { plank: 10, log: 6 }, blocking: true, description: 'Makes pegs and rope, and trusses after Carpentry.' },
  assembler: { name: 'Assembler', short: 'AS', color: '#6a4fb3', hp: 150, size: [3, 3], cost: { gear: 10, wire: 10 }, blocking: true, description: 'Combines parts into motors.' },
  turret: { name: 'Turret', short: 'TU', color: '#2f8f8f', hp: 150, cost: { iron_plate: 10, copper_ingot: 2 }, blocking: true, description: 'Shoots enemies. Arrives loaded; refill it with iron plates by belt.' },
  cannon: { name: 'Cannon', short: 'CA', color: '#1f6f5f', hp: 220, cost: { iron_plate: 15, gear: 5, motor: 2 }, blocking: true, description: 'Splash damage. Arrives loaded; refill it with gears by belt.' },
  tesla: {
    name: 'Tesla Turret',
    short: 'TE',
    color: '#2f6f9f',
    hp: 160,
    cost: { iron_plate: 12, copper_ingot: 6, wire: 10 },
    blocking: true,
    description: 'Its shots arc from bug to bug. Arrives loaded; refill it with copper wire by belt.',
  },
  ballista: {
    name: 'Ballista',
    short: 'BA',
    color: '#8a6234',
    hp: 140,
    cost: { plank: 10, rope: 4 },
    blocking: true,
    description: 'Slow, long-range bolts. Arrives loaded; refill it with stakes (sawn from planks) by belt.',
  },
  repair: { name: 'Repair Station', short: '+', color: '#3f8f4f', hp: 150, cost: { iron_plate: 10, gear: 4, wire: 6, plank: 4 }, blocking: true, description: 'Repairs nearby buildings. Fuel it with iron plates or planks by belt.' },
  port: { name: 'Hub Port', short: 'PO', color: '#2d58b0', hp: 120, cost: { iron_plate: 10, copper_ingot: 5 }, blocking: true, description: 'Place next to the hub. Takes the item you choose out of hub stock and puts it on a belt.' },
  wall: { name: 'Wall', short: '', color: '#6d6a66', hp: 400, cost: { brick: 3 }, blocking: true, description: 'Slows enemies down.' },
  lumber_camp: {
    name: 'Lumber Camp',
    short: 'LC',
    color: '#6b4a2e',
    hp: 100,
    size: [2, 2],
    cost: { log: 8 },
    blocking: true,
    description: 'Place near trees. It cuts the nearest one into logs; the stump grows back in time.',
  },
  sawmill: { name: 'Sawmill', short: 'SM', color: '#9a6a3a', hp: 100, size: [2, 2], cost: { log: 14 }, blocking: true, description: 'Saws logs into planks.' },
  blacksmith: { name: 'Blacksmith', short: 'BS', color: '#5d6670', hp: 140, size: [2, 2], cost: { stone: 10, iron_ingot: 6 }, blocking: true, description: 'Hammers iron ingots into plates and rods, and rods into rivets.' },
  machine_shop: { name: 'Machine Shop', short: 'MS', color: '#4f6a86', hp: 140, size: [2, 2], cost: { iron_plate: 10, rivet: 10, brick: 4 }, blocking: true, description: 'Makes gears from iron plates and wire from copper ingots.' },
  palisade: { name: 'Palisade', short: '', color: '#8a6234', hp: 160, cost: { plank: 2 }, blocking: true, description: 'A cheap wooden wall. Weaker than stone.' },
  roller: {
    name: 'Wooden Roller',
    short: '',
    color: '#8a6234',
    hp: 20,
    cost: { plank: 1, dowel: 1 },
    blocking: false,
    description: 'Carries items in single file, slowly; a busy line packs up and goes faster. Drag to lay a line.',
  },
  spike_pit: {
    name: 'Spike Pit',
    short: '',
    color: '#6b4423',
    hp: 60,
    cost: { stake: 10, plank: 2 },
    blocking: false,
    description: 'A trap bugs walk over: it hurts and slows them, and wears down as it works. Refill it with stakes.',
  },
  trebuchet: {
    name: 'Trebuchet',
    short: 'TB',
    color: '#7a5230',
    hp: 220,
    size: [2, 2],
    cost: { plank: 40, rope: 10, truss: 8 },
    blocking: true,
    description: 'Hurls stone a long way, hitting every bug where it lands, but it can\'t hit anything close. Arrives loaded; refill it with stone.',
  },
  crate: { name: 'Storage Crate', short: 'CR', color: '#9a6a3a', hp: 60, cost: { plank: 6, peg: 4 }, blocking: true, description: `Holds up to ${CRATE_SIZE} of one item. Rollers fill it, and a roller leaving its front takes items out.` },
  shipyard: {
    name: 'Shipyard',
    short: 'SHIP',
    color: '#3a4a3a',
    hp: 900,
    size: [5, 5],
    cost: { plank: 60, truss: 10, log: 20 },
    blocking: true,
    description: "A dock for your colony supply ship, built on the site staked out for it. Bring in the parts for each stage, then each run's cargo, then launch.",
  },
};

/**
 * Fuel (D-113, D-114): furnaces and blacksmiths burn logs, or charcoal once researched, stored as seconds
 * of burning (in `Building.ammo`). They burn only while working, and stop when it runs out.
 */
export const FUEL = {
  burns: { log: 8, charcoal: 24 } as Partial<Record<ItemId, number>>,
  max: 48,
  types: ['furnace', 'blacksmith'] as BuildingType[],
};
export const burnsFuel = (t: BuildingType): boolean => FUEL.types.includes(t);

export const MACHINE_TYPES: MachineType[] = ['furnace', 'workshop', 'assembler', 'sawmill', 'blacksmith', 'machine_shop'];
export const isMachine = (t: BuildingType): t is MachineType => (MACHINE_TYPES as string[]).includes(t);

export interface TurretDef {
  ammoItem: ItemId;
  shotsPerItem: number;
  maxShots: number;
  range: number; // tiles
  rate: number; // shots per second
  damage: number;
  splash: number; // radius in tiles, 0 for single target
  /** Can't hit anything closer than this (the trebuchet, D-107). */
  minRange?: number;
  /** Tesla: each shot jumps on to up to this many more bugs, each within `chainRange` tiles of the last. */
  chain?: number;
  chainRange?: number;
}

export const TURRETS: Partial<Record<BuildingType, TurretDef>> = {
  turret: { ammoItem: 'iron_plate', shotsPerItem: 4, maxShots: 40, range: 5, rate: 3, damage: 5, splash: 0 },
  ballista: { ammoItem: 'stake', shotsPerItem: 1, maxShots: 20, range: 6.5, rate: 0.8, damage: 14, splash: 0 },
  // Range and blind spot doubled from the decisions page at the owner's note (D-093).
  trebuchet: { ammoItem: 'stone', shotsPerItem: 1, maxShots: 12, range: 24, minRange: 6, rate: 0.25, damage: 40, splash: 2 },
  cannon: { ammoItem: 'gear', shotsPerItem: 3, maxShots: 24, range: 6.5, rate: 0.7, damage: 30, splash: 1.3 },
  tesla: { ammoItem: 'wire', shotsPerItem: 2, maxShots: 30, range: 5, rate: 1, damage: 12, splash: 0, chain: 2, chainRange: 2 },
};

/**
 * The spike pit (D-093, D-107): `charge` is seconds of one bug standing on it. Each bug on it takes `dps`
 * and moves at `slow` of its speed, and uses up charge; a stake puts back `perStake`.
 */
export const SPIKES = { dps: 15, slow: 0.5, maxCharge: 60, perStake: 6 };

/** Repair stations burn iron plates or planks (D-054). */
export const REPAIR = { range: 3.5, hpPerSecond: 20, hpPerPlate: 40, hpPerPlank: 30, maxCharge: 400 };

/** The hub's built-in gun. It needs no ammo and never upgrades. */
export const HUB_WEAPON: TurretDef = { ammoItem: 'iron_plate', shotsPerItem: 0, maxShots: 0, range: 8, rate: 1.2, damage: 9, splash: 0 };

export const EXTRACTOR_PERIOD = 1.5; // seconds per item

/** Day, night and the seasons (#42, D-068). Times in seconds of game time. */
export interface Season {
  id: 'spring' | 'summer' | 'fall' | 'winter';
  name: string;
  days: number;
  regrow: number; // how fast stumps grow back, against LUMBER.regrow
}
export const CLOCK = {
  day: 360,
  night: 180,
  twilight: 30, // dusk and dawn fade over this long, at the ends of the night
  seasons: [
    { id: 'spring', name: 'Spring', days: 4, regrow: 1.5 },
    { id: 'summer', name: 'Summer', days: 2, regrow: 2 },
    { id: 'fall', name: 'Fall', days: 4, regrow: 0.75 },
    { id: 'winter', name: 'Winter', days: 2, regrow: 0.5 },
  ] as Season[],
  nightGiveUp: 28, // at night an angry bug gives up only with nothing this close (NESTS.giveUp by day)
  turn: 1, // days over which one season's look gives way to the next, at the end of the season (D-111)
  nightCloseRadius: 5, // a building this close to a calm bug provokes its nest at night (NESTS.closeRadius by day)
};

/** The player character (#40, D-067). */
export const PLAYER = {
  speed: 4, // tiles per second
  reach: 1.5, // tiles from the character to the edge of what it mines or hands things to
  slots: 12, // inventory slots (#87, D-090)
  stack: 10, // items of one kind a slot holds
  searchLimit: 20000, // tiles searched for a path before heading for the nearest spot found
  hp: 100, // health; bugs bite the engineer as hard as they bite buildings
  notice: 4, // an angry bug this close goes for the engineer instead of buildings
  regenAfter: 5, // seconds without a bite before health comes back
  regen: 5, // health per second, coming back
  downFor: 10, // seconds a knocked-out engineer takes to get back on their feet at the hub
};

/**
 * Mining by hand (#38): taps on one ore tile loosen one of its ore, which the character carries. Trees are
 * chopped the same way (D-093): the same taps fell one for LUMBER.logsPerTree logs, leaving a stump.
 */
export const HAND_MINING = {
  taps: 8, // taps for one item
  resetAfter: 3, // seconds without a tap before the count starts over
  holdRate: 4, // taps per second while a finger or mouse button is held down
};

/**
 * Ore tiles (D-096, D-097): each holds `perTile` ore, then it's bare ground. No ore lies closer than
 * `minDistance` tiles to the hub's edge.
 */
export const ORE = { perTile: 1200, minDistance: 20 };

/**
 * Fog of war (D-099, D-112): the map is hidden in cells of `cell` tiles until something comes within
 * sight of them. Explored ground stays explored. Only the view: turrets still fire into it.
 */
export const FOG = {
  cell: 4,
  hub: 36, // tiles the hub sees, from its middle: past the starter ore (ORE.minDistance)
  player: 9, // tiles an engineer sees
  building: 5, // tiles any other building sees (towers see their range plus this)
};

/** Trees and the Lumber Camp (D-044). Unlike ore, wood runs out until the stumps grow back. */
export const LUMBER = {
  regrowths: 3, // a tree's stump grows back this many times; cut again after that, the ground stays clear (D-094)
  range: 4, // tiles from the camp's centre to a tree's centre
  period: 3, // seconds to cut one tree
  logsPerTree: 2,
  regrow: 180, // average seconds for a stump to become a tree again
  regrowSpread: 60, // each stump takes regrow ± this, at random, so a grove grows back gradually (#50)
};

/** Where map generation puts forest (D-044). */
export const FOREST = {
  share: 0.14, // of the map
  scale: 16, // noise scale in tiles
  clear: 20, // no trees this close to the hub's centre
  grove: 3, // radius of the guaranteed grove just outside the clearing
};
export const BELT_SPEED = 1.5; // tiles per second
export const EXPRESS_BELT_SPEED = 3; // a colony blueprint (D-049)

/**
 * Wooden rollers (D-093, D-106): one lane, no power. Items roll on their own at a third of belt speed;
 * a roller packed with this many items is being pushed, and moves them at belt speed.
 */
export const ROLLER = { speed: BELT_SPEED / 3, packed: 2 };
/** Belts of any kind, rollers included: they carry items the same way. */
export const isBelt = (t: BuildingType): boolean => t === 'belt' || t === 'express_belt' || t === 'roller';
export const beltSpeed = (t: BuildingType): number => (t === 'express_belt' ? EXPRESS_BELT_SPEED : t === 'roller' ? ROLLER.speed : BELT_SPEED);
export const BELT_SPACING = 0.34; // minimum gap between items on a belt
export const OUTPUT_BUFFER = 3;

export type EnemyType = 'crawler' | 'runner' | 'brute';
export interface EnemyDef {
  name: string;
  hp: number;
  speed: number; // tiles per second
  dps: number; // damage to buildings per second
  radius: number;
  color: string;
}
export const ENEMIES: Record<EnemyType, EnemyDef> = {
  crawler: { name: 'Crawler', hp: 18, speed: 1.1, dps: 8, radius: 0.22, color: '#e0445a' },
  runner: { name: 'Runner', hp: 10, speed: 2.2, dps: 5, radius: 0.17, color: '#ff9a3c' },
  brute: { name: 'Brute', hp: 110, speed: 0.55, dps: 30, radius: 0.36, color: '#a8203a' },
};

/** Buildings available at the start; everything else is researched. The Wood Age starts with none (D-093). */
export const STARTING_BUILDINGS: BuildingType[] = [];

export interface Research {
  id: string;
  name: string;
  cost: ItemCounts; // drawn from hub stock while it's being researched
  time: number; // seconds to research, if the stock keeps up
  requires: string[]; // research ids
  unlocks: BuildingType[];
  /** A research that improves something instead of unlocking a building. */
  effect?: 'plating';
  description: string;
}

export const RESEARCH: Research[] = [
  { id: 'forestry', name: 'Forestry', cost: { log: 15 }, time: 20, requires: [], unlocks: ['lumber_camp', 'sawmill'], description: 'Lumber camps cut trees into logs, and sawmills make planks.' },
  // The Iron Age's keystone (D-089, D-093): hold your ground with the Wood Age's top defence first.
  { id: 'industry', name: 'Industry', cost: { plank: 100, truss: 50, stone: 50 }, time: 90, requires: ['carpentry', 'defense2'], unlocks: ['extractor', 'furnace'], description: 'Extractors and furnaces: ore, smelted into iron and copper ingots, and stone into bricks.' },
  // The Iron Age's shops (D-089, D-113). Plates now come from the Blacksmith, so what costs plates needs it.
  { id: 'blacksmith', name: 'Blacksmith', cost: { iron_ingot: 50, stone: 30 }, time: 45, requires: ['industry'], unlocks: ['blacksmith'], description: 'Blacksmiths hammer iron ingots into plates and rods, and rods into rivets.' },
  { id: 'charcoal', name: 'Charcoal', cost: { log: 40, iron_plate: 20 }, time: 45, requires: ['blacksmith'], unlocks: [], description: 'Furnaces can burn logs into charcoal, a fuel that lasts three times as long as a log.' },
  { id: 'machine_shop', name: 'Machine Shop', cost: { iron_plate: 80, rivet: 40, copper_ingot: 20 }, time: 60, requires: ['blacksmith'], unlocks: ['machine_shop'], description: 'Machine shops make gears from iron plates and wire from copper ingots.' },
  { id: 'logistics', name: 'Logistics', cost: { iron_plate: 10 }, time: 20, requires: ['blacksmith'], unlocks: ['belt', 'splitter', 'tunnel'], description: 'Belts, splitters and underground belts.' },
  { id: 'defense', name: 'Advanced Defense', cost: { iron_plate: 20 }, time: 30, requires: ['blacksmith'], unlocks: ['turret'], description: 'Turrets that fire iron plates.' },
  // The Wood Age's defences (D-089, D-107). Ids kept from before, so saves keep them.
  { id: 'palisades', name: 'Basic Defense', cost: { plank: 30, rope: 10 }, time: 30, requires: ['rollers', 'workshop'], unlocks: ['palisade', 'spike_pit'], description: 'Palisades, cheap wooden walls, and spike pits, traps bugs walk over.' },
  { id: 'defense2', name: 'Basic Defense 2', cost: { log: 100, plank: 100, rope: 200, truss: 50 }, time: 120, requires: ['palisades', 'carpentry'], unlocks: ['trebuchet', 'ballista'], description: 'Trebuchets that hurl stone a long way, and ballistae that fire stakes.' },
  { id: 'plating', name: 'Chitin Plating', cost: { chitin: 10, iron_plate: 20 }, time: 45, requires: ['defense'], unlocks: [], effect: 'plating', description: 'Turrets, walls and palisades get half as much health again. Chitin comes from destroyed nests.' },
  { id: 'masonry', name: 'Masonry', cost: { brick: 12 }, time: 30, requires: ['industry'], unlocks: ['wall'], description: 'Walls to slow and steer enemies.' },
  { id: 'rollers', name: 'Basic Logistics', cost: { log: 20, plank: 20, dowel: 50 }, time: 45, requires: ['forestry'], unlocks: ['roller', 'crate'], description: 'Wooden rollers carry items in single file without power, and storage crates hold 50 of one item.' },
  { id: 'workshop', name: 'Workshops', cost: { plank: 40, log: 20 }, time: 45, requires: ['forestry'], unlocks: ['workshop'], description: 'Workshops make pegs from dowels and rope from logs.' },
  { id: 'carpentry', name: 'Carpentry', cost: { plank: 60, peg: 40, rope: 20 }, time: 60, requires: ['workshop'], unlocks: [], description: 'Workshops can make trusses from planks, pegs and rope.' },
  { id: 'distribution', name: 'Distribution', cost: { iron_plate: 25, copper_ingot: 10 }, time: 60, requires: ['defense'], unlocks: ['port'], description: 'Hub ports put stock from the hub back onto belts.' },
  { id: 'assembly', name: 'Assembly', cost: { gear: 30, wire: 30 }, time: 120, requires: ['machine_shop'], unlocks: ['assembler'], description: 'Combine parts into motors.' },
  { id: 'repair', name: 'Field Repair', cost: { gear: 20, wire: 20 }, time: 90, requires: ['machine_shop', 'masonry'], unlocks: ['repair'], description: 'Stations that repair nearby buildings.' },
  { id: 'shipyard', name: 'Shipyard', cost: { plank: 80, truss: 20, rope: 20 }, time: 90, requires: ['carpentry'], unlocks: ['shipyard'], description: 'A dock where you can build a ship to carry supplies to the colony.' },
  { id: 'ordnance', name: 'Heavy Ordnance', cost: { motor: 10, gear: 30 }, time: 150, requires: ['assembly', 'defense'], unlocks: ['cannon'], description: 'Cannons with splash damage that fire gears.' },
];
export const RESEARCH_BY_ID: Record<string, Research> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

export type GameMode = 'standard' | 'hardcore';

/** Standard mode: what happens when the hub falls instead of ending the run. */
export const BREACH = {
  stockLost: 0.25, // fraction of every item in hub stock
  hubRestore: 0.5, // fraction of hub HP restored
};

/**
 * The shipyard's site (#98, D-098, D-109): staked out at the start, its middle this far from the hub's
 * middle, and the only place the shipyard goes.
 */
export const SHIP_SITE = { minDist: 9, maxDist: 15 };

export const PORT_PERIOD = 0.5; // seconds per item a hub port puts out

/**
 * The colony supply ship (D-034, D-046). Stages are built once, in order, from
 * items belted into the shipyard; then each supply run's cargo is belted in.
 */
export interface ShipStage {
  id: string;
  name: string;
  items: ItemCounts;
}

export const SHIP = {
  stages: [
    // One stage per age (D-089); the Wood Age's is the scaffolding (D-109).
    { id: 'scaffold', name: 'Scaffolding', items: { plank: 150, truss: 40, rope: 60 } },
    { id: 'hull', name: 'Hull', items: { iron_plate: 150, brick: 80 } },
    { id: 'engine', name: 'Engine', items: { motor: 30, gear: 80 } },
    { id: 'life', name: 'Life support', items: { wire: 120, copper_ingot: 60 } },
    { id: 'nav', name: 'Navigation', items: { motor: 20, wire: 80, gear: 40 } },
  ] as ShipStage[],
  launchTime: 90, // seconds from pressing Launch to lift-off; the shipyard must survive them
  wakeRadius: 48, // the engines provoke every bug territory within this many tiles on the first run
  wakeGrowth: 8, // and this much further for each run delivered: a loaded ship is heavier (D-049)
  wakeMax: 96,
  minWake: 3, // and at least this many of the nearest live ones, however far
  returnTime: 300, // seconds the ship is away after delivering a run
  /** Cargo for the first supply runs, in order. Later runs repeat the last list, growing (cargoFor). */
  cargo: [
    { iron_plate: 100, brick: 60, copper_ingot: 40 },
    { iron_plate: 120, gear: 60, wire: 60, plank: 60 },
    { brick: 120, gear: 100, motor: 20, plank: 120 },
    { steel: 40, gear: 120, motor: 30, plank: 180 },
  ] as ItemCounts[],
  cargoGrowth: 1.25, // each run past the listed ones asks for this much more of everything
};

/** Blueprints the colony sends back for delivered supply runs (D-049): buildings you can't research. */
export interface Blueprint {
  id: string;
  name: string;
  description: string;
  unlocks: BuildingType[];
}

export const BLUEPRINTS: Blueprint[] = [
  { id: 'express_belt', name: 'Express Belt', description: 'Belts twice as fast. Tap a belt to upgrade its whole line.', unlocks: ['express_belt'] },
  { id: 'tesla', name: 'Tesla Turret', description: 'Fed by copper wire. Each shot arcs on to two more bugs nearby.', unlocks: ['tesla'] },
];
export const BLUEPRINT_BY_ID: Record<string, Blueprint> = Object.fromEntries(BLUEPRINTS.map((b) => [b.id, b]));

/** The cargo for supply run `run` (0 for the first). */
export function cargoFor(run: number): ItemCounts {
  const list = SHIP.cargo;
  const last = list.length - 1;
  if (run <= last) return list[run];
  const scale = SHIP.cargoGrowth ** (run - last);
  const out: ItemCounts = {};
  for (const [k, n] of Object.entries(list[last])) out[k as ItemId] = Math.ceil((n! * scale) / 10) * 10;
  return out;
}

/** The hub starts empty: the first stone and ore are mined by hand (#38). */
export const START_INVENTORY: ItemCounts = {};

export const MAP_SIZE = 256;
export const HUB_SIZE = 8; // 5 before D-108

/** A building's width and height on the map when facing `dir` (sideways turns swap them). */
export function footprint(t: BuildingType, dir: Dir = 0): [number, number] {
  const [w, h] = BUILDINGS[t].size ?? [1, 1];
  return dir % 2 ? [h, w] : [w, h];
}

/**
 * Bug territories (D-038). The map is divided into square cells; some cells
 * far from the hub hold a nest whose bugs roam only inside it. They attack
 * when provoked: by building in or next to the cell, by a building coming
 * close to one of them, or by being shot.
 */
export const NESTS = {
  cell: 10, // a territory is one cell of this many tiles square
  safeRadius: 30, // no territory has a tile this close to the hub's centre
  chance: 0.18, // share of the other cells that hold a nest
  nearMargin: 2, // building within this many tiles of a territory provokes it
  closeRadius: 3, // a building this close to a calm bug provokes its nest
  calmAfter: 30, // seconds without fresh provocation before a nest settles down
  giveUp: 20, // an angry bug chases while a building or an engineer is this close (straight line); with none, it goes home (D-091)
  pause: [1, 4] as [number, number], // seconds a roaming bug rests between strolls
  spreadEvery: 240, // seconds between territories spreading into a neighbouring cell (#51)
  spreadShare: 0.5, // a new territory starts with this share of the bugs a nest there would have
  moundHp: 300, // a mound's health next to the safe radius; it grows with distance like its bugs (D-065)
  moundRadius: 1.1, // tiles: a turret in range of the mound's edge can shoot it
  breedEvery: [60, 90] as [number, number], // seconds between bugs a calm nest breeds, while it has fewer than it started with
  growUp: 180, // seconds a newly hatched bug takes to grow into an adult
  young: 0.5, // a newly hatched bug's share of an adult's health, bite and size
  threatEvery: 1080, // seconds of play between threat levels (D-065: every 15–20 minutes)
  threatMax: 10,
  threatHp: 0.15, // bugs bred or spread from now on get this much more health per threat level
  threatSwap: 0.08, // chance per level that a bred crawler hatches as a runner (or, far out, a brute), up to threatSwapMax
  threatSwapMax: 0.5,
  threatSpread: 0.08, // territories spread this much sooner per level, down to threatSpreadMin of the usual time
  threatSpreadMin: 0.5,
};

/**
 * Night raids (D-065). At nightfall a nest near your buildings may send a small party of grown bugs
 * after them, without the rest of the nest waking. Raiders keep going until morning, and then until nothing is
 * left within their give-up distance.
 */
export const RAIDS = {
  firstNight: 2, // the first night with raids (day 2's)
  chance: 0.5, // chance of a raid each night in Standard (Hardcore: every night)
  chancePerThreat: 0.1, // more likely with each threat level
  range: 40, // only nests whose centre is this close to one of your buildings raid
  party: 2, // grown bugs in a party, plus one per partyThreat threat levels
  partyThreat: 2,
  partyMax: 6,
};

/** A nest's mound health `distance` tiles from the hub. */
export const moundHp = (distance: number): number => Math.round(NESTS.moundHp * (1 + distance / 150));
/** Chitin a destroyed mound drops, more further out (D-065). */
export const chitinFor = (distance: number): number => Math.min(10, 3 + Math.floor(distance / 25));

/** Chitin Plating: these buildings get this much more health (D-065). */
export const PLATING = { bonus: 1.5, types: ['turret', 'cannon', 'ballista', 'tesla', 'trebuchet', 'wall', 'palisade'] as BuildingType[] };

/** What lives in a nest `distance` tiles from the hub: further out is more dangerous. */
export function nestComposition(distance: number): { crawlers: number; runners: number; brutes: number; hpMult: number } {
  return {
    crawlers: 3 + Math.floor(distance / 45),
    runners: distance > 60 ? 1 + Math.floor((distance - 60) / 40) : 0,
    brutes: distance > 100 ? 1 + Math.floor((distance - 100) / 50) : 0,
    hpMult: 1 + distance / 150,
  };
}
