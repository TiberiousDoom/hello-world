import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { ErrorLog, FrameRate, ISSUES_URL, diagnostics, issueUrl, report } from './feedback';

const base = {
  version: '9.9.9',
  userAgent: 'TestBrowser/1.0',
  screen: { width: 390, height: 844, dpr: 3 },
  touch: true,
  batterySaver: false,
  fps: 59.6,
  errors: [] as string[],
  speed: 1,
};

describe('Feedback form', () => {
  it('describes the device and the game being played', () => {
    const w = World.create(42);
    w.state.time = 600;
    const text = diagnostics({ ...base, world: w, errors: ['Boom (main.js:1)'] });
    expect(text).toContain('Version: 9.9.9');
    expect(text).toContain('390×844 at 3× (touch)');
    expect(text).toContain('Frame rate: 60 a second');
    expect(text).toContain('standard, 10 min played, seed 42');
    expect(text).toContain('Built: nothing yet');
    expect(text).toContain('  - Boom (main.js:1)');
    expect(diagnostics({ ...base, world: null })).toContain('on the main menu');
    expect(diagnostics({ ...base, world: null, fps: 0 })).toContain('Frame rate: not measured yet');
  });

  it('turns a report into a GitHub issue link, labelled by kind and cut short when too long', () => {
    const { title, body } = report('bug', 'Bugs twitch\nat the leash edge', '- Version: 9.9.9');
    expect(title).toBe('Bug: Bugs twitch');
    expect(body).toContain('### Diagnostics');
    const url = new URL(issueUrl(title, body, 'bug'));
    expect(url.origin + url.pathname).toBe(ISSUES_URL);
    expect(url.searchParams.get('title')).toBe(title);
    expect(url.searchParams.get('labels')).toBe('playtest,bug');
    expect(new URL(issueUrl('Idea: x', 'y', 'idea')).searchParams.get('labels')).toBe('playtest,enhancement');
    const long = issueUrl(title, 'x'.repeat(20000), 'other', 3000);
    expect(long.length).toBeLessThanOrEqual(3000);
    expect(new URL(long).searchParams.get('body')).toContain('Cut short');
    expect(report('other', '  ', null).title).toBe('Feedback: (no description)');
  });

  it('keeps the last few errors without repeats, and averages the frame rate', () => {
    const log = new ErrorLog(2);
    for (const m of ['a', 'a', 'b', 'c']) log.push(m);
    expect(log.entries).toEqual(['b', 'c']);
    const fr = new FrameRate(5);
    for (let t = 0; t <= 200; t += 50) fr.frame(t);
    expect(fr.fps).toBeCloseTo(20);
  });
});
