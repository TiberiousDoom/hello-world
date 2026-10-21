# Game design

How the game works on `master` today. Balance numbers live in
`src/sim/data.ts`, which wins if this doc disagrees with it.

## Core loop

1. Mine raw resources with **extractors** placed over ore.
2. Carry them on **belts** to machines that turn them into parts.
3. Deliver items to the **hub**. Its stock pays for buildings and research.
4. **Research** (in the hub) unlocks new buildings.
5. Expand carefully: **bug territories** dot the map, and their bugs attack if provoked.
6. Research the **Shipyard**, build the escape ship and launch it to win.

## Map

- A **256×256** tile grid, generated procedurally from a seed (the same seed gives the same map; D-038).
- **Ore fields** come from layered value noise: irregular patches of iron (about 5% of the map),
  copper and stone (about 3.5% each). A starter patch of each ore is placed 10–15 tiles from the hub,
  and the ground right around the hub is kept clear.
- Resource tiles never run out.
- The **5×5 hub** sits in the centre.
- **Bug territories:** the map is divided into 10×10 cells. About 18% of the cells whose nearest tile is
  at least 30 tiles from the hub's centre hold a nest (roughly 100 per map). See [Bugs](#bugs).
- Hub stock is shown just above the hub, as part of the map: it scrolls away with the hub. While the
  mouse is over it (or a finger is down on it), it fades almost completely, so it never hides the map above the hub.

## Items and recipes

| Item | Made in | From | Time |
|---|---|---|---|
| Iron ore, copper ore, stone | Extractor | ore under it | 1.5 s |
| Iron plate | Furnace | 1 iron ore | 1.6 s |
| Copper ingot | Furnace | 1 copper ore | 1.6 s |
| Brick | Furnace | 2 stone | 2 s |
| Gear | Workshop | 2 iron plates | 2 s |
| Copper wire ×2 | Workshop | 1 copper ingot | 1.5 s |
| Motor | Assembler | 1 gear + 2 wire + 1 iron plate | 4 s |

A machine picks its recipe from the first input it receives, or the player
picks one in its info panel. Changing the recipe discards inputs it has already received.

## Buildings

| Building | Size | Cost | HP | Unlocked by |
|---|---|---|---|---|
| Belt | 1×1 | 1 iron plate | 30 | start |
| Extractor | 2×2 | 6 iron plates | 80 | start |
| Furnace | 2×2 | 4 bricks, 2 iron plates | 120 | start |
| Turret | 1×1 | 10 iron plates, 2 copper ingots | 150 | Basic Defense |
| Wall | 1×1 | 3 bricks | 400 | Masonry |
| Workshop | 3×2 | 8 iron plates, 4 copper ingots | 120 | Workshops |
| Hub Port | 1×1 | 10 iron plates, 5 copper ingots | 120 | Distribution |
| Splitter | 1×1 | 3 iron plates, 1 copper ingot | 40 | Logistics |
| Underground Belt | 1×1 | 4 iron plates, 1 brick | 40 | Underground Transport |
| Assembler | 4×2 | 10 gears, 10 wire | 150 | Assembly |
| Repair Station | 1×1 | 12 iron plates, 4 gears, 6 wire | 150 | Field Repair |
| Cannon | 1×1 | 15 iron plates, 5 gears, 2 motors | 220 | Heavy Ordnance |
| Shipyard | 3×3 | 40 bricks, 40 iron plates | 900 | Shipyard |

- Sizes are width × depth when facing east (the first number runs along the direction the building
  faces). Turning a building sideways swaps them, and a placed building only turns if its new footprint is free.
- Bigger buildings centre on the tile you pick.
- Building costs are paid from hub stock. Demolishing a building refunds its
  cost, scaled by the HP it has left.
- **Hub:** 5×5, 1,000 HP. Accepts any item from any side. **Select it to open Research.**
  It has a **built-in gun**: 9 damage, 1.2 shots/s, range 8 from its centre, and no ammo needed.

## Logistics rules

- **Belts** move 1.5 tiles/s and hold about 3 items per tile. A belt accepts items from
  any side except the tile it points into.
- **Machines and extractors** output from the **middle of the side their arrow marks** (for an even
  width, the tile left of centre as seen facing out). A small port with an arrow shows the spot.
  Machines accept input on any tile of any side, and buffer up to 3 crafts' worth of each input.
