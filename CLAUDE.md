# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The project

**Foundry Front** (working title): a Builderment-inspired factory game with a tower-defense twist,
for the browser on desktop and phones. TypeScript, Vite 7, Canvas 2D, no framework.
`master` deploys to GitHub Pages (https://tiberiousdoom.github.io/hello-world/).

Start with [docs/README.md](docs/README.md); [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) describes the
game as it is on `master`.

## Commands

```bash
npm run dev          # dev server
npm test             # unit tests (Vitest, src/**/*.test.ts)
npm run typecheck    # tsc --noEmit (tests included: CI fails on type errors in tests too)
npm run lint         # ESLint and Prettier's check (npm run format rewrites the files)
npm run build        # typecheck + static site in dist/
npm run build:single # one self-contained HTML file in dist-single/ (no music, no public/)
npm run test:e2e     # Playwright, desktop and phone viewports; builds and serves on :4173
npx vitest run src/sim/ship.test.ts            # one unit test file (add -t "name" for one test)
npx playwright test e2e/lessons.spec.ts        # one browser suite
npx playwright test --project=desktop          # one project (desktop, phone; firefox and webkit run only the determinism test)
node audio/compose/render.mjs [track...]       # re-render the music (all generated in code) into public/music/
node art/working.mjs                           # rebuild the machines' working animations from their sprites
node art/nests.mjs                             # redraw the nests (every kind and stage), queen nests and queens
cd relay && npm ci && npm run dev              # the co-op relay locally on :8787 (`npm run check`: typecheck and bundle)
npm run server                                 # the dedicated server (build:server bundles it into dist-server/); see server/README.md
```

Locally, Playwright reuses a server already listening on :4173 (`reuseExistingServer`), so a
leftover `vite preview` serves a stale build. Stop it before running e2e after code changes.

Before every push, run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`
(`npm run format` fixes what Prettier complains about). `scripts/check.sh` runs them all in order, stopping a
stale preview first (`--twice` runs the browser tests twice, `--fast` skips them). The release loop, from a fresh
branch to a merged PR, is the `ship` skill (`.claude/skills/ship/`); looking after an open PR is `steward`.
CI (`.github/workflows/deploy.yml`) runs all of them on every PR, inside Playwright's container image; when
upgrading `@playwright/test`, change the image tag to the same version (a CI step checks). Browser tests can be flaky under
load, so run the full suite twice after touching input, the HUD or the tutorial.

## Code layout and rules

- `src/sim/`: the rules. **No DOM, no rendering, no audio**: it must stay reusable by a future 3D
  front end. Deterministic: fixed tick (`TICK` = 1/20 s) and a seeded RNG (`w.random()`); don't use
  `Math.random()` in the rules (only `World.create` uses it, to pick a seed when none is given).
  - `data.ts` holds all balance numbers and content. It is the source of truth; docs follow it.
  - `world.ts` (simulation), `mapgen.ts` (256×256 map, ore noise, nests), `nests.ts` (bug territories, nest kinds, queens), `player.ts` (the engineer: walking, carrying), `clock.ts` (day, night, seasons),
    `ship.ts` (escape ship), `research.ts`, `demo.ts` (the main-menu factory).
  - `commands.ts` and `session.ts`: every change a player makes is a `Command`, applied through the game's
    `Session` (its world, clock and command log). This is what co-op sends between games (D-056, D-058).
  - Co-op games must compute exactly the same numbers in every browser: use `hypot` from `math.ts`, never
    `Math.hypot`, and keep other `Math` functions whose last bit can vary (`sin`, `cos`, `exp`, `pow`, ...)
    out of the rules (map generation is the one exception: only the host runs it).
- `src/render/`: Canvas 2D renderer and camera. Visual effects come from diffing world state each frame.
- `src/audio/`: music (crossfading tracks), synthesized sound effects (`sfx.ts`) and `sounds.ts`, which
  turns each frame's world changes into sounds (like the renderer's effects).
- `src/ui/`: the HTML overlay (HUD, toolbar, dialogs, tutorial lessons, blueprint bar).
- `src/input/`: mouse, touch and keyboard.
- `src/net/`: co-op networking. Shared with the relay: its messages (`protocol.ts`) and room rules (`room.ts`).
  Game side: the room (`coop.ts`), lockstep (`lockstep.ts`: the host stamps ticks and sends turns), the
  connection (`client.ts`; `?relay=local` runs a room between tabs, as the browser test does) and `pack.ts`.
  `SERVER_ROOM` in `client.ts` is the dedicated server's room code, which Play together joins with one button
  (`?server=CODE` overrides it); the relay reports any room's status at `/rooms/<code>/status` (D-086).
- `server/`: the dedicated server (D-084): a co-op host run by Node, with no screen, reusing `src/net` and `src/sim`.
  `npm run typecheck` checks it too (`server/tsconfig.json`, Node types). Setup, systemd units and the update script are there.
- `relay/`: the co-op relay, a Cloudflare Worker with a Durable Object per room (D-077), its own `package.json`.
  CI deploys it from master using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
- `src/art/`: SVG placeholders; a same-named PNG overrides one. Sizes are in `TILES` in `art/index.ts`. Animations
  are strips of square frames named with their count (`_4f`), cut into frames by the loader (`frame(key, i)`, D-082).
- `main.ts`: wiring, the game loop, save/load and the player profile (localStorage).

How a frame flows: `main.ts` runs a fixed-step accumulator in `requestAnimationFrame` that calls
`session.tick()` (scaled by the UI's game speed, capped per frame), then `renderer.draw`, the HUD,
`sounds.update` and the tutorial check. Everything outside `src/sim/` only reads the world; to change
it, the input and HUD call `issue({ kind: 'place', ... })`, which applies a `Command` through the
session. Commands return what the `World` method returns: an error code (`PlaceError`,
`ResearchError`) instead of throwing. A unit test fails if `src/ui` or `src/input` call `World`
methods that change it. The main menu runs a live `World` too (`demo.ts`), without a session.
- Buildings have rectangular footprints (`size` in `BUILDINGS`, width along the facing); use
  `footprint(type, dir)`, `world.footprintOf(b)`, `world.outputTile(b)` instead of assuming 1×1.
- Saves are versioned (`SAVE_VERSION` in `world.ts`). If you change saved state, bump the version and
  add a migration with a test (v8 deliberately can't load older saves; see D-038). State that steers the
  rules belongs in `GameState`, not in private `World` fields, or co-op games loaded from a snapshot drift.
- Match the surrounding style: short doc comments explaining *why*, and no `any`.

## Tests

- Unit tests sit next to the code (`world.test.ts`, `ship.test.ts`, `belts.test.ts`, `sounds.test.ts`).
  Build test worlds with everything researched and nests cleared, then place what you need.
- Browser tests are in `e2e/`, with shared helpers in `e2e/helpers.ts`. The `test` fixture fails on
  any page error. Use the helpers instead of raw clicks on the map: `newGame`, `calm` (removes bugs),
  `selectHub`, `uncoveredTile` (pans so a tile isn't under a panel), `build` (handles the touch
  blueprint ✓), `settled` and `cameraSettled` (wait for animations). Don't depend on game time
  passing; trigger states directly through `window.game`.
- `window.game` exposes `world`, `camera`, `renderer`, `ui`, `music` and `sfx` for tests and debugging.

## Docs: keep them true

Every change that alters the game updates, in the same PR:
- `docs/GAME_DESIGN.md` (mechanics, numbers, controls),
- `docs/ROADMAP.md` (status),
- `CHANGELOG.md`: every merge to `master` is a new version at the top (`## 0.27.0 · YYYY-MM-DD · Title`,
  with `### New` and `### Fixed` lists), and `package.json`'s version matches it (a test checks). The
  game shows this file as its version and under What's new, so write it for players,
