# Changelog

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
