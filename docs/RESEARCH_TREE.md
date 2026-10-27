# The research tree in four ages (planned)

The research tree as decided on 2026-10-26 (D-089). It replaces today's tree step by step: the Wood and
Iron Ages are built, and so is the Steam Age; the Electric Age is under way. [GAME_DESIGN.md](GAME_DESIGN.md) describes the game as it is on `master`.

It came from the owner's version ("More wood") in the shared research tree, worked through with
playtesters, and the answers on the decisions page. Costs marked *to set* need a balance pass; the
others are first guesses to test.

## The rules of the tree

- **Four ages**, each built from its own material, with its own power and its own weapons:

  | Age | Material | Power | Weapons | Opened by |
  |---|---|---|---|---|
  | **Wood Age** | logs, planks and wooden parts | none: rollers | palisades, spike pits, trebuchets, ballistae | the start |
  | **Iron Age** | iron, copper, brick | water: wells and pumps | hydraulic turrets and cannons | Industry |
  | **Steam Age** | steel and motors | electricity: boilers, steam turbines, power poles | Turret Mk.2 (bullets), mortars and artillery (shells) | Engineering |
  | **Electric Age** | circuits and coils | electricity (from the Steam Age), drones | tesla, shield pylons, arc fences | Electronics |

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
| Forestry | Lumber Camp (8 logs), Sawmill (14 logs); planks, dowels, stakes | 15 logs, chopped by hand | — |
| Basic Logistics | Wooden Roller (one lane), storage crate (50 of one item) | 20 logs, 20 planks, 50 dowels | Forestry |
| Workshops | Workshop (pegs, rope) | 40 planks, 20 logs | Forestry |
| Carpentry | Truss recipe (planks, pegs, rope) | 60 planks, 40 pegs, 20 rope | Workshops |
| Basic Defense | Palisade, spike pit | about 30 planks, 10 rope | Basic Logistics, Workshops |
| Basic Defense 2 | Trebuchet (throws stone, range about 24), Ballista (fires stakes) | 100 logs, 100 planks, 200 rope, 50 trusses | Basic Defense, Carpentry |
| Shipyard | Shipyard (5×5) and the ship's scaffolding (150 planks, 40 trusses, 60 rope) | 80 planks, 20 trusses, 20 rope | Carpentry |

- The first defence is cheap, so it's ready before the first raid; the big wooden costs are tier 2.

### How the Wood Age plays (D-093)

Decided on the Wood Age decisions page. Numbers are first guesses to test.

**The start**
- **Chopping by hand:** like mining. With no tool in hand, tap a tree; the engineer walks over, and 8 taps
  fell it for 2 logs. It leaves a stump that grows back, like a lumber camp's, about 3 times before the
  ground stays clear (D-094).
