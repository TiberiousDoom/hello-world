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
14. **Next:** playtest the open map, wood phase 1 and supply runs (nest density, territory sizes, how far bugs chase, forest density and regrowth, launch difficulty, cargo sizes); then wood phase 2 (D-044, see Gameplay → Wood).

---

## 1. Gameplay

### Done
- ✅ Map generation, extractors, belts, furnaces, workshops, assemblers (M1)
- ✅ Hub stock pays for buildings, with refunds on demolish (M1)
- ✅ Waves, flow-field pathing, turrets, cannons, walls (M1). Waves replaced by bug territories (D-038)
- ✅ Splitters, underground belts, repair stations, runner enemy (M2a)
- ✅ Research tree replaces tiers, and play starts with 3 buildings (M2b)
- ✅ Hub ports for sending items back out of the hub (M2b, D-006 proposed)
- ✅ Standard and hardcore modes, with the hardcore unlock (M2b)
- ✅ Spread-out resource nodes for new games, and longer gaps between waves (playtest batch 2, D-029, D-031)
- ✅ Procedural 256×256 map with noise ore fields; bug territories in 10×10 cells that attack when provoked and calm down after 30 s (D-038)
- ✅ Building sizes: extractor and furnace 2×2, workshop 3×2, assembler 4×2, hub 5×5, with a marked output port (D-039)

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
    - ⬜ **Later blueprints:** sorting splitters and mk2 machines (after steel, wood phase 2) join the pool when they're built
    - Tests for each step: unit tests for offers, picking, unlocks, the wake radius, express belt speed and upgrading, and tesla chains; a browser test that picks a blueprint after a delivery
- ⏸ Vehicles and gear (D-021)

### Playtest polish (M3c)
- ✅ **Hub weapon:** the hub has a built-in gun (range 8 from its centre) that needs no ammo and never upgrades (D-024)

### Wood (M4w, D-044)
Not the escape ship's hull. In this order:
- ✅ **Phase 1, trees and the basics:** forest from map generation, saved (v9, with a v8 migration); trees block building and stumps don't. A Lumber Camp cuts the nearest tree in reach into logs, and stumps regrow. A Sawmill makes planks (D-045). Palisade walls made of planks. Forestry and Palisades research. Placeholder sprites, a chop sound and a leaf burst
- ✅ **Phase 1 follow-ups:** a Wood lesson when Forestry is researched, a lumber camp and sawmill in the main-menu demo, and a browser test
- ✅ **Phase 2, wood in the economy (D-054):** the Ballista, firing stakes sawn from planks; repair stations also burn planks; planks in the Workshop, Repair Station and Shipyard (Workshops now needs Forestry); charcoal (furnace, from logs), then steel (charcoal and iron plates), carried from the fourth supply run on and the material for upgrades to come. Also: Reset tutorials in Menu → Tutorials
- ⬜ **Phase 3, forests and bugs:** some nests deep in forest; cutting trees inside a territory provokes it; dense trees slow bugs, so clearing forest opens paths; a tree nursery that plants new forest

### Next (M4)
- ⬜ Upgrades: faster belts (the Express Belt, a colony blueprint, D-049) and a mk2 tier for each machine (made with steel, D-044)
- ⬜ Item filters on splitters
- ⬜ More enemy types: flying (ignores walls) and armoured (resists turrets)
- ⬜ A tesla turret fed by wire (a colony blueprint, D-049), and other ammo options (a wooden stake turret is planned under Wood)
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
- ⬜ Outside playtesters (5–10), with a short feedback form

## 3. UX and onboarding
- ✅ Spotlight tutorial (M2b)
- ✅ Main menu with a live demo factory behind it: Continue, New game, How to play (M3a)
- ⬜ Settings screen reachable from the main menu (today, music volume and the touch-confirm setting are in the pause menu)
- ⬜ Tooltips for items in the hub stock panel (touch users can't hover; item icons help)
- ⬜ Hotkeys beyond 9 tools, and a key-binding screen
- ✅ **Pick a building to build more of it:** a middle-click on a placed building (desktop), or a long press on one (touch), makes that building the tool in hand, facing the same way, ready to place again. A middle-drag still pans
- ✅ **Buildings line up with belts while you aim (D-053):** hovering a building over or next to a belt line turns and centres the blueprint so it connects: dropped onto the line it runs along it (as it already does once placed), and beside a line's end it faces so the belt feeds it or it feeds the belt
- ✅ **Hub stock only while the hub is selected or pointed at** (D-053), so the map around the hub stays clear
- ⬜ **Clear a belt line** in one go (owner's note, for later): with Demolish, one tap or click on a belt removes its whole line (the same line the Express Belt upgrade uses), refunding every belt. Maybe also a way to empty a line's items without removing it
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
- ✅ Music: nine original tracks generated in code in a late-90s adventure style: the menu theme, seven shuffled in-game tracks from slow to upbeat, and a fanfare for the first delivery. Menu and game music flow into each other without a cut (D-032, D-051, D-052)
- ✅ Forest placeholders: grass, decorations, trees, fireflies and leaves; detailed bugs (batch 2)
- ✅ Sound effects, synthesized in the browser (D-043), including a machine-running hum that follows how busy the factory on screen is
- 🚧 Animation: belts (chevrons, corners), turret aim and two-frame enemy walk cycles are in code; machine animations to come

## 5. Tech and quality
- ✅ Unit tests for the simulation, run in CI on every PR
- ✅ Versioned saves with tested migrations (v8 started over with the new map, D-038)
- ✅ Browser tests (Playwright, `e2e/`) in CI on desktop and phone viewports: lessons, blueprints, HUD, controls, music, the supply ship and wood (D-035)
- ⬜ A performance budget: 60 fps on a mid-range phone with 1,000 buildings and 200 enemies
- ⬜ Lint and format checks (ESLint, Prettier)
- ⬜ Error reporting (Q-7)
- ⬜ Save export and import (backup, or moving between devices)

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
