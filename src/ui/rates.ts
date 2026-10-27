// Production and belt rates, worked out from the numbers in data.ts so they can
// be shown in the game (#48): what a building can do at most, what it's doing
// now, and why not more.

import {
  BELT_SPACING,
  BUILDINGS,
  BuildingType,
  EXTRACTOR_PERIOD,
  ITEMS,
  ItemId,
  LUMBER,
  OUTPUT_BUFFER,
  RECIPES,
  RECIPE_BY_ID,
  REPAIR,
  Recipe,
  TURRETS,
  beltSpeed,
  isBelt,
  isMachine,
  BELT_SPEED,
  ROLLER,
  burnsFuel,
  HYDRAULIC,
  ELECTRIC_DEFENCES,
  ELECTRIC_MACHINES,
} from '../sim/data';
import type { Building, World } from '../sim/world';

/** Rounds a per-minute rate for display: whole numbers, or one decimal below 10. */
export function fmt(perMinute: number): string {
  return perMinute >= 10 || Number.isInteger(perMinute) ? String(Math.round(perMinute)) : perMinute.toFixed(1);
}

/** Most items a belt can carry in a minute: its speed over the gap between items. */
export function beltPerMinute(type: BuildingType): number {
  if (type === 'roller') return (BELT_SPEED / BELT_SPACING) * 60; // one lane, at belt speed once it's packed (D-106)
  return (beltSpeed(type) / BELT_SPACING) * 60 * 2; // two lanes (#61)
}

/** A recipe's output, and each input, per minute when the machine never waits. */
export function recipePerMinute(r: Recipe): { output: number; inputs: [ItemId, number][] } {
  const runs = 60 / r.time;
  return { output: r.count * runs, inputs: Object.entries(r.inputs).map(([k, n]) => [k as ItemId, n! * runs]) };
}

const name = (i: ItemId) => ITEMS[i].name.toLowerCase();

/** One line on what a kind of building can do at most, for toolbar tooltips. */
export function rateSummary(type: BuildingType): string {
  if (type === 'roller') return `${fmt(ROLLER.speed)} tiles/s, ${fmt(BELT_SPEED)} when packed; up to ${fmt(beltPerMinute(type))} items/min`;
  if (isBelt(type)) return `${beltSpeed(type)} tiles/s, up to ${fmt(beltPerMinute(type))} items/min`;
  if (type === 'tunnel' || type === 'splitter') return `up to ${fmt(beltPerMinute('belt'))} items/min, like a belt`;
  if (type === 'extractor') return `${fmt(60 / EXTRACTOR_PERIOD)} ore/min per ore tile under it, up to ${fmt(240 / EXTRACTOR_PERIOD)}`;
  if (type === 'lumber_camp') return `up to ${fmt((LUMBER.logsPerTree * 60) / LUMBER.period)} logs/min while trees last`;
  if (isMachine(type)) {
    return RECIPES.filter((r) => r.machine === type)
      .map((r) => `${name(r.output)} ${fmt(recipePerMinute(r).output)}/min`)
      .join(', ');
  }
  const t = TURRETS[type];
  if (t) return `${t.rate} shots/s, ${fmt((t.rate * 60) / t.shotsPerItem)} ${name(t.ammoItem)}/min while firing`;
  if (type === 'repair') return `heals ${REPAIR.hpPerSecond} HP/s`;
  return '';
}

/** Lines for a placed building's panel: its top rate, and what it's doing now. Empty if it doesn't make or move things. */
export function buildingRates(world: World, b: Building): { max: string; now: string } | null {
  if (isBelt(b.type)) return { max: rateSummary(b.type), now: '' };
  if (b.type === 'extractor') {
    const ore = b.recipe as ItemId | null;
    if (!ore) return { max: rateSummary(b.type), now: 'Not on ore' };
    const [fw, fh] = world.footprintOf(b);
    let tiles = 0;
    for (let y = b.y; y < b.y + fh; y++) for (let x = b.x; x < b.x + fw; x++) if (world.resourceAt(x, y) === ore) tiles++;
    const status = !tiles ? 'Used up' : b.outputs.length >= OUTPUT_BUFFER ? 'Output full: nothing is taking it' : 'Mining';
    return { max: `${fmt((60 * tiles * world.speedUp(b)) / EXTRACTOR_PERIOD)} ${name(ore)}/min`, now: nowLine(world, b, status) };
  }
  if (b.type === 'lumber_camp') {
    const [fw, fh] = world.footprintOf(b);
    const status =
      b.outputs.length + LUMBER.logsPerTree > OUTPUT_BUFFER ? 'Output full: nothing is taking it' : world.treesInReach(b.x, b.y, fw, fh).trees.length ? 'Cutting' : 'Waiting for trees to grow back';
    return { max: rateSummary(b.type), now: nowLine(world, b, status) };
  }
  if (isMachine(b.type)) {
    const r = b.recipe ? RECIPE_BY_ID[b.recipe] : undefined;
    if (!r) return null;
    const pm = recipePerMinute(r);
    const k = world.speedUp(b); // Mk2 (D-122)
    const uses = pm.inputs.map(([i, n]) => `${fmt(n * k)} ${name(i)}`).join(' + ');
    return { max: `${fmt(pm.output * k)} ${name(r.output)}/min, using ${uses}/min`, now: nowLine(world, b, ELECTRIC_MACHINES.includes(b.type) && world.electrified(b) <= 0 ? "No electricity: it can't work. Put a power pole near it" : machineStatus(b, r)) };
  }
  const t = TURRETS[b.type];
  // Hydraulic defences (D-117) fire only with power.
  if (t) {
    const now =
      HYDRAULIC.includes(b.type) && world.powered(b) <= 0
        ? "No power: it can't fire. Lay a drive shaft to it"
        : ELECTRIC_DEFENCES.includes(b.type) && world.electrified(b) <= 0
          ? "No electricity: it can't fire. Put a power pole near it"
          : '';
    return { max: rateSummary(b.type), now };
  }
  return null;
}

function machineStatus(b: Building, r: Recipe): string {
  if (burnsFuel(b.type) && b.ammo <= 0) return 'Out of fuel: feed it logs or charcoal';
  if (b.progress >= 0) return 'Working';
  if (b.outputs.length + r.count > OUTPUT_BUFFER + 1) return 'Output full: nothing is taking it';
  const missing = Object.entries(r.inputs)
    .filter(([k, n]) => (b.inputs[k as ItemId] ?? 0) < n!)
    .map(([k]) => name(k as ItemId));
  return missing.length ? `Waiting for ${missing.join(' and ')}` : 'Starting';
}

/** How many it made in the last minute (or since it was built, scaled up), and what it's doing. */
function nowLine(world: World, b: Building, status: string): string {
  const { count, seconds } = world.madeRecently(b.id);
  if (seconds < 5) return status;
  const perMinute = (count * 60) / seconds;
  return `${fmt(perMinute)}/min lately · ${status}`;
}

/** Plain text for a tooltip on a toolbar button. */
export function toolTitle(type: BuildingType, key: number): string {
  const rates = rateSummary(type);
  return `${BUILDINGS[type].name} (${key})${rates ? `: ${rates}` : ''}`;
}
