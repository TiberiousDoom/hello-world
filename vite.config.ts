/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` inlines everything into one HTML file so the game can be
// shared as a single page; the default build is a normal static site.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  // The single page can't carry the music, so it plays silently.
  publicDir: mode === 'single' ? false : 'public',
  // Unit tests live beside the code; browser tests (e2e/) run under Playwright.
  test: { include: ['src/**/*.test.ts'] },
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}));
