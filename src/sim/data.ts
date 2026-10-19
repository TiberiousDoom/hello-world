// Static game content: items, recipes, buildings, research, enemies and waves.
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
} as const;
export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export type ItemCounts = Partial<Record<ItemId, number>>;

// Resource tiles on the map. Index 0 means "no resource".
export const RESOURCE_ITEMS: (ItemId | null)[] = [null, 'iron_ore', 'copper_ore', 'stone'];

export type MachineType = 'furnace' | 'workshop' | 'assembler';

export interface Recipe {
  id: string;
  machine: MachineType;
  inputs: ItemCounts;
  output: ItemId;
  count: number;
  time: number; // seconds
}

export const RECIPES: Recipe[] = [
  { id: 'iron_plate', machine: 'furnace', inputs: { iron_ore: 1 }, output: 'iron_plate', count: 1, time: 1.6 },
  { id: 'copper_ingot', machine: 'furnace', inputs: { copper_ore: 1 }, output: 'copper_ingot', count: 1, time: 1.6 },
  { id: 'brick', machine: 'furnace', inputs: { stone: 2 }, output: 'brick', count: 1, time: 2 },
  { id: 'gear', machine: 'workshop', inputs: { iron_plate: 2 }, output: 'gear', count: 1, time: 2 },
  { id: 'wire', machine: 'workshop', inputs: { copper_ingot: 1 }, output: 'wire', count: 2, time: 1.5 },
  { id: 'motor', machine: 'assembler', inputs: { gear: 1, wire: 2, iron_plate: 1 }, output: 'motor', count: 1, time: 4 },
];
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export type BuildingType =
  | 'hub'
  | 'belt'
  | 'splitter'
  | 'tunnel'
  | 'extractor'
  | 'furnace'
  | 'workshop'
  | 'assembler'
  | 'turret'
  | 'cannon'
  | 'repair'
  | 'port'
  | 'wall';

export interface BuildingDef {
  name: string;
  short: string; // placeholder label drawn on the tile
  color: string;
  hp: number;
  cost: ItemCounts;
  blocking: boolean; // enemies must break through it rather than walk over it
  description: string;
}

export const TUNNEL_RANGE = 5; // max distance from an entrance to its exit

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  hub: { name: 'Hub', short: 'HUB', color: '#3b6fd6', hp: 600, cost: {}, blocking: true, description: 'Receives items. Protect it.' },
  belt: { name: 'Belt', short: '', color: '#3a3f4b', hp: 30, cost: { iron_plate: 1 }, blocking: false, description: 'Moves items. Drag to lay a line.' },
  splitter: { name: 'Splitter', short: 'SP', color: '#4a5a78', hp: 40, cost: { iron_plate: 3, copper_ingot: 1 }, blocking: false, description: 'Takes items from behind and sends them out front, left and right in turn.' },
  tunnel: { name: 'Underground Belt', short: '', color: '#2e3442', hp: 40, cost: { iron_plate: 4, brick: 1 }, blocking: false, description: `Place an entrance, then an exit up to ${TUNNEL_RANGE} tiles ahead facing the same way. Items pass underneath.` },
  extractor: { name: 'Extractor', short: 'EX', color: '#6b8f3a', hp: 80, cost: { iron_plate: 6 }, blocking: true, description: 'Place on a resource node to mine it.' },
  furnace: { name: 'Furnace', short: 'FU', color: '#b5562f', hp: 120, cost: { brick: 4, iron_plate: 2 }, blocking: true, description: 'Smelts ore into plates, ingots and bricks.' },
  workshop: { name: 'Workshop', short: 'WS', color: '#8a6d3b', hp: 120, cost: { iron_plate: 8, copper_ingot: 4 }, blocking: true, description: 'Makes gears and wire.' },
  assembler: { name: 'Assembler', short: 'AS', color: '#6a4fb3', hp: 150, cost: { gear: 10, wire: 10 }, blocking: true, description: 'Combines parts into motors.' },
  turret: { name: 'Turret', short: 'TU', color: '#2f8f8f', hp: 150, cost: { iron_plate: 10, copper_ingot: 2 }, blocking: true, description: 'Shoots enemies. Arrives loaded; refill it with iron plates by belt.' },
  cannon: { name: 'Cannon', short: 'CA', color: '#1f6f5f', hp: 220, cost: { iron_plate: 15, gear: 5, motor: 2 }, blocking: true, description: 'Splash damage. Arrives loaded; refill it with gears by belt.' },
  repair: { name: 'Repair Station', short: '+', color: '#3f8f4f', hp: 150, cost: { iron_plate: 12, gear: 4, wire: 6 }, blocking: true, description: 'Repairs nearby buildings. Fuel it with iron plates by belt.' },
  port: { name: 'Hub Port', short: 'PO', color: '#2d58b0', hp: 120, cost: { iron_plate: 10, copper_ingot: 5 }, blocking: true, description: 'Place next to the hub. Takes the item you choose out of hub stock and puts it on a belt.' },
  wall: { name: 'Wall', short: '', color: '#6d6a66', hp: 400, cost: { brick: 3 }, blocking: true, description: 'Slows enemies down.' },
};

