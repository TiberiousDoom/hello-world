# Vision

**Working title:** Foundry Front (to be renamed; see [DECISIONS.md](DECISIONS.md#open-questions)).

## Pitch

A factory-automation game in the spirit of Builderment, where the factory is
also the fortress. You mine, smelt and assemble across a large, generated map, and
bug territories test whether your production can keep your defenses fed as you expand.

**Goal:** build an escape ship and get off the planet. (The Company story was dropped,
D-040; how the ship ties in is open, Q-17.)

## Pillars

1. **Satisfying automation.** Infinite resource nodes, readable belts, and
   machines that chain into more complex items. Watching a line run should feel good.
2. **The factory is the defense.** Turrets fire items you make. A weak supply
   line is a weak wall. Enemies attack what's in their way, so layout matters.
3. **Play anywhere.** Every action works with touch, and with mouse and keyboard.
   The game should be pleasant to play in short sessions on a phone.

## Audience

Players who enjoy automation and strategy games (Builderment, Factorio,
Mindustry, Shapez) and want something lighter and more portable. This is not a
kids' game. The default mode is forgiving, and hardcore mode is for players who want stakes.

## Platforms

1. **Web** first: playable from a link (GitHub Pages).
2. **Phones**: installable iOS and Android apps built from the same code with Capacitor.
3. **Desktop**: the web build. A packaged desktop app is optional later.

## Look

- **Now:** placeholder shapes and colors.
- **Next:** 2D sprites (see [ART_LIST.md](ART_LIST.md)).
- **Later:** low-poly 3D. The simulation is kept separate from rendering so
  that a 3D renderer can be added without changing the game rules.

## Non-goals (for now)

- Multiplayer
- Combat units the player controls directly
- Procedural storylines or dialogue
- Ads. Monetization is an optional purchase plus donations or tips (D-017)

## Our own identity

The game is inspired by Builderment but must not copy it. The name, art, item
names, UI and story are our own. The tower-defense layer is the main way
the game sets itself apart.
