// The order the research menu lists research in (#154, D-145): what can be started first, then what
// waits on other research, both in the tree's order; finished research last, in the order it was done.

import { RESEARCH, Research } from '../sim/data';

/** How deep in the tree a research sits: 0 with nothing required, else one more than its deepest requirement. */
const depth = new Map<string, number>();
function depthOf(r: Research): number {
  const known = depth.get(r.id);
  if (known != null) return known;
  depth.set(r.id, 0); // a guard against a loop in the data
  const d = r.requires.length ? 1 + Math.max(...r.requires.map((q) => depthOf(RESEARCH.find((x) => x.id === q)!))) : 0;
  depth.set(r.id, d);
  return d;
}

/** The tree's order: by depth, then as listed in data.ts. */
const TREE_ORDER = RESEARCH.map((r, i) => ({ r, i }))
  .sort((a, b) => depthOf(a.r) - depthOf(b.r) || a.i - b.i)
  .map(({ r }) => r);

/** Research in the menu's order, split into what's open, what's locked and what's done. */
export function researchOrder(researched: readonly string[]): { open: Research[]; locked: Research[]; done: Research[] } {
  const isDone = (id: string) => researched.includes(id);
  const open = TREE_ORDER.filter((r) => !isDone(r.id) && r.requires.every(isDone));
  const locked = TREE_ORDER.filter((r) => !isDone(r.id) && !r.requires.every(isDone));
  const done = researched.map((id) => RESEARCH.find((r) => r.id === id)).filter((r): r is Research => !!r);
  return { open, locked, done };
}
