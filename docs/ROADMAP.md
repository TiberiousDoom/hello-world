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
| M3b: Final art and sound | Replace placeholders with final sprites, plus sound | 🚧 Music done; forest placeholders in; final sprites and sound effects to come |
| M3c: Playtest polish | Playtest notes: tutorial, store lock, hub weapon, controls; batch 2 (blueprints, belts, forest); batch 3 (music, tracker, lessons) | ✅ |
| M4: Depth | Upgrades, more content, balance | ⬜ |
| M4s: Story layer | Contracts and inbox ✅; suspicion and black market ✅; food; escape ship ([STORY.md](STORY.md)) | 🚧 |
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
8. ❓ **Rework suspicion** (owner doesn't like the current mechanic). Brainstorm in progress; see Q-16.
9. **Then:** story phase 3 (food factories) or phase 4 (escape ship and win condition). Owner's choice; see Q-14. Wood as a resource (Q-15) could join the forest work.

---

## 1. Gameplay

### Done
- ✅ Map generation, extractors, belts, furnaces, workshops, assemblers (M1)
- ✅ Hub stock pays for buildings, with refunds on demolish (M1)
- ✅ Waves, flow-field pathing, turrets, cannons, walls (M1)
- ✅ Splitters, underground belts, repair stations, runner enemy (M2a)
- ✅ Research tree replaces tiers, and play starts with 3 buildings (M2b)
- ✅ Hub ports for sending items back out of the hub (M2b, D-006 proposed)
- ✅ Standard and hardcore modes, with the hardcore unlock (M2b)
- ✅ Spread-out resource nodes for new games, and longer gaps between waves (playtest batch 2, D-029, D-031)

### Story layer (M4s, [STORY.md](STORY.md))
- ✅ Phase 1: Company contracts, wages and deductions, debt, fines, Company Store, licence fees, inbox (D-022)
- ✅ Phase 2: A Friend, stash, skimmer, black-market research, suspicion, audits with penalties by mode (D-016, D-027). ❓ Suspicion to be reworked (Q-16)
- ⬜ Phase 3: food factories and meal buffs
- ⬜ Phase 4: hidden workshop, escape ship and win screen, which unlocks endless mode (D-019)
- ⏸ Vehicles and gear (D-021)

### Playtest polish (M3c)
- ✅ **Hub weapon:** the hub has a built-in gun that needs no ammo and never upgrades. It beats wave 1 alone while losing no more than 25% of its HP (a test checks 25 maps; the worst case is about 12%). It loses about half its HP to wave 2 and falls to wave 3, so turrets still matter (D-024)
- ✅ **Store lock:** the Company Store opens only after the first contract is completed or missed, and an email announces it

### Next (M4)
- ⬜ Upgrades: faster belts and a mk2 tier for each machine
- ⬜ Item filters on splitters
- ⬜ More enemy types: flying (ignores walls) and armoured (resists turrets)
- ⬜ A tesla turret fed by wire, and other ammo options
- ⬜ Better ammo as optional upgrades (D-006, option D)
- ⬜ More recipes and research to extend the mid- and late game
- ✅ Research draws its items from hub stock over time, stalls when stock runs out, and can be switched or paused (D-018, D-026)
- ⬜ Win condition: escape (D-019, story phase 4)
- ⬜ Enemy targeting: nearest building, and later enemies switch to turrets that shoot them (D-020)
- ⬜ Difficulty settings for Standard (wave size and timer)
- ⬜ Enemy nests on the map that players can clear (optional)

## 2. Balance and playtesting
- 🚧 First playtest by the project owner. Notes go in issues labelled `playtest`
- ⬜ A balance pass on wave pacing, research costs and starting stock
- ⬜ A headless balance script that simulates N waves against a reference layout, run in CI
- ⬜ Outside playtesters (5–10), with a short feedback form

## 3. UX and onboarding
- ✅ Spotlight tutorial (M2b)
- ✅ Main menu with a live demo factory behind it: Continue, New game, How to play (M3a)
- ⬜ Settings screen reachable from the main menu (today, music volume and the touch-confirm setting are in the pause menu)
- ⬜ Tooltips for items in the hub stock panel (touch users can't hover; item icons help)
- ⬜ Hotkeys beyond 9 tools, and a key-binding screen
- ⬜ Undo for the last placement or demolish
- ⬜ Copy and paste for sections of a factory
- ⬜ A settings screen: sound effects volume, UI scale, reduced motion
- ✅ **Tutorial rework (M3c, D-025):** seven lessons, each starting the first time it's useful: *Essentials* (a fresh factory, or chosen on New game), *Contracts* (the first contract), *Defense* (the first wave warning), *Black market* and *Company Store* (once their email is read, D-033), *Splitters and tunnels* (when researched) and *Breaches* (the first breach). Lessons never open over a window.
  - Action steps wait for you to do the thing (place an extractor, lay belts, build a furnace, deliver a plate, research Basic Defense), and the game keeps running.
  - Explanation steps pause the game.
  - Each lesson plays once, and can be replayed or switched off in Menu → Tutorials.
- ✅ **Right-click clears the selected tool** (and the selection), the same as Esc. Right-drag still pans (M3c)
- ✅ **Clicking or tapping outside a menu closes it** (all dialogs except the tutorial and game over) (M3c)
- ✅ **Blueprints (soft placement):** confirm, rotate or cancel before building; on touch by default, on desktop for dragged belt and wall lines (batch 2, D-030)
- ✅ **Hub stock over the hub** instead of a top bar row, pinned to the edge when off screen (batch 2)
- ✅ **Contract tracker** always on screen (batch 3)
- ✅ **Mouse wheel rotates** the building being placed, and zooms otherwise. Ctrl+wheel always zooms (M3c, D-023)

## 4. Art and audio
See [ART_LIST.md](ART_LIST.md) for the full list.
- ✅ Art direction: whimsical forest clearing around navy-and-steel Company machines (D-028)
- ❓ Name (Q-1)
- ✅ Art pipeline: sprites load from `src/art/`, and a PNG replaces a same-named SVG placeholder (M3a)
- ✅ Placeholder SVGs for every P1 and P2 sprite, plus UI icons and a logo mark (M3a)
- ✅ Effects drawn in code: muzzle flash, cannon blast, death puff, spawn marker, breach shockwave (M3a)
- ✅ Menu style: navy and sky blue, flat icons, Montserrat headings (M3a, D-011)
- 🚧 Final P1 sprites from the project owner: items, resource nodes, belt, extractor, furnace, hub, turret, crawler
- ⬜ Final P2 sprites: remaining buildings and enemies
- ⬜ Final P3: effects, UI icons, app icon
- ⬜ Loading animation strips (frame sheets) for belts, machines and enemies
- ✅ Music: corporate menu theme, shuffled lo-fi in game with crossfades, a win track (D-032)
- ✅ Forest placeholders: grass, decorations, trees, fireflies and leaves; detailed bugs (batch 2)
- ⬜ Sound effects (building placed, machine running, shot, explosion, breach, research done)
- 🚧 Animation: belts (chevrons, corners), turret aim and two-frame enemy walk cycles are in code; machine animations to come

## 5. Tech and quality
- ✅ Unit tests for the simulation, run in CI on every PR
- ✅ Versioned saves with tested migrations
- ⬜ Browser tests (Playwright) in CI. Suites exist and are run by hand before each PR (lessons, black market, blueprints, stock, controls, music); they still need to move into the repo and CI
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
