# Art upgrade: reference art

The art upgrade (0.40.0, D-075) was drawn on a design canvas:
https://claude.ai/artifact/Hhr8YoisBKsdzxi641m4Ht

Most of it is in the game now, under `src/art/`. The files in this folder are drawn but not wired in
yet, because the loader reads one image per sprite and these need more code first.

## In the game

- Every building, bug, item, resource node and terrain sprite in `src/art/`.
- Wall and palisade sets (9 pieces each), picked from neighbours in `src/render/runs.ts`.
- Nest burrows (`src/art/nests/`): warren, hive and den by brood, a Hardcore look, angry and damaged
  overlays, and a destroyed hole. The blight around nests is drawn in code.
- Damage overlays (`effects/damage_1`, `damage_2`) and the damaged hub (`buildings/hub_damaged`).

## Reference only

| Folder | What | Needs |
|---|---|---|
| `strips/` | 4-frame strips: walks and attacks for each bug; walk, work, idle and knocked out for the engineer | The loader to cut frame strips |
| `effects/` | Muzzle flash, shell, explosion, hit spark, repair sparkle, debris, death splat, leaf burst; a tesla bolt as a guide for the code | Frame strips, and the effects code to draw sprites |
| `pieces/` | Belt corner, belt end and flange | The belt renderer to use sprites |
| `seasons/` | Ground and tree variants for spring, fall and winter | Season-aware sprite keys |
| `../../src/art/nests/queen.svg` | Queen nest (3×3) | Queen nests in the rules (D-065, Phase 4) |