- **Extractors** need ore under at least one tile of their base, and mine whichever ore covers most of it.
- **Splitters** accept only from directly behind. They send items out the front, left and
  right in turn, skipping any blocked side.
- **Underground belts** pair an entrance with the next tunnel placed up to 5
  tiles ahead in the same direction. Exits accept no input. Items in transit
  are lost if either end is removed.
- **Hub ports** must touch the hub, and always face away from it. Each port
  takes a chosen item out of hub stock, one every 0.5 s, and puts it on a belt.
  A docking collar joins it to the hub, with items visibly streaming out while it sends.
- **Building onto belts (D-037):** any building except a belt can be placed onto a belt line with a
  single click or tap (not a drag). Its footprint may cover belts (and empty ground); those belts are
  refunded, the building faces the way the belt under the tap ran, and it takes any items they carried.
  Because bigger buildings centre on the tapped tile, a dropped-in machine's input and output line up
  with the belt row, so it starts working at once.

## Research

You start with the belt, extractor and furnace. Everything else is researched. **Select the hub** and
press **Research** to open the list.

- **Start** a research, and it draws its items from hub stock at a steady pace over its research
  time. For example, Basic Defense takes 20 iron plates over 30 s.
- If the hub runs out of an item it needs, the research **stalls** until more arrives.
- Only one research is active at a time. **Switching** keeps what's already been put in, and
  **Pause** stops drawing. The hub's panel shows the active research and its progress.

| Research | Items | Time | Needs | Unlocks |
|---|---|---|---|---|
| Basic Defense | 20 iron plates | 30 s | — | Turret |
| Masonry | 12 bricks | 30 s | — | Wall |
| Workshops | 30 iron plates, 10 copper | 60 s | — | Workshop |
| Distribution | 25 iron plates, 10 copper | 60 s | Basic Defense | Hub Port |
| Logistics | 20 iron plates, 10 gears | 75 s | Workshops | Splitter |
| Underground Transport | 20 gears, 10 bricks | 90 s | Logistics | Underground Belt |
| Assembly | 30 gears, 30 wire | 120 s | Workshops | Assembler |
| Field Repair | 20 gears, 20 wire | 90 s | Workshops, Masonry | Repair Station |
| Shipyard | 60 iron plates, 30 gears, 30 wire, 5 motors | 150 s | Assembly | Shipyard |
| Heavy Ordnance | 10 motors, 30 gears | 150 s | Assembly, Basic Defense | Cannon |

Starting stock: 100 iron plates, 24 bricks, 16 copper ingots.

## Bugs

There are no waves (D-038). Bugs are distant threats that only attack when provoked.
Numbers live in `NESTS` in `src/sim/data.ts`; the rules are in `src/sim/nests.ts`.

- Each **nest** owns one 10×10 cell, marked by a dirt mound. Its bugs stroll and rest inside that
  cell and never leave it while calm.
- A nest is **provoked** when:
  - anything is built inside its cell or within 2 tiles of it,
  - any building is within 3 tiles of one of its bugs, or
  - one of its bugs is shot (by a turret, a cannon or the hub gun).
- A provoked nest's bugs go for the **nearest buildings**, following a path field from every building
  outwards. Belts, splitters and tunnels can be walked over; other buildings block, and bugs chew
  through whatever they reach. They chase no further than **22 tiles** from their territory's centre.
- A nest **calms down** 30 s after the last provocation (biting a building counts as one), and its bugs
  walk home.
- Territories show a red dashed outline while you're placing a building, and a pulsing one while
  they're angry.
- Killed bugs don't come back: a nest with no bugs left is cleared, and its mound goes flat.
- Nests further from the hub are bigger and tougher:

  | Bugs in a nest *d* tiles from the hub | Count |
  |---|---|
  | Crawlers | 3, plus 1 per 45 tiles of *d* |
  | Runners | none within 60 tiles; then 1, plus 1 per 40 tiles beyond 60 |
  | Brutes | none within 100 tiles; then 1, plus 1 per 50 tiles beyond 100 |
  | Bug HP | +1% per 1.5 tiles of *d* (double at 150 tiles) |

| Bug | HP | Speed (tiles/s) | Damage to buildings |
|---|---|---|---|
| Crawler | 18 | 1.1 | 8/s |
| Runner | 10 | 2.2 | 5/s |
| Brute | 110 | 0.55 | 30/s |

