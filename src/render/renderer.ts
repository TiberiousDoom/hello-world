// Canvas 2D renderer. It draws sprites from src/art (falling back to plain
// shapes if one is missing) and only reads the simulation, so a 3D renderer
// can replace it later behind the same draw() call.

import { frame, frameCount, sprite, spritesLoaded } from '../art';
import {
  BUILDINGS,
  BuildingType,
  DX,
  DY,
  Dir,
  ENEMIES,
  EnemyType,
  EXTRACTOR_PERIOD,
  HAND_MINING,
  PLAYER,
  HUB_SIZE,
  NESTS,
  footprint,
  SHIP,
  HUB_WEAPON,
  ITEMS,
  ItemId,
  LUMBER,
  RECIPE_BY_ID,
  REPAIR,
  RESOURCE_ITEMS,
  TURRETS,
  beltSpeed,
  isBelt,
  isMachine,
  type Season,
} from '../sim/data';
import { Building, Enemy, LEFT, STUMP, Shot, TICK, TREE, World } from '../sim/world';
import { PING_MS, PLAYER_COLORS, Plan, Spot, UIState, placementAt } from '../ui/state';
import { launching } from '../sim/ship';
import { clockAt, darkness } from '../sim/clock';
import { Nest, isAngry, nestCentre, ownsCell, strength } from '../sim/nests';
import { planSteps } from '../ui/plan';
import { BeltLook, beltLook } from './belts';
import { runPiece } from './runs';
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
/** Belt lanes (#61): how far each lane is from the middle, and the size of items on them. */
const LANE_OFFSET = 0.21;
const ITEM_ON_BELT = 0.34;
/** Pixels per tile below which belt arrows stop sliding (#66). */
const STILL_BELTS_BELOW = 20;
/**
 * A wash over the ground for each season (#42). The seasons have their own ground and trees (D-082),
 * so this only warms summer and settles the grass tufts and flowers into fall leaves and snow.
 */
const SEASON_TINT: Record<Season['id'], string | null> = {
  spring: null,
  summer: 'rgba(255,214,110,0.07)',
  fall: 'rgba(214,120,40,0.07)',
  winter: 'rgba(228,238,255,0.12)',
};
/** Each season's sprites for the ground and the two kinds of tree (summer is the art as first drawn). */
const SEASON_ART: Record<Season['id'], { ground: string; round: string; pine: string; over?: [string, string] }> = {
  spring: { ground: 'terrain/ground_spring', round: 'terrain/tree_round_spring', pine: 'terrain/tree_pine_spring' },
  summer: { ground: 'terrain/ground', round: 'terrain/tree_round', pine: 'terrain/tree_pine' },
  fall: { ground: 'terrain/ground_fall', round: 'terrain/tree_round_fall', pine: 'terrain/tree_pine_fall' },
  winter: {
    ground: 'terrain/ground_winter',
    round: 'terrain/tree_round_winter',
    pine: 'terrain/tree_pine_winter',
    over: ['terrain/tree_round_winter_frost', 'terrain/tree_pine_winter_snow'],
  },
};
/** Night (#42): how dark it gets, and lights that keep the factory readable. */
const NIGHT = { color: '8,14,40', alpha: 0.58 };
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
const EXPRESS_RAIL = '#d9a93a';
const BELT_SLAT = 'rgba(138,150,168,0.5)';

/** Tiles of spare picture around the view in a cached layer, so panning doesn't redraw it every frame. */
const LAYER_MARGIN = 6;

/**
 * A cached picture of tiles that rarely change (ground, decoration, ore, trees), so
 * they're drawn once instead of every frame (#46). Redrawn when the view leaves it,
 * the zoom changes, sprites finish loading, or something is built or cut down.
 */
interface Layer {
  canvas: HTMLCanvasElement;
  key: string;
  x0: number;
  y0: number;
  x1: number; // exclusive
  y1: number;
  scale: number; // canvas pixels per tile
}

const newLayer = (): Layer => ({ canvas: document.createElement('canvas'), key: '', x0: 0, y0: 0, x1: 0, y1: 0, scale: 1 });

interface Effect {
  kind: 'puff' | 'blast' | 'shockwave' | 'sparks' | 'sprite';
  x: number;
  y: number;
  r: number; // for a sprite, its size in tiles
  born: number; // ms
  life: number; // ms
  color: string; // for a sprite, its strip's name
  angle?: number;
}

