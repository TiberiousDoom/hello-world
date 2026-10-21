// The escape ship (D-034): a shipyard, four stages built from items belted
// into it, and a launch the shipyard has to survive. The engines wake every
// bug territory nearby (D-038). Escaping wins the run; afterwards the game can
// carry on (endless).

import { ItemCounts, ItemId, NESTS, SHIP, ShipStage } from './data';
import { nestCentre, provoke } from './nests';
import type { Building, World } from './world';

export interface ShipState {
  stage: number; // index of the stage being built; SHIP.stages.length when the ship is finished
  delivered: ItemCounts; // towards the current stage
  launchAt: number | null; // game time of lift-off, while a launch is under way
  escaped: boolean; // the ship has left: the run is won
  endless: boolean; // kept playing after escaping
}

export function createShipState(): ShipState {
  return { stage: 0, delivered: {}, launchAt: null, escaped: false, endless: false };
}

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

/** The run is won; the simulation waits for the player to choose what's next. */
export const awaitingChoice = (w: World): boolean => w.state.ship.escaped && !w.state.ship.endless;

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
  w.events.push(
    next
      ? `Ship: ${stage.name} done. Next, the ${next.name.toLowerCase()}.`
      : 'The ship is finished! Select the shipyard and press Launch when your defences are ready.',
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

/** Starts the countdown. The engines wake every bug territory within reach. */
export function launch(w: World): LaunchError | null {
  const err = checkLaunch(w);
  if (err) return err;
  const s = w.state;
  s.ship.launchAt = s.time + SHIP.launchTime;
  const yard = shipyard(w)!;
  const [yw, yh] = w.footprintOf(yard);
  const yx = yard.x + yw / 2;
  const yy = yard.y + yh / 2;
  for (const n of s.nests) {
    const [cx, cy] = nestCentre(n);
    if (Math.hypot(cx - yx, cy - yy) <= SHIP.wakeRadius) {
      provoke(w, n);
      // They stay angry for the whole countdown.
      n.angryUntil = Math.max(n.angryUntil, s.ship.launchAt + NESTS.calmAfter);
    }
  }
  w.events.push(`Launch in ${SHIP.launchTime} seconds. The engines have woken the bugs: hold the shipyard!`);
  return null;
}

export function tickShip(w: World): void {
  const s = w.state;
  const ship = s.ship;
  if (ship.launchAt == null) return;
  if (!shipyard(w)) {
    ship.launchAt = null;
    return;
  }
  if (s.time < ship.launchAt) return;
  ship.launchAt = null;
  ship.escaped = true;
  w.events.push('You got out.');
}

/**
 * The shipyard is gone (destroyed or demolished). A launch in progress fails.
 * Hardcore loses the ship with a destroyed shipyard; otherwise the stages
 * built so far are kept, so a new shipyard picks up where this one left off.
 */
export function onShipyardRemoved(w: World, destroyed: boolean): void {
  const ship = w.state.ship;
  const wasLaunching = ship.launchAt != null;
  ship.launchAt = null;
  if (destroyed && w.state.mode === 'hardcore') {
    ship.stage = 0;
    ship.delivered = {};
    w.events.push('The shipyard was destroyed, and the ship with it.');
  } else if (destroyed || wasLaunching) {
    w.events.push(`The shipyard is gone${wasLaunching ? ' and the launch failed' : ''}. Build another to carry on with the ship.`);
  }
}

/** After escaping: keep playing on this planet (endless). */
export function keepPlaying(w: World): void {
  if (!awaitingChoice(w)) return;
  w.state.ship.endless = true;
  const yard = shipyard(w);
  if (yard) w.remove(yard, false);
}

/** Numbers for the victory screen. */
export function runStats(w: World): { label: string; value: string }[] {
  const s = w.state;
  const mins = Math.floor(s.time / 60);
  const cleared = s.nests.filter((n) => !s.enemies.some((e) => e.nest === n.id)).length;
  return [
    { label: 'Time on the planet', value: `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` },
    { label: 'Buildings standing', value: String(s.buildings.length) },
    { label: 'Research done', value: String(s.researched.length) },
    { label: 'Bug nests cleared', value: `${cleared} of ${s.nests.length}` },
    { label: 'Hub breaches', value: String(s.breaches) },
  ];
}
