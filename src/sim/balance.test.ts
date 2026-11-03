import { describe, expect, it } from 'vitest';
import { balanceTable, fight, formatTable } from './balance';

describe('The balance script (D-174)', () => {
  it('is deterministic', () => {
    expect(fight('wood', 'warren', 45, 1)).toEqual(fight('wood', 'warren', 45, 1));
  }, 60_000);

  it('prints every age against every kind of nest', () => {
    const rows = balanceTable();
    console.log(`\n${formatTable(rows)}\n`);
    expect(rows.length).toBe(4 * 5 * 2);
  }, 600_000);
});
