// The Company window (contract, inbox, store) and its top-bar buttons.

import { artUrl, icon } from '../art';
import { COMPANY, COMPANY_NAME, STORE, buyCrate, contractProgress, money, unreadCount } from '../sim/company';
import { ITEMS, ItemCounts, ItemId } from '../sim/data';
import { World } from '../sim/world';

type Tab = 'contract' | 'inbox' | 'store';

const $ = (id: string) => document.getElementById(id)!;

function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function itemImg(item: ItemId, size = 20): string {
  const url = artUrl(`items/${item}`);
  return url
    ? `<img src="${url}" alt="" width="${size}" height="${size}" style="vertical-align:-5px">`
    : `<span class="swatch" style="background:${ITEMS[item].color}"></span>`;
}

function itemsInline(items: ItemCounts): string {
  return Object.entries(items)
    .map(([k, n]) => `${itemImg(k as ItemId, 16)} ${n} ${ITEMS[k as ItemId].name}`)
    .join(' · ');
}

export class CompanyPanel {
  private tab: Tab = 'contract';
  private bodyKey = '';
  /** Emails the player has expanded, kept open across re-renders. */
  private openMail = new Set<number>();

  constructor(
    private getWorld: () => World,
    private onChange: () => void,
  ) {
    $('company-name').textContent = COMPANY_NAME;
    $('contract-btn').addEventListener('click', () => this.open('contract'));
    $('mail-btn').addEventListener('click', () => this.open('inbox'));
    $('company').addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tab = target.closest<HTMLElement>('[data-tab]');
      if (tab) this.show(tab.dataset.tab as Tab);
      const buy = target.closest<HTMLElement>('[data-buy]');
      if (buy) {
        const err = buyCrate(this.getWorld(), buy.dataset.buy!);
        if (err === 'credit-limit') this.getWorld().events.push('The Company has declined your credit application.');
        this.bodyKey = '';
        this.onChange();
      }
    });
    // Opening an email marks it read.
    $('company-body').addEventListener(
      'toggle',
      (e) => {
        const d = e.target as HTMLDetailsElement;
        const id = Number(d.dataset.mail);
        if (!id) return;
        if (d.open) {
          this.openMail.add(id);
          const mail = this.getWorld().state.company.inbox.find((m) => m.id === id);
          if (mail && !mail.read) {
            mail.read = true;
            d.classList.remove('unread');
          }
        } else {
          this.openMail.delete(id);
        }
      },
      true,
    );
  }

  open(tab: Tab): void {
    document.querySelectorAll<HTMLElement>('.modal').forEach((m) => (m.hidden = true));
    $('company').hidden = false;
    this.show(tab);
  }

  private show(tab: Tab): void {
    this.tab = tab;
    this.bodyKey = '';
    for (const b of document.querySelectorAll<HTMLElement>('#company [data-tab]')) {
      b.classList.toggle('active', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    }
    this.update(this.getWorld());
  }

  /** Refreshes the top-bar buttons and, when open, the window. */
  update(world: World): void {
    const s = world.state;
    const c = s.company;

    // Top bar: contract countdown and unread mail.
    const btn = $('contract-btn');
    const label = $('contract-label');
    if (c.contract) {
      const pct = Math.floor(contractProgress(c.contract) * 100);
      const left = c.contract.dueAt - s.time;
      label.textContent = `${clock(left)} · ${pct}%`;
      btn.classList.toggle('urgent', left < 60 && pct < 100);
      btn.classList.toggle('done', pct >= 100);
    } else {
      label.textContent = `Next ${clock(c.nextContractAt - s.time)}`;
      btn.classList.remove('urgent', 'done');
    }
    const unread = unreadCount(world);
    const badge = $('mail-badge');
    badge.hidden = unread === 0;
    badge.textContent = String(unread);
    $('mail-btn').classList.toggle('unread', unread > 0);
    const tabUnread = $('tab-unread');
    tabUnread.hidden = unread === 0;
    tabUnread.textContent = String(unread);

    if ($('company').hidden) return;
    $('company-debt').textContent = money(c.debt);

    let key: string;
    if (this.tab === 'contract') key = `c:${JSON.stringify(c.contract)}:${Math.ceil(s.time)}:${c.contractsMet}:${c.contractsMissed}`;
    else if (this.tab === 'inbox') key = `i:${c.inbox.length}:${c.inbox[0]?.id}`;
    else key = `s:${c.debt}`;
    if (key === this.bodyKey) return;
    this.bodyKey = key;
    $('company-body').innerHTML =
      this.tab === 'contract' ? this.renderContract(world) : this.tab === 'inbox' ? this.renderInbox(world) : this.renderStore(world);
  }

  private renderContract(world: World): string {
    const s = world.state;
    const c = s.company;
    const record = `<div class="contract-meta"><span>Met <b>${c.contractsMet}</b> · Missed <b>${c.contractsMissed}</b></span>${
      c.missedInARow ? `<span>Performance Improvement Plan: <b>+${Math.round(Math.min(COMPANY.pipMax, c.missedInARow * COMPANY.pipStep) * 100)}%</b></span>` : ''
    }</div>`;
    if (!c.contract) {
      return `<p>No open contract. The next one arrives in <b>${clock(c.nextContractAt - s.time)}</b>.</p>${record}`;
    }
    const k = c.contract;
    const rows = Object.entries(k.items)
      .map(([id, n]) => {
        const item = id as ItemId;
        const have = Math.min(n!, k.delivered[item] ?? 0);
        const full = have >= n!;
        return `<div class="contract-item">${itemImg(item, 28)}<span>${ITEMS[item].name}</span><span class="n">${have} / ${n}</span>
          <div class="bar ${full ? 'full' : ''}"><div style="width:${(100 * have) / n!}%"></div></div></div>`;
      })
      .join('');
    return `<div class="contract-meta"><span>Contract <b>#${k.id}</b></span><span>Due in <b>${clock(k.dueAt - s.time)}</b></span></div>
      <div class="contract-items">${rows}</div>
      <p class="muted small">Deliver these to the hub. When the contract is complete they ship home from hub stock, so don't spend them. Missing the deadline adds a ${money(COMPANY.lateFee)} late fee plus ${money(COMPANY.shortfallFinePerItem)} for each item short.</p>
      ${record}`;
  }

  private renderInbox(world: World): string {
    const inbox = world.state.company.inbox;
    if (!inbox.length) return '<p class="muted">No mail. Enjoy it while it lasts.</p>';
    return `<div class="mail-list">${inbox
      .map(
        (m) => `<details class="mail ${m.tone} ${m.read ? '' : 'unread'}" data-mail="${m.id}" ${this.openMail.has(m.id) ? 'open' : ''}>
          <summary><span class="subj">${esc(m.subject)}</span><span class="when">${clock(m.at)}</span><span class="from">${esc(m.from)}</span></summary>
          <pre>${esc(m.body)}</pre></details>`,
      )
      .join('')}</div>`;
  }

  private renderStore(world: World): string {
    const debt = world.state.company.debt;
    const room = COMPANY.creditLimit - debt;
    return `<p class="muted">Everything is delivered straight to hub stock and added to your balance. Credit limit ${money(COMPANY.creditLimit)}; you have ${money(Math.max(0, room))} left.</p>
      <div class="crates">${STORE.map(
        (crate) => `<div class="crate"><div><b>${esc(crate.name)}</b><br>${itemsInline(crate.items)}</div>
          <div style="text-align:right"><div class="price">${money(crate.price)}</div>
          <button data-buy="${crate.id}" ${crate.price > room ? 'disabled' : ''}>${icon('store') ? `<i data-icon="store">${icon('store')}</i>` : ''}Buy</button></div></div>`,
      ).join('')}</div>`;
  }
}
