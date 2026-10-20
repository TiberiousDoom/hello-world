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
- **Hub:** 600 HP. Accepts any item from any side. It has a **built-in gun**: 9 damage, 1.2 shots/s, range 6 from its centre, and no ammo needed. It beats wave 1 alone but not wave 3.

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

## The Company

You're a contractor for **Halcyon Extraction Co.** (placeholder name), and you
start ¢48,750 in debt. Numbers live in `src/sim/company.ts`.

### Contracts
- The first contract arrives 30 s into a game. The next one arrives 45 s after each contract closes.
- A contract lists 1 item (contract 1), 2 items (contracts 2–3) or 3 items. The items are
  picked from iron plates, copper ingots and bricks, plus gears and wire once Workshops are researched,
  and motors once Assembly is. Amounts grow 25% per contract.
- You have **6 minutes**. Only items delivered to the hub while the contract is open count.
- When every count is met, the contract closes at once. The items **ship home out of hub stock**,
  and you're paid. Wage: ¢1,500 + ¢250 per contract, minus 3–5 random deductions
  (habitat rent, oxygen allocation, a gravity surcharge…). The net goes against your debt.
- If time runs out, whatever was delivered (and is still in stock) ships. You're fined
  ¢1,000 plus ¢40 per item short. You're also put on a **Performance Improvement Plan**:
  the next contract is 10% bigger for each miss in a row, up to 50%.

### Other charges
- **Research licence:** ¢1,500 per research.
- **Hub breach:** a ¢5,000 repair invoice, on top of the stock lost (Standard mode).

### Company Store
Opens once the first contract closes (met or missed), announced by email. Crates are paid for on credit: items go straight into hub stock, and the price is added to your debt.
You can't buy past a credit limit of ¢100,000.

| Crate | Items | Price |
|---|---|---|
| Iron plate crate | 30 iron plates | ¢1,800 |
| Brick pallet | 20 bricks | ¢1,400 |
| Copper ingot crate | 20 copper ingots | ¢1,600 |
| Gear box | 10 gears | ¢2,200 |

### Inbox
The mail button shows unread mail. Emails cover: a welcome, every new contract,
payslips, underperformance notices, licence fees, repair invoices and a wildlife
advisory before the first wave. The inbox keeps the 60 newest emails. The contract button in the
top bar shows the time left and progress.

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

- **Tutorial lessons** start by themselves the first time each one is useful:

  | Lesson | Starts when | Steps |
  |---|---|---|
  | Essentials | A game has no extractors or belts yet | The hub → pick the extractor → place it on iron ore → lay 3 belts → build a furnace → deliver a plate → hub stock |
  | Contracts | The first contract arrives | Contract button, inbox |
  | Defense | The first wave warning | Spawn marker → research Basic Defense |
  | Company Store | The store opens | Where to find it |
  | Splitters and tunnels | The splitter is unlocked | What splitters do |
  | Breaches | The hub is breached for the first time | What a breach costs |

- **Action steps** (marked by a pulsing spotlight and a "Skip step" button) wait for you to act. The game keeps running and the dim overlay lets clicks through.
- **Explanation steps** pause the game until you press Next.
- Every lesson card has ✕ (close) and **Hide tips** (switches lessons off).
- Lessons play once. Menu → Tutorials lists them, replays any of them, and switches automatic lessons on or off.

## Controls

| | Desktop | Touch |
|---|---|---|
| Build / select | Left click | Tap |
| Lay belts | Drag with the Belt tool | Drag with the Belt tool |
| Pan | Right or middle drag, WASD | Drag with no tool, or two fingers |
| Zoom | Mouse wheel (with no building selected), or Ctrl+wheel | Pinch |
| Rotate | Mouse wheel while placing, or R | Rotate button |
| Demolish | X | Demolish button |
| Pick a building | 1–9 | Toolbar |
| Pause | Space | ❚❚ button |
| Put down the tool or clear the selection | Right-click or Esc | Tap the tool again |
| Close a menu | Click outside it | Tap outside it |

## Saves

- Autosaved to the browser's local storage every 20 s and when the page is hidden.
- Save files are versioned (currently v4). Older saves are migrated when loaded,
  and every migration is covered by a test.
