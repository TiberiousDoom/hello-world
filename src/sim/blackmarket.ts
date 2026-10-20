// The black market: your stash, skimming, suspicion and Company audits.
// Pure simulation, like world.ts and company.ts.

import { COMPANY_NAME, money, sendMail } from './company';
import { BLACK_MARKET, BLACK_MARKET_RESEARCH, BUILDINGS, BuildingType, HUB_SIZE, ItemCounts, ItemId } from './data';
import { ResearchState, createResearchState, drawResearch } from './research';
import type { Building, World } from './world';

export const BLACK_MARKET_BY_ID = Object.fromEntries(BLACK_MARKET_RESEARCH.map((r) => [r.id, r]));

export interface Audit {
  at: number; // when the drone arrives
  sweepUntil: number | null; // set while the drone is sweeping
}

export interface BlackMarketState {
  contacted: boolean;
  contactAt: number | null;
  stash: ItemCounts; // shared across all stashes
  researched: string[];
  research: ResearchState;
  suspicion: number; // 0–100
  warned: boolean;
  audit: Audit | null;
  audits: number;
  skimmed: number;
}

export function createBlackMarketState(): BlackMarketState {
  return {
    contacted: false,
    contactAt: null,
    stash: {},
    researched: [],
    research: createResearchState(),
    suspicion: 0,
    warned: false,
    audit: null,
    audits: 0,
    skimmed: 0,
  };
}

const FRIEND = 'A Friend <no-reply@unlisted>';

export const isContraband = (type: BuildingType) => !!BUILDINGS[type].contraband;

export function isBlackMarketUnlocked(w: World, type: BuildingType): boolean {
  const bm = w.state.blackMarket;
  if (type === 'stash') return bm.contacted;
  return bm.researched.some((id) => BLACK_MARKET_BY_ID[id]?.unlocks.includes(type));
}

export function disguised(w: World): boolean {
  return w.state.blackMarket.researched.includes('disguise');
}

// ------------------------------------------------------------------ stash

export function stashCapacity(w: World): number {
  return w.state.buildings.filter((b) => b.type === 'stash').length * BLACK_MARKET.stashCapacity;
}

export function stashTotal(w: World): number {
  return Object.values(w.state.blackMarket.stash).reduce((a, n) => a + n!, 0);
}

/** A stash accepts any item while there's room. */
export function insertStash(w: World, item: ItemId): boolean {
  if (stashTotal(w) >= stashCapacity(w)) return false;
  const stash = w.state.blackMarket.stash;
  stash[item] = (stash[item] ?? 0) + 1;
  return true;
}

/** Losing a stash loses its share of what's hidden. Call before the building is removed. */
export function onStashRemoved(w: World): void {
  const count = w.state.buildings.filter((b) => b.type === 'stash').length;
  if (count <= 0) return;
  const keep = (count - 1) / count;
  const stash = w.state.blackMarket.stash;
  for (const k of Object.keys(stash) as ItemId[]) stash[k] = Math.floor(stash[k]! * keep);
}

// -------------------------------------------------------------- suspicion

export function addSuspicion(w: World, amount: number): void {
  const bm = w.state.blackMarket;
  bm.suspicion = Math.max(0, Math.min(100, bm.suspicion + amount));
}

function hubCentre(w: World): [number, number] | null {
  const hub = w.hub;
  return hub ? [hub.x + HUB_SIZE / 2, hub.y + HUB_SIZE / 2] : null;
}

/** Contraband buildings within the Company's watch radius of the hub. */
export function watchedContraband(w: World): Building[] {
  const c = hubCentre(w);
  if (!c) return [];
  const r = BLACK_MARKET.watchRadius;
  return w.state.buildings.filter((b) => isContraband(b.type) && (b.x + 0.5 - c[0]) ** 2 + (b.y + 0.5 - c[1]) ** 2 <= r * r);
}

export function onSkim(w: World): void {
  w.state.blackMarket.skimmed++;
  addSuspicion(w, BLACK_MARKET.suspicion.perSkim);
}

export function onPortWithdrawal(w: World): void {
  addSuspicion(w, BLACK_MARKET.suspicion.perPortItem);
}

export function onContractResult(w: World, met: boolean): void {
  const s = BLACK_MARKET.suspicion;
  addSuspicion(w, met ? s.contractMet : s.contractMissed);
}

// --------------------------------------------------------------- research

export type BlackMarketResearchError = 'unknown' | 'done' | 'locked';

export function startBlackMarketResearch(w: World, id: string): BlackMarketResearchError | null {
  const bm = w.state.blackMarket;
  if (!BLACK_MARKET_BY_ID[id]) return 'unknown';
  if (!bm.contacted) return 'locked';
  if (bm.researched.includes(id)) return 'done';
  if (bm.research.active !== id) bm.research.budget = 0;
  bm.research.active = id;
  bm.research.stalled = false;
  return null;
}

export function pauseBlackMarketResearch(w: World): void {
  const rs = w.state.blackMarket.research;
  rs.active = null;
  rs.budget = 0;
  rs.stalled = false;
}

function completeBlackMarketResearch(w: World, id: string): void {
  const bm = w.state.blackMarket;
  const r = BLACK_MARKET_BY_ID[id];
  delete bm.research.paid[id];
  pauseBlackMarketResearch(w);
  bm.researched.push(id);
  w.events.push(`Black market: ${r.name} ready`);
  sendMail(w, FRIEND, `Re: ${r.name}`, `It's done. ${r.description}\n\nDelete this message.`, 'good');
}

// ------------------------------------------------------------------ audits

