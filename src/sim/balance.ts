// The balance script (D-174): each age's reference outpost against one nest of each kind and stage. It
// measures what a defence can hold off, with logistics out of the way: turrets are kept full, power is free,
// no threat level, Normal difficulty. Run by balance.test.ts, which prints the table.
import { BLUEPRINTS, ITEM_IDS, NESTS, RESEARCH, TURRETS, stageSize, type BuildingType, type NestKind } from './data';
import { indexNests, newNest, populate, provoke } from './nests';
import { TICK, World } from './world';

/** One of the outpost's buildings, relative to its middle. */
type Piece = [BuildingType, number, number];

/** A ring of `type` around the middle, `r` tiles out, with gaps where turrets stand. */
function ring(type: BuildingType, r: number): Piece[] {
  const out: Piece[] = [];
  for (let d = -r; d <= r; d++) out.push([type, d, -r], [type, d, r], [type, -r, d], [type, r, d]);
  return out.filter(([, x, y], i, a) => a.findIndex(([, x2, y2]) => x2 === x && y2 === y) === i);
}

/**
 * Each age's reference outpost: what a player who has just reached the age could afford to guard a far
 * extractor with. A storage unit in the middle is what the bugs are after.
 */
export const OUTPOSTS: Record<string, Piece[]> = {
  wood: [...ring('palisade', 4), ['ballista', -2, -2], ['ballista', 2, -2], ['ballista', -2, 2], ['ballista', 2, 2], ['spike_pit', 5, 0], ['spike_pit', -5, 0]],
  iron: [...ring('wall', 4), ['turret', -2, -2], ['turret', 2, -2], ['turret', -2, 2], ['turret', 2, 2], ['cannon', 0, -2], ['cannon', 0, 2]],
  steam: [...ring('steel_wall', 4), ['turret2', -2, -2], ['turret2', 2, -2], ['turret2', -2, 2], ['turret2', 2, 2], ['mortar', -2, 0], ['mortar', 2, 0]],
  electric: [...ring('steel_wall', 5), ['tesla', -2, -2], ['tesla', 2, -2], ['tesla', -2, 2], ['tesla', 2, 2], ['railgun', -3, 0], ['turret2', 3, -1], ['turret2', 3, 1]],
};

/** How far from the hub each kind of nest is met first, and how far out its stage-1 nests are tested. */
export const BANDS: [NestKind, number][] = [
  ['warren', 45],
  ['runnel', 70],
  ['hive', 90],
  ['den', 110],
  ['barrow', 130],
];

export interface Fight {
  age: string;
  kind: NestKind;
  distance: number;
  stage: number;
  bugs: number;
  /**
   * held: no bug left and the storage unit stands; fell: the storage unit was destroyed; ignored: the bugs
   * never reached the outpost (no building of it was hurt) before the fight was given up; stalemate: they did,
   * but neither side won in time.
   */
  outcome: 'held' | 'fell' | 'ignored' | 'stalemate';
  /** Seconds until the last bug fell, or the fight was given up. */
  seconds: number;
  /** Buildings lost, of the outpost's. */
  lost: number;
}

const LIMIT = 240; // seconds a fight may last

/** One outpost against one nest. Deterministic: the same seed gives the same fight in every browser. */
export function fight(age: string, kind: NestKind, distance: number, stage: number, seed = 5): Fight {
  const w = World.create(seed);
  w.freePower = true;
  w.clearWater();
  const s = w.state;
  s.researched = RESEARCH.map((r) => r.id);
  s.ship.blueprints = BLUEPRINTS.map((b) => b.id);
  s.inventory = Object.fromEntries(ITEM_IDS.map((i) => [i, 99999]));
  s.nests = [];
  s.enemies = [];
  s.time = 60; // morning: no night range, no raids
  const hub = w.hub!;
  // The outpost 60 tiles west of the hub, out of its gun's reach; the nest's cell 14 tiles east of it.
  const [ox, oy] = [hub.x - 60, hub.y + 4];
  for (let y = oy - 12; y <= oy + 12; y++) for (let x = ox - 12; x <= ox + 30; x++) if (w.inBounds(x, y)) s.resources[w.idx(x, y)] = s.trees[w.idx(x, y)] = 0;
  const storage = w.place('storage', ox, oy, 0);
  if (typeof storage === 'string') throw new Error(`storage: ${storage}`);
  for (const [type, dx, dy] of OUTPOSTS[age]) {
    const b = w.place(type, ox + dx, oy + dy, 0);
    if (typeof b === 'string') throw new Error(`${type} at ${dx},${dy}: ${b}`);
  }
  const ids = new Set(s.buildings.filter((b) => b.id !== hub.id).map((b) => b.id));
  for (const b of s.buildings) b.hp = w.maxHp(b);
  const n = newNest(0, ox + 14, oy - NESTS.cell / 2, distance, 1, kind);
  const k = stageSize(stage);
  for (const t of Object.keys(n.brood) as (keyof typeof n.brood)[]) n.brood[t] = Math.round(n.brood[t] * k);
  n.hp = n.maxHp = Math.round(n.hp * k);
  n.stage = stage;
  s.nests.push(n);
  indexNests(w);
  populate(w, n, distance);
  const bugs = s.enemies.length;
  provoke(w, n);
  let t = 0;
  for (; t < LIMIT && s.enemies.length && w.byId.has(storage.id); t += TICK) {
    n.angryUntil = s.time + NESTS.calmAfter; // the nest keeps coming: a fight to the end
    for (const b of s.buildings) {
      const def = TURRETS[b.type];
      if (def && def.maxShots) b.ammo = def.maxShots; // kept full: logistics aren't measured here
    }
    w.tick(TICK);
  }
  const lost = [...ids].filter((id) => !w.byId.has(id)).length;
  const hurt = lost > 0 || s.buildings.some((b) => ids.has(b.id) && b.hp < w.maxHp(b));
  const outcome = !w.byId.has(storage.id) ? 'fell' : !s.enemies.length ? 'held' : hurt ? 'stalemate' : 'ignored';
  return { age, kind, distance, stage, bugs, outcome, seconds: Math.round(t), lost };
}

/** Every age against every kind of nest, at stages 1 and 3. */
export function balanceTable(): Fight[] {
  const out: Fight[] = [];
  for (const age of Object.keys(OUTPOSTS)) for (const [kind, distance] of BANDS) for (const stage of [1, 3]) out.push(fight(age, kind, distance, stage));
  return out;
}

/** The table as text: one row per nest, one column per age ("held 34s, 2 lost", "FELL 80s", "ignored" or "stalemate"). */
export function formatTable(rows: Fight[]): string {
  const ages = Object.keys(OUTPOSTS);
  const cell = (f: Fight) => (f.outcome === 'held' ? `held ${f.seconds}s, ${f.lost} lost` : f.outcome === 'fell' ? `FELL ${f.seconds}s` : f.outcome);
  const lines = [`| nest | bugs | ${ages.join(' | ')} |`, `|---|---|${ages.map(() => '---').join('|')}|`];
  for (const [kind, distance] of BANDS) {
    for (const stage of [1, 3]) {
      const row = rows.filter((r) => r.kind === kind && r.stage === stage);
      lines.push(`| ${kind} ${distance} st${stage} | ${row[0]?.bugs ?? 0} | ${ages.map((a) => cell(row.find((r) => r.age === a)!)).join(' | ')} |`);
    }
  }
  return lines.join('\n');
}
