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
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
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
