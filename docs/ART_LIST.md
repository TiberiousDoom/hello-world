# Art list

Everything the game draws today, as placeholders, plus what's needed for
launch. Mark an asset **Delivered** when its file is in `public/art/` (the
loader is a planned roadmap item; until it exists, send the files and I'll wire them in).

## Specs (for every asset unless noted)

| | |
|---|---|
| **View** | Top-down (straight down). A slight ¾ tilt is fine if it's consistent |
| **Grid** | 1 tile = **64×64 px** at 1×. Please also export **128×128 (@2x)** for phones |
| **Format** | PNG with transparency. Keep layered source files (PSD, Aseprite, Krita…) |
| **Facing** | Directional sprites face **east (right)**; the game rotates them. If the lighting looks wrong rotated, provide all four directions as `_e`, `_s`, `_w`, `_n` |
| **Animation** | A horizontal strip of equal-size frames, with the frame count in the name, e.g. `belt_8f.png` |
| **Padding** | Building art should leave about 4 px clear at each tile edge, so neighbours read as separate |
| **Naming** | `category/name.png`, all lower case with underscores, e.g. `items/iron_plate.png` |
| **Palette** | Item colours must stay distinct for colour-blind players. Give each item a distinct **shape** as well |

Priority: **P1** = needed to replace the placeholders in the core loop,
**P2** = the rest of the current game, **P3** = polish and launch.

## Terrain

| Asset | Size | Frames | Priority | Status |
|---|---|---|---|---|
| Ground tile (3–4 variants so it doesn't look tiled) | 64×64 | 1 | P1 | Needed |
| Map edge or boundary | 64×64 | 1 | P3 | Needed |
| Iron ore node (2–3 variants) | 64×64 | 1 | P1 | Needed |
| Copper ore node (2–3 variants) | 64×64 | 1 | P1 | Needed |
| Stone node (2–3 variants) | 64×64 | 1 | P1 | Needed |

## Items

Drawn small on belts (about 20 px on screen) and larger in menus, so they need simple, bold silhouettes.

| Asset | Size | Priority | Status |
|---|---|---|---|
| Iron ore | 32×32 (+64×64 for UI) | P1 | Needed |
| Copper ore | 32×32 (+64×64) | P1 | Needed |
| Stone | 32×32 (+64×64) | P1 | Needed |
| Iron plate | 32×32 (+64×64) | P1 | Needed |
| Copper ingot | 32×32 (+64×64) | P1 | Needed |
| Brick | 32×32 (+64×64) | P1 | Needed |
| Gear | 32×32 (+64×64) | P1 | Needed |
| Copper wire | 32×32 (+64×64) | P1 | Needed |
| Motor | 32×32 (+64×64) | P1 | Needed |

## Buildings

| Asset | Tiles | Notes | Frames | Priority | Status |
|---|---|---|---|---|---|
| Hub | 3×3 (192×192) | Centrepiece. A damaged variant is a nice extra | 1 (+idle loop) | P1 | Needed |
| Belt (straight) | 1×1 | Moving surface; must tile seamlessly end to end | 8 | P1 | Needed |
| Belt (corner) | 1×1 | Not drawn yet; would make turns look right | 8 | P3 | Needed |
| Extractor | 1×1 | Drill; the output side should be obvious | 4–8 working | P1 | Needed |
| Furnace | 1×1 | Idle and working (glow) | 1 + 4 | P1 | Needed |
| Workshop | 1×1 | Idle and working | 1 + 4 | P2 | Needed |
| Assembler | 1×1 | Idle and working | 1 + 4 | P2 | Needed |
| Splitter | 1×1 | Should read as "one in, three out" | 1 | P2 | Needed |
| Underground belt entrance | 1×1 | Mouth on the east side | 1 | P2 | Needed |
| Underground belt exit | 1×1 | Mouth on the west side | 1 | P2 | Needed |
| Hub port | 1×1 | Should look like part of the hub, with output to the east | 1 | P2 | Needed |
| Turret base | 1×1 | Static | 1 | P1 | Needed |
| Turret barrel | 1×1 | Separate layer that rotates to aim; centred pivot | 1 | P1 | Needed |
| Cannon base | 1×1 | | 1 | P2 | Needed |
| Cannon barrel | 1×1 | Separate layer, as for the turret | 1 | P2 | Needed |
| Repair station | 1×1 | | 1 + 4 working | P2 | Needed |
| Wall | 1×1 | Single block for now. Later a 16-piece set that joins up with neighbours | 1 | P2 | Needed |
| Construction / ghost overlay | 1×1 | Optional: the game can tint sprites instead | 1 | P3 | Optional |

## Enemies

All top-down and facing east, as walk cycles.

| Asset | Size on screen | Frames | Priority | Status |
|---|---|---|---|---|
| Crawler | ~28 px (fits a 32×32 frame) | 4 walk + 4 attack | P1 | Needed |
| Runner | ~22 px (32×32) | 4 walk + 4 attack | P2 | Needed |
| Brute | ~46 px (64×64) | 4 walk + 4 attack | P2 | Needed |
| Death puff or splat (shared) | 64×64 | 4–6 | P2 | Needed |

## Effects

| Asset | Size | Frames | Priority | Status |
|---|---|---|---|---|
| Muzzle flash | 32×32 | 2–3 | P3 | Needed |
| Cannon shell | 16×16 | 1 | P3 | Needed |
| Explosion (cannon splash) | 128×128 | 6 | P3 | Needed |
| Hit spark | 32×32 | 3 | P3 | Needed |
| Repair sparkle | 32×32 | 4 | P3 | Needed |
| Building destroyed (debris) | 64×64 | 5 | P3 | Needed |
| Spawn warning marker | 128×128 | 4 (pulse) | P2 | Needed |
| Hub breach (shockwave) | 256×256 | 6 | P3 | Needed |

## UI

| Asset | Size | Priority | Status |
|---|---|---|---|
| App icon master | 1024×1024 (no transparency, for the stores) | P3 | Needed (after naming) |
| Favicon / PWA icons | 512×512 and 192×192 | P3 | Needed |
| Logo / wordmark | Vector (SVG) | P3 | Needed (after naming) |
| HUD icons: health, wave, research, pause, play, speed, menu, rotate, demolish, close | 48×48, single colour, SVG preferred | P3 | Needed |
| Research icons (one per research, 9 today) | 64×64 | P3 | Optional |
| Toolbar building icons | Uses the building sprites; no extra art needed | — | — |

## Audio (not art, but listed so it isn't forgotten)

Sound effects for: building placed, demolished, machine working (loop),
turret shot, cannon shot, explosion, enemy death, hub hit, breach, research
complete, wave incoming, UI click. Plus 1–2 music loops (calm build, wave).

## Not needed

- Separate toolbar icons (the building sprites are reused)
- Fonts (the system UI font is fine for now)
