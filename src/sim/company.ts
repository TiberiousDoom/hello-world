// The Company: shipping contracts, your ever-growing debt, the company store
// and the inbox that tells you about all of it. Pure simulation, like world.ts.

import { ITEMS, ItemCounts, ItemId } from './data';
import type { World } from './world';
import { onContractResult } from './blackmarket';

export const COMPANY_NAME = 'Halcyon Extraction Co.';

export const COMPANY = {
  startingDebt: 48_750,
  firstContractAt: 30, // seconds into a new game
  contractGap: 45, // seconds between one contract ending and the next arriving
  contractTime: 360, // seconds to complete a contract
  baseWage: 1_500,
  wagePerContract: 250,
  lateFee: 1_000,
  shortfallFinePerItem: 40,
  pipStep: 0.1, // next contract grows this much per missed contract in a row…
  pipMax: 0.5, // …up to this much
  researchFee: 1_500,
  breachInvoice: 5_000,
  creditLimit: 100_000,
  inboxLimit: 60,
};

export interface Contract {
  id: number; // contract number, 1-based
  items: ItemCounts;
  delivered: ItemCounts;
  issuedAt: number;
  dueAt: number;
}

export type MailTone = 'info' | 'good' | 'bad';

export interface Mail {
  id: number;
  at: number; // game time
  from: string;
  subject: string;
  body: string;
  tone: MailTone;
  read: boolean;
}

export interface CompanyState {
  debt: number;
  contract: Contract | null;
  nextContractAt: number;
  contractsMet: number;
  contractsMissed: number;
  missedInARow: number;
  inbox: Mail[];
  nextMailId: number;
  wildlifeWarned: boolean;
}

export function createCompanyState(): CompanyState {
  return {
    debt: COMPANY.startingDebt,
    contract: null,
    nextContractAt: COMPANY.firstContractAt,
    contractsMet: 0,
    contractsMissed: 0,
    missedInARow: 0,
    inbox: [],
    nextMailId: 1,
    wildlifeWarned: false,
  };
}

// ------------------------------------------------------------------ store

export interface Crate {
  id: string;
  name: string;
  items: ItemCounts;
  price: number;
}

export const STORE: Crate[] = [
  { id: 'plates', name: 'Iron plate crate', items: { iron_plate: 30 }, price: 1_800 },
  { id: 'bricks', name: 'Brick pallet', items: { brick: 20 }, price: 1_400 },
  { id: 'copper', name: 'Copper ingot crate', items: { copper_ingot: 20 }, price: 1_600 },
  { id: 'gears', name: 'Gear box', items: { gear: 10 }, price: 2_200 },
];

// ------------------------------------------------------------------ helpers

const money = (n: number) => `¢${Math.round(n).toLocaleString('en-US')}`;
const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const itemList = (counts: ItemCounts) =>
  Object.entries(counts)
    .map(([k, n]) => `${n} ${ITEMS[k as ItemId].name}`)
    .join(', ');

const SENDERS = {
  relations: `Contractor Relations · ${COMPANY_NAME}`,
  payroll: `Payroll · ${COMPANY_NAME}`,
  compliance: `Compliance · ${COMPANY_NAME}`,
  facilities: `Facilities · ${COMPANY_NAME}`,
  store: `Company Store · ${COMPANY_NAME}`,
  safety: `Health & Safety · ${COMPANY_NAME}`,
};

/** Payslip deductions; each payslip picks a few. */
const DEDUCTIONS: [string, number][] = [
  ['Habitat rent', 0.22],
  ['Oxygen allocation', 0.14],
  ['Teleporter usage fee', 0.16],
  ['Equipment lease instalment', 0.12],
  ['Uniform laundering', 0.04],
  ['Mandatory wellness seminar', 0.06],
  ['Gravity surcharge', 0.05],
  ['Inbox maintenance', 0.03],
  ['Wage processing fee', 0.05],
  ['Morale committee subscription', 0.04],
];

export function sendMail(w: World, from: string, subject: string, body: string, tone: MailTone = 'info'): void {
  const c = w.state.company;
  c.inbox.unshift({ id: c.nextMailId++, at: w.state.time, from, subject, body, tone, read: false });
  c.inbox.length = Math.min(c.inbox.length, COMPANY.inboxLimit);
  w.events.push(`New email: ${subject}`);
}

export function unreadCount(w: World): number {
  return w.state.company.inbox.filter((m) => !m.read).length;
}

// ------------------------------------------------------------- contracts

/** Items the Company can reasonably ask for, given what's been researched. */
function contractPool(w: World): [ItemId, number][] {
  const pool: [ItemId, number][] = [
    ['iron_plate', 30],
    ['copper_ingot', 20],
    ['brick', 12],
  ];
  if (w.state.researched.includes('workshop')) pool.push(['gear', 10], ['wire', 24]);
  if (w.state.researched.includes('assembly')) pool.push(['motor', 4]);
  return pool;
}

