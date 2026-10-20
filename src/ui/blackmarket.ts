// The black-market window and the suspicion button in the top bar.

import { artUrl, icon } from '../art';
import {
  BLACK_MARKET_BY_ID,
  auditSweep,
  pauseBlackMarketResearch,
  startBlackMarketResearch,
  stashCapacity,
  stashTotal,
  watchedContraband,
} from '../sim/blackmarket';
import { BLACK_MARKET, BLACK_MARKET_RESEARCH, ITEMS, ITEM_IDS, ItemId } from '../sim/data';
import { researchFraction } from '../sim/research';
import { World } from '../sim/world';

const $ = (id: string) => document.getElementById(id)!;
const ico = (name: string) => `<i data-icon="${name}">${icon(name)}</i>`;

function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function itemImg(item: ItemId): string {
  const url = artUrl(`items/${item}`);
  return url ? `<img class="item-icon" src="${url}" alt="${ITEMS[item].name}">` : `<span class="swatch" style="background:${ITEMS[item].color}"></span>`;
}

/** Green, amber or red by how close suspicion is to an audit. */
function level(suspicion: number): 'low' | 'mid' | 'high' {
  const s = BLACK_MARKET.suspicion;
  return suspicion >= s.auditAt ? 'high' : suspicion >= s.warnAt ? 'mid' : 'low';
}

export class BlackMarketPanel {
  private key = '';

  constructor(
    private getWorld: () => World,
    private onChange: () => void,
  ) {
    $('suspicion-btn').addEventListener('click', () => {
      document.querySelectorAll<HTMLElement>('.modal').forEach((m) => (m.hidden = true));
      $('blackmarket').hidden = false;
      this.key = '';
      this.update(this.getWorld());
    });
    $('bm-body').addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const start = target.closest<HTMLElement>('[data-bm-research]');
      if (start) startBlackMarketResearch(this.getWorld(), start.dataset.bmResearch!);
      if (target.closest('[data-bm-pause]')) pauseBlackMarketResearch(this.getWorld());
      if (start || target.closest('[data-bm-pause]')) {
        this.key = '';
        this.update(this.getWorld());
        this.onChange();
      }
    });
  }

  update(world: World): void {
    const bm = world.state.blackMarket;
    const btn = $('suspicion-btn');
    btn.hidden = !bm.contacted;
    if (!bm.contacted) return;
    const sus = Math.floor(bm.suspicion);
    $('suspicion-label').textContent = bm.audit ? (auditSweep(world) != null ? 'Audit!' : `Audit ${clock(bm.audit.at - world.state.time)}`) : `${sus}%`;
    btn.className = `sus-${bm.audit ? 'high' : level(bm.suspicion)}`;

    if ($('blackmarket').hidden) return;
    const key = JSON.stringify([sus, bm.audit && Math.ceil(bm.audit.at - world.state.time), bm.stash, bm.research, bm.researched, world.state.buildings.length]);
    if (key === this.key) return;
    this.key = key;
    $('bm-body').innerHTML = this.render(world);
  }

  private render(world: World): string {
    const s = world.state;
    const bm = s.blackMarket;
    const sp = BLACK_MARKET.suspicion;
    const watched = watchedContraband(world).length;

    const audit = bm.audit
      ? auditSweep(world) != null
        ? '<p class="stalled-note">The inspection drone is sweeping the hub area now.</p>'
        : `<p class="stalled-note">Audit in ${clock(bm.audit.at - s.time)}: move contraband more than ${BLACK_MARKET.watchRadius} tiles from the hub, or demolish it.</p>`
      : '';
    const suspicion = `<h3>Company suspicion</h3>
      <div class="sus-bar ${level(bm.suspicion)}"><div style="width:${bm.suspicion}%"></div><span>${Math.floor(bm.suspicion)}%</span></div>
      <p class="muted small">An audit is ordered at ${sp.auditAt}%. Suspicion rises when you miss contracts, skim, pull stock out through hub ports, and while contraband sits within ${BLACK_MARKET.watchRadius} tiles of the hub
      (${watched ? `<b>${watched} piece${watched === 1 ? '' : 's'} there now</b>` : 'none there now'}). It fades over time and drops when you meet a contract.
      ${s.mode === 'hardcore' ? 'Hardcore: contraband an audit finds is confiscated and destroyed.' : 'An audit fines you for each piece of contraband it finds.'}</p>${audit}`;

    const total = stashTotal(world);
    const cap = stashCapacity(world);
    const chips = ITEM_IDS.filter((i) => (bm.stash[i] ?? 0) > 0)
      .map((i) => `<span class="chip">${itemImg(i)}${bm.stash[i]}</span>`)
      .join('');
    const stash = `<h3>Stash</h3>
      ${cap ? `<p class="muted small">${total} / ${cap} items hidden${s.buildings.some((b) => b.type === 'stash') ? '' : ''}.</p><div class="stash-items">${chips || '<span class="muted small">Empty. Belt items into a stash to hide them.</span>'}</div>` : '<p class="muted small">Build a Stash (in the toolbar) far from the hub, then belt items into it.</p>'}`;

    const rs = bm.research;
    const rows = BLACK_MARKET_RESEARCH.map((r) => {
      const done = bm.researched.includes(r.id);
      const active = rs.active === r.id;
      const paid = rs.paid[r.id] ?? {};
      const progress = researchFraction(rs, BLACK_MARKET_BY_ID[r.id]);
      const items = done
        ? ''
        : Object.entries(r.cost)
            .map(([k, n]) => {
              const item = k as ItemId;
              const have = Math.min(n!, paid[item] ?? 0);
              const short = have < n! && (bm.stash[item] ?? 0) === 0 ? ' short' : '';
              return `<span class="cost${short}">${itemImg(item)}${have}/${n}</span>`;
            })
            .join(' ') + ` <span class="muted">· ${clock(r.time)}</span>`;
      const action = done
        ? '<span class="done">✓ Done</span>'
        : active
          ? `<button data-bm-pause>${ico('pause')}Pause</button>`
          : `<button data-bm-research="${r.id}">${ico('research')}${progress > 0 ? 'Resume' : rs.active ? 'Switch' : 'Start'}</button>`;
      const state = active ? (rs.stalled ? '<br><span class="stalled-note">Stalled: the stash is out of an item it needs</span>' : '<br><span class="active-note">Working on it…</span>') : '';
      const bar = !done && (active || progress > 0) ? `<div class="bar"><div style="width:${progress * 100}%"></div></div>` : '';
      return `<div class="research ${done ? 'done' : 'ready'} ${active ? 'active' : ''}">
        <div><b>${esc(r.name)}</b><br><span class="muted">${esc(r.description)}</span><br>${items}${state}${bar}</div><div>${action}</div></div>`;
    }).join('');

    return `${suspicion}${stash}<h3>Contacts</h3><p class="muted small">Paid from your stash, not hub stock.</p>${rows}`;
  }
}