### Turrets

Turrets hold ammo as shots, and arrive fully loaded. You refill them with items:

| Turret | Ammo | Shots per item | Max shots | Range | Fire rate | Damage |
|---|---|---|---|---|---|---|
| Turret | iron plate | 4 | 40 | 5 | 3/s | 5 |
| Cannon | gear | 3 | 24 | 6.5 | 0.7/s | 30, splash radius 1.3 |

Turrets fire at any bug in range, calm or not, so a turret near a territory provokes it.
There are three ways to get ammo to a turret:

1. **From production:** branch a line with a splitter. Best for steady supply.
2. **From the hub:** a hub port sends stock back out onto a belt (D-006).
3. **Touching the hub:** a turret or cannon placed against the hub's side reloads straight from
   hub stock, one item at a time as it has room (D-036).

**Repair stations** heal the most damaged building within 3.5 tiles, at 20 HP/s.
They are fuelled by iron plates (1 plate = 40 HP, holding up to 400 HP), and arrive half full.

## The escape ship

The win condition (D-019, D-034). Numbers live in `SHIP` in `src/sim/data.ts`; the rules are in `src/sim/ship.ts`.

- The **Shipyard** research unlocks the **Shipyard**: 3×3, 900 HP, 40 bricks and 40 iron plates. Only one
  can exist.
- The ship is built in four **stages**, in order. Belt each stage's items into the shipyard; it accepts
  only what the current stage still needs, so nothing is wasted.

  | Stage | Items |
  |---|---|
  | Hull | 150 iron plates, 80 bricks |
  | Engine | 30 motors, 80 gears |
  | Life support | 120 wire, 60 copper ingots |
  | Navigation | 20 motors, 80 wire, 40 gears |

- A message pops up as each stage is finished. Selecting the shipyard shows the stages and what the
  current one still needs. The ship appears on the pad stage by stage.
- **Launch** (a button on the selected shipyard, once the ship is finished) starts a **90 s countdown**.
  The engines wake **every nest within 48 tiles** of the shipyard, and they stay angry for the whole
  countdown. A banner above the toolbar counts down.
- If the shipyard is still standing at lift-off, **you escape**: the run is won. The game stops, and a
  victory screen shows the run's numbers. The "Groove" track plays.
- If the shipyard is destroyed, any launch fails. **Standard** keeps the stages built, and a new shipyard
  carries on. **Hardcore** loses the ship. Demolishing the shipyard yourself always keeps the ship.
- **Keep playing (endless):** from the victory screen. The shipyard is removed and the run carries on.
  You can't build a second shipyard. A save that has escaped shows "escaped!" or "Endless" on the main menu.
