# Foundry Front (working title)

A factory-automation game inspired by Builderment, with a tower-defense twist:
waves of enemies attack your base, and your turrets only fire what your
conveyor belts deliver to them.

It runs in the browser on desktop and mobile. Art is placeholder for now.

## Play

- **Locally:** `npm install`, then `npm run dev` and open the printed URL.
- **Online:** every push to `main` deploys to GitHub Pages (see below).

### How to play

1. Put **extractors** on resource nodes (iron, copper, stone).
2. Lay **belts** (drag to draw a line) into **furnaces** and **workshops**, then on to the **hub**.
3. Building costs come out of the hub's stock, so keep it supplied.
4. Deliver the goal items to the hub to unlock the next **tier**.
5. Enemies arrive in waves (the first one comes after 3 minutes, with red markers 30 seconds before each wave). **Turrets** fire iron plates and **cannons** fire gears. New turrets come loaded, but you need belts to refill them.
6. If the hub is destroyed, the game is over.

| | Desktop | Touch |
|---|---|---|
| Build / select | Left click | Tap |
| Lay belts | Drag with Belt tool | Drag with Belt tool |
| Pan | Right/middle drag, WASD | Drag (no tool), two fingers |
| Zoom | Mouse wheel | Pinch |
| Rotate | R | Rotate button |
| Demolish | X | Demolish button |
| Pick building | 1–8 | Toolbar |
| Pause | Space | ❚❚ button |

Progress autosaves to the browser's local storage.

## Development

```bash
npm install
npm run dev          # dev server with hot reload
npm test             # simulation unit tests (Vitest)
npm run typecheck
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

### Layout

```
src/
  sim/       game rules, with no DOM: data.ts (balance/content), world.ts (simulation)
  render/    Canvas 2D renderer and camera (swappable for 3D later)
  input/     mouse, touch and keyboard
  ui/        HTML overlay (HUD, toolbar, dialogs)
  main.ts    wiring, the fixed-timestep loop, save/load
```

The simulation runs at a fixed 20 ticks per second and is deterministic per
map seed. It knows nothing about rendering, so a 3D front end can reuse it as is.

### Deploying to GitHub Pages

`.github/workflows/deploy.yml` tests and builds every push and PR, and
deploys `main` to Pages. To turn deployment on, go to
**Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

See [DESIGN.md](DESIGN.md) for the design and roadmap.

The earlier Godot project, *Fairy Tale Palace Adventure*, is still in the git history.
