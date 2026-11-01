const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4174/');
  await p.click('#mm-new');
  await p.click('[data-mode="standard"]');
  await p.waitForFunction(() => window.game && window.game.world && window.game.world.hub);
  const setup = async (stage, extra) =>
    p.evaluate(([stage, extra]) => {
      const g = window.game, w = g.world, s = w.state;
      document.querySelector('#tutorial')?.setAttribute('hidden', '');
      if (!s.buildings.some((b) => b.type === 'shipyard')) {
        w.isUnlocked = () => true;
        s.inventory = { plank: 999, truss: 999, rope: 999, log: 999 };
        s.nests = []; s.enemies = []; w.nestCells.clear();
        const x = w.hub.x - 14, y = w.hub.y;
        for (let dy = -4; dy <= 8; dy++) for (let dx = -4; dx <= 8; dx++) s.resources[w.idx(x + dx, y + dy)] = s.trees[w.idx(x + dx, y + dy)] = 0;
        s.shipSite = { x, y };
        w.layout++;
        const r = w.place('shipyard', x, y, 0);
        if (typeof r === 'string') console.log('place', r);
        g.camera.x = x + 2.5; g.camera.y = y + 2.5; g.camera.zoom = 80;
      }
      s.ship.stage = stage;
      s.ship.delivered = { steel: 60, steel_beam: 30, bearing: 15, motor: 10, coil: 30, circuit: 50 };
      if (extra === 'launch') s.ship.launchAt = s.time + 80;
      const yard = s.buildings.find((b) => b.type === 'shipyard');
      g.ui.selected = yard.id;
    }, [stage, extra]);
  for (const [stage, name, extra] of [[2, 'hull-half'], [3, 'engine-half'], [6, 'done'], [6, 'launch', 'launch']]) {
    await setup(stage, extra);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${process.argv[2]}/map-${name}.png`, clip: { x: 300, y: 150, width: 500, height: 460 } });
    if (name !== 'launch') {
      await p.click('#info [data-action="ship-view"]');
      await p.waitForTimeout(300);
      await p.locator('#ship-view .card').screenshot({ path: `${process.argv[2]}/side-${name}.png` });
      await p.click('#ship-view [data-close]');
    }
  }
  await b.close();
})();
