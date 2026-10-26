// Tutorial lessons. Each lesson starts by itself the first time something
// happens in a game (a new game, the first bugs provoked, a research done…),
// plays once, and can be replayed from the menu. Steps either explain
// (the game pauses and the screen is blocked until Next) or ask the player to
// do something (the game keeps running and the step finishes when it's done).
//
// The spotlight darkens everything except a circle or rounded box around the
// thing being explained.

import { shipyard } from '../sim/ship';
import { heldOf } from '../sim/player';
import { Nest, isAngry, nestAlive, nestCentre } from '../sim/nests';
import { BREACH, BUILDINGS, BuildingType, HAND_MINING, HUB_SIZE, ItemId, LUMBER, NESTS, RESEARCH_BY_ID, SHIP } from '../sim/data';
import { TREE, World } from '../sim/world';
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

/** Space between the spotlight and the tip. */
const GAP = 14;
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

/** Stone and iron ore for the first furnace and extractor (#38). */
const FIRST_STONE = (BUILDINGS.furnace.cost.stone ?? 0) + (BUILDINGS.extractor.cost.stone ?? 0);
const FIRST_ORE = BUILDINGS.extractor.cost.iron_ore ?? 0;

/** How much of an item has reached the hub this step: what's in stock, plus what the furnaces and extractors built since cost. */
function stocked(c: StepContext, item: ItemId): number {
  const spent = (['furnace', 'extractor'] as const).reduce(
    (sum, t) => sum + (BUILDINGS[t].cost[item] ?? 0) * Math.max(0, count(c.world, t) - (c.start.buildings[t] ?? 0)),
    0,
  );
  return (c.world.state.inventory[item] ?? 0) + spent;
}

/** How much of an item has been mined by hand: in the hub (or spent), or still in the engineer's inventory. */
function mined(c: StepContext, item: ItemId): number {
  const p = engineer(c);
  return stocked(c, item) + (p ? heldOf(p, item) : 0);
}

/** This player's engineer. */
function engineer(c: StepContext) {
  return c.world.state.players.find((p) => p.id === c.ui.player);
}

/** The character, for the spotlight. */
function playerTarget(c: StepContext): TileTarget | null {
  const p = engineer(c);
  return p ? { tx: Math.floor(p.x) - 1, ty: Math.floor(p.y) - 1, size: 3 } : null;
}

/** The tile in front of the first extractor's arrow, where the first furnace goes. */
function extractorOutput(w: World): TileTarget | null {
  const b = w.state.buildings.find((b) => b.type === 'extractor');
  if (!b) return null;
  const o = w.outputTile(b);
  return { tx: o.x, ty: o.y, size: 1 };
}

function furnaceTarget(w: World): TileTarget | null {
  const b = w.state.buildings.find((b) => b.type === 'furnace');
  return b ? { tx: b.x, ty: b.y, size: 2 } : null;
}

/** The trees nearest the hub, for the wood lesson's first Lumber Camp. */
function nearestTrees(w: World): TileTarget | null {
  const hub = w.hub;
  if (!hub) return null;
  const cx = hub.x + HUB_SIZE / 2;
  const cy = hub.y + HUB_SIZE / 2;
  let best = -1;
  let bestD = Infinity;
  w.state.trees.forEach((t, i) => {
    if (t !== TREE) return;
    const d = Math.hypot((i % w.state.width) - cx, Math.floor(i / w.state.width) - cy);
    if (d < bestD) [best, bestD] = [i, d];
  });
  if (best < 0) return null;
  // A patch around the nearest tree, so the spotlight shows a bit of the wood.
  return { tx: (best % w.state.width) - 1, ty: Math.floor(best / w.state.width) - 1, size: 3 };
}

