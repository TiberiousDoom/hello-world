const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4174/');
  await p.click('#mm-new');
  await p.click('[data-mode="standard"]');
  await p.waitForFunction(() => window.game && window.game.world && window.game.world.hub);
  const spots = await p.evaluate(() => {
    const g = window.game, w = g.world, s = w.state;
    document.querySelector('#tutorial')?.setAttribute('hidden', '');
    s.explored?.fill?.(1);
    s.nests = []; s.enemies = [];
    // The richest spot of each ore near the hub.
    const best = {};
    for (let y = 2; y < s.height - 2; y++)
      for (let x = 2; x < s.width - 2; x++) {
        const k = s.resources[w.idx(x, y)];
        if (!k) continue;
        if (Math.abs(x - w.hub.x) + Math.abs(y - w.hub.y) > 70) continue;
        let n = 0;
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (s.resources[w.idx(x + i, y + j)] === k) n++;
        if (!best[k] || n > best[k].n) best[k] = { x, y, n };
      }
    return best;
  });
  console.log(JSON.stringify(spots));
  for (const [k, sp] of Object.entries(spots)) {
    for (const zoom of [56, 28]) {
      await p.evaluate(([x, y, z]) => { const c = window.game.camera; c.x = x; c.y = y; c.zoom = z; }, [sp.x, sp.y, zoom]);
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${process.argv[2]}/ore${k}-${zoom}.png`, clip: { x: 150, y: 80, width: 700, height: 480 } });
    }
  }
  await b.close();
})();
