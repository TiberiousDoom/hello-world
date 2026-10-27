// Mouse, touch and keyboard input.
//
// Mouse: left click/drag builds with the selected tool (or selects with no
// tool), right-click clears the tool and selection, right/middle drag pans.
// A middle-click on a building (or, on touch, holding a finger still on one)
// picks it: its kind becomes the tool in hand, facing the same way.
// The wheel rotates the building being placed, and zooms otherwise
// (Ctrl+wheel, which is also a trackpad pinch, always zooms).
// Touch: one finger builds/selects like the left mouse button, or pans when
// no tool is selected; two fingers pan and pinch-zoom.
//
// Soft placement (D-030): on touch (unless switched off), and on desktop when
// dragging out a belt or wall line, building first shows a blueprint to
// confirm (✓, Enter), rotate (⟳, R, wheel) or cancel (✕, Esc, right-click).
// Dragging back along a blueprint shortens it.
//
// A single building (anything not drawn as a line) can be dragged into place:
// pressing with it in hand starts a blueprint that follows the pointer. On
// desktop a click without a drag still builds at once; after a drag the
// blueprint waits for a click on it (or Enter, or ✓). Pressing a waiting
// blueprint moves it, and tapping or clicking it builds it.
//
// With nothing in hand, tapping or clicking bare ore mines it by hand (#38), and a tree chops it
// (D-093); holding the finger or button down keeps mining. Dragging from there pans, as usual.
//
// The character (#40): with nothing in hand, tapping or clicking empty ground walks there, and the
// character walks over by itself to mine or fetch things. WASD or the arrow keys walk it directly.

import { BuildingType, DX, DY, Dir, HAND_MINING, TUNNEL_RANGE, footprint, isBelt } from '../sim/data';
import { planSteps, tunnelExitSpot } from '../ui/plan';
import type { Command, ResultOf } from '../sim/commands';
import { PlaceError, TREE, World } from '../sim/world';
import { Camera } from '../render/camera';
import { buzz } from './haptics';
import { Plan, UIState, isBeltPath, isBig, placementAt, planDirs, turnTool } from '../ui/state';

type Mode = 'none' | 'pending' | 'right' | 'middle' | 'pan' | 'paint' | 'plan' | 'move' | 'pinch' | 'mine';

interface Tile {
  x: number;
  y: number;
  fx?: number;
  fy?: number;
}

export interface InputCallbacks {
  getWorld(): World;
  /** Changes the world (D-058); the world itself is only read here. */
  /** Undefined in co-op: the command is on its way, and applies a few ticks later (D-078). */
  issue<C extends Command>(command: C): ResultOf<C> | undefined;
  onPlaceError(err: PlaceError): void;
  /** A short message for the player, such as full hands. */
  onNotice(text: string): void;
  /** Points at a tile for the other players (co-op, D-080). False when there's no one to point for. */
  ping(x: number, y: number): boolean;
  onChange(): void; // UI state (selection, tool, direction) changed
}