- `docs/DECISIONS.md` for any real choice: add a new `D-0xx` row at the bottom of the table and
  never edit old rows (supersede them). Open questions are `Q-xx`.
- `docs/ART_LIST.md` when sprites or their sizes change; `docs/CREDITS.md` for third-party assets.

Write docs in plain, short sentences. The owner prefers not to see the word "honest" used needlessly.

## Gotchas

- Never `pkill -f "vite preview"` (or similar `-f` patterns) from a shell: it can match and kill the
  shell itself. Find the PID and kill that: `lsof -ti tcp:4173`, or via `/proc` on Linux (its `cmdline`
  files separate arguments with NUL bytes, so `tr '\0' ' '` before matching), or on Windows with
  `netstat -ano | findstr :4173` then `taskkill /PID <pid> /F`. `scripts/check.sh` does this for you.
- Pathfinding costs use `Float64Array` on purpose; 32-bit storage caused a heap blow-up (see the
  comment on `World.flow`).
- Browsers only allow audio after a click or key press; `Music` and `Sfx` wait for it.
- The single-file build has no `public/` folder, so no music there (sound effects still work).

## Git

- The default branch is `master`. Work on a feature branch and open a PR; CI must be green to merge.
- When merging through the API, pass the exact head SHA (`git rev-parse HEAD`).
