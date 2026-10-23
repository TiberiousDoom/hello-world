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
| M3b: Final art and sound | Replace placeholders with final sprites, plus sound | 🚧 Music and sound effects done; forest placeholders in; final sprites to come |
| M3c: Playtest polish | Playtest notes: tutorial, store lock, hub weapon, controls; batch 2 (blueprints, belts, forest); batch 3 (music, tracker, lessons) | ✅ |
| M4: Depth | Upgrades, more content, balance | ⬜ |
| M4s: Story layer | Colony supply ship with repeat runs and colony blueprints (D-046 to D-050). Food is set aside for wood (D-044). The Company, contracts and black market were dropped (D-040) | 🚧 |
| M4m: Open map | Procedural 256×256 map, bug territories instead of waves, bigger buildings, leaner screen (D-038 to D-042) | ✅ |
| M4w: Wood | Trees in the simulation, Lumber Camp, planks, palisades, stake turret, charcoal and steel (D-044) | 🚧 Phases 1 and 2 done; forest and bugs next |
| M4c: Co-op | 2–4 players in one shared world (D-056, [COOP.md](COOP.md)) | ⬜ |
| M5: Mobile app | Store-ready iOS and Android builds | ⬜ |
| M6: 3D | Low-poly 3D renderer | ⬜ |