const WALK_KEYS: Record<string, [number, number]> = {
  w: [0, -1],
  arrowup: [0, -1],
  s: [0, 1],
  arrowdown: [0, 1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
};
const TAP_SLOP = 8; // px a pointer may move and still count as a tap
const WHEEL_STEP = 60; // wheel delta (px) per quarter turn, so trackpads don't spin wildly
const LONG_PRESS = 450; // ms a finger rests on a building to pick it
/** Tools drawn out as lines by dragging; everything else is dragged into place. */
const LINE_TOOLS: readonly string[] = ['belt', 'express_belt', 'roller', 'wall', 'reinforced_wall', 'palisade', 'shaft'];

export class Input {
  private pointers = new Map<number, { x: number; y: number }>();
  private mode: Mode = 'none';
  private downAt = { x: 0, y: 0 };
  private lastTile: Tile | null = null;
  /** The belt (or other building) this drag just placed, which the next tile may turn. */
  private lastPlaced: { x: number; y: number; type: BuildingType } | null = null;
  private reportedError = false;
  private pinch = { dist: 0, midX: 0, midY: 0 };
  private wheelTurn = 0;
  private prevPlan: Plan | null = null; // the blueprint before this gesture started a new one
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  /** Walking keys held down, in the order pressed. */
  private held = new Set<string>();
  private walking: [number, number] = [0, 0];
  /** Mining by hand while the press is held: the tile, and the timer for further taps. */
  private mining: { tile: Tile; timer: ReturnType<typeof setInterval> } | null = null;
  /** Dragging a single building's blueprint: where the press began, where the blueprint was, and whether it moved. */
  private moving = { from: { x: 0, y: 0 }, start: { x: 0, y: 0 }, existing: false, dragged: false };

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
    window.addEventListener('keyup', (e) => this.keyUp(e));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.updateWalk();
    });
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
    if (turns && this.ui.plan && isBeltPath(this.ui.plan)) {
      if (turns % 2) this.rotatePlan(); // a belt line can only be reversed
    } else if (turns) {
      turnTool(this.cb.getWorld(), this.ui, turns);
      this.cb.onChange();
    }
  }

  /** Right-click: cancel the blueprint, or put down the tool and clear the selection (same as Esc). */
  private clearSelection(): void {
    if (this.ui.plan) return this.cancelPlan();
    this.ui.tool = null;
    this.ui.selected = null;
    this.cb.onChange();
  }

  private local(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  /** The tile under a screen point, and where in it the point is (for snapping a splitter to a side, #63). */
  private tileAt(x: number, y: number): Tile {
    const [wx, wy] = this.camera.toWorld(x, y);
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);
    return { x: tx, y: ty, fx: wx - tx, fy: wy - ty };
  }

  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    // The first finger of a new touch (or any mouse press): forget pointers whose
    // release we never saw, or every later tap would look like a pinch.
    if (e.isPrimary) this.pointers.clear();
    const [x, y] = this.local(e);
    this.pointers.set(e.pointerId, { x, y });
    this.ui.hover = this.tileAt(x, y);

    if (this.pointers.size === 2) {
      if (this.mode === 'plan') this.ui.plan = this.prevPlan; // that finger was the start of a pinch
      if (this.mode === 'move') this.abandonMove();
      this.stopMining();
      this.mode = 'pinch';
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    this.downAt = { x, y };
    if (e.pointerType !== 'mouse') this.startLongPress(this.ui.hover);
    if (e.pointerType === 'mouse' && e.button === 2) {
      this.mode = 'right'; // a click clears; a drag pans
    } else if (e.pointerType === 'mouse' && e.button === 1) {
      this.mode = 'middle'; // a click picks the building under it; a drag pans
      e.preventDefault(); // no autoscroll
    } else if (e.pointerType === 'mouse' && e.button !== 0) {
      this.mode = 'pan';
    } else if (this.ui.tool === 'express_belt' && this.cb.getWorld().buildingAt(this.ui.hover.x, this.ui.hover.y)?.type === 'belt') {
      // A tap or click on a belt upgrades its whole line at once: no blueprint, no drag.
      const result = this.cb.issue({ kind: 'upgrade-belts', x: this.ui.hover.x, y: this.ui.hover.y });
      if (typeof result === 'string') this.cb.onPlaceError(result);
      this.mode = 'none';
      this.cb.onChange();
    } else if (this.mover()) {
      // Moving a building (#76, #83): the tap puts it down there, no blueprint.
      this.mode = 'none';
      this.paintTile(this.ui.hover, this.ui.dir);
    } else if (this.onPlan(this.ui.hover)) {
      // Pressing a single building's blueprint: a tap builds it, a drag moves it.
      this.startMove(this.ui.hover, true);
    } else if (this.takesOver(this.ui.hover)) {
      // Pressing on a different kind of building selects it instead of building there.
      this.ui.tool = null;
      this.ui.plan = null;
      this.mode = 'pending';
      this.cb.onChange();
    } else if (this.ui.tool && this.ui.tool !== 'demolish' && !LINE_TOOLS.includes(this.ui.tool)) {
      // A single building: its blueprint follows the drag, so it can be put exactly in place.
      this.prevPlan = this.ui.plan;
      this.ui.plan = { tool: this.ui.tool, tiles: [this.ui.hover] };
      this.startMove(this.ui.hover, false);
    } else if (this.ui.tool && this.ui.tool !== 'demolish' && this.softPlace(e.pointerType, this.ui.tool)) {
      this.mode = 'plan';
      this.prevPlan = this.ui.plan;
      this.ui.plan = { tool: this.ui.tool, tiles: [this.ui.hover] };
    } else if (this.ui.tool) {
      this.mode = 'paint';
      this.lastPlaced = null;
      this.reportedError = false;
      this.lastTile = this.ui.hover;
      this.paintTile(this.ui.hover, this.ui.dir, true);
    } else if (this.canMine(this.ui.hover)) {
      this.mode = 'mine';
      this.startMining(this.ui.hover);
    } else {
      this.mode = 'pending';
    }
  }

  private canMine(t: Tile): boolean {
    const world = this.cb.getWorld();
    // Trees are chopped by hand like ore is mined (D-093).
    return (!!world.resourceAt(t.x, t.y) || world.treeAt(t.x, t.y) === TREE) && !world.buildingAt(t.x, t.y);
  }

  /** One tap now, then more at HAND_MINING.holdRate while the press is held. */
  private startMining(t: Tile): void {
    this.stopMining();
    const tap = () => {
      const r = this.cb.issue({ kind: 'mine', x: t.x, y: t.y });
      // A tick for each tap, a longer buzz when the ore comes loose (#84).
      if (typeof r === 'object' && r) buzz(r.item ? 30 : 8);
      if (r === 'no-ore') this.stopMining(); // the tree came down
      else if (r === 'full') {
        this.stopMining();
        this.cb.onNotice('Your inventory is full. Walk back to the hub to drop it off.');
      } else if (r === 'down') {
        this.stopMining();
        this.cb.onNotice('Your engineer is getting back on their feet at the hub.');
      }
    };
    tap();
    this.mining = { tile: t, timer: setInterval(tap, 1000 / HAND_MINING.holdRate) };
    this.cb.onChange();
  }

  private stopMining(): void {
    if (this.mining) clearInterval(this.mining.timer);
    this.mining = null;
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
    if (moved) this.cancelLongPress();
    if (this.mode === 'mine' && moved) this.stopMining();
    if ((this.mode === 'pending' || this.mode === 'right' || this.mode === 'middle' || this.mode === 'mine') && moved) this.mode = 'pan';
    if (this.mode === 'pan') this.camera.pan(x - prev.x, y - prev.y);
    if (this.mode === 'paint') this.paintTo(this.ui.hover);
    if (this.mode === 'plan') this.extendPlan(this.ui.hover);
    if (this.mode === 'move') this.movePlan(this.ui.hover, moved);
  }

  private up(e: PointerEvent, completed: boolean): void {
    if (!this.pointers.has(e.pointerId)) return;
    const [x, y] = this.local(e);
    this.pointers.delete(e.pointerId);
    this.cancelLongPress();
    if (this.mode === 'mine') this.stopMining();
    if (completed && (this.mode === 'pending' || this.mode === 'mine')) {
      const t = this.tileAt(x, y);
      // Empty ground: the character walks there (and any selection is cleared).
      if (this.mode === 'pending' && !this.ui.tool && !this.cb.getWorld().buildingAt(t.x, t.y)) this.cb.issue({ kind: 'move', x: t.x, y: t.y });
      this.select(t);
    }
    if (completed && this.mode === 'right') this.clearSelection();
    if (completed && this.mode === 'middle') this.pick(this.tileAt(x, y));
    if (this.mode === 'plan') this.endPlanGesture(e.pointerType, completed);
    if (this.mode === 'move') this.endMove(e.pointerType, completed);
    if (e.pointerType !== 'mouse') this.ui.hover = null;
    // After a pinch, the remaining finger pans rather than building.
    this.mode = this.pointers.size === 1 ? 'pan' : 'none';
  }

  /**
   * Touch: a finger held still on a building picks it, unless this press already built something. On
   * empty ground with nothing in hand, in co-op, it pings the spot instead (D-080).
   */
  private startLongPress(t: Tile): void {
    this.cancelLongPress();
    const b = this.cb.getWorld().buildingAt(t.x, t.y);
    if (!b && !this.ui.tool) {
      this.pressTimer = setTimeout(() => {
        this.pressTimer = null;
        if (this.pointers.size !== 1 || this.mode !== 'pending' || !this.cb.ping(t.x, t.y)) return;
        this.mode = 'none'; // lifting the finger doesn't walk there too
        buzz(15);
      }, LONG_PRESS);
      return;
    }
    if (!b || b.type === 'hub') return;
    this.pressTimer = setTimeout(() => {
      this.pressTimer = null;
      if (this.pointers.size !== 1 || this.lastPlaced != null) return;
      if (this.mode === 'plan') this.ui.plan = this.prevPlan; // the press started a blueprint: drop it
      if (this.mode === 'move') this.abandonMove();
      this.mode = 'none'; // lifting the finger does nothing more
      this.pick(t);
      buzz(15);
    }, LONG_PRESS);
  }

  private cancelLongPress(): void {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  /** Makes the building at `t` the tool in hand, facing the way it does. */
  /** The building being moved (#76, #83), while the tool in hand is still its type. */
  private mover() {
    const b = this.ui.moving != null ? this.cb.getWorld().byId.get(this.ui.moving) : undefined;
    return b && b.type === this.ui.tool ? b : undefined;
  }

  pick(t: Tile): void {
    const b = this.cb.getWorld().buildingAt(t.x, t.y);
    if (!b || b.type === 'hub') return;
    this.ui.moving = null;
    this.ui.tool = b.type;
    this.ui.dir = b.dir;
    this.ui.dirSet = false;
    this.ui.plan = null;
    this.ui.selected = null;
    this.cb.onChange();
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

  /**
   * With a tool in hand, a press on an existing building of another kind
   * selects that building. Except: a building pressed onto a belt replaces it.
   */
  private takesOver(t: Tile): boolean {
    const tool = this.ui.tool;
    if (!tool || tool === 'demolish') return false;
    const world = this.cb.getWorld();
    const b = world.buildingAt(t.x, t.y);
    if (!b || b.type === tool) return false;
    return !world.beltToReplace(tool, t.x, t.y);
  }

  private softPlace(pointerType: string, tool: string): boolean {
    if (this.mover()) return false; // moving a building: one tap puts it down
    if (pointerType === 'mouse') return LINE_TOOLS.includes(tool);
    return this.ui.confirmTouch;
  }

  /** Whether `t` is under a waiting single-building blueprint (where it would actually go, after lining up). */
  private onPlan(t: Tile): boolean {
    const plan = this.ui.plan;
    if (!plan || plan.tiles.length !== 1 || LINE_TOOLS.includes(plan.tool)) return false;
    const at = placementAt(this.cb.getWorld(), plan.tool, plan.tiles[0], this.ui.dir, true, this.ui.dirSet);
    const [w, h] = footprint(plan.tool as BuildingType, at.dir);
    return t.x >= at.x && t.x < at.x + w && t.y >= at.y && t.y < at.y + h;
  }

  private startMove(t: Tile, existing: boolean): void {
    this.mode = 'move';
    this.moving = { from: t, start: { ...this.ui.plan!.tiles[0] }, existing, dragged: false };
    this.cb.onChange();
  }

  /** The blueprint keeps its offset from the pointer, so it doesn't jump under a finger. */
  private movePlan(t: Tile, moved: boolean): void {
    const plan = this.ui.plan;
    if (!plan) return;
    if (moved) this.moving.dragged = true;
    if (!this.moving.dragged) return;
    plan.tiles[0] = { x: this.moving.start.x + t.x - this.moving.from.x, y: this.moving.start.y + t.y - this.moving.from.y };
    // An underground exit stays on the line ahead of its entrance, within reach (#64).
    const a = plan.along;
    if (a) {
      const p = plan.tiles[0];
      const k = Math.max(1, Math.min(TUNNEL_RANGE, (p.x - a.x) * DX[a.dir] + (p.y - a.y) * DY[a.dir]));
      plan.tiles[0] = { x: a.x + DX[a.dir] * k, y: a.y + DY[a.dir] * k };
    }
  }

  /** A cancelled press or a pinch: put the blueprint back as it was. */
  private abandonMove(): void {
    if (!this.moving.existing) this.ui.plan = this.prevPlan;
    else if (this.ui.plan) this.ui.plan.tiles[0] = { ...this.moving.start };
  }

  private endMove(pointerType: string, completed: boolean): void {
    if (!completed || !this.ui.plan) return this.abandonMove();
    const { existing, dragged } = this.moving;
    // A tap or click on a waiting blueprint builds it; so does a plain desktop click.
    if (!dragged && (existing || pointerType === 'mouse')) return this.confirmPlan();
    // With touch confirmation off, letting go builds.
    if (pointerType !== 'mouse' && !this.ui.confirmTouch) return this.confirmPlan();
    this.cb.onChange(); // the blueprint waits for a click, a tap, Enter or ✓
  }

  /** Grows the blueprint along a 4-connected line to `t`; dragging back over it shortens it. */
  private extendPlan(t: Tile): void {
    const plan = this.ui.plan;
    // Tunnel ends and big buildings are placed one at a time.
    if (!plan || plan.tool === 'tunnel' || isBig(plan.tool)) return;
    let { x, y } = plan.tiles[plan.tiles.length - 1];
    while (x !== t.x || y !== t.y) {
      const dx = t.x - x;
      const dy = t.y - y;
      if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx);
      else y += Math.sign(dy);
      const at = plan.tiles.findIndex((p) => p.x === x && p.y === y);
      if (at >= 0) plan.tiles.length = at + 1;
      else plan.tiles.push({ x, y });
    }
    this.syncDir();
  }

  private endPlanGesture(pointerType: string, completed: boolean): void {
    const plan = this.ui.plan;
    if (!completed || !plan) {
      this.ui.plan = this.prevPlan;
      return;
    }
    const prev = this.prevPlan;
    const single = plan.tiles.length === 1;
    // A desktop click (no drag) builds at once.
    if (pointerType === 'mouse' && single) return this.confirmPlan();
    // Tapping a single-tile blueprint again builds it.
    const t = plan.tiles[0];
    if (single && prev?.tool === plan.tool && prev.tiles.length === 1 && prev.tiles[0].x === t.x && prev.tiles[0].y === t.y) {
      return this.confirmPlan();
    }
    this.cb.onChange();
  }

  /** Builds the blueprint. Tiles that can't be built are skipped, and one reason is reported. */
  confirmPlan(): void {
    const plan = this.ui.plan;
    if (!plan) return;
    const dirs = planDirs(plan, this.ui.dir);
    const steps = planSteps(this.cb.getWorld(), plan, this.ui.dir, this.ui.dirSet);
    this.reportedError = false;
    this.ui.plan = null; // building an underground entrance may put up its exit's blueprint (#64)
    this.ui.dir = dirs[dirs.length - 1];
    const single = plan.tiles.length === 1;
    for (const s of steps) {
      if (s.over) continue;
      // A crossing that can't be paid for stops the line before it (#65).
      if (s.status === 'cost' && !single) {
        if (!this.reportedError) this.cb.onPlaceError('cost');
        break;
      }
      this.paintTile(s.tile, s.dir, single, s.tool);
    }
    this.cb.onChange();
  }

  /** Turns a single building or a line of them; reverses a belt line. */
  rotatePlan(): void {
    const plan = this.ui.plan;
    if (!plan) return;
    if (isBeltPath(plan)) plan.tiles.reverse();
    else turnTool(this.cb.getWorld(), this.ui, 1);
    this.syncDir();
    this.cb.onChange();
  }

  cancelPlan(): void {
    this.ui.plan = null;
    this.cb.onChange();
  }

  /** Along a belt line, the tool's facing follows the line's end. */
  private syncDir(): void {
    const plan = this.ui.plan;
    if (!plan || !isBeltPath(plan)) return;
    const dirs = planDirs(plan, this.ui.dir);
    if (this.ui.dir !== dirs[dirs.length - 1]) {
      this.ui.dir = dirs[dirs.length - 1];
      this.cb.onChange();
    }
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
    const tool = this.ui.tool;
    // Tunnel ends and big buildings are placed one tap at a time.
    if (!tool || tool === 'tunnel' || (tool !== 'demolish' && isBig(tool))) return;
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
      if (this.ui.tool && this.ui.tool !== 'demolish' && isBelt(this.ui.tool)) {
        // Dragging belts (or rollers) points each one at the next.
        if (this.lastPlaced) this.cb.issue({ kind: 'turn', ...this.lastPlaced, dir });
        if (this.ui.dir !== dir) {
          this.ui.dir = dir;
          this.cb.onChange();
        }
      }
      this.paintTile({ x, y }, this.ui.dir);
    }
    this.lastTile = t;
  }

  /** `replaceBelt`: a single placement may go over a belt (not every tile of a drag). */
  private paintTile(t: Tile, dir: Dir, replaceBelt = false, tool = this.ui.tool): void {
    const world = this.cb.getWorld();
    this.lastPlaced = null;
    if (!tool) return;
    if (tool === 'demolish') {
      const b = world.buildingAt(t.x, t.y);
      if (b && this.cb.issue({ kind: 'demolish', id: b.id }) !== false && this.ui.selected === b.id) {
        this.ui.selected = null;
        this.cb.onChange();
      }
      return;
    }
    const at = placementAt(world, tool, t, dir, replaceBelt, this.ui.dirSet);
    const mover = this.mover();
    if (mover) {
      // Moving a building (#76, #83): one tap puts it down, then the tool is put away.
      const moved = this.cb.issue({ kind: 'relocate', id: mover.id, x: at.x, y: at.y, dir: at.dir }) ?? world.checkPlace(tool, at.x, at.y, at.dir, false, mover);
      if (typeof moved === 'string') this.cb.onPlaceError(moved);
      else {
        this.ui.moving = null;
        this.ui.tool = null;
        this.ui.selected = mover.id;
        this.mode = 'none'; // the drag that follows doesn't paint
      }
      this.cb.onChange();
      return;
    }
    // In co-op the result comes later, so judge it now from the world as it is (the host's game decides).
    const entrance = tool === 'tunnel' ? world.findTunnelEntrance(at.x, at.y, at.dir) : undefined;
    const result = this.cb.issue({ kind: 'place', type: tool, x: at.x, y: at.y, dir: at.dir, replaceBelt }) ?? world.checkPlace(tool, at.x, at.y, at.dir, replaceBelt) ?? { ...at, link: entrance?.id ?? null };
    if (typeof result === 'string') {
      // Report one error per drag, and never for dragging over existing buildings.
      if (result !== 'occupied' && result !== 'bounds' && !this.reportedError) {
        this.reportedError = true;
        this.cb.onPlaceError(result);
      }
    } else {
      this.lastPlaced = { x: result.x, y: result.y, type: tool };
      // A new underground entrance: its exit appears as a blueprint to confirm or slide along (#64).
      if (tool === 'tunnel' && this.ui.tool === 'tunnel' && result.link == null) {
        const spot = tunnelExitSpot(world, result.x, result.y, result.dir);
        if (spot) {
          this.ui.plan = { tool: 'tunnel', tiles: [spot], along: { x: result.x, y: result.y, dir: result.dir } };
          this.ui.dir = result.dir;
        }
      }
    }
  }

  private key(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || document.body.classList.contains('in-menu')) return;
    const k = e.key.toLowerCase();
    if (WALK_KEYS[k]) {
      this.held.add(k);
      this.updateWalk();
      e.preventDefault();
      return;
    }
    if (this.ui.plan && (k === 'enter' || k === 'r' || k === 'escape')) {
      if (k === 'enter') this.confirmPlan();
      else if (k === 'r') this.rotatePlan();
      else this.cancelPlan();
      e.preventDefault();
      return;
    }
    if (k === 'p' && this.ui.hover) {
      // Point at the spot under the mouse for the other players (co-op).
      if (!this.cb.ping(this.ui.hover.x, this.ui.hover.y)) return;
    } else if (k === 'r') {
      if (this.ui.tool) this.ui.dir = ((this.ui.dir + (e.shiftKey ? 3 : 1)) % 4) as Dir;
      else if (this.ui.selected != null) this.cb.issue({ kind: 'rotate', id: this.ui.selected });
    } else if (k === 'escape' || k === 'q') {
      this.ui.tool = null;
      this.ui.selected = null;
    } else if (k === 'x' || k === 'delete') {
      this.ui.tool = this.ui.tool === 'demolish' ? null : 'demolish';
    } else return;
    e.preventDefault();
    this.cb.onChange();
  }

  private keyUp(e: KeyboardEvent): void {
    if (this.held.delete(e.key.toLowerCase())) this.updateWalk();
  }

  /** Tells the character which way the held keys point, when that changes. */
  private updateWalk(): void {
    let dx = 0;
    let dy = 0;
    for (const k of this.held) {
      dx += WALK_KEYS[k][0];
      dy += WALK_KEYS[k][1];
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    if (dx === this.walking[0] && dy === this.walking[1]) return;
    this.walking = [dx, dy];
    this.cb.issue({ kind: 'walk', dx, dy });
  }

  /** Whether the character is being walked with the keys (the camera follows it then). */
  get walkingByKeys(): boolean {
    return this.walking[0] !== 0 || this.walking[1] !== 0;
  }
}
