# Game design

How the game works on `master` today. Balance numbers live in
`src/sim/data.ts`, which wins if this doc disagrees with it.

## Core loop

1. Mine raw resources with **extractors** on resource nodes.
2. Carry them on **belts** to machines that turn them into parts.
3. Deliver items to the **hub**. Its stock pays for buildings and research.
4. **Research** unlocks new buildings.
5. Feed **turrets** with items to survive **waves** of enemies.

## Map

- A 64×64 tile grid, generated from a seed (the same seed gives the same map).
- The 3×3 hub sits in the centre. Iron, copper and stone clusters are guaranteed
  7–10 tiles from the hub, with more clusters scattered across the map.
- Resource nodes never run out.

## Items and recipes

| Item | Made in | From | Time |
|---|---|---|---|
| Iron ore, copper ore, stone | Extractor | resource node | 1.5 s |
| Iron plate | Furnace | 1 iron ore | 1.6 s |
| Copper ingot | Furnace | 1 copper ore | 1.6 s |
| Brick | Furnace | 2 stone | 2 s |
| Gear | Workshop | 2 iron plates | 2 s |
| Copper wire ×2 | Workshop | 1 copper ingot | 1.5 s |
| Motor | Assembler | 1 gear + 2 wire + 1 iron plate | 4 s |

A machine picks its recipe from the first input it receives, or the player
picks one in its info panel. Changing the recipe discards inputs it has already received.

## Buildings

| Building | Cost | HP | Unlocked by |
|---|---|---|---|
| Belt | 1 iron plate | 30 | start |
| Extractor | 6 iron plates | 80 | start |
| Furnace | 4 bricks, 2 iron plates | 120 | start |
| Turret | 10 iron plates, 2 copper ingots | 150 | Basic Defense |
| Wall | 3 bricks | 400 | Masonry |
| Workshop | 8 iron plates, 4 copper ingots | 120 | Workshops |
| Hub Port | 10 iron plates, 5 copper ingots | 120 | Distribution |
| Splitter | 3 iron plates, 1 copper ingot | 40 | Logistics |
| Underground Belt | 4 iron plates, 1 brick | 40 | Underground Transport |
| Assembler | 10 gears, 10 wire | 150 | Assembly |
| Repair Station | 12 iron plates, 4 gears, 6 wire | 150 | Field Repair |
| Cannon | 15 iron plates, 5 gears, 2 motors | 220 | Heavy Ordnance |

- Building costs are paid from hub stock. Demolishing a building refunds its
  cost, scaled by the HP it has left.
- **Hub:** 600 HP. Accepts any item from any side.

## Logistics rules

- **Belts** move 1.5 tiles/s and hold about 3 items per tile. A belt accepts items from
  any side except the tile it points into.
- **Machines and extractors** output only in the direction of their arrow.
  Machines accept input from any side and buffer up to 3 crafts' worth of each input.
- **Splitters** accept only from directly behind. They send items out the front, left and
  right in turn, skipping any blocked side.
- **Underground belts** pair an entrance with the next tunnel placed up to 5
  tiles ahead in the same direction. Exits accept no input. Items in transit
  are lost if either end is removed.
- **Hub ports** must touch the hub, and always face away from it. Each port
  takes a chosen item out of hub stock, one every 0.5 s, and puts it on a belt.

## Research

Research is paid for at once from hub stock. You start with the belt, extractor and furnace.

```
Basic Defense (20 plates) → Turret
├─ Distribution (25 plates, 10 copper) → Hub Port
Masonry (12 bricks) → Wall
Workshops (30 plates, 10 copper) → Workshop
├─ Logistics (20 plates, 10 gears) → Splitter
│  └─ Underground Transport (20 gears, 10 bricks) → Underground Belt
├─ Assembly (30 gears, 30 wire) → Assembler
│  └─ Heavy Ordnance (10 motors, 30 gears; also needs Basic Defense) → Cannon
└─ Field Repair (20 gears, 20 wire; also needs Masonry) → Repair Station
```

Starting stock: 100 iron plates, 24 bricks, 16 copper ingots.

## Defense

### Supplying turrets

Turrets hold ammo as shots, and arrive fully loaded. You refill them with items:

| Turret | Ammo | Shots per item | Max shots | Range | Fire rate | Damage |
|---|---|---|---|---|---|---|
| Turret | iron plate | 4 | 40 | 5 | 3/s | 5 |
| Cannon | gear | 3 | 24 | 6.5 | 0.7/s | 30, splash radius 1.3 |

There are two ways to get ammo to a turret:

1. **From production:** branch a line with a splitter. Best for steady supply.
2. **From the hub:** a hub port sends stock back out onto a belt. This lets
   stockpiled items defend the base, but every item it sends out leaves the stock you
   use for building and research. See [DECISIONS.md](DECISIONS.md) (D-006).

**Repair stations** heal the most damaged building within 3.5 tiles, at 20 HP/s.
They are fuelled by iron plates (1 plate = 40 HP, holding up to 400 HP), and arrive half full.

### Enemies

| Enemy | HP | Speed (tiles/s) | Damage to buildings | First appears |
|---|---|---|---|---|
| Crawler | 18 | 1.1 | 8/s | wave 1 |
| Runner | 10 | 2.2 | 5/s | wave 2 |
| Brute | 110 | 0.55 | 30/s | wave 3 |

- Enemies follow a flow field to the hub. Belts, splitters and tunnels can be
  walked over. Other buildings block, and enemies chew through them when that
  is the cheapest route. A building's path cost scales with its HP, so walls steer enemies.
- Enemy HP increases by 15% per wave.

### Waves

- The first wave arrives at 3:00, then one every 75 s.
- Wave *n* has 4 + 2n crawlers, 2(n−1) runners from wave 2, and n−2 brutes from wave 3.
- Waves come from 1 map-edge spawn point, or 2 from wave 4. The points are shown 30 s ahead.

## Modes

| | Standard (default) | Hardcore |
|---|---|---|
| Hub reaches 0 HP | **Breach:** remaining enemies are removed, 25% of every item in stock is lost, the hub is restored to 50% HP, and the next wave is delayed 60 s | Run over |
| Availability | Always | Unlocked by clearing wave 10 in Standard |

The hardcore unlock is stored in the browser's profile, separate from the save file.

## Onboarding

- The game opens on a **main menu**, with a small factory running behind it.
  It offers **Continue** (when a save exists, showing its mode and next wave),
  **New game** (choose the mode) and **How to play**.

- A tutorial plays the first time you start a game, and can be replayed from the pause menu. Each step
  darkens the screen except a spotlight (a circle or rounded rectangle) on the
  thing being explained, with Back, Next and ✕ buttons. The game is paused while it's open.
- Steps: the hub, hub stock, a resource node, the extractor, the belt, the furnace,
  research, waves, hub health (text depends on the mode), and the menu.

## Controls

| | Desktop | Touch |
|---|---|---|
| Build / select | Left click | Tap |
| Lay belts | Drag with the Belt tool | Drag with the Belt tool |
| Pan | Right or middle drag, WASD | Drag with no tool, or two fingers |
| Zoom | Mouse wheel | Pinch |
| Rotate | R | Rotate button |
| Demolish | X | Demolish button |
| Pick a building | 1–9 | Toolbar |
| Pause | Space | ❚❚ button |

## Saves

- Autosaved to the browser's local storage every 20 s and when the page is hidden.
- Save files are versioned (currently v3). Older saves are migrated when loaded,
  and every migration is covered by a test.
