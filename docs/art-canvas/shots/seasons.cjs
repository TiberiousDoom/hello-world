const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4174/');
  await p.click('#mm-new');
  await p.click('[data-mode="standard"]');
  await p.waitForFunction(() => window.game && window.game.world && window.game.world.hub);
  // A spot with forest next to open ground.
  await p.evaluate(() => {
    const g = window.game, w = g.world, s = w.state;
    document.querySelector('#tutorial')?.setAttribute('hidden', '');
    s.nests = []; s.enemies = [];
    let best = null;
    for (let r = 4; r < 40 && !best; r++)
      for (let dy = -r; dy <= r && !best; dy++)
        for (let dx = -r; dx <= r && !best; dx++) {
          const x = w.hub.x + dx, y = w.hub.y + dy;
          let n = 0;
          for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (s.trees[w.idx(x + i, y + j)] === 1) n++;
          if (n > 20 && n < 40) best = { x, y };
        }
    g.camera.x = best.x; g.camera.y = best.y; g.camera.zoom = 56;
    s.explored?.fill?.(1);
  });
  const DAY = 540;
  const shots = [['1 · Fall, day 3', 9.0], ['2 · Fall, last day: leaves falling', 9.3], ['3 · Fall, last day: mostly bare', 9.52], ['4 · Winter begins: bare, on fallen leaves', 10.02], ['5 · Winter, first day: snow coming', 10.3], ['6 · Winter, first day: nearly settled', 10.52]];
  for (const [name, d] of shots) {
    await p.evaluate((t) => { window.game.world.state.time = t; }, d * DAY);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${process.argv[2]}/s${name[0]}.png`, clip: { x: 0, y: 40, width: 900, height: 450 } });
  }
  await b.close();
})();
