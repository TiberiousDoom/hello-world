# The research tree in four ages (planned)

The research tree as decided on 2026-10-26 (D-089). It replaces today's tree step by step; nothing here is
built yet. [GAME_DESIGN.md](GAME_DESIGN.md) still describes the game as it is on `master`.

It came from the owner's version ("More wood") in the shared research tree, worked through with
playtesters, and the answers on the decisions page. Costs marked *to set* need a balance pass; the
others are first guesses to test.

## The rules of the tree

- **Four ages**, each built from its own material, with its own power and its own weapons:

  | Age | Material | Power | Weapons | Opened by |
  |---|---|---|---|---|
  | **Wood Age** | logs, planks and wooden parts | none: rollers | palisades, spike pits, trebuchets, ballistae | the start |
  | **Iron Age** | iron, copper, brick | water: wells and pumps | hydraulic turrets and cannons | Industry |
  | **Steam Age** | steel and motors | steam: boilers | Turret Mk.2 (bullets), mortars and artillery (shells) | Engineering |
  | **Electric Age** | circuits and coils | electricity | tesla, shield pylons, arc fences | Electronics |

- **Each age has the same parts:** a keystone research, logistics in its own material, a shop for small
  parts, a shop for parts made from parts (Iron Age on), a machine tier, a ship stage, and two defence
  tiers.
- **A keystone needs its age's top defence** (plus anything its cost needs): hold your ground before you
  move on.
- **A research never costs something its needs can't make.** Each research lists only its direct needs.
- **Every item has one home** (one building that makes it).
- **Each age's first defence gives a weapon and a wall** together.
- **Defences upgrade from Tier 1 to Tier 4** with materials from the engineer's inventory (#87), so the
  inventory comes first. Chitin from destroyed nests is an upgrade material; Chitin Plating goes.

## Wood Age

The start. Nothing is smelted yet: furnaces and extractors arrive with Industry.

| Research | Gives | Costs | Needs |
|---|---|---|---|
| Forestry | Lumber Camp, Sawmill (planks, dowels, stakes) | 15 logs | — |
| Basic Logistics | Wooden Roller, storage crate | 20 logs, 20 planks, 50 dowels | Forestry |
| Workshops | Workshop (pegs, rope) | 40 planks, 20 logs | Forestry |
| Carpentry | Truss recipe (planks, pegs, rope) | 60 planks, 40 pegs, 20 rope | Workshops |
| Basic Defense | Palisade, spike pit | about 30 planks, 10 rope | Basic Logistics, Workshops |
| Basic Defense 2 | Trebuchet (throws stone), Ballista (fires stakes) | 100 logs, 100 planks, 200 rope, 50 trusses | Basic Defense, Carpentry |
| Shipyard | Shipyard (5×5) and the ship's scaffolding | *to set* (planks, trusses) | Carpentry |

- **Rollers carry no power.** Items on a roller line are pushed along by the items behind them, so a line
  only moves while something feeds it.
- The first defence is cheap, so it's ready before the first raid; the big wooden costs are tier 2.
- Stone for the trebuchet is mined by hand in the Wood Age, and by extractors later.

## Iron Age

| Research | Gives | Costs | Needs |
|---|---|---|---|
| **Industry** (keystone) | Furnace, Extractor; iron plates, copper ingots, bricks | 100 planks, 50 trusses, 50 stone | Basic Defense 2 |
| Hydraulics | Well, pump, pipes, drive shafts (power for belts and hydraulic defences) | 80 iron plates, 40 iron rods, 20 bricks | Industry |
| Metal Logistics | Powered Belt, Splitter, Underground Belt, Storage Unit | 60 iron plates, 40 iron rods, 20 bricks | Hydraulics |
| Blacksmith | Blacksmith (iron rods, rivets; plates from iron ingots) | 60 iron plates, 30 bricks | Industry |
| Machine Shop | Machine Shop (gears, copper wire) | 80 iron plates, 40 rivets, 20 copper | Blacksmith |
| Advanced Defense | Hydraulic Turret (fires iron plates), Brick Wall | 40 iron plates, 20 copper, 20 rivets, 20 bricks | Hydraulics |
| Advanced Defense 2 | Hydraulic Cannon (fires gears), Reinforced Wall | 100 iron plates, 80 bricks, 50 gears, 40 rivets | Advanced Defense, Machine Shop |
| Field Repair | Repair Station | 20 gears, 20 wire | Advanced Defense, Machine Shop |
| Distribution | Hub Port | 25 iron plates, 10 copper | Industry |
| Charcoal | Charcoal recipe | 40 logs, 20 iron plates | Industry |
| Assembly | Assembler (motors) | 30 gears, 30 wire | Machine Shop |
| Launch Pad | The ship's launch pad | *to set* (iron, bricks) | Industry |

