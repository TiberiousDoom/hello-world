// Mouse, touch and keyboard input.
//
// Mouse: left click/drag builds with the selected tool (or selects with no
// tool), right-click clears the tool and selection, right/middle drag pans.
// The wheel rotates the building being placed, and zooms otherwise
// (Ctrl+wheel, which is also a trackpad pinch, always zooms).
// Touch: one finger builds/selects like the left mouse button, or pans when
// no tool is selected; two fingers pan and pinch-zoom.

import { Dir } from '../sim/data';
import { PlaceError, World } from '../sim/world';
import { Camera } from '../render/camera';
import { UIState } from '../ui/state';

type Mode = 'none' | 'pending' | 'right' | 'pan' | 'paint' | 'pinch';

interface Tile {
  x: number;
  y: number;
}

export interface InputCallbacks {
  getWorld(): World;
  onPlaceError(err: PlaceError): void;
  onChange(): void; // UI state (selection, tool, direction) changed
}

const TAP_SLOP = 8; // px a pointer may move and still count as a tap
const WHEEL_STEP = 60; // wheel delta (px) per quarter turn, so trackpads don't spin wildly

export class Input {
  private pointers = new Map<number, { x: number; y: number }>();
  private mode: Mode = 'none';
  private downAt = { x: 0, y: 0 };
  private lastTile: Tile | null = null;
  private lastPlacedId: number | null = null;
  private reportedError = false;
  private pinch = { dist: 0, midX: 0, midY: 0 };
  private wheelTurn = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    private ui: UIState,
    private cb: InputCallbacks,
  ) {
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e, true));
    canvas.addEventListener('pointercancel', (e) => this.up(e, false));
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') ui.hover = null;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => this.wheel(e),
      { passive: false },
    );
    window.addEventListener('keydown', (e) => this.key(e));
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY;
    const tool = this.ui.tool;
    if (e.ctrlKey || !tool || tool === 'demolish') {
      const [x, y] = this.local(e);
      this.camera.zoomAt(x, y, Math.exp(-delta * 0.0015));
      return;
    }
    // Rotate the building being placed: wheel down turns clockwise.
    this.wheelTurn += delta;
    let turns = 0;
    while (Math.abs(this.wheelTurn) >= WHEEL_STEP) {
      const step = Math.sign(this.wheelTurn);
      turns += step;
      this.wheelTurn -= step * WHEEL_STEP;
    }
    if (turns) {
      this.ui.dir = ((((this.ui.dir + turns) % 4) + 4) % 4) as Dir;
      this.cb.onChange();
    }
  }

  /** Right-click: put down the tool and clear the selection (same as Esc). */
  private clearSelection(): void {
    this.ui.tool = null;
    this.ui.selected = null;
    this.cb.onChange();
  }

  private local(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private tileAt(x: number, y: number): Tile {
    const [wx, wy] = this.camera.toWorld(x, y);
    return { x: Math.floor(wx), y: Math.floor(wy) };
  }

  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    const [x, y] = this.local(e);
    this.pointers.set(e.pointerId, { x, y });
    this.ui.hover = this.tileAt(x, y);

    if (this.pointers.size === 2) {
      this.mode = 'pinch';
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    this.downAt = { x, y };
    if (e.pointerType === 'mouse' && e.button === 2) {
      this.mode = 'right'; // a click clears; a drag pans
    } else if (e.pointerType === 'mouse' && e.button !== 0) {
      this.mode = 'pan';
    } else if (this.ui.tool) {
      this.mode = 'paint';
      this.lastPlacedId = null;
      this.reportedError = false;
      this.lastTile = this.ui.hover;
      this.paintTile(this.ui.hover, this.ui.dir);
    } else {
      this.mode = 'pending';
    }
  }

  private move(e: PointerEvent): void {
    const [x, y] = this.local(e);
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === 'mouse') this.ui.hover = this.tileAt(x, y);
      return;
    }
    this.pointers.set(e.pointerId, { x, y });

    if (this.mode === 'pinch') {
      this.updatePinch();
      return;
    }
    this.ui.hover = this.tileAt(x, y);
    const moved = Math.hypot(x - this.downAt.x, y - this.downAt.y) > TAP_SLOP;
    if ((this.mode === 'pending' || this.mode === 'right') && moved) this.mode = 'pan';
    if (this.mode === 'pan') this.camera.pan(x - prev.x, y - prev.y);
    if (this.mode === 'paint') this.paintTo(this.ui.hover);
  }

  private up(e: PointerEvent, completed: boolean): void {
    if (!this.pointers.has(e.pointerId)) return;
    const [x, y] = this.local(e);
    this.pointers.delete(e.pointerId);
    if (completed && this.mode === 'pending') this.select(this.tileAt(x, y));
    if (completed && this.mode === 'right') this.clearSelection();
    if (e.pointerType !== 'mouse') this.ui.hover = null;
    // After a pinch, the remaining finger pans rather than building.
    this.mode = this.pointers.size === 1 ? 'pan' : 'none';
  }

  private startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
  }

  private updatePinch(): void {
    const [a, b] = [...this.pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    this.camera.pan(midX - this.pinch.midX, midY - this.pinch.midY);
    if (this.pinch.dist > 0) this.camera.zoomAt(midX, midY, dist / this.pinch.dist);
    this.pinch = { dist, midX, midY };
  }

  private select(t: Tile): void {
    const b = this.cb.getWorld().buildingAt(t.x, t.y);
    this.ui.selected = b ? b.id : null;
    this.cb.onChange();
  }

  /** Builds along a 4-connected line from the last painted tile to `t`. */
  private paintTo(t: Tile): void {
    const from = this.lastTile;
    if (!from || (from.x === t.x && from.y === t.y)) return;
    if (this.ui.tool === 'tunnel') return; // entrances and exits are placed one tap at a time
    const world = this.cb.getWorld();
    let { x, y } = from;
    while (x !== t.x || y !== t.y) {
      const dx = t.x - x;
      const dy = t.y - y;
      let dir: Dir;
      if (Math.abs(dx) >= Math.abs(dy)) {
        dir = dx > 0 ? 0 : 2;
        x += Math.sign(dx);
      } else {
        dir = dy > 0 ? 1 : 3;
        y += Math.sign(dy);
      }
      if (this.ui.tool === 'belt') {
        // Dragging belts points each one at the next.
        if (this.lastPlacedId != null) world.rotate(this.lastPlacedId, dir);
        if (this.ui.dir !== dir) {
          this.ui.dir = dir;
          this.cb.onChange();
        }
      }
      this.paintTile({ x, y }, this.ui.dir);
    }
    this.lastTile = t;
  }

  private paintTile(t: Tile, dir: Dir): void {
    const world = this.cb.getWorld();
    const tool = this.ui.tool;
    this.lastPlacedId = null;
    if (!tool) return;
    if (tool === 'demolish') {
      const b = world.buildingAt(t.x, t.y);
      if (b && world.demolish(b.id) && this.ui.selected === b.id) {
        this.ui.selected = null;
        this.cb.onChange();
      }
      return;
    }
    const result = world.place(tool, t.x, t.y, dir);
    if (typeof result === 'string') {
      // Report one error per drag, and never for dragging over existing buildings.
      if (result !== 'occupied' && result !== 'bounds' && !this.reportedError) {
        this.reportedError = true;
        this.cb.onPlaceError(result);
      }
    } else {
      this.lastPlacedId = result.id;
    }
  }

  private key(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || document.body.classList.contains('in-menu')) return;
    const k = e.key.toLowerCase();
    const pan = 40;
    if (k === 'r') {
      if (this.ui.tool) this.ui.dir = ((this.ui.dir + (e.shiftKey ? 3 : 1)) % 4) as Dir;
      else if (this.ui.selected != null) this.cb.getWorld().rotate(this.ui.selected);
    } else if (k === 'escape' || k === 'q') {
      this.ui.tool = null;
      this.ui.selected = null;
    } else if (k === 'x' || k === 'delete') {
      this.ui.tool = this.ui.tool === 'demolish' ? null : 'demolish';
    } else if (k === 'w' || k === 'arrowup') this.camera.pan(0, pan);
    else if (k === 's' || k === 'arrowdown') this.camera.pan(0, -pan);
    else if (k === 'a' || k === 'arrowleft') this.camera.pan(pan, 0);
    else if (k === 'd' || k === 'arrowright') this.camera.pan(-pan, 0);
    else return;
    e.preventDefault();
    this.cb.onChange();
  }
}
