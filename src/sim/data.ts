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
  // The Steam Age's parts (D-119): the Steel Works rolls steel into them.
  steel_beam: { name: 'Steel Beam', color: '#8fa3b8' },
  bearing: { name: 'Bearing', color: '#9aa6b3' },
  // Gunpowder weapons (D-119, D-123).
  sulfur: { name: 'Sulfur', color: '#e8d23a' },
  gunpowder: { name: 'Gunpowder', color: '#c2a46b' },
  casing: { name: 'Casing', color: '#d9a63a' },
  bullet: { name: 'Bullets', color: '#b8862a' },
  shell: { name: 'Shell', color: '#7a6a4a' },
  // The Electric Age's parts (D-125): the Circuit Works makes them.
  circuit: { name: 'Circuit Board', color: '#3f9a5a' },
  coil: { name: 'Coil', color: '#d98a3a' },
} as const;
export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export type ItemCounts = Partial<Record<ItemId, number>>;

// Resource tiles on the map. Index 0 means "no resource".
export const RESOURCE_ITEMS: (ItemId | null)[] = [null, 'iron_ore', 'copper_ore', 'stone', 'sulfur'];
/** The resource index of sulfur (D-123), placed in deposits of its own rather than by the ore noise. */
export const SULFUR_RESOURCE = 4;

export type MachineType = 'furnace' | 'workshop' | 'assembler' | 'sawmill' | 'blacksmith' | 'machine_shop' | 'steel_works' | 'powder_mill' | 'circuit_works';

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
  { id: 'steel', machine: 'furnace', inputs: { iron_plate: 2, charcoal: 1 }, output: 'steel', count: 1, time: 3, requires: 'steelmaking' },
  // The Steam Age's parts (D-119).
  { id: 'steel_beam', machine: 'steel_works', inputs: { steel: 2 }, output: 'steel_beam', count: 1, time: 3 },
  { id: 'bearing', machine: 'steel_works', inputs: { steel: 1, gear: 1 }, output: 'bearing', count: 2, time: 3 },
  // Gunpowder weapons (D-123).
  { id: 'gunpowder', machine: 'powder_mill', inputs: { sulfur: 1, charcoal: 1 }, output: 'gunpowder', count: 2, time: 3 },
  { id: 'casing', machine: 'steel_works', inputs: { steel: 1 }, output: 'casing', count: 4, time: 2, requires: 'heavy_defense' },
  { id: 'bullet', machine: 'assembler', inputs: { casing: 1, gunpowder: 1 }, output: 'bullet', count: 1, time: 2, requires: 'heavy_defense' },
  { id: 'shell', machine: 'assembler', inputs: { casing: 2, gunpowder: 2, steel: 1 }, output: 'shell', count: 1, time: 4, requires: 'heavy_defense2' },
  // The Electric Age's parts (D-125).
  { id: 'circuit', machine: 'circuit_works', inputs: { wire: 3, iron_plate: 1 }, output: 'circuit', count: 1, time: 3 },
  { id: 'coil', machine: 'circuit_works', inputs: { wire: 4, iron_rod: 1 }, output: 'coil', count: 1, time: 3 },
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
  | 'reinforced_wall'
  | 'shipyard'
  | 'lumber_camp'
  | 'sawmill'
  | 'blacksmith'
  | 'machine_shop'
  | 'steel_works'
  | 'powder_mill'
  | 'circuit_works'
  | 'turret2'
  | 'mortar'
  | 'artillery'
  | 'steel_wall'
  | 'arc_fence'
  | 'drone_pad'
  | 'shield_pylon'
  | 'railgun'
  | 'floodlight'
  | 'boiler'
  | 'steam_turbine'
  | 'power_pole'
  | 'shaft'
  | 'well'
  | 'water_wheel'
  | 'palisade'
  | 'roller'
  | 'crate'
  | 'storage'
  | 'storage_silo'
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
/** The Storage Unit (#87, D-116): six slots of up to 50 of one item each. */
export const STORAGE = { slots: 6, stack: 50 };
/** The Storage Silo (D-122): the Steam Age's bigger store, the same rules. */
export const SILO = { slots: 12, stack: 100 };
/** Stores with slots of mixed items, first in, first out: their slots and stack sizes. */
export const STORES: Partial<Record<BuildingType, { slots: number; stack: number }>> = { storage: STORAGE, storage_silo: SILO };
export const isStore = (t: BuildingType): boolean => STORES[t] != null;