export const MACHINE_TYPES: MachineType[] = ['furnace', 'workshop', 'assembler'];
export const isMachine = (t: BuildingType): t is MachineType => (MACHINE_TYPES as string[]).includes(t);

export interface TurretDef {
  ammoItem: ItemId;
  shotsPerItem: number;
  maxShots: number;
  range: number; // tiles
  rate: number; // shots per second
  damage: number;
  splash: number; // radius in tiles, 0 for single target
}

export const TURRETS: Partial<Record<BuildingType, TurretDef>> = {
  turret: { ammoItem: 'iron_plate', shotsPerItem: 4, maxShots: 40, range: 5, rate: 3, damage: 5, splash: 0 },
  cannon: { ammoItem: 'gear', shotsPerItem: 3, maxShots: 24, range: 6.5, rate: 0.7, damage: 30, splash: 1.3 },
};

export const REPAIR = { range: 3.5, hpPerSecond: 20, hpPerPlate: 40, maxCharge: 400 };

export const EXTRACTOR_PERIOD = 1.5; // seconds per item
export const BELT_SPEED = 1.5; // tiles per second
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

/** Buildings available at the start; everything else is researched. */
export const STARTING_BUILDINGS: BuildingType[] = ['belt', 'extractor', 'furnace'];

export interface Research {
  id: string;
  name: string;
  cost: ItemCounts; // paid from hub stock
  requires: string[]; // research ids
  unlocks: BuildingType[];
  description: string;
}

export const RESEARCH: Research[] = [
  { id: 'defense', name: 'Basic Defense', cost: { iron_plate: 20 }, requires: [], unlocks: ['turret'], description: 'Turrets that fire iron plates.' },
  { id: 'masonry', name: 'Masonry', cost: { brick: 12 }, requires: [], unlocks: ['wall'], description: 'Walls to slow and steer enemies.' },
  { id: 'workshop', name: 'Workshops', cost: { iron_plate: 30, copper_ingot: 10 }, requires: [], unlocks: ['workshop'], description: 'Make gears and wire.' },
  { id: 'distribution', name: 'Distribution', cost: { iron_plate: 25, copper_ingot: 10 }, requires: ['defense'], unlocks: ['port'], description: 'Hub ports put stock from the hub back onto belts.' },
  { id: 'logistics', name: 'Logistics', cost: { iron_plate: 20, gear: 10 }, requires: ['workshop'], unlocks: ['splitter'], description: 'Splitters branch a line three ways.' },
  { id: 'underground', name: 'Underground Transport', cost: { gear: 20, brick: 10 }, requires: ['logistics'], unlocks: ['tunnel'], description: 'Belts that pass under anything.' },
  { id: 'assembly', name: 'Assembly', cost: { gear: 30, wire: 30 }, requires: ['workshop'], unlocks: ['assembler'], description: 'Combine parts into motors.' },
  { id: 'repair', name: 'Field Repair', cost: { gear: 20, wire: 20 }, requires: ['workshop', 'masonry'], unlocks: ['repair'], description: 'Stations that repair nearby buildings.' },
  { id: 'ordnance', name: 'Heavy Ordnance', cost: { motor: 10, gear: 30 }, requires: ['assembly', 'defense'], unlocks: ['cannon'], description: 'Cannons with splash damage that fire gears.' },
];
export const RESEARCH_BY_ID: Record<string, Research> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

export type GameMode = 'standard' | 'hardcore';

/** Standard mode: what happens when the hub falls instead of ending the run. */
export const BREACH = {
  stockLost: 0.25, // fraction of every item in hub stock
  hubRestore: 0.5, // fraction of hub HP restored
  waveDelay: 60, // extra seconds before the next wave
};
/** Surviving this many waves in standard mode unlocks hardcore. */
export const HARDCORE_UNLOCK_WAVE = 10;

export const PORT_PERIOD = 0.5; // seconds per item a hub port puts out

export const START_INVENTORY: ItemCounts = { iron_plate: 100, brick: 24, copper_ingot: 16 };

export const FIRST_WAVE_AT = 180; // seconds
export const WAVE_INTERVAL = 75;
export const WAVE_WARNING = 30; // spawn points are shown this long before a wave
export const SPAWN_GAP = 0.6; // seconds between enemies in a wave

export function waveComposition(n: number): {
  crawlers: number;
  runners: number;
  brutes: number;
  hpMult: number;
  spawnPoints: number;
} {
  return {
    crawlers: 4 + 2 * n,
    runners: n >= 2 ? 2 * (n - 1) : 0,
    brutes: n >= 3 ? n - 2 : 0,
    hpMult: 1 + 0.15 * (n - 1),
    spawnPoints: n >= 4 ? 2 : 1,
  };
}

export const MAP_SIZE = 64;
export const HUB_SIZE = 3;
