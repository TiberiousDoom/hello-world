// Builds the sound board (#214) into dist-soundboard/index.html: one file with the page and its script
// inlined, playable offline or published as a page. The board is src/audio/soundboard.ts.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const out = await build({ entryPoints: ['src/audio/soundboard.ts'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = readFileSync('audio/soundboard.html', 'utf8').replace('/*BOARD*/', () => js);
mkdirSync('dist-soundboard', { recursive: true });
writeFileSync('dist-soundboard/index.html', page);
console.log(`dist-soundboard/index.html: ${(page.length / 1024).toFixed(1)} KB`);