/** Whether a store holding `items` has room for one more `item`. */
export function storageRoom(items: ItemId[], item: ItemId, store = STORAGE): boolean {
  const counts = new Map<ItemId, number>([[item, 1]]);
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  let slots = 0;
  for (const n of counts.values()) slots += Math.ceil(n / store.stack);
  return slots <= store.slots;
}

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
    description: 'Moves items twice as fast as a belt, with electricity from a power pole; without it, at roller speed. Tap a belt to upgrade its whole line.',
  },
  splitter: { name: 'Splitter', short: 'SP', color: '#4a5a78', hp: 40, size: [1, 2], cost: { iron_plate: 3, copper_ingot: 1 }, blocking: false, description: 'Spans two belt lanes. Takes items from behind either lane and sends them out of both in turn.' },
  tunnel: { name: 'Underground Belt', short: '', color: '#2e3442', hp: 40, cost: { iron_plate: 4, brick: 1 }, blocking: false, description: `Place an entrance, then an exit up to ${TUNNEL_RANGE} tiles ahead facing the same way. Items pass underneath.` },
  extractor: { name: 'Extractor', short: 'EX', color: '#6b8f3a', hp: 80, size: [2, 2], cost: { stone: 4, iron_ore: 4 }, blocking: true, description: 'Place over ore. It mines whichever ore covers most of its base.' },
  furnace: { name: 'Furnace', short: 'FU', color: '#b5562f', hp: 120, size: [2, 2], cost: { stone: 6 }, blocking: true, description: 'Smelts ore into iron and copper ingots, and stone into bricks.' },
  workshop: { name: 'Workshop', short: 'WS', color: '#8a6d3b', hp: 120, size: [2, 2], cost: { plank: 10, log: 6 }, blocking: true, description: 'Makes pegs and rope, and trusses after Carpentry.' },
  assembler: { name: 'Assembler', short: 'AS', color: '#6a4fb3', hp: 150, size: [3, 3], cost: { gear: 10, wire: 10 }, blocking: true, description: 'Combines parts into motors.' },
  turret: { name: 'Hydraulic Turret', short: 'TU', color: '#2f8f8f', hp: 150, cost: { iron_plate: 10, rivet: 6, copper_ingot: 2 }, blocking: true, description: 'Shoots enemies, but only with power: run a drive shaft to it. Arrives loaded; refill it with iron plates by belt.' },
  cannon: { name: 'Hydraulic Cannon', short: 'CA', color: '#1f6f5f', hp: 220, cost: { iron_plate: 15, gear: 5, rivet: 10 }, blocking: true, description: 'Splash damage, but only with power: run a drive shaft to it. Arrives loaded; refill it with gears by belt.' },
  turret2: { name: 'Turret Mk.2', short: 'T2', color: '#3a5a7a', hp: 260, cost: { steel: 12, steel_beam: 4, motor: 2 }, blocking: true, description: 'Fires bullets fast, but only with electricity from a power pole. Arrives loaded; refill it with bullets by belt.' },
  mortar: { name: 'Mortar', short: 'MO', color: '#4a5a4a', hp: 240, cost: { steel: 14, steel_beam: 6, bearing: 4 }, blocking: true, description: "Lobs shells over walls, hitting every bug where they land, with electricity from a power pole. It can't hit anything right next to it. Refill it with shells." },
  artillery: { name: 'Artillery', short: 'AR', color: '#3a4a3a', hp: 420, size: [2, 2], cost: { steel: 30, steel_beam: 16, bearing: 10, motor: 4 }, blocking: true, description: "A big gun that fires shells a very long way, with electricity from a power pole, but it can't hit anything close. Refill it with shells." },
  tesla: {
    name: 'Tesla Turret',
    short: 'TE',
    color: '#2f6f9f',
    hp: 160,
    cost: { steel: 8, circuit: 4, coil: 4 },
    blocking: true,
    description: 'Its shots arc from bug to bug. It needs no ammunition, only electricity from a power pole.',
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
  wall: { name: 'Brick Wall', short: '', color: '#6d6a66', hp: 400, cost: { brick: 3 }, blocking: true, description: 'Slows enemies down.' },
  reinforced_wall: { name: 'Reinforced Wall', short: '', color: '#5a5f66', hp: 900, cost: { brick: 4, iron_plate: 2, rivet: 4 }, blocking: true, description: 'Brick bound with iron: more than twice as tough as a brick wall.' },
  shield_pylon: { name: 'Shield Pylon', short: 'SP', color: '#3a6a9a', hp: 220, cost: { circuit: 6, coil: 6, steel_beam: 4 }, blocking: true, description: 'Shields the buildings around it: bites come off its shield first. The shield recharges with electricity from a power pole.' },
  railgun: { name: 'Railgun', short: 'RG', color: '#2f4a6a', hp: 450, size: [2, 2], cost: { steel_beam: 20, circuit: 10, coil: 10, bearing: 6 }, blocking: true, description: 'Fires a slug that goes through every bug in a long line. It needs no ammunition, only electricity from a power pole.' },
  drone_pad: { name: 'Drone Pad', short: 'DP', color: '#3a5a6a', hp: 160, cost: { circuit: 4, motor: 2, steel_beam: 2 }, blocking: true, description: 'With electricity, its drone flies items to pads that ask for them. Set to Send, belts fill it with one kind of item; set to receive an item, drones bring it and a belt leaving its front takes it out.' },
  arc_fence: { name: 'Arc Fence', short: '', color: '#3a6a8a', hp: 700, cost: { steel: 2, coil: 1, wire: 2 }, blocking: true, description: 'A wall that shocks the bugs biting it, with electricity from a power pole.' },
  floodlight: { name: 'Floodlight', short: '', color: '#d9c25a', hp: 80, cost: { circuit: 1, iron_rod: 4, wire: 4 }, blocking: false, description: `Lights the ground around it at night and slows bugs in its light, with electricity from a power pole. It sees far into the fog.` },
  steel_wall: { name: 'Steel Wall', short: '', color: '#4a5562', hp: 1600, cost: { steel: 4, steel_beam: 2 }, blocking: true, description: 'Steel plate on beams: the toughest wall.' },
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
  circuit_works: { name: 'Circuit Works', short: 'CW', color: '#2f6a4a', hp: 180, size: [2, 2], cost: { steel_beam: 8, wire: 20, motor: 2 }, blocking: true, description: 'Makes circuit boards from wire and iron plates, and coils from wire and iron rods. Works only with electricity from a power pole.' },
  steel_works: { name: 'Steel Works', short: 'SW', color: '#4b5563', hp: 180, size: [2, 2], cost: { steel: 10, brick: 12, gear: 6 }, blocking: true, description: 'Rolls steel into steel beams, and steel and gears into bearings.' },
  powder_mill: { name: 'Powder Mill', short: 'PM', color: '#6b5a3a', hp: 160, size: [2, 2], cost: { steel: 10, brick: 10, gear: 6 }, blocking: true, description: 'Grinds sulfur and charcoal into gunpowder.' },
  // Water power (D-095, D-113, D-115): sources turn drive shafts, which power belts.
  shaft: { name: 'Drive Shaft', short: '', color: '#7d8794', hp: 30, cost: { iron_rod: 1 }, blocking: false, description: 'Carries power from a well or water wheel to belts and anything touching it. Drag to lay a line.' },
  well: { name: 'Well', short: 'WE', color: '#4f7fa8', hp: 150, size: [2, 2], cost: { brick: 10, iron_plate: 6, iron_rod: 4 }, blocking: true, description: 'Draws groundwater anywhere to turn the drive shafts touching it. A little power.' },
  water_wheel: { name: 'Water Wheel', short: 'WW', color: '#3f74b0', hp: 160, size: [3, 1], cost: { plank: 20, iron_rod: 10, rivet: 20 }, blocking: true, description: 'Place with its front tile in a pond and the other two on land. Four times the power of a well.' },
  // Electricity (D-119, D-121): boilers by water feed steam turbines; poles carry the power.
  boiler: { name: 'Boiler', short: 'BO', color: '#7a5a48', hp: 200, size: [2, 2], cost: { steel: 10, brick: 20, iron_rod: 6 }, blocking: true, description: 'Burns logs or charcoal to make steam for the steam turbines it touches. Needs water: place it touching a well or a water wheel.' },
  steam_turbine: { name: 'Steam Turbine', short: 'ST', color: '#5d6a86', hp: 180, size: [2, 2], cost: { steel: 20, gear: 10, wire: 20 }, blocking: true, description: 'Turns steam from a boiler it touches into electricity, carried by power poles.' },
  power_pole: { name: 'Power Pole', short: '', color: '#8a6a44', hp: 40, cost: { iron_rod: 2, wire: 2, plank: 1 }, blocking: false, description: 'Carries electricity: links to poles nearby, and powers turbines and electric buildings close to it.' },
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
  storage: { name: 'Storage Unit', short: 'SU', color: '#5a6a7a', hp: 160, size: [1, 2], cost: { iron_plate: 12, rivet: 8 }, blocking: true, description: `Holds ${STORAGE.slots} stacks of up to ${STORAGE.stack} items, mixed. Belts fill it from the sides and back, and a belt leaving its front takes items out, first in, first out.` },
  storage_silo: { name: 'Storage Silo', short: 'SS', color: '#6a7a8a', hp: 300, size: [2, 2], cost: { steel: 20, steel_beam: 8, rivet: 10 }, blocking: true, description: `Holds ${SILO.slots} stacks of up to ${SILO.stack} items, mixed. Belts fill it from the sides and back, and a belt leaving its front takes items out, first in, first out.` },
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
  types: ['furnace', 'blacksmith', 'boiler'] as BuildingType[],
};
export const burnsFuel = (t: BuildingType): boolean => FUEL.types.includes(t);

