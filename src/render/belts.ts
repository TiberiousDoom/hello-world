// How belts connect to their neighbours, for drawing corners, end caps and
// joins. Mirrors the side rules in World.insert, without capacity checks.

import { DX, DY, Dir } from '../sim/data';
import { Building, World } from '../sim/world';

const turn = (d: Dir, by: number) => ((((d + by) % 4) + 4) % 4) as Dir;

/** Whether `n` sends items onto tile (x, y). Big machines output from the middle of their front edge. */
export function outputsTo(world: World, n: Building, x: number, y: number): boolean {
  let dirs: Dir[];
  switch (n.type) {
    case 'belt':
    case 'express_belt':
    case 'roller':
    case 'crate':
    case 'storage':
    case 'storage_silo':
    case 'extractor':
    case 'lumber_camp':
    case 'furnace':
    case 'workshop':
    case 'assembler':
    case 'sawmill':
    case 'blacksmith':
    case 'machine_shop':
    case 'steel_works':
    case 'powder_mill':
    case 'circuit_works':
    case 'port':
      dirs = [n.dir];
      break;
    case 'tunnel':
      dirs = world.isTunnelExit(n) ? [n.dir] : [];
      break;
    case 'splitter':
      return world.splitterLanes(n).some((l) => l.outX === x && l.outY === y);
    default:
      dirs = [];
  }
  return dirs.some((d) => {
    const o = world.outputTile(n, d);
    return o.x === x && o.y === y;
  });
}

/** Whether `b` takes items from the tile at (fromX, fromY). */
export function acceptsFrom(world: World, b: Building, fromX: number, fromY: number): boolean {
  const front = b.x + DX[b.dir] === fromX && b.y + DY[b.dir] === fromY;
  switch (b.type) {
    case 'belt':
    case 'express_belt':
    case 'roller':
    case 'crate':
      return !front;
    case 'storage':
    case 'storage_silo': {
      // From anywhere but the tiles past its front edge (D-116).
      const [w, h] = world.footprintOf(b);
      const inside = (x: number, y: number) => x >= b.x && y >= b.y && x < b.x + w && y < b.y + h;
      return inside(fromX, fromY) || !inside(fromX - DX[b.dir], fromY - DY[b.dir]);
    }
    case 'tunnel':
      return !front && !world.isTunnelExit(b);
    case 'splitter':
      return world.splitterLanes(b).some((l) => l.x - DX[b.dir] === fromX && l.y - DY[b.dir] === fromY);
    case 'boiler':
    case 'shipyard':
    case 'repair':
    case 'hub':
    case 'furnace':
    case 'workshop':
    case 'assembler':
    case 'sawmill':
    case 'blacksmith':
    case 'machine_shop':
    case 'steel_works':
    case 'powder_mill':
    case 'circuit_works':
    case 'turret':
    case 'turret2':
    case 'mortar':
    case 'artillery':
    case 'cannon':
      return true;
    default:
      return false;
  }
}

/** The building on the side `d` of `b`, if it sends items into `b`. */
export function feederOn(world: World, b: Building, d: Dir): Building | undefined {
  const fx = b.x + DX[d];
  const fy = b.y + DY[d];
  const n = world.buildingAt(fx, fy);
  if (!n || n === b) return undefined;
  return outputsTo(world, n, b.x, b.y) && acceptsFrom(world, b, fx, fy) ? n : undefined;
}

export interface BeltLook {
  /** The side items come in from, as a direction from the belt. Straight belts: behind. */
  from: Dir;
  curved: boolean;
  /** Something feeds in (draws no start cap). */
  fed: boolean;
  /** The tile in front takes items from this belt (draws no end cap). */
  joined: boolean;
}

/**
 * A belt curves when its only feeder is on one side. With a feeder behind, or
 * feeders on both sides, it stays straight (side feeders merge onto it).
 */
export function beltLook(world: World, b: Building): BeltLook {
  const back = turn(b.dir, 2);
  const left = turn(b.dir, 3);
  const right = turn(b.dir, 1);
  const fb = !!feederOn(world, b, back);
  const fl = !!feederOn(world, b, left);
  const fr = !!feederOn(world, b, right);
  const curved = !fb && fl !== fr;
  const front = world.buildingAt(b.x + DX[b.dir], b.y + DY[b.dir]);
  return {
    from: curved ? (fl ? left : right) : back,
    curved,
    fed: fb || fl || fr,
    joined: !!front && acceptsFrom(world, front, b.x, b.y),
  };
}