export function contractProgress(contract: Contract): number {
  let need = 0;
  let have = 0;
  for (const [k, n] of Object.entries(contract.items)) {
    need += n!;
    have += Math.min(n!, contract.delivered[k as ItemId] ?? 0);
  }
  return need ? have / need : 1;
}

function issueContract(w: World): void {
  const s = w.state;
  const c = s.company;
  const number = c.contractsMet + c.contractsMissed + 1;
  const pool = contractPool(w);
  const kinds = Math.min(pool.length, number === 1 ? 1 : number <= 3 ? 2 : 3);
  const scale = (1 + 0.25 * (number - 1)) * (1 + Math.min(COMPANY.pipMax, c.missedInARow * COMPANY.pipStep));
  const items: ItemCounts = {};
  const choices = [...pool];
  for (let i = 0; i < kinds; i++) {
    const [item, base] = choices.splice(Math.floor(w.random() * choices.length), 1)[0];
    items[item] = Math.max(1, Math.round(base * scale));
  }
  c.contract = { id: number, items, delivered: {}, issuedAt: s.time, dueAt: s.time + COMPANY.contractTime };
  sendMail(
    w,
    SENDERS.relations,
    `Contract #${number}: ${itemList(items)}`,
    `Please deliver the following to the hub within ${clock(COMPANY.contractTime)}:\n\n` +
      Object.entries(items)
        .map(([k, n]) => `  • ${n} × ${ITEMS[k as ItemId].name}`)
        .join('\n') +
      `\n\nItems you deliver while this contract is open count towards it. When the contract is complete they are shipped home from hub stock, so please do not spend them.\n\n` +
      (c.missedInARow
        ? `As part of your Performance Improvement Plan, this contract has been enlarged by ${Math.round(Math.min(COMPANY.pipMax, c.missedInARow * COMPANY.pipStep) * 100)}% to help you grow.\n\n`
        : '') +
      `Thank you for your continued commitment to ${COMPANY_NAME}.`,
  );
}

/** Ships what was delivered for the contract out of hub stock. Returns the shortfall per item. */
function shipContract(w: World, contract: Contract): { shipped: number; short: number } {
  const inv = w.state.inventory;
  let shipped = 0;
  let short = 0;
  for (const [k, n] of Object.entries(contract.items)) {
    const item = k as ItemId;
    const delivered = Math.min(n!, contract.delivered[item] ?? 0);
    const take = Math.min(delivered, inv[item] ?? 0);
    inv[item] = (inv[item] ?? 0) - take;
    shipped += take;
    short += n! - take;
  }
  return { shipped, short };
}

function payContract(w: World, contract: Contract): void {
  const c = w.state.company;
  const wage = COMPANY.baseWage + COMPANY.wagePerContract * (contract.id - 1);
  // Pick 3–5 deductions that eat most of the wage. Usually all of it, and then some.
  const pool = [...DEDUCTIONS];
  const lines: [string, number][] = [];
  const count = 3 + Math.floor(w.random() * 3);
  for (let i = 0; i < count; i++) {
    const [label, share] = pool.splice(Math.floor(w.random() * pool.length), 1)[0];
    lines.push([label, Math.round(wage * share * (0.9 + w.random() * 0.4))]);
  }
  const deducted = lines.reduce((a, [, n]) => a + n, 0);
  const net = wage - deducted;
  c.debt = Math.max(0, c.debt - net);
  c.contractsMet++;
  c.missedInARow = 0;
  onContractResult(w, true);
  sendMail(
    w,
    SENDERS.payroll,
    `Payslip: Contract #${contract.id}`,
    `Shipment received in full. Well done!\n\n` +
      `  Gross wage ............ ${money(wage)}\n` +
      lines.map(([label, n]) => `  ${label} ${'.'.repeat(Math.max(2, 22 - label.length))} −${money(n)}`).join('\n') +
      `\n  Net applied to account  ${net >= 0 ? '' : '−'}${money(Math.abs(net))}\n\n` +
      `Outstanding balance: ${money(c.debt)}.\n\nAt this rate you will be debt-free in approximately ${net > 0 ? Math.ceil(c.debt / net).toLocaleString('en-US') + ' contracts' : 'never'}. Keep it up!`,
    net > 0 ? 'good' : 'info',
  );
}

function missContract(w: World, contract: Contract, shipped: number, short: number): void {
  const c = w.state.company;
  const fine = COMPANY.lateFee + short * COMPANY.shortfallFinePerItem;
  c.debt += fine;
  c.contractsMissed++;
  c.missedInARow++;
  onContractResult(w, false);
  const total = Object.values(contract.items).reduce((a, n) => a + n!, 0);
  sendMail(
    w,
    SENDERS.compliance,
    `Notice of Underperformance: Contract #${contract.id}`,
    `Contract #${contract.id} closed with ${shipped} of ${total} items shipped.\n\n` +
      `  Late fee ............... ${money(COMPANY.lateFee)}\n` +
      `  Shortfall (${short} × ${money(COMPANY.shortfallFinePerItem)}) .. ${money(short * COMPANY.shortfallFinePerItem)}\n\n` +
      `Total ${money(fine)} has been added to your account. Outstanding balance: ${money(c.debt)}.\n\n` +
      `You have been enrolled in a Performance Improvement Plan. Your next contract will be adjusted accordingly. We believe in you.`,
    'bad',
  );
}

