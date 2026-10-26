import { describe, expect, it } from 'vitest';
import { Camera } from '../render/camera';
import { LUMBER, NESTS, RESEARCH } from '../sim/data';
import { Nest, cellKey, newNest } from '../sim/nests';
import { Building, TICK, TREE, World } from '../sim/world';
import { PlayOptions, Sfx, Sound } from './sfx';
import { SoundWatcher } from './sounds';

/** Records what would be played, and how loud. */
class FakeSfx {
  played: { sound: Sound; gain: number }[] = [];
  hum = 0;
  setHum(level: number): void {
    this.hum = level;
  }
  play(sound: Sound, opts: PlayOptions = {}): void {
    this.played.push({ sound, gain: opts.gain ?? 1 });
  }
  names(): Sound[] {
    return this.played.map((p) => p.sound);
  }
}

function setup() {
  const w = World.create(1);
  const s = w.state;
  s.researched = RESEARCH.map((r) => r.id).filter((r) => r !== 'masonry');
  s.resources.fill(0);
  s.trees.fill(0);
  s.nests = [];
  s.enemies = [];
  w.nestCells.clear();
  s.inventory = { iron_plate: 999, stone: 999, iron_ore: 999, brick: 999, copper_ingot: 999, gear: 999, wire: 999, motor: 999, plank: 999, log: 999 };
  const hub = w.hub!;
  const camera = new Camera();
  camera.width = 800;
  camera.height = 600;
  camera.zoom = 32;
  camera.x = hub.x + 2.5;
  camera.y = hub.y + 2.5;
  const sfx = new FakeSfx();
  const watcher = new SoundWatcher(sfx as unknown as Sfx, camera);
  watcher.update(w); // takes in the starting state silently
  return { w, hub, sfx, watcher };
}

function placed(r: Building | string): Building {
  if (typeof r === 'string') throw new Error(`placement failed: ${r}`);
  return r;
}

function addNest(w: World, x: number, y: number): Nest {
  const n: Nest = newNest(w.state.nests.length, x, y, 0);
  w.state.nests.push(n);
  w.nestCells.set(cellKey(x / NESTS.cell, y / NESTS.cell), n);
  return n;
}

describe('Sound effects', () => {
  it('a new or loaded game plays nothing for what is already there', () => {
    const { sfx } = setup();
    expect(sfx.played).toEqual([]);
  });

  it('placing, demolishing and losing buildings', () => {
    const { w, hub, sfx, watcher } = setup();
    placed(w.place('belt', hub.x - 3, hub.y, 0));
    placed(w.place('furnace', hub.x - 8, hub.y, 0));
    const turret = placed(w.place('turret', hub.x + 7, hub.y, 0));
    watcher.update(w);
    expect(sfx.names()).toEqual(['belt', 'place_big', 'place']);

    sfx.played = [];
    w.demolish(turret.id);
    watcher.update(w);
    expect(sfx.names()).toEqual(['demolish']);

    sfx.played = [];
    const t2 = placed(w.place('turret', hub.x + 7, hub.y, 0));
    watcher.update(w);
    t2.hp = 0;
    w.tick(TICK);
    watcher.update(w);
    expect(sfx.names()).toEqual(['place', 'destroyed']);
  });

  it('a tesla zaps once per shot, however far its arc jumps; a line upgrade sounds once', () => {
    const { w, hub, sfx, watcher } = setup();
    w.state.ship.blueprints = ['express_belt', 'tesla'];
    const t = placed(w.place('tesla', hub.x + 7, hub.y, 0));
    const n = addNest(w, 0, 0);
    for (let i = 0; i < 3; i++) {
      const e = w.spawnBug('crawler', n, 1);
      e.x = t.x + 3.5 + i * 1.5;
      e.y = t.y + 0.5;
      e.hp = 1000;
    }
    watcher.update(w);
    sfx.played = [];
    w.tick(TICK);
    watcher.update(w);
    expect(sfx.names().filter((s) => s === 'zap')).toEqual(['zap']);
    expect(sfx.names()).not.toContain('shot');

    for (let i = 0; i < 4; i++) placed(w.place('belt', hub.x - 6 + i, hub.y - 3, 0));
    watcher.update(w);
    sfx.played = [];
    w.upgradeBeltLine(hub.x - 6, hub.y - 3);
    watcher.update(w);
    expect(sfx.names()).toEqual(['place']);
  });

  it('machines working on screen hum, louder the more there are; off screen or paused, they go quiet', () => {
    const { w, hub, sfx, watcher } = setup();
    watcher.update(w);
    expect(sfx.hum).toBe(0);
    for (let i = 0; i < 3; i++) {
      const f = placed(w.place('furnace', hub.x - 6, hub.y - 6 + i * 3, 0));
      f.recipe = 'iron_plate';
      f.inputs = { iron_ore: 3 };
    }
    w.tick(TICK);
    watcher.update(w);
    expect(sfx.hum).toBeCloseTo(0.5);
    watcher.update(w, false);
    expect(sfx.hum).toBe(0);
    // Far off screen: silent.
    const far = setup();
    const f = placed(far.w.place('furnace', 10, 10, 0));
    f.recipe = 'iron_plate';
    f.inputs = { iron_ore: 3 };
    far.w.tick(TICK);
    far.watcher.update(far.w);
    expect(far.sfx.hum).toBe(0);
  });

  it('a lumber camp chops each tree it cuts', () => {
    const { w, hub, sfx, watcher } = setup();
    w.state.trees[w.idx(hub.x - 6, hub.y)] = TREE;
    placed(w.place('lumber_camp', hub.x - 5, hub.y, 0));
    watcher.update(w);
    sfx.played = [];
    for (let t = 0; t < LUMBER.period + 0.1; t += TICK) w.tick(TICK);
    watcher.update(w);
    watcher.update(w);
    expect(sfx.names()).toEqual(['chop']);
  });

  it('shots, kills, research, and a provoked nest heard from far away', () => {
    const { w, hub, sfx, watcher } = setup();
    const n = addNest(w, Math.floor((hub.x - 20) / NESTS.cell) * NESTS.cell, Math.floor(hub.y / NESTS.cell) * NESTS.cell);
    const bug = w.spawnBug('crawler', n, 1);
    bug.x = hub.x + 2.5;
    bug.y = hub.y - 3; // in reach of the hub gun
    watcher.update(w);
    sfx.played = [];
    for (let i = 0; i < 200 && w.state.enemies.length; i++) {
      w.tick(TICK);
      watcher.update(w);
    }
    expect(sfx.names()).toContain('hub_shot');
    expect(sfx.names()).toContain('death');
    expect(sfx.names()).toContain('provoked'); // shooting a bug provokes its nest

    // A nest far off screen is still heard, quietly.
    sfx.played = [];
    const far = addNest(w, 0, 0);
    watcher.update(w);
    far.angryUntil = w.state.time + 60;
    watcher.update(w);
    expect(sfx.played).toEqual([{ sound: 'provoked', gain: 0.35 }]);

    sfx.played = [];
    w.state.researched.push('masonry');
    watcher.update(w);
    expect(sfx.names()).toEqual(['research']);

    sfx.played = [];
    w.state.ship.runs++; // a supply run delivered
    watcher.update(w);
    expect(sfx.names()).toEqual(['research']);
  });

  it('fights far off screen are silent', () => {
    const { w, sfx, watcher } = setup();
    placed(w.place('turret', 10, 10, 0));
    watcher.update(w);
    expect(sfx.played).toEqual([{ sound: 'place', gain: 0 }]);
  });
});
