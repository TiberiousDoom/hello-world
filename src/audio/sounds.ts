// Turns what happened in the game since the last frame into sound effects,
// the way the renderer turns it into visual effects. Sounds on screen play at
// full volume and fade out beyond its edges, so a fight across the map stays quiet.

import { Camera } from '../render/camera';
import { BUILDINGS, HUB_SIZE } from '../sim/data';
import { isAngry, nestCentre } from '../sim/nests';
import { Shot, World } from '../sim/world';
import { PlayOptions, Sfx, Sound } from './sfx';

/** How far past the screen's edge (as a fraction of half the screen) a sound fades to nothing. */
const FADE_BEYOND = 0.6;
/** Warnings (a nest provoked) can be heard from anywhere, at least this loud. */
const WARNING_MIN = 0.35;

export class SoundWatcher {
  private world: World | null = null;
  private buildings = new Map<number, { type: string; x: number; y: number }>();
  private enemies = new Map<number, { x: number; y: number }>();
  private seenShots = new WeakSet<Shot>();
  private seenFelled = new WeakSet<object>();
  private angry = new Set<number>();
  private breaches = 0;
  private hubHp = 0;
  private researched = 0;
  private stage = 0;
  private launching = false;
  private gameOver = false;

  constructor(
    private sfx: Sfx,
    private camera: Camera,
  ) {}

  update(world: World): void {
    if (world !== this.world) {
      this.reset(world);
      return;
    }
    const s = world.state;
    const hub = world.hub;

    // Buildings placed, demolished or lost to bugs.
    const lost = new Set(world.lost.map((l) => l.id));
    const now = new Set<number>();
    for (const b of s.buildings) {
      now.add(b.id);
      if (this.buildings.has(b.id)) continue;
      this.buildings.set(b.id, { type: b.type, x: b.x, y: b.y });
      const [w, h] = BUILDINGS[b.type].size ?? [1, 1];
      const sound: Sound = b.type === 'belt' ? 'belt' : w * h >= 4 ? 'place_big' : 'place';
      this.play(sound, b.x + w / 2, b.y + h / 2);
    }
    for (const [id, b] of this.buildings) {
      if (now.has(id)) continue;
      this.buildings.delete(id);
      this.play(lost.has(id) ? 'destroyed' : 'demolish', b.x + 0.5, b.y + 0.5);
    }

    // Shots: turrets, cannons and the hub gun.
    for (const sh of world.shots) {
      if (this.seenShots.has(sh)) continue;
      this.seenShots.add(sh);
      const from = world.buildingAt(Math.floor(sh.x1), Math.floor(sh.y1));
      this.play(from?.type === 'hub' ? 'hub_shot' : sh.splash ? 'cannon' : 'shot', sh.x1, sh.y1);
    }

    // Trees cut by Lumber Camps.
    for (const f of world.felled) {
      if (this.seenFelled.has(f)) continue;
      this.seenFelled.add(f);
      this.play('chop', f.x + 0.5, f.y + 0.5);
    }

    // Bugs killed (but not the ones sent home by a breach).
    const breached = s.breaches > this.breaches;
    const alive = new Set<number>();
    for (const e of s.enemies) {
      alive.add(e.id);
      this.enemies.set(e.id, { x: e.x, y: e.y });
    }
    for (const [id, e] of this.enemies) {
      if (alive.has(id)) continue;
      this.enemies.delete(id);
      if (!breached) this.play('death', e.x, e.y);
    }

    // The hub: hit, breached or destroyed.
    const hubX = hub ? hub.x + HUB_SIZE / 2 : 0;
    const hubY = hub ? hub.y + HUB_SIZE / 2 : 0;
    if (breached || (s.gameOver && !this.gameOver)) this.sfx.play('breach');
    else if (hub && hub.hp < this.hubHp - 0.5) this.play('hub_hit', hubX, hubY);
    this.breaches = s.breaches;
    this.gameOver = s.gameOver;
    this.hubHp = hub?.hp ?? 0;

    // Nests provoked: a warning, heard from anywhere.
    for (const n of s.nests) {
      const angry = isAngry(world, n);
      if (angry && !this.angry.has(n.id)) {
        const [x, y] = nestCentre(n);
        const o = this.spot(x, y);
        this.sfx.play('provoked', { gain: Math.max(WARNING_MIN, o.gain ?? 0), pan: o.pan });
      }
      if (angry) this.angry.add(n.id);
      else this.angry.delete(n.id);
    }

    // Milestones.
    if (s.researched.length > this.researched) this.sfx.play('research');
    this.researched = s.researched.length;
    if (s.ship.stage > this.stage) this.sfx.play('stage');
    this.stage = s.ship.stage;
    const launching = s.ship.launchAt != null;
    if (launching && !this.launching) this.sfx.play('launch');
    this.launching = launching;
  }

  /** Takes in a world's current state without playing anything (a new or loaded game). */
  private reset(world: World): void {
    this.world = world;
    const s = world.state;
    this.buildings = new Map(s.buildings.map((b) => [b.id, { type: b.type, x: b.x, y: b.y }]));
    this.enemies = new Map(s.enemies.map((e) => [e.id, { x: e.x, y: e.y }]));
    for (const sh of world.shots) this.seenShots.add(sh);
    for (const f of world.felled) this.seenFelled.add(f);
    this.angry = new Set(s.nests.filter((n) => isAngry(world, n)).map((n) => n.id));
    this.breaches = s.breaches;
    this.hubHp = world.hub?.hp ?? 0;
    this.researched = s.researched.length;
    this.stage = s.ship.stage;
    this.launching = s.ship.launchAt != null;
    this.gameOver = s.gameOver;
  }

  private play(sound: Sound, x: number, y: number): void {
    this.sfx.play(sound, this.spot(x, y));
  }

  /** Volume and stereo position for a sound at world tile (x, y). */
  private spot(x: number, y: number): PlayOptions {
    const c = this.camera;
    const halfW = Math.max(1, c.width / 2 / c.zoom);
    const halfH = Math.max(1, c.height / 2 / c.zoom);
    const dx = (x - c.x) / halfW;
    const dy = (y - c.y) / halfH;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    const gain = d <= 1 ? 1 : Math.max(0, 1 - (d - 1) / FADE_BEYOND);
    return { gain, pan: Math.max(-1, Math.min(1, dx)) * 0.6 };
  }
}