/** The first Lumber Camp the player built. */
function campTarget(w: World): TileTarget | null {
  const b = w.state.buildings.find((b) => b.type === 'lumber_camp');
  return b ? { tx: b.x, ty: b.y, size: 2 } : null;
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
    trigger: (w) => count(w, 'extractor') === 0 && count(w, 'furnace') === 0 && count(w, 'belt') === 0,
    steps: [
      {
        target: (c) => ({ tiles: hubTarget(c.world), shape: 'circle' }),
        text: () =>
          'This is your hub. Everything you deliver here goes into its stock, which pays for buildings and research. It starts empty, and it has a small gun of its own.',
      },
      {
        target: (c) => ({ tiles: playerTarget(c), shape: 'circle' }),
        text: () => 'This is your engineer. Tap or click the ground to walk there; on a keyboard, WASD or the arrow keys walk too.',
      },
      {
        target: (c) => ({ tiles: nearestNode(c.world, 'stone'), shape: 'circle' }),
        done: (c) => mined(c, 'stone') >= FIRST_STONE,
        text: (c) =>
          `Start by mining by hand. Tap the grey stone (or click it): your engineer walks over, and every ${HAND_MINING.taps} taps loosen one stone, which they carry. Hold your finger or the mouse button down to keep mining. ` +
          `A furnace and an extractor need ${FIRST_STONE} stone: ${Math.min(FIRST_STONE, mined(c, 'stone'))} of ${FIRST_STONE}.`,
      },
      {
        target: (c) => ({ tiles: nearestNode(c.world, 'iron_ore'), shape: 'circle' }),
        done: (c) => mined(c, 'iron_ore') >= FIRST_ORE,
        text: (c) => `Now mine ${FIRST_ORE} iron ore the same way, for the extractor: ${Math.min(FIRST_ORE, mined(c, 'iron_ore'))} of ${FIRST_ORE}.`,
      },
      {
        target: (c) => ({ tiles: hubTarget(c.world), shape: 'circle' }),
        done: (c) => stocked(c, 'stone') >= FIRST_STONE && stocked(c, 'iron_ore') >= FIRST_ORE,
        text: () => 'Walk back to the hub (tap the ground next to it). Your engineer drops off everything they carry as soon as they reach it.',
      },
      {
        target: (c) => toolThen(c, 'extractor', { tiles: nearestNode(c.world, 'iron_ore'), shape: 'circle' }),
        done: (c) => built(c, 'extractor'),
        text: (c) =>
          c.ui.tool === 'extractor'
            ? 'Now tap the iron ore to place the extractor over it. Its arrow shows the side ore comes out of; turn it with Rotate (or the mouse wheel) first.' +
              confirmHint(c)
            : 'An extractor mines for you, and iron ore never runs out. Pick the Extractor.',
      },
      {
        target: (c) => toolThen(c, 'furnace', { tiles: extractorOutput(c.world), shape: 'circle' }),
        done: (c) => built(c, 'furnace'),
        text: (c) =>
          c.ui.tool === 'furnace'
            ? "Place the furnace touching the extractor's arrow, so the ore goes straight in. A building's output passes straight into a building in front of it." +
              confirmHint(c)
            : 'Ore needs smelting into plates. Pick the Furnace.',
      },
      {
        // Once the furnace is selected, point at its Collect button.
        target: (c) =>
          document.querySelector('#info:not([hidden]) [data-action="collect"]')
            ? { el: '#info [data-action="collect"]' }
            : { tiles: furnaceTarget(c.world), shape: 'circle' },
        done: (c) => (c.world.delivered.iron_plate ?? 0) > (c.start.delivered.iron_plate ?? 0),
        text: () => 'Plates pile up in the furnace. Select it and tap Collect: your engineer fetches them. Then walk them back to the hub. Soon belts will do this for you.',
      },
      {
        target: () => ({ el: '#inventory' }),
        text: () =>
          'Your stock went up. It shows above the hub while you point at it or select it. Right-click (or tap the tool again) to put a tool down.',
      },
      {
        target: (c) =>
          document.querySelector('#info:not([hidden]) [data-action="research"]')
            ? { el: '#info [data-action="research"]' }
            : { tiles: hubTarget(c.world), shape: 'circle' },
        done: (c) => c.world.state.researched.includes('logistics') || c.world.state.research.active === 'logistics',
        text: () =>
          `Select the hub, open Research and start Logistics. It unlocks belts, and uses ${RESEARCH_BY_ID.logistics.cost.iron_plate} iron plates from stock: keep bringing plates from the furnace until it's done.`,
      },
      {
        target: (c) => toolThen(c, 'belt'),
        done: (c) => built(c, 'belt', 3),
        text: (c) =>
          !c.world.isUnlocked('belt')
            ? 'Logistics is researching. Keep collecting plates for it; this step goes on once belts are unlocked.'
            : c.ui.tool === 'belt'
              ? "Drag from the furnace's arrow toward the hub to lay a line of belts. Each belt points the way you dragged. " +
                'The line appears as a blueprint: tap ✓ (or press Enter) to build it, ⟳ to reverse it, or ✕ to cancel.'
              : 'Belts carry items to the hub on their own. Pick the Belt.',
      },
      {
        target: (c) => ({ tiles: hubTarget(c.world), shape: 'circle' }),
        text: () =>
          'That is the whole loop: mine, move, make, deliver. Everything else builds on it. Select the hub any time to open Research, which unlocks new buildings.',
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
          'Bugs live in territories like this one, around a nest mound. They ignore you unless provoked: building in or next to their territory, a building coming close to one, or shooting them. Then they go for your nearest buildings until things calm down. Destroy the mound to clear the territory for good: turrets in range shoot it when no bugs are near, and it drops chitin.',
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
          'Splitters span two belt lanes. They take items from behind either lane and send them out of both lanes in turn. Use them to branch a line, for example plates to both the hub and a turret.',
      },
    ],
  },
  {
    id: 'forestry',
    title: 'Wood',
    trigger: (w) => w.isUnlocked('lumber_camp'),
    steps: [
      {
        target: (c) => toolThen(c, 'lumber_camp', { tiles: nearestTrees(c.world), shape: 'circle' }),
        done: (c) => built(c, 'lumber_camp'),
        text: (c) =>
          c.ui.tool === 'lumber_camp'
            ? `Place it beside the trees: the blue circle shows its reach of ${LUMBER.range} tiles. It cuts the nearest tree into ${LUMBER.logsPerTree} logs every ${LUMBER.period} seconds, and sends them out of the side its arrow marks.` +
              confirmHint(c)
            : 'Trees are in the way of building, but they are also wood. Pick the Lumber Camp.',
      },
      {
        target: (c) => ({ tiles: campTarget(c.world), shape: 'circle' }),
        text: () =>
          `A cut tree leaves a stump, which grows back in about ${Math.round(LUMBER.regrow / 60)} minutes. Stumps don't block building: build over one to clear it for good, or leave the woods to regrow and keep cutting.`,
      },
      {
        target: (c) => toolThen(c, 'sawmill'),
        done: (c) => built(c, 'sawmill'),
        text: (c) =>
          c.ui.tool === 'sawmill'
            ? "Place it where the camp's logs can reach it by belt, or drop it onto a belt line. Each log becomes two planks." + confirmHint(c)
            : 'Logs need sawing into planks. Pick the Sawmill.',
      },
      {
        target: (c) => ({ tiles: hubTarget(c.world), shape: 'circle' }),
        text: () =>
          'Belt the planks to the hub. They pay for Palisades, cheap wooden walls you can research next, and later supply runs carry them to the colony.',
      },
    ],
  },
  {
    id: 'shipyard',
    title: 'The supply ship',
    trigger: (w) => w.isUnlocked('shipyard') && w.state.ship.runs === 0,
    steps: [
      {
        target: (c) => toolThen(c, 'shipyard'),
        done: (c) => built(c, 'shipyard'),
        text: (c) =>
          c.ui.tool === 'shipyard'
            ? `Build it where you can defend it. When it launches, the engines wake every bug nest within ${SHIP.wakeRadius} tiles, and they come for the shipyard.`
            : 'You can build a ship to carry supplies to the colony. Pick the Shipyard.',
      },
      {
        target: (c) => ({ tiles: shipTarget(c.world), shape: 'circle' }),
        text: () =>
          "The ship goes up in four stages: hull, engine, life support and navigation. Belt each stage's parts into the shipyard; select it to see what it still needs.",
      },
      {
        target: (c) => ({ tiles: shipTarget(c.world), shape: 'circle' }),
        text: () =>
          `Then belt in the cargo and press Launch. For ${SHIP.launchTime} seconds, the bugs of every nest within ${SHIP.wakeRadius} tiles (and at least the ${SHIP.minWake} nearest) come for the shipyard. Hold it, and the supplies are on their way. The ship comes back for more.`,
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
  /** When the current map target came into view (ms). */
  private tilesSince = 0;
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

  /**
   * True while showing an explanation (game paused, input blocked). Never in co-op (D-078): the shared
   * game keeps running, so the player must be able to act while reading.
   */
  private get blocking(): boolean {
    return !!this.lesson && !this.lesson.steps[this.index].done && !this.ui.coop;
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
    document.getElementById('inventory')?.classList.remove('pinned');
    this.setPaused(false);
  }

  private setPaused(pause: boolean): void {
    // A co-op game never stops for one player's lesson (D-078): the lesson explains while it runs.
    if (this.ui.coop) pause = false;
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
    this.root.classList.toggle('blocking', this.blocking);
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
        this.tilesSince = performance.now();
        this.camera.x = target.tiles.tx + target.tiles.size / 2;
        this.camera.y = target.tiles.ty + target.tiles.size / 2;
      }
    }
    // Hub stock is normally hidden unless the hub is selected or pointed at: keep it up while a step points at it.
    document.getElementById('inventory')?.classList.toggle('pinned', target.el === '#inventory');
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

    // Place the tip where it doesn't cover the spotlight: try spots in order of preference,
    // each kept on screen, and take the first that's clear (or the one that covers least).
    const tw = this.tip.offsetWidth;
    const th = this.tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fit = ([x, y]: [number, number]): [number, number] => [
      Math.max(12, Math.min(vw - tw - 12, x)),
      Math.max(12, Math.min(vh - th - 12, y)),
    ];
    const centreX = vw / 2 - tw / 2;
    let candidates: [number, number][];
    if (!r) {
      // Nothing to point at: near the top while the player builds, else centred (or wherever's clear).
      const top: [number, number] = [centreX, 110];
      const bottom: [number, number] = [centreX, vh - th - 120];
      const middle: [number, number] = [centreX, vh / 2 - th / 2];
      candidates = step.done ? [top, bottom, middle] : [middle, top, bottom];
    } else {
      const cx = r.x + r.w / 2 - tw / 2;
      const cy = r.y + r.h / 2 - th / 2;
      const below: [number, number] = [cx, r.y + r.h + GAP];
      const above: [number, number] = [cx, r.y - GAP - th];
      const right: [number, number] = [r.x + r.w + GAP, cy];
      const left: [number, number] = [r.x - GAP - tw, cy];
      const top: [number, number] = [centreX, 110];
      const bottom: [number, number] = [centreX, vh - th - 120];
      // Map targets the player builds around: keep to the half of the screen the target isn't in.
      const far = r.y + r.h / 2 > vh / 2 ? [top, bottom] : [bottom, top];
      candidates = target.tiles && step.done ? [...far, right, left, below, above] : [below, above, right, left, ...far];
    }
    // Keep clear of the spotlight, and of a blueprint's ✓ ⟳ ✕ bar, which the player may need to tap.
    const avoid: Rect[] = [];
    if (r) avoid.push({ x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 });
    const bar = document.getElementById('plan-bar');
    if (bar && !bar.hidden) {
      const b = bar.getBoundingClientRect();
      if (b.width) avoid.push({ x: b.left - 6, y: b.top - 6, w: b.width + 12, h: b.height + 12 });
    }
    const overlap = ([x, y]: [number, number]) =>
      avoid.reduce((sum, a) => sum + Math.max(0, Math.min(x + tw, a.x + a.w) - Math.max(x, a.x)) * Math.max(0, Math.min(y + th, a.y + a.h) - Math.max(y, a.y)), 0);
    // Below the map, the toolbar sits at the bottom: avoid it unless nothing else is clear.
    const toolbarTop = document.getElementById('toolbar')?.getBoundingClientRect().top ?? vh;
    const placed = candidates.map(fit);
    const clear = placed.filter((c) => overlap(c) === 0);
    const [left, top] =
      clear.find(([, y]) => y + th <= toolbarTop - 8) ?? clear[0] ?? placed.reduce((best, c) => (overlap(c) < overlap(best) ? c : best));
    // A big map target (a bug territory) with no clear spot on a phone: slide the map so the
    // target moves away from the tip. Only just after it comes into view, while the layout
    // settles, so it never fights the player's own panning.
    if (r && target.tiles && target.tiles.size >= NESTS.cell && !clear.length && performance.now() - this.tilesSince < 600) {
      const down = top + th / 2 > r.y + r.h / 2; // the tip is below the target: move the target up
      // Keep the tip above the toolbar when there's room for that too.
      const floor = r.h + GAP + th + 24 < toolbarTop ? toolbarTop - 8 : vh - 12;
      const need = down ? r.y + r.h + GAP + th - floor : 12 + th + GAP - r.y;
      this.camera.y += ((down ? 1 : -1) * Math.max(0, need)) / this.camera.zoom;
    }
    this.tip.style.left = `${left}px`;
    this.tip.style.top = `${top}px`;
  }
}
