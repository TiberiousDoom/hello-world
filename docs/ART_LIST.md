# Art list

Everything the game draws, plus what's needed for launch.

## How art gets into the game

Sprites live in **`src/art/<category>/<name>`** and are loaded automatically.
Every P1 and P2 asset already has a **placeholder SVG** there. To replace one,
add a **PNG with the same name** next to it (for example `src/art/items/gear.png`
beside `gear.svg`). The PNG wins and no code changes are needed. Delete the SVG once you're happy.

Status values: **Placeholder** = an SVG stand-in exists, **Code** = drawn by the
renderer for now (a sprite can replace it later), **Needed** = not in the game
yet, **Final** = your art is in.

![All placeholder art](art-placeholders.png)

Open `src/art/*/*.svg` in a browser or vector editor to see the placeholders up close.
They show the intended size, facing and silhouette.

## Specs (for every asset unless noted)

| | |
|---|---|
| **View** | Top-down (straight down). A slight ¾ tilt is fine if it's consistent |
| **Grid** | 1 tile = **64×64 px** at 1×. Please also export **128×128 (@2x)** for phones |
| **Format** | PNG with transparency. Keep layered source files (PSD, Aseprite, Krita…) |
| **Facing** | Directional sprites face **east (right)**; the game rotates them. If the lighting looks wrong rotated, provide all four directions as `_e`, `_s`, `_w`, `_n` |
| **Animation** | A horizontal strip of equal-size frames, with the frame count in the name, e.g. `belt_8f.png`. The loader doesn't read strips yet, so a single frame is the most useful first delivery. The game animates belts, glows and bobbing in code for now. **Exception, enemy walk cycles:** two separate files, `crawler.png` and `crawler_b.png`; the game swaps them as the bug walks |
| **Art direction** | A whimsical forest clearing (D-028): grassy ground, flowers and mushrooms, trees around the edge, fireflies and drifting leaves. The Company's machines stay navy, steel and hazard-yellow, so they stand out from the greenery |
| **Padding** | Building art should leave about 4 px clear at each tile edge, so neighbours read as separate |
| **Naming** | Match the placeholder: `src/art/category/name.png`, e.g. `src/art/items/iron_plate.png` |
| **Palette** | Item colours must stay distinct for colour-blind players. Give each item a distinct **shape** as well |

Priority: **P1** = needed to replace the placeholders in the core loop,
**P2** = the rest of the current game, **P3** = polish and launch.

## Terrain

