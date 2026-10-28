import { describe, expect, it } from 'vitest';
import { RESEARCH } from '../sim/data';
import { researchOrder } from './researchOrder';

describe('The research menu order (#154)', () => {
  it('lists what can start, then what waits, each requirement before what needs it, and what is done last in the order done', () => {
    const fresh = researchOrder([]);
    expect(fresh.done).toEqual([]);
    expect(fresh.open.length + fresh.locked.length).toBe(RESEARCH.length);
    for (const r of fresh.open) expect(r.requires).toEqual([]);
    const pos = new Map([...fresh.open, ...fresh.locked].map((r, i) => [r.id, i]));
    for (const r of RESEARCH) for (const q of r.requires) expect(pos.get(q)!).toBeLessThan(pos.get(r.id)!);

    // Forestry first, then whatever it opened: done in that order, listed in that order.
    const first = fresh.open[0].id;
    const second = researchOrder([first]).open[0].id;
    const later = researchOrder([first, second]);
    expect(later.done.map((r) => r.id)).toEqual([first, second]);
    expect(later.open.some((r) => r.id === first || r.id === second)).toBe(false);
  });
});
