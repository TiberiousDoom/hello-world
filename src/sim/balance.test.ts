import { describe, expect, it } from 'vitest';
import { BANDS, OUTPOSTS, balanceTable, fight, formatTable, threatHeld } from './balance';

describe('The balance script (D-174)', () => {
  it('is deterministic', () => {
    expect(fight('wood', 'warren', 45, 1)).toEqual(fight('wood', 'warren', 45, 1));
  }, 60_000);

  it('prints every age against every kind of nest; bugs attack every outpost, walled in steel or not (D-176)', () => {
    const rows = balanceTable();
    console.log(`\n${formatTable(rows)}\n`);
    expect(rows.length).toBe(4 * 5 * 2);
    expect(rows.filter((r) => r.outcome === 'ignored')).toEqual([]);
  }, 600_000);

  it('prints the highest threat level each age holds against each kind of nest at stage 3', () => {
    const lines = ['| age | ' + BANDS.map(([k]) => k).join(' | ') + ' |', `|---|${BANDS.map(() => '---').join('|')}|`];
    for (const age of Object.keys(OUTPOSTS)) {
      const held = threatHeld(age);
      lines.push(`| ${age} | ${BANDS.map(([k]) => (held[k] < 0 ? 'none' : String(held[k]))).join(' | ')} |`);
    }
    console.log(`\n${lines.join('\n')}\n`);
  }, 600_000);
});
