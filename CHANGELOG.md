# Changelog

The newest version is at the top; the game shows this file under "What's new". Each release lists
what's **New** and what's **Fixed**.

## 0.87.3 · 2026-10-29 · More fixes from the review
### New
- Nothing new to play: the last small fixes from the code review.

### Fixed
- **Co-op:** the host takes at most a few hundred building commands at once from each player (plenty for long belt drags), and passes on only what a command needs. A player who keeps rejoining gets a fresh copy of the game at most every 5 seconds.
- **Co-op:** a player who leaves while the host is starting the game has their engineer sent home. A command from a player with no engineer no longer moves someone else's.
- **Co-op:** the relay answers repeated status checks for a room from a short cache.
- **Bugs:** a new territory clears the trees from its mound and the ring around it, as nests on a new map do. A nest that merged wakes the neighbours of every cell it holds. A flying bug with nothing left to attack flies home instead of to its old target.
- **Upgrading a damaged belt** refunds the old belt as demolishing it would, not as new.
- **Settings** opened from the pause menu goes back to it however you close it, a click outside it included.
- The main menu no longer loads your whole save twice to show it and then continue it.

## 0.87.2 · 2026-10-29 · Safer, smoother co-op
### New
- Nothing new to play: this release makes co-op safer and big factories smoother.

### Fixed
- **Co-op:** a guest only takes plain game data from the host. A world or a turn carrying anything else is refused, so a modified host can't put its own code on your screen.
- **Co-op:** a host whose tab stalled while players kept building no longer gets disconnected for sending too much at once: the backlog goes out in parts. A copy of the game that's too big to send now says so instead of dropping the host.
- **Co-op:** a host's game no longer keeps every command of a long session in memory.
- **Big lumber operations** no longer slow the game down: power and electric networks are only worked out again when buildings change, not each time a tree is felled or grows back.

## 0.87.1 · 2026-10-29 · Fixes from a code review
### New
- If your browser won't let the game save (storage blocked or full), it now tells you instead of saying "Game saved."

### Fixed
- **Co-op:** a crafted link to another relay could put its own code on the game's page; messages from the relay are now checked. One odd command from a modified game could leave every other player out of step for good. Pasting a very large copy no longer gets a guest disconnected. A guest that misses a turn waits for a fresh copy instead of running on without it.
- **Drones** no longer turn one item into another when a pad changes what it does while a drone is on its way. A load that can't land goes home, and anything left over goes to hub stock.
- **Turrets** no longer waste a shot on a bug another turret has just killed.
- **Turning a building** now follows the same rules as building one: not onto trees, water or mounds, and a water wheel keeps its front in the pond.
- **Moving a hub port** keeps it facing away from the hub. Trees no longer grow back under a building you moved or turned onto a stump.
- **Building over a belt** keeps what the belt carried: in the new building if it takes it, in hub stock if not.
- **Your engineer** can walk out with the keys after a building goes up where they stand (or where they get back on their feet).
- Bug paths are no longer recalculated over and over after a nest is destroyed and its bugs are gone.
- The first-delivery screen's **Bug nests cleared** counts destroyed mounds, not emptied ones.
- **Starting a new game** clears a strike you were aiming, the tool in hand and any lesson under way, and no longer plays the season tune at once.
- **Keyboard shortcuts** wait while a dialog is open: Space no longer unpauses a game under a dialog that paused it.
- Season tunes no longer pile up while the music is muted.
- The toolbar's red cost marks update when a second ingredient runs short. A key bound to `"` no longer breaks button tooltips.
- The speed, menu and tutorial close buttons have names for screen readers.
- **Dedicated server:** saves and backups are written safely to disk, and an unexpected error is logged before it restarts.

## 0.87.0 · 2026-10-28 · Wood that lasts
### New
- **Build from your pockets:** when the hub is short, what your engineer carries pays the rest, wherever they are. The hub's stock is used first.
- **Lumber Camps go over trees:** the trees under it are cut at once, and their logs pay for the camp. Over four trees it's free, and starts with 8 logs to send out.
- Trees give **4 logs** (up from 2), by hand or by a camp, and grow back **10 times** (up from 3). A camp holds 8 logs.

### Fixed
- Wood no longer runs out so fast.

## 0.86.1 · 2026-10-28 · Plans for the next playtest fixes
### New
- Nothing in the game yet: the plans are written down for building from your own pockets when the hub runs short, trees that last longer, and real birdsong.

### Fixed
- The plans page and the list of decisions are up to date.

## 0.86.0 · 2026-10-28 · Smoother on phones
### New
- On a touch screen, once a building goes up its tool is put down, so your next tap selects or walks. **Double-tap a tool** to keep it for several (a 📌 shows on it). Belts, rollers and walls keep their tool as before.
- Dragging a building with your finger lifts its blueprint **above your finger**, so you can see where it goes.
- The tutorial, tips and How to play now say **tap** on phones and **click** on computers, and How to play shows only your device's controls.
- The research list shows what you can start first, then what's locked, then what's **done**, in the order you finished it.
- **Rollers curve** round corners like belts, and look right where they run into the hub's corner.

