# Roadmap

Status: ✅ done · 🚧 in progress · ⬜ planned · ❓ needs a decision ([DECISIONS.md](DECISIONS.md))

The roadmap tracks **workstreams**, not just features, so that art, release,
quality and business work don't get left until the end.

## Milestones at a glance

| Milestone | Goal | Status |
|---|---|---|
| M1: Prototype | The core loop is playable in the browser | ✅ |
| M2a: Logistics and sustain | Branching lines, tunnels, repair | ✅ |
| M2b: Progression and onboarding | Research, tutorial, modes, hub ports, docs | ✅ |
| M3a: Placeholder art and main menu | Detailed placeholder sprites, art pipeline, main menu, menu style | ✅ |
| M3b: Final art and sound | Replace placeholders with final sprites, plus sound | 🚧 Music and sound effects done; upgraded sprites (0.40.0, D-075); animations, effects, seasonal art and working machines (0.43.0, D-082); the app icon (0.88.5). Left: decide whether the upgraded art ships (Q-1), young-bug art, a hub idle loop |
| M3c: Playtest polish | Playtest notes: tutorial, store lock, hub weapon, controls; batch 2 (blueprints, belts, forest); batch 3 (music, tracker, lessons) | ✅ |
| M4: Depth | Upgrades, more content, balance | 🚧 The research tree in four ages is built (D-093, D-113, D-119, D-125), with defence tiers (D-142). Left: a balance pass |
| M4s: Story layer | Colony supply ship with repeat runs and colony blueprints (D-046 to D-050) | ✅ Supply runs and colony blueprints. Food (phase 3) is set aside for wood (D-044); the Company, contracts and black market were dropped (D-040) |
| M4m: Open map | Procedural 256×256 map, bug territories instead of waves, bigger buildings, leaner screen (D-038 to D-042) | ✅ |
| M4w: Wood | Trees in the simulation, Lumber Camp, planks, palisades, stake turret, charcoal and steel (D-044) | ✅ Phases 1 and 2, the Wood Age (0.47.0 to 0.51.0) built on them, and phase 3, forests and bugs (0.76.0, D-134) |
| M4c: Co-op | 2–10 players in one shared world (10 since 0.44.0, D-083) (D-056, [COOP.md](COOP.md)) | ✅ Phases 0–3 (0.42.0, D-078 to D-081), the dedicated server (0.44.0) and player-made rooms (0.89.0). Balance for more players after playtesting |
| **M4p: Playtest-ready** | **Friends and family can play for weeks without losing saves, and every problem they hit reaches us (D-170)** | 🚧 7 playtesters, all people the owner knows. See Next up |
| M5: Release | A paid release on Google Play (D-180), with the purchase decided (Q-25) | ⬜ |
| M6: 3D | Low-poly 3D renderer | ⏸ Not planned for now (D-170). The rules stay apart from drawing, so it stays possible |

## Next up (in order)

The game's content is built: four ages, co-op, the server, art and music. What's left before a release is getting it
in front of players, hearing what they hit, and deciding how it's sold (D-170). In this order:

