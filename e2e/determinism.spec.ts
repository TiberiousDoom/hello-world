import { expect, test } from './helpers';
import { runScenario } from '../src/sim/scenario';

// Co-op keeps games in step by having every player's browser compute the same
// game from the same commands (D-058). This runs a scripted fight in the browser
// (Chromium, Firefox and WebKit in CI) and checks it matches Node's result exactly.
test('every browser computes exactly the same game', async ({ page }) => {
  const expected = runScenario(7, 1200);
  await page.goto('/');
  await page.waitForFunction(() => window.game?.runScenario);
  const actual = await page.evaluate(() => window.game.runScenario(7, 1200));
  expect(actual).toEqual(expected);
});
