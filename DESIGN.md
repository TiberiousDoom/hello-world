# Design and roadmap

## Pillars

1. **Builderment-style automation:** infinite resource nodes, extractors,
   belts, and machines that chain into increasingly complex items.
2. **The factory is the defense:** turrets consume items as ammo, so the
   defense depends on the factory. Enemies chew through anything blocking
   their path to the hub.
3. **Desktop and mobile:** every action works with mouse, keyboard or touch.

## Milestone 1 (this build)

- 64×64 seeded map with iron, copper and stone nodes, and a 3×3 hub in the centre.
- Buildings: belt, extractor, furnace, workshop, assembler, turret, cannon, wall.
- Items: iron ore, copper ore, stone, iron plate, copper ingot, brick, gear, wire, motor.
- Machines choose a recipe from their first input, or the player picks one.
- Building costs come from hub stock. Demolishing refunds the cost, scaled by remaining HP.
- 3 tiers, unlocked by delivering goal items to the hub.
- Waves start at 3:00 and then come every 75s. Spawn points are shown 30s ahead.
  Crawlers come first, and brutes join from wave 3. HP increases 15% per wave.
- Enemies follow a flow field from the hub. The path cost of blocking buildings
  scales with their HP, so walls steer enemies and they chew through when that is the cheaper route.
- Autosave to local storage. Speed controls (pause, 1×, 2×, 4×).

All balance numbers are in `src/sim/data.ts`.

## Roadmap

**Milestone 2a: logistics and sustain (done)**

The gap Milestone 1 left: production lines can't branch, so feeding turrets
means building a separate mine for each one. This milestone fixes that and
gives the player ways to keep their base alive.

- **Splitter** (tier 1): takes items from behind and sends them out of its
  front, left and right sides in turn, skipping any blocked side. Use it to
  branch a plate line off to a turret.
- **Underground belt** (tier 1): place an entrance, then an exit up to 5
  tiles ahead facing the same way. They pair automatically. Items pass
  under buildings, belts and walls, and enemies can walk over both ends.
- **Repair station** (tier 2): repairs the most damaged building within 3.5
  tiles. Iron plates fed in by belt are its fuel (1 plate = 40 HP).
- **Runner** enemy: fast with low HP. Runners join waves from wave 2, so
  turrets with a long range or fast fire rate become important.
- Saves from Milestone 1 load into the new version.

**Milestone 2b: depth**
- Machine and belt upgrade tiers, plus more recipes and tiers
- Item filters on splitters
- More enemy types (flying, armoured) and turret types (e.g. tesla fed by wire)
- Better wave pacing and difficulty settings; optionally, enemy nests on the map to clear
- Sound effects and real art (2D sprites)

**Milestone 3: mobile app**
- Wrap the web build with [Capacitor](https://capacitorjs.com/) to produce
  iOS and Android apps from the same code
- Offline support (PWA/service worker), app icons, and haptics
- Cloud saves (optional)

**Milestone 4: 3D**
- Add a Three.js (or Babylon.js) renderer next to `src/render/renderer.ts`.
  The simulation in `src/sim` already uses tile coordinates and has no
  rendering code, so it carries over unchanged.
- Low-poly models, an angled camera, and animated machines

## Open questions

- Final name and art direction
- Whether losing the hub ends the run, or there should be a softer penalty or a "peaceful" mode
- Monetisation model for the app stores, if any
