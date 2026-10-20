// The research engine shared by Company research (paid from hub stock) and
// black-market research (paid from the stash): the active research draws its
// items from a source at a steady pace over its research time.

import { ItemCounts, ItemId, Research } from './data';

export interface ResearchState {
  active: string | null;
  /** Items already put into each research, kept when you switch to another. */
  paid: Record<string, ItemCounts>;
  /** Items the active research may take but hasn't yet (fractional, carried between ticks). */
  budget: number;
  /** True when the active research is waiting for items the source doesn't have. */
  stalled: boolean;
}

export function createResearchState(): ResearchState {
  return { active: null, paid: {}, budget: 0, stalled: false };
}

/** Fraction (0–1) of a research's items put in so far. */
export function researchFraction(rs: ResearchState, def: Research): number {
  const paid = rs.paid[def.id] ?? {};
  let need = 0;
  let have = 0;
  for (const [k, n] of Object.entries(def.cost)) {
    need += n!;
    have += Math.min(n!, paid[k as ItemId] ?? 0);
  }
  return need ? have / need : 1;
}

/** Draws the active research's items from `source`. Returns true when it has everything. */
export function drawResearch(rs: ResearchState, def: Research, source: ItemCounts, dt: number): boolean {
  const paid = (rs.paid[def.id] ??= {});
  const total = Object.values(def.cost).reduce((a, n) => a + n!, 0);
  const rate = total / def.time;
  rs.budget = Math.min(rs.budget + rate * dt, 1 + rate * dt);
  rs.stalled = false;
  while (rs.budget >= 1) {
    // Take from whichever item is furthest behind and available.
    let pick: ItemId | null = null;
    let worst = Infinity;
    for (const [k, n] of Object.entries(def.cost)) {
      const item = k as ItemId;
      const frac = (paid[item] ?? 0) / n!;
      if (frac < 1 && (source[item] ?? 0) > 0 && frac < worst) {
        worst = frac;
        pick = item;
      }
    }
    if (!pick) {
      rs.stalled = researchFraction(rs, def) < 1;
      break;
    }
    source[pick]!--;
    paid[pick] = (paid[pick] ?? 0) + 1;
    rs.budget--;
  }
  return researchFraction(rs, def) >= 1;
}
