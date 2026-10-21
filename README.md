# Foundry Front (working title)

A factory-automation game inspired by Builderment, with a tower-defense twist:
bug nests dot a large, generated map and attack when provoked, and your turrets only fire what your
conveyor belts deliver to them.

It runs in the browser on desktop and mobile. The art is detailed placeholder
art; final sprites drop into `src/art/` (see [docs/ART_LIST.md](docs/ART_LIST.md)).

## Play

- **Locally:** `npm install`, then `npm run dev` and open the printed URL.
- **Online:** every push to `master` deploys to GitHub Pages (see below).

### How to play

A tutorial runs the first time you play, and you can replay it from the menu.
In short: mine with **extractors**, move items with **belts**, smelt in
**furnaces**, deliver to the **hub**, spend hub stock on **research** and
buildings, expand carefully around **bug territories** and feed **turrets** to hold them off, then build an escape ship. The full rules and
controls are in [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

Progress autosaves to the browser's local storage.

## Development

```bash
npm install
npm run dev          # dev server with hot reload
npm test             # simulation unit tests (Vitest)
npm run test:e2e     # browser tests on desktop and phone viewports (Playwright)
npm run typecheck
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

### Layout

```
src/
  art/       sprites and icons (SVG placeholders; a same-named PNG replaces one)
  sim/       game rules, with no DOM: data.ts (balance/content), world.ts (simulation), demo.ts (menu factory)
  render/    Canvas 2D renderer and camera (swappable for 3D later)
  input/     mouse, touch and keyboard
  ui/        HTML overlay (HUD, toolbar, dialogs, tutorial, blueprint bar)
  audio/     music player (crossfades between tracks)
  main.ts    wiring, the fixed-timestep loop, save/load
e2e/           browser tests (Playwright), run in CI
public/music/  the music the game plays (128 kbps copies)
audio/source/  the original tracks and their licences
```

The simulation runs at a fixed 20 ticks per second and is deterministic per
map seed. It knows nothing about rendering, so a 3D front end can reuse it as is.

### Deploying to GitHub Pages

`.github/workflows/deploy.yml` tests and builds every push and PR, and
deploys `master` to Pages. To turn deployment on, go to
**Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

## Docs

Project docs are in [`docs/`](docs/README.md): vision, game design, roadmap,
decisions, the art list and [credits](docs/CREDITS.md). The [changelog](CHANGELOG.md) records each release.

The earlier Godot project, *Fairy Tale Palace Adventure*, is still in the git history.
