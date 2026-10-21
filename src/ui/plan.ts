// Soft placement (D-030): the ✓ / ⟳ / ✕ bar that floats beside a blueprint.

import { BUILDINGS, ItemCounts, ItemId } from '../sim/data';
import { PlaceError, World } from '../sim/world';
import { Camera } from '../render/camera';
import { Plan, UIState, anchorAt } from './state';

/**
 * Whether each planned tile can be built, counting the cost of the tiles
 * before it, so a line longer than the stock allows shows where it runs out.
 */
export function planStatus(world: World, plan: Plan): (PlaceError | null)[] {
  const spent: ItemCounts = {};
  const cost = Object.entries(BUILDINGS[plan.tool].cost) as [ItemId, number][];
  const single = plan.tiles.length === 1; // only a single placement may go over a belt
  return plan.tiles.map((t) => {
    const { x, y } = anchorAt(plan.tool, t);
    const err = world.checkPlace(plan.tool, x, y, single);
    if (err && err !== 'cost') return err;
    if (!cost.every(([i, n]) => (world.state.inventory[i] ?? 0) - (spent[i] ?? 0) >= n)) return 'cost';
    for (const [i, n] of cost) spent[i] = (spent[i] ?? 0) + n;
    return null;
  });
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
    const status = planStatus(world, plan);
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
