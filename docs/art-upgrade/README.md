# Art upgrade: reference art

The art upgrade (0.40.0, D-075) was drawn on a design canvas:
https://claude.ai/artifact/Hhr8YoisBKsdzxi641m4Ht

Nearly all of it is in the game now, under `src/art/`: every sprite, the wall and palisade sets, nest burrows,
damage overlays, and since 0.43.0 (D-082) the animation strips (bugs and the engineer), the effects and the
seasonal ground and trees. Only these are still reference:

| File | What | Why it's not in the game |
|---|---|---|
| `pieces/belt_corner.svg`, `belt_end.svg`, `belt_flange.svg` | Belt corner, end cap and join flange | In the game since 0.73.0 as `src/art/buildings/belt_corner`, `belt_end` and `belt_flange`, with the chevrons drawn in code on top. The corner leaves out the slats, which move in code |
| `effects/tesla_bolt.svg` | A tesla bolt | A guide for the code, which draws a new jagged bolt every frame |
| `../../src/art/nests/queen.svg` | Queen nest (3×3) | Waits for queen nests in the rules (D-065, Phase 4) |