| Asset | Size | Frames | Priority | Status |
|---|---|---|---|---|
| Ground tile: grass, seamless, with a faint tile edge (3–4 variants so it doesn't look tiled) | 64×64 | 1 | P1 | Placeholder (`terrain/ground`) |
| Map edge: soft shadow where the clearing meets the forest | — | 1 | P3 | Code |
| Iron ore node (2–3 variants), on a dirt patch with a transparent background | 64×64 | 1 | P1 | Placeholder |
| Copper ore node (2–3 variants) | 64×64 | 1 | P1 | Placeholder |
| Stone node (2–3 variants) | 64×64 | 1 | P1 | Placeholder |
| Decorations, transparent: grass tuft, flowers (2 colourways), mushrooms, pebbles. Scattered on empty tiles | 64×64 | 1 | P2 | Placeholder (`terrain/tuft`, `flowers`, `flowers_blue`, `mushrooms`, `pebbles`) |
| Trees, top-down canopies with a soft shadow: round, autumn, pine, berry bush. They fill a band around the map | 128×128 (2 tiles) | 1 | P2 | Placeholder (`terrain/tree_round`, `tree_autumn`, `tree_pine`, `bush`) |
| Fireflies and drifting leaves | — | — | P3 | Code |

## Items

Drawn small on belts (about 20 px on screen) and larger in menus, so they need simple, bold silhouettes.

| Asset | Size | Priority | Status |
|---|---|---|---|
| Iron ore | 32×32 (+64×64 for UI) | P1 | Placeholder |
| Copper ore | 32×32 (+64×64) | P1 | Placeholder |
| Stone | 32×32 (+64×64) | P1 | Placeholder |
| Iron plate | 32×32 (+64×64) | P1 | Placeholder |
| Copper ingot | 32×32 (+64×64) | P1 | Placeholder |
| Brick | 32×32 (+64×64) | P1 | Placeholder |
| Gear | 32×32 (+64×64) | P1 | Placeholder |
| Copper wire | 32×32 (+64×64) | P1 | Placeholder |
| Motor | 32×32 (+64×64) | P1 | Placeholder |

## Buildings

| Asset | Tiles | Notes | Frames | Priority | Status |
|---|---|---|---|---|---|
| Hub | 3×3 (192×192) | Centrepiece. A damaged variant is a nice extra | 1 (+idle loop) | P1 | Placeholder |
| Belt (straight) | 1×1 | Moving surface; must tile seamlessly end to end | 8 | P1 | Placeholder |
| Belt (corner) | 1×1 | Drawn in code (quarter turn, matching the straight sprite's rails). A sprite could replace it | 8 | P3 | Code |
| Belt end cap, join flange | 1×1 | Drawn in code: a hazard bumper where a line stops, a metal flange where a belt meets a building | 1 | P3 | Code |
| Extractor | 1×1 | Drill; the output side should be obvious | 4–8 working | P1 | Placeholder |
| Furnace | 1×1 | Idle and working (glow) | 1 + 4 | P1 | Placeholder |
| Workshop | 1×1 | Idle and working | 1 + 4 | P2 | Placeholder |
| Assembler | 1×1 | Idle and working | 1 + 4 | P2 | Placeholder |
| Splitter | 1×1 | Should read as "one in, three out" | 1 | P2 | Placeholder |
| Underground belt entrance | 1×1 | Mouth on the east side | 1 | P2 | Placeholder |
| Underground belt exit | 1×1 | Mouth on the west side | 1 | P2 | Placeholder |
| Hub port | 1×1 | Should look like part of the hub, with output to the east | 1 | P2 | Placeholder |
| Turret base | 1×1 | Static | 1 | P1 | Placeholder |
| Turret barrel | 1×1 | Separate layer that rotates to aim; centred pivot | 1 | P1 | Placeholder |
| Cannon base | 1×1 | | 1 | P2 | Placeholder |
| Cannon barrel | 1×1 | Separate layer, as for the turret | 1 | P2 | Placeholder |
| Repair station | 1×1 | | 1 + 4 working | P2 | Placeholder |
| Stash | 1×1 | Contraband. Hidden crate under a tarp | 1 | P2 | Placeholder |
| Skimmer | 1×1 | Contraband belt piece with a side chute to the right | 1 | P2 | Placeholder |
| Wall | 1×1 | Single block for now. Later a 16-piece set that joins up with neighbours | 1 | P2 | Placeholder |
| Construction / ghost overlay | 1×1 | Optional: the game can tint sprites instead | 1 | P3 | Optional |

## Enemies

All top-down and facing east. Each has two walk frames (`name` and `name_b`, legs in opposite
tripod poses); the game swaps them as the bug moves, so a bug standing still to attack stops walking.

| Asset | Size on screen | Frames | Priority | Status |
|---|---|---|---|---|
| Crawler: red jewel beetle | ~28 px (fits a 32×32 frame) | 2 walk (+4 attack later) | P1 | Placeholder (`crawler`, `crawler_b`) |
| Runner: slender orange ant-wasp, long legs | ~22 px (32×32) | 2 walk (+4 attack later) | P2 | Placeholder (`runner`, `runner_b`) |
| Brute: armoured rhino beetle with a horn | ~46 px (64×64) | 2 walk (+4 attack later) | P2 | Placeholder (`brute`, `brute_b`) |
| Death puff or splat (shared) | 64×64 | 4–6 | P2 | Code |

## Effects

| Asset | Size | Frames | Priority | Status |
|---|---|---|---|---|
| Muzzle flash | 32×32 | 2–3 | P3 | Code |
| Cannon shell | 16×16 | 1 | P3 | Needed |
| Explosion (cannon splash) | 128×128 | 6 | P3 | Code |
| Hit spark | 32×32 | 3 | P3 | Needed |
| Repair sparkle | 32×32 | 4 | P3 | Needed |
| Building destroyed (debris) | 64×64 | 5 | P3 | Needed |
| Spawn warning marker | 128×128 | 4 (pulse) | P2 | Code |
| Audit drone | 64×64 | 2–4 (rotors) | P2 | Placeholder (`buildings/drone`) |
| Hub breach (shockwave) | 256×256 | 6 | P3 | Code |

## UI

The menus use a flat, two-colour style: navy `#1d3b6e` and sky blue `#3fa9f5`
on white, with bold, rounded silhouettes. Icons are drawn white with one
sky-blue accent shape, on a 24×24 grid. If an icon uses the colour names
`var(--icon-accent, #3fa9f5)` and `var(--icon-ink, #1d3b6e)`, the game can recolour it on highlighted buttons.

| Asset | Size | Priority | Status |
|---|---|---|---|
| App icon master | 1024×1024 (no transparency, for the stores) | P3 | Needed (after naming). Can start from `ui/logo.svg` |
| Favicon / PWA icons | 512×512 and 192×192 | P3 | Placeholder |
| Logo / wordmark | Vector (SVG) | P3 | Placeholder mark `ui/logo.svg`; the wordmark is text for now |
| UI icons (`src/art/ui/`): health, wave, research, pause, play, fast, menu, rotate, demolish, close, save, help, home, new, lock, skull, factory, mail, contract, coin, store, eye | 24×24 grid, SVG preferred | P3 | Placeholder |
| Research icons (one per research, 9 today) | 64×64 | P3 | Optional |
| Toolbar building icons | Uses the building sprites; no extra art needed | — | — |

## Audio (not art, but listed so it isn't forgotten)

Sound effects for: building placed, demolished, machine working (loop),
turret shot, cannon shot, explosion, enemy death, hub hit, breach, research
complete, wave incoming, UI click.

**Music: done.** Nine tracks by velariomusic on Pixabay (licences in `audio/source/`): seven lo-fi
tracks for play, a corporate theme for the main menu, and "Groove" for the win screen. See
[GAME_DESIGN.md](GAME_DESIGN.md#music).

## Not needed

- Separate toolbar icons (the building sprites are reused)
- Fonts (the system UI font is fine for now)
