// Step-by-step tutorial: darkens the screen except a spotlight on the thing
// being explained, with a short tip and Back / Next / close controls.

import { BREACH, HUB_SIZE } from '../sim/data';
import { World } from '../sim/world';
import { Camera } from '../render/camera';

type Shape = 'circle' | 'rect';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A tile area on the map, in tile coordinates. */
interface WorldTarget {
  tx: number;
  ty: number;
  size: number;
}

interface Step {
  text: (world: World) => string;
  /** CSS selector of the element to spotlight. */
  el?: string;
  /** Map area to spotlight; the camera moves there. */
  tiles?: (world: World) => WorldTarget | null;
  shape?: Shape;
}

const PAD = 8;

function nearestIronNode(world: World): WorldTarget | null {
  const hub = world.hub;
  if (!hub) return null;
  let best: WorldTarget | null = null;
  let bestD = Infinity;
  for (let y = 0; y < world.state.height; y++) {
    for (let x = 0; x < world.state.width; x++) {
      if (world.resourceAt(x, y) !== 'iron_ore') continue;
      const d = Math.abs(x - hub.x) + Math.abs(y - hub.y);
      if (d < bestD) {
        bestD = d;
        best = { tx: x, ty: y, size: 1 };
      }
    }
  }
  return best;
}

const STEPS: Step[] = [
  {
    tiles: (w) => (w.hub ? { tx: w.hub.x, ty: w.hub.y, size: HUB_SIZE } : null),
    shape: 'circle',
    text: () =>
      'This is your hub. Items you deliver here go into its stock, and that stock pays for every building and every research. Keep it safe.',
  },
  {
    el: '#inventory',
    text: () => 'Hub stock. You start with some iron plates, bricks and copper ingots.',
  },
  {
    tiles: nearestIronNode,
    shape: 'circle',
    text: () => 'Iron ore. Resource nodes never run out. Copper ore is green and stone is grey.',
  },
  {
    el: '[data-tool="extractor"]',
    text: () =>
      'Put an extractor on a node to mine it. The white arrow shows where items come out; use Rotate to turn it before you place it.',
  },
  {
    el: '[data-tool="belt"]',
    text: () => 'Belts carry items. Drag to lay a line, and each belt points the way you dragged.',
  },
  {
    el: '[data-tool="furnace"]',
    text: () =>
      'Furnaces smelt ore into plates, ingots and bricks. They take input from any side. Belt the results to the hub to grow your stock.',
  },
  {
    el: '#research-btn',
    text: () =>
      'Research unlocks new buildings, paid from hub stock. Get Basic Defense before the first wave arrives.',
  },
  {
    el: '#wave',
    text: () =>
      'Enemies attack in waves. Red markers show where the next wave will come from. Turrets fire iron plates, so keep them supplied by belt, or later from the hub with a hub port.',
  },
  {
    el: '#hub-hp',
    text: (w) =>
      w.state.mode === 'hardcore'
        ? 'Hub health. This is a hardcore run: if it reaches zero, the run is over.'
        : `Hub health. If it reaches zero the attack ends, but you lose ${BREACH.stockLost * 100}% of hub stock.`,
  },
  {
    el: '#menu-btn',
    shape: 'circle',
    text: () => 'Controls, saving and this tutorial are in the menu. Good luck!',
  },
];

export class Tutorial {
  private index = -1;
  private root = document.getElementById('tutorial')!;
  private spot = this.root.querySelector<HTMLElement>('.spot')!;
  private tip = this.root.querySelector<HTMLElement>('.tip')!;
  private prevSpeed = 1;

  constructor(
    private camera: Camera,
    private getWorld: () => World,
    private ui: { speed: number },
    private onDone: () => void,
  ) {
    this.root.querySelector('.tip-next')!.addEventListener('click', () => this.go(this.index + 1));
    this.root.querySelector('.tip-back')!.addEventListener('click', () => this.go(this.index - 1));
    this.root.querySelector('.tip-close')!.addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') this.go(this.index + 1);
      else if (e.key === 'ArrowLeft') this.go(this.index - 1);
      else if (e.key !== ' ') return; // swallow Space so it can't unpause behind the tutorial
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  get active(): boolean {
    return this.index >= 0;
  }

  start(): void {
    if (!this.active) this.prevSpeed = this.ui.speed;
    this.ui.speed = 0; // the game waits while you read
    this.root.hidden = false;
    this.go(0);
  }

  close(): void {
    this.index = -1;
    this.root.hidden = true;
    this.ui.speed = this.prevSpeed || 1;
    this.onDone();
  }

  private go(i: number): void {
    if (i >= STEPS.length) return this.close();
    this.index = Math.max(0, i);
    const step = STEPS[this.index];
    const t = step.tiles?.(this.getWorld());
    if (t) {
      this.camera.x = t.tx + t.size / 2;
      this.camera.y = t.ty + t.size / 2;
    }
    this.root.querySelector('.step')!.textContent = `Tutorial · ${this.index + 1} of ${STEPS.length}`;
    this.root.querySelector('.tip-text')!.textContent = step.text(this.getWorld());
    this.root.querySelector<HTMLButtonElement>('.tip-back')!.disabled = this.index === 0;
    this.root.querySelector('.tip-next')!.textContent = this.index === STEPS.length - 1 ? 'Done' : 'Next →';
    this.update();
  }

  /** Repositions the spotlight; called every frame so it follows layout and camera changes. */
  update(): void {
    if (!this.active) return;
    const step = STEPS[this.index];
    let r: Rect | null = null;
    if (step.el) {
      const el = document.querySelector(step.el);
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const b = el.getBoundingClientRect();
        r = { x: b.left, y: b.top, w: b.width, h: b.height };
      }
    } else if (step.tiles) {
      const t = step.tiles(this.getWorld());
      if (t) {
        const canvas = document.getElementById('game')!.getBoundingClientRect();
        const [x, y] = this.camera.toScreen(t.tx, t.ty);
        const s = t.size * this.camera.zoom;
        r = { x: canvas.left + x, y: canvas.top + y, w: s, h: s };
      }
    }

    const shape = step.shape ?? 'rect';
    this.spot.className = `spot ${r ? shape : 'none'}`;
    if (r) {
      let { x, y, w, h } = r;
      if (shape === 'circle') {
        // A circle that encloses the target's box.
        const d = Math.hypot(w, h);
        x -= (d - w) / 2;
        y -= (d - h) / 2;
        w = h = d;
      }
      Object.assign(this.spot.style, {
        left: `${x - PAD}px`,
        top: `${y - PAD}px`,
        width: `${w + PAD * 2}px`,
        height: `${h + PAD * 2}px`,
      });
      r = { x: x - PAD, y: y - PAD, w: w + PAD * 2, h: h + PAD * 2 };
    } else {
      Object.assign(this.spot.style, { left: '50%', top: '50%' });
    }

    // Put the tip below the spotlight if it fits, otherwise above, otherwise centred.
    const tw = this.tip.offsetWidth;
    const th = this.tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = vw / 2 - tw / 2;
    let top = vh / 2 - th / 2;
    if (r) {
      left = r.x + r.w / 2 - tw / 2;
      if (r.y + r.h + 12 + th < vh) top = r.y + r.h + 12;
      else if (r.y - 12 - th > 0) top = r.y - 12 - th;
    }
    left = Math.max(12, Math.min(vw - tw - 12, left));
    top = Math.max(12, Math.min(vh - th - 12, top));
    this.tip.style.left = `${left}px`;
    this.tip.style.top = `${top}px`;
  }
}