- *How the ship fits the game is due to change (owner's note, D-038).*

## Modes

| | Standard (default) | Hardcore |
|---|---|---|
| Hub reaches 0 HP | **Breach:** every nest calms down and its bugs go home, 25% of every item in stock is lost, and the hub is restored to 50% HP | Run over |
| Availability | Always | Unlocked by escaping once in Standard |

The hardcore unlock is stored in the browser's profile, separate from the save file.

## Onboarding

- The game opens on a **main menu**, with a small factory (and a calm bug territory) running behind it.
  It offers **Continue** (when a save exists, showing its mode and time played),
  **New game** (choose the mode) and **How to play**.

- **Tutorial lessons** (five) start by themselves the first time each one is useful:

  | Lesson | Starts when | Steps |
  |---|---|---|
  | Essentials | A game has no extractors or belts yet | The hub → pick the extractor → place it over iron ore → lay 3 belts → build a furnace → deliver a plate → hub stock → Research is in the hub |
  | Bugs | A nest is provoked for the first time, or you build within 16 tiles of a nest's centre | The territory → research Basic Defense from the hub |
  | Splitters and tunnels | The splitter is unlocked | What splitters do |
  | The escape ship | The shipyard is researched | Pick the shipyard → place it → stages → launch |
  | Breaches | The hub is breached for the first time | What a breach costs |

- **Action steps** (marked by a pulsing spotlight and a "Skip step" button) wait for you to act. The game keeps running and the dim overlay lets clicks through.
- **Explanation steps** pause the game until you press Next.
- A lesson waits while a window (research, menu…) is open, so it never covers what the player is reading.
- The **New game** dialog has "Start with the Essentials tutorial", ticked until the player has seen it once. Ticking it shows Essentials even if lessons are switched off; unticking it skips them.
- Every lesson card has ✕ (close) and **Hide tips** (switches lessons off).
- Lessons play once. Menu → Tutorials lists them, replays any of them, and switches automatic lessons on or off.

## Screen

- The **top bar** holds only the speed buttons and the menu.
- The **toolbar** at the bottom lists the unlocked buildings with their costs, plus Rotate and Demolish.
- The **info panel** opens only for a building that's already placed (select it). Picking a tool from the
  toolbar shows no panel.
- Hub stock floats above the hub (see [Map](#map)).

## Controls

| | Desktop | Touch |
|---|---|---|
| Build | Left click (builds at once) | Tap, then ✓ (or tap the same spot again) |
| Select | Click a building | Tap a building |
| Lay belts or walls | Drag out a line, then ✓ or Enter | Drag out a line, then ✓ |
| Pan | Right or middle drag, WASD | Drag with no tool, or two fingers |
| Zoom | Mouse wheel (with no building selected), or Ctrl+wheel | Pinch |
| Rotate | Mouse wheel while placing, or R | Rotate button |
| Demolish | X | Demolish button |
| Pick a building | 1–9 | Toolbar |
| Pause | Space | ❚❚ button |
| Put down the tool or clear the selection | Right-click or Esc | Tap the tool again |
| Close a menu | Click outside it | Tap outside it |
| Blueprint: rotate, reverse, cancel | ⟳, R or the wheel (reverses a belt line); ✕, Esc or right-click | ⟳ or Rotate; ✕ |

- **With a tool in hand, pressing on an existing building of a different kind selects that building**
  and puts the tool down. Two exceptions keep building: pressing a belt with another building drops the
  building onto the belt line, and a belt drag may start on an existing belt.
- **Soft placement (D-030).** Building can show a **blueprint** first: dashed ghosts, red where a
  tile can't be built (blocked, or past what your stock can pay for), and a bar with ✕, ⟳ and ✓
  beside its end. Dragging back along a blueprint shortens it, and tiles that already hold a building
  are skipped. On touch screens every placement is a blueprint; Menu → "Confirm before building on
  touch screens" switches it off. On desktop, single clicks build at once, and only a dragged-out belt
  or wall line becomes a blueprint. Bigger buildings are placed one at a time, never dragged.

## Music

- Main menu: the corporate track, looping. In game: seven lo-fi tracks in a shuffled
  order. Tracks crossfade over 4 s (1.5 s when switching between menu and game). The "Groove" track
  plays on the escape (win) screen.
- Nothing plays until the first click or tap (browsers require it). Music pauses while the page is hidden.
- Menu → Music sets the volume (saved per device). Zero mutes it. Sound effects have their own slider ([Sound effects](#sound-effects)).
- The game ships 128 kbps copies in `public/music/`. The originals and their Pixabay licences are in
  `audio/source/`. The single-file build has no music.

## Sound effects

- Synthesized in the browser with Web Audio (D-043), so there are no sound files and the single-file build has them too. The recipes are in `src/audio/sfx.ts`; `src/audio/sounds.ts` decides when they play.
- Sounds: button clicks, placing a belt, placing a building (deeper for big ones), demolishing, a
  blocked placement, turret and cannon shots, the hub gun, bugs dying, a building destroyed, the hub
  being hit, a breach, research finished, a ship stage finished, the launch rumble, and an angry
  chitter when a nest is provoked.
- Sounds on screen play at full volume, and fade to silence a little beyond its edges, panned left or
  right by where they happen. A provoked nest is a warning, so it's always heard, quietly if far away.
- Busy fights are kept tidy: each sound has a shortest gap between plays, and at most 24 play at once.
- Nothing plays on the main menu except button clicks. Menu → Sound effects sets the volume (saved per
  device, default 60%); zero mutes it.

## Saves

- Autosaved to the browser's local storage every 20 s and when the page is hidden.
- Save files are versioned (currently **v8**). v8 is a new kind of map (bigger, bug territories,
  bigger buildings), so **older saves can't be converted**: the main menu explains this, clears the old
  save and offers a new game (D-038). Later versions will migrate again, with tests.
