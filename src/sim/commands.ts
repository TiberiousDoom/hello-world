// Everything a player can do to the world, as plain data (co-op phase 0, D-058).
//
// The interface never changes the world directly: it issues a command, and the
// command is applied here. In single player that happens at once; in co-op the
// same commands travel between games and every game applies them on the same
// tick. Each one goes through the normal World methods, which refuse what isn't
// allowed, so a command that can't happen fails the same way in every game.

import { BuildingType, Dir, ItemId } from './data';
import { LaunchError, launch, pickBlueprint } from './ship';
import type { Building, PlaceError, ResearchError, World } from './world';

export type Command =
  | { kind: 'place'; type: BuildingType; x: number; y: number; dir: Dir; replaceBelt: boolean }
  | { kind: 'demolish'; id: number }
  | { kind: 'rotate'; id: number; dir?: Dir }
  | { kind: 'recipe'; id: number; recipe: string | null }
  | { kind: 'filter'; id: number; item: ItemId | null }
  | { kind: 'research'; id: string }
  | { kind: 'pause-research' }
  | { kind: 'upgrade-belts'; x: number; y: number }
  | { kind: 'launch' }
  | { kind: 'pick-blueprint'; id: string }
  // Every game rebuilds its path fields on the same tick, before a snapshot is taken.
  | { kind: 'checkpoint' };

/** What applying each kind of command returns. */
export interface CommandResults {
  place: Building | PlaceError;
  demolish: boolean;
  rotate: boolean;
  recipe: void;
  filter: void;
  research: ResearchError | null;
  'pause-research': void;
  'upgrade-belts': { upgraded: number; left: number } | PlaceError;
  launch: LaunchError | null;
  'pick-blueprint': boolean;
  checkpoint: void;
}

export type ResultOf<C extends Command> = CommandResults[C['kind']];

export function applyCommand<C extends Command>(w: World, c: C): ResultOf<C> {
  return apply(w, c) as ResultOf<C>;
}

function apply(w: World, c: Command): CommandResults[keyof CommandResults] {
  switch (c.kind) {
    case 'place':
      return w.place(c.type, c.x, c.y, c.dir, c.replaceBelt);
    case 'demolish':
      return w.demolish(c.id);
    case 'rotate':
      return w.rotate(c.id, c.dir);
    case 'recipe':
      return w.setRecipe(c.id, c.recipe);
    case 'filter':
      return w.setFilter(c.id, c.item);
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
    case 'checkpoint':
      return w.checkpoint();
  }
}
