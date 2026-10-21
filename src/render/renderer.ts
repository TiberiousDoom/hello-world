// Canvas 2D renderer. It draws sprites from src/art (falling back to plain
// shapes if one is missing) and only reads the simulation, so a 3D renderer
// can replace it later behind the same draw() call.

import { sprite } from '../art';
import { auditSweep, isContraband } from '../sim/blackmarket';
import {
  BELT_SPEED,
  BLACK_MARKET,
  BUILDINGS,
  BuildingType,
  DX,
  DY,
  Dir,
  ENEMIES,
  EnemyType,
  HUB_SIZE,
  HUB_WEAPON,
  ITEMS,
  ItemId,
  RECIPE_BY_ID,
  REPAIR,
  RESOURCE_ITEMS,
  TURRETS,
  WAVE_WARNING,
  isMachine,
} from '../sim/data';
import { Building, Shot, World } from '../sim/world';
import { Plan, UIState, planDirs } from '../ui/state';
import { planStatus } from '../ui/plan';
import { BeltLook, beltLook } from './belts';
import { Camera } from './camera';

const RESOURCE_NODES = ['', 'terrain/node_iron', 'terrain/node_copper', 'terrain/node_stone'];
const RESOURCE_COLORS = ['', '#5a4232', '#1f6e5c', '#6e6b64'];
/** Enemy sprites are drawn larger than their hit radius so legs show. */
const ENEMY_SPRITE_SCALE = 4.2;
const ENEMY_SPRITE_MAX = 1.35; // tiles
// Belt colours, matching the belt sprite.
const BELT_SURFACE = '#20242d';
const BELT_RAIL = '#5a6478';
const BELT_SLAT = 'rgba(138,150,168,0.5)';

