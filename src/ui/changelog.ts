// The game's version and its "What's new" panel, both read from CHANGELOG.md, so
// playtesters see what changed in the build they're playing. The top entry of
// the changelog is the current version; package.json must match it (a unit test
// checks).

import text from '../../CHANGELOG.md?raw';

export interface Release {
  version: string;
  date: string;
  title: string;
  /** The entry's lines under its heading, as written in the changelog. */
  lines: string[];
}

/** Splits the changelog into releases, newest first. Headings read `## 0.26.0 · 2026-10-23 · Title`. */
export function parseChangelog(md: string): Release[] {
  const releases: Release[] = [];
  for (const line of md.split(/\r?\n/)) {
    const head = /^## (\d+\.\d+\.\d+)(?: · (\d{4}-\d{2}-\d{2}))? · (.+)$/.exec(line);
    if (head) releases.push({ version: head[1], date: head[2] ?? '', title: head[3], lines: [] });
    else if (releases.length && line.trim()) releases[releases.length - 1].lines.push(line);
  }
  return releases;
}

export const RELEASES = parseChangelog(text);
/** The version of this build. */
export const VERSION = RELEASES[0]?.version ?? '0.0.0';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The little Markdown the changelog uses: **bold**, `code`, and #123 issue numbers left as text. */
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** One release as HTML: `### New` / `### Fixed` subheadings and bullet lists. */
export function releaseHtml(r: Release): string {
  let html = '';
  let open = false;
  for (const line of r.lines) {
    const sub = /^### (.+)$/.exec(line);
    const item = /^\s*- (.+)$/.exec(line);
    if (item) {
      if (!open) html += '<ul>';
      open = true;
      html += `<li>${inline(item[1])}</li>`;
      continue;
    }
    if (open) html += '</ul>';
    open = false;
    html += sub ? `<h4>${inline(sub[1])}</h4>` : `<p>${inline(line)}</p>`;
  }
  return open ? `${html}</ul>` : html;
}

/** The whole panel: the newest release open, older ones folded away. */
export function changelogHtml(): string {
  return RELEASES.map((r, i) => {
    const head = `<span class="rel-version">v${esc(r.version)}</span> ${inline(r.title)}${r.date ? ` <span class="muted small">${esc(r.date)}</span>` : ''}`;
    return `<details class="release"${i === 0 ? ' open' : ''}><summary>${head}</summary>${releaseHtml(r)}</details>`;
  }).join('');
}
