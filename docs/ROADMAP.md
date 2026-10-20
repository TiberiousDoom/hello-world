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
| M3a: Placeholder art and main menu | Detailed placeholder sprites, art pipeline, main menu, menu style | ✅ (this PR) |
| M3b: Final art and sound | Replace placeholders with final sprites, plus sound | ⬜ |
| M3c: Playtest polish | Owner's playtest notes: tutorial, store lock, hub weapon, controls | ✅ |
| M4: Depth | Upgrades, more content, balance | ⬜ |
| M4s: Story layer | Contracts and inbox ✅; suspicion and black market; food; escape ship ([STORY.md](STORY.md)) | 🚧 |
| M5: Mobile app | Store-ready iOS and Android builds | ⬜ |
| M6: 3D | Low-poly 3D renderer | ⬜ |

## Next up (in order)

1. ✅ Merge story phase 1 (contracts and inbox).
2. ✅ M3c playtest polish: controls, wheel rotation, store lock, hub weapon.
3. ✅ Interactive tutorial (M3c).
4. **Research over time (D-018).** It changes the early economy, so do it before balancing.
5. **Story phase 2:** suspicion, audits and the black market.

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

### Story layer (M4s, [STORY.md](STORY.md))
- ✅ Phase 1: Company contracts, wages and deductions, debt, fines, Company Store, licence fees, inbox (D-022)
- ⬜ Phase 2: suspicion, audits, black-market machines (skimmer, stash, hidden workshop), and penalties for getting caught (D-016)
- ⬜ Phase 3: food factories and meal buffs
- ⬜ Phase 4: escape ship and win screen, which unlocks endless mode (D-019)
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
- ⬜ Research consumes delivered items over time (D-018)
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
- ⬜ Settings screen reachable from the main menu
- ⬜ Tooltips for items in the inventory bar (touch users can't hover; item icons help)
- ⬜ Hotkeys beyond 9 tools, and a key-binding screen
- ⬜ Undo for the last placement or demolish
- ⬜ Copy and paste, or blueprints, for sections of a factory
- ⬜ A settings screen: sound, UI scale, reduced motion
- ✅ **Tutorial rework (M3c, D-025):** six lessons, each starting the first time it's useful: *Essentials* (a fresh factory), *Contracts* (the first contract), *Defense* (the first wave warning), *Company Store* (when it opens), *Splitters and tunnels* (when researched) and *Breaches* (the first breach).
  - Action steps wait for you to do the thing (place an extractor, lay belts, build a furnace, deliver a plate, research Basic Defense), and the game keeps running.
  - Explanation steps pause the game.
  - Each lesson plays once, and can be replayed or switched off in Menu → Tutorials.
- ✅ **Right-click clears the selected tool** (and the selection), the same as Esc. Right-drag still pans (M3c)
- ✅ **Clicking or tapping outside a menu closes it** (all dialogs except the tutorial and game over) (M3c)
- ✅ **Mouse wheel rotates** the building being placed, and zooms otherwise. Ctrl+wheel always zooms (M3c, D-023)

## 4. Art and audio
See [ART_LIST.md](ART_LIST.md) for the full list.
- ❓ Art direction and name (Q-1)
- ✅ Art pipeline: sprites load from `src/art/`, and a PNG replaces a same-named SVG placeholder (M3a)
- ✅ Placeholder SVGs for every P1 and P2 sprite, plus UI icons and a logo mark (M3a)
- ✅ Effects drawn in code: muzzle flash, cannon blast, death puff, spawn marker, breach shockwave (M3a)
- ✅ Menu style: navy and sky blue, flat icons, Montserrat headings (M3a, D-011)
- 🚧 Final P1 sprites from the project owner: items, resource nodes, belt, extractor, furnace, hub, turret, crawler
- ⬜ Final P2 sprites: remaining buildings and enemies
- ⬜ Final P3: effects, UI icons, app icon
- ⬜ Loading animation strips (frame sheets) for belts, machines and enemies
- ⬜ Sound effects (building placed, machine running, shot, explosion, breach, research done) and music
- ⬜ Animation: belts, machines, turret aim, enemy walk cycles

## 5. Tech and quality
- ✅ Unit tests for the simulation, run in CI on every PR
- ✅ Versioned saves with tested migrations
- ⬜ Browser smoke test (Playwright) in CI: load the game, place buildings, run a wave
- ⬜ A performance budget: 60 fps on a mid-range phone with 1,000 buildings and 200 enemies
- ⬜ Lint and format checks (ESLint, Prettier)
- ⬜ Error reporting (Q-7)
- ⬜ Save export and import (backup, or moving between devices)

## 6. Platform and release
- ✅ Single-file build for sharing (claude.ai artifact)
- 🚧 GitHub Pages deployment from `master` (D-010)
- ⬜ PWA: offline play, install to home screen, app icon
- ⬜ Capacitor wrapper for iOS and Android (M5)
- ⬜ Store accounts (Apple Developer, Google Play), signing, and a build pipeline
- ⬜ Store listings: screenshots, description, privacy policy, age rating
- ⬜ Cloud saves (optional)

## 7. Accessibility
- ⬜ Colour-blind-safe items: distinct shapes as well as colours (the sprites solve most of this)
- ⬜ Text that scales with system settings, and minimum touch target sizes
- ⬜ Respect reduced-motion (done for the tutorial; extend to effects)

## 8. Business and legal
- ⬜ Optional purchase plus donations or tips (D-017)
- ⬜ Trademark check on the final name
- ⬜ Licences for any third-party assets and fonts, tracked in `CREDITS.md`
- ⬜ Privacy policy (required by app stores, even with no data collection)
