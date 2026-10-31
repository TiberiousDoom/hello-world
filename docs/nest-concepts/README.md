# Nest growth concepts

How the nests' look was chosen (D-152). Round 1 compared three directions (Earthworks, Brood and Spires);
the owner picked Earthworks. Round 2 added a nest kind for every bug (runnels for runners and barrows for
beetles), a queen nest of each kind and a queen of each bug. Round 3 redrew the queens from scratch, without
crowns. That is what the game now uses.

The sprites are drawn by `art/nests.mjs` and `art/queens.mjs` straight into `src/art/`. `page.mjs` builds
`concepts.html`, the comparison page with a game-scale preview, from them and from the nests as they were before.

```bash
node art/nests.mjs && node docs/nest-concepts/page.mjs
```
