import { describe, expect, it } from 'vitest';
import pkg from '../../package.json?raw';
import { RELEASES, VERSION, parseChangelog, releaseHtml } from './changelog';

describe('The changelog', () => {
  it('starts with the version in package.json', () => {
    expect(VERSION).toBe(JSON.parse(pkg).version);
  });

  it('numbers every release, newest first', () => {
    expect(RELEASES.length).toBeGreaterThan(20);
    const num = (v: string) =>
      v
        .split('.')
        .map(Number)
        .reduce((a, b) => a * 1000 + b, 0);
    for (let i = 1; i < RELEASES.length; i++) expect(num(RELEASES[i - 1].version)).toBeGreaterThan(num(RELEASES[i].version));
    for (const r of RELEASES) expect(r.lines.length, `v${r.version} has notes`).toBeGreaterThan(0);
  });

  it('turns an entry into safe HTML', () => {
    const [r] = parseChangelog('## 1.2.3 · 2026-01-02 · Test\n### New\n- **Bold** and `code` <script>\n### Fixed\n- A bug');
    expect(r).toMatchObject({ version: '1.2.3', date: '2026-01-02', title: 'Test' });
    expect(releaseHtml(r)).toBe('<h4>New</h4><ul><li><b>Bold</b> and <code>code</code> &lt;script&gt;</li></ul><h4>Fixed</h4><ul><li>A bug</li></ul>');
  });
});