/** Whether the tile a belt runs into is one of the hub's corner tiles (#78). */
function hubCornerAhead(world: World, b: Building): boolean {
  const hub = world.buildingAt(b.x + DX[b.dir], b.y + DY[b.dir]);
  if (hub?.type !== 'hub') return false;
  const [w, h] = world.footprintOf(hub);
  const rx = b.x + DX[b.dir] - hub.x;
  const ry = b.y + DY[b.dir] - hub.y;
  return (rx === 0 || rx === w - 1) && (ry === 0 || ry === h - 1);
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  /** Highest device-pixel ratio to draw at: 2, or 1 in battery saver. */
  maxDpr = 2;
  private ground = newLayer();
  private canopy = newLayer();
  /** Turret aim angles, from their most recent shot. */
  private aims = new Map<number, number>();
  private seenShots = new WeakSet<Shot>();
  /** Last known enemy positions and headings, to face sprites and place death puffs. */
  private enemies = new Map<number, { x: number; y: number; angle: number; type: EnemyType; walked: number; movedAt: number }>();
  private effects: Effect[] = [];
  private breaches = -1;
  private seenFelled = new WeakSet<object>();
  private seenTaps = new WeakSet<object>();
  /** The season being drawn (#42), and the night overlay's canvas. */
  private season: Season['id'] = 'spring';
  private night = document.createElement('canvas');
  /** Each character as drawn: eased toward its position between ticks, its heading, how far it has walked, and where it has been (for the trail of carried items). */
  private players = new Map<number, { x: number; y: number; angle: number; walked: number; trail: [number, number][]; at: number }>();
  private world: World | null = null;
  /** How far the game is between its last tick and the next (0–1); things are drawn that far along (#49). */
  private alpha = 1;
  /** Game seconds since the last frame, for belt arrows. */
  private frameDt = 0;
  private drawnAt = 0;
  /** Each belt's arrow offset: it moves with game time, and stops while the belt is backed up. */
  private beltPhase = new Map<number, number>();
  /** Where moving things were on the last two ticks, to draw them part way between (#49). */
  private smoothed = new WeakMap<object, { t: number; x: number; y: number; px: number; py: number }>();

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.camera.width = w;
    this.camera.height = h;
  }

  /** `alpha`: how far the game is towards its next tick (0–1); moving things are drawn that far along. */
  draw(world: World, ui: UIState | null, now: number, alpha = 1): void {
    // iOS Safari can change the visible area (toolbars, opening from another app)
    // without a resize event, which left the picture stretched. Check every frame.
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
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
      this.beltPhase.clear();
      this.drawnAt = world.state.time;
    }
    this.alpha = alpha;
    const gameNow = world.state.time + alpha * TICK;
    this.frameDt = Math.min(0.25, Math.max(0, gameNow - this.drawnAt));
    this.drawnAt = gameNow;
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

    // Ground, decorations and resources (cached). Beyond the map's edge is forest.
    this.season = clockAt(world.state.time).season.id;
    const stamp = `${world.layout}|${spritesLoaded()}|${this.season}`;
    const view: [number, number, number, number] = [Math.floor(x0f) - 1, Math.floor(y0f) - 1, Math.ceil(x1f) + 1, Math.ceil(y1f) + 1];
    this.drawLayer(this.ground, stamp, view, (lx0, ly0, lx1, ly1) => this.paintGround(world, lx0, ly0, lx1, ly1));

    // Blighted ground around standing nests, under everything built, so danger zones read from the ground's colour.
    for (const n of s.nests) if (!n.destroyed && visible(n.x, n.y, NESTS.cell) && ownsCell(world, n)) this.drawBlight(n);

    // Paired tunnels: a faint dotted line where the belt runs underground.
    for (const b of s.buildings) {
      if (b.type !== 'tunnel' || b.link == null || world.isTunnelExit(b)) continue;
      const exit = world.byId.get(b.link);
      if (exit && (visible(b.x, b.y) || visible(exit.x, exit.y))) this.drawTunnelTrace(b, exit, z);
    }
    // Belts first so everything else sits on top, then the flanges where belts meet buildings.
    const belts = s.buildings.filter((b) => isBelt(b.type) && visible(b.x, b.y));
    const looks = belts.map((b) => beltLook(world, b));
    belts.forEach((b, i) => this.drawBelt(b, looks[i], z));
    for (const b of belts) if (hubCornerAhead(world, b)) this.drawUnderHub(b);
    for (const b of s.buildings) {
      if (isBelt(b.type)) continue;
      const [fw, fh] = world.footprintOf(b);
      if (visible(b.x, b.y, Math.max(fw, fh))) this.drawBuilding(world, b, now, z);
    }
    belts.forEach((b, i) => this.drawJoins(world, b, looks[i], z));

    // Bug territories: a mound in each, and its outline while placing or while it's angry.
    // (A cleared territory taken over by a newer nest is drawn as that nest.)
    for (const n of s.nests) if (visible(n.x, n.y, NESTS.cell) && ownsCell(world, n)) this.drawNest(world, n, now, z, !!ui?.tool && ui.tool !== 'demolish');

    this.drawLayer(this.canopy, stamp, view, (lx0, ly0, lx1, ly1) => {
      // One tile more each way: canopies spill over their neighbours.
      const cx0 = Math.max(0, lx0 - 1);
      const cy0 = Math.max(0, ly0 - 1);
      this.drawTrees(world, cx0, cy0, Math.min(s.width - 1, lx1), Math.min(s.height - 1, ly1), z);
      this.frostTrees(lx0, ly0, lx1, ly1);
    });

    if (ui) this.drawPlayers(world, now, z);

    for (const e of s.enemies) {
      if (!visible(e.x - 1, e.y - 1, 2)) continue;
      const def = ENEMIES[e.type];
      const track = this.enemies.get(e.id);
      const angle = track?.angle ?? 0;
      const [ex, ey] = this.smooth(e, e.x, e.y);
      // Walk cycle: a step every short stride, so bugs only scuttle while moving. Standing at a building
      // or an engineer while angry, they bite (D-082).
      const stride = def.radius * 0.7;
      const step = Math.floor((track?.walked ?? 0) / stride + e.id);
      const biting = !!track && s.time - track.movedAt > 0.15 && this.biting(world, e, def.radius);
      const frame = step % 2 && sprite(`enemies/${e.type}_b`) ? '_b' : '';
      const bob = 1 + 0.03 * Math.sin(now / 90 + e.id);
      // Young bugs (D-065) are smaller, duller and a little darker until they grow up (D-075: pale ones vanished
      // on the light grass); their health bar is out of what they can have now.
      const grown = strength(world, e);
      const size = Math.min(ENEMY_SPRITE_MAX, def.radius * ENEMY_SPRITE_SCALE) * bob * (0.4 + 0.6 * grown);
      if (grown < 1) ctx.filter = `saturate(${Math.round(55 + 45 * grown)}%) brightness(${Math.round(80 + 20 * grown)}%)`;
      const x = ex - size / 2;
      const y = ey - size / 2;
      const drawn = biting
        ? this.drawFrame(`enemies/${e.type}_attack`, s.time * 8 + e.id, x, y, size, angle)
        : this.drawFrame(`enemies/${e.type}_walk`, step, x, y, size, angle);
      if (!drawn && !this.drawSprite(`enemies/${e.type}${frame}`, x, y, size, angle)) {
        ctx.fillStyle = def.color;
        dot(ctx, ex, ey, def.radius * (0.4 + 0.6 * grown));
      }
      if (grown < 1) ctx.filter = 'none';
      const full = e.maxHp * grown;
      if (e.hp < full - 0.5) bar(ctx, ex - 0.3, ey - def.radius - 0.22, 0.6, e.hp / full, '#e0445a');
    }

    this.drawForest(s.width, s.height, x0f, y0f, x1f, y1f, z);
    this.drawShots(world, now, z);
    this.drawEffects(now, z);
    this.drawHandMining(world, z);
    this.drawAmbient(s.width, s.height, x0f, y0f, x1f, y1f, now, z);
    if (ui) this.drawNight(world, x0, y0, x1, y1);

    if (!ui) return;
    const sel = ui.selected != null ? world.byId.get(ui.selected) : undefined;
    if (sel) {
      const [fw, fh] = world.footprintOf(sel);
      ctx.strokeStyle = '#3fa9f5';
      ctx.lineWidth = 3 / z;
      roundRect(ctx, sel.x - 0.04, sel.y - 0.04, fw + 0.08, fh + 0.08, 0.12);
      ctx.stroke();
      const range =
        TURRETS[sel.type]?.range ?? (sel.type === 'repair' ? REPAIR.range : sel.type === 'hub' ? HUB_WEAPON.range : sel.type === 'lumber_camp' ? LUMBER.range : 0);
      if (range) rangeCircle(ctx, sel.x + fw / 2, sel.y + fh / 2, range, z);
      const partner = sel.link != null ? world.byId.get(sel.link) : undefined;
      if (partner) linkLine(ctx, sel, partner, z);
    }
    // Express belt over a belt: outline the whole line a tap would upgrade.
    const hovered = ui.hover && ui.tool === 'express_belt' ? world.buildingAt(ui.hover.x, ui.hover.y) : undefined;
    if (hovered?.type === 'belt') this.drawUpgradeLine(world, world.beltLine(hovered), z);
    else if (ui.plan) this.drawPlan(world, ui.plan, ui.dir, ui.dirSet, z);
    else if (ui.hover && ui.tool) this.drawGhost(world, ui.tool, ui.hover, ui.dir, z, { keepDir: ui.dirSet });
    if (ui.pings.length) this.drawPings(ui, now, z);
  }

  /**
   * Co-op pings (D-080): rings spreading from the spot in the player's colour, and an arrow at the edge
   * of the screen pointing at a ping that's off it.
   */
  private drawPings(ui: UIState, now: number, z: number): void {
    const { ctx, camera } = this;
    for (const p of ui.pings) {
      const age = (now - p.at) / PING_MS;
      if (age < 0 || age >= 1) continue;
      const color = PLAYER_COLORS[p.player % PLAYER_COLORS.length];
      const fade = Math.min(1, (1 - age) * 3);
      const cx = p.x + 0.5;
      const cy = p.y + 0.5;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 / z;
      for (let k = 0; k < 2; k++) {
        const r = (((now - p.at) / 900 + k / 2) % 1) * 1.6;
        ctx.globalAlpha = fade * (1 - r / 1.6);
        ctx.beginPath();
        ctx.arc(cx, cy, 0.2 + r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = fade;
      // A pin standing on the spot.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 0.22, cy - 0.55);
      ctx.arc(cx, cy - 0.7, 0.26, Math.PI * 0.8, Math.PI * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5 / z;
      ctx.stroke();
      // Off screen: an arrow at the edge, pointing the way.
      const [sx, sy] = camera.toScreen(cx, cy);
      const m = 28;
      if (sx >= m && sx <= camera.width - m && sy >= m && sy <= camera.height - m) continue;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const ax = Math.max(m, Math.min(camera.width - m, sx));
      const ay = Math.max(m, Math.min(camera.height - m, sy));
      ctx.translate(ax, ay);
      ctx.rotate(Math.atan2(sy - ay, sx - ax));
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -11);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** The belts a tap with the Express Belt would upgrade; red where stock runs out. */
  private drawUpgradeLine(world: World, line: Building[], z: number): void {
    const ctx = this.ctx;
    const each = BUILDINGS.express_belt.cost;
    const inv = world.state.inventory;
    // Each upgrade refunds the old belt, so only the difference is spent.
    const afford = Math.min(
      ...Object.entries(each).map(([k, n]) => {
        const net = n! - ((BUILDINGS.belt.cost as Record<string, number>)[k] ?? 0);
        return net > 0 ? Math.floor((inv[k as ItemId] ?? 0) / net) : Infinity;
      }),
    );
    ctx.lineWidth = 2.5 / z;
    line.forEach((b, i) => {
      const ok = i < afford;
      ctx.fillStyle = ok ? 'rgba(242,193,78,0.22)' : 'rgba(224,68,90,0.3)';
      ctx.fillRect(b.x, b.y, 1, 1);
      ctx.strokeStyle = ok ? '#f2c14e' : '#ff6070';
      ctx.strokeRect(b.x + 0.04, b.y + 0.04, 0.92, 0.92);
    });
  }

  /** A blueprint waiting for ✓: dashed ghosts, red where a tile can't be built. Occupied tiles are skipped. */
  private drawPlan(world: World, plan: Plan, dir: Dir, keepDir: boolean, z: number): void {
    const single = plan.tiles.length === 1;
    const steps = planSteps(world, plan, dir, keepDir);
    let entrance: Spot | null = null;
    for (const s of steps) {
      if (s.status === 'occupied' && !s.over) continue;
      if (s.over) continue; // passed under (#65)
      this.drawGhost(world, s.tool, s.tile, s.dir, z, { ok: s.status === null, range: single, dashed: true, replaceBelt: single, exit: s.exit, keepDir });
      if (s.tool === 'tunnel' && !s.exit) entrance = s.tile;
      else if (s.exit && entrance) linkLine(this.ctx, entrance, s.tile, z);
    }
  }

  // ------------------------------------------------------------- sprites

  /** Draws a sprite into a square, rotated about its centre. Returns false if it isn't loaded. */
  private drawSprite(key: string, x: number, y: number, size: number, angle = 0): boolean {
    const img = sprite(key);
    if (!img) return false;
    this.drawCanvas(img, x, y, size, angle);
    return true;
  }

  /** Draws frame `i` of a strip into a square, rotated about its centre. Returns false if it isn't loaded. */
  private drawFrame(key: string, i: number, x: number, y: number, size: number, angle = 0): boolean {
    const img = frame(key, i);
    if (!img) return false;
    this.drawCanvas(img, x, y, size, angle);
    return true;
  }

  private drawCanvas(img: HTMLCanvasElement, x: number, y: number, size: number, angle: number): void {
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
  }

  /**
   * Draws a building sprite over its footprint (fw × fh tiles at x, y), turned
   * to face `dir`. Sprites are drawn facing east, so sideways turns swap width and height.
   */
  private drawSpriteRect(key: string, x: number, y: number, fw: number, fh: number, dir: Dir, img = sprite(key)): boolean {
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
    // The mound: a burrow entrance by kind (D-065), with eyes when angry and a collapsing rim when badly hurt.
    const standing = !n.destroyed;
    const [cx, cy] = nestCentre(n);
    const kind = n.brood.brute > 0 ? 'den' : n.brood.runner > 0 ? 'hive' : 'warren';
    const key = !standing ? 'nests/destroyed' : world.state.mode === 'hardcore' ? 'nests/hardcore' : `nests/${kind}`;
    if (this.drawSprite(key, cx - 1, cy - 1, 2)) {
      if (!standing) return;
      if (angry) this.drawSprite('nests/angry', cx - 1, cy - 1, 2);
      if (n.hp < n.maxHp / 2) this.drawSprite('nests/damaged', cx - 1, cy - 1, 2);
      if (n.hp < n.maxHp) bar(ctx, cx - 0.7, cy - 1.25, 1.4, n.hp / n.maxHp, '#e0445a');
      return;
    }
    // Drawn in code when the sprites are missing.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + 0.15, cy + 0.2, 1.5, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = standing ? '#6b4a2e' : '#4e4232';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 1.4, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = standing ? '#83603c' : '#5c5040';
    ctx.beginPath();
    ctx.ellipse(cx - 0.2, cy - 0.2, 0.9, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!standing) return;
    ctx.fillStyle = '#1e140c';
    for (const [dx, dy, r] of [[-0.4, -0.1, 0.18], [0.35, 0.15, 0.15], [0.05, -0.45, 0.12]]) dot(ctx, cx + dx, cy + dy, r);
    if (n.hp < n.maxHp) {
      if (n.hp < n.maxHp / 2) {
        ctx.strokeStyle = '#1e140c';
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.moveTo(cx - 0.9, cy + 0.1);
        ctx.lineTo(cx - 0.5, cy + 0.35);
        ctx.lineTo(cx - 0.1, cy + 0.15);
        ctx.moveTo(cx + 0.6, cy - 0.5);
        ctx.lineTo(cx + 0.8, cy - 0.1);
        ctx.lineTo(cx + 1.1, cy);
        ctx.stroke();
      }
      bar(ctx, cx - 0.7, cy - 1.25, 1.4, n.hp / n.maxHp, '#e0445a');
    }
  }

  private drawItem(item: ItemId, cx: number, cy: number, size: number): void {
    if (!this.drawSprite(`items/${item}`, cx - size / 2, cy - size / 2, size)) {
      this.ctx.fillStyle = ITEMS[item].color;
      dot(this.ctx, cx, cy, size * 0.4);
    }
  }

  /**
   * Draws a cached layer covering `view` (tiles x0, y0 to x1, y1, exclusive), first
   * repainting it with `paint` if it's out of date or the view has moved off it.
   */
  private drawLayer(l: Layer, stamp: string, view: [number, number, number, number], paint: (x0: number, y0: number, x1: number, y1: number) => void): void {
    const [vx0, vy0, vx1, vy1] = view;
    const scale = this.camera.zoom * this.dpr;
    const key = `${scale}|${stamp}`;
    if (l.key !== key || vx0 < l.x0 || vy0 < l.y0 || vx1 > l.x1 || vy1 > l.y1) {
      l.x0 = vx0 - LAYER_MARGIN;
      l.y0 = vy0 - LAYER_MARGIN;
      l.x1 = vx1 + LAYER_MARGIN;
      l.y1 = vy1 + LAYER_MARGIN;
      l.scale = scale;
      l.key = key;
      l.canvas.width = Math.ceil((l.x1 - l.x0) * scale);
      l.canvas.height = Math.ceil((l.y1 - l.y0) * scale); // resizing also clears it
      const lctx = l.canvas.getContext('2d')!;
      lctx.setTransform(scale, 0, 0, scale, -l.x0 * scale, -l.y0 * scale);
      const main = this.ctx;
      this.ctx = lctx;
      paint(l.x0, l.y0, l.x1, l.y1);
      this.ctx = main;
    }
    // Copy it pixel for pixel, at a whole device pixel: scaling or a fractional offset would make the
    // browser resample the whole picture every frame, which is slow without a GPU (and blurs it).
    const ctx = this.ctx;
    const [sx, sy] = this.camera.toScreen(l.x0, l.y0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(l.canvas, Math.round(sx * this.dpr), Math.round(sy * this.dpr));
    ctx.restore();
  }

  /** Forest floor beyond the map, the grass, ore, stumps and decoration, and the shadow at the map's edge. */
  private paintGround(world: World, x0: number, y0: number, x1: number, y1: number): void {
    const s = world.state;
    const ctx = this.ctx;
    ctx.fillStyle = FOREST_FLOOR;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    this.drawGround(s.width, s.height);
    const decorate = this.camera.zoom >= 14;
    for (let y = Math.max(0, y0); y < Math.min(s.height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(s.width, x1); x++) {
        const i = world.idx(x, y);
        const r = s.resources[i];
        if (r) this.drawNode(r, x, y);
        else if (s.trees[i] === STUMP) this.drawSprite('terrain/stump', x, y, 1, ((hash(x, y) % 4) * Math.PI) / 2);
        else if (decorate && !world.tiles[i] && !s.trees[i]) this.drawDecoration(x, y);
      }
    }
    this.drawMapEdge(s.width, s.height);
    const tint = SEASON_TINT[this.season];
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  /**
   * Night (#42): a dark blue wash over the map, with pools of light around the hub, the engineer,
   * turrets and working machines so the factory stays readable. Fades in at dusk and out at dawn.
   */
  private drawNight(world: World, x0: number, y0: number, x1: number, y1: number): void {
    const dark = darkness(world.state.time);
    if (dark <= 0) return;
    const { width, height } = this.night;
    const w = Math.ceil(this.camera.width * this.dpr);
    const h = Math.ceil(this.camera.height * this.dpr);
    if (width !== w || height !== h) [this.night.width, this.night.height] = [w, h];
    const nctx = this.night.getContext('2d')!;
    nctx.setTransform(1, 0, 0, 1, 0, 0);
    nctx.globalCompositeOperation = 'source-over';
    nctx.clearRect(0, 0, w, h);
    nctx.fillStyle = `rgba(${NIGHT.color},${NIGHT.alpha * dark})`;
    nctx.fillRect(0, 0, w, h);
    // Lights cut holes in the dark.
    nctx.globalCompositeOperation = 'destination-out';
    const scale = this.camera.zoom * this.dpr;
    const light = (x: number, y: number, r: number) => {
      const [sx, sy] = this.camera.toScreen(x, y);
      const px = sx * this.dpr;
      const py = sy * this.dpr;
      const pr = r * scale;
      const g = nctx.createRadialGradient(px, py, pr * 0.2, px, py, pr);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = g;
      nctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    };
    let lights = 0;
    for (const b of world.state.buildings) {
      if (lights > 60) break;
      const [fw, fh] = world.footprintOf(b);
      if (b.x + fw < x0 - 6 || b.y + fh < y0 - 6 || b.x > x1 + 6 || b.y > y1 + 6) continue;
      const working = (isMachine(b.type) || b.type === 'extractor') && b.progress >= 0;
      const r = b.type === 'hub' ? 8 : TURRETS[b.type] || b.type === 'repair' ? 3 : working ? 2.2 : 0;
      if (!r) continue;
      const [cx, cy] = world.centreOf(b);
      light(cx, cy, r);
      lights++;
    }
    for (const p of world.state.players) light(p.x, p.y, 4);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.night, 0, 0);
    ctx.restore();
  }

  private drawGround(w: number, h: number): void {
    const ctx = this.ctx;
    const img = sprite(SEASON_ART[this.season].ground) ?? sprite('terrain/ground');
    // A pattern belongs to the context it was made in, and the ground is painted rarely, so make it each time.
    const pattern = img ? ctx.createPattern(img, 'repeat') : null;
    pattern?.setTransform(new DOMMatrix().scale(1 / img!.width));
    ctx.fillStyle = pattern ?? '#2e4d33';
    ctx.fillRect(0, 0, w, h);
  }

  /** Grass tufts, flowers, mushrooms and pebbles on some empty tiles, the same every time. */
  private drawDecoration(x: number, y: number): void {
    const h = hash(x, y);
    const pick = h % 100;
    const key = pick < 14 ? 'terrain/tuft' : pick < 18 ? 'terrain/flowers' : pick < 21 ? 'terrain/flowers_blue' : pick < 23 ? 'terrain/pebbles' : pick < 24 ? 'terrain/mushrooms' : '';
    if (!key) return;
    // Under the snow, only pebbles and mushrooms show (D-082).
    if (this.season === 'winter' && pick < 21 && sprite('terrain/ground_winter')) return;
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

  /**
   * Trees on the map (D-044). Canopies spill a little over neighbouring tiles,
   * so a forest reads as one mass. Zoomed far out, each is a plain square.
   */
  private drawTrees(world: World, x0: number, y0: number, x1: number, y1: number, z: number): void {
    const trees = world.state.trees;
    const ctx = this.ctx;
    if (z < 12) {
      ctx.fillStyle = FOREST_CANOPY;
      ctx.beginPath();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (trees[world.idx(x, y)] === TREE) ctx.rect(x - 0.05, y - 0.05, 1.1, 1.1);
      ctx.fill();
      return;
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (trees[world.idx(x, y)] !== TREE) continue;
        const hv = hash(x + 5000, y + 5000);
        const kind = hv % 10;
        // Each season has its own trees (#42, D-082); a few broadleaf trees are already turning in summer.
        const art = SEASON_ART[this.season];
        const pine = kind >= 5 && kind < 9;
        const key = this.season === 'summer' && kind === 9 ? 'terrain/tree_autumn' : pine ? art.pine : art.round;
        const size = 1.35 + ((hv >>> 8) % 30) / 100;
        const jx = ((hv >>> 12) % 20) / 100 - 0.1;
        const jy = ((hv >>> 20) % 20) / 100 - 0.1;
        const at: [number, number, number, number] = [x + 0.5 + jx - size / 2, y + 0.5 + jy - size / 2, size, (((hv >>> 4) % 8) * Math.PI) / 4];
        if (this.drawSprite(key, ...at) || this.drawSprite(pine ? 'terrain/tree_pine' : 'terrain/tree_round', ...at)) {
          if (art.over) this.drawSprite(art.over[pine ? 1 : 0], ...at); // snow and frost settle on top
        } else {
          ctx.fillStyle = FOREST_CANOPY;
          dot(ctx, x + 0.5, y + 0.5, 0.55);
        }
      }
    }
  }

  /** Winter frost on the trees drawn into a cached canopy (only where trees were painted), until their winter art loads. */
  private frostTrees(x0: number, y0: number, x1: number, y1: number): void {
    if (this.season !== 'winter' || sprite('terrain/tree_round_winter')) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(236,243,255,0.42)';
    ctx.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
    ctx.restore();
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

  private drawBelt(b: Building, look: BeltLook, z: number): void {
    if (look.curved) return this.drawCurvedBelt(b, look.from, z);
    const ctx = this.ctx;
    const angle = (b.dir * Math.PI) / 2;
    if (!this.drawSprite(`buildings/${b.type}`, b.x, b.y, 1, angle)) {
      ctx.fillStyle = BELT_SURFACE;
      ctx.fillRect(b.x, b.y + 0.06, 1, 0.88);
    }
    const dx = DX[b.dir];
    const dy = DY[b.dir];
    // Along the belt (u) and across it (v), from the tile's centre.
    const at = (u: number, v: number): [number, number] => [b.x + 0.5 + dx * u - dy * v, b.y + 0.5 + dy * u + dx * v];
    // Moving chevrons show the direction of travel.
    const arrows = this.beltArrows(b, z);
    ctx.strokeStyle = BELT_SLAT;
    ctx.lineWidth = 2.5 / z;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const t of arrows) {
      const u = t - 0.5;
      ctx.moveTo(...at(u - 0.1, -0.24));
      ctx.lineTo(...at(u + 0.04, 0));
      ctx.lineTo(...at(u - 0.1, 0.24));
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Caps where a line starts or stops: a lip at the start, a hazard bumper at the end.
    if (!look.fed) {
      ctx.fillStyle = b.type === 'express_belt' ? EXPRESS_RAIL : BELT_RAIL;
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
    // Two lanes (#61): left and right of the middle, looking the way the belt runs.
    for (const it of b.belt) this.drawItem(it.item, ...this.smooth(it, ...at(it.pos - 0.5, it.lane === LEFT ? -LANE_OFFSET : LANE_OFFSET)), ITEM_ON_BELT);
  }

  /**
   * Where along a belt tile (0–1) its arrows are drawn this frame. Close up, four arrows a tile slide
   * along with the items. Zoomed out they'd be a few pixels apart, moving under a pixel a frame, which
   * strobes (#66): then one still arrow sits in the middle of the tile and the items show the movement.
   */
  private beltArrows(b: Building, z: number): number[] {
    if (z < STILL_BELTS_BELOW) return [0.55];
    const out: number[] = [];
    for (let t = this.beltPhaseOf(b); t < 1; t += 0.25) out.push(t);
    return out;
  }

  /** A belt's arrow offset for this frame: moved on by game time unless the belt is backed up. */
  private beltPhaseOf(b: Building): number {
    let p = this.beltPhase.get(b.id) ?? 0;
    const blocked = b.belt.length > 0 && b.belt[0].pos >= 1;
    if (!blocked) p = (p + beltSpeed(b.type) * this.frameDt) % 0.25;
    this.beltPhase.set(b.id, p);
    return p;
  }

  /**
   * Where to draw something that moves each tick (an item, a bug): part way from where it was on the
   * previous tick to where it is now. The game ticks 20 times a second and the screen draws 60, so
   * drawing the tick's position alone makes things move in small jumps (#49). Jumps of over a tile
   * (an item handed on far, a game loaded) aren't smoothed.
   */
  private smooth(obj: object, x: number, y: number): [number, number] {
    const t = this.world!.state.time;
    let r = this.smoothed.get(obj);
    if (!r) {
      r = { t, x, y, px: x, py: y };
      this.smoothed.set(obj, r);
    } else if (r.t !== t) {
      const recent = t - r.t <= TICK * 4; // seen a moment ago: move on from there
      r.px = recent ? r.x : x;
      r.py = recent ? r.y : y;
      r.x = x;
      r.y = y;
      r.t = t;
    }
    if (Math.abs(r.x - r.px) + Math.abs(r.y - r.py) > 1) return [x, y];
    return [r.px + (r.x - r.px) * this.alpha, r.py + (r.y - r.py) * this.alpha];
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
  private drawCurvedBelt(b: Building, from: Dir, z: number): void {
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
      ctx.fillStyle = b.type === 'express_belt' ? EXPRESS_RAIL : BELT_RAIL;
      ring(r0, r1);
      ctx.fill();
      ctx.stroke();
    }
    // Rivets on the outer rail.
    ctx.fillStyle = '#8a96a8';
    for (const t of [0.15, 0.5, 0.85]) dot(ctx, px + Math.cos(a0 + sweep * t) * 0.885, py + Math.sin(a0 + sweep * t) * 0.885, 0.025);
    // Slats fan out around the bend.
    const arrows = this.beltArrows(b, z);
    ctx.strokeStyle = BELT_SLAT;
    ctx.lineWidth = 2.5 / z;
    ctx.beginPath();
    for (const t of arrows) {
      const a = a0 + sweep * t;
      ctx.moveTo(px + Math.cos(a) * 0.22, py + Math.sin(a) * 0.22);
      ctx.lineTo(px + Math.cos(a) * 0.8, py + Math.sin(a) * 0.8);
    }
    ctx.stroke();
    // The left lane is on the outside of a turn one way and the inside the other.
    const side = Math.sign(sweep);
    for (const it of b.belt) {
      const a = a0 + sweep * it.pos;
      const r = 0.5 + (it.lane === LEFT ? side : -side) * LANE_OFFSET;
      this.drawItem(it.item, ...this.smooth(it, px + Math.cos(a) * r, py + Math.sin(a) * r), ITEM_ON_BELT);
    }
  }

  /** Metal flanges where a belt meets a building, so the line reads as plugged in. */
  private drawJoins(world: World, b: Building, look: BeltLook, z: number): void {
    const sides: Dir[] = [];
    const feeder = look.fed ? world.buildingAt(b.x + DX[look.from], b.y + DY[look.from]) : undefined;
    if (feeder && !isBelt(feeder.type)) sides.push(look.from);
    const front = world.buildingAt(b.x + DX[b.dir], b.y + DY[b.dir]);
    if (look.joined && front && !isBelt(front.type) && !hubCornerAhead(world, b)) sides.push(b.dir);
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

  /**
   * A belt feeding one of the hub's corner tiles carries on into that tile, drawn before the hub: the
   * hub's corners are cut off, so the belt shows in the gap and seems to run under its wall (#78).
   */
  private drawUnderHub(b: Building): void {
    const x = b.x + DX[b.dir];
    const y = b.y + DY[b.dir];
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, 1, 1);
    ctx.clip();
    if (!this.drawSprite(`buildings/${b.type}`, x, y, 1, (b.dir * Math.PI) / 2)) {
      ctx.fillStyle = BELT_SURFACE;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
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
    if (TURRETS[b.type]) return `buildings/${b.type}_base`;
    if (b.type === 'wall' || b.type === 'palisade') {
      const key = `buildings/${b.type}${runPiece(world, b)}`;
      return sprite(key) ? key : `buildings/${b.type}`;
    }
    if (b.type === 'hub' && b.hp < world.maxHp(b) / 2 && sprite('buildings/hub_damaged')) return 'buildings/hub_damaged';
    return `buildings/${b.type}`;
  }

  /** Dead, straw-coloured grass fading out around a nest's mound (blight). */
  private drawBlight(n: Nest): void {
    const ctx = this.ctx;
    const [cx, cy] = nestCentre(n);
    const r = NESTS.cell * 0.55;
    const g = ctx.createRadialGradient(cx, cy, 0.8, cx, cy, r);
    g.addColorStop(0, 'rgba(110,90,52,0.75)');
    g.addColorStop(0.5, 'rgba(138,122,66,0.45)');
    g.addColorStop(1, 'rgba(122,122,64,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }

  /** Cracks and smoke over a building's footprint once it's badly hurt (the hub has its own damaged sprite). */
  private drawDamage(world: World, b: Building, fw: number, fh: number): void {
    if (b.type === 'hub' || isBelt(b.type)) return;
    const health = b.hp / world.maxHp(b);
    const img = health < 0.25 ? sprite('effects/damage_2') : health < 0.5 ? sprite('effects/damage_1') : undefined;
    if (img) this.ctx.drawImage(img, b.x, b.y, fw, fh);
  }

  private drawBuilding(world: World, b: Building, now: number, z: number): void {
    const ctx = this.ctx;
    const def = BUILDINGS[b.type];
    const [fw, fh] = world.footprintOf(b);
    const big = fw * fh > 1;
    const directional = b.type !== 'hub' && b.type !== 'shipyard' && b.type !== 'wall' && b.type !== 'palisade' && b.type !== 'repair' && !TURRETS[b.type];
    // A launching ship shakes the whole shipyard.
    const shake = b.type === 'shipyard' && launching(world) ? 0.03 * Math.sin(now / 23) : 0;
    if (shake) ctx.translate(shake, 0);

    // Working machines run their animation (D-082), on game time so it stops when the game pauses.
    const working =
      ((isMachine(b.type) || b.type === 'extractor' || b.type === 'lumber_camp') && b.progress >= 0 && b.outputs.length < 3) ||
      (b.type === 'repair' && world.healed.some((h) => h.by === b.id && h.age < 0.6));
    const key = this.spriteKey(world, b);
    const anim = working && key === `buildings/${b.type}` ? frame(`buildings/${b.type}_working`, world.state.time * 8 + b.id) : undefined;
    if (!this.drawSpriteRect(key, b.x, b.y, fw, fh, directional ? b.dir : 0, anim ?? sprite(key))) {
      ctx.fillStyle = def.color;
      ctx.fillRect(b.x + 0.08, b.y + 0.08, fw - 0.16, fh - 0.16);
      if (directional && !big) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        arrowHead(ctx, b.x + 0.5 + DX[b.dir] * 0.36, b.y + 0.5 + DY[b.dir] * 0.36, b.dir, 0.12);
      }
    }
    // A splitter's sprite shows both its outputs; other big buildings mark their one output.
    if (big && directional && b.type !== 'splitter') this.drawOutputPort(world, b, z);

    // Working machines glow and pulse.
    if (working && b.type !== 'repair') {
      const pulse = 0.5 + 0.5 * Math.sin(now / 120 + b.id);
      const glow =
        b.type === 'furnace' ? '255,150,60' : b.type === 'extractor' || b.type === 'lumber_camp' ? '160,220,90' : b.type === 'sawmill' ? '230,190,120' : '120,190,255';
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

    if (b.type === 'splitter' && b.outputs.length) {
      const [cx, cy] = world.centreOf(b);
      this.drawItem(b.outputs[0], cx, cy, 0.34);
    }
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
    if (b.type === 'lumber_camp') {
      if (b.progress >= 0) bar(ctx, b.x + 0.12, b.y + fh - 0.14, fw - 0.24, b.progress / LUMBER.period, '#8fd18f');
      this.drawBadge('log', b.x + fw - 1, b.y);
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
    this.drawDamage(world, b, fw, fh);
    if (shake) ctx.translate(-shake, 0);
    const maxHp = world.maxHp(b);
    if (b.hp < maxHp) bar(ctx, b.x + 0.1, b.y + 0.02, fw - 0.2, b.hp / maxHp, b.hp / maxHp > 0.35 ? '#7bd389' : '#e0445a');
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
    if (ship.returnAt != null) return; // away at the colony: an empty pad
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
    spot: Spot,
    dir: Dir,
    z: number,
    opts: { ok?: boolean; range?: boolean; dashed?: boolean; replaceBelt?: boolean; exit?: boolean; keepDir?: boolean } = {},
  ): void {
    const ctx = this.ctx;
    let { x, y } = spot;
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
    ({ x, y, dir } = placementAt(world, tool, spot, dir, replaceBelt, opts.keepDir));
    const [fw, fh] = footprint(tool, dir);
    const ok = opts.ok ?? !world.checkPlace(tool, x, y, dir, replaceBelt);
    const turret = !!TURRETS[tool];
    const directional = tool !== 'wall' && tool !== 'palisade' && tool !== 'repair' && tool !== 'port' && tool !== 'shipyard' && !turret;
    const key = tool === 'tunnel' ? (opts.exit || world.findTunnelEntrance(x, y, dir) ? 'buildings/tunnel_out' : 'buildings/tunnel_in') : turret ? `buildings/${tool}_base` : `buildings/${tool}`;
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
      // A splitter sends items out of its second lane too.
      if (tool === 'splitter') arrowHead(ctx, ox + (dir % 2) + DX[dir] * 0.62, oy + ((dir + 1) % 2) + DY[dir] * 0.62, dir, 0.14);
    }
    const range = TURRETS[tool]?.range ?? (tool === 'repair' ? REPAIR.range : tool === 'lumber_camp' ? LUMBER.range : 0);
    if (range && opts.range !== false) rangeCircle(ctx, x + fw / 2, y + fh / 2, range, z);
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
      if (sh.jump) continue; // starts at a bug, not a turret
      const b = world.buildingAt(Math.floor(sh.x1), Math.floor(sh.y1));
      const aim = Math.atan2(sh.y2 - sh.y1, sh.x2 - sh.x1);
      if (b) this.aims.set(b.id, aim);
      if (!sh.arc) {
        // A flash at the barrel tip, and a spark where the shot lands (D-082).
        const reach = b?.type === 'hub' ? 0.72 : 0.48;
        this.spriteFx('effects/muzzle_flash', sh.x1 + Math.cos(aim) * reach, sh.y1 + Math.sin(aim) * reach, b?.type === 'hub' ? 0.8 : 0.6, 160, now, aim);
        if (!sh.splash) this.spriteFx('effects/hit_spark', sh.x2, sh.y2, 0.6, 200, now);
      }
      // The explosion goes off as the shell lands.
      if (sh.splash && !this.spriteFx('effects/explosion', sh.x2, sh.y2, sh.splash * 2.2, 550, now + 90)) {
        this.effects.push({ kind: 'blast', x: sh.x2, y: sh.y2, r: sh.splash, born: now, life: 350, color: '255,170,70' });
      }
    }

    const alive = new Set<number>();
    for (const e of s.enemies) {
      alive.add(e.id);
      const prev = this.enemies.get(e.id);
      let angle = prev?.angle ?? 0;
      let walked = prev?.walked ?? 0;
      let movedAt = prev?.movedAt ?? s.time;
      if (prev) {
        const dx = e.x - prev.x;
        const dy = e.y - prev.y;
        if (dx * dx + dy * dy > 1e-6) {
          angle = Math.atan2(dy, dx);
          movedAt = s.time;
        }
        walked += Math.hypot(dx, dy);
      }
      this.enemies.set(e.id, { x: e.x, y: e.y, angle, type: e.type, walked, movedAt });
    }
    // Trees cut by a Lumber Camp: a burst of leaves.
    for (const f of world.felled) {
      if (this.seenFelled.has(f)) continue;
      this.seenFelled.add(f);
      if (!this.spriteFx('effects/leaf_burst', f.x + 0.5, f.y + 0.5, 1.7, 650, now)) {
        this.effects.push({ kind: 'puff', x: f.x + 0.5, y: f.y + 0.5, r: 0.8, born: now, life: 500, color: '127,174,79' });
      }
    }
    // Buildings lost to bugs fly apart; mended ones sparkle.
    for (const l of world.lost) {
      if (this.seenFelled.has(l)) continue;
      this.seenFelled.add(l);
      this.spriteFx('effects/debris', l.x, l.y, 1 + l.size * 0.5, 650, now);
    }
    for (const h of world.healed) {
      if (this.seenFelled.has(h)) continue;
      this.seenFelled.add(h);
      this.spriteFx('effects/repair_sparkle', h.x, h.y, 0.9, 500, now);
    }

    // Mining by hand (#38): sparks on every tap, and a puff of the ore when one comes loose.
    for (const tap of world.taps) {
      if (this.seenTaps.has(tap)) continue;
      this.seenTaps.add(tap);
      this.effects.push({ kind: 'sparks', x: tap.x + 0.5, y: tap.y + 0.5, r: 0.55, born: now, life: 260, color: '255,214,120' });
      if (tap.item) this.effects.push({ kind: 'puff', x: tap.x + 0.5, y: tap.y + 0.5, r: 0.9, born: now, life: 450, color: hexRgb(ITEMS[tap.item].color) });
    }

    const breached = s.breaches !== this.breaches;
    for (const [id, e] of this.enemies) {
      if (alive.has(id)) continue;
      this.enemies.delete(id);
      if (!breached && !this.spriteFx('effects/death_splat', e.x, e.y, ENEMIES[e.type].radius * 4.5, 500, now, e.angle)) {
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

  /** Whether an angry bug standing still is at something it bites: a building beside it, or an engineer. */
  private biting(world: World, e: Enemy, radius: number): boolean {
    const n = world.state.nests.find((q) => q.id === e.nest);
    if (!e.raid && !(n && isAngry(world, n))) return false;
    const reach = radius + 0.55;
    for (const [dx, dy] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach]]) {
      if (world.buildingAt(Math.floor(e.x + dx), Math.floor(e.y + dy))) return true;
    }
    return world.state.players.some((p) => p.downUntil == null && Math.hypot(p.x - e.x, p.y - e.y) <= radius + 0.45);
  }

  /** Plays a strip once at (x, y), `size` tiles across, over `life` ms from `at`. False if it isn't loaded. */
  private spriteFx(key: string, x: number, y: number, size: number, life: number, at: number, angle = 0): boolean {
    if (!frameCount(key)) return false;
    this.effects.push({ kind: 'sprite', x, y, r: size, born: at, life, color: key, angle });
    return true;
  }

  private drawShots(world: World, now: number, z: number): void {
    const ctx = this.ctx;
    for (const sh of world.shots) {
      const fade = 1 - sh.age / 0.12;
      if (sh.arc) {
        this.drawArc(sh, fade, z);
        continue;
      }
      if (sh.splash && sprite('effects/cannon_shell')) {
        // A cannon's shell flies the length of the shot in its moment on screen (D-082).
        const u = Math.min(1, (sh.age + this.alpha * TICK) / 0.1);
        const aim = Math.atan2(sh.y2 - sh.y1, sh.x2 - sh.x1);
        this.drawSprite('effects/cannon_shell', sh.x1 + (sh.x2 - sh.x1) * u - 0.2, sh.y1 + (sh.y2 - sh.y1) * u - 0.2, 0.4, aim);
        continue;
      }
      ctx.strokeStyle = `rgba(255,224,138,${fade})`;
      ctx.lineWidth = (sh.splash ? 3 : 1.5) / z;
      ctx.beginPath();
      ctx.moveTo(sh.x1, sh.y1);
      ctx.lineTo(sh.x2, sh.y2);
      ctx.stroke();
      if (sh.age < 0.06 && !frameCount('effects/muzzle_flash')) {
        // Muzzle flash at the barrel tip (drawn as a sprite effect once that has loaded).
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

  /** A tesla's lightning: a jagged bolt with a soft glow, different every frame. */
  private drawArc(sh: Shot, fade: number, z: number): void {
    const ctx = this.ctx;
    const dx = sh.x2 - sh.x1;
    const dy = sh.y2 - sh.y1;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.max(3, Math.round(len * 3));
    const pts: [number, number][] = [[sh.x1, sh.y1]];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const off = (Math.random() - 0.5) * 0.35;
      pts.push([sh.x1 + dx * t - (dy / len) * off, sh.y1 + dy * t + (dx / len) * off]);
    }
    pts.push([sh.x2, sh.y2]);
    for (const [width, color] of [[6, `rgba(120,200,255,${0.35 * fade})`], [2, `rgba(235,248,255,${fade})`]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width / z;
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      for (const p of pts.slice(1)) ctx.lineTo(...p);
      ctx.stroke();
    }
  }

  /**
   * The characters (#40): an engineer heading the way it walks, a marker where it's going, and what
   * it carries trailing behind it.
   */
  private drawPlayers(world: World, now: number, z: number): void {
    const ctx = this.ctx;
    const t = world.state.time;
    for (const p of world.state.players) {
      if (p.downUntil != null) {
        // Knocked out (D-074): seeing stars where it fell, until it's back up at the hub (D-082).
        const was = this.players.get(p.id);
        if (was) this.drawFrame('units/engineer_ko', t * 6, was.x - 0.5, was.y - 0.5, 1, was.angle);
        continue;
      }
      let d = this.players.get(p.id);
      if (!d) {
        d = { x: p.x, y: p.y, angle: Math.PI / 2, walked: 0, trail: [[p.x, p.y]], at: now };
        this.players.set(p.id, d);
      }
      // Ease toward the true position, so 20 moves a second look smooth.
      const ease = Math.min(1, ((now - d.at) / 1000) * 14);
      d.at = now;
      const dx = (p.x - d.x) * ease;
      const dy = (p.y - d.y) * ease;
      if (Math.abs(p.x - d.x) + Math.abs(p.y - d.y) > 3) [d.x, d.y] = [p.x, p.y]; // a jump (a load): no gliding
      else {
        d.x += dx;
        d.y += dy;
      }
      const step = Math.hypot(dx, dy);
      if (step > 1e-4) {
        d.angle = Math.atan2(dy, dx);
        d.walked += step;
      }
      const last = d.trail[d.trail.length - 1];
      if (Math.hypot(d.x - last[0], d.y - last[1]) > 0.05) {
        d.trail.push([d.x, d.y]);
        if (d.trail.length > 400) d.trail.shift();
      }
      // Where it's heading.
      if (p.path.length) {
        const end = p.path[p.path.length - 1];
        const ex = (end % world.state.width) + 0.5;
        const ey = Math.floor(end / world.state.width) + 0.5;
        ctx.strokeStyle = 'rgba(255,214,120,0.8)';
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.arc(ex, ey, 0.25 + 0.05 * Math.sin(now / 150), 0, Math.PI * 2);
        ctx.stroke();
      }
      // Carried items follow in a line along the way it came.
      let gap = 0.55;
      let k = 0;
      for (let i = d.trail.length - 1; i > 0 && k < p.carry.length; i--) {
        const [ax, ay] = d.trail[i];
        const [bx, by] = d.trail[i - 1];
        gap -= Math.hypot(ax - bx, ay - by);
        if (gap > 0) continue;
        this.drawItem(p.carry[p.carry.length - 1 - k], bx, by, 0.36);
        gap = 0.32;
        k++;
      }
      for (; k < p.carry.length; k++) this.drawItem(p.carry[p.carry.length - 1 - k], d.x - 0.3 - 0.1 * k, d.y + 0.3, 0.3); // no room on the trail yet
      // In co-op, a ring in each player's colour tells the engineers apart.
      if (world.state.players.length > 1) {
        ctx.strokeStyle = PLAYER_COLORS[p.id % PLAYER_COLORS.length];
        ctx.lineWidth = 3 / z;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + 0.28, 0.36, 0.16, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const moving = p.path.length > 0 || !!p.walk;
      const frame = moving && Math.floor(d.walked / 0.35) % 2 ? '_b' : '';
      // A red flash just after a bite (D-074).
      const bitten = p.hurtAt != null && t - p.hurtAt < 0.25;
      if (bitten) ctx.filter = 'sepia(1) saturate(6) hue-rotate(-40deg)';
      // Walking, working (mining by hand), or idle, each its own strip (D-082).
      const working = !moving && !!p.mining && t - p.mining.at < 0.5;
      const [strip, i] = moving ? ['units/engineer_walk', d.walked / 0.2] : working ? ['units/engineer_work', t * 8] : ['units/engineer_idle', t * 2.5];
      if (working) {
        // Face the ore being mined.
        const w = world.state.width;
        d.angle = Math.atan2(Math.floor(p.mining!.tile / w) + 0.5 - d.y, (p.mining!.tile % w) + 0.5 - d.x);
      }
      const at: [number, number, number, number] = [d.x - 0.5, d.y - 0.5, 1, d.angle];
      if (!this.drawFrame(strip, i, ...at) && !this.drawSprite(`units/engineer${frame}`, ...at)) {
        ctx.fillStyle = '#ffcc33';
        dot(ctx, d.x, d.y, 0.3);
      }
      if (bitten) ctx.filter = 'none';
      if (p.hp < PLAYER.hp) bar(ctx, d.x - 0.35, d.y - 0.75, 0.7, p.hp / PLAYER.hp, '#7bd88f');
    }
  }

  /** A ring around each ore tile being mined by hand, filling with each tap (#38). */
  private drawHandMining(world: World, z: number): void {
    for (const p of world.state.players) {
      const m = p.mining;
      if (!m) continue;
      const x = m.tile % world.state.width;
      const y = Math.floor(m.tile / world.state.width);
      const taps = world.handMiningAt(x, y, p.id);
      if (taps) this.drawMiningRing(x, y, taps, z);
    }
  }

  private drawMiningRing(x: number, y: number, taps: number, z: number): void {
    const ctx = this.ctx;
    ctx.lineWidth = 3 / z;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,120,0.95)';
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, 0.42, -Math.PI / 2, -Math.PI / 2 + (taps / HAND_MINING.taps) * Math.PI * 2);
    ctx.stroke();
  }

  private drawEffects(now: number, z: number): void {
    const ctx = this.ctx;
    for (const fx of this.effects) {
      const t = (now - fx.born) / fx.life;
      const a = 1 - t;
      if (fx.kind === 'sprite') {
        if (t < 0) continue; // not started yet
        const n = frameCount(fx.color);
        const img = frame(fx.color, Math.min(n - 1, Math.floor(t * n)));
        if (img) this.drawCanvas(img, fx.x - fx.r / 2, fx.y - fx.r / 2, fx.r, fx.angle ?? 0);
      } else if (fx.kind === 'blast') {
        ctx.fillStyle = `rgba(${fx.color},${0.45 * a})`;
        dot(ctx, fx.x, fx.y, fx.r * (0.5 + 0.5 * t));
        ctx.strokeStyle = `rgba(255,240,200,${a})`;
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.r * (0.3 + 0.9 * t), 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'sparks') {
        // Short streaks flying out; each tap's set points a different way.
        ctx.strokeStyle = `rgba(${fx.color},${a})`;
        ctx.lineWidth = 1.5 / z;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const ang = fx.born * 0.37 + i * 1.3;
          const d0 = fx.r * t;
          const d1 = d0 + 0.18 * (1 - t);
          ctx.moveTo(fx.x + Math.cos(ang) * d0, fx.y + Math.sin(ang) * d0);
          ctx.lineTo(fx.x + Math.cos(ang) * d1, fx.y + Math.sin(ang) * d1);
        }
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

/** '#rrggbb' to 'r,g,b', for the effects' rgba() colours. */
function hexRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
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
