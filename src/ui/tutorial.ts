// Tutorial lessons. Each lesson starts by itself the first time something
// happens in a game (a new game, the first bugs provoked, a research done…),
// plays once, and can be replayed from the menu. Steps either explain
// (the game pauses and the screen is blocked until Next) or ask the player to
// do something (the game keeps running and the step finishes when it's done).
//
// The spotlight darkens everything except a circle or rounded box around the
// thing being explained.

import { shipyard } from '../sim/ship';
import { Nest, isAngry, nestAlive, nestCentre } from '../sim/nests';
import { BREACH, BuildingType, HUB_SIZE, ItemId, NESTS, SHIP } from '../sim/data';
import { World } from '../sim/world';
import { Camera } from '../render/camera';
import { UIState } from './state';

type Shape = 'circle' | 'rect';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A tile area on the map, in tile coordinates. */
interface TileTarget {
  tx: number;
  ty: number;
  size: number;
}

interface Target {
  el?: string;
  tiles?: TileTarget | null;
  shape?: Shape;
}

/** What a step can look at: the game now, and the game when the step began. */
interface StepContext {
  world: World;
  ui: UIState;
  start: { buildings: Partial<Record<BuildingType, number>>; delivered: Partial<Record<ItemId, number>> };
}

interface Step {
  text: (ctx: StepContext) => string;
  target?: (ctx: StepContext) => Target;
  /** Present for steps that wait for the player; returns true once they've done it. */
  done?: (ctx: StepContext) => boolean;
}

export interface Lesson {
  id: string;
  title: string;
  /** Starts the lesson the first time this is true in a game. */
  trigger: (world: World) => boolean;
  steps: Step[];
}

export interface TutorialProfile {
  seen(id: string): boolean;
  markSeen(id: string): void;
  tipsOff(): boolean;
  setTipsOff(off: boolean): void;
}

const PAD = 8;

const count = (w: World, type: BuildingType) => w.state.buildings.filter((b) => b.type === type).length;
const built = (ctx: StepContext, type: BuildingType, n = 1) => count(ctx.world, type) >= (ctx.start.buildings[type] ?? 0) + n;

function hubTarget(w: World): TileTarget | null {
  return w.hub ? { tx: w.hub.x, ty: w.hub.y, size: HUB_SIZE } : null;
}

function shipTarget(w: World): TileTarget | null {
  const b = shipyard(w);
  return b ? { tx: b.x, ty: b.y, size: 3 } : null;
}

/** The nest the Bugs lesson is about: an angry one, else the live one nearest any building. */
function lessonNest(w: World): Nest | undefined {
  const live = w.state.nests.filter((n) => nestAlive(w, n));
  const angry = live.find((n) => isAngry(w, n));
  if (angry) return angry;
  let best: Nest | undefined;
  let bestD = Infinity;
  for (const n of live) {
    const [cx, cy] = nestCentre(n);
    for (const b of w.state.buildings) {
      const d = Math.hypot(b.x - cx, b.y - cy);
      if (d < bestD) [bestD, best] = [d, n];
    }
  }
  return best;
}

/** True once the player has built within this many tiles of a live nest's centre. */
function builtNearNest(w: World, range: number): boolean {
  return w.state.nests.some((n) => {
    if (!nestAlive(w, n)) return false;
    const [cx, cy] = nestCentre(n);
    return w.state.buildings.some((b) => b.type !== 'hub' && Math.hypot(b.x - cx, b.y - cy) < range);
  });
}

function nestTarget(w: World): TileTarget | null {
  const n = lessonNest(w);
  return n ? { tx: n.x, ty: n.y, size: NESTS.cell } : null;
}

function nearestNode(w: World, item: ItemId): TileTarget | null {
  const hub = w.hub;
  if (!hub) return null;
  let best: TileTarget | null = null;
  let bestD = Infinity;
  for (let y = 0; y < w.state.height; y++) {
    for (let x = 0; x < w.state.width; x++) {
      if (w.resourceAt(x, y) !== item || w.buildingAt(x, y)) continue;
      const d = Math.abs(x - hub.x) + Math.abs(y - hub.y);
      if (d < bestD) {
        bestD = d;
        best = { tx: x, ty: y, size: 1 };
      }
    }
  }
  return best;
}

/** On touch screens (with confirming switched on), building shows a blueprint first. */
const confirmHint = (c: StepContext) =>
  c.ui.confirmTouch && matchMedia('(pointer: coarse)').matches ? ' A blueprint appears first: tap ✓ to build it, or tap the same spot again.' : '';

