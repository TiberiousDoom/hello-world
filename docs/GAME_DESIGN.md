# Game design

How the game works on `master` today. Balance numbers live in
`src/sim/data.ts`, which wins if this doc disagrees with it.

## Core loop

1. Cut trees with **lumber camps**, and mine ore with **extractors** once Industry is researched. At the
   very start, chop trees and mine by hand (see [Starting from nothing](#starting-from-nothing)).
2. Carry them on **belts** to machines that turn them into parts.
3. Deliver items to the **hub**. Its stock pays for buildings and research.
4. **Research** (in the hub) unlocks new buildings.
5. Expand carefully: **bug territories** dot the map, and their bugs attack if provoked.
6. Research the **Shipyard**, build it on the site staked out near the hub, build the supply ship, then load it and launch it again and again to supply the colony.

## Map

- A **256×256** tile grid, generated procedurally from a seed (the same seed gives the same map; D-038).
- **Ore fields** come from layered value noise: irregular patches of iron (about 5% of the map),
  copper and stone (about 3.5% each). **No ore lies within 20 tiles of the hub's edge** (D-097); a starter
  patch of each ore sits just beyond that, about 21 to 28 tiles out, so the first trips to mine by hand are
  a real walk.
- **Ore runs out (D-096):** each ore tile holds **1,200 ore**; mining by hand and extractors both take
  from it, and once it's used up the tile is bare ground. Touching tiles of one ore are drawn as one
  patch, on a shared bed of earth.
- **Forest (D-044):** about 14% of the map is trees, in noise-shaped woods. Trees never grow on ore,
  and none grow within 20 tiles of the hub's centre. A small grove (radius 3) sits just outside that
  clearing, so the first Lumber Camp is close by. See [Wood](#wood).
- **Sulfur (D-123):** about 18 small deposits of yellow **sulfur**, none within 45 tiles of the hub's centre,
  mined like ore. It goes into gunpowder.
- **Ponds (D-095, D-115):** about 16 small, ragged lakes, none within 30 tiles of the hub's centre, with no
  ore or trees on them. Nothing is built on water except a Water Wheel's front tile; engineers walk round
  ponds, and bugs wade through them slowly (a pond costs them 4 times a dry tile).
- The **8×8 hub** sits in the centre (5×5 before D-108).
- **Fog of war (D-099, D-112):** the map is hidden under the dark of the forest until something sees it,
  in 4×4-tile cells with a soft edge. The hub sees 36 tiles from its middle (past the starter ore), your
  engineer 9 tiles around them as they walk, and every other building 5 tiles past its edge (turrets and
  other towers their range more). Explored ground stays explored. In co-op it's shared: what one engineer
  finds, everyone sees. It's only the view: buildings can be placed and turrets fire into it, and bugs
  walk out of it. Numbers are in `FOG` in `src/sim/data.ts`.
- **Bug territories:** the map is divided into 10×10 cells. About 18% of the cells whose nearest tile is
  at least 30 tiles from the hub's centre hold a nest (roughly 100 per map). See [Bugs](#bugs).
- Hub stock is shown just above the hub, as part of the map, **only while the hub is selected or the
  mouse is over it** (D-053); it scrolls away with the hub. While the mouse is over the panel itself (or a
  finger is down on it), it fades almost completely, so it never hides the map above the hub.

## Items and recipes

| Item | Made in | From | Time |
|---|---|---|---|
| Iron ore, copper ore, stone, sulfur | Extractor | ore under it | 1.5 s |
| Iron ingot | Furnace | 1 iron ore | 1.6 s |
| Copper ingot | Furnace | 1 copper ore | 1.6 s |
| Brick | Furnace | 2 stone | 2 s |
| Iron plate | Blacksmith | 1 iron ingot | 1.5 s |
| Iron rod ×2 | Blacksmith | 1 iron ingot | 1.5 s |
| Rivet ×4 | Blacksmith | 1 iron rod | 1.5 s |
| Gear | Machine Shop | 2 iron plates | 2 s |
| Copper wire ×2 | Machine Shop | 1 copper ingot | 1.5 s |
| Motor | Assembler | 1 gear + 2 wire + 1 iron plate | 4 s |
| Log ×2 | Lumber Camp | 1 tree in reach | 3 s |
| Plank ×2 | Sawmill | 1 log | 1.5 s |
| Stake ×3 | Sawmill | 1 plank | 1.5 s |
| Dowel ×4 | Sawmill | 1 plank | 1.5 s |
| Peg ×2 | Workshop | 1 dowel | 1.5 s |
| Rope | Workshop | 2 logs | 3 s |
| Truss | Workshop (after Carpentry) | 3 planks + 2 pegs + 1 rope | 4 s |
| Charcoal | Furnace (after Charcoal) | 2 logs | 2.5 s |
| Steel | Furnace (after Steelmaking) | 2 iron plates + 1 charcoal | 3 s |
| Steel beam | Steel Works | 2 steel | 3 s |
| Bearing ×2 | Steel Works | 1 steel + 1 gear | 3 s |
| Gunpowder ×2 | Powder Mill | 1 sulfur + 1 charcoal | 3 s |
| Casing ×4 | Steel Works (after Heavy Defense) | 1 steel | 2 s |
| Bullets | Assembler (after Heavy Defense) | 1 casing + 1 gunpowder | 2 s |
| Chitin | Destroyed nest mounds | — | — |

A machine picks its recipe from the first input it receives, or the player
picks one in its info panel. A recipe that needs a research (the truss needs Carpentry) isn't offered,
or picked, until it's done. Changing the recipe discards inputs it has already received.

**Fuel (D-114):** furnaces and blacksmiths burn **logs** (8 s each) or **charcoal** (24 s each), fed by
belt, roller or Drop off like any input, into a fuel store of **48 s**. They burn only while working, and
**stop when it runs out**. A new one arrives with a full store. Fuel never picks a recipe; a furnace making
charcoal takes logs as its input first and burns what's left over. An orange bar on the building shows the
store, and a flashing mark shows one that has run out. Other machines take no fuel.

## Buildings

| Building | Size | Cost | HP | Unlocked by |
|---|---|---|---|---|
| Belt | 1×1 | 1 iron plate | 30 | Metal Logistics |
| Extractor | 2×2 | 4 stone, 4 iron ore | 80 | Industry |
| Furnace | 2×2 | 6 stone | 120 | Industry |
| Hydraulic Turret | 1×1, needs power | 10 iron plates, 6 rivets, 2 copper ingots | 150 | Advanced Defense |
| Ballista | 1×1 | 10 planks, 4 rope | 140 | Basic Defense 2 |
| Trebuchet | 2×2 | 40 planks, 10 rope, 8 trusses | 220 | Basic Defense 2 |
| Brick Wall | 1×1 | 3 bricks | 400 | Advanced Defense |
| Reinforced Wall | 1×1 | 4 bricks, 2 iron plates, 4 rivets | 900 | Advanced Defense 2 |
| Workshop | 2×2 | 10 planks, 6 logs | 120 | Workshops |
| Blacksmith | 2×2 | 10 stone, 6 iron ingots | 140 | Blacksmith |
| Machine Shop | 2×2 | 10 iron plates, 10 rivets, 4 bricks | 140 | Machine Shop |
| Steel Works | 2×2 | 10 steel, 12 bricks, 6 gears | 180 | Steel Works |
| Powder Mill | 2×2 | 10 steel, 10 bricks, 6 gears | 160 | Heavy Defense |
| Turret Mk.2 | 1×1, needs electricity | 12 steel, 4 steel beams, 2 motors | 260 | Heavy Defense |
| Steel Wall | 1×1 | 4 steel, 2 steel beams | 1600 | Heavy Defense |
| Hub Port | 1×1 | 10 iron plates, 5 copper ingots | 120 | Distribution |
| Splitter | 1×2 | 3 iron plates, 1 copper ingot | 40 | Metal Logistics |
| Underground Belt | 1×1 | 4 iron plates, 1 brick | 40 | Metal Logistics |
| Drive Shaft | 1×1 | 1 iron rod | 30 | Hydraulics |
| Well | 2×2 | 10 bricks, 6 iron plates, 4 iron rods | 150 | Hydraulics |
| Water Wheel | 3×1, front tile in a pond | 20 planks, 10 iron rods, 20 rivets | 160 | Hydraulics |
| Assembler | 3×3 | 10 gears, 10 wire | 150 | Assembly |
| Repair Station | 1×1 | 10 iron plates, 4 gears, 6 wire, 4 planks | 150 | Field Repair |
| Hydraulic Cannon | 1×1, needs power | 15 iron plates, 5 gears, 10 rivets | 220 | Advanced Defense 2 |
| Express Belt | 1×1, needs electricity | 1 iron plate, 1 gear | 40 | Express Logistics |
| Boiler | 2×2, touching a well or water wheel | 10 steel, 20 bricks, 6 iron rods | 200 | Steam Power |
| Steam Turbine | 2×2, touching a boiler | 20 steel, 10 gears, 20 wire | 180 | Steam Power |
| Power Pole | 1×1 | 2 iron rods, 2 wire, 1 plank | 40 | Steam Power |
| Storage Silo | 2×2 | 20 steel, 8 steel beams, 10 rivets | 300 | Express Logistics |
| Tesla Turret | 1×1 | 12 iron plates, 6 copper ingots, 10 wire | 160 | Colony blueprint |
| Shipyard | 5×5, on its site only | 60 planks, 10 trusses, 20 logs | 900 | Shipyard |
| Lumber Camp | 2×2 | 8 logs | 100 | Forestry |
| Sawmill | 2×2 | 14 logs | 100 | Forestry |
| Palisade | 1×1 | 2 planks | 160 | Basic Defense |
| Spike Pit | 1×1 | 10 stakes, 2 planks | 60 | Basic Defense |
| Wooden Roller | 1×1 | 1 plank, 1 dowel | 20 | Basic Logistics |
| Storage Crate | 1×1 | 6 planks, 4 pegs | 60 | Basic Logistics |
| Storage Unit | 1×2 | 12 iron plates, 8 rivets | 160 | Metal Logistics |

- Sizes are width × depth when facing east (the first number runs along the direction the building
  faces). Turning a building sideways swaps them, and a placed building only turns if its new footprint is free.
- Bigger buildings centre on the tile you pick.
- Building costs are paid from hub stock. Demolishing a building refunds its
  cost, scaled by the HP it has left.
- **Hub:** 8×8 (D-108), 1,000 HP. Accepts any item from any side. **Select it to open Research.**
  It has a **built-in gun**: 9 damage, 1.2 shots/s, range 8 from its centre, and no ammo needed.

## Logistics rules

- **Wooden rollers** (D-106, Basic Logistics) come before belts. They have **one lane**: items go in
  single file down the middle, and are drawn on a narrow wooden frame. Items roll on their own at
  **0.5 tiles/s** (a third of a belt); a roller holding **2 or more** items is being pushed and moves
  them at belt speed, so a busy line packs up and keeps up with what goes on it, up to about **265 items a
  minute**. Rollers are laid, turned and fed like belts, and can join a line from the side. There is no
  splitting or crossing with rollers: splitters and underground belts come with the Iron Age.
- **Storage crate** (1×1, D-106): holds up to **50 of one item**. Rollers or belts fill it from any side
  but its front; it sends its items out of its front onto a roller or belt there. **Collect** takes what
  fits in the engineer's inventory, and **Drop off** puts items in.
- **Storage Unit** (1×2, #87, D-116): its Iron Age upgrade. It holds **6 stacks of up to 50**, of any mix
  of items (300 in all), takes them from the back and sides, and sends them out of its front, first in,
  first out, onto a belt or roller there. Collect and Drop off work as on the crate.
- **The Storage Silo** (D-122, Express Logistics) is the same with **12 stacks of 100** (1200 items) on a 2×2
  footprint.
- **Water power (D-113, D-115, D-117):** belts, turrets and cannons need power. A **Well** (anywhere) gives
  **8** power and a **Water Wheel** (its front tile in a pond, the other two on land) gives **32**; each belt
  uses **0.2**, each hydraulic turret **1** and each hydraulic cannon **2**, so a well runs 40 belts or 8
  turrets. Power travels through **drive shafts** (laid in lines like belts) and anything touching them:
  every shaft, source, belt, splitter, underground belt, turret and cannon that touches another is on the
  same network, and an underground pair carries it across. A network with less power than it uses slows
  everything on it evenly: belts slow down, and turrets and cannons fire more slowly. A belt with no power
  at all rolls at **roller speed** (0.5 tiles/s); a turret or cannon with none doesn't fire, and flashes a
  blue mark. Selecting a belt, shaft, source or turret shows its network's power and use. Rollers, express
  belts, the hub's gun, ballistae, trebuchets and tesla turrets need no power.
- **Belts** move 1.5 tiles/s when powered and have **two lanes** side by side (#61, D-069), each holding about 3
  items per tile, so a belt line carries up to about **530 items a minute** (an express belt about
  1,060). A belt accepts items from any side except the tile it points into. An item reaching the end
  of a belt carries straight on onto the next one, at an even speed (#49).
- **Lanes:** buildings (extractors, machines, lumber camps, hub ports) put items onto a belt's **right
  lane** (right as you look the way it runs). A belt feeding into another from the side puts its items
  onto the **near lane**; coming from behind, round a corner, through an underground belt or a splitter,
  items keep their lane. Machines and the hub take from both lanes.
- **Electricity (D-119, D-121):** a **Boiler** burns logs or charcoal (a 48 s store, fed like a furnace's) and
  needs water: it goes touching a **well** or a **water wheel**. A **Steam Turbine** touching a working boiler
  makes **60** electricity; a boiler touching two turbines shares its steam between them. **Power poles** carry
  it: each links to poles within **6** tiles, and connects turbines and electric buildings within **2** tiles of
  it (a 5×5 square, shown while placing or selecting one). Express belts pass it along their line, each using
  **0.5**, so a turbine runs 120 express belts. Short of electricity, everything on the network slows evenly.
  It's a network of its own: belts and hydraulic defences stay on drive shafts.
- **Express belts** (Express Logistics, after Steam Power) work the same way at 3 tiles/s with electricity, and at
  roller speed without it.
- **Mk2 machines (D-122):** after **Mk2 Machines**, select an extractor or furnace and press **Upgrade to Mk2**
  (6 steel beams, 4 bearings, 2 motors). It stays where it is with what it holds, gets a gold plate, and uses
  **2** electricity: with all of it, it works **twice as fast**; short of it, proportionally less; with none, at
  Mk1 speed. Demolishing it refunds the upgrade too. A furnace's fuel lasts the same time, so Mk2 smelts twice as
  much per log. They can be laid like belts,
  but the quick way is to **tap or click an existing belt with the Express Belt selected: its whole line
  is upgraded in place**, with no ✓ step on touch. The line is every belt joined to the tapped one,
  belt-to-belt in either direction (side merges included), up to any other building such as a splitter,
  tunnel or machine. Each belt keeps its facing and items, and the old belt's plate is refunded, so an
  upgrade costs 1 gear. Hovering a belt with the tool outlines the line, red where stock runs out; with
  too little stock, the belts nearest the tap are upgraded first.
- **Machines and extractors** output from the **middle of the side their arrow marks** (for an even
  width, the tile left of centre as seen facing out). A small port with an arrow shows the spot.
  Machines accept input on any tile of any side, and buffer up to 3 crafts' worth of each input.
- **Extractors** need ore under at least one tile of their base, and mine whichever ore covers most of it.
  Every 1.5 s an extractor takes **one ore from each tile of that ore under it**: 1 to 4 a cycle, so one
  set squarely on a patch makes 4 times as much (D-096). Its panel shows how much ore is left under it;
  used up, it stands idle.
- **Splitters** (1×2, #34) span two belts side by side. They accept items from directly behind either
  belt, and send them out of the front of both in turn, skipping a blocked one. Items keep their lane.
- **Splitter filter (#62):** select a splitter, pick an item and **← Left** or **Right →**. That item
  goes out of that side only, and everything else out of the other. With **Off**, the sides take turns.
- **Two kinds stay apart (#92, D-104):** with no filter, when both belts into a splitter carry an item
  (each within the last 5 s) and the two are different, each item goes straight out of its own side.
  When one belt stops, or both carry the same item, the sides take turns again.
- **Dropping a splitter onto a belt (#63):** it faces along the belt, and its second half goes on the
  side of the belt your pointer or finger is nearer (the other side if that one is blocked). Dropped
  between two parallel belts, it replaces both.
- **Underground belts** pair an entrance with the next tunnel placed up to 5
  tiles ahead in the same direction. Exits accept no input. Items in transit
  are lost if either end is removed.
- **Choosing the exit (#64):** after you place an entrance, its exit appears as a blueprint at the first
  free tile past whatever is in the way (or two tiles on, if nothing is). Tap ✓ (or click it) to build
  it, or drag it along the line, up to 5 tiles ahead, first.
- **Going under things automatically (#65, #93):** a belt line dragged straight across anything in its
  way goes under it: belts running the other way, any other building (walls, machines), and trees (D-102).
  The tiles just before and after become an underground belt's entrance and exit, and you pay for both.
  The blueprint shows them. If you can't afford both, or the gap is longer than an underground belt
  reaches (5 tiles), the line is built up to the obstacle and stops there (the blueprint shows the rest
  in red). Rollers have no underground: a roller line stops at what's in its way.
- **Hub ports** must touch the hub, and always face away from it. Each port
  takes a chosen item out of hub stock, one every 0.5 s, and puts it on a belt.
  A docking collar joins it to the hub, with items visibly streaming out while it sends.
- **Building onto belts (D-037):** any building except a belt can be placed onto a belt line with a
  single click or tap (not a drag). Its footprint may cover belts (and empty ground); those belts are
  refunded, the building faces the way the belt under the tap ran, and it takes any items they carried.
  Because bigger buildings centre on the tapped tile, a dropped-in machine's input and output line up
  with the belt row, so it starts working at once.
- **Lining up with belts while aiming (D-053):** a single placement (a click or tap, not a drag) of an
  extractor, lumber camp, furnace, workshop, assembler, sawmill or splitter next to belts lines itself up
  with them. Among the facings and positions that cover the aimed tile, it picks the one where its output
  runs onto a belt (best), and a belt runs into it (better still if it then faces the way that belt runs,
  carrying the flow straight on). The player's own facing wins a tie. The preview shows the result.
  Turning the building (Rotate, R or the mouse wheel) overrides this until another tool is picked: the
  first turn starts from the facing the preview showed, and from then on the building keeps the
  player's facing, sliding only to line up. A turned building dropped onto a belt keeps its facing too
  (#85, D-088).

## Wood

Wood runs out for a while (D-044), and for good after a while (D-094). The ship's hull doesn't use it, but later supply runs carry planks.

- **Engineers and bugs walk under the trees** (#95): the canopy is drawn over them. An engineer under a tree
  shows through faintly, so it isn't lost.
- **Chopping by hand (D-093):** with no tool in hand, tap a tree. Like mining, the engineer walks over,
  and **8 taps** fell it for **2 logs**, with wood chips and a chop on each tap. The tree leaves a stump
  that grows back, like a lumber camp's. There must be room for both logs in the inventory.
- **Trees block building.** Every building, belts included, needs tree-free ground. Underground belts
  can still pass under trees.
- A **Lumber Camp** (2×2) must have at least one tree or stump within **4 tiles** of its centre. Every
  3 s it cuts the nearest tree in reach into **2 logs**, and outputs them like an extractor. It waits
  while its output is full, and goes idle when nothing in reach is grown.
- A cut tree leaves a **stump**, which grows back into a tree after **2 to 4 minutes** (3 on average,
  at random, so a grove grows back gradually and a camp's logs come steadily, #50). Stumps don't block
  building: building over one clears it for good. So a camp can clear land, or keep cutting the same
  woods as they regrow, but only so long: **a tree grows back 3 times**, and when it's cut a fourth time
  the ground stays clear (D-094). Forests thin out over a long game, so camps move outward.
- The **Sawmill** (2×2 machine) turns 1 log into 2 planks.
- The **Palisade** is a cheap wooden wall: 2 planks, 160 HP (a stone wall has 400). It's laid in lines
  like walls. Walls and palisades join up with their neighbours, with their own corners and ends.
- Selecting a camp shows its reach, and how many trees and regrowing stumps it has.
- **Wood in the economy (D-054):** a Sawmill can also saw planks into **stakes**, the ammo for the
  **Ballista**, and refill **spike pits** (both from the Wood Age's defences, D-107). **Repair stations** burn planks as well as
  iron plates. The **Workshop**, **Repair Station** and **Shipyard** cost a few planks, so Workshops
  research needs Forestry. Its wooden parts are in [Wooden parts](#items-and-recipes) (D-105). A **furnace** burns 2 logs into **charcoal**, and, after Steelmaking, makes **steel** from
  2 iron plates and 1 charcoal. Steel is cargo for the fourth supply run on, and the material for upgrades
  to come.
- Still to come: forest that matters to bugs ([ROADMAP.md](ROADMAP.md)).

## Research

You start with nothing to build (D-093): Forestry, paid in logs chopped by hand, comes first, then
Industry for extractors and furnaces. Everything is researched, except colony blueprints, which come
from supply runs. **Select the hub** and press **Research** to open the list.

- **Start** a research, and it draws its items from hub stock at a steady pace over its research
  time. For example, Advanced Defense takes 20 iron plates over 30 s.
- If the hub runs out of an item it needs, the research **stalls** until more arrives.
- Only one research is active at a time. **Switching** keeps what's already been put in, and
  **Pause** stops drawing. The hub's panel shows the active research and its progress.

| Research | Items | Time | Needs | Unlocks |
|---|---|---|---|---|
| Forestry | 15 logs | 20 s | — | Lumber Camp, Sawmill |
| Workshops | 40 planks, 20 logs | 45 s | Forestry | Workshop (pegs, rope) |
| Carpentry | 60 planks, 40 pegs, 20 rope | 60 s | Workshops | The truss recipe |
| Industry | 100 planks, 50 trusses, 50 stone | 90 s | Carpentry, Basic Defense 2 | Extractor, Furnace |
| Blacksmith | 50 iron ingots, 30 stone | 45 s | Industry | Blacksmith (plates, rods, rivets) |
| Machine Shop | 80 iron plates, 40 rivets, 20 copper | 60 s | Blacksmith | Machine Shop (gears, wire) |
| Charcoal | 40 logs, 20 iron plates | 45 s | Blacksmith | The charcoal recipe (a fuel that lasts three times as long as a log) |
| Hydraulics | 80 iron plates, 40 iron rods, 20 bricks | 45 s | Blacksmith | Well, Water Wheel, Drive Shaft |
| Metal Logistics | 60 iron plates, 40 iron rods, 20 bricks | 45 s | Hydraulics | Belt, Splitter, Underground Belt, Storage Unit |
| Advanced Defense | 40 iron plates, 20 copper, 20 rivets, 20 bricks | 45 s | Hydraulics | Hydraulic Turret, Brick Wall |
| Advanced Defense 2 | 100 iron plates, 80 bricks, 50 gears, 40 rivets | 120 s | Advanced Defense, Machine Shop | Hydraulic Cannon, Reinforced Wall |
| Basic Defense | 30 planks, 10 rope | 30 s | Basic Logistics, Workshops | Palisade, Spike Pit |
| Basic Defense 2 | 100 logs, 100 planks, 200 rope, 50 trusses | 120 s | Basic Defense, Carpentry | Trebuchet, Ballista |
| Basic Logistics | 20 logs, 20 planks, 50 dowels | 45 s | Forestry | Wooden Roller, Storage Crate |
| Chitin Plating | 10 chitin, 20 iron plates | 45 s | Advanced Defense | Turrets, walls and palisades get 1.5× health (built ones too) |
| Distribution | 25 iron plates, 10 copper | 60 s | Advanced Defense | Hub Port |
| Assembly | 30 gears, 30 wire | 120 s | Machine Shop | Assembler |
| Engineering | 30 motors, 100 gears, 60 bricks | 120 s | Assembly, Advanced Defense 2 | Opens the Steam Age |
| Steelmaking | 100 iron plates, 60 charcoal | 60 s | Engineering, Charcoal | The steel recipe |
| Steel Works | 80 steel, 40 gears, 20 motors | 90 s | Steelmaking | Steel Works (steel beams, bearings) |
| Steam Power | 60 steel, 40 iron rods, 30 bricks | 90 s | Steelmaking | Boiler, Steam Turbine, Power Pole |
| Express Logistics | 60 steel, 20 motors | 90 s | Steam Power | Express Belt, Storage Silo |
| Mk2 Machines | 60 steel beams, 40 bearings, 20 motors | 120 s | Steel Works, Steam Power | Upgrade extractors and furnaces to Mk2 |
| Heavy Defense | 60 steel, 30 motors, 50 gears | 120 s | Steelmaking, Steam Power | Powder Mill, Turret Mk.2, Steel Wall; casings and bullets |
| Field Repair | 20 gears, 20 wire | 90 s | Advanced Defense, Machine Shop | Repair Station |
| Shipyard | 80 planks, 20 trusses, 20 rope | 90 s | Carpentry | Shipyard |
| Launch Pad | 60 iron plates, 60 bricks, 30 rivets | 60 s | Blacksmith, Shipyard | The ship's launch pad stage |

The hub starts empty.

## Day, night and seasons

Always on (#42, D-068). It all follows from game time, so it's saved and the same in co-op. Numbers are
in `CLOCK` in `src/sim/data.ts`; the clock is `src/sim/clock.ts`.

- **A day** is 6 minutes of daylight and 3 of night (9 minutes in all). Dusk and dawn each fade over
  30 s. A game starts on the first morning of spring.
- **Night:** the map darkens to a deep blue, with pools of light around the hub, your engineer,
  turrets, repair stations and working machines. **Bugs range further:** a provoked nest's bugs keep chasing
  while something is within **28 tiles** of them (20 by day), and a building within **5 tiles** of a calm
  bug provokes its nest (3 by day).
- **Seasons**, a 12-day (108-minute) year:

  | Season | Days | Tree regrowth | Look |
  |---|---|---|---|
  | Spring | 4 (36 min) | 1.5× faster | Fresh green grass and trees |
  | Summer | 2 (18 min) | 2× faster | A warm light; a few broadleaf trees already turning |
  | Fall | 4 (36 min) | 0.75× (slower) | Leaf litter on the ground, orange trees and bronze pines |
  | Winter | 2 (18 min) | 0.5× (slowest) | Snow on the ground, bare frosted trees and snowy pines; grass and flowers are under the snow |

  A stump's regrowth time is set by the season it's cut in.
- **Seasons fade in (D-111):** over the last day of each season the land turns to the next one's look.
  Trees change one by one, each at its own moment; the ground and the light cross-fade; snow covers the
  grass and flowers bit by bit. Coming out of winter, flowers come back in the first half of that day and
  leaves in the second. Only the look changes: the rules (tree regrowth) change on the day the season does.
- **Shadows (D-101, D-111):** buildings and trees cast shadows that move with the sun. The sun rises on the
  right (east), crosses the south and sets on the left, so shadows point left in the morning, a little up
  and short at midday, and right in the evening, growing long towards dusk. At night the moon casts
  fainter ones the same way; each fades out as the light changes over at dusk and dawn. Belts, rollers
  and spike pits are flat and cast none.
- A message marks nightfall, each morning and each new season, and the top bar shows the season, the
  day and a sun or moon (its tooltip says how long until morning or nightfall).
- Each new season plays its own short piece of music (see [Music](#music)).

## Your engineer

You have a character, an engineer (#40, D-067), who starts just below the hub. Numbers are in `PLAYER`
in `src/sim/data.ts`; the rules are in `src/sim/player.ts`.

- **Walking:** with no tool in hand, tap or click empty ground and the engineer walks there (4 tiles a
  second), around walls, machines and nest mounds; belts can be walked over. A ring marks where it's
  going. On a keyboard, **WASD or the arrow keys** walk it directly, and the camera follows. If
  something is built across its way, it stops.
- **Reach:** it mines and hands things over within **1.5 tiles**. Tapping ore, Collect, Pick up and
  Drop off send it over first if it's too far, and it does the job on arriving.
- **Inventory (#87, D-090):** **12 slots**, each holding up to **10** of one item (120 in all). An item
  goes on a stack of its kind first, then into the first empty slot. Mining by hand, **Collect** and
  **Pick up** fill it; when it's full, mining stops with a message and Collect leaves what doesn't fit.
  One of each filled slot trails behind the engineer. The **Inventory** button at the right end of the
  toolbar (or **I**) opens a small window with the slots, in the place of the building panel.
- **Pick up:** a selected belt, splitter or underground belt with items on it has **Pick up**: the
  engineer takes the items off it, front first, as many as fit.
- **Dropping off:** walking up to the **hub** empties the inventory into it, unless "Drop off at the hub
  when I walk up to it" is switched off in the Inventory window (each player has their own switch).
  **Drop off** (on a selected machine, turret, repair station, shipyard or the hub) hands that building
  whatever it takes of what's held, slot by slot.
- **Bugs notice the engineer (D-074).** The engineer has **100 health**. Walking within 3 tiles of a
  calm bug (5 at night) provokes its nest, as a building would. An angry bug (or a raider) within
  **4 tiles** of the engineer goes straight for them, and bites as hard as it bites
  buildings. Health comes back at 5 a second once nothing has bitten for 5 s. A health bar shows when
  hurt, with a red flash and a hit sound on each bite.
- **Knocked out:** at 0 health the engineer loses everything in the inventory and gets back on
  their feet below the hub **10 s** later, at full health. Until then they can't walk, mine, collect or
  drop off. Building still works.
- In co-op each player has their own engineer (see Playing together).

## Starting from nothing

A new game starts with an empty hub, nothing to build and no belts (#38, D-062). The Wood Age comes first
(D-093). The first minutes go:

1. **Chop trees by hand.** With no tool in hand, tap or click a tree. The engineer walks over, and every
   **8 taps** in a row fell it for **2 logs**, which it carries; a ring around the tile fills with each
   tap. Holding the finger or mouse button down taps **4 times a second**. Tapping another tile, or
   **3 s** without a tap, starts the count over. Dragging from there pans, as usual. With a full
   inventory, chopping stops and a message says so. Ore and stone are mined by hand the same way, one at
   a time, with sparks and a pickaxe sound.
2. **Carry it to the hub** and research **Forestry** (15 logs): it unlocks the **Lumber Camp** (8 logs)
   and the **Sawmill** (14 logs).
3. **Collect by hand.** Select a machine, extractor or lumber camp and press **Collect**: the engineer
   fetches its finished items (up to 3), to carry to the hub. A building's output passes straight into a
   building in front of it, so a sawmill at a camp's arrow saws its logs.
4. **Rollers (D-106):** research **Basic Logistics** (20 logs, 20 planks, 50 dowels) for wooden rollers
   and storage crates, so the sawmill's planks roll to the hub on their own.
5. **Wooden parts (D-105):** research **Workshops** for the Workshop (rope from logs, pegs from dowels
   sawn at the sawmill), then **Carpentry** for trusses.
6. **Defences (D-107):** **Basic Defense** (palisades, spike pits), then **Basic Defense 2** (the
   trebuchet, which throws stone, and the ballista).
7. **Research Industry** (100 planks, 50 trusses, 50 stone mined by hand, after Basic Defense 2) to unlock the **extractor** and
   the **furnace**, which smelts iron ore into **ingots**.
8. **The Iron Age's shops (D-113):** research **Blacksmith** (50 ingots, 30 stone) for the Blacksmith, which
   hammers ingots into **plates** (or rods, and rods into rivets). Plates pay for **Hydraulics**, then **Metal Logistics** (powered belts), and
   **Advanced Defense** (hydraulic turrets and brick walls), then **Advanced Defense 2** (hydraulic cannons and
   reinforced walls). The **Machine Shop** (after Blacksmith) makes gears and wire.
9. **The Steam Age (D-119):** **Engineering** (30 motors, 100 gears, 60 bricks, after Assembly and Advanced Defense 2)
   opens it. **Steelmaking** lets furnaces make **steel**, and the **Steel Works** rolls it into **steel beams** and
   makes **bearings** from steel and gears. **Steam Power** brings electricity: boilers, steam turbines and power
   poles, which run **express belts** and the **Storage Silo** (Express Logistics), and **Mk2** extractors and furnaces.
   **Heavy Defense** brings gunpowder (sulfur and charcoal, in the **Powder Mill**), casings and bullets, the electric
   **Turret Mk.2** and the **steel wall**.

## Bugs

There are no waves (D-038). Bugs are distant threats that only attack when provoked.
Numbers live in `NESTS` in `src/sim/data.ts`; the rules are in `src/sim/nests.ts`.

- Each **nest** owns one 10×10 cell, marked by a burrow entrance. Its bugs stroll and rest inside that
  cell and never leave it while calm.
- A nest is **provoked** when:
  - anything is built inside its cell or within 2 tiles of it,
  - any building is within 3 tiles of one of its bugs, or
  - one of its bugs is shot (by a turret, a cannon or the hub gun), or a bug of a nest next to it is.
- A provoked nest's bugs go for the **nearest buildings**, following a path field from every building
  outwards. Belts, splitters and tunnels can be walked over; other buildings block, and bugs chew
  through whatever they reach. There's no fixed leash (D-091): a bug keeps chasing, however far from home,
  while a building or an engineer is within **20 tiles** of it in a straight line (28 at night). With
  nothing that close, it gives up and walks home, and sets off again only if something comes within
  reach. Chasing the engineer, bugs follow them until they get 20 tiles away.
- A nest **calms down** 30 s after the last provocation (biting a building counts as one), and its bugs
  walk home.
- Territories show a red dashed outline while you're placing a building, and a pulsing one while
  they're angry.
- **Mounds (D-065).** Each nest has a **mound** (2×2 tiles in the middle of its cell) with health:
  300 next to the safe radius, +1% per 1.5 tiles further out (like its bugs). Nothing can be built on
  a standing mound. A turret, cannon, ballista or tesla with **no bugs in reach** shoots a mound within
  range of its edge, which provokes the nest. The hub's gun never does. A damaged mound shows a health
  bar, and cracks below half.
- **Destroying a mound** clears the territory for good: its burrow collapses, and the cell can be built
  on, or taken by a spreading territory. It drops **chitin** into hub stock: 3, plus 1 per 25 tiles from
  the hub, up to 10. Its **surviving bugs stay angry**, with no home and no leash, until they're killed.
- **Breeding (D-065, D-071).** A calm nest with fewer bugs than it started with breeds one every
  **60–90 s**, of a kind it's short of, until it's back to full. An angry nest doesn't breed, and its
  timer starts again once it calms down. A destroyed nest never breeds. A mound with no bugs left
  still stands, counts as a live nest, and breeds back.
- **Young bugs** hatch at **half** an adult's health and bite, smaller, duller and a little darker, and grow into adults
  over **3 minutes**: their health and bite rise steadily, keeping any damage they've taken.
- **Threat (D-065, D-072).** A threat level starts at 0 and rises by 1 every **18 minutes** of play, up
  to 10. A message says when it rises, and the clock in the top bar shows it (⚠). At each level:
  - bugs bred or spread from then on get **+15% health** (bugs already out there don't change),
  - a bred crawler has an **8% chance** (up to 50%) to hatch as a runner instead, or, for a nest that
    already has brutes, as a runner or a brute; the nest's size stays the same,
  - territories spread **8% sooner** (down to half the usual 4 minutes).
- **Night raids (D-065, D-073).** At nightfall, from the **second night** on, a raid comes with a
  **50% chance** (+10% per threat level; **every night in Hardcore**). One calm nest within **40 tiles**
  of any of your buildings, picked at random, sends a party of **2 grown bugs** (+1 per 2 threat levels,
  up to 6). The rest of the nest stays calm. Raiders go for the nearest buildings however far, and
  their biting doesn't wake their nest; shooting them does, as usual. At morning they finish what they're
  fighting: they go home once nothing is within 20 tiles of them. A
  message says which way the raid comes from, with the nest warning sound. Young bugs don't raid.
- **Neighbours wake (D-065).** Shooting a nest's bugs provokes that nest and every live nest in the 8
  cells around it. Building near a nest still provokes only the nests it's in or next to.
- **Territories spread (D-059).** Every **4 minutes**, one live territory, picked at random, spreads
  into a neighbouring cell (left, right, above or below) that has no live nest: one whose mound was
  destroyed, or open land. A live territory's cell is never taken. Cells within 30 tiles of the hub, and cells
  with any of your buildings in them, stay clear, so building on cleared land holds it. A new
  territory starts with **half** the bugs a nest that far out would have. A message says when it
  happens.
- Nests further from the hub are bigger and tougher:

  | Bugs in a nest *d* tiles from the hub | Count |
  |---|---|
  | Crawlers | 3, plus 1 per 45 tiles of *d* |
  | Runners | none within 60 tiles; then 1, plus 1 per 40 tiles beyond 60 |
  | Brutes | none within 100 tiles; then 1, plus 1 per 50 tiles beyond 100 |
  | Bug HP | +1% per 1.5 tiles of *d* (double at 150 tiles) |

| Bug | HP | Speed (tiles/s) | Damage to buildings |
|---|---|---|---|
| Crawler | 18 | 1.1 | 8/s |
| Runner | 10 | 2.2 | 5/s |
| Brute | 110 | 0.55 | 30/s |

The runner is drawn as a long centipede, about three times its old length, whose body follows the way it
came and sways as it goes (#96). Only the drawing is long: it is hit, and bites, at its head.

### Turrets

Turrets hold ammo as shots, and arrive fully loaded. You refill them with items:

| Turret | Ammo | Shots per item | Max shots | Range | Fire rate | Damage |
|---|---|---|---|---|---|---|
| Turret | iron plate | 4 | 40 | 5 | 3/s | 5 |
| Ballista | stake | 1 | 20 | 6.5 | 0.8/s | 14 |
| Trebuchet (2×2) | stone | 1 | 12 | 24, nothing closer than 6 | 0.25/s | 40, splash radius 2 |
| Cannon | gear | 3 | 24 | 6.5 | 0.7/s | 30, splash radius 1.3 |
| Turret Mk.2 | bullets | 5 | 60 | 6.5 | 6/s | 7 |
| Tesla Turret | copper wire | 2 | 30 | 5 | 1/s | 12, then arcs on to up to 2 more bugs, each within 2 tiles of the last |

The **Hydraulic Turret** and **Hydraulic Cannon** (D-117) fire only with power (see Water power): lay a
drive shaft to them, or place them touching a well, a powered belt or another powered turret. The **Turret
Mk.2** (D-123) fires only with electricity, using 2: put a power pole within 2 tiles of it. Short of
power they fire more slowly, and with none they don't fire at all, so a cut shaft leaves a gap.

Turrets fire at any bug in range, calm or not, so a turret near a territory provokes it. The
**trebuchet** (D-107) can't hit anything within 6 tiles, so it needs other defences close in.

**Spike pits** (1×1, D-107) are traps bugs walk over: they don't block, and bugs don't go for them. A
bug on a pit takes **15 damage a second** and moves at **half speed**. A pit holds **60 seconds** of
wear (one second per bug standing on it); a stake puts back 6. Arrives full; refill it with stakes by
roller or belt, or by hand.

There are three ways to get ammo to a turret:

1. **From production:** branch a line with a splitter. Best for steady supply.
2. **From the hub:** a hub port sends stock back out onto a belt (D-006).
3. **Touching the hub:** a turret or cannon placed against the hub's side reloads straight from
   hub stock, one item at a time as it has room (D-036).

**Repair stations** heal the most damaged building within 3.5 tiles, at 20 HP/s.
They are fuelled by iron plates (1 plate = 40 HP) or planks (1 plank = 30 HP), holding up to 400 HP, and arrive half full.

## The supply ship

You keep a far-off colony supplied (D-046). There's no final win: the game carries on. Numbers live in
`SHIP` and `cargoFor` in `src/sim/data.ts`; the rules are in `src/sim/ship.ts`.

- **The site (D-109):** a new game stakes out a **5×5 site** for the shipyard, its middle 9 to 15 tiles
  from the hub's, on clear ground. Stakes and a rope mark it until the yard is built. It's the only place
  the shipyard goes: with the Shipyard tool, the blueprint sits on the site wherever you point.
- The **Shipyard** research (a Wood Age research after Carpentry) unlocks the **Shipyard**: 5×5, 900 HP,
  60 planks, 10 trusses and 20 logs. Only one can exist at a time.
- The ship is built once, in six **stages**, in order. Bring each stage's items into the shipyard (by
  roller, belt or by hand); it accepts only what the current stage still needs, so nothing is wasted.

  | Stage | Items |
  |---|---|
  | Scaffolding (Wood Age) | 150 planks, 40 trusses, 60 rope |
  | Launch pad (Iron Age; needs the Launch Pad research) | 120 bricks, 80 iron plates, 60 rivets, 40 iron rods |
  | Hull | 150 iron plates, 80 bricks |
  | Engine | 30 motors, 80 gears |
  | Life support | 120 wire, 60 copper ingots |
  | Navigation | 20 motors, 80 wire, 40 gears |

- Then each **supply run** needs its **cargo** belted in, the same way:

  | Run | Cargo |
  |---|---|
  | 1 | 100 iron plates, 60 bricks, 40 copper ingots |
  | 2 | 120 iron plates, 60 gears, 60 wire, 60 planks |
  | 3 | 120 bricks, 100 gears, 20 motors, 120 planks |
  | 4 | 40 steel, 120 gears, 30 motors, 180 planks |
  | 5 and on | Run 4's list, 25% more each run (rounded up to tens) |

- A message pops up as each stage is finished and when the cargo is loaded. Selecting the shipyard
  shows the stages, the runs delivered, and what the stage or the cargo still needs. On the map the ship
  is drawn top-down, appearing stage by stage. **Side view** (on the selected shipyard) opens a window
  with the ship drawn from the side: built stages solid, the current one filling in as its parts
  arrive, and the rest as dashed outlines, with each stage's progress listed below.
- **Launch** (a button on the selected shipyard, once the cargo is loaded) starts a **90 s countdown**.
  The engines wake **every nest within 48 tiles** of the shipyard on the first run, **8 tiles further for
  each run delivered** (up to 96), because a loaded ship is heavier and needs more thrust (D-049). They
  also wake **at least the 3 nearest** live
  nests however far, so there's always a fight. They stay angry for the whole countdown, and their bugs
  **come for the shipyard**, however far, and chewing through anything in the way
  (D-048). Before you launch, the shipyard's panel says how many nests it will wake. A banner above the
  toolbar counts down. After lift-off the bugs lose interest, calm down and wander home.
- If the shipyard is still standing at lift-off, the run is **delivered**. The game goes on. The ship is
  **away for 5 minutes** (the pad is empty, and nothing can be loaded), then comes back for the next run.
- The **first delivery** in a game opens a "Supplies delivered!" screen with the game's numbers, and
  pauses the game until you press Keep building. The "Supplies Delivered" fanfare plays. In Standard, it unlocks Hardcore.
  Later deliveries show a message and play a jingle.
- If the shipyard is destroyed, any launch fails. **Standard** keeps the ship and its cargo, and a new
  shipyard carries on. **Hardcore** loses a docked ship and its cargo; a ship that's away is safe.
  Demolishing the shipyard yourself always keeps the ship.
- The main menu's Continue button shows how many supply runs a save has delivered.
- **Blueprints from the colony (D-049):** after each delivery the colony offers **two blueprints** for
  buildings you can't research, and you **pick one** on a screen that pauses the game. The other stays
  on offer for a later run; when only one is left, the next delivery simply sends it. The one blueprint left
  is the **Tesla Turret** (the Express Belt is researched now, D-121). Research lists them under "From the colony", with
  what you've received and what's on offer.

## Modes

| | Standard (default) | Hardcore |
|---|---|---|
| Hub reaches 0 HP | **Breach:** every nest calms down and its bugs go home (raiders too), 25% of every item in stock is lost, and the hub is restored to 50% HP | Run over |
| Availability | Always | Unlocked by delivering a supply run in Standard |

The hardcore unlock is stored in the browser's profile, separate from the save file.

## Playing together

Co-op ([COOP.md](COOP.md), D-078 to D-081). Two to ten players build one factory (D-083): one hub, one stock,
one research tree, one supply ship.

- **The dedicated server (D-086):** main menu → **Play together** opens with the server's card: its name,
  a light (online, offline, reconnecting, full, or on another version), players in (of 9: the server
  takes one place), its game's day and season, and its version. **Join the server** works with no code,
  and only when joining can work; otherwise the card says why. It checks again every 10 seconds.
- **Host or join:** below the server, **Host on this device** opens a room with a new game (Standard),
  their own factory, or the last co-op game saved in this browser, and gets a 6-character room code to
  share. The others type the code and press Join. Everyone must be on the same version; a mismatch is
  refused, naming both versions.
- **Start:** the host presses Start once everyone is in. A player can also join a game under way with
  the code: the host sends them a copy of the game, and the others see "Player N joined".
- **Engineers:** each player has their own engineer, in their slot's colour (host yellow, then blue,
  pink, green, violet, white, orange, teal, royal blue and tan), with a ring under it. They start side by side below the hub. A message about an
  engineer (knocked out) says "Your engineer…" to its player and "Player 2's engineer…" to the others. When a player leaves, their engineer
  is back below the hub at once (it doesn't walk home through bug country), and what it carried goes into
  the hub's stock. Someone joining later in that slot takes it over.
- **Dedicated server (D-084):** the game can also be hosted by a server instead of a player
  ([server/README.md](../server/README.md)). Its room is always open with the same code, and the game
  starts at once, so everyone joins it under way. It is paused while nobody is in. The server is player 1;
  its engineer stays at the hub. If the server restarts, players see "The host is back" and carry on.
- **A host's dead connection (D-085):** a host whose connection dies without closing (a router restarting)
  notices within about 20 seconds, reconnects and takes its room back; players see "The host is back".
- **A player back in their own slot (D-092, #100):** each player joins with a random key of their own. A
  player whose connection died without closing (a phone that slept) reconnects into their own slot and
  engineer; before, they came back as a new player, which looked like a stranger joining.
- **The shared clock:** only the host pauses or changes the speed; the other players have no speed
  buttons. Nothing else stops the game: lessons explain while it runs, without blocking the screen, and
  neither the first delivery's screen nor the blueprint pick pauses it.
- **Blueprint offers are the team's:** the colony offers one blueprint for the whole factory after a
  supply run. In co-op the offer is a card at the top of the screen, over a game that keeps running and
  stays playable; **Later** puts it away, and Research → Colony blueprints → Choose brings it back. The
  first player to pick takes it, and the offer closes for everyone. (Tutorials are not shared: each
  player sees their own lessons.)
- **Pings:** press **P** to point at the spot under the mouse, or hold a finger still on empty ground
  with nothing in hand. Every player sees a pin with spreading rings in your colour for 5 s, and hears
  a chime; when it's off their screen, an arrow at the edge points to it. One ping a second at most.
- **Delay:** every action applies 3 ticks (150 ms) after the host receives it, in every game, plus the
  time it takes to reach the host. A building appears when its action lands; errors (like too little
  stock) show then.
- **Staying in step:** once a second each game checks that it still matches the host's. A game that
  doesn't, or that has fallen 20 s or more behind (a phone that slept, a tab in the background), gets a
  fresh copy from the host and says "Caught up with the host's game".
- **Dropped connection:** a guest whose connection drops keeps its screen and tries to get back in, five
  times over about 15 s. Back in, it gets a fresh copy of the game. A guest that hears nothing from the
  host for 15 s takes its connection for dead (the host sends something at least every 5 s).
- **The host's connection drops:** the others are told and wait (their games stand still). The host
  plays on and gets the room back with the same code within a minute; then everyone gets a fresh copy
  and plays on. After a minute without the host, the room closes as if the host had left.
- **Saving:** every player saves the shared game in their own browser, in a co-op slot apart from their
  own factory, so whoever has it can host it later. A host who shares their own factory keeps saving it
  there. Continue on the main menu is always your own factory.
- **Leaving:** a guest who leaves goes back to the main menu; the others are told. When the host leaves,
  the game ends for everyone else, and each keeps it saved. A host who can't get the room back carries
  on alone.

## Onboarding

- The game opens on a **main menu**, with example factories running behind it, one after another every
  40 seconds with a fade between them (#99, D-111): **Industry** (iron, copper, stone and wood lines into
  the hub, with turrets), **The Wood Age** (lumber camps, a sawmill, a workshop, rollers through a crate,
  palisades, spike pits, a trebuchet and ballistae) and **Holding the line** (a walled ring of turrets,
  cannons, a tesla, ballistae and repair stations). Each has a calm bug territory in view, and its name in
  the corner.
  It offers **Continue** (when a save exists, showing its mode and time played),
  **New game** (choose the mode) and **How to play**.

- **Tutorial lessons** (ten) start by themselves the first time each one is useful:

  | Lesson | Starts when | Steps |
  |---|---|---|
  | Essentials | Nothing is built yet but the hub | The hub → your engineer → chop 23 logs by hand → walk back to the hub → research Forestry → place a Lumber Camp beside the nearest trees → bring logs for the Sawmill and place it at the camp's arrow → Collect planks and bring them back → hub stock → the loop, and what planks are for (Palisades, Workshops) |
  | Rollers | Basic Logistics is researched, before any roller is laid | Pick the Wooden Roller → lay 3 → how rollers move, and the Storage Crate |
  | Wooden parts | Workshops is researched, before Industry and before any workshop is built | Pick and place the Workshop → what it makes (rope from logs, pegs from dowels, trusses after Carpentry) → what Industry costs |
  | Smelting | Industry is researched, before any extractor or furnace is built | Mine 10 stone and 4 iron ore by hand → place an extractor over iron ore → a furnace in front of its arrow → Collect an ingot and bring it back (and what the fuel bar means) → research Blacksmith → place a blacksmith in front of the furnace's arrow → what it makes, and what plates pay for |
  | Bugs | A nest is provoked for the first time, or you build within 16 tiles of a nest's centre | The territory → research Basic Defense (palisades and spike pits) from the hub; Advanced Defense (hydraulic turrets, brick walls, and power to the turrets) once Hydraulics is done |
  | Splitters and tunnels | The splitter is unlocked (Metal Logistics) | What splitters do |
  | Water power | Hydraulics is researched, before any well or water wheel is built | Wells and water wheels → drive shafts, and how many belts a well runs |
  | Electricity | Steam Power is researched, before any boiler is built | The boiler and its water → the steam turbine → power poles and their reach |
  | The supply ship | The shipyard is researched, before any run is delivered | Pick the shipyard → place it on its staked-out site → stages and the side view → cargo and launch |
  | Breaches | The hub is breached for the first time | What a breach costs |

- **Action steps** (marked by a pulsing spotlight and a "Skip step" button) wait for you to act. The game keeps running and the dim overlay lets clicks through.
- **Explanation steps** pause the game until you press Next (in co-op they don't pause it or block the screen).
- A lesson waits while a window (research, menu…) is open, so it never covers what the player is reading.
- A lesson card never covers its spotlight, nor a blueprint's ✓ ⟳ ✕ bar. It tries below, above, beside, then
  the top or bottom of the screen, and keeps clear of the toolbar when it can. When a map target is too big for any of those (a
  bug territory on a phone), the map slides a little as the target comes into view, to make room.
- The **New game** dialog has "Start with the Essentials tutorial", ticked until the player has seen it once. Ticking it shows Essentials even if lessons are switched off; unticking it skips them.
- Every lesson card has ✕ (close) and **Hide tips** (switches lessons off).
- Lessons play once. Menu → Tutorials lists them, replays any of them, and switches automatic lessons on or off.
  **Reset tutorials** marks every lesson unseen and switches automatic lessons back on, so each shows again
  when its moment comes (one whose moment is now, like Smelting after Industry, starts straight away).

## Screen

- The **top bar** holds only the speed buttons and the menu.
- The **toolbar** at the bottom lists the unlocked buildings with their costs, plus Rotate and Demolish.
- The **info panel** opens only for a building that's already placed (select it). Picking a tool from the
  toolbar shows no panel.
- **Rates (#48):** the info panel shows a building's top rate (items a minute in and out, belt
  capacity, turret ammo use) and what it's doing now: how many it made a minute lately, and a status
  such as "Waiting for iron ore" or "Output full". Toolbar tooltips show each building's rates.
- **Version and What's new:** the main menu shows the game's version (from `CHANGELOG.md`).
  "What's new", on the main menu and in the pause menu, shows the changelog, newest first, with a dot
  until you've opened this version's notes.
- **Send feedback** (pause menu, D-064): pick Bug, Idea or Other and describe it. "Include
  diagnostics" (on by default, and shown before sending) adds the version, browser, screen, frame rate,
  this game's progress (mode, time, seed, buildings, research, nests, supply ship) and the last few page
  errors. **Open on GitHub** opens a new issue with all of it filled in (labelled playtest, plus bug or
  enhancement), for the player to submit; **Copy** puts it on the clipboard for players without a GitHub
  account; **Download save** saves the current game as a file to attach. The game sends nothing itself.
- **Battery saver** (pause menu): draws at normal resolution and 30 frames a second. Otherwise the
  game draws at most 60 frames a second, and 30 while paused or on the main menu (#46).
- Hub stock floats above the hub (see [Map](#map)).
- **Animation (D-082):** machines run a working animation while they work (the extractor's rotor, the
  furnace's flames and smoke, turning gears and saws, the assembler's arm, the repair station's torch),
  on game time, so it stops while paused. Bugs walk in 4 steps and play a bite while an angry bug stands at
  a building or an engineer. The engineer walks, works (mining by hand, facing the ore), stands idle, and
  sees stars where it was knocked out. Shots flash at the barrel and spark where they land, a cannon's
  shell flies and explodes, bugs splat, buildings lost to bugs break into debris, mended buildings
  sparkle and cut trees burst into leaves.

## Controls

**Moving a building (#76, #83, D-110):** a selected building's panel has **Move**. The building becomes the
tool in hand, facing as it does (Rotate turns it); the next click or tap puts it there, with everything it
holds (inputs, outputs, ammo, items on a belt), for free. It can go anywhere a new one could, its own tiles
included. Right-click, or tapping its tool, cancels. The hub, the shipyard (it has its site) and
underground belts (they'd lose their pair) can't be moved.

| | Desktop | Touch |
|---|---|---|
| Build | Left click (builds at once) | Tap, then ✓ (or tap the same spot again) |
| Select | Click a building | Tap a building |
| Walk (your engineer) | Click empty ground with no tool, or WASD / arrow keys | Tap empty ground with no tool |
| Mine by hand | Click bare ore or stone with no tool (hold to keep mining) | Tap it with no tool (hold to keep mining); the phone ticks on each tap and buzzes when the ore comes loose (#84) |
| Lay belts, walls or palisades | Drag out a line, then ✓ or Enter | Drag out a line, then ✓ |
| Drag a building into place | Press and drag, then click it (or ✓ or Enter) | Press and drag, then ✓ |
| Pan | Right or middle drag | Drag with no tool, or two fingers |
| Zoom | Mouse wheel (with no building selected), or Ctrl+wheel | Pinch |
| Rotate | Mouse wheel while placing, or R | Rotate button |
| Demolish | X | Demolish button |
| Move a building (#76, #83) | Select it, Move, then click where it goes | Select it, Move, then tap where it goes |
| Inventory | I, or the Inventory button | Inventory button (right end of the toolbar) |
| Pick a building | 1–9 | Toolbar |
| Build more like a placed building | Middle-click it | Hold a finger still on it (about half a second) |
| Pause | Space | ❚❚ button |
| Ping (co-op) | P, at the spot under the mouse | Hold a finger still on empty ground |
| Put down the tool or clear the selection | Right-click or Esc | Tap the tool again |
| Close a menu | Click outside it | Tap outside it |
| Blueprint: rotate, reverse, cancel | ⟳, R or the wheel (reverses a belt line); ✕, Esc or right-click | ⟳ or Rotate; ✕ |

- **With a tool in hand, pressing on an existing building of a different kind selects that building**
  and puts the tool down. Two exceptions keep building: pressing a belt with another building drops the
  building onto the belt line, and a belt drag may start on an existing belt.
- **Soft placement (D-030).** Building can show a **blueprint** first: dashed ghosts, red where a
  tile can't be built (blocked, or past what your stock can pay for), and a bar with ✕, ⟳ and ✓
  beside its end. Dragging back along a blueprint shortens it, and tiles that already hold a building
  are skipped. On touch screens every placement is a blueprint; Menu → "Confirm before building on
  touch screens" switches it off. On desktop, single clicks build at once, and only a dragged-out belt
  or wall line becomes a blueprint.
- **Dragging a building into place (D-057).** Every building that isn't laid as a line (belts, express
  belts, walls and palisades are) is placed one at a time, never in rows. Pressing with it in hand and
  dragging moves its blueprint, which keeps its offset from your finger so it isn't hidden under it.
  After a drag the blueprint waits: on desktop, click it (or ✓ or Enter) to build; on touch, ✓.
  Pressing a waiting blueprint and dragging moves it again; clicking or tapping it builds it. With
  touch confirmation switched off, letting go builds.
- **The research menu's ✕** sits at its top right and stays there while the list scrolls.

## Music

All the music is original to the game, composed as notes in code in the style of late-90s 3D adventure
games (D-051, D-052): synthesized flute, clarinet, harp, lute, marimba, music box, accordion, brass,
strings and light percussion, with a roomy reverb.

| Track | Plays | Feel |
|---|---|---|
| Menu theme | Main menu, looping | Ocarina-like flute over harp, 6/8, F Lydian |
| Morning Clearing | In game | Easy-going flute and harp, 92 bpm |
| Workshop Polka | In game | Upbeat marimba and accordion oom-pah, 126 bpm |
| Firefly Lullaby | In game | Slow music-box waltz with strings, 66 bpm |
| Conveyor Jig | In game | Fast flute jig with a hand drum, 6/8 |
| Deep Woods | In game | Slow, mysterious clarinet in E minor, 76 bpm |
| Market Day | In game | Upbeat, swung accordion and marimba, 112 bpm |
| Starlit Night | In game | Slow, dreamy bells and flute, 6/8, C Lydian |
| Supplies Delivered | The first delivery's screen | A brass fanfare with timpani |
| Spring, Summer, Fall, Winter | When that season begins (#42) | About 20 s each: rising flute and harp (G); swung marimba and accordion (D); a wistful clarinet (A minor); slow bells (E minor) |

- In game, the seven tracks play in a shuffled order. Tracks crossfade over 4 s.
- **Moving between the main menu and the game never cuts the music:** the track playing carries on to
  its end, then crossfades into the next mood's tracks. Only the fanfare and the season pieces start at once
  (1.5 s crossfade); after a season piece, the game tracks carry on.
- Every track is brought to the same average loudness, so the playlist doesn't jump in volume.
- Nothing plays until the first click or tap (browsers require it). Music pauses while the page is hidden.
- Menu → Music sets the volume (saved per device). Zero mutes it. The slider follows the ear: its low end is
  very quiet, and even at full the music sits under the sound effects (#97). Sound effects have their own slider ([Sound effects](#sound-effects)).
- The tunes live in `audio/compose/` (`menu-theme.mjs`, `tracks.mjs`, and the instruments in `lib.mjs`).
  `node audio/compose/render.mjs` renders every track to `public/music/` (22 kHz, 16-bit mono WAV);
  name tracks to render only those. The single-file build has no music.

## Sound effects

- Synthesized in the browser with Web Audio (D-043), so there are no sound files and the single-file build has them too. The recipes are in `src/audio/sfx.ts`; `src/audio/sounds.ts` decides when they play.
- Sounds: button clicks, placing a belt, placing a building (deeper for big ones), demolishing, a
  blocked placement, a tree being chopped, turret and cannon shots, a tesla's zap, a ballista's twang, the hub gun, bugs dying, a building destroyed, the hub
  being hit, a breach, research finished, a ship stage finished, the launch rumble, a supply run delivered, and an angry
  chitter when a nest is provoked.
- **The machine hum:** a soft, continuous loop (a low drone and a whirr with a gentle chug) that grows
  with the number of machines working on screen (extractors, lumber camps, furnaces, workshops,
  assemblers, sawmills), full at six. It fades with distance like other sounds, and goes quiet while the
  game is paused and on the main menu.
- Sounds on screen play at full volume, and fade to silence a little beyond its edges, panned left or
  right by where they happen. A provoked nest is a warning, so it's always heard, quietly if far away.
- Busy fights are kept tidy: each sound has a shortest gap between plays, and at most 24 play at once.
- **Critters (D-101, D-111):** heard from all over, quietly, now and then: birds in the morning and less
  at midday, crickets and katydids in the evening and early night, cicadas at dusk, frogs at night. Fewest
  in early spring, most in summer, fading through fall to almost none in winter (a few birds). They're
  quiet while the game is paused. The timing is in `src/audio/critters.ts`.
- Nothing plays on the main menu except button clicks. Menu → Sound effects sets the volume (saved per
  device, default 60%); zero mutes it.

## Saves

- Autosaved to the browser's local storage every 20 s and when the page is hidden.
- Save files are versioned (currently **v35**). v35 (D-123) adds sulfur deposits to older maps, on free ground away from
  what's built. v34 (D-121) turns the Express Belt blueprint, or express belts already
  built, into Steam Power and Express Logistics, with stock in the hub for the boilers, turbines, wells and poles its
  express belts need. v33 (D-120) gives a game already making or holding steel Steelmaking and
  Engineering, since the steel recipe now needs them. v32 (D-118) adds the launch pad as the ship's second stage: a ship past the
  scaffolding counts it as built, with its research, and carries on with the stage it was on. v31 (D-117) trades Masonry for Advanced Defense (with Hydraulics, which it
  needs), returns what was paid towards Masonry, and puts stock in the hub for the wells and shafts its turrets and cannons now
  need. v30 (D-115) adds ponds away from what's built, gives a game with Logistics
  Hydraulics, and puts stock in the hub for the wells and shafts its belts now need. v29 (D-114) fills the fuel store of every furnace and blacksmith, and gives a game
  already making or holding charcoal the Charcoal research. v28 (D-113) switches furnaces making plates to iron ingots, turns workshops
  making gears or wire into machine shops in place, and gives a game past Industry the Blacksmith (and the Machine Shop, if it
  made gears or wire or researched what needs them). v27 (D-112) adds fog of war, with what the buildings and engineers see already explored. v26 (D-109) stakes out a site for the shipyard, refunds
  an old 3×3 shipyard, and counts the new scaffolding stage as built for a ship already under way. v25 (D-108) grows the hub from 5×5 to 8×8 about its old
  centre, refunding buildings in the way. v24 (D-107) turns the Ballistae research into Basic Defense 2. v23 (D-093) gives a game saved before the Wood Age
  Forestry and Industry as researched, since it was played with smelting from the start. v13 added the timer for territories spreading. v12 saved
  the attack-path timers and a player list (co-op groundwork, D-058). v11 added colony blueprints: a game
  that had delivered runs loads with an offer of both blueprints to pick from.
- v10 turned the escape ship into the supply ship: a game
  that had escaped loads with one run delivered, and the ship built and back at the shipyard; other
  games keep their ship progress.
- v9 added trees: a v8 save loads with forest grown around what's already built (never under a
  building, nor within 20 tiles of the hub).
- v8 was a new kind of map (bigger, bug territories, bigger buildings), so **saves older than v8 can't
  be converted**: the main menu explains this, clears the old save and offers a new game (D-038).
