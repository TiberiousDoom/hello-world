// HTML overlay: top bar, inventory, build toolbar, info panel and dialogs.

import {
  BREACH,
  BUILDINGS,
  BuildingType,
  GameMode,
  HARDCORE_UNLOCK_WAVE,
  HUB_WEAPON,
  ITEMS,
  ITEM_IDS,
  ItemCounts,
  ItemId,
  RECIPE_BY_ID,
  REPAIR,
  RESEARCH,
  TUNNEL_RANGE,
  TURRETS,
  isMachine,
} from '../sim/data';
import { artUrl, icon } from '../art';
import { money } from '../sim/company';
import { PlaceError, World } from '../sim/world';
import { CompanyPanel } from './company';
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
];
/** Buildings without a meaningful facing. */
const NO_ROTATE: BuildingType[] = ['wall', 'repair', 'turret', 'cannon', 'port'];
const DIR_ARROWS = ['→', '↓', '←', '↑'];
const DIR_DEGREES = [0, 90, 180, 270];

const PLACE_ERRORS: Record<PlaceError, string> = {
  bounds: 'Outside the map.',
  occupied: 'That tile is taken.',
  locked: 'Research this first.',
  cost: 'Not enough materials in the hub.',
  'needs-resource': 'Extractors must go on a resource node.',
  'needs-hub': 'Hub ports must go right next to the hub.',
};

export interface HudActions {
  getWorld(): World;
  newGame(mode: GameMode): void;
  save(): void;
  hardcoreUnlocked(): boolean;
  startTutorial(): void;
  toMainMenu(): void;
  hasGame(): boolean;
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
  readonly company: CompanyPanel;

  constructor(
    private ui: UIState,
    private actions: HudActions,
  ) {
    this.company = new CompanyPanel(actions.getWorld, () => this.refresh());
    $('speed').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-speed]');
      if (btn) this.setSpeed(Number(btn.dataset.speed));
    });
    $('research-btn').addEventListener('click', () => this.openResearch());
    $('research-body').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-research]');
      if (!btn) return;
      actions.getWorld().research(btn.dataset.research!);
      this.openResearch();
      this.refresh();
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
    $('btn-tutorial').addEventListener('click', () => {
      this.closeModals();
      actions.startTutorial();
    });
    $('newgame').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mode]');
      if (!btn || btn.disabled) return;
      actions.newGame(btn.dataset.mode as GameMode);
      this.closeModals();
    });
    for (const el of document.querySelectorAll<HTMLElement>('.modal [data-close]')) {
      el.addEventListener('click', () => this.closeModals());
    }
    // Clicking or tapping the dimmed backdrop closes a menu. Only when the press
    // also started there, so dragging out of a card doesn't close it. Game over
    // stays up: it needs a choice.
    for (const modal of document.querySelectorAll<HTMLElement>('.modal')) {
      if (modal.id === 'gameover') continue;
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
    if (this.ui.tool) this.ui.dir = ((this.ui.dir + 1) % 4) as UIState['dir'];
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
    const ready = RESEARCH.filter((r) => world.checkResearch(r.id) === null).length;
    $('research-label').textContent = ready ? `Research · ${ready}` : 'Research';
    $('research-btn').classList.toggle('ready', ready > 0);
    for (const b of document.querySelectorAll<HTMLElement>('#speed [data-speed]')) {
      b.classList.toggle('active', Number(b.dataset.speed) === this.ui.speed);
    }

    // Inventory.
    const inv = ITEM_IDS.filter((i) => (s.inventory[i] ?? 0) > 0)
      .map((i) => `<span class="chip" title="${ITEMS[i].name}">${swatch(i)}${s.inventory[i]}</span>`)
      .join('');
    if (inv !== this.invHtml) $('inventory').innerHTML = this.invHtml = inv;

    this.company.update(world);
    this.updateToolbar(world);
    this.updateInfo(world);

    if (s.gameOver && $('gameover').hidden && $('newgame').hidden) $('gameover').hidden = false;
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
    const key = tool ? `tool:${tool}` : `b:${b!.id}:${b!.recipe}:${b!.filter}`;
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
      if (b.type === 'belt') stats += `<br>Carrying ${b.belt.length} item${b.belt.length === 1 ? '' : 's'}`;
    }
    if (stats !== this.statsHtml) {
      this.statsHtml = stats;
      const el = panel.querySelector('.stats');
      if (el) el.innerHTML = stats;
    }
  }

  private openResearch(): void {
    const world = this.actions.getWorld();
    const inv = world.state.inventory;
    const rows = RESEARCH.map((r) => {
      const err = world.checkResearch(r.id);
      const unlocks = r.unlocks.map((t) => BUILDINGS[t].name).join(', ');
      let action: string;
      if (err === 'done') action = '<span class="done">✓ Done</span>';
      else if (err === 'requires') {
        const missing = r.requires.filter((q) => !world.state.researched.includes(q));
        action = `<span class="muted">Needs ${missing.map((q) => RESEARCH.find((x) => x.id === q)!.name).join(', ')}</span>`;
      } else action = `<button data-research="${r.id}" ${err ? 'disabled' : ''}>Research</button>`;
      return `<div class="research ${err ?? 'ready'}">
        <div><b>${esc(r.name)}</b> <span class="muted">→ ${esc(unlocks)}</span><br>
        <span class="muted">${esc(r.description)}</span><br>${err === 'done' ? '' : costHtml(r.cost, inv)}</div>
        <div>${action}</div></div>`;
    });
    $('research-body').innerHTML = `<h2>Research</h2>
      <p class="muted">Research is paid for from hub stock.</p>${rows.join('')}`;
    if ($('research').hidden) this.openModal('research');
  }

  openNewGame(): void {
    $('newgame-warning').hidden = !this.actions.hasGame();
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
