const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4174/');
  await p.click('#mm-new');
  await p.click('[data-mode="standard"]');
  await p.waitForFunction(() => window.game && window.game.world && window.game.world.hub);
  const r = await p.evaluate(() => {
    const g = window.game, w = g.world, s = w.state;
    document.querySelector('#tutorial')?.setAttribute('hidden', '');
    s.explored?.fill?.(1); s.nests = []; s.enemies = [];
    w.isUnlocked = () => true;
    s.inventory = { stone: 99, iron_ore: 99, log: 99 };
    // The nearest ore tile with ore all round it.
    let best = null;
    for (let d = 3; d < 60 && !best; d++)
      for (let y = w.hub.y - d; y <= w.hub.y + d && !best; y++)
        for (let x = w.hub.x - d; x <= w.hub.x + d && !best; x++) {
          const k = s.resources[w.idx(x, y)];
          if (!k) continue;
          let all = true;
          for (let j = -2; j <= 3; j++) for (let i = -2; i <= 3; i++) if (s.resources[w.idx(x + i, y + j)] !== k) all = false;
          if (all) best = { x, y };
        }
    const res = w.place('extractor', best.x, best.y, 0);
    // A worked-out tile beside it.
    s.resources[w.idx(best.x - 2, best.y + 2)] = 0;
    w.layout++;
    g.camera.x = best.x + 1; g.camera.y = best.y + 1; g.camera.zoom = 56;
    return { best, res };
  });
  console.log(JSON.stringify(r));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${process.argv[2]}/extractor.png`, clip: { x: 150, y: 80, width: 700, height: 480 } });
  await b.close();
})();