1. ✅ **What new players hit first** (0.92.2, D-171): no more sending the engineer somewhere by accident (#213); the
   shipyard's crane works only when something arrives (#212).
2. ✅ **Saves that can't be lost** (0.93.0, D-172): export and import in Settings; the browser asked to keep the game's
   storage; iPhone players in Safari told to add the game to the Home Screen, since Safari deletes a site's storage
   after about 7 days without a visit. Import also let the game move to playnestfall.com (0.95.0, D-181).
3. ✅ **Error reports that arrive by themselves** (0.94.0, D-173): with the player's consent, a page error is sent to
   our own relay, not a third party, where the developer reads them (D-175); the privacy page says so.
4. 🚧 **A first balance pass:** ✅ the balance script (0.94.1, D-174) pits each age's reference outpost against every
   kind of nest, and at each threat level. ✅ Bugs no longer ignore steel-walled bases (0.94.3, D-176). Kept full,
   the Wood outpost holds against warrens, runnels and hives at every threat level, dens to threat 5 and barrows to
   threat 2 (stage 3 nests); the Iron, Steam and Electric outposts hold against every nest at threat 10. ✅ The owner
   keeps these as the targets (0.94.4, D-177), and a test checks them. ⬜ The 7 playtesters' notes.
5. ⬜ **Playtest round with the 7 playtesters:** what they hit goes into `playtest` issues through the feedback form.
   Then more playtesters, people the owner doesn't know.
6. 🚧 **Decide the first paid platform and what the purchase is.** ✅ Google Play first (D-180). ❓ What the purchase
   is (Q-25). Everything in Platform and release depends on these.
7. ⬜ **Start the community and the store page early** (see Launch and community): wishlists and followers take months.

Open playtest issues not yet placed: the trebuchet's aim and flying rock (#174, #211, in progress elsewhere), and
reworking the sound effects while keeping their retro style (#214: rounds 1 and 2 in 0.95.1 and 0.95.2, round 3 on the sound board).

The old "Next up" list, with everything built so far in order, is at the end: [History](#history-the-old-next-up-list).

---

## 1. Gameplay

### Done
- ✅ Map generation, extractors, belts, furnaces, workshops, assemblers (M1)
- ✅ Hub stock pays for buildings, with refunds on demolish (M1)
- ✅ Waves, flow-field pathing, turrets, cannons, walls (M1). Waves replaced by bug territories (D-038)
- ✅ Splitters, underground belts, repair stations, runner enemy (M2a)
- ✅ Research tree replaces tiers, and play starts with 3 buildings (M2b)
- ✅ Start from nothing: mining by hand, Collect, and belts from Logistics as the first research (#38, D-062)
- ✅ Hub ports for sending items back out of the hub (M2b, D-006 proposed)
- ✅ Standard and hardcore modes, with the hardcore unlock (M2b)
- ✅ Spread-out resource nodes for new games, and longer gaps between waves (playtest batch 2, D-029, D-031)
- ✅ Procedural 256×256 map with noise ore fields; bug territories in 10×10 cells that attack when provoked and calm down after 30 s (D-038)
- ✅ Building sizes: extractor and furnace 2×2, workshop 3×2, assembler 4×2, hub 5×5, with a marked output port (D-039); later a 2×2 workshop, 3×3 assembler and 1×2 splitter (D-063)
- ✅ Nest mounds with health and chitin (D-065, D-066), and the engineer (D-067)
- ✅ Day, night and seasons (D-068)
- ✅ Two-lane belts, splitter filters, and splitters that snap to either side of a belt (#61, #62, #63, D-069)
- ✅ Underground belt helpers: an exit blueprint, and belt lines that go under belts they cross (#64, #65, D-070)

### Story layer (M4s, [STORY.md](STORY.md))
- ✖ Phases 1 and 2 (Company contracts, inbox, store, black market, suspicion) were built, then dropped (D-040)
- ⏸ Phase 3: food factories and meal buffs. Set aside for wood (D-044)
- ✅ Phase 4: shipyard, four-stage escape ship, launch defence, victory screen and endless mode (D-019, D-034). Now unlocked by normal research; launching wakes nearby nests (D-040). Becoming the supply ship (D-046)
- ✅ **Colony supply runs (D-046)**, in this order:
  - ✅ **Phase 1, supply runs (D-047, D-048):** after the ship is built, a cargo list to belt in; launch (countdown and woken nests, as now); lift-off delivers instead of ending the game; a celebration screen on the first delivery, which also unlocks Hardcore; the ship returns after a while, and each run's cargo list is bigger. The victory screen, "escaped" and the endless choice go. Saves move to v10, migrating escaped and endless games to one delivered run
  - ✅ **Phase 2, colony rewards (D-049, D-050)**, in this order:
    - ✅ **2a, blueprints and a heavier ship:** after each delivery the colony offers two blueprints you can't research, and you pick one (a screen that pauses the game). The other stays on offer for later runs; with one left it's simply given, with none left there's no offer. The offer and the blueprints you have are saved (v11), so a reload doesn't lose a pending choice. Research shows a "From the colony" section. Each run's launch wakes nests further out: 48 tiles, +8 per run delivered, up to 96, because the loaded ship is heavier and needs more thrust. Woken bugs keep coming for the shipyard, and the floor of 3 nests stays (both built in phase 1, D-048). The shipyard panel shows the radius and how many nests it will wake before you launch
    - ✅ **2b, Express Belt:** 3 tiles/s (twice a belt). With the Express Belt selected, **a single tap or click on a belt upgrades that whole belt line in place**: no demolishing, no dragging, and no ✓ blueprint step on touch. A line is every belt joined to the tapped one belt-to-belt, in both directions, including belts merging in from the side; it stops at any other building (a splitter, tunnel, machine or the hub). Each belt keeps its facing and the items on it, and the old belts are refunded. If stock runs short, it upgrades as many as it can afford, starting from the tapped belt, and says how many were left. Sprite, and its own chevron speed
    - ✅ **2c, Tesla Turret:** fed by copper wire by belt. Each shot arcs from the nearest bug to up to 2 more within 2 tiles. Sprite, a lightning effect and a zap sound
    - ✅ **Later blueprints (D-055):** most of them came through research in the four ages instead (Mk2 machines, the Mortar, drone pads, the Shield Pylon, the Storage Silo, Floodlights). The colony's pool is the special buildings (D-131) and the Tree Nursery (0.76.0, D-134)
    - Tests for each step: unit tests for offers, picking, unlocks, the wake radius, express belt speed and upgrading, and tesla chains; a browser test that picks a blueprint after a delivery
- ⏸ Vehicles and gear (D-021)

### Playtest polish (M3c)
- ✅ **Hub weapon:** the hub has a built-in gun (range 8 from its centre) that needs no ammo and never upgrades (D-024)

### Wood (M4w, D-044)
Not the escape ship's hull. In this order:
- ✅ **Phase 1, trees and the basics:** forest from map generation, saved (v9, with a v8 migration); trees block building and stumps don't. A Lumber Camp cuts the nearest tree in reach into logs, and stumps regrow. A Sawmill makes planks (D-045). Palisade walls made of planks. Forestry and Palisades research. Placeholder sprites, a chop sound and a leaf burst
- ✅ **Phase 1 follow-ups:** a Wood lesson when Forestry is researched, a lumber camp and sawmill in the main-menu demo, and a browser test
- ✅ **Phase 2, wood in the economy (D-054):** the Ballista, firing stakes sawn from planks; repair stations also burn planks; planks in the Workshop, Repair Station and Shipyard (Workshops now needs Forestry); charcoal (furnace, from logs), then steel (charcoal and iron plates), carried from the fourth supply run on and the material for upgrades to come. Also: Reset tutorials in Menu → Tutorials
- ✅ **Phase 3, forests and bugs** (0.76.0, D-134): about 1 nest in 5 deep in forest; cutting trees inside a territory provokes it; trees slow bugs and their paths, so clearing forest opens paths; the Tree Nursery, a colony blueprint that plants new forest

### Co-op (M4c, D-056, [COOP.md](COOP.md), #41)
In this order. Phase 0 can start before the player character (playtest issue #40), which then builds on it:
- ✅ **Phase 0, prepare in single player (D-058):** every world-changing action goes through a command list; players and the path-refresh timers in the saved state (a save version bump); a clock driven by commands; `Math.hypot` out of the rules; a summary hash and a cross-browser determinism test. No visible change. Building it added a checkpoint command, so a game joining from a snapshot has the same path fields as the host
- ✅ **Before phase 1: the player character** (0.32.0, #40, D-067), built on commands; bugs notice it (0.39.0, D-074)
- ✅ **Phase 1, two-player prototype:** the relay on Cloudflare (0.41.0, D-077); Play together (0.42.0, D-078): room codes, a version check on joining, lockstep with a 3-tick input delay stamped by the host, every engineer visible with a ring in its player's colour, no pausing for lessons, the first delivery or the blueprint pick, and a mismatch warning
- ✅ **Phase 2, make it solid** (0.42.0, D-079): joining mid-game from a snapshot, a fresh copy for a guest out of step or 20 s behind, reconnecting after a dropped connection, the shared game saved in every player's browser (a co-op slot apart from your own factory), a departed player's engineer back at the hub at once. The host never waits for a guest, so a slow guest can't hold anyone up. The host reconnecting came after (D-081)
- ✅ **Phase 3, co-op design** (0.42.0, D-080): pings, the blueprint offer as a card that doesn't block play (with Later), per-player messages ("your engineer"), engineers side by side at the start, 4-player tests. Player colours came in phase 1. ⬜ Balance for more players, after playtesting
- ✅ **The host reconnecting** (0.42.0, D-081): the relay keeps the room a minute for a host whose connection dropped; only the host's key takes it back; keep-alive turns let guests notice a dead connection
- ⬜ **Opening up to strangers** (later, D-143). Until then the dedicated server stays on the owner's spare PC for friends, behind a reserved room code and a password (D-140). When the game opens up, in this order:
  1. **Invite links and player accounts:** join by clicking a link instead of typing a password; accounts so one player can be removed, or given their own permissions. Mostly changes in the game and the relay.
  2. **Move the dedicated server to a small cloud server** (a basic Linux machine, about $5–10 a month): always on, and kept apart from the home network. The same setup as the spare PC; `world.json` and `room.json` move across, and the room code, reservation and passwords keep working.
  3. **More rooms** as players arrive: several worlds at once, each with its own code.

### Nests (D-065, #53)
In this order:
- ✅ **Phase 1, mounds and chitin** (0.31.0): nests are mounds with health; destroying one clears the territory, survivors stay angry until killed; chitin drops into stock; its first use is Chitin Plating (research: 1.5× health for turrets and walls)
- ✅ **Phase 2, breeding and young bugs** (0.36.0, D-071): calm nests breed back to their starting number; young bugs hatch small and weak and grow up over 3 minutes. They reuse the adult sprites, smaller and duller (darker since 0.40.0), until young-bug art exists
- ✅ **Phase 3, threat** (0.37.0, D-072): a threat level rising every 18 minutes makes new bugs tougher and spreading faster; shooting a nest's bugs wakes its neighbours
- ✅ **Phase 4, themed kinds and queens** (0.74.0, D-132): crawler warrens, runner hives and brute dens by distance, mixing where zones meet; 1 to 3 queen nests near the map edge; nests growing through three stages while calm, and grown neighbours of a kind merging into one bigger nest (D-100)
- ✅ **Phase 5, Hardcore nests** (0.75.0, D-133): threat starting at 2, faster breeding, spreading and growing, mounds destroyed only by building over them and a ring, faster breeding while being built over; the Hardcore burrow art (since 0.40.0)
- ✅ **Night raids** (0.38.0, D-073): from the second night, some nights a nest near your buildings sends a small party with no leash until morning; every night in Hardcore
- ✅ **Phase 6, a nest for every bug** (0.88.0, D-152): runner runnels and beetle barrows join warrens, hives (now wasp nests) and dens; any kind can be a queen nest, and its queen comes out to fight when the mound falls; each nest stage has its own drawing (the Earthworks look), and each bug has a queen
- ✅ **A looser leash** (0.46.1, D-091): no fixed leash; an angry bug chases while a building or an engineer is within 20 tiles of it (28 at night), and gives up and walks home when nothing is. Raiders finish their fight at morning

### Next (M4)
- ✅ Faster belts: the Express Belt, a colony blueprint (D-049, D-050)
- ✅ Mk2 and Mk3 machines, upgraded in place by research rather than colony blueprints: Mk2 with steel (0.63.0, D-122), Mk3 with circuits (0.68.0, D-127)
- ✅ Item filters on splitters: every splitter sorts one item to a side (#62, D-069; the Sorting Splitter blueprint was dropped)
- ✅ More enemy types (0.77.0, D-135): wasps that fly over walls (in far hives) and armoured beetles (in far dens)
- ✅ A tesla turret fed by wire (a colony blueprint, D-050) and the Ballista, firing stakes (D-054)
- ✅ More defence, by research rather than colony blueprints: the Mortar (0.65.0, D-124), Floodlights (0.67.0, D-126), the Shield Pylon (0.70.0, D-129)
- ✅ Better ammo as optional upgrades (0.78.0, D-136): AP bullets for the Turret Mk.2, explosive shells for mortars and artillery
- ⬜ More recipes and research to extend the mid- and late game
- ⬜ **The Broodmother, a Hardcore-only boss** (D-178): her art is done and saved in `art/concepts/broodmother/` (pixel art, a 4-frame idle and an 8-frame run). Left: her rules (where she lives, numbers, brood), drawing a bug bigger than 2.2 tiles, and an idle animation for bugs
- ✅ Research draws its items from hub stock over time, stalls when stock runs out, and can be switched or paused (D-018, D-026)
- ✅ Win condition: escape (D-019, D-034). Replaced by repeat colony supply runs (D-046)
- ✅ Enemy targeting (0.79.0, D-137): bugs go for the nearest building; brutes and beetles switch to the turret that shoots them (D-020)
- ✅ Difficulty settings for Standard (0.80.0, D-138): Easy, Normal or Hard, for nest density and bug toughness
- ✅ **The research tree in four ages (#88, D-089, [RESEARCH_TREE.md](RESEARCH_TREE.md)):** each age with its own material, power and weapons; a keystone that needs the age's top defence; rollers before powered belts; smelting at Industry; fuel for furnaces; the ship built in one stage per age and launched in the Electric Age, with supply runs after it. Built age by age:
  - ✅ **The engineer's inventory (#87, 0.46.0, D-090):** 12 slots of 10, filled by mining, Collect and Pick up off belts; an Inventory button and window; a switch for dropping off at the hub. The Storage Unit (1×2, 6 slots of 50), iron ingots and the Blacksmith come with the Iron Age
  - ✅ **Wood Age** (D-093, built in 0.47.0 to 0.51.0, D-103 to D-109): rollers, Workshop and Carpentry (dowels, stakes, pegs, rope, trusses), palisade and spike pit, trebuchet and ballista, the 5×5 shipyard (top-down ship, side view on tap), smelting moved to Industry
  - ✅ **Iron Age (D-113):** ✅ iron ingots, the Blacksmith and the Machine Shop (0.55.0); ✅ fuel and the Charcoal research (0.56.0); ✅ ponds, wells, the Water Wheel, drive shafts and powered belts (0.57.0); ✅ the Storage Unit (0.58.0); ✅ the hydraulic turret and cannon, brick and reinforced walls (0.59.0); ✅ the launch pad, the ship's Iron Age stage (0.60.0)
  - ✅ **Steam Age (D-119):** ✅ Engineering, Steelmaking and the Steel Works: steel beams and bearings (0.61.0); ✅ boilers, steam turbines, power poles and the electric express belt (0.62.0); ✅ the Storage Silo and Mk2 machines (0.63.0); ✅ sulfur, gunpowder, bullets, the Turret Mk.2 and the steel wall (0.64.0); ✅ the mortar, artillery, shells and the steel hull (0.65.0)
  - ✅ **Electric Age (D-125):** ✅ Electronics and the Circuit Works: circuit boards and coils (0.66.0); ✅ the electric Tesla, Arc Fence and Floodlights (0.67.0); ✅ Mk3 machines (0.68.0); ✅ drone pads (0.69.0); ✅ the Shield Pylon and Railgun (0.70.0); ✅ Ship Systems and the launch (0.71.0); ✅ the colony's special buildings: the Teleporter Pad, Orbital Strike Beacon and Greenhouse (0.72.0)
- ✅ **Defence tiers** (0.83.0, D-142, from D-089): every defence upgrades from Tier 1 to Tier 4 from hub stock, chitin among the cost (replaces Chitin Plating's flat bonus): +25% health a tier, and turrets +20% damage and +10% range
- ✅ **Ore further from the hub (#89, D-097, 0.52.0):** all ore, stone included, at least 20 tiles from the hub. Ore drawn as patches, 1200 a tile, richer under bigger extractors (#91, D-096).
- ✅ **Fog of war (#43, D-099, D-112, 0.54.0):** hides terrain, ore and nests until explored, shared in co-op, turrets still fire into it.
- ✅ Enemy nests on the map that players can clear (D-038)

## 2. Balance and playtesting
- ✅ Playtests by the project owner, batches 1 to 9. Notes go in issues labelled `playtest`
- 🚧 Playtesters: 7 people the owner knows play now (D-170); the in-game feedback form sends their notes (D-064). ⬜ More, from outside the owner's circle
- ✅ A headless balance script that pits nests of each kind against each age's reference outpost, run in CI (0.94.1, D-174); `npm run balance` also prints the highest threat level each age holds (0.94.3)
- 🚧 A balance pass on nest density and toughness, research costs and starting stock: ✅ what each age's defence should hold (D-177). ⬜ The playtesters' notes
- ⬜ Balance for more players in co-op

## 3. UX and onboarding
- ✅ Spotlight tutorial (M2b)
- ✅ Main menu with a live demo factory behind it: Continue, New game, How to play (M3a)
- ✅ **Settings screen** (0.85.0, D-144) from the main menu and the pause menu: volumes, size of text and buttons, reduced motion, battery saver, touch confirmation and keys
- ✅ Item names for hub stock (0.84.0): the hub's panel lists its stock by name, icon and count (touch users can't hover the chips)
- ✅ **Hotkeys beyond 9 tools, and key bindings** (0.85.0, D-144): 0 and Shift+1–9 pick tools 10–19; Settings rebinds the other keys
- ✅ **Pick a building to build more of it:** a middle-click on a placed building (desktop), or a long press on one (touch), makes that building the tool in hand, facing the same way, ready to place again. A middle-drag still pans
- ✅ **Buildings line up with belts while you aim (D-053):** hovering a building over or next to a belt line turns and centres the blueprint so it connects: dropped onto the line it runs along it (as it already does once placed), and beside a line's end it faces so the belt feeds it or it feeds the belt
- ✅ **Hub stock only while the hub is selected or pointed at** (D-053), so the map around the hub stays clear
- ✅ **Clear a belt line** (0.82.0, D-141): Clear line on a belt's panel empties its whole line into hub stock (Q-19), leaving the belts in place
- ✅ **Research takes one tap (#86, 0.45.3):** the research list updates its numbers in place instead of redrawing under the pointer
- ✅ **Belt snapping can be overridden (#85, 0.45.3, D-088):** turning a building after it lines up with a belt keeps your facing
- ✅ **Haptics for mining by hand (#84, 0.46.2):** a short vibration on each tap on phones that support it (a long press already vibrates)
- ✅ **Move a placed building (#76, #83, 0.53.0, D-110):** a Move button in the building's panel, beside Rotate and Demolish, makes the building the tool in hand, keeping its recipe, filter and contents
- ✅ **Undo** (0.85.0, D-144) for building, demolishing and pasting: Ctrl+Z, Z or the Undo button; a dragged line undoes in one step
- ✅ **Copy and paste** (0.85.0, D-144) for sections of a factory, with recipes and filters, turned with R; works in co-op
- ✅ **Tutorial rework (M3c, D-025):** lessons (six now, with Wood), each starting the first time it's useful: *Essentials* (a fresh factory, or chosen on New game), *Bugs* (the first provoked nest, or building near one), *Splitters and tunnels* (when researched), *The escape ship* (when researched) and *Breaches* (the first breach). Lessons never open over a window.
  - Action steps wait for you to do the thing (place an extractor, lay belts, build a furnace, deliver a plate, research Basic Defense), and the game keeps running.
  - Explanation steps pause the game.
  - Each lesson plays once, and can be replayed or switched off in Menu → Tutorials.
- ✅ **Right-click clears the selected tool** (and the selection), the same as Esc. Right-drag still pans (M3c)
- ✅ **Clicking or tapping outside a menu closes it** (all dialogs except the tutorial and game over) (M3c)
- ✅ **Blueprints (soft placement):** confirm, rotate or cancel before building; on touch by default, on desktop for dragged belt and wall lines (batch 2, D-030)
- ✅ **Hub stock over the hub** instead of a top bar row (batch 2); fixed to the hub in the world, so it scrolls away with it (D-041)
- ✅ **Leaner screen:** the top bar holds only speed and the menu; research opens from the hub; the info panel shows only for placed buildings (D-041)
- ✅ **Tapping a different building with a tool in hand selects it** (D-042)
- ✅ **Mouse wheel rotates** the building being placed, and zooms otherwise. Ctrl+wheel always zooms (M3c, D-023)

## 4. Art and audio
See [ART_LIST.md](ART_LIST.md) for the full list.
- ✅ Art direction: whimsical forest clearing around navy-and-steel machines (D-028)
- ✅ Name: **Nestfall** (0.91.0, D-167); web addresses `playnestfall.com` (the game's address since 0.95.0, D-181) and `box47games.com` (the studio, with email). ⬜ A USPTO search by the owner
- ✅ Art direction: pixel art (D-179); the sprites are redrawn as pixel art. ⬜ Who draws it, and the pixel size of a tile
- 🚧 **The pixel art test** (0.96.0, D-184): a setting with pixel crawlers, Brutes, wasps and beetles at 16 art pixels a tile, hard-edged, with zoom in whole steps, to try pixel art in play before the rest is redrawn. Left: try it on phones and decide the tile size, then the other sprites
- ✅ Art pipeline: sprites load from `src/art/`, and a PNG replaces a same-named SVG placeholder (M3a)
- ✅ Placeholder SVGs for every P1 and P2 sprite, plus UI icons and a logo mark (M3a)
- ✅ Effects drawn in code: muzzle flash, cannon blast, death puff, breach shockwave, nest mounds and territory outlines (M3a, D-038). Since 0.43.0 most are sprite strips, with these as the fallback (D-082)
- ✅ Menu style: navy and sky blue, flat icons, Montserrat headings (M3a, D-011)
- ⬜ Final P1 sprites, in pixel art (D-179): items, resource nodes, belt, extractor, furnace, hub, turret, crawler
- ✅ Art upgrade (0.40.0, D-075): every sprite redrawn; wall and palisade sets that join up; burrow nests; damage overlays; damaged hub
- ⬜ Final P2 sprites: remaining buildings and enemies
- ⬜ Final P3: effects and UI icons (the app icon came in 0.88.5)
- ✅ Animated art (0.43.0, D-082): strips cut into frames on loading; bugs walk in 4 steps and bite; the engineer walks, works, idles and sees stars when knocked out; sprite effects (muzzle flash, hit spark, cannon shell, explosion, death splat, debris, repair sparkle, leaf burst); seasonal ground and trees; every working machine animates (strips built from the machines' own sprites by `art/working.mjs`)
- ✅ **Seasons that fade in** (owner's note, 0.54.0, D-111): the ground and trees used to switch at once when the season changed. Now, autumn loses its leaves gradually, snow builds up gradually in winter, and spring brings flowers first and then leaves. Only the look changes, so it stays out of the rules
- ✅ **Falling leaves, then snow** (owner's note, 0.88.2, D-154): over fall's last day the broadleaf trees go bare (a few last leaves) and fallen leaves cover the ground; over the first half of winter's first day the snow comes, and it melts over winter's last half day. Winter's trees are bare with snow on their limbs; pines keep their needles
- ✅ **Ideas batch 5, part 1: feedback and bugs** (owner's note, 0.88.7, D-160): building and demolishing, deliveries and research at the hub, lock-ons and low ammo, raid warnings, ship fireworks and countdown lamps, deaths by kind, footprints in snow, eyes at night, chitin from nests. Part 2 in the same release (D-161): cloud shadows, birds, rabbits and deer, blossom, butterflies, flowers closing at night, the water wheel's splash and the well's bucket, co-op colours (overalls in place of rings), getting back up, research badges, the toolbar's hover, walls that crack instead of burning, and worn spikes. Medals wait for achievements.
- ✅ **Ideas batch 4: launch, people, queens, power, night, weather** (owner's note, 0.88.6, D-159): the ship's climb, the engineer carrying, hammering and waving, queens walking, attacking and summoning, hatchlings, wire sparks, sweeping floodlights, rain, ripples, fog, fireflies, hot ingots, scaffolding and ruins.
- ✅ **Ideas batch 3: code into sprites, icons, Hardcore, small touches** (owner's note, 0.88.5, D-158): drone, hub breach and Mk plates as sprites, the app icon and favicon, Hardcore bugs and glowing nests, snowfall, leaves on idle belts, worn ore by extractors.
- ✅ **Ideas batch 2: buildings that show their work** (owner's note, 0.88.4, D-157): working strips for the nursery, pads, pylon, beacon, port and shipyard, the railgun charging, the tesla's bolt as a sprite, stores that show how full they are.
- ✅ **Ideas batch 1: the gaps** (owner's note, 0.88.3, D-156): the greenhouse at work, wasp and beetle walk and attack strips, recoil for five guns, pale young bugs. Four more batches of the Ideas boards to come.
- ✅ **Ore patches as terraces** (owner's note, 0.88.2, D-155): touching ore tiles drawn as one stepped formation with rounded edges and a band of ore in each cliff, instead of a pile of rocks per tile
- ✅ **Belts and the hub's corners (#78, 0.45.3):** a belt running into a cut corner of the hub carries on under its wall
- ✅ Belt corners, end caps, start lips and join flanges as sprites (0.73.0, from the reference art in `docs/art-upgrade/pieces/`), with the chevrons still moving in code. The tesla bolt stays drawn in code; its reference is only a guide
- ✅ Music: thirteen original tracks generated in code in a late-90s adventure style: the menu theme, seven shuffled in-game tracks from slow to upbeat, a fanfare for the first delivery, and a short piece for each season. Menu and game music flow into each other without a cut (D-032, D-051, D-052)
- ✅ Forest placeholders: grass, decorations, trees, fireflies and leaves; detailed bugs (batch 2)
- ✅ Sound effects, synthesized in the browser (D-043), including a machine-running hum that follows how busy the factory on screen is
- ✅ Animation: belts (chevrons, corners) and turret aim in code; enemy, engineer and machine animations from strips (0.43.0, D-082). ⬜ A hub idle loop and young-bug art
- 🚧 Sound effects reworked, keeping the retro style (#214, D-182): ✅ the sound board, and round 1's picks in the game (0.95.1). ✅ Round 2: realistic guns and hits, each gun with its own sound, the enhanced hum (0.95.2, D-183). ⬜ Round 3: the Hydraulic Turret, tesla, railgun, hub hit and launch
- ⬜ Refresh the art review page for the upgraded art, when the owner asks (see ART_LIST.md, Art review 2)

## 5. Tech and quality
- ✅ Unit tests for the simulation, run in CI on every PR
- ✅ Versioned saves with tested migrations (v8 started over with the new map, D-038)
- ✅ Browser tests (Playwright, `e2e/`) in CI on desktop and phone viewports: lessons, blueprints, HUD, controls, music, the supply ship and wood (D-035)
- 🚧 A performance budget: 60 fps on a mid-range phone with 1,000 buildings and 200 enemies. ✅ A test holds the game to a tick and draw budget on such a base (0.87.4, `src/sim/perf.test.ts`, `e2e/perf.spec.ts`). ⬜ Measured on a real phone
- ✅ Lint and format checks (0.85.0, D-144): ESLint and Prettier, run in CI (`npm run lint`)
- ✅ Error reporting: the feedback form includes recent page errors (D-064); error reports sent by themselves, with the player's consent, to our own relay, read with the `REPORTS_KEY` secret (D-175; emailing them needs the Workers Paid plan) (0.94.0, D-173)
- ✅ Save export and import (0.93.0, D-172): Settings → Saves exports and imports a factory; the browser is asked to keep the game's storage
- ✅ The game moved to `playnestfall.com` (0.95.0, D-181): GitHub Pages with a custom domain, so the old address forwards; players bring their factory with Export and Import (D-172), since a save made on the old address can't be read from the new one

## 6. Platform and release
- ✅ Single-file build for sharing (claude.ai artifact)
- ✅ GitHub Pages deployment from `master` (D-010)
- ✅ PWA (0.85.0, D-144): offline play after the first visit (without music), install to home screen, app icons from the logo
- ✅ The first paid platform: Google Play (D-180). Steam and the App Store later
- ⬜ Capacitor wrapper for Android first (M5, D-180), iOS later
- ⬜ A desktop wrapper for Steam, later (D-180)
- ⬜ Store accounts in the LLC's name, Google Play first (an organization account, which needs the D-U-N-S number, D-180), signing, and a build pipeline
- ⬜ Store listings: screenshots, description, trailer, age rating (IARC for Google Play, Apple's own questions), privacy policy (✅ written, 0.92.0)
- ⬜ Store rules: tips through the Ko-fi link may not be allowed inside store apps; hide it there or offer a tip as an in-app purchase. Check the rules of the day before submitting
- ⬜ Declare AI use on store pages if any AI-made art, sound or text ships (none does now)
- ⬜ Cloud saves (optional)

## 7. Accessibility
- ✅ Colour-blind-safe items: every item has its own sprite with its own shape, and the hub's panel names them (0.84.0)
- ✅ Text that scales with system settings, and minimum touch target sizes (0.85.0, D-144): the interface starts from the browser's text size and Settings scales it 80–140%; touch buttons are at least 44 px
- ✅ Respect reduced-motion (0.85.0, D-144): the system setting or Settings' switch stops CSS animations, fireflies and leaves. ⬜ Calmer battle effects too

## 8. Business and legal
- 🚧 Optional purchase plus donations or tips (D-017): ✅ tips through a Ko-fi link in the main menu (0.92.0, D-169). ❓ What the purchase is (Q-25): for example the full game after a free part, or a supporter pack
- 🚧 Trademark check on the final name: a first check of Nestfall found no trademark and no store listing (D-167). ⬜ The owner searches tmsearch.uspto.gov
- ✅ Licences for third-party assets tracked in [CREDITS.md](CREDITS.md) (music; Montserrat is OFL)
- ✅ Privacy policy (required by app stores, even with no data collection): `public/privacy.html`, linked from the main menu (0.92.0, D-169); the game's fonts are bundled so it calls no other company

### Business setup (D-168)
The studio is **Box47 Games LLC**, in Missouri; it publishes Nestfall. In this order, since each step needs the one before.
None of this is legal or tax advice: a one-hour talk with a Missouri small-business lawyer or accountant can confirm it.
- ✅ Studio name chosen: Box47 Games (no clash found; the name is free on the Missouri Secretary of State's business search)
- ✅ Web addresses bought, on Cloudflare: `playnestfall.com` (the game) and `box47games.com` (the studio)
- ⬜ Check the owner's day-job agreement for rules on side businesses and who owns what they make
- ⬜ File the Articles of Organization online at sos.mo.gov ($50; Missouri has no annual report or fee for LLCs), as "Box47 Games LLC"
- ⬜ Choose the registered agent: the owner (free, but the home address becomes public) or a service (about $50–$130 a year, keeps it private)
- ⬜ Get the EIN at irs.gov (free, about 10 minutes; never pay a website for it)
- ⬜ Write a one-page operating agreement (not filed; backs up the liability protection, and banks may ask for it)
- ⬜ Open a business bank account; from then on the LLC pays the game's costs (domains, Cloudflare, store fees) and takes its income
- ⬜ Check whether the owner's city or county wants a business licence for a home business
- ⬜ Move the two domains into the LLC's name, and sign the game's copyright over to the LLC (a one-page assignment)
- ⬜ Point Ko-fi payouts at the business account (D-169)
- ⬜ Apply for a D-U-N-S number (free, can take a couple of weeks; Apple needs it for an organization account)
- ⬜ Apple Developer ($99 a year) and Google Play ($25 once) accounts as the organization (M5)
- ⬜ File the Nestfall trademark in the LLC's name, after the owner's own USPTO search (classes 9 and 41)
- ⬜ Taxes: a one-person LLC files as the owner by default (Schedule C). Ask an accountant about tips and direct sales once money comes in; the app stores collect sales tax on their own sales

## 9. Launch and community
Wishlists, followers and word of mouth are built months before a release, so this starts now (D-170).
- ⬜ A place for players to talk and report (a Discord server or a subreddit), linked from the main menu
- ⬜ A short devlog: what's new, with a GIF, every few releases
- ⬜ A press kit on `box47games.com`: description, screenshots, GIFs, the logo, contact
- ⬜ A trailer (about a minute of the factory and a raid)
- ⬜ A store page early (Steam, if chosen, Q-24), so wishlists build up before release
- ⬜ An itch.io page for the web build, as a second place to be found

---

## History: the old "Next up" list

1. ✅ Merge story phase 1 (contracts and inbox).
2. ✅ M3c playtest polish: controls, wheel rotation, store lock, hub weapon.
3. ✅ Interactive tutorial (M3c).
4. ✅ Research over time (D-018, D-026).
5. ✅ Story phase 2: suspicion, audits and the black market.
6. ✅ **Playtest batch 2** (a play-tester's notes, 2026-10-21), in this order:
   1. ✅ More time between attacks (first wave 4:00, then every 2:00). ✅ Spread-out resource nodes (new games only, D-029). ✅ Hub stock shown over the hub instead of along the top.
   2. ✅ Soft placement: a blueprint preview with confirm (✓), rotate (⟳) and cancel (✕). On by default on touch; on desktop only when dragging out a belt or wall line (D-030).
   3. ✅ Belt visuals: corners and elbows, proper joins with splitters and tunnels, more detail.
   4. ✅ Forest look (D-028): grass, flowers and trees around the map, fireflies and drifting leaves. More detailed bugs with walk animations.
7. ✅ **Playtest batch 3** (owner, 2026-10-21): the Essentials tutorial can be chosen on New game; the store and black-market lessons wait for their emails to be read; an on-screen contract tracker; music with crossfades.
8. ~~Rework suspicion~~: dropped with the Company (D-040).
9. ✅ **Browser tests in the repo and CI** (D-035).
10. ✅ **Story phase 4: the escape ship**, victory screen and endless mode (D-034, D-019).
11. ✅ **Owner's notes, round 4:** buildings onto belts (D-037), hub port collar, hub-touching turrets reload from stock (D-036), see-through stock panel, and a fix for a pathfinding crash.
12. ✅ **The open map redesign:** a procedural 256×256 map, bug territories that attack only when provoked (no waves), building sizes (extractor and furnace 2×2, workshop 3×2, assembler 4×2, hub 5×5), the Company and black market removed, research inside the hub, a leaner top bar, and tap-to-select with a tool in hand (D-038 to D-042).
13. ✅ **Sound effects** (D-043).
14. **Next:** playtest the open map, wood phases 1 and 2, supply runs and the colony blueprints (nest density, territory sizes, how far bugs chase, forest density and regrowth, launch difficulty, cargo sizes, ballista and tesla balance); then the next colony blueprints (D-055, see Gameplay → Colony supply runs).
15. ✅ **Playtest batch 4, quick fixes** (issues #32, #35, #36, #37): bugs no longer twitch at the end of their leash, the research menu's ✕ is at the top right, Underground Transport research is renamed Underground Belt, and single buildings can be dragged into place (D-057). The rest of batch 4 is in the `playtest` issues.
16. ✅ **Co-op phase 0** (D-058): every change to the world is a command run through a session with a log; exact replays; path timers and players saved (v12); determinism checked in Chromium, Firefox and WebKit. Next for co-op: phase 1, the two-player prototype.
17. ✅ **Playtest round 5** (0.26.0): version numbers and What's new; cooler drawing and a battery saver (#46, D-061); readable rates (#48); smooth belts (#49); staggered regrowth (#50); spreading territories (#51, D-059).
18. ✅ **Start from nothing** (0.28.0, #38, D-062): the hub starts empty; mine stone and ore by hand, build a furnace and an extractor, collect plates by hand, then research Logistics (now the first research) for belts, splitters and underground belts. The Essentials lesson follows the new start.
19. ✅ **Building shapes** (0.29.0, #33, #34, #35, D-063): a 2×2 workshop, a 3×3 assembler, a 1×2 splitter spanning two lanes, and underground belts that look like belts going underground.
20. ✅ **Feedback form** (0.30.0, D-064): Send feedback in the pause menu, with diagnostics, a GitHub issue link, Copy and Download save. CI runs in Playwright's container, so browsers aren't installed on every run.
21. **Nests (D-065, #53):** phase 1 (mounds and chitin) is done in 0.31.0, phase 2 (breeding and young bugs) in 0.36.0, phase 3 (threat) in 0.37.0, night raids in 0.38.0, phase 4 (kinds, queens, growing and merging) in 0.74.0, phase 5 (Hardcore nests) in 0.75.0. The nest plan is built.
22. ✅ **Player character** (0.32.0, #40, D-067): an engineer who walks (tap or WASD), mines by hand, carries items that trail behind, drops them at the hub, and fetches or hands over items. Bugs notice and bite the engineer since 0.39.0 (D-074). Next: co-op phase 1.
23. ✅ **Day, night and seasons** (0.33.0, #42, D-068): a 9-minute day, bugs ranging further at night, four seasons changing tree regrowth and the look of the map, a clock, and a short piece of music for each season. Night raids (D-065) can come next. Belt feedback batch filed as #61–#65.
24. ✅ **Belt batch** (playtest #61–#65): two-lane belts, splitter filters and side snapping (0.34.0, D-069); an exit blueprint for underground belts, and belt lines that go under belts they cross (0.35.0, D-070).
25. ✅ **Art upgrade** (0.40.0, D-075): every sprite redrawn, walls and palisades that join up, burrow nests, damage that shows.
26. ✅ **Co-op phases 1 to 3** (D-076 to D-081): the relay on Cloudflare (0.41.0); Play together (0.42.0): Host and Join with a room code, the host stamping command ticks and sending turns, every engineer on screen in its player's colour, no pausing for lessons, the first delivery or blueprint picks; joining a game under way, a fresh copy for a guest out of step or far behind, reconnecting, the shared game saved in every browser; pings, per-player messages, the blueprint offer as a card, engineers side by side, 4-player tests, and the host taking its room back after a dropped connection. **Next:** playtest co-op (balance for more players), and the art review refresh.
27. ✅ **Animated art** (0.43.0, D-082): working machines, bug walks and bites, the engineer's states, sprite effects, seasonal ground and trees.
28. ✅ **Dedicated server** (0.44.0, D-083 to D-086; one-button join and its status on Play together in 0.45.0): rooms of up to 10, and a server that hosts rooms around the clock (more made by players since 0.89.0, D-164) on a spare computer, paused while empty, saved every minute, updated from `master` when nobody is playing, and back in its room within seconds after an internet drop (D-085) ([server/README.md](../server/README.md)).
29. ✅ **Playtest batch 6, bugs** (0.45.3): research starts with one tap (#86); turning a building overrides lining up with belts (#85, D-088); belts run under the hub's cut corners (#78).
30. ✅ **Playtest batch 6, small ideas:** ✅ a short vibration on each tap when mining by hand (#84, 0.46.2); ✅ upright grass (#94), engineers and bugs under the trees (#95), quieter music and sliders of one length (#97) (0.46.2); ✅ move a building after it's placed, with a Move button beside Rotate and Demolish in its panel (#76, #83, 0.53.0).
31. ✅ **Belt pieces as sprites** (0.73.0): draw belt corners, end caps and join flanges from the reference art in `docs/art-upgrade/pieces/` instead of in code. The moving chevrons stay in code, drawn over the corner sprite, so a sprite holds only the rails and the bed. Then the docs and ART_LIST follow.
32. ✅ **The research tree in four ages** ([RESEARCH_TREE.md](RESEARCH_TREE.md), D-089): Wood, Iron, Steam and Electric Ages, built age by age. The engineer's inventory is done (0.46.0, D-090); next the Wood Age, decided (D-093), built in five steps: ✅ the start (0.47.0, D-103: chopping, Forestry paid in logs, smelting at Industry, a wood lesson), ✅ wooden parts (0.48.0, D-105), ✅ rollers and the crate (0.49.0, D-106), ✅ the spike pit and trebuchet (0.50.0, D-107), ✅ the 8×8 hub and the 5×5 shipyard (0.51.0, D-108, D-109). The Wood Age is built. The Iron Age is decided (D-113), in five steps: ✅ the Blacksmith and Machine Shop (0.55.0), ✅ fuel (0.56.0), ✅ water power (0.57.0), ✅ the Storage Unit (0.58.0), ✅ hydraulic defences (0.59.0), ✅ the launch pad (0.60.0). The Iron Age is built. The Steam Age is decided (D-119), in five steps: ✅ Engineering, steel and the Steel Works (0.61.0), ✅ steam turbines, electricity and express belts (0.62.0), ✅ Mk2 machines and the Storage Silo (0.63.0), ✅ gunpowder and the Turret Mk.2 (0.64.0), ✅ the mortar, artillery and hull (0.65.0). The Steam Age is built. The Electric Age is decided (D-125), in seven steps: ✅ Electronics and the Circuit Works (0.66.0), ✅ the electric Tesla, Arc Fence and Floodlights (0.67.0), ✅ Mk3 machines (0.68.0), ✅ drone pads (0.69.0), ✅ the Shield Pylon and Railgun (0.70.0), ✅ Ship Systems and the launch (0.71.0), ✅ the colony's special buildings (0.72.0). The Electric Age is built. See Gameplay → Next.
33. ✅ **Bugs that don't give up mid-chase** (0.46.1, D-091): no fixed leash; a bug chases while something is within 20 tiles of it (28 at night), then walks home.
34. ✅ **Seasons that fade in** (owner's note, 0.54.0, D-111): see Art and audio.
35. ✅ **Playtest batch 6, decided** (D-094 to D-102): ✅ trees that regrow 3 times (#102, 0.52.0); ✅ ponds and the Water Wheel (#102, 0.57.0); ✅ ore drawn as patches, 1200 a tile, richer under bigger extractors (#91, 0.52.0); ✅ all ore 20+ tiles from the hub (#89, 0.52.0); ✅ an 8×8 hub and a staked-out shipyard site (#98, 0.51.0); ✅ fog of war (#43, 0.54.0); ✅ nests merging and growing (#90, #53, 0.74.0).
36. ✅ **Playtest batch 6, ideas to build** (D-101, D-102): ✅ sun, moon, moving shadows and critter sounds with gradual seasons (#101, 0.54.0); ✅ splitters that sort two kinds of item (#92, 0.47.1); ✅ belts that go underground across obstacles (#93, 0.53.0); ✅ a long snaking runner (#96, 0.47.1); ✅ example factories on the main menu (#99, 0.54.0).
37. ✅ **Playtest batch 7** (owner on an iPhone, 0.85.0, #154 to #164): ✅ in 0.86.0 (D-145): music starting again after iOS stops it (#161), leaves that no longer speed up while zooming (#160), curved roller corners and rollers into the hub's corner (#158, #163), the tool put down after building on touch, with a double tap to keep it (#164), the blueprint above the finger (#157), words for the device in use (#155), research in the order it can be done (#154). ✅ in 0.87.0 (D-147): building paid from the hub's stock first, then the engineer's inventory (#156); 4 logs a tree, 10 regrowths, and lumber camps built over trees (#162). Birdsong (#159) came as synthesized calls instead (0.88.8, D-163).
38. ✅ **Code review fixes** (0.87.1): co-op hardening (relay messages checked, a `-0` desync, big pastes, missed turns), drones mixing items, turrets wasting shots, turning and moving buildings, the engineer stuck in a building, saves that fail, shortcuts behind dialogs, and the dedicated server's saves.
39. ✅ **More review fixes** (0.87.2): guests take only plain data from a host, oversized host messages split or refused instead of disconnecting the host, a capped command log, and power networks rebuilt only when buildings change.
40. ✅ **Last review fixes** (0.87.3): co-op command limits, rejoin limits and stray engineers, relay status caching, nest edge cases, damaged belt refunds, Settings back to the pause menu, and one save load on the main menu.
41. ✅ **Performance** (0.87.4): a performance test with a 1,000-building base under attack at night (tick and draw budgets), and faster repair stations, night, zooming, belt arrows, power lines and bugs' searches.
42. 🚧 **Playtest batch 8** (owner on desktop, 0.87.0, #169 to #181): ✅ in 0.87.6 (D-149): the trebuchet's panel (#175), the Smelting lesson's Collect (#176), the toolbar's Inventory button and scrolling (#177, #178), stocked buildings paying for their load (#180), bugs that keep apart (#181). ✅ in 0.88.1 (D-153): the drop-off counts (#170), the engineer stopping short of a resource (#169), the splitter menu fitting (#191), the dedicated server no longer a player (#184). ⬜ The trebuchet's swing and flying rock (#174).
43. ✅ **Playtest batch 9** (0.88.8, D-162, D-163): merged nests drawn without tunnels (#196), birds staying put when you pan (#205), items fed in from the side landing where they were (#204), an engineer built over stepping out (#206). Rarer, shyer wildlife and no delivery count over the hub (#203, #208). Ideas (D-163): one tap keeps mining (#209), a grouped toolbar (#195), 5 planks a log (#188, #207), self-fuelling charcoal furnaces (#190), later raids (#185), calmer messages (#197), birdsong (#159). ⬜ The trebuchet's aim (#174) is in progress elsewhere.
44. ✅ **Rooms on the dedicated server** (0.89.0, D-164): players make rooms of their own on the server through its desk, each a world of its own; the main room lists them on Play together. Up to 4 by default; idle ones are archived after 30 days. The desk reconnects like a room after a dropped connection (0.89.1). Makers rename and delete their rooms, and empty rooms send nothing so the relay's rooms sleep (0.90.0, D-165).
45. ✅ **Phone toolbar** (0.90.0, D-165, #215): a narrow group button with its name on its side, and a small Inventory button over the map.
