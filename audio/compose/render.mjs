// Renders the game's music into public/music/ (D-051, D-052).
//
//   node audio/compose/render.mjs              every track
//   node audio/compose/render.mjs menu-theme   just the ones named

import menuTheme from './menu-theme.mjs';
import { TRACKS } from './tracks.mjs';

const ALL = { 'menu-theme': menuTheme, ...TRACKS };
const names = process.argv.slice(2);
for (const name of names.length ? names : Object.keys(ALL)) {
  if (!ALL[name]) throw new Error(`no track called ${name}; there are ${Object.keys(ALL).join(', ')}`);
  ALL[name]();
}
