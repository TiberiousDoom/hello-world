import { expect, newGame, test } from './helpers';

// Every sprite loads, the animation strips (D-082) included: a broken SVG only shows as a warning and a
// shape drawn in its place, so watch for the warning.
test('every sprite and animation strip loads', async ({ page }) => {
  const broken: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && m.text().startsWith('Could not load art')) broken.push(m.text());
  });
  await newGame(page);
  await page.evaluate(() => window.game.artLoaded);
  expect(broken).toEqual([]);
});