/** Points at a toolbar button until that tool is picked, then at `then`. */
function toolThen(ctx: StepContext, tool: BuildingType, then: Target = {}): Target {
  return ctx.ui.tool === tool ? then : { el: `[data-tool="${tool}"]` };
}

export const LESSONS: Lesson[] = [
  {
    id: 'essentials',
    title: 'Essentials',
    // A fresh factory: nothing built yet.
    trigger: (w) => count(w, 'extractor') === 0 && count(w, 'belt') === 0,
    steps: [
      {
        target: (c) => ({ tiles: hubTarget(c.world), shape: 'circle' }),
        text: () =>
          'This is your hub. Everything you deliver here goes into its stock, which pays for buildings and research. It has a small gun of its own.',
      },
      {
        target: (c) => toolThen(c, 'extractor', { tiles: nearestNode(c.world, 'iron_ore'), shape: 'circle' }),
        done: (c) => built(c, 'extractor'),
        text: (c) =>
          c.ui.tool === 'extractor'
            ? 'Now tap the iron ore to place the extractor over it. Its arrow shows the side ore comes out of; turn it with Rotate (or the mouse wheel) first.' +
              confirmHint(c)
            : 'Iron ore never runs out. Pick the Extractor to mine it.',
      },
      {
        target: (c) => toolThen(c, 'belt'),
        done: (c) => built(c, 'belt', 3),
        text: (c) =>
          c.ui.tool === 'belt'
            ? "Drag from the extractor's arrow toward the hub to lay a line of belts. Each belt points the way you dragged. " +
              'The line appears as a blueprint: tap ✓ (or press Enter) to build it, ⟳ to reverse it, or ✕ to cancel.'
            : 'Belts carry items. Pick the Belt.',
      },
      {
        target: (c) => toolThen(c, 'furnace'),
        done: (c) => built(c, 'furnace'),
        text: (c) =>
          c.ui.tool === 'furnace'
            ? 'Tap a belt in your line to drop the furnace into it, so ore runs in. It takes input from any side and outputs from the side its arrow marks.'
            : 'Ore needs smelting into plates. Pick the Furnace.',
      },
      {
        target: (c) => ({ tiles: hubTarget(c.world), shape: 'circle' }),
        done: (c) => (c.world.delivered.iron_plate ?? 0) > (c.start.delivered.iron_plate ?? 0),
        text: () => "Belt the furnace's plates into the hub. This step finishes when the first plate arrives.",
      },
      {
        target: () => ({ el: '#inventory' }),
        text: () =>
          'Your stock, shown above the hub, went up. That is the whole loop: mine, move, make, deliver. Everything else builds on it. Right-click (or tap the tool again) to put a tool down.',
      },
      {
        target: (c) => ({ tiles: hubTarget(c.world), shape: 'circle' }),
        text: () => 'Select the hub any time to open Research. Research uses hub stock to unlock new buildings.',
      },
    ],
  },
  {
    id: 'defense',
    title: 'Bugs',
    // The first time a nest is provoked, or the factory grows close to one.
    trigger: (w) => w.state.nests.some((n) => isAngry(w, n)) || builtNearNest(w, NESTS.cell + 6),
    steps: [
      {
        target: (c) => ({ tiles: nestTarget(c.world), shape: 'circle' }),
        text: () =>
          'Bugs live in territories like this one, around a nest mound. They ignore you unless provoked: building in or next to their territory, a building coming close to one, or shooting them. Then they go for your nearest buildings until things calm down.',
      },
      {
        // Once the hub is selected, point at its Research button instead (and keep the card off it).
        target: (c) =>
          document.querySelector('#info:not([hidden]) [data-action="research"]')
            ? { el: '#info [data-action="research"]' }
            : { tiles: hubTarget(c.world), shape: 'circle' },
        done: (c) => c.world.state.researched.includes('defense'),
        text: () =>
          'Select the hub, open Research and start Basic Defense: it unlocks turrets, which fire iron plates. Feed them by belt, or place them touching the hub.',
      },
    ],
  },
  {
    id: 'logistics',
    title: 'Splitters and tunnels',
    trigger: (w) => w.isUnlocked('splitter'),
    steps: [
      {
        target: () => ({ el: '[data-tool="splitter"]' }),
        text: () =>
          'Splitters take items from behind and send them out the front, left and right in turn. Use them to branch a line, for example plates to both the hub and a turret.',
      },
    ],
  },
  {
    id: 'shipyard',
    title: 'The escape ship',
    trigger: (w) => w.isUnlocked('shipyard') && !w.state.ship.escaped,
    steps: [
      {
        target: (c) => toolThen(c, 'shipyard'),
        done: (c) => built(c, 'shipyard'),
        text: (c) =>
          c.ui.tool === 'shipyard'
            ? `Build it where you can defend it. When it launches, the engines wake every bug nest within ${SHIP.wakeRadius} tiles.`
            : 'You can build a ship to get off this planet. Pick the Shipyard.',
      },
      {
        target: (c) => ({ tiles: shipTarget(c.world), shape: 'circle' }),
        text: () =>
          "The ship goes up in four stages: hull, engine, life support and navigation. Belt each stage's parts into the shipyard; select it to see what it still needs.",
      },
      {
        target: (c) => ({ tiles: shipTarget(c.world), shape: 'circle' }),
        text: () =>
          `When the ship is finished, select the shipyard and press Launch. Every nest within ${SHIP.wakeRadius} tiles comes for your buildings for ${SHIP.launchTime} seconds. Hold the shipyard, and you're free.`,
      },
    ],
  },
  {
    id: 'breach',
    title: 'Breaches',
    trigger: (w) => w.state.breaches > 0,
    steps: [
      {
        target: (c) => ({ tiles: hubTarget(c.world), shape: 'circle' }),
        text: () =>
          `The hub was breached. In Standard mode you lose ${BREACH.stockLost * 100}% of your stock, but the bugs go home. Build turrets and walls before you provoke them again.`,
      },
    ],
  },
];