export const MACHINE_TYPES: MachineType[] = ['furnace', 'workshop', 'assembler', 'sawmill', 'blacksmith', 'machine_shop', 'steel_works', 'powder_mill', 'circuit_works'];
export const isMachine = (t: BuildingType): t is MachineType => (MACHINE_TYPES as string[]).includes(t);

export interface TurretDef {
  /** What it fires; none for the tesla, which needs only electricity (D-125). */
  ammoItem?: ItemId;
  shotsPerItem: number;
  maxShots: number;
  range: number; // tiles
  rate: number; // shots per second
  damage: number;
  splash: number; // radius in tiles, 0 for single target
  /** Can't hit anything closer than this (the trebuchet, D-107). */
  minRange?: number;
  /** Railgun (D-129): the shot goes on to its full range, hitting every bug within this many tiles of its line. */
  pierce?: number;
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
  turret2: { ammoItem: 'bullet', shotsPerItem: 5, maxShots: 60, range: 6.5, rate: 6, damage: 7, splash: 0 },
  mortar: { ammoItem: 'shell', shotsPerItem: 1, maxShots: 12, range: 13, minRange: 3, rate: 0.5, damage: 45, splash: 1.8 },
  artillery: { ammoItem: 'shell', shotsPerItem: 1, maxShots: 10, range: 30, minRange: 8, rate: 0.2, damage: 100, splash: 2.6 },
  railgun: { shotsPerItem: 0, maxShots: 0, range: 18, minRange: 2, rate: 0.4, damage: 120, splash: 0, pierce: 0.6 },
  tesla: { shotsPerItem: 0, maxShots: 0, range: 5, rate: 1, damage: 12, splash: 0, chain: 2, chainRange: 2 },
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

/**
 * Water power (D-113, D-115, D-117). Sources give power; each belt, turret and cannon on a network uses
 * what `uses` says. A network short of power slows them all evenly: belts down to roller speed, and
 * hydraulic turrets and cannons fire more slowly, and not at all with no power.
 */
export const POWER = {
  sources: { well: 8, water_wheel: 32 } as Partial<Record<BuildingType, number>>,
  uses: { belt: 0.2, turret: 1, cannon: 2 } as Partial<Record<BuildingType, number>>,
};
/**
 * Electricity (D-119, D-121), a network of its own beside the drive shafts. A turbine with all the steam it
 * can use gives `turbine`; each building on the network uses what `uses` says, and a network short of it
 * slows them all evenly. Poles link to poles within `link` tiles (centre to centre) and connect anything
 * whose footprint comes within `reach` tiles of them; express belts pass it along their line, as belts do
 * with a shaft's power.
 */
export const ELECTRIC = {
  turbine: 60,
  uses: { express_belt: 0.5, turret2: 2, mortar: 2, artillery: 4, circuit_works: 3, tesla: 3, arc_fence: 0.25, floodlight: 1, drone_pad: 2, shield_pylon: 4, railgun: 6 } as Partial<Record<BuildingType, number>>,
  link: 6,
  reach: 2,
};
/** Machines that work only with electricity (D-125): at its share of their need, and not at all with none. */
export const ELECTRIC_MACHINES: BuildingType[] = ['circuit_works'];
/**
 * Mk2 machines (D-119, D-122): an extractor or furnace upgraded in place, for `cost`. With all the
 * electricity it needs (`uses`) it works `speed` times as fast; with less, proportionally less; with none, at
 * Mk1 speed.
 */
export const MK2 = {
  types: ['extractor', 'furnace'] as BuildingType[],
  cost: { steel_beam: 6, bearing: 4, motor: 2 } as ItemCounts,
  speed: 2,
  uses: 2,
};
/**
 * Mk3 machines (D-125, D-127): a Mk2 extractor or furnace, or an assembler (from Mk1), upgraded in place for
 * `cost`. With all the electricity it needs (`uses`) it works `speed` times as fast; with less, proportionally
 * less; with none, at Mk1 speed. `from` is the tier each type upgrades from.
 */
export const MK3 = {
  from: { extractor: 2, furnace: 2, assembler: 1 } as Partial<Record<BuildingType, number>>,
  cost: { circuit: 6, coil: 4, steel_beam: 4 } as ItemCounts,
  speed: 3,
  uses: 4,
};

/** What the boiler's water comes from: it has to touch one (D-121). */
export const WATER_SOURCES: BuildingType[] = ['well', 'water_wheel'];

/** Defences that fire only with power (D-117). */
export const HYDRAULIC: BuildingType[] = ['turret', 'cannon'];
/** Defences that fire only with electricity (D-123). */
export const ELECTRIC_DEFENCES: BuildingType[] = ['turret2', 'mortar', 'artillery', 'tesla', 'railgun'];
/**
 * The Arc Fence (D-126): a wall that shocks each bug biting it for `dps`, scaled by its electricity. The
 * Floodlight: at night, with electricity, bugs within `radius` of it move at `slow` of their speed; it sees
 * `sight` tiles into the fog.
 */
export const ARC_FENCE = { dps: 30 };
/**
 * Drone pads (D-125, D-128): each holds up to `hold` of one item. A pad set to Send has one drone, which
 * flies up to `load` items at `speed` tiles a second to the nearest pad within `range` asking for them, and
 * flies home. Both pads need electricity.
 */
export const DRONES = { hold: 40, load: 8, speed: 5, range: 24 };
export const FLOODLIGHT = { radius: 7, slow: 0.6, sight: 14 };
/**
 * The Shield Pylon (D-129): bites on buildings whose footprint comes within `radius` tiles of it come off its
 * shield (up to `max`, kept in `Building.ammo`) first. It recharges `recharge` a second times its electricity.
 */
export const SHIELD = { radius: 5, max: 600, recharge: 10 };
/**
 * What carries power: shafts and sources to anything touching them, belts to belts beside them. Hydraulic
 * defences too, so a row of turrets shares one shaft.
 */
export const CONDUCTS: BuildingType[] = ['shaft', 'well', 'water_wheel', 'belt', 'splitter', 'tunnel', ...HYDRAULIC];

/** Sulfur (D-123): small deposits, none closer than `minDist` tiles to the hub's centre. */
export const SULFUR = { count: 18, minDist: 45, radius: [1.6, 2.8] as [number, number] };

/** Ponds (D-095): small lakes, none closer than `minDist` tiles to the hub's centre. */
export const PONDS = { count: 16, minDist: 30, radius: [2.2, 4.2] as [number, number] };
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
  { id: 'hydraulics', name: 'Hydraulics', cost: { iron_plate: 80, iron_rod: 40, brick: 20 }, time: 45, requires: ['blacksmith'], unlocks: ['well', 'water_wheel', 'shaft'], description: 'Wells and water wheels turn drive shafts, which power belts.' },
  // The id stays 'logistics' so saves keep it (D-115).
  { id: 'logistics', name: 'Metal Logistics', cost: { iron_plate: 60, iron_rod: 40, brick: 20 }, time: 45, requires: ['hydraulics'], unlocks: ['belt', 'splitter', 'tunnel', 'storage'], description: 'Powered belts, splitters, underground belts and the Storage Unit. A belt without power rolls only at roller speed.' },
  // The Iron Age's defences (D-113, D-117): hydraulic, so they come after Hydraulics. Ids kept, so saves keep them.
  { id: 'defense', name: 'Advanced Defense', cost: { iron_plate: 40, copper_ingot: 20, rivet: 20, brick: 20 }, time: 45, requires: ['hydraulics'], unlocks: ['turret', 'wall'], description: 'Hydraulic turrets that fire iron plates, with power from a drive shaft, and brick walls to slow and steer enemies.' },
  { id: 'ordnance', name: 'Advanced Defense 2', cost: { iron_plate: 100, brick: 80, gear: 50, rivet: 40 }, time: 120, requires: ['defense', 'machine_shop'], unlocks: ['cannon', 'reinforced_wall'], description: 'Hydraulic cannons with splash damage that fire gears, and reinforced walls.' },
  // The Wood Age's defences (D-089, D-107). Ids kept from before, so saves keep them.
  { id: 'palisades', name: 'Basic Defense', cost: { plank: 30, rope: 10 }, time: 30, requires: ['rollers', 'workshop'], unlocks: ['palisade', 'spike_pit'], description: 'Palisades, cheap wooden walls, and spike pits, traps bugs walk over.' },
  { id: 'defense2', name: 'Basic Defense 2', cost: { log: 100, plank: 100, rope: 200, truss: 50 }, time: 120, requires: ['palisades', 'carpentry'], unlocks: ['trebuchet', 'ballista'], description: 'Trebuchets that hurl stone a long way, and ballistae that fire stakes.' },
  { id: 'plating', name: 'Chitin Plating', cost: { chitin: 10, iron_plate: 20 }, time: 45, requires: ['defense'], unlocks: [], effect: 'plating', description: 'Turrets, walls and palisades get half as much health again. Chitin comes from destroyed nests.' },
  { id: 'rollers', name: 'Basic Logistics', cost: { log: 20, plank: 20, dowel: 50 }, time: 45, requires: ['forestry'], unlocks: ['roller', 'crate'], description: 'Wooden rollers carry items in single file without power, and storage crates hold 50 of one item.' },
  { id: 'workshop', name: 'Workshops', cost: { plank: 40, log: 20 }, time: 45, requires: ['forestry'], unlocks: ['workshop'], description: 'Workshops make pegs from dowels and rope from logs.' },
  { id: 'carpentry', name: 'Carpentry', cost: { plank: 60, peg: 40, rope: 20 }, time: 60, requires: ['workshop'], unlocks: [], description: 'Workshops can make trusses from planks, pegs and rope.' },
  { id: 'distribution', name: 'Distribution', cost: { iron_plate: 25, copper_ingot: 10 }, time: 60, requires: ['defense'], unlocks: ['port'], description: 'Hub ports put stock from the hub back onto belts.' },
  // The Steam Age (D-119): Engineering opens it, after the Iron Age's top defence.
  { id: 'engineering', name: 'Engineering', cost: { motor: 30, gear: 100, brick: 60 }, time: 120, requires: ['assembly', 'ordnance'], unlocks: [], description: 'Opens the Steam Age: steel, steam turbines and electricity, and heavy guns.' },
  { id: 'steelmaking', name: 'Steelmaking', cost: { iron_plate: 100, charcoal: 60 }, time: 60, requires: ['engineering', 'charcoal'], unlocks: [], description: 'Furnaces can make steel from iron plates and charcoal.' },
  { id: 'steel_works', name: 'Steel Works', cost: { steel: 80, gear: 40, motor: 20 }, time: 90, requires: ['steelmaking'], unlocks: ['steel_works'], description: 'Steel works roll steel into steel beams, and make bearings from steel and gears.' },
  { id: 'steam_power', name: 'Steam Power', cost: { steel: 60, iron_rod: 40, brick: 30 }, time: 90, requires: ['steelmaking'], unlocks: ['boiler', 'steam_turbine', 'power_pole'], description: 'Boilers and steam turbines make electricity, and power poles carry it.' },
  { id: 'express_logistics', name: 'Express Logistics', cost: { steel: 60, motor: 20 }, time: 90, requires: ['steam_power'], unlocks: ['express_belt', 'storage_silo'], description: 'Express belts, twice as fast as belts, run on electricity. The Storage Silo holds twelve stacks of 100.' },
  { id: 'heavy_defense', name: 'Heavy Defense', cost: { steel: 60, motor: 30, gear: 50 }, time: 120, requires: ['steelmaking', 'steam_power'], unlocks: ['powder_mill', 'turret2', 'steel_wall'], description: 'The Turret Mk.2, which fires bullets with electricity, and steel walls. Powder mills grind sulfur and charcoal into gunpowder; casings come from the Steel Works and bullets from the Assembler.' },
  { id: 'heavy_defense2', name: 'Heavy Defense 2', cost: { steel_beam: 100, casing: 80, gunpowder: 60 }, time: 150, requires: ['heavy_defense', 'steel_works'], unlocks: ['mortar', 'artillery'], description: 'Mortars and artillery, electric guns that fire shells over walls and a long way. Shells come from the Assembler.' },
  { id: 'hull', name: 'Hull', cost: { steel_beam: 60, bearing: 30, motor: 20 }, time: 120, requires: ['engineering'], unlocks: [], description: "The ship's Steam Age stage: its steel hull, built in the shipyard after the launch pad." },
  { id: 'mk2', name: 'Mk2 Machines', cost: { steel_beam: 60, bearing: 40, motor: 20 }, time: 120, requires: ['steel_works', 'steam_power'], unlocks: [], description: 'Upgrade extractors and furnaces in place: with electricity, they work twice as fast.' },
  // The Electric Age (D-125): Electronics opens it, after the Steam Age's top defence.
  { id: 'electronics', name: 'Electronics', cost: { steel_beam: 100, bearing: 60, motor: 40 }, time: 150, requires: ['mk2', 'heavy_defense2'], unlocks: [], description: 'Opens the Electric Age: circuit boards and coils, drones, Mk3 machines and electric defences.' },
  { id: 'circuit_works', name: 'Circuit Works', cost: { steel_beam: 80, wire: 120, bearing: 40 }, time: 120, requires: ['electronics'], unlocks: ['circuit_works'], description: 'Circuit works make circuit boards and coils, with electricity.' },
  { id: 'mk3', name: 'Mk3 Machines', cost: { circuit: 80, coil: 40, steel_beam: 60 }, time: 150, requires: ['circuit_works', 'mk2'], unlocks: [], description: 'Upgrade Mk2 extractors and furnaces, and assemblers, to Mk3: with electricity, they work three times as fast.' },
  { id: 'ship_systems', name: 'Ship Systems', cost: { circuit: 120, coil: 60, motor: 40, steel: 100 }, time: 180, requires: ['electronics', 'hull'], unlocks: [], description: "The ship's Electric Age stages: its engines, life support and navigation, built in the shipyard after the hull. Then it can launch." },
  { id: 'electric_defense2', name: 'Electric Defense 2', cost: { circuit: 100, coil: 60, bearing: 40 }, time: 150, requires: ['electric_defense'], unlocks: ['shield_pylon', 'railgun'], description: 'Shield pylons, which take the bites for the buildings around them, and railguns, whose slugs go through a whole line of bugs.' },
  { id: 'drones', name: 'Drone Logistics', cost: { circuit: 60, motor: 40 }, time: 120, requires: ['circuit_works'], unlocks: ['drone_pad'], description: 'Drone pads: drones fly items from pads that send to pads that ask for them, with electricity, without belts.' },
  { id: 'electric_defense', name: 'Electric Defense', cost: { circuit: 60, wire: 100, coil: 30 }, time: 120, requires: ['circuit_works'], unlocks: ['tesla', 'arc_fence', 'floodlight'], description: 'Tesla turrets, whose shots arc from bug to bug on electricity alone; arc fences, walls that shock bugs biting them; and floodlights, which slow bugs at night.' },
  { id: 'assembly', name: 'Assembly', cost: { gear: 30, wire: 30 }, time: 120, requires: ['machine_shop'], unlocks: ['assembler'], description: 'Combine parts into motors.' },
  { id: 'repair', name: 'Field Repair', cost: { gear: 20, wire: 20 }, time: 90, requires: ['defense', 'machine_shop'], unlocks: ['repair'], description: 'Stations that repair nearby buildings.' },
  { id: 'launch_pad', name: 'Launch Pad', cost: { iron_plate: 60, brick: 60, rivet: 30 }, time: 60, requires: ['blacksmith', 'shipyard'], unlocks: [], description: "The ship's Iron Age stage: a brick and iron launch pad, built in the shipyard after the scaffolding." },
  { id: 'shipyard', name: 'Shipyard', cost: { plank: 80, truss: 20, rope: 20 }, time: 90, requires: ['carpentry'], unlocks: ['shipyard'], description: 'A dock where you can build a ship to carry supplies to the colony.' },
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
  /** A research the stage needs before the shipyard takes its parts (D-118). */
  research?: string;
}

