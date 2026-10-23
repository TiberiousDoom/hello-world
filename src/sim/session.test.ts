import { describe, expect, it } from 'vitest';
import { Command } from './commands';
import { fightingWorld, play, runScenario, script } from './scenario';
import { Session, summaryHash } from './session';
import { World } from './world';

describe('Sessions', () => {
  it('replay exactly from their starting snapshot and command log', () => {
    const { w, cx, cy } = fightingWorld();
    const live = new Session(w);
    play(live, script(cx, cy), 1200);
    expect(live.world.state.enemies.length).toBeGreaterThan(0); // there was a fight to replay
    expect(live.log.length).toBe(script(cx, cy).length);

    const again = Session.replay(live.start, live.log, live.ticks);
    expect(summaryHash(again.world)).toBe(summaryHash(live.world));
    expect(again.world.toJSON()).toBe(live.world.toJSON());
  });

  it('let a game join from a checkpointed snapshot and stay in step', () => {
    const { w, cx, cy } = fightingWorld(11);
    const host = new Session(w);
    play(host, script(cx, cy).slice(0, 6), 600);
    host.do({ kind: 'checkpoint' });
    const joiner = new Session(World.fromJSON(host.world.toJSON()));

    const later: [number, Command][] = [
      [650, { kind: 'place', type: 'wall', x: cx + 4, y: cy + 3, dir: 0, replaceBelt: false }],
      [700, { kind: 'demolish', id: host.world.state.buildings.find((b) => b.type === 'palisade')?.id ?? 0 }],
      [820, { kind: 'place', type: 'turret', x: cx - 4, y: cy - 3, dir: 1, replaceBelt: false }],
    ];
    for (let t = 600; t < 1200; t++) {
      for (const [tick, c] of later) {
        if (tick === t) {
          host.do(c);
          joiner.do(c);
        }
      }
      host.tick();
      joiner.tick();
      if (t % 20 === 0) expect(summaryHash(joiner.world), `tick ${t}`).toBe(summaryHash(host.world));
    }
    expect(joiner.world.toJSON()).toBe(host.world.toJSON());
  });

  it('summaries differ when the games do', () => {
    const a = World.create(3);
    const b = World.fromJSON(a.toJSON());
    expect(summaryHash(b)).toBe(summaryHash(a));
    b.state.enemies[0].x += 1e-9;
    expect(summaryHash(b)).not.toBe(summaryHash(a));
  });
});

describe('The interface', () => {
  // Co-op only works if every change to the world is a command (D-058).
  it('changes the world only through commands', () => {
    // World methods that change it (not the interface's own methods of the same name, called on `this`).
    const changes = /(?<!\bthis)\.(place|demolish|rotate|setRecipe|setFilter|startResearch|pauseResearch|researchNow|upgradeBeltLine|mineByHand|collect|dropOff|moveTo|walk|setSplitterSide|checkpoint|tick)\(|\b(launch|pickBlueprint|insertShip|applyCommand)\(/;
    // The interface's sources as text (main.ts may: it owns the session and the main menu's demo world).
    const sources = import.meta.glob<string>(['../ui/*.ts', '../input/*.ts', '!**/*.test.ts'], { query: '?raw', import: 'default', eager: true });
    expect(Object.keys(sources).length).toBeGreaterThan(4);
    for (const [file, text] of Object.entries(sources)) {
      text.split('\n').forEach((line, i) => expect(changes.test(line) ? `${file}:${i + 1}: ${line.trim()}` : null).toBeNull());
    }
  });
});

describe('The determinism scenario', () => {
  it('gives the same game every time it runs', () => {
    expect(runScenario(7, 400)).toEqual(runScenario(7, 400));
  });
});
