/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Files from public/ the service worker keeps (not the music). */
const PUBLIC_KEPT = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

/**
 * Writes sw.js (D-143): pwa/sw.js with the build's files to keep for offline play, and a version
 * that changes whenever they do, so a new build replaces the old copies.
 */
function serviceWorker(): Plugin {
  return {
    name: 'foundry-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['./', ...Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html'), ...PUBLIC_KEPT];
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync('pwa/sw.js', 'utf8').replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// `--mode single` inlines everything into one HTML file so the game can be
// shared as a single page; the default build is a normal static site.
/** The single page links to no manifest or home-screen icon: it has no public/ folder to find them in. */
function noInstall(): Plugin {
  return {
    name: 'foundry-no-install',
    transformIndexHtml: (html) => html.replace(/\s*<link rel="(manifest|apple-touch-icon)"[^>]*>/g, ''),
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  // The single page has no service worker or install: it's one file, already offline.
  plugins: mode === 'single' ? [viteSingleFile(), noInstall()] : [serviceWorker()],
  // The single page can't carry the music, so it plays silently.
  publicDir: mode === 'single' ? false : 'public',
  // Unit tests live beside the code; browser tests (e2e/) run under Playwright.
  test: { include: ['src/**/*.test.ts'] },
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}));
