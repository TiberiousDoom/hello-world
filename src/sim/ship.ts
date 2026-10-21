// The escape ship (story phase 4, D-034): a hidden shipyard, four stages built
// from items belted into it, and a launch the shipyard has to survive.
// Escaping wins the run; coming back afterwards is endless mode (D-019).

import { COMPANY_NAME, money, sendMail } from './company';
import { ItemCounts, ItemId, SHIP, ShipStage } from './data';
import type { Building, World } from './world';

export interface ShipState {
  stage: number; // index of the stage being built; SHIP.stages.length when the ship is finished
  delivered: ItemCounts; // towards the current stage
  launchAt: number | null; // game time of lift-off, while a launch is under way
  escaped: boolean; // the ship has left: the run is won
  endless: boolean; // came back after escaping
}

export function createShipState(): ShipState {
  return { stage: 0, delivered: {}, launchAt: null, escaped: false, endless: false };
}

const FRIEND = 'A Friend <no-reply@unlisted>';
const SECURITY = `Site Security · ${COMPANY_NAME}`;

export function currentStage(w: World): ShipStage | null {
  return SHIP.stages[w.state.ship.stage] ?? null;
}

export function shipyard(w: World): Building | undefined {
  return w.state.buildings.find((b) => b.type === 'shipyard');
}

export function shipFinished(w: World): boolean {
  return w.state.ship.stage >= SHIP.stages.length;
}

export const launching = (w: World): boolean => w.state.ship.launchAt != null;

/** The run is over and won; the simulation waits for the player to choose what's next. */
export const awaitingReturn = (w: World): boolean => w.state.ship.escaped && !w.state.ship.endless;

/** Takes an item into the shipyard if the current stage still needs it. */
export function insertShip(w: World, item: ItemId): boolean {
  const ship = w.state.ship;
  const stage = currentStage(w);
  if (!stage) return false;
  const need = stage.items[item] ?? 0;
  const have = ship.delivered[item] ?? 0;
  if (have >= need) return false;
  ship.delivered[item] = have + 1;
  if (Object.entries(stage.items).every(([k, n]) => (ship.delivered[k as ItemId] ?? 0) >= n!)) completeStage(w, stage);
  return true;
}

function completeStage(w: World, stage: ShipStage): void {
  const ship = w.state.ship;
  ship.stage++;
  ship.delivered = {};
  const next = currentStage(w);
  sendMail(
    w,
    FRIEND,
    `Re: ${stage.name}`,
    next
      ? `${stage.name}: done. It's starting to look like a ship.\n\nNext, the ${next.name.toLowerCase()}. Same as before: belt the parts into the shipyard.`
      : `That's the last of it. She's ready.\n\nWhen you launch, they'll see the engines. Everything they have will come for the shipyard, and it has to hold for ${SHIP.launchTime} seconds. Build your defences first.\n\nSelect the shipyard and press Launch when you're ready.`,
    'good',
  );
}

export type LaunchError = 'not-ready' | 'no-shipyard' | 'launching' | 'escaped';

export function checkLaunch(w: World): LaunchError | null {
  const ship = w.state.ship;
  if (ship.escaped) return 'escaped';
  if (ship.launchAt != null) return 'launching';
  if (!shipFinished(w)) return 'not-ready';
  if (!shipyard(w)) return 'no-shipyard';
  return null;
}

/** Starts the countdown. The Company answers with an early, oversized wave. */
export function launch(w: World): LaunchError | null {
  const err = checkLaunch(w);
  if (err) return err;
  const s = w.state;
  s.ship.launchAt = s.time + SHIP.launchTime;
  if (!s.enemies.length && !s.spawnQueue.length) s.nextWaveAt = Math.min(s.nextWaveAt, s.time + SHIP.launchWaveIn);
  w.markFlowDirty();
  sendMail(
    w,
    SECURITY,
    'Unauthorised launch detected',
    `An unregistered vessel is preparing to leave the site. Under your contract, departure before your balance (${money(s.company.debt)}) is settled constitutes theft of Company property, namely you.\n\nA security response is under way. Please remain where you are.`,
    'bad',
  );
  w.events.push(`Launch in ${SHIP.launchTime} seconds. Hold the shipyard!`);
  return null;
}

/** Wave size multiplier: the launch draws everything in. */
export function waveMultiplier(w: World): number {
  return launching(w) ? SHIP.finaleMultiplier : 1;
}

export function tickShip(w: World): void {
  const s = w.state;
  const ship = s.ship;
  if (ship.launchAt == null) return;
  if (!shipyard(w)) {
    ship.launchAt = null;
    w.markFlowDirty();
    return;
  }
  if (s.time < ship.launchAt) return;
  ship.launchAt = null;
  ship.escaped = true;
  s.enemies = [];
  s.spawnQueue = [];
  w.markFlowDirty();
  w.events.push('You got out.');
}

/**
 * The shipyard is gone (destroyed, demolished or confiscated). A launch in
 * progress fails. Hardcore loses the ship with it; Standard keeps the stages
 * built so far, so a new shipyard picks up where this one left off.
 */
export function onShipyardRemoved(w: World, destroyed: boolean): void {
  const ship = w.state.ship;
  const wasLaunching = ship.launchAt != null;
  ship.launchAt = null;
  if (destroyed && w.state.mode === 'hardcore') {
    ship.stage = 0;
    ship.delivered = {};
  }
  if (destroyed || wasLaunching) {
    sendMail(
      w,
      FRIEND,
      wasLaunching ? 'Re: the launch' : 'Re: the shipyard',
      w.state.mode === 'hardcore' && destroyed
        ? `The shipyard's gone, and the ship with it. I'm sorry.\n\nWe start again. Build another one, further out this time.`
        : `The shipyard's gone. The parts we'd fitted are safe — I had them moved. Build another shipyard and we'll carry on.`,
      'bad',
    );
  }
}

/**
 * After escaping: you come back. The ship is gone, the Company bills the
 * return passage, and the waves go on for as long as you last (endless mode).
 */
export function comeBack(w: World): void {
  const s = w.state;
  if (!awaitingReturn(w)) return;
  s.ship.endless = true;
  const yard = shipyard(w);
  if (yard) w.remove(yard, false);
  s.company.debt += SHIP.returnDebt;
  s.nextWaveAt = s.time + SHIP.endlessGrace;
  s.nextSpawnPoints = w.pickSpawnPoints(2);
  sendMail(
    w,
    `Contractor Relations · ${COMPANY_NAME}`,
    'Welcome back!',
    `We're delighted you've chosen to return to Halcyon Extraction Co. Space is large, cold and short of food; many valued contractors reach the same conclusion.\n\nYour recovery flight, berth and decontamination have been added to your balance (${money(SHIP.returnDebt)}). Your previous position is available, effective immediately.\n\nThe wildlife has missed you too.`,
  );
}

/** Numbers for the victory screen. */
export function runStats(w: World): { label: string; value: string }[] {
  const s = w.state;
  const mins = Math.floor(s.time / 60);
  const c = s.company;
  return [
    { label: 'Time on the planet', value: `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` },
    { label: 'Waves survived', value: String(s.wave) },
    { label: 'Contracts met', value: `${c.contractsMet} of ${c.contractsMet + c.contractsMissed}` },
    { label: 'Hub breaches', value: String(s.breaches) },
    { label: 'Debt left behind', value: money(c.debt) },
  ];
}
