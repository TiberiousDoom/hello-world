// HTML overlay: top bar, hub stock, build toolbar, info panel and dialogs.

import {
  BREACH,
  BUILDINGS,
  BuildingType,
  GameMode,
  HUB_SIZE,
  HUB_WEAPON,
  ITEMS,
  LUMBER,
  ITEM_IDS,
  ItemCounts,
  ItemId,
  RECIPE_BY_ID,
  REPAIR,
  RESEARCH,
  SHIP,
  TUNNEL_RANGE,
  TURRETS,
  isMachine,
} from '../sim/data';
import { artUrl, icon } from '../art';
import { cargoLoaded, checkLaunch, currentCargo, currentStage, launch, runStats } from '../sim/ship';
import { PlaceError, World } from '../sim/world';
import { Camera } from '../render/camera';
import { Tool, UIState } from './state';

const TOOLBAR: BuildingType[] = [
  'belt',
  'splitter',
  'tunnel',
  'port',
  'extractor',
  'lumber_camp',
  'furnace',
  'sawmill',
  'workshop',
  'assembler',
  'turret',
  'cannon',
  'repair',
  'wall',
  'palisade',
  'shipyard',
];
/** Buildings without a meaningful facing. */
const NO_ROTATE: BuildingType[] = ['wall', 'palisade', 'repair', 'turret', 'cannon', 'port', 'shipyard'];
const DIR_ARROWS = ['→', '↓', '←', '↑'];
const DIR_DEGREES = [0, 90, 180, 270];

const PLACE_ERRORS: Record<PlaceError, string> = {
  bounds: 'Outside the map.',
  occupied: 'That tile is taken.',
  tree: 'Trees are in the way. A Lumber Camp can clear them.',
  locked: 'Research this first.',
  cost: 'Not enough materials in the hub.',
  'needs-resource': 'Extractors must go over ore.',
  'needs-trees': 'Lumber Camps must go near trees.',
  'needs-hub': 'Hub ports must go right next to the hub.',
  unique: 'You can only have one shipyard.',
};