## Next up (in order)

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
21. **Nests (D-065, #53):** phase 1 (mounds and chitin) is done in 0.31.0, phase 2 (breeding and young bugs) in 0.36.0, phase 3 (threat) in 0.37.0; the rest follows the phases under Gameplay → Nests.
22. ✅ **Player character** (0.32.0, #40, D-067): an engineer who walks (tap or WASD), mines by hand, carries items that trail behind, drops them at the hub, and fetches or hands over items. Next: bugs that notice the engineer, then co-op phase 1.
23. ✅ **Day, night and seasons** (0.33.0, #42, D-068): a 9-minute day, bugs ranging further at night, four seasons changing tree regrowth and the look of the map, a clock, and a short piece of music for each season. Night raids (D-065) can come next. Belt feedback batch filed as #61–#65.
24. ✅ **Belt batch** (playtest #61–#65): two-lane belts, splitter filters and side snapping (0.34.0, D-069); an exit blueprint for underground belts, and belt lines that go under belts they cross (0.35.0, D-070).

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
    - ⬜ **Later blueprints (D-055):** each joins the pool once it's built: the Steel Extractor mk2 and Blast Furnace mk2 (with steel), Mortar, Conveyor Drone Pad, Tree Nursery (with wood phase 3), Shield Pylon, Storage Silo and Floodlights. The order is still to choose
    - Tests for each step: unit tests for offers, picking, unlocks, the wake radius, express belt speed and upgrading, and tesla chains; a browser test that picks a blueprint after a delivery
- ⏸ Vehicles and gear (D-021)

### Playtest polish (M3c)
- ✅ **Hub weapon:** the hub has a built-in gun (range 8 from its centre) that needs no ammo and never upgrades (D-024)

### Wood (M4w, D-044)
Not the escape ship's hull. In this order:
- ✅ **Phase 1, trees and the basics:** forest from map generation, saved (v9, with a v8 migration); trees block building and stumps don't. A Lumber Camp cuts the nearest tree in reach into logs, and stumps regrow. A Sawmill makes planks (D-045). Palisade walls made of planks. Forestry and Palisades research. Placeholder sprites, a chop sound and a leaf burst
- ✅ **Phase 1 follow-ups:** a Wood lesson when Forestry is researched, a lumber camp and sawmill in the main-menu demo, and a browser test
- ✅ **Phase 2, wood in the economy (D-054):** the Ballista, firing stakes sawn from planks; repair stations also burn planks; planks in the Workshop, Repair Station and Shipyard (Workshops now needs Forestry); charcoal (furnace, from logs), then steel (charcoal and iron plates), carried from the fourth supply run on and the material for upgrades to come. Also: Reset tutorials in Menu → Tutorials
- ⬜ **Phase 3, forests and bugs:** some nests deep in forest; cutting trees inside a territory provokes it; dense trees slow bugs, so clearing forest opens paths; a Tree Nursery that plants new forest (a colony blueprint, D-055)

### Co-op (M4c, D-056, [COOP.md](COOP.md))
In this order. Phase 0 can start before the player character (playtest issue #40), which then builds on it:
- ✅ **Phase 0, prepare in single player (D-058):** every world-changing action goes through a command list; players and the path-refresh timers in the saved state (a save version bump); a clock driven by commands; `Math.hypot` out of the rules; a summary hash and a cross-browser determinism test. No visible change. Building it added a checkpoint command, so a game joining from a snapshot has the same path fields as the host
- ✅ **Before phase 1: the player character** (0.32.0, #40, D-067), built on commands
- ⬜ **Phase 1, two-player prototype:** room codes, a test relay, a version check on joining, lockstep with input delay, both characters visible, no pausing for tutorials or the blueprint pick
- ⬜ **Phase 2, make it solid:** the real relay, joining mid-game, desync detection and resync, reconnecting after a phone sleeps
- ⬜ **Phase 3, co-op design:** pings, player colours, blueprint picks without pausing, balance, up to 4 players

### Nests (D-065, #53)
In this order:
- ✅ **Phase 1, mounds and chitin** (0.31.0): nests are mounds with health; destroying one clears the territory, survivors stay angry until killed; chitin drops into stock; its first use is Chitin Plating (research: 1.5× health for turrets and walls)
- ✅ **Phase 2, breeding and young bugs** (0.36.0, D-071): calm nests breed back to their starting number; young bugs hatch small and weak and grow up over 3 minutes. They reuse the adult sprites, smaller and paler, until young-bug art exists
- ✅ **Phase 3, threat** (0.37.0, D-072): a threat level rising every 18 minutes makes new bugs tougher and spreading faster; shooting a nest's bugs wakes its neighbours
- ⬜ **Phase 4, themed kinds and queens:** crawler warrens, runner hives and brute dens by distance, each with its own mound art; rare queen nests near the map edge
- ⬜ **Phase 5, Hardcore nests:** harder numbers, destroy only by building over the mound and a ring, faster breeding while being built over; the Hardcore look
- ⬜ **Night raids:** after day and night (#42)

### Next (M4)
- ✅ Faster belts: the Express Belt, a colony blueprint (D-049, D-050)
- ⬜ A mk2 tier for each machine, made with steel (D-044); the Steel Extractor and Blast Furnace come first, as colony blueprints (D-055)
- ✅ Item filters on splitters: every splitter sorts one item to a side (#62, D-069; the Sorting Splitter blueprint was dropped)
- ⬜ More enemy types: flying (ignores walls) and armoured (resists turrets)
- ✅ A tesla turret fed by wire (a colony blueprint, D-050) and the Ballista, firing stakes (D-054)
- ⬜ More defence as colony blueprints: the Mortar, Shield Pylon and Floodlights (D-055)
- ⬜ Better ammo as optional upgrades (D-006, option D)
- ⬜ More recipes and research to extend the mid- and late game
- ✅ Research draws its items from hub stock over time, stalls when stock runs out, and can be switched or paused (D-018, D-026)
- ✅ Win condition: escape (D-019, D-034). Replaced by repeat colony supply runs (D-046)
- ⬜ Enemy targeting: nearest building, and later enemies switch to turrets that shoot them (D-020)
- ⬜ Difficulty settings for Standard (nest density and toughness)
- ✅ Enemy nests on the map that players can clear (D-038)

## 2. Balance and playtesting
- 🚧 First playtest by the project owner. Notes go in issues labelled `playtest`
- ⬜ A balance pass on nest density and toughness, research costs and starting stock
- ⬜ A headless balance script that pits nests of each distance against a reference defence, run in CI
- ⬜ Outside playtesters (5–10); the in-game feedback form is ready (D-064)

## 3. UX and onboarding
- ✅ Spotlight tutorial (M2b)
- ✅ Main menu with a live demo factory behind it: Continue, New game, How to play (M3a)
- ⬜ Settings screen reachable from the main menu (today, music volume and the touch-confirm setting are in the pause menu)
- ⬜ Tooltips for items in the hub stock panel (touch users can't hover; item icons help)
- ⬜ Hotkeys beyond 9 tools, and a key-binding screen
- ✅ **Pick a building to build more of it:** a middle-click on a placed building (desktop), or a long press on one (touch), makes that building the tool in hand, facing the same way, ready to place again. A middle-drag still pans
- ✅ **Buildings line up with belts while you aim (D-053):** hovering a building over or next to a belt line turns and centres the blueprint so it connects: dropped onto the line it runs along it (as it already does once placed), and beside a line's end it faces so the belt feeds it or it feeds the belt
- ✅ **Hub stock only while the hub is selected or pointed at** (D-053), so the map around the hub stays clear
- ⬜ **Clear a belt line** (owner's note, for later): one action empties every item off a whole belt line (the same line the Express Belt upgrade uses), leaving the belts in place. Where the items go (back into hub stock, or lost) is to be decided (Q-19)
- ⬜ Undo for the last placement or demolish
- ⬜ Copy and paste for sections of a factory
- ⬜ A settings screen: UI scale, reduced motion (the music and sound effects volumes are in the pause menu)
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
- ❓ Name (Q-1)
- ✅ Art pipeline: sprites load from `src/art/`, and a PNG replaces a same-named SVG placeholder (M3a)
- ✅ Placeholder SVGs for every P1 and P2 sprite, plus UI icons and a logo mark (M3a)
- ✅ Effects drawn in code: muzzle flash, cannon blast, death puff, breach shockwave, nest mounds and territory outlines (M3a, D-038)
- ✅ Menu style: navy and sky blue, flat icons, Montserrat headings (M3a, D-011)
- 🚧 Final P1 sprites from the project owner: items, resource nodes, belt, extractor, furnace, hub, turret, crawler
- ⬜ Final P2 sprites: remaining buildings and enemies
- ⬜ Final P3: effects, UI icons, app icon
- ⬜ Loading animation strips (frame sheets) for belts, machines and enemies
- ✅ Music: thirteen original tracks generated in code in a late-90s adventure style: the menu theme, seven shuffled in-game tracks from slow to upbeat, a fanfare for the first delivery, and a short piece for each season. Menu and game music flow into each other without a cut (D-032, D-051, D-052)
- ✅ Forest placeholders: grass, decorations, trees, fireflies and leaves; detailed bugs (batch 2)
- ✅ Sound effects, synthesized in the browser (D-043), including a machine-running hum that follows how busy the factory on screen is
- 🚧 Animation: belts (chevrons, corners), turret aim and two-frame enemy walk cycles are in code; machine animations to come

## 5. Tech and quality
- ✅ Unit tests for the simulation, run in CI on every PR
- ✅ Versioned saves with tested migrations (v8 started over with the new map, D-038)
- ✅ Browser tests (Playwright, `e2e/`) in CI on desktop and phone viewports: lessons, blueprints, HUD, controls, music, the supply ship and wood (D-035)
- ⬜ A performance budget: 60 fps on a mid-range phone with 1,000 buildings and 200 enemies
- ⬜ Lint and format checks (ESLint, Prettier)
- 🚧 Error reporting (Q-7): the feedback form includes recent page errors when a player sends a report (D-064); automatic reporting is still open
- 🚧 Save export and import: the feedback form can download the current game; importing a save is still to come

## 6. Platform and release
- ✅ Single-file build for sharing (claude.ai artifact)
- ✅ GitHub Pages deployment from `master` (D-010)
- ⬜ PWA: offline play, install to home screen, app icon
- ⬜ Capacitor wrapper for iOS and Android (M5)
- ⬜ Store accounts (Apple Developer, Google Play), signing, and a build pipeline
- ⬜ Store listings: screenshots, description, privacy policy, age rating
- ⬜ Cloud saves (optional)

## 7. Accessibility
- ⬜ Colour-blind-safe items: distinct shapes as well as colours (the sprites solve most of this)
- ⬜ Text that scales with system settings, and minimum touch target sizes
- 🚧 Respect reduced-motion (done for the tutorial, fireflies and leaves; extend to effects)

## 8. Business and legal
- ⬜ Optional purchase plus donations or tips (D-017)
- ⬜ Trademark check on the final name
- ✅ Licences for third-party assets tracked in [CREDITS.md](CREDITS.md) (music; Montserrat is OFL)
- ⬜ Privacy policy (required by app stores, even with no data collection)
