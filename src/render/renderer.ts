// Canvas 2D renderer with placeholder art. It only reads the simulation, so a
// 3D renderer can replace it later behind the same draw() call.

import {
  BELT_SPEED,
  BUILDINGS,
  BuildingType,
  DX,
  DY,
  Dir,
  ENEMIES,
  HUB_SIZE,
  ITEMS,
  RECIPE_BY_ID,
  REPAIR,
  TURRETS,
  WAVE_WARNING,
  isMachine,
} from '../sim/data';
import { Building, World } from '../sim/world';
import { UIState } from '../ui/state';
import { Camera } from './camera';

const RESOURCE_COLORS = ['', '#5a4232', '#1f6e5c', '#6e6b64'];

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;

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

  draw(world: World, ui: UIState, now: number): void {
    const { ctx, camera } = this;
    const z = camera.zoom;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0d0f13';
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

    // Ground and resources.
    ctx.fillStyle = '#1a1d23';
    ctx.fillRect(0, 0, s.width, s.height);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const r = s.resources[world.idx(x, y)];
        if (!r) continue;
        ctx.fillStyle = RESOURCE_COLORS[r];
        ctx.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
        ctx.fillStyle = ITEMS[world.resourceAt(x, y)!].color;
        dot(ctx, x + 0.3, y + 0.35, 0.09);
        dot(ctx, x + 0.68, y + 0.3, 0.07);
        dot(ctx, x + 0.5, y + 0.7, 0.1);
      }
    }
    if (z >= 14) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      for (let x = x0; x <= x1 + 1; x++) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1 + 1);
      }
      for (let y = y0; y <= y1 + 1; y++) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1 + 1, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = '#3a4150';
    ctx.lineWidth = 2 / z;
    ctx.strokeRect(0, 0, s.width, s.height);

    // Belts first so items sit under nothing else.
    for (const b of s.buildings) if (b.type === 'belt' && visible(b.x, b.y)) this.drawBelt(b, now, z);
    for (const b of s.buildings) {
      if (b.type === 'belt') continue;
      const size = b.type === 'hub' ? HUB_SIZE : 1;
      if (visible(b.x, b.y, size)) this.drawBuilding(world, b, z);
    }

    // Spawn warnings.
    const untilWave = s.nextWaveAt - s.time;
    if (untilWave <= WAVE_WARNING) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 150);
      for (const p of s.nextSpawnPoints) {
        ctx.fillStyle = `rgba(224,68,90,${0.25 + 0.35 * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x + 0.5, p.y + 0.5, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e0445a';
        ctx.lineWidth = 2 / z;
        ctx.stroke();
      }
    }

    // Enemies.
    for (const e of s.enemies) {
      if (!visible(e.x - 1, e.y - 1, 2)) continue;
      const def = ENEMIES[e.type];
      ctx.fillStyle = def.color;
      dot(ctx, e.x, e.y, def.radius);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 / z;
      ctx.stroke();
      if (e.hp < e.maxHp) bar(ctx, e.x - 0.3, e.y - def.radius - 0.16, 0.6, e.hp / e.maxHp, '#e0445a');
    }

    // Shots.
    for (const sh of world.shots) {
      if (sh.splash > 0) {
        ctx.fillStyle = `rgba(255,190,90,${0.5 * (1 - sh.age / 0.12)})`;
        dot(ctx, sh.x2, sh.y2, sh.splash);
      }
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = (sh.splash ? 3 : 1.5) / z;
      ctx.beginPath();
      ctx.moveTo(sh.x1, sh.y1);
      ctx.lineTo(sh.x2, sh.y2);
      ctx.stroke();
    }

    // Selection and placement preview.
    const sel = ui.selected != null ? world.byId.get(ui.selected) : undefined;
    if (sel) {
      const size = sel.type === 'hub' ? HUB_SIZE : 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / z;
      ctx.strokeRect(sel.x, sel.y, size, size);
      const range = TURRETS[sel.type]?.range ?? (sel.type === 'repair' ? REPAIR.range : 0);
      if (range) rangeCircle(ctx, sel.x + 0.5, sel.y + 0.5, range, z);
      const partner = sel.link != null ? world.byId.get(sel.link) : undefined;
      if (partner) linkLine(ctx, sel, partner, z);
    }
    if (ui.hover && ui.tool) this.drawGhost(world, ui.tool, ui.hover.x, ui.hover.y, ui.dir, z);
  }

  private drawBelt(b: Building, now: number, z: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = BUILDINGS.belt.color;
    ctx.fillRect(b.x + 0.06, b.y + 0.06, 0.88, 0.88);
    // Animated chevrons show direction.
    const phase = ((now / 1000) * BELT_SPEED) % 0.5;
    ctx.strokeStyle = '#555c6b';
    ctx.lineWidth = 2 / z;
    for (const o of [0, 0.5]) {
      const t = o + phase - 0.25;
      if (t < -0.35 || t > 0.35) continue;
      chevron(ctx, b.x + 0.5, b.y + 0.5, b.dir, t, 0.18);
    }
    for (const it of b.belt) {
      const t = it.pos - 0.5;
      const cx = b.x + 0.5 + DX[b.dir] * t;
      const cy = b.y + 0.5 + DY[b.dir] * t;
      ctx.fillStyle = ITEMS[it.item].color;
      dot(ctx, cx, cy, 0.16);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1 / z;
      ctx.stroke();
    }
  }

  private drawBuilding(world: World, b: Building, z: number): void {
    const ctx = this.ctx;
    const def = BUILDINGS[b.type];
    const size = b.type === 'hub' ? HUB_SIZE : 1;
    const inset = b.type === 'wall' ? 0.02 : 0.08;
    ctx.fillStyle = def.color;
    ctx.fillRect(b.x + inset, b.y + inset, size - inset * 2, size - inset * 2);

    if (b.type === 'wall') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5 / z;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 0.5);
      ctx.lineTo(b.x + 1, b.y + 0.5);
      ctx.moveTo(b.x + 0.5, b.y);
      ctx.lineTo(b.x + 0.5, b.y + 0.5);
      ctx.moveTo(b.x + 0.25, b.y + 0.5);
      ctx.lineTo(b.x + 0.25, b.y + 1);
      ctx.moveTo(b.x + 0.75, b.y + 0.5);
      ctx.lineTo(b.x + 0.75, b.y + 1);
      ctx.stroke();
    }

    if (b.type === 'splitter') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const d of [b.dir, (b.dir + 1) % 4, (b.dir + 3) % 4] as Dir[]) {
        arrowHead(ctx, b.x + 0.5 + DX[d] * 0.33, b.y + 0.5 + DY[d] * 0.33, d, 0.1);
      }
      if (b.outputs.length) {
        ctx.fillStyle = ITEMS[b.outputs[0]].color;
        dot(ctx, b.x + 0.5, b.y + 0.5, 0.14);
      }
    }

    if (b.type === 'tunnel') {
      // Dark mouth on the side that leads underground.
      const exit = world.isTunnelExit(b);
      const m = exit ? -1 : 1;
      ctx.fillStyle = '#0b0d11';
      ctx.beginPath();
      ctx.arc(b.x + 0.5 + DX[b.dir] * 0.42 * m, b.y + 0.5 + DY[b.dir] * 0.42 * m, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.link == null ? '#e0a040' : 'rgba(255,255,255,0.75)';
      arrowHead(ctx, b.x + 0.5 - DX[b.dir] * 0.05 * m, b.y + 0.5 - DY[b.dir] * 0.05 * m, b.dir, 0.13);
    }

    if (b.type === 'repair') bar(ctx, b.x + 0.12, b.y + 0.8, 0.76, b.ammo / REPAIR.maxCharge, ITEMS.iron_plate.color);

    const turret = TURRETS[b.type];
    if (turret) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      dot(ctx, b.x + 0.5, b.y + 0.5, 0.3);
      bar(ctx, b.x + 0.12, b.y + 0.8, 0.76, b.ammo / turret.maxShots, ITEMS[turret.ammoItem].color);
    }

    if (b.type === 'extractor' || isMachine(b.type)) {
      // Output side marker.
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      arrowHead(ctx, b.x + 0.5 + DX[b.dir] * 0.36, b.y + 0.5 + DY[b.dir] * 0.36, b.dir, 0.12);
      const recipe = b.recipe ? RECIPE_BY_ID[b.recipe] : undefined;
      if (recipe && b.progress >= 0) bar(ctx, b.x + 0.12, b.y + 0.8, 0.76, b.progress / recipe.time, '#8fd18f');
      if (recipe) {
        ctx.fillStyle = ITEMS[recipe.output].color;
        dot(ctx, b.x + 0.78, b.y + 0.22, 0.1);
      }
    }

    if (z >= 18 && def.short) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${b.type === 'hub' ? 0.6 : b.type === 'repair' ? 0.5 : 0.3}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.short, b.x + size / 2, b.y + size / 2);
    }

    if (b.hp < def.hp) bar(ctx, b.x + 0.1, b.y + 0.04, size - 0.2, b.hp / def.hp, b.hp / def.hp > 0.35 ? '#7bd389' : '#e0445a');
  }

  private drawGhost(world: World, tool: BuildingType | 'demolish', x: number, y: number, dir: Dir, z: number): void {
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
    const ok = !world.checkPlace(tool, x, y);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ok ? BUILDINGS[tool].color : '#a03040';
    ctx.fillRect(x + 0.06, y + 0.06, 0.88, 0.88);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? '#ffffff' : '#ff6070';
    ctx.lineWidth = 2 / z;
    ctx.strokeRect(x + 0.06, y + 0.06, 0.88, 0.88);
    if (tool !== 'wall' && tool !== 'repair' && !TURRETS[tool]) {
      ctx.fillStyle = '#ffffff';
      arrowHead(ctx, x + 0.5 + DX[dir] * 0.3, y + 0.5 + DY[dir] * 0.3, dir, 0.16);
    }
    const range = TURRETS[tool]?.range ?? (tool === 'repair' ? REPAIR.range : 0);
    if (range) rangeCircle(ctx, x + 0.5, y + 0.5, range, z);
    if (tool === 'tunnel' && ok) {
      const entrance = world.findTunnelEntrance(x, y, dir);
      if (entrance) linkLine(ctx, entrance, { x, y }, z);
    }
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, w, 0.09);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 0.09);
}

function rangeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, z: number): void {
  ctx.fillStyle = 'rgba(120,200,255,0.07)';
  ctx.strokeStyle = 'rgba(120,200,255,0.5)';
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

function chevron(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: Dir, t: number, s: number): void {
  const fx = DX[dir];
  const fy = DY[dir];
  const x = cx + fx * t;
  const y = cy + fy * t;
  ctx.beginPath();
  ctx.moveTo(x - fx * s - fy * s, y - fy * s + fx * s);
  ctx.lineTo(x, y);
  ctx.lineTo(x - fx * s + fy * s, y - fy * s - fx * s);
  ctx.stroke();
}