export interface HudActions {
  getWorld(): World;
  newGame(mode: GameMode, tutorial: boolean): void;
  /** Whether the Essentials lesson has been shown on this device. */
  essentialsSeen(): boolean;
  save(): void;
  hardcoreUnlocked(): boolean;
  lessons(): { id: string; title: string; seen: boolean }[];
  playLesson(id: string): void;
  tipsOff(): boolean;
  setTipsOff(off: boolean): void;
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
  const key = t === 'tunnel' ? 'tunnel_in' : t === 'turret' || t === 'cannon' ? `${t}_base` : t;
  const base = artUrl(`buildings/${key}`);
  if (!base) return `<span class="${cls}" style="background:${BUILDINGS[t].color};border-radius:6px"></span>`;
  const barrel = TURRETS[t] ? `<img class="barrel" src="${artUrl(`buildings/${t}_barrel`)}" alt="">` : '';
  return `<span class="${cls}"><img src="${base}" alt="">${barrel}</span>`;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

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
  if (stage) {
    html += `<br>Belt in: ${needs(stage.items)}`;
  } else if (ship.returnAt != null) {
    html += `<br>The ship is away at the colony. Back in ${formatTime(ship.returnAt - world.state.time)}.`;
  } else if (ship.launchAt != null) {
    html += `<br><b>Lift-off in ${formatTime(ship.launchAt - world.state.time)}.</b> Hold the shipyard!`;
  } else if (!cargoLoaded(world)) {
    html += `<br>Cargo for run ${ship.runs + 1}: ${needs(currentCargo(world))}`;
  } else {
    html += `<br>Loaded and ready. Launching wakes every bug nest within ${SHIP.wakeRadius} tiles, and the shipyard must hold for ${SHIP.launchTime} seconds.`;
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
  private statsHtml = '';
  private invHtml = '';
  /** Where the mouse is, or a finger while it's down: the stock panel fades out of its way. */
  private pointer: { x: number; y: number } | null = null;
  private researchKey = '';
  /** Supply runs seen delivered in the current game, to notice a new one. */
  private runsSeen: { world: World | null; runs: number } = { world: null, runs: 0 };
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
      if (start) actions.getWorld().startResearch(start.dataset.research!);
      if (target.closest('[data-pause-research]')) actions.getWorld().pauseResearch();
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
    $('btn-keep-playing').addEventListener('click', () => {
      this.closeModals();
      this.setSpeed(this.speedBefore || 1);
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
      if (modal.id === 'gameover' || modal.id === 'victory') continue;
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
      const tool = btn.dataset.tool as Tool | 'rotate';
      if (tool === 'rotate') this.rotate();
      else this.setTool(this.ui.tool === tool ? null : tool);
    });

    $('info').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const world = actions.getWorld();
      const id = this.ui.selected;
      switch (btn.dataset.action) {
        case 'recipe':
          if (id != null) world.setRecipe(id, btn.dataset.recipe!);
          break;
        case 'filter':
          if (id != null) world.setFilter(id, (btn.dataset.item || null) as ItemId | null);
          break;
        case 'rotate':
          this.rotate();
          break;
        case 'demolish':
          if (id != null && world.demolish(id)) this.ui.selected = null;
          break;
        case 'launch':
          launch(world);
          break;
        case 'research':
          this.openResearch();
          break;
        case 'close':
          this.ui.selected = null;
          this.ui.tool = null;
          break;
      }
      this.refresh();
    });

    window.addEventListener('keydown', (e) => {
      if (document.body.classList.contains('in-menu')) return;
      if (e.key === ' ') {
        e.preventDefault();
        this.setSpeed(this.ui.speed === 0 ? 1 : 0);
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

  setTool(tool: Tool): void {
    this.ui.tool = tool;
    this.ui.plan = null;
    if (tool) this.ui.selected = null;
    this.refresh();
  }

  private setSpeed(speed: number): void {
    this.ui.speed = speed;
    this.refresh();
  }

  private rotate(): void {
    if (this.ui.plan) this.actions.rotatePlan();
    else if (this.ui.tool) this.ui.dir = ((this.ui.dir + 1) % 4) as UIState['dir'];
    else if (this.ui.selected != null) this.actions.getWorld().rotate(this.ui.selected);
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
    el.classList.toggle('peek', !!p && p.x > r.left - near && p.x < r.right + near && p.y > r.top - near && p.y < r.bottom + near);
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
    if (now - this.lastUpdate < 150) return;
    this.lastUpdate = now;
    const s = world.state;

    if (!$('research').hidden) this.renderResearch(world);
    for (const b of document.querySelectorAll<HTMLElement>('#speed [data-speed]')) {
      b.classList.toggle('active', Number(b.dataset.speed) === this.ui.speed);
    }

    // Inventory.
    const inv = ITEM_IDS.filter((i) => (s.inventory[i] ?? 0) > 0)
      .map((i) => `<span class="chip" title="${ITEMS[i].name}">${swatch(i)}${s.inventory[i]}</span>`)
      .join('');
    if (inv !== this.invHtml) $('inventory').innerHTML = this.invHtml = inv;

    this.updateToolbar(world);
    this.updateInfo(world);

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
        this.speedBefore = this.ui.speed;
        this.setSpeed(0);
      }
      this.actions.delivered(first);
    }
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
    const key = [tools.join(), this.ui.tool, this.ui.dir, ...tools.map((t) => world.canAfford(BUILDINGS[t].cost))].join('|');
    if (key === this.toolbarKey) return;
    this.toolbarKey = key;
    const buttons = tools.map((t, i) => {
      const def = BUILDINGS[t];
      const cls = ['tool', this.ui.tool === t ? 'active' : '', world.canAfford(def.cost) ? '' : 'poor'].join(' ');
      return `<button class="${cls}" data-tool="${t}" title="${esc(def.name)} (${i + 1})">
        ${buildingIcon(t, 'icon')}
        <span class="label">${esc(def.name)}</span>
        <span class="costs">${costHtml(def.cost, inv)}</span></button>`;
    });
    buttons.push(
      `<button class="tool util" data-tool="rotate" title="Rotate (R)"><span class="icon" style="transform:rotate(${DIR_DEGREES[this.ui.dir]}deg)">${ico('rotate')}</span><span class="label">Rotate ${DIR_ARROWS[this.ui.dir]}</span></button>`,
      `<button class="tool util ${this.ui.tool === 'demolish' ? 'active' : ''}" data-tool="demolish" title="Demolish (X)"><span class="icon">${ico('demolish')}</span><span class="label">Demolish</span></button>`,
    );
    $('toolbar').innerHTML = buttons.join('');
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
    const key = `b:${b.id}:${b.recipe}:${b.filter}:${b.dir}:${b.type === 'shipyard' ? `${ship.stage}:${ship.launchAt != null}:${ship.returnAt != null}:${ship.runs}:${cargoLoaded(world)}` : ''}`;
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
        if (b!.type === 'port') {
          actions += `<div class="recipes">${ITEM_IDS.map(
            (i) =>
              `<button data-action="filter" data-item="${i}" class="${b!.filter === i ? 'active' : ''}" title="${ITEMS[i].name}">${swatch(i)}${esc(ITEMS[i].name)}</button>`,
          ).join('')}<button data-action="filter" data-item="" class="${b!.filter ? '' : 'active'}">Off</button></div>`;
        }
        if (b!.type === 'shipyard' && checkLaunch(world) === null) {
          actions += `<div class="row"><button data-action="launch" class="primary launch">🚀 Launch</button></div>`;
        }
        if (b!.type !== 'hub') {
          actions += `<div class="row">`;
          if (!NO_ROTATE.includes(b!.type) && b!.type !== 'tunnel') actions += `<button data-action="rotate">⟳ Rotate</button>`;
          actions += `<button data-action="demolish" class="danger">✕ Demolish</button></div>`;
        }
        html = `<div class="info-head"><span>${buildingIcon(b!.type, 'head-icon')}${esc(def.name)}</span><button data-action="close">${ico('close')}</button></div>
          <p>${esc(def.description)}</p><div class="stats"></div>${actions}`;
      }
      panel.innerHTML = html;
    }

    let stats = '';
    {
      const def = BUILDINGS[b.type];
      stats = `HP ${Math.ceil(b.hp)} / ${def.hp}`;
      const t = TURRETS[b.type];
      if (t) stats += `<br>Ammo ${b.ammo} / ${t.maxShots} ${swatch(t.ammoItem)}${ITEMS[t.ammoItem].name}`;
      if (b.type === 'extractor') {
        const ore = b.recipe as ItemId | null;
        stats += `<br>Mining ${ore ? swatch(ore) + ITEMS[ore].name : 'nothing'}`;
      }
      if (b.type === 'lumber_camp') {
        const [fw, fh] = world.footprintOf(b);
        const reach = world.treesInReach(b.x, b.y, fw, fh);
        stats += `<br>${reach.trees.length} tree${reach.trees.length === 1 ? '' : 's'} in reach, ${reach.stumps} stump${reach.stumps === 1 ? '' : 's'} growing back`;
        stats += `<br>${LUMBER.logsPerTree} ${swatch('log')}logs per tree, one tree every ${LUMBER.period}s`;
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
      if (b.type === 'repair') stats += `<br>Stored repairs ${Math.floor(b.ammo)} / ${REPAIR.maxCharge} HP`;
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
      if (b.type === 'belt') stats += `<br>Carrying ${b.belt.length} item${b.belt.length === 1 ? '' : 's'}`;
    }
    if (stats !== this.statsHtml) {
      this.statsHtml = stats;
      const el = panel.querySelector('.stats');
      if (el) el.innerHTML = stats;
    }
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
    const key = JSON.stringify([rs.active, rs.stalled, rs.paid, world.state.researched.length, ITEM_IDS.map((i) => inv[i] ?? 0)]);
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
    $('research-body').innerHTML = `<h2>Research</h2>
      <p class="muted">Start a research and it draws its items from hub stock over time. It stalls if the hub runs out. You can switch at any time without losing progress.</p>${rows.join('')}`;
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

  openModal(id: string): void {
    this.closeModals();
    $(id).hidden = false;
  }

  closeModals(): void {
    for (const m of document.querySelectorAll<HTMLElement>('.modal')) m.hidden = true;
  }
}