export class Tutorial {
  private lesson: Lesson | null = null;
  private index = 0;
  private ctx: StepContext | null = null;
  private root = document.getElementById('tutorial')!;
  private spot = this.root.querySelector<HTMLElement>('.spot')!;
  private tip = this.root.querySelector<HTMLElement>('.tip')!;
  private prevSpeed = 1;
  private paused = false;
  /** Bumped by input outside the tutorial so a step's text refreshes promptly. */
  private lastText = '';
  /** The map area the camera last moved to, so a newly targeted area is brought into view once. */
  private lastTiles = '';

  constructor(
    private camera: Camera,
    private getWorld: () => World,
    private ui: UIState,
    private profile: TutorialProfile,
  ) {
    this.root.querySelector('.tip-next')!.addEventListener('click', () => this.go(this.index + 1));
    this.root.querySelector('.tip-back')!.addEventListener('click', () => this.go(this.index - 1));
    this.root.querySelector('.tip-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.tip-hide')!.addEventListener('click', () => {
      this.profile.setTipsOff(true);
      this.close();
    });
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.active || !this.blocking) return;
        if (e.key === 'Escape') this.close();
        else if (e.key === 'ArrowRight' || e.key === 'Enter') this.go(this.index + 1);
        else if (e.key === 'ArrowLeft') this.go(this.index - 1);
        else if (e.key !== ' ') return; // swallow Space so it can't unpause behind the tutorial
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
  }

  get active(): boolean {
    return this.lesson != null;
  }

  /** True while showing an explanation (game paused, input blocked). */
  private get blocking(): boolean {
    return !!this.lesson && !this.lesson.steps[this.index].done;
  }

  /** Starts any lesson whose moment has come. Call every frame while playing. */
  check(): void {
    if (this.active || this.profile.tipsOff()) return;
    // Wait until the player closes whatever window they're reading (e.g. the email that set this off).
    if (document.querySelector('.modal:not([hidden])')) return;
    const world = this.getWorld();
    const next = LESSONS.find((l) => !this.profile.seen(l.id) && l.trigger(world));
    if (next) this.start(next.id);
  }

  /** Plays a lesson now, whether or not it has been seen. */
  start(id: string): void {
    const lesson = LESSONS.find((l) => l.id === id);
    if (!lesson) return;
    if (this.active) this.finish(false);
    this.lesson = lesson;
    this.prevSpeed = this.ui.speed || 1;
    this.root.hidden = false;
    this.go(0);
  }

  /** Stops the lesson without counting it as seen (e.g. leaving to the main menu). */
  abort(): void {
    this.finish(false);
  }

  /** Closes the lesson. It still counts as seen, so it won't pop up again. */
  close(): void {
    this.finish(true);
  }

  private finish(markSeen: boolean): void {
    if (this.lesson && markSeen) this.profile.markSeen(this.lesson.id);
    this.lesson = null;
    this.root.hidden = true;
    this.setPaused(false);
  }

  private setPaused(pause: boolean): void {
    if (pause && !this.paused) {
      this.prevSpeed = this.ui.speed || this.prevSpeed || 1;
      this.ui.speed = 0;
    } else if (!pause && this.paused) {
      this.ui.speed = this.prevSpeed || 1;
    }
    this.paused = pause;
  }

  private go(i: number): void {
    const lesson = this.lesson;
    if (!lesson) return;
    if (i >= lesson.steps.length) return this.close();
    this.index = Math.max(0, i);
    const world = this.getWorld();
    const buildings: Partial<Record<BuildingType, number>> = {};
    for (const b of world.state.buildings) buildings[b.type] = (buildings[b.type] ?? 0) + 1;
    this.ctx = { world, ui: this.ui, start: { buildings, delivered: { ...world.delivered } } };

    const step = lesson.steps[this.index];
    this.setPaused(!step.done);
    this.root.classList.toggle('blocking', !step.done);
    this.lastTiles = ''; // update() centres the camera on this step's map target, if it has one
    this.root.querySelector('.step')!.textContent = `${lesson.title} · ${this.index + 1} of ${lesson.steps.length}`;
    this.root.querySelector<HTMLButtonElement>('.tip-back')!.disabled = this.index === 0;
    const last = this.index === lesson.steps.length - 1;
    this.root.querySelector('.tip-next')!.textContent = step.done ? 'Skip step' : last ? 'Done' : 'Next →';
    this.root.querySelector('.tip-next')!.classList.toggle('quiet', !!step.done);
    this.lastText = '';
    this.update();
  }

  /** Follows layout and camera changes, and finishes action steps once they're done. Call every frame. */
  update(): void {
    const lesson = this.lesson;
    if (!lesson || !this.ctx) return;
    this.ctx.world = this.getWorld();
    const step = lesson.steps[this.index];
    if (step.done?.(this.ctx)) {
      this.go(this.index + 1);
      return;
    }
    // While the player has a menu open to do what an action step asked, step aside.
    const menuOpen = !!document.querySelector('.modal:not([hidden])');
    this.root.classList.toggle('aside', menuOpen && !!step.done);
    const text = step.text(this.ctx);
    if (text !== this.lastText) {
      this.root.querySelector('.tip-text')!.textContent = this.lastText = text;
    }

    const target = step.target?.(this.ctx) ?? {};
    if (target.tiles) {
      // A step can switch to a map target partway through (e.g. after picking a tool): bring it into view.
      const k = `${target.tiles.tx},${target.tiles.ty}`;
      if (k !== this.lastTiles) {
        this.lastTiles = k;
        this.camera.x = target.tiles.tx + target.tiles.size / 2;
        this.camera.y = target.tiles.ty + target.tiles.size / 2;
      }
    }
    let r: Rect | null = null;
    if (target.el) {
      const el = document.querySelector(target.el);
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const b = el.getBoundingClientRect();
        if (b.width) r = { x: b.left, y: b.top, w: b.width, h: b.height };
      }
    } else if (target.tiles) {
      const canvas = document.getElementById('game')!.getBoundingClientRect();
      const [x, y] = this.camera.toScreen(target.tiles.tx, target.tiles.ty);
      const s = target.tiles.size * this.camera.zoom;
      r = { x: canvas.left + x, y: canvas.top + y, w: s, h: s };
    }

    const shape = target.shape ?? 'rect';
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
      r = { x: x - PAD, y: y - PAD, w: w + PAD * 2, h: h + PAD * 2 };
      Object.assign(this.spot.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    }

    // Put the tip below the spotlight if it fits, otherwise above, otherwise centred.
    const tw = this.tip.offsetWidth;
    const th = this.tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = vw / 2 - tw / 2;
    let top = vh / 2 - th / 2;
    if (!r && step.done) {
      // Nothing to point at while the player builds: stay near the top, off the map's centre.
      top = 110;
    } else if (r && target.tiles && step.done) {
      // Map targets the player has to build around: keep the card out of the way,
      // in the half of the screen the target isn't in.
      top = r.y + r.h / 2 > vh / 2 ? 110 : vh - th - 120;
    } else if (r) {
      left = r.x + r.w / 2 - tw / 2;
      if (r.y + r.h + 12 + th < vh - 100) top = r.y + r.h + 12;
      else if (r.y - 12 - th > 0) top = r.y - 12 - th;
    }
    left = Math.max(12, Math.min(vw - tw - 12, left));
    top = Math.max(12, Math.min(vh - th - 12, top));
    this.tip.style.left = `${left}px`;
    this.tip.style.top = `${top}px`;
  }
}
