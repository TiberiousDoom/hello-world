# Game design

How the game works on `master` today. Balance numbers live in
`src/sim/data.ts`, which wins if this doc disagrees with it.

## Core loop

1. Mine raw resources with **extractors** placed over ore, and cut trees with **lumber camps**. At the
   very start, mine by hand (see [Starting from nothing](#starting-from-nothing)).
2. Carry them on **belts** to machines that turn them into parts.
3. Deliver items to the **hub**. Its stock pays for buildings and research.
4. **Research** (in the hub) unlocks new buildings.
5. Expand carefully: **bug territories** dot the map, and their bugs attack if provoked.
6. Research the **Shipyard**, build the supply ship, then load it and launch it again and again to supply the colony.

## Map

- A **256×256** tile grid, generated procedurally from a seed (the same seed gives the same map; D-038).
- **Ore fields** come from layered value noise: irregular patches of iron (about 5% of the map),
  copper and stone (about 3.5% each). A starter patch of each ore is placed 10–15 tiles from the hub,
  and the ground right around the hub is kept clear.
- Resource tiles never run out.
- **Forest (D-044):** about 14% of the map is trees, in noise-shaped woods. Trees never grow on ore,
  and none grow within 20 tiles of the hub's centre. A small grove (radius 3) sits just outside that
  clearing, so the first Lumber Camp is close by. See [Wood](#wood).
- The **5×5 hub** sits in the centre.
- **Bug territories:** the map is divided into 10×10 cells. About 18% of the cells whose nearest tile is
  at least 30 tiles from the hub's centre hold a nest (roughly 100 per map). See [Bugs](#bugs).
- Hub stock is shown just above the hub, as part of the map, **only while the hub is selected or the
  mouse is over it** (D-053); it scrolls away with the hub. While the mouse is over the panel itself (or a
  finger is down on it), it fades almost completely, so it never hides the map above the hub.

## Items and recipes

| Item | Made in | From | Time |
|---|---|---|---|
| Iron ore, copper ore, stone | Extractor | ore under it | 1.5 s |
| Iron plate | Furnace | 1 iron ore | 1.6 s |
| Copper ingot | Furnace | 1 copper ore | 1.6 s |
| Brick | Furnace | 2 stone | 2 s |
| Gear | Workshop | 2 iron plates | 2 s |
| Copper wire ×2 | Workshop | 1 copper ingot | 1.5 s |
| Motor | Assembler | 1 gear + 2 wire + 1 iron plate | 4 s |
| Log ×2 | Lumber Camp | 1 tree in reach | 3 s |
| Plank ×2 | Sawmill | 1 log | 1.5 s |
| Stake ×3 | Sawmill | 1 plank | 1.5 s |
| Charcoal | Furnace | 2 logs | 2.5 s |
| Steel | Furnace | 2 iron plates + 1 charcoal | 3 s |
| Chitin | Destroyed nest mounds | — | — |

A machine picks its recipe from the first input it receives, or the player
picks one in its info panel. Changing the recipe discards inputs it has already received.

## Buildings

| Building | Size | Cost | HP | Unlocked by |
|---|---|---|---|---|
| Belt | 1×1 | 1 iron plate | 30 | Logistics |
| Extractor | 2×2 | 4 stone, 4 iron ore | 80 | start |
| Furnace | 2×2 | 6 stone | 120 | start |
| Turret | 1×1 | 10 iron plates, 2 copper ingots | 150 | Basic Defense |
| Ballista | 1×1 | 8 planks, 4 iron plates | 140 | Ballistae |
| Wall | 1×1 | 3 bricks | 400 | Masonry |
| Workshop | 2×2 | 6 iron plates, 4 copper ingots, 4 planks | 120 | Workshops |
| Hub Port | 1×1 | 10 iron plates, 5 copper ingots | 120 | Distribution |
| Splitter | 1×2 | 3 iron plates, 1 copper ingot | 40 | Logistics |
| Underground Belt | 1×1 | 4 iron plates, 1 brick | 40 | Logistics |
| Assembler | 3×3 | 10 gears, 10 wire | 150 | Assembly |
| Repair Station | 1×1 | 10 iron plates, 4 gears, 6 wire, 4 planks | 150 | Field Repair |
| Cannon | 1×1 | 15 iron plates, 5 gears, 2 motors | 220 | Heavy Ordnance |
| Express Belt | 1×1 | 1 iron plate, 1 gear | 40 | Colony blueprint |
| Tesla Turret | 1×1 | 12 iron plates, 6 copper ingots, 10 wire | 160 | Colony blueprint |
| Shipyard | 3×3 | 30 bricks, 30 iron plates, 20 planks | 900 | Shipyard |
| Lumber Camp | 2×2 | 8 iron plates | 100 | Forestry |
| Sawmill | 2×2 | 6 iron plates, 2 bricks | 100 | Forestry |
| Palisade | 1×1 | 2 planks | 160 | Palisades |

- Sizes are width × depth when facing east (the first number runs along the direction the building
  faces). Turning a building sideways swaps them, and a placed building only turns if its new footprint is free.
- Bigger buildings centre on the tile you pick.
- Building costs are paid from hub stock. Demolishing a building refunds its
  cost, scaled by the HP it has left.
- **Hub:** 5×5, 1,000 HP. Accepts any item from any side. **Select it to open Research.**
  It has a **built-in gun**: 9 damage, 1.2 shots/s, range 8 from its centre, and no ammo needed.

## Logistics rules

- **Belts** move 1.5 tiles/s and have **two lanes** side by side (#61, D-069), each holding about 3
  items per tile, so a belt line carries up to about **530 items a minute** (an express belt about
  1,060). A belt accepts items from any side except the tile it points into. An item reaching the end
  of a belt carries straight on onto the next one, at an even speed (#49).
- **Lanes:** buildings (extractors, machines, lumber camps, hub ports) put items onto a belt's **right
  lane** (right as you look the way it runs). A belt feeding into another from the side puts its items
  onto the **near lane**; coming from behind, round a corner, through an underground belt or a splitter,
  items keep their lane. Machines and the hub take from both lanes.
- **Express belts** (a colony blueprint) work the same way at 3 tiles/s. They can be laid like belts,
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
- **Splitters** (1×2, #34) span two belts side by side. They accept items from directly behind either
  belt, and send them out of the front of both in turn, skipping a blocked one. Items keep their lane.
- **Splitter filter (#62):** select a splitter, pick an item and **← Left** or **Right →**. That item
  goes out of that side only, and everything else out of the other. With **Off**, the sides take turns.
- **Dropping a splitter onto a belt (#63):** it faces along the belt, and its second half goes on the
  side of the belt your pointer or finger is nearer (the other side if that one is blocked). Dropped
  between two parallel belts, it replaces both.
- **Underground belts** pair an entrance with the next tunnel placed up to 5
  tiles ahead in the same direction. Exits accept no input. Items in transit
  are lost if either end is removed.
- **Choosing the exit (#64):** after you place an entrance, its exit appears as a blueprint at the first
  free tile past whatever is in the way (or two tiles on, if nothing is). Tap ✓ (or click it) to build
  it, or drag it along the line, up to 5 tiles ahead, first.
- **Going under belts automatically (#65):** a belt line dragged straight across one or more belts
  running the other way goes under them: the tiles just before and after become an underground belt's
  entrance and exit, and you pay for both. The blueprint shows them. If you can't afford both, the line
  is built up to the crossing and stops there (the blueprint shows the rest in red). Only belts are
  tunnelled under; walls and machines still stop a line.
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

## Wood

Wood is the one resource that runs out, for a while (D-044). The ship's hull doesn't use it, but later supply runs carry planks.

- **Trees block building.** Every building, belts included, needs tree-free ground. Underground belts
  can still pass under trees.
- A **Lumber Camp** (2×2) must have at least one tree or stump within **4 tiles** of its centre. Every
  3 s it cuts the nearest tree in reach into **2 logs**, and outputs them like an extractor. It waits
  while its output is full, and goes idle when nothing in reach is grown.
- A cut tree leaves a **stump**, which grows back into a tree after **2 to 4 minutes** (3 on average,
  at random, so a grove grows back gradually and a camp's logs come steadily, #50). Stumps don't block
  building: building over one clears it for good. So a camp can clear land, or keep cutting the same
  woods as they regrow.
- The **Sawmill** (2×2 machine) turns 1 log into 2 planks.
- The **Palisade** is a cheap wooden wall: 2 planks, 160 HP (a stone wall has 400). It's laid in lines
  like walls.
- Selecting a camp shows its reach, and how many trees and regrowing stumps it has.
- **Wood in the economy (D-054):** a Sawmill can also saw planks into **stakes**, the ammo for the
  **Ballista** (researched after Palisades and Basic Defense). **Repair stations** burn planks as well as
  iron plates. The **Workshop**, **Repair Station** and **Shipyard** cost a few planks, so Workshops
  research now needs Forestry first. A **furnace** burns 2 logs into **charcoal**, and makes **steel** from
  2 iron plates and 1 charcoal. Steel is cargo for the fourth supply run on, and the material for upgrades
  to come.
- Still to come: forest that matters to bugs ([ROADMAP.md](ROADMAP.md)).

## Research

You start with the extractor and furnace. Everything else is researched, except colony
blueprints, which come from supply runs. **Select the hub** and press **Research** to open the list.

- **Start** a research, and it draws its items from hub stock at a steady pace over its research
  time. For example, Basic Defense takes 20 iron plates over 30 s.
- If the hub runs out of an item it needs, the research **stalls** until more arrives.
- Only one research is active at a time. **Switching** keeps what's already been put in, and
  **Pause** stops drawing. The hub's panel shows the active research and its progress.

| Research | Items | Time | Needs | Unlocks |
|---|---|---|---|---|
| Logistics | 10 iron plates | 20 s | — | Belt, Splitter, Underground Belt |
| Basic Defense | 20 iron plates | 30 s | — | Turret |
| Forestry | 15 iron plates | 30 s | — | Lumber Camp, Sawmill |
| Palisades | 12 planks | 30 s | Forestry | Palisade |
| Ballistae | 20 planks, 10 iron plates | 45 s | Palisades, Basic Defense | Ballista |
| Chitin Plating | 10 chitin, 20 iron plates | 45 s | Basic Defense | Turrets, walls and palisades get 1.5× health (built ones too) |
| Masonry | 12 bricks | 30 s | — | Wall |
| Workshops | 30 iron plates, 10 copper | 60 s | Forestry | Workshop |
| Distribution | 25 iron plates, 10 copper | 60 s | Basic Defense | Hub Port |
| Assembly | 30 gears, 30 wire | 120 s | Workshops | Assembler |
| Field Repair | 20 gears, 20 wire | 90 s | Workshops, Masonry | Repair Station |
| Shipyard | 60 iron plates, 30 gears, 30 wire, 5 motors | 150 s | Assembly | Shipyard |
| Heavy Ordnance | 10 motors, 30 gears | 150 s | Assembly, Basic Defense | Cannon |

The hub starts empty.

## Day, night and seasons

Always on (#42, D-068). It all follows from game time, so it's saved and the same in co-op. Numbers are
in `CLOCK` in `src/sim/data.ts`; the clock is `src/sim/clock.ts`.

- **A day** is 6 minutes of daylight and 3 of night (9 minutes in all). Dusk and dawn each fade over
  30 s. A game starts on the first morning of spring.
- **Night:** the map darkens to a deep blue, with pools of light around the hub, your engineer,
  turrets, repair stations and working machines. **Bugs range further:** a provoked nest's bugs chase
  up to **30 tiles** from home (22 by day), and a building within **5 tiles** of a calm bug provokes
  its nest (3 by day).
- **Seasons**, a 12-day (108-minute) year:

  | Season | Days | Tree regrowth | Look |
  |---|---|---|---|
  | Spring | 4 (36 min) | 1.5× faster | Green |
  | Summer | 2 (18 min) | 2× faster | A warm light |
  | Fall | 4 (36 min) | 0.75× (slower) | Orange broadleaf trees, an amber tint |
  | Winter | 2 (18 min) | 0.5× (slowest) | Frost on the ground and trees |

  A stump's regrowth time is set by the season it's cut in.
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
- **Reach:** it mines and hands things over within **1.5 tiles**. Tapping ore, Collect and Drop off
  send it over first if it's too far, and it does the job on arriving.
- **Carrying:** up to **20 items**, which trail behind it. Walking up to the **hub** drops everything
  off at once. **Drop off** (on a selected machine, turret, repair station, shipyard or the hub) hands
  that building whatever it takes of what's carried.
- Bugs ignore the engineer for now.
- In co-op each player will have their own engineer; the rules already keep a list of players.

## Starting from nothing

A new game starts with an empty hub and no belts (#38, D-062). The first minutes go:

1. **Mine by hand.** With no tool in hand, tap or click a tile of bare ore or stone. The engineer
   walks over, and every **8 taps** in a row loosen **1**, which it carries; a ring around the tile
   fills with each tap, with sparks and a pickaxe sound. Holding the finger or mouse button down taps
   **4 times a second**. Tapping another tile, or **3 s** without a tap, starts the count over.
   Dragging from there pans, as usual. With full hands, mining stops and a message says so.
2. **Carry it to the hub**, then **build a furnace** (6 stone) and an **extractor** (4 stone, 4 iron
   ore) over iron ore, with the furnace in front of the extractor's arrow: a building's output passes
   straight into a building in front of it.
3. **Collect by hand.** Select a machine, extractor or lumber camp and press **Collect**: the engineer
   fetches its finished items (up to 3), to carry to the hub.
4. **Research Logistics** (10 iron plates) to unlock belts, splitters and underground belts. From
   there, belts do the carrying.

## Bugs

There are no waves (D-038). Bugs are distant threats that only attack when provoked.
Numbers live in `NESTS` in `src/sim/data.ts`; the rules are in `src/sim/nests.ts`.

- Each **nest** owns one 10×10 cell, marked by a dirt mound. Its bugs stroll and rest inside that
  cell and never leave it while calm.
- A nest is **provoked** when:
  - anything is built inside its cell or within 2 tiles of it,
  - any building is within 3 tiles of one of its bugs, or
  - one of its bugs is shot (by a turret, a cannon or the hub gun), or a bug of a nest next to it is.
- A provoked nest's bugs go for the **nearest buildings**, following a path field from every building
  outwards. Belts, splitters and tunnels can be walked over; other buildings block, and bugs chew
  through whatever they reach. They chase no further than **22 tiles** from their territory's centre; a bug that reaches that edge stops there until its territory calms down.
- A nest **calms down** 30 s after the last provocation (biting a building counts as one), and its bugs
  walk home.
- Territories show a red dashed outline while you're placing a building, and a pulsing one while
  they're angry.
- **Mounds (D-065).** Each nest has a **mound** (2×2 tiles in the middle of its cell) with health:
  300 next to the safe radius, +1% per 1.5 tiles further out (like its bugs). Nothing can be built on
  a standing mound. A turret, cannon, ballista or tesla with **no bugs in reach** shoots a mound within
  range of its edge, which provokes the nest. The hub's gun never does. A damaged mound shows a health
  bar, and cracks below half.
- **Destroying a mound** clears the territory for good: its mound goes flat, and the cell can be built
  on, or taken by a spreading territory. It drops **chitin** into hub stock: 3, plus 1 per 25 tiles from
  the hub, up to 10. Its **surviving bugs stay angry**, with no home and no leash, until they're killed.
- **Breeding (D-065, D-071).** A calm nest with fewer bugs than it started with breeds one every
  **60–90 s**, of a kind it's short of, until it's back to full. An angry nest doesn't breed, and its
  timer starts again once it calms down. A destroyed nest never breeds. A mound with no bugs left
  still stands, counts as a live nest, and breeds back.
- **Young bugs** hatch at **half** an adult's health and bite, smaller and paler, and grow into adults
  over **3 minutes**: their health and bite rise steadily, keeping any damage they've taken.
- **Threat (D-065, D-072).** A threat level starts at 0 and rises by 1 every **18 minutes** of play, up
  to 10. A message says when it rises, and the clock in the top bar shows it (⚠). At each level:
  - bugs bred or spread from then on get **+15% health** (bugs already out there don't change),
  - a bred crawler has an **8% chance** (up to 50%) to hatch as a runner instead, or, for a nest that
    already has brutes, as a runner or a brute; the nest's size stays the same,
  - territories spread **8% sooner** (down to half the usual 4 minutes).
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

### Turrets

Turrets hold ammo as shots, and arrive fully loaded. You refill them with items:

| Turret | Ammo | Shots per item | Max shots | Range | Fire rate | Damage |
|---|---|---|---|---|---|---|
| Turret | iron plate | 4 | 40 | 5 | 3/s | 5 |
| Ballista | stake | 1 | 20 | 6.5 | 0.8/s | 14 |
| Cannon | gear | 3 | 24 | 6.5 | 0.7/s | 30, splash radius 1.3 |
| Tesla Turret | copper wire | 2 | 30 | 5 | 1/s | 12, then arcs on to up to 2 more bugs, each within 2 tiles of the last |

Turrets fire at any bug in range, calm or not, so a turret near a territory provokes it.
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

- The **Shipyard** research unlocks the **Shipyard**: 3×3, 900 HP, 40 bricks and 40 iron plates. Only one
  can exist at a time.
- The ship is built once, in four **stages**, in order. Belt each stage's items into the shipyard; it
  accepts only what the current stage still needs, so nothing is wasted.

  | Stage | Items |
  |---|---|
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
  shows the stages, the runs delivered, and what the stage or the cargo still needs. The ship appears
  on the pad stage by stage.
- **Launch** (a button on the selected shipyard, once the cargo is loaded) starts a **90 s countdown**.
  The engines wake **every nest within 48 tiles** of the shipyard on the first run, **8 tiles further for
  each run delivered** (up to 96), because a loaded ship is heavier and needs more thrust (D-049). They
  also wake **at least the 3 nearest** live
  nests however far, so there's always a fight. They stay angry for the whole countdown, and their bugs
  **come for the shipyard**, ignoring their usual 22-tile leash and chewing through anything in the way
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
  on offer for a later run; when only one is left, the next delivery simply sends it. The blueprints are
  the **Express Belt** and the **Tesla Turret**. Research lists them under "From the colony", with
  what you've received and what's on offer.

## Modes

| | Standard (default) | Hardcore |
|---|---|---|
| Hub reaches 0 HP | **Breach:** every nest calms down and its bugs go home, 25% of every item in stock is lost, and the hub is restored to 50% HP | Run over |
| Availability | Always | Unlocked by delivering a supply run in Standard |

The hardcore unlock is stored in the browser's profile, separate from the save file.

## Onboarding

- The game opens on a **main menu**, with a small factory (and a calm bug territory) running behind it.
  It offers **Continue** (when a save exists, showing its mode and time played),
  **New game** (choose the mode) and **How to play**.

- **Tutorial lessons** (five) start by themselves the first time each one is useful:

  | Lesson | Starts when | Steps |
  |---|---|---|
  | Essentials | A game has no extractors, furnaces or belts yet | The hub → your engineer → mine 10 stone by hand → mine 4 iron ore → walk back to the hub → place an extractor over iron ore → a furnace in front of its arrow → Collect a plate and bring it back → hub stock → research Logistics → lay 3 belts → the loop |
  | Bugs | A nest is provoked for the first time, or you build within 16 tiles of a nest's centre | The territory → research Basic Defense from the hub |
  | Splitters and tunnels | The splitter is unlocked (Logistics) | What splitters do |
  | The supply ship | The shipyard is researched, before any run is delivered | Pick the shipyard → place it → stages → cargo and launch |
  | Wood | Forestry is researched | Pick the Lumber Camp → place it beside the nearest trees → stumps and regrowth → pick and place the Sawmill → what planks are for |
  | Breaches | The hub is breached for the first time | What a breach costs |

- **Action steps** (marked by a pulsing spotlight and a "Skip step" button) wait for you to act. The game keeps running and the dim overlay lets clicks through.
- **Explanation steps** pause the game until you press Next.
- A lesson waits while a window (research, menu…) is open, so it never covers what the player is reading.
- A lesson card never covers its spotlight, nor a blueprint's ✓ ⟳ ✕ bar. It tries below, above, beside, then
  the top or bottom of the screen, and keeps clear of the toolbar when it can. When a map target is too big for any of those (a
  bug territory on a phone), the map slides a little as the target comes into view, to make room.
- The **New game** dialog has "Start with the Essentials tutorial", ticked until the player has seen it once. Ticking it shows Essentials even if lessons are switched off; unticking it skips them.
- Every lesson card has ✕ (close) and **Hide tips** (switches lessons off).
- Lessons play once. Menu → Tutorials lists them, replays any of them, and switches automatic lessons on or off.
  **Reset tutorials** marks every lesson unseen and switches automatic lessons back on, so each shows again
  when its moment comes (one whose moment is now, like Wood after Forestry, starts straight away).

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

## Controls

| | Desktop | Touch |
|---|---|---|
| Build | Left click (builds at once) | Tap, then ✓ (or tap the same spot again) |
| Select | Click a building | Tap a building |
| Walk (your engineer) | Click empty ground with no tool, or WASD / arrow keys | Tap empty ground with no tool |
| Mine by hand | Click bare ore or stone with no tool (hold to keep mining) | Tap it with no tool (hold to keep mining) |
| Lay belts, walls or palisades | Drag out a line, then ✓ or Enter | Drag out a line, then ✓ |
| Drag a building into place | Press and drag, then click it (or ✓ or Enter) | Press and drag, then ✓ |
| Pan | Right or middle drag | Drag with no tool, or two fingers |
| Zoom | Mouse wheel (with no building selected), or Ctrl+wheel | Pinch |
| Rotate | Mouse wheel while placing, or R | Rotate button |
| Demolish | X | Demolish button |
| Pick a building | 1–9 | Toolbar |
| Build more like a placed building | Middle-click it | Hold a finger still on it (about half a second) |
| Pause | Space | ❚❚ button |
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
- Menu → Music sets the volume (saved per device). Zero mutes it. Sound effects have their own slider ([Sound effects](#sound-effects)).
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
- Nothing plays on the main menu except button clicks. Menu → Sound effects sets the volume (saved per
  device, default 60%); zero mutes it.

## Saves

- Autosaved to the browser's local storage every 20 s and when the page is hidden.
- Save files are versioned (currently **v13**). v13 adds the timer for territories spreading. v12 saved
  the attack-path timers and a player list (co-op groundwork, D-058). v11 added colony blueprints: a game
  that had delivered runs loads with an offer of both blueprints to pick from.
- v10 turned the escape ship into the supply ship: a game
  that had escaped loads with one run delivered, and the ship built and back at the shipyard; other
  games keep their ship progress.
- v9 added trees: a v8 save loads with forest grown around what's already built (never under a
  building, nor within 20 tiles of the hub).
- v8 was a new kind of map (bigger, bug territories, bigger buildings), so **saves older than v8 can't
  be converted**: the main menu explains this, clears the old save and offers a new game (D-038).
