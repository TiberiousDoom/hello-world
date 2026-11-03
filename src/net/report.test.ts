import { describe, expect, it } from 'vitest';
import { clipReport, reportKind, validReport, type ErrorReport } from './report';

const report: ErrorReport = { v: '0.94.0', message: 'x is undefined at tile 12,40', where: 'index.js:3', stack: 'at f', ua: 'Safari', screen: '390×844 at 3× (touch)', game: 'standard, 12 min' };

describe('Error reports (D-173)', () => {
  it('takes a well-formed report, and nothing else', () => {
    expect(validReport(report)).toEqual(report);
    expect(validReport(null)).toBeNull();
    expect(validReport({ ...report, v: 'evil' })).toBeNull();
    expect(validReport({ ...report, message: '' })).toBeNull();
    expect(validReport({ ...report, stack: 5 })).toBeNull();
    expect(validReport({ ...report, message: 'x'.repeat(301) })).toBeNull();
    expect(validReport({ ...report, extra: 'ignored' })).toEqual(report);
  });

  it('cuts long fields so a report always passes', () => {
    expect(validReport(clipReport({ ...report, stack: 's'.repeat(5000), ua: 'u'.repeat(900) }))).not.toBeNull();
  });

  it('groups the same error from the same version, whatever its numbers', () => {
    expect(reportKind(report)).toBe(reportKind({ ...report, message: 'x is undefined at tile 3,7' }));
    expect(reportKind(report)).not.toBe(reportKind({ ...report, v: '0.94.1' }));
  });
});
