// Undo for building and demolishing (D-143). Each step holds the commands that put things back as they
// were. It lives in this browser only: in co-op, undoing sends ordinary commands, like any other change.

import type { Command, PasteItem } from '../sim/commands';
import type { Building } from '../sim/world';

/** Changes this close together (ms) undo as one step, so a dragged line goes in one go. */
export const UNDO_GROUP_MS = 400;
/** Steps kept. */
export const UNDO_MAX = 50;

/** The command that builds a demolished building again, as it was set up. */
export function rebuild(b: Building): Command {
  const it: PasteItem = { type: b.type, dx: 0, dy: 0, dir: b.dir };
  if (b.recipe) it.recipe = b.recipe;
  if (b.filter) it.filter = b.filter;
  if (b.side) it.side = b.side;
  return { kind: 'paste', x: b.x, y: b.y, items: [it] };
}

export class UndoStack {
  private steps: Command[][] = [];
  private lastAt = -Infinity;

  /** Records what undoes a change made at `now` (ms). */
  record(inverse: Command, now: number): void {
    const top = this.steps[this.steps.length - 1];
    if (top && now - this.lastAt < UNDO_GROUP_MS) top.push(inverse);
    else {
      this.steps.push([inverse]);
      if (this.steps.length > UNDO_MAX) this.steps.shift();
    }
    this.lastAt = now;
  }

  /** The last step's commands, newest first; undefined when there's nothing to undo. */
  pop(): Command[] | undefined {
    this.lastAt = -Infinity; // the next change starts a step of its own
    return this.steps.pop()?.reverse();
  }

  get size(): number {
    return this.steps.length;
  }

  clear(): void {
    this.steps = [];
    this.lastAt = -Infinity;
  }
}
