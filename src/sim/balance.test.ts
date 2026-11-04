import { describe, expect, it } from 'vitest';
import { NESTS } from './data';
import { BANDS, OUTPOSTS, fight, formatTable, type Fight } from './balance';

/** Lets the test runner breathe between fights: a minute of fights in one go makes its worker time out. */
const breathe = () => new Promise((r) => setTimeout(r, 0));

describe('The balance script (D-174)', () => {
  it('is deterministic', () => {
    expect(fight('wood', 'warren', 45, 1)).toEqual(fight('wood', 'warren', 45, 1));
  }, 60_000);

  it('prints every age against every kind of nest; bugs attack every outpost, walled in steel or not (D-176)', async () => {
    const rows: Fight[] = [];
    for (const age of Object.keys(OUTPOSTS))
      for (const [kind, distance] of BANDS)
        for (const stage of [1, 3]) {
          rows.push(fight(age, kind, distance, stage));
          await breathe();
        }
    console.log(`\n${formatTable(rows)}\n`);
    expect(rows.length).toBe(4 * 5 * 2);
    expect(rows.filter((r) => r.outcome === 'ignored')).toEqual([]);
  }, 600_000);

  // About 200 fights, so it runs on demand (`npm run balance`) rather than with every test run.
  it.runIf(process.env.BALANCE)(
    'prints the highest threat level each age holds against each kind of nest at stage 3',
    async () => {
      const lines = ['| age | ' + BANDS.map(([k]) => k).join(' | ') + ' |', `|---|${BANDS.map(() => '---').join('|')}|`];
      for (const age of Object.keys(OUTPOSTS)) {
        const held: string[] = [];
        for (const [kind, distance] of BANDS) {
          let best = -1;
          for (let t = 0; t <= NESTS.threatMax; t++) {
            const ok = fight(age, kind, distance, 3, 5, t).outcome === 'held';
            await breathe();
            if (!ok) break;
            best = t;
          }
          held.push(best < 0 ? 'none' : String(best));
        }
        lines.push(`| ${age} | ${held.join(' | ')} |`);
      }
      console.log(`\n${lines.join('\n')}\n`);
    },
    600_000,
  );
});
