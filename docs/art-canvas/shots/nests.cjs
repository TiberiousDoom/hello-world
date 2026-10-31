const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4174/');
  await p.click('#mm-new');
  await p.click('[data-mode="standard"]');
  await p.waitForFunction(() => window.game && window.game.world && window.game.world.hub);
  const info = await p.evaluate(() => {
    const g = window.game, w = g.world, s = w.state;
    document.querySelector('#tutorial')?.setAttribute('hidden', '');
    s.explored?.fill?.(1);
    const C = 10;
    // A nest with open ground in its cell and the three cells east and south of it, none near another nest.
    let pick = null;
    for (const a of s.nests) {
      if (a.destroyed || a.kind === 'queen' || a.cells) continue;
      const others = s.nests.filter((n) => n !== a && !n.destroyed && n.x >= a.x && n.x < a.x + 20 && n.y >= a.y && n.y < a.y + 20);
      if (others.length) continue;
      let trees = 0;
      for (let y = a.y; y < a.y + 20; y++) for (let x = a.x; x < a.x + 20; x++) trees += s.trees[w.idx(x, y)] ? 1 : 0;
      if (!pick || trees < pick.trees) pick = { a, trees };
    }
    pick.bs = [[pick.a.x + C, pick.a.y], [pick.a.x, pick.a.y + C], [pick.a.x + C, pick.a.y + C]];
    window.__pick = pick;
    // Keep the bugs still and calm.
    s.enemies = s.enemies.filter((e) => e.nest !== pick.a.id);
    return { x: pick.a.x, y: pick.a.y, trees: pick.trees };
  });
  console.log(JSON.stringify(info));
  const shot = async (name, setup, cx, cy, zoom) => {
    await p.evaluate(setup);
    await p.evaluate(([x, y, z]) => { const c = window.game.camera; c.x = x; c.y = y; c.zoom = z; window.game.world.layout++; }, [cx, cy, zoom]);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${process.argv[2]}/${name}.png`, clip: { x: 150, y: 60, width: 700, height: 600 } });
  };
  const { x, y } = info;
  for (const st of [1, 2, 3]) await shot(`stage${st}`, `(() => { const n = window.__pick.a; n.stage = ${st}; })()`, x + 5, y + 5, 40);
  // Merged with the cell to the east, then all four.
  await shot('merged2', `(() => { const { a, bs } = window.__pick; const w = window.game.world; a.stage = 3; const [bx, by] = bs[0]; a.cells = [[bx, by]]; w.nestCells.set((bx/10)*4096 + by/10, a); })()`, x + 10, y + 5, 28);
  await shot('merged4', `(() => { const { a, bs } = window.__pick; const w = window.game.world; a.cells = bs.map(([bx, by]) => { w.nestCells.set((bx/10)*4096 + by/10, a); return [bx, by]; }); })()`, x + 10, y + 10, 26);
  await b.close();
})();
