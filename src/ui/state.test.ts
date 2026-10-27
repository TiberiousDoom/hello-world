import { describe, expect, it } from 'vitest';
import { RESEARCH } from '../sim/data';
import { World } from '../sim/world';
import { MAX_PLAYERS } from '../net/protocol';
import { HOME_OFFSET } from '../sim/player';
import { PLAYER_COLORS, createUIState, placementAt, turnTool } from './state';

/** A clear world with everything researched and plenty of stock. */
function clearWorld(): World {
  const w = World.create(1);
  w.freePower = true; // power has tests of its own (D-115)
  w.clearWater();
  w.state.researched = RESEARCH.map((r) => r.id);
  w.state.resources.fill(0);
  w.state.trees.fill(0);
  w.state.nests = [];
  w.state.enemies = [];
  w.nestCells.clear();
  w.state.inventory = { iron_plate: 999, stone: 999, iron_ore: 999, brick: 999, copper_ingot: 999, gear: 999, wire: 999, plank: 999, log: 999 };
  return w;
}

describe('Buildings line up with belts while aiming', () => {
  it('beside the end of a belt line, a building turns to carry the flow straight on', () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    for (let i = 0; i < 4; i++) w.place('belt', x0 + i, y, 0); // running east, ending at x0 + 3
    // Aimed just past the end, facing north: it turns east, with the belt running into it.
    expect(placementAt(w, 'furnace', { x: x0 + 4, y }, 3, true)).toEqual({ x: x0 + 4, y, dir: 0 });
  });

  it('near the start of a belt line, a building faces it and sits so its output runs onto the belt', () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    for (let i = 0; i < 4; i++) w.place('belt', x0 + i, y, 0); // starts at x0, running east
    // Aimed just left of the start, facing west: it turns east and lines its output up with the belt.
    const p = placementAt(w, 'furnace', { x: x0 - 1, y: y + 1 }, 2, true);
    expect(p.dir).toBe(0);
    const out = { x: p.x + 2, y: p.y }; // a 2×2 facing east outputs from its top-right tile's east side
    expect(out).toEqual({ x: x0, y });
  });

  it("with no belts around, or in a dragged line, the building keeps the player's facing", () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    expect(placementAt(w, 'furnace', { x: x0, y }, 1, true)).toEqual({ x: x0, y, dir: 1 });
    for (let i = 0; i < 4; i++) w.place('belt', x0 + i, y, 0);
    expect(placementAt(w, 'furnace', { x: x0 + 4, y }, 3, false)).toEqual({ x: x0 + 4, y, dir: 3 });
  });

  it('dropped onto a belt, it still faces the way the belt runs', () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    for (let i = 0; i < 4; i++) w.place('belt', x0, y + i, 1); // running south
    expect(placementAt(w, 'furnace', { x: x0, y: y + 1 }, 0, true).dir).toBe(1);
  });
});

describe('The player can turn a building away from the belts (#85)', () => {
  it("the first turn starts from the facing shown, and from then on the player's facing wins", () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    for (let i = 0; i < 4; i++) w.place('belt', x0 + i, y, 0); // running east, ending at x0 + 3
    const ui = createUIState();
    ui.tool = 'furnace';
    ui.dir = 3;
    ui.hover = { x: x0 + 4, y };
    expect(placementAt(w, 'furnace', ui.hover, ui.dir, true, ui.dirSet).dir).toBe(0); // lined up: east
    turnTool(w, ui, 1);
    expect(ui.dir).toBe(1); // one turn on from the east it showed, not from its old north
    expect(ui.dirSet).toBe(true);
    expect(placementAt(w, 'furnace', ui.hover, ui.dir, true, ui.dirSet).dir).toBe(1);
    turnTool(w, ui, 1);
    expect(placementAt(w, 'furnace', ui.hover, ui.dir, true, ui.dirSet).dir).toBe(2);
  });

  it("a turned building dropped onto a belt keeps the player's facing", () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    for (let i = 0; i < 4; i++) w.place('belt', x0, y + i, 1); // running south
    expect(placementAt(w, 'furnace', { x: x0, y: y + 1 }, 0, true, true).dir).toBe(0);
  });
});

describe('Splitters snap onto either side of a belt (#63)', () => {
  it("the splitter's second lane goes on the side of the belt the pointer is nearer, unless that side is blocked", () => {
    const w = clearWorld();
    const x0 = w.hub!.x - 20;
    const y = w.hub!.y - 10;
    for (let i = 0; i < 4; i++) w.place('belt', x0 + i, y, 0); // running east
    expect(placementAt(w, 'splitter', { x: x0 + 1, y, fx: 0.5, fy: 0.2 }, 0, true)).toEqual({ x: x0 + 1, y: y - 1, dir: 0 });
    expect(placementAt(w, 'splitter', { x: x0 + 1, y, fx: 0.5, fy: 0.8 }, 0, true)).toEqual({ x: x0 + 1, y, dir: 0 });
    w.place('wall', x0 + 1, y - 1, 0);
    expect(placementAt(w, 'splitter', { x: x0 + 1, y, fx: 0.5, fy: 0.2 }, 0, true)).toEqual({ x: x0 + 1, y, dir: 0 });
    for (let i = 0; i < 4; i++) w.place('belt', x0 + 10, y + i, 1); // running south: the lanes go east and west
    expect(placementAt(w, 'splitter', { x: x0 + 10, y: y + 1, fx: 0.1, fy: 0.5 }, 3, true)).toEqual({ x: x0 + 9, y: y + 1, dir: 1 });
  });
});

describe('Every co-op slot has its own look and place (D-083)', () => {
  it('a colour and a start spot below the hub for each slot, none shared', () => {
    expect(PLAYER_COLORS.length).toBeGreaterThanOrEqual(MAX_PLAYERS);
    expect(new Set(PLAYER_COLORS.slice(0, MAX_PLAYERS)).size).toBe(MAX_PLAYERS);
    expect(HOME_OFFSET.length).toBeGreaterThanOrEqual(MAX_PLAYERS);
    expect(new Set(HOME_OFFSET.slice(0, MAX_PLAYERS)).size).toBe(MAX_PLAYERS);
    expect(HOME_OFFSET.slice(0, 4)).toEqual([0, 1, -1, 2]); // saved games keep their engineers' spots
  });

  it('engineers in a full room all start on the map, apart', () => {
    const w = World.create(3);
    for (let id = 1; id < MAX_PLAYERS; id++) w.addPlayer(id);
    const spots = w.state.players.map((p) => `${p.x},${p.y}`);
    expect(new Set(spots).size).toBe(MAX_PLAYERS);
    for (const p of w.state.players) expect(p.x >= 0 && p.x < w.state.width && p.y >= 0 && p.y < w.state.height).toBe(true);
  });
});
