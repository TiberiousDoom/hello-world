# Art list

Everything the game draws, plus what's needed for launch.

## How art gets into the game

Sprites live in **`src/art/<category>/<name>`** and are loaded automatically.
Every P1 and P2 asset already has a **placeholder SVG** there. To replace one,
add a **PNG with the same name** next to it (for example `src/art/items/gear.png`
beside `gear.svg`). The PNG wins and no code changes are needed. Delete the SVG once you're happy.

Status values: **Placeholder** = an SVG stand-in exists, **Upgraded** = the upgraded SVG from the art upgrade (0.40.0, D-075), **Reference** = drawn, kept in `docs/art-upgrade/`, not wired into the game yet, **Code** = drawn by the
renderer for now (a sprite can replace it later), **Needed** = not in the game
yet, **Final** = your art is in.

**Animations (D-082)** are strips: square frames side by side in one image, with the frame count at the end of
the name (`enemies/crawler_walk_4f.svg` is 4 frames of 64×64 in a 256×64 image). The loader cuts them into
frames. A PNG strip with the same name replaces an SVG one, like any sprite. The machines' working strips are
built from their sprites by `node art/working.mjs`; run it again after redrawing a machine.

![All placeholder art](art-placeholders.png)

**Art review 1 (2026-10-23):** the owner marked 7 sprites to polish and 6 to redraw, all done in 0.27.0. Still to come: bugs of different ages and sizes, and a Hardcore look (more horrifying bugs, nests as mounded holes); the nest plan is D-065.

**Art review 2 (2026-10-23, for 0.39.0):** every sprite as it was then, with 5 new and 23 changed since round 1 tagged, and new screenshots (including the engineer by a nest, and night). Round 1's marks were cleared. **Out of date since the art upgrade (0.40.0):** its sprites and screenshots show the art from before it. To do later, when the owner asks: rebuild the page from `src/art` and retake the screenshots (the build and screenshot scripts work from scene saves made by the game's own rules).
**Art upgrade (0.40.0, D-075):** every sprite was redrawn with one light source (top-left), soft contact shadows, one ink outline and glossy bugs; terrain got a lighter touch so the clearing keeps its look. Walls and palisades became sets that join into runs, nests became burrow entrances, and the animation strips, effects and seasonal trees are reference art in `docs/art-upgrade/` (see its README).
**Animated art (0.43.0, D-082):** the strips, effects and seasonal ground and trees from the art upgrade are in the game, and every machine that works has a working animation. The belt pieces are in the game too (0.73.0). Still reference only: the tesla bolt, which stays a guide for the code (`docs/art-upgrade/`).

Open `src/art/*/*.svg` in a browser or vector editor to see the placeholders up close.
They show the intended size, facing and silhouette.

## Specs (for every asset unless noted)

| | |
|---|---|
| **View** | Top-down (straight down). A slight ¾ tilt is fine if it's consistent |
| **Grid** | 1 tile = **64×64 px** at 1×. Please also export **128×128 (@2x)** for phones |
| **Format** | PNG with transparency. Keep layered source files (PSD, Aseprite, Krita…) |
| **Facing** | Directional sprites face **east (right)**; the game rotates them. If the lighting looks wrong rotated, provide all four directions as `_e`, `_s`, `_w`, `_n` |
| **Animation** | A horizontal strip of equal-size frames, with the frame count in the name, e.g. `belt_8f.png`. The loader doesn't read strips yet, so a single frame is the most useful first delivery. The game animates belts, glows and bobbing in code for now. **Exception, enemy walk cycles:** two separate files, `crawler.png` and `crawler_b.png`; the game swaps them as the bug walks |
| **Art direction** | A whimsical forest clearing (D-028): grassy ground, flowers and mushrooms, trees around the edge, fireflies and drifting leaves. The machines stay navy, steel and hazard-yellow, so they stand out from the greenery |
| **Padding** | Building art should leave about 4 px clear at each tile edge, so neighbours read as separate |
| **Naming** | Match the placeholder: `src/art/category/name.png`, e.g. `src/art/items/iron_plate.png` |
| **Palette** | Item colours must stay distinct for colour-blind players. Give each item a distinct **shape** as well |

