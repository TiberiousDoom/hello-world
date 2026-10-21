// Canvas 2D renderer. It draws sprites from src/art (falling back to plain
// shapes if one is missing) and only reads the simulation, so a 3D renderer
// can replace it later behind the same draw() call.

import { sprite } from '../art';
import {
  BELT_SPEED,
  BUILDINGS,
  BuildingType,
  DX,
  DY,
  Dir,
  ENEMIES,
  EnemyType,
  EXTRACTOR_PERIOD,
  HUB_SIZE,
  NESTS,
  footprint,
  SHIP,
  HUB_WEAPON,
  ITEMS,
  ItemId,
  RECIPE_BY_ID,
  REPAIR,
  RESOURCE_ITEMS,
  TURRETS,
  isMachine,
} from '../sim/data';
import { Building, Shot, World } from '../sim/world';
import { Plan, UIState, placementAt, planDirs } from '../ui/state';
import { launching } from '../sim/ship';
import { Nest, isAngry, nestCentre } from '../sim/nests';
import { planStatus } from '../ui/plan';
import { BeltLook, beltLook } from './belts';
import { Camera } from './camera';

const RESOURCE_NODES = ['', 'terrain/node_iron', 'terrain/node_copper', 'terrain/node_stone'];
const RESOURCE_COLORS = ['', '#5a4232', '#1f6e5c', '#6e6b64'];
/** Enemy sprites are drawn larger than their hit radius so legs show. */
const ENEMY_SPRITE_SCALE = 4.2;
const ENEMY_SPRITE_MAX = 1.35; // tiles
/** The shipyard and its ship are drawn 3 tiles square. */
const SHIP_SIZE = 3;

