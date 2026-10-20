# Changelog

## Unreleased: M3a, placeholder art and main menu
- Detailed placeholder art for every P1 and P2 sprite: items, resource nodes, ground, all buildings, the hub, and enemies. Turrets and cannons aim their barrels.
- Effects: muzzle flashes, cannon blasts, enemy death puffs, spawn warning markers, and a hub breach shockwave.
- Art pipeline: drop a PNG into `src/art/` with the same name as a placeholder to replace it.
- Main menu with a live demo factory behind it: Continue (shows mode and wave), New game, How to play.
- New menu style: navy and sky blue, flat icons, Montserrat headings. Toolbar and info panel show building and item art.
- The pause menu gains How to play and Main menu. Game over offers Main menu.

## Unreleased: M2b, progression and onboarding
- Research tree replaces tiers. You start with belt, extractor and furnace, and research the rest using hub stock.
- Spotlight tutorial on first launch, which can be replayed from the menu.
- Hub ports put a chosen item from hub stock back onto belts, so stock can feed turrets.
- Standard mode: losing the hub causes a breach (stock lost, attack ends) instead of game over.
- Hardcore mode (losing the hub ends the run), unlocked by clearing wave 10 in Standard.
- A New game dialog to choose the mode.
- Starting iron plates raised from 80 to 100.
- Saves move to v3; v1 and v2 saves are migrated.
- Docs reorganised into `docs/`.

## M2a: logistics and sustain
- Splitters, underground belts, repair stations and the runner enemy.
- Saves move to v2.

## M1: prototype
- Core loop: extractors, belts, furnaces, workshops, assemblers, the hub, and tiers.
- Waves, turrets, cannons and walls. Touch and desktop controls. Autosave.
