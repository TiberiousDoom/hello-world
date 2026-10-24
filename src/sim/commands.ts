// Everything a player can do to the world, as plain data (co-op phase 0, D-058).
//
// The interface never changes the world directly: it issues a command, and the
// command is applied here. In single player that happens at once; in co-op the
// same commands travel between games and every game applies them on the same
// tick. Each one goes through the normal World methods, which refuse what isn't
// allowed, so a command that can't happen fails the same way in every game.

import { BuildingType, Dir, ItemId } from './data';
import { LaunchError, launch, pickBlueprint } from './ship';
import type { Building, HandTap, MineError, PlaceError, ResearchError, World } from './world';

export type Command =
  | { kind: 'place'; type: BuildingType; x: number; y: number; dir: Dir; replaceBelt: boolean }
  | { kind: 'demolish'; id: number }
  | { kind: 'rotate'; id: number; dir?: Dir }
  // Turns the building of this type at (x, y): a dragged belt pointing at the next one. By place, not id,
  // because in co-op the belt is still on its way to the host when the next one is dragged.
  | { kind: 'turn'; x: number; y: number; type: BuildingType; dir: Dir }
  | { kind: 'recipe'; id: number; recipe: string | null }
  | { kind: 'filter'; id: number; item: ItemId | null }
  | { kind: 'splitter-side'; id: number; side: 'left' | 'right' }
  | { kind: 'research'; id: string }
  | { kind: 'pause-research' }
  | { kind: 'upgrade-belts'; x: number; y: number }
  | { kind: 'launch' }
  | { kind: 'pick-blueprint'; id: string }
  | { kind: 'mine'; x: number; y: number }
  | { kind: 'collect'; id: number }
  | { kind: 'drop'; id: number }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'walk'; dx: number; dy: number }
  // An engineer for a player joining a co-op game (D-076), and sending it home when they leave (D-079).
  | { kind: 'add-player'; id: number }
  | { kind: 'send-home'; id: number }
  // Every game rebuilds its path fields on the same tick, before a snapshot is taken.
  | { kind: 'checkpoint' };

/** What applying each kind of command returns. */
export interface CommandResults {
  place: Building | PlaceError;
  demolish: boolean;
  rotate: boolean;
  turn: boolean;
  recipe: void;
  filter: void;
  'splitter-side': void;
  research: ResearchError | null;
  'pause-research': void;
  'upgrade-belts': { upgraded: number; left: number } | PlaceError;
  launch: LaunchError | null;
  'pick-blueprint': boolean;
  mine: HandTap | MineError;
  collect: number;
  drop: number;
  move: boolean;
  walk: void;
  'add-player': boolean;
  'send-home': boolean;
  checkpoint: void;
}

export type ResultOf<C extends Command> = CommandResults[C['kind']];

/** Applies a command for `player`: whose engineer mines, walks and carries. */
export function applyCommand<C extends Command>(w: World, c: C, player = 0): ResultOf<C> {
  return apply(w, c, player) as ResultOf<C>;
}

function apply(w: World, c: Command, player: number): CommandResults[keyof CommandResults] {
  switch (c.kind) {
    case 'place':
      return w.place(c.type, c.x, c.y, c.dir, c.replaceBelt);
    case 'demolish':
      return w.demolish(c.id);
    case 'rotate':
      return w.rotate(c.id, c.dir);
    case 'turn': {
      const b = w.buildingAt(c.x, c.y);
      return b?.type === c.type ? w.rotate(b.id, c.dir) : false;
    }
    case 'recipe':
      return w.setRecipe(c.id, c.recipe);
    case 'filter':
      return w.setFilter(c.id, c.item);
    case 'splitter-side':
      return w.setSplitterSide(c.id, c.side);
    case 'research':
      return w.startResearch(c.id);
    case 'pause-research':
      return w.pauseResearch();
    case 'upgrade-belts':
      return w.upgradeBeltLine(c.x, c.y);
    case 'launch':
      return launch(w);
    case 'pick-blueprint':
      return pickBlueprint(w, c.id);
    case 'mine':
      return w.mineByHand(c.x, c.y, player);
    case 'collect':
      return w.collect(c.id, player);
    case 'drop':
      return w.dropOff(c.id, player);
    case 'move':
      return w.moveTo(c.x, c.y, player);
    case 'walk':
      return w.walk(c.dx, c.dy, player);
    case 'add-player':
      return w.addPlayer(c.id);
    case 'send-home':
      return w.sendHome(c.id);
    case 'checkpoint':
      return w.checkpoint();
  }
}