### Fixed
- Music that stopped (after the phone locked, a call or another app's sound) now starts again by itself.
- Blowing leaves no longer race across the screen while you zoom.

## 0.85.1 · 2026-10-28 · Docs catch up
### New
- Nothing new in the game: the roadmap, research tree and save notes now match what's built, and the latest playtest notes are on the roadmap.

## 0.85.0 · 2026-10-27 · Undo, copy and settings
### New
- **Undo** your last building or demolishing with Ctrl+Z, Z or the new Undo button. A dragged line undoes in one go.
- **Copy and paste** parts of your factory: press Copy (or C), drag over some buildings, then tap where the copy goes. Recipes and filters come along, R turns it, and V pastes it again later.
- A **Settings** screen, from the main menu or the pause menu: volumes, the size of text and buttons, reduce motion, battery saver, touch confirmation and your keys.
- **Change your keys** in Settings. The number keys now reach further: 0 picks the 10th tool, and Shift+1–9 the 11th to 19th.
- **Install the game** to your home screen, and play it **offline** once you've opened it (without music).
- Buttons on touch screens are bigger: at least 44 pixels high.

## 0.84.1 · 2026-10-27 · Plans for opening up
### New
- Nothing new in the game this time: the plan for opening co-op to strangers is written up. Invite links and player accounts come first, then a cloud server and more rooms.

## 0.84.0 · 2026-10-27 · Stock by name
### New
- The hub's panel lists everything in stock **by name**, with its icon and count. Handy on phones, where you can't hover an icon to see what it is.

## 0.83.0 · 2026-10-27 · Defence tiers
### New
- **Defence tiers.** Every turret, wall and fence upgrades from Tier 1 to Tier 4 from its panel, using its own materials and chitin. Each tier adds 25% health, and turrets hit 20% harder and reach 10% further.
- Chitin Plating now opens Tier 2. Heavy Defense opens Tier 3, and Electric Defense Tier 4.
- Green pips show a defence's tier. Defences plated in older saves are now Tier 3, with the same health.

## 0.82.0 · 2026-10-27 · Clear a belt line
### New
- **Clear line** on a belt's panel empties every item off the whole line into hub stock. The belts stay where they are.

## 0.81.0 · 2026-10-27 · Safer co-op
### New
- A dedicated server can have a **password**. Joining asks for it once, and your browser remembers it.

### Fixed
- A player in a co-op game could crash everyone's game, the dedicated server's included, with one bad message. The host now refuses it.
- A player could stall a co-op game by sending their engineer walking thousands of times a second. The host now takes at most 5 a second from each player, which is far more than tapping.
- The dedicated server's room key is now readable only by the server's own user.
- Nobody else can take over the dedicated server's room while it's restarting.

## 0.80.0 · 2026-10-27 · Difficulty settings
### New
- New games in Standard can be **Easy**, **Normal** or **Hard**. Easy has fewer nests and weaker bugs; Hard has more nests and tougher bugs. Pick it in New game. Saved games are Normal.

## 0.79.0 · 2026-10-27 · Bugs hold a grudge
### New
- **Brutes and beetles go for the turret that shoots them**, instead of the nearest building, until it's gone. Walls in front of your turrets matter more now.

## 0.78.0 · 2026-10-27 · Better ammo
### New
- New research, **Better Ammo**: the Assembler makes **AP bullets** and **explosive shells**.
- AP bullets hit half again as hard in the Turret Mk.2 and go straight through a beetle's armour. Explosive shells hit half again as hard in mortars and artillery, over a wider blast.
- A turret takes better ammo as well as its usual ammo and fires it first. Turrets by the hub take it from stock first.

## 0.77.0 · 2026-10-27 · Wasps and beetles
### New
- **Wasps** live in far hives. They fly straight over walls, trees and ponds to your buildings. Turrets have to stop them: trebuchets, mortars and artillery can't hit them, and spike pits don't touch them.
- **Beetles** live in far dens. Their armour takes 6 off every hit, so small turrets barely scratch them. Use cannons, ballistas or the railgun.

## 0.76.0 · 2026-10-27 · Forests and bugs
### New
- Some nests lie **deep in forest**. Trees slow bugs down, and bugs go round forest when they can, so clearing it opens paths for them.
- **Cutting a tree inside a bug territory provokes its nest**, by hand or by a lumber camp.
- The colony can send a **Tree Nursery**: it plants young trees around it, so cut forest grows back.

## 0.75.0 · 2026-10-27 · Hardcore nests
### New
- In Hardcore, nests can't be shot down. **Build over a mound and the ring of tiles around it** to destroy it. The tiles left to cover are marked.
- A nest being built over breeds faster, so be quick.
- Hardcore starts at threat level 2, and its nests breed, spread and grow faster.

## 0.74.0 · 2026-10-27 · Nests grow
### New
- Nests come in **kinds**: crawler warrens near the hub, runner hives further out, and brute dens furthest. Where two zones meet, they mix.
- Each map has 1 to 3 **queen nests** near its edge. They're tough, breed fast and drop lots of chitin.
- Calm nests **grow**: every 3 days of calm, a nest gets bigger, with more bugs and a tougher mound, up to large. Grown nests drop more chitin.
- Two grown nests of a kind whose territories touch can **merge** into one bigger nest.
- Saved games keep their nests, which start growing from small.

## 0.73.0 · 2026-10-27 · Belt pieces
### New
- Belt corners, end bumpers, start lips and the flanges where belts meet buildings are drawn from new art. Express belt corners have their yellow rails.

## 0.72.0 · 2026-10-27 · Gifts from the colony
### New
- Supply runs bring three **special buildings** from the colony. After each delivery, it offers two and you pick one.
  - **Teleporter Pad:** like a drone pad, but items arrive at once, at any distance. It uses a lot of electricity.
  - **Orbital Strike Beacon:** charges over a day, then press **Call a strike** and tap any explored spot. It wrecks the bugs and nests there.
  - **Greenhouse:** grows logs with electricity. No trees needed.
- This completes the Electric Age.

## 0.71.0 · 2026-10-27 · Ship Systems
### New
- **Ship Systems** (after Electronics and Hull) is needed for the ship's **engine**, **life support** and **navigation**.
  - These stages are built of circuit boards, coils, steel and motors now, so the first launch comes in the Electric Age.
- Saved games keep working:
  - A ship already past its engine gets Ship Systems.
  - A ship building one of these stages gets back what it had brought in for it.

## 0.70.0 · 2026-10-27 · Shields and railguns
### New
- **Electric Defense 2** (after Electric Defense) brings two new defences:
  - The **Shield Pylon** takes the bites for every building within 5 tiles, from a 600-point shield that recharges with electricity.
  - The **Railgun** (2×2) fires a slug that goes through every bug in a long line. It needs no ammunition, only electricity.

## 0.69.0 · 2026-10-27 · Drones
### New
- **Drone Logistics** (after Circuit Works) brings the **Drone Pad**:
  - Set to **Send**, belts fill it with one kind of item.
  - Pick an item in its panel and it **receives** that item. Drones from sending pads within 24 tiles fly it over, 8 at a time, and a belt leaving its front takes it out.
  - Both pads need electricity.

## 0.68.0 · 2026-10-27 · Mk3 machines
### New
- **Mk3 Machines** (after Circuit Works and Mk2 Machines): upgrade a Mk2 extractor or furnace, or an assembler, to **Mk3** from its panel.
  - It costs 6 circuit boards, 4 coils and 4 steel beams.
  - With electricity it works **three times as fast**; without it, at Mk1 speed.
  - A blue plate with three chevrons marks it.

## 0.67.0 · 2026-10-27 · Electric Defense
### New
- **Electric Defense** (after Circuit Works) brings three new defences:
  - The **Tesla Turret** is researched now, not a colony blueprint. It needs **no ammunition**, only electricity from a power pole.
  - The **Arc Fence** is a wall that shocks every bug biting it, with electricity.
  - **Floodlights** light the ground around them at night, and bugs in their light move more slowly. They see far into the fog.
- Saved games with the Tesla blueprint, or teslas, get Electric Defense, and stock in the hub to power their teslas.
- The colony has no blueprints to offer for now. Special buildings will come later.

## 0.66.0 · 2026-10-27 · Electronics
### New
- **The Electric Age begins.** Research **Electronics** (after Mk2 Machines and Heavy Defense 2) to open it.
- **Circuit Works** (after Electronics) makes **circuit boards** from wire and iron plates, and **coils** from wire and iron rods.
  - It works only with electricity: put a power pole near it.
- Drones, Mk3 machines, electric defences and the ship's launch follow in the next updates.

## 0.65.0 · 2026-10-27 · Heavy guns and the hull
### New
- **Heavy Defense 2** (after Heavy Defense and Steel Works):
  - The **Mortar** lobs shells over walls, splashing every bug where they land.
  - **Artillery** (2×2) fires shells 30 tiles, but can't hit anything within 8.
  - Both need electricity from a power pole.
  - The Assembler makes **shells** from casings, gunpowder and steel.
- **The hull** is the ship's Steam Age stage now: 120 steel, 60 steel beams, 30 bearings and 20 motors, once you research **Hull**.
- This completes the Steam Age.
- Saved games keep working:
  - A ship already past its hull keeps it.
  - A hull under way gives back the plates and bricks brought in for it.

## 0.64.0 · 2026-10-27 · Gunpowder
### New
- **Sulfur:** yellow deposits now lie out on the map, at least 45 tiles from the hub. Mine them by hand or with extractors.
- **Heavy Defense** (after Steelmaking and Steam Power):
  - The **Powder Mill** grinds sulfur and charcoal into **gunpowder**.
  - The Steel Works makes **casings**, and the Assembler puts casings and gunpowder together into **bullets**.
  - The **Turret Mk.2** fires bullets six times a second, but only with electricity from a power pole.
  - The **Steel Wall** has 1,600 HP.
- Saved games keep working, and get sulfur deposits on free ground away from what's built.

## 0.63.0 · 2026-10-27 · Mk2 machines
### New
- **Mk2 Machines** (after Steel Works and Steam Power): select an extractor or furnace and press **Upgrade to Mk2** (6 steel beams, 4 bearings, 2 motors). It keeps its place and what it holds, gets a gold plate, and with electricity from a power pole works twice as fast. Without electricity it works at its old speed.
- **The Storage Silo** (Express Logistics): a 2×2 store with 12 stacks of up to 100 items, mixed, first in, first out, like the Storage Unit.
- A machine's panel shows its Mk2 speed, and its rates count it.

## 0.62.0 · 2026-10-27 · Electricity
### New
- **Steam Power** (after Steelmaking) brings electricity. A **Boiler** burns logs or charcoal and needs water: place it touching a well or a water wheel. A **Steam Turbine** touching it makes electricity. **Power Poles** carry it: each links to poles within 6 tiles, with a wire between them, and connects turbines and electric buildings within 2 tiles.
- **Express Logistics** (after Steam Power): the **Express Belt** is researched now, and runs on electricity. A line of express belts passes it along; without it, they roll only at roller speed. A turbine runs about 120 of them.
- An **Electricity** lesson explains boilers, turbines and poles once Steam Power is done.
- Select a pole, turbine, boiler or express belt to see how its network is doing.
- The colony's last blueprint is the Tesla Turret; the Express Belt has left the pool.
- Saved games keep working: a game with the Express Belt blueprint or express belts gets Steam Power and Express Logistics, and materials in the hub for the boilers, turbines and poles its express belts need.

## 0.61.0 · 2026-10-27 · The Steam Age begins
### New
- **Engineering** (after Assembly and Advanced Defense 2) opens the Steam Age.
- **Steelmaking** (after Engineering and Charcoal): furnaces make steel from iron plates and charcoal. Steel needs this research now.
- **The Steel Works** (research Steel Works, after Steelmaking): a 2×2 mill that rolls steel into **steel beams**, and makes **bearings** from steel and gears. Beams and bearings are what the rest of the Steam Age is built from.
- Saved games keep working: a game already making or holding steel gets Engineering and Steelmaking.

## 0.60.0 · 2026-10-27 · The launch pad
### New
- **The launch pad:** the ship's Iron Age stage, built after the scaffolding from 120 bricks, 80 iron plates, 60 rivets and 40 iron rods. The shipyard takes its parts once you research **Launch Pad** (60 iron plates, 60 bricks, 30 rivets; after Blacksmith and Shipyard), and its panel says so until then. The side view shows the pad under the ship.
- This completes the Iron Age.
- Saved games keep working: a ship already past its scaffolding counts the launch pad as built and carries on where it was.

## 0.59.0 · 2026-10-27 · Hydraulic defences
### New
- **Turrets and cannons are hydraulic now:** they fire only with power. Lay a drive shaft to them, or place them touching a well, a powered belt or another powered turret. A turret uses 1 power and a cannon 2, so a well runs 8 turrets. Short of power they fire more slowly; with none they don't fire at all, and flash a blue mark. Select one to see its network.
- **Advanced Defense** now comes after Hydraulics and gives the **Hydraulic Turret** and the **Brick Wall**. Masonry is gone.
- **Advanced Defense 2** (after Advanced Defense and Machine Shop) replaces Heavy Ordnance: the **Hydraulic Cannon**, which no longer needs motors, and the new **Reinforced Wall** (900 HP, brick bound with iron and rivets).
- Turrets and cannons cost rivets now.
- Saved games keep working: a game with Masonry gets Advanced Defense (and Hydraulics) instead, and gets back what it paid towards Masonry. A game with turrets or cannons gets materials in the hub for the wells and shafts to power them. Until those are built, its turrets and cannons are silent.

## 0.58.0 · 2026-10-26 · The Storage Unit
### New
- **Storage Unit** (Metal Logistics): a 1×2 store with 6 stacks of up to 50 items, mixed. Belts fill it from the back and sides, and a belt leaving its front takes items out in the order they came. Your engineer can Collect from it and Drop off into it.

## 0.57.0 · 2026-10-26 · Water power
### New
- **Ponds:** small lakes now dot the map, at least 30 tiles from the hub. Nothing is built on water, your engineer walks round, and bugs wade through slowly.
- **Hydraulics** (after Blacksmith): the **Well** works anywhere, the **Water Wheel** sits with its front in a pond and gives four times as much, and **Drive Shafts** carry their power.
- **Belts need power:** Logistics is now **Metal Logistics**, after Hydraulics. A belt touching a shaft, a well, a wheel or another powered belt shares its network's power. A well runs about 40 belts; short of power, belts slow down, and with none they roll only at roller speed. Select a belt to see how its network is doing.
- A **Water power** lesson explains it all once Hydraulics is done.
- Saved games get ponds away from what's built, and games with belts get Hydraulics and enough materials in the hub for the wells and shafts their belts need.

## 0.56.0 · 2026-10-26 · Fuel
### New
- **Furnaces and blacksmiths burn fuel:** logs (8 s each) or charcoal (24 s each), fed by roller, belt or by hand. They burn only while working and stop when the fuel runs out. An orange bar on each shows how much is left, and a flashing mark shows one that has run dry.
- New furnaces and blacksmiths arrive with a full store, and so do the ones in saved games.
- **Charcoal research** (after Blacksmith): furnaces can burn logs into charcoal, which lasts three times as long as a log. Games already making charcoal have it.

## 0.55.0 · 2026-10-26 · The Iron Age begins
### New
- **Iron ingots:** furnaces now smelt iron ore into ingots.
- **The Blacksmith** (research Blacksmith, after Industry): hammers ingots into iron plates, or into iron rods, and rods into rivets. Plates still pay for belts and turrets, so Logistics and Advanced Defense now come after it.
- **The Machine Shop** (after Blacksmith): gears and copper wire are made here now, not in the Workshop. Assembly and Field Repair come after it.
- **Smelting lesson:** it now ends with researching Blacksmith and placing one at the furnace's arrow.
- Saved games keep working: furnaces that made plates make ingots, workshops that made gears or wire become machine shops where they stand, and games already past Industry have the shop researches they relied on. Build a blacksmith after your iron furnaces to keep plates coming.

## 0.54.0 · 2026-10-26 · Sun, seasons and fog
### New
- **Seasons fade in:** over the last day of each season the land turns to the next one. Trees change one by one, snow settles bit by bit, and in spring the flowers come back before the leaves.
- **Moving shadows:** buildings and trees cast shadows that follow the sun across the sky, long in the morning and evening and short at noon. The moon casts fainter ones at night.
- **Critters:** birds in the morning, crickets and katydids in the evening, cicadas at dusk and frogs at night, growing quiet through fall and nearly silent in winter.
- **Fog of war:** the map beyond the hub is hidden until you explore it. Your engineer uncovers the ground around them as they walk, and every building you put up sees around it. In co-op, what anyone finds, everyone sees. Saved games have already explored what their buildings and engineers can see.
- **Example factories on the main menu:** three scenes take turns behind the menu: an industrial factory, the Wood Age, and a walled base holding the line.

## 0.53.0 · 2026-10-26 · Rearranging
### New
- **Move buildings:** select a building and press Move, then tap where it should go. It keeps everything it holds and costs nothing. (Not the hub, the shipyard or underground belts.)
- **Belts go under anything:** drag a belt line across a wall, a machine or trees, and it goes underground beneath them on its own, as it already did under other belts. Rollers still stop at what's in their way.

## 0.52.0 · 2026-10-26 · Deposits
### New
- **Ore runs out:** every ore tile holds 1,200 ore. Mining by hand and extractors use it up, and then it's bare ground.
- **Bigger yields:** an extractor takes one ore from each ore tile under it every cycle, so one placed squarely on a patch makes up to 4 times as much. Its panel shows how much ore is left.
- **Ore looks like deposits:** touching ore tiles share one bed of earth, so each patch reads as one deposit.
- **Ore further out:** no ore lies within 20 tiles of the hub. The first trips to mine by hand are a real walk.
- **Forests thin out:** a tree grows back 3 times; cut it a fourth time and the ground stays clear.

## 0.51.0 · 2026-10-26 · The shipyard and a bigger hub
### New
- **The hub is 8×8** (it was 5×5), with more sides for rollers and belts to come in.
- Saved games keep their factory: the hub grows in place about its centre. Anything built right against its old edge where the bigger hub now stands is refunded into stock.
- **The shipyard's site:** every new game stakes out a spot for the shipyard near the hub, marked with stakes and rope. The shipyard goes there and nowhere else.
- **A bigger shipyard:** 5×5, built from wood, and researched in the Wood Age after Carpentry.
- **Scaffolding first:** the ship now starts with a wooden scaffolding stage (planks, trusses and rope) before the hull.
- **Side view:** select the shipyard and press Side view to see the ship from the side, each stage filling in as its parts arrive.
- Saved games get a site staked out near the hub; an old shipyard is refunded so it can be built again on the site, and a ship already under way keeps its progress.

## 0.50.0 · 2026-10-26 · Hold the line
### New
- **Spike pits:** a trap bugs walk over. They take damage and slow to half speed while they cross, and the pit wears down as it works. Refill it with stakes.
- **Trebuchets:** a 2×2 siege engine that hurls stone up to 24 tiles, hitting every bug where it lands. It can't hit anything within 6 tiles, so guard it with palisades and spike pits.
- **Basic Defense** (palisades and spike pits) and **Basic Defense 2** (trebuchets and ballistae) are the Wood Age's defences, paid in wood and rope. Industry now needs Basic Defense 2: hold your ground before the furnaces.
- Turrets are now under **Advanced Defense**, and ballistae are built from planks and rope.
- Saved games that had Ballistae get Basic Defense 2.

## 0.49.0 · 2026-10-26 · Rolling along
### New
- **Wooden rollers:** research **Basic Logistics** (logs, planks and dowels) right after Forestry, and lay rollers like belts. Items roll slowly in single file on their own; a busy line packs up and moves at belt speed, so it keeps up with what you put on it.
- **Storage crates** hold 50 of one item. Rollers fill them, a roller leaving the front takes items out, and your engineer can Collect from them or Drop off into them.
- **A Rollers lesson** shows how to lay a line and what crates are for.

## 0.48.0 · 2026-10-26 · Wooden parts
### New
- **Wooden parts:** sawmills can saw planks into **dowels**, and workshops make **pegs** from dowels and **rope** from logs. Research **Carpentry** and workshops make **trusses** from planks, pegs and rope.
- **Workshops come sooner:** they're researched with planks and logs now, right after Forestry, and built from wood.
- **Industry costs more:** 100 planks, 50 trusses and 50 stone, after Carpentry. The Wood Age now has a real goal before the furnaces.
- **A Wooden parts lesson** shows what the workshop makes and what Industry needs.

## 0.47.1 · 2026-10-26 · Long legs
### New
- **Runners are longer:** they're drawn as long centipedes now, about three times as long, with a body that snakes along behind them as they run.
- **Splitters sort:** feed a splitter two belts carrying two different items, and each item stays on its own side. One belt, or one kind of item, is still split in turn.

## 0.47.0 · 2026-10-26 · The Wood Age begins
### New
- **Start with wood:** a new game begins with nothing to build. Tap a tree to chop it: eight taps fell it for two logs, and it leaves a stump that grows back.
- **Forestry first:** research it with 15 logs. The Lumber Camp now costs 8 logs and the Sawmill 14 logs, so the first buildings are paid in wood.
- **Industry:** a new research (40 planks, 30 stone) brings the extractor and the furnace. Belts, turrets, walls and workshops come after it.
- **A new first lesson** walks you through chopping, Forestry, your first lumber camp and sawmill, and bringing planks home. A Smelting lesson follows Industry, and the Bugs lesson suggests Palisades until you have turrets.
- Saved games keep everything they had: they get Forestry and Industry as researched.

## 0.46.3 · 2026-10-26 · Ideas decided
### New
- Nothing new in the game this time: the playtest ideas are decided. Coming up: trees that regrow a few times, ponds and a water wheel, ore that runs out (and extractors that make more over bigger patches), ore further from the hub, a bigger hub with the shipyard's site staked out from the start, fog of war, nests that merge and grow, a sun with moving shadows and critter sounds, splitters that sort, belts that go underground on their own, a long snaking runner, and example factories on the main menu.

## 0.46.2 · 2026-10-26 · Under the trees
### New
- **Under the trees:** your engineer and the bugs now walk under the trees instead of over them. Your engineer shows through the leaves faintly, so you don't lose them.
- **Plans:** the Wood Age is decided: chopping trees by hand, wooden rollers, a storage crate, spike pits, a long-range trebuchet and a bigger shipyard. Nothing changes in the game yet.
- **Mining you can feel:** on phones, each tap of mining by hand gives a small tick, and a longer buzz when the ore comes loose.
### Fixed
- Grass tufts, flowers and mushrooms stand upright instead of lying sideways or upside down.
- The music is quieter: its slider's low end is very soft now, and at full it sits under the sound effects.
- The Music and Sound effects sliders are the same length.
- **No more strangers in co-op:** when a friend's phone slept and woke, they came back as a new player, which looked like someone joining without the code. Now they get their own engineer back.

## 0.46.1 · 2026-10-26 · Off the leash
### New
- **Bugs don't stop mid-chase any more:** an angry bug keeps after you, or your buildings, as long as something is within 20 tiles of it (28 at night), however far from its nest that takes it. With nothing left that close, it gives up and walks home.
- **Raids finish what they start:** at dawn, raiders keep fighting until nothing is left in reach, then go home.

## 0.46.0 · 2026-10-26 · Pockets
### New
- **An inventory for your engineer:** 12 slots that each hold 10 of one item, 120 in all, up from 20. Open it with the Inventory button at the bottom right of the toolbar (or I). Mining by hand, Collect and Pick up fill it.
- **Pick up off belts:** select a belt, splitter or underground belt with items on it and press Pick up. Your engineer walks over and takes them.
- **Keep what you carry:** walking up to the hub still drops everything off, but you can switch that off in the Inventory window. Drop off on any building still hands it what it takes.
### Fixed
- The toolbar no longer misses a tap while its numbers change.

## 0.45.4 · 2026-10-26 · Four ages planned
### New
- Nothing new in the game this time: the plan for a new research tree is written up. The game will grow through a Wood, Iron, Steam and Electric Age, each with its own materials, power and weapons, starting from nothing but wood. The ship will be built a stage at a time across all four, and a playtested Wood Age comes first.

## 0.45.3 · 2026-10-26 · Taps that land
### Fixed
- **Research starts with one tap:** in a busy factory the research list redrew so often that a tap could miss its button and need a second try. The list now updates its numbers in place (#86).
- **Turn buildings away from belts:** a building placed beside belts lines itself up with them, but turning it now overrides that. The first turn starts from the facing you see, and the building then keeps yours (#85).
- **Belts meet the hub's corners:** a belt running into one of the hub's corners now carries on under its wall, instead of stopping short of it (#78).

## 0.45.2 · 2026-10-26 · Notes brought up to date
### New
- Nothing new in the game this time: the project's notes are brought up to date, drawn belt corners, ends and joins are planned, and your latest feedback is in the plans: an early, mid and late game with wooden defences first and upgrades for every defence, bugs that don't give up in the middle of a chase, and seasons that fade in.

## 0.45.1 · 2026-10-25 · Always open, for real
### Fixed
- A test of the new Play together screen sometimes failed on the build server, which kept 0.45.0 from going out. Nothing changes in the game.

## 0.45.0 · 2026-10-25 · Always open
### New
- **Join the server in one tap:** Play together now opens with the dedicated server at the top. Press Join the server; there's no code to type.
- **Server status:** see at a glance whether the server is online, how many players are in, what day and season its game is on, and which version it runs. It checks again every few seconds while the screen is open.
- **Clear reasons:** when you can't join (the server is offline, full, reconnecting, or on another version), the screen says why and what to do.
- **Hosting and joining a friend** have their own sections, below the server.

## 0.44.0 · 2026-10-25 · Bring the whole crew
### New
- **Up to 10 players:** a room now holds the host and nine friends, up from four.
- **More colours:** six new engineer colours (violet, white, orange, teal, royal blue and tan), so everyone stays easy to tell apart.
- **Room below the hub:** engineers start side by side below the hub, spreading out to either side as more players join.
- The lobby lists players in two columns when there's room, so a full room fits on a phone.
- **A game that's always on:** the game can now run on a spare computer as a dedicated server, with a room that stays open and a code that never changes. Friends join and leave whenever they like, and nobody has to host. The game waits, paused, while nobody is in.
### Fixed
- When the host's game restarts, players now carry on from the fresh copy it sends, instead of standing still.
- When the host's internet drops without the connection closing (a router restarting, say), the host now notices within about 20 seconds and takes its room back, instead of leaving everyone waiting for many minutes.

## 0.43.0 · 2026-10-24 · Moving pictures
### New
- **Machines at work:** extractors spin, furnaces burn and smoke, gears and saws turn, the assembler's arm welds, and repair stations flare while they mend.
- **Livelier bugs:** bugs scuttle in four steps and bite with their own animation when they reach your buildings or your engineer.
- **Your engineer** walks, swings their tools while mining, stands about when idle, and sees stars where they were knocked out.
- **Fights look the part:** muzzle flashes, sparks where shots land, cannon shells and explosions, bug splats, debris from lost buildings, sparkles on mended ones, and leaves flying when a tree is cut.
- **Seasons:** fresh green in spring, leaf litter and orange trees in fall, and snow with frosted trees in winter.

## 0.42.0 · 2026-10-24 · Play together
### New
- **Play together:** build one factory with friends. In the main menu, choose Play together: one player hosts a new game or their saved one and shares the room code, and the others join with it. The host presses Start when everyone is in.
- **Your own engineer:** each player has an engineer, with a coloured ring to tell them apart.
- **One clock for everyone:** only the host can pause or change the speed. Lessons, the first delivery and blueprint picks don't pause a game you play together. The colony's blueprint offer is the team's: the first player to pick takes it.
- **Join any time:** friends can join with the code after the game has started.
- **Stays in step:** if your game drifts from the host's, or falls far behind (a phone that slept), it catches up on its own. If your connection drops, the game tries to get you back in.
- **Everyone keeps the game:** each player saves the shared game in their browser, apart from their own factory, and can host it later from Play together.
- **Leaving:** when a player leaves, their engineer is back at the hub at once, and what it carried goes into stock.
- **Pings:** press P (or hold a finger on empty ground) to point at a spot for everyone, in your colour. An arrow at the edge of the screen shows pings that are off it.
- **Blueprint card:** when playing together, the colony's offer is a card that leaves the game playable. Pick later from Research if you like.
- **Your messages:** "Your engineer was knocked out" goes to that engineer's player; the others read whose it was.
- **Host comes back:** if the host's connection drops, everyone waits up to a minute for the host to come back, then plays on.

## 0.41.1 · 2026-10-24 · Plans brought up to date
### New
- Nothing new in the game this time: the project's plans and notes are brought up to date.

## 0.41.0 · 2026-10-24 · Getting ready to play together
### New
- **Behind the scenes:** the server that will connect co-op games is up. Playing together comes in a later update.

## 0.40.0 · 2026-10-23 · New art
### New
- **New art:** every building, bug, item and resource is redrawn, with one light, soft shadows and glossy bugs. The forest keeps its look, a little richer.
- **Walls and palisades join up:** each piece is chosen from its neighbours, with its own corners, ends and a lone post. North–south runs show their side.
- **Nests are burrows:** warrens, hives and dens look different by the bugs inside, Hardcore nests look meaner, and the ground around a nest is blighted. Angry and damaged nests show it, and a destroyed nest leaves a collapsed hole.
- **Damage shows:** hurt buildings show cracks, and the hub looks battered below half health.
- **Young bugs** are a little darker, so they stand out on the grass.

## 0.39.0 · 2026-10-23 · Bugs notice your engineer
### New
- **Bugs notice your engineer:** walking close to calm bugs stirs up their nest, and angry bugs nearby go for the engineer. A health bar shows when they're hurt, and health comes back after a short rest.
- **Knocked out:** at no health, your engineer drops what they carry and is back on their feet at the hub 10 seconds later. You can still build meanwhile.

## 0.38.0 · 2026-10-23 · Night raids
### New
- **Night raids:** from the second night, some nights a nest near your buildings sends a small party of bugs after them. They don't stop at the usual chasing distance, and they go home at morning. A message says which way they come from. In Hardcore, it's every night.

## 0.37.0 · 2026-10-23 · Threat
### New
- **Threat:** every 18 minutes the threat level rises (up to 10). New bugs are tougher, more of them hatch as runners or brutes, and territories spread sooner. The clock shows the level.
- **Neighbours wake:** shooting a nest's bugs now wakes the nests around it too.

## 0.36.0 · 2026-10-23 · Nests breed
### New
- **Nests breed:** a calm nest that has lost bugs breeds a new one every minute or so, until it's back to full. An angry nest doesn't, and a destroyed one never will.
- **Young bugs** hatch small, pale and weak, at half an adult's health and bite, and grow up over 3 minutes.
- Saved games: nests breed back up to what a nest that far out starts with.

## 0.35.1 · 2026-10-23 · Steadier belts zoomed out
### Fixed
- **Belts zoomed out** no longer stutter or seem to run too fast (#66). Far out, each belt shows one still arrow and the items show the movement; close up, the arrows still slide along.

## 0.35.0 · 2026-10-23 · Easier underground belts
### New
- **Pick an underground belt's exit:** after you place an entrance, its exit appears as a blueprint just past whatever is in the way. Tap ✓ or click it to build it, or drag it along first.
- **Belts go under belts:** drag a belt line straight across another belt and it goes under it, with an underground entrance and exit placed for you (and paid for). If you can't afford them, the line stops before the crossing.

## 0.34.0 · 2026-10-23 · Two-lane belts
### New
- **Belts have two lanes**, side by side, so each belt carries twice as much. Buildings put items on the right lane. A belt that feeds into another from the side puts its items on the near lane, so you can merge two kinds of item onto one belt.
- **Splitters can sort:** select one, pick an item and Left or Right. That item goes out of that side and everything else out of the other. Off makes the sides take turns, as before.
- **Dropping a splitter onto a belt** puts its other half on the side your pointer or finger is nearer.
- Saved games: items already on belts move onto the right lane.

## 0.33.1 · 2026-10-23 · Day and night, now live
- Nothing changes in play. A browser test that blocked 0.33.0 from going live is fixed, so day, night and the seasons reach the game.

## 0.33.0 · 2026-10-23 · Day, night and seasons
### New
- **Day and night:** 6 minutes of day, then 3 of night. The map darkens, with light around your hub, engineer, turrets and working machines.
- **Bugs range further at night:** angry bugs chase further from their nest, and calm ones notice buildings from further away.
- **Seasons:** spring (4 days), summer (2), fall (4) and winter (2). Trees grow back faster in spring and fastest in summer, slower in fall and slowest in winter. Fall turns the trees orange and winter brings frost.
- **A clock** in the top bar shows the season, the day and whether it's night.
- **Each season has its own short piece of music** when it begins.

## 0.32.0 · 2026-10-23 · Your engineer
### New
- **You have an engineer.** Tap or click empty ground to walk there; on a keyboard, WASD or the arrow keys walk too, and the camera follows.
- **Mining by hand** now sends the engineer over to the ore. What they mine, they carry, trailing behind them, up to 20 items.
- **Walk up to the hub** to drop off everything you carry.
- **Collect** sends the engineer to fetch a machine's finished items. **Drop off** hands a building whatever it takes of what you carry.
- The Essentials lesson walks you through it.
- WASD and the arrow keys no longer pan the map: drag (right or middle mouse button on a computer) to pan.

## 0.31.0 · 2026-10-23 · Nest mounds and chitin
### New
- **Destroy a nest's mound** to clear its territory for good. Turrets in range shoot a mound when no bugs are near (which wakes the nest). A damaged mound shows a health bar and cracks.
- **Chitin:** a destroyed mound drops chitin into the hub, more for nests further out. Its survivors stay angry and roam until killed.
- **Chitin Plating** (research, after Basic Defense): turrets, walls and palisades get half as much health again, including ones already built.
- You can't build on a standing mound.
- Saved games: nests you'd already cleared of bugs count as destroyed.

## 0.30.1 · 2026-10-23 · Plans for nests
- Nothing changes in play. The plans for nests are written down: mounds you can destroy for chitin, nests that breed young bugs, a threat that rises over time, night raids, nest kinds and queen nests, and tougher Hardcore nests you have to build over.

## 0.30.0 · 2026-10-23 · Send feedback from the game
### New
- **Send feedback** in the pause menu: pick Bug, Idea or Other and describe it. Diagnostics (the game's version, your browser and screen, the frame rate, this game's progress and any recent errors) are included unless you untick them, and you can see exactly what's in them first.
- **Open on GitHub** opens a new issue with your report filled in, ready to submit. Without a GitHub account, **Copy** puts the report on your clipboard to paste into a message. **Download save** saves this game as a file you can attach.
- Nothing is sent until you choose one of these.

### Fixed
- Typing a space or a number in a text box no longer pauses the game or picks a tool.

## 0.29.0 · 2026-10-23 · New building shapes
### New
- **The workshop is 2×2** (was 3×2) and **the assembler 3×3** (was 4×2).
- **The splitter spans two belt lanes** (1×2), like Factorio's. It takes items from behind either lane and sends them out of both lanes in turn. It used to send items front, left and right.
- **Underground belts look like belts** that dive into the ground at the entrance and come back up at the exit.
- Saved games move each resized building to the nearest spot where it fits. One that fits nowhere is removed and its cost (and what it held) goes back into hub stock.

### Fixed
- **Sounds no longer go missing** just after the game starts: while the sound system was still waking up, a button click or a building sound could be skipped as if it had just played.

## 0.28.0 · 2026-10-23 · Start from nothing
### New
- **Start from nothing:** the hub starts empty, and you begin with only the extractor and furnace. Tap bare stone or ore (or click it) to mine it by hand: every 8 taps put one into the hub, with sparks and a pickaxe sound. Hold your finger or the mouse button down to keep mining.
- **Cheaper first buildings:** a furnace costs 6 stone, and an extractor 4 stone and 4 iron ore.
- **Collect:** select a furnace (or any machine, extractor or lumber camp) and press Collect to carry what it has made to the hub. That's how the first plates get there before belts.
- **Logistics is the first research** (10 iron plates) and unlocks belts, splitters and underground belts together. The separate Underground Belt research is gone; saved games get Logistics as done.
- **A new Essentials lesson** walks through the new start: mine, build a furnace and an extractor, collect, research Logistics, lay belts.

## 0.27.0 · 2026-10-23 · Art review: new bugs, a standing ship and tidier sprites
### New
- **New bugs:** the crawler is long, flat and segmented, dark orange; the runner is a glossy black, many-legged scuttler; the brute is a four-legged, centaur-like beast in very dark red, with two big claws.
- **The supply ship stands upright** on its pad, taller and drawn in three-quarter view. Life support is less cartoony.
- **The repair station** now looks like a workshop: a cog and spanner, a welding arm and a toolbox.

### Fixed
- **Tidier sprites:** the ballista's bow sits at the front, and it and the tesla coil lost their arrows; the palisade has no brown background; iron plates are dark grey squares and planks are proper boards; autumn trees have more autumn colour; grass tufts grow from a broad base.

## 0.26.0 · 2026-10-23 · Smoother belts, readable rates and spreading nests
### New
- **Version numbers and What's new:** the main menu shows the game's version, and "What's new" (main menu and pause menu) lists what changed in each version. A dot marks it until you've looked.
- **Readable rates:** select a building to see its top rate (items a minute in and out, a belt's capacity, a turret's ammo use) and what it's doing now, such as "24/min lately · Waiting for iron ore". Toolbar tooltips show rates before you build.
- **Bug territories spread:** every few minutes a territory spreads into a neighbouring cell with no live nest, including ones you've cleared. Cells near the hub, or with your buildings in them, stay clear, so build on land you want to keep. New territories start smaller.
- **Battery saver** in the pause menu: lower resolution and 30 frames a second, for laptops and phones.

### Fixed
- **Runs cooler, especially in Safari:** the ground and trees are drawn once instead of every frame, and the game draws at most 60 frames a second (30 while paused or on the main menu). A MacBook playtester's laptop was getting hot.
- **Belts no longer stutter:** items used to pause or jump where one belt tile meets the next. They now flow at an even speed, move smoothly between the game's updates, and the belt arrows match them (and stop when a belt is backed up or the game is paused).
- **Logs come steadily:** stumps grow back at slightly different times (2 to 4 minutes), so a lumber camp no longer gives a flood of logs and then nothing.

## 0.25.0 · 2026-10-22 · Groundwork for co-op
- Nothing changes in play. Under the hood, everything you do to your factory is now recorded as a list of actions that can replay a game exactly, which co-op will send between players. Saves update automatically.

## 0.24.0 · 2026-10-22 · Playtest fixes
- **Drag a building into place:** press with a building in hand and drag; its blueprint follows. Click it (desktop) or tap ✓ (phone) to build, or drag it again. A plain click still builds at once on desktop. Belts, walls and palisades still drag out as lines.
- **No more twitching bugs:** an angry bug that reached the end of its leash used to flick back and forth on the spot (most often just after a launch). It now stops at the edge until its territory calms down.
- **Research menu:** the close button (✕) is at the top right and stays put while the list scrolls.
- **"Underground Transport" research is now "Underground Belt",** like the building it unlocks.

## 0.23.0 · 2026-10-21 · Wood in the economy
- **Ballista:** a long-range wooden tower that fires stakes. Research Ballistae (after Palisades and Basic Defense), and have a Sawmill saw planks into stakes for it.
- **Charcoal and steel:** a furnace burns logs into charcoal, and makes steel from iron plates and charcoal. The fourth supply run asks for steel.
- **Planks matter early:** Workshops, Repair Stations and the Shipyard cost a few planks (so Forestry now comes before Workshops), and Repair Stations can burn planks for fuel.
- **Reset tutorials** in Menu → Tutorials shows every lesson again.

## 0.22.0 · 2026-10-21 · Picking buildings, belt alignment and a tidier hub
- **Build more like a building you placed:** middle-click it, or on a phone hold your finger on it for half a second. It becomes the tool in hand, facing the same way.
- **Buildings line up with belts while you aim:** place a machine next to a belt line and it turns and shifts so the belt runs into it and its output runs onto the next belt.
- **Hub stock only shows when you want it:** select the hub, or point at it with the mouse.

## 0.21.0 · 2026-10-21 · Wood lesson and machine hum
- **A Wood lesson** starts the first time you research Forestry: placing a Lumber Camp beside the trees, stumps and regrowth, the Sawmill, and what planks are for. Replay it from Menu → Tutorials.
- **The main menu's demo factory** now has a lumber camp and sawmill turning a grove into planks.
- **A machine hum:** a soft, continuous factory sound that grows with the number of machines working on screen, and goes quiet when you pause.

## 0.20.0 · 2026-10-21 · New music, research order and tutorial tips
- **Seven new in-game tracks and a fanfare,** all made for the game in the same late-90s adventure style as the menu theme. Some are upbeat (a polka, a jig, a swung market tune), some slow (a lullaby, a mysterious forest piece, a starlit waltz), plus an easy-going morning tune. The fanfare plays when your first supply run is delivered. They replace the lo-fi tracks and "Groove".
- **Music flows from the main menu into the game** (and back) without a cut: the track playing finishes, then the next one fades in.
- **Forestry and Palisades** come before Masonry in the research list.
- **Tutorial tips no longer cover the spotlight** (or a blueprint's ✓ button). On phones, a big target like a bug territory slides up to make room for the tip.

## 0.19.0 · 2026-10-21 · New menu music
- **New main menu music:** a whimsical theme made for the game, in the style of late-90s 3D adventure games: an ocarina-like flute over harp, pizzicato strings and marimba, in a lilting 6/8 with a touch of magic. It replaces the corporate track.

## 0.18.0 · 2026-10-21 · Colony rewards (supply runs phase 2)
- **Blueprints from the colony:** after each supply run, the colony offers two blueprints for buildings you can't research, and you pick one. The other comes with a later run. Research shows them under "From the colony".
- **Express Belt:** twice as fast as a belt. With it selected, one tap or click on a belt upgrades that whole line in place, keeping its direction and items. The old belts are refunded, so it costs a gear per belt.
- **Tesla Turret:** fed copper wire by belt. Each shot arcs from the nearest bug on to two more nearby.
- **A heavier ship:** each run's launch wakes nests 8 tiles further out than the last (from 48 up to 96 tiles).
- Fixed belts next to Lumber Camps and Sawmills not joining up with them visually.
- Saves move to v11. Games that had delivered runs get a blueprint to pick when they load.

## 0.17.0 · 2026-10-21 · The colony supply ship
- **The escape ship is now a colony supply ship, and the game no longer ends.** Build the ship once, then load each supply run's cargo by belt and launch it. Hold the shipyard through the countdown, and the run is delivered.
- The ship is away for 5 minutes after each run, then comes back for the next, bigger one. Later runs ask for gears, wire, motors and planks.
- Your first delivery gets a "Supplies delivered!" screen, and in Standard it unlocks Hardcore. The victory screen and the endless-mode choice are gone.
- **Launches are a real fight now.** Woken bugs come for the shipyard from wherever their nest is, instead of staying near home, and every launch wakes at least the 3 nearest nests. The shipyard's panel tells you how many nests a launch will wake.
- In Hardcore, a ship that's away at the colony is safe even if the shipyard falls.
- Saves move to v10. A game that had escaped loads with one supply run delivered and the ship ready to load.

## 0.16.0 · 2026-10-21 · Wood (phase 1)
- **Forests:** about a seventh of the map is now woods. Trees block building, so expanding means working around them or clearing them. There's a small grove just outside the hub's clearing.
- **Forestry** research unlocks the **Lumber Camp**, which cuts the nearest tree in reach into logs, and the **Sawmill**, which saws logs into planks. Cut trees leave stumps that grow back after 3 minutes. Build over a stump to clear it for good.
- **Palisades** research unlocks the **Palisade**: a cheap wooden wall made of planks, weaker than stone.
- A chop sound and a burst of leaves when a tree comes down.
- Saves move to v9. v8 saves load with forest grown around what you've built.

## 0.15.0 · 2026-10-21 · Sound effects
- Sound effects for building, demolishing, blocked placements, turret and cannon fire, the hub gun, bugs dying, buildings destroyed, hub hits, breaches, research, ship stages, the launch, and an angry chitter when you provoke a nest. Buttons click.
- Sounds come from where they happen: full volume on screen, fading out past its edges, panned left or right. A provoked nest is always heard, quietly if it's far away.
- Menu → Sound effects sets their volume.

## 0.14.0 · 2026-10-21 · The open map
- **A much larger, generated map:** 256×256 tiles from a seed, with irregular ore fields and a starter patch of each ore near the hub, which now sits in the middle.
- **No more waves or wave timer.** Bugs live in nests scattered across the map, each in its own 10×10 territory. They wander inside it and leave you alone unless provoked: building in or next to a territory, a building coming close to a bug, or shooting one. Provoked bugs go for your nearest buildings (up to 22 tiles from home) and calm down 30 s after the last provocation. Killed bugs don't come back, so nests can be cleared. Nests further out are bigger and tougher.
- **New building sizes:** extractor and furnace 2×2, workshop 3×2, assembler 4×2, hub 5×5. Machines output from the middle of the side their arrow marks, shown by a small port. Extractors mine whichever ore covers most of their base. Any building, whatever its size, can be dropped onto a belt line and lines up with it.
- **The Company is gone:** no contracts, balance owed, emails, store, black market or suspicion. The Shipyard is now a normal research, and launching the ship wakes every nest within 48 tiles for the countdown. Hardcore unlocks by escaping once in Standard.
- **Research lives in the hub:** select the hub and press Research.
- **A cleaner screen:** the top bar holds only speed and the menu. Hub stock stays above the hub on the map and scrolls away with it. The info panel only opens for buildings you've placed, not for toolbar picks.
- **Tapping a different building while holding a tool selects it** (and puts the tool down), so you can work on what you tapped. Dropping a building onto a belt still builds.
- Saves move to v8. Older saves can't be converted: the main menu says so and starts fresh.

## 0.13.0 · 2026-10-21 · Round 4
- Fixed a crash ("Invalid array length") in enemy pathfinding. Path costs were stored at lower precision than they were computed, so rounding could add the same tile over and over until the queue overflowed, or skip tiles and leave enemies with no path.
- Place a furnace (or any one-tile building) straight onto a belt: it replaces the belt, faces along the line and starts working. Drags still go around belts.
- Hub ports have a docking collar joining them to the hub, and you can see items streaming out while one sends.
- Turrets and cannons touching the hub reload from hub stock.
- The hub stock panel fades while the mouse is over it or a finger is down on it, so you can see and build above the hub.

## 0.12.0 · 2026-10-21 · The escape ship (story phase 4)
- Research **Shipyard Plans** on the black market to unlock the **Shipyard**: a hidden 3×3 dock (one only, keep it away from the hub).
- Build the ship in four stages (hull, engine, life support, navigation) by belting parts into the shipyard. The ship takes shape on the pad as you go.
- **Launch** when it's finished, then hold the shipyard for 90 seconds against a doubled wave that comes for it. Survive, and you escape: a victory screen shows your run.
- **Come back** afterwards to keep playing in endless mode (the Company bills your return flight).
- Losing the shipyard stops a launch. Standard keeps the ship; Hardcore loses it.
- New "The escape ship" lesson. Saves move to v7.
- Browser tests now live in the repo (`e2e/`) and run in CI on desktop and phone viewports.
- Touch input guards against a lost finger-lift, which could have left later taps treated as a pinch.

## 0.11.0 · 2026-10-21 · Playtest batch 3
- Music: the Company's corporate theme on the main menu and a shuffled set of lo-fi tracks in game, crossfading from one to the next. Volume is in the pause menu. Tracks by velariomusic (Pixabay).
- New game has a "Start with the Essentials tutorial" box, so the basics can be replayed on any device.
- The Company Store and black-market lessons wait until you've read the email that announces them, and the black market (the eye button and the Stash) appears only once A Friend's email is read. Lessons no longer open over a window you're reading.
- The current contract is always on screen: each item's delivered / needed, under the top bar. Tap it for details.
- The How to play page describes blueprints and credits the music.

## 0.10.0 · 2026-10-21 · Playtest batch 2
- More time to build: the first wave now comes at 4:00 (was 3:00), then one every 2:00 (was 75 s).
- New games spread resource nodes out: node tiles never touch side by side, and patches are kept apart, so every node can be reached. Existing saves keep their maps.
- Soft placement: building can show a blueprint first, with ✓ (build), ⟳ (rotate, or reverse a belt line) and ✕ (cancel). Every placement on a touch screen is a blueprint; tap the same spot twice to build quickly, or switch it off in the menu. On desktop, single clicks still build at once, and dragging out a belt or wall line makes a blueprint (Enter builds, Esc or right-click cancels). Dragging back shortens a blueprint, and red tiles show where it's blocked or where your stock runs out.
- Belts look more like belts: they curve round corners (items follow the bend), chevrons show the direction, a line's end gets a hazard bumper, and metal flanges show where belts plug into splitters, tunnels and machines. Paired underground belts show a faint dotted trace.
- A whimsical forest look: grassy ground with tufts, flowers, mushrooms and pebbles; a band of trees around the map that the bugs crawl out from; fireflies and drifting leaves (switched off when the system asks for reduced motion). Ore nodes sit on dirt patches.
- More detailed bugs: a red jewel beetle (crawler), a long-legged ant-wasp (runner) and a horned rhino beetle (brute), each with a two-frame walk cycle that plays as they move.
- Hub stock is now shown just above the hub instead of along the top of the screen. When the hub is off screen, the stock is pinned to the edge; tap it to jump back.

## 0.9.0 · 2026-10-21 · Fixes
- Fixed a stretched picture and a misplaced tutorial spotlight on some iPhones. iOS Safari can change the visible area without telling the page (for example when the game is opened from a link in Messages). The game now re-measures the screen every frame.

## 0.8.0 · 2026-10-20 · Story phase 2, the black market
- A Friend gets in touch after your first contract and opens the black market (the eye in the top bar).
- Stash: hidden storage that the Company can't count. Skimmer: a belt piece that diverts every 4th item.
- Black-market research paid from the stash: Skimmer and Disguise Kit.
- Suspicion builds from missed contracts, skimming, hub-port withdrawals and contraband within 14 tiles of the hub.
- High suspicion brings an audit: an inspection drone sweeps the hub area. Standard fines each piece of contraband found; Hardcore confiscates and destroys it.
- New "Black market" tutorial lesson. New art: stash, skimmer, audit drone, eye icon. Saves move to v6.

## 0.7.0 · 2026-10-20 · Research over time
- Research now takes time: start one and it draws its items from hub stock over 30–150 seconds. It stalls if the hub runs out, and you can switch or pause without losing progress.
- The research button shows progress (or "stalled"). The research window shows items put in, time and a progress bar.
- Saves move to v5.

## 0.6.0 · 2026-10-20 · M3c playtest polish
- The hub has a built-in gun (no ammo). It beats wave 1 on its own; later waves still need turrets.
- The Company Store opens after your first contract closes.
- The mouse wheel rotates the building being placed, and zooms otherwise. Ctrl+wheel always zooms.
- Right-click puts down the tool and clears the selection. Right-drag still pans.
- Clicking or tapping outside a menu closes it.
- The tutorial is now six short lessons that start when they're useful (new game, first contract, first wave warning, store opening, splitters, first breach). Steps that ask you to build wait until you do it. Menu → Tutorials replays them or switches them off.

## 0.5.0 · 2026-10-20 · Story phase 1, the Company
- You start ¢48,750 in debt to Halcyon Extraction Co. (placeholder name).
- Timed shipping contracts: deliver the listed items to the hub to get paid, minus satirical deductions. Missed contracts are fined, and the next one grows.
- Inbox with Company emails: contracts, payslips, fines, licence fees, repair invoices, a wildlife advisory.
- Company Store: emergency supply crates on credit.
- Research charges a licence fee, and hub breaches send a repair invoice.
- Top bar: contract countdown and progress, plus a mail button with an unread count. The tutorial covers both.
- Saves move to v4; v3 saves gain the Company on load.

## 0.4.0 · 2026-10-20 · M3a, placeholder art and main menu
- Detailed placeholder art for every P1 and P2 sprite: items, resource nodes, ground, all buildings, the hub, and enemies. Turrets and cannons aim their barrels.
- Effects: muzzle flashes, cannon blasts, enemy death puffs, spawn warning markers, and a hub breach shockwave.
- Art pipeline: drop a PNG into `src/art/` with the same name as a placeholder to replace it.
- Main menu with a live demo factory behind it: Continue (shows mode and wave), New game, How to play.
- New menu style: navy and sky blue, flat icons, Montserrat headings. Toolbar and info panel show building and item art.
- The pause menu gains How to play and Main menu. Game over offers Main menu.

## 0.3.0 · 2026-10-19 · M2b, progression and onboarding
- Research tree replaces tiers. You start with belt, extractor and furnace, and research the rest using hub stock.
- Spotlight tutorial on first launch, which can be replayed from the menu.
- Hub ports put a chosen item from hub stock back onto belts, so stock can feed turrets.
- Standard mode: losing the hub causes a breach (stock lost, attack ends) instead of game over.
- Hardcore mode (losing the hub ends the run), unlocked by clearing wave 10 in Standard.
- A New game dialog to choose the mode.
- Starting iron plates raised from 80 to 100.
- Saves move to v3; v1 and v2 saves are migrated.
- Docs reorganised into `docs/`.

## 0.2.0 · 2026-10-19 · M2a: logistics and sustain
- Splitters, underground belts, repair stations and the runner enemy.
- Saves move to v2.

## 0.1.0 · 2026-10-19 · M1: prototype
- Core loop: extractors, belts, furnaces, workshops, assemblers, the hub, and tiers.
- Waves, turrets, cannons and walls. Touch and desktop controls. Autosave.
