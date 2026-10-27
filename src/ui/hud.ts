// HTML overlay: top bar, hub stock, build toolbar, info panel and dialogs.

import {
  BLUEPRINTS,
  BLUEPRINT_BY_ID,
  BREACH,
  BUILDINGS,
  BuildingType,
  GameMode,
  HUB_SIZE,
  HUB_WEAPON,
  HYDRAULIC,
  ARC_FENCE,
  ELECTRIC,
  FLOODLIGHT,
  ELECTRIC_DEFENCES,
  MK2,
  ITEMS,
  ITEM_IDS,
  ItemCounts,
  ItemId,
  RECIPE_BY_ID,
  REPAIR,
  SPIKES,
  RESEARCH,
  RESEARCH_BY_ID,
  SHIP,
  TUNNEL_RANGE,
  TURRETS,
  isMachine,
  CLOCK,
  NESTS,
  PLAYER,
  isBelt,
  CRATE_SIZE,
  STORES,
  FUEL,
  burnsFuel,
} from '../sim/data';
import { clockAt } from '../sim/clock';
import { threatAt } from '../sim/nests';
import { artUrl, icon } from '../art';
import { cargoLoaded, checkLaunch, currentCargo, currentStage, nestsToWake, runStats, stageNeeds, wakeRadius } from '../sim/ship';
import type { Command, ResultOf } from '../sim/commands';
import { PlaceError, World, canCollect } from '../sim/world';
import { Player, held } from '../sim/player';
import { Camera } from '../render/camera';
import { buildingRates, toolTitle } from './rates';
import { shipSideView } from './shipview';
import { Tool, UIState, turnTool } from './state';

const TOOLBAR: BuildingType[] = [
  'roller',
  'crate',
  'storage',
  'storage_silo',
  'belt',
  'express_belt',
  'splitter',
  'tunnel',
  'port',
  'shaft',
  'well',
  'water_wheel',
  'boiler',
  'steam_turbine',
  'power_pole',
  'extractor',
  'lumber_camp',
  'furnace',
  'sawmill',
  'workshop',
  'blacksmith',
  'machine_shop',
  'steel_works',
  'powder_mill',
  'assembler',
  'circuit_works',
  'turret',
  'ballista',
  'cannon',
  'turret2',
  'mortar',
  'artillery',
  'tesla',
  'repair',
  'wall',
  'reinforced_wall',
  'steel_wall',
  'arc_fence',
  'floodlight',
  'palisade',
  'spike_pit',
  'trebuchet',
  'shipyard',
];
/** Buildings without a meaningful facing. */
const NO_ROTATE: BuildingType[] = ['well', 'boiler', 'steam_turbine', 'power_pole', 'wall', 'reinforced_wall', 'steel_wall', 'arc_fence', 'floodlight', 'palisade', 'spike_pit', 'repair', 'turret', 'turret2', 'mortar', 'artillery', 'ballista', 'cannon', 'tesla', 'trebuchet', 'port', 'shipyard'];
/** Buildings that take items a character hands them (#40). */
const TAKES_ITEMS: BuildingType[] = ['hub', 'crate', 'storage', 'storage_silo', 'spike_pit', 'trebuchet', 'furnace', 'boiler', 'workshop', 'assembler', 'sawmill', 'blacksmith', 'machine_shop', 'steel_works', 'powder_mill', 'circuit_works', 'turret', 'turret2', 'mortar', 'artillery', 'ballista', 'cannon', 'repair', 'shipyard'];
const DIR_ARROWS = ['→', '↓', '←', '↑'];
const DIR_DEGREES = [0, 90, 180, 270];

const fmtPower = (n: number) => String(Math.round(n * 10) / 10);

const PLACE_ERRORS: Record<PlaceError, string> = {
  bounds: 'Outside the map.',
  occupied: 'That tile is taken.',
  tree: 'Trees are in the way. A Lumber Camp can clear them.',
  locked: 'Research this first.',
  cost: 'Not enough materials in the hub.',
  'needs-resource': 'Extractors must go over ore.',
  'needs-trees': 'Lumber Camps must go near trees.',
  'needs-hub': 'Hub ports must go right next to the hub.',
  nest: "You can't build on a nest's mound. Destroy it first: turrets in range shoot it.",
  unique: 'You can only have one shipyard.',
  site: 'The shipyard goes on the site staked out for it.',
  unmovable: "That can't be moved.",
  water: 'Not on water.',
  'needs-water': 'Its front tile must be in a pond, and the other two on land.',
};

export interface HudActions {
  getWorld(): World;
  /** Changes the world (D-058); the world itself is only read here. */
  /** Undefined in co-op: the command is on its way, and applies a few ticks later (D-078). */
  issue<C extends Command>(command: C): ResultOf<C> | undefined;
  newGame(mode: GameMode, tutorial: boolean): void;
  /** Whether the Essentials lesson has been shown on this device. */
  essentialsSeen(): boolean;
  save(): void;
  hardcoreUnlocked(): boolean;
  lessons(): { id: string; title: string; seen: boolean }[];
  playLesson(id: string): void;
  tipsOff(): boolean;
  setTipsOff(off: boolean): void;
  /** Marks every lesson unseen and switches lessons back on, so each shows again when its moment comes. */
  resetLessons(): void;
  toMainMenu(): void;
  hasGame(): boolean;
  rotatePlan(): void;
  /** A supply run was delivered; `first` when it was this game's first, and its screen has opened. */
  delivered(first: boolean): void;
  /** The first-delivery screen was closed. */
  keptPlaying(): void;
}

/** Fills every empty `[data-icon]` element under `root` with its inline SVG. */
export function hydrateIcons(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-icon]')) {
    if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon!);
  }
}

const ico = (name: string) => `<i data-icon="${name}">${icon(name)}</i>`;

/** Image markup for a building's sprite (turrets get their barrel on top, pointing up). */
function buildingIcon(t: BuildingType, cls = ''): string {
  const key = t === 'tunnel' ? 'tunnel_in' : TURRETS[t] ? `${t}_base` : t;
  const base = artUrl(`buildings/${key}`);
  if (!base) return `<span class="${cls}" style="background:${BUILDINGS[t].color};border-radius:6px"></span>`;
  const barrel = TURRETS[t] ? `<img class="barrel" src="${artUrl(`buildings/${t}_barrel`)}" alt="">` : '';
  return `<span class="${cls}"><img src="${base}" alt="">${barrel}</span>`;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Whether two trees have the same elements in the same places (text and attributes may differ). */
function sameShape(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName || a.childNodes.length !== b.childNodes.length) return false;
  for (let i = 0; i < a.childNodes.length; i++) if (!sameShape(a.childNodes[i], b.childNodes[i])) return false;
  return true;
}