// ------------------------------------------------------------------ hooks

/** Called by the world for every item delivered to the hub. */
export function onDelivered(w: World, item: ItemId): void {
  const contract = w.state.company.contract;
  if (!contract) return;
  const need = contract.items[item];
  if (!need) return;
  const have = contract.delivered[item] ?? 0;
  if (have < need) contract.delivered[item] = have + 1;
}

/** Called every simulation tick. */
export function tickCompany(w: World): void {
  const s = w.state;
  const c = s.company;
  if (!c.contract) {
    if (s.time >= c.nextContractAt) issueContract(w);
    return;
  }
  const contract = c.contract;
  const complete = contractProgress(contract) >= 1;
  if (!complete && s.time < contract.dueAt) return;
  const { shipped, short } = shipContract(w, contract);
  if (short === 0) payContract(w, contract);
  else missContract(w, contract, shipped, short);
  c.contract = null;
  c.nextContractAt = s.time + COMPANY.contractGap;
  if (c.contractsMet + c.contractsMissed === 1) {
    sendMail(
      w,
      SENDERS.store,
      'The Company Store is now open!',
      `Now that you've settled in, the Company Store is pleased to offer you emergency supplies on credit. Iron, bricks, copper and gears are delivered straight to your hub.

Prices include a convenience fee. Credit limit: ${money(COMPANY.creditLimit)}.`,
    );
  }
}

export function onResearched(w: World, name: string): void {
  const c = w.state.company;
  c.debt += COMPANY.researchFee;
  sendMail(
    w,
    SENDERS.compliance,
    `License activated: ${name}`,
    `Your operator's license for ${name} is now active. A licensing fee of ${money(COMPANY.researchFee)} has been added to your account.\n\nOutstanding balance: ${money(c.debt)}.`,
  );
}

export function onBreach(w: World): void {
  const c = w.state.company;
  c.debt += COMPANY.breachInvoice;
  sendMail(
    w,
    SENDERS.facilities,
    'Invoice: Hub structural repair',
    `Company property (the hub) was damaged during a wildlife incident while in your care. Repairs and lost stock have been billed at ${money(COMPANY.breachInvoice)}.\n\nOutstanding balance: ${money(c.debt)}.\n\nReminder: wildlife is your responsibility. ${COMPANY_NAME} accepts no liability for being eaten.`,
    'bad',
  );
}

export function onFirstWave(w: World): void {
  const c = w.state.company;
  if (c.wildlifeWarned) return;
  c.wildlifeWarned = true;
  sendMail(
    w,
    SENDERS.safety,
    'Wildlife advisory',
    `Local fauna have taken an interest in your operation. Please defend Company property. Turrets are available through research (licensing fees apply).\n\nDamage to the hub will be billed to your account.`,
    'bad',
  );
}

export type BuyError = 'unknown' | 'locked' | 'credit-limit';

/** The store opens once your first contract closes, whether you met it or not. */
export function storeOpen(w: World): boolean {
  const c = w.state.company;
  return c.contractsMet + c.contractsMissed > 0;
}

/** Buys a crate on credit: items go straight into hub stock, the price onto your debt. */
export function buyCrate(w: World, id: string): BuyError | null {
  const crate = STORE.find((x) => x.id === id);
  if (!crate) return 'unknown';
  if (!storeOpen(w)) return 'locked';
  const c = w.state.company;
  if (c.debt + crate.price > COMPANY.creditLimit) return 'credit-limit';
  c.debt += crate.price;
  const inv = w.state.inventory;
  for (const [k, n] of Object.entries(crate.items)) inv[k as ItemId] = (inv[k as ItemId] ?? 0) + n!;
  w.events.push(`Bought ${crate.name}: ${itemList(crate.items)} for ${money(crate.price)}`);
  return null;
}

export function welcomeMail(w: World): void {
  sendMail(
    w,
    SENDERS.relations,
    `Welcome to ${COMPANY_NAME}, valued contractor!`,
    `Congratulations on your relocation!\n\nYour passage, equipment lease and this orientation email come to ${money(COMPANY.startingDebt)}, which has been added to your account. Repayment is easy: simply complete your shipping contracts.\n\n` +
      `  • Contracts arrive in this inbox.\n  • Deliver the listed goods to the hub before the deadline.\n  • Wages are credited after standard deductions.\n  • The Company Store opens after your first contract.\n\n` +
      `We look forward to a long and productive relationship.\n\nVery long.`,
  );
}

export { money };
