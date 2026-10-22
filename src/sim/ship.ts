// The colony supply ship (D-034, D-046): a shipyard, four stages built once
// from items belted into it, then supply runs. Each run's cargo is belted in,
// and a launch the shipyard has to survive delivers it. The engines wake the
// bug territories nearby (D-038), and their bugs come for the shipyard (D-047).
// The game carries on, and the ship comes back after a while for the next,
// bigger run.

import { ItemCounts, ItemId, NESTS, SHIP, ShipStage, cargoFor } from './data';
import { Nest, nestAlive, nestCentre, provoke } from './nests';
import type { Building, World } from './world';

export interface ShipState {
  stage: number; // index of the stage being built; SHIP.stages.length when the ship is finished
  delivered: ItemCounts; // towards the current stage, or the current run's cargo once the ship is finished
  launchAt: number | null; // game time of lift-off, while a launch is under way
  runs: number; // supply runs delivered
  returnAt: number | null; // game time the ship is back, while it's away
  drawn: number[]; // nests whose bugs are heading for the shipyard, during a launch
}

export function createShipState(): ShipState {
  return { stage: 0, delivered: {}, launchAt: null, runs: 0, returnAt: null, drawn: [] };
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

/** The ship is on its way to the colony and back. */
export const shipAway = (w: World): boolean => w.state.ship.returnAt != null;

/** The cargo the next supply run needs. */
export const currentCargo = (w: World): ItemCounts => cargoFor(w.state.ship.runs);

const filled = (need: ItemCounts, have: ItemCounts): boolean => Object.entries(need).every(([k, n]) => (have[k as ItemId] ?? 0) >= n!);

/** Every item the next run needs is aboard. */
export const cargoLoaded = (w: World): boolean => shipFinished(w) && filled(currentCargo(w), w.state.ship.delivered);

/** Takes an item into the shipyard if the current stage, or the cargo, still needs it. */
export function insertShip(w: World, item: ItemId): boolean {
  const ship = w.state.ship;
  const stage = currentStage(w);
  if (!stage && (shipAway(w) || launching(w))) return false;
  const need = (stage ? stage.items : currentCargo(w))[item] ?? 0;
  const have = ship.delivered[item] ?? 0;
  if (have >= need) return false;
  ship.delivered[item] = have + 1;
  if (stage && filled(stage.items, ship.delivered)) completeStage(w, stage);
  else if (!stage && cargoLoaded(w)) w.events.push('The cargo is loaded. Select the shipyard and press Launch when your defences are ready.');
  return true;
}

function completeStage(w: World, stage: ShipStage): void {
  const ship = w.state.ship;
  ship.stage++;
  ship.delivered = {};
  const next = currentStage(w);
  w.events.push(next ? `Ship: ${stage.name} done. Next, the ${next.name.toLowerCase()}.` : 'The ship is finished! Now load it with supplies for the colony.');
}

export type LaunchError = 'not-ready' | 'no-shipyard' | 'launching' | 'away';

export function checkLaunch(w: World): LaunchError | null {
  if (launching(w)) return 'launching';
  if (shipAway(w)) return 'away';
  if (!cargoLoaded(w)) return 'not-ready';
  if (!shipyard(w)) return 'no-shipyard';
  return null;
}

/**
 * The live nests a launch from the shipyard would wake: every one within
 * SHIP.wakeRadius, and at least the SHIP.minWake nearest, however far.
 */
export function nestsToWake(w: World): Nest[] {
  const yard = shipyard(w);
  if (!yard) return [];
  const [yx, yy] = w.centreOf(yard);
  const live = w.state.nests
    .filter((n) => nestAlive(w, n))
    .map((n) => ({ n, d: Math.hypot(nestCentre(n)[0] - yx, nestCentre(n)[1] - yy) }))
    .sort((a, b) => a.d - b.d);
  return live.filter((x, i) => x.d <= SHIP.wakeRadius || i < SHIP.minWake).map((x) => x.n);
}

/**
 * Starts the countdown. The engines wake the nests within reach, and their
 * bugs come for the shipyard, past their usual leash, until lift-off.
 */
export function launch(w: World): LaunchError | null {
  const err = checkLaunch(w);
  if (err) return err;
  const s = w.state;
  const woken = nestsToWake(w);
  s.ship.launchAt = s.time + SHIP.launchTime;
  s.ship.drawn = woken.map((n) => n.id);
  for (const n of woken) {
    provoke(w, n);
    // They stay angry for the whole countdown.
    n.angryUntil = Math.max(n.angryUntil, s.ship.launchAt + NESTS.calmAfter);
  }
  w.markFlowDirty();
  w.events.push(
    `Launch in ${SHIP.launchTime} seconds. The engines woke ${woken.length} nest${woken.length === 1 ? '' : 's'}, and the bugs are coming for the shipyard: hold it!`,
  );
  return null;
}

export function tickShip(w: World): void {
  const s = w.state;
  const ship = s.ship;
  if (ship.returnAt != null && s.time >= ship.returnAt) {
    ship.returnAt = null;
    w.events.push('The supply ship is back. Load the next run.');
  }
  if (ship.launchAt == null) return;
  if (!shipyard(w)) {
    ship.launchAt = null;
    ship.drawn = [];
    return;
  }
  if (s.time < ship.launchAt) return;
  ship.launchAt = null;
  ship.drawn = []; // the bugs lose interest and, once calm, wander home
  ship.runs++;
  ship.delivered = {};
  ship.returnAt = s.time + SHIP.returnTime;
  w.events.push(`Supply run ${ship.runs} is on its way to the colony. The ship will be back in ${Math.round(SHIP.returnTime / 60)} minutes.`);
}

/**
 * The shipyard is gone (destroyed or demolished). A launch in progress fails.
 * In Hardcore, a destroyed shipyard takes the docked ship and its cargo with
 * it; otherwise everything built and loaded so far is kept, so a new shipyard
 * picks up where this one left off. A ship that's away is safe either way.
 */
export function onShipyardRemoved(w: World, destroyed: boolean): void {
  const ship = w.state.ship;
  const wasLaunching = ship.launchAt != null;
  ship.launchAt = null;
  ship.drawn = [];
  if (destroyed && w.state.mode === 'hardcore' && !shipAway(w)) {
    ship.stage = 0;
    ship.delivered = {};
    w.events.push('The shipyard was destroyed, and the ship with it.');
  } else if (destroyed || wasLaunching) {
    w.events.push(`The shipyard is gone${wasLaunching ? ' and the launch failed' : ''}. Build another to carry on with the ship.`);
  }
}

/** Numbers for the first-delivery screen. */
export function runStats(w: World): { label: string; value: string }[] {
  const s = w.state;
  const mins = Math.floor(s.time / 60);
  const cleared = s.nests.filter((n) => !s.enemies.some((e) => e.nest === n.id)).length;
  return [
    { label: 'Time on the planet', value: `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` },
    { label: 'Supply runs delivered', value: String(s.ship.runs) },
    { label: 'Buildings standing', value: String(s.buildings.length) },
    { label: 'Research done', value: String(s.researched.length) },
    { label: 'Bug nests cleared', value: `${cleared} of ${s.nests.length}` },
    { label: 'Hub breaches', value: String(s.breaches) },
  ];
}
