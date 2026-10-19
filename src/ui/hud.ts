// HTML overlay: top bar, inventory, build toolbar, info panel and dialogs.

import {
  BUILDINGS,
  BuildingType,
  ITEMS,
  ITEM_IDS,
  ItemCounts,
  ItemId,
  RECIPE_BY_ID,
  TIERS,
  TURRETS,
  isMachine,
} from '../sim/data';
import { PlaceError, World } from '../sim/world';
import { Tool, UIState } from './state';

const TOOLBAR: BuildingType[] = ['belt', 'extractor', 'furnace', 'workshop', 'assembler', 'turret', 'cannon', 'wall'];
const DIR_ARROWS = ['→', '↓', '←', '↑'];

const PLACE_ERRORS: Record<PlaceError, string> = {
  bounds: 'Outside the map.',
  occupied: 'That tile is taken.',
  locked: 'Not unlocked yet.',
  cost: 'Not enough materials in the hub.',
  'needs-resource': 'Extractors must go on a resource node.',
};

export interface HudActions {
  getWorld(): World;
  newGame(): void;
  save(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function swatch(item: ItemId): string {
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

  constructor(
    private ui: UIState,
    private actions: HudActions,
  ) {
    $('speed').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-speed]');
      if (btn) this.setSpeed(Number(btn.dataset.speed));
    });
    $('tier-btn').addEventListener('click', () => this.openTier());
    $('menu-btn').addEventListener('click', () => this.openModal('menu'));
    $('btn-resume').addEventListener('click', () => this.closeModals());
    $('btn-save').addEventListener('click', () => {
      actions.save();
      this.toast('Game saved.');
      this.closeModals();
    });
    // Two-step confirm in the page itself; native confirm() isn't available everywhere.
    const newBtn = $('btn-new');
    newBtn.addEventListener('click', () => {
      if (newBtn.dataset.armed) {
        actions.newGame();
        this.closeModals();
      } else {
        newBtn.dataset.armed = '1';
        newBtn.textContent = 'Tap again to lose this factory';
      }
    });
    $('btn-gameover-new').addEventListener('click', () => actions.newGame());
    for (const el of document.querySelectorAll<HTMLElement>('.modal [data-close]')) {
      el.addEventListener('click', () => this.closeModals());
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
    const next = TIERS[s.tier + 1];
    let pct = 100;
    if (next) {
      const goal = Object.values(next.goal).reduce((a, b) => a + b!, 0);
      const have = Object.entries(next.goal).reduce((a, [k, n]) => a + Math.min(n!, s.tierProgress[k as ItemId] ?? 0), 0);
      pct = Math.floor((100 * have) / goal);
    }
    $('tier-btn').textContent = `Tier ${s.tier + 1} · ${next ? pct + '%' : 'max'}`;
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

    $('gameover').hidden = !s.gameOver;
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
        <span class="icon" style="background:${def.color}">${def.short || ''}</span>
        <span class="label">${esc(def.name)}</span>
        <span class="costs">${costHtml(def.cost, inv)}</span></button>`;
    });
    buttons.push(
      `<button class="tool util" data-tool="rotate" title="Rotate (R)"><span class="icon">${DIR_ARROWS[this.ui.dir]}</span><span class="label">Rotate</span></button>`,
      `<button class="tool util ${this.ui.tool === 'demolish' ? 'active' : ''}" data-tool="demolish" title="Demolish (X)"><span class="icon">✕</span><span class="label">Demolish</span></button>`,
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
    const key = tool ? `tool:${tool}` : `b:${b!.id}:${b!.recipe}`;
    if (key !== this.infoKey) {
      this.infoKey = key;
      this.statsHtml = '';
      let html = '';
      if (tool) {
        const def = BUILDINGS[tool as BuildingType];
        html = `<div class="info-head"><b>${esc(def.name)}</b><button data-action="close">✕</button></div>
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
        if (b!.type !== 'hub') {
          actions += `<div class="row">`;
          if (b!.type !== 'wall' && !TURRETS[b!.type]) actions += `<button data-action="rotate">⟳ Rotate</button>`;
          actions += `<button data-action="demolish" class="danger">✕ Demolish</button></div>`;
        }
        html = `<div class="info-head"><b>${esc(def.name)}</b><button data-action="close">✕</button></div>
          <p>${esc(def.description)}</p><div class="stats"></div>${actions}`;
      }
      panel.innerHTML = html;
    }

    let stats = '';
    if (tool) {
      stats = `Cost: ${costHtml(BUILDINGS[tool as BuildingType].cost, inv)}`;
      const t = TURRETS[tool as BuildingType];
      if (t) stats += `<br>Ammo: ${swatch(t.ammoItem)}${ITEMS[t.ammoItem].name} · Range ${t.range}`;
      if (tool !== 'wall' && !t) stats += `<br>Facing ${DIR_ARROWS[this.ui.dir]} · Rotate to turn`;
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
      if (b.type === 'belt') stats += `<br>Carrying ${b.belt.length} item${b.belt.length === 1 ? '' : 's'}`;
    }
    if (stats !== this.statsHtml) {
      this.statsHtml = stats;
      const el = panel.querySelector('.stats');
      if (el) el.innerHTML = stats;
    }
  }

  private openTier(): void {
    const world = this.actions.getWorld();
    const s = world.state;
    const next = TIERS[s.tier + 1];
    let html = `<h2>Tier ${s.tier + 1}: ${esc(TIERS[s.tier].name)}</h2>`;
    if (next) {
      html += `<p>Deliver these to the hub to reach <b>Tier ${s.tier + 2}: ${esc(next.name)}</b>.</p>`;
      for (const [k, n] of Object.entries(next.goal)) {
        const item = k as ItemId;
        const have = Math.min(n!, s.tierProgress[item] ?? 0);
        html += `<div class="goal">${swatch(item)}<span>${ITEMS[item].name}</span><span>${have} / ${n}</span>
          <div class="progress"><div style="width:${(100 * have) / n!}%"></div></div></div>`;
      }
      if (next.unlocks.length) html += `<p>Unlocks: ${next.unlocks.map((t) => BUILDINGS[t].name).join(', ')}</p>`;
    } else {
      html += `<p>All tiers reached for this milestone. Survive as many waves as you can.</p>`;
    }
    $('tier-body').innerHTML = html;
    this.openModal('tier');
  }

  private openModal(id: string): void {
    this.closeModals();
    $(id).hidden = false;
  }

  closeModals(): void {
    for (const m of document.querySelectorAll<HTMLElement>('.modal')) m.hidden = true;
    const newBtn = $('btn-new');
    delete newBtn.dataset.armed;
    newBtn.textContent = 'New game';
  }
}
