// A short, scripted game with a fight in it: building, demolishing and turning
// things while angry bugs chew through them. Unit tests replay it, and browser
// tests run it in Chromium, Firefox and WebKit to check every browser computes
// exactly the same game (co-op phase 0, D-058).

import { Command } from './commands';
import { RESEARCH } from './data';
import { nestCentre } from './nests';
import { Session, hashText, summaryHash } from './session';
import { World } from './world';

/** A real map, nearly everything researched, plenty of stock, and the nearest nest angry for a long while. */
export function fightingWorld(seed = 7): { w: World; cx: number; cy: number } {
  const w = World.create(seed);
  w.state.researched = RESEARCH.map((r) => r.id).filter((id) => id !== 'assembly');
  w.state.inventory = { iron_plate: 9999, stone: 9999, iron_ore: 9999, brick: 9999, copper_ingot: 9999, gear: 9999, wire: 9999, motor: 9999, plank: 9999, rivet: 9999, iron_rod: 9999 };
  const hub = w.hub!;
  const n = w.state.nests.slice().sort((a, b) => Math.abs(a.x - hub.x) + Math.abs(a.y - hub.y) - (Math.abs(b.x - hub.x) + Math.abs(b.y - hub.y)))[0];
  n.angryUntil = 1e9;
  w.markFlowDirty();
  // A spot between the nest and the hub, inside the bugs' reach.
  const [nx, ny] = nestCentre(n);
  const cx = Math.round(nx + (hub.x - nx) * 0.35);
  const cy = Math.round(ny + (hub.y - ny) * 0.35);
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) w.state.resources[w.idx(x, y)] = w.state.trees[w.idx(x, y)] = 0;
  return { w, cx, cy };
}

/** Some building, demolishing and turning, at set ticks: what a player might do during a fight. */
export function script(cx: number, cy: number): [number, Command][] {
  return [
    [0, { kind: 'place', type: 'wall', x: cx - 2, y: cy, dir: 0, replaceBelt: false }],
    [0, { kind: 'place', type: 'wall', x: cx - 1, y: cy, dir: 0, replaceBelt: false }],
    [0, { kind: 'place', type: 'turret', x: cx + 1, y: cy, dir: 0, replaceBelt: false }],
    [0, { kind: 'place', type: 'well', x: cx + 2, y: cy, dir: 0, replaceBelt: false }], // the turret's power (D-117)
    [40, { kind: 'research', id: 'assembly' }],
    [100, { kind: 'place', type: 'palisade', x: cx, y: cy - 2, dir: 0, replaceBelt: false }],
    [130, { kind: 'rotate', id: -1, dir: 2 }], // the turret, by id once known
    [200, { kind: 'place', type: 'belt', x: cx + 2, y: cy + 2, dir: 1, replaceBelt: false }],
    [260, { kind: 'pause-research' }],
    [300, { kind: 'place', type: 'repair', x: cx + 3, y: cy - 1, dir: 0, replaceBelt: false }],
    [420, { kind: 'demolish', id: -1 }],
    [500, { kind: 'place', type: 'wall', x: cx - 3, y: cy + 1, dir: 0, replaceBelt: false }],
  ];
}

/** Runs `session` to `end`, issuing the script's commands on their ticks (id -1: the turret). */
export function play(session: Session, steps: [number, Command][], end: number): void {
  for (const [tick, command] of steps) {
    session.runTo(tick);
    const turret = session.world.state.buildings.find((b) => b.type === 'turret');
    const c: Command = (command.kind === 'rotate' || command.kind === 'demolish') && command.id === -1 ? { ...command, id: turret?.id ?? 0 } : command;
    session.do(c);
  }
  session.runTo(end);
}

/** Runs the scripted game and fingerprints the result: the summary, and the whole saved game. */
export function runScenario(seed = 7, ticks = 1200): { summary: string; full: string } {
  const { w, cx, cy } = fightingWorld(seed);
  const s = new Session(w);
  play(s, script(cx, cy), ticks);
  return { summary: summaryHash(s.world), full: hashText(s.world.toJSON()) };
}