/** Copies text and attributes from `b` onto `a`, which has the same shape. */
function patchNodes(a: Node, b: Node): void {
  if (a.nodeType === Node.TEXT_NODE) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return;
  }
  if (a instanceof Element && b instanceof Element) {
    for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
    for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  }
  for (let i = 0; i < a.childNodes.length; i++) patchNodes(a.childNodes[i], b.childNodes[i]);
}

/**
 * Sets `el`'s contents to `html`, keeping its elements when only numbers, text or attributes changed. A
 * list that redraws while stock changes would otherwise swap a button out between a finger touching it
 * and the click, and the tap would be lost (#86).
 */
function setHtml(el: HTMLElement, html: string): void {
  const next = document.createElement('div');
  next.innerHTML = html;
  const old = el.childNodes;
  const fresh = next.childNodes;
  if (old.length === fresh.length && [...old].every((n, i) => sameShape(n, fresh[i]))) [...old].forEach((n, i) => patchNodes(n, fresh[i]));
  else el.replaceChildren(...fresh);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The shipyard's panel: every stage, what the current one or the cargo still needs, and the launch. */
function shipStats(world: World): string {
  const ship = world.state.ship;
  const stages = SHIP.stages
    .map((st, i) => (i < ship.stage ? `✓ ${esc(st.name)}` : i === ship.stage ? `<b>${esc(st.name)}</b>` : esc(st.name)))
    .join(' · ');
  let html = `<br>${stages}`;
  const stage = currentStage(world);
  const needs = (items: ItemCounts) =>
    Object.entries(items)
      .map(([k, n]) => `${swatch(k as ItemId)}${ship.delivered[k as ItemId] ?? 0}/${n}`)
      .join(' ');
  if (ship.runs) html += `<br>Supply runs delivered: ${ship.runs}`;
  const waits = stageNeeds(world);
  if (stage && waits) {
    html += `<br>Research <b>${esc(RESEARCH_BY_ID[waits].name)}</b> at the hub first. Then belt in: ${needs(stage.items)}`;
  } else if (stage) {
    html += `<br>Belt in: ${needs(stage.items)}`;
  } else if (ship.returnAt != null) {
    html += `<br>The ship is away at the colony. Back in ${formatTime(ship.returnAt - world.state.time)}.`;
  } else if (ship.launchAt != null) {
    html += `<br><b>Lift-off in ${formatTime(ship.launchAt - world.state.time)}.</b> Hold the shipyard!`;
  } else if (!cargoLoaded(world)) {
    html += `<br>Cargo for run ${ship.runs + 1}: ${needs(currentCargo(world))}`;
  } else {
    const n = nestsToWake(world).length;
    html += `<br>Loaded and ready. Launching wakes ${n} bug nest${n === 1 ? '' : 's'} (every one within ${wakeRadius(world)} tiles, and at least the ${SHIP.minWake} nearest). Their bugs come for the shipyard, and it must hold for ${SHIP.launchTime} seconds.`;
  }
  return html;
}

function swatch(item: ItemId): string {
  const url = artUrl(`items/${item}`);
  if (url) return `<img class="item-icon" src="${url}" alt="${ITEMS[item].name}">`;
  return `<span class="swatch" style="background:${ITEMS[item].color}"></span>`;
}

function costHtml(cost: ItemCounts, inv: ItemCounts): string {
  return Object.entries(cost)
    .map(([k, n]) => {
      const item = k as ItemId;
      const short = (inv[item] ?? 0) < n! ? ' short' : '';
      return `<span class="cost${short}">${swatch(item)}${n}</span>`;
    })
    .join(' ');
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  private lastUpdate = 0;
  private toolbarKey = '';
  private infoKey = '';
  /** The engineer's inventory window (#87) is open. It shares its place with the building panel. */
  private packOpen = false;
  private statsHtml = '';
  private invHtml = '';
  /** Where the mouse is, or a finger while it's down: the stock panel fades out of its way. */
  private pointer: { x: number; y: number } | null = null;
  private researchKey = '';
  /** Supply runs seen delivered in the current game, to notice a new one. */
  private runsSeen: { world: World | null; runs: number } = { world: null, runs: 0 };
  /** In co-op, the blueprint offer the player put off with Later (D-080): its card stays away. */
  private offerLater: string | null = null;
  /** Game speed before the first-delivery screen paused the game. */
  private speedBefore = 1;

  constructor(
    private ui: UIState,
    private actions: HudActions,
  ) {
    $('speed').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-speed]');
      if (btn) this.setSpeed(Number(btn.dataset.speed));
    });
    $('research-body').addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const start = target.closest<HTMLElement>('[data-research]');
      if (start) actions.issue({ kind: 'research', id: start.dataset.research! });
      if (target.closest('[data-pause-research]')) actions.issue({ kind: 'pause-research' });
      if (target.closest('[data-choose-blueprint]')) {
        // The offer put off for later (co-op): show it again.
        this.offerLater = null;
        this.closeModals();
        return;
      }
      if (start || target.closest('[data-pause-research]')) {
        this.researchKey = '';
        this.renderResearch(actions.getWorld());
        this.refresh();
      }
    });
    const track = (e: PointerEvent) => (this.pointer = { x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || e.buttons) track(e);
    });
    window.addEventListener('pointerdown', track);
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') this.pointer = null; // a lifted finger stops peeking
    });
    window.addEventListener('pointercancel', () => (this.pointer = null));
    document.documentElement.addEventListener('pointerleave', () => (this.pointer = null));
    $('menu-btn').addEventListener('click', () => this.openModal('menu'));
    $('btn-resume').addEventListener('click', () => this.closeModals());
    $('btn-help').addEventListener('click', () => this.openModal('help'));
    $('btn-mainmenu').addEventListener('click', () => {
      this.closeModals();
      actions.toMainMenu();
    });
    $('btn-gameover-menu').addEventListener('click', () => {
      this.closeModals();
      actions.toMainMenu();
    });
    $('btn-save').addEventListener('click', () => {
      actions.save();
      this.toast('Game saved.');
      this.closeModals();
    });
    $('btn-new').addEventListener('click', () => this.openNewGame());
    $('btn-gameover-new').addEventListener('click', () => this.openNewGame());
    $('blueprint-choices').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-blueprint]');
      if (!btn || actions.issue({ kind: 'pick-blueprint', id: btn.dataset.blueprint! }) === false) return;
      this.closeModals();
      if (!this.ui.coop) this.setSpeed(this.speedBefore || 1);
      actions.save();
      this.refresh();
    });
    $('btn-offer-later').addEventListener('click', () => {
      this.offerLater = actions.getWorld().state.ship.offer?.join() ?? null;
      $('blueprints').hidden = true;
    });
    $('btn-keep-playing').addEventListener('click', () => {
      this.closeModals();
      if (!this.ui.coop) this.setSpeed(this.speedBefore || 1);
      actions.keptPlaying();
    });
    $('btn-victory-menu').addEventListener('click', () => {
      this.closeModals();
      actions.toMainMenu();
    });
    $('btn-tutorial').addEventListener('click', () => this.openLessons());
    $('lessons-list').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-lesson]');
      if (!btn) return;
      this.closeModals();
      actions.playLesson(btn.dataset.lesson!);
    });
    $<HTMLInputElement>('tips-toggle').addEventListener('change', (e) => {
      actions.setTipsOff(!(e.target as HTMLInputElement).checked);
    });
    $('btn-reset-lessons').addEventListener('click', () => {
      actions.resetLessons();
      this.openLessons(); // redraw: nothing is marked seen any more
      this.toast('Tutorials reset. Each lesson will show again when its moment comes.');
    });
    $('newgame').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mode]');
      if (!btn || btn.disabled) return;
      actions.newGame(btn.dataset.mode as GameMode, $<HTMLInputElement>('newgame-tutorial').checked);
      this.closeModals();
    });
    for (const el of document.querySelectorAll<HTMLElement>('.modal [data-close]')) {
      el.addEventListener('click', () => this.closeModals());
    }
    // Clicking or tapping the dimmed backdrop closes a menu. Only when the press
    // also started there, so dragging out of a card doesn't close it. Game over
    // stays up: it needs a choice.
    for (const modal of document.querySelectorAll<HTMLElement>('.modal')) {
      if (modal.id === 'gameover' || modal.id === 'victory' || modal.id === 'blueprints') continue;
      let pressedBackdrop = false;
      modal.addEventListener('pointerdown', (e) => (pressedBackdrop = e.target === modal));
      modal.addEventListener('click', (e) => {
        if (pressedBackdrop && e.target === modal) this.closeModals();
        pressedBackdrop = false;
      });
    }

    $('toolbar').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
      if (!btn) return;
      const tool = btn.dataset.tool as Tool | 'rotate' | 'pack';
      if (tool === 'pack') this.togglePack();
      else if (tool === 'rotate') this.rotate();
      else this.setTool(this.ui.tool === tool ? null : tool);
    });

    $('pack').addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-pack="close"]')) this.togglePack();
    });
    $('pack').addEventListener('change', (e) => {
      const box = e.target as HTMLInputElement;
      if (box.dataset.pack === 'auto') this.actions.issue({ kind: 'auto-drop', on: box.checked });
    });

    $('info').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const id = this.ui.selected;
      switch (btn.dataset.action) {
        case 'recipe':
          if (id != null) this.actions.issue({ kind: 'recipe', id, recipe: btn.dataset.recipe! });
          break;
        case 'filter':
          if (id != null) this.actions.issue({ kind: 'filter', id, item: (btn.dataset.item || null) as ItemId | null });
          break;
        case 'side':
          if (id != null) this.actions.issue({ kind: 'splitter-side', id, side: btn.dataset.side as 'left' | 'right' });
          break;
        case 'rotate':
          this.rotate();
          break;
        case 'demolish':
          if (id != null && this.actions.issue({ kind: 'demolish', id }) !== false) this.ui.selected = null;
          break;
        case 'launch':
          this.actions.issue({ kind: 'launch' });
          break;
        case 'upgrade':
          if (id != null) this.actions.issue({ kind: 'upgrade', id });
          break;
        case 'collect':
          if (id != null) this.actions.issue({ kind: 'collect', id });
          break;
        case 'drop':
          if (id != null) this.actions.issue({ kind: 'drop', id });
          break;
        case 'pickup':
          if (id != null) this.actions.issue({ kind: 'pickup', id });
          break;
        case 'research':
          this.openResearch();
          break;
        case 'move': {
          // Moving a building (#76, #83): it becomes the tool in hand, facing as it does; the next tap puts it down.
          const b = id != null ? this.actions.getWorld().byId.get(id) : undefined;
          if (!b) break;
          this.setTool(b.type);
          this.ui.moving = b.id;
          this.ui.dir = b.dir;
          this.ui.dirSet = true;
          this.toast(`Tap where the ${BUILDINGS[b.type].name.toLowerCase()} goes. Rotate turns it; right-click or tap its tool to cancel.`);
          break;
        }
        case 'ship-view':
          this.shipViewKey = '';
          this.renderShipView(this.actions.getWorld());
          this.openModal('ship-view');
          break;
        case 'close':
          this.ui.selected = null;
          this.ui.tool = null;
          break;
      }
      this.refresh();
    });

    window.addEventListener('keydown', (e) => {
      // Typing in a text box (the feedback form) isn't a shortcut.
      if (document.body.classList.contains('in-menu') || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        this.setSpeed(this.ui.speed === 0 ? 1 : 0);
        return;
      }
      if (e.key === 'i' || e.key === 'I') {
        this.togglePack();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const tools = this.unlockedTools();
        if (tools[n - 1]) this.setTool(this.ui.tool === tools[n - 1] ? null : tools[n - 1]);
      }
    });
  }

  private unlockedTools(): BuildingType[] {
    const world = this.actions.getWorld();
    return TOOLBAR.filter((t) => world.isUnlocked(t));
  }

  /** Opens or closes the engineer's inventory, which takes the building panel's place. */
  private togglePack(): void {
    this.packOpen = !this.packOpen;
    if (this.packOpen) this.ui.selected = null;
    this.refresh();
  }

  setTool(tool: Tool): void {
    if (tool !== this.ui.tool) this.ui.dirSet = false; // a new tool lines up with belts again (#85)
    this.ui.moving = null;
    this.ui.tool = tool;
    this.ui.plan = null;
    if (tool) this.ui.selected = null;
    this.refresh();
  }

  private setSpeed(speed: number): void {
    if (this.ui.coop === 'guest') return; // the host's speed is everyone's
    this.ui.speed = speed;
    this.refresh();
  }

  private rotate(): void {
    if (this.ui.plan) this.actions.rotatePlan();
    else if (this.ui.tool) turnTool(this.actions.getWorld(), this.ui, 1);
    else if (this.ui.selected != null) this.actions.issue({ kind: 'rotate', id: this.ui.selected });
    this.refresh();
  }

  placeError(err: PlaceError): void {
    this.toast(PLACE_ERRORS[err]);
  }

  toast(msg: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  /**
   * Keeps the stock panel just above the hub, part of the map: it scrolls away
   * with the hub. It fades while the pointer is over it, so it never hides
   * the map above the hub.
   */
  placeStock(world: World, camera: Camera): void {
    const el = $('inventory');
    const hub = world.hub;
    if (!hub) return;
    const [sx, top] = camera.toScreen(hub.x + HUB_SIZE / 2, hub.y);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const p = this.pointer;
    const r = el.getBoundingClientRect();
    const near = 12;
    const overPanel = !!p && p.x > r.left - near && p.x < r.right + near && p.y > r.top - near && p.y < r.bottom + near;
    // Shown only while the hub is selected or pointed at (or the pointer moves on to the panel itself).
    const hv = this.ui.hover;
    const overHub = !!hv && hv.x >= hub.x && hv.x < hub.x + HUB_SIZE && hv.y >= hub.y && hv.y < hub.y + HUB_SIZE;
    const shown = this.ui.selected === hub.id || overHub || (overPanel && !el.classList.contains('away'));
    el.classList.toggle('away', !shown);
    el.classList.toggle('peek', shown && overPanel && !overHub);
    el.style.transform = `translate(${Math.round(sx - w / 2)}px, ${Math.round(top - h - 6)}px)`;
  }

  /** Forces the next update() to redraw everything. */
  refresh(): void {
    this.lastUpdate = 0;
    this.toolbarKey = '';
    this.infoKey = '';
  }

  update(world: World, now: number): void {
    for (const msg of world.events.splice(0)) this.toast(msg);
    for (const e of world.playerEvents.splice(0)) this.toast(e.player === this.ui.player ? e.mine : e.others);
    if (now - this.lastUpdate < 150) return;
    this.lastUpdate = now;
    const s = world.state;
    this.updateClock(s.time);

    if (!$('research').hidden) this.renderResearch(world);
    if (!$('ship-view').hidden) this.renderShipView(world);
    for (const b of document.querySelectorAll<HTMLElement>('#speed [data-speed]')) {
      b.classList.toggle('active', Number(b.dataset.speed) === this.ui.speed);
    }

    // Inventory.
    const inv = ITEM_IDS.filter((i) => (s.inventory[i] ?? 0) > 0)
      .map((i) => `<span class="chip" title="${ITEMS[i].name}">${swatch(i)}${s.inventory[i]}</span>`)
      .join('');
    if (inv !== this.invHtml) $('inventory').innerHTML = this.invHtml = inv;

    this.updateToolbar(world);
    if (this.ui.selected != null) this.packOpen = false; // a building's panel takes the place
    this.updateInfo(world);
    this.updatePack(world);

    if (s.gameOver && $('gameover').hidden && $('newgame').hidden) $('gameover').hidden = false;
    // A supply run delivered. The first one in a game gets its own screen, and pauses the game.
    if (this.runsSeen.world !== world) this.runsSeen = { world, runs: s.ship.runs };
    if (s.ship.runs > this.runsSeen.runs) {
      const first = this.runsSeen.runs === 0;
      this.runsSeen.runs = s.ship.runs;
      if (first) {
        $('victory-stats').innerHTML = runStats(world)
          .map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`)
          .join('');
        $('victory').hidden = false;
        // In co-op nothing but the host's pause stops the shared clock (D-078).
        if (!this.ui.coop) {
          this.speedBefore = this.ui.speed;
          this.setSpeed(0);
        }
      }
      this.actions.delivered(first);
    }
    // The colony's blueprint offer waits for a pick (after the first delivery's own screen). In co-op it's
    // a card that leaves the game playable (D-080): no dimming, nothing else closed, and it can wait.
    const card = !!this.ui.coop;
    $('blueprints').classList.toggle('offer-card', card);
    $('btn-offer-later').hidden = !card;
    $('offer-team').hidden = !card;
    const later = card && s.ship.offer?.join() === this.offerLater;
    if (s.ship.offer && !later && $('blueprints').hidden && $('victory').hidden && $('newgame').hidden && $('gameover').hidden) {
      $('blueprint-choices').innerHTML = s.ship.offer
        .map((id) => {
          const bp = BLUEPRINT_BY_ID[id];
          return `<button data-blueprint="${id}">${buildingIcon(bp.unlocks[0], 'bp-icon')}<span><b>${esc(bp.name)}</b><small>${esc(bp.description)}</small></span></button>`;
        })
        .join('');
      if (!card) this.closeModals();
      $('blueprints').hidden = false;
      if (!this.ui.coop) {
        this.speedBefore = this.ui.speed;
        this.setSpeed(0);
      }
    }
    // Another player picked: the offer is gone.
    if (!s.ship.offer && !$('blueprints').hidden) $('blueprints').hidden = true;
    const banner = $('launch-banner');
    banner.hidden = s.ship.launchAt == null;
    if (s.ship.launchAt != null) {
      banner.textContent = `🚀 Lift-off in ${formatTime(s.ship.launchAt - s.time)}. Hold the shipyard!`;
      banner.style.bottom = `${Math.round(window.innerHeight - $('toolbar').getBoundingClientRect().top + 10)}px`;
    }
    if (s.gameOver) $('gameover-text').textContent = `You lasted ${formatTime(s.time)} on the planet.`;
  }

  private updateToolbar(world: World): void {
    const tools = this.unlockedTools();
    const inv = world.state.inventory;
    const me = this.me(world);
    const key = [tools.join(), this.ui.tool, this.ui.dir, this.packOpen, me ? held(me) : 0, ...tools.map((t) => world.canAfford(BUILDINGS[t].cost))].join('|');
    if (key === this.toolbarKey) return;
    this.toolbarKey = key;
    const buttons = tools.map((t, i) => {
      const def = BUILDINGS[t];
      const cls = ['tool', this.ui.tool === t ? 'active' : '', world.canAfford(def.cost) ? '' : 'poor'].join(' ');
      return `<button class="${cls}" data-tool="${t}" title="${esc(toolTitle(t, i + 1))}">
        ${buildingIcon(t, 'icon')}
        <span class="label">${esc(def.name)}</span>
        <span class="costs">${costHtml(def.cost, inv)}</span></button>`;
    });
    buttons.push(
      `<button class="tool util" data-tool="rotate" title="Rotate (R)"><span class="icon" style="transform:rotate(${DIR_DEGREES[this.ui.dir]}deg)">${ico('rotate')}</span><span class="label">Rotate ${DIR_ARROWS[this.ui.dir]}</span></button>`,
      `<button class="tool util ${this.ui.tool === 'demolish' ? 'active' : ''}" data-tool="demolish" title="Demolish (X)"><span class="icon">${ico('demolish')}</span><span class="label">Demolish</span></button>`,
      `<button class="tool util pack-btn ${this.packOpen ? 'active' : ''}" data-tool="pack" title="Inventory (I)"><span class="icon">${ico('collect')}</span><span class="label">Inventory</span><span class="costs">${me ? held(me) : 0}/${PLAYER.slots * PLAYER.stack}</span></button>`,
    );
    // In place, so a tap isn't lost when a count changes under the finger (#86).
    setHtml($('toolbar'), buttons.join(''));
  }

  /** This player's engineer. */
  private me(world: World): Player | undefined {
    return world.state.players.find((p) => p.id === this.ui.player);
  }

  /** The engineer's inventory (#87): its slots, how full it is, and whether the hub empties it. */
  private updatePack(world: World): void {
    const panel = $('pack');
    const me = this.me(world);
    panel.hidden = !this.packOpen || !me;
    if (panel.hidden || !me) return;
    const slots = me.slots
      .map((s) =>
        s
          ? `<div class="slot" title="${esc(ITEMS[s.item].name)}">${swatch(s.item)}<span class="slot-n">${s.n}</span></div>`
          : '<div class="slot empty"></div>',
      )
      .join('');
    setHtml(
      panel,
      `<div class="info-head"><span>${ico('collect')}Inventory</span><button data-pack="close" aria-label="Close inventory">${ico('close')}</button></div>
      <p class="small muted">${held(me)} of ${PLAYER.slots * PLAYER.stack}: ${PLAYER.slots} slots of ${PLAYER.stack}. Mining, Collect and Pick up fill it; Drop off empties it into a building.</p>
      <div class="slots">${slots}</div>
      <label class="pack-auto"><input type="checkbox" data-pack="auto" ${me.autoDrop ? 'checked' : ''}> Drop off at the hub when I walk up to it</label>`,
    );
    const box = panel.querySelector<HTMLInputElement>('[data-pack="auto"]');
    if (box && box.checked !== me.autoDrop) box.checked = me.autoDrop;
  }

  /** The panel for the selected building. Only placed buildings get one, not the tool in hand. */
  private updateInfo(world: World): void {
    const panel = $('info');
    const b = this.ui.selected != null ? world.byId.get(this.ui.selected) : undefined;
    if (this.ui.selected != null && !b) this.ui.selected = null;

    if (!b) {
      panel.hidden = true;
      this.infoKey = '';
      return;
    }
    panel.hidden = false;

    // Structure (buttons) only changes when the subject changes, so clicks aren't lost.
    const ship = world.state.ship;
    const key = `b:${b.id}:${b.recipe}:${b.filter}:${b.side}:${b.dir}:${b.tier ?? 1}:${world.state.researched.includes('mk2')}:${b.type === 'shipyard' ? `${ship.stage}:${stageNeeds(world)}:${ship.launchAt != null}:${ship.returnAt != null}:${ship.runs}:${cargoLoaded(world)}` : ''}`;
    if (key !== this.infoKey) {
      this.infoKey = key;
      this.statsHtml = '';
      let html = '';
      {
        const def = BUILDINGS[b!.type];
        let actions = '';
        if (b!.type === 'hub') actions += `<div class="row"><button data-action="research" class="primary">${ico('research')}<span class="research-label">Research</span></button></div>`;
        if (isMachine(b!.type)) {
          actions += `<div class="recipes">${world
            .recipesFor(b!.type)
            .map(
              (r) =>
                `<button data-action="recipe" data-recipe="${r.id}" class="${b!.recipe === r.id ? 'active' : ''}">${swatch(r.output)}${esc(ITEMS[r.output].name)}</button>`,
            )
            .join('')}</div>`;
        }
        if (b!.type === 'splitter') {
          // Sort one item to a side (#62); with none chosen, the sides take turns.
          const side = b!.side ?? 'left';
          actions += `<p class="small muted">Sort one item to a side; everything else goes out of the other.</p><div class="row seg-row">${(['left', 'right'] as const)
            .map((s) => `<button data-action="side" data-side="${s}" class="${side === s ? 'active' : ''}">${s === 'left' ? '← Left' : 'Right →'}</button>`)
            .join('')}</div><div class="recipes">${ITEM_IDS.map(
            (i) =>
              `<button data-action="filter" data-item="${i}" class="${b!.filter === i ? 'active' : ''}" title="${ITEMS[i].name}">${swatch(i)}${esc(ITEMS[i].name)}</button>`,
          ).join('')}<button data-action="filter" data-item="" class="${b!.filter ? '' : 'active'}">Off</button></div>`;
        }
        if (b!.type === 'port') {
          actions += `<div class="recipes">${ITEM_IDS.map(
            (i) =>
              `<button data-action="filter" data-item="${i}" class="${b!.filter === i ? 'active' : ''}" title="${ITEMS[i].name}">${swatch(i)}${esc(ITEMS[i].name)}</button>`,
          ).join('')}<button data-action="filter" data-item="" class="${b!.filter ? '' : 'active'}">Off</button></div>`;
        }
        // Before belts, finished items are carried to the hub by hand (#38).
        // Your character fetches what it has made, or hands it what you carry (#38, #40).
        if (isBelt(b!.type) || b!.type === 'splitter' || b!.type === 'tunnel') {
          actions += `<div class="row"><button data-action="pickup" title="Your engineer takes the items off it (#87)">${ico('collect')}<span class="pickup-label">Pick up</span></button></div>`;
        }
        const takes = TAKES_ITEMS.includes(b!.type);
        if (canCollect(b!.type) || takes) {
          actions += '<div class="row">';
          if (canCollect(b!.type)) actions += `<button data-action="collect" title="Your engineer fetches what it has made">${ico('collect')}<span class="collect-label">Collect</span></button>`;
          if (takes) actions += `<button data-action="drop" title="Your engineer hands it what they carry"><span class="drop-label">Drop off</span></button>`;
          actions += '</div>';
        }
        if (b!.type === 'shipyard') actions += `<div class="row"><button data-action="ship-view">Side view</button></div>`;
        // Mk2 (D-122): upgrade an extractor or furnace in place.
        if (MK2.types.includes(b!.type) && b!.tier !== 2 && world.state.researched.includes('mk2')) {
          const cost = Object.entries(MK2.cost)
            .map(([k, n]) => `${swatch(k as ItemId)}${n}`)
            .join(' ');
          actions += `<div class="row"><button data-action="upgrade" title="Twice as fast with electricity from a power pole">⬆ Upgrade to Mk2 ${cost}</button></div>`;
        }
        if (b!.type === 'shipyard' && checkLaunch(world) === null) {
          actions += `<div class="row"><button data-action="launch" class="primary launch">🚀 Launch</button></div>`;
        }
        if (b!.type !== 'hub') {
          actions += `<div class="row">`;
          if (!NO_ROTATE.includes(b!.type) && b!.type !== 'tunnel') actions += `<button data-action="rotate">⟳ Rotate</button>`;
          if (world.canMove(b!)) actions += `<button data-action="move" title="Pick it up and put it somewhere else, with what it holds">✥ Move</button>`;
          actions += `<button data-action="demolish" class="danger">✕ Demolish</button></div>`;
        }
        html = `<div class="info-head"><span>${buildingIcon(b!.type, 'head-icon')}${esc(def.name)}</span><button data-action="close">${ico('close')}</button></div>
          <p>${esc(def.description)}</p><div class="stats"></div>${actions}`;
      }
      panel.innerHTML = html;
    }

    let stats = '';
    {
      stats = `HP ${Math.ceil(b.hp)} / ${world.maxHp(b)}`;
      const rates = buildingRates(world, b);
      if (rates) {
        stats += `<br><b>Rate</b> ${esc(rates.max)}`;
        if (rates.now) stats += `<br><b>Now</b> ${esc(rates.now)}`;
      }
      const t = TURRETS[b.type];
      if (t?.ammoItem) stats += `<br>Ammo ${b.ammo} / ${t.maxShots} ${swatch(t.ammoItem)}${ITEMS[t.ammoItem].name}`;
      else if (t) stats += '<br>No ammunition needed: it fires on electricity';
      if (b.type === 'extractor') {
        const ore = b.recipe as ItemId | null;
        stats += `<br>Mining ${ore ? swatch(ore) + ITEMS[ore].name : 'nothing'}`;
        // How much is left under it, and from how many tiles (D-096).
        const [fw, fh] = world.footprintOf(b);
        let left = 0;
        let tiles = 0;
        for (let y = b.y; y < b.y + fh; y++) for (let x = b.x; x < b.x + fw; x++) if (ore && world.resourceAt(x, y) === ore) [left, tiles] = [left + world.oreLeft(x, y), tiles + 1];
        if (ore) stats += tiles ? `<br>${left} ore left in ${tiles} tile${tiles === 1 ? '' : 's'}: ${tiles} a cycle` : '<br>Used up: no ore left under it';
      }
      if (b.type === 'lumber_camp') {
        const [fw, fh] = world.footprintOf(b);
        const reach = world.treesInReach(b.x, b.y, fw, fh);
        stats += `<br>${reach.trees.length} tree${reach.trees.length === 1 ? '' : 's'} in reach, ${reach.stumps} stump${reach.stumps === 1 ? '' : 's'} growing back`;
      }
      if (isMachine(b.type)) {
        const r = b.recipe ? RECIPE_BY_ID[b.recipe] : undefined;
        if (r) {
          const ins = Object.entries(r.inputs)
            .map(([k, n]) => `${swatch(k as ItemId)}${b.inputs[k as ItemId] ?? 0}/${n}`)
            .join(' ');
          stats += `<br>Needs ${ins} → ${swatch(r.output)}×${r.count} (${r.time}s)`;
        } else {
          stats += '<br>No recipe: pick one, or feed it an input.';
        }
      }
      if (b.outputs.length) stats += `<br>Output buffer ${b.outputs.map(swatch).join('')}`;
      const me = world.state.players.find((p) => p.id === this.ui.player);
      const carried = me ? held(me) : 0;
      const drop = panel.querySelector<HTMLButtonElement>('[data-action="drop"]');
      if (drop) {
        drop.disabled = !carried;
        const label = carried ? `Drop off ${carried}` : 'Drop off';
        const span = drop.querySelector('.drop-label')!;
        if (span.textContent !== label) span.textContent = label;
      }
      const pickup = panel.querySelector<HTMLButtonElement>('[data-action="pickup"]');
      if (pickup) {
        const n = b.belt.length + (b.type === 'splitter' || b.type === 'tunnel' ? b.outputs.length : 0);
        pickup.disabled = !n;
        const label = n ? `Pick up ${n}` : 'Pick up';
        const span = pickup.querySelector('.pickup-label')!;
        if (span.textContent !== label) span.textContent = label;
      }
      const collect = panel.querySelector<HTMLButtonElement>('[data-action="collect"]');
      if (collect) {
        collect.disabled = !b.outputs.length;
        const label = b.outputs.length ? `Collect ${b.outputs.length}` : 'Collect';
        const span = collect.querySelector('.collect-label')!;
        if (span.textContent !== label) span.textContent = label;
      }
      if (b.type === 'spike_pit') stats += `<br>Spikes ${Math.ceil(b.ammo)} / ${SPIKES.maxCharge} s of wear ${swatch('stake')}Stakes refill it`;
      if (b.type === 'repair') stats += `<br>Stored repairs ${Math.floor(b.ammo)} / ${REPAIR.maxCharge} HP`;
      // Power (D-115): what the building's network gives and uses.
      const net = world.powerNet(b);
      if (net && (b.type !== 'splitter' && b.type !== 'tunnel')) {
        const p = world.powered(b);
        const use = `${fmtPower(net.supply)} power, it all uses ${fmtPower(net.demand)}`;
        const hydraulic = HYDRAULIC.includes(b.type);
        stats +=
          b.type === 'belt' || hydraulic
            ? p >= 1
              ? `<br>Powered (${use})`
              : p > 0
                ? `<br>Short of power: ${Math.round(p * 100)}% (${use}). ${hydraulic ? 'It fires more slowly' : 'Belts slow down'}`
                : `<br><b>No power:</b> ${hydraulic ? "it can't fire" : 'it rolls only at roller speed'}. Lay drive shafts from a well or water wheel`
            : `<br>Network: ${use}`;
      }
      // Electricity (D-121): what the building's electric network gives and uses.
      const enet = world.electricNet(b);
      if (enet) {
        const use = `${fmtPower(world.electricSupply(enet))} electricity, it all uses ${fmtPower(enet.demand)}`;
        const e = world.electrified(b);
        stats +=
          b.type === 'express_belt' || ELECTRIC_DEFENCES.includes(b.type)
            ? e >= 1
              ? `<br>Electric (${use})`
              : e > 0
                ? `<br>Short of electricity: ${Math.round(e * 100)}% (${use}). ${b.type === 'express_belt' ? 'Express belts slow down' : 'It fires more slowly'}`
                : `<br><b>No electricity:</b> ${b.type === 'express_belt' ? 'it rolls only at roller speed' : "it can't fire"}. Put a power pole near it, linked to a steam turbine`
            : b.type === 'steam_turbine'
              ? `<br>Steam ${Math.round(world.steam(b) * 100)}%: ${world.steam(b) > 0 ? `makes ${fmtPower(ELECTRIC.turbine * world.steam(b))}` : 'needs a working boiler touching it'} (${use})`
              : `<br>Network: ${use}`;
      }
      // The Arc Fence and the Floodlight (D-126).
      if (b.type === 'arc_fence') {
        const e = world.electrified(b);
        stats += e > 0 ? `<br>Shocks each bug biting it for ${Math.round(ARC_FENCE.dps * e)} damage a second` : "<br><b>No electricity:</b> it doesn't shock. Put a power pole near it";
      }
      if (b.type === 'floodlight') {
        stats += world.electrified(b) > 0
          ? `<br>At night it lights ${FLOODLIGHT.radius} tiles around it, and bugs in its light move at ${Math.round(FLOODLIGHT.slow * 100)}% speed`
          : "<br><b>No electricity:</b> it's dark. Put a power pole near it";
      }
      if (b.type === 'boiler') {
        stats += !world.hasWater(b)
          ? '<br><b>No water:</b> place it touching a well or a water wheel'
          : !world.touching(b).some((n) => n.type === 'steam_turbine')
            ? '<br>No turbine: place a steam turbine touching it'
            : b.ammo > 0
              ? '<br>Making steam'
              : '';
      }
      if (b.tier === 2) {
        const e = world.electrified(b);
        stats += `<br>Mk2: ${e >= 1 ? `${MK2.speed}× speed` : e > 0 ? `${(1 + (MK2.speed - 1) * e).toFixed(1)}× speed, short of electricity` : '<b>no electricity:</b> Mk1 speed. Put a power pole near it'}`;
      }
      if (burnsFuel(b.type)) {
        const fuels = Object.entries(FUEL.burns)
          .map(([k, s]) => `${swatch(k as ItemId)}${ITEMS[k as ItemId].name.toLowerCase()} ${s} s`)
          .join(', ');
        stats += `<br>Fuel ${Math.ceil(b.ammo)} / ${FUEL.max} s${b.ammo <= 0 ? ' <b>(out: it has stopped)</b>' : ''} · burns ${fuels}`;
      }
      if (b.type === 'tunnel') {
        const p = b.link != null ? world.byId.get(b.link) : undefined;
        if (!p) stats += `<br>Entrance with no exit. Place one up to ${TUNNEL_RANGE} tiles ahead, facing the same way.`;
        else {
          const d = Math.abs(p.x - b.x) + Math.abs(p.y - b.y);
          stats += world.isTunnelExit(b) ? `<br>Exit, ${d} tiles from its entrance` : `<br>Entrance, ${d} tiles from its exit (${b.belt.length} in transit)`;
        }
      }
      if (b.type === 'port') {
        stats += b.filter
          ? `<br>Sending ${swatch(b.filter)}${ITEMS[b.filter].name} (${world.state.inventory[b.filter] ?? 0} in stock)`
          : '<br>Choose an item to send out.';
      }
      if (b.type === 'splitter') {
        const side = b.side ?? 'left';
        stats += b.filter
          ? `<br>${swatch(b.filter)}${ITEMS[b.filter].name} out of the ${side}, everything else out of the ${side === 'left' ? 'right' : 'left'}`
          : '<br>Items go out of each side in turn.';
      }
      if (b.type === 'hub') {
        stats += `<br>Mode: ${world.state.mode === 'hardcore' ? 'Hardcore (losing the hub ends the run)' : 'Standard'}`;
        if (world.state.breaches) stats += `<br>Breached ${world.state.breaches}×`;
        const rs = world.state.research;
        stats += rs.active
          ? `<br>Researching ${esc(RESEARCH.find((r) => r.id === rs.active)!.name)}: ${rs.stalled ? 'stalled, out of an item' : Math.floor(world.researchProgress(rs.active) * 100) + '%'}`
          : `<br>${world.availableResearch().length} research available`;
        stats += `<br>Hub gun: ${HUB_WEAPON.damage} damage, ${HUB_WEAPON.rate}/s, range ${HUB_WEAPON.range}. No ammo needed`;
      }
      if (b.type === 'shipyard') stats += shipStats(world);
      if (isBelt(b.type)) stats += `<br>Carrying ${b.belt.length} item${b.belt.length === 1 ? '' : 's'}`;
      if (b.type === 'crate') stats += b.outputs.length ? `<br>Holds ${b.outputs.length} of ${CRATE_SIZE}: ${esc(ITEMS[b.outputs[0]].name)}` : `<br>Empty: holds up to ${CRATE_SIZE} of one item`;
      const store = STORES[b.type];
      if (store) {
        const counts = new Map<ItemId, number>();
        for (const it of b.outputs) counts.set(it, (counts.get(it) ?? 0) + 1);
        const list = [...counts].map(([k, n]) => `${swatch(k)}${n}`).join(' ');
        stats += b.outputs.length ? `<br>Holds ${b.outputs.length} of ${store.slots * store.stack}: ${list}` : `<br>Empty: ${store.slots} stacks of up to ${store.stack}`;
      }
    }
    if (stats !== this.statsHtml) {
      this.statsHtml = stats;
      const el = panel.querySelector('.stats');
      if (el) el.innerHTML = stats;
    }
  }

  private shipViewKey = '';

  /** The ship's side view (D-109), redrawn while it's open as parts arrive. */
  private renderShipView(world: World): void {
    const key = JSON.stringify([world.state.ship.stage, world.state.ship.delivered]);
    if (key === this.shipViewKey) return;
    this.shipViewKey = key;
    $('ship-view-body').innerHTML = shipSideView(world);
  }

  private openResearch(): void {
    this.researchKey = '';
    this.renderResearch(this.actions.getWorld());
    this.openModal('research');
  }

  /** Redraws the research list when anything on it has changed. */
  private renderResearch(world: World): void {
    const rs = world.state.research;
    const inv = world.state.inventory;
    const key = JSON.stringify([rs.active, rs.stalled, rs.paid, world.state.researched.length, ITEM_IDS.map((i) => inv[i] ?? 0), world.state.ship.blueprints, world.state.ship.offer]);
    if (key === this.researchKey) return;
    this.researchKey = key;
    const rows = RESEARCH.map((r) => {
      const err = world.checkResearch(r.id);
      const unlocks = r.unlocks.map((t) => BUILDINGS[t].name).join(', ');
      const active = rs.active === r.id;
      const progress = world.researchProgress(r.id);
      const paid = rs.paid[r.id] ?? {};
      let action: string;
      let state = '';
      if (err === 'done') action = '<span class="done">✓ Done</span>';
      else if (err === 'requires') {
        const missing = r.requires.filter((q) => !world.state.researched.includes(q));
        action = `<span class="muted">Needs ${missing.map((q) => RESEARCH.find((x) => x.id === q)!.name).join(', ')}</span>`;
      } else if (active) {
        action = `<button data-pause-research>${ico('pause')}Pause</button>`;
        state = rs.stalled ? '<span class="stalled-note">Stalled: the hub is out of an item it needs</span>' : '<span class="active-note">Researching…</span>';
      } else {
        action = `<button data-research="${r.id}" class="${rs.active ? '' : 'primary'}">${ico('research')}${progress > 0 ? 'Resume' : rs.active ? 'Switch' : 'Start'}</button>`;
      }
      const items =
        err === 'done'
          ? ''
          : Object.entries(r.cost)
              .map(([k, n]) => {
                const item = k as ItemId;
                const have = Math.min(n!, paid[item] ?? 0);
                const short = have < n! && (inv[item] ?? 0) === 0 ? ' short' : '';
                return `<span class="cost${short}">${swatch(item)}${have}/${n}</span>`;
              })
              .join(' ') + ` <span class="muted">· ${formatTime(r.time)}</span>`;
      const bar = err !== 'done' && (active || progress > 0) ? `<div class="bar"><div style="width:${progress * 100}%"></div></div>` : '';
      return `<div class="research ${err ?? 'ready'} ${active ? 'active' : ''}">
        <div><b>${esc(r.name)}</b> <span class="muted">→ ${esc(unlocks)}</span><br>
        <span class="muted">${esc(r.description)}</span><br>${items}${state ? '<br>' + state : ''}${bar}</div>
        <div>${action}</div></div>`;
    });
    const ship = world.state.ship;
    const colony = BLUEPRINTS.map((bp) => {
      const have = ship.blueprints.includes(bp.id);
      const state = have
        ? '<span class="done">✓ Received</span>'
        : ship.offer?.includes(bp.id)
          ? this.ui.coop && ship.offer.join() === this.offerLater
            ? '<button data-choose-blueprint>Choose</button>'
            : '<span class="muted">On offer now</span>'
          : '<span class="muted">Deliver a supply run</span>';
      const unlocks = bp.unlocks.map((t) => BUILDINGS[t].name).join(', ');
      return `<div class="research ${have ? 'done' : 'requires'}">
        <div><b>${esc(bp.name)}</b> <span class="muted">→ ${esc(unlocks)}</span><br><span class="muted">${esc(bp.description)}</span></div>
        <div>${state}</div></div>`;
    });
    setHtml($('research-body'), `<p class="muted">Start a research and it draws its items from hub stock over time. It stalls if the hub runs out. You can switch at any time without losing progress.</p>${rows.join('')}${
      colony.length // none until the special buildings come (D-126)
        ? `<h3>From the colony</h3>
      <p class="muted">Blueprints you can't research. After each supply run, the colony offers two and you pick one.</p>${colony.join('')}`
        : ''
    }`);
  }

  private openLessons(): void {
    $('lessons-list').innerHTML = this.actions
      .lessons()
      .map(
        (l) =>
          `<button data-lesson="${l.id}">${ico('play')}${esc(l.title)}${l.seen ? '<span class="lesson-seen">✓ Seen</span>' : ''}</button>`,
      )
      .join('');
    $<HTMLInputElement>('tips-toggle').checked = !this.actions.tipsOff();
    this.openModal('lessons');
  }

  openNewGame(): void {
    $('newgame-warning').hidden = !this.actions.hasGame();
    // On by default until the player has been through the basics once.
    $<HTMLInputElement>('newgame-tutorial').checked = !this.actions.essentialsSeen();
    const unlocked = this.actions.hardcoreUnlocked();
    const hc = $<HTMLButtonElement>('btn-hardcore');
    hc.disabled = !unlocked;
    $('hardcore-note').textContent = unlocked
      ? 'Losing the hub ends the run.'
      : 'Locked: deliver a supply run in Standard to unlock.';
    $('standard-note').textContent = `If the hub falls, the bugs go home but you lose ${BREACH.stockLost * 100}% of hub stock.`;
    this.openModal('newgame');
  }

  /** The season, the day and whether it's night, in the top bar (#42). */
  private updateClock(time: number): void {
    const c = clockAt(time);
    const text = `${c.season.name} · Day ${c.day}`;
    const el = $('clock');
    const label = el.querySelector('.clock-text')!;
    if (label.textContent !== text) label.textContent = text;
    const icon = c.night ? '☾' : '☀';
    const iconEl = el.querySelector('.clock-icon')!;
    if (iconEl.textContent !== icon) iconEl.textContent = icon;
    el.classList.toggle('night', c.night);
    el.dataset.season = c.season.id;
    const left = Math.ceil(((1 - c.part) * (c.night ? CLOCK.night : CLOCK.day)) / 60);
    const threat = threatAt(time);
    const threatEl = el.querySelector<HTMLElement>('.clock-threat')!;
    const threatText = threat ? `⚠${threat}` : '';
    if (threatEl.textContent !== threatText) threatEl.textContent = threatText;
    threatEl.hidden = !threat;
    el.title =
      `${c.night ? 'Night' : 'Day'}: about ${left} min until ${c.night ? 'morning' : 'nightfall'}. Day ${c.seasonDay} of ${c.season.days} in ${c.season.name}.` +
      ` Threat level ${threat}: it rises every ${NESTS.threatEvery / 60} minutes, making new bugs tougher.`;
  }

  openModal(id: string): void {
    this.closeModals();
    $(id).hidden = false;
  }

  closeModals(): void {
    for (const m of document.querySelectorAll<HTMLElement>('.modal')) m.hidden = true;
  }
}
