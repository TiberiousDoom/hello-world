import { defineConfig } from '@playwright/test';

// Browser tests (e2e/). They build the game and serve it, because the music
// only loads over HTTP. Each test runs on a desktop and a phone viewport; the
// determinism test also runs in Firefox and WebKit (co-op needs every browser to
// compute the same game, D-058).
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  // On CI, failures are also written as annotations (the 'github' reporter): readable without the log.
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The offline cache (D-144) would serve the last build's files to later tests; its own test allows it.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npx vite build --logLevel warn && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1200, height: 780 } } },
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'firefox', testMatch: /determinism/, use: { browserName: 'firefox' } },
    { name: 'webkit', testMatch: /determinism/, use: { browserName: 'webkit' } },
  ],
});
