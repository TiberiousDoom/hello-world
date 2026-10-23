// One game being played: its world, the commands issued so far, and the clock
// that runs its ticks (co-op phase 0, D-058). The log plus the starting snapshot
// replays the game exactly, which is what lets co-op games stay in step.

import { Command, ResultOf, applyCommand } from './commands';
import { TICK, World } from './world';

export interface LoggedCommand {
  /** Ticks run before it applies. */
  tick: number;
  player: number;
  command: Command;
}

export class Session {
  /** The game as it was when the session began: replaying the log from here gives the same game. */
  readonly start: string;
  readonly log: LoggedCommand[] = [];
  /** Commands waiting for their tick (from a replay now; from other players in co-op). */
  private queued: LoggedCommand[] = [];

  constructor(
    readonly world: World,
    readonly player = 0,
  ) {
    // Rebuild the path fields first, so a game loaded from `start` (which rebuilds them) matches this one.
    world.checkpoint();
    this.start = world.toJSON();
  }

  /** Ticks run so far. */
  get ticks(): number {
    return Math.round(this.world.state.time / TICK);
  }

  /** This player's action: applied at once, and logged for the tick it lands before. */
  do<C extends Command>(command: C): ResultOf<C> {
    this.log.push({ tick: this.ticks, player: this.player, command });
    return applyCommand(this.world, command);
  }

  /** Commands to apply when their tick comes. */
  queue(entries: readonly LoggedCommand[]): void {
    this.queued.push(...entries);
    this.queued.sort((a, b) => a.tick - b.tick || a.player - b.player); // stable: same-tick commands keep their order
  }

  /** Runs one tick, applying the queued commands due on it first. */
  tick(): void {
    const now = this.ticks;
    while (this.queued.length && this.queued[0].tick <= now) {
      const e = this.queued.shift()!;
      this.log.push(e);
      applyCommand(this.world, e.command);
    }
    this.world.tick(TICK);
  }

  /** Runs ticks until `tick` ticks have run. */
  runTo(tick: number): void {
    while (this.ticks < tick) this.tick();
  }

  /** A game rebuilt from a starting snapshot and its log, run up to `tick`. */
  static replay(start: string, log: readonly LoggedCommand[], tick: number): Session {
    const s = new Session(World.fromJSON(start));
    s.queue(log);
    s.runTo(tick);
    return s;
  }
}

/**
 * A cheap fingerprint of the parts of a game that drift first when two games disagree: time, the
 * random-number state, ids, stock, research, every building and every bug. Co-op games compare it
 * about once a second; two games with the same summary are, in practice, the same game.
 */
export function summaryHash(w: World): string {
  const s = w.state;
  const h = new Fnv();
  h.num(s.time).num(s.rng).num(s.nextId).num(s.breaches);
  for (const k of Object.keys(s.inventory).sort()) h.str(k).num(s.inventory[k as keyof typeof s.inventory] ?? 0);
  h.str(s.research.active ?? '').num(s.research.budget);
  for (const b of s.buildings) {
    h.num(b.id).str(b.type).num(b.x).num(b.y).num(b.dir).num(b.hp).num(b.progress).num(b.ammo).num(b.belt.length);
  }
  for (const e of s.enemies) h.num(e.id).num(e.x).num(e.y).num(e.hp);
  for (const n of s.nests) h.num(n.angryUntil);
  h.num(s.ship.stage).num(s.ship.runs).num(s.ship.launchAt ?? -1);
  return h.hex();
}

/** A fingerprint of some text, such as a whole saved game. */
export function hashText(text: string): string {
  return new Fnv().str(text).hex();
}

/** 32-bit FNV-1a over the exact bits of each number. */
class Fnv {
  private h = 0x811c9dc5;
  private f = new Float64Array(1);
  private u = new Uint32Array(this.f.buffer);

  num(x: number): this {
    this.f[0] = x;
    return this.word(this.u[0]).word(this.u[1]);
  }

  str(t: string): this {
    for (let i = 0; i < t.length; i++) this.word(t.charCodeAt(i));
    return this.word(0);
  }

  hex(): string {
    return (this.h >>> 0).toString(16).padStart(8, '0');
  }

  private word(w: number): this {
    for (let i = 0; i < 4; i++) {
      this.h ^= (w >>> (i * 8)) & 0xff;
      this.h = Math.imul(this.h, 0x01000193);
    }
    return this;
  }
}