// The forest (D-028).
const FOREST_FLOOR = '#1d3324';
const FOREST_CANOPY = '#1f4a2e';
const FIREFLIES = 70;
const LEAVES = 9;
const LEAF_COLORS = ['#c9923a', '#e8b65a', '#7fae4f', '#a8742e'];
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A cheap integer hash, for choosing decorations per tile. */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

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
  private enemies = new Map<number, { x: number; y: number; angle: number; type: EnemyType; walked: number }>();
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

    // Ground, decorations and resources. Beyond the map's edge is forest.
    ctx.fillStyle = FOREST_FLOOR;
    ctx.fillRect(Math.floor(x0f) - 1, Math.floor(y0f) - 1, Math.ceil(x1f - x0f) + 3, Math.ceil(y1f - y0f) + 3);
    this.drawGround(s.width, s.height);
    const decorate = z >= 14;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const r = s.resources[world.idx(x, y)];
        if (r) this.drawNode(r, x, y);
        else if (decorate && !world.tiles[world.idx(x, y)]) this.drawDecoration(x, y);
      }
    }
    this.drawMapEdge(s.width, s.height);

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
      const [fw, fh] = world.footprintOf(b);
      if (visible(b.x, b.y, Math.max(fw, fh))) this.drawBuilding(world, b, now, z);
    }
    belts.forEach((b, i) => this.drawJoins(world, b, looks[i], z));

    // Bug territories: a mound in each, and its outline while placing or while it's angry.
    for (const n of s.nests) if (visible(n.x, n.y, NESTS.cell)) this.drawNest(world, n, now, z, !!ui?.tool && ui.tool !== 'demolish');

    for (const e of s.enemies) {
      if (!visible(e.x - 1, e.y - 1, 2)) continue;
      const def = ENEMIES[e.type];
      const track = this.enemies.get(e.id);
      const angle = track?.angle ?? 0;
      // Walk cycle: the legs swap every short stride, so bugs only scuttle while moving.
      const stride = def.radius * 0.7;
      const frame = Math.floor((track?.walked ?? 0) / stride + e.id) % 2 && sprite(`enemies/${e.type}_b`) ? '_b' : '';
      const bob = 1 + 0.03 * Math.sin(now / 90 + e.id);
      const size = Math.min(ENEMY_SPRITE_MAX, def.radius * ENEMY_SPRITE_SCALE) * bob;
      if (!this.drawSprite(`enemies/${e.type}${frame}`, e.x - size / 2, e.y - size / 2, size, angle)) {
        ctx.fillStyle = def.color;
        dot(ctx, e.x, e.y, def.radius);
      }
      if (e.hp < e.maxHp) bar(ctx, e.x - 0.3, e.y - def.radius - 0.22, 0.6, e.hp / e.maxHp, '#e0445a');
    }

    this.drawForest(s.width, s.height, x0f, y0f, x1f, y1f, z);
    this.drawShots(world, now, z);
    this.drawEffects(now, z);
    this.drawAmbient(s.width, s.height, x0f, y0f, x1f, y1f, now, z);

    if (!ui) return;
    const sel = ui.selected != null ? world.byId.get(ui.selected) : undefined;
    if (sel) {
      const [fw, fh] = world.footprintOf(sel);
      ctx.strokeStyle = '#3fa9f5';
      ctx.lineWidth = 3 / z;
      roundRect(ctx, sel.x - 0.04, sel.y - 0.04, fw + 0.08, fh + 0.08, 0.12);
      ctx.stroke();
      const range = TURRETS[sel.type]?.range ?? (sel.type === 'repair' ? REPAIR.range : sel.type === 'hub' ? HUB_WEAPON.range : 0);
      if (range) rangeCircle(ctx, sel.x + fw / 2, sel.y + fh / 2, range, z);
      const partner = sel.link != null ? world.byId.get(sel.link) : undefined;
      if (partner) linkLine(ctx, sel, partner, z);
    }
    if (ui.plan) this.drawPlan(world, ui.plan, ui.dir, z);
    else if (ui.hover && ui.tool) this.drawGhost(world, ui.tool, ui.hover.x, ui.hover.y, ui.dir, z);
  }

  /** A blueprint waiting for ✓: dashed ghosts, red where a tile can't be built. Occupied tiles are skipped. */
  private drawPlan(world: World, plan: Plan, dir: Dir, z: number): void {
    const status = planStatus(world, plan, dir);
    const dirs = planDirs(plan, dir);
    const single = plan.tiles.length === 1;
    plan.tiles.forEach((t, i) => {
      if (status[i] === 'occupied') return;
      this.drawGhost(world, plan.tool, t.x, t.y, dirs[i], z, { ok: status[i] === null, range: single, dashed: true, replaceBelt: single });
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

  /**
   * Draws a building sprite over its footprint (fw × fh tiles at x, y), turned
   * to face `dir`. Sprites are drawn facing east, so sideways turns swap width and height.
   */
  private drawSpriteRect(key: string, x: number, y: number, fw: number, fh: number, dir: Dir): boolean {
    const img = sprite(key);
    if (!img) return false;
    const ctx = this.ctx;
    const [w, h] = dir % 2 ? [fh, fw] : [fw, fh];
    ctx.save();
    ctx.translate(x + fw / 2, y + fh / 2);
    if (dir) ctx.rotate((dir * Math.PI) / 2);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }

  /** A nest's mound, and its territory's outline while placing or while it's angry. */
  private drawNest(world: World, n: Nest, now: number, z: number, placing: boolean): void {
    const ctx = this.ctx;
    const c = NESTS.cell;
    const alive = world.state.enemies.some((e) => e.nest === n.id);
    const angry = alive && isAngry(world, n);
    if (alive && (placing || angry)) {
      const m = NESTS.nearMargin;
      ctx.fillStyle = angry ? `rgba(224,68,90,${0.08 + 0.05 * Math.sin(now / 200)})` : 'rgba(224,68,90,0.05)';
      ctx.fillRect(n.x - m, n.y - m, c + 2 * m, c + 2 * m);
      ctx.strokeStyle = angry ? 'rgba(255,96,112,0.9)' : 'rgba(224,68,90,0.55)';
      ctx.lineWidth = 2 / z;
      ctx.setLineDash([8 / z, 6 / z]);
      ctx.strokeRect(n.x - m, n.y - m, c + 2 * m, c + 2 * m);
      ctx.setLineDash([]);
    }
    // The mound: a dirt heap with burrows (flattened once the nest is cleared).
    const [cx, cy] = nestCentre(n);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + 0.15, cy + 0.2, 1.5, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alive ? '#6b4a2e' : '#4e4232';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 1.4, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alive ? '#83603c' : '#5c5040';
    ctx.beginPath();
    ctx.ellipse(cx - 0.2, cy - 0.2, 0.9, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!alive) return;
    ctx.fillStyle = '#1e140c';
    for (const [dx, dy, r] of [[-0.4, -0.1, 0.18], [0.35, 0.15, 0.15], [0.05, -0.45, 0.12]]) dot(ctx, cx + dx, cy + dy, r);
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
    ctx.fillStyle = this.groundPattern ?? '#2e4d33';
    ctx.fillRect(0, 0, w, h);
  }

  /** Grass tufts, flowers, mushrooms and pebbles on some empty tiles, the same every time. */
  private drawDecoration(x: number, y: number): void {
    const h = hash(x, y);
    const pick = h % 100;
    const key = pick < 14 ? 'terrain/tuft' : pick < 18 ? 'terrain/flowers' : pick < 21 ? 'terrain/flowers_blue' : pick < 23 ? 'terrain/pebbles' : pick < 24 ? 'terrain/mushrooms' : '';
    if (!key) return;
    const jx = ((h >>> 8) % 40) / 100 - 0.2;
    const jy = ((h >>> 16) % 40) / 100 - 0.2;
    this.drawSprite(key, x + jx, y + jy, 1, (((h >>> 24) % 4) * Math.PI) / 2);
  }

  /** A soft shadow where the clearing meets the forest. */
  private drawMapEdge(w: number, h: number): void {
    const ctx = this.ctx;
    const d = 1.2;
    // Each side: a gradient from the edge (dark) inwards (clear).
    const sides: [number, number, number, number, number, number, number, number][] = [
      [0, 0, w, d, 0, 0, 0, d],
      [0, h - d, w, d, 0, h, 0, h - d],
      [0, 0, d, h, 0, 0, d, 0],
      [w - d, 0, d, h, w, 0, w - d, 0],
    ];
    for (const [x, y, sw, sh, gx0, gy0, gx1, gy1] of sides) {
      const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      g.addColorStop(0, 'rgba(10,24,14,0.55)');
      g.addColorStop(1, 'rgba(10,24,14,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, sw, sh);
    }
  }

  /** Trees in a band around the map. Bugs come out from under them. */
  private drawForest(w: number, h: number, x0f: number, y0f: number, x1f: number, y1f: number, z: number): void {
    const BAND = 6;
    const xa = Math.max(-BAND, Math.floor(x0f) - 2);
    const ya = Math.max(-BAND, Math.floor(y0f) - 2);
    const xb = Math.min(w + BAND, Math.ceil(x1f) + 2);
    const yb = Math.min(h + BAND, Math.ceil(y1f) + 2);
    const ctx = this.ctx;
    if (z < 12) {
      // Zoomed far out: a plain canopy colour is enough.
      ctx.fillStyle = FOREST_CANOPY;
      ctx.fillRect(-BAND, -BAND, w + 2 * BAND, BAND);
      ctx.fillRect(-BAND, h, w + 2 * BAND, BAND);
      ctx.fillRect(-BAND, 0, BAND, h);
      ctx.fillRect(w, 0, BAND, h);
      return;
    }
    for (let y = ya; y < yb; y++) {
      for (let x = xa; x < xb; x++) {
        if (x >= 0 && y >= 0 && x < w && y < h) continue;
        const hv = hash(x + 1000, y + 1000);
        const kind = hv % 10;
        const key = kind < 4 ? 'terrain/tree_round' : kind < 7 ? 'terrain/tree_pine' : kind < 9 ? 'terrain/bush' : 'terrain/tree_autumn';
        const size = (key === 'terrain/bush' ? 1.2 : 1.7) + ((hv >>> 8) % 40) / 100;
        const jx = ((hv >>> 12) % 50) / 100 - 0.25;
        const jy = ((hv >>> 20) % 50) / 100 - 0.25;
        this.drawSprite(key, x + 0.5 + jx - size / 2, y + 0.5 + jy - size / 2, size, (((hv >>> 4) % 8) * Math.PI) / 4);
      }
    }
  }

  /** Fireflies drifting over the map and a few leaves blowing across the view. */
  private drawAmbient(w: number, h: number, x0f: number, y0f: number, x1f: number, y1f: number, now: number, z: number): void {
    if (REDUCED_MOTION) return;
    const ctx = this.ctx;
    const t = now / 1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < FIREFLIES; i++) {
      const hv = hash(i, 77);
      const fx = ((hv % 10007) / 10007) * w + Math.sin(t * 0.3 + i) * 1.5 + Math.sin(t * 0.71 + i * 2.3) * 0.6;
      const fy = (((hv >>> 13) % 10007) / 10007) * h + Math.cos(t * 0.27 + i * 1.7) * 1.5;
      if (fx < x0f - 1 || fx > x1f + 1 || fy < y0f - 1 || fy > y1f + 1) continue;
      const glow = Math.max(0, Math.sin(t * 1.3 + i * 0.9));
      if (glow < 0.05) continue;
      ctx.fillStyle = `rgba(214,255,120,${0.12 * glow})`;
      dot(ctx, fx, fy, 0.18);
      ctx.fillStyle = `rgba(240,255,170,${0.85 * glow})`;
      dot(ctx, fx, fy, Math.max(0.035, 1.6 / z));
    }
    ctx.restore();
    // Leaves wrap around the visible area as they blow across it.
    const vw = x1f - x0f + 2;
    const vh = y1f - y0f + 2;
    for (let i = 0; i < LEAVES; i++) {
      const hv = hash(i, 131);
      const lx = x0f - 1 + ((((hv % 997) / 997) * vw + t * (0.5 + (i % 3) * 0.15)) % vw);
      const ly = y0f - 1 + (((((hv >>> 10) % 997) / 997) * vh + t * 0.35 + Math.sin(t + i) * 0.4) % vh);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(t * (1 + (i % 4) * 0.3) + i);
      ctx.scale(1, 0.55 + 0.45 * Math.sin(t * 2 + i)); // tumbling
      ctx.fillStyle = LEAF_COLORS[i % LEAF_COLORS.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.13, 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
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
    const [fw, fh] = world.footprintOf(b);
    const big = fw * fh > 1;
    const directional = b.type !== 'hub' && b.type !== 'shipyard' && b.type !== 'wall' && b.type !== 'repair' && !TURRETS[b.type];
    // A launching ship shakes the whole shipyard.
    const shake = b.type === 'shipyard' && launching(world) ? 0.03 * Math.sin(now / 23) : 0;
    if (shake) ctx.translate(shake, 0);

    if (!this.drawSpriteRect(this.spriteKey(world, b), b.x, b.y, fw, fh, directional ? b.dir : 0)) {
      ctx.fillStyle = def.color;
      ctx.fillRect(b.x + 0.08, b.y + 0.08, fw - 0.16, fh - 0.16);
      if (directional && !big) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        arrowHead(ctx, b.x + 0.5 + DX[b.dir] * 0.36, b.y + 0.5 + DY[b.dir] * 0.36, b.dir, 0.12);
      }
    }
    if (big && directional) this.drawOutputPort(world, b, z);

    // Working machines glow and pulse.
    const working = (isMachine(b.type) || b.type === 'extractor') && b.progress >= 0 && b.outputs.length < 3;
    if (working) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 120 + b.id);
      const glow = b.type === 'furnace' ? '255,150,60' : b.type === 'extractor' ? '160,220,90' : '120,190,255';
      const [cx, cy] = world.centreOf(b);
      const r = Math.max(fw, fh) * 0.6;
      const g = ctx.createRadialGradient(cx, cy, 0.05, cx, cy, r);
      g.addColorStop(0, `rgba(${glow},${0.22 + 0.18 * pulse})`);
      g.addColorStop(1, `rgba(${glow},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
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

    if (b.type === 'splitter' && b.outputs.length) this.drawItem(b.outputs[0], b.x + 0.5, b.y + 0.5, 0.34);
    if (b.type === 'tunnel' && b.link == null) {
      // Unpaired: flash a warning dot.
      ctx.fillStyle = `rgba(242,193,78,${0.5 + 0.5 * Math.sin(now / 200)})`;
      dot(ctx, b.x + 0.8, b.y + 0.2, 0.1);
    }
    if (b.type === 'repair') bar(ctx, b.x + 0.12, b.y + 0.86, 0.76, b.ammo / REPAIR.maxCharge, '#3fbf5f');
    if (b.type === 'port') this.drawPortCollar(world, b, now, z);
    if (b.type === 'port' && b.filter) this.drawBadge(b.filter, b.x, b.y);

    if (b.type === 'extractor' && b.recipe) {
      if (b.progress >= 0) bar(ctx, b.x + 0.12, b.y + fh - 0.14, fw - 0.24, b.progress / EXTRACTOR_PERIOD, '#8fd18f');
      this.drawBadge(b.recipe as ItemId, b.x + fw - 1, b.y);
    }
    if (isMachine(b.type)) {
      const recipe = b.recipe ? RECIPE_BY_ID[b.recipe] : undefined;
      if (recipe && b.progress >= 0) bar(ctx, b.x + 0.12, b.y + fh - 0.14, fw - 0.24, b.progress / recipe.time, '#8fd18f');
      if (recipe) this.drawBadge(recipe.output, b.x + fw - 1, b.y);
    }

    if (!sprite(this.spriteKey(world, b)) && z >= 18 && def.short) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${big ? 0.6 : 0.3}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.short, b.x + fw / 2, b.y + fh / 2);
    }

    if (b.type === 'shipyard') this.drawShip(world, b, now);
    if (shake) ctx.translate(-shake, 0);
    if (b.hp < def.hp) bar(ctx, b.x + 0.1, b.y + 0.02, fw - 0.2, b.hp / def.hp, b.hp / def.hp > 0.35 ? '#7bd389' : '#e0445a');
  }

  /** Where a big machine sends its output: a port with an arrow on the middle of its front edge. */
  private drawOutputPort(world: World, b: Building, z: number): void {
    const ctx = this.ctx;
    const o = world.outputTile(b);
    const d = b.dir;
    // The edge between the machine's front tile and the tile it outputs to.
    const ex = o.fromX + 0.5 + DX[d] * 0.5;
    const ey = o.fromY + 0.5 + DY[d] * 0.5;
    const along = 0.5;
    const depth = 0.22;
    const w = DX[d] ? depth : along;
    const h = DX[d] ? along : depth;
    ctx.fillStyle = '#1b2230';
    ctx.strokeStyle = '#0f1a2e';
    ctx.lineWidth = 1.5 / z;
    roundRect(ctx, ex - w / 2 - DX[d] * 0.08, ey - h / 2 - DY[d] * 0.08, w, h, 0.05);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8eef6';
    arrowHead(ctx, ex - DX[d] * 0.06, ey - DY[d] * 0.06, d, 0.1);
  }

  /**
   * A docking collar joining a hub port to the hub, with items streaming out
   * through it while the port is sending.
   */
  private drawPortCollar(world: World, b: Building, now: number, z: number): void {
    const ctx = this.ctx;
    const back = ((b.dir + 2) % 4) as Dir; // towards the hub
    const ax = DX[back];
    const ay = DY[back];
    // Along the port's axis (u, towards the hub) and across it (v).
    const at = (u: number, v: number): [number, number] => [b.x + 0.5 + ax * u - ay * v, b.y + 0.5 + ay * u + ax * v];
    const quad = (u0: number, u1: number, v0: number, v1: number) => {
      ctx.beginPath();
      ctx.moveTo(...at(u0, v0));
      ctx.lineTo(...at(u1, v0));
      ctx.lineTo(...at(u1, v1));
      ctx.lineTo(...at(u0, v1));
      ctx.closePath();
    };
    ctx.lineWidth = 2 / z;
    ctx.strokeStyle = '#0f1a2e';
    ctx.fillStyle = '#1d3b6e';
    quad(0.3, 0.68, -0.3, 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3fa9f5';
    quad(0.3, 0.68, -0.07, 0.07);
    ctx.fill();
    // Clamps on either side.
    ctx.fillStyle = '#5a6478';
    for (const v of [-0.3, 0.22]) {
      quad(0.44, 0.56, v, v + 0.08);
      ctx.fill();
      ctx.stroke();
    }
    const sending = b.filter && (world.state.inventory[b.filter] ?? 0) > 0;
    if (!sending) return;
    ctx.fillStyle = '#e8f6ff';
    for (let k = 0; k < 3; k++) {
      const t = (now / 600 + k / 3) % 1;
      dot(ctx, ...at(0.68 - t * 0.6, 0), 0.05);
    }
  }

  /** The ship on its pad: finished stages solid, the one being built faint, and engine flames at launch. */
  private drawShip(world: World, b: Building, now: number): void {
    const ctx = this.ctx;
    const ship = world.state.ship;
    SHIP.stages.forEach((st, i) => {
      if (i > ship.stage) return;
      let alpha = 1;
      if (i === ship.stage) {
        // In progress: fades in as its parts arrive.
        const need = Object.values(st.items).reduce((a, n) => a + n!, 0);
        const have = Object.entries(st.items).reduce((a, [k, n]) => a + Math.min(n!, ship.delivered[k as ItemId] ?? 0), 0);
        alpha = 0.15 + 0.45 * (have / need);
      }
      ctx.globalAlpha = alpha;
      this.drawSprite(`buildings/ship_${st.id}`, b.x, b.y, SHIP_SIZE);
      ctx.globalAlpha = 1;
    });
    if (!launching(world)) return;
    // Engine flames under the stern, flickering.
    const cx = b.x + SHIP_SIZE / 2;
    const base = b.y + SHIP_SIZE * 0.89;
    for (const dx of [-0.28, 0.28]) {
      const len = 0.35 + 0.15 * Math.sin(now / 37 + dx * 10) + 0.08 * Math.random();
      const g = ctx.createLinearGradient(0, base, 0, base + len);
      g.addColorStop(0, 'rgba(255,240,180,0.95)');
      g.addColorStop(0.5, 'rgba(255,150,60,0.8)');
      g.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx + dx - 0.12, base);
      ctx.quadraticCurveTo(cx + dx, base + len * 1.4, cx + dx + 0.12, base);
      ctx.fill();
    }
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
    opts: { ok?: boolean; range?: boolean; dashed?: boolean; replaceBelt?: boolean } = {},
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
    // Big buildings centre on the hovered tile; dropped onto a belt, a building faces the way it runs.
    const replaceBelt = opts.replaceBelt ?? true;
    ({ x, y, dir } = placementAt(world, tool, { x, y }, dir, replaceBelt));
    const [fw, fh] = footprint(tool, dir);
    const ok = opts.ok ?? !world.checkPlace(tool, x, y, dir, replaceBelt);
    const turret = !!TURRETS[tool];
    const directional = tool !== 'wall' && tool !== 'repair' && tool !== 'port' && tool !== 'shipyard' && !turret;
    const key = tool === 'tunnel' ? (world.findTunnelEntrance(x, y, dir) ? 'buildings/tunnel_out' : 'buildings/tunnel_in') : turret ? `buildings/${tool}_base` : `buildings/${tool}`;
    ctx.globalAlpha = 0.6;
    const drawn = this.drawSpriteRect(key, x, y, fw, fh, directional ? dir : 0);
    if (drawn && turret) this.drawSprite(`buildings/${tool}_barrel`, x, y, 1, -Math.PI / 2);
    if (!drawn) {
      ctx.fillStyle = BUILDINGS[tool].color;
      ctx.fillRect(x + 0.06, y + 0.06, fw - 0.12, fh - 0.12);
    }
    ctx.globalAlpha = 1;
    if (!ok) {
      ctx.fillStyle = 'rgba(224,68,90,0.35)';
      ctx.fillRect(x, y, fw, fh);
    }
    ctx.strokeStyle = ok ? '#3fa9f5' : '#ff6070';
    ctx.lineWidth = 2.5 / z;
    if (opts.dashed) {
      ctx.fillStyle = ok ? 'rgba(63,169,245,0.18)' : 'rgba(0,0,0,0)';
      ctx.fillRect(x + 0.03, y + 0.03, fw - 0.06, fh - 0.06);
      ctx.setLineDash([6 / z, 4 / z]);
    }
    roundRect(ctx, x + 0.03, y + 0.03, fw - 0.06, fh - 0.06, 0.1);
    ctx.stroke();
    ctx.setLineDash([]);
    if (directional) {
      // The arrow sits just outside the edge items come out of.
      const ox = (dir === 0 ? x + fw - 1 : dir === 2 ? x : x + Math.floor((fw - 1) / 2)) + 0.5;
      const oy = (dir === 1 ? y + fh - 1 : dir === 3 ? y : y + Math.floor((fh - 1) / 2)) + 0.5;
      ctx.fillStyle = '#ffffff';
      arrowHead(ctx, ox + DX[dir] * 0.62, oy + DY[dir] * 0.62, dir, 0.14);
    }
    const range = TURRETS[tool]?.range ?? (tool === 'repair' ? REPAIR.range : 0);
    if (range && opts.range !== false) rangeCircle(ctx, x + 0.5, y + 0.5, range, z);
    if (tool === 'tunnel' && ok) {
      const entrance = world.findTunnelEntrance(x, y, dir);
      if (entrance) linkLine(ctx, entrance, { x, y }, z);
    }
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
      let walked = prev?.walked ?? 0;
      if (prev) {
        const dx = e.x - prev.x;
        const dy = e.y - prev.y;
        if (dx * dx + dy * dy > 1e-6) angle = Math.atan2(dy, dx);
        walked += Math.hypot(dx, dy);
      }
      this.enemies.set(e.id, { x: e.x, y: e.y, angle, type: e.type, walked });
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