- **Forestry (15 logs)** opens both first buildings, paid in wood: the Lumber Camp (8 logs) and the
  Sawmill (14 logs; planks can't be paid before the first sawmill, D-103).
- **Stone and ore:** all of them can be mined by hand from the start, at least 20 tiles from the hub (D-097). Iron and copper ore wait in the hub
  until Industry; stone is the trebuchet's ammunition and part of Industry's cost.
- **The first lesson is rewritten around wood:** chop trees, research Forestry, build a lumber camp and a
  sawmill, lay rollers to the hub. A later lesson covers Industry (furnaces, extractors, plates).

**Rollers**
- **Slow rolling, faster when pushed:** items roll on their own at a third of belt speed. A well-fed line
  packs up and then moves at the rate items go on. Rollers carry no power.
- **One lane**, items in single file. Rollers are drawn **narrower than belts**. Two lanes come with powered
  belts in the Iron Age.
- **No splitting or crossing** until the Iron Age (splitters and underground belts come with Metal
  Logistics). A roller can still feed into the side of another.
- **The storage crate:** 1×1, holds 50 of one item. Rollers feed it; a roller leaving its front takes items
  out; Collect and Drop off work on it. The Storage Unit (6 slots of 50) is its Iron Age upgrade.

**Defence**
- **The hub's gun stays as it is** (8 tiles, no ammunition) until Basic Defense, which is cheap enough to be
  ready by the first raid on the second night.
- **The spike pit:** a 1×1 trap bugs walk over (it doesn't block). It hurts and slows bugs on it, wears down
  as it works, and is refilled with stakes.
- **The trebuchet:** 2×2, throws stone with splash damage, slow to fire. Range about 24, with a blind spot
  inside 6 tiles, so it needs other defences close in.

**The ship**
- **The shipyard's site is staked out from the start** (D-098): a 5×5 site within 15 tiles of the hub, and
  the yard is built there once Shipyard is researched. The hub grows to 8×8.
- **Saved games with a 3×3 shipyard:** it's refunded and the ship's progress kept; the player builds the
  5×5 yard where it fits, and the ship carries on.
- **The scaffolding stage** costs about 150 planks, 40 trusses and 60 rope, belted or dropped off into the
  shipyard, like stages today.

**Building it**
- **Art:** placeholders in the current style (SVGs), each listed in ART_LIST for final art: the dowel, rope,
  peg and truss items, rollers and their corners, the crate, the spike pit, the trebuchet, the 5×5 shipyard,
  the top-down ship and its side view.
- **Order, each playtested:**
  1. ✅ The start (0.47.0, D-103): chopping, Forestry paid in logs, smelting moved to Industry, the new
     lesson. Until step 2, Industry cost 40 planks and 30 stone and needed only Forestry.
  2. ✅ Wooden parts (0.48.0, D-105): dowels (sawmill), pegs and rope (workshop), trusses (workshop, after
     Carpentry); the Workshop costs wood and keeps making gears and wire until the Machine Shop. Industry
     now costs 100 planks, 50 trusses and 50 stone, and needs Carpentry (Basic Defense 2 joins in step 4).
  3. ✅ Rollers and the crate (0.49.0, D-106): rollers roll at a third of belt speed, and at belt speed
     while packed (2 or more items on a tile); one lane, drawn narrower than belts. The crate holds 50 of
     one item, sends them out of its front, and takes Collect and Drop off.
  4. ✅ The spike pit and the trebuchet (0.50.0, D-107): Palisades became Basic Defense (palisades and
     spike pits, 30 planks and 10 rope, after Basic Logistics and Workshops); Ballistae went into Basic
     Defense 2 (trebuchet and ballista), which Industry now needs; turrets are Advanced Defense until the
     Iron Age's hydraulic turret.
  5. ✅ The 5×5 shipyard and the scaffolding stage (0.51.0, D-109), on a site staked out at the start, with
     the ship top-down on the map and a side view on tap; the 8×8 hub (0.51.0, D-108).

## Iron Age

| Research | Gives | Costs | Needs |
|---|---|---|---|
| **Industry** (keystone) | Furnace, Extractor; iron plates, copper ingots, bricks | 100 planks, 50 trusses, 50 stone | Basic Defense 2 |
| Hydraulics | Well, pump, Water Wheel (at a pond, D-095), pipes, drive shafts (power for belts and hydraulic defences) | 80 iron plates, 40 iron rods, 20 bricks | Industry |
| Metal Logistics | Powered Belt, Splitter, Underground Belt, Storage Unit | 60 iron plates, 40 iron rods, 20 bricks | Hydraulics |
| Blacksmith | Blacksmith (plates and rods from iron ingots, rivets from rods) | 50 iron ingots, 30 stone (D-113) | Industry |
| Machine Shop | Machine Shop (gears, copper wire) | 80 iron plates, 40 rivets, 20 copper | Blacksmith |
| Advanced Defense | Hydraulic Turret (fires iron plates), Brick Wall | 40 iron plates, 20 copper, 20 rivets, 20 bricks | Hydraulics |
| Advanced Defense 2 | Hydraulic Cannon (fires gears), Reinforced Wall | 100 iron plates, 80 bricks, 50 gears, 40 rivets | Advanced Defense, Machine Shop |
| Field Repair | Repair Station | 20 gears, 20 wire | Advanced Defense, Machine Shop |
| Distribution | Hub Port | 25 iron plates, 10 copper | Industry |
| Charcoal | Charcoal recipe | 40 logs, 20 iron plates | Industry |
| Assembly | Assembler (motors) | 30 gears, 30 wire | Machine Shop |
| Launch Pad | The ship's launch pad | 60 iron plates, 60 bricks, 30 rivets (D-118) | Blacksmith, Shipyard |

- **Fuel:** furnaces and the Blacksmith burn logs, or charcoal once it's researched (it burns longer).
- **Wells and pumps work anywhere**, drawing groundwater. Ponds (30+ tiles from the hub) take a Water Wheel,
  a stronger source (D-095).
- **Ore runs out** (D-096): each ore tile holds 1200; extractors over more ore tiles make more.
- Masonry goes: the brick wall comes with Advanced Defense. Chitin Plating goes (see tiers).

### How the Iron Age plays (D-113)

The owner's answers, 2026-10-26. Numbers are first guesses to test.

- **Iron (#87):** furnaces smelt iron ore into **iron ingots**. The **Blacksmith** (2×2) hammers ingots
  into **plates** or **rods**, and rods into **rivets**. So Blacksmith comes first in the age, paid in
  ingots and stone, and everything that costs plates comes after it.
- **Gears and wire** move from the Workshop to the **Machine Shop** (2×2).
- **Power: drive shafts.** Wells and water wheels turn shafts, laid like belts. Everything touching a
  connected shaft shares that network's power; short of power, it all slows evenly. A line of belts passes
  power along itself, so one shaft touching a line powers it.
- **Sources:** a small **Well** (2×2) works anywhere; the **Water Wheel** (1×3, one tile in a pond) gives
  much more. No pumps and no water pipes.
- **Powered belts without power** roll at roller speed (a third of belt speed): running short slows the
  factory instead of freezing it.
- **Fuel is needed:** furnaces and the Blacksmith burn logs, or charcoal once researched (it burns
  longer), fed by belt like any input into a small fuel store. Out of fuel, they stop. Furnaces in old saves
  start with a full store.
- **Hydraulic defences:** today's turret and cannon become the Hydraulic Turret and Hydraulic Cannon. They
  **don't fire without power**, so a cut shaft leaves a gap.
- **Order, each playtested:**
  1. ✅ Iron (0.55.0): ingots, the Blacksmith (plates, rods, rivets), the Machine Shop (gears, wire), the
     Smelting lesson rewritten.
  2. ✅ Fuel (0.56.0, D-114): furnaces and the Blacksmith burn logs (8 s) or charcoal (24 s) from a 48 s
     store, and stop without it; the Charcoal research opens the charcoal recipe.
  3. ✅ Water power (0.57.0, D-115): ponds, wells, the Water Wheel, drive shafts and powered belts;
     Logistics becomes Metal Logistics, after Hydraulics.
  3b. ✅ The Storage Unit (0.58.0, D-116): 1×2, six stacks of 50, mixed, first in, first out.
  4. ✅ Hydraulic defences (0.59.0, D-117): the turret and cannon need power, and don't fire without it;
     the brick wall moves to Advanced Defense (Masonry goes) and the Reinforced Wall comes with Advanced
     Defense 2, which replaces Heavy Ordnance.
  5. ✅ The launch pad (0.60.0, D-118), the ship's Iron Age stage: 120 bricks, 80 plates, 60 rivets and 40
     rods, after the scaffolding, once Launch Pad is researched.

## Steam Age

| Research | Gives | Costs | Needs |
|---|---|---|---|
| **Engineering** (keystone) | Opens the age | 30 motors, 100 gears, 60 bricks | Assembly, Advanced Defense 2 |
| Steelmaking | Steel recipe | 100 iron plates, 60 charcoal | Engineering, Charcoal |
| Steel Works | Steel Works (steel beams, bearings) | 80 steel, 40 gears, 20 motors | Steelmaking |
| Steam Power | Boiler, Steam Turbine, Power Pole: electricity (D-119) | 60 steel, 40 iron rods, 30 bricks | Steelmaking |
| Express Logistics | Express Belt (electric), Storage Silo | 60 steel, 20 motors | Steam Power |
| Mk2 Machines | Extractors and furnaces upgraded in place (electric) | 60 steel beams, 40 bearings, 20 motors | Steel Works, Steam Power |
| Heavy Defense | Turret Mk.2 (electric, fires bullets), Steel Wall; sulfur, gunpowder (Powder Mill), casings, bullets | 60 steel, 30 motors, 50 gears | Steelmaking, Steam Power |
| Heavy Defense 2 | Mortar and Artillery (electric, fire shells); shells | 100 steel beams, 80 casings, 60 gunpowder | Heavy Defense, Steel Works |
| Hull | The ship's hull | 60 steel beams, 30 bearings, 20 motors (D-124) | Engineering |

### How the Steam Age plays (D-119)

The owner's answers, 2026-10-27. Numbers are first guesses to test.

- **Electricity comes in the Steam Age.** A **Boiler** burns logs or charcoal from a fuel store, like a
  furnace, and needs water: it goes touching a well or a water wheel. A **Steam Turbine** beside it turns the
  steam into electricity. One turbine runs many machines, so keeping boilers fed is the age's new job.
- **Power poles** carry electricity: each pole links to poles within about 6 tiles, and powers buildings
  within about 2 tiles of it. No lines to lay tile by tile.
- **What runs on electricity:** the Steam Age's own kit: Mk2 machines, express belts, the Turret Mk.2, the
  mortar and artillery. Belts and hydraulic defences stay on water power and drive shafts, so an Iron Age
  base keeps working as it is.
- **Gunpowder** is charcoal and **sulfur**, a new yellow ore on the map that extractors mine. A **Powder Mill**
  mixes them; the Steel Works makes **casings**, and the Assembler puts casings and gunpowder together into
  **bullets** and **shells**.
- **Mk2 machines upgrade in place:** select an extractor or furnace and tap Upgrade, paying steel beams and
  bearings. Same footprint, faster, keeps what it holds, needs electricity to run at Mk2 speed.
- **The Express Belt and the Mortar move into the tree** (Express Logistics and Heavy Defense 2), running on
  electricity. Games that already have the Express Belt blueprint keep it; the colony offers other blueprints
  instead.
- **Order, each playtested:**
  1. ✅ Engineering, steel and the Steel Works (0.61.0, D-120): the keystone, Steelmaking (the steel recipe
     needs it now), and the Steel Works with steel beams and bearings.
  2. ✅ Steam Power and Express Logistics (0.62.0, D-121): the boiler, the steam turbine, power poles and the
     electric network, and the express belt on it.
  3. ✅ Mk2 Machines and the Storage Silo (0.63.0, D-122): extractors and furnaces upgraded in place, twice as
     fast on electricity; the silo holds 12 stacks of 100.
  4. ✅ Heavy Defense (0.64.0, D-123): sulfur deposits, the Powder Mill, casings and bullets, the electric Turret
     Mk.2 and the steel wall.
  5. ✅ Heavy Defense 2 and the hull (0.65.0, D-124): the electric mortar and artillery, shells, and the steel
     hull, the ship's Steam Age stage.

## Electric Age

Electricity itself now comes with the Steam Age's turbines (D-119), so Electric Power goes; the age brings
circuits, drones, Mk3 machines and electric defences, all on the Steam Age's power poles.

| Research | Gives | Costs | Needs |
|---|---|---|---|
| **Electronics** (keystone) | Opens the age | 100 steel beams, 60 bearings, 40 motors | Mk2 Machines, Heavy Defense 2 |
| Circuit Works | Circuit Works (circuit boards, coils; electric) | 80 steel beams, 120 wire, 40 bearings | Electronics |
| Drone Logistics | Drone Pad: pad-to-pad delivery by drone (electric) | 60 circuit boards, 40 motors | Circuit Works |
| Mk3 Machines | Mk2 extractors and furnaces, and assemblers, upgraded in place to Mk3 (electric) | 80 circuit boards, 40 coils, 60 steel beams | Circuit Works |
| Electric Defense | Tesla Turret (electric, no ammunition), Arc Fence, Floodlights | 60 circuit boards, 100 wire, 30 coils | Circuit Works |
| Electric Defense 2 | Shield Pylon, Railgun | 100 circuit boards, 60 coils, 40 bearings | Electric Defense |
| Ship Systems | The ship's engines, life support and navigation; launch | *to set* (circuits, coils, motors, steel) | Electronics |

### How the Electric Age plays (D-125)

The owner's answers, 2026-10-27. Numbers are first guesses to test.

- **Everything new runs on electricity** from the Steam Age's turbines and poles, starting with the
  **Circuit Works**, which makes **circuit boards** and **coils** from wire.
- **Drones deliver pad to pad.** A **Drone Pad** fed by a belt sends its item by drone to pads set to request
  that item, within a range. Logistics without belts, using electricity.
- **Mk3 machines upgrade in place**, as Mk2 did: a Mk2 extractor or furnace becomes Mk3 (three times as fast),
  and the assembler gets its first upgrade, straight to Mk3. All need electricity to run at speed.
- **Electric Defense** gives a weapon and a wall together: the **Tesla Turret** moves into the tree and runs on
  electricity alone, with no ammunition; the **Arc Fence** is a wall that shocks bugs biting it; and
  **Floodlights** light the ground around them at night, lifting the fog and slowing bugs in their beam.
- **Electric Defense 2:** the **Shield Pylon** puts a shield on buildings around it that soaks damage and
  recharges from electricity, and the **Railgun** is the age's heavy weapon.
- **Ship Systems**, one research, gates the engines, life support and navigation, whose parts change to
  circuits, coils and steel. So the first launch needs the Electric Age.
- **Supply runs** reward **special buildings** outside the tree once the Tesla has moved into it. Their list is
  for the owner to approve before that step.
- **Order, each playtested:**
  1. ✅ Electronics and the Circuit Works (0.66.0): the keystone, circuit boards and coils.
  2. ✅ Electric Defense (0.67.0, D-126): the electric Tesla, the Arc Fence and Floodlights.
  3. Mk3 Machines.
  4. Drone Logistics: drone pads.
  5. Electric Defense 2: the Shield Pylon and the Railgun.
  6. Ship Systems and the launch.
  7. Special buildings from supply runs.

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
2. ✅ **Wood Age** (decided, D-093; all five steps done in 0.47.0 to 0.51.0; see [How the Wood Age plays](#how-the-wood-age-plays-d-093)): the start,
   wooden parts, rollers and the crate, the spike pit and trebuchet, then the 5×5 shipyard. Today's later
   researches stay as they are behind Industry until their age is built.
3. ✅ **Iron Age** (decided, D-113; see [How the Iron Age plays](#how-the-iron-age-plays-d-113)): ✅ the
   Blacksmith and Machine Shop (0.55.0), ✅ fuel (0.56.0), ✅ water power and powered belts (0.57.0), ✅ the Storage Unit (0.58.0), ✅ hydraulic defences (0.59.0), ✅ the
   launch pad (0.60.0). The Iron Age is built.
4. ✅ **Steam Age** (decided, D-119; see [How the Steam Age plays](#how-the-steam-age-plays-d-119)): ✅ Engineering,
   steel and the Steel Works (0.61.0), ✅ steam turbines, electricity and express belts (0.62.0), ✅ Mk2 machines and the Storage Silo (0.63.0), ✅ gunpowder
   and the Turret Mk.2 (0.64.0), ✅ the mortar, artillery and hull (0.65.0). The Steam Age is built.
5. **Electric Age** (decided, D-125; see [How the Electric Age plays](#how-the-electric-age-plays-d-125)): ✅ Electronics
   and the Circuit Works (0.66.0), ✅ Electric Defense (0.67.0); next Mk3 machines.

Each step changes saved games: a save migration grants an age's keystone to a game that already
researched something in it, and refunds researches that are removed.

## Still open

- Costs and timings: a balance pass per age (the roadmap's balance script would help).
- What each defence tier improves, and what it costs.
- How power, fuel and pipes look and feel in play; each needs its own design before it's built (rollers are
  decided, D-093).
- Fog of war (D-099) and finite ore (D-096) are decided and built separately; finite ore needs the balance
  pass to check that a game can still reach launch.
