// HTML overlay: top bar, inventory, build toolbar, info panel and dialogs.

import {
  BREACH,
  BUILDINGS,
  BuildingType,
  GameMode,
  HARDCORE_UNLOCK_WAVE,
  HUB_SIZE,
  HUB_WEAPON,
  ITEMS,
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
import { money } from '../sim/company';
import { awaitingReturn, checkLaunch, comeBack, currentStage, launch, runStats } from '../sim/ship';
import { PlaceError, World } from '../sim/world';
import { Camera } from '../render/camera';
import { CompanyPanel } from './company';
import { BlackMarketPanel } from './blackmarket';
import { Tool, UIState } from './state';

const TOOLBAR: BuildingType[] = [
  'belt',
  'splitter',
  'tunnel',
  'port',
  'extractor',
  'furnace',
  'workshop',
  'assembler',
  'turret',
  'cannon',
  'repair',
  'wall',
  'stash',
  'skimmer',
  'shipyard',
];
/** Buildings without a meaningful facing. */
const NO_ROTATE: BuildingType[] = ['wall', 'repair', 'turret', 'cannon', 'port', 'stash', 'shipyard'];
const DIR_ARROWS = ['→', '↓', '←', '↑'];
const DIR_DEGREES = [0, 90, 180, 270];

const PLACE_ERRORS: Record<PlaceError, string> = {
  bounds: 'Outside the map.',
  occupied: 'That tile is taken.',
  locked: 'Research this first.',
  cost: 'Not enough materials in the hub.',
  'needs-resource': 'Extractors must go on a resource node.',
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
  centreOnHub(): void;
  rotatePlan(): void;
  /** The victory screen has opened. */
  escaped(): void;
  /** The player chose to come back (endless mode). */
  cameBack(): void;
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

/** The shipyard's panel: every stage, what the current one still needs, and the launch. */
function shipStats(world: World): string {
  const ship = world.state.ship;
  const stages = SHIP.stages
    .map((st, i) => (i < ship.stage ? `✓ ${esc(st.name)}` : i === ship.stage ? `<b>${esc(st.name)}</b>` : esc(st.name)))
    .join(' · ');
  let html = `<br>${stages}`;
  const stage = currentStage(world);
  if (stage) {
    const needs = Object.entries(stage.items)
      .map(([k, n]) => `${swatch(k as ItemId)}${ship.delivered[k as ItemId] ?? 0}/${n}`)
      .join(' ');
    html += `<br>Belt in: ${needs}`;
  } else if (ship.escaped) {
    html += '<br>The ship is gone. You got out.';
  } else if (ship.launchAt != null) {
    html += `<br><b>Lift-off in ${formatTime(ship.launchAt - world.state.time)}.</b> Hold the shipyard!`;
  } else {
    html += `<br>The ship is ready. Launching draws every bug on the planet to the shipyard for ${SHIP.launchTime} seconds.`;
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
  readonly company: CompanyPanel;
  readonly blackMarket: BlackMarketPanel;

  constructor(
    private ui: UIState,
    private actions: HudActions,
  ) {
    this.company = new CompanyPanel(actions.getWorld, () => this.refresh());
    this.blackMarket = new BlackMarketPanel(actions.getWorld, () => this.refresh());
    $('speed').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-speed]');
      if (btn) this.setSpeed(Number(btn.dataset.speed));
    });
    $('research-btn').addEventListener('click', () => this.openResearch());
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
    $('inventory').addEventListener('click', () => {
      if ($('inventory').classList.contains('edge')) actions.centreOnHub();
    });
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
    $('btn-comeback').addEventListener('click', () => {
      comeBack(actions.getWorld());
      this.closeModals();
      actions.cameBack();
      this.refresh();
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
   * Keeps the stock panel floating just above the hub. When the hub is off
   * screen, the panel is pinned to the nearest edge; tapping it goes back.
   */
  placeStock(world: World, camera: Camera): void {
    const el = $('inventory');
    const hub = world.hub;
    if (!hub) return;
    const [sx, top] = camera.toScreen(hub.x + HUB_SIZE / 2, hub.y);
    const [, bottom] = camera.toScreen(0, hub.y + HUB_SIZE);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const minY = $('topbar').getBoundingClientRect().bottom + 6;
    const tb = $('toolbar').getBoundingClientRect();
    const maxY = (tb.height ? tb.top : window.innerHeight) - h - 6;
    const x = Math.min(window.innerWidth - w - 6, Math.max(6, sx - w / 2));
    // Above the hub, or over its body when the top bar covers the space above.
    const y = Math.min(maxY, Math.max(minY, top - h - 6));
    const edge = sx < 0 || sx > window.innerWidth || bottom < minY || top > maxY + h;
    el.classList.toggle('edge', edge);
    // See-through while the pointer is over it (or near), so it never hides the map above the hub.
    const p = this.pointer;
    const r = el.getBoundingClientRect();
    const near = 12;
    const over = !!p && p.x > r.left - near && p.x < r.right + near && p.y > r.top - near && p.y < r.bottom + near;
    el.classList.toggle('peek', over && !edge);
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
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

    // Top bar.
    const hub = world.hub;
    const hubHp = hub ? Math.ceil(hub.hp) : 0;
    $('hub-hp').textContent = `${hubHp} / ${BUILDINGS.hub.hp}`;
    $('hub-hp').parentElement!.classList.toggle('danger', hubHp < BUILDINGS.hub.hp * 0.35);
    const active = s.enemies.length + s.spawnQueue.length;
    $('wave').textContent = active
      ? `Wave ${s.wave} · ${active} enemies`
      : `Wave ${s.wave + 1} in ${formatTime(s.nextWaveAt - s.time)}`;
    $('hub-hp').parentElement!.title = s.mode === 'hardcore' ? 'Hub health · Hardcore' : 'Hub health';
    $('mode-badge').hidden = s.mode !== 'hardcore';
    const rs = s.research;
    const ready = RESEARCH.filter((r) => world.checkResearch(r.id) === null).length;
    $('research-label').textContent = rs.active
      ? `Research · ${rs.stalled ? 'stalled' : Math.floor(world.researchProgress(rs.active) * 100) + '%'}`
      : ready
        ? `Research · ${ready}`
        : 'Research';
    // Draw the eye when nothing is being researched but something could be.
    $('research-btn').classList.toggle('ready', !rs.active && ready > 0);
    $('research-btn').classList.toggle('stalled', rs.stalled);
    if (!$('research').hidden) this.renderResearch(world);
    for (const b of document.querySelectorAll<HTMLElement>('#speed [data-speed]')) {
      b.classList.toggle('active', Number(b.dataset.speed) === this.ui.speed);
    }

    // Inventory.
    const inv = ITEM_IDS.filter((i) => (s.inventory[i] ?? 0) > 0)
      .map((i) => `<span class="chip" title="${ITEMS[i].name}">${swatch(i)}${s.inventory[i]}</span>`)
      .join('');
    if (inv !== this.invHtml) $('inventory').innerHTML = this.invHtml = inv;

    this.company.update(world);
    this.blackMarket.update(world);
    this.updateToolbar(world);
    this.updateInfo(world);

    if (s.gameOver && $('gameover').hidden && $('newgame').hidden) $('gameover').hidden = false;
    if (awaitingReturn(world) && $('victory').hidden && $('newgame').hidden) {
      $('victory-stats').innerHTML = runStats(world)
        .map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`)
        .join('');
      $('victory').hidden = false;
      this.actions.escaped();
    }
    const banner = $('launch-banner');
    banner.hidden = s.ship.launchAt == null;
    if (s.ship.launchAt != null) {
      banner.textContent = `🚀 Lift-off in ${formatTime(s.ship.launchAt - s.time)}. Hold the shipyard!`;
      banner.style.bottom = `${Math.round(window.innerHeight - $('toolbar').getBoundingClientRect().top + 10)}px`;
    }
    if (s.gameOver) $('gameover-text').textContent = `You held out for ${s.wave} wave${s.wave === 1 ? '' : 's'}.`;
  }

  private updateToolbar(world: World): void {
    const tools = this.unlockedTools();
    const inv = world.state.inventory;
    const key = [tools.join(), this.ui.tool, this.ui.dir, ...tools.map((t) => world.canAfford(BUILDINGS[t].cost))].join('|');
    if (key === this.toolbarKey) return;
    this.toolbarKey = key;
    const buttons = tools.map((t, i) => {
      const def = BUILDINGS[t];
      const cls = ['tool', this.ui.tool === t ? 'active' : '', world.canAfford(def.cost) ? '' : 'poor', def.contraband ? 'contraband' : ''].join(' ');
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

  private updateInfo(world: World): void {
    const panel = $('info');
    const tool = this.ui.tool;
    const b = this.ui.selected != null ? world.byId.get(this.ui.selected) : undefined;
    if (this.ui.selected != null && !b) this.ui.selected = null;

    if (!b && (!tool || tool === 'demolish')) {
      panel.hidden = true;
      this.infoKey = '';
      return;
    }
    panel.hidden = false;
    const inv = world.state.inventory;

    // Structure (buttons) only changes when the subject changes, so clicks aren't lost.
    const ship = world.state.ship;
    const key = tool ? `tool:${tool}` : `b:${b!.id}:${b!.recipe}:${b!.filter}:${b!.type === 'shipyard' ? `${ship.stage}:${ship.launchAt != null}` : ''}`;
    if (key !== this.infoKey) {
      this.infoKey = key;
      this.statsHtml = '';
      let html = '';
      if (tool) {
        const def = BUILDINGS[tool as BuildingType];
        html = `<div class="info-head"><span>${buildingIcon(tool as BuildingType, 'head-icon')}${esc(def.name)}</span><button data-action="close">${ico('close')}</button></div>
          <p>${esc(def.description)}</p><div class="stats"></div>`;
      } else {
        const def = BUILDINGS[b!.type];
        let actions = '';
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
    if (tool) {
      stats = `Cost: ${costHtml(BUILDINGS[tool as BuildingType].cost, inv)}`;
      const t = TURRETS[tool as BuildingType];
      if (t) stats += `<br>Ammo: ${swatch(t.ammoItem)}${ITEMS[t.ammoItem].name} · Range ${t.range}`;
      if (tool === 'tunnel') {
        const entrance = world.findTunnelEntrance(this.ui.hover?.x ?? -99, this.ui.hover?.y ?? -99, this.ui.dir);
        stats += entrance ? '<br>Here: <b>exit</b> for the entrance behind' : '<br>Here: <b>entrance</b>';
      }
      if (!NO_ROTATE.includes(tool as BuildingType)) stats += `<br>Facing ${DIR_ARROWS[this.ui.dir]} · Rotate to turn`;
    } else if (b) {
      const def = BUILDINGS[b.type];
      stats = `HP ${Math.ceil(b.hp)} / ${def.hp}`;
      const t = TURRETS[b.type];
      if (t) stats += `<br>Ammo ${b.ammo} / ${t.maxShots} ${swatch(t.ammoItem)}${ITEMS[t.ammoItem].name}`;
      if (b.type === 'extractor') {
        const res = world.resourceAt(b.x, b.y);
        stats += `<br>Mining ${res ? swatch(res) + ITEMS[res].name : 'nothing'}`;
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
        stats += `<br>You owe the Company ${money(world.state.company.debt)}`;
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
      <p class="muted">Start a research and it draws its items from hub stock over time. It stalls if the hub runs out. You can switch at any time without losing progress. Each completed research also costs a Company licence fee.</p>${rows.join('')}`;
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
      : `Locked: survive wave ${HARDCORE_UNLOCK_WAVE} in Standard to unlock.`;
    $('standard-note').textContent = `If the hub falls, the attack ends but you lose ${BREACH.stockLost * 100}% of hub stock.`;
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
