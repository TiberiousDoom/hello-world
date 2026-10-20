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
| M4: Depth | Upgrades, more content, balance | ⬜ |
| M4s: Story layer (proposal) | Quotas, suspicion, black market, food, escape ship ([STORY.md](STORY.md)) | ❓ Q-8 to Q-11 |
| M5: Mobile app | Store-ready iOS and Android builds | ⬜ |
| M6: 3D | Low-poly 3D renderer | ⬜ |

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

### Next (M4)
- ⬜ Upgrades: faster belts and a mk2 tier for each machine
- ⬜ Item filters on splitters
- ⬜ More enemy types: flying (ignores walls) and armoured (resists turrets)
- ⬜ A tesla turret fed by wire, and other ammo options
- ⬜ Better ammo as optional upgrades (D-006, option D)
- ⬜ More recipes and research to extend the mid- and late game
- ❓ Research that takes time or uses a research building (Q-4)
- ❓ Win condition or campaign (Q-5)
- ❓ How enemies choose targets (Q-6)
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
- ⬜ Interactive tutorial steps that wait for the player to place an extractor (optional; see D-009)

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
- ❓ Monetization model (Q-2)
- ⬜ Trademark check on the final name
- ⬜ Licences for any third-party assets and fonts, tracked in `CREDITS.md`
- ⬜ Privacy policy (required by app stores, even with no data collection)
