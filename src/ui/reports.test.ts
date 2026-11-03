import { describe, expect, it } from 'vitest';
import { REPORTS_PER_VISIT, type ErrorReport } from '../net/report';
import { Reporter } from './reports';

const report = (message: string): ErrorReport => ({ v: '0.94.0', message, where: 'index.js:1', stack: '', ua: 'test', screen: '1×1', game: 'menu' });

describe('The reporter (D-173)', () => {
  it('asks once, sends nothing until the player agrees, then sends what waited', () => {
    let consent: boolean | null = null;
    let asked = 0;
    const posted: string[] = [];
    const r = new Reporter(
      () => consent,
      () => asked++,
      (x) => (posted.push(x.message), true),
    );
    r.error(report('a'));
    r.error(report('b'));
    expect(posted).toEqual([]);
    expect(asked).toBe(2); // asked while unanswered; the page shows its question once
    consent = true;
    r.flush();
    expect(posted).toEqual(['a', 'b']);
    r.error(report('a')); // the same kind again: not sent twice
    expect(posted).toEqual(['a', 'b']);
  });

  it('never sends when the player said no, and sends a few at most a visit', () => {
    const posted: string[] = [];
    const no = new Reporter(
      () => false,
      () => {},
      (x) => (posted.push(x.message), true),
    );
    no.error(report('a'));
    expect(posted).toEqual([]);
    const yes = new Reporter(
      () => true,
      () => {},
      (x) => (posted.push(x.message), true),
    );
    for (let i = 0; i < 20; i++) yes.error(report(`error ${String.fromCharCode(97 + i)}`));
    expect(posted.length).toBe(REPORTS_PER_VISIT);
  });
});