Priority: **P1** = needed to replace the placeholders in the core loop,
**P2** = the rest of the current game, **P3** = polish and launch.

## Terrain

| Asset | Size | Frames | Priority | Status |
|---|---|---|---|---|
| Ground tile: grass, seamless, with a faint tile edge (3–4 variants so it doesn't look tiled) | 64×64 | 1 | P1 | Upgraded (`terrain/ground`, summer) |
| Seasonal ground (D-082): spring grass, fall leaf litter, winter snow | 64×64 | 1 each | P2 | Upgraded (`terrain/ground_spring`, `ground_fall`, `ground_winter`) |
| Map edge: soft shadow where the clearing meets the forest | — | 1 | P3 | Code |
| Iron ore node (2–3 variants), on a dirt patch with a transparent background | 64×64 | 1 | P1 | Upgraded |
| Copper ore node (2–3 variants) | 64×64 | 1 | P1 | Upgraded |
| Stone node (2–3 variants) | 64×64 | 1 | P1 | Upgraded |
| Decorations, transparent: grass tuft, flowers (2 colourways), mushrooms, pebbles. Scattered on empty tiles | 64×64 | 1 | P2 | Upgraded (`terrain/tuft`, `flowers`, `flowers_blue`, `mushrooms`, `pebbles`) |
| Trees, top-down canopies with a soft shadow: round, autumn, pine, berry bush. They fill a band around the map | 128×128 (2 tiles) | 1 | P2 | Upgraded (`terrain/tree_round`, `tree_autumn`, `tree_pine`, `bush`) |
| Map trees (D-044): the same canopies, drawn about 1.4 tiles across on every forest tile. Zoomed far out, a plain canopy colour | — | — | P2 | Uses the tree sprites |
| Seasonal trees (D-082): round and pine canopies for spring, fall and winter, with snow (pines) and frost (round trees) drawn over them in winter | 128×128 (2 tiles) | 1 each | P2 | Upgraded (`terrain/tree_round_spring`, `_fall`, `_winter`, `_winter_frost`; `tree_pine_spring`, `_fall`, `_winter`, `_winter_snow`) |
| Tree stump, with a sprouting twig, on a transparent background | 64×64 | 1 | P2 | Upgraded (`terrain/stump`) |
| Fireflies and drifting leaves | — | — | P3 | Code |

## Items

Drawn small on belts (about 20 px on screen) and larger in menus, so they need simple, bold silhouettes.

| Asset | Size | Priority | Status |
|---|---|---|---|
| Iron ore | 32×32 (+64×64 for UI) | P1 | Upgraded |
| Copper ore | 32×32 (+64×64) | P1 | Upgraded |
| Stone | 32×32 (+64×64) | P1 | Upgraded |
| Iron plate (a dark grey, flat square plate) | 32×32 (+64×64) | P1 | Upgraded (redrawn after the art review) |
| Copper ingot | 32×32 (+64×64) | P1 | Upgraded |
| Brick | 32×32 (+64×64) | P1 | Upgraded |
| Gear | 32×32 (+64×64) | P1 | Upgraded |
| Copper wire | 32×32 (+64×64) | P1 | Upgraded |
| Motor | 32×32 (+64×64) | P1 | Upgraded |
| Log | 32×32 (+64×64) | P2 | Upgraded |
| Plank (a long, flat board) | 32×32 (+64×64) | P2 | Upgraded (redrawn after the art review) |
| Stake (a bundle of two sharpened stakes) | 32×32 (+64×64) | P2 | Upgraded |
| Charcoal | 32×32 (+64×64) | P2 | Upgraded |
| Steel (an ingot, cooler and brighter than iron plate) | 32×32 (+64×64) | P2 | Upgraded |
| Dowel (three round wooden rods, D-105) | 32×32 (+64×64) | P2 | Placeholder (`items/dowel`) |
| Peg (two tapered wooden pegs) | 32×32 (+64×64) | P2 | Placeholder (`items/peg`) |
| Rope (a coil of rope) | 32×32 (+64×64) | P2 | Placeholder (`items/rope`) |
| Truss (a small triangular wooden frame) | 32×32 (+64×64) | P2 | Placeholder (`items/truss`) |
| Iron ingot (a grey bar, cooler than copper's, D-113) | 32×32 (+64×64) | P2 | Placeholder (`items/iron_ingot`) |
| Iron rod (three long round bars) | 32×32 (+64×64) | P2 | Placeholder (`items/iron_rod`) |
| Rivet (two domed rivets) | 32×32 (+64×64) | P2 | Placeholder (`items/rivet`) |

Ponds (D-115) are drawn in code: a muddy shore, water, deeper water away from the edge, and glints close up.

Ore nodes are drawn at 0.86 of a tile on a shared bed of earth, so touching tiles read as one patch (D-096).

## Buildings

| Asset | Tiles | Notes | Frames | Priority | Status |
|---|---|---|---|---|---|
| Hub | 8×8 (512×512; 5×5 before D-108, the same art scaled up) | Centrepiece, with a damaged variant drawn below half health (`buildings/hub_damaged`) | 1 (+idle loop) | P1 | Upgraded |
| Wooden roller (D-106): a narrow wooden frame with rollers across | 1×1 | Drawn in code in play (frame, turning rollers, corners as an L); the sprite is the toolbar icon | 1 | P2 | Placeholder (`buildings/roller`) |
| Storage crate (D-106): a wooden crate, its front marked | 1×1 | | 1 | P2 | Placeholder (`buildings/crate`) |
| Storage Unit (D-116): a steel cabinet of six compartments, its front marked | 1×2 (64×128), facing east | Sends out of its top tile's front | 1 | P2 | Placeholder (`buildings/storage`) |
| Ship scaffolding (D-109): a wooden lattice around the pad, seen from above | 5×5 | The ship's first stage on the map (`buildings/ship_scaffold`); the shipyard and the other ship stages are drawn at 5×5 too (3×3 before D-109) | 1 | P2 | Placeholder |
| Ship launch pad (D-118): a brick slab with a riveted iron blast plate in the middle, seen from above | 5×5 | The ship's Iron Age stage (`buildings/ship_pad`), drawn under the scaffolding and the ship | 1 | P2 | Placeholder |
| Spike pit (D-107): a dug pit bristling with sharpened stakes | 1×1 | A charge bar shows its wear | 1 | P2 | Placeholder (`buildings/spike_pit`) |
| Trebuchet (D-107): a wooden frame, and its throwing arm with a counterweight and sling | 2×2 | Base and arm (`_base`, `_barrel`), the arm turning to aim like a turret's barrel | 1 | P2 | Upgraded in 0.87.7: an open timber frame on a turntable with stone shot piled in a corner; the arm with uprights, an iron-banded counterweight and a loaded sling (`buildings/trebuchet_base`, `buildings/trebuchet_barrel`) |
| Belt (straight) | 1×1 | Moving surface; must tile seamlessly end to end | 8 | P1 | Upgraded |
| Belt (corner) | 1×1 | A quarter turn of the rails and bed, coming in from the west and leaving south. Other turns rotate it, and left turns mirror it. The slats moving round the bend are drawn in code over it | 1 | P3 | Upgraded (`buildings/belt_corner`, `express_belt_corner`) |
| Belt end cap, start lip, join flange | 1×1, facing east, transparent but for the piece | Drawn over a belt: a hazard bumper on the east edge where a line stops, a rail lip on the west edge where it starts, a metal flange on the east edge where a belt meets a building (turned to that side) | 1 | P3 | Upgraded (`buildings/belt_end`, `belt_start`, `express_belt_start`, `belt_flange`) |
| Extractor | 2×2 (128×128) | Drill, facing east. The game draws an output port at the middle of the east edge. Working: the rotor turns, chips fly | 1 + 4 working | P1 | Upgraded; working strip `extractor_working_4f` |
| Furnace | 2×2 (128×128) | Idle and working, facing east. Working: flames, embers, smoke from the chimney | 1 + 4 | P1 | Upgraded; working strip `furnace_working_4f` |
| Workshop | 2×2 (128×128) | Idle and working, facing east. Working: the gears turn, the lamp blinks | 1 + 4 | P2 | Upgraded; working strip `workshop_working_4f` |
| Blacksmith (D-113): a forge of glowing coals, an anvil with an ingot on it, a hammer, a stack of ingots | 2×2 (128×128) | Idle and working, facing east. Working: the hammer swings and strikes, sparks fly, the coals breathe | 1 + 4 | P2 | Placeholder; working strip `blacksmith_working_4f` |
| Drive shaft (D-115): a steel rod with a coupling, running east–west | 1×1 | Laid in lines; turned to run along them | 1 | P2 | Placeholder (`buildings/shaft`) |
| Well (D-115): a round stone well with water inside and a crank across it | 2×2 (128×128) | Always working: the crank turns | 1 + 4 | P2 | Placeholder; working strip `well_working_4f` |
| Water wheel (D-115): a wooden gearbox on land with a shaft out to a paddle wheel at its front, in the water | 3×1 (192×64), facing east | Always working: the wheel turns, spray flies | 1 + 4 | P2 | Upgraded in 0.87.7: meshing gears in the gearbox, a rimmed wheel with a bolted hub; working strip `water_wheel_working_4f` |
| Machine Shop (D-113): a lathe and two gears on a steel floor | 2×2 (128×128) | Idle and working, facing east. Working: the lathe's chuck spins, the gears turn, the light blinks | 1 + 4 | P2 | Placeholder; working strip `machine_shop_working_4f` |
| Assembler | 3×3 (192×192) | Idle and working, facing east. Working: the arm nods and welds, the gear turns, the lights take turns | 1 + 4 | P2 | Upgraded; working strip `assembler_working_4f` |
| Splitter | 1×2 (64×128), facing east | A box straddling two belt lanes, an arrow on each: two lanes in, two out (#34) | 1 | P2 | Upgraded |
| Underground belt entrance | 1×1 | A belt running into a hooded mouth on the east side, diving underground (#35) | 1 | P2 | Upgraded |
| Underground belt exit | 1×1 | A belt coming up out of a hooded mouth on the west side (#35) | 1 | P2 | Upgraded |
| Hub port | 1×1 | Should look like part of the hub, with output to the east | 1 | P2 | Upgraded |
| Turret base | 1×1 | Static | 1 | P1 | Upgraded |
| Turret barrel | 1×1 | Separate layer that rotates to aim; centred pivot | 1 | P1 | Upgraded |
| Cannon base | 1×1 | | 1 | P2 | Upgraded |
| Cannon barrel | 1×1 | Separate layer, as for the turret | 1 | P2 | Upgraded |
| Repair station | 1×1 | A workshop pad: a cog with a spanner across it, a welding arm with sparks, a toolbox. Working (mending something): the torch flares, the cog turns | 1 + 4 working | P2 | Upgraded (redrawn after the art review); working strip `repair_working_4f` |
| Shipyard | 3×3 (192×192) | A landing pad under camouflage netting, with gantries | 1 | P2 | Upgraded |
| Ship stages | 3×3 overlays | The ship standing upright on its pad, in a three-quarter view (seen from the front and a little above), drawn stage by stage: `ship_hull`, `ship_engine`, `ship_life`, `ship_nav`. Each overlay holds only its own parts. The game draws engine flames at launch | 1 each | P2 | Upgraded |
| Lumber Camp | 2×2 (128×128) | A log pile and a saw, facing east. The game draws an output port at the middle of the east edge. Working: the saw spins, sawdust flies | 1 + 4 working | P2 | Upgraded; working strip `lumber_camp_working_4f` |
| Sawmill | 2×2 (128×128) | A saw bench, logs in and planks out, facing east. Working: the saw spins, the log feeds in, sawdust flies | 1 + 4 working | P2 | Upgraded; working strip `sawmill_working_4f` |
| Palisade set | 1×1 each | Chosen from neighbours: east–west runs seen from above as log tops (`palisade`), north–south runs in side view (`palisade_v`), corners `palisade_nw`, `_ne`, `_sw`, `_se`, gate ends `palisade_end_w`, `_end_e` and a lone post `palisade_post` | 1 | P2 | Upgraded |
| Leaf burst when a tree is cut | 64×64 | 4 | P3 | Upgraded (`effects/leaf_burst_4f`) |
| Express belt (straight) | 1×1 | Like the belt, with hazard-yellow rails so it reads as faster. Its corner and start lip are sprites with the same rails | 8 | P2 | Upgraded (`buildings/express_belt`) |
| Ballista base | 1×1 | A wooden platform | 1 | P2 | Upgraded; redrawn in 0.87.7 as a plank platform with a turntable and spare bolts (`buildings/ballista_base`) |
| Ballista bow | 1×1 | Separate layer that turns to aim: the bow at the front of the stock, string drawn back, no arrow; centred pivot | 1 | P2 | Upgraded (`buildings/ballista_barrel`) |
| Tesla base | 1×1 | Static | 1 | P2 | Upgraded (`buildings/tesla_base`) |
| Tesla coil | 1×1 | Separate layer that turns to aim, like the turret barrel, no arrow; centred pivot | 1 | P2 | Upgraded (`buildings/tesla_barrel`) |
| Tesla lightning | — | A jagged bolt with a glow, redrawn every frame | — | P3 | Code; Reference `effects/tesla_bolt` (a guide for the code) |
| Wall set | 1×1 each | Near top-down capstones, chosen from neighbours: `wall` (east–west), `wall_v`, corners `wall_nw`, `_ne`, `_sw`, `_se`, gate ends `wall_end_w`, `_end_e` and a lone pier `wall_pier` | 1 | P2 | Upgraded |
| Steel Works (D-120): a rolling mill, two steel rolls with a glowing billet between them, beams stacked below | 2×2 | Static, plus a 4-frame working strip (rolls turning, billet feeding, glow) | 1 + 4 | P2 | Placeholder (`buildings/steel_works`, `steel_works_working_4f`) |
| Steel beam and bearing items (D-120) | 16×16 | An I-beam; a ball bearing | 1 each | P3 | Placeholder (`items/steel_beam`, `items/bearing`) |
| Boiler (D-121): a brick firebox with a riveted steel drum, a fire behind the grate and a smoke stack | 2×2 | Static, plus a 4-frame working strip (fire flickering, glow, smoke) | 1 + 4 | P2 | Placeholder (`buildings/boiler`, `boiler_working_4f`) |
| Steam Turbine (D-121): a bladed rotor in a steel casing, with a copper generator coil | 2×2 | Static, plus a 4-frame working strip (rotor turning, spark) | 1 + 4 | P2 | Placeholder (`buildings/steam_turbine`, `steam_turbine_working_4f`) |
| Power pole (D-121): a wooden pole with a cross-arm and three insulators, seen from above | 1×1 | Static; the game draws the wires between poles | 1 | P2 | Upgraded in 0.87.7: glass insulators, braces, stones at its foot and a long shadow (`buildings/power_pole`) |
| Storage Silo (D-122): a round steel silo roof inside a square frame, with an output hatch | 2×2 | Static | 1 | P2 | Placeholder (`buildings/storage_silo`) |
| Mk2 plate (D-122) | — | A gold plate with two chevrons on Mk2 extractors and furnaces, dim without electricity | — | P3 | Code |
| Sulfur node (D-123) | 1×1 | Yellow crystals in rock, like the other ore nodes | 1 | P2 | Placeholder (`terrain/node_sulfur`, recoloured from copper) |
| Powder Mill (D-123): a stone pan with two edge runners, sulfur and charcoal bins | 2×2 | Static, plus a 4-frame working strip (runners turning, light) | 1 + 4 | P2 | Placeholder (`buildings/powder_mill`, `powder_mill_working_4f`) |
| Circuit Works (D-125): a green circuit board with a chip and a placing head, coils in a tray, a lightning mark | 2×2 | Static, plus a 4-frame working strip (head dipping, solder spark, light) | 1 + 4 | P2 | Placeholder (`buildings/circuit_works`, `circuit_works_working_4f`) |
| Circuit board and coil items (D-125) | 16×16 | A green board with a chip; a copper coil on a core | 1 each | P3 | Placeholder (`items/circuit`, `items/coil`) |
| Arc Fence (D-126): steel posts with a lightning insulator, three live wires between them | 1×1, a run set like the walls (`arc_fence`, `_v`, corners, ends, `_pier`) | Static | 9 | P2 | Placeholder (`buildings/arc_fence*`) |
| Floodlight (D-126): a lamp head with three bulbs on a post | 1×1 | Static (its light at night is drawn in code) | 1 | P2 | Placeholder (`buildings/floodlight`) |
| Drone Pad (D-128): a landing pad with a yellow H in a dashed ring and corner lights | 1×1 | Static | 1 | P2 | Placeholder (`buildings/drone_pad`) |
| Drone (D-128): a small quadcopter seen from above, rotors spinning, carrying an item | ~0.5 tile | Drawn in code | — | P3 | Code |
| Shield Pylon (D-129): an octagonal plate with a glowing blue orb | 1×1 | Static (its dome is drawn in code) | 1 | P2 | Placeholder (`buildings/shield_pylon`) |
| Railgun (D-129): an octagonal base with a ring of lights; twin rails with copper coils on a turret | 2×2 | Base, plus a barrel layer that turns to aim | 2 | P2 | Placeholder (`buildings/railgun_base`, `railgun_barrel`) |
| Teleporter Pad (D-131): a violet pad with a glowing portal ring | 1×1 | Static | 1 | P2 | Placeholder (`buildings/teleporter`) |
| Orbital Strike Beacon (D-131): a dish on a mast with a red light, hazard stripes | 1×1 | Static (the strike is drawn in code) | 1 | P2 | Placeholder (`buildings/strike_beacon`) |
| Greenhouse (D-131): saplings under glass panes | 2×2 | Static | 1 | P2 | Placeholder (`buildings/greenhouse`) |
| Tree Nursery (D-134): a fenced plot with rows of saplings growing up, and a watering can | 2×2 | Static | 1 | P2 | Placeholder (`buildings/tree_nursery`) |
| Turret Mk.2 (D-123): a darker turret base and a four-barrel head | 1×1 | Base and barrel (`turret2_base`, `turret2_barrel`), like the turret | 2 | P2 | Placeholder |
| Steel wall set (D-123) | 1×1 each | The wall set in blue-grey steel, the same pieces (`steel_wall`, `_v`, corners, ends, `_pier`) | 1 | P2 | Placeholder (recoloured from the wall set) |
| Sulfur, gunpowder, casing and bullet items (D-123) | 16×16 | A yellow crystal; a powder sack; a brass casing; two cartridges | 1 each | P3 | Placeholder |
| Mortar (D-124): a squat tube on a green-grey turret base | 1×1 | Base and barrel (`mortar_base`, `mortar_barrel`), like the turret | 2 | P2 | Placeholder |
| Artillery (D-124): a long gun in a turret on a big octagonal base | 2×2 | Base and barrel (`artillery_base`, `artillery_barrel`), like the trebuchet | 2 | P2 | Placeholder |
| Shell item (D-124) | 16×16 | A shell with a brass case | 1 | P3 | Placeholder (`items/shell`) |
| AP bullets item (D-136) | 16×16 | Two bullets with pointed blue-steel tips | 1 | P3 | Placeholder (`items/ap_bullet`) |
| Explosive shell item (D-136) | 16×16 | A shell with a red nose and yellow bands | 1 | P3 | Placeholder (`items/he_shell`) |
| Reinforced wall set (D-117) | 1×1 each | The wall set in iron-grey stone with iron straps and rivets, the same pieces (`reinforced_wall`, `_v`, corners, ends, `_pier`) | 1 | P2 | Placeholder (recoloured from the wall set) |
| Construction / ghost overlay | 1×1 | Optional: the game can tint sprites instead | 1 | P3 | Optional |

## Units

| Asset | Size on screen | Frames | Priority | Status |
|---|---|---|---|---|
| Engineer (the player character, #40): top-down, facing east; orange overalls and boots (the animation strips; the older single sprite has a yellow hard hat) | 1 tile (64×64) | 4 walk, 4 work (mining by hand, facing the ore), 4 idle, 4 knocked out (seeing stars where it fell) | P1 | Upgraded (`units/engineer_walk_4f`, `_work_4f`, `_idle_4f`, `_ko_4f`; `engineer` and `engineer_b` until they load) |

## Enemies

All top-down and facing east. Each has a 4-frame walk, stepping as the bug moves, and a 4-frame attack,
played while an angry bug stands at a building or an engineer (D-082). The older two walk frames (`name` and
`name_b`) are drawn until the strips load.

| Asset | Size on screen | Frames | Priority | Status |
|---|---|---|---|---|
| Crawler: long, flat and segmented, six legs, dark orange | ~28 px (fits a 32×32 frame) | 4 walk, 4 attack | P1 | Upgraded (`crawler_walk_4f`, `crawler_attack_4f`; `crawler`, `crawler_b`; redrawn after the art review) |
| Runner: glossy black, centipede-like, many legs | ~22 px (32×32); in play drawn about 3× as long | 4 walk, 4 attack | P2 | Upgraded (`runner_walk_4f`, `runner_attack_4f`; `runner`, `runner_b`; redrawn after the art review). In play it's drawn in code since #96: a long segmented body that follows its trail and sways; the sprites remain for the menu and fallbacks |
| Brute: four-legged and centaur-like (no human top): a heavy rear body, a raised front body with two hooked claws; very dark red | ~46 px (64×64) | 4 walk, 4 attack | P2 | Upgraded (`brute_walk_4f`, `brute_attack_4f`; `brute`, `brute_b`; redrawn after the art review) |
| Wasp (D-135): striped yellow and black, four see-through wings, red eyes | ~28 px (64×64) | 2 wingbeats | P2 | Placeholder (`wasp`, `wasp_b`; drawn above the trees, with a ground shadow) |
| Beetle (D-135): a domed blue-black shell split down the middle, six legs, glowing eyes | ~40 px (64×64) | 2 walk | P2 | Upgraded in 0.87.7: glossy split wing cases, an armoured collar, mandibles, jointed legs (`beetle`, `beetle_b`) |
| Young crawler, runner and brute (D-065, D-071): smaller, duller versions that grow into the adults | about 60% of the adult | 2 walk each | P2 | Code (the adult sprites drawn smaller, duller and a little darker, D-075) |
| Death puff or splat (shared) | 64×64 | 4–6 | P2 | Upgraded (`effects/death_splat_4f`) |

## Effects

| Asset | Size | Frames | Priority | Status |
|---|---|---|---|---|
| Muzzle flash | 32×32 | 2–3 | P3 | Upgraded (`effects/muzzle_flash_3f`) |
| Cannon shell, flying the length of a cannon shot | 16×16 | 1 | P3 | Upgraded (`effects/cannon_shell`) |
| Explosion (cannon splash) | 128×128 | 6 | P3 | Upgraded (`effects/explosion_6f`) |
| Hit spark, where a turret or ballista shot lands | 32×32 | 3 | P3 | Upgraded (`effects/hit_spark_3f`) |
| Repair sparkle, on the building being mended | 32×32 | 4 | P3 | Upgraded (`effects/repair_sparkle_4f`) |
| Building destroyed (debris) | 64×64 | 5 | P3 | Upgraded (`effects/debris_5f`) |
| Nest burrow and territory outline | 2×2 tiles, drawn 1.7, 2 or 2.3 tiles across by stage (D-132); outline in code | 1 + angry + damaged + destroyed + grown | P2 | Upgraded (`nests/warren`, `hive`, `den` by kind, `nests/hardcore` in Hardcore, overlays `nests/angry`, `nests/damaged`, `nests/grown` (egg clutches and a side burrow at the lower left, drawn turned half round as well for a large nest) and `nests/destroyed`); blight around nests is drawn in code, over every cell a merged nest owns |
| Queen nest (D-132) | 3×3 tiles, drawn 1.3× a nest's size (merged nests too) | 1 | P2 | Upgraded (`nests/queen`) |
| Chitin (item, D-065): an olive bug-shell plate | Item size | 1 | P2 | Upgraded (`items/chitin`) |
| Hub breach (shockwave) | 256×256 | 6 | P3 | Code |

## UI

The menus use a flat, two-colour style: navy `#1d3b6e` and sky blue `#3fa9f5`
on white, with bold, rounded silhouettes. Icons are drawn white with one
sky-blue accent shape, on a 24×24 grid. If an icon uses the colour names
`var(--icon-accent, #3fa9f5)` and `var(--icon-ink, #1d3b6e)`, the game can recolour it on highlighted buttons.

| Asset | Size | Priority | Status |
|---|---|---|---|
| App icon master | 1024×1024 (no transparency, for the stores) | P3 | Needed (after naming). Can start from `ui/logo.svg` |
| Favicon / PWA icons | 512×512 and 192×192 | P3 | Placeholder |
| Logo / wordmark | Vector (SVG) | P3 | Upgraded mark `ui/logo.svg`; the wordmark is text for now |
| UI icons (`src/art/ui/`): health, research, pause, play, fast, menu, rotate, demolish, close, save, help, home, new, lock, skull, factory, collect, feedback, coop, undo, copy, settings | 24×24 grid, SVG preferred | P3 | Upgraded |
| Research icons (one per research, 10 today) | 64×64 | P3 | Optional |
| Toolbar building icons | Uses the building sprites; no extra art needed | — | — |

## Audio (not art, but listed so it isn't forgotten)

**Sound effects: done** (synthesized in code, D-043): building placed, belt placed, demolished,
blocked placement, turret shot, cannon shot, hub gun, enemy death, building destroyed, hub hit,
breach, research complete, ship stage, launch, nest provoked, UI click, tree chopped, tesla zap, and a
machine-running hum that follows how busy the factory on screen is. Recorded sounds can replace any of them.

**Music: done.** Nine original tracks in a late-90s adventure style, generated in code: the menu
theme, seven tracks for play and a fanfare for the first delivery (`audio/compose/`, D-051, D-052). See
[GAME_DESIGN.md](GAME_DESIGN.md#music).

## Not needed

- Separate toolbar icons (the building sprites are reused)
- Fonts: Montserrat (SIL Open Font License) loads from Google Fonts for headings; body text uses the system UI font
