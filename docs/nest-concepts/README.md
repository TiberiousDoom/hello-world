# Nest growth concepts

Concept art for nests whose art changes at each stage instead of only scaling. Round 1 compared three
directions; the owner picked Earthworks. Round 2 (here) has a nest kind for every bug (adding runnels
for runners and barrows for beetles), a queen nest of each kind and a queen of each bug. Not final:
the game doesn't load anything here.

- `generate.mjs` draws the sprites into `svg/`: `nest_<kind>_<stage>.svg`, `nest_<kind>_queen.svg` and `queen_<bug>.svg`.
- `page.mjs` builds `concepts.html`, the comparison page with a game-scale preview.

```bash
node docs/nest-concepts/generate.mjs && node docs/nest-concepts/page.mjs
```
