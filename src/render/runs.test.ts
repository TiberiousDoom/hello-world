import { describe, expect, it } from 'vitest';
import { runSuffix } from './runs';

describe('runSuffix', () => {
  it('draws straight runs by direction', () => {
    expect(runSuffix(false, false, true, true, '_post')).toBe('');
    expect(runSuffix(true, true, false, false, '_post')).toBe('_v');
    expect(runSuffix(true, false, false, false, '_post')).toBe('_v');
  });

  it('names each corner after the end of the enclosure it sits on', () => {
    expect(runSuffix(false, true, true, false, '_post')).toBe('_nw'); // joins east and south
    expect(runSuffix(false, true, false, true, '_post')).toBe('_ne');
    expect(runSuffix(true, false, true, false, '_post')).toBe('_sw');
    expect(runSuffix(true, false, false, true, '_post')).toBe('_se');
  });

  it('caps runs that stop, and lone pieces', () => {
    expect(runSuffix(false, false, false, true, '_post')).toBe('_end_w');
    expect(runSuffix(false, false, true, false, '_post')).toBe('_end_e');
    expect(runSuffix(false, false, false, false, '_pier')).toBe('_pier');
  });
});