export const SHIP = {
  stages: [
    // One stage per age (D-089); the Wood Age's is the scaffolding (D-109).
    { id: 'scaffold', name: 'Scaffolding', items: { plank: 150, truss: 40, rope: 60 } },
    { id: 'pad', name: 'Launch pad', items: { brick: 120, iron_plate: 80, rivet: 60, iron_rod: 40 }, research: 'launch_pad' }, // the Iron Age's (D-118)
    { id: 'hull', name: 'Hull', items: { steel: 120, steel_beam: 60, bearing: 30, motor: 20 }, research: 'hull' }, // the Steam Age's (D-124)
    // The Electric Age's three (D-130), after Ship Systems.
    { id: 'engine', name: 'Engine', items: { motor: 40, coil: 60, steel_beam: 40, bearing: 30 }, research: 'ship_systems' },
    { id: 'life', name: 'Life support', items: { circuit: 80, steel: 60, wire: 120 }, research: 'ship_systems' },
    { id: 'nav', name: 'Navigation', items: { circuit: 100, coil: 40, motor: 20 }, research: 'ship_systems' },
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

/** None for now: the Tesla moved into the tree (D-126); special buildings come later (D-125). */
export const BLUEPRINTS: Blueprint[] = [];
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
export const PLATING = { bonus: 1.5, types: ['turret', 'cannon', 'turret2', 'mortar', 'artillery', 'railgun', 'shield_pylon', 'steel_wall', 'arc_fence', 'ballista', 'tesla', 'trebuchet', 'wall', 'reinforced_wall', 'palisade'] as BuildingType[] };

/** What lives in a nest `distance` tiles from the hub: further out is more dangerous. */
export function nestComposition(distance: number): { crawlers: number; runners: number; brutes: number; hpMult: number } {
  return {
    crawlers: 3 + Math.floor(distance / 45),
    runners: distance > 60 ? 1 + Math.floor((distance - 60) / 40) : 0,
    brutes: distance > 100 ? 1 + Math.floor((distance - 100) / 50) : 0,
    hpMult: 1 + distance / 150,
  };
}