function scheduleAudit(w: World, notice: number): void {
  const s = w.state;
  const bm = s.blackMarket;
  if (bm.audit) {
    if (bm.audit.sweepUntil == null && bm.audit.at - s.time > notice) bm.audit.at = s.time + notice;
    return;
  }
  bm.audit = { at: s.time + notice, sweepUntil: null };
  sendMail(
    w,
    `Compliance · ${COMPANY_NAME}`,
    'Notice of routine audit',
    `Irregularities in your operation have triggered a routine audit. An inspection drone will survey everything within ${BLACK_MARKET.watchRadius} tiles of the hub in ${Math.round(notice)} seconds.\n\nPlease ensure all equipment on site is Company-authorised. An audit fee of ${money(BLACK_MARKET.audit.fee)} applies.`,
    'bad',
  );
}

/** The drone has finished its sweep: find contraband and apply the penalty for the game mode. */
function resolveAudit(w: World): void {
  const s = w.state;
  const bm = s.blackMarket;
  const a = BLACK_MARKET.audit;
  const found = watchedContraband(w).filter(() => !disguised(w) || w.random() < a.disguisedChance);
  const hardcore = s.mode === 'hardcore';
  let fine = a.fee;
  const names = found.map((b) => BUILDINGS[b.type].name);
  if (found.length) {
    if (hardcore) {
      for (const b of found) w.confiscate(b);
    } else {
      fine += found.length * a.finePerItem;
    }
  }
  s.company.debt += fine;
  bm.audits++;
  bm.audit = null;
  bm.suspicion = found.length ? a.after : a.afterClean;
  bm.warned = false;
  const listing = names.length ? names.map((n) => `  • ${n}`).join('\n') : '  (none)';
  sendMail(
    w,
    `Compliance · ${COMPANY_NAME}`,
    found.length ? 'Audit findings: unauthorised equipment' : 'Audit complete: no irregularities',
    found.length
      ? `The inspection found the following unauthorised equipment:\n\n${listing}\n\n` +
          (hardcore
            ? `It has been confiscated and destroyed. An audit fee of ${money(a.fee)} has been added to your account.`
            : `A fine of ${money(found.length * a.finePerItem)} plus the ${money(a.fee)} audit fee has been added to your account.`) +
          `\n\nOutstanding balance: ${money(s.company.debt)}. Further violations may result in termination of your contract.`
      : `The inspection found nothing out of order. Thank you for your cooperation. The ${money(a.fee)} audit fee has been added to your account.\n\nOutstanding balance: ${money(s.company.debt)}.`,
    found.length ? 'bad' : 'info',
  );
  w.events.push(found.length ? `Audit found ${found.length} piece${found.length === 1 ? '' : 's'} of contraband!` : 'Audit complete: nothing found.');
}

/** How far through its sweep the drone is (0–1), or null when no sweep is running. */
export function auditSweep(w: World): number | null {
  const audit = w.state.blackMarket.audit;
  if (!audit || audit.sweepUntil == null) return null;
  return 1 - (audit.sweepUntil - w.state.time) / BLACK_MARKET.audit.sweep;
}

// ------------------------------------------------------------------- tick

export function tickBlackMarket(w: World, dt: number): void {
  const s = w.state;
  const bm = s.blackMarket;
  const c = s.company;

  // A Friend gets in touch once the first contract has closed.
  if (!bm.contacted) {
    if (bm.contactAt == null && c.contractsMet + c.contractsMissed > 0) bm.contactAt = s.time + BLACK_MARKET.contactDelay;
    if (bm.contactAt != null && s.time >= bm.contactAt) {
      bm.contacted = true;
      sendMail(
        w,
        FRIEND,
        'You don’t have to stay',
        `They will never let you pay it off. You know that by now.\n\nSome of us are getting out. You'll need parts of your own, kept where the Company can't count them. Build a Stash, well away from the hub where they're watching, and belt things into it. What's in a stash is yours.\n\nKeep your numbers up so they don't look too closely. If they start asking questions, they send a drone.\n\nI'll be in touch. Open "Black market" (the eye at the top) when you're ready.`,
        'good',
      );
    }
  }

  // Thresholds first, so a jump to exactly 60% or 100% isn't undone by this tick's decay.
  const sp = BLACK_MARKET.suspicion;
  if (!bm.warned && bm.suspicion >= sp.warnAt) {
    bm.warned = true;
    sendMail(
      w,
      `Compliance · ${COMPANY_NAME}`,
      'Reminder: equipment policy',
      `This is a friendly reminder that only Company-authorised equipment may be operated on site, and that all output belongs to ${COMPANY_NAME}.\n\nWe're sure there's nothing to worry about.`,
      'bad',
    );
  }
  if (bm.suspicion >= 100) scheduleAudit(w, BLACK_MARKET.audit.urgentNotice);
  else if (bm.suspicion >= sp.auditAt) scheduleAudit(w, BLACK_MARKET.audit.notice);

  // Contraband near the hub draws attention; time lets it fade.
  const watched = watchedContraband(w).length;
  const factor = disguised(w) ? sp.disguisedFactor : 1;
  addSuspicion(w, (watched * sp.perContrabandPerSecond * factor - sp.decayPerSecond) * dt);

  if (bm.audit) {
    if (bm.audit.sweepUntil == null && s.time >= bm.audit.at) bm.audit.sweepUntil = s.time + BLACK_MARKET.audit.sweep;
    if (bm.audit.sweepUntil != null && s.time >= bm.audit.sweepUntil) resolveAudit(w);
  }

  // Black-market research draws from the stash.
  const rs = bm.research;
  if (rs.active && drawResearch(rs, BLACK_MARKET_BY_ID[rs.active], bm.stash, dt)) completeBlackMarketResearch(w, rs.active);
}
