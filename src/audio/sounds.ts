// Turns what happened in the game since the last frame into sound effects,
// the way the renderer turns it into visual effects. Sounds on screen play at
// full volume and fade out beyond its edges, so a fight across the map stays quiet.

import { Camera } from '../render/camera';
import { BUILDINGS, HUB_SIZE, isBelt, isMachine } from '../sim/data';
import { isAngry, nestCentre } from '../sim/nests';
import { Shot, World } from '../sim/world';
import { PlayOptions, Sfx, Sound } from './sfx';

/** How far past the screen's edge (as a fraction of half the screen) a sound fades to nothing. */
const FADE_BEYOND = 0.6;
/** Warnings (a nest provoked) can be heard from anywhere, at least this loud. */
const WARNING_MIN = 0.35;
/** This many working machines on screen make the machine hum as loud as it gets. */
const HUM_FULL = 6;

export class SoundWatcher {
  private world: World | null = null;
  private buildings = new Map<number, { type: string; x: number; y: number }>();
  private enemies = new Map<number, { x: number; y: number }>();
  private seenShots = new WeakSet<Shot>();
  private seenFelled = new WeakSet<object>();
  private seenTaps = new WeakSet<object>();
  private angry = new Set<number>();
  private breaches = 0;
  private hubHp = 0;
  private playerHp = new Map<number, number>();
  private researched = 0;
  private stage = 0;
  private runs = 0;
  private launching = false;
  private gameOver = false;

  constructor(
    private sfx: Sfx,
    private camera: Camera,
  ) {}

  /** `running`: false while the game is paused, which silences the machine hum. */
  update(world: World, running = true): void {
    if (world !== this.world) {
      this.reset(world);
      return;
    }
    const s = world.state;
    const hub = world.hub;

    // Buildings placed, upgraded, demolished or lost to bugs.
    const lost = new Set(world.lost.map((l) => l.id));
    let upgraded: { x: number; y: number } | undefined;
    const now = new Set<number>();
    for (const b of s.buildings) {
      now.add(b.id);
      const known = this.buildings.get(b.id);
      if (known && known.type !== b.type) {
        // Upgraded in place (a belt line to express): one click per belt would be noise, so play once.
        known.type = b.type;
        upgraded = upgraded ?? b;
      }
      if (known) continue;
      this.buildings.set(b.id, { type: b.type, x: b.x, y: b.y });
      const [w, h] = BUILDINGS[b.type].size ?? [1, 1];
      const sound: Sound = isBelt(b.type) ? 'belt' : w * h >= 4 ? 'place_big' : 'place';
      this.play(sound, b.x + w / 2, b.y + h / 2);
    }
    if (upgraded) this.play('place', upgraded.x + 0.5, upgraded.y + 0.5);
    for (const [id, b] of this.buildings) {
      if (now.has(id)) continue;
      this.buildings.delete(id);
      this.play(lost.has(id) ? 'destroyed' : 'demolish', b.x + 0.5, b.y + 0.5);
    }

    // Shots: turrets, cannons and the hub gun.
    for (const sh of world.shots) {
      if (this.seenShots.has(sh)) continue;
      this.seenShots.add(sh);
      if (sh.jump) continue; // part of a tesla's arc, already heard
      const from = world.buildingAt(Math.floor(sh.x1), Math.floor(sh.y1));
      this.play(from?.type === 'hub' ? 'hub_shot' : from?.type === 'ballista' ? 'twang' : sh.arc ? 'zap' : sh.splash ? 'cannon' : 'shot', sh.x1, sh.y1);
    }

    // Trees cut by Lumber Camps.
    for (const f of world.felled) {
      if (this.seenFelled.has(f)) continue;
      this.seenFelled.add(f);
      this.play('chop', f.x + 0.5, f.y + 0.5);
    }

    // Mining by hand (#38).
    for (const tap of world.taps) {
      if (this.seenTaps.has(tap)) continue;
      this.seenTaps.add(tap);
      // A tree chopped by hand (D-093) chops on each tap; its fall is heard with the felled trees above.
      if (tap.ore === 'log') {
        if (!tap.item) this.play('chop', tap.x + 0.5, tap.y + 0.5);
      } else this.play(tap.item ? 'pick_done' : 'pick', tap.x + 0.5, tap.y + 0.5);
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
    // The engineer bitten (D-074): a hit sound for every few points of health lost, as bites come in small bits.
    for (const p of s.players) {
      const last = this.playerHp.get(p.id) ?? p.hp;
      if (p.hp < last - 4) this.play('hub_hit', p.x, p.y);
      if (p.hp < last - 4 || p.hp > last) this.playerHp.set(p.id, p.hp);
    }

    // Nests provoked, or sending a night raid: a warning, heard from anywhere.
    const raiding = new Set(s.enemies.filter((e) => e.raid).map((e) => e.nest));
    for (const n of s.nests) {
      const angry = isAngry(world, n) || raiding.has(n.id);
      if (angry && !this.angry.has(n.id)) {
        const [x, y] = nestCentre(n);
        const o = this.spot(x, y);
        this.sfx.play('provoked', { gain: Math.max(WARNING_MIN, o.gain ?? 0), pan: o.pan });
      }
      if (angry) this.angry.add(n.id);
      else this.angry.delete(n.id);
    }

    // The machine hum: louder the more machines are working on (or near) the screen.
    let busy = 0;
    for (const b of s.buildings) {
      if (b.progress < 0 || !(isMachine(b.type) || b.type === 'extractor' || b.type === 'lumber_camp')) continue;
      const [w, h] = world.footprintOf(b);
      busy += this.spot(b.x + w / 2, b.y + h / 2).gain ?? 1;
    }
    this.sfx.setHum(running ? Math.min(1, busy / HUM_FULL) : 0);

    // Milestones.
    if (s.researched.length > this.researched) this.sfx.play('research');
    this.researched = s.researched.length;
    if (s.ship.stage > this.stage) this.sfx.play('stage');
    this.stage = s.ship.stage;
    if (s.ship.runs > this.runs) this.sfx.play('research');
    this.runs = s.ship.runs;
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
    for (const tap of world.taps) this.seenTaps.add(tap);
    this.angry = new Set([...s.nests.filter((n) => isAngry(world, n)).map((n) => n.id), ...s.enemies.filter((e) => e.raid).map((e) => e.nest)]);
    this.breaches = s.breaches;
    this.hubHp = world.hub?.hp ?? 0;
    this.playerHp = new Map(s.players.map((p) => [p.id, p.hp]));
    this.researched = s.researched.length;
    this.stage = s.ship.stage;
    this.runs = s.ship.runs;
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