interface Effect {
  kind: 'puff' | 'blast' | 'shockwave';
  x: number;
  y: number;
  r: number;
  born: number; // ms
  life: number; // ms
  color: string;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private groundPattern: CanvasPattern | null = null;
  /** Turret aim angles, from their most recent shot. */
  private aims = new Map<number, number>();
  private seenShots = new WeakSet<Shot>();
  /** Last known enemy positions and headings, to face sprites and place death puffs. */
  private enemies = new Map<number, { x: number; y: number; angle: number; type: EnemyType }>();
  private effects: Effect[] = [];
  private breaches = -1;
  private world: World | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.camera.width = w;
    this.camera.height = h;
  }

  draw(world: World, ui: UIState | null, now: number): void {
    // iOS Safari can change the visible area (toolbars, opening from another app)
    // without a resize event, which left the picture stretched. Check every frame.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.clientWidth !== this.camera.width || this.canvas.clientHeight !== this.camera.height || dpr !== this.dpr) {
      this.resize();
    }
    if (world !== this.world) {
      // A different game: forget per-game animation state.
      this.world = world;
      this.aims.clear();
      this.enemies.clear();
      this.effects = [];
      this.breaches = world.state.breaches;
    }
    const { ctx, camera } = this;
    const z = camera.zoom;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, camera.width, camera.height);

    // World transform: 1 unit = 1 tile.
    const [ox, oy] = camera.toScreen(0, 0);
    ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * ox, this.dpr * oy);

    const s = world.state;
    const [x0f, y0f] = camera.toWorld(0, 0);
    const [x1f, y1f] = camera.toWorld(camera.width, camera.height);
    const x0 = Math.max(0, Math.floor(x0f) - 1);
    const y0 = Math.max(0, Math.floor(y0f) - 1);
    const x1 = Math.min(s.width - 1, Math.ceil(x1f) + 1);
    const y1 = Math.min(s.height - 1, Math.ceil(y1f) + 1);
    const visible = (x: number, y: number, size = 1) => x + size >= x0 && y + size >= y0 && x <= x1 && y <= y1;

    this.trackEffects(world, now);

    // Ground and resources.
    this.drawGround(s.width, s.height);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const r = s.resources[world.idx(x, y)];
        if (r) this.drawNode(r, x, y);
      }
    }
    ctx.strokeStyle = '#3a4a68';
    ctx.lineWidth = 2 / z;
    ctx.strokeRect(0, 0, s.width, s.height);

    // Paired tunnels: a faint dotted line where the belt runs underground.
    for (const b of s.buildings) {
      if (b.type !== 'tunnel' || b.link == null || world.isTunnelExit(b)) continue;
      const exit = world.byId.get(b.link);
      if (exit && (visible(b.x, b.y) || visible(exit.x, exit.y))) this.drawTunnelTrace(b, exit, z);
    }
    // Belts first so everything else sits on top, then the flanges where belts meet buildings.
    const belts = s.buildings.filter((b) => b.type === 'belt' && visible(b.x, b.y));
    const looks = belts.map((b) => beltLook(world, b));
    belts.forEach((b, i) => this.drawBelt(b, looks[i], now, z));
    for (const b of s.buildings) {
      if (b.type === 'belt') continue;
      const size = b.type === 'hub' ? HUB_SIZE : 1;
      if (visible(b.x, b.y, size)) this.drawBuilding(world, b, now, z);
    }
    belts.forEach((b, i) => this.drawJoins(world, b, looks[i], z));

    // Spawn warnings: pulsing rings with a warning sign.
    if (s.nextWaveAt - s.time <= WAVE_WARNING) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 150);
      for (const p of s.nextSpawnPoints) this.drawSpawnMarker(p.x + 0.5, p.y + 0.5, pulse, z);
    }

    for (const e of s.enemies) {
      if (!visible(e.x - 1, e.y - 1, 2)) continue;
      const def = ENEMIES[e.type];
      const angle = this.enemies.get(e.id)?.angle ?? 0;
      // A small bob so they look alive.
      const bob = 1 + 0.06 * Math.sin(now / 90 + e.id);
      const size = Math.min(ENEMY_SPRITE_MAX, def.radius * ENEMY_SPRITE_SCALE) * bob;
      if (!this.drawSprite(`enemies/${e.type}`, e.x - size / 2, e.y - size / 2, size, angle)) {
        ctx.fillStyle = def.color;
        dot(ctx, e.x, e.y, def.radius);
      }
      if (e.hp < e.maxHp) bar(ctx, e.x - 0.3, e.y - def.radius - 0.22, 0.6, e.hp / e.maxHp, '#e0445a');
    }

    this.drawShots(world, now, z);
    this.drawEffects(now, z);
    this.drawAudit(world, now, z, ui);

    if (!ui) return;
    const sel = ui.selected != null ? world.byId.get(ui.selected) : undefined;
    if (sel) {
      const size = sel.type === 'hub' ? HUB_SIZE : 1;
      ctx.strokeStyle = '#3fa9f5';
      ctx.lineWidth = 3 / z;
      roundRect(ctx, sel.x - 0.04, sel.y - 0.04, size + 0.08, size + 0.08, 0.12);
      ctx.stroke();
      const range = TURRETS[sel.type]?.range ?? (sel.type === 'repair' ? REPAIR.range : sel.type === 'hub' ? HUB_WEAPON.range : 0);
      if (range) rangeCircle(ctx, sel.x + size / 2, sel.y + size / 2, range, z);
      const partner = sel.link != null ? world.byId.get(sel.link) : undefined;
      if (partner) linkLine(ctx, sel, partner, z);
    }
    if (ui.plan) this.drawPlan(world, ui.plan, ui.dir, z);
    else if (ui.hover && ui.tool) this.drawGhost(world, ui.tool, ui.hover.x, ui.hover.y, ui.dir, z);
  }

  /** A blueprint waiting for ✓: dashed ghosts, red where a tile can't be built. Occupied tiles are skipped. */
  private drawPlan(world: World, plan: Plan, dir: Dir, z: number): void {
    const status = planStatus(world, plan);
    const dirs = planDirs(plan, dir);
    const single = plan.tiles.length === 1;
    plan.tiles.forEach((t, i) => {
      if (status[i] === 'occupied') return;
      this.drawGhost(world, plan.tool, t.x, t.y, dirs[i], z, { ok: status[i] === null, range: single, dashed: true });
    });
  }

  // ------------------------------------------------------------- sprites

  /** Draws a sprite into a square, rotated about its centre. Returns false if it isn't loaded. */
  private drawSprite(key: string, x: number, y: number, size: number, angle = 0): boolean {
    const img = sprite(key);
    if (!img) return false;
    const ctx = this.ctx;
    if (angle) {
      ctx.save();
      ctx.translate(x + size / 2, y + size / 2);
      ctx.rotate(angle);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, size, size);
    }
    return true;
  }

  private drawItem(item: ItemId, cx: number, cy: number, size: number): void {
    if (!this.drawSprite(`items/${item}`, cx - size / 2, cy - size / 2, size)) {
      this.ctx.fillStyle = ITEMS[item].color;
      dot(this.ctx, cx, cy, size * 0.4);
    }
  }

  private drawGround(w: number, h: number): void {
    const ctx = this.ctx;
    const img = sprite('terrain/ground');
    if (img && !this.groundPattern) {
      this.groundPattern = ctx.createPattern(img, 'repeat');
      this.groundPattern?.setTransform(new DOMMatrix().scale(1 / img.width));
    }
    ctx.fillStyle = this.groundPattern ?? '#1a1d23';
    ctx.fillRect(0, 0, w, h);
  }

  private drawNode(kind: number, x: number, y: number): void {
    // Rotate each node by a fixed per-tile amount so clusters don't look stamped.
    const turn = ((x * 7 + y * 13) % 4) * (Math.PI / 2);
    if (this.drawSprite(RESOURCE_NODES[kind], x, y, 1, turn)) return;
    const ctx = this.ctx;
    ctx.fillStyle = RESOURCE_COLORS[kind];
    ctx.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
    ctx.fillStyle = ITEMS[RESOURCE_ITEMS[kind]!].color;
    dot(ctx, x + 0.5, y + 0.5, 0.12);
  }

  // ----------------------------------------------------------- buildings

  private drawBelt(b: Building, look: BeltLook, now: number, z: number): void {
    if (look.curved) return this.drawCurvedBelt(b, look.from, now, z);
    const ctx = this.ctx;
    const angle = (b.dir * Math.PI) / 2;
    if (!this.drawSprite('buildings/belt', b.x, b.y, 1, angle)) {
      ctx.fillStyle = BELT_SURFACE;
      ctx.fillRect(b.x, b.y + 0.06, 1, 0.88);
    }
    const dx = DX[b.dir];
    const dy = DY[b.dir];
    // Along the belt (u) and across it (v), from the tile's centre.
    const at = (u: number, v: number): [number, number] => [b.x + 0.5 + dx * u - dy * v, b.y + 0.5 + dy * u + dx * v];
    // Moving chevrons show the direction of travel.
    const phase = ((now / 1000) * BELT_SPEED) % 0.25;
    ctx.strokeStyle = BELT_SLAT;
    ctx.lineWidth = 2.5 / z;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let t = phase; t < 1; t += 0.25) {
      const u = t - 0.5;
      ctx.moveTo(...at(u - 0.1, -0.24));
      ctx.lineTo(...at(u + 0.04, 0));
      ctx.lineTo(...at(u - 0.1, 0.24));
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Caps where a line starts or stops: a lip at the start, a hazard bumper at the end.
    if (!look.fed) {
      ctx.fillStyle = BELT_RAIL;
      this.beltBar(at, -0.5, 0.09);
    }
    if (!look.joined) {
      ctx.fillStyle = '#d9a93a';
      this.beltBar(at, 0.41, 0.09);
      ctx.fillStyle = '#20242d';
      for (const v of [-0.22, 0.02]) {
        ctx.beginPath();
        const p = [at(0.41, v), at(0.41, v + 0.1), at(0.5, v + 0.18), at(0.5, v + 0.08)];
        ctx.moveTo(...p[0]);
        for (const q of p.slice(1)) ctx.lineTo(...q);
        ctx.fill();
      }
    }
    for (const it of b.belt) {
      const t = it.pos - 0.5;
      this.drawItem(it.item, b.x + 0.5 + dx * t, b.y + 0.5 + dy * t, 0.42);
    }
  }

  /** A bar across the belt from `u` to `u + depth` along it. */
  private beltBar(at: (u: number, v: number) => [number, number], u: number, depth: number): void {
    const ctx = this.ctx;
    const p = [at(u, -0.44), at(u + depth, -0.44), at(u + depth, 0.44), at(u, 0.44)];
    ctx.beginPath();
    ctx.moveTo(...p[0]);
    for (const q of p.slice(1)) ctx.lineTo(...q);
    ctx.closePath();
    ctx.fill();
  }

  /** A quarter-turn belt: items come in from side `from` and leave towards the belt's facing. */
  private drawCurvedBelt(b: Building, from: Dir, now: number, z: number): void {
    const ctx = this.ctx;
    // The curve turns about the tile corner shared by its entry and exit sides.
    const px = b.x + 0.5 + (DX[from] + DX[b.dir]) * 0.5;
    const py = b.y + 0.5 + (DY[from] + DY[b.dir]) * 0.5;
    const a0 = Math.atan2(b.y + 0.5 + DY[from] * 0.5 - py, b.x + 0.5 + DX[from] * 0.5 - px);
    let sweep = Math.atan2(b.y + 0.5 + DY[b.dir] * 0.5 - py, b.x + 0.5 + DX[b.dir] * 0.5 - px) - a0;
    if (sweep > Math.PI) sweep -= Math.PI * 2;
    if (sweep < -Math.PI) sweep += Math.PI * 2;
    const ccw = sweep < 0;
    const a1 = a0 + sweep;
    const ring = (r0: number, r1: number) => {
      ctx.beginPath();
      ctx.arc(px, py, r1, a0, a1, ccw);
      ctx.arc(px, py, r0, a1, a0, !ccw);
      ctx.closePath();
    };
    ctx.fillStyle = BELT_SURFACE;
    ring(0.09, 0.91);
    ctx.fill();
    ctx.lineWidth = 1.5 / z;
    ctx.strokeStyle = '#0f1a2e';
    // Rails line up with the straight belt sprite's (4–11 and 53–60 px of 64).
    for (const [r0, r1] of [[0.06, 0.17], [0.83, 0.94]]) {
      ctx.fillStyle = BELT_RAIL;
      ring(r0, r1);
      ctx.fill();
      ctx.stroke();
    }
    // Rivets on the outer rail.
    ctx.fillStyle = '#8a96a8';
    for (const t of [0.15, 0.5, 0.85]) dot(ctx, px + Math.cos(a0 + sweep * t) * 0.885, py + Math.sin(a0 + sweep * t) * 0.885, 0.025);
    // Slats fan out around the bend.
    const phase = ((now / 1000) * BELT_SPEED) % 0.25;
    ctx.strokeStyle = BELT_SLAT;
    ctx.lineWidth = 2.5 / z;
    ctx.beginPath();
    for (let t = phase; t < 1; t += 0.25) {
      const a = a0 + sweep * t;
      ctx.moveTo(px + Math.cos(a) * 0.22, py + Math.sin(a) * 0.22);
      ctx.lineTo(px + Math.cos(a) * 0.8, py + Math.sin(a) * 0.8);
    }
    ctx.stroke();
    for (const it of b.belt) {
      const a = a0 + sweep * it.pos;
      this.drawItem(it.item, px + Math.cos(a) * 0.5, py + Math.sin(a) * 0.5, 0.42);
    }
  }

  /** Metal flanges where a belt meets a building, so the line reads as plugged in. */
  private drawJoins(world: World, b: Building, look: BeltLook, z: number): void {
    const sides: Dir[] = [];
    const feeder = look.fed ? world.buildingAt(b.x + DX[look.from], b.y + DY[look.from]) : undefined;
    if (feeder && feeder.type !== 'belt') sides.push(look.from);
    const front = world.buildingAt(b.x + DX[b.dir], b.y + DY[b.dir]);
    if (look.joined && front && front.type !== 'belt') sides.push(b.dir);
    const ctx = this.ctx;
    for (const d of sides) {
      const ex = b.x + 0.5 + DX[d] * 0.5;
      const ey = b.y + 0.5 + DY[d] * 0.5;
      const w = DX[d] ? 0.16 : 0.66;
      const h = DX[d] ? 0.66 : 0.16;
      ctx.fillStyle = BELT_RAIL;
      ctx.strokeStyle = '#0f1a2e';
      ctx.lineWidth = 1.5 / z;
      roundRect(ctx, ex - w / 2, ey - h / 2, w, h, 0.04);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8a96a8';
      for (const s of [-0.24, 0.24]) dot(ctx, ex + DY[d] * s, ey + DX[d] * s, 0.025);
    }
  }

  /** A faint dotted line between paired tunnels, where the belt runs underground. */
  private drawTunnelTrace(a: Building, b: Building, z: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(138,150,168,0.35)';
    ctx.lineWidth = 3 / z;
    ctx.setLineDash([2 / z, 7 / z]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x + 0.5, a.y + 0.5);
    ctx.lineTo(b.x + 0.5, b.y + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
  }

  private spriteKey(world: World, b: Building): string {
    if (b.type === 'tunnel') return world.isTunnelExit(b) ? 'buildings/tunnel_out' : 'buildings/tunnel_in';
    if (b.type === 'turret' || b.type === 'cannon') return `buildings/${b.type}_base`;
    return `buildings/${b.type}`;
  }

  private drawBuilding(world: World, b: Building, now: number, z: number): void {
    const ctx = this.ctx;
    const def = BUILDINGS[b.type];
    const size = b.type === 'hub' ? HUB_SIZE : 1;
    const directional = b.type !== 'hub' && b.type !== 'wall' && b.type !== 'repair' && b.type !== 'stash' && !TURRETS[b.type];
    const angle = directional ? (b.dir * Math.PI) / 2 : 0;

    if (!this.drawSprite(this.spriteKey(world, b), b.x, b.y, size, angle)) {
      ctx.fillStyle = def.color;
      ctx.fillRect(b.x + 0.08, b.y + 0.08, size - 0.16, size - 0.16);
      if (directional) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        arrowHead(ctx, b.x + 0.5 + DX[b.dir] * 0.36, b.y + 0.5 + DY[b.dir] * 0.36, b.dir, 0.12);
      }
    }

    // Working machines glow and pulse.
    const working = (isMachine(b.type) || b.type === 'extractor') && b.progress >= 0 && b.outputs.length < 3;
    if (working) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 120 + b.id);
      const glow = b.type === 'furnace' ? '255,150,60' : b.type === 'extractor' ? '160,220,90' : '120,190,255';
      const g = ctx.createRadialGradient(b.x + 0.5, b.y + 0.5, 0.05, b.x + 0.5, b.y + 0.5, 0.6);
      g.addColorStop(0, `rgba(${glow},${0.22 + 0.18 * pulse})`);
      g.addColorStop(1, `rgba(${glow},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(b.x - 0.1, b.y - 0.1, 1.2, 1.2);
    }

    if (b.type === 'hub') {
      // The hub's built-in gun sits on the centre pad.
      const aim = this.aims.get(b.id) ?? -Math.PI / 2;
      const gun = 1.5;
      this.drawSprite('buildings/turret_barrel', b.x + HUB_SIZE / 2 - gun / 2, b.y + HUB_SIZE / 2 - gun / 2, gun, aim);
    }

    const turret = TURRETS[b.type];
    if (turret) {
      const aim = this.aims.get(b.id) ?? -Math.PI / 2;
      if (!this.drawSprite(`buildings/${b.type}_barrel`, b.x, b.y, 1, aim)) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        dot(ctx, b.x + 0.5, b.y + 0.5, 0.3);
      }
      bar(ctx, b.x + 0.12, b.y + 0.86, 0.76, b.ammo / turret.maxShots, ITEMS[turret.ammoItem].color);
    }

    if ((b.type === 'splitter' || b.type === 'skimmer') && b.outputs.length) this.drawItem(b.outputs[0], b.x + 0.5, b.y + 0.5, 0.34);
    if (b.type === 'tunnel' && b.link == null) {
      // Unpaired: flash a warning dot.
      ctx.fillStyle = `rgba(242,193,78,${0.5 + 0.5 * Math.sin(now / 200)})`;
      dot(ctx, b.x + 0.8, b.y + 0.2, 0.1);
    }
    if (b.type === 'repair') bar(ctx, b.x + 0.12, b.y + 0.86, 0.76, b.ammo / REPAIR.maxCharge, '#3fbf5f');
    if (b.type === 'port' && b.filter) this.drawBadge(b.filter, b.x, b.y);

    if (b.type === 'extractor' || isMachine(b.type)) {
      const recipe = b.recipe ? RECIPE_BY_ID[b.recipe] : undefined;
      if (recipe && b.progress >= 0) bar(ctx, b.x + 0.12, b.y + 0.86, 0.76, b.progress / recipe.time, '#8fd18f');
      if (recipe) this.drawBadge(recipe.output, b.x, b.y);
    }

    if (!sprite(this.spriteKey(world, b)) && z >= 18 && def.short) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${b.type === 'hub' ? 0.6 : 0.3}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.short, b.x + size / 2, b.y + size / 2);
    }

    if (b.hp < def.hp) bar(ctx, b.x + 0.1, b.y + 0.02, size - 0.2, b.hp / def.hp, b.hp / def.hp > 0.35 ? '#7bd389' : '#e0445a');
  }

  /** Small item icon in a building's top-right corner (its product or chosen item). */
  private drawBadge(item: ItemId, x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(15,26,46,0.85)';
    dot(ctx, x + 0.8, y + 0.2, 0.17);
    this.drawItem(item, x + 0.8, y + 0.2, 0.28);
  }

  private drawGhost(
    world: World,
    tool: BuildingType | 'demolish',
    x: number,
    y: number,
    dir: Dir,
    z: number,
    opts: { ok?: boolean; range?: boolean; dashed?: boolean } = {},
  ): void {
    const ctx = this.ctx;
    if (tool === 'demolish') {
      ctx.strokeStyle = '#e0445a';
      ctx.lineWidth = 3 / z;
      ctx.beginPath();
      ctx.moveTo(x + 0.2, y + 0.2);
      ctx.lineTo(x + 0.8, y + 0.8);
      ctx.moveTo(x + 0.8, y + 0.2);
      ctx.lineTo(x + 0.2, y + 0.8);
      ctx.stroke();
      return;
    }
    const ok = opts.ok ?? !world.checkPlace(tool, x, y);
    const turret = !!TURRETS[tool];
    const directional = tool !== 'wall' && tool !== 'repair' && tool !== 'port' && tool !== 'stash' && !turret;
    const key = tool === 'tunnel' ? (world.findTunnelEntrance(x, y, dir) ? 'buildings/tunnel_out' : 'buildings/tunnel_in') : turret ? `buildings/${tool}_base` : `buildings/${tool}`;
    ctx.globalAlpha = 0.6;
    const drawn = this.drawSprite(key, x, y, 1, directional ? (dir * Math.PI) / 2 : 0);
    if (drawn && turret) this.drawSprite(`buildings/${tool}_barrel`, x, y, 1, -Math.PI / 2);
    if (!drawn) {
      ctx.fillStyle = BUILDINGS[tool].color;
      ctx.fillRect(x + 0.06, y + 0.06, 0.88, 0.88);
    }
    ctx.globalAlpha = 1;
    if (!ok) {
      ctx.fillStyle = 'rgba(224,68,90,0.35)';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = ok ? '#3fa9f5' : '#ff6070';
    ctx.lineWidth = 2.5 / z;
    if (opts.dashed) {
      ctx.fillStyle = ok ? 'rgba(63,169,245,0.18)' : 'rgba(0,0,0,0)';
      ctx.fillRect(x + 0.03, y + 0.03, 0.94, 0.94);
      ctx.setLineDash([6 / z, 4 / z]);
    }
    roundRect(ctx, x + 0.03, y + 0.03, 0.94, 0.94, 0.1);
    ctx.stroke();
    ctx.setLineDash([]);
    if (directional) {
      ctx.fillStyle = '#ffffff';
      arrowHead(ctx, x + 0.5 + DX[dir] * 0.62, y + 0.5 + DY[dir] * 0.62, dir, 0.14);
    }
    const range = TURRETS[tool]?.range ?? (tool === 'repair' ? REPAIR.range : 0);
    if (range && opts.range !== false) rangeCircle(ctx, x + 0.5, y + 0.5, range, z);
    if (tool === 'tunnel' && ok) {
      const entrance = world.findTunnelEntrance(x, y, dir);
      if (entrance) linkLine(ctx, entrance, { x, y }, z);
    }
  }

  /** The Company's watch radius (while placing or inspecting contraband, or during an audit) and the audit drone. */
  private drawAudit(world: World, now: number, z: number, ui: UIState | null): void {
    const ctx = this.ctx;
    const hub = world.hub;
    if (!hub) return;
    const cx = hub.x + HUB_SIZE / 2;
    const cy = hub.y + HUB_SIZE / 2;
    const r = BLACK_MARKET.watchRadius;
    const audit = world.state.blackMarket.audit;
    const sel = ui?.selected != null ? world.byId.get(ui.selected) : undefined;
    const showRing =
      !!audit ||
      (ui?.tool && ui.tool !== 'demolish' && isContraband(ui.tool)) ||
      (sel && isContraband(sel.type));
    if (showRing) {
      ctx.strokeStyle = 'rgba(224,68,90,0.75)';
      ctx.fillStyle = 'rgba(224,68,90,0.05)';
      ctx.lineWidth = 2 / z;
      ctx.setLineDash([8 / z, 6 / z]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const sweep = auditSweep(world);
    if (sweep == null) return;
    // The drone spirals out from the hub to the edge of the watch radius.
    const dist = 2 + (r - 2) * sweep;
    const angle = sweep * Math.PI * 6;
    const dx = cx + Math.cos(angle) * dist;
    const dy = cy + Math.sin(angle) * dist;
    const scan = 2.5;
    const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, scan);
    g.addColorStop(0, 'rgba(255,90,110,0.35)');
    g.addColorStop(1, 'rgba(255,90,110,0)');
    ctx.fillStyle = g;
    dot(ctx, dx, dy, scan);
    const bob = 0.05 * Math.sin(now / 120);
    if (!this.drawSprite('buildings/drone', dx - 0.6, dy - 0.6 + bob, 1.2, angle + Math.PI / 2)) {
      ctx.fillStyle = '#1d3b6e';
      dot(ctx, dx, dy, 0.4);
    }
  }

  private drawSpawnMarker(x: number, y: number, pulse: number, z: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(224,68,90,${0.15 + 0.2 * pulse})`;
    dot(ctx, x, y, 1.5 + 0.3 * pulse);
    ctx.strokeStyle = '#e0445a';
    ctx.lineWidth = 3 / z;
    ctx.beginPath();
    ctx.arc(x, y, 1.1, 0, Math.PI * 2);
    ctx.stroke();
    // Warning triangle.
    ctx.fillStyle = '#e0445a';
    ctx.beginPath();
    ctx.moveTo(x, y - 0.55);
    ctx.lineTo(x + 0.55, y + 0.4);
    ctx.lineTo(x - 0.55, y + 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 0.05, y - 0.25, 0.1, 0.38);
    ctx.fillRect(x - 0.05, y + 0.2, 0.1, 0.1);
  }

  // ------------------------------------------------------------- effects

  /** Updates aim angles and enemy headings, and spawns effects for what happened since last frame. */
  private trackEffects(world: World, now: number): void {
    const s = world.state;
    for (const sh of world.shots) {
      if (this.seenShots.has(sh)) continue;
      this.seenShots.add(sh);
      const b = world.buildingAt(Math.floor(sh.x1), Math.floor(sh.y1));
      if (b) this.aims.set(b.id, Math.atan2(sh.y2 - sh.y1, sh.x2 - sh.x1));
      if (sh.splash) this.effects.push({ kind: 'blast', x: sh.x2, y: sh.y2, r: sh.splash, born: now, life: 350, color: '255,170,70' });
    }

    const alive = new Set<number>();
    for (const e of s.enemies) {
      alive.add(e.id);
      const prev = this.enemies.get(e.id);
      let angle = prev?.angle ?? 0;
      if (prev) {
        const dx = e.x - prev.x;
        const dy = e.y - prev.y;
        if (dx * dx + dy * dy > 1e-6) angle = Math.atan2(dy, dx);
      }
      this.enemies.set(e.id, { x: e.x, y: e.y, angle, type: e.type });
    }
    const breached = s.breaches !== this.breaches;
    for (const [id, e] of this.enemies) {
      if (alive.has(id)) continue;
      this.enemies.delete(id);
      if (!breached) {
        this.effects.push({ kind: 'puff', x: e.x, y: e.y, r: ENEMIES[e.type].radius * 2.2, born: now, life: 400, color: '224,68,90' });
      }
    }
    if (breached) {
      this.breaches = s.breaches;
      const hub = world.hub;
      if (hub) {
        const c = hub.x + HUB_SIZE / 2;
        this.effects.push({ kind: 'shockwave', x: c, y: hub.y + HUB_SIZE / 2, r: 9, born: now, life: 900, color: '63,169,245' });
      }
    }
    this.effects = this.effects.filter((fx) => now - fx.born < fx.life);
  }

  private drawShots(world: World, now: number, z: number): void {
    const ctx = this.ctx;
    for (const sh of world.shots) {
      const fade = 1 - sh.age / 0.12;
      ctx.strokeStyle = `rgba(255,224,138,${fade})`;
      ctx.lineWidth = (sh.splash ? 3 : 1.5) / z;
      ctx.beginPath();
      ctx.moveTo(sh.x1, sh.y1);
      ctx.lineTo(sh.x2, sh.y2);
      ctx.stroke();
      if (sh.age < 0.06) {
        // Muzzle flash at the barrel tip.
        const a = Math.atan2(sh.y2 - sh.y1, sh.x2 - sh.x1);
        const reach = world.buildingAt(Math.floor(sh.x1), Math.floor(sh.y1))?.type === 'hub' ? 0.72 : 0.48;
        const mx = sh.x1 + Math.cos(a) * reach;
        const my = sh.y1 + Math.sin(a) * reach;
        const flicker = 0.8 + 0.2 * Math.sin(now);
        ctx.fillStyle = `rgba(255,236,160,${0.9 * flicker})`;
        dot(ctx, mx, my, sh.splash ? 0.2 : 0.12);
      }
    }
  }

  private drawEffects(now: number, z: number): void {
    const ctx = this.ctx;
    for (const fx of this.effects) {
      const t = (now - fx.born) / fx.life;
      const a = 1 - t;
      if (fx.kind === 'blast') {
        ctx.fillStyle = `rgba(${fx.color},${0.45 * a})`;
        dot(ctx, fx.x, fx.y, fx.r * (0.5 + 0.5 * t));
        ctx.strokeStyle = `rgba(255,240,200,${a})`;
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * (0.3 + 0.9 * t), 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'puff') {
        ctx.fillStyle = `rgba(${fx.color},${0.6 * a})`;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          dot(ctx, fx.x + Math.cos(ang) * fx.r * t, fx.y + Math.sin(ang) * fx.r * t, 0.06 * (1 - t) + 0.02);
        }
      } else {
        ctx.strokeStyle = `rgba(${fx.color},${a})`;
        ctx.lineWidth = 6 / z;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * t, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x, y, w, 0.09);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 0.09);
}

function rangeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, z: number): void {
  ctx.fillStyle = 'rgba(63,169,245,0.08)';
  ctx.strokeStyle = 'rgba(63,169,245,0.6)';
  ctx.lineWidth = 1.5 / z;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Dashed line joining a tunnel entrance and exit. */
function linkLine(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, z: number): void {
  ctx.strokeStyle = 'rgba(255,224,138,0.8)';
  ctx.lineWidth = 2 / z;
  ctx.setLineDash([4 / z, 4 / z]);
  ctx.beginPath();
  ctx.moveTo(a.x + 0.5, a.y + 0.5);
  ctx.lineTo(b.x + 0.5, b.y + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Triangle pointing in `dir`, centred at (x, y). */
function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, dir: Dir, s: number): void {
  const fx = DX[dir];
  const fy = DY[dir];
  ctx.beginPath();
  ctx.moveTo(x + fx * s, y + fy * s);
  ctx.lineTo(x - fx * s - fy * s, y - fy * s + fx * s);
  ctx.lineTo(x - fx * s + fy * s, y - fy * s - fx * s);
  ctx.closePath();
  ctx.fill();
}
