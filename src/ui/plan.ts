// Soft placement (D-030): the ✓ / ⟳ / ✕ bar that floats beside a blueprint.

import { BUILDINGS, BuildingType, DX, DY, Dir, ItemCounts, ItemId, TUNNEL_RANGE, isBelt } from '../sim/data';
import { PlaceError, World } from '../sim/world';
import { Camera } from '../render/camera';
import { Plan, Spot, UIState, isBeltPath, placementAt, planDirs } from './state';

/**
 * One tile of a blueprint as it will be built. Along a belt line that crosses another belt, the tiles
 * either side of the crossing become an underground belt's entrance and exit, and the tiles between
 * are left alone (`over`, #65).
 */
export interface PlanStep {
  tile: Spot;
  tool: BuildingType;
  dir: Dir;
  status: PlaceError | null;
  over?: boolean;
  exit?: boolean; // an underground belt's exit, drawn as one
}

/**
 * How a blueprint will be built, tile by tile, and whether each tile can be, counting the cost of the
 * tiles before it, so a line longer than the stock allows shows where it runs out. An underground
 * crossing that can't be paid for stops the line there (#65).
 */
export function planSteps(world: World, plan: Plan, dir: Dir, keepDir = false): PlanStep[] {
  const single = plan.tiles.length === 1; // only a single placement may go over a belt
  const dirs = planDirs(plan, dir);
  const steps: PlanStep[] = plan.tiles.map((tile, i) => ({ tile, tool: plan.tool, dir: dirs[i], status: null }));
  if (isBeltPath(plan) && isBelt(plan.tool) && world.isUnlocked('tunnel')) tunnelUnder(world, steps);
  const spent: ItemCounts = {};
  const afford = (tools: BuildingType[]) => {
    const need: ItemCounts = {};
    for (const t of tools) for (const [k, n] of Object.entries(BUILDINGS[t].cost)) need[k as ItemId] = (need[k as ItemId] ?? 0) + n!;
    return (Object.entries(need) as [ItemId, number][]).every(([k, n]) => (world.state.inventory[k] ?? 0) - (spent[k] ?? 0) >= n);
  };
  let stopped = false;
  steps.forEach((s, i) => {
    if (stopped) return void (s.status = 'cost');
    if (s.over) return void (s.status = 'occupied');
    const at = placementAt(world, s.tool, s.tile, s.dir, single, keepDir);
    const err = world.checkPlace(s.tool, at.x, at.y, at.dir, single);
    if (err && err !== 'cost') return void (s.status = err);
    // An entrance is paid for together with its exit: both, or the line stops here.
    const exit = s.tool === 'tunnel' && !s.exit ? steps.slice(i + 1).find((q) => q.exit) : undefined;
    if (!afford(exit ? [s.tool, exit.tool] : [s.tool])) {
      s.status = 'cost';
      if (exit) stopped = true;
      return;
    }
    for (const [k, n] of Object.entries(BUILDINGS[s.tool].cost)) spent[k as ItemId] = (spent[k as ItemId] ?? 0) + n!;
  });
  return steps;
}

/**
 * Along a dragged belt line, a run of existing belts crossing it at right angles is tunnelled under:
 * the tiles just before and after become an underground belt's entrance and exit (#65).
 */
function tunnelUnder(world: World, steps: PlanStep[]): void {
  const crosses = (s: PlanStep) => {
    const b = world.buildingAt(s.tile.x, s.tile.y);
    return !!b && isBelt(b.type) && b.dir % 2 !== s.dir % 2;
  };
  for (let i = 1; i < steps.length - 1; i++) {
    if (!crosses(steps[i])) continue;
    let k = i;
    while (k + 1 < steps.length && crosses(steps[k + 1])) k++;
    const entrance = steps[i - 1];
    const exit = steps[k + 1];
    if (!exit) break; // the line ends on the crossing
    const d = entrance.dir;
    // A straight run, short enough to reach, with the line going the same way at both ends.
    const straight = steps.slice(i - 1, k + 2).every((s) => s.dir === d || s === exit);
    const far = Math.abs(exit.tile.x - entrance.tile.x) + Math.abs(exit.tile.y - entrance.tile.y);
    if (!straight || far > TUNNEL_RANGE || exit.tile.x - entrance.tile.x !== DX[d] * far || exit.tile.y - entrance.tile.y !== DY[d] * far) {
      i = k;
      continue;
    }
    entrance.tool = 'tunnel';
    exit.tool = 'tunnel';
    exit.dir = d;
    exit.exit = true;
    for (let j = i; j <= k; j++) steps[j].over = true;
    i = k + 1;
  }
}

/** Whether each planned tile can be built (see planSteps). */
export function planStatus(world: World, plan: Plan, dir: Dir, keepDir = false): (PlaceError | null)[] {
  return planSteps(world, plan, dir, keepDir).map((s) => s.status);
}

/**
 * Where an underground belt's exit blueprint first goes after its entrance is placed (#64): the first
 * free tile past whatever is in the way ahead, or two tiles on if nothing is. Null if no exit fits.
 */
export function tunnelExitSpot(world: World, x: number, y: number, dir: Dir): Spot | null {
  const free = (k: number) => {
    const err = world.checkPlace('tunnel', x + DX[dir] * k, y + DY[dir] * k, dir);
    return !err || err === 'cost';
  };
  let blocked = false;
  for (let k = 1; k <= TUNNEL_RANGE; k++) {
    if (!free(k)) blocked = true;
    else if (blocked) return { x: x + DX[dir] * k, y: y + DY[dir] * k };
  }
  for (const k of [2, 1, 3, 4, 5]) if (k <= TUNNEL_RANGE && free(k)) return { x: x + DX[dir] * k, y: y + DY[dir] * k };
  return null;
}

export interface PlanActions {
  confirm(): void;
  rotate(): void;
  cancel(): void;
}

export class PlanBar {
  private el = document.getElementById('plan-bar')!;
  private count = this.el.querySelector<HTMLElement>('.plan-count')!;

  constructor(
    private camera: Camera,
    private ui: UIState,
    actions: PlanActions,
  ) {
    this.el.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-plan]');
      if (!btn) return;
      const act = btn.dataset.plan as keyof PlanActions;
      actions[act]();
    });
  }

  /** Called every frame: shows the bar beside the blueprint's last tile. */
  update(world: World, visible: boolean): void {
    const plan = this.ui.plan;
    if (plan && plan.tool !== this.ui.tool) this.ui.plan = null; // the tool was changed or put down
    const show = visible && !!this.ui.plan;
    this.el.hidden = !show;
    if (!show || !plan) return;
    const status = planStatus(world, plan, this.ui.dir, this.ui.dirSet);
    const ok = status.filter((s) => s === null).length;
    this.count.textContent = plan.tiles.length > 1 ? `${ok} of ${plan.tiles.length}` : '';
    this.count.hidden = plan.tiles.length < 2;
    this.el.querySelector<HTMLButtonElement>('[data-plan="confirm"]')!.disabled = ok === 0;
    // Beside the last tile: above it, or below when there's no room above.
    const last = plan.tiles[plan.tiles.length - 1];
    const [sx, sy] = this.camera.toScreen(last.x + 0.5, last.y);
    const [, below] = this.camera.toScreen(0, last.y + 1);
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const top = document.getElementById('topbar')!.getBoundingClientRect().bottom + 6;
    let y = sy - h - 10;
    if (y < top) y = below + 10;
    const x = Math.min(window.innerWidth - w - 6, Math.max(6, sx - w / 2));
    y = Math.min(window.innerHeight - h - 6, Math.max(top, y));
    this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