- **Fuel:** furnaces and the Blacksmith burn logs, or charcoal once it's researched (it burns longer).
- **Wells and pumps work anywhere**, drawing groundwater; the map needs no rivers.
- Masonry goes: the brick wall comes with Advanced Defense. Chitin Plating goes (see tiers).

## Steam Age

| Research | Gives | Costs | Needs |
|---|---|---|---|
| **Engineering** (keystone) | Opens the age | 30 motors, 100 gears, 60 bricks | Assembly, Advanced Defense 2 |
| Steelmaking | Steel recipe | 100 iron plates, 60 charcoal | Engineering, Charcoal |
| Steam Power | Boiler, steam engine (burn charcoal or logs) | 60 steel, 40 iron rods, 30 bricks | Steelmaking |
| Express Logistics | Express Belt (steam-driven), Storage Silo | 60 steel, 20 motors | Steam Power |
| Steel Works | Steel Works (steel beams, bearings) | 80 steel, 40 gears, 20 motors | Steelmaking |
| Mk2 Machines | Faster extractors and furnaces | 60 steel beams, 40 bearings, 20 motors | Steel Works, Steam Power |
| Heavy Defense | Turret Mk.2 (fires bullets), Steel Wall; bullets, casings, gunpowder | 60 steel, 30 motors, 50 gears | Steelmaking |
| Heavy Defense 2 | Mortar and Artillery (fire shells); shells | 100 steel beams, 80 casings, 60 gunpowder | Heavy Defense, Steel Works |
| Hull | The ship's hull | *to set* (steel, motors) | Engineering |

## Electric Age

| Research | Gives | Costs | Needs |
|---|---|---|---|
| **Electronics** (keystone) | Opens the age | 100 steel beams, 60 bearings, 40 motors | Mk2 Machines, Heavy Defense 2 |
| Electric Power | Generator, power poles | 80 steel, 60 wire, 20 motors | Electronics |
| Circuit Works | Circuit Works (circuit boards, coils) | 80 steel beams, 120 wire, 40 bearings | Electronics |
| Drone Logistics | Conveyor Drone Pad, logistics network | 60 circuit boards, 40 motors | Electric Power, Circuit Works |
| Mk3 Machines | Electric extractors, furnaces and assemblers | 80 circuit boards, 40 coils, 60 steel beams | Electric Power, Circuit Works |
| Electric Defense | Tesla Turret (fed by wire), Floodlights | 60 circuit boards, 100 wire, 30 coils | Electric Power, Circuit Works |
| Electric Defense 2 | Shield Pylon, Arc Fence | 100 circuit boards, 60 coils, 40 bearings | Electric Defense |
| Ship Systems | The ship's engines, life support and navigation; launch | *to set* (circuits, motors, steel) | Electronics |

## The ship

- **One stage per age:** scaffolding (Wood), launch pad (Iron), hull (Steam), then engines, life support
  and navigation (Electric). The ship launches in the Electric Age, so it is the goal that runs through
  the whole game. Its costs are substantial.
- **The shipyard takes a 5×5 footprint** (3×3 today). On the map the ship is drawn **top-down**, like
  everything else. Tapping it opens a window with a **detailed side view** of the ship, showing each stage
  as it's built.
- **Supply runs** start after the launch. They reward **blueprints for things left out of the tree**:
  cosmetics and special buildings. The Express Belt, Tesla, Mortar, Shield Pylon, Storage Silo and Drone
  Pad move from blueprints into the tree.

## New items

About fifteen, added age by age with the age that uses them:

- **Wood Age:** dowels, stakes, rope, pegs, trusses (stakes exist today).
- **Iron Age:** iron ingots, iron rods, rivets.
- **Steam Age:** steel beams, bearings, bullets, casings, gunpowder, shells.
- **Electric Age:** circuit boards, coils.

## Building it

Age by age, each playtested before the next:

1. ✅ **The engineer's inventory** (#87, 0.46.0, D-090), which defence upgrades need.
2. **Wood Age:** rollers, the Workshop and Carpentry, the wooden defences, the 5×5 shipyard with its
   top-down ship and side view, and smelting moved to Industry. Today's later researches stay as they are
   behind Industry until their age is built.
3. **Iron Age:** water power, powered belts, the Blacksmith and Machine Shop, fuel, hydraulic defences.
4. **Steam Age:** steam, steel parts, gunpowder weapons, the hull.
5. **Electric Age:** electricity, circuits, drones, electric defences, launch and supply runs.

Each step changes saved games: a save migration grants an age's keystone to a game that already
researched something in it, and refunds researches that are removed.

## Still open

- Costs and timings: a balance pass per age (the roadmap's balance script would help).
- What each defence tier improves, and what it costs.
- How rollers, power, fuel and pipes look and feel in play; each needs its own design before it's built.
- Ore distance (Q-21) and fog of war (Q-20) are separate questions.
