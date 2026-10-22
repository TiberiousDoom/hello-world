# Changelog

## Unreleased: picking buildings, belt alignment and a tidier hub
- **Build more like a building you placed:** middle-click it, or on a phone hold your finger on it for half a second. It becomes the tool in hand, facing the same way.
- **Buildings line up with belts while you aim:** place a machine next to a belt line and it turns and shifts so the belt runs into it and its output runs onto the next belt.
- **Hub stock only shows when you want it:** select the hub, or point at it with the mouse.

## Unreleased: wood lesson and machine hum
- **A Wood lesson** starts the first time you research Forestry: placing a Lumber Camp beside the trees, stumps and regrowth, the Sawmill, and what planks are for. Replay it from Menu → Tutorials.
- **The main menu's demo factory** now has a lumber camp and sawmill turning a grove into planks.
- **A machine hum:** a soft, continuous factory sound that grows with the number of machines working on screen, and goes quiet when you pause.

## Unreleased: new music, research order and tutorial tips
- **Seven new in-game tracks and a fanfare,** all made for the game in the same late-90s adventure style as the menu theme. Some are upbeat (a polka, a jig, a swung market tune), some slow (a lullaby, a mysterious forest piece, a starlit waltz), plus an easy-going morning tune. The fanfare plays when your first supply run is delivered. They replace the lo-fi tracks and "Groove".
- **Music flows from the main menu into the game** (and back) without a cut: the track playing finishes, then the next one fades in.
- **Forestry and Palisades** come before Masonry in the research list.
- **Tutorial tips no longer cover the spotlight** (or a blueprint's ✓ button). On phones, a big target like a bug territory slides up to make room for the tip.

## Unreleased: new menu music
- **New main menu music:** a whimsical theme made for the game, in the style of late-90s 3D adventure games: an ocarina-like flute over harp, pizzicato strings and marimba, in a lilting 6/8 with a touch of magic. It replaces the corporate track.

## Unreleased: colony rewards (supply runs phase 2)
- **Blueprints from the colony:** after each supply run, the colony offers two blueprints for buildings you can't research, and you pick one. The other comes with a later run. Research shows them under "From the colony".
- **Express Belt:** twice as fast as a belt. With it selected, one tap or click on a belt upgrades that whole line in place, keeping its direction and items. The old belts are refunded, so it costs a gear per belt.
- **Tesla Turret:** fed copper wire by belt. Each shot arcs from the nearest bug on to two more nearby.
- **A heavier ship:** each run's launch wakes nests 8 tiles further out than the last (from 48 up to 96 tiles).
- Fixed belts next to Lumber Camps and Sawmills not joining up with them visually.
- Saves move to v11. Games that had delivered runs get a blueprint to pick when they load.

## Unreleased: the colony supply ship
- **The escape ship is now a colony supply ship, and the game no longer ends.** Build the ship once, then load each supply run's cargo by belt and launch it. Hold the shipyard through the countdown, and the run is delivered.
- The ship is away for 5 minutes after each run, then comes back for the next, bigger one. Later runs ask for gears, wire, motors and planks.
- Your first delivery gets a "Supplies delivered!" screen, and in Standard it unlocks Hardcore. The victory screen and the endless-mode choice are gone.
- **Launches are a real fight now.** Woken bugs come for the shipyard from wherever their nest is, instead of staying near home, and every launch wakes at least the 3 nearest nests. The shipyard's panel tells you how many nests a launch will wake.
- In Hardcore, a ship that's away at the colony is safe even if the shipyard falls.
- Saves move to v10. A game that had escaped loads with one supply run delivered and the ship ready to load.

## Unreleased: wood (phase 1)
- **Forests:** about a seventh of the map is now woods. Trees block building, so expanding means working around them or clearing them. There's a small grove just outside the hub's clearing.
- **Forestry** research unlocks the **Lumber Camp**, which cuts the nearest tree in reach into logs, and the **Sawmill**, which saws logs into planks. Cut trees leave stumps that grow back after 3 minutes. Build over a stump to clear it for good.
- **Palisades** research unlocks the **Palisade**: a cheap wooden wall made of planks, weaker than stone.
- A chop sound and a burst of leaves when a tree comes down.
- Saves move to v9. v8 saves load with forest grown around what you've built.

## Unreleased: sound effects
- Sound effects for building, demolishing, blocked placements, turret and cannon fire, the hub gun, bugs dying, buildings destroyed, hub hits, breaches, research, ship stages, the launch, and an angry chitter when you provoke a nest. Buttons click.
- Sounds come from where they happen: full volume on screen, fading out past its edges, panned left or right. A provoked nest is always heard, quietly if it's far away.
- Menu → Sound effects sets their volume.

## Unreleased: the open map
- **A much larger, generated map:** 256×256 tiles from a seed, with irregular ore fields and a starter patch of each ore near the hub, which now sits in the middle.
- **No more waves or wave timer.** Bugs live in nests scattered across the map, each in its own 10×10 territory. They wander inside it and leave you alone unless provoked: building in or next to a territory, a building coming close to a bug, or shooting one. Provoked bugs go for your nearest buildings (up to 22 tiles from home) and calm down 30 s after the last provocation. Killed bugs don't come back, so nests can be cleared. Nests further out are bigger and tougher.
- **New building sizes:** extractor and furnace 2×2, workshop 3×2, assembler 4×2, hub 5×5. Machines output from the middle of the side their arrow marks, shown by a small port. Extractors mine whichever ore covers most of their base. Any building, whatever its size, can be dropped onto a belt line and lines up with it.
- **The Company is gone:** no contracts, balance owed, emails, store, black market or suspicion. The Shipyard is now a normal research, and launching the ship wakes every nest within 48 tiles for the countdown. Hardcore unlocks by escaping once in Standard.
- **Research lives in the hub:** select the hub and press Research.
- **A cleaner screen:** the top bar holds only speed and the menu. Hub stock stays above the hub on the map and scrolls away with it. The info panel only opens for buildings you've placed, not for toolbar picks.
- **Tapping a different building while holding a tool selects it** (and puts the tool down), so you can work on what you tapped. Dropping a building onto a belt still builds.
- Saves move to v8. Older saves can't be converted: the main menu says so and starts fresh.

## Unreleased: round 4
- Fixed a crash ("Invalid array length") in enemy pathfinding. Path costs were stored at lower precision than they were computed, so rounding could add the same tile over and over until the queue overflowed, or skip tiles and leave enemies with no path.
- Place a furnace (or any one-tile building) straight onto a belt: it replaces the belt, faces along the line and starts working. Drags still go around belts.
- Hub ports have a docking collar joining them to the hub, and you can see items streaming out while one sends.
- Turrets and cannons touching the hub reload from hub stock.
- The hub stock panel fades while the mouse is over it or a finger is down on it, so you can see and build above the hub.

## Unreleased: the escape ship (story phase 4)
- Research **Shipyard Plans** on the black market to unlock the **Shipyard**: a hidden 3×3 dock (one only, keep it away from the hub).
- Build the ship in four stages (hull, engine, life support, navigation) by belting parts into the shipyard. The ship takes shape on the pad as you go.
- **Launch** when it's finished, then hold the shipyard for 90 seconds against a doubled wave that comes for it. Survive, and you escape: a victory screen shows your run.
- **Come back** afterwards to keep playing in endless mode (the Company bills your return flight).
- Losing the shipyard stops a launch. Standard keeps the ship; Hardcore loses it.
- New "The escape ship" lesson. Saves move to v7.
- Browser tests now live in the repo (`e2e/`) and run in CI on desktop and phone viewports.
- Touch input guards against a lost finger-lift, which could have left later taps treated as a pinch.

## Unreleased: playtest batch 3
- Music: the Company's corporate theme on the main menu and a shuffled set of lo-fi tracks in game, crossfading from one to the next. Volume is in the pause menu. Tracks by velariomusic (Pixabay).
- New game has a "Start with the Essentials tutorial" box, so the basics can be replayed on any device.
- The Company Store and black-market lessons wait until you've read the email that announces them, and the black market (the eye button and the Stash) appears only once A Friend's email is read. Lessons no longer open over a window you're reading.
- The current contract is always on screen: each item's delivered / needed, under the top bar. Tap it for details.
- The How to play page describes blueprints and credits the music.

## Unreleased: playtest batch 2
- More time to build: the first wave now comes at 4:00 (was 3:00), then one every 2:00 (was 75 s).
- New games spread resource nodes out: node tiles never touch side by side, and patches are kept apart, so every node can be reached. Existing saves keep their maps.
- Soft placement: building can show a blueprint first, with ✓ (build), ⟳ (rotate, or reverse a belt line) and ✕ (cancel). Every placement on a touch screen is a blueprint; tap the same spot twice to build quickly, or switch it off in the menu. On desktop, single clicks still build at once, and dragging out a belt or wall line makes a blueprint (Enter builds, Esc or right-click cancels). Dragging back shortens a blueprint, and red tiles show where it's blocked or where your stock runs out.
- Belts look more like belts: they curve round corners (items follow the bend), chevrons show the direction, a line's end gets a hazard bumper, and metal flanges show where belts plug into splitters, tunnels and machines. Paired underground belts show a faint dotted trace.
- A whimsical forest look: grassy ground with tufts, flowers, mushrooms and pebbles; a band of trees around the map that the bugs crawl out from; fireflies and drifting leaves (switched off when the system asks for reduced motion). Ore nodes sit on dirt patches.
- More detailed bugs: a red jewel beetle (crawler), a long-legged ant-wasp (runner) and a horned rhino beetle (brute), each with a two-frame walk cycle that plays as they move.
- Hub stock is now shown just above the hub instead of along the top of the screen. When the hub is off screen, the stock is pinned to the edge; tap it to jump back.

## Unreleased: fixes
- Fixed a stretched picture and a misplaced tutorial spotlight on some iPhones. iOS Safari can change the visible area without telling the page (for example when the game is opened from a link in Messages). The game now re-measures the screen every frame.

## Unreleased: story phase 2, the black market
- A Friend gets in touch after your first contract and opens the black market (the eye in the top bar).
- Stash: hidden storage that the Company can't count. Skimmer: a belt piece that diverts every 4th item.
- Black-market research paid from the stash: Skimmer and Disguise Kit.
- Suspicion builds from missed contracts, skimming, hub-port withdrawals and contraband within 14 tiles of the hub.
- High suspicion brings an audit: an inspection drone sweeps the hub area. Standard fines each piece of contraband found; Hardcore confiscates and destroys it.
- New "Black market" tutorial lesson. New art: stash, skimmer, audit drone, eye icon. Saves move to v6.

## Unreleased: research over time
- Research now takes time: start one and it draws its items from hub stock over 30–150 seconds. It stalls if the hub runs out, and you can switch or pause without losing progress.
- The research button shows progress (or "stalled"). The research window shows items put in, time and a progress bar.
- Saves move to v5.

## Unreleased: M3c playtest polish
- The hub has a built-in gun (no ammo). It beats wave 1 on its own; later waves still need turrets.
- The Company Store opens after your first contract closes.
- The mouse wheel rotates the building being placed, and zooms otherwise. Ctrl+wheel always zooms.
- Right-click puts down the tool and clears the selection. Right-drag still pans.
- Clicking or tapping outside a menu closes it.
- The tutorial is now six short lessons that start when they're useful (new game, first contract, first wave warning, store opening, splitters, first breach). Steps that ask you to build wait until you do it. Menu → Tutorials replays them or switches them off.

## Unreleased: story phase 1, the Company
- You start ¢48,750 in debt to Halcyon Extraction Co. (placeholder name).
- Timed shipping contracts: deliver the listed items to the hub to get paid, minus satirical deductions. Missed contracts are fined, and the next one grows.
- Inbox with Company emails: contracts, payslips, fines, licence fees, repair invoices, a wildlife advisory.
- Company Store: emergency supply crates on credit.
- Research charges a licence fee, and hub breaches send a repair invoice.
- Top bar: contract countdown and progress, plus a mail button with an unread count. The tutorial covers both.
- Saves move to v4; v3 saves gain the Company on load.

## Unreleased: M3a, placeholder art and main menu
- Detailed placeholder art for every P1 and P2 sprite: items, resource nodes, ground, all buildings, the hub, and enemies. Turrets and cannons aim their barrels.
- Effects: muzzle flashes, cannon blasts, enemy death puffs, spawn warning markers, and a hub breach shockwave.
- Art pipeline: drop a PNG into `src/art/` with the same name as a placeholder to replace it.
- Main menu with a live demo factory behind it: Continue (shows mode and wave), New game, How to play.
- New menu style: navy and sky blue, flat icons, Montserrat headings. Toolbar and info panel show building and item art.
- The pause menu gains How to play and Main menu. Game over offers Main menu.

## Unreleased: M2b, progression and onboarding
- Research tree replaces tiers. You start with belt, extractor and furnace, and research the rest using hub stock.
- Spotlight tutorial on first launch, which can be replayed from the menu.
- Hub ports put a chosen item from hub stock back onto belts, so stock can feed turrets.
- Standard mode: losing the hub causes a breach (stock lost, attack ends) instead of game over.
- Hardcore mode (losing the hub ends the run), unlocked by clearing wave 10 in Standard.
- A New game dialog to choose the mode.
- Starting iron plates raised from 80 to 100.
- Saves move to v3; v1 and v2 saves are migrated.
- Docs reorganised into `docs/`.

## M2a: logistics and sustain
- Splitters, underground belts, repair stations and the runner enemy.
- Saves move to v2.

## M1: prototype
- Core loop: extractors, belts, furnaces, workshops, assemblers, the hub, and tiers.
- Waves, turrets, cannons and walls. Touch and desktop controls. Autosave.
