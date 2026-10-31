# Nest growth concepts

Three art directions for nests whose art changes at each stage instead of only scaling (proposal, not
chosen yet). The game doesn't load anything here.

- `generate.mjs` draws the concept sprites into `svg/` (`<direction>_<kind>_<stage>.svg`, `<direction>_queen.svg`).
- `page.mjs` builds `concepts.html`, the comparison page with a game-scale preview.

```bash
node docs/nest-concepts/generate.mjs && node docs/nest-concepts/page.mjs
```
